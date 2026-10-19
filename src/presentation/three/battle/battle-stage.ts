// Palco `battle` (runtime §12.4, §14, §15.7–§15.8, §17–§19; interface §23–§26, §36): BoardRoot na
// perspectiva do perfil, mão ortográfica, CardTransitScene, cut-in, moeda e diretor de apresentação.
// A cena só apresenta projeções confirmadas: nunca chama regras nem decide resultados.
import {
  Euler, Group, InstancedMesh, Matrix4, MeshBasicMaterial, OrthographicCamera, PerspectiveCamera, Quaternion, Raycaster, Scene, Vector2, Vector3, type Material,
} from 'three';
import type { BattleEvent, PlayerId } from '../../../domain/battle/types.ts';
import type { BattleView } from '../../../domain/battle/views.ts';
import type { CardFaceData } from '../../../domain/cards/text.ts';
import type { CardDefinition } from '../../../domain/cards/types.ts';
import { projectBoard, type PresentedBoard, type PresentedCard, type SideRole } from '../../animation/board-model.ts';
import { createPresentationClock } from '../../animation/clock.ts';
import { createDirector, type DirectorHandlers } from '../../animation/director.ts';
import { createFlairRegistry } from '../../animation/flair.ts';
import { uiPresetDurationMs } from '../../animation/catalog.ts';
import { EASINGS, clamp, lerp } from '../../animation/easing.ts';
import { planPresentation, type CardTraits, type PresentationPlan } from '../../animation/plan.ts';
import type { SpeedMode } from '../../animation/timing.ts';
import type { RenderSystem, ViewportHandle } from '../core/render-system.ts';
import { QUALITY_PROFILES } from '../core/quality.ts';
import { mapRect, rectContains, type CssRect } from '../core/viewport.ts';
import { createCardVisual, markerMaterial, pickTargetOf, PICK_LAYER, type CardDescriptor, type CardVisual, type MarkerState, type PickTarget } from '../card/card-visual.ts';
import { roundedRectGeometry } from '../card/geometry.ts';
import { DEFAULT_SLEEVE, type SleeveStyle } from '../card/face-canvas.ts';
import { FINISH_GLOBALS } from '../card/finish-material.ts';
import { loadCardFonts } from '../card/fonts.ts';
import { acquireSleeveTexture, releaseTexture, sleeveKey as sleeveTextureKey } from '../card/textures.ts';
import { onCardBackReady } from '../card/card-back.ts';
import { loadSleeveArt, onSleeveArtReady } from '../card/sleeve-art.ts';
import { onEnergyOrbsReady } from '../card/energy-orbs.ts';
import { createBoardRoot, type BoardRoot, type SlotHighlight } from './board-root.ts';
import { createCoinVisual, createDropZone, type CoinVisual } from './effects.ts';
import { coinArtImages, coinOwner, loadCoinArt } from './coin-art.ts';
import { createEntityVisual, type EntityVisual, HOVER_LIFT, HOVER_SCALE } from './entity-visual.ts';
import { createStepRuntime, type BattleCue, type CssPose, type StageApi, type StepRuntime, type WorldPose } from './executors.ts';
import { createEnergyOrbSprite, createEnergyPlate } from './energy-plate.ts';
import { handCardAt, handFanLayout, handFocusPose, type HandSlot } from './hand-layout.ts';
import {
  ANCHOR_IDS, PROFILES, SLOT_ANCHOR_IDS, TABLE_Y, computeAnchors, fitBounds, frameRegion, npcFanCenters, projectToRect, projectedCardRect, pxPerUnitAt,
  tableGeometryWorld, tableRect,
  region, selectFrame, tightenDepth, unprojectToPlane, type AnchorId, type AnchorWorld, type BattleProfile, type LayoutFrame, type LayoutProfileId,
} from './layout.ts';
import { DEFAULT_PRESENTATION, resolveDisplayedPlaymat, sleeveStyleOf, type BattlePresentationInput } from './playmat.ts';
import type { MatImageStatus } from './mat-image.ts';

export type ResolvedCard = { readonly face: CardFaceData; readonly definition?: CardDefinition | null };

export type BattleStageOptions = {
  /** Resolve a identidade pública de uma carta (catálogo). Nunca é chamado para cartas ocultas. */
  readonly resolveCard: (ref: { readonly printingId: string; readonly definitionKey: string }) => ResolvedCard | null;
  readonly attemptId?: string;
  readonly layoutProfile?: LayoutProfileId | 'auto';
  /** Frame 16:9 do conteúdo no canvas (CSS); nulo = letterbox automático (scalingRules). */
  readonly frame?: CssRect | null;
  readonly speed?: SpeedMode;
  readonly reducedMotion?: boolean;
  readonly presentation?: BattlePresentationInput;
};

export type PresentBatch = {
  readonly events: readonly BattleEvent[];
  readonly before: BattleView;
  readonly after: BattleView;
  /** Tentativa nova: BOARD_INTRO antes da distribuição (não repetir na retomada). */
  readonly newAttempt?: boolean;
  readonly batchId?: string;
};

/**
 * Ids realçados: entityId, cardId da mão, ids de âncora (`HUMAN_BENCH_0`, `HUMAN_ENERGY_READY`…). Aceita
 * arrays ou Sets — o `Highlights` da mesa 2D (ReadonlySet) é atribuível diretamente.
 */
export type Highlights = {
  readonly selectable: Iterable<string>; readonly selected: Iterable<string>; readonly targets: Iterable<string>;
  /** Cartas da mão que podem evoluir um Pokémon agora: contorno amarelo no lugar do ciano (gameplay-pocket §6). */
  readonly evolvable?: Iterable<string>;
  /**
   * Pokémon em campo que flutuam e podem ser arrastados (promoção depois do nocaute, gameplay-pocket §6.2): erguidos e
   * balançando devagar; soltos sobre o Ativo vazio, viram `onEntityDrop`.
   */
  readonly floating?: Iterable<string>;
};
export type DragIntent = { readonly cardId: string; readonly target: PickTarget };
/** Soltura fora de um alvo realçado: a carta treme, volta à mão e a UI explica o motivo. */
export type DragDenied = { readonly cardId: string; readonly target: PickTarget | null };
/** Arrasto livre do orbe da Zona de Energia: começou, soltou sobre um alvo realçado ou foi cancelado (voltou ao prato). */
export type EnergyDragEvent = { readonly phase: 'START' } | { readonly phase: 'DROP'; readonly entityId: string } | { readonly phase: 'CANCEL' };
/** Pokémon flutuante arrastado e solto sobre o espaço do Ativo (a UI responde a decisão de promoção). */
export type EntityDrop = { readonly entityId: string; readonly anchorId: 'HUMAN_ACTIVE' };
/**
 * Alvo genérico do campo: com `PLAY_AREA` entre os realces, a carta é um Treinador sem alvo (Item, Apoiador, Estádio).
 * Durante o arrasto, a zona verde translúcida da região `trainerZone` cobre o centro da mesa (gameplay-pocket §6):
 * soltar dentro dela joga; soltar fora devolve a carta à mão sem aviso.
 */
export const PLAY_AREA = 'PLAY_AREA';
const PLAY_AREA_TARGET: PickTarget = { kind: 'SLOT', anchorId: PLAY_AREA };
const DENY_MS = 280;
export type AnchorRect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

export type BattleStageDiagnostics = {
  readonly profileId: LayoutProfileId;
  readonly frame: LayoutFrame;
  readonly entities: number;
  readonly handCards: number;
  readonly liveProxies: number;
  readonly hiddenKeys: readonly string[];
  readonly presenting: boolean;
  readonly activeSteps: readonly string[];
  readonly elapsedMs: number;
  readonly lastPlan: { readonly steps: number; readonly totalMs: number; readonly barrier: string } | null;
  readonly fit: ReturnType<typeof fitBounds>['report'];
};

export type BattleStage = {
  readonly setLayoutProfile: (id: LayoutProfileId | 'auto') => void;
  readonly setFrame: (frame: CssRect | null) => void;
  readonly setView: (view: BattleView, presentation?: BattlePresentationInput) => void;
  readonly present: (batch: PresentBatch) => Promise<void>;
  readonly skipToBarrier: () => void;
  readonly setSpeed: (speed: SpeedMode) => void;
  readonly setReducedMotion: (on: boolean) => void;
  readonly pause: () => void;
  readonly resume: () => void;
  readonly onPick: (cb: (target: PickTarget) => void) => () => void;
  /** Troca a entrada visual (cosméticos, imagem local do tapete) sem reiniciar a mesa; aplica já o tapete exibido. */
  readonly setPresentation: (presentation: BattlePresentationInput) => void;
  /** Estado da imagem local do tapete exibido: none/loading/loaded/missing (UI-113 → aviso HTML). */
  readonly matImageStatus: () => MatImageStatus;
  readonly onMatImageStatus: (cb: (status: MatImageStatus) => void) => () => void;
  /** Botão secundário sobre carta/entidade/pilha: pedido de inspeção (não é jogada). */
  readonly onInspect: (cb: (target: PickTarget) => void) => () => void;
  /** Bloqueia cliques/arrasto enquanto a UI espera um commit (hover e inspeção continuam). */
  readonly setLocked: (locked: boolean) => void;
  /** Foco de teclado numa carta da mão (botões semânticos HTML): a carta sobe como no hover. */
  readonly setKeyboardFocus: (cardId: string | null) => void;
  readonly onHover: (cb: (target: PickTarget | null) => void) => () => void;
  readonly onDragIntent: (cb: (intent: DragIntent) => void) => () => void;
  /** Arrasto de uma carta da mão começou (passou do limiar): a UI realça os alvos legais dela. */
  readonly onDragStart: (cb: (cardId: string) => void) => () => void;
  /** Arrasto terminou (jogada apresentada, cancelada ou carta de volta à mão). */
  readonly onDragEnd: (cb: () => void) => () => void;
  readonly onDragDenied: (cb: (denied: DragDenied) => void) => () => void;
  readonly cancelDrag: () => void;
  /** Arrasto do orbe da Energia pronta (gameplay-pocket §6): a UI arma o alvo pendente, liga ou cancela. */
  readonly onEnergyDrag: (cb: (e: EnergyDragEvent) => void) => () => void;
  /** Pokémon flutuante (realce `floating`) solto sobre o Ativo vazio. */
  readonly onEntityDrop: (cb: (d: EntityDrop) => void) => () => void;
  readonly onCue: (cb: (cue: BattleCue) => void) => () => void;
  readonly onPresentedChange: (cb: (board: PresentedBoard) => void) => () => void;
  readonly onAnchorsChanged: (cb: () => void) => () => void;
  readonly setHighlights: (h: Highlights) => void;
  /** Pokémon em campo virados para baixo (preparação na mesa): só desviram quando a revelação os substitui. */
  readonly setFaceDown: (ids: Iterable<string>) => void;
  readonly getAnchorRects: () => Record<string, AnchorRect>;
  /**
   * Retângulos CSS de cartas em primeiro plano (CardTransitScene: destaque do ataque, proxies em trânsito,
   * arrasto, carta da mão em foco). O HUD HTML esconde/atenua rótulos que caem sob eles.
   */
  readonly getOverlayRects: () => AnchorRect[];
  readonly getRegions: () => Record<string, CssRect>;
  readonly getPresentedBoard: () => PresentedBoard | null;
  readonly getLayout: () => LayoutFrame;
  readonly isPresenting: () => boolean;
  readonly setActive: (active: boolean) => void;
  readonly diagnostics: () => BattleStageDiagnostics;
  readonly dispose: () => void;
};

type Pose2 = { x: number; y: number; rotation: number; width: number };
type HandCard = { key: string; card: CardVisual; cur: Pose2; target: Pose2; focusT: number; slot: HandSlot; inTransit: boolean; cardId: string | null };

const other = (p: PlayerId): PlayerId => (p === 'A' ? 'B' : 'A');
const DRAG_THRESHOLD_PX = 6;

export function createBattleStage(rs: RenderSystem, options: BattleStageOptions): BattleStage {
  void loadCardFonts();
  const attemptId = options.attemptId ?? 'attempt-local';
  let speed: SpeedMode = options.speed ?? 'NORMAL';
  let reduced = options.reducedMotion ?? false;
  let profileSel: LayoutProfileId | 'auto' = options.layoutProfile ?? 'auto';
  let customFrame: CssRect | null = options.frame ?? null;
  let presentation: BattlePresentationInput = options.presentation ?? DEFAULT_PRESENTATION;
  let active = true;
  let locked = false;
  let disposed = false;

  // ------------------------------------------------------------------------------------- layout
  let frame: LayoutFrame = selectFrame(1920, 1080, 'desktop1080');
  let profile: BattleProfile = PROFILES.desktop1080;
  let fit = fitBounds(profile);
  let designCamera: PerspectiveCamera = fit.camera;
  let anchors: Readonly<Record<AnchorId, AnchorWorld>> = computeAnchors({ ...profile, worldSeeds: fit.seeds }, designCamera);
  let camera: PerspectiveCamera = designCamera.clone();
  let renderCamera: PerspectiveCamera = camera;
  let tableBuilt = false;
  let boardRect: CssRect = region(profile, 'board');
  let handRect: CssRect = region(profile, 'hand');
  let zoneRect: CssRect = region(profile, 'trainerZone');

  const boardScene = new Scene();
  boardScene.name = 'battle';
  const handScene = new Scene();
  handScene.name = 'hand';
  const handCamera = new OrthographicCamera(-1, 1, 1, -1, -2000, 2000);
  handCamera.position.z = 1000;
  const transitScene = new Scene();
  transitScene.name = 'card-transit';
  const transitCamera = new OrthographicCamera(0, 1, 0, -1, -4000, 4000);
  transitCamera.position.z = 2000;
  const transitRoot = new Group();
  transitRoot.name = 'CardTransitScene';
  transitScene.add(transitRoot);
  /** Zona verde de soltura do Treinador sem alvo (gameplay-pocket §6), na camada de trânsito por baixo da carta arrastada. */
  const dropZone = createDropZone();
  dropZone.group.name = 'TrainerDropZone';
  transitRoot.add(dropZone.group);

  const sleeveFor = (player: PlayerId, viewer: PlayerId): SleeveStyle =>
    sleeveStyleOf(player === viewer ? presentation.playerCosmetics.sleeve : presentation.opponentCosmetics.sleeve) ?? DEFAULT_SLEEVE;

  let view: BattleView | null = null;
  let sceneBoard: PresentedBoard | null = null;
  let hudBoard: PresentedBoard | null = null;
  const initialPlaymat = resolveDisplayedPlaymat({ viewer: 'A', currentPlayer: 'A' }, presentation);
  const matImageListeners = new Set<(status: MatImageStatus) => void>();
  const board: BoardRoot = createBoardRoot(rs, anchors, initialPlaymat, (status) => {
    for (const cb of matImageListeners) cb(status);
  });
  boardScene.add(board.root);

  const boardVp: ViewportHandle = rs.registerViewport({ id: 'battle', scene: boardScene, camera, rect: boardRect, order: 0 });
  const handVp: ViewportHandle = rs.registerViewport({ id: 'hand', scene: handScene, camera: handCamera, rect: handRect, order: 10 });
  const transitVp: ViewportHandle = rs.registerViewport({ id: 'card-transit', scene: transitScene, camera: transitCamera, rect: { x: 0, y: 0, width: 1, height: 1 }, order: 100, active: false });

  const listeners = {
    pick: new Set<(t: PickTarget) => void>(),
    inspect: new Set<(t: PickTarget) => void>(),
    hover: new Set<(t: PickTarget | null) => void>(),
    drag: new Set<(i: DragIntent) => void>(),
    dragStart: new Set<(cardId: string) => void>(),
    dragEnd: new Set<() => void>(),
    deny: new Set<(d: DragDenied) => void>(),
    energy: new Set<(e: EnergyDragEvent) => void>(),
    entityDrop: new Set<(d: EntityDrop) => void>(),
    cue: new Set<(c: BattleCue) => void>(),
    presented: new Set<(b: PresentedBoard) => void>(),
    anchors: new Set<() => void>(),
  };
  const subscribe = <T>(set: Set<T>, cb: T) => {
    set.add(cb);
    return () => {
      set.delete(cb);
    };
  };

  // --------------------------------------------------------------------------- estado da cena
  const entities = new Map<string, EntityVisual>();
  const handCards = new Map<string, HandCard>();
  const resolvingVisuals = new Map<string, CardVisual>();
  const hidden = new Map<string, number>();
  const proxies = new Set<CardVisual>();
  const faceCache = new Map<string, ResolvedCard | null>();
  let stadiumVisual: CardVisual | null = null;
  const piles: Record<SideRole, { deck: CardVisual | null; discard: CardVisual | null }> = { HUMAN: { deck: null, discard: null }, NPC: { deck: null, discard: null } };
  /** Prato da Zona de Energia por lado (criado na primeira sincronização) e o que ele mostra agora. */
  const plates: Partial<Record<SideRole, ReturnType<typeof createEnergyPlate>>> = {};
  const zoneState: Record<SideRole, { ready: string | null; next: string | null }> = { HUMAN: { ready: null, next: null }, NPC: { ready: null, next: null } };
  /**
   * Arrasto livre do orbe da Energia pronta: segue o ponteiro na camada de trânsito; `over` é o Pokémon realçado sob ele
   * (cresce de leve); depois de soltar num alvo, o orbe espera no ponto da soltura até o passo de Energia levá-lo.
   */
  type EnergyDrag = {
    start: { x: number; y: number }; pos: { x: number; y: number }; started: boolean; over: string | null;
    returning: { t: number; from: { x: number; y: number } } | null; pendingSince: number | null; sprite: ReturnType<typeof createEnergyOrbSprite> | null;
  };
  let energyDrag: EnergyDrag | null = null;
  let faceDownIds: ReadonlySet<string> = new Set();
  /**
   * Arrasto de um Pokémon flutuante (promoção): o próprio EntityVisual segue o ponteiro pelo `offset` (Energias e
   * Ferramenta vão junto); solto no Ativo, fica ali até o passo PROMOTE partir desse ponto; fora dele, volta ao Banco.
   */
  type EntityDrag = {
    entityId: string; start: { x: number; y: number }; started: boolean; over: boolean; pendingSince: number | null;
    returning: { t: number; from: { x: number; y: number; z: number; scale: number } } | null;
  };
  let entityDrag: EntityDrag | null = null;
  let fan: { mesh: InstancedMesh; sleeveKey: string; material: Material; lease: ReturnType<typeof acquireSleeveTexture> } | null = null;
  // Uma moeda por lado: quem lança usa a moeda equipada no próprio deck (a do jogador também decide quem começa).
  const coins: { MINE: CoinVisual | null; THEIRS: CoinVisual | null } = { MINE: null, THEIRS: null };
  for (const c of [presentation.playerCosmetics.coin, presentation.opponentCosmetics.coin]) void loadCoinArt(c?.visual.assetKey);
  let highlights = { selectable: new Set<string>(), selected: new Set<string>(), targets: new Set<string>(), evolvable: new Set<string>(), floating: new Set<string>() };
  let focusKey: string | null = null;
  let keyboardFocus: string | null = null;
  let anchorsDirty = true;

  const director = createDirector();
  const clock = createPresentationClock();
  const flair = createFlairRegistry();
  const runtimes = new Map<string, StepRuntime>();
  let presenting = false;
  let queue: Promise<void> = Promise.resolve();
  let queueGen = 0;
  let lastPlan: PresentationPlan | null = null;

  const isHidden = (key: string) => (hidden.get(key) ?? 0) > 0;
  const hiddenCount = (key: string) => hidden.get(key) ?? 0;

  function resolve(card: PresentedCard): ResolvedCard | null {
    const key = `${card.printingId}|${card.definitionKey}`;
    if (!faceCache.has(key)) {
      let r: ResolvedCard | null = null;
      try {
        r = options.resolveCard({ printingId: card.printingId, definitionKey: card.definitionKey });
      } catch {
        r = null;
      }
      faceCache.set(key, r);
    }
    return faceCache.get(key) ?? null;
  }

  function descriptorFor(card: PresentedCard | null, owner: PlayerId, opaqueId: string): CardDescriptor {
    const viewer = sceneBoard?.viewer ?? view?.viewer ?? 'A';
    const sleeve = sleeveFor(owner, viewer);
    const face = card ? resolve(card)?.face ?? null : null;
    return face ? { kind: 'FACE', face, sleeve } : { kind: 'HIDDEN', opaqueId, sleeve };
  }

  function traitsOf(card: PresentedCard): CardTraits | null {
    const r = resolve(card);
    if (!r) return null;
    const def = r.definition ?? null;
    const attackBlocks: Record<string, number> = {};
    const attackPresets: Record<string, string> = {};
    for (const a of def?.attacks ?? []) {
      attackBlocks[a.id] = a.effects.length;
      if (a.presentation?.presetId) attackPresets[a.id] = a.presentation.presetId;
    }
    return {
      category: r.face.category, finish: r.face.finish, ruleBox: r.face.ruleBox, types: r.face.types, name: r.face.name,
      subtype: def && def.category === 'TRAINER' ? def.subtype : null, attackBlocks, attackPresets,
    };
  }

  // ----------------------------------------------------------------------------- projeções
  function worldToCssPoint(x: number, y: number, z: number): { x: number; y: number } {
    const p = projectToRect(camera, new Vector3(x, y, z), boardRect);
    return { x: p.x, y: p.y };
  }

  function worldToCss(pose: WorldPose): CssPose {
    const c = worldToCssPoint(pose.x, pose.y, pose.z);
    return { x: c.x, y: c.y, width: pose.scale * pxPerUnitAt(camera, pose.x, pose.z, boardRect, pose.y), rotation: -(pose.rotZ ?? 0), flip: pose.flip ?? 0 };
  }

  function anchorPose(id: string): WorldPose | null {
    const a = anchors[id as AnchorId];
    if (!a) return null;
    return { x: a.x, y: TABLE_Y.card, z: a.z, scale: a.scale };
  }

  function designToWorld(sx: number, sy: number): Vector3 {
    return unprojectToPlane(designCamera, sx, sy, region(profile, 'board'), TABLE_Y.card) ?? new Vector3();
  }

  function npcFanWorld(index: number, count: number): WorldPose {
    const fanCenters = npcFanCenters(profile, Math.max(count, index + 1));
    const c = fanCenters.centers[Math.min(index, fanCenters.centers.length - 1)] ?? fanCenters.entry;
    const w = designToWorld(c.x, c.y);
    const n = Math.max(1, count);
    const t = n === 1 ? 0 : index / (n - 1) - 0.5;
    return { x: w.x, y: TABLE_Y.card + index * 0.004, z: w.z, scale: anchors.NPC_HAND.scale, rotZ: -t * 0.35 };
  }

  function resolutionWorld(role: SideRole, index: number): WorldPose {
    const s = anchors.HUMAN_ACTIVE.scale * 0.9;
    return { x: -3.4 + index * 0.45, y: 0.5 + index * 0.02, z: role === 'HUMAN' ? 0.45 : 0.1, scale: s };
  }

  function handPolicy() {
    return profile.handPolicy;
  }

  /** Leque da mão no viewport atual (px CSS): tamanhos e sangria escalam com o frame. */
  function handSlots(count: number): HandSlot[] {
    return handFanLayout(count, handRect, profile.handPolicy, { cardScale: frame.scale });
  }

  function handLocalToCss(x: number, y: number): { x: number; y: number } {
    return { x: handRect.x + handRect.width / 2 + x, y: handRect.y + handRect.height / 2 - y };
  }

  function handTargetCss(key: string, b: PresentedBoard): CssPose | null {
    const side = b.sides[b.viewer];
    const index = side.hand.findIndex((h) => h.key === key);
    if (index < 0) return null;
    const slots = handSlots(side.hand.length);
    const slot = slots[index]!;
    const c = handLocalToCss(slot.x, slot.y);
    return { x: c.x, y: c.y, width: slot.width, rotation: slot.rotation, flip: 0 };
  }

  function handPoseCss(key: string): CssPose | null {
    const h = handCards.get(key);
    if (!h) return null;
    const pose = displayPose(h);
    const c = handLocalToCss(pose.x, pose.y);
    return { x: c.x, y: c.y, width: pose.width, rotation: pose.rotation, flip: 0 };
  }

  function displayPose(h: HandCard): Pose2 {
    if (h.focusT <= 0.001) return h.cur;
    const f = handFocusPose({ ...h.slot, x: h.cur.x }, handPolicy(), handRect.height, frame.scale);
    const k = EASINGS.easeOutCubic(h.focusT);
    return { x: lerp(h.cur.x, f.x, k), y: lerp(h.cur.y, f.y, k), rotation: lerp(h.cur.rotation, 0, k), width: lerp(h.cur.width, h.cur.width * f.scale, k) };
  }

  // ---------------------------------------------------------------------------- sincronização
  function placeFlat(card: CardVisual, pose: WorldPose, thicknessFactor = 1): void {
    card.group.position.set(pose.x, pose.y, pose.z);
    card.group.rotation.set(-Math.PI / 2, (pose.flip ?? 0) * Math.PI, pose.rotZ ?? 0);
    card.group.scale.set(pose.scale, pose.scale, pose.scale * thicknessFactor);
  }

  function syncPile(role: SideRole, kind: 'deck' | 'discard', count: number, top: PresentedCard | null, owner: PlayerId): void {
    const anchorId = role === 'HUMAN' ? (kind === 'deck' ? 'HUMAN_DECK_TOP' : 'HUMAN_DISCARD') : kind === 'deck' ? 'NPC_DECK_TOP' : 'NPC_DISCARD';
    const a = anchors[anchorId];
    let v = piles[role][kind];
    if (count <= 0) {
      if (v) v.group.visible = false;
      return;
    }
    const desc = kind === 'deck' ? descriptorFor(null, owner, `${anchorId}`) : descriptorFor(top, owner, `${anchorId}`);
    if (!v) {
      v = createCardVisual(rs, desc, { faceVisibility: kind === 'deck' ? 'BACK' : 'FRONT' });
      v.setPickTarget({ kind: 'PILE', anchorId });
      board.pilesRoot.add(v.group);
      piles[role][kind] = v;
    } else v.setDescriptor(desc);
    v.setFaceVisibility(kind === 'deck' || desc.kind === 'HIDDEN' ? 'BACK' : 'FRONT');
    v.group.visible = true;
    const factor = Math.max(1, Math.min(20, count) * 0.75);
    const thickness = 0.006 * a.scale * factor;
    placeFlat(v, { x: a.x, y: 0.004 + thickness, z: a.z, scale: a.scale, flip: kind === 'deck' || desc.kind === 'HIDDEN' ? 1 : 0, rotZ: kind === 'discard' ? 0.05 : 0 }, factor);
  }

  function syncZone(role: SideRole, ready: string | null, next: string | null): void {
    zoneState[role] = { ready, next };
    const plate = (plates[role] ??= createEnergyPlate(rs, board.energyRoot));
    const a = anchors[`${role}_ENERGY_READY` as AnchorId];
    // O orbe sai do prato enquanto um passo o leva ou enquanto é arrastado.
    const hide = isHidden(`zone:${role}_READY`) || (role === 'HUMAN' && !!energyDrag?.started);
    plate.set({ x: a.x, z: a.z, scale: a.scale, side: role }, ready, next, hide ? 0 : 1);
  }

  function readyCss(): CssPose {
    const a = anchors.HUMAN_ENERGY_READY;
    return worldToCss({ x: a.x, y: 0.02, z: a.z, scale: a.scale });
  }

  function endEnergyDrag(cancelled: boolean): void {
    const e = energyDrag;
    if (!e) return;
    e.sprite?.dispose();
    energyDrag = null;
    syncZone('HUMAN', zoneState.HUMAN.ready, zoneState.HUMAN.next);
    if (cancelled && e.started) for (const cb of listeners.energy) cb({ phase: 'CANCEL' });
    rs.requestRender();
  }

  /** Encerra o arrasto de entidade; `resetOffset` devolve a carta ao lugar na hora (sem o retorno animado). */
  function endEntityDrag(resetOffset: boolean): void {
    const e = entityDrag;
    if (!e) return;
    entityDrag = null;
    const v = entities.get(e.entityId);
    if (v && resetOffset) {
      Object.assign(v.offset, { x: 0, y: 0, z: 0, scale: 1 });
      v.updateTransform();
    }
    anchorsDirty = true;
    rs.requestRender();
  }

  /** Ponteiro sobre o espaço do Ativo do jogador (retângulo projetado: a carta arrastada tapa o plano do slot). */
  function overHumanActive(x: number, y: number): boolean {
    const a = anchors.HUMAN_ACTIVE;
    const r = projectedCardRect(camera, new Vector3(a.x, TABLE_Y.card, a.z), a.scale, boardRect);
    const pad = r.width * 0.25;
    return x >= r.x - pad && x <= r.x + r.width + pad && y >= r.y - pad && y <= r.y + r.height + pad;
  }

  function syncFan(count: number, owner: PlayerId, viewer: PlayerId): void {
    const visibleCount = Math.max(0, count - hiddenCount('npcfan:NPC'));
    const sleeve = sleeveFor(owner, viewer);
    const sleeveKey = sleeveTextureKey(sleeve);
    if (!fan || fan.sleeveKey !== sleeveKey) {
      if (fan) {
        fan.mesh.removeFromParent();
        fan.mesh.dispose();
        fan.material.dispose();
        releaseTexture(rs, fan.lease);
        rs.resources.release('geo:card:front');
      }
      const lease = acquireSleeveTexture(rs, sleeve);
      const geometry = rs.resources.acquire('geo:card:front', () => roundedRectGeometry(1, 1.4, 0.055, 6));
      const material = new MeshBasicMaterial({ map: lease.texture, toneMapped: false });
      const mesh = new InstancedMesh(geometry, material, 12);
      mesh.name = 'NpcHandFan';
      mesh.frustumCulled = false;
      board.cardsRoot.add(mesh);
      fan = { mesh, sleeveKey, material, lease };
    }
    const m = new Matrix4();
    const q = new Quaternion();
    const s = new Vector3();
    const p = new Vector3();
    const shown = Math.min(12, visibleCount);
    for (let i = 0; i < shown; i += 1) {
      const pose = npcFanWorld(i, count);
      q.setFromEuler(new Euler(-Math.PI / 2, 0, pose.rotZ ?? 0));
      p.set(pose.x, pose.y, pose.z);
      s.setScalar(pose.scale);
      m.compose(p, q, s);
      fan.mesh.setMatrixAt(i, m);
    }
    fan.mesh.count = shown;
    fan.mesh.instanceMatrix.needsUpdate = true;
  }

  function syncHand(b: PresentedBoard): void {
    const side = b.sides[b.viewer];
    const slots = handSlots(side.hand.length);
    const seen = new Set<string>();
    side.hand.forEach((h, i) => {
      seen.add(h.key);
      const slot = slots[i]!;
      const target: Pose2 = { x: slot.x, y: slot.y, rotation: slot.rotation, width: slot.width };
      let hc = handCards.get(h.key);
      const desc = descriptorFor(h.card, side.player, h.key);
      if (!hc) {
        const card = createCardVisual(rs, desc, { faceVisibility: 'FRONT' });
        hc = { key: h.key, card, cur: { ...target }, target, focusT: 0, slot, inTransit: false, cardId: h.card?.cardId ?? null };
        handScene.add(card.group);
        handCards.set(h.key, hc);
      } else hc.card.setDescriptor(desc);
      hc.target = target;
      hc.slot = slot;
      hc.cardId = h.card?.cardId ?? null;
      hc.card.setPickTarget(h.card ? { kind: 'HAND_CARD', cardId: h.card.cardId } : null);
      hc.card.group.visible = !isHidden(`hand:${h.key}`) && dragState?.key !== h.key;
      if (isHidden(`hand:${h.key}`)) hc.cur = { ...target };
    });
    for (const [key, hc] of handCards) {
      if (seen.has(key)) continue;
      hc.card.disposeVisual();
      handCards.delete(key);
      if (focusKey === key) focusKey = null;
    }
  }

  function syncBoard(b: PresentedBoard, force = false): void {
    if (disposed) return;
    if (!force && sceneBoard && b.lastSeq < sceneBoard.lastSeq) return;
    sceneBoard = b;
    const viewer = b.viewer;
    const hiddenEnergy = new Set<string>();
    for (const [k, n] of hidden) if (n > 0 && k.startsWith('energy:')) hiddenEnergy.add(k.slice(7));
    const seen = new Set<string>();
    for (const player of ['A', 'B'] as const) {
      const side = b.sides[player];
      for (const e of [side.active, ...side.bench]) {
        if (!e) continue;
        seen.add(e.entityId);
        const desc = descriptorFor(e.top, e.owner, e.entityId);
        let v = entities.get(e.entityId);
        if (!v) {
          v = createEntityVisual(rs, e.entityId, desc);
          board.cardsRoot.add(v.group);
          entities.set(e.entityId, v);
        }
        const a = anchors[`${side.role}_${e.slot}` as AnchorId];
        v.base = { x: a.x, z: a.z, scale: a.scale };
        v.apply(e, desc, e.tool ? descriptorFor(e.tool, e.owner, e.tool.cardId) : null, hiddenEnergy, isHidden(`tool:${e.entityId}`));
        v.group.visible = !isHidden(`entity:${e.entityId}`);
        v.setFaceDown(faceDownIds.has(e.entityId));
      }
      const role = side.role;
      syncPile(role, 'deck', side.deckCount, null, player);
      const hiddenTop = hiddenCount(`discard:${role}`);
      const visibleDiscard = side.discard.slice(0, Math.max(0, side.discard.length - hiddenTop));
      syncPile(role, 'discard', visibleDiscard.length, visibleDiscard[visibleDiscard.length - 1] ?? null, player);
      syncZone(role, side.energyReady, side.energyNext);
      const keepResolving = new Set<string>();
      side.resolving.forEach((r, i) => {
        keepResolving.add(r.cardId);
        let rv = resolvingVisuals.get(r.cardId);
        const desc = descriptorFor(r, player, r.cardId);
        if (!rv) {
          rv = createCardVisual(rs, desc, { faceVisibility: 'FRONT' });
          board.effectsRoot.add(rv.group);
          resolvingVisuals.set(r.cardId, rv);
        }
        placeFlat(rv, resolutionWorld(role, i));
        rv.group.visible = !isHidden(`resolving:${r.cardId}`);
      });
      for (const [id, rv] of resolvingVisuals) {
        const owner = b.sides.A.resolving.some((r) => r.cardId === id) || b.sides.B.resolving.some((r) => r.cardId === id);
        if (!owner && !keepResolving.has(id)) {
          rv.disposeVisual();
          resolvingVisuals.delete(id);
        }
      }
    }
    for (const [id, v] of entities) {
      if (seen.has(id)) continue;
      v.dispose();
      entities.delete(id);
    }
    syncHand(b);
    syncFan(b.sides[other(viewer)].hand.length, other(viewer), viewer);
    if (b.stadium) {
      const desc = descriptorFor(b.stadium, b.stadium.owner, 'stadium');
      if (!stadiumVisual) {
        stadiumVisual = createCardVisual(rs, desc, { faceVisibility: 'FRONT' });
        stadiumVisual.setPickTarget({ kind: 'PILE', anchorId: 'STADIUM' });
        board.pilesRoot.add(stadiumVisual.group);
      } else stadiumVisual.setDescriptor(desc);
      const a = anchors.STADIUM;
      placeFlat(stadiumVisual, { x: a.x, y: TABLE_Y.card, z: a.z, scale: a.scale });
      stadiumVisual.group.visible = !isHidden('stadium');
    } else if (stadiumVisual) {
      stadiumVisual.disposeVisual();
      stadiumVisual = null;
    }
    applyHighlights();
    anchorsDirty = true;
    boardVp.markDirty();
    handVp.markDirty();
    rs.requestRender();
  }

  function setHud(b: PresentedBoard, force = false): void {
    if (!force && hudBoard && b.lastSeq < hudBoard.lastSeq) return;
    hudBoard = b;
    for (const cb of listeners.presented) cb(b);
  }

  // ------------------------------------------------------------------------------- destaque
  function markerFor(id: string | null | undefined): MarkerState {
    if (!id) return 'NONE';
    if (highlights.selected.has(id)) return 'SELECTED';
    if (highlights.targets.has(id)) return 'TARGET';
    if (highlights.selectable.has(id)) return highlights.evolvable.has(id) ? 'EVOLVE' : 'SELECTABLE';
    return 'NONE';
  }

  function applyHighlights(): void {
    for (const [id, v] of entities) v.card.setMarker(markerFor(id));
    for (const hc of handCards.values()) hc.card.setMarker(markerFor(hc.cardId));
    for (const id of [...SLOT_ANCHOR_IDS, 'HUMAN_DECK_TOP', 'HUMAN_DISCARD', 'NPC_DECK_TOP', 'NPC_DISCARD', 'STADIUM']) {
      const m = markerFor(id);
      const occupied = SLOT_ANCHOR_IDS.includes(id as never) && sceneBoard ? slotOccupied(id) : false;
      board.setSlotHighlight(id, occupied ? 'NONE' : (m === 'NONE' ? 'NONE' : m) as SlotHighlight);
    }
  }

  function slotOccupied(anchorId: string): boolean {
    if (!sceneBoard) return false;
    for (const side of Object.values(sceneBoard.sides)) {
      for (const e of [side.active, ...side.bench]) if (e && `${side.role}_${e.slot}` === anchorId) return true;
    }
    return false;
  }

  // --------------------------------------------------------------------------------- proxies
  function transitProxy(descriptor: CardDescriptor): CardVisual {
    const p = createCardVisual(rs, descriptor, { faceVisibility: 'BOTH' });
    transitRoot.add(p.group);
    proxies.add(p);
    return p;
  }

  function boardProxy(descriptor: CardDescriptor): CardVisual {
    const p = createCardVisual(rs, descriptor, { faceVisibility: 'BOTH' });
    board.effectsRoot.add(p.group);
    proxies.add(p);
    return p;
  }

  function releaseProxy(p: CardVisual): void {
    proxies.delete(p);
    p.disposeVisual();
  }

  function setTransitPose(p: CardVisual, pose: CssPose, z = 0): void {
    p.group.position.set(pose.x, -pose.y, 100 + z);
    p.group.rotation.set(pose.tilt ?? 0, pose.flip * Math.PI, pose.rotation);
    p.group.scale.setScalar(Math.max(0.001, pose.width));
    // `flip` em meias-voltas: 0 frente, 1 verso, 2 frente de novo (giro completo em Y da revelação).
    const f = ((pose.flip % 2) + 2) % 2;
    if (f < 0.02 || f > 1.98) p.setFaceVisibility('FRONT');
    else p.setFaceVisibility(Math.abs(f - 1) < 0.02 ? 'BACK' : 'BOTH');
  }

  function setBoardPose(p: CardVisual, pose: WorldPose): void {
    placeFlat(p, pose);
    const f = pose.flip ?? 0;
    if (f > 0.02 && f < 0.98) p.setFaceVisibility('BOTH');
    else p.setFaceVisibility(f >= 0.98 ? 'BACK' : 'FRONT');
  }

  /** Destaque do ataque (gameplay-pocket §10.2): carta grande no centro e faixa de largura total da mesa. */
  function cutinCss(): { x: number; y: number; width: number; compact: boolean; stageX: number; stageWidth: number } {
    const r = mapRect(region(profile, 'attackCutin'), frame);
    const base = profile.id === 'desktop1080' ? 360 : 250;
    const width = Math.min(base * frame.scale, r.width * 0.62);
    return { x: r.x + r.width * 0.5, y: r.y + r.height * 0.46, width, compact: speed === 'FAST', stageX: frame.x + frame.width / 2, stageWidth: frame.width };
  }

  /** Prévia grande no centro da mesa (compra, carta jogada, Treinador; gameplay-pocket §5.2, §9): centro do destaque do ataque. */
  function previewCss(): CssPose {
    const r = mapRect(region(profile, 'attackCutin'), frame);
    const base = profile.id === 'desktop1080' ? 330 : 230;
    return { x: r.x + r.width * 0.5, y: r.y + r.height * 0.5, width: Math.min(base * frame.scale, r.width * 0.6), rotation: 0, flip: 0 };
  }

  function emitCue(c: BattleCue): void {
    for (const cb of listeners.cue) cb(c);
  }

  const api: StageApi = {
    rs,
    board,
    sync: (b) => syncBoard(b),
    hide: (key, count = 1) => {
      hidden.set(key, (hidden.get(key) ?? 0) + count);
    },
    unhide: (key, count = 1) => {
      const n = (hidden.get(key) ?? 0) - count;
      if (n > 0) hidden.set(key, n);
      else hidden.delete(key);
    },
    entity: (id) => entities.get(id) ?? null,
    entityPose: (id) => {
      const v = entities.get(id);
      if (!v) return null;
      return { x: v.base.x + v.offset.x, y: TABLE_Y.card + v.offset.y, z: v.base.z + v.offset.z, scale: v.base.scale * v.offset.scale };
    },
    anchorPose,
    handPoseCss,
    handTargetCss,
    npcFanWorld,
    resolutionWorld,
    toolWorld: (id) => {
      const v = entities.get(id);
      if (!v) return null;
      return { x: v.base.x + 0.42 * v.base.scale, y: TABLE_Y.card + 0.03, z: v.base.z + 0.5 * v.base.scale, scale: 0.36 * v.base.scale, rotZ: -0.14 };
    },
    worldToCss,
    cutinCss,
    previewCss,
    transitProxy,
    boardProxy,
    releaseProxy,
    setTransitPose,
    setBoardPose,
    transitRoot,
    effectsRoot: board.effectsRoot,
    descriptorFor,
    cardName: (c) => (c ? resolve(c)?.face.name ?? '' : ''),
    cardType: (c) => (c ? resolve(c)?.face.types[0] ?? 'COLORLESS' : 'COLORLESS'),
    coin: (player) => {
      const side = coinOwner(player, sceneBoard?.viewer ?? view?.viewer ?? 'A');
      const cosmetic = (side === 'MINE' ? presentation.playerCosmetics.coin : presentation.opponentCosmetics.coin) ?? null;
      const art = coinArtImages(cosmetic?.visual.assetKey);
      const known = coins[side];
      // Criada antes de a imagem chegar: troca pela moeda com a arte no próximo lançamento.
      if (known && (known.art || !art || known.group.visible)) return known;
      known?.dispose();
      coins[side] = createCoinVisual(rs, cosmetic, art);
      return coins[side];
    },
    setVeil: (a) => board.setVeil(a),
    cue: emitCue,
    flairTry: (key) => (key ? flair.tryPlay(key) : false),
    particleBudget: () => QUALITY_PROFILES[rs.quality()].particleBudget,
    playmatFor: (b) => resolveDisplayedPlaymat(b, presentation),
    pxPerUnit: (pose) => pxPerUnitAt(camera, pose.x, pose.z, boardRect, pose.y),
    takeHandDrop: (cardId) => {
      // A carta solta continua no ponto da soltura até o passo da jogada assumir dali (sem voltar à mão por um quadro).
      const d = dragState;
      if (!d?.pending || !d.proxy || d.cardId !== cardId) return null;
      const g = d.proxy.group;
      const pose: CssPose = { x: g.position.x, y: -g.position.y, width: g.scale.x, rotation: g.rotation.z, flip: 0 };
      releaseProxy(d.proxy);
      dragState = null;
      for (const cb of listeners.dragEnd) cb();
      return pose;
    },
    isHidden,
    takeEnergyDrop: () => {
      const e = energyDrag;
      if (!e?.started || e.pendingSince === null || !e.sprite) return null;
      const out = { x: e.pos.x, y: e.pos.y, size: readyCss().width * 0.9 };
      e.sprite.dispose();
      energyDrag = null;
      return out;
    },
  };

  // ------------------------------------------------------------------------------ diretor
  const handlers: DirectorHandlers = {
    begin: (step, info) => {
      if (!director.isCurrent(info.generation)) return;
      runtimes.set(step.stepId, createStepRuntime(api, step, info.skipped));
      // A soltura que nenhum passo assumiu (o primeiro passo não era a jogada dela) termina aqui.
      if (dragState?.pending) endDrag(false);
      // O Pokémon solto no Ativo: o passo PROMOTE parte do ponto da soltura (lê a pose com o offset) e assume dali.
      if (entityDrag && entityDrag.pendingSince !== null) entityDrag = null;
    },
    update: (step, progress, info) => {
      if (!director.isCurrent(info.generation)) return;
      runtimes.get(step.stepId)?.update(progress);
    },
    end: (step, info) => {
      if (!director.isCurrent(info.generation)) return;
      runtimes.get(step.stepId)?.finish();
      runtimes.delete(step.stepId);
      setHud(step.boardAfter);
    },
    complete: (plan, reason, info) => {
      if (!director.isCurrent(info.generation) && reason !== 'CANCELLED') return;
      if (dragState?.pending) endDrag(false);
      entityDrag = null;
      for (const r of runtimes.values()) r.finish();
      runtimes.clear();
      hidden.clear();
      for (const p of [...proxies]) releaseProxy(p);
      board.setVeil(0);
      for (const c of [coins.MINE, coins.THEIRS]) if (c) c.group.visible = false;
      for (const v of entities.values()) {
        Object.assign(v.offset, { x: 0, y: 0, z: 0, rotY: 0, rotZ: 0, scale: 1, flip: 0 });
        v.setDimmed(false);
      }
      if (reason === 'CANCELLED') return;
      syncBoard(plan.finalBoard, true);
      setHud(plan.finalBoard, true);
      board.setPlaymat(resolveDisplayedPlaymat(plan.finalBoard, presentation), 0);
      board.setTurnOwner(plan.finalBoard.currentPlayer === plan.finalBoard.viewer ? 'HUMAN' : 'NPC', reason === 'SKIPPED');
    },
  };

  function applyView(next: BattleView): void {
    view = next;
    const b = projectBoard(next, sceneBoard?.lastSeq ?? 0);
    syncBoard(b, true);
    setHud(b, true);
    board.setPlaymat(resolveDisplayedPlaymat(b, presentation), 0);
    board.setTurnOwner(b.currentPlayer === b.viewer ? 'HUMAN' : 'NPC', true);
  }

  // ------------------------------------------------------------------------------- layout
  function frameFromRect(rect: CssRect): LayoutFrame {
    const id: LayoutProfileId = profileSel !== 'auto' ? profileSel : rect.height >= 900 ? 'desktop1080' : 'compact720';
    const [dw, dh] = PROFILES[id].viewport;
    const scale = Math.min(rect.width / dw, rect.height / dh);
    return { profileId: id, scale, x: rect.x + (rect.width - dw * scale) / 2, y: rect.y + (rect.height - dh * scale) / 2, width: dw * scale, height: dh * scale, fallback2D: false };
  }

  function relayout(): void {
    const size = rs.size();
    frame = customFrame ? frameFromRect(customFrame) : selectFrame(size.width, size.height, profileSel);
    if (frame.profileId !== profile.id || !tableBuilt) {
      profile = PROFILES[frame.profileId];
      fit = fitBounds(profile);
      designCamera = fit.camera;
      anchors = computeAnchors({ ...profile, worldSeeds: fit.seeds }, designCamera);
      board.setAnchors(anchors);
      board.setTable(tableGeometryWorld(profile, designCamera));
      tableBuilt = true;
    }
    boardRect = frameRegion(profile, 'board', frame);
    handRect = frameRegion(profile, 'hand', frame);
    zoneRect = frameRegion(profile, 'trainerZone', frame);
    const table = mapRect(tableRect(profile), frame);
    camera = designCamera.clone();
    camera.aspect = boardRect.width / boardRect.height;
    camera.updateProjectionMatrix();
    tightenDepth(camera);
    // A câmera do campo (picking, âncoras, projeções) continua a do viewport `board`. Só o desenho usa um
    // recorte maior da mesma projeção (setViewOffset), para a superfície visual ir de barra a barra.
    renderCamera = camera.clone();
    renderCamera.setViewOffset(boardRect.width, boardRect.height, table.x - boardRect.x, table.y - boardRect.y, table.width, table.height);
    boardVp.setCamera(renderCamera);
    boardVp.setRect(table);
    // Folga lateral: as pontas inclinadas do leque não são cortadas pelo recorte do viewport da mão.
    const handMargin = 48 * frame.scale;
    handVp.setRect({ x: handRect.x - handMargin, y: handRect.y, width: handRect.width + 2 * handMargin, height: handRect.height });
    handCamera.left = -handRect.width / 2 - handMargin;
    handCamera.right = handRect.width / 2 + handMargin;
    handCamera.top = handRect.height / 2;
    handCamera.bottom = -handRect.height / 2;
    handCamera.updateProjectionMatrix();
    transitCamera.left = 0;
    transitCamera.right = size.width;
    transitCamera.top = 0;
    transitCamera.bottom = -size.height;
    transitCamera.updateProjectionMatrix();
    transitVp.setRect({ x: 0, y: 0, width: size.width, height: size.height });
    if (sceneBoard) syncBoard(sceneBoard, true);
    anchorsDirty = true;
    for (const cb of listeners.anchors) cb();
  }

  const offResize = rs.onResize(() => relayout());
  // A arte do verso chega depois: refaz o leque do NPC (InstancedMesh) com a textura final.
  const offCardBack = onCardBackReady(() => {
    if (sceneBoard && !disposed) syncBoard(sceneBoard, true);
  });
  // As bolas de Energia também: prato da Zona, próxima Energia e fichas ligadas trocam o desenho provisório pela arte.
  const offEnergyOrbs = onEnergyOrbsReady(() => {
    if (sceneBoard && !disposed) syncBoard(sceneBoard, true);
  });
  // Sleeves do Pocket dos dois decks: carregam já; ao chegar, os versos desenhados com o padrão trocam pela imagem.
  for (const s of [presentation.playerCosmetics.sleeve, presentation.opponentCosmetics.sleeve]) void loadSleeveArt(s?.visual.assetKey);
  const offSleeveArt = onSleeveArtReady(() => {
    if (sceneBoard && !disposed) syncBoard(sceneBoard, true);
  });
  relayout();

  // ---------------------------------------------------------------------------- entrada
  const raycaster = new Raycaster();
  raycaster.layers.set(PICK_LAYER);
  type DragState = {
    key: string; cardId: string; start: { x: number; y: number }; started: boolean; proxy: CardVisual | null; over: PickTarget | null; pending: boolean;
    returning: { t: number; from: CssPose } | null; denied: { t: number } | null; pos: { x: number; y: number };
  };
  let dragState: DragState | null = null;
  /** Elevação de hover suavizada por entidade (0–1); ausente = apoiada na mesa. */
  const entityHover = new Map<string, number>();
  let downTarget: PickTarget | null = null;
  let hoverTarget: PickTarget | null = null;

  function boardPick(x: number, y: number): PickTarget | null {
    if (!rectContains(boardRect, x, y)) return null;
    const ndc = new Vector2(((x - boardRect.x) / boardRect.width) * 2 - 1, 1 - ((y - boardRect.y) / boardRect.height) * 2);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObject(board.root, true);
    for (const h of hits) {
      const t = pickTargetOf(h.object as never);
      if (t) return t;
    }
    return null;
  }

  function handPick(x: number, y: number): { key: string; cardId: string } | null {
    if (!sceneBoard) return null;
    if (focusKey) {
      const h = handCards.get(focusKey);
      const pose = h ? displayPose(h) : null;
      if (h && pose && h.cardId) {
        const c = handLocalToCss(pose.x, pose.y);
        const hw = pose.width / 2;
        const hh = (pose.width * 1.4) / 2;
        if (Math.abs(x - c.x) <= hw && Math.abs(y - c.y) <= hh) return { key: h.key, cardId: h.cardId };
      }
    }
    if (!rectContains(handRect, x, y)) return null;
    const side = sceneBoard.sides[sceneBoard.viewer];
    const slots = side.hand.map((h, i) => {
      const hc = handCards.get(h.key);
      return { ...(hc?.slot ?? { index: i, x: 0, y: 0, baseY: 0, rotation: 0, scale: 1, order: i, width: 0, height: 0 }), index: i };
    });
    const local = { x: x - (handRect.x + handRect.width / 2), y: handRect.y + handRect.height / 2 - y };
    const index = handCardAt(slots, local.x, local.y);
    if (index === null) return null;
    const h = side.hand[index];
    return h?.card ? { key: h.key, cardId: h.card.cardId } : null;
  }

  function isLegal(t: PickTarget | null): boolean {
    if (!t) return false;
    if (t.kind === 'ENTITY') return highlights.targets.has(t.entityId);
    if (t.kind === 'SLOT' || t.kind === 'PILE') return highlights.targets.has(t.anchorId);
    return false;
  }

  /** Campo jogável: dentro do viewport do campo e acima da mão (soltar de volta na mão é cancelar). */
  const inPlayArea = (x: number, y: number) => rectContains(boardRect, x, y) && y < handRect.y;

  /** Treinador sem alvo em arrasto (`PLAY_AREA` realçado): a zona verde aparece e só ela aceita a soltura. */
  const zoneDrag = () => highlights.targets.has(PLAY_AREA);
  const inZone = (x: number, y: number) => rectContains(zoneRect, x, y);

  /** Alvo efetivo da soltura: o objeto realçado sob o ponteiro ou, para o Treinador sem alvo, a zona verde. */
  function dropTarget(x: number, y: number): PickTarget | null {
    const over = boardPick(x, y);
    if (isLegal(over)) return over;
    return zoneDrag() && inZone(x, y) ? PLAY_AREA_TARGET : null;
  }

  function targetCss(t: PickTarget): CssPose | null {
    if (t.kind === 'ENTITY') {
      const p = api.entityPose(t.entityId);
      return p ? worldToCss(p) : null;
    }
    if (t.kind === 'SLOT' || t.kind === 'PILE') {
      const p = anchorPose(t.anchorId);
      return p ? worldToCss(p) : null;
    }
    return null;
  }

  function endDrag(returnToHand: boolean): void {
    const d = dragState;
    if (!d) return;
    if (d.proxy && returnToHand) {
      d.returning = { t: 0, from: { x: d.pos.x, y: d.pos.y, width: d.proxy.group.scale.x, rotation: 0, flip: 0 } };
      d.pending = false;
      return;
    }
    if (d.proxy) releaseProxy(d.proxy);
    dragState = null;
    if (sceneBoard) syncHand(sceneBoard);
    if (d.started) for (const cb of listeners.dragEnd) cb();
  }

  const offPointer = rs.addPointerTarget({
    priority: 10,
    isActive: () => active && !disposed,
    hit: (x, y) => rectContains(boardRect, x, y) || rectContains(handRect, x, y) || (!!focusKey && !!handPick(x, y)),
    onDown: (p) => {
      if (p.button === 2) {
        // Botão secundário: inspecionar (a UI abre o inspector com a CardRef do alvo); nunca joga.
        const hand = handPick(p.x, p.y);
        const t: PickTarget | null = hand ? { kind: 'HAND_CARD', cardId: hand.cardId } : boardPick(p.x, p.y);
        if (t) for (const cb of listeners.inspect) cb(t);
        return false;
      }
      if (p.button !== 0 || locked) return false;
      const hand = handPick(p.x, p.y);
      if (hand) {
        if (dragState?.pending) endDrag(true);
        dragState = { key: hand.key, cardId: hand.cardId, start: { x: p.x, y: p.y }, started: false, proxy: null, over: null, pending: false, returning: null, denied: null, pos: { x: p.x, y: p.y } };
        downTarget = { kind: 'HAND_CARD', cardId: hand.cardId };
        return true;
      }
      downTarget = boardPick(p.x, p.y);
      const down = downTarget;
      if (down?.kind === 'PILE' && down.anchorId === 'HUMAN_ENERGY_READY' && zoneState.HUMAN.ready && !presenting && !energyDrag
        && (highlights.selectable.has(down.anchorId) || highlights.selected.has(down.anchorId))) {
        energyDrag = { start: { x: p.x, y: p.y }, pos: { x: p.x, y: p.y }, started: false, over: null, returning: null, pendingSince: null, sprite: null };
      }
      if (down?.kind === 'ENTITY' && highlights.floating.has(down.entityId) && !presenting && !entityDrag) {
        entityDrag = { entityId: down.entityId, start: { x: p.x, y: p.y }, started: false, over: false, pendingSince: null, returning: null };
      }
      return !!downTarget;
    },
    onMove: (p) => {
      const ed = entityDrag;
      if (ed && !ed.returning && ed.pendingSince === null) {
        if (!ed.started && Math.hypot(p.x - ed.start.x, p.y - ed.start.y) >= DRAG_THRESHOLD_PX) {
          ed.started = true;
          downTarget = null;
        }
        const v = ed.started ? entities.get(ed.entityId) : null;
        const at = v ? unprojectToPlane(camera, p.x, p.y, boardRect, TABLE_Y.card) : null;
        if (v && at) {
          // Segue o ponteiro um pouco acima da mesa; sobre o Ativo, encosta no espaço (encaixe parcial).
          ed.over = overHumanActive(p.x, p.y);
          const a = anchors.HUMAN_ACTIVE;
          const tx = ed.over ? lerp(at.x, a.x, 0.55) : at.x;
          const tz = ed.over ? lerp(at.z, a.z, 0.55) : at.z;
          Object.assign(v.offset, { x: tx - v.base.x, z: tz - v.base.z, y: 0.5 * v.base.scale, scale: ed.over ? 1.12 : 1.06 });
          v.updateTransform();
          anchorsDirty = true;
          rs.requestRender();
        }
        if (ed.started) return;
      }
      const e = energyDrag;
      if (e && !e.returning && e.pendingSince === null) {
        e.pos = { x: p.x, y: p.y };
        if (!e.started && Math.hypot(p.x - e.start.x, p.y - e.start.y) >= DRAG_THRESHOLD_PX) {
          e.started = true;
          downTarget = null;
          e.sprite = createEnergyOrbSprite(rs, transitRoot, zoneState.HUMAN.ready ?? 'COLORLESS');
          syncZone('HUMAN', zoneState.HUMAN.ready, zoneState.HUMAN.next);
          for (const cb of listeners.energy) cb({ phase: 'START' });
        }
        if (e.started) {
          const over = boardPick(p.x, p.y);
          e.over = over?.kind === 'ENTITY' && highlights.targets.has(over.entityId) ? over.entityId : null;
          rs.requestRender();
        }
        return;
      }
      const d = dragState;
      if (!d || d.returning || d.denied || d.pending) return;
      d.pos = { x: p.x, y: p.y };
      if (!d.started) {
        if (Math.hypot(p.x - d.start.x, p.y - d.start.y) < DRAG_THRESHOLD_PX || presenting) return;
        d.started = true;
        const hc = handCards.get(d.key);
        const desc = hc ? hc.card.descriptor() : null;
        if (!desc) return;
        d.proxy = transitProxy(desc);
        d.proxy.setFaceVisibility('FRONT');
        focusKey = null;
        if (hc) hc.card.group.visible = false;
        for (const cb of listeners.dragStart) cb(d.cardId);
      }
      d.over = dropTarget(p.x, p.y) ?? boardPick(p.x, p.y);
      rs.requestRender();
    },
    onUp: (p) => {
      const ed = entityDrag;
      if (ed) {
        if (ed.started) {
          if (ed.returning || ed.pendingSince !== null) return;
          const v = entities.get(ed.entityId);
          if (overHumanActive(p.x, p.y) && v) {
            ed.over = true;
            ed.pendingSince = performance.now();
            for (const cb of listeners.entityDrop) cb({ entityId: ed.entityId, anchorId: 'HUMAN_ACTIVE' });
          } else if (v) ed.returning = { t: 0, from: { x: v.offset.x, y: v.offset.y, z: v.offset.z, scale: v.offset.scale } };
          else entityDrag = null;
          downTarget = null;
          return;
        }
        entityDrag = null;
      }
      const e = energyDrag;
      if (e) {
        if (e.started) {
          if (e.returning || e.pendingSince !== null) return;
          e.pos = { x: p.x, y: p.y };
          const over = boardPick(p.x, p.y);
          e.over = over?.kind === 'ENTITY' && highlights.targets.has(over.entityId) ? over.entityId : null;
          if (e.over) {
            e.pendingSince = performance.now();
            for (const cb of listeners.energy) cb({ phase: 'DROP', entityId: e.over });
          } else e.returning = { t: 0, from: { ...e.pos } };
          return;
        }
        energyDrag = null;
      }
      const d = dragState;
      if (d && d.started) {
        if (d.returning || d.denied) return;
        const target = dropTarget(p.x, p.y);
        if (target) {
          d.over = target;
          d.pending = true;
          for (const cb of listeners.drag) cb({ cardId: d.cardId, target });
        } else if (inPlayArea(p.x, p.y) && d.proxy && !zoneDrag()) {
          // Tentou jogar fora de um alvo legal: nega (treme em vermelho) e volta à mão; a UI explica o motivo.
          // O Treinador solto fora da zona verde só volta à mão, sem aviso (gameplay-pocket §6).
          d.denied = { t: 0 };
          d.over = null;
          const over = boardPick(p.x, p.y);
          for (const cb of listeners.deny) cb({ cardId: d.cardId, target: over ?? PLAY_AREA_TARGET });
        } else endDrag(true);
        return;
      }
      if (d && !d.started) dragState = null;
      const target = downTarget;
      downTarget = null;
      if (!target) return;
      const upHand = handPick(p.x, p.y);
      const up: PickTarget | null = upHand ? { kind: 'HAND_CARD', cardId: upHand.cardId } : boardPick(p.x, p.y);
      if (up && JSON.stringify(up) === JSON.stringify(target)) for (const cb of listeners.pick) cb(target);
    },
    onCancel: () => {
      downTarget = null;
      if (entityDrag?.started && entityDrag.pendingSince === null && !entityDrag.returning) {
        const v = entities.get(entityDrag.entityId);
        if (v) entityDrag.returning = { t: 0, from: { x: v.offset.x, y: v.offset.y, z: v.offset.z, scale: v.offset.scale } };
        else entityDrag = null;
      } else if (entityDrag && !entityDrag.started) entityDrag = null;
      if (energyDrag?.started && energyDrag.pendingSince === null && !energyDrag.returning) energyDrag.returning = { t: 0, from: { ...energyDrag.pos } };
      else if (energyDrag && !energyDrag.started) energyDrag = null;
      if (dragState?.started && !dragState.pending && !dragState.denied) endDrag(true);
      else if (dragState && !dragState.started) dragState = null;
    },
    onHover: (p) => {
      if (!p) {
        focusKey = null;
        if (hoverTarget) {
          hoverTarget = null;
          for (const cb of listeners.hover) cb(null);
        }
        rs.requestRender();
        return;
      }
      const hand = dragState?.started ? null : handPick(p.x, p.y);
      focusKey = hand?.key ?? null;
      const t: PickTarget | null = hand ? { kind: 'HAND_CARD', cardId: hand.cardId } : boardPick(p.x, p.y);
      if (JSON.stringify(t) !== JSON.stringify(hoverTarget)) {
        hoverTarget = t;
        for (const cb of listeners.hover) cb(t);
      }
      rs.requestRender();
    },
  });

  // ------------------------------------------------------------------------------- loop
  const targetMat = markerMaterial(rs, 'TARGET');
  const offTicker = rs.addTicker((dt, now) => {
    if (disposed) return false;
    let animating = false;
    const pdt = clock.tick(now);
    if (director.isRunning()) {
      director.advance(pdt);
      animating = true;
    }
    if (board.update(dt, now)) animating = true;
    // Mão: reflow suave e foco (UI_HOVER).
    const hoverMs = uiPresetDurationMs('UI_HOVER');
    const a = 1 - Math.exp(-dt / 70);
    for (const hc of handCards.values()) {
      const t = hc.target;
      const c = hc.cur;
      const moving = Math.abs(t.x - c.x) + Math.abs(t.y - c.y) + Math.abs(t.rotation - c.rotation) * 100 + Math.abs(t.width - c.width) > 0.05;
      if (moving) {
        hc.cur = { x: lerp(c.x, t.x, a), y: lerp(c.y, t.y, a), rotation: lerp(c.rotation, t.rotation, a), width: lerp(c.width, t.width, a) };
        animating = true;
      } else hc.cur = { ...t };
      // Sobe a carta em foco (hover/teclado) ou selecionada (interface §23.5), exceto durante um arrasto.
      const lifted = (focusKey === hc.key || (!!hc.cardId && (highlights.selected.has(hc.cardId) || hc.cardId === keyboardFocus))) && !(dragState?.started && dragState.key === hc.key);
      const wantFocus = lifted ? 1 : 0;
      const step = reduced ? 1 : dt / hoverMs;
      const nextFocus = clamp(hc.focusT + (wantFocus > hc.focusT ? step : -step), 0, 1);
      if (nextFocus !== hc.focusT) animating = true;
      hc.focusT = nextFocus;
      const pose = displayPose(hc);
      const toTransit = hc.focusT > 0.001;
      if (toTransit !== hc.inTransit) {
        (toTransit ? transitRoot : handScene).add(hc.card.group);
        hc.inTransit = toTransit;
      }
      if (toTransit) {
        const css = handLocalToCss(pose.x, pose.y);
        hc.card.group.position.set(css.x, -css.y, 600);
        hc.card.setMarker(markerFor(hc.cardId) === 'NONE' ? 'HOVER' : markerFor(hc.cardId));
      } else {
        hc.card.group.position.set(pose.x, pose.y, hc.slot.order * 4);
        hc.card.setMarker(markerFor(hc.cardId));
      }
      hc.card.group.rotation.set(0, 0, pose.rotation);
      hc.card.group.scale.setScalar(pose.width);
    }
    // Hover na mesa: a carta sob o ponteiro sobe, cresce e flutua (fora de arrasto e de apresentação).
    const energyOver = energyDrag?.started ? energyDrag.over : null;
    const hoveredId = !dragState?.started && !energyDrag?.started && !entityDrag?.started && !presenting && hoverTarget?.kind === 'ENTITY' ? hoverTarget.entityId : null;
    const ease = reduced ? 1 : 1 - Math.exp(-dt / 70);
    // Pokémon flutuantes (promoção): erguidos e balançando, mais alto o escolhido; o arrastado é guiado pelo offset.
    const floatOn = !presenting && !locked;
    const dragged = entityDrag?.started ? entityDrag.entityId : null;
    for (const [id, v] of entities) {
      const prev = entityHover.get(id) ?? 0;
      const floatWant = floatOn && highlights.floating.has(id) ? (highlights.selected.has(id) ? 0.85 : 0.55) : 0;
      const want = id === dragged ? 0 : Math.max(id === energyOver ? 0.45 : id === hoveredId ? 1 : 0, floatWant);
      let k = prev + (want - prev) * ease;
      if (Math.abs(want - k) < 0.002) k = want;
      const bob = k > 0 && !reduced ? Math.sin(now / 420) * 0.04 * v.base.scale * k : 0;
      if (k !== prev || k > 0) {
        v.setHover(k, bob);
        anchorsDirty = true;
        animating = true;
      }
      if (k > 0) entityHover.set(id, k);
      else entityHover.delete(id);
    }
    // Arrasto: segue o ponteiro; encaixe suave no alvo legal; retorno em UI_DRAG_RETURN.
    const d = dragState;
    if (d?.proxy) {
      animating = true;
      if (d.denied && !d.returning) {
        // Recusa: tremida horizontal amortecida no ponto da soltura e, em seguida, o retorno à mão.
        d.denied.t += reduced ? 1 : dt / DENY_MS;
        const k = clamp(d.denied.t, 0, 1);
        const rest = profile.handPolicy.restCardSize[0] * frame.scale;
        const shake = reduced ? 0 : Math.sin(k * Math.PI * 6) * 12 * (1 - k);
        setTransitPose(d.proxy, { x: d.pos.x + shake, y: d.pos.y, width: rest, rotation: 0, flip: 0 }, 500);
        d.proxy.setMarker('DENY');
        if (k >= 1) d.returning = { t: 0, from: { x: d.pos.x, y: d.pos.y, width: rest, rotation: 0, flip: 0 } };
      } else if (d.returning) {
        d.returning.t += dt / uiPresetDurationMs('UI_DRAG_RETURN');
        const home = handPoseCss(d.key);
        const k = EASINGS.easeOutCubic(clamp(d.returning.t, 0, 1));
        if (home) setTransitPose(d.proxy, { x: lerp(d.returning.from.x, home.x, k), y: lerp(d.returning.from.y, home.y, k), width: lerp(d.returning.from.width, home.width, k), rotation: home.rotation * k, flip: 0 }, 500);
        if (d.returning.t >= 1) {
          releaseProxy(d.proxy);
          dragState = null;
          if (sceneBoard) syncHand(sceneBoard);
          for (const cb of listeners.dragEnd) cb();
        }
      } else {
        const legal = isLegal(d.over) || (d.over?.kind === 'SLOT' && d.over.anchorId === PLAY_AREA);
        const snap = legal && d.over ? targetCss(d.over) : null;
        const rest = profile.handPolicy.restCardSize[0] * frame.scale;
        const pose: CssPose = snap
          ? { x: lerp(d.pos.x, snap.x, d.pending ? 1 : 0.6), y: lerp(d.pos.y, snap.y, d.pending ? 1 : 0.6) - 10, width: lerp(rest, snap.width, 0.7), rotation: 0, flip: 0 }
          : { x: d.pos.x, y: d.pos.y, width: rest, rotation: 0.05, flip: 0 };
        setTransitPose(d.proxy, pose, 500);
        d.proxy.setMarker(legal ? 'TARGET' : 'HOVER');
      }
    }
    // Pokémon arrastado: sem alvo, volta ao Banco (UI_DRAG_RETURN); solto no Ativo, espera o passo PROMOTE.
    const ent = entityDrag;
    if (ent?.started) {
      const v = entities.get(ent.entityId);
      if (!v) entityDrag = null;
      else if (ent.returning) {
        animating = true;
        ent.returning.t += reduced ? 1 : dt / uiPresetDurationMs('UI_DRAG_RETURN');
        const k = EASINGS.easeOutCubic(clamp(ent.returning.t, 0, 1));
        const f = ent.returning.from;
        Object.assign(v.offset, { x: lerp(f.x, 0, k), y: lerp(f.y, 0, k), z: lerp(f.z, 0, k), scale: lerp(f.scale, 1, k) });
        v.updateTransform();
        anchorsDirty = true;
        if (ent.returning.t >= 1) endEntityDrag(true);
      } else if (ent.pendingSince !== null && performance.now() - ent.pendingSince > 2500) {
        // A promoção não chegou (recusada ou falhou): volta ao Banco.
        ent.returning = { t: 0, from: { x: v.offset.x, y: v.offset.y, z: v.offset.z, scale: v.offset.scale } };
        ent.pendingSince = null;
      }
    }
    // Zona verde do Treinador sem alvo: só durante o arrasto; acende com a carta sobre ela e some ao soltar.
    const zd = dragState;
    if (zd?.proxy && zd.started && !zd.pending && !zd.returning && !zd.denied && zoneDrag()) {
      dropZone.place(zoneRect.x + zoneRect.width / 2, zoneRect.y + zoneRect.height / 2, zoneRect.width, zoneRect.height, 40);
      dropZone.setState(inZone(zd.pos.x, zd.pos.y) ? 'HOVER' : 'SHOWN');
    } else dropZone.setState('HIDDEN');
    // Orbe da Energia: segue o ponteiro; sem alvo, volta ao prato (UI_DRAG_RETURN); solto num alvo, espera o passo.
    const ed = energyDrag;
    if (ed?.started && ed.sprite) {
      animating = true;
      const home = readyCss();
      const size = home.width * 1.12;
      if (ed.returning) {
        ed.returning.t += reduced ? 1 : dt / uiPresetDurationMs('UI_DRAG_RETURN');
        const k = EASINGS.easeOutCubic(clamp(ed.returning.t, 0, 1));
        ed.sprite.set(lerp(ed.returning.from.x, home.x, k), lerp(ed.returning.from.y, home.y, k), size, 1);
        if (ed.returning.t >= 1) endEnergyDrag(true);
      } else {
        ed.sprite.set(ed.pos.x, ed.pos.y, size * (ed.over ? 0.9 : 1.06), 1);
        // A ligação já foi apresentada sem voo (Instantânea/movimento reduzido) ou a jogada não veio: encerra.
        if (ed.pendingSince !== null && (!zoneState.HUMAN.ready || performance.now() - ed.pendingSince > 2500)) {
          if (zoneState.HUMAN.ready) ed.returning = { t: 0, from: { ...ed.pos } };
          else endEnergyDrag(false);
        }
      }
    }
    for (const plate of Object.values(plates)) if (plate?.pulse(now)) animating = true;
    // Pulso discreto de alvos legais e relógio do acabamento.
    if (highlights.targets.size) {
      targetMat.opacity = 0.62 + 0.3 * Math.sin(now / 260);
      animating = true;
    }
    if (rs.quality() !== 'LOW') FINISH_GLOBALS.time.value = now / 1000;
    FINISH_GLOBALS.animated.value = rs.quality() === 'LOW' ? 0 : 1;
    const transitNeeded = transitRoot.children.some((c) => c.visible);
    transitVp.setActive(transitNeeded && active);
    if (animating || anchorsDirty) {
      boardVp.markDirty();
      handVp.markDirty();
      if (transitNeeded) transitVp.markDirty();
      anchorsDirty = false;
      for (const cb of listeners.anchors) cb();
    }
    return animating;
  });

  // ------------------------------------------------------------------------------- API
  function anchorRects(): Record<string, AnchorRect> {
    const out: Record<string, AnchorRect> = {};
    for (const id of ANCHOR_IDS) {
      const a = anchors[id];
      if (a.kind === 'SLOT' || a.kind === 'PILE' || a.kind === 'STADIUM') out[id] = projectedCardRect(camera, new Vector3(a.x, TABLE_Y.card, a.z), a.scale, boardRect);
      else if (a.kind === 'ENERGY') out[id] = projectedCardRect(camera, new Vector3(a.x, 0.012, a.z), a.scale, boardRect, 1);
      else if (id === 'HUMAN_HAND') out[id] = { ...handRect };
      else out[id] = mapRect(a.design, frame);
    }
    for (const id of entities.keys()) {
      const p = api.entityPose(id)!;
      // Com hover, o retângulo acompanha a carta erguida (PS em HTML e área de toque seguem junto).
      const k = entityHover.get(id) ?? 0;
      out[`ENTITY:${id}`] = projectedCardRect(camera, new Vector3(p.x, p.y + k * HOVER_LIFT * p.scale, p.z), p.scale * (1 + HOVER_SCALE * k), boardRect);
    }
    for (const hc of handCards.values()) {
      if (!hc.cardId) continue;
      const pose = displayPose(hc);
      const c = handLocalToCss(pose.x, pose.y);
      out[`HAND_CARD:${hc.cardId}`] = { x: c.x - pose.width / 2, y: c.y - (pose.width * 1.4) / 2, width: pose.width, height: pose.width * 1.4 };
    }
    return out;
  }

  return {
    setLayoutProfile: (id) => {
      profileSel = id;
      relayout();
    },
    setFrame: (rect) => {
      customFrame = rect;
      relayout();
    },
    setView: (next, pres) => {
      if (pres) presentation = pres;
      queueGen += 1;
      director.cancel();
      presenting = false;
      endDrag(false);
      endEntityDrag(true);
      applyView(next);
    },
    present: (batch) => {
      const gen = queueGen;
      const run = async () => {
        if (gen !== queueGen || disposed) return;
        if (!view || !sceneBoard) applyView(batch.before);
        const plan = planPresentation(batch.events, batch.before, batch.after, {
          attemptId, batchId: batch.batchId, speed, reducedMotion: reduced, newAttempt: batch.newAttempt ?? false,
          describeCard: traitsOf, playmatKey: (b) => resolveDisplayedPlaymat(b, presentation).key,
        });
        view = batch.after;
        lastPlan = plan;
        presenting = true;
        clock.resetReference();
        rs.requestRender();
        await director.start(plan, handlers);
        if (gen === queueGen) presenting = false;
      };
      queue = queue.then(run, run);
      return queue;
    },
    skipToBarrier: () => director.skipToBarrier(),
    setSpeed: (s) => {
      speed = s;
      if (s === 'INSTANT') director.skipToBarrier();
    },
    setReducedMotion: (on) => {
      reduced = on;
    },
    pause: () => {
      director.pause();
      clock.pause();
    },
    resume: () => {
      director.resume();
      clock.resume();
      rs.requestRender();
    },
    onPick: (cb) => subscribe(listeners.pick, cb),
    setPresentation: (next) => {
      presentation = next;
      const shown = sceneBoard ?? (view ? projectBoard(view) : null);
      if (shown) board.setPlaymat(resolveDisplayedPlaymat(shown, presentation), 0);
      rs.requestRender();
    },
    matImageStatus: () => board.matImageStatus(),
    onMatImageStatus: (cb) => subscribe(matImageListeners, cb),
    onInspect: (cb) => subscribe(listeners.inspect, cb),
    setKeyboardFocus: (cardId) => {
      keyboardFocus = cardId;
      rs.requestRender();
    },
    setLocked: (on) => {
      locked = on;
      if (on && dragState?.started && !dragState.pending && !dragState.denied) endDrag(true);
      if (on && entityDrag && entityDrag.pendingSince === null) {
        const v = entities.get(entityDrag.entityId);
        if (entityDrag.started && v && !entityDrag.returning) entityDrag.returning = { t: 0, from: { x: v.offset.x, y: v.offset.y, z: v.offset.z, scale: v.offset.scale } };
        else if (!entityDrag.started) entityDrag = null;
      }
    },
    onHover: (cb) => subscribe(listeners.hover, cb),
    onDragIntent: (cb) => subscribe(listeners.drag, cb),
    onDragStart: (cb) => subscribe(listeners.dragStart, cb),
    onDragEnd: (cb) => subscribe(listeners.dragEnd, cb),
    onDragDenied: (cb) => subscribe(listeners.deny, cb),
    cancelDrag: () => endDrag(true),
    onEnergyDrag: (cb) => subscribe(listeners.energy, cb),
    onEntityDrop: (cb) => subscribe(listeners.entityDrop, cb),
    onCue: (cb) => subscribe(listeners.cue, cb),
    onPresentedChange: (cb) => subscribe(listeners.presented, cb),
    onAnchorsChanged: (cb) => subscribe(listeners.anchors, cb),
    setHighlights: (h) => {
      highlights = { selectable: new Set(h.selectable), selected: new Set(h.selected), targets: new Set(h.targets), evolvable: new Set(h.evolvable ?? []), floating: new Set(h.floating ?? []) };
      if (!highlights.targets.size) targetMat.opacity = 0.9;
      applyHighlights();
      rs.requestRender();
    },
    setFaceDown: (ids) => {
      faceDownIds = new Set(ids);
      for (const [id, v] of entities) v.setFaceDown(faceDownIds.has(id));
      rs.requestRender();
    },
    getAnchorRects: anchorRects,
    getOverlayRects: () => {
      const out: AnchorRect[] = [];
      for (const child of transitRoot.children) {
        if (!child.visible || child.name !== 'CardVisual') continue;
        const w = child.scale.x;
        if (w < 2) continue;
        const h = w * 1.4;
        const c = Math.abs(Math.cos(child.rotation.z));
        const sn = Math.abs(Math.sin(child.rotation.z));
        const bw = w * c + h * sn;
        const bh = w * sn + h * c;
        out.push({ x: child.position.x - bw / 2, y: -child.position.y - bh / 2, width: bw, height: bh });
      }
      return out;
    },
    getRegions: () => Object.fromEntries(Object.keys(profile.regions).map((k) => [k, frameRegion(profile, k, frame)])),
    getPresentedBoard: () => hudBoard,
    getLayout: () => frame,
    isPresenting: () => presenting,
    setActive: (on) => {
      active = on;
      boardVp.setActive(on);
      handVp.setActive(on);
      if (!on) transitVp.setActive(false);
    },
    diagnostics: () => ({
      profileId: profile.id,
      frame,
      entities: entities.size,
      handCards: handCards.size,
      liveProxies: proxies.size,
      hiddenKeys: [...hidden.keys()],
      presenting,
      activeSteps: director.activeSteps().map((s) => s.stepId),
      elapsedMs: director.elapsedMs(),
      lastPlan: lastPlan ? { steps: lastPlan.steps.length, totalMs: lastPlan.totalMs, barrier: lastPlan.barrier } : null,
      fit: fit.report,
    }),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      queueGen += 1;
      director.cancel();
      offTicker();
      offPointer();
      offResize();
      offCardBack();
      offEnergyOrbs();
      offSleeveArt();
      boardVp.dispose();
      handVp.dispose();
      transitVp.dispose();
      for (const set of Object.values(listeners)) set.clear();
      for (const p of [...proxies]) releaseProxy(p);
      for (const v of entities.values()) v.dispose();
      entities.clear();
      for (const hc of handCards.values()) hc.card.disposeVisual();
      handCards.clear();
      for (const rv of resolvingVisuals.values()) rv.disposeVisual();
      resolvingVisuals.clear();
      for (const role of ['HUMAN', 'NPC'] as const) {
        piles[role].deck?.disposeVisual();
        piles[role].discard?.disposeVisual();
        plates[role]?.dispose();
      }
      stadiumVisual?.disposeVisual();
      if (fan) {
        fan.mesh.removeFromParent();
        fan.mesh.dispose();
        fan.material.dispose();
        releaseTexture(rs, fan.lease);
        rs.resources.release('geo:card:front');
      }
      coins.MINE?.dispose();
      coins.THEIRS?.dispose();
      dropZone.dispose();
      rs.resources.release('mat:marker:TARGET');
      board.dispose();
      rs.requestRender();
    },
  };
}
