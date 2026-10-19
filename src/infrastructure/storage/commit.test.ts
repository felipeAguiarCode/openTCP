// Transação de comando (persistencia-sqlite.md §12–§18): idempotência, concessões, CAS e rollback.
import { describe, expect, it } from 'vitest';
import type { JsonValue, Mutation } from '../../application/ports/storage.ts';
import { pokemon, attack, printing } from '../../content/builders.ts';
import { searchKeyV1 } from '../../domain/cards/naming.ts';
import { jcsHash, sha256Hex } from '../../domain/hash/jcs.ts';
import { bumpWriterEpoch, commit, query, write } from './executor.ts';
import {
  CAMPAIGN, PACK, PROFILE, RNG_0, asJson, count, deckEntries, expectCommitted, onboardingRequest, printingIdOf, profileRevision,
  request, seededDatabase, tableCounts,
} from './test-support.ts';
import * as S from '../../tests/support/generic-cards.ts';

const faisca = printingIdOf(S.faisca);

function startAttempt(attemptId: string, expectedRevision: number): Mutation[] {
  return [{
    kind: 'INSERT_ATTEMPT', attemptId, mode: 'CAMPAIGN', campaignId: CAMPAIGN, nodeId: 'node-1', difficulty: 'STANDARD',
    deckId: `deck-fire-${PROFILE}`, deckRevision: 1, progressionEligible: true, stateVersion: 0, rulesetId: 'local-campaign-v2',
    engineVersion: '1.0.0', contentFingerprint: 'base@1.0.0', state: { phase: 'SETUP', rev: expectedRevision }, rng: { battleRng: { draws: 0 }, aiRng: { draws: 0 } },
    presentationSnapshot: {}, cardRefs: [faisca, faisca], assetRefs: [],
  }];
}

describe('commit: criação de perfil e recibo', () => {
  it('CREATE_PROFILE_ONBOARDING cria o perfil em revision 1 com ledger, operação e concessão no mesmo COMMIT', async () => {
    const { db } = await seededDatabase();
    expect(profileRevision(db)).toBe(1);
    const op = db.selectObject('SELECT * FROM operations');
    expect(op).toMatchObject({ operation_id: `op-${PROFILE}-1`, committed_revision: 1, command_type: 'CREATE_PROFILE_ONBOARDING' });
    expect(JSON.parse(String(op?.receipt_json))).toMatchObject({ commandType: 'CREATE_PROFILE_ONBOARDING', committedRevision: 1, grants: [`onboarding:${CAMPAIGN}`] });
    expect(db.selectArrays('SELECT entry_no, resource_id, delta, balance_after FROM wallet_entries ORDER BY entry_no'))
      .toEqual([[0, 'CREDITS', 300, 300], [1, PACK, 2, 2]]);
    expect(db.selectValue('SELECT sum(quantity) FROM inventory')).toBe(60);
    expect(db.selectValue('SELECT sum(delta) FROM inventory_entries')).toBe(60);
    expect(db.selectValues('SELECT grant_key FROM reward_grants')).toEqual([`onboarding:${CAMPAIGN}`]);
    expect(count(db, 'deck_entries')).toBe(60);
    db.close();
  });

  it('criar um perfil que já existe é REVISION_CONFLICT sem efeito', async () => {
    const { db } = await seededDatabase();
    const before = tableCounts(db);
    expect(commit(db, onboardingRequest(PROFILE, { grantKeys: [] }))).toMatchObject({ ok: false, code: 'REVISION_CONFLICT' });
    expect(tableCounts(db)).toEqual(before);
    db.close();
  });
});

describe('commit: idempotência e concessão única', () => {
  it('DB-020: mesmo commandId e payloadHash devolve o recibo gravado, sem segundo efeito', async () => {
    const { db } = await seededDatabase();
    const buy = request({ commandType: 'BUY_PRODUCT', expectedRevision: 1, mutations: [
      { kind: 'WALLET_DELTA', resourceId: 'CREDITS', delta: -100 }, { kind: 'WALLET_DELTA', resourceId: PACK, delta: 1 },
    ], summary: { productId: 'pack-c01-v1', price: 100 } });
    const first = expectCommitted(commit(db, buy));
    const before = tableCounts(db);
    const again = commit(db, buy);
    expect(again).toEqual({ ok: true, status: 'REPLAYED', operationId: first.operationId, committedRevision: 2, receipt: first.receipt });
    expect(tableCounts(db)).toEqual(before);
    expect(db.selectValue("SELECT balance FROM wallets WHERE resource_id = 'CREDITS'")).toBe(200);
    expect(query(db, { kind: 'GET_OPERATION', profileId: PROFILE, commandId: buy.commandId })).toEqual({
      operationId: first.operationId, payloadHash: buy.payloadHash, committedRevision: 2, receipt: first.receipt,
    });
    db.close();
  });

  it('DB-021: mesmo commandId com payload diferente é COMMAND_PAYLOAD_MISMATCH sem efeito', async () => {
    const { db } = await seededDatabase();
    const buy = request({ commandType: 'BUY_PRODUCT', expectedRevision: 1, mutations: [{ kind: 'WALLET_DELTA', resourceId: 'CREDITS', delta: -100 }] });
    expectCommitted(commit(db, buy));
    const before = tableCounts(db);
    const tampered = { ...buy, payloadHash: jcsHash({ other: true }), expectedRevision: 2, mutations: [{ kind: 'WALLET_DELTA', resourceId: 'CREDITS', delta: -150 } as const] };
    expect(commit(db, tampered)).toMatchObject({ ok: false, code: 'COMMAND_PAYLOAD_MISMATCH' });
    expect(tableCounts(db)).toEqual(before);
    expect(profileRevision(db)).toBe(2);
    db.close();
  });

  it('DB-022: a grant key impede a segunda primeira vitória com outro commandId', async () => {
    const { db } = await seededDatabase();
    const win = (rev: number) => request({ commandType: 'FINISH_ATTEMPT', expectedRevision: rev, grantKeys: [`first-clear:${CAMPAIGN}:node-1`], mutations: [
      { kind: 'WALLET_DELTA', resourceId: 'CREDITS', delta: 50 },
      { kind: 'UPSERT_CAMPAIGN_PROGRESS', campaignId: CAMPAIGN, nodeId: 'node-1', campaignVersion: '1.0.0', status: 'CLEARED', progress: { completedObjectiveIds: [] } },
    ] });
    expectCommitted(commit(db, win(1)));
    const before = tableCounts(db);
    expect(commit(db, win(2))).toMatchObject({ ok: false, code: 'REWARD_ALREADY_GRANTED' });
    expect(tableCounts(db)).toEqual(before);
    expect(db.selectValue("SELECT balance FROM wallets WHERE resource_id = 'CREDITS'")).toBe(350);
    expect(profileRevision(db)).toBe(2);
    db.close();
  });
});

describe('commit: rollback econômico', () => {
  it('DB-023: saldo insuficiente é INSUFFICIENT_CREDITS sem carteira, inventário, ledger ou operação parciais', async () => {
    const { db } = await seededDatabase();
    const before = tableCounts(db);
    const balances = db.selectArrays('SELECT * FROM wallets ORDER BY resource_id');
    const inventory = db.selectArrays('SELECT * FROM inventory ORDER BY printing_id');
    const result = commit(db, request({ commandType: 'BUY_PRODUCT', expectedRevision: 1, mutations: [
      { kind: 'INVENTORY_DELTA', printingId: faisca, delta: 1 },
      { kind: 'WALLET_DELTA', resourceId: PACK, delta: 1 },
      { kind: 'WALLET_DELTA', resourceId: 'CREDITS', delta: -1000 },
    ] }));
    expect(result).toMatchObject({ ok: false, code: 'INSUFFICIENT_CREDITS' });
    expect(tableCounts(db)).toEqual(before);
    expect(db.selectArrays('SELECT * FROM wallets ORDER BY resource_id')).toEqual(balances);
    expect(db.selectArrays('SELECT * FROM inventory ORDER BY printing_id')).toEqual(inventory);
    expect(profileRevision(db)).toBe(1);
    expect(db.selectValue('SELECT count(*) FROM operations')).toBe(1);
    db.close();
  });

  it('DB-024 / DB-027: rollback devolve carteira, inventário, ledger e RNG juntos; commit válido avança o RNG', async () => {
    const { db } = await seededDatabase();
    const rngBefore = db.selectValue('SELECT economy_rng_json FROM profiles');
    const advanced = asJson({ economyRng: { algorithm: 'rng-v1', state: [9, 9, 9, 9], draws: 5 }, seedRng: { algorithm: 'rng-v1', state: [5, 6, 7, 8], draws: 0 } });
    const open = (consume: number, openingId: string) => request({ commandType: 'OPEN_PACK', expectedRevision: 1, grantKeys: [`opening:${openingId}`], mutations: [
      { kind: 'SET_PROFILE_RNG', rngJson: advanced },
      { kind: 'INVENTORY_DELTA', printingId: faisca, delta: 1 },
      { kind: 'WALLET_DELTA', resourceId: PACK, delta: -consume },
    ] });
    const before = tableCounts(db);
    expect(commit(db, open(5, 'opening-x'))).toMatchObject({ ok: false, code: 'INSUFFICIENT_CREDITS' });
    expect(db.selectValue('SELECT economy_rng_json FROM profiles')).toBe(rngBefore);
    expect(tableCounts(db)).toEqual(before);
    expectCommitted(commit(db, open(1, 'opening-y')));
    expect(JSON.parse(String(db.selectValue('SELECT economy_rng_json FROM profiles')))).toEqual(advanced);
    expect(db.selectValue('SELECT balance FROM wallets WHERE resource_id = ?', [PACK])).toBe(1);
    db.close();
  });

  it('inventário negativo é INTERNAL_INTEGRITY_ERROR com rollback', async () => {
    const { db } = await seededDatabase();
    const before = tableCounts(db);
    expect(commit(db, request({ commandType: 'GRANT_CUSTOM_COPIES', expectedRevision: 1, mutations: [{ kind: 'INVENTORY_DELTA', printingId: faisca, delta: -99 }] })))
      .toMatchObject({ ok: false, code: 'INTERNAL_INTEGRITY_ERROR' });
    expect(tableCounts(db)).toEqual(before);
    db.close();
  });
});

describe('commit: CAS de perfil e de partida', () => {
  it('DB-028: revisão ou época incorretas alteram zero linhas e não gravam o candidato', async () => {
    const { db } = await seededDatabase();
    const before = tableCounts(db);
    const stale = request({ commandType: 'BUY_PRODUCT', expectedRevision: 0, mutations: [{ kind: 'WALLET_DELTA', resourceId: 'CREDITS', delta: -10 }] });
    expect(commit(db, stale)).toMatchObject({ ok: false, code: 'REVISION_CONFLICT' });
    const epoch = bumpWriterEpoch(db, PROFILE);
    expect(epoch).toBe(1);
    const oldEpoch = request({ commandType: 'BUY_PRODUCT', expectedRevision: 1, writerEpoch: 0, mutations: [{ kind: 'WALLET_DELTA', resourceId: 'CREDITS', delta: -10 }] });
    expect(commit(db, oldEpoch)).toMatchObject({ ok: false, code: 'REVISION_CONFLICT' });
    expect(tableCounts(db)).toEqual({ ...before, app_meta: before.app_meta! + 1 });
    expect(profileRevision(db)).toBe(1);
    expectCommitted(commit(db, { ...oldEpoch, commandId: 'cmd-epoch-ok', writerEpoch: epoch }));
    expect(bumpWriterEpoch(db, PROFILE)).toBe(2);
    db.close();
  });

  it('DB-029: state_version da partida tem CAS próprio, distinto de profiles.revision', async () => {
    const { db } = await seededDatabase();
    expectCommitted(commit(db, request({ commandType: 'START_ATTEMPT', expectedRevision: 1, mutations: startAttempt('attempt-1', 1) })));
    const action = (expectedRevision: number, expectedStateVersion: number, seq: number) => request({ commandType: 'SUBMIT_BATTLE_ACTION', expectedRevision, mutations: [
      { kind: 'UPDATE_ATTEMPT', attemptId: 'attempt-1', expectedStateVersion, stateVersion: expectedStateVersion + 1, status: 'RUNNING', state: { turn: seq }, rng: { battleRng: { draws: seq } }, result: null },
      { kind: 'INSERT_BATTLE_EVENTS', attemptId: 'attempt-1', stateVersion: expectedStateVersion + 1, events: [{ seq, type: 'ATTACK', event: { seq } }] },
    ] });
    const ok = expectCommitted(commit(db, action(2, 0, 1)));
    expect(ok.committedRevision).toBe(3);
    expect(db.selectValue("SELECT state_version FROM attempts WHERE attempt_id = 'attempt-1'")).toBe(1);
    expect(db.selectValue("SELECT operation_id FROM battle_events WHERE sequence_no = 1")).toBe(ok.operationId);
    const before = tableCounts(db);
    expect(commit(db, action(3, 0, 2))).toMatchObject({ ok: false, code: 'STATE_VERSION_MISMATCH' });
    expect(commit(db, action(2, 1, 2))).toMatchObject({ ok: false, code: 'REVISION_CONFLICT' });
    expect(tableCounts(db)).toEqual(before);
    expect(profileRevision(db)).toBe(3);
    expectCommitted(commit(db, action(3, 1, 2)));
    expect(query(db, { kind: 'GET_EVENTS', attemptId: 'attempt-1', fromSeq: 1 }).map((e) => [e.seq, e.stateVersion])).toEqual([[1, 1], [2, 2]]);
    db.close();
  });

  it('DB-032: não aceita duas tentativas RUNNING/SUSPENDED no mesmo perfil', async () => {
    const { db } = await seededDatabase();
    expectCommitted(commit(db, request({ commandType: 'START_ATTEMPT', expectedRevision: 1, mutations: startAttempt('attempt-1', 1) })));
    expectCommitted(commit(db, request({ commandType: 'SUSPEND_ATTEMPT', expectedRevision: 2, mutations: [
      { kind: 'UPDATE_ATTEMPT', attemptId: 'attempt-1', expectedStateVersion: 0, stateVersion: 0, status: 'SUSPENDED', state: { phase: 'SETUP' }, rng: {}, result: null },
    ] })));
    const before = tableCounts(db);
    expect(commit(db, request({ commandType: 'START_ATTEMPT', expectedRevision: 3, mutations: startAttempt('attempt-2', 3) })))
      .toMatchObject({ ok: false, code: 'ACTIVE_ATTEMPT_EXISTS' });
    expect(tableCounts(db)).toEqual(before);
    expect(query(db, { kind: 'PROFILE_SNAPSHOT', profileId: PROFILE })?.activeAttempt).toMatchObject({ attemptId: 'attempt-1', status: 'SUSPENDED' });
    db.close();
  });

  it('DB-033: status terminal exige resultado; tentativa terminal não volta a mudar', async () => {
    const { db } = await seededDatabase();
    expectCommitted(commit(db, request({ commandType: 'START_ATTEMPT', expectedRevision: 1, mutations: startAttempt('attempt-1', 1) })));
    const finish = (rev: number, result: JsonValue | null) => request({ commandType: 'FINISH_ATTEMPT', expectedRevision: rev, mutations: [
      { kind: 'UPDATE_ATTEMPT', attemptId: 'attempt-1', expectedStateVersion: 0, stateVersion: 1, status: 'FINISHED', state: { phase: 'END' }, rng: {}, result },
    ] });
    const before = tableCounts(db);
    expect(commit(db, finish(2, null))).toMatchObject({ ok: false, code: 'INTERNAL_INTEGRITY_ERROR' });
    expect(tableCounts(db)).toEqual(before);
    expect(db.selectValue("SELECT status FROM attempts WHERE attempt_id = 'attempt-1'")).toBe('RUNNING');
    expectCommitted(commit(db, finish(2, { winner: 'PLAYER', reason: 'POINTS' })));
    expect(query(db, { kind: 'GET_ATTEMPT', attemptId: 'attempt-1' })).toMatchObject({ status: 'FINISHED', result: { winner: 'PLAYER' }, stateVersion: 1 });
    expect(commit(db, request({ commandType: 'ABANDON_ATTEMPT', expectedRevision: 3, mutations: [
      { kind: 'UPDATE_ATTEMPT', attemptId: 'attempt-1', expectedStateVersion: 1, stateVersion: 2, status: 'ABANDONED', state: {}, rng: {}, result: { abandoned: true } },
    ] }))).toMatchObject({ ok: false, code: 'STATE_VERSION_MISMATCH' });
    expectCommitted(commit(db, request({ commandType: 'START_ATTEMPT', expectedRevision: 3, mutations: startAttempt('attempt-2', 3) })));
    db.close();
  });
});

describe('commit: recompensas e cosméticos', () => {
  it('DB-034: o direito pendente sobrevive e a escolha credita uma única vez', async () => {
    const { db } = await seededDatabase();
    expectCommitted(commit(db, request({ commandType: 'START_ATTEMPT', expectedRevision: 1, mutations: startAttempt('attempt-1', 1) })));
    expectCommitted(commit(db, request({ commandType: 'FINISH_ATTEMPT', expectedRevision: 2, grantKeys: [`first-clear:${CAMPAIGN}:node-1`], mutations: [
      { kind: 'UPDATE_ATTEMPT', attemptId: 'attempt-1', expectedStateVersion: 0, stateVersion: 1, status: 'FINISHED', state: {}, rng: {}, result: { winner: 'PLAYER' } },
      { kind: 'INSERT_PENDING_REWARD', rewardId: 'reward-1', grantKey: `first-clear:${CAMPAIGN}:node-1:key-card`, options: [faisca, printingIdOf(S.gota)], sourceAttemptId: 'attempt-1' },
    ] })));
    const pending = query(db, { kind: 'PROFILE_SNAPSHOT', profileId: PROFILE })?.pendingRewards;
    expect(pending).toEqual([expect.objectContaining({ rewardId: 'reward-1', status: 'PENDING', choice: null })]);
    expect(db.selectValue("SELECT source_operation_id FROM pending_rewards")).toBe(`op-${PROFILE}-3`);
    const claim = (rev: number) => request({ commandType: 'CLAIM_PENDING_REWARD', expectedRevision: rev, grantKeys: [`first-clear:${CAMPAIGN}:node-1:key-card`], mutations: [
      { kind: 'CLAIM_PENDING_REWARD', rewardId: 'reward-1', choice: { printingId: faisca } },
      { kind: 'INVENTORY_DELTA', printingId: faisca, delta: 1 },
    ] });
    const quantity = Number(db.selectValue('SELECT quantity FROM inventory WHERE printing_id = ?', [faisca]));
    expectCommitted(commit(db, claim(3)));
    const before = tableCounts(db);
    expect(commit(db, claim(4))).toMatchObject({ ok: false, code: 'REWARD_ALREADY_GRANTED' });
    expect(tableCounts(db)).toEqual(before);
    expect(db.selectValue('SELECT quantity FROM inventory WHERE printing_id = ?', [faisca])).toBe(quantity + 1);
    expect(query(db, { kind: 'PROFILE_SNAPSHOT', profileId: PROFILE })?.pendingRewards[0]).toMatchObject({ status: 'CLAIMED', choice: { printingId: faisca } });
    db.close();
  });

  it('entitlement repetido: concessão é ignorada e reportada; compra repetida é recusada sem débito', async () => {
    const { db } = await seededDatabase();
    const milestone = expectCommitted(commit(db, request({ commandType: 'FINISH_ATTEMPT', expectedRevision: 1, mutations: [
      { kind: 'GRANT_ENTITLEMENT', cosmeticId: 'playmat-default', origin: 'MILESTONE' },
      { kind: 'GRANT_ENTITLEMENT', cosmeticId: 'coin-gold', origin: 'MILESTONE' },
    ] })));
    expect(milestone.ignoredEntitlements).toEqual(['playmat-default']);
    const before = tableCounts(db);
    expect(commit(db, request({ commandType: 'BUY_COSMETIC', expectedRevision: 2, mutations: [
      { kind: 'WALLET_DELTA', resourceId: 'CREDITS', delta: -50 },
      { kind: 'GRANT_ENTITLEMENT', cosmeticId: 'coin-gold', origin: 'PURCHASE' },
    ] }))).toMatchObject({ ok: false, code: 'REWARD_ALREADY_GRANTED' });
    expect(tableCounts(db)).toEqual(before);
    expect(db.selectValue("SELECT balance FROM wallets WHERE resource_id = 'CREDITS'")).toBe(300);
    db.close();
  });

  it('preset cosmético + aparência de perfil e deck + remoção do rascunho aplicado no mesmo COMMIT', async () => {
    const { db } = await seededDatabase();
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const assetId = sha256Hex(bytes);
    expect(write(db, { kind: 'SAVE_APPEARANCE_DRAFT', profileId: PROFILE, contextId: 'workshop', revision: 1, draft: { tint: 'blue' }, assetIds: [] }).ok).toBe(true);
    expectCommitted(commit(db, request({ commandType: 'SAVE_COSMETIC_PRESET', expectedRevision: 1, mutations: [
      { kind: 'INSERT_ASSET_BLOB', assetId, mediaType: 'image/png', bytes, width: null, height: null, metadata: {} },
      { kind: 'INSERT_COSMETIC_PRESET', presetId: 'preset-1', revision: 1, config: { playmatId: 'playmat-default' }, assetIds: [assetId, assetId] },
      { kind: 'SET_PROFILE_APPEARANCE', presetId: 'preset-1', presetRevision: 1 },
      { kind: 'SET_DECK_APPEARANCE', deckId: `deck-fire-${PROFILE}`, mode: 'OVERRIDE', presetId: 'preset-1', presetRevision: 1 },
      { kind: 'DELETE_APPEARANCE_DRAFT', contextId: 'workshop' },
    ] })));
    const snapshot = query(db, { kind: 'PROFILE_SNAPSHOT', profileId: PROFILE });
    expect(snapshot?.appearance).toEqual({ presetId: 'preset-1', presetRevision: 1, config: { playmatId: 'playmat-default' } });
    expect(snapshot?.decks.find((d) => d.deckId === `deck-fire-${PROFILE}`)?.appearance).toEqual({ mode: 'OVERRIDE', presetId: 'preset-1', presetRevision: 1 });
    expect(count(db, 'appearance_drafts')).toBe(0);
    expect(count(db, 'cosmetic_asset_refs')).toBe(1);
    db.close();
  });
});

describe('commit: publicação do editor (persistencia §18)', () => {
  it('DB-036: regra, impressão, asset, vínculo projeto/revisão/operação e head confirmam juntos', async () => {
    const { db } = await seededDatabase();
    const bytes = new Uint8Array([137, 80, 78, 71, 0, 1]);
    const assetId = sha256Hex(bytes);
    const card = pokemon({ id: 'custom-braseiro-ex', baseName: 'Braseiro', ruleBox: 'EX', stage: 'BASIC', type: 'FIRE', hp: 140, retreat: 2, weakness: 'WATER',
      attacks: [attack({ id: 'chama-ex', name: 'Chama ex', cost: { FIRE: 2 }, damage: 90 })] });
    const rules = asJson(card);
    const appearance = asJson({ ...printing({ card, setId: 'custom', number: 1, rarity: 'RARE' }), artMode: 'IMPORTED', artAssetId: assetId, assetBindings: [{ role: 'ART_MASTER', assetId }] });
    const printingId = (appearance as { printingId: string }).printingId;
    expect(write(db, { kind: 'CREATE_EDITOR_PROJECT', profileId: PROFILE, projectId: 'project-1', title: 'Braseiro ex', mode: 'NEW_DEFINITION', targetDefinitionId: card.id, sourceDefinitionId: null, sourceVersion: null }))
      .toEqual({ ok: true, head: 0 });
    expect(write(db, { kind: 'SAVE_EDITOR_REVISION', projectId: 'project-1', expectedHead: 0, revision: 1, revisionKind: 'MANUAL', draft: { draftFormat: 1 }, validationSummary: { errors: 0, warnings: 0 }, assetRefs: [], keepAutoRevisions: 20 }))
      .toEqual({ ok: true, head: 1 });
    const publish = request({ commandType: 'PUBLISH_CARD', expectedRevision: 1, mutations: [
      { kind: 'INSERT_ASSET_BLOB', assetId, mediaType: 'image/png', bytes, width: 1, height: 1, metadata: {} },
      { kind: 'INSERT_CARD_DEFINITION', definitionId: card.id, namespace: 'CUSTOM' },
      { kind: 'INSERT_CARD_VERSION', definitionId: card.id, version: 1, rules, rulesHash: jcsHash(rules), rulesetId: 'local-campaign-v2', searchKey: searchKeyV1(card.name) },
      { kind: 'INSERT_EDITOR_REVISION_PUBLISHED', projectId: 'project-1', revision: 2, draft: { draftFormat: 1 }, validationSummary: { errors: 0, warnings: 0 }, assetRefs: [{ role: 'ART_MASTER', assetId }] },
      { kind: 'INSERT_PUBLICATION', definitionId: card.id, version: 1, validatorVersion: 'validator-1', report: { errors: [] }, projectId: 'project-1', projectRevision: 2 },
      { kind: 'INSERT_PRINTING', printingId, definitionId: card.id, definitionVersion: 1, appearance, appearanceHash: jcsHash(appearance) },
      { kind: 'INSERT_CARD_DEPENDENCY', definitionId: card.id, version: 1, dependencyId: S.braseiro.id, dependencyVersion: 1, dependencyKind: 'REFERENCE' },
      { kind: 'SET_CATALOG_HEAD', definitionId: card.id, version: 1 },
    ] });
    const published = expectCommitted(commit(db, publish));
    expect(db.selectObject('SELECT profile_id, project_id, project_revision, operation_id FROM card_publications WHERE definition_id = ?', [card.id]))
      .toEqual({ profile_id: PROFILE, project_id: 'project-1', project_revision: 2, operation_id: published.operationId });
    expect(db.selectArrays('SELECT role, asset_id FROM printing_assets WHERE printing_id = ?', [printingId])).toEqual([['ART_MASTER', assetId]]);
    expect(db.selectValue('SELECT owner_profile_id FROM card_definitions WHERE definition_id = ?', [card.id])).toBe(PROFILE);
    const catalog = query(db, { kind: 'CUSTOM_CATALOG', profileId: PROFILE });
    expect(catalog.versions.map((v) => [v.definitionId, v.version, v.archived])).toEqual([[card.id, 1, false]]);
    expect(catalog.printings.map((p) => p.printingId)).toEqual([printingId]);
    expect(catalog.heads).toEqual({ [card.id]: 1 });
    expect(query(db, { kind: 'GET_PROJECT', projectId: 'project-1', revision: null })).toMatchObject({ headRevision: 2, revision: 2, revisionKind: 'PUBLISHED' });
    expect(query(db, { kind: 'CUSTOM_CATALOG', profileId: 'profile-other' }).versions).toEqual([]);

    // Arquivar a versão não toca linhas imutáveis; desarquivar remove a marca.
    expectCommitted(commit(db, request({ commandType: 'ARCHIVE_ENTITY', expectedRevision: 2, mutations: [{ kind: 'ARCHIVE_MARK', entityKind: 'VERSION', entityId: card.id, entityVersion: 1 }] })));
    expect(query(db, { kind: 'CUSTOM_CATALOG', profileId: null }).versions[0]?.archived).toBe(true);
    expectCommitted(commit(db, request({ commandType: 'ARCHIVE_ENTITY', expectedRevision: 3, mutations: [{ kind: 'ARCHIVE_MARK', entityKind: 'VERSION', entityId: card.id, entityVersion: 1, archived: false }] })));
    expect(query(db, { kind: 'CUSTOM_CATALOG', profileId: null }).versions[0]?.archived).toBe(false);
    db.close();
  });

  it('publicação com hash de regras divergente ou impressão sem asset é recusada sem escrita parcial', async () => {
    const { db } = await seededDatabase();
    const card = pokemon({ id: 'custom-x', baseName: 'Xis', stage: 'BASIC', type: 'FIRE', hp: 60, retreat: 1, attacks: [] });
    const rules = asJson(card);
    const before = tableCounts(db);
    expect(commit(db, request({ commandType: 'PUBLISH_CARD', expectedRevision: 1, mutations: [
      { kind: 'INSERT_CARD_DEFINITION', definitionId: card.id, namespace: 'CUSTOM' },
      { kind: 'INSERT_CARD_VERSION', definitionId: card.id, version: 1, rules, rulesHash: 'a'.repeat(64), rulesetId: 'local-campaign-v2', searchKey: 'xis' },
    ] }))).toMatchObject({ ok: false, code: 'INTERNAL_INTEGRITY_ERROR' });
    const missingAsset = 'b'.repeat(64);
    const appearance = asJson({ ...printing({ card, setId: 'custom', number: 2, rarity: 'COMMON' }), assetBindings: [{ role: 'ART_MASTER', assetId: missingAsset }] });
    expect(commit(db, request({ commandType: 'PUBLISH_CARD', expectedRevision: 1, mutations: [
      { kind: 'INSERT_CARD_DEFINITION', definitionId: card.id, namespace: 'CUSTOM' },
      { kind: 'INSERT_CARD_VERSION', definitionId: card.id, version: 1, rules, rulesHash: jcsHash(rules), rulesetId: 'local-campaign-v2', searchKey: 'xis' },
      { kind: 'INSERT_PUBLICATION', definitionId: card.id, version: 1, validatorVersion: 'v', report: {}, projectId: null, projectRevision: null },
      { kind: 'INSERT_PRINTING', printingId: (appearance as { printingId: string }).printingId, definitionId: card.id, definitionVersion: 1, appearance, appearanceHash: jcsHash(appearance) },
    ] }))).toMatchObject({ ok: false, code: 'CONTENT_REFERENCE_MISSING' });
    expect(tableCounts(db)).toEqual(before);
    db.close();
  });
});

describe('commit: decks, fichários e arquivamento', () => {
  it('CONFIRM_DECK usa CAS em decks.head_revision; fichário substitui posições; arquivar deck/fichário/perfil', async () => {
    const { db } = await seededDatabase();
    const deckId = `deck-fire-${PROFILE}`;
    expectCommitted(commit(db, request({ commandType: 'CONFIRM_DECK', expectedRevision: 1, mutations: [
      { kind: 'INSERT_DECK_VERSION', deckId, revision: 2, expectedHead: 1, status: 'CONFIRMED', energyTypes: ['FIRE'], validation: { ok: true }, entries: deckEntries('FIRE'), name: 'Chama' },
    ] })));
    expect(commit(db, request({ commandType: 'CONFIRM_DECK', expectedRevision: 2, mutations: [
      { kind: 'INSERT_DECK_VERSION', deckId, revision: 3, expectedHead: 1, status: 'CONFIRMED', energyTypes: ['FIRE'], validation: {}, entries: deckEntries('FIRE') },
    ] }))).toMatchObject({ ok: false, code: 'REVISION_CONFLICT' });
    expectCommitted(commit(db, request({ commandType: 'SAVE_BINDER', expectedRevision: 2, mutations: [
      { kind: 'UPSERT_BINDER', binderId: 'binder-1', name: 'Fogo', binderKind: 'BINDER', layout: { columns: 3 }, sortOrder: 0, slots: [{ pageNo: 1, slotNo: 1, printingId: faisca }, { pageNo: 1, slotNo: 2, printingId: faisca }] },
    ] })));
    expectCommitted(commit(db, request({ commandType: 'SAVE_BINDER', expectedRevision: 3, mutations: [
      { kind: 'UPSERT_BINDER', binderId: 'binder-1', name: 'Fogo!', binderKind: 'SHOWCASE', layout: { columns: 4 }, sortOrder: 1, slots: [{ pageNo: 2, slotNo: 3, printingId: faisca }] },
    ] })));
    let snapshot = query(db, { kind: 'PROFILE_SNAPSHOT', profileId: PROFILE });
    expect(snapshot?.decks.find((d) => d.deckId === deckId)).toMatchObject({ name: 'Chama', headRevision: 2, lastConfirmedRevision: 2, status: 'CONFIRMED' });
    expect(snapshot?.binders).toEqual([{ binderId: 'binder-1', name: 'Fogo!', kind: 'SHOWCASE', layout: { columns: 4 }, sortOrder: 1, slots: [{ pageNo: 2, slotNo: 3, printingId: faisca }] }]);
    expectCommitted(commit(db, request({ commandType: 'ARCHIVE_ENTITY', expectedRevision: 4, mutations: [
      { kind: 'SET_DECK_ARCHIVED', deckId, archived: true },
      { kind: 'SET_BINDER_ARCHIVED', binderId: 'binder-1', archived: true },
    ] })));
    snapshot = query(db, { kind: 'PROFILE_SNAPSHOT', profileId: PROFILE });
    expect(snapshot?.decks.find((d) => d.deckId === deckId)?.archived).toBe(true);
    expect(snapshot?.binders).toEqual([]);
    expectCommitted(commit(db, request({ commandType: 'ARCHIVE_PROFILE', expectedRevision: 5, mutations: [{ kind: 'SET_PROFILE_ARCHIVED', archived: true }] })));
    expect(query(db, { kind: 'LIST_PROFILES', includeArchived: false })).toEqual([]);
    expect(query(db, { kind: 'LIST_PROFILES', includeArchived: true }).map((p) => [p.profileId, p.archived, p.revision])).toEqual([[PROFILE, true, 6]]);
    db.close();
  });

  it('IMPORT_PROFILE cria um perfil novo e registra profile_imports (fingerprint não único)', async () => {
    const { db } = await seededDatabase();
    const fingerprint = 'c'.repeat(64);
    for (const target of ['profile-import-1', 'profile-import-2']) {
      expectCommitted(commit(db, request({ commandType: 'IMPORT_PROFILE', profileId: target, expectedRevision: 0, mutations: [
        { kind: 'INSERT_PROFILE', displayName: 'Importado', progressionMode: 'CUSTOM', rngJson: RNG_0 },
        { kind: 'INSERT_PROFILE_IMPORT', importId: `import-${target}`, sourceKind: 'PROFILE_ZIP_4', sourceFingerprint: fingerprint, report: { counts: {} } },
      ] })));
    }
    expect(db.selectValues('SELECT target_profile_id FROM profile_imports ORDER BY import_id')).toEqual(['profile-import-1', 'profile-import-2']);
    db.close();
  });
});
