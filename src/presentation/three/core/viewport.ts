// Geometria de viewport em pixels CSS (runtime §13.3, §17.2). Helpers trabalham em CSS relativos ao
// canvas; o adaptador do renderer trata o pixel ratio uma única vez. Y é convertido uma vez (CSS → GL).

export type CssRect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
export type ClientRect = { readonly left: number; readonly top: number; readonly width: number; readonly height: number };

/** Retângulo CSS (origem superior) → retângulo para renderer.setViewport/setScissor (CSS, origem inferior). */
export function cssRectToRendererRect(rect: CssRect, canvasCssHeight: number): CssRect {
  return { x: rect.x, y: canvasCssHeight - rect.y - rect.height, width: rect.width, height: rect.height };
}

/**
 * Retângulo no drawing buffer (pixels físicos, origem inferior) exatamente como o WebGLRenderer o aplica:
 * multiplica pelo pixel ratio e arredonda cada componente (Vector4.round).
 */
export function cssRectToDrawingBuffer(rect: CssRect, canvasCssHeight: number, pixelRatio: number): CssRect {
  const r = cssRectToRendererRect(rect, canvasCssHeight);
  return {
    x: Math.round(r.x * pixelRatio),
    y: Math.round(r.y * pixelRatio),
    width: Math.round(r.width * pixelRatio),
    height: Math.round(r.height * pixelRatio),
  };
}

/** Tamanho do drawing buffer para um canvas CSS (WebGLRenderer.setSize: floor(css × ratio)). */
export function drawingBufferSize(cssWidth: number, cssHeight: number, pixelRatio: number): { width: number; height: number } {
  return { width: Math.floor(cssWidth * pixelRatio), height: Math.floor(cssHeight * pixelRatio) };
}

/** Pixel físico (origem inferior) correspondente a um ponto CSS do canvas. */
export function cssPointToDrawingBuffer(x: number, y: number, canvasCssHeight: number, pixelRatio: number): { x: number; y: number } {
  return { x: x * pixelRatio, y: (canvasCssHeight - y) * pixelRatio };
}

/** runtime §17.2: NDC do viewport selecionado; nulo fora do retângulo. Não multiplicar por DPR. */
export function toViewportNdc(clientX: number, clientY: number, rect: ClientRect): { x: number; y: number } | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const u = (clientX - rect.left) / rect.width;
  const v = (clientY - rect.top) / rect.height;
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;
  return { x: 2 * u - 1, y: 1 - 2 * v };
}

/** Converte um ponto de cliente (getBoundingClientRect) para CSS relativo ao canvas. */
export function clientToCanvas(clientX: number, clientY: number, canvasRect: ClientRect): { x: number; y: number } {
  return { x: clientX - canvasRect.left, y: clientY - canvasRect.top };
}

/** Retângulo do viewport (CSS relativo ao canvas) em coordenadas de cliente. */
export function viewportClientRect(rect: CssRect, canvasRect: ClientRect): ClientRect {
  return { left: canvasRect.left + rect.x, top: canvasRect.top + rect.y, width: rect.width, height: rect.height };
}

/** NDC → CSS relativo ao canvas dentro do retângulo do viewport. */
export function ndcToCss(ndcX: number, ndcY: number, rect: CssRect): { x: number; y: number } {
  return { x: rect.x + ((ndcX + 1) / 2) * rect.width, y: rect.y + ((1 - ndcY) / 2) * rect.height };
}

export function rectContains(rect: CssRect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

export function rectsOverlap(a: CssRect, b: CssRect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

export function unionRect(rects: readonly CssRect[]): CssRect | null {
  if (!rects.length) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const r of rects) {
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.width);
    y1 = Math.max(y1, r.y + r.height);
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

export function rectFromArray(a: readonly number[]): CssRect {
  return { x: a[0] ?? 0, y: a[1] ?? 0, width: a[2] ?? 0, height: a[3] ?? 0 };
}

/** Escala um retângulo de design para o frame (origem + escala uniforme). */
export function mapRect(rect: CssRect, frame: { x: number; y: number; scale: number }): CssRect {
  return { x: frame.x + rect.x * frame.scale, y: frame.y + rect.y * frame.scale, width: rect.width * frame.scale, height: rect.height * frame.scale };
}

export function sameRect(a: CssRect | null, b: CssRect | null): boolean {
  if (!a || !b) return a === b;
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}
