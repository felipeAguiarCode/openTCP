// Simulação de balanceamento (opcional, fora do gate do build): bot guloso de um passo para os dois lados.
// Não é a IA do produto — serve só para estimar se o deck de apoio vence o NPC em História/Padrão.
// Uso: node --experimental-strip-types tools/content-build/simulate.ts [jogos-por-par=10]
import { buildBundle } from '../../src/content/bundle.ts';
import type { ContentDeck } from '../../src/content/types.ts';
import { buildCatalog, type Catalog } from '../../src/domain/cards/catalog.ts';
import { isPokemon } from '../../src/domain/cards/types.ts';
import { applyAction, getLegalActions } from '../../src/domain/battle/engine.ts';
import { createMatch, type DeckCard } from '../../src/domain/battle/setup.ts';
import type { Action, MatchState, PlayerId } from '../../src/domain/battle/types.ts';
import { other } from '../../src/domain/battle/types.ts';
import { seedRng, uniformInt, type RngState } from '../../src/domain/random/rng.ts';

type Rng = { state: RngState };
const roll = (rng: Rng, n: number): number => { const r = uniformInt(rng.state, n); rng.state = r.rng; return r.value; };

function cardsOf(cat: Catalog, deck: ContentDeck): DeckCard[] {
  return deck.entries.flatMap((e) => Array.from({ length: e.count }, () => ({ printingId: e.printingId, definitionKey: cat.definitionKeyOfPrinting(e.printingId) })));
}

function score(state: MatchState, cat: Catalog, me: PlayerId): number {
  if (state.result) return state.result.winner === me ? 1e6 : state.result.winner ? -1e6 : 0;
  const side = (p: PlayerId) => {
    const pl = state.players[p];
    let v = 0;
    for (const e of [pl.active, ...pl.bench]) {
      if (!e) continue;
      const def = cat.definition(state.cards[e.stack[e.stack.length - 1]!]!.definitionKey);
      const hp = isPokemon(def) ? def.baseHp : 40;
      v += Math.max(0, hp - e.damage) * 0.5 + e.energies.length * 12 + (e.stack.length - 1) * 15 + 8;
      if (e.conditions.poisoned || e.conditions.burned || e.conditions.control) v -= 10;
    }
    return v + Math.min(pl.hand.length, 7) * 2;
  };
  return 1000 * (state.players[me].points - state.players[other(me)].points) + side(me) - side(other(me));
}

function bestBy(state: MatchState, cat: Catalog, me: PlayerId, actions: readonly Action[], rng: Rng): { action: Action; value: number } | null {
  let best: { action: Action; value: number } | null = null;
  for (const action of actions) {
    const r = applyAction(state, cat, action);
    if (!r.ok) continue;
    const value = score(r.state, cat, me) + roll(rng, 100) / 1000;
    if (!best || value > best.value) best = { action, value };
  }
  return best;
}

function decide(state: MatchState, cat: Catalog, me: PlayerId, rng: Rng, noise: number): Action {
  const legal = getLegalActions(state, cat, me).filter((a) => a.type !== 'CONCEDE');
  if (legal.length === 1) return legal[0]!;
  if (noise > 0 && roll(rng, 1000) < noise * 1000) return legal[roll(rng, legal.length)]!;
  const decision = state.pendingDecisions.find((d) => d.player === me && !d.answered);
  if (decision) {
    if (decision.kind === 'SETUP') {
      const hp = (id: string) => { const d = cat.definition(state.cards[id]!.definitionKey); return isPokemon(d) ? d.baseHp : 0; };
      const sorted = [...decision.options].sort((a, b) => hp(b) - hp(a));
      return { type: 'RESOLVE_DECISION', player: me, decisionId: decision.decisionId, selection: sorted.slice(0, 4) };
    }
    return bestBy(state, cat, me, legal, rng)?.action ?? legal[0]!;
  }
  const now = score(state, cat, me);
  const setup = legal.filter((a) => a.type !== 'ATTACK' && a.type !== 'END_TURN' && a.type !== 'RETREAT');
  const best = bestBy(state, cat, me, setup, rng);
  if (best && best.value > now + 1) return best.action;
  const attack = bestBy(state, cat, me, legal.filter((a) => a.type === 'ATTACK'), rng);
  if (attack) return attack.action;
  return legal.find((a) => a.type === 'END_TURN') ?? legal[0]!;
}

export function simulate(human: ContentDeck, npc: ContentDeck, cat: Catalog, seed: number, npcNoise: number): 'A' | 'B' | 'DRAW' {
  let { state } = createMatch({ matchId: `sim-${seed}`, seed, players: { A: { deck: cardsOf(cat, human), energyTypes: human.energyTypes }, B: { deck: cardsOf(cat, npc), energyTypes: npc.energyTypes } } }, cat);
  const rng: Rng = { state: seedRng(seed * 7919) };
  let actionsThisTurn = 0;
  let lastTurn = -1;
  for (let step = 0; step < 3000 && !state.result; step += 1) {
    const open = state.pendingDecisions.filter((d) => !d.answered);
    const actor: PlayerId = open.length ? open[0]!.player : state.currentPlayer;
    if (state.globalTurnNumber !== lastTurn) { lastTurn = state.globalTurnNumber; actionsThisTurn = 0; }
    actionsThisTurn += 1;
    const action = actionsThisTurn > 25 && !open.length ? { type: 'END_TURN', player: actor } as Action : decide(state, cat, actor, rng, actor === 'B' ? npcNoise : 0);
    const r = applyAction(state, cat, action);
    if (!r.ok) throw new Error(`simulação: ação rejeitada ${r.code}`);
    state = r.state;
  }
  return state.result?.winner ?? 'DRAW';
}

function main(): void {
  const games = Number(process.argv[2] ?? 10);
  const bundle = buildBundle();
  const cat = buildCatalog(bundle.cards, bundle.printings);
  const decks = new Map(bundle.decks.map((d) => [d.deckId, d]));
  console.log('Nó | apoio×História | apoio×Padrão | inicial×História (melhor dos 3)');
  for (const node of bundle.nodes.filter((n) => n.difficultyProfiles && n.supportDeckIds.length)) {
    const support = decks.get(node.supportDeckIds[0]!)!;
    const rate = (human: ContentDeck, npcDeck: ContentDeck, noise: number) => {
      let wins = 0;
      for (let g = 0; g < games; g += 1) if (simulate(human, npcDeck, cat, 1000 + g, noise) === 'A') wins += 1;
      return wins / games;
    };
    const story = decks.get(node.difficultyProfiles!.STORY.npcDeckId)!;
    const standard = decks.get(node.difficultyProfiles!.STANDARD.npcDeckId)!;
    const starterBest = Math.max(...bundle.onboarding.starterDeckIds.map((id) => rate(decks.get(id)!, story, 0.25)));
    console.log(`${node.nodeId} | ${(rate(support, story, 0.25) * 100).toFixed(0)}% | ${(rate(support, standard, 0.08) * 100).toFixed(0)}% | ${(starterBest * 100).toFixed(0)}%`);
  }
}

if (process.argv[1]?.endsWith('simulate.ts')) main();
