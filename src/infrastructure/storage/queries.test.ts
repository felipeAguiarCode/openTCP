// Consultas e porta Node (persistencia-sqlite.md §27): forma do PROFILE_SNAPSHOT e semântica de erros.
import { describe, expect, it } from 'vitest';
import { query } from './executor.ts';
import { createMemoryStorage } from './node.ts';
import {
  CAMPAIGN, PACK, PROFILE, expectCommitted, onboardingRequest, request, seededDatabase, starterInstall,
} from './test-support.ts';

describe('PROFILE_SNAPSHOT', () => {
  it('após o onboarding: créditos, pacotes, inventário, 3 decks confirmados, entitlements, progresso e concessões', async () => {
    const { db } = await seededDatabase();
    const snapshot = query(db, { kind: 'PROFILE_SNAPSHOT', profileId: PROFILE });
    expect(snapshot).not.toBeNull();
    if (!snapshot) return;
    expect(snapshot.profile).toMatchObject({ profileId: PROFILE, displayName: 'Ana', progressionMode: 'STANDARD', revision: 1, writerEpoch: 0, archived: false });
    expect(snapshot.profile.rng).toMatchObject({ economyRng: { algorithm: 'rng-v1' } });
    expect(snapshot.wallets).toEqual({ CREDITS: 300, [PACK]: 2 });
    expect(snapshot.inventory.reduce((sum, item) => sum + item.quantity, 0)).toBe(60);
    expect(snapshot.decks).toHaveLength(3);
    for (const deck of snapshot.decks) {
      expect(deck).toMatchObject({ headRevision: 1, status: 'CONFIRMED', lastConfirmedRevision: 1, archived: false, validation: { ok: true }, appearance: null });
      expect(deck.entries).toHaveLength(20);
      expect(deck.entries.map((e) => e.entryNo)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    }
    // Ordem estável: created_at e depois deck_id.
    expect(snapshot.decks.map((d) => [d.deckId, d.energyTypes])).toEqual([
      [`deck-fire-${PROFILE}`, ['FIRE']], [`deck-grass-${PROFILE}`, ['GRASS']], [`deck-water-${PROFILE}`, ['WATER']],
    ]);
    expect(snapshot.entitlements.map((e) => [e.cosmeticId, e.origin])).toEqual([['playmat-default', 'ONBOARDING'], ['sleeve-default', 'ONBOARDING']]);
    expect(snapshot.campaignProgress).toEqual([expect.objectContaining({ campaignId: CAMPAIGN, nodeId: 'node-1', status: 'AVAILABLE', progress: { completedObjectiveIds: [] } })]);
    expect(snapshot.grants).toEqual([`onboarding:${CAMPAIGN}`]);
    expect(snapshot).toMatchObject({ pendingRewards: [], settings: {}, activeAttempt: null, appearance: null, presets: [], binders: [], marks: [] });
    expect(query(db, { kind: 'PROFILE_SNAPSHOT', profileId: 'absent' })).toBeNull();
    db.close();
  });

  it('LIST_RECEIPTS, LIST_ATTEMPTS e DIAGNOSTICS profundo', async () => {
    const { db } = await seededDatabase();
    expectCommitted((await import('./executor.ts')).commit(db, request({ commandType: 'BUY_PRODUCT', expectedRevision: 1, mutations: [
      { kind: 'WALLET_DELTA', resourceId: 'CREDITS', delta: -100 }, { kind: 'WALLET_DELTA', resourceId: PACK, delta: 1 },
    ], summary: { productId: 'pack-c01-v1' } })));
    const receipts = query(db, { kind: 'LIST_RECEIPTS', profileId: PROFILE, limit: 10, offset: 0 });
    expect(receipts.map((r) => [r.committedRevision, r.commandType, r.operationId])).toEqual([
      [2, 'BUY_PRODUCT', `op-${PROFILE}-2`], [1, 'CREATE_PROFILE_ONBOARDING', `op-${PROFILE}-1`],
    ]);
    expect(receipts[0]?.receipt).toEqual({ commandType: 'BUY_PRODUCT', summary: { productId: 'pack-c01-v1' }, grants: [] });
    expect(query(db, { kind: 'LIST_RECEIPTS', profileId: PROFILE, limit: 1, offset: 1 }).map((r) => r.committedRevision)).toEqual([1]);
    expect(query(db, { kind: 'LIST_ATTEMPTS', profileId: PROFILE, limit: 10, offset: 0 })).toEqual([]);
    expect(query(db, { kind: 'DIAGNOSTICS', deep: true })).toMatchObject({ quickCheck: 'ok', integrityCheck: 'ok', foreignKeyViolations: 0, tables: 47, userVersion: 1 });
    db.close();
  });
});

describe('createMemoryStorage (StoragePort Node)', () => {
  it('expõe a porta assíncrona com as mesmas semânticas do worker', async () => {
    const storage = await createMemoryStorage();
    expect(storage.diagnostics).toMatchObject({ status: 'CREATED', writable: true, journalMode: 'delete' });
    expect(await storage.installContent(starterInstall())).toEqual({ ok: true, installed: true });
    const epoch = await storage.bumpWriterEpoch('profile-b');
    const created = await storage.commit(onboardingRequest('profile-b', { writerEpoch: epoch }));
    expect(created).toMatchObject({ ok: true, status: 'COMMITTED', committedRevision: 1, operationId: 'op-profile-b-1' });
    expect((await storage.query({ kind: 'PROFILE_SNAPSHOT', profileId: 'profile-b' }))?.profile.writerEpoch).toBe(epoch);
    expect(await storage.write({ kind: 'SET_SETTINGS', profileId: 'profile-b', values: { 'assist.hints': false }, writerEpoch: epoch })).toEqual({ ok: true });
    const bytes = await storage.exportDatabase();
    expect(bytes.length).toBeGreaterThan(4096);
    expect((await storage.query({ kind: 'LIST_PROFILES', includeArchived: false })).map((p) => p.profileId)).toEqual(['profile-b']);
    await storage.close();
    await expect(storage.query({ kind: 'LIST_PROFILES', includeArchived: false })).rejects.toMatchObject({ code: 'SAVE_WRITE_FAILED' });
  });
});
