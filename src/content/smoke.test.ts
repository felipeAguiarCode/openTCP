// Fumaça sem IA: partidas completas com ações legais aleatórias (driver determinístico), sem erros do motor.
import { describe, expect, it } from 'vitest';
import { buildBundle } from './bundle.ts';
import { buildCatalog, type Catalog } from '../domain/cards/catalog.ts';
import { applyAction, getLegalActions } from '../domain/battle/engine.ts';
import { createMatch, createMatchFromFixture, type DeckCard } from '../domain/battle/setup.ts';
import type { MatchState, PlayerId } from '../domain/battle/types.ts';
import { seedRng, uniformInt, type RngState } from '../domain/random/rng.ts';
import type { ContentDeck } from './types.ts';

const bundle = buildBundle();
const cat = buildCatalog(bundle.cards, bundle.printings);
const deckById = new Map(bundle.decks.map((d) => [d.deckId, d]));

function cardsOf(catalog: Catalog, deck: ContentDeck): DeckCard[] {
  return deck.entries.flatMap((e) => Array.from({ length: e.count }, () => ({ printingId: e.printingId, definitionKey: catalog.definitionKeyOfPrinting(e.printingId) })));
}

/** Joga até o fim escolhendo ações legais ao acaso; ATTACK tem prioridade 50% das vezes para encurtar a partida. */
function playOut(initial: MatchState, seed: number): { state: MatchState; steps: number } {
  let state = initial;
  let rng: RngState = seedRng(seed);
  let steps = 0;
  while (!state.result && steps < 4000) {
    steps += 1;
    const open = state.pendingDecisions.filter((d) => !d.answered);
    const actor: PlayerId = open.length ? open[0]!.player : state.currentPlayer;
    const legal = getLegalActions(state, cat, actor);
    if (legal.length === 0) throw new Error(`sem ações legais (${state.phase}, ${actor})`);
    const attacks = legal.filter((a) => a.type === 'ATTACK');
    let r = uniformInt(rng, 2);
    rng = r.rng;
    const pool = attacks.length && r.value === 0 ? attacks : legal.filter((a) => a.type !== 'CONCEDE');
    r = uniformInt(rng, pool.length);
    rng = r.rng;
    const result = applyAction(state, cat, pool[r.value]!);
    if (!result.ok) throw new Error(`ação legal rejeitada: ${result.code} ${result.message ?? ''} ${JSON.stringify(pool[r.value])}`);
    state = result.state;
  }
  return { state, steps };
}

describe('fumaça: decks de NPC (Padrão) contra o deck de apoio do capítulo', () => {
  const battles = bundle.nodes.filter((n) => n.difficultyProfiles && n.supportDeckIds.length);
  for (const node of battles) {
    it(`${node.nodeId}: partida completa sem erros do motor`, () => {
      const npc = deckById.get(node.difficultyProfiles!.STANDARD.npcDeckId)!;
      const support = deckById.get(node.supportDeckIds[0]!)!;
      for (const seed of [11, 23]) {
        const { state } = createMatch({
          matchId: `smoke-${node.nodeId}-${seed}`, seed,
          players: { A: { deck: cardsOf(cat, support), energyTypes: support.energyTypes }, B: { deck: cardsOf(cat, npc), energyTypes: npc.energyTypes } },
        }, cat);
        const end = playOut(state, seed);
        expect(end.state.result, node.nodeId).not.toBeNull();
        expect(end.state.globalTurnNumber).toBeLessThanOrEqual(60);
      }
    });
  }

  it('decks História e Especialista também jogam até o fim', () => {
    for (const node of battles.filter((n) => n.kind === 'BOSS' || n.kind === 'FINAL')) {
      for (const d of ['STORY', 'EXPERT'] as const) {
        const npc = deckById.get(node.difficultyProfiles![d].npcDeckId)!;
        const starter = deckById.get('starter-chama-constante')!;
        const { state } = createMatch({
          matchId: `smoke-${node.nodeId}-${d}`, seed: 5,
          players: { A: { deck: cardsOf(cat, starter), energyTypes: starter.energyTypes }, B: { deck: cardsOf(cat, npc), energyTypes: npc.energyTypes } },
        }, cat);
        expect(playOut(state, 5).state.result, `${node.nodeId} ${d}`).not.toBeNull();
      }
    }
  });

  it('o duelo guiado P00-T06 joga até o fim a partir da fixture', () => {
    const fx = bundle.fixtures.find((f) => f.fixtureId === 'fx-p00-t06')!;
    for (const seed of [1, 2, 3]) {
      const { state } = createMatchFromFixture(fx, `t06-${seed}`, seed, cat, (pid) => cat.definitionKeyOfPrinting(pid));
      expect(playOut(state, seed).state.result).not.toBeNull();
    }
  });
});
