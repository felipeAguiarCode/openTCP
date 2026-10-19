// Um WebGLRenderer, um canvas, vários viewports (runtime §12–§13, §16, §21–§23). Loop compartilhado que só
// desenha quando há viewport ativo sujo/contínuo; DPR tratado uma vez; perda/restauração de contexto.
import { Color, NoToneMapping, SRGBColorSpace, WebGLRenderer, type Camera, type Scene, type Texture } from 'three';
import { COLORS } from './tokens.ts';
import { QUALITY_PROFILES, effectivePixelRatio, type Quality } from './quality.ts';
import { createResourceRegistry, createTextureCache, type ResourceRegistry, type TextureCache, type TextureCacheStats } from './resources.ts';
import { cssRectToRendererRect, rectContains, type CssRect } from './viewport.ts';

export type RenderSystemErrorCode = 'WEBGL2_UNAVAILABLE' | 'CONTEXT_CREATION_FAILED';

export type RenderSystemOptions = {
  readonly quality: Quality;
  readonly onContextLost?: () => void;
  readonly onContextRestored?: () => void;
  /** Fonte do devicePixelRatio (testes/override); padrão window.devicePixelRatio. */
  readonly devicePixelRatio?: () => number;
};

export type ViewportSpec = {
  readonly id: string;
  readonly scene: Scene;
  readonly camera: Camera;
  readonly rect: CssRect;
  /** Ordem de desenho (menor primeiro). */
  readonly order: number;
  readonly clearColor?: string | null;
  readonly active?: boolean;
  readonly continuous?: boolean;
  readonly onBeforeRender?: () => void;
};

export type ViewportHandle = {
  readonly id: string;
  readonly setRect: (rect: CssRect) => void;
  readonly getRect: () => CssRect;
  readonly setActive: (active: boolean) => void;
  readonly isActive: () => boolean;
  readonly setCamera: (camera: Camera) => void;
  readonly setContinuous: (continuous: boolean) => void;
  readonly markDirty: () => void;
  readonly dispose: () => void;
};

export type CanvasPointer = {
  readonly x: number;
  readonly y: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly pointerId: number;
  readonly pointerType: string;
  readonly button: number;
  readonly native: PointerEvent | WheelEvent | null;
};

/** Alvo de entrada de um palco: o de maior prioridade sob o ponteiro recebe o gesto (runtime §17.1). */
export type PointerTarget = {
  readonly priority: number;
  readonly isActive: () => boolean;
  readonly hit: (x: number, y: number) => boolean;
  readonly onDown?: (p: CanvasPointer) => boolean;
  readonly onMove?: (p: CanvasPointer) => void;
  readonly onUp?: (p: CanvasPointer) => void;
  readonly onCancel?: (p: CanvasPointer | null) => void;
  readonly onHover?: (p: CanvasPointer | null) => void;
  readonly onWheel?: (p: CanvasPointer, deltaY: number) => boolean;
};

export type RenderDiagnostics = {
  readonly drawCalls: number;
  readonly triangles: number;
  readonly points: number;
  readonly lines: number;
  readonly geometries: number;
  readonly textures: number;
  readonly programs: number;
  readonly frameMs: number;
  readonly framesRendered: number;
  readonly pixelRatio: number;
  readonly canvas: { readonly width: number; readonly height: number };
  readonly quality: Quality;
  readonly viewports: readonly { readonly id: string; readonly active: boolean; readonly rect: CssRect; readonly order: number }[];
  readonly resources: { readonly entries: number; readonly references: number };
  readonly textureCache: TextureCacheStats;
  readonly contextLost: boolean;
};

export type RenderSystem = {
  readonly renderer: WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  readonly resources: ResourceRegistry;
  readonly textures: TextureCache<Texture>;
  readonly quality: () => Quality;
  readonly setQuality: (q: Quality) => void;
  readonly onQualityChange: (cb: (q: Quality) => void) => () => void;
  readonly pixelRatio: () => number;
  readonly anisotropy: () => number;
  readonly size: () => { width: number; height: number };
  readonly onResize: (cb: (size: { width: number; height: number }) => void) => () => void;
  readonly registerViewport: (spec: ViewportSpec) => ViewportHandle;
  readonly addTicker: (tick: (dtMs: number, nowMs: number) => boolean | void) => () => void;
  readonly addPointerTarget: (target: PointerTarget) => () => void;
  /** Liga a entrada também a um elemento HTML sobre o canvas (coordenadas continuam relativas ao canvas). */
  readonly addInputSurface: (element: HTMLElement) => () => void;
  readonly requestRender: () => void;
  readonly diagnostics: () => RenderDiagnostics;
  readonly isContextLost: () => boolean;
  readonly dispose: () => void;
};

export type CreateRenderSystemResult =
  | { readonly ok: true; readonly system: RenderSystem }
  | { readonly ok: false; readonly code: RenderSystemErrorCode; readonly message: string };

export const CLEAR_COLOR = COLORS.canvas;

/** Testa WebGL2 num canvas descartável e libera o contexto (não basta o navegador anunciar suporte). */
export function probeWebGL2(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

type ViewportEntry = { spec: ViewportSpec; rect: CssRect; camera: Camera; active: boolean; continuous: boolean; dirty: boolean; disposed: boolean };

export function createRenderSystem(canvas: HTMLCanvasElement, options: RenderSystemOptions): CreateRenderSystemResult {
  if (!probeWebGL2()) return { ok: false, code: 'WEBGL2_UNAVAILABLE', message: 'WebGL2 indisponível neste navegador/GPU.' };
  let quality: Quality = options.quality;
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      // Canvas transparente: fora dos viewports aparece o fundo HTML da tela (o shell desenha o fundo).
      canvas, antialias: QUALITY_PROFILES[quality].antialias, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance',
      preserveDrawingBuffer: false, stencil: false,
    });
  } catch (error) {
    return { ok: false, code: 'CONTEXT_CREATION_FAILED', message: error instanceof Error ? error.message : String(error) };
  }
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping;
  renderer.autoClear = false;
  renderer.info.autoReset = false;
  const clearColor = new Color(CLEAR_COLOR);
  renderer.setClearColor(clearColor, 0);

  const dprSource = options.devicePixelRatio ?? (() => window.devicePixelRatio || 1);
  const resources = createResourceRegistry();
  const textures = createTextureCache<Texture>(QUALITY_PROFILES[quality].textureBudgetBytes);
  const viewports = new Set<ViewportEntry>();
  const tickers = new Set<(dt: number, now: number) => boolean | void>();
  const resizeListeners = new Set<(s: { width: number; height: number }) => void>();
  const qualityListeners = new Set<(q: Quality) => void>();
  const pointerTargets = new Set<PointerTarget>();
  let size = { width: 0, height: 0 };
  let pixelRatio = 1;
  let raf = 0;
  let lastFrame: number | null = null;
  let forceRender = true;
  let contextLost = false;
  let disposed = false;
  let frameMs = 0;
  let framesRendered = 0;
  let lastStats = { calls: 0, triangles: 0, points: 0, lines: 0 };

  const applySize = () => {
    const width = Math.max(1, Math.round(canvas.clientWidth || canvas.width || 1));
    const height = Math.max(1, Math.round(canvas.clientHeight || canvas.height || 1));
    const ratio = effectivePixelRatio(dprSource(), quality);
    if (width === size.width && height === size.height && ratio === pixelRatio) return false;
    size = { width, height };
    pixelRatio = ratio;
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    return true;
  };

  const schedule = () => {
    if (raf || disposed || contextLost) return;
    raf = requestAnimationFrame(frame);
  };

  const notifyResize = () => {
    if (!applySize()) return;
    for (const cb of resizeListeners) cb({ ...size });
    forceRender = true;
    schedule();
  };

  function renderViewports(list: ViewportEntry[]): void {
    renderer.info.reset();
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, size.width, size.height);
    renderer.setClearColor(clearColor, 0);
    renderer.clear(true, true, true);
    for (const v of list) {
      v.spec.onBeforeRender?.();
      const r = cssRectToRendererRect(v.rect, size.height);
      renderer.setViewport(r.x, r.y, r.width, r.height);
      renderer.setScissor(r.x, r.y, r.width, r.height);
      renderer.setScissorTest(true);
      if (v.spec.clearColor) {
        renderer.setClearColor(new Color(v.spec.clearColor), 1);
        renderer.clear(true, true, false);
        renderer.setClearColor(clearColor, 0);
      } else renderer.clearDepth();
      renderer.render(v.spec.scene, v.camera);
      v.dirty = false;
    }
    renderer.setScissorTest(false);
    const info = renderer.info.render;
    lastStats = { calls: info.calls, triangles: info.triangles, points: info.points, lines: info.lines };
    framesRendered += 1;
  }

  function frame(now: number): void {
    raf = 0;
    if (disposed || contextLost) return;
    // Ao acordar do repouso (sem quadro anterior) usa um quadro nominal: um ticker que só começa a animar
    // com dt > 0 nunca ficaria preso em dt = 0.
    let dt = lastFrame === null ? 1000 / 60 : now - lastFrame;
    if (dt > 250 || dt < 0) dt = 1000 / 60;
    lastFrame = now;
    const started = performance.now();
    let keepAlive = false;
    for (const tick of [...tickers]) if (tick(dt, now) === true) keepAlive = true;
    const list = [...viewports]
      .filter((v) => v.active && v.rect.width > 0 && v.rect.height > 0)
      .sort((a, b) => a.spec.order - b.spec.order);
    const continuous = list.some((v) => v.continuous);
    if (forceRender || continuous || list.some((v) => v.dirty)) {
      renderViewports(list);
      forceRender = false;
    }
    frameMs = frameMs * 0.9 + (performance.now() - started) * 0.1;
    if (keepAlive || continuous) schedule();
    else lastFrame = null;
  }

  // ------------------------------------------------------------------------------------------- entrada
  let captured: { target: PointerTarget; pointerId: number } | null = null;
  let hovered: PointerTarget | null = null;
  const toPointer = (e: PointerEvent | WheelEvent): CanvasPointer => {
    const r = canvas.getBoundingClientRect();
    return {
      x: e.clientX - r.left, y: e.clientY - r.top, clientX: e.clientX, clientY: e.clientY,
      pointerId: 'pointerId' in e ? e.pointerId : -1, pointerType: 'pointerType' in e ? e.pointerType : 'mouse',
      button: e.button, native: e,
    };
  };
  const topTarget = (x: number, y: number): PointerTarget | null => {
    let best: PointerTarget | null = null;
    for (const t of pointerTargets) {
      if (!t.isActive() || !t.hit(x, y)) continue;
      if (!best || t.priority > best.priority) best = t;
    }
    return best;
  };
  const onPointerDown = (e: PointerEvent) => {
    const p = toPointer(e);
    const target = topTarget(p.x, p.y);
    if (!target?.onDown) return;
    if (target.onDown(p)) {
      captured = { target, pointerId: e.pointerId };
      try {
        (e.currentTarget as Element | null)?.setPointerCapture(e.pointerId);
      } catch {
        // captura indisponível (ponteiro sintético): o gesto segue sem ela
      }
    }
  };
  const onPointerMove = (e: PointerEvent) => {
    const p = toPointer(e);
    if (captured && captured.pointerId === e.pointerId) {
      captured.target.onMove?.(p);
      return;
    }
    const target = topTarget(p.x, p.y);
    if (hovered && hovered !== target) hovered.onHover?.(null);
    hovered = target;
    target?.onHover?.(p);
  };
  const endCapture = (e: PointerEvent, cancel: boolean) => {
    if (!captured || captured.pointerId !== e.pointerId) return;
    const { target } = captured;
    captured = null;
    if (cancel) target.onCancel?.(toPointer(e));
    else target.onUp?.(toPointer(e));
    try {
      (e.currentTarget as Element | null)?.releasePointerCapture(e.pointerId);
    } catch {
      // já liberada
    }
  };
  const onPointerUp = (e: PointerEvent) => endCapture(e, false);
  const onPointerCancel = (e: PointerEvent) => endCapture(e, true);
  const onLostCapture = (e: PointerEvent) => endCapture(e, true);
  const onPointerLeave = () => {
    if (captured) return;
    hovered?.onHover?.(null);
    hovered = null;
  };
  const onBlur = () => {
    if (captured) {
      captured.target.onCancel?.(null);
      captured = null;
    }
    hovered?.onHover?.(null);
    hovered = null;
  };
  const onWheel = (e: WheelEvent) => {
    const p = toPointer(e);
    const target = topTarget(p.x, p.y);
    if (target?.onWheel?.(p, e.deltaY)) e.preventDefault();
  };
  /**
   * Superfície de entrada: o próprio canvas ou um elemento HTML transparente sobre a região do palco
   * (o shell pode ficar acima do canvas). As coordenadas são sempre relativas ao canvas.
   */
  const bindInput = (el: HTMLElement): (() => void) => {
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerCancel);
    el.addEventListener('lostpointercapture', onLostCapture);
    el.addEventListener('pointerleave', onPointerLeave);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerCancel);
      el.removeEventListener('lostpointercapture', onLostCapture);
      el.removeEventListener('pointerleave', onPointerLeave);
      el.removeEventListener('wheel', onWheel);
    };
  };
  const inputSurfaces = new Map<HTMLElement, () => void>();
  inputSurfaces.set(canvas, bindInput(canvas));
  window.addEventListener('blur', onBlur);

  // ---------------------------------------------------------------------------------- contexto/resize
  const onContextLost = (e: Event) => {
    e.preventDefault();
    contextLost = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    lastFrame = null;
    options.onContextLost?.();
  };
  const onContextRestored = () => {
    contextLost = false;
    for (const v of viewports) v.dirty = true;
    forceRender = true;
    lastFrame = null;
    options.onContextRestored?.();
    schedule();
  };
  const onVisibility = () => {
    lastFrame = null;
    if (document.visibilityState === 'visible') {
      forceRender = true;
      schedule();
    }
  };
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);
  document.addEventListener('visibilitychange', onVisibility);
  const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => notifyResize()) : null;
  resizeObserver?.observe(canvas);
  window.addEventListener('resize', notifyResize);
  applySize();

  const system: RenderSystem = {
    renderer,
    canvas,
    resources,
    textures,
    quality: () => quality,
    setQuality: (q) => {
      if (q === quality) return;
      quality = q;
      textures.setBudget(QUALITY_PROFILES[q].textureBudgetBytes);
      notifyResize();
      for (const cb of qualityListeners) cb(q);
      forceRender = true;
      schedule();
    },
    onQualityChange: (cb) => {
      qualityListeners.add(cb);
      return () => qualityListeners.delete(cb);
    },
    pixelRatio: () => pixelRatio,
    anisotropy: () => Math.min(renderer.capabilities.getMaxAnisotropy(), QUALITY_PROFILES[quality].anisotropy),
    size: () => ({ ...size }),
    onResize: (cb) => {
      resizeListeners.add(cb);
      return () => resizeListeners.delete(cb);
    },
    registerViewport: (spec) => {
      const entry: ViewportEntry = {
        spec, rect: spec.rect, camera: spec.camera, active: spec.active ?? true, continuous: spec.continuous ?? false, dirty: true, disposed: false,
      };
      viewports.add(entry);
      schedule();
      const mark = () => {
        entry.dirty = true;
        schedule();
      };
      return {
        id: spec.id,
        setRect: (rect) => {
          entry.rect = rect;
          forceRender = true;
          mark();
        },
        getRect: () => entry.rect,
        setActive: (active) => {
          if (entry.active === active) return;
          entry.active = active;
          forceRender = true;
          mark();
        },
        isActive: () => entry.active && !entry.disposed,
        setCamera: (camera) => {
          entry.camera = camera;
          mark();
        },
        setContinuous: (continuous) => {
          entry.continuous = continuous;
          mark();
        },
        markDirty: mark,
        dispose: () => {
          entry.disposed = true;
          viewports.delete(entry);
          forceRender = true;
          schedule();
        },
      };
    },
    addTicker: (tick) => {
      tickers.add(tick);
      schedule();
      return () => tickers.delete(tick);
    },
    addInputSurface: (el) => {
      if (inputSurfaces.has(el)) return () => undefined;
      inputSurfaces.set(el, bindInput(el));
      return () => {
        inputSurfaces.get(el)?.();
        inputSurfaces.delete(el);
      };
    },
    addPointerTarget: (target) => {
      pointerTargets.add(target);
      return () => {
        pointerTargets.delete(target);
        if (hovered === target) hovered = null;
        if (captured?.target === target) captured = null;
      };
    },
    requestRender: () => {
      forceRender = true;
      schedule();
    },
    diagnostics: () => {
      const memory = renderer.info.memory;
      return {
        drawCalls: lastStats.calls,
        triangles: lastStats.triangles,
        points: lastStats.points,
        lines: lastStats.lines,
        geometries: memory.geometries,
        textures: memory.textures,
        programs: renderer.info.programs?.length ?? 0,
        frameMs,
        framesRendered,
        pixelRatio,
        canvas: { ...size },
        quality,
        viewports: [...viewports].sort((a, b) => a.spec.order - b.spec.order).map((v) => ({ id: v.spec.id, active: v.active, rect: v.rect, order: v.spec.order })),
        resources: resources.stats(),
        textureCache: textures.stats(),
        contextLost,
      };
    },
    isContextLost: () => contextLost,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      for (const unbind of inputSurfaces.values()) unbind();
      inputSurfaces.clear();
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', notifyResize);
      document.removeEventListener('visibilitychange', onVisibility);
      resizeObserver?.disconnect();
      viewports.clear();
      tickers.clear();
      pointerTargets.clear();
      textures.disposeAll();
      resources.disposeAll();
      renderer.dispose();
    },
  };
  return { ok: true, system };
}

export function hitRect(rect: CssRect): (x: number, y: number) => boolean {
  return (x, y) => rectContains(rect, x, y);
}
