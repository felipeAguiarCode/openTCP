// Restauração de backup completo (persistencia §23, §25.1; DB-044, DB-048, DB-051): validação em conexão
// descartável, staging canônico e troca atômica com volta ao arquivo anterior em caso de falha.
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../../domain/hash/jcs.ts';
import { exportDatabase, openAndMigrate, query } from './executor.ts';
import { loadNodeSqlite, openDatabaseFromBytes, uniqueDatabaseName } from './node.ts';
import { BACKUPS_DIR, inspectBackup, openVerified, sqliteHeader, swapDatabase, type SwapFiles } from './restore.ts';
import { NOW, PROFILE, seededDatabase, tableCounts } from './test-support.ts';

async function backupBytes(): Promise<Uint8Array> {
  const { sqlite3, db } = await seededDatabase();
  const bytes = exportDatabase(sqlite3, db);
  db.close();
  return bytes;
}

/** Modifica uma cópia do backup com SQL arbitrário (simula um arquivo adulterado) e devolve os bytes. */
async function tampered(bytes: Uint8Array, sql: string): Promise<Uint8Array> {
  const { sqlite3, db } = await openDatabaseFromBytes(bytes);
  db.exec(sql);
  const out = sqlite3.capi.sqlite3_js_db_export(db);
  db.close();
  return out;
}

async function inspect(bytes: Uint8Array) {
  const sqlite3 = await loadNodeSqlite();
  return inspectBackup(sqlite3, bytes, { now: NOW, stagingName: uniqueDatabaseName() });
}

describe('backup completo: validação e staging (persistencia §25.1)', () => {
  it('DB-044: os bytes exportados reabrem como SQLite comum e passam integrity/foreign_key_check', async () => {
    const bytes = await backupBytes();
    const header = sqliteHeader(bytes);
    expect(header).toMatchObject({ valid: true, applicationId: 1128354372, userVersion: 1 });
    const { db } = await openDatabaseFromBytes(bytes);
    expect(db.selectValue('PRAGMA integrity_check')).toBe('ok');
    expect(db.selectArrays('PRAGMA foreign_key_check')).toEqual([]);
    expect(db.selectValue('SELECT display_name FROM profiles WHERE profile_id = ?', [PROFILE])).toBe('Ana');
    db.close();
  });

  it('aceita um backup válido e copia todas as linhas para um banco canônico novo', async () => {
    const bytes = await backupBytes();
    const result = await inspect(bytes);
    if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
    expect(result.inspection.profiles.map((p) => p.profileId)).toEqual([PROFILE]);
    expect(result.inspection.profiles[0]).toMatchObject({ displayName: 'Ana', decks: 3, activeAttempt: null });
    expect(result.inspection.contentPackages.map((p) => p.packageId)).toEqual(['base']);
    expect(result.inspection.checks.length).toBeGreaterThanOrEqual(6);
    const original = await openDatabaseFromBytes(bytes);
    const before = tableCounts(original.db);
    original.db.close();
    expect(tableCounts(result.staging)).toEqual(before);
    // O staging é consultável pelas mesmas consultas da aplicação e reabre a partir dos seus bytes.
    expect(query(result.staging, { kind: 'PROFILE_SNAPSHOT', profileId: PROFILE })?.wallets.CREDITS).toBe(300);
    result.staging.close();
    const reopened = await openDatabaseFromBytes(result.stagingBytes);
    expect(reopened.db.selectValue('PRAGMA integrity_check')).toBe('ok');
    expect(openAndMigrate(reopened.db).ok).toBe(true);
    reopened.db.close();
  });

  it('DB-048: recusa tabela, gatilho ou visão estranhos ao schema canônico', async () => {
    const bytes = await backupBytes();
    for (const sql of [
      'CREATE TABLE evil(x)',
      "CREATE TRIGGER evil_trigger AFTER INSERT ON profiles BEGIN DELETE FROM operations; END",
      'CREATE VIEW evil_view AS SELECT * FROM profiles',
      'CREATE INDEX evil_index ON profiles(display_name)',
    ]) {
      const result = await inspect(await tampered(bytes, sql));
      expect(result.ok, sql).toBe(false);
      if (!result.ok) expect(result.code).toBe('IMPORT_INVALID');
    }
  });

  it('recusa application_id alheio, user_version mais novo e arquivo que não é SQLite', async () => {
    const bytes = await backupBytes();
    const alien = await inspect(await tampered(bytes, 'PRAGMA application_id = 42'));
    expect(alien).toMatchObject({ ok: false, code: 'IMPORT_INVALID' });
    const future = await inspect(await tampered(bytes, 'PRAGMA user_version = 2'));
    expect(future).toMatchObject({ ok: false, code: 'SAVE_VERSION_UNSUPPORTED' });
    const garbage = await inspect(new TextEncoder().encode('não sou um banco'.repeat(100)));
    expect(garbage).toMatchObject({ ok: false, code: 'IMPORT_INVALID' });
  });

  it('DB-051: recusa arquivo com páginas danificadas ou referências quebradas', async () => {
    const bytes = await backupBytes();
    const header = sqliteHeader(bytes);
    // Danifica o meio de várias páginas de dados (não o cabeçalho): integrity_check precisa reprovar.
    const corrupted = bytes.slice();
    for (let page = 3; page < Math.min(header.pageCount, 60); page += 2) {
      const at = (page - 1) * header.pageSize;
      corrupted.fill(0xa5, at + 8, at + 64);
    }
    const damaged = await inspect(corrupted);
    expect(damaged.ok).toBe(false);
    if (!damaged.ok) expect(damaged.code).toBe('IMPORT_INVALID');

    const orphan = await inspect(await tampered(bytes, `PRAGMA foreign_keys = OFF;
      INSERT INTO inventory(profile_id, printing_id, quantity) VALUES ('${PROFILE}', 'impressao-inexistente', 1);`));
    expect(orphan.ok).toBe(false);
    if (!orphan.ok) expect(orphan.message).toMatch(/foreign_key_check/);
  });

  it('recusa schema_migrations adulterada', async () => {
    const bytes = await backupBytes();
    const result = await inspect(await tampered(bytes, "UPDATE schema_migrations SET checksum_sha256 = '0000000000000000000000000000000000000000000000000000000000000000'"));
    expect(result).toMatchObject({ ok: false, code: 'IMPORT_INVALID' });
  });
});

/** Sistema de arquivos falso (Map) com o mesmo contrato do OPFS usado na troca. */
function fakeFiles(initial: Record<string, Uint8Array>, failMoveTo?: string): SwapFiles & { readonly map: Map<string, Uint8Array> } {
  const map = new Map(Object.entries(initial));
  return {
    map,
    exists: async (p) => map.has(p),
    read: async (p) => map.get(p) ?? null,
    move: async (from, to) => {
      if (to === failMoveTo) throw new Error(`falha simulada ao mover para ${to}`);
      const bytes = map.get(from);
      if (!bytes) throw new Error(`${from} ausente`);
      map.set(to, bytes);
      map.delete(from);
    },
    remove: async (p) => { map.delete(p); },
  };
}

describe('troca do banco principal (persistencia §25.1)', () => {
  const MAIN = '/card-campaign/main.sqlite3';
  const STAGING = '/card-campaign/staging/import-1.sqlite3';

  async function deps(files: SwapFiles) {
    const sqlite3 = await loadNodeSqlite();
    let open: { db: import('./sql.ts').DB } | null = null;
    return {
      sqlite3,
      current: () => open,
      deps: {
        files,
        closeCurrent: () => { open?.db.close(); open = null; },
        open: (path: string) => {
          const bytes = (files as ReturnType<typeof fakeFiles>).map.get(path);
          if (!bytes) return { ok: false as const, code: 'DATABASE_CORRUPT' as const, message: 'ausente' };
          const name = uniqueDatabaseName();
          sqlite3.capi.sqlite3_js_posix_create_file(name, bytes);
          const db = new sqlite3.oo1.DB(name, 'w');
          const opened = openVerified(db, openAndMigrate(db));
          if (opened.ok) open = { db };
          else db.close();
          return opened;
        },
        sha256: (bytes: Uint8Array) => sha256Hex(bytes),
      },
    };
  }

  it('preserva o banco anterior em backups/ e abre o staging como principal', async () => {
    const current = await backupBytes();
    const restored = await tampered(current, "UPDATE profiles SET display_name = 'Restaurada'");
    const files = fakeFiles({ [MAIN]: current, [STAGING]: restored });
    const env = await deps(files);
    const result = await swapDatabase(env.deps, { mainPath: MAIN, stagingPath: STAGING, backupsDir: BACKUPS_DIR, expectedSha256: sha256Hex(restored), stamp: '2026-10-14T00-00-00Z' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.previousPath).toBe(`${BACKUPS_DIR}/main-2026-10-14T00-00-00Z.sqlite3`);
    expect(files.map.get(result.previousPath)).toBe(current);
    expect(files.map.has(STAGING)).toBe(false);
    expect(result.db.selectValue('SELECT display_name FROM profiles')).toBe('Restaurada');
    result.db.close();
  });

  it('staging diferente do validado não toca o banco atual', async () => {
    const current = await backupBytes();
    const files = fakeFiles({ [MAIN]: current, [STAGING]: current });
    const env = await deps(files);
    const result = await swapDatabase(env.deps, { mainPath: MAIN, stagingPath: STAGING, backupsDir: BACKUPS_DIR, expectedSha256: '0'.repeat(64), stamp: 'x' });
    expect(result).toMatchObject({ ok: false, code: 'IMPORT_INVALID', restoredPrevious: false });
    expect(files.map.get(MAIN)).toBe(current);
  });

  it('falha depois do primeiro rename devolve o arquivo anterior e reabre o banco atual', async () => {
    const current = await backupBytes();
    const broken = new TextEncoder().encode('lixo'.repeat(1024));
    const files = fakeFiles({ [MAIN]: current, [STAGING]: broken });
    const env = await deps(files);
    const result = await swapDatabase(env.deps, { mainPath: MAIN, stagingPath: STAGING, backupsDir: BACKUPS_DIR, expectedSha256: sha256Hex(broken), stamp: 's' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.restoredPrevious).toBe(true);
    expect(files.map.get(MAIN)).toBe(current);
    expect([...files.map.keys()].some((k) => k.startsWith(BACKUPS_DIR))).toBe(false);
    expect(result.db?.selectValue('SELECT display_name FROM profiles')).toBe('Ana');
    result.db?.close();
  });

  it('falha ao mover o staging também volta ao arquivo anterior', async () => {
    const current = await backupBytes();
    const files = fakeFiles({ [MAIN]: current, [STAGING]: current }, MAIN);
    const env = await deps(files);
    const result = await swapDatabase(env.deps, { mainPath: MAIN, stagingPath: STAGING, backupsDir: BACKUPS_DIR, expectedSha256: sha256Hex(current), stamp: 's' });
    // O move de volta para MAIN também falha nesta simulação: o anterior fica preservado em backups/ e o erro diz onde.
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('DATABASE_CORRUPT');
    expect(result.message).toMatch(/backups\/main-s\.sqlite3/);
    expect(files.map.get(`${BACKUPS_DIR}/main-s.sqlite3`)).toBe(current);
  });
});
