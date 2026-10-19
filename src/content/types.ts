// Contrato do pacote de conteúdo BASE (espelha os schemas de .specs/schemas/*.schema.json).
import type { CardDefinition, CardPrinting, EnergyType } from '../domain/cards/types.ts';
import type { RaritySymbol } from '../domain/cards/rarity.ts';
import type { ContentFixture } from './source/script.ts';

export type { ContentFixture };

export type Difficulty = 'STORY' | 'STANDARD' | 'EXPERT';
export type ChapterId = 'P00' | 'C01' | 'C02' | 'C03' | 'C04' | 'C05' | 'C06' | 'F00';
export type NodeKind = 'TUTORIAL' | 'DUEL' | 'PUZZLE' | 'DISCOVERY' | 'ELITE' | 'BOSS' | 'FINAL';
export type RarityCategory = 'COMMON' | 'UNCOMMON' | 'RARE' | 'ULTRA';

export type ContentDeck = {
  readonly deckId: string;
  readonly version: number;
  readonly name: string;
  readonly kind: 'STARTER' | 'SUPPORT' | 'NPC' | 'TUTORIAL';
  readonly energyTypes: readonly EnergyType[];
  readonly entries: readonly { readonly printingId: string; readonly count: 1 | 2 }[];
  readonly cosmeticPresetId?: string | null;
  readonly strategyNote?: string;
};

/**
 * Pesos por símbolo de raridade numa posição do pacote (taxas oficiais do Pocket, campanha §16.2): inteiros em
 * milésimos de ponto percentual, soma 100000 por posição. Dentro do símbolo a chance é uniforme entre as impressões.
 */
export type TierWeights = Readonly<Partial<Record<RaritySymbol, number>>>;
/** Impressões de cada símbolo no pool do pacote (uniformes dentro do símbolo). */
export type TierPools = Readonly<Partial<Record<RaritySymbol, readonly string[]>>>;

export type Product = {
  readonly productId: string;
  readonly version: number;
  readonly name: string;
  readonly kind: 'RANDOM_PACK' | 'FIXED_PACK' | 'DIRECTED_CARD' | 'COSMETIC';
  readonly price: { readonly credits: number } | null;
  readonly availability: { readonly fromStart: boolean; readonly afterNodeId: string | null };
  readonly repeatable: boolean;
  readonly cardsPerPack?: number;
  readonly slots?: readonly { readonly position: number; readonly categoryWeights: Readonly<Record<RarityCategory, number>> }[];
  readonly pools?: Readonly<Record<RarityCategory, readonly { readonly printingId: string; readonly weight: number }[]>>;
  /** Pacote por símbolo (sets depois do A1): posições com pesos por símbolo e pools por símbolo, no lugar de slots/pools. */
  readonly tierSlots?: readonly { readonly position: number; readonly weights: TierWeights }[];
  readonly tierPools?: TierPools;
  /** Carta extra (6ª carta dos bebês): sai com `chance` em 100000 pacotes normais, de pools próprios. */
  readonly bonusSlot?: { readonly chance: number; readonly weights: TierWeights; readonly pools: TierPools };
  /** Pacote raro: com `chance` em 100000, todas as cartas saem uniformes da união dos pools destes símbolos. */
  readonly rarePack?: { readonly chance: number; readonly symbols: readonly RaritySymbol[] };
  readonly fixedContents?: readonly string[];
  readonly directedPrintingId?: string;
  readonly cosmeticId?: string;
  readonly coverPrintingId?: string | null;
};

export type PredicateType =
  | 'WIN' | 'DECK_COMPOSITION' | 'PLACED_ON_BENCH_AT_LEAST' | 'EVOLVED_AT_LEAST' | 'MANUAL_ENERGY_ATTACHED_AT_LEAST'
  | 'PLAYED_SUBTYPES' | 'RETREATED_AT_LEAST' | 'SWITCH_EFFECT_USED' | 'DISTINCT_ATTACKERS_AT_LEAST'
  | 'DISTINCT_ATTACK_DAMAGE_SOURCES_AT_LEAST' | 'ENERGY_ON_ONE_POKEMON_AT_LEAST' | 'ACTIVATED_ABILITY_USED'
  | 'CONDITION_REMOVED_BY_CAUSE' | 'EVOLVED_POKEMON_WITH_CONDITION' | 'DELAYED_EFFECT_PREVENTED' | 'TOOL_ATTACHED'
  | 'STADIUM_REPLACED_DIFFERENT_NAME' | 'MODIFIER_SOURCE_REMOVED' | 'KNOCKOUT_WITHOUT_ATTACK' | 'KNOCKED_OUT_ROLE'
  | 'KNOCKED_OUT_RULEBOX' | 'OWN_TURNS_AT_MOST' | 'OPPONENT_POINTS_AT_MOST' | 'WIN_IN_PREPARED_TURN';

export type DeckComposition = {
  readonly minBasic?: number;
  readonly maxRuleBoxCopies?: { readonly EX?: number; readonly MEGA_EX?: number };
  readonly minRuleBoxCopies?: { readonly EX?: number; readonly MEGA_EX?: number };
  readonly exactEnergyTypeCount?: number;
  readonly minSubtypeCopies?: { readonly TOOL?: number; readonly STADIUM?: number; readonly ITEM?: number; readonly SUPPORTER?: number };
  readonly minCardsWithOpcode?: { readonly opcodes: readonly string[]; readonly count: number };
  readonly minDistinctEvolutionLines?: number;
  readonly maxStarterPrintings?: number;
  readonly minSetCards?: { readonly setIds: readonly string[]; readonly count: number };
  /** Cópias de Pokémon de pelo menos um destes tipos (objetivos de capítulo por tipo). */
  readonly minTypeCards?: { readonly types: readonly string[]; readonly count: number };
};

export type Predicate = {
  readonly type: PredicateType;
  readonly count?: number;
  readonly controller?: 'HUMAN';
  readonly minimumDamage?: number;
  readonly subtypes?: readonly ('ITEM' | 'SUPPORTER' | 'TOOL' | 'STADIUM')[];
  readonly causes?: readonly ('SWITCH' | 'RETREAT' | 'EVOLUTION' | 'EFFECT')[];
  readonly role?: string;
  readonly ruleBoxes?: readonly ('EX' | 'MEGA_EX')[];
  readonly composition?: DeckComposition;
};

export type Objective = {
  readonly objectiveId: string;
  readonly scope: 'SINGLE_ATTEMPT';
  readonly requiresVictory: boolean;
  readonly predicates: readonly Predicate[];
  readonly description: string;
  readonly reward: { readonly credits: number };
  readonly claimPolicy: 'AUTOMATIC_ON_RESULT';
  readonly grantKey: string;
};

export type CampaignNode = {
  readonly nodeId: string;
  readonly campaignId: string;
  readonly chapterId: ChapterId;
  readonly contentVersion: string;
  readonly kind: NodeKind;
  readonly title: string;
  readonly essential: boolean;
  readonly prerequisites: { readonly allOf: readonly string[] };
  readonly npcId: string;
  readonly arenaId: string;
  readonly mapSceneId: string;
  readonly difficultyProfiles: Readonly<Record<Difficulty, { readonly aiProfileId: string; readonly npcDeckId: string }>> | null;
  readonly fixtureId: string | null;
  readonly turnLimit: { readonly ownTurns: number } | null;
  readonly completionObjectiveId: string | null;
  readonly optionalObjectiveIds: readonly string[];
  readonly firstClearRewardTableId: string;
  readonly repeatRewardTableId: string | null;
  readonly keyCardReward: { readonly mode: 'FIXED' | 'CHOICE'; readonly printingIds: readonly string[]; readonly copies: number } | null;
  readonly discoveryOffer: readonly string[] | null;
  readonly supportDeckIds: readonly string[];
  readonly roleTags?: Readonly<Record<string, readonly string[]>>;
  readonly dialogue: { readonly briefing: string; readonly intro: string | null; readonly victory: string; readonly defeat: string };
  readonly map: { readonly x: number; readonly z: number; readonly icon: 'BATTLE' | 'PUZZLE' | 'DISCOVERY' | 'ELITE' | 'BOSS' | 'TUTORIAL' | 'FINAL' };
};

export type RewardTable = {
  readonly rewardTableId: string;
  readonly credits: number;
  readonly packs: readonly { readonly productId: string; readonly count: number }[];
  readonly medal: string | null;
  readonly cosmetics: readonly string[];
  readonly unlocks: readonly string[];
};

export type Npc = {
  readonly npcId: string;
  readonly name: string;
  readonly title: string;
  readonly chapterId: ChapterId;
  readonly portraitAssetKey: string | null;
  readonly style: string;
  readonly notebook: { readonly origin: string; readonly hints: readonly string[] };
  readonly cosmeticPresetId: string;
};

export type AiProfile = {
  readonly aiProfileId: string;
  readonly policy: Difficulty;
  readonly budget: { readonly maxNodes: number; readonly maxDepth: number; readonly determinizations: number; readonly watchdogMs: number };
  readonly weights: Readonly<Record<'points' | 'opponentPoints' | 'damageDealt' | 'knockoutThreat' | 'energyDevelopment' | 'evolution' | 'benchDevelopment' | 'handSize' | 'conditions' | 'preservePoints' | 'aggression', number>>;
  readonly tolerance: { readonly suboptimalChance: number; readonly candidatePoolTop: number };
  readonly setupPolicy: 'HIGHEST_HP_ACTIVE' | 'BEST_ATTACKER_ACTIVE' | 'PROTECT_KEY_BASIC';
  readonly targetPolicy: 'MAX_DAMAGE' | 'PREFER_KNOCKOUT' | 'PREFER_HIGH_POINTS' | 'PREFER_SUPPORT_ROLE';
  readonly promotionPolicy: 'BEST_ATTACKER' | 'HIGHEST_HP' | 'LOWEST_POINTS_RISK';
};

export type Cosmetic = {
  readonly cosmeticId: string;
  readonly kind: 'PLAYMAT' | 'SLEEVE' | 'COIN' | 'FLAIR';
  readonly definitionVersion: number;
  readonly names: { readonly 'pt-BR': string };
  readonly acquisition: { readonly kind: 'FREE' | 'EMPORIUM' | 'GRANT'; readonly requiredCompletedNodeId: string | null; readonly credits: number; readonly grantMilestoneId?: string | null };
  readonly visual: { readonly palette: readonly string[]; readonly pattern: 'NONE' | 'LINES' | 'LEAVES' | 'WAVES' | 'CIRCUITS' | 'STARS' | 'SYMBOLS' | 'PAGES' | 'CHAPTERS'; readonly assetKey: string | null; readonly variants: readonly string[]; readonly accentHex: string };
  readonly flair?: { readonly triggers: readonly ('PUBLIC_ENTRY' | 'EVOLUTION' | 'PROMOTION')[]; readonly particleBudget: number; readonly durationMs: number; readonly reducedVariant: 'FADE' | 'NONE' };
  readonly fallbackCosmeticId: string | null;
};

export type Dialogue = {
  readonly dialogueId: string;
  readonly lines: readonly { readonly speakerId: string; readonly text: string; readonly mood?: 'NEUTRAL' | 'HAPPY' | 'SERIOUS' | 'SURPRISED' }[];
};

export type Chapter = {
  readonly chapterId: ChapterId;
  readonly title: string;
  readonly theme: string;
  readonly specialistNpcId: string;
  readonly mapSceneId: string;
  readonly arenaId: string;
  readonly playmatId: string;
  readonly setId: string | null;
  readonly packProductId: string | null;
  readonly medalId: string | null;
  readonly journal: { readonly intro: string; readonly outro: string };
};

export type CosmeticPresetContent = {
  readonly presetId: string;
  readonly playmatId: string;
  readonly sleeveId: string;
  readonly coinId: string;
  readonly defaultEntryFlairId: string;
};

/** Receita de deck (campanha §3.7): lista pronta para montar, por tipo, do meta ou da comunidade. Não é deck jogável do NPC. */
export type DeckRecipeCategory = 'TYPE' | 'META' | 'COMMUNITY';
export type DeckRecipeDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type DeckRecipe = {
  readonly recipeId: string;
  readonly version: number;
  readonly name: string;
  readonly category: DeckRecipeCategory;
  /** Set das cartas principais neste pacote (A1…A4b), para ordenar e mostrar a era. */
  readonly era: string;
  readonly energyTypes: readonly EnergyType[];
  readonly difficulty: DeckRecipeDifficulty;
  readonly entries: readonly { readonly printingId: string; readonly count: 1 | 2 }[];
  /** Carta da capa (a estrela do deck); está na lista. */
  readonly coverPrintingId: string;
  /** Estratégia em uma ou duas frases. */
  readonly summary: string;
};

export type ContentBundle = {
  readonly packageId: 'base';
  readonly version: string;
  readonly campaignId: string;
  readonly rulesetId: 'local-campaign-v2';
  readonly cards: readonly CardDefinition[];
  readonly printings: readonly CardPrinting[];
  readonly sets: readonly { readonly setId: string; readonly name: string; readonly unlockAfterNodeId: string | null }[];
  readonly decks: readonly ContentDeck[];
  readonly deckRecipes: readonly DeckRecipe[];
  readonly products: readonly Product[];
  readonly chapters: readonly Chapter[];
  readonly nodes: readonly CampaignNode[];
  readonly objectives: readonly Objective[];
  readonly rewardTables: readonly RewardTable[];
  readonly npcs: readonly Npc[];
  readonly aiProfiles: readonly AiProfile[];
  /** Fixture do motor + roteiro do NPC (`npcScript`), solução comentada e dicas do tutorial. */
  readonly fixtures: readonly ContentFixture[];
  readonly cosmetics: readonly Cosmetic[];
  readonly cosmeticPresets: readonly CosmeticPresetContent[];
  readonly dialogues: readonly Dialogue[];
  readonly onboarding: {
    readonly credits: number;
    readonly starterDeckIds: readonly string[];
    readonly inventory: readonly { readonly printingId: string; readonly count: number }[];
    readonly packs: readonly { readonly productId: string; readonly count: number }[];
    readonly cosmeticIds: readonly string[];
    readonly firstNodeId: string;
  };
};

export type BuiltBundle = ContentBundle & { readonly contentHash: string };
