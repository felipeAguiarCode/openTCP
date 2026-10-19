// Catálogo e decks iniciais para testes do motor (campanha.md §3.5).
import { buildCatalog, type Catalog } from '../../domain/cards/catalog.ts';
import type { CardDefinition, CardPrinting, EnergyType } from '../../domain/cards/types.ts';
import { definitionKey } from '../../domain/cards/types.ts';
import type { DeckCard } from '../../domain/battle/setup.ts';
import { printing } from '../../content/builders.ts';
import * as S from './generic-cards.ts';

export function starterCatalog(extraDefs: CardDefinition[] = [], extraPrintings: CardPrinting[] = []): Catalog {
  const defs: CardDefinition[] = [...S.STARTER_POKEMON, ...S.STARTER_TRAINERS, ...extraDefs];
  const prints = [...S.STARTER_POKEMON, ...S.STARTER_TRAINERS].map((card, i) => printing({ card, setId: 'base', number: i + 1, rarity: 'COMMON' }));
  return buildCatalog(defs, [...prints, ...extraPrintings, ...extraDefs.map((card, i) => printing({ card, setId: 'test', number: i + 1, rarity: 'COMMON' }))]);
}

export function printingOf(cat: Catalog, def: CardDefinition): string {
  for (const [id, p] of cat.printings) if (p.cardDefinitionId === def.id && p.finish === 'NORMAL') return id;
  throw new Error(`sem impressão para ${def.id}`);
}

function deckOf(cat: Catalog, cards: CardDefinition[]): DeckCard[] {
  return cards.flatMap((def) => {
    const pid = printingOf(cat, def);
    const key = definitionKey(def.id, def.version);
    return [{ printingId: pid, definitionKey: key }, { printingId: pid, definitionKey: key }];
  });
}

export const TRAINERS = [S.kitReparo, S.rastreador, S.trocaTatica, S.estudioso, S.mentoria, S.talisma];

export function starterDeck(cat: Catalog, kind: 'FIRE' | 'WATER' | 'GRASS'): { deck: DeckCard[]; energyTypes: EnergyType[] } {
  const lines: Record<typeof kind, CardDefinition[]> = {
    FIRE: [S.faisca, S.braseiro, S.carvito, S.brasacu],
    WATER: [S.gota, S.marulho, S.nimbo, S.pluvion],
    GRASS: [S.broto, S.folhariz, S.semente, S.ramante],
  };
  return { deck: deckOf(cat, [...lines[kind], ...TRAINERS]), energyTypes: [kind] };
}

export { S };
