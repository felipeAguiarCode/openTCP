// Reprodutibilidade (gameplay §25.4, runtime §11.3): orçamento por nós, nunca por tempo de parede.
import { describe, expect, it } from 'vitest';
import { stateHash } from '../battle/engine.ts';
import { seedRng } from '../random/rng.ts';
import { createAiJob, DEFAULT_AI_PROFILES, planAction, playMatch } from './index.ts';
import { cat, newMatch, randomAdvance, untilMainOf } from './test-support.ts';

describe('IA — determinismo', () => {
  it('mesmo job → mesma ação, mesmo aiRng e mesma contagem de nós (todas as políticas)', () => {
    for (const seed of [4, 9]) {
      const state = untilMainOf(randomAdvance(newMatch(seed, 'WATER', 'GRASS'), seed, 26), 'B', seed);
      for (const profile of Object.values(DEFAULT_AI_PROFILES)) {
        const job = createAiJob({ state, catalog: cat, aiPlayer: 'B', profile, aiRng: seedRng(seed * 31), jobId: 'det', attemptId: 'a', writerEpoch: 1 });
        const first = planAction({ job, catalog: cat });
        const second = planAction({ job: structuredClone(job), catalog: cat });
        expect(second).toEqual(first);
        expect(first.fallback).toBe(false);
        expect(first.nodesExplored).toBeLessThanOrEqual(profile.budget.maxNodes);
      }
    }
  });

  it('o relógio só serve de watchdog: velocidade diferente não muda a escolha', () => {
    const state = untilMainOf(randomAdvance(newMatch(12, 'FIRE', 'GRASS'), 12, 20), 'B', 12);
    const job = createAiJob({ state, catalog: cat, aiPlayer: 'B', profile: DEFAULT_AI_PROFILES.STANDARD, aiRng: seedRng(5), jobId: 'clk', attemptId: 'a', writerEpoch: 1 });
    let slow = 0;
    const a = planAction({ job, catalog: cat, clock: () => 0 });
    const b = planAction({ job, catalog: cat, clock: () => (slow += 0.1) });
    expect(b).toEqual(a);
  });

  it('watchdog estourado devolve a melhor ação legal conhecida (sem travar)', () => {
    const state = untilMainOf(randomAdvance(newMatch(13, 'WATER', 'FIRE'), 13, 20), 'B', 13);
    const job = createAiJob({ state, catalog: cat, aiPlayer: 'B', profile: DEFAULT_AI_PROFILES.EXPERT, aiRng: seedRng(5), jobId: 'wd', attemptId: 'a', writerEpoch: 1 });
    let t = 0;
    const result = planAction({ job, catalog: cat, clock: () => (t += 1000) });
    expect(job.observation.legalActions).toContainEqual(result.action);
  });

  it('partida IA × IA com as mesmas sementes reproduz o mesmo estado final (hash)', () => {
    const run = () => playMatch({
      initial: newMatch(21, 'GRASS', 'WATER'), catalog: cat, seed: 21,
      controllers: { A: { kind: 'AI', profile: DEFAULT_AI_PROFILES.STANDARD }, B: { kind: 'AI', profile: DEFAULT_AI_PROFILES.STORY } },
    });
    const first = run();
    const second = run();
    expect(first.state.result).not.toBeNull();
    expect(stateHash(second.state)).toBe(stateHash(first.state));
    expect(second.plans.map((p) => p.action)).toEqual(first.plans.map((p) => p.action));
  }, 120_000);
});
