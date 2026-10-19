// Worker DESCARTÁVEL de validação de backup (persistencia-sqlite.md §25, §25.1 passos 1–5). Recebe os bytes de
// um .sqlite3 externo, valida-os numa conexão em memória somente leitura (restore.ts), monta o staging canônico,
// grava-o em /card-campaign/staging/<importId>.sqlite3 e confere a releitura. Nunca abre o banco principal nem
// recebe SQL; a thread principal o encerra (terminate) ao terminar ou ao estourar o tempo.
import type { Database, Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import { sha256Hex } from '../../domain/hash/jcs.ts';
import { fail, toStorageError } from './errors.ts';
import { opfsRead, opfsRemove, opfsWrite } from './opfs-files.ts';
import { gatherProfileExport } from './profile-export.ts';
import type { RestoreWorkerRequest, RestoreWorkerResponse } from './protocol.ts';
import { STAGING_DIR, inspectBackup } from './restore.ts';

type WorkerScope = {
  onmessage: ((event: MessageEvent<RestoreWorkerRequest>) => void) | null;
  postMessage: (message: RestoreWorkerResponse, transfer?: Transferable[]) => void;
  close: () => void;
};

type SqliteModule = { readonly default: (options?: Record<string, unknown>) => Promise<Sqlite3Static> };

const scope = globalThis as unknown as WorkerScope;
let runtime: Sqlite3Static | null = null;
let staging: Database | null = null;
let queue: Promise<void> = Promise.resolve();

async function load(url: string): Promise<Sqlite3Static> {
  if (runtime) return runtime;
  let module: SqliteModule;
  try {
    module = (await import(/* @vite-ignore */ url)) as SqliteModule;
  } catch (error) {
    return fail('SQLITE_RUNTIME_MISSING', `runtime SQLite local ausente em ${url}: ${error instanceof Error ? error.message : String(error)}`);
  }
  runtime = await module.default();
  return runtime;
}

async function inspect(request: Extract<RestoreWorkerRequest, { kind: 'inspect' }>): Promise<unknown> {
  const sqlite3 = await load(request.sqliteUrl);
  staging?.close();
  staging = null;
  const result = inspectBackup(sqlite3, request.bytes, { now: request.now, stagingName: `/restore-staging-${request.id}.sqlite3`, deadlineMs: request.deadlineMs });
  if (!result.ok) fail(result.code, result.message);
  staging = result.staging;
  const stagingSha256 = sha256Hex(result.stagingBytes);
  if (request.stagingPath !== null) {
    if (!request.stagingPath.startsWith(`${STAGING_DIR}/`)) fail('IMPORT_INVALID', 'caminho de staging inválido');
    await opfsWrite(request.stagingPath, result.stagingBytes);
    const written = await opfsRead(request.stagingPath);
    if (!written || sha256Hex(written) !== stagingSha256) {
      await opfsRemove(request.stagingPath).catch(() => undefined);
      fail('STORAGE_FULL', 'o staging gravado no armazenamento do navegador não confere (espaço insuficiente?)');
    }
  }
  return { inspection: result.inspection, stagingPath: request.stagingPath, stagingSha256, stagingBytes: result.stagingBytes.length };
}

async function handle(request: RestoreWorkerRequest): Promise<void> {
  try {
    switch (request.kind) {
      case 'inspect': {
        scope.postMessage({ id: request.id, ok: true, result: await inspect(request) });
        return;
      }
      case 'exportProfile': {
        if (!staging) fail('NOT_FOUND', 'nenhum backup validado neste worker');
        const data = gatherProfileExport(staging, request.profileId);
        if (!data) fail('NOT_FOUND', `perfil ${request.profileId} não está no backup`);
        scope.postMessage({ id: request.id, ok: true, result: data });
        return;
      }
      case 'dispose': {
        staging?.close();
        staging = null;
        scope.postMessage({ id: request.id, ok: true, result: null });
        scope.close();
        return;
      }
    }
  } catch (error) {
    const classified = toStorageError(error, 'install');
    scope.postMessage({ id: request.id, ok: false, error: { code: classified.code, message: classified.message } });
  }
}

scope.onmessage = (event) => {
  const request = event.data;
  queue = queue.then(() => handle(request), () => handle(request));
};
