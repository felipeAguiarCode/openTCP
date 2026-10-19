// Efeitos de ataque dos sets do Pocket depois do A1 (parte 1): texto em inglês do `.inspo` → blocos do effects-dsl.
// Chave = texto normalizado pelo importador; o texto exibido na carta é gerado em PT-BR (domain/cards/text.ts).
import type { Operation } from '../../../../domain/cards/types.ts';
import {
  add, atLeastHeads, base, bonusIf, bonusOnHeads, c, choose, conditionOn, count, DEFENDING, discardOwn, discardRandomFrom, E,
  energyCount, exists, extraDamage, flip, heads, healSelf, mul, named, NEXT_OPP, NEXT_OWN, NEXT_TURN_WHILE_ACTIVE, noHeads, OPP_ACTIVE, perHeads, post,
  pre, random1, SELF, selfDamage, snipe, spreadAll, tails, untilTails, type AttackFx,
} from './kit.ts';

const randomHits = (times: number, amount: number, other = false): AttackFx => ({
  effects: Array.from({ length: times }, () => post({ type: 'DEAL_DAMAGE', target: other ? random1('ALL_POKEMON', { excludeSelf: true }) : random1('OPPONENT_POKEMON'), amount, category: 'ATTACK' })),
});
const sweetsRelay = (more: number): AttackFx => ({ effects: [bonusIf(more, { op: 'COMPARE', left: { op: 'ATTACKS_USED', attackId: 'sweets-relay', window: 'LAST_OWN_TURN' }, cmp: 'GE', right: c(1) })] });
const cantUseNextTurn = (attackId: string): AttackFx => ({ effects: [post({ type: 'RESTRICT_ACTION', target: SELF, actions: ['ATTACK'], attackIds: [attackId], duration: NEXT_OWN })] });
const nextTurnBoost = (attackId: string, more: number): AttackFx => ({
  effects: [post({ type: 'MODIFY', stat: 'DAMAGE_DEALT', amount: more, target: SELF, duration: NEXT_OWN, appliesTo: { attackIds: [attackId], damageCategory: 'ATTACK' } })],
});
const discardTop = (zone: 'OWN_DECK_TOP' | 'OPPONENT_DECK_TOP', n: number, outputId?: string): Operation => ({ type: 'DISCARD_CARDS', zone, count: n, chooser: 'CONTROLLER', ...(outputId ? { outputId } : {}) });
const preventAllNext: Operation = { type: 'PREVENT_DAMAGE', target: SELF, categories: ['ATTACK'], amount: 'ALL', duration: NEXT_OPP };
const preventEffectsNext: Operation = { type: 'PREVENT_EFFECTS', target: SELF, fromSide: 'OPPONENT', duration: NEXT_OPP };
const bothActive = { scope: 'ALL_POKEMON', filter: { positions: ['ACTIVE'] } } as const;
const discardFromHand = (filter: 'ITEM' | 'TOOL'): Operation => ({ type: 'DISCARD_CARDS', zone: 'OPPONENT_HAND', count: 1, chooser: 'RANDOM', filter: { subtypes: [filter] } });
const takenNext = (amount: number): AttackFx => ({ effects: [post({ type: 'MODIFY', stat: 'DAMAGE_TAKEN', amount, target: SELF, duration: NEXT_OPP, appliesTo: { damageCategory: 'ATTACK' } })] });
const heads1 = atLeastHeads(1);

export const ATTACKS_1: Readonly<Record<string, (printed: number | null) => AttackFx>> = {
  "1 of your opponent's Pokémon is chosen at random 3 times. For each time a Pokémon was chosen, do 50 damage to it.": () => randomHits(3, 50),
  "1 of your opponent's Pokémon is chosen at random 3 times. For each time a Pokémon was chosen, do 60 damage to it.": () => randomHits(3, 60),
  "1 of your opponent's Pokémon is chosen at random 4 times. For each time a Pokémon was chosen, do 40 damage to it.": () => randomHits(4, 40),
  "1 of your opponent's Pokémon is chosen at random. Do 30 damage to it.": () => randomHits(1, 30),
  "1 other Pokémon (either yours or your opponent's) is chosen at random 3 times. For each time a Pokémon was chosen, do 50 damage to it.": () => randomHits(3, 50, true),
  "1 Special Condition from among Asleep, Burned, Confused, Paralyzed, and Poisoned is chosen at random, and your opponent's Active Pokémon is now affected by that Special Condition. Any Special Conditions already affecting that Pokémon will not be chosen.": () => ({
    effects: [post({ type: 'APPLY_CONDITION', target: OPP_ACTIVE, condition: 'RANDOM' })],
  }),
  "At the end of your opponent's next turn, do 90 damage to the Defending Pokémon.": () => ({
    effects: [post({ type: 'SCHEDULE_DELAYED', target: DEFENDING, at: 'END_OF_OPPONENT_NEXT_TURN', operations: [{ type: 'DEAL_DAMAGE', target: { scope: 'EVENT_TARGET' }, amount: 90, category: 'EFFECT' }] })],
  }),
  "Before doing damage, discard all Pokémon Tools from your opponent's Active Pokémon.": () => ({ effects: [pre({ type: 'REMOVE_TOOL', target: OPP_ACTIVE, destination: 'DISCARD' })] }),
  'Both Active Pokémon are now Asleep.': () => ({ effects: [post(conditionOn('ASLEEP', bothActive))] }),
  'Both Active Pokémon are now Confused.': () => ({ effects: [post(conditionOn('CONFUSED', bothActive))] }),
  "Change the type of a random Energy attached to your opponent's Active Pokémon to 1 of the following at random: [G], [R], [W], [L], [P], [F], [D], or [M].": () => ({
    effects: [post({ type: 'CHANGE_ENERGY_TYPE', target: OPP_ACTIVE })],
  }),
  'Change the type of the next Energy that will be generated for your opponent to 1 of the following at random: [G], [R], [W], [L], [P], [F], [D], or [M].': () => ({
    effects: [post({ type: 'SET_NEXT_ENERGY', player: 'OPPONENT' })],
  }),
  "Choose 1 of your Benched Pokémon's attacks, except any Pokémon ex, and use it as this attack. If this Pokémon doesn't have the necessary Energy to use that attack, this attack does nothing.": () => ({
    effects: [post({ type: 'COPY_ATTACK', from: { scope: 'OWN_BENCH', filter: { ruleBoxes: ['NONE'] } }, requireEnergy: true })],
  }),
  "Choose 1 of your opponent's Active Pokémon's attacks and use it as this attack.": () => ({ effects: [post({ type: 'COPY_ATTACK', from: OPP_ACTIVE, requireEnergy: false })] }),
  'Choose 2 of your Benched Pokémon. For each of those Pokémon, take a [W] Energy from your Energy Zone and attach it to that Pokémon.': () => ({
    effects: [post({ type: 'ATTACH_ENERGY', target: choose('OWN_BENCH', undefined, 'CONTROLLER', 2, 2), energyType: 'WATER', count: 1, source: 'GENERATED', perTarget: true })],
  }),
  "Choose a spot from among your opponent's Active Spot and Bench. At the end of your opponent's next turn, do 70 damage to the Pokémon in the spot you chose.": () => ({
    effects: [post({ type: 'SCHEDULE_DELAYED', target: choose('OPPONENT_POKEMON'), at: 'END_OF_OPPONENT_NEXT_TURN', bindTo: 'SPOT', operations: [{ type: 'DEAL_DAMAGE', target: { scope: 'EVENT_TARGET' }, amount: 70, category: 'EFFECT' }] })],
  }),
  'Discard 2 [L] Energy from this Pokémon.': () => ({ effects: [post(discardOwn(E('L'), 2))] }),
  "Discard 2 [R] Energy from this Pokémon. This attack does 80 damage to 1 of your opponent's Pokémon.": () => ({ ...snipe(80), effects: [pre(discardOwn(E('R'), 2))] }),
  'Discard 2 random Energy from this Pokémon.': () => ({ effects: [post(discardOwn('ANY', 2, true))] }),
  "Discard 3 [W] Energy from this Pokémon. This attack also does 20 damage to each of your opponent's Benched Pokémon.": () => ({
    effects: [post(discardOwn(E('W'), 3)), post(extraDamage(20, spreadAll('OPPONENT_BENCH')))],
  }),
  'Discard a [F] Energy from this Pokémon.': () => ({ effects: [post(discardOwn(E('F'), 1))] }),
  "Discard a [G] Energy from this Pokémon. Your opponent's Active Pokémon is now Poisoned.": () => ({ effects: [post(discardOwn(E('G'), 1)), post(conditionOn('POISONED'))] }),
  'Discard a [L] Energy from this Pokémon.': () => ({ effects: [post(discardOwn(E('L'), 1))] }),
  'Discard a [M] Energy from this Pokémon.': () => ({ effects: [post(discardOwn(E('M'), 1))] }),
  'Discard a [R], [W], and [L] Energy from this Pokémon.': () => ({
    effects: [post({ type: 'DISCARD_ENERGY', target: SELF, energyTypes: [E('R'), E('W'), E('L')], count: 3 })],
  }),
  "Discard a card from your hand. If you can't, this attack does nothing.": () => ({
    effects: [pre({ type: 'CONDITIONAL', condition: { op: 'CARDS_EXIST', zone: 'OWN_HAND', count: 1 },
      then: [{ type: 'DISCARD_CARDS', zone: 'OWN_HAND', count: 1, chooser: 'CONTROLLER' }], else: [{ type: 'ATTACK_FAILS' }] })],
  }),
  "Discard a random card from your opponent's hand.": () => ({ effects: [post({ type: 'DISCARD_CARDS', zone: 'OPPONENT_HAND', count: 1, chooser: 'RANDOM' })] }),
  "Discard a random Energy from among the Energy attached to all Pokémon (both yours and your opponent's).": () => ({
    effects: [post({ type: 'DISCARD_ENERGY', target: spreadAll('ALL_POKEMON'), energyType: 'ANY', count: 1, chooser: 'RANDOM', combined: true })],
  }),
  'Discard a random Energy from both Active Pokémon.': () => ({ effects: [post(discardRandomFrom(bothActive))] }),
  'Discard a random Energy from this Pokémon.': () => ({ effects: [post(discardOwn('ANY', 1, true))] }),
  "Discard a random Item card from your opponent's hand.": () => ({ effects: [post(discardFromHand('ITEM'))] }),
  "Discard a random Pokémon Tool card from your opponent's hand.": () => ({ effects: [post(discardFromHand('TOOL'))] }),
  "Discard all [L] Energy from this Pokémon. This attack does 120 damage to 1 of your opponent's Pokémon.": () => ({ ...snipe(120), effects: [pre(discardOwn(E('L'), 'ALL'))] }),
  'Discard all [R] Energy from this Pokémon.': () => ({ effects: [post(discardOwn(E('R'), 'ALL'))] }),
  "Discard all [W] Energy from this Pokémon. This attack does 130 damage to 1 of your opponent's Pokémon.": () => ({ ...snipe(130), effects: [pre(discardOwn(E('W'), 'ALL'))] }),
  "Discard all Energy attached to this Pokémon. Your opponent's Active Pokémon is now Paralyzed.": () => ({ effects: [post(discardOwn('ANY', 'ALL')), post(conditionOn('PARALYZED'))] }),
  "Discard all Pokémon Tools from your opponent's Active Pokémon.": () => ({ effects: [post({ type: 'REMOVE_TOOL', target: OPP_ACTIVE, destination: 'DISCARD' })] }),
  'Discard the top 3 cards of your deck.': () => ({ effects: [post(discardTop('OWN_DECK_TOP', 3))] }),
  "Discard the top 5 cards of each player's deck.": () => ({ effects: [post(discardTop('OWN_DECK_TOP', 5)), post(discardTop('OPPONENT_DECK_TOP', 5))] }),
  'Discard the top card of your deck, and if that card is an Item, this attack does 20 more damage.': () => ({
    effects: [pre(discardTop('OWN_DECK_TOP', 1, 'top')), bonusIf(20, { op: 'OUTPUT_CARDS_MATCH', reference: 'top', filter: { subtypes: ['ITEM'] } })],
  }),
  'Discard the top card of your deck. If that card is a [F] Pokémon, this attack does 60 more damage.': () => ({
    effects: [pre(discardTop('OWN_DECK_TOP', 1, 'top')), bonusIf(60, { op: 'OUTPUT_CARDS_MATCH', reference: 'top', filter: { categories: ['POKEMON'], types: ['FIGHTING'] } })],
  }),
  "Discard the top card of your opponent's deck.": () => ({ effects: [post(discardTop('OPPONENT_DECK_TOP', 1))] }),
  'Discard up to 2 Pokémon Tool cards from your hand. This attack does 50 damage for each card you discarded in this way.': () => ({
    formula: mul(c(50), { op: 'OUTPUT_COUNT', reference: 'discarded' }),
    effects: [pre({ type: 'DISCARD_CARDS', zone: 'OWN_HAND', count: 2, chooser: 'CONTROLLER', filter: { subtypes: ['TOOL'] }, upTo: true, outputId: 'discarded' })],
  }),
  'Draw a card.': () => ({ effects: [post({ type: 'DRAW_CARDS', player: 'OWN', count: 1 })] }),
  'Draw cards until you have the same number of cards in your hand as your opponent.': () => ({
    effects: [post({ type: 'DRAW_CARDS', player: 'OWN', count: { op: 'MAX', operands: [c(0), { op: 'SUBTRACT', operands: [{ op: 'COUNT_CARDS', zone: 'OPPONENT_HAND' }, { op: 'COUNT_CARDS', zone: 'OWN_HAND' }] }] } })],
  }),
  "During your next turn, this Pokémon can't attack.": () => ({ effects: [post({ type: 'RESTRICT_ACTION', target: SELF, actions: ['ATTACK'], duration: NEXT_OWN })] }),
  "During your next turn, this Pokémon can't use Big Beat.": () => cantUseNextTurn('big-beat'),
  "During your next turn, this Pokémon can't use Frenzy Plant.": () => cantUseNextTurn('frenzy-plant'),
  "During your next turn, this Pokémon can't use Gigaton Hammer.": () => cantUseNextTurn('gigaton-hammer'),
  "During your next turn, this Pokémon's Gear Spinner attack does +70 damage.": () => nextTurnBoost('gear-spinner', 70),
  "During your next turn, this Pokémon's Insatiable Striking attack does +40 damage.": () => nextTurnBoost('insatiable-striking', 40),
  "During your next turn, this Pokémon's Overacceleration attack does +20 damage.": () => nextTurnBoost('overacceleration', 20),
  "During your next turn, this Pokémon's Overdrive Smash attack does +60 damage.": () => nextTurnBoost('overdrive-smash', 60),
  "During your next turn, this Pokémon's Rolling Spin attack does +60 damage.": () => nextTurnBoost('rolling-spin', 60),
  "During your opponent's next turn, attacks used by the Defending Pokémon cost 1 [C] more, and its Retreat Cost is 1 [C] more.": () => ({
    effects: [post({ type: 'MODIFY', stat: 'ATTACK_COST', amount: 1, target: DEFENDING, duration: NEXT_TURN_WHILE_ACTIVE }),
      post({ type: 'MODIFY', stat: 'RETREAT_COST', amount: 1, target: DEFENDING, duration: NEXT_TURN_WHILE_ACTIVE })],
  }),
  "During your opponent's next turn, attacks used by the Defending Pokémon cost 1 [C] more.": () => ({
    effects: [post({ type: 'MODIFY', stat: 'ATTACK_COST', amount: 1, target: DEFENDING, duration: NEXT_TURN_WHILE_ACTIVE })],
  }),
  "During your opponent's next turn, attacks used by the Defending Pokémon do -30 damage.": () => ({
    effects: [post({ type: 'MODIFY', stat: 'DAMAGE_DEALT', amount: -30, target: DEFENDING, duration: NEXT_TURN_WHILE_ACTIVE, appliesTo: { damageCategory: 'ATTACK' } })],
  }),
  "During your opponent's next turn, if the Defending Pokémon tries to use an attack, your opponent flips a coin. If tails, that attack doesn't happen.": () => ({
    effects: [post({ type: 'ATTACK_COIN_GATE', target: DEFENDING, duration: NEXT_TURN_WHILE_ACTIVE })],
  }),
  "During your opponent's next turn, if this Pokémon is damaged by an attack, do 30 damage to the Attacking Pokémon.": () => ({
    effects: [post({ type: 'COUNTER_DAMAGE', target: SELF, duration: NEXT_OPP, amount: 30 })],
  }),
  "During your opponent's next turn, if this Pokémon is damaged by an attack, do 40 damage to the Attacking Pokémon.": () => ({
    effects: [post({ type: 'COUNTER_DAMAGE', target: SELF, duration: NEXT_OPP, amount: 40 })],
  }),
  "During your opponent's next turn, they can't play any Item cards from their hand.": () => ({
    effects: [post({ type: 'RESTRICT_ACTION', target: { scope: 'OPPONENT_POKEMON' }, actions: ['PLAY_ITEM'], duration: NEXT_OPP })],
  }),
  "During your opponent's next turn, they can't take any Energy from their Energy Zone to attach to their Active Pokémon.": () => ({
    effects: [post({ type: 'RESTRICT_ACTION', target: { scope: 'OPPONENT_ACTIVE' }, actions: ['RECEIVE_ZONE_ENERGY'], duration: NEXT_OPP })],
  }),
  "During your opponent's next turn, this Pokémon takes -30 damage from attacks.": () => takenNext(-30),
  "During your opponent's next turn, this Pokémon takes -50 damage from attacks.": () => takenNext(-50),
  "During your opponent's next turn, this Pokémon takes +30 damage from attacks.": () => takenNext(30),
  'Flip 2 coins. If both of them are heads, this attack does 20 more damage.': () => ({ effects: [pre(flip(2)), bonusIf(20, atLeastHeads(2))] }),
  'Flip 2 coins. If both of them are heads, this attack does 70 more damage.': () => ({ effects: [pre(flip(2)), bonusIf(70, atLeastHeads(2))] }),
  "Flip 2 coins. If both of them are heads, your opponent's Active Pokémon is Knocked Out.": () => ({
    effects: [pre(flip(2)), post({ type: 'KNOCK_OUT', target: OPP_ACTIVE }, { condition: atLeastHeads(2) })],
  }),
  'Flip 2 coins. This attack does 20 damage for each heads.': () => perHeads(2, 20),
  'Flip 2 coins. This attack does 20 more damage for each heads.': (n) => ({ formula: add(c(base(n)), mul(c(20), heads())), effects: [pre(flip(2))] }),
  'Flip 2 coins. This attack does 40 damage for each heads.': () => perHeads(2, 40),
  "Flip 2 coins. This attack does 70 damage for each heads. If at least 1 of them is heads, your opponent's Active Pokémon is now Burned.": () => ({
    ...perHeads(2, 70), effects: [pre(flip(2)), post(conditionOn('BURNED'), { condition: heads1 })],
  }),
  "Flip 3 coins. For each heads, a card is chosen at random from your opponent's hand. Your opponent reveals that card and shuffles it into their deck.": () => ({
    effects: [pre(flip(3)), post({ type: 'RETURN_CARDS_TO_DECK', zone: 'OPPONENT_HAND', count: heads(), chooser: 'RANDOM' })],
  }),
  "Flip 3 coins. For each heads, discard a random Energy from your opponent's Active Pokémon. If all of them are tails, this attack does nothing.": () => ({
    effects: [pre(flip(3)), pre({ type: 'ATTACK_FAILS' }, { condition: noHeads }), post(discardRandomFrom(OPP_ACTIVE, heads()))],
  }),
  'Flip 3 coins. This attack does 10 damage for each heads.': () => perHeads(3, 10),
  'Flip 3 coins. This attack does 20 damage for each heads.': () => perHeads(3, 20),
  'Flip 3 coins. This attack does 50 damage for each heads.': () => perHeads(3, 50),
  'Flip 3 coins. This attack does 50 more damage for each heads.': (n) => ({ formula: add(c(base(n)), mul(c(50), heads())), effects: [pre(flip(3))] }),
  'Flip 3 coins. This attack does 60 damage for each heads.': () => perHeads(3, 60),
  'Flip 3 coins. This attack does 60 damage for each heads. This Pokémon is now Confused.': () => ({ ...perHeads(3, 60), effects: [pre(flip(3)), post(conditionOn('CONFUSED', SELF))] }),
  'Flip 3 coins. This attack does 80 damage for each heads.': () => perHeads(3, 80),
  'Flip 4 coins. This attack does 20 damage for each heads.': () => perHeads(4, 20),
  "Flip 4 coins. This attack does 40 damage for each heads. If at least 2 of them are heads, your opponent's Active Pokémon is now Poisoned.": () => ({
    ...perHeads(4, 40), effects: [pre(flip(4)), post(conditionOn('POISONED'), { condition: atLeastHeads(2) })],
  }),
  'Flip a coin for each Energy attached to this Pokémon. This attack does 50 damage for each heads.': () => ({
    formula: mul(c(50), heads()), effects: [pre({ type: 'FLIP_COINS', count: energyCount(SELF), outputId: 'coins' })],
  }),
  'Flip a coin for each Pokémon you have in play. This attack does 20 damage for each heads.': () => ({
    formula: mul(c(20), heads()), effects: [pre({ type: 'FLIP_COINS', count: count({ scope: 'OWN_POKEMON' }), outputId: 'coins' })],
  }),
  'Flip a coin for each Pokémon you have in play. This attack does 40 damage for each heads.': () => ({
    formula: mul(c(40), heads()), effects: [pre({ type: 'FLIP_COINS', count: count({ scope: 'OWN_POKEMON' }), outputId: 'coins' })],
  }),
  "Flip a coin until you get tails. For each heads, discard a random Energy from your opponent's Active Pokémon.": () => ({
    effects: [pre(untilTails()), post(discardRandomFrom(OPP_ACTIVE, heads()))],
  }),
  'Flip a coin until you get tails. This attack does 20 damage for each heads.': () => ({ formula: mul(c(20), heads()), effects: [pre(untilTails())] }),
  'Flip a coin until you get tails. This attack does 30 more damage for each heads.': (n) => ({ formula: add(c(base(n)), mul(c(30), heads())), effects: [pre(untilTails())] }),
  'Flip a coin until you get tails. This attack does 40 more damage for each heads.': (n) => ({ formula: add(c(base(n)), mul(c(40), heads())), effects: [pre(untilTails())] }),
  'Flip a coin until you get tails. This attack does 70 damage for each heads.': () => ({ formula: mul(c(70), heads()), effects: [pre(untilTails())] }),
  "Flip a coin. If heads, choose 1 of your opponent's Active Pokémon's attacks and use it as this attack.": () => ({
    effects: [pre(flip(1)), post({ type: 'COPY_ATTACK', from: OPP_ACTIVE, requireEnergy: false }, { condition: heads1 })],
  }),
  "Flip a coin. If heads, during your opponent's next turn, prevent all damage done to this Pokémon by attacks.": () => ({
    effects: [pre(flip(1)), post(preventAllNext, { condition: heads1 })],
  }),
  'Flip a coin. If heads, heal 60 damage from this Pokémon.': () => ({ effects: [pre(flip(1)), post(healSelf(60), { condition: heads1 })] }),
  "Flip a coin. If heads, put your opponent's Active Pokémon into their hand.": () => ({
    effects: [pre(flip(1)), post({ type: 'RETURN_TO_HAND', target: OPP_ACTIVE }, { condition: heads1 })],
  }),
  "Flip a coin. If heads, switch in 1 of your opponent's Benched Pokémon to the Active Spot.": () => ({
    effects: [pre(flip(1)), post({ type: 'SWITCH_ACTIVE', side: 'OPPONENT', chooser: 'CONTROLLER' }, { condition: heads1 })],
  }),
  'Flip a coin. If heads, this attack does 20 more damage.': (n) => bonusOnHeads(base(n), 20),
  'Flip a coin. If heads, this attack does 50 more damage.': (n) => bonusOnHeads(base(n), 50),
  'Flip a coin. If heads, this attack does 60 more damage.': (n) => bonusOnHeads(base(n), 60),
  'Flip a coin. If heads, this attack does 60 more damage. If tails, this Pokémon also does 20 damage to itself.': (n) => ({
    formula: add(c(base(n)), mul(c(60), heads())), effects: [pre(flip(1)), post(selfDamage(20), { condition: tails() })],
  }),
  'Flip a coin. If heads, this attack does 80 more damage.': (n) => bonusOnHeads(base(n), 80),
  'Flip a coin. If heads, your opponent reveals a random card from their hand and shuffles it into their deck.': () => ({
    effects: [pre(flip(1)), post({ type: 'RETURN_CARDS_TO_DECK', zone: 'OPPONENT_HAND', count: 1, chooser: 'RANDOM' }, { condition: heads1 })],
  }),
  "Flip a coin. If heads, your opponent's Active Pokémon is now Burned.": () => ({ effects: [pre(flip(1)), post(conditionOn('BURNED'), { condition: heads1 })] }),
  "Flip a coin. If heads, your opponent's Active Pokémon is now Paralyzed. If tails, your opponent's Active Pokémon is now Confused.": () => ({
    effects: [pre(flip(1)), post(conditionOn('PARALYZED'), { condition: heads1 }), post(conditionOn('CONFUSED'), { condition: tails() })],
  }),
  "Flip a coin. If heads, your opponent's Active Pokémon is now Poisoned and Paralyzed.": () => ({
    effects: [pre(flip(1)), post(conditionOn('POISONED'), { condition: heads1 }), post(conditionOn('PARALYZED'), { condition: heads1 })],
  }),
  "Flip a coin. If heads, your opponent's Active Pokémon's remaining HP is now 10.": () => ({
    effects: [pre(flip(1)), post({ type: 'SET_REMAINING_HP', target: OPP_ACTIVE, mode: 'VALUE', value: 10 }, { condition: heads1 })],
  }),
  'Flip a coin. If tails, discard 2 random Energy from this Pokémon.': () => ({ effects: [pre(flip(1)), post(discardOwn('ANY', 2, true), { condition: tails() })] }),
  "Flip a coin. If tails, during your next turn, this Pokémon can't attack.": () => ({
    effects: [pre(flip(1)), post({ type: 'RESTRICT_ACTION', target: SELF, actions: ['ATTACK'], duration: NEXT_OWN }, { condition: tails() })],
  }),
  "Flip a coin. If tails, this attack does nothing. If heads, during your opponent's next turn, prevent all damage from—and effects of—attacks done to this Pokémon.": () => ({
    effects: [pre(flip(1)), pre({ type: 'ATTACK_FAILS' }, { condition: tails() }), post(preventAllNext, { condition: heads1 }), post(preventEffectsNext, { condition: heads1 })],
  }),
  "Flip a coin. If tails, this attack does nothing. If heads, your opponent's Active Pokémon is now Paralyzed.": () => ({
    effects: [pre(flip(1)), pre({ type: 'ATTACK_FAILS' }, { condition: tails() }), post(conditionOn('PARALYZED'), { condition: heads1 })],
  }),
  'Flip a coin. If tails, this Pokémon also does 20 damage to itself.': () => ({ effects: [pre(flip(1)), post(selfDamage(20), { condition: tails() })] }),
  'Flip a coin. If tails, this Pokémon also does 60 damage to itself.': () => ({ effects: [pre(flip(1)), post(selfDamage(60), { condition: tails() })] }),
  "Halve your opponent's Active Pokémon's remaining HP, rounded down.": () => ({ effects: [post({ type: 'SET_REMAINING_HP', target: OPP_ACTIVE, mode: 'HALF_DOWN' })] }),
  'Heal 20 damage from 1 of your Pokémon.': () => ({ effects: [post({ type: 'HEAL_DAMAGE', target: choose('OWN_POKEMON'), amount: 20 })] }),
  'Heal 20 damage from each of your Pokémon.': () => ({ effects: [post({ type: 'HEAL_DAMAGE', target: spreadAll('OWN_POKEMON'), amount: 20 })] }),
  'Heal 20 damage from this Pokémon.': () => ({ effects: [post(healSelf(20))] }),
  'Heal 50 damage from 1 of your Benched Pokémon.': () => ({ effects: [post({ type: 'HEAL_DAMAGE', target: choose('OWN_BENCH'), amount: 50 })] }),
  'If 1 of your Pokémon used Sweets Relay during your last turn, this attack does 20 more damage.': () => sweetsRelay(20),
  'If 1 of your Pokémon used Sweets Relay during your last turn, this attack does 30 more damage.': () => sweetsRelay(30),
  'If 1 of your Pokémon used Sweets Relay during your last turn, this attack does 60 more damage.': () => sweetsRelay(60),
  'If a Stadium is in play, this attack does 40 more damage.': () => ({ effects: [bonusIf(40, { op: 'STADIUM_IN_PLAY' })] }),
  'If a Stadium is in play, this attack does 70 more damage.': () => ({ effects: [bonusIf(70, { op: 'STADIUM_IN_PLAY' })] }),
  "If a Stadium is in play, your opponent's Active Pokémon is now Burned.": () => ({ effects: [post(conditionOn('BURNED'), { condition: { op: 'STADIUM_IN_PLAY' } })] }),
  "If any of your [D] Pokémon were Knocked Out by damage from an attack during your opponent's last turn, this attack does 80 more damage.": () => ({
    effects: [bonusIf(80, { op: 'KNOCKED_OUT_LAST_OPPONENT_TURN', filter: { categories: ['POKEMON'], types: ['DARKNESS'] } })],
  }),
  'If any of your Benched Pokémon have damage on them, this attack does 50 more damage.': () => ({ effects: [bonusIf(50, exists('OWN_BENCH', { hasDamage: true }))] }),
  "If any of your Pokémon were Knocked Out by damage from an attack during your opponent's last turn, this attack does 60 more damage.": () => ({
    effects: [bonusIf(60, { op: 'KNOCKED_OUT_LAST_OPPONENT_TURN' })],
  }),
  'If Latios is on your Bench, this attack does 20 more damage.': () => ({ effects: [bonusIf(20, exists('OWN_BENCH', named(['latios'])))] }),
  'If Passimian is on your Bench, this attack does 40 more damage.': () => ({ effects: [bonusIf(40, exists('OWN_BENCH', named(['passimian'])))] }),
  "If the Defending Pokémon is a Basic Pokémon, it can't attack during your opponent's next turn.": () => ({
    effects: [post({ type: 'RESTRICT_ACTION', target: DEFENDING, actions: ['ATTACK'], duration: NEXT_TURN_WHILE_ACTIVE }, { condition: exists('DEFENDING', { stages: ['BASIC'] }) })],
  }),
  "If the Defending Pokémon tries to use an attack, your opponent flips a coin. If tails, that attack doesn't happen. This effect lasts until the Defending Pokémon leaves the Active Spot, and it doesn't stack.": () => ({
    effects: [post({ type: 'ATTACK_COIN_GATE', target: DEFENDING, duration: { kind: 'WHILE_SOURCE_IN_PLAY', removeOn: ['TARGET_LEAVES_ACTIVE'] } })],
  }),
};

