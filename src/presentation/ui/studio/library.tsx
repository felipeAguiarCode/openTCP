// S43 — Biblioteca do Estúdio (editor-de-cartas.md §3, §6): Meus projetos, Publicadas, Modelos, Catálogo base
// e Arquivadas. A situação de validação vem do resumo persistido na revisão head (não revalida para listar);
// busca por search-key-v1. Cada criação abre um projeto com modo explícito (NEW_DEFINITION/NEW_VERSION/
// VARIANT/FORK). O catálogo base é somente leitura: “Editar como cópia” cria FORK com origem registrada.
import type { JSX } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { GameContext } from '../../../application/context.ts';
import {
  createProject, duplicateProject, loadLibrary, loadProject, matchesSearch, setCatalogArchived, setProjectArchived, summaryOf, type CreateProjectInput, type Library,
  type ProjectRow, type ProjectState, type PublishedVersion,
} from '../../../application/studio.ts';
import { STAGE_LABEL, SUBTYPE_LABEL, TYPE_LABEL } from '../../../domain/cards/text.ts';
import type { CardDefinition, CardPrinting, PokemonType } from '../../../domain/cards/types.ts';
import { POKEMON_TYPES } from '../../../domain/cards/types.ts';
import { CARD_TEMPLATES, MODE_LABEL, type CardTemplateKind } from '../../../domain/editor/draft.ts';
import { refreshCustomCatalog } from '../app/boot.ts';
import { go, loadViewState, saveViewState } from '../app/router.ts';
import { confirmDialog, requireCtx, snapshot, toast } from '../app/store.ts';
import { CardFace, finishLabel } from '../components/cards.tsx';
import { Button, EmptyState, ErrorState, Modal, PageHeader, SearchInput, Skeleton, Tabs } from '../components/controls.tsx';
import { exportData, exportImage, exportPack } from './exports.ts';
import { artOf, safeFace, SelectField, TextField, useAssetUrl } from './shared.tsx';

type LibTab = 'PROJECTS' | 'PUBLISHED' | 'TEMPLATES' | 'BASE' | 'ARCHIVED';
type View = { readonly tab: LibTab; readonly search: string };

function Mini({ ctx, rules, printing }: { readonly ctx: GameContext; readonly rules: CardDefinition; readonly printing: CardPrinting | undefined }): JSX.Element {
  const url = useAssetUrl(ctx, printing?.artMode !== 'TEMPLATE_ONLY' ? printing?.artAssetId ?? null : null);
  return <CardFace face={safeFace(rules, printing)} size="sm" art={artOf(printing, url)} />;
}

function describe(rules: CardDefinition): string {
  if (rules.category === 'TRAINER') return `Treinador · ${rules.trainerRules?.fieldBehavior ? 'Fóssil' : SUBTYPE_LABEL[rules.subtype] ?? rules.subtype}`;
  const types = (rules.types ?? []).map((t) => TYPE_LABEL[t]).join('/');
  return `${STAGE_LABEL[rules.stage] ?? rules.stage} · ${types}${rules.ruleBox !== 'NONE' ? ` · ${rules.ruleBox === 'EX' ? 'ex' : 'Mega ex'}` : ''}`;
}

const dateFmt = (iso: string) => { try { return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); } catch { return iso; } };

function ProjectTile({ ctx, row, draft, onChanged }: { readonly ctx: GameContext; readonly row: ProjectRow; readonly draft: ProjectState | null; readonly onChanged: () => void }): JSX.Element {
  const summary = summaryOf(row.validationSummary);
  const rules = draft?.draft.rules;
  const printing = draft?.draft.printings[0];
  const status = !summary ? 'Sem validação' : summary.errors ? `${summary.errors} erro(s)` : 'Pronto para publicar';
  return (
    <article class="studio-tile" data-testid="project-tile">
      <button type="button" class="studio-tile-main" onClick={() => go('S44', { projectId: row.projectId })} aria-label={`Abrir ${rules?.name || row.title}`}>
        {rules ? <Mini ctx={ctx} rules={rules} printing={printing} /> : <div class="card-face card-sm card-back"><div class="card-back-pattern" /></div>}
        <div class="studio-tile-info">
          <strong>{rules?.name || row.title}</strong>
          <span class="small muted">{rules ? describe(rules) : '…'}</span>
          <span class="small">{MODE_LABEL[row.mode as keyof typeof MODE_LABEL] ?? row.mode} · Rascunho · revisão {row.headRevision}</span>
          {printing ? <span class="small muted">{finishLabel(printing.finish)} · {draft?.draft.printings.length ?? 0} impressão(ões)</span> : null}
          <span class={`badge ${summary?.errors ? 'badge-danger' : summary ? 'badge-done' : ''}`}>{status}{summary?.warnings ? ` · ${summary.warnings} aviso(s)` : ''}</span>
          <span class="small muted">Alterado {dateFmt(row.updatedAt)}</span>
        </div>
      </button>
      <div class="studio-tile-actions">
        <Button size="sm" onClick={() => go('S44', { projectId: row.projectId })}>Abrir</Button>
        <Button size="sm" variant="ghost" icon="play" onClick={() => go('S45', { projectId: row.projectId })}>Testar</Button>
        <Button size="sm" variant="ghost" disabledReason={draft ? null : 'Carregando'} onClick={async () => {
          if (!draft) return;
          const r = await duplicateProject(ctx, draft);
          if (!r.ok) { toast(r.message, 'error'); return; }
          toast('Projeto duplicado com novos IDs.', 'success');
          onChanged();
        }}>Duplicar</Button>
        <Button size="sm" variant="ghost" onClick={() => { saveViewState(`studio:${row.projectId}`, { tab: 'PUBLISH', selection: { kind: 'IDENTITY' }, printing: 0, pane: 'FORM' }); go('S44', { projectId: row.projectId }); }}>Publicar</Button>
        <Button size="sm" variant="ghost" icon="trash" onClick={async () => {
          if (!(await confirmDialog({ title: `Arquivar “${row.title}”?`, body: 'O projeto sai da lista principal; nada é apagado e pode ser desarquivado.', confirmLabel: 'Arquivar' }))) return;
          const r = await setProjectArchived(ctx, row.projectId, true);
          if (!r.ok) toast(r.message, 'error'); else onChanged();
        }}>Arquivar</Button>
      </div>
    </article>
  );
}

function PublishedTile({ ctx, item, onCreate, onChanged }: { readonly ctx: GameContext; readonly item: PublishedVersion; readonly onCreate: (input: CreateProjectInput) => void; readonly onChanged: () => void }): JSX.Element {
  const d = item.definition;
  const printing = item.printings[0]?.printing;
  return (
    <article class="studio-tile">
      <button type="button" class="studio-tile-main" onClick={() => go('S47', { definitionId: d.id, version: d.version })} aria-label={`Ver ${d.name} versão ${d.version}`}>
        <Mini ctx={ctx} rules={d} printing={printing} />
        <div class="studio-tile-info">
          <strong>{d.name}</strong>
          <span class="small muted">{describe(d)}</span>
          <span class="small">Publicada · v{d.version}{item.head ? ' (atual)' : ''}</span>
          <span class="small muted">{item.printings.map((p) => finishLabel(p.printing.finish)).join(', ')}</span>
          {item.archived ? <span class="badge badge-locked">Arquivada</span> : null}
        </div>
      </button>
      <div class="studio-tile-actions">
        <Button size="sm" onClick={() => onCreate({ mode: 'NEW_VERSION', sourceDefinitionId: d.id, sourceVersion: d.version })}>Nova versão</Button>
        <Button size="sm" variant="ghost" onClick={() => onCreate({ mode: 'VARIANT', sourceDefinitionId: d.id, sourceVersion: d.version })}>Variante visual</Button>
        <Button size="sm" variant="ghost" onClick={() => onCreate({ mode: 'FORK', sourceDefinitionId: d.id, sourceVersion: d.version })}>Duplicar como nova</Button>
        <details class="studio-menu">
          <summary class="btn btn-sm btn-ghost">Exportar</summary>
          <div class="studio-menu-body">
            <Button size="sm" variant="ghost" disabledReason={printing ? null : 'Sem impressão'} onClick={() => printing && void exportImage(ctx, printing)}>Exportar imagem (PNG)</Button>
            <Button size="sm" variant="ghost" onClick={() => void exportData(ctx, d.id, d.version)}>Exportar dados (.card.json)</Button>
            <Button size="sm" variant="ghost" onClick={() => void exportPack(ctx, [{ definitionId: d.id, version: d.version }])}>Exportar pacote completo (.cardpack.zip)</Button>
          </div>
        </details>
        <Button size="sm" variant="ghost" onClick={async () => {
          const r = await setCatalogArchived(ctx, 'VERSION', d.id, d.version, !item.archived);
          if (!r.ok) { toast(r.message, 'error'); return; }
          toast(item.archived ? 'Versão desarquivada.' : 'Versão arquivada: sai das novas escolhas, sem quebrar replays e coleções.', 'success');
          onChanged();
        }}>{item.archived ? 'Desarquivar' : 'Arquivar'}</Button>
      </div>
    </article>
  );
}

function CreateDialog({ open, onClose, onCreate, preset }: { readonly open: boolean; readonly onClose: () => void; readonly onCreate: (input: CreateProjectInput) => void; readonly preset: CardTemplateKind | null }): JSX.Element {
  const [category, setCategory] = useState<'POKEMON' | 'TRAINER'>('POKEMON');
  const [template, setTemplate] = useState<CardTemplateKind>('POKEMON_BASIC');
  const [baseName, setBaseName] = useState('');
  const [type, setType] = useState<PokemonType>('FIRE');
  useEffect(() => {
    if (!open) return;
    if (preset) {
      const t = CARD_TEMPLATES.find((x) => x.id === preset)!;
      setCategory(t.category);
      setTemplate(preset);
    }
  }, [open, preset]);
  const templates = CARD_TEMPLATES.filter((t) => t.category === category);
  const snap = snapshot.value;
  const name = baseName.trim();
  return (
    <Modal open={open} title="Criar uma carta" onClose={onClose} wide actions={(
      <>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" disabledReason={!name ? 'Informe o nome-base' : [...name].length > 50 ? 'Até 50 caracteres' : null} testId="create-project-confirm"
          onClick={() => onCreate({ mode: 'NEW_DEFINITION', template, baseName: name, type })}>Criar projeto</Button>
      </>
    )}>
      <ol class="studio-wizard">
        <li>
          <strong>1. Categoria</strong>
          <div class="row">
            {(['POKEMON', 'TRAINER'] as const).map((c) => (
              <button key={c} type="button" class={`chip ${category === c ? 'is-active' : ''}`} aria-pressed={category === c}
                onClick={() => { setCategory(c); setTemplate(c === 'POKEMON' ? 'POKEMON_BASIC' : 'ITEM'); }}>{c === 'POKEMON' ? 'Pokémon' : 'Treinador'}</button>
            ))}
          </div>
        </li>
        <li>
          <strong>2. Modelo</strong>
          <div class="studio-template-grid">
            {templates.map((t) => (
              <button key={t.id} type="button" class={`studio-template ${template === t.id ? 'is-active' : ''}`} aria-pressed={template === t.id} onClick={() => setTemplate(t.id)}>
                <b>{t.label}{t.advanced ? ' · avançado' : ''}</b><small>{t.hint}</small>
              </button>
            ))}
          </div>
          <small class="muted">Valores do modelo são sugestões autorais. O modelo não publica sozinho nem marca testes como aprovados.</small>
        </li>
        <li>
          <strong>3. Nome-base e tipo</strong>
          <div class="studio-grid-2">
            <TextField label="Nome-base" value={baseName} max={50} onChange={setBaseName} placeholder="Ex.: Fagulhão" hint="Sem “ex”: a regra especial deriva o nome." />
            {category === 'POKEMON' ? <SelectField label="Tipo" value={type} options={POKEMON_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }))} onChange={setType} /> : <span />}
          </div>
        </li>
        <li>
          <strong>4. Perfil de criação</strong>
          <p class="small">Projeto do perfil <b>{snap?.profile.displayName ?? '—'}</b> ({snap?.profile.progressionMode ?? '—'}). {snap?.profile.progressionMode === 'STANDARD'
            ? 'Perfis STANDARD podem criar e publicar, mas só perfis CUSTOM/LAB recebem cópias autorais para jogar.' : 'Cartas publicadas podem receber cópias neste perfil.'}</p>
        </li>
      </ol>
    </Modal>
  );
}

export function StudioLibrary(): JSX.Element {
  const ctx = requireCtx();
  const [view, setViewRaw] = useState<View>(() => loadViewState('studio:library', { tab: 'PROJECTS', search: '' } as View));
  const [lib, setLib] = useState<Library | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ProjectState>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [preset, setPreset] = useState<CardTemplateKind | null>(null);
  const [busy, setBusy] = useState(false);
  const setView = (patch: Partial<View>) => setViewRaw((v) => { const next = { ...v, ...patch }; saveViewState('studio:library', next); return next; });
  const reload = () => {
    setError(null);
    loadLibrary(ctx).then(setLib, (e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  };
  useEffect(reload, []);
  useEffect(() => {
    if (!lib) return;
    let alive = true;
    void Promise.all([...lib.projects, ...lib.archivedProjects].filter((p) => !drafts[p.projectId]).map(async (p) => [p.projectId, await loadProject(ctx, p.projectId)] as const)).then((rows) => {
      if (!alive) return;
      const next = { ...drafts };
      for (const [id, r] of rows) if (r.ok) next[id] = r;
      setDrafts(next);
    });
    return () => { alive = false; };
  }, [lib]);

  const create = async (input: CreateProjectInput) => {
    setBusy(true);
    try {
      const r = await createProject(ctx, input);
      if (!r.ok) { toast(r.message, 'error'); return; }
      setCreateOpen(false);
      go('S44', { projectId: r.projectId });
    } finally {
      setBusy(false);
    }
  };
  const q = view.search;
  const projects = useMemo(() => (lib?.projects ?? []).filter((p) => matchesSearch(`${p.title} ${drafts[p.projectId]?.draft.rules.name ?? ''}`, q)), [lib, q, drafts]);
  const published = useMemo(() => (lib?.published ?? []).filter((p) => !p.archived && matchesSearch(p.definition.name, q)).sort((a, b) => Number(b.head) - Number(a.head) || a.definition.name.localeCompare(b.definition.name)), [lib, q]);
  const base = useMemo(() => (lib?.base ?? []).filter((b) => matchesSearch(b.definition.name, q)), [lib, q]);
  const archived = useMemo(() => ({
    projects: (lib?.archivedProjects ?? []).filter((p) => matchesSearch(p.title, q)),
    published: (lib?.published ?? []).filter((p) => p.archived && matchesSearch(p.definition.name, q)),
  }), [lib, q]);

  return (
    <div class="studio-library">
      <PageHeader title="Estúdio de Cartas" subtitle="Crie cartas jogáveis, configure regras, arte e acabamento, teste no laboratório e publique no catálogo autoral local."
        actions={(
          <>
            <Button icon="download" onClick={() => go('S46')}>Importar pacote</Button>
            <Button variant="primary" icon="plus" onClick={() => { setPreset(null); setCreateOpen(true); }} testId="studio-new">Nova carta</Button>
          </>
        )} />
      <div class="row-between studio-library-bar">
        <Tabs label="Biblioteca" value={view.tab} onChange={(tab) => setView({ tab })} tabs={[
          { id: 'PROJECTS', label: 'Meus projetos', badge: lib?.projects.length }, { id: 'PUBLISHED', label: 'Publicadas', badge: published.length },
          { id: 'TEMPLATES', label: 'Modelos' }, { id: 'BASE', label: 'Catálogo base' }, { id: 'ARCHIVED', label: 'Arquivadas' },
        ]} />
        <SearchInput value={view.search} onInput={(search) => setView({ search })} placeholder="Buscar por nome" />
      </div>
      {error ? <ErrorState text={error} onRetry={reload} /> : !lib ? <Skeleton lines={6} /> : (
        <>
          {view.tab === 'PROJECTS' ? (projects.length ? <div class="studio-grid">{projects.map((p) => <ProjectTile key={p.projectId} ctx={ctx} row={p} draft={drafts[p.projectId] ?? null} onChanged={reload} />)}</div>
            : <EmptyState title="Nenhum projeto" text="Projetos incompletos podem não ter arte; aparecem aqui com nome provisório e estado Rascunho." action={<Button variant="primary" onClick={() => setCreateOpen(true)}>Criar a primeira carta</Button>} />) : null}
          {view.tab === 'PUBLISHED' ? (published.length ? <div class="studio-grid">{published.map((p) => <PublishedTile key={`${p.definition.id}@${p.definition.version}`} ctx={ctx} item={p} onCreate={(i) => void create(i)} onChanged={() => { reload(); const s = snapshot.value; if (s) void refreshCustomCatalog(s.profile.profileId); }} />)}</div>
            : <EmptyState title="Nenhuma publicação" text="Cartas publicadas aparecem aqui e no catálogo autoral (coleção e editor de decks)." />) : null}
          {view.tab === 'TEMPLATES' ? (
            <div class="studio-template-grid">
              {CARD_TEMPLATES.map((t) => (
                <button key={t.id} type="button" class="studio-template" onClick={() => { setPreset(t.id); setCreateOpen(true); }}>
                  <b>{t.label}{t.advanced ? ' · avançado' : ''}</b><small>{t.hint}</small>
                </button>
              ))}
            </div>
          ) : null}
          {view.tab === 'BASE' ? (
            <>
              <p class="muted">Catálogo base é somente leitura. “Editar como cópia” cria um projeto CUSTOM (fork) com a origem registrada; nunca altera a carta base em todos os saves.</p>
              <div class="studio-grid">
                {base.map(({ definition, printings }) => (
                  <article key={definition.id} class="studio-tile">
                    <div class="studio-tile-main"><Mini ctx={ctx} rules={definition} printing={printings[0]} /><div class="studio-tile-info"><strong>{definition.name}</strong><span class="small muted">{describe(definition)}</span><span class="badge badge-locked">Somente leitura</span></div></div>
                    <div class="studio-tile-actions">
                      <Button size="sm" onClick={() => void create({ mode: 'FORK', sourceDefinitionId: definition.id, sourceVersion: definition.version })}>Editar como cópia</Button>
                      <Button size="sm" variant="ghost" onClick={() => void create({ mode: 'VARIANT', sourceDefinitionId: definition.id, sourceVersion: definition.version })}>Variante visual</Button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : null}
          {view.tab === 'ARCHIVED' ? (
            <div class="stack">
              {archived.projects.length + archived.published.length === 0 ? <EmptyState title="Nada arquivado" /> : null}
              <div class="studio-grid">
                {archived.projects.map((p) => (
                  <article key={p.projectId} class="studio-tile">
                    <div class="studio-tile-main"><div class="studio-tile-info"><strong>{p.title}</strong><span class="small muted">Projeto arquivado · revisão {p.headRevision}</span></div></div>
                    <div class="studio-tile-actions"><Button size="sm" onClick={async () => { const r = await setProjectArchived(ctx, p.projectId, false); if (!r.ok) toast(r.message, 'error'); else reload(); }}>Desarquivar</Button></div>
                  </article>
                ))}
                {archived.published.map((p) => <PublishedTile key={`${p.definition.id}@${p.definition.version}`} ctx={ctx} item={p} onCreate={(i) => void create(i)} onChanged={reload} />)}
              </div>
            </div>
          ) : null}
        </>
      )}
      <CreateDialog open={createOpen} preset={preset} onClose={() => setCreateOpen(false)} onCreate={(i) => { if (!busy) void create(i); }} />
    </div>
  );
}
