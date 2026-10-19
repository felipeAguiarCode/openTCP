// Composição da frente da carta em Canvas2D a partir de CardFaceData — família `pocket-light-card-v1`
// (pokemon-classic, pokemon-ex, pokemon-full-art, trainer, fossil). A janela de arte usa placeholder tipado (gradiente
// do tipo + glifo geométrico); em “Impressão completa” a imagem é a carta inteira e nada do template é desenhado por
// cima (printed-art.ts). Nenhum texto transborda.
import type { CardFaceData } from '../../../domain/cards/text.ts';
import { TYPE_LABEL } from '../../../domain/cards/text.ts';
import { COLORS, TYPE_COLORS, asTypeId, mixHex, withAlpha } from '../core/tokens.ts';
import { createVisualRng } from '../core/rng.ts';
import { CARD_FONT_STACK } from './fonts.ts';
import { drawEnergySymbol, drawRaritySymbol, drawTrainerEmblem, drawTypeGlyph } from './glyphs.ts';
import { fitLine, fitParagraph, layoutRules, type FontSpec, type Measure, type RulesBlock } from './text-fit.ts';

export const FACE_W = 500;
export const FACE_H = 700;

export type TemplateKind = 'pokemon-classic' | 'pokemon-ex' | 'pokemon-full-art' | 'trainer' | 'fossil';

/** Retângulos do template em unidades de design (500×700, origem superior). */
export const FACE_LAYOUT = {
  outerRadius: 26,
  inner: { x: 16, y: 16, w: 468, h: 668, r: 16 },
  art: { x: 32, y: 84, w: 436, h: 256, r: 8 },
  fullArt: { x: 16, y: 16, w: 468, h: 668, r: 16 },
  rulesPanel: { x: 28, y: 350, w: 444, h: 246 },
} as const;

export const TRAINER_COLORS: Readonly<Record<string, string>> = {
  ITEM: '#2F6DB5',
  SUPPORTER: '#B4561C',
  TOOL: '#6D47AD',
  STADIUM: '#2E7D4F',
  FOSSIL: '#7A5A3A',
};

const TEXT = COLORS.text;
const TEXT_2 = COLORS.textSecondary;
const ABILITY_RED = '#B83A4B';

const LABEL_TO_TYPE: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(TYPE_LABEL).map(([k, v]) => [v, k]));

export function templateKindOf(face: Pick<CardFaceData, 'templateId' | 'category' | 'ruleBox' | 'artMode' | 'subtitle'>): TemplateKind {
  const id = face.templateId ?? '';
  if (id.endsWith('/pokemon-full-art') || (face.category === 'POKEMON' && face.artMode === 'FULL_ART')) return 'pokemon-full-art';
  if (id.endsWith('/fossil') || face.subtitle.includes('Fóssil')) return 'fossil';
  if (id.endsWith('/trainer') || face.category === 'TRAINER') return 'trainer';
  if (id.endsWith('/pokemon-ex') || face.ruleBox !== 'NONE') return 'pokemon-ex';
  return 'pokemon-classic';
}

/** Janela de arte em UV (v para cima) — máscara do acabamento; texto fica fora. */
export function artWindowUv(kind: TemplateKind): { u0: number; v0: number; u1: number; v1: number } {
  const r = kind === 'pokemon-full-art' ? FACE_LAYOUT.fullArt : FACE_LAYOUT.art;
  return { u0: r.x / FACE_W, u1: (r.x + r.w) / FACE_W, v0: 1 - (r.y + r.h) / FACE_H, v1: 1 - r.y / FACE_H };
}

export function innerBodyUv(): { u0: number; v0: number; u1: number; v1: number } {
  const r = FACE_LAYOUT.inner;
  return { u0: r.x / FACE_W, u1: (r.x + r.w) / FACE_W, v0: 1 - (r.y + r.h) / FACE_H, v1: 1 - r.y / FACE_H };
}

type Ctx = CanvasRenderingContext2D;

export function fontString(font: FontSpec): string {
  return `${font.italic ? 'italic ' : ''}${font.weight} ${font.sizePx.toFixed(2)}px ${CARD_FONT_STACK}`;
}

export function canvasMeasure(ctx: Ctx): Measure {
  const cache = new Map<string, number>();
  return (text, font) => {
    const key = `${font.weight}|${font.italic ? 1 : 0}|${font.sizePx.toFixed(2)}|${text}`;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    ctx.font = fontString(font);
    const w = ctx.measureText(text).width;
    cache.set(key, w);
    return w;
  };
}

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function text(ctx: Ctx, value: string, x: number, y: number, font: FontSpec, color: string, align: CanvasTextAlign = 'left'): void {
  ctx.font = fontString(font);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x, y);
}

function pill(ctx: Ctx, label: string, x: number, cy: number, font: FontSpec, fill: string, color: string, measure: Measure, padX = 9): number {
  const w = measure(label, font) + padX * 2;
  const h = font.sizePx + 9;
  rr(ctx, x, cy - h / 2, w, h, h / 2);
  ctx.fillStyle = fill;
  ctx.fill();
  text(ctx, label, x + padX, cy + 0.5, font, color);
  return w;
}

function mainType(face: CardFaceData): string {
  return face.types[0] ?? 'COLORLESS';
}

function frame(ctx: Ctx, kind: TemplateKind): void {
  const g = ctx.createLinearGradient(0, 0, FACE_W, FACE_H);
  g.addColorStop(0, '#F5F8FB');
  g.addColorStop(0.45, '#D5DDE5');
  g.addColorStop(0.7, '#EEF2F6');
  g.addColorStop(1, '#C9D3DD');
  rr(ctx, 0, 0, FACE_W, FACE_H, FACE_LAYOUT.outerRadius);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#B4C1CD';
  rr(ctx, 1, 1, FACE_W - 2, FACE_H - 2, FACE_LAYOUT.outerRadius - 1);
  ctx.stroke();
  if (kind === 'pokemon-ex' || kind === 'pokemon-full-art') {
    // Fio iridescente fino na moldura (não ornamento dourado).
    const iri = ctx.createLinearGradient(0, 0, FACE_W, 0);
    ['#B9E6FF', '#E6D4FF', '#FFE3F1', '#D6FFF4', '#B9E6FF'].forEach((c, i, a) => iri.addColorStop(i / (a.length - 1), c));
    ctx.lineWidth = 3;
    ctx.strokeStyle = iri;
    rr(ctx, 8, 8, FACE_W - 16, FACE_H - 16, FACE_LAYOUT.outerRadius - 6);
    ctx.stroke();
  }
}

function body(ctx: Ctx, tint: string): void {
  const { x, y, w, h, r } = FACE_LAYOUT.inner;
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, mixHex(tint, '#FFFFFF', 0.62));
  g.addColorStop(0.5, mixHex(tint, '#FFFFFF', 0.78));
  g.addColorStop(1, mixHex(tint, '#FFFFFF', 0.7));
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = g;
  ctx.fill();
}

function placeholderArt(ctx: Ctx, face: CardFaceData, box: { x: number; y: number; w: number; h: number; r: number }, kind: TemplateKind): void {
  const isTrainer = face.category === 'TRAINER';
  const subtype = kind === 'fossil' ? 'FOSSIL' : subtypeOf(face);
  const base = isTrainer ? TRAINER_COLORS[subtype] ?? TRAINER_COLORS.ITEM! : TYPE_COLORS[asTypeId(mainType(face))];
  const rng = createVisualRng(`art:${face.printingId}`);
  ctx.save();
  rr(ctx, box.x, box.y, box.w, box.h, box.r);
  ctx.clip();
  const g = ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
  g.addColorStop(0, mixHex(base, '#263A50', 0.08));
  g.addColorStop(0.55, mixHex(base, '#FFFFFF', 0.3));
  g.addColorStop(1, mixHex(base, '#DDEBFA', 0.55));
  ctx.fillStyle = g;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  const cx = box.x + box.w * (0.5 + (rng() - 0.5) * 0.08);
  const cy = box.y + box.h * 0.52;
  const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, Math.max(box.w, box.h) * 0.6);
  glow.addColorStop(0, 'rgba(255,255,255,0.6)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  // Anéis e partículas decorativas suaves (determinísticas pela impressão).
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  for (let i = 1; i <= 4; i += 1) {
    ctx.lineWidth = 2 + i;
    ctx.beginPath();
    ctx.arc(cx, cy, 34 + i * 30, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 14; i += 1) {
    ctx.beginPath();
    ctx.arc(box.x + rng() * box.w, box.y + rng() * box.h, 2 + rng() * 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Chão claro estilizado.
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, box.y + box.h * 0.86, box.w * 0.34, box.h * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  const glyphR = Math.min(box.w, box.h) * (kind === 'pokemon-full-art' ? 0.2 : 0.27);
  ctx.shadowColor = withAlpha(mixHex(base, COLORS.text, 0.5), 0.35);
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;
  if (isTrainer) drawTrainerEmblem(ctx, subtype, cx, cy, glyphR, '#FFFFFF');
  else drawTypeGlyph(ctx, mainType(face), cx, cy, glyphR, '#FFFFFF');
  ctx.restore();
  if (kind !== 'pokemon-full-art') {
    rr(ctx, box.x, box.y, box.w, box.h, box.r);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#EEF2F6';
    ctx.stroke();
    rr(ctx, box.x + 2, box.y + 2, box.w - 4, box.h - 4, box.r - 2);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#9FAFBE';
    ctx.stroke();
  }
}

function subtypeOf(face: CardFaceData): string {
  const s = face.subtitle;
  if (s.includes('Fóssil')) return 'FOSSIL';
  if (s.startsWith('Apoiador')) return 'SUPPORTER';
  if (s.startsWith('Ferramenta')) return 'TOOL';
  if (s.startsWith('Estádio')) return 'STADIUM';
  return 'ITEM';
}

function splitEx(name: string): { base: string; suffix: string | null } {
  const m = /^(.*?)(\s+ex)$/.exec(name);
  return m ? { base: m[1]!, suffix: 'ex' } : { base: name, suffix: null };
}

function header(ctx: Ctx, face: CardFaceData, kind: TemplateKind, measure: Measure): void {
  const top = 34;
  const nameY = 62;
  const small: FontSpec = { sizePx: 13, weight: 800 };
  let x = 30;
  if (kind === 'trainer' || kind === 'fossil') {
    const sub = kind === 'fossil' ? 'FOSSIL' : subtypeOf(face);
    x += pill(ctx, 'Treinador', x, top, small, 'rgba(255,255,255,0.85)', TEXT_2, measure) + 6;
    pill(ctx, kind === 'fossil' ? 'Item · Fóssil' : face.subtitle, x, top, small, TRAINER_COLORS[sub] ?? TRAINER_COLORS.ITEM!, '#FFFFFF', measure);
  } else {
    x += pill(ctx, face.subtitle || 'Básico', x, top, small, 'rgba(255,255,255,0.88)', TEXT_2, measure) + 8;
    if (face.evolvesFromName) {
      const evo = fitLine(`Evolui de ${face.evolvesFromName}`, 270 - x + 30, { sizePx: 13, weight: 600, italic: true }, 10, measure);
      text(ctx, evo.text, x, top + 0.5, evo.font, TEXT_2);
    }
  }
  // HP + símbolo do tipo à direita.
  let right = 470;
  if (face.hp !== null) {
    if (face.types.length) {
      drawEnergySymbol(ctx, mainType(face), right - 17, nameY - 2, 17);
      right -= 40;
    }
    const hpFont: FontSpec = { sizePx: 32, weight: 900 };
    const hpText = String(face.hp);
    const hpW = measure(hpText, hpFont);
    text(ctx, hpText, right, nameY, hpFont, TEXT, 'right');
    text(ctx, 'HP', right - hpW - 4, nameY + 4, { sizePx: 13, weight: 800 }, TEXT_2, 'right');
    right -= hpW + 30;
  }
  const { base, suffix } = splitEx(face.name);
  const exW = suffix ? measure('ex', { sizePx: 36, weight: 800, italic: true }) + 6 : 0;
  const nameFit = fitLine(base, right - 30 - exW - 6, { sizePx: 34, weight: 800 }, 20, measure);
  text(ctx, nameFit.text, 30, nameY, nameFit.font, TEXT);
  if (suffix) {
    const nx = 30 + measure(nameFit.text, nameFit.font) + 6;
    ctx.save();
    ctx.font = fontString({ sizePx: 36, weight: 800, italic: true });
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#FFFFFF';
    ctx.strokeText('ex', nx, nameY - 1);
    const g = ctx.createLinearGradient(nx, nameY - 18, nx, nameY + 18);
    g.addColorStop(0, '#5B7CFA');
    g.addColorStop(1, '#2A3F9E');
    ctx.fillStyle = g;
    ctx.fillText('ex', nx, nameY - 1);
    ctx.restore();
  }
}

function rulesPanel(ctx: Ctx, y: number, h: number, alpha: number): void {
  rr(ctx, 28, y, 444, h, 12);
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.fill();
}

function costWidth(n: number): number {
  return n > 0 ? n * 25 + 6 : 0;
}

function drawRules(ctx: Ctx, face: CardFaceData, area: { x: number; y: number; w: number; h: number }, measure: Measure): void {
  const blocks: RulesBlock[] = [];
  for (const a of face.abilities) blocks.push({ kind: 'ability', title: a.name, badgeWidth: 100, body: a.text });
  for (const atk of face.attacks) blocks.push({ kind: 'attack', title: atk.name, titleRight: atk.damage || undefined, leadingWidth: costWidth(atk.cost.length), body: atk.text });
  if (face.category === 'TRAINER' && face.trainerText) blocks.push({ kind: 'text', body: face.trainerText });
  const layout = layoutRules(blocks, area.w, area.h, {
    titleFont: { sizePx: 23, weight: 800 }, rightFont: { sizePx: 27, weight: 900 }, bodyFont: { sizePx: 16, weight: 600 },
    lineHeight: 1.22, titleHeightFactor: 1.32, blockGap: 12, minScale: 0.7,
  }, measure);
  const totalAttacks = face.attacks.length;
  // Centraliza verticalmente quando sobra espaço (carta com um ataque curto).
  const offset = Math.max(0, (area.h - layout.totalHeight) / (totalAttacks <= 1 && !face.abilities.length ? 2.2 : 3));
  let attackIndex = 0;
  for (const b of layout.blocks) {
    const y0 = area.y + offset + b.y;
    if (b.title) {
      const cy = y0 + b.titleHeight / 2;
      let x = area.x;
      if (b.block.kind === 'ability') {
        x += pill(ctx, 'Habilidade', x, cy, { sizePx: 13 * layout.scale, weight: 900 }, ABILITY_RED, '#FFFFFF', measure, 8) + 8 * layout.scale;
      } else if (b.block.kind === 'attack') {
        const atk = face.attacks[attackIndex]!;
        attackIndex += 1;
        const r = 11.5 * layout.scale;
        atk.cost.forEach((cost, i) => drawEnergySymbol(ctx, cost, x + r + i * 25 * layout.scale, cy, r));
        x += b.leadingWidth;
      }
      text(ctx, b.title.text, x, cy, b.title.font, TEXT);
      if (b.right) text(ctx, b.right.text, area.x + area.w, cy + 1, b.right.font, TEXT, 'right');
    }
    b.bodyLines.forEach((line, i) => {
      text(ctx, line, area.x, y0 + b.titleHeight + b.bodyLineHeight * (i + 0.5), b.bodyFont, TEXT);
    });
  }
}

function weaknessRetreat(ctx: Ctx, face: CardFaceData, cy: number, measure: Measure): void {
  const label: FontSpec = { sizePx: 13, weight: 800 };
  const value: FontSpec = { sizePx: 16, weight: 900 };
  text(ctx, 'Fraqueza', 40, cy, label, TEXT_2);
  let x = 40 + measure('Fraqueza', label) + 10;
  if (face.weakness) {
    const [typeLabel, amount] = (() => {
      const i = face.weakness.lastIndexOf(' ');
      return i > 0 ? [face.weakness.slice(0, i), face.weakness.slice(i + 1)] : [face.weakness, ''];
    })();
    drawEnergySymbol(ctx, LABEL_TO_TYPE[typeLabel] ?? 'COLORLESS', x + 10, cy, 10.5);
    text(ctx, amount, x + 25, cy + 1, value, TEXT);
  } else text(ctx, '—', x, cy, value, TEXT_2);
  x = 290;
  text(ctx, 'Recuo', x, cy, label, TEXT_2);
  x += measure('Recuo', label) + 10;
  const n = face.retreat ?? 0;
  if (n === 0) text(ctx, '0', x, cy + 1, value, TEXT);
  for (let i = 0; i < n; i += 1) drawEnergySymbol(ctx, 'COLORLESS', x + 10 + i * 23, cy, 10.5);
}

function footer(ctx: Ctx, face: CardFaceData, cy: number, measure: Measure): void {
  drawRaritySymbol(ctx, face.raritySymbol, 34, cy, 13, mixHex(TEXT_2, '#FFFFFF', 0.1));
  const info = `${face.setId.toUpperCase()} · ${face.collectorNumber}`;
  const fit = fitLine(info, 200, { sizePx: 12, weight: 800 }, 9, measure);
  text(ctx, fit.text, 466, cy, fit.font, TEXT_2, 'right');
}

function ruleBox(ctx: Ctx, face: CardFaceData, y: number, measure: Measure): void {
  if (!face.ruleBoxText) return;
  rr(ctx, 36, y, 428, 34, 9);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = mixHex(TYPE_COLORS[asTypeId(mainType(face))], COLORS.text, 0.25);
  ctx.stroke();
  const p = fitParagraph(face.ruleBoxText, 410, 28, { sizePx: 11.5, weight: 700 }, 8.5, 1.15, measure);
  const start = y + 17 - (p.lines.length * p.lineHeightPx) / 2;
  p.lines.forEach((line, i) => text(ctx, line, 45, start + p.lineHeightPx * (i + 0.5), p.font, TEXT));
}

/** Desenha a frente completa num canvas de qualquer tamanho 5:7 (escala uniforme a partir de 500×700). */
export function drawCardFace(ctx: Ctx, face: CardFaceData, width: number, height: number, printed: CanvasImageSource | null = null): void {
  if (face.artMode === 'FULL_PRINTING' && printed) {
    drawPrinted(ctx, printed, width, height);
    return;
  }
  const kind = templateKindOf(face);
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.scale(width / FACE_W, height / FACE_H);
  const measure = canvasMeasure(ctx);
  frame(ctx, kind);
  const isTrainer = kind === 'trainer' || kind === 'fossil';
  const tint = isTrainer ? mixHex(TRAINER_COLORS[kind === 'fossil' ? 'FOSSIL' : subtypeOf(face)] ?? '#8FA3B8', '#BFD0E0', 0.45) : TYPE_COLORS[asTypeId(mainType(face))];
  body(ctx, tint);
  if (kind === 'pokemon-full-art') {
    placeholderArt(ctx, face, FACE_LAYOUT.fullArt, kind);
    rr(ctx, 22, 20, 456, 64, 14);
    ctx.fillStyle = 'rgba(255,255,255,0.84)';
    ctx.fill();
  } else placeholderArt(ctx, face, FACE_LAYOUT.art, kind);
  header(ctx, face, kind, measure);

  const hasRuleBox = !!face.ruleBoxText;
  if (isTrainer) {
    rulesPanel(ctx, 350, 290, 0.86);
    const p = fitParagraph(face.trainerText || ' ', 412, 262, { sizePx: 18, weight: 600 }, 11, 1.25, measure);
    const start = 362 + Math.max(0, (262 - p.lines.length * p.lineHeightPx) / 3);
    p.lines.forEach((line, i) => text(ctx, line, 44, start + p.lineHeightPx * (i + 0.5), p.font, TEXT));
    footer(ctx, face, 664, measure);
  } else {
    const panelH = hasRuleBox ? 232 : 246;
    rulesPanel(ctx, 350, panelH, kind === 'pokemon-full-art' ? 0.88 : 0.74);
    drawRules(ctx, face, { x: 40, y: 360, w: 420, h: panelH - 20 }, measure);
    const wrY = hasRuleBox ? 598 : 618;
    if (kind === 'pokemon-full-art') {
      rr(ctx, 28, wrY - 15, 444, 30, 10);
      ctx.fillStyle = 'rgba(255,255,255,0.84)';
      ctx.fill();
    }
    weaknessRetreat(ctx, face, wrY, measure);
    if (hasRuleBox) ruleBox(ctx, face, 618, measure);
    footer(ctx, face, hasRuleBox ? 669 : 662, measure);
  }
  ctx.restore();
}

/** Impressão completa: a imagem cobre a face inteira (cantos arredondados do template), sem moldura nem textos. */
function drawPrinted(ctx: Ctx, image: CanvasImageSource, width: number, height: number): void {
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.beginPath();
  ctx.roundRect(0, 0, width, height, (FACE_LAYOUT.outerRadius / FACE_W) * width);
  ctx.clip();
  ctx.drawImage(image, 0, 0, width, height);
  ctx.restore();
}

/** Verso/sleeve das cartas de um deck (uniforme para todas): paleta cosmética e, nos sleeves do Pocket, a imagem. */
export type SleeveStyle = {
  readonly id: string;
  readonly palette: readonly string[];
  readonly pattern: string;
  readonly accentHex: string;
  /** `sleeve-art:<stem>`: o verso é a imagem do sleeve; sem ela, o verso padrão (card-back.webp). */
  readonly assetKey?: string | null;
};

export const DEFAULT_SLEEVE: SleeveStyle = { id: 'sleeve-neutral', palette: ['#75C7FA', '#357DE4', '#FFFFFF'], pattern: 'NONE', accentHex: '#F4F8FF' };
