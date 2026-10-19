// Monta o pacote de conteúdo BASE 3.5.0 (ContentBundle): todos os sets do Pocket até o A4b + Promo-A e Promo-B, numa jornada de Ginásios,
// e as receitas de deck.
// Ordem estável e determinística; o content-build valida, calcula o contentHash (JCS) e publica em public/content/.
import type { ContentBundle } from './types.ts';
import { ALL_CARDS, ALL_PRINTINGS, SETS, STARTER_PRINTINGS } from './source/sets.ts';
import { NPC_DECKS, STARTER_DECKS, SUPPORT_DECKS } from './source/decks.ts';
import { PRODUCTS } from './source/products.ts';
import { CAMPAIGN_ID, CHAPTERS, CONTENT_VERSION, NODES, OBJECTIVES, REWARD_TABLES } from './source/campaign.ts';
import { AI_PROFILES, NPCS } from './source/npcs.ts';
import { ALL_FIXTURES } from './source/fixtures.ts';
import { COSMETIC_PRESETS, COSMETICS, FREE_COSMETIC_IDS } from './source/cosmetics.ts';
import { DIALOGUES } from './source/dialogues.ts';
import { DECK_RECIPES } from './source/recipes.ts';

export const ONBOARDING_CREDITS = 300;

export function buildBundle(): ContentBundle {
  return {
    packageId: 'base',
    version: CONTENT_VERSION,
    campaignId: CAMPAIGN_ID,
    rulesetId: 'local-campaign-v2',
    cards: ALL_CARDS,
    printings: ALL_PRINTINGS,
    sets: SETS.map((s) => ({ setId: s.setId, name: s.name, unlockAfterNodeId: null })),
    decks: [...STARTER_DECKS, ...SUPPORT_DECKS, ...NPC_DECKS],
    deckRecipes: DECK_RECIPES,
    products: PRODUCTS,
    chapters: CHAPTERS,
    nodes: NODES,
    objectives: OBJECTIVES,
    rewardTables: REWARD_TABLES,
    npcs: NPCS,
    aiProfiles: AI_PROFILES,
    fixtures: ALL_FIXTURES,
    cosmetics: COSMETICS,
    cosmeticPresets: COSMETIC_PRESETS,
    dialogues: DIALOGUES,
    onboarding: {
      credits: ONBOARDING_CREDITS,
      starterDeckIds: STARTER_DECKS.map((d) => d.deckId),
      inventory: STARTER_PRINTINGS.map((printingId) => ({ printingId, count: 2 })),
      packs: [{ productId: 'pack-tutorial-v1', count: 1 }, { productId: 'pack-a1-pikachu', count: 1 }],
      cosmeticIds: FREE_COSMETIC_IDS,
      firstNodeId: 'P00-T01',
    },
  };
}
