// ZIP de intercâmbio (perfil portátil `.campaign-profile.zip`, backup `.zip`): escrita com fflate e leitura
// DEFENSIVA própria (persistencia-sqlite.md §25, DB-049). Antes de descomprimir qualquer byte: diretório central
// coerente, contagem de entradas, nomes sem traversal, tamanhos declarados dentro dos limites, sem ZIP64,
// criptografia, multivolume ou entradas sobrepostas. Durante a descompressão: saída limitada ao tamanho
// declarado (o cabeçalho pode mentir) e CRC-32 conferido. Nada é extraído para o sistema de arquivos.
import { Inflate, zipSync, type Zippable } from 'fflate';

export const MiB = 1024 * 1024;

export type ZipLimits = {
  /** Tamanho máximo do arquivo .zip recebido. */
  readonly maxArchiveBytes: number;
  /** Soma máxima dos tamanhos descomprimidos. */
  readonly maxTotalBytes: number;
  readonly maxEntries: number;
  /** Tamanho máximo de uma entrada descomprimida. */
  readonly maxEntryBytes: number;
};

/** Perfil portátil e pacote de cartas: 128 MiB compactado, 256 MiB expandido, 1.024 entradas (persistencia §25). */
export const PROFILE_ZIP_LIMITS: ZipLimits = { maxArchiveBytes: 128 * MiB, maxTotalBytes: 256 * MiB, maxEntries: 1024, maxEntryBytes: 256 * MiB };

/** Backup completo em .zip: banco até 256 MiB + manifesto (persistencia §25). */
export const BACKUP_ZIP_LIMITS: ZipLimits = { maxArchiveBytes: 260 * MiB, maxTotalBytes: 257 * MiB, maxEntries: 4, maxEntryBytes: 256 * MiB };

export type ZipFailureReason =
  | 'NOT_ZIP' | 'TOO_LARGE' | 'TOO_MANY_ENTRIES' | 'BAD_NAME' | 'DUPLICATE_NAME' | 'NOT_ALLOWED' | 'UNSUPPORTED' | 'ENCRYPTED' | 'CORRUPT' | 'SYMLINK';

export type ZipReadResult =
  | { readonly ok: true; readonly entries: ReadonlyMap<string, Uint8Array> }
  | { readonly ok: false; readonly code: 'IMPORT_INVALID'; readonly reason: ZipFailureReason; readonly message: string };

export type ZipWriteEntry = { readonly name: string; readonly bytes: Uint8Array; readonly compress?: boolean };

// ---------------------------------------------------------------------------------------------------------
// CRC-32 (IEEE 802.3), usado para conferir cada entrada descomprimida.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array, seed = 0): number {
  let c = (seed ^ 0xffffffff) >>> 0;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------------------------------------------------
// Nomes de entrada

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;

/**
 * Nome relativo seguro: sem barra inicial, `\`, `..`, `.`, segmentos vazios, letra de unidade, controle ou
 * caracteres reservados. Devolve o motivo da recusa ou `null` quando aceito.
 */
export function unsafeEntryName(name: string): string | null {
  if (name.length === 0 || name.length > 255) return 'nome vazio ou longo demais';
  if (name.includes('\\')) return 'barra invertida no nome';
  if (name.startsWith('/')) return 'caminho absoluto';
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(name)) return 'caractere de controle no nome';
  if (/[:*?"<>|]/.test(name)) return 'caractere reservado no nome';
  const segments = name.endsWith('/') ? name.slice(0, -1).split('/') : name.split('/');
  for (const segment of segments) {
    if (segment === '' || segment === '.' || segment === '..') return 'segmento de caminho inválido (traversal)';
    if (segment.endsWith('.') || segment.endsWith(' ')) return 'segmento termina com ponto ou espaço';
    if (WINDOWS_RESERVED.test(segment)) return 'nome reservado do sistema';
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------
// Escrita

/** ZIP comum (método STORE ou DEFLATE), nomes ASCII validados; `compress: false` para mídia já comprimida. */
export function writeZip(entries: readonly ZipWriteEntry[], mtime: Date = new Date()): Uint8Array {
  const files: Zippable = {};
  const seen = new Set<string>();
  for (const entry of entries) {
    const problem = unsafeEntryName(entry.name);
    if (problem) throw new Error(`nome de entrada inválido (${entry.name}): ${problem}`);
    if (seen.has(entry.name.toLowerCase())) throw new Error(`entrada duplicada: ${entry.name}`);
    seen.add(entry.name.toLowerCase());
    files[entry.name] = [entry.bytes, { level: entry.compress === false ? 0 : 6, mtime }];
  }
  return zipSync(files, { mtime });
}

// ---------------------------------------------------------------------------------------------------------
// Leitura defensiva

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;
const SIG_ZIP64_LOCATOR = 0x07064b50;
const INFLATE_CHUNK = 16 * 1024;

type CentralEntry = {
  readonly name: string; readonly method: number; readonly crc: number; readonly compressedSize: number; readonly size: number;
  readonly localOffset: number; readonly nameBytes: Uint8Array;
};

type Fail = Extract<ZipReadResult, { ok: false }>;

function failure(reason: ZipFailureReason, message: string): Fail {
  return { ok: false, code: 'IMPORT_INVALID', reason, message };
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

function findEndOfCentralDirectory(view: DataView): number {
  const length = view.byteLength;
  const stop = Math.max(0, length - 22 - 0xffff);
  for (let offset = length - 22; offset >= stop; offset -= 1) {
    if (view.getUint32(offset, true) === SIG_EOCD && offset + 22 + view.getUint16(offset + 20, true) === length) return offset;
  }
  return -1;
}

function decodeName(bytes: Uint8Array, utf8Flag: boolean): string | null {
  if (!utf8Flag && bytes.some((b) => b >= 0x80)) return null; // CP437 com bytes altos: recusado
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).normalize('NFC');
  } catch {
    return null;
  }
}

function inflateBounded(data: Uint8Array, expected: number): Uint8Array | string {
  const out = new Uint8Array(expected);
  let written = 0;
  let overflow = false;
  const inflater = new Inflate((chunk) => {
    if (written + chunk.length > expected) { overflow = true; throw new Error('overflow'); }
    out.set(chunk, written);
    written += chunk.length;
  });
  try {
    if (data.length === 0) inflater.push(new Uint8Array(0), true);
    for (let offset = 0; offset < data.length; offset += INFLATE_CHUNK) {
      const end = Math.min(data.length, offset + INFLATE_CHUNK);
      inflater.push(data.subarray(offset, end), end === data.length);
    }
  } catch (error) {
    return overflow ? 'descompressão excede o tamanho declarado (possível bomba de descompressão)' : `fluxo DEFLATE inválido: ${error instanceof Error ? error.message : String(error)}`;
  }
  if (written !== expected) return `tamanho descomprimido ${written} difere do declarado ${expected}`;
  return out;
}

/**
 * Lê um ZIP não confiável. `allow` decide quais nomes (já validados contra traversal) são aceitos; diretórios
 * vazios são ignorados. Qualquer violação recusa o arquivo inteiro, antes de devolver dados.
 */
export function readZip(bytes: Uint8Array, limits: ZipLimits, allow: (name: string) => boolean = () => true): ZipReadResult {
  if (bytes.length > limits.maxArchiveBytes) return failure('TOO_LARGE', `arquivo de ${bytes.length} bytes excede o limite de ${limits.maxArchiveBytes}`);
  if (bytes.length < 22) return failure('NOT_ZIP', 'arquivo curto demais para ser um ZIP');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== SIG_LOCAL) return failure('NOT_ZIP', 'assinatura ZIP ausente no início do arquivo');
  const eocd = findEndOfCentralDirectory(view);
  if (eocd < 0) return failure('NOT_ZIP', 'fim do diretório central não encontrado');
  if (eocd >= 20 && view.getUint32(eocd - 20, true) === SIG_ZIP64_LOCATOR) return failure('UNSUPPORTED', 'ZIP64 não é aceito');
  const disk = view.getUint16(eocd + 4, true);
  const cdDisk = view.getUint16(eocd + 6, true);
  const onDisk = view.getUint16(eocd + 8, true);
  const total = view.getUint16(eocd + 10, true);
  const cdSize = view.getUint32(eocd + 12, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  if (disk !== 0 || cdDisk !== 0 || onDisk !== total) return failure('UNSUPPORTED', 'ZIP multivolume não é aceito');
  if (total === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) return failure('UNSUPPORTED', 'ZIP64 não é aceito');
  if (total > limits.maxEntries) return failure('TOO_MANY_ENTRIES', `${total} entradas; o limite é ${limits.maxEntries}`);
  if (cdOffset + cdSize > eocd) return failure('CORRUPT', 'diretório central fora dos limites do arquivo');

  const central: CentralEntry[] = [];
  const names = new Set<string>();
  let declaredTotal = 0;
  let p = cdOffset;
  for (let i = 0; i < total; i += 1) {
    if (p + 46 > cdOffset + cdSize || view.getUint32(p, true) !== SIG_CENTRAL) return failure('CORRUPT', `entrada ${i} do diretório central inválida`);
    const madeBy = view.getUint16(p + 4, true) >>> 8;
    const flags = view.getUint16(p + 8, true);
    const method = view.getUint16(p + 10, true);
    const crc = view.getUint32(p + 16, true);
    const compressedSize = view.getUint32(p + 20, true);
    const size = view.getUint32(p + 24, true);
    const nameLength = view.getUint16(p + 28, true);
    const extraLength = view.getUint16(p + 30, true);
    const commentLength = view.getUint16(p + 32, true);
    const externalAttributes = view.getUint32(p + 38, true);
    const localOffset = view.getUint32(p + 42, true);
    const next = p + 46 + nameLength + extraLength + commentLength;
    if (next > cdOffset + cdSize) return failure('CORRUPT', `entrada ${i} ultrapassa o diretório central`);
    const nameBytes = bytes.subarray(p + 46, p + 46 + nameLength);
    p = next;
    if (flags & 0x0001 || flags & 0x0040) return failure('ENCRYPTED', 'entradas criptografadas não são aceitas');
    // Links simbólicos (atributos Unix S_IFLNK) nunca são aceitos (R-080).
    if (madeBy === 3 && ((externalAttributes >>> 16) & 0o170000) === 0o120000) return failure('SYMLINK', 'links simbólicos não são aceitos no arquivo');
    if (compressedSize === 0xffffffff || size === 0xffffffff || localOffset === 0xffffffff) return failure('UNSUPPORTED', 'ZIP64 não é aceito');
    const name = decodeName(nameBytes, (flags & 0x0800) !== 0);
    if (name === null) return failure('BAD_NAME', `nome da entrada ${i} com codificação inválida`);
    const problem = unsafeEntryName(name);
    if (problem) return failure('BAD_NAME', `entrada "${name.slice(0, 80)}": ${problem}`);
    const key = name.toLowerCase();
    if (names.has(key)) return failure('DUPLICATE_NAME', `entrada duplicada: ${name}`);
    names.add(key);
    if (name.endsWith('/')) {
      if (size !== 0) return failure('CORRUPT', `diretório com conteúdo: ${name}`);
      continue;
    }
    if (!allow(name)) return failure('NOT_ALLOWED', `entrada não prevista no formato: ${name}`);
    if (method !== 0 && method !== 8) return failure('UNSUPPORTED', `método de compressão ${method} não suportado (${name})`);
    if (size > limits.maxEntryBytes) return failure('TOO_LARGE', `${name} declara ${size} bytes; o limite por entrada é ${limits.maxEntryBytes}`);
    declaredTotal += size;
    if (declaredTotal > limits.maxTotalBytes) return failure('TOO_LARGE', `conteúdo expandido excede ${limits.maxTotalBytes} bytes`);
    if (method === 0 && compressedSize !== size) return failure('CORRUPT', `${name}: entrada sem compressão com tamanhos divergentes`);
    central.push({ name, method, crc, compressedSize, size, localOffset, nameBytes });
  }
  if (p !== cdOffset + cdSize) return failure('CORRUPT', 'tamanho do diretório central não confere');

  // Cabeçalhos locais coerentes e dados sem sobreposição (bombas por sobreposição de entradas).
  const spans: { start: number; end: number; entry: CentralEntry; dataStart: number }[] = [];
  for (const entry of central) {
    const at = entry.localOffset;
    if (at + 30 > cdOffset || view.getUint32(at, true) !== SIG_LOCAL) return failure('CORRUPT', `cabeçalho local ausente para ${entry.name}`);
    const localNameLength = view.getUint16(at + 26, true);
    const localExtraLength = view.getUint16(at + 28, true);
    const localName = bytes.subarray(at + 30, at + 30 + localNameLength);
    if (!sameBytes(localName, entry.nameBytes)) return failure('CORRUPT', `nome do cabeçalho local difere do diretório central (${entry.name})`);
    const dataStart = at + 30 + localNameLength + localExtraLength;
    const end = dataStart + entry.compressedSize;
    if (end > cdOffset) return failure('CORRUPT', `dados de ${entry.name} invadem o diretório central`);
    spans.push({ start: at, end, entry, dataStart });
  }
  spans.sort((a, b) => a.start - b.start);
  for (let i = 1; i < spans.length; i += 1) {
    if (spans[i]!.start < spans[i - 1]!.end) return failure('CORRUPT', `entradas sobrepostas: ${spans[i - 1]!.entry.name} e ${spans[i]!.entry.name}`);
  }

  const entries = new Map<string, Uint8Array>();
  for (const { entry, dataStart } of spans) {
    const data = bytes.subarray(dataStart, dataStart + entry.compressedSize);
    const out = entry.method === 0 ? data.slice() : inflateBounded(data, entry.size);
    if (typeof out === 'string') return failure(out.includes('bomba') ? 'TOO_LARGE' : 'CORRUPT', `${entry.name}: ${out}`);
    if (crc32(out) !== entry.crc) return failure('CORRUPT', `${entry.name}: CRC-32 não confere (arquivo danificado)`);
    entries.set(entry.name, out);
  }
  return { ok: true, entries };
}
