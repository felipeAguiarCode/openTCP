// Validação e aplicação das ações do jogador (gameplay §8–§13, §30). A camada de entrada envia
// intenção e escolhas; dano, moedas e pontos são sempre calculados aqui (G-051).
import type { AdditionalCost, Attack, CostType } from '../cards/types.ts';
import { isFossil, isPokemon } from '../cards/types.ts';
import {
  cardDef, emit, entityDef, entitiesOf, firstFreeBench, locate, newEntity, newGroup, nextId, removeFromArray, type Ctx, type Located,
} from './core.ts';
import {
  canPay, collectStatics, effectiveAttackCost, evolvesAsKeys, hasGrant, isAbilitySuppressed, isPlayerRestricted, isRestricted, providedUnits, retreatCost,
  staticsOn, type StaticEffect,
} from './derived.ts';
import { abilityUsageAvailable, consumeAbilityUsage, createFrame, finishMatch, runQueue } from './flow.ts';
import { evaluateCondition } from './formula.ts';
import { attachEnergyUnits, detachEntity, discardEnergyUnits, discardFromHand, routeEntityCards, stadiumOwnerChange, swapActive } from './mutations.ts';
import { blockTask, canProduceEffect, evolveEntity } from './ops.ts';
import { matchesCardFilter, matchesPokemonFilter, type SelectorContext } from './selectors.ts';
import type { Action, Decision, PlayerId, Task, Validation } from './types.ts';
import { other } from './types.ts';

type Readable = Pick<Ctx, 's' | 'cat'>;

const fail = (code: string, message?: string): Validation => ({ ok: false, code, message });
const OK: Validation = { ok: true };

function owned(state: Readable['s'], player: PlayerId, entityId: string): Located | null {
  const located = locate(state, entityId);
  return located && located.player === player ? located : null;
}

function sc(player: PlayerId, selfEntityId: string | null): SelectorContext {
  return { controller: player, selfEntityId, eventSourceEntityId: null, eventTargetEntityId: null, outputs: {} };
}

function isFirstOwnTurn(ctx: Readable, player: PlayerId): boolean {
  return ctx.s.ownTurns[player] <= 1;
}

function sumUnits(ctx: Readable, located: Located, energyIds: readonly string[], statics: StaticEffect[]): number {
  return providedUnits(ctx, located.entity, statics).filter((u) => energyIds.includes(u.id)).reduce((sum, u) => sum + u.units, 0);
}

function minimalPayment(ctx: Readable, located: Located, energyIds: readonly string[], cost: number, statics: StaticEffect[]): boolean {
  if (new Set(energyIds).size !== energyIds.length) return false;
  if (!energyIds.every((id) => located.entity.energies.some((e) => e.id === id))) return false;
  const total = sumUnits(ctx, located, energyIds, statics);
  if (total < cost) return false;
  return energyIds.every((id) => total - sumUnits(ctx, located, [id], statics) < cost);
}

function costsPayable(ctx: Readable, player: PlayerId, located: Located | null, costs: readonly AdditionalCost[], energyIds: readonly string[], handIds: readonly string[], excludeHandCard?: string): boolean {
  let energyNeed = 0;
  let handNeed = 0;
  for (const cost of costs) {
    if (cost.type === 'DISCARD_ENERGY') {
      if (!located) return false;
      const eligible = located.entity.energies.filter((e) => cost.energyType === 'ANY' || e.type === cost.energyType).map((e) => e.id);
      const chosen = energyIds.filter((id) => eligible.includes(id));
      if (chosen.length < cost.count) return false;
      energyNeed += cost.count;
    } else {
      const hand = ctx.s.players[player].hand.filter((id) => id !== excludeHandCard && matchesCardFilter(ctx, id, cost.filter));
      const chosen = handIds.filter((id) => hand.includes(id));
      if (chosen.length < cost.count) return false;
      handNeed += cost.count;
    }
  }
  return energyIds.length === energyNeed && handIds.length === handNeed && new Set(energyIds).size === energyIds.length && new Set(handIds).size === handIds.length;
}

function blocksFeasible(ctx: Readable, player: PlayerId, selfEntityId: string | null, blocks: readonly { operation: Parameters<typeof canProduceEffect>[3]; failurePolicy?: string; condition?: unknown }[], defaultPolicy: string): boolean {
  return blocks.every((block) => {
    const policy = block.failurePolicy ?? defaultPolicy;
    if (policy === 'BEST_EFFORT' || block.condition) return true;
    return canProduceEffect(ctx, player, selfEntityId, block.operation, policy === 'REQUIRE_ALL');
  });
}

export function validateDecisionAnswer(ctx: Readable, decision: Decision, selection: readonly string[]): Validation {
  if (new Set(selection).size !== selection.length) return fail('INVALID_TARGET', 'seleção repetida');
  if (selection.some((id) => !decision.options.includes(id))) return fail('INVALID_TARGET', 'opção inexistente');
  if (decision.kind === 'SETUP') {
    if (selection.length < 1 || selection.length > 1 + ctx.s.config.benchSlots) return fail('INVALID_TARGET', 'preparação inválida');
    return OK;
  }
  if (decision.kind === 'ORDER_TOP' && selection.length !== decision.options.length) return fail('INVALID_TARGET', 'ordem incompleta');
  if (selection.length < decision.min || selection.length > decision.max) return fail('INVALID_TARGET', 'quantidade de escolhas inválida');
  return OK;
}

/** Ataques que o Ativo pode usar: os da carta do topo e, com a regra concedida, os das evoluções anteriores (Luz da Memória). */
export function usableAttacks(ctx: Readable, located: Located, statics?: StaticEffect[]): { cardId: string; attack: Attack; previous: boolean }[] {
  const stack = located.entity.stack;
  const top = stack[stack.length - 1]!;
  const out = cardDef(ctx, top).attacks.map((attack) => ({ cardId: top, attack, previous: false }));
  if (stack.length > 1 && hasGrant(ctx, located.entity.entityId, 'PREVIOUS_EVOLUTION_ATTACKS', statics)) {
    for (const cardId of stack.slice(0, -1)) {
      const def = cardDef(ctx, cardId);
      if (!isPokemon(def)) continue;
      for (const attack of def.attacks) out.push({ cardId, attack, previous: true });
    }
  }
  return out;
}

/** Custo efetivo do ataque, com o custo alternativo quando a condição dele vale e é mais barato de pagar. */
function payableCost(ctx: Readable, located: Located, attack: Attack, player: PlayerId, statics: StaticEffect[]): boolean {
  const units = providedUnits(ctx, located.entity, statics);
  if (canPay(units, effectiveAttackCost(ctx, located.entity, attack.id, attack.energyCost, statics))) return true;
  const alt = attack.alternativeCost;
  return !!alt && evaluateCondition(ctx, alt.condition, sc(player, located.entity.entityId))
    && canPay(units, effectiveAttackCost(ctx, located.entity, attack.id, alt.energyCost, statics));
}

export function validateAction(ctx: Readable, action: Action): Validation {
  const s = ctx.s;
  if (s.result) return fail('MATCH_ALREADY_FINISHED');
  if (action.type === 'CONCEDE') return OK;
  if (action.type === 'RESOLVE_DECISION') {
    const decision = s.pendingDecisions.find((d) => d.decisionId === action.decisionId);
    if (!decision) return fail('STATE_VERSION_MISMATCH', 'decisão inexistente');
    if (decision.player !== action.player) return fail('NOT_YOUR_TURN', 'decisão de outro participante');
    if (decision.answered) return fail('TRANSACTION_ALREADY_PROCESSED');
    return validateDecisionAnswer(ctx, decision, action.selection);
  }
  if (s.pendingDecisions.length > 0) return fail('PENDING_DECISION');
  if (s.phase !== 'MAIN' || s.queue.length > 0) return fail('NOT_YOUR_TURN', 'fora da fase principal');
  if (s.currentPlayer !== action.player) return fail('NOT_YOUR_TURN');
  const player = action.player;
  const p = s.players[player];
  const statics = collectStatics(ctx);
  switch (action.type) {
    case 'END_TURN': return OK;
    case 'PLAY_BASIC': {
      if (!p.hand.includes(action.cardId)) return fail('CARD_NOT_IN_HAND');
      const def = cardDef(ctx, action.cardId);
      if (!isPokemon(def) || def.stage !== 'BASIC') return fail('INVALID_TARGET', 'não é Básico');
      if (firstFreeBench(p) < 0) return fail('BENCH_FULL');
      if (action.benchIndex < 0 || action.benchIndex >= ctx.s.config.benchSlots || p.bench[action.benchIndex]) return fail('INVALID_TARGET', 'posição do Banco ocupada');
      return OK;
    }
    case 'EVOLVE': {
      if (!p.hand.includes(action.cardId)) return fail('CARD_NOT_IN_HAND');
      const evo = cardDef(ctx, action.cardId);
      if (!isPokemon(evo) || evo.stage === 'BASIC') return fail('INVALID_TARGET', 'não é evolução');
      const target = owned(s, player, action.targetEntityId);
      if (!target) return fail('INVALID_TARGET');
      const base = entityDef(ctx, target.entity);
      // Evoluir “como” outra chave (Eevee ex evolui como Eevee).
      const keys = [base.deckLimitKey, ...evolvesAsKeys(ctx, target.entity.entityId, statics)];
      if (!evo.evolvesFrom.some((k) => keys.includes(k))) return fail('INVALID_TARGET', 'evolução incompatível');
      if (isRestricted(ctx, target, 'EVOLVE', statics)) return fail('SPECIAL_CONDITION_BLOCKS_ACTION', 'evolução bloqueada');
      // Eevee (Evolução Impulsionada): no Ativo, evolui no primeiro turno ou no turno em que foi jogado.
      const anyTurn = hasGrant(ctx, target.entity.entityId, 'EVOLVE_ANY_TURN', statics);
      if (!anyTurn && isFirstOwnTurn(ctx, player)) return fail('EVOLUTION_TOO_EARLY', 'primeiro turno próprio');
      if (!anyTurn && target.entity.enteredPlayOnTurn >= s.globalTurnNumber) return fail('EVOLUTION_TOO_EARLY', 'entrou neste turno');
      if (target.entity.lastEvolvedOnTurn >= s.globalTurnNumber) return fail('EVOLUTION_TOO_EARLY', 'já evoluiu neste turno');
      return OK;
    }
    case 'ATTACH_ENERGY': {
      if (!p.energyZone.ready) return fail('INSUFFICIENT_ENERGY', 'sem Energia pronta');
      if (p.flags.manualEnergyUsed) return fail('MANUAL_ENERGY_ALREADY_USED');
      if (isPlayerRestricted(ctx, player, 'MANUAL_ENERGY', statics)) return fail('SPECIAL_CONDITION_BLOCKS_ACTION');
      const target = owned(s, player, action.targetEntityId);
      if (!target || isFossil(entityDef(ctx, target.entity))) return fail('INVALID_TARGET');
      if (isRestricted(ctx, target, 'RECEIVE_ZONE_ENERGY', statics)) return fail('SPECIAL_CONDITION_BLOCKS_ACTION', 'não pode receber Energia da Zona');
      return OK;
    }
    case 'PLAY_TRAINER': {
      if (!p.hand.includes(action.cardId)) return fail('CARD_NOT_IN_HAND');
      const def = cardDef(ctx, action.cardId);
      if (def.category !== 'TRAINER') return fail('INVALID_TARGET', 'não é Treinador');
      const rules = def.trainerRules;
      if (def.subtype === 'SUPPORTER') {
        if (p.flags.supporterUsed) return fail('SUPPORTER_ALREADY_USED');
        if (isPlayerRestricted(ctx, player, 'PLAY_SUPPORTER', statics)) return fail('SPECIAL_CONDITION_BLOCKS_ACTION');
      }
      if (def.subtype === 'ITEM' && isPlayerRestricted(ctx, player, 'PLAY_ITEM', statics)) return fail('SPECIAL_CONDITION_BLOCKS_ACTION');
      if (def.subtype === 'TOOL') {
        const target = action.targetEntityId ? owned(s, player, action.targetEntityId) : null;
        if (!target) return fail('INVALID_TARGET', 'Ferramenta exige alvo');
        if (target.entity.toolCardId) return fail('TOOL_ALREADY_ATTACHED');
        if (isFossil(entityDef(ctx, target.entity))) return fail('INVALID_TARGET');
        if (rules.toolTarget && !matchesPokemonFilter(ctx, target, rules.toolTarget, sc(player, null))) return fail('INVALID_TARGET');
      }
      if (def.subtype === 'STADIUM') {
        if (p.flags.stadiumPlayed) return fail('STADIUM_ALREADY_PLAYED');
        if (s.stadium && cardDef(ctx, s.stadium.cardId).deckLimitKey === def.deckLimitKey) return fail('STADIUM_SAME_NAME');
      }
      if (rules.destinationAfterPlay === 'BENCH_AS_POKEMON' && firstFreeBench(p) < 0) return fail('BENCH_FULL');
      if (!rules.playConditions.every((c) => evaluateCondition(ctx, c, sc(player, null)))) return fail('CARD_PRECONDITION_FAILED');
      const selfId = def.subtype === 'TOOL' ? action.targetEntityId ?? null : null;
      const onPlay = def.trainerEffects.filter((b) => b.timing === 'ON_PLAY');
      if (!blocksFeasible(ctx, player, selfId, onPlay, 'REQUIRE_ANY')) return fail('CARD_PRECONDITION_FAILED', 'efeito sem alvo possível');
      return OK;
    }
    case 'USE_ABILITY': {
      const located = owned(s, player, action.entityId);
      if (!located) return fail('INVALID_TARGET');
      const ability = entityDef(ctx, located.entity).abilities.find((a) => a.id === action.abilityId);
      if (!ability || ability.kind !== 'ACTIVATED') return fail('INVALID_TARGET', 'Habilidade não ativável');
      if (!ability.sourcePositions.includes(located.position)) return fail('INVALID_TARGET', 'posição da fonte');
      if (isAbilitySuppressed(ctx, located.entity.entityId)) return fail('ABILITY_SUPPRESSED');
      if (isRestricted(ctx, located, 'USE_ABILITY', statics)) return fail('SPECIAL_CONDITION_BLOCKS_ACTION');
      if (!abilityUsageAvailable(ctx as Ctx, player, located.entity.entityId, located.entity.stack[located.entity.stack.length - 1]!, ability)) return fail('ABILITY_ALREADY_USED');
      if (!ability.conditions.every((c) => evaluateCondition(ctx, c, sc(player, located.entity.entityId)))) return fail('CARD_PRECONDITION_FAILED');
      if (ability.costs.length && !costsPayable(ctx, player, located, ability.costs, defaultCostEnergies(ctx, located, ability.costs), defaultCostHand(ctx, player, ability.costs))) return fail('INSUFFICIENT_ENERGY');
      if (!blocksFeasible(ctx, player, located.entity.entityId, ability.effects, 'BEST_EFFORT')) return fail('CARD_PRECONDITION_FAILED');
      return OK;
    }
    case 'RETREAT': {
      const active = p.active;
      if (!active) return fail('INVALID_TARGET');
      const located = locate(s, active.entityId)!;
      if (p.flags.retreatUsed) return fail('RETREAT_ALREADY_USED');
      if (active.conditions.control === 'ASLEEP' || active.conditions.control === 'PARALYZED') return fail('SPECIAL_CONDITION_BLOCKS_ACTION');
      if (isRestricted(ctx, located, 'RETREAT', statics)) return fail('SPECIAL_CONDITION_BLOCKS_ACTION');
      const cost = retreatCost(ctx, active, statics);
      if (cost === null) return fail('INVALID_TARGET', 'Fóssil não recua');
      if (!p.bench[action.benchIndex]) return fail('INVALID_TARGET', 'Banco vazio');
      if (cost === 0 ? action.energyIds.length !== 0 : !minimalPayment(ctx, located, action.energyIds, cost, statics)) return fail('INSUFFICIENT_ENERGY', 'pagamento de Recuo inválido');
      return OK;
    }
    case 'ATTACK': {
      const active = p.active;
      if (!active) return fail('INVALID_TARGET');
      const located = locate(s, active.entityId)!;
      const def = entityDef(ctx, active);
      if (!isPokemon(def)) return fail('INVALID_TARGET', 'Fóssil não ataca');
      const option = usableAttacks(ctx, located, statics).find((o) => o.attack.id === action.attackId && (action.sourceCardId ? o.cardId === action.sourceCardId : !o.previous));
      if (!option) return fail('INVALID_TARGET', 'ataque inexistente');
      const attack = option.attack;
      if (active.conditions.control === 'ASLEEP' || active.conditions.control === 'PARALYZED') return fail('SPECIAL_CONDITION_BLOCKS_ACTION');
      if (isRestricted(ctx, located, 'ATTACK', statics, attack.id)) return fail('SPECIAL_CONDITION_BLOCKS_ACTION');
      if (!payableCost(ctx, located, attack, player, statics)) return fail('INSUFFICIENT_ENERGY');
      if (!attack.preconditions.every((c) => evaluateCondition(ctx, c, sc(player, active.entityId)))) return fail('CARD_PRECONDITION_FAILED');
      if (attack.additionalCosts.length && !costsPayable(ctx, player, located, attack.additionalCosts, action.costEnergyIds ?? [], action.costHandCardIds ?? [])) return fail('ADDITIONAL_COST_INVALID');
      if (!attack.additionalCosts.length && ((action.costEnergyIds?.length ?? 0) > 0 || (action.costHandCardIds?.length ?? 0) > 0)) return fail('ADDITIONAL_COST_INVALID');
      return OK;
    }
    case 'DISCARD_FOSSIL': {
      const located = owned(s, player, action.entityId);
      if (!located) return fail('INVALID_TARGET');
      const def = entityDef(ctx, located.entity);
      if (!isFossil(def) || def.category !== 'TRAINER' || !def.trainerRules.fieldBehavior?.ownerMayDiscardDuringMainPhase) return fail('INVALID_TARGET');
      return OK;
    }
    default:
      return fail('INVALID_ACTION');
  }
}

function defaultCostEnergies(ctx: Readable, located: Located, costs: readonly AdditionalCost[]): string[] {
  const out: string[] = [];
  for (const cost of costs) {
    if (cost.type !== 'DISCARD_ENERGY') continue;
    out.push(...located.entity.energies.filter((e) => (cost.energyType === 'ANY' || e.type === cost.energyType) && !out.includes(e.id)).slice(0, cost.count).map((e) => e.id));
  }
  void ctx;
  return out;
}

function defaultCostHand(ctx: Readable, player: PlayerId, costs: readonly AdditionalCost[]): string[] {
  const out: string[] = [];
  for (const cost of costs) {
    if (cost.type !== 'DISCARD_HAND_CARDS') continue;
    out.push(...ctx.s.players[player].hand.filter((id) => matchesCardFilter(ctx, id, cost.filter) && !out.includes(id)).slice(0, cost.count));
  }
  return out;
}

/** Aplica uma ação já validada sobre o rascunho e processa a fila até a próxima espera. */
export function applyValidAction(ctx: Ctx, action: Action): void {
  const s = ctx.s;
  newGroup(ctx);
  switch (action.type) {
    case 'CONCEDE': {
      emit(ctx, 'PLAYER_CONCEDED', { player: action.player });
      finishMatch(ctx, { outcome: 'WIN', winner: other(action.player), reason: 'CONCEDE', points: { A: s.players.A.points, B: s.players.B.points }, globalTurnNumber: s.globalTurnNumber });
      return;
    }
    case 'RESOLVE_DECISION': {
      const decision = s.pendingDecisions.find((d) => d.decisionId === action.decisionId)!;
      decision.answered = [...action.selection];
      emit(ctx, 'DECISION_RESOLVED', { decisionId: decision.decisionId, player: decision.player, kind: decision.kind, selection: [...action.selection] },
        { visibility: decision.simultaneousGroup || decision.kind === 'SELECT_CARDS' || decision.kind === 'ORDER_TOP' ? 'OWNER' : 'PUBLIC', owner: decision.player, secretFields: ['selection'], triggerable: false });
      const group = decision.simultaneousGroup ? s.pendingDecisions.filter((d) => d.simultaneousGroup === decision.simultaneousGroup) : [decision];
      if (group.some((d) => !d.answered)) return;
      const task = s.queue[0] as Task & { choices?: Record<string, readonly string[]> };
      for (const d of group) if (task && 'choices' in task && task.choices) task.choices[d.choiceKey] = d.answered!;
      s.pendingDecisions = s.pendingDecisions.filter((d) => !group.includes(d));
      runQueue(ctx);
      return;
    }
    case 'END_TURN':
      emit(ctx, 'END_TURN_REQUESTED', { player: action.player }, { triggerable: false });
      s.queue.push({ kind: 'END_TURN' });
      runQueue(ctx);
      return;
    case 'PLAY_BASIC': {
      const p = s.players[action.player];
      removeFromArray(p.hand, action.cardId);
      const entity = newEntity(ctx, action.player, action.cardId);
      p.bench[action.benchIndex] = entity;
      s.stats[action.player].benchPlacements += 1;
      emit(ctx, 'POKEMON_ENTERED', { player: action.player, entityId: entity.entityId, cardId: action.cardId, from: 'HAND', position: 'BENCH', benchIndex: action.benchIndex });
      settle(ctx);
      return;
    }
    case 'EVOLVE': {
      evolveEntity(ctx, action.targetEntityId, action.cardId, action.player, false);
      settle(ctx);
      return;
    }
    case 'ATTACH_ENERGY': {
      const p = s.players[action.player];
      const type = p.energyZone.ready!;
      p.energyZone.ready = null;
      p.flags.manualEnergyUsed = true;
      s.stats[action.player].manualEnergy += 1;
      attachEnergyUnits(ctx, action.targetEntityId, [{ id: nextId(ctx, 'energy', 'en'), type }], 'ENERGY_ZONE', 'MANUAL', action.player);
      settle(ctx);
      return;
    }
    case 'PLAY_TRAINER': {
      playTrainer(ctx, action);
      return;
    }
    case 'USE_ABILITY': {
      const located = locate(s, action.entityId)!;
      const cardId = located.entity.stack[located.entity.stack.length - 1]!;
      const ability = entityDef(ctx, located.entity).abilities.find((a) => a.id === action.abilityId)!;
      consumeAbilityUsage(ctx, action.player, located.entity.entityId, cardId, ability);
      s.stats[action.player].activatedAbilities += 1;
      payCosts(ctx, action.player, located, ability.costs, defaultCostEnergies(ctx, located, ability.costs), defaultCostHand(ctx, action.player, ability.costs));
      const frame = createFrame(ctx, {
        controller: action.player, sourceKind: 'ABILITY', sourceCardId: cardId, sourceEntityId: located.entity.entityId,
        attackId: null, abilityId: ability.id, eventSourceEntityId: null, eventTargetEntityId: null, attackTargetEntityId: null, depth: 0,
      });
      emit(ctx, 'ABILITY_ACTIVATED', { player: action.player, entityId: located.entity.entityId, cardId, abilityId: ability.id, endsTurn: ability.endsTurn });
      s.queue.push(...ability.effects.filter((b) => b.timing === 'ON_ACTIVATE').map((b) => blockTask(frame.frameId, b)), { kind: 'FRAME_END', frameId: frame.frameId, endsTurn: ability.endsTurn });
      runQueue(ctx);
      return;
    }
    case 'RETREAT': {
      const p = s.players[action.player];
      const active = p.active!;
      if (action.energyIds.length) discardEnergyUnits(ctx, active.entityId, action.energyIds, 'RETREAT_COST');
      p.flags.retreatUsed = true;
      s.stats[action.player].retreats += 1;
      swapActive(ctx, action.player, action.benchIndex, 'RETREAT', action.player);
      settle(ctx);
      return;
    }
    case 'ATTACK': {
      declareAttack(ctx, action);
      return;
    }
    case 'DISCARD_FOSSIL': {
      const located = detachEntity(ctx, action.entityId);
      emit(ctx, 'POKEMON_REMOVED', { player: action.player, entityId: action.entityId, destination: 'DISCARD', by: action.player, reason: 'FOSSIL_DISCARDED' });
      routeEntityCards(ctx, located, 'DISCARD');
      s.queue.push({ kind: 'KO_CHECK' });
      runQueue(ctx);
      return;
    }
    default:
      throw new Error('ação desconhecida');
  }
}

/** Ações instantâneas: gatilhos coletados pela ação entram antes de uma checagem de Nocaute. */
function settle(ctx: Ctx): void {
  ctx.s.queue.push({ kind: 'KO_CHECK' });
  runQueue(ctx);
}

function payCosts(ctx: Ctx, player: PlayerId, located: Located | null, costs: readonly AdditionalCost[], energyIds: readonly string[], handIds: readonly string[]): void {
  if (!costs.length) return;
  if (located && energyIds.length) discardEnergyUnits(ctx, located.entity.entityId, energyIds, 'ADDITIONAL_COST');
  if (handIds.length) discardFromHand(ctx, player, handIds, 'ADDITIONAL_COST');
}

function playTrainer(ctx: Ctx, action: Extract<Action, { type: 'PLAY_TRAINER' }>): void {
  const s = ctx.s;
  const p = s.players[action.player];
  const def = cardDef(ctx, action.cardId);
  if (def.category !== 'TRAINER') return;
  removeFromArray(p.hand, action.cardId);
  const stats = s.stats[action.player];
  if (!stats.playedSubtypes.includes(def.subtype)) stats.playedSubtypes.push(def.subtype);
  emit(ctx, 'TRAINER_PLAYED', { player: action.player, cardId: action.cardId, subtype: def.subtype, fossil: isFossil(def) });
  if (def.subtype === 'SUPPORTER') p.flags.supporterUsed = true;
  const rules = def.trainerRules;
  let selfEntityId: string | null = null;
  let sourceKind: 'TRAINER' | 'TOOL' | 'STADIUM' = 'TRAINER';
  if (rules.destinationAfterPlay === 'ATTACHED_TOOL') {
    const target = locate(s, action.targetEntityId!)!;
    target.entity.toolCardId = action.cardId;
    selfEntityId = target.entity.entityId;
    sourceKind = 'TOOL';
    stats.toolsAttached += 1;
    emit(ctx, 'TOOL_ATTACHED', { player: action.player, entityId: target.entity.entityId, cardId: action.cardId });
  } else if (rules.destinationAfterPlay === 'STADIUM_SLOT') {
    p.flags.stadiumPlayed = true;
    sourceKind = 'STADIUM';
    stadiumOwnerChange(ctx, action.cardId, action.player);
  } else if (rules.destinationAfterPlay === 'BENCH_AS_POKEMON') {
    const index = action.benchIndex !== undefined && !p.bench[action.benchIndex] ? action.benchIndex : firstFreeBench(p);
    const entity = newEntity(ctx, action.player, action.cardId);
    p.bench[index] = entity;
    selfEntityId = entity.entityId;
    emit(ctx, 'POKEMON_ENTERED', { player: action.player, entityId: entity.entityId, cardId: action.cardId, from: 'HAND', position: 'BENCH', benchIndex: index, fossil: true });
  }
  const frame = createFrame(ctx, {
    controller: action.player, sourceKind, sourceCardId: action.cardId, sourceEntityId: selfEntityId,
    attackId: null, abilityId: null, eventSourceEntityId: null, eventTargetEntityId: null, attackTargetEntityId: null, depth: 0,
  });
  const onPlay = def.trainerEffects.filter((b) => b.timing === 'ON_PLAY');
  s.queue.push(...onPlay.map((b) => blockTask(frame.frameId, b, 'REQUIRE_ANY')), { kind: 'FRAME_END', frameId: frame.frameId, endsTurn: false });
  runQueue(ctx);
}

function declareAttack(ctx: Ctx, action: Extract<Action, { type: 'ATTACK' }>): void {
  const s = ctx.s;
  const p = s.players[action.player];
  const active = p.active!;
  const located = locate(s, active.entityId)!;
  const cardId = action.sourceCardId ?? active.stack[active.stack.length - 1]!;
  const attack = cardDef(ctx, cardId).attacks.find((a) => a.id === action.attackId)!;
  payCosts(ctx, action.player, located, attack.additionalCosts, action.costEnergyIds ?? [], action.costHandCardIds ?? []);
  (p.attackLog ??= []).push({ ownTurn: s.ownTurns[action.player], attackId: attack.id });
  const defender = s.players[other(action.player)].active;
  const frame = createFrame(ctx, {
    controller: action.player, sourceKind: 'ATTACK', sourceCardId: cardId, sourceEntityId: active.entityId,
    attackId: attack.id, abilityId: null, eventSourceEntityId: null, eventTargetEntityId: defender?.entityId ?? null,
    attackTargetEntityId: defender?.entityId ?? null, depth: 0,
  });
  emit(ctx, 'ATTACK_DECLARED', { player: action.player, entityId: active.entityId, cardId, attackId: attack.id, attackName: attack.name, targetEntityId: defender?.entityId ?? null });
  const tasks: Task[] = [];
  if (active.conditions.control === 'CONFUSED') tasks.push({ kind: 'CONFUSION_CHECK', frameId: frame.frameId });
  // Smokescreen/Octazooka: uma moeda só, mesmo com vários efeitos (não acumulam).
  if (staticsOn(ctx, active.entityId, 'ATTACK_COIN_GATE').length > 0) tasks.push({ kind: 'COIN_GATE', frameId: frame.frameId });
  tasks.push(...attack.effects.filter((b) => b.timing === 'PRE_DAMAGE').map((b) => blockTask(frame.frameId, b)));
  tasks.push({ kind: 'MAIN_DAMAGE', frameId: frame.frameId, choices: {} });
  tasks.push(...attack.effects.filter((b) => b.timing === 'POST_DAMAGE').map((b) => blockTask(frame.frameId, b)));
  tasks.push({ kind: 'FRAME_END', frameId: frame.frameId, endsTurn: attack.endsTurn });
  s.queue.push(...tasks);
  runQueue(ctx);
}

// ---------------------------------------------------------------- enumeração de ações legais

function energySubsets(ids: readonly string[], types: readonly string[]): string[][] {
  const out: string[][] = [];
  const seen = new Set<string>();
  const n = ids.length;
  for (let mask = 1; mask < 1 << n && mask < 4096; mask += 1) {
    const subset = ids.filter((_, i) => mask & (1 << i));
    const signature = subset.map((id) => types[ids.indexOf(id)]).sort().join(',');
    if (seen.has(signature)) continue;
    seen.add(signature);
    out.push(subset);
  }
  return out;
}

export function enumerateCandidateActions(ctx: Readable, player: PlayerId): Action[] {
  const s = ctx.s;
  const out: Action[] = [];
  if (s.result) return out;
  for (const d of s.pendingDecisions) {
    if (d.player !== player || d.answered) continue;
    for (const selection of decisionAnswers(d)) out.push({ type: 'RESOLVE_DECISION', player, decisionId: d.decisionId, selection });
  }
  if (s.pendingDecisions.length > 0 || s.phase !== 'MAIN' || s.currentPlayer !== player || s.queue.length > 0) return out;
  const p = s.players[player];
  const mine = entitiesOf(s, player);
  const free = firstFreeBench(p);
  const seenCards = new Set<string>();
  for (const cardId of p.hand) {
    const def = cardDef(ctx, cardId);
    // Cópias idênticas na mão geram as mesmas ações; enumera uma vez por definição/impressão.
    const signature = s.cards[cardId]!.printingId;
    if (seenCards.has(signature)) continue;
    seenCards.add(signature);
    if (isPokemon(def)) {
      if (def.stage === 'BASIC' && free >= 0) out.push({ type: 'PLAY_BASIC', player, cardId, benchIndex: free });
      else for (const l of mine) out.push({ type: 'EVOLVE', player, cardId, targetEntityId: l.entity.entityId });
    } else if (def.subtype === 'TOOL') {
      for (const l of mine) out.push({ type: 'PLAY_TRAINER', player, cardId, targetEntityId: l.entity.entityId });
    } else {
      out.push({ type: 'PLAY_TRAINER', player, cardId });
    }
  }
  for (const l of mine) out.push({ type: 'ATTACH_ENERGY', player, targetEntityId: l.entity.entityId });
  for (const l of mine) {
    for (const ability of entityDef(ctx, l.entity).abilities) {
      if (ability.kind === 'ACTIVATED') out.push({ type: 'USE_ABILITY', player, entityId: l.entity.entityId, abilityId: ability.id });
    }
    const def = entityDef(ctx, l.entity);
    if (def.category === 'TRAINER' && def.trainerRules.fieldBehavior?.ownerMayDiscardDuringMainPhase) out.push({ type: 'DISCARD_FOSSIL', player, entityId: l.entity.entityId });
  }
  if (p.active) {
    const active = p.active;
    const statics = collectStatics(ctx);
    const cost = retreatCost(ctx, active, statics);
    if (cost !== null) {
      const ids = active.energies.map((e) => e.id);
      const types = active.energies.map((e) => e.type);
      const payments = cost === 0 ? [[]] : energySubsets(ids, types);
      p.bench.forEach((b, index) => {
        if (!b) return;
        for (const energyIds of payments) out.push({ type: 'RETREAT', player, benchIndex: index, energyIds });
      });
    }
    const located = locate(s, active.entityId)!;
    for (const { attack, cardId, previous } of usableAttacks(ctx, located)) {
      const source = previous ? { sourceCardId: cardId } : {};
      if (!attack.additionalCosts.length) { out.push({ type: 'ATTACK', player, attackId: attack.id, ...source }); continue; }
      out.push({ type: 'ATTACK', player, attackId: attack.id, ...source, costEnergyIds: defaultCostEnergies(ctx, located, attack.additionalCosts), costHandCardIds: defaultCostHand(ctx, player, attack.additionalCosts) });
    }
  }
  out.push({ type: 'END_TURN', player });
  return out;
}

export function getLegalActions(ctx: Readable, player: PlayerId): Action[] {
  return enumerateCandidateActions(ctx, player).filter((a) => validateAction(ctx, a).ok);
}

/** Respostas possíveis de uma decisão (limitadas para a IA; a UI apresenta as opções diretamente). */
export function decisionAnswers(d: Decision, limit = 64): string[][] {
  if (d.kind === 'ORDER_TOP') return [ [...d.options] ];
  if (d.kind === 'SETUP') {
    const out: string[][] = [];
    for (const active of d.options) {
      const rest = d.options.filter((o) => o !== active);
      out.push([active, ...rest.slice(0, 3)]);
      out.push([active]);
    }
    return out.slice(0, limit);
  }
  const out: string[][] = [];
  const n = d.options.length;
  const pick = (start: number, acc: string[]) => {
    if (out.length >= limit) return;
    if (acc.length >= d.min && acc.length <= d.max) out.push([...acc]);
    if (acc.length === d.max) return;
    for (let i = start; i < n; i += 1) pick(i + 1, [...acc, d.options[i]!]);
  };
  pick(0, []);
  return out.filter((a) => a.length >= d.min);
}

export type { CostType };
