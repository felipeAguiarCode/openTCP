// Filtro e ordenação da coleção pelo símbolo de raridade do Pocket (◊…◊◊◊◊, ☆…☆☆☆, ♛, PROMO).
import { describe, expect, it } from 'vitest';
import { buildBundle } from '../content/bundle.ts';
import { raritySymbol } from '../domain/cards/rarity.ts';
import { definitionKey } from '../domain/cards/types.ts';
import { EMPTY_FILTER, filterGroups, type CollectionGroup } from './collection.ts';

const bundle = buildBundle();
const groups: CollectionGroup[] = bundle.cards.map((definition) => {
  const key = definitionKey(definition.id, definition.version);
  const printings = bundle.printings.filter((p) => definitionKey(p.cardDefinitionId, p.cardDefinitionVersion) === key);
  return { definition, key, printings, owned: 0, ownedByPrinting: new Map(), favorite: false, wishlist: false, isNew: false };
});
const names = (gs: readonly CollectionGroup[]) => gs.map((g) => g.definition.name);

describe('coleção por símbolo de raridade', () => {
  it('◊◊◊◊ separa os ex normais; ♛ do A1 só as três coroas; PROMO só cartas com impressão promocional', () => {
    const ex = filterGroups(groups, { ...EMPTY_FILTER, rarity: '◊◊◊◊' });
    expect(ex.length).toBeGreaterThan(0);
    expect(ex.every((g) => g.definition.ruleBox !== 'NONE')).toBe(true);
    expect(names(filterGroups(groups, { ...EMPTY_FILTER, setId: 'a1', rarity: '♛' })).sort()).toEqual(['Mewtwo ex', 'Pikachu ex', 'Charizard ex'].sort());
    const promo = filterGroups(groups, { ...EMPTY_FILTER, rarity: 'PROMO' });
    expect(promo.every((g) => g.printings.some((p) => p.rarity === 'PROMO'))).toBe(true);
    expect(names(promo)).toEqual(expect.arrayContaining(['Poção', 'Pesquisa do Professor']));
  });

  it('o filtro considera qualquer impressão do grupo (a ☆ alternativa de um ◊ comum)', () => {
    const star = filterGroups(groups, { ...EMPTY_FILTER, rarity: '☆' });
    expect(star.some((g) => g.printings.some((p) => raritySymbol(p) === '◊'))).toBe(true);
  });

  it('ordenar por raridade põe as coroas primeiro e o ◊ simples por último entre os A1', () => {
    const sorted = filterGroups(groups, { ...EMPTY_FILTER, setId: 'a1', category: 'POKEMON', sort: 'RARITY' });
    expect(sorted[0]!.printings.some((p) => raritySymbol(p) === '♛')).toBe(true);
    expect(sorted.at(-1)!.printings.every((p) => raritySymbol(p) === '◊')).toBe(true);
  });
});
