// Criação de partida (gameplay §7, B1/B2) e carga de fixtures de tutorial/puzzle/laboratório.
import { seedRng, shuffle, type CoinFace } from '../random/rng.ts';
import type { EnergyType } from '../cards/types.ts';
import { isPokemon } from '../cards/types.ts';
import { cardDef, coin, emit, newGroup, nextId, randomIndex, type Ctx } from './core.ts';
import type { BattleCard, CatalogLookup, MatchState, ObjectiveStats, PlayerId, PlayerState, PokemonEntity, RulesetConfig } from './types.ts';
import { DEFAULT_RULESET, other, PLAYERS } from './types.ts';
import { runQueue } from './flow.ts';
import type { BattleEvent } from './types.ts';

export const ENGINE_VERSION = 'engine-1.0.0';

export type DeckCard = { readonly printingId: string; readonly definitionKey: string };

export type MatchInput = {
  readonly matchId: string;
  readonly seed: number;
  readonly config?: RulesetConfig;
  readonly players: Record<PlayerId, { readonly deck: readonly DeckCard[]; readonly energyTypes: readonly EnergyType[] }>;
  readonly firstPlayer?: PlayerId;
  readonly roleTags?: Record<string, readonly string[]>;
  readonly scriptedCoins?: readonly CoinFace[];
};

export function emptyStats(): ObjectiveStats {
  return {
    benchPlacements: 0, evolutions: 0, manualEnergy: 0, playedSubtypes: [], retreats: 0, switchEffects: 0,
    attackers: [], damageSources: [], maxEnergyOnOnePokemon: 0, activatedAbilities: 0, conditionRemovedByCause: [],
    evolvedWithCondition: 0, delayedPrevented: 0, toolsAttached: 0, stadiumReplacedDifferentName: 0,
    modifierSourcesRemoved: 0, knockoutsWithoutAttack: 0, knockedOutRoles: [], knockedOutRuleBoxes: [], ownTurnsAtWin: null,
  };
}

function emptyPlayer(id: PlayerId, energyTypes: readonly EnergyType[]): PlayerState {
  return {
    id, deck: [], hand: [], discard: [], discardedEnergy: [], active: null, bench: [null, null, null],
    energyZone: { types: [...energyTypes], ready: null, next: null }, points: 0,
    flags: { supporterUsed: false, retreatUsed: false, manualEnergyUsed: false, stadiumPlayed: false, usage: {} },
    matchUsage: {}, revealedHand: false,
  };
}

function baseState(input: Pick<MatchInput, 'matchId' | 'seed' | 'config' | 'roleTags' | 'scriptedCoins'>, cards: Record<string, BattleCard>, energy: Record<PlayerId, readonly EnergyType[]>): MatchState {
  return {
    formatVersion: 1,
    matchId: input.matchId,
    engineVersion: ENGINE_VERSION,
    config: input.config ?? DEFAULT_RULESET,
    cards,
    players: { A: emptyPlayer('A', energy.A), B: emptyPlayer('B', energy.B) },
    stadium: null,
    phase: 'SETUP',
    firstPlayer: 'A',
    currentPlayer: 'A',
    globalTurnNumber: 0,
    ownTurns: { A: 0, B: 0 },
    pendingDecisions: [],
    queue: [],
    frames: {},
    activeEffects: [],
    delayedEffects: [],
    rng: seedRng(input.seed),
    koMarked: [],
    scriptedCoins: [...(input.scriptedCoins ?? [])],
    counters: { entity: 0, energy: 0, decision: 0, frame: 0, effect: 0 },
    eventSeq: 0,
    stateVersion: 0,
    stats: { A: emptyStats(), B: emptyStats() },
    roleTags: { ...(input.roleTags ?? {}) },
    result: null,
  };
}

function registerCards(players: MatchInput['players']): { cards: Record<string, BattleCard>; decks: Record<PlayerId, string[]> } {
  const cards: Record<string, BattleCard> = {};
  const decks: Record<PlayerId, string[]> = { A: [], B: [] };
  for (const player of PLAYERS) {
    players[player].deck.forEach((card, i) => {
      const id = `c-${player}-${String(i + 1).padStart(2, '0')}`;
      cards[id] = { id, owner: player, printingId: card.printingId, definitionKey: card.definitionKey };
      decks[player].push(id);
    });
  }
  return { cards, decks };
}

export function isEligibleOpeningBasic(cat: CatalogLookup, state: MatchState, cardId: string): boolean {
  const def = cat.definition(state.cards[cardId]!.definitionKey);
  return isPokemon(def) && def.stage === 'BASIC';
}

/** Mão inicial por rejeição: embaralha o baralho inteiro até as 5 primeiras conterem Básico elegível (gameplay §7.2). */
function dealOpeningHand(ctx: Ctx, player: PlayerId): void {
  const p = ctx.s.players[player];
  const hasBasic = p.deck.some((id) => isEligibleOpeningBasic(ctx.cat, ctx.s, id));
  if (!hasBasic) throw new Error('DECK_REQUIRES_BASIC');
  for (let attempt = 0; attempt < 10000; attempt += 1) {
    const result = shuffle(ctx.s.rng, p.deck);
    ctx.s.rng = result.rng;
    const hand = result.value.slice(0, ctx.s.config.openingHandSize);
    if (hand.some((id) => isEligibleOpeningBasic(ctx.cat, ctx.s, id))) {
      p.hand = hand;
      p.deck = result.value.slice(ctx.s.config.openingHandSize);
      emit(ctx, 'CARDS_DEALT', { player, cardIds: hand, handCount: hand.length, deckCount: p.deck.length, redraws: attempt },
        { visibility: 'OWNER', owner: player, secretFields: ['cardIds'], triggerable: false });
      return;
    }
  }
  throw new Error('opening hand rejection limit');
}

export function createMatch(input: MatchInput, cat: CatalogLookup): { state: MatchState; events: BattleEvent[] } {
  const { cards, decks } = registerCards(input.players);
  const state = baseState(input, cards, { A: input.players.A.energyTypes, B: input.players.B.energyTypes });
  const ctx: Ctx = { s: state, cat, events: [], group: 0, triggerable: [] };
  state.players.A.deck = decks.A;
  state.players.B.deck = decks.B;
  newGroup(ctx);
  // B1: moeda justa decide o primeiro jogador (cara = A), salvo fixture/override.
  if (input.firstPlayer) {
    state.firstPlayer = input.firstPlayer;
    emit(ctx, 'FIRST_PLAYER_DECIDED', { firstPlayer: input.firstPlayer, method: 'FIXTURE' }, { triggerable: false });
  } else {
    const face = coin(ctx);
    state.firstPlayer = face === 'HEADS' ? 'A' : 'B';
    emit(ctx, 'COIN_RESOLVED', { player: null, reason: 'FIRST_PLAYER', results: [face] }, { triggerable: false });
    emit(ctx, 'FIRST_PLAYER_DECIDED', { firstPlayer: state.firstPlayer, method: 'COIN' }, { triggerable: false });
  }
  state.currentPlayer = state.firstPlayer;
  const order: PlayerId[] = [state.firstPlayer, other(state.firstPlayer)];
  // B2: prévias da Zona de Energia (primeiro, depois segundo jogador).
  for (const player of order) {
    const zone = state.players[player].energyZone;
    if (zone.types.length) zone.next = zone.types[randomIndex(ctx, zone.types.length)]!;
  }
  for (const player of order) dealOpeningHand(ctx, player);
  state.queue.push({ kind: 'SETUP', choices: {} });
  runQueue(ctx);
  state.stateVersion = 1;
  return { state: ctx.s, events: ctx.events };
}

// ---------------------------------------------------------------- fixtures

export type FixturePokemon = {
  readonly stack: readonly string[];
  readonly damage?: number;
  readonly energies?: readonly EnergyType[];
  readonly toolPrintingId?: string | null;
  readonly conditions?: readonly ('POISONED' | 'BURNED' | 'ASLEEP' | 'PARALYZED' | 'CONFUSED')[];
  readonly enteredPlayOnTurn?: number;
};

export type FixtureSide = {
  readonly deck: readonly string[];
  readonly hand: readonly string[];
  readonly discard: readonly string[];
  readonly active: FixturePokemon | null;
  readonly bench: readonly FixturePokemon[];
  readonly energyZone: { readonly types: readonly EnergyType[]; readonly ready: EnergyType | null; readonly next: EnergyType };
  readonly points: number;
  readonly usage?: { readonly supporterUsed?: boolean; readonly retreatUsed?: boolean; readonly manualEnergyUsed?: boolean };
};

export type BattleFixture = {
  readonly fixtureId: string;
  readonly kind: 'TUTORIAL' | 'PUZZLE' | 'LAB' | 'TEST';
  readonly label: string;
  readonly startPhase: 'SETUP' | 'MAIN';
  readonly firstPlayer: 'HUMAN' | 'NPC';
  readonly currentPlayer: 'HUMAN' | 'NPC';
  readonly globalTurnNumber: number;
  readonly ownTurns: { readonly HUMAN: number; readonly NPC: number };
  readonly stadiumPrintingId: string | null;
  readonly players: { readonly HUMAN: FixtureSide; readonly NPC: FixtureSide };
  readonly scriptedRandom?: { readonly coins: readonly CoinFace[]; readonly label: string };
};

/** HUMAN = A, NPC = B. Impressões resolvidas pelo `resolvePrinting` para a chave de definição fixada. */
export function createMatchFromFixture(
  fixture: BattleFixture, matchId: string, seed: number, cat: CatalogLookup, resolvePrinting: (printingId: string) => string,
  roleTags?: Record<string, readonly string[]>,
): { state: MatchState; events: BattleEvent[] } {
  const sideOf = (who: 'HUMAN' | 'NPC'): PlayerId => (who === 'HUMAN' ? 'A' : 'B');
  const cards: Record<string, BattleCard> = {};
  let counter = 0;
  const make = (player: PlayerId, printingId: string): string => {
    counter += 1;
    const id = `c-${player}-${String(counter).padStart(2, '0')}`;
    cards[id] = { id, owner: player, printingId, definitionKey: resolvePrinting(printingId) };
    return id;
  };
  const sides = {
    A: fixture.players.HUMAN,
    B: fixture.players.NPC,
  } as const;
  const state = baseState({ matchId, seed, roleTags, scriptedCoins: fixture.scriptedRandom?.coins }, cards, { A: sides.A.energyZone.types, B: sides.B.energyZone.types });
  const ctx: Ctx = { s: state, cat, events: [], group: 0, triggerable: [] };
  state.firstPlayer = sideOf(fixture.firstPlayer);
  state.currentPlayer = sideOf(fixture.currentPlayer);
  state.globalTurnNumber = fixture.globalTurnNumber;
  state.ownTurns = { A: fixture.ownTurns.HUMAN, B: fixture.ownTurns.NPC };
  for (const player of PLAYERS) {
    const side = sides[player];
    const p = state.players[player];
    p.deck = side.deck.map((pid) => make(player, pid));
    p.hand = side.hand.map((pid) => make(player, pid));
    p.discard = side.discard.map((pid) => make(player, pid));
    p.points = side.points;
    p.energyZone = { types: [...side.energyZone.types], ready: side.energyZone.ready, next: side.energyZone.next };
    p.flags = { supporterUsed: side.usage?.supporterUsed ?? false, retreatUsed: side.usage?.retreatUsed ?? false, manualEnergyUsed: side.usage?.manualEnergyUsed ?? false, stadiumPlayed: false, usage: {} };
    const build = (fp: FixturePokemon): PokemonEntity => {
      const stack = fp.stack.map((pid) => make(player, pid));
      const conditions = fp.conditions ?? [];
      const control = conditions.find((c) => c === 'ASLEEP' || c === 'PARALYZED' || c === 'CONFUSED') ?? null;
      return {
        entityId: nextId(ctx, 'entity', `pk-${player}`), owner: player, stack, damage: fp.damage ?? 0,
        energies: (fp.energies ?? []).map((type) => ({ id: nextId(ctx, 'energy', 'en'), type })),
        toolCardId: fp.toolPrintingId ? make(player, fp.toolPrintingId) : null,
        conditions: { poisoned: conditions.includes('POISONED'), burned: conditions.includes('BURNED'), control: control as PokemonEntity['conditions']['control'], paralyzedSinceTurn: control === 'PARALYZED' ? fixture.globalTurnNumber - 1 : null },
        enteredPlayOnTurn: fp.enteredPlayOnTurn ?? 0, lastEvolvedOnTurn: -1, usage: {},
      };
    };
    p.active = side.active ? build(side.active) : null;
    p.bench = [0, 1, 2].map((i) => (side.bench[i] ? build(side.bench[i]!) : null));
  }
  if (fixture.stadiumPrintingId) {
    const owner = state.currentPlayer;
    state.stadium = { cardId: make(owner, fixture.stadiumPrintingId), owner };
  }
  newGroup(ctx);
  emit(ctx, 'FIXTURE_LOADED', { fixtureId: fixture.fixtureId, kind: fixture.kind, label: fixture.label }, { triggerable: false });
  if (fixture.startPhase === 'MAIN') {
    state.phase = 'MAIN';
    emit(ctx, 'TURN_STARTED', { player: state.currentPlayer, globalTurnNumber: state.globalTurnNumber, ownTurn: state.ownTurns[state.currentPlayer] }, { triggerable: false });
  } else {
    state.queue.push({ kind: 'SETUP', choices: {} });
    runQueue(ctx);
  }
  state.stateVersion = 1;
  void cardDef;
  return { state: ctx.s, events: ctx.events };
}
