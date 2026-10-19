// Símbolos procedurais (sem assets): glifo geométrico por tipo, símbolo de Energia, raridade e
// emblemas de Treinador. Símbolo, nome e texto acompanham a cor (direção visual §3.3).
import type { RaritySymbol } from '../../../domain/cards/rarity.ts';
import { TYPE_COLORS, asTypeId, mixHex, type TypeId } from '../core/tokens.ts';

type Ctx = CanvasRenderingContext2D;

function star(ctx: Ctx, cx: number, cy: number, outer: number, inner: number, points: number, rotation = -Math.PI / 2): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rotation + (i * Math.PI) / points;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

const glyphCache = new Map<string, HTMLCanvasElement>();

/** Desenha numa camada isolada (os furos usam destination-out) e compõe sobre o destino. */
function isolated(key: string, r: number, paint: (ctx: Ctx, c: number, rr: number) => void): HTMLCanvasElement {
  const size = Math.max(4, Math.ceil(r * 2 + 4));
  const cacheKey = `${key}|${size}`;
  const hit = glyphCache.get(cacheKey);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  paint(ctx, size / 2, r);
  if (glyphCache.size > 256) glyphCache.clear();
  glyphCache.set(cacheKey, canvas);
  return canvas;
}

/** Glifo do tipo centrado em (cx, cy), raio r, preenchido em `color`. */
export function drawTypeGlyph(ctx: Ctx, type: string, cx: number, cy: number, r: number, color: string): void {
  const scale = Math.max(1, Math.abs(ctx.getTransform().a));
  const rr = r * scale;
  const img = isolated(`type:${type}:${color}`, rr, (g, c, radius) => paintTypeGlyph(g, type, c, c, radius, color));
  ctx.drawImage(img, cx - img.width / scale / 2, cy - img.height / scale / 2, img.width / scale, img.height / scale);
}

function paintTypeGlyph(ctx: Ctx, type: string, cx: number, cy: number, r: number, color: string): void {
  const t: TypeId = asTypeId(type);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  switch (t) {
    case 'GRASS': {
      ctx.rotate(-Math.PI / 5);
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.95);
      ctx.bezierCurveTo(r * 0.85, -r * 0.45, r * 0.7, r * 0.55, 0, r * 0.95);
      ctx.bezierCurveTo(-r * 0.7, r * 0.55, -r * 0.85, -r * 0.45, 0, -r * 0.95);
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = r * 0.1;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.6);
      ctx.lineTo(0, r * 0.75);
      ctx.stroke();
      break;
    }
    case 'FIRE': {
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.bezierCurveTo(r * 0.35, -r * 0.45, r * 0.9, -r * 0.1, r * 0.72, r * 0.38);
      ctx.bezierCurveTo(r * 0.55, r * 0.85, r * 0.2, r, 0, r);
      ctx.bezierCurveTo(-r * 0.2, r, -r * 0.55, r * 0.85, -r * 0.72, r * 0.38);
      ctx.bezierCurveTo(-r * 0.85, -r * 0.05, -r * 0.42, -r * 0.2, -r * 0.3, -r * 0.62);
      ctx.bezierCurveTo(-r * 0.1, -r * 0.4, -r * 0.05, -r * 0.7, 0, -r);
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.05);
      ctx.bezierCurveTo(r * 0.3, r * 0.2, r * 0.32, r * 0.7, 0, r * 0.72);
      ctx.bezierCurveTo(-r * 0.32, r * 0.7, -r * 0.3, r * 0.2, 0, -r * 0.05);
      ctx.fill();
      break;
    }
    case 'WATER': {
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.bezierCurveTo(r * 0.3, -r * 0.45, r * 0.78, r * 0.05, r * 0.72, r * 0.42);
      ctx.arc(0, r * 0.38, r * 0.72, 0.05, Math.PI - 0.05, false);
      ctx.bezierCurveTo(-r * 0.78, r * 0.05, -r * 0.3, -r * 0.45, 0, -r);
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = r * 0.12;
      ctx.beginPath();
      ctx.arc(0, r * 0.38, r * 0.42, Math.PI * 0.6, Math.PI * 0.95);
      ctx.stroke();
      break;
    }
    case 'LIGHTNING': {
      ctx.beginPath();
      ctx.moveTo(r * 0.2, -r);
      ctx.lineTo(-r * 0.55, r * 0.12);
      ctx.lineTo(-r * 0.02, r * 0.12);
      ctx.lineTo(-r * 0.25, r);
      ctx.lineTo(r * 0.6, -r * 0.18);
      ctx.lineTo(r * 0.06, -r * 0.18);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'PSYCHIC': {
      ctx.beginPath();
      ctx.moveTo(-r, 0);
      ctx.quadraticCurveTo(0, -r * 1.05, r, 0);
      ctx.quadraticCurveTo(0, r * 1.05, -r, 0);
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'FIGHTING': {
      star(ctx, 0, 0, r, r * 0.52, 8, -Math.PI / 8);
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'DARKNESS': {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(r * 0.38, -r * 0.22, r * 0.74, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'METAL': {
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = Math.PI / 6 + (i * Math.PI) / 3;
        if (i === 0) ctx.moveTo(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95);
        else ctx.lineTo(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95);
      }
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'DRAGON': {
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.85, r * 0.15);
      ctx.lineTo(r * 0.3, r * 0.15);
      ctx.lineTo(0, r);
      ctx.lineTo(-r * 0.3, r * 0.15);
      ctx.lineTo(-r * 0.85, r * 0.15);
      ctx.closePath();
      ctx.fill();
      break;
    }
    default: {
      star(ctx, 0, 0, r, r * 0.3, 4);
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

/** Ficha/símbolo de Energia: disco na cor do tipo, aro claro e glifo branco. */
export function drawEnergySymbol(ctx: Ctx, type: string, cx: number, cy: number, r: number, options: { ring?: boolean; dim?: boolean } = {}): void {
  const base = TYPE_COLORS[asTypeId(type)];
  ctx.save();
  if (options.dim) ctx.globalAlpha = 0.72;
  const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  g.addColorStop(0, mixHex(base, '#FFFFFF', 0.25));
  g.addColorStop(1, mixHex(base, '#263A50', 0.18));
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  if (options.ring !== false) {
    ctx.lineWidth = Math.max(1, r * 0.14);
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
  }
  drawTypeGlyph(ctx, type, cx, cy, r * 0.56, '#FFFFFF');
  ctx.restore();
}

/** Símbolo de raridade do Pocket: 1–4 losangos, 1–3 estrelas, 1–2 estrelas brilhantes, coroa ou selo Promo (círculo com estrela). */
export function drawRaritySymbol(ctx: Ctx, symbol: RaritySymbol, x: number, cy: number, size: number, color: string): number {
  ctx.save();
  ctx.fillStyle = color;
  let width = 0;
  const diamond = (dx: number) => {
    ctx.beginPath();
    ctx.moveTo(x + dx, cy - size / 2);
    ctx.lineTo(x + dx + size * 0.38, cy);
    ctx.lineTo(x + dx, cy + size / 2);
    ctx.lineTo(x + dx - size * 0.38, cy);
    ctx.closePath();
    ctx.fill();
  };
  if (symbol === '♛') {
    // Coroa: base retangular e três pontas com bolinhas.
    const w = size * 1.3;
    const left = x + size * 0.05;
    const top = cy - size * 0.42;
    const base = cy + size * 0.38;
    ctx.beginPath();
    ctx.moveTo(left, base);
    ctx.lineTo(left, top + size * 0.18);
    ctx.lineTo(left + w * 0.27, cy - size * 0.02);
    ctx.lineTo(left + w * 0.5, top);
    ctx.lineTo(left + w * 0.73, cy - size * 0.02);
    ctx.lineTo(left + w, top + size * 0.18);
    ctx.lineTo(left + w, base);
    ctx.closePath();
    ctx.fill();
    for (const px of [0, 0.5, 1]) {
      ctx.beginPath();
      ctx.arc(left + w * px, (px === 0.5 ? top : top + size * 0.18) - size * 0.06, size * 0.11, 0, Math.PI * 2);
      ctx.fill();
    }
    width = w + size * 0.1;
  } else if (symbol.startsWith('☆')) {
    const n = symbol.length;
    for (let i = 0; i < n; i += 1) {
      star(ctx, x + size / 2 + i * size * 1.02, cy, size * 0.55, size * 0.24, 5);
      ctx.fill();
    }
    width = size + (n - 1) * size * 1.02;
  } else if (symbol.startsWith('✵')) {
    // Brilhante: estrela de quatro pontas (cintilante), uma por nível.
    const n = symbol.length;
    for (let i = 0; i < n; i += 1) {
      star(ctx, x + size / 2 + i * size * 1.02, cy, size * 0.6, size * 0.17, 4);
      ctx.fill();
    }
    width = size + (n - 1) * size * 1.02;
  } else if (symbol === 'PROMO') {
    ctx.lineWidth = size * 0.18;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(x + size / 2, cy, size * 0.45, 0, Math.PI * 2);
    ctx.stroke();
    star(ctx, x + size / 2, cy, size * 0.25, size * 0.11, 5);
    ctx.fill();
    width = size;
  } else {
    const n = Math.max(1, Math.min(4, symbol.length));
    for (let i = 0; i < n; i += 1) diamond(size * 0.4 + i * size * 0.85);
    width = size * 0.4 + n * size * 0.85;
  }
  ctx.restore();
  return width;
}

/** Emblema simples do subtipo de Treinador para a janela de arte sem ilustração. */
export function drawTrainerEmblem(ctx: Ctx, subtype: string, cx: number, cy: number, r: number, color: string): void {
  const scale = Math.max(1, Math.abs(ctx.getTransform().a));
  const img = isolated(`trainer:${subtype}:${color}`, r * scale, (g, c, radius) => paintTrainerEmblem(g, subtype, c, c, radius, color));
  ctx.drawImage(img, cx - img.width / scale / 2, cy - img.height / scale / 2, img.width / scale, img.height / scale);
}

function paintTrainerEmblem(ctx: Ctx, subtype: string, cx: number, cy: number, r: number, color: string): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (subtype) {
    case 'SUPPORTER':
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.42, r * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.7, cy + r * 0.8);
      ctx.quadraticCurveTo(cx - r * 0.7, cy - r * 0.02, cx, cy - r * 0.02);
      ctx.quadraticCurveTo(cx + r * 0.7, cy - r * 0.02, cx + r * 0.7, cy + r * 0.8);
      ctx.closePath();
      ctx.fill();
      break;
    case 'TOOL':
      ctx.lineWidth = r * 0.26;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.55, cy + r * 0.55);
      ctx.lineTo(cx + r * 0.25, cy - r * 0.25);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + r * 0.42, cy - r * 0.42, r * 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(cx + r * 0.42, cy - r * 0.42, r * 0.15, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'STADIUM':
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.85, cy + r * 0.7);
      ctx.lineTo(cx - r * 0.85, cy - r * 0.1);
      ctx.quadraticCurveTo(cx, cy - r * 0.95, cx + r * 0.85, cy - r * 0.1);
      ctx.lineTo(cx + r * 0.85, cy + r * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.3, cy + r * 0.7);
      ctx.lineTo(cx - r * 0.3, cy + r * 0.15);
      ctx.quadraticCurveTo(cx, cy - r * 0.12, cx + r * 0.3, cy + r * 0.15);
      ctx.lineTo(cx + r * 0.3, cy + r * 0.7);
      ctx.closePath();
      ctx.fill();
      break;
    case 'FOSSIL':
      ctx.lineWidth = r * 0.16;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 0.8, r * 0.58, -0.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < 3; i += 1) {
        ctx.moveTo(cx - r * 0.45 + i * r * 0.32, cy - r * 0.25);
        ctx.quadraticCurveTo(cx - r * 0.3 + i * r * 0.32, cy, cx - r * 0.45 + i * r * 0.32, cy + r * 0.25);
      }
      ctx.stroke();
      break;
    default: {
      // Item: cápsula com cruz.
      ctx.beginPath();
      ctx.roundRect(cx - r * 0.7, cy - r * 0.5, r * 1.4, r * 1.0, r * 0.35);
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillRect(cx - r * 0.09, cy - r * 0.32, r * 0.18, r * 0.64);
      ctx.fillRect(cx - r * 0.32, cy - r * 0.09, r * 0.64, r * 0.18);
      break;
    }
  }
  ctx.restore();
}
