import { describe, expect, it } from 'vitest';
import { buildBundle } from './bundle.ts';
import { buildCatalog } from '../domain/cards/catalog.ts';
import { applyAction, getLegalActions } from '../domain/battle/engine.ts';
import { createMatchFromFixture } from '../domain/battle/setup.ts';
import { runScript, type ContentFixture, type ScriptStep } from './source/script.ts';
import { evaluateObjective } from './source/evaluate.ts';
import { P } from './source/sets.ts';
import { a1 } from './source/a1/cards.ts';

const bundle = buildBundle();
const cat = buildCatalog(bundle.cards, bundle.printings);
const resolve = (pid: string) => cat.definitionKeyOfPrinting(pid);
const fixtures = bundle.fixtures as readonly ContentFixture[];
const fixture = (id: string) => fixtures.find((f) => f.fixtureId === id)!;
const nodeOf = (fixtureId: string) => bundle.nodes.find((n) => n.fixtureId === fixtureId)!;
const objectiveOf = (fixtureId: string) => bundle.objectives.find((o) => o.objectiveId === nodeOf(fixtureId).completionObjectiveId)!;
const SEEDS = [1, 2, 3, 99, 2026];

describe('tutoriais e puzzles são resolvíveis pelo motor real', () => {
  for (const fx of fixtures.filter((f) => f.solution)) {
    it(`${fx.fixtureId}: solução vence e cumpre o objetivo composto em ${SEEDS.length} sementes`, () => {
      const node = nodeOf(fx.fixtureId);
      for (const seed of SEEDS) {
        const run = runScript(fx, cat, resolve, seed);
        expect(run.error, `semente ${seed}`).toBeNull();
        expect(run.state.result?.outcome).toBe('WIN');
        expect(run.state.result?.winner).toBe('A');
        expect(evaluateObjective(objectiveOf(fx.fixtureId), { state: run.state, firstHumanOwnTurn: run.firstHumanOwnTurn })).toBe(true);
        if (node.turnLimit) {
          const used = run.state.stats.A.ownTurnsAtWin! - run.firstHumanOwnTurn + 1;
          expect(used).toBeLessThanOrEqual(node.turnLimit.ownTurns);
        }
      }
    });
  }

  it('puzzles não lançam moedas (nenhum COIN_RESOLVED na solução)', () => {
    for (const fx of fixtures.filter((f) => f.kind === 'PUZZLE')) {
      const run = runScript(fx, cat, resolve, 5);
      let state = run.initial;
      const types: string[] = [];
      for (const action of run.actions) {
        const r = applyAction(state, cat, action);
        if (!r.ok) throw new Error(r.code);
        types.push(...r.events.map((e) => e.type));
        state = r.state;
      }
      expect(types.includes('COIN_RESOLVED'), fx.fixtureId).toBe(false);
      expect(fx.scriptedRandom).toBeUndefined();
    }
  });

  it('T06 é um duelo guiado completo com abertura legal', () => {
    const fx = fixture('fx-p00-t06');
    expect(fx.startPhase).toBe('SETUP');
    const { state } = createMatchFromFixture(fx, 't06', 1, cat, resolve);
    expect(state.pendingDecisions.map((d) => d.kind)).toEqual(['SETUP', 'SETUP']);
    expect([...state.players.A.deck, ...state.players.A.hand]).toHaveLength(20);
    expect([...state.players.B.deck, ...state.players.B.hand]).toHaveLength(20);
  });
});

describe('puzzles exigem a ideia central (linhas ingênuas falham)', () => {
  const naive = (fx: ContentFixture, solution: ScriptStep[]) => runScript({ ...fx, solution }, cat, resolve, 1);
  const H = (command: ScriptStep['command']): ScriptStep => ({ actor: 'HUMAN', command });

  it('C01-E02: sem reserva no Banco o humano perde o único Pokémon', () => {
    const run = naive(fixture('fx-c01-e02'), [H({ type: 'ATTACH_ENERGY', target: 'ACTIVE' }), H({ type: 'ATTACK', attackId: 'vine-whip' })]);
    expect(run.state.result?.winner).toBe('B');
  });

  it('C02-E02: atacar o Onix não fecha a conta; só a troca por efeito traz o alvo certo', () => {
    const run = naive(fixture('fx-c02-e02'), [H({ type: 'ATTACK', attackId: 'wave-splash' })]);
    expect(run.state.result).toBeNull();
    expect(run.state.players.A.points).toBe(2);
  });

  it('C03-E02: pagar o Recuo com a Energia do turno deixa Electrode sem ataque', () => {
    const run = naive(fixture('fx-c03-e02'), [
      H({ type: 'ATTACH_ENERGY', target: 'ACTIVE' }),
      H({ type: 'RETREAT', benchIndex: 0, energyTypes: ['LIGHTNING', 'LIGHTNING'] }),
      H({ type: 'ATTACK', attackId: 'electro-ball' }),
    ]);
    expect(run.error).toMatch(/INSUFFICIENT_ENERGY/);
  });

  it('C04-E02: Adormecido não ataca nem recua', () => {
    const { state } = createMatchFromFixture(fixture('fx-c04-e02'), 'c04', 1, cat, resolve);
    const legal = getLegalActions(state, cat, 'A');
    expect(legal.some((a) => a.type === 'ATTACK')).toBe(false);
    expect(legal.some((a) => a.type === 'RETREAT')).toBe(false);
  });

  it('C05-E02: atacar com Giovanni não vence a blindagem de Melmetal', () => {
    const run = naive(fixture('fx-c05-e02'), [
      H({ type: 'PLAY_TRAINER', card: { zone: 'HAND', printingId: P(a1('Giovanni')) } }),
      H({ type: 'ATTACK', attackId: 'low-kick' }),
    ]);
    expect(run.state.result).toBeNull();
    expect(run.state.players.B.active?.damage).toBe(120);
  });

  it('C06-E02: puxar o Pokémon mais ferido soma só 1 ponto', () => {
    const run = naive(fixture('fx-c06-e02'), [
      H({ type: 'USE_ABILITY', source: 'ACTIVE', abilityId: 'fragrance-trap' }),
      H({ type: 'RESOLVE_DECISION', select: ['OPP_BENCH:1'] }),
      H({ type: 'ATTACK', attackId: 'vine-whip' }),
    ]);
    expect(run.state.result).toBeNull();
    expect(run.state.players.A.points).toBe(2);
  });

  it('cenários usam as cartas do tema (Gloom no topo; Articuno ex no Banco)', () => {
    expect(fixture('fx-c01-e02').players.HUMAN.deck[0]).toBe(P(a1('Gloom')));
    expect(fixture('fx-c06-e02').players.NPC.bench[0]!.stack[0]).toBe(P(a1('Articuno ex')));
  });
});
