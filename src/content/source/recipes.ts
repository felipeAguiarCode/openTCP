// Receitas de deck (decisão do autor, 16/10/2026): listas prontas para montar um deck — por tipo, do meta e conhecidas na
// comunidade do Pokémon TCG Pocket, adaptadas às cartas deste pacote (Genetic Apex até Deluxe Pack ex, Promo-A e
// Promo-B). As listas usam os nomes em inglês das cartas (os do Limitless), resolvidos para a definição e a
// impressão canônica; nome com mais de uma versão de regras exige o set (ou o número). O content-build valida cada
// receita como deck jogável de 20 cartas (campanha §3.7).
import type { CardDefinition, EnergyType } from '../../domain/cards/types.ts';
import type { DeckRecipe, DeckRecipeCategory, DeckRecipeDifficulty } from '../types.ts';
import { A1_ROWS } from './a1/a1-data.generated.ts';
import { A1_PRINTING_SPECS } from './a1/cards.ts';
import { POCKET_ROWS } from './pocket/data/index.ts';
import { pocketSetSpecs } from './pocket/cards.ts';
import { POCKET_SETS } from './pocket/registry.ts';
import { P } from './sets.ts';

// ---------------------------------------------------------------- nomes em inglês → definição

type Hit = { readonly code: string; readonly number: number; readonly card: CardDefinition };

const HITS = new Map<string, Hit[]>();
const push = (name: string, hit: Hit) => HITS.set(name, [...(HITS.get(name) ?? []), hit]);
const a1Names = new Map(A1_ROWS.map((r) => [r.number, r.name]));
for (const s of A1_PRINTING_SPECS) push(a1Names.get(s.number)!, { code: 'A1', number: s.number, card: s.card });
for (const set of POCKET_SETS) {
  if (set.setId === 'a1') continue;
  const rows = POCKET_ROWS[set.setId] ?? [];
  const specs = pocketSetSpecs(set.setId);
  rows.forEach((r, i) => push(r.name, { code: set.code, number: r.number, card: specs[i]!.card }));
}

/**
 * Carta pelo nome em inglês (`en('Pikachu ex')`); com `code`, só daquele set (`en('Vaporeon', 'A1a')`). Erro se não
 * existir ou se o nome tiver mais de uma versão de regras sem o set.
 */
export function en(name: string, code?: string): CardDefinition {
  const hits = (HITS.get(name) ?? []).filter((h) => !code || h.code === code);
  const cards = [...new Map(hits.map((h) => [h.card.id, h.card])).values()];
  if (!cards.length) throw new Error(`receita: carta inexistente: ${name}${code ? ` (${code})` : ''}`);
  if (cards.length > 1) {
    const where = [...new Set(hits.map((h) => h.code))].join(', ');
    throw new Error(`receita: ${name} tem ${cards.length} versões (${where}); informe o set ou o número`);
  }
  return cards[0]!;
}

/** Carta pelo número de coleção (nomes repetidos no mesmo set, como os Oricorio do A3). */
export function num(code: string, number: number): CardDefinition {
  const hit = [...HITS.values()].flat().find((h) => h.code === code && h.number === number);
  if (!hit) throw new Error(`receita: ${code}-${number} inexistente`);
  return hit.card;
}

// ---------------------------------------------------------------- Treinadores

const PR = en("Professor's Research"), PB = en('Poké Ball'), XS = en('X Speed'), POT = en('Potion'), RCARD = en('Red Card');
const CANDY = en('Rare Candy'), SAB = en('Sabrina'), GIO = en('Giovanni'), CYR = en('Cyrus'), MARS = en('Mars'), DAWN = en('Dawn');
const IRI = en('Irida'), MIS = en('Misty'), ERI = en('Erika'), BLA = en('Blaine'), KOG = en('Koga'), BRO = en('Brock'), SUR = en('Lt. Surge');
const LEAF = en('Leaf'), CAPE = en('Giant Cape'), HELM = en('Rocky Helmet'), ESW = en('Elemental Switch'), EBAG = en('Eevee Bag');
const LEFT = en('Leftovers'), APRON = en('Steel Apron'), PEND = en('Dark Pendant'), BARB = en('Poison Barb'), LCAPE = en('Leaf Cape');
const CORD = en('Electrical Cord'), BWALL = en('Beast Wall'), BITE = en('Beastite'), LUS = en('Lusamine'), CYN = en('Cynthia'), HAU = en('Hau');
const HIKER = en('Hiker'), LYRA = en('Lyra'), AMBER = en('Old Amber'), SKULL = en('Skull Fossil'), SLAB = en('Mythical Slab'), ADA = en('Adaman');

// ---------------------------------------------------------------- receitas

type Line = readonly [CardDefinition, 1 | 2];

type Spec = {
  readonly id: string; readonly name: string; readonly category: DeckRecipeCategory; readonly era: string;
  readonly energy: readonly EnergyType[]; readonly cover: CardDefinition; readonly difficulty: DeckRecipeDifficulty;
  readonly summary: string; readonly cards: readonly Line[];
};

function recipe(s: Spec): DeckRecipe {
  const total = s.cards.reduce((sum, [, n]) => sum + n, 0);
  if (total !== 20) throw new Error(`receita ${s.id}: ${total} cartas (esperado 20)`);
  return {
    recipeId: s.id, version: 1, name: s.name, category: s.category, era: s.era, energyTypes: [...s.energy], difficulty: s.difficulty,
    entries: s.cards.map(([card, count]) => ({ printingId: P(card), count })), coverPrintingId: P(s.cover), summary: s.summary,
  };
}

const meta = (s: Omit<Spec, 'category'>) => recipe({ ...s, category: 'META' });
const byType = (s: Omit<Spec, 'category'>) => recipe({ ...s, category: 'TYPE' });
const community = (s: Omit<Spec, 'category'>) => recipe({ ...s, category: 'COMMUNITY' });

const PIKACHU_EX = en('Pikachu ex', 'A1'), EEVEE = en('Eevee', 'A1'), LUCARIO = en('Lucario', 'A2'), RIOLU = en('Riolu', 'A2');

/** Arquétipos que marcaram o meta do Pocket, set a set (era = set das cartas principais neste pacote). */
const META: readonly DeckRecipe[] = [
  meta({ id: 'meta-pikachu-ex-zapdos-ex', name: 'Pikachu ex e Zapdos ex', era: 'A1', energy: ['LIGHTNING'], cover: PIKACHU_EX, difficulty: 'EASY',
    summary: 'O deck que definiu o começo do Pocket: Pikachu ex ataca por duas Energias e bate 30 por Pokémon Elétrico no Banco. Zapdos ex e Electrode enchem o Banco; Sabrina e Giovanni fecham as contas.',
    cards: [[PIKACHU_EX, 2], [en('Zapdos ex'), 2], [en('Voltorb', 'A1'), 2], [en('Electrode', 'A1'), 2], [PR, 2], [PB, 2], [XS, 2], [SAB, 2], [GIO, 2], [POT, 1], [RCARD, 1]] }),
  meta({ id: 'meta-mewtwo-ex-gardevoir', name: 'Mewtwo ex e Gardevoir', era: 'A1', energy: ['PSYCHIC'], cover: en('Mewtwo ex', 'A1'), difficulty: 'MEDIUM',
    summary: 'Gardevoir no Banco liga uma Energia Psíquica extra por turno ao Ativo: Mewtwo ex chega ao Psicoimpulso de 150 um turno antes. Evolua Ralts cedo e proteja a Gardevoir.',
    cards: [[en('Mewtwo ex', 'A1'), 2], [en('Ralts', 'A1'), 2], [en('Kirlia', 'A1'), 2], [en('Gardevoir', 'A1'), 2], [PR, 2], [PB, 2], [SAB, 2], [GIO, 2], [POT, 2], [XS, 1], [RCARD, 1]] }),
  meta({ id: 'meta-charizard-ex-moltres-ex', name: 'Charizard ex e Moltres ex', era: 'A1', energy: ['FIRE'], cover: en('Charizard ex', 'A1'), difficulty: 'MEDIUM',
    summary: 'Moltres ex acelera Energia de Fogo no Banco com Dança Infernal; Charizard ex descarrega a Tempestade Carmesim de 200. Doce Raro pula o Charmeleon quando a mão ajuda.',
    cards: [[en('Charmander', 'A1'), 2], [en('Charmeleon', 'A1'), 2], [en('Charizard ex', 'A1'), 2], [en('Moltres ex'), 2], [CANDY, 2], [PR, 2], [PB, 2], [GIO, 2], [SAB, 1], [POT, 2], [XS, 1]] }),
  meta({ id: 'meta-starmie-ex-articuno-ex', name: 'Starmie ex e Articuno ex', era: 'A1', energy: ['WATER'], cover: en('Starmie ex'), difficulty: 'EASY',
    summary: 'Starmie ex evolui rápido e bate 90 por duas Energias; Articuno ex segura a frente e varre o Banco com Nevasca. Misty acelera a Água quando a moeda ajuda.',
    cards: [[en('Staryu', 'A1'), 2], [en('Starmie ex'), 2], [en('Articuno ex'), 2], [MIS, 2], [PR, 2], [PB, 2], [SAB, 2], [GIO, 2], [XS, 2], [POT, 2]] }),
  meta({ id: 'meta-celebi-ex-serperior', name: 'Celebi ex e Serperior', era: 'A1a', energy: ['GRASS'], cover: en('Celebi ex'), difficulty: 'MEDIUM',
    summary: 'Serperior dobra cada Energia de Planta: Celebi ex joga uma moeda por Energia e Dhelmise passa dos 90. Monte Serperior no Banco antes de expor o Celebi ex; Erika cura o atacante.',
    cards: [[en('Celebi ex'), 2], [en('Snivy', 'A1a'), 2], [en('Servine', 'A1a'), 2], [en('Serperior', 'A1a'), 2], [en('Dhelmise', 'A1a'), 2], [CANDY, 2], [ERI, 2], [PR, 2], [PB, 2], [LEAF, 1], [POT, 1]] }),
  meta({ id: 'meta-aerodactyl-ex-marowak-ex', name: 'Aerodactyl ex e Marowak ex', era: 'A1a', energy: ['FIGHTING'], cover: en('Aerodactyl ex'), difficulty: 'MEDIUM',
    summary: 'Aerodactyl ex impede o rival de evoluir o Ativo com a Lei Primordial; Marowak ex bate forte com Ossomerangue. Hitmonlee alcança o Banco enquanto o Âmbar Antigo vira fóssil.',
    cards: [[AMBER, 2], [en('Aerodactyl ex'), 2], [en('Cubone', 'A1'), 2], [en('Marowak ex'), 2], [en('Hitmonlee', 'A1'), 2], [PR, 2], [PB, 2], [GIO, 2], [SAB, 1], [POT, 2], [XS, 1]] }),
  meta({ id: 'meta-gyarados-ex-greninja', name: 'Gyarados ex e Greninja', era: 'A1a', energy: ['WATER'], cover: en('Gyarados ex'), difficulty: 'MEDIUM',
    summary: 'Greninja dá 20 de dano onde quiser a cada turno e prepara os nocautes; Gyarados ex fecha com Redemoinho Desenfreado de 140. Misty encurta a espera pela Energia.',
    cards: [[en('Magikarp', 'A1'), 2], [en('Gyarados ex'), 2], [en('Froakie', 'A1'), 2], [en('Frogadier'), 2], [en('Greninja', 'A1'), 2], [CANDY, 2], [MIS, 2], [PR, 2], [PB, 2], [POT, 1], [SAB, 1]] }),
  meta({ id: 'meta-dialga-ex-melmetal', name: 'Dialga ex e Melmetal', era: 'A2', energy: ['METAL'], cover: en('Dialga ex'), difficulty: 'MEDIUM',
    summary: 'Dialga ex liga duas Energias de Metal a um Pokémon do Banco com Turbo Metálico: Melmetal, que toma 20 a menos de cada ataque, entra pronto. Dawn puxa Energia para o Ativo.',
    cards: [[en('Dialga ex'), 2], [en('Meltan', 'A1'), 2], [en('Melmetal', 'A1'), 2], [en('Heatran', 'A2'), 1], [DAWN, 2], [CYR, 2], [PR, 2], [PB, 2], [GIO, 2], [POT, 2], [XS, 1]] }),
  meta({ id: 'meta-palkia-ex-vaporeon', name: 'Palkia ex e Vaporeon', era: 'A2', energy: ['WATER'], cover: en('Palkia ex'), difficulty: 'HARD',
    summary: 'Manaphy e Vaporeon carregam Água no Banco; Vaporeon passa as Energias para o Palkia ex no Ativo, que solta a Tempestade Dimensional de 150 e 20 em cada Pokémon do Banco rival.',
    cards: [[en('Palkia ex'), 2], [EEVEE, 2], [en('Vaporeon', 'A1a'), 2], [en('Manaphy'), 2], [MIS, 2], [IRI, 2], [CYR, 1], [PR, 2], [PB, 2], [GIO, 1], [XS, 1], [POT, 1]] }),
  meta({ id: 'meta-darkrai-ex-weavile-ex', name: 'Darkrai ex e Weavile ex', era: 'A2', energy: ['DARKNESS'], cover: en('Darkrai ex'), difficulty: 'MEDIUM',
    summary: 'Cada Energia Noturna ligada ao Darkrai ex dá 20 de dano no Ativo rival; Weavile ex aproveita o dano e bate 70 por uma Energia. Cyrus puxa o Pokémon ferido do Banco.',
    cards: [[en('Darkrai ex'), 2], [en('Sneasel', 'A2'), 2], [en('Weavile ex'), 2], [CYR, 2], [MARS, 1], [PR, 2], [PB, 2], [SAB, 2], [GIO, 2], [XS, 1], [POT, 2]] }),
  meta({ id: 'meta-infernape-ex-moltres-ex', name: 'Infernape ex e Moltres ex', era: 'A2', energy: ['FIRE'], cover: en('Infernape ex'), difficulty: 'MEDIUM',
    summary: 'Infernape ex não paga recuo e queima 140 por duas Energias; Moltres ex repõe o Fogo no Banco. Alterne os atacantes depois de cada Ataque Flamejante.',
    cards: [[en('Chimchar'), 2], [en('Monferno'), 2], [en('Infernape ex'), 2], [en('Moltres ex'), 2], [CANDY, 2], [PR, 2], [PB, 2], [GIO, 2], [SAB, 1], [XS, 1], [POT, 2]] }),
  meta({ id: 'meta-gallade-ex-lucario', name: 'Gallade ex e Lucario', era: 'A2', energy: ['FIGHTING'], cover: en('Gallade ex'), difficulty: 'MEDIUM',
    summary: 'Gallade ex bate 20 a mais por Energia do Ativo rival, ótimo contra atacantes pesados; Lucario no Banco soma 20 a cada ataque Lutador.',
    cards: [[en('Ralts', 'A1'), 2], [en('Kirlia', 'A1'), 2], [en('Gallade ex'), 2], [RIOLU, 2], [LUCARIO, 2], [CANDY, 2], [PR, 2], [PB, 2], [GIO, 1], [SAB, 1], [POT, 1], [XS, 1]] }),
  meta({ id: 'meta-arceus-ex-crobat', name: 'Arceus ex e Crobat', era: 'A2a', energy: ['DARKNESS'], cover: en('Arceus ex'), difficulty: 'HARD',
    summary: 'Arceus ex soma 20 por Pokémon no Banco e ignora as Condições Especiais; com um Arceus em jogo, cada Crobat dá 30 no Ativo rival por turno. Encha o Banco e deixe os morcegos trabalharem.',
    cards: [[en('Arceus ex'), 2], [en('Arceus'), 1], [en('Zubat', 'A1'), 2], [en('Golbat', 'A1'), 2], [en('Crobat', 'A2a'), 2], [CANDY, 2], [CYR, 1], [PR, 2], [PB, 2], [GIO, 2], [XS, 1], [POT, 1]] }),
  meta({ id: 'meta-garchomp-ex-lucario', name: 'Garchomp ex e Lucario', era: 'A2a', energy: ['FIGHTING'], cover: en('Garchomp ex'), difficulty: 'MEDIUM',
    summary: 'Lucario no Banco soma 20 a cada ataque Lutador; Garchomp ex escolhe o alvo com Ataque Linear e fecha com Garra de Dragão. Cynthia dá mais 50 no turno decisivo.',
    cards: [[en('Gible', 'A2a'), 2], [en('Gabite', 'A2a'), 2], [en('Garchomp ex'), 2], [RIOLU, 2], [LUCARIO, 2], [CANDY, 2], [CYN, 2], [PR, 2], [PB, 2], [GIO, 1], [XS, 1]] }),
  meta({ id: 'meta-solgaleo-ex-skarmory-ex', name: 'Solgaleo ex e Skarmory ex', era: 'A3', energy: ['METAL'], cover: en('Solgaleo ex'), difficulty: 'MEDIUM',
    summary: 'Solgaleo ex no Banco troca de lugar com o Ativo sem custo (Caminho Ascendente): recue de graça e ataque com quem estiver pronto. Skarmory ex segura a frente enquanto o Cosmog evolui.',
    cards: [[en('Cosmog'), 2], [en('Cosmoem'), 2], [en('Solgaleo ex'), 2], [en('Skarmory ex'), 2], [CANDY, 2], [DAWN, 1], [PR, 2], [PB, 2], [GIO, 1], [SAB, 1], [POT, 2], [APRON, 1]] }),
  meta({ id: 'meta-buzzwole-ex-pheromosa', name: 'Ultra Feras: Buzzwole ex e Pheromosa', era: 'A3a', energy: ['GRASS'], cover: en('Buzzwole ex'), difficulty: 'MEDIUM',
    summary: 'Pheromosa fere o Banco por uma Energia e Buzzwole ex bate 120 em turnos alternados. Bestita cresce a cada ponto seu; Lusamine devolve Energias quando o rival marca.',
    cards: [[en('Buzzwole ex'), 2], [en('Pheromosa'), 2], [en('Kartana'), 2], [BITE, 2], [BWALL, 1], [LUS, 2], [PR, 2], [PB, 2], [SAB, 1], [GIO, 2], [XS, 1], [POT, 1]] }),
  meta({ id: 'meta-tapu-koko-ex-pikachu-ex', name: 'Tapu Koko ex e Pikachu ex', era: 'A3a', energy: ['LIGHTNING'], cover: en('Tapu Koko ex'), difficulty: 'EASY',
    summary: 'Tapu Koko ex se carrega sozinho com Furacão de Plasma; Pikachu ex cresce com o Banco Elétrico. Oricorio, imune a ex, atrapalha os rivais; o Cabo Elétrico salva Energias.',
    cards: [[en('Tapu Koko ex'), 2], [PIKACHU_EX, 2], [num('A3', 66), 2], [CORD, 2], [PR, 2], [PB, 2], [SAB, 1], [GIO, 2], [XS, 2], [POT, 2], [RCARD, 1]] }),
  meta({ id: 'meta-flareon-ex-moltres-ex', name: 'Flareon ex e Moltres ex', era: 'A3b', energy: ['FIRE'], cover: en('Flareon ex'), difficulty: 'MEDIUM',
    summary: 'Flareon ex reaproveita Energia de Fogo do descarte com Inflamar e bate 130; Moltres ex abastece o Banco. Eevee ex pode evoluir em qualquer forma do Eevee.',
    cards: [[en('Eevee ex'), 2], [EEVEE, 1], [en('Flareon ex'), 2], [en('Moltres ex'), 2], [EBAG, 2], [PR, 2], [PB, 2], [GIO, 2], [SAB, 1], [XS, 1], [POT, 2], [LEFT, 1]] }),
  meta({ id: 'meta-umbreon-ex-darkrai-ex', name: 'Umbreon ex e Darkrai ex', era: 'A4', energy: ['DARKNESS'], cover: en('Umbreon ex'), difficulty: 'MEDIUM',
    summary: 'Darkrai ex fere o Ativo rival a cada Energia; Umbreon ex traz para o Ativo o Pokémon ferido do Banco e termina o serviço com Presa das Trevas.',
    cards: [[EEVEE, 2], [en('Umbreon ex'), 2], [en('Darkrai ex'), 2], [EBAG, 1], [PEND, 2], [CYR, 2], [PR, 2], [PB, 2], [SAB, 1], [GIO, 2], [XS, 1], [POT, 1]] }),
  meta({ id: 'meta-lugia-ex-ho-oh-ex', name: 'Lugia ex e Ho-Oh ex', era: 'A4', energy: ['FIRE', 'WATER', 'LIGHTNING'], cover: en('Lugia ex'), difficulty: 'HARD',
    summary: 'Ho-Oh ex distribui uma Energia de Fogo, Água e Elétrica pelo Banco de uma vez; Lugia ex descarrega a Explosão Elemental de 180. Raikou ex e Suicune ex compram cartas enquanto seguram o Ativo.',
    cards: [[en('Lugia ex'), 2], [en('Ho-Oh ex'), 2], [en('Raikou ex'), 1], [en('Suicune ex'), 1], [ESW, 2], [PR, 2], [PB, 2], [GIO, 2], [SAB, 1], [XS, 1], [POT, 2], [LEAF, 1], [CAPE, 1]] }),
  meta({ id: 'meta-suicune-ex-greninja', name: 'Suicune ex e Greninja', era: 'A4a', energy: ['WATER'], cover: en('Suicune ex'), difficulty: 'MEDIUM',
    summary: 'Suicune ex compra uma carta por turno no Ativo e bate 20 por Pokémon em qualquer Banco; Greninja tira 20 onde precisar. Bancos cheios, dos dois lados, rendem mais.',
    cards: [[en('Suicune ex'), 2], [en('Froakie', 'A1'), 2], [en('Frogadier'), 2], [en('Greninja', 'A1'), 2], [CANDY, 2], [MIS, 2], [PR, 2], [PB, 2], [GIO, 1], [XS, 1], [POT, 2]] }),
  meta({ id: 'meta-giratina-ex-darkrai-ex', name: 'Giratina ex e Darkrai ex', era: 'A4b', energy: ['PSYCHIC', 'DARKNESS'], cover: en('Giratina ex'), difficulty: 'HARD',
    summary: 'Giratina ex liga a própria Energia e encerra o turno; Darkrai ex fere o Ativo rival a cada Energia Noturna. Com só quatro Pokémon, a Poké Bola sempre acha um atacante; Mars aperta a mão do rival.',
    cards: [[en('Giratina ex'), 2], [en('Darkrai ex'), 2], [PR, 2], [PB, 2], [CYR, 2], [MARS, 2], [SAB, 1], [GIO, 2], [XS, 2], [POT, 2], [CAPE, 1]] }),
];

/** Dois decks de cada tipo de Energia, mais Dragão e Incolor: linhas acessíveis, boas para começar. */
const BY_TYPE: readonly DeckRecipe[] = [
  byType({ id: 'tipo-planta-venusaur-ex', name: 'Jardim de Venusaur', era: 'A1', energy: ['GRASS'], cover: en('Venusaur ex'), difficulty: 'EASY',
    summary: 'Exeggutor ex ataca por uma Energia desde cedo enquanto Venusaur ex cresce no Banco; Erika cura 50 e mantém o jardim de pé.',
    cards: [[en('Bulbasaur', 'A1'), 2], [en('Ivysaur', 'A1'), 2], [en('Venusaur ex'), 2], [en('Exeggcute', 'A1'), 2], [en('Exeggutor ex'), 2], [CANDY, 2], [ERI, 2], [PR, 2], [PB, 2], [POT, 2]] }),
  byType({ id: 'tipo-planta-decidueye-ex', name: 'Flechas de Decidueye', era: 'A3', energy: ['GRASS'], cover: en('Decidueye ex'), difficulty: 'MEDIUM',
    summary: 'Shiinotic adormece o Ativo rival; Decidueye ex finaliza com Perfurar a Dor em qualquer Pokémon ferido. Hau soma 30 no turno do golpe.',
    cards: [[en('Rowlet', 'A3a'), 2], [en('Dartrix', 'A3a'), 2], [en('Decidueye ex'), 2], [en('Morelull', 'A1a'), 2], [en('Shiinotic', 'A1a'), 2], [CANDY, 2], [HAU, 1], [PR, 2], [PB, 2], [LCAPE, 1], [POT, 2]] }),
  byType({ id: 'tipo-fogo-arcanine-ex', name: 'Brasa de Arcanine', era: 'A1', energy: ['FIRE'], cover: en('Arcanine ex'), difficulty: 'EASY',
    summary: 'Rapidash e Magmar atacam cedo e ficam mais fortes com Blaine (+30); Arcanine ex fecha com 120. Fogo direto e fácil de pilotar.',
    cards: [[en('Growlithe', 'A1'), 2], [en('Arcanine ex'), 2], [en('Ponyta', 'A1'), 2], [en('Rapidash', 'A1'), 2], [en('Magmar', 'A1'), 2], [BLA, 2], [PR, 2], [PB, 2], [POT, 2], [XS, 1], [GIO, 1]] }),
  byType({ id: 'tipo-fogo-incineroar-ex', name: 'Fúria de Incineroar', era: 'A3', energy: ['FIRE'], cover: en('Incineroar ex'), difficulty: 'MEDIUM',
    summary: 'Incineroar ex fica mais forte machucado: Presas de Fogo queimam e o golpe carregado chega a 140. Salazzle envenena enquanto o gato evolui; Hau soma 30.',
    cards: [[en('Litten', 'A3b'), 2], [en('Torracat', 'A3b'), 2], [en('Incineroar ex'), 2], [en('Salandit', 'A1'), 2], [en('Salazzle', 'A1'), 2], [CANDY, 2], [HAU, 2], [PR, 2], [PB, 2], [POT, 2]] }),
  byType({ id: 'tipo-agua-blastoise-ex', name: 'Canhões de Blastoise', era: 'A1', energy: ['WATER'], cover: en('Blastoise ex'), difficulty: 'EASY',
    summary: 'Blastoise ex bate mais com Energia extra; Misty e Doce Raro aceleram a montagem. Lapras segura a frente enquanto o canhão carrega.',
    cards: [[en('Squirtle', 'A1'), 2], [en('Wartortle', 'A1'), 2], [en('Blastoise ex'), 2], [en('Lapras', 'A1'), 2], [CANDY, 2], [MIS, 2], [PR, 2], [PB, 2], [POT, 2], [XS, 1], [GIO, 1]] }),
  byType({ id: 'tipo-agua-primarina-ex', name: 'Ária de Primarina', era: 'A3b', energy: ['WATER'], cover: en('Primarina ex'), difficulty: 'MEDIUM',
    summary: 'Primarina ex cura 20 a cada Ária Cintilante; Irida e Misty mantêm a Água fluindo. Alomomola dá tempo para a evolução.',
    cards: [[en('Popplio', 'A3b'), 2], [en('Brionne', 'A3b'), 2], [en('Primarina ex'), 2], [en('Alomomola'), 2], [CANDY, 2], [MIS, 2], [HAU, 1], [IRI, 1], [PR, 2], [PB, 2], [POT, 1], [GIO, 1]] }),
  byType({ id: 'tipo-eletrico-raichu', name: 'Trovão de Raichu', era: 'A1', energy: ['LIGHTNING'], cover: en('Raichu', 'A1'), difficulty: 'EASY',
    summary: 'Magneton carrega Energia Elétrica sozinho no Banco; Tenente Surge passa tudo para o Raichu no Ativo, que solta o Relâmpago de 140.',
    cards: [[en('Pikachu', 'A1'), 2], [en('Raichu', 'A1'), 2], [en('Magnemite', 'A1'), 2], [en('Magneton', 'A1'), 2], [en('Electabuzz', 'A1'), 2], [SUR, 2], [PR, 2], [PB, 2], [XS, 2], [POT, 2]] }),
  byType({ id: 'tipo-eletrico-lanturn-ex', name: 'Farol de Lanturn', era: 'A4', energy: ['LIGHTNING'], cover: en('Lanturn ex'), difficulty: 'EASY',
    summary: 'Lanturn ex paralisa ou confunde a cada ataque; Ampharos é a reserva pesada. Um deck Elétrico de controle simples.',
    cards: [[en('Chinchou', 'A4'), 2], [en('Lanturn ex'), 2], [en('Mareep', 'A4'), 2], [en('Flaaffy', 'A4'), 2], [en('Ampharos'), 2], [CANDY, 2], [PR, 2], [PB, 2], [POT, 2], [XS, 1], [GIO, 1]] }),
  byType({ id: 'tipo-psiquico-gengar-ex', name: 'Sombras de Gengar', era: 'A1', energy: ['PSYCHIC'], cover: en('Gengar ex'), difficulty: 'MEDIUM',
    summary: 'Gengar ex impede o rival de usar Apoiadores enquanto estiver no Ativo; Mismagius ex confunde. Um deck Psíquico de controle.',
    cards: [[en('Gastly', 'A1'), 2], [en('Haunter', 'A1'), 2], [en('Gengar ex'), 2], [en('Misdreavus', 'A2'), 2], [en('Mismagius ex'), 2], [CANDY, 2], [SAB, 1], [PR, 2], [PB, 2], [POT, 2], [XS, 1]] }),
  byType({ id: 'tipo-psiquico-lunala-ex', name: 'Eclipse de Lunala', era: 'A3', energy: ['PSYCHIC'], cover: en('Lunala ex'), difficulty: 'MEDIUM',
    summary: 'Lunala ex move as Energias Psíquicas do Banco para o Ativo: Mewtwo ex ataca com Psicoimpulso no turno em que entra. A Tábua Mítica acha os Pokémon Psíquicos.',
    cards: [[en('Cosmog'), 2], [en('Cosmoem'), 2], [en('Lunala ex'), 2], [en('Mewtwo ex', 'A1'), 2], [CANDY, 2], [SLAB, 2], [PR, 2], [PB, 2], [SAB, 1], [GIO, 1], [POT, 2]] }),
  byType({ id: 'tipo-lutador-machamp-ex', name: 'Força de Machamp', era: 'A1', energy: ['FIGHTING'], cover: en('Machamp ex'), difficulty: 'EASY',
    summary: 'Hitmonchan e Hitmonlee atacam por pouca Energia enquanto Machamp ex se prepara para o Megassoco de 120.',
    cards: [[en('Machop', 'A1'), 2], [en('Machoke', 'A1'), 2], [en('Machamp ex'), 2], [en('Hitmonlee', 'A1'), 2], [en('Hitmonchan', 'A1'), 2], [CANDY, 2], [PR, 2], [PB, 2], [POT, 2], [GIO, 1], [SAB, 1]] }),
  byType({ id: 'tipo-lutador-lycanroc-ex', name: 'Presas de Lycanroc', era: 'A3a', energy: ['FIGHTING'], cover: en('Lycanroc ex'), difficulty: 'MEDIUM',
    summary: 'Lycanroc ex morde 130 e Lucario soma 20 a cada golpe Lutador; Passimian ex passa as Energias adiante quando cai.',
    cards: [[en('Rockruff', 'A3a'), 2], [en('Lycanroc ex'), 2], [RIOLU, 2], [LUCARIO, 2], [en('Passimian ex'), 1], [HIKER, 1], [PR, 2], [PB, 2], [GIO, 2], [SAB, 1], [POT, 2], [HELM, 1]] }),
  byType({ id: 'tipo-noturno-nidoking', name: 'Reis Venenosos', era: 'A1', energy: ['DARKNESS'], cover: en('Nidoking', 'A1'), difficulty: 'EASY',
    summary: 'Nidoqueen e Nidoking crescem juntos e desgastam o Ativo rival. Doce Raro encurta a espera pelas formas finais.',
    cards: [[en('Nidoran♂'), 2], [en('Nidorino'), 2], [en('Nidoking', 'A1'), 2], [en('Nidoran♀'), 2], [en('Nidorina'), 2], [en('Nidoqueen'), 2], [CANDY, 2], [PR, 2], [PB, 2], [POT, 2]] }),
  byType({ id: 'tipo-noturno-koga', name: 'Neblina de Koga', era: 'A1', energy: ['DARKNESS'], cover: en('Weezing', 'A1'), difficulty: 'EASY',
    summary: 'Weezing e Muk envenenam; Arbok prende o rival no lugar. Koga devolve o Ativo ferido à mão para jogá-lo de novo, inteiro.',
    cards: [[en('Koffing', 'A1'), 2], [en('Weezing', 'A1'), 2], [en('Ekans', 'A1'), 2], [en('Arbok', 'A1'), 2], [en('Grimer', 'A1'), 2], [en('Muk', 'A1'), 2], [KOG, 2], [PR, 2], [PB, 2], [POT, 2]] }),
  byType({ id: 'tipo-metal-tinkaton-ex', name: 'Martelo de Tinkaton', era: 'A4b', energy: ['METAL'], cover: en('Tinkaton ex'), difficulty: 'EASY',
    summary: 'Tinkaton ex martela 80, e 160 com cara na moeda; o Avental de Aço tira 10 de cada golpe e afasta as Condições Especiais.',
    cards: [[en('Tinkatink'), 2], [en('Tinkatuff'), 2], [en('Tinkaton ex'), 2], [en('Mawile', 'A1'), 2], [en('Klefki'), 2], [CANDY, 2], [APRON, 2], [PR, 2], [PB, 2], [POT, 1], [GIO, 1]] }),
  byType({ id: 'tipo-metal-aggron', name: 'Muralha de Aggron', era: 'A3a', energy: ['METAL'], cover: en('Aggron'), difficulty: 'EASY',
    summary: 'Metal paciente: Bronzong e Lairon aguentam, Aggron derruba. Adaman tira 20 de cada ataque no turno do rival.',
    cards: [[en('Aron'), 2], [en('Lairon'), 2], [en('Aggron'), 2], [en('Bronzor', 'A2'), 2], [en('Bronzong', 'A2'), 2], [CANDY, 2], [ADA, 1], [PR, 2], [PB, 2], [POT, 2], [APRON, 1]] }),
  byType({ id: 'tipo-dragao-dragonite-ex', name: 'Voo de Dragonite', era: 'A3b', energy: ['WATER', 'LIGHTNING'], cover: en('Dragonite ex'), difficulty: 'MEDIUM',
    summary: 'Dragonite ex bate 180 com Água, Eletricidade e mais uma Energia; a Troca Elemental move a Energia do Banco para o Ativo. Lapras e Zapdos seguram até lá.',
    cards: [[en('Dratini', 'A1'), 2], [en('Dragonair', 'A1'), 2], [en('Dragonite ex'), 2], [en('Lapras', 'A1'), 1], [en('Zapdos', 'A1'), 1], [CANDY, 2], [ESW, 2], [PR, 2], [PB, 2], [POT, 2], [GIO, 1], [XS, 1]] }),
  byType({ id: 'tipo-incolor-snorlax-ex', name: 'Soneca de Snorlax', era: 'A3b', energy: ['METAL'], cover: en('Snorlax ex'), difficulty: 'EASY',
    summary: 'Snorlax ex cura 20 no Ativo a cada turno e bate 130; os Restos curam mais. Lickilicky ex e Kangaskhan aproveitam qualquer Energia: troque o tipo à vontade.',
    cards: [[en('Snorlax ex'), 2], [en('Kangaskhan', 'A1'), 2], [en('Lickitung', 'A1'), 2], [en('Lickilicky ex'), 2], [en("Farfetch'd", 'A1'), 2], [LEFT, 2], [PR, 2], [PB, 2], [POT, 2], [GIO, 1], [XS, 1]] }),
];

/** Listas queridas pela comunidade: combos divertidos e estratégias que viraram assunto. */
const COMMUNITY: readonly DeckRecipe[] = [
  community({ id: 'comunidade-greninja-druddigon', name: 'Greninja e Druddigon', era: 'A1a', energy: ['WATER'], cover: en('Greninja', 'A1'), difficulty: 'MEDIUM',
    summary: 'Druddigon no Ativo devolve 20 a cada golpe; com o Capacete Rochoso, 40. Greninja tira 20 por turno de onde quiser. Vença pelo desgaste.',
    cards: [[en('Froakie', 'A1'), 2], [en('Frogadier'), 2], [en('Greninja', 'A1'), 2], [en('Druddigon'), 2], [CANDY, 2], [MIS, 2], [CAPE, 2], [HELM, 2], [PR, 2], [PB, 2]] }),
  community({ id: 'comunidade-rampardos', name: 'Cabeçada de Rampardos', era: 'A2', energy: ['FIGHTING'], cover: en('Rampardos'), difficulty: 'MEDIUM',
    summary: 'Rampardos bate 130 por uma única Energia Lutadora; com Lucario no Banco, 150. O Fóssil Crânio abre o caminho.',
    cards: [[SKULL, 2], [en('Cranidos'), 2], [en('Rampardos'), 2], [RIOLU, 2], [LUCARIO, 2], [HIKER, 1], [PR, 2], [PB, 2], [GIO, 2], [SAB, 1], [POT, 1], [XS, 1]] }),
  community({ id: 'comunidade-magnezone', name: 'Ímã de Magnezone', era: 'A2', energy: ['LIGHTNING'], cover: en('Magnezone', 'A2'), difficulty: 'MEDIUM',
    summary: 'Magneton liga Energia sozinho e evolui no Magnezone de 110; Pachirisu ex com o Cabo Elétrico bate 80 por duas Energias.',
    cards: [[en('Magnemite', 'A1'), 2], [en('Magneton', 'A1'), 2], [en('Magnezone', 'A2'), 2], [en('Pachirisu ex'), 2], [en('Voltorb', 'A1'), 1], [en('Electrode', 'A1'), 1], [CANDY, 2], [CORD, 1], [PR, 2], [PB, 2], [POT, 1], [XS, 1], [GIO, 1]] }),
  community({ id: 'comunidade-wigglytuff-ex', name: 'Canção de Wigglytuff', era: 'A1', energy: ['PSYCHIC'], cover: en('Wigglytuff ex'), difficulty: 'EASY',
    summary: 'Wigglytuff ex bate 80 por três Energias quaisquer; Blissey aguenta qualquer golpe e os Restos curam no Ativo. Toda Energia serve: troque o tipo à vontade.',
    cards: [[en('Jigglypuff', 'A1'), 2], [en('Wigglytuff ex'), 2], [en('Chansey', 'A1'), 2], [en('Blissey', 'A4'), 2], [LEFT, 2], [PR, 2], [PB, 2], [POT, 2], [XS, 2], [GIO, 1], [SAB, 1]] }),
  community({ id: 'comunidade-sylveon-espeon', name: 'Fadas de Sylveon', era: 'A3b', energy: ['PSYCHIC'], cover: en('Sylveon ex'), difficulty: 'EASY',
    summary: 'Sylveon ex compra duas cartas ao evoluir; Espeon ex cura 30 por turno no Ativo. A Bolsa de Eevee reforça toda a família.',
    cards: [[en('Eevee ex'), 2], [EEVEE, 2], [en('Sylveon ex'), 2], [en('Espeon ex'), 2], [EBAG, 2], [PR, 2], [PB, 2], [POT, 2], [SAB, 1], [GIO, 1], [XS, 1], [LEFT, 1]] }),
  community({ id: 'comunidade-caes-lendarios', name: 'Cães Lendários', era: 'A4a', energy: ['FIRE', 'WATER', 'LIGHTNING'], cover: en('Entei ex'), difficulty: 'MEDIUM',
    summary: 'Entei ex, Suicune ex e Raikou ex compram uma carta por turno no Ativo (Pulso Lendário); a Troca Elemental e Lyra giram o trio sem perder Energia.',
    cards: [[en('Entei ex'), 2], [en('Suicune ex'), 2], [en('Raikou ex'), 2], [ESW, 2], [PR, 2], [PB, 2], [POT, 2], [XS, 2], [GIO, 2], [SAB, 1], [LYRA, 1]] }),
  community({ id: 'comunidade-golem-brock', name: 'Rolo Compressor de Golem', era: 'A1a', energy: ['FIGHTING'], cover: en('Golem', 'A1a'), difficulty: 'EASY',
    summary: 'Brock liga Energia extra ao Golem e ao Onix; Golem pressiona com 120 e toma 30 a menos no turno seguinte.',
    cards: [[en('Geodude', 'A1'), 2], [en('Graveler', 'A1'), 2], [en('Golem', 'A1a'), 2], [en('Onix', 'A1'), 2], [BRO, 2], [CANDY, 2], [PR, 2], [PB, 2], [POT, 2], [GIO, 1], [SAB, 1]] }),
  community({ id: 'comunidade-shuckle-ex', name: 'Fortaleza de Shuckle', era: 'A4', energy: ['GRASS'], cover: en('Shuckle ex'), difficulty: 'EASY',
    summary: 'Shuckle ex toma 20 a menos de cada golpe e, com a Capa de Folha, chega a 150 PS: insetos que apanham pouco e batem por uma Energia.',
    cards: [[en('Shuckle ex'), 2], [en('Pinsir', 'A1'), 2], [en('Scyther', 'A1'), 2], [en('Heracross', 'A2a'), 2], [LCAPE, 2], [ERI, 2], [PR, 2], [PB, 2], [POT, 2], [GIO, 1], [SAB, 1]] }),
  community({ id: 'comunidade-wugtrio-ex', name: 'Enguias de Wugtrio', era: 'A4b', energy: ['WATER'], cover: en('Wugtrio ex'), difficulty: 'EASY',
    summary: 'Wugtrio ex escolhe três alvos ao acaso e dá 50 em cada: ótimo contra Bancos frágeis. Palkia ex varre 20 de cada Pokémon do Banco rival.',
    cards: [[en('Wiglett'), 2], [en('Wugtrio ex'), 2], [en('Palkia ex'), 2], [en('Manaphy'), 1], [MIS, 2], [CYR, 1], [PR, 2], [PB, 2], [POT, 2], [XS, 1], [GIO, 2], [SAB, 1]] }),
  community({ id: 'comunidade-beedrill-ex', name: 'Enxame de Beedrill', era: 'A4b', energy: ['GRASS'], cover: en('Beedrill ex'), difficulty: 'EASY',
    summary: 'Beedrill ex descarta uma Energia do Ativo rival a cada Lança Esmagadora; Vespiquen cresce com as abelhas que caem.',
    cards: [[en('Weedle', 'A1'), 2], [en('Kakuna', 'A1'), 2], [en('Beedrill ex'), 2], [en('Combee', 'A2'), 2], [en('Vespiquen', 'A2'), 2], [CANDY, 2], [ERI, 1], [PR, 2], [PB, 2], [POT, 2], [GIO, 1]] }),
  community({ id: 'comunidade-poliwrath-ex', name: "Punho d'Água de Poliwrath", era: 'A4a', energy: ['FIGHTING', 'WATER'], cover: en('Poliwrath ex'), difficulty: 'MEDIUM',
    summary: 'Poliwrath ex soma 40 com qualquer Energia de Água ligada: misture Lutador e Água na Zona. Hitmonlee alcança o Banco enquanto a evolução sobe.',
    cards: [[en('Poliwag', 'A1'), 2], [en('Poliwhirl', 'A1'), 2], [en('Poliwrath ex'), 2], [en('Hitmonlee', 'A1'), 2], [CANDY, 2], [ESW, 1], [PR, 2], [PB, 2], [POT, 2], [GIO, 2], [SAB, 1]] }),
  community({ id: 'comunidade-kingdra-ex', name: 'Tempestade de Kingdra', era: 'A4', energy: ['WATER'], cover: en('Kingdra ex'), difficulty: 'EASY',
    summary: 'Kingdra ex prende o Defensor no lugar e bate 90 por duas Energias; Octillery dá cobertura enquanto o Horsea evolui.',
    cards: [[en('Horsea', 'A4'), 2], [en('Seadra', 'A4'), 2], [en('Kingdra ex'), 2], [en('Remoraid'), 2], [en('Octillery'), 2], [CANDY, 2], [MIS, 2], [PR, 2], [PB, 2], [POT, 1], [GIO, 1]] }),
  community({ id: 'comunidade-crobat-ex-clodsire', name: 'Veneno Duplo', era: 'A4', energy: ['DARKNESS'], cover: en('Crobat ex'), difficulty: 'MEDIUM',
    summary: 'Crobat ex e a Farpa Venenosa envenenam; Paldean Clodsire ex bate 120 em quem estiver envenenado.',
    cards: [[en('Zubat', 'A1'), 2], [en('Golbat', 'A1'), 2], [en('Crobat ex'), 2], [en('Paldean Wooper'), 2], [en('Paldean Clodsire ex'), 2], [CANDY, 2], [BARB, 2], [PR, 2], [PB, 2], [GIO, 1], [POT, 1]] }),
  community({ id: 'comunidade-donphan-ex', name: 'Rolo de Donphan', era: 'A4', energy: ['FIGHTING'], cover: en('Donphan ex'), difficulty: 'EASY',
    summary: 'Donphan ex bate 110 com duas Energias extras; Sudowoodo e Hitmonlee seguram a frente enquanto ele carrega.',
    cards: [[en('Phanpy', 'A4'), 2], [en('Donphan ex'), 2], [en('Sudowoodo', 'A2a'), 2], [en('Hitmonlee', 'A1'), 2], [HIKER, 2], [PR, 2], [PB, 2], [POT, 2], [GIO, 2], [SAB, 1], [HELM, 1]] }),
  community({ id: 'comunidade-bibarel-ex', name: 'Castor Teimoso', era: 'A4b', energy: ['FIGHTING'], cover: en('Bibarel ex'), difficulty: 'EASY',
    summary: 'Bibarel ex bate 100 e cura 30 por ataque; Kangaskhan pune evoluções. Toda Energia serve: troque o tipo à vontade.',
    cards: [[en('Bidoof', 'A2'), 2], [en('Bibarel ex'), 2], [en('Snorlax ex'), 1], [en('Kangaskhan', 'A4'), 2], [en('Tauros', 'A1'), 1], [LEFT, 2], [PR, 2], [PB, 2], [POT, 2], [GIO, 2], [SAB, 1], [XS, 1]] }),
];

/** Todas as receitas: meta, por tipo e da comunidade, nessa ordem. */
export const DECK_RECIPES: readonly DeckRecipe[] = [...META, ...BY_TYPE, ...COMMUNITY];
