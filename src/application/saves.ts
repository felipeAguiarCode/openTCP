// Saves, backup e importação (persistencia-sqlite.md §5, §22–§25; interface-16x9.md §31; runtime §7).
// Preparação pura (manifestos, documentos do perfil portátil, validação de arquivos não confiáveis, remapeamento
// de IDs) + confirmação por `ctx.bus.execute` (IMPORT_PROFILE num único COMMIT). Sem DOM, sem SQL e sem ZIP:
// o contêiner (ZIP), os workers de restauração e o OPFS ficam na infraestrutura.
import { canonicalize, jcsHash, sha256Hex, utf8 } from '../domain/hash/jcs.ts';
import type { CommandBus } from './commands.ts';
import type { ContentIndex } from './content.ts';
import type { GameContext } from './context.ts';
import { isLegacyInventory } from './legacy.ts';
import type {
  BackupInspection, BackupProfileSummary, ContentPackageRef, ImportPreflightResult, JsonValue, Mutation, PortableAsset, PortableAttempt,
  PortableCardVersion, PortableContent,
  PortableDeck, PortableProject, ProfileExportData, ProfileRowsV4, ProfileSnapshot, StorageError, StorageErrorCode,
} from './ports/storage.ts';

// ---------------------------------------------------------------------------------------------------------
// Versões e formatos (persistencia §5)

export const APPLICATION_ID = 1128354372;
/** Schema SQLite que este runtime lê e grava (`PRAGMA user_version`). */
export const SUPPORTED_SCHEMA_VERSION = 1;
export const BACKUP_FORMAT = 'card-campaign-database-backup';
export const BACKUP_FORMAT_VERSION = 1;
export const PROFILE_FORMAT = 'card-campaign-profile';
export const PROFILE_FORMAT_VERSION = 4;
/** Limite do backup SQLite recebido (persistencia §25). */
export const BACKUP_MAX_BYTES = 256 * 1024 * 1024;

export type SavesContext = Pick<GameContext, 'storage' | 'bus' | 'platform'>;

// ---------------------------------------------------------------------------------------------------------
// Estados da tela S31 (interface §31.5)

export type SaveFileState =
  | 'VALID' | 'INVALID_FORMAT' | 'FUTURE_VERSION' | 'MISSING_CONTENT' | 'CHECKSUM_MISMATCH' | 'SIZE_LIMIT' | 'NO_SPACE' | 'OTHER_TAB';

export const SAVE_STATE_LABEL: Readonly<Record<SaveFileState, string>> = {
  VALID: 'Save válido',
  INVALID_FORMAT: 'Formato inválido',
  FUTURE_VERSION: 'Versão futura',
  MISSING_CONTENT: 'Conteúdo ausente',
  CHECKSUM_MISMATCH: 'Checksum divergente',
  SIZE_LIMIT: 'Limite de tamanho',
  NO_SPACE: 'Falta de espaço',
  OTHER_TAB: 'Jogo aberto em outra aba',
};

export type SavesFailure = StorageError & { readonly state: SaveFileState; readonly details?: readonly string[] };

export function savesFailure(code: StorageErrorCode, message: string, state?: SaveFileState, details?: readonly string[]): SavesFailure {
  return { ok: false, code, message, state: state ?? stateForCode(code), ...(details && details.length ? { details } : {}) };
}

export function stateForCode(code: StorageErrorCode): SaveFileState {
  switch (code) {
    case 'SAVE_VERSION_UNSUPPORTED': return 'FUTURE_VERSION';
    case 'CONTENT_REFERENCE_MISSING': return 'MISSING_CONTENT';
    case 'STORAGE_FULL': return 'NO_SPACE';
    case 'DATABASE_IN_USE': return 'OTHER_TAB';
    default: return 'INVALID_FORMAT';
  }
}

/** Falhas do leitor de ZIP da infraestrutura → estado da tela. */
export function stateForArchiveReason(reason: string): SaveFileState {
  if (reason === 'TOO_LARGE' || reason === 'TOO_MANY_ENTRIES') return 'SIZE_LIMIT';
  if (reason === 'CORRUPT') return 'CHECKSUM_MISMATCH';
  return 'INVALID_FORMAT';
}

/** Erro de validação lançado pelos leitores abaixo e convertido em SavesFailure na borda. */
type ArchiveError = Error & { readonly saves: SavesFailure };

function reject(message: string, state: SaveFileState = 'INVALID_FORMAT', code: StorageErrorCode = 'IMPORT_INVALID'): never {
  throw Object.assign(new Error(message), { saves: savesFailure(code, message, state) });
}

function asFailure(error: unknown): SavesFailure {
  const saves = (error as Partial<ArchiveError> | null)?.saves;
  if (saves) return saves;
  return savesFailure('IMPORT_INVALID', `Arquivo inválido: ${error instanceof Error ? error.message : String(error)}`);
}

// ---------------------------------------------------------------------------------------------------------
// Utilidades

/** Espera a fila de comandos esvaziar (persistencia §23: exportar só entre transações). */
export async function waitForIdle(bus: CommandBus, timeoutMs = 15_000, stepMs = 50): Promise<boolean> {
  for (let waited = 0; bus.pending(); waited += stepMs) {
    if (waited >= timeoutMs) return false;
    await new Promise((resolve) => setTimeout(resolve, stepMs));
  }
  return true;
}

/** ISO 8601 UTC sem milissegundos (`2026-10-14T00:00:00Z`). */
export function isoSeconds(iso: string): string {
  return iso.replace(/\.\d+Z$/, 'Z');
}

function stamp(iso: string): string {
  return isoSeconds(iso).replace(/:/g, '-').replace(/Z$/, 'Z');
}

export function slug(text: string): string {
  const base = text.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return (base || 'perfil').slice(0, 40);
}

function jsonBytes(value: unknown): Uint8Array {
  return utf8(canonicalize(value));
}

const MEDIA_EXT: Readonly<Record<string, string>> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
/** Mídia aceita num perfil portátil (artes/máscaras importadas; editor §10). */
export const ASSET_MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

/** Tipo e dimensões lidos do cabeçalho de PNG, JPEG ou WebP (sem decodificar a imagem). `null` = não reconhecido. */
export function imageInfo(bytes: Uint8Array): { readonly mediaType: (typeof ASSET_MEDIA_TYPES)[number]; readonly width: number | null; readonly height: number | null } | null {
  const b = bytes;
  const u16be = (i: number) => ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0);
  const u32be = (i: number) => (((b[i] ?? 0) << 24) >>> 0) + (((b[i + 1] ?? 0) << 16) | ((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0));
  const u16le = (i: number) => (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8);
  const u24le = (i: number) => (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8) | ((b[i + 2] ?? 0) << 16);
  const positive = (n: number) => (n > 0 ? n : null);
  const ascii = (i: number, text: string) => [...text].every((ch, k) => b[i + k] === ch.charCodeAt(0));
  if (b.length >= 24 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) {
    return ascii(12, 'IHDR') ? { mediaType: 'image/png', width: positive(u32be(16)), height: positive(u32be(20)) } : { mediaType: 'image/png', width: null, height: null };
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i += 1; continue; }
      const marker = b[i + 1] ?? 0;
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { mediaType: 'image/jpeg', width: positive(u16be(i + 7)), height: positive(u16be(i + 5)) };
      }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0xff) { i += marker === 0xff ? 1 : 2; continue; }
      i += 2 + u16be(i + 2);
    }
    return { mediaType: 'image/jpeg', width: null, height: null };
  }
  if (b.length >= 30 && ascii(0, 'RIFF') && ascii(8, 'WEBP')) {
    if (ascii(12, 'VP8 ')) return { mediaType: 'image/webp', width: positive(u16le(26) & 0x3fff), height: positive(u16le(28) & 0x3fff) };
    if (ascii(12, 'VP8L') && b.length >= 25) {
      const bits = (b[21] ?? 0) | ((b[22] ?? 0) << 8) | ((b[23] ?? 0) << 16) | ((b[24] ?? 0) << 24);
      return { mediaType: 'image/webp', width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    if (ascii(12, 'VP8X')) return { mediaType: 'image/webp', width: u24le(24) + 1, height: u24le(27) + 1 };
    return { mediaType: 'image/webp', width: null, height: null };
  }
  return null;
}

export function assetExtension(mediaType: string): string {
  return MEDIA_EXT[mediaType] ?? 'bin';
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------------------------------------------------------------------------------------------------------
// Cabeçalho SQLite (offsets do formato de arquivo: 16 page size, 18/19 versões, 60 user_version, 68 application_id)

export type SqliteHeader = {
  readonly valid: boolean; readonly pageSize: number; readonly userVersion: number; readonly applicationId: number;
  readonly writeVersion: number; readonly readVersion: number; readonly pageCount: number;
};

const SQLITE_MAGIC = 'SQLite format 3\u0000';

export function readSqliteHeader(bytes: Uint8Array): SqliteHeader {
  if (bytes.length < 100) return { valid: false, pageSize: 0, userVersion: 0, applicationId: 0, writeVersion: 0, readVersion: 0, pageCount: 0 };
  const magic = String.fromCharCode(...bytes.subarray(0, 16));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const rawPageSize = view.getUint16(16, false);
  const pageSize = rawPageSize === 1 ? 65536 : rawPageSize;
  const validPageSize = pageSize >= 512 && pageSize <= 65536 && (pageSize & (pageSize - 1)) === 0;
  return {
    valid: magic === SQLITE_MAGIC && validPageSize,
    pageSize,
    writeVersion: bytes[18] ?? 0,
    readVersion: bytes[19] ?? 0,
    pageCount: view.getUint32(28, false),
    userVersion: view.getInt32(60, false),
    applicationId: view.getInt32(68, false),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Backup completo `.sqlite3` + manifesto acompanhante (persistencia §23)

export type BackupManifest = {
  readonly format: typeof BACKUP_FORMAT;
  readonly formatVersion: typeof BACKUP_FORMAT_VERSION;
  readonly schemaVersion: number;
  readonly applicationId: number;
  readonly databaseFile: string;
  readonly databaseSha256: string;
  readonly databaseBytes: number;
  readonly createdAt: string;
  readonly appVersion: string;
  readonly sqliteVersion: string;
  readonly includesAllProfiles: true;
  readonly includesImportedAssetBytes: true;
  readonly bundledAssetsIncluded: false;
  readonly requiredContentPackages: readonly ContentPackageRef[];
};

export type BackupFiles = { readonly databaseName: string; readonly manifestName: string; readonly zipName: string };

export function backupFileNames(createdAt: string): BackupFiles {
  const base = `card-campaign-${stamp(createdAt)}`;
  return { databaseName: `${base}.sqlite3`, manifestName: `${base}.backup.json`, zipName: `${base}.backup.zip` };
}

export function buildBackupManifest(input: {
  readonly database: Uint8Array; readonly databaseSha256: string; readonly databaseFile: string; readonly createdAt: string;
  readonly appVersion: string; readonly sqliteVersion: string; readonly packages: readonly ContentPackageRef[];
}): BackupManifest {
  const header = readSqliteHeader(input.database);
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: header.userVersion,
    applicationId: header.applicationId,
    databaseFile: input.databaseFile,
    databaseSha256: input.databaseSha256,
    databaseBytes: input.database.length,
    createdAt: isoSeconds(input.createdAt),
    appVersion: input.appVersion,
    sqliteVersion: input.sqliteVersion,
    includesAllProfiles: true,
    includesImportedAssetBytes: true,
    bundledAssetsIncluded: false,
    requiredContentPackages: [...input.packages].map((p) => ({ packageId: p.packageId, version: p.version, contentHash: p.contentHash }))
      .sort((a, b) => compareText(`${a.packageId}@${a.version}`, `${b.packageId}@${b.version}`)),
  };
}

export function backupManifestBytes(manifest: BackupManifest): Uint8Array {
  return utf8(`${JSON.stringify(manifest, null, 2)}\n`);
}

/** Valida o manifesto acompanhante recebido (entrada não confiável). */
export function parseBackupManifest(bytes: Uint8Array): { readonly ok: true; readonly manifest: BackupManifest } | SavesFailure {
  try {
    const raw = obj(parseJson(bytes, 'manifesto do backup'), 'manifesto');
    if (raw.format !== BACKUP_FORMAT) reject('O manifesto não é de um backup Card Campaign.');
    const formatVersion = int(raw.formatVersion, 'formatVersion', 1);
    if (formatVersion !== BACKUP_FORMAT_VERSION) reject(`Manifesto de backup formato ${formatVersion}: este jogo lê o formato ${BACKUP_FORMAT_VERSION}.`, 'FUTURE_VERSION', 'SAVE_VERSION_UNSUPPORTED');
    const packages = arr(raw.requiredContentPackages, 'requiredContentPackages', 64).map((p, i) => packageRef(p, `requiredContentPackages[${i}]`));
    const manifest: BackupManifest = {
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_FORMAT_VERSION,
      schemaVersion: int(raw.schemaVersion, 'schemaVersion', 0),
      applicationId: int(raw.applicationId, 'applicationId', -2147483648, 4294967295),
      databaseFile: str(raw.databaseFile, 'databaseFile', 200),
      databaseSha256: hex64(raw.databaseSha256, 'databaseSha256'),
      databaseBytes: int(raw.databaseBytes, 'databaseBytes', 0),
      createdAt: str(raw.createdAt, 'createdAt', 40),
      appVersion: str(raw.appVersion, 'appVersion', 40),
      sqliteVersion: str(raw.sqliteVersion, 'sqliteVersion', 80),
      includesAllProfiles: true,
      includesImportedAssetBytes: true,
      bundledAssetsIncluded: false,
      requiredContentPackages: packages,
    };
    return { ok: true, manifest };
  } catch (error) {
    return asFailure(error);
  }
}

/** Confere tamanho e SHA-256 dos bytes recebidos contra o manifesto, antes de abrir o banco (persistencia §23, §25.1). */
export function checkBackupTransport(database: Uint8Array, manifest: BackupManifest, sha256: string): SavesFailure | null {
  if (database.length !== manifest.databaseBytes) {
    return savesFailure('IMPORT_INVALID', `O banco tem ${database.length} bytes, mas o manifesto declara ${manifest.databaseBytes}.`, 'CHECKSUM_MISMATCH');
  }
  if (sha256 !== manifest.databaseSha256) return savesFailure('IMPORT_INVALID', 'O SHA-256 do banco não confere com o manifesto: o arquivo foi alterado ou danificado.', 'CHECKSUM_MISMATCH');
  return null;
}

/** Disponibilidade de pacotes exigidos por um backup ou perfil: exato, ausente ou com outro hash. */
export function comparePackages(required: readonly ContentPackageRef[], available: readonly ContentPackageRef[]): {
  readonly missing: readonly ContentPackageRef[]; readonly conflicting: readonly ContentPackageRef[];
} {
  const byKey = new Map<string, Set<string>>();
  for (const p of available) byKey.set(`${p.packageId}@${p.version}`, (byKey.get(`${p.packageId}@${p.version}`) ?? new Set()).add(p.contentHash));
  const missing: ContentPackageRef[] = [];
  const conflicting: ContentPackageRef[] = [];
  for (const p of required) {
    const hashes = byKey.get(`${p.packageId}@${p.version}`);
    if (!hashes) missing.push(p);
    else if (!hashes.has(p.contentHash)) conflicting.push(p);
  }
  return { missing, conflicting };
}

/** Pacotes disponíveis para esta instalação: os do banco atual e o pacote BASE carregado pelo jogo. */
export async function availablePackages(ctx: Pick<SavesContext, 'storage'>, content: ContentIndex | null): Promise<ContentPackageRef[]> {
  const installed = await ctx.storage.query({ kind: 'LIST_CONTENT_PACKAGES' });
  const out = installed.map((p) => ({ packageId: p.packageId, version: p.version, contentHash: p.contentHash }));
  if (content) out.push({ packageId: content.bundle.packageId, version: content.bundle.version, contentHash: content.bundle.contentHash });
  return out;
}

export type FullBackup = { readonly database: Uint8Array; readonly manifest: BackupManifest; readonly files: BackupFiles };

/**
 * Backup completo da instalação (persistencia §23): espera a fila de comandos esvaziar, registra
 * `app_meta.appVersion`, exporta pelo Storage Worker (sqlite3_serialize entre transações) e mede bytes/SHA-256.
 */
export async function exportFullBackup(
  ctx: SavesContext,
  options: { readonly appVersion: string; readonly sha256?: (bytes: Uint8Array) => Promise<string> },
): Promise<{ readonly ok: true; readonly backup: FullBackup } | SavesFailure> {
  if (!(await waitForIdle(ctx.bus))) return savesFailure('SAVE_WRITE_FAILED', 'Ainda há uma gravação em andamento. Tente exportar de novo em instantes.');
  try {
    const meta = await ctx.storage.write({ kind: 'SET_APP_META', key: 'appVersion', value: options.appVersion });
    if (!meta.ok) return savesFailure(meta.code, meta.message);
    const diagnostics = await ctx.storage.query({ kind: 'DIAGNOSTICS', deep: false });
    const packages = (await ctx.storage.query({ kind: 'LIST_CONTENT_PACKAGES' })).filter((p) => p.origin === 'BASE');
    const database = await ctx.storage.exportDatabase();
    const createdAt = ctx.platform.now();
    const files = backupFileNames(createdAt);
    const digest = options.sha256 ? await options.sha256(database) : sha256Hex(database);
    const manifest = buildBackupManifest({
      database, databaseSha256: digest, databaseFile: files.databaseName, createdAt, appVersion: options.appVersion,
      sqliteVersion: diagnostics.sqliteVersion, packages,
    });
    return { ok: true, backup: { database, manifest, files } };
  } catch (error) {
    const code = (error as { code?: StorageErrorCode } | null)?.code ?? 'SAVE_WRITE_FAILED';
    return savesFailure(code, `Não foi possível exportar o backup: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ---------------------------------------------------------------------------------------------------------
// Perfil portátil `.campaign-profile.zip` formato 4 (persistencia §24.1)

/** Entrada de `manifest.assets` exatamente como persistencia §24.1 (dimensões são re-derivadas dos bytes). */
export type ProfileArchiveAsset = { readonly sha256: string; readonly bytes: number; readonly mediaType: string };

export type ProfileArchiveManifest = {
  readonly format: typeof PROFILE_FORMAT;
  readonly formatVersion: typeof PROFILE_FORMAT_VERSION;
  readonly exportedAt: string;
  readonly appVersion: string;
  readonly profileId: string;
  readonly contentRefs: {
    readonly packages: readonly ContentPackageRef[];
    readonly cardVersions: readonly { readonly definitionId: string; readonly version: number; readonly rulesHash: string }[];
  };
  readonly assets: readonly ProfileArchiveAsset[];
};

export type ArchiveFile = { readonly name: string; readonly bytes: Uint8Array; readonly compress: boolean };

export const PROFILE_ARCHIVE_FILES = {
  manifest: 'manifest.json',
  profile: 'profile.json',
  cardVersions: 'content/card-versions.json',
  printings: 'content/printings.json',
  projects: 'content/projects.json',
} as const;

const ASSET_ENTRY = /^assets\/([0-9a-f]{64})\.(png|jpg|webp)$/;

/** Allowlist de entradas do ZIP de perfil (qualquer outra recusa o arquivo inteiro). */
export function isProfileArchiveEntry(name: string): boolean {
  return Object.values(PROFILE_ARCHIVE_FILES).includes(name as never) || ASSET_ENTRY.test(name);
}

export function profileArchiveFileName(displayName: string, exportedAt: string): string {
  return `${slug(displayName)}-${isoSeconds(exportedAt).slice(0, 10)}.campaign-profile.zip`;
}

/** Resumo informativo dos livros-razão (o arquivo também leva as entradas completas). */
function ledgerSummary(rows: ProfileRowsV4): JsonValue {
  const wallets = rows.wallets.map((w) => {
    const entries = rows.walletEntries.filter((e) => e.resourceId === w.resourceId);
    return {
      resourceId: w.resourceId, balance: w.balance, entries: entries.length,
      credited: entries.filter((e) => e.delta > 0).reduce((s, e) => s + e.delta, 0),
      debited: entries.filter((e) => e.delta < 0).reduce((s, e) => s - e.delta, 0),
    };
  });
  const credited = rows.inventoryEntries.filter((e) => e.delta > 0).reduce((s, e) => s + e.delta, 0);
  const debited = rows.inventoryEntries.filter((e) => e.delta < 0).reduce((s, e) => s - e.delta, 0);
  return { wallets, inventory: { printings: rows.inventory.length, copies: rows.inventory.reduce((s, i) => s + i.quantity, 0), entries: rows.inventoryEntries.length, credited, debited } };
}

/** Monta as entradas do ZIP a partir da leitura PROFILE_EXPORT (função pura). */
export function buildProfileArchive(data: ProfileExportData, options: { readonly appVersion: string; readonly exportedAt: string }): {
  readonly manifest: ProfileArchiveManifest; readonly files: readonly ArchiveFile[];
} {
  const { projects, ...profileRows } = data.rows;
  const assets = [...data.content.assets].sort((a, b) => compareText(a.assetId, b.assetId));
  const manifest: ProfileArchiveManifest = {
    format: PROFILE_FORMAT,
    formatVersion: PROFILE_FORMAT_VERSION,
    exportedAt: isoSeconds(options.exportedAt),
    appVersion: options.appVersion,
    profileId: data.profileId,
    contentRefs: {
      packages: data.packages.map((p) => ({ packageId: p.packageId, version: p.version, contentHash: p.contentHash })),
      cardVersions: data.content.versions.map((v) => ({ definitionId: v.definitionId, version: v.version, rulesHash: v.rulesHash })),
    },
    assets: assets.map((a) => ({ sha256: a.assetId, bytes: a.bytes.length, mediaType: a.mediaType })),
  };
  const profileDocument = { ...profileRows, ledgerSummary: ledgerSummary(data.rows), bundledAssetIds: [...data.bundledAssetIds] };
  const files: ArchiveFile[] = [
    { name: PROFILE_ARCHIVE_FILES.manifest, bytes: jsonBytes(manifest), compress: true },
    { name: PROFILE_ARCHIVE_FILES.profile, bytes: jsonBytes(profileDocument), compress: true },
    { name: PROFILE_ARCHIVE_FILES.cardVersions, bytes: jsonBytes({ definitions: data.content.definitions, versions: data.content.versions, catalogHeads: data.content.catalogHeads }), compress: true },
    { name: PROFILE_ARCHIVE_FILES.printings, bytes: jsonBytes({ printings: data.content.printings }), compress: true },
    { name: PROFILE_ARCHIVE_FILES.projects, bytes: jsonBytes({ projects }), compress: true },
    ...assets.map((a) => ({ name: `assets/${a.assetId}.${assetExtension(a.mediaType)}`, bytes: a.bytes, compress: false })),
  ];
  return { manifest, files };
}

/** Exporta um perfil (inclusive arquivado) como entradas do `.campaign-profile.zip`, depois de drenar a fila. */
export async function exportProfileArchive(ctx: SavesContext, profileId: string, options: { readonly appVersion: string }): Promise<
  { readonly ok: true; readonly manifest: ProfileArchiveManifest; readonly files: readonly ArchiveFile[]; readonly fileName: string } | SavesFailure
> {
  if (!(await waitForIdle(ctx.bus))) return savesFailure('SAVE_WRITE_FAILED', 'Ainda há uma gravação em andamento. Tente exportar de novo em instantes.');
  try {
    const data = await ctx.storage.query({ kind: 'PROFILE_EXPORT', profileId });
    if (!data) return savesFailure('NOT_FOUND', 'Perfil não encontrado neste banco.');
    const exportedAt = ctx.platform.now();
    const name = data.rows.settings.find((s) => s.key === 'displayNameOverride')?.value;
    const display = typeof name === 'string' && name.trim() ? name : data.rows.profile.displayName;
    const built = buildProfileArchive(data, { appVersion: options.appVersion, exportedAt });
    return { ok: true, ...built, fileName: profileArchiveFileName(display, exportedAt) };
  } catch (error) {
    const code = (error as { code?: StorageErrorCode } | null)?.code ?? 'SAVE_WRITE_FAILED';
    return savesFailure(code, `Não foi possível exportar o perfil: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ---------------------------------------------------------------------------------------------------------
// Leitura validada de um perfil portátil (entrada não confiável)

const MAX_ROWS = 2_000_000;
const MAX_JSON_DEPTH = 64;
const ISO_LIKE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;
const HEX = /^[0-9a-f]{64}$/;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/;

type Obj = Record<string, unknown>;

function parseJson(bytes: Uint8Array, what: string): unknown {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return reject(`${what}: não está em UTF-8.`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return reject(`${what}: JSON malformado.`);
  }
}

function obj(v: unknown, path: string): Obj {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) reject(`${path}: objeto esperado.`);
  return v as Obj;
}

function str(v: unknown, path: string, max = 512, min = 1): string {
  if (typeof v !== 'string' || v.length < min || v.length > max) reject(`${path}: texto inválido.`);
  return v;
}

function ident(v: unknown, path: string): string {
  const s = str(v, path, 200);
  if (CONTROL.test(s)) reject(`${path}: identificador com caractere de controle.`);
  return s;
}

function identOrNull(v: unknown, path: string): string | null {
  return v === null ? null : ident(v, path);
}

function int(v: unknown, path: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < min || v > max) reject(`${path}: inteiro inválido.`);
  return v;
}

function intOrNull(v: unknown, path: string, min = 0, max = Number.MAX_SAFE_INTEGER): number | null {
  return v === null ? null : int(v, path, min, max);
}

function bool(v: unknown, path: string): boolean {
  if (typeof v !== 'boolean') reject(`${path}: booleano esperado.`);
  return v;
}

function oneOf<T extends string>(v: unknown, path: string, values: readonly T[]): T {
  if (typeof v !== 'string' || !values.includes(v as T)) reject(`${path}: valor fora de ${values.join('/')}.`);
  return v as T;
}

function arr(v: unknown, path: string, max = MAX_ROWS): unknown[] {
  if (!Array.isArray(v) || v.length > max) reject(`${path}: lista inválida ou longa demais.`);
  return v;
}

function hex64(v: unknown, path: string): string {
  if (typeof v !== 'string' || !HEX.test(v)) reject(`${path}: SHA-256 hex minúsculo esperado.`);
  return v;
}

function time(v: unknown, path: string): string {
  const s = str(v, path, 40);
  if (!ISO_LIKE.test(s)) reject(`${path}: data ISO 8601 esperada.`);
  return s;
}

function json(v: unknown, path: string, depth = 0): JsonValue {
  if (depth > MAX_JSON_DEPTH) reject(`${path}: JSON aninhado demais.`);
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return v;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) reject(`${path}: número não finito.`);
    return v;
  }
  if (Array.isArray(v)) {
    v.forEach((x, i) => json(x, `${path}[${i}]`, depth + 1));
    return v as JsonValue;
  }
  if (typeof v === 'object') {
    for (const [k, x] of Object.entries(v as Obj)) json(x, `${path}.${k}`, depth + 1);
    return v as JsonValue;
  }
  return reject(`${path}: valor não serializável.`);
}

function packageRef(v: unknown, path: string): ContentPackageRef {
  const o = obj(v, path);
  return { packageId: ident(o.packageId, `${path}.packageId`), version: str(o.version, `${path}.version`, 40), contentHash: hex64(o.contentHash, `${path}.contentHash`) };
}

function uniqueOrReject(values: readonly string[], what: string): void {
  const seen = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) reject(`${what} duplicado: ${v}.`);
    seen.add(v);
  }
}

const ATTEMPT_MODES = ['CAMPAIGN', 'ARENA', 'TRAINING', 'CUSTOM', 'LAB'] as const;
const ATTEMPT_STATUS = ['RUNNING', 'SUSPENDED', 'FINISHED', 'ABANDONED'] as const;
const DIFFICULTIES = ['STORY', 'STANDARD', 'EXPERT'] as const;
const ASSET_ROLES = ['ART_MASTER', 'FRONT_COMPOSITE', 'FOIL_MASK', 'NORMAL_MAP', 'ROUGHNESS_MAP', 'BACK_DEFAULT', 'IMMERSIVE_SCENE'] as const;

function readDeck(v: unknown, path: string): PortableDeck {
  const o = obj(v, path);
  const versions = arr(o.versions, `${path}.versions`, 100_000).map((x, i) => {
    const r = obj(x, `${path}.versions[${i}]`);
    const entries = arr(r.entries, `${path}.versions[${i}].entries`, 20).map((e, j) => {
      const q = obj(e, `${path}.versions[${i}].entries[${j}]`);
      return { entryNo: int(q.entryNo, `${path}...entryNo`, 1, 20), printingId: ident(q.printingId, `${path}...printingId`), entryFlairId: identOrNull(q.entryFlairId ?? null, `${path}...entryFlairId`) };
    });
    uniqueOrReject(entries.map((e) => String(e.entryNo)), `${path}: posição de deck`);
    const energyTypes = json(r.energyTypes, `${path}.energyTypes`);
    if (!Array.isArray(energyTypes) || energyTypes.some((t) => typeof t !== 'string')) reject(`${path}.energyTypes: lista de tipos esperada.`);
    return {
      revision: int(r.revision, `${path}.revision`, 1), status: oneOf(r.status, `${path}.status`, ['DRAFT', 'CONFIRMED'] as const),
      energyTypes, validation: json(r.validation, `${path}.validation`), createdAt: time(r.createdAt, `${path}.createdAt`), entries,
    };
  });
  uniqueOrReject(versions.map((x) => String(x.revision)), `${path}: revisão de deck`);
  const headRevision = int(o.headRevision, `${path}.headRevision`);
  if (headRevision > 0 && !versions.some((x) => x.revision === headRevision)) reject(`${path}: head ${headRevision} sem revisão correspondente.`);
  return { deckId: ident(o.deckId, `${path}.deckId`), name: str(o.name, `${path}.name`, 60), headRevision, archived: bool(o.archived, `${path}.archived`), createdAt: time(o.createdAt, `${path}.createdAt`), versions };
}

function readAttempt(v: unknown, path: string): PortableAttempt {
  const o = obj(v, path);
  const events = arr(o.events, `${path}.events`).map((x, i) => {
    const e = obj(x, `${path}.events[${i}]`);
    return { seq: int(e.seq, `${path}.events.seq`, 1), operationRevision: int(e.operationRevision, `${path}.events.operationRevision`, 1), stateVersion: int(e.stateVersion, `${path}.events.stateVersion`), type: str(e.type, `${path}.events.type`, 80), event: json(e.event, `${path}.events.event`) };
  });
  uniqueOrReject(events.map((e) => String(e.seq)), `${path}: sequência de evento`);
  const checkpoints = arr(o.checkpoints, `${path}.checkpoints`).map((x, i) => {
    const c = obj(x, `${path}.checkpoints[${i}]`);
    const snapshot = json(c.snapshot, `${path}.checkpoints.snapshot`);
    const snapshotHash = hex64(c.snapshotHash, `${path}.checkpoints.snapshotHash`);
    if (jcsHash(snapshot) !== snapshotHash) reject(`${path}: checkpoint com snapshot_hash divergente.`, 'CHECKSUM_MISMATCH');
    return { stateVersion: int(c.stateVersion, `${path}.checkpoints.stateVersion`), lastEventSequence: int(c.lastEventSequence, `${path}.checkpoints.lastEventSequence`), snapshot, snapshotHash, createdAt: time(c.createdAt, `${path}.checkpoints.createdAt`) };
  });
  uniqueOrReject(checkpoints.map((c) => String(c.stateVersion)), `${path}: checkpoint`);
  const status = oneOf(o.status, `${path}.status`, ATTEMPT_STATUS);
  const result = o.result === null ? null : json(o.result, `${path}.result`);
  if ((status === 'FINISHED' || status === 'ABANDONED') !== (result !== null)) reject(`${path}: resultado incoerente com o status ${status}.`);
  return {
    attemptId: ident(o.attemptId, `${path}.attemptId`), mode: oneOf(o.mode, `${path}.mode`, ATTEMPT_MODES), status,
    campaignId: identOrNull(o.campaignId, `${path}.campaignId`), nodeId: identOrNull(o.nodeId, `${path}.nodeId`),
    difficulty: o.difficulty === null ? null : oneOf(o.difficulty, `${path}.difficulty`, DIFFICULTIES),
    deckId: identOrNull(o.deckId, `${path}.deckId`), deckRevision: intOrNull(o.deckRevision, `${path}.deckRevision`, 1),
    progressionEligible: bool(o.progressionEligible, `${path}.progressionEligible`), stateVersion: int(o.stateVersion, `${path}.stateVersion`),
    rulesetId: str(o.rulesetId, `${path}.rulesetId`, 80), engineVersion: str(o.engineVersion, `${path}.engineVersion`, 80),
    contentFingerprint: str(o.contentFingerprint, `${path}.contentFingerprint`, 200), state: json(o.state, `${path}.state`), rng: json(o.rng, `${path}.rng`),
    presentationSnapshot: json(o.presentationSnapshot, `${path}.presentationSnapshot`), result,
    createdAt: time(o.createdAt, `${path}.createdAt`), updatedAt: time(o.updatedAt, `${path}.updatedAt`),
    cardRefs: arr(o.cardRefs, `${path}.cardRefs`).map((x) => ident(x, `${path}.cardRefs`)),
    assetRefs: arr(o.assetRefs, `${path}.assetRefs`).map((x) => hex64(x, `${path}.assetRefs`)),
    events, checkpoints,
  };
}

function readProject(v: unknown, path: string): PortableProject {
  const o = obj(v, path);
  const revisions = arr(o.revisions, `${path}.revisions`, 100_000).map((x, i) => {
    const r = obj(x, `${path}.revisions[${i}]`);
    return {
      revision: int(r.revision, `${path}.revision`, 1), kind: oneOf(r.kind, `${path}.kind`, ['AUTO', 'MANUAL', 'PUBLISHED'] as const),
      draft: json(r.draft, `${path}.draft`), validationSummary: json(r.validationSummary, `${path}.validationSummary`), createdAt: time(r.createdAt, `${path}.createdAt`),
      assetRefs: arr(r.assetRefs, `${path}.assetRefs`, 64).map((a, j) => {
        const q = obj(a, `${path}.assetRefs[${j}]`);
        return { role: str(q.role, `${path}.assetRefs.role`, 40), assetId: hex64(q.assetId, `${path}.assetRefs.assetId`) };
      }),
    };
  });
  uniqueOrReject(revisions.map((r) => String(r.revision)), `${path}: revisão de projeto`);
  const headRevision = int(o.headRevision, `${path}.headRevision`);
  if (headRevision > 0 && !revisions.some((r) => r.revision === headRevision)) reject(`${path}: head ${headRevision} sem revisão retida.`);
  const testRuns = arr(o.testRuns, `${path}.testRuns`).map((x, i) => {
    const t = obj(x, `${path}.testRuns[${i}]`);
    const revision = int(t.revision, `${path}.testRuns.revision`, 1);
    if (!revisions.some((r) => r.revision === revision)) reject(`${path}: teste aponta para revisão ${revision} ausente.`);
    return {
      runId: ident(t.runId, `${path}.testRuns.runId`), revision, runnerVersion: str(t.runnerVersion, `${path}.testRuns.runnerVersion`, 80),
      rulesHash: hex64(t.rulesHash, `${path}.testRuns.rulesHash`), scenario: json(t.scenario, `${path}.testRuns.scenario`), result: json(t.result, `${path}.testRuns.result`),
      outcome: oneOf(t.outcome, `${path}.testRuns.outcome`, ['PASS', 'FAIL', 'ERROR'] as const), createdAt: time(t.createdAt, `${path}.testRuns.createdAt`),
    };
  });
  return {
    projectId: ident(o.projectId, `${path}.projectId`), title: str(o.title, `${path}.title`, 60), mode: oneOf(o.mode, `${path}.mode`, ['NEW_DEFINITION', 'NEW_VERSION', 'VARIANT', 'FORK'] as const),
    status: oneOf(o.status, `${path}.status`, ['DRAFT', 'ARCHIVED'] as const), headRevision, targetDefinitionId: identOrNull(o.targetDefinitionId, `${path}.targetDefinitionId`),
    sourceDefinitionId: identOrNull(o.sourceDefinitionId, `${path}.sourceDefinitionId`), sourceVersion: intOrNull(o.sourceVersion, `${path}.sourceVersion`, 1),
    createdAt: time(o.createdAt, `${path}.createdAt`), updatedAt: time(o.updatedAt, `${path}.updatedAt`), revisions, testRuns,
  };
}

function readRows(doc: Obj, projects: readonly PortableProject[]): ProfileRowsV4 {
  const p = obj(doc.profile, 'profile');
  const opRev = (v: unknown, path: string) => int(v, path, 1);
  const rows: ProfileRowsV4 = {
    profile: {
      displayName: str(p.displayName, 'profile.displayName', 40).trim() || reject('profile.displayName vazio.'),
      progressionMode: oneOf(p.progressionMode, 'profile.progressionMode', ['STANDARD', 'CUSTOM', 'LAB'] as const),
      revision: int(p.revision, 'profile.revision'), rng: json(p.rng, 'profile.rng'), createdAt: time(p.createdAt, 'profile.createdAt'),
      updatedAt: time(p.updatedAt, 'profile.updatedAt'), archived: bool(p.archived, 'profile.archived'),
    },
    settings: arr(doc.settings, 'settings', 500).map((x, i) => {
      const s = obj(x, `settings[${i}]`);
      return { key: str(s.key, 'settings.key', 120), value: json(s.value, `settings.${String(s.key)}`) };
    }),
    operations: arr(doc.operations, 'operations').map((x, i) => {
      const o = obj(x, `operations[${i}]`);
      return {
        committedRevision: int(o.committedRevision, 'operations.committedRevision', 1), commandId: ident(o.commandId, 'operations.commandId'),
        commandType: str(o.commandType, 'operations.commandType', 60), payloadHash: hex64(o.payloadHash, 'operations.payloadHash'),
        receipt: json(o.receipt, 'operations.receipt'), committedAt: time(o.committedAt, 'operations.committedAt'),
      };
    }),
    wallets: arr(doc.wallets, 'wallets', 10_000).map((x, i) => {
      const w = obj(x, `wallets[${i}]`);
      const resourceId = str(w.resourceId, 'wallets.resourceId', 120);
      if (resourceId !== 'CREDITS' && !resourceId.startsWith('PACK:')) reject(`wallets: recurso ${resourceId} desconhecido.`);
      return { resourceId, balance: int(w.balance, 'wallets.balance', 0, 1_000_000_000) };
    }),
    walletEntries: arr(doc.walletEntries, 'walletEntries').map((x, i) => {
      const e = obj(x, `walletEntries[${i}]`);
      return { operationRevision: opRev(e.operationRevision, 'walletEntries.operationRevision'), entryNo: int(e.entryNo, 'walletEntries.entryNo'), resourceId: str(e.resourceId, 'walletEntries.resourceId', 120), delta: int(e.delta, 'walletEntries.delta', -1_000_000_000, 1_000_000_000), balanceAfter: int(e.balanceAfter, 'walletEntries.balanceAfter', 0, 1_000_000_000) };
    }),
    inventory: arr(doc.inventory, 'inventory').map((x, i) => {
      const q = obj(x, `inventory[${i}]`);
      return { printingId: ident(q.printingId, 'inventory.printingId'), quantity: int(q.quantity, 'inventory.quantity', 0, 1_000_000) };
    }),
    inventoryEntries: arr(doc.inventoryEntries, 'inventoryEntries').map((x, i) => {
      const e = obj(x, `inventoryEntries[${i}]`);
      return { operationRevision: opRev(e.operationRevision, 'inventoryEntries.operationRevision'), entryNo: int(e.entryNo, 'inventoryEntries.entryNo'), printingId: ident(e.printingId, 'inventoryEntries.printingId'), delta: int(e.delta, 'inventoryEntries.delta', -1_000_000, 1_000_000), quantityAfter: int(e.quantityAfter, 'inventoryEntries.quantityAfter', 0, 1_000_000) };
    }),
    rewardGrants: arr(doc.rewardGrants, 'rewardGrants').map((x, i) => {
      const g = obj(x, `rewardGrants[${i}]`);
      return { grantKey: str(g.grantKey, 'rewardGrants.grantKey', 300), operationRevision: opRev(g.operationRevision, 'rewardGrants.operationRevision'), grantedAt: time(g.grantedAt, 'rewardGrants.grantedAt') };
    }),
    pendingRewards: arr(doc.pendingRewards, 'pendingRewards').map((x, i) => {
      const r = obj(x, `pendingRewards[${i}]`);
      const status = oneOf(r.status, 'pendingRewards.status', ['PENDING', 'CLAIMED'] as const);
      const choice = r.choice === null ? null : json(r.choice, 'pendingRewards.choice');
      const operationRevision = r.operationRevision === null ? null : opRev(r.operationRevision, 'pendingRewards.operationRevision');
      if ((status === 'CLAIMED') !== (choice !== null && operationRevision !== null)) reject(`pendingRewards[${i}]: escolha incoerente com o status.`);
      return {
        rewardId: ident(r.rewardId, 'pendingRewards.rewardId'), grantKey: str(r.grantKey, 'pendingRewards.grantKey', 300), status, options: json(r.options, 'pendingRewards.options'), choice,
        sourceOperationRevision: opRev(r.sourceOperationRevision, 'pendingRewards.sourceOperationRevision'), sourceAttemptId: identOrNull(r.sourceAttemptId, 'pendingRewards.sourceAttemptId'),
        operationRevision, createdAt: time(r.createdAt, 'pendingRewards.createdAt'),
      };
    }),
    entitlements: arr(doc.entitlements, 'entitlements').map((x, i) => {
      const e = obj(x, `entitlements[${i}]`);
      return { cosmeticId: ident(e.cosmeticId, 'entitlements.cosmeticId'), origin: oneOf(e.origin, 'entitlements.origin', ['ONBOARDING', 'PURCHASE', 'MILESTONE', 'CUSTOM_GRANT'] as const), operationRevision: opRev(e.operationRevision, 'entitlements.operationRevision'), acquiredAt: time(e.acquiredAt, 'entitlements.acquiredAt') };
    }),
    decks: arr(doc.decks, 'decks', 10_000).map((x, i) => readDeck(x, `decks[${i}]`)),
    deckAppearance: arr(doc.deckAppearance, 'deckAppearance', 10_000).map((x, i) => {
      const a = obj(x, `deckAppearance[${i}]`);
      const mode = oneOf(a.mode, 'deckAppearance.mode', ['INHERIT_PROFILE', 'OVERRIDE'] as const);
      const presetId = identOrNull(a.presetId, 'deckAppearance.presetId');
      const presetRevision = intOrNull(a.presetRevision, 'deckAppearance.presetRevision', 1);
      if ((mode === 'OVERRIDE') !== (presetId !== null && presetRevision !== null)) reject(`deckAppearance[${i}]: preset incoerente com o modo.`);
      return { deckId: ident(a.deckId, 'deckAppearance.deckId'), mode, presetId, presetRevision };
    }),
    profileAppearance: doc.profileAppearance === null || doc.profileAppearance === undefined ? null : (() => {
      const a = obj(doc.profileAppearance, 'profileAppearance');
      return { presetId: ident(a.presetId, 'profileAppearance.presetId'), presetRevision: int(a.presetRevision, 'profileAppearance.presetRevision', 1) };
    })(),
    campaignProgress: arr(doc.campaignProgress, 'campaignProgress', 100_000).map((x, i) => {
      const c = obj(x, `campaignProgress[${i}]`);
      return { campaignId: ident(c.campaignId, 'campaignProgress.campaignId'), nodeId: ident(c.nodeId, 'campaignProgress.nodeId'), campaignVersion: str(c.campaignVersion, 'campaignProgress.campaignVersion', 40), status: oneOf(c.status, 'campaignProgress.status', ['LOCKED', 'AVAILABLE', 'CLEARED'] as const), progress: json(c.progress, 'campaignProgress.progress'), updatedAt: time(c.updatedAt, 'campaignProgress.updatedAt') };
    }),
    attempts: arr(doc.attempts, 'attempts', 200_000).map((x, i) => readAttempt(x, `attempts[${i}]`)),
    replays: arr(doc.replays, 'replays', 200_000).map((x, i) => {
      const r = obj(x, `replays[${i}]`);
      return { replayId: ident(r.replayId, 'replays.replayId'), attemptId: ident(r.attemptId, 'replays.attemptId'), metadata: json(r.metadata, 'replays.metadata'), createdAt: time(r.createdAt, 'replays.createdAt') };
    }),
    cosmeticPresets: arr(doc.cosmeticPresets, 'cosmeticPresets', 100_000).map((x, i) => {
      const c = obj(x, `cosmeticPresets[${i}]`);
      return { presetId: ident(c.presetId, 'cosmeticPresets.presetId'), revision: int(c.revision, 'cosmeticPresets.revision', 1), config: json(c.config, 'cosmeticPresets.config'), createdAt: time(c.createdAt, 'cosmeticPresets.createdAt'), assetIds: arr(c.assetIds, 'cosmeticPresets.assetIds', 64).map((a) => hex64(a, 'cosmeticPresets.assetIds')) };
    }),
    appearanceDrafts: arr(doc.appearanceDrafts, 'appearanceDrafts', 1_000).map((x, i) => {
      const d = obj(x, `appearanceDrafts[${i}]`);
      return { contextId: ident(d.contextId, 'appearanceDrafts.contextId'), revision: int(d.revision, 'appearanceDrafts.revision', 1), draft: json(d.draft, 'appearanceDrafts.draft'), assetIds: arr(d.assetIds, 'appearanceDrafts.assetIds', 64).map((a) => hex64(a, 'appearanceDrafts.assetIds')) };
    }),
    binders: arr(doc.binders, 'binders', 10_000).map((x, i) => {
      const b = obj(x, `binders[${i}]`);
      const slots = arr(b.slots, 'binders.slots', 2_400).map((s, j) => {
        const q = obj(s, `binders[${i}].slots[${j}]`);
        return { pageNo: int(q.pageNo, 'binders.slots.pageNo', 1, 200), slotNo: int(q.slotNo, 'binders.slots.slotNo', 1, 12), printingId: ident(q.printingId, 'binders.slots.printingId') };
      });
      uniqueOrReject(slots.map((s) => `${s.pageNo}:${s.slotNo}`), `binders[${i}]: posição`);
      return { binderId: ident(b.binderId, 'binders.binderId'), name: str(b.name, 'binders.name', 60), kind: oneOf(b.kind, 'binders.kind', ['BINDER', 'SHOWCASE'] as const), layout: json(b.layout, 'binders.layout'), sortOrder: int(b.sortOrder, 'binders.sortOrder', -1_000_000, 1_000_000), archived: bool(b.archived, 'binders.archived'), createdAt: time(b.createdAt, 'binders.createdAt'), updatedAt: time(b.updatedAt, 'binders.updatedAt'), slots };
    }),
    collectionMarks: arr(doc.collectionMarks, 'collectionMarks').map((x, i) => {
      const m = obj(x, `collectionMarks[${i}]`);
      return { markKind: oneOf(m.markKind, 'collectionMarks.markKind', ['FAVORITE', 'WISHLIST', 'SEEN'] as const), subjectKind: oneOf(m.subjectKind, 'collectionMarks.subjectKind', ['PRINTING', 'DEFINITION'] as const), subjectId: ident(m.subjectId, 'collectionMarks.subjectId'), createdAt: time(m.createdAt, 'collectionMarks.createdAt') };
    }),
    projects,
  };
  checkRowCoherence(rows);
  return rows;
}

/** Coerência interna (antes do banco): revisões contíguas, livros-razão, referências entre linhas do próprio perfil. */
function checkRowCoherence(rows: ProfileRowsV4): void {
  const n = rows.operations.length;
  rows.operations.forEach((o, i) => { if (o.committedRevision !== i + 1) reject('operations: revisões precisam ser 1..N em ordem.'); });
  if (rows.profile.revision !== n) reject(`profile.revision ${rows.profile.revision} difere do número de operações (${n}).`);
  uniqueOrReject(rows.operations.map((o) => o.commandId), 'commandId');
  const okRev = (rev: number | null, what: string) => { if (rev !== null && rev > n) reject(`${what}: operação ${rev} inexistente.`); };
  rows.walletEntries.forEach((e) => okRev(e.operationRevision, 'walletEntries'));
  rows.inventoryEntries.forEach((e) => okRev(e.operationRevision, 'inventoryEntries'));
  rows.rewardGrants.forEach((g) => okRev(g.operationRevision, 'rewardGrants'));
  rows.entitlements.forEach((e) => okRev(e.operationRevision, 'entitlements'));
  rows.pendingRewards.forEach((r) => { okRev(r.sourceOperationRevision, 'pendingRewards'); okRev(r.operationRevision, 'pendingRewards'); });
  rows.attempts.forEach((a) => a.events.forEach((e) => okRev(e.operationRevision, 'battle_events')));

  uniqueOrReject(rows.settings.map((s) => s.key), 'Preferência');
  uniqueOrReject(rows.wallets.map((w) => w.resourceId), 'Recurso de carteira');
  uniqueOrReject(rows.inventory.map((i) => i.printingId), 'Item de inventário');
  uniqueOrReject(rows.rewardGrants.map((g) => g.grantKey), 'Concessão');
  uniqueOrReject(rows.pendingRewards.map((r) => r.rewardId), 'Prêmio pendente');
  uniqueOrReject(rows.pendingRewards.map((r) => r.grantKey), 'Chave de prêmio pendente');
  uniqueOrReject(rows.entitlements.map((e) => e.cosmeticId), 'Cosmético');
  uniqueOrReject(rows.decks.map((d) => d.deckId), 'Deck');
  uniqueOrReject(rows.deckAppearance.map((d) => d.deckId), 'Aparência de deck');
  uniqueOrReject(rows.campaignProgress.map((c) => `${c.campaignId}/${c.nodeId}`), 'Progresso de nó');
  uniqueOrReject(rows.attempts.map((a) => a.attemptId), 'Tentativa');
  uniqueOrReject(rows.replays.map((r) => r.replayId), 'Replay');
  uniqueOrReject(rows.replays.map((r) => r.attemptId), 'Replay por tentativa');
  uniqueOrReject(rows.cosmeticPresets.map((p) => `${p.presetId}@${p.revision}`), 'Preset');
  uniqueOrReject(rows.appearanceDrafts.map((d) => d.contextId), 'Rascunho da oficina');
  uniqueOrReject(rows.binders.map((b) => b.binderId), 'Fichário');
  uniqueOrReject(rows.collectionMarks.map((m) => `${m.markKind}/${m.subjectKind}/${m.subjectId}`), 'Marca de coleção');
  uniqueOrReject(rows.projects.map((p) => p.projectId), 'Projeto');
  uniqueOrReject(rows.projects.flatMap((p) => p.testRuns.map((t) => t.runId)), 'Execução de teste');

  // Livros-razão: saldo final = último saldo do histórico; cada passo soma o delta (persistencia §14).
  const ledger = <T extends { operationRevision: number; entryNo: number; delta: number }>(entries: readonly T[], key: (e: T) => string, after: (e: T) => number, final: Map<string, number>, what: string) => {
    uniqueOrReject(entries.map((e) => `${e.operationRevision}#${e.entryNo}`), `${what}: entrada`);
    const sorted = [...entries].sort((a, b) => a.operationRevision - b.operationRevision || a.entryNo - b.entryNo);
    const running = new Map<string, number>();
    for (const e of sorted) {
      const k = key(e);
      if (!final.has(k)) reject(`${what}: movimento de ${k} sem saldo correspondente.`);
      const next = (running.get(k) ?? 0) + e.delta;
      if (e.delta === 0 || next !== after(e)) reject(`${what}: livro-razão de ${k} inconsistente.`);
      running.set(k, next);
    }
    for (const [k, balance] of final) if ((running.get(k) ?? 0) !== balance) reject(`${what}: saldo de ${k} não confere com o livro-razão.`);
  };
  ledger(rows.walletEntries, (e) => e.resourceId, (e) => e.balanceAfter, new Map(rows.wallets.map((w) => [w.resourceId, w.balance])), 'Carteira');
  ledger(rows.inventoryEntries, (e) => e.printingId, (e) => e.quantityAfter, new Map(rows.inventory.map((i) => [i.printingId, i.quantity])), 'Inventário');

  const decks = new Map(rows.decks.map((d) => [d.deckId, new Set(d.versions.map((v) => v.revision))]));
  const attempts = new Set(rows.attempts.map((a) => a.attemptId));
  const presets = new Set(rows.cosmeticPresets.map((p) => `${p.presetId}@${p.revision}`));
  if (rows.attempts.filter((a) => a.status === 'RUNNING' || a.status === 'SUSPENDED').length > 1) reject('Mais de uma tentativa ativa no mesmo perfil.');
  for (const a of rows.attempts) {
    if ((a.deckId === null) !== (a.deckRevision === null)) reject(`Tentativa ${a.attemptId}: deck incompleto.`);
    if (a.deckId !== null && !decks.get(a.deckId)?.has(a.deckRevision!)) reject(`Tentativa ${a.attemptId}: revisão de deck ausente no arquivo.`);
  }
  rows.replays.forEach((r) => { if (!attempts.has(r.attemptId)) reject(`Replay ${r.replayId}: tentativa ausente.`); });
  rows.pendingRewards.forEach((r) => { if (r.sourceAttemptId !== null && !attempts.has(r.sourceAttemptId)) reject(`Prêmio ${r.rewardId}: tentativa de origem ausente.`); });
  if (rows.profileAppearance && !presets.has(`${rows.profileAppearance.presetId}@${rows.profileAppearance.presetRevision}`)) reject('Aparência do perfil aponta para preset ausente.');
  for (const a of rows.deckAppearance) {
    if (!decks.has(a.deckId)) reject(`Aparência do deck ${a.deckId}: deck ausente.`);
    if (a.presetId !== null && !presets.has(`${a.presetId}@${a.presetRevision}`)) reject(`Aparência do deck ${a.deckId}: preset ausente.`);
  }
}

function readContent(cardVersions: Obj, printingsDoc: Obj): PortableContent {
  const definitions = arr(cardVersions.definitions, 'definitions', 100_000).map((x, i) => {
    const d = obj(x, `definitions[${i}]`);
    return { definitionId: ident(d.definitionId, 'definitions.definitionId'), createdAt: time(d.createdAt, 'definitions.createdAt'), archived: bool(d.archived, 'definitions.archived') };
  });
  const versions: PortableCardVersion[] = arr(cardVersions.versions, 'versions', 100_000).map((x, i) => {
    const v = obj(x, `versions[${i}]`);
    const path = `versions[${i}]`;
    const rules = json(v.rules, `${path}.rules`);
    const rulesHash = hex64(v.rulesHash, `${path}.rulesHash`);
    if (jcsHash(rules) !== rulesHash) reject(`${path}: rules_hash não confere (JCS).`, 'CHECKSUM_MISMATCH');
    const definitionId = ident(v.definitionId, `${path}.definitionId`);
    const version = int(v.version, `${path}.version`, 1);
    const r = obj(rules, `${path}.rules`);
    if (r.id !== definitionId || r.version !== version) reject(`${path}: regras não correspondem a ${definitionId} v${version}.`);
    const pub = v.publication === null ? null : obj(v.publication, `${path}.publication`);
    return {
      definitionId, version, rules, rulesHash, rulesetId: str(v.rulesetId, `${path}.rulesetId`, 80), searchKey: str(v.searchKey, `${path}.searchKey`, 120),
      createdAt: time(v.createdAt, `${path}.createdAt`),
      publication: pub === null ? null : {
        validatorVersion: str(pub.validatorVersion, `${path}.publication.validatorVersion`, 80), report: json(pub.report, `${path}.publication.report`),
        projectId: identOrNull(pub.projectId, `${path}.publication.projectId`), projectRevision: intOrNull(pub.projectRevision, `${path}.publication.projectRevision`, 1),
        operationRevision: intOrNull(pub.operationRevision, `${path}.publication.operationRevision`, 1), publishedAt: time(pub.publishedAt, `${path}.publication.publishedAt`),
      },
      dependencies: arr(v.dependencies, `${path}.dependencies`, 1_000).map((d, j) => {
        const q = obj(d, `${path}.dependencies[${j}]`);
        return { dependencyId: ident(q.dependencyId, `${path}.dependencyId`), dependencyVersion: int(q.dependencyVersion, `${path}.dependencyVersion`, 1), dependencyKind: oneOf(q.dependencyKind, `${path}.dependencyKind`, ['COPY_ATTACK', 'REFERENCE', 'TEST_FIXTURE'] as const) };
      }),
    };
  });
  uniqueOrReject(definitions.map((d) => d.definitionId), 'Definição');
  uniqueOrReject(versions.map((v) => `${v.definitionId} v${v.version}`), 'Versão');
  const catalogHeads = arr(cardVersions.catalogHeads ?? [], 'catalogHeads', 100_000).map((x, i) => {
    const h = obj(x, `catalogHeads[${i}]`);
    const head = { definitionId: ident(h.definitionId, 'catalogHeads.definitionId'), version: int(h.version, 'catalogHeads.version', 1) };
    if (!versions.some((v) => v.definitionId === head.definitionId && v.version === head.version)) reject(`catalogHeads: ${head.definitionId} v${head.version} não incluída.`);
    return head;
  });
  const printings = arr(printingsDoc.printings, 'printings', 200_000).map((x, i) => {
    const p = obj(x, `printings[${i}]`);
    const path = `printings[${i}]`;
    const appearance = json(p.appearance, `${path}.appearance`);
    const appearanceHash = hex64(p.appearanceHash, `${path}.appearanceHash`);
    if (jcsHash(appearance) !== appearanceHash) reject(`${path}: appearance_hash não confere (JCS).`, 'CHECKSUM_MISMATCH');
    const printingId = ident(p.printingId, `${path}.printingId`);
    const definitionId = ident(p.definitionId, `${path}.definitionId`);
    const definitionVersion = int(p.definitionVersion, `${path}.definitionVersion`, 1);
    const a = obj(appearance, `${path}.appearance`);
    if (a.printingId !== printingId || a.cardDefinitionId !== definitionId || a.cardDefinitionVersion !== definitionVersion) reject(`${path}: aparência não corresponde à impressão.`);
    return { printingId, definitionId, definitionVersion, appearance, appearanceHash, createdAt: time(p.createdAt, `${path}.createdAt`) };
  });
  uniqueOrReject(printings.map((p) => p.printingId), 'Impressão');
  return { definitions, versions, catalogHeads, printings, assets: [] };
}

function bindingsOf(appearance: JsonValue): { role: string; assetId: string }[] {
  const a = appearance as { assetBindings?: unknown };
  if (!Array.isArray(a.assetBindings)) return [];
  return a.assetBindings.flatMap((b) => {
    const binding = b as { role?: unknown; assetId?: unknown };
    return typeof binding.role === 'string' && typeof binding.assetId === 'string' ? [{ role: binding.role, assetId: binding.assetId }] : [];
  });
}

export type ParsedProfileArchive = {
  readonly manifest: ProfileArchiveManifest;
  readonly rows: ProfileRowsV4;
  readonly content: PortableContent;
  /** Referências que o arquivo não traz e precisam existir no banco de destino (pré-checagem). */
  readonly external: { readonly printings: readonly string[]; readonly versions: readonly { readonly definitionId: string; readonly version: number }[]; readonly assets: readonly string[]; readonly definitions: readonly string[] };
  readonly bundledAssetIds: readonly string[];
};

/**
 * Valida o conteúdo de um `.campaign-profile.zip` já extraído pelo leitor seguro: formato/versão, manifesto x
 * arquivos, SHA-256 de cada asset, hashes JCS de regras/aparências/checkpoints, tipos e coerência das linhas.
 */
export function parseProfileArchive(files: ReadonlyMap<string, Uint8Array>): { readonly ok: true; readonly archive: ParsedProfileArchive } | SavesFailure {
  try {
    for (const name of files.keys()) if (!isProfileArchiveEntry(name)) reject(`Entrada inesperada no arquivo: ${name}.`);
    const manifestBytes = files.get(PROFILE_ARCHIVE_FILES.manifest);
    if (!manifestBytes) reject('manifest.json ausente: não é um perfil exportado.');
    const m = obj(parseJson(manifestBytes, 'manifest.json'), 'manifest');
    if (m.format !== PROFILE_FORMAT) reject('manifest.json: não é um perfil Card Campaign (.campaign-profile.zip).');
    const formatVersion = int(m.formatVersion, 'formatVersion', 0);
    if (formatVersion > PROFILE_FORMAT_VERSION) {
      reject(`Este perfil usa o formato ${formatVersion}, mais novo que o suportado (${PROFILE_FORMAT_VERSION}). Atualize o jogo para importá-lo.`, 'FUTURE_VERSION', 'SAVE_VERSION_UNSUPPORTED');
    }
    if (formatVersion !== PROFILE_FORMAT_VERSION) {
      reject(`Formato de perfil ${formatVersion} não é lido por esta versão (apenas o formato ${PROFILE_FORMAT_VERSION}).`, 'INVALID_FORMAT', 'SAVE_VERSION_UNSUPPORTED');
    }
    const refs = obj(m.contentRefs, 'contentRefs');
    const manifest: ProfileArchiveManifest = {
      format: PROFILE_FORMAT,
      formatVersion: PROFILE_FORMAT_VERSION,
      exportedAt: time(m.exportedAt, 'exportedAt'),
      appVersion: str(m.appVersion, 'appVersion', 40),
      profileId: ident(m.profileId, 'profileId'),
      contentRefs: {
        packages: arr(refs.packages, 'contentRefs.packages', 64).map((p, i) => packageRef(p, `contentRefs.packages[${i}]`)),
        cardVersions: arr(refs.cardVersions, 'contentRefs.cardVersions', 100_000).map((x, i) => {
          const v = obj(x, `contentRefs.cardVersions[${i}]`);
          return { definitionId: ident(v.definitionId, 'cardVersions.definitionId'), version: int(v.version, 'cardVersions.version', 1), rulesHash: hex64(v.rulesHash, 'cardVersions.rulesHash') };
        }),
      },
      assets: arr(m.assets, 'assets', 1_024).map((x, i) => {
        const a = obj(x, `assets[${i}]`);
        return { sha256: hex64(a.sha256, 'assets.sha256'), bytes: int(a.bytes, 'assets.bytes'), mediaType: oneOf(a.mediaType, 'assets.mediaType', ASSET_MEDIA_TYPES) };
      }),
    };

    // Assets: cada arquivo listado, com o tamanho e o SHA-256 declarados (nome = hash dos bytes).
    uniqueOrReject(manifest.assets.map((a) => a.sha256), 'Asset');
    const assets: PortableAsset[] = manifest.assets.map((a) => {
      const name = `assets/${a.sha256}.${assetExtension(a.mediaType)}`;
      const bytes = files.get(name);
      if (!bytes) reject(`Asset listado e ausente: ${name}.`, 'CHECKSUM_MISMATCH');
      if (bytes.length !== a.bytes) reject(`Asset ${a.sha256}: ${bytes.length} bytes, manifesto declara ${a.bytes}.`, 'CHECKSUM_MISMATCH');
      if (sha256Hex(bytes) !== a.sha256) reject(`Asset ${a.sha256}: SHA-256 dos bytes não confere.`, 'CHECKSUM_MISMATCH');
      const info = imageInfo(bytes);
      if (!info || info.mediaType !== a.mediaType) reject(`Asset ${a.sha256}: o conteúdo não é uma imagem ${a.mediaType} válida.`);
      // Fatos derivados dos próprios bytes (persistencia §8.2): recalculados, nunca confiados ao arquivo.
      return { assetId: a.sha256, mediaType: a.mediaType, bytes, width: info.width, height: info.height, metadata: {}, createdAt: manifest.exportedAt };
    });
    for (const name of files.keys()) {
      const match = ASSET_ENTRY.exec(name);
      if (match && !manifest.assets.some((a) => a.sha256 === match[1])) reject(`Asset não listado no manifesto: ${name}.`, 'CHECKSUM_MISMATCH');
    }

    const profileBytes = files.get(PROFILE_ARCHIVE_FILES.profile);
    if (!profileBytes) reject('profile.json ausente.');
    const doc = obj(parseJson(profileBytes, 'profile.json'), 'profile.json');
    const empty = utf8('{}');
    const cardVersions = obj(parseJson(files.get(PROFILE_ARCHIVE_FILES.cardVersions) ?? utf8('{"definitions":[],"versions":[],"catalogHeads":[]}'), 'content/card-versions.json'), 'card-versions');
    const printingsDoc = obj(parseJson(files.get(PROFILE_ARCHIVE_FILES.printings) ?? utf8('{"printings":[]}'), 'content/printings.json'), 'printings');
    const projectsDoc = obj(parseJson(files.get(PROFILE_ARCHIVE_FILES.projects) ?? empty, 'content/projects.json'), 'projects');
    const projects = arr(projectsDoc.projects ?? [], 'projects', 10_000).map((x, i) => readProject(x, `projects[${i}]`));
    const rows = readRows(doc, projects);
    const content = { ...readContent(cardVersions, printingsDoc), assets };

    // Manifesto x conteúdo: as versões CUSTOM declaradas são exatamente as incluídas.
    const declared = manifest.contentRefs.cardVersions.map((v) => `${v.definitionId}@${v.version}#${v.rulesHash}`).sort();
    const included = content.versions.map((v) => `${v.definitionId}@${v.version}#${v.rulesHash}`).sort();
    if (declared.join('\n') !== included.join('\n')) reject('manifest.json: contentRefs.cardVersions não corresponde a content/card-versions.json.', 'CHECKSUM_MISMATCH');
    const ops = rows.operations.length;
    for (const v of content.versions) if (v.publication?.operationRevision && v.publication.operationRevision > ops) reject(`Publicação de ${v.definitionId}: operação inexistente.`);

    // Referências externas (BASE ou já instaladas) para a pré-checagem no banco de destino.
    const includedPrintings = new Set(content.printings.map((p) => p.printingId));
    const includedVersions = new Set(content.versions.map((v) => `${v.definitionId}\u0000${v.version}`));
    const includedDefinitions = new Set(content.definitions.map((d) => d.definitionId));
    const includedAssets = new Set(content.assets.map((a) => a.assetId));
    const printingRefs = new Set<string>();
    rows.inventory.forEach((i) => printingRefs.add(i.printingId));
    rows.inventoryEntries.forEach((i) => printingRefs.add(i.printingId));
    rows.decks.forEach((d) => d.versions.forEach((v) => v.entries.forEach((e) => printingRefs.add(e.printingId))));
    rows.attempts.forEach((a) => a.cardRefs.forEach((p) => printingRefs.add(p)));
    rows.binders.forEach((b) => b.slots.forEach((s) => printingRefs.add(s.printingId)));
    const versionRefs = new Map<string, { definitionId: string; version: number }>();
    const addVersionRef = (definitionId: string, version: number) => { if (!includedVersions.has(`${definitionId}\u0000${version}`)) versionRefs.set(`${definitionId}\u0000${version}`, { definitionId, version }); };
    content.printings.forEach((p) => addVersionRef(p.definitionId, p.definitionVersion));
    content.versions.forEach((v) => v.dependencies.forEach((d) => addVersionRef(d.dependencyId, d.dependencyVersion)));
    rows.projects.forEach((p) => { if (p.sourceDefinitionId !== null && p.sourceVersion !== null) addVersionRef(p.sourceDefinitionId, p.sourceVersion); });
    const assetRefs = new Set<string>();
    content.printings.forEach((p) => bindingsOf(p.appearance).forEach((b) => {
      if (!(ASSET_ROLES as readonly string[]).includes(b.role)) reject(`Impressão ${p.printingId}: papel de asset ${b.role} inválido.`);
      assetRefs.add(b.assetId);
    }));
    rows.projects.forEach((p) => p.revisions.forEach((r) => r.assetRefs.forEach((a) => assetRefs.add(a.assetId))));
    rows.cosmeticPresets.forEach((p) => p.assetIds.forEach((a) => assetRefs.add(a)));
    rows.appearanceDrafts.forEach((d) => d.assetIds.forEach((a) => assetRefs.add(a)));
    rows.attempts.forEach((a) => a.assetRefs.forEach((x) => assetRefs.add(x)));
    const bundled = arr(doc.bundledAssetIds ?? [], 'bundledAssetIds', 10_000).map((x) => hex64(x, 'bundledAssetIds'));
    const archive: ParsedProfileArchive = {
      manifest, rows, content,
      external: {
        printings: [...printingRefs].filter((p) => !includedPrintings.has(p)).sort(),
        versions: [...versionRefs.values()],
        assets: [...assetRefs].filter((a) => !includedAssets.has(a)).sort(),
        definitions: content.versions.map((v) => v.definitionId).filter((d) => !includedDefinitions.has(d)),
      },
      bundledAssetIds: bundled,
    };
    return { ok: true, archive };
  } catch (error) {
    return asFailure(error);
  }
}

// ---------------------------------------------------------------------------------------------------------
// Resumo antes de importar (interface §31.4: “validar em staging, mostrar resumo, alcance e diferenças de versão”)

export type ImportPreview = {
  readonly state: SaveFileState;
  readonly blocking: readonly string[];
  readonly warnings: readonly string[];
  readonly profileName: string;
  readonly progressionMode: 'STANDARD' | 'CUSTOM' | 'LAB';
  readonly sourceProfileId: string;
  readonly exportedAt: string;
  readonly appVersion: string;
  readonly formatVersion: number;
  readonly chapterLabel: string | null;
  readonly nodesCleared: number;
  readonly cardsOwned: number;
  readonly distinctCards: number;
  readonly decks: number;
  readonly attempts: number;
  readonly suspendedDuel: boolean;
  readonly customCards: number;
  readonly assets: number;
  readonly assetBytes: number;
  readonly campaignVersions: readonly string[];
  readonly packages: readonly (ContentPackageRef & { readonly status: 'OK' | 'MISSING' | 'DIFFERENT_HASH' })[];
  readonly preflight: ImportPreflightResult;
};

/** Capítulo atual: primeiro nó essencial ainda não concluído (mesma regra da tela de entrada). */
export function chapterLabelFor(content: ContentIndex | null, cleared: ReadonlySet<string>): string | null {
  if (!content) return null;
  const next = content.nodeList.find((n) => n.essential && !cleared.has(n.nodeId));
  if (!next) return content.nodeList.length ? 'Campanha concluída' : null;
  return content.chapters.get(next.chapterId)?.title ?? next.chapterId;
}

export async function previewProfileImport(
  ctx: Pick<SavesContext, 'storage'>, archive: ParsedProfileArchive, fingerprint: string, content: ContentIndex | null = null,
): Promise<ImportPreview> {
  const installed = await availablePackages(ctx, content);
  const required = archive.manifest.contentRefs.packages;
  const { missing, conflicting } = comparePackages(required, installed);
  const preflight = await ctx.storage.query({
    kind: 'IMPORT_PREFLIGHT',
    check: {
      fingerprint,
      definitions: archive.content.definitions.map((d) => d.definitionId),
      versions: archive.content.versions.map((v) => ({ definitionId: v.definitionId, version: v.version, rulesHash: v.rulesHash })),
      printings: archive.content.printings.map((p) => ({ printingId: p.printingId, appearanceHash: p.appearanceHash })),
      printingRefs: archive.external.printings,
      versionRefs: archive.external.versions,
      assetRefs: archive.external.assets,
    },
  });
  const blocking: string[] = [];
  missing.forEach((p) => blocking.push(`Pacote de conteúdo ${p.packageId} ${p.version} não está instalado. Instale a versão compatível do jogo.`));
  conflicting.forEach((p) => blocking.push(`Pacote ${p.packageId} ${p.version} instalado é diferente do usado no save (hash divergente).`));
  preflight.conflicts.forEach((c) => blocking.push(`Conflito: ${c}`));
  if (preflight.missingPrintings.length) blocking.push(`${preflight.missingPrintings.length} impressão(ões) referenciada(s) ausente(s): ${preflight.missingPrintings.slice(0, 5).join(', ')}.`);
  if (preflight.missingVersions.length) blocking.push(`Versões de carta ausentes: ${preflight.missingVersions.slice(0, 5).join(', ')}.`);
  if (preflight.missingAssets.length) blocking.push(`${preflight.missingAssets.length} arte(s) referenciada(s) não incluída(s) no arquivo.`);
  const warnings: string[] = [];
  if (preflight.previousImports.length) warnings.push(`Este mesmo arquivo já foi importado ${preflight.previousImports.length} vez(es); importar de novo cria outro perfil independente.`);
  if (archive.rows.attempts.some((a) => a.status === 'RUNNING')) warnings.push('O duelo em andamento será importado como pausado.');
  if (archive.bundledAssetIds.length) warnings.push('Algumas artes são do pacote do jogo e continuam exigindo o conteúdo instalado.');
  if (preflight.reusedVersions || preflight.reusedPrintings) warnings.push(`${preflight.reusedVersions + preflight.reusedPrintings} carta(s) autoral(is) já existem com o mesmo conteúdo e serão reutilizadas.`);
  const cleared = new Set(archive.rows.campaignProgress.filter((c) => c.status === 'CLEARED').map((c) => c.nodeId));
  const missingContent = missing.length > 0 || preflight.missingPrintings.length > 0 || preflight.missingVersions.length > 0 || preflight.missingAssets.length > 0;
  const name = archive.rows.settings.find((s) => s.key === 'displayNameOverride')?.value;
  return {
    state: missingContent ? 'MISSING_CONTENT' : blocking.length ? 'INVALID_FORMAT' : 'VALID',
    blocking, warnings,
    profileName: typeof name === 'string' && name.trim() ? name : archive.rows.profile.displayName,
    progressionMode: archive.rows.profile.progressionMode,
    sourceProfileId: archive.manifest.profileId,
    exportedAt: archive.manifest.exportedAt,
    appVersion: archive.manifest.appVersion,
    formatVersion: archive.manifest.formatVersion,
    chapterLabel: chapterLabelFor(content, cleared),
    nodesCleared: cleared.size,
    cardsOwned: archive.rows.inventory.reduce((s, i) => s + i.quantity, 0),
    distinctCards: archive.rows.inventory.filter((i) => i.quantity > 0).length,
    decks: archive.rows.decks.filter((d) => !d.archived).length,
    attempts: archive.rows.attempts.length,
    suspendedDuel: archive.rows.attempts.some((a) => a.status === 'RUNNING' || a.status === 'SUSPENDED'),
    customCards: archive.content.versions.length,
    assets: archive.content.assets.length,
    assetBytes: archive.content.assets.reduce((s, a) => s + a.bytes.length, 0),
    campaignVersions: [...new Set(archive.rows.campaignProgress.map((c) => c.campaignVersion))].sort(),
    packages: required.map((p) => ({
      ...p,
      status: missing.includes(p) ? 'MISSING' as const : conflicting.includes(p) ? 'DIFFERENT_HASH' as const : 'OK' as const,
    })),
    preflight,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Remapeamento de IDs locais (persistencia §24.1: perfil, operações, decks, tentativas, replays, recompensas
// pendentes, presets, fichários e projetos) para que o mesmo arquivo possa ser importado de novo.

/** Troca, em profundidade, toda string (valor ou chave) igual a um ID antigo pelo novo. */
export function remapJson(value: JsonValue, ids: ReadonlyMap<string, string>): JsonValue {
  if (typeof value === 'string') return ids.get(value) ?? value;
  if (Array.isArray(value)) return value.map((v) => remapJson(v, ids));
  if (value !== null && typeof value === 'object') {
    const out: Record<string, JsonValue> = {};
    for (const [k, v] of Object.entries(value)) out[ids.get(k) ?? k] = remapJson(v, ids);
    return out;
  }
  return value;
}

export function remapArchive(archive: ParsedProfileArchive, newProfileId: string, newId: (prefix: string) => string): {
  readonly rows: ProfileRowsV4; readonly content: PortableContent; readonly ids: ReadonlyMap<string, string>;
} {
  const r = archive.rows;
  const ids = new Map<string, string>([[archive.manifest.profileId, newProfileId]]);
  const assign = (old: string, prefix: string) => { if (!ids.has(old)) ids.set(old, newId(prefix)); };
  r.decks.forEach((d) => assign(d.deckId, 'deck'));
  r.attempts.forEach((a) => assign(a.attemptId, 'attempt'));
  r.replays.forEach((x) => assign(x.replayId, 'replay'));
  r.pendingRewards.forEach((x) => assign(x.rewardId, 'reward'));
  r.cosmeticPresets.forEach((x) => assign(x.presetId, 'preset'));
  r.binders.forEach((x) => assign(x.binderId, 'binder'));
  r.projects.forEach((x) => { assign(x.projectId, 'project'); x.testRuns.forEach((t) => assign(t.runId, 'run')); });
  const id = (old: string): string => ids.get(old) ?? old;
  const idN = (old: string | null): string | null => (old === null ? null : id(old));
  const j = (v: JsonValue): JsonValue => remapJson(v, ids);

  const rows: ProfileRowsV4 = {
    ...r,
    settings: r.settings.map((s) => ({ key: s.key, value: j(s.value) })),
    operations: r.operations.map((o) => ({ ...o, receipt: j(o.receipt) })),
    pendingRewards: r.pendingRewards.map((p) => ({ ...p, rewardId: id(p.rewardId), options: j(p.options), choice: p.choice === null ? null : j(p.choice), sourceAttemptId: idN(p.sourceAttemptId) })),
    decks: r.decks.map((d) => ({ ...d, deckId: id(d.deckId), versions: d.versions.map((v) => ({ ...v, validation: j(v.validation) })) })),
    deckAppearance: r.deckAppearance.map((a) => ({ ...a, deckId: id(a.deckId), presetId: idN(a.presetId) })),
    profileAppearance: r.profileAppearance ? { ...r.profileAppearance, presetId: id(r.profileAppearance.presetId) } : null,
    campaignProgress: r.campaignProgress.map((c) => ({ ...c, progress: j(c.progress) })),
    attempts: r.attempts.map((a) => ({
      ...a, attemptId: id(a.attemptId), deckId: idN(a.deckId), state: j(a.state), rng: j(a.rng), presentationSnapshot: j(a.presentationSnapshot),
      result: a.result === null ? null : j(a.result),
      events: a.events.map((e) => ({ ...e, event: j(e.event) })),
      checkpoints: a.checkpoints.map((c) => {
        const snapshot = j(c.snapshot);
        return { ...c, snapshot, snapshotHash: jcsHash(snapshot) };
      }),
    })),
    replays: r.replays.map((x) => ({ ...x, replayId: id(x.replayId), attemptId: id(x.attemptId), metadata: j(x.metadata) })),
    cosmeticPresets: r.cosmeticPresets.map((p) => ({ ...p, presetId: id(p.presetId), config: j(p.config) })),
    appearanceDrafts: r.appearanceDrafts.map((d) => ({ ...d, draft: j(d.draft) })),
    binders: r.binders.map((b) => ({ ...b, binderId: id(b.binderId), layout: j(b.layout) })),
    projects: r.projects.map((p) => ({
      ...p, projectId: id(p.projectId),
      revisions: p.revisions.map((x) => ({ ...x, draft: j(x.draft), validationSummary: j(x.validationSummary) })),
      testRuns: p.testRuns.map((t) => ({ ...t, runId: id(t.runId), scenario: j(t.scenario), result: j(t.result) })),
    })),
  };
  const content: PortableContent = {
    ...archive.content,
    versions: archive.content.versions.map((v) => ({
      ...v, publication: v.publication ? { ...v.publication, projectId: idN(v.publication.projectId) } : null,
    })),
  };
  return { rows, content, ids };
}

// ---------------------------------------------------------------------------------------------------------
// Importação (IMPORT_PROFILE, um único COMMIT no perfil novo; persistencia §13.1, §22, §24.1, §25)

export type ImportProfileOptions = {
  /** SHA-256 do arquivo recebido; registrado em `profile_imports.source_fingerprint` (não único). */
  readonly fingerprint: string;
  readonly sourceKind?: 'PROFILE_ZIP_4' | 'DATABASE_BACKUP';
  /** Substituir: depois do COMMIT do perfil novo, arquiva este perfil (ARCHIVE_PROFILE). Nunca mescla dados. */
  readonly replaceProfileId?: string | null;
  readonly content?: ContentIndex | null;
};

export type ImportProfileResult = {
  readonly ok: true; readonly profileId: string; readonly importId: string; readonly archivedProfileId: string | null; readonly archiveFailed: boolean;
};

export async function importProfileArchive(ctx: SavesContext, archive: ParsedProfileArchive, options: ImportProfileOptions): Promise<ImportProfileResult | SavesFailure> {
  if (!/^[0-9a-f]{64}$/.test(options.fingerprint)) return savesFailure('IMPORT_INVALID', 'Fingerprint do arquivo inválido.');
  const preview = await previewProfileImport(ctx, archive, options.fingerprint, options.content ?? null);
  if (preview.blocking.length) {
    return savesFailure(preview.state === 'MISSING_CONTENT' ? 'CONTENT_REFERENCE_MISSING' : 'IMPORT_INVALID', preview.blocking[0]!, preview.state, preview.blocking);
  }
  const profileId = ctx.platform.newId('profile');
  const importId = ctx.platform.newId('import');
  const sourceKind = options.sourceKind ?? 'PROFILE_ZIP_4';
  const remapped = remapArchive(archive, profileId, (prefix) => ctx.platform.newId(prefix));
  const counts = {
    operations: remapped.rows.operations.length, decks: remapped.rows.decks.length, attempts: remapped.rows.attempts.length,
    inventory: remapped.rows.inventory.length, copies: preview.cardsOwned, grants: remapped.rows.rewardGrants.length,
    customVersions: remapped.content.versions.length, printings: remapped.content.printings.length, assets: remapped.content.assets.length,
    projects: remapped.rows.projects.length,
  };
  const report: JsonValue = {
    sourceKind, sourceProfileId: archive.manifest.profileId, formatVersion: archive.manifest.formatVersion, exportedAt: archive.manifest.exportedAt,
    appVersion: archive.manifest.appVersion, counts, warnings: [...preview.warnings],
    packages: archive.manifest.contentRefs.packages.map((p) => ({ ...p })), reusedVersions: preview.preflight.reusedVersions,
    reusedPrintings: preview.preflight.reusedPrintings, replacedProfileId: options.replaceProfileId ?? null,
    idMap: Object.fromEntries([...remapped.ids].filter(([old]) => old !== archive.manifest.profileId).slice(0, 2_000)),
  };
  const mutations: Mutation[] = [
    { kind: 'INSERT_PROFILE', displayName: remapped.rows.profile.displayName, progressionMode: remapped.rows.profile.progressionMode, rngJson: remapped.rows.profile.rng },
    { kind: 'IMPORT_PROFILE_ROWS', rows: remapped.rows, content: remapped.content },
    { kind: 'INSERT_PROFILE_IMPORT', importId, sourceKind, sourceFingerprint: options.fingerprint, report },
  ];
  const commandId = ctx.platform.newId('cmd');
  let result = await ctx.bus.execute({
    commandType: 'IMPORT_PROFILE', profileId, expectedRevision: remapped.rows.operations.length, writerEpoch: 0, commandId,
    payload: { importId, fingerprint: options.fingerprint, sourceKind, sourceProfileId: archive.manifest.profileId },
    mutations, summary: { importId, sourceKind, sourceProfileId: archive.manifest.profileId, counts },
  });
  if (!result.ok && result.code === 'SAVE_WRITE_FAILED') {
    // Resposta perdida (ex.: importação grande além do tempo da chamada): o worker serializa as mensagens, então esta
    // consulta só é respondida depois do COMMIT ou do ROLLBACK — o recibo decide (persistencia §13.3).
    const known = await ctx.storage.query({ kind: 'GET_OPERATION', profileId, commandId }).catch(() => null);
    if (known) result = { ok: true, status: 'REPLAYED', operationId: known.operationId, committedRevision: known.committedRevision, receipt: known.receipt };
  }
  if (!result.ok) return savesFailure(result.code, result.message);
  let archivedProfileId: string | null = null;
  let archiveFailed = false;
  if (options.replaceProfileId) {
    archiveFailed = !(await archiveProfileById(ctx, options.replaceProfileId));
    if (!archiveFailed) archivedProfileId = options.replaceProfileId;
  }
  return { ok: true, profileId, importId, archivedProfileId, archiveFailed };
}

/** ARCHIVE_PROFILE com a revisão/época atuais do perfil (persistencia §11: arquivar preserva bytes e histórico). */
export async function archiveProfileById(ctx: SavesContext, profileId: string): Promise<boolean> {
  const snap = await ctx.storage.query({ kind: 'PROFILE_SNAPSHOT', profileId });
  if (!snap) return false;
  if (snap.profile.archived) return true;
  const r = await ctx.bus.execute({
    commandType: 'ARCHIVE_PROFILE', profileId, expectedRevision: snap.profile.revision, writerEpoch: snap.profile.writerEpoch,
    payload: { archived: true }, mutations: [{ kind: 'SET_PROFILE_ARCHIVED', archived: true }], summary: { archived: true },
  });
  return r.ok;
}

// ---------------------------------------------------------------------------------------------------------
// Resumo por perfil para S31 (interface §31.1)

export type ProfileSummary = {
  readonly profileId: string;
  readonly displayName: string;
  readonly baseName: string;
  readonly progressionMode: 'STANDARD' | 'CUSTOM' | 'LAB';
  readonly archived: boolean;
  readonly chapterLabel: string | null;
  readonly nodesCleared: number;
  readonly totalNodes: number | null;
  readonly cardsOwned: number;
  readonly distinctCards: number;
  readonly decks: number;
  readonly lastWrite: string;
  readonly createdAt: string;
  readonly revision: number;
  readonly suspendedDuel: boolean;
  readonly duelStatus: string | null;
  readonly campaignVersion: string | null;
  /** Criado com o catálogo antigo de cartas genéricas: não abre (application/legacy.ts). */
  readonly legacyCatalog: boolean;
};

export function summarizeSnapshot(snap: ProfileSnapshot, content: ContentIndex | null): ProfileSummary {
  const cleared = new Set(snap.campaignProgress.filter((c) => c.status === 'CLEARED').map((c) => c.nodeId));
  const override = snap.settings.displayNameOverride;
  const versions = [...new Set(snap.campaignProgress.map((c) => c.campaignVersion))].sort();
  return {
    profileId: snap.profile.profileId,
    displayName: typeof override === 'string' && override.trim() ? override : snap.profile.displayName,
    baseName: snap.profile.displayName,
    progressionMode: snap.profile.progressionMode,
    archived: snap.profile.archived,
    chapterLabel: chapterLabelFor(content, cleared),
    nodesCleared: cleared.size,
    totalNodes: content ? content.nodeList.length : null,
    cardsOwned: snap.inventory.reduce((s, i) => s + i.quantity, 0),
    distinctCards: snap.inventory.filter((i) => i.quantity > 0).length,
    decks: snap.decks.filter((d) => !d.archived).length,
    lastWrite: snap.profile.updatedAt,
    createdAt: snap.profile.createdAt,
    revision: snap.profile.revision,
    suspendedDuel: snap.activeAttempt !== null,
    duelStatus: snap.activeAttempt?.status ?? null,
    campaignVersion: versions.length ? versions[versions.length - 1]! : null,
    legacyCatalog: isLegacyInventory(snap.inventory, content),
  };
}

export async function listProfileSummaries(ctx: Pick<SavesContext, 'storage'>, content: ContentIndex | null): Promise<ProfileSummary[]> {
  const profiles = await ctx.storage.query({ kind: 'LIST_PROFILES', includeArchived: true });
  const out: ProfileSummary[] = [];
  for (const p of profiles) {
    const snap = await ctx.storage.query({ kind: 'PROFILE_SNAPSHOT', profileId: p.profileId });
    if (snap) out.push(summarizeSnapshot(snap, content));
  }
  return out;
}

/** Renomear: preferência local `displayNameOverride` (mesmo mecanismo do Perfil, S34); o histórico não muda. */
export async function renameProfile(ctx: Pick<SavesContext, 'storage'>, profileId: string, name: string): Promise<{ readonly ok: true } | SavesFailure> {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 40) return savesFailure('IMPORT_INVALID', 'O nome precisa ter de 1 a 40 caracteres.');
  const r = await ctx.storage.write({ kind: 'SET_SETTINGS', profileId, values: { displayNameOverride: trimmed } });
  return r.ok ? { ok: true } : savesFailure(r.code, r.message);
}

// ---------------------------------------------------------------------------------------------------------
// Restaurar backup completo (persistencia §23, §25, §25.1). A aplicação faz as conferências que não exigem abrir
// o banco (tamanho, cabeçalho, manifesto, transporte, pacotes); a validação estrutural roda num worker
// descartável da infraestrutura (`BackupInspection`); a troca é do Storage Worker (`restoreFromStaging`).

export type BackupInput = {
  readonly fileName: string;
  readonly database: Uint8Array;
  /** `<nome>.backup.json` (ou `manifest.json` dentro do .zip); `null` = sem manifesto. */
  readonly manifest: Uint8Array | null;
};

export type BackupPrecheck = {
  readonly ok: true;
  readonly fileName: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly schemaVersion: number;
  readonly manifest: BackupManifest | null;
  readonly warnings: readonly string[];
  readonly packages: readonly (ContentPackageRef & { readonly status: 'OK' | 'MISSING' | 'DIFFERENT_HASH' })[];
};

/** Separa banco e manifesto de arquivos já lidos (.sqlite3 + .backup.json, ou entradas de um .zip). */
export function pickBackupFiles(files: readonly { readonly name: string; readonly bytes: Uint8Array }[]): BackupInput | SavesFailure {
  const databases = files.filter((f) => /\.(sqlite3|sqlite|db)$/i.test(f.name));
  const manifests = files.filter((f) => /(\.backup\.json|(^|\/)manifest\.json)$/i.test(f.name));
  const others = files.filter((f) => !databases.includes(f) && !manifests.includes(f));
  if (databases.length !== 1) {
    return savesFailure('IMPORT_INVALID', databases.length === 0 ? 'Nenhum arquivo .sqlite3 encontrado. Escolha o backup completo (.sqlite3 ou .zip).' : 'Escolha um único arquivo .sqlite3 por vez.');
  }
  if (manifests.length > 1) return savesFailure('IMPORT_INVALID', 'Mais de um manifesto de backup foi escolhido.');
  if (others.length) return savesFailure('IMPORT_INVALID', `Arquivo não reconhecido como parte de um backup: ${others[0]!.name}.`);
  return { fileName: databases[0]!.name, database: databases[0]!.bytes, manifest: manifests[0]?.bytes ?? null };
}

/**
 * Conferências antes de abrir o banco (§23, §25.1 passo 1): limite, cabeçalho, application_id, user_version,
 * manifesto (bytes + SHA-256) e pacotes de conteúdo exigidos. Nada é gravado.
 */
export async function precheckBackup(
  ctx: Pick<SavesContext, 'storage'>, input: BackupInput, content: ContentIndex | null,
  sha256: (bytes: Uint8Array) => Promise<string> | string = sha256Hex,
): Promise<BackupPrecheck | SavesFailure> {
  if (input.database.length > BACKUP_MAX_BYTES) {
    return savesFailure('IMPORT_INVALID', `O backup tem ${formatBytes(input.database.length)}; o limite é ${formatBytes(BACKUP_MAX_BYTES)}.`, 'SIZE_LIMIT');
  }
  const header = readSqliteHeader(input.database);
  if (!header.valid) return savesFailure('IMPORT_INVALID', 'O arquivo não é um banco SQLite. Escolha o .sqlite3 exportado pelo jogo.');
  if (header.applicationId !== APPLICATION_ID) return savesFailure('IMPORT_INVALID', 'Este banco SQLite não é um backup do Card Campaign.');
  if (header.userVersion > SUPPORTED_SCHEMA_VERSION) {
    return savesFailure('SAVE_VERSION_UNSUPPORTED', `Backup gravado por uma versão mais nova do jogo (schema ${header.userVersion}). Atualize o jogo para restaurá-lo.`, 'FUTURE_VERSION');
  }
  if (header.userVersion < 1) return savesFailure('IMPORT_INVALID', 'Banco sem versão de schema válida.');
  const warnings: string[] = [];
  const digest = await sha256(input.database);
  let manifest: BackupManifest | null = null;
  if (input.manifest) {
    const parsed = parseBackupManifest(input.manifest);
    if (!parsed.ok) return parsed;
    manifest = parsed.manifest;
    const transport = checkBackupTransport(input.database, manifest, digest);
    if (transport) return transport;
    if (manifest.schemaVersion !== header.userVersion || manifest.applicationId !== header.applicationId) {
      return savesFailure('IMPORT_INVALID', 'O manifesto não descreve este banco (schema ou application_id diferentes).', 'CHECKSUM_MISMATCH');
    }
    if (manifest.databaseFile !== input.fileName && !input.fileName.endsWith(manifest.databaseFile)) {
      warnings.push(`O manifesto foi feito para “${manifest.databaseFile}”; o conteúdo confere mesmo assim.`);
    }
  } else {
    warnings.push('Sem manifesto: a integridade de transporte (bytes e SHA-256) não foi conferida; o banco ainda passa por todas as verificações estruturais.');
  }
  const required = manifest?.requiredContentPackages ?? [];
  const available = await availablePackages(ctx, content);
  const { missing, conflicting } = comparePackages(required, available);
  const packages = required.map((p) => ({ ...p, status: missing.includes(p) ? 'MISSING' as const : conflicting.includes(p) ? 'DIFFERENT_HASH' as const : 'OK' as const }));
  if (missing.length || conflicting.length) {
    const first = missing[0] ?? conflicting[0]!;
    return savesFailure('CONTENT_REFERENCE_MISSING',
      `O backup exige o pacote de conteúdo ${first.packageId} ${first.version}${missing.length ? ', que não está instalado' : ' com outro conteúdo (hash diferente)'}. Instale a versão compatível do jogo antes de restaurar.`,
      'MISSING_CONTENT', [...missing, ...conflicting].map((p) => `${p.packageId} ${p.version}`));
  }
  return { ok: true, fileName: input.fileName, bytes: input.database.length, sha256: digest, schemaVersion: header.userVersion, manifest, warnings, packages };
}

export type RestorePlan = {
  readonly ok: true;
  readonly precheck: BackupPrecheck;
  readonly inspection: BackupInspection;
  readonly warnings: readonly string[];
  readonly profiles: readonly (BackupProfileSummary & { readonly chapterLabel: string | null })[];
};

/** Junta a conferência prévia e a validação do worker; sem manifesto, confere os pacotes do próprio banco. */
export async function planRestore(
  ctx: Pick<SavesContext, 'storage'>, precheck: BackupPrecheck, inspection: BackupInspection, content: ContentIndex | null,
): Promise<RestorePlan | SavesFailure> {
  const warnings = [...precheck.warnings];
  if (!precheck.manifest) {
    const base = inspection.contentPackages.filter((p) => p.origin === 'BASE');
    const { missing, conflicting } = comparePackages(base, await availablePackages(ctx, content));
    if (missing.length || conflicting.length) {
      const first = missing[0] ?? conflicting[0]!;
      return savesFailure('CONTENT_REFERENCE_MISSING',
        `O backup usa o pacote de conteúdo ${first.packageId} ${first.version}, ausente ou diferente nesta instalação. Instale a versão compatível do jogo antes de restaurar.`, 'MISSING_CONTENT');
    }
  }
  if (inspection.profiles.some((p) => p.activeAttempt === 'RUNNING')) warnings.push('Um duelo em andamento no backup será retomado a partir do último estado confirmado.');
  if (inspection.profiles.length === 0) warnings.push('O backup não contém perfis.');
  return {
    ok: true, precheck, inspection, warnings,
    profiles: inspection.profiles.map((p) => ({ ...p, chapterLabel: chapterLabelFor(content, new Set(p.clearedNodeIds)) })),
  };
}

/**
 * Substitui a instalação inteira pelo staging validado (§25.1). Antes: fila de comandos drenada (a tentativa em
 * curso já deve ter sido suspensa pela apresentação). Depois do sucesso a apresentação recarrega a página para
 * reconstruir todas as projeções a partir do banco restaurado.
 */
export async function restoreInstallation(ctx: SavesContext, staged: { readonly stagingPath: string; readonly stagingSha256: string }): Promise<
  { readonly ok: true; readonly previousPath: string } | SavesFailure
> {
  const swap = ctx.storage.restoreFromStaging;
  if (!swap) return savesFailure('STORAGE_CAPABILITY_MISSING', 'Restaurar a instalação exige o armazenamento do navegador (OPFS).');
  if (!(await waitForIdle(ctx.bus))) return savesFailure('SAVE_WRITE_FAILED', 'Ainda há uma gravação em andamento. Tente de novo em instantes.');
  try {
    const r = await swap({ stagingPath: staged.stagingPath, expectedSha256: staged.stagingSha256 });
    if (!r.ok) return savesFailure(r.code, `A restauração não foi concluída e o banco atual foi mantido: ${r.message}`);
    return { ok: true, previousPath: r.previousPath };
  } catch (error) {
    return savesFailure('SAVE_WRITE_FAILED', `A restauração não foi concluída: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Monta, a partir das linhas de um perfil lido de um backup validado, o mesmo arquivo formato 4 e o valida. */
export function archiveFromExportData(data: ProfileExportData, options: { readonly appVersion: string; readonly exportedAt: string }):
  { readonly ok: true; readonly archive: ParsedProfileArchive } | SavesFailure {
  const built = buildProfileArchive(data, options);
  return parseProfileArchive(new Map(built.files.map((f) => [f.name, f.bytes])));
}

/** “Apagar todos os dados locais” (persistencia §11; interface §31.6): fila drenada, conexão fechada, OPFS removido. */
export async function wipeAllLocalData(ctx: SavesContext): Promise<{ readonly ok: true } | SavesFailure> {
  const wipe = ctx.storage.wipeAllData;
  if (!wipe) return savesFailure('STORAGE_CAPABILITY_MISSING', 'Apagar os dados exige o armazenamento do navegador (OPFS).');
  await waitForIdle(ctx.bus);
  const r = await wipe();
  return r.ok ? r : savesFailure(r.code, `Não foi possível apagar todos os dados: ${r.message}`);
}

/** Bytes que faltam no armazenamento estimado (`navigator.storage.estimate()`); desconhecido = 0 (não bloqueia). */
export function spaceShortfall(estimate: { readonly usage: number | null; readonly quota: number | null } | null, neededBytes: number): number {
  if (!estimate || estimate.quota === null || estimate.usage === null) return 0;
  const free = estimate.quota - estimate.usage;
  return free >= neededBytes ? 0 : neededBytes - free;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: value < 10 ? 1 : 0 })} ${units[unit]}`;
}
