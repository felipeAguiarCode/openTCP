// S46 — Importar pacote (editor-de-cartas.md §29): selecionar arquivo → validar estrutura/limites → verificar
// conteúdo sem executar → comparar IDs, versões e hashes → mostrar novas cartas, variantes e conflitos →
// escolher importar / importar como cópia / pular → testes anexos reexecutados como relatório → confirmar.
// Mesmo ID/versão e hash: reutiliza. Hash diferente: conflito (nunca sobrescreve). Nada concede inventário.
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { applyImport, cardJsonToContents, planImport, type ImportCardDecision, type ImportOutcome, type ImportPlan } from '../../../application/studio.ts';
import { definitionKey } from '../../../domain/cards/types.ts';
import { changeText } from '../../../domain/editor/diff.ts';
import type { FormatIssue } from '../../../domain/editor/formats.ts';
import { detectInterchange, readCardJson, readCardpack } from '../../../infrastructure/files/cardpack.ts';
import { refreshCustomCatalog } from '../app/boot.ts';
import { go } from '../app/router.ts';
import { confirmDialog, requireCtx, snapshot, toast } from '../app/store.ts';
import { Button, EmptyState, PageHeader, Panel } from '../components/controls.tsx';
import { Icon } from '../components/icons.tsx';
import { pickFile } from './shared.tsx';

const STATUS_LABEL: Record<string, string> = { NEW: 'Carta nova', NEW_VERSION: 'Nova versão', SAME: 'Já existe (idêntica)', CONFLICT: 'Conflito' };
const DECISION_LABEL: Record<ImportCardDecision, string> = { IMPORT: 'Importar', COPY: 'Importar como cópia (novos IDs)', SKIP: 'Não importar' };
const MAX_FILE = 128 * 1024 * 1024;

export function StudioImport(): JSX.Element {
  const ctx = requireCtx();
  const [fileName, setFileName] = useState<string | null>(null);
  const [issues, setIssues] = useState<readonly FormatIssue[]>([]);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [decisions, setDecisions] = useState<Record<string, ImportCardDecision>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportOutcome | null>(null);

  const load = async (file: File) => {
    setBusy(true);
    setIssues([]);
    setPlan(null);
    setResult(null);
    setFileName(file.name);
    try {
      if (file.size > MAX_FILE) { setIssues([{ code: 'LIMIT_EXCEEDED', message: 'Arquivo acima de 128 MiB.' }]); return; }
      const bytes = new Uint8Array(await file.arrayBuffer());
      const kind = detectInterchange(bytes);
      if (kind === 'CARDPACK') {
        const read = readCardpack(bytes);
        if (!read.ok) { setIssues(read.issues); return; }
        const p = await planImport(ctx, read.value);
        setPlan(p);
        setDecisions(Object.fromEntries(p.cards.map((c) => [definitionKey(c.card.id, c.card.version), c.defaultDecision])));
      } else if (kind === 'CARD_JSON') {
        const read = readCardJson(bytes);
        if (!read.ok) { setIssues(read.issues); return; }
        const contents = await cardJsonToContents(ctx, read.value);
        const p = await planImport(ctx, contents);
        setPlan({ ...p, missingAssets: [...new Set([...p.missingAssets, ...contents.missingAssets])] });
        setDecisions(Object.fromEntries(p.cards.map((c) => [definitionKey(c.card.id, c.card.version), c.defaultDecision])));
      } else {
        setIssues([{ code: 'FORMAT_UNKNOWN', message: 'Não é um .cardpack.zip nem um .card.json (a extensão não basta: o conteúdo é verificado).' }]);
      }
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!plan) return;
    const chosen = plan.cards.filter((c) => (decisions[definitionKey(c.card.id, c.card.version)] ?? c.defaultDecision) !== 'SKIP');
    if (!(await confirmDialog({
      title: 'Confirmar importação?', confirmLabel: 'Importar',
      body: [`${chosen.length} carta(s) serão publicadas por projetos locais (uma transação por carta).`, 'Nenhuma versão existente é sobrescrita e nenhuma cópia é concedida.'],
    }))) return;
    setBusy(true);
    try {
      const r = await applyImport(ctx, plan, decisions);
      if (!r.ok) { toast(r.message, 'error'); return; }
      setResult(r);
      const s = snapshot.value;
      if (s) await refreshCustomCatalog(s.profile.profileId);
      toast(`${r.imported.length} importada(s), ${r.skipped.length} reutilizada(s)/pulada(s), ${r.failures.length} falha(s).`, r.failures.length ? 'warning' : 'success');
    } finally {
      setBusy(false);
    }
  };

  const blocking = !!plan && plan.cards.some((c) => (decisions[definitionKey(c.card.id, c.card.version)] ?? c.defaultDecision) !== 'SKIP' && c.report.errors > 0);
  return (
    <div class="studio-import">
      <PageHeader title="Importar cartas" backTo="/card-studio" subtitle="Pacote autoral .cardpack.zip ou carta avulsa .card.json. Importar cartas é diferente de importar progresso: nada de saldos, recibos ou inventário."
        actions={<Button variant="primary" icon="upload" loading={busy} onClick={async () => { const f = await pickFile('.zip,.json,application/zip,application/json'); if (f) void load(f); }} testId="import-pick">Selecionar arquivo</Button>} />
      <div class="studio-dropzone" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if (f) void load(f); }}>
        <Icon name="upload" /> <span>{fileName ? `Arquivo: ${fileName}` : 'Arraste um arquivo aqui ou use “Selecionar arquivo”.'}</span>
      </div>
      {issues.length ? (
        <Panel title="Arquivo recusado">
          <p class="muted">Nada foi importado. Pacotes com SQL, scripts, HTML, URLs remotas, caminhos absolutos, “..”, links simbólicos, entradas duplicadas, ZIP aninhado, expansão excessiva ou hashes falsos são rejeitados.</p>
          <ul class="studio-issues-list">{issues.slice(0, 40).map((i, k) => <li key={k}><b>{i.code}</b> — {i.message}{i.path ? <small class="muted"> ({i.path})</small> : null}</li>)}</ul>
        </Panel>
      ) : null}
      {plan ? (
        <div class="stack">
          {plan.missingAssets.length ? (
            <p class="field-error" role="alert"><Icon name="warning" size={14} /> Assets ausentes no banco: {plan.missingAssets.map((a) => `${a.slice(0, 12)}…`).join(', ')}. Um .card.json não carrega bytes: importe o .cardpack.zip completo.</p>
          ) : null}
          {plan.cards.map((c) => {
            const key = definitionKey(c.card.id, c.card.version);
            const decision = decisions[key] ?? c.defaultDecision;
            return (
              <Panel key={key} title={`${c.card.name} · v${c.card.version}`}>
                <div class="row">
                  <span class={`badge ${c.item.status === 'CONFLICT' ? 'badge-danger' : c.item.status === 'SAME' ? 'badge-locked' : 'badge-new'}`}>{STATUS_LABEL[c.item.status]}</span>
                  <span class="small muted">{c.item.reason}</span>
                </div>
                <p class="small">Validação: {c.report.errors} erro(s), {c.report.warnings} aviso(s). Impressões: {c.printingItems.map((p) => `${p.printingId} (${p.status === 'NEW' ? 'nova' : p.status === 'SAME' ? 'idêntica' : 'conflito'})`).join(', ') || '—'}</p>
                {c.report.errors ? <ul class="small field-error">{c.report.issues.filter((i) => i.severity === 'ERROR').slice(0, 8).map((i, k) => <li key={k}>{i.code}: {i.message}</li>)}</ul> : null}
                {c.diff.length && c.item.status !== 'NEW' ? (
                  <details><summary>Comparação com a versão local ({c.diff.length} diferença(s))</summary>
                    <ul class="studio-diff">{c.diff.slice(0, 40).map((d, k) => <li key={k} class={`diff-${d.kind.toLowerCase()}`}>{changeText(d)}</li>)}</ul>
                  </details>
                ) : null}
                <div class="row" role="radiogroup" aria-label={`Decisão para ${c.card.name}`}>
                  {c.allowed.map((d) => (
                    <button key={d} type="button" role="radio" aria-checked={decision === d} class={`chip ${decision === d ? 'is-active' : ''}`} onClick={() => setDecisions({ ...decisions, [key]: d })}>{DECISION_LABEL[d]}</button>
                  ))}
                </div>
              </Panel>
            );
          })}
          {plan.tests.length ? (
            <Panel title="Testes do pacote (relatório; não viram execuções locais)">
              <ul class="list">{plan.tests.map((t) => (
                <li key={t.testId} class="list-row">
                  <span class="grow">{t.testId}</span>
                  <span class="small muted">autor: {t.outcome}</span>
                  <span class={`badge ${t.rerun?.outcome === 'PASS' ? 'badge-done' : 'badge-warn'}`}>reexecutado: {t.rerun?.outcome ?? 'indisponível'}</span>
                </li>
              ))}</ul>
            </Panel>
          ) : null}
          <div class="row">
            <Button variant="primary" loading={busy} disabledReason={plan.missingAssets.length ? 'Assets ausentes' : blocking ? 'Há cartas com erros de validação: pule-as ou corrija na origem' : null} onClick={() => void confirm()} testId="import-confirm">Confirmar importação</Button>
            <Button variant="ghost" onClick={() => { setPlan(null); setFileName(null); }}>Cancelar</Button>
          </div>
        </div>
      ) : !issues.length ? <EmptyState title="Nenhum arquivo selecionado" text="A verificação acontece antes de qualquer gravação; o conteúdo nunca é executado." /> : null}
      {result ? (
        <Panel title="Resultado">
          <ul class="list">
            {result.imported.map((i) => (
              <li key={`${i.definitionId}@${i.version}`} class="list-row">
                <Icon name="check" size={16} /><span class="grow">{i.definitionId} v{i.version} {i.status === 'REPLAYED' ? '(já registrada)' : ''}</span>
                <Button size="sm" onClick={() => go('S47', { definitionId: i.definitionId, version: i.version })}>Ver release</Button>
              </li>
            ))}
            {result.skipped.map((k) => <li key={k} class="list-row"><span class="grow muted">{k}: reutilizada/pulada</span></li>)}
            {result.failures.map((f) => <li key={f.definitionId} class="list-row"><span class="grow field-error">{f.definitionId}: {f.message}</span></li>)}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
