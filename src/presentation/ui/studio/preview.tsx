// Coluna direita do S44 (editor-de-cartas.md §22–§24): prévia da carta (HTML 2D com o mesmo template e os
// mesmos dados entregues à prévia Three.js), frente/verso/carta oculta do NPC, inclinação por arraste
// (desligada com movimento reduzido), relatório de validação agrupado por aba com “Ir para o campo” e a
// análise de balanceamento com hipóteses explícitas.
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { GameContext } from '../../../application/context.ts';
import type { CardDefinition, CardPrinting } from '../../../domain/cards/types.ts';
import { analyzeBalance } from '../../../domain/editor/balance.ts';
import { compileRules } from '../../../domain/editor/compile.ts';
import type { EditorDraft } from '../../../domain/editor/draft.ts';
import { estimateTextFit } from '../../../domain/editor/textfit.ts';
import { LEVEL_LABEL, LEVELS, TAB_LABEL, type EditorTab, type ValidationIssue, type ValidationReport } from '../../../domain/editor/validate.ts';
import { CardFace } from '../components/cards.tsx';
import { Button, Segmented } from '../components/controls.tsx';
import { Icon } from '../components/icons.tsx';
import { artOf, safeFace, useAssetUrl } from './shared.tsx';

const DEMOS: readonly { readonly id: string; readonly label: string }[] = [
  { id: 'DRAW', label: 'Comprar da pilha' }, { id: 'REVEAL', label: 'Revelar carta própria' }, { id: 'BENCH', label: 'Entrar no Banco' },
  { id: 'EVOLVE', label: 'Evoluir' }, { id: 'ATTACK', label: 'Ataque e impacto' }, { id: 'ABILITY', label: 'Ativar Habilidade' },
  { id: 'KNOCKOUT', label: 'Receber dano e Nocaute' }, { id: 'PACK', label: 'Revelar em pacote' }, { id: 'NPC_HIDDEN', label: 'Carta oculta do NPC' },
];

function PreviousFace({ ctx, previous, nameOf }: { readonly ctx: GameContext; readonly previous: { readonly rules: CardDefinition; readonly printing: CardPrinting }; readonly nameOf: (key: string) => string | null }): JSX.Element {
  const url = useAssetUrl(ctx, previous.printing.artMode !== 'TEMPLATE_ONLY' ? previous.printing.artAssetId : null);
  return (
    <figure class="studio-compare">
      <CardFace face={safeFace(previous.rules, previous.printing, nameOf)} size="sm" art={artOf(previous.printing, url)} />
      <figcaption class="small muted">Publicada v{previous.rules.version}</figcaption>
    </figure>
  );
}

export function CardPreview({ ctx, draft, printingIndex, reducedMotion, nameOf, previous }: {
  readonly ctx: GameContext; readonly draft: EditorDraft; readonly printingIndex: number; readonly reducedMotion: boolean; readonly nameOf: (key: string) => string | null;
  /** Versão publicada anterior (“Comparar com versão anterior”, §22). */
  readonly previous?: { readonly rules: CardDefinition; readonly printing: CardPrinting } | null;
}): JSX.Element {
  const [view, setView] = useState<'FRONT' | 'BACK' | 'HIDDEN'>('FRONT');
  const [compare, setCompare] = useState(false);
  const [demo, setDemo] = useState<string | null>(null);
  const [demoKey, setDemoKey] = useState(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const printing = draft.printings[printingIndex] ?? draft.printings[0];
  const url = useAssetUrl(ctx, printing?.artMode !== 'TEMPLATE_ONLY' ? printing?.artAssetId ?? null : null);
  let rules: CardDefinition = draft.rules;
  try { rules = compileRules(draft); } catch { /* documento incompleto: mostra o rascunho como está */ }
  const face = safeFace(rules, printing, nameOf);
  const fs = printing?.finishSettings;
  const style = {
    '--finish-intensity': String(fs?.intensity ?? 0),
    '--finish-angle': `${fs?.patternAngleDegrees ?? 35}deg`,
    transform: reducedMotion || view !== 'FRONT' ? undefined : `perspective(900px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)`,
  } as JSX.CSSProperties;
  return (
    <div class="studio-preview" data-testid="studio-preview">
      <div class="studio-preview-stage" onPointerMove={(e) => {
        if (reducedMotion || e.buttons !== 1) return;
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setTilt({ x: ((e.clientX - r.left) / r.width - 0.5) * 16, y: -((e.clientY - r.top) / r.height - 0.5) * 16 });
      }} onPointerLeave={() => setTilt({ x: 0, y: 0 })}>
        <div key={demoKey} class={`studio-preview-card ${reducedMotion ? 'is-static' : ''} ${demo && !reducedMotion ? `demo-${demo.toLowerCase()}` : ''}`} style={style}>
          {demo ? <span class="badge badge-warn studio-demo-badge">Demonstração visual</span> : null}
          {view === 'FRONT' && demo !== 'NPC_HIDDEN'
            ? <CardFace face={face} size="lg" art={artOf(printing, url)} />
            : <CardFace face={null} size="lg" hidden />}
        </div>
        {compare && previous && view === 'FRONT' ? <PreviousFace ctx={ctx} previous={previous} nameOf={nameOf} /> : null}
        {url === 'MISSING' ? <p class="field-error"><Icon name="warning" size={14} /> A arte referenciada não está no armazenamento local.</p> : null}
      </div>
      <div class="row">
        <Segmented label="Vista da prévia" value={view} onChange={setView} options={[{ id: 'FRONT', label: 'Frente' }, { id: 'BACK', label: 'Verso' }, { id: 'HIDDEN', label: 'Carta oculta do NPC' }]} />
        <Button size="sm" variant="ghost" icon="refresh" onClick={() => setTilt({ x: 0, y: 0 })}>Restabelecer</Button>
        {previous ? <Button size="sm" variant="ghost" onClick={() => setCompare(!compare)}>{compare ? 'Ocultar comparação' : 'Comparar com versão anterior'}</Button> : null}
      </div>
      <details class="studio-demo">
        <summary>Ver no jogo (prévia de animação)</summary>
        <div class="row">
          {DEMOS.map((d) => (
            <Button key={d.id} size="sm" variant="ghost" onClick={() => { setDemo(d.id); setDemoKey((k) => k + 1); }}>{d.label}</Button>
          ))}
          {demo ? <Button size="sm" variant="ghost" onClick={() => setDemo(null)}>Parar</Button> : null}
        </div>
        <small class="muted">Só apresentação: não altera inventário, não consome pacote, não concede campanha e não executa o ataque de novo. {reducedMotion ? 'Movimento reduzido: trajetórias amplas desligadas.' : ''}</small>
      </details>
      <small class="muted">
        {view === 'HIDDEN' ? 'Carta oculta: só o verso uniforme, sem foil, brilho de borda ou som que revele a impressão.'
          : 'Prévia 2D (HTML) do template pocket-light-card-v1; a cena 3D usa os mesmos dados de impressão e acabamento. Arraste para inclinar.'}
      </small>
    </div>
  );
}

export function TextFitPanel({ draft, printingIndex, nameOf }: { readonly draft: EditorDraft; readonly printingIndex: number; readonly nameOf: (key: string) => string | null }): JSX.Element | null {
  let rules: CardDefinition = draft.rules;
  try { rules = compileRules(draft); } catch { return null; }
  const face = safeFace(rules, draft.printings[printingIndex] ?? draft.printings[0], nameOf);
  if (!face) return null;
  const fit = estimateTextFit(face);
  return (
    <div class="studio-fit" aria-label="Ocupação do texto da carta">
      <div class="row-between"><span>Corpo da carta</span><b class={fit.bodyOverflow ? 'is-bad' : ''}>{fit.bodyLines} / {fit.bodyCapacity} linhas</b></div>
      <div class="progress" role="progressbar" aria-valuemin={0} aria-valuemax={fit.bodyCapacity} aria-valuenow={fit.bodyLines} aria-label="Linhas usadas">
        <span style={{ width: `${Math.min(100, (fit.bodyLines / fit.bodyCapacity) * 100)}%`, background: fit.bodyOverflow ? 'var(--pocket-danger)' : undefined }} />
      </div>
    </div>
  );
}

function groupIssues(report: ValidationReport): [EditorTab, ValidationIssue[]][] {
  const map = new Map<EditorTab, ValidationIssue[]>();
  for (const i of report.issues) {
    if (i.severity === 'INFO') continue;
    map.set(i.tab, [...(map.get(i.tab) ?? []), i]);
  }
  return [...map.entries()];
}

export function ValidationPanel({ report, onGo, compact }: { readonly report: ValidationReport; readonly onGo: (issue: ValidationIssue) => void; readonly compact?: boolean }): JSX.Element {
  const groups = groupIssues(report);
  const infos = report.issues.filter((i) => i.severity === 'INFO');
  return (
    <div class="studio-report" aria-live="polite">
      <div class="row studio-report-summary">
        <span class={`badge ${report.errors ? 'badge-danger' : 'badge-done'}`}>{report.errors ? `${report.errors} erro(s)` : 'Sem erros'}</span>
        <span class={`badge ${report.warnings ? 'badge-warn' : ''}`}>{report.warnings} aviso(s)</span>
        {!compact ? LEVELS.map((l) => <span key={l} class="small muted">{LEVEL_LABEL[l]}: {report.byLevel[l].errors}/{report.byLevel[l].warnings}</span>) : null}
      </div>
      {report.errors === 0 ? <p class="studio-ready"><Icon name="check" size={16} /> Pronto para publicar (validação completa sem erros).</p> : null}
      {groups.map(([tab, issues]) => (
        <section key={tab} class="studio-report-group">
          <h4>{TAB_LABEL[tab]}</h4>
          <ul>
            {issues.map((i, k) => (
              <li key={`${i.code}-${k}`} class={`studio-issue sev-${i.severity.toLowerCase()}`}>
                <Icon name={i.severity === 'ERROR' ? 'warning' : 'info'} size={16} />
                <div class="grow">
                  <p>{i.message}</p>
                  <small class="muted">{i.code} · {LEVEL_LABEL[i.level]}</small>
                </div>
                <Button size="sm" variant="ghost" onClick={() => onGo(i)}>Ir para o campo</Button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {!compact && infos.length ? (
        <details><summary>{infos.length} observação(ões)</summary><ul class="studio-infos">{infos.map((i, k) => <li key={k}>{i.message}</li>)}</ul></details>
      ) : null}
    </div>
  );
}

export function BalancePanel({ rules, catalog }: { readonly rules: CardDefinition; readonly catalog: readonly CardDefinition[] }): JSX.Element {
  let report: ReturnType<typeof analyzeBalance> | null = null;
  try { report = analyzeBalance(rules, catalog); } catch { report = null; }
  if (!report) return <p class="muted">Análise indisponível para este rascunho.</p>;
  return (
    <div class="stack studio-balance">
      {report.attacks.map((a) => (
        <div key={a.attackId}>
          <strong>{a.name}</strong>
          <p class="small">{a.distribution ? a.distribution.map((d) => `${d.value} (${Math.round(d.probability * 100)}%)`).join(' · ') : 'sem hipótese definida'}
            {a.expected !== null ? ` — esperado ${Math.round(a.expected)}` : ''}{a.perEnergy !== null ? ` · ${a.perEnergy.toFixed(1)} por Energia` : ''}</p>
          <small class="muted">{a.method}</small>
        </div>
      ))}
      {report.comparison ? (
        <p class="small">Catálogo local ({report.comparison.group}, {report.comparison.sampleSize} cartas): HP mediano {report.comparison.medianHp ?? '—'}
          {report.comparison.hpPercentile !== null ? ` · esta carta no percentil ${report.comparison.hpPercentile}` : ''}.</p>
      ) : null}
      <details><summary>Hipóteses e o que foi ignorado</summary>
        <ul class="small">{report.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
        <p class="small muted">Ignorado: {report.ignored.join('; ')}.</p>
        <p class="small muted">“Passou” e estas estimativas não provam balanceamento global; não há “força %”.</p>
      </details>
    </div>
  );
}
