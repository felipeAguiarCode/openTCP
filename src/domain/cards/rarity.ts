// Símbolos de raridade do Pokémon TCG Pocket sobre o modelo existente (rarity + finish + variant), sem mudar schema:
// ◊ COMMON · ◊◊ UNCOMMON · ◊◊◊ RARE · ◊◊◊◊ ULTRA (normal) · ☆ ULTRA holográfica · ☆☆ ULTRA foil ·
// ☆☆☆ ULTRA foil imersiva (variant.immersiveSceneId) · ✵ ULTRA holográfica brilhante · ✵✵ ULTRA foil brilhante
// (variant.shiny) · ♛ ULTRA cromada · PROMO.
import type { CardPrinting, Finish, Rarity } from './types.ts';

export const RARITY_SYMBOLS = ['◊', '◊◊', '◊◊◊', '◊◊◊◊', '☆', '☆☆', '☆☆☆', '✵', '✵✵', '♛'] as const;
export type RaritySymbol = (typeof RARITY_SYMBOLS)[number] | 'PROMO';

/** Cena imersiva genérica das impressões ☆☆☆ (sem cena 3D própria por enquanto). */
export const IMMERSIVE_SCENE_ID = 'a1-immersive';

export const SYMBOL_PRINT: Readonly<Record<RaritySymbol, { readonly rarity: Rarity; readonly finish: Finish; readonly immersive: boolean; readonly shiny?: true }>> = {
  '◊': { rarity: 'COMMON', finish: 'NORMAL', immersive: false },
  '◊◊': { rarity: 'UNCOMMON', finish: 'NORMAL', immersive: false },
  '◊◊◊': { rarity: 'RARE', finish: 'NORMAL', immersive: false },
  '◊◊◊◊': { rarity: 'ULTRA', finish: 'NORMAL', immersive: false },
  '☆': { rarity: 'ULTRA', finish: 'HOLOGRAPHIC', immersive: false },
  '☆☆': { rarity: 'ULTRA', finish: 'FOIL', immersive: false },
  '☆☆☆': { rarity: 'ULTRA', finish: 'FOIL', immersive: true },
  '✵': { rarity: 'ULTRA', finish: 'HOLOGRAPHIC', immersive: false, shiny: true },
  '✵✵': { rarity: 'ULTRA', finish: 'FOIL', immersive: false, shiny: true },
  '♛': { rarity: 'ULTRA', finish: 'CHROME', immersive: false },
  PROMO: { rarity: 'PROMO', finish: 'NORMAL', immersive: false },
};

/** Símbolo exibido de uma impressão (coleção, pacotes, Empório, face da carta, rótulos acessíveis). */
export function raritySymbol(p: Pick<CardPrinting, 'rarity' | 'finish'> & { readonly variant?: { readonly immersiveSceneId?: string | null; readonly shiny?: boolean } | null }): RaritySymbol {
  if (p.rarity === 'PROMO') return 'PROMO';
  if (p.rarity === 'COMMON') return '◊';
  if (p.rarity === 'UNCOMMON') return '◊◊';
  if (p.rarity === 'RARE') return '◊◊◊';
  if (p.finish === 'HOLOGRAPHIC') return p.variant?.shiny ? '✵' : '☆';
  if (p.finish === 'FOIL') return p.variant?.shiny ? '✵✵' : p.variant?.immersiveSceneId ? '☆☆☆' : '☆☆';
  if (p.finish === 'CHROME') return '♛';
  return '◊◊◊◊';
}

/** Ordem de raridade crescente (filtros e ordenação da coleção). */
export const RARITY_SYMBOL_ORDER: readonly RaritySymbol[] = [...RARITY_SYMBOLS, 'PROMO'];

/** Nome por extenso para leitores de tela. */
export const RARITY_SYMBOL_LABEL: Readonly<Record<RaritySymbol, string>> = {
  '◊': '1 losango', '◊◊': '2 losangos', '◊◊◊': '3 losangos', '◊◊◊◊': '4 losangos',
  '☆': '1 estrela', '☆☆': '2 estrelas', '☆☆☆': '3 estrelas', '✵': '1 estrela brilhante', '✵✵': '2 estrelas brilhantes', '♛': 'coroa',
  PROMO: 'promocional',
};
