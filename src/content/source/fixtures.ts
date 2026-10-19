// Fixtures dos tutoriais (P00-T01…T06) e puzzles (C0x-E02), conteúdo 2.0.0 com cartas do Genetic Apex. HUMANO = A, NPC = B.
// T01–T05: lições curtas com roteiro do NPC e solução do humano, terminando em vitória real pelo motor.
// T06: duelo guiado completo — abertura fixa (mãos e ordem dos baralhos), NPC controlado pela IA de Cheren.
// Puzzles: cenário preparado, sem moedas, com solução verificada pelo content-build e pelos testes.
// Escolhas com uma única opção (promover o único Pokémon do Banco, alvo único) se resolvem sozinhas.
import type { CardDefinition, EnergyType } from '../../domain/cards/types.ts';
import type { FixturePokemon, FixtureSide } from '../../domain/battle/setup.ts';
import { a1 } from './a1/cards.ts';
import { lupaDeMao, pesquisaDoProfessor, pocao, pokeBola, velocidadeX, cartaoVermelho } from './promo-a.ts';
import { P } from './sets.ts';
import { hand, type ContentFixture, type GuidanceStep, type NpcScriptStep, type ScriptCommand, type ScriptStep } from './script.ts';

type SideSpec = {
  readonly energy: EnergyType;
  readonly ready?: EnergyType | null;
  readonly active?: FixturePokemon | null;
  readonly bench?: readonly FixturePokemon[];
  readonly hand?: readonly CardDefinition[];
  readonly deck?: readonly CardDefinition[];
  readonly points?: number;
  readonly usage?: FixtureSide['usage'];
};

const mon = (name: string, extra: Omit<FixturePokemon, 'stack'> = {}, ...evolutions: string[]): FixturePokemon =>
  ({ stack: [P(a1(name)), ...evolutions.map((n) => P(a1(n)))], ...extra });
const cards = (...names: readonly (string | CardDefinition)[]): CardDefinition[] => names.map((n) => (typeof n === 'string' ? a1(n) : n));
const card = (name: string) => P(a1(name));

function side(spec: SideSpec): FixtureSide {
  return {
    deck: (spec.deck ?? []).map(P), hand: (spec.hand ?? []).map(P), discard: [],
    active: spec.active ?? null, bench: spec.bench ?? [],
    energyZone: { types: [spec.energy], ready: spec.ready ?? null, next: spec.energy },
    points: spec.points ?? 0,
    ...(spec.usage ? { usage: spec.usage } : {}),
  };
}

const H = (command: ScriptCommand, note?: string): ScriptStep => ({ actor: 'HUMAN', command: { ...command, ...(note ? { note } : {}) } });
const N = (command: ScriptCommand): NpcScriptStep => ({ command });
const g = (step: number, text: string, highlight: string | null = null): GuidanceStep => ({ step, text, highlight });

const ATTACK = (attackId: string): ScriptCommand => ({ type: 'ATTACK', attackId });
const ATTACH = (target: 'ACTIVE' | 'BENCH:0' | 'BENCH:1' | 'BENCH:2' = 'ACTIVE'): ScriptCommand => ({ type: 'ATTACH_ENERGY', target });
const POT = pocao, PB = pokeBola, PROF = pesquisaDoProfessor, XS = velocidadeX, HS = lupaDeMao, RC = cartaoVermelho;

// ---------------------------------------------------------------- tutoriais

const t01: ContentFixture = {
  fixtureId: 'fx-p00-t01', kind: 'TUTORIAL', label: 'Primeira Carta — cenário preparado: a mão inicial foi definida para esta lição.',
  startPhase: 'SETUP', firstPlayer: 'NPC', currentPlayer: 'NPC', globalTurnNumber: 1, ownTurns: { HUMAN: 0, NPC: 0 }, stadiumPrintingId: null,
  players: {
    HUMAN: side({ energy: 'FIRE', hand: cards('Charmander', 'Ponyta'), deck: [POT, PROF, XS, PB] }),
    NPC: side({ energy: 'GRASS', hand: cards('Oddish') }),
  },
  solution: [
    H({ type: 'RESOLVE_DECISION', select: [hand(card('Charmander'))] }, 'Escolha Charmander como Pokémon Ativo.'),
    H(ATTACH(), 'Ligue a Energia de Fogo pronta ao Ativo.'),
    H(ATTACK('ember'), 'Brasa causa 30 + 20 de Fraqueza: Planta é fraca a Fogo. A Energia usada é descartada.'),
    H(ATTACH(), 'Ligue outra Energia: Brasa descartou a anterior.'),
    H(ATTACK('ember'), 'Segundo ataque: Oddish é Nocauteado e Cheren fica sem Pokémon em campo.'),
  ],
  npcScript: [
    N({ type: 'RESOLVE_DECISION', select: [hand(card('Oddish'))] }),
    N({ type: 'END_TURN' }),
    N(ATTACH()),
    N(ATTACK('ram')),
  ],
  guidance: [
    g(1, 'Toque em um Pokémon Básico da sua mão para colocá-lo como Ativo. O Banco é opcional.', 'hand'),
    g(2, 'Cheren começa. No primeiro turno do primeiro jogador não há Energia da Zona.', 'energy-zone'),
    g(3, 'Sua vez: ligue a Energia pronta ao Ativo e ataque.', 'active'),
    g(4, 'Vença deixando o oponente sem Pokémon em campo ou somando 3 pontos.', null),
  ],
};

const t02: ContentFixture = {
  fixtureId: 'fx-p00-t02', kind: 'TUTORIAL', label: 'Acender a Energia — cenário preparado: campo e mão definidos para esta lição.',
  startPhase: 'MAIN', firstPlayer: 'NPC', currentPlayer: 'HUMAN', globalTurnNumber: 2, ownTurns: { HUMAN: 1, NPC: 1 }, stadiumPrintingId: null,
  players: {
    HUMAN: side({ energy: 'FIRE', ready: 'FIRE', active: mon('Ponyta'), deck: [PROF, POT] }),
    NPC: side({ energy: 'GRASS', active: mon('Bulbasaur', { damage: 30 }) }),
  },
  solution: [
    H(ATTACH(), 'Ligação manual: uma Energia da Zona por turno.'),
    H(ATTACK('flare'), 'O custo é pago com a Energia ligada, que não é descartada.'),
  ],
  guidance: [
    g(1, 'A Zona de Energia mostra a Energia pronta (Fogo) e a próxima.', 'energy-zone'),
    g(2, 'Arraste a Energia pronta até Ponyta: isso é a ligação manual do turno.', 'active'),
    g(3, 'Labareda custa 1 Fogo. Com o custo pago, ataque!', 'attack'),
  ],
};

const t03: ContentFixture = {
  fixtureId: 'fx-p00-t03', kind: 'TUTORIAL', label: 'Preparar a Reserva — cenário preparado: seu Ativo está quase sem PS.',
  startPhase: 'MAIN', firstPlayer: 'NPC', currentPlayer: 'HUMAN', globalTurnNumber: 4, ownTurns: { HUMAN: 2, NPC: 2 }, stadiumPrintingId: null,
  players: {
    HUMAN: side({ energy: 'WATER', ready: 'WATER', active: mon('Squirtle', { damage: 40, energies: ['WATER'] }), hand: cards('Staryu'), deck: [POT, PROF, PB] }),
    NPC: side({ energy: 'FIRE', active: mon('Charmander', { damage: 10, energies: ['FIRE'] }) }),
  },
  solution: [
    H({ type: 'PLAY_BASIC', card: hand(card('Staryu')), benchIndex: 0 }, 'Coloque Staryu no Banco: é a sua reserva.'),
    H(ATTACH('BENCH:0'), 'Distribua a Energia antes: Staryu já estará pronto no próximo turno.'),
    H(ATTACK('water-gun'), 'Squirtle ainda ataca com Fraqueza; Charmander é fraco a Água.'),
    H(ATTACK('smack'), 'Staryu foi promovido com a Energia já ligada e finaliza.'),
  ],
  npcScript: [N(ATTACK('ember'))],
  guidance: [
    g(1, 'Squirtle vai ser Nocauteado no próximo turno. Sem reserva no Banco, você perderia.', 'active'),
    g(2, 'Coloque um Básico no Banco e ligue a Energia nele.', 'bench'),
    g(3, 'Quando o Ativo cai, o Banco promove a reserva — com as Energias que você deixou.', 'bench'),
  ],
};

const t04: ContentFixture = {
  fixtureId: 'fx-p00-t04', kind: 'TUTORIAL', label: 'A Próxima Forma — cenário preparado: Ponyta está em campo desde o turno anterior.',
  startPhase: 'MAIN', firstPlayer: 'HUMAN', currentPlayer: 'HUMAN', globalTurnNumber: 3, ownTurns: { HUMAN: 2, NPC: 1 }, stadiumPrintingId: null,
  players: {
    HUMAN: side({ energy: 'FIRE', ready: 'FIRE', active: mon('Ponyta', { damage: 20, energies: ['FIRE'], enteredPlayOnTurn: 1 }), hand: cards('Rapidash'), deck: [POT, PROF] }),
    NPC: side({ energy: 'GRASS', active: mon('Bulbasaur', { damage: 10 }) }),
  },
  solution: [
    H({ type: 'EVOLVE', card: hand(card('Rapidash')), target: 'ACTIVE' }, 'Evolua: o dano de Ponyta continua em Rapidash, mas os PS máximos sobem.'),
    H(ATTACH(), 'Ligue a Energia do turno.'),
    H(ATTACK('fire-mane'), 'Juba de Fogo: 40 + 20 de Fraqueza Nocauteiam Bulbasaur.'),
  ],
  guidance: [
    g(1, 'Não se evolui no primeiro turno próprio nem no turno em que o Pokémon entrou em campo.', null),
    g(2, 'Coloque Rapidash sobre Ponyta. O dano acumulado é preservado.', 'active'),
    g(3, 'Com 100 PS máximos, Rapidash aguenta mais e ataca mais forte.', 'attack'),
  ],
};

const t05: ContentFixture = {
  fixtureId: 'fx-p00-t05', kind: 'TUTORIAL', label: 'Apoio no Momento Certo — cenário preparado: você já ligou a Energia deste turno.',
  startPhase: 'MAIN', firstPlayer: 'NPC', currentPlayer: 'HUMAN', globalTurnNumber: 4, ownTurns: { HUMAN: 2, NPC: 2 }, stadiumPrintingId: null,
  players: {
    HUMAN: side({ energy: 'GRASS', active: mon('Exeggcute'), bench: [mon('Bulbasaur', { energies: ['GRASS', 'GRASS'] })],
      hand: [XS, a1('Giovanni'), PROF], deck: [POT, PB, HS], usage: { manualEnergyUsed: true } }),
    NPC: side({ energy: 'WATER', active: mon('Squirtle', { damage: 10 }) }),
  },
  solution: [
    H({ type: 'PLAY_TRAINER', card: hand(P(XS)) }, 'Item: Velocidade X zera o Recuo de Exeggcute neste turno.'),
    H({ type: 'RETREAT', benchIndex: 0, energyTypes: [] }, 'Recue sem pagar Energia e traga Bulbasaur, que já tem o ataque pago.'),
    H({ type: 'PLAY_TRAINER', card: hand(card('Giovanni')) }, 'Apoiador: só um por turno. Giovanni soma +10 ao dano no Ativo do oponente.'),
    H(ATTACK('vine-whip'), 'Chicote de Vinha: 40 + 10 = 50, exatamente os PS restantes de Squirtle.'),
  ],
  guidance: [
    g(1, 'Itens não têm limite por turno; Apoiadores, só um por turno.', 'hand'),
    g(2, 'Exeggcute não tem Energia para recuar. Velocidade X reduz o Recuo em 1.', 'retreat'),
    g(3, 'Pesquisa do Professor compraria cartas, mas o golpe certo precisa de Giovanni.', 'hand'),
  ],
};

// T06: Maré Serena (humano) contra a Chama da Escola de Cheren; abertura e ordem dos baralhos fixas.
const t06HumanHand = cards('Squirtle', 'Staryu', 'Wartortle', XS, PROF);
const t06HumanDeck = cards(POT, 'Starmie', 'Squirtle', PB, RC, 'Wartortle', 'Staryu', HS, PROF, XS, 'Starmie', POT, PB, RC, HS);
const t06NpcHand = cards('Ponyta', 'Pidgey', POT, HS, PROF);
const t06NpcDeck = cards('Charmander', 'Growlithe', PB, 'Charmeleon', XS, 'Ponyta', 'Charmander', POT, 'Rapidash', 'Pidgey', 'Growlithe', PROF, PB, XS, HS);

const t06: ContentFixture = {
  fixtureId: 'fx-p00-t06', kind: 'TUTORIAL', label: 'Mudar o Plano — duelo guiado completo com abertura preparada; Cheren joga pela IA.',
  startPhase: 'SETUP', firstPlayer: 'HUMAN', currentPlayer: 'HUMAN', globalTurnNumber: 1, ownTurns: { HUMAN: 0, NPC: 0 }, stadiumPrintingId: null,
  players: {
    HUMAN: side({ energy: 'WATER', hand: t06HumanHand, deck: t06HumanDeck }),
    NPC: side({ energy: 'FIRE', hand: t06NpcHand, deck: t06NpcDeck }),
  },
  guidance: [
    g(1, 'Você usa a Maré Serena. Escolha um Ativo e, se quiser, Básicos para o Banco.', 'hand'),
    g(2, 'Recuar custa Energia igual ao Recuo do Ativo e só pode ser feito uma vez por turno.', 'retreat'),
    g(3, 'Starmie recua de graça; Velocidade X reduz o Recuo de qualquer Ativo neste turno.', 'hand'),
    g(4, 'Vence quem somar 3 pontos. Pokémon comuns valem 1 ponto ao serem Nocauteados.', null),
    g(5, 'Objetivo da lição: vencer depois de executar ao menos um Recuo normal.', 'retreat'),
  ],
};

// ---------------------------------------------------------------- puzzles

const c01e02: ContentFixture = {
  fixtureId: 'fx-c01-e02', kind: 'PUZZLE', label: 'Um Lugar no Banco — puzzle preparado: vença em até 2 turnos próprios, sem moedas.',
  startPhase: 'MAIN', firstPlayer: 'NPC', currentPlayer: 'HUMAN', globalTurnNumber: 2, ownTurns: { HUMAN: 1, NPC: 1 }, stadiumPrintingId: null,
  players: {
    HUMAN: side({ energy: 'GRASS', ready: 'GRASS', points: 2, active: mon('Bulbasaur', { damage: 50, energies: ['GRASS', 'GRASS'] }), hand: cards('Oddish', 'Petilil'), deck: cards('Gloom', 'Lilligant') }),
    NPC: side({ energy: 'FIRE', points: 1, active: mon('Ponyta', { damage: 20, energies: ['FIRE', 'FIRE'] }, 'Rapidash') }),
  },
  solution: [
    H({ type: 'PLAY_BASIC', card: hand(card('Oddish')), benchIndex: 0 }, 'Oddish vai para o Banco: é a reserva que vai evoluir.'),
    H(ATTACH('BENCH:0'), 'A Energia do turno vai para a reserva, não para o Ativo condenado.'),
    H(ATTACK('vine-whip'), 'Bulbasaur ainda causa 40 antes de cair.'),
    H({ type: 'EVOLVE', card: hand(card('Gloom')), target: 'ACTIVE' }, 'Gloom comprado no turno: evolua a reserva promovida.'),
    H(ATTACH(), 'Segunda Energia: Babar fica pago.'),
    H(ATTACK('drool'), '40 de dano fecham os 100 PS de Rapidash: terceiro ponto.'),
  ],
  npcScript: [N(ATTACK('fire-mane'))],
  guidance: [
    g(1, 'Conceito: prepare a reserva antes de perder o Ativo.', 'bench'),
    g(2, 'Próxima decisão: qual Básico vai para o Banco e quem recebe a Energia deste turno?', 'bench'),
    g(3, 'Solução: Oddish no Banco com Energia; ataque com Bulbasaur; no turno seguinte evolua para Gloom e use Babar.', null),
  ],
};

const c02e02: ContentFixture = {
  fixtureId: 'fx-c02-e02', kind: 'PUZZLE', label: 'Passagem Livre — puzzle preparado: vença neste turno usando um efeito de troca.',
  startPhase: 'MAIN', firstPlayer: 'NPC', currentPlayer: 'HUMAN', globalTurnNumber: 6, ownTurns: { HUMAN: 3, NPC: 3 }, stadiumPrintingId: null,
  players: {
    HUMAN: side({ energy: 'WATER', ready: 'WATER', points: 2, active: mon('Squirtle', { energies: ['WATER', 'WATER'] }, 'Wartortle'), bench: [mon('Staryu')],
      hand: [a1('Sabrina'), POT], deck: [PROF] }),
    NPC: side({ energy: 'FIRE', points: 2, active: mon('Onix', { energies: ['FIGHTING'] }), bench: [mon('Charmander', { damage: 30 })] }),
  },
  solution: [
    H({ type: 'PLAY_TRAINER', card: hand(card('Sabrina')) }, 'Sabrina manda o Ativo do oponente para o Banco; só sobra o Charmander para entrar.'),
    H(ATTACK('wave-splash'), 'Respingo de Onda: 40 + 20 de Fraqueza Nocauteiam Charmander: terceiro ponto.'),
  ],
  guidance: [
    g(1, 'Conceito: Onix tem PS demais para cair neste turno; troque o alvo em vez de insistir.', 'active'),
    g(2, 'Próxima decisão: quem o oponente seria obrigado a promover?', 'bench'),
    g(3, 'Solução: Sabrina e Respingo de Onda no Charmander ferido.', null),
  ],
};

const c03e02: ContentFixture = {
  fixtureId: 'fx-c03-e02', kind: 'PUZZLE', label: 'Energia Bem Contada — puzzle preparado: conte o Recuo antes de ligar a Energia.',
  startPhase: 'MAIN', firstPlayer: 'NPC', currentPlayer: 'HUMAN', globalTurnNumber: 6, ownTurns: { HUMAN: 3, NPC: 3 }, stadiumPrintingId: null,
  players: {
    HUMAN: side({ energy: 'LIGHTNING', ready: 'LIGHTNING', points: 2, active: mon('Tynamo', { energies: ['LIGHTNING'] }, 'Eelektrik'), bench: [mon('Voltorb', { energies: ['LIGHTNING'] }, 'Electrode')],
      hand: [XS, POT], deck: [PROF] }),
    NPC: side({ energy: 'WATER', points: 1, active: mon('Squirtle', { energies: ['WATER'] }, 'Wartortle') }),
  },
  solution: [
    H({ type: 'PLAY_TRAINER', card: hand(P(XS)) }, 'Velocidade X: o Recuo de Eelektrik cai de 2 para 1.'),
    H({ type: 'RETREAT', benchIndex: 0, energyTypes: ['LIGHTNING'] }, 'Recue pagando a única Energia de Eelektrik.'),
    H(ATTACH(), 'A Energia do turno completa o custo de Electrode.'),
    H(ATTACK('electro-ball'), 'Eletrobola: 70 + 20 de Fraqueza Nocauteiam Wartortle: terceiro ponto.'),
  ],
  guidance: [
    g(1, 'Conceito: Recuo e ataque disputam a mesma Energia do turno; conte os dois antes de ligar.', 'energy-zone'),
    g(2, 'Próxima decisão: ligar a Energia em Eelektrik paga o Recuo, mas deixa Electrode sem ataque. O que mais reduz o custo?', 'hand'),
    g(3, 'Solução: Velocidade X, recue para Electrode, ligue Elétrico nele e use Eletrobola.', null),
  ],
};

const c04e02: ContentFixture = {
  fixtureId: 'fx-c04-e02', kind: 'PUZZLE', label: 'Depois da Meia-Volta — puzzle preparado: seu Ativo está Adormecido; vença neste turno.',
  startPhase: 'MAIN', firstPlayer: 'HUMAN', currentPlayer: 'HUMAN', globalTurnNumber: 7, ownTurns: { HUMAN: 4, NPC: 3 }, stadiumPrintingId: null,
  players: {
    HUMAN: side({ energy: 'PSYCHIC', ready: 'PSYCHIC', points: 2,
      active: mon('Gastly', { damage: 40, energies: ['PSYCHIC'], conditions: ['ASLEEP'], enteredPlayOnTurn: 3 }, 'Haunter'), hand: cards('Gengar', POT), deck: [PROF] }),
    NPC: side({ energy: 'WATER', points: 1, active: mon('Snom', { damage: 40, energies: ['WATER', 'WATER'] }, 'Frosmoth') }),
  },
  solution: [
    H({ type: 'EVOLVE', card: hand(card('Gengar')), target: 'ACTIVE' }, 'Evoluir remove todas as condições especiais: Gengar acorda.'),
    H(ATTACH(), 'Ligue a Energia Psíquica do turno.'),
    H(ATTACK('bother'), 'Importunar causa 50 e fecha os 90 PS de Frosmoth: terceiro ponto.'),
  ],
  guidance: [
    g(1, 'Conceito: Adormecido não ataca nem recua; evoluir ou trocar o Ativo limpa a condição.', 'active'),
    g(2, 'Próxima decisão: Poção não acorda ninguém. O que muda o Pokémon Ativo sem recuar?', 'hand'),
    g(3, 'Solução: evolua Haunter para Gengar, ligue a Energia e use Importunar.', null),
  ],
};

const c05e02: ContentFixture = {
  fixtureId: 'fx-c05-e02', kind: 'PUZZLE', label: 'O Peso da Moldura — puzzle preparado: Nocauteie sem declarar ataque.',
  startPhase: 'MAIN', firstPlayer: 'NPC', currentPlayer: 'HUMAN', globalTurnNumber: 6, ownTurns: { HUMAN: 3, NPC: 3 }, stadiumPrintingId: null,
  players: {
    HUMAN: side({ energy: 'FIGHTING', ready: 'FIGHTING', points: 2, active: mon('Mankey', { energies: ['FIGHTING'] }),
      bench: [mon('Froakie', { enteredPlayOnTurn: 1 }, 'Frogadier', 'Greninja')], hand: [a1('Giovanni')], deck: [PROF] }),
    NPC: side({ energy: 'METAL', points: 1, active: mon('Meltan', { damage: 110, energies: ['METAL', 'METAL'] }, 'Melmetal') }),
  },
  solution: [
    H({ type: 'USE_ABILITY', source: 'BENCH:0', abilityId: 'water-shuriken' }, 'Shuriken d\'Água não é ataque: o Revestimento Rígido não reduz e o dano de 20 Nocauteia.'),
  ],
  guidance: [
    g(1, 'Conceito: Revestimento Rígido reduz 20 só do dano de ataques. Chute Baixo com Giovanni ainda faz 10.', 'active'),
    g(2, 'Próxima decisão: que dano não vem de um ataque? Inspecione o seu Banco.', 'bench'),
    g(3, 'Solução: use a Habilidade de Greninja no Melmetal — sem atacar.', null),
  ],
};

const c06e02: ContentFixture = {
  fixtureId: 'fx-c06-e02', kind: 'PUZZLE', label: 'Conta de Risco — puzzle preparado: some 3 pontos neste turno escolhendo o alvo certo.',
  startPhase: 'MAIN', firstPlayer: 'NPC', currentPlayer: 'HUMAN', globalTurnNumber: 8, ownTurns: { HUMAN: 4, NPC: 4 }, stadiumPrintingId: null,
  players: {
    HUMAN: side({ energy: 'GRASS', ready: 'GRASS', points: 1, active: mon('Bellsprout', { energies: ['GRASS', 'GRASS'] }, 'Weepinbell', 'Victreebel'), bench: [mon('Oddish')],
      hand: [a1('Giovanni'), PROF], deck: [POT] }),
    NPC: side({ energy: 'WATER', points: 1, active: mon('Snorlax'),
      bench: [mon('Articuno ex', { damage: 80, energies: ['WATER'] }), mon('Pidgey', { damage: 30 })] }),
  },
  solution: [
    H({ type: 'USE_ABILITY', source: 'ACTIVE', abilityId: 'fragrance-trap' }, 'Armadilha Aromática: você escolhe qual Básico do Banco do oponente vem para o Ativo.'),
    H({ type: 'RESOLVE_DECISION', select: ['OPP_BENCH:0'] }, 'Articuno ex vale 2 pontos e tem só 60 PS restantes.'),
    H(ATTACK('vine-whip'), 'Chicote de Vinha causa 60: Nocaute de 2 pontos, total 3.'),
  ],
  guidance: [
    g(1, 'Conceito: conte pontos antes de maximizar dano. Um ex vale 2.', null),
    g(2, 'Próxima decisão: Giovanni no Pidgey dá só 1 ponto. Quem vale mais?', 'hand'),
    g(3, 'Solução: Armadilha Aromática no Articuno ex e Chicote de Vinha.', null),
  ],
};

export const TUTORIAL_FIXTURES: readonly ContentFixture[] = [t01, t02, t03, t04, t05, t06];
export const PUZZLE_FIXTURES: readonly ContentFixture[] = [c01e02, c02e02, c03e02, c04e02, c05e02, c06e02];
export const ALL_FIXTURES: readonly ContentFixture[] = [...TUTORIAL_FIXTURES, ...PUZZLE_FIXTURES];

/** O lado NPC de T06 deve ser exatamente o deck de Cheren do duelo guiado. */
export const T06_NPC_SIDE_CARDS: readonly CardDefinition[] = [...t06NpcHand, ...t06NpcDeck];
