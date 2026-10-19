// Efeitos contínuos e valores derivados (efeitos-dsl.md §14). Nada é gravado como atributo:
// HP máximo, Recuo, custos, fornecimento e pontos são recalculados a cada consulta.
import type { GrantedRule, Operation, PokemonCard, RestrictableAction, EnergyType, CostType, SpecialCondition } from '../cards/types.ts';
import { isFossil, isPokemon } from '../cards/types.ts';
import { allEntities, cardDef, entityDef, locate, topCardId, type Ctx, type Located } from './core.ts';
import { eligible, matchesPokemonFilter, type SelectorContext } from './selectors.ts';
import type { PlayerId, PokemonEntity } from './types.ts';
import { evaluateAmount, evaluateCondition } from './formula.ts';

export type StaticEffect = {
  readonly operation: Operation;
  readonly controller: PlayerId;
  readonly sourceCardId: string;
  readonly sourceEntityId: string | null;
  readonly selfEntityId: string | null;
  readonly fixedTargets: readonly string[] | null;
  readonly origin: 'TEMPORARY' | 'TOOL' | 'STADIUM' | 'ABILITY';
  readonly effectId: string | null;
};

type Readable = Pick<Ctx, 's' | 'cat'>;

const CONTINUOUS_OPS = new Set([
  'MODIFY', 'PREVENT_DAMAGE', 'PREVENT_EFFECTS', 'RESTRICT_ACTION', 'SUPPRESS_ABILITIES', 'PREVENT_CONDITIONS', 'PREVENT_HEALING',
  'ATTACK_COIN_GATE', 'COUNTER_DAMAGE', 'GRANT_RULE', 'SURVIVE_KNOCKOUT', 'REROLL_COINS',
]);

function nonAbilityStatics(ctx: Readable): StaticEffect[] {
  const out: StaticEffect[] = [];
  for (const effect of ctx.s.activeEffects) {
    out.push({
      operation: effect.operation, controller: effect.controller, sourceCardId: effect.sourceCardId,
      sourceEntityId: effect.sourceEntityId, selfEntityId: effect.sourceEntityId, fixedTargets: effect.targets,
      origin: 'TEMPORARY', effectId: effect.effectId,
    });
  }
  for (const located of allEntities(ctx.s)) {
    const toolId = located.entity.toolCardId;
    if (!toolId) continue;
    const tool = cardDef(ctx, toolId);
    if (tool.category !== 'TRAINER') continue;
    for (const block of tool.trainerEffects) {
      if ((block.timing === 'CONTINUOUS' || block.timing === 'REPLACEMENT') && CONTINUOUS_OPS.has(block.operation.type)) {
        out.push({ operation: block.operation, controller: located.player, sourceCardId: toolId, sourceEntityId: located.entity.entityId, selfEntityId: located.entity.entityId, fixedTargets: null, origin: 'TOOL', effectId: null });
      }
    }
  }
  const stadium = ctx.s.stadium;
  if (stadium) {
    const def = cardDef(ctx, stadium.cardId);
    if (def.category === 'TRAINER') {
      for (const block of def.trainerEffects) {
        if ((block.timing === 'CONTINUOUS' || block.timing === 'REPLACEMENT') && CONTINUOUS_OPS.has(block.operation.type)) {
          out.push({ operation: block.operation, controller: stadium.owner, sourceCardId: stadium.cardId, sourceEntityId: null, selfEntityId: null, fixedTargets: null, origin: 'STADIUM', effectId: null });
        }
      }
    }
  }
  return out;
}

export function staticTargets(ctx: Readable, effect: StaticEffect): string[] {
  if (effect.fixedTargets) return effect.fixedTargets.filter((id) => locate(ctx.s, id));
  const op = effect.operation as { target?: Parameters<typeof eligible>[1] };
  if (!op.target) return [];
  const sc: SelectorContext = { controller: effect.controller, selfEntityId: effect.selfEntityId, eventSourceEntityId: null, eventTargetEntityId: null, outputs: {} };
  return eligible(ctx, { ...op.target, pick: { mode: 'ALL' } }, sc).map((l) => l.entity.entityId);
}

export function suppressedEntities(ctx: Readable): Set<string> {
  const suppressed = new Set<string>();
  for (const effect of nonAbilityStatics(ctx)) {
    if (effect.operation.type === 'SUPPRESS_ABILITIES') staticTargets(ctx, effect).forEach((id) => suppressed.add(id));
  }
  // Uma passagem pelas Habilidades contínuas de supressão de entidades não suprimidas.
  for (const effect of abilityStatics(ctx, suppressed)) {
    if (effect.operation.type === 'SUPPRESS_ABILITIES') staticTargets(ctx, effect).forEach((id) => suppressed.add(id));
  }
  return suppressed;
}

function abilityStatics(ctx: Readable, suppressed: Set<string>): StaticEffect[] {
  const out: StaticEffect[] = [];
  for (const located of allEntities(ctx.s)) {
    if (suppressed.has(located.entity.entityId)) continue;
    const def = entityDef(ctx, located.entity);
    for (const ability of def.abilities) {
      if (ability.kind !== 'CONTINUOUS' && ability.kind !== 'REPLACEMENT') continue;
      if (!ability.sourcePositions.includes(located.position)) continue;
      const sc: SelectorContext = { controller: located.player, selfEntityId: located.entity.entityId, eventSourceEntityId: null, eventTargetEntityId: null, outputs: {} };
      if (!ability.conditions.every((c) => evaluateCondition(ctx, c, sc))) continue;
      for (const block of ability.effects) {
        if (!CONTINUOUS_OPS.has(block.operation.type)) continue;
        out.push({ operation: block.operation, controller: located.player, sourceCardId: topCardId(located.entity), sourceEntityId: located.entity.entityId, selfEntityId: located.entity.entityId, fixedTargets: null, origin: 'ABILITY', effectId: null });
      }
    }
  }
  return out;
}

export function collectStatics(ctx: Readable): StaticEffect[] {
  const suppressed = suppressedEntities(ctx);
  return [...nonAbilityStatics(ctx), ...abilityStatics(ctx, suppressed)];
}

const staticContext = (effect: StaticEffect): SelectorContext =>
  ({ controller: effect.controller, selfEntityId: effect.selfEntityId, eventSourceEntityId: null, eventTargetEntityId: null, outputs: {} });

function modifiersFor(ctx: Readable, entityId: string, stat: string, statics?: StaticEffect[]): { effect: StaticEffect; amount: number }[] {
  const list = statics ?? collectStatics(ctx);
  const out: { effect: StaticEffect; amount: number }[] = [];
  const exclusive = new Set<string>();
  for (const effect of list) {
    const op = effect.operation;
    if (op.type !== 'MODIFY' || op.stat !== stat) continue;
    if (!staticTargets(ctx, effect).includes(entityId)) continue;
    if (op.exclusive) {
      // “Não acumula”: vários efeitos iguais vindos de cartas com o mesmo nome contam uma vez só (Serperior).
      const key = `${cardDef(ctx, effect.sourceCardId).deckLimitKey}:${op.stat}:${op.energyType ?? ''}`;
      if (exclusive.has(key)) continue;
      exclusive.add(key);
    }
    out.push({ effect, amount: evaluateAmount(ctx, op.amount, staticContext(effect)) });
  }
  return out;
}

export function basePokemon(ctx: Readable, entity: PokemonEntity): PokemonCard | null {
  const def = entityDef(ctx, entity);
  return isPokemon(def) ? def : null;
}

export function maxHp(ctx: Readable, entity: PokemonEntity, statics?: StaticEffect[]): number {
  const def = entityDef(ctx, entity);
  const base = isPokemon(def) ? def.baseHp : def.trainerRules.fieldBehavior?.hp ?? 0;
  const bonus = modifiersFor(ctx, entity.entityId, 'MAX_HP', statics).reduce((sum, m) => sum + m.amount, 0);
  return Math.max(0, base + bonus);
}

export function remainingHp(ctx: Readable, entity: PokemonEntity, statics?: StaticEffect[]): number {
  return Math.max(0, maxHp(ctx, entity, statics) - entity.damage);
}

export function retreatCost(ctx: Readable, entity: PokemonEntity, statics?: StaticEffect[]): number | null {
  const def = entityDef(ctx, entity);
  if (!isPokemon(def)) return null; // Fóssil não recua.
  const delta = modifiersFor(ctx, entity.entityId, 'RETREAT_COST', statics).reduce((sum, m) => sum + m.amount, 0);
  return Math.max(0, def.retreatCost + delta);
}

export function knockoutPoints(ctx: Readable, entity: PokemonEntity, statics?: StaticEffect[]): number {
  const def = entityDef(ctx, entity);
  const base = isPokemon(def) ? def.knockoutPoints : 1;
  const delta = modifiersFor(ctx, entity.entityId, 'KNOCKOUT_POINTS', statics).reduce((sum, m) => sum + m.amount, 0);
  return Math.max(1, base + delta);
}

/** Unidades fornecidas por anexo (efeitos-dsl.md MODIFY ENERGY_PROVISION; anexos nunca são duplicados). */
export function providedUnits(ctx: Readable, entity: PokemonEntity, statics?: StaticEffect[]): { id: string; type: EnergyType; units: number }[] {
  const mods = modifiersFor(ctx, entity.entityId, 'ENERGY_PROVISION', statics);
  return entity.energies.map((e) => ({
    id: e.id,
    type: e.type,
    units: 1 + mods.filter((m) => m.effect.operation.type === 'MODIFY' && m.effect.operation.energyType === e.type).reduce((sum, m) => sum + m.amount, 0),
  }));
}

export function effectiveAttackCost(ctx: Readable, entity: PokemonEntity, attackId: string, cost: Partial<Record<CostType, number>>, statics?: StaticEffect[]): Partial<Record<CostType, number>> {
  const mods = modifiersFor(ctx, entity.entityId, 'ATTACK_COST', statics).filter((m) => {
    const op = m.effect.operation;
    return op.type === 'MODIFY' && (!op.appliesTo?.attackIds || op.appliesTo.attackIds.includes(attackId));
  });
  const result: Partial<Record<CostType, number>> = { ...cost };
  // Sem tipo, o modificador mexe no Incolor; com tipo (Cherubi: 1 Energia de Planta a menos), só naquele tipo.
  for (const m of mods) {
    const op = m.effect.operation;
    const type: CostType = op.type === 'MODIFY' && op.energyType ? op.energyType : 'COLORLESS';
    result[type] = Math.max(0, (result[type] ?? 0) + m.amount);
  }
  return result;
}

/** Requisitos específicos primeiro, depois Incolor, sem reutilizar unidades (gameplay §9.8). */
export function canPay(units: { type: EnergyType; units: number }[], cost: Partial<Record<CostType, number>>): boolean {
  const available: Partial<Record<EnergyType, number>> = {};
  for (const u of units) available[u.type] = (available[u.type] ?? 0) + Math.max(0, u.units);
  for (const [type, need] of Object.entries(cost)) {
    if (type === 'COLORLESS' || !need) continue;
    const have = available[type as EnergyType] ?? 0;
    if (have < need) return false;
    available[type as EnergyType] = have - need;
  }
  const rest = Object.values(available).reduce((sum, v) => sum + (v ?? 0), 0);
  return rest >= (cost.COLORLESS ?? 0);
}

export function isRestricted(ctx: Readable, located: Located, action: RestrictableAction, statics?: StaticEffect[], attackId?: string): boolean {
  const list = statics ?? collectStatics(ctx);
  return list.some((effect) => {
    const op = effect.operation;
    if (op.type !== 'RESTRICT_ACTION' || !op.actions.includes(action)) return false;
    // Restrição de um ataque específico (“não pode usar Big Beat”) só vale para ele.
    if (op.attackIds && (!attackId || !op.attackIds.includes(attackId))) return false;
    return staticTargets(ctx, effect).includes(located.entity.entityId);
  });
}

/** Restrição de jogador (Itens, Apoiadores, Energia manual): vale quando algum Pokémon do jogador é alvo. */
export function isPlayerRestricted(ctx: Readable, player: PlayerId, action: RestrictableAction, statics?: StaticEffect[]): boolean {
  const list = statics ?? collectStatics(ctx);
  return list.some((effect) => {
    const op = effect.operation;
    if (op.type !== 'RESTRICT_ACTION' || !op.actions.includes(action)) return false;
    return staticTargets(ctx, effect).some((id) => locate(ctx.s, id)?.player === player);
  });
}

/** Contexto de um dano para modificadores com filtro: ataque usado, atacante e alvo. */
export type DamageContext = { readonly attackId?: string | null; readonly attackerEntityId?: string | null; readonly targetEntityId?: string | null };

function passes(ctx: Readable, entityId: string | null | undefined, filter: Parameters<typeof matchesPokemonFilter>[2], effect: StaticEffect): boolean {
  if (!filter) return true;
  const located = entityId ? locate(ctx.s, entityId) : null;
  return !!located && matchesPokemonFilter(ctx, located, filter, staticContext(effect));
}

export function damageModifier(ctx: Readable, entityId: string, stat: 'DAMAGE_DEALT' | 'DAMAGE_TAKEN', category: 'ATTACK' | 'EFFECT', targetIsOpponentActive: boolean, statics?: StaticEffect[], dc: DamageContext = {}): number {
  return modifiersFor(ctx, entityId, stat, statics).filter((m) => {
    const op = m.effect.operation;
    if (op.type !== 'MODIFY') return false;
    const wanted = op.appliesTo?.damageCategory ?? 'ATTACK';
    if (wanted !== 'ANY' && wanted !== category) return false;
    if (stat === 'DAMAGE_DEALT' && (op.appliesTo?.opponentActiveOnly ?? true) && !targetIsOpponentActive) return false;
    if (op.appliesTo?.attackIds && (!dc.attackId || !op.appliesTo.attackIds.includes(dc.attackId))) return false;
    if (!passes(ctx, dc.attackerEntityId, op.appliesTo?.attackerFilter, m.effect)) return false;
    if (!passes(ctx, dc.targetEntityId, op.appliesTo?.targetFilter, m.effect)) return false;
    return true;
  }).reduce((sum, m) => sum + m.amount, 0);
}

export function preventionsFor(ctx: Readable, entityId: string, category: 'ATTACK' | 'EFFECT' | 'CONDITION', statics?: StaticEffect[], attackerEntityId?: string | null): StaticEffect[] {
  const list = statics ?? collectStatics(ctx);
  return list.filter((effect) => {
    const op = effect.operation;
    return op.type === 'PREVENT_DAMAGE' && op.categories.includes(category) && staticTargets(ctx, effect).includes(entityId)
      && passes(ctx, attackerEntityId, op.attackerFilter, effect);
  });
}

/** Efeitos contínuos de um opcode que alcançam a entidade. */
export function staticsOn(ctx: Readable, entityId: string, type: Operation['type'], statics?: StaticEffect[]): StaticEffect[] {
  const list = statics ?? collectStatics(ctx);
  return list.filter((effect) => effect.operation.type === type && staticTargets(ctx, effect).includes(entityId));
}

/** O alvo não pode ser afetado por esta Condição Especial (Comfey, Arceus ex, Hoothoot, Avental de Aço). */
export function conditionPrevented(ctx: Readable, entityId: string, condition: SpecialCondition, statics?: StaticEffect[]): boolean {
  return staticsOn(ctx, entityId, 'PREVENT_CONDITIONS', statics).some((e) => {
    const op = e.operation;
    return op.type === 'PREVENT_CONDITIONS' && (!op.conditions || op.conditions.includes(condition));
  });
}

export function healingPrevented(ctx: Readable, entityId: string, statics?: StaticEffect[]): boolean {
  return staticsOn(ctx, entityId, 'PREVENT_HEALING', statics).length > 0;
}

export function hasGrant(ctx: Readable, entityId: string, rule: GrantedRule, statics?: StaticEffect[]): boolean {
  return staticsOn(ctx, entityId, 'GRANT_RULE', statics).some((e) => e.operation.type === 'GRANT_RULE' && e.operation.rule === rule);
}

/** Chaves extras de evolução concedidas (Eevee ex evolui como Eevee). */
export function evolvesAsKeys(ctx: Readable, entityId: string, statics?: StaticEffect[]): string[] {
  return staticsOn(ctx, entityId, 'GRANT_RULE', statics).flatMap((e) => (e.operation.type === 'GRANT_RULE' && e.operation.rule === 'EVOLVES_AS' ? [...(e.operation.evolvesAs ?? [])] : []));
}

/** Dano do Envenenamento na Verificação: o do efeito que envenenou (padrão 10) + modificadores (Nihilego). */
export function poisonDamage(ctx: Readable, entity: PokemonEntity, statics?: StaticEffect[]): number {
  const bonus = modifiersFor(ctx, entity.entityId, 'POISON_DAMAGE', statics).reduce((sum, m) => sum + m.amount, 0);
  return Math.max(0, (entity.conditions.poisonDamage ?? 10) + bonus);
}

export function effectsPreventedFor(ctx: Readable, entityId: string, fromPlayer: PlayerId, statics?: StaticEffect[]): boolean {
  const list = statics ?? collectStatics(ctx);
  return list.some((effect) => effect.operation.type === 'PREVENT_EFFECTS' && effect.controller !== fromPlayer && staticTargets(ctx, effect).includes(entityId));
}

export function isAbilitySuppressed(ctx: Readable, entityId: string): boolean {
  return suppressedEntities(ctx).has(entityId);
}

export function isFossilCard(ctx: Readable, cardId: string): boolean {
  return isFossil(cardDef(ctx, cardId));
}

/**
 * Efeitos temporários em jogo (ataques, Treinadores e Habilidades com duração — não Ferramentas, Estádio nem
 * Habilidades contínuas) com os alvos atuais e o valor do modificador (MODIFY) ou do contra-ataque (COUNTER_DAMAGE).
 */
export function temporaryEffects(ctx: Readable): { readonly effect: StaticEffect; readonly targets: readonly string[]; readonly amount: number | null }[] {
  return nonAbilityStatics(ctx).filter((e) => e.origin === 'TEMPORARY').map((effect) => {
    const op = effect.operation;
    const amount = op.type === 'MODIFY' ? evaluateAmount(ctx, op.amount, staticContext(effect)) : op.type === 'COUNTER_DAMAGE' ? op.amount : null;
    return { effect, targets: staticTargets(ctx, effect), amount };
  });
}
