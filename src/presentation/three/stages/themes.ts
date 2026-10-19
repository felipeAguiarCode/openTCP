// Identidade visual por capítulo (direção visual §8.4, §13.3; interface §20.6): paleta dos playmats do
// catálogo base, padrão procedural e bioma do diorama. Dado de apresentação — nunca muda regras.
import type { PatternId } from '../card/patterns.ts';

export type BiomeId = 'ACADEMY' | 'FOREST' | 'HARBOR' | 'POWERPLANT' | 'OBSERVATORY' | 'FOUNDRY' | 'ARCHIVE' | 'FINALE';

export type ChapterTheme = {
  readonly chapterId: string;
  readonly biome: BiomeId;
  /** [base clara, apoio, terciária, acento] — mesma ordem das paletas de playmat (content/source/cosmetics.ts). */
  readonly palette: readonly [string, string, string, string];
  readonly accent: string;
  readonly pattern: PatternId;
};

export const CHAPTER_THEMES: Readonly<Record<string, ChapterTheme>> = {
  P00: { chapterId: 'P00', biome: 'ACADEMY', palette: ['#FFFFFF', '#CFE8FB', '#DCD6F7', '#357DE4'], accent: '#357DE4', pattern: 'LINES' },
  C01: { chapterId: 'C01', biome: 'FOREST', palette: ['#DFF5E3', '#B9E4C0', '#A7D8F5', '#72B75D'], accent: '#72B75D', pattern: 'LEAVES' },
  C02: { chapterId: 'C02', biome: 'HARBOR', palette: ['#BFE9FA', '#8EE3E0', '#F3E6C8', '#2DECE5'], accent: '#22B8C9', pattern: 'WAVES' },
  C03: { chapterId: 'C03', biome: 'POWERPLANT', palette: ['#EEF5FC', '#FFF1B8', '#9BE7F0', '#E8C83E'], accent: '#D9B21F', pattern: 'CIRCUITS' },
  C04: { chapterId: 'C04', biome: 'OBSERVATORY', palette: ['#E7DDF5', '#D6E4F7', '#E9ECF2', '#A279CB'], accent: '#A279CB', pattern: 'STARS' },
  C05: { chapterId: 'C05', biome: 'FOUNDRY', palette: ['#E6EAEE', '#FBD9C9', '#F5F7F9', '#EF785B'], accent: '#EF785B', pattern: 'SYMBOLS' },
  C06: { chapterId: 'C06', biome: 'ARCHIVE', palette: ['#FBF8EF', '#D3EAFB', '#E3DDF5', '#75C7FA'], accent: '#4FA9E8', pattern: 'PAGES' },
  F00: { chapterId: 'F00', biome: 'FINALE', palette: ['#FFFFFF', '#C8FAF5', '#DCD6F7', '#F6CE3D'], accent: '#E2B21B', pattern: 'CHAPTERS' },
};

export const CHAPTER_ORDER: readonly string[] = ['P00', 'C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'F00'];

export function themeOf(chapterId: string | null | undefined): ChapterTheme {
  return CHAPTER_THEMES[chapterId ?? ''] ?? CHAPTER_THEMES.P00!;
}

/**
 * Pacotes reais → cenário do capítulo de mesma temática: Pikachu na usina, Charizard e os de Fogo na fundição, os
 * psíquicos/lunares no observatório, os de Água no porto, Dialga e as Ultracriaturas no arquivo, Arceus e o Deluxe na
 * final, Eevee no bosque; Promo-A na academia e Promo-B na usina.
 */
const PACK_THEME: Readonly<Record<string, string>> = {
  'pack-a1-pikachu': 'C03', 'pack-a1-charizard': 'C05', 'pack-a1-mewtwo': 'C04',
  'pack-a1a-mew': 'C04', 'pack-a2-dialga': 'C06', 'pack-a2-palkia': 'C02', 'pack-a2a-arceus': 'F00',
  'pack-a3-solgaleo': 'C05', 'pack-a3-lunala': 'C04', 'pack-a3a': 'C06', 'pack-a3b': 'C01',
  'pack-a4-lugia': 'C02', 'pack-a4-ho-oh': 'C05', 'pack-a4a': 'C02', 'pack-a4b': 'F00',
  'pack-pa-promo': 'P00', 'pack-pb-promo': 'C03',
};

/** Tema de um produto de pacote pelo ID (`pack-a1-pikachu` → C03; `pack-c02-v1` → C02; base/arquivo → academia/final). */
export function themeOfProduct(productId: string): ChapterTheme {
  const real = PACK_THEME[productId.toLowerCase()];
  if (real) return themeOf(real);
  const m = /pack-c(\d\d)/i.exec(productId);
  if (m) return themeOf(`C${m[1]}`);
  if (/archive/i.test(productId)) return themeOf('F00');
  return themeOf('P00');
}
