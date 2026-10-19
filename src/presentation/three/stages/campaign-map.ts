// Palco `campaign-map` (runtime §12.4; interface §20): câmera ortográfica inclinada sobre oito pequenas
// ilhas-diorama (Prólogo/academia, seis capítulos, Final), caminhos principal/opcional do grafo real e
// CampaignNodeVisual com forma por tipo e estados LOCKED/AVAILABLE/IN_PROGRESS/CLEARED/MASTERED (forma +
// adorno, nunca só cor). Pan por arrasto em área vazia, zoom limitado, clique → nodeId. Os botões
// semânticos e rótulos ficam no HTML (getNodeRects); a cena não decide progresso.
import {
  BoxGeometry, CylinderGeometry, ExtrudeGeometry, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, OctahedronGeometry,
  OrthographicCamera, RingGeometry, Shape, TorusGeometry, Vector3, type BufferGeometry, type Material, type Object3D,
} from 'three';
import type { CampaignNode, NodeKind } from '../../../content/types.ts';
import type { NodeStatus } from '../../../domain/campaign/progress.ts';
import type { RenderSystem } from '../core/render-system.ts';
import { COLORS, mixHex } from '../core/tokens.ts';
import type { CssRect } from '../core/viewport.ts';
import { PICK_LAYER } from '../card/card-visual.ts';
import { buildIslandGeometry, colorGeometry, mergeColored } from './dioramas.ts';
import {
  ISLAND_CENTERS, MAP_ELEVATION_DEG, boundsCenter, clampMapView, fitOrthoHalfHeight, islandBounds, mapEdges, nodeWorld, panDelta, unionBounds,
  type Bounds, type MapView, type XZ,
} from './map-layout.ts';
import { approach, createPanelStage, dragTracker, type StageBackground } from './stage-base.ts';
import { CHAPTER_ORDER, themeOf, type ChapterTheme } from './themes.ts';

export type MapNodeInput = Pick<CampaignNode, 'nodeId' | 'chapterId' | 'kind' | 'title' | 'essential' | 'prerequisites' | 'map'>;
export type MapStatuses = ReadonlyMap<string, NodeStatus> | Readonly<Record<string, NodeStatus>>;
export type MapPick = { readonly kind: 'NODE'; readonly nodeId: string } | { readonly kind: 'CHAPTER'; readonly chapterId: string };

export type CampaignMapOptions = {
  readonly rect?: CssRect;
  readonly nodes: readonly MapNodeInput[];
  readonly statuses?: MapStatuses;
  readonly selected?: string | null;
  /** Capítulo em foco (tela S20) ou nulo (mapa geral S19). */
  readonly focusChapter?: string | null;
  readonly reducedMotion?: boolean;
  readonly background?: StageBackground;
  readonly order?: number;
  /** Roda só faz zoom depois de um clique no palco (intenção), por padrão (interface §20.2). */
  readonly wheelZoom?: 'FOCUSED' | 'ALWAYS' | 'NEVER';
  readonly chapterThemes?: Readonly<Record<string, ChapterTheme>>;
};

export type CampaignMapStage = {
  readonly setRect: (rect: CssRect) => void;
  readonly setActive: (active: boolean) => void;
  readonly setNodes: (nodes: readonly MapNodeInput[]) => void;
  readonly setStatuses: (statuses: MapStatuses) => void;
  readonly setSelected: (nodeId: string | null) => void;
  /** "Centralizar progresso": leva o nó ao centro (mantém zoom de capítulo ou mais próximo). */
  readonly focusNode: (nodeId: string, animate?: boolean) => void;
  /** Aproxima a câmera do diorama (S20); nulo = enquadramento geral (S19). */
  readonly focusChapter: (chapterId: string | null, animate?: boolean) => void;
  readonly zoomBy: (factor: number) => void;
  readonly panBy: (dxPx: number, dyPx: number) => void;
  readonly onPick: (cb: (pick: MapPick) => void) => () => void;
  readonly onHover: (cb: (pick: MapPick | null) => void) => () => void;
  /** Câmera mudou (pan/zoom/foco): a UI reposiciona botões/rótulos HTML. */
  readonly onViewChange: (cb: () => void) => () => void;
  /** Centro e caixa projetada (CSS do canvas) de cada nó, para a camada HTML acessível. */
  readonly getNodeRects: () => Record<string, CssRect>;
  readonly getChapterRects: () => Record<string, CssRect>;
  readonly setReducedMotion: (on: boolean) => void;
  readonly diagnostics: () => { readonly nodes: number; readonly islands: number; readonly view: MapView };
  readonly dispose: () => void;
};

const STATUS_DEFAULT: NodeStatus = 'LOCKED';
const LOCKED_ICON = '#B4C0CC';
const LOCKED_BASE = '#E4EAF0';
const GOLD = '#F6CE3D';

/** Forma do ícone por tipo de nó (mesmas silhuetas da versão SVG equivalente). */
export function nodeShape(kind: NodeKind): Shape {
  const s = new Shape();
  const star = (points: number, outer: number, inner: number) => {
    for (let i = 0; i < points * 2; i += 1) {
      const r = i % 2 === 0 ? outer : inner;
      const a = Math.PI / 2 + (i * Math.PI) / points;
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    s.closePath();
  };
  const poly = (n: number, r: number, rot: number) => {
    for (let i = 0; i < n; i += 1) {
      const a = rot + (i * Math.PI * 2) / n;
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    s.closePath();
  };
  switch (kind) {
    case 'TUTORIAL': {
      const r = 0.07;
      const h = 0.27;
      s.moveTo(-h + r, -h);
      s.lineTo(h - r, -h);
      s.quadraticCurveTo(h, -h, h, -h + r);
      s.lineTo(h, h - r);
      s.quadraticCurveTo(h, h, h - r, h);
      s.lineTo(-h + r, h);
      s.quadraticCurveTo(-h, h, -h, h - r);
      s.lineTo(-h, -h + r);
      s.quadraticCurveTo(-h, -h, -h + r, -h);
      break;
    }
    case 'DUEL':
      s.absarc(0, 0, 0.3, 0, Math.PI * 2, false);
      break;
    case 'PUZZLE':
      poly(4, 0.36, Math.PI / 2);
      break;
    case 'DISCOVERY':
      star(5, 0.36, 0.16);
      break;
    case 'ELITE':
      poly(6, 0.32, Math.PI / 2);
      break;
    case 'BOSS':
      s.moveTo(-0.36, -0.24);
      s.lineTo(0.36, -0.24);
      s.lineTo(0.36, 0.16);
      s.lineTo(0.18, 0.02);
      s.lineTo(0, 0.3);
      s.lineTo(-0.18, 0.02);
      s.lineTo(-0.36, 0.16);
      s.closePath();
      break;
    case 'FINAL':
    default:
      // Escudo de troféu: topo reto, base em ponta.
      s.moveTo(-0.34, 0.32);
      s.lineTo(0.34, 0.32);
      s.lineTo(0.34, -0.02);
      s.quadraticCurveTo(0.3, -0.3, 0, -0.42);
      s.quadraticCurveTo(-0.3, -0.3, -0.34, -0.02);
      s.closePath();
      break;
  }
  return s;
}

function statusOf(statuses: MapStatuses, id: string): NodeStatus {
  if (statuses instanceof Map) return statuses.get(id) ?? STATUS_DEFAULT;
  return (statuses as Readonly<Record<string, NodeStatus>>)[id] ?? STATUS_DEFAULT;
}

type NodeVisual = {
  readonly node: MapNodeInput;
  readonly group: Group;
  readonly base: XZ;
  status: NodeStatus;
  lift: number;
  scale: number;
  /** Pedestal + ícone + adornos do estado num único mesh com cores por vértice (um draw call por nó). */
  readonly body: Mesh;
  readonly pulse: Mesh;
};

export function createCampaignMapStage(rs: RenderSystem, options: CampaignMapOptions): CampaignMapStage {
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  const stage = createPanelStage(rs, { id: 'campaign-map', camera, rect: options.rect, background: options.background ?? { gradient: ['#FFFFFF', '#E8F2FB'] }, order: options.order ?? 20 });
  const themes = options.chapterThemes ?? null;
  const theme = (id: string) => themes?.[id] ?? themeOf(id);
  let reduced = options.reducedMotion ?? false;
  let nodes: readonly MapNodeInput[] = options.nodes;
  let statuses: MapStatuses = options.statuses ?? new Map();
  let selected: string | null = options.selected ?? null;
  let hovered: string | null = null;
  const wheelMode = options.wheelZoom ?? 'FOCUSED';
  let engaged = false;

  const root = new Group();
  root.name = 'CampaignMapRoot';
  stage.scene.add(root);
  const islandsRoot = new Group();
  const pathsRoot = new Group();
  const nodesRoot = new Group();
  root.add(islandsRoot, pathsRoot, nodesRoot);

  // Recursos compartilhados (geometria por tipo, material por cor).
  const geoCache = new Map<string, BufferGeometry>();
  const matCache = new Map<string, Material>();
  const geo = (key: string, make: () => BufferGeometry) => {
    let g = geoCache.get(key);
    if (!g) {
      g = make();
      geoCache.set(key, g);
    }
    return g;
  };
  const basic = (color: string, opacity = 1) => {
    const key = `b:${color}:${opacity}`;
    let m = matCache.get(key);
    if (!m) {
      m = new MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, toneMapped: false });
      matCache.set(key, m);
    }
    return m;
  };
  const islandMaterial = new MeshLambertMaterial({ vertexColors: true });
  const nodeMaterial = new MeshLambertMaterial({ vertexColors: true });
  const pathMaterial = new MeshLambertMaterial({ vertexColors: true });

  let islandMeshes: Mesh[] = [];
  let islandBoundsById = new Map<string, Bounds>();
  let pathMeshes: Mesh[] = [];
  let visuals = new Map<string, NodeVisual>();
  let overview: { bounds: Bounds; halfHeight: number } = { bounds: { minX: -1, maxX: 1, minZ: -1, maxZ: 1 }, halfHeight: 10 };
  let view: MapView = { target: { x: 0, z: 0 }, halfHeight: 10 };
  let goal: MapView = view;
  let chapterFocus: string | null = options.focusChapter ?? null;
  const theta = (MAP_ELEVATION_DEG * Math.PI) / 180;
  const iconTilt = theta * 0.72;

  const aspect = () => {
    const r = stage.rect();
    return r.width > 0 && r.height > 0 ? r.width / r.height : 16 / 9;
  };

  function applyCamera(): void {
    const a = aspect();
    camera.left = -view.halfHeight * a;
    camera.right = view.halfHeight * a;
    camera.top = view.halfHeight;
    camera.bottom = -view.halfHeight;
    const dist = 120;
    camera.position.set(view.target.x, Math.sin(theta) * dist, view.target.z + Math.cos(theta) * dist);
    camera.up.set(0, 1, 0);
    camera.lookAt(view.target.x, 0, view.target.z);
    camera.near = 1;
    camera.far = dist * 2;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  }

  // --------------------------------------------------------------------------------- construção
  function disposeWorld(): void {
    for (const m of islandMeshes) {
      m.geometry.dispose();
      m.removeFromParent();
    }
    islandMeshes = [];
    for (const m of pathMeshes) {
      m.geometry.dispose();
      m.removeFromParent();
    }
    pathMeshes = [];
    for (const v of visuals.values()) {
      v.body.geometry.dispose();
      v.group.removeFromParent();
    }
    visuals = new Map();
  }

  function buildPaths(): void {
    const byId = new Map(nodes.map((n) => [n.nodeId, n]));
    const solid: BufferGeometry[] = [];
    const dashed: BufferGeometry[] = [];
    const ribbon = (a: XZ, b: XZ, width: number, y: number) => {
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const g = new BoxGeometry(len, 0.03, width);
      g.rotateY(-Math.atan2(b.z - a.z, b.x - a.x));
      g.translate((a.x + b.x) / 2, y, (a.z + b.z) / 2);
      return g;
    };
    for (const e of mapEdges(nodes)) {
      const from = byId.get(e.from)!;
      const to = byId.get(e.to)!;
      const a = nodeWorld(from);
      const b = nodeWorld(to);
      const locked = statusOf(statuses, e.to) === 'LOCKED';
      const color = locked ? '#DCE4EC' : e.main ? '#FFFFFF' : mixHex(theme(to.chapterId).accent, '#FFFFFF', 0.45);
      const y = e.crossChapter ? 0.06 : 0.035;
      if (e.main) {
        const g = ribbon(a, b, e.crossChapter ? 0.2 : 0.17, y);
        solid.push(colorGeometry(g, color));
        // Borda azul-pálida sob a rota principal (legível sobre chão claro).
        solid.push(colorGeometry(ribbon(a, b, (e.crossChapter ? 0.2 : 0.17) + 0.08, y - 0.012), locked ? '#E8EEF4' : mixHex(theme(to.chapterId).accent, '#B9C9DA', 0.5)));
      } else {
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        const n = Math.max(2, Math.floor(len / 0.42));
        for (let i = 0; i < n; i += 2) {
          const t0 = i / n;
          const t1 = Math.min(1, (i + 1) / n);
          dashed.push(colorGeometry(ribbon({ x: a.x + (b.x - a.x) * t0, z: a.z + (b.z - a.z) * t0 }, { x: a.x + (b.x - a.x) * t1, z: a.z + (b.z - a.z) * t1 }, 0.12, y), color));
        }
      }
    }
    for (const list of [solid, dashed]) {
      if (!list.length) continue;
      const merged = mergeColored(list);
      const mesh = new Mesh(merged, pathMaterial);
      mesh.name = list === solid ? 'MainPaths' : 'OptionalPaths';
      pathsRoot.add(mesh);
      pathMeshes.push(mesh);
    }
  }

  function buildIslands(): void {
    islandBoundsById = new Map();
    const chapters = CHAPTER_ORDER.filter((id) => ISLAND_CENTERS[id] && nodes.some((n) => n.chapterId === id));
    for (const id of chapters) {
      const b = islandBounds(id, nodes);
      islandBoundsById.set(id, b);
      const own = nodes.filter((n) => n.chapterId === id);
      const pts = own.map(nodeWorld);
      const byId = new Map(own.map((n) => [n.nodeId, nodeWorld(n)]));
      const segs: [XZ, XZ][] = [];
      for (const n of own) for (const p of n.prerequisites.allOf) {
        const a = byId.get(p);
        if (a) segs.push([a, nodeWorld(n)]);
      }
      const mesh = new Mesh(buildIslandGeometry(theme(id), b, pts, segs), islandMaterial);
      mesh.name = `Diorama:${id}`;
      mesh.userData.pick = { kind: 'CHAPTER', chapterId: id } satisfies MapPick;
      mesh.layers.enable(PICK_LAYER);
      islandsRoot.add(mesh);
      islandMeshes.push(mesh);
    }
    const all = [...islandBoundsById.values()];
    overview = { bounds: all.length ? unionBounds(all) : overview.bounds, halfHeight: overview.halfHeight };
  }

  function iconGeometry(kind: NodeKind): BufferGeometry {
    return geo(`icon:${kind}`, () => {
      const g = new ExtrudeGeometry(nodeShape(kind), { depth: 0.1, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 2, curveSegments: 16 });
      g.translate(0, 0, -0.05);
      return g;
    });
  }

  function buildNode(node: MapNodeInput): NodeVisual {
    const p = nodeWorld(node);
    const big = node.kind === 'BOSS' || node.kind === 'FINAL';
    const group = new Group();
    group.name = `CampaignNodeVisual:${node.nodeId}`;
    group.position.set(p.x, 0, p.z);
    const body = new Mesh(new BoxGeometry(0.01, 0.01, 0.01), nodeMaterial);
    body.name = 'NodeBody';
    const pulse = new Mesh(geo('pulse', () => new RingGeometry(0.56, 0.64, 40).rotateX(-Math.PI / 2)), basic(COLORS.cyan, 0.85));
    pulse.position.y = 0.012;
    pulse.visible = false;
    group.add(body, pulse);
    const pick = { kind: 'NODE', nodeId: node.nodeId } satisfies MapPick;
    group.userData.pick = pick;
    // Proxy de picking generoso, só na camada de picking: a câmera (camada 0) não o desenha.
    const hit = new Mesh(geo('hit', () => new CylinderGeometry(0.62, 0.62, 1.25, 12).translate(0, 0.6, 0)), basic('#FFFFFF'));
    hit.userData.pick = pick;
    hit.layers.set(PICK_LAYER);
    group.add(hit);
    const scale = big ? 1.3 : 1;
    group.scale.setScalar(scale);
    nodesRoot.add(group);
    return { node, group, base: p, status: 'LOCKED', lift: 0, scale, body, pulse };
  }

  function decorate(v: NodeVisual): void {
    const status = statusOf(statuses, v.node.nodeId);
    v.status = status;
    const accent = theme(v.node.chapterId).accent;
    const locked = status === 'LOCKED';
    v.pulse.visible = status === 'AVAILABLE';
    const parts: BufferGeometry[] = [];
    const part = (source: BufferGeometry, color: string, pos: Vector3, rotX = 0) => {
      const g = source.clone();
      if (rotX) g.rotateX(rotX);
      g.translate(pos.x, pos.y, pos.z);
      parts.push(colorGeometry(g, color));
    };
    part(geo('pedestal', () => new CylinderGeometry(0.42, 0.5, 0.2, 28).translate(0, 0.1, 0)), locked ? LOCKED_BASE : '#FFFFFF', new Vector3());
    part(geo('pedestal-rim', () => new CylinderGeometry(0.51, 0.53, 0.05, 28).translate(0, 0.025, 0)), locked ? '#D3DCE5' : mixHex(accent, '#FFFFFF', 0.55), new Vector3());
    part(iconGeometry(v.node.kind), locked ? LOCKED_ICON : accent, new Vector3(0, 0.62, 0), -iconTilt);
    const iconTop = new Vector3(0.3, 0.92, 0.05);
    if (locked) {
      // Cadeado: corpo + alça (forma, não só cor).
      part(geo('lock-body', () => new BoxGeometry(0.22, 0.18, 0.08)), '#7D8EA1', new Vector3(0.28, 0.42, 0.34));
      part(geo('lock-shackle', () => new TorusGeometry(0.07, 0.022, 8, 16, Math.PI)), '#7D8EA1', new Vector3(0.28, 0.51, 0.34));
    }
    if (status === 'IN_PROGRESS') {
      part(geo('badge', () => new CylinderGeometry(0.16, 0.16, 0.04, 24).rotateX(Math.PI / 2)), mixHex(accent, COLORS.text, 0.35), iconTop, -iconTilt);
      for (const dx of [-0.045, 0.045]) part(geo('pause-bar', () => new BoxGeometry(0.045, 0.15, 0.03)), '#FFFFFF', new Vector3(iconTop.x + dx, iconTop.y, iconTop.z + 0.03), -iconTilt);
    }
    if (status === 'CLEARED' || status === 'MASTERED') {
      part(geo('medal', () => new CylinderGeometry(0.15, 0.15, 0.05, 24).rotateX(Math.PI / 2)), GOLD, iconTop, -iconTilt);
      part(geo('medal-inner', () => new CylinderGeometry(0.085, 0.085, 0.06, 20).rotateX(Math.PI / 2)), '#FFF4C2', iconTop, -iconTilt);
    }
    if (status === 'MASTERED') {
      part(geo('laurel', () => new TorusGeometry(0.6, 0.035, 8, 40).rotateX(Math.PI / 2)), GOLD, new Vector3(0, 0.06, 0));
      for (let k = 0; k < 3; k += 1) part(geo('m-star', () => new OctahedronGeometry(0.07)), GOLD, new Vector3(-0.22 + k * 0.22, 1.08 + (k === 1 ? 0.06 : 0), 0));
    }
    v.body.geometry.dispose();
    v.body.geometry = mergeColored(parts);
  }

  function rebuild(): void {
    disposeWorld();
    buildIslands();
    buildPaths();
    for (const n of nodes) {
      if (!ISLAND_CENTERS[n.chapterId]) continue;
      const v = buildNode(n);
      visuals.set(n.nodeId, v);
      decorate(v);
    }
    refit(false);
    stage.markDirty();
  }

  function refit(animate: boolean): void {
    overview = { bounds: overview.bounds, halfHeight: fitOrthoHalfHeight(overview.bounds, aspect(), 1.06) };
    const target = chapterFocus ? chapterView(chapterFocus) : { target: boundsCenter(overview.bounds), halfHeight: overview.halfHeight };
    goal = clampMapView(target, overview);
    if (!animate || reduced) view = goal;
    applyCamera();
  }

  function chapterView(chapterId: string): MapView {
    const b = islandBoundsById.get(chapterId);
    if (!b) return { target: boundsCenter(overview.bounds), halfHeight: overview.halfHeight };
    return { target: boundsCenter(b), halfHeight: fitOrthoHalfHeight(b, aspect(), 1.1, 2.0) };
  }

  // ---------------------------------------------------------------------------------- entrada
  const listeners = { pick: new Set<(p: MapPick) => void>(), hover: new Set<(p: MapPick | null) => void>(), view: new Set<() => void>() };
  const pickAt = (x: number, y: number): MapPick | null => {
    const hit = stage.pick(x, y, [nodesRoot, islandsRoot]);
    let o: Object3D | null = hit?.object ?? null;
    while (o && !o.userData.pick) o = o.parent;
    return (o?.userData.pick as MapPick | undefined) ?? null;
  };
  const drag = dragTracker(6);
  stage.setInput({
    onDown: (p) => {
      if (p.button !== 0) return false;
      engaged = true;
      drag.down(p);
      return true;
    },
    onMove: (p) => {
      const d = drag.move(p);
      if (!d || !d.started) return;
      const r = stage.rect();
      const delta = panDelta(d.dx, d.dy, r, view.halfHeight);
      goal = clampMapView({ target: { x: goal.target.x + delta.x, z: goal.target.z + delta.z }, halfHeight: goal.halfHeight }, overview);
      view = { target: goal.target, halfHeight: view.halfHeight };
      applyCamera();
      stage.markDirty();
      for (const cb of listeners.view) cb();
    },
    onUp: (p) => {
      const { dragged } = drag.up();
      if (dragged) return;
      const pick = pickAt(p.x, p.y);
      if (pick) for (const cb of listeners.pick) cb(pick);
    },
    onCancel: () => {
      drag.up();
    },
    onHover: (p) => {
      if (!p) {
        engaged = false;
        if (hovered) {
          hovered = null;
          for (const cb of listeners.hover) cb(null);
          rs.requestRender();
        }
        return;
      }
      if (drag.active()) return;
      const pick = pickAt(p.x, p.y);
      const id = pick?.kind === 'NODE' ? pick.nodeId : null;
      if (id !== hovered) {
        hovered = id;
        for (const cb of listeners.hover) cb(pick);
        rs.requestRender();
      }
      rs.canvas.style.cursor = pick?.kind === 'NODE' ? 'pointer' : 'grab';
    },
    onWheel: (_p, deltaY) => {
      if (wheelMode === 'NEVER' || (wheelMode === 'FOCUSED' && !engaged)) return false;
      zoomBy(deltaY > 0 ? 1.12 : 1 / 1.12);
      return true;
    },
  });

  function zoomBy(factor: number): void {
    goal = clampMapView({ target: goal.target, halfHeight: goal.halfHeight * factor }, overview);
    if (reduced) view = goal;
    rs.requestRender();
  }

  // -------------------------------------------------------------------------------------- loop
  const selectionRing = new Mesh(new RingGeometry(0.66, 0.8, 48).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: COLORS.cyan, toneMapped: false }));
  selectionRing.name = 'SelectionRing';
  root.add(selectionRing);

  let clock = 0;
  stage.addTicker((dt) => {
    clock += dt;
    let animating = false;
    const half = 110;
    const next: MapView = {
      target: { x: approach(view.target.x, goal.target.x, dt, half, reduced), z: approach(view.target.z, goal.target.z, dt, half, reduced) },
      halfHeight: approach(view.halfHeight, goal.halfHeight, dt, half, reduced),
    };
    if (next.target.x !== view.target.x || next.target.z !== view.target.z || next.halfHeight !== view.halfHeight) {
      view = next;
      applyCamera();
      animating = true;
      for (const cb of listeners.view) cb();
    }
    for (const v of visuals.values()) {
      const isSel = v.node.nodeId === selected;
      const isHover = v.node.nodeId === hovered;
      const targetLift = isSel ? 0.16 : isHover ? 0.08 : 0;
      const targetScale = v.scale * (isSel ? 1.12 : isHover ? 1.05 : 1);
      const lift = approach(v.lift, targetLift, dt, 50, reduced);
      const sc = approach(v.group.scale.x, targetScale, dt, 50, reduced);
      if (lift !== v.lift || sc !== v.group.scale.x) animating = true;
      v.lift = lift;
      v.group.position.y = lift;
      v.group.scale.setScalar(sc);
      if (v.pulse.visible) {
        if (reduced) v.pulse.scale.setScalar(1);
        else {
          const k = (clock % 1600) / 1600;
          v.pulse.scale.setScalar(1 + 0.35 * k);
          animating = true;
        }
      }
    }
    selectionRing.visible = !!selected && visuals.has(selected);
    if (selectionRing.visible) {
      const v = visuals.get(selected!)!;
      selectionRing.position.set(v.base.x, 0.02, v.base.z);
      selectionRing.scale.setScalar(v.scale);
    }
    return animating;
  });

  stage.onRect(() => {
    refit(false);
    stage.markDirty();
    for (const cb of listeners.view) cb();
  });

  rebuild();
  if (selected && !chapterFocus) {
    // Abre centrado no nó selecionado/recomendado, no zoom geral.
    const v = visuals.get(selected);
    if (v) {
      goal = clampMapView({ target: v.base, halfHeight: overview.halfHeight * 0.62 }, overview);
      view = goal;
      applyCamera();
    }
  }

  const subscribe = <T>(set: Set<T>, cb: T) => {
    set.add(cb);
    return () => {
      set.delete(cb);
    };
  };

  const projectRect = (center: Vector3, halfW: number, halfH: number): CssRect => {
    const c = stage.project(center);
    const r = stage.rect();
    const pxPerUnit = r.height / (2 * view.halfHeight);
    return { x: c.x - halfW * pxPerUnit, y: c.y - halfH * pxPerUnit, width: halfW * 2 * pxPerUnit, height: halfH * 2 * pxPerUnit };
  };

  return {
    setRect: stage.setRect,
    setActive: (on) => {
      stage.setActive(on);
      if (on) rs.requestRender();
    },
    setNodes: (next) => {
      nodes = next;
      rebuild();
    },
    setStatuses: (next) => {
      statuses = next;
      for (const m of pathMeshes) {
        m.geometry.dispose();
        m.removeFromParent();
      }
      pathMeshes = [];
      buildPaths();
      for (const v of visuals.values()) decorate(v);
      stage.markDirty();
      rs.requestRender();
    },
    setSelected: (id) => {
      selected = id;
      rs.requestRender();
    },
    focusNode: (id, animate = true) => {
      const v = visuals.get(id);
      if (!v) return;
      goal = clampMapView({ target: v.base, halfHeight: Math.min(goal.halfHeight, overview.halfHeight * 0.62) }, overview);
      if (!animate || reduced) {
        view = goal;
        applyCamera();
      }
      rs.requestRender();
    },
    focusChapter: (id, animate = true) => {
      chapterFocus = id;
      refit(animate);
      rs.requestRender();
    },
    zoomBy,
    panBy: (dx, dy) => {
      const delta = panDelta(dx, dy, stage.rect(), view.halfHeight);
      goal = clampMapView({ target: { x: goal.target.x + delta.x, z: goal.target.z + delta.z }, halfHeight: goal.halfHeight }, overview);
      if (reduced) view = goal;
      rs.requestRender();
    },
    onPick: (cb) => subscribe(listeners.pick, cb),
    onHover: (cb) => subscribe(listeners.hover, cb),
    onViewChange: (cb) => subscribe(listeners.view, cb),
    getNodeRects: () => {
      const out: Record<string, CssRect> = {};
      for (const v of visuals.values()) out[v.node.nodeId] = projectRect(new Vector3(v.base.x, 0.45 * v.scale, v.base.z), 0.55 * v.scale, 0.55 * v.scale);
      return out;
    },
    getChapterRects: () => {
      const out: Record<string, CssRect> = {};
      for (const [id, b] of islandBoundsById) {
        const corners = [[b.minX, b.minZ], [b.maxX, b.minZ], [b.maxX, b.maxZ], [b.minX, b.maxZ]].map(([x, z]) => stage.project(new Vector3(x!, 0, z!)));
        const xs = corners.map((c) => c.x);
        const ys = corners.map((c) => c.y);
        out[id] = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
      }
      return out;
    },
    setReducedMotion: (on) => {
      reduced = on;
      rs.requestRender();
    },
    diagnostics: () => ({ nodes: visuals.size, islands: islandMeshes.length, view }),
    dispose: () => {
      for (const set of Object.values(listeners)) set.clear();
      disposeWorld();
      selectionRing.geometry.dispose();
      (selectionRing.material as Material).dispose();
      for (const g of geoCache.values()) g.dispose();
      for (const m of matCache.values()) m.dispose();
      islandMaterial.dispose();
      nodeMaterial.dispose();
      pathMaterial.dispose();
      rs.canvas.style.cursor = '';
      stage.dispose();
    },
  };
}
