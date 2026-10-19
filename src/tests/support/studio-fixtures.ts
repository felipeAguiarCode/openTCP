// Fixtures do Estúdio para testes: o rascunho do exemplo normativo (editor §33, Braseiro ex) lido de
// .specs/examples, o catálogo inicial como contexto de validação e um PNG mínimo real (assinatura + IHDR).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import * as S from './generic-cards.ts';
import { printing } from '../../content/builders.ts';
import type { CardDefinition, CardPrinting } from '../../domain/cards/types.ts';
import type { EditorDraft } from '../../domain/editor/draft.ts';

export const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');

export function readSpecJson<T>(relative: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, '.specs', relative), 'utf8')) as T;
}

/** Rascunho completo do exemplo da spec (Braseiro ex, duas impressões, cenários coin-0/1/2). */
export function exampleDraft(): EditorDraft {
  return readSpecJson<EditorDraft>('examples/editor-project.example.json');
}

export const STARTER_DEFS: readonly CardDefinition[] = [...S.STARTER_POKEMON, ...S.STARTER_TRAINERS];
export const STARTER_PRINTS: readonly CardPrinting[] = STARTER_DEFS.map((card, i) => printing({ card, setId: 'base', number: i + 1, rarity: 'COMMON' }));

function crc32(bytes: Uint8Array): number {
  let c = ~0;
  for (const b of bytes) {
    c ^= b;
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** PNG RGBA válido de `width × height` com cor sólida (bytes reais, decodificáveis). */
export function tinyPng(width = 2, height = 2, rgba: readonly [number, number, number, number] = [239, 120, 91, 255], extraChunk?: { type: string; data: Uint8Array }): Uint8Array {
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, width);
  v.setUint32(4, height);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = new Uint8Array(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const row = y * (1 + width * 4);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) raw.set(rgba, row + 1 + x * 4);
  }
  const idat = new Uint8Array(zlib.deflateSync(raw));
  const parts = [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr)];
  if (extraChunk) parts.push(chunk(extraChunk.type, extraChunk.data));
  parts.push(chunk('IDAT', idat), chunk('IEND', new Uint8Array(0)));
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
