// Storage Worker (persistencia-sqlite.md §1, §4, §20; runtime-offline-threejs.md §2.4): dono da única conexão
// SQLite, persistida pelo VFS "opfs". Atende mensagens tipadas uma por vez; nunca recebe SQL.
// O runtime SQLite é carregado de /vendor/sqlite/ (tools/copy-vendor.mjs) em tempo de execução, fora do bundle.
import type { Database, Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import type { RestoreSwapOk, RestoreSwapRequest, StorageError } from '../../application/ports/storage.ts';
import { sha256Hex } from '../../domain/hash/jcs.ts';
import { fail, storageError, toStorageError } from './errors.ts';
import { dispatch, openAndMigrate } from './executor.ts';
import { opfsExists, opfsMove, opfsRead, opfsRemove, opfsRemoveTree } from './opfs-files.ts';
import type { InitArgs, OpenReport, RpcRequest, RpcResponse } from './protocol.ts';
import { DATABASE_PATH, DEFAULT_SQLITE_URL } from './protocol.ts';
import { BACKUPS_DIR, STAGING_DIR, fileStamp, openVerified, swapDatabase } from './restore.ts';

type WorkerScope = {
  onmessage: ((event: MessageEvent<RpcRequest>) => void) | null;
  postMessage: (message: RpcResponse, transfer?: Transferable[]) => void;
  close: () => void;
};

type SqliteModule = { readonly default: (options?: Record<string, unknown>) => Promise<Sqlite3Static> };

const scope = globalThis as unknown as WorkerScope;

let sqlite3: Sqlite3Static | null = null;
let db: Database | null = null;
let closed = false;
let queue: Promise<void> = Promise.resolve();

async function loadRuntime(url: string): Promise<Sqlite3Static> {
  let module: SqliteModule;
  try {
    module = (await import(/* @vite-ignore */ url)) as SqliteModule;
  } catch (error) {
    return fail('SQLITE_RUNTIME_MISSING', `runtime SQLite local ausente em ${url}: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    return await module.default();
  } catch (error) {
    return fail('SQLITE_RUNTIME_MISSING', `falha ao iniciar o SQLite WASM: ${error instanceof Error ? error.message : String(error)}`);
  }
}

let mainPath = DATABASE_PATH;

async function init(args: InitArgs): Promise<OpenReport> {
  if (db) fail('SAVE_WRITE_FAILED', 'Storage Worker já inicializado');
  mainPath = args.filename || DATABASE_PATH;
  // Arquivos de staging órfãos (restauração interrompida) são removidos no boot seguinte (persistencia §25.1).
  await opfsRemoveTree(STAGING_DIR).catch(() => undefined);
  const runtime = await loadRuntime(args.sqliteUrl || DEFAULT_SQLITE_URL);
  if (typeof runtime.oo1.OpfsDb !== 'function') {
    fail('STORAGE_CAPABILITY_MISSING', 'VFS "opfs" indisponível: requer crossOriginIsolated, SharedArrayBuffer e OPFS com sync access handles');
  }
  let handle: Database;
  try {
    handle = new runtime.oo1.OpfsDb(args.filename || DATABASE_PATH, 'c');
  } catch (error) {
    const classified = toStorageError(error, 'open');
    return fail(classified.code === 'DATABASE_CORRUPT' ? 'DATABASE_CORRUPT' : 'STORAGE_CAPABILITY_MISSING', `não foi possível abrir ${args.filename}: ${classified.message}`);
  }
  const opened = openAndMigrate(handle);
  if (!opened.ok) {
    handle.close();
    return fail(opened.code, opened.message);
  }
  sqlite3 = runtime;
  db = handle;
  return opened.report;
}

/**
 * Substituir a instalação inteira (persistencia §25.1): com a fila deste worker parada nesta mensagem, fecha a
 * conexão principal, preserva o arquivo atual em backups/, move o staging validado para o principal e reabre pelo
 * boot normal. Falha depois do primeiro rename devolve o arquivo anterior e reabre o banco antigo.
 */
async function restoreSwap(request: RestoreSwapRequest): Promise<RestoreSwapOk | StorageError> {
  const runtime = sqlite3;
  const current = db;
  if (!runtime || !current) return storageError('SAVE_WRITE_FAILED', 'Storage Worker ainda não inicializado');
  if (!request.stagingPath.startsWith(`${STAGING_DIR}/`) || request.stagingPath.includes('..')) {
    return storageError('IMPORT_INVALID', 'caminho de staging fora de /card-campaign/staging/');
  }
  if (runtime.capi.sqlite3_get_autocommit(current) === 0) return storageError('SAVE_WRITE_FAILED', 'há uma transação aberta; tente de novo');
  const result = await swapDatabase({
    files: { exists: opfsExists, read: opfsRead, move: opfsMove, remove: opfsRemove },
    closeCurrent: () => { current.close(); db = null; },
    open: (path) => {
      let handle: Database;
      try {
        handle = new runtime.oo1.OpfsDb(path, 'c');
      } catch (error) {
        return toStorageError(error, 'open');
      }
      const opened = openVerified(handle, openAndMigrate(handle));
      if (!opened.ok) handle.close();
      return opened;
    },
    sha256: (bytes) => sha256Hex(bytes),
  }, { mainPath, stagingPath: request.stagingPath, backupsDir: BACKUPS_DIR, expectedSha256: request.expectedSha256, stamp: fileStamp(new Date().toISOString()) });
  if (result.ok) {
    db = result.db;
    await opfsRemove(request.stagingPath).catch(() => undefined);
    return { ok: true, previousPath: result.previousPath, userVersion: result.report.userVersion };
  }
  db = result.db;
  return storageError(result.code, result.message);
}

/** “Apagar todos os dados locais”: fecha a conexão e remove o diretório da aplicação no OPFS. */
async function wipeAll(): Promise<void> {
  closed = true;
  db?.close();
  db = null;
  const root = mainPath.split('/').filter(Boolean)[0] ?? 'card-campaign';
  await opfsRemoveTree(`/${root}`);
}

function post(response: RpcResponse, transfer: Transferable[] = []): void {
  scope.postMessage(response, transfer);
}

function postFailure(id: number, error: unknown): void {
  const classified = toStorageError(error, 'query');
  post({ id, ok: false, error: { code: classified.code, message: classified.message } });
}

async function handle(request: RpcRequest): Promise<void> {
  if (closed) {
    post({ id: request.id, ok: false, error: { code: 'SAVE_WRITE_FAILED', message: 'Storage Worker encerrado' } });
    return;
  }
  try {
    switch (request.method) {
      case 'init': {
        post({ id: request.id, ok: true, result: await init(request.args) });
        return;
      }
      case 'restoreSwap': {
        post({ id: request.id, ok: true, result: await restoreSwap(request.args) });
        return;
      }
      case 'wipeAll': {
        await wipeAll();
        post({ id: request.id, ok: true, result: null });
        scope.close();
        return;
      }
      case 'close': {
        closed = true;
        db?.close();
        db = null;
        post({ id: request.id, ok: true, result: null });
        scope.close();
        return;
      }
      default: {
        if (!db || !sqlite3) fail('SAVE_WRITE_FAILED', 'Storage Worker ainda não inicializado');
        const result = dispatch(sqlite3, db, request);
        post({ id: request.id, ok: true, result }, result instanceof Uint8Array ? [result.buffer as ArrayBuffer] : []);
      }
    }
  } catch (error) {
    postFailure(request.id, error);
  }
}

// Uma mensagem por vez, na ordem de chegada (persistencia §4: o worker serializa handlers).
scope.onmessage = (event) => {
  const request = event.data;
  queue = queue.then(() => handle(request), () => handle(request));
};
