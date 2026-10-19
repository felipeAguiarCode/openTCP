// Produtos do Empório e pacotes (campanha §15.2, §16), conteúdo 3.0.0: pacote tutorial fixo, os três pacotes reais do
// Genetic Apex (Pikachu, Charizard, Mewtwo) com as tabelas por categoria do projeto (§16.2), os 15 pacotes dos outros
// sets com as taxas oficiais por símbolo (pocket/packs.ts), cartas dirigidas para toda impressão não PROMO e
// cosméticos pagos. Pool de cada pacote = impressões daquele pacote + as que não pertencem a nenhum.
import { raritySymbol, type RaritySymbol } from '../../domain/cards/rarity.ts';
import type { CardPrinting, Rarity } from '../../domain/cards/types.ts';
import { definitionKey } from '../../domain/cards/types.ts';
import type { Product, RarityCategory } from '../types.ts';
import type { A1Pack } from './a1/cards.ts';
import { ALL_CARDS, ALL_PRINTINGS, P, PRINTING_PACK, setPrintings } from './sets.ts';
import { isLegacyPromo, BUNDLED_SETS } from './pocket/cards.ts';
import { POCKET_PACKS, pocketPackProduct } from './pocket/packs.ts';
import { pocketSet } from './pocket/registry.ts';
import { COSMETICS } from './cosmetics.ts';
import { a1 } from './a1/cards.ts';

export const PACK_PRICE = 100;
export const DIRECTED_PRICE: Readonly<Record<RarityCategory, number>> = { COMMON: 80, UNCOMMON: 160, RARE: 300, ULTRA: 600 };
const CATEGORIES: readonly RarityCategory[] = ['COMMON', 'UNCOMMON', 'RARE', 'ULTRA'];

/** Tabela por posição de campanha §16.2 (pesos inteiros = porcentagem). */
export const PACK_SLOTS: NonNullable<Product['slots']> = [
  { position: 1, categoryWeights: { COMMON: 100, UNCOMMON: 0, RARE: 0, ULTRA: 0 } },
  { position: 2, categoryWeights: { COMMON: 100, UNCOMMON: 0, RARE: 0, ULTRA: 0 } },
  { position: 3, categoryWeights: { COMMON: 100, UNCOMMON: 0, RARE: 0, ULTRA: 0 } },
  { position: 4, categoryWeights: { COMMON: 30, UNCOMMON: 70, RARE: 0, ULTRA: 0 } },
  { position: 5, categoryWeights: { COMMON: 0, UNCOMMON: 70, RARE: 25, ULTRA: 5 } },
];

/** Peso de cada impressão dentro da categoria do slot, pelo símbolo: o ex (◊◊◊◊) é o ULTRA mais comum, a coroa o mais raro. */
export const SYMBOL_WEIGHT: Readonly<Record<RaritySymbol, number>> = {
  '◊': 10, '◊◊': 10, '◊◊◊': 10, '◊◊◊◊': 10, '☆': 4, '☆☆': 3, '☆☆☆': 1, '✵': 1, '✵✵': 1, '♛': 1, PROMO: 0,
};

const defName = new Map(ALL_CARDS.map((c) => [definitionKey(c.id, c.version), c.name]));
const nameOf = (p: CardPrinting) => defName.get(definitionKey(p.cardDefinitionId, p.cardDefinitionVersion)) ?? p.cardDefinitionId;

const isCategory = (r: Rarity): r is RarityCategory => r !== 'PROMO';

function pools(printings: readonly CardPrinting[]): NonNullable<Product['pools']> {
  const out: Record<RarityCategory, { printingId: string; weight: number }[]> = { COMMON: [], UNCOMMON: [], RARE: [], ULTRA: [] };
  for (const p of printings) {
    if (!isCategory(p.rarity)) continue;
    out[p.rarity].push({ printingId: p.printingId, weight: SYMBOL_WEIGHT[raritySymbol(p)] });
  }
  return out;
}

/** Os três pacotes do Genetic Apex: id, nome, ex da capa, liberação para compra e nó que libera os ULTRA dele no Empório. */
export const A1_PACKS: readonly {
  readonly pack: A1Pack; readonly productId: string; readonly name: string; readonly cover: string;
  readonly afterNodeId: string | null; readonly ultraAfterNodeId: string;
}[] = [
  { pack: 'pikachu', productId: 'pack-a1-pikachu', name: 'Genetic Apex — Pikachu', cover: 'Pikachu ex', afterNodeId: null, ultraAfterNodeId: 'C03-E06' },
  { pack: 'charizard', productId: 'pack-a1-charizard', name: 'Genetic Apex — Charizard', cover: 'Charizard ex', afterNodeId: 'C01-E01', ultraAfterNodeId: 'C05-E06' },
  { pack: 'mewtwo', productId: 'pack-a1-mewtwo', name: 'Genetic Apex — Mewtwo', cover: 'Mewtwo ex', afterNodeId: 'C04-E01', ultraAfterNodeId: 'C06-E06' },
];
/** ULTRA fora de qualquer pacote (Mew ☆☆☆ e as coroas ♛) só depois do encontro final. */
export const NO_PACK_ULTRA_AFTER = 'F00-D03';

const a1Printings = (pack: A1Pack) => ALL_PRINTINGS.filter((p) => p.setId === 'a1' && (PRINTING_PACK.get(p.printingId) === pack || PRINTING_PACK.get(p.printingId) === null));

/** Pacote tutorial: cinco cartas ◊ do A1 fora da coleção inicial, sempre as mesmas. */
export const TUTORIAL_PACK_CARDS = ['Pikachu', 'Meowth', 'Abra', 'Pidgey', 'Rattata'] as const;

export const PACKS: readonly Product[] = [
  {
    productId: 'pack-tutorial-v1', version: 1, name: 'Pacote Tutorial — Conteúdo guiado', kind: 'FIXED_PACK', price: null,
    availability: { fromStart: false, afterNodeId: null }, repeatable: false, cardsPerPack: 5,
    fixedContents: TUTORIAL_PACK_CARDS.map((name) => P(a1(name))), coverPrintingId: P(a1(TUTORIAL_PACK_CARDS[0])),
  },
  ...A1_PACKS.map((m): Product => ({
    productId: m.productId, version: 1, name: m.name, kind: 'RANDOM_PACK', price: { credits: PACK_PRICE },
    availability: m.afterNodeId ? { fromStart: false, afterNodeId: m.afterNodeId } : { fromStart: true, afterNodeId: null }, repeatable: true,
    cardsPerPack: 5, slots: PACK_SLOTS, pools: pools(a1Printings(m.pack)), coverPrintingId: P(a1(m.cover)),
  })),
  ...POCKET_PACKS.filter((m) => BUNDLED_SETS.includes(pocketSet(m.set).setId)).map((m) => {
    const { printings, specs } = setPrintings(pocketSet(m.set).setId);
    return pocketPackProduct(m, printings, specs, (s) => isLegacyPromo(s.setId, s.number));
  }),
];

/** Liberação da compra dirigida: pelo pacote de origem; ULTRA só depois do chefe que fecha aquele pacote. */
function directedAvailability(p: CardPrinting): Product['availability'] {
  // Fora do A1 tudo fica à venda desde o início (campanha §15.2).
  if (p.setId !== 'a1') return { fromStart: true, afterNodeId: null };
  const pack = PRINTING_PACK.get(p.printingId) ?? null;
  const meta = pack ? A1_PACKS.find((m) => m.pack === pack)! : null;
  if (p.rarity === 'ULTRA') return { fromStart: false, afterNodeId: meta ? meta.ultraAfterNodeId : NO_PACK_ULTRA_AFTER };
  return meta?.afterNodeId ? { fromStart: false, afterNodeId: meta.afterNodeId } : { fromStart: true, afterNodeId: null };
}

export const DIRECTED_CARDS: readonly Product[] = ALL_PRINTINGS.filter((p) => p.rarity !== 'PROMO').map((p): Product => {
  const symbol = raritySymbol(p);
  return {
    productId: `card-${p.printingId}`, version: 1, name: `Carta: ${nameOf(p)} ${symbol}`.slice(0, 60), kind: 'DIRECTED_CARD',
    price: { credits: DIRECTED_PRICE[p.rarity as RarityCategory] }, availability: directedAvailability(p), repeatable: true,
    directedPrintingId: p.printingId, coverPrintingId: p.printingId,
  };
});

export const COSMETIC_PRODUCTS: readonly Product[] = COSMETICS.filter((c) => c.acquisition.kind === 'EMPORIUM').map((c): Product => ({
  productId: `cosmetic-${c.cosmeticId}`, version: 1, name: c.names['pt-BR'], kind: 'COSMETIC', price: { credits: c.acquisition.credits },
  availability: { fromStart: false, afterNodeId: c.acquisition.requiredCompletedNodeId }, repeatable: false, cosmeticId: c.cosmeticId, coverPrintingId: null,
}));

export const PRODUCTS: readonly Product[] = [...PACKS, ...DIRECTED_CARDS, ...COSMETIC_PRODUCTS];


export { CATEGORIES };
