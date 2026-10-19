// Conjuntos, numeração e impressões do conteúdo 3.0.0: Genetic Apex (A1, 286 impressões de 225 cartas de jogo), as
// 6 promos antigas do Promo-A e todos os sets depois do A1 (A1a…A4b, o resto do Promo-A e o Promo-B, pocket/cards.ts),
// com os números de coleção reais. Toda impressão usa “Impressão completa” com a imagem da carta impressa
// (artKey art:<set>:NNN). Raridade e acabamento vêm do símbolo do Pocket (src/domain/cards/rarity.ts); artes
// alternativas são impressões próprias da mesma carta de jogo. O pacote de origem de cada impressão define pools e
// liberação no Empório (products.ts, pocket/packs.ts).
import { IMMERSIVE_SCENE_ID, SYMBOL_PRINT } from '../../domain/cards/rarity.ts';
import type { CardDefinition, CardPrinting, Finish } from '../../domain/cards/types.ts';
import { printing } from '../builders.ts';
import { A1_CARDS, A1_PRINTING_SPECS, type A1Pack } from './a1/cards.ts';
import { BUNDLED_SETS, isLegacyPromo, pocketNewCards, pocketSetSpecs, type PocketPrintingSpec } from './pocket/cards.ts';
import { POCKET_SETS } from './pocket/registry.ts';
import { PROMO_A } from './promo-a.ts';
import { STARTER_POKEMON, STARTER_TRAINERS } from './starter.ts';

export type SetSpec = { readonly setId: string; readonly name: string };

/** Na ordem canônica do Pocket: A1 e P-A primeiro, depois os sets por data. */
export const SETS: readonly SetSpec[] = POCKET_SETS.filter((s) => s.setId === 'a1' || s.setId === 'pa' || BUNDLED_SETS.includes(s.setId))
  .map((s) => ({ setId: s.setId, name: s.name }));

/** Todas as definições: as 225 do A1 (ordem da primeira impressão), as 6 promos antigas e as novas dos outros sets. */
export const ALL_CARDS: readonly CardDefinition[] = [...A1_CARDS, ...PROMO_A.map((p) => p.card), ...pocketNewCards(BUNDLED_SETS)];

/** Arte empacotada de uma impressão (a carta impressa inteira, src/presentation/assets/cards/<set>/<SET>-NNN.webp). */
export const artKeyOf = (setId: string, number: number): string => `art:${setId}:${String(number).padStart(3, '0')}`;
export const a1ArtKey = (number: number): string => artKeyOf('a1', number);

const A1_PRINTINGS: readonly CardPrinting[] = A1_PRINTING_SPECS.map((s) => {
  const spec = SYMBOL_PRINT[s.symbol];
  return printing({ card: s.card, setId: 'a1', number: s.number, rarity: spec.rarity, finish: spec.finish, ownNumber: true,
    ...(spec.immersive ? { immersiveSceneId: IMMERSIVE_SCENE_ID } : {}), artist: s.artist, artKey: a1ArtKey(s.number) });
});
const PROMO_PRINTINGS: readonly CardPrinting[] = PROMO_A.map((p) => printing({ card: p.card, setId: 'pa', number: p.number, rarity: 'PROMO', ownNumber: true,
  artKey: `art:pa:${String(p.number).padStart(3, '0')}` }));

/** Impressões dos outros sets (as 6 promos antigas do P-A já estão em PROMO_PRINTINGS, com o mesmo id). */
const POCKET_SPECS: readonly PocketPrintingSpec[] = BUNDLED_SETS.flatMap((setId) => pocketSetSpecs(setId).filter((s) => !isLegacyPromo(s.setId, s.number)));
const POCKET_PRINTINGS: readonly CardPrinting[] = POCKET_SPECS.map((s) => {
  const spec = SYMBOL_PRINT[s.symbol];
  return printing({ card: s.card, setId: s.setId, number: s.number, rarity: spec.rarity, finish: spec.finish, ownNumber: true,
    ...(spec.immersive ? { immersiveSceneId: IMMERSIVE_SCENE_ID } : {}), ...(spec.shiny ? { shiny: true } : {}), artist: s.artist, artKey: artKeyOf(s.setId, s.number) });
});

export const ALL_PRINTINGS: readonly CardPrinting[] = [...A1_PRINTINGS, ...PROMO_PRINTINGS, ...POCKET_PRINTINGS];

/** Origem de cada impressão dos outros sets: pacote (null = todos do set), 6ª carta e origem da promo. */
export const POCKET_PRINTING_META: ReadonlyMap<string, PocketPrintingSpec> = new Map(POCKET_SPECS.map((s, i) => [POCKET_PRINTINGS[i]!.printingId, s]));

/** Impressões de um set na ordem do número de coleção, com a origem de cada uma (mesmo índice). */
export function setPrintings(setId: string): { readonly printings: readonly CardPrinting[]; readonly specs: readonly PocketPrintingSpec[] } {
  const specs = pocketSetSpecs(setId);
  const byId = new Map(ALL_PRINTINGS.filter((p) => p.setId === setId).map((p) => [Number(p.collectorNumber), p]));
  return { printings: specs.map((s) => byId.get(s.number)!), specs };
}

/** Pacote do A1 em que cada impressão aparece (null = em nenhum pacote específico; entra nos três). */
export const PRINTING_PACK: ReadonlyMap<string, A1Pack | null> = new Map(A1_PRINTING_SPECS.map((s, i) => [A1_PRINTINGS[i]!.printingId, s.pack]));

const canonical = new Map<string, CardPrinting>();
for (const p of ALL_PRINTINGS) {
  // A primeira impressão de acabamento normal é a canônica; promos só têm a própria impressão PROMO.
  if (p.finish === 'NORMAL' && !p.variant.immersiveSceneId && !canonical.has(p.cardDefinitionId)) canonical.set(p.cardDefinitionId, p);
}
// Cartas que só saíram em arte alternativa (um ☆ sem versão ◊): a primeira impressão delas.
for (const p of ALL_PRINTINGS) if (!canonical.has(p.cardDefinitionId)) canonical.set(p.cardDefinitionId, p);

/** Impressão canônica (primeira de acabamento normal; a PROMO para as promos; senão a primeira) — usada em decks e fixtures. */
export function P(card: CardDefinition): string {
  const p = canonical.get(card.id);
  if (!p) throw new Error(`sem impressão canônica para ${card.id}`);
  return p.printingId;
}

/** Impressão alternativa de uma definição pelo acabamento (a primeira com aquele acabamento). */
export function alt(card: CardDefinition, finish: Finish): string {
  const p = ALL_PRINTINGS.find((x) => x.cardDefinitionId === card.id && x.finish === finish);
  if (!p) throw new Error(`sem impressão ${finish} para ${card.id}`);
  return p.printingId;
}

/** As 38 impressões da coleção inicial: os 32 Pokémon dos oito decks iniciais e as 6 promos. */
export const STARTER_PRINTINGS: readonly string[] = [...STARTER_POKEMON, ...STARTER_TRAINERS].map((card) => P(card));
