// Viewports em pixels CSS → scissor/viewport do drawing buffer (R-040), NDC por viewport (runtime §17.2).
import { describe, expect, it } from 'vitest';
import {
  cssPointToDrawingBuffer, cssRectToDrawingBuffer, cssRectToRendererRect, drawingBufferSize, ndcToCss, rectContains, toViewportNdc, unionRect,
} from './viewport.ts';
import { effectivePixelRatio } from './quality.ts';

describe('retângulo CSS → scissor/viewport', () => {
  const canvasH = 1080;
  const hand = { x: 448, y: 912, width: 1024, height: 168 };

  it('inverte Y uma única vez (origem inferior do GL), em pixels CSS', () => {
    expect(cssRectToRendererRect(hand, canvasH)).toEqual({ x: 448, y: 0, width: 1024, height: 168 });
    expect(cssRectToRendererRect({ x: 0, y: 0, width: 1920, height: 100 }, canvasH)).toEqual({ x: 0, y: 980, width: 1920, height: 100 });
  });

  it.each([1, 1.5, 2])('DPR %s: multiplica uma vez e arredonda como o WebGLRenderer', (dpr) => {
    const r = cssRectToDrawingBuffer(hand, canvasH, dpr);
    expect(r).toEqual({ x: Math.round(448 * dpr), y: 0, width: Math.round(1024 * dpr), height: Math.round(168 * dpr) });
    const buffer = drawingBufferSize(1920, canvasH, dpr);
    expect(r.x + r.width).toBeLessThanOrEqual(buffer.width);
    expect(r.y + r.height).toBeLessThanOrEqual(buffer.height + 1);
  });

  it('DPR fracionário com retângulo fracionário (letterbox 1280×720 em 1366×768)', () => {
    const rect = { x: 43.2, y: 24.3, width: 1279.6, height: 719.8 };
    const r = cssRectToDrawingBuffer(rect, 768, 1.5);
    expect(r).toEqual({ x: Math.round(43.2 * 1.5), y: Math.round((768 - 24.3 - 719.8) * 1.5), width: Math.round(1279.6 * 1.5), height: Math.round(719.8 * 1.5) });
  });

  it('ponto CSS → pixel físico', () => {
    expect(cssPointToDrawingBuffer(100, 80, 720, 2)).toEqual({ x: 200, y: 1280 });
  });

  it('DPR efetivo limitado pelo perfil de qualidade (1 / 1,5 / 2)', () => {
    expect(effectivePixelRatio(3, 'LOW')).toBe(1);
    expect(effectivePixelRatio(3, 'MEDIUM')).toBe(1.5);
    expect(effectivePixelRatio(3, 'HIGH')).toBe(2);
    expect(effectivePixelRatio(1.25, 'HIGH')).toBe(1.25);
    expect(effectivePixelRatio(Number.NaN, 'HIGH')).toBe(1);
  });
});

describe('toViewportNdc', () => {
  const rect = { left: 100, top: 50, width: 400, height: 200 };

  it('cantos e centro do viewport selecionado', () => {
    expect(toViewportNdc(100, 50, rect)).toEqual({ x: -1, y: 1 });
    expect(toViewportNdc(500, 250, rect)).toEqual({ x: 1, y: -1 });
    expect(toViewportNdc(300, 150, rect)).toEqual({ x: 0, y: 0 });
  });

  it('fora do retângulo ou retângulo vazio → nulo', () => {
    expect(toViewportNdc(99, 150, rect)).toBeNull();
    expect(toViewportNdc(300, 251, rect)).toBeNull();
    expect(toViewportNdc(1, 1, { left: 0, top: 0, width: 0, height: 10 })).toBeNull();
  });

  it('independe do DPR: mesmo NDC para o mesmo ponto CSS', () => {
    const a = toViewportNdc(250, 120, rect)!;
    const back = ndcToCss(a.x, a.y, { x: 100, y: 50, width: 400, height: 200 });
    expect(back.x).toBeCloseTo(250);
    expect(back.y).toBeCloseTo(120);
  });
});

describe('utilitários de retângulo', () => {
  it('contém e união', () => {
    expect(rectContains({ x: 0, y: 0, width: 10, height: 10 }, 10, 10)).toBe(true);
    expect(rectContains({ x: 0, y: 0, width: 10, height: 10 }, 10.1, 5)).toBe(false);
    expect(unionRect([{ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 5, width: 5, height: 20 }])).toEqual({ x: 0, y: 0, width: 25, height: 25 });
    expect(unionRect([])).toBeNull();
  });
});
