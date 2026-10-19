// Pacotes dos sets do Pocket depois do A1 (campanha §15.2, §16): taxas oficiais por símbolo (pocket/rates.ts), pool
// de cada pacote, 6ª carta dos bebês (A4, A4a), pacote raro e os dois pacotes promocionais. Todos custam 100 Créditos e
// ficam à venda desde o início. Pool de um pacote = impressões dele + as do set que não pertencem a nenhum pacote
// (fora os bebês, que só saem na 6ª carta); dentro do símbolo, a chance é uniforme.
import { raritySymbol, type RaritySymbol } from '../../../domain/cards/rarity.ts';
import type { CardPrinting } from '../../../domain/cards/types.ts';
import type { Product, TierPools } from '../../types.ts';
import { pocketPrintingId, type PocketPrintingSpec } from './cards.ts';
import { BABY_BONUS, RARE_PACK, TIER_TABLES } from './rates.ts';
import { pocketSet } from './registry.ts';

export const POCKET_PACK_PRICE = 100;

/** Os 14 pacotes novos: id, set, chave do pacote no registro (null = o set inteiro), nome e número da capa. */
export const POCKET_PACKS: readonly {
  readonly productId: string; readonly set: string; readonly pack: string | null; readonly name: string; readonly cover: number;
}[] = [
  { productId: 'pack-a1a-mew', set: 'A1a', pack: 'mew', name: 'Mythical Island — Mew', cover: 32 },
  { productId: 'pack-a2-dialga', set: 'A2', pack: 'dialga', name: 'Space-Time Smackdown — Dialga', cover: 119 },
  { productId: 'pack-a2-palkia', set: 'A2', pack: 'palkia', name: 'Space-Time Smackdown — Palkia', cover: 49 },
  { productId: 'pack-a2a-arceus', set: 'A2a', pack: 'arceus', name: 'Triumphant Light — Arceus', cover: 71 },
  { productId: 'pack-a3-solgaleo', set: 'A3', pack: 'solgaleo', name: 'Celestial Guardians — Solgaleo', cover: 122 },
  { productId: 'pack-a3-lunala', set: 'A3', pack: 'lunala', name: 'Celestial Guardians — Lunala', cover: 87 },
  { productId: 'pack-a3a', set: 'A3a', pack: null, name: 'Extradimensional Crisis', cover: 6 },
  { productId: 'pack-a3b', set: 'A3b', pack: null, name: 'Eevee Grove', cover: 56 },
  { productId: 'pack-a4-lugia', set: 'A4', pack: 'lugia', name: 'Wisdom of Sea and Sky — Lugia', cover: 149 },
  { productId: 'pack-a4-ho-oh', set: 'A4', pack: 'ho-oh', name: 'Wisdom of Sea and Sky — Ho-Oh', cover: 34 },
  { productId: 'pack-a4a', set: 'A4a', pack: null, name: 'Secluded Springs', cover: 20 },
  { productId: 'pack-a4b', set: 'A4b', pack: null, name: 'Deluxe Pack ex', cover: 131 },
  { productId: 'pack-pa-promo', set: 'P-A', pack: null, name: 'Pacote Promo-A', cover: 9 },
  { productId: 'pack-pb-promo', set: 'P-B', pack: null, name: 'Pacote Promo-B', cover: 99 },
];

/** Impressões agrupadas por símbolo, na ordem do número de coleção. */
function bySymbol(printings: readonly CardPrinting[]): TierPools {
  const out: Partial<Record<RaritySymbol, string[]>> = {};
  for (const p of printings) (out[raritySymbol(p)] ??= []).push(p.printingId);
  return out;
}

/**
 * Produto de um pacote novo. `printings` são as impressões do set na ordem do número e `specs` a origem de cada uma
 * (mesmo índice): pacote, 6ª carta e se é uma das 6 promos antigas (que já vêm na coleção inicial).
 */
export function pocketPackProduct(m: (typeof POCKET_PACKS)[number], printings: readonly CardPrinting[], specs: readonly PocketPrintingSpec[], legacy: (spec: PocketPrintingSpec) => boolean): Product {
  const set = pocketSet(m.set);
  if (set.rates === 'LEGACY_A1') throw new Error(`${m.productId}: o A1 usa os pacotes legados`);
  const table = TIER_TABLES[set.rates];
  const inPack = (s: PocketPrintingSpec) => s.pack === null || s.pack === m.pack;
  const pick = (keep: (s: PocketPrintingSpec) => boolean) => printings.filter((_, i) => keep(specs[i]!));
  const promo = set.kind === 'PROMO';
  return {
    productId: m.productId, version: 1, name: m.name, kind: 'RANDOM_PACK', price: { credits: POCKET_PACK_PRICE },
    availability: { fromStart: true, afterNodeId: null }, repeatable: true, cardsPerPack: table.length,
    tierSlots: table.map((weights, i) => ({ position: i + 1, weights })),
    tierPools: bySymbol(pick((s) => inPack(s) && !s.bonus && !legacy(s))),
    ...(set.babyBonus ? { bonusSlot: { chance: BABY_BONUS.chance, weights: BABY_BONUS.weights, pools: bySymbol(pick((s) => inPack(s) && s.bonus)) } } : {}),
    ...(promo ? {} : { rarePack: { chance: RARE_PACK.chance, symbols: RARE_PACK.symbols } }),
    coverPrintingId: pocketPrintingId(m.set, m.cover),
  };
}
