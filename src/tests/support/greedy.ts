// Jogador guloso de um passo para testes de integração (não é a IA do produto): avalia cada ação legal
// pelo estado resultante — pontos, Nocautes, dano causado, desenvolvimento — e escolhe a melhor.
import { applyAction, getLegalActions } from '../../domain/battle/engine.ts';
import { isPokemon } from '../../domain/cards/types.ts';
import type { Action, CatalogLookup, MatchState, PlayerId } from '../../domain/battle/types.ts';
import { other } from '../../domain/battle/types.ts';

function sideValue(state: MatchState, cat: CatalogLookup, p: PlayerId): number {
  const pl = state.players[p];
  let v = 0;
  for (const e of [pl.active, ...pl.bench]) {
    if (!e) continue;
    const def = cat.definition(state.cards[e.stack[e.stack.length - 1]!]!.definitionKey);
    const hp = isPokemon(def) ? def.baseHp : 40;
    v += 10 + Math.max(0, hp - e.damage) * 0.3 + e.energies.length * 14 + (e.stack.length - 1) * 18;
  }
  return v;
}

function score(state: MatchState, cat: CatalogLookup, me: PlayerId): number {
  if (state.result) return state.result.winner === me ? 1e6 : state.result.winner ? -1e6 : -1e3;
  const opp = other(me);
  const damageDealt = [state.players[opp].active, ...state.players[opp].bench].reduce((s, e) => s + (e?.damage ?? 0), 0);
  return (state.players[me].points - state.players[opp].points) * 1000 + damageDealt * 1.5 + sideValue(state, cat, me) - sideValue(state, cat, opp) * 0.5;
}

export function greedyAction(state: MatchState, cat: CatalogLookup, me: PlayerId): Action {
  const legal = getLegalActions(state, cat, me);
  if (!legal.length) throw new Error(`sem ação legal para ${me} na fase ${state.phase}`);
  const setup = state.pendingDecisions.find((d) => d.player === me && d.kind === 'SETUP' && !d.answered);
  if (setup) return { type: 'RESOLVE_DECISION', player: me, decisionId: setup.decisionId, selection: setup.options.slice(0, setup.max) };
  let best = legal[0]!;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const action of legal) {
    if (action.type === 'CONCEDE') continue;
    const r = applyAction(state, cat, action);
    if (!r.ok) continue;
    // Empate de avaliação: prefere agir a encerrar o turno.
    const s = score(r.state, cat, me) - (action.type === 'END_TURN' ? 0.5 : 0);
    if (s > bestScore) { bestScore = s; best = action; }
  }
  return best;
}
