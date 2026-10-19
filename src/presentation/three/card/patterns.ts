// Padrões procedurais discretos compartilhados por playmats e versos (sem imagens). Aleatoriedade
// decorativa determinística (VisualRng semeado pelo ID do cosmético).
import type { VisualRng } from '../core/rng.ts';
import { drawTypeGlyph } from './glyphs.ts';

export type PatternId = 'NONE' | 'LINES' | 'LEAVES' | 'WAVES' | 'CIRCUITS' | 'STARS' | 'SYMBOLS' | 'PAGES' | 'CHAPTERS';
type Ctx = CanvasRenderingContext2D;
export type Box = { x: number; y: number; w: number; h: number };

function fourStar(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const rr = i % 2 === 0 ? r : r * 0.32;
    const a = -Math.PI / 2 + (i * Math.PI) / 4;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

function leaf(ctx: Ctx, x: number, y: number, r: number, angle: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(r * 0.75, 0, 0, r);
  ctx.quadraticCurveTo(-r * 0.75, 0, 0, -r);
  ctx.fill();
  ctx.restore();
}

/** Pinta o padrão dentro de `box` com `color` e opacidade já definida pelo chamador. `unit` = escala base em px. */
export function paintPattern(ctx: Ctx, pattern: string, box: Box, color: string, rng: VisualRng, unit: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (pattern as PatternId) {
    case 'LINES': {
      ctx.lineWidth = unit * 0.12;
      const step = unit * 1.1;
      for (let d = -box.h; d < box.w + box.h; d += step) {
        ctx.beginPath();
        ctx.moveTo(box.x + d, box.y);
        ctx.lineTo(box.x + d - box.h, box.y + box.h);
        ctx.stroke();
      }
      break;
    }
    case 'WAVES': {
      ctx.lineWidth = unit * 0.14;
      const step = unit * 1.2;
      for (let y = box.y + step / 2; y < box.y + box.h + step; y += step) {
        ctx.beginPath();
        for (let x = box.x - unit; x <= box.x + box.w + unit; x += unit / 4) {
          const yy = y + Math.sin((x / unit) * 1.4 + y * 0.01) * unit * 0.28;
          if (x === box.x - unit) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      break;
    }
    case 'LEAVES': {
      const count = Math.round((box.w * box.h) / (unit * unit * 2.2));
      for (let i = 0; i < count; i += 1) leaf(ctx, box.x + rng() * box.w, box.y + rng() * box.h, unit * (0.35 + rng() * 0.35), rng() * Math.PI * 2);
      break;
    }
    case 'STARS': {
      const count = Math.round((box.w * box.h) / (unit * unit * 2.6));
      for (let i = 0; i < count; i += 1) fourStar(ctx, box.x + rng() * box.w, box.y + rng() * box.h, unit * (0.15 + rng() * 0.35));
      break;
    }
    case 'CIRCUITS': {
      ctx.lineWidth = unit * 0.09;
      const grid = unit * 1.4;
      for (let gx = box.x; gx < box.x + box.w; gx += grid) {
        for (let gy = box.y; gy < box.y + box.h; gy += grid) {
          if (rng() < 0.45) continue;
          const horizontal = rng() < 0.5;
          const len = grid * (1 + Math.floor(rng() * 2));
          ctx.beginPath();
          ctx.moveTo(gx, gy);
          ctx.lineTo(horizontal ? gx + len : gx, horizontal ? gy : gy + len);
          ctx.lineTo(horizontal ? gx + len : gx + grid * 0.5, horizontal ? gy + grid * 0.5 : gy + len);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(gx, gy, unit * 0.16, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case 'SYMBOLS': {
      const types = ['GRASS', 'FIRE', 'WATER', 'LIGHTNING', 'PSYCHIC', 'FIGHTING', 'DARKNESS', 'METAL'];
      const step = unit * 2;
      let k = 0;
      for (let y = box.y + step / 2; y < box.y + box.h; y += step) {
        for (let x = box.x + step / 2 + (k % 2) * (step / 2); x < box.x + box.w; x += step) {
          drawTypeGlyph(ctx, types[Math.floor(rng() * types.length)]!, x, y, unit * 0.42, color);
        }
        k += 1;
      }
      break;
    }
    case 'PAGES': {
      ctx.lineWidth = unit * 0.08;
      const count = Math.round((box.w * box.h) / (unit * unit * 4));
      for (let i = 0; i < count; i += 1) {
        ctx.save();
        ctx.translate(box.x + rng() * box.w, box.y + rng() * box.h);
        ctx.rotate((rng() - 0.5) * 0.8);
        const w = unit * (0.9 + rng() * 0.6);
        ctx.strokeRect(-w / 2, -w * 0.65, w, w * 1.3);
        for (let l = 0; l < 3; l += 1) {
          ctx.beginPath();
          ctx.moveTo(-w * 0.32, -w * 0.3 + l * w * 0.3);
          ctx.lineTo(w * 0.32, -w * 0.3 + l * w * 0.3);
          ctx.stroke();
        }
        ctx.restore();
      }
      break;
    }
    case 'CHAPTERS': {
      paintPattern(ctx, 'STARS', { x: box.x, y: box.y, w: box.w / 2, h: box.h }, color, rng, unit);
      paintPattern(ctx, 'WAVES', { x: box.x + box.w / 2, y: box.y, w: box.w / 2, h: box.h }, color, rng, unit);
      break;
    }
    default:
      break;
  }
  ctx.restore();
}
