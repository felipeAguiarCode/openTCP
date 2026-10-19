// Coleção inicial (campanha.md §3.3–§3.4, conteúdo 3.0.0): 12 Pokémon do Genetic Apex (A1) em três linhas por tipo,
// 20 Pokémon comuns dos sets seguintes para os cinco tipos restantes (duas linhas Básico → Estágio 1 por tipo), todos
// sem ex, e os 6 Treinadores básicos do Promo-A. Cada deck inicial usa 4 Pokémon ×2 + os 6 Treinadores ×2. Os
// Pokémon dos tipos novos só têm ataques diretos: nenhum liga/move Energia, aplica Condição ou modifica dano, para
// que nenhum deck inicial cumpra sozinho um objetivo de composição (-DECK).
import { a1 } from './a1/cards.ts';
import { pocketCard } from './pocket/cards.ts';
import { cartaoVermelho, lupaDeMao, pesquisaDoProfessor, pocao, pokeBola, velocidadeX } from './promo-a.ts';

// ---- Fogo (Chama Constante)
export const charmander = a1('Charmander');
export const charmeleon = a1('Charmeleon');
export const ponyta = a1('Ponyta');
export const rapidash = a1('Rapidash');
// ---- Água (Maré Serena)
export const squirtle = a1('Squirtle');
export const wartortle = a1('Wartortle');
export const staryu = a1('Staryu');
export const starmie = a1('Starmie');
// ---- Planta (Jardim Vivo)
export const bulbasaur = a1('Bulbasaur');
export const ivysaur = a1('Ivysaur');
export const exeggcute = a1('Exeggcute');
export const exeggutor = a1('Exeggutor');

// ---- Elétrico (Faísca Veloz)
export const mareep = pocketCard('A4', 67);
export const flaaffy = pocketCard('A4', 68);
export const blitzle = pocketCard('A3a', 16);
export const zebstrika = pocketCard('A3a', 17);
// ---- Psíquico (Eco Psíquico)
export const swirlix = pocketCard('A1a', 39);
export const slurpuff = pocketCard('A1a', 40);
export const duskull = pocketCard('A2', 70);
export const dusclops = pocketCard('A2', 71);
// ---- Lutador (Punho Firme)
export const timburr = pocketCard('A3', 94);
export const gurdurr = pocketCard('A3', 95);
export const meditite = pocketCard('A2a', 43);
export const medicham = pocketCard('A3a', 29);
// ---- Noturno (Sombra Astuta)
export const poochyena = pocketCard('A2', 100);
export const mightyena = pocketCard('A2', 101);
export const purrloin = pocketCard('A1a', 51);
export const liepard = pocketCard('A1a', 52);
// ---- Metálico (Aço Paciente)
export const klink = pocketCard('A4', 126);
export const klang = pocketCard('A4', 127);
export const aron = pocketCard('A3a', 48);
export const lairon = pocketCard('A3a', 49);

export { cartaoVermelho, lupaDeMao, pesquisaDoProfessor, pocao, pokeBola, velocidadeX };

export const STARTER_POKEMON = [
  charmander, charmeleon, ponyta, rapidash, squirtle, wartortle, staryu, starmie, bulbasaur, ivysaur, exeggcute, exeggutor,
  mareep, flaaffy, blitzle, zebstrika, swirlix, slurpuff, duskull, dusclops, timburr, gurdurr, meditite, medicham,
  poochyena, mightyena, purrloin, liepard, klink, klang, aron, lairon,
] as const;
export const STARTER_TRAINERS = [pokeBola, pocao, pesquisaDoProfessor, velocidadeX, cartaoVermelho, lupaDeMao] as const;
