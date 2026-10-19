// Tradução de falhas do SQLite (persistencia-sqlite.md §12.2) e checagens de capacidade/lock do cliente (§2, §20).
import { describe, expect, it } from 'vitest';
import { acquireDatabaseLock, checkCapabilities, type CapabilityHost } from './client.ts';
import { toStorageError } from './errors.ts';
import { migratedDatabase } from './test-support.ts';

function caught(body: () => void): unknown {
  try {
    body();
  } catch (error) {
    return error;
  }
  throw new Error('esperava falha');
}

describe('toStorageError', () => {
  it('traduz RAISE de triggers, FK, UNIQUE de negócio e códigos de E/S reais do SQLite', async () => {
    const { db } = await migratedDatabase();
    db.exec(`INSERT INTO profiles VALUES ('p','P','STANDARD',1,0,'{}','x','x',0);
             INSERT INTO operations VALUES ('op-p-1','p','c1','T','${'a'.repeat(64)}',1,'{}','x');
             INSERT INTO reward_grants VALUES ('p','k','op-p-1','x');`);
    expect(toStorageError(caught(() => db.exec("UPDATE operations SET receipt_json = '[]'")), 'commit').code).toBe('INTERNAL_INTEGRITY_ERROR');
    expect(toStorageError(caught(() => db.exec('DELETE FROM reward_grants')), 'commit').code).toBe('INTERNAL_INTEGRITY_ERROR');
    expect(toStorageError(caught(() => db.exec("INSERT INTO inventory VALUES ('p','absent',1)")), 'commit').code).toBe('CONTENT_REFERENCE_MISSING');
    expect(toStorageError(caught(() => db.exec("INSERT INTO reward_grants VALUES ('p','k','op-p-1','y')")), 'commit').code).toBe('REWARD_ALREADY_GRANTED');
    expect(toStorageError(caught(() => db.exec(`INSERT INTO operations VALUES ('op-x','p','c2','T','${'a'.repeat(64)}',1,'{}','x')`)), 'commit').code).toBe('REVISION_CONFLICT');
    expect(toStorageError(caught(() => db.exec("INSERT INTO wallets VALUES ('p','GEMS',1)")), 'commit').code).toBe('INTERNAL_INTEGRITY_ERROR');
    expect(toStorageError(caught(() => db.exec("INSERT INTO wallets VALUES ('p','GEMS',1)")), 'install').code).toBe('IMPORT_INVALID');
    db.close();
  });

  it('códigos primários: FULL, CORRUPT, NOTADB, IOERR/BUSY e o RAISE de binding não declarado', () => {
    const sqliteError = (resultCode: number, message: string) => Object.assign(new Error(message), { resultCode });
    expect(toStorageError(sqliteError(13, 'database or disk is full'), 'commit').code).toBe('STORAGE_FULL');
    expect(toStorageError(sqliteError(11, 'database disk image is malformed'), 'commit').code).toBe('DATABASE_CORRUPT');
    expect(toStorageError(sqliteError(26, 'file is not a database'), 'open').code).toBe('DATABASE_CORRUPT');
    expect(toStorageError(sqliteError(266, 'disk I/O error'), 'commit').code).toBe('SAVE_WRITE_FAILED');
    expect(toStorageError(sqliteError(5, 'database is locked'), 'commit').code).toBe('SAVE_WRITE_FAILED');
    expect(toStorageError(sqliteError(1811, 'SQLITE_CONSTRAINT_TRIGGER: PRINTING_ASSET_NOT_DECLARED'), 'commit').code).toBe('CONTENT_REFERENCE_MISSING');
    expect(toStorageError(sqliteError(1811, 'SQLITE_CONSTRAINT_TRIGGER: EDITOR_REVISION_RETAINED'), 'write').code).toBe('INTERNAL_INTEGRITY_ERROR');
    expect(toStorageError(new TypeError('bug'), 'commit').code).toBe('INTERNAL_INTEGRITY_ERROR');
  });
});

describe('cliente do navegador', () => {
  const full: CapabilityHost = {
    isSecureContext: true, crossOriginIsolated: true, location: { origin: 'http://localhost:4173' },
    Worker: function Worker() {}, WebAssembly: {}, SharedArrayBuffer: function SharedArrayBuffer() {},
    navigator: { storage: { getDirectory: () => undefined }, locks: {} },
  };

  it('checa capacidades na ordem do boot e com o código de produto certo', () => {
    expect(checkCapabilities(full)).toBeNull();
    expect(checkCapabilities({ ...full, isSecureContext: false, crossOriginIsolated: false })?.code).toBe('ORIGIN_ISOLATION_REQUIRED');
    expect(checkCapabilities({ ...full, crossOriginIsolated: false })?.code).toBe('ORIGIN_ISOLATION_REQUIRED');
    expect(checkCapabilities({ ...full, Worker: undefined })).toMatchObject({ code: 'STORAGE_CAPABILITY_MISSING', message: expect.stringContaining('Worker') });
    expect(checkCapabilities({ ...full, WebAssembly: undefined })?.message).toContain('WebAssembly');
    expect(checkCapabilities({ ...full, navigator: { locks: {} } })?.message).toContain('OPFS');
    expect(checkCapabilities({ ...full, SharedArrayBuffer: undefined })?.message).toContain('SharedArrayBuffer');
    expect(checkCapabilities({ ...full, navigator: { storage: { getDirectory: () => undefined } } })?.message).toContain('Web Locks');
  });

  it('o lock exclusivo do banco fica retido até release; a segunda aba recebe null (DATABASE_IN_USE)', async () => {
    const held = new Set<string>();
    const locks = {
      request: (name: string, options: { ifAvailable?: boolean }, callback: (lock: { name: string } | null) => unknown) => {
        if (held.has(name) && options.ifAvailable) return Promise.resolve(callback(null));
        held.add(name);
        return Promise.resolve(callback({ name })).finally(() => held.delete(name));
      },
    } as unknown as LockManager;
    const first = await acquireDatabaseLock(locks);
    expect(first).not.toBeNull();
    expect(await acquireDatabaseLock(locks)).toBeNull();
    await first?.release();
    const third = await acquireDatabaseLock(locks);
    expect(third).not.toBeNull();
    await third?.release();
  });
});
