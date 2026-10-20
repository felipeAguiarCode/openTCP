// Sleeves do Pokémon TCG Pocket: o verso das cartas de um deck (página de sleeves do Serebii), recortado por
// `npm run assets:sleeves` (tools/asset-import/sleeves.py) para sleeves/<stem>.webp, 367×512 com os cantos da carta
// transparentes. Cosméticos de verso com `assetKey` `sleeve-art:<stem>`; origem e restrições em ASSETS.md.

const FILES: Readonly<Record<string, string>> = import.meta.glob<string>('./sleeves/*.webp', { query: '?url', import: 'default', eager: true });
const URLS = new Map(Object.entries(FILES).map(([file, url]) => [file.slice('./sleeves/'.length, -'.webp'.length), url]));

/** Stem do sleeve com imagem (`sleeve-art:pikachu` → `pikachu`); null para versos procedurais. */
export function sleeveArtStem(assetKey: string | null | undefined): string | null {
  const m = assetKey ? /^sleeve-art:([a-z0-9-]+)$/.exec(assetKey) : null;
  return m ? m[1]! : null;
}

/** URL local do verso (`sleeve-art:pikachu` → sleeves/pikachu.webp); null sem imagem (vale o verso padrão). */
export function sleeveArtUrl(assetKey: string | null | undefined): string | null {
  const stem = sleeveArtStem(assetKey);
  return stem ? URLS.get(stem) ?? null : null;
}

export const SLEEVE_ART_STEMS: readonly string[] = [...URLS.keys()].sort();
