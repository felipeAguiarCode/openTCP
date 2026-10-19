// Apoio compartilhado pelos testes da IA (não usado pelo app): catálogo inicial + cartas de teste,
// fixtures e um condutor de turno que valida cada ação da IA contra o estado real.
import type { AiProfile } from '../../content/types.ts';
import { attack, pokemon } from '../../content/builders.ts';
import { printingOf, S, starterCatalog, starterDeck } from '../../tests/support/starter-catalog.ts';
import { applyAction, getLegalActions, validateAction } from '../battle/engine.ts';
import { createMatch, createMatchFromFixture, type BattleFixture, type FixtureSide } from '../battle/setup.ts';
import type { Action, MatchState, PlayerId } from '../battle/types.ts';
import type { CardDefinition } from '../cards/types.ts';
import { seedRng, uniformInt, type RngState } from '../random/rng.ts';
import { createAiJob } from './observation.ts';
import { planAction } from './planner.ts';

export const megaTarget = pokemon({ baseName: 'Alvomega', ruleBox: 'MEGA_EX', stage: 'BASIC', type: 'PSYCHIC', hp: 40, retreat: 2, weakness: null,
  attacks: [attack({ id: 'pulso', name: 'Pulso', cost: { PSYCHIC: 2 }, damage: 60 })] });
export const exBrute = pokemon({ baseName: 'Brutex', ruleBox: 'EX', stage: 'BASIC', type: 'FIGHTING', hp: 150, retreat: 2, weakness: null,
  attacks: [attack({ id: 'esmagar', name: 'Esmagar', cost: { FIGHTING: 2 }, damage: 90 })] });

export const EXTRA: CardDefinition[] = [megaTarget, exBrute];
export const cat = starterCatalog(EXTRA);
export const P = (def: CardDefinition): string => printingOf(cat, def);
export { S };

export type DeckKind = 'FIRE' | 'WATER' | 'GRASS';
export const DECKS: readonly DeckKind[] = ['FIRE', 'WATER', 'GRASS'];

export function newMatch(seed: number, a: DeckKind, b: DeckKind): MatchState {
  return createMatch({ matchId: `ai-${seed}`, seed, players: { A: starterDeck(cat, a), B: starterDeck(cat, b) } }, cat).state;
}

export function side(over: Partial<FixtureSide> & { active: FixtureSide['active'] }): FixtureSide {
  return {
    deck: Array.from({ length: 8 }, () => P(S.estudioso)), hand: [], discard: [], bench: [],
    energyZone: { types: ['FIRE'], ready: null, next: 'FIRE' }, points: 0, ...over,
  };
}

/** HUMAN = A, NPC = B; por padrão é o turno do NPC (B). */
export function fixtureState(human: FixtureSide, npc: FixtureSide, opts: Partial<Pick<BattleFixture, 'currentPlayer' | 'globalTurnNumber' | 'ownTurns'>> = {}): MatchState {
  const fx: BattleFixture = {
    fixtureId: 'ai-test', kind: 'TEST', label: 'ia', startPhase: 'MAIN', firstPlayer: 'HUMAN', currentPlayer: opts.currentPlayer ?? 'NPC',
    globalTurnNumber: opts.globalTurnNumber ?? 6, ownTurns: opts.ownTurns ?? { HUMAN: 3, NPC: 3 }, stadiumPrintingId: null,
    players: { HUMAN: human, NPC: npc },
  };
  return createMatchFromFixture(fx, 'ai-fixture', 7, cat, (pid) => cat.definitionKeyOfPrinting(pid)).state;
}

/** Avança uma partida com ações legais aleatórias (mas sem conceder) até a fase/jogador desejados. */
export function randomAdvance(state: MatchState, seed: number, steps: number): MatchState {
  let s = state;
  let rng: RngState = seedRng(seed);
  for (let i = 0; i < steps && !s.result; i += 1) {
    const actor = s.pendingDecisions.find((d) => !d.answered)?.player ?? s.currentPlayer;
    const legal = getLegalActions(s, cat, actor).filter((a) => a.type !== 'CONCEDE');
    const nonEnd = legal.filter((a) => a.type !== 'END_TURN' && a.type !== 'ATTACK');
    const pool = nonEnd.length && i % 4 !== 0 ? nonEnd : legal;
    const r = uniformInt(rng, pool.length);
    rng = r.rng;
    const applied = applyAction(s, cat, pool[r.value]!);
    if (!applied.ok) throw new Error(applied.code);
    s = applied.state;
  }
  return s;
}

/** Primeiro estado (a partir de `state`) em que `player` está na fase principal do próprio turno. */
export function untilMainOf(state: MatchState, player: PlayerId, seed: number): MatchState {
  let s = state;
  for (let i = 0; i < 400 && !s.result; i += 1) {
    if (s.phase === 'MAIN' && s.currentPlayer === player && s.pendingDecisions.length === 0) return s;
    s = randomAdvance(s, seed + i, 1);
  }
  throw new Error('não chegou ao turno desejado');
}

export type TurnRun = { readonly state: MatchState; readonly actions: readonly Action[]; readonly fallbacks: number };

/** A IA joga até o turno passar (ou a partida acabar); cada ação é validada contra o estado real. */
export function runAiTurn(state: MatchState, player: PlayerId, profile: AiProfile, seed: number): TurnRun {
  let s = state;
  let aiRng = seedRng(seed);
  const actions: Action[] = [];
  let fallbacks = 0;
  for (let i = 0; i < 60 && !s.result; i += 1) {
    const mine = s.pendingDecisions.some((d) => !d.answered && d.player === player) || (s.pendingDecisions.length === 0 && s.phase === 'MAIN' && s.currentPlayer === player);
    if (!mine) break;
    const job = createAiJob({ state: s, catalog: cat, aiPlayer: player, profile, aiRng, jobId: `t-${i}`, attemptId: 'test', writerEpoch: 1 });
    const result = planAction({ job, catalog: cat });
    aiRng = result.aiRng;
    if (result.fallback) fallbacks += 1;
    const verdict = validateAction(s, cat, result.action);
    if (!verdict.ok) throw new Error(`IA propôs ação ilegal ${verdict.code}: ${JSON.stringify(result.action)}`);
    actions.push(result.action);
    const applied = applyAction(s, cat, result.action);
    if (!applied.ok) throw new Error(applied.code);
    s = applied.state;
  }
  return { state: s, actions, fallbacks };
}
