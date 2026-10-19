// Inspeção de imagens ANTES da decodificação (editor-de-cartas.md §18, §32; runtime pipeline de importação):
// assinatura real dos bytes (PNG, JPEG, WebP estáticos), dimensões lidas do cabeçalho e recusa de
// SVG/GIF/APNG/WebP animado/executáveis disfarçados. O nome ou a extensão do arquivo nunca provam o tipo.

export const ART_LIMITS = {
  /** 10 MiB por entrada. */
  maxBytes: 10 * 1024 * 1024,
  maxAxis: 4096,
  maxPixels: 16_777_216,
  /** Lado maior do master normalizado (o recorte continua não destrutivo sobre ele). */
  masterMaxAxis: 2048,
  thumbnailAxis: 256,
} as const;

export type ImageMediaType = 'image/png' | 'image/jpeg' | 'image/webp';

export type SniffOk = { readonly ok: true; readonly mediaType: ImageMediaType; readonly width: number; readonly height: number };
export type SniffError = { readonly ok: false; readonly code: string; readonly message: string };
export type SniffResult = SniffOk | SniffError;

const fail = (code: string, message: string): SniffError => ({ ok: false, code, message });

function startsWith(bytes: Uint8Array, sig: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false;
  return sig.every((b, i) => bytes[offset + i] === b);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let out = '';
  for (let i = offset; i < offset + length && i < bytes.length; i += 1) out += String.fromCharCode(bytes[i]!);
  return out;
}

const u32be = (b: Uint8Array, o: number) => ((b[o]! << 24) | (b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!) >>> 0;
const u16be = (b: Uint8Array, o: number) => (b[o]! << 8) | b[o + 1]!;
const u16le = (b: Uint8Array, o: number) => b[o]! | (b[o + 1]! << 8);
const u24le = (b: Uint8Array, o: number) => b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16);

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function sniffPng(b: Uint8Array): SniffResult {
  if (b.length < 33 || ascii(b, 12, 4) !== 'IHDR') return fail('IMAGE_CORRUPT', 'PNG sem cabeçalho IHDR válido.');
  const width = u32be(b, 16);
  const height = u32be(b, 20);
  // APNG: chunk acTL antes do primeiro IDAT.
  let offset = 8;
  for (let guard = 0; guard < 10000 && offset + 8 <= b.length; guard += 1) {
    const length = u32be(b, offset);
    const type = ascii(b, offset + 4, 4);
    if (type === 'acTL') return fail('IMAGE_ANIMATED', 'PNG animado (APNG) não é aceito nesta versão.');
    if (type === 'IDAT' || type === 'IEND') break;
    offset += 12 + length;
  }
  return { ok: true, mediaType: 'image/png', width, height };
}

function sniffJpeg(b: Uint8Array): SniffResult {
  let offset = 2;
  for (let guard = 0; guard < 10000 && offset + 4 <= b.length; guard += 1) {
    if (b[offset] !== 0xff) return fail('IMAGE_CORRUPT', 'JPEG com marcador inválido.');
    const marker = b[offset + 1]!;
    if (marker === 0xff) { offset += 1; continue; }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { offset += 2; continue; }
    if (marker === 0xd9 || marker === 0xda) break;
    const length = u16be(b, offset + 2);
    const sof = (marker >= 0xc0 && marker <= 0xcf) && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (sof) {
      if (offset + 9 > b.length) break;
      return { ok: true, mediaType: 'image/jpeg', height: u16be(b, offset + 5), width: u16be(b, offset + 7) };
    }
    offset += 2 + length;
  }
  return fail('IMAGE_CORRUPT', 'JPEG sem dimensões (SOF) legíveis.');
}

function sniffWebp(b: Uint8Array): SniffResult {
  const chunk = ascii(b, 12, 4);
  if (chunk === 'VP8X') {
    const flags = b[20]!;
    if (flags & 0x02) return fail('IMAGE_ANIMATED', 'WebP animado não é aceito nesta versão.');
    return { ok: true, mediaType: 'image/webp', width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
  }
  if (chunk === 'VP8 ') {
    if (b.length < 30 || !startsWith(b, [0x9d, 0x01, 0x2a], 23)) return fail('IMAGE_CORRUPT', 'WebP (VP8) com cabeçalho inválido.');
    return { ok: true, mediaType: 'image/webp', width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    if (b.length < 25 || b[20] !== 0x2f) return fail('IMAGE_CORRUPT', 'WebP (VP8L) com cabeçalho inválido.');
    const bits = (b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24)) >>> 0;
    return { ok: true, mediaType: 'image/webp', width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  return fail('IMAGE_CORRUPT', 'WebP com bloco desconhecido.');
}

/** Identifica o formato pela assinatura e confere limites de bytes, eixo e pixels sem decodificar a imagem. */
export function sniffImage(bytes: Uint8Array, limits: { readonly maxBytes?: number; readonly maxAxis?: number; readonly maxPixels?: number } = {}): SniffResult {
  const maxBytes = limits.maxBytes ?? ART_LIMITS.maxBytes;
  const maxAxis = limits.maxAxis ?? ART_LIMITS.maxAxis;
  const maxPixels = limits.maxPixels ?? ART_LIMITS.maxPixels;
  if (bytes.length === 0) return fail('IMAGE_EMPTY', 'Arquivo vazio.');
  if (bytes.length > maxBytes) return fail('IMAGE_TOO_LARGE', `Arquivo com ${(bytes.length / 1048576).toFixed(1)} MiB; o limite é ${(maxBytes / 1048576).toFixed(0)} MiB.`);
  let result: SniffResult;
  if (startsWith(bytes, PNG)) result = sniffPng(bytes);
  else if (startsWith(bytes, [0xff, 0xd8, 0xff])) result = sniffJpeg(bytes);
  else if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') result = sniffWebp(bytes);
  else if (ascii(bytes, 0, 4) === 'GIF8') return fail('IMAGE_ANIMATED', 'GIF não é aceito: use PNG, JPEG ou WebP estáticos.');
  else if (/^\s*(<\?xml|<svg|<!doctype|<html|<)/i.test(ascii(bytes, 0, 64))) return fail('IMAGE_ACTIVE_CONTENT', 'SVG/HTML não é aceito: pode conter conteúdo ativo.');
  else if (ascii(bytes, 0, 2) === 'MZ' || ascii(bytes, 1, 3) === 'ELF' || ascii(bytes, 0, 4) === '%PDF' || ascii(bytes, 0, 2) === 'PK' || ascii(bytes, 0, 2) === '#!') {
    return fail('IMAGE_DISGUISED', 'O arquivo não é uma imagem (executável, documento ou pacote disfarçado).');
  } else return fail('IMAGE_UNSUPPORTED', 'Formato não reconhecido: use PNG, JPEG ou WebP estáticos.');
  if (!result.ok) return result;
  if (result.width < 1 || result.height < 1) return fail('IMAGE_CORRUPT', 'Dimensões inválidas no cabeçalho.');
  if (result.width > maxAxis || result.height > maxAxis) return fail('IMAGE_TOO_LARGE', `Imagem com ${result.width}×${result.height} px; o limite é ${maxAxis} px por eixo.`);
  if (result.width * result.height > maxPixels) return fail('IMAGE_TOO_LARGE', `Imagem com ${result.width * result.height} pixels; o limite é ${maxPixels}.`);
  return result;
}

/** Tamanho do master normalizado: mantém proporção e limita o lado maior. */
export function fitWithin(width: number, height: number, maxAxis: number): { readonly width: number; readonly height: number } {
  const scale = Math.min(1, maxAxis / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Luminância (Rec. 709) de RGBA → tons de cinza: branco permite acabamento, preto bloqueia (§21). */
export function toMaskPixels(rgba: Uint8ClampedArray | Uint8Array): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    const a = rgba[i + 3]! / 255;
    const y = Math.round((0.2126 * rgba[i]! + 0.7152 * rgba[i + 1]! + 0.0722 * rgba[i + 2]!) * a);
    out[i] = y; out[i + 1] = y; out[i + 2] = y; out[i + 3] = 255;
  }
  return out;
}

/** Fração da máscara ≥ 50% de cinza: avisa máscara agressiva (cobre quase toda a carta). */
export function maskCoverage(gray: Uint8ClampedArray | Uint8Array): number {
  let on = 0;
  const n = gray.length / 4;
  for (let i = 0; i < gray.length; i += 4) if (gray[i]! >= 128) on += 1;
  return n ? on / n : 0;
}
