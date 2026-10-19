// Executor do Storage Worker (persistencia-sqlite.md §4, §12–§21, §23): funções síncronas sobre um handle
// oo1 do SQLite WASM. O mesmo código roda no Dedicated Worker (VFS opfs) e nos testes Node (MEMFS).
//
// Contrato para a camada de aplicação:
// - operation_id = `op-<profileId>-<committedRevision>` (único: a revisão é o último segmento, só dígitos).
// - committedRevision = expectedRevision + 1. CREATE_PROFILE_ONBOARDING / IMPORT_PROFILE começam com
//   INSERT_PROFILE e expectedRevision 0; o perfil nasce com revision 1 e writer_epoch = request.writerEpoch.
// - FKs são imediatas: a ordem das mutações precisa respeitar referências. Ex.: INSERT_DECK antes de
//   INSERT_DECK_VERSION; INSERT_ASSET_BLOB antes de qualquer referência ao asset; no PUBLISH_CARD:
//   INSERT_ASSET_BLOB* → INSERT_CARD_DEFINITION? → INSERT_CARD_VERSION? → INSERT_EDITOR_REVISION_PUBLISHED →
//   INSERT_PUBLICATION? → INSERT_PRINTING* → INSERT_CARD_DEPENDENCY* → SET_CATALOG_HEAD?;
//   INSERT_COSMETIC_PRESET antes de SET_PROFILE_APPEARANCE/SET_DECK_APPEARANCE; INSERT_ATTEMPT antes de
//   INSERT_BATTLE_EVENTS/INSERT_CHECKPOINT/INSERT_PENDING_REWARD que a referenciam.
// - grantKeys são gravadas em reward_grants depois das mutações; o recibo guarda grants = grantKeys.
import type { Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import type {
  CommitOk, CommitRequest, ContentInstall, JsonValue, LightWrite, Query, QueryResultMap, Receipt, StorageError, WriteOk,
} from '../../application/ports/storage.ts';
import { jcsHash, sha256Hex } from '../../domain/hash/jcs.ts';
import { fail, rethrowClassified, storageError, toStorageError } from './errors.ts';
import { applyLightWrite } from './light-writes.ts';
import { MIGRATION_0001_NAME, MIGRATION_0001_SHA256, MIGRATION_0001_SQL, MIGRATION_0001_VERSION } from './migrations/0001-schema-v1.ts';
import { applyMutation, insertPrinting, operationIdFor, type CommitContext } from './mutations.ts';
import { verifyImportedOperations } from './profile-import.ts';
import type { OpenReport, RpcRequest } from './protocol.ts';
import { parseReceipt, runQuery } from './queries.ts';
import {
  HEX64, inImmediateTransaction, int, nowIso, rollbackQuietly, row, run, scalarInt, scalarText, text, toJson, type DB,
} from './sql.ts';

export const APPLICATION_ID = 1128354372;
export const SCHEMA_VERSION = 1;
export const EXPECTED_TABLES = 47;
export const DEFAULT_RULESET_ID = 'local-campaign-v2';

/** Campos de arte que uma versão nova do pacote BASE pode trocar numa impressão já instalada (runtime §20.1). */
const BUNDLED_ART_FIELDS = new Set(['artMode', 'artKey', 'crop', 'artTransform']);

/**
 * Troca de arte empacotada (runtime §20.1; persistência §8): a impressão já instalada pertence a um pacote BASE, as
 * duas aparências não usam arte importada (`artAssetId`/`assetBindings`) e diferem só em `BUNDLED_ART_FIELDS`. A
 * linha imutável de `card_printings` fica como registro da primeira instalação; a apresentação de impressões
 * empacotadas lê a aparência do pacote ativo. Qualquer outra diferença continua sendo conflito (DB-047).
 */
function bundledArtOnlyChange(db: DB, printingId: string, next: JsonValue): boolean {
  if (scalarInt(db, 'SELECT 1 FROM package_cards WHERE printing_id = ? LIMIT 1', [printingId]) === undefined) return false;
  const storedJson = scalarText(db, 'SELECT appearance_json FROM card_printings WHERE printing_id = ?', [printingId]);
  if (storedJson === undefined) return false;
  const stored = JSON.parse(storedJson) as JsonValue;
  const plain = (v: JsonValue): v is Record<string, JsonValue> => v !== null && typeof v === 'object' && !Array.isArray(v);
  if (!plain(stored) || !plain(next)) return false;
  const imported = (v: Record<string, JsonValue>) => v.artAssetId != null || (Array.isArray(v.assetBindings) && v.assetBindings.length > 0);
  if (imported(stored) || imported(next)) return false;
  const rest = (v: Record<string, JsonValue>): JsonValue => Object.fromEntries(Object.entries(v).filter(([k]) => !BUNDLED_ART_FIELDS.has(k)));
  return jcsHash(rest(stored)) === jcsHash(rest(next));
}

export type Migration = { readonly version: number; readonly name: string; readonly sql: string; readonly sha256: string };

export const MIGRATIONS: readonly Migration[] = [
  { version: MIGRATION_0001_VERSION, name: MIGRATION_0001_NAME, sql: MIGRATION_0001_SQL, sha256: MIGRATION_0001_SHA256 },
];

type SqliteCapi = { readonly capi: Pick<Sqlite3Static['capi'], 'sqlite3_js_db_export' | 'sqlite3_get_autocommit'> };

/** Conexões abertas por `openAndMigrate`: só elas aceitam consultas e escritas. */
const connections = new WeakMap<DB, OpenReport>();

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/;

// ---------------------------------------------------------------------------------------------------------
// Abertura e migração (persistencia §4, §21)

type ConnectionPragmas = { readonly foreignKeys: boolean; readonly journalMode: string; readonly synchronous: number; readonly busyTimeout: number };

/** PRAGMAs de conexão fora de transação, cada um lido de volta; divergência aborta o boot. */
function applyConnectionPragmas(db: DB): ConnectionPragmas {
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA journal_mode = DELETE');
  db.exec('PRAGMA synchronous = FULL');
  db.exec('PRAGMA busy_timeout = 1500');
  const pragmas = {
    foreignKeys: scalarInt(db, 'PRAGMA foreign_keys') === 1,
    journalMode: (scalarText(db, 'PRAGMA journal_mode') ?? '').toLowerCase(),
    synchronous: scalarInt(db, 'PRAGMA synchronous') ?? -1,
    busyTimeout: scalarInt(db, 'PRAGMA busy_timeout') ?? -1,
  };
  if (!pragmas.foreignKeys) fail('STORAGE_CAPABILITY_MISSING', 'PRAGMA foreign_keys não ficou ON');
  if (pragmas.journalMode !== 'delete') fail('STORAGE_CAPABILITY_MISSING', `PRAGMA journal_mode leu '${pragmas.journalMode}', esperado 'delete'`);
  if (pragmas.synchronous !== 2) fail('STORAGE_CAPABILITY_MISSING', `PRAGMA synchronous leu ${pragmas.synchronous}, esperado 2 (FULL)`);
  if (pragmas.busyTimeout !== 1500) fail('STORAGE_CAPABILITY_MISSING', `PRAGMA busy_timeout leu ${pragmas.busyTimeout}, esperado 1500`);
  return pragmas;
}

/**
 * Runner normativo (o mesmo script de .specs/database/test_schema.py): BEGIN IMMEDIATE → DDL puro →
 * schema_migrations → application_id → user_version → COMMIT, num único exec. Erro: ROLLBACK, user_version intacto.
 */
export function applyMigration(db: DB, migration: Migration, appliedAt: string): void {
  if (!ISO_UTC.test(appliedAt)) fail('MIGRATION_FAILED', `applied_at inválido: ${appliedAt}`);
  if (!HEX64.test(migration.sha256) || !/^[0-9a-z-]+$/.test(migration.name)) fail('MIGRATION_FAILED', `migração ${migration.version} malformada`);
  const script = 'BEGIN IMMEDIATE;\n' + migration.sql
    + `\nINSERT INTO schema_migrations VALUES (${migration.version},'${migration.name}','${migration.sha256}','${appliedAt}');`
    + `\nPRAGMA application_id = ${APPLICATION_ID};\nPRAGMA user_version = ${migration.version};\nCOMMIT;\n`;
  try {
    db.exec(script);
  } catch (error) {
    rollbackQuietly(db);
    const classified = toStorageError(error, 'open');
    fail(classified.code === 'STORAGE_FULL' ? 'STORAGE_FULL' : 'MIGRATION_FAILED', `migração ${migration.name}: ${classified.message}`);
  }
}

function verifyFreshSchema(db: DB): void {
  const integrity = scalarText(db, 'PRAGMA integrity_check');
  if (integrity !== 'ok') fail('MIGRATION_FAILED', `integrity_check pós-migração: ${String(integrity)}`);
  if (db.selectArrays('PRAGMA foreign_key_check').length > 0) fail('MIGRATION_FAILED', 'foreign_key_check pós-migração com violações');
  const tables = scalarInt(db, "SELECT count(*) FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%'") ?? 0;
  if (tables !== EXPECTED_TABLES) fail('MIGRATION_FAILED', `${tables} tabelas após a migração; esperado ${EXPECTED_TABLES}`);
}

function verifyRecordedChecksums(db: DB, upTo: number): void {
  for (const migration of MIGRATIONS) {
    if (migration.version > upTo) continue;
    const recorded = scalarText(db, 'SELECT checksum_sha256 FROM schema_migrations WHERE version = ?', [migration.version]);
    if (recorded !== migration.sha256) {
      fail('MIGRATION_FAILED', `schema_migrations ${migration.version}: checksum ${String(recorded)} difere do arquivo conhecido ${migration.sha256}`);
    }
  }
}

export type OpenOptions = { readonly now?: string; readonly installationId?: string };

function newInstallationId(): string {
  const random = globalThis.crypto;
  if (typeof random.randomUUID === 'function') return random.randomUUID();
  return Array.from(random.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Boot do banco (persistencia §21): PRAGMAs, application_id/user_version, migração de banco vazio,
 * recusa de banco alheio (DATABASE_CORRUPT) e de schema futuro (aberto só para leitura: SAVE_VERSION_UNSUPPORTED).
 */
export function openAndMigrate(db: DB, options: OpenOptions = {}): { readonly ok: true; readonly report: OpenReport } | StorageError {
  try {
    const pragmas = applyConnectionPragmas(db);
    let applicationId = scalarInt(db, 'PRAGMA application_id') ?? 0;
    let userVersion = scalarInt(db, 'PRAGMA user_version') ?? 0;
    let status: OpenReport['status'] = 'OPENED';
    if (applicationId === 0 && userVersion === 0) {
      const objects = scalarInt(db, 'SELECT count(*) FROM sqlite_schema') ?? 0;
      if (objects > 0) fail('DATABASE_CORRUPT', 'banco com objetos e sem application_id: não é um banco Card Campaign');
      for (const migration of MIGRATIONS) applyMigration(db, migration, options.now ?? nowIso());
      verifyFreshSchema(db);
      // app_meta.installationId nasce com o banco (persistencia §7.1); nunca sai da máquina.
      inImmediateTransaction(db, () => run(db, "INSERT INTO app_meta(key, value_json) VALUES ('installationId', ?) ON CONFLICT(key) DO NOTHING",
        [toJson(options.installationId ?? newInstallationId())]));
      status = 'CREATED';
      applicationId = scalarInt(db, 'PRAGMA application_id') ?? 0;
      userVersion = scalarInt(db, 'PRAGMA user_version') ?? 0;
    }
    if (applicationId !== APPLICATION_ID) fail('DATABASE_CORRUPT', `application_id ${applicationId} não pertence a esta aplicação`);
    if (userVersion < 1) fail('DATABASE_CORRUPT', `user_version ${userVersion} inválido para application_id desta aplicação`);
    const future = userVersion > SCHEMA_VERSION;
    if (!future) verifyRecordedChecksums(db, userVersion);
    const report: OpenReport = {
      status,
      writable: !future,
      readOnlyReason: future ? 'SAVE_VERSION_UNSUPPORTED' : null,
      userVersion,
      applicationId,
      sqliteVersion: scalarText(db, 'SELECT sqlite_version()') ?? '',
      journalMode: pragmas.journalMode,
      foreignKeys: pragmas.foreignKeys,
      synchronous: pragmas.synchronous,
      busyTimeout: pragmas.busyTimeout,
      vfs: db.dbVfsName() ?? 'unknown',
    };
    connections.set(db, report);
    return { ok: true, report };
  } catch (error) {
    rollbackQuietly(db);
    return toStorageError(error, 'open');
  }
}

export function openReport(db: DB): OpenReport | null {
  return connections.get(db) ?? null;
}

function requireOpen(db: DB): OpenReport {
  const report = connections.get(db);
  if (!report) fail('SAVE_WRITE_FAILED', 'conexão não inicializada por openAndMigrate');
  return report;
}

function requireWritable(db: DB): void {
  const report = requireOpen(db);
  if (!report.writable) {
    fail(report.readOnlyReason ?? 'SAVE_VERSION_UNSUPPORTED', `banco em user_version ${report.userVersion}; este runtime grava somente o schema ${SCHEMA_VERSION}`);
  }
}

// ---------------------------------------------------------------------------------------------------------
// Commit de comando (persistencia §12–§18)

export { operationIdFor };

/** Conferências que não dependem do banco, feitas antes do BEGIN (hashes nunca dentro da transação). */
function validateCommitRequest(req: CommitRequest): void {
  if (!req.commandId) fail('INTERNAL_INTEGRITY_ERROR', 'commandId vazio');
  if (!HEX64.test(req.payloadHash)) fail('INTERNAL_INTEGRITY_ERROR', 'payloadHash não é SHA-256 hex minúsculo');
  if (!Number.isSafeInteger(req.expectedRevision) || req.expectedRevision < 0) fail('INTERNAL_INTEGRITY_ERROR', 'expectedRevision inválida');
  if (!Number.isSafeInteger(req.writerEpoch) || req.writerEpoch < 0) fail('INTERNAL_INTEGRITY_ERROR', 'writerEpoch inválido');
  req.mutations.forEach((m, index) => {
    if (m.kind === 'INSERT_PROFILE' && index !== 0) fail('INTERNAL_INTEGRITY_ERROR', 'INSERT_PROFILE só pode ser a primeira mutação');
    if (m.kind === 'INSERT_ASSET_BLOB' && sha256Hex(m.bytes) !== m.assetId) fail('INTERNAL_INTEGRITY_ERROR', `asset_id ${m.assetId} não é o SHA-256 dos bytes`);
    if (m.kind === 'INSERT_CARD_VERSION' && jcsHash(m.rules) !== m.rulesHash) fail('INTERNAL_INTEGRITY_ERROR', `rules_hash de ${m.definitionId} v${m.version} não confere (JCS)`);
    if (m.kind === 'INSERT_PRINTING' && jcsHash(m.appearance) !== m.appearanceHash) fail('INTERNAL_INTEGRITY_ERROR', `appearance_hash de ${m.printingId} não confere (JCS)`);
    if (m.kind === 'IMPORT_PROFILE_ROWS') {
      if (req.commandType !== 'IMPORT_PROFILE' || index !== 1) fail('INTERNAL_INTEGRITY_ERROR', 'IMPORT_PROFILE_ROWS só vem logo após INSERT_PROFILE num IMPORT_PROFILE');
      validateImportHashes(m);
    }
  });
}

/** Hashes do conteúdo importado conferidos fora da transação (persistencia §12 passo 4; §24.1). */
function validateImportHashes(m: Extract<CommitRequest['mutations'][number], { kind: 'IMPORT_PROFILE_ROWS' }>): void {
  for (const a of m.content.assets) if (sha256Hex(a.bytes) !== a.assetId) fail('IMPORT_INVALID', `asset ${a.assetId}: bytes não conferem com o SHA-256`);
  for (const v of m.content.versions) if (jcsHash(v.rules) !== v.rulesHash) fail('IMPORT_INVALID', `rules_hash de ${v.definitionId} v${v.version} não confere (JCS)`);
  for (const p of m.content.printings) if (jcsHash(p.appearance) !== p.appearanceHash) fail('IMPORT_INVALID', `appearance_hash de ${p.printingId} não confere (JCS)`);
  for (const a of m.rows.attempts) {
    for (const c of a.checkpoints) if (jcsHash(c.snapshot) !== c.snapshotHash) fail('IMPORT_INVALID', `checkpoint ${a.attemptId}@${c.stateVersion}: snapshot_hash não confere`);
  }
}

function storedReceipt(req: CommitRequest): Receipt {
  return {
    commandType: req.commandType,
    summary: req.receipt.summary,
    grants: [...req.grantKeys],
    ...(req.receipt.events !== undefined ? { events: req.receipt.events } : {}),
  };
}

function applyCommit(db: DB, req: CommitRequest): CommitOk {
  const committedRevision = req.expectedRevision + 1;
  const operationId = operationIdFor(req.profileId, committedRevision);
  const [first, ...rest] = req.mutations;
  let mutations = req.mutations;
  if (first?.kind === 'INSERT_PROFILE') {
    // IMPORT_PROFILE traz N operações históricas (revisões 1..N); a própria importação confirma N+1.
    if (req.expectedRevision !== 0 && req.commandType !== 'IMPORT_PROFILE') fail('REVISION_CONFLICT', 'criação de perfil exige expectedRevision 0');
    if (scalarInt(db, 'SELECT 1 FROM profiles WHERE profile_id = ?', [req.profileId]) !== undefined) {
      fail('REVISION_CONFLICT', `perfil ${req.profileId} já existe`);
    }
    run(db, `INSERT INTO profiles(profile_id, display_name, progression_mode, revision, writer_epoch, economy_rng_json, created_at, updated_at, archived)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [req.profileId, first.displayName, first.progressionMode, committedRevision, req.writerEpoch, toJson(first.rngJson), req.committedAt, req.committedAt]);
    mutations = rest;
  } else {
    const changed = run(db, 'UPDATE profiles SET revision = revision + 1, updated_at = ? WHERE profile_id = ? AND revision = ? AND writer_epoch = ?',
      [req.committedAt, req.profileId, req.expectedRevision, req.writerEpoch]);
    if (changed !== 1) fail('REVISION_CONFLICT', `perfil ${req.profileId}: revisão ${req.expectedRevision}/época ${req.writerEpoch} não confirmadas`);
  }
  const receipt = storedReceipt(req);
  run(db, `INSERT INTO operations(operation_id, profile_id, command_id, command_type, payload_hash, committed_revision, receipt_json, committed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  [operationId, req.profileId, req.commandId, req.commandType, req.payloadHash, committedRevision, toJson({ ...receipt, committedRevision }), req.committedAt]);
  const ctx: CommitContext = {
    db, profileId: req.profileId, operationId, committedRevision, at: req.committedAt, walletEntryNo: 0, inventoryEntryNo: 0, ignoredEntitlements: [],
  };
  for (const mutation of mutations) applyMutation(ctx, mutation);
  if (req.commandType === 'IMPORT_PROFILE' && first?.kind === 'INSERT_PROFILE') verifyImportedOperations(db, req.profileId, committedRevision);
  for (const grantKey of req.grantKeys) {
    if (scalarInt(db, 'SELECT 1 FROM reward_grants WHERE profile_id = ? AND grant_key = ?', [req.profileId, grantKey]) !== undefined) {
      fail('REWARD_ALREADY_GRANTED', `concessão ${grantKey} já registrada`);
    }
    run(db, 'INSERT INTO reward_grants(profile_id, grant_key, operation_id, granted_at) VALUES (?, ?, ?, ?)', [req.profileId, grantKey, operationId, req.committedAt]);
  }
  return {
    ok: true,
    status: 'COMMITTED',
    operationId,
    committedRevision,
    receipt,
    ...(ctx.ignoredEntitlements.length > 0 ? { ignoredEntitlements: [...ctx.ignoredEntitlements] } : {}),
  };
}

/**
 * Transação de comando: idempotência por (profile_id, command_id) → BEGIN IMMEDIATE → CAS de revisão/época →
 * operations → mutações → reward_grants → COMMIT. Qualquer falha faz ROLLBACK e vira código de produto.
 */
export function commit(db: DB, req: CommitRequest): CommitOk | StorageError {
  try {
    requireWritable(db);
    const existing = row(db, 'SELECT operation_id, payload_hash, committed_revision, receipt_json FROM operations WHERE profile_id = ? AND command_id = ?',
      [req.profileId, req.commandId]);
    if (existing) {
      if (text(existing, 'payload_hash') !== req.payloadHash) {
        return storageError('COMMAND_PAYLOAD_MISMATCH', `command ${req.commandId} já confirmado com outro payload`);
      }
      return {
        ok: true,
        status: 'REPLAYED',
        operationId: text(existing, 'operation_id'),
        committedRevision: int(existing, 'committed_revision'),
        receipt: parseReceipt(text(existing, 'receipt_json')),
      };
    }
    validateCommitRequest(req);
    return inImmediateTransaction(db, () => applyCommit(db, req));
  } catch (error) {
    return toStorageError(error, 'commit');
  }
}

// ---------------------------------------------------------------------------------------------------------
// Escritas leves, consultas, conteúdo, época de escrita e exportação

export function write(db: DB, w: LightWrite, at: string = nowIso()): WriteOk | StorageError {
  try {
    requireWritable(db);
    if (w.kind === 'INSERT_ASSET_BLOB' && sha256Hex(w.bytes) !== w.assetId) fail('INTERNAL_INTEGRITY_ERROR', `asset_id ${w.assetId} não é o SHA-256 dos bytes`);
    return inImmediateTransaction(db, () => applyLightWrite(db, w, at));
  } catch (error) {
    return toStorageError(error, 'write');
  }
}

/** Consulta tipada; falhas são lançadas como StorageFailure (Error com `storageCode`). */
export function query<Q extends Query>(db: DB, q: Q): QueryResultMap[Q['kind']] {
  try {
    requireOpen(db);
    return runQuery(db, q);
  } catch (error) {
    return rethrowClassified(error, 'query');
  }
}

function manifestRulesetId(manifest: JsonValue): string | undefined {
  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) return undefined;
  return typeof manifest.rulesetId === 'string' ? manifest.rulesetId : undefined;
}

function activePackagesAfter(db: DB, install: ContentInstall): JsonValue {
  const raw = scalarText(db, "SELECT value_json FROM app_meta WHERE key = 'contentPackages'");
  const current = raw === undefined ? [] : (JSON.parse(raw) as unknown);
  const kept = (Array.isArray(current) ? current : []).filter((entry): entry is { packageId: string; version: string; contentHash: string } =>
    entry !== null && typeof entry === 'object' && typeof (entry as { packageId?: unknown }).packageId === 'string'
    && (entry as { packageId: string }).packageId !== install.packageId);
  return [...kept.map((e) => ({ packageId: e.packageId, version: e.version, contentHash: e.contentHash })),
    { packageId: install.packageId, version: install.version, contentHash: install.contentHash }];
}

/**
 * Instala o pacote BASE (idempotente por package_id + version + content_hash). Definições, versões e impressões
 * já existentes com o mesmo hash são reutilizadas (imutáveis); mesmo ID com hash diferente = IMPORT_INVALID.
 */
export function installContent(db: DB, install: ContentInstall, at: string = nowIso()): { readonly ok: true; readonly installed: boolean } | StorageError {
  try {
    requireWritable(db);
    if (!HEX64.test(install.contentHash)) fail('IMPORT_INVALID', 'contentHash não é SHA-256 hex minúsculo');
    const installedHash = scalarText(db, 'SELECT content_hash FROM content_packages WHERE package_id = ? AND version = ?', [install.packageId, install.version]);
    if (installedHash !== undefined) {
      if (installedHash === install.contentHash) return { ok: true, installed: false };
      fail('IMPORT_INVALID', `pacote ${install.packageId}@${install.version} já instalado com outro content_hash`);
    }
    for (const d of install.definitions) {
      if (jcsHash(d.rules) !== d.rulesHash) fail('IMPORT_INVALID', `rules_hash de ${d.definitionId} v${d.version} não confere (JCS)`);
    }
    for (const p of install.printings) {
      if (jcsHash(p.appearance) !== p.appearanceHash) fail('IMPORT_INVALID', `appearance_hash de ${p.printingId} não confere (JCS)`);
    }
    const rulesetId = install.rulesetId ?? manifestRulesetId(install.manifest) ?? DEFAULT_RULESET_ID;
    inImmediateTransaction(db, () => {
      run(db, "INSERT INTO content_packages(package_id, version, origin, manifest_json, content_hash, installed_at) VALUES (?, ?, 'BASE', ?, ?, ?)",
        [install.packageId, install.version, toJson(install.manifest), install.contentHash, at]);
      const heads = new Map<string, number>();
      for (const d of install.definitions) {
        const namespace = scalarText(db, 'SELECT namespace FROM card_definitions WHERE definition_id = ?', [d.definitionId]);
        if (namespace === undefined) {
          run(db, "INSERT INTO card_definitions(definition_id, namespace, owner_profile_id, created_at, archived) VALUES (?, 'BASE', NULL, ?, 0)", [d.definitionId, at]);
        } else if (namespace !== 'BASE') {
          fail('IMPORT_INVALID', `definição ${d.definitionId} já existe como ${namespace}`);
        }
        const storedHash = scalarText(db, 'SELECT rules_hash FROM card_versions WHERE definition_id = ? AND version = ?', [d.definitionId, d.version]);
        if (storedHash === undefined) {
          run(db, 'INSERT INTO card_versions(definition_id, version, rules_json, rules_hash, ruleset_id, search_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [d.definitionId, d.version, toJson(d.rules), d.rulesHash, rulesetId, d.searchKey, at]);
        } else if (storedHash !== d.rulesHash) {
          fail('IMPORT_INVALID', `${d.definitionId} v${d.version} já publicada com outro rules_hash`);
        }
        if (scalarInt(db, 'SELECT 1 FROM card_publications WHERE definition_id = ? AND version = ?', [d.definitionId, d.version]) === undefined) {
          run(db, `INSERT INTO card_publications(definition_id, version, validator_version, validation_report_json, profile_id, project_id,
                     project_revision, operation_id, published_at)
                   VALUES (?, ?, 'content-build', ?, NULL, NULL, NULL, NULL, ?)`, [d.definitionId, d.version, toJson({ source: 'BASE' }), at]);
        }
        heads.set(d.definitionId, Math.max(heads.get(d.definitionId) ?? 0, d.version));
      }
      for (const [definitionId, version] of heads) {
        const current = scalarInt(db, 'SELECT version FROM card_catalog_heads WHERE definition_id = ?', [definitionId]);
        if (current === undefined || current < version) {
          run(db, 'INSERT INTO card_catalog_heads(definition_id, version) VALUES (?, ?) ON CONFLICT(definition_id) DO UPDATE SET version = excluded.version',
            [definitionId, version]);
        }
      }
      for (const p of install.printings) {
        const storedHash = scalarText(db, 'SELECT appearance_hash FROM card_printings WHERE printing_id = ?', [p.printingId]);
        if (storedHash === undefined) insertPrinting(db, p, at);
        else if (storedHash !== p.appearanceHash && !bundledArtOnlyChange(db, p.printingId, p.appearance)) {
          fail('IMPORT_INVALID', `impressão ${p.printingId} já existe com outro appearance_hash`);
        }
        run(db, 'INSERT INTO package_cards(package_id, package_version, printing_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
          [install.packageId, install.version, p.printingId]);
      }
      run(db, "INSERT INTO app_meta(key, value_json) VALUES ('contentPackages', ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json",
        [toJson(activePackagesAfter(db, install))]);
    });
    return { ok: true, installed: true };
  } catch (error) {
    return toStorageError(error, 'install');
  }
}

/**
 * Incrementa `app_meta.writerEpochCounter` (nunca abaixo do maior writer_epoch existente) e o grava em
 * `profiles.writer_epoch` do perfil, se existir. Para criar um perfil: obter a época antes e usá-la no commit.
 */
export function bumpWriterEpoch(db: DB, profileId: string): number {
  try {
    requireWritable(db);
    return inImmediateTransaction(db, () => {
      const raw = scalarText(db, "SELECT value_json FROM app_meta WHERE key = 'writerEpochCounter'");
      const parsed = raw === undefined ? 0 : Number(JSON.parse(raw));
      const counter = Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
      const highest = scalarInt(db, 'SELECT COALESCE(MAX(writer_epoch), 0) FROM profiles') ?? 0;
      const next = Math.max(counter, highest) + 1;
      run(db, "INSERT INTO app_meta(key, value_json) VALUES ('writerEpochCounter', ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json", [toJson(next)]);
      run(db, 'UPDATE profiles SET writer_epoch = ? WHERE profile_id = ?', [next, profileId]);
      return next;
    });
  } catch (error) {
    return rethrowClassified(error, 'write');
  }
}

/** Backup completo (persistencia §23): só entre transações; bytes de um SQLite comum (sqlite3_serialize). */
export function exportDatabase(sqlite3: SqliteCapi, db: DB): Uint8Array {
  try {
    requireOpen(db);
    if (sqlite3.capi.sqlite3_get_autocommit(db) === 0) fail('SAVE_WRITE_FAILED', 'exportação recusada com transação aberta');
    return sqlite3.capi.sqlite3_js_db_export(db);
  } catch (error) {
    return rethrowClassified(error, 'query');
  }
}

/**
 * Despacho de uma requisição RPC (worker e adaptador Node). `init`/`close` e as operações de arquivo do OPFS
 * (`restoreSwap`, `wipeAll`) são tratados pelo hospedeiro, que é dono da conexão.
 */
export function dispatch(sqlite3: SqliteCapi, db: DB, request: Exclude<RpcRequest, { method: 'init' | 'close' | 'restoreSwap' | 'wipeAll' }>): unknown {
  switch (request.method) {
    case 'query': return query(db, request.args);
    case 'commit': return commit(db, request.args);
    case 'write': return write(db, request.args);
    case 'installContent': return installContent(db, request.args);
    case 'bumpWriterEpoch': return bumpWriterEpoch(db, request.args.profileId);
    case 'exportDatabase': return exportDatabase(sqlite3, db);
  }
}
