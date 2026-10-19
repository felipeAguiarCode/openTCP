// Resolução de seletores e filtros (efeitos-dsl.md §3).
import type { CardFilter, PokemonFilter, Selector, Zone } from '../cards/types.ts';
import { isFossil, isPokemon } from '../cards/types.ts';
import { allEntities, cardDef, entityDef, entitiesOf, locate, type Ctx, type Located } from './core.ts';
import type { EffectOutput, PlayerId } from './types.ts';
import { other } from './types.ts';

export type SelectorContext = {
  readonly controller: PlayerId;
  readonly selfEntityId: string | null;
  readonly eventSourceEntityId: string | null;
  readonly eventTargetEntityId: string | null;
  readonly outputs: Readonly<Record<string, EffectOutput>>;
  /** Pokémon Defensor do ataque corrente (Ativo adversário na declaração); só existe em frames de ataque. */
  readonly defendingEntityId?: string | null;
  /** Alvo do dano em cálculo (escopo TARGET). */
  readonly targetEntityId?: string | null;
};

export function scopeCandidates(ctx: Pick<Ctx, 's' | 'cat'>, selector: Selector, sc: SelectorContext): Located[] {
  const s = ctx.s;
  const own = sc.controller;
  const opp = other(own);
  const byId = (id: string | null): Located[] => {
    if (!id) return [];
    const found = locate(s, id);
    return found ? [found] : [];
  };
  switch (selector.scope) {
    case 'SELF': return byId(sc.selfEntityId);
    case 'OWN_ACTIVE': return entitiesOf(s, own).filter((l) => l.position === 'ACTIVE');
    case 'OPPONENT_ACTIVE': return entitiesOf(s, opp).filter((l) => l.position === 'ACTIVE');
    case 'OWN_BENCH': return entitiesOf(s, own).filter((l) => l.position === 'BENCH');
    case 'OPPONENT_BENCH': return entitiesOf(s, opp).filter((l) => l.position === 'BENCH');
    case 'OWN_POKEMON': return entitiesOf(s, own);
    case 'OPPONENT_POKEMON': return entitiesOf(s, opp);
    case 'ALL_POKEMON': return allEntities(s);
    case 'EVENT_SOURCE': return byId(sc.eventSourceEntityId);
    case 'EVENT_TARGET': return byId(sc.eventTargetEntityId);
    case 'DEFENDING': return byId(sc.defendingEntityId ?? null);
    case 'TARGET': return byId(sc.targetEntityId ?? null);
    case 'OUTPUT': {
      const out = selector.ref ? sc.outputs[selector.ref] : undefined;
      if (!out || out.kind !== 'TARGETS') return [];
      return out.ids.flatMap((id) => byId(id));
    }
    default: return [];
  }
}

export function matchesPokemonFilter(
  ctx: Pick<Ctx, 's' | 'cat'>, located: Located, filter: PokemonFilter | undefined, sc: SelectorContext,
): boolean {
  if (!filter) return true;
  const e = located.entity;
  const def = entityDef(ctx, e);
  const fossil = isFossil(def);
  if (filter.excludeFossils && fossil) return false;
  if (filter.excludeSelf && e.entityId === sc.selfEntityId) return false;
  if (filter.positions && !filter.positions.includes(located.position)) return false;
  if (filter.hasDamage !== undefined && (e.damage > 0) !== filter.hasDamage) return false;
  if (filter.hasTool !== undefined && (e.toolCardId !== null) !== filter.hasTool) return false;
  if (filter.hasEnergy !== undefined && (e.energies.length > 0) !== filter.hasEnergy) return false;
  if (filter.hasCondition !== undefined) {
    const c = e.conditions;
    const any = c.poisoned || c.burned || c.control !== null;
    if (typeof filter.hasCondition === 'boolean') {
      if (any !== filter.hasCondition) return false;
    } else {
      const has = filter.hasCondition === 'POISONED' ? c.poisoned : filter.hasCondition === 'BURNED' ? c.burned : c.control === filter.hasCondition;
      if (!has) return false;
    }
  }
  if (filter.deckLimitKeys && !filter.deckLimitKeys.includes(def.deckLimitKey)) return false;
  if (filter.tags && !filter.tags.some((t) => def.tags.includes(t))) return false;
  if (filter.ruleBoxes && !filter.ruleBoxes.includes(def.ruleBox)) return false;
  if (filter.hasAbility !== undefined && (def.abilities.length > 0) !== filter.hasAbility) return false;
  if (filter.abilityIds && !def.abilities.some((a) => filter.abilityIds!.includes(a.id))) return false;
  if (filter.excludeAbilityIds && def.abilities.some((a) => filter.excludeAbilityIds!.includes(a.id))) return false;
  if (filter.attackIds && !def.attacks.some((a) => filter.attackIds!.includes(a.id))) return false;
  if (filter.energyTypes && !e.energies.some((en) => filter.energyTypes!.includes(en.type))) return false;
  const turn = ctx.s.globalTurnNumber;
  if (filter.evolvedThisTurn !== undefined && (e.lastEvolvedOnTurn === turn) !== filter.evolvedThisTurn) return false;
  if (filter.movedToActiveThisTurn !== undefined && (located.position === 'ACTIVE' && e.movedToActiveOnTurn === turn) !== filter.movedToActiveThisTurn) return false;
  if (filter.damagedByAttackLastOpponentTurn !== undefined && (e.damagedByAttackOnTurn === turn - 1) !== filter.damagedByAttackLastOpponentTurn) return false;
  if (filter.enteredPlayThisTurn !== undefined && (e.enteredPlayOnTurn >= turn) !== filter.enteredPlayThisTurn) return false;
  if (isPokemon(def)) {
    if (filter.types && !filter.types.some((t) => def.types.includes(t))) return false;
    if (filter.stages && !filter.stages.includes(def.stage)) return false;
    if (filter.evolvesFrom && !def.evolvesFrom.some((k) => filter.evolvesFrom!.includes(k))) return false;
  } else {
    if (filter.evolvesFrom) return false;
    // Fóssil em campo conta como Pokémon Básico com os tipos de `fieldBehavior` (A1: “Pokémon Básico {C}”).
    if (filter.types) {
      const types = def.trainerRules.fieldBehavior?.types ?? [];
      if (!filter.types.some((t) => types.includes(t))) return false;
    }
    if (filter.stages && !(fossil && filter.stages.includes('BASIC'))) return false;
  }
  return true;
}

/** Elegíveis do seletor, sem aplicar a forma de escolha (pick). */
export function eligible(ctx: Pick<Ctx, 's' | 'cat'>, selector: Selector, sc: SelectorContext): Located[] {
  return scopeCandidates(ctx, selector, sc).filter((l) => matchesPokemonFilter(ctx, l, selector.filter, sc));
}

export function matchesCardFilter(ctx: Pick<Ctx, 's' | 'cat'>, cardId: string, filter: CardFilter | undefined, evolvesFromKeys?: readonly string[]): boolean {
  if (!filter) return true;
  const def = cardDef(ctx, cardId);
  if (filter.categories && !filter.categories.includes(def.category)) return false;
  if (filter.excludeFossils && isFossil(def)) return false;
  if (filter.deckLimitKeys && !filter.deckLimitKeys.includes(def.deckLimitKey)) return false;
  if (filter.ruleBoxes && !filter.ruleBoxes.includes(def.ruleBox)) return false;
  if (filter.tags && !filter.tags.some((t) => def.tags.includes(t))) return false;
  if (isPokemon(def)) {
    if (filter.subtypes) return false;
    if (filter.stages && !filter.stages.includes(def.stage)) return false;
    if (filter.types && !filter.types.some((t) => def.types.includes(t))) return false;
    if (filter.evolvesFromTarget && evolvesFromKeys && !def.evolvesFrom.some((k) => evolvesFromKeys.includes(k))) return false;
    if (filter.evolvesFrom && !def.evolvesFrom.some((k) => filter.evolvesFrom!.includes(k))) return false;
    if (filter.attackIds && !def.attacks.some((a) => filter.attackIds!.includes(a.id))) return false;
  } else {
    if (filter.subtypes && !filter.subtypes.includes(def.subtype)) return false;
    if (filter.stages || filter.types || filter.evolvesFromTarget || filter.evolvesFrom || filter.attackIds) return false;
  }
  return true;
}

export function zoneCards(ctx: Pick<Ctx, 's'>, zone: Zone, controller: PlayerId): string[] {
  const own = ctx.s.players[controller];
  const opp = ctx.s.players[other(controller)];
  switch (zone) {
    case 'OWN_HAND': return own.hand;
    case 'OPPONENT_HAND': return opp.hand;
    case 'OWN_DECK': return own.deck;
    case 'OPPONENT_DECK': return opp.deck;
    case 'OWN_DISCARD': return own.discard;
    case 'OPPONENT_DISCARD': return opp.discard;
    default: return [];
  }
}

/** Uma carta Básica elegível para colocação/setup: Pokémon Básico; Fósseis nunca contam. */
export function isEligibleBasic(ctx: Pick<Ctx, 's' | 'cat'>, cardId: string): boolean {
  const def = cardDef(ctx, cardId);
  return isPokemon(def) && def.stage === 'BASIC';
}
