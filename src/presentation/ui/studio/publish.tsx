// Aba Publicação (editor-de-cartas.md §27–§28; persistencia §18): resumo do que será criado, diff contra
// a versão anterior, testes do rulesHash atual, perfis onde a carta poderá ser usada e os botões separados
// Salvar rascunho / Publicar / Publicar e adicionar ao perfil de criação. O plano preparado é guardado para
// reenviar o MESMO comando após falha de resposta (idempotência; ED-058).
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { GameContext } from '../../../application/context.ts';
import { commitPublish, grantCustomCopies, grantEligibility, preparePublish, type PublishPlan, type PublishResult } from '../../../application/studio.ts';
import type { PokemonCard } from '../../../domain/cards/types.ts';
import { changeText } from '../../../domain/editor/diff.ts';
import { MODE_LABEL } from '../../../domain/editor/draft.ts';
import { refreshCustomCatalog } from '../app/boot.ts';
import { go } from '../app/router.ts';
import { confirmDialog, snapshot, toast } from '../app/store.ts';
import { finishLabel } from '../components/cards.tsx';
import { Button, KeyValue } from '../components/controls.tsx';
import { Icon } from '../components/icons.tsx';
import type { EditorStore } from './editor-store.ts';
import { NumberField } from './shared.tsx';

export function PublishTab({ ctx, store }: { readonly ctx: GameContext; readonly store: EditorStore }): JSX.Element {
  const [plan, setPlan] = useState<PublishPlan | null>(null);
  /** Plano de um commit sem resposta confirmada: reenviado igual (mesmo commandId) para recuperar o recibo. */
  const [retryPlan, setRetryPlan] = useState<PublishPlan | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [busy, setBusy] = useState<'PREPARE' | 'PUBLISH' | 'GRANT' | null>(null);
  const [done, setDone] = useState<PublishResult | null>(null);
  const [copies, setCopies] = useState(2);
  const [grantBatchId, setGrantBatchId] = useState(() => ctx.platform.newId('grant'));
  const draft = store.draft.value;
  const report = store.report.value;
  const snap = snapshot.value;

  const prepare = async (): Promise<PublishPlan | null> => {
    setBusy('PREPARE');
    setBlocked(null);
    try {
      if (!(await store.saveNow('MANUAL'))) { setBlocked('Salve o rascunho antes de publicar (a gravação falhou ou há conflito).'); return null; }
      const p = store.project.value;
      const r = await preparePublish(ctx, { projectId: p.projectId, headRevision: p.headRevision, mode: p.mode, sourceDefinitionId: p.sourceDefinitionId, sourceVersion: p.sourceVersion }, store.draft.value);
      if (!r.ok) { setBlocked(r.message); setPlan(null); return null; }
      setPlan(r.plan);
      return r.plan;
    } finally {
      setBusy(null);
    }
  };

  const grant = async (printingId: string): Promise<void> => {
    setBusy('GRANT');
    try {
      const g = await grantCustomCopies(ctx, { printingId, quantity: copies, grantBatchId });
      if (!g.ok) { toast(`Cópias não concedidas: ${g.message} A publicação permanece; repita com o mesmo lote.`, 'error', 7000); return; }
      toast(g.status === 'ALREADY_GRANTED' ? 'Este lote de cópias já tinha sido concedido (nada duplicado).' : `${g.quantity} cópia(s) adicionada(s) a este perfil.`, 'success');
      setGrantBatchId(ctx.platform.newId('grant'));
    } finally {
      setBusy(null);
    }
  };

  const publish = async (andGrant: boolean) => {
    // Sempre prepara sobre o rascunho atual; só reenvia o plano antigo após uma resposta perdida.
    const current = retryPlan ?? (await prepare());
    if (!current) return;
    const ok = await confirmDialog({
      title: `Publicar ${current.definition.name} v${current.version}?`, confirmLabel: 'Publicar',
      body: [
        `${MODE_LABEL[current.mode]}: ${current.createsVersion ? `versão ${current.version}` : 'somente impressões'} com ${current.printings.length} impressão(ões).`,
        'Versões publicadas são imutáveis: corrigir depois cria nova versão ou variante.',
        andGrant ? `Em seguida, ${copies} cópia(s) entram neste perfil (concessão auditável).` : 'Publicar não concede cópias nem altera a campanha padrão.',
      ],
    });
    if (!ok) return;
    setBusy('PUBLISH');
    try {
      const r = await commitPublish(ctx, current);
      if (!r.ok) {
        const lost = r.code === 'SAVE_WRITE_FAILED';
        setRetryPlan(lost ? current : null);
        if (!lost) setPlan(null);
        toast(lost ? `Publicação sem confirmação: ${r.message}. Tente de novo: o mesmo comando recupera o recibo sem duplicar.`
          : `Publicação recusada (${r.code}): ${r.message}. O rascunho continua salvo; revise e publique de novo.`, 'error', 8000);
        return;
      }
      setRetryPlan(null);
      setDone(r);
      setPlan(null);
      if (snap) await refreshCustomCatalog(snap.profile.profileId);
      await store.afterPublish(current.publishedRevision);
      toast(r.status === 'REPLAYED' ? 'Publicação já registrada: recibo recuperado, nada duplicado.' : `${current.definition.name} v${r.version} publicada.`, 'success');
      if (andGrant && r.printingIds[0]) await grant(r.printingIds[0]);
    } finally {
      setBusy(null);
    }
  };

  const eligibility = snap ? (snap.profile.progressionMode === 'STANDARD' ? 'Perfis STANDARD não recebem cópias autorais: use um perfil CUSTOM ou LAB.' : null) : 'Sem perfil.';
  const rules = draft.rules;
  const pokemon = rules.category === 'POKEMON' ? (rules as PokemonCard) : null;
  return (
    <div class="stack">
      <KeyValue items={[
        ['Modo', `${MODE_LABEL[draft.mode]}`],
        ['Nome-base', rules.baseName],
        ['Nome derivado', rules.name],
        ['Chave de limite', rules.deckLimitKey],
        ['Alvo', `${draft.target.definitionId} · v${draft.target.version}`],
        ...(pokemon ? [['HP / regra', `${pokemon.baseHp} PS · ${pokemon.ruleBox === 'NONE' ? 'comum' : pokemon.ruleBox === 'EX' ? 'ex' : 'Mega ex'} · ${pokemon.knockoutPoints} ponto(s)`] as const] : []),
        ['Ataques / Habilidades', `${rules.attacks.length} / ${rules.abilities.length}`],
        ['Impressões', draft.printings.map((p) => `${finishLabel(p.finish)} ${p.collectorNumber}`).join(', ') || '—'],
        ['Assets', `${new Set(draft.printings.flatMap((p) => [p.artAssetId, p.finishSettings.foilMaskAssetId]).filter(Boolean)).size} arquivo(s) local(is)`],
        ['Testes', draft.testScenarios.length ? `${draft.testScenarios.length} cenário(s) obrigatório(s) — PASS no rulesHash atual` : 'Nenhum cenário obrigatório'],
        ['Onde poderá ser usada', 'Perfis CUSTOM e LAB (após conceder cópias); duelos de laboratório. Nunca na campanha STANDARD.'],
      ]} />
      {report.errors ? <p class="field-error"><Icon name="warning" size={14} /> {report.errors} erro(s) bloqueiam a publicação. Veja o relatório ao lado.</p> : null}
      {blocked ? <p class="field-error" role="alert">{blocked}</p> : null}
      {plan ? (
        <section class="studio-section">
          <div class="studio-section-head"><h3>Resumo da publicação</h3></div>
          <KeyValue items={[
            ['Cria', `${plan.createsDefinition ? 'definição CUSTOM + ' : ''}${plan.createsVersion ? `versão ${plan.version} + publicação + head` : 'somente impressões (variante)'}`],
            ['Impressões', plan.printings.map((p) => p.printing.printingId).join(', ')],
            ['Dependências', plan.dependencies.map((d) => `${d.dependencyId} v${d.dependencyVersion} (${d.kind})`).join(', ') || 'nenhuma'],
            ['Testes aprovados', plan.tests.map((t) => t.scenarioId).join(', ') || '—'],
            ['Avisos', String(plan.report.warnings)],
          ]} />
          <h4>Diferenças contra {plan.previous ? `v${plan.previous.version}` : 'nada (carta nova)'}</h4>
          <ul class="studio-diff">{plan.diff.length ? plan.diff.slice(0, 60).map((c, i) => <li key={i} class={`diff-${c.kind.toLowerCase()}`}>{changeText(c)}</li>) : <li>Sem mudanças de regra.</li>}</ul>
        </section>
      ) : null}
      {done ? (
        <p class="studio-ready" role="status"><Icon name="check" size={16} /> Publicada: {done.definitionId} v{done.version}.
          <Button size="sm" variant="ghost" onClick={() => go('S47', { definitionId: done.definitionId, version: done.version })}>Ver release</Button></p>
      ) : null}
      <div class="row">
        <Button onClick={() => void prepare()} loading={busy === 'PREPARE'} icon="eye">Revisar publicação</Button>
        <Button variant="primary" onClick={() => void publish(false)} loading={busy === 'PUBLISH'} disabledReason={report.errors ? 'Corrija os erros antes de publicar' : null} testId="publish-button">Publicar</Button>
        <Button onClick={() => void publish(true)} loading={busy === 'PUBLISH' || busy === 'GRANT'} disabledReason={report.errors ? 'Corrija os erros antes de publicar' : eligibility}>Publicar e adicionar ao perfil</Button>
      </div>
      {!eligibility && done?.printingIds[0] ? (
        <div class="row">
          <NumberField label="Cópias" value={copies} min={1} max={20} onChange={(v) => setCopies(Math.max(1, Math.min(20, v ?? 2)))} />
          <Button loading={busy === 'GRANT'} disabledReason={snap && ctx.content.get().catalog.printings.has(done.printingIds[0]) ? grantEligibility(snap, ctx.content.get(), done.printingIds[0]) : null}
            onClick={() => void grant(done.printingIds[0]!)}>Adicionar {copies} cópia(s)</Button>
        </div>
      ) : null}
      {eligibility ? <small class="muted">{eligibility}</small> : null}
    </div>
  );
}
