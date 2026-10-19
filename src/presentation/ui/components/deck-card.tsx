// Cartão de deck das prateleiras (S11 “Escolha um baralho” e S51 “Receitas de deck”; referência .inspo/scene/deck):
// faixa na cor da Energia com o número ou um selo, a caixa 3D com a capa, duas cartas em destaque, o nome e a linha de
// estado — nas receitas, também a barra de quantas cartas a coleção já cobre.
import type { JSX } from 'preact';
import type { ContentIndex } from '../../../application/content.ts';
import type { CardFaceData } from '../../../domain/cards/text.ts';
import { CardFace, rankedFaces } from './cards.tsx';
import { DeckBox3D } from './deck-box.tsx';
import { Icon } from './icons.tsx';

/** Duas cartas em destaque ao lado da caixa: as mais “de capa” depois da própria capa. */
export function featuredOf(c: ContentIndex, printingIds: readonly string[], cover: CardFaceData | null): CardFaceData[] {
  return rankedFaces(c, printingIds).filter((f) => f.definitionKey !== cover?.definitionKey).slice(0, 2);
}

export function DeckCard({ number, badge, name, energyTypes, cover, featured, line, lineTone, progress, label, selected = false, onSelect, onOpen, testId }: {
  readonly number?: number | null; readonly badge?: string | null; readonly name: string; readonly energyTypes: readonly string[];
  readonly cover: CardFaceData | null; readonly featured: readonly CardFaceData[];
  /** Linha sob o nome (“20/20 · Favorito”, “Meta · A2 · Intermediária”). */
  readonly line: string; readonly lineTone?: 'ok' | 'bad' | null;
  /** Cartas da coleção sobre o total (receitas). */
  readonly progress?: { readonly owned: number; readonly total: number } | null;
  /** Complemento do nome acessível (“14 de 20 cartas, Favorito”). */
  readonly label: string; readonly selected?: boolean; readonly onSelect: () => void; readonly onOpen?: () => void; readonly testId?: string;
}): JSX.Element {
  const type = (energyTypes[0] ?? cover?.types[0] ?? 'COLORLESS').toLowerCase();
  const pct = progress ? Math.round((progress.owned / progress.total) * 100) : 0;
  return (
    <button type="button" class={`deck-card type-${type} ${selected ? 'is-selected' : ''}`} aria-pressed={onOpen ? selected : undefined} data-testid={testId}
      aria-label={`${name}, ${label}`} onClick={onSelect} onDblClick={onOpen}>
      <span class="deck-card-top">
        {number != null ? <span class="deck-card-number" aria-hidden="true">{number}</span> : null}
        {badge ? <span class="deck-card-badge" aria-hidden="true">{badge}</span> : null}
        <DeckBox3D face={cover} energyType={energyTypes[0] ?? null} size="md" />
        <span class="deck-card-featured" aria-hidden="true">{featured.map((f) => <CardFace key={f.printingId} face={f} size="xs" />)}</span>
      </span>
      <span class="deck-card-label">
        <span class="deck-card-name">{name}</span>
        <small class={lineTone ?? ''}>{line}</small>
        {progress ? (
          <span class={`deck-card-progress ${progress.owned === progress.total ? 'is-complete' : ''}`} aria-hidden="true">
            <span class="deck-card-bar"><span style={{ width: `${pct}%` }} /></span>
            <span>{progress.owned === progress.total ? 'Pronta para montar' : `${progress.owned}/${progress.total} na coleção`}</span>
          </span>
        ) : null}
      </span>
      {selected ? <span class="deck-card-check" aria-hidden="true"><Icon name="check" size={16} /></span> : null}
    </button>
  );
}
