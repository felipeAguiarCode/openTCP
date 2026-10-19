// Planejador puro da IA (gameplay §25.2–§25.5). Entrada: apenas o AiJob (observação autorizada, lista do
// próprio deck, cartas adversárias já vistas e aiRng) e o catálogo. Saída: uma ação legal na observação.
import type { AiJob, AiResult } from '../../application/ports/ai.ts';
import type { AiProfile } from '../../content/types.ts';
import type { Action, PlayerId } from '../battle/types.ts';
import type { BattleView, DecisionView } from '../battle/views.ts';
import { uniformInt, type RngState } from '../random/rng.ts';
import { buildEvoIndex } from './cards.ts';
import { answerDecision } from './decisions.ts';
import { actionKey, alignWithObservation, determinize, type PlannerCatalog } from './determinize.ts';
import { OPPONENT_MODEL } from './profiles.ts';
import { rankOnePly, replyWins, searchTurn, type RootValue, type SearchContext } from './search.ts';
import { createBudget, type Budget } from './sim.ts';

export type PlanInput = {
  readonly job: AiJob;
  readonly catalog: PlannerCatalog;
  /** Relógio só para o watchdog (padrão Date.now); o orçamento que decide é a contagem de nós. */
  readonly clock?: () => number;
};

export const AI_CONTENT_ERROR = 'AI_NO_LEGAL_ACTION';

function contentError(message: string): Error {
  const error = new Error(`${AI_CONTENT_ERROR}: ${message}`);
  error.name = 'AiContentError';
  (error as Error & { code: string }).code = AI_CONTENT_ERROR;
  return error;
}

export function isAiContentError(error: unknown): boolean {
  return error instanceof Error && (error as Error & { code?: string }).code === AI_CONTENT_ERROR;
}

type Outcome = { readonly action: Action; readonly rng: RngState; readonly nodes: number };

function pendingFor(view: BattleView, me: PlayerId): DecisionView | undefined {
  return view.decisions.find((d) => d.player === me && !d.answered);
}

/** Ação aceita pela observação: presente nas ações legais ou resposta válida a uma decisão própria. */
export function isLegalInObservation(view: BattleView, action: Action): boolean {
  if (action.type === 'RESOLVE_DECISION') {
    const d = view.decisions.find((x) => x.decisionId === action.decisionId);
    if (!d || d.answered || d.player !== view.viewer || action.player !== view.viewer || !d.options) return false;
    const sel = action.selection;
    if (new Set(sel).size !== sel.length || sel.some((id) => !d.options!.includes(id))) return false;
    if (d.kind === 'SETUP') return sel.length >= 1 && sel.length <= 1 + (view.sides[view.viewer].bench.length || 3);
    if (d.kind === 'ORDER_TOP') return sel.length === d.options.length;
    return sel.length >= d.min && sel.length <= d.max;
  }
  const key = actionKey(action);
  return view.legalActions.some((a) => actionKey(a) === key);
}

export function fallbackAction(view: BattleView): Action {
  const legal = view.legalActions;
  const end = legal.find((a) => a.type === 'END_TURN');
  const first = end ?? legal.find((a) => a.type !== 'CONCEDE') ?? legal[0];
  if (!first) throw contentError(`nenhuma ação legal para ${view.viewer} (fase ${view.phase})`);
  return first;
}

function chance(rng: RngState, p: number): { value: boolean; rng: RngState } {
  if (p <= 0) return { value: false, rng };
  const r = uniformInt(rng, 1_000_000);
  return { value: r.value < Math.round(p * 1_000_000), rng: r.rng };
}

/** Ações passivas: o erro tolerado nunca as escolhe no lugar da melhor (encerrar cedo, deixar de atacar, recuar). */
const PASSIVE: ReadonlySet<Action['type']> = new Set(['END_TURN', 'RETREAT']);

/**
 * Tolerância a escolhas subótimas: com `suboptimalChance`, sorteia entre as `candidatePoolTop` melhores —
 * a melhor e as seguintes que não sejam passivas. O erro muda a ordem ou a escolha da jogada, não a agressividade.
 */
function applyTolerance(ranked: readonly number[], roots: readonly Action[], profile: AiProfile, rng: RngState): { value: number; rng: RngState } {
  const best = ranked[0]!;
  const pool = [best, ...ranked.slice(1).filter((index) => !PASSIVE.has(roots[index]!.type))].slice(0, Math.max(1, profile.tolerance.candidatePoolTop));
  if (pool.length <= 1) return { value: best, rng };
  const roll = chance(rng, profile.tolerance.suboptimalChance);
  if (!roll.value) return { value: best, rng: roll.rng };
  const pick = uniformInt(roll.rng, pool.length);
  return { value: pool[pick.value]!, rng: pick.rng };
}

function planDecision(job: AiJob, catalog: PlannerCatalog, d: DecisionView): Outcome {
  const evo = buildEvoIndex(catalog, job.knowledge.ownDeckList);
  const selection = answerDecision(job.observation, d, catalog, job.aiProfile, evo);
  return { action: { type: 'RESOLVE_DECISION', player: d.player, decisionId: d.decisionId, selection }, rng: job.aiRng, nodes: 0 };
}

/** Candidatos (melhores pelo valor de fim de turno) submetidos à checagem da resposta do adversário no EXPERT. */
const REPLY_CANDIDATES = 4;

/**
 * EXPERT: para os melhores candidatos, verifica em cada determinização se o adversário vence com a
 * resposta imediata. Candidatos que entregam a partida em menos determinizações vêm primeiro; entre
 * iguais, vale o ranking do fim de turno. Sem orçamento para concluir todas as checagens, mantém o ranking.
 */
function refineWithReplies(ranked: readonly number[], top: readonly number[], perDet: readonly Map<number, RootValue>[], contexts: readonly SearchContext[], budget: Budget): number[] {
  const checks: { det: number; index: number }[] = [];
  perDet.forEach((results, det) => { for (const index of top) if (results.get(index)?.leaves.length) checks.push({ det, index }); });
  const losses = new Map<number, number>(top.map((index) => [index, 0]));
  for (const [i, check] of checks.entries()) {
    const leaf = perDet[check.det]!.get(check.index)!.leaves[0]!;
    const limit = budget.nodes + Math.max(1, Math.floor((budget.maxNodes - budget.nodes) / (checks.length - i)));
    const wins = replyWins(contexts[check.det]!, leaf, limit);
    if (wins === null) return [...ranked];
    if (wins) losses.set(check.index, losses.get(check.index)! + 1);
  }
  if (losses.get(top[0]!) === 0) return [...ranked];
  const safer = [...top].sort((a, b) => losses.get(a)! - losses.get(b)! || top.indexOf(a) - top.indexOf(b));
  return [...safer, ...ranked.filter((index) => !top.includes(index))];
}

function planMain(job: AiJob, catalog: PlannerCatalog, clock: () => number): Outcome {
  const view = job.observation;
  const me = view.viewer;
  const profile = job.aiProfile;
  const roots = view.legalActions.filter((a) => a.type !== 'RESOLVE_DECISION' && a.type !== 'CONCEDE');
  if (roots.length === 0) return { action: fallbackAction(view), rng: job.aiRng, nodes: 0 };
  if (roots.length === 1) return { action: roots[0]!, rng: job.aiRng, nodes: 0 };

  const policy = profile.policy;
  const evo = buildEvoIndex(catalog, job.knowledge.ownDeckList);
  const budget = createBudget(profile.budget.maxNodes, profile.budget.watchdogMs, clock);
  const dets = policy === 'STORY' ? 1 : Math.max(1, Math.floor(profile.budget.determinizations));
  const searchShare = policy === 'EXPERT' ? 0.6 : 1;
  let rng = job.aiRng;
  const perDet: Map<number, RootValue>[] = [];
  const contexts: SearchContext[] = [];
  let storyRanking: { index: number; value: number }[] | null = null;

  for (let i = 0; i < dets && !budget.exhausted; i += 1) {
    const det = determinize(view, job.knowledge, catalog, rng);
    rng = det.rng;
    alignWithObservation(det.state, view, catalog);
    const ctx: SearchContext = {
      cat: catalog, me, profile, evo, budget,
      policies: { me, mine: profile, theirs: { ...OPPONENT_MODEL }, evo },
    };
    contexts.push(ctx);
    const remaining = budget.maxNodes - budget.nodes;
    const limit = budget.nodes + Math.max(1, Math.floor((remaining * searchShare) / (dets - i)));
    if (policy === 'STORY') {
      storyRanking = rankOnePly(ctx, det.state, roots, budget.maxNodes);
      break;
    }
    perDet.push(searchTurn(ctx, det.state, roots, limit));
  }

  let ranked: number[];
  if (policy === 'STORY') {
    ranked = (storyRanking ?? []).map((x) => x.index);
  } else {
    const average = (values: Map<number, RootValue>[], pick: (v: RootValue) => number | null) => {
      const out: { index: number; value: number }[] = [];
      roots.forEach((_, index) => {
        const list = values.map((m) => m.get(index)).filter((v): v is RootValue => !!v).map(pick).filter((v): v is number => v !== null && Number.isFinite(v));
        if (list.length) out.push({ index, value: list.reduce((a, b) => a + b, 0) / list.length });
      });
      return out.sort((a, b) => b.value - a.value || a.index - b.index);
    };
    const staticRank = average(perDet, (v) => v.best);
    ranked = staticRank.map((x) => x.index);
    if (policy === 'EXPERT' && staticRank.length > 1) {
      ranked = refineWithReplies(ranked, staticRank.slice(0, REPLY_CANDIDATES).map((x) => x.index), perDet, contexts, budget);
    }
  }
  if (ranked.length === 0) return { action: fallbackAction(view), rng, nodes: budget.nodes };
  const choice = applyTolerance(ranked, roots, profile, rng);
  return { action: roots[choice.value]!, rng: choice.rng, nodes: budget.nodes };
}

/**
 * Escolhe a próxima ação da IA. Pura e determinística para o mesmo job (orçamento por nós); o watchdog só
 * interrompe buscas descontroladas. Qualquer falha interna cai no fallback legal (END_TURN quando houver);
 * ausência de ação legal numa decisão obrigatória é erro de conteúdo e é lançada.
 */
export function planAction(input: PlanInput): AiResult {
  const { job, catalog } = input;
  const clock = input.clock ?? (() => Date.now());
  const view = job.observation;
  const me = view.viewer;
  const base = { jobId: job.jobId, attemptId: job.attemptId, stateRevision: job.stateRevision, writerEpoch: job.writerEpoch };
  const pending = pendingFor(view, me);
  if (view.legalActions.length === 0) {
    if (pending) throw contentError(`decisão obrigatória ${pending.kind} (${pending.decisionId}, ${pending.reason}) sem resposta legal para ${me}`);
    throw contentError(`nenhuma ação legal para ${me} (fase ${view.phase}, turno de ${view.currentPlayer})`);
  }
  try {
    const outcome = pending ? planDecision(job, catalog, pending) : planMain(job, catalog, clock);
    if (!isLegalInObservation(view, outcome.action)) throw new Error('ação planejada fora da observação');
    return { ...base, action: outcome.action, aiRng: outcome.rng, nodesExplored: outcome.nodes, fallback: false };
  } catch (error) {
    if (isAiContentError(error)) throw error;
    const legalAnswer = pending ? view.legalActions.find((a) => a.type === 'RESOLVE_DECISION' && a.decisionId === pending.decisionId) : undefined;
    return { ...base, action: legalAnswer ?? fallbackAction(view), aiRng: job.aiRng, nodesExplored: 0, fallback: true };
  }
}

