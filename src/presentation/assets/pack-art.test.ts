// Arte oficial dos pacotes: todo pacote de expansão do conteúdo tem a frente empacotada; tutorial e promocionais
// (sem arte oficial) ficam com a arte gerada.
import { describe, expect, it } from 'vitest';
import { buildBundle } from '../../content/bundle.ts';
import { PACK_ART_PRODUCTS, packArtUrl } from './pack-art.ts';

describe('arte oficial dos pacotes', () => {
  it('os 15 pacotes de expansão têm a frente empacotada; tutorial e promocionais não', () => {
    const packs = buildBundle().products.filter((p) => p.kind === 'RANDOM_PACK' || p.kind === 'FIXED_PACK');
    const official = packs.filter((p) => p.kind === 'RANDOM_PACK' && !p.productId.endsWith('-promo'));
    expect(official).toHaveLength(15);
    for (const p of official) expect(packArtUrl(p.productId), p.productId).toMatch(/\.webp/);
    for (const id of ['pack-tutorial-v1', 'pack-pa-promo', 'pack-pb-promo']) expect(packArtUrl(id), id).toBeNull();
    expect([...PACK_ART_PRODUCTS].sort()).toEqual(official.map((p) => p.productId).sort());
  });
});
