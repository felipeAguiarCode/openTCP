// Construtores das tabelas de efeito dos sets do Pocket (texto em inglês → effects-dsl). Os mesmos padrões do
// Genetic Apex (a1/effects.ts), generalizados por tipo de Energia, alvo e quantidade.
import type {
  Ability, Condition, EffectBlock, EnergyType, Formula, Operation, PokemonFilter, Selector, SpecialCondition,
} from '../../../../domain/cards/types.ts';
import { ability, add, atLeastHeads, block, c, choose, condition, flip, heads, mul, onPlay, OPP_ACTIVE, post, pre, SELF } from '../../../builders.ts';
import type { AttackFx, TrainerFx } from '../../a1/effects.ts';
import type { AbilityFx } from '../build.ts';

export type { AttackFx, TrainerFx, AbilityFx };
export { ability, add, atLeastHeads, block, c, choose, condition, flip, heads, mul, onPlay, OPP_ACTIVE, post, pre, SELF };

export const DEFENDING: Selector = { scope: 'DEFENDING' };
export const OWN_ACTIVE: Selector = { scope: 'OWN_ACTIVE' };
export const NEXT_TURN_WHILE_ACTIVE = { kind: 'NEXT_OPPONENT_TURN', removeOn: ['TARGET_LEAVES_ACTIVE'] } as const;
export const NEXT_OPP = { kind: 'NEXT_OPPONENT_TURN' } as const;
export const NEXT_OWN = { kind: 'NEXT_OWN_TURN' } as const;
export const THIS_TURN = { kind: 'THIS_TURN' } as const;
export const WHILE = { kind: 'WHILE_SOURCE_IN_PLAY' } as const;
export const once = { scope: 'INSTANCE_TURN', count: 1 } as const;
export const unlimited = { scope: 'UNLIMITED', count: 1 } as const;

const T: Readonly<Record<string, EnergyType>> = { G: 'GRASS', R: 'FIRE', W: 'WATER', L: 'LIGHTNING', P: 'PSYCHIC', F: 'FIGHTING', D: 'DARKNESS', M: 'METAL' };
/** Tipo de Energia pela letra do Limitless (G, R, W, L, P, F, D, M). */
export const E = (letter: string): EnergyType => T[letter]!;

export const base = (n: number | null): number => n ?? 0;
export const count = (selector: Selector): Formula => ({ op: 'COUNT_POKEMON', selector });
export const exists = (scope: Selector['scope'], filter: PokemonFilter = {}): Condition => ({ op: 'EXISTS', selector: { scope, filter } });
export const named = (keys: readonly string[], extra: PokemonFilter = {}): PokemonFilter => ({ deckLimitKeys: keys, ...extra });
export const tails = (n = 1): Condition => ({ op: 'COMPARE', left: { op: 'COUNT_TAILS', reference: 'coins' }, cmp: 'GE', right: c(n) });
export const noHeads: Condition = { op: 'COMPARE', left: heads(), cmp: 'EQ', right: c(0) };
export const all = (...conditions: Condition[]): Condition => ({ op: 'ALL', conditions });
export const not = (cond: Condition): Condition => ({ op: 'NOT', condition: cond });
export const EX: PokemonFilter = { ruleBoxes: ['EX', 'MEGA_EX'] };

/** “Se …, este ataque causa N de dano a mais” (efeitos-dsl §9.1): +N no dano deste Pokémon, somado antes da Fraqueza. */
export const bonusIf = (more: number, when: Condition): EffectBlock =>
  pre({ type: 'MODIFY', stat: 'DAMAGE_DEALT', amount: more, target: SELF, duration: THIS_TURN }, { condition: when });
export const extraEnergy = (type: EnergyType): Formula => ({ op: 'EXTRA_ENERGY_UNITS', energyType: type });
export const extraAtLeast = (type: EnergyType, n: number): Condition => ({ op: 'COMPARE', left: extraEnergy(type), cmp: 'GE', right: c(n) });
export const energyCount = (selector: Selector, type?: EnergyType): Formula => ({ op: 'COUNT_ATTACHED_ENERGIES', selector, ...(type ? { energyType: type } : {}) });
export const anyEnergy = (type: EnergyType): Condition => ({ op: 'COMPARE', left: energyCount(SELF, type), cmp: 'GE', right: c(1) });

export const selfDamage = (amount: number): Operation => ({ type: 'DEAL_DAMAGE', target: SELF, amount, category: 'EFFECT', ignoreDefenderModifiers: true });
export const discardOwn = (type: EnergyType | 'ANY', n: number | 'ALL', random = false): Operation =>
  ({ type: 'DISCARD_ENERGY', target: SELF, energyType: type, count: n, ...(random ? { chooser: 'RANDOM' as const } : {}) });
export const discardRandomFrom = (target: Selector, n: number | Formula = 1): Operation => ({ type: 'DISCARD_ENERGY', target, energyType: 'ANY', count: n, chooser: 'RANDOM' });
export const perHeads = (coins: number, each: number): AttackFx => ({ formula: mul(c(each), heads()), effects: [pre(flip(coins))] });
export const bonusOnHeads = (printed: number, more: number): AttackFx => ({ formula: add(c(printed), mul(c(more), heads())), effects: [pre(flip(1))] });
export const untilTails = (): Operation => ({ type: 'FLIP_COINS', untilTails: true, outputId: 'coins' });
export const healSelf = (amount: number): Operation => ({ type: 'HEAL_DAMAGE', target: SELF, amount });
export const conditionOn = (name: SpecialCondition, target: Selector = OPP_ACTIVE): Operation => condition(name, target);

/** Liga N Energias geradas da Zona (efeitos “Take a [X] Energy from your Energy Zone and attach it to …”). */
export const attachZone = (type: EnergyType, target: Selector, n = 1): Operation => ({ type: 'ATTACH_ENERGY', target, energyType: type, count: n, source: 'GENERATED' });
/** Dano principal num alvo escolhido (“This attack does N damage to 1 of …”). */
export const snipe = (n: number, scope: Selector['scope'] = 'OPPONENT_POKEMON', filter?: PokemonFilter): AttackFx => ({ damage: n, target: choose(scope, filter) });
/** Dano extra do ataque (sem Fraqueza) a um alvo escolhido ou a todos de um escopo. */
export const extraDamage = (n: number, target: Selector): Operation => ({ type: 'DEAL_DAMAGE', target, amount: n, category: 'ATTACK' });
export const spreadAll = (scope: Selector['scope'], filter?: PokemonFilter): Selector => ({ scope, ...(filter ? { filter } : {}), pick: { mode: 'ALL' } });
export const random1 = (scope: Selector['scope'], filter?: PokemonFilter): Selector => ({ scope, ...(filter ? { filter } : {}), pick: { mode: 'RANDOM', count: 1 } });

/** Efeito no Pokémon Defensor durante o próximo turno do oponente (some se ele sair do Ativo). */
export const defendingNextTurn = (op: Omit<Extract<Operation, { duration: unknown }>, 'target' | 'duration'>): Operation =>
  ({ ...op, target: DEFENDING, duration: NEXT_TURN_WHILE_ACTIVE } as Operation);

export const activate = (operation: Operation, extra: Partial<EffectBlock> = {}): EffectBlock => block('ON_ACTIVATE', operation, { failurePolicy: 'REQUIRE_ANY', ...extra });
export const trig = (operation: Operation, extra: Partial<EffectBlock> = {}): EffectBlock => block('ON_TRIGGER', operation, extra);
export const cont = (operation: Operation, extra: Partial<EffectBlock> = {}): EffectBlock => block('CONTINUOUS', operation, extra);

/** Habilidade ativada, uma vez por turno. */
export const activated = (positions: readonly ('ACTIVE' | 'BENCH')[], effects: EffectBlock[], extra: Partial<Ability> = {}): AbilityFx =>
  (id, name) => ability({ id, name, kind: 'ACTIVATED', sourcePositions: positions, usageLimit: once, effects, ...extra });
/** Habilidade contínua. */
export const continuousAbility = (positions: readonly ('ACTIVE' | 'BENCH')[], effects: EffectBlock[], extra: Partial<Ability> = {}): AbilityFx =>
  (id, name) => ability({ id, name, kind: 'CONTINUOUS', sourcePositions: positions, effects, ...extra });
/** Habilidade disparada por gatilho. */
export const triggered = (positions: readonly ('ACTIVE' | 'BENCH')[], trigger: Ability['trigger'], effects: EffectBlock[], extra: Partial<Ability> = {}): AbilityFx =>
  (id, name) => ability({ id, name, kind: 'TRIGGERED', sourcePositions: positions, trigger, effects, ...extra });
export const BOTH = ['ACTIVE', 'BENCH'] as const;
export const ACTIVE = ['ACTIVE'] as const;
export const BENCH = ['BENCH'] as const;

/** Bônus de dano de Apoiador neste turno, contra o Pokémon Ativo do oponente (Blaine, Sophocles, Red). */
export const damageBoost = (amount: number, filter?: PokemonFilter, targetFilter?: PokemonFilter): EffectBlock => onPlay({ type: 'MODIFY', stat: 'DAMAGE_DEALT', amount,
  target: { scope: 'OWN_POKEMON', ...(filter ? { filter } : {}) }, duration: THIS_TURN,
  appliesTo: { opponentActiveOnly: true, damageCategory: 'ATTACK', ...(targetFilter ? { targetFilter } : {}) } }, { failurePolicy: 'BEST_EFFORT' });
/** Seus Pokémon (filtrados) recebem N a menos de ataques no próximo turno do oponente (Blue, Adaman, Jasmine). */
export const shieldNextTurn = (amount: number, filter?: PokemonFilter): EffectBlock => onPlay({ type: 'MODIFY', stat: 'DAMAGE_TAKEN', amount: -amount,
  target: { scope: 'OWN_POKEMON', ...(filter ? { filter } : {}) }, duration: NEXT_OPP, appliesTo: { damageCategory: 'ATTACK' } }, { failurePolicy: 'BEST_EFFORT' });

export const supporter = (effects: EffectBlock[], rules?: TrainerFx['rules']): TrainerFx => ({ subtype: 'SUPPORTER', effects, ...(rules ? { rules } : {}) });
export const item = (effects: EffectBlock[], rules?: TrainerFx['rules']): TrainerFx => ({ subtype: 'ITEM', effects, ...(rules ? { rules } : {}) });
export const tool = (effects: EffectBlock[], rules?: TrainerFx['rules']): TrainerFx => ({ subtype: 'TOOL', effects, ...(rules ? { rules } : {}) });
