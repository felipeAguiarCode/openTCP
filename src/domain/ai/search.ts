// Busca do turno (runtime §11.3). STORY: um passo guloso. STANDARD: feixe sobre sequências de ações
// próprias até o fim do turno, avaliando o estado final. EXPERT: o mesmo feixe com mais determinizações e,
// para os melhores candidatos, a checagem da resposta imediata do adversário (ele vence no lance seguinte?).
//
// Toda folha é avaliada no mesmo ponto do jogo: depois que o motor encerra o turno (checkup, expiração
// de efeitos “neste turno”, efeitos atrasados, compra e Energia do adversário). Assim “encerrar agora”
// e “atacar” são comparados de forma consistente.
import type { AiProfile } from '../../content/types.ts';
import type { Action, CatalogLookup, MatchState, PlayerId } from '../battle/types.ts';
import { other } from '../battle/types.ts';
import type { EvoIndex } from './cards.ts';
import { AGGRESSION, attackPotential, attackTempo, evaluate } from './evaluate.ts';
import { isPassiveRetreat, searchCandidates } from './prune.ts';
import {
  applyChecked, applyUnchecked, isOwnMainTurn, legalFor, settle, signature, spend, type Budget, type SimPolicies,
} from './sim.ts';

export type SearchContext = {
  readonly cat: CatalogLookup;
  readonly me: PlayerId;
  readonly profile: AiProfile;
  readonly policies: SimPolicies;
  readonly evo: EvoIndex | null;
  readonly budget: Budget;
};

export type Leaf = {
  readonly value: number;
  readonly state: MatchState;
  /** true: estado já no turno seguinte (ou terminal); false: estado interno (orçamento esgotado no fim). */
  readonly ended: boolean;
};

export type RootValue = { best: number; leaves: Leaf[] };

const LEAVES_PER_ROOT = 2;

function toMoveAfter(state: MatchState, me: PlayerId): PlayerId {
  return state.result ? me : state.currentPlayer;
}

function evalAt(ctx: SearchContext, state: MatchState, toMove: PlayerId): number {
  return evaluate(state, ctx.cat, { me: ctx.me, toMove, weights: ctx.profile.weights, evo: ctx.evo });
}

/** Sem orçamento para encerrar pelo motor: projeta o fim do turno removendo efeitos que expiram agora. */
function projectEndOfTurn(state: MatchState): MatchState {
  const cur = state.currentPlayer;
  const activeEffects = state.activeEffects.filter((e) => !(e.expiry && e.expiry.player === cur && e.expiry.ownTurn <= state.ownTurns[cur]));
  return activeEffects.length === state.activeEffects.length ? state : { ...state, activeEffects };
}

function record(results: Map<number, RootValue>, index: number, leaf: Leaf): void {
  const entry = results.get(index) ?? { best: -Infinity, leaves: [] };
  entry.best = Math.max(entry.best, leaf.value);
  entry.leaves.push(leaf);
  entry.leaves.sort((a, b) => b.value - a.value);
  if (entry.leaves.length > LEAVES_PER_ROOT) entry.leaves.length = LEAVES_PER_ROOT;
  results.set(index, entry);
}

type Child = { readonly state: MatchState; readonly ended: boolean } | null;

function step(ctx: SearchContext, state: MatchState, action: Action, checked: boolean, limit: number): Child | 'BUDGET' {
  if (!spend(ctx.budget, limit)) return 'BUDGET';
  const applied = checked ? applyChecked(state, ctx.cat, action) : applyUnchecked(state, ctx.cat, action);
  if (!applied) return null;
  const settled = settle(applied, ctx.cat, ctx.policies, ctx.budget);
  if (!settled) return null;
  if (isOwnMainTurn(settled, ctx.me)) return { state: settled, ended: false };
  if (!settled.result && settled.pendingDecisions.length > 0) return null;
  return { state: settled, ended: true };
}

/** Bônus de ritmo (agressividade) da folha que termina num ataque; zero para as demais ações. */
function tempo(ctx: SearchContext, before: MatchState, action: Action, after: MatchState): number {
  return action.type === 'ATTACK' ? attackTempo(before, after, ctx.cat, ctx.me, ctx.profile.weights) : 0;
}

/**
 * Folha “encerrar o turno aqui”: aplica END_TURN pelo motor e avalia no início do turno seguinte. Quem recuou
 * neste turno e encerra sem atacar paga a penalidade de agressividade (igual para todas as linhas sem ataque,
 * então só pesa contra atacar ou contra não ter recuado).
 */
function endTurnLeaf(ctx: SearchContext, state: MatchState, limit: number, attacked = false): Leaf {
  const retreatPenalty = !attacked && state.players[ctx.me].flags.retreatUsed ? ctx.profile.weights.aggression * AGGRESSION.retreatNoAttack : 0;
  const ended = step(ctx, state, { type: 'END_TURN', player: ctx.me }, false, limit);
  if (ended && ended !== 'BUDGET' && ended.ended) {
    return { value: evalAt(ctx, ended.state, toMoveAfter(ended.state, ctx.me)) - retreatPenalty, state: ended.state, ended: true };
  }
  return { value: evalAt(ctx, projectEndOfTurn(state), other(ctx.me)) - retreatPenalty, state, ended: false };
}

/**
 * Feixe determinístico sobre o turno: cada nível expande os melhores estados do nível anterior; todo
 * estado interno também gera a folha “encerrar o turno aqui”. Retorna o melhor valor por ação-raiz.
 */
export function searchTurn(ctx: SearchContext, root: MatchState, rootActions: readonly Action[], limit: number): Map<number, RootValue> {
  const { me } = ctx;
  const results = new Map<number, RootValue>();
  const maxDepth = Math.max(1, ctx.profile.budget.maxDepth);
  const share = Math.max(1, limit - ctx.budget.nodes);
  const width = Math.max(2, Math.min(12, Math.round(share / (maxDepth * 12))));
  const seen = new Set<string>([signature(root)]);
  type Node = { state: MatchState; index: number; score: number; order: number };
  let frontier: Node[] = [];
  let order = 0;
  let stop = false;

  const visit = (parent: MatchState, action: Action, index: number, checked: boolean, depth: number) => {
    const child = step(ctx, parent, action, checked, limit);
    if (child === 'BUDGET') { stop = true; return; }
    if (!child) return;
    if (child.ended) {
      record(results, index, { value: evalAt(ctx, child.state, toMoveAfter(child.state, me)) + tempo(ctx, parent, action, child.state), state: child.state, ended: true });
      return;
    }
    const sig = signature(child.state);
    if (seen.has(sig)) return;
    seen.add(sig);
    const leaf = endTurnLeaf(ctx, child.state, limit, action.type === 'ATTACK');
    record(results, index, action.type === 'ATTACK' ? { ...leaf, value: leaf.value + tempo(ctx, parent, action, leaf.state) } : leaf);
    if (depth < maxDepth) {
      frontier.push({ state: child.state, index, score: leaf.value + attackPotential(child.state, ctx.cat, me, ctx.profile.weights), order: order++ });
    }
  };

  rootActions.forEach((action, index) => {
    if (stop || isPassiveRetreat(root, ctx.cat, me, action, rootActions)) return;
    if (action.type === 'END_TURN') {
      record(results, index, endTurnLeaf(ctx, root, limit));
      return;
    }
    visit(root, action, index, true, 1);
  });

  for (let depth = 2; depth <= maxDepth && frontier.length > 0 && !stop; depth += 1) {
    const ranked = [...frontier].sort((a, b) => b.score - a.score || a.order - b.order);
    // Diversidade: nenhuma ação-raiz ocupa mais que metade do feixe.
    const perRoot = new Map<number, number>();
    const cap = Math.max(2, Math.ceil(width / 2));
    const beam: Node[] = [];
    for (const node of ranked) {
      if (beam.length >= width) break;
      const used = perRoot.get(node.index) ?? 0;
      if (used >= cap) continue;
      perRoot.set(node.index, used + 1);
      beam.push(node);
    }
    frontier = [];
    for (const node of beam) {
      if (stop) break;
      const candidates = searchCandidates(node.state, ctx.cat, me, legalFor(node.state, ctx.cat, me), ctx.evo);
      for (const action of candidates) {
        if (stop) break;
        visit(node.state, action, node.index, false, depth);
      }
    }
  }
  return results;
}

/** Linhas curtas do adversário na checagem de resposta: preparo (até dois lances) e então ataque ou fim de turno. */
const REPLY_DEPTH = 3;

function replyCandidates(state: MatchState, cat: CatalogLookup, op: PlayerId, depth: number): Action[] {
  const activeId = state.players[op].active?.entityId;
  const prepare = depth < REPLY_DEPTH - 1;
  return legalFor(state, cat, op).filter((a) => a.type === 'ATTACK' || a.type === 'END_TURN'
    || (prepare && a.type === 'ATTACH_ENERGY' && a.targetEntityId === activeId)
    || (prepare && a.type === 'EVOLVE' && a.targetEntityId === activeId)
    || (prepare && (a.type === 'PLAY_TRAINER' || a.type === 'RETREAT' || a.type === 'USE_ABILITY')));
}

/**
 * EXPERT: depois do turno planejado (a folha), o adversário tem uma resposta imediata que vence a partida
 * (pontos ou campo vazio)? Busca em profundidade nas linhas curtas dele — Treinadores, Recuo, Habilidades,
 * Energia/evolução no Ativo e então ataque ou fim de turno (checkup) — com parada na primeira vitória.
 * Só usa o desfecho objetivo (vitória), não a avaliação heurística, para não trocar boas jogadas por
 * linhas passivas. Retorna null quando o orçamento acaba antes de uma conclusão.
 */
export function replyWins(ctx: SearchContext, leaf: Leaf, limit: number): boolean | null {
  const op = other(ctx.me);
  let state = leaf.state;
  if (!leaf.ended) {
    const ended = step(ctx, state, { type: 'END_TURN', player: ctx.me }, false, limit);
    if (ended === 'BUDGET') return null;
    if (!ended) return false;
    state = ended.state;
  }
  if (state.result) return state.result.winner === op;
  if (!isOwnMainTurn(state, op)) return false;
  const opCtx: SearchContext = { ...ctx, me: op, policies: { me: op, mine: ctx.policies.theirs, theirs: ctx.policies.mine, evo: null } };
  let budgetHit = false;
  const visit = (s: MatchState, depth: number): boolean => {
    for (const action of replyCandidates(s, ctx.cat, op, depth)) {
      const child = step(opCtx, s, action, false, limit);
      if (child === 'BUDGET') { budgetHit = true; return false; }
      if (!child) continue;
      if (child.state.result) {
        if (child.state.result.winner === op) return true;
        continue;
      }
      if (!child.ended && depth + 1 < REPLY_DEPTH && visit(child.state, depth + 1)) return true;
      if (budgetHit) return false;
    }
    return false;
  };
  const wins = visit(state, 0);
  return wins ? true : budgetHit ? null : false;
}

/**
 * STORY: um passo. Desenvolver (ações que melhoram a avaliação de fim de turno) vem antes de atacar ou
 * encerrar; quando nada melhora, compara ataques e encerrar. Uma jogada que tira o ataque do turno (recuar
 * para quem não paga, evoluir para um custo maior) só conta como melhora se superar o melhor ataque.
 * Retorna candidatos em ordem de preferência.
 */
export function rankOnePly(ctx: SearchContext, root: MatchState, rootActions: readonly Action[], limit: number): { index: number; value: number }[] {
  const { me } = ctx;
  const base = endTurnLeaf(ctx, root, limit).value;
  const canAttack = rootActions.some((a) => a.type === 'ATTACK');
  const develop: { index: number; value: number; keepsAttack: boolean }[] = [];
  const finish: { index: number; value: number }[] = [];
  let bestAttack = -Infinity;
  rootActions.forEach((action, index) => {
    if (action.type === 'END_TURN') { finish.push({ index, value: base }); return; }
    if (isPassiveRetreat(root, ctx.cat, me, action, rootActions)) return;
    const child = step(ctx, root, action, true, limit);
    if (child === 'BUDGET' || !child) return;
    if (child.ended) {
      const value = evalAt(ctx, child.state, toMoveAfter(child.state, me)) + tempo(ctx, root, action, child.state);
      if (action.type === 'ATTACK') bestAttack = Math.max(bestAttack, value);
      finish.push({ index, value });
      return;
    }
    const keepsAttack = !canAttack || legalFor(child.state, ctx.cat, me).some((a) => a.type === 'ATTACK');
    develop.push({ index, value: endTurnLeaf(ctx, child.state, limit).value, keepsAttack });
  });
  const byValue = (a: { index: number; value: number }, b: { index: number; value: number }) => b.value - a.value || a.index - b.index;
  const improving = develop.filter((d) => d.value > (d.keepsAttack ? base : Math.max(base, bestAttack)) + 0.5).sort(byValue);
  if (improving.length) return improving;
  return finish.sort(byValue);
}
