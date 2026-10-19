// Palco `pack-opening` (runtime §19.10; interface §9.9; direção visual §12): PackVisual em pé com costura
// superior; corte por gesto (arrasto horizontal na costura) ou botão; a pilha emerge com um único giro de
// apresentação; a carta da frente desliza para revelar a próxima; revelação especial por impressão;
// "Revelar todas" e resumo. Nunca decide conteúdo: recebe a lista já confirmada (recibo da abertura).
import {
  AdditiveBlending, BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, PerspectiveCamera, PlaneGeometry, Vector3, type Material,
} from 'three';
import type { CardFaceData } from '../../../domain/cards/text.ts';
import { phaseProgress, presetDurationMs, uiPresetDurationMs } from '../../animation/catalog.ts';
import { EASINGS, clamp, lerp } from '../../animation/easing.ts';
import type { SpeedMode } from '../../animation/timing.ts';
import type { RenderSystem } from '../core/render-system.ts';
import { QUALITY_PROFILES } from '../core/quality.ts';
import { createVisualRng } from '../core/rng.ts';
import { COLORS, mixHex, typeColor } from '../core/tokens.ts';
import type { CssRect } from '../core/viewport.ts';
import { createCardVisual, PICK_LAYER, type CardVisual } from '../card/card-visual.ts';
import { DEFAULT_SLEEVE, drawCardFace, type SleeveStyle } from '../card/face-canvas.ts';
import { FINISH_GLOBALS } from '../card/finish-material.ts';
import { CARD_FONT_STACK, loadCardFonts } from '../card/fonts.ts';
import { paintPattern } from '../card/patterns.ts';
import { acquireCanvasTexture, createCanvas, releaseTexture, type TextureLease } from '../card/textures.ts';
import { createBurstEffect, createRingEffect, vfxFor, type EffectHandle } from '../battle/effects.ts';
import { createContactShadow, framePerspective } from './props.ts';
import { packReduce, packStepMs, revealPresetFor, summaryGrid, type PackPhase, type PackState } from './pack-sequence.ts';
import { createPanelStage, type StageBackground } from './stage-base.ts';
import { themeOfProduct, type ChapterTheme } from './themes.ts';

export type PackProductInput = {
  readonly productId: string;
  readonly name: string;
  /** Paleta da embalagem; padrão = tema do capítulo do produto. */
  readonly palette?: readonly string[];
  readonly cover?: CardFaceData | null;
  /** Frente oficial do booster (assets/pack-art.ts), já carregada; sem ela, a embalagem gerada pelo tema. */
  readonly art?: HTMLImageElement | null;
};

export type PackOpeningOptions = {
  readonly rect?: CssRect;
  readonly product: PackProductInput;
  /** Cartas confirmadas, na ordem do recibo. Pode chegar depois (setCards) — a extração espera por elas. */
  readonly cards?: readonly CardFaceData[] | null;
  readonly sleeve?: SleeveStyle;
  readonly speed?: SpeedMode;
  readonly reducedMotion?: boolean;
  readonly background?: StageBackground;
  readonly order?: number;
  /** Retomada: índice já apresentado (−1 = pacote fechado) e se o resumo já foi aberto. */
  readonly restore?: { readonly index: number; readonly done: boolean } | null;
};

export type PackPick = { readonly kind: 'CARD'; readonly index: number } | { readonly kind: 'PACK' };

export type PackOpeningStage = {
  readonly setRect: (rect: CssRect) => void;
  readonly setActive: (active: boolean) => void;
  readonly setCards: (cards: readonly CardFaceData[]) => void;
  /** Botão/teclado "Abrir": corte + extração; resolve com a primeira carta de frente. */
  readonly tear: () => Promise<void>;
  /** Progresso do gesto de corte (0..1) dirigido de fora (ex.: teclado); ≥ 1 confirma o corte. */
  readonly setTearProgress: (progress: number) => void;
  /** "Próxima": a carta da frente desliza; depois da última, abre o resumo. */
  readonly next: () => Promise<void>;
  /** "Revelar todas": vai direto ao resumo. */
  readonly revealAll: () => void;
  /** Conclui a animação em curso imediatamente (mesma pose final). */
  readonly skip: () => void;
  readonly phase: () => PackPhase;
  readonly index: () => number;
  readonly onPhaseChange: (cb: (phase: PackPhase) => void) => () => void;
  /** Carta `index` ficou de frente e legível (só então a UI mostra nome/“Nova”). */
  readonly onCardRevealed: (cb: (index: number, face: CardFaceData) => void) => () => void;
  readonly onSummary: (cb: (cards: readonly CardFaceData[]) => void) => () => void;
  readonly onPick: (cb: (pick: PackPick) => void) => () => void;
  readonly setSpeed: (speed: SpeedMode) => void;
  readonly setReducedMotion: (on: boolean) => void;
  /** Retângulo CSS da carta da frente (ou do pacote fechado) para rótulos HTML. */
  readonly getFocusRect: () => CssRect;
  readonly getCardRects: () => CssRect[];
  readonly dispose: () => void;
};

const PACK_W = 1.36;
const PACK_H = 1.84;
/** Com a arte oficial: altura máxima da embalagem (cabe no enquadramento) e fração do topo que é a tira de corte. */
const ART_MAX_H = 2.4;
const ART_STRIP = 0.145;
const PACK_D = 0.13;
const STRIP_H = 0.26;
const CARD_SCALE = 1.36;
const STACK_GAP = 0.016;
const FRAME = { width: 3.0, height: 2.9, margin: 1.06 } as const;

type Anim = { readonly duration: number; elapsed: number; readonly update: (t: number, ms: number) => void; readonly finish: () => void; readonly resolve: () => void };

function drawPackArt(ctx: CanvasRenderingContext2D, w: number, h: number, product: PackProductInput, theme: ChapterTheme, palette: readonly string[]): void {
  const [, c1 = theme.palette[1], c2 = theme.palette[2], c3 = theme.accent] = palette;
  const g = ctx.createLinearGradient(0, 0, w * 0.4, h);
  g.addColorStop(0, mixHex(c1, '#FFFFFF', 0.15));
  g.addColorStop(0.55, c3);
  g.addColorStop(1, mixHex(c3, COLORS.text, 0.18));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 0.22;
  paintPattern(ctx, theme.pattern, { x: 0, y: 0, w, h }, '#FFFFFF', createVisualRng(`pack:${product.productId}`), w / 14);
  ctx.globalAlpha = 1;
  // Raios claros multicoloridos atrás da capa (referência RP07), sem portal escuro.
  const cx = w / 2;
  const cy = h * 0.42;
  for (let i = 0; i < 14; i += 1) {
    const a = (i / 14) * Math.PI * 2;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.16)' : `${mixHex(c2, '#FFFFFF', 0.4)}33`;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, w, a, a + Math.PI / 14);
    ctx.closePath();
    ctx.fill();
  }
  const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, w * 0.5);
  glow.addColorStop(0, 'rgba(255,255,255,0.75)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  // Capa: carta de capa (frente autorizada do catálogo) inclinada, ou emblema.
  if (product.cover) {
    const cw = w * 0.5;
    const ch = cw * 1.4;
    const face = createCanvas(500, 700);
    drawCardFace(face.getContext('2d')!, product.cover, 500, 700);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.08);
    ctx.shadowColor = 'rgba(38,58,80,0.35)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;
    ctx.drawImage(face, -cw / 2, -ch / 2, cw, ch);
    ctx.restore();
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Nome do produto em branco sobre faixa escurecida do acento (contraste ≥ 4,5:1).
  const bandY = h * 0.76;
  ctx.fillStyle = mixHex(c3, COLORS.text, 0.55);
  ctx.globalAlpha = 0.88;
  ctx.fillRect(0, bandY, w, h * 0.13);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = w * 0.085;
  ctx.font = `900 ${size}px ${CARD_FONT_STACK}`;
  while (ctx.measureText(product.name).width > w * 0.88 && size > w * 0.045) {
    size -= 1;
    ctx.font = `900 ${size}px ${CARD_FONT_STACK}`;
  }
  let label = product.name;
  while (ctx.measureText(label).width > w * 0.88 && label.length > 2) label = `${label.slice(0, -2)}…`;
  ctx.fillText(label, cx, bandY + h * 0.065);
  ctx.font = `800 ${w * 0.042}px ${CARD_FONT_STACK}`;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText('PACOTE DE CARTAS', cx, h * 0.93);
  // Crimpagem inferior (a superior é a tira destacável).
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let x = 0; x < w; x += 14) ctx.fillRect(x, h - 10, 7, 10);
}

function drawStrip(ctx: CanvasRenderingContext2D, w: number, h: number, theme: ChapterTheme, palette: readonly string[]): void {
  const c3 = palette[3] ?? theme.accent;
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, mixHex(theme.palette[1], '#FFFFFF', 0.2));
  g.addColorStop(1, mixHex(c3, '#FFFFFF', 0.25));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  for (let x = 0; x < w; x += 14) ctx.fillRect(x, 0, 7, h * 0.34);
  // Linha pontilhada da costura e seta de gesto.
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, h - 6);
  ctx.lineTo(w, h - 6);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.moveTo(w * 0.86, h * 0.48);
  ctx.lineTo(w * 0.93, h * 0.62);
  ctx.lineTo(w * 0.86, h * 0.76);
  ctx.closePath();
  ctx.fill();
}

export function createPackOpeningStage(rs: RenderSystem, options: PackOpeningOptions): PackOpeningStage {
  void loadCardFonts();
  const camera = new PerspectiveCamera(30, 16 / 9, 0.1, 100);
  const stage = createPanelStage(rs, { id: 'pack-opening', camera, rect: options.rect, background: options.background, order: options.order ?? 30 });
  const product = options.product;
  const theme = themeOfProduct(product.productId);
  const palette = product.palette?.length ? product.palette : [...theme.palette.slice(0, 3), theme.accent];
  // Com a arte oficial, a embalagem toma a proporção da imagem; a tira de cima leva a faixa do logo até a linha de corte.
  const art = product.art && product.art.width > 0 ? product.art : null;
  const PW = art ? Math.min(PACK_W, (ART_MAX_H * art.width) / art.height) : PACK_W;
  const totalH = art ? (PW * art.height) / art.width : PACK_H + STRIP_H;
  const SH = art ? totalH * ART_STRIP : STRIP_H;
  const PH = totalH - SH;
  let speed: SpeedMode = options.speed ?? 'NORMAL';
  let reduced = options.reducedMotion ?? false;
  const sleeve = options.sleeve ?? DEFAULT_SLEEVE;
  let cards: readonly CardFaceData[] = options.cards ?? [];
  let state: PackState = { phase: 'SEALED', index: -1, total: cards.length };
  const listeners = {
    phase: new Set<(p: PackPhase) => void>(),
    revealed: new Set<(i: number, f: CardFaceData) => void>(),
    summary: new Set<(c: readonly CardFaceData[]) => void>(),
    pick: new Set<(p: PackPick) => void>(),
  };

  // --------------------------------------------------------------------------------- PackVisual
  const root = new Group();
  root.name = 'PackOpeningRoot';
  stage.scene.add(root);
  const shadow = createContactShadow(rs, 2.4, 0.9, 0.38);
  shadow.mesh.position.set(0, -PH / 2 - 0.12, 0);
  root.add(shadow.mesh);
  const pack = new Group();
  pack.name = 'PackVisual';
  root.add(pack);
  const owned: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => {
    owned.push(x);
    return x;
  };
  const artLease: TextureLease = art
    ? acquireCanvasTexture(rs, `pack:art-img:${product.productId}`, 512, Math.round((512 * PH) / PW), (ctx, w, h) => ctx.drawImage(art, 0, art.height * ART_STRIP, art.width, art.height * (1 - ART_STRIP), 0, 0, w, h))
    : acquireCanvasTexture(rs, `pack:art:${product.productId}:${product.name}:${product.cover?.printingId ?? ''}`, 512, 694, (ctx, w, h) => drawPackArt(ctx, w, h, product, theme, palette));
  const stripLease: TextureLease = art
    ? acquireCanvasTexture(rs, `pack:strip-img:${product.productId}`, 512, Math.max(32, Math.round((512 * SH) / PW)), (ctx, w, h) => ctx.drawImage(art, 0, 0, art.width, art.height * ART_STRIP, 0, 0, w, h))
    : acquireCanvasTexture(rs, `pack:strip:${product.productId}`, 512, 98, (ctx, w, h) => drawStrip(ctx, w, h, theme, palette));
  const sideMat = keep(new MeshLambertMaterial({ color: mixHex(palette[3] ?? theme.accent, '#FFFFFF', 0.35) }));
  const frontMat = keep(new MeshBasicMaterial({ map: artLease.texture, toneMapped: false, transparent: true }));
  const backMat = keep(new MeshLambertMaterial({ color: mixHex(palette[1] ?? theme.palette[1], '#FFFFFF', 0.2), transparent: true }));
  const bodyMats: Material[] = [sideMat, sideMat, sideMat, sideMat, frontMat, backMat];
  const body = new Mesh(keep(new BoxGeometry(PW, PH, PACK_D)), bodyMats);
  body.name = 'PackBody';
  body.userData.pick = { kind: 'PACK' };
  body.layers.enable(PICK_LAYER);
  pack.add(body);
  const stripMat = keep(new MeshBasicMaterial({ map: stripLease.texture, toneMapped: false, transparent: true }));
  const strip = new Mesh(keep(new BoxGeometry(PW, SH, PACK_D * 0.9)), [sideMat, sideMat, sideMat, sideMat, stripMat, backMat]);
  strip.name = 'PackTopStrip';
  const stripHome = new Vector3(0, PH / 2 + SH / 2, 0);
  strip.position.copy(stripHome);
  pack.add(strip);
  // Linha luminosa da costura (percorre da esquerda à direita).
  const seamMat = keep(new MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false }));
  const seam = new Mesh(keep(new PlaneGeometry(1, 0.035)), seamMat);
  seam.position.set(0, PH / 2, PACK_D / 2 + 0.004);
  seam.renderOrder = 5;
  pack.add(seam);
  // Claridade suave saindo da abertura.
  // Claridade suave e colorida saindo da boca (mescla normal: sobre fundo claro, aditivo viraria um bloco branco).
  const mouthLease = acquireCanvasTexture(rs, 'pack:mouth-glow-v2', 256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.22, 'rgba(200,250,245,0.7)');
    g.addColorStop(0.5, 'rgba(214,206,247,0.32)');
    g.addColorStop(1, 'rgba(214,206,247,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, false);
  const mouthMat = keep(new MeshBasicMaterial({ map: mouthLease.texture, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  const mouth = new Mesh(keep(new PlaneGeometry(2.2, 1.6)), mouthMat);
  mouth.position.set(0, PH / 2 + 0.2, -0.05);
  mouth.renderOrder = 4;
  pack.add(mouth);

  // ------------------------------------------------------------------------------------- cartas
  const stack = new Group();
  stack.name = 'PackCardStack';
  root.add(stack);
  let visuals: CardVisual[] = [];
  const seenRoot = new Group();
  root.add(seenRoot);
  const effects: EffectHandle[] = [];
  const resolution = () => (rs.pixelRatio() >= 1.25 ? 'HIGH' : 'STANDARD');

  function buildCards(): void {
    for (const v of visuals) v.disposeVisual();
    visuals = cards.map((face, i) => {
      const v = createCardVisual(rs, { kind: 'FACE', face, sleeve }, { resolution: resolution(), faceVisibility: 'BOTH' });
      v.setPickTarget(null);
      v.group.userData.pick = { kind: 'CARD', index: i };
      for (const child of v.group.children) child.layers.enable(PICK_LAYER);
      stack.add(v.group);
      return v;
    });
    state = { ...state, total: cards.length };
    layoutStackRest();
  }

  /** Meia largura/altura visíveis (mundo) no plano das cartas para o retângulo atual. */
  function visibleHalf(): { w: number; h: number } {
    const r = stage.rect();
    const aspect = r.width > 0 && r.height > 0 ? r.width / r.height : 16 / 9;
    const h = Math.max(FRAME.height / 2, FRAME.width / 2 / aspect) * FRAME.margin;
    return { w: h * aspect, h };
  }

  /** Pose de repouso de cada carta na pilha central (frente = índice atual), vistas já no monte lateral. */
  function stackPose(i: number): { x: number; y: number; z: number; s: number; rz: number; visible: boolean } {
    const front = Math.max(0, state.index);
    if (i < front) {
      const k = front - i;
      const seenX = -Math.max(1.05, Math.min(2.05, visibleHalf().w - 0.34));
      return { x: seenX, y: -0.72 + Math.min(k, 6) * 0.012, z: -0.2 + (front - k) * 0.004, s: 0.5, rz: 0.06 * ((i % 3) - 1), visible: true };
    }
    const depth = i - front;
    return { x: 0, y: 0.04, z: 0.35 - depth * STACK_GAP, s: CARD_SCALE, rz: 0, visible: depth < 6 };
  }

  function placeCard(v: CardVisual, pose: { x: number; y: number; z: number; s: number; rz: number; visible: boolean }, flipY = 0): void {
    v.group.position.set(pose.x, pose.y, pose.z);
    v.group.rotation.set(0, flipY, pose.rz);
    v.group.scale.setScalar(pose.s);
    v.group.visible = pose.visible;
  }

  function layoutStackRest(): void {
    if (state.phase === 'SEALED' || state.phase === 'TEARING') {
      stack.visible = false;
      return;
    }
    stack.visible = true;
    stack.position.set(0, 0, 0);
    stack.rotation.set(0, 0, 0);
    if (state.phase === 'SUMMARY') {
      layoutSummary(1);
      return;
    }
    visuals.forEach((v, i) => {
      placeCard(v, stackPose(i));
      v.setOpacity(1);
    });
  }

  function summaryPose(i: number): { x: number; y: number; z: number; s: number; rz: number; visible: boolean } {
    const half = visibleHalf();
    const grid = summaryGrid(visuals.length, half.w / half.h);
    const viewH = half.h * 2 * 0.92;
    const viewW = half.w * 2 * 0.94;
    const cell = Math.min(viewW / grid.columns, viewH / (grid.rows * 1.4)) * 0.9;
    const s = cell / 1.08;
    const row = Math.floor(i / grid.columns);
    const inRow = Math.min(grid.columns, visuals.length - row * grid.columns);
    const col = i - row * grid.columns;
    return { x: (col - (inRow - 1) / 2) * cell, y: ((grid.rows - 1) / 2 - row) * cell * 1.4 + 0.04, z: 0.2, s, rz: 0, visible: true };
  }

  function layoutSummary(t: number): void {
    const k = EASINGS.easeInOutCubic(clamp(t, 0, 1));
    visuals.forEach((v, i) => {
      const from = { x: v.group.position.x, y: v.group.position.y, z: v.group.position.z, s: v.group.scale.x, rz: v.group.rotation.z };
      const to = summaryPose(i);
      placeCard(v, { x: lerp(from.x, to.x, k), y: lerp(from.y, to.y, k), z: lerp(from.z, to.z, k), s: lerp(from.s, to.s, k), rz: lerp(from.rz, to.rz, k), visible: true });
      v.setFaceVisibility('FRONT');
      v.setOpacity(1);
    });
  }

  function setPackVisible(visible: boolean): void {
    pack.visible = visible;
    shadow.mesh.visible = visible || stack.visible;
  }

  // ------------------------------------------------------------------------------- animação
  let anim: Anim | null = null;
  let tearProgress = 0;
  let tearReturn: { from: number; t: number } | null = null;
  let waitingCards: (() => void) | null = null;

  function setState(next: PackState): void {
    const changed = next.phase !== state.phase;
    state = next;
    if (changed) for (const cb of listeners.phase) cb(state.phase);
  }

  function run(duration: number, update: (t: number, ms: number) => void, finish: () => void): Promise<void> {
    finishAnim();
    return new Promise<void>((resolve) => {
      if (duration <= 0) {
        update(1, 0);
        finish();
        resolve();
        stage.markDirty();
        rs.requestRender();
        return;
      }
      anim = { duration, elapsed: 0, update, finish, resolve };
      update(0, 0);
      rs.requestRender();
    });
  }

  function finishAnim(): void {
    const a = anim;
    if (!a) return;
    anim = null;
    a.update(1, a.duration);
    a.finish();
    a.resolve();
    stage.markDirty();
  }

  function clearEffects(): void {
    for (const e of effects.splice(0)) e.dispose();
  }

  function applyTearVisual(p: number): void {
    seam.visible = p > 0.001;
    seam.scale.x = Math.max(0.001, PW * p);
    seam.position.x = -PW / 2 + (PW * p) / 2;
    seamMat.opacity = p > 0 ? 0.95 : 0;
    strip.rotation.z = -0.05 * p;
    strip.position.set(stripHome.x + 0.02 * p, stripHome.y + 0.015 * p, stripHome.z);
  }

  function resetPack(): void {
    pack.position.set(0, 0, 0);
    pack.rotation.set(0, 0, 0);
    strip.position.copy(stripHome);
    strip.rotation.set(0, 0, 0);
    strip.visible = true;
    stripMat.opacity = 1;
    frontMat.opacity = 1;
    backMat.opacity = 1;
    mouthMat.opacity = 0;
    seamMat.opacity = 0;
    applyTearVisual(0);
  }

  function extract(): Promise<void> {
    setState({ ...state, phase: 'EXTRACTING' });
    const duration = packStepMs('PACK_EXTRACT', speed, reduced);
    const base = presetDurationMs('PACK_EXTRACT');
    state = { ...state, index: 0 };
    stack.visible = true;
    visuals.forEach((v, i) => placeCard(v, stackPose(i), Math.PI));
    return run(duration, (t) => {
      const ms = t * base;
      if (reduced || speed === 'INSTANT') {
        // Movimento reduzido: troca por esmaecimento, sem arco nem giro.
        const k = clamp(t, 0, 1);
        frontMat.opacity = 1 - k;
        backMat.opacity = 1 - k;
        stripMat.opacity = 0;
        visuals.forEach((v, i) => {
          placeCard(v, stackPose(i));
          v.setOpacity(k);
        });
        return;
      }
      const lift = phaseProgress('PACK_EXTRACT', 'LIFT_STACK', ms);
      const align = phaseProgress('PACK_EXTRACT', 'ALIGN_STACK', ms);
      const face = phaseProgress('PACK_EXTRACT', 'FIRST_FACE', ms);
      // Pilha sobe da boca do pacote, centraliza e faz um único giro de apresentação.
      // Dentro do invólucro (atrás da frente do pacote) até alinhar: a boca recorta a pilha que emerge.
      stack.position.set(0, lerp(lerp(-0.25, 1.05, lift), 0, align), lerp(-0.35, 0, align));
      stack.scale.setScalar(lerp(0.78, 1, align));
      stack.rotation.set(0, Math.PI * (1 - face), 0);
      visuals.forEach((v, i) => placeCard(v, stackPose(i)));
      // Invólucro recolhe para baixo e some.
      pack.position.y = lerp(0, -2.9, align);
      frontMat.opacity = 1 - align;
      backMat.opacity = 1 - align;
      mouthMat.opacity = 0.9 * (1 - align);
    }, () => {
      stack.position.set(0, 0, 0);
      stack.scale.setScalar(1);
      stack.rotation.set(0, 0, 0);
      setPackVisible(false);
      setState(packReduce({ ...state, phase: 'EXTRACTING' }, 'EXTRACTED'));
      layoutStackRest();
      revealed();
    });
  }

  function revealed(): void {
    const face = cards[state.index];
    if (face && state.phase === 'REVEALING') for (const cb of listeners.revealed) cb(state.index, face);
  }

  function tearInternal(): Promise<void> {
    if (state.phase !== 'SEALED') return Promise.resolve();
    tearReturn = null;
    setState(packReduce(state, 'TEAR'));
    const duration = packStepMs('PACK_TEAR', speed, reduced);
    const base = presetDurationMs('PACK_TEAR');
    const start = tearProgress;
    const tearDone = run(duration, (t) => {
      const ms = t * base;
      if (reduced || speed === 'INSTANT') {
        stripMat.opacity = 1 - t;
        applyTearVisual(lerp(start, 1, t));
        mouthMat.opacity = 0.8 * t;
        return;
      }
      const seamP = phaseProgress('PACK_TEAR', 'SEAM_HIGHLIGHT', ms);
      const tear = phaseProgress('PACK_TEAR', 'TEAR_TOP', ms);
      const open = phaseProgress('PACK_TEAR', 'OPEN_MOUTH', ms);
      applyTearVisual(lerp(start, 1, seamP));
      // Tira superior separa e sai num arco curto.
      // Arco curto e baixo para a direita: a tira nunca sai do enquadramento do palco.
      strip.position.set(stripHome.x + 1.1 * tear, stripHome.y + 0.16 * Math.sin(Math.PI * Math.min(1, tear * 0.9)), stripHome.z + 0.2 * tear);
      strip.rotation.set(0, 0, -0.26 * tear);
      stripMat.opacity = 1 - clamp((tear - 0.55) / 0.45, 0, 1);
      seamMat.opacity = 0.95 * (1 - open);
      mouthMat.opacity = 0.9 * open;
    }, () => {
      strip.visible = false;
      seamMat.opacity = 0;
    });
    return tearDone.then(() => {
      if (state.phase !== 'TEARING') return;
      if (!cards.length) {
        // A extração espera o recibo (o corte nunca decide conteúdo).
        return new Promise<void>((resolve) => {
          waitingCards = () => {
            waitingCards = null;
            void extract().then(resolve);
          };
        });
      }
      return extract();
    });
  }

  function nextInternal(): Promise<void> {
    if (anim) finishAnim();
    if (state.phase === 'SEALED') return tearInternal();
    if (state.phase !== 'REVEALING') return Promise.resolve();
    const after = packReduce(state, 'NEXT');
    if (after.phase === 'SUMMARY') return toSummary(true);
    const frontIdx = state.index;
    const nextFace = cards[after.index]!;
    const preset = revealPresetFor(nextFace);
    const duration = packStepMs(preset, speed, reduced);
    const base = presetDurationMs(preset);
    const ratio = base / presetDurationMs('PACK_REVEAL');
    const front = visuals[frontIdx]!;
    const incoming = visuals[after.index];
    const fromPose = stackPose(frontIdx);
    state = after;
    const toPose = stackPose(frontIdx);
    const special = preset === 'PACK_REVEAL_SPECIAL';
    clearEffects();
    let fx: { ring: EffectHandle; ring2: EffectHandle; burst: EffectHandle } | null = null;
    if (special && !reduced && speed !== 'INSTANT') {
      const vfx = vfxFor(nextFace.types[0] ?? 'COLORLESS');
      const center = new Vector3(0, 0.04, 0.45);
      fx = {
        ring: createRingEffect(rs, root, { position: center, color: '#FFFFFF', radius: 0.95, maxScale: 1.3, flat: false, opacity: 0.85, thickness: 0.06 }),
        ring2: createRingEffect(rs, root, { position: center, color: typeColor(nextFace.types[0]), radius: 0.85, maxScale: 1.45, flat: false, opacity: 0.55, thickness: 0.08 }),
        burst: createBurstEffect(rs, root, { origin: center, profile: vfx, count: Math.round(QUALITY_PROFILES[rs.quality()].particleBudget * 0.6), spread: 1.6, seed: `pack:${nextFace.printingId}:${after.index}`, size: 0.14, flat: false }),
      };
      effects.push(fx.ring, fx.ring2, fx.burst);
    }
    return run(duration, (t) => {
      const ms = (t * base) / ratio;
      if (reduced || speed === 'INSTANT') {
        placeCard(front, { ...toPose });
        front.setOpacity(t);
        if (incoming) placeCard(incoming, stackPose(after.index));
        return;
      }
      const lift = phaseProgress('PACK_REVEAL', 'LIFT_FRONT', ms);
      const slide = phaseProgress('PACK_REVEAL', 'SLIDE_FRONT_AWAY', ms);
      const settle = phaseProgress('PACK_REVEAL', 'SETTLE_NEXT', ms);
      // Carta da frente: sobe levemente e desliza para o monte de vistas (sem flip de 180°).
      const liftedZ = fromPose.z + 0.18 * lift;
      placeCard(front, {
        x: lerp(fromPose.x, toPose.x, slide), y: lerp(fromPose.y + 0.06 * lift, toPose.y, slide), z: lerp(liftedZ, toPose.z, slide),
        s: lerp(fromPose.s, toPose.s, slide), rz: lerp(-0.04 * lift, toPose.rz, slide) + 0.18 * Math.sin(Math.PI * slide), visible: true,
      });
      if (incoming) {
        const rest = stackPose(after.index);
        placeCard(incoming, { ...rest, z: rest.z - 0.03 * (1 - settle), s: rest.s * (0.97 + 0.03 * settle) });
      }
      if (fx) {
        const k = clamp((t - 0.45) / 0.55, 0, 1);
        fx.ring.update(k);
        fx.ring2.update(clamp(k * 1.2 - 0.1, 0, 1));
        fx.burst.update(k);
      }
    }, () => {
      clearEffects();
      front.setOpacity(1);
      layoutStackRest();
      revealed();
    });
  }

  function toSummary(animated: boolean): Promise<void> {
    finishAnim();
    clearEffects();
    if (!cards.length) return Promise.resolve();
    if (anim) finishAnim();
    setPackVisible(false);
    stack.visible = true;
    stack.position.set(0, 0, 0);
    stack.rotation.set(0, 0, 0);
    stack.scale.setScalar(1);
    setState(packReduce(state, 'REVEAL_ALL'));
    const duration = animated && !reduced && speed !== 'INSTANT' ? uiPresetDurationMs('UI_DRAWER') * 2 : 0;
    const from = visuals.map((v) => ({ p: v.group.position.clone(), s: v.group.scale.x, rz: v.group.rotation.z }));
    return run(duration, (t) => {
      const k = EASINGS.easeInOutCubic(t);
      visuals.forEach((v, i) => {
        const to = summaryPose(i);
        const f = from[i]!;
        placeCard(v, { x: lerp(f.p.x, to.x, k), y: lerp(f.p.y, to.y, k), z: lerp(f.p.z, to.z, k), s: lerp(f.s, to.s, k), rz: lerp(f.rz, 0, k), visible: true });
        v.setFaceVisibility('FRONT');
        v.setOpacity(1);
      });
    }, () => {
      layoutSummary(1);
      for (const cb of listeners.summary) cb(cards);
    });
  }

  // ---------------------------------------------------------------------------------- entrada
  let gesture: { x0: number; y0: number; mode: 'TEAR' | 'SWIPE' | 'TAP'; last: number } | null = null;
  const packRectCss = (): CssRect => {
    const pts = [[-PW / 2, -PH / 2], [PW / 2, -PH / 2], [PW / 2, PH / 2 + SH], [-PW / 2, PH / 2 + SH]]
      .map(([x, y]) => stage.project(new Vector3(x!, y!, PACK_D / 2)));
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  };
  stage.setInput({
    onDown: (p) => {
      if (p.button !== 0) return false;
      if (state.phase === 'SEALED') {
        const r = packRectCss();
        const inPack = p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
        if (!inPack) return false;
        const nearSeam = p.y <= r.y + r.height * 0.32;
        gesture = { x0: p.x, y0: p.y, mode: nearSeam ? 'TEAR' : 'TAP', last: p.x };
        tearReturn = null;
        return true;
      }
      gesture = { x0: p.x, y0: p.y, mode: 'SWIPE', last: p.x };
      return true;
    },
    onMove: (p) => {
      if (!gesture) return;
      gesture.last = p.x;
      if (gesture.mode === 'TEAR' && state.phase === 'SEALED') {
        const r = packRectCss();
        tearProgress = clamp((p.x - gesture.x0) / Math.max(40, r.width * 0.9), 0, 1);
        applyTearVisual(tearProgress);
        rs.requestRender();
        stage.markDirty();
        if (tearProgress >= 1) {
          gesture = null;
          void tearInternal();
        }
      }
    },
    onUp: (p) => {
      const g = gesture;
      gesture = null;
      if (!g) return;
      const dx = p.x - g.x0;
      const moved = Math.hypot(dx, p.y - g.y0) > 8;
      if (g.mode === 'TEAR' && state.phase === 'SEALED') {
        if (tearProgress >= 0.55) void tearInternal();
        else if (tearProgress > 0) tearReturn = { from: tearProgress, t: 0 };
        else if (!moved) for (const cb of listeners.pick) cb({ kind: 'PACK' });
        rs.requestRender();
        return;
      }
      if (g.mode === 'TAP' && !moved) {
        for (const cb of listeners.pick) cb({ kind: 'PACK' });
        return;
      }
      if (g.mode === 'SWIPE') {
        if (state.phase === 'REVEALING' && dx < -50) {
          void nextInternal();
          return;
        }
        if (!moved) {
          const hit = stage.pick(p.x, p.y, [stack]);
          let o = hit?.object ?? null;
          while (o && !o.userData.pick) o = o.parent;
          const pick = o?.userData.pick as PackPick | undefined;
          if (pick) for (const cb of listeners.pick) cb(pick);
        }
      }
    },
    onCancel: () => {
      if (gesture?.mode === 'TEAR' && state.phase === 'SEALED' && tearProgress > 0) tearReturn = { from: tearProgress, t: 0 };
      gesture = null;
    },
  });

  // ----------------------------------------------------------------------------------- loop
  let idleT = 0;
  stage.addTicker((dt, now) => {
    let animating = false;
    if (anim) {
      anim.elapsed += dt;
      const t = clamp(anim.elapsed / anim.duration, 0, 1);
      anim.update(t, anim.elapsed);
      if (t >= 1) finishAnim();
      animating = true;
    }
    if (tearReturn) {
      tearReturn.t += dt / uiPresetDurationMs('UI_DRAG_RETURN');
      tearProgress = lerp(tearReturn.from, 0, EASINGS.easeOutCubic(clamp(tearReturn.t, 0, 1)));
      applyTearVisual(tearProgress);
      if (tearReturn.t >= 1) tearReturn = null;
      animating = true;
    }
    // Exposição: rotação limitada e lenta do pacote fechado (desligada em movimento reduzido).
    if (state.phase === 'SEALED' && !reduced && speed !== 'INSTANT' && !gesture) {
      idleT += dt;
      pack.rotation.y = 0.22 * Math.sin(idleT / 1400);
      pack.position.y = 0.03 * Math.sin(idleT / 900);
      animating = true;
    } else if (state.phase === 'SEALED') {
      pack.rotation.y = 0;
    }
    const finishLive = rs.quality() !== 'LOW' && !reduced && state.phase !== 'SEALED' && visuals.some((v) => {
      const d = v.descriptor();
      return v.group.visible && d.kind === 'FACE' && d.face.finish !== 'NORMAL';
    });
    if (finishLive) {
      FINISH_GLOBALS.time.value = now / 1000;
      animating = true;
    }
    return animating;
  });

  const frame = () => {
    framePerspective(camera, stage.rect(), { width: FRAME.width, height: FRAME.height, center: new Vector3(0, 0.12, 0), margin: FRAME.margin, elevationDeg: 4 });
    if (state.phase === 'SUMMARY') layoutSummary(1);
    stage.markDirty();
  };
  stage.onRect(frame);
  frame();
  buildCards();
  resetPack();

  // Retomada: mesmo índice/resumo sem reanimar (o recibo já existe).
  const restore = options.restore;
  if (restore && cards.length) {
    if (restore.done) {
      state = { phase: 'SUMMARY', index: cards.length - 1, total: cards.length };
      setPackVisible(false);
      layoutStackRest();
    } else if (restore.index >= 0) {
      state = { phase: 'REVEALING', index: Math.min(restore.index, cards.length - 1), total: cards.length };
      setPackVisible(false);
      layoutStackRest();
    }
  } else layoutStackRest();

  const subscribe = <T>(set: Set<T>, cb: T) => {
    set.add(cb);
    return () => {
      set.delete(cb);
    };
  };

  const cardRect = (v: CardVisual): CssRect => {
    const g = v.group;
    g.updateWorldMatrix(true, false);
    const pts = [[-0.5, -0.7], [0.5, -0.7], [0.5, 0.7], [-0.5, 0.7]].map(([x, y]) => stage.project(new Vector3(x!, y!, 0).applyMatrix4(g.matrixWorld)));
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
    setCards: (next) => {
      cards = [...next];
      buildCards();
      if (waitingCards) waitingCards();
      rs.requestRender();
    },
    tear: () => tearInternal(),
    setTearProgress: (p) => {
      if (state.phase !== 'SEALED') return;
      tearProgress = clamp(p, 0, 1);
      applyTearVisual(tearProgress);
      rs.requestRender();
      if (tearProgress >= 1) void tearInternal();
    },
    next: () => nextInternal(),
    revealAll: () => {
      if (state.phase === 'SEALED' || state.phase === 'TEARING') {
        finishAnim();
        strip.visible = false;
      }
      void toSummary(false);
    },
    skip: () => finishAnim(),
    phase: () => state.phase,
    index: () => state.index,
    onPhaseChange: (cb) => subscribe(listeners.phase, cb),
    onCardRevealed: (cb) => subscribe(listeners.revealed, cb),
    onSummary: (cb) => subscribe(listeners.summary, cb),
    onPick: (cb) => subscribe(listeners.pick, cb),
    setSpeed: (s) => {
      speed = s;
      if (s === 'INSTANT') finishAnim();
    },
    setReducedMotion: (on) => {
      reduced = on;
      rs.requestRender();
    },
    getFocusRect: () => {
      if (state.phase === 'SEALED' || state.phase === 'TEARING' || !visuals.length) return packRectCss();
      const v = visuals[Math.max(0, state.index)];
      return v ? cardRect(v) : packRectCss();
    },
    getCardRects: () => visuals.map(cardRect),
    dispose: () => {
      finishAnim();
      clearEffects();
      for (const set of Object.values(listeners)) set.clear();
      for (const v of visuals) v.disposeVisual();
      visuals = [];
      shadow.dispose();
      for (const o of owned) o.dispose();
      releaseTexture(rs, artLease);
      releaseTexture(rs, stripLease);
      releaseTexture(rs, mouthLease);
      stage.dispose();
    },
  };
}

