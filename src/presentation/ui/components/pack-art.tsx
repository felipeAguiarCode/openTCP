// Pacote nas telas de pacotes, no Empório e nas caixas de menu: a frente oficial do booster quando empacotada
// (assets/pack-art.ts); sem ela (tutorial e promocionais), o pacote gerado com o gradiente do tipo da carta de capa.
import type { JSX } from 'preact';
import type { Product } from '../../../content/types.ts';
import { packArtUrl } from '../../assets/pack-art.ts';
import { content } from '../app/store.ts';
import { faceOf } from './cards.tsx';

export type PackArtSize = 'mini' | 'sm' | 'md' | 'lg';

export function PackArt({ product, owned = 0, size = 'md' }: { readonly product: Product; readonly owned?: number; readonly size?: PackArtSize }): JSX.Element {
  const url = packArtUrl(product.productId);
  const owner = owned > 0 && size !== 'mini' ? <span class="pack-owned">×{owned}</span> : null;
  if (url) {
    return (
      <div class={`pack-art has-art pack-${size}`} aria-hidden="true">
        <img src={url} alt="" decoding="async" loading="lazy" draggable={false} />
        {owner}
      </div>
    );
  }
  const c = content.value;
  const cover = c && product.coverPrintingId ? faceOf(c, product.coverPrintingId) : null;
  const t = (cover?.types[0] ?? 'COLORLESS').toLowerCase();
  return (
    <div class={`pack-art pack-${size} type-${t}`} aria-hidden="true">
      <div class="pack-seam" />
      {size === 'mini' ? null : <span class="pack-name">{product.name}</span>}
      {owner}
    </div>
  );
}
