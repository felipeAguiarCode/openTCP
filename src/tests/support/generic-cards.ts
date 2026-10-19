// Catálogo genérico de teste (antigo catálogo inicial do conteúdo, campanha.md §3.3–§3.4 até a v1): 12 criaturas e
// 6 Treinadores. Fixture estável dos testes de regra, IA, animação, armazenamento e editor — independe do conteúdo real.
import { attack, choose, healSelf, onPlay, continuous, pokemon, post, trainer, SELF } from '../../content/builders.ts';

// ---- Linha Fogo (Chama Constante)
export const faisca = pokemon({ baseName: 'Faísca', stage: 'BASIC', type: 'FIRE', hp: 70, retreat: 1, weakness: 'WATER',
  attacks: [attack({ id: 'fagulha', name: 'Fagulha', cost: { FIRE: 1 }, damage: 20 })] });
export const braseiro = pokemon({ baseName: 'Braseiro', stage: 'STAGE_1', from: ['faisca'], type: 'FIRE', hp: 110, retreat: 1, weakness: 'WATER',
  attacks: [attack({ id: 'golpe-de-chama', name: 'Golpe de Chama', cost: { FIRE: 1 }, damage: 40 })] });
export const carvito = pokemon({ baseName: 'Carvito', stage: 'BASIC', type: 'FIRE', hp: 80, retreat: 2, weakness: 'WATER',
  attacks: [attack({ id: 'brasa', name: 'Brasa', cost: { FIRE: 1 }, damage: 20 })] });
export const brasacu = pokemon({ baseName: 'Brasaçu', stage: 'STAGE_1', from: ['carvito'], type: 'FIRE', hp: 120, retreat: 2, weakness: 'WATER',
  attacks: [attack({ id: 'fornalha', name: 'Fornalha', cost: { FIRE: 2 }, damage: 70 })] });

// ---- Linha Água (Maré Serena)
export const gota = pokemon({ baseName: 'Gota', stage: 'BASIC', type: 'WATER', hp: 70, retreat: 1, weakness: 'LIGHTNING',
  attacks: [attack({ id: 'respingo', name: 'Respingo', cost: { WATER: 1 }, damage: 20 })] });
export const marulho = pokemon({ baseName: 'Marulho', stage: 'STAGE_1', from: ['gota'], type: 'WATER', hp: 110, retreat: 1, weakness: 'LIGHTNING',
  attacks: [attack({ id: 'onda-quebrada', name: 'Onda Quebrada', cost: { WATER: 1, COLORLESS: 1 }, damage: 50 })] });
export const nimbo = pokemon({ baseName: 'Nimbo', stage: 'BASIC', type: 'WATER', hp: 80, retreat: 1, weakness: 'LIGHTNING',
  attacks: [attack({ id: 'garoa', name: 'Garoa', cost: { WATER: 1 }, damage: 10, effects: [post(healSelf(10))] })] });
export const pluvion = pokemon({ baseName: 'Pluvion', stage: 'STAGE_1', from: ['nimbo'], type: 'WATER', hp: 120, retreat: 2, weakness: 'LIGHTNING',
  attacks: [attack({ id: 'chuva-restauradora', name: 'Chuva Restauradora', cost: { WATER: 2 }, damage: 60, effects: [post(healSelf(10))] })] });

// ---- Linha Planta (Jardim Vivo)
export const broto = pokemon({ baseName: 'Broto', stage: 'BASIC', type: 'GRASS', hp: 90, retreat: 1, weakness: 'FIRE',
  attacks: [
    attack({ id: 'folhinha', name: 'Folhinha', cost: { GRASS: 1 }, damage: 20 }),
    attack({ id: 'raiz-firme', name: 'Raiz Firme', cost: { GRASS: 2 }, damage: 50 }),
  ] });
export const folhariz = pokemon({ baseName: 'Folhariz', stage: 'STAGE_1', from: ['broto'], type: 'GRASS', hp: 120, retreat: 2, weakness: 'FIRE',
  attacks: [attack({ id: 'chicote-verde', name: 'Chicote Verde', cost: { GRASS: 2 }, damage: 60 })] });
export const semente = pokemon({ baseName: 'Semente', stage: 'BASIC', type: 'GRASS', hp: 60, retreat: 1, weakness: 'FIRE',
  attacks: [attack({ id: 'brotar', name: 'Brotar', cost: { GRASS: 1 }, damage: 10, effects: [post(healSelf(10))] })] });
export const ramante = pokemon({ baseName: 'Ramante', stage: 'STAGE_1', from: ['semente'], type: 'GRASS', hp: 100, retreat: 1, weakness: 'FIRE',
  attacks: [attack({ id: 'galho-vivo', name: 'Galho Vivo', cost: { GRASS: 1, COLORLESS: 1 }, damage: 50, effects: [post(healSelf(10))] })] });

// ---- Treinadores compartilhados
export const kitReparo = trainer({ baseName: 'Kit de Reparo', subtype: 'ITEM',
  effects: [onPlay({ type: 'HEAL_DAMAGE', target: choose('OWN_POKEMON', { hasDamage: true, excludeFossils: true }), amount: 20 }, { failurePolicy: 'REQUIRE_ANY' })] });
export const rastreador = trainer({ baseName: 'Rastreador', subtype: 'ITEM',
  effects: [onPlay({ type: 'SEARCH_DECK', player: 'OWN', filter: { categories: ['POKEMON'], stages: ['BASIC'], excludeFossils: true }, count: 1, mode: 'RANDOM', destination: 'HAND', reveal: true, shuffleAfter: true }, { failurePolicy: 'REQUIRE_ANY' })] });
export const trocaTatica = trainer({ baseName: 'Troca Tática', subtype: 'ITEM',
  effects: [onPlay({ type: 'SWITCH_ACTIVE', side: 'OWN', chooser: 'CONTROLLER' }, { failurePolicy: 'REQUIRE_ANY' })] });
export const estudioso = trainer({ baseName: 'Estudioso', subtype: 'SUPPORTER',
  effects: [onPlay({ type: 'DRAW_CARDS', player: 'OWN', count: 2 }, { failurePolicy: 'REQUIRE_ANY' })] });
export const mentoria = trainer({ baseName: 'Mentoria', subtype: 'SUPPORTER',
  effects: [onPlay({ type: 'MODIFY', stat: 'DAMAGE_DEALT', amount: 10, target: { scope: 'OWN_POKEMON' }, duration: { kind: 'THIS_TURN' }, appliesTo: { opponentActiveOnly: true, damageCategory: 'ATTACK' } }, { failurePolicy: 'BEST_EFFORT' })] });
export const talisma = trainer({ baseName: 'Talismã', subtype: 'TOOL',
  effects: [continuous({ type: 'MODIFY', stat: 'MAX_HP', amount: 10, target: SELF, duration: { kind: 'WHILE_SOURCE_IN_PLAY' } })] });

export const STARTER_POKEMON = [faisca, braseiro, carvito, brasacu, gota, marulho, nimbo, pluvion, broto, folhariz, semente, ramante] as const;
export const STARTER_TRAINERS = [kitReparo, rastreador, trocaTatica, estudioso, mentoria, talisma] as const;
