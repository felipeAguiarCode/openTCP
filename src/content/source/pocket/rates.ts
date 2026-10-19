// Taxas oficiais dos pacotes do Pokémon TCG Pocket (campanha §16.2), em milésimos de ponto percentual (soma 100000
// por posição). Fontes cruzadas: valores por carta do Serebii (que fecham com as somas, ex.: A1 ◊◊ 2,571% × 35 = 90%;
// A3 ✵ 0,071% × 10 = 0,714%), pocketcards.net, Destructoid (Deluxe Pack ex), Game8 e TheGamer (6ª carta).
// Duas tabelas oficiais somam 99,999%; o milésimo que falta vai para o maior símbolo (DELUXE ◊◊◊ e bebês ◊◊◊).
import type { TierWeights } from '../../types.ts';
import type { PocketRates } from './registry.ts';

const COMMONS: TierWeights = { '◊': 100000 };

/** Era clássica (A1a, A2, A2a): sem brilhantes. */
const CLASSIC: readonly TierWeights[] = [
  COMMONS, COMMONS, COMMONS,
  { '◊◊': 90000, '◊◊◊': 5000, '◊◊◊◊': 1666, '☆': 2572, '☆☆': 500, '☆☆☆': 222, '♛': 40 },
  { '◊◊': 60000, '◊◊◊': 20000, '◊◊◊◊': 6664, '☆': 10288, '☆☆': 2000, '☆☆☆': 888, '♛': 160 },
];

/** Era dos brilhantes (A3, A3a, A3b, A4, A4a). */
const SHINY: readonly TierWeights[] = [
  COMMONS, COMMONS, COMMONS,
  { '◊◊': 89000, '◊◊◊': 4953, '◊◊◊◊': 1666, '☆': 2572, '☆☆': 500, '☆☆☆': 222, '✵': 714, '✵✵': 333, '♛': 40 },
  { '◊◊': 56000, '◊◊◊': 19810, '◊◊◊◊': 6664, '☆': 10288, '☆☆': 2000, '☆☆☆': 888, '✵': 2857, '✵✵': 1333, '♛': 160 },
];

/** Deluxe Pack ex (A4b): 4 cartas, a última sempre ◊◊◊◊. */
const DELUXE: readonly TierWeights[] = [
  COMMONS,
  { '◊◊': 82270, '◊': 17730 },
  { '◊◊◊': 40660, '◊': 23021, '◊◊': 17985, '☆': 12858, '☆☆': 2500, '☆☆☆': 1111, '✵✵': 1667, '♛': 198 },
  { '◊◊◊◊': 100000 },
];

/** Pacote promocional (inventado, uniforme): 5 cartas, todas PROMO. */
const PROMO: readonly TierWeights[] = Array.from({ length: 5 }, () => ({ PROMO: 100000 }));

export const TIER_TABLES: Readonly<Record<Exclude<PocketRates, 'LEGACY_A1'>, readonly TierWeights[]>> = { CLASSIC, SHINY, DELUXE, PROMO };

/** 6ª carta (A4, A4a): 8,330% dos pacotes normais; 29,033% para cada um dos três bebês ◊◊◊ e 12,900% para o ☆. */
export const BABY_BONUS = { chance: 8330, weights: { '◊◊◊': 87100, '☆': 12900 } as TierWeights } as const;

/** Pacote raro: 0,050% dos pacotes; cada carta uniforme entre todas as ☆ ou acima do pool. */
export const RARE_PACK = { chance: 50, symbols: ['☆', '☆☆', '☆☆☆', '✵', '✵✵', '♛'] } as const;
