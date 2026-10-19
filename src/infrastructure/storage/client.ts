// Boot do armazenamento no navegador (persistencia-sqlite.md §2, §20; runtime-offline-threejs.md §9):
// capacidades → Web Lock exclusivo do banco → Storage Worker (VFS opfs) → StoragePort por RPC tipado.
import type {
  CommitOk, CommitRequest, ContentInstall, LightWrite, Query, QueryResult, RestoreSwapOk, RestoreSwapRequest, StorageError, StorageErrorCode, StoragePort, WriteOk,
} from '../../application/ports/storage.ts';
import { storageError } from './errors.ts';
import type { OpenReport, RpcArgsMap, RpcMethod, RpcResponse, RpcResultMap, TabMessage } from './protocol.ts';
import { DATABASE_LOCK, DATABASE_PATH, DEFAULT_SQLITE_URL, TAB_CHANNEL, rpcError } from './protocol.ts';

export type BrowserStorageOptions = {
  /** Caminho no OPFS; padrão /card-campaign/main.sqlite3. */
  readonly filename?: string;
  /** URL do runtime SQLite; padrão vendor/sqlite/index.mjs relativo ao documento. */
  readonly sqliteUrl?: string;
  /** Tempo máximo por chamada RPC (ms). Estourado: SAVE_WRITE_FAILED, sem repetir a mutação. */
  readonly timeoutMs?: number;
  /** Tempo máximo do boot do worker (ms). */
  readonly bootTimeoutMs?: number;
  /**
   * Outra aba pediu o banco (requestCooperativeTransfer). A aplicação suspende a tentativa e drena seus
   * comandos; devolver `false` recusa. Sem este gancho, esta aba nunca cede o banco.
   */
  readonly onTransferRequested?: () => Promise<boolean | void> | boolean | void;
  /** Chamado depois que esta aba fechou o worker e liberou o lock para a outra aba. */
  readonly onTransferred?: () => void;
};

export type BrowserStorage = { readonly ok: true; readonly storage: StoragePort; readonly diagnostics: OpenReport };

/** Superfície mínima do ambiente usada na checagem de capacidades (permite testar sem navegador). */
export type CapabilityHost = {
  readonly isSecureContext?: boolean;
  readonly crossOriginIsolated?: boolean;
  readonly location?: { readonly origin?: string };
  readonly Worker?: unknown;
  readonly WebAssembly?: unknown;
  readonly SharedArrayBuffer?: unknown;
  readonly navigator?: { readonly storage?: { readonly getDirectory?: unknown }; readonly locks?: unknown };
};

/** Ordem do boot (persistencia §2): origem/contexto seguro → isolamento → Worker, WASM, OPFS, SAB, Web Locks. */
export function checkCapabilities(host: CapabilityHost): StorageError | null {
  const origin = host.location?.origin ?? 'origem desconhecida';
  if (host.isSecureContext !== true) {
    return storageError('ORIGIN_ISOLATION_REQUIRED', `${origin} não é um contexto seguro; inicie pelo launcher local em http://localhost:4173. Os dados de outras origens não foram apagados.`);
  }
  if (host.crossOriginIsolated !== true) {
    return storageError('ORIGIN_ISOLATION_REQUIRED', `${origin} sem crossOriginIsolated: o servidor precisa enviar Cross-Origin-Opener-Policy: same-origin e Cross-Origin-Embedder-Policy: require-corp (use o launcher).`);
  }
  const missing: [boolean, string][] = [
    [typeof host.Worker === 'function', 'Worker'],
    [typeof host.WebAssembly === 'object' && host.WebAssembly !== null, 'WebAssembly'],
    [typeof host.navigator?.storage?.getDirectory === 'function', 'OPFS (navigator.storage.getDirectory)'],
    [typeof host.SharedArrayBuffer === 'function', 'SharedArrayBuffer'],
    [typeof host.navigator?.locks === 'object' && host.navigator.locks !== null, 'Web Locks (navigator.locks)'],
  ];
  const absent = missing.find(([present]) => !present);
  return absent ? storageError('STORAGE_CAPABILITY_MISSING', `capacidade ausente: ${absent[1]}; o save persistente não é aberto`) : null;
}

type HeldLock = { readonly release: () => Promise<void> };

/** Lock exclusivo mantido enquanto a aplicação viver; `null` quando outra aba já é a dona do banco. */
export function acquireDatabaseLock(locks: LockManager, name: string = DATABASE_LOCK): Promise<HeldLock | null> {
  return new Promise((resolve, reject) => {
    let finish: () => void = () => undefined;
    const settled: Promise<unknown> = locks.request(name, { mode: 'exclusive', ifAvailable: true }, (lock) => {
      if (!lock) {
        resolve(null);
        return undefined;
      }
      return new Promise<void>((release) => {
        finish = release;
        resolve({ release: () => { finish(); return settled.then(() => undefined, () => undefined); } });
      });
    });
    settled.catch(reject);
  });
}

type Pending = { readonly resolve: (value: unknown) => void; readonly reject: (error: unknown) => void; readonly timer: ReturnType<typeof setTimeout> };

type RpcClient = {
  readonly call: <M extends RpcMethod>(method: M, args: RpcArgsMap[M], timeoutMs: number) => Promise<RpcResultMap[M]>;
  readonly failAll: (code: StorageErrorCode, message: string) => void;
};

function createRpcClient(worker: Worker): RpcClient {
  let nextId = 1;
  const pending = new Map<number, Pending>();
  worker.onmessage = (event: MessageEvent<RpcResponse>) => {
    const response = event.data;
    const entry = pending.get(response.id);
    if (!entry) return; // resposta tardia de chamada já expirada: descartada
    pending.delete(response.id);
    clearTimeout(entry.timer);
    if (response.ok) entry.resolve(response.result);
    else entry.reject(rpcError(response.error.code, response.error.message));
  };
  const failAll = (code: StorageErrorCode, message: string): void => {
    for (const [id, entry] of pending) {
      clearTimeout(entry.timer);
      entry.reject(rpcError(code, message));
      pending.delete(id);
    }
  };
  worker.onerror = (event) => {
    event.preventDefault();
    failAll('SAVE_WRITE_FAILED', `Storage Worker falhou: ${event.message || 'erro desconhecido'}`);
  };
  const call = <M extends RpcMethod>(method: M, args: RpcArgsMap[M], timeoutMs: number): Promise<RpcResultMap[M]> =>
    new Promise((resolve, reject) => {
      const id = nextId;
      nextId += 1;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(rpcError('SAVE_WRITE_FAILED', `sem resposta do Storage Worker para ${method} em ${timeoutMs} ms; consulte o recibo (GET_OPERATION) antes de repetir`));
      }, timeoutMs);
      pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer });
      worker.postMessage({ id, method, args });
    });
  return { call, failAll };
}

function codeOf(error: unknown): StorageErrorCode {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? (code as StorageErrorCode) : 'SAVE_WRITE_FAILED';
}

/** Mutações nunca são repetidas: timeout/falha de transporte vira StorageError SAVE_WRITE_FAILED. */
function asResult<T>(promise: Promise<T>): Promise<T | StorageError> {
  return promise.catch((error: unknown) => storageError(codeOf(error), error instanceof Error ? error.message : String(error)));
}

/** URL do runtime SQLite local (vendor/sqlite/index.mjs relativo ao documento); também usada pelo worker de restauração. */
export function defaultSqliteUrl(): string {
  try {
    return new URL('vendor/sqlite/index.mjs', document.baseURI).href;
  } catch {
    return DEFAULT_SQLITE_URL;
  }
}

/**
 * Abre o banco principal. Ordem: capacidades → lock `card-campaign:sqlite-main` (ifAvailable; ocupado =
 * DATABASE_IN_USE) → Storage Worker → runtime SQLite local → VFS opfs → openAndMigrate. O lock fica retido
 * até `storage.close()` (ou transferência cooperativa).
 */
export async function createBrowserStorage(options: BrowserStorageOptions = {}): Promise<BrowserStorage | StorageError> {
  const capability = checkCapabilities(globalThis as unknown as CapabilityHost);
  if (capability) return capability;
  let lock: HeldLock | null;
  try {
    lock = await acquireDatabaseLock(navigator.locks);
  } catch (error) {
    return storageError('STORAGE_CAPABILITY_MISSING', `Web Locks recusou o pedido: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!lock) return storageError('DATABASE_IN_USE', 'O jogo está aberto em outra aba; nenhuma segunda conexão foi aberta.');
  const heldLock = lock;

  let worker: Worker;
  try {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'card-campaign-storage' });
  } catch (error) {
    await heldLock.release();
    return storageError('SQLITE_RUNTIME_MISSING', `Storage Worker não iniciou: ${error instanceof Error ? error.message : String(error)}`);
  }
  const rpc = createRpcClient(worker);
  const timeoutMs = options.timeoutMs ?? 20_000;
  let diagnostics: OpenReport;
  try {
    diagnostics = await rpc.call('init', { sqliteUrl: options.sqliteUrl ?? defaultSqliteUrl(), filename: options.filename ?? DATABASE_PATH }, options.bootTimeoutMs ?? 30_000);
  } catch (error) {
    worker.terminate();
    await heldLock.release();
    return storageError(codeOf(error), error instanceof Error ? error.message : String(error));
  }

  let closing: Promise<void> | null = null;
  let channel: BroadcastChannel | null = null;
  const close = (): Promise<void> => {
    closing ??= (async () => {
      try {
        await rpc.call('close', null, timeoutMs);
      } catch {
        // Worker já encerrado ou sem resposta: terminar mesmo assim, sem reabrir conexão.
      }
      worker.terminate();
      rpc.failAll('SAVE_WRITE_FAILED', 'armazenamento fechado');
      channel?.close();
      await heldLock.release();
    })();
    return closing;
  };

  const storage: StoragePort = {
    query: <Q extends Query>(q: Q) => rpc.call('query', q, timeoutMs) as Promise<QueryResult<Q>>,
    commit: (request: CommitRequest) => asResult<CommitOk | StorageError>(rpc.call('commit', request, timeoutMs)),
    write: (lightWrite: LightWrite) => asResult<WriteOk | StorageError>(rpc.call('write', lightWrite, timeoutMs)),
    installContent: (install: ContentInstall) => asResult(rpc.call('installContent', install, Math.max(timeoutMs, 120_000))),
    bumpWriterEpoch: (profileId: string) => rpc.call('bumpWriterEpoch', { profileId }, timeoutMs),
    exportDatabase: () => rpc.call('exportDatabase', null, Math.max(timeoutMs, 120_000)),
    close,
    // Troca de arquivo com a conexão fechada dentro do próprio worker: o Web Lock desta aba nunca é solto no meio.
    restoreFromStaging: (request: RestoreSwapRequest) => asResult<RestoreSwapOk | StorageError>(rpc.call('restoreSwap', request, 300_000)),
    wipeAllData: async () => {
      let failure: StorageError | null = null;
      try {
        await rpc.call('wipeAll', null, 120_000);
      } catch (error) {
        failure = storageError(codeOf(error), error instanceof Error ? error.message : String(error));
      }
      // Conexão já fechada pelo worker: encerrar, recusar chamadas pendentes e liberar o lock.
      closing ??= (async () => {
        worker.terminate();
        rpc.failAll('SAVE_WRITE_FAILED', 'armazenamento apagado');
        channel?.close();
        await heldLock.release();
      })();
      await closing;
      return failure ?? { ok: true as const };
    },
  };

  if (options.onTransferRequested && typeof BroadcastChannel === 'function') {
    const hook = options.onTransferRequested;
    channel = new BroadcastChannel(TAB_CHANNEL);
    const tab = channel;
    let transferring = false;
    tab.onmessage = (event: MessageEvent<TabMessage>) => {
      const message = event.data;
      if (message?.type !== 'release-request' || transferring) return;
      transferring = true;
      void (async () => {
        let accepted = true;
        try {
          accepted = (await hook()) !== false;
        } catch {
          accepted = false;
        }
        if (!accepted) {
          tab.postMessage({ type: 'release-denied', requestId: message.requestId } satisfies TabMessage);
          transferring = false;
          return;
        }
        const reply = new BroadcastChannel(TAB_CHANNEL);
        await close(); // termina a fila, fecha a conexão/worker e libera o lock antes de avisar
        reply.postMessage({ type: 'released', requestId: message.requestId } satisfies TabMessage);
        reply.close();
        options.onTransferred?.();
      })();
    };
  }

  return { ok: true, storage, diagnostics };
}

/**
 * Segunda aba: pede à aba dona que libere o banco (persistencia §20). Resolve `true` depois que a dona fechou
 * o worker e liberou o lock; então chamar `createBrowserStorage()` de novo. `false`: recusado ou sem resposta.
 */
export function requestCooperativeTransfer(timeoutMs = 15_000): Promise<boolean> {
  if (typeof BroadcastChannel !== 'function') return Promise.resolve(false);
  const channel = new BroadcastChannel(TAB_CHANNEL);
  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return new Promise((resolve) => {
    const finish = (value: boolean): void => {
      clearTimeout(timer);
      channel.close();
      resolve(value);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    channel.onmessage = (event: MessageEvent<TabMessage>) => {
      const message = event.data;
      if (message?.requestId !== requestId) return;
      if (message.type === 'released') finish(true);
      else if (message.type === 'release-denied') finish(false);
    };
    channel.postMessage({ type: 'release-request', requestId } satisfies TabMessage);
  });
}
