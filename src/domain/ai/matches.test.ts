// Partidas completas IA × IA com os decks iniciais (G-052, R-035): todas terminam e toda ação proposta
// pela IA passa no mesmo validador do motor, aplicado ao estado real.
import { describe, expect, it } from 'vitest';
import type { AiProfile } from '../../content/types.ts';
import { DEFAULT_AI_PROFILES, playMatch, type Controller } from './index.ts';
import { cat, newMatch, type DeckKind } from './test-support.ts';

const { STORY, STANDARD, EXPERT } = DEFAULT_AI_PROFILES;
const ai = (profile: AiProfile): Controller => ({ kind: 'AI', profile });

const CASES: { seed: number; decks: [DeckKind, DeckKind]; A: Controller; B: Controller }[] = [
  { seed: 1, decks: ['FIRE', 'WATER'], A: ai(STORY), B: ai(STANDARD) },
  { seed: 2, decks: ['GRASS', 'FIRE'], A: ai(STANDARD), B: ai(EXPERT) },
  { seed: 3, decks: ['WATER', 'GRASS'], A: ai(EXPERT), B: ai(STORY) },
  { seed: 4, decks: ['FIRE', 'FIRE'], A: ai(STANDARD), B: ai(STANDARD) },
  { seed: 5, decks: ['WATER', 'WATER'], A: ai(STORY), B: ai(STORY) },
  { seed: 6, decks: ['GRASS', 'GRASS'], A: ai(EXPERT), B: ai(EXPERT) },
  { seed: 7, decks: ['FIRE', 'GRASS'], A: { kind: 'RANDOM' }, B: ai(EXPERT) },
  { seed: 8, decks: ['WATER', 'FIRE'], A: ai(STANDARD), B: { kind: 'RANDOM' } },
];

describe('IA — partidas completas com os decks iniciais (G-052)', () => {
  it('todas terminam, sem ação ilegal nem fallback, exercitando as decisões', () => {
    const kinds = new Set<string>();
    for (const c of CASES) {
      const initial = newMatch(c.seed, c.decks[0], c.decks[1]);
      const decisionKinds = new Map<string, string>();
      const result = playMatch({
        initial, catalog: cat, seed: c.seed, controllers: { A: c.A, B: c.B },
        onPlan: (job, r) => {
          if (r.action.type !== 'RESOLVE_DECISION') return;
          const d = job.observation.decisions.find((x) => x.decisionId === (r.action as { decisionId: string }).decisionId);
          if (d) decisionKinds.set(d.decisionId, d.kind);
        },
      });
      expect(result.state.result, `seed ${c.seed}`).not.toBeNull();
      expect(result.state.globalTurnNumber).toBeLessThanOrEqual(60);
      expect(result.illegal, `seed ${c.seed}`).toEqual([]);
      expect(result.plans.filter((p) => p.fallback), `seed ${c.seed}`).toEqual([]);
      expect(result.plans.length).toBeGreaterThan(0);
      decisionKinds.forEach((k) => kinds.add(k));
    }
    expect(kinds.has('SETUP')).toBe(true);
    expect(kinds.has('PROMOTE') || kinds.has('SELECT_TARGETS')).toBe(true);
  }, 240_000);
});
