// Imagens dos sleeves do Pocket (src/presentation/assets/sleeves) para o verso das cartas na mesa 3D. A mesa pede a
// carga dos sleeves dos dois decks ao montar; enquanto não chegam, o verso é o padrão (card-back.webp) e é redesenhado
// quando a imagem fica pronta (`onSleeveArtReady`).
import { sleeveArtUrl } from '../../assets/sleeves.ts';

type Entry = { image: HTMLImageElement | null; readonly promise: Promise<boolean> };
const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();

/** Carrega o verso (true quando chegou; false sem imagem ou sem `Image`). */
export function loadSleeveArt(assetKey: string | null | undefined): Promise<boolean> {
  const url = sleeveArtUrl(assetKey);
  if (!url || typeof Image === 'undefined') return Promise.resolve(false);
  const known = entries.get(url);
  if (known) return known.promise;
  const entry: Entry = {
    image: null,
    promise: new Promise<boolean>((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        entry.image = img;
        for (const cb of [...listeners]) cb();
        resolve(true);
      };
      img.onerror = () => resolve(false);
      img.src = url;
    }),
  };
  entries.set(url, entry);
  return entry.promise;
}

/** Imagem do verso já carregada; null enquanto carrega ou para versos sem imagem. */
export function sleeveArtImage(assetKey: string | null | undefined): HTMLImageElement | null {
  const url = sleeveArtUrl(assetKey);
  return url ? entries.get(url)?.image ?? null : null;
}

/** Avisa a cada sleeve que termina de carregar (a mesa refaz os versos desenhados com o padrão). */
export function onSleeveArtReady(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
