// Mutações elementares do campo usadas por ações e opcodes: dano, condições, saída de campo,
// movimentação de Energia e troca de Ativo. Cada uma emite os eventos confirmados correspondentes.
import { isPokemon, type SpecialCondition } from '../cards/types.ts';
import { cardDef, coin, emit, entityDef, locate, mustLocate, removeFromArray, type Ctx, type Located } from './core.ts';
import {
  collectStatics, conditionPrevented, damageModifier, effectsPreventedFor, healingPrevented, maxHp, preventionsFor, staticsOn, type StaticEffect,
} from './derived.ts';
import type { EnergyUnit, PlayerId, PokemonEntity } from './types.ts';
import { other } from './types.ts';

export type DamageCategory = 'ATTACK' | 'EFFECT' | 'CONDITION';

export type DamageRequest = {
  readonly sourceEntityId: string | null;
  readonly sourcePlayer: PlayerId | null;
  readonly targetEntityId: string;
  readonly base: number;
  readonly category: DamageCategory;
  readonly applyWeakness: boolean;
  readonly ignoreDefenderModifiers: boolean;
  /** Ataque que causa o dano (modificadores de um ataque específico). */
  readonly attackId?: string | null;
  /** Ignora modificadores e prevenções no alvo (Punho Chakra do Mega Medicham ex); Fraqueza ainda vale. */
  readonly ignoreDefenderEffects?: boolean;
};

export type DamageBreakdown = {
  base: number;
  attackerBonus: number;
  weakness: number;
  defenderModifier: number;
  prevented: number;
  final: number;
};

/** Pipeline de dano (efeitos-dsl.md §13.1; gameplay §12.4): base → atacante → Fraqueza → defensor → piso 0 → prevenção. */
export function computeDamage(ctx: Ctx, req: DamageRequest, statics: StaticEffect[]): DamageBreakdown & { preventing: StaticEffect[] } {
  const target = mustLocate(ctx.s, req.targetEntityId);
  const b: DamageBreakdown = { base: Math.max(0, req.base), attackerBonus: 0, weakness: 0, defenderModifier: 0, prevented: 0, final: 0 };
  let amount = b.base;
  const targetIsOpponentActive = !!req.sourcePlayer && target.player !== req.sourcePlayer && target.position === 'ACTIVE';
  const dc = { attackId: req.attackId ?? null, attackerEntityId: req.sourceEntityId, targetEntityId: req.targetEntityId };
  if (amount > 0 && req.sourceEntityId && req.category !== 'CONDITION' && locate(ctx.s, req.sourceEntityId)) {
    b.attackerBonus = damageModifier(ctx, req.sourceEntityId, 'DAMAGE_DEALT', req.category === 'ATTACK' ? 'ATTACK' : 'EFFECT', targetIsOpponentActive, statics, dc);
    amount = Math.max(0, amount + b.attackerBonus);
  }
  if (amount > 0 && req.applyWeakness && targetIsOpponentActive && req.sourceEntityId) {
    const attacker = locate(ctx.s, req.sourceEntityId);
    const targetDef = entityDef(ctx, target.entity);
    const attackerDef = attacker ? entityDef(ctx, attacker.entity) : null;
    if (attackerDef && isPokemon(attackerDef) && isPokemon(targetDef) && targetDef.weakness
      && attackerDef.types.includes(targetDef.weakness.type)) {
      const w = targetDef.weakness;
      const after = w.operation === 'ADD' ? amount + w.value : amount * w.value;
      b.weakness = after - amount;
      amount = after;
    }
  }
  if (!req.ignoreDefenderModifiers && !req.ignoreDefenderEffects && req.category !== 'CONDITION') {
    b.defenderModifier = damageModifier(ctx, req.targetEntityId, 'DAMAGE_TAKEN', req.category === 'ATTACK' ? 'ATTACK' : 'EFFECT', false, statics, dc);
    amount += b.defenderModifier;
  }
  amount = Math.max(0, amount);
  // Prevenção com moeda (Togekiss, Bastiodon) só se decide em applyDamage (consome RNG).
  const preventing = amount > 0 && !req.ignoreDefenderEffects
    ? preventionsFor(ctx, req.targetEntityId, req.category, statics, req.sourceEntityId).filter((p) => !(p.operation.type === 'PREVENT_DAMAGE' && p.operation.coinFlip))
    : [];
  for (const p of preventing) {
    if (amount <= 0) break;
    const op = p.operation;
    if (op.type !== 'PREVENT_DAMAGE') continue;
    const cut = op.amount === 'ALL' ? amount : Math.min(amount, op.amount);
    amount -= cut;
    b.prevented += cut;
  }
  b.final = Math.max(0, amount);
  return { ...b, preventing };
}

export function applyDamage(ctx: Ctx, req: DamageRequest, statics?: StaticEffect[]): number {
  const list = statics ?? collectStatics(ctx);
  const result = computeDamage(ctx, req, list);
  const victim = mustLocate(ctx.s, req.targetEntityId);
  // Prevenção com moeda: o dono do alvo joga uma moeda por efeito; cara = previne (tudo ou a quantidade).
  if (result.final > 0 && !req.ignoreDefenderEffects) {
    for (const p of preventionsFor(ctx, req.targetEntityId, req.category, list, req.sourceEntityId)) {
      const op = p.operation;
      if (op.type !== 'PREVENT_DAMAGE' || !op.coinFlip || result.final <= 0) continue;
      const face = coin(ctx);
      emit(ctx, 'COIN_RESOLVED', { player: victim.player, reason: 'DAMAGE_PREVENTION', results: [face], entityId: req.targetEntityId });
      if (face !== 'HEADS') continue;
      const cut = op.amount === 'ALL' ? result.final : Math.min(result.final, op.amount);
      result.final -= cut;
      result.prevented += cut;
    }
  }
  // Sobreviver ao Nocaute (Garra de Conkeldurr): dano de ataque que Nocautearia → moeda; cara = fica com N PS.
  if (result.final > 0 && req.category === 'ATTACK') {
    const hp = maxHp(ctx, victim.entity, list);
    if (victim.entity.damage + result.final >= hp) {
      for (const sv of staticsOn(ctx, req.targetEntityId, 'SURVIVE_KNOCKOUT', list)) {
        if (sv.operation.type !== 'SURVIVE_KNOCKOUT') continue;
        const face = coin(ctx);
        emit(ctx, 'COIN_RESOLVED', { player: victim.player, reason: 'SURVIVE_KNOCKOUT', results: [face], entityId: req.targetEntityId });
        if (face === 'HEADS') {
          const cap = Math.max(0, hp - sv.operation.remainingHp - victim.entity.damage);
          result.prevented += result.final - cap;
          result.final = cap;
        }
        break;
      }
    }
  }
  // Consome cargas de prevenções temporárias usadas.
  if (result.prevented > 0) {
    for (const p of result.preventing) {
      if (!p.effectId) continue;
      const eff = ctx.s.activeEffects.find((e) => e.effectId === p.effectId);
      if (eff && eff.charges !== null) {
        eff.charges -= 1;
        if (eff.charges <= 0) ctx.s.activeEffects = ctx.s.activeEffects.filter((e) => e.effectId !== eff.effectId);
      }
    }
    emit(ctx, 'DAMAGE_PREVENTED', { targetEntityId: req.targetEntityId, sourceEntityId: req.sourceEntityId, category: req.category, prevented: result.prevented });
  }
  if (result.final <= 0) return 0;
  const target = victim;
  target.entity.damage += result.final;
  target.entity.lastDamage = { category: req.category, sourceEntityId: req.sourceEntityId, sourcePlayer: req.sourcePlayer, turn: ctx.s.globalTurnNumber };
  if (req.category === 'ATTACK' && target.position === 'ACTIVE') target.entity.damagedByAttackOnTurn = ctx.s.globalTurnNumber;
  const breakdown: DamageBreakdown = {
    base: result.base, attackerBonus: result.attackerBonus, weakness: result.weakness,
    defenderModifier: result.defenderModifier, prevented: result.prevented, final: result.final,
  };
  emit(ctx, 'DAMAGE_APPLIED', {
    sourceEntityId: req.sourceEntityId, sourcePlayer: req.sourcePlayer, targetEntityId: req.targetEntityId, targetPlayer: target.player,
    amount: result.final, category: req.category, breakdown, damageTotal: target.entity.damage, maxHp: maxHp(ctx, target.entity, list),
  });
  return result.final;
}

export function heal(ctx: Ctx, entityId: string, amount: number | 'ALL'): number {
  const located = mustLocate(ctx.s, entityId);
  if (healingPrevented(ctx, entityId)) return 0;
  const healed = amount === 'ALL' ? located.entity.damage : Math.min(located.entity.damage, Math.max(0, amount));
  if (healed <= 0) return 0;
  located.entity.damage -= healed;
  emit(ctx, 'HEAL_APPLIED', { entityId, player: located.player, amount: healed, damageTotal: located.entity.damage });
  return healed;
}

/** Condições só afetam o Ativo nesta ruleset (gameplay §15, B4). */
export function applyCondition(ctx: Ctx, entityId: string, condition: SpecialCondition, fromPlayer: PlayerId | null, poisonDamage?: number): boolean {
  const located = locate(ctx.s, entityId);
  if (!located || located.position !== 'ACTIVE') return false;
  if (fromPlayer && fromPlayer !== located.player && effectsPreventedFor(ctx, entityId, fromPlayer)) return false;
  if (conditionPrevented(ctx, entityId, condition)) return false;
  const c = located.entity.conditions;
  if (condition === 'POISONED') {
    c.poisoned = true;
    if (poisonDamage !== undefined) c.poisonDamage = Math.max(c.poisonDamage ?? 10, poisonDamage);
  } else if (condition === 'BURNED') c.burned = true;
  else {
    c.control = condition;
    c.paralyzedSinceTurn = condition === 'PARALYZED' ? ctx.s.globalTurnNumber : null;
  }
  emit(ctx, 'CONDITION_APPLIED', { entityId, player: located.player, condition });
  return true;
}

export function clearConditions(ctx: Ctx, entity: PokemonEntity, cause: 'SWITCH' | 'RETREAT' | 'EVOLUTION' | 'EFFECT' | 'LEFT_ACTIVE', actor: PlayerId | null, only?: readonly SpecialCondition[]): SpecialCondition[] {
  const c = entity.conditions;
  const removed: SpecialCondition[] = [];
  const wants = (k: SpecialCondition) => !only || only.includes(k);
  if (c.poisoned && wants('POISONED')) { c.poisoned = false; delete c.poisonDamage; removed.push('POISONED'); }
  if (c.burned && wants('BURNED')) { c.burned = false; removed.push('BURNED'); }
  if (c.control && wants(c.control)) { removed.push(c.control); c.control = null; c.paralyzedSinceTurn = null; }
  for (const condition of removed) emit(ctx, 'CONDITION_REMOVED', { entityId: entity.entityId, player: entity.owner, condition, cause });
  if (removed.length > 0 && actor) {
    const label = cause === 'LEFT_ACTIVE' ? 'SWITCH' : cause;
    if (!ctx.s.stats[actor].conditionRemovedByCause.includes(label)) ctx.s.stats[actor].conditionRemovedByCause.push(label);
  }
  return removed;
}

/** Efeitos temporários e atrasados presos à posição Ativa são removidos quando a entidade sai dela. */
export function onLeaveActive(ctx: Ctx, entity: PokemonEntity, actor: PlayerId | null): void {
  ctx.s.activeEffects = ctx.s.activeEffects.filter((e) => !(e.removeOn.includes('TARGET_LEAVES_ACTIVE') && e.targets?.includes(entity.entityId))
    && !(e.removeOn.includes('SOURCE_LEAVES_ACTIVE') && e.sourceEntityId === entity.entityId));
  const before = ctx.s.delayedEffects.length;
  const removedDelayed = ctx.s.delayedEffects.filter((d) => d.targetEntityId === entity.entityId && d.removeOn.includes('TARGET_LEAVES_ACTIVE'));
  ctx.s.delayedEffects = ctx.s.delayedEffects.filter((d) => !removedDelayed.includes(d));
  for (const d of removedDelayed) {
    emit(ctx, 'DELAYED_EFFECT_REMOVED', { delayedId: d.delayedId, targetEntityId: entity.entityId, cause: 'TARGET_LEFT_ACTIVE' });
    if (actor && actor !== d.controller) ctx.s.stats[actor].delayedPrevented += 1;
  }
  if (before !== ctx.s.delayedEffects.length) return;
}

export function onLeavePlay(ctx: Ctx, entityId: string): void {
  ctx.s.activeEffects = ctx.s.activeEffects.filter((e) => {
    if (e.sourceEntityId === entityId && e.operation.type !== 'MODIFY' && e.removeOn.includes('SOURCE_LEAVES_ACTIVE')) return false;
    if (e.targets && e.targets.includes(entityId)) {
      const remaining = e.targets.filter((t) => t !== entityId);
      if (remaining.length === 0) return false;
      (e as { targets: readonly string[] | null }).targets = remaining;
    }
    return true;
  });
  ctx.s.delayedEffects = ctx.s.delayedEffects.filter((d) => d.targetEntityId !== entityId);
}

export type Swap = { from: Located; to: Located };

/** Troca o Ativo por um Pokémon do Banco (Recuo, troca por efeito ou promoção). */
export function swapActive(ctx: Ctx, player: PlayerId, benchIndex: number, reason: 'RETREAT' | 'SWITCH' | 'PROMOTE', actor: PlayerId | null): void {
  const p = ctx.s.players[player];
  const incoming = p.bench[benchIndex];
  if (!incoming) throw new Error('banco vazio na troca');
  const outgoing = p.active;
  if (outgoing) {
    clearConditions(ctx, outgoing, reason === 'RETREAT' ? 'RETREAT' : 'SWITCH', actor);
    onLeaveActive(ctx, outgoing, actor);
  }
  p.active = incoming;
  p.bench[benchIndex] = outgoing ?? null;
  incoming.movedToActiveOnTurn = ctx.s.globalTurnNumber;
  emit(ctx, 'POKEMON_MOVED', {
    player, reason, entityId: incoming.entityId, from: 'BENCH', to: 'ACTIVE', benchIndex,
    swappedEntityId: outgoing?.entityId ?? null,
  });
}

/** Remove a entidade do campo, devolvendo índice/posição; cartas e anexos são encaminhados pelo chamador. */
export function detachEntity(ctx: Ctx, entityId: string): Located {
  const located = mustLocate(ctx.s, entityId);
  const p = ctx.s.players[located.player];
  if (located.position === 'ACTIVE') p.active = null;
  else p.bench[located.benchIndex!] = null;
  onLeavePlay(ctx, entityId);
  return located;
}

export type Destination = 'DISCARD' | 'HAND' | 'DECK';

/** Encaminha pilha, Ferramenta e Energias de uma entidade removida (gameplay §10.6, §17.8). */
export function routeEntityCards(ctx: Ctx, located: Located, destination: Destination): void {
  const owner = ctx.s.players[located.player];
  const entity = located.entity;
  for (const energy of entity.energies) owner.discardedEnergy.push(energy);
  if (entity.energies.length > 0) emit(ctx, 'ENERGY_DISCARDED', { player: located.player, entityId: entity.entityId, energies: entity.energies.map((e) => ({ id: e.id, type: e.type })), reason: 'LEFT_PLAY' });
  entity.energies = [];
  const cards = [...entity.stack].reverse(); // topo primeiro
  if (entity.toolCardId) cards.push(entity.toolCardId);
  entity.toolCardId = null;
  if (destination === 'DISCARD') {
    owner.discard.push(...cards);
    emit(ctx, 'CARD_DISCARDED', { player: located.player, cardIds: cards, from: 'FIELD' });
  } else if (destination === 'DECK') {
    owner.deck.push(...cards);
    emit(ctx, 'CARD_RETURNED', { player: located.player, cardIds: cards, to: 'DECK' }, { visibility: 'PUBLIC' });
  } else {
    const toHand: string[] = [];
    const toDiscard: string[] = [];
    for (const cardId of cards) {
      if (owner.hand.length + toHand.length < ctx.s.config.maximumHandSize) toHand.push(cardId);
      else toDiscard.push(cardId);
    }
    owner.hand.push(...toHand);
    owner.discard.push(...toDiscard);
    if (toHand.length) emit(ctx, 'CARD_RETURNED', { player: located.player, cardIds: toHand, to: 'HAND' });
    if (toDiscard.length) emit(ctx, 'CARD_DISCARDED', { player: located.player, cardIds: toDiscard, from: 'FIELD', reason: 'HAND_FULL' });
  }
}

export function attachEnergyUnits(ctx: Ctx, entityId: string, units: EnergyUnit[], source: 'ENERGY_ZONE' | 'DISCARD' | 'EFFECT', mode: 'MANUAL' | 'CARD_EFFECT', actor: PlayerId): void {
  const located = mustLocate(ctx.s, entityId);
  for (const unit of units) {
    located.entity.energies.push(unit);
    emit(ctx, 'ENERGY_ATTACHED', { player: located.player, entityId, energyId: unit.id, energyType: unit.type, source, mode });
  }
  const stats = ctx.s.stats[actor];
  stats.maxEnergyOnOnePokemon = Math.max(stats.maxEnergyOnOnePokemon, located.entity.energies.length);
}

export function discardEnergyUnits(ctx: Ctx, entityId: string, energyIds: readonly string[], reason: string): void {
  const located = mustLocate(ctx.s, entityId);
  const removed = located.entity.energies.filter((e) => energyIds.includes(e.id));
  located.entity.energies = located.entity.energies.filter((e) => !energyIds.includes(e.id));
  ctx.s.players[located.player].discardedEnergy.push(...removed);
  if (removed.length) emit(ctx, 'ENERGY_DISCARDED', { player: located.player, entityId, energies: removed.map((e) => ({ id: e.id, type: e.type })), reason });
}

export function discardFromHand(ctx: Ctx, player: PlayerId, cardIds: readonly string[], reason: string): void {
  const p = ctx.s.players[player];
  for (const id of cardIds) if (removeFromArray(p.hand, id)) p.discard.push(id);
  if (cardIds.length) emit(ctx, 'CARD_DISCARDED', { player, cardIds: [...cardIds], from: 'HAND', reason });
}

/** Pokémon protegidos contra Condições Especiais se recuperam delas (Comfey, Avental de Aço). */
export function cleanseProtected(ctx: Ctx): void {
  const statics = collectStatics(ctx);
  for (const player of ['A', 'B'] as const) {
    const active = ctx.s.players[player].active;
    if (!active) continue;
    const c = active.conditions;
    const has: SpecialCondition[] = [...(c.poisoned ? ['POISONED' as const] : []), ...(c.burned ? ['BURNED' as const] : []), ...(c.control ? [c.control] : [])];
    const blocked = has.filter((k) => conditionPrevented(ctx, active.entityId, k, statics));
    if (blocked.length) clearConditions(ctx, active, 'EFFECT', null, blocked);
  }
}

export function stadiumOwnerChange(ctx: Ctx, newCardId: string, owner: PlayerId): void {
  const previous = ctx.s.stadium;
  if (previous) {
    ctx.s.players[previous.owner].discard.push(previous.cardId);
    const prevDef = cardDef(ctx, previous.cardId);
    const newDef = cardDef(ctx, newCardId);
    if (prevDef.deckLimitKey !== newDef.deckLimitKey) {
      ctx.s.stats[owner].stadiumReplacedDifferentName += 1;
      if (prevDef.category === 'TRAINER' && prevDef.trainerEffects.some((b) => b.operation.type === 'MODIFY')) ctx.s.stats[owner].modifierSourcesRemoved += 1;
    }
  }
  ctx.s.stadium = { cardId: newCardId, owner };
  emit(ctx, 'STADIUM_REPLACED', { player: owner, cardId: newCardId, previousCardId: previous?.cardId ?? null, previousOwner: previous?.owner ?? null });
}

export function opponent(player: PlayerId): PlayerId {
  return other(player);
}
