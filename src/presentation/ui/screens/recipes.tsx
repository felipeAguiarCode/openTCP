// Receitas de deck (interface §13.8; campanha §3.7). S51: prateleira de listas prontas — do meta, por tipo e da
// comunidade do Pocket — com filtro por categoria, tipo de Energia e carta, e quanto a coleção já cobre de cada uma.
// S52: a receita aberta, com as 20 cartas (as que faltam esmaecidas, cada uma levando à ficha da carta), a estratégia e
// “Montar deck”, que abre o editor com o rascunho (cartas da coleção primeiro; as que faltam ficam marcadas).
import type { JSX } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { DECK_LIST_FORMAT, DECK_SIZE, inventoryMap } from '../../../application/decks.ts';
import {
  CATEGORY_LABEL, DIFFICULTY_LABEL, draftFromRecipe, filterRecipes, recipeStatus, type RecipeFilter, type RecipeStatus,
} from '../../../application/recipes.ts';
import type { ContentIndex } from '../../../application/content.ts';
import type { DeckRecipe, DeckRecipeCategory } from '../../../content/types.ts';
import { ENERGY_TYPES, isPokemon, type EnergyType } from '../../../domain/cards/types.ts';
import { TYPE_LABEL } from '../../../domain/cards/text.ts';
import { go, loadViewState, saveViewState } from '../app/router.ts';
import { content, requireCtx, snapshot, toast } from '../app/store.ts';
import { CardFace, faceOf } from '../components/cards.tsx';
import { Button, EmptyState, PageHeader, SearchInput, Skeleton, Tabs, Toggle } from '../components/controls.tsx';
import { DeckBox3D } from '../components/deck-box.tsx';
import { DeckCard, featuredOf } from '../components/deck-card.tsx';
import { downloadJson } from '../components/download.ts';
import { Icon, TypeIcon } from '../components/icons.tsx';

type CategoryTab = DeckRecipeCategory | 'ALL';
const TABS: readonly CategoryTab[] = ['ALL', 'META', 'TYPE', 'COMMUNITY'];

/** Nome do set da era (“A2” → “Space-Time Smackdown”). */
function eraName(c: ContentIndex, era: string): string {
  return c.bundle.sets.find((s) => s.setId === era.toLowerCase())?.name ?? era;
}

const idsOf = (r: DeckRecipe) => r.entries.flatMap((e) => Array.from({ length: e.count }, () => e.printingId));

export function RecipesScreen(): JSX.Element {
  const c = content.value;
  const snap = snapshot.value;
  const [filter, setFilterState] = useState<RecipeFilter>(() => loadViewState('S51', { category: 'ALL' as CategoryTab, energy: null as string | null, search: '', onlyComplete: false }));
  const setFilter = (next: Partial<RecipeFilter>) => { const f = { ...filter, ...next }; setFilterState(f); saveViewState('S51', f); };
  const statuses = useMemo(() => {
    if (!c || !snap) return [];
    const inv = inventoryMap(snap);
    return c.bundle.deckRecipes.map((r) => recipeStatus(c, snap, r, inv));
  }, [c, snap?.profile.revision]);
  if (!c || !snap) return <Skeleton />;
  const nameOf = (printingId: string) => faceOf(c, printingId)?.name ?? '';
  const visible = filterRecipes(statuses, filter, nameOf);
  const count = (cat: CategoryTab) => (cat === 'ALL' ? statuses.length : statuses.filter((s) => s.recipe.category === cat).length);
  const ready = statuses.filter((s) => s.complete).length;
  return (
    <div class="deck-library recipe-library">
      <PageHeader title="Receitas de deck" subtitle={`Listas prontas do meta, por tipo e da comunidade do Pocket. Você já pode montar ${ready} de ${statuses.length} com a sua coleção.`}
        actions={<Button icon="decks" onClick={() => go('S11')} testId="recipes-my-decks">Meus decks</Button>} />
      <Tabs label="Categorias de receita" value={filter.category} onChange={(category) => setFilter({ category })}
        tabs={TABS.map((t) => ({ id: t, label: t === 'ALL' ? 'Todas' : CATEGORY_LABEL[t], badge: count(t) }))} />
      <div class="recipe-filters">
        <div class="deck-pool-types" role="group" aria-label="Filtrar por tipo de Energia">
          {ENERGY_TYPES.map((t) => {
            const on = filter.energy === t;
            return (
              <button key={t} type="button" class={`deck-energy ${on ? 'is-on' : ''}`} aria-pressed={on} title={TYPE_LABEL[t]} onClick={() => setFilter({ energy: on ? null : t })}>
                <TypeIcon type={t} size={26} label={false} />
              </button>
            );
          })}
        </div>
        <SearchInput value={filter.search} onInput={(search) => setFilter({ search })} placeholder="Buscar receita ou carta" label="Buscar receita ou carta" />
        <Toggle label="Só as que posso montar" checked={filter.onlyComplete} onChange={(onlyComplete) => setFilter({ onlyComplete })} />
      </div>
      {visible.length ? (
        <div class="deck-shelf mt" data-testid="recipe-shelf">
          {visible.map((s) => <RecipeCard key={s.recipe.recipeId} c={c} status={s} />)}
        </div>
      ) : (
        <EmptyState title="Nenhuma receita com esses filtros" text="Troque a categoria, o tipo ou a busca."
          action={<Button onClick={() => setFilter({ category: 'ALL', energy: null, search: '', onlyComplete: false })}>Limpar filtros</Button>} />
      )}
    </div>
  );
}

function RecipeCard({ c, status }: { readonly c: ContentIndex; readonly status: RecipeStatus }): JSX.Element {
  const { recipe } = status;
  const ids = idsOf(recipe);
  const cover = faceOf(c, recipe.coverPrintingId);
  const line = `${CATEGORY_LABEL[recipe.category]} · ${recipe.era} · ${DIFFICULTY_LABEL[recipe.difficulty]}`;
  return (
    <DeckCard badge={CATEGORY_LABEL[recipe.category]} name={recipe.name} energyTypes={recipe.energyTypes} cover={cover} featured={featuredOf(c, ids, cover)}
      line={line} progress={{ owned: status.ownedCopies, total: DECK_SIZE }} testId={`recipe-${recipe.recipeId}`}
      label={`${line}, ${status.complete ? 'pronta para montar' : `${status.ownedCopies} de ${DECK_SIZE} cartas na coleção`}`}
      onSelect={() => go('S52', { recipeId: recipe.recipeId })} />
  );
}

export function RecipeScreen({ params }: { params: Readonly<Record<string, string>> }): JSX.Element {
  const c = content.value;
  const snap = snapshot.value;
  const recipe = c?.bundle.deckRecipes.find((r) => r.recipeId === params.recipeId) ?? null;
  if (!c || !snap) return <Skeleton />;
  if (!recipe) return <EmptyState title="Receita não encontrada" action={<Button onClick={() => go('S51')}>Ver receitas</Button>} />;
  const status = recipeStatus(c, snap, recipe);
  const cover = faceOf(c, recipe.coverPrintingId);
  const defs = recipe.entries.map((e) => ({ e, def: (() => { try { return c.catalog.definition(c.catalog.definitionKeyOfPrinting(e.printingId)); } catch { return null; } })() }));
  const pokemon = defs.filter((d) => d.def && isPokemon(d.def)).reduce((s, d) => s + d.e.count, 0);
  const exCopies = defs.filter((d) => d.def && isPokemon(d.def) && d.def.ruleBox !== 'NONE').reduce((s, d) => s + d.e.count, 0);
  const missing = status.cards.filter((x) => x.missing > 0);
  const build = () => {
    const deckId = requireCtx().platform.newId('deck');
    saveViewState(`S12:new:${deckId}`, draftFromRecipe(c, snap, recipe, deckId));
    if (status.missingCopies) toast(`Faltam ${status.missingCopies} carta(s) na coleção: o deck fica como rascunho até você conseguir as que faltam.`, 'warning');
    go('S12', { deckId }, { new: '1' });
  };
  const exportList = () => downloadJson(`${recipe.name}.deck.json`, {
    format: DECK_LIST_FORMAT, version: 1, name: recipe.name, energyTypes: [...recipe.energyTypes], entries: recipe.entries.map((e) => ({ printingId: e.printingId, count: e.count })),
  });
  const pct = Math.round((status.ownedCopies / DECK_SIZE) * 100);
  return (
    <div class="recipe-page">
      <PageHeader title={recipe.name} subtitle={`${CATEGORY_LABEL[recipe.category]} · ${eraName(c, recipe.era)} (${recipe.era}) · ${DIFFICULTY_LABEL[recipe.difficulty]}`} backTo="/decks/recipes"
        actions={<>
          <Button icon="download" onClick={exportList}>Exportar lista</Button>
          <Button variant="primary" icon="plus" onClick={build} testId="recipe-build">{status.complete ? 'Montar deck' : 'Montar rascunho'}</Button>
        </>} />
      <section class={`recipe-hero type-${(recipe.energyTypes[0] ?? 'COLORLESS').toLowerCase()}`}>
        <DeckBox3D face={cover} energyType={recipe.energyTypes[0] ?? null} size="lg" label={`Caixa do deck com ${cover?.name ?? 'a capa'}`} />
        <div class="recipe-hero-info">
          <div class="recipe-tags">
            <span class="recipe-tag is-category">{CATEGORY_LABEL[recipe.category]}</span>
            <span class="recipe-tag">{recipe.era}</span>
            <span class="recipe-tag">{DIFFICULTY_LABEL[recipe.difficulty]}</span>
            <span class="recipe-energy" aria-label={`Energia: ${recipe.energyTypes.map((t) => TYPE_LABEL[t as EnergyType]).join(', ')}`}>
              {recipe.energyTypes.map((t) => <TypeIcon key={t} type={t} size={26} label={false} />)}
            </span>
          </div>
          <p class="recipe-summary">{recipe.summary}</p>
          <p class="recipe-stats">{pokemon} Pokémon · {DECK_SIZE - pokemon} Treinadores · {exCopies} ex</p>
          <div class={`recipe-progress ${status.complete ? 'is-complete' : ''}`} data-testid="recipe-progress">
            <span class="deck-card-bar"><span style={{ width: `${pct}%` }} /></span>
            <strong>{status.complete ? 'Você tem todas as 20 cartas: monte e jogue.' : `${status.ownedCopies} de ${DECK_SIZE} cartas na coleção · faltam ${status.missingCopies}`}</strong>
          </div>
        </div>
      </section>
      <div class="recipe-body">
        <section class="recipe-list" aria-label="Lista da receita">
          <h2>Lista <small class="muted">({DECK_SIZE} cartas)</small></h2>
          <ul class="recipe-grid">
            {status.cards.flatMap((card) => Array.from({ length: card.count }, (_, i) => {
              const owned = i < card.use.length;
              const shown = owned ? card.use[i]! : card.printingId;
              const face = faceOf(c, shown);
              return (
                <li key={`${card.printingId}-${i}`}>
                  <button type="button" class={`recipe-card ${owned ? '' : 'is-missing'}`} onClick={() => go('S08', { printingId: shown })}
                    aria-label={`${face?.name ?? shown}${owned ? '' : ', falta na coleção'}`}>
                    <CardFace face={face} size="sm" dim={!owned} />
                    {owned ? null : <span class="recipe-missing-badge">Falta</span>}
                  </button>
                </li>
              );
            }))}
          </ul>
        </section>
        <aside class="recipe-side">
          {missing.length ? (
            <section class="panel recipe-missing" data-testid="recipe-missing">
              <h2>Faltam {status.missingCopies} carta(s)</h2>
              <p class="muted small">Abra a carta para ver onde conseguir: pacotes, Empório ou prêmios da campanha. Montar a receita nunca concede cartas.</p>
              <ul>
                {missing.map((x) => (
                  <li key={x.printingId}>
                    <button type="button" class="recipe-missing-row" onClick={() => go('S08', { printingId: x.printingId })}>
                      <CardFace face={faceOf(c, x.printingId)} size="xs" />
                      <span class="grow"><strong>{faceOf(c, x.printingId)?.name}</strong><br /><small class="muted">{x.missing}× de {x.count}</small></span>
                      <Icon name="search" size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <section class="panel recipe-missing is-done"><h2>Tudo pronto</h2><p class="muted small">Toque em Montar deck: o editor abre com a lista e você confirma a versão.</p></section>
          )}
        </aside>
      </div>
    </div>
  );
}
