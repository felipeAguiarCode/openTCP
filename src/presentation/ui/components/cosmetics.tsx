// Prévias HTML/SVG de cosméticos procedurais (tapete, verso, moeda, flair) a partir da paleta e do
// padrão declarados no conteúdo — os mesmos dados que a cena 3D usa para gerar as texturas. Moedas do Pocket
// mostram a imagem da cara (assets/coins.ts).
import type { JSX } from 'preact';
import type { Cosmetic } from '../../../content/types.ts';
import { coinArtUrl } from '../../assets/coins.ts';
import { sleeveArtUrl } from '../../assets/sleeves.ts';

const PATTERNS: Record<Cosmetic['visual']['pattern'], (c: string) => JSX.Element | null> = {
  NONE: () => null,
  LINES: (c) => <pattern id="p" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><path d="M0 12h24" stroke={c} stroke-width="3" opacity="0.35" /></pattern>,
  LEAVES: (c) => <pattern id="p" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M20 6c9 5 9 17 0 28-9-11-9-23 0-28z" fill={c} opacity="0.28" /></pattern>,
  WAVES: (c) => <pattern id="p" width="48" height="24" patternUnits="userSpaceOnUse"><path d="M0 12q12-10 24 0t24 0" fill="none" stroke={c} stroke-width="3" opacity="0.35" /></pattern>,
  CIRCUITS: (c) => <pattern id="p" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M4 20h14v-12h18M20 20v16" fill="none" stroke={c} stroke-width="2.5" opacity="0.4" /><circle cx="18" cy="20" r="3" fill={c} opacity="0.5" /></pattern>,
  STARS: (c) => <pattern id="p" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M18 8l2.4 5.6L26 16l-5.6 2.4L18 24l-2.4-5.6L10 16l5.6-2.4z" fill={c} opacity="0.35" /></pattern>,
  SYMBOLS: (c) => <pattern id="p" width="36" height="36" patternUnits="userSpaceOnUse"><circle cx="18" cy="18" r="6" fill="none" stroke={c} stroke-width="2.5" opacity="0.4" /></pattern>,
  PAGES: (c) => <pattern id="p" width="40" height="30" patternUnits="userSpaceOnUse"><rect x="6" y="5" width="22" height="18" rx="2" fill="none" stroke={c} stroke-width="2" opacity="0.35" /></pattern>,
  CHAPTERS: (c) => <pattern id="p" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M22 6l16 16-16 16L6 22z" fill="none" stroke={c} stroke-width="2.5" opacity="0.35" /></pattern>,
};

export function CosmeticSwatch({ cosmetic, large = false }: { readonly cosmetic: Cosmetic; readonly large?: boolean }): JSX.Element {
  const [a = '#EAF4FA', b = '#86BCE7', accent = cosmetic.visual.accentHex] = cosmetic.visual.palette;
  const id = `g-${cosmetic.cosmeticId}`;
  const label = cosmetic.names['pt-BR'];
  if (cosmetic.kind === 'COIN') {
    // Moeda do Pocket: a cara empacotada.
    const art = coinArtUrl(cosmetic.visual.assetKey, 'HEADS');
    if (art) return <img class={`cosmetic-swatch coin is-art ${large ? 'large' : ''}`} src={art} alt={`Moeda ${label}`} draggable={false} />;
    return (
      <svg class={`cosmetic-swatch coin ${large ? 'large' : ''}`} viewBox="0 0 100 100" role="img" aria-label={`Moeda ${label}`}>
        <defs><radialGradient id={id} cx="35%" cy="30%"><stop offset="0" stop-color="#fff" /><stop offset="0.5" stop-color={a} /><stop offset="1" stop-color={b} /></radialGradient></defs>
        <circle cx="50" cy="50" r="46" fill={`url(#${id})`} stroke={accent} stroke-width="5" />
        <circle cx="50" cy="50" r="30" fill="none" stroke="#fff" stroke-width="3" opacity="0.8" />
      </svg>
    );
  }
  if (cosmetic.kind === 'FLAIR') {
    return (
      <svg class={`cosmetic-swatch flair ${large ? 'large' : ''}`} viewBox="0 0 100 100" role="img" aria-label={`Efeito de entrada ${label}`}>
        {[0, 1, 2, 3, 4, 5].map((i) => <circle key={i} cx={50 + Math.cos((i / 6) * Math.PI * 2) * 30} cy={50 + Math.sin((i / 6) * Math.PI * 2) * 30} r={6 + (i % 2) * 3} fill={i % 2 ? accent : b} opacity="0.75" />)}
        <circle cx="50" cy="50" r="12" fill={a} />
      </svg>
    );
  }
  const sleeve = cosmetic.kind === 'SLEEVE';
  // Sleeve do Pocket: a imagem do verso.
  const sleeveArt = sleeve ? sleeveArtUrl(cosmetic.visual.assetKey) : null;
  if (sleeveArt) return <img class={`cosmetic-swatch sleeve is-art ${large ? 'large' : ''}`} src={sleeveArt} alt={`Verso ${label}`} draggable={false} />;
  const vb = sleeve ? '0 0 63 88' : '0 0 160 120';
  return (
    <svg class={`cosmetic-swatch ${sleeve ? 'sleeve' : 'playmat'} ${large ? 'large' : ''}`} viewBox={vb} role="img" aria-label={`${sleeve ? 'Verso' : 'Tapete'} ${label}`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color={a} /><stop offset="1" stop-color={b} /></linearGradient>
        {PATTERNS[cosmetic.visual.pattern](accent)}
      </defs>
      <rect width="100%" height="100%" rx={sleeve ? 5 : 12} fill={`url(#${id})`} />
      {cosmetic.visual.pattern !== 'NONE' ? <rect width="100%" height="100%" rx={sleeve ? 5 : 12} fill="url(#p)" /> : null}
      {sleeve ? <rect x="4" y="4" width="55" height="80" rx="3" fill="none" stroke="#fff" stroke-width="2.5" opacity="0.8" /> : <rect x="8" y="8" width="144" height="104" rx="8" fill="none" stroke="#fff" stroke-width="2" opacity="0.6" />}
    </svg>
  );
}
