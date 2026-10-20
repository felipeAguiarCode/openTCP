// Caixa de deck 3D (interface §13.6; referência .specs/referencias/decks, Pokémon TCG Pocket): caixa retangular em pé, em CSS
// 3D — na frente, a carta de capa inteira numa janela, com a tampa na cor da Energia principal em cima e a base clara
// embaixo; a lateral repete a divisão e leva o emblema do tipo; a tampa fecha em cima. Só apresentação: girar ou trocar
// a capa não muda o deck.
import type { JSX } from 'preact';
import type { CardFaceData } from '../../../domain/cards/text.ts';
import type { PokemonType } from '../../../domain/cards/types.ts';
import { printedArtUrlNow } from '../../assets/card-art.ts';
import { typeGlyphPath } from './icons.tsx';

export type DeckBoxSize = 'sm' | 'md' | 'lg';

export function DeckBox3D({ face, energyType, size = 'md', label }: {
  readonly face: CardFaceData | null; readonly energyType: string | null; readonly size?: DeckBoxSize; readonly label?: string;
}): JSX.Element {
  const typeId = (energyType ?? face?.types[0] ?? 'COLORLESS') as PokemonType;
  const art = printedArtUrlNow(face);
  return (
    <div class={`deck-box3d deck-box3d-${size} type-${typeId.toLowerCase()}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}>
      <div class="db-cube">
        <div class="db-face db-front">
          <span class="db-lid" />
          {art
            ? <img class="db-card" src={art} alt="" loading="lazy" decoding="async" draggable={false} />
            : <span class="db-card is-empty"><svg class="db-glyph" viewBox="0 0 24 24"><path d={typeGlyphPath(face?.types[0] ?? 'COLORLESS')} fill-rule="evenodd" /></svg></span>}
          <span class="db-gloss" />
        </div>
        <div class="db-face db-side">
          <span class="db-emblem"><svg viewBox="0 0 24 24"><path d={typeGlyphPath(typeId)} fill-rule="evenodd" /></svg></span>
        </div>
        <div class="db-face db-top" />
      </div>
      <span class="db-shadow" />
    </div>
  );
}
