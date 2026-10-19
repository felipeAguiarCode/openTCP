// Base dos palcos de painel (card-inspector, pack-opening, campaign-map, home/deck-preview, discovery):
// um viewport do RenderSystem compartilhado num retângulo CSS escolhido pela UI, cena própria, fundo
// claro, tickers e alvo de entrada com prioridade. Nenhum palco cria contexto WebGL.
import {
  CanvasTexture, DirectionalLight, HemisphereLight, LinearFilter, Raycaster, SRGBColorSpace, Scene, Vector2, Vector3,
  type Camera, type Object3D, type Texture,
} from 'three';
import type { CanvasPointer, PointerTarget, RenderSystem, ViewportHandle } from '../core/render-system.ts';
import { COLORS } from '../core/tokens.ts';
import { rectContains, type CssRect } from '../core/viewport.ts';
import { PICK_LAYER } from '../card/card-visual.ts';

/** Fundo do palco: gradiente claro (padrão), cor sólida ou nenhum (só limpa profundidade; aparece o canvas). */
export type StageBackground = 'GRADIENT' | 'NONE' | { readonly color: string } | { readonly gradient: readonly [string, string] };

export type StageInput = Omit<PointerTarget, 'priority' | 'isActive' | 'hit'> & { readonly priority?: number };

export type PanelStage = {
  readonly scene: Scene;
  readonly viewport: ViewportHandle;
  readonly rect: () => CssRect;
  readonly setRect: (rect: CssRect) => void;
  readonly onRect: (cb: (rect: CssRect) => void) => void;
  readonly setActive: (active: boolean) => void;
  readonly isActive: () => boolean;
  readonly markDirty: () => void;
  readonly setCamera: (camera: Camera) => void;
  readonly camera: () => Camera;
  /** Ticker removido no dispose; true = continua animando (mantém o loop vivo). */
  readonly addTicker: (tick: (dtMs: number, nowMs: number) => boolean | void) => void;
  readonly setInput: (input: StageInput) => void;
  /** NDC do ponto CSS (canvas) dentro do retângulo do palco; nulo fora dele. */
  readonly ndc: (x: number, y: number) => Vector2 | null;
  /** Projeta um ponto do mundo para CSS do canvas. */
  readonly project: (point: Vector3) => { x: number; y: number; z: number };
  /** Raycast na camada de picking a partir de um ponto CSS do canvas. */
  readonly pick: (x: number, y: number, roots: readonly Object3D[]) => { object: Object3D; point: Vector3 } | null;
  readonly onDispose: (fn: () => void) => void;
  readonly isDisposed: () => boolean;
  readonly dispose: () => void;
};

export type PanelStageOptions = {
  readonly id: string;
  readonly order?: number;
  readonly camera: Camera;
  readonly rect?: CssRect;
  readonly background?: StageBackground;
  readonly lights?: boolean;
};

const EMPTY_RECT: CssRect = { x: 0, y: 0, width: 0, height: 0 };

function gradientTexture(top: string, bottom: string): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

/** Luz difusa clara (hemisfério + key ampla), sem preto profundo (direção visual §14.1). */
export function addSoftLights(scene: Scene): void {
  scene.add(new HemisphereLight('#FFFFFF', '#D9E4F0', 2.3));
  const key = new DirectionalLight('#FFFFFF', 1.25);
  key.position.set(3, 8, 6);
  scene.add(key);
}

export function createPanelStage(rs: RenderSystem, options: PanelStageOptions): PanelStage {
  const scene = new Scene();
  scene.name = options.id;
  const bg = options.background ?? 'GRADIENT';
  let bgTexture: Texture | null = null;
  if (bg === 'GRADIENT') bgTexture = gradientTexture('#FFFFFF', COLORS.canvas);
  else if (bg !== 'NONE' && 'gradient' in bg) bgTexture = gradientTexture(bg.gradient[0], bg.gradient[1]);
  if (bgTexture) scene.background = bgTexture;
  if (options.lights ?? true) addSoftLights(scene);
  let rect: CssRect = options.rect ?? EMPTY_RECT;
  let camera = options.camera;
  let active = true;
  let disposed = false;
  const rectListeners: ((r: CssRect) => void)[] = [];
  const disposers: (() => void)[] = [];
  const viewport = rs.registerViewport({
    id: options.id, scene, camera, rect, order: options.order ?? 20,
    clearColor: bg !== 'NONE' && bg !== 'GRADIENT' && 'color' in bg ? bg.color : null,
  });
  const raycaster = new Raycaster();
  raycaster.layers.set(PICK_LAYER);

  const stage: PanelStage = {
    scene,
    viewport,
    rect: () => rect,
    setRect: (r) => {
      if (disposed) return;
      rect = { x: r.x, y: r.y, width: Math.max(0, r.width), height: Math.max(0, r.height) };
      viewport.setRect(rect);
      for (const cb of rectListeners) cb(rect);
      viewport.markDirty();
    },
    onRect: (cb) => {
      rectListeners.push(cb);
    },
    setActive: (on) => {
      active = on;
      viewport.setActive(on);
    },
    isActive: () => active && !disposed,
    markDirty: () => viewport.markDirty(),
    setCamera: (c) => {
      camera = c;
      viewport.setCamera(c);
    },
    camera: () => camera,
    addTicker: (tick) => {
      const off = rs.addTicker((dt, now) => {
        if (disposed) return false;
        if (!active) return false;
        const keep = tick(dt, now) === true;
        if (keep) viewport.markDirty();
        return keep;
      });
      disposers.push(off);
    },
    setInput: (input) => {
      const off = rs.addPointerTarget({
        ...input,
        priority: input.priority ?? 20,
        isActive: () => active && !disposed && rect.width > 0,
        hit: (x, y) => rectContains(rect, x, y),
      });
      disposers.push(off);
    },
    ndc: (x, y) => {
      if (!rectContains(rect, x, y) || rect.width <= 0 || rect.height <= 0) return null;
      return new Vector2(((x - rect.x) / rect.width) * 2 - 1, 1 - ((y - rect.y) / rect.height) * 2);
    },
    project: (point) => {
      const v = point.clone().project(camera);
      return { x: rect.x + ((v.x + 1) / 2) * rect.width, y: rect.y + ((1 - v.y) / 2) * rect.height, z: v.z };
    },
    pick: (x, y, roots) => {
      const n = stage.ndc(x, y);
      if (!n) return null;
      raycaster.setFromCamera(n, camera);
      const hits = raycaster.intersectObjects(roots as Object3D[], true);
      const first = hits[0];
      return first ? { object: first.object, point: first.point } : null;
    },
    onDispose: (fn) => {
      disposers.push(fn);
    },
    isDisposed: () => disposed,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const fn of disposers.splice(0).reverse()) fn();
      viewport.dispose();
      bgTexture?.dispose();
      scene.clear();
      rs.requestRender();
    },
  };
  return stage;
}

/** Converte pointer → delta de arrasto acumulado com limiar (pan/rotação vs clique). */
export function dragTracker(thresholdPx = 6): {
  readonly down: (p: CanvasPointer) => void;
  readonly move: (p: CanvasPointer) => { dx: number; dy: number; started: boolean } | null;
  readonly up: () => { dragged: boolean };
  readonly active: () => boolean;
} {
  let start: { x: number; y: number } | null = null;
  let last: { x: number; y: number } | null = null;
  let started = false;
  return {
    down: (p) => {
      start = { x: p.x, y: p.y };
      last = { x: p.x, y: p.y };
      started = false;
    },
    move: (p) => {
      if (!start || !last) return null;
      if (!started && Math.hypot(p.x - start.x, p.y - start.y) >= thresholdPx) started = true;
      const d = { dx: p.x - last.x, dy: p.y - last.y, started };
      last = { x: p.x, y: p.y };
      return d;
    },
    up: () => {
      const dragged = started;
      start = null;
      last = null;
      started = false;
      return { dragged };
    },
    active: () => start !== null,
  };
}

/** Suavização exponencial independente de frame (meia-vida em ms); movimento reduzido = imediato. */
export function approach(current: number, target: number, dtMs: number, halfLifeMs: number, reduced = false): number {
  if (reduced || halfLifeMs <= 0) return target;
  const k = 1 - Math.pow(0.5, dtMs / halfLifeMs);
  const next = current + (target - current) * k;
  return Math.abs(target - next) < 1e-4 ? target : next;
}
