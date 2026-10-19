// Coleção (interface §10–§12): S07 grade com filtros, S08 detalhe da carta, S09 fichários,
// S10 editor de página 3×3 e S32 galeria pessoal. Grade HTML; a carta selecionada usa o inspector.
import type { JSX } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import {
  EMPTY_FILTER, archiveBinder, collectionGroups, deckUsage, filterGroups, howToObtain, markSeen, saveBinder, setMark,
  type BinderDraft, type CollectionFilter, type CollectionGroup,
} from '../../../application/collection.ts';
import { cardFace, catalogNames } from '../../../domain/cards/text.ts';
import { definitionKey, isPokemon, POKEMON_TYPES } from '../../../domain/cards/types.ts';
import { OPCODE_LABEL } from '../../../domain/cards/opcode-labels.ts';
import { go, loadViewState, saveViewState } from '../app/router.ts';
import { confirmDialog, content, ctx, requireCtx, snapshot, toast } from '../app/store.ts';
import { CardFace, CardTile, faceOf, symbolText } from '../components/cards.tsx';
import { RARITY_SYMBOL_LABEL, RARITY_SYMBOL_ORDER, raritySymbol } from '../../../domain/cards/rarity.ts';
import { Button, Chip, EmptyState, FilterBar, KeyValue, PageHeader, Panel, SearchInput, Segmented, Skeleton, Tabs } from '../components/controls.tsx';
import { Icon, TypeIcon } from '../components/icons.tsx';
import { CardInspectorScene } from '../components/scenes.tsx';
import type { ContentIndex } from '../../../application/content.ts';

/** Face do grupo: a impressão possuída (do set filtrado, se houver um) ou a primeira daquele set. */
function groupFace(c: ContentIndex, g: CollectionGroup, setId = '') {
  const printings = setId ? g.printings.filter((p) => p.setId === setId) : g.printings;
  const pool = printings.length ? printings : g.printings;
  const shown = pool.find((p) => (g.ownedByPrinting.get(p.printingId) ?? 0) > 0) ?? pool[0]!;
  return faceOf(c, shown.printingId) ?? cardFace(g.definition, shown, catalogNames(c.catalog));
}

/** Cartas desenhadas por vez na grade (“Mostrar mais” acrescenta outro bloco). */
const GRID_PAGE = 120;

const OWNERSHIP: { id: CollectionFilter['ownership']; label: string }[] = [
  { id: 'ALL', label: 'Todas' }, { id: 'OWNED', label: 'Obtidas' }, { id: 'MISSING', label: 'Não obtidas' },
  { id: 'NEW', label: 'Novas' }, { id: 'FAVORITE', label: 'Favoritas' }, { id: 'WISHLIST', label: 'Desejos' },
];

export function CollectionScreen({ query }: { query: Readonly<Record<string, string>> }): JSX.Element {
  const c = content.value;
  const snap = snapshot.value;
  const [filter, setFilter] = useState<CollectionFilter>(() => loadViewState('S07', { ...EMPTY_FILTER, ...(query.filter === 'new' ? { ownership: 'NEW' as const } : {}) }));
  const [selected, setSelected] = useState<string>(() => loadViewState('S07:selected', { key: '' }).key);
  const [showFilters, setShowFilters] = useState(false);
  const [limit, setLimit] = useState(GRID_PAGE);
  const update = (next: Partial<CollectionFilter>) => { const f = { ...filter, ...next }; setFilter(f); setLimit(GRID_PAGE); saveViewState('S07', f); };
  const select = (key: string) => { setSelected(key); saveViewState('S07:selected', { key }); };
  const groups = useMemo(() => (c && snap ? collectionGroups(c, snap) : []), [c, snap]);
  const list = useMemo(() => filterGroups(groups, filter), [groups, filter]);
  if (!c || !snap) return <Skeleton lines={8} />;
  const sel = groups.find((g) => g.key === selected) ?? null;
  const applied = (filter.search ? 1 : 0) + filter.types.length + (filter.category ? 1 : 0) + (filter.stage ? 1 : 0) + (filter.setId ? 1 : 0) + (filter.rarity ? 1 : 0) + (filter.ruleBox ? 1 : 0) + (filter.opcode ? 1 : 0);
  const ownedCount = groups.filter((g) => g.owned > 0).length;
  const opcodes = Object.keys(OPCODE_LABEL) as (keyof typeof OPCODE_LABEL)[];
  return (
    <>
      <PageHeader title="Coleção" subtitle={`${ownedCount} de ${groups.length} cartas obtidas`} />
      <div class="collection-top">
        <SearchInput value={filter.search} onInput={(search) => update({ search })} placeholder="Buscar carta…" />
        <Segmented label="Posse" value={filter.ownership} onChange={(ownership) => update({ ownership })} options={OWNERSHIP} />
        <label class="field inline">Ordenar
          <select class="input" value={filter.sort} onChange={(e) => update({ sort: (e.target as HTMLSelectElement).value as CollectionFilter['sort'] })}>
            <option value="NUMBER">Número</option><option value="NAME">Nome</option><option value="SET">Expansão</option><option value="RARITY">Raridade</option><option value="QUANTITY">Quantidade</option>
          </select>
        </label>
        <Button onClick={() => setShowFilters(!showFilters)} icon="search">Filtros{applied ? ` (${applied})` : ''}</Button>
      </div>
      {showFilters ? (
        <FilterBar applied={applied} onClear={() => update({ ...EMPTY_FILTER, ownership: filter.ownership, sort: filter.sort })}>
          {POKEMON_TYPES.map((t) => <Chip key={t} active={filter.types.includes(t)} onClick={() => update({ types: filter.types.includes(t) ? filter.types.filter((x) => x !== t) : [...filter.types, t] })}><TypeIcon type={t} size={18} /></Chip>)}
          <select class="input compact" aria-label="Categoria" value={filter.category} onChange={(e) => update({ category: (e.target as HTMLSelectElement).value as CollectionFilter['category'] })}><option value="">Categoria</option><option value="POKEMON">Pokémon</option><option value="TRAINER">Treinador</option></select>
          <select class="input compact" aria-label="Estágio" value={filter.stage} onChange={(e) => update({ stage: (e.target as HTMLSelectElement).value as CollectionFilter['stage'] })}><option value="">Estágio</option><option value="BASIC">Básico</option><option value="STAGE_1">Estágio 1</option><option value="STAGE_2">Estágio 2</option></select>
          <select class="input compact" aria-label="Expansão" value={filter.setId} onChange={(e) => update({ setId: (e.target as HTMLSelectElement).value })}><option value="">Expansão</option>{c.bundle.sets.map((s) => <option key={s.setId} value={s.setId}>{s.name}</option>)}</select>
          <select class="input compact" aria-label="Raridade" value={filter.rarity} onChange={(e) => update({ rarity: (e.target as HTMLSelectElement).value })}><option value="">Raridade</option>{RARITY_SYMBOL_ORDER.map((r) => <option key={r} value={r} aria-label={RARITY_SYMBOL_LABEL[r]}>{symbolText(r)}</option>)}</select>
          <select class="input compact" aria-label="Regra especial" value={filter.ruleBox} onChange={(e) => update({ ruleBox: (e.target as HTMLSelectElement).value as CollectionFilter['ruleBox'] })}><option value="">Regra ex</option><option value="EX">ex</option><option value="MEGA_EX">Mega ex</option><option value="NONE">Sem ex</option></select>
          <select class="input compact" aria-label="Efeito" value={filter.opcode} onChange={(e) => update({ opcode: (e.target as HTMLSelectElement).value })}><option value="">Efeito</option>{opcodes.map((o) => <option key={o} value={o}>{OPCODE_LABEL[o]}</option>)}</select>
        </FilterBar>
      ) : null}
      <div class="split collection-split">
        {list.length ? (
          <div class="grid-cards collection-grid" role="list" aria-label="Cartas">
            {list.slice(0, limit).map((g) => (
              <div role="listitem" key={g.key} class="collection-cell">
                <CardTile face={groupFace(c, g, filter.setId)} quantity={g.owned} owned={g.owned > 0} selected={selected === g.key} badge={g.isNew ? 'Nova' : g.printings.length > 1 ? `${g.printings.length} versões` : undefined}
                  onClick={() => select(g.key)} />
              </div>
            ))}
            {list.length > limit ? (
              <div role="listitem" class="collection-more">
                <Button variant="ghost" icon="plus" label={`Mostrar mais (${list.length - limit})`} onClick={() => setLimit(limit + GRID_PAGE)} />
              </div>
            ) : null}
          </div>
        ) : groups.length ? <EmptyState title="Nenhuma carta com esses filtros" action={<Button onClick={() => update({ ...EMPTY_FILTER })}>Limpar filtros</Button>} /> : <EmptyState title="Coleção vazia" />}
        <Panel title={sel ? sel.definition.name : 'Carta selecionada'} class="collection-detail">
          {sel ? <CollectionDetail group={sel} setId={filter.setId} /> : <p class="muted">Selecione uma carta para inspecionar sem sair da grade.</p>}
        </Panel>
      </div>
    </>
  );
}

function CollectionDetail({ group, setId }: { readonly group: CollectionGroup; readonly setId: string }): JSX.Element {
  const c = content.value!;
  const face = groupFace(c, group, setId);
  useEffect(() => {
    const owned = group.printings.filter((p) => (group.ownedByPrinting.get(p.printingId) ?? 0) > 0).map((p) => p.printingId);
    const game = ctx.value;
    if (owned.length && group.isNew && game) void markSeen(game, owned);
  }, [group.key]);
  return (
    <div class="stack">
      <CardFace face={face} size="lg" />
      <KeyValue items={[['Possuídas', group.owned], ['Impressões', group.printings.map((p) => `${p.setId.toUpperCase()} ${p.collectorNumber} (${symbolText(raritySymbol(p))})`).join(', ')]]} />
      <div class="row">
        <Button variant="primary" onClick={() => go('S08', { printingId: face.printingId })} testId="card-details">Detalhes</Button>
        {group.owned > 0
          ? <Button onClick={() => go('S11', {}, { add: face.printingId })}>Adicionar ao deck</Button>
          : <Button onClick={() => go('S08', { printingId: face.printingId }, { tab: 'obtain' })}>Como obter</Button>}
      </div>
    </div>
  );
}

type DetailTab = 'card' | 'variants' | 'obtain' | 'decks';

/** Opções de comparação: uma impressão por carta de jogo; primeiro as outras versões do mesmo nome, depois as demais por nome. */
function compareGroups(c: ContentIndex, key: string, deckLimitKey: string): { label: 'SAME' | 'OTHER'; items: { printingId: string; name: string; setId: string; collectorNumber: string }[] }[] {
  const first = new Map<string, { printingId: string; name: string; setId: string; collectorNumber: string; limitKey: string }>();
  for (const p of c.catalog.printings.values()) {
    const k = definitionKey(p.cardDefinitionId, p.cardDefinitionVersion);
    if (k === key || first.has(k)) continue;
    const d = c.catalog.definition(k);
    first.set(k, { printingId: p.printingId, name: d.name, setId: p.setId, collectorNumber: p.collectorNumber, limitKey: d.deckLimitKey });
  }
  const all = [...first.values()];
  const same = all.filter((x) => x.limitKey === deckLimitKey);
  const other = all.filter((x) => x.limitKey !== deckLimitKey).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  return [...(same.length ? [{ label: 'SAME' as const, items: same }] : []), { label: 'OTHER' as const, items: other }];
}

export function CardDetailScreen({ params, query }: { params: Readonly<Record<string, string>>; query: Readonly<Record<string, string>> }): JSX.Element {
  const c = content.value;
  const snap = snapshot.value;
  const [tab, setTab] = useState<DetailTab>((query.tab as DetailTab) ?? 'card');
  const [compare, setCompare] = useState<string>('');
  if (!c || !snap) return <Skeleton />;
  let printing;
  try { printing = c.catalog.printing(params.printingId ?? ''); } catch { return <EmptyState title="Carta desconhecida" action={<Button onClick={() => go('S07')}>Coleção</Button>} />; }
  const key = definitionKey(printing.cardDefinitionId, printing.cardDefinitionVersion);
  const def = c.catalog.definition(key);
  const face = faceOf(c, printing.printingId)!;
  const inv = new Map(snap.inventory.map((i) => [i.printingId, i.quantity]));
  const owned = inv.get(printing.printingId) ?? 0;
  const variants = [...c.catalog.printings.values()].filter((p) => definitionKey(p.cardDefinitionId, p.cardDefinitionVersion) === key);
  const favorite = snap.marks.some((m) => m.markKind === 'FAVORITE' && m.subjectId === printing.printingId);
  const wish = snap.marks.some((m) => m.markKind === 'WISHLIST' && m.subjectId === printing.printingId);
  const sources = howToObtain(c, snap, printing.printingId);
  const usage = deckUsage(c, snap, key);
  const chain = isPokemon(def) ? evolutionChain(c, def.deckLimitKey) : [];
  const compareFace = compare ? faceOf(c, compare) : null;
  const toggle = async (kind: 'FAVORITE' | 'WISHLIST', on: boolean) => { await setMark(requireCtx(), kind, printing.printingId, on); };
  return (
    <>
      <PageHeader title={face.name} subtitle={`${face.subtitle} · ${symbolText(face.raritySymbol)} · ${face.setId.toUpperCase()} ${face.collectorNumber}`} backTo="/collection" />
      <div class="card-detail">
        <div class="card-detail-visual">
          <CardInspectorScene printingId={printing.printingId} />
          <div class="row">
            <Button icon="star" onClick={() => toggle('FAVORITE', !favorite)} label={favorite ? 'Remover dos favoritos' : 'Favoritar'}>{favorite ? 'Favorita' : 'Favoritar'}</Button>
            <Button icon="heart" onClick={() => toggle('WISHLIST', !wish)}>{wish ? 'Na lista de desejos' : 'Lista de desejos'}</Button>
          </div>
        </div>
        <div class="card-detail-info">
          <Tabs label="Seções da carta" value={tab} onChange={setTab} tabs={[{ id: 'card', label: 'Carta' }, { id: 'variants', label: 'Variantes', badge: variants.length > 1 ? variants.length : 0 }, { id: 'obtain', label: 'Como obter' }, { id: 'decks', label: 'Uso nos decks', badge: usage.length }]} />
          <Panel class="mt">
            {tab === 'card' ? (
              <div class="stack">
                <KeyValue items={[
                  ['Categoria', face.category === 'POKEMON' ? 'Pokémon' : 'Treinador'],
                  ...(face.hp !== null ? [['PS', face.hp] as [string, number]] : []),
                  ...(face.types.length ? [['Tipo', <span class="row">{face.types.map((t) => <TypeIcon key={t} type={t} size={20} />)}</span>] as [string, JSX.Element]] : []),
                  ...(face.evolvesFromName ? [['Evolui de', face.evolvesFromName] as [string, string]] : []),
                  ...(face.category === 'POKEMON' ? [['Fraqueza', face.weakness ?? '—'] as [string, string], ['Recuo', String(face.retreat ?? 0)] as [string, string], ['Pontos ao ser nocauteado', face.ruleBox === 'MEGA_EX' ? '3' : face.ruleBox === 'EX' ? '2' : '1'] as [string, string]] : []),
                  ['Você possui', owned],
                ]} />
                {face.abilities.map((a) => <div key={a.name} class="rule-block"><strong>Habilidade · {a.name}</strong><p>{a.text}</p></div>)}
                {face.attacks.map((a) => (
                  <div key={a.name} class="rule-block">
                    <div class="row"><span class="row">{a.cost.map((t, i) => <TypeIcon key={i} type={t} size={18} />)}</span><strong class="grow">{a.name}</strong><strong>{a.damage}</strong></div>
                    {a.text ? <p>{a.text}</p> : null}
                  </div>
                ))}
                {face.category === 'TRAINER' ? <p class="rule-block">{face.trainerText}</p> : null}
                {face.ruleBoxText ? <p class="muted small">{face.ruleBoxText}</p> : null}
                {chain.length > 1 ? <div><h3>Cadeia evolutiva</h3><div class="row">{chain.map((name, i) => <span key={name} class="row">{i ? <Icon name="back" size={14} class="flip" /> : null}<span class="badge">{name}</span></span>)}</div></div> : null}
                <div class="field">Comparar com
                  <select class="input" value={compare} onChange={(e) => setCompare((e.target as HTMLSelectElement).value)}>
                    <option value="">—</option>
                    {compareGroups(c, key, def.deckLimitKey).map((g) => (
                      <optgroup key={g.label} label={g.label === 'SAME' ? `Outras versões de ${def.name}` : 'Outras cartas'}>
                        {g.items.map((p) => <option key={p.printingId} value={p.printingId}>{p.name} ({p.setId.toUpperCase()} {p.collectorNumber})</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
                {compareFace ? <CompareTable a={face} b={compareFace} /> : null}
              </div>
            ) : tab === 'variants' ? (
              <div class="grid-cards">
                {variants.map((p) => <CardTile key={p.printingId} face={faceOf(c, p.printingId)} quantity={inv.get(p.printingId) ?? 0} owned={(inv.get(p.printingId) ?? 0) > 0} selected={p.printingId === printing.printingId} badge={symbolText(raritySymbol(p))} onClick={() => go('S08', { printingId: p.printingId }, {}, { replace: true })} />)}
              </div>
            ) : tab === 'obtain' ? (
              sources.length ? (
                <ul class="list">
                  {sources.map((s, i) => (
                    <li key={i} class="list-row">
                      {s.kind === 'STARTER' ? <span>Coleção inicial (decks iniciais).</span>
                        : s.kind === 'NODE_REWARD' ? <><span class="grow">Prêmio de primeira vitória em <strong>{s.title}</strong></span><Button size="sm" onClick={() => go('S16', { nodeId: s.nodeId })} disabledReason={s.available ? null : 'Encontro ainda bloqueado.'}>Briefing</Button></>
                        : s.kind === 'DISCOVERY' ? <><span class="grow">Opção de Descoberta em <strong>{s.title}</strong></span><Button size="sm" onClick={() => go('S28', { nodeId: s.nodeId })} disabledReason={s.available ? null : 'Descoberta bloqueada ou já escolhida.'}>Abrir</Button></>
                        : s.kind === 'PACK' ? <><span class="grow">Pode sair em <strong>{s.name}</strong>{s.chance > 0 ? <span class="muted"> · {(s.chance * 100).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}% por pacote</span> : null}</span><Button size="sm" onClick={() => go('S05', { packId: s.productId })}>Probabilidades</Button></>
                        : s.kind === 'EMPORIUM' ? <><span class="grow">Empório: {s.credits} Créditos{s.available ? '' : ` (após ${s.afterNodeTitle ?? 'avançar na campanha'})`}</span><Button size="sm" onClick={() => go('S33', {}, { focus: printing.printingId })} disabledReason={s.available ? null : 'Ainda bloqueado pela campanha.'}>Empório</Button></>
                        : <span>Carta autoral publicada no Estúdio.</span>}
                    </li>
                  ))}
                </ul>
              ) : <p class="muted">Sem fonte de aquisição registrada.</p>
            ) : usage.length ? (
              <ul class="list">{usage.map((u) => <li key={u.deckId} class="list-row"><span class="grow">{u.name}</span><span class="badge">×{u.copies}</span><Button size="sm" onClick={() => go('S12', { deckId: u.deckId })}>Editar deck</Button></li>)}</ul>
            ) : <p class="muted">Nenhum deck usa esta carta.</p>}
          </Panel>
          <div class="row mt">
            <Button variant="primary" onClick={() => go('S11', {}, { add: printing.printingId })} disabledReason={owned > 0 ? null : 'Você ainda não possui esta carta.'}>Adicionar ao deck</Button>
          </div>
        </div>
      </div>
    </>
  );
}

function evolutionChain(c: ContentIndex, deckLimitKey: string): string[] {
  const defs = [...c.catalog.definitions.values()];
  const byKey = (k: string) => defs.find((d) => d.deckLimitKey === k);
  let root = byKey(deckLimitKey);
  const seen = new Set<string>();
  while (root && isPokemon(root) && root.evolvesFrom.length && !seen.has(root.deckLimitKey)) {
    seen.add(root.deckLimitKey);
    const prev = byKey(root.evolvesFrom[0]!);
    if (!prev) break;
    root = prev;
  }
  const chain: string[] = [];
  let cur = root;
  while (cur && chain.length < 4) {
    chain.push(cur.name);
    const key = cur.deckLimitKey;
    cur = defs.find((d) => isPokemon(d) && d.evolvesFrom.includes(key));
  }
  return chain;
}

function CompareTable({ a, b }: { readonly a: NonNullable<ReturnType<typeof faceOf>>; readonly b: NonNullable<ReturnType<typeof faceOf>> }): JSX.Element {
  const row = (label: string, x: string, y: string) => <tr class={x !== y ? 'is-diff' : ''}><th scope="row">{label}</th><td>{x}</td><td>{y}</td></tr>;
  const atk = (f: typeof a) => f.attacks.map((t) => `${t.name} (${t.cost.length}) ${t.damage}`).join(' · ') || '—';
  return (
    <table class="odds-table compare-table">
      <caption class="sr-only">Comparação de cartas</caption>
      <thead><tr><th /><th scope="col">{a.name}</th><th scope="col">{b.name}</th></tr></thead>
      <tbody>
        {row('PS', String(a.hp ?? '—'), String(b.hp ?? '—'))}
        {row('Ataques', atk(a), atk(b))}
        {row('Habilidade', a.abilities.map((x) => x.name).join(', ') || '—', b.abilities.map((x) => x.name).join(', ') || '—')}
        {row('Recuo', String(a.retreat ?? '—'), String(b.retreat ?? '—'))}
        {row('Pontos', a.ruleBox === 'MEGA_EX' ? '3' : a.ruleBox === 'EX' ? '2' : '1', b.ruleBox === 'MEGA_EX' ? '3' : b.ruleBox === 'EX' ? '2' : '1')}
      </tbody>
    </table>
  );
}

export function BindersScreen(): JSX.Element {
  const snap = snapshot.value;
  const c = content.value;
  if (!snap || !c) return <Skeleton />;
  const create = () => go('S10', { binderId: requireCtx().platform.newId('binder') }, { new: '1' });
  return (
    <>
      <PageHeader title="Fichários" subtitle="Organize páginas 3×3 com cartas da sua coleção. Excluir um fichário não remove cartas." backTo="/collection" actions={<Button variant="primary" icon="plus" onClick={create}>Novo fichário</Button>} />
      {snap.binders.length ? (
        <div class="grid-tiles">
          {snap.binders.map((b) => {
            const layout = b.layout as { pages?: number; featuredPrintingId?: string | null };
            const cover = layout.featuredPrintingId ?? b.slots[0]?.printingId ?? null;
            return (
              <Panel key={b.binderId} title={b.name}>
                <div class="row">
                  {cover ? <CardFace face={faceOf(c, cover)} size="xs" /> : <div class="binder-cover" aria-hidden="true" />}
                  <div class="stack grow">
                    <span class="muted small">{b.kind === 'SHOWCASE' ? 'Expositor' : 'Fichário'} · {layout.pages ?? 1} página(s) · {b.slots.length} cartas</span>
                    <div class="row">
                      <Button size="sm" onClick={() => go('S10', { binderId: b.binderId })}>Editar</Button>
                      <Button size="sm" variant="ghost" onClick={async () => {
                        const id = requireCtx().platform.newId('binder');
                        const r = await saveBinder(requireCtx(), { binderId: id, name: `${b.name} (cópia)`, kind: b.kind, layout: { pages: layout.pages ?? 1, background: 'calm', featuredPrintingId: layout.featuredPrintingId ?? null }, sortOrder: snap.binders.length, slots: b.slots });
                        if (!r.ok) toast(r.message, 'error');
                      }}>Duplicar</Button>
                      <Button size="sm" variant="ghost" onClick={async () => {
                        if (await confirmDialog({ title: `Excluir “${b.name}”?`, body: 'As cartas continuam na sua coleção.', confirmLabel: 'Excluir fichário', tone: 'danger' })) await archiveBinder(requireCtx(), b.binderId);
                      }}>Excluir</Button>
                    </div>
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      ) : <EmptyState title="Nenhum fichário ainda" text="Crie um fichário para montar páginas com suas cartas favoritas." action={<Button variant="primary" onClick={create}>Criar fichário</Button>} />}
    </>
  );
}

export function BinderEditScreen({ params }: { params: Readonly<Record<string, string>> }): JSX.Element {
  const snap = snapshot.value;
  const c = content.value;
  const existing = snap?.binders.find((b) => b.binderId === params.binderId);
  const [draft, setDraft] = useState<BinderDraft>(() => ({
    binderId: params.binderId ?? '', name: existing?.name ?? 'Meu fichário', kind: existing?.kind ?? 'BINDER',
    layout: { pages: 1, background: 'calm', featuredPrintingId: null, ...(existing?.layout as object | undefined) },
    sortOrder: existing?.sortOrder ?? snap?.binders.length ?? 0, slots: existing?.slots ?? [],
  }));
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!snap || !c) return <Skeleton />;
  const owned = snap.inventory.filter((i) => i.quantity > 0).map((i) => ({ id: i.printingId, face: faceOf(c, i.printingId) })).filter((x) => x.face && (!search || x.face.name.toLowerCase().includes(search.toLowerCase())));
  const slotAt = (slotNo: number) => draft.slots.find((s) => s.pageNo === page && s.slotNo === slotNo);
  const place = (slotNo: number) => {
    const without = draft.slots.filter((s) => !(s.pageNo === page && s.slotNo === slotNo));
    setDraft({ ...draft, slots: picked ? [...without, { pageNo: page, slotNo, printingId: picked }] : without });
    setDirty(true);
  };
  const save = async () => {
    setBusy(true);
    const r = await saveBinder(requireCtx(), draft);
    setBusy(false);
    if (!r.ok) { toast(r.message, 'error'); return; }
    setDirty(false);
    toast('Fichário salvo.', 'success');
  };
  return (
    <>
      <PageHeader title={draft.name} subtitle={dirty ? 'Alterações não salvas' : 'Salvo'} backTo="/collection/binders"
        actions={<Button variant="primary" onClick={save} loading={busy} disabledReason={dirty ? null : 'Nenhuma alteração.'}>Salvar</Button>} />
      <div class="binder-editor">
        <Panel title="Sua coleção">
          <SearchInput value={search} onInput={setSearch} placeholder="Buscar" />
          <div class="binder-source">
            {owned.map((o) => (
              <button key={o.id} type="button" class={`card-link ${picked === o.id ? 'is-picked' : ''}`} onClick={() => setPicked(picked === o.id ? null : o.id)} aria-pressed={picked === o.id} aria-label={`Selecionar ${o.face!.name}`}>
                <CardFace face={o.face} size="xs" />
              </button>
            ))}
          </div>
        </Panel>
        <Panel title={`Página ${page} de ${draft.layout.pages}`}>
          <p class="muted small">{picked ? 'Escolha um espaço para colocar a carta selecionada.' : 'Selecione uma carta à esquerda; um espaço vazio sem seleção limpa a posição.'}</p>
          <div class="binder-page" role="grid" aria-label={`Página ${page}`}>
            {Array.from({ length: 9 }, (_, i) => {
              const s = slotAt(i + 1);
              return (
                <button key={i} type="button" class="binder-slot" onClick={() => place(i + 1)} aria-label={`Espaço ${i + 1}${s ? `: ${faceOf(c, s.printingId)?.name}` : ', vazio'}`}>
                  {s ? <CardFace face={faceOf(c, s.printingId)} size="sm" /> : <span class="muted">+</span>}
                </button>
              );
            })}
          </div>
          <div class="row">
            <Button size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabledReason={page > 1 ? null : 'Primeira página.'}>Anterior</Button>
            <Button size="sm" onClick={() => setPage(Math.min(draft.layout.pages, page + 1))} disabledReason={page < draft.layout.pages ? null : 'Última página.'}>Próxima</Button>
            <Button size="sm" variant="ghost" icon="plus" onClick={() => { setDraft({ ...draft, layout: { ...draft.layout, pages: Math.min(30, draft.layout.pages + 1) } }); setDirty(true); }}>Adicionar página</Button>
          </div>
        </Panel>
        <Panel title="Opções">
          <div class="stack">
            <label class="field">Nome<input class="input" value={draft.name} maxLength={40} onInput={(e) => { setDraft({ ...draft, name: (e.target as HTMLInputElement).value }); setDirty(true); }} /></label>
            <div class="field">Tipo<Segmented label="Tipo" value={draft.kind} onChange={(kind) => { setDraft({ ...draft, kind }); setDirty(true); }} options={[{ id: 'BINDER', label: 'Fichário' }, { id: 'SHOWCASE', label: 'Expositor' }]} /></div>
            <Button size="sm" onClick={() => { if (picked) { setDraft({ ...draft, layout: { ...draft.layout, featuredPrintingId: picked } }); setDirty(true); } }} disabledReason={picked ? null : 'Selecione uma carta.'}>Usar seleção como capa</Button>
          </div>
        </Panel>
      </div>
    </>
  );
}

export function GalleryScreen(): JSX.Element {
  const snap = snapshot.value;
  const c = content.value;
  const [background, setBackground] = useState<'calm' | 'sky' | 'mint'>(() => loadViewState('S32', { background: 'calm' as 'calm' | 'sky' | 'mint' }).background);
  if (!snap || !c) return <Skeleton />;
  const showcase = snap.binders.find((b) => b.kind === 'SHOWCASE');
  const favorites = snap.marks.filter((m) => m.markKind === 'FAVORITE' && m.subjectKind === 'PRINTING').map((m) => m.subjectId);
  const shown = (showcase?.slots.map((s) => s.printingId) ?? favorites).slice(0, 12);
  return (
    <>
      <PageHeader title="Galeria pessoal" subtitle="Sua prateleira local de cartas favoritas e medalhas." backTo="/collection"
        actions={<Segmented label="Fundo" value={background} onChange={(b) => { setBackground(b); saveViewState('S32', { background: b }); }} options={[{ id: 'calm', label: 'Claro' }, { id: 'sky', label: 'Céu' }, { id: 'mint', label: 'Menta' }]} />} />
      {shown.length ? (
        <div class={`gallery-shelf gallery-${background}`}>
          {shown.map((id, i) => <button key={`${id}-${i}`} type="button" class="card-link gallery-card" onClick={() => go('S08', { printingId: id })}><CardFace face={faceOf(c, id)} size="md" /></button>)}
        </div>
      ) : <EmptyState title="A galeria está vazia" text="Favorite cartas ou crie um expositor em Fichários para preencher a prateleira." action={<Button onClick={() => go('S09')}>Fichários</Button>} />}
    </>
  );
}


