// S45 — Laboratório da carta (editor-de-cartas.md §25): cenários explícitos contra o MESMO motor dos duelos,
// moedas forçadas rotuladas, sem recompensas e sem partida persistida (“Laboratório — não salvo”). Cada
// execução vira linha append-only de card_test_runs ligada à revisão salva e ao rulesHash; aprovação antiga
// aparece como desatualizada quando as regras mudam (ED-056). O relatório mostra eventos em texto.
import type { JSX } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { GameContext } from '../../../application/context.ts';
import { alignDraftTarget, listTestRuns, loadProject, runProjectScenario, saveRevision, type ProjectState } from '../../../application/studio.ts';
import type { PlayerId } from '../../../domain/battle/types.ts';
import { compileDraft } from '../../../domain/editor/compile.ts';
import { defaultScenarios, isRunCurrent, LAB_FIXTURES, LAB_RUNNER_VERSION, type LabResult } from '../../../domain/editor/lab.ts';
import { uniqueId, type ScenarioExpect, type ScenarioKind, type TestScenario } from '../../../domain/editor/draft.ts';
import type { QueryResultMap } from '../../../application/ports/storage.ts';
import { describeEvents } from '../battle/log.ts';
import { go } from '../app/router.ts';
import { requireCtx, toast } from '../app/store.ts';
import { Button, EmptyState, ErrorState, PageHeader, Panel, Skeleton } from '../components/controls.tsx';
import { Icon } from '../components/icons.tsx';
import { CheckField, NumberField, SelectField, TextField } from './shared.tsx';

type Runs = QueryResultMap['LIST_TEST_RUNS'];

function RunReport({ result, current }: { readonly result: LabResult; readonly current: boolean }): JSX.Element {
  const names = result.names ?? {};
  const lines = describeEvents(result.events as never, {
    card: (id) => (id ? names[id] ?? 'carta' : 'carta'),
    entity: (id) => (id ? names[id] ?? 'Pokémon' : 'Pokémon'),
    player: (p: PlayerId | null | undefined) => (p === 'A' ? 'Você' : p === 'B' ? 'Oponente de teste' : '—'),
  });
  return (
    <div class="stack studio-run">
      <div class="row">
        <span class={`badge ${result.outcome === 'PASS' ? 'badge-done' : result.outcome === 'FAIL' ? 'badge-danger' : 'badge-warn'}`}>{result.outcome === 'PASS' ? 'Passou' : result.outcome === 'FAIL' ? 'Falhou' : 'Erro'}</span>
        {!current ? <span class="badge badge-locked" title="As regras mudaram depois desta execução.">Desatualizado (rulesHash diferente)</span> : null}
        <span class="small muted">Cenário {result.scenarioId} · {LAB_FIXTURES.find((f) => f.id === result.fixture)?.label ?? result.fixture}</span>
      </div>
      <dl class="kv small">
        <dt>Ação</dt><dd>{result.action}</dd>
        <dt>Motor</dt><dd>{result.engineVersion} · {result.runnerVersion}</dd>
        <dt>rulesHash</dt><dd title={result.rulesHash}>{result.rulesHash.slice(0, 16)}…</dd>
        <dt>Obtido</dt><dd>{result.legal ? 'legal' : `recusado (${result.errorCode ?? '—'})`} · dano-base {result.baseDamage} · dano final {result.finalDamage} · {result.knockout ? 'Nocaute' : 'sem Nocaute'} · {result.pointsGranted} ponto(s)</dd>
        <dt>Moedas</dt><dd>{result.coins.length ? result.coins.map((c) => (c === 'HEADS' ? 'cara' : 'coroa')).join(', ') : '—'}{result.forcedCoinsUsed ? ` · ${result.forcedCoinsUsed} forçada(s) (moedas de teste)` : ''}</dd>
      </dl>
      {result.diffs.length ? <ul class="studio-diff">{result.diffs.map((d) => <li key={d.field} class="diff-changed">{d.field}: esperado {String(d.expected)} · obtido {String(d.actual)}</li>)}</ul> : null}
      {result.message ? <p class="field-error">{result.message}</p> : null}
      {result.notes.length ? <ul class="small muted">{result.notes.map((n, i) => <li key={i}>{n}</li>)}</ul> : null}
      <details open={result.outcome !== 'PASS'}>
        <summary>Eventos ({lines.length})</summary>
        <ol class="studio-events">{lines.map((l) => <li key={l.seq} class={`tone-${l.tone}`}>{l.text}</li>)}</ol>
      </details>
    </div>
  );
}

function ScenarioBuilder({ project, initialAttack, onRun, busy }: {
  readonly project: ProjectState; readonly initialAttack: string | null; readonly onRun: (s: TestScenario, save: boolean) => void; readonly busy: boolean;
}): JSX.Element {
  const rules = project.draft.rules;
  const [kind, setKind] = useState<ScenarioKind>(rules.category === 'TRAINER' ? 'TRAINER' : 'ATTACK');
  const [attackId, setAttackId] = useState(initialAttack ?? rules.attacks[0]?.id ?? '');
  const [abilityId, setAbilityId] = useState(rules.abilities[0]?.id ?? '');
  const [fixture, setFixture] = useState('default');
  const [coins, setCoins] = useState<('HEADS' | 'TAILS')[]>([]);
  const [expect, setExpect] = useState<ScenarioExpect>({});
  const [id, setId] = useState('');
  const setE = (k: keyof ScenarioExpect, v: unknown) => setExpect((e) => { const next = { ...e, [k]: v } as Record<string, unknown>; if (v === undefined || v === '' || v === null) delete next[k]; return next as ScenarioExpect; });
  const scenario = (): TestScenario => ({
    id: id.trim() || uniqueId(`${kind.toLowerCase()}-${attackId || abilityId || 'teste'}`, project.draft.testScenarios.map((s) => s.id), 64),
    kind, ...(kind === 'ATTACK' || kind === 'PERSISTENCE' ? { attackId } : {}), ...(kind === 'ABILITY' ? { abilityId } : {}), fixture, forcedCoins: coins, expect,
  });
  return (
    <Panel title="Cenário">
      <div class="stack">
        <SelectField label="Tipo de teste" value={kind} onChange={setKind} options={[
          { value: 'ATTACK', label: 'Ataque' }, { value: 'ABILITY', label: 'Habilidade' }, { value: 'TRAINER', label: 'Treinador' }, { value: 'KNOCKOUT', label: 'Nocaute desta carta' }, { value: 'PERSISTENCE', label: 'Salvar/retomar' },
        ]} />
        {kind === 'ATTACK' || kind === 'PERSISTENCE' ? <SelectField label="Ataque" value={attackId} options={rules.attacks.map((a) => ({ value: a.id, label: a.name }))} onChange={setAttackId} /> : null}
        {kind === 'ABILITY' ? <SelectField label="Habilidade" value={abilityId} options={rules.abilities.map((a) => ({ value: a.id, label: a.name }))} onChange={setAbilityId} /> : null}
        <SelectField label="Estado inicial (fixture)" value={fixture} options={LAB_FIXTURES.map((f) => ({ value: f.id, label: f.label }))} onChange={setFixture}
          hint={LAB_FIXTURES.find((f) => f.id === fixture)?.hint} />
        <div class="sf">
          <span class="sf-label">Moedas forçadas (moedas de teste, nunca usadas na campanha)</span>
          <div class="row">
            {coins.map((c, i) => <button key={i} type="button" class="chip is-active" aria-label={`Remover moeda ${i + 1}`} onClick={() => setCoins(coins.filter((_, k) => k !== i))}>{c === 'HEADS' ? 'Cara' : 'Coroa'} ×</button>)}
            <Button size="sm" icon="plus" disabledReason={coins.length >= 20 ? 'Até 20 moedas' : null} onClick={() => setCoins([...coins, 'HEADS'])}>Cara</Button>
            <Button size="sm" icon="plus" disabledReason={coins.length >= 20 ? 'Até 20 moedas' : null} onClick={() => setCoins([...coins, 'TAILS'])}>Coroa</Button>
          </div>
        </div>
        <fieldset class="studio-subform">
          <legend class="sf-label">Expectativas (opcionais)</legend>
          <div class="studio-grid-2">
            <NumberField label="Dano-base" value={expect.baseDamage ?? null} allowEmpty min={0} onChange={(v) => setE('baseDamage', v ?? undefined)} />
            <NumberField label="Dano final" value={expect.finalDamage ?? null} allowEmpty min={0} onChange={(v) => setE('finalDamage', v ?? undefined)} />
            <NumberField label="Pontos concedidos" value={expect.pointsGranted ?? null} allowEmpty min={0} max={3} onChange={(v) => setE('pointsGranted', v ?? undefined)} />
            <SelectField label="Ação legal?" value={expect.legal === undefined ? '' : expect.legal ? 'YES' : 'NO'} options={[{ value: 'YES', label: 'Sim' }, { value: 'NO', label: 'Não' }]} onChange={(v) => setE('legal', v === 'YES')} />
            <TextField label="Código de erro" value={expect.errorCode ?? ''} onChange={(v) => setE('errorCode', v.trim() || undefined)} placeholder="INSUFFICIENT_ENERGY" />
          </div>
          <CheckField label="Espera Nocaute" checked={expect.knockout === true} onChange={(v) => setE('knockout', v ? true : undefined)} />
        </fieldset>
        <TextField label="ID do cenário" value={id} onChange={setId} max={64} placeholder="gerado automaticamente" />
        <div class="row">
          <Button variant="primary" icon="play" loading={busy} onClick={() => onRun(scenario(), false)} testId="lab-run">Executar</Button>
          <Button loading={busy} onClick={() => onRun(scenario(), true)}>Executar e guardar no rascunho</Button>
        </div>
      </div>
    </Panel>
  );
}

export function StudioLab({ projectId, attack }: { readonly projectId: string; readonly attack: string | null }): JSX.Element {
  const ctx: GameContext = requireCtx();
  const [project, setProject] = useState<ProjectState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<Runs>([]);
  const [last, setLast] = useState<LabResult | null>(null);
  const [busy, setBusy] = useState(false);
  const reload = async () => {
    const loaded = await loadProject(ctx, projectId);
    if (!loaded.ok) { setError(loaded.message); return; }
    let p = loaded;
    // O teste roda sobre a próxima versão a publicar e numa revisão salva (o laboratório força o autosave).
    const aligned = alignDraftTarget(ctx.content.get(), p.draft);
    if (aligned !== p.draft) {
      const saved = await saveRevision(ctx, p, aligned, 'AUTO');
      if (saved.ok) p = { ...p, draft: aligned, headRevision: saved.revision, revision: saved.revision };
    }
    setProject(p);
    setRuns(await listTestRuns(ctx, projectId));
  };
  useEffect(() => { void reload(); }, [projectId]);
  const rulesHash = useMemo(() => { try { return project ? compileDraft(project.draft).rulesHash : ''; } catch { return ''; } }, [project]);
  if (error) return <ErrorState title="Projeto indisponível" text={error} />;
  if (!project) return <Skeleton lines={8} />;

  const run = async (scenario: TestScenario, save: boolean) => {
    setBusy(true);
    try {
      let current = project;
      if (save) {
        const draft = { ...current.draft, testScenarios: [...current.draft.testScenarios.filter((s) => s.id !== scenario.id), scenario] };
        const saved = await saveRevision(ctx, current, draft, 'MANUAL');
        if (!saved.ok) { toast(saved.message, 'error'); return; }
        current = { ...current, draft, headRevision: saved.revision, revision: saved.revision };
        setProject(current);
      }
      const r = await runProjectScenario(ctx, projectId, current.headRevision, current.draft, scenario);
      if (!r.ok) { toast(r.message, 'error'); return; }
      setLast(r.result);
      setRuns(await listTestRuns(ctx, projectId));
    } finally {
      setBusy(false);
    }
  };
  const runAll = async () => {
    setBusy(true);
    try {
      let draft = project.draft;
      let head = project.headRevision;
      if (!draft.testScenarios.length) {
        draft = { ...draft, testScenarios: defaultScenarios(draft.rules) };
        const saved = await saveRevision(ctx, project, draft, 'MANUAL');
        if (!saved.ok) { toast(saved.message, 'error'); return; }
        head = saved.revision;
        setProject({ ...project, draft, headRevision: head, revision: head });
      }
      let pass = 0;
      for (const s of draft.testScenarios) {
        const r = await runProjectScenario(ctx, projectId, head, draft, s);
        if (r.ok) { setLast(r.result); if (r.result.outcome === 'PASS') pass += 1; }
      }
      toast(`${pass}/${draft.testScenarios.length} cenário(s) passaram. “Passou” vale para o cenário, não prova balanceamento.`, pass === draft.testScenarios.length ? 'success' : 'warning', 6000);
      setRuns(await listTestRuns(ctx, projectId));
    } finally {
      setBusy(false);
    }
  };
  const latestByScenario = new Map<string, Runs[number]>();
  for (const r of runs) latestByScenario.set(String((r.scenario as { id?: string } | null)?.id ?? r.runId), r);
  return (
    <div class="studio-lab">
      <PageHeader title={`Laboratório — ${project.draft.rules.name || project.title}`} backTo={`/card-studio/projects/${encodeURIComponent(projectId)}`}
        subtitle="Mesmo motor dos duelos, cenário explícito, sem recompensas. Duelo de laboratório com rascunho não é salvo."
        actions={(
          <>
            <span class="badge badge-warn"><Icon name="flag" size={14} /> Laboratório — não salvo</span>
            <Button icon="play" loading={busy} onClick={() => void runAll()}>Executar todos os cenários</Button>
            <Button variant="ghost" onClick={() => go('S44', { projectId })}>Voltar ao editor</Button>
          </>
        )} />
      <p class="small muted">Revisão testada: {project.headRevision} · rulesHash {rulesHash.slice(0, 16)}… · {LAB_RUNNER_VERSION}</p>
      <div class="studio-lab-grid">
        <ScenarioBuilder project={project} initialAttack={attack} onRun={(s, save) => void run(s, save)} busy={busy} />
        <div class="stack">
          <Panel title="Último resultado">{last ? <RunReport result={last} current={isRunCurrent(last, rulesHash)} /> : <EmptyState title="Nenhuma execução nesta sessão" text="Escolha um cenário e execute." />}</Panel>
          <Panel title="Cenários do rascunho">
            {project.draft.testScenarios.length ? (
              <ul class="list">
                {project.draft.testScenarios.map((s) => {
                  const r = latestByScenario.get(s.id);
                  const current = r ? r.rulesHash === rulesHash : false;
                  return (
                    <li key={s.id} class="list-row">
                      <div class="grow"><strong>{s.id}</strong><p class="small muted">{s.kind} · {LAB_FIXTURES.find((f) => f.id === s.fixture)?.label ?? s.fixture}</p></div>
                      {r ? <span class={`badge ${r.outcome === 'PASS' && current ? 'badge-done' : r.outcome === 'PASS' ? 'badge-locked' : 'badge-danger'}`}>{r.outcome}{current ? '' : ' · desatualizado'}</span> : <span class="badge">Não executado</span>}
                      <Button size="sm" loading={busy} onClick={() => void run(s, false)}>Executar</Button>
                    </li>
                  );
                })}
              </ul>
            ) : <EmptyState title="Sem cenários" text="“Executar todos” gera os cenários-padrão (uso mínimo, Energia insuficiente, Fraqueza, Nocaute, retomada)." />}
          </Panel>
          <Panel title={`Histórico (${runs.length})`}>
            <ul class="list">
              {[...runs].reverse().slice(0, 30).map((r) => (
                <li key={r.runId} class="list-row">
                  <span class={`badge ${r.outcome === 'PASS' ? 'badge-done' : 'badge-danger'}`}>{r.outcome}</span>
                  <span class="grow small">{String((r.scenario as { id?: string } | null)?.id ?? r.runId)} · revisão {r.revision}{r.rulesHash !== rulesHash ? ' · regras antigas' : ''}</span>
                  <Button size="sm" variant="ghost" onClick={() => setLast(r.result as unknown as LabResult)}>Ver</Button>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
