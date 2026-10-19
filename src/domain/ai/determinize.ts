// Determinização (gameplay §25.2, runtime §11.3): monta estados completos *plausíveis* a partir da
// observação autorizada. A mão e a lista do próprio deck são conhecidas; a ordem do próprio baralho é
// sorteada com o aiRng; mão e baralho do adversário são amostrados de um conjunto plausível (cartas já
// vistas + preenchimento genérico dos tipos aparentes). Estes estados existem só dentro do planejador.
import type { AiKnowledge } from '../../application/ports/ai.ts';
import { getLegalActions } from '../battle/actions.ts';
import type { Ctx } from '../battle/core.ts';
import { consumeAbilityUsage } from '../battle/flow.ts';
import { ENGINE_VERSION, emptyStats } from '../battle/setup.ts';
import type {
  ActiveEffect, BattleCard, CatalogLookup, MatchState, PlayerId, PlayerState, PokemonEntity,
} from '../battle/types.ts';
import { DEFAULT_RULESET, other } from '../battle/types.ts';
import type { BattleView, CardRef, EntityView, SideView } from '../battle/views.ts';
import type { CardDefinition, CardPrinting, ControlCondition, EnergyType, Operation, PokemonType } from '../cards/types.ts';
import { definitionKey } from '../cards/types.ts';
import { isPokemon } from '../cards/types.ts';
import { nextU32, seedRng, shuffle, uniformInt, type RngState } from '../random/rng.ts';
import { safeDefinition } from './cards.ts';

/** O worker entrega o `Catalog` completo; quando houver o mapa de definições, ele alimenta o preenchimento genérico. */
export type PlannerCatalog = CatalogLookup & {
  readonly definitions?: ReadonlyMap<string, CardDefinition>;
  readonly printings?: ReadonlyMap<string, CardPrinting>;
};

export type Determinization = { readonly state: MatchState; readonly rng: RngState };

const printingIndex = new WeakMap<object, Map<string, string>>();

/** Impressão real do catálogo para a definição (quando o catálogo expõe impressões); senão um ID sintético. */
function printingFor(cat: PlannerCatalog, key: string): string {
  if (cat.printings) {
    let index = printingIndex.get(cat);
    if (!index) {
      index = new Map();
      const sorted = [...cat.printings.values()].sort((a, b) => (a.printingId < b.printingId ? -1 : a.printingId > b.printingId ? 1 : 0));
      for (const p of sorted) {
        const k = definitionKey(p.cardDefinitionId, p.cardDefinitionVersion);
        if (!index.has(k)) index.set(k, p.printingId);
      }
      printingIndex.set(cat, index);
    }
    const found = index.get(key);
    if (found) return found;
  }
  return `ai-sim:${key}`;
}
const MAX_COPIES = 2;

/** Definições do catálogo em ordem de chave, calculadas uma vez por catálogo (a IA determiniza a cada decisão). */
const sortedCache = new WeakMap<object, readonly (readonly [string, CardDefinition])[]>();
function sortedDefinitions(defs: ReadonlyMap<string, CardDefinition>): readonly (readonly [string, CardDefinition])[] {
  let entries = sortedCache.get(defs);
  if (!entries) {
    entries = [...defs.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    sortedCache.set(defs, entries);
  }
  return entries;
}

export function actionKey(action: unknown): string {
  return JSON.stringify(action);
}

function idNumber(id: string): number {
  const m = /-(\d+)$/.exec(id);
  return m ? Number(m[1]) : 0;
}

function entityViews(side: SideView): EntityView[] {
  return [side.active, ...side.bench].filter((e): e is EntityView => e !== null);
}

/** Definições públicas de um lado: pilhas e Ferramentas em campo, descarte e Estádio próprio. */
export function visibleKeys(view: BattleView, player: PlayerId): string[] {
  const side = view.sides[player];
  const out: string[] = [];
  for (const e of entityViews(side)) {
    for (const r of e.stack) out.push(r.definitionKey);
    if (e.tool) out.push(e.tool.definitionKey);
  }
  for (const r of side.discard) out.push(r.definitionKey);
  if (view.stadium && view.stadium.owner === player) out.push(view.stadium.definitionKey);
  return out;
}

function takeMultiset(list: readonly string[], remove: readonly string[]): string[] {
  const out = [...list];
  for (const key of remove) {
    const i = out.indexOf(key);
    if (i >= 0) out.splice(i, 1);
  }
  return out;
}

function pickOne<T>(rng: RngState, list: readonly T[]): { value: T; rng: RngState } {
  const r = uniformInt(rng, list.length);
  return { value: list[r.value]!, rng: r.rng };
}

/**
 * Conjunto plausível de cartas ocultas do adversário. A lista real dele é desconhecida: usa as cartas já
 * vistas (respeitando o limite de cópias), evoluções das linhas vistas, Básicos dos tipos aparentes e os
 * Treinadores genéricos (os da própria lista do NPC servem de aproximação do “Treinador comum”).
 */
function opponentPool(view: BattleView, knowledge: AiKnowledge, cat: PlannerCatalog, rng: RngState): { value: string[]; rng: RngState } {
  const op = other(view.viewer);
  const visible = visibleKeys(view, op);
  const seen = [...new Set([...knowledge.seenOpponentCards, ...visible])].sort();
  const limitCount = new Map<string, number>();
  for (const key of visible) {
    const def = safeDefinition(cat, key);
    if (def) limitCount.set(def.deckLimitKey, (limitCount.get(def.deckLimitKey) ?? 0) + 1);
  }
  const pool: string[] = [];
  const seenLimitKeys = new Set<string>();
  const types = new Set<PokemonType>(view.sides[op].energyZone.types as PokemonType[]);
  for (const key of seen) {
    const def = safeDefinition(cat, key);
    if (!def) continue;
    seenLimitKeys.add(def.deckLimitKey);
    if (isPokemon(def)) def.types.forEach((t) => types.add(t));
    const remaining = Math.max(0, MAX_COPIES - (limitCount.get(def.deckLimitKey) ?? 0));
    for (let i = 0; i < remaining; i += 1) pool.push(key);
  }
  let current = rng;
  const defs = cat.definitions;
  if (defs) {
    const entries = sortedDefinitions(defs);
    const lines = new Set(seenLimitKeys);
    // Evoluções das linhas vistas (até dois estágios).
    for (let pass = 0; pass < 2; pass += 1) {
      for (const [key, def] of entries) {
        if (!isPokemon(def) || def.stage === 'BASIC' || seenLimitKeys.has(def.deckLimitKey)) continue;
        if (!def.evolvesFrom.some((from) => lines.has(from))) continue;
        if (pool.includes(key)) continue;
        pool.push(key);
        lines.add(def.deckLimitKey);
      }
    }
    // Alguns Básicos dos tipos aparentes ainda não vistos.
    const basics = entries.filter(([, def]) => isPokemon(def) && def.stage === 'BASIC' && def.ruleBox === 'NONE'
      && !seenLimitKeys.has(def.deckLimitKey) && def.types.some((t) => types.has(t))).map(([key]) => key);
    if (basics.length) {
      const picked = shuffle(current, basics);
      current = picked.rng;
      pool.push(...picked.value.slice(0, 3));
    }
  }
  // Treinadores genéricos: os da lista do NPC, uma cópia cada, quando o adversário ainda não os mostrou.
  for (const key of [...new Set(knowledge.ownDeckList)].sort()) {
    const def = safeDefinition(cat, key);
    if (!def || def.category !== 'TRAINER' || seenLimitKeys.has(def.deckLimitKey)) continue;
    pool.push(key);
  }
  if (pool.length === 0) pool.push(...seen, ...knowledge.ownDeckList);
  return { value: pool, rng: current };
}

function sampleHidden(rng: RngState, pool: readonly string[], count: number): { value: string[]; rng: RngState } {
  if (count <= 0 || pool.length === 0) return { value: [], rng };
  const shuffled = shuffle(rng, pool);
  let current = shuffled.rng;
  const out = shuffled.value.slice(0, count);
  while (out.length < count) {
    const r = pickOne(current, pool);
    current = r.rng;
    out.push(r.value);
  }
  return { value: out, rng: current };
}

function findOperation(def: CardDefinition, opcode: string): Operation | null {
  const blocks = [
    ...def.attacks.flatMap((a) => a.effects),
    ...def.abilities.flatMap((a) => a.effects),
    ...(def.category === 'TRAINER' ? def.trainerEffects : []),
  ];
  const walk = (op: Operation): Operation | null => {
    if (op.type === opcode) return op;
    const children = op.type === 'CONDITIONAL' ? [...op.then, ...(op.else ?? [])] : op.type === 'SCHEDULE_DELAYED' ? op.operations : [];
    for (const child of children) {
      const found = walk(child);
      if (found) return found;
    }
    return null;
  };
  for (const block of blocks) {
    const found = walk(block.operation);
    if (found) return found;
  }
  return null;
}

function expiryOf(op: Operation, controller: PlayerId, view: BattleView): ActiveEffect['expiry'] {
  const duration = 'duration' in op ? op.duration : null;
  if (!duration) return null;
  const cur = view.currentPlayer;
  const own = view.ownTurns;
  switch (duration.kind) {
    case 'THIS_TURN': return { player: cur, ownTurn: own[cur] };
    case 'NEXT_OPPONENT_TURN': {
      const o = other(controller);
      return { player: o, ownTurn: cur === controller ? own[o] + 1 : own[o] };
    }
    case 'NEXT_OWN_TURN': return { player: controller, ownTurn: own[controller] + (cur === controller ? 0 : 1) };
    default: return null;
  }
}

/** Monta um estado completo plausível. Consome o aiRng (ordem do próprio baralho, amostra adversária, semente simulada). */
export function determinize(view: BattleView, knowledge: AiKnowledge, cat: PlannerCatalog, rng: RngState): Determinization {
  const me = view.viewer;
  const op = other(me);
  const cards: Record<string, BattleCard> = {};
  const counters = { entity: 0, energy: 0, decision: 0, frame: 0, effect: 0 };
  const addRef = (ref: CardRef, owner: PlayerId): string => {
    cards[ref.cardId] = { id: ref.cardId, owner, printingId: ref.printingId, definitionKey: ref.definitionKey };
    return ref.cardId;
  };
  const addHidden = (owner: PlayerId, zone: string, index: number, key: string): string => {
    const id = `ai-${owner}-${zone}-${index + 1}`;
    cards[id] = { id, owner, printingId: printingFor(cat, key), definitionKey: key };
    return id;
  };
  const entity = (ev: EntityView, owner: PlayerId): PokemonEntity => {
    counters.entity = Math.max(counters.entity, idNumber(ev.entityId));
    ev.stack.forEach((r) => addRef(r, owner));
    if (ev.tool) addRef(ev.tool, owner);
    for (const e of ev.energies) counters.energy = Math.max(counters.energy, idNumber(e.id));
    const control = ev.conditions.control as ControlCondition | null;
    return {
      entityId: ev.entityId, owner, stack: ev.stack.map((r) => r.cardId), damage: ev.damage,
      energies: ev.energies.map((e) => ({ id: e.id, type: e.type as EnergyType })),
      toolCardId: ev.tool ? ev.tool.cardId : null,
      conditions: {
        poisoned: ev.conditions.poisoned, burned: ev.conditions.burned, control,
        paralyzedSinceTurn: control === 'PARALYZED' ? (owner === view.currentPlayer ? view.globalTurnNumber - 1 : view.globalTurnNumber) : null,
      },
      // Desconhecidos na observação: ajustados por `alignWithObservation` quando as ações legais os revelam.
      enteredPlayOnTurn: 0, lastEvolvedOnTurn: -1, usage: {},
    };
  };

  let current = rng;
  const players = {} as Record<PlayerId, PlayerState>;
  for (const player of [me, op]) {
    const side = view.sides[player];
    const active = side.active ? entity(side.active, player) : null;
    const bench = side.bench.map((e) => (e ? entity(e, player) : null));
    const discard = side.discard.map((r) => addRef(r, player));
    const discardedEnergy = Object.entries(side.discardedEnergy).flatMap(([type, n]) =>
      Array.from({ length: n }, (_, i) => ({ id: `ai-den-${player}-${type}-${i + 1}`, type: type as EnergyType })));
    let hand: string[] = [];
    let deck: string[] = [];
    if (player === me) {
      hand = (side.hand ?? []).map((r) => addRef(r, player));
      let composition = side.deckRemaining ? [...side.deckRemaining] : null;
      if (!composition) {
        const known = [...visibleKeys(view, player), ...(side.hand ?? []).map((r) => r.definitionKey)];
        composition = takeMultiset(knowledge.ownDeckList, known);
      }
      composition = composition.slice(0, side.deckCount);
      while (composition.length < side.deckCount && knowledge.ownDeckList.length) {
        const r = pickOne(current, knowledge.ownDeckList);
        current = r.rng;
        composition.push(r.value);
      }
      const shuffled = shuffle(current, composition);
      current = shuffled.rng;
      deck = shuffled.value.map((key, i) => addHidden(player, 'd', i, key));
    } else {
      const pool = opponentPool(view, knowledge, cat, current);
      current = pool.rng;
      const sample = sampleHidden(current, pool.value, side.handCount + side.deckCount);
      current = sample.rng;
      hand = sample.value.slice(0, side.handCount).map((key, i) => addHidden(player, 'h', i, key));
      deck = sample.value.slice(side.handCount).map((key, i) => addHidden(player, 'd', i, key));
    }
    players[player] = {
      id: player, deck, hand, discard, discardedEnergy, active, bench,
      energyZone: { types: side.energyZone.types as EnergyType[], ready: side.energyZone.ready as EnergyType | null, next: side.energyZone.next as EnergyType | null },
      points: side.points,
      flags: { ...side.flags, usage: {} },
      matchUsage: {},
      revealedHand: false,
    };
  }

  let stadium: MatchState['stadium'] = null;
  if (view.stadium) {
    addRef(view.stadium, view.stadium.owner);
    stadium = { cardId: view.stadium.cardId, owner: view.stadium.owner };
  }

  const activeEffects: ActiveEffect[] = [];
  for (const fx of view.activeEffects) {
    counters.effect = Math.max(counters.effect, idNumber(fx.effectId));
    const source = cards[fx.sourceCardId];
    const def = source ? safeDefinition(cat, source.definitionKey) : null;
    const operation = def ? findOperation(def, fx.opcode) : null;
    if (!operation) continue;
    const sourceEntity = [...entityViews(view.sides.A), ...entityViews(view.sides.B)].find((e) => e.stack.some((r) => r.cardId === fx.sourceCardId));
    activeEffects.push({
      effectId: fx.effectId, controller: fx.controller, sourceCardId: fx.sourceCardId, sourceEntityId: sourceEntity?.entityId ?? null,
      operation, targets: fx.targets ? [...fx.targets] : null, expiry: expiryOf(operation, fx.controller, view),
      removeOn: 'duration' in operation ? [...(operation.duration.removeOn ?? [])] : [],
      charges: operation.type === 'PREVENT_DAMAGE' ? operation.charges ?? null : null,
    });
  }
  for (const d of view.decisions) counters.decision = Math.max(counters.decision, idNumber(d.decisionId));
  // Margem para nunca colidir com IDs que a observação não mostra.
  counters.entity += 100;
  counters.energy += 100;
  counters.decision += 100;
  counters.effect += 100;
  counters.frame = 100;

  const seed = nextU32(current);
  current = seed.rng;
  const state: MatchState = {
    formatVersion: 1,
    matchId: view.matchId,
    engineVersion: ENGINE_VERSION,
    config: { ...DEFAULT_RULESET, maximumGlobalTurns: view.maximumGlobalTurns },
    cards,
    players,
    stadium,
    phase: view.phase,
    firstPlayer: view.firstPlayer,
    currentPlayer: view.currentPlayer,
    globalTurnNumber: view.globalTurnNumber,
    ownTurns: { ...view.ownTurns },
    pendingDecisions: [],
    queue: [],
    frames: {},
    activeEffects,
    delayedEffects: [],
    rng: seedRng(seed.value),
    koMarked: [],
    scriptedCoins: [],
    counters,
    eventSeq: 0,
    stateVersion: view.stateVersion,
    stats: { A: emptyStats(), B: emptyStats() },
    roleTags: {},
    result: view.result,
  };
  return { state, rng: current };
}

/**
 * Marcadores por instância não aparecem na observação (turno de entrada, evolução e uso de Habilidade).
 * Quando o estado plausível permite algo que as ações legais reais não permitem, ajusta o marcador.
 */
export function alignWithObservation(state: MatchState, view: BattleView, cat: CatalogLookup): void {
  const me = view.viewer;
  if (state.phase !== 'MAIN' || state.currentPlayer !== me || view.decisions.some((d) => !d.answered)) return;
  const real = new Set(view.legalActions.map(actionKey));
  const ctx: Ctx = { s: state, cat, events: [], group: 0, triggerable: [] };
  for (const action of getLegalActions(ctx, me)) {
    if (real.has(actionKey(action))) continue;
    if (action.type === 'EVOLVE') {
      const target = [state.players[me].active, ...state.players[me].bench].find((e) => e?.entityId === action.targetEntityId);
      if (target) target.enteredPlayOnTurn = state.globalTurnNumber;
    } else if (action.type === 'USE_ABILITY') {
      const target = [state.players[me].active, ...state.players[me].bench].find((e) => e?.entityId === action.entityId);
      if (!target) continue;
      const cardId = target.stack[target.stack.length - 1]!;
      const ability = cat.definition(state.cards[cardId]!.definitionKey).abilities.find((a) => a.id === action.abilityId);
      if (ability) consumeAbilityUsage(ctx, me, target.entityId, cardId, ability);
    }
  }
}
