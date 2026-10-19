import { describe, expect, it } from 'vitest';
import { seedRng, uniformInt, type RngState } from '../random/rng.ts';
import { applyAction, getLegalActions, stateHash } from './engine.ts';
import { createMatch } from './setup.ts';
import type { Action, MatchState, PlayerId } from './types.ts';
import { starterCatalog, starterDeck } from '../../tests/support/starter-catalog.ts';
import { isEligibleOpeningBasic } from './setup.ts';

const cat = starterCatalog();

/** Toda carta da partida está em exatamente um lugar (GP §29.7). */
function assertConservation(state: MatchState): void {
  const seen = new Map<string, number>();
  const mark = (id: string) => seen.set(id, (seen.get(id) ?? 0) + 1);
  for (const player of ['A', 'B'] as const) {
    const p = state.players[player];
    [...p.deck, ...p.hand, ...p.discard].forEach(mark);
    for (const e of [p.active, ...p.bench]) {
      if (!e) continue;
      e.stack.forEach(mark);
      if (e.toolCardId) mark(e.toolCardId);
    }
  }
  if (state.stadium) mark(state.stadium.cardId);
  for (const frame of Object.values(state.frames)) {
    if (frame.sourceKind === 'TRAINER' && !seen.has(frame.sourceCardId)) mark(frame.sourceCardId);
  }
  const ids = Object.keys(state.cards);
  for (const id of ids) expect(seen.get(id), `carta ${id}`).toBe(1);
  expect(seen.size).toBe(ids.length);
  const energies = new Set<string>();
  for (const player of ['A', 'B'] as const) {
    const p = state.players[player];
    for (const e of [p.active, ...p.bench]) for (const en of e?.energies ?? []) { expect(energies.has(en.id)).toBe(false); energies.add(en.id); }
    for (const en of p.discardedEnergy) { expect(energies.has(en.id)).toBe(false); energies.add(en.id); }
  }
  for (const player of ['A', 'B'] as const) {
    expect(state.players[player].hand.length).toBeLessThanOrEqual(10);
    expect(state.players[player].bench.length).toBe(3);
  }
}

function pick<T>(rng: RngState, list: readonly T[]): { value: T; rng: RngState } {
  const r = uniformInt(rng, list.length);
  return { value: list[r.value]!, rng: r.rng };
}

function playRandomMatch(seed: number, decks: ['FIRE' | 'WATER' | 'GRASS', 'FIRE' | 'WATER' | 'GRASS']) {
  const created = createMatch({
    matchId: `fuzz-${seed}`, seed,
    players: { A: starterDeck(cat, decks[0]), B: starterDeck(cat, decks[1]) },
  }, cat);
  let state = created.state;
  let driver = seedRng(seed ^ 0x5bd1e995);
  let steps = 0;
  const log: Action[] = [];
  while (!state.result && steps < 5000) {
    steps += 1;
    const actors: PlayerId[] = state.pendingDecisions.length ? [...new Set(state.pendingDecisions.filter((d) => !d.answered).map((d) => d.player))] : [state.currentPlayer];
    const actor = actors[0]!;
    const legal = getLegalActions(state, cat, actor);
    expect(legal.length, `sem ações legais em ${state.phase}`).toBeGreaterThan(0);
    // Prefere atacar/encerrar às vezes para partidas terminarem.
    const chosen = pick(driver, legal);
    driver = chosen.rng;
    const result = applyAction(state, cat, chosen.value);
    if (!result.ok) throw new Error(`ação legal rejeitada ${result.code} ${JSON.stringify(chosen.value)} ${result.message ?? ''}`);
    log.push(chosen.value);
    state = result.state;
    assertConservation(state);
  }
  return { state, log, initial: created.state };
}

describe('motor — partidas completas por ações legais aleatórias', () => {
  it('termina, conserva cartas e respeita limites (fuzz)', () => {
    const combos: ['FIRE' | 'WATER' | 'GRASS', 'FIRE' | 'WATER' | 'GRASS'][] = [['FIRE', 'GRASS'], ['WATER', 'FIRE'], ['GRASS', 'WATER'], ['FIRE', 'FIRE']];
    for (let seed = 1; seed <= 24; seed += 1) {
      const { state } = playRandomMatch(seed, combos[seed % combos.length]!);
      expect(state.result).not.toBeNull();
      expect(state.globalTurnNumber).toBeLessThanOrEqual(60);
    }
  });

  it('replay com os mesmos comandos produz o mesmo hash (G-050)', () => {
    const { state, log, initial } = playRandomMatch(77, ['FIRE', 'WATER']);
    let replay = initial;
    for (const action of log) {
      const r = applyAction(replay, cat, action);
      expect(r.ok).toBe(true);
      replay = r.state;
    }
    expect(stateHash(replay)).toBe(stateHash(state));
  });

  it('mão inicial sempre contém Básico elegível (G-005)', () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const { state } = createMatch({ matchId: `h-${seed}`, seed, players: { A: starterDeck(cat, 'GRASS'), B: starterDeck(cat, 'WATER') } }, cat);
      for (const player of ['A', 'B'] as const) {
        const hand = [...state.players[player].hand];
        expect(hand.length).toBe(5);
        expect(hand.some((id) => isEligibleOpeningBasic(cat, state, id))).toBe(true);
      }
    }
  });

  it('estado de entrada nunca é alterado por applyAction', () => {
    const { state } = createMatch({ matchId: 'pure', seed: 3, players: { A: starterDeck(cat, 'FIRE'), B: starterDeck(cat, 'WATER') } }, cat);
    const before = stateHash(state);
    const actor = state.pendingDecisions[0]!.player;
    applyAction(state, cat, getLegalActions(state, cat, actor)[0]!);
    expect(stateHash(state)).toBe(before);
  });
});
