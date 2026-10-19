// Palco `discovery` (runtime §12.4; interface §19): três cartas face-up em pedestais, sem sorteio oculto.
// Hover/foco de teclado eleva uma; seleção destaca o pedestal (a confirmação é HTML); depois do commit a
// carta escolhida faz a animação de aquisição. A cena só apresenta as opções recebidas.
import { Group, PerspectiveCamera, Vector3 } from 'three';
import type { CardFaceData } from '../../../domain/cards/text.ts';
import { uiPresetDurationMs } from '../../animation/catalog.ts';
import { EASINGS, clamp } from '../../animation/easing.ts';
import type { SpeedMode } from '../../animation/timing.ts';
import { scaleDuration } from '../../animation/timing.ts';
import type { RenderSystem } from '../core/render-system.ts';
import type { CssRect } from '../core/viewport.ts';
import { createCardVisual, PICK_LAYER, type CardVisual } from '../card/card-visual.ts';
import { DEFAULT_SLEEVE, type SleeveStyle } from '../card/face-canvas.ts';
import { FINISH_GLOBALS } from '../card/finish-material.ts';
import { loadCardFonts } from '../card/fonts.ts';
import { typeColor } from '../core/tokens.ts';
import { createRingEffect, type EffectHandle } from '../battle/effects.ts';
import { approach, createPanelStage, type StageBackground } from './stage-base.ts';
import { createPedestal, framePerspective, type Pedestal } from './props.ts';

export type DiscoveryOptions = {
  readonly rect?: CssRect;
  readonly offers: readonly CardFaceData[];
  readonly sleeve?: SleeveStyle;
  readonly selected?: number | null;
  readonly reducedMotion?: boolean;
  readonly speed?: SpeedMode;
  readonly background?: StageBackground;
  readonly order?: number;
};

export type DiscoveryStage = {
  readonly setRect: (rect: CssRect) => void;
  readonly setActive: (active: boolean) => void;
  readonly setOffers: (offers: readonly CardFaceData[]) => void;
  /** Foco de teclado (equivale ao hover). */
  readonly setFocus: (index: number | null) => void;
  /** Seleção (antes da confirmação HTML): destaca o pedestal. */
  readonly setSelected: (index: number | null) => void;
  /** Depois do commit: aquisição da carta escolhida; resolve ao fim (ou imediatamente em Instantânea). */
  readonly playAcquire: (index: number) => Promise<void>;
  readonly onPick: (cb: (index: number) => void) => () => void;
  readonly onHover: (cb: (index: number | null) => void) => () => void;
  readonly getCardRects: () => CssRect[];
  readonly setReducedMotion: (on: boolean) => void;
  readonly setSpeed: (speed: SpeedMode) => void;
  readonly dispose: () => void;
};

const SPACING = 1.75;
const ACQUIRE_MS = 900;

/** Centros dos pedestais (mundo) para `n` ofertas, centrados. Pura. */
export function discoveryPositions(n: number): number[] {
  return Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * SPACING);
}

type Slot = { card: CardVisual; pedestal: Pedestal; x: number; lift: number; scale: number; spin: number };

export function createDiscoveryStage(rs: RenderSystem, options: DiscoveryOptions): DiscoveryStage {
  void loadCardFonts();
  const camera = new PerspectiveCamera(30, 16 / 9, 0.1, 100);
  const stage = createPanelStage(rs, { id: 'discovery', camera, rect: options.rect, background: options.background, order: options.order ?? 20 });
  let reduced = options.reducedMotion ?? false;
  let speed: SpeedMode = options.speed ?? 'NORMAL';
  const root = new Group();
  root.name = 'DiscoveryRoot';
  stage.scene.add(root);
  let slots: Slot[] = [];
  let hover: number | null = null;
  let focus: number | null = null;
  let selected: number | null = options.selected ?? null;
  let acquire: { index: number; t: number; duration: number; resolve: () => void; ring: EffectHandle | null } | null = null;
  let acquired: number | null = null;
  const listeners = { pick: new Set<(i: number) => void>(), hover: new Set<(i: number | null) => void>() };

  const frame = () => {
    const n = Math.max(3, slots.length);
    framePerspective(camera, stage.rect(), { width: (n - 1) * SPACING + 1.6, height: 2.35, center: new Vector3(0, 0.78, 0), margin: 1.06, elevationDeg: 8 });
    stage.markDirty();
  };

  function setOffers(offers: readonly CardFaceData[]): void {
    for (const s of slots) {
      s.card.disposeVisual();
      s.pedestal.dispose();
    }
    const xs = discoveryPositions(offers.length);
    slots = offers.map((face, i) => {
      const pedestal = createPedestal(rs, { radius: 0.68, height: 0.2, accent: typeColor(face.types[0] ?? 'COLORLESS') });
      pedestal.group.position.set(xs[i]!, 0, 0);
      root.add(pedestal.group);
      const card = createCardVisual(rs, { kind: 'FACE', face, sleeve: options.sleeve ?? DEFAULT_SLEEVE }, { faceVisibility: 'BOTH' });
      card.group.userData.pick = { index: i };
      for (const child of card.group.children) child.layers.enable(PICK_LAYER);
      pedestal.group.userData.pick = { index: i };
      pedestal.group.traverse((o) => o.layers.enable(PICK_LAYER));
      root.add(card.group);
      return { card, pedestal, x: xs[i]!, lift: 0, scale: 1, spin: 0 };
    });
    acquired = null;
    frame();
    layout(0);
  }

  function layout(dt: number): boolean {
    let moving = false;
    slots.forEach((s, i) => {
      const isSel = selected === i || acquired === i;
      const isFocus = hover === i || focus === i;
      const dimmed = (selected !== null && !isSel) || (acquired !== null && acquired !== i);
      const targetLift = isSel ? 0.2 : isFocus ? 0.12 : 0;
      const targetScale = isSel ? 1.06 : isFocus ? 1.04 : dimmed ? 0.95 : 1;
      const lift = approach(s.lift, targetLift, dt, 55, reduced || dt === 0);
      const scale = approach(s.scale, targetScale, dt, 55, reduced || dt === 0);
      if (lift !== s.lift || scale !== s.scale) moving = true;
      s.lift = lift;
      s.scale = scale;
      s.card.group.position.set(s.x, 0.83 + lift, 0.05);
      s.card.group.rotation.set(-0.06, s.spin, 0);
      s.card.group.scale.setScalar(scale * 1.02);
      s.pedestal.setHighlight(isSel ? 'SELECTED' : isFocus ? 'HOVER' : 'NONE');
    });
    return moving;
  }

  stage.setInput({
    onDown: (p) => p.button === 0,
    onUp: (p) => {
      const i = indexAt(p.x, p.y);
      if (i !== null) for (const cb of listeners.pick) cb(i);
    },
    onHover: (p) => {
      const i = p ? indexAt(p.x, p.y) : null;
      if (i !== hover) {
        hover = i;
        for (const cb of listeners.hover) cb(i);
        rs.requestRender();
      }
      rs.canvas.style.cursor = i !== null ? 'pointer' : '';
    },
  });

  function indexAt(x: number, y: number): number | null {
    const hit = stage.pick(x, y, [root]);
    let o = hit?.object ?? null;
    while (o && !o.userData.pick) o = o.parent;
    const pick = o?.userData.pick as { index: number } | undefined;
    return pick ? pick.index : null;
  }

  stage.addTicker((dt, now) => {
    let animating = layout(dt);
    if (acquire) {
      acquire.t += dt;
      const k = clamp(acquire.t / Math.max(1, acquire.duration), 0, 1);
      const s = slots[acquire.index];
      if (s) {
        if (!reduced) {
          s.spin = Math.PI * 2 * EASINGS.easeInOutCubic(k);
          s.card.group.position.y += 0.35 * Math.sin(Math.PI * k);
        }
        s.card.group.rotation.y = s.spin;
        acquire.ring?.update(k);
      }
      animating = true;
      if (k >= 1) finishAcquire();
    }
    if (rs.quality() !== 'LOW' && !reduced) {
      FINISH_GLOBALS.time.value = now / 1000;
      animating = animating || slots.some((s) => {
        const d = s.card.descriptor();
        return d.kind === 'FACE' && d.face.finish !== 'NORMAL';
      });
    }
    return animating;
  });

  function finishAcquire(): void {
    const a = acquire;
    if (!a) return;
    acquire = null;
    a.ring?.dispose();
    const s = slots[a.index];
    if (s) {
      s.spin = 0;
      s.card.group.rotation.y = 0;
    }
    a.resolve();
    rs.requestRender();
  }

  stage.onRect(frame);
  setOffers(options.offers);

  const rectOf = (v: CardVisual): CssRect => {
    v.group.updateWorldMatrix(true, false);
    const pts = [[-0.5, -0.7], [0.5, -0.7], [0.5, 0.7], [-0.5, 0.7]].map(([x, y]) => stage.project(new Vector3(x!, y!, 0).applyMatrix4(v.group.matrixWorld)));
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  };

  const subscribe = <T>(set: Set<T>, cb: T) => {
    set.add(cb);
    return () => {
      set.delete(cb);
    };
  };

  return {
    setRect: stage.setRect,
    setActive: (on) => {
      stage.setActive(on);
      if (on) rs.requestRender();
    },
    setOffers,
    setFocus: (i) => {
      focus = i;
      rs.requestRender();
    },
    setSelected: (i) => {
      selected = i;
      rs.requestRender();
    },
    playAcquire: (index) => {
      finishAcquire();
      acquired = index;
      selected = index;
      const duration = scaleDuration(ACQUIRE_MS, { speed, reducedMotion: reduced });
      const s = slots[index];
      return new Promise<void>((resolve) => {
        if (!s || duration <= 0) {
          resolve();
          rs.requestRender();
          return;
        }
        const ring = createRingEffect(rs, root, { position: new Vector3(s.x, 0.01, 0), color: '#FFFFFF', radius: 0.8, maxScale: 1.8, opacity: 0.9 });
        acquire = { index, t: 0, duration: Math.max(duration, reduced ? Math.min(150, uiPresetDurationMs('UI_DRAWER')) : 0), resolve, ring };
        rs.requestRender();
      });
    },
    onPick: (cb) => subscribe(listeners.pick, cb),
    onHover: (cb) => subscribe(listeners.hover, cb),
    getCardRects: () => slots.map((s) => rectOf(s.card)),
    setReducedMotion: (on) => {
      reduced = on;
      rs.requestRender();
    },
    setSpeed: (sp) => {
      speed = sp;
      if (sp === 'INSTANT') finishAcquire();
    },
    dispose: () => {
      finishAcquire();
      for (const set of Object.values(listeners)) set.clear();
      for (const s of slots) {
        s.card.disposeVisual();
        s.pedestal.dispose();
      }
      slots = [];
      rs.canvas.style.cursor = '';
      stage.dispose();
    },
  };
}
