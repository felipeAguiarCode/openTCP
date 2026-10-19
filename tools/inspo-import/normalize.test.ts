import { describe, expect, it } from 'vitest';
import { POCKET_ROWS } from '../../src/content/source/pocket/data/index.ts';
import { pocketSet } from '../../src/content/source/pocket/registry.ts';
import { artFileName, cleanText, normalizeSet, portraitFileName, type Raw } from './normalize.ts';

const raw = (over: Partial<Raw> & { number: number }): Raw => ({
  name: 'Teste', category: 'Pokémon', subtype: 'Basic', element: 'Grass', hp: 60, abilities: [], attacks: [], rarity: '◊', pack: null, ...over,
});

describe('normalização do .inspo', () => {
  it('texto canônico: menos tipográfico, apóstrofo curvo, Pokemon, ponto colado e "],["', () => {
    expect(cleanText('takes −10  damage.It’s a Pokemon  with [R],[W]')).toBe("takes -10 damage. It's a Pokémon with [R], [W]");
    expect(cleanText(null)).toBeNull();
  });

  it('nome do arquivo de arte em maiúsculas', () => {
    expect(artFileName(pocketSet('A1a'), 1)).toBe('A1A-001.webp');
    expect(artFileName(pocketSet('P-B'), 42)).toBe('PB-042.webp');
    expect(portraitFileName('Lt._Surge_Emote_1_Masters.png')).toBe('lt-surge-emote-1.png');
    expect(portraitFileName('Blue_Masters_Emote_2.png')).toBe('blue-emote-2.png');
    expect(portraitFileName('Erika_Holiday_2020_Emote_3_Masters.png')).toBe('erika-holiday-2020-emote-3.png');
    expect(portraitFileName('Bea_Emote_4_Masters (1).png')).toBeNull();
  });

  it('brilhantes = ☆/☆☆ depois do último ☆☆☆; contagens conferidas', () => {
    const set = { ...pocketSet('A4b'), expect: { printings: 4, shiny: [1, 1] as const, bonus: [] } };
    const rows = normalizeSet(set, [raw({ number: 1, rarity: '☆' }), raw({ number: 2, rarity: '☆☆☆' }), raw({ number: 3, rarity: '☆' }), raw({ number: 4, rarity: '☆☆' })]);
    expect(rows.map((r) => r.rarity)).toEqual(['☆', '☆☆☆', '✵', '✵✵']);
    expect(() => normalizeSet({ ...set, expect: { ...set.expect, shiny: [0, 0] } }, [raw({ number: 1, rarity: '☆' }), raw({ number: 2, rarity: '☆☆☆' }), raw({ number: 3, rarity: '☆' }), raw({ number: 4, rarity: '☆☆' })])).toThrow(/brilhantes/);
  });

  it('Mega ex pela regra e pelo nome; divergência é erro', () => {
    const set = { ...pocketSet('P-B'), expect: { printings: 1, shiny: [0, 0] as const, bonus: [] } };
    const mega = normalizeSet(set, [raw({ number: 1, name: 'Mega Absol ex', rarity: 'Promo pack', rules: ['Mega Evolution ex rule: When your Mega Evolution Pokémon ex is Knocked Out, your opponent gets 3 points.'] })]);
    expect(mega[0]).toMatchObject({ ruleBox: 'MEGA_EX', rarity: 'PROMO', promoSource: 'PROMO_PACK' });
    expect(() => normalizeSet(set, [raw({ number: 1, name: 'Absol ex', rarity: 'Shop' })])).toThrow(/regra indica NONE/);
  });

  it('dados gerados: bebês só no A4/A4a, Mega ex só no P-B, promos sem símbolo', () => {
    const bonus = Object.entries(POCKET_ROWS).flatMap(([id, rows]) => rows.filter((r) => r.bonus).map((r) => `${id}-${r.number}`));
    expect(bonus).toEqual(['a4-32', 'a4-66', 'a4-70', 'a4-75', 'a4-77', 'a4-101', 'a4-166', 'a4-171', 'a4a-23', 'a4a-59', 'a4a-63', 'a4a-77']);
    const mega = Object.entries(POCKET_ROWS).flatMap(([id, rows]) => rows.filter((r) => r.ruleBox === 'MEGA_EX').map(() => id));
    expect(new Set(mega)).toEqual(new Set(['pb']));
    expect(mega).toHaveLength(8);
    expect(POCKET_ROWS.pa!.every((r) => r.rarity === 'PROMO') && POCKET_ROWS.pb!.every((r) => r.rarity === 'PROMO')).toBe(true);
  });
});
