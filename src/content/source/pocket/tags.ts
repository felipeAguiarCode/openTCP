// Marcas de jogo que o `.inspo` não traz: Ultracriaturas (Beastite, Muralha das Feras, Lusamine…) e Pokémon da Equipe
// Rocket. Ficam em `tags` da definição e os filtros do DSL leem por `PokemonFilter.tags`.

export const ULTRA_BEAST = 'ULTRA_BEAST';
export const TEAM_ROCKET = 'TEAM_ROCKET';

/** Ultracriaturas pelo nome-base em inglês (sem "ex"). */
const ULTRA_BEASTS: ReadonlySet<string> = new Set([
  'Buzzwole', 'Pheromosa', 'Kartana', 'Nihilego', 'Guzzlord', 'Celesteela', 'Blacephalon', 'Xurkitree', 'Poipole', 'Naganadel', 'Stakataka',
]);

export function tagsOf(englishBase: string): string[] {
  const out: string[] = [];
  if (ULTRA_BEASTS.has(englishBase)) out.push(ULTRA_BEAST);
  if (/^Team Rocket's /.test(englishBase)) out.push(TEAM_ROCKET);
  return out;
}
