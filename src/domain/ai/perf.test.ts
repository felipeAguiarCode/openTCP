// Desempenho (runtime §11.5): o perfil STANDARD de referência planeja em ≤ 300 ms em média em Node com os
// decks iniciais. O orçamento que decide é a contagem de nós; o tempo aqui é só medido.
import { describe, expect, it } from 'vitest';
import { DEFAULT_AI_PROFILES, playMatch } from './index.ts';
import { cat, newMatch, type DeckKind } from './test-support.ts';

describe('IA — desempenho', () => {
  it('STANDARD: média ≤ 300 ms por planejamento nos decks iniciais', () => {
    const games: [number, DeckKind, DeckKind][] = [[1, 'FIRE', 'WATER'], [2, 'GRASS', 'FIRE'], [3, 'WATER', 'GRASS'], [4, 'FIRE', 'FIRE']];
    const times: number[] = [];
    const nodes: number[] = [];
    for (const [seed, a, b] of games) {
      const result = playMatch({
        initial: newMatch(seed, a, b), catalog: cat, seed, clock: () => performance.now(),
        controllers: { A: { kind: 'AI', profile: DEFAULT_AI_PROFILES.STANDARD }, B: { kind: 'AI', profile: DEFAULT_AI_PROFILES.STANDARD } },
      });
      for (const p of result.plans) {
        if (p.nodes === 0) continue; // decisões e ações únicas não buscam
        times.push(p.ms);
        nodes.push(p.nodes);
      }
    }
    times.sort((x, y) => x - y);
    const avg = times.reduce((s, t) => s + t, 0) / times.length;
    const p95 = times[Math.floor(times.length * 0.95)]!;
    const avgNodes = nodes.reduce((s, n) => s + n, 0) / nodes.length;
    console.info(`[ai-perf] STANDARD: ${times.length} buscas, média ${avg.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms, máx ${times[times.length - 1]!.toFixed(1)} ms, ${avgNodes.toFixed(0)} nós em média`);
    expect(times.length).toBeGreaterThan(20);
    expect(avg).toBeLessThanOrEqual(300);
  }, 120_000);
});
