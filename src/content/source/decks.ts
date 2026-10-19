// Decks de conteúdo 3.0.0: oito iniciais (campanha §3.5, um por tipo de Energia gerável), apoio por capítulo (§3.6),
// modelos de apoio dos sets depois do A1 com uma variação de cada na campanha, e NPC por nó × dificuldade. NPC: a lista STANDARD é autoral, na temática de tipos do capítulo; STORY é derivada (menos peças de
// sinergia, curva menor) e EXPERT aplica trocas autorais de consistência. Todo deck é validado pelo content-build.
import type { CardDefinition, EnergyType } from '../../domain/cards/types.ts';
import { isPokemon } from '../../domain/cards/types.ts';
import type { ContentDeck, Difficulty } from '../types.ts';
import { a1 } from './a1/cards.ts';
import { pocketCard } from './pocket/cards.ts';
import { lupaDeMao, pesquisaDoProfessor, pocao, pokeBola, velocidadeX } from './promo-a.ts';
import { P } from './sets.ts';
import * as S from './starter.ts';

type CardCount = readonly [CardDefinition, 1 | 2];
type Swap = readonly [out: CardDefinition, into: CardDefinition];

function toEntries(cards: readonly CardCount[]): ContentDeck['entries'] {
  return cards.map(([card, count]) => ({ printingId: P(card), count }));
}

function total(cards: readonly CardCount[]): number {
  return cards.reduce((sum, [, n]) => sum + n, 0);
}

/** Lista por nome do A1: `deck(['Pikachu', 2], ['Raichu', 1], [pokeBola, 2])`. */
const deck = (...items: readonly (readonly [string | CardDefinition, 1 | 2])[]): CardCount[] =>
  items.map(([card, n]) => [typeof card === 'string' ? a1(card) : card, n]);
const A = a1;

/** Carta dos sets depois do A1 pelo número de coleção (nomes repetidos entre versões exigem o número). */
const K = (code: string, number: number): CardDefinition => pocketCard(code, number);

// Treinadores: promos básicas e Apoiadores do A1.
const POT = pocao, PB = pokeBola, PROF = pesquisaDoProfessor, XS = velocidadeX, HS = lupaDeMao;
const ERI = A('Erika'), MIS = A('Misty'), BLA = A('Blaine'), KOG = A('Koga'), GIO = A('Giovanni'), BRO = A('Brock'), SAB = A('Sabrina'), SUR = A('Tenente Surge');

// ---------------------------------------------------------------- iniciais

const TRAINERS: readonly CardCount[] = S.STARTER_TRAINERS.map((card) => [card, 2] as const);

function starter(deckId: string, name: string, energy: EnergyType, line: readonly CardDefinition[], note: string): ContentDeck {
  const cards: CardCount[] = [...line.map((card) => [card, 2] as const), ...TRAINERS];
  return { deckId, version: 1, name, kind: 'STARTER', energyTypes: [energy], entries: toEntries(cards), cosmeticPresetId: 'preset-player-default', strategyNote: note };
}

export const STARTER_DECKS: readonly ContentDeck[] = [
  starter('starter-chama-constante', 'Chama Constante', 'FIRE', [S.charmander, S.charmeleon, S.ponyta, S.rapidash],
    'Ponyta e Rapidash atacam por uma Energia enquanto Charmeleon se prepara; Brasa descarta Energia, então planeje a próxima.'),
  starter('starter-mare-serena', 'Maré Serena', 'WATER', [S.squirtle, S.wartortle, S.staryu, S.starmie],
    'Starmie recua de graça: alterne atacantes e preserve Energia; Wartortle segura a linha enquanto o outro recarrega.'),
  starter('starter-jardim-vivo', 'Jardim Vivo', 'GRASS', [S.bulbasaur, S.ivysaur, S.exeggcute, S.exeggutor],
    'Exeggutor bate forte com sorte; Ivysaur dá estabilidade. Poção segura o Ativo enquanto a reserva cresce.'),
  starter('starter-faisca-veloz', 'Faísca Veloz', 'LIGHTNING', [S.mareep, S.flaaffy, S.blitzle, S.zebstrika],
    'Zebstrika bate forte com duas Energias; Flaaffy segura a frente enquanto o Banco carrega. Recue cedo e mantenha o ritmo.'),
  starter('starter-eco-psiquico', 'Eco Psíquico', 'PSYCHIC', [S.swirlix, S.slurpuff, S.duskull, S.dusclops],
    'Slurpuff aguenta e responde com 60; Dusclops é a reserva pesada. Evolua no Banco antes de expor o Ativo.'),
  starter('starter-punho-firme', 'Punho Firme', 'FIGHTING', [S.timburr, S.gurdurr, S.meditite, S.medicham],
    'Medicham chuta por uma Energia; Gurdurr dá corpo à linha de frente. Golpes baratos rendem mais turnos de ataque.'),
  starter('starter-sombra-astuta', 'Sombra Astuta', 'DARKNESS', [S.poochyena, S.mightyena, S.purrloin, S.liepard],
    'Liepard ataca por uma Energia enquanto Mightyena se prepara para o golpe de 60; troque de atacante sem perder tempo.'),
  starter('starter-aco-paciente', 'Aço Paciente', 'METAL', [S.klink, S.klang, S.aron, S.lairon],
    'Lairon e Aron aguentam muito dano; Klang fecha a conta. Paciência: cada Energia ligada vira um golpe mais pesado.'),
];

// ---------------------------------------------------------------- apoio

type SupportSpec = { readonly deckId: string; readonly name: string; readonly energy: readonly EnergyType[]; readonly cards: readonly CardCount[]; readonly note: string };

const SUPPORT_SPECS: readonly SupportSpec[] = [
  { deckId: 'support-c01-v1', name: 'Apoio do Bosque: Fogo na Clareira', energy: ['FIRE'],
    cards: deck(['Charmander', 2], ['Charmeleon', 2], ['Charizard', 1], ['Vulpix', 2], ['Ninetales', 2], ['Growlithe', 2], ['Arcanine', 1], [BLA, 2], [PB, 2], [PROF, 2], [POT, 2]),
    note: 'Fogo contra Planta: Blaine reforça Ninetales no turno certo; encha o Banco antes de perder o Ativo.' },
  { deckId: 'support-c02-v1', name: 'Apoio do Porto: Faísca na Doca', energy: ['LIGHTNING'],
    cards: deck(['Pikachu', 2], ['Raichu', 1], ['Magnemite', 2], ['Magneton', 2], ['Voltorb', 2], ['Electrode', 2], ['Electabuzz', 2], [SUR, 1], [PB, 2], [PROF, 2], [XS, 2]),
    note: 'Elétrico contra Água; Velocidade X barateia o Recuo e Magneton carrega a si mesmo.' },
  { deckId: 'support-c03-v1', name: 'Apoio da Usina: Terra Firme', energy: ['FIGHTING'],
    cards: deck(['Diglett', 2], ['Dugtrio', 2], ['Machop', 2], ['Machoke', 2], ['Machamp', 1], ['Hitmonlee', 2], ['Mankey', 2], ['Primeape', 1], [PB, 2], [PROF, 2], [GIO, 2]),
    note: 'Lutador contra Elétrico; Hitmonlee alcança o Banco e derruba o Pokémon que carrega a usina.' },
  { deckId: 'support-c04-v1', name: 'Apoio do Observatório: Sombra Densa', energy: ['DARKNESS'],
    cards: deck(['Koffing', 2], ['Weezing', 2], ['Ekans', 2], ['Arbok', 2], ['Nidoran♂', 2], ['Nidorino', 2], ['Nidoking', 1], [KOG, 1], [PB, 2], [PROF, 2], [POT, 2]),
    note: 'Noturno contra Psíquico; Recuo e evolução limpam as condições que o observatório aplica.' },
  { deckId: 'support-c05-v1', name: 'Apoio da Fundição: Mente Afiada', energy: ['PSYCHIC'],
    cards: deck(['Abra', 2], ['Kadabra', 2], ['Alakazam', 1], ['Gastly', 2], ['Haunter', 2], ['Gengar', 1], ['Jynx', 2], ['Mr. Mime', 2], [GIO, 2], [PB, 2], [PROF, 2]),
    note: 'Psíquico contra Lutador; Giovanni e Alakazam punem quem acumula Energia.' },
  { deckId: 'support-c06-v1', name: 'Apoio do Arquivo: Conta Certa', energy: ['LIGHTNING'],
    cards: deck(['Pikachu', 2], ['Raichu', 1], ['Electabuzz', 2], ['Zapdos', 2], ['Voltorb', 2], ['Electrode', 2], ['Blitzle', 2], ['Zebstrika', 2], [PB, 2], [PROF, 2], [GIO, 1]),
    note: 'Só atacantes de um ponto; Zebstrika escolhe o alvo que vale mais.' },
  { deckId: 'support-c06-psi-v1', name: 'Apoio do Arquivo: Leitura Psíquica', energy: ['PSYCHIC'],
    cards: deck(['Ralts', 2], ['Kirlia', 2], ['Gardevoir', 1], ['Mewtwo', 2], ['Jynx', 2], ['Mr. Mime', 2], ['Drowzee', 2], ['Hypno', 1], [PB, 2], [PROF, 2], [GIO, 2]),
    note: 'Psíquico contra Lutador: derrube o ex sem expor um ex seu; Gardevoir acelera o Ativo.' },
  { deckId: 'support-c06-mare-v1', name: 'Apoio do Arquivo: Maré Contada', energy: ['WATER'],
    cards: deck(['Squirtle', 2], ['Wartortle', 2], ['Blastoise', 1], ['Staryu', 2], ['Starmie', 2], ['Lapras', 1], ['Horsea', 2], ['Seadra', 2], [MIS, 2], [PB, 2], [PROF, 2]),
    note: 'Água contra Fogo, só com Pokémon de um ponto: o risco fica todo do outro lado.' },
  { deckId: 'support-f00-chama-v1', name: 'Apoio do Circuito: Chama Final', energy: ['FIRE'],
    cards: deck(['Charmander', 2], ['Charmeleon', 2], ['Charizard ex', 1], ['Growlithe', 2], ['Arcanine ex', 2], ['Moltres', 1], ['Vulpix', 2], ['Ninetales', 2], [BLA, 2], [PB, 2], [PROF, 2]),
    note: 'Fogo contra Planta, com ex para fechar a conta de pontos.' },
  { deckId: 'support-f00-mare-v1', name: 'Apoio do Circuito: Maré Final', energy: ['WATER'],
    cards: deck(['Squirtle', 2], ['Wartortle', 2], ['Blastoise ex', 2], ['Staryu', 2], ['Starmie ex', 1], ['Lapras', 1], ['Psyduck', 2], ['Golduck', 1], [MIS, 2], [PB, 2], [PROF, 2], [POT, 1]),
    note: 'Água contra Fogo; Psyduck tira o Apoiador do adversário antes do golpe decisivo.' },
  { deckId: 'support-f00-v1', name: 'Apoio do Circuito: Circuito Fechado', energy: ['LIGHTNING'],
    cards: deck(['Pikachu ex', 2], ['Zapdos ex', 1], ['Pikachu', 2], ['Raichu', 1], ['Magnemite', 2], ['Magneton', 2], ['Voltorb', 2], ['Electrode', 1], [SUR, 1], [PB, 2], [PROF, 2], [GIO, 2]),
    note: 'Pikachu ex cresce com o Banco cheio de Elétricos; Magneton acelera e um ex decide a conta de pontos.' },
];

// ---------------------------------------------------------------- modelos dos sets novos e variações na campanha

// Peças repetidas entre modelos e variações.
const EEVEE = K('A3b', 55), EEVEE_EX = K('A3b', 56), EEVEE_BAG = K('A3b', 66);
const COSMOG = K('A3', 85), COSMOEM = K('A3', 86), RARE_CANDY = K('A3', 144), LILLIE = K('A3', 155), COMFEY = K('A3', 80);
const TYNAMO = K('A4a', 26), EELEKTRIK = K('A4a', 27), EELEKTROSS = K('A4a', 28);
const PIPLUP = K('A2', 35), PRINPLUP = K('A2', 36), EMPOLEON = K('A2', 37), SWINUB = K('A2', 31), PILOSWINE = K('A2', 32), MAMOSWINE = K('A2', 33);

/**
 * Um modelo por set novo, montado em volta da mecânica que o set estreou (na aba “Modelos e apoio” e nas batalhas
 * livres). As variações abaixo adaptam cada ideia à vantagem de tipo de um capítulo e entram como opção de apoio dos
 * encontros daquele capítulo.
 */
const MODEL_SPECS: readonly SupportSpec[] = [
  { deckId: 'support-a1a-v1', name: 'Modelo Ilha Mítica: Totem da Selva', energy: ['GRASS'],
    cards: [[K('A1a', 3), 2], [K('A1a', 4), 2], [K('A1a', 5), 2], [K('A1a', 6), 2], [A('Exeggcute'), 2], [ERI, 2], [K('A1a', 68), 1], [K('A1a', 67), 1], [PB, 2], [PROF, 2], [POT, 2]],
    note: 'Serperior faz cada Energia de Planta valer duas: Celebi ex joga mais moedas e bate muito mais forte.' },
  { deckId: 'support-a2-v1', name: 'Modelo Choque Espaço-Tempo: Maré Dimensional', energy: ['WATER'],
    cards: [[K('A2', 49), 2], [K('A2', 50), 2], [PIPLUP, 2], [PRINPLUP, 2], [EMPOLEON, 1], [SWINUB, 2], [PILOSWINE, 1], [MAMOSWINE, 1], [K('A2', 154), 1], [PB, 2], [PROF, 2], [POT, 2]],
    note: 'Palkia ex fecha o jogo com 150; Mamoswine e Piloswine aguentam Fogo e Água enquanto a Energia se acumula.' },
  { deckId: 'support-a2a-v1', name: 'Modelo Luz Triunfante: Arceus e o Bando', energy: ['DARKNESS'],
    cards: [[K('A2a', 71), 2], [K('A2a', 48), 2], [K('A2a', 49), 2], [K('A2a', 50), 2], [K('A2a', 69), 1], [K('A2a', 35), 1], [K('A2', 150), 1], [PB, 2], [PROF, 2], [POT, 2], [XS, 2], [HS, 1]],
    note: 'Com Arceus ex em jogo, cada Crobat espalha dano todo turno e Rotom recua de graça; Arceus ex não sofre Condições.' },
  { deckId: 'support-a3-v1', name: 'Modelo Guardiões Celestiais: Sol e Lua', energy: ['METAL', 'PSYCHIC'],
    cards: [[COSMOG, 2], [COSMOEM, 2], [K('A3', 122), 2], [K('A3', 87), 2], [COMFEY, 2], [RARE_CANDY, 2], [LILLIE, 2], [PB, 2], [PROF, 2], [POT, 2]],
    note: 'Doce Raro pula Cosmoem; Lunala ex passa as Energias de Psíquico para quem vai atacar e Solgaleo ex entra no Ativo do Banco.' },
  { deckId: 'support-a3a-v1', name: 'Modelo Crise Extradimensional: Ultracriaturas', energy: ['GRASS'],
    cards: [[K('A3a', 6), 2], [K('A3a', 7), 2], [K('A3a', 8), 2], [K('A3a', 62), 1], [K('A3a', 69), 2], [K('A3a', 63), 2], [K('A3a', 66), 1], [PB, 2], [PROF, 2], [POT, 2], [XS, 2]],
    note: 'Ultracriaturas crescem quando você pontua: Bestita soma dano por ponto e Lusamine recarrega depois do primeiro ponto do oponente.' },
  { deckId: 'support-a3b-v1', name: 'Modelo Bosque de Eevee: Laço de Fada', energy: ['PSYCHIC'],
    cards: [[EEVEE_EX, 2], [EEVEE, 2], [K('A3b', 34), 2], [K('A3b', 28), 2], [EEVEE_BAG, 2], [K('A3b', 69), 1], [PB, 2], [PROF, 2], [POT, 2], [XS, 2], [HS, 1]],
    note: 'Eevee ex evolui para qualquer evolução de Eevee; Sylveon ex compra duas cartas ao entrar e a Bolsa de Eevee escolhe entre dano e cura.' },
  { deckId: 'support-a4-v1', name: 'Modelo Sabedoria do Mar e do Céu: Fênix Arco-Íris', energy: ['FIRE', 'WATER', 'LIGHTNING'],
    cards: [[K('A4', 34), 2], [K('A4', 149), 2], [K('A4', 140), 2], [K('A4', 141), 2], [K('A4', 151), 2], [K('A4', 156), 1], [K('A4', 155), 1], [PB, 2], [PROF, 2], [POT, 2], [XS, 2]],
    note: 'Ho-Oh ex distribui Fogo, Água e Elétrico pelo Banco; Lugia ex usa as três de uma vez para 180.' },
  { deckId: 'support-a4a-v1', name: 'Modelo Fontes Ocultas: Feras Lendárias', energy: ['WATER', 'LIGHTNING'],
    cards: [[K('A4a', 20), 2], [K('A4a', 25), 2], [TYNAMO, 2], [EELEKTRIK, 2], [EELEKTROSS, 1], [K('A4a', 67), 2], [K('A4a', 70), 1], [PB, 2], [PROF, 2], [POT, 2], [XS, 2]],
    note: 'Suicune ex e Raikou ex compram uma carta por turno no Ativo; Bote Inflável deixa a troca entre eles barata.' },
];

/** Variação de um modelo para cada capítulo, com vantagem de tipo sobre os NPCs dele. */
const CAMPAIGN_VARIANT_SPECS: readonly (SupportSpec & { readonly chapterId: string })[] = [
  { chapterId: 'C01', deckId: 'support-c01-fenix-v1', name: 'Apoio do Bosque: Fênix na Clareira', energy: ['FIRE'],
    cards: [[K('A4', 34), 2], [EEVEE, 2], [K('A3b', 9), 2], [K('A3', 131), 2], [K('A3', 28), 2], [K('A3', 29), 1], [EEVEE_BAG, 1], [PB, 2], [PROF, 2], [POT, 2], [XS, 2]],
    note: 'Variação de Fênix Arco-Íris contra Planta: Flareon ex recicla o Fogo do descarte e Talonflame fecha a conta.' },
  { chapterId: 'C02', deckId: 'support-c02-feras-v1', name: 'Apoio do Porto: Trovão das Feras', energy: ['LIGHTNING'],
    cards: [[K('A4a', 25), 2], [TYNAMO, 2], [EELEKTRIK, 2], [EELEKTROSS, 1], [S.mareep, 2], [S.flaaffy, 2], [K('A4', 69), 1], [PB, 2], [PROF, 2], [POT, 2], [XS, 2]],
    note: 'Variação de Feras Lendárias contra Água: Raikou ex compra no Ativo enquanto Eelektross e Ampharos se armam.' },
  { chapterId: 'C03', deckId: 'support-c03-uivo-v1', name: 'Apoio da Usina: Uivo de Pedra', energy: ['FIGHTING'],
    cards: [[K('A3a', 32), 2], [K('A3a', 33), 2], [S.timburr, 2], [S.gurdurr, 2], [K('A3', 96), 1], [K('A3', 104), 1], [RARE_CANDY, 2], [PB, 2], [PROF, 2], [POT, 2], [XS, 2]],
    note: 'Variação de Ultracriaturas contra Elétrico: Lycanroc ex bate 130 e Conkeldurr pode sobreviver com 10 PS.' },
  { chapterId: 'C04', deckId: 'support-c04-lua-v1', name: 'Apoio do Observatório: Lua Sombria', energy: ['DARKNESS'],
    cards: [[EEVEE, 2], [K('A4', 112), 2], [EEVEE_EX, 1], [K('A4', 113), 2], [K('A4', 114), 2], [S.poochyena, 2], [S.mightyena, 2], [EEVEE_BAG, 1], [PB, 2], [PROF, 2], [POT, 2]],
    note: 'Variação de Laço de Fada contra Psíquico: Umbreon ex puxa o alvo certo para o Ativo e o Noturno bate na Fraqueza.' },
  { chapterId: 'C05', deckId: 'support-c05-lua-v1', name: 'Apoio da Fundição: Lua Crescente', energy: ['PSYCHIC'],
    cards: [[COSMOG, 2], [COSMOEM, 2], [K('A3', 87), 2], [S.swirlix, 2], [S.slurpuff, 2], [COMFEY, 1], [RARE_CANDY, 2], [LILLIE, 1], [PB, 2], [PROF, 2], [POT, 2]],
    note: 'Variação de Sol e Lua contra Lutador: Lunala ex leva o Psíquico para quem vai atacar, Slurpuff segura a frente.' },
  { chapterId: 'C06', deckId: 'support-c06-eco-v1', name: 'Apoio do Arquivo: Eco sem Risco', energy: ['PSYCHIC'],
    cards: [[S.duskull, 2], [S.dusclops, 2], [K('A2', 72), 1], [S.swirlix, 2], [S.slurpuff, 2], [COMFEY, 2], [RARE_CANDY, 2], [PB, 2], [PROF, 2], [POT, 2], [XS, 1]],
    note: 'Variação de Sol e Lua só com Pokémon de um ponto: Dusknoir move o dano para longe de quem está ameaçado.' },
  { chapterId: 'F00', deckId: 'support-f00-palkia-v1', name: 'Apoio do Circuito: Maré Dimensional', energy: ['WATER'],
    cards: [[K('A2', 49), 2], [K('A2', 50), 2], [PIPLUP, 2], [PRINPLUP, 2], [EMPOLEON, 1], [K('A4a', 20), 1], [SWINUB, 2], [PILOSWINE, 1], [MAMOSWINE, 1], [K('A2', 154), 1], [PB, 2], [PROF, 2], [POT, 1]],
    note: 'Variação de Maré Dimensional para a final: Água contra os decks de Fogo, com Suicune ex para comprar cartas.' },
];

export const SUPPORT_DECKS: readonly ContentDeck[] = [...SUPPORT_SPECS, ...MODEL_SPECS, ...CAMPAIGN_VARIANT_SPECS].map((spec) => ({
  deckId: spec.deckId, version: 1, name: spec.name, kind: 'SUPPORT', energyTypes: [...spec.energy], entries: toEntries(spec.cards),
  cosmeticPresetId: null, strategyNote: spec.note,
}));

export const SUPPORT_DECK_BY_CHAPTER: Readonly<Record<string, string>> = {
  C01: 'support-c01-v1', C02: 'support-c02-v1', C03: 'support-c03-v1', C04: 'support-c04-v1', C05: 'support-c05-v1', C06: 'support-c06-v1', F00: 'support-f00-v1',
};

/** Encontros mistos têm apoio específico (vantagem de tipo); o primeiro da lista é o recomendado. */
const SUPPORT_DECK_OVERRIDES: Readonly<Record<string, readonly string[]>> = {
  'C06-E01': ['support-c06-psi-v1', 'support-c06-v1'],
  'C06-E03': ['support-c06-mare-v1', 'support-c06-v1'],
  'C06-E05': ['support-c06-psi-v1', 'support-c06-v1'],
  'C06-E06': ['support-c06-v1', 'support-c06-mare-v1'],
  'F00-D01': ['support-f00-chama-v1', 'support-f00-v1'],
  'F00-D02': ['support-f00-v1', 'support-f00-mare-v1'],
  'F00-D03': ['support-f00-mare-v1', 'support-f00-v1'],
};

/** Variação dos modelos dos sets novos oferecida em todos os encontros do capítulo (depois das recomendadas). */
export const SUPPORT_VARIANT_BY_CHAPTER: Readonly<Record<string, string>> = Object.fromEntries(CAMPAIGN_VARIANT_SPECS.map((s) => [s.chapterId, s.deckId]));

export function supportDecksFor(nodeId: string, chapterId: string): readonly string[] {
  const base = SUPPORT_DECK_OVERRIDES[nodeId] ?? (SUPPORT_DECK_BY_CHAPTER[chapterId] ? [SUPPORT_DECK_BY_CHAPTER[chapterId]!] : []);
  const variant = SUPPORT_VARIANT_BY_CHAPTER[chapterId];
  return base.length && variant ? [...base, variant] : base;
}

// ---------------------------------------------------------------- NPC

export type NpcDeckSpec = {
  readonly nodeId: string;
  readonly name: string;
  readonly preset: string;
  readonly energy: readonly EnergyType[];
  readonly cards: readonly CardCount[];
  readonly expert: readonly Swap[];
  readonly note: string;
};

const isPower = (def: CardDefinition): boolean =>
  (isPokemon(def) && (def.stage === 'STAGE_2' || def.ruleBox !== 'NONE')) || (def.category === 'TRAINER' && def.subtype === 'SUPPORTER');

/** Cartas simples usadas para completar listas História (ordem de preferência). */
const STORY_FILLERS: readonly CardDefinition[] = [POT, PB, A('Rattata'), A('Pidgey'), HS, XS];

/** História: uma cópia a menos de cada peça de sinergia (Estágio 2, ex, Apoiadores), completando com Básicos e cartas simples. */
export function deriveStory(cards: readonly CardCount[]): CardCount[] {
  const list: [CardDefinition, number][] = cards.map(([card, n]) => [card, n]);
  let freed = 0;
  for (const item of list) {
    if (item[1] === 2 && isPower(item[0])) { item[1] = 1; freed += 1; }
  }
  for (const item of list) {
    const def = item[0];
    if (freed > 0 && item[1] === 1 && isPokemon(def) && def.stage === 'BASIC' && def.ruleBox === 'NONE') { item[1] = 2; freed -= 1; }
  }
  for (const filler of STORY_FILLERS) {
    while (freed > 0) {
      const found = list.find(([card]) => card.id === filler.id);
      if (found && found[1] >= 2) break;
      if (found) found[1] += 1;
      else list.push([filler, 1]);
      freed -= 1;
    }
  }
  if (freed > 0) throw new Error('deriveStory: sem cartas de preenchimento suficientes');
  return list.map(([card, n]) => [card, n as 1 | 2]);
}

/** Especialista: aplica trocas autorais de uma cópia cada (sai → entra). */
export function deriveExpert(cards: readonly CardCount[], swaps: readonly Swap[]): CardCount[] {
  const list: [CardDefinition, number][] = cards.map(([card, n]) => [card, n]);
  for (const [out, into] of swaps) {
    const removed = list.find(([card]) => card.id === out.id);
    if (!removed || removed[1] < 1) throw new Error(`deriveExpert: ${out.id} ausente`);
    removed[1] -= 1;
    const added = list.find(([card]) => card.id === into.id);
    if (added) added[1] += 1;
    else list.push([into, 1]);
  }
  return list.filter(([, n]) => n > 0).map(([card, n]) => [card, n as 1 | 2]);
}

export const NPC_DECK_SPECS: readonly NpcDeckSpec[] = [
  // ---- C01 — Bosque das Reservas (Planta)
  { nodeId: 'C01-E01', name: 'Milo — Primeiras Raízes', preset: 'preset-npc-c01', energy: ['GRASS'],
    cards: deck(['Oddish', 2], ['Bellsprout', 2], ['Paras', 2], ['Tangela', 2], ['Bulbasaur', 2], ['Scyther', 2], [POT, 2], [PROF, 2], [PB, 2], [HS, 2]),
    expert: [[HS, ERI], [HS, ERI], [A('Scyther'), A('Gloom')], [A('Scyther'), A('Gloom')]],
    note: 'Só Básicos de um ponto e pouca pressão: ótimo para encher o Banco com calma.' },
  { nodeId: 'C01-E03', name: 'Gardenia — Crescimento em Dupla', preset: 'preset-npc-c01', energy: ['GRASS'],
    cards: deck(['Oddish', 2], ['Gloom', 2], ['Bellsprout', 2], ['Weepinbell', 2], ['Tangela', 1], ['Paras', 1], [ERI, 2], [POT, 2], [PROF, 2], [PB, 2], [GIO, 2]),
    expert: [[A('Paras'), A('Vileplume')], [A('Tangela'), A('Victreebel')]],
    note: 'Duas linhas evolutivas; derrubar o único atacante pronto atrasa o plano inteiro.' },
  { nodeId: 'C01-E05', name: 'Viola — Duas Copas', preset: 'preset-npc-c01', energy: ['GRASS'],
    cards: deck(['Petilil', 2], ['Lilligant', 2], ['Skiddo', 2], ['Gogoat', 2], ['Exeggcute', 2], ['Exeggutor', 2], [ERI, 2], [POT, 2], [PROF, 2], [XS, 2]),
    expert: [[POT, A('Exeggutor ex')], [XS, PB]],
    note: 'Alterna duas linhas de Estágio 1 e usa Lilligant para carregar a reserva.' },
  { nodeId: 'C01-E06', name: 'Erika — Líder de Celadon', preset: 'preset-npc-c01', energy: ['GRASS'],
    cards: deck(['Bulbasaur', 2], ['Ivysaur', 2], ['Venusaur', 1], ['Oddish', 2], ['Gloom', 2], ['Vileplume', 1], ['Petilil', 2], ['Lilligant', 2], [ERI, 2], [PROF, 2], [PB, 2]),
    expert: [[A('Lilligant'), A('Vileplume')], [PB, POT]],
    note: 'Prepara o segundo atacante enquanto o primeiro segura o dano; Erika cura quem estiver na frente.' },
  // ---- C02 — Porto das Marés (Água)
  { nodeId: 'C02-E01', name: 'Marlon — Atracar', preset: 'preset-npc-c02', energy: ['WATER'],
    cards: deck(['Staryu', 2], ['Starmie', 2], ['Seel', 2], ['Dewgong', 2], ['Shellder', 2], ['Cloyster', 2], ['Krabby', 2], [POT, 2], [PROF, 2], [PB, 2]),
    expert: [[POT, A('Kingler')], [POT, A('Kingler')]],
    note: 'Atacantes com Recuo bem diferentes: Starmie sai de graça, Dewgong quase nunca.' },
  { nodeId: 'C02-E03', name: 'Crasher Wake — Fluxo de Retorno', preset: 'preset-npc-c02', energy: ['WATER'],
    cards: deck(['Psyduck', 2], ['Golduck', 2], ['Horsea', 2], ['Seadra', 2], ['Squirtle', 2], ['Wartortle', 2], [MIS, 2], [POT, 2], [XS, 2], [PROF, 2]),
    expert: [[XS, SAB], [POT, A('Blastoise')]],
    note: 'Cura moderada e trocas constantes; cada volta ao Banco apaga um pouco do seu progresso.' },
  { nodeId: 'C02-E05', name: 'Melony — Corrente Cruzada', preset: 'preset-npc-c02', energy: ['WATER'],
    cards: deck(['Tentacool', 2], ['Tentacruel', 2], ['Goldeen', 2], ['Seaking', 2], ['Krabby', 2], ['Kingler', 1], ['Lapras', 1], [SAB, 2], [PROF, 2], [PB, 2], [POT, 2]),
    expert: [[POT, A('Lapras')], [PB, A('Articuno')]],
    note: 'Sabrina força você a escolher um novo Ativo; tenha mais de uma resposta pronta no Banco.' },
  { nodeId: 'C02-E06', name: 'Wallace — Líder de Sootopolis', preset: 'preset-npc-c02', energy: ['WATER'],
    cards: deck(['Squirtle', 2], ['Wartortle', 2], ['Blastoise', 1], ['Staryu', 2], ['Starmie', 2], ['Froakie', 2], ['Frogadier', 2], ['Greninja', 1], [MIS, 2], [PROF, 2], [PB, 2]),
    expert: [[PB, A('Blastoise')], [A('Staryu'), A('Lapras')]],
    note: 'Alterna atacantes e guarda Energias para o próximo turno; Greninja acerta o Banco.' },
  // ---- C03 — Usina dos Circuitos (Elétrico)
  { nodeId: 'C03-E01', name: 'Elesa — Carga Inicial', preset: 'preset-npc-c03', energy: ['LIGHTNING'],
    cards: deck(['Pikachu', 2], ['Magnemite', 2], ['Voltorb', 2], ['Electrode', 2], ['Blitzle', 2], ['Zebstrika', 2], ['Electabuzz', 2], [POT, 2], [PROF, 2], [PB, 2]),
    expert: [[POT, A('Raichu')], [POT, A('Raichu')]],
    note: 'Ataques que pedem Elétrico específico; conte as Energias de cada um.' },
  { nodeId: 'C03-E03', name: 'Clemont — Circuito Auxiliar', preset: 'preset-npc-c03', energy: ['LIGHTNING'],
    cards: deck(['Magnemite', 2], ['Magneton', 2], ['Pikachu', 2], ['Raichu', 1], ['Voltorb', 2], ['Electrode', 2], ['Helioptile', 2], ['Heliolisk', 1], [SUR, 2], [PROF, 2], [PB, 2]),
    expert: [[A('Heliolisk'), A('Raichu')], [A('Helioptile'), A('Zapdos')]],
    note: 'Magneton acelera a si mesmo uma vez por turno; Tenente Surge leva a carga do Banco para a frente.' },
  { nodeId: 'C03-E05', name: 'Iono — Fio Desencapado', preset: 'preset-npc-c03', energy: ['LIGHTNING'],
    cards: deck(['Tynamo', 2], ['Eelektrik', 2], ['Eelektross', 1], ['Pincurchin', 2], ['Blitzle', 2], ['Zebstrika', 2], ['Electabuzz', 2], [PROF, 2], [PB, 2], [POT, 2], [XS, 1]),
    expert: [[XS, A('Eelektross')], [POT, A('Zapdos')]],
    note: 'Paralisia na moeda e dano dirigido ao Banco; não deixe um só Pokémon carregar tudo.' },
  { nodeId: 'C03-E06', name: 'Tenente Surge — Líder de Vermilion', preset: 'preset-npc-c03', energy: ['LIGHTNING'],
    cards: deck(['Magnemite', 2], ['Magneton', 2], ['Pikachu', 2], ['Raichu', 2], ['Zapdos', 2], ['Electabuzz', 2], [SUR, 2], [PROF, 2], [PB, 2], [GIO, 2]),
    expert: [[A('Electabuzz'), A('Pikachu ex')], [GIO, POT]],
    note: 'Magneton no Banco alimenta o atacante principal; interrompa a fonte.' },
  // ---- C04 — Observatório dos Ecos (Psíquico/Noturno, condições)
  { nodeId: 'C04-E01', name: 'Koga — Bruma Leve', preset: 'preset-npc-c04', energy: ['DARKNESS', 'PSYCHIC'],
    cards: deck(['Koffing', 2], ['Weezing', 2], ['Grimer', 2], ['Muk', 1], ['Gastly', 2], ['Haunter', 2], ['Ekans', 2], ['Arbok', 1], [POT, 2], [PROF, 2], [PB, 2]),
    expert: [[POT, A('Muk')], [PB, A('Gengar')]],
    note: 'Veneno e dano entre turnos; trocar, recuar ou evoluir limpa a condição.' },
  { nodeId: 'C04-E03', name: 'Liza — Vigília', preset: 'preset-npc-c04', energy: ['PSYCHIC'],
    cards: deck(['Drowzee', 2], ['Hypno', 2], ['Jigglypuff', 2], ['Wigglytuff', 1], ['Clefairy', 2], ['Clefable', 2], ['Jynx', 2], ['Mr. Mime', 1], [POT, 2], [PROF, 2], [PB, 2]),
    expert: [[A('Wigglytuff'), A('Wigglytuff ex')], [POT, SAB]],
    note: 'Sono na moeda do Hypno e barreiras do Mr. Mime; leia antes de gastar a Energia.' },
  { nodeId: 'C04-E05', name: 'Morty — Ecos Sobrepostos', preset: 'preset-npc-c04', energy: ['DARKNESS', 'PSYCHIC'],
    cards: deck(['Koffing', 2], ['Weezing', 2], ['Drowzee', 2], ['Hypno', 2], ['Gastly', 2], ['Haunter', 2], ['Gengar', 1], ['Grimer', 2], [KOG, 1], [PROF, 2], [PB, 2]),
    expert: [[KOG, A('Muk')], [PB, A('Gengar')]],
    note: 'Veneno coexistindo com Sono; Gengar tranca os seus Apoiadores.' },
  { nodeId: 'C04-E06', name: 'Sabrina — Líder de Saffron', preset: 'preset-npc-c04', energy: ['PSYCHIC'],
    cards: deck(['Ralts', 2], ['Kirlia', 2], ['Gardevoir', 2], ['Gastly', 2], ['Haunter', 2], ['Gengar', 1], ['Mewtwo', 2], ['Drowzee', 1], ['Hypno', 1], [PROF, 2], [PB, 2], [SAB, 1]),
    expert: [[A('Hypno'), A('Gengar ex')], [SAB, A('Mewtwo ex')]],
    note: 'Gardevoir acelera o Ativo psíquico; Gengar e Hypno controlam o seu turno.' },
  // ---- C05 — Fundição dos Símbolos (Lutador/Metálico, Apoiadores e modificadores)
  { nodeId: 'C05-E01', name: 'Chuck — Uma Camada a Mais', preset: 'preset-npc-c05', energy: ['FIGHTING'],
    cards: deck(['Machop', 2], ['Machoke', 2], ['Hitmonchan', 2], ['Hitmonlee', 2], ['Mankey', 2], ['Primeape', 2], [GIO, 2], [PROF, 2], [PB, 2], [POT, 2]),
    expert: [[POT, A('Machamp')], [PB, A('Machamp')]],
    note: 'Giovanni soma dano no turno certo; calcule o Nocaute contando o bônus.' },
  { nodeId: 'C05-E03', name: 'Roark — Terreno Compartilhado', preset: 'preset-npc-c05', energy: ['FIGHTING'],
    cards: deck(['Geodude', 2], ['Graveler', 2], ['Golem', 1], ['Onix', 2], ['Rhyhorn', 2], ['Rhydon', 1], ['Sandshrew', 2], ['Sandslash', 2], [BRO, 2], [PROF, 2], [PB, 2]),
    expert: [[PB, A('Golem')], [A('Sandslash'), A('Rhydon')]],
    note: 'Pokémon pesados e lentos; Brock carrega Onix e Golem mais rápido do que parece.' },
  { nodeId: 'C05-E05', name: 'Jasmine — Metal de Retorno', preset: 'preset-npc-c05', energy: ['METAL', 'FIGHTING'],
    cards: deck(['Meltan', 2], ['Melmetal', 2], ['Mawile', 2], ['Pawniard', 2], ['Bisharp', 2], ['Cubone', 2], ['Marowak', 2], [GIO, 2], [PROF, 2], [POT, 2]),
    expert: [[POT, A('Marowak ex')], [A('Mawile'), A('Hitmonchan')]],
    note: 'Melmetal reduz o dano que recebe; o Cubone corta o seu dano no turno seguinte.' },
  { nodeId: 'C05-E06', name: 'Bea — Líder de Stow-on-Side', preset: 'preset-npc-c05', energy: ['FIGHTING', 'METAL'],
    cards: deck(['Machop', 2], ['Machoke', 2], ['Machamp', 2], ['Meltan', 2], ['Melmetal', 2], ['Onix', 1], ['Hitmonchan', 1], [GIO, 2], [BRO, 1], [PROF, 2], [PB, 2], [POT, 1]),
    expert: [[A('Onix'), A('Machamp ex')], [POT, XS]],
    note: 'Machamp com Giovanni e Melmetal blindado: perder uma peça muda todas as contas.' },
  // ---- C06 — Arquivo Elevado (ex e risco de pontos)
  { nodeId: 'C06-E01', name: 'Korrina — Um Ponto de Cada Vez', preset: 'preset-npc-c06', energy: ['FIGHTING'],
    cards: deck(['Hitmonlee', 2], ['Hitmonchan', 2], ['Mankey', 2], ['Primeape', 2], ['Clobbopus', 2], ['Grapploct', 2], ["Farfetch'd", 2], [PROF, 2], [PB, 2], [POT, 2]),
    expert: [[POT, A('Sandshrew')], [POT, A('Sandslash')]],
    note: 'Só alvos de um ponto: cada Nocaute conta igual, então velocidade importa.' },
  { nodeId: 'C06-E03', name: 'Blaine — Duas Faces do Plano', preset: 'preset-npc-c06', energy: ['FIRE'],
    cards: deck(['Growlithe', 2], ['Arcanine ex', 2], ['Vulpix', 2], ['Ninetales', 2], ['Ponyta', 2], ['Rapidash', 2], [BLA, 2], [PROF, 2], [PB, 2], [POT, 2]),
    expert: [[POT, A('Moltres ex')], [A('Rapidash'), A('Arcanine')]],
    note: 'Um ex poderoso protegido por Vulpix, que trava o seu ataque; conte quanto vale cada alvo.' },
  { nodeId: 'C06-E05', name: 'Clay — Ápice de Dois Pontos', preset: 'preset-npc-c06', energy: ['FIGHTING'],
    cards: deck(['Cubone', 2], ['Marowak ex', 2], ['Machop', 2], ['Machoke', 2], ['Machamp ex', 1], ['Diglett', 2], ['Dugtrio', 2], [GIO, 2], [PROF, 2], [PB, 2], [POT, 1]),
    expert: [[POT, A('Machamp ex')], [PB, SAB]],
    note: 'Dois ex de Lutador: um Nocaute vale dois pontos — dos dois lados.' },
  { nodeId: 'C06-E06', name: 'Blue — Líder de Viridian', preset: 'preset-npc-c06', energy: ['PSYCHIC', 'WATER'],
    cards: deck(['Mewtwo ex', 2], ['Ralts', 2], ['Kirlia', 2], ['Gardevoir', 2], ['Articuno ex', 1], ['Staryu', 2], ['Starmie ex', 1], [MIS, 2], [PROF, 2], [PB, 2], [SAB, 2]),
    expert: [[SAB, A('Articuno ex')], [MIS, A('Starmie ex')]],
    note: 'Deck misto que alterna o risco entre atacantes ex e Gardevoir de apoio.' },
  // ---- Final
  { nodeId: 'F00-D01', name: 'Cheren — Exame de Retorno', preset: 'preset-npc-final', energy: ['GRASS'],
    cards: deck(['Bulbasaur', 2], ['Ivysaur', 2], ['Venusaur ex', 1], ['Petilil', 2], ['Lilligant', 2], ['Exeggcute', 2], ['Exeggutor ex', 1], ['Weedle', 2], ['Kakuna', 1], [ERI, 2], [PROF, 2], [PB, 1]),
    expert: [[A('Weedle'), A('Venusaur ex')], [PB, A('Exeggutor ex')]],
    note: 'Evolução, Banco e uso eficiente de Treinadores — tudo o que a Academia ensinou.' },
  { nodeId: 'F00-D02', name: 'Blue — Revanche', preset: 'preset-npc-final', energy: ['FIRE', 'WATER'],
    cards: deck(['Charmander', 2], ['Charmeleon', 2], ['Charizard ex', 1], ['Squirtle', 2], ['Wartortle', 2], ['Blastoise ex', 1], ['Vulpix', 2], ['Ninetales', 1], [BLA, 1], [MIS, 2], [PROF, 2], [PB, 2]),
    expert: [[A('Vulpix'), A('Charizard ex')], [BLA, A('Blastoise ex')]],
    note: 'Dois arquétipos de Energia compatíveis, risco de pontos e alternativas.' },
  { nodeId: 'F00-D03', name: 'Giovanni — Chefe da Equipe Rocket', preset: 'preset-npc-final', energy: ['FIRE', 'GRASS'],
    cards: deck(['Charmander', 2], ['Charmeleon', 2], ['Charizard ex', 2], ['Moltres ex', 1], ['Caterpie', 2], ['Metapod', 2], ['Butterfree', 2], [BLA, 2], [PROF, 2], [PB, 2], [POT, 1]),
    expert: [[POT, A('Moltres ex')], [PB, GIO]],
    note: 'Butterfree cura o campo inteiro enquanto o Charizard ex prepara o golpe de dois pontos.' },
];

/** Deck único de Cheren (npcId lia) no duelo guiado P00-T06 (idêntico ao lado NPC da fixture fx-p00-t06). */
export const T06_NPC_CARDS: readonly CardCount[] = deck(
  ['Charmander', 2], ['Charmeleon', 1], ['Ponyta', 2], ['Rapidash', 1], ['Growlithe', 2], ['Pidgey', 2], [POT, 2], [PB, 2], [PROF, 2], [XS, 2], [HS, 2],
);
export const T06_NPC_DECK_ID = 'npc-p00-t06-v1';

export const npcDeckId = (nodeId: string, difficulty: Difficulty): string => `npc-${nodeId.toLowerCase()}-${difficulty.toLowerCase()}-v1`;

const DIFFICULTY_LABEL: Record<Difficulty, string> = { STORY: 'História', STANDARD: 'Padrão', EXPERT: 'Especialista' };

export const NPC_DECKS: readonly ContentDeck[] = [
  { deckId: T06_NPC_DECK_ID, version: 1, name: 'Cheren — Chama da Escola', kind: 'NPC', energyTypes: ['FIRE'], entries: toEntries(T06_NPC_CARDS),
    cosmeticPresetId: 'preset-npc-academy', strategyNote: 'Duelo guiado: Fogo previsível para praticar Recuo, troca por efeito e três pontos.' },
  ...NPC_DECK_SPECS.flatMap((spec) => {
    if (total(spec.cards) !== 20) throw new Error(`deck ${spec.nodeId} com ${total(spec.cards)} cartas`);
    const variants: Record<Difficulty, readonly CardCount[]> = {
      STORY: deriveStory(spec.cards), STANDARD: spec.cards, EXPERT: deriveExpert(spec.cards, spec.expert),
    };
    return (['STORY', 'STANDARD', 'EXPERT'] as const).map((difficulty): ContentDeck => ({
      deckId: npcDeckId(spec.nodeId, difficulty), version: 1, name: `${spec.name} (${DIFFICULTY_LABEL[difficulty]})`.slice(0, 60), kind: 'NPC',
      energyTypes: [...spec.energy], entries: toEntries(variants[difficulty]), cosmeticPresetId: spec.preset,
      strategyNote: difficulty === 'STORY' ? `${spec.note} Lista História: menos peças de sinergia.`.slice(0, 300)
        : difficulty === 'EXPERT' ? `${spec.note} Lista Especialista: mais consistente.`.slice(0, 300) : spec.note,
    }));
  }),
];

