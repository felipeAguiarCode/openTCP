// Conteúdo carregado: pacote BASE + publicações autorais do perfil (CUSTOM/LAB), indexados para consulta.
import { buildCatalog, type Catalog } from '../domain/cards/catalog.ts';
import type { CardDefinition, CardPrinting } from '../domain/cards/types.ts';
import { definitionKey } from '../domain/cards/types.ts';
import { searchKeyV1 } from '../domain/cards/naming.ts';
import { jcsHash } from '../domain/hash/jcs.ts';
import type {
  AiProfile, BuiltBundle, CampaignNode, Chapter, ContentDeck, ContentFixture, Cosmetic, Dialogue, Npc, Objective, Product, RewardTable,
} from '../content/types.ts';
import type { ContentInstall } from './ports/storage.ts';

export type ContentIndex = {
  readonly bundle: BuiltBundle;
  readonly catalog: Catalog;
  readonly nodes: ReadonlyMap<string, CampaignNode>;
  readonly nodeList: readonly CampaignNode[];
  readonly chapters: ReadonlyMap<string, Chapter>;
  readonly decks: ReadonlyMap<string, ContentDeck>;
  readonly products: ReadonlyMap<string, Product>;
  readonly objectives: ReadonlyMap<string, Objective>;
  readonly rewardTables: ReadonlyMap<string, RewardTable>;
  readonly npcs: ReadonlyMap<string, Npc>;
  readonly aiProfiles: ReadonlyMap<string, AiProfile>;
  readonly fixtures: ReadonlyMap<string, ContentFixture>;
  readonly cosmetics: ReadonlyMap<string, Cosmetic>;
  readonly dialogues: ReadonlyMap<string, Dialogue>;
  readonly starterPrintingIds: ReadonlySet<string>;
};

const byKey = <T, K extends keyof T>(list: readonly T[], key: K): Map<T[K] & string, T> => new Map(list.map((x) => [x[key] as T[K] & string, x]));

export function indexContent(bundle: BuiltBundle, custom: { definitions: readonly CardDefinition[]; printings: readonly CardPrinting[] } = { definitions: [], printings: [] }): ContentIndex {
  const catalog = buildCatalog([...bundle.cards, ...custom.definitions], [...bundle.printings, ...custom.printings]);
  const starterDecks = bundle.decks.filter((d) => d.kind === 'STARTER');
  return {
    bundle,
    catalog,
    nodes: byKey(bundle.nodes, 'nodeId'),
    nodeList: bundle.nodes,
    chapters: byKey(bundle.chapters, 'chapterId'),
    decks: byKey(bundle.decks, 'deckId'),
    products: byKey(bundle.products, 'productId'),
    objectives: byKey(bundle.objectives, 'objectiveId'),
    rewardTables: byKey(bundle.rewardTables, 'rewardTableId'),
    npcs: byKey(bundle.npcs, 'npcId'),
    aiProfiles: byKey(bundle.aiProfiles, 'aiProfileId'),
    fixtures: byKey(bundle.fixtures, 'fixtureId'),
    cosmetics: byKey(bundle.cosmetics, 'cosmeticId'),
    dialogues: byKey(bundle.dialogues, 'dialogueId'),
    starterPrintingIds: new Set(starterDecks.flatMap((d) => d.entries.map((e) => e.printingId))),
  };
}

/** Linhas para a instalação idempotente do pacote BASE no SQLite (persistencia §C18). */
export function contentInstallRows(bundle: BuiltBundle): ContentInstall {
  return {
    packageId: bundle.packageId,
    version: bundle.version,
    contentHash: bundle.contentHash,
    manifest: { packageId: bundle.packageId, version: bundle.version, campaignId: bundle.campaignId, cards: bundle.cards.length, printings: bundle.printings.length },
    definitions: bundle.cards.map((def) => ({ definitionId: def.id, version: def.version, rules: def as never, rulesHash: jcsHash(def), searchKey: searchKeyV1(def.name) })),
    printings: bundle.printings.map((p) => ({ printingId: p.printingId, definitionId: p.cardDefinitionId, definitionVersion: p.cardDefinitionVersion, appearance: p as never, appearanceHash: jcsHash(p) })),
  };
}

export function definitionOfPrinting(index: ContentIndex, printingId: string): CardDefinition {
  const p = index.catalog.printing(printingId);
  return index.catalog.definition(definitionKey(p.cardDefinitionId, p.cardDefinitionVersion));
}

export function deckCards(index: ContentIndex, entries: readonly { printingId: string }[]): { printingId: string; definitionKey: string }[] {
  return entries.map((e) => ({ printingId: e.printingId, definitionKey: index.catalog.definitionKeyOfPrinting(e.printingId) }));
}

export function contentDeckEntries(deck: ContentDeck): string[] {
  return deck.entries.flatMap((e) => Array.from({ length: e.count }, () => e.printingId));
}
