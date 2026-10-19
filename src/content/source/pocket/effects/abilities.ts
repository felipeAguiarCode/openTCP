// Habilidades dos sets do Pocket depois do A1: texto em inglês do `.inspo` → Habilidade do effects-dsl.
import type { Condition, Operation, PokemonFilter } from '../../../../domain/cards/types.ts';
import {
  activate, activated, ACTIVE, atLeastHeads, attachZone, BENCH, BOTH, c, choose, cont, conditionOn, continuousAbility, discardRandomFrom, E, EX, exists,
  flip, healSelf, named, NEXT_OPP, OPP_ACTIVE, OWN_ACTIVE, SELF, spreadAll, trig, triggered, unlimited, WHILE, type AbilityFx,
} from './kit.ts';

const ULTRA_BEAST = 'ULTRA_BEAST';
const arceusInPlay: Condition = exists('OWN_POKEMON', named(['arceus', 'arceus-ex']));
const retreat = (amount: number, scope: 'SELF' | 'OWN_ACTIVE' = 'SELF', filter?: PokemonFilter): Operation =>
  ({ type: 'MODIFY', stat: 'RETREAT_COST', amount, target: { scope, ...(filter ? { filter } : {}) }, duration: WHILE });
const takes = (amount: number, attackerFilter?: PokemonFilter, scope: 'SELF' | 'OWN_POKEMON' = 'SELF'): Operation =>
  ({ type: 'MODIFY', stat: 'DAMAGE_TAKEN', amount, target: { scope }, duration: WHILE, appliesTo: { damageCategory: 'ATTACK', ...(attackerFilter ? { attackerFilter } : {}) } });
const deals = (amount: number, scope: 'SELF' | 'OWN_POKEMON' | 'OPPONENT_ACTIVE' = 'SELF', filter?: PokemonFilter): Operation =>
  ({ type: 'MODIFY', stat: 'DAMAGE_DEALT', amount, target: { scope, ...(filter ? { filter } : {}) }, duration: WHILE, appliesTo: { damageCategory: 'ATTACK' } });
const playedToEvolve = (op: Operation): AbilityFx => triggered(BOTH, { event: 'POKEMON_EVOLVED', filter: { subject: 'SELF', from: 'HAND' } }, [trig(op)],
  { optional: true, usageLimit: { scope: 'INSTANCE_TURN', count: 1 } });
const knockedOutByAttack = { event: 'POKEMON_KNOCKED_OUT', filter: { subject: 'SELF', cause: 'ATTACK' } } as const;
const fromZone = (energyType?: 'DARKNESS' | 'PSYCHIC') => ({ event: 'ENERGY_ATTACHED', filter: { subject: 'SELF', energySource: 'ENERGY_ZONE', ...(energyType ? { energyType } : {}) } }) as const;
const firstTurn: Condition = { op: 'COMPARE', left: { op: 'OWN_TURN_NUMBER', side: 'OWN' }, cmp: 'EQ', right: c(1) };
const otherInPlay = (key: string): Condition => exists('OWN_POKEMON', named([key], { excludeSelf: true }));
const unownOther = (exclude: string): Condition => exists('OWN_POKEMON', { deckLimitKeys: ['unown'], hasAbility: true, excludeAbilityIds: [exclude] });

export const ABILITIES: Readonly<Record<string, AbilityFx>> = {
  "As long as this Pokémon is in the Active Spot, attacks used by your opponent's Active Pokémon cost 1 [C] more.": continuousAbility(ACTIVE, [
    cont({ type: 'MODIFY', stat: 'ATTACK_COST', amount: 1, target: OPP_ACTIVE, duration: WHILE })]),
  "As long as this Pokémon is in the Active Spot, attacks used by your opponent's Active Pokémon do -20 damage.": continuousAbility(ACTIVE, [cont(deals(-20, 'OPPONENT_ACTIVE'))]),
  'As long as this Pokémon is in the Active Spot, it can evolve during your first turn or the turn you play it.': continuousAbility(ACTIVE, [
    cont({ type: 'GRANT_RULE', target: SELF, duration: WHILE, rule: 'EVOLVE_ANY_TURN' })]),
  'As long as this Pokémon is in the Active Spot, whenever you attach an Energy from your Energy Zone to it, it is now Asleep.': triggered(ACTIVE, fromZone(), [trig(conditionOn('ASLEEP', SELF))]),
  "As long as this Pokémon is on your Bench, attacks used by your Pokémon that evolve from Poliwhirl do +40 damage to your opponent's Active Pokémon.": continuousAbility(BENCH, [
    cont(deals(40, 'OWN_POKEMON', { evolvesFrom: ['poliwhirl'] }))]),
  "As long as this Pokémon is on your Bench, your Active Basic Pokémon's Retreat Cost is 1 less.": continuousAbility(BENCH, [cont(retreat(-1, 'OWN_ACTIVE', { stages: ['BASIC'] }))]),
  'As often as you like during your turn, you may choose 1 of your Pokémon that has damage on it, and move all of its damage to this Pokémon.': activated(BOTH, [
    activate({ type: 'MOVE_DAMAGE', from: choose('OWN_POKEMON', { hasDamage: true, excludeSelf: true }), to: SELF, amount: 'ALL' })], { usageLimit: unlimited }),
  'As often as you like during your turn, you may move a [W] Energy from 1 of your Benched [W] Pokémon to your Active [W] Pokémon.': activated(BOTH, [
    activate({ type: 'MOVE_ENERGY', from: choose('OWN_BENCH', { types: ['WATER'] }), to: { scope: 'OWN_ACTIVE', filter: { types: ['WATER'] } }, energyType: 'WATER', count: 1 })],
  { usageLimit: unlimited }),
  'At the beginning of your turn, if this Pokémon is in the Active Spot, put a random [P] Pokémon from your deck into your hand.': triggered(ACTIVE, { event: 'TURN_STARTED', filter: { turnOf: 'OWN' } }, [
    trig({ type: 'SEARCH_DECK', player: 'OWN', filter: { categories: ['POKEMON'], types: ['PSYCHIC'] }, count: 1, mode: 'RANDOM', destination: 'HAND', reveal: true, shuffleAfter: true })]),
  "At the end of each turn, if your opponent's Active Pokémon is Asleep, do 20 damage to that Pokémon.": triggered(BOTH, { event: 'TURN_ENDING' }, [
    trig({ type: 'DEAL_DAMAGE', target: OPP_ACTIVE, amount: 20, category: 'EFFECT' }, { condition: exists('OPPONENT_ACTIVE', { hasCondition: 'ASLEEP' }) })]),
  'At the end of your first turn, take a [L] Energy from your Energy Zone and attach it to this Pokémon.': triggered(BOTH, { event: 'TURN_ENDING', filter: { turnOf: 'OWN' } }, [
    trig(attachZone(E('L'), SELF), { condition: firstTurn })]),
  'At the end of your turn, if this Pokémon is in the Active Spot, draw a card.': triggered(ACTIVE, { event: 'TURN_ENDING', filter: { turnOf: 'OWN' } }, [
    trig({ type: 'DRAW_CARDS', player: 'OWN', count: 1 })]),
  'At the end of your turn, if this Pokémon is in the Active Spot, heal 20 damage from it.': triggered(ACTIVE, { event: 'TURN_ENDING', filter: { turnOf: 'OWN' } }, [trig(healSelf(20))]),
  "Attacks used by your [F] Pokémon do +20 damage to your opponent's Active Pokémon.": continuousAbility(BOTH, [cont(deals(20, 'OWN_POKEMON', { types: ['FIGHTING'] }))]),
  "During Pokémon Checkup, if this Pokémon is in the Active Spot, do 10 damage to your opponent's Active Pokémon.": triggered(ACTIVE, { event: 'TURN_ENDING' }, [
    trig({ type: 'DEAL_DAMAGE', target: OPP_ACTIVE, amount: 10, category: 'EFFECT' })]),
  'During your first turn, this Pokémon has no Retreat Cost.': continuousAbility(BOTH, [cont(retreat(-99))], { conditions: [firstTurn] }),
  "Each [G] Energy attached to your [G] Pokémon provides 2 [G] Energy. This effect doesn't stack.": continuousAbility(BOTH, [
    cont({ type: 'MODIFY', stat: 'ENERGY_PROVISION', amount: 1, energyType: 'GRASS', exclusive: true, target: { scope: 'OWN_POKEMON', filter: { types: ['GRASS'] } }, duration: WHILE })]),
  'Each of your evolved Pokémon can use any attack from its previous Evolutions. (You still need the necessary Energy to use each attack.)': continuousAbility(BOTH, [
    cont({ type: 'GRANT_RULE', target: { scope: 'OWN_POKEMON', filter: { stages: ['STAGE_1', 'STAGE_2'] } }, duration: WHILE, rule: 'PREVIOUS_EVOLUTION_ATTACKS' })]),
  'Each of your Pokémon that has any [P] Energy attached recovers from all Special Conditions and can\'t be affected by any Special Conditions.': continuousAbility(BOTH, [
    cont({ type: 'PREVENT_CONDITIONS', target: { scope: 'OWN_POKEMON', filter: { energyTypes: ['PSYCHIC'] } }, duration: WHILE })]),
  'If any damage is done to this Pokémon by attacks, flip a coin. If heads, prevent that damage.': continuousAbility(BOTH, [
    cont({ type: 'PREVENT_DAMAGE', target: SELF, categories: ['ATTACK'], amount: 'ALL', duration: WHILE, coinFlip: true })]),
  'If any damage is done to this Pokémon by attacks, flip a coin. If heads, this Pokémon takes -100 damage from that attack.': continuousAbility(BOTH, [
    cont({ type: 'PREVENT_DAMAGE', target: SELF, categories: ['ATTACK'], amount: 100, duration: WHILE, coinFlip: true })]),
  'If this Pokémon has a Pokémon Tool attached, attacks used by this Pokémon cost 1 less [G] Energy.': continuousAbility(BOTH, [
    cont({ type: 'MODIFY', stat: 'ATTACK_COST', amount: -1, energyType: 'GRASS', target: SELF, duration: WHILE })], { conditions: [exists('SELF', { hasTool: true })] }),
  'If this Pokémon has any Energy attached, it has no Retreat Cost.': continuousAbility(BOTH, [cont(retreat(-99))], { conditions: [exists('SELF', { hasEnergy: true })] }),
  "If this Pokémon is in the Active Spot and is Knocked Out by damage from an attack from your opponent's Pokémon, do 50 damage to the Attacking Pokémon.": triggered(ACTIVE, knockedOutByAttack, [
    trig({ type: 'DEAL_DAMAGE', target: { scope: 'EVENT_SOURCE' }, amount: 50, category: 'EFFECT' })]),
  "If this Pokémon is in the Active Spot and is Knocked Out by damage from an attack from your opponent's Pokémon, flip a coin. If heads, the Attacking Pokémon is Knocked Out.": triggered(ACTIVE, knockedOutByAttack, [
    trig(flip(1)), trig({ type: 'KNOCK_OUT', target: { scope: 'EVENT_SOURCE' } }, { condition: atLeastHeads(1) })]),
  "If this Pokémon is in the Active Spot and is Knocked Out by damage from an attack from your opponent's Pokémon, move all [F] Energy from this Pokémon to 1 of your Benched Pokémon.": triggered(ACTIVE, knockedOutByAttack, [
    trig({ type: 'MOVE_ENERGY', from: SELF, to: choose('OWN_BENCH'), energyType: 'FIGHTING', count: 'ALL' })]),
  'If this Pokémon would be Knocked Out by damage from an attack, flip a coin. If heads, this Pokémon is not Knocked Out, and its remaining HP becomes 10.': continuousAbility(BOTH, [
    cont({ type: 'SURVIVE_KNOCKOUT', target: SELF, duration: WHILE, remainingHp: 10 })]),
  "If you have another Beldum in play, this Pokémon's Retreat Cost is 2 less.": continuousAbility(BOTH, [cont(retreat(-2))], { conditions: [otherInPlay('beldum')] }),
  "If you have another Falinks in play, this Pokémon's attacks do +20 damage to your opponent's Active Pokémon, and this Pokémon takes -20 damage from attacks from your opponent's Pokémon.": continuousAbility(BOTH, [
    cont(deals(20)), cont(takes(-20))], { conditions: [otherInPlay('falinks')] }),
  'If you have Arceus or Arceus ex in play, attacks used by this Pokémon cost 1 less [C] Energy.': continuousAbility(BOTH, [
    cont({ type: 'MODIFY', stat: 'ATTACK_COST', amount: -1, target: SELF, duration: WHILE })], { conditions: [arceusInPlay] }),
  "If you have Arceus or Arceus ex in play, attacks used by this Pokémon do +30 damage to your opponent's Active Pokémon.": continuousAbility(BOTH, [cont(deals(30))], { conditions: [arceusInPlay] }),
  'If you have Arceus or Arceus ex in play, this Pokémon has no Retreat Cost.': continuousAbility(BOTH, [cont(retreat(-99))], { conditions: [arceusInPlay] }),
  'If you have Arceus or Arceus ex in play, this Pokémon takes -30 damage from attacks.': continuousAbility(BOTH, [cont(takes(-30))], { conditions: [arceusInPlay] }),
  'If you have Latias in play, this Pokémon has no Retreat Cost.': continuousAbility(BOTH, [cont(retreat(-99))], { conditions: [exists('OWN_POKEMON', named(['latias']))] }),
  "If your opponent's Pokémon is Knocked Out by damage from this Pokémon's attacks, during your opponent's next turn, prevent all damage from—and effects of—attacks done to this Pokémon.": triggered(BOTH, {
    event: 'POKEMON_KNOCKED_OUT', filter: { subject: 'SELF', subjectRole: 'SOURCE', cause: 'ATTACK' } }, [
    trig({ type: 'PREVENT_DAMAGE', target: SELF, categories: ['ATTACK'], amount: 'ALL', duration: NEXT_OPP }), trig({ type: 'PREVENT_EFFECTS', target: SELF, fromSide: 'OPPONENT', duration: NEXT_OPP })]),
  "Once during your turn, after you flip any coins for an attack of 1 of your [R] Pokémon, you may ignore all results of those coin flips and begin flipping those coins again. You can't use more than 1 Victory Star Ability each turn.": continuousAbility(BOTH, [
    cont({ type: 'REROLL_COINS', target: { scope: 'OWN_POKEMON', filter: { types: ['FIRE'] } }, duration: WHILE })]),
  'Once during your turn, if this Pokémon is in the Active Spot, you may heal 30 damage from 1 of your Pokémon.': activated(ACTIVE, [
    activate({ type: 'HEAL_DAMAGE', target: choose('OWN_POKEMON', { hasDamage: true }), amount: 30 })]),
  "Once during your turn, if this Pokémon is in the Active Spot, you may switch in 1 of your opponent's Benched Pokémon that has damage on it to the Active Spot.": activated(ACTIVE, [
    activate({ type: 'SWITCH_ACTIVE', side: 'OPPONENT', chooser: 'CONTROLLER', filter: { hasDamage: true } })]),
  'Once during your turn, if this Pokémon is in the Active Spot, you may take a [G] Energy from your Energy Zone and attach it to 1 of your [G] Pokémon.': activated(ACTIVE, [
    activate(attachZone(E('G'), choose('OWN_POKEMON', { types: ['GRASS'] })))]),
  'Once during your turn, if this Pokémon is on your Bench, you may switch it with your Active Pokémon.': activated(BENCH, [
    activate({ type: 'SWITCH_ACTIVE', side: 'OWN', chooser: 'CONTROLLER', incoming: 'SELF' })]),
  "Once during your turn, if you have Arceus or Arceus ex in play, you may do 30 damage to your opponent's Active Pokémon.": activated(BOTH, [
    activate({ type: 'DEAL_DAMAGE', target: OPP_ACTIVE, amount: 30, category: 'EFFECT' })], { conditions: [arceusInPlay] }),
  "Once during your turn, when you play this Pokémon from your hand to evolve 1 of your Pokémon, you may discard a random Energy from your opponent's Active Pokémon.": playedToEvolve(discardRandomFrom(OPP_ACTIVE)),
  'Once during your turn, when you play this Pokémon from your hand to evolve 1 of your Pokémon, you may draw 2 cards.': playedToEvolve({ type: 'DRAW_CARDS', player: 'OWN', count: 2 }),
  'Once during your turn, when you play this Pokémon from your hand to evolve 1 of your Pokémon, you may heal 60 damage from 1 of your [W] Pokémon.': playedToEvolve({
    type: 'HEAL_DAMAGE', target: choose('OWN_POKEMON', { types: ['WATER'] }), amount: 60 }),
  'Once during your turn, when you play this Pokémon from your hand to evolve 1 of your Pokémon, you may take a [R] Energy from your Energy Zone and attach it to your Active [R] Pokémon.': playedToEvolve(
    attachZone(E('R'), { scope: 'OWN_ACTIVE', filter: { types: ['FIRE'] } })),
  'Once during your turn, when you put this Pokémon from your hand onto your Bench, you may have your opponent reveal their hand.': triggered(BENCH, {
    event: 'POKEMON_ENTERED', filter: { subject: 'SELF', from: 'HAND' } }, [trig({ type: 'REVEAL_HAND', player: 'OPPONENT' })], { optional: true, usageLimit: { scope: 'INSTANCE_TURN', count: 1 } }),
  'Once during your turn, you may attach a [R] Energy from your discard pile to this Pokémon. If you do, do 20 damage to this Pokémon.': activated(BOTH, [
    activate({ type: 'ATTACH_ENERGY', target: SELF, energyType: 'FIRE', count: 1, source: 'DISCARDED_ENERGY' }),
    activate({ type: 'DEAL_DAMAGE', target: SELF, amount: 20, category: 'EFFECT' }, { failurePolicy: 'BEST_EFFORT' })]),
  "Once during your turn, you may choose either player. Look at the top card of that player's deck.": activated(BOTH, [activate({ type: 'LOOK_AT_TOP', player: 'CHOOSE', count: 1 })]),
  'Once during your turn, you may heal 10 damage from each of your Pokémon.': activated(BOTH, [activate({ type: 'HEAL_DAMAGE', target: spreadAll('OWN_POKEMON'), amount: 10 })]),
  'Once during your turn, you may heal 20 damage from your Active Pokémon.': activated(BOTH, [activate({ type: 'HEAL_DAMAGE', target: OWN_ACTIVE, amount: 20 })]),
  'Once during your turn, you may heal 30 damage from each of your [W] Pokémon.': activated(BOTH, [
    activate({ type: 'HEAL_DAMAGE', target: spreadAll('OWN_POKEMON', { types: ['WATER'] }), amount: 30 })]),
  "Once during your turn, you may make your opponent's Active Pokémon Burned.": activated(BOTH, [activate(conditionOn('BURNED'))]),
  'Once during your turn, you may move all [D] Energy from each of your Pokémon to this Pokémon.': activated(BOTH, [
    activate({ type: 'MOVE_ENERGY', from: spreadAll('OWN_POKEMON', { excludeSelf: true }), to: SELF, energyType: 'DARKNESS', count: 'ALL' })]),
  'Once during your turn, you may move all [P] Energy from 1 of your Benched [P] Pokémon to your Active Pokémon.': activated(BOTH, [
    activate({ type: 'MOVE_ENERGY', from: choose('OWN_BENCH', { types: ['PSYCHIC'] }), to: OWN_ACTIVE, energyType: 'PSYCHIC', count: 'ALL' })]),
  'Once during your turn, you may put a random Pokémon from your deck into your hand.': activated(BOTH, [
    activate({ type: 'SEARCH_DECK', player: 'OWN', filter: { categories: ['POKEMON'] }, count: 1, mode: 'RANDOM', destination: 'HAND', reveal: true, shuffleAfter: true })]),
  'Once during your turn, you may put a random Pokémon Tool card from your deck into your hand.': activated(BOTH, [
    activate({ type: 'SEARCH_DECK', player: 'OWN', filter: { categories: ['TRAINER'], subtypes: ['TOOL'] }, count: 1, mode: 'RANDOM', destination: 'HAND', reveal: true, shuffleAfter: true })]),
  'Once during your turn, you may switch your Active Ultra Beast with 1 of your Benched Ultra Beasts.': activated(BOTH, [
    activate({ type: 'SWITCH_ACTIVE', side: 'OWN', chooser: 'CONTROLLER', filter: { tags: [ULTRA_BEAST] } })], { conditions: [exists('OWN_ACTIVE', { tags: [ULTRA_BEAST] })] }),
  'Once during your turn, you may take a [P] Energy from your Energy Zone and attach it to this Pokémon. If you use this Ability, your turn ends.': activated(BOTH, [
    activate(attachZone(E('P'), SELF))], { endsTurn: true }),
  "Pokémon (both yours and your opponent's) can't be healed.": continuousAbility(BOTH, [cont({ type: 'PREVENT_HEALING', target: { scope: 'ALL_POKEMON' }, duration: WHILE })]),
  "Prevent all damage done to this Pokémon by attacks from your opponent's Pokémon ex.": continuousAbility(BOTH, [
    cont({ type: 'PREVENT_DAMAGE', target: SELF, categories: ['ATTACK'], amount: 'ALL', duration: WHILE, attackerFilter: EX })]),
  "Prevent all effects of attacks used by your opponent's Pokémon done to this Pokémon.": continuousAbility(BOTH, [
    cont({ type: 'PREVENT_EFFECTS', target: SELF, fromSide: 'OPPONENT', duration: WHILE })]),
  "This Ability works if you have any Unown in play with an Ability other than GUARD. All of your Pokémon take -10 damage from attacks from your opponent's Pokémon.": continuousAbility(BOTH, [
    cont(takes(-10, undefined, 'OWN_POKEMON'))], { conditions: [unownOther('guard')] }),
  "This Ability works if you have any Unown in play with an Ability other than POWER. Attacks used by your Pokémon do +10 damage to your opponent's Active Pokémon.": continuousAbility(BOTH, [
    cont(deals(10, 'OWN_POKEMON'))], { conditions: [unownOther('power')] }),
  "This Pokémon can evolve into any Pokémon that evolves from Eevee if you play it from your hand onto this Pokémon. (This Pokémon can't evolve during your first turn or the turn you play it.)": continuousAbility(BOTH, [
    cont({ type: 'GRANT_RULE', target: SELF, duration: WHILE, rule: 'EVOLVES_AS', evolvesAs: ['eevee'] })]),
  "This Pokémon can't be affected by any Special Conditions.": continuousAbility(BOTH, [cont({ type: 'PREVENT_CONDITIONS', target: SELF, duration: WHILE })]),
  "This Pokémon can't be Asleep.": continuousAbility(BOTH, [cont({ type: 'PREVENT_CONDITIONS', target: SELF, duration: WHILE, conditions: ['ASLEEP'] })]),
  'This Pokémon takes -20 damage from attacks from [R] or [W] Pokémon.': continuousAbility(BOTH, [cont(takes(-20, { types: ['FIRE', 'WATER'] }))]),
  'This Pokémon takes -30 damage from attacks from [F] Pokémon.': continuousAbility(BOTH, [cont(takes(-30, { types: ['FIGHTING'] }))]),
  'This Pokémon takes -30 damage from attacks from [R] or [W] Pokémon.': continuousAbility(BOTH, [cont(takes(-30, { types: ['FIRE', 'WATER'] }))]),
  "Whenever you attach a [D] Energy from your Energy Zone to this Pokémon, do 20 damage to your opponent's Active Pokémon.": triggered(BOTH, fromZone('DARKNESS'), [
    trig({ type: 'DEAL_DAMAGE', target: OPP_ACTIVE, amount: 20, category: 'EFFECT' })]),
  'Whenever you attach a [P] Energy from your Energy Zone to this Pokémon, heal 20 damage from this Pokémon.': triggered(BOTH, fromZone('PSYCHIC'), [trig(healSelf(20))]),
  'Whenever you attach an Energy from your Energy Zone to this Pokémon, put a random card from your deck that evolves from this Pokémon onto this Pokémon to evolve it.': triggered(BOTH, fromZone(), [
    trig({ type: 'EVOLVE', target: SELF, fromHand: { categories: ['POKEMON'] }, from: 'DECK' })]),
  'You must discard a card from your hand in order to use this Ability. Once during your turn, you may draw a card.': activated(BOTH, [
    activate({ type: 'DRAW_CARDS', player: 'OWN', count: 1 })], { costs: [{ type: 'DISCARD_HAND_CARDS', count: 1 }] }),
  'Your Active Pokémon has no Retreat Cost.': continuousAbility(BOTH, [cont(retreat(-99, 'OWN_ACTIVE'))]),
  "Your opponent can't play any Pokémon from their hand to evolve their Active Pokémon.": continuousAbility(BOTH, [
    cont({ type: 'RESTRICT_ACTION', target: { scope: 'OPPONENT_ACTIVE' }, actions: ['EVOLVE'], duration: WHILE })]),
  "Your opponent's Active Pokémon takes +10 damage from being Poisoned.": continuousAbility(BOTH, [
    cont({ type: 'MODIFY', stat: 'POISON_DAMAGE', amount: 10, target: OPP_ACTIVE, duration: WHILE })]),
};
