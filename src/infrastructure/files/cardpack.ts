// `.card.json` e `.cardpack.zip` formato 1 (editor-de-cartas.md §29; persistencia §24.2–§24.3, §25).
// Escrita com fflate (determinística: mtime fixo, ordem estável). Leitura defensiva: o diretório central é
// lido e conferido ANTES de qualquer descompressão (entradas, nomes permitidos, anti-traversal, links
// simbólicos, criptografia, duplicatas, ZIP aninhado, limites declarados) e cada entrada é inflada num
// buffer do tamanho declarado com conferência de CRC-32 e tamanho real (bomba que mente o tamanho falha).
// Testes anexos voltam como relatório da importação; nunca viram linhas de card_test_runs.
// Os auxiliares de ZIP ficam neste módulo de propósito (os genéricos de saves vivem em files/zip.ts).
import { inflateSync, zipSync, type Zippable } from 'fflate';
import type { CardpackContents, PackTestFile } from '../../application/studio.ts';
import type { CardDefinition, CardPrinting } from '../../domain/cards/types.ts';
import { sniffImage } from '../../domain/editor/media.ts';
import {
  CARDPACK_LIMITS, classifyEntryName, EXT_MEDIA, isFormatIssue, MEDIA_EXT, parseCardJson, parseManifest, scanActiveContent, type CardJsonDoc,
  type CardpackManifest, type FormatIssue,
} from '../../domain/editor/formats.ts';
import { jcsHash, sha256Hex } from '../../domain/hash/jcs.ts';

export type ReadResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly issues: readonly FormatIssue[] };

const FIXED_MTIME = new Date('2026-01-01T00:00:00Z');

// ---------------------------------------------------------------- `.card.json`

export function writeCardJson(doc: CardJsonDoc): string {
  return `${JSON.stringify(doc, null, 2)}\n`;
}

export function readCardJson(input: Uint8Array | string): ReadResult<CardJsonDoc> {
  const size = typeof input === 'string' ? new TextEncoder().encode(input).length : input.length;
  if (size > CARDPACK_LIMITS.maxCardJsonBytes) return { ok: false, issues: [{ code: 'LIMIT_EXCEEDED', message: `Arquivo acima de ${CARDPACK_LIMITS.maxCardJsonBytes / 1048576} MiB.` }] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(typeof input === 'string' ? input : new TextDecoder('utf-8', { fatal: true }).decode(input));
  } catch {
    return { ok: false, issues: [{ code: 'FORMAT_INVALID', message: 'O arquivo não é JSON UTF-8 válido.' }] };
  }
  const r = parseCardJson(parsed);
  return r.ok ? { ok: true, value: r.doc } : { ok: false, issues: r.issues };
}

// ---------------------------------------------------------------- escrita do pacote

const json = (value: unknown): Uint8Array => new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);

export function cardpackEntries(contents: CardpackContents): Record<string, Uint8Array> {
  const files: Record<string, Uint8Array> = { 'manifest.json': json(contents.manifest) };
  for (const card of contents.cards) files[`cards/${card.id}/${card.version}.json`] = json(card);
  for (const p of contents.printings) files[`printings/${p.printingId}.json`] = json(p);
  for (const a of contents.assets) files[`assets/${a.sha256}.${MEDIA_EXT[a.mediaType] ?? 'bin'}`] = a.bytes;
  for (const t of contents.tests) files[`tests/${t.testId}.json`] = json(t);
  return files;
}

export function writeCardpack(contents: CardpackContents): Uint8Array {
  const entries = cardpackEntries(contents);
  const zippable: Zippable = {};
  for (const name of Object.keys(entries).sort()) {
    const data = entries[name]!;
    // Imagens já são comprimidas: armazenadas sem deflate.
    zippable[name] = [data, { level: name.startsWith('assets/') ? 0 : 6, mtime: FIXED_MTIME }];
  }
  return zipSync(zippable, { mtime: FIXED_MTIME });
}

// ---------------------------------------------------------------- leitura defensiva do ZIP

export type ZipEntry = {
  readonly name: string;
  readonly method: number;
  readonly flags: number;
  readonly crc32: number;
  readonly compressedSize: number;
  readonly size: number;
  readonly localOffset: number;
  readonly symlink: boolean;
  readonly directory: boolean;
};

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function issue(code: string, message: string, path?: string): FormatIssue {
  return path === undefined ? { code, message } : { code, message, path };
}

/** Lista as entradas pelo diretório central, sem descomprimir nada. */
export function listZipEntries(bytes: Uint8Array): ReadResult<ZipEntry[]> {
  if (bytes.length < 22) return { ok: false, issues: [issue('ZIP_INVALID', 'Arquivo pequeno demais para ser um ZIP.')] };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return { ok: false, issues: [issue('ZIP_INVALID', 'Fim do diretório central não encontrado.')] };
  const disk = view.getUint16(eocd + 4, true);
  const cdDisk = view.getUint16(eocd + 6, true);
  const count = view.getUint16(eocd + 10, true);
  const cdSize = view.getUint32(eocd + 12, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  if (disk !== 0 || cdDisk !== 0) return { ok: false, issues: [issue('ZIP_INVALID', 'ZIP multivolume não é aceito.')] };
  if (count === 0xffff || cdOffset === 0xffffffff) return { ok: false, issues: [issue('ZIP_UNSUPPORTED', 'ZIP64 não é aceito neste formato.')] };
  if (count > CARDPACK_LIMITS.maxEntries) return { ok: false, issues: [issue('LIMIT_EXCEEDED', `Pacote com ${count} entradas; o limite é ${CARDPACK_LIMITS.maxEntries}.`)] };
  if (cdOffset + cdSize > eocd) return { ok: false, issues: [issue('ZIP_INVALID', 'Diretório central fora dos limites do arquivo.')] };
  const entries: ZipEntry[] = [];
  let p = cdOffset;
  const decoder = new TextDecoder('utf-8', { fatal: false });
  for (let i = 0; i < count; i += 1) {
    if (p + 46 > bytes.length || view.getUint32(p, true) !== 0x02014b50) return { ok: false, issues: [issue('ZIP_INVALID', 'Entrada do diretório central corrompida.')] };
    const madeBy = view.getUint16(p + 4, true);
    const flags = view.getUint16(p + 8, true);
    const method = view.getUint16(p + 10, true);
    const crc = view.getUint32(p + 16, true);
    const compressedSize = view.getUint32(p + 20, true);
    const size = view.getUint32(p + 24, true);
    const nameLength = view.getUint16(p + 28, true);
    const extraLength = view.getUint16(p + 30, true);
    const commentLength = view.getUint16(p + 32, true);
    const external = view.getUint32(p + 38, true);
    const localOffset = view.getUint32(p + 42, true);
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLength));
    const unixMode = (madeBy >>> 8) === 3 ? (external >>> 16) & 0o170000 : 0;
    entries.push({ name, method, flags, crc32: crc, compressedSize, size, localOffset, symlink: unixMode === 0o120000, directory: name.endsWith('/') });
    p += 46 + nameLength + extraLength + commentLength;
  }
  return { ok: true, value: entries };
}

/** Infla uma entrada num buffer do tamanho declarado e confere CRC-32 + tamanho real. */
function extract(bytes: Uint8Array, entry: ZipEntry): ReadResult<Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const o = entry.localOffset;
  if (o + 30 > bytes.length || view.getUint32(o, true) !== 0x04034b50) return { ok: false, issues: [issue('ZIP_INVALID', 'Cabeçalho local corrompido.', entry.name)] };
  const start = o + 30 + view.getUint16(o + 26, true) + view.getUint16(o + 28, true);
  const end = start + entry.compressedSize;
  if (end > bytes.length) return { ok: false, issues: [issue('ZIP_INVALID', 'Dados da entrada fora do arquivo.', entry.name)] };
  const raw = bytes.subarray(start, end);
  let out: Uint8Array;
  try {
    if (entry.method === 0) out = raw.slice();
    else out = inflateSync(raw, { out: new Uint8Array(entry.size) });
  } catch {
    return { ok: false, issues: [issue('ZIP_INVALID', 'Falha ao descomprimir a entrada.', entry.name)] };
  }
  if (out.length !== entry.size || crc32(out) !== entry.crc32) {
    return { ok: false, issues: [issue('ZIP_SIZE_MISMATCH', 'Conteúdo expandido não corresponde ao tamanho/CRC declarados (possível bomba de descompressão).', entry.name)] };
  }
  return { ok: true, value: out };
}

function parseJsonEntry(data: Uint8Array, name: string): ReadResult<unknown> {
  try {
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data)) as unknown;
    const active = scanActiveContent(value, name);
    return active.length ? { ok: false, issues: active } : { ok: true, value };
  } catch {
    return { ok: false, issues: [issue('FORMAT_INVALID', 'JSON inválido.', name)] };
  }
}

/**
 * Lê e valida um `.cardpack.zip` sem executar nada: estrutura/limites → conteúdo → hashes declarados
 * (JCS para documentos, SHA-256 para bytes; o nome do arquivo não prova o hash).
 */
export function readCardpack(bytes: Uint8Array): ReadResult<CardpackContents> {
  if (bytes.length > CARDPACK_LIMITS.maxCompressedBytes) return { ok: false, issues: [issue('LIMIT_EXCEEDED', `Pacote acima de ${CARDPACK_LIMITS.maxCompressedBytes / 1048576} MiB.`)] };
  const listed = listZipEntries(bytes);
  if (!listed.ok) return listed;
  const issues: FormatIssue[] = [];
  const seen = new Set<string>();
  let declared = 0;
  const files: ZipEntry[] = [];
  for (const e of listed.value) {
    const lower = e.name.toLowerCase();
    if (seen.has(lower)) issues.push(issue('DUPLICATE_ENTRY', 'Entrada duplicada no pacote.', e.name));
    seen.add(lower);
    if (e.symlink) issues.push(issue('SYMLINK_NOT_ALLOWED', 'Links simbólicos não são permitidos.', e.name));
    if (e.flags & 0x1) issues.push(issue('ZIP_ENCRYPTED', 'Entradas criptografadas não são aceitas.', e.name));
    if (e.method !== 0 && e.method !== 8) issues.push(issue('ZIP_UNSUPPORTED', `Método de compressão ${e.method} não suportado.`, e.name));
    const kind = classifyEntryName(e.name);
    if (isFormatIssue(kind)) { issues.push(kind); continue; }
    if (kind.kind === 'DIRECTORY') continue;
    const limit = kind.kind === 'ASSET' ? CARDPACK_LIMITS.maxAssetBytes : CARDPACK_LIMITS.maxJsonBytes;
    if (e.size > limit) issues.push(issue('LIMIT_EXCEEDED', `Entrada declara ${e.size} bytes; o limite é ${limit}.`, e.name));
    declared += e.size;
    files.push(e);
  }
  if (declared > CARDPACK_LIMITS.maxExpandedBytes) issues.push(issue('LIMIT_EXCEEDED', `Expansão declarada de ${declared} bytes acima de ${CARDPACK_LIMITS.maxExpandedBytes}.`));
  if (!files.some((f) => f.name === 'manifest.json')) issues.push(issue('MANIFEST_MISSING', 'manifest.json ausente.'));
  if (issues.length) return { ok: false, issues };

  let expanded = 0;
  let manifest: CardpackManifest | null = null;
  const cards: CardDefinition[] = [];
  const printings: CardPrinting[] = [];
  const assets: { sha256: string; mediaType: string; bytes: Uint8Array }[] = [];
  const tests: PackTestFile[] = [];
  for (const e of files) {
    const data = extract(bytes, e);
    if (!data.ok) return data;
    expanded += data.value.length;
    if (expanded > CARDPACK_LIMITS.maxExpandedBytes) return { ok: false, issues: [issue('LIMIT_EXCEEDED', 'Expansão real acima do limite.')] };
    const kind = classifyEntryName(e.name);
    if (isFormatIssue(kind) || kind.kind === 'DIRECTORY') continue;
    if (kind.kind === 'ASSET') {
      const hash = sha256Hex(data.value);
      if (hash !== kind.sha256) { issues.push(issue('ASSET_HASH_MISMATCH', 'Bytes do asset não correspondem ao SHA-256 do nome.', e.name)); continue; }
      const sniff = sniffImage(data.value);
      if (!sniff.ok) { issues.push(issue(sniff.code, sniff.message, e.name)); continue; }
      if (EXT_MEDIA[kind.ext] !== sniff.mediaType) { issues.push(issue('ASSET_TYPE_MISMATCH', `Extensão .${kind.ext} não corresponde ao conteúdo (${sniff.mediaType}).`, e.name)); continue; }
      assets.push({ sha256: hash, mediaType: sniff.mediaType, bytes: data.value });
      continue;
    }
    const parsed = parseJsonEntry(data.value, e.name);
    if (!parsed.ok) { issues.push(...parsed.issues); continue; }
    if (kind.kind === 'MANIFEST') {
      const m = parseManifest(parsed.value);
      if (!m.ok) issues.push(...m.issues);
      else manifest = m.manifest;
    } else if (kind.kind === 'CARD') {
      const card = parsed.value as CardDefinition;
      if (!card || typeof card !== 'object' || card.id !== kind.definitionId || card.version !== kind.version) issues.push(issue('CARD_PATH_MISMATCH', 'Documento não corresponde a cards/<definitionId>/<version>.json.', e.name));
      else cards.push(card);
    } else if (kind.kind === 'PRINTING') {
      const p = parsed.value as CardPrinting;
      if (!p || typeof p !== 'object' || p.printingId !== kind.printingId) issues.push(issue('PRINTING_PATH_MISMATCH', 'Documento não corresponde a printings/<printingId>.json.', e.name));
      else printings.push(p);
    } else if (kind.kind === 'TEST') {
      const t = parsed.value as PackTestFile;
      if (!t || typeof t !== 'object' || t.testId !== kind.testId) issues.push(issue('TEST_PATH_MISMATCH', 'Documento não corresponde a tests/<testId>.json.', e.name));
      else tests.push(t);
    }
  }
  if (!manifest) return { ok: false, issues: issues.length ? issues : [issue('MANIFEST_INVALID', 'manifest.json inválido.')] };
  // Coerência manifesto ↔ arquivos (hashes recalculados).
  for (const c of manifest.cards) {
    const card = cards.find((x) => x.id === c.definitionId && x.version === c.version);
    if (!card) issues.push(issue('CARD_MISSING', `Carta ${c.definitionId} v${c.version} listada e ausente.`, '/cards'));
    else if (jcsHash(card) !== c.rulesHash) issues.push(issue('RULES_HASH_MISMATCH', `rulesHash de ${c.definitionId} v${c.version} não confere (JCS).`, `cards/${c.definitionId}/${c.version}.json`));
  }
  for (const card of cards) if (!manifest.cards.some((c) => c.definitionId === card.id && c.version === card.version)) issues.push(issue('UNDECLARED_ENTRY', 'Carta fora do manifesto.', `cards/${card.id}/${card.version}.json`));
  for (const p of manifest.printings) {
    const printing = printings.find((x) => x.printingId === p.printingId);
    if (!printing) issues.push(issue('PRINTING_MISSING', `Impressão ${p.printingId} listada e ausente.`, '/printings'));
    else if (jcsHash(printing) !== p.appearanceHash) issues.push(issue('APPEARANCE_HASH_MISMATCH', `appearanceHash de ${p.printingId} não confere.`, `printings/${p.printingId}.json`));
  }
  for (const p of printings) {
    if (!manifest.printings.some((x) => x.printingId === p.printingId)) issues.push(issue('UNDECLARED_ENTRY', 'Impressão fora do manifesto.', `printings/${p.printingId}.json`));
    if (!cards.some((c) => c.id === p.cardDefinitionId && c.version === p.cardDefinitionVersion)) issues.push(issue('PRINTING_ORPHAN', 'Impressão sem a carta correspondente no pacote.', `printings/${p.printingId}.json`));
  }
  for (const a of manifest.assets) {
    const asset = assets.find((x) => x.sha256 === a.sha256);
    if (!asset) issues.push(issue('ASSET_MISSING', `Asset ${a.sha256.slice(0, 12)}… listado e ausente.`, '/assets'));
    else if (asset.bytes.length !== a.bytes || asset.mediaType !== a.mediaType) issues.push(issue('ASSET_DECLARATION_MISMATCH', 'bytes/mediaType declarados não conferem.', `assets/${a.sha256}`));
  }
  for (const a of assets) if (!manifest.assets.some((x) => x.sha256 === a.sha256)) issues.push(issue('UNDECLARED_ENTRY', 'Asset fora do manifesto.', `assets/${a.sha256}`));
  for (const t of manifest.tests) if (!tests.some((x) => x.testId === t.testId)) issues.push(issue('TEST_MISSING', `Teste ${t.testId} listado e ausente.`, '/tests'));
  if (issues.length) return { ok: false, issues };
  return { ok: true, value: { manifest, cards, printings, assets, tests } };
}

/** Distingue `.card.json` de `.cardpack.zip` pela assinatura (não pela extensão). */
export function detectInterchange(bytes: Uint8Array): 'CARDPACK' | 'CARD_JSON' | 'UNKNOWN' {
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return 'CARDPACK';
  let i = 0;
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) i = 3;
  while (i < bytes.length && (bytes[i] === 0x20 || bytes[i] === 0x0a || bytes[i] === 0x0d || bytes[i] === 0x09)) i += 1;
  return bytes[i] === 0x7b ? 'CARD_JSON' : 'UNKNOWN';
}
