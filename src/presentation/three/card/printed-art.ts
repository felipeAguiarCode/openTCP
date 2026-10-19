// Imagem da “Impressão completa” na face 3D (a carta impressa inteira). Carregada sob demanda, uma vez por fonte, com
// LRU limitado (decodificada, 367×512 RGBA ≈ 0,75 MB). Enquanto não chega — ou se falha — a face usa o template normal
// e é redesenhada quando a imagem fica pronta (mesmo esquema do verso, card-back.ts).
import type { CardFaceData } from '../../../domain/cards/text.ts';
import { printedArtSource, printedArtUrl } from '../../assets/card-art.ts';

type Entry = { state: 'LOADING' | 'READY' | 'FAILED'; image: HTMLImageElement | null };

const MAX_IMAGES = 96;
const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
let notifyScheduled = false;

function notify(): void {
  // Várias imagens chegando juntas (mão + campo) viram um único redesenho.
  if (notifyScheduled) return;
  notifyScheduled = true;
  setTimeout(() => {
    notifyScheduled = false;
    for (const cb of [...listeners]) cb();
  }, 0);
}

function evict(): void {
  for (const [key, e] of entries) {
    if (entries.size <= MAX_IMAGES) return;
    if (e.state !== 'LOADING') entries.delete(key);
  }
}

function load(source: string, face: Pick<CardFaceData, 'artMode' | 'artKey' | 'artAssetId'>, entry: Entry): void {
  if (typeof Image === 'undefined') {
    entry.state = 'FAILED';
    return;
  }
  void printedArtUrl(face).then((url) => {
    if (!url) {
      entry.state = 'FAILED';
      return;
    }
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      entry.image = img;
      entry.state = 'READY';
      if (entries.get(source) === entry) notify();
    };
    img.onerror = () => { entry.state = 'FAILED'; };
    img.src = url;
  });
}

/**
 * Imagem pronta da Impressão completa desta face (null se não é FULL_PRINTING, se ainda carrega ou se falhou) e uma
 * etiqueta do estado para a chave da textura (template provisório ≠ imagem final).
 */
export function printedArt(face: CardFaceData): { readonly image: HTMLImageElement | null; readonly tag: string } {
  const source = printedArtSource(face);
  if (!source) return { image: null, tag: 'none' };
  let entry = entries.get(source);
  if (entry) {
    entries.delete(source);
    entries.set(source, entry);
  } else {
    entry = { state: 'LOADING', image: null };
    entries.set(source, entry);
    evict();
    load(source, face, entry);
  }
  return { image: entry.state === 'READY' ? entry.image : null, tag: entry.state === 'READY' ? 'printed' : entry.state.toLowerCase() };
}

export function onPrintedArtReady(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
