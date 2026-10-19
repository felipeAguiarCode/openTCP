// Registro com contagem de referências e cache LRU de texturas por orçamento (runtime §21.1/§21.3).
import { describe, expect, it } from 'vitest';
import { createResourceRegistry, createTextureCache, estimateTextureBytes } from './resources.ts';

const disposable = (log: string[], name: string) => ({ dispose: () => log.push(name) });

describe('ResourceRegistry', () => {
  it('compartilha por chave e só descarta quando a última referência sai', () => {
    const log: string[] = [];
    const reg = createResourceRegistry();
    const a = reg.acquire('geo:card', () => disposable(log, 'geo'));
    const b = reg.acquire('geo:card', () => disposable(log, 'outro'));
    expect(a).toBe(b);
    expect(reg.refCount('geo:card')).toBe(2);
    reg.release('geo:card');
    expect(log).toEqual([]);
    reg.release('geo:card');
    expect(log).toEqual(['geo']);
    expect(reg.stats()).toEqual({ entries: 0, references: 0 });
    reg.release('geo:card');
    expect(log).toEqual(['geo']);
  });
});

describe('TextureCache (LRU)', () => {
  it('nunca despeja texturas referenciadas; despeja as livres menos recentes acima do orçamento', () => {
    const log: string[] = [];
    const cache = createTextureCache(250);
    cache.acquire('a', () => disposable(log, 'a'), 100);
    cache.acquire('b', () => disposable(log, 'b'), 100);
    cache.release('a');
    cache.release('b');
    expect(log).toEqual([]);
    cache.acquire('a', () => disposable(log, 'a2'), 100);
    cache.release('a');
    cache.acquire('c', () => disposable(log, 'c'), 100);
    // 'b' é a menos recente sem referências.
    expect(log).toEqual(['b']);
    expect(cache.has('a')).toBe(true);
    const big = createTextureCache(10);
    big.acquire('x', () => disposable(log, 'x'), 100);
    expect(big.has('x')).toBe(true);
    big.release('x');
    expect(big.has('x')).toBe(false);
    expect(big.stats().evictions).toBe(1);
  });

  it('reduzir o orçamento (qualidade Baixa) despeja o excedente livre', () => {
    const log: string[] = [];
    const cache = createTextureCache(1000);
    for (const k of ['p', 'q', 'r']) {
      cache.acquire(k, () => disposable(log, k), 300);
      cache.release(k);
    }
    cache.setBudget(400);
    expect(log).toEqual(['p', 'q']);
    expect(cache.stats().bytes).toBe(300);
  });

  it('estimativa RGBA8 com mipmaps', () => {
    expect(estimateTextureBytes(500, 700, false)).toBe(1_400_000);
    expect(estimateTextureBytes(500, 700)).toBe(Math.round(1_400_000 * 4 / 3));
  });
});
