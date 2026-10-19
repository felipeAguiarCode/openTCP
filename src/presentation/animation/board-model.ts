// Projeção apresentada (runtime §19.1 `presentedProjection`): o que está visível agora. É derivada só de
// BattleView/eventos confirmados — nunca recalcula regras. Os redutores aplicam deltas de eventos para que
// HUD e cena não mostrem estado futuro antes do grupo visual correspondente; a reconciliação final usa
// sempre `projectBoard(after)`.
import type { BattleView, CardRef, EntityView } from '../../domain/battle/views.ts';
import type { BattleEvent, MatchResult, Phase, PlayerId } from '../../domain/battle/types.ts';
import type { EffectBadge } from '../../domain/battle/effect-badges.ts';

export type SlotKey = 'ACTIVE' | 'BENCH_0' | 'BENCH_1' | 'BENCH_2';
export type SideRole = 'HUMAN' | 'NPC';
export const SLOT_KEYS: readonly SlotKey[] = ['ACTIVE', 'BENCH_0', 'BENCH_1', 'BENCH_2'];

export type PresentedCard = { readonly cardId: string; readonly printingId: string; readonly definitionKey: string };

export type PresentedEntity = {
  entityId: string;
  owner: PlayerId;
  slot: SlotKey;
  top: PresentedCard;
  stack: PresentedCard[];
  damage: number;
  maxHp: number;
  remainingHp: number;
  energies: { id: string; type: string; units: number }[];
  tool: PresentedCard | null;
  conditions: { poisoned: boolean; burned: boolean; control: string | null };
  /** Selos dos efeitos temporários (interface §25.21): entram no passo do EFFECT_STARTED e saem no EFFECT_EXPIRED. */
  effects: EffectBadge[];
  knockedOut: boolean;
};

/** Carta da mão: `card` nulo = verso (identidade não autorizada). A chave da mão adversária é posicional. */
export type PresentedHandCard = { key: string; card: PresentedCard | null };

export type PresentedSide = {
  player: PlayerId;
  role: SideRole;
  active: PresentedEntity | null;
  bench: (PresentedEntity | null)[];
  hand: PresentedHandCard[];
  deckCount: number;
  discard: PresentedCard[];
  energyReady: string | null;
  energyNext: string | null;
  points: number;
  /** Treinadores na área de resolução temporária (jogados, ainda não descartados/ligados). */
  resolving: PresentedCard[];
};

export type PresentedBoard = {
  viewer: PlayerId;
  currentPlayer: PlayerId;
  turnNumber: number;
  phase: Phase;
  sides: Record<PlayerId, PresentedSide>;
  stadium: (PresentedCard & { owner: PlayerId }) | null;
  result: MatchResult | null;
  pendingDecision: { player: PlayerId; kind: string } | null;
  /** Último evento confirmado já refletido nesta projeção (cursor). */
  lastSeq: number;
};

export type CardIndex = ReadonlyMap<string, PresentedCard>;

const other = (p: PlayerId): PlayerId => (p === 'A' ? 'B' : 'A');

function card(ref: CardRef): PresentedCard {
  return { cardId: ref.cardId, printingId: ref.printingId, definitionKey: ref.definitionKey };
}

export function opaqueHandKey(player: PlayerId, index: number): string {
  return `opaque:${player}:${index}`;
}

function slotOf(view: EntityView): SlotKey {
  return view.position === 'ACTIVE' ? 'ACTIVE' : (`BENCH_${view.benchIndex ?? 0}` as SlotKey);
}

function entityFromView(view: EntityView): PresentedEntity {
  return {
    entityId: view.entityId,
    owner: view.owner,
    slot: slotOf(view),
    top: card(view.top),
    stack: view.stack.map(card),
    damage: view.damage,
    maxHp: view.maxHp,
    remainingHp: view.remainingHp,
    energies: view.energies.map((e) => ({ id: e.id, type: e.type, units: e.units })),
    tool: view.tool ? card(view.tool) : null,
    conditions: { poisoned: view.conditions.poisoned, burned: view.conditions.burned, control: view.conditions.control },
    effects: [...view.effects],
    knockedOut: false,
  };
}

export function projectBoard(view: BattleView, lastSeq = 0): PresentedBoard {
  const sides = {} as Record<PlayerId, PresentedSide>;
  for (const player of ['A', 'B'] as const) {
    const s = view.sides[player];
    const role: SideRole = player === view.viewer ? 'HUMAN' : 'NPC';
    sides[player] = {
      player,
      role,
      active: s.active ? entityFromView(s.active) : null,
      bench: [0, 1, 2].map((i) => {
        const e = s.bench[i];
        return e ? entityFromView(e) : null;
      }),
      hand: s.hand
        ? s.hand.map((ref) => ({ key: ref.cardId, card: card(ref) }))
        : Array.from({ length: s.handCount }, (_, i) => ({ key: opaqueHandKey(player, i), card: null })),
      deckCount: s.deckCount,
      discard: s.discard.map(card),
      energyReady: s.energyZone.ready,
      energyNext: s.energyZone.next,
      points: s.points,
      resolving: [],
    };
  }
  const pending = view.decisions.find((d) => !d.answered) ?? null;
  return {
    viewer: view.viewer,
    currentPlayer: view.currentPlayer,
    turnNumber: view.globalTurnNumber,
    phase: view.phase,
    sides,
    stadium: view.stadium ? { ...card(view.stadium), owner: view.stadium.owner } : null,
    result: view.result,
    pendingDecision: pending ? { player: pending.player, kind: pending.kind } : null,
    lastSeq,
  };
}

/** Índice de identidades públicas/autorizadas conhecidas por `before` e `after` (nunca inventa uma frente). */
export function buildCardIndex(...views: readonly BattleView[]): Map<string, PresentedCard> {
  const index = new Map<string, PresentedCard>();
  const add = (ref: CardRef | null | undefined) => {
    if (ref) index.set(ref.cardId, card(ref));
  };
  for (const view of views) {
    for (const player of ['A', 'B'] as const) {
      const s = view.sides[player];
      for (const e of [s.active, ...s.bench]) {
        if (!e) continue;
        e.stack.forEach(add);
        add(e.tool);
      }
      s.hand?.forEach(add);
      s.discard.forEach(add);
    }
    add(view.stadium);
  }
  return index;
}

export type EntityLookup = (entityId: string) => EntityView | null;

export function entityLookupOf(...views: readonly BattleView[]): EntityLookup {
  const map = new Map<string, EntityView>();
  for (const view of views) {
    for (const player of ['A', 'B'] as const) {
      const s = view.sides[player];
      for (const e of [s.active, ...s.bench]) if (e && !map.has(e.entityId)) map.set(e.entityId, e);
    }
  }
  return (id) => map.get(id) ?? null;
}

export type ReduceContext = {
  readonly cards: CardIndex;
  /** Preferência: `after` (estado mais recente), depois `before`. */
  readonly entity: EntityLookup;
};

export function cloneBoard(board: PresentedBoard): PresentedBoard {
  return structuredClone(board);
}

export function entitiesOf(side: PresentedSide): PresentedEntity[] {
  return [side.active, ...side.bench].filter((e): e is PresentedEntity => e !== null);
}

export function findEntity(board: PresentedBoard, entityId: string): PresentedEntity | null {
  for (const player of ['A', 'B'] as const) {
    for (const e of entitiesOf(board.sides[player])) if (e.entityId === entityId) return e;
  }
  return null;
}

export function roleOf(board: PresentedBoard, player: PlayerId): SideRole {
  return player === board.viewer ? 'HUMAN' : 'NPC';
}

export function slotAnchorId(role: SideRole, slot: SlotKey): string {
  return `${role}_${slot}`;
}

export function entityAnchorId(board: PresentedBoard, entityId: string): string | null {
  const e = findEntity(board, entityId);
  return e ? slotAnchorId(roleOf(board, e.owner), e.slot) : null;
}

function placeEntity(side: PresentedSide, entity: PresentedEntity): void {
  if (entity.slot === 'ACTIVE') side.active = entity;
  else side.bench[Number(entity.slot.slice(6))] = entity;
}

function removeEntity(side: PresentedSide, entityId: string): PresentedEntity | null {
  if (side.active?.entityId === entityId) {
    const e = side.active;
    side.active = null;
    return e;
  }
  const i = side.bench.findIndex((b) => b?.entityId === entityId);
  if (i >= 0) {
    const e = side.bench[i]!;
    side.bench[i] = null;
    return e;
  }
  return null;
}

function reindexOpaque(side: PresentedSide, count: number): void {
  side.hand = Array.from({ length: Math.max(0, count) }, (_, i) => ({ key: opaqueHandKey(side.player, i), card: null }));
}

function isOpaqueSide(side: PresentedSide): boolean {
  return side.role === 'NPC';
}

function removeFromHand(side: PresentedSide, cardIds: readonly (string | null)[]): void {
  if (isOpaqueSide(side)) {
    reindexOpaque(side, side.hand.length - cardIds.length);
    return;
  }
  for (const id of cardIds) {
    const i = id ? side.hand.findIndex((h) => h.key === id) : -1;
    if (i >= 0) side.hand.splice(i, 1);
  }
}

function addToHand(side: PresentedSide, cardIds: readonly (string | null)[], ctx: ReduceContext): void {
  if (isOpaqueSide(side)) {
    reindexOpaque(side, side.hand.length + cardIds.length);
    return;
  }
  for (const id of cardIds) {
    const known = id ? ctx.cards.get(id) ?? null : null;
    side.hand.push({ key: id ?? `unknown:${side.player}:${side.hand.length}`, card: known });
  }
}

function lookupCard(ctx: ReduceContext, cardId: unknown): PresentedCard | null {
  return typeof cardId === 'string' ? ctx.cards.get(cardId) ?? null : null;
}

function newEntity(ctx: ReduceContext, owner: PlayerId, entityId: string, cardId: string | null, slot: SlotKey): PresentedEntity | null {
  const known = ctx.entity(entityId);
  const base = cardId ? lookupCard(ctx, cardId) : null;
  const top = base ?? (known ? card(known.stack[0] ?? known.top) : null);
  if (!top) return null;
  const maxHp = known?.maxHp ?? 0;
  return {
    entityId, owner, slot, top, stack: [top], damage: 0, maxHp, remainingHp: maxHp, energies: [], tool: null,
    conditions: { poisoned: false, burned: false, control: null }, effects: [], knockedOut: false,
  };
}

function setHp(entity: PresentedEntity, damage: number, maxHp?: number): void {
  entity.damage = damage;
  if (typeof maxHp === 'number' && maxHp > 0) entity.maxHp = maxHp;
  entity.remainingHp = Math.max(0, entity.maxHp - entity.damage);
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function ids(value: unknown): (string | null)[] {
  return Array.isArray(value) ? value.map((v) => (typeof v === 'string' ? v : null)) : [];
}

function setCondition(entity: PresentedEntity, condition: string, on: boolean): void {
  if (condition === 'POISONED') entity.conditions.poisoned = on;
  else if (condition === 'BURNED') entity.conditions.burned = on;
  else if (on) entity.conditions.control = condition;
  else if (entity.conditions.control === condition) entity.conditions.control = null;
}

function locateByCard(board: PresentedBoard, player: PlayerId, cardIds: readonly (string | null)[]): PresentedEntity | null {
  const wanted = new Set(cardIds.filter((c): c is string => !!c));
  for (const e of entitiesOf(board.sides[player])) {
    if (e.stack.some((c) => wanted.has(c.cardId)) || (e.tool && wanted.has(e.tool.cardId))) return e;
  }
  return null;
}

/**
 * Aplica um evento confirmado à projeção apresentada (imutável: devolve uma nova projeção).
 * Eventos sem efeito visível de estado retornam a mesma projeção com o cursor avançado.
 */
export function applyEvent(board: PresentedBoard, event: BattleEvent, ctx: ReduceContext): PresentedBoard {
  const b = cloneBoard(board);
  b.lastSeq = Math.max(b.lastSeq, event.seq);
  const d = event.data;
  const playerOf = (key = 'player'): PlayerId | null => {
    const v = d[key];
    return v === 'A' || v === 'B' ? v : null;
  };
  const p = playerOf();
  const side = p ? b.sides[p] : null;

  switch (event.type) {
    case 'TURN_STARTED':
      if (p) b.currentPlayer = p;
      b.turnNumber = num(d.globalTurnNumber, b.turnNumber);
      b.phase = 'MAIN';
      break;
    case 'TURN_ENDED':
      b.phase = 'BETWEEN_TURNS';
      break;
    case 'CARDS_DEALT':
      if (side) {
        const cardIds = ids(d.cardIds);
        if (isOpaqueSide(side) || cardIds.every((c) => c === null)) reindexOpaque(side, num(d.handCount, cardIds.length));
        else side.hand = cardIds.map((id, i) => ({ key: id ?? opaqueHandKey(side.player, i), card: lookupCard(ctx, id) }));
        side.deckCount = num(d.deckCount, side.deckCount);
      }
      break;
    case 'SETUP_REVEALED':
      if (side && p) {
        const placed: (string | null)[] = [];
        const activeData = d.active as { entityId?: string; cardId?: string } | null;
        if (activeData?.entityId) {
          const e = newEntity(ctx, p, activeData.entityId, activeData.cardId ?? null, 'ACTIVE');
          if (e) placeEntity(side, e);
          placed.push(activeData.cardId ?? null);
        }
        const bench = Array.isArray(d.bench) ? (d.bench as ({ entityId?: string; cardId?: string } | null)[]) : [];
        bench.forEach((slot, i) => {
          if (!slot?.entityId) return;
          const e = newEntity(ctx, p, slot.entityId, slot.cardId ?? null, `BENCH_${i}` as SlotKey);
          if (e) placeEntity(side, e);
          placed.push(slot.cardId ?? null);
        });
        if (isOpaqueSide(side)) reindexOpaque(side, num(d.handCount, side.hand.length - placed.length));
        else removeFromHand(side, placed);
      }
      b.phase = 'MAIN';
      break;
    case 'HAND_SHUFFLED_INTO_DECK':
      if (side) {
        // Para quem não é dono, `cardIds` chega nulo: a mão opaca é reindexada pela contagem pública.
        if (isOpaqueSide(side) || !Array.isArray(d.cardIds)) reindexOpaque(side, num(d.handCount, 0));
        else removeFromHand(side, ids(d.cardIds));
        side.deckCount = num(d.deckCount, side.deckCount + num(d.count, 0));
      }
      break;
    case 'CARD_DRAWN':
    case 'CARD_SEARCHED':
      if (side) {
        addToHand(side, [str(d.cardId)], ctx);
        if (event.type === 'CARD_DRAWN') side.deckCount = num(d.deckCount, side.deckCount - 1);
        else side.deckCount = Math.max(0, side.deckCount - 1);
        if (isOpaqueSide(side) && typeof d.handCount === 'number') reindexOpaque(side, d.handCount);
      }
      break;
    case 'POKEMON_ENTERED':
      if (side && p) {
        const entityId = str(d.entityId);
        const cardId = str(d.cardId);
        const slot: SlotKey = d.position === 'ACTIVE' ? 'ACTIVE' : (`BENCH_${num(d.benchIndex)}` as SlotKey);
        if (entityId) {
          const e = newEntity(ctx, p, entityId, cardId, slot);
          if (e) placeEntity(side, e);
        }
        if (d.from === 'HAND') removeFromHand(side, [cardId]);
        else if (d.from === 'DECK') side.deckCount = Math.max(0, side.deckCount - 1);
        else if (d.from === 'DISCARD' && cardId) side.discard = side.discard.filter((c) => c.cardId !== cardId);
      }
      break;
    case 'POKEMON_EVOLVED':
      if (side) {
        const e = findEntity(b, str(d.entityId) ?? '');
        const to = lookupCard(ctx, d.toCardId);
        if (e && to) {
          e.stack.push(to);
          e.top = to;
          const known = ctx.entity(e.entityId);
          if (known && known.top.cardId === to.cardId) setHp(e, e.damage, known.maxHp);
        }
        removeFromHand(side, [str(d.toCardId)]);
      }
      break;
    case 'TRAINER_PLAYED':
      // Fóssil: o POKEMON_ENTERED seguinte retira a carta da mão e a coloca no Banco.
      if (side && !d.fossil) {
        const c = lookupCard(ctx, d.cardId);
        removeFromHand(side, [str(d.cardId)]);
        if (c) side.resolving.push(c);
      }
      break;
    case 'TOOL_ATTACHED': {
      const e = findEntity(b, str(d.entityId) ?? '');
      const c = lookupCard(ctx, d.cardId);
      if (e && c) e.tool = c;
      if (side) side.resolving = side.resolving.filter((r) => r.cardId !== d.cardId);
      break;
    }
    case 'TOOL_REMOVED': {
      const e = findEntity(b, str(d.entityId) ?? '');
      if (e) {
        const tool = e.tool;
        e.tool = null;
        if (tool && side) {
          if (d.destination === 'HAND') addToHand(side, [tool.cardId], ctx);
          else side.discard.push(tool);
        }
      }
      break;
    }
    case 'STADIUM_REPLACED': {
      const c = lookupCard(ctx, d.cardId);
      const prevOwner = playerOf('previousOwner');
      if (b.stadium && prevOwner) b.sides[prevOwner].discard.push({ cardId: b.stadium.cardId, printingId: b.stadium.printingId, definitionKey: b.stadium.definitionKey });
      if (c && p) b.stadium = { ...c, owner: p };
      if (side) side.resolving = side.resolving.filter((r) => r.cardId !== d.cardId);
      break;
    }
    case 'ENERGY_ZONE_UPDATED':
      if (side) {
        side.energyReady = str(d.ready);
        side.energyNext = str(d.next);
      }
      break;
    case 'ENERGY_ATTACHED': {
      const e = findEntity(b, str(d.entityId) ?? '');
      const type = str(d.energyType) ?? 'COLORLESS';
      if (e) e.energies.push({ id: str(d.energyId) ?? `energy-${event.seq}`, type, units: 1 });
      // Só a ligação manual gasta a Energia pronta; Energia gerada por efeito sai da Zona sem tocar a pronta.
      if (side && d.source === 'ENERGY_ZONE' && d.mode === 'MANUAL') side.energyReady = null;
      break;
    }
    case 'ENERGY_MOVED': {
      const from = findEntity(b, str(d.fromEntityId) ?? '');
      const to = findEntity(b, str(d.toEntityId) ?? '');
      const energyId = str(d.energyId);
      const index = from ? from.energies.findIndex((x) => x.id === energyId) : -1;
      const unit = from && index >= 0 ? from.energies.splice(index, 1)[0]! : { id: energyId ?? `energy-${event.seq}`, type: str(d.energyType) ?? 'COLORLESS', units: 1 };
      if (to) to.energies.push(unit);
      break;
    }
    case 'ENERGY_DISCARDED': {
      const e = findEntity(b, str(d.entityId) ?? '');
      const removed = new Set((Array.isArray(d.energies) ? (d.energies as { id?: string }[]) : []).map((x) => x.id));
      if (e) e.energies = e.energies.filter((x) => !removed.has(x.id));
      break;
    }
    case 'DAMAGE_APPLIED': {
      const e = findEntity(b, str(d.targetEntityId) ?? '');
      if (e) setHp(e, num(d.damageTotal, e.damage + num(d.amount)), typeof d.maxHp === 'number' ? d.maxHp : undefined);
      break;
    }
    case 'DAMAGE_MOVED': {
      const from = findEntity(b, str(d.fromEntityId) ?? '');
      const to = findEntity(b, str(d.toEntityId) ?? '');
      if (from) setHp(from, num(d.fromDamage, Math.max(0, from.damage - num(d.amount))));
      if (to) setHp(to, num(d.toDamage, to.damage + num(d.amount)));
      break;
    }
    case 'REMAINING_HP_SET': {
      const e = findEntity(b, str(d.entityId) ?? '');
      if (e) setHp(e, num(d.damageTotal, e.damage), typeof d.maxHp === 'number' ? d.maxHp : undefined);
      break;
    }
    case 'POKEMON_DEVOLVED': {
      const e = findEntity(b, str(d.entityId) ?? '');
      if (e && e.stack.length > 1) {
        e.stack.pop();
        e.top = e.stack[e.stack.length - 1]!;
        const known = ctx.entity(e.entityId);
        if (known && known.top.cardId === e.top.cardId) setHp(e, e.damage, known.maxHp);
      }
      if (side) addToHand(side, [str(d.cardId)], ctx);
      break;
    }
    case 'ENERGY_TYPE_CHANGED': {
      const e = findEntity(b, str(d.entityId) ?? '');
      const unit = e?.energies.find((x) => x.id === str(d.energyId));
      if (unit) unit.type = str(d.to) ?? unit.type;
      break;
    }
    case 'CARDS_RETURNED_TO_DECK':
      if (side) {
        if (isOpaqueSide(side) || !Array.isArray(d.cardIds)) reindexOpaque(side, num(d.handCount, Math.max(0, side.hand.length - num(d.count, 0))));
        else removeFromHand(side, ids(d.cardIds));
        side.deckCount += num(d.count, 0);
      }
      break;
    case 'HEAL_APPLIED': {
      const e = findEntity(b, str(d.entityId) ?? '');
      if (e) setHp(e, num(d.damageTotal, Math.max(0, e.damage - num(d.amount))));
      break;
    }
    case 'EFFECT_STARTED': {
      // O selo (tipo e texto) vem da visão mais recente do Pokémon; alvos dinâmicos também (targets nulo no evento).
      const effectId = str(d.effectId) ?? '';
      for (const player of ['A', 'B'] as const) {
        for (const e of entitiesOf(b.sides[player])) {
          const badge = ctx.entity(e.entityId)?.effects.find((x) => x.effectId === effectId);
          if (badge && !e.effects.some((x) => x.effectId === effectId)) e.effects.push(badge);
        }
      }
      break;
    }
    case 'EFFECT_EXPIRED': {
      const effectId = str(d.effectId) ?? '';
      for (const player of ['A', 'B'] as const) for (const e of entitiesOf(b.sides[player])) e.effects = e.effects.filter((x) => x.effectId !== effectId);
      break;
    }
    case 'CONDITION_APPLIED':
    case 'CONDITION_REMOVED': {
      const e = findEntity(b, str(d.entityId) ?? '');
      const condition = str(d.condition);
      if (e && condition) setCondition(e, condition, event.type === 'CONDITION_APPLIED');
      break;
    }
    case 'POKEMON_MOVED':
      if (side) {
        const incoming = removeEntity(side, str(d.entityId) ?? '');
        const swappedId = str(d.swappedEntityId);
        const outgoing = swappedId ? removeEntity(side, swappedId) : null;
        const benchIndex = num(d.benchIndex);
        if (incoming) {
          incoming.slot = 'ACTIVE';
          placeEntity(side, incoming);
        }
        if (outgoing) {
          // Sair do Ativo limpa Condições Especiais (gameplay); o evento CONDITION_REMOVED também chega.
          outgoing.slot = `BENCH_${benchIndex}` as SlotKey;
          outgoing.conditions = { poisoned: false, burned: false, control: null };
          placeEntity(side, outgoing);
        }
      }
      break;
    case 'POKEMON_KNOCKED_OUT': {
      const e = findEntity(b, str(d.entityId) ?? '');
      if (e) {
        e.knockedOut = true;
        setHp(e, Math.max(e.damage, e.maxHp));
      }
      break;
    }
    case 'POKEMON_REMOVED':
      if (side) removeEntity(side, str(d.entityId) ?? '');
      break;
    case 'CARD_DISCARDED':
      if (side && p) {
        const cardIds = ids(d.cardIds);
        if (d.from === 'HAND') removeFromHand(side, cardIds);
        else if (d.from === 'FIELD') {
          const owner = locateByCard(b, p, cardIds);
          if (owner) removeEntity(side, owner.entityId);
        } else if (d.from === 'RESOLUTION') {
          side.resolving = side.resolving.filter((r) => !cardIds.includes(r.cardId));
        } else if (d.from === 'DECK_TOP') {
          side.deckCount = Math.max(0, side.deckCount - cardIds.length);
        }
        for (const id of cardIds) {
          const c = lookupCard(ctx, id);
          if (c) side.discard.push(c);
        }
      }
      break;
    case 'CARD_RETURNED':
      if (side && p) {
        const cardIds = ids(d.cardIds);
        if (d.from === 'DISCARD') side.discard = side.discard.filter((c) => !cardIds.includes(c.cardId));
        else {
          const owner = locateByCard(b, p, cardIds);
          if (owner) removeEntity(side, owner.entityId);
        }
        if (d.to === 'HAND') addToHand(side, cardIds, ctx);
        else side.deckCount += cardIds.length;
      }
      break;
    case 'POINTS_GRANTED':
      if (side) side.points = num(d.total, side.points + num(d.points));
      break;
    case 'MATCH_ENDED':
      b.phase = 'TERMINAL';
      b.result = {
        outcome: d.outcome === 'DRAW' ? 'DRAW' : 'WIN',
        winner: playerOf('winner'),
        reason: (str(d.reason) ?? 'POINTS') as MatchResult['reason'],
        points: (d.points as MatchResult['points']) ?? { A: b.sides.A.points, B: b.sides.B.points },
        globalTurnNumber: num(d.globalTurnNumber, b.turnNumber),
      };
      break;
    case 'DECISION_REQUESTED':
      if (p) b.pendingDecision = { player: p, kind: str(d.kind) ?? 'UNKNOWN' };
      break;
    case 'DECISION_RESOLVED':
      b.pendingDecision = null;
      break;
    default:
      break;
  }
  return b;
}

/** Igualdade estrutural das partes visíveis de duas projeções (ignora cursor). */
export function sameVisibleBoard(a: PresentedBoard, b: PresentedBoard): boolean {
  const strip = (x: PresentedBoard) => ({ ...x, lastSeq: 0, pendingDecision: null });
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
}

export { other as otherPlayer };
