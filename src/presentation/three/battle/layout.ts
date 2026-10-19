// Layout da batalha por perfil (battle-layout.json; interface §23.5/§23.14; runtime §14.2–§14.9).
// Pixels CSS de design → mundo por projeção inversa no plano da mesa; câmera e sementes por perfil;
// fitBounds verifica (e só ajusta se necessário) aro, superfície e alvos dos oito slots.
import { PerspectiveCamera, Vector3 } from 'three';
import layoutJson from '../data/battle-layout.json';
import { ARENA, arenaRadiusPx } from './arena.ts';
import { mapRect, rectFromArray, type CssRect } from '../core/viewport.ts';

export type LayoutProfileId = 'desktop1080' | 'compact720';
export const LAYOUT_PROFILE_IDS: readonly LayoutProfileId[] = ['desktop1080', 'compact720'];

export const SLOT_ANCHOR_IDS = [
  'NPC_ACTIVE', 'HUMAN_ACTIVE', 'NPC_BENCH_0', 'NPC_BENCH_1', 'NPC_BENCH_2', 'HUMAN_BENCH_0', 'HUMAN_BENCH_1', 'HUMAN_BENCH_2',
] as const;
export type SlotAnchorId = (typeof SLOT_ANCHOR_IDS)[number];

export const ANCHOR_IDS = [
  ...SLOT_ANCHOR_IDS,
  'HUMAN_DECK_TOP', 'HUMAN_DISCARD', 'HUMAN_ENERGY_READY', 'HUMAN_ENERGY_NEXT', 'HUMAN_HAND', 'HUMAN_POINTS',
  'NPC_DECK_TOP', 'NPC_DISCARD', 'NPC_ENERGY_READY', 'NPC_ENERGY_NEXT', 'NPC_HAND', 'NPC_HAND_ENTRY', 'NPC_POINTS', 'STADIUM',
  'HUMAN_END_TURN',
] as const;
export type AnchorId = (typeof ANCHOR_IDS)[number];

/**
 * handPolicy (interface §23.5, layout OVERLAPPING_FAN): cartas grandes sempre sobrepostas, passo de
 * `fanStepRatio` da largura, inclinação até `maxFanTiltDegrees` nas pontas, base `bottomBleedPx` abaixo da
 * borda inferior (atrás da barra do jogador); a carta em foco sobe `focusLiftPx` (escala ≤ `focusScale`).
 */
export type HandPolicy = {
  readonly restCardSize: readonly [number, number];
  readonly maxCards: number;
  readonly layout: 'OVERLAPPING_FAN';
  readonly fanStepRatio: number;
  readonly maxFanTiltDegrees: number;
  readonly bottomBleedPx: number;
  readonly focusScale: number;
  readonly focusLiftPx: number;
};

export type BattleProfile = {
  readonly id: LayoutProfileId;
  readonly viewport: readonly [number, number];
  readonly camera: {
    readonly fovDegrees: number;
    readonly position: readonly [number, number, number];
    readonly lookAt: readonly [number, number, number];
    readonly near: number;
    readonly far: number;
  };
  readonly worldSeeds: Readonly<Record<SlotAnchorId, readonly [number, number, number]>>;
  readonly regions: Readonly<Record<string, CssRect>>;
  readonly slots: readonly { readonly id: SlotAnchorId; readonly center: readonly [number, number]; readonly size: readonly [number, number] }[];
  readonly handPolicy: HandPolicy;
  readonly pileCardSize: readonly [number, number];
  readonly energyToken: { readonly ready: number; readonly next: number };
  readonly npcBackCardSize: readonly [number, number];
  readonly mirrorCenter: readonly [number, number];
};

export const WORLD = {
  cardWidth: layoutJson.world.cardWidth,
  cardHeight: layoutJson.world.cardHeight,
  cardThickness: layoutJson.world.cardThickness,
  matWidth: layoutJson.world.matWidth,
  matHeight: layoutJson.world.matHeight,
  structureWidth: layoutJson.world.structureWidth,
  structureDepth: layoutJson.world.structureDepth,
  rimSide: layoutJson.world.rimSide,
  rimFrontBack: layoutJson.world.rimFrontBack,
} as const;

/** Altura das cartas sobre a mesa (centro do corpo), acima de playmat e guias — sem planos coplanares. */
export const TABLE_Y = {
  playmat: 0.002,
  guides: 0.005,
  card: 0.02,
} as const;

function triple(a: readonly number[]): readonly [number, number, number] {
  return [a[0] ?? 0, a[1] ?? 0, a[2] ?? 0];
}

function loadProfiles(): Readonly<Record<LayoutProfileId, BattleProfile>> {
  const out = {} as Record<LayoutProfileId, BattleProfile>;
  for (const raw of layoutJson.profiles) {
    const id = raw.id as LayoutProfileId;
    const regions: Record<string, CssRect> = {};
    for (const [k, v] of Object.entries(raw.regions)) regions[k] = rectFromArray(v);
    const seeds = {} as Record<SlotAnchorId, readonly [number, number, number]>;
    for (const sid of SLOT_ANCHOR_IDS) seeds[sid] = triple((raw.worldSeeds as Record<string, number[]>)[sid] ?? [0, 0, 1]);
    const back = (layoutJson.npcHandPolicy.backCardSize as Record<string, number[]>)[id] ?? [40, 56];
    const mirror = (layoutJson.piles.mirrorCenters as Record<string, number[]>)[id] ?? [0, 0];
    out[id] = {
      id,
      viewport: [raw.viewport[0] ?? 1920, raw.viewport[1] ?? 1080],
      camera: { fovDegrees: raw.camera.fovDegrees, position: triple(raw.camera.initialPosition), lookAt: triple(raw.camera.lookAt), near: raw.camera.near, far: raw.camera.far },
      worldSeeds: seeds,
      regions,
      slots: raw.slots.map((s) => ({ id: s.id as SlotAnchorId, center: [s.center[0] ?? 0, s.center[1] ?? 0], size: [s.size[0] ?? 0, s.size[1] ?? 0] })),
      handPolicy: {
        restCardSize: [raw.handPolicy.restCardSize[0] ?? 176, raw.handPolicy.restCardSize[1] ?? 246.4],
        maxCards: raw.handPolicy.maxCards, layout: 'OVERLAPPING_FAN', fanStepRatio: raw.handPolicy.fanStepRatio,
        maxFanTiltDegrees: raw.handPolicy.maxFanTiltDegrees, bottomBleedPx: raw.handPolicy.bottomBleedPx,
        focusScale: raw.handPolicy.focusScale, focusLiftPx: raw.handPolicy.focusLiftPx,
      },
      pileCardSize: [raw.pileCardSize[0] ?? 80, raw.pileCardSize[1] ?? 112],
      energyToken: { ready: raw.energyTokenDiameterPx.ready, next: raw.energyTokenDiameterPx.next },
      npcBackCardSize: [back[0] ?? 40, back[1] ?? 56],
      mirrorCenter: [mirror[0] ?? 0, mirror[1] ?? 0],
    };
  }
  return out;
}

export const PROFILES: Readonly<Record<LayoutProfileId, BattleProfile>> = loadProfiles();

export function region(profile: BattleProfile, key: string): CssRect {
  const r = profile.regions[key];
  if (!r) throw new Error(`battle-layout: região ausente ${key}`);
  return r;
}

// ------------------------------------------------------------------------------------- frame/escala

export type LayoutFrame = {
  readonly profileId: LayoutProfileId;
  /** Origem do conteúdo 16:9 no canvas (CSS) e escala uniforme aplicada às metas de design. */
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly width: number;
  readonly height: number;
  /** Abaixo de 0,75 em compact720, ou retrato: a batalha usa o modo 2D compacto (scalingRules). */
  readonly fallback2D: boolean;
};

/** scalingRules: perfil pela altura; escala min(w/W, h/H); conteúdo centrado (sobras viram margens). */
export function selectFrame(canvasWidth: number, canvasHeight: number, forced: LayoutProfileId | 'auto' = 'auto'): LayoutFrame {
  const profileId: LayoutProfileId = forced !== 'auto' ? forced : canvasHeight >= 900 ? 'desktop1080' : 'compact720';
  const [dw, dh] = PROFILES[profileId].viewport;
  const scale = Math.min(canvasWidth / dw, canvasHeight / dh);
  const width = dw * scale;
  const height = dh * scale;
  const portrait = canvasWidth < canvasHeight;
  return {
    profileId, scale, width, height,
    x: (canvasWidth - width) / 2,
    y: (canvasHeight - height) / 2,
    fallback2D: portrait || (profileId === 'compact720' && scale < 0.75),
  };
}

export function frameRegion(profile: BattleProfile, key: string, frame: Pick<LayoutFrame, 'x' | 'y' | 'scale'>): CssRect {
  return mapRect(region(profile, key), frame);
}

// --------------------------------------------------------------------------------------- projeção

export function createBoardCamera(profile: BattleProfile, aspect?: number): PerspectiveCamera {
  const board = region(profile, 'board');
  const cam = new PerspectiveCamera(profile.camera.fovDegrees, aspect ?? board.width / board.height, profile.camera.near, profile.camera.far);
  cam.position.set(...profile.camera.position);
  cam.up.set(0, 1, 0);
  cam.lookAt(new Vector3(...profile.camera.lookAt));
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
}

/** Ajusta near/far em torno da mesa (melhor precisão de profundidade que 0,1/80). */
export function tightenDepth(camera: PerspectiveCamera): void {
  const distance = camera.position.length();
  camera.near = Math.max(0.5, distance - 12);
  camera.far = distance + 20;
  camera.updateProjectionMatrix();
}

const tmp = new Vector3();

export function projectToRect(camera: PerspectiveCamera, point: Vector3, rect: CssRect): { x: number; y: number; z: number } {
  tmp.copy(point).project(camera);
  return { x: rect.x + ((tmp.x + 1) / 2) * rect.width, y: rect.y + ((1 - tmp.y) / 2) * rect.height, z: tmp.z };
}

/** Raio do ponto de tela (CSS no retângulo do viewport) até o plano y = planeY. */
export function unprojectToPlane(camera: PerspectiveCamera, sx: number, sy: number, rect: CssRect, planeY = 0): Vector3 | null {
  const ndcX = ((sx - rect.x) / rect.width) * 2 - 1;
  const ndcY = 1 - ((sy - rect.y) / rect.height) * 2;
  const near = new Vector3(ndcX, ndcY, -1).unproject(camera);
  const far = new Vector3(ndcX, ndcY, 1).unproject(camera);
  const dir = far.sub(near);
  if (Math.abs(dir.y) < 1e-9) return null;
  const t = (planeY - near.y) / dir.y;
  if (t < 0) return null;
  return near.add(dir.multiplyScalar(t));
}

/** Retângulo projetado (envolvente) de uma carta deitada com largura `scale` centrada em `center`. */
export function projectedCardRect(camera: PerspectiveCamera, center: Vector3, scale: number, rect: CssRect, aspect = WORLD.cardHeight / WORLD.cardWidth): CssRect {
  const hw = scale / 2;
  const hd = (scale * aspect) / 2;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [dx, dz] of [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]] as const) {
    const p = projectToRect(camera, new Vector3(center.x + dx, center.y, center.z + dz), rect);
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** Pixels por unidade de mundo (largura) numa posição da mesa. */
export function pxPerUnitAt(camera: PerspectiveCamera, x: number, z: number, rect: CssRect, y = 0): number {
  const a = projectToRect(camera, new Vector3(x - 0.5, y, z), rect);
  const b = projectToRect(camera, new Vector3(x + 0.5, y, z), rect);
  return Math.hypot(b.x - a.x, b.y - a.y);
}

// ------------------------------------------------------------------------------------------ âncoras

export type AnchorKind = 'SLOT' | 'PILE' | 'ENERGY' | 'POINTS' | 'HAND' | 'NPC_HAND' | 'STADIUM' | 'BUTTON';

export type AnchorWorld = {
  readonly id: AnchorId;
  readonly kind: AnchorKind;
  readonly x: number;
  readonly z: number;
  /** Largura (mundo) do objeto na âncora: carta, ficha (diâmetro) ou região. */
  readonly scale: number;
  /** Alvo em pixels de design (centro e tamanho) do perfil. */
  readonly design: CssRect;
};

function mirrorRect(rect: CssRect, center: readonly [number, number]): CssRect {
  return { x: 2 * center[0] - rect.x - rect.width, y: 2 * center[1] - rect.y - rect.height, width: rect.width, height: rect.height };
}

/** Centros de tela (design) das fichas pronta/próxima numa região de Energia. O NPC espelha. */
export function energyTokenCenters(profile: BattleProfile, side: 'HUMAN' | 'NPC'): { ready: { x: number; y: number }; next: { x: number; y: number } } {
  const r = region(profile, side === 'HUMAN' ? 'humanEnergy' : 'npcEnergy');
  const dr = profile.energyToken.ready;
  const dn = profile.energyToken.next;
  const gap = dr * 0.18;
  const pad = Math.max(0, (r.width - (dr + gap + dn)) / 2);
  const cy = r.y + r.height / 2;
  if (side === 'HUMAN') return { ready: { x: r.x + pad + dr / 2, y: cy }, next: { x: r.x + pad + dr + gap + dn / 2, y: cy } };
  return { ready: { x: r.x + r.width - pad - dr / 2, y: cy }, next: { x: r.x + r.width - pad - dr - gap - dn / 2, y: cy } };
}

/**
 * Leque compacto de versos do NPC no topo central, atrás da barra do adversário (npcHandPolicy): centros
 * de tela em design, centralizados na região `npcHand`. A entrada é a posição seguinte (próxima compra).
 */
export function npcFanCenters(profile: BattleProfile, count: number): { centers: { x: number; y: number }[]; entry: { x: number; y: number } } {
  const r = region(profile, 'npcHand');
  const [w] = profile.npcBackCardSize;
  const n = Math.max(0, count);
  const step = Math.min(w * 0.45, n > 1 ? (r.width - w) / (n - 1) : w);
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  const x0 = cx - ((n - 1) * step) / 2;
  const centers = Array.from({ length: n }, (_, i) => ({ x: x0 + i * step, y: cy }));
  return { centers, entry: { x: n ? x0 + n * step : cx, y: cy } };
}

/**
 * Superfície visual da mesa (interface §23.5): do meio da barra do adversário ao meio da barra do jogador,
 * na largura do campo — continua por trás das barras e da mão. Só visual: viewport do campo, câmera e
 * sementes não mudam. Retângulo de tela (design px).
 */
export function tableRect(profile: BattleProfile): CssRect {
  const board = region(profile, 'board');
  const hud = profile.regions.hud ?? board;
  const bar = profile.regions.humanBar ?? { x: board.x, y: board.y + board.height, width: board.width, height: 0 };
  const top = Math.min(board.y, hud.y + hud.height / 2);
  const bottom = Math.max(board.y + board.height, bar.y + bar.height / 2);
  return { x: board.x, y: top, width: board.width, height: bottom - top };
}

export type XZ = { readonly x: number; readonly z: number };

/** Retângulo arredondado de tela (design px) projetado de volta no plano da mesa (XZ), contorno fechado. */
export function screenRectOutlineWorld(profile: BattleProfile, camera: PerspectiveCamera, rect: CssRect, radiusPx: number, segments = 8, planeY = 0): XZ[] {
  const board = region(profile, 'board');
  const r = Math.max(0, Math.min(radiusPx, rect.width / 2, rect.height / 2));
  const pts: { x: number; y: number }[] = [];
  const corner = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= segments; i += 1) {
      const a = a0 + (i / segments) * (Math.PI / 2);
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
  };
  corner(rect.x + rect.width - r, rect.y + rect.height - r, 0);
  corner(rect.x + r, rect.y + rect.height - r, Math.PI / 2);
  corner(rect.x + r, rect.y + r, Math.PI);
  corner(rect.x + rect.width - r, rect.y + r, Math.PI * 1.5);
  return pts.map((p) => {
    const w = unprojectToPlane(camera, p.x, p.y, board, planeY) ?? new Vector3();
    return { x: w.x, z: w.z };
  });
}

export type TableGeometry = {
  /** Borda externa (aro) e superfície interna, como na mesa 2D (borda de 44 px, aro de 6 px). */
  readonly outer: readonly XZ[];
  readonly inner: readonly XZ[];
  /** Faixas do adversário (topo) e do jogador (rodapé): quatro cantos cada. */
  readonly bandFar: readonly XZ[];
  readonly bandNear: readonly XZ[];
  /** Z (mundo) das bordas distante/próxima e da linha central — para o gradiente distante/próximo. */
  readonly zFar: number;
  readonly zNear: number;
  readonly zCenter: number;
  /** Disco central (raio = ARENA.discK × largura do Ativo, no centro de espelho) e aro branco, como na mesa 2D. */
  readonly center: XZ;
  readonly circleRadius: number;
  readonly ringWidth: number;
  /** Linha central translúcida (quatro cantos), de borda a borda da superfície interna. */
  readonly midline: readonly XZ[];
  /**
   * Arena (gameplay-pocket §2; arena.ts): círculo de tela no centro de espelho que envolve os dois Bancos — metades
   * distante (adversário) e próxima (jogador), aro, filete externo e a faixa clara do centro —, no plano da mesa.
   * zTop/zBottom: Z do topo e da base do círculo (gradientes lineares no Z do mundo).
   */
  readonly arena: {
    readonly far: readonly XZ[]; readonly near: readonly XZ[];
    readonly rimOuter: readonly XZ[]; readonly rimInner: readonly XZ[]; readonly strokeOuter: readonly XZ[];
    readonly band: readonly XZ[];
    readonly zTop: number; readonly zBottom: number;
  };
};

export function tableGeometryWorld(profile: BattleProfile, camera: PerspectiveCamera, planeY = 0): TableGeometry {
  const t = tableRect(profile);
  const board = region(profile, 'board');
  const s = profile.viewport[1] / 1080;
  const rim = 6 * s;
  const radius = 44 * s;
  const inset = { x: t.x + rim, y: t.y + rim, width: t.width - 2 * rim, height: t.height - 2 * rim };
  const quad = (r: CssRect): XZ[] => [[r.x, r.y], [r.x + r.width, r.y], [r.x + r.width, r.y + r.height], [r.x, r.y + r.height]].map(([x, y]) => {
    const w = unprojectToPlane(camera, x!, y!, board, planeY) ?? new Vector3();
    return { x: w.x, z: w.z };
  });
  const zAt = (y: number) => (unprojectToPlane(camera, t.x + t.width / 2, y, board, planeY) ?? new Vector3()).z;
  const centerMarks = () => {
    const [cx, cy] = profile.mirrorCenter;
    const active = profile.slots.find((x) => x.id === 'HUMAN_ACTIVE')?.size[0] ?? 132;
    const r = ARENA.discK * active;
    const at = (x: number, y: number) => unprojectToPlane(camera, x, y, board, planeY) ?? new Vector3();
    const c = at(cx, cy);
    const radius = at(cx + r, cy).distanceTo(c);
    const ring = at(cx + r + 4 * s, cy).distanceTo(c) - radius;
    return { center: { x: c.x, z: c.z }, circleRadius: radius, ringWidth: ring, midline: quad({ x: inset.x, y: cy - 2 * s, width: inset.width, height: 4 * s }) };
  };
  const arena = () => {
    const [cx, cy] = profile.mirrorCenter;
    const radius = arenaRadiusPx(cx, cy, profile.slots.filter((x) => x.id.includes('_BENCH_')));
    const at = (x: number, y: number): XZ => {
      const w = unprojectToPlane(camera, x, y, board, planeY) ?? new Vector3();
      return { x: w.x, z: w.z };
    };
    const arc = (r: number, a0: number, a1: number, n: number): XZ[] =>
      Array.from({ length: n + 1 }, (_, i) => at(cx + r * Math.cos(a0 + ((a1 - a0) * i) / n), cy + r * Math.sin(a0 + ((a1 - a0) * i) / n)));
    const ring = (r: number) => arc(r, 0, Math.PI * 2, 96).slice(0, -1);
    return {
      // Tela com y para baixo: ângulos de π a 2π ficam acima do centro (lado do adversário).
      far: arc(radius, Math.PI, Math.PI * 2, 48),
      near: arc(radius, 0, Math.PI, 48),
      rimOuter: ring(radius + ARENA.rimPx * s),
      rimInner: ring(radius),
      strokeOuter: ring(radius + (ARENA.rimPx + ARENA.strokePx) * s),
      band: quad({ x: inset.x, y: cy - (ARENA.bandPx * s) / 2, width: inset.width, height: ARENA.bandPx * s }),
      zTop: at(cx, cy - radius).z,
      zBottom: at(cx, cy + radius).z,
    };
  };
  const bandH = 6 * s;
  return {
    arena: arena(),
    outer: screenRectOutlineWorld(profile, camera, t, radius, 8, planeY),
    inner: screenRectOutlineWorld(profile, camera, inset, radius - rim, 8, planeY),
    bandFar: quad({ x: t.x + t.width * 0.06, y: t.y + 30 * s, width: t.width * 0.88, height: bandH }),
    bandNear: quad({ x: t.x + t.width * 0.06, y: t.y + t.height - 28 * s - bandH, width: t.width * 0.88, height: bandH }),
    zFar: zAt(t.y),
    zNear: zAt(t.y + t.height),
    zCenter: zAt(profile.mirrorCenter[1]),
    ...centerMarks(),
  };
}

export function computeAnchors(profile: BattleProfile, camera: PerspectiveCamera = createBoardCamera(profile)): Readonly<Record<AnchorId, AnchorWorld>> {
  const board = region(profile, 'board');
  const out = {} as Record<AnchorId, AnchorWorld>;
  const centerOf = (r: CssRect) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
  const toWorld = (sx: number, sy: number) => unprojectToPlane(camera, sx, sy, board, TABLE_Y.card) ?? new Vector3(0, 0, 0);
  for (const slot of profile.slots) {
    const [x, z, scale] = profile.worldSeeds[slot.id];
    out[slot.id] = { id: slot.id, kind: 'SLOT', x, z, scale, design: { x: slot.center[0] - slot.size[0] / 2, y: slot.center[1] - slot.size[1] / 2, width: slot.size[0], height: slot.size[1] } };
  }
  const regionAnchor = (id: AnchorId, kind: AnchorKind, key: string, widthPx: number) => {
    const r = region(profile, key);
    const c = centerOf(r);
    const w = toWorld(c.x, c.y);
    const ppu = pxPerUnitAt(camera, w.x, w.z, board);
    out[id] = { id, kind, x: w.x, z: w.z, scale: widthPx / ppu, design: r };
  };
  regionAnchor('HUMAN_DECK_TOP', 'PILE', 'humanDeck', profile.pileCardSize[0]);
  regionAnchor('HUMAN_DISCARD', 'PILE', 'humanDiscard', profile.pileCardSize[0]);
  regionAnchor('NPC_DECK_TOP', 'PILE', 'npcDeck', profile.pileCardSize[0]);
  regionAnchor('NPC_DISCARD', 'PILE', 'npcDiscard', profile.pileCardSize[0]);
  regionAnchor('STADIUM', 'STADIUM', 'stadium', profile.pileCardSize[0]);
  regionAnchor('HUMAN_POINTS', 'POINTS', 'humanPoints', region(profile, 'humanPoints').width);
  regionAnchor('NPC_POINTS', 'POINTS', 'npcPoints', region(profile, 'npcPoints').width);
  regionAnchor('NPC_HAND', 'NPC_HAND', 'npcHand', profile.npcBackCardSize[0]);
  regionAnchor('HUMAN_HAND', 'HAND', 'hand', profile.handPolicy.restCardSize[0]);
  if (profile.regions.endTurn) regionAnchor('HUMAN_END_TURN', 'BUTTON', 'endTurn', region(profile, 'endTurn').width);
  else out.HUMAN_END_TURN = { id: 'HUMAN_END_TURN', kind: 'BUTTON', x: 0, z: 0, scale: 1, design: region(profile, 'actions') };
  for (const side of ['HUMAN', 'NPC'] as const) {
    const t = energyTokenCenters(profile, side);
    for (const [which, c, d] of [['READY', t.ready, profile.energyToken.ready], ['NEXT', t.next, profile.energyToken.next]] as const) {
      const id = `${side}_ENERGY_${which}` as AnchorId;
      const w = toWorld(c.x, c.y);
      out[id] = { id, kind: 'ENERGY', x: w.x, z: w.z, scale: d / pxPerUnitAt(camera, w.x, w.z, board), design: { x: c.x - d / 2, y: c.y - d / 2, width: d, height: d } };
    }
  }
  const entry = npcFanCenters(profile, 0).entry;
  const e = toWorld(entry.x, entry.y);
  out.NPC_HAND_ENTRY = {
    id: 'NPC_HAND_ENTRY', kind: 'NPC_HAND', x: e.x, z: e.z, scale: profile.npcBackCardSize[0] / pxPerUnitAt(camera, e.x, e.z, board),
    design: { x: entry.x - profile.npcBackCardSize[0] / 2, y: entry.y - profile.npcBackCardSize[1] / 2, width: profile.npcBackCardSize[0], height: profile.npcBackCardSize[1] },
  };
  return out;
}

/** Retângulos de região do NPC = espelho dos humanos (interface §23.5). Usado em testes de contrato. */
export function mirroredRegion(profile: BattleProfile, humanKey: string): CssRect {
  return mirrorRect(region(profile, humanKey), profile.mirrorCenter);
}

// --------------------------------------------------------------------------------------- fitBounds

export type FitReport = {
  readonly ok: boolean;
  readonly slotErrorsPx: Readonly<Record<SlotAnchorId, number>>;
  readonly maxSlotErrorPx: number;
  readonly widthErrorsPx: Readonly<Record<SlotAnchorId, number>>;
  readonly structureRect: CssRect;
  readonly surfaceRect: CssRect;
  readonly overflowPx: { readonly top: number; readonly bottom: number; readonly left: number; readonly right: number };
  readonly cardsOnSurface: boolean;
  readonly minSurfaceClearance: number;
  readonly cameraAdjusted: boolean;
};

function boundsOfRect(camera: PerspectiveCamera, w: number, d: number, rect: CssRect): CssRect {
  return projectedCardRect(camera, new Vector3(0, 0, 0), w, rect, d / w);
}

/** Margem cosmética do aro próximo em 720p (runtime §14.2: ≈14 px; tolerância de verificação 18 px). */
export const NEAR_RIM_ALLOWANCE_PX: Readonly<Record<LayoutProfileId, number>> = { desktop1080: 0, compact720: 18 };

export function fitReport(profile: BattleProfile, camera: PerspectiveCamera = createBoardCamera(profile), cameraAdjusted = false): FitReport {
  const board = region(profile, 'board');
  const slotErrorsPx = {} as Record<SlotAnchorId, number>;
  const widthErrorsPx = {} as Record<SlotAnchorId, number>;
  let maxErr = 0;
  let minClear = Infinity;
  for (const slot of profile.slots) {
    const [x, z, s] = profile.worldSeeds[slot.id];
    const p = projectToRect(camera, new Vector3(x, 0, z), board);
    const err = Math.hypot(p.x - slot.center[0], p.y - slot.center[1]);
    slotErrorsPx[slot.id] = err;
    maxErr = Math.max(maxErr, err);
    const r = projectedCardRect(camera, new Vector3(x, 0, z), s, board);
    widthErrorsPx[slot.id] = Math.abs(r.width - slot.size[0]);
    const clearX = WORLD.matWidth / 2 - (Math.abs(x) + s / 2);
    const clearZ = WORLD.matHeight / 2 - (Math.abs(z) + (s * WORLD.cardHeight) / 2);
    minClear = Math.min(minClear, clearX, clearZ);
  }
  const structureRect = boundsOfRect(camera, WORLD.structureWidth, WORLD.structureDepth, board);
  const surfaceRect = boundsOfRect(camera, WORLD.matWidth, WORLD.matHeight, board);
  const overflowPx = {
    top: Math.max(0, board.y - structureRect.y),
    bottom: Math.max(0, structureRect.y + structureRect.height - (board.y + board.height)),
    left: Math.max(0, board.x - structureRect.x),
    right: Math.max(0, structureRect.x + structureRect.width - (board.x + board.width)),
  };
  const surfaceInside = surfaceRect.y >= board.y && surfaceRect.y + surfaceRect.height <= board.y + board.height + 1e-6;
  const ok = maxErr <= 4 && minClear >= 0.08 && surfaceInside && overflowPx.top === 0 && overflowPx.left === 0 && overflowPx.right === 0
    && overflowPx.bottom <= NEAR_RIM_ALLOWANCE_PX[profile.id];
  return { ok, slotErrorsPx, maxSlotErrorPx: maxErr, widthErrorsPx, structureRect, surfaceRect, overflowPx, cardsOnSurface: minClear >= 0.08, minSurfaceClearance: minClear, cameraAdjusted };
}

/**
 * fitBounds (runtime §14.3): parte da câmera do perfil; se o aro não couber, aproxima/afasta até ±10%
 * recalculando sementes por projeção inversa dos alvos. Com as câmeras homologadas nada muda.
 */
export function fitBounds(profile: BattleProfile): { camera: PerspectiveCamera; seeds: Readonly<Record<SlotAnchorId, readonly [number, number, number]>>; report: FitReport } {
  const base = createBoardCamera(profile);
  const report = fitReport(profile, base);
  if (report.ok) return { camera: base, seeds: profile.worldSeeds, report };
  const board = region(profile, 'board');
  const target = new Vector3(...profile.camera.lookAt);
  const dir = new Vector3(...profile.camera.position).sub(target);
  for (const k of [1.02, 1.04, 1.06, 1.08, 1.1, 0.98, 0.96, 0.94, 0.92, 0.9]) {
    const cam = base.clone();
    cam.position.copy(target).add(dir.clone().multiplyScalar(k));
    cam.lookAt(target);
    cam.updateMatrixWorld(true);
    const seeds = {} as Record<SlotAnchorId, readonly [number, number, number]>;
    for (const slot of profile.slots) {
      const w = unprojectToPlane(cam, slot.center[0], slot.center[1], board, 0) ?? new Vector3();
      seeds[slot.id] = [w.x, w.z, slot.size[0] / pxPerUnitAt(cam, w.x, w.z, board)];
    }
    const candidate = { ...profile, worldSeeds: seeds };
    const r = fitReport(candidate, cam, true);
    if (r.ok) return { camera: cam, seeds, report: r };
  }
  return { camera: base, seeds: profile.worldSeeds, report };
}
