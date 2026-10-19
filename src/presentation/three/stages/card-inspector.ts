// Palco `card-inspector` (runtime §12.4; interface §11.6): uma carta em alta resolução com frente, verso e
// lateral; rotação limitada por arrasto (sem orbitar a tela), "Ver verso" e "Frente"/"Centralizar"
// explícitos, prévia de acabamento. O texto da carta continua em HTML no painel da UI.
import { Group, PerspectiveCamera, Vector3 } from 'three';
import type { CardFaceData } from '../../../domain/cards/text.ts';
import type { RenderSystem } from '../core/render-system.ts';
import type { CssRect } from '../core/viewport.ts';
import { createCardVisual, type CardVisual } from '../card/card-visual.ts';
import { DEFAULT_SLEEVE, type SleeveStyle } from '../card/face-canvas.ts';
import { FINISH_GLOBALS, type FinishKind } from '../card/finish-material.ts';
import { loadCardFonts } from '../card/fonts.ts';
import { CARD_HEIGHT, CARD_WIDTH } from '../card/geometry.ts';
import { approach, createPanelStage, dragTracker, type StageBackground } from './stage-base.ts';
import { createContactShadow, framePerspective } from './props.ts';

export type InspectorSide = 'FRONT' | 'BACK';

/** Limites de rotação por arrasto (rad): ±32° de guinada, ±18° de arfagem em torno do lado atual. */
export const INSPECTOR_LIMITS = { yaw: (32 * Math.PI) / 180, pitch: (18 * Math.PI) / 180 } as const;

export type CardInspectorOptions = {
  readonly rect?: CssRect;
  readonly face?: CardFaceData | null;
  readonly sleeve?: SleeveStyle;
  readonly finishPreview?: FinishKind | null;
  readonly reducedMotion?: boolean;
  readonly background?: StageBackground;
  /** Ordem do viewport (padrão 30, acima de palcos de fundo). */
  readonly order?: number;
};

export type CardInspectorStage = {
  readonly setRect: (rect: CssRect) => void;
  readonly setActive: (active: boolean) => void;
  readonly setCard: (face: CardFaceData | null, sleeve?: SleeveStyle) => void;
  /** Troca só o material de acabamento (prévia de variante); nulo = acabamento da impressão. */
  readonly setFinishPreview: (finish: FinishKind | null) => void;
  /** "Frente" / "Centralizar": volta à frente sem inclinação. */
  readonly showFront: () => void;
  /** "Ver verso". */
  readonly showBack: () => void;
  readonly toggleSide: () => void;
  readonly side: () => InspectorSide;
  /** Rotação por teclado (setas), dentro dos mesmos limites do arrasto. */
  readonly rotateBy: (dYaw: number, dPitch: number) => void;
  readonly onSideChange: (cb: (side: InspectorSide) => void) => () => void;
  readonly setReducedMotion: (on: boolean) => void;
  /** Retângulo CSS (canvas) ocupado pela carta — para foco visível/rotulagem em HTML. */
  readonly getCardRect: () => CssRect;
  readonly dispose: () => void;
};

/** Ângulos alvo limitados em torno do lado atual. Pura. */
export function clampInspectorRotation(side: InspectorSide, yaw: number, pitch: number): { yaw: number; pitch: number } {
  const base = side === 'FRONT' ? 0 : Math.PI;
  return {
    yaw: Math.min(base + INSPECTOR_LIMITS.yaw, Math.max(base - INSPECTOR_LIMITS.yaw, yaw)),
    pitch: Math.min(INSPECTOR_LIMITS.pitch, Math.max(-INSPECTOR_LIMITS.pitch, pitch)),
  };
}

export function createCardInspectorStage(rs: RenderSystem, options: CardInspectorOptions = {}): CardInspectorStage {
  void loadCardFonts();
  const camera = new PerspectiveCamera(28, 1, 0.1, 100);
  const stage = createPanelStage(rs, { id: 'card-inspector', camera, rect: options.rect, background: options.background, order: options.order ?? 30 });
  const pivot = new Group();
  pivot.name = 'InspectorPivot';
  stage.scene.add(pivot);
  const shadow = createContactShadow(rs, CARD_WIDTH * 1.15, 0.42, 0.3);
  shadow.mesh.position.set(0, -CARD_HEIGHT / 2 - 0.08, 0);
  stage.scene.add(shadow.mesh);

  let reduced = options.reducedMotion ?? false;
  let side: InspectorSide = 'FRONT';
  let target = { yaw: 0, pitch: 0 };
  let current = { yaw: 0, pitch: 0 };
  let hoverTilt = { x: 0, y: 0 };
  let card: CardVisual | null = null;
  let finishPreview: FinishKind | null = options.finishPreview ?? null;
  const sideListeners = new Set<(s: InspectorSide) => void>();
  const resolution = () => (rs.pixelRatio() >= 1.25 || stage.rect().height > 640 ? 'HIGH' : 'STANDARD');

  const frame = () => {
    framePerspective(camera, stage.rect(), { width: CARD_WIDTH, height: CARD_HEIGHT, center: new Vector3(0, 0, 0), margin: 1.14 });
    stage.markDirty();
  };
  stage.onRect(frame);
  frame();

  function setCard(face: CardFaceData | null, sleeve: SleeveStyle = options.sleeve ?? DEFAULT_SLEEVE): void {
    card?.disposeVisual();
    card = null;
    if (face) {
      card = createCardVisual(rs, { kind: 'FACE', face, sleeve }, { resolution: resolution(), faceVisibility: 'BOTH' });
      card.setFinishOverride(finishPreview);
      pivot.add(card.group);
    }
    stage.markDirty();
  }

  const setSide = (next: InspectorSide) => {
    if (next !== side) {
      side = next;
      for (const cb of sideListeners) cb(side);
    }
    target = clampInspectorRotation(side, side === 'FRONT' ? 0 : Math.PI, 0);
    stage.markDirty();
    rs.requestRender();
  };

  const drag = dragTracker(3);
  stage.setInput({
    onDown: (p) => {
      if (p.button !== 0) return false;
      drag.down(p);
      return true;
    },
    onMove: (p) => {
      const d = drag.move(p);
      if (!d || !d.started) return;
      target = clampInspectorRotation(side, target.yaw + d.dx * 0.0085, target.pitch + d.dy * 0.0065);
      rs.requestRender();
    },
    onUp: () => {
      drag.up();
    },
    onCancel: () => {
      drag.up();
    },
    onHover: (p) => {
      const r = stage.rect();
      hoverTilt = p && !reduced && !drag.active() ? { x: ((p.x - r.x) / r.width - 0.5) * 0.16, y: ((p.y - r.y) / r.height - 0.5) * 0.12 } : { x: 0, y: 0 };
      rs.requestRender();
    },
  });

  stage.addTicker((dt, now) => {
    const ty = target.yaw + hoverTilt.x;
    const tp = target.pitch + hoverTilt.y;
    const half = reduced ? 0 : 70;
    current = { yaw: approach(current.yaw, ty, dt, half, reduced), pitch: approach(current.pitch, tp, dt, half, reduced) };
    pivot.rotation.set(current.pitch, current.yaw, 0);
    if (rs.quality() !== 'LOW') FINISH_GLOBALS.time.value = now / 1000;
    const moving = Math.abs(current.yaw - ty) + Math.abs(current.pitch - tp) > 1e-4;
    const animatedFinish = !!card && card.descriptor().kind === 'FACE' && rs.quality() !== 'LOW' && !reduced
      && ((finishPreview ?? (card.descriptor() as { face: CardFaceData }).face.finish) !== 'NORMAL');
    return moving || animatedFinish;
  });

  setCard(options.face ?? null, options.sleeve);

  return {
    setRect: stage.setRect,
    setActive: (on) => {
      stage.setActive(on);
      if (on) rs.requestRender();
    },
    setCard: (face, sleeve) => {
      setCard(face, sleeve);
      setSide('FRONT');
    },
    setFinishPreview: (f) => {
      finishPreview = f;
      card?.setFinishOverride(f);
      rs.requestRender();
    },
    showFront: () => setSide('FRONT'),
    showBack: () => setSide('BACK'),
    toggleSide: () => setSide(side === 'FRONT' ? 'BACK' : 'FRONT'),
    side: () => side,
    rotateBy: (dy, dp) => {
      target = clampInspectorRotation(side, target.yaw + dy, target.pitch + dp);
      rs.requestRender();
    },
    onSideChange: (cb) => {
      sideListeners.add(cb);
      return () => sideListeners.delete(cb);
    },
    setReducedMotion: (on) => {
      reduced = on;
      if (on) hoverTilt = { x: 0, y: 0 };
      rs.requestRender();
    },
    getCardRect: () => {
      pivot.updateWorldMatrix(true, false);
      const corners = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].map(([x, y]) => stage.project(new Vector3(x! * CARD_WIDTH, y! * CARD_HEIGHT, 0).applyMatrix4(pivot.matrixWorld)));
      const xs = corners.map((c) => c.x);
      const ys = corners.map((c) => c.y);
      return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
    },
    dispose: () => {
      sideListeners.clear();
      card?.disposeVisual();
      card = null;
      shadow.dispose();
      stage.dispose();
    },
  };
}
