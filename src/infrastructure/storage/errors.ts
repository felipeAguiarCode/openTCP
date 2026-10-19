// Falhas do SQLite → códigos de produto (persistencia-sqlite.md §12.2 e §26).
import type { StorageError, StorageErrorCode } from '../../application/ports/storage.ts';

/** Falha já classificada pelo handler; `fail()` a lança e `toStorageError()` a preserva. */
export type StorageFailure = Error & { readonly storageCode: StorageErrorCode };

export function fail(code: StorageErrorCode, message: string): never {
  throw Object.assign(new Error(message), { storageCode: code });
}

export function storageError(code: StorageErrorCode, message: string): StorageError {
  return { ok: false, code, message };
}

export function isStorageFailure(error: unknown): error is StorageFailure {
  return error instanceof Error && typeof (error as { storageCode?: unknown }).storageCode === 'string';
}

/** Onde a falha ocorreu: muda a tradução de violações de restrição (instalação → IMPORT_INVALID). */
export type FailureContext = 'open' | 'commit' | 'write' | 'install' | 'query';

const SQLITE_BUSY = 5;
const SQLITE_CORRUPT = 11;
const SQLITE_FULL = 13;
const SQLITE_CONSTRAINT = 19;
const SQLITE_NOTADB = 26;
const SQLITE_CONSTRAINT_FOREIGNKEY = 787;

function sqliteResultCode(error: unknown): number | null {
  const code = (error as { resultCode?: unknown } | null)?.resultCode;
  return typeof code === 'number' ? code : null;
}

const TRIGGER_GUARD = /\b[A-Z][A-Z_]*_(IMMUTABLE|APPEND_ONLY|RETAINED)\b/;

function constraintCode(resultCode: number, message: string, context: FailureContext): StorageErrorCode {
  if (message.includes('PRINTING_ASSET_NOT_DECLARED')) return 'CONTENT_REFERENCE_MISSING';
  if (TRIGGER_GUARD.test(message)) return 'INTERNAL_INTEGRITY_ERROR';
  if (resultCode === SQLITE_CONSTRAINT_FOREIGNKEY || message.includes('FOREIGN KEY constraint failed')) return 'CONTENT_REFERENCE_MISSING';
  if (context === 'install') return 'IMPORT_INVALID';
  if (/UNIQUE constraint failed: (reward_grants|pending_rewards)\.profile_id, \1\.grant_key/.test(message)) return 'REWARD_ALREADY_GRANTED';
  if (message.includes('UNIQUE constraint failed: cosmetic_entitlements.')) return 'REWARD_ALREADY_GRANTED';
  if (message.includes('UNIQUE constraint failed: attempts.profile_id')) return 'ACTIVE_ATTEMPT_EXISTS';
  if (message.includes('UNIQUE constraint failed: operations.profile_id, operations.command_id')) return 'COMMAND_PAYLOAD_MISMATCH';
  if (message.includes('UNIQUE constraint failed: operations.')) return 'REVISION_CONFLICT';
  // Demais CHECK / NOT NULL / UNIQUE / tipo STRICT: o validador deveria ter recusado antes do BEGIN.
  return 'INTERNAL_INTEGRITY_ERROR';
}

/** Traduz qualquer exceção capturada num handler para o erro de produto correspondente. */
export function toStorageError(error: unknown, context: FailureContext): StorageError {
  if (isStorageFailure(error)) return storageError(error.storageCode, error.message);
  const message = error instanceof Error ? error.message : String(error);
  const resultCode = sqliteResultCode(error);
  if (resultCode === null) {
    // Exceção JS que não veio do SQLite: alocação WASM falhou (escrita não confirmada) ou bug do handler.
    const allocation = error instanceof Error && error.name === 'WasmAllocError';
    return storageError(allocation ? 'SAVE_WRITE_FAILED' : 'INTERNAL_INTEGRITY_ERROR', message);
  }
  switch (resultCode & 0xff) {
    case SQLITE_FULL: return storageError('STORAGE_FULL', message);
    case SQLITE_CORRUPT:
    case SQLITE_NOTADB: return storageError('DATABASE_CORRUPT', message);
    case SQLITE_CONSTRAINT: return storageError(constraintCode(resultCode, message, context), message);
    case SQLITE_BUSY:
    default: return storageError('SAVE_WRITE_FAILED', message);
  }
}

/** Lança de novo como falha classificada (para APIs que rejeitam em vez de devolver StorageError). */
export function rethrowClassified(error: unknown, context: FailureContext): never {
  const classified = toStorageError(error, context);
  return fail(classified.code, classified.message);
}
