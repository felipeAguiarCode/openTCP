// Texto PT-BR gerado do DSL para os padrões do set Genetic Apex (efeitos-dsl.md §15, FX-011, FX-023): filtros por
// nome/condição/dano, plural em alvos “todos”, restrição de jogador, bônus de dano em frase, busca por tipo/nome,
// alvo aleatório repetido, Pokémon Defensor e os opcodes novos. Cada parágrafo cabe nas 3 linhas do template.
import { describe, expect, it } from 'vitest';
import { ability, add, attack, block, c, choose, flip, heads, mul, onPlay, pokemon, post, pre, trainer, SELF, OPP_ACTIVE, OWN_ACTIVE } from '../../content/builders.ts';
import { printing } from '../../content/builders.ts';
import { wrapLines, TEXT_FIT_MODEL, estimateTextFit } from '../editor/textfit.ts';
import { deckLimitKey, deckLimitKeyV1, DECK_LIMIT_KEY_ALGORITHM } from './naming.ts';
import { abilityText, attackText, blockText, cardFace, damageNotation, trainerText, type TextOptions } from './text.ts';
import type { Ability, Attack, CardDefinition, Condition, Selector } from './types.ts';

const NAMES: Record<string, string> = {
  'nidoran-m': 'Nidoran♂', 'nidoking': 'Nidoking', 'muk': 'Muk', 'weezing': 'Weezing', 'ninetales': 'Ninetales', 'rapidash': 'Rapidash',
  'magmar': 'Magmar', 'raichu': 'Raichu', 'electrode': 'Electrode', 'electabuzz': 'Electabuzz', 'golem': 'Golem', 'onix': 'Onix',
};
const opts: TextOptions = { nameOf: (key) => NAMES[key] ?? null };
const LINES = TEXT_FIT_MODEL.paragraphMaxLines;
const fits = (text: string) => wrapLines(text, TEXT_FIT_MODEL.bodyCharsPerLine);

const DEFENDING: Selector = { scope: 'DEFENDING' };
const NEXT_OPP = { kind: 'NEXT_OPPONENT_TURN' } as const;
const tails = (reference = 'coins'): Condition => ({ op: 'COMPARE', left: { op: 'COUNT_TAILS', reference }, cmp: 'GE', right: c(1) });
const atLeastHeads = (n: number, reference = 'coins'): Condition => ({ op: 'COMPARE', left: heads(reference), cmp: 'GE', right: c(n) });
const bonus = (amount: number) => ({ type: 'DEAL_DAMAGE' as const, target: OPP_ACTIVE, amount, category: 'ATTACK' as const });

function expectAttack(a: Attack, text: string, notation?: string): void {
  const t = attackText(a, opts);
  expect(t).toBe(text);
  expect(fits(t), `“${t}” passa de ${LINES} linhas`).toBeLessThanOrEqual(LINES);
  if (notation !== undefined) expect(damageNotation(a)).toBe(notation);
}
function expectAbility(a: Ability, text: string): void {
  const t = abilityText(a, opts);
  expect(t).toBe(text);
  expect(fits(t), `“${t}” passa de ${LINES} linhas`).toBeLessThanOrEqual(LINES);
}

describe('FX-023 · bônus de dano em frase natural (sem aritmética)', () => {
  it('Exeggutor (fórmula de soma com 1 moeda) e a forma por bloco produzem a mesma frase e “30+”', () => {
    expectAttack(attack({ id: 'a', name: 'Pisotear', cost: { GRASS: 1 }, formula: add(c(30), mul(c(30), heads())), effects: [pre(flip(1))] }),
      'Jogue uma moeda. Se sair cara, este ataque causa 30 de dano a mais.', '30+');
    expectAttack(attack({ id: 'a', name: 'Pisotear', cost: { GRASS: 1 }, damage: 30, effects: [pre(flip(1)), post(bonus(30), { condition: atLeastHeads(1) })] }),
      'Jogue uma moeda. Se sair cara, este ataque causa 30 de dano a mais.', '30+');
    expectAttack(attack({ id: 'a', name: 'Pisotear', cost: { GRASS: 1 }, damage: 30,
      effects: [pre(flip(1)), pre({ type: 'MODIFY', stat: 'DAMAGE_DEALT', amount: 30, target: SELF, duration: { kind: 'THIS_TURN' } }, { condition: atLeastHeads(1) })] }),
    'Jogue uma moeda. Se sair cara, este ataque causa 30 de dano a mais.', '30+');
  });

  it('Kingler: “se as duas saírem cara”', () => {
    expectAttack(attack({ id: 'a', name: 'Caranguejo', cost: { WATER: 2 }, damage: 80, effects: [pre(flip(2)), post(bonus(80), { condition: atLeastHeads(2) })] }),
      'Jogue 2 moedas. Se as duas saírem cara, este ataque causa 80 de dano a mais.', '80+');
  });

  it('Blastoise: Energia extra além do custo', () => {
    expectAttack(attack({ id: 'a', name: 'Hidrobomba', cost: { WATER: 2, COLORLESS: 1 }, damage: 80, effects: [
      post(bonus(60), { condition: { op: 'COMPARE', left: { op: 'EXTRA_ENERGY_UNITS', energyType: 'WATER' }, cmp: 'GE', right: c(2) } })] }),
    'Se este Pokémon tiver pelo menos 2 Energias de Água extras ligadas, este ataque causa 60 de dano a mais.', '80+');
  });

  it('Bruxish, Primeape e Muk: dano no alvo, dano próprio e condição', () => {
    expectAttack(attack({ id: 'a', name: 'Bico', cost: { PSYCHIC: 1 }, damage: 10, effects: [post(bonus(60), { condition: { op: 'EXISTS', selector: { scope: 'OPPONENT_ACTIVE', filter: { hasDamage: true } } } })] }),
      'Se o Pokémon Ativo do oponente tiver dano, este ataque causa 60 de dano a mais.', '10+');
    expectAttack(attack({ id: 'a', name: 'Fúria', cost: { FIGHTING: 1 }, damage: 40, effects: [post(bonus(60), { condition: { op: 'COMPARE', left: { op: 'DAMAGE_ON_SOURCE' }, cmp: 'GT', right: c(0) } })] }),
      'Se este Pokémon tiver dano, este ataque causa 60 de dano a mais.', '40+');
    expectAttack(attack({ id: 'a', name: 'Lodo', cost: { DARKNESS: 1 }, damage: 70, effects: [post(bonus(50), { condition: { op: 'HAS_CONDITION', selector: OPP_ACTIVE, condition: 'POISONED' } })] }),
      'Se o Pokémon Ativo do oponente estiver Envenenado, este ataque causa 50 de dano a mais.', '70+');
  });

  it('Electabuzz: cara dá bônus; coroa causa dano a si mesmo', () => {
    expectAttack(attack({ id: 'a', name: 'Choque', cost: { LIGHTNING: 2 }, damage: 40, effects: [
      pre(flip(1)), post(bonus(40), { condition: atLeastHeads(1) }), post({ type: 'DEAL_DAMAGE', target: SELF, amount: 20, category: 'EFFECT' }, { condition: tails() })] }),
    'Jogue uma moeda. Se sair cara, este ataque causa 40 de dano a mais. Se sair coroa, este Pokémon também causa 20 de dano a si mesmo.', '40+');
  });

  it('contagens: por Pokémon do tipo no Banco, por Pokémon nomeado e por Energia no Ativo do oponente', () => {
    expectAttack(attack({ id: 'a', name: 'Círculo', cost: { LIGHTNING: 2 }, formula: mul(c(30), { op: 'COUNT_POKEMON', selector: { scope: 'OWN_BENCH', filter: { types: ['LIGHTNING'] } } }) }),
      'Este ataque causa 30 de dano para cada Pokémon do tipo Elétrico no seu Banco.', '30×');
    expectAttack(attack({ id: 'a', name: 'Varredura', cost: { COLORLESS: 2 }, formula: mul(c(30), { op: 'COUNT_BENCH_POKEMON', side: 'OWN' }) }),
      'Este ataque causa 30 de dano para cada Pokémon no seu Banco.', '30×');
    expectAttack(attack({ id: 'a', name: 'Proteção', cost: { DARKNESS: 3 }, formula: add(c(80), mul(c(50), { op: 'COUNT_POKEMON', selector: { scope: 'OWN_BENCH', filter: { deckLimitKeys: ['nidoking'] } } })) }),
      'Este ataque causa 50 de dano a mais para cada Nidoking no seu Banco.', '80+');
    expectAttack(attack({ id: 'a', name: 'Gelo', cost: { WATER: 1 }, formula: add(c(30), mul(c(20), { op: 'COUNT_ATTACHED_ENERGIES', selector: OPP_ACTIVE })) }),
      'Este ataque causa 20 de dano a mais para cada Energia ligada ao Pokémon Ativo do oponente.', '30+');
    expectAttack(attack({ id: 'a', name: 'Lambida', cost: { COLORLESS: 3 }, formula: mul(c(60), heads()), effects: [pre({ type: 'FLIP_COINS', untilTails: true, outputId: 'coins' })] }),
      'Jogue uma moeda até sair coroa. Este ataque causa 60 de dano para cada cara.', '60×');
  });
});

describe('FX-023 · alvos, plural e (sem Fraqueza)', () => {
  it('Dragonite: blocos aleatórios idênticos viram uma frase só', () => {
    const hit = post({ type: 'DEAL_DAMAGE', target: { scope: 'OPPONENT_POKEMON', pick: { mode: 'RANDOM', count: 1 } }, amount: 50, category: 'ATTACK' });
    expectAttack(attack({ id: 'a', name: 'Ira', cost: { WATER: 1, LIGHTNING: 1 }, damage: 0, target: null, effects: [hit, hit, hit, hit] }),
      '1 dos Pokémon do oponente é escolhido aleatoriamente 4 vezes; para cada vez, cause 50 de dano a ele.', '');
  });

  it('“cada” para seleção ALL em escopo múltiplo; sem “(sem Fraqueza)” quando o Ativo é escolhível', () => {
    expectAttack(attack({ id: 'a', name: 'Nevasca', cost: { WATER: 3 }, damage: 80, effects: [post({ type: 'DEAL_DAMAGE', target: { scope: 'OPPONENT_BENCH' }, amount: 10, category: 'ATTACK' })] }),
      'Este ataque também causa 10 de dano a cada Pokémon no Banco do oponente (sem Fraqueza).');
    expectAttack(attack({ id: 'a', name: 'Trovão', cost: { LIGHTNING: 3 }, damage: 100, effects: [post({ type: 'DEAL_DAMAGE', target: choose('OWN_BENCH'), amount: 30, category: 'EFFECT' })] }),
      'Este ataque também causa 30 de dano a um dos seus Pokémon no Banco (sem Fraqueza).');
    expectAttack(attack({ id: 'a', name: 'Disparo', cost: { LIGHTNING: 1 }, damage: 30, target: choose('OPPONENT_POKEMON') }),
      'Este ataque causa 30 de dano a um dos Pokémon do oponente.', '30');
    expectAttack(attack({ id: 'a', name: 'Chute', cost: { FIGHTING: 1 }, damage: 30, target: choose('OPPONENT_BENCH') }),
      'Este ataque causa 30 de dano a um dos Pokémon no Banco do oponente (sem Fraqueza).', '30');
    expectAttack(attack({ id: 'a', name: 'Recuo', cost: { FIRE: 2 }, damage: 100, effects: [post({ type: 'DEAL_DAMAGE', target: SELF, amount: 20, category: 'EFFECT' })] }),
      'Este Pokémon também causa 20 de dano a si mesmo.');
  });

  it('cura em todos os seus Pokémon e em um do tipo', () => {
    expectAbility(ability({ id: 'p', name: 'Pó Curativo', kind: 'ACTIVATED', sourcePositions: ['ACTIVE', 'BENCH'], usageLimit: { scope: 'INSTANCE_TURN', count: 1 },
      effects: [block('ON_ACTIVATE', { type: 'HEAL_DAMAGE', target: { scope: 'OWN_POKEMON' }, amount: 20 })] }),
    'Uma vez durante o seu turno, você pode curar 20 de dano de cada um dos seus Pokémon.');
    expect(trainerText(trainer({ baseName: 'Erika', subtype: 'SUPPORTER', effects: [onPlay({ type: 'HEAL_DAMAGE', target: choose('OWN_POKEMON', { types: ['GRASS'] }), amount: 50 })] }), opts))
      .toBe('Cure 50 de dano de um dos seus Pokémon do tipo Planta. Você só pode jogar 1 Apoiador por turno.');
  });
});

describe('FX-023 · Pokémon Defensor, restrições e proteção', () => {
  it('Vulpix, Arbok, Cubone e Omastar', () => {
    expectAttack(attack({ id: 'a', name: 'Rabo', cost: { COLORLESS: 1 }, damage: 0, target: null, effects: [pre(flip(1)),
      post({ type: 'RESTRICT_ACTION', target: DEFENDING, actions: ['ATTACK'], duration: { kind: 'NEXT_OPPONENT_TURN', removeOn: ['TARGET_LEAVES_ACTIVE'] } }, { condition: atLeastHeads(1) })] }),
    'Jogue uma moeda. Se sair cara, durante o próximo turno do oponente, o Pokémon Defensor não pode atacar.');
    expectAttack(attack({ id: 'a', name: 'Aperto', cost: { DARKNESS: 2 }, damage: 60, effects: [post({ type: 'RESTRICT_ACTION', target: DEFENDING, actions: ['RETREAT'], duration: NEXT_OPP })] }),
      'Durante o próximo turno do oponente, o Pokémon Defensor não pode recuar.', '60');
    expectAttack(attack({ id: 'a', name: 'Osso', cost: { FIGHTING: 1 }, damage: 0, target: null, effects: [post({ type: 'MODIFY', stat: 'DAMAGE_DEALT', amount: -20, target: DEFENDING, duration: NEXT_OPP })] }),
      'Durante o próximo turno do oponente, os ataques do Pokémon Defensor causam −20 de dano.');
  });

  it('restrição de jogador: Psyduck (ataque) e Gengar ex (Habilidade contínua no Ativo)', () => {
    expectAttack(attack({ id: 'a', name: 'Dor de Cabeça', cost: { COLORLESS: 1 }, damage: 10, effects: [post({ type: 'RESTRICT_ACTION', target: { scope: 'OPPONENT_POKEMON' }, actions: ['PLAY_SUPPORTER'], duration: NEXT_OPP })] }),
      'O oponente não pode jogar cartas de Apoiador da mão durante o próximo turno dele.');
    expectAbility(ability({ id: 'g', name: 'Feitiço', kind: 'CONTINUOUS', sourcePositions: ['ACTIVE'],
      effects: [block('CONTINUOUS', { type: 'RESTRICT_ACTION', target: { scope: 'OPPONENT_POKEMON' }, actions: ['PLAY_SUPPORTER'], duration: { kind: 'WHILE_SOURCE_IN_PLAY' } })] }),
    'Enquanto este Pokémon estiver no Ativo, o oponente não pode jogar cartas de Apoiador da mão.');
  });

  it('Dugtrio: o par PREVENT_DAMAGE + PREVENT_EFFECTS vira uma frase', () => {
    expectAttack(attack({ id: 'a', name: 'Cavar', cost: { FIGHTING: 1 }, damage: 40, effects: [pre(flip(1)),
      post({ type: 'PREVENT_DAMAGE', target: SELF, categories: ['ATTACK'], amount: 'ALL', duration: NEXT_OPP }, { condition: atLeastHeads(1) }),
      post({ type: 'PREVENT_EFFECTS', target: SELF, fromSide: 'OPPONENT', duration: NEXT_OPP }, { condition: atLeastHeads(1) })] }),
    'Jogue uma moeda. Se sair cara, durante o próximo turno do oponente, previna todo dano e efeito de ataques feitos a este Pokémon.');
  });

  it('Mr. Mime e Melmetal', () => {
    expectAttack(attack({ id: 'a', name: 'Barreira', cost: { PSYCHIC: 1 }, damage: 30, effects: [post({ type: 'MODIFY', stat: 'DAMAGE_TAKEN', amount: -20, target: SELF, duration: NEXT_OPP })] }),
      'Durante o próximo turno do oponente, este Pokémon recebe 20 de dano a menos de ataques.');
    expectAbility(ability({ id: 'm', name: 'Couraça', kind: 'CONTINUOUS', sourcePositions: ['ACTIVE', 'BENCH'],
      effects: [block('CONTINUOUS', { type: 'MODIFY', stat: 'DAMAGE_TAKEN', amount: -20, target: SELF, duration: { kind: 'WHILE_SOURCE_IN_PLAY' } })] }),
    'Este Pokémon recebe 20 de dano a menos de ataques.');
  });
});

describe('FX-023 · opcodes e fórmulas novas', () => {
  it('Moltres: “Se sair coroa, este ataque não faz nada” e notação simples', () => {
    expectAttack(attack({ id: 'a', name: 'Ataque Aéreo', cost: { FIRE: 3 }, damage: 130, effects: [pre(flip(1)), pre({ type: 'ATTACK_FAILS' }, { condition: tails() })] }),
      'Jogue uma moeda. Se sair coroa, este ataque não faz nada.', '130');
  });

  it('Kabutops: cura a mesma quantidade de dano causada', () => {
    expectAttack(attack({ id: 'a', name: 'Absorção', cost: { FIGHTING: 1 }, damage: 50, effects: [post({ type: 'HEAL_DAMAGE', target: SELF, amount: { op: 'DAMAGE_DEALT_BY_ATTACK' } })] }),
      'Cure deste Pokémon a mesma quantidade de dano que este ataque causou.', '50');
  });

  it('Moltres ex (distribuído por cara) e Misty (todas no mesmo alvo)', () => {
    expectAttack(attack({ id: 'a', name: 'Dança', cost: { FIRE: 1 }, damage: 0, target: null, effects: [pre(flip(3)),
      post({ type: 'ATTACH_ENERGY', target: { scope: 'OWN_BENCH', filter: { types: ['FIRE'] } }, energyType: 'FIRE', count: heads(), source: 'GENERATED', distribute: true })] }),
    'Jogue 3 moedas. Para cada cara, ligue 1 Energia de Fogo da sua Zona de Energia a um dos seus Pokémon do tipo Fogo no Banco.');
    expect(trainerText(trainer({ baseName: 'Misty', subtype: 'SUPPORTER', effects: [
      onPlay({ type: 'FLIP_COINS', untilTails: true, outputId: 'misty' }),
      onPlay({ type: 'ATTACH_ENERGY', target: choose('OWN_POKEMON', { types: ['WATER'] }), energyType: 'WATER', count: heads('misty'), source: 'GENERATED' })] }), opts))
      .toBe('Jogue uma moeda até sair coroa. Ligue 1 Energia de Água da sua Zona de Energia a um dos seus Pokémon do tipo Água para cada cara. Você só pode jogar 1 Apoiador por turno.');
  });

  it('Lt. Surge, Brock, Blaine e Koga: filtros por nome', () => {
    expect(trainerText(trainer({ baseName: 'Lt. Surge', subtype: 'SUPPORTER', effects: [onPlay({ type: 'MOVE_ENERGY', from: { scope: 'OWN_BENCH' },
      to: { scope: 'OWN_ACTIVE', filter: { deckLimitKeys: ['raichu', 'electrode', 'electabuzz'] } }, energyType: 'LIGHTNING', count: 'ALL' })] }), opts))
      .toBe('Mova todas as Energias de Elétrico dos seus Pokémon no Banco para o seu Raichu, Electrode ou Electabuzz no Ativo. Você só pode jogar 1 Apoiador por turno.');
    expect(trainerText(trainer({ baseName: 'Brock', subtype: 'SUPPORTER', effects: [onPlay({ type: 'ATTACH_ENERGY',
      target: choose('OWN_POKEMON', { deckLimitKeys: ['golem', 'onix'] }), energyType: 'FIGHTING', count: 1, source: 'GENERATED' })] }), opts))
      .toBe('Ligue 1 Energia de Lutador da sua Zona de Energia a um dos seus Golem ou Onix. Você só pode jogar 1 Apoiador por turno.');
    expect(trainerText(trainer({ baseName: 'Blaine', subtype: 'SUPPORTER', effects: [onPlay({ type: 'MODIFY', stat: 'DAMAGE_DEALT', amount: 30,
      target: { scope: 'OWN_POKEMON', filter: { deckLimitKeys: ['ninetales', 'rapidash', 'magmar'] } }, duration: { kind: 'THIS_TURN' } })] }), opts))
      .toBe('Durante este turno, os ataques dos seus Ninetales, Rapidash ou Magmar causam +30 de dano ao Pokémon Ativo do oponente. Você só pode jogar 1 Apoiador por turno.');
    expect(trainerText(trainer({ baseName: 'Koga', subtype: 'SUPPORTER', effects: [onPlay({ type: 'RETURN_TO_HAND',
      target: { scope: 'OWN_ACTIVE', filter: { deckLimitKeys: ['muk', 'weezing'] } } })] }), opts))
      .toBe('Coloque na sua mão o seu Muk ou Weezing Ativo e todas as cartas ligadas a ele. Você só pode jogar 1 Apoiador por turno.');
  });

  it('busca por tipo/nome e Banco a partir do baralho', () => {
    expectAttack(attack({ id: 'a', name: 'Chamar', cost: { COLORLESS: 1 }, damage: 0, target: null,
      effects: [post({ type: 'SEARCH_DECK', player: 'OWN', filter: { categories: ['POKEMON'], types: ['GRASS'] }, count: 1, mode: 'RANDOM', destination: 'HAND' })] }),
    'Coloque 1 Pokémon do tipo Planta aleatório do seu baralho na sua mão.');
    expectAttack(attack({ id: 'a', name: 'Chamar Par', cost: { COLORLESS: 1 }, damage: 0, target: null,
      effects: [post({ type: 'PUT_ON_BENCH', from: 'DECK', filter: { deckLimitKeys: ['nidoran-m'] }, count: 1, mode: 'RANDOM', side: 'OWN' })] }),
    'Coloque 1 Nidoran♂ aleatório do seu baralho no seu Banco.');
    expect(trainerText(trainer({ baseName: 'Poké Ball', subtype: 'ITEM', effects: [onPlay({ type: 'SEARCH_DECK', player: 'OWN',
      filter: { categories: ['POKEMON'], stages: ['BASIC'] }, count: 1, mode: 'RANDOM', destination: 'HAND' })] }), opts))
      .toBe('Coloque 1 Pokémon Básico aleatório do seu baralho na sua mão.');
  });

  it('Red Card, Hand Scope e X Speed', () => {
    expect(trainerText(trainer({ baseName: 'Red Card', subtype: 'ITEM', effects: [
      onPlay({ type: 'SHUFFLE_HAND_INTO_DECK', player: 'OPPONENT' }), onPlay({ type: 'DRAW_CARDS', player: 'OPPONENT', count: 3 })] }), opts))
      .toBe('O oponente embaralha a mão no baralho dele. O oponente compra 3 cartas.');
    expect(trainerText(trainer({ baseName: 'Hand Scope', subtype: 'ITEM', effects: [onPlay({ type: 'REVEAL_HAND', player: 'OPPONENT' })] }), opts))
      .toBe('O oponente revela a mão.');
    expect(trainerText(trainer({ baseName: 'X Speed', subtype: 'ITEM', effects: [onPlay({ type: 'MODIFY', stat: 'RETREAT_COST', amount: -1, target: OWN_ACTIVE, duration: { kind: 'THIS_TURN' } })] }), opts))
      .toBe('Durante este turno, o custo de Recuo do seu Pokémon Ativo diminui em 1.');
  });

  it('Ditto, Gyarados, Persian e Aerodactyl', () => {
    expectAttack(attack({ id: 'a', name: 'Copiar', cost: {}, damage: 0, target: null, effects: [pre({ type: 'COPY_ATTACK', from: { scope: 'OPPONENT_POKEMON' }, requireEnergy: true })] }),
      'Escolha um ataque dos Pokémon do oponente e use-o como este ataque. Sem a Energia necessária, este ataque não faz nada.');
    expectAttack(attack({ id: 'a', name: 'Fúria', cost: { WATER: 3 }, damage: 100, effects: [post({ type: 'DISCARD_ENERGY', target: OPP_ACTIVE, count: 1, chooser: 'RANDOM' })] }),
      'Descarte 1 Energia aleatória do Pokémon Ativo do oponente.');
    expectAttack(attack({ id: 'a', name: 'Garra', cost: { COLORLESS: 2 }, damage: 40, effects: [pre(flip(1)), post({ type: 'DISCARD_CARDS', zone: 'OPPONENT_HAND', count: 1, chooser: 'RANDOM' }, { condition: atLeastHeads(1) })] }),
      'Jogue uma moeda. Se sair cara, descarte 1 carta aleatória da mão do oponente.');
    expectAttack(attack({ id: 'a', name: 'Fóssil', cost: { COLORLESS: 1 }, damage: 0, target: null, effects: [pre(flip(1)), post({ type: 'SHUFFLE_INTO_DECK', target: OPP_ACTIVE }, { condition: atLeastHeads(1) })] }),
      'Jogue uma moeda. Se sair cara, o oponente embaralha o Pokémon Ativo dele e as cartas ligadas a ele no baralho.');
  });
});

describe('FX-023 · Habilidades ativadas em uma frase', () => {
  const activated = (effects: Ability['effects'], sourcePositions: Ability['sourcePositions'] = ['ACTIVE', 'BENCH']) =>
    ability({ id: 'h', name: 'H', kind: 'ACTIVATED', sourcePositions, usageLimit: { scope: 'INSTANCE_TURN', count: 1 }, effects });

  it('Victreebel, Weezing, Hypno, Porygon, Pidgeot, Gardevoir e Greninja', () => {
    expectAbility(activated([block('ON_ACTIVATE', { type: 'SWITCH_ACTIVE', side: 'OPPONENT', chooser: 'CONTROLLER', filter: { stages: ['BASIC'] } })], ['ACTIVE']),
      'Uma vez durante o seu turno, se este Pokémon estiver no Ativo, você pode trocar o Pokémon Ativo do oponente por um Pokémon Básico do Banco dele.');
    expectAbility(activated([block('ON_ACTIVATE', { type: 'APPLY_CONDITION', target: OPP_ACTIVE, condition: 'POISONED' })], ['ACTIVE']),
      'Uma vez durante o seu turno, se este Pokémon estiver no Ativo, você pode deixar o Pokémon Ativo do oponente Envenenado.');
    expectAbility(activated([block('ON_ACTIVATE', flip(1)), block('ON_ACTIVATE', { type: 'APPLY_CONDITION', target: OPP_ACTIVE, condition: 'ASLEEP' }, { condition: atLeastHeads(1) })]),
      'Uma vez durante o seu turno, você pode jogar uma moeda. Se sair cara, o Pokémon Ativo do oponente fica Adormecido.');
    expectAbility(activated([block('ON_ACTIVATE', { type: 'LOOK_AT_TOP', player: 'OWN', count: 1 })]),
      'Uma vez durante o seu turno, você pode olhar a carta do topo do seu baralho.');
    expectAbility(activated([block('ON_ACTIVATE', { type: 'SWITCH_ACTIVE', side: 'OPPONENT', chooser: 'OPPONENT' })]),
      'Uma vez durante o seu turno, você pode trocar o Pokémon Ativo do oponente por um do Banco dele. O oponente escolhe.');
    expectAbility(activated([block('ON_ACTIVATE', { type: 'ATTACH_ENERGY', target: { scope: 'OWN_ACTIVE', filter: { types: ['PSYCHIC'] } }, energyType: 'PSYCHIC', count: 1, source: 'GENERATED' })]),
      'Uma vez durante o seu turno, você pode ligar 1 Energia de Psíquico da sua Zona de Energia ao seu Pokémon Ativo do tipo Psíquico.');
    expectAbility(activated([block('ON_ACTIVATE', { type: 'DEAL_DAMAGE', target: choose('OPPONENT_POKEMON'), amount: 20, category: 'EFFECT' })]),
      'Uma vez durante o seu turno, você pode causar 20 de dano a um dos Pokémon do oponente.');
  });

  it('Poliwrath (gatilho no Ativo contra o atacante)', () => {
    expectAbility(ability({ id: 'c', name: 'Contra-Ataque', kind: 'TRIGGERED', sourcePositions: ['ACTIVE'],
      trigger: { event: 'DAMAGE_APPLIED', filter: { subject: 'SELF', subjectRole: 'TARGET', damageCategory: 'ATTACK' } },
      effects: [block('ON_TRIGGER', { type: 'DEAL_DAMAGE', target: { scope: 'EVENT_SOURCE' }, amount: 20, category: 'EFFECT' })] }),
    'Enquanto este Pokémon estiver no Ativo, sempre que este Pokémon receber dano de um ataque do oponente, cause 20 de dano ao Pokémon atacante.');
  });
});

describe('nomes de cartas e face', () => {
  it('cardFace passa o resolvedor de nomes para os textos', () => {
    const koga = trainer({ baseName: 'Koga', subtype: 'SUPPORTER', effects: [onPlay({ type: 'RETURN_TO_HAND', target: { scope: 'OWN_ACTIVE', filter: { deckLimitKeys: ['muk', 'weezing'] } } })] });
    const face = cardFace(koga, printing({ card: koga, setId: 'test', number: 1, rarity: 'COMMON' }), (key) => NAMES[key] ?? null);
    expect(face.trainerText).toContain('o seu Muk ou Weezing Ativo');
    expect(estimateTextFit(face).regions.every((r) => !r.overflow)).toBe(true);
    // Sem resolvedor, a chave vira um nome legível (sem travar).
    expect(trainerText(koga)).toContain('o seu Muk ou Weezing Ativo');
  });

  it('Fóssil com tipo e descarte voluntário', () => {
    const ambar: CardDefinition = trainer({ baseName: 'Old Amber', subtype: 'ITEM', effects: [], rules: { destinationAfterPlay: 'BENCH_AS_POKEMON',
      fieldBehavior: { kind: 'PLAY_AS_POKEMON', hp: 40, types: ['COLORLESS'], retreatAllowed: false, knockoutPoints: 1, canAttack: false, ownerMayDiscardDuringMainPhase: true } } });
    expect(trainerText(ambar)).toBe('Jogue esta carta como um Pokémon Básico do tipo Incolor de 40 PS no seu Banco. Ela não pode atacar nem recuar e não conta como Básico na mão inicial. Durante o seu turno, você pode descartá-la do jogo.');
  });

  it('blockText avulso continua determinístico (FX-011)', () => {
    const b = post({ type: 'APPLY_CONDITION', target: OPP_ACTIVE, condition: 'BURNED' }, { condition: atLeastHeads(1) });
    expect(blockText(b)).toBe(blockText(b));
    expect(blockText(b)).toBe('Se sair pelo menos 1 cara, o Pokémon Ativo do oponente fica Queimado.');
  });
});

describe('FX-024 · deck-limit-key-v2 (♀/♂)', () => {
  it('Nidoran♀ e Nidoran♂ não colidem; nomes sem ♀/♂ mantêm a chave da v1', () => {
    expect(deckLimitKey('Nidoran♀')).toBe('nidoran-f');
    expect(deckLimitKey('Nidoran♂')).toBe('nidoran-m');
    expect(deckLimitKey('Braseiro ex')).toBe('braseiro-ex');
    expect(deckLimitKey('Faísca')).toBe('faisca');
    expect(deckLimitKey('Mr. Mime')).toBe('mr-mime');
    expect(deckLimitKey('Mega Braseiro ex')).toBe('mega-braseiro-ex');
    expect(deckLimitKeyV1('Nidoran♂')).toBe('nidoran-m');
    expect(DECK_LIMIT_KEY_ALGORITHM).toBe('deck-limit-key-v2');
  });

  it('o builder usa a chave nova (id e evolução por nome)', () => {
    const female = pokemon({ baseName: 'Nidoran♀', stage: 'BASIC', type: 'PSYCHIC', hp: 60, retreat: 1, attacks: [] });
    const male = pokemon({ baseName: 'Nidoran♂', stage: 'BASIC', type: 'PSYCHIC', hp: 60, retreat: 1, attacks: [] });
    expect(female.deckLimitKey).not.toBe(male.deckLimitKey);
    expect([female.id, male.id]).toEqual(['nidoran-f', 'nidoran-m']);
  });
});
