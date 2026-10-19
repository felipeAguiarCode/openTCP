// Avaliação dos predicados de objetivo sobre o estado final da tentativa (campanha §12.3).
// Usa somente MatchResult, estatísticas do motor (stats do humano = A) e o snapshot de composição.
import type { MatchState } from '../../domain/battle/types.ts';
import type { Objective, Predicate } from '../types.ts';

export type ObjectiveContext = {
  readonly state: MatchState;
  /** Turno próprio do humano em que a fixture/partida o coloca para jogar pela primeira vez (WIN_IN_PREPARED_TURN). */
  readonly firstHumanOwnTurn: number;
  /** Avalia a composição do snapshot de entrada; ausente = predicado de composição falso. */
  readonly composition?: (criteria: NonNullable<Predicate['composition']>) => boolean;
};

const at = (value: number, count: number | undefined) => value >= (count ?? 1);

export function evaluatePredicate(predicate: Predicate, ctx: ObjectiveContext): boolean {
  const s = ctx.state;
  const st = s.stats.A;
  const won = s.result?.outcome === 'WIN' && s.result.winner === 'A';
  switch (predicate.type) {
    case 'WIN': return won;
    case 'DECK_COMPOSITION': return predicate.composition ? ctx.composition?.(predicate.composition) ?? false : false;
    case 'PLACED_ON_BENCH_AT_LEAST': return at(st.benchPlacements, predicate.count);
    case 'EVOLVED_AT_LEAST': return at(st.evolutions, predicate.count);
    case 'MANUAL_ENERGY_ATTACHED_AT_LEAST': return at(st.manualEnergy, predicate.count);
    case 'PLAYED_SUBTYPES': return (predicate.subtypes ?? []).every((t) => st.playedSubtypes.includes(t));
    case 'RETREATED_AT_LEAST': return at(st.retreats, predicate.count);
    case 'SWITCH_EFFECT_USED': return at(st.switchEffects, predicate.count);
    case 'DISTINCT_ATTACKERS_AT_LEAST': return at(st.attackers.length, predicate.count);
    case 'DISTINCT_ATTACK_DAMAGE_SOURCES_AT_LEAST': return at(st.damageSources.length, predicate.count);
    case 'ENERGY_ON_ONE_POKEMON_AT_LEAST': return at(st.maxEnergyOnOnePokemon, predicate.count);
    case 'ACTIVATED_ABILITY_USED': return at(st.activatedAbilities, predicate.count);
    case 'CONDITION_REMOVED_BY_CAUSE': return (predicate.causes ?? []).some((c) => st.conditionRemovedByCause.includes(c));
    case 'EVOLVED_POKEMON_WITH_CONDITION': return at(st.evolvedWithCondition, predicate.count);
    case 'DELAYED_EFFECT_PREVENTED': return at(st.delayedPrevented, predicate.count);
    case 'TOOL_ATTACHED': return at(st.toolsAttached, predicate.count);
    case 'STADIUM_REPLACED_DIFFERENT_NAME': return at(st.stadiumReplacedDifferentName, predicate.count);
    case 'MODIFIER_SOURCE_REMOVED': return at(st.modifierSourcesRemoved, predicate.count);
    case 'KNOCKOUT_WITHOUT_ATTACK': return at(st.knockoutsWithoutAttack, predicate.count);
    case 'KNOCKED_OUT_ROLE': return !!predicate.role && st.knockedOutRoles.includes(predicate.role);
    case 'KNOCKED_OUT_RULEBOX': return (predicate.ruleBoxes ?? []).some((r) => st.knockedOutRuleBoxes.includes(r));
    case 'OWN_TURNS_AT_MOST': return st.ownTurnsAtWin !== null && st.ownTurnsAtWin <= (predicate.count ?? 0);
    case 'OPPONENT_POINTS_AT_MOST': return s.players.B.points <= (predicate.count ?? 0);
    case 'WIN_IN_PREPARED_TURN': return won && st.ownTurnsAtWin === ctx.firstHumanOwnTurn;
    default: return false;
  }
}

/** Objetivo concluído: todos os predicados verdadeiros e, quando exigido, vitória do humano na mesma tentativa. */
export function evaluateObjective(objective: Objective, ctx: ObjectiveContext): boolean {
  const won = ctx.state.result?.outcome === 'WIN' && ctx.state.result.winner === 'A';
  if (objective.requiresVictory && !won) return false;
  return objective.predicates.every((p) => evaluatePredicate(p, ctx));
}
