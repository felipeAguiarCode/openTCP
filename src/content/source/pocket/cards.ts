// Cartas de jogo e impressões dos sets do Pocket depois do A1 (inclusive o Promo-A completo e o Promo-B).
//  1. Semente: as definições do A1 e os 6 Treinadores do promo-a.ts, pela chave de jogo — reimpressões em qualquer
//     set apontam para elas (A4b Pikachu ex → pikachu-ex; A4b Pesquisa do Professor → pesquisa-do-professor).
//  2. Ids: calculados sobre todas as linhas de todos os sets, na ordem canônica, independentemente de quais sets
//     estão prontos. A primeira definição de cada nome fica com a deckLimitKey do nome; as seguintes, com regras
//     diferentes, ganham o sufixo `-<setId>-<NNN>` da primeira impressão (shellder-a3-042). A deckLimitKey continua a
//     do nome: o limite de 2 cópias vale para todas as versões.
//  3. Construção sob demanda, só dos sets pedidos: efeito ou nome sem entrada é erro (pocket/build.ts).
import { deckLimitKeyV1 } from '../../../domain/cards/naming.ts';
import type { RaritySymbol } from '../../../domain/cards/rarity.ts';
import type { CardDefinition } from '../../../domain/cards/types.ts';
import { A1_ROWS } from '../a1/a1-data.generated.ts';
import { A1_KEYS } from '../a1/cards.ts';
import { PROMO_A } from '../promo-a.ts';
import { gameplayKey, makeBuilder } from './build.ts';
import { POCKET_ROWS } from './data/index.ts';
import { EFFECTS, NAMES } from './effects/index.ts';
import { POCKET_SETS, pocketSet } from './registry.ts';
import type { PocketRow, PromoSource } from './rows.ts';

/** Sets depois do A1 que entram no pacote de conteúdo (todos desde o conteúdo 3.0.0), na ordem canônica. */
export const BUNDLED_SETS: readonly string[] = POCKET_SETS.filter((s) => s.setId !== 'a1').map((s) => s.setId);

/**
 * Promos cujo estágio anterior não saiu em nenhum set do Pocket (id da carta → chave que falta): entram na coleção,
 * mas ainda não evoluem. O content-build aceita só estas; qualquer outra evolução sem base é erro.
 */
export const ORPHAN_EVOLUTIONS: Readonly<Record<string, string>> = {
  pawmot: 'pawmo', cinderace: 'raboot', haxorus: 'fraxure', noivern: 'noibat', 'mega-sceptile-ex': 'grovyle', meowstic: 'espurr',
};

/** Números do P-A que já existiam (promo-a.ts) e os nomes em inglês que eles têm no `.inspo`. */
const LEGACY_PA: Readonly<Record<number, string>> = { 1: 'Potion', 2: 'X Speed', 3: 'Hand Scope', 5: 'Poké Ball', 6: 'Red Card', 7: "Professor's Research" };
export const isLegacyPromo = (setId: string, number: number): boolean => setId === 'pa' && number in LEGACY_PA;

const { buildCard, finalName } = makeBuilder(EFFECTS, NAMES, 'Pocket');

// 1. Semente.
const seeds = new Map<string, CardDefinition>();
const a1Rows = [...A1_ROWS].sort((a, b) => a.number - b.number);
for (const r of a1Rows) seeds.set(gameplayKey(r), A1_KEYS.get(gameplayKey(r))!);
for (const p of PROMO_A) {
  const row = POCKET_ROWS.pa!.find((r) => r.number === p.number);
  if (!row || row.name !== LEGACY_PA[p.number]) throw new Error(`P-A ${p.number}: esperado ${LEGACY_PA[p.number]} no .inspo, veio ${row?.name}`);
  seeds.set(gameplayKey(row), p.card);
}

// 2. Ids.
const idOf = new Map<string, string>();
const usedIds = new Set<string>();
for (const [key, card] of seeds) {
  idOf.set(key, card.id);
  usedIds.add(card.id);
}
const pad = (n: number) => String(n).padStart(3, '0');
/** Nome exibido completo (com "ex"/"Mega … ex") de uma linha. */
const displayName = (r: PocketRow): string => (r.category === 'TRAINER' ? NAMES.trainers[r.name] ?? r.name : finalName(r.name));
for (const set of POCKET_SETS) {
  if (set.setId === 'a1') continue;
  for (const r of POCKET_ROWS[set.setId] ?? []) {
    const key = gameplayKey(r);
    if (idOf.has(key)) continue;
    const base = deckLimitKeyV1(displayName(r));
    const id = usedIds.has(base) ? `${base}-${set.setId}-${pad(r.number)}` : base;
    if (usedIds.has(id)) throw new Error(`id repetido ${id}`);
    usedIds.add(id);
    idOf.set(key, id);
  }
}

// 3. Construção sob demanda.
const built = new Map<string, CardDefinition>(seeds);
function definitionOf(r: PocketRow): CardDefinition {
  const key = gameplayKey(r);
  let card = built.get(key);
  if (!card) {
    card = buildCard(r, idOf.get(key)!);
    built.set(key, card);
  }
  return card;
}

export type PocketPrintingSpec = {
  readonly setId: string;
  readonly number: number;
  readonly card: CardDefinition;
  readonly symbol: RaritySymbol;
  /** Chave do pacote de origem (null = todos os pacotes do set). */
  readonly pack: string | null;
  /** Só na 6ª carta (bebês do A4/A4a). */
  readonly bonus: boolean;
  readonly artist: string | null;
  readonly promoSource: PromoSource | null;
};

const specCache = new Map<string, readonly PocketPrintingSpec[]>();
/** Impressões de um set (todas, inclusive as 6 promos antigas do P-A), na ordem do número de coleção. */
export function pocketSetSpecs(setId: string): readonly PocketPrintingSpec[] {
  const cached = specCache.get(setId);
  if (cached) return cached;
  const set = pocketSet(setId);
  const specs = (POCKET_ROWS[set.setId] ?? []).map((r): PocketPrintingSpec => ({
    setId: set.setId, number: r.number, card: definitionOf(r), symbol: r.rarity, pack: r.pack, bonus: r.bonus, artist: r.artist, promoSource: r.promoSource,
  }));
  specCache.set(setId, specs);
  return specs;
}

/** Definições novas (fora as sementes) dos sets pedidos, na ordem da primeira impressão. */
export function pocketNewCards(setIds: readonly string[]): readonly CardDefinition[] {
  const seedIds = new Set([...seeds.values()].map((c) => c.id));
  const out = new Map<string, CardDefinition>();
  for (const set of POCKET_SETS) {
    if (!setIds.includes(set.setId)) continue;
    for (const s of pocketSetSpecs(set.setId)) if (!seedIds.has(s.card.id) && !out.has(s.card.id)) out.set(s.card.id, s.card);
  }
  return [...out.values()];
}

/** Carta de um set pelo nome exibido ou pelo número de coleção; nome ambíguo (Oricorio do A3) exige o número. */
export function pocketCard(code: string, nameOrNumber: string | number): CardDefinition {
  const specs = pocketSetSpecs(pocketSet(code).setId);
  if (typeof nameOrNumber === 'number') {
    const s = specs.find((x) => x.number === nameOrNumber);
    if (!s) throw new Error(`${code}: número ${nameOrNumber} inexistente`);
    return s.card;
  }
  const cards = [...new Map(specs.filter((x) => x.card.name === nameOrNumber).map((x) => [x.card.id, x.card])).values()];
  if (cards.length !== 1) throw new Error(`${code}: ${cards.length ? 'nome ambíguo' : 'carta inexistente'}: ${nameOrNumber}`);
  return cards[0]!;
}

/** Id da impressão de um set pelo número de coleção (capas de pacote, decks). */
export function pocketPrintingId(code: string, number: number): string {
  const set = pocketSet(code);
  const spec = pocketSetSpecs(set.setId).find((x) => x.number === number);
  if (!spec) throw new Error(`${code}: número ${number} inexistente`);
  return `${set.setId}-${pad(number)}-${spec.card.deckLimitKey}`;
}

/** Ids calculados de todas as definições (inclusive sets ainda sem tabelas), por chave de jogo (testes). */
export const POCKET_IDS: ReadonlyMap<string, string> = idOf;
