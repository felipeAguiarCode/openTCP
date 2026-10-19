// Pacote por símbolo (taxas oficiais do Pocket, campanha §16.2): exatidão das probabilidades exibidas e
// convergência estatística do sorteio, com as tabelas reais (BRILHANTE + 6ª carta + pacote raro, DELUXE).
import { describe, expect, it } from 'vitest';
import type { Product, TierPools } from '../../content/types.ts';
import { BABY_BONUS, RARE_PACK, TIER_TABLES } from '../../content/source/pocket/rates.ts';
import type { RaritySymbol } from '../cards/rarity.ts';
import { seedRng } from '../random/rng.ts';
import { openPack, packRateTable, printingOdds, validateRandomPack } from './packs.ts';

const ids = (symbol: string, n: number) => Array.from({ length: n }, (_, i) => `${symbol}-${i + 1}`);
const SIZES: Readonly<Partial<Record<RaritySymbol, number>>> = { '◊': 42, '◊◊': 31, '◊◊◊': 14, '◊◊◊◊': 5, '☆': 11, '☆☆': 12, '☆☆☆': 1, '✵': 10, '✵✵': 4, '♛': 2 };
const pools: TierPools = Object.fromEntries(Object.entries(SIZES).map(([s, n]) => [s, ids(`m${s}`, n!)]));

const shiny: Product = {
  productId: 'pack-test-shiny', version: 1, name: 'Teste', kind: 'RANDOM_PACK', price: { credits: 100 },
  availability: { fromStart: true, afterNodeId: null }, repeatable: true, cardsPerPack: 5,
  tierSlots: TIER_TABLES.SHINY.map((weights, i) => ({ position: i + 1, weights })),
  tierPools: pools,
  bonusSlot: { chance: BABY_BONUS.chance, weights: BABY_BONUS.weights, pools: { '◊◊◊': ['baby-1', 'baby-2', 'baby-3'], '☆': ['baby-star'] } },
  rarePack: { chance: RARE_PACK.chance, symbols: RARE_PACK.symbols },
};

const deluxe: Product = {
  ...shiny, productId: 'pack-test-deluxe', cardsPerPack: 4, bonusSlot: undefined,
  tierSlots: TIER_TABLES.DELUXE.map((weights, i) => ({ position: i + 1, weights })),
  tierPools: { '◊': ids('d◊', 128), '◊◊': ids('d◊◊', 100), '◊◊◊': ids('d◊◊◊', 50), '◊◊◊◊': ids('d◊◊◊◊', 75), '☆': ids('d☆', 6), '☆☆': ids('d☆☆', 16), '☆☆☆': ['d☆☆☆'], '✵✵': ['dg', 'dd'], '♛': ['dcrown'] },
};

describe('pacote por símbolo (taxas oficiais)', () => {
  it('toda posição das tabelas oficiais soma 100000', () => {
    for (const table of Object.values(TIER_TABLES)) for (const w of table) expect(Object.values(w).reduce((a, b) => a + (b ?? 0), 0)).toBe(100000);
    expect(Object.values(BABY_BONUS.weights).reduce((a, b) => a + (b ?? 0), 0)).toBe(100000);
  });

  it('é válido e determinístico; 5 cartas ou 6 com a carta extra no fim', () => {
    expect(validateRandomPack(shiny)).toEqual([]);
    const a = openPack(shiny, seedRng(42));
    expect(openPack(shiny, seedRng(42))).toEqual(a);
    expect([5, 6]).toContain(a.printingIds.length);
    expect(a.symbols!.slice(0, 3)).toEqual(['◊', '◊', '◊']);
  });

  it('tabela exibida: totais oficiais por posição e valor por carta', () => {
    const t = packRateTable(shiny)!;
    expect(t.columns.map((c) => c.label)).toEqual(['1ª–3ª', '4ª', '5ª']);
    const row = (s: RaritySymbol) => t.rows.find((r) => r.symbol === s)!;
    expect(row('◊◊').total[1]).toBeCloseTo(0.89, 10);
    expect(row('✵').perCard[2]).toBeCloseTo(0.02857 / 10, 10);
    expect(row('♛').total[2]).toBeCloseTo(0.0016, 10);
    expect(t.rare).toEqual({ chance: 0.0005, poolSize: 11 + 12 + 1 + 10 + 4 + 2, perCard: 1 / 40 });
    expect(t.bonus!.chance).toBeCloseTo(0.0833, 10);
    expect(t.bonus!.rows.find((r) => r.symbol === '◊◊◊')!.perCard).toBeCloseTo(0.29033, 5);
  });

  it('chance por carta = (1 − raro) × peso/total/pool + raro/união; 6ª carta numa coluna à parte', () => {
    const odds = new Map(printingOdds(shiny).map((o) => [o.printingId, o]));
    const r = 0.0005;
    expect(odds.get('m◊◊-1')!.perSlot[3]).toBeCloseTo((1 - r) * 0.89 / 31, 12);
    expect(odds.get('m♛-1')!.perSlot[4]).toBeCloseTo((1 - r) * 0.0016 / 2 + r / 40, 12);
    expect(odds.get('baby-1')!.perSlot).toHaveLength(6);
    expect(odds.get('baby-1')!.perSlot[5]).toBeCloseTo((1 - r) * 0.0833 * 0.871 / 3, 12);
    const expected = [...odds.values()].reduce((sum, o) => sum + o.expectedCopies, 0);
    expect(expected).toBeCloseTo(5 + (1 - r) * 0.0833, 10);
  });

  it('Deluxe: 4 cartas, a 4ª sempre ◊◊◊◊; ☆☆☆ único 1,111% e cada ✵✵ 0,8335% na 3ª posição', () => {
    expect(validateRandomPack(deluxe)).toEqual([]);
    const odds = new Map(printingOdds(deluxe).map((o) => [o.printingId, o]));
    const r = 0.0005;
    expect(odds.get('d☆☆☆')!.perSlot[2]).toBeCloseTo((1 - r) * 0.01111 + r / 26, 12);
    expect(odds.get('dg')!.perSlot[2]).toBeCloseTo((1 - r) * 0.01667 / 2 + r / 26, 12);
    for (let seed = 1; seed < 50; seed++) {
      const p = openPack(deluxe, seedRng(seed));
      expect(p.printingIds).toHaveLength(4);
      if (!p.rarePack) expect(p.symbols![3]).toBe('◊◊◊◊');
    }
  });

  it('converge para as taxas: símbolos da 5ª carta, 6ª carta e pacote raro (200 mil aberturas)', () => {
    let rng = seedRng(2026);
    const N = 200_000;
    let bonus = 0;
    let rare = 0;
    const fifth = new Map<RaritySymbol, number>();
    for (let i = 0; i < N; i++) {
      const p = openPack(shiny, rng);
      rng = p.rng;
      if (p.rarePack) { rare++; expect(p.symbols!.every((s) => RARE_PACK.symbols.includes(s as never))).toBe(true); continue; }
      if (p.bonus) { bonus++; expect(p.printingIds[5]).toMatch(/^baby-/); }
      fifth.set(p.symbols![4]!, (fifth.get(p.symbols![4]!) ?? 0) + 1);
    }
    const within = (count: number, n: number, prob: number) => Math.abs(count - n * prob) <= 4 * Math.sqrt(n * prob * (1 - prob)) + 1;
    expect(within(rare, N, 0.0005)).toBe(true);
    expect(within(bonus, N - rare, 0.0833)).toBe(true);
    for (const [s, w] of Object.entries(TIER_TABLES.SHINY[4]!) as [RaritySymbol, number][]) expect(within(fifth.get(s) ?? 0, N - rare, w / 100000), s).toBe(true);
  });

  it('recusa símbolo com chance positiva e pool vazio (C-031) e pacote raro sem cartas', () => {
    expect(validateRandomPack({ ...shiny, tierPools: { ...pools, '♛': [] } }).join()).toMatch(/♛/);
    const noStars = { '◊': ['a'], '◊◊': ['b'], '◊◊◊': ['c'], '◊◊◊◊': ['d'] };
    expect(validateRandomPack({ ...shiny, tierSlots: TIER_TABLES.SHINY.slice(0, 3).map((weights, i) => ({ position: i + 1, weights })), cardsPerPack: 3, tierPools: noStars }).join()).toMatch(/pacote raro sem/);
  });
});
