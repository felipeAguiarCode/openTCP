// Restauração de backup completo (persistencia-sqlite.md §23, §25, §25.1; DB-044, DB-048, DB-051).
//
// O arquivo recebido é entrada NÃO confiável. Ele é aberto só em memória (sqlite3_deserialize, somente leitura),
// numa conexão própria — nunca na conexão principal — com DEFENSIVE, trusted_schema=OFF, sem gatilhos, sem visões,
// sem ATTACH (limite 0), sem extensões, query_only e prazo por progress handler. Nenhum SQL do arquivo é executado
// como lógica da aplicação: só consultas fixas desta allowlist.
//
// Validação: cabeçalho → application_id/user_version → objetos de sqlite_schema IGUAIS ao schema canônico →
// schema_migrations com os checksums conhecidos → integrity_check → foreign_key_check → limites. Depois, um banco
// NOVO é criado pelo runner canônico (§21) e as linhas são copiadas por colunas explícitas (nunca objetos do
// arquivo); integrity_check e foreign_key_check são repetidos nesse staging. Os bytes do staging é que vão para
// /card-campaign/staging/<importId>.sqlite3 e, na troca, para /card-campaign/main.sqlite3.
//
// Este módulo não conhece OPFS: a troca de arquivos (`swapDatabase`) recebe as operações por injeção, o que permite
// testá-la em Node e usá-la no Storage Worker com o OPFS real.
import type { Database, Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import type { BackupInspection, BackupProfileSummary, ContentPackageRef, StorageError } from '../../application/ports/storage.ts';
import { fail, isStorageFailure, storageError, toStorageError } from './errors.ts';
import { APPLICATION_ID, EXPECTED_TABLES, MIGRATIONS, SCHEMA_VERSION, openAndMigrate, query } from './executor.ts';
import type { OpenReport } from './protocol.ts';
import { rollbackQuietly, scalarInt, scalarText, type DB } from './sql.ts';

const MiB = 1024 * 1024;

/** Limite do backup SQLite recebido (persistencia §25). */
export const BACKUP_MAX_BYTES = 256 * MiB;
/** Diretórios OPFS da restauração (persistencia §3). */
export const STAGING_DIR = '/card-campaign/staging';
export const BACKUPS_DIR = '/card-campaign/backups';
/** Tempo máximo da validação de um arquivo externo. */
export const INSPECTION_DEADLINE_MS = 120_000;
/** Limite defensivo de linhas copiadas do arquivo externo. */
export const MAX_BACKUP_ROWS = 20_000_000;

const SQLITE_MAGIC = 'SQLite format 3\u0000';

type Sqlite = Pick<Sqlite3Static, 'oo1' | 'capi' | 'wasm'>;

export type InspectOptions = {
  /** Momento de aplicação da migração canônica no staging (ISO 8601 UTC). */
  readonly now: string;
  /** Nome do arquivo de staging no sistema de arquivos em memória do SQLite (único por inspeção). */
  readonly stagingName: string;
  readonly deadlineMs?: number;
};

export type InspectOk = {
  readonly ok: true;
  readonly inspection: BackupInspection;
  /** Banco canônico com as linhas validadas (aberto por openAndMigrate; consultável por `query`). */
  readonly staging: Database;
  /** Bytes do staging (o que será gravado no OPFS e trocado). */
  readonly stagingBytes: Uint8Array;
};

function quoteId(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** Cabeçalho do formato de arquivo SQLite (offsets 16, 28, 60, 68). */
export function sqliteHeader(bytes: Uint8Array): { readonly valid: boolean; readonly pageSize: number; readonly pageCount: number; readonly userVersion: number; readonly applicationId: number } {
  if (bytes.length < 100) return { valid: false, pageSize: 0, pageCount: 0, userVersion: 0, applicationId: 0 };
  let magic = '';
  for (let i = 0; i < 16; i += 1) magic += String.fromCharCode(bytes[i]!);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const raw = view.getUint16(16, false);
  const pageSize = raw === 1 ? 65536 : raw;
  const pageCount = view.getUint32(28, false);
  const validPage = pageSize >= 512 && pageSize <= 65536 && (pageSize & (pageSize - 1)) === 0;
  return {
    valid: magic === SQLITE_MAGIC && validPage && bytes.length % pageSize === 0,
    pageSize, pageCount, userVersion: view.getInt32(60, false), applicationId: view.getInt32(68, false),
  };
}

/**
 * Abre bytes externos numa conexão em memória, somente leitura e endurecida. O ponteiro é liberado pelo
 * próprio SQLite (FREEONCLOSE) ao fechar — ou imediatamente, se a desserialização falhar.
 */
export function openUntrusted(sqlite3: Sqlite, bytes: Uint8Array, deadline: number): Database {
  const { capi, wasm, oo1 } = sqlite3;
  const db = new oo1.DB(':memory:', 'c');
  const ptr = db.pointer!;
  try {
    capi.sqlite3_db_config(ptr, capi.SQLITE_DBCONFIG_DEFENSIVE, 1, 0);
    capi.sqlite3_db_config(ptr, capi.SQLITE_DBCONFIG_TRUSTED_SCHEMA, 0, 0);
    capi.sqlite3_db_config(ptr, capi.SQLITE_DBCONFIG_ENABLE_TRIGGER, 0, 0);
    capi.sqlite3_db_config(ptr, capi.SQLITE_DBCONFIG_ENABLE_VIEW, 0, 0);
    capi.sqlite3_db_config(ptr, capi.SQLITE_DBCONFIG_ENABLE_LOAD_EXTENSION, 0, 0);
    capi.sqlite3_limit(ptr, capi.SQLITE_LIMIT_ATTACHED, 0);
    const mem = wasm.allocFromTypedArray(bytes);
    const rc = capi.sqlite3_deserialize(ptr, 'main', mem, bytes.length, bytes.length,
      capi.SQLITE_DESERIALIZE_FREEONCLOSE | capi.SQLITE_DESERIALIZE_READONLY);
    if (rc !== 0) fail('IMPORT_INVALID', `o arquivo não pôde ser aberto como banco SQLite (código ${rc})`);
    db.exec('PRAGMA trusted_schema = OFF');
    db.exec('PRAGMA query_only = ON');
    capi.sqlite3_progress_handler(ptr, 50_000, () => (Date.now() > deadline ? 1 : 0), 0);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

function closeUntrusted(sqlite3: Sqlite, db: Database): void {
  try {
    if (db.pointer) sqlite3.capi.sqlite3_progress_handler(db.pointer, 0, 0, 0);
  } catch {
    // sem handler instalado
  }
  db.close();
}

type SchemaObject = { readonly type: string; readonly name: string; readonly tblName: string; readonly sql: string | null };

function schemaObjects(db: DB): SchemaObject[] {
  return db.selectArrays("SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite\\_stat%' ESCAPE '\\' ORDER BY type, name")
    .map(([type, name, tblName, sql]) => ({ type: String(type), name: String(name), tblName: String(tblName), sql: sql === null ? null : String(sql) }));
}

/** Objetos de sqlite_schema iguais ao canônico (§25.1 passo 3): nenhum gatilho, visão, índice ou tabela a mais. */
function compareSchema(source: DB, canonical: DB): void {
  const theirs = new Map(schemaObjects(source).map((o) => [`${o.type}:${o.name}`, o]));
  const ours = schemaObjects(canonical);
  for (const o of ours) {
    const other = theirs.get(`${o.type}:${o.name}`);
    if (!other) fail('IMPORT_INVALID', `estrutura incompleta: ${o.type} ${o.name} ausente`);
    if (other.tblName !== o.tblName || other.sql !== o.sql) fail('IMPORT_INVALID', `estrutura alterada: ${o.type} ${o.name} difere do schema canônico`);
    theirs.delete(`${o.type}:${o.name}`);
  }
  const extra = [...theirs.values()][0];
  if (extra) fail('IMPORT_INVALID', `estrutura não reconhecida: ${extra.type} ${extra.name.slice(0, 80)} não pertence ao schema do jogo`);
}

function checkMigrations(source: DB, userVersion: number): void {
  const recorded = source.selectArrays('SELECT version, migration_name, checksum_sha256 FROM schema_migrations ORDER BY version')
    .map(([version, name, checksum]) => `${String(version)}|${String(name)}|${String(checksum)}`);
  const expected = MIGRATIONS.filter((m) => m.version <= userVersion).map((m) => `${m.version}|${m.name}|${m.sha256}`);
  if (recorded.join('\n') !== expected.join('\n')) fail('IMPORT_INVALID', 'schema_migrations não corresponde às migrações conhecidas deste jogo');
}

function integrityOk(db: DB, what: string): void {
  const result = db.selectValues('PRAGMA integrity_check').map(String);
  if (result.length !== 1 || result[0] !== 'ok') fail('IMPORT_INVALID', `integrity_check do ${what} falhou: ${result.slice(0, 3).join('; ')}`);
}

function foreignKeysOk(db: DB, what: string): void {
  const violations = db.selectArrays('PRAGMA foreign_key_check');
  if (violations.length > 0) fail('IMPORT_INVALID', `foreign_key_check do ${what}: ${violations.length} referência(s) quebrada(s) (ex.: ${String(violations[0]?.[0])})`);
}

/** Tabelas do schema canônico na ordem de criação (respeita FKs e gatilhos de inserção). */
function canonicalTables(db: DB): string[] {
  return db.selectValues("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' ORDER BY rowid").map(String);
}

/** Colunas armazenadas (exclui colunas geradas: hidden 2/3 em table_xinfo). */
function storedColumns(db: DB, table: string): string[] {
  return db.selectArrays(`PRAGMA table_xinfo(${quoteId(table)})`)
    .filter((r) => Number(r[6]) === 0)
    .map((r) => String(r[1]));
}

/** Copia as linhas validadas por colunas explícitas para o staging canônico, numa transação. */
function copyRows(source: DB, staging: DB): { readonly rows: number; readonly perTable: ReadonlyMap<string, number> } {
  const perTable = new Map<string, number>();
  let total = 0;
  staging.exec('PRAGMA foreign_keys = OFF');
  staging.exec('BEGIN IMMEDIATE');
  try {
    // installationId do staging nasce com o runner; o do backup prevalece (é a instalação restaurada).
    staging.exec('DELETE FROM app_meta');
    for (const table of canonicalTables(staging)) {
      if (table === 'schema_migrations') continue;
      const columns = storedColumns(staging, table);
      const list = columns.map(quoteId).join(', ');
      const insert = staging.prepare(`INSERT INTO ${quoteId(table)} (${list}) VALUES (${columns.map(() => '?').join(', ')})`);
      const select = source.prepare(`SELECT ${list} FROM ${quoteId(table)}`);
      let count = 0;
      try {
        while (select.step()) {
          const values = select.get([]) as (string | number | bigint | Uint8Array | null)[];
          insert.bind(values).stepReset();
          count += 1;
          total += 1;
          if (total > MAX_BACKUP_ROWS) fail('IMPORT_INVALID', `backup com mais de ${MAX_BACKUP_ROWS} linhas`);
        }
      } finally {
        select.finalize();
        insert.finalize();
      }
      perTable.set(table, count);
    }
    staging.exec('COMMIT');
  } catch (error) {
    rollbackQuietly(staging);
    throw error;
  } finally {
    staging.exec('PRAGMA foreign_keys = ON');
  }
  return { rows: total, perTable };
}

function packagesOf(db: DB): (ContentPackageRef & { readonly origin: 'BASE' | 'CUSTOM' })[] {
  return db.selectArrays('SELECT package_id, version, content_hash, origin FROM content_packages ORDER BY package_id, version')
    .map(([packageId, version, contentHash, origin]) => ({
      packageId: String(packageId), version: String(version), contentHash: String(contentHash), origin: String(origin) as 'BASE' | 'CUSTOM',
    }));
}

function metaString(db: DB, key: string): string | null {
  const raw = scalarText(db, 'SELECT value_json FROM app_meta WHERE key = ?', [key]);
  if (raw === undefined) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

function profileSummaries(staging: DB): BackupProfileSummary[] {
  return query(staging, { kind: 'LIST_PROFILES', includeArchived: true }).map((p) => {
    const snap = query(staging, { kind: 'PROFILE_SNAPSHOT', profileId: p.profileId });
    const override = snap?.settings.displayNameOverride;
    const cleared = (snap?.campaignProgress ?? []).filter((c) => c.status === 'CLEARED').map((c) => c.nodeId);
    const status = snap?.activeAttempt?.status;
    return {
      profileId: p.profileId,
      displayName: typeof override === 'string' && override.trim() ? override : p.displayName,
      progressionMode: p.progressionMode, archived: p.archived, revision: p.revision, createdAt: p.createdAt, updatedAt: p.updatedAt,
      nodesCleared: new Set(cleared).size, clearedNodeIds: [...new Set(cleared)].sort(),
      cardsOwned: (snap?.inventory ?? []).reduce((s, i) => s + i.quantity, 0),
      decks: (snap?.decks ?? []).filter((d) => !d.archived).length,
      activeAttempt: status === 'RUNNING' || status === 'SUSPENDED' ? status : null,
    };
  });
}

/**
 * Valida um backup recebido e produz o staging canônico (§25.1 passos 1–4, sem OPFS). Nunca toca o banco
 * principal. Em caso de recusa, todas as conexões abertas aqui são fechadas.
 */
export function inspectBackup(sqlite3: Sqlite, bytes: Uint8Array, options: InspectOptions): InspectOk | StorageError {
  const checks: string[] = [];
  if (bytes.length > BACKUP_MAX_BYTES) return storageError('IMPORT_INVALID', `backup de ${bytes.length} bytes excede o limite de ${BACKUP_MAX_BYTES}`);
  const header = sqliteHeader(bytes);
  if (!header.valid) return storageError('IMPORT_INVALID', 'o arquivo não é um banco SQLite (cabeçalho inválido)');
  if (header.applicationId !== APPLICATION_ID) return storageError('IMPORT_INVALID', `application_id ${header.applicationId}: o arquivo não é um backup deste jogo`);
  if (header.userVersion > SCHEMA_VERSION) return storageError('SAVE_VERSION_UNSUPPORTED', `backup no schema ${header.userVersion}; este jogo lê até o schema ${SCHEMA_VERSION}`);
  if (header.userVersion < 1) return storageError('IMPORT_INVALID', `user_version ${header.userVersion} inválido`);
  checks.push('cabeçalho SQLite, application_id e user_version');

  const deadline = Date.now() + (options.deadlineMs ?? INSPECTION_DEADLINE_MS);
  let source: Database | null = null;
  let staging: Database | null = null;
  try {
    source = openUntrusted(sqlite3, bytes, deadline);
    if (scalarInt(source, 'PRAGMA application_id') !== APPLICATION_ID || scalarInt(source, 'PRAGMA user_version') !== header.userVersion) {
      fail('IMPORT_INVALID', 'application_id/user_version lidos não conferem com o cabeçalho');
    }
    // Staging canônico pelo runner normativo (§21): é também a referência do schema.
    staging = new sqlite3.oo1.DB(options.stagingName, 'c');
    const opened = openAndMigrate(staging, { now: options.now });
    if (!opened.ok) fail(opened.code, `staging: ${opened.message}`);
    compareSchema(source, staging);
    checks.push('objetos de sqlite_schema iguais ao schema canônico (sem gatilhos, visões ou tabelas estranhas)');
    checkMigrations(source, header.userVersion);
    checks.push('schema_migrations com checksums conhecidos');
    integrityOk(source, 'arquivo recebido');
    checks.push('integrity_check do arquivo');
    foreignKeysOk(source, 'arquivo recebido');
    checks.push('foreign_key_check do arquivo');
    const copied = copyRows(source, staging);
    checks.push(`${copied.rows} linhas copiadas por colunas explícitas para um banco novo`);
    integrityOk(staging, 'staging');
    foreignKeysOk(staging, 'staging');
    const tables = scalarInt(staging, "SELECT count(*) FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\'") ?? 0;
    if (tables !== EXPECTED_TABLES) fail('IMPORT_INVALID', `staging com ${tables} tabelas; esperado ${EXPECTED_TABLES}`);
    checks.push('integrity_check e foreign_key_check do staging');
    closeUntrusted(sqlite3, source);
    source = null;

    const assets = staging.selectArrays("SELECT count(*), COALESCE(SUM(byte_length), 0) FROM assets WHERE storage_kind = 'BLOB'")[0] ?? [0, 0];
    const inspection: BackupInspection = {
      bytes: bytes.length, userVersion: header.userVersion, applicationId: header.applicationId, pageSize: header.pageSize, pageCount: header.pageCount,
      appVersion: metaString(staging, 'appVersion'), installationId: metaString(staging, 'installationId'),
      tables, rows: copied.rows, profiles: profileSummaries(staging), contentPackages: packagesOf(staging),
      importedAssets: Number(assets[0]), importedAssetBytes: Number(assets[1]), checks,
    };
    const stagingBytes = sqlite3.capi.sqlite3_js_db_export(staging);
    return { ok: true, inspection, staging, stagingBytes };
  } catch (error) {
    if (source) closeUntrusted(sqlite3, source);
    staging?.close();
    if (isStorageFailure(error)) return storageError(error.storageCode, error.message);
    const classified = toStorageError(error, 'install');
    // Corrupção, NOTADB, prazo estourado (SQLITE_INTERRUPT) ou violação ao copiar: arquivo recusado.
    const interrupted = /interrupt/i.test(classified.message);
    return storageError(classified.code === 'STORAGE_FULL' ? 'STORAGE_FULL' : 'IMPORT_INVALID',
      interrupted ? 'a validação do backup excedeu o tempo limite' : `backup recusado: ${classified.message}`);
  }
}

// ---------------------------------------------------------------------------------------------------------
// Troca do banco principal (§25.1 “Substituir a instalação inteira”)

export type SwapFiles = {
  readonly exists: (path: string) => Promise<boolean>;
  readonly read: (path: string) => Promise<Uint8Array | null>;
  /** Renomeia/move um arquivo (move no OPFS quando disponível; senão cópia + remoção). */
  readonly move: (from: string, to: string) => Promise<void>;
  readonly remove: (path: string) => Promise<void>;
};

export type OpenedMain = { readonly ok: true; readonly db: DB; readonly report: OpenReport };

export type SwapDeps = {
  readonly files: SwapFiles;
  /** Fecha a conexão principal atual (nenhuma transação aberta). */
  readonly closeCurrent: () => void;
  /** Reabre pelo boot normal: PRAGMAs, application_id, user_version, migrações e quick_check. */
  readonly open: (path: string) => OpenedMain | StorageError;
  readonly sha256: (bytes: Uint8Array) => string | Promise<string>;
};

export type SwapArgs = {
  readonly mainPath: string;
  readonly stagingPath: string;
  readonly backupsDir: string;
  readonly expectedSha256: string;
  /** Carimbo do arquivo anterior (main-<stamp>.sqlite3). */
  readonly stamp: string;
};

export type SwapResult =
  | { readonly ok: true; readonly db: DB; readonly report: OpenReport; readonly previousPath: string }
  | (StorageError & { readonly db: DB | null; readonly restoredPrevious: boolean });

/** Abre pelo boot normal e exige quick_check = ok e conexão gravável. */
export function openVerified(db: DB, opened: ReturnType<typeof openAndMigrate>): OpenedMain | StorageError {
  if (!opened.ok) return opened;
  if (!opened.report.writable) return storageError(opened.report.readOnlyReason ?? 'SAVE_VERSION_UNSUPPORTED', 'banco restaurado não é gravável por este runtime');
  const quick = scalarText(db, 'PRAGMA quick_check');
  if (quick !== 'ok') return storageError('DATABASE_CORRUPT', `quick_check do banco restaurado: ${String(quick)}`);
  return { ok: true, db, report: opened.report };
}

/**
 * Fecha a conexão → main → backups/main-<stamp> → staging → main → reabre. Qualquer falha depois do primeiro
 * rename devolve o arquivo anterior para main antes de reabrir; nunca há dois bancos principais abertos.
 */
export async function swapDatabase(deps: SwapDeps, args: SwapArgs): Promise<SwapResult> {
  const { files } = deps;
  const failed = (code: StorageError['code'], message: string, db: DB | null, restoredPrevious: boolean): SwapResult =>
    ({ ok: false, code, message, db, restoredPrevious });
  const staged = await files.read(args.stagingPath);
  if (!staged) return failed('IMPORT_INVALID', 'arquivo de staging ausente; valide o backup de novo', null, false);
  if ((await deps.sha256(staged)) !== args.expectedSha256) return failed('IMPORT_INVALID', 'o staging não é o arquivo validado (SHA-256 diferente)', null, false);

  const reopenCurrent = (why: string, code: StorageError['code']): SwapResult => {
    const again = deps.open(args.mainPath);
    return again.ok ? failed(code, why, again.db, true) : failed('DATABASE_CORRUPT', `${why}; e o banco atual não reabriu: ${again.message}`, null, false);
  };

  deps.closeCurrent();
  if (await files.exists(`${args.mainPath}-journal`)) return reopenCurrent('journal pendente no banco atual; restauração adiada para não misturar arquivos', 'SAVE_WRITE_FAILED');
  const previousPath = `${args.backupsDir}/main-${args.stamp}.sqlite3`;
  try {
    await files.move(args.mainPath, previousPath);
  } catch (error) {
    return reopenCurrent(`não foi possível preservar o banco atual: ${error instanceof Error ? error.message : String(error)}`, 'SAVE_WRITE_FAILED');
  }
  let failure: StorageError;
  try {
    await files.move(args.stagingPath, args.mainPath);
    const opened = deps.open(args.mainPath);
    if (opened.ok) return { ok: true, db: opened.db, report: opened.report, previousPath };
    failure = opened;
  } catch (error) {
    failure = storageError('SAVE_WRITE_FAILED', error instanceof Error ? error.message : String(error));
  }
  // Volta ao arquivo anterior antes de reabrir.
  try {
    if (await files.exists(args.mainPath)) await files.remove(args.mainPath);
    await files.move(previousPath, args.mainPath);
  } catch (error) {
    return failed('DATABASE_CORRUPT', `restauração falhou (${failure.message}) e o banco anterior ficou em ${previousPath}: ${error instanceof Error ? error.message : String(error)}`, null, false);
  }
  return reopenCurrent(`restauração desfeita: ${failure.message}`, failure.code === 'DATABASE_CORRUPT' ? 'IMPORT_INVALID' : failure.code);
}

/** Carimbo de arquivo a partir de um instante ISO (sem `:`). */
export function fileStamp(iso: string): string {
  return iso.replace(/\.\d+Z$/, 'Z').replace(/:/g, '-');
}
