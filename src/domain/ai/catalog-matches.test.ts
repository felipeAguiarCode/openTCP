// Partidas IA × IA com o conteúdo real do catálogo BASE: para o chefe de cada capítulo, o deck Padrão do NPC
// enfrenta o deck de apoio do capítulo, com os perfis de IA publicados (História e Padrão do próprio NPC).
// Toda ação passa pelo validador do motor no estado real; nenhuma partida trava nem lança erro.
import { describe, expect, it } from 'vitest';
import { buildBundle } from '../../content/bundle.ts';
import { SUPPORT_DECK_BY_CHAPTER, SUPPORT_VARIANT_BY_CHAPTER } from '../../content/source/decks.ts';
import type { AiProfile, CampaignNode, ContentDeck } from '../../content/types.ts';
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

function profileOf(node: CampaignNode, difficulty: 'STORY' | 'STANDARD'): AiProfile {
  const profile = profiles.get(node.difficultyProfiles![difficulty].aiProfileId);
  if (!profile) throw new Error(`perfil ausente para ${node.nodeId}/${difficulty}`);
  return profile;
}

/** Um nó por capítulo com deck de apoio: o chefe (no capítulo final, o último duelo). */
const NODES = Object.keys(SUPPORT_DECK_BY_CHAPTER).map((chapterId) => {
  const battles = bundle.nodes.filter((n) => n.chapterId === chapterId && n.difficultyProfiles && (n.kind === 'BOSS' || n.kind === 'FINAL'));
  const node = battles[battles.length - 1];
  if (!node) throw new Error(`capítulo ${chapterId} sem chefe`);
  return node;
});

describe('IA — partidas com o catálogo real (NPC Padrão × deck de apoio do capítulo)', () => {
  it('cobre todos os capítulos com deck de apoio', () => {
    expect(NODES.map((n) => n.chapterId)).toEqual(Object.keys(SUPPORT_DECK_BY_CHAPTER));
  });

  for (const [i, node] of NODES.entries()) {
    it(`${node.nodeId}: História × Padrão terminam sem ação ilegal nem erro`, () => {
      const npcDeck = decks.get(node.difficultyProfiles!.STANDARD.npcDeckId)!;
      const support = decks.get(SUPPORT_DECK_BY_CHAPTER[node.chapterId]!)!;
      expect(npcDeck, node.nodeId).toBeDefined();
      expect(support, node.chapterId).toBeDefined();
      const story = profileOf(node, 'STORY');
      const standard = profileOf(node, 'STANDARD');
      expect([story.policy, standard.policy]).toEqual(['STORY', 'STANDARD']);
      // Duas partidas por nó: o NPC joga com o perfil Padrão e com o de História (o apoio com o outro).
      const pairings: [AiProfile, AiProfile][] = [[story, standard], [standard, story]];
      for (const [k, [supportProfile, npcProfile]] of pairings.entries()) {
        const seed = 101 + i * 2 + k;
        const initial = createMatch({
          matchId: `catalog-${node.nodeId}-${seed}`, seed,
          players: { A: { deck: cardsOf(support), energyTypes: support.energyTypes }, B: { deck: cardsOf(npcDeck), energyTypes: npcDeck.energyTypes } },
        }, cat).state;
        const result = playMatch({
          initial, catalog: cat, seed,
          controllers: { A: { kind: 'AI', profile: supportProfile }, B: { kind: 'AI', profile: npcProfile } },
        });
        const label = `${node.nodeId} seed ${seed}`;
        expect(result.state.result, label).not.toBeNull();
        expect(result.state.globalTurnNumber, label).toBeLessThanOrEqual(60);
        expect(result.illegal, label).toEqual([]);
        expect(result.plans.filter((p) => p.fallback), label).toEqual([]);
        expect(new Set(result.plans.map((p) => p.policy)), label).toEqual(new Set(['STORY', 'STANDARD']));
      }
    }, 120_000);
  }
});

// Decks do conteúdo 3.0.0 que usam os sets depois do A1: os cinco iniciais novos, os modelos de apoio e as variações
// de campanha. Cada um joga uma partida inteira contra o chefe de um capítulo (a variação, contra o do próprio
// capítulo), com o perfil História dos dois lados.
const ORIGINAL = new Set([...Object.values(SUPPORT_DECK_BY_CHAPTER), 'starter-chama-constante', 'starter-mare-serena', 'starter-jardim-vivo']);
const NEW_DECKS = bundle.decks.filter((d) => (d.kind === 'STARTER' || d.kind === 'SUPPORT') && !ORIGINAL.has(d.deckId) && d.entries.some((e) => !e.printingId.startsWith('a1-') && !e.printingId.startsWith('pa-')));

describe('IA — decks dos sets novos (iniciais, modelos e variações) jogam partidas completas', () => {
  it('há 5 iniciais novos, 8 modelos e uma variação por capítulo', () => {
    expect(NEW_DECKS.filter((d) => d.kind === 'STARTER')).toHaveLength(5);
    expect(NEW_DECKS.filter((d) => d.deckId.startsWith('support-a'))).toHaveLength(8);
    expect(Object.keys(SUPPORT_VARIANT_BY_CHAPTER)).toEqual(Object.keys(SUPPORT_DECK_BY_CHAPTER));
  });

  for (const [i, deck] of NEW_DECKS.entries()) {
    it(`${deck.deckId}: partida sem ação ilegal nem erro`, () => {
      const chapter = Object.entries(SUPPORT_VARIANT_BY_CHAPTER).find(([, id]) => id === deck.deckId)?.[0];
      const node = (chapter ? NODES.find((n) => n.chapterId === chapter) : null) ?? NODES[i % NODES.length]!;
      const npcDeck = decks.get(node.difficultyProfiles!.STANDARD.npcDeckId)!;
      const story = profileOf(node, 'STORY');
      const seed = 501 + i;
      const initial = createMatch({
        matchId: `new-${deck.deckId}-${seed}`, seed,
        players: { A: { deck: cardsOf(deck), energyTypes: deck.energyTypes }, B: { deck: cardsOf(npcDeck), energyTypes: npcDeck.energyTypes } },
      }, cat).state;
      const result = playMatch({ initial, catalog: cat, seed, controllers: { A: { kind: 'AI', profile: story }, B: { kind: 'AI', profile: story } } });
      const label = `${deck.deckId} × ${npcDeck.deckId} seed ${seed}`;
      expect(result.state.result, label).not.toBeNull();
      expect(result.illegal, label).toEqual([]);
      expect(result.plans.filter((p) => p.fallback), label).toEqual([]);
    }, 120_000);
  }
});
