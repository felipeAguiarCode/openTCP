// Moeda em HTML (oficina do deck, Empório, cara ou coroa de abertura, resultado na mesa 2D): disco com a cara à frente e
// a coroa atrás, girando em X por CSS. Moedas do Pocket mostram as imagens empacotadas (assets/coins.ts); as demais, um
// desenho da paleta — o mesmo da moeda 3D.
import type { JSX } from 'preact';
import type { Cosmetic } from '../../../content/types.ts';
import { coinArtUrl, type CoinFace } from '../../assets/coins.ts';

export type CoinLike = Pick<Cosmetic, 'cosmeticId' | 'names'> & { readonly visual: Pick<Cosmetic['visual'], 'palette' | 'accentHex'> & { readonly assetKey?: string | null } };

function Face({ coin, face }: { readonly coin: CoinLike | null; readonly face: CoinFace }): JSX.Element {
  const url = coinArtUrl(coin?.visual.assetKey, face);
  if (url) return <img class={`coin-face coin-${face.toLowerCase()}`} src={url} alt="" draggable={false} />;
  const [a = '#F5C542', b = '#C9D3DC'] = coin?.visual.palette ?? [];
  const base = face === 'HEADS' ? a : b;
  return (
    <span class={`coin-face coin-${face.toLowerCase()} is-drawn`} style={{ '--coin-base': base, '--coin-edge': coin?.visual.accentHex ?? '#357DE4' } as JSX.CSSProperties}>
      {face === 'HEADS' ? <svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 22l7.6 17.6L76 42l-14 12.6L66 74 50 64.4 34 74l4-19.4L24 42l18.4-2.4z" fill="#fff" /></svg>
        : <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="18" fill="none" stroke="#fff" stroke-width="7" /><circle cx="50" cy="50" r="6" fill="#fff" /></svg>}
    </span>
  );
}

/**
 * Disco da moeda. `toss` anima o lançamento até a face pedida (sobe, gira e cai); sem ele, a face fica parada.
 * O `key` de quem usa deve mudar a cada lançamento para a animação recomeçar.
 */
export function CoinDisc({ coin, face, toss = false, size = 120, label, spins = 5, durationMs = 1400 }: {
  readonly coin: CoinLike | null; readonly face: CoinFace; readonly toss?: boolean; readonly size?: number; readonly label?: string;
  /** Voltas inteiras do lançamento (a coroa termina meia volta adiante) e a duração do giro. */
  readonly spins?: number; readonly durationMs?: number;
}): JSX.Element {
  const end = spins * 360 + (face === 'TAILS' ? 180 : 0);
  return (
    <span class={`coin-disc ${toss ? 'is-toss' : ''}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}
      style={{ '--coin-size': `${size}px`, '--coin-end': `${toss ? end : face === 'TAILS' ? 180 : 0}deg`, '--coin-ms': `${durationMs}ms` } as JSX.CSSProperties}>
      <span class="coin-lift">
        <span class="coin-body">
          <Face coin={coin} face="HEADS" />
          <Face coin={coin} face="TAILS" />
        </span>
      </span>
    </span>
  );
}
