// Primitivas sobre o handle oo1 do SQLite WASM: SQL sempre parametrizado (persistencia §4, DB-052),
// leitura tipada de colunas e transação BEGIN IMMEDIATE com ROLLBACK garantido (§12).
import type { Database, SqlValue } from '@sqlite.org/sqlite-wasm';
import type { JsonValue } from '../../application/ports/storage.ts';
import { canonicalize } from '../../domain/hash/jcs.ts';

export type DB = Database;
export type Param = string | number | null | Uint8Array;
export type Row = Readonly<Record<string, SqlValue>>;

/** O oo1 recusa bind vazio em comando sem parâmetros: nesse caso não passa bind algum. */
function binding(bind: readonly Param[]): readonly Param[] | undefined {
  return bind.length > 0 ? bind : undefined;
}

/** Executa um comando e devolve `sqlite3_changes()` (linhas afetadas pelo próprio comando). */
export function run(db: DB, sql: string, bind: readonly Param[] = []): number {
  db.exec({ sql, bind: binding(bind) });
  return Number(db.changes());
}

export function rows(db: DB, sql: string, bind: readonly Param[] = []): Row[] {
  return db.selectObjects(sql, binding(bind));
}

export function row(db: DB, sql: string, bind: readonly Param[] = []): Row | undefined {
  return db.selectObject(sql, binding(bind));
}

export function scalar(db: DB, sql: string, bind: readonly Param[] = []): SqlValue | undefined {
  return db.selectValue(sql, binding(bind));
}

export function scalarInt(db: DB, sql: string, bind: readonly Param[] = []): number | undefined {
  const value = db.selectValue(sql, binding(bind));
  if (value === undefined || value === null) return undefined;
  return asInt(value, sql);
}

export function scalarText(db: DB, sql: string, bind: readonly Param[] = []): string | undefined {
  const value = db.selectValue(sql, binding(bind));
  if (value === undefined || value === null) return undefined;
  return String(value);
}

function asInt(value: SqlValue, where: string): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  throw new TypeError(`coluna inteira esperada em ${where}`);
}

export function text(r: Row, column: string): string {
  const value = r[column];
  if (typeof value !== 'string') throw new TypeError(`coluna TEXT esperada: ${column}`);
  return value;
}

export function textOrNull(r: Row, column: string): string | null {
  const value = r[column];
  return value === null || value === undefined ? null : text(r, column);
}

export function int(r: Row, column: string): number {
  const value = r[column];
  if (value === undefined || value === null) throw new TypeError(`coluna INTEGER esperada: ${column}`);
  return asInt(value, column);
}

export function intOrNull(r: Row, column: string): number | null {
  const value = r[column];
  return value === null || value === undefined ? null : asInt(value, column);
}

export function flag(r: Row, column: string): boolean {
  return int(r, column) !== 0;
}

export function json(r: Row, column: string): JsonValue {
  return JSON.parse(text(r, column)) as JsonValue;
}

export function jsonOrNull(r: Row, column: string): JsonValue | null {
  const value = textOrNull(r, column);
  return value === null ? null : (JSON.parse(value) as JsonValue);
}

export function blob(r: Row, column: string): Uint8Array | null {
  const value = r[column];
  if (value === null || value === undefined) return null;
  if (value instanceof Uint8Array) return value;
  throw new TypeError(`coluna BLOB esperada: ${column}`);
}

/** JSON gravado sempre na forma JCS (RFC 8785): determinístico e igual ao texto que gerou o hash. */
export function toJson(value: unknown): string {
  return canonicalize(value);
}

export function toJsonOrNull(value: JsonValue | null): string | null {
  return value === null ? null : canonicalize(value);
}

export function bit(value: boolean): number {
  return value ? 1 : 0;
}

export function rollbackQuietly(db: DB): void {
  try {
    db.exec('ROLLBACK');
  } catch {
    // Nenhuma transação ativa (o SQLite pode já ter revertido sozinho).
  }
}

/** BEGIN IMMEDIATE → corpo → COMMIT; qualquer exceção (inclusive no COMMIT) faz ROLLBACK e é relançada. */
export function inImmediateTransaction<T>(db: DB, body: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = body();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    rollbackQuietly(db);
    throw error;
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

export function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

export const HEX64 = /^[0-9a-f]{64}$/;
