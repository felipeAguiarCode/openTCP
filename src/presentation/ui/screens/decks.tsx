// Decks (interface §13–§15; inspiração .specs/referencias/decks, Pokémon TCG Pocket). S11 “Escolha um baralho”: grade de
// cartões com faixa na cor da Energia, número, caixa 3D com a capa escolhida, duas cartas em destaque e o nome; o deck
// selecionado ganha ações em ícones flutuantes. S12 ficha do deck: nome editável, caixa 3D (trocar capa), Energia,
// acessórios e destaques, as 20 vagas em cartas e a coleção ao lado — ações em ícones, rascunho automático, validação
// e auto-build. S13 preparar teste.
import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  DECK_SIZE, addCard, analyzeDraft, archiveDeck, autoBuild, canAdd, confirmDeck, diffDrafts, draftFromContentDeck, draftFromRow, exportDeckList,
  importDeckList, removeCard, saveDeckDraft, searchMatches, suggestEnergy, validateDraft, type DeckDraft,
} from '../../../application/decks.ts';
import { effectiveConfig } from '../../../application/appearance.ts';
import { nodeView } from '../../../application/campaign.ts';
import { compositionHolds } from '../../../domain/campaign/objectives.ts';
import { deckFacts } from '../../../domain/campaign/facts.ts';
import type { CardFaceData } from '../../../domain/cards/text.ts';
import { ENERGY_TYPES, isPokemon, type EnergyType } from '../../../domain/cards/types.ts';
import { TYPE_LABEL } from '../../../domain/cards/text.ts';
import { back, go, loadViewState, saveViewState } from '../app/router.ts';
import { battleSession, confirmDialog, content, requireCtx, settings, snapshot, toast } from '../app/store.ts';
import { saveSettings } from '../../../application/profiles.ts';
import { CardFace, coverFace, faceOf, rankedFaces } from '../components/cards.tsx';
import { CosmeticSwatch } from '../components/cosmetics.tsx';
import { Button, EmptyState, Modal, PageHeader, SearchInput, Skeleton, Tabs } from '../components/controls.tsx';
import { DeckBox3D } from '../components/deck-box.tsx';
import { DeckCard, featuredOf } from '../components/deck-card.tsx';
import { downloadJson } from '../components/download.ts';
import { Icon, TypeIcon } from '../components/icons.tsx';
import type { ContentIndex } from '../../../application/content.ts';

type Tab = 'mine' | 'drafts' | 'templates';


/** Capa do deck: a escolhida pelo jogador (preferência `deckCovers`) enquanto a carta estiver no deck. */
function deckCover(c: ContentIndex, deckId: string, printingIds: readonly string[]): CardFaceData | null {
  return coverFace(c, printingIds, settings.value.deckCovers?.[deckId] ?? null);
}

/** Linha de contagem e rótulo acessível do cartão de deck (“20/20 · Favorito”). */
function countLine(count: number, status: string): { line: string; lineTone: 'ok' | 'bad'; label: string } {
  const line = `${count}/${DECK_SIZE}${status ? ` · ${status}` : ''}`;
  return { line, lineTone: count === DECK_SIZE ? 'ok' : 'bad', label: `${count} de ${DECK_SIZE} cartas${status ? `, ${status}` : ''}` };
}

export function DecksScreen({ query }: { query: Readonly<Record<string, string>> }): JSX.Element {
  const c = content.value;
  const snap = snapshot.value;
  const [tab, setTab] = useState<Tab>(() => loadViewState('S11', { tab: 'mine' as Tab }).tab);
  const [selected, setSelected] = useState<string>('');
  const fileInput = useRef<HTMLInputElement>(null);
  if (!c || !snap) return <Skeleton />;
  const decks = snap.decks.filter((d) => !d.archived);
  const mine = decks.filter((d) => !!d.confirmed);
  const drafts = decks.filter((d) => d.status === 'DRAFT');
  const templates = c.bundle.decks.filter((d) => d.kind === 'STARTER' || d.kind === 'SUPPORT');
  const activeDeckId = snap.activeAttempt?.deckId ?? null;
  const list = tab === 'mine' ? mine : tab === 'drafts' ? drafts : [];
  const sel = tab === 'templates' ? null : list.find((d) => d.deckId === selected) ?? null;
  const template = tab === 'templates' ? templates.find((t) => t.deckId === selected) ?? null : null;
  const addPrinting = query.add ?? null;
  const create = (from?: DeckDraft) => {
    const deckId = requireCtx().platform.newId('deck');
    saveViewState(`S12:new:${deckId}`, from ?? { deckId, name: 'Novo deck', energyTypes: [], energyPinned: false, cards: [] });
    go('S12', { deckId }, { new: '1', ...(addPrinting ? { add: addPrinting } : {}) });
  };
  const edit = (deckId: string) => go('S12', { deckId }, addPrinting ? { add: addPrinting } : {});
  const onImport = async (file: File) => {
    try {
      const raw = JSON.parse(await file.text()) as unknown;
      const deckId = requireCtx().platform.newId('deck');
      const r = importDeckList(c, snap, raw, deckId);
      if (!r.ok) { toast(r.message, 'error'); return; }
      if (r.unknown.length) toast(`${r.unknown.length} carta(s) desconhecida(s) foram ignoradas.`, 'warning');
      if (r.missing.length) toast(`Faltam ${r.missing.reduce((s, m) => s + m.missing, 0)} cópia(s) no inventário; o deck fica como rascunho.`, 'warning');
      create(r.draft);
    } catch {
      toast('Arquivo inválido.', 'error');
    }
  };
  const statusOf = (d: (typeof decks)[number]) => {
    if (activeDeckId === d.deckId) return 'Em uso neste duelo';
    if (d.status === 'DRAFT') return d.confirmed ? 'Rascunho sobre versão confirmada' : 'Rascunho';
    return settings.value.favoriteDeckId === d.deckId ? 'Favorito' : '';
  };
  const favorite = sel ? settings.value.favoriteDeckId === sel.deckId : false;
  return (
    <div class="deck-library">
      <PageHeader title="Escolha um baralho" subtitle="Excluir um deck nunca remove cartas da coleção."
        actions={<>
          <Button variant="primary" icon="plus" label="Novo deck" onClick={() => create()} testId="deck-new" />
          <Button icon="recipe" onClick={() => go('S51')} testId="deck-recipes">Receitas</Button>
          <Button icon="upload" label="Importar lista" onClick={() => fileInput.current?.click()} />
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) void onImport(f); (e.target as HTMLInputElement).value = ''; }} />
        </>} />
      {addPrinting ? <p class="badge badge-new mb">Escolha um deck para adicionar {faceOf(c, addPrinting)?.name}.</p> : null}
      <Tabs label="Decks" value={tab} onChange={(t) => { setTab(t); setSelected(''); saveViewState('S11', { tab: t }); }} tabs={[{ id: 'mine', label: 'Meus decks', badge: mine.length }, { id: 'drafts', label: 'Rascunhos', badge: drafts.length }, { id: 'templates', label: 'Modelos e apoio' }]} />
      {tab === 'templates' ? (
        <div class="deck-shelf mt">
          {templates.map((t, i) => {
            const ids = t.entries.flatMap((e) => Array.from({ length: e.count }, () => e.printingId));
            const cover = coverFace(c, ids);
            return (
              <DeckCard key={t.deckId} number={i + 1} name={t.name} energyTypes={t.energyTypes} {...countLine(ids.length, t.kind === 'SUPPORT' ? 'Deck de apoio' : 'Deck inicial')}
                cover={cover} featured={featuredOf(c, ids, cover)} selected={template?.deckId === t.deckId} onSelect={() => setSelected(t.deckId)} onOpen={() => setSelected(t.deckId)} />
            );
          })}
        </div>
      ) : list.length ? (
        <div class="deck-shelf mt">
          {list.map((d, i) => {
            const ids = (d.confirmed?.entries ?? d.entries).map((e) => e.printingId);
            const cover = deckCover(c, d.deckId, ids);
            return (
              <DeckCard key={d.deckId} number={i + 1} name={d.name} energyTypes={(d.confirmed ?? d).energyTypes} {...countLine(ids.length, statusOf(d))}
                cover={cover} featured={featuredOf(c, ids, cover)} selected={sel?.deckId === d.deckId} testId={`deck-card-${i}`}
                onSelect={() => setSelected(d.deckId)} onOpen={() => edit(d.deckId)} />
            );
          })}
        </div>
      ) : <EmptyState title={tab === 'mine' ? 'Nenhum deck confirmado' : 'Nenhum rascunho'} text="Comece do zero ou a partir de uma receita pronta."
        action={<><Button icon="plus" onClick={() => create()}>Criar deck</Button><Button icon="recipe" onClick={() => go('S51')}>Ver receitas</Button></>} />}
      {sel ? (
        <div class="deck-fab-bar" role="toolbar" aria-label={`Ações de ${sel.name}`}>
          <Button variant="primary" size="lg" icon="play" label="Jogar" onClick={() => go('S14')} disabledReason={sel.confirmed ? null : 'Confirme o deck primeiro.'} testId="deck-play" />
          <Button size="lg" icon="edit" label="Editar" onClick={() => edit(sel.deckId)} testId="deck-edit" />
          <Button size="lg" icon="copy" label="Duplicar" onClick={() => create({ ...draftFromRow(sel), deckId: requireCtx().platform.newId('deck'), name: `${sel.name} (cópia)` })} />
          <Button size="lg" icon="palette" label="Aparência" onClick={() => go('S42', { deckId: sel.deckId })} />
          <Button size="lg" icon="star" class={favorite ? 'is-on' : ''} label={favorite ? 'Favorito' : 'Favoritar'} onClick={() => void saveSettings(requireCtx(), { favoriteDeckId: sel.deckId })} />
          <Button size="lg" icon="download" label="Exportar lista" onClick={() => downloadJson(`${sel.name}.deck.json`, exportDeckList(draftFromRow(sel)))} />
          <Button size="lg" variant="danger" icon="trash" label="Excluir" onClick={async () => {
            if (activeDeckId === sel.deckId) { toast('Este deck está em uso no duelo suspenso.', 'warning'); return; }
            if (await confirmDialog({ title: `Excluir “${sel.name}”?`, body: 'O deck sai da biblioteca. Nenhuma carta é removida da sua coleção.', confirmLabel: 'Excluir deck', tone: 'danger' })) await archiveDeck(requireCtx(), sel.deckId);
          }} />
        </div>
      ) : template ? (
        <div class="deck-fab-bar" role="toolbar" aria-label={`Ações de ${template.name}`}>
          <Button variant="primary" size="lg" icon="copy" label="Criar a partir deste" onClick={() => create(draftFromContentDeck(requireCtx().platform.newId('deck'), template, `${template.name} (cópia)`))} />
        </div>
      ) : null}
    </div>
  );
}

/** Cartas da coleção desenhadas por vez ao lado do deck (“Mostrar mais” acrescenta outro bloco). */
const POOL_PAGE = 60;

function sortKey(c: ContentIndex, printingId: string): string {
  const f = faceOf(c, printingId);
  if (!f) return `9${printingId}`;
  const group = f.category === 'POKEMON' ? '0' : f.subtitle.startsWith('Item') ? '1' : f.subtitle.startsWith('Apoiador') ? '2' : f.subtitle.startsWith('Ferramenta') ? '3' : '4';
  return `${group}${f.name}`;
}

export function DeckEditorScreen({ params, query }: { params: Readonly<Record<string, string>>; query: Readonly<Record<string, string>> }): JSX.Element {
  const c = content.value;
  const snap = snapshot.value;
  const deckId = params.deckId ?? '';
  const row = snap?.decks.find((d) => d.deckId === deckId) ?? null;
  const [draft, setDraft] = useState<DeckDraft | null>(() => {
    if (row) return draftFromRow(row);
    const pending = loadViewState<DeckDraft | null>(`S12:new:${deckId}`, null);
    return pending ?? { deckId, name: 'Novo deck', energyTypes: [], energyPinned: false, cards: [] };
  });
  const [history, setHistory] = useState<DeckDraft[]>([]);
  const [saveStatus, setSaveStatus] = useState<'SAVED' | 'SAVING' | 'DIRTY' | 'FAILED'>(row ? 'SAVED' : 'DIRTY');
  const [filters, setFilters] = useState(() => {
    const saved = loadViewState('S12:filters', { search: '', showMissing: false, types: [] as string[], setId: '' });
    return { ...saved, setId: saved.setId ?? '' };
  });
  const [poolLimit, setPoolLimit] = useState(POOL_PAGE);
  const [proposal, setProposal] = useState<DeckDraft | null>(null);
  const [showPool, setShowPool] = useState(() => loadViewState('S12:pool', { open: true }).open);
  const [coverPicker, setCoverPicker] = useState(false);
  const timer = useRef<number | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const inv = useMemo(() => new Map((snap?.inventory ?? []).map((i) => [i.printingId, i.quantity])), [snap]);
  // Coleção ao lado do deck: com ~2.000 impressões, filtra e ordena só quando a coleção ou os filtros mudam.
  const pool = useMemo(() => (c ? [...c.catalog.printings.values()].filter((p) => {
    const owned = (inv.get(p.printingId) ?? 0) > 0;
    if (!owned && !filters.showMissing) return false;
    if (filters.setId && p.setId !== filters.setId) return false;
    if (!searchMatches(c, p.printingId, filters.search)) return false;
    if (filters.types.length) {
      const def = c.catalog.definition(c.catalog.definitionKeyOfPrinting(p.printingId));
      const types = isPokemon(def) ? def.types : ['TRAINER'];
      if (!types.some((t) => filters.types.includes(t))) return false;
    }
    return true;
  }).sort((a, b) => sortKey(c, a.printingId).localeCompare(sortKey(c, b.printingId))) : []), [c, inv, filters]);

  useEffect(() => {
    // Adição vinda da coleção (“Adicionar ao deck”).
    if (query.add && c && snap && draft && canAdd(c, snap, draft, query.add) === null) update(addCard(draft, query.add));
  }, []);

  if (!c || !snap || !draft) return <Skeleton />;
  const validation = validateDraft(c, snap, draft);
  const analysis = analyzeDraft(c, draft);
  const returnTo = query.returnTo ?? null;
  const challengeNode = returnTo?.startsWith('/campaign/nodes/') ? returnTo.split('/').pop() ?? null : null;
  const nv = challengeNode ? nodeView(c, snap, challengeNode) : null;
  const usedBy = new Map<string, number>();
  for (const card of draft.cards) usedBy.set(card.printingId, (usedBy.get(card.printingId) ?? 0) + 1);
  const ids = draft.cards.map((x) => x.printingId);
  const cover = deckCover(c, draft.deckId, ids);
  const featured = featuredOf(c, ids, cover);
  const sorted = [...ids].sort((a, b) => sortKey(c, a).localeCompare(sortKey(c, b)) || a.localeCompare(b));
  const mainType = (draft.energyTypes[0] ?? cover?.types[0] ?? 'COLORLESS').toLowerCase();
  const appearance = row ? effectiveConfig(c, snap, draft.deckId).config : null;
  const cosmetic = (id: string | undefined) => (id ? c.bundle.cosmetics.find((x) => x.cosmeticId === id) ?? null : null);
  const accessories = appearance ? [cosmetic(appearance.sleeveId), cosmetic(appearance.coinId), cosmetic(appearance.playmatId)].filter((x) => !!x) : [];
  const favorite = settings.value.favoriteDeckId === draft.deckId;

  function update(next: DeckDraft): void {
    setHistory((h) => [...h.slice(-49), draftRef.current!]);
    const withEnergy = next.energyPinned || !c ? next : { ...next, energyTypes: suggestEnergy(c, next) };
    setDraft(withEnergy);
    setSaveStatus('DIRTY');
    if (timer.current) clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void autosave(withEnergy), 800);
  }
  async function autosave(d: DeckDraft): Promise<void> {
    setSaveStatus('SAVING');
    const r = await saveDeckDraft(requireCtx(), d);
    setSaveStatus(r.ok ? 'SAVED' : 'FAILED');
  }
  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory(history.slice(0, -1));
    setDraft(prev);
    setSaveStatus('DIRTY');
    if (timer.current) clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void autosave(prev), 800);
  };
  const leave = () => (returnTo ? back(returnTo) : go('S11'));
  const confirm = async () => {
    if (timer.current) clearTimeout(timer.current);
    const r = await confirmDeck(requireCtx(), draft);
    if (!r.ok) { setSaveStatus('FAILED'); toast(r.message, 'error'); return; }
    setSaveStatus('SAVED');
    toast('Versão do deck salva.', 'success');
    if (battleSession.value?.deckId === draft.deckId) toast('O duelo em andamento continua com a versão anterior.', 'info');
    if (returnTo) go('S16', { nodeId: challengeNode ?? '' });
  };
  const setEnergy = (t: EnergyType) => {
    const has = draft.energyTypes.includes(t);
    const types = has ? draft.energyTypes.filter((x) => x !== t) : [...draft.energyTypes, t].slice(-3);
    update({ ...draft, energyTypes: types, energyPinned: true });
  };
  const add = (printingId: string) => {
    const reason = canAdd(c, snap, draft, printingId);
    if (reason) { toast(reason, 'warning'); return; }
    update(addCard(draft, printingId));
  };
  const setFilter = (f: typeof filters) => { setFilters(f); setPoolLimit(POOL_PAGE); saveViewState('S12:filters', f); };
  const togglePool = () => { setShowPool(!showPool); saveViewState('S12:pool', { open: !showPool }); };
  const chooseCover = async (printingId: string) => {
    setCoverPicker(false);
    await saveSettings(requireCtx(), { deckCovers: { ...(settings.value.deckCovers ?? {}), [draft.deckId]: printingId } });
  };
  const onKey = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void confirm(); }
    // Em campos de texto, Ctrl+Z desfaz a digitação (nativo), não a lista.
    const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); undo(); }
  };
  const objectives = nv?.objectives.filter((o) => !o.done).map((o) => {
    const comp = o.objective.predicates.find((p) => p.type === 'DECK_COMPOSITION')?.composition;
    if (!comp) return null;
    const facts = deckFacts(draft.cards.map((x) => x.printingId), draft.energyTypes, c.catalog, c.starterPrintingIds);
    return { text: o.objective.description, ok: compositionHolds(comp, facts) };
  }).filter((x): x is { text: string; ok: boolean } => !!x) ?? [];
  const saveLabel = saveStatus === 'SAVED' ? 'Rascunho salvo' : saveStatus === 'SAVING' ? 'Gravando…' : saveStatus === 'FAILED' ? 'Falha ao gravar — alterações mantidas na memória' : 'Alterações não salvas';
  return (
    <div class={`deck-editor type-${mainType} ${showPool ? 'with-pool' : ''}`} onKeyDown={onKey}>
      <section class="deck-sheet" aria-label="Ficha do deck">
        <div class="deck-sheet-hero">
          <div class="deck-sheet-bar">
            <Button variant="ghost" icon="back" label="Voltar aos decks" onClick={leave} />
            <label class="deck-name-pill">
              <input class="deck-name" aria-label="Nome do deck" value={draft.name} maxLength={40} onInput={(e) => update({ ...draft, name: (e.target as HTMLInputElement).value })} />
              <Icon name="edit" size={16} />
            </label>
            <span class={`save-dot save-${saveStatus.toLowerCase()}`} role="status" title={saveLabel} aria-label={saveLabel}>
              <Icon name={saveStatus === 'SAVED' ? 'check' : saveStatus === 'FAILED' ? 'warning' : 'refresh'} size={16} />
            </span>
            <Button variant="ghost" icon="star" class={favorite ? 'is-on' : ''} label={favorite ? 'Deck favorito' : 'Favoritar'} onClick={() => void saveSettings(requireCtx(), { favoriteDeckId: draft.deckId })} disabledReason={row ? null : 'Salve o deck primeiro.'} />
          </div>
          <div class="deck-sheet-stage">
            <DeckBox3D face={cover} energyType={draft.energyTypes[0] ?? null} size="lg" label={`Caixa do deck ${draft.name}${cover ? `, capa ${cover.name}` : ''}`} />
            <Button icon="image" label="Trocar capa" onClick={() => setCoverPicker(true)} disabledReason={ids.length ? null : 'Adicione cartas para escolher a capa.'} testId="deck-cover" />
          </div>
          {challengeNode ? <span class="badge badge-new deck-sheet-challenge">Preparando: {challengeNode}</span> : null}
        </div>
        <div class="deck-sheet-panels">
          <div class="deck-mini-panel" role="group" aria-label={`Energia${draft.energyPinned ? ' (fixada)' : ' (sugerida)'}`}>
            <h3>Energia</h3>
            <span class="deck-energy-picker">
              {ENERGY_TYPES.map((t) => (
                <button key={t} type="button" class={`deck-energy ${draft.energyTypes.includes(t) ? 'is-on' : ''}`} aria-pressed={draft.energyTypes.includes(t)} title={TYPE_LABEL[t]} onClick={() => setEnergy(t)}>
                  <TypeIcon type={t} size={22} />
                </button>
              ))}
            </span>
          </div>
          <button type="button" class="deck-mini-panel" onClick={() => go('S42', { deckId: draft.deckId }, { tab: 'SLEEVE' })} disabled={!row} title={row ? 'Aparência do deck' : 'Salve o deck antes de mudar a aparência.'}>
            <h3>Acessórios</h3>
            <span class="deck-accessories">{accessories.length ? accessories.map((x) => <CosmeticSwatch key={x!.cosmeticId} cosmetic={x!} />) : <Icon name="palette" size={22} />}</span>
          </button>
          <div class="deck-mini-panel">
            <h3>Cartas em destaque</h3>
            <span class="deck-featured">{featured.length ? featured.map((f) => <CardFace key={f.printingId} face={f} size="xs" />) : <span class="muted small">—</span>}</span>
          </div>
        </div>
        <div class="deck-sheet-countbar">
          <span class={`deck-count-pill ${draft.cards.length === DECK_SIZE ? 'ok' : 'bad'}`} aria-label={`${draft.cards.length} de ${DECK_SIZE} cartas`}><Icon name="decks" size={18} />{draft.cards.length}/{DECK_SIZE}</span>
          <span class="small muted">{analysis.pokemon} Pokémon · {analysis.items + analysis.supporters + analysis.tools + analysis.stadiums} Treinadores</span>
          <span class="spacer" />
          <Button variant="ghost" icon="undo" label="Desfazer" onClick={undo} disabledReason={history.length ? null : 'Nada para desfazer.'} />
          <Button variant="ghost" icon="wand" label="Auto-build" onClick={() => setProposal(autoBuild(c, snap, { types: (draft.energyTypes.length ? draft.energyTypes : suggestEnergy(c, draft)) as EnergyType[], corePrintingId: null, deckId: draft.deckId, name: draft.name }))} />
          <Button variant="ghost" icon="play" label="Testar" onClick={() => go('S13', { deckId: draft.deckId })} disabledReason={row?.confirmed ? null : 'Salve uma versão válida para testar.'} />
          <Button variant={showPool ? 'secondary' : 'ghost'} icon="edit" label={showPool ? 'Fechar coleção' : 'Editar cartas'} onClick={togglePool} testId="deck-edit-cards" />
        </div>
        {validation.errors.length || validation.warnings.length || objectives.length ? (
          <div class="deck-sheet-notes">
            {validation.errors.map((e, i) => <p key={`e${i}`} class="deck-note is-error"><Icon name="warning" size={14} /> {e.message}</p>)}
            {objectives.map((o) => <p key={o.text} class={`deck-note ${o.ok ? 'is-ok' : ''}`}><Icon name={o.ok ? 'check' : 'star'} size={14} /> {o.text}</p>)}
            {validation.warnings.length ? (
              <details class="deck-note"><summary><Icon name="info" size={14} /> {validation.warnings.length} aviso(s)</summary>{validation.warnings.map((w, i) => <p key={i} class="small">{w.message}</p>)}</details>
            ) : null}
          </div>
        ) : null}
        <div class="deck-sheet-grid" aria-label="Cartas do deck">
          {sorted.map((pid, i) => {
            const face = faceOf(c, pid);
            return (
              <button key={`${pid}-${i}`} type="button" class="deck-slot" onClick={() => update(removeCard(draft, pid))} aria-label={`Remover uma cópia de ${face?.name ?? pid}`} title="Remover do deck">
                <CardFace face={face} size="sm" />
                <span class="deck-slot-badge" aria-hidden="true"><Icon name="minus" size={14} /></span>
              </button>
            );
          })}
          {Array.from({ length: Math.max(0, DECK_SIZE - sorted.length) }, (_, i) => <span key={`empty-${i}`} class="deck-slot is-empty" aria-hidden="true" />)}
        </div>
        <div class="deck-editor-actions">
          <Button size="lg" icon="close" label="Voltar (o rascunho fica salvo)" onClick={leave} />
          <Button size="lg" variant="primary" icon="check" label="Salvar versão" onClick={() => void confirm()} disabledReason={validation.ok ? null : 'Corrija os erros para salvar a versão.'} testId="deck-confirm" />
        </div>
      </section>
      {showPool ? (
        <section class="deck-pool" aria-label="Coleção disponível">
          <div class="deck-pool-bar">
            <SearchInput value={filters.search} onInput={(search) => setFilter({ ...filters, search })} />
            <Button variant={filters.showMissing ? 'secondary' : 'ghost'} icon="eye" label={filters.showMissing ? 'Ocultar não possuídas' : 'Mostrar não possuídas'} onClick={() => setFilter({ ...filters, showMissing: !filters.showMissing })} />
            <select class="input compact" aria-label="Expansão" value={filters.setId} onChange={(e) => setFilter({ ...filters, setId: (e.target as HTMLSelectElement).value })}>
              <option value="">Todas as expansões</option>
              {c.bundle.sets.map((s) => <option key={s.setId} value={s.setId}>{s.name}</option>)}
            </select>
          </div>
          <div class="deck-pool-types" role="group" aria-label="Filtrar por tipo">
            {[...ENERGY_TYPES, 'COLORLESS', 'TRAINER'].map((t) => {
              const on = filters.types.includes(t);
              return (
                <button key={t} type="button" class={`deck-energy ${on ? 'is-on' : ''}`} aria-pressed={on} title={t === 'TRAINER' ? 'Treinador' : TYPE_LABEL[t as EnergyType]}
                  onClick={() => setFilter({ ...filters, types: on ? filters.types.filter((x) => x !== t) : [...filters.types, t] })}>
                  {t === 'TRAINER' ? <Icon name="profile" size={18} /> : <TypeIcon type={t as EnergyType} size={22} label={false} />}
                </button>
              );
            })}
          </div>
          <div class="deck-pool-grid">
            {pool.slice(0, poolLimit).map((p) => {
              const owned = inv.get(p.printingId) ?? 0;
              const used = usedBy.get(p.printingId) ?? 0;
              const reason = canAdd(c, snap, draft, p.printingId, inv);
              const face = faceOf(c, p.printingId);
              return (
                <button key={p.printingId} type="button" class={`deck-pool-card ${reason ? 'is-blocked' : ''}`} onClick={() => add(p.printingId)}
                  aria-label={`Adicionar ${face?.name ?? p.printingId}${reason ? `. Indisponível: ${reason}` : ''}`} aria-disabled={reason ? 'true' : undefined} title={reason ?? 'Adicionar ao deck'}>
                  <CardFace face={face} size="sm" dim={owned === 0} />
                  <span class="deck-pool-count" aria-hidden="true">{used ? `${used}/${owned}` : `×${owned}`}</span>
                  {reason ? null : <span class="deck-pool-plus" aria-hidden="true"><Icon name="plus" size={16} /></span>}
                </button>
              );
            })}
          </div>
          {pool.length > poolLimit ? (
            <Button variant="ghost" icon="plus" label={`Mostrar mais (${pool.length - poolLimit})`} onClick={() => setPoolLimit(poolLimit + POOL_PAGE)} />
          ) : null}
        </section>
      ) : null}
      <Modal open={coverPicker} title="Capa do deck" onClose={() => setCoverPicker(false)} wide>
        <div class="deck-cover-grid">
          {rankedFaces(c, ids).map((f) => (
            <button key={f.printingId} type="button" class={`deck-cover-option ${cover?.definitionKey === f.definitionKey ? 'is-selected' : ''}`} onClick={() => void chooseCover(f.printingId)} aria-label={`Usar ${f.name} como capa`}>
              <CardFace face={f} size="sm" />
            </button>
          ))}
        </div>
      </Modal>
      <Modal open={!!proposal} title="Proposta de auto-build" onClose={() => setProposal(null)} wide actions={<><Button variant="ghost" icon="close" label="Cancelar" onClick={() => setProposal(null)} /><Button variant="primary" icon="check" label="Aplicar proposta" onClick={() => { if (proposal) update(proposal); setProposal(null); }} /></>}>
        {proposal ? <ProposalDiff c={c} current={draft} proposal={proposal} /> : null}
      </Modal>
    </div>
  );
}

function groupEntries(c: ContentIndex, printingIds: readonly string[]): [string, number][] {
  const m = new Map<string, number>();
  for (const id of printingIds) m.set(id, (m.get(id) ?? 0) + 1);
  return [...m].sort((a, b) => sortKey(c, a[0]).localeCompare(sortKey(c, b[0])));
}

function ProposalDiff({ c, current, proposal }: { readonly c: ContentIndex; readonly current: DeckDraft; readonly proposal: DeckDraft }): JSX.Element {
  const d = diffDrafts(current, proposal);
  const names = (ids: string[]) => groupEntries(c, ids).map(([id, n]) => `${n}× ${faceOf(c, id)?.name}`).join(', ') || '—';
  return (
    <div class="stack">
      <p>{proposal.cards.length}/20 cartas com {proposal.energyTypes.map((t) => TYPE_LABEL[t as EnergyType]).join(', ')}.</p>
      <p><b>Adicionadas:</b> {names(d.added)}</p>
      <p><b>Removidas:</b> {names(d.removed)}</p>
      {proposal.cards.length < 20 ? <p class="field-error">Sua coleção não tem cartas suficientes desses tipos para completar 20.</p> : null}
    </div>
  );
}

export function DeckTestScreen({ params }: { params: Readonly<Record<string, string>> }): JSX.Element {
  const deckId = params.deckId ?? '';
  useEffect(() => { go('S17', {}, { deckId }, { replace: true }); }, [deckId]);
  return <Skeleton />;
}
