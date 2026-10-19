// Genetic Apex (A1): monta as definições de carta a partir dos dados gerados (a1-data.generated.ts), das regras em
// effects.ts e dos nomes PT-BR em pt-br.ts, pelo construtor compartilhado dos sets do Pocket (pocket/build.ts).
// Impressões com a mesma carta de jogo (nome, PS, ataques, Habilidades, regras) viram uma definição só, com uma
// impressão por número de coleção — o limite de 2 cópias vale para todas. Efeito, Habilidade, ataque ou Treinador sem
// entrada nas tabelas faz o módulo falhar ao carregar.
import type { RaritySymbol } from '../../../domain/cards/rarity.ts';
import type { CardDefinition } from '../../../domain/cards/types.ts';
import { gameplayKey, makeBuilder } from '../pocket/build.ts';
import { A1_ROWS } from './a1-data.generated.ts';
import { ABILITY_EFFECTS, ATTACK_EFFECTS, TRAINER_EFFECTS } from './effects.ts';
import { ABILITY_NAMES, ATTACK_NAMES, TRAINER_NAMES } from './pt-br.ts';

export type A1Pack = 'pikachu' | 'charizard' | 'mewtwo';

const SYMBOL: Readonly<Record<string, RaritySymbol>> = {
  '◊': '◊', '◊◊': '◊◊', '◊◊◊': '◊◊◊', '◊◊◊◊': '◊◊◊◊', '☆': '☆', '☆☆': '☆☆', '☆☆☆': '☆☆☆', 'Crown Rare': '♛',
};

const { buildCard } = makeBuilder(
  { attacks: ATTACK_EFFECTS, abilities: ABILITY_EFFECTS, trainers: TRAINER_EFFECTS },
  { attacks: ATTACK_NAMES, abilities: ABILITY_NAMES, trainers: TRAINER_NAMES },
  'A1',
);

export type A1PrintingSpec = {
  readonly number: number;
  readonly card: CardDefinition;
  readonly symbol: RaritySymbol;
  readonly pack: A1Pack | null;
  readonly artist: string | null;
};

const byKey = new Map<string, CardDefinition>();
const specs: A1PrintingSpec[] = [];
for (const r of [...A1_ROWS].sort((a, b) => a.number - b.number)) {
  const key = gameplayKey(r);
  let card = byKey.get(key);
  if (!card) {
    card = buildCard(r);
    byKey.set(key, card);
  }
  const symbol = SYMBOL[r.rarity];
  if (!symbol) throw new Error(`A1: raridade sem entrada: "${r.rarity}"`);
  specs.push({ number: r.number, card, symbol, pack: r.pack, artist: r.artist });
}

/** As 225 cartas de jogo do A1, na ordem da primeira impressão. */
export const A1_CARDS: readonly CardDefinition[] = [...byKey.values()];
/** As 286 impressões do A1 (número de coleção, carta, símbolo, pacote de origem). */
export const A1_PRINTING_SPECS: readonly A1PrintingSpec[] = specs;
/** Chave de jogo de cada carta do A1 (para reimpressões em outros sets apontarem para a mesma definição). */
export const A1_KEYS: ReadonlyMap<string, CardDefinition> = byKey;

const byName = new Map(A1_CARDS.map((card) => [card.name, card]));
/** Carta do A1 pelo nome exibido ("Charmander", "Charizard ex", "Fóssil Hélix", "Nidoran♀"). */
export function a1(name: string): CardDefinition {
  const card = byName.get(name);
  if (!card) throw new Error(`A1: carta inexistente: ${name}`);
  return card;
}
