// Receitas de deck do pacote (campanha §3.7): muitas, de todas as categorias e tipos, e todas decks jogáveis completos.
import { describe, expect, it } from 'vitest';
import { buildBundle } from './bundle.ts';
import { buildCatalog } from '../domain/cards/catalog.ts';
import { ENERGY_TYPES, isPokemon } from '../domain/cards/types.ts';
import { validateDeck } from '../domain/deck/validate.ts';

const bundle = buildBundle();
const catalog = buildCatalog(bundle.cards, bundle.printings);
const recipes = bundle.deckRecipes;
const defOf = (printingId: string) => catalog.definition(catalog.definitionKeyOfPrinting(printingId));

describe('receitas de deck', () => {
  it('55 receitas: 22 do meta, 18 por tipo (duas por tipo de Energia) e 15 da comunidade, com ids e nomes únicos', () => {
    expect(recipes).toHaveLength(55);
    const of = (c: string) => recipes.filter((r) => r.category === c);
    expect(of('META')).toHaveLength(22);
    expect(of('TYPE')).toHaveLength(18);
    expect(of('COMMUNITY')).toHaveLength(15);
    for (const t of ENERGY_TYPES) expect(of('TYPE').filter((r) => r.energyTypes.includes(t)).length, t).toBeGreaterThanOrEqual(2);
    expect(new Set(recipes.map((r) => r.recipeId)).size).toBe(recipes.length);
    expect(new Set(recipes.map((r) => r.name)).size).toBe(recipes.length);
  });

  it('o meta cobre todas as eras, do Genetic Apex ao Deluxe Pack ex', () => {
    const eras = new Set(recipes.filter((r) => r.category === 'META').map((r) => r.era));
    for (const era of ['A1', 'A1a', 'A2', 'A2a', 'A3', 'A3a', 'A3b', 'A4', 'A4a', 'A4b']) expect(eras.has(era), era).toBe(true);
  });

  it('toda receita é um deck jogável de 20 cartas, com as evoluções completas e a capa (um Pokémon) na lista', () => {
    for (const r of recipes) {
      const v = validateDeck(r.entries, catalog, { energyTypes: r.energyTypes });
      expect(v.errors.map((e) => e.message), r.recipeId).toEqual([]);
      expect(v.warnings.filter((w) => w.code === 'EVOLUTION_WITHOUT_PREVIOUS_STAGE'), r.recipeId).toEqual([]);
      expect(r.entries.reduce((s, e) => s + e.count, 0), r.recipeId).toBe(20);
      expect(r.entries.some((e) => e.printingId === r.coverPrintingId), r.recipeId).toBe(true);
      expect(isPokemon(defOf(r.coverPrintingId)), r.recipeId).toBe(true);
      expect(r.name.length, r.recipeId).toBeLessThanOrEqual(40);
    }
  });
});
