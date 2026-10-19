// Agressividade da IA com o conteúdo real (gameplay §25.3, G-089): o chefe de cada capítulo, com o perfil publicado da
// dificuldade, enfrenta o deck de apoio do capítulo jogado pelo perfil Padrão do mesmo nó. Mede, nos turnos do NPC em
// que algum ataque foi legal, quantos terminaram sem ataque — e por quê. Os números ficam no log ([ai-aggression]).
//
// Antes do peso `aggression` (conteúdo 3.4.0; 21 partidas por dificuldade, sementes 900–920), o NPC passava sem atacar
// em 42% desses turnos na História, 19% no Padrão e 21% no Especialista — quase sempre recuando para um reserva que não
// atacava, encerrando o turno pelo erro tolerado ou evoluindo o Ativo para um estágio que não pagava o ataque.
import { describe, expect, it } from 'vitest';
import { buildBundle } from '../../content/bundle.ts';
import { SUPPORT_DECK_BY_CHAPTER } from '../../content/source/decks.ts';
import type { ContentDeck, Difficulty } from '../../content/types.ts';
import { getLegalActions } from '../battle/engine.ts';
import { createMatch, type DeckCard } from '../battle/setup.ts';
import { buildCatalog } from '../cards/catalog.ts';
import { playMatch } from './index.ts';

const bundle = buildBundle();
const cat = buildCatalog(bundle.cards, bundle.printings);
const decks = new Map(bundle.decks.map((d) => [d.deckId, d]));
const profiles = new Map(bundle.aiProfiles.map((p) => [p.aiProfileId, p]));

function cardsOf(deck: ContentDeck): DeckCard[] {
  return deck.entries.flatMap((e) => Array.from({ length: e.count }, () => ({ printingId: e.printingId, definitionKey: cat.definitionKeyOfPrinting(e.printingId) })));
}

const NODES = Object.keys(SUPPORT_DECK_BY_CHAPTER).map((chapterId) => {
  const battles = bundle.nodes.filter((n) => n.chapterId === chapterId && n.difficultyProfiles && (n.kind === 'BOSS' || n.kind === 'FINAL'));
  return battles[battles.length - 1]!;
});

type Tally = { turns: number; skipped: number; causes: Record<string, number>; knockoutPoints: number; wins: number; games: number };

/** NPC = B. Um turno conta se algum ATTACK foi legal em algum passo; a causa é a ação que tirou o ataque (ou END_TURN). */
function measure(difficulty: Difficulty, seedsPerNode: number): Tally {
  const tally: Tally = { turns: 0, skipped: 0, causes: {}, knockoutPoints: 0, wins: 0, games: 0 };
  for (const [i, node] of NODES.entries()) {
    for (let k = 0; k < seedsPerNode; k += 1) {
      const seed = 2100 + i * seedsPerNode + k;
      const npcDeck = decks.get(node.difficultyProfiles![difficulty].npcDeckId)!;
      const support = decks.get(SUPPORT_DECK_BY_CHAPTER[node.chapterId]!)!;
      const initial = createMatch({
        matchId: `aggression-${node.nodeId}-${seed}`, seed,
        players: { A: { deck: cardsOf(support), energyTypes: support.energyTypes }, B: { deck: cardsOf(npcDeck), energyTypes: npcDeck.energyTypes } },
      }, cat).state;
      let turn: { number: number; available: boolean; attacked: boolean; cause: string | null } | null = null;
      const close = () => {
        if (turn?.available) {
          tally.turns += 1;
          if (!turn.attacked) {
            tally.skipped += 1;
            const cause = turn.cause ?? 'OTHER';
            tally.causes[cause] = (tally.causes[cause] ?? 0) + 1;
          }
        }
        turn = null;
      };
      const result = playMatch({
        initial, catalog: cat, seed,
        controllers: {
          A: { kind: 'AI', profile: profiles.get(node.difficultyProfiles!.STANDARD.aiProfileId)! },
          B: { kind: 'AI', profile: profiles.get(node.difficultyProfiles![difficulty].aiProfileId)! },
        },
        onStep: (before, actor, action, after) => {
          if (actor !== 'B' || action.type === 'RESOLVE_DECISION') return;
          if (!turn || turn.number !== before.globalTurnNumber) { close(); turn = { number: before.globalTurnNumber, available: false, attacked: false, cause: null }; }
          const canAttack = getLegalActions(before, cat, 'B').some((a) => a.type === 'ATTACK');
          if (canAttack) turn.available = true;
          if (action.type === 'ATTACK') {
            turn.attacked = true;
            tally.knockoutPoints += after.players.B.points - before.players.B.points;
          } else if (canAttack && !turn.cause) {
            const lost = action.type === 'END_TURN' || (!after.result && after.currentPlayer === 'B' && after.pendingDecisions.length === 0
              && !getLegalActions(after, cat, 'B').some((a) => a.type === 'ATTACK'));
            if (lost) turn.cause = action.type;
          }
          if (action.type === 'END_TURN' || action.type === 'ATTACK' || after.result) close();
        },
      });
      close();
      expect(result.illegal, `${node.nodeId} seed ${seed}`).toEqual([]);
      expect(result.plans.filter((p) => p.fallback), `${node.nodeId} seed ${seed}`).toEqual([]);
      tally.games += 1;
      if (result.state.result?.winner === 'B') tally.wins += 1;
    }
  }
  return tally;
}

describe('IA — agressividade com o catálogo real (G-089)', () => {
  for (const difficulty of ['STORY', 'STANDARD', 'EXPERT'] as const) {
    it(`${difficulty}: o NPC ataca em pelo menos 88% dos turnos em que pode atacar`, () => {
      const tally = measure(difficulty, 2);
      const rate = tally.skipped / Math.max(1, tally.turns);
      console.info(`[ai-aggression] ${difficulty}: ${tally.skipped}/${tally.turns} turnos com ataque legal sem ataque (${Math.round(rate * 100)}%) `
        + `${JSON.stringify(tally.causes)}; ${tally.knockoutPoints} pontos de Nocaute; ${tally.wins}V em ${tally.games}`);
      expect(tally.turns).toBeGreaterThan(30);
      expect(rate).toBeLessThanOrEqual(0.12);
    }, 300_000);
  }
});
