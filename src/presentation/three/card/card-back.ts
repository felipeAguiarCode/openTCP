// Arte única do verso das cartas (src/presentation/assets/card-back.webp, via CARD_BACK_URL): deck, mão do
// adversário, cartas ocultas, pilhas do pacote e todo verso de CardVisual. Carregada uma vez; enquanto não
// chega (ou sem DOM), o verso usa a moldura prateada e o azul da arte e é redesenhado quando a imagem fica pronta.
import { CARD_BACK_URL } from '../../assets/index.ts';

type State = 'IDLE' | 'LOADING' | 'READY' | 'FAILED';
let state: State = 'IDLE';
let image: HTMLImageElement | null = null;
let pending: Promise<boolean> | null = null;
const listeners = new Set<() => void>();

export function loadCardBack(): Promise<boolean> {
  if (pending) return pending;
  if (typeof Image === 'undefined') {
    state = 'FAILED';
    pending = Promise.resolve(false);
    return pending;
  }
  state = 'LOADING';
  pending = new Promise<boolean>((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      image = img;
      state = 'READY';
      for (const cb of [...listeners]) cb();
      resolve(true);
    };
    img.onerror = () => {
      state = 'FAILED';
      resolve(false);
    };
    img.src = CARD_BACK_URL;
  });
  return pending;
}

export function cardBackImage(): HTMLImageElement | null {
  return state === 'READY' ? image : null;
}

/** Etiqueta para chaves de cache (verso provisório ≠ arte final). */
export function cardBackTag(): string {
  return state === 'READY' ? 'art' : 'pending';
}

export function onCardBackReady(cb: () => void): () => void {
  if (state === 'READY') {
    cb();
    return () => undefined;
  }
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * Desenha o verso num canvas w×h de proporção 5:7. A arte já tem moldura prateada e cantos arredondados
 * transparentes, então ocupa o canvas inteiro; sem ela, uma moldura prateada e o azul da arte, provisórios.
 */
export function drawCardBack(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  const img = cardBackImage();
  if (img) {
    ctx.drawImage(img, 0, 0, w, h);
    ctx.restore();
    return;
  }
  const r = w * 0.045;
  const border = Math.max(2, w * 0.045);
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, r);
  ctx.fillStyle = '#C9CDD3';
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(border, border, w - border * 2, h - border * 2, Math.max(1, r - border / 2));
  ctx.fillStyle = '#1D5FC8';
  ctx.fill();
  ctx.restore();
}
