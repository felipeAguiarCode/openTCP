// Mensagens tipadas entre a thread principal e o Storage Worker (persistencia-sqlite.md §1/§4,
// runtime-offline-threejs.md §2.4). Nenhum texto SQL cruza esta fronteira: só métodos nomeados e dados.
import type {
  CommitOk, CommitRequest, ContentInstall, LightWrite, Query, RestoreSwapOk, RestoreSwapRequest, StorageError, StorageErrorCode, WriteOk,
} from '../../application/ports/storage.ts';

/** Caminho lógico do banco principal no OPFS (persistencia §3). */
export const DATABASE_PATH = '/card-campaign/main.sqlite3';
/** Web Lock exclusivo por banco/origem (persistencia §20). */
export const DATABASE_LOCK = 'card-campaign:sqlite-main';
/** Canal de transferência cooperativa entre abas (persistencia §20, runtime §9.4). */
export const TAB_CHANNEL = 'card-campaign-tab';
/** Runtime SQLite copiado por tools/copy-vendor.mjs; nunca empacotado pelo bundler. */
export const DEFAULT_SQLITE_URL = '/vendor/sqlite/index.mjs';

/** Resultado do boot do banco: PRAGMAs lidos de volta, marcadores e se a conexão aceita escrita. */
export type OpenReport = {
  readonly status: 'CREATED' | 'OPENED';
  /** false quando o banco é de um schema mais novo (SAVE_VERSION_UNSUPPORTED): só leitura/exportação. */
  readonly writable: boolean;
  readonly readOnlyReason: StorageErrorCode | null;
  readonly userVersion: number;
  readonly applicationId: number;
  readonly sqliteVersion: string;
  readonly journalMode: string;
  readonly foreignKeys: boolean;
  readonly synchronous: number;
  readonly busyTimeout: number;
  readonly vfs: string;
};

export type InitArgs = { readonly sqliteUrl: string; readonly filename: string };

export type RpcArgsMap = {
  readonly init: InitArgs;
  readonly query: Query;
  readonly commit: CommitRequest;
  readonly write: LightWrite;
  readonly installContent: ContentInstall;
  readonly bumpWriterEpoch: { readonly profileId: string };
  readonly exportDatabase: null;
  /** Troca o principal pelo staging validado (persistencia §25.1); a conexão é fechada e reaberta no worker. */
  readonly restoreSwap: RestoreSwapRequest;
  /** Fecha a conexão e remove /card-campaign do OPFS (“Apagar todos os dados locais”). */
  readonly wipeAll: null;
  readonly close: null;
};

export type RpcResultMap = {
  readonly init: OpenReport;
  readonly query: unknown;
  readonly commit: CommitOk | StorageError;
  readonly write: WriteOk | StorageError;
  readonly installContent: { readonly ok: true; readonly installed: boolean } | StorageError;
  readonly bumpWriterEpoch: number;
  readonly exportDatabase: Uint8Array;
  readonly restoreSwap: RestoreSwapOk | StorageError;
  readonly wipeAll: null;
  readonly close: null;
};

export type RpcMethod = keyof RpcArgsMap;

export type RpcRequest = { readonly [M in RpcMethod]: { readonly id: number; readonly method: M; readonly args: RpcArgsMap[M] } }[RpcMethod];

export type RpcFailure = { readonly code: StorageErrorCode; readonly message: string };

export type RpcResponse =
  | { readonly id: number; readonly ok: true; readonly result: unknown }
  | { readonly id: number; readonly ok: false; readonly error: RpcFailure };

/** Rejeição de `query`, `bumpWriterEpoch` e `exportDatabase` (que não devolvem união de erro). */
export type StorageRpcError = Error & { readonly code: StorageErrorCode };

export function rpcError(code: StorageErrorCode, message: string): StorageRpcError {
  return Object.assign(new Error(message), { code });
}

export type TabMessage =
  | { readonly type: 'release-request'; readonly requestId: string }
  | { readonly type: 'released'; readonly requestId: string }
  | { readonly type: 'release-denied'; readonly requestId: string };

// ---------------------------------------------------------------------------------------------------------
// Worker descartável de validação de backup (persistencia §25.1): nunca abre a conexão principal.

export type RestoreWorkerRequest =
  | {
    readonly id: number; readonly kind: 'inspect'; readonly sqliteUrl: string; readonly bytes: Uint8Array; readonly now: string;
    readonly deadlineMs: number;
    /** Caminho OPFS onde gravar o staging validado; `null` = só inspecionar (importar um perfil do backup). */
    readonly stagingPath: string | null;
  }
  | { readonly id: number; readonly kind: 'exportProfile'; readonly profileId: string }
  | { readonly id: number; readonly kind: 'dispose' };

export type RestoreWorkerResponse =
  | { readonly id: number; readonly ok: true; readonly result: unknown }
  | { readonly id: number; readonly ok: false; readonly error: RpcFailure };
