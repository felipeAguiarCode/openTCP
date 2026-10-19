// API pública e pura do motor (gameplay §27.2). O estado de entrada nunca é alterado; erros de regra
// retornam códigos de gameplay §30 e erros de conteúdo (ex.: laço de efeitos) não aplicam nada.
import { jcsHash } from '../hash/jcs.ts';
import { createCtx } from './core.ts';
import { applyValidAction, getLegalActions as legal, validateAction as validate } from './actions.ts';
import { getPlayerView as view, redactEvents } from './views.ts';
import type { Action, ApplyResult, CatalogLookup, MatchState, PlayerId, RuleError, Validation } from './types.ts';

export type ApplyOutcome = (ApplyResult & { readonly ok: true }) | (RuleError & { readonly state: MatchState });

export function validateAction(state: MatchState, cat: CatalogLookup, action: Action): Validation {
  return validate({ s: state, cat }, action);
}

export function applyAction(state: MatchState, cat: CatalogLookup, action: Action): ApplyOutcome {
  const v = validate({ s: state, cat }, action);
  if (!v.ok) return { ...v, state };
  const ctx = createCtx(state, cat);
  try {
    applyValidAction(ctx, action);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = message.startsWith('EFFECT_LOOP_DETECTED') ? 'EFFECT_LOOP_DETECTED'
      : message.startsWith('UNKNOWN_OPCODE') ? 'CARD_EFFECT_UNSUPPORTED' : 'ENGINE_ERROR';
    return { ok: false, code, message, state };
  }
  ctx.s.stateVersion = state.stateVersion + 1;
  return { ok: true, state: ctx.s, events: ctx.events };
}

export function getLegalActions(state: MatchState, cat: CatalogLookup, player: PlayerId): Action[] {
  return legal({ s: state, cat }, player);
}

export function getPlayerView(state: MatchState, cat: CatalogLookup, viewer: PlayerId) {
  return view({ s: state, cat }, viewer);
}

export { redactEvents };

/** Hash canônico das regras (estado sem contadores de apresentação) para replays e testes de equivalência (G-074, R-075). */
export function stateHash(state: MatchState): string {
  return jcsHash(state);
}

export function isTerminal(state: MatchState): boolean {
  return state.result !== null;
}
