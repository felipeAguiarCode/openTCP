// Regras do Genetic Apex (A1) em effects-dsl: cada texto de efeito do `.inspo` (inglês, normalizado pelo importador)
// mapeia para os blocos que o motor executa. O texto exibido na carta é gerado em PT-BR a partir destes blocos
// (src/domain/cards/text.ts) — nada do inglês vai para a tela. Carta com efeito fora destas tabelas não carrega
// (a1/cards.ts falha), então um set novo sempre passa por aqui.
import type { Ability, Attack, Condition, EffectBlock, Formula, Operation, PokemonFilter, Selector, TrainerRules, TrainerSubtype } from '../../../domain/cards/types.ts';
import { ability, add, atLeastHeads, block, c, choose, condition, continuous, flip, healSelf, heads, mul, onPlay, OPP_ACTIVE, post, pre, SELF } from '../../builders.ts';

/** Partes do ataque derivadas do efeito; `base` é o número impresso no dano ("40" → 40, "30+" → 30, "50x" → 50). */
export type AttackFx = {
  readonly damage?: number | null; readonly formula?: Formula; readonly target?: Selector | null; readonly effects?: EffectBlock[];
  /** Condições para poder usar o ataque e custos adicionais (sets depois do A1). */
  readonly preconditions?: Condition[]; readonly additionalCosts?: Attack['additionalCosts'];
  readonly alternativeCost?: Attack['alternativeCost']; readonly ignoreDefenderEffects?: true;
};

const DEFENDING: Selector = { scope: 'DEFENDING' };
const NEXT_TURN_WHILE_ACTIVE = { kind: 'NEXT_OPPONENT_TURN', removeOn: ['TARGET_LEAVES_ACTIVE'] } as const;
const count = (selector: Selector): Formula => ({ op: 'COUNT_POKEMON', selector });
/** “Se …, este ataque causa N de dano a mais” (efeitos-dsl §9.1): +N no dano deste Pokémon, somado antes da Fraqueza. */
const bonusIf = (more: number, when: Condition): EffectBlock =>
  pre({ type: 'MODIFY', stat: 'DAMAGE_DEALT', amount: more, target: SELF, duration: { kind: 'THIS_TURN' } }, { condition: when });
const extraAtLeast = (n: number): Condition => ({ op: 'COMPARE', left: extraEnergy('WATER'), cmp: 'GE', right: c(n) });
const exists = (scope: Selector['scope'], filter: PokemonFilter): Condition => ({ op: 'EXISTS', selector: { scope, filter } });
const tails = (n = 1): Condition => ({ op: 'COMPARE', left: { op: 'COUNT_TAILS', reference: 'coins' }, cmp: 'GE', right: c(n) });
const extraEnergy = (energyType: 'WATER'): Formula => ({ op: 'EXTRA_ENERGY_UNITS', energyType });
const selfDamage = (amount: number): Operation => ({ type: 'DEAL_DAMAGE', target: SELF, amount, category: 'EFFECT', ignoreDefenderModifiers: true });
const discardOwn = (energyType: 'FIRE' | 'PSYCHIC' | 'ANY', n: number | 'ALL'): Operation => ({ type: 'DISCARD_ENERGY', target: SELF, energyType, count: n });
const discardRandomFromDefender: Operation = { type: 'DISCARD_ENERGY', target: OPP_ACTIVE, energyType: 'ANY', count: 1, chooser: 'RANDOM' };
const perHeads = (coins: number, each: number): AttackFx => ({ formula: mul(c(each), heads()), effects: [pre(flip(coins))] });
const bonusOnHeads = (base: number, more: number): AttackFx => ({ formula: add(c(base), mul(c(more), heads())), effects: [pre(flip(1))] });

const base = (n: number | null): number => n ?? 0;

/** Efeitos de ataque por texto (62). */
export const ATTACK_EFFECTS: Readonly<Record<string, (printed: number | null) => AttackFx>> = {
  'Heal 30 damage from this Pokémon.': () => ({ effects: [post(healSelf(30))] }),
  'Heal 10 damage from this Pokémon.': () => ({ effects: [post(healSelf(10))] }),
  'Put 1 random [G] Pokémon from your deck into your hand.': () => ({
    effects: [post({ type: 'SEARCH_DECK', player: 'OWN', filter: { categories: ['POKEMON'], types: ['GRASS'] }, count: 1, mode: 'RANDOM', destination: 'HAND', reveal: true, shuffleAfter: true })],
  }),
  "Your opponent's Active Pokémon is now Asleep.": () => ({ effects: [post(condition('ASLEEP'))] }),
  "Your opponent's Active Pokémon is now Poisoned.": () => ({ effects: [post(condition('POISONED'))] }),
  'Flip a coin. If heads, this attack does 30 more damage.': (n) => bonusOnHeads(base(n), 30),
  'Flip a coin. If heads, this attack does 40 more damage.': (n) => bonusOnHeads(base(n), 40),
  'Flip 2 coins. This attack does 30 damage for each heads.': () => perHeads(2, 30),
  'Flip 2 coins. This attack does 50 damage for each heads.': () => perHeads(2, 50),
  'Flip 2 coins. This attack does 80 damage for each heads.': () => perHeads(2, 80),
  'Flip 2 coins. This attack does 100 damage for each heads.': () => perHeads(2, 100),
  'Flip 4 coins. This attack does 40 damage for each heads.': () => perHeads(4, 40),
  'Flip 4 coins. This attack does 50 damage for each heads.': () => perHeads(4, 50),
  'Flip a coin until you get tails. This attack does 60 damage for each heads.': () => ({
    formula: mul(c(60), heads()), effects: [pre({ type: 'FLIP_COINS', untilTails: true, outputId: 'coins' })],
  }),
  'Take a [G] Energy from your Energy Zone and attach it to 1 of your Benched [G] Pokémon.': () => ({
    effects: [post({ type: 'ATTACH_ENERGY', target: choose('OWN_BENCH', { types: ['GRASS'] }), energyType: 'GRASS', count: 1, source: 'GENERATED' })],
  }),
  'Take 1 [M] Energy from your Energy Zone and attach it to this Pokémon.': () => ({
    effects: [post({ type: 'ATTACH_ENERGY', target: SELF, energyType: 'METAL', count: 1, source: 'GENERATED' })],
  }),
  'Flip 3 coins. Take an amount of [R] Energy from your Energy Zone equal to the number of heads and attach it to your Benched [R] Pokémon in any way you like.': () => ({
    effects: [pre(flip(3)), post({ type: 'ATTACH_ENERGY', target: { scope: 'OWN_BENCH', filter: { types: ['FIRE'] } }, energyType: 'FIRE', count: heads(), source: 'GENERATED', distribute: true })],
  }),
  'Flip a coin. If tails, this attack does nothing.': () => ({ effects: [pre(flip(1)), pre({ type: 'ATTACK_FAILS' }, { condition: tails() })] }),
  'Discard a [R] Energy from this Pokémon.': () => ({ effects: [post(discardOwn('FIRE', 1))] }),
  'Discard 1 [R] Energy from this Pokémon.': () => ({ effects: [post(discardOwn('FIRE', 1))] }),
  'Discard 2 [R] Energy from this Pokémon.': () => ({ effects: [post(discardOwn('FIRE', 2))] }),
  'Discard 2 [P] Energy from this Pokémon.': () => ({ effects: [post(discardOwn('PSYCHIC', 2))] }),
  'Discard all Energy from this Pokémon.': () => ({ effects: [post(discardOwn('ANY', 'ALL'))] }),
  "Flip a coin. If heads, the Defending Pokémon can't attack during your opponent's next turn.": () => ({
    effects: [pre(flip(1)), post({ type: 'RESTRICT_ACTION', target: DEFENDING, actions: ['ATTACK'], duration: NEXT_TURN_WHILE_ACTIVE }, { condition: atLeastHeads(1) })],
  }),
  "During your opponent's next turn, the Defending Pokémon can't attack.": () => ({
    effects: [post({ type: 'RESTRICT_ACTION', target: DEFENDING, actions: ['ATTACK'], duration: NEXT_TURN_WHILE_ACTIVE })],
  }),
  "During your opponent's next turn, the Defending Pokémon can't retreat.": () => ({
    effects: [post({ type: 'RESTRICT_ACTION', target: DEFENDING, actions: ['RETREAT'], duration: NEXT_TURN_WHILE_ACTIVE })],
  }),
  "During your opponent's next turn, attacks used by the Defending Pokémon do -20 damage.": () => ({
    effects: [post({ type: 'MODIFY', stat: 'DAMAGE_DEALT', amount: -20, target: DEFENDING, duration: NEXT_TURN_WHILE_ACTIVE, appliesTo: { damageCategory: 'ATTACK' } })],
  }),
  "During your opponent's next turn, this Pokémon takes -20 damage from attacks.": () => ({
    effects: [post({ type: 'MODIFY', stat: 'DAMAGE_TAKEN', amount: -20, target: SELF, duration: { kind: 'NEXT_OPPONENT_TURN' }, appliesTo: { damageCategory: 'ATTACK' } })],
  }),
  'This Pokémon also does 20 damage to itself.': () => ({ effects: [post(selfDamage(20))] }),
  'This Pokémon also does 50 damage to itself.': () => ({ effects: [post(selfDamage(50))] }),
  'If this Pokémon has at least 2 extra [W] Energy attached, this attack does 60 more damage.': () => ({ effects: [bonusIf(60, extraAtLeast(2))] }),
  'If this Pokémon has at least 3 extra [W] Energy attached, this attack does 70 more damage.': () => ({ effects: [bonusIf(70, extraAtLeast(3))] }),
  "Your opponent can't use any Supporter cards from their hand during their next turn.": () => ({
    effects: [post({ type: 'RESTRICT_ACTION', target: { scope: 'OPPONENT_POKEMON' }, actions: ['PLAY_SUPPORTER'], duration: { kind: 'NEXT_OPPONENT_TURN' } })],
  }),
  'Flip 2 coins. If both of them are heads, this attack does 80 more damage.': () => ({ effects: [pre(flip(2)), bonusIf(80, atLeastHeads(2))] }),
  "This attack does 50 damage to 1 of your opponent's Pokémon.": () => ({ damage: 50, target: choose('OPPONENT_POKEMON') }),
  "This attack does 30 damage to 1 of your opponent's Pokémon.": () => ({ damage: 30, target: choose('OPPONENT_POKEMON') }),
  "This attack does 30 damage to 1 of your opponent's Benched Pokémon.": () => ({ damage: 30, target: choose('OPPONENT_BENCH') }),
  "Discard a random Energy from your opponent's Active Pokémon.": () => ({ effects: [post(discardRandomFromDefender)] }),
  "Flip a coin. If heads, discard a random Energy from your opponent's Active Pokémon.": () => ({
    effects: [pre(flip(1)), post(discardRandomFromDefender, { condition: atLeastHeads(1) })],
  }),
  "Flip a coin. If heads, your opponent's Active Pokémon is now Paralyzed.": () => ({
    effects: [pre(flip(1)), post(condition('PARALYZED'), { condition: atLeastHeads(1) })],
  }),
  "This attack also does 10 damage to each of your opponent's Benched Pokémon.": () => ({
    effects: [post({ type: 'DEAL_DAMAGE', target: { scope: 'OPPONENT_BENCH', pick: { mode: 'ALL' } }, amount: 10, category: 'ATTACK' })],
  }),
  'This attack also does 30 damage to 1 of your Benched Pokémon.': () => ({
    effects: [post({ type: 'DEAL_DAMAGE', target: choose('OWN_BENCH'), amount: 30, category: 'ATTACK' })],
  }),
  "If your opponent's Active Pokémon has damage on it, this attack does 60 more damage.": () => ({ effects: [bonusIf(60, exists('OPPONENT_ACTIVE', { hasDamage: true }))] }),
  'If this Pokémon has damage on it, this attack does 60 more damage.': () => ({ effects: [bonusIf(60, exists('SELF', { hasDamage: true }))] }),
  "If your opponent's Active Pokémon is Poisoned, this attack does 50 more damage.": () => ({ effects: [bonusIf(50, exists('OPPONENT_ACTIVE', { hasCondition: 'POISONED' }))] }),
  'This attack does 30 damage for each of your Benched [L] Pokémon.': () => ({
    formula: mul(c(30), count({ scope: 'OWN_BENCH', filter: { types: ['LIGHTNING'] } })),
  }),
  'This attack does 30 damage for each of your Benched Pokémon.': () => ({ formula: mul(c(30), { op: 'COUNT_BENCH_POKEMON', side: 'OWN' }) }),
  'This attack does 50 more damage for each of your Benched Nidoking.': (n) => ({
    formula: add(c(base(n)), mul(c(50), count({ scope: 'OWN_BENCH', filter: { deckLimitKeys: ['nidoking'] } }))),
  }),
  "This attack does 30 more damage for each Energy attached to your opponent's Active Pokémon.": (n) => ({
    formula: add(c(base(n)), mul(c(30), { op: 'COUNT_ATTACHED_ENERGIES', selector: OPP_ACTIVE })),
  }),
  "This attack does 20 more damage for each Energy attached to your opponent's Active Pokémon.": (n) => ({
    formula: add(c(base(n)), mul(c(20), { op: 'COUNT_ATTACHED_ENERGIES', selector: OPP_ACTIVE })),
  }),
  'Flip a coin. If heads, this attack does 40 more damage. If tails, this Pokémon also does 20 damage to itself.': (n) => ({
    formula: add(c(base(n)), mul(c(40), heads())), effects: [pre(flip(1)), post(selfDamage(20), { condition: tails() })],
  }),
  'Switch this Pokémon with 1 of your Benched Pokémon.': () => ({ effects: [post({ type: 'SWITCH_ACTIVE', side: 'OWN', chooser: 'CONTROLLER' })] }),
  "Switch out your opponent's Active Pokémon to the Bench. (Your opponent chooses the new Active Pokémon.)": () => ({
    effects: [post({ type: 'SWITCH_ACTIVE', side: 'OPPONENT', chooser: 'OPPONENT' })],
  }),
  'Flip a coin. If heads, during your opponent\'s next turn, prevent all damage from—and effects of—attacks done to this Pokémon.': () => ({
    effects: [
      pre(flip(1)),
      post({ type: 'PREVENT_DAMAGE', target: SELF, categories: ['ATTACK'], amount: 'ALL', duration: { kind: 'NEXT_OPPONENT_TURN' } }, { condition: atLeastHeads(1) }),
      post({ type: 'PREVENT_EFFECTS', target: SELF, fromSide: 'OPPONENT', duration: { kind: 'NEXT_OPPONENT_TURN' } }, { condition: atLeastHeads(1) }),
    ],
  }),
  "Heal from this Pokémon the same amount of damage you did to your opponent's Active Pokémon.": () => ({
    effects: [post({ type: 'HEAL_DAMAGE', target: SELF, amount: { op: 'DAMAGE_DEALT_BY_ATTACK' } })],
  }),
  'Put 1 random Nidoran♂ from your deck onto your Bench.': () => ({
    effects: [post({ type: 'PUT_ON_BENCH', from: 'DECK', filter: { categories: ['POKEMON'], deckLimitKeys: ['nidoran-m'] }, count: 1, mode: 'RANDOM', side: 'OWN' })],
  }),
  "1 of your opponent's Pokémon is chosen at random 4 times. For each time a Pokémon was chosen, do 50 damage to it.": () => ({
    effects: [1, 2, 3, 4].map(() => post({ type: 'DEAL_DAMAGE', target: { scope: 'OPPONENT_POKEMON', pick: { mode: 'RANDOM', count: 1 } }, amount: 50, category: 'ATTACK' })),
  }),
  'Draw 1 card.': () => ({ effects: [post({ type: 'DRAW_CARDS', player: 'OWN', count: 1 })] }),
  "Flip a coin. If heads, discard a random card from your opponent's hand.": () => ({
    effects: [pre(flip(1)), post({ type: 'DISCARD_CARDS', zone: 'OPPONENT_HAND', count: 1, chooser: 'RANDOM' }, { condition: atLeastHeads(1) })],
  }),
  "Choose 1 of your opponent's Pokémon's attacks and use it as this attack. If this Pokémon doesn't have the necessary Energy to use that attack, this attack does nothing.": () => ({
    effects: [post({ type: 'COPY_ATTACK', from: choose('OPPONENT_POKEMON'), requireEnergy: true })],
  }),
  'Flip a coin. If heads, your opponent shuffles their Active Pokémon back into their deck.': () => ({
    effects: [pre(flip(1)), post({ type: 'SHUFFLE_INTO_DECK', target: OPP_ACTIVE }, { condition: atLeastHeads(1) })],
  }),
  'Your opponent reveals their hand.': () => ({ effects: [post({ type: 'REVEAL_HAND', player: 'OPPONENT' })] }),
};

type AbilityFx = (id: string, name: string) => Ability;
const once = { scope: 'INSTANCE_TURN', count: 1 } as const;
const activate = (operation: Operation, extra: Partial<EffectBlock> = {}) => block('ON_ACTIVATE', operation, { failurePolicy: 'REQUIRE_ANY', ...extra });

/** Habilidades por texto (13). */
export const ABILITY_EFFECTS: Readonly<Record<string, AbilityFx>> = {
  'Once during your turn, you may heal 20 damage from each of your Pokémon.': (id, name) => ability({ id, name, kind: 'ACTIVATED', sourcePositions: ['ACTIVE', 'BENCH'], usageLimit: once,
    effects: [activate({ type: 'HEAL_DAMAGE', target: { scope: 'OWN_POKEMON', pick: { mode: 'ALL' } }, amount: 20 })] }),
  "If this Pokémon is in the Active Spot, once during your turn, you may switch in 1 of your opponent's Benched Basic Pokémon to the Active Spot.": (id, name) => ability({ id, name,
    kind: 'ACTIVATED', sourcePositions: ['ACTIVE'], usageLimit: once,
    effects: [activate({ type: 'SWITCH_ACTIVE', side: 'OPPONENT', chooser: 'CONTROLLER', filter: { stages: ['BASIC'] } })] }),
  "If this Pokémon is in the Active Spot and is damaged by an attack from your opponent's Pokémon, do 20 damage to the Attacking Pokémon.": (id, name) => ability({ id, name,
    kind: 'TRIGGERED', sourcePositions: ['ACTIVE'], trigger: { event: 'DAMAGE_APPLIED', filter: { subject: 'SELF', subjectRole: 'TARGET', damageCategory: 'ATTACK', turnOf: 'OPPONENT' } },
    effects: [block('ON_TRIGGER', { type: 'DEAL_DAMAGE', target: { scope: 'EVENT_SOURCE' }, amount: 20, category: 'EFFECT' })] }),
  'This Pokémon takes -10 damage from attacks.': (id, name) => ability({ id, name, kind: 'CONTINUOUS', sourcePositions: ['ACTIVE', 'BENCH'],
    effects: [continuous({ type: 'MODIFY', stat: 'DAMAGE_TAKEN', amount: -10, target: SELF, duration: { kind: 'WHILE_SOURCE_IN_PLAY' }, appliesTo: { damageCategory: 'ATTACK' } })] }),
  'This Pokémon takes -20 damage from attacks.': (id, name) => ability({ id, name, kind: 'CONTINUOUS', sourcePositions: ['ACTIVE', 'BENCH'],
    effects: [continuous({ type: 'MODIFY', stat: 'DAMAGE_TAKEN', amount: -20, target: SELF, duration: { kind: 'WHILE_SOURCE_IN_PLAY' }, appliesTo: { damageCategory: 'ATTACK' } })] }),
  "Once during your turn, you may do 20 damage to 1 of your opponent's Pokémon.": (id, name) => ability({ id, name, kind: 'ACTIVATED', sourcePositions: ['ACTIVE', 'BENCH'], usageLimit: once,
    effects: [activate({ type: 'DEAL_DAMAGE', target: choose('OPPONENT_POKEMON'), amount: 20, category: 'EFFECT' })] }),
  'Once during your turn, you may take a [L] Energy from your Energy Zone and attach it to this Pokémon.': (id, name) => ability({ id, name, kind: 'ACTIVATED',
    sourcePositions: ['ACTIVE', 'BENCH'], usageLimit: once,
    effects: [activate({ type: 'ATTACH_ENERGY', target: SELF, energyType: 'LIGHTNING', count: 1, source: 'GENERATED' })] }),
  "As long as this Pokémon is in the Active Spot, your opponent can't use any Supporter cards from their hand.": (id, name) => ability({ id, name, kind: 'CONTINUOUS',
    sourcePositions: ['ACTIVE'],
    effects: [continuous({ type: 'RESTRICT_ACTION', target: { scope: 'OPPONENT_POKEMON' }, actions: ['PLAY_SUPPORTER'], duration: { kind: 'WHILE_SOURCE_IN_PLAY', removeOn: ['SOURCE_LEAVES_ACTIVE'] } })] }),
  "Once during your turn, you may flip a coin. If heads, your opponent's Active Pokémon is now Asleep.": (id, name) => ability({ id, name, kind: 'ACTIVATED',
    sourcePositions: ['ACTIVE', 'BENCH'], usageLimit: once,
    effects: [activate(flip(1)), block('ON_ACTIVATE', condition('ASLEEP'), { condition: atLeastHeads(1) })] }),
  'Once during your turn, you may take 1 [P] Energy from your Energy Zone and attach it to the [P] Pokémon in the Active Spot.': (id, name) => ability({ id, name, kind: 'ACTIVATED',
    sourcePositions: ['ACTIVE', 'BENCH'], usageLimit: once,
    effects: [activate({ type: 'ATTACH_ENERGY', target: { scope: 'OWN_ACTIVE', filter: { types: ['PSYCHIC'] } }, energyType: 'PSYCHIC', count: 1, source: 'GENERATED' })] }),
  "Once during your turn, if this Pokémon is in the Active Spot, you may make your opponent's Active Pokémon Poisoned.": (id, name) => ability({ id, name, kind: 'ACTIVATED',
    sourcePositions: ['ACTIVE'], usageLimit: once, effects: [activate(condition('POISONED'))] }),
  "Once during your turn, you may switch out your opponent's Active Pokémon to the Bench. (Your opponent chooses the new Active Pokémon.)": (id, name) => ability({ id, name,
    kind: 'ACTIVATED', sourcePositions: ['ACTIVE', 'BENCH'], usageLimit: once, effects: [activate({ type: 'SWITCH_ACTIVE', side: 'OPPONENT', chooser: 'OPPONENT' })] }),
  'Once during your turn, you may look at the top card of your deck.': (id, name) => ability({ id, name, kind: 'ACTIVATED', sourcePositions: ['ACTIVE', 'BENCH'], usageLimit: once,
    effects: [activate({ type: 'LOOK_AT_TOP', player: 'OWN', count: 1 })] }),
};

export type TrainerFx = { readonly subtype: TrainerSubtype; readonly effects: EffectBlock[]; readonly rules?: Partial<TrainerRules> };

const named = (keys: readonly string[], extra: PokemonFilter = {}): PokemonFilter => ({ deckLimitKeys: keys, ...extra });
const existsOwn = (scope: Selector['scope'], filter: PokemonFilter): Condition => ({ op: 'EXISTS', selector: { scope, filter } });
const FOSSIL: TrainerFx = {
  subtype: 'ITEM', effects: [],
  rules: {
    destinationAfterPlay: 'BENCH_AS_POKEMON',
    fieldBehavior: { kind: 'PLAY_AS_POKEMON', hp: 40, types: ['COLORLESS'], retreatAllowed: false, knockoutPoints: 1, canAttack: false, ownerMayDiscardDuringMainPhase: true },
  },
};
const damageBoost = (amount: number, filter?: PokemonFilter): EffectBlock => onPlay({ type: 'MODIFY', stat: 'DAMAGE_DEALT', amount,
  target: { scope: 'OWN_POKEMON', ...(filter ? { filter } : {}) }, duration: { kind: 'THIS_TURN' }, appliesTo: { opponentActiveOnly: true, damageCategory: 'ATTACK' } }, { failurePolicy: 'BEST_EFFORT' });

/** Treinadores do A1 por texto (11; os três Fósseis têm o mesmo texto). */
export const TRAINER_EFFECTS: Readonly<Record<string, TrainerFx>> = {
  "Play this card as if it were a 40-HP Basic [C] Pokémon. At any time during your turn, you may discard this card from play. This card can't retreat.": FOSSIL,
  'Heal 50 damage from 1 of your [G] Pokémon.': {
    subtype: 'SUPPORTER',
    effects: [onPlay({ type: 'HEAL_DAMAGE', target: choose('OWN_POKEMON', { types: ['GRASS'], hasDamage: true }), amount: 50 }, { failurePolicy: 'REQUIRE_ANY' })],
  },
  'Choose 1 of your [W] Pokémon, and flip a coin until you get tails. For each heads, take a [W] Energy from your Energy Zone and attach it to that Pokémon.': {
    subtype: 'SUPPORTER',
    rules: { playConditions: [existsOwn('OWN_POKEMON', { types: ['WATER'] })] },
    effects: [
      onPlay({ type: 'FLIP_COINS', untilTails: true, outputId: 'coins' }),
      onPlay({ type: 'ATTACH_ENERGY', target: choose('OWN_POKEMON', { types: ['WATER'] }), energyType: 'WATER', count: heads(), source: 'GENERATED' }, { failurePolicy: 'BEST_EFFORT' }),
    ],
  },
  'During this turn, attacks used by your Ninetales, Rapidash, or Magmar do +30 damage to your opponent\'s Active Pokémon.': {
    subtype: 'SUPPORTER', effects: [damageBoost(30, named(['ninetales', 'rapidash', 'magmar']))],
  },
  'Put your Muk or Weezing in the Active Spot into your hand.': {
    subtype: 'SUPPORTER',
    rules: { playConditions: [existsOwn('OWN_ACTIVE', named(['muk', 'weezing']))] },
    effects: [onPlay({ type: 'RETURN_TO_HAND', target: { scope: 'OWN_ACTIVE', filter: named(['muk', 'weezing']) } }, { failurePolicy: 'REQUIRE_ANY' })],
  },
  "During this turn, attacks used by your Pokémon do +10 damage to your opponent's Active Pokémon.": { subtype: 'SUPPORTER', effects: [damageBoost(10)] },
  'Take a [F] Energy from your Energy Zone and attach it to Golem or Onix.': {
    subtype: 'SUPPORTER',
    effects: [onPlay({ type: 'ATTACH_ENERGY', target: choose('OWN_POKEMON', named(['golem', 'onix'])), energyType: 'FIGHTING', count: 1, source: 'GENERATED' }, { failurePolicy: 'REQUIRE_ANY' })],
  },
  "Switch out your opponent's Active Pokémon to the Bench. (Your opponent chooses the new Active Pokémon.)": {
    subtype: 'SUPPORTER', effects: [onPlay({ type: 'SWITCH_ACTIVE', side: 'OPPONENT', chooser: 'OPPONENT' }, { failurePolicy: 'REQUIRE_ANY' })],
  },
  'Move all [L] Energy from your Benched Pokémon to your Raichu, Electrode, or Electabuzz in the Active Spot.': {
    subtype: 'SUPPORTER',
    rules: { playConditions: [existsOwn('OWN_ACTIVE', named(['raichu', 'electrode', 'electabuzz']))] },
    effects: [onPlay({ type: 'MOVE_ENERGY', from: { scope: 'OWN_BENCH', pick: { mode: 'ALL' } }, to: { scope: 'OWN_ACTIVE', filter: named(['raichu', 'electrode', 'electabuzz']) },
      energyType: 'LIGHTNING', count: 'ALL' }, { failurePolicy: 'REQUIRE_ANY' })],
  },
};

