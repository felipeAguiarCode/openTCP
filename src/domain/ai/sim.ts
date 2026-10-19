// Primitivas de simulação sobre estados determinizados. Usa o próprio motor (mesmas regras, sem segunda
// implementação): ações vindas de getLegalActions já foram validadas e são aplicadas diretamente.
import type { AiProfile } from '../../content/types.ts';
import { applyValidAction, getLegalActions, validateAction } from '../battle/actions.ts';
import type { Ctx } from '../battle/core.ts';
import type { Action, CatalogLookup, MatchState, PlayerId } from '../battle/types.ts';
import { getPlayerView } from '../battle/views.ts';
import { answerDecision } from './decisions.ts';
import type { EvoIndex } from './cards.ts';

export type Budget = {
  nodes: number;
  readonly maxNodes: number;
  readonly deadline: number;
  readonly clock: () => number;
  exhausted: boolean;
  /** true quando o watchdog (tempo de parede) interrompeu a busca. */
  watchdog: boolean;
};

export function createBudget(maxNodes: number, watchdogMs: number, clock: () => number): Budget {
  return { nodes: 0, maxNodes: Math.max(1, Math.floor(maxNodes)), deadline: clock() + watchdogMs, clock, exhausted: false, watchdog: false };
}

/** Consome um nó; falso quando o orçamento determinístico acabou ou o watchdog disparou. */
export function spend(budget: Budget, limit = budget.maxNodes): boolean {
  if (budget.exhausted) return false;
  if (budget.clock() > budget.deadline) {
    budget.exhausted = true;
    budget.watchdog = true;
    return false;
  }
  if (budget.nodes >= Math.min(limit, budget.maxNodes)) return false;
  budget.nodes += 1;
  if (budget.nodes >= budget.maxNodes) budget.exhausted = true;
  return true;
}

/** Cópia profunda de dados JSON (o estado de partida é serializável: só objetos, arrays e primitivos). */
function deepCopy<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    const out = new Array(value.length);
    for (let i = 0; i < value.length; i += 1) out[i] = deepCopy(value[i]);
    return out as T;
  }
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value)) out[key] = deepCopy((value as Record<string, unknown>)[key]);
  return out as T;
}

/** Campos que o motor só substitui (nunca altera no lugar) e podem ser compartilhados entre cópias. */
const SHARED = new Set(['cards', 'config', 'roleTags', 'rng', 'result']);

/** Cópia profunda do estado para simulação (bem mais barata que structuredClone em estados pequenos). */
export function cloneState(state: MatchState): MatchState {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(state)) {
    const value = (state as unknown as Record<string, unknown>)[key];
    out[key] = SHARED.has(key) ? value : deepCopy(value);
  }
  return out as unknown as MatchState;
}

export function applyUnchecked(state: MatchState, cat: CatalogLookup, action: Action): MatchState | null {
  const ctx: Ctx = { s: cloneState(state), cat, events: [], group: 0, triggerable: [] };
  try {
    applyValidAction(ctx, action);
  } catch {
    return null;
  }
  return ctx.s;
}

export function applyChecked(state: MatchState, cat: CatalogLookup, action: Action): MatchState | null {
  if (!validateAction({ s: state, cat }, action).ok) return null;
  return applyUnchecked(state, cat, action);
}

export type SimPolicies = {
  readonly me: PlayerId;
  readonly mine: AiProfile;
  readonly theirs: AiProfile;
  readonly evo: EvoIndex | null;
};

/** Responde decisões pendentes (de ambos os lados) com as heurísticas, até o motor voltar a esperar ação. */
export function settle(state: MatchState, cat: CatalogLookup, policies: SimPolicies, budget: Budget): MatchState | null {
  let s = state;
  for (let guard = 0; guard < 24; guard += 1) {
    if (s.result || s.pendingDecisions.length === 0) return s;
    const decision = s.pendingDecisions.find((d) => !d.answered);
    if (!decision) return s;
    if (!spend(budget)) return null;
    const view = getPlayerView({ s, cat }, decision.player, false);
    const dv = view.decisions.find((d) => d.decisionId === decision.decisionId);
    if (!dv) return null;
    const profile = decision.player === policies.me ? policies.mine : policies.theirs;
    let selection: string[];
    try {
      selection = answerDecision(view, dv, cat, profile, decision.player === policies.me ? policies.evo : null);
    } catch {
      return null;
    }
    const next = applyChecked(s, cat, { type: 'RESOLVE_DECISION', player: decision.player, decisionId: decision.decisionId, selection });
    if (!next) return null;
    s = next;
  }
  return null;
}

export function legalFor(state: MatchState, cat: CatalogLookup, player: PlayerId): Action[] {
  return getLegalActions({ s: state, cat }, player);
}

export function isOwnMainTurn(state: MatchState, player: PlayerId): boolean {
  return !state.result && state.phase === 'MAIN' && state.currentPlayer === player && state.pendingDecisions.length === 0 && state.queue.length === 0;
}

/**
 * Assinatura barata para transposições dentro de um turno: ordens diferentes que levam ao mesmo campo
 * (mesmo conteúdo, ainda que com IDs de entidade ou posições de Banco trocados) contam uma vez só.
 */
export function signature(state: MatchState): string {
  const parts: string[] = [];
  const key = (cardId: string | null) => (cardId ? state.cards[cardId]?.definitionKey ?? cardId : '');
  for (const p of ['A', 'B'] as const) {
    const ps = state.players[p];
    parts.push(p, String(ps.points), String(ps.deck.length), String(ps.discard.length), [...ps.hand].sort().join(','),
      ps.energyZone.ready ?? '-', ps.flags.supporterUsed ? 'S' : '', ps.flags.retreatUsed ? 'R' : '', ps.flags.manualEnergyUsed ? 'E' : '');
    const describe = (e: NonNullable<typeof ps.active>) => {
      const c = e.conditions;
      return `${e.stack.map(key).join('>')}:${e.damage}:${e.energies.map((x) => x.type).sort().join('')}:${key(e.toolCardId)}:${c.poisoned ? 'p' : ''}${c.burned ? 'b' : ''}${c.control ?? ''}`;
    };
    parts.push(ps.active ? describe(ps.active) : '_');
    parts.push(ps.bench.map((e) => (e ? describe(e) : '_')).sort().join(';'));
  }
  parts.push(state.stadium?.cardId ?? '', String(state.activeEffects.length), String(state.delayedEffects.length));
  return parts.join('|');
}
