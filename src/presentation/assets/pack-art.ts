// Arte oficial dos pacotes (frente do booster): `source/packs/` e, no Genetic Apex, o Serebii, recortadas por
// `npm run assets:packs` (tools/asset-import/pack-art.py) para packs/<productId>.webp, até 640 px de altura e com
// transparência. Usada nas telas de pacotes, no Empório, nas caixas do Início e na frente do pacote 3D da abertura.
// Pacote tutorial e promocionais não têm arte oficial e seguem com a arte gerada. Origem e restrições em ASSETS.md.

const FILES: Readonly<Record<string, string>> = import.meta.glob<string>('./packs/*.webp', { query: '?url', import: 'default', eager: true });
const URLS = new Map(Object.entries(FILES).map(([file, url]) => [file.slice('./packs/'.length, -'.webp'.length), url]));

/** URL local da frente do pacote (`pack-a2-dialga` → packs/pack-a2-dialga.webp); null para pacotes sem arte oficial. */
export function packArtUrl(productId: string | null | undefined): string | null {
  return productId ? URLS.get(productId) ?? null : null;
}

export const PACK_ART_PRODUCTS: readonly string[] = [...URLS.keys()].sort();
