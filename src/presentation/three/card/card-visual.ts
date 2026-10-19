// CardVisual (runtime §12.5, §15): Group com corpo (espessura 0,012, cantos suavizados), frente, verso,
// camada de acabamento e marcador de seleção. Uma carta oculta recebe só o descriptor opaco (sleeve):
// nunca há textura frontal, raridade ou acabamento na sua representação (R-069, §15.6).
import { DoubleSide, Group, Mesh, MeshBasicMaterial, type BufferGeometry, type Material, type ShaderMaterial } from 'three';
import type { CardFaceData } from '../../../domain/cards/text.ts';
import type { RenderSystem } from '../core/render-system.ts';
import { COLORS } from '../core/tokens.ts';
import { CARD_HALF_T, CARD_HEIGHT, CARD_RADIUS, CARD_THICKNESS, CARD_WIDTH, roundedRectGeometry, roundedRectSideGeometry, roundedRingGeometry } from './geometry.ts';
import { templateKindOf, type SleeveStyle } from './face-canvas.ts';
import { acquireFinishMaterial, asFinish, type FinishKind } from './finish-material.ts';
import { onCardFontsReady } from './fonts.ts';
import { onCardBackReady } from './card-back.ts';
import { onPrintedArtReady } from './printed-art.ts';
import { acquireFaceTexture, acquireSleeveTexture, releaseTexture, type FaceResolution, type TextureLease } from './textures.ts';

export const PICK_LAYER = 1;

export type PickTarget =
  | { readonly kind: 'ENTITY'; readonly entityId: string }
  | { readonly kind: 'HAND_CARD'; readonly cardId: string }
  | { readonly kind: 'SLOT'; readonly anchorId: string }
  | { readonly kind: 'PILE'; readonly anchorId: string };

export type CardDescriptor =
  | { readonly kind: 'FACE'; readonly face: CardFaceData; readonly sleeve: SleeveStyle }
  | { readonly kind: 'HIDDEN'; readonly opaqueId: string; readonly sleeve: SleeveStyle };

export type MarkerState = 'NONE' | 'HOVER' | 'SELECTABLE' | 'EVOLVE' | 'SELECTED' | 'TARGET' | 'DENY';
export type FaceVisibility = 'FRONT' | 'BACK' | 'BOTH';

export type CardVisual = {
  readonly group: Group;
  readonly descriptor: () => CardDescriptor;
  readonly setDescriptor: (descriptor: CardDescriptor) => void;
  readonly setMarker: (marker: MarkerState) => void;
  readonly marker: () => MarkerState;
  readonly setFaceVisibility: (visibility: FaceVisibility) => void;
  readonly setFinishEnabled: (enabled: boolean) => void;
  readonly setFinishOverride: (finish: FinishKind | null) => void;
  readonly setOpacity: (opacity: number) => void;
  readonly setPickTarget: (target: PickTarget | null) => void;
  readonly pickTarget: () => PickTarget | null;
  readonly setRenderOrder: (order: number) => void;
  /** Encerra estados transitórios (opacidade, marcador de hover) — idempotente. */
  readonly finishVisual: () => void;
  /** Libera texturas/materiais por referência — idempotente. */
  readonly disposeVisual: () => void;
  readonly isDisposed: () => boolean;
};

export const MARKER_COLORS: Readonly<Record<Exclude<MarkerState, 'NONE'>, { color: string; opacity: number; thick: boolean }>> = {
  HOVER: { color: COLORS.primary, opacity: 0.75, thick: false },
  SELECTABLE: { color: COLORS.cyan, opacity: 0.7, thick: false },
  /** Evolução jogável na mão (gameplay-pocket §6): contorno amarelo, diferente do ciano das outras jogáveis. */
  EVOLVE: { color: COLORS.pointGold, opacity: 0.95, thick: true },
  SELECTED: { color: COLORS.cyan, opacity: 1, thick: true },
  TARGET: { color: COLORS.cyan, opacity: 0.9, thick: true },
  /** Soltura recusada: contorno vermelho enquanto a carta treme e volta à mão. */
  DENY: { color: COLORS.danger, opacity: 1, thick: true },
};

const live = new Set<() => void>();
let fontHookInstalled = false;

function installFontHook(): void {
  if (fontHookInstalled) return;
  fontHookInstalled = true;
  const refreshAll = () => {
    for (const refresh of [...live]) refresh();
  };
  onCardFontsReady(refreshAll);
  // A arte do verso chega de forma assíncrona: redesenha os versos quando estiver pronta.
  onCardBackReady(refreshAll);
  // Idem para as imagens das impressões em “Impressão completa”.
  onPrintedArtReady(refreshAll);
}

/** Material de marcador compartilhado; o pulso do alvo é global (um uniforme de opacidade por estado). */
export function markerMaterial(rs: RenderSystem, marker: Exclude<MarkerState, 'NONE'>): MeshBasicMaterial {
  const spec = MARKER_COLORS[marker];
  return rs.resources.acquire(`mat:marker:${marker}`, () => new MeshBasicMaterial({
    color: spec.color, transparent: true, opacity: spec.opacity, depthWrite: false, toneMapped: false,
  }));
}

export function cardGeometries(rs: RenderSystem): { front: BufferGeometry; side: BufferGeometry; ringThin: BufferGeometry; ringThick: BufferGeometry } {
  return {
    front: rs.resources.acquire('geo:card:front', () => roundedRectGeometry(CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS, 6)),
    side: rs.resources.acquire('geo:card:side', () => roundedRectSideGeometry(CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS, CARD_THICKNESS, 6)),
    ringThin: rs.resources.acquire('geo:card:ring-thin', () => roundedRingGeometry(CARD_WIDTH + 0.07, CARD_HEIGHT + 0.07, CARD_RADIUS + 0.035, 0.045, 6)),
    ringThick: rs.resources.acquire('geo:card:ring-thick', () => roundedRingGeometry(CARD_WIDTH + 0.09, CARD_HEIGHT + 0.09, CARD_RADIUS + 0.045, 0.085, 6)),
  };
}

function releaseGeometries(rs: RenderSystem): void {
  for (const key of ['geo:card:front', 'geo:card:side', 'geo:card:ring-thin', 'geo:card:ring-thick']) rs.resources.release(key);
}

export function createCardVisual(rs: RenderSystem, initial: CardDescriptor, options: { resolution?: FaceResolution; faceVisibility?: FaceVisibility } = {}): CardVisual {
  installFontHook();
  const resolution = options.resolution ?? 'STANDARD';
  const geos = cardGeometries(rs);
  const edgeMat = rs.resources.acquire('mat:card:edge', () => new MeshBasicMaterial({ color: '#D3DCE6', side: DoubleSide, toneMapped: false }));
  const blankMat = rs.resources.acquire('mat:card:blank-front', () => new MeshBasicMaterial({ color: '#E6ECF2', toneMapped: false }));
  const group = new Group();
  group.name = 'CardVisual';
  const body: Mesh<BufferGeometry, Material> = new Mesh(geos.side, edgeMat);
  body.name = 'BodyMesh';
  const front: Mesh<BufferGeometry, Material> = new Mesh(geos.front, blankMat);
  front.name = 'FrontMesh';
  front.position.z = CARD_HALF_T;
  const back: Mesh<BufferGeometry, Material> = new Mesh(geos.front, blankMat);
  back.name = 'BackMesh';
  back.position.z = -CARD_HALF_T;
  back.rotation.y = Math.PI;
  const finish: Mesh<BufferGeometry, Material> = new Mesh(geos.front, blankMat);
  finish.name = 'FinishOverlay';
  finish.position.z = CARD_HALF_T + 0.0009;
  finish.visible = false;
  finish.renderOrder = 2;
  const marker: Mesh<BufferGeometry, Material> = new Mesh(geos.ringThin, blankMat);
  marker.name = 'SelectionMarker';
  marker.position.z = -CARD_HALF_T - 0.0015;
  marker.visible = false;
  marker.renderOrder = 1;
  group.add(body, front, back, finish, marker);

  let descriptor = initial;
  let faceLease: TextureLease | null = null;
  let sleeveLease: TextureLease | null = null;
  let frontMatKey: string | null = null;
  let backMatKey: string | null = null;
  let finishLease: { key: string; material: ShaderMaterial } | null = null;
  let markerState: MarkerState = 'NONE';
  let markerKey: string | null = null;
  let visibility: FaceVisibility = options.faceVisibility ?? 'BOTH';
  let finishEnabled = true;
  let finishOverride: FinishKind | null = null;
  let opacity = 1;
  let clones: Material[] = [];
  let pick: PickTarget | null = null;
  let disposed = false;

  const materialFor = (lease: TextureLease, prefix: string) => {
    const key = `mat:${prefix}:${lease.key}`;
    const material = rs.resources.acquire(key, () => new MeshBasicMaterial({ map: lease.texture, toneMapped: false }));
    return { key, material };
  };

  const clearClones = () => {
    for (const m of clones) m.dispose();
    clones = [];
  };

  function applyOpacity(): void {
    clearClones();
    if (opacity >= 0.999) {
      front.material = frontMatKey ? rs.resources.get<MeshBasicMaterial>(frontMatKey) ?? blankMat : blankMat;
      back.material = backMatKey ? rs.resources.get<MeshBasicMaterial>(backMatKey) ?? blankMat : blankMat;
      body.material = edgeMat;
      group.visible = true;
      refreshFinish();
      return;
    }
    group.visible = opacity > 0.001;
    const fade = (m: Material) => {
      const c = m.clone();
      c.transparent = true;
      c.opacity = opacity;
      c.depthWrite = opacity > 0.98;
      clones.push(c);
      return c;
    };
    front.material = fade(front.material as Material);
    back.material = fade(back.material as Material);
    body.material = fade(edgeMat);
    finish.visible = false;
  }

  function refreshFinish(): void {
    if (finishLease) {
      rs.resources.release(finishLease.key);
      finishLease = null;
    }
    finish.visible = false;
    if (descriptor.kind !== 'FACE' || !finishEnabled || opacity < 0.999 || visibility === 'BACK') return;
    const kind = finishOverride ?? asFinish(descriptor.face.finish);
    const lease = acquireFinishMaterial(rs, kind, templateKindOf(descriptor.face));
    if (!lease) return;
    finishLease = lease;
    finish.material = lease.material;
    finish.visible = true;
  }

  function applyDescriptor(next: CardDescriptor): void {
    const oldFace = faceLease;
    const oldSleeve = sleeveLease;
    const oldFront = frontMatKey;
    const oldBack = backMatKey;
    faceLease = null;
    frontMatKey = null;
    if (next.kind === 'FACE') {
      faceLease = acquireFaceTexture(rs, next.face, resolution);
      const m = materialFor(faceLease, 'front');
      frontMatKey = m.key;
      front.material = m.material;
    } else front.material = blankMat;
    sleeveLease = acquireSleeveTexture(rs, next.sleeve, resolution);
    const b = materialFor(sleeveLease, 'back');
    backMatKey = b.key;
    back.material = b.material;
    if (oldFront) rs.resources.release(oldFront);
    if (oldBack) rs.resources.release(oldBack);
    releaseTexture(rs, oldFace);
    releaseTexture(rs, oldSleeve);
    descriptor = next;
    group.userData.cardKey = next.kind === 'FACE' ? next.face.printingId : next.opaqueId;
    applyOpacity();
  }

  function applyVisibility(): void {
    front.visible = visibility !== 'BACK';
    back.visible = visibility !== 'FRONT';
    refreshFinish();
  }

  function applyMarker(): void {
    if (markerKey) rs.resources.release(markerKey);
    markerKey = null;
    if (markerState === 'NONE') {
      marker.visible = false;
      return;
    }
    markerKey = `mat:marker:${markerState}`;
    marker.material = markerMaterial(rs, markerState);
    marker.geometry = MARKER_COLORS[markerState].thick ? geos.ringThick : geos.ringThin;
    marker.visible = true;
  }

  const refreshFonts = () => {
    if (!disposed) applyDescriptor(descriptor);
  };
  live.add(refreshFonts);

  applyDescriptor(initial);
  applyVisibility();

  return {
    group,
    descriptor: () => descriptor,
    setDescriptor: (next) => {
      if (disposed) return;
      const same = next.kind === descriptor.kind && next.sleeve === descriptor.sleeve
        && (next.kind === 'FACE' ? descriptor.kind === 'FACE' && JSON.stringify(next.face) === JSON.stringify(descriptor.face) : descriptor.kind === 'HIDDEN' && next.opaqueId === descriptor.opaqueId);
      if (same) return;
      applyDescriptor(next);
      applyVisibility();
    },
    setMarker: (m) => {
      if (disposed || m === markerState) return;
      markerState = m;
      applyMarker();
    },
    marker: () => markerState,
    setFaceVisibility: (v) => {
      if (disposed || v === visibility) return;
      visibility = v;
      applyVisibility();
    },
    setFinishEnabled: (on) => {
      if (disposed || on === finishEnabled) return;
      finishEnabled = on;
      refreshFinish();
    },
    setFinishOverride: (f) => {
      if (disposed) return;
      finishOverride = f;
      refreshFinish();
    },
    setOpacity: (o) => {
      if (disposed) return;
      const next = Math.min(1, Math.max(0, o));
      if (Math.abs(next - opacity) < 1e-4) return;
      const wasFull = opacity >= 0.999;
      opacity = next;
      if (!wasFull && next < 0.999) {
        for (const m of clones) m.opacity = next;
        group.visible = next > 0.001;
        return;
      }
      applyOpacity();
    },
    setPickTarget: (target) => {
      pick = target;
      group.userData.pick = target;
      for (const mesh of [front, back, body]) {
        if (target) mesh.layers.enable(PICK_LAYER);
        else mesh.layers.disable(PICK_LAYER);
      }
    },
    pickTarget: () => pick,
    setRenderOrder: (order) => {
      front.renderOrder = order;
      back.renderOrder = order;
      body.renderOrder = order;
      finish.renderOrder = order + 1;
      marker.renderOrder = order - 1;
    },
    finishVisual: () => {
      if (disposed) return;
      if (opacity < 0.999) {
        opacity = 1;
        applyOpacity();
      }
      if (markerState === 'HOVER') {
        markerState = 'NONE';
        applyMarker();
      }
    },
    disposeVisual: () => {
      if (disposed) return;
      disposed = true;
      live.delete(refreshFonts);
      group.removeFromParent();
      clearClones();
      if (finishLease) rs.resources.release(finishLease.key);
      if (markerKey) rs.resources.release(markerKey);
      if (frontMatKey) rs.resources.release(frontMatKey);
      if (backMatKey) rs.resources.release(backMatKey);
      releaseTexture(rs, faceLease);
      releaseTexture(rs, sleeveLease);
      rs.resources.release('mat:card:edge');
      rs.resources.release('mat:card:blank-front');
      releaseGeometries(rs);
      faceLease = null;
      sleeveLease = null;
    },
    isDisposed: () => disposed,
  };
}

/** Sobe a hierarquia até achar o alvo de picking associado. */
export function pickTargetOf(object: { parent: unknown; userData: Record<string, unknown> } | null): PickTarget | null {
  let o = object as { parent: unknown; userData: Record<string, unknown> } | null;
  while (o) {
    const t = o.userData.pick as PickTarget | undefined;
    if (t) return t;
    o = o.parent as typeof o;
  }
  return null;
}
