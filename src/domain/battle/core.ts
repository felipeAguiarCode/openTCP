// Primitivas internas do motor. Operam sobre um rascunho clonado (`ctx.s`) dentro de applyAction,
// de modo que a API pública continua pura: estado de entrada nunca é modificado.
import { flipCoin, shuffle, uniformInt, type CoinFace } from '../random/rng.ts';
import { isFossil, isPokemon, type CardDefinition, type PokemonCard } from '../cards/types.ts';
import type {
  BattleEvent, CatalogLookup, EventVisibility, MatchState, PlayerId, PlayerState, PokemonEntity,
} from './types.ts';
import { other } from './types.ts';

export type Ctx = {
  s: MatchState;
  readonly cat: CatalogLookup;
  readonly events: BattleEvent[];
  group: number;
  /** Eventos que podem disparar gatilhos, coletados durante o passo atômico corrente. */
  readonly triggerable: BattleEvent[];
};

export function createCtx(state: MatchState, cat: CatalogLookup): Ctx {
  return { s: structuredClone(state), cat, events: [], group: 0, triggerable: [] };
}

export function emit(
  ctx: Ctx,
  type: string,
  data: Record<string, unknown>,
  options: { visibility?: EventVisibility; owner?: PlayerId | null; secretFields?: string[]; triggerable?: boolean } = {},
): BattleEvent {
  ctx.s.eventSeq += 1;
  const event: BattleEvent = {
    seq: ctx.s.eventSeq,
    type,
    group: ctx.group,
    visibility: options.visibility ?? 'PUBLIC',
    owner: options.owner ?? null,
    secretFields: options.secretFields ?? [],
    data,
  };
  ctx.events.push(event);
  if (options.triggerable !== false) ctx.triggerable.push(event);
  return event;
}

export function newGroup(ctx: Ctx): number {
  ctx.group = ctx.s.eventSeq + 1;
  return ctx.group;
}

export function nextId(ctx: Ctx, kind: keyof MatchState['counters'], prefix: string): string {
  ctx.s.counters[kind] += 1;
  return `${prefix}-${ctx.s.counters[kind]}`;
}

export function cardDef(ctx: Pick<Ctx, 's' | 'cat'>, cardId: string): CardDefinition {
  const card = ctx.s.cards[cardId];
  if (!card) throw new Error(`carta desconhecida ${cardId}`);
  return ctx.cat.definition(card.definitionKey);
}

export function topCardId(entity: PokemonEntity): string {
  const id = entity.stack[entity.stack.length - 1];
  if (!id) throw new Error(`entidade sem cartas ${entity.entityId}`);
  return id;
}

export function entityDef(ctx: Pick<Ctx, 's' | 'cat'>, entity: PokemonEntity): CardDefinition {
  return cardDef(ctx, topCardId(entity));
}

export function entityPokemon(ctx: Pick<Ctx, 's' | 'cat'>, entity: PokemonEntity): PokemonCard | null {
  const def = entityDef(ctx, entity);
  return isPokemon(def) ? def : null;
}

export function isFossilEntity(ctx: Pick<Ctx, 's' | 'cat'>, entity: PokemonEntity): boolean {
  return isFossil(entityDef(ctx, entity));
}

export type Located = { entity: PokemonEntity; player: PlayerId; position: 'ACTIVE' | 'BENCH'; benchIndex: number | null };

export function entitiesOf(state: MatchState, player: PlayerId): Located[] {
  const p = state.players[player];
  const out: Located[] = [];
  if (p.active) out.push({ entity: p.active, player, position: 'ACTIVE', benchIndex: null });
  p.bench.forEach((e, i) => { if (e) out.push({ entity: e, player, position: 'BENCH', benchIndex: i }); });
  return out;
}

export function allEntities(state: MatchState): Located[] {
  return [...entitiesOf(state, 'A'), ...entitiesOf(state, 'B')];
}

export function locate(state: MatchState, entityId: string): Located | null {
  return allEntities(state).find((l) => l.entity.entityId === entityId) ?? null;
}

export function mustLocate(state: MatchState, entityId: string): Located {
  const found = locate(state, entityId);
  if (!found) throw new Error(`entidade fora de jogo ${entityId}`);
  return found;
}

export function benchCount(p: PlayerState): number {
  return p.bench.filter(Boolean).length;
}

export function firstFreeBench(p: PlayerState): number {
  return p.bench.findIndex((e) => e === null);
}

export function hasPokemonInPlay(state: MatchState, player: PlayerId): boolean {
  return entitiesOf(state, player).length > 0;
}

export function coin(ctx: Ctx): CoinFace {
  const scripted = ctx.s.scriptedCoins.shift();
  if (scripted) return scripted;
  const result = flipCoin(ctx.s.rng);
  ctx.s.rng = result.rng;
  return result.value;
}

export function randomIndex(ctx: Ctx, n: number): number {
  const result = uniformInt(ctx.s.rng, n);
  ctx.s.rng = result.rng;
  return result.value;
}

export function shuffleDeck(ctx: Ctx, player: PlayerId): void {
  const p = ctx.s.players[player];
  const result = shuffle(ctx.s.rng, p.deck);
  ctx.s.rng = result.rng;
  p.deck = result.value;
  emit(ctx, 'DECK_SHUFFLED', { player, count: p.deck.length }, { triggerable: false });
}

/** Compra até `count` cartas respeitando o limite da mão; nunca emite compra fictícia (G-083). */
export function drawCards(ctx: Ctx, player: PlayerId, count: number): number {
  const p = ctx.s.players[player];
  let drawn = 0;
  for (let i = 0; i < count; i += 1) {
    if (p.hand.length >= ctx.s.config.maximumHandSize) {
      emit(ctx, 'DRAW_SKIPPED', { player, reason: 'HAND_FULL' }, { triggerable: false });
      break;
    }
    const cardId = p.deck.shift();
    if (!cardId) {
      emit(ctx, 'DRAW_SKIPPED', { player, reason: 'DECK_EMPTY' }, { triggerable: false });
      break;
    }
    p.hand.push(cardId);
    drawn += 1;
    emit(ctx, 'CARD_DRAWN', { player, cardId, handCount: p.hand.length, deckCount: p.deck.length },
      { visibility: 'OWNER', owner: player, secretFields: ['cardId'], triggerable: false });
  }
  return drawn;
}

export function removeFromArray(list: string[], id: string): boolean {
  const index = list.indexOf(id);
  if (index < 0) return false;
  list.splice(index, 1);
  return true;
}

export function opponentOf(player: PlayerId): PlayerId {
  return other(player);
}

export function newEntity(ctx: Ctx, owner: PlayerId, cardId: string): PokemonEntity {
  return {
    entityId: nextId(ctx, 'entity', `pk-${owner}`),
    owner,
    stack: [cardId],
    damage: 0,
    energies: [],
    toolCardId: null,
    conditions: { poisoned: false, burned: false, control: null, paralyzedSinceTurn: null },
    enteredPlayOnTurn: ctx.s.globalTurnNumber,
    lastEvolvedOnTurn: -1,
    usage: {},
  };
}

/** Coloca a entidade de volta na estrutura: retorna a referência viva dentro do estado. */
export function entityRef(state: MatchState, entityId: string): PokemonEntity {
  return mustLocate(state, entityId).entity;
}
