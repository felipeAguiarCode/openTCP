// Pokémon em campo: CardVisual do topo, bordas da pilha evolutiva, fichas de Energia (até 4 individuais;
// acima disso agrupadas por tipo), miniatura da Ferramenta e sombra de contato. Transform-base vem da
// âncora; animações aplicam offsets por cima (runtime §15.7, interface §23.9).
import { CircleGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry, type BufferGeometry, type Material } from 'three';
import type { PresentedEntity } from '../../animation/board-model.ts';
import type { RenderSystem } from '../core/render-system.ts';
import { createCardVisual, type CardDescriptor, type CardVisual } from '../card/card-visual.ts';
import { roundedRectGeometry } from '../card/geometry.ts';
import { acquireCanvasTexture, acquireEnergyTexture, releaseTexture, type TextureLease } from '../card/textures.ts';
import { energyOrbsTag } from '../card/energy-orbs.ts';
import { TABLE_Y } from './layout.ts';

export type VisualOffset = { x: number; y: number; z: number; rotY: number; rotZ: number; scale: number; flip: number };

export const ZERO_OFFSET: Readonly<VisualOffset> = { x: 0, y: 0, z: 0, rotY: 0, rotZ: 0, scale: 1, flip: 0 };

/**
 * Hover na mesa (decisão do autor, 15/10/2026): a carta sob o ponteiro sobe em direção à câmera, cresce, inclina de
 * frente para a tela e flutua de leve. Fica separada dos offsets das animações (que continuam valendo por cima).
 */
export const HOVER_LIFT = 0.6;
export const HOVER_SCALE = 0.22;
export const HOVER_TILT = 0.42;

export type EntityVisual = {
  readonly entityId: string;
  readonly group: Group;
  readonly card: CardVisual;
  readonly offset: VisualOffset;
  base: { x: number; z: number; scale: number };
  readonly apply: (entity: PresentedEntity, descriptor: CardDescriptor, toolDescriptor: CardDescriptor | null, hiddenEnergy: ReadonlySet<string>, hideTool: boolean) => void;
  readonly setBase: (x: number, z: number, scale: number) => void;
  readonly updateTransform: () => void;
  /** Elevação de hover já suavizada (0–1) e deslocamento da flutuação, em unidades de mesa. */
  readonly setHover: (k: number, bob: number) => void;
  readonly setDimmed: (dim: boolean) => void;
  /** Carta virada para baixo (preparação: o Básico colocado só desvira na revelação); soma-se ao giro animado. */
  readonly setFaceDown: (on: boolean) => void;
  /** Posição (mundo) da próxima ficha de Energia — destino do arco de ligação. */
  readonly tokenWorld: (index: number) => { x: number; y: number; z: number; size: number };
  readonly toolCard: () => CardVisual | null;
  readonly dispose: () => void;
};

const shadowKey = 'card:contact-shadow';

export function acquireShadowTexture(rs: RenderSystem): TextureLease {
  return acquireCanvasTexture(rs, shadowKey, 128, 160, (ctx, w, h) => {
    ctx.filter = 'blur(9px)';
    ctx.fillStyle = 'rgba(100,125,154,0.55)';
    ctx.beginPath();
    ctx.roundRect(w * 0.16, h * 0.14, w * 0.68, h * 0.72, 10);
    ctx.fill();
  }, false);
}

export function createEntityVisual(rs: RenderSystem, entityId: string, descriptor: CardDescriptor): EntityVisual {
  const group = new Group();
  group.name = `Entity:${entityId}`;
  const card = createCardVisual(rs, descriptor, { faceVisibility: 'FRONT' });
  const cardHolder = new Group();
  cardHolder.add(card.group);
  card.group.rotation.x = -Math.PI / 2;
  group.add(cardHolder);

  const shadowLease = acquireShadowTexture(rs);
  const shadowMat = rs.resources.acquire('mat:card:shadow', () => new MeshBasicMaterial({ map: shadowLease.texture, transparent: true, depthWrite: false, toneMapped: false }));
  const shadowGeo = rs.resources.acquire('geo:card:shadow', () => new PlaneGeometry(1.5, 1.85));
  const shadow = new Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.renderOrder = -1;
  group.add(shadow);

  const underGeo = rs.resources.acquire('geo:card:front', () => roundedRectGeometry(1, 1.4, 0.055, 6));
  const underMat = rs.resources.acquire('mat:card:under', () => new MeshBasicMaterial({ color: '#C9D4E0', toneMapped: false }));
  const under: Mesh[] = [];
  const tokenGeo: BufferGeometry = rs.resources.acquire('geo:token:disc', () => new CircleGeometry(0.5, 28));
  const tokens: { mesh: Mesh; lease: TextureLease; material: Material; key: string }[] = [];
  let tool: CardVisual | null = null;
  let current: PresentedEntity | null = null;
  const offset: VisualOffset = { ...ZERO_OFFSET };
  let base = { x: 0, z: 0, scale: 1 };
  let dimmed = false;
  let disposed = false;

  function clearTokens(): void {
    for (const t of tokens) {
      t.mesh.removeFromParent();
      rs.resources.release(t.key);
      releaseTexture(rs, t.lease);
    }
    tokens.length = 0;
  }

  function buildTokens(energies: readonly { id: string; type: string }[]): void {
    clearTokens();
    const list = energies.length <= 4
      ? energies.map((e) => ({ type: e.type, count: 1 }))
      : Object.entries(energies.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.type]: (acc[e.type] ?? 0) + 1 }), {})).map(([type, count]) => ({ type, count }));
    list.forEach((item) => {
      const lease = acquireEnergyTexture(rs, item.type, { count: item.count });
      const key = `mat:energy:${lease.key}`;
      const material = rs.resources.acquire(key, () => new MeshBasicMaterial({ map: lease.texture, transparent: true, toneMapped: false }));
      const mesh = new Mesh(tokenGeo, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.renderOrder = 4;
      tokens.push({ mesh, lease, material, key });
      cardHolder.add(mesh);
    });
  }

  function relayout(): void {
    // Posições em coordenadas do cardHolder (escala aplicada no holder): normalizar por base.scale.
    const s = 0.24;
    tokens.forEach((t, i) => {
      t.mesh.scale.setScalar(s);
      t.mesh.position.set(-0.5 + s * 0.62 + i * s * 1.02, 0.014, 0.58);
    });
    if (tool) {
      tool.group.scale.setScalar(0.36);
      tool.group.position.set(0.42, 0.016, 0.5);
      tool.group.rotation.set(-Math.PI / 2, 0, -0.14);
    }
    under.forEach((m, i) => m.position.set(-0.035 * (i + 1), -0.004 - 0.002 * i, -0.035 * (i + 1)));
  }

  let hoverK = 0;
  let hoverBob = 0;
  let faceDown = false;
  function updateTransform(): void {
    const flip = Math.max(offset.flip, faceDown ? 1 : 0);
    const up = hoverK * HOVER_LIFT * base.scale + hoverBob;
    group.position.set(base.x + offset.x, TABLE_Y.card + offset.y + up, base.z + offset.z);
    cardHolder.scale.setScalar(base.scale * offset.scale * (1 + HOVER_SCALE * hoverK));
    cardHolder.rotation.set(HOVER_TILT * hoverK, offset.rotY, offset.rotZ);
    card.group.rotation.set(-Math.PI / 2, flip * Math.PI, 0);
    if (flip > 0.001 && flip < 0.999) card.setFaceVisibility('BOTH');
    else card.setFaceVisibility(flip >= 0.999 ? 'BACK' : 'FRONT');
    const lift = Math.max(0, offset.y + up);
    shadow.position.set(0.04 * base.scale, -(TABLE_Y.card + offset.y + up) + 0.003, 0.06 * base.scale + lift * 0.25);
    shadow.scale.setScalar(base.scale * offset.scale * (1 + lift * 0.5));
    (shadow.material as MeshBasicMaterial).opacity = 1;
    shadow.visible = !dimmed;
  }

  return {
    entityId,
    group,
    card,
    offset,
    get base() {
      return base;
    },
    set base(b) {
      base = b;
    },
    apply: (entity, desc, toolDesc, hiddenEnergy, hideTool) => {
      if (disposed) return;
      card.setDescriptor(desc);
      card.setPickTarget({ kind: 'ENTITY', entityId });
      const depth = Math.min(3, Math.max(0, entity.stack.length - 1));
      while (under.length > depth) under.pop()!.removeFromParent();
      while (under.length < depth) {
        const m = new Mesh(underGeo, underMat);
        m.rotation.x = -Math.PI / 2;
        m.renderOrder = -1;
        under.push(m);
        cardHolder.add(m);
      }
      const energies = entity.energies.filter((e) => !hiddenEnergy.has(e.id));
      // A etiqueta das bolas entra na assinatura: fichas feitas com o desenho provisório são refeitas com a arte.
      const sig = (list: readonly { id: string; type: string }[]) => `${energyOrbsTag()}|${list.map((e) => `${e.id}:${e.type}`).join(',')}`;
      if (!current || sig(energies) !== (cardHolder.userData.energySig as string | undefined)) {
        buildTokens(energies);
        cardHolder.userData.energySig = sig(energies);
      }
      if (toolDesc && !hideTool) {
        if (!tool) {
          tool = createCardVisual(rs, toolDesc, { faceVisibility: 'FRONT' });
          tool.setPickTarget({ kind: 'ENTITY', entityId });
          cardHolder.add(tool.group);
        } else tool.setDescriptor(toolDesc);
      } else if (tool) {
        tool.disposeVisual();
        tool = null;
      }
      current = entity;
      card.setOpacity(entity.knockedOut ? 0.55 : dimmed ? 0.4 : 1);
      relayout();
      updateTransform();
    },
    setBase: (x, z, scale) => {
      base = { x, z, scale };
      updateTransform();
    },
    updateTransform,
    setHover: (k, bob) => {
      if (k === hoverK && bob === hoverBob) return;
      hoverK = k;
      hoverBob = bob;
      updateTransform();
    },
    setFaceDown: (on) => {
      if (faceDown === on) return;
      faceDown = on;
      updateTransform();
    },
    setDimmed: (dim) => {
      dimmed = dim;
      card.setOpacity(current?.knockedOut ? 0.55 : dim ? 0.4 : 1);
      updateTransform();
    },
    tokenWorld: (index) => {
      const s = 0.24;
      const lx = (-0.5 + s * 0.62 + index * s * 1.02) * base.scale;
      return { x: base.x + lx, y: TABLE_Y.card + 0.014, z: base.z + 0.58 * base.scale, size: s * base.scale };
    },
    toolCard: () => tool,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      clearTokens();
      tool?.disposeVisual();
      card.disposeVisual();
      group.removeFromParent();
      rs.resources.release('mat:card:shadow');
      rs.resources.release('geo:card:shadow');
      rs.resources.release('geo:card:front');
      rs.resources.release('mat:card:under');
      rs.resources.release('geo:token:disc');
      releaseTexture(rs, shadowLease);
    },
  };
}
