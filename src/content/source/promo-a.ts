// Promo-A (P-A): os 6 Treinadores básicos do Pokémon TCG Pocket que o Genetic Apex não traz — compra, busca, cura,
// troca e informação. Escritos à mão (não estão no `.inspo`), com os números de coleção do P-A. Dados de terceiros
// (The Pokémon Company), uso local.
import type { TrainerCard } from '../../domain/cards/types.ts';
import { choose, onPlay, trainer } from '../builders.ts';

export const pocao = trainer({ baseName: 'Poção', subtype: 'ITEM',
  effects: [onPlay({ type: 'HEAL_DAMAGE', target: choose('OWN_POKEMON', { hasDamage: true, excludeFossils: true }), amount: 20 }, { failurePolicy: 'REQUIRE_ANY' })] });
export const velocidadeX = trainer({ baseName: 'Velocidade X', subtype: 'ITEM',
  effects: [onPlay({ type: 'MODIFY', stat: 'RETREAT_COST', amount: -1, target: { scope: 'OWN_ACTIVE' }, duration: { kind: 'THIS_TURN' } })] });
export const lupaDeMao = trainer({ baseName: 'Lupa de Mão', subtype: 'ITEM',
  effects: [onPlay({ type: 'REVEAL_HAND', player: 'OPPONENT' }, { failurePolicy: 'REQUIRE_ANY' })] });
export const pokeBola = trainer({ baseName: 'Poké Bola', subtype: 'ITEM',
  effects: [onPlay({ type: 'SEARCH_DECK', player: 'OWN', filter: { categories: ['POKEMON'], stages: ['BASIC'], excludeFossils: true }, count: 1, mode: 'RANDOM',
    destination: 'HAND', reveal: true, shuffleAfter: true }, { failurePolicy: 'REQUIRE_ANY' })] });
export const cartaoVermelho = trainer({ baseName: 'Cartão Vermelho', subtype: 'ITEM',
  effects: [onPlay({ type: 'SHUFFLE_HAND_INTO_DECK', player: 'OPPONENT' }), onPlay({ type: 'DRAW_CARDS', player: 'OPPONENT', count: 3 })] });
export const pesquisaDoProfessor = trainer({ baseName: 'Pesquisa do Professor', subtype: 'SUPPORTER',
  effects: [onPlay({ type: 'DRAW_CARDS', player: 'OWN', count: 2 }, { failurePolicy: 'REQUIRE_ANY' })] });

/** Promos na ordem do P-A, com o número de coleção oficial. */
export const PROMO_A: readonly { readonly number: number; readonly card: TrainerCard }[] = [
  { number: 1, card: pocao }, { number: 2, card: velocidadeX }, { number: 3, card: lupaDeMao },
  { number: 5, card: pokeBola }, { number: 6, card: cartaoVermelho }, { number: 7, card: pesquisaDoProfessor },
];
