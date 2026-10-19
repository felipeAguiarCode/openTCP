// Pacote de conteúdo mínimo e coerente para testes de integração da aplicação: as 18 cartas
// iniciais, 3 decks iniciais, um pacote aleatório e um capítulo com dois encontros.
import type { BuiltBundle, CampaignNode, ContentBundle, ContentDeck } from '../../content/types.ts';
import { printing } from '../../content/builders.ts';
import * as S from './generic-cards.ts';
import { jcsHash } from '../../domain/hash/jcs.ts';
import type { CardDefinition } from '../../domain/cards/types.ts';

const CAMPAIGN = 'circuito-teste';

export function miniBundle(): BuiltBundle {
  const defs: CardDefinition[] = [...S.STARTER_POKEMON, ...S.STARTER_TRAINERS];
  const printings = defs.map((card, i) => printing({ card, setId: 'base', number: i + 1, rarity: i < 12 ? 'COMMON' : 'UNCOMMON' }));
  const pid = (card: CardDefinition) => printings.find((p) => p.cardDefinitionId === card.id)!.printingId;
  const deck = (deckId: string, name: string, type: 'FIRE' | 'WATER' | 'GRASS', line: CardDefinition[]): ContentDeck => ({
    deckId, version: 1, name, kind: 'STARTER', energyTypes: [type],
    entries: [...line, S.kitReparo, S.rastreador, S.trocaTatica, S.estudioso, S.mentoria, S.talisma].map((card) => ({ printingId: pid(card), count: 2 as const })),
  });
  const decks = [
    deck('starter-fire', 'Chama Constante', 'FIRE', [S.faisca, S.braseiro, S.carvito, S.brasacu]),
    deck('starter-water', 'Maré Serena', 'WATER', [S.gota, S.marulho, S.nimbo, S.pluvion]),
    deck('starter-grass', 'Jardim Vivo', 'GRASS', [S.broto, S.folhariz, S.semente, S.ramante]),
  ];
  const node = (nodeId: string, allOf: string[], extra: Partial<CampaignNode> = {}): CampaignNode => ({
    nodeId, campaignId: CAMPAIGN, chapterId: 'P00', contentVersion: '1.0.0', kind: 'DUEL', title: `Encontro ${nodeId}`, essential: true,
    prerequisites: { allOf }, npcId: 'npc-lia', arenaId: 'arena-academy', mapSceneId: 'campaign-academy',
    difficultyProfiles: { STORY: { aiProfileId: 'ai-story', npcDeckId: 'starter-water' }, STANDARD: { aiProfileId: 'ai-standard', npcDeckId: 'starter-water' }, EXPERT: { aiProfileId: 'ai-standard', npcDeckId: 'starter-water' } },
    fixtureId: null, turnLimit: null, completionObjectiveId: `${nodeId}-win`, optionalObjectiveIds: [`${nodeId}-bench`],
    firstClearRewardTableId: `${nodeId}-first`, repeatRewardTableId: 'rt-repeat', keyCardReward: null, discoveryOffer: null, supportDeckIds: ['starter-grass'],
    dialogue: { briefing: 'dlg-brief', intro: null, victory: 'dlg-win', defeat: 'dlg-loss' }, map: { x: allOf.length * 2, z: 0, icon: 'BATTLE' }, ...extra,
  });
  const nodes = [node('T01', []), node('T02', ['T01'])];
  const weights = { budget: { maxNodes: 50, maxDepth: 1, determinizations: 1, watchdogMs: 200 } };
  const content: ContentBundle = {
    packageId: 'base', version: '0.0.1-test', campaignId: CAMPAIGN, rulesetId: 'local-campaign-v2',
    cards: defs, printings,
    sets: [{ setId: 'base', name: 'Base', unlockAfterNodeId: null }],
    decks,
    deckRecipes: [],
    products: [{
      productId: 'pack-base-v1', version: 1, name: 'Pacote Base', kind: 'RANDOM_PACK', price: { credits: 100 }, availability: { fromStart: true, afterNodeId: null }, repeatable: true, cardsPerPack: 5,
      slots: [1, 2, 3, 4, 5].map((position) => ({ position, categoryWeights: position < 5 ? { COMMON: 100, UNCOMMON: 0, RARE: 0, ULTRA: 0 } : { COMMON: 0, UNCOMMON: 100, RARE: 0, ULTRA: 0 } })),
      pools: { COMMON: printings.slice(0, 12).map((p) => ({ printingId: p.printingId, weight: 1 })), UNCOMMON: printings.slice(12).map((p) => ({ printingId: p.printingId, weight: 1 })), RARE: [], ULTRA: [] },
      coverPrintingId: printings[0]!.printingId,
    }, {
      productId: 'card-faisca', version: 1, name: 'Faísca', kind: 'DIRECTED_CARD', price: { credits: 80 }, availability: { fromStart: false, afterNodeId: 'T01' }, repeatable: true, directedPrintingId: pid(S.faisca),
    }],
    chapters: [{ chapterId: 'P00', title: 'Prólogo', theme: 'Academia', specialistNpcId: 'npc-lia', mapSceneId: 'campaign-academy', arenaId: 'arena-academy', playmatId: 'mat-neutral', setId: 'base', packProductId: 'pack-base-v1', medalId: null, journal: { intro: 'Início.', outro: 'Fim.' } }],
    nodes,
    objectives: nodes.flatMap((n) => [
      { objectiveId: `${n.nodeId}-win`, scope: 'SINGLE_ATTEMPT' as const, requiresVictory: true, predicates: [{ type: 'WIN' as const }], description: 'Vencer', reward: { credits: 0 }, claimPolicy: 'AUTOMATIC_ON_RESULT' as const, grantKey: `objective:${CAMPAIGN}:${n.nodeId}-win` },
      { objectiveId: `${n.nodeId}-bench`, scope: 'SINGLE_ATTEMPT' as const, requiresVictory: true, predicates: [{ type: 'PLACED_ON_BENCH_AT_LEAST' as const, count: 1 }], description: 'Colocar 1 no Banco', reward: { credits: 40 }, claimPolicy: 'AUTOMATIC_ON_RESULT' as const, grantKey: `objective:${CAMPAIGN}:${n.nodeId}-bench` },
    ]),
    rewardTables: [
      ...nodes.map((n) => ({ rewardTableId: `${n.nodeId}-first`, credits: 100, packs: [{ productId: 'pack-base-v1', count: 1 }], medal: null, cosmetics: [], unlocks: [] })),
      { rewardTableId: 'rt-repeat', credits: 20, packs: [], medal: null, cosmetics: [], unlocks: [] },
    ],
    npcs: [{ npcId: 'npc-lia', name: 'Lia', title: 'Instrutora', chapterId: 'P00', portraitAssetKey: null, style: 'Didática', notebook: { origin: 'Academia', hints: ['Observe a Fraqueza.'] }, cosmeticPresetId: 'preset-player-default' }],
    aiProfiles: (['STORY', 'STANDARD'] as const).map((policy) => ({
      aiProfileId: policy === 'STORY' ? 'ai-story' : 'ai-standard', policy, ...weights,
      weights: { points: 10, opponentPoints: -10, damageDealt: 1, knockoutThreat: 3, energyDevelopment: 1, evolution: 1, benchDevelopment: 1, handSize: 0.1, conditions: 0.5, preservePoints: 2, aggression: 1 },
      tolerance: { suboptimalChance: 0, candidatePoolTop: 1 }, setupPolicy: 'HIGHEST_HP_ACTIVE' as const, targetPolicy: 'MAX_DAMAGE' as const, promotionPolicy: 'HIGHEST_HP' as const,
    })),
    fixtures: [],
    cosmetics: [{ cosmeticId: 'mat-neutral', kind: 'PLAYMAT', definitionVersion: 2, names: { 'pt-BR': 'Neutro' }, acquisition: { kind: 'FREE', requiredCompletedNodeId: null, credits: 0 }, visual: { palette: ['#EAF4FA', '#86BCE7'], pattern: 'NONE', assetKey: null, variants: [], accentHex: '#357DE4' }, fallbackCosmeticId: null }],
    cosmeticPresets: [{ presetId: 'preset-player-default', playmatId: 'mat-neutral', sleeveId: 'mat-neutral', coinId: 'mat-neutral', defaultEntryFlairId: 'mat-neutral' }],
    dialogues: [{ dialogueId: 'dlg-brief', lines: [{ speakerId: 'npc-lia', text: 'Vamos treinar.' }] }, { dialogueId: 'dlg-win', lines: [{ speakerId: 'npc-lia', text: 'Muito bem.' }] }, { dialogueId: 'dlg-loss', lines: [{ speakerId: 'npc-lia', text: 'De novo.' }] }],
    onboarding: {
      credits: 300, starterDeckIds: decks.map((d) => d.deckId), inventory: printings.map((p) => ({ printingId: p.printingId, count: 2 })),
      packs: [{ productId: 'pack-base-v1', count: 1 }], cosmeticIds: ['mat-neutral'], firstNodeId: 'T01',
    },
  };
  return { ...content, contentHash: jcsHash(content) };
}
