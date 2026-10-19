// Escritas leves (persistencia-sqlite.md §13.1, §15, §19): CAS próprio, sem operations nem profiles.revision.
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../../domain/hash/jcs.ts';
import { bumpWriterEpoch, query, write } from './executor.ts';
import { openNodeDatabase } from './node.ts';
import { openAndMigrate } from './executor.ts';
import { PROFILE, count, deckEntries, profileRevision, seededDatabase, tableCounts } from './test-support.ts';
import type { LightWrite } from '../../application/ports/storage.ts';

function draft(expectedHead: number, revision: number, extra: Partial<Extract<LightWrite, { kind: 'SAVE_DECK_DRAFT' }>> = {}): LightWrite {
  return {
    kind: 'SAVE_DECK_DRAFT', profileId: PROFILE, deckId: 'deck-new', name: 'Novo', expectedHead, revision,
    energyTypes: ['WATER'], validation: { complete: false }, entries: deckEntries('WATER').slice(0, 7), createIfMissing: true, ...extra,
  };
}

function autosave(expectedHead: number, revision: number, kind: 'AUTO' | 'MANUAL' = 'AUTO', assetIds: readonly string[] = [], keep = 20): LightWrite {
  return {
    kind: 'SAVE_EDITOR_REVISION', projectId: 'project-1', expectedHead, revision, revisionKind: kind, draft: { draftFormat: 1, n: revision },
    validationSummary: { errors: 0, warnings: revision }, assetRefs: assetIds.map((assetId) => ({ role: 'ART_MASTER', assetId })), keepAutoRevisions: keep,
  };
}

describe('rascunho de deck', () => {
  it('SAVE_DECK_DRAFT cria o deck, avança a head por CAS e recusa head obsoleta, sem operations', async () => {
    const { db } = await seededDatabase();
    const operations = count(db, 'operations');
    expect(write(db, draft(0, 1))).toEqual({ ok: true, head: 1 });
    expect(write(db, draft(1, 2, { name: 'Novo 2' }))).toEqual({ ok: true, head: 2 });
    const before = tableCounts(db);
    expect(write(db, draft(1, 3))).toMatchObject({ ok: false, code: 'REVISION_CONFLICT' });
    expect(tableCounts(db)).toEqual(before);
    expect(write(db, draft(0, 1, { deckId: 'deck-missing', createIfMissing: false }))).toMatchObject({ ok: false, code: 'NOT_FOUND' });
    expect(count(db, 'operations')).toBe(operations);
    expect(profileRevision(db)).toBe(1);
    const deck = query(db, { kind: 'PROFILE_SNAPSHOT', profileId: PROFILE })?.decks.find((d) => d.deckId === 'deck-new');
    expect(deck).toMatchObject({ name: 'Novo 2', headRevision: 2, status: 'DRAFT', lastConfirmedRevision: null, energyTypes: ['WATER'] });
    expect(deck?.entries).toHaveLength(7);
    db.close();
  });

  it('rascunho sobre deck confirmado mantém lastConfirmedRevision; época antiga não grava', async () => {
    const { db } = await seededDatabase();
    const deckId = `deck-fire-${PROFILE}`;
    expect(write(db, draft(1, 2, { deckId, createIfMissing: false, entries: deckEntries('FIRE').slice(0, 19) }))).toEqual({ ok: true, head: 2 });
    const deck = query(db, { kind: 'PROFILE_SNAPSHOT', profileId: PROFILE })?.decks.find((d) => d.deckId === deckId);
    expect(deck).toMatchObject({ headRevision: 2, status: 'DRAFT', lastConfirmedRevision: 1 });
    expect(deck?.entries).toHaveLength(19);
    const epoch = bumpWriterEpoch(db, PROFILE);
    expect(write(db, draft(2, 3, { deckId, createIfMissing: false, writerEpoch: epoch - 1 }))).toMatchObject({ ok: false, code: 'REVISION_CONFLICT' });
    expect(write(db, draft(2, 3, { deckId, createIfMissing: false, writerEpoch: epoch }))).toEqual({ ok: true, head: 3 });
    db.close();
  });
});

describe('autosave do editor (persistencia §19)', () => {
  it('poda AUTO além das N mais recentes, preservando MANUAL, head e revisões com teste; refs caem em cascata', async () => {
    const { db } = await seededDatabase();
    const bytes = new Uint8Array([9, 8, 7]);
    const assetId = sha256Hex(bytes);
    expect(write(db, { kind: 'INSERT_ASSET_BLOB', assetId, mediaType: 'image/png', bytes, width: null, height: null, metadata: {} }).ok).toBe(true);
    expect(write(db, { kind: 'CREATE_EDITOR_PROJECT', profileId: PROFILE, projectId: 'project-1', title: 'Teste', mode: 'NEW_DEFINITION', targetDefinitionId: 'custom-t', sourceDefinitionId: null, sourceVersion: null }).ok).toBe(true);
    expect(write(db, autosave(0, 1, 'AUTO', [assetId]))).toEqual({ ok: true, head: 1 });
    expect(write(db, { kind: 'INSERT_TEST_RUN', runId: 'run-1', projectId: 'project-1', revision: 1, runnerVersion: 'r1', rulesHash: 'd'.repeat(64), scenario: {}, result: { ok: true }, outcome: 'PASS' })).toEqual({ ok: true });
    expect(write(db, { kind: 'INSERT_TEST_RUN', runId: 'run-1', projectId: 'project-1', revision: 1, runnerVersion: 'r1', rulesHash: 'd'.repeat(64), scenario: {}, result: { ok: true }, outcome: 'PASS' })).toEqual({ ok: true });
    expect(write(db, autosave(1, 2, 'MANUAL'))).toEqual({ ok: true, head: 2 });
    for (let revision = 3; revision <= 30; revision += 1) {
      expect(write(db, autosave(revision - 1, revision, 'AUTO', [assetId], 5))).toEqual({ ok: true, head: revision });
    }
    const kept = db.selectArrays("SELECT revision, kind FROM editor_revisions WHERE project_id = 'project-1' ORDER BY revision");
    expect(kept).toEqual([[1, 'AUTO'], [2, 'MANUAL'], [26, 'AUTO'], [27, 'AUTO'], [28, 'AUTO'], [29, 'AUTO'], [30, 'AUTO']]);
    expect(db.selectValues("SELECT DISTINCT revision FROM editor_asset_refs WHERE project_id = 'project-1' ORDER BY revision")).toEqual([1, 26, 27, 28, 29, 30]);
    expect(count(db, 'assets')).toBe(1);
    const before = tableCounts(db);
    expect(write(db, autosave(29, 31))).toMatchObject({ ok: false, code: 'REVISION_CONFLICT' });
    expect(tableCounts(db)).toEqual(before);
    expect(profileRevision(db)).toBe(1);
    expect(count(db, 'operations')).toBe(1);
    const project = query(db, { kind: 'GET_PROJECT', projectId: 'project-1', revision: null });
    expect(project).toMatchObject({ headRevision: 30, revision: 30, revisionKind: 'AUTO', draft: { draftFormat: 1, n: 30 }, validationSummary: { errors: 0, warnings: 30 } });
    expect(project?.revisions.map((r) => r.revision)).toEqual([1, 2, 26, 27, 28, 29, 30]);
    expect(query(db, { kind: 'GET_PROJECT', projectId: 'project-1', revision: 3 })).toBeNull();
    expect(query(db, { kind: 'LIST_TEST_RUNS', projectId: 'project-1' })).toEqual([expect.objectContaining({ runId: 'run-1', revision: 1, outcome: 'PASS' })]);
    expect(query(db, { kind: 'LIST_PROJECTS', profileId: PROFILE, includeArchived: false })).toEqual([
      expect.objectContaining({ projectId: 'project-1', headRevision: 30, status: 'DRAFT', validationSummary: { errors: 0, warnings: 30 } }),
    ]);
    expect(write(db, { kind: 'SET_PROJECT_STATUS', projectId: 'project-1', status: 'ARCHIVED' })).toEqual({ ok: true });
    expect(query(db, { kind: 'LIST_PROJECTS', profileId: PROFILE, includeArchived: false })).toEqual([]);
    expect(query(db, { kind: 'LIST_PROJECTS', profileId: PROFILE, includeArchived: true })).toHaveLength(1);
    db.close();
  });

  it('padrão de 20 AUTO mais recentes', async () => {
    const { db } = await seededDatabase();
    expect(write(db, { kind: 'CREATE_EDITOR_PROJECT', profileId: PROFILE, projectId: 'project-1', title: 'Teste', mode: 'NEW_DEFINITION', targetDefinitionId: 'custom-t', sourceDefinitionId: null, sourceVersion: null }).ok).toBe(true);
    for (let revision = 1; revision <= 25; revision += 1) expect(write(db, autosave(revision - 1, revision)).ok).toBe(true);
    expect(db.selectValues("SELECT revision FROM editor_revisions WHERE project_id = 'project-1' ORDER BY revision")).toEqual(Array.from({ length: 20 }, (_, i) => i + 6));
    db.close();
  });
});

describe('assets BLOB', () => {
  it('DB-016 / DB-017: bytes, hash e tamanho conferem após reabrir; mesmo conteúdo não duplica', async () => {
    const seeded = await seededDatabase();
    const bytes = new Uint8Array(4096).map((_, i) => (i * 31) % 251);
    const assetId = sha256Hex(bytes);
    const blob = { kind: 'INSERT_ASSET_BLOB', assetId, mediaType: 'image/webp', bytes, width: 64, height: 64, metadata: { colorSpace: 'srgb' } } as const;
    expect(write(seeded.db, blob)).toEqual({ ok: true });
    expect(write(seeded.db, blob)).toEqual({ ok: true });
    expect(write(seeded.db, { ...blob, mediaType: 'image/png' })).toEqual({ ok: true });
    expect(count(seeded.db, 'assets')).toBe(1);
    expect(write(seeded.db, { ...blob, assetId: 'e'.repeat(64) })).toMatchObject({ ok: false, code: 'INTERNAL_INTEGRITY_ERROR' });
    seeded.db.close();
    const reopened = await openNodeDatabase(seeded.filename);
    expect(openAndMigrate(reopened.db).ok).toBe(true);
    const asset = query(reopened.db, { kind: 'GET_ASSET', assetId });
    expect(asset).toMatchObject({ assetId, mediaType: 'image/webp', width: 64, height: 64, metadata: { colorSpace: 'srgb' } });
    expect(asset?.bytes).toEqual(bytes);
    expect(sha256Hex(asset!.bytes)).toBe(assetId);
    expect(reopened.db.selectValue('SELECT byte_length FROM assets WHERE asset_id = ?', [assetId])).toBe(4096);
    expect(query(reopened.db, { kind: 'GET_ASSET', assetId: 'f'.repeat(64) })).toBeNull();
    reopened.db.close();
  });
});

describe('preferências, marcas, oficina e meta', () => {
  it('SET_SETTINGS / MARK_COLLECTION têm semântica de estado final; SAVE_APPEARANCE_DRAFT tem CAS monotônico', async () => {
    const { db } = await seededDatabase();
    expect(write(db, { kind: 'SET_SETTINGS', profileId: PROFILE, values: { 'ui.textScale': 1.2, favoriteDeckId: null } })).toEqual({ ok: true });
    expect(write(db, { kind: 'SET_SETTINGS', profileId: PROFILE, values: { 'ui.textScale': 1.4 } })).toEqual({ ok: true });
    const mark = { kind: 'MARK_COLLECTION', profileId: PROFILE, markKind: 'FAVORITE', subjectKind: 'PRINTING', subjectId: 'base-001-faisca', on: true } as const;
    expect(write(db, mark)).toEqual({ ok: true });
    expect(write(db, mark)).toEqual({ ok: true });
    expect(write(db, { ...mark, markKind: 'SEEN' })).toEqual({ ok: true });
    expect(write(db, { ...mark, markKind: 'SEEN', on: false })).toEqual({ ok: true });
    const bytes = new Uint8Array([4, 4, 4]);
    const assetId = sha256Hex(bytes);
    expect(write(db, { kind: 'INSERT_ASSET_BLOB', assetId, mediaType: 'image/png', bytes, width: null, height: null, metadata: {} }).ok).toBe(true);
    expect(write(db, { kind: 'SAVE_APPEARANCE_DRAFT', profileId: PROFILE, contextId: 'workshop', revision: 1, draft: { a: 1 }, assetIds: [assetId] })).toEqual({ ok: true, head: 1 });
    expect(write(db, { kind: 'SAVE_APPEARANCE_DRAFT', profileId: PROFILE, contextId: 'workshop', revision: 3, draft: { a: 3 }, assetIds: [] })).toEqual({ ok: true, head: 3 });
    expect(write(db, { kind: 'SAVE_APPEARANCE_DRAFT', profileId: PROFILE, contextId: 'workshop', revision: 2, draft: { a: 2 }, assetIds: [] })).toMatchObject({ ok: false, code: 'REVISION_CONFLICT' });
    expect(db.selectValue('SELECT draft_json FROM appearance_drafts')).toBe('{"a":3}');
    expect(count(db, 'appearance_draft_assets')).toBe(0);
    expect(write(db, { kind: 'SET_APP_META', key: 'appVersion', value: '1.0.0' })).toEqual({ ok: true });
    expect(write(db, { kind: 'SET_APP_META', key: 'appVersion', value: '1.0.1' })).toEqual({ ok: true });
    const snapshot = query(db, { kind: 'PROFILE_SNAPSHOT', profileId: PROFILE });
    expect(snapshot?.settings).toEqual({ favoriteDeckId: null, 'ui.textScale': 1.4 });
    expect(snapshot?.marks).toEqual([{ markKind: 'FAVORITE', subjectKind: 'PRINTING', subjectId: 'base-001-faisca' }]);
    expect(query(db, { kind: 'APP_META', key: 'appVersion' })).toBe('1.0.1');
    expect(query(db, { kind: 'APP_META', key: 'absent' })).toBeNull();
    expect(profileRevision(db)).toBe(1);
    db.close();
  });
});
