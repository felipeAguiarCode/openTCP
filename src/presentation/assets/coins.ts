// Moedas do Pokémon TCG Pocket: a cara (face da página de moedas do Serebii) e a coroa (gerada da face, em prata),
// recortadas por `npm run assets:coins` (tools/asset-import/coins.py) para coins/<stem>-heads.webp e -tails.webp,
// 256×256 com transparência. Cosméticos de moeda com `assetKey` `coin-art:<stem>`; origem e restrições em ASSETS.md.

const FILES: Readonly<Record<string, string>> = import.meta.glob<string>('./coins/*.webp', { query: '?url', import: 'default', eager: true });
const URLS = new Map(Object.entries(FILES).map(([file, url]) => [file.slice('./coins/'.length, -'.webp'.length), url]));

export type CoinFace = 'HEADS' | 'TAILS';

/** Stem da moeda com imagem (`coin-art:pikachu` → `pikachu`); null para moedas procedurais. */
export function coinArtStem(assetKey: string | null | undefined): string | null {
  const m = assetKey ? /^coin-art:([a-z0-9-]+)$/.exec(assetKey) : null;
  return m ? m[1]! : null;
}

/** URL local de uma face da moeda (`coin-art:pikachu`, HEADS → coins/pikachu-heads.webp); null sem imagem. */
export function coinArtUrl(assetKey: string | null | undefined, face: CoinFace): string | null {
  const stem = coinArtStem(assetKey);
  return stem ? URLS.get(`${stem}-${face === 'HEADS' ? 'heads' : 'tails'}`) ?? null : null;
}

/** Stems com as duas faces empacotadas. */
export const COIN_ART_STEMS: readonly string[] = [...URLS.keys()].filter((k) => k.endsWith('-heads') && URLS.has(k.replace(/-heads$/, '-tails')))
  .map((k) => k.slice(0, -'-heads'.length)).sort();
