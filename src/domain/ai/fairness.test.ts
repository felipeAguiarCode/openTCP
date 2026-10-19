// Justiça da IA (gameplay §25.1–§25.2, G-053; runtime §11.2, R-034): o job entregue ao planejador não
// contém a mão humana, a ordem real dos baralhos nem a semente/estado do RNG de batalha.
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { AiJob, AiKnowledge } from '../../application/ports/ai.ts';
import type { BattleView, SideView } from '../battle/views.ts';
import { createAiJob, planAction, STANDARD_PROFILE } from './index.ts';
import { cat, newMatch, randomAdvance, untilMainOf } from './test-support.ts';
import { seedRng } from '../random/rng.ts';

const FORBIDDEN_KEYS = ['players', 'cards', 'deck', 'rng', 'queue', 'frames', 'scriptedCoins', 'counters', 'koMarked', 'delayedEffects', 'stats', 'battleRng', 'seed', 'humanHand'];

function walk(value: unknown, visit: (key: string | null, v: unknown, path: string) => void, path = '$', key: string | null = null): void {
  visit(key, value, path);
  if (Array.isArray(value)) value.forEach((v, i) => walk(v, visit, `${path}[${i}]`, null));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) walk(v, visit, `${path}.${k}`, k);
}

describe('IA — payload do job (G-053, R-034)', () => {
  it('tipos: o job e o planejador não têm campos de estado completo', () => {
    expectTypeOf<keyof AiJob>().toEqualTypeOf<'type' | 'jobId' | 'attemptId' | 'stateRevision' | 'writerEpoch' | 'aiProfile' | 'observation' | 'knowledge' | 'aiRng'>();
    expectTypeOf<keyof AiKnowledge>().toEqualTypeOf<'ownDeckList' | 'seenOpponentCards'>();
    expectTypeOf<keyof Parameters<typeof planAction>[0]>().toEqualTypeOf<'job' | 'catalog' | 'clock'>();
    expectTypeOf<BattleView>().not.toHaveProperty('players');
    expectTypeOf<BattleView>().not.toHaveProperty('rng');
    expectTypeOf<BattleView>().not.toHaveProperty('cards');
    expectTypeOf<BattleView>().not.toHaveProperty('queue');
    expectTypeOf<SideView>().not.toHaveProperty('deck');
  });

  it('JSON do job a partir de um estado real de meio de partida não vaza informação oculta', () => {
    for (const seed of [3, 11, 29]) {
      const state = untilMainOf(randomAdvance(newMatch(seed, 'FIRE', 'WATER'), seed, 30), 'B', seed);
      const job = createAiJob({ state, catalog: cat, aiPlayer: 'B', profile: STANDARD_PROFILE, aiRng: seedRng(99), jobId: 'j', attemptId: 'a', writerEpoch: 1 });
      const json = JSON.stringify(job);
      expect(Object.keys(job).sort()).toEqual(['aiProfile', 'aiRng', 'attemptId', 'jobId', 'knowledge', 'observation', 'stateRevision', 'type', 'writerEpoch']);
      expect(Object.keys(job.knowledge).sort()).toEqual(['ownDeckList', 'seenOpponentCards']);
      // Mão humana, ordem dos dois baralhos: nenhum desses IDs aparece em lugar algum do job.
      const hidden = [...state.players.A.hand, ...state.players.A.deck, ...state.players.B.deck];
      expect(hidden.length).toBeGreaterThan(0);
      for (const id of hidden) expect(json.includes(`"${id}"`), `vazou ${id}`).toBe(false);
      expect(job.observation.sides.A.hand).toBeNull();
      expect(job.observation.sides.A.deckRemaining).toBeNull();
      // Próprio baralho: só a composição ordenada (sem ordem real).
      expect(job.observation.sides.B.deckRemaining).toEqual([...job.observation.sides.B.deckRemaining!].sort());
      // Nenhuma chave de estado completo e nenhum número do RNG de batalha.
      const battleWords = new Set<number>(state.rng.state);
      walk(job, (key, value, path) => {
        if (key && FORBIDDEN_KEYS.includes(key)) throw new Error(`campo proibido ${path}`);
        if (typeof value === 'number' && battleWords.has(value) && !path.startsWith('$.aiRng')) throw new Error(`palavra do RNG de batalha em ${path}`);
      });
      // A lista de cartas vistas do adversário só contém o que está/esteve em zona pública.
      const publicKeys = new Set([
        ...[state.players.A.active, ...state.players.A.bench].flatMap((e) => (e ? [...e.stack, ...(e.toolCardId ? [e.toolCardId] : [])] : [])),
        ...state.players.A.discard,
      ].map((id) => state.cards[id]!.definitionKey));
      for (const key of job.knowledge.seenOpponentCards) expect(publicKeys.has(key)).toBe(true);
      // Ações legais: apenas as do próprio NPC.
      expect(job.observation.legalActions.every((a) => a.player === 'B')).toBe(true);
    }
  });

  it('o planejador só depende do job serializável (ida e volta por JSON produz a mesma ação)', () => {
    const state = untilMainOf(randomAdvance(newMatch(5, 'GRASS', 'FIRE'), 5, 24), 'B', 5);
    const job = createAiJob({ state, catalog: cat, aiPlayer: 'B', profile: STANDARD_PROFILE, aiRng: seedRng(1234), jobId: 'j', attemptId: 'a', writerEpoch: 1 });
    const copy = JSON.parse(JSON.stringify(job)) as AiJob;
    expect(planAction({ job: copy, catalog: cat })).toEqual(planAction({ job, catalog: cat }));
  });
});
