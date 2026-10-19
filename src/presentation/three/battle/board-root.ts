// BoardRoot (runtime §14.6): TableSurface estendida de barra a barra (aro claro), PlayerBand/OpponentBand,
// PlaymatSurface (crossfade de dois samplers), FunctionalZoneGuides e raízes de cartas/anexos/Energias/
// efeitos. Decoração fica fora da camada de picking; slots/pilhas têm hit proxies estáveis.
import {
  BufferGeometry, CircleGeometry, Color, DirectionalLight, Float32BufferAttribute, Group, HemisphereLight, Mesh, MeshBasicMaterial,
  Path, PlaneGeometry, RingGeometry, Shape, ShapeGeometry, ShaderMaterial, Vector2, type Material,
} from 'three';
import { ARENA, ARENA_COLORS } from './arena.ts';
import type { RenderSystem } from '../core/render-system.ts';
import { COLORS, mixHex } from '../core/tokens.ts';
import { roundedRectGeometry, roundedRingGeometry } from '../card/geometry.ts';
import { PICK_LAYER, type PickTarget } from '../card/card-visual.ts';
import { acquireCanvasTexture, releaseTexture, type TextureLease } from '../card/textures.ts';
import { TABLE_Y, WORLD, type AnchorId, type AnchorWorld, type TableGeometry, type XZ } from './layout.ts';
import { acquirePlaymatTexture, createPlaymatMaterial, playmatTint, type CosmeticVisualInput, type DisplayedPlaymat } from './playmat.ts';
import { coverBox4x3, createMatImageLayer, type MatImageStatus } from './mat-image.ts';
import { playmatKeyOf } from './playmat.ts';

export type SlotHighlight = 'NONE' | 'SELECTABLE' | 'TARGET' | 'SELECTED';

export type BoardRoot = {
  readonly root: Group;
  readonly cardsRoot: Group;
  readonly attachmentsRoot: Group;
  readonly energyRoot: Group;
  readonly pilesRoot: Group;
  readonly effectsRoot: Group;
  readonly hitMeshes: () => readonly Mesh[];
  readonly setAnchors: (anchors: Readonly<Record<AnchorId, AnchorWorld>>) => void;
  /** Superfície visual estendida (de barra a barra), recalculada quando o perfil muda. */
  readonly setTable: (table: TableGeometry) => void;
  /** Tapete exibido (procedural + imagem local opcional), com crossfade de `transitionMs`. */
  readonly setPlaymat: (display: DisplayedPlaymat, transitionMs: number) => void;
  /** Estado da imagem local exibida (none/loading/loaded/missing) — para o HUD HTML. */
  readonly matImageStatus: () => MatImageStatus;
  readonly playmatKey: () => string;
  readonly setTurnOwner: (role: 'HUMAN' | 'NPC', instant: boolean) => void;
  readonly setSlotHighlight: (anchorId: string, state: SlotHighlight) => void;
  readonly setIntro: (t: number) => void;
  readonly setVeil: (amount: number) => void;
  readonly update: (dtMs: number, timeMs: number) => boolean;
  readonly dispose: () => void;
};

/** Junta geometrias não indexadas (posição + uv) num único draw call. */
/**
 * Preenchimento em gradiente vertical (v = 0 → 1) entre duas cores, com uma segunda dupla “acesa” misturada por
 * `hot` (turno daquele lado) e alfa global (imagem local do tapete por baixo).
 */
function gradientMaterial(top: string, bottom: string, hotTop: string, hotBottom: string): ShaderMaterial {
  return new ShaderMaterial({
    name: 'ArenaGradient',
    uniforms: {
      cTop: { value: new Color(top) }, cBottom: { value: new Color(bottom) },
      hTop: { value: new Color(hotTop) }, hBottom: { value: new Color(hotBottom) },
      hot: { value: 0 }, alpha: { value: 1 },
    },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
uniform vec3 cTop; uniform vec3 cBottom; uniform vec3 hTop; uniform vec3 hBottom; uniform float hot; uniform float alpha;
varying vec2 vUv;
void main() {
  vec3 rest = mix(cTop, cBottom, vUv.y);
  vec3 lit = mix(hTop, hBottom, vUv.y);
  gl_FragColor = vec4(mix(rest, lit, hot), alpha);
  #include <colorspace_fragment>
}`,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

export function mergeSimple(geometries: readonly BufferGeometry[]): BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  for (const g of geometries) {
    const ng = g.index ? g.toNonIndexed() : g;
    const p = ng.getAttribute('position');
    const u = ng.getAttribute('uv');
    for (let i = 0; i < p.count; i += 1) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0);
    }
    if (ng !== g) ng.dispose();
    g.dispose();
  }
  const out = new BufferGeometry();
  out.setAttribute('position', new Float32BufferAttribute(pos, 3));
  out.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return out;
}

function flat(mesh: Mesh, y: number): Mesh {
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  return mesh;
}

const SLOT_IDS = new Set(['NPC_ACTIVE', 'HUMAN_ACTIVE', 'NPC_BENCH_0', 'NPC_BENCH_1', 'NPC_BENCH_2', 'HUMAN_BENCH_0', 'HUMAN_BENCH_1', 'HUMAN_BENCH_2']);
const PILE_IDS = new Set(['HUMAN_DECK_TOP', 'HUMAN_DISCARD', 'NPC_DECK_TOP', 'NPC_DISCARD', 'STADIUM']);

export function createBoardRoot(rs: RenderSystem, initialAnchors: Readonly<Record<AnchorId, AnchorWorld>>, initialDisplay: DisplayedPlaymat, onMatImageStatus: (status: MatImageStatus) => void = () => undefined): BoardRoot {
  const initialPlaymat = initialDisplay.playmat;
  const root = new Group();
  root.name = 'BoardRoot';
  const owned: { geometries: BufferGeometry[]; materials: Material[] } = { geometries: [], materials: [] };
  const keep = <T extends BufferGeometry | Material>(x: T): T => {
    if ('isMaterial' in x) owned.materials.push(x as Material);
    else owned.geometries.push(x as BufferGeometry);
    return x;
  };

  root.add(new HemisphereLight('#FFFFFF', '#DCE6F2', 2.4));
  const key = new DirectionalLight('#FFFFFF', 1.1);
  key.position.set(4, 14, 9);
  root.add(key);

  // TableSurface (interface §23.5): a superfície visual vai do meio da barra do adversário ao meio da barra do
  // jogador, na largura do campo (mesma silhueta da mesa 2D: borda de 44 px, aro claro de 6 px). O contorno
  // vem da projeção inversa do retângulo de tela no plano da mesa — só visual; câmera e sementes não mudam.
  // Fora dela o canvas é transparente (o fundo HTML aparece).
  // Entorno da arena (gameplay-pocket §2; arena.ts), como a mesa 2D (.b2-table/.b2-far): claro em cima e azul
  // embaixo, dividido na linha central. O tapete cosmético só tinge o entorno (playmatTint) e acrescenta um
  // decalque — a arena, a divisão e o disco central continuam. Transiciona com o tapete (mesmos dois samplers).
  let table: TableGeometry | null = null;
  const surfaceTexture = (playmat: CosmeticVisualInput): TextureLease => {
    const tint = playmatTint(playmat);
    const span = table ? table.zNear - table.zFar : 1;
    const fC = table ? Math.min(0.98, Math.max(0.02, (table.zCenter - table.zFar) / span)) : 0.45;
    const far = (c: string) => mixHex(c, tint.far, tint.k);
    const near = (c: string) => mixHex(c, tint.near, tint.k);
    return acquireCanvasTexture(rs, `board:surface:${tint.far}:${tint.near}:${tint.k}:${fC.toFixed(3)}`, 8, 512, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, far(ARENA_COLORS.outsideTop));
      g.addColorStop(fC, far(ARENA_COLORS.outsideCenter));
      g.addColorStop(fC, near(ARENA_COLORS.outsideNear));
      g.addColorStop(1, near(ARENA_COLORS.outsideBottom));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }, false);
  };
  let surfaceLease: TextureLease = surfaceTexture(initialPlaymat);
  let surfaceNext: TextureLease | null = null;
  const surfaceMat: ShaderMaterial = keep(createPlaymatMaterial(surfaceLease.texture));
  const rimMat = keep(new MeshBasicMaterial({ color: COLORS.rim, toneMapped: false }));
  const surface = new Mesh(new BufferGeometry(), surfaceMat);
  surface.name = 'TableSurface';
  surface.position.y = -0.006;
  const rimMesh = new Mesh(new BufferGeometry(), rimMat);
  rimMesh.name = 'TableRim';
  rimMesh.position.y = -0.007;
  root.add(rimMesh, surface);

  // Imagem local do tapete (interface §23.26): sobre a superfície de duas cores, sob decalque/círculo/guias.
  const matImage = createMatImageLayer(rs, onMatImageStatus);
  matImage.mesh.position.y = TABLE_Y.playmat - 0.0015;
  root.add(matImage.mesh);

  // Arena (gameplay-pocket §2): metade do adversário em coral e a do jogador clara dentro do círculo, aro branco com
  // filete lilás e a faixa clara do centro. O dono do turno acende a sua metade (`hot`). Decoração: fora do picking.
  const arenaFarMat = keep(gradientMaterial(ARENA_COLORS.farTop, ARENA_COLORS.farCenter, ARENA_COLORS.farHotTop, ARENA_COLORS.farHotCenter));
  const arenaNearMat = keep(gradientMaterial(ARENA_COLORS.nearCenter, ARENA_COLORS.nearBottom, ARENA_COLORS.nearHotCenter, ARENA_COLORS.nearHotBottom));
  const arenaFar = new Mesh(new BufferGeometry(), arenaFarMat);
  arenaFar.name = 'ArenaOpponentHalf';
  const arenaNear = new Mesh(new BufferGeometry(), arenaNearMat);
  arenaNear.name = 'ArenaPlayerHalf';
  const arenaRimMat = keep(new MeshBasicMaterial({ color: ARENA_COLORS.rim, transparent: true, depthWrite: false, toneMapped: false }));
  const arenaRim = new Mesh(new BufferGeometry(), arenaRimMat);
  arenaRim.name = 'ArenaRim';
  const arenaStrokeMat = keep(new MeshBasicMaterial({ color: ARENA_COLORS.stroke, transparent: true, depthWrite: false, toneMapped: false }));
  const arenaStroke = new Mesh(new BufferGeometry(), arenaStrokeMat);
  arenaStroke.name = 'ArenaStroke';
  const arenaBandMat = keep(new MeshBasicMaterial({ color: ARENA_COLORS.band, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
  const arenaBand = new Mesh(new BufferGeometry(), arenaBandMat);
  arenaBand.name = 'ArenaCenterBand';
  // Sobre a imagem local do tapete (-3) e sob o decalque (-2), o disco central e as guias (-1).
  arenaFar.renderOrder = -2.8;
  arenaNear.renderOrder = -2.8;
  arenaStroke.renderOrder = -2.7;
  arenaRim.renderOrder = -2.6;
  arenaBand.renderOrder = -2.5;
  root.add(arenaFar, arenaNear, arenaStroke, arenaRim, arenaBand);

  // Disco central atrás dos Ativos: branco com um disco interno lilás-acinzentado, aro branco e linha central
  // translúcida, como na mesa 2D (.b2-center/.b2-midline).
  const circleLease: TextureLease = acquireCanvasTexture(rs, `board:center-disc:${ARENA.innerK}`, 256, 256, (ctx, w, h) => {
    const r = w / 2;
    ctx.fillStyle = ARENA_COLORS.disc;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, r * ARENA.innerK);
    g.addColorStop(0, ARENA_COLORS.discInner);
    g.addColorStop(0.94, ARENA_COLORS.discInner);
    g.addColorStop(1, 'rgba(214,223,252,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, r * ARENA.innerK, 0, Math.PI * 2);
    ctx.fill();
  }, false);
  const circleMat = keep(new MeshBasicMaterial({ map: circleLease.texture, transparent: true, depthWrite: false, toneMapped: false }));
  const centerCircle = new Mesh(new BufferGeometry(), circleMat);
  centerCircle.name = 'CenterCircle';
  centerCircle.renderOrder = -1;
  const ringMat = keep(new MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }));
  const centerRing = new Mesh(new BufferGeometry(), ringMat);
  centerRing.name = 'CenterRing';
  centerRing.renderOrder = -1;
  const midlineMat = keep(new MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.75, depthWrite: false, toneMapped: false }));
  const midline = new Mesh(new BufferGeometry(), midlineMat);
  midline.name = 'Midline';
  midline.renderOrder = -1;
  root.add(centerCircle, centerRing, midline);

  // Faixas próxima (humano, playerBand) e distante (NPC, opponentBand), nas bordas da superfície.
  const playerBandMat = keep(new MeshBasicMaterial({ color: COLORS.playerBand, transparent: true, toneMapped: false }));
  const opponentBandMat = keep(new MeshBasicMaterial({ color: COLORS.opponentBand, transparent: true, toneMapped: false }));
  const playerBand = new Mesh(new BufferGeometry(), playerBandMat);
  playerBand.name = 'PlayerBand';
  const opponentBand = new Mesh(new BufferGeometry(), opponentBandMat);
  opponentBand.name = 'OpponentBand';
  // O turno agora acende a metade da arena (gameplay-pocket §2): as faixas finas das bordas ficam ocultas.
  playerBand.visible = false;
  opponentBand.visible = false;
  root.add(playerBand, opponentBand);
  const bandCenters = { near: { x: 0, z: 0 }, far: { x: 0, z: 0 } };

  const shapeOf = (pts: readonly XZ[]): Shape => {
    const sh = new Shape();
    pts.forEach((p, i) => (i === 0 ? sh.moveTo(p.x, -p.z) : sh.lineTo(p.x, -p.z)));
    sh.closePath();
    return sh;
  };
  const flatShape = (shape: Shape, y: number): BufferGeometry => {
    const g = new ShapeGeometry(shape, 1);
    g.rotateX(-Math.PI / 2);
    g.translate(0, y, 0);
    return g;
  };
  /** Polígono plano com v linear no Z do mundo entre z0 (v = 0) e z1 (v = 1): gradiente sem distorção. */
  const gradientShape = (pts: readonly XZ[], y: number, z0: number, z1: number): BufferGeometry => {
    const g = flatShape(shapeOf(pts), y);
    const pos = g.getAttribute('position');
    const uvs = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i += 1) {
      uvs[i * 2] = 0.5;
      uvs[i * 2 + 1] = Math.min(1, Math.max(0, (pos.getZ(i) - z0) / ((z1 - z0) || 1e-6)));
    }
    g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    return g;
  };
  const ringShape = (outer: readonly XZ[], inner: readonly XZ[], y: number): BufferGeometry => {
    const sh = shapeOf(outer);
    sh.holes.push(new Path(inner.map((p) => new Vector2(p.x, -p.z)).reverse()));
    return flatShape(sh, y);
  };
  /** Faixa com o centro na origem do mesh (a espessura anima em escala Z). */
  const bandGeometry = (pts: readonly XZ[], y: number, center: { x: number; z: number }): BufferGeometry => {
    const c = { x: pts.reduce((a, p) => a + p.x, 0) / pts.length, z: pts.reduce((a, p) => a + p.z, 0) / pts.length };
    center.x = c.x;
    center.z = c.z;
    return flatShape(shapeOf(pts.map((p) => ({ x: p.x - c.x, z: p.z - c.z }))), y);
  };

  function setTable(t: TableGeometry): void {
    table = t;
    // As frações do gradiente dependem da geometria: refaz a textura da superfície do tapete atual.
    const fresh = surfaceTexture(current);
    releaseTexture(rs, surfaceLease);
    surfaceLease = fresh;
    surfaceMat.uniforms.mapA!.value = fresh.texture;
    if (!surfaceNext) surfaceMat.uniforms.mapB!.value = fresh.texture;
    surface.geometry.dispose();
    rimMesh.geometry.dispose();
    playerBand.geometry.dispose();
    opponentBand.geometry.dispose();
    const outerShape = shapeOf(t.outer);
    outerShape.holes.push(new Path(t.inner.map((p) => new Vector2(p.x, -p.z)).reverse()));
    rimMesh.geometry = flatShape(outerShape, 0);
    const inner = flatShape(shapeOf(t.inner), 0);
    // UV v linear no Z do mundo (topo distante = 1): interpolação correta em triângulos grandes.
    const pos = inner.getAttribute('position');
    const uvs = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i += 1) {
      uvs[i * 2] = 0.5;
      uvs[i * 2 + 1] = Math.min(1, Math.max(0, 1 - (pos.getZ(i) - t.zFar) / Math.max(1e-6, t.zNear - t.zFar)));
    }
    inner.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    surface.geometry = inner;
    // Caixa 4:3 que cobre a superfície interna (como a caixa 2D com `cover`): a imagem não distorce.
    const xs = t.inner.map((p) => p.x);
    const zs = t.inner.map((p) => p.z);
    matImage.setGeometry(flatShape(shapeOf(t.inner), 0), coverBox4x3(Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)));
    for (const m of [centerCircle, centerRing, midline, arenaFar, arenaNear, arenaRim, arenaStroke, arenaBand]) m.geometry.dispose();
    const a = t.arena;
    const zMid = t.zCenter;
    arenaFar.geometry = gradientShape(a.far, TABLE_Y.playmat - 0.0012, a.zTop, zMid);
    arenaNear.geometry = gradientShape(a.near, TABLE_Y.playmat - 0.0012, zMid, a.zBottom);
    arenaStroke.geometry = ringShape(a.strokeOuter, a.rimOuter, TABLE_Y.playmat - 0.001);
    arenaRim.geometry = ringShape(a.rimOuter, a.rimInner, TABLE_Y.playmat - 0.0009);
    arenaBand.geometry = flatShape(shapeOf(a.band), TABLE_Y.playmat - 0.0008);
    const disc = new CircleGeometry(t.circleRadius, 64);
    disc.rotateX(-Math.PI / 2);
    disc.translate(t.center.x, TABLE_Y.playmat + 0.0015, t.center.z);
    centerCircle.geometry = disc;
    const ring = new RingGeometry(t.circleRadius, t.circleRadius + t.ringWidth, 96);
    ring.rotateX(-Math.PI / 2);
    ring.translate(t.center.x, TABLE_Y.playmat + 0.002, t.center.z);
    centerRing.geometry = ring;
    midline.geometry = flatShape(shapeOf(t.midline), TABLE_Y.playmat + 0.0018);
    playerBand.geometry = bandGeometry(t.bandNear, 0, bandCenters.near);
    opponentBand.geometry = bandGeometry(t.bandFar, 0, bandCenters.far);
    playerBand.position.set(bandCenters.near.x, 0.001, bandCenters.near.z);
    opponentBand.position.set(bandCenters.far.x, 0.001, bandCenters.far.z);
  }

  // PlaymatSurface.
  let current = initialPlaymat;
  let currentLease = acquirePlaymatTexture(rs, initialPlaymat);
  let nextLease: TextureLease | null = null;
  let fade: { t: number; duration: number } | null = null;
  const playmatMat: ShaderMaterial = keep(createPlaymatMaterial(currentLease.texture, { transparent: true }));
  /** Conclui a transição em curso (no máximo duas texturas simultâneas por material). */
  function finishFade(): void {
    if (nextLease) {
      releaseTexture(rs, currentLease);
      currentLease = nextLease;
      nextLease = null;
    }
    if (surfaceNext) {
      releaseTexture(rs, surfaceLease);
      surfaceLease = surfaceNext;
      surfaceNext = null;
    }
    playmatMat.uniforms.mapA!.value = currentLease.texture;
    playmatMat.uniforms.mapB!.value = currentLease.texture;
    playmatMat.uniforms.mixT!.value = 0;
    surfaceMat.uniforms.mapA!.value = surfaceLease.texture;
    surfaceMat.uniforms.mapB!.value = surfaceLease.texture;
    surfaceMat.uniforms.mixT!.value = 0;
    fade = null;
  }
  const playmat = flat(new Mesh(keep(roundedRectGeometry(WORLD.matWidth, WORLD.matHeight, 0.42, 10)), playmatMat), TABLE_Y.playmat);
  playmat.name = 'PlaymatSurface';
  playmat.renderOrder = -2;
  root.add(playmat);

  // Véu de atenuação do cut-in (20–30%), sobre a mesa e sob as cartas em trânsito. Clareia em direção à cor
  // do canvas (nunca escurece a tela) e por isso não marca a borda do viewport do tabuleiro.
  const veilMat = keep(new MeshBasicMaterial({ color: COLORS.canvas, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  const veil = flat(new Mesh(keep(new PlaneGeometry(80, 60)), veilMat), 0.9);
  veil.renderOrder = 50;
  veil.visible = false;
  root.add(veil);

  const guides = new Group();
  guides.name = 'FunctionalZoneGuides';
  const cardsRoot = new Group();
  cardsRoot.name = 'PublicCardsRoot';
  const attachmentsRoot = new Group();
  attachmentsRoot.name = 'AttachmentsRoot';
  const energyRoot = new Group();
  energyRoot.name = 'EnergyZonesRoot';
  const pilesRoot = new Group();
  pilesRoot.name = 'PilesRoot';
  const effectsRoot = new Group();
  effectsRoot.name = 'BoardEffectsRoot';
  root.add(guides, pilesRoot, cardsRoot, attachmentsRoot, energyRoot, effectsRoot);

  const guideMat = keep(new MeshBasicMaterial({ color: COLORS.boardLine, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }));
  // Preenchimento claro dos slots (como o slot vazio 2D: branco 0,22) — legível nas duas metades.
  const slotFillMat = keep(new MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.2, depthWrite: false, toneMapped: false }));
  const guideSoftMat = keep(new MeshBasicMaterial({ color: COLORS.boardLine, transparent: true, opacity: 0.45, depthWrite: false, toneMapped: false }));
  const hitMat = keep(new MeshBasicMaterial({ visible: false }));
  const highlightMats: Record<Exclude<SlotHighlight, 'NONE'>, MeshBasicMaterial> = {
    SELECTABLE: keep(new MeshBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false })),
    TARGET: keep(new MeshBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false })),
    SELECTED: keep(new MeshBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: 1, depthWrite: false, toneMapped: false })),
  };
  let guideGeometries: BufferGeometry[] = [];
  let hits: Mesh[] = [];
  const highlightMeshes = new Map<string, Mesh>();
  const highlightState = new Map<string, SlotHighlight>();

  function buildGuides(anchors: Readonly<Record<AnchorId, AnchorWorld>>): void {
    for (const g of guideGeometries) g.dispose();
    guideGeometries = [];
    guides.clear();
    hits = [];
    highlightMeshes.clear();
    const strong: BufferGeometry[] = [];
    const soft: BufferGeometry[] = [];
    const fills: BufferGeometry[] = [];
    for (const a of Object.values(anchors)) {
      if (!SLOT_IDS.has(a.id) && !PILE_IDS.has(a.id)) continue;
      const w = a.scale * 1.08;
      const h = a.scale * 1.4 * 1.06;
      const ring = roundedRingGeometry(w, h, a.scale * 0.08, Math.max(0.025, a.scale * 0.022), 5);
      ring.rotateX(-Math.PI / 2);
      ring.translate(a.x, TABLE_Y.guides, a.z);
      (SLOT_IDS.has(a.id) ? strong : soft).push(ring);
      if (SLOT_IDS.has(a.id)) {
        const fill = roundedRectGeometry(w, h, a.scale * 0.08, 5);
        fill.rotateX(-Math.PI / 2);
        fill.translate(a.x, TABLE_Y.guides - 0.0005, a.z);
        fills.push(fill);
      }
      const hl = new Mesh(roundedRingGeometry(w + a.scale * 0.06, h + a.scale * 0.06, a.scale * 0.1, a.scale * 0.07, 5), highlightMats.TARGET);
      guideGeometries.push(hl.geometry);
      flat(hl, TABLE_Y.guides + 0.001);
      hl.position.x = a.x;
      hl.position.z = a.z;
      hl.visible = false;
      hl.renderOrder = 3;
      highlightMeshes.set(a.id, hl);
      guides.add(hl);
      const hitGeo = new PlaneGeometry(w, h);
      guideGeometries.push(hitGeo);
      const hit = flat(new Mesh(hitGeo, hitMat), TABLE_Y.guides);
      hit.position.x = a.x;
      hit.position.z = a.z;
      const target: PickTarget = SLOT_IDS.has(a.id) ? { kind: 'SLOT', anchorId: a.id } : { kind: 'PILE', anchorId: a.id };
      hit.userData.pick = target;
      hit.layers.enable(PICK_LAYER);
      hits.push(hit);
      guides.add(hit);
    }
    // Fichas de Energia pronta: alvo de picking (PILE *_ENERGY_READY, como a mesa 2D) e anel de destaque.
    for (const id of ['HUMAN_ENERGY_READY', 'NPC_ENERGY_READY'] as const) {
      const a = anchors[id];
      if (!a) continue;
      const hl = new Mesh(new RingGeometry(a.scale * 0.56, a.scale * 0.68, 40), highlightMats.TARGET);
      guideGeometries.push(hl.geometry);
      flat(hl, TABLE_Y.guides + 0.012);
      hl.position.x = a.x;
      hl.position.z = a.z;
      hl.visible = false;
      hl.renderOrder = 7;
      highlightMeshes.set(id, hl);
      guides.add(hl);
      const hitGeo = new CircleGeometry(a.scale * 0.6, 20);
      guideGeometries.push(hitGeo);
      const hit = flat(new Mesh(hitGeo, hitMat), TABLE_Y.guides);
      hit.position.x = a.x;
      hit.position.z = a.z;
      hit.userData.pick = { kind: 'PILE', anchorId: id } satisfies PickTarget;
      hit.layers.enable(PICK_LAYER);
      hits.push(hit);
      guides.add(hit);
    }
    const fillMesh = new Mesh(mergeSimple(fills), slotFillMat);
    fillMesh.renderOrder = -1;
    const strongMesh = new Mesh(mergeSimple(strong), guideMat);
    const softMesh = new Mesh(mergeSimple(soft), guideSoftMat);
    guideGeometries.push(fillMesh.geometry, strongMesh.geometry, softMesh.geometry);
    guides.add(fillMesh, strongMesh, softMesh);
    for (const [id, state] of highlightState) applyHighlight(id, state);
  }

  function applyHighlight(id: string, state: SlotHighlight): void {
    const mesh = highlightMeshes.get(id);
    if (!mesh) return;
    mesh.visible = state !== 'NONE';
    if (state !== 'NONE') mesh.material = highlightMats[state];
  }

  buildGuides(initialAnchors);

  let bandTarget = { human: 1, npc: 0.55 };
  let band = { human: 1, npc: 0.55 };
  let intro = 1;

  const applyBands = () => {
    playerBandMat.opacity = band.human;
    opponentBandMat.opacity = band.npc;
    playerBand.scale.z = 0.8 + 0.6 * band.human;
    opponentBand.scale.z = 0.8 + 0.6 * band.npc;
    // Dono do turno: a sua metade da arena acende (0,55 → 1 vira 0 → 1).
    arenaNearMat.uniforms.hot!.value = Math.max(0, (band.human - 0.55) / 0.45);
    arenaFarMat.uniforms.hot!.value = Math.max(0, (band.npc - 0.55) / 0.45);
  };
  applyBands();

  return {
    root,
    cardsRoot,
    attachmentsRoot,
    energyRoot,
    pilesRoot,
    effectsRoot,
    hitMeshes: () => hits,
    setAnchors: buildGuides,
    setTable,
    setPlaymat: (display, transitionMs) => {
      matImage.show(display.image, transitionMs);
      // Com a imagem local do tapete, a arena vira uma película por cima dela (a arte continua visível).
      const alpha = display.image ? 0.38 : 1;
      arenaFarMat.uniforms.alpha!.value = alpha;
      arenaNearMat.uniforms.alpha!.value = alpha;
      const playmat = display.playmat;
      const nextKey = playmatKeyOf(playmat);
      if (nextKey === playmatKeyOf(current) && !fade) return;
      if (fade && nextLease) finishFade();
      current = playmat;
      const lease = acquirePlaymatTexture(rs, playmat);
      const surf = surfaceTexture(playmat);
      if (transitionMs <= 0) {
        releaseTexture(rs, currentLease);
        releaseTexture(rs, surfaceLease);
        currentLease = lease;
        surfaceLease = surf;
        for (const [m, t] of [[playmatMat, lease], [surfaceMat, surf]] as const) {
          m.uniforms.mapA!.value = t.texture;
          m.uniforms.mapB!.value = t.texture;
          m.uniforms.mixT!.value = 0;
        }
        return;
      }
      nextLease = lease;
      surfaceNext = surf;
      for (const [m, t] of [[playmatMat, lease], [surfaceMat, surf]] as const) {
        m.uniforms.mapB!.value = t.texture;
        m.uniforms.mixT!.value = 0;
      }
      fade = { t: 0, duration: transitionMs };
    },
    playmatKey: () => playmatKeyOf(current),
    matImageStatus: () => matImage.status(),
    setTurnOwner: (role, instant) => {
      bandTarget = role === 'HUMAN' ? { human: 1, npc: 0.55 } : { human: 0.55, npc: 1 };
      if (instant) {
        band = { ...bandTarget };
        applyBands();
      }
    },
    setSlotHighlight: (id, state) => {
      highlightState.set(id, state);
      applyHighlight(id, state);
    },
    setIntro: (t) => {
      intro = Math.min(1, Math.max(0, t));
      root.position.y = -0.6 * (1 - intro);
      root.scale.setScalar(0.96 + 0.04 * intro);
    },
    setVeil: (amount) => {
      veilMat.opacity = Math.min(0.45, Math.max(0, amount * 1.6));
      veil.visible = veilMat.opacity > 0.001;
    },
    update: (dtMs) => {
      let animating = matImage.update(dtMs);
      if (fade && nextLease) {
        fade.t += dtMs;
        const k = Math.min(1, fade.t / fade.duration);
        playmatMat.uniforms.mixT!.value = k;
        surfaceMat.uniforms.mixT!.value = k;
        if (k >= 1) finishFade();
        else animating = true;
      }
      const a = 1 - Math.exp(-dtMs / 90);
      const before = band.human + band.npc;
      band = { human: band.human + (bandTarget.human - band.human) * a, npc: band.npc + (bandTarget.npc - band.npc) * a };
      if (Math.abs(band.human - bandTarget.human) + Math.abs(band.npc - bandTarget.npc) > 0.002) animating = true;
      else band = { ...bandTarget };
      if (Math.abs(before - (band.human + band.npc)) > 1e-6 || animating) applyBands();
      return animating;
    },
    dispose: () => {
      releaseTexture(rs, surfaceLease);
      releaseTexture(rs, surfaceNext);
      releaseTexture(rs, circleLease);
      matImage.dispose();
      for (const m of [surface, rimMesh, playerBand, opponentBand, centerCircle, centerRing, midline, arenaFar, arenaNear, arenaRim, arenaStroke, arenaBand]) m.geometry.dispose();
      releaseTexture(rs, currentLease);
      releaseTexture(rs, nextLease);
      for (const g of guideGeometries) g.dispose();
      for (const g of owned.geometries) g.dispose();
      for (const m of owned.materials) m.dispose();
      root.removeFromParent();
    },
  };
}
