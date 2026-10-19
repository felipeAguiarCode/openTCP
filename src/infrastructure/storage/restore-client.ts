// Thread principal ↔ worker descartável de validação de backup (persistencia §25.1). Cada inspeção cria um worker
// novo, com prazo; ao terminar (ou estourar o prazo) o worker é encerrado. O staging validado fica no OPFS até a
// troca (Storage Worker) ou até o próximo boot, que remove órfãos.
import type { BackupInspection, ProfileExportData, StorageError, StorageErrorCode } from '../../application/ports/storage.ts';
import { storageError } from './errors.ts';
import { defaultSqliteUrl } from './client.ts';
import type { RestoreWorkerRequest, RestoreWorkerResponse } from './protocol.ts';
import { INSPECTION_DEADLINE_MS, STAGING_DIR } from './restore.ts';

export type BackupInspector = {
  readonly inspection: BackupInspection;
  /** Caminho do staging gravado no OPFS (null quando a inspeção foi só para importar um perfil). */
  readonly stagingPath: string | null;
  readonly stagingSha256: string;
  /** Linhas completas de um perfil do backup validado (para IMPORT_PROFILE com source_kind DATABASE_BACKUP). */
  readonly exportProfile: (profileId: string) => Promise<ProfileExportData | StorageError>;
  /** Fecha o worker descartável. */
  readonly dispose: () => void;
};

type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never;

type Pending = { readonly resolve: (value: unknown) => void; readonly reject: (error: StorageError) => void; readonly timer: ReturnType<typeof setTimeout> };

function codeOf(value: unknown): StorageErrorCode {
  const code = (value as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? (code as StorageErrorCode) : 'IMPORT_INVALID';
}

/**
 * Valida bytes de um backup num worker descartável. `stagingId` nomeia o arquivo de staging; `null` = não gravar
 * staging (só inspecionar/importar perfil).
 */
export async function inspectBackupInWorker(bytes: Uint8Array, options: { readonly stagingId: string | null; readonly now: string; readonly timeoutMs?: number }): Promise<
  { readonly ok: true; readonly inspector: BackupInspector } | StorageError
> {
  let worker: Worker;
  try {
    worker = new Worker(new URL('./restore-worker.ts', import.meta.url), { type: 'module', name: 'card-campaign-restore' });
  } catch (error) {
    return storageError('STORAGE_CAPABILITY_MISSING', `worker de validação não iniciou: ${error instanceof Error ? error.message : String(error)}`);
  }
  let nextId = 1;
  let disposed = false;
  const pending = new Map<number, Pending>();
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    for (const [, p] of pending) { clearTimeout(p.timer); p.reject(storageError('IMPORT_INVALID', 'validação encerrada')); }
    pending.clear();
    worker.terminate();
  };
  worker.onmessage = (event: MessageEvent<RestoreWorkerResponse>) => {
    const response = event.data;
    const p = pending.get(response.id);
    if (!p) return;
    pending.delete(response.id);
    clearTimeout(p.timer);
    if (response.ok) p.resolve(response.result);
    else p.reject(storageError(response.error.code, response.error.message));
  };
  worker.onerror = (event) => {
    event.preventDefault();
    for (const [, p] of pending) { clearTimeout(p.timer); p.reject(storageError('IMPORT_INVALID', `worker de validação falhou: ${event.message || 'erro desconhecido'}`)); }
    pending.clear();
  };
  const call = <T>(request: WithoutId<RestoreWorkerRequest>, timeoutMs: number, transfer: Transferable[] = []): Promise<T> => new Promise((resolve, reject) => {
    if (disposed) { reject(storageError('IMPORT_INVALID', 'validação encerrada')); return; }
    const id = nextId;
    nextId += 1;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(storageError('IMPORT_INVALID', 'a validação do backup excedeu o tempo limite e foi interrompida'));
      dispose();
    }, timeoutMs);
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer });
    worker.postMessage({ ...request, id } as RestoreWorkerRequest, transfer);
  });

  const timeoutMs = options.timeoutMs ?? INSPECTION_DEADLINE_MS + 30_000;
  const stagingPath = options.stagingId === null ? null : `${STAGING_DIR}/${options.stagingId.replace(/[^A-Za-z0-9_-]/g, '_')}.sqlite3`;
  try {
    const copy = bytes.slice();
    const result = await call<{ inspection: BackupInspection; stagingPath: string | null; stagingSha256: string }>(
      { kind: 'inspect', sqliteUrl: defaultSqliteUrl(), bytes: copy, now: options.now, deadlineMs: INSPECTION_DEADLINE_MS, stagingPath },
      timeoutMs, [copy.buffer],
    );
    const inspector: BackupInspector = {
      inspection: result.inspection,
      stagingPath: result.stagingPath,
      stagingSha256: result.stagingSha256,
      exportProfile: async (profileId) => {
        try {
          return await call<ProfileExportData>({ kind: 'exportProfile', profileId }, 120_000);
        } catch (error) {
          return storageError(codeOf(error), (error as { message?: string }).message ?? String(error));
        }
      },
      dispose: () => {
        if (disposed) return;
        void call({ kind: 'dispose' }, 5_000).catch(() => undefined).finally(dispose);
      },
    };
    return { ok: true, inspector };
  } catch (error) {
    dispose();
    return storageError(codeOf(error), (error as { message?: string }).message ?? String(error));
  }
}
