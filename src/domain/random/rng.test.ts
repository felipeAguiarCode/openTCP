import { describe, expect, it } from 'vitest';
import { flipCoin, nextU32, seedRng, shuffle, uniformInt, weightedPick, type RngState } from './rng.ts';

describe('rng-v1', () => {
  it('é determinístico e serializável', () => {
    const a = seedRng(42);
    const b = JSON.parse(JSON.stringify(seedRng(42))) as RngState;
    expect(nextU32(a).value).toBe(nextU32(b).value);
    expect(a.state.some((w) => w !== 0)).toBe(true);
  });

  it('streams independentes não interferem', () => {
    const battle = seedRng(1);
    const economy = seedRng(2);
    const afterBattle = nextU32(nextU32(battle).rng).rng;
    expect(nextU32(economy).value).toBe(nextU32(seedRng(2)).value);
    expect(afterBattle.draws).toBe(2);
  });

  it('uniformInt sempre consome ao menos um uint32, inclusive n = 1', () => {
    const r = uniformInt(seedRng(7), 1);
    expect(r.value).toBe(0);
    expect(r.rng.draws).toBe(1);
  });

  it('moeda é justa (amostra grande)', () => {
    let rng = seedRng(123);
    let heads = 0;
    const n = 20000;
    for (let i = 0; i < n; i += 1) {
      const c = flipCoin(rng);
      rng = c.rng;
      if (c.value === 'HEADS') heads += 1;
    }
    expect(Math.abs(heads / n - 0.5)).toBeLessThan(0.015);
  });

  it('Fisher–Yates preserva os elementos e é reproduzível', () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const s1 = shuffle(seedRng(9), items);
    const s2 = shuffle(seedRng(9), items);
    expect(s1.value).toEqual(s2.value);
    expect([...s1.value].sort((a, b) => a - b)).toEqual(items);
    expect(s1.value).not.toEqual(items);
  });

  it('sorteio ponderado respeita pesos', () => {
    let rng = seedRng(5);
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 10000; i += 1) {
      const p = weightedPick(rng, [{ item: 'a' as const, weight: 3 }, { item: 'b' as const, weight: 1 }]);
      rng = p.rng;
      counts[p.value] += 1;
    }
    expect(counts.a / 10000).toBeGreaterThan(0.72);
    expect(counts.a / 10000).toBeLessThan(0.78);
  });
});
