// Imagem local do tapete (interface §23.26): bytes do asset → URL local de objeto (cache por assetId) e
// recorte 4:3 aplicado por CSS sobre uma caixa 4:3 que cobre a mesa. Asset ausente → indicação recuperável e
// tapete neutro, sem bloquear nada (UI-113).
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { CustomMatImage } from '../../../application/appearance.ts';
import { ctx } from '../app/store.ts';

const urls = new Map<string, Promise<string | null>>();

/** URL de objeto para um asset do banco; null se o asset não existir ou não puder ser lido. */
export function assetObjectUrl(assetId: string): Promise<string | null> {
  const cached = urls.get(assetId);
  if (cached) return cached;
  const game = ctx.value;
  const p = (async () => {
    if (!game) return null;
    try {
      const row = await game.storage.query({ kind: 'GET_ASSET', assetId });
      if (!row) return null;
      return URL.createObjectURL(new Blob([row.bytes as BlobPart], { type: row.mediaType }));
    } catch {
      return null;
    }
  })();
  urls.set(assetId, p);
  // Falha não fica em cache: o usuário pode restaurar o backup e tentar de novo.
  void p.then((u) => { if (!u) urls.delete(assetId); });
  return p;
}

export type MatImageState = { readonly url: string | null; readonly missing: boolean };

export function useMatImage(image: CustomMatImage | null | undefined): MatImageState {
  const [state, setState] = useState<MatImageState>({ url: null, missing: false });
  const assetId = image?.assetId ?? null;
  useEffect(() => {
    let alive = true;
    if (!assetId) { setState({ url: null, missing: false }); return; }
    void assetObjectUrl(assetId).then((url) => { if (alive) setState({ url, missing: !url }); });
    return () => { alive = false; };
  }, [assetId]);
  return state;
}

/** Estilo de uma caixa 4:3 que mostra só o recorte normalizado (sem distorcer a imagem). */
export function cropStyle(url: string, image: CustomMatImage): Record<string, string> {
  const { x, y, w, h } = image.crop;
  const pos = (offset: number, size: number) => (size >= 1 ? 0 : (offset / (1 - size)) * 100);
  return {
    backgroundColor: image.baseHex,
    backgroundImage: `url("${url}")`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${100 / w}% ${100 / h}%`,
    backgroundPosition: `${pos(x, w)}% ${pos(y, h)}%`,
  };
}

/** Superfície 4:3 que cobre o contêiner (centralizada), com o recorte da imagem do tapete. */
export function MatImageSurface({ image, state, class: cls }: { readonly image: CustomMatImage; readonly state: MatImageState; readonly class?: string }): JSX.Element | null {
  if (!state.url) return null;
  return <div class={`mat-image-surface ${cls ?? ''}`} style={cropStyle(state.url, image)} aria-hidden="true" />;
}

/**
 * Imagem exibida na mesa segundo a preferência de tapete (interface §23.16): a do jogador do turno, sempre a
 * minha ou neutro. Só aparências com imagem local têm o que exibir; o resto usa o tapete procedural.
 */
export function displayedMatImage(presentation: unknown, mode: 'TURN_OWNER' | 'PLAYER_FIXED' | 'NEUTRAL', humanTurn: boolean): CustomMatImage | null {
  if (mode === 'NEUTRAL') return null;
  const cos = (presentation as { cosmetics?: { player?: { customImage?: CustomMatImage | null }; opponent?: { customImage?: CustomMatImage | null } } } | null)?.cosmetics;
  const owner = mode === 'PLAYER_FIXED' || humanTurn ? cos?.player : cos?.opponent;
  return owner?.customImage ?? null;
}

