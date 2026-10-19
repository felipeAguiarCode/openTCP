// S44 — Editor do projeto (editor-de-cartas.md §4–§5, §24, §27, §31): cabeçalho com estado de gravação real,
// abas Regras/Arte/Acabamento/Testes/Publicação, estrutura × formulário × prévia+relatório (16:9; em 720p a
// estrutura vira seletor e formulário/prévia alternam), barra inferior Desfazer/Refazer/Revisão/Salvar/Validar,
// atalhos Ctrl/Cmd+S/Z/Shift+Z e guarda ao sair com alterações. Estado de UI nunca entra no rascunho.
import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { loadProject, validationContextFor } from '../../../application/studio.ts';
import { SAVE_STATUS_LABEL } from '../../../domain/editor/autosave.ts';
import { compileRules } from '../../../domain/editor/compile.ts';
import { defaultScenarios, LAB_FIXTURES } from '../../../domain/editor/lab.ts';
import { MODE_LABEL } from '../../../domain/editor/draft.ts';
import { TAB_LABEL, type EditorTab, type ValidationIssue } from '../../../domain/editor/validate.ts';
import { go, loadViewState, saveViewState } from '../app/router.ts';
import { content, reducedMotion, requireCtx, snapshot, toast } from '../app/store.ts';
import { Button, EmptyState, ErrorState, Modal, Skeleton, Tabs } from '../components/controls.tsx';
import { Icon } from '../components/icons.tsx';
import { ArtTab, PrintingTabs } from './art.tsx';
import { createEditorStore, type EditorStore } from './editor-store.ts';
import { FinishTab } from './finish.tsx';
import { RulesForm, selectionForPath, StructureTree, type FormContext, type RulesSelection } from './forms.tsx';
import { BalancePanel, CardPreview, TextFitPanel, ValidationPanel } from './preview.tsx';
import { PublishTab } from './publish.tsx';
import { downloadBytes, MODE_HELP, pathKey, safeFilename } from './shared.tsx';

type ViewState = { readonly tab: EditorTab; readonly selection: RulesSelection; readonly printing: number; readonly pane: 'FORM' | 'PREVIEW' };
const INITIAL_VIEW: ViewState = { tab: 'RULES', selection: { kind: 'IDENTITY' }, printing: 0, pane: 'FORM' };

export function ProjectEditor({ projectId }: { readonly projectId: string }): JSX.Element {
  const [state, setState] = useState<{ store: EditorStore } | { error: string } | null>(null);
  useEffect(() => {
    let alive = true;
    let created: EditorStore | null = null;
    const ctx = requireCtx();
    void (async () => {
      const p = await loadProject(ctx, projectId);
      if (!p.ok) { if (alive) setState({ error: p.message }); return; }
      const context = await validationContextFor(ctx, p, p.draft);
      if (!alive) return;
      created = createEditorStore(ctx, p, context);
      setState({ store: created });
    })().catch((e: unknown) => { if (alive) setState({ error: e instanceof Error ? e.message : String(e) }); });
    return () => { alive = false; created?.dispose(); };
  }, [projectId]);
  if (!state) return <Skeleton lines={10} />;
  if ('error' in state) return <ErrorState title="Projeto indisponível" text={`${state.error} O projeto pode abrir em recuperação a partir de uma revisão anterior.`} onRetry={() => location.reload()} />;
  return <Editor store={state.store} />;
}

function scrollToPath(path: readonly (string | number)[]): void {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const keys = path.map((_, i) => pathKey(path.slice(0, path.length - i)));
    for (const key of keys) {
      const el = document.querySelector<HTMLElement>(`[data-path="${CSS.escape(key)}"]`);
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        const input = el.querySelector<HTMLElement>('input, select, textarea, button');
        (input ?? el).focus?.({ preventScroll: true });
        el.classList.add('is-flash');
        setTimeout(() => el.classList.remove('is-flash'), 1600);
        return;
      }
    }
  }));
}

function Editor({ store }: { readonly store: EditorStore }): JSX.Element {
  const ctx = requireCtx();
  const project = store.project.value;
  const draft = store.draft.value;
  const report = store.report.value;
  const autosave = store.autosave.value;
  const c = content.value;
  const viewKey = `studio:${project.projectId}`;
  const [view, setViewRaw] = useState<ViewState>(() => loadViewState(viewKey, INITIAL_VIEW));
  const [leaving, setLeaving] = useState<null | (() => void)>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const setView = (patch: Partial<ViewState>) => setViewRaw((v) => { const next = { ...v, ...patch }; saveViewState(viewKey, next); return next; });
  const locked = draft.mode === 'VARIANT';
  const catalog = useMemo(() => (c ? [...c.catalog.definitions.values()] : []), [c]);
  const nameOf = (key: string) => catalog.find((d) => d.deckLimitKey === key)?.name ?? null;
  const printingIndex = Math.min(view.printing, Math.max(0, draft.printings.length - 1));

  // Atalhos (só com o editor em foco/visível): Ctrl/Cmd+S grava MANUAL sem o diálogo do navegador.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      const target = e.target as HTMLElement | null;
      const typing = !!target && (target.tagName === 'TEXTAREA' || (target.tagName === 'INPUT' && !['checkbox', 'radio', 'range', 'button'].includes((target as HTMLInputElement).type)));
      if (key === 's') { e.preventDefault(); void store.saveNow('MANUAL').then((ok) => toast(ok ? 'Rascunho salvo (revisão manual).' : 'Falha ao salvar: as alterações continuam nesta tela.', ok ? 'success' : 'error')); return; }
      if (typing) return; // Campos de texto mantêm o desfazer nativo.
      if (key === 'z' && e.shiftKey) { e.preventDefault(); store.redo(); }
      else if (key === 'z') { e.preventDefault(); store.undo(); }
      else if (key === 'y') { e.preventDefault(); store.redo(); }
    };
    const onUnload = (e: BeforeUnloadEvent) => { if (store.dirty()) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onUnload);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('beforeunload', onUnload); };
  }, [store]);

  const select = (selection: RulesSelection) => setView({ selection, tab: 'RULES', pane: 'FORM' });
  const goTo = (issue: ValidationIssue) => {
    if (issue.tab === 'RULES') setView({ tab: 'RULES', selection: selectionForPath(issue.path), pane: 'FORM' });
    else if (issue.tab === 'ART' || issue.tab === 'FINISH') setView({ tab: issue.tab, printing: typeof issue.path[1] === 'number' ? issue.path[1] : view.printing, pane: 'FORM' });
    else setView({ tab: issue.tab, pane: 'FORM' });
    scrollToPath(issue.path);
  };
  const leave = (target: () => void) => { if (store.dirty()) setLeaving(() => target); else target(); };
  const openLab = async (attackId?: string) => {
    await store.flush();
    go('S45', { projectId: project.projectId }, attackId ? { attack: attackId } : {});
  };
  const formCtx: FormContext = { draft, update: store.update, locked, issues: report.issues, catalog, select, onTestAttack: (id) => void openLab(id) };
  const tabErrors = (tab: EditorTab) => report.issues.filter((i) => i.tab === tab && i.severity === 'ERROR').length;
  const status = autosave.status === 'SAVED' || autosave.status === 'CLEAN' ? `${SAVE_STATUS_LABEL.SAVED} — revisão ${autosave.headRevision}` : autosave.status === 'SAVING' ? `Salvando revisão ${autosave.headRevision + 1}…` : SAVE_STATUS_LABEL[autosave.status];
  let compiledName = draft.rules.name;
  try { compiledName = compileRules(draft).name; } catch { /* rascunho incompleto */ }
  const profileMode = snapshot.value?.profile.progressionMode ?? 'STANDARD';
  const publishedVersions = catalog.filter((d) => d.id === draft.target.definitionId).map((d) => d.version).sort((a, b) => a - b);
  const previousRules = catalog.filter((d) => d.id === draft.target.definitionId && d.version < draft.target.version).sort((a, b) => b.version - a.version)[0] ?? null;
  const previousPrinting = previousRules && c ? [...c.catalog.printings.values()].find((p) => p.cardDefinitionId === previousRules.id && p.cardDefinitionVersion === previousRules.version) ?? null : null;
  const previous = previousRules && previousPrinting ? { rules: previousRules, printing: previousPrinting } : null;

  const center = (() => {
    switch (view.tab) {
      case 'ART': return <ArtTab ctx={ctx} draft={draft} index={printingIndex} update={store.update} onArtImported={() => void store.refreshContext()} />;
      case 'FINISH': return <FinishTab ctx={ctx} draft={draft} index={printingIndex} update={store.update} reducedMotion={reducedMotion.value} onMaskStored={() => void store.refreshContext()} />;
      case 'TESTS': return <TestsSummary store={store} onOpenLab={() => void openLab()} />;
      case 'PUBLISH': return <PublishTab ctx={ctx} store={store} />;
      default: return <RulesForm ctx={formCtx} selection={view.selection} />;
    }
  })();

  return (
    <div class="studio-editor" data-testid="studio-editor">
      <header class="studio-head">
        <Button variant="ghost" icon="back" onClick={() => leave(() => go('S43'))}>Estúdio</Button>
        <div class="grow studio-head-title">
          <h1 id="page-title" tabIndex={-1}>{compiledName || 'Carta sem nome'}</h1>
          <span class="badge">{MODE_LABEL[draft.mode]}</span>
          <span class="badge badge-locked" title="Rascunho salvo não é carta disponível para duelos.">Rascunho</span>
          {publishedVersions.length ? <span class="badge badge-done" title="Versões publicadas são imutáveis; o rascunho mira a próxima.">Publicada v{publishedVersions.join(', v')}</span> : null}
          <span class={`badge ${profileMode === 'STANDARD' ? '' : 'badge-new'}`} title="Modo do perfil atual">Perfil {profileMode}</span>
        </div>
        <span class={`studio-save save-${autosave.status.toLowerCase()}`} role="status" aria-live="polite" data-testid="studio-save-status">{status}</span>
        <Button icon="play" onClick={() => void openLab()}>Testar</Button>
        <Button variant="primary" icon="upload" onClick={() => setView({ tab: 'PUBLISH', pane: 'FORM' })} testId="go-publish">Publicar</Button>
      </header>
      <div class="studio-tabs-row">
        <Tabs label="Seções do projeto" value={view.tab} onChange={(tab) => setView({ tab, pane: 'FORM' })}
          tabs={(['RULES', 'ART', 'FINISH', 'TESTS', 'PUBLISH'] as EditorTab[]).map((id) => ({ id, label: TAB_LABEL[id], badge: tabErrors(id) || undefined }))} />
        <small class="muted studio-mode-help">{MODE_HELP[draft.mode]}</small>
        <div class="studio-pane-toggle">
          <Tabs label="Painel" value={view.pane} onChange={(pane) => setView({ pane })} tabs={[{ id: 'FORM', label: 'Formulário' }, { id: 'PREVIEW', label: 'Prévia' }]} />
        </div>
      </div>
      <div class={`studio-body pane-${view.pane.toLowerCase()}`}>
        <aside class="studio-structure" aria-label="Estrutura">
          {view.tab === 'ART' || view.tab === 'FINISH'
            ? <PrintingTabs draft={draft} selected={printingIndex} onSelect={(printing) => setView({ printing })} update={store.update} />
            : <StructureTree ctx={formCtx} selection={view.selection} />}
        </aside>
        <main class="studio-form" aria-label="Configuração">{center}</main>
        <aside class="studio-side" aria-label="Prévia e relatório">
          <CardPreview ctx={ctx} draft={draft} printingIndex={printingIndex} reducedMotion={reducedMotion.value} nameOf={nameOf} previous={previous} />
          <TextFitPanel draft={draft} printingIndex={printingIndex} nameOf={nameOf} />
          <div ref={reportRef} tabIndex={-1} class="studio-side-report">
            <h2 class="sr-only">Erros, avisos e testes</h2>
            <ValidationPanel report={report} onGo={goTo} />
            <details><summary>Balanceamento (estimativas com hipóteses explícitas)</summary><BalancePanel rules={draft.rules} catalog={catalog} /></details>
          </div>
        </aside>
      </div>
      <footer class="studio-bottom">
        <Button icon="history" onClick={store.undo} disabledReason={store.canUndo.value ? null : 'Nada para desfazer'} label="Desfazer (Ctrl+Z)">Desfazer</Button>
        <Button onClick={store.redo} disabledReason={store.canRedo.value ? null : 'Nada para refazer'} label="Refazer (Ctrl+Shift+Z)">Refazer</Button>
        <span class="grow muted">Revisão {autosave.headRevision}{autosave.message ? ` · ${autosave.message}` : ''}</span>
        {autosave.status === 'CONFLICT' ? <Button variant="danger" onClick={() => location.reload()}>Recarregar a revisão salva</Button> : null}
        {autosave.status === 'FAILED' || autosave.status === 'CONFLICT' ? (
          <Button icon="download" onClick={() => downloadBytes(`${JSON.stringify(draft, null, 2)}
`, `rascunho-${safeFilename(draft.rules.name || 'carta')}.json`, 'application/json')}>Exportar rascunho</Button>
        ) : null}
        <Button icon="saves" onClick={() => void store.saveNow('MANUAL').then((ok) => toast(ok ? 'Rascunho salvo.' : 'Falha ao salvar.', ok ? 'success' : 'error'))} testId="save-draft">Salvar rascunho</Button>
        <Button icon="check" onClick={() => { void store.refreshContext(); setView({ pane: 'PREVIEW' }); reportRef.current?.focus(); reportRef.current?.scrollIntoView({ block: 'nearest' }); }}>Validar tudo</Button>
      </footer>
      <Modal open={!!leaving} title="Sair com alterações?" onClose={() => setLeaving(null)} actions={(
        <>
          <Button variant="ghost" onClick={() => setLeaving(null)}>Continuar editando</Button>
          <Button variant="danger" onClick={() => { const t = leaving; setLeaving(null); store.discard(); t?.(); }}>Descartar alterações não confirmadas</Button>
          <Button onClick={() => { const t = leaving; setLeaving(null); void store.saveNow('AUTO').then(() => t?.()); }}>Manter rascunho recuperável</Button>
          <Button variant="primary" onClick={() => { const t = leaving; setLeaving(null); void store.saveNow('MANUAL').then((ok) => { if (ok) t?.(); else toast('Falha ao salvar: continue nesta tela ou exporte o rascunho.', 'error'); }); }}>Salvar e sair</Button>
        </>
      )}>
        <p>Há alterações ainda não confirmadas no SQLite. Publicação e concessões nunca fazem parte do Desfazer.</p>
      </Modal>
    </div>
  );
}

function TestsSummary({ store, onOpenLab }: { readonly store: EditorStore; readonly onOpenLab: () => void }): JSX.Element {
  const draft = store.draft.value;
  const add = () => store.update((d) => ({ ...d, testScenarios: [...d.testScenarios, ...defaultScenarios(d.rules, d.testScenarios)].slice(0, 64) }));
  return (
    <div class="stack">
      <p class="muted">Cenários do autor ficam no rascunho e são obrigatórios na publicação: cada um precisa de uma execução aprovada para o rulesHash atual. Moedas forçadas aparecem rotuladas e não valem para a campanha.</p>
      {draft.testScenarios.length === 0 ? <EmptyState title="Nenhum cenário" text="Gere os cenários-padrão (uso mínimo, Energia insuficiente, Fraqueza, Nocaute, retomada)." /> : (
        <ul class="list">
          {draft.testScenarios.map((s, i) => (
            <li key={s.id} class="list-row" data-path={pathKey(['testScenarios', i])}>
              <Icon name="flag" size={18} />
              <div class="grow">
                <strong>{s.id}</strong>
                <p class="small muted">{s.kind}{s.attackId ? ` · ${s.attackId}` : ''}{s.abilityId ? ` · ${s.abilityId}` : ''} · {LAB_FIXTURES.find((f) => f.id === s.fixture)?.label ?? s.fixture}{s.forcedCoins.length ? ` · moedas ${s.forcedCoins.map((x) => (x === 'HEADS' ? 'C' : 'K')).join('')}` : ''}</p>
              </div>
              <Button size="sm" variant="ghost" icon="trash" label="Remover cenário" onClick={() => store.update((d) => ({ ...d, testScenarios: d.testScenarios.filter((_, k) => k !== i) }))} />
            </li>
          ))}
        </ul>
      )}
      <div class="row">
        <Button icon="plus" onClick={add} disabledReason={draft.mode === 'VARIANT' ? 'Variante não altera regras: sem testes funcionais novos' : null}>Gerar cenários-padrão</Button>
        <Button variant="primary" icon="play" onClick={onOpenLab}>Abrir laboratório</Button>
      </div>
    </div>
  );
}

