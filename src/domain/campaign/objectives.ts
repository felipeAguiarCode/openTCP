// Avaliação de objetivos (campanha §12): usa somente fatos confirmados da partida e o snapshot de
// entrada do deck; nunca nomes de animação, coordenadas ou tempo de vídeo.
import type { DeckComposition, Objective, Predicate } from '../../content/types.ts';
import type { MatchResult, ObjectiveStats, PlayerId } from '../battle/types.ts';
import { other } from '../battle/types.ts';

/** Fatos de composição do snapshot de entrada (campanha §12.1). */
export type DeckFacts = {
  readonly basicCount: number;
  readonly ruleBoxCopies: { readonly EX: number; readonly MEGA_EX: number };
  readonly subtypeCopies: { readonly ITEM: number; readonly SUPPORTER: number; readonly TOOL: number; readonly STADIUM: number };
  readonly distinctEvolutionLines: number;
  readonly setCounts: Readonly<Record<string, number>>;
  /** Cópias de Pokémon por tipo (um Pokémon de dois tipos conta em ambos). */
  readonly typeCounts: Readonly<Record<string, number>>;
  readonly starterPrintingCount: number;
  /** Cartas (contando cópias) cujo efeito estruturado usa o opcode; chaves `OP` e `OP:STAT`. */
  readonly opcodeCardCounts: Readonly<Record<string, number>>;
  readonly energyTypeCount: number;
};

export type ObjectiveContext = {
  readonly human: PlayerId;
  readonly result: MatchResult;
  readonly stats: ObjectiveStats;
  readonly ownTurns: number;
  readonly deck: DeckFacts;
  readonly turnLimit: number | null;
};

/** Cópias de Pokémon com algum dos tipos (sem contar duas vezes quem não existe; tipos duplos já contam em cada tipo). */
const pokemonOfTypes = (counts: Readonly<Record<string, number>>, types: readonly string[]): number => types.reduce((sum, t) => sum + (counts[t] ?? 0), 0);

export function compositionHolds(c: DeckComposition, f: DeckFacts): boolean {
  if (c.minBasic !== undefined && f.basicCount < c.minBasic) return false;
  if (c.maxRuleBoxCopies?.EX !== undefined && f.ruleBoxCopies.EX > c.maxRuleBoxCopies.EX) return false;
  if (c.maxRuleBoxCopies?.MEGA_EX !== undefined && f.ruleBoxCopies.MEGA_EX > c.maxRuleBoxCopies.MEGA_EX) return false;
  if (c.minRuleBoxCopies?.EX !== undefined && f.ruleBoxCopies.EX < c.minRuleBoxCopies.EX) return false;
  if (c.minRuleBoxCopies?.MEGA_EX !== undefined && f.ruleBoxCopies.MEGA_EX < c.minRuleBoxCopies.MEGA_EX) return false;
  if (c.exactEnergyTypeCount !== undefined && f.energyTypeCount !== c.exactEnergyTypeCount) return false;
  if (c.minSubtypeCopies) {
    for (const [k, v] of Object.entries(c.minSubtypeCopies)) if (v !== undefined && f.subtypeCopies[k as keyof DeckFacts['subtypeCopies']] < v) return false;
  }
  if (c.minCardsWithOpcode) {
    const total = c.minCardsWithOpcode.opcodes.reduce((sum, op) => sum + (f.opcodeCardCounts[op] ?? 0), 0);
    if (total < c.minCardsWithOpcode.count) return false;
  }
  if (c.minDistinctEvolutionLines !== undefined && f.distinctEvolutionLines < c.minDistinctEvolutionLines) return false;
  if (c.maxStarterPrintings !== undefined && f.starterPrintingCount > c.maxStarterPrintings) return false;
  if (c.minSetCards) {
    const total = c.minSetCards.setIds.reduce((sum, id) => sum + (f.setCounts[id] ?? 0), 0);
    if (total < c.minSetCards.count) return false;
  }
  if (c.minTypeCards && pokemonOfTypes(f.typeCounts, c.minTypeCards.types) < c.minTypeCards.count) return false;
  return true;
}

export function predicateHolds(p: Predicate, ctx: ObjectiveContext): boolean {
  const s = ctx.stats;
  const won = ctx.result.outcome === 'WIN' && ctx.result.winner === ctx.human;
  const n = p.count ?? 1;
  switch (p.type) {
    case 'WIN': return won;
    case 'DECK_COMPOSITION': return p.composition ? compositionHolds(p.composition, ctx.deck) : false;
    case 'PLACED_ON_BENCH_AT_LEAST': return s.benchPlacements >= n;
    case 'EVOLVED_AT_LEAST': return s.evolutions >= n;
    case 'MANUAL_ENERGY_ATTACHED_AT_LEAST': return s.manualEnergy >= n;
    case 'PLAYED_SUBTYPES': return (p.subtypes ?? []).every((t) => s.playedSubtypes.includes(t));
    case 'RETREATED_AT_LEAST': return s.retreats >= n;
    case 'SWITCH_EFFECT_USED': return s.switchEffects >= n;
    case 'DISTINCT_ATTACKERS_AT_LEAST': return s.attackers.length >= n;
    case 'DISTINCT_ATTACK_DAMAGE_SOURCES_AT_LEAST': return s.damageSources.length >= n;
    case 'ENERGY_ON_ONE_POKEMON_AT_LEAST': return s.maxEnergyOnOnePokemon >= n;
    case 'ACTIVATED_ABILITY_USED': return s.activatedAbilities >= n;
    case 'CONDITION_REMOVED_BY_CAUSE': return (p.causes ?? ['SWITCH', 'RETREAT', 'EVOLUTION', 'EFFECT']).some((c) => s.conditionRemovedByCause.includes(c));
    case 'EVOLVED_POKEMON_WITH_CONDITION': return s.evolvedWithCondition >= n;
    case 'DELAYED_EFFECT_PREVENTED': return s.delayedPrevented >= n;
    case 'TOOL_ATTACHED': return s.toolsAttached >= n;
    case 'STADIUM_REPLACED_DIFFERENT_NAME': return s.stadiumReplacedDifferentName >= n;
    case 'MODIFIER_SOURCE_REMOVED': return s.modifierSourcesRemoved >= n;
    case 'KNOCKOUT_WITHOUT_ATTACK': return s.knockoutsWithoutAttack >= n;
    case 'KNOCKED_OUT_ROLE': return !!p.role && s.knockedOutRoles.includes(p.role);
    case 'KNOCKED_OUT_RULEBOX': return (p.ruleBoxes ?? []).some((r) => s.knockedOutRuleBoxes.includes(r));
    case 'OWN_TURNS_AT_MOST': return ctx.ownTurns <= n;
    case 'OPPONENT_POINTS_AT_MOST': return ctx.result.points[other(ctx.human)] <= n;
    case 'WIN_IN_PREPARED_TURN': return won && ctx.turnLimit !== null && ctx.ownTurns <= ctx.turnLimit;
    default: return false;
  }
}

export function objectiveCompleted(objective: Objective, ctx: ObjectiveContext): boolean {
  if (objective.requiresVictory && !(ctx.result.outcome === 'WIN' && ctx.result.winner === ctx.human)) return false;
  return objective.predicates.every((p) => predicateHolds(p, ctx));
}

export function evaluateObjectives(objectives: readonly Objective[], ctx: ObjectiveContext): string[] {
  return objectives.filter((o) => objectiveCompleted(o, ctx)).map((o) => o.objectiveId);
}
