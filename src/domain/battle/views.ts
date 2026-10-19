// Projeções autorizadas (gameplay §5.2, §25.2; runtime §3.2). A IA e a UI recebem apenas o que o
// participante pode conhecer: nunca a mão adversária, a ordem dos baralhos ou o estado do RNG.
import { isPokemon } from '../cards/types.ts';
import { cardDef, entitiesOf, type Ctx } from './core.ts';
import { collectStatics, isAbilitySuppressed, maxHp, providedUnits, retreatCost } from './derived.ts';
import { getLegalActions } from './actions.ts';
import type { Action, BattleEvent, Decision, MatchResult, MatchState, Phase, PlayerId, PokemonEntity } from './types.ts';
import { other } from './types.ts';
import { effectBadgesByEntity, type EffectBadge } from './effect-badges.ts';

type Readable = Pick<Ctx, 's' | 'cat'>;

export type CardRef = { readonly cardId: string; readonly printingId: string; readonly definitionKey: string };

export type EntityView = {
  readonly entityId: string;
  readonly owner: PlayerId;
  readonly position: 'ACTIVE' | 'BENCH';
  readonly benchIndex: number | null;
  readonly stack: readonly CardRef[];
  readonly top: CardRef;
  readonly damage: number;
  readonly maxHp: number;
  readonly remainingHp: number;
  readonly energies: readonly { readonly id: string; readonly type: string; readonly units: number }[];
  readonly tool: CardRef | null;
  readonly conditions: { readonly poisoned: boolean; readonly burned: boolean; readonly control: string | null };
  readonly retreatCost: number | null;
  readonly abilitiesSuppressed: boolean;
  readonly isFossil: boolean;
  /** Efeitos temporários sobre este Pokémon, para os selos com ícone (interface §25.21). */
  readonly effects: readonly EffectBadge[];
};

export type SideView = {
  readonly player: PlayerId;
  readonly active: EntityView | null;
  readonly bench: readonly (EntityView | null)[];
  readonly handCount: number;
  readonly hand: readonly CardRef[] | null;
  readonly deckCount: number;
  /** Composição restante conhecida do próprio baralho (lista do deck menos o que já apareceu), sem ordem. */
  readonly deckRemaining: readonly string[] | null;
  readonly discard: readonly CardRef[];
  readonly discardedEnergy: Readonly<Record<string, number>>;
  readonly energyZone: { readonly types: readonly string[]; readonly ready: string | null; readonly next: string | null };
  readonly points: number;
  readonly flags: { readonly supporterUsed: boolean; readonly retreatUsed: boolean; readonly manualEnergyUsed: boolean; readonly stadiumPlayed: boolean };
};

export type DecisionView = {
  readonly decisionId: string;
  readonly player: PlayerId;
  readonly kind: Decision['kind'];
  readonly reason: string;
  readonly options: readonly string[] | null;
  readonly min: number;
  readonly max: number;
  readonly answered: boolean;
  /** Texto de cada opção nomeada (escolha de modo); some junto com as opções ocultas. */
  readonly labels?: Readonly<Record<string, string>>;
};

export type BattleView = {
  readonly matchId: string;
  readonly viewer: PlayerId;
  readonly stateVersion: number;
  readonly phase: Phase;
  readonly firstPlayer: PlayerId;
  readonly currentPlayer: PlayerId;
  readonly globalTurnNumber: number;
  readonly ownTurns: Readonly<Record<PlayerId, number>>;
  readonly maximumGlobalTurns: number;
  readonly pointsToWin: number;
  readonly sides: Readonly<Record<PlayerId, SideView>>;
  readonly stadium: (CardRef & { readonly owner: PlayerId }) | null;
  readonly decisions: readonly DecisionView[];
  readonly legalActions: readonly Action[];
  readonly activeEffects: readonly { readonly effectId: string; readonly opcode: string; readonly controller: PlayerId; readonly sourceCardId: string; readonly targets: readonly string[] | null }[];
  readonly result: MatchResult | null;
};

function ref(state: MatchState, cardId: string): CardRef {
  const card = state.cards[cardId]!;
  return { cardId, printingId: card.printingId, definitionKey: card.definitionKey };
}

type Badges = ReadonlyMap<string, readonly EffectBadge[]>;

function entityView(ctx: Readable, entity: PokemonEntity, position: 'ACTIVE' | 'BENCH', benchIndex: number | null, statics: ReturnType<typeof collectStatics>, badges: Badges): EntityView {
  const stack = entity.stack.map((id) => ref(ctx.s, id));
  const max = maxHp(ctx, entity, statics);
  const top = stack[stack.length - 1]!;
  return {
    entityId: entity.entityId, owner: entity.owner, position, benchIndex, stack, top,
    damage: entity.damage, maxHp: max, remainingHp: Math.max(0, max - entity.damage),
    energies: providedUnits(ctx, entity, statics),
    tool: entity.toolCardId ? ref(ctx.s, entity.toolCardId) : null,
    conditions: { poisoned: entity.conditions.poisoned, burned: entity.conditions.burned, control: entity.conditions.control },
    retreatCost: retreatCost(ctx, entity, statics),
    abilitiesSuppressed: isAbilitySuppressed(ctx, entity.entityId),
    isFossil: !isPokemon(cardDef(ctx, top.cardId)),
    effects: badges.get(entity.entityId) ?? [],
  };
}

function sideView(ctx: Readable, player: PlayerId, viewer: PlayerId, statics: ReturnType<typeof collectStatics>, badges: Badges): SideView {
  const p = ctx.s.players[player];
  const located = entitiesOf(ctx.s, player);
  const activeLoc = located.find((l) => l.position === 'ACTIVE');
  const mine = player === viewer;
  const energyCounts: Record<string, number> = {};
  for (const e of p.discardedEnergy) energyCounts[e.type] = (energyCounts[e.type] ?? 0) + 1;
  return {
    player,
    active: activeLoc ? entityView(ctx, activeLoc.entity, 'ACTIVE', null, statics, badges) : null,
    bench: p.bench.map((e, i) => (e ? entityView(ctx, e, 'BENCH', i, statics, badges) : null)),
    handCount: p.hand.length,
    hand: mine ? p.hand.map((id) => ref(ctx.s, id)) : null,
    deckCount: p.deck.length,
    deckRemaining: mine ? p.deck.map((id) => ctx.s.cards[id]!.definitionKey).sort() : null,
    discard: p.discard.map((id) => ref(ctx.s, id)),
    discardedEnergy: energyCounts,
    energyZone: { types: [...p.energyZone.types], ready: p.energyZone.ready, next: p.energyZone.next },
    points: p.points,
    flags: { supporterUsed: p.flags.supporterUsed, retreatUsed: p.flags.retreatUsed, manualEnergyUsed: p.flags.manualEnergyUsed, stadiumPlayed: p.flags.stadiumPlayed },
  };
}

export function getPlayerView(ctx: Readable, viewer: PlayerId, includeLegalActions = true): BattleView {
  const s = ctx.s;
  const statics = collectStatics(ctx);
  const badges = effectBadgesByEntity(ctx);
  const hiddenKinds = new Set(['SETUP', 'SELECT_CARDS', 'ORDER_TOP']);
  return {
    matchId: s.matchId, viewer, stateVersion: s.stateVersion, phase: s.phase, firstPlayer: s.firstPlayer,
    currentPlayer: s.currentPlayer, globalTurnNumber: s.globalTurnNumber, ownTurns: { ...s.ownTurns },
    maximumGlobalTurns: s.config.maximumGlobalTurns, pointsToWin: s.config.pointsToWin,
    sides: { A: sideView(ctx, 'A', viewer, statics, badges), B: sideView(ctx, 'B', viewer, statics, badges) },
    stadium: s.stadium ? { ...ref(s, s.stadium.cardId), owner: s.stadium.owner } : null,
    decisions: s.pendingDecisions.map((d) => ({
      decisionId: d.decisionId, player: d.player, kind: d.kind, reason: d.reason,
      options: d.player === viewer || !hiddenKinds.has(d.kind) ? [...d.options] : null,
      min: d.min, max: d.max, answered: d.answered !== null,
      ...(d.labels && (d.player === viewer || !hiddenKinds.has(d.kind)) ? { labels: d.labels } : {}),
    })),
    legalActions: includeLegalActions ? getLegalActions(ctx, viewer) : [],
    activeEffects: s.activeEffects.map((e) => ({ effectId: e.effectId, opcode: e.operation.type, controller: e.controller, sourceCardId: e.sourceCardId, targets: e.targets })),
    result: s.result,
  };
}

/** Remove campos secretos dos eventos para quem não é o dono (G-084). */
export function redactEvents(events: readonly BattleEvent[], viewer: PlayerId): BattleEvent[] {
  return events.map((event) => {
    if (event.visibility !== 'OWNER' || event.owner === viewer) return event;
    const data: Record<string, unknown> = { ...event.data };
    for (const field of event.secretFields) data[field] = null;
    return { ...event, data };
  });
}

/** Observação da IA: a mesma projeção autorizada do seu lado, sem o estado completo nem sementes (G-053, R-034). */
export function getAiObservation(ctx: Readable, aiPlayer: PlayerId): BattleView {
  return getPlayerView(ctx, aiPlayer, true);
}

export function opponentOf(player: PlayerId): PlayerId {
  return other(player);
}
