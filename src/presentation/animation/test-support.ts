// Apoio de testes da apresentação (não usado em produção): lotes confirmados de partidas reais geradas
// por ações legais aleatórias e traços públicos de cartas a partir de um catálogo. Puro (Node).
import { applyAction, getLegalActions, getPlayerView, redactEvents } from '../../domain/battle/engine.ts';
import { createMatch } from '../../domain/battle/setup.ts';
import type { BattleEvent, MatchState, PlayerId } from '../../domain/battle/types.ts';
import type { BattleView } from '../../domain/battle/views.ts';
import { seedRng, uniformInt } from '../../domain/random/rng.ts';
import type { Catalog } from '../../domain/cards/catalog.ts';
import { starterDeck } from '../../tests/support/starter-catalog.ts';
import type { PresentedCard } from './board-model.ts';
import type { CardTraits } from './plan.ts';

export function describeWith(cat: Catalog): (card: PresentedCard) => CardTraits | null {
  return (card) => {
    const def = cat.definition(card.definitionKey);
    const printing = cat.printing(card.printingId);
    const attackBlocks: Record<string, number> = {};
    if (def.category === 'POKEMON') for (const a of def.attacks) attackBlocks[a.id] = a.effects.length;
    return {
      category: def.category, finish: printing.finish, ruleBox: def.ruleBox,
      subtype: def.category === 'TRAINER' ? def.subtype : null, types: def.category === 'POKEMON' ? def.types : [], name: def.name, attackBlocks,
    };
  };
}

export type Batch = { readonly events: readonly BattleEvent[]; readonly before: BattleView; readonly after: BattleView };

/** Partidas completas por ações legais aleatórias, fatiadas em lotes confirmados vistos por `viewer`. */
export function fuzzBatches(cat: Catalog, seeds: readonly number[], viewer: PlayerId = 'A'): Batch[] {
  const out: Batch[] = [];
  const kinds = ['FIRE', 'WATER', 'GRASS'] as const;
  for (const seed of seeds) {
    const created = createMatch({ matchId: `pfuzz-${seed}`, seed, players: { A: starterDeck(cat, kinds[seed % 3]!), B: starterDeck(cat, kinds[(seed + 1) % 3]!) } }, cat);
    let state: MatchState = created.state;
    out.push({ events: redactEvents(created.events, viewer), before: getPlayerView(state, cat, viewer), after: getPlayerView(state, cat, viewer) });
    let rng = seedRng(seed * 7919);
    for (let steps = 0; !state.result && steps < 3000; steps += 1) {
      const pending = state.pendingDecisions.filter((d) => !d.answered);
      const actor = pending.length ? pending[0]!.player : state.currentPlayer;
      const legal = getLegalActions(state, cat, actor);
      const r = uniformInt(rng, legal.length);
      rng = r.rng;
      const result = applyAction(state, cat, legal[r.value]!);
      if (!result.ok) throw new Error(`fuzz: ação rejeitada ${result.code}`);
      out.push({ events: redactEvents(result.events, viewer), before: getPlayerView(state, cat, viewer), after: getPlayerView(result.state, cat, viewer) });
      state = result.state;
    }
  }
  return out;
}
