// Imagens das moedas do Pocket (cara e coroa, src/presentation/assets/coins) para a moeda 3D. A mesa pede a carga das
// moedas dos dois lados ao montar; enquanto não chegam, a moeda é desenhada pela paleta e trocada pela arte depois.
import type { PlayerId } from '../../../domain/battle/types.ts';
import { coinArtUrl, type CoinFace } from '../../assets/coins.ts';

/**
 * De quem é a moeda de um lançamento: a do lado que lança (a equipada no deck dele). Sem jogador (quem começa), a do
 * jogador que assiste.
 */
export function coinOwner(player: PlayerId | null, viewer: PlayerId): 'MINE' | 'THEIRS' {
  return player === null || player === viewer ? 'MINE' : 'THEIRS';
}

type Entry = { image: HTMLImageElement | null; readonly promise: Promise<boolean> };
const entries = new Map<string, Entry>();

function load(url: string): Entry {
  const known = entries.get(url);
  if (known) return known;
  const entry: Entry = {
    image: null,
    promise: new Promise<boolean>((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { entry.image = img; resolve(true); };
      img.onerror = () => resolve(false);
      img.src = url;
    }),
  };
  entries.set(url, entry);
  return entry;
}

const urlsOf = (assetKey: string | null | undefined): readonly [string, string] | null => {
  const heads = coinArtUrl(assetKey, 'HEADS');
  const tails = coinArtUrl(assetKey, 'TAILS');
  return heads && tails ? [heads, tails] : null;
};

/** Carrega a cara e a coroa (true quando as duas chegaram; false para moedas procedurais ou sem `Image`). */
export function loadCoinArt(assetKey: string | null | undefined): Promise<boolean> {
  const urls = urlsOf(assetKey);
  if (!urls || typeof Image === 'undefined') return Promise.resolve(false);
  return Promise.all(urls.map((u) => load(u).promise)).then((r) => r.every(Boolean));
}

/** Cara e coroa já carregadas; null enquanto carregam ou para moedas procedurais. */
export function coinArtImages(assetKey: string | null | undefined): Readonly<Record<CoinFace, HTMLImageElement>> | null {
  const urls = urlsOf(assetKey);
  const heads = urls ? entries.get(urls[0])?.image : null;
  const tails = urls ? entries.get(urls[1])?.image : null;
  return heads && tails ? { HEADS: heads, TAILS: tails } : null;
}
