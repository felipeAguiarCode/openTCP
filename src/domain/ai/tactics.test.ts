// Situações táticas preparadas (fixtures): Nocaute que vale 3 pontos, letal, Energia no alvo certo,
// decisões obrigatórias e caminhos de erro/fallback.
import { describe, expect, it } from 'vitest';
import type { AiJob } from '../../application/ports/ai.ts';
import { applyAction, validateAction } from '../battle/engine.ts';
import { createMatch } from '../battle/setup.ts';
import { starterDeck } from '../../tests/support/starter-catalog.ts';
import type { CatalogLookup, MatchState } from '../battle/types.ts';
import { seedRng } from '../random/rng.ts';
import { createAiJob, DEFAULT_AI_PROFILES, planAction } from './index.ts';
import { cat, fixtureState, megaTarget, P, runAiTurn, S, side } from './test-support.ts';

const { STORY, STANDARD, EXPERT } = DEFAULT_AI_PROFILES;
const STORY_STRICT = { ...STORY, aiProfileId: 'story-strict', tolerance: { suboptimalChance: 0, candidatePoolTop: 1 } };
const fireZone = { types: ['FIRE' as const], ready: 'FIRE' as const, next: 'FIRE' as const };

function entityOf(state: MatchState, player: 'A' | 'B', definitionId: string) {
  return [state.players[player].active, ...state.players[player].bench].find((e) => e && state.cards[e.stack[e.stack.length - 1]!]!.definitionKey === `${definitionId}@1`) ?? null;
}

describe('IA — Nocautes decisivos', () => {
  it('Nocauteia um Mega ex (3 pontos) quando possível, mesmo precisando ligar a Energia antes', () => {
    for (const profile of [STORY_STRICT, STANDARD, EXPERT]) {
      for (const seed of [1, 2, 3]) {
        const state = fixtureState(
          side({ active: { stack: [P(megaTarget)] }, bench: [{ stack: [P(S.gota)] }], energyZone: { types: ['WATER'], ready: null, next: 'WATER' } }),
          side({ active: { stack: [P(S.faisca), P(S.braseiro)] }, bench: [{ stack: [P(S.carvito)] }], hand: [P(S.estudioso), P(S.faisca), P(S.kitReparo)], energyZone: fireZone }),
        );
        const run = runAiTurn(state, 'B', profile, seed);
        expect(run.state.result, `${profile.policy}/${seed}`).toMatchObject({ winner: 'B', reason: 'POINTS' });
        expect(run.state.players.B.points).toBe(3);
        expect(run.fallbacks).toBe(0);
      }
    }
  });

  it('fecha a partida com o Nocaute letal (2 → 3 pontos)', () => {
    for (const profile of [STORY_STRICT, STANDARD, EXPERT]) {
      for (const seed of [4, 5]) {
        const state = fixtureState(
          side({ active: { stack: [P(S.gota)], damage: 50 }, bench: [{ stack: [P(S.nimbo)] }, { stack: [P(S.marulho)] }], energyZone: { types: ['WATER'], ready: null, next: 'WATER' } }),
          side({ active: { stack: [P(S.faisca)], energies: ['FIRE'] }, bench: [{ stack: [P(S.carvito)] }], hand: [P(S.carvito), P(S.mentoria), P(S.talisma)], energyZone: fireZone, points: 2 }),
        );
        const run = runAiTurn(state, 'B', profile, seed);
        expect(run.state.result, `${profile.policy}/${seed}`).toMatchObject({ winner: 'B', reason: 'POINTS' });
      }
    }
  });
});

describe('IA — Energia no Pokémon que pode usá-la', () => {
  it('não liga Energia de Água em quem não tem uso para ela quando há alvo melhor', () => {
    for (const profile of [STANDARD, EXPERT]) {
      for (const seed of [1, 2, 3, 4]) {
        const state = fixtureState(
          side({ active: { stack: [P(S.broto)] }, bench: [{ stack: [P(S.semente)] }], energyZone: { types: ['GRASS'], ready: null, next: 'GRASS' } }),
          side({ active: { stack: [P(S.nimbo)], energies: ['WATER'] }, bench: [{ stack: [P(S.faisca)] }, { stack: [P(S.gota)] }], hand: [], energyZone: { types: ['WATER'], ready: 'WATER', next: 'WATER' } }),
        );
        const faisca = entityOf(state, 'B', 'faisca')!;
        const run = runAiTurn(state, 'B', profile, seed);
        const attach = run.actions.filter((a) => a.type === 'ATTACH_ENERGY');
        expect(attach.length, `${profile.policy}/${seed}`).toBe(1);
        expect((attach[0] as { targetEntityId: string }).targetEntityId).not.toBe(faisca.entityId);
      }
    }
  });
});

describe('IA — agressividade (gameplay §25.3, G-089)', () => {
  const noFire = { types: ['FIRE' as const], ready: null, next: 'FIRE' as const };
  const water = { types: ['WATER' as const], ready: null, next: 'WATER' as const };
  // Gota com Água Nocauteia a Faísca ferida (20 + 20 de Fraqueza ≥ 30); Fagulha não Nocauteia a Gota.
  const threatened = (opts: { humanPoints?: number; reserve?: 'FIRE'[] } = {}) => fixtureState(
    side({ active: { stack: [P(S.gota)], energies: ['WATER'] }, bench: [{ stack: [P(S.nimbo)] }], energyZone: water, points: opts.humanPoints ?? 0 }),
    side({ active: { stack: [P(S.faisca)], energies: ['FIRE'], damage: 40 }, bench: [{ stack: [P(S.carvito)], energies: opts.reserve ?? [] }], energyZone: noFire }),
  );
  const types = (run: { actions: readonly { type: string }[] }) => run.actions.map((a) => a.type).filter((t) => t !== 'RESOLVE_DECISION');

  it('ataca em vez de esconder o Ativo ferido atrás de um reserva que não ataca', () => {
    // Faísca com 10 de HP e Brasaçu (120 HP, sem Energia) no Banco: antes, a busca ligava a Energia, recuava e passava.
    const state = () => fixtureState(
      side({ active: { stack: [P(S.gota)], energies: ['WATER'] }, bench: [{ stack: [P(S.nimbo)] }], energyZone: water }),
      side({ active: { stack: [P(S.faisca)], energies: ['FIRE'], damage: 60 }, bench: [{ stack: [P(S.carvito), P(S.brasacu)] }], energyZone: fireZone }),
    );
    for (const profile of [STORY_STRICT, STANDARD, EXPERT]) {
      for (const seed of [1, 2, 3]) {
        const run = runAiTurn(state(), 'B', profile, seed);
        expect(types(run), `${profile.policy}/${seed}`).not.toContain('RETREAT');
        expect(run.actions.at(-1)).toMatchObject({ type: 'ATTACK', attackId: 'fagulha' });
      }
    }
  });

  it('Nocauteia o Ativo mesmo quando isso promove um atacante que ameaça o seu', () => {
    // Fornalha Nocauteia a Semente; o Marulho promovido Nocautearia o Brasaçu ferido. Antes, a IA passava para não
    // “trazer” o Marulho — que o adversário traria de qualquer forma pelo Recuo.
    const state = () => fixtureState(
      side({ active: { stack: [P(S.semente)], energies: ['GRASS'] }, bench: [{ stack: [P(S.gota), P(S.marulho)], energies: ['WATER'] }], energyZone: water }),
      side({ active: { stack: [P(S.carvito), P(S.brasacu)], energies: ['FIRE', 'FIRE'], damage: 70 }, bench: [{ stack: [P(S.faisca)] }], energyZone: noFire }),
    );
    for (const profile of [STORY_STRICT, STANDARD, EXPERT]) {
      for (const seed of [1, 2, 3]) {
        const run = runAiTurn(state(), 'B', profile, seed);
        expect(run.actions.at(-1), `${profile.policy}/${seed}`).toMatchObject({ type: 'ATTACK', attackId: 'fornalha' });
        expect(run.state.players.B.points).toBe(1);
      }
    }
  });

  it('com o Ativo prestes a cair e um reserva pronto, recua e ataca com ele — ou ataca com o Ativo; nunca passa', () => {
    for (const profile of [STORY_STRICT, STANDARD, EXPERT]) {
      for (const seed of [1, 2, 3]) {
        const run = runAiTurn(threatened({ reserve: ['FIRE'] }), 'B', profile, seed);
        const t = types(run);
        expect(t.at(-1), `${profile.policy}/${seed}`).toBe('ATTACK');
        if (t.includes('RETREAT')) expect(run.actions.at(-1)).toMatchObject({ attackId: 'brasa' });
      }
    }
    // A busca do turno (Padrão e Especialista) preserva o ponto: recua para o Carvito e ataca com Brasa.
    for (const profile of [STANDARD, EXPERT]) expect(types(runAiTurn(threatened({ reserve: ['FIRE'] }), 'B', profile, 1))).toEqual(['RETREAT', 'ATTACK']);
  });

  it('recua para um reserva que não ataca só para não entregar a vitória', () => {
    for (const profile of [STANDARD, EXPERT]) {
      for (const seed of [1, 2, 3]) {
        const run = runAiTurn(threatened({ humanPoints: 2 }), 'B', profile, seed);
        expect(types(run), `${profile.policy}/${seed}`).toContain('RETREAT');
      }
    }
  });

  it('o erro tolerado nunca é passivo: com ataque disponível, não encerra o turno nem recua', () => {
    const loose = [
      { ...STORY, aiProfileId: 'story-loose', tolerance: { suboptimalChance: 0.5, candidatePoolTop: 3 } },
      { ...STANDARD, aiProfileId: 'standard-loose', tolerance: { suboptimalChance: 0.5, candidatePoolTop: 2 } },
    ];
    for (const profile of loose) {
      for (let seed = 1; seed <= 12; seed += 1) {
        const run = runAiTurn(threatened(), 'B', profile, seed);
        const t = types(run);
        expect(t.at(-1), `${profile.policy}/${seed}`).toBe('ATTACK');
        expect(t).not.toContain('RETREAT');
      }
    }
  });
});

describe('IA — decisões obrigatórias', () => {
  it('promove um reserva legal conforme a política após Nocaute do Ativo', () => {
    const base = fixtureState(
      side({ active: { stack: [P(S.faisca), P(S.braseiro)], energies: ['FIRE'] }, energyZone: fireZone }),
      side({ active: { stack: [P(S.semente)], damage: 30 }, bench: [{ stack: [P(S.semente)] }, { stack: [P(S.broto)], energies: ['GRASS'] }], energyZone: { types: ['GRASS'], ready: null, next: 'GRASS' } }),
      { currentPlayer: 'HUMAN' },
    );
    const attacked = applyAction(base, cat, { type: 'ATTACK', player: 'A', attackId: 'golpe-de-chama' });
    if (!attacked.ok) throw new Error(attacked.code);
    const state = attacked.state;
    const decision = state.pendingDecisions.find((d) => d.player === 'B' && !d.answered)!;
    expect(decision.kind).toBe('PROMOTE');
    const broto = entityOf(state, 'B', 'broto')!;
    for (const profile of [STORY, STANDARD, EXPERT]) {
      const job = createAiJob({ state, catalog: cat, aiPlayer: 'B', profile, aiRng: seedRng(1), jobId: 'p', attemptId: 'a', writerEpoch: 1 });
      const result = planAction({ job, catalog: cat });
      expect(result.fallback).toBe(false);
      expect(validateAction(state, cat, result.action).ok).toBe(true);
      // Broto: mais HP e já pode atacar — melhor resposta em todas as políticas de referência.
      expect(result.action).toMatchObject({ type: 'RESOLVE_DECISION', selection: [broto.entityId] });
    }
  });

  it('usa Troca Tática e escolhe um alvo legal do próprio Banco', () => {
    const state = fixtureState(
      side({ active: { stack: [P(S.gota)], energies: ['WATER'] }, energyZone: { types: ['WATER'], ready: null, next: 'WATER' } }),
      side({ active: { stack: [P(S.faisca)], damage: 50 }, bench: [{ stack: [P(S.carvito)], energies: ['FIRE'] }, { stack: [P(S.faisca)] }], hand: [P(S.trocaTatica)], energyZone: fireZone }),
    );
    for (const profile of [STANDARD, EXPERT]) {
      const run = runAiTurn(state, 'B', profile, 9);
      expect(run.fallbacks).toBe(0);
      const decisions = run.actions.filter((a) => a.type === 'RESOLVE_DECISION');
      expect(decisions.length).toBeGreaterThan(0);
      const active = run.state.players.B.active ?? run.state.players.B.bench.find(Boolean)!;
      expect(run.state.cards[active.stack[0]!]!.definitionKey).toBe('carvito@1');
    }
  });

  it('responde SETUP com Ativo e Banco legais conforme a política', () => {
    // SETUP real: criado pelo fluxo normal de partida.
    const job = (profile: typeof STORY) => createAiJob({ state: setupState(), catalog: cat, aiPlayer: 'B', profile, aiRng: seedRng(2), jobId: 's', attemptId: 'a', writerEpoch: 1 });
    for (const profile of [STORY, STANDARD, EXPERT]) {
      const j = job(profile);
      const result = planAction({ job: j, catalog: cat });
      const d = j.observation.decisions.find((x) => x.player === 'B')!;
      expect(result.action.type).toBe('RESOLVE_DECISION');
      const selection = (result.action as { selection: readonly string[] }).selection;
      expect(selection.length).toBeGreaterThanOrEqual(1);
      expect(selection.length).toBeLessThanOrEqual(4);
      expect(selection.every((id) => d.options!.includes(id))).toBe(true);
      // Todos os Básicos disponíveis entram em campo (até o limite do Banco).
      expect(selection.length).toBe(Math.min(4, d.options!.length));
      expect(validateAction(setupState(), cat, result.action).ok).toBe(true);
    }
  });
});

function setupState(): MatchState {
  for (let seed = 1; seed < 200; seed += 1) {
    const { state } = createMatch({ matchId: 'setup', seed, players: { A: starterDeck(cat, 'FIRE'), B: starterDeck(cat, 'GRASS') } }, cat);
    const d = state.pendingDecisions.find((x) => x.player === 'B')!;
    if (d.options.length >= 2) return state;
  }
  throw new Error('sem mão com dois Básicos');
}

describe('IA — erros e fallback', () => {
  it('decisão obrigatória sem resposta legal é erro de conteúdo', () => {
    const state = fixtureState(side({ active: { stack: [P(S.gota)] } }), side({ active: { stack: [P(S.faisca)] } }));
    const job = createAiJob({ state, catalog: cat, aiPlayer: 'B', profile: STANDARD, aiRng: seedRng(1), jobId: 'e', attemptId: 'a', writerEpoch: 1 });
    const broken: AiJob = {
      ...job,
      observation: {
        ...job.observation,
        decisions: [{ decisionId: 'decision-9', player: 'B', kind: 'SELECT_TARGETS', reason: 'DEAL_DAMAGE', options: [], min: 1, max: 1, answered: false }],
        legalActions: [],
      },
    };
    expect(() => planAction({ job: broken, catalog: cat })).toThrow(/AI_NO_LEGAL_ACTION/);
  });

  it('falha interna do planejador cai na ação legal de fallback (END_TURN)', () => {
    const state = fixtureState(
      side({ active: { stack: [P(S.gota)] } }),
      side({ active: { stack: [P(S.faisca)], energies: ['FIRE'] }, hand: [P(S.carvito)], energyZone: fireZone }),
    );
    const job = createAiJob({ state, catalog: cat, aiPlayer: 'B', profile: STANDARD, aiRng: seedRng(1), jobId: 'f', attemptId: 'a', writerEpoch: 1 });
    const failing: CatalogLookup = {
      definition: () => { throw new Error('catálogo indisponível'); },
      printing: () => { throw new Error('catálogo indisponível'); },
      findByDeckLimitKey: () => [],
    };
    const result = planAction({ job, catalog: failing });
    expect(result.fallback).toBe(true);
    expect(result.action).toEqual({ type: 'END_TURN', player: 'B' });
    expect(validateAction(state, cat, result.action).ok).toBe(true);
  });
});
