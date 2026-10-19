// Cobertura da receita pela coleção e rascunho para montar (interface §13.8): qualquer impressão da mesma carta serve,
// as que faltam ficam com a impressão da receita, e montar nunca concede cartas.
import { describe, expect, it } from 'vitest';
import { buildBundle } from '../content/bundle.ts';
import { jcsHash } from '../domain/hash/jcs.ts';
import { definitionKey } from '../domain/cards/types.ts';
import { indexContent } from './content.ts';
import { draftFromRecipe, filterRecipes, recipeStatus } from './recipes.ts';
import type { ProfileSnapshot } from './ports/storage.ts';

const bundle = buildBundle();
const content = indexContent({ ...bundle, contentHash: jcsHash(bundle) });
const recipe = bundle.deckRecipes.find((r) => r.recipeId === 'meta-pikachu-ex-zapdos-ex')!;
const snapWith = (inventory: Readonly<Record<string, number>>) =>
  ({ inventory: Object.entries(inventory).map(([printingId, quantity]) => ({ printingId, quantity })) }) as unknown as ProfileSnapshot;
const keyOf = (printingId: string) => { const p = content.catalog.printing(printingId); return definitionKey(p.cardDefinitionId, p.cardDefinitionVersion); };

describe('receitas na coleção', () => {
  it('sem cartas, nada é coberto; com todas as cópias, a receita fica pronta e o rascunho é a própria lista', () => {
    expect(recipeStatus(content, snapWith({}), recipe)).toMatchObject({ ownedCopies: 0, missingCopies: 20, complete: false });
    const all = Object.fromEntries(recipe.entries.map((e) => [e.printingId, e.count]));
    const status = recipeStatus(content, snapWith(all), recipe);
    expect(status).toMatchObject({ ownedCopies: 20, missingCopies: 0, complete: true });
    const draft = draftFromRecipe(content, snapWith(all), recipe, 'deck-x');
    expect(draft).toMatchObject({ deckId: 'deck-x', name: recipe.name, energyTypes: recipe.energyTypes, energyPinned: true });
    expect(draft.cards.map((c) => c.printingId).sort()).toEqual(recipe.entries.flatMap((e) => Array(e.count).fill(e.printingId)).sort());
  });

  it('outra impressão da mesma carta conta; as cópias que faltam ficam com a impressão da receita', () => {
    const pikachu = recipe.entries.find((e) => e.printingId.includes('pikachu-ex'))!;
    const alt = [...content.catalog.printings.values()].find((p) => p.printingId !== pikachu.printingId && keyOf(p.printingId) === keyOf(pikachu.printingId))!;
    expect(alt).toBeTruthy();
    const status = recipeStatus(content, snapWith({ [alt.printingId]: 1 }), recipe);
    const card = status.cards.find((c) => c.printingId === pikachu.printingId)!;
    expect(card).toMatchObject({ use: [alt.printingId], missing: 1 });
    expect(status.ownedCopies).toBe(1);
    const draft = draftFromRecipe(content, snapWith({ [alt.printingId]: 1 }), recipe, 'deck-y');
    expect(draft.cards).toHaveLength(20);
    expect(draft.cards.filter((c) => c.printingId === alt.printingId)).toHaveLength(1);
    expect(draft.cards.filter((c) => c.printingId === pikachu.printingId)).toHaveLength(1);
  });

  it('filtra por categoria, tipo de Energia, nome da receita ou de carta e “só as que posso montar”', () => {
    const statuses = bundle.deckRecipes.map((r) => recipeStatus(content, snapWith({}), r));
    const nameOf = (printingId: string) => content.catalog.definition(content.catalog.definitionKeyOfPrinting(printingId)).name;
    const base = { category: 'ALL' as const, energy: null, search: '', onlyComplete: false };
    expect(filterRecipes(statuses, base, nameOf)).toHaveLength(55);
    expect(filterRecipes(statuses, { ...base, category: 'META' }, nameOf)).toHaveLength(22);
    expect(filterRecipes(statuses, { ...base, energy: 'METAL' }, nameOf).every((s) => s.recipe.energyTypes.includes('METAL'))).toBe(true);
    expect(filterRecipes(statuses, { ...base, search: 'zapdos' }, nameOf).map((s) => s.recipe.recipeId)).toContain('meta-pikachu-ex-zapdos-ex');
    expect(filterRecipes(statuses, { ...base, search: 'Pesquisa do Professor' }, nameOf).length).toBeGreaterThan(40);
    expect(filterRecipes(statuses, { ...base, onlyComplete: true }, nameOf)).toEqual([]);
  });
});
