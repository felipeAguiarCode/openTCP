// Receitas de deck (campanha §3.7; interface §13.8): quanto da receita a coleção já cobre e o rascunho para montá-la.
// Qualquer impressão da mesma carta serve (arte alternativa conta); montar nunca concede cartas — as que faltam ficam no
// rascunho com a impressão da receita, e o deck só é confirmado quando a coleção cobrir as 20.
import type { DeckRecipe, DeckRecipeCategory } from '../content/types.ts';
import { definitionKey } from '../domain/cards/types.ts';
import type { ContentIndex } from './content.ts';
import { DECK_SIZE, inventoryMap, type DeckDraft } from './decks.ts';
import type { ProfileSnapshot } from './ports/storage.ts';

export type RecipeCard = {
  /** Impressão da receita (a canônica da carta). */
  readonly printingId: string;
  readonly count: number;
  /** Impressões da coleção usadas, uma por cópia coberta (a da receita primeiro, depois as de mais cópias). */
  readonly use: readonly string[];
  readonly missing: number;
};

export type RecipeStatus = {
  readonly recipe: DeckRecipe;
  readonly cards: readonly RecipeCard[];
  readonly ownedCopies: number;
  readonly missingCopies: number;
  readonly complete: boolean;
};

const byDefinition = new WeakMap<ContentIndex, ReadonlyMap<string, readonly string[]>>();

/** Impressões de cada definição (chave id@versão), na ordem do catálogo. */
function printingsByDefinition(content: ContentIndex): ReadonlyMap<string, readonly string[]> {
  const known = byDefinition.get(content);
  if (known) return known;
  const map = new Map<string, string[]>();
  for (const p of content.catalog.printings.values()) {
    const key = definitionKey(p.cardDefinitionId, p.cardDefinitionVersion);
    map.set(key, [...(map.get(key) ?? []), p.printingId]);
  }
  byDefinition.set(content, map);
  return map;
}

function definitionKeyOf(content: ContentIndex, printingId: string): string | null {
  const p = content.catalog.printings.get(printingId);
  return p ? definitionKey(p.cardDefinitionId, p.cardDefinitionVersion) : null;
}

/** Cobertura da receita pela coleção: cópias por carta, aceitando qualquer impressão da mesma definição. */
export function recipeStatus(content: ContentIndex, snap: ProfileSnapshot, recipe: DeckRecipe, inventory: ReadonlyMap<string, number> = inventoryMap(snap)): RecipeStatus {
  const prints = printingsByDefinition(content);
  const cards = recipe.entries.map((e): RecipeCard => {
    const key = definitionKeyOf(content, e.printingId);
    const others = (key ? prints.get(key) ?? [] : []).filter((id) => id !== e.printingId)
      .sort((a, b) => (inventory.get(b) ?? 0) - (inventory.get(a) ?? 0) || a.localeCompare(b));
    const use: string[] = [];
    for (const id of [e.printingId, ...others]) for (let i = 0; i < (inventory.get(id) ?? 0) && use.length < e.count; i++) use.push(id);
    return { printingId: e.printingId, count: e.count, use, missing: e.count - use.length };
  });
  const ownedCopies = cards.reduce((s, c) => s + c.use.length, 0);
  return { recipe, cards, ownedCopies, missingCopies: DECK_SIZE - ownedCopies, complete: ownedCopies === DECK_SIZE };
}

/** Rascunho do deck a partir da receita: cópias da coleção primeiro; as que faltam, com a impressão da receita. */
export function draftFromRecipe(content: ContentIndex, snap: ProfileSnapshot, recipe: DeckRecipe, deckId: string): DeckDraft {
  const status = recipeStatus(content, snap, recipe);
  const cards = status.cards.flatMap((c) => [...c.use, ...Array.from({ length: c.missing }, () => c.printingId)]).map((printingId) => ({ printingId, entryFlairId: null }));
  return { deckId, name: recipe.name.slice(0, 40), energyTypes: [...recipe.energyTypes], energyPinned: true, cards };
}

export type RecipeFilter = {
  readonly category: DeckRecipeCategory | 'ALL';
  readonly energy: string | null;
  readonly search: string;
  readonly onlyComplete: boolean;
};

export const CATEGORY_LABEL: Readonly<Record<DeckRecipeCategory, string>> = { META: 'Meta', TYPE: 'Por tipo', COMMUNITY: 'Comunidade' };
export const DIFFICULTY_LABEL: Readonly<Record<DeckRecipe['difficulty'], string>> = { EASY: 'Iniciante', MEDIUM: 'Intermediária', HARD: 'Avançada' };

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Receitas visíveis: categoria, tipo de Energia, busca por nome da receita ou de carta e “só as que posso montar”. */
export function filterRecipes(statuses: readonly RecipeStatus[], f: RecipeFilter, cardName: (printingId: string) => string): RecipeStatus[] {
  const q = normalize(f.search.trim());
  return statuses.filter(({ recipe, complete }) => {
    if (f.category !== 'ALL' && recipe.category !== f.category) return false;
    if (f.energy && !(recipe.energyTypes as readonly string[]).includes(f.energy)) return false;
    if (f.onlyComplete && !complete) return false;
    if (!q) return true;
    return normalize(recipe.name).includes(q) || recipe.entries.some((e) => normalize(cardName(e.printingId)).includes(q));
  });
}
