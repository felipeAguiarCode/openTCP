// Treinadores dos sets do Pocket depois do A1 (Itens, Apoiadores e Ferramentas): texto em inglês → effects-dsl.
import type { CardFilter, Condition, NumberOrFormula, Operation, PokemonFilter } from '../../../../domain/cards/types.ts';
import {
  attachZone, c, choose, cont, damageBoost, E, EX, exists, flip, heads, healSelf, item, named, onPlay, OPP_ACTIVE, OWN_ACTIVE, SELF,
  shieldNextTurn, spreadAll, supporter, THIS_TURN, tool, trig, WHILE, type TrainerFx,
} from './kit.ts';

const UB: PokemonFilter = { tags: ['ULTRA_BEAST'] };
const best = { failurePolicy: 'BEST_EFFORT' } as const;
const opponentPoints = (cmp: 'EQ' | 'GE', n: number): Condition => ({ op: 'COMPARE', left: { op: 'POINTS', side: 'OPPONENT' }, cmp, right: c(n) });
const search = (keys: readonly string[]): Operation => ({ type: 'SEARCH_DECK', player: 'OWN', filter: { categories: ['POKEMON'], deckLimitKeys: keys }, count: 1, mode: 'RANDOM', destination: 'HAND', reveal: true, shuffleAfter: true });
const fromDiscard = (filter: CardFilter, count: NumberOrFormula = 1): Operation => ({ type: 'RECOVER_FROM_DISCARD', filter, count, mode: 'RANDOM', destination: 'HAND' });
const atActive: Condition = { op: 'SOURCE_POSITION', position: 'ACTIVE' };
const conditions: Condition = { op: 'HAS_CONDITION', selector: SELF, condition: 'ANY' };

export const TRAINERS: Readonly<Record<string, TrainerFx>> = {
  // ---- Itens
  'Choose 1 of your Basic Pokémon in play. If you have a Stage 2 card in your hand that evolves from that Pokémon, put that card onto the Basic Pokémon to evolve it, skipping the Stage 1. You can\'t use this card during your first turn or on a Basic Pokémon that was put into play this turn.': item([
    onPlay({ type: 'EVOLVE', target: choose('OWN_POKEMON', { stages: ['BASIC'], enteredPlayThisTurn: false }), fromHand: { categories: ['POKEMON'], stages: ['STAGE_2'] }, skipStage: true }),
  ], { playConditions: [{ op: 'COMPARE', left: { op: 'OWN_TURN_NUMBER', side: 'OWN' }, cmp: 'GT', right: c(1) }] }),
  "Choose 1:① During this turn, attacks used by your Pokémon that evolve from Eevee do +10 damage to your opponent's Active Pokémon.② Heal 20 damage from each of your Pokémon that evolves from Eevee.": item([
    onPlay({ type: 'CHOOSE_ONE', options: [
      [{ type: 'MODIFY', stat: 'DAMAGE_DEALT', amount: 10, target: { scope: 'OWN_POKEMON', filter: { evolvesFrom: ['eevee'] } }, duration: THIS_TURN, appliesTo: { opponentActiveOnly: true, damageCategory: 'ATTACK' } }],
      [{ type: 'HEAL_DAMAGE', target: spreadAll('OWN_POKEMON', { evolvesFrom: ['eevee'] }), amount: 20 }],
    ] }, best),
  ]),
  'Choose a Pokémon in your hand and switch it with a random Pokémon in your deck.': item([onPlay({ type: 'SWAP_HAND_WITH_DECK' })]),
  "Discard a [R] Energy from your opponent's Active Pokémon.": item([onPlay({ type: 'DISCARD_ENERGY', target: OPP_ACTIVE, energyType: 'FIRE', count: 1 })]),
  'Heal 10 damage and remove a random Special Condition from your Active Pokémon.': item([
    onPlay({ type: 'HEAL_DAMAGE', target: OWN_ACTIVE, amount: 10 }, best), onPlay({ type: 'REMOVE_CONDITION', target: OWN_ACTIVE, conditions: 'RANDOM_ONE' }, best),
  ], { playConditions: [{ op: 'ANY', conditions: [exists('OWN_ACTIVE', { hasDamage: true }), exists('OWN_ACTIVE', { hasCondition: true })] }] }),
  'Look at the top 3 cards of your deck.': item([onPlay({ type: 'LOOK_AT_TOP', player: 'OWN', count: 3 })]),
  'Look at the top card of your deck. If that card is a [P] Pokémon, put it into your hand. If it is not a [P] Pokémon, put it on the bottom of your deck.': item([
    onPlay({ type: 'REVEAL_TOP_TAKE', count: 1, filter: { categories: ['POKEMON'], types: ['PSYCHIC'] }, rest: 'BOTTOM' })]),
  'Look at the top card of your deck. Then, you may shuffle your deck.': item([
    onPlay({ type: 'LOOK_AT_TOP', player: 'OWN', count: 1 }), onPlay({ type: 'SHUFFLE_DECK', player: 'OWN' }, { optional: true, failurePolicy: 'BEST_EFFORT' })]),
  'Move a [R], [W], or [L] Energy from 1 of your Benched Pokémon to your Active Pokémon.': item([
    onPlay({ type: 'MOVE_ENERGY', from: choose('OWN_BENCH', { energyTypes: [E('R'), E('W'), E('L')] }), to: OWN_ACTIVE, energyTypes: [E('R'), E('W'), E('L')], count: 1 })]),
  "Put a Basic Pokémon from your opponent's discard pile onto their Bench.": item([
    onPlay({ type: 'PUT_ON_BENCH', from: 'DISCARD', filter: { categories: ['POKEMON'], stages: ['BASIC'] }, count: 1, mode: 'CHOOSE', side: 'OPPONENT', chooser: 'CONTROLLER' })]),
  'Put a random Basic [W] Pokémon from your discard pile into your hand.': item([onPlay(fromDiscard({ categories: ['POKEMON'], stages: ['BASIC'], types: ['WATER'] }))]),
  "Switch out your opponent's Active Basic Pokémon to the Bench. (Your opponent chooses the new Active Pokémon.)": item([
    onPlay({ type: 'SWITCH_ACTIVE', side: 'OPPONENT', chooser: 'OPPONENT' })], { playConditions: [exists('OPPONENT_ACTIVE', { stages: ['BASIC'] })] }),
  "You can use this card only if your opponent hasn't gotten any points. During your opponent's next turn, all of your Ultra Beasts take -20 damage from attacks from your opponent's Pokémon.": item([
    shieldNextTurn(20, UB)], { playConditions: [opponentPoints('EQ', 0)] }),

  // ---- Apoiadores
  'Choose 1 of your Alolan Marowak or Turtonator. Take 2 [R] Energy from your Energy Zone and attach it to that Pokémon. Your turn ends.': supporter([
    onPlay(attachZone(E('R'), choose('OWN_POKEMON', named(['marowak-de-alola', 'turtonator'])), 2)), onPlay({ type: 'END_TURN' })]),
  'Choose 1 of your Electivire or Luxray. Attach 2 [L] Energy from your discard pile to that Pokémon.': supporter([
    onPlay({ type: 'ATTACH_ENERGY', target: choose('OWN_POKEMON', named(['electivire', 'luxray'])), energyType: 'LIGHTNING', count: 2, source: 'DISCARDED_ENERGY' })]),
  "Choose 1 of your Palossand or Mimikyu that has damage on it, and move 40 of its damage to your opponent's Active Pokémon.": supporter([
    onPlay({ type: 'MOVE_DAMAGE', from: choose('OWN_POKEMON', named(['palossand', 'mimikyu'], { hasDamage: true })), to: OPP_ACTIVE, amount: 40 })]),
  "Discard all Pokémon Tool cards attached to each of your opponent's Pokémon.": supporter([onPlay({ type: 'REMOVE_TOOL', target: spreadAll('OPPONENT_POKEMON'), destination: 'DISCARD' })]),
  "During this turn, attacks used by your Alolan Golem, Vikavolt, or Togedemaru do +30 damage to your opponent's Active Pokémon.": supporter([
    damageBoost(30, named(['golem-de-alola', 'vikavolt', 'togedemaru']))]),
  "During this turn, attacks used by your Decidueye ex, Incineroar ex, or Primarina ex do +30 damage to your opponent's Active Pokémon.": supporter([
    damageBoost(30, named(['decidueye-ex', 'incineroar-ex', 'primarina-ex']))]),
  "During this turn, attacks used by your Garchomp or Togekiss do +50 damage to your opponent's Active Pokémon.": supporter([damageBoost(50, named(['garchomp', 'togekiss']))]),
  "During this turn, attacks used by your Pokémon do +20 damage to your opponent's Active Pokémon ex.": supporter([damageBoost(20, undefined, EX)]),
  'During this turn, attacks used by your Snorlax, Heracross, and Staraptor cost 2 less [C] Energy.': supporter([
    onPlay({ type: 'MODIFY', stat: 'ATTACK_COST', amount: -2, target: { scope: 'OWN_POKEMON', filter: named(['snorlax', 'heracross', 'staraptor']) }, duration: THIS_TURN }, best)]),
  'During this turn, the Retreat Cost of your Active Pokémon is 2 less.': supporter([onPlay({ type: 'MODIFY', stat: 'RETREAT_COST', amount: -2, target: OWN_ACTIVE, duration: THIS_TURN }, best)]),
  "During your opponent's next turn, all of your [M] Pokémon take -20 damage from attacks from your opponent's Pokémon.": supporter([shieldNextTurn(20, { types: ['METAL'] })]),
  "During your opponent's next turn, all of your Pokémon take -10 damage from attacks from your opponent's Pokémon.": supporter([shieldNextTurn(10)]),
  "During your opponent's next turn, all of your Steelix and Skarmory ex take -50 damage from attacks from your opponent's Pokémon.": supporter([shieldNextTurn(50, named(['steelix', 'skarmory-ex']))]),
  'Each player shuffles the cards in their hand into their deck, then draws that many cards.': supporter([
    onPlay({ type: 'SHUFFLE_HAND_INTO_DECK', player: 'OWN', outputId: 'mine' }, best), onPlay({ type: 'SHUFFLE_HAND_INTO_DECK', player: 'OPPONENT', outputId: 'theirs' }, best),
    onPlay({ type: 'DRAW_CARDS', player: 'OWN', count: { op: 'OUTPUT_COUNT', reference: 'mine' } }, best), onPlay({ type: 'DRAW_CARDS', player: 'OPPONENT', count: { op: 'OUTPUT_COUNT', reference: 'theirs' } }, best)]),
  'Flip 3 coins. For each heads, a [W] Pokémon is chosen at random from your discard pile and put into your hand.': supporter([
    onPlay(flip(3)), onPlay(fromDiscard({ categories: ['POKEMON'], types: ['WATER'] }, heads()), best)]),
  'For each of your [F] Pokémon in play, look at that many cards from the top of your deck and put them back in any order.': supporter([
    onPlay({ type: 'LOOK_AT_TOP', player: 'OWN', count: { op: 'COUNT_POKEMON', selector: { scope: 'OWN_POKEMON', filter: { types: ['FIGHTING'] } } }, reorder: true })]),
  "For each of your [P] Pokémon in play, look at that many cards from the top of your opponent's deck and put them back in any order.": supporter([
    onPlay({ type: 'LOOK_AT_TOP', player: 'OPPONENT', count: { op: 'COUNT_POKEMON', selector: { scope: 'OWN_POKEMON', filter: { types: ['PSYCHIC'] } } }, reorder: true })]),
  'Heal 40 damage from each of your Pokémon that has any [W] Energy attached.': supporter([
    onPlay({ type: 'HEAL_DAMAGE', target: spreadAll('OWN_POKEMON', { energyTypes: ['WATER'] }), amount: 40 })]),
  'Heal 60 damage from 1 of your Miltank, and it recovers from being Asleep, Paralyzed, and Confused.': supporter([
    onPlay({ type: 'HEAL_DAMAGE', target: { ...choose('OWN_POKEMON', named(['miltank'])), outputId: 'miltank' }, amount: 60 }, best),
    onPlay({ type: 'REMOVE_CONDITION', target: { scope: 'OUTPUT', ref: 'miltank' }, conditions: ['ASLEEP', 'PARALYZED', 'CONFUSED'] }, best),
  ], { playConditions: [exists('OWN_POKEMON', named(['miltank']))] }),
  'Heal 60 damage from 1 of your Stage 2 Pokémon.': supporter([onPlay({ type: 'HEAL_DAMAGE', target: choose('OWN_POKEMON', { stages: ['STAGE_2'], hasDamage: true }), amount: 60 })]),
  'Heal all damage from 1 of your Shiinotic or Tsareena. If you do, discard all Energy from that Pokémon.': supporter([
    onPlay({ type: 'HEAL_DAMAGE', target: { ...choose('OWN_POKEMON', named(['shiinotic', 'tsareena'], { hasDamage: true })), outputId: 'healed' }, amount: 'ALL' }),
    onPlay({ type: 'DISCARD_ENERGY', target: { scope: 'OUTPUT', ref: 'healed' }, energyType: 'ANY', count: 'ALL' }, best)]),
  "Look at a random Supporter card that's not Penny from your opponent's deck and shuffle it back into their deck. Use the effect of that card as the effect of this card.": supporter([
    onPlay({ type: 'COPY_TRAINER', excludeKeys: ['penny'] }, best)]),
  'Look at the top 4 cards of your deck. Put all Pokémon Tool cards you find there into your hand. Shuffle the other cards back into your deck.': supporter([
    onPlay({ type: 'REVEAL_TOP_TAKE', count: 4, filter: { categories: ['TRAINER'], subtypes: ['TOOL'] }, rest: 'SHUFFLE' })]),
  'Move an Energy from 1 of your Benched Pokémon to your Active Pokémon.': supporter([
    onPlay({ type: 'MOVE_ENERGY', from: choose('OWN_BENCH', { hasEnergy: true }), to: OWN_ACTIVE, count: 1 })]),
  'Put 1 of your [C] Pokémon that has damage on it into your hand.': supporter([onPlay({ type: 'RETURN_TO_HAND', target: choose('OWN_POKEMON', { types: ['COLORLESS'], hasDamage: true }) })]),
  'Put 1 random Basic Pokémon from your discard pile into your hand.': supporter([onPlay(fromDiscard({ categories: ['POKEMON'], stages: ['BASIC'] }))]),
  'Put 1 random Glameow, Stunky, or Croagunk from your deck into your hand.': supporter([onPlay(search(['glameow', 'stunky', 'croagunk']))]),
  'Put 1 random Type: Null or Silvally from your deck into your hand.': supporter([onPlay(search(['tipo-nulo', 'silvally']))]),
  'Put your Mew ex in the Active Spot into your hand.': supporter([onPlay({ type: 'RETURN_TO_HAND', target: { scope: 'OWN_ACTIVE', filter: named(['mew-ex']) } })],
    { playConditions: [exists('OWN_ACTIVE', named(['mew-ex']))] }),
  "Switch in 1 of your opponent's Benched Pokémon that has damage on it to the Active Spot.": supporter([
    onPlay({ type: 'SWITCH_ACTIVE', side: 'OPPONENT', chooser: 'CONTROLLER', filter: { hasDamage: true } })]),
  'Switch your Active Pokémon that has damage on it with 1 of your Benched Pokémon.': supporter([onPlay({ type: 'SWITCH_ACTIVE', side: 'OWN', chooser: 'CONTROLLER' })],
    { playConditions: [exists('OWN_ACTIVE', { hasDamage: true })] }),
  'The next time you flip any number of coins for the effect of an attack, Ability, or Trainer card after using this card on this turn, the first coin flip will definitely be heads.': supporter([
    onPlay({ type: 'FORCE_COIN' })]),
  "You can use this card only if you have Araquanid in play. Switch in 1 of your opponent's Benched Pokémon to the Active Spot.": supporter([
    onPlay({ type: 'SWITCH_ACTIVE', side: 'OPPONENT', chooser: 'CONTROLLER' })], { playConditions: [exists('OWN_POKEMON', named(['araquanid']))] }),
  'You can use this card only if your opponent has gotten at least 1 point. Choose 1 of your Ultra Beasts. Attach 2 random Energy from your discard pile to that Pokémon.': supporter([
    onPlay({ type: 'ATTACH_ENERGY', target: choose('OWN_POKEMON', UB), energyType: 'RANDOM', count: 2, source: 'DISCARDED_ENERGY' })], { playConditions: [opponentPoints('GE', 1)] }),
  'Your opponent reveals all of the Supporter cards in their deck.': supporter([onPlay({ type: 'REVEAL_CARDS', zone: 'OPPONENT_DECK', filter: { subtypes: ['SUPPORTER'] } }, best)]),
  "Your opponent reveals their hand. Choose a Supporter card you find there and shuffle it into your opponent's deck.": supporter([
    onPlay({ type: 'REVEAL_HAND', player: 'OPPONENT' }), onPlay({ type: 'RETURN_CARDS_TO_DECK', zone: 'OPPONENT_HAND', count: 1, chooser: 'CONTROLLER', filter: { subtypes: ['SUPPORTER'] } }, best)]),
  'Your opponent shuffles their hand into their deck and draws a card for each of their remaining points needed to win.': supporter([
    onPlay({ type: 'SHUFFLE_HAND_INTO_DECK', player: 'OPPONENT' }, best),
    onPlay({ type: 'DRAW_CARDS', player: 'OPPONENT', count: { op: 'SUBTRACT', operands: [c(3), { op: 'POINTS', side: 'OPPONENT' }] } }, best)]),

  // ---- Ferramentas
  'At the end of each turn, if the Pokémon this card is attached to is affected by any Special Conditions, it recovers from all of them, and discard this card.': tool([
    trig({ type: 'CONDITIONAL', condition: conditions, then: [{ type: 'REMOVE_CONDITION', target: SELF, conditions: 'ALL' }, { type: 'REMOVE_TOOL', target: SELF, destination: 'DISCARD' }] }),
  ], { toolTrigger: { event: 'TURN_ENDING' } }),
  'At the end of your turn, if the Pokémon this card is attached to is in the Active Spot, heal 10 damage from that Pokémon.': tool([
    trig(healSelf(10), { condition: atActive })], { toolTrigger: { event: 'TURN_ENDING', filter: { turnOf: 'OWN' } } }),
  "Attacks used by the Ultra Beast this card is attached to do +10 damage to your opponent's Active Pokémon for each point you have gotten.": tool([
    cont({ type: 'MODIFY', stat: 'DAMAGE_DEALT', amount: { op: 'MULTIPLY', operands: [c(10), { op: 'POINTS', side: 'OWN' }] }, target: { scope: 'SELF', filter: UB }, duration: WHILE, appliesTo: { damageCategory: 'ATTACK' } })]),
  "If the [D] Pokémon this card is attached to is in the Active Spot and is damaged by an attack from your opponent's Pokémon, your opponent reveals a random card from their hand and shuffles it into their deck.": tool([
    trig({ type: 'RETURN_CARDS_TO_DECK', zone: 'OPPONENT_HAND', count: 1, chooser: 'RANDOM' }, { condition: { op: 'ALL', conditions: [atActive, exists('SELF', { types: ['DARKNESS'] })] } })]),
  "If the [L] Pokémon this card is attached to is in the Active Spot and is Knocked Out by damage from an attack from your opponent's Pokémon, move 2 [L] Energy from that Pokémon and attach 1 Energy each to 2 of your Benched Pokémon.": tool([
    trig({ type: 'MOVE_ENERGY', from: SELF, to: choose('OWN_BENCH', undefined, 'CONTROLLER', 2, 2), energyType: 'LIGHTNING', count: 2, perTarget: true },
      { condition: { op: 'ALL', conditions: [atActive, exists('SELF', { types: ['LIGHTNING'] })] } })],
  { toolTrigger: { event: 'POKEMON_KNOCKED_OUT', filter: { subject: 'SELF', cause: 'ATTACK' } } }),
  "If the Pokémon this card is attached to is in the Active Spot and is damaged by an attack from your opponent's Pokémon, do 20 damage to the Attacking Pokémon.": tool([
    trig({ type: 'DEAL_DAMAGE', target: { scope: 'EVENT_SOURCE' }, amount: 20, category: 'EFFECT' }, { condition: atActive })]),
  "If the Pokémon this card is attached to is Knocked Out by damage from an attack from your opponent's Pokémon, put it into your hand instead of the discard pile.": tool([], { onKnockedOut: 'RETURN_TO_HAND' }),
  "If the Pokémon this card is attached to is your Active Pokémon and is damaged by an attack from your opponent's Pokémon, the Attacking Pokémon is now Poisoned.": tool([
    trig({ type: 'APPLY_CONDITION', target: { scope: 'EVENT_SOURCE' }, condition: 'POISONED' }, { condition: atActive })]),
  'The [G] Pokémon this card is attached to gets +30 HP.': tool([cont({ type: 'MODIFY', stat: 'MAX_HP', amount: 30, target: { scope: 'SELF', filter: { types: ['GRASS'] } }, duration: WHILE })]),
  'The [M] Pokémon this card is attached to takes -10 damage from attacks from your opponent\'s Pokémon, recovers from all Special Conditions, and can\'t be affected by any Special Conditions.': tool([
    cont({ type: 'MODIFY', stat: 'DAMAGE_TAKEN', amount: -10, target: { scope: 'SELF', filter: { types: ['METAL'] } }, duration: WHILE, appliesTo: { damageCategory: 'ATTACK' } }),
    cont({ type: 'PREVENT_CONDITIONS', target: { scope: 'SELF', filter: { types: ['METAL'] } }, duration: WHILE })]),
  'The Pokémon this card is attached to can use any attack from its previous Evolutions. (You still need the necessary Energy to use each attack.)': tool([
    cont({ type: 'GRANT_RULE', target: SELF, duration: WHILE, rule: 'PREVIOUS_EVOLUTION_ATTACKS' })]),
  'The Pokémon this card is attached to gets +20 HP.': tool([cont({ type: 'MODIFY', stat: 'MAX_HP', amount: 20, target: SELF, duration: WHILE })]),
  'The Retreat Cost of the [W] Pokémon this card is attached to is 1 less.': tool([cont({ type: 'MODIFY', stat: 'RETREAT_COST', amount: -1, target: { scope: 'SELF', filter: { types: ['WATER'] } }, duration: WHILE })]),
};

