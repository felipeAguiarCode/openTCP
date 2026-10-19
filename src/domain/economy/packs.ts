// Abertura de pacote determinística (gameplay §20.2, campanha §16.2). Dois modelos convivem:
//   - legado (Genetic Apex): categoria por posição e depois impressão ponderada do pool da categoria;
//   - por símbolo (sets seguintes, taxas oficiais do Pocket): sorteio do pacote raro, depois o símbolo de cada posição
//     e uma impressão uniforme do pool daquele símbolo, e por fim a carta extra (6ª carta).
// Função pura: recebe e devolve o estado do economyRng.
import { uniformInt, weightedPick, type RngState } from '../random/rng.ts';
import { RARITY_SYMBOL_ORDER, type RaritySymbol } from '../cards/rarity.ts';
import type { Product, RarityCategory, TierPools, TierWeights } from '../../content/types.ts';

export type PackResult = {
  readonly printingIds: readonly string[];
  readonly rng: RngState;
  /** Categoria de cada posição (só pacote legado; vazio no pacote por símbolo). */
  readonly categories: readonly RarityCategory[];
  /** Símbolo de cada carta (só pacote por símbolo). */
  readonly symbols?: readonly RaritySymbol[];
  /** Pacote raro: todas as cartas ☆ ou acima. */
  readonly rarePack?: boolean;
  /** Veio a carta extra (6ª carta), sempre a última. */
  readonly bonus?: boolean;
};

const CATEGORIES: readonly RarityCategory[] = ['COMMON', 'UNCOMMON', 'RARE', 'ULTRA'];
/** Denominador das chances e pesos do pacote por símbolo (milésimos de ponto percentual). */
export const TIER_SCALE = 100000;

export const isTierPack = (product: Product): boolean => !!product.tierSlots;

const positiveTiers = (weights: TierWeights): RaritySymbol[] => RARITY_SYMBOL_ORDER.filter((s) => (weights[s] ?? 0) > 0);
const tierTotal = (weights: TierWeights): number => positiveTiers(weights).reduce((sum, s) => sum + weights[s]!, 0);
/** Impressões candidatas ao pacote raro, na ordem dos símbolos e do pool. */
const rareUnion = (product: Product): { printingId: string; symbol: RaritySymbol }[] =>
  (product.rarePack?.symbols ?? []).flatMap((symbol) => (product.tierPools?.[symbol] ?? []).map((printingId) => ({ printingId, symbol })));

function validateTiers(where: string, weights: TierWeights, pools: TierPools, errors: string[]): void {
  if (tierTotal(weights) <= 0) errors.push(`${where} sem pesos`);
  for (const s of positiveTiers(weights)) {
    if (!Number.isInteger(weights[s])) errors.push(`${where}: peso de ${s} não inteiro`);
    if (!(pools[s]?.length)) errors.push(`${where}: símbolo ${s} com chance positiva e pool vazio (C-031)`);
  }
}

export function validateRandomPack(product: Product): string[] {
  const errors: string[] = [];
  if (product.kind !== 'RANDOM_PACK') return errors;
  if (isTierPack(product)) {
    if (!product.tierPools || !product.cardsPerPack) return [`${product.productId}: pacote sem pools/cardsPerPack`];
    if (product.tierSlots!.length !== product.cardsPerPack) errors.push(`${product.productId}: posições != cardsPerPack`);
    for (const slot of product.tierSlots!) validateTiers(`${product.productId}: posição ${slot.position}`, slot.weights, product.tierPools, errors);
    if (product.bonusSlot) {
      if (product.bonusSlot.chance <= 0 || product.bonusSlot.chance > TIER_SCALE) errors.push(`${product.productId}: chance da carta extra fora de (0, ${TIER_SCALE}]`);
      validateTiers(`${product.productId}: carta extra`, product.bonusSlot.weights, product.bonusSlot.pools, errors);
    }
    if (product.rarePack) {
      if (product.rarePack.chance <= 0 || product.rarePack.chance > TIER_SCALE) errors.push(`${product.productId}: chance do pacote raro fora de (0, ${TIER_SCALE}]`);
      if (!rareUnion(product).length) errors.push(`${product.productId}: pacote raro sem impressões`);
    }
    return errors;
  }
  if (!product.slots || !product.pools || !product.cardsPerPack) return [`${product.productId}: pacote sem slots/pools`];
  if (product.slots.length !== product.cardsPerPack) errors.push(`${product.productId}: slots != cardsPerPack`);
  for (const slot of product.slots) {
    const total = CATEGORIES.reduce((sum, c) => sum + (slot.categoryWeights[c] ?? 0), 0);
    if (total <= 0) errors.push(`${product.productId}: posição ${slot.position} sem pesos`);
    for (const c of CATEGORIES) {
      if ((slot.categoryWeights[c] ?? 0) > 0 && (product.pools[c] ?? []).length === 0) errors.push(`${product.productId}: categoria ${c} com chance positiva e pool vazio (C-031)`);
    }
  }
  return errors;
}

/** Símbolo pelos pesos e impressão uniforme do pool daquele símbolo. */
function pickTier(rng: RngState, weights: TierWeights, pools: TierPools): { printingId: string; symbol: RaritySymbol; rng: RngState } {
  const symbol = weightedPick(rng, positiveTiers(weights).map((s) => ({ item: s, weight: weights[s]! })));
  const pool = pools[symbol.value]!;
  const index = uniformInt(symbol.rng, pool.length);
  return { printingId: pool[index.value]!, symbol: symbol.value, rng: index.rng };
}

function openTierPack(product: Product, rng: RngState): PackResult {
  let current = rng;
  const printingIds: string[] = [];
  const symbols: RaritySymbol[] = [];
  if (product.rarePack) {
    const roll = uniformInt(current, TIER_SCALE);
    current = roll.rng;
    if (roll.value < product.rarePack.chance) {
      const union = rareUnion(product);
      for (let i = 0; i < product.cardsPerPack!; i += 1) {
        const pick = uniformInt(current, union.length);
        current = pick.rng;
        printingIds.push(union[pick.value]!.printingId);
        symbols.push(union[pick.value]!.symbol);
      }
      return { printingIds, rng: current, categories: [], symbols, rarePack: true, bonus: false };
    }
  }
  for (const slot of [...product.tierSlots!].sort((a, b) => a.position - b.position)) {
    const pick = pickTier(current, slot.weights, product.tierPools!);
    current = pick.rng;
    printingIds.push(pick.printingId);
    symbols.push(pick.symbol);
  }
  let bonus = false;
  if (product.bonusSlot) {
    const roll = uniformInt(current, TIER_SCALE);
    current = roll.rng;
    if (roll.value < product.bonusSlot.chance) {
      const pick = pickTier(current, product.bonusSlot.weights, product.bonusSlot.pools);
      current = pick.rng;
      printingIds.push(pick.printingId);
      symbols.push(pick.symbol);
      bonus = true;
    }
  }
  return { printingIds, rng: current, categories: [], symbols, rarePack: false, bonus };
}

export function openRandomPack(product: Product, rng: RngState): PackResult {
  const errors = validateRandomPack(product);
  if (errors.length) throw new Error(errors.join('; '));
  if (isTierPack(product)) return openTierPack(product, rng);
  let current = rng;
  const printingIds: string[] = [];
  const categories: RarityCategory[] = [];
  for (const slot of [...product.slots!].sort((a, b) => a.position - b.position)) {
    const category = weightedPick(current, CATEGORIES.filter((c) => (slot.categoryWeights[c] ?? 0) > 0).map((c) => ({ item: c, weight: slot.categoryWeights[c] })));
    current = category.rng;
    const pool = product.pools![category.value];
    const printing = weightedPick(current, pool.map((p) => ({ item: p.printingId, weight: p.weight })));
    current = printing.rng;
    categories.push(category.value);
    printingIds.push(printing.value);
  }
  return { printingIds, rng: current, categories };
}

export function openPack(product: Product, rng: RngState): PackResult {
  if (product.kind === 'FIXED_PACK') return { printingIds: [...(product.fixedContents ?? [])], rng, categories: [] };
  return openRandomPack(product, rng);
}

/**
 * Probabilidade exibida por impressão (campanha §16.2), por posição, e cópias esperadas por pacote. No pacote por
 * símbolo soma pacote normal (1 − r), pacote raro (r, uniforme na união) e a carta extra (coluna a mais no fim).
 */
export function printingOdds(product: Product): { printingId: string; perSlot: number[]; expectedCopies: number }[] {
  if (product.kind !== 'RANDOM_PACK') return [];
  if (isTierPack(product)) return tierOdds(product);
  if (!product.slots || !product.pools) return [];
  const out = new Map<string, number[]>();
  const slots = [...product.slots].sort((a, b) => a.position - b.position);
  slots.forEach((slot, index) => {
    const totalCat = CATEGORIES.reduce((sum, c) => sum + (slot.categoryWeights[c] ?? 0), 0);
    for (const c of CATEGORIES) {
      const pc = (slot.categoryWeights[c] ?? 0) / totalCat;
      if (pc <= 0) continue;
      const pool = product.pools![c];
      const totalW = pool.reduce((sum, p) => sum + p.weight, 0);
      for (const p of pool) {
        const arr = out.get(p.printingId) ?? Array.from({ length: slots.length }, () => 0);
        arr[index] = (arr[index] ?? 0) + pc * (p.weight / totalW);
        out.set(p.printingId, arr);
      }
    }
  });
  return [...out.entries()].map(([printingId, perSlot]) => ({ printingId, perSlot, expectedCopies: perSlot.reduce((a, b) => a + b, 0) }));
}

function tierOdds(product: Product): { printingId: string; perSlot: number[]; expectedCopies: number }[] {
  const slots = [...(product.tierSlots ?? [])].sort((a, b) => a.position - b.position);
  const columns = slots.length + (product.bonusSlot ? 1 : 0);
  const rare = (product.rarePack?.chance ?? 0) / TIER_SCALE;
  const out = new Map<string, number[]>();
  const addTo = (printingId: string, index: number, p: number) => {
    const arr = out.get(printingId) ?? Array.from({ length: columns }, () => 0);
    arr[index] = (arr[index] ?? 0) + p;
    out.set(printingId, arr);
  };
  const spread = (weights: TierWeights, pools: TierPools, index: number, factor: number) => {
    const total = tierTotal(weights);
    for (const s of positiveTiers(weights)) {
      const pool = pools[s] ?? [];
      for (const id of pool) addTo(id, index, factor * (weights[s]! / total) / pool.length);
    }
  };
  slots.forEach((slot, index) => spread(slot.weights, product.tierPools ?? {}, index, 1 - rare));
  if (rare > 0) {
    const union = rareUnion(product);
    slots.forEach((_, index) => { for (const e of union) addTo(e.printingId, index, rare / union.length); });
  }
  if (product.bonusSlot) spread(product.bonusSlot.weights, product.bonusSlot.pools, slots.length, (1 - rare) * (product.bonusSlot.chance / TIER_SCALE));
  return [...out.entries()].map(([printingId, perSlot]) => ({ printingId, perSlot, expectedCopies: perSlot.reduce((a, b) => a + b, 0) }));
}

/** Tabela de taxas oficiais de um pacote por símbolo (S05, catálogo): totais por símbolo e posição e valor por carta. */
export type PackRateTable = {
  /** Grupos de posições com a mesma tabela ("1ª–3ª", "4ª", "5ª"). */
  readonly columns: readonly { readonly label: string; readonly positions: readonly number[] }[];
  readonly rows: readonly { readonly symbol: RaritySymbol; readonly poolSize: number; readonly total: readonly number[]; readonly perCard: readonly number[] }[];
  readonly bonus: { readonly chance: number; readonly rows: readonly { readonly symbol: RaritySymbol; readonly poolSize: number; readonly total: number; readonly perCard: number }[] } | null;
  readonly rare: { readonly chance: number; readonly poolSize: number; readonly perCard: number } | null;
};

const ordinal = (n: number) => `${n}ª`;

export function packRateTable(product: Product): PackRateTable | null {
  if (product.kind !== 'RANDOM_PACK' || !isTierPack(product)) return null;
  const pools = product.tierPools ?? {};
  const slots = [...product.tierSlots!].sort((a, b) => a.position - b.position);
  const groups: { positions: number[]; weights: TierWeights }[] = [];
  for (const slot of slots) {
    const last = groups[groups.length - 1];
    if (last && JSON.stringify(last.weights) === JSON.stringify(slot.weights)) last.positions.push(slot.position);
    else groups.push({ positions: [slot.position], weights: slot.weights });
  }
  const columns = groups.map((g) => ({
    label: g.positions.length > 1 ? `${ordinal(g.positions[0]!)}–${ordinal(g.positions[g.positions.length - 1]!)}` : ordinal(g.positions[0]!),
    positions: g.positions,
  }));
  const symbols = RARITY_SYMBOL_ORDER.filter((s) => groups.some((g) => (g.weights[s] ?? 0) > 0));
  const rows = symbols.map((symbol) => {
    const poolSize = pools[symbol]?.length ?? 0;
    const total = groups.map((g) => (g.weights[symbol] ?? 0) / tierTotal(g.weights));
    return { symbol, poolSize, total, perCard: total.map((t) => (poolSize ? t / poolSize : 0)) };
  });
  const bonus = product.bonusSlot ? {
    chance: product.bonusSlot.chance / TIER_SCALE,
    rows: positiveTiers(product.bonusSlot.weights).map((symbol) => {
      const poolSize = product.bonusSlot!.pools[symbol]?.length ?? 0;
      const total = product.bonusSlot!.weights[symbol]! / tierTotal(product.bonusSlot!.weights);
      return { symbol, poolSize, total, perCard: poolSize ? total / poolSize : 0 };
    }),
  } : null;
  const union = rareUnion(product);
  const rare = product.rarePack ? { chance: product.rarePack.chance / TIER_SCALE, poolSize: union.length, perCard: union.length ? 1 / union.length : 0 } : null;
  return { columns, rows, bonus, rare };
}

export const packResource = (productId: string): string => `PACK:${productId}`;
