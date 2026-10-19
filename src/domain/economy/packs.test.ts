import { describe, expect, it } from 'vitest';
import type { Product } from '../../content/types.ts';
import { seedRng } from '../random/rng.ts';
import { openPack, printingOdds, validateRandomPack } from './packs.ts';

const pool = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => ({ printingId: `${prefix}-${i + 1}`, weight: 1 }));

const product: Product = {
  productId: 'pack-test-v1', version: 1, name: 'Teste', kind: 'RANDOM_PACK', price: { credits: 100 },
  availability: { fromStart: true, afterNodeId: null }, repeatable: true, cardsPerPack: 5,
  slots: [1, 2, 3, 4, 5].map((position) => ({
    position,
    categoryWeights: position < 4 ? { COMMON: 100, UNCOMMON: 0, RARE: 0, ULTRA: 0 } : { COMMON: 0, UNCOMMON: 70, RARE: 25, ULTRA: 5 },
  })),
  pools: { COMMON: pool('c', 6), UNCOMMON: pool('u', 4), RARE: pool('r', 3), ULTRA: pool('x', 1) },
};

describe('abertura de pacote', () => {
  it('é determinística pela semente do economyRng e respeita as categorias por posição', () => {
    const a = openPack(product, seedRng(42));
    const b = openPack(product, seedRng(42));
    expect(a).toEqual(b);
    expect(a.printingIds).toHaveLength(5);
    expect(a.categories.slice(0, 3)).toEqual(['COMMON', 'COMMON', 'COMMON']);
    expect(a.categories.slice(3).every((c) => c !== 'COMMON')).toBe(true);
    expect(a.rng).not.toEqual(seedRng(42));
  });

  it('distribuição das categorias converge para os pesos declarados (C-030)', () => {
    let rng = seedRng(7);
    const counts = { UNCOMMON: 0, RARE: 0, ULTRA: 0 };
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const r = openPack(product, rng);
      rng = r.rng;
      counts[r.categories[4] as keyof typeof counts]++;
    }
    expect(counts.UNCOMMON / N).toBeGreaterThan(0.66);
    expect(counts.UNCOMMON / N).toBeLessThan(0.74);
    expect(counts.ULTRA / N).toBeGreaterThan(0.03);
    expect(counts.ULTRA / N).toBeLessThan(0.07);
  });

  it('recusa categoria com chance positiva e pool vazio (C-031)', () => {
    const broken: Product = { ...product, pools: { ...product.pools!, ULTRA: [] } };
    expect(validateRandomPack(broken).join()).toMatch(/ULTRA/);
    expect(() => openPack(broken, seedRng(1))).toThrow();
  });

  it('pacote fixo não consome RNG', () => {
    const fixed: Product = { ...product, kind: 'FIXED_PACK', fixedContents: ['a', 'b'] };
    const rng = seedRng(3);
    const r = openPack(fixed, rng);
    expect(r.printingIds).toEqual(['a', 'b']);
    expect(r.rng).toEqual(rng);
  });

  it('probabilidades exibidas somam o número de cartas do pacote', () => {
    const odds = printingOdds(product);
    const total = odds.reduce((sum, o) => sum + o.expectedCopies, 0);
    expect(total).toBeCloseTo(5, 9);
    expect(odds.find((o) => o.printingId === 'x-1')!.expectedCopies).toBeCloseTo(0.1, 9);
  });
});
