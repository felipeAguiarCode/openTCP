// Registro dos sets do Pokémon TCG Pocket que o conteúdo conhece, na ordem canônica (ordem de lançamento, promos
// junto da série). A ordem decide ids de carta quando dois sets trazem cartas diferentes com o mesmo nome (a primeira
// fica com o id simples), então set novo entra sempre no fim. TS puro: o importador (tools/inspo-import) também usa.

/** Tabela de taxas dos pacotes do set (campanha §16.2): A1 mantém as do projeto; os demais seguem as oficiais. */
export type PocketRates = 'LEGACY_A1' | 'CLASSIC' | 'SHINY' | 'DELUXE' | 'PROMO';

export type PocketSet = {
  /** Código do Pocket (A1a, P-B…). */
  readonly code: string;
  /** Prefixo de printingId e artKey (`a1a`); a arte fica em `cards/<setId>/<SETID>-NNN.webp`. */
  readonly setId: string;
  /** Pasta em `.inspo/decks/`. */
  readonly folder: string;
  readonly name: string;
  readonly kind: 'BOOSTER' | 'PROMO';
  readonly rates: PocketRates;
  /** Rótulo do campo `pack` da origem → chave do pacote (null na origem = em todos os pacotes do set). */
  readonly packs: Readonly<Record<string, string>>;
  /** 6ª carta só com bebês (Wisdom of Sea and Sky e Secluded Springs). */
  readonly babyBonus: boolean;
  /** Conferências do importador: impressões, brilhantes [✵, ✵✵] e números das impressões só da 6ª carta. */
  readonly expect: { readonly printings: number; readonly shiny: readonly [number, number]; readonly bonus: readonly number[] };
};

export const POCKET_SETS: readonly PocketSet[] = [
  { code: 'A1', setId: 'a1', folder: 'Genetic Apex (A1)', name: 'Genetic Apex', kind: 'BOOSTER', rates: 'LEGACY_A1', babyBonus: false,
    packs: { 'Pikachu pack': 'pikachu', 'Charizard pack': 'charizard', 'Mewtwo pack': 'mewtwo' }, expect: { printings: 286, shiny: [0, 0], bonus: [] } },
  { code: 'P-A', setId: 'pa', folder: 'Promo-A (P-A)', name: 'Promo-A', kind: 'PROMO', rates: 'PROMO', babyBonus: false,
    packs: {}, expect: { printings: 117, shiny: [0, 0], bonus: [] } },
  { code: 'A1a', setId: 'a1a', folder: 'Mythical Island (A1a)', name: 'Mythical Island', kind: 'BOOSTER', rates: 'CLASSIC', babyBonus: false,
    packs: { 'Mew pack': 'mew' }, expect: { printings: 86, shiny: [0, 0], bonus: [] } },
  { code: 'A2', setId: 'a2', folder: 'Space-Time Smackdown (A2)', name: 'Space-Time Smackdown', kind: 'BOOSTER', rates: 'CLASSIC', babyBonus: false,
    packs: { 'Dialga pack': 'dialga', 'Palkia pack': 'palkia' }, expect: { printings: 207, shiny: [0, 0], bonus: [] } },
  { code: 'A2a', setId: 'a2a', folder: 'Triumphant Light (A2a)', name: 'Triumphant Light', kind: 'BOOSTER', rates: 'CLASSIC', babyBonus: false,
    packs: { 'Arceus pack': 'arceus' }, expect: { printings: 96, shiny: [0, 0], bonus: [] } },
  { code: 'A3', setId: 'a3', folder: 'Celestial Guardians (A3)', name: 'Celestial Guardians', kind: 'BOOSTER', rates: 'SHINY', babyBonus: false,
    packs: { 'Solgaleo pack': 'solgaleo', 'Lunala pack': 'lunala' }, expect: { printings: 239, shiny: [20, 8], bonus: [] } },
  { code: 'A3a', setId: 'a3a', folder: 'Extradimensional Crisis (A3a)', name: 'Extradimensional Crisis', kind: 'BOOSTER', rates: 'SHINY', babyBonus: false,
    packs: {}, expect: { printings: 103, shiny: [10, 4], bonus: [] } },
  { code: 'A3b', setId: 'a3b', folder: 'Eevee Grove (A3b)', name: 'Eevee Grove', kind: 'BOOSTER', rates: 'SHINY', babyBonus: false,
    packs: {}, expect: { printings: 107, shiny: [10, 4], bonus: [] } },
  { code: 'A4', setId: 'a4', folder: 'Wisdom of Sea and Sky (A4)', name: 'Wisdom of Sea and Sky', kind: 'BOOSTER', rates: 'SHINY', babyBonus: true,
    packs: { 'Lugia pack': 'lugia', 'Ho-Oh pack': 'ho-oh' }, expect: { printings: 241, shiny: [20, 8], bonus: [32, 66, 70, 75, 77, 101, 166, 171] } },
  { code: 'A4a', setId: 'a4a', folder: 'Secluded Springs (A4a)', name: 'Secluded Springs', kind: 'BOOSTER', rates: 'SHINY', babyBonus: true,
    packs: {}, expect: { printings: 105, shiny: [10, 4], bonus: [23, 59, 63, 77] } },
  { code: 'A4b', setId: 'a4b', folder: 'Deluxe Pack ex (A4b)', name: 'Deluxe Pack ex', kind: 'BOOSTER', rates: 'DELUXE', babyBonus: false,
    packs: {}, expect: { printings: 379, shiny: [0, 2], bonus: [] } },
  { code: 'P-B', setId: 'pb', folder: 'Promo-B (P-B)', name: 'Promo-B', kind: 'PROMO', rates: 'PROMO', babyBonus: false,
    packs: {}, expect: { printings: 103, shiny: [0, 0], bonus: [] } },
];

export function pocketSet(code: string): PocketSet {
  const s = POCKET_SETS.find((x) => x.code === code || x.setId === code);
  if (!s) throw new Error(`set desconhecido: ${code}`);
  return s;
}
