// Restrições do schema v1 (persistencia-sqlite.md §5–§10, §26): tipos STRICT, JSON válido, FK de impressão,
// pontuação ex coerente com a ruleset, normal/foil compartilhando a versão, imutabilidade de versões e
// impressões publicadas, assets referenciados, ledger coerente e SQL sempre parametrizado.
import { describe, expect, it } from 'vitest';
import type { CommitRequest, Mutation } from '../../application/ports/storage.ts';
import { attack, pokemon, printing } from '../../content/builders.ts';
import * as S from '../../tests/support/generic-cards.ts';
import { searchKeyV1 } from '../../domain/cards/naming.ts';
import { jcsHash, sha256Hex } from '../../domain/hash/jcs.ts';
import { commit, installContent, query } from './executor.ts';
import {
  NOW, PACK, PROFILE, RNG_0, STARTER_CARDS, asJson, expectCommitted, migratedDatabase, printingIdOf, request, seededDatabase, starterInstall, tableCounts,
} from './test-support.ts';

function caught(body: () => void): Error {
  try {
    body();
  } catch (error) {
    return error as Error;
  }
  throw new Error('esperava falha do SQLite');
}

const faisca = printingIdOf(S.faisca);

/** Publica uma carta CUSTOM com arte BLOB declarada no appearance (mesmo fluxo do PUBLISH_CARD). */
function publishWithArt(db: Parameters<typeof commit>[0], expectedRevision = 1): { printingId: string; assetId: string; definitionId: string } {
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10]);
  const assetId = sha256Hex(bytes);
  const card = pokemon({ id: 'custom-lume', baseName: 'Lume', stage: 'BASIC', type: 'LIGHTNING', hp: 60, retreat: 1, weakness: null, attacks: [attack({ id: 'luz', name: 'Luz', cost: {}, damage: 10 })] });
  const rules = asJson(card);
  const appearance = asJson({ ...printing({ card, setId: 'custom', number: 1, rarity: 'COMMON' }), artMode: 'IMPORTED', artAssetId: assetId, assetBindings: [{ role: 'ART_MASTER', assetId }] });
  const printingId = (appearance as { printingId: string }).printingId;
  expectCommitted(commit(db, request({ commandType: 'PUBLISH_CARD', expectedRevision, mutations: [
    { kind: 'INSERT_ASSET_BLOB', assetId, mediaType: 'image/png', bytes, width: 1, height: 1, metadata: {} },
    { kind: 'INSERT_CARD_DEFINITION', definitionId: card.id, namespace: 'CUSTOM' },
    { kind: 'INSERT_CARD_VERSION', definitionId: card.id, version: 1, rules, rulesHash: jcsHash(rules), rulesetId: 'local-campaign-v2', searchKey: searchKeyV1(card.name) },
    { kind: 'INSERT_PUBLICATION', definitionId: card.id, version: 1, validatorVersion: 'validator-1', report: { errors: [] }, projectId: null, projectRevision: null },
    { kind: 'INSERT_PRINTING', printingId, definitionId: card.id, definitionVersion: 1, appearance, appearanceHash: jcsHash(appearance) },
    { kind: 'SET_CATALOG_HEAD', definitionId: card.id, version: 1 },
  ] })));
  return { printingId, assetId, definitionId: card.id };
}

describe('tipos e JSON (DB-009, DB-010)', () => {
  it('DB-009: tabelas STRICT recusam valor de tipo incompatível; o executor valida antes do bind', async () => {
    const { db } = await seededDatabase();
    expect(caught(() => db.exec(`INSERT INTO inventory(profile_id, printing_id, quantity) VALUES ('${PROFILE}', '${faisca}', 'muitas')`)).message).toMatch(/cannot store TEXT value in INTEGER column/i);
    expect(caught(() => db.exec(`UPDATE wallets SET balance = 1.5 WHERE profile_id = '${PROFILE}'`)).message).toMatch(/cannot store REAL value in INTEGER column/i);
    const before = tableCounts(db);
    const fractional = request({ commandType: 'BUY_PRODUCT', expectedRevision: 1, mutations: [{ kind: 'WALLET_DELTA', resourceId: 'CREDITS', delta: 0.5 }] });
    expect(commit(db, fractional).ok).toBe(false);
    const badRevision: CommitRequest = { ...request({ commandType: 'BUY_PRODUCT', expectedRevision: 1, mutations: [] }), expectedRevision: 1.5 };
    expect(commit(db, badRevision)).toMatchObject({ ok: false, code: 'INTERNAL_INTEGRITY_ERROR' });
    expect(tableCounts(db)).toEqual(before);
    expect(db.selectValue("SELECT balance FROM wallets WHERE resource_id = 'CREDITS'")).toBe(300);
    db.close();
  });

  it('DB-010: JSON malformado de regras, snapshots ou preferências não é gravado', async () => {
    const { db } = await seededDatabase();
    expect(caught(() => db.exec("INSERT INTO app_meta(key, value_json) VALUES ('quebrado', '{nao: json')")).message).toMatch(/CHECK constraint failed/i);
    expect(caught(() => db.exec(`INSERT INTO settings(profile_id, setting_key, value_json) VALUES ('${PROFILE}', 'k', '[1,')`)).message).toMatch(/CHECK constraint failed/i);
    expect(caught(() => db.exec("UPDATE profiles SET economy_rng_json = 'rng'")).message).toMatch(/CHECK constraint failed/i);
    const def = db.selectObject("SELECT definition_id, version FROM card_versions LIMIT 1")!;
    expect(caught(() => db.exec(`INSERT INTO card_versions(definition_id, version, rules_json, rules_hash, ruleset_id, search_key, created_at)
      VALUES ('${String(def.definition_id)}', 99, '{"id":', '${'a'.repeat(64)}', 'local-campaign-v2', 'x', '${NOW}')`)).message).toMatch(/malformed JSON|CHECK constraint failed/i);
    expect(db.selectValue("SELECT count(*) FROM app_meta WHERE key = 'quebrado'")).toBe(0);
    db.close();
  });
});

describe('catálogo publicado (DB-011, DB-012, DB-013, DB-014, DB-015)', () => {
  it('DB-011: inventário de printingId inexistente é recusado sem escrita parcial', async () => {
    const { db } = await seededDatabase();
    const before = tableCounts(db);
    const grant = request({ commandType: 'OPEN_PACK', expectedRevision: 1, mutations: [
      { kind: 'WALLET_DELTA', resourceId: PACK, delta: -1 },
      { kind: 'INVENTORY_DELTA', printingId: faisca, delta: 1 },
      { kind: 'INVENTORY_DELTA', printingId: 'base-999-nao-existe', delta: 1 },
    ] });
    expect(commit(db, grant)).toMatchObject({ ok: false, code: 'CONTENT_REFERENCE_MISSING' });
    expect(tableCounts(db)).toEqual(before);
    db.close();
  });

  it('DB-012: versão ex com pontuação incompatível com a ruleset é bloqueada na instalação', async () => {
    const { db } = await migratedDatabase();
    const ex = pokemon({ baseName: 'Brasão', ruleBox: 'EX', stage: 'BASIC', type: 'FIRE', hp: 150, retreat: 2, weakness: 'WATER', attacks: [attack({ id: 'x', name: 'X', cost: { FIRE: 2 }, damage: 80 })] });
    expect(ex.knockoutPoints).toBe(2);
    const wrong = { ...ex, knockoutPoints: 1 as const };
    const before = tableCounts(db);
    expect(installContent(db, starterInstall('1.0.0', [...STARTER_CARDS, wrong]), NOW)).toMatchObject({ ok: false, code: 'IMPORT_INVALID' });
    expect(tableCounts(db)).toEqual(before);
    expect(installContent(db, starterInstall('1.0.0', [...STARTER_CARDS, ex]), NOW).ok).toBe(true);
    expect(db.selectValue('SELECT knockout_points FROM card_versions WHERE definition_id = ?', [ex.id])).toBe(2);
    db.close();
  });

  it('DB-013: impressões normal e foil compartilham a mesma definição/versão quando só a aparência muda', async () => {
    const { db } = await migratedDatabase();
    const base = starterInstall();
    const foil = asJson(printing({ card: S.faisca, setId: 'base', number: 1, rarity: 'RARE', finish: 'FOIL' }));
    const foilRow = { printingId: (foil as { printingId: string }).printingId, definitionId: S.faisca.id, definitionVersion: 1, appearance: foil, appearanceHash: jcsHash(foil) };
    const install = { ...base, contentHash: jcsHash({ base: base.contentHash, foil: foilRow.appearanceHash }), printings: [...base.printings, foilRow] };
    expect(installContent(db, install, NOW).ok).toBe(true);
    expect(db.selectArrays('SELECT printing_id, finish, definition_id, definition_version FROM card_printings WHERE definition_id = ? ORDER BY finish', [S.faisca.id]))
      .toEqual([[foilRow.printingId, 'FOIL', S.faisca.id, 1], [faisca, 'NORMAL', S.faisca.id, 1]]);
    expect(db.selectValue('SELECT count(*) FROM card_versions WHERE definition_id = ?', [S.faisca.id])).toBe(1);
    db.close();
  });

  it('DB-014: versão publicada recusa UPDATE/DELETE comum; mudança exige nova versão', async () => {
    const { db } = await seededDatabase();
    expect(caught(() => db.exec(`UPDATE card_versions SET search_key = 'outra' WHERE definition_id = '${S.faisca.id}'`)).message).toMatch(/CARD_VERSION_IMMUTABLE/);
    expect(caught(() => db.exec(`DELETE FROM card_versions WHERE definition_id = '${S.faisca.id}'`)).message).toMatch(/CARD_VERSION_RETAINED/);
    expect(caught(() => db.exec(`UPDATE card_publications SET validator_version = 'x' WHERE definition_id = '${S.faisca.id}'`)).message).toMatch(/CARD_PUBLICATIONS_APPEND_ONLY/);
    // Nova versão é outra linha; a anterior continua intacta.
    const v2 = { ...S.faisca, version: 2, baseHp: 80 };
    expect(installContent(db, starterInstall('1.1.0', [...STARTER_CARDS.filter((c) => c.id !== S.faisca.id), v2]), NOW).ok).toBe(true);
    expect(db.selectArrays('SELECT version, hp FROM card_versions WHERE definition_id = ? ORDER BY version', [S.faisca.id])).toEqual([[1, 70], [2, 80]]);
    db.close();
  });

  it('DB-015: impressão publicada não troca asset nem definição no lugar; vínculo fora dos bindings é recusado', async () => {
    const { db } = await seededDatabase();
    const { printingId, assetId } = publishWithArt(db);
    expect(caught(() => db.exec(`UPDATE card_printings SET definition_version = 2 WHERE printing_id = '${printingId}'`)).message).toMatch(/PRINTING_IMMUTABLE/);
    expect(caught(() => db.exec(`DELETE FROM card_printings WHERE printing_id = '${printingId}'`)).message).toMatch(/PRINTING_RETAINED/);
    expect(caught(() => db.exec(`UPDATE printing_assets SET role = 'FOIL_MASK' WHERE printing_id = '${printingId}'`)).message).toMatch(/PRINTING_ASSETS_APPEND_ONLY/);
    expect(caught(() => db.exec(`INSERT INTO printing_assets(printing_id, role, asset_id) VALUES ('${printingId}', 'FOIL_MASK', '${assetId}')`)).message).toMatch(/PRINTING_ASSET_NOT_DECLARED/);
    expect(caught(() => db.exec(`UPDATE assets SET media_type = 'image/webp' WHERE asset_id = '${assetId}'`)).message).toMatch(/ASSET_IMMUTABLE/);
    expect(db.selectArrays('SELECT role, asset_id FROM printing_assets WHERE printing_id = ?', [printingId])).toEqual([['ART_MASTER', assetId]]);
    db.close();
  });
});

describe('assets, ledger e SQL parametrizado (DB-018, DB-030, DB-052, R-082)', () => {
  it('DB-018: asset referenciado não pode ser removido por limpeza; miniaturas não vivem no banco', async () => {
    const { db } = await seededDatabase();
    const { assetId } = publishWithArt(db);
    expect(caught(() => db.exec(`DELETE FROM assets WHERE asset_id = '${assetId}'`)).message).toMatch(/FOREIGN KEY constraint failed/i);
    expect(db.selectValue('SELECT length(bytes) FROM assets WHERE asset_id = ?', [assetId])).toBe(6);
    const tables = db.selectValues("SELECT name FROM sqlite_schema WHERE type = 'table'").map(String);
    expect(tables.some((t) => /thumb|miniatur|cache/i.test(t))).toBe(false);
    db.close();
  });

  it('R-082: imagem usada por tentativa/replay não é removida ao descartar um preset', async () => {
    const { db } = await seededDatabase();
    const bytes = new Uint8Array([82, 73, 70, 70, 1, 2, 3]);
    const assetId = sha256Hex(bytes);
    expectCommitted(commit(db, request({ commandType: 'SAVE_COSMETIC_PRESET', expectedRevision: 1, mutations: [
      { kind: 'INSERT_ASSET_BLOB', assetId, mediaType: 'image/webp', bytes, width: 4, height: 3, metadata: {} },
      { kind: 'INSERT_COSMETIC_PRESET', presetId: 'preset-arte', revision: 1, config: { playmatId: 'mat-neutral' }, assetIds: [assetId] },
    ] })));
    expectCommitted(commit(db, request({ commandType: 'START_ATTEMPT', expectedRevision: 2, mutations: [{
      kind: 'INSERT_ATTEMPT', attemptId: 'attempt-arte', mode: 'CAMPAIGN', campaignId: 'campaign-main', nodeId: 'node-1', difficulty: 'STANDARD',
      deckId: `deck-fire-${PROFILE}`, deckRevision: 1, progressionEligible: true, stateVersion: 0, rulesetId: 'local-campaign-v2', engineVersion: '1.0.0',
      contentFingerprint: 'base@1.0.0', state: { phase: 'SETUP' }, rng: { draws: 0 }, presentationSnapshot: { playmatAssetId: assetId }, cardRefs: [faisca], assetRefs: [assetId],
    }] })));
    expect(caught(() => db.exec("DELETE FROM cosmetic_presets WHERE preset_id = 'preset-arte'")).message).toMatch(/COSMETIC_PRESET_RETAINED/);
    expect(caught(() => db.exec(`DELETE FROM cosmetic_asset_refs WHERE asset_id = '${assetId}'`)).message).toMatch(/COSMETIC_ASSET_REFS_RETAINED/);
    expect(caught(() => db.exec(`DELETE FROM assets WHERE asset_id = '${assetId}'`)).message).toMatch(/FOREIGN KEY constraint failed/i);
    expect(db.selectValues('SELECT asset_id FROM attempt_asset_refs WHERE attempt_id = ?', ['attempt-arte'])).toEqual([assetId]);
    expect(db.selectValue('SELECT length(bytes) FROM assets WHERE asset_id = ?', [assetId])).toBe(bytes.length);
    db.close();
  });

  it('DB-030: cada operação de saldo grava movimentos coerentes no mesmo commit (saldo = soma; balance_after encadeado)', async () => {
    const { db } = await seededDatabase();
    const ops: Mutation[][] = [
      [{ kind: 'WALLET_DELTA', resourceId: 'CREDITS', delta: -100 }, { kind: 'WALLET_DELTA', resourceId: PACK, delta: 1 }],
      [{ kind: 'WALLET_DELTA', resourceId: PACK, delta: -1 }, { kind: 'INVENTORY_DELTA', printingId: faisca, delta: 2 }],
      [{ kind: 'WALLET_DELTA', resourceId: 'CREDITS', delta: 40 }],
    ];
    ops.forEach((mutations, i) => expectCommitted(commit(db, request({ commandType: 'BUY_PRODUCT', expectedRevision: 1 + i, mutations }))));
    for (const [resource, balance] of db.selectArrays(`SELECT resource_id, balance FROM wallets WHERE profile_id = '${PROFILE}'`)) {
      expect(db.selectValue('SELECT sum(delta) FROM wallet_entries WHERE profile_id = ? AND resource_id = ?', [PROFILE, String(resource)])).toBe(balance);
      const entries = db.selectArrays('SELECT w.delta, w.balance_after FROM wallet_entries w JOIN operations o ON o.operation_id = w.operation_id WHERE w.profile_id = ? AND w.resource_id = ? ORDER BY o.committed_revision, w.entry_no', [PROFILE, String(resource)]);
      let running = 0;
      for (const [delta, after] of entries) { running += Number(delta); expect(after).toBe(running); }
    }
    for (const [printingId, quantity] of db.selectArrays(`SELECT printing_id, quantity FROM inventory WHERE profile_id = '${PROFILE}'`)) {
      expect(db.selectValue('SELECT sum(delta) FROM inventory_entries WHERE profile_id = ? AND printing_id = ?', [PROFILE, String(printingId)])).toBe(quantity);
    }
    // Todo movimento pertence a uma operação confirmada do mesmo perfil.
    expect(db.selectValue('SELECT count(*) FROM wallet_entries w LEFT JOIN operations o ON o.operation_id = w.operation_id WHERE o.operation_id IS NULL')).toBe(0);
    expect(db.selectValue('SELECT count(DISTINCT operation_id) FROM wallet_entries')).toBe(4);
    db.close();
  });

  it('DB-052: texto do usuário é sempre parâmetro — não executa SQL', async () => {
    const { db } = await seededDatabase();
    const evil = "Ana'); DROP TABLE profiles; --";
    expectCommitted(commit(db, request({ commandType: 'CREATE_PROFILE_ONBOARDING', expectedRevision: 0, profileId: 'profile-evil', mutations: [
      { kind: 'INSERT_PROFILE', displayName: evil, progressionMode: 'STANDARD', rngJson: RNG_0 },
      { kind: 'INSERT_DECK', deckId: 'deck-evil', name: "x' OR 1=1; DELETE FROM inventory; --" },
    ] })));
    expect(query(db, { kind: 'LIST_PROFILES', includeArchived: true }).find((p) => p.profileId === 'profile-evil')?.displayName).toBe(evil);
    expect(db.selectValue('SELECT count(*) FROM profiles')).toBe(2);
    expect(Number(db.selectValue('SELECT count(*) FROM inventory'))).toBeGreaterThan(0);
    expect(query(db, { kind: 'PROFILE_SNAPSHOT', profileId: 'profile-evil' })?.decks[0]?.name).toBe("x' OR 1=1; DELETE FROM inventory; --");
    db.close();
  });
});
