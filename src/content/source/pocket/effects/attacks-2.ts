// Efeitos de ataque dos sets do Pocket depois do A1 (parte 2): texto em inglês do `.inspo` → blocos do effects-dsl.
import type { Condition, EnergyType, Formula, Operation, PokemonFilter, Selector } from '../../../../domain/cards/types.ts';
import {
  add, anyEnergy, attachZone, base, bonusIf, c, choose, conditionOn, count, DEFENDING, discardOwn, discardRandomFrom, E, energyCount, EX, exists,
  extraAtLeast, extraDamage, healSelf, mul, named, OPP_ACTIVE, post, pre, SELF, selfDamage, snipe, spreadAll, type AttackFx,
} from './kit.ts';

const bonus = (more: number, when: Condition): AttackFx => ({ effects: [bonusIf(more, when)] });
const self = (filter: PokemonFilter): Condition => exists('SELF', filter);
const opp = (filter: PokemonFilter): Condition => exists('OPPONENT_ACTIVE', filter);
const plus = (each: number, unit: Formula) => (n: number | null): AttackFx => ({ formula: add(c(base(n)), mul(c(each), unit)) });
const times = (each: number, unit: Formula) => (): AttackFx => ({ formula: mul(c(each), unit) });
const bench = (side: 'OWN' | 'OPPONENT' | 'BOTH'): Formula => ({ op: 'COUNT_BENCH_POKEMON', side });
const remaining = (selector: Selector): Formula => ({ op: 'REMAINING_HP', selector });
const attach = (type: EnergyType, target: Selector, n = 1) => (): AttackFx => ({ effects: [post(attachZone(type, target, n))] });
const benchedBasic = choose('OWN_BENCH', { stages: ['BASIC'] });
const putOnBench = (keys?: readonly string[]): Operation => ({ type: 'PUT_ON_BENCH', from: 'DECK', count: 1, mode: 'RANDOM', side: 'OWN',
  filter: { categories: ['POKEMON'], ...(keys ? { deckLimitKeys: keys } : {}) } });
const hit = (n: number, target: Selector) => (): AttackFx => ({ effects: [post(extraDamage(n, target))] });

export const ATTACKS_2: Readonly<Record<string, (printed: number | null) => AttackFx>> = {
  'If this Pokémon evolved during this turn, this attack does 20 more damage.': () => bonus(20, self({ evolvedThisTurn: true })),
  "If this Pokémon evolved from Dunsparce during this turn, discard 2 random Energy from your opponent's Active Pokémon.": () => ({
    effects: [post(discardRandomFrom(OPP_ACTIVE, 2), { condition: self({ evolvedThisTurn: true }) })],
  }),
  'If this Pokémon has 2 or more different types of Energy attached, this attack does 60 more damage.': () => bonus(60, { op: 'COMPARE', left: { op: 'DISTINCT_ENERGY_TYPES', selector: SELF }, cmp: 'GE', right: c(2) }),
  'If this Pokémon has a Pokémon Tool attached, this attack does 30 more damage.': () => bonus(30, self({ hasTool: true })),
  'If this Pokémon has a Pokémon Tool attached, this attack does 40 more damage.': () => bonus(40, self({ hasTool: true })),
  'If this Pokémon has a Pokémon Tool attached, this attack does 50 more damage.': () => bonus(50, self({ hasTool: true })),
  "If this Pokémon has any [P] Energy attached, this attack does 40 more damage. This attack's damage isn't affected by any effects on your opponent's Active Pokémon.": () => ({
    effects: [bonusIf(40, anyEnergy(E('P')))], ignoreDefenderEffects: true,
  }),
  'If this Pokémon has any [W] Energy attached, this attack does 40 more damage.': () => bonus(40, anyEnergy(E('W'))),
  'If this Pokémon has at least 1 extra [W] Energy attached, this attack does 40 more damage.': () => bonus(40, extraAtLeast(E('W'), 1)),
  'If this Pokémon has at least 2 extra [F] Energy attached, this attack does 50 more damage.': () => bonus(50, extraAtLeast(E('F'), 2)),
  'If this Pokémon has at least 2 extra [F] Energy attached, this attack does 60 more damage.': () => bonus(60, extraAtLeast(E('F'), 2)),
  'If this Pokémon has at least 2 extra [L] Energy attached, this attack does 80 more damage.': () => bonus(80, extraAtLeast(E('L'), 2)),
  'If this Pokémon has at least 2 extra [R] Energy attached, this attack does 60 more damage.': () => bonus(60, extraAtLeast(E('R'), 2)),
  'If this Pokémon has at least 3 extra [G] Energy attached, this attack does 70 more damage.': () => bonus(70, extraAtLeast(E('G'), 3)),
  'If this Pokémon has damage on it, this attack can be used for 1 [L] Energy.': () => ({ alternativeCost: { condition: self({ hasDamage: true }), energyCost: { LIGHTNING: 1 } } }),
  'If this Pokémon has damage on it, this attack does 40 more damage.': () => bonus(40, self({ hasDamage: true })),
  "If this Pokémon has more Energy attached than your opponent's Active Pokémon, this attack does 40 more damage.": () =>
    bonus(40, { op: 'COMPARE', left: energyCount(SELF), cmp: 'GT', right: energyCount(OPP_ACTIVE) }),
  'If this Pokémon has no damage on it, this attack does 40 more damage.': () => bonus(40, self({ hasDamage: false })),
  'If this Pokémon moved from your Bench to the Active Spot this turn, this attack does 50 more damage.': () => bonus(50, self({ movedToActiveThisTurn: true })),
  'If this Pokémon moved from your Bench to the Active Spot this turn, this attack does 60 more damage.': () => bonus(60, self({ movedToActiveThisTurn: true })),
  "If this Pokémon was damaged by an attack during your opponent's last turn while it was in the Active Spot, this attack does 50 more damage.": () =>
    bonus(50, self({ damagedByAttackLastOpponentTurn: true })),
  'If you played a Supporter card from your hand during this turn, this attack does 50 more damage.': () => bonus(50, { op: 'SUPPORTER_PLAYED_THIS_TURN' }),
  "If your opponent's Active Pokémon has “Team Rocket” in its name, this attack does 70 more damage.": () => bonus(70, opp({ tags: ['TEAM_ROCKET'] })),
  "If your opponent's Active Pokémon has a Pokémon Tool attached, this attack does 30 more damage.": () => bonus(30, opp({ hasTool: true })),
  "If your opponent's Active Pokémon has an Ability, this attack does 40 more damage.": () => bonus(40, opp({ hasAbility: true })),
  "If your opponent's Active Pokémon has damage on it, this attack does 40 more damage.": () => bonus(40, opp({ hasDamage: true })),
  "If your opponent's Active Pokémon has damage on it, this attack does 70 more damage.": () => bonus(70, opp({ hasDamage: true })),
  "If your opponent's Active Pokémon has more remaining HP than this Pokémon, this attack does 50 more damage.": () =>
    bonus(50, { op: 'COMPARE', left: remaining(OPP_ACTIVE), cmp: 'GT', right: remaining(SELF) }),
  "If your opponent's Active Pokémon is a [D] Pokémon, this attack does 30 more damage.": () => bonus(30, opp({ types: ['DARKNESS'] })),
  "If your opponent's Active Pokémon is a [F] Pokémon, this attack does 30 more damage.": () => bonus(30, opp({ types: ['FIGHTING'] })),
  "If your opponent's Active Pokémon is a [G] Pokémon, this attack does 40 more damage.": () => bonus(40, opp({ types: ['GRASS'] })),
  "If your opponent's Active Pokémon is a [M] Pokémon, this attack does 30 more damage.": () => bonus(30, opp({ types: ['METAL'] })),
  "If your opponent's Active Pokémon is a Basic Pokémon, this attack does 60 more damage.": () => bonus(60, opp({ stages: ['BASIC'] })),
  "If your opponent's Active Pokémon is a Pokémon ex, this attack does 30 more damage.": () => bonus(30, opp(EX)),
  "If your opponent's Active Pokémon is a Pokémon ex, this attack does 70 more damage.": () => bonus(70, opp(EX)),
  "If your opponent's Active Pokémon is a Pokémon ex, this attack does 80 more damage.": () => bonus(80, opp(EX)),
  "If your opponent's Active Pokémon is affected by a Special Condition, this attack does 60 more damage.": () => bonus(60, opp({ hasCondition: true })),
  "If your opponent's Active Pokémon is an Evolution Pokémon, this attack does 40 more damage.": () => bonus(40, opp({ stages: ['STAGE_1', 'STAGE_2'] })),
  "If your opponent's Active Pokémon is an evolved Pokémon, devolve it by putting the highest Stage Evolution card on it into your opponent's hand.": () => ({
    effects: [post({ type: 'DEVOLVE', target: OPP_ACTIVE })],
  }),
  "If your opponent's Active Pokémon is Burned, this attack does 60 more damage.": () => bonus(60, opp({ hasCondition: 'BURNED' })),
  "If your opponent's Active Pokémon is Poisoned, this attack does 40 more damage.": () => bonus(40, opp({ hasCondition: 'POISONED' })),
  "If your opponent's Active Pokémon is Poisoned, this attack does 60 more damage.": () => bonus(60, opp({ hasCondition: 'POISONED' })),
  "If your opponent's Active Pokémon is Zangoose, this attack does 40 more damage.": () => bonus(40, opp(named(['zangoose']))),
  "If your opponent's Pokémon is Knocked Out by damage from this attack, this Pokémon also does 50 damage to itself.": () => ({
    effects: [post(selfDamage(50), { condition: { op: 'COMPARE', left: remaining(DEFENDING), cmp: 'LE', right: c(0) } })],
  }),
  'Move all Energy from this Pokémon to 1 of your Benched Pokémon.': () => ({ effects: [post({ type: 'MOVE_ENERGY', from: SELF, to: choose('OWN_BENCH'), count: 'ALL' })] }),
  'Put 1 random Basic Pokémon from your deck onto your Bench.': () => ({ effects: [post(putOnBench())] }),
  'Put 1 random Koffing from your deck onto your Bench.': () => ({ effects: [post(putOnBench(['koffing']))] }),
  'Put 1 random Poliwag from your deck onto your Bench.': () => ({ effects: [post(putOnBench(['poliwag']))] }),
  'Put 1 random Weedle from your deck onto your Bench.': () => ({ effects: [post(putOnBench(['weedle']))] }),
  'Put 1 random Wishiwashi or Wishiwashi ex from your deck onto your Bench.': () => ({ effects: [post(putOnBench(['wishiwashi', 'wishiwashi-ex']))] }),
  'Put a random card that evolves from Rockruff from your deck into your hand.': () => ({
    effects: [post({ type: 'SEARCH_DECK', player: 'OWN', filter: { categories: ['POKEMON'], evolvesFrom: ['rockruff'] }, count: 1, mode: 'RANDOM', destination: 'HAND', reveal: true, shuffleAfter: true })],
  }),
  'Put a random Pokémon from your deck into your hand.': () => ({
    effects: [post({ type: 'SEARCH_DECK', player: 'OWN', filter: { categories: ['POKEMON'] }, count: 1, mode: 'RANDOM', destination: 'HAND', reveal: true, shuffleAfter: true })],
  }),
  'Reveal all of your Pokémon in play and in your hand that have the Puppy Pile attack, and this attack does 20 damage for each Pokémon you revealed in this way.': () => ({
    formula: mul(c(20), add(count({ scope: 'OWN_POKEMON', filter: { attackIds: ['puppy-pile'] } }), { op: 'COUNT_CARDS', zone: 'OWN_HAND', filter: { categories: ['POKEMON'], attackIds: ['puppy-pile'] } })),
  }),
  'Reveal the top 6 cards of your deck. This attack does 30 damage for each Pokémon you find there that has “Team Rocket” in its name. Shuffle the revealed cards back into your deck.': () => ({
    formula: mul(c(30), { op: 'TOP_CARDS_MATCHING', count: 6, filter: { categories: ['POKEMON'], tags: ['TEAM_ROCKET'] } }),
    effects: [post({ type: 'SHUFFLE_DECK', player: 'OWN' })],
  }),
  "Shuffle your hand into your deck. Draw a card for each card in your opponent's hand.": () => ({
    effects: [post({ type: 'SHUFFLE_HAND_INTO_DECK', player: 'OWN' }), post({ type: 'DRAW_CARDS', player: 'OWN', count: { op: 'COUNT_CARDS', zone: 'OPPONENT_HAND' } })],
  }),
  'Switch this Pokémon with 1 of your Benched [L] Pokémon.': () => ({ effects: [post({ type: 'SWITCH_ACTIVE', side: 'OWN', chooser: 'CONTROLLER', filter: { types: ['LIGHTNING'] } })] }),
  'Take 2 [M] Energy from your Energy Zone and attach it to 1 of your Benched Pokémon.': attach(E('M'), choose('OWN_BENCH'), 2),
  'Take 3 [R] Energy from your Energy Zone and attach it to this Pokémon.': attach(E('R'), SELF, 3),
  'Take a [C] Energy from your Energy Zone and attach it to 1 of your Benched Pokémon.': () => ({
    effects: [post({ type: 'ATTACH_ENERGY', target: choose('OWN_BENCH'), energyType: 'ZONE_RANDOM', count: 1, source: 'GENERATED' })],
  }),
  'Take a [G] Energy from your Energy Zone and attach it to this Pokémon.': attach(E('G'), SELF),
  'Take a [L] Energy from your Energy Zone and attach it to 1 of your Benched [L] Pokémon.': attach(E('L'), choose('OWN_BENCH', { types: ['LIGHTNING'] })),
  'Take a [L] Energy from your Energy Zone and attach it to 1 of your Benched Basic Pokémon.': attach(E('L'), benchedBasic),
  'Take a [L] Energy from your Energy Zone and attach it to this Pokémon.': attach(E('L'), SELF),
  'Take a [P] Energy from your Energy Zone and attach it to Mesprit or Azelf.': attach(E('P'), choose('OWN_POKEMON', named(['mesprit', 'azelf']))),
  'Take a [P] Energy from your Energy Zone and attach it to this Pokémon.': attach(E('P'), SELF),
  'Take a [R] Energy from your Energy Zone and attach it to 1 of your Benched Basic Pokémon.': attach(E('R'), benchedBasic),
  'Take a [R] Energy from your Energy Zone and attach it to 1 of your Benched Pokémon.': attach(E('R'), choose('OWN_BENCH')),
  'Take a [R] Energy from your Energy Zone and attach it to this Pokémon.': attach(E('R'), SELF),
  'Take a [R], [W], and [L] Energy from your Energy Zone and attach them to your Benched Basic Pokémon in any way you like.': () => ({
    effects: [post({ type: 'ATTACH_ENERGY', target: { scope: 'OWN_BENCH', filter: { stages: ['BASIC'] } }, energyType: 'FIRE', energyTypes: [E('R'), E('W'), E('L')], count: 3, source: 'GENERATED', distribute: true })],
  }),
  'Take a [W] Energy from your Energy Zone and attach it to 1 of your Benched Basic Pokémon.': attach(E('W'), benchedBasic),
  'Take a [W] Energy from your Energy Zone and attach it to this Pokémon.': attach(E('W'), SELF),
  'Take a random Energy from among [G], [R], [W], [L], [P], [F], [D], and [M] Energy from your Energy Zone and attach it to 1 of your Benched Pokémon.': () => ({
    effects: [post({ type: 'ATTACH_ENERGY', target: choose('OWN_BENCH'), energyType: 'RANDOM', count: 1, source: 'GENERATED' })],
  }),
  'This attack also does 10 damage to 1 of your Benched Pokémon.': hit(10, choose('OWN_BENCH')),
  "This attack also does 10 damage to 1 of your opponent's Benched Pokémon.": hit(10, choose('OPPONENT_BENCH')),
  'This attack also does 10 damage to each of your Benched Pokémon.': hit(10, spreadAll('OWN_BENCH')),
  'This attack also does 20 damage to 1 of your Benched Pokémon.': hit(20, choose('OWN_BENCH')),
  "This attack also does 20 damage to 1 of your opponent's Benched Pokémon.": hit(20, choose('OPPONENT_BENCH')),
  'This attack also does 20 damage to 1 of your Pokémon.': hit(20, choose('OWN_POKEMON')),
  'This attack also does 20 damage to each of your Benched Pokémon.': hit(20, spreadAll('OWN_BENCH')),
  "This attack also does 20 damage to each of your opponent's Benched Pokémon.": hit(20, spreadAll('OPPONENT_BENCH')),
  "This attack also does 30 damage to 1 of your opponent's Benched Pokémon.": hit(30, choose('OPPONENT_BENCH')),
  'This attack does 10 damage for each of your Benched [L] Pokémon.': times(10, count({ scope: 'OWN_BENCH', filter: { types: ['LIGHTNING'] } })),
  "This attack does 10 damage to 1 of your opponent's Pokémon.": () => snipe(10),
  "This attack does 10 damage to each of your opponent's Pokémon.": () => ({ damage: 10, target: spreadAll('OPPONENT_POKEMON') }),
  "This attack does 100 damage to 1 of your opponent's Pokémon that have damage on them.": () => snipe(100, 'OPPONENT_POKEMON', { hasDamage: true }),
  "This attack does 20 damage for each Benched Pokémon (both yours and your opponent's).": times(20, bench('BOTH')),
  "This attack does 20 damage for each Energy attached to all of your opponent's Pokémon.": times(20, energyCount({ scope: 'OPPONENT_POKEMON' })),
  "This attack does 20 damage for each Energy attached to your opponent's Active Pokémon.": times(20, energyCount(OPP_ACTIVE)),
  'This attack does 20 damage for each of your Benched Pokémon.': times(20, bench('OWN')),
  "This attack does 20 damage to 1 of your opponent's Benched Pokémon.": () => snipe(20, 'OPPONENT_BENCH'),
  "This attack does 20 damage to 1 of your opponent's Pokémon for each Energy attached to that Pokémon.": () => ({
    target: choose('OPPONENT_POKEMON'), formula: mul(c(20), energyCount({ scope: 'TARGET' })),
  }),
  "This attack does 20 damage to 1 of your opponent's Pokémon.": () => snipe(20),
  "This attack does 20 damage to each of your opponent's Pokémon.": () => ({ damage: 20, target: spreadAll('OPPONENT_POKEMON') }),
  'This attack does 20 more damage for each [G] Energy attached to this Pokémon.': plus(20, energyCount(SELF, E('G'))),
  'This attack does 20 more damage for each [M] Energy attached to this Pokémon.': plus(20, energyCount(SELF, E('M'))),
  "This attack does 20 more damage for each Benched Pokémon (both yours and your opponent's).": plus(20, bench('BOTH')),
  'This attack does 20 more damage for each Energy attached to this Pokémon.': plus(20, energyCount(SELF)),
  'This attack does 20 more damage for each of your Benched Pokémon.': plus(20, bench('OWN')),
  "This attack does 20 more damage for each of your opponent's Benched Pokémon.": plus(20, bench('OPPONENT')),
  'This attack does 30 damage for each Pokémon Tool attached to all of your Pokémon.': times(30, count({ scope: 'OWN_POKEMON', filter: { hasTool: true } })),
  'This attack does 30 more damage for each Evolution Pokémon on your Bench.': plus(30, count({ scope: 'OWN_BENCH', filter: { stages: ['STAGE_1', 'STAGE_2'] } })),
  'This attack does 40 damage for each time your Pokémon used Sweets Relay during this game.': times(40, { op: 'ATTACKS_USED', attackId: 'sweets-relay', window: 'GAME' }),
  "This attack does 40 damage to 1 of your opponent's Pokémon.": () => snipe(40),
  "This attack does 40 more damage for each Energy in your opponent's Active Pokémon's Retreat Cost.": plus(40, { op: 'RETREAT_COST', selector: OPP_ACTIVE }),
  'This attack does 40 more damage for each of your Benched Wishiwashi or Wishiwashi ex.': plus(40, count({ scope: 'OWN_BENCH', filter: named(['wishiwashi', 'wishiwashi-ex']) })),
  "This attack does 50 damage to 1 of your opponent's Benched Pokémon.": () => snipe(50, 'OPPONENT_BENCH'),
  "This attack does 60 damage to 1 of your opponent's Pokémon.": () => snipe(60),
  "This attack does 70 damage to 1 of your opponent's Pokémon.": () => snipe(70),
  "This attack does damage to your opponent's Active Pokémon equal to the damage this Pokémon has on it.": () => ({ formula: { op: 'DAMAGE_ON_SOURCE' } }),
  'This attack does more damage equal to the damage this Pokémon has on it.': (n) => ({ formula: add(c(base(n)), { op: 'DAMAGE_ON_SOURCE' }) }),
  'This Pokémon also does 10 damage to itself.': () => ({ effects: [post(selfDamage(10))] }),
  'This Pokémon also does 30 damage to itself.': () => ({ effects: [post(selfDamage(30))] }),
  'This Pokémon also does 40 damage to itself.': () => ({ effects: [post(selfDamage(40))] }),
  'This Pokémon also does 70 damage to itself.': () => ({ effects: [post(selfDamage(70))] }),
  'This Pokémon is now Asleep.': () => ({ effects: [post(conditionOn('ASLEEP', SELF))] }),
  'This Pokémon is now Asleep. Heal 30 damage from it.': () => ({ effects: [post(conditionOn('ASLEEP', SELF)), post(healSelf(30))] }),
  'This Pokémon is now Confused.': () => ({ effects: [post(conditionOn('CONFUSED', SELF))] }),
  "Until this Pokémon leaves the Active Spot, this Pokémon's Rolling Frenzy attack does +30 damage. This effect stacks.": () => ({
    effects: [post({ type: 'MODIFY', stat: 'DAMAGE_DEALT', amount: 30, target: SELF, duration: { kind: 'WHILE_SOURCE_IN_PLAY', removeOn: ['TARGET_LEAVES_ACTIVE'] },
      appliesTo: { attackIds: ['rolling-frenzy'], damageCategory: 'ATTACK' } })],
  }),
  'You can use this attack only if you have Uxie and Azelf on your Bench. Discard all Energy from this Pokémon.': () => ({
    preconditions: [exists('OWN_BENCH', named(['uxie'])), exists('OWN_BENCH', named(['azelf']))],
    effects: [post(discardOwn('ANY', 'ALL'))],
  }),
  'You may discard any number of your Benched [W] Pokémon. This attack does 40 more damage for each Benched Pokémon you discarded in this way.': (n) => ({
    formula: add(c(base(n)), mul(c(40), { op: 'OUTPUT_COUNT', reference: 'discarded' })),
    effects: [pre({ type: 'DISCARD_POKEMON', target: { scope: 'OWN_BENCH', filter: { types: ['WATER'] }, pick: { mode: 'CHOOSE', chooser: 'CONTROLLER', min: 0, max: 3 }, outputId: 'discarded' } })],
  }),
  'You may move any amount of Energy from your Pokémon in play to your other Pokémon in any way you like.': () => ({ effects: [post({ type: 'MOVE_ENERGY_FREELY' })] }),
  'You may switch this Pokémon with 1 of your Benched Pokémon.': () => ({ effects: [post({ type: 'SWITCH_ACTIVE', side: 'OWN', chooser: 'CONTROLLER' }, { optional: true })] }),
  'Your opponent reveals a random card from their hand and shuffles it into their deck.': () => ({
    effects: [post({ type: 'RETURN_CARDS_TO_DECK', zone: 'OPPONENT_HAND', count: 1, chooser: 'RANDOM' })],
  }),
  "Your opponent reveals their hand. Choose a card you find there and shuffle it into your opponent's deck.": () => ({
    effects: [post({ type: 'REVEAL_HAND', player: 'OPPONENT' }), post({ type: 'RETURN_CARDS_TO_DECK', zone: 'OPPONENT_HAND', count: 1, chooser: 'CONTROLLER' })],
  }),
  'Your opponent reveals their hand. Choose a Supporter card you find there and discard it.': () => ({
    effects: [post({ type: 'REVEAL_HAND', player: 'OPPONENT' }), post({ type: 'DISCARD_CARDS', zone: 'OPPONENT_HAND', count: 1, chooser: 'CONTROLLER', filter: { subtypes: ['SUPPORTER'] } })],
  }),
  "Your opponent's Active Pokémon is now Burned.": () => ({ effects: [post(conditionOn('BURNED'))] }),
  "Your opponent's Active Pokémon is now Confused.": () => ({ effects: [post(conditionOn('CONFUSED'))] }),
  "Your opponent's Active Pokémon is now Poisoned and Burned.": () => ({ effects: [post(conditionOn('POISONED')), post(conditionOn('BURNED'))] }),
  "Your opponent's Active Pokémon is now Poisoned. Do 20 damage to this Pokémon instead of the usual amount for this Special Condition.": () => ({
    effects: [post({ type: 'APPLY_CONDITION', target: OPP_ACTIVE, condition: 'POISONED', poisonDamage: 20 })],
  }),
};
