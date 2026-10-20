// Arte das impressões em “Impressão completa” (FULL_PRINTING, editor-de-cartas §18): a imagem já é a carta inteira,
// então a face HTML e a face 3D não desenham moldura, nome, PS, ataques nem rodapé por cima dela. Duas origens:
// - arte empacotada: `artKey` `art:<set>:<NNN>` → src/presentation/assets/cards/<set>/<SET>-<NNN>.webp (conferida
//   por `npm run assets:import`; o Vite publica com hash, sem rede — runtime §20.1, §20.5);
// - arte importada no Estúdio: `artAssetId` (BLOB no SQLite), por um resolvedor instalado no boot.
import type { CardFaceData } from '../../domain/cards/text.ts';

const BUNDLED: Readonly<Record<string, string>> = import.meta.glob<string>('./cards/*/*.webp', { query: '?url', import: 'default', eager: true });

/** URL local da arte empacotada (`art:a1:001` → cards/a1/A1-001.webp); null se a chave não tem arquivo no pacote. */
export function bundledArtUrl(artKey: string | null | undefined): string | null {
  const m = artKey ? /^art:([a-z0-9]+):(\d{3})$/.exec(artKey) : null;
  if (!m) return null;
  return BUNDLED[`./cards/${m[1]}/${m[1]!.toUpperCase()}-${m[2]}.webp`] ?? null;
}

export type PrintedArtFace = Pick<CardFaceData, 'artMode' | 'artKey' | 'artAssetId'>;

/** Identidade da imagem de uma face em Impressão completa (null nos outros modos ou sem arte). */
export function printedArtSource(face: PrintedArtFace | null | undefined): string | null {
  if (!face || face.artMode !== 'FULL_PRINTING') return null;
  if (face.artKey) return `key:${face.artKey}`;
  if (face.artAssetId) return `asset:${face.artAssetId}`;
  return null;
}

let assetResolver: ((assetId: string) => Promise<string | null>) | null = null;
const assetUrls = new Map<string, Promise<string | null>>();

/** Instalado no boot: devolve um object URL do BLOB do asset (ou null se ausente). Um URL por asset, reaproveitado. */
export function installArtAssetResolver(resolve: ((assetId: string) => Promise<string | null>) | null): void {
  assetResolver = resolve;
  assetUrls.clear();
}

/** URL já conhecida sem esperar (arte empacotada); arte importada precisa de `printedArtUrl`. */
export function printedArtUrlNow(face: PrintedArtFace | null | undefined): string | null {
  const source = printedArtSource(face);
  return source?.startsWith('key:') ? bundledArtUrl(face!.artKey) : null;
}

/** URL da imagem da Impressão completa (empacotada ou importada); null se não há ou não resolve. */
export function printedArtUrl(face: PrintedArtFace | null | undefined): Promise<string | null> {
  const source = printedArtSource(face);
  if (!source) return Promise.resolve(null);
  if (source.startsWith('key:')) return Promise.resolve(bundledArtUrl(face!.artKey));
  const assetId = face!.artAssetId!;
  if (!assetResolver) return Promise.resolve(null);
  let url = assetUrls.get(assetId);
  if (!url) {
    url = assetResolver(assetId).catch(() => null);
    assetUrls.set(assetId, url);
  }
  return url;
}
