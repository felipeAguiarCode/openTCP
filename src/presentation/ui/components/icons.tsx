// Ícones simples em SVG inline (sem fontes de ícones remotas). Símbolos de tipo desenhados
// proceduralmente, os mesmos glifos usados no placeholder da janela de arte.
import type { JSX } from 'preact';
import type { CostType, PokemonType } from '../../../domain/cards/types.ts';
import { TYPE_LABEL } from '../../../domain/cards/text.ts';

type IconProps = { readonly size?: number; readonly title?: string; readonly class?: string };

const paths: Record<string, string> = {
  home: 'M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z',
  campaign: 'M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2zM9 4v14M15 6v14',
  challenges: 'M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z',
  arena: 'M5 19 19 5M15 5h4v4M5 5l6 6M13 13l6 6M5 15v4h4',
  collection: 'M5 4h10a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zM17 7h2v13M8 8h6M8 12h6',
  decks: 'M7 3h10v14H7zM4 6h2v14h10v1H4z',
  recipe: 'M6 3h10a2 2 0 0 1 2 2v16l-7-3-7 3V5a2 2 0 0 1 2-2zM9 8h6M9 12h4',
  packs: 'M7 3h10l1 4H6zM6 7h12v13H6zM9 11h6',
  emporium: 'M4 9h16l-1 11H5zM8 9V7a4 4 0 0 1 8 0v2',
  create: 'M4 20l4-1 11-11-3-3L5 16zM14 6l3 3',
  saves: 'M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.5',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2 .3-1.3-1.3.3-2-3-1-1 2h-2l-1-2-3 1 .3 2L6 7.3 4 7 3 10l2 1v2l-2 1 1 3 2-.3L7.3 18 7 20l3 1 1-2h2l1 2 3-1-.3-2 1.3-1.3 2 .3 1-3-2-1z',
  back: 'M15 5l-7 7 7 7',
  close: 'M6 6l12 12M18 6 6 18',
  check: 'M5 12l5 5 9-10',
  warning: 'M12 4 2 20h20zM12 10v4M12 17v.5',
  credits: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v10M9 9.5c0-1.2 1.3-2 3-2s3 .8 3 2-1.3 1.8-3 2.2-3 1-3 2.3 1.3 2 3 2 3-.8 3-2',
  pack: 'M7 3h10l1 4H6zM6 7h12v13H6z',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM16 16l4 4',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z',
  play: 'M8 5l11 7-11 7z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  pause: 'M8 5h3v14H8zM13 5h3v14h-3z',
  history: 'M12 21a9 9 0 1 0-9-9M3 4v5h5M12 7v5l3 2',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  star: 'M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  medal: 'M8 3h8l-2 6h-4zM12 21a6 6 0 1 0 0-12 6 6 0 0 0 0 12z',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
  trash: 'M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13',
  edit: 'M4 20l4-1 11-11-3-3L5 16z',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
  flag: 'M5 21V4h11l-2 4 2 4H5',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.5',
  coin: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  map: 'M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2z',
  sparkle: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
  undo: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-4',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  palette: 'M12 3a9 9 0 0 0 0 18c1.4 0 2-1 2-2s-1-1.6-1-2.6c0-1.2 1-1.9 2.1-1.9H17a4 4 0 0 0 4-4c0-4.1-4-7.5-9-7.5zM7.5 11.5h.01M10 7.5h.01M15 7.5h.01',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 9.5h.01',
  wand: 'M5 19 15 9M14 4v3M19 9h-3M17.5 5.5l-2 2M10 4.5v1.5M19.5 13H18',
};

export type IconName = keyof typeof paths;

export function Icon({ name, size = 22, title, class: cls }: IconProps & { readonly name: IconName }): JSX.Element {
  return (
    <svg class={`icon ${cls ?? ''}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden={title ? undefined : 'true'} role={title ? 'img' : undefined}>
      {title ? <title>{title}</title> : null}
      <path d={paths[name]} />
    </svg>
  );
}

/** Glifo geométrico por tipo (o mesmo vocabulário do placeholder de arte e do 3D). */
const typeGlyph: Record<PokemonType, string> = {
  GRASS: 'M12 4c5 3 6 9 0 16-6-7-5-13 0-16zM12 8v10',
  FIRE: 'M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 3-6 0 2 1 3 2 3 0-3-1-5 1-8z',
  WATER: 'M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z',
  LIGHTNING: 'M13 2 5 14h6l-1 8 8-12h-6z',
  PSYCHIC: 'M12 5c5 0 8 7 8 7s-3 7-8 7-8-7-8-7 3-7 8-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  FIGHTING: 'M7 10V6a2 2 0 0 1 4 0v4-5a2 2 0 0 1 4 0v5-3a2 2 0 0 1 4 0v6a7 7 0 0 1-7 7h-1a6 6 0 0 1-6-6v-3a2 2 0 0 1 2-2z',
  DARKNESS: 'M15 4a8 8 0 1 0 5 13A7 7 0 0 1 15 4z',
  METAL: 'M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9zM12 8l3.5 2v4L12 16l-3.5-2v-4z',
  DRAGON: 'M4 18c4-1 6-4 7-9 1 4 4 6 9 6-3 2-6 3-9 3s-5 1-7 0z',
  COLORLESS: 'M12 4l2.4 5.6L20 12l-5.6 2.4L12 20l-2.4-5.6L4 12l5.6-2.4z',
};

export function TypeIcon({ type, size = 22, label = true }: { readonly type: CostType | PokemonType; readonly size?: number; readonly label?: boolean }): JSX.Element {
  const t = type as PokemonType;
  return (
    <span class={`type-icon type-${t.toLowerCase()}`} style={{ width: `${size}px`, height: `${size}px` }} role={label ? 'img' : undefined} aria-label={label ? TYPE_LABEL[t] : undefined} aria-hidden={label ? undefined : 'true'} title={label ? TYPE_LABEL[t] : undefined}>
      <svg viewBox="0 0 24 24" width={size * 0.66} height={size * 0.66} fill="#fff" stroke="none" aria-hidden="true">
        <path d={typeGlyph[t]} fill-rule="evenodd" />
      </svg>
    </span>
  );
}

export function typeGlyphPath(type: PokemonType): string {
  return typeGlyph[type];
}
