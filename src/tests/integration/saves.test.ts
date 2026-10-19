// Saves, backup e importação sobre o SQLite real (persistencia §23–§25; interface §31): perfil portátil formato 4
// (export → ZIP → leitura defensiva → validação → IMPORT_PROFILE num COMMIT), backup completo com manifesto,
// importação de perfil a partir de um backup e recusa de arquivos adulterados sem nenhuma escrita.
import { describe, expect, it } from 'vitest';
import { zipSync } from 'fflate';
import { aiShouldAct, resumeAttempt, runAiStep, startAttempt, submitHumanAction, suspendAttempt, HUMAN } from '../../application/battle.ts';
import { createCommandBus } from '../../application/commands.ts';
import { contentInstallRows, indexContent } from '../../application/content.ts';
import { observable, reloadSnapshot, type GameContext } from '../../application/context.ts';
import { buyProduct, openOwnedPack } from '../../application/economy.ts';
import type { AiPort } from '../../application/ports/ai.ts';
import { deterministicPlatform } from '../../application/ports/platform.ts';
import type { JsonValue, ProfileSnapshot } from '../../application/ports/storage.ts';
import { createProfile, selectProfile } from '../../application/profiles.ts';
import {
  archiveFromExportData, buildProfileArchive, exportFullBackup, exportProfileArchive, imageInfo, importProfileArchive, isProfileArchiveEntry,
  listProfileSummaries, parseBackupManifest, parseProfileArchive, precheckBackup, previewProfileImport, remapJson, renameProfile, type ParsedProfileArchive,
} from '../../application/saves.ts';
import { attack, pokemon, printing } from '../../content/builders.ts';
import * as S from '../support/generic-cards.ts';
import { getLegalActions } from '../../domain/battle/engine.ts';
import { searchKeyV1 } from '../../domain/cards/naming.ts';
import { jcsHash, sha256Hex, utf8 } from '../../domain/hash/jcs.ts';
import { PROFILE_ZIP_LIMITS, readZip, writeZip, type ZipLimits } from '../../infrastructure/files/zip.ts';
import { createMemoryStorage, openDatabaseFromBytes, loadNodeSqlite, uniqueDatabaseName, type MemoryStorage } from '../../infrastructure/storage/node.ts';
import { gatherProfileExport } from '../../infrastructure/storage/profile-export.ts';
import { inspectBackup } from '../../infrastructure/storage/restore.ts';
import { tableCounts } from '../../infrastructure/storage/test-support.ts';
import { schemaValidators } from '../../../tools/content-build/validate.ts';
import { miniBundle } from '../support/mini-bundle.ts';

const APP_VERSION = '1.0.0-test';

function testAi(): AiPort {
  return {
    plan: async (job) => {
      const legal = job.observation.legalActions;
      const pick = legal.find((a) => a.type === 'RESOLVE_DECISION') ?? legal.find((a) => a.type === 'PLAY_BASIC') ?? legal.find((a) => a.type === 'END_TURN') ?? legal[0]!;
      return { jobId: job.jobId, attemptId: job.attemptId, stateRevision: job.stateRevision, writerEpoch: job.writerEpoch, action: pick, aiRng: job.aiRng, nodesExplored: legal.length, fallback: false };
    },
    cancel: () => undefined,
    dispose: () => undefined,
  };
}

async function setup(start = 1): Promise<GameContext & { readonly storage: MemoryStorage }> {
  const storage = await createMemoryStorage();
  const bundle = miniBundle();
  const installed = await storage.installContent(contentInstallRows(bundle));
  expect(installed.ok).toBe(true);
  const platform = deterministicPlatform(start);
  return {
    storage, platform, bus: createCommandBus(storage, platform), content: observable(indexContent(bundle)),
    snapshot: observable<ProfileSnapshot | null>(null), ai: testAi(),
  };
}

/** PNG mínimo com IHDR (2×3): suficiente para assinatura e dimensões. */
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 2, 0, 0, 0, 3, 8, 6, 0, 0, 0, 0x12, 0x34, 0x56, 0x78]);
const PNG_ID = sha256Hex(PNG);
const PRESET_PNG = new Uint8Array([...PNG.slice(0, 19), 9, ...PNG.slice(20)]);
const PRESET_PNG_ID = sha256Hex(PRESET_PNG);

const customCard = pokemon({ id: 'custom-braseiro-ex', baseName: 'Braseiro', ruleBox: 'EX', stage: 'BASIC', type: 'FIRE', hp: 140, retreat: 2, weakness: 'WATER',
  attacks: [attack({ id: 'chama-ex', name: 'Chama ex', cost: { FIRE: 2 }, damage: 90 })] });
const customRules = customCard as unknown as JsonValue;
const customAppearance = { ...printing({ card: customCard, setId: 'custom', number: 1, rarity: 'RARE' }), artMode: 'FULL_ART', artKey: null, artAssetId: PNG_ID, assetBindings: [{ role: 'ART_MASTER', assetId: PNG_ID }] } as unknown as JsonValue;
const customPrintingId = (customAppearance as { printingId: string }).printingId;

async function playSomeActions(game: GameContext, session: Parameters<typeof suspendAttempt>[1], steps: number): Promise<void> {
  for (let i = 0; i < steps && !session.state.result; i += 1) {
    if (aiShouldAct(session)) { expect((await runAiStep(game, session)).ok).toBe(true); continue; }
    const legal = getLegalActions(session.state, game.content.get().catalog, HUMAN);
    const setupDecision = session.state.pendingDecisions.find((d) => d.player === HUMAN && d.kind === 'SETUP' && !d.answered);
    const action = setupDecision
      ? { type: 'RESOLVE_DECISION' as const, player: HUMAN, decisionId: setupDecision.decisionId, selection: setupDecision.options.slice(0, setupDecision.max) }
      : legal.find((a) => a.type === 'RESOLVE_DECISION') ?? legal.find((a) => a.type === 'PLAY_BASIC') ?? legal.find((a) => a.type === 'ATTACH_ENERGY') ?? legal.find((a) => a.type === 'END_TURN') ?? legal[0]!;
    const r = await submitHumanAction(game, session, action);
    expect(r.ok).toBe(true);
  }
}

/** Perfil “cheio”: onboarding, pacote, compra, duelo suspenso, fichário, marcas, preferências, carta autoral com arte, preset com asset, projeto e teste. */
async function richProfile(game: GameContext): Promise<string> {
  const created = await createProfile(game, { displayName: 'Ana Exportada', favoriteDeckId: 'starter-fire' });
  if (!created.ok) throw new Error(created.message);
  expect(await selectProfile(game, created.profileId)).toBe(true);
  expect((await openOwnedPack(game, 'pack-base-v1')).ok).toBe(true);
  expect((await buyProduct(game, 'pack-base-v1')).ok).toBe(true);
  const profileId = created.profileId;
  let snap = game.snapshot.get()!;

  // Carta autoral publicada pelo próprio perfil, com arte BLOB, projeto do Estúdio e execução de teste.
  expect((await game.storage.write({ kind: 'CREATE_EDITOR_PROJECT', profileId, projectId: 'project-x', title: 'Braseiro ex', mode: 'NEW_DEFINITION', targetDefinitionId: customCard.id, sourceDefinitionId: null, sourceVersion: null })).ok).toBe(true);
  expect((await game.storage.write({ kind: 'SAVE_EDITOR_REVISION', projectId: 'project-x', expectedHead: 0, revision: 1, revisionKind: 'MANUAL', draft: { draftFormat: 1, note: 'project-x' }, validationSummary: { errors: 0 }, assetRefs: [], keepAutoRevisions: 20 })).ok).toBe(true);
  const published = await game.bus.execute({
    commandType: 'PUBLISH_CARD', profileId, expectedRevision: snap.profile.revision, writerEpoch: snap.profile.writerEpoch, payload: { projectId: 'project-x' },
    mutations: [
      { kind: 'INSERT_ASSET_BLOB', assetId: PNG_ID, mediaType: 'image/png', bytes: PNG, width: 2, height: 3, metadata: {} },
      { kind: 'INSERT_CARD_DEFINITION', definitionId: customCard.id, namespace: 'CUSTOM' },
      { kind: 'INSERT_CARD_VERSION', definitionId: customCard.id, version: 1, rules: customRules, rulesHash: jcsHash(customRules), rulesetId: 'local-campaign-v2', searchKey: searchKeyV1(customCard.name) },
      { kind: 'INSERT_EDITOR_REVISION_PUBLISHED', projectId: 'project-x', revision: 2, draft: { draftFormat: 1 }, validationSummary: { errors: 0 }, assetRefs: [{ role: 'ART_MASTER', assetId: PNG_ID }] },
      { kind: 'INSERT_PUBLICATION', definitionId: customCard.id, version: 1, validatorVersion: 'validator-1', report: { errors: [] }, projectId: 'project-x', projectRevision: 2 },
      { kind: 'INSERT_PRINTING', printingId: customPrintingId, definitionId: customCard.id, definitionVersion: 1, appearance: customAppearance, appearanceHash: jcsHash(customAppearance) },
      { kind: 'INSERT_CARD_DEPENDENCY', definitionId: customCard.id, version: 1, dependencyId: S.braseiro.id, dependencyVersion: 1, dependencyKind: 'REFERENCE' },
      { kind: 'SET_CATALOG_HEAD', definitionId: customCard.id, version: 1 },
    ],
    summary: { definitionId: customCard.id },
  });
  expect(published.ok).toBe(true);
  expect((await game.storage.write({ kind: 'INSERT_TEST_RUN', runId: 'run-x', projectId: 'project-x', revision: 2, runnerVersion: 'runner-1', rulesHash: jcsHash(customRules), scenario: { seed: 1 }, result: { ok: true }, outcome: 'PASS' })).ok).toBe(true);
  snap = (await reloadSnapshot(game))!;
  const granted = await game.bus.execute({
    commandType: 'GRANT_CUSTOM_COPIES', profileId, expectedRevision: snap.profile.revision, writerEpoch: snap.profile.writerEpoch, payload: { printingId: customPrintingId },
    mutations: [{ kind: 'INVENTORY_DELTA', printingId: customPrintingId, delta: 2 }], grantKeys: [`custom-grant:${customPrintingId}:batch-1`], summary: { copies: 2 },
  });
  expect(granted.ok).toBe(true);
  snap = (await reloadSnapshot(game))!;

  // Preset com asset aplicado ao perfil e a um deck; rascunho da oficina; fichário; marcas; preferências.
  const deckId = snap.decks.find((d) => d.name === 'Chama Constante')!.deckId;
  const preset = await game.bus.execute({
    commandType: 'APPLY_APPEARANCE', profileId, expectedRevision: snap.profile.revision, writerEpoch: snap.profile.writerEpoch, payload: { preset: 1 },
    mutations: [
      { kind: 'INSERT_ASSET_BLOB', assetId: PRESET_PNG_ID, mediaType: 'image/png', bytes: PRESET_PNG, width: 2, height: 3, metadata: {} },
      { kind: 'INSERT_COSMETIC_PRESET', presetId: 'preset-x', revision: 1, config: { presetId: 'preset-x', name: 'Meu tapete', deckId }, assetIds: [PRESET_PNG_ID] },
      { kind: 'SET_PROFILE_APPEARANCE', presetId: 'preset-x', presetRevision: 1 },
      { kind: 'SET_DECK_APPEARANCE', deckId, mode: 'OVERRIDE', presetId: 'preset-x', presetRevision: 1 },
    ],
    summary: { presetId: 'preset-x' },
  });
  expect(preset.ok).toBe(true);
  expect((await game.storage.write({ kind: 'SAVE_APPEARANCE_DRAFT', profileId, contextId: 'workshop', revision: 1, draft: { tint: 'azul' }, assetIds: [PRESET_PNG_ID] })).ok).toBe(true);
  snap = (await reloadSnapshot(game))!;
  const owned = snap.inventory.filter((i) => i.quantity > 0).map((i) => i.printingId);
  const binder = await game.bus.execute({
    commandType: 'SAVE_BINDER', profileId, expectedRevision: snap.profile.revision, writerEpoch: snap.profile.writerEpoch, payload: { binderId: 'binder-x' },
    mutations: [{ kind: 'UPSERT_BINDER', binderId: 'binder-x', name: 'Favoritas', binderKind: 'BINDER', layout: { pages: 1, background: 'sky', featuredPrintingId: customPrintingId }, sortOrder: 0,
      slots: [{ pageNo: 1, slotNo: 1, printingId: customPrintingId }, { pageNo: 1, slotNo: 2, printingId: owned[0]! }] }],
    summary: { binderId: 'binder-x' },
  });
  expect(binder.ok).toBe(true);
  expect((await game.storage.write({ kind: 'MARK_COLLECTION', profileId, markKind: 'FAVORITE', subjectKind: 'PRINTING', subjectId: customPrintingId, on: true })).ok).toBe(true);
  expect((await game.storage.write({ kind: 'SET_SETTINGS', profileId, values: { 'ui.textScale': 1.2, displayNameOverride: 'Ana Renomeada' } })).ok).toBe(true);
  await reloadSnapshot(game);

  // Duelo de campanha jogado por algumas ações e suspenso (tentativa + eventos + checkpoints).
  const started = await startAttempt(game, { mode: 'CAMPAIGN', nodeId: 'T01', difficulty: 'STANDARD', deckId });
  if (!started.ok) throw new Error(started.message);
  await playSomeActions(game, started.session, 6);
  expect(await suspendAttempt(game, started.session)).toBe(true);
  await reloadSnapshot(game);
  return profileId;
}

async function zipOf(game: GameContext, profileId: string): Promise<Uint8Array> {
  const exported = await exportProfileArchive(game, profileId, { appVersion: APP_VERSION });
  if (!exported.ok) throw new Error(exported.message);
  expect(exported.fileName).toMatch(/^ana-renomeada-\d{4}-\d{2}-\d{2}\.campaign-profile\.zip$/);
  return writeZip(exported.files.map((f) => ({ name: f.name, bytes: f.bytes, compress: f.compress })));
}

function parseZip(bytes: Uint8Array, limits: ZipLimits = PROFILE_ZIP_LIMITS) {
  const read = readZip(bytes, limits, isProfileArchiveEntry);
  if (!read.ok) return read;
  return parseProfileArchive(read.entries);
}

function mustParse(bytes: Uint8Array): ParsedProfileArchive {
  const parsed = parseZip(bytes);
  if (!parsed.ok) throw new Error(`${parsed.code}: ${parsed.message}`);
  return parsed.archive;
}

/** Projeção comparável de um perfil: tudo o que o jogador vê, com IDs locais trocados por nomes estáveis. */
function comparable(snap: ProfileSnapshot) {
  const deckName = new Map(snap.decks.map((d) => [d.deckId, d.name]));
  return {
    wallets: snap.wallets,
    inventory: [...snap.inventory].sort((a, b) => a.printingId.localeCompare(b.printingId)),
    decks: snap.decks.map((d) => ({ name: d.name, status: d.status, headRevision: d.headRevision, entries: d.entries, energyTypes: d.energyTypes, archived: d.archived, appearance: d.appearance ? d.appearance.mode : null }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    campaignProgress: snap.campaignProgress,
    entitlements: snap.entitlements,
    pendingRewards: snap.pendingRewards.length,
    grants: [...snap.grants].sort(),
    settings: { ...snap.settings, favoriteDeckId: deckName.get(String(snap.settings.favoriteDeckId)) ?? null },
    activeAttempt: snap.activeAttempt ? { status: snap.activeAttempt.status, nodeId: snap.activeAttempt.nodeId, deck: deckName.get(snap.activeAttempt.deckId ?? ''), stateVersion: snap.activeAttempt.stateVersion } : null,
    appearance: snap.appearance ? { presetRevision: snap.appearance.presetRevision } : null,
    presets: snap.presets.map((p) => ({ revision: p.revision, name: (p.config as { name?: string }).name })),
    binders: snap.binders.map((b) => ({ name: b.name, kind: b.kind, slots: b.slots })),
    marks: snap.marks,
    progressionMode: snap.profile.progressionMode,
    displayName: snap.profile.displayName,
  };
}

describe('perfil portátil .campaign-profile.zip formato 4 (persistencia §24.1)', () => {
  it('exporta só o perfil escolhido, com manifesto no formato da spec e conteúdo autoral válido pelos schemas', async () => {
    const game = await setup();
    const profileId = await richProfile(game);
    const other = await createProfile(game, { displayName: 'Outra', favoriteDeckId: 'starter-water' });
    expect(other.ok).toBe(true);
    const exported = await exportProfileArchive(game, profileId, { appVersion: APP_VERSION });
    if (!exported.ok) throw new Error(exported.message);
    const names = exported.files.map((f) => f.name);
    expect(names).toEqual(['manifest.json', 'profile.json', 'content/card-versions.json', 'content/printings.json', 'content/projects.json', `assets/${PNG_ID}.png`, `assets/${PRESET_PNG_ID}.png`].sort((a, b) => names.indexOf(a) - names.indexOf(b)));
    expect(names).toHaveLength(7);
    const m = exported.manifest;
    expect(Object.keys(m).sort()).toEqual(['appVersion', 'assets', 'contentRefs', 'exportedAt', 'format', 'formatVersion', 'profileId'].sort());
    expect(m).toMatchObject({ format: 'card-campaign-profile', formatVersion: 4, profileId, appVersion: APP_VERSION, exportedAt: '2026-10-14T00:00:00Z' });
    expect(m.contentRefs.packages).toEqual([{ packageId: 'base', version: '0.0.1-test', contentHash: game.content.get().bundle.contentHash }]);
    expect(m.contentRefs.cardVersions).toEqual([{ definitionId: customCard.id, version: 1, rulesHash: jcsHash(customRules) }]);
    expect(m.assets).toEqual([PNG_ID, PRESET_PNG_ID].sort().map((sha256) => ({ sha256, bytes: PNG.length, mediaType: 'image/png' })));
    // DB-045: nada do outro perfil.
    const all = new TextDecoder().decode(exported.files.find((f) => f.name === 'profile.json')!.bytes);
    expect(all).not.toContain(other.ok ? other.profileId : '');
    expect(all).not.toContain('Outra');
    expect(all).not.toContain('writer_epoch');
    expect(all).not.toContain('writerEpoch');
    // Conteúdo autoral conforme os schemas de .specs/schemas.
    const validators = schemaValidators();
    const versions = JSON.parse(new TextDecoder().decode(exported.files.find((f) => f.name === 'content/card-versions.json')!.bytes)) as { versions: { rules: unknown }[] };
    for (const v of versions.versions) expect(validators.card(v.rules), JSON.stringify(validators.card.errors)).toBe(true);
    const printings = JSON.parse(new TextDecoder().decode(exported.files.find((f) => f.name === 'content/printings.json')!.bytes)) as { printings: { appearance: unknown }[] };
    expect(printings.printings).toHaveLength(1);
    for (const p of printings.printings) expect(validators.printing(p.appearance), JSON.stringify(validators.printing.errors)).toBe(true);
  }, 120_000);

  it('round-trip: importar cria um perfil NOVO equivalente (coleção, decks, progresso, concessões) e o duelo continua', async () => {
    const game = await setup();
    const profileId = await richProfile(game);
    const before = comparable((await game.storage.query({ kind: 'PROFILE_SNAPSHOT', profileId }))!);
    const zip = await zipOf(game, profileId);
    const archive = mustParse(zip);
    const fingerprint = sha256Hex(zip);

    // Outra instalação (banco novo, mesmo pacote): conteúdo autoral e BLOBs entram com o perfil novo como dono.
    const target = await setup(5000);
    const preview = await previewProfileImport(target, archive, fingerprint, target.content.get());
    expect(preview).toMatchObject({ state: 'VALID', blocking: [], profileName: 'Ana Renomeada', nodesCleared: 0, customCards: 1, assets: 2, suspendedDuel: true });
    expect(preview.cardsOwned).toBe(before.inventory.reduce((s, i) => s + i.quantity, 0));
    const imported = await importProfileArchive(target, archive, { fingerprint, content: target.content.get() });
    if (!imported.ok) throw new Error(`${imported.code}: ${imported.message}`);
    expect(imported.profileId).not.toBe(profileId);
    const after = (await target.storage.query({ kind: 'PROFILE_SNAPSHOT', profileId: imported.profileId }))!;
    expect(comparable(after)).toEqual(before);
    expect(after.profile.revision).toBe(archive.rows.operations.length + 1);
    const receipts = await target.storage.query({ kind: 'LIST_RECEIPTS', profileId: imported.profileId, limit: 500, offset: 0 });
    expect(receipts[0]?.commandType).toBe('IMPORT_PROFILE');
    expect(receipts).toHaveLength(archive.rows.operations.length + 1);
    const db = target.storage.database.db;
    expect(db.selectObject('SELECT source_kind, source_fingerprint, target_profile_id FROM profile_imports')).toEqual({ source_kind: 'PROFILE_ZIP_4', source_fingerprint: fingerprint, target_profile_id: imported.profileId });
    expect(db.selectValue('SELECT owner_profile_id FROM card_definitions WHERE definition_id = ?', [customCard.id])).toBe(imported.profileId);
    expect(db.selectValues('SELECT asset_id FROM assets ORDER BY asset_id')).toEqual([PNG_ID, PRESET_PNG_ID].sort());
    expect(db.selectObject('SELECT width, height FROM assets WHERE asset_id = ?', [PNG_ID])).toEqual({ width: 2, height: 3 });
    expect(db.selectValue('PRAGMA integrity_check')).toBe('ok');
    expect(db.selectArrays('PRAGMA foreign_key_check')).toEqual([]);
    const projects = await target.storage.query({ kind: 'LIST_PROJECTS', profileId: imported.profileId, includeArchived: true });
    expect(projects).toHaveLength(1);
    expect(projects[0]?.projectId).not.toBe('project-x');
    expect(await target.storage.query({ kind: 'LIST_TEST_RUNS', projectId: projects[0]!.projectId })).toHaveLength(1);
    expect(db.selectValue('SELECT project_id FROM card_publications WHERE definition_id = ?', [customCard.id])).toBe(projects[0]!.projectId);

    // O duelo suspenso é retomado no perfil novo e aceita novas ações.
    expect(await selectProfile(target, imported.profileId)).toBe(true);
    const resumed = await resumeAttempt(target);
    if (!resumed.ok) throw new Error(resumed.message);
    expect(resumed.session.attemptId).toBe(after.activeAttempt?.attemptId);
    await playSomeActions(target, resumed.session, 3);
  }, 180_000);

  it('importar o mesmo arquivo duas vezes cria dois perfis (fingerprint não único) e reutiliza o conteúdo por ID + hash', async () => {
    const game = await setup();
    const profileId = await richProfile(game);
    const zip = await zipOf(game, profileId);
    const archive = mustParse(zip);
    const fingerprint = sha256Hex(zip);
    const first = await importProfileArchive(game, archive, { fingerprint });
    const preview = await previewProfileImport(game, archive, fingerprint);
    expect(preview.warnings.join(' ')).toMatch(/já foi importado 1 vez/);
    expect(preview.preflight.reusedVersions).toBe(1);
    const second = await importProfileArchive(game, archive, { fingerprint });
    if (!first.ok || !second.ok) throw new Error('importação falhou');
    expect(new Set([profileId, first.profileId, second.profileId]).size).toBe(3);
    const db = game.storage.database.db;
    expect(db.selectValue('SELECT count(*) FROM profile_imports WHERE source_fingerprint = ?', [fingerprint])).toBe(2);
    expect(db.selectValue('SELECT count(*) FROM card_versions WHERE definition_id = ?', [customCard.id])).toBe(1);
    const summaries = await listProfileSummaries(game, game.content.get());
    expect(summaries.filter((s) => s.displayName === 'Ana Renomeada')).toHaveLength(3);
    // Nenhum dado mesclado: cada perfil tem a própria carteira e o próprio histórico.
    const ops = db.selectArrays('SELECT profile_id, count(*) FROM operations GROUP BY profile_id ORDER BY profile_id');
    expect(ops).toHaveLength(3);
  }, 180_000);

  it('substituir: o perfil novo entra e o antigo é arquivado depois do COMMIT, sem mescla', async () => {
    const game = await setup();
    const profileId = await richProfile(game);
    const archive = mustParse(await zipOf(game, profileId));
    const replaced = await importProfileArchive(game, archive, { fingerprint: '1'.repeat(64), replaceProfileId: profileId });
    if (!replaced.ok) throw new Error(replaced.message);
    expect(replaced.archivedProfileId).toBe(profileId);
    const profiles = await game.storage.query({ kind: 'LIST_PROFILES', includeArchived: true });
    expect(profiles.find((p) => p.profileId === profileId)?.archived).toBe(true);
    expect(profiles.find((p) => p.profileId === replaced.profileId)?.archived).toBe(false);
  }, 180_000);

  it('DB-047: mesmo ID de versão com regras diferentes no destino bloqueia a importação sem escrita', async () => {
    const game = await setup();
    const profileId = await richProfile(game);
    const archive = mustParse(await zipOf(game, profileId));
    const target = await setup(9000);
    const host = await createProfile(target, { displayName: 'Dona', favoriteDeckId: 'starter-grass' });
    if (!host.ok) throw new Error(host.message);
    const snap = (await reloadSnapshot(target, host.profileId))!;
    const different = { ...customCard, hp: 150 } as unknown as JsonValue;
    expect((await target.bus.execute({
      commandType: 'PUBLISH_CARD', profileId: host.profileId, expectedRevision: snap.profile.revision, writerEpoch: snap.profile.writerEpoch, payload: { x: 1 },
      mutations: [
        { kind: 'INSERT_CARD_DEFINITION', definitionId: customCard.id, namespace: 'CUSTOM' },
        { kind: 'INSERT_CARD_VERSION', definitionId: customCard.id, version: 1, rules: different, rulesHash: jcsHash(different), rulesetId: 'local-campaign-v2', searchKey: searchKeyV1(customCard.name) },
      ],
      summary: {},
    })).ok).toBe(true);
    const before = tableCounts(target.storage.database.db);
    const preview = await previewProfileImport(target, archive, '2'.repeat(64));
    expect(preview.blocking.join(' ')).toMatch(/regras diferentes/);
    const result = await importProfileArchive(target, archive, { fingerprint: '2'.repeat(64) });
    expect(result).toMatchObject({ ok: false, code: 'IMPORT_INVALID' });
    expect(tableCounts(target.storage.database.db)).toEqual(before);
  }, 180_000);
});

describe('arquivos de perfil maliciosos ou adulterados são recusados antes de qualquer escrita (DB-049, R-080, R-027)', () => {
  async function exportedEntries(): Promise<{ game: GameContext & { storage: MemoryStorage }; entries: Map<string, Uint8Array>; profileId: string }> {
    const game = await setup();
    const profileId = await richProfile(game);
    const exported = await exportProfileArchive(game, profileId, { appVersion: APP_VERSION });
    if (!exported.ok) throw new Error(exported.message);
    return { game, profileId, entries: new Map(exported.files.map((f) => [f.name, f.bytes])) };
  }

  const editJson = (entries: Map<string, Uint8Array>, name: string, edit: (doc: Record<string, unknown>) => void): Map<string, Uint8Array> => {
    const copy = new Map(entries);
    const doc = JSON.parse(new TextDecoder().decode(copy.get(name)!)) as Record<string, unknown>;
    edit(doc);
    copy.set(name, utf8(JSON.stringify(doc)));
    return copy;
  };

  it('checksum adulterado, regras alteradas, saldo inventado e versão futura', async () => {
    const { game, entries } = await exportedEntries();
    const before = tableCounts(game.storage.database.db);

    const badAsset = new Map(entries);
    const art = badAsset.get(`assets/${PNG_ID}.png`)!.slice();
    art[art.length - 1] = (art[art.length - 1] ?? 0) ^ 0xff;
    badAsset.set(`assets/${PNG_ID}.png`, art);
    expect(parseProfileArchive(badAsset)).toMatchObject({ ok: false, code: 'IMPORT_INVALID', state: 'CHECKSUM_MISMATCH' });

    const badRules = editJson(entries, 'content/card-versions.json', (doc) => { ((doc.versions as Record<string, unknown>[])[0]!.rules as Record<string, unknown>).hp = 999; });
    expect(parseProfileArchive(badRules)).toMatchObject({ ok: false, state: 'CHECKSUM_MISMATCH' });

    const richer = editJson(entries, 'profile.json', (doc) => { (doc.wallets as { resourceId: string; balance: number }[]).find((w) => w.resourceId === 'CREDITS')!.balance = 999_999; });
    const rich = parseProfileArchive(richer);
    expect(rich).toMatchObject({ ok: false, code: 'IMPORT_INVALID', state: 'INVALID_FORMAT' });
    if (!rich.ok) expect(rich.message).toMatch(/livro-razão|saldo/);

    const future = editJson(entries, 'manifest.json', (doc) => { doc.formatVersion = 5; });
    expect(parseProfileArchive(future)).toMatchObject({ ok: false, code: 'SAVE_VERSION_UNSUPPORTED', state: 'FUTURE_VERSION' });
    const old = editJson(entries, 'manifest.json', (doc) => { doc.formatVersion = 3; });
    expect(parseProfileArchive(old)).toMatchObject({ ok: false, code: 'SAVE_VERSION_UNSUPPORTED', state: 'INVALID_FORMAT' });
    const notProfile = editJson(entries, 'manifest.json', (doc) => { doc.format = 'card-campaign-cardpack'; });
    expect(parseProfileArchive(notProfile)).toMatchObject({ ok: false, code: 'IMPORT_INVALID' });

    const unlisted = new Map(entries);
    unlisted.set(`assets/${'a'.repeat(64)}.png`, PNG);
    expect(parseProfileArchive(unlisted)).toMatchObject({ ok: false, state: 'CHECKSUM_MISMATCH' });

    const fakeImage = new Map(entries);
    const text = utf8('<script>alert(1)</script>');
    const textId = sha256Hex(text);
    fakeImage.set(`assets/${textId}.png`, text);
    const withFake = editJson(fakeImage, 'manifest.json', (doc) => { (doc.assets as unknown[]).push({ sha256: textId, bytes: text.length, mediaType: 'image/png' }); });
    expect(parseProfileArchive(withFake)).toMatchObject({ ok: false, code: 'IMPORT_INVALID' });

    expect(tableCounts(game.storage.database.db)).toEqual(before);
  }, 120_000);

  it('ZIP com traversal, nomes absolutos, entrada não prevista, excesso de entradas, bomba de descompressão e link simbólico', async () => {
    const { entries } = await exportedEntries();
    const valid = Object.fromEntries([...entries].map(([k, v]) => [k, v]));
    for (const evil of ['../evil.json', 'assets/../../evil.png', '/etc/passwd', 'C:/Windows/evil', 'content\\..\\evil.json']) {
      const zip = zipSync({ ...valid, [evil]: utf8('{}') });
      const read = readZip(zip, PROFILE_ZIP_LIMITS, isProfileArchiveEntry);
      expect(read.ok, evil).toBe(false);
      if (!read.ok) expect(['BAD_NAME', 'NOT_ALLOWED']).toContain(read.reason);
    }
    const script = readZip(zipSync({ ...valid, 'run.js': utf8('alert(1)') }), PROFILE_ZIP_LIMITS, isProfileArchiveEntry);
    expect(script).toMatchObject({ ok: false, reason: 'NOT_ALLOWED' });

    const many: Record<string, Uint8Array> = {};
    for (let i = 0; i < 1100; i += 1) many[`assets/${sha256Hex(String(i))}.png`] = PNG;
    expect(readZip(zipSync(many), PROFILE_ZIP_LIMITS, isProfileArchiveEntry)).toMatchObject({ ok: false, reason: 'TOO_MANY_ENTRIES' });

    const small: ZipLimits = { maxArchiveBytes: 1024 * 1024, maxTotalBytes: 64 * 1024, maxEntries: 16, maxEntryBytes: 32 * 1024 };
    expect(readZip(zipSync({ 'profile.json': new Uint8Array(40 * 1024) }), small, isProfileArchiveEntry)).toMatchObject({ ok: false, reason: 'TOO_LARGE' });
    expect(readZip(new Uint8Array(2 * 1024 * 1024), small, isProfileArchiveEntry)).toMatchObject({ ok: false, reason: 'TOO_LARGE' });

    // Bomba: 8 MiB de zeros comprimidos, com tamanho declarado mentindo (100 bytes) no diretório central e no cabeçalho local.
    const bomb = zipSync({ 'profile.json': new Uint8Array(8 * 1024 * 1024) });
    const view = new DataView(bomb.buffer, bomb.byteOffset, bomb.byteLength);
    view.setUint32(22, 100, true);
    const eocd = bomb.length - 22;
    const cd = view.getUint32(eocd + 16, true);
    view.setUint32(cd + 24, 100, true);
    expect(readZip(bomb, PROFILE_ZIP_LIMITS, isProfileArchiveEntry)).toMatchObject({ ok: false, reason: 'TOO_LARGE' });

    // Link simbólico (atributos Unix S_IFLNK no diretório central).
    const link = zipSync({ 'profile.json': utf8('/etc/passwd') });
    const lv = new DataView(link.buffer, link.byteOffset, link.byteLength);
    const lcd = lv.getUint32(link.length - 22 + 16, true);
    lv.setUint16(lcd + 4, (3 << 8) | 20, true);
    lv.setUint32(lcd + 38, (0o120777 << 16) >>> 0, true);
    expect(readZip(link, PROFILE_ZIP_LIMITS, isProfileArchiveEntry)).toMatchObject({ ok: false, reason: 'SYMLINK' });

    // E o arquivo íntegro passa.
    expect(readZip(zipSync(valid), PROFILE_ZIP_LIMITS, isProfileArchiveEntry).ok).toBe(true);
  }, 120_000);
});

describe('backup completo .sqlite3 + manifesto (persistencia §23)', () => {
  it('DB-044: exporta bytes de um SQLite comum com manifesto medido; a pré-checagem confere transporte e versões', async () => {
    const game = await setup();
    await richProfile(game);
    const result = await exportFullBackup(game, { appVersion: APP_VERSION });
    if (!result.ok) throw new Error(result.message);
    const { database, manifest, files } = result.backup;
    expect(files).toEqual({ databaseName: 'card-campaign-2026-10-14T00-00-00Z.sqlite3', manifestName: 'card-campaign-2026-10-14T00-00-00Z.backup.json', zipName: 'card-campaign-2026-10-14T00-00-00Z.backup.zip' });
    expect(manifest).toEqual({
      format: 'card-campaign-database-backup', formatVersion: 1, schemaVersion: 1, applicationId: 1128354372, databaseFile: files.databaseName,
      databaseSha256: sha256Hex(database), databaseBytes: database.length, createdAt: '2026-10-14T00:00:00Z', appVersion: APP_VERSION,
      sqliteVersion: expect.stringMatching(/^3\.\d+\.\d+$/) as unknown as string, includesAllProfiles: true, includesImportedAssetBytes: true, bundledAssetsIncluded: false,
      requiredContentPackages: [{ packageId: 'base', version: '0.0.1-test', contentHash: game.content.get().bundle.contentHash }],
    });
    const reopened = await openDatabaseFromBytes(database);
    expect(reopened.db.selectValue('PRAGMA integrity_check')).toBe('ok');
    expect(reopened.db.selectArrays('PRAGMA foreign_key_check')).toEqual([]);
    expect(reopened.db.selectValue("SELECT count(*) FROM assets WHERE storage_kind = 'BLOB'")).toBe(2);
    reopened.db.close();

    const manifestBytes = utf8(JSON.stringify(manifest));
    const ok = await precheckBackup(game, { fileName: files.databaseName, database, manifest: manifestBytes }, game.content.get());
    expect(ok).toMatchObject({ ok: true, schemaVersion: 1, sha256: sha256Hex(database) });
    const tamperedDb = database.slice();
    tamperedDb[tamperedDb.length - 10] = (tamperedDb[tamperedDb.length - 10] ?? 0) ^ 0x01;
    expect(await precheckBackup(game, { fileName: files.databaseName, database: tamperedDb, manifest: manifestBytes }, game.content.get()))
      .toMatchObject({ ok: false, code: 'IMPORT_INVALID', state: 'CHECKSUM_MISMATCH' });
    const missingPackage = utf8(JSON.stringify({ ...manifest, requiredContentPackages: [{ packageId: 'base', version: '9.9.9', contentHash: 'f'.repeat(64) }] }));
    expect(await precheckBackup(game, { fileName: files.databaseName, database, manifest: missingPackage }, game.content.get()))
      .toMatchObject({ ok: false, code: 'CONTENT_REFERENCE_MISSING', state: 'MISSING_CONTENT' });
    const noManifest = await precheckBackup(game, { fileName: 'x.sqlite3', database, manifest: null }, game.content.get());
    expect(noManifest.ok && noManifest.warnings.join(' ')).toMatch(/Sem manifesto/);
    expect(parseBackupManifest(utf8(JSON.stringify({ ...manifest, formatVersion: 2 })))).toMatchObject({ ok: false, state: 'FUTURE_VERSION' });
    const future = database.slice();
    new DataView(future.buffer).setInt32(60, 2, false);
    expect(await precheckBackup(game, { fileName: 'x.sqlite3', database: future, manifest: null }, game.content.get()))
      .toMatchObject({ ok: false, code: 'SAVE_VERSION_UNSUPPORTED', state: 'FUTURE_VERSION' });
    expect(await precheckBackup(game, { fileName: 'x.sqlite3', database: utf8('não é sqlite'.repeat(20)), manifest: null }, game.content.get()))
      .toMatchObject({ ok: false, state: 'INVALID_FORMAT' });
  }, 120_000);

  it('importar um perfil de dentro de um backup cria perfil novo com source_kind DATABASE_BACKUP', async () => {
    const source = await setup();
    const profileId = await richProfile(source);
    const backup = await exportFullBackup(source, { appVersion: APP_VERSION });
    if (!backup.ok) throw new Error(backup.message);
    const sqlite3 = await loadNodeSqlite();
    const inspected = inspectBackup(sqlite3, backup.backup.database, { now: '2026-10-14T00:00:00.000Z', stagingName: uniqueDatabaseName() });
    if (!inspected.ok) throw new Error(inspected.message);
    expect(inspected.inspection.profiles.map((p) => p.displayName)).toEqual(['Ana Renomeada']);
    const data = gatherProfileExport(inspected.staging, profileId);
    inspected.staging.close();
    if (!data) throw new Error('perfil ausente');
    const archive = archiveFromExportData(data, { appVersion: APP_VERSION, exportedAt: '2026-10-14T00:00:00.000Z' });
    if (!archive.ok) throw new Error(archive.message);
    const target = await setup(7000);
    const imported = await importProfileArchive(target, archive.archive, { fingerprint: backup.backup.manifest.databaseSha256, sourceKind: 'DATABASE_BACKUP' });
    if (!imported.ok) throw new Error(imported.message);
    expect(target.storage.database.db.selectValue('SELECT source_kind FROM profile_imports')).toBe('DATABASE_BACKUP');
    const snap = await target.storage.query({ kind: 'PROFILE_SNAPSHOT', profileId: imported.profileId });
    expect(snap?.decks.length).toBe(3);
  }, 180_000);
});

describe('utilidades', () => {
  it('remapJson troca IDs locais em valores e chaves, sem tocar no resto', () => {
    const ids = new Map([['deck-1', 'deck-9'], ['attempt-1', 'attempt-9']]);
    expect(remapJson({ deckId: 'deck-1', list: ['attempt-1', 'x'], map: { 'deck-1': 2 }, n: 1 }, ids)).toEqual({ deckId: 'deck-9', list: ['attempt-9', 'x'], map: { 'deck-9': 2 }, n: 1 });
  });

  it('imageInfo reconhece PNG, JPEG e WebP pelo cabeçalho e recusa o resto', () => {
    expect(imageInfo(PNG)).toEqual({ mediaType: 'image/png', width: 2, height: 3 });
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, 0, 5, 0, 7, 3, 1, 0x11, 0]);
    expect(imageInfo(jpeg)).toEqual({ mediaType: 'image/jpeg', width: 7, height: 5 });
    const webp = new Uint8Array(30);
    webp.set(utf8('RIFF'), 0); webp.set(utf8('WEBPVP8X'), 8); webp.set([9, 0, 0, 4, 0, 0], 24);
    expect(imageInfo(webp)).toEqual({ mediaType: 'image/webp', width: 10, height: 5 });
    expect(imageInfo(utf8('GIF89a...........'))).toBeNull();
  });

  it('renomear grava só a preferência local; o nome original fica no histórico', async () => {
    const game = await setup();
    const created = await createProfile(game, { displayName: 'Original', favoriteDeckId: 'starter-fire' });
    if (!created.ok) throw new Error(created.message);
    expect(await renameProfile(game, created.profileId, '  Novo nome  ')).toEqual({ ok: true });
    expect((await renameProfile(game, created.profileId, ' '))).toMatchObject({ ok: false });
    const [summary] = await listProfileSummaries(game, game.content.get());
    expect(summary).toMatchObject({ displayName: 'Novo nome', baseName: 'Original' });
  });

  it('buildProfileArchive é determinístico para o mesmo retrato', async () => {
    const game = await setup();
    const profileId = await richProfile(game);
    const data = (await game.storage.query({ kind: 'PROFILE_EXPORT', profileId }))!;
    const a = buildProfileArchive(data, { appVersion: APP_VERSION, exportedAt: '2026-10-14T00:00:00.000Z' });
    const b = buildProfileArchive(data, { appVersion: APP_VERSION, exportedAt: '2026-10-14T00:00:00.000Z' });
    expect(a.files.map((f) => sha256Hex(f.bytes))).toEqual(b.files.map((f) => sha256Hex(f.bytes)));
  }, 120_000);
});
