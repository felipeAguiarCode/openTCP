// Fixtures dos testes do Storage (Node + SQLite WASM em MEMFS). Usa o conteúdo inicial real (starter) para que
// regras e impressões passem pelos CHECKs do DDL exatamente como o pacote BASE passará.
import type {
  CommandType, CommitOk, CommitRequest, ContentInstall, DeckEntryRow, JsonValue, Mutation, StorageError,
} from '../../application/ports/storage.ts';
import { printing } from '../../content/builders.ts';
import * as S from '../../tests/support/generic-cards.ts';
import { searchKeyV1 } from '../../domain/cards/naming.ts';
import type { CardDefinition } from '../../domain/cards/types.ts';
import { jcsHash } from '../../domain/hash/jcs.ts';
import { commit, installContent, openAndMigrate } from './executor.ts';
import { openNodeDatabase, type NodeDatabase } from './node.ts';
import type { DB } from './sql.ts';

export const NOW = '2026-10-14T12:00:00.000Z';
export const PROFILE = 'profile-a';
export const CAMPAIGN = 'campaign-main';
export const PACK = 'PACK:pack-c01-v1';

export const STARTER_CARDS: readonly CardDefinition[] = [...S.STARTER_POKEMON, ...S.STARTER_TRAINERS];
export const STARTER_PRINTINGS = STARTER_CARDS.map((card, i) => printing({ card, setId: 'base', number: i + 1, rarity: 'COMMON' }));

export function asJson(value: unknown): JsonValue {
  return value as JsonValue;
}

export function printingIdOf(card: CardDefinition): string {
  const found = STARTER_PRINTINGS.find((p) => p.cardDefinitionId === card.id);
  if (!found) throw new Error(`sem impressão para ${card.id}`);
  return found.printingId;
}

export function starterInstall(version = '1.0.0', cards: readonly CardDefinition[] = STARTER_CARDS): ContentInstall {
  const definitions = cards.map((card) => {
    const rules = asJson(card);
    return { definitionId: card.id, version: card.version, rules, rulesHash: jcsHash(rules), searchKey: searchKeyV1(card.name) };
  });
  const printings = cards.map((card, i) => {
    const appearance = asJson(printing({ card, setId: 'base', number: i + 1, rarity: 'COMMON' }));
    const p = appearance as { printingId: string; cardDefinitionId: string; cardDefinitionVersion: number };
    return { printingId: p.printingId, definitionId: p.cardDefinitionId, definitionVersion: p.cardDefinitionVersion, appearance, appearanceHash: jcsHash(appearance) };
  });
  const manifest = asJson({ packageId: 'base', version, rulesetId: 'local-campaign-v2' });
  return {
    packageId: 'base',
    version,
    contentHash: jcsHash({ manifest, rules: definitions.map((d) => d.rulesHash), printings: printings.map((p) => p.appearanceHash) }),
    manifest,
    definitions,
    printings,
  };
}

const LINES = {
  FIRE: [S.faisca, S.braseiro, S.carvito, S.brasacu],
  WATER: [S.gota, S.marulho, S.nimbo, S.pluvion],
  GRASS: [S.broto, S.folhariz, S.semente, S.ramante],
} as const;
const TRAINERS = [S.kitReparo, S.rastreador, S.trocaTatica, S.estudioso, S.mentoria, S.talisma];

export function deckEntries(kind: keyof typeof LINES): DeckEntryRow[] {
  return [...LINES[kind], ...TRAINERS].flatMap((card) => [printingIdOf(card), printingIdOf(card)])
    .map((printingId, i) => ({ entryNo: i + 1, printingId, entryFlairId: null }));
}

export const RNG_0 = asJson({ economyRng: { algorithm: 'rng-v1', state: [1, 2, 3, 4], draws: 0 }, seedRng: { algorithm: 'rng-v1', state: [5, 6, 7, 8], draws: 0 } });

let commandSequence = 0;

export type RequestSpec = {
  readonly commandType: CommandType;
  readonly expectedRevision: number;
  readonly mutations: readonly Mutation[];
  readonly grantKeys?: readonly string[];
  readonly profileId?: string;
  readonly commandId?: string;
  readonly writerEpoch?: number;
  readonly payload?: JsonValue;
  readonly summary?: JsonValue;
};

export function request(spec: RequestSpec): CommitRequest {
  commandSequence += 1;
  const commandId = spec.commandId ?? `cmd-${commandSequence}`;
  return {
    commandId,
    profileId: spec.profileId ?? PROFILE,
    commandType: spec.commandType,
    payloadHash: jcsHash(spec.payload ?? { commandId, commandType: spec.commandType }),
    expectedRevision: spec.expectedRevision,
    writerEpoch: spec.writerEpoch ?? 0,
    mutations: spec.mutations,
    grantKeys: spec.grantKeys ?? [],
    receipt: { commandType: spec.commandType, summary: spec.summary ?? { note: commandId }, grants: spec.grantKeys ?? [] },
    committedAt: NOW,
  };
}

/** Onboarding no formato de CREATE_PROFILE_ONBOARDING: 300 Créditos, 2 pacotes, 3 decks confirmados, 2 cosméticos. */
export function onboardingRequest(profileId = PROFILE, overrides: Partial<RequestSpec> = {}): CommitRequest {
  const kinds = ['FIRE', 'WATER', 'GRASS'] as const;
  const copies = new Map<string, number>();
  for (const kind of kinds) for (const e of deckEntries(kind)) copies.set(e.printingId, (copies.get(e.printingId) ?? 0) + 1);
  const mutations: Mutation[] = [
    { kind: 'INSERT_PROFILE', displayName: 'Ana', progressionMode: 'STANDARD', rngJson: RNG_0 },
    { kind: 'WALLET_DELTA', resourceId: 'CREDITS', delta: 300 },
    { kind: 'WALLET_DELTA', resourceId: PACK, delta: 2 },
    ...[...copies].map(([printingId, delta]): Mutation => ({ kind: 'INVENTORY_DELTA', printingId, delta })),
    ...kinds.flatMap((kind): Mutation[] => [
      { kind: 'INSERT_DECK', deckId: `deck-${kind.toLowerCase()}-${profileId}`, name: `Deck ${kind}` },
      { kind: 'INSERT_DECK_VERSION', deckId: `deck-${kind.toLowerCase()}-${profileId}`, revision: 1, expectedHead: 0, status: 'CONFIRMED', energyTypes: [kind], validation: { ok: true }, entries: deckEntries(kind) },
    ]),
    { kind: 'GRANT_ENTITLEMENT', cosmeticId: 'playmat-default', origin: 'ONBOARDING' },
    { kind: 'GRANT_ENTITLEMENT', cosmeticId: 'sleeve-default', origin: 'ONBOARDING' },
    { kind: 'UPSERT_CAMPAIGN_PROGRESS', campaignId: CAMPAIGN, nodeId: 'node-1', campaignVersion: '1.0.0', status: 'AVAILABLE', progress: { completedObjectiveIds: [] } },
  ];
  return request({ commandType: 'CREATE_PROFILE_ONBOARDING', expectedRevision: 0, mutations, grantKeys: [`onboarding:${CAMPAIGN}`], profileId, ...overrides });
}

export async function migratedDatabase(filename?: string): Promise<NodeDatabase> {
  const database = await openNodeDatabase(filename);
  const opened = openAndMigrate(database.db, { now: NOW });
  if (!opened.ok) throw new Error(`${opened.code}: ${opened.message}`);
  return database;
}

export function expectCommitted(result: CommitOk | StorageError): CommitOk {
  if (!result.ok) throw new Error(`commit falhou: ${result.code}: ${result.message}`);
  return result;
}

/** Banco migrado + conteúdo inicial instalado + perfil `profile-a` em revisão 1. */
export async function seededDatabase(): Promise<NodeDatabase> {
  const database = await migratedDatabase();
  const installed = installContent(database.db, starterInstall(), NOW);
  if (!installed.ok) throw new Error(`${installed.code}: ${installed.message}`);
  expectCommitted(commit(database.db, onboardingRequest()));
  return database;
}

export function count(db: DB, table: string): number {
  return Number(db.selectValue(`SELECT count(*) FROM ${table}`));
}

/** Contagens de todas as tabelas: prova que uma falha não deixou escrita parcial. */
export function tableCounts(db: DB): Record<string, number> {
  const names = db.selectValues("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").map(String);
  return Object.fromEntries(names.map((name) => [name, count(db, name)]));
}

export function profileRevision(db: DB, profileId = PROFILE): number {
  return Number(db.selectValue('SELECT revision FROM profiles WHERE profile_id = ?', [profileId]));
}
