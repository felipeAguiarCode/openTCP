// Boot, migração e backup (persistencia-sqlite.md §4, §21, §23): DB-005..DB-008 e DB-044.
import { describe, expect, it } from 'vitest';
import { isStorageFailure } from './errors.ts';
import {
  APPLICATION_ID, EXPECTED_TABLES, applyMigration, commit, exportDatabase, openAndMigrate, query, write,
} from './executor.ts';
import { MIGRATION_0001_SHA256, MIGRATION_0001_SQL } from './migrations/0001-schema-v1.ts';
import { loadNodeSqlite, openDatabaseFromBytes, openNodeDatabase } from './node.ts';
import { NOW, PROFILE, count, migratedDatabase, onboardingRequest, seededDatabase, tableCounts } from './test-support.ts';

describe('boot do banco', () => {
  it('DB-005: PRAGMAs de conexão aplicados e lidos de volta; application_id e user_version conferidos', async () => {
    const { db } = await openNodeDatabase();
    const opened = openAndMigrate(db, { now: NOW });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.report).toMatchObject({
      foreignKeys: true, journalMode: 'delete', synchronous: 2, busyTimeout: 1500,
      applicationId: APPLICATION_ID, userVersion: 1, writable: true, readOnlyReason: null,
    });
    expect(db.selectValue('PRAGMA foreign_keys')).toBe(1);
    expect(db.selectValue('PRAGMA journal_mode')).toBe('delete');
    const diagnostics = query(db, { kind: 'DIAGNOSTICS', deep: false });
    expect(diagnostics).toMatchObject({ foreignKeys: true, journalMode: 'delete', userVersion: 1, applicationId: APPLICATION_ID, quickCheck: 'ok', integrityCheck: null, tables: EXPECTED_TABLES });
    db.close();
  });

  it('DB-005: banco em memória não satisfaz journal_mode = DELETE e é recusado (sem save fictício)', async () => {
    const sqlite3 = await loadNodeSqlite();
    const db = new sqlite3.oo1.DB(':memory:', 'c');
    const opened = openAndMigrate(db);
    expect(opened).toMatchObject({ ok: false, code: 'STORAGE_CAPABILITY_MISSING' });
    expect(db.selectValue('PRAGMA user_version')).toBe(0);
    db.close();
  });

  it('DB-006: banco novo recebe DDL, schema_migrations, application_id e user_version uma única vez', async () => {
    const { db } = await openNodeDatabase();
    const opened = openAndMigrate(db, { now: NOW });
    expect(opened.ok && opened.report.status).toBe('CREATED');
    expect(db.selectArrays('SELECT version, migration_name, checksum_sha256, applied_at FROM schema_migrations'))
      .toEqual([[1, '0001-schema-v1', MIGRATION_0001_SHA256, NOW]]);
    expect(db.selectValue('PRAGMA application_id')).toBe(APPLICATION_ID);
    expect(db.selectValue('PRAGMA user_version')).toBe(1);
    expect(db.selectValue("SELECT count(*) FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")).toBe(EXPECTED_TABLES);
    expect(db.selectValue('PRAGMA integrity_check')).toBe('ok');
    expect(query(db, { kind: 'APP_META', key: 'installationId' })).toMatch(/^[0-9a-f-]{32,36}$/);
    expect(openAndMigrate(db)).toMatchObject({ ok: true, report: { status: 'OPENED' } });
    expect(count(db, 'schema_migrations')).toBe(1);
    db.close();
  });

  it('DB-006: migração com falha faz ROLLBACK e deixa user_version 0 sem tabelas', async () => {
    const { db } = await openNodeDatabase();
    db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = DELETE');
    const broken = { version: 1, name: '0001-schema-v1', sql: MIGRATION_0001_SQL + '\nCREATE TABLE profiles (x INTEGER);\n', sha256: MIGRATION_0001_SHA256 };
    let failure: unknown = null;
    try {
      applyMigration(db, broken, NOW);
    } catch (error) {
      failure = error;
    }
    expect(isStorageFailure(failure) && failure.storageCode).toBe('MIGRATION_FAILED');
    expect(db.selectValue('PRAGMA user_version')).toBe(0);
    expect(db.selectValue('PRAGMA application_id')).toBe(0);
    expect(db.selectValue("SELECT count(*) FROM sqlite_schema WHERE type = 'table'")).toBe(0);
    db.close();
  });

  it('DB-007: reabrir um banco existente não reexecuta o DDL nem zera conteúdo', async () => {
    const seeded = await seededDatabase();
    const before = tableCounts(seeded.db);
    expect(openAndMigrate(seeded.db)).toMatchObject({ ok: true, report: { status: 'OPENED' } });
    seeded.db.close();
    const reopened = await openNodeDatabase(seeded.filename);
    const opened = openAndMigrate(reopened.db);
    expect(opened).toMatchObject({ ok: true, report: { status: 'OPENED', writable: true } });
    expect(tableCounts(reopened.db)).toEqual(before);
    expect(count(reopened.db, 'schema_migrations')).toBe(1);
    expect(reopened.db.selectValue('SELECT revision FROM profiles WHERE profile_id = ?', [PROFILE])).toBe(1);
    reopened.db.close();
  });

  it('DB-007: checksum registrado divergente do arquivo conhecido é MIGRATION_FAILED, nunca reaplicação', async () => {
    const database = await migratedDatabase();
    database.db.exec(`UPDATE schema_migrations SET checksum_sha256 = '${'f'.repeat(64)}'`);
    database.db.close();
    const reopened = await openNodeDatabase(database.filename);
    expect(openAndMigrate(reopened.db)).toMatchObject({ ok: false, code: 'MIGRATION_FAILED' });
    expect(count(reopened.db, 'schema_migrations')).toBe(1);
    reopened.db.close();
  });

  it('DB-008: user_version futuro abre só para leitura e recusa escrita sem reduzir a versão', async () => {
    const database = await migratedDatabase();
    database.db.exec('PRAGMA user_version = 2');
    database.db.close();
    const reopened = await openNodeDatabase(database.filename);
    const opened = openAndMigrate(reopened.db);
    expect(opened).toMatchObject({ ok: true, report: { writable: false, readOnlyReason: 'SAVE_VERSION_UNSUPPORTED', userVersion: 2 } });
    expect(commit(reopened.db, onboardingRequest())).toMatchObject({ ok: false, code: 'SAVE_VERSION_UNSUPPORTED' });
    expect(write(reopened.db, { kind: 'SET_APP_META', key: 'appVersion', value: '9.9.9' })).toMatchObject({ ok: false, code: 'SAVE_VERSION_UNSUPPORTED' });
    expect(query(reopened.db, { kind: 'LIST_PROFILES', includeArchived: true })).toEqual([]);
    expect(reopened.db.selectValue('PRAGMA user_version')).toBe(2);
    expect(reopened.db.selectValue("SELECT count(*) FROM app_meta WHERE key = 'appVersion'")).toBe(0);
    reopened.db.close();
  });

  it('banco de outra aplicação é DATABASE_CORRUPT e não é migrado', async () => {
    const foreign = await openNodeDatabase();
    foreign.db.exec('PRAGMA application_id = 42; CREATE TABLE alheia(x INTEGER)');
    expect(openAndMigrate(foreign.db)).toMatchObject({ ok: false, code: 'DATABASE_CORRUPT' });
    foreign.db.close();
    const unmarked = await openNodeDatabase();
    unmarked.db.exec('CREATE TABLE alheia(x INTEGER)');
    expect(openAndMigrate(unmarked.db)).toMatchObject({ ok: false, code: 'DATABASE_CORRUPT' });
    expect(unmarked.db.selectValue("SELECT count(*) FROM sqlite_schema WHERE name = 'profiles'")).toBe(0);
    unmarked.db.close();
  });

  it('escrita sem openAndMigrate é recusada (PRAGMAs nunca ficam implícitos)', async () => {
    const { db } = await openNodeDatabase();
    expect(write(db, { kind: 'SET_APP_META', key: 'k', value: 1 })).toMatchObject({ ok: false, code: 'SAVE_WRITE_FAILED' });
    db.close();
  });
});

describe('backup completo', () => {
  it('DB-044: exportação abre como SQLite comum, com BLOBs, e passa integrity_check e foreign_key_check', async () => {
    const seeded = await seededDatabase();
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
    const { sha256Hex } = await import('../../domain/hash/jcs.ts');
    const assetId = sha256Hex(bytes);
    expect(write(seeded.db, { kind: 'INSERT_ASSET_BLOB', assetId, mediaType: 'image/png', bytes, width: 1, height: 1, metadata: {} }).ok).toBe(true);
    const exported = exportDatabase(seeded.sqlite3, seeded.db);
    expect(new TextDecoder().decode(exported.subarray(0, 15))).toBe('SQLite format 3');
    const restored = await openDatabaseFromBytes(exported);
    const opened = openAndMigrate(restored.db);
    expect(opened).toMatchObject({ ok: true, report: { status: 'OPENED', applicationId: APPLICATION_ID, userVersion: 1 } });
    expect(restored.db.selectValue('PRAGMA integrity_check')).toBe('ok');
    expect(restored.db.selectArrays('PRAGMA foreign_key_check')).toEqual([]);
    expect(tableCounts(restored.db)).toEqual(tableCounts(seeded.db));
    expect(query(restored.db, { kind: 'GET_ASSET', assetId })?.bytes).toEqual(bytes);
    restored.db.close();
    seeded.db.close();
  });

  it('exportação é recusada com transação aberta', async () => {
    const database = await migratedDatabase();
    database.db.exec('BEGIN IMMEDIATE');
    expect(() => exportDatabase(database.sqlite3, database.db)).toThrow(/transação aberta/);
    database.db.exec('ROLLBACK');
    expect(exportDatabase(database.sqlite3, database.db).length).toBeGreaterThan(0);
    database.db.close();
  });
});
