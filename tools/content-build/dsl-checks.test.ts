// content-build: limite de linhas do texto gerado (textfit.ts) e uso de DEFENDING/ATTACK_FAILS só em ataques.
import { describe, expect, it } from 'vitest';
import { ability, attack, block, onPlay, pokemon, post, printing, trainer } from '../../src/content/builders.ts';
import { checkAttackOnly, textFitOverflows } from './validate.ts';

const curto = pokemon({ baseName: 'Curto', stage: 'BASIC', type: 'FIRE', hp: 60, retreat: 1, weakness: null,
  attacks: [attack({ id: 'a', name: 'Brasa', cost: { FIRE: 1 }, damage: 20, effects: [post({ type: 'DISCARD_ENERGY', target: { scope: 'SELF' }, count: 1, energyType: 'FIRE' })] })] });
// Sete blocos diferentes num ataque: muito além de 3 linhas.
const longo = pokemon({ baseName: 'Longo', stage: 'BASIC', type: 'FIRE', hp: 60, retreat: 1, weakness: null,
  attacks: [attack({ id: 'a', name: 'Excesso', cost: { FIRE: 1 }, damage: 20, effects: [
    post({ type: 'DISCARD_ENERGY', target: { scope: 'SELF' }, count: 1, energyType: 'FIRE' }),
    post({ type: 'APPLY_CONDITION', target: { scope: 'OPPONENT_ACTIVE' }, condition: 'BURNED' }),
    post({ type: 'DRAW_CARDS', player: 'OWN', count: 2 }),
    post({ type: 'HEAL_DAMAGE', target: { scope: 'OWN_POKEMON' }, amount: 20 }),
    post({ type: 'SWITCH_ACTIVE', side: 'OPPONENT', chooser: 'OPPONENT' }),
  ] })] });

describe('content-build · texto dentro de 3 linhas (CARD_TEXT_OVERFLOW)', () => {
  const prints = [curto, longo].map((card, i) => printing({ card, setId: 'test', number: i + 1, rarity: 'COMMON' }));

  it('aponta só a carta cujo parágrafo estoura, com o número de linhas', () => {
    const out = textFitOverflows([curto, longo], prints);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/^carta longo: primeiro ataque \(“Excesso”\) com \d+ linhas \(máximo 4\.5\) — CARD_TEXT_OVERFLOW$/);
  });

  it('carta sem impressão não é composta (não acusa)', () => {
    expect(textFitOverflows([longo], [])).toEqual([]);
  });
});

describe('content-build · DEFENDING e ATTACK_FAILS só em ataques', () => {
  it('aceita em ataques e recusa em Habilidades e Treinadores', () => {
    const ok = pokemon({ baseName: 'Ok', stage: 'BASIC', type: 'FIRE', hp: 60, retreat: 1, weakness: null,
      attacks: [attack({ id: 'a', name: 'A', cost: {}, damage: 10, effects: [post({ type: 'RESTRICT_ACTION', target: { scope: 'DEFENDING' }, actions: ['ATTACK'], duration: { kind: 'NEXT_OPPONENT_TURN' } }), post({ type: 'ATTACK_FAILS' })] })] });
    const hab = pokemon({ baseName: 'Hab', stage: 'BASIC', type: 'FIRE', hp: 60, retreat: 1, weakness: null, attacks: [],
      abilities: [ability({ id: 'h', name: 'H', kind: 'ACTIVATED', sourcePositions: ['ACTIVE'], usageLimit: { scope: 'INSTANCE_TURN', count: 1 },
        effects: [block('ON_ACTIVATE', { type: 'APPLY_CONDITION', target: { scope: 'DEFENDING' }, condition: 'ASLEEP' })] })] });
    const item = trainer({ baseName: 'Falha', subtype: 'ITEM', effects: [onPlay({ type: 'ATTACK_FAILS' })] });
    const errs = (c: Parameters<typeof checkAttackOnly>[0]) => { const e: string[] = []; checkAttackOnly(c, e); return e; };
    expect(errs(ok)).toEqual([]);
    expect(errs(hab)).toEqual(['carta hab: seletor DEFENDING fora dos efeitos de ataque (SELECTOR_IMPOSSIBLE)']);
    expect(errs(item)).toEqual(['carta falha: ATTACK_FAILS fora dos efeitos de ataque (ATTACK_ONLY_OPERATION)']);
  });
});
