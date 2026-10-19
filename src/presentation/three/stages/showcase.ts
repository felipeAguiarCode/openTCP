// Palco `home` / `deck-preview` (runtime §12.4; interface §7.1; direção visual §13.2): vitrine clara com
// algumas cartas num pedestal, DeckBoxVisual opcional com o verso cosmético, balanço lento (desligado em
// movimento reduzido) e inclinação leve com o ponteiro. Ações e textos ficam em HTML.
import { Group, PerspectiveCamera, Vector3 } from 'three';
import type { CardFaceData } from '../../../domain/cards/text.ts';
import type { RenderSystem } from '../core/render-system.ts';
import type { CssRect } from '../core/viewport.ts';
import { createCardVisual, PICK_LAYER, type CardVisual } from '../card/card-visual.ts';
import { DEFAULT_SLEEVE, type SleeveStyle } from '../card/face-canvas.ts';
import { FINISH_GLOBALS } from '../card/finish-material.ts';
import { loadCardFonts } from '../card/fonts.ts';
import { approach, createPanelStage, type StageBackground } from './stage-base.ts';
import { createDeckBoxVisual, createPedestal, framePerspective, type DeckBoxInput, type Pedestal } from './props.ts';

export type ShowcaseCard = { readonly face: CardFaceData; readonly sleeve?: SleeveStyle };

export type ShowcaseOptions = {
  readonly rect?: CssRect;
  readonly cards: readonly ShowcaseCard[];
  readonly deckBox?: DeckBoxInput | null;
  readonly reducedMotion?: boolean;
  readonly background?: StageBackground;
  readonly order?: number;
};

export type ShowcasePick = { readonly kind: 'CARD'; readonly index: number; readonly printingId: string } | { readonly kind: 'DECKBOX' };

export type ShowcaseStage = {
  readonly setRect: (rect: CssRect) => void;
  readonly setActive: (active: boolean) => void;
  readonly setCards: (cards: readonly ShowcaseCard[]) => void;
  readonly setDeckBox: (deckBox: DeckBoxInput | null) => void;
  readonly setReducedMotion: (on: boolean) => void;
  readonly onPick: (cb: (pick: ShowcasePick) => void) => () => void;
  readonly getCardRects: () => CssRect[];
  readonly dispose: () => void;
};

/** Poses em leque sobre o pedestal: a carta 0 ao centro e à frente; as demais alternam lados, atrás. Pura. */
export function showcasePoses(n: number): { x: number; y: number; z: number; rotY: number; rotZ: number }[] {
  const out: { x: number; y: number; z: number; rotY: number; rotZ: number }[] = [];
  for (let i = 0; i < n; i += 1) {
    if (i === 0) {
      out.push({ x: 0, y: 0.72, z: 0.12, rotY: 0, rotZ: 0 });
      continue;
    }
    const side = i % 2 === 1 ? -1 : 1;
    const ring = Math.ceil(i / 2);
    out.push({ x: side * (0.62 + (ring - 1) * 0.42), y: 0.7 - ring * 0.02, z: -0.1 * ring, rotY: -side * 0.32, rotZ: side * 0.05 });
  }
  return out;
}

export function createShowcaseStage(rs: RenderSystem, options: ShowcaseOptions): ShowcaseStage {
  void loadCardFonts();
  const camera = new PerspectiveCamera(30, 16 / 9, 0.1, 100);
  const stage = createPanelStage(rs, { id: 'home-showcase', camera, rect: options.rect, background: options.background, order: options.order ?? 20 });
  let reduced = options.reducedMotion ?? false;
  const root = new Group();
  root.name = 'ShowcaseRoot';
  stage.scene.add(root);
  const pedestal: Pedestal = createPedestal(rs, { radius: 1.25, height: 0.26 });
  root.add(pedestal.group);
  const cardsRoot = new Group();
  root.add(cardsRoot);
  let cards: CardVisual[] = [];
  let deckBox: ReturnType<typeof createDeckBoxVisual> | null = null;
  const listeners = new Set<(p: ShowcasePick) => void>();
  let tilt = { x: 0, y: 0 };
  let current = { x: 0, y: 0 };
  let t = 0;

  const frame = () => {
    framePerspective(camera, stage.rect(), { width: deckBox ? 3.9 : 3.0, height: 2.45, center: new Vector3(deckBox ? -0.38 : 0, 0.36, 0), margin: 1.08, elevationDeg: 9 });
    stage.markDirty();
  };

  function setCards(list: readonly ShowcaseCard[]): void {
    for (const c of cards) c.disposeVisual();
    const poses = showcasePoses(list.length);
    cards = list.map((c, i) => {
      const v = createCardVisual(rs, { kind: 'FACE', face: c.face, sleeve: c.sleeve ?? DEFAULT_SLEEVE }, { faceVisibility: 'BOTH' });
      const pose = poses[i]!;
      v.group.position.set(pose.x, pose.y, pose.z);
      v.group.rotation.set(-0.04, pose.rotY, pose.rotZ);
      v.group.scale.setScalar(i === 0 ? 1 : 0.9);
      v.group.userData.pick = { kind: 'CARD', index: i, printingId: c.face.printingId } satisfies ShowcasePick;
      for (const child of v.group.children) child.layers.enable(PICK_LAYER);
      cardsRoot.add(v.group);
      return v;
    });
    // A carta central desenha por cima das laterais (mesma profundidade aproximada).
    cards.forEach((c, i) => c.setRenderOrder(i === 0 ? 2 : 1));
    stage.markDirty();
  }

  function setDeckBox(input: DeckBoxInput | null): void {
    deckBox?.dispose();
    deckBox = null;
    if (input) {
      deckBox = createDeckBoxVisual(rs, input);
      deckBox.group.position.set(-1.9, -0.3, -0.05);
      deckBox.group.rotation.y = 0.5;
      deckBox.group.scale.setScalar(0.6);
      deckBox.group.userData.pick = { kind: 'DECKBOX' } satisfies ShowcasePick;
      deckBox.group.traverse((o) => o.layers.enable(PICK_LAYER));
      root.add(deckBox.group);
    }
    frame();
  }

  stage.setInput({
    onDown: (p) => p.button === 0,
    onUp: (p) => {
      const hit = stage.pick(p.x, p.y, [cardsRoot, ...(deckBox ? [deckBox.group] : [])]);
      let o = hit?.object ?? null;
      while (o && !o.userData.pick) o = o.parent;
      const pick = o?.userData.pick as ShowcasePick | undefined;
      if (pick) for (const cb of listeners) cb(pick);
    },
    onHover: (p) => {
      const r = stage.rect();
      tilt = p && !reduced ? { x: ((p.x - r.x) / r.width - 0.5) * 0.25, y: ((p.y - r.y) / r.height - 0.5) * 0.12 } : { x: 0, y: 0 };
      rs.requestRender();
    },
  });

  stage.addTicker((dt, now) => {
    t += dt;
    const sway = reduced ? 0 : Math.sin(t / 2600) * 0.08;
    current = { x: approach(current.x, tilt.x + sway, dt, 160, reduced), y: approach(current.y, tilt.y, dt, 160, reduced) };
    cardsRoot.rotation.set(current.y * 0.5, current.x, 0);
    if (rs.quality() !== 'LOW') FINISH_GLOBALS.time.value = now / 1000;
    return !reduced;
  });

  stage.onRect(frame);
  setDeckBox(options.deckBox ?? null);
  setCards(options.cards);
  frame();

  const rectOf = (v: CardVisual): CssRect => {
    v.group.updateWorldMatrix(true, false);
    const pts = [[-0.5, -0.7], [0.5, -0.7], [0.5, 0.7], [-0.5, 0.7]].map(([x, y]) => stage.project(new Vector3(x!, y!, 0).applyMatrix4(v.group.matrixWorld)));
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  };

  return {
    setRect: stage.setRect,
    setActive: (on) => {
      stage.setActive(on);
      if (on) rs.requestRender();
    },
    setCards,
    setDeckBox,
    setReducedMotion: (on) => {
      reduced = on;
      rs.requestRender();
    },
    onPick: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getCardRects: () => cards.map(rectOf),
    dispose: () => {
      listeners.clear();
      for (const c of cards) c.disposeVisual();
      cards = [];
      deckBox?.dispose();
      pedestal.dispose();
      stage.dispose();
    },
  };
}
