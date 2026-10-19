// Determinização (gameplay §25.2): estados plausíveis montados só da observação, coerentes com o catálogo.
import { describe, expect, it } from 'vitest';
import { getLegalActions } from '../battle/engine.ts';
import { seedRng } from '../random/rng.ts';
import { actionKey, alignWithObservation, determinize } from './determinize.ts';
import { createAiJob, STANDARD_PROFILE } from './index.ts';
import { cat, newMatch, randomAdvance, untilMainOf } from './test-support.ts';

describe('IA — determinização', () => {
  it('reconstrói zonas com as contagens certas, sem a ordem/mão reais, e com cartas do catálogo', () => {
    for (const seed of [2, 8, 14, 23]) {
      const real = untilMainOf(randomAdvance(newMatch(seed, 'FIRE', 'GRASS'), seed, 28), 'B', seed);
      const job = createAiJob({ state: real, catalog: cat, aiPlayer: 'B', profile: STANDARD_PROFILE, aiRng: seedRng(seed), jobId: 'd', attemptId: 'a', writerEpoch: 1 });
      const { state, rng } = determinize(job.observation, job.knowledge, cat, job.aiRng);
      expect(rng).not.toEqual(job.aiRng);
      for (const p of ['A', 'B'] as const) {
        expect(state.players[p].hand.length).toBe(real.players[p].hand.length);
        expect(state.players[p].deck.length).toBe(real.players[p].deck.length);
        expect(state.players[p].discard).toEqual(real.players[p].discard);
        expect(state.players[p].points).toBe(real.players[p].points);
      }
      // Própria mão idêntica; próprio baralho com a composição real (ordem sorteada).
      expect(state.players.B.hand).toEqual(real.players.B.hand);
      const keys = (s: typeof real, ids: readonly string[]) => ids.map((id) => s.cards[id]!.definitionKey).sort();
      expect(keys(state, state.players.B.deck)).toEqual(keys(real, real.players.B.deck));
      // A mão humana nunca é copiada: os IDs ocultos são sintéticos.
      for (const id of [...state.players.A.hand, ...state.players.A.deck, ...state.players.B.deck]) expect(id.startsWith('ai-')).toBe(true);
      // Toda carta referenciada existe no catálogo.
      for (const card of Object.values(state.cards)) expect(() => cat.definition(card.definitionKey)).not.toThrow();
      // O RNG simulado não é o de batalha.
      expect(state.rng).not.toEqual(real.rng);
      // Ações legais reais continuam legais no estado plausível (após alinhar os marcadores ocultos).
      alignWithObservation(state, job.observation, cat);
      const simulated = new Set(getLegalActions(state, cat, 'B').map(actionKey));
      for (const action of job.observation.legalActions) expect(simulated.has(actionKey(action)), JSON.stringify(action)).toBe(true);
    }
  });

  it('é determinística para o mesmo aiRng e varia com outro', () => {
    const real = untilMainOf(randomAdvance(newMatch(31, 'WATER', 'FIRE'), 31, 24), 'B', 31);
    const job = createAiJob({ state: real, catalog: cat, aiPlayer: 'B', profile: STANDARD_PROFILE, aiRng: seedRng(1), jobId: 'd', attemptId: 'a', writerEpoch: 1 });
    const a = determinize(job.observation, job.knowledge, cat, seedRng(7));
    const b = determinize(job.observation, job.knowledge, cat, seedRng(7));
    const c = determinize(job.observation, job.knowledge, cat, seedRng(8));
    expect(b.state).toEqual(a.state);
    expect(c.state.players.B.deck.map((id) => c.state.cards[id]!.definitionKey)).not.toEqual(a.state.players.B.deck.map((id) => a.state.cards[id]!.definitionKey));
  });
});
