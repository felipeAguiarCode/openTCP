// Adaptador Node para testes: o mesmo executor sobre o build Node do SQLite WASM. Os bancos vivem no
// sistema de arquivos em memória do Emscripten (MEMFS), com nome próprio, para que journal_mode = DELETE e
// os demais PRAGMAs sejam lidos de volta como no OPFS. Não é um save persistente (persistencia §2).
import type { Database, Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import type { CommitRequest, ContentInstall, LightWrite, Query, QueryResult, StoragePort } from '../../application/ports/storage.ts';
import { isStorageFailure, toStorageError } from './errors.ts';
import { commit, exportDatabase, installContent, openAndMigrate, query, write, bumpWriterEpoch, type OpenOptions } from './executor.ts';
import { rpcError, type OpenReport } from './protocol.ts';

let runtime: Promise<Sqlite3Static> | null = null;

/** Carrega o SQLite WASM uma vez por processo e silencia os avisos de `sqlite3_step()` das rejeições esperadas. */
export function loadNodeSqlite(): Promise<Sqlite3Static> {
  runtime ??= (async () => {
    const module = await import('@sqlite.org/sqlite-wasm');
    const sqlite3 = await module.default();
    const config = (sqlite3 as unknown as { config?: { warn?: unknown } }).config;
    if (config) config.warn = () => undefined;
    return sqlite3;
  })();
  return runtime;
}

let sequence = 0;

export function uniqueDatabaseName(): string {
  sequence += 1;
  return `/card-campaign-test-${process.pid}-${sequence}.sqlite3`;
}

export type NodeDatabase = { readonly sqlite3: Sqlite3Static; readonly db: Database; readonly filename: string };

/** Abre (ou cria) um arquivo no MEMFS; não aplica PRAGMAs nem migração. */
export async function openNodeDatabase(filename: string = uniqueDatabaseName()): Promise<NodeDatabase> {
  const sqlite3 = await loadNodeSqlite();
  return { sqlite3, db: new sqlite3.oo1.DB(filename, 'c'), filename };
}

/** Grava bytes exportados como um arquivo novo no MEMFS e o abre como banco comum (round-trip de backup). */
export async function openDatabaseFromBytes(bytes: Uint8Array, filename: string = uniqueDatabaseName()): Promise<NodeDatabase> {
  const sqlite3 = await loadNodeSqlite();
  sqlite3.capi.sqlite3_js_posix_create_file(filename, bytes);
  return { sqlite3, db: new sqlite3.oo1.DB(filename, 'w'), filename };
}

function rejection(error: unknown): Error {
  if (isStorageFailure(error)) return rpcError(error.storageCode, error.message);
  const classified = toStorageError(error, 'query');
  return rpcError(classified.code, classified.message);
}

function attempt<T>(body: () => T): Promise<T> {
  try {
    return Promise.resolve(body());
  } catch (error) {
    return Promise.reject(rejection(error));
  }
}

/** StoragePort síncrono por baixo, com as mesmas semânticas de erro do cliente RPC do navegador. */
export function storageOverDatabase(sqlite3: Sqlite3Static, db: Database): StoragePort {
  let closed = false;
  const guard = <T>(body: () => T): Promise<T> => (closed ? Promise.reject(rpcError('SAVE_WRITE_FAILED', 'armazenamento fechado')) : attempt(body));
  return {
    query: <Q extends Query>(q: Q) => guard(() => query(db, q) as QueryResult<Q>),
    commit: (request: CommitRequest) => guard(() => commit(db, request)),
    write: (lightWrite: LightWrite) => guard(() => write(db, lightWrite)),
    installContent: (install: ContentInstall) => guard(() => installContent(db, install)),
    bumpWriterEpoch: (profileId: string) => guard(() => bumpWriterEpoch(db, profileId)),
    exportDatabase: () => guard(() => exportDatabase(sqlite3, db)),
    close: () => {
      if (!closed) {
        closed = true;
        db.close();
      }
      return Promise.resolve();
    },
  };
}

export type MemoryStorage = StoragePort & { readonly diagnostics: OpenReport; readonly database: NodeDatabase };

/** StoragePort completo para testes: banco novo, migrado pelo runner normativo, no MEMFS. */
export async function createMemoryStorage(options: OpenOptions & { readonly filename?: string } = {}): Promise<MemoryStorage> {
  const database = await openNodeDatabase(options.filename);
  const opened = openAndMigrate(database.db, options);
  if (!opened.ok) {
    database.db.close();
    throw rpcError(opened.code, opened.message);
  }
  return { ...storageOverDatabase(database.sqlite3, database.db), diagnostics: opened.report, database };
}
