// Campanha (id circuito-dos-arquivos-v1, estrutura do conteúdo 2.0.0; desde o 3.1.0 uma jornada de Ginásios com rivais da franquia): capítulos ligados aos três pacotes reais, 45 nós (grafo canônico
// §2.2), objetivos (§12) e tabelas de prêmio (§15.1). Cartas citadas por nome via a1() (src/content/source/a1/cards.ts).
import type { CampaignNode, Chapter, ChapterId, DeckComposition, Difficulty, NodeKind, Objective, Predicate, RewardTable } from '../types.ts';
import { P } from './sets.ts';
import { a1 } from './a1/cards.ts';
import { npcDeckId, supportDecksFor, T06_NPC_DECK_ID } from './decks.ts';
import { aiProfileId } from './npcs.ts';
import { NODE_TEXTS } from './dialogues.ts';

export const CAMPAIGN_ID = 'circuito-dos-arquivos-v1';
export const CONTENT_VERSION = '3.5.0';
export const OBJECTIVE_REWARD = 40;

type ChapterMeta = {
  readonly chapterId: ChapterId; readonly title: string; readonly theme: string; readonly specialist: string; readonly mapSceneId: string;
  readonly arenaId: string; readonly playmatId: string; readonly setId: string | null; readonly packProductId: string | null; readonly medalId: string | null;
};

const CHAPTER_META: readonly ChapterMeta[] = [
  { chapterId: 'P00', title: 'Prólogo — Escola de Treinadores', theme: 'Ativo, Energia, Banco, evolução, Treinadores e Recuo.', specialist: 'lia', mapSceneId: 'campaign-academy', arenaId: 'arena-academy', playmatId: 'mat-academy', setId: 'a1', packProductId: 'pack-a1-pikachu', medalId: null },
  { chapterId: 'C01', title: 'Ginásio de Celadon', theme: 'Banco, evolução e preparação de Energia.', specialist: 'iris', mapSceneId: 'campaign-forest', arenaId: 'arena-grove', playmatId: 'mat-c01-grove', setId: 'a1', packProductId: 'pack-a1-charizard', medalId: 'medal-c01' },
  { chapterId: 'C02', title: 'Ginásio de Sootopolis', theme: 'Recuo, troca e recursos.', specialist: 'mara', mapSceneId: 'campaign-harbor', arenaId: 'arena-harbor', playmatId: 'mat-c02-harbor', setId: 'a1', packProductId: 'pack-a1-pikachu', medalId: 'medal-c02' },
  { chapterId: 'C03', title: 'Ginásio de Vermilion', theme: 'Custo, Energia extra e gatilhos.', specialist: 'teo', mapSceneId: 'campaign-powerplant', arenaId: 'arena-circuits', playmatId: 'mat-c03-circuits', setId: 'a1', packProductId: 'pack-a1-pikachu', medalId: 'medal-c03' },
  { chapterId: 'C04', title: 'Ginásio de Saffron', theme: 'Condições especiais e temporização.', specialist: 'nara', mapSceneId: 'campaign-observatory', arenaId: 'arena-observatory', playmatId: 'mat-c04-observatory', setId: 'a1', packProductId: 'pack-a1-mewtwo', medalId: 'medal-c04' },
  { chapterId: 'C05', title: 'Ginásio de Stow-on-Side', theme: 'Apoiadores, modificadores de dano e golpes pesados.', specialist: 'breno', mapSceneId: 'campaign-foundry', arenaId: 'arena-foundry', playmatId: 'mat-c05-foundry', setId: 'a1', packProductId: 'pack-a1-charizard', medalId: 'medal-c05' },
  { chapterId: 'C06', title: 'Ginásio de Viridian', theme: 'Risco de pontos, múltiplos alvos e plano completo.', specialist: 'sol', mapSceneId: 'campaign-archive', arenaId: 'arena-archive', playmatId: 'mat-c06-archive', setId: 'a1', packProductId: 'pack-a1-mewtwo', medalId: 'medal-c06' },
  { chapterId: 'F00', title: 'Final — Torneio de Kanto', theme: 'Três duelos independentes e progressivos.', specialist: 'aurora', mapSceneId: 'campaign-finale', arenaId: 'arena-final', playmatId: 'mat-circuit-complete', setId: 'a1', packProductId: 'pack-a1-mewtwo', medalId: 'trophy-circuito-completo' },
];

export const CHAPTERS: readonly Chapter[] = CHAPTER_META.map((m) => ({
  chapterId: m.chapterId, title: m.title, theme: m.theme, specialistNpcId: m.specialist, mapSceneId: m.mapSceneId, arenaId: m.arenaId,
  playmatId: m.playmatId, setId: m.setId, packProductId: m.packProductId, medalId: m.medalId,
  journal: { intro: `dlg-journal-${m.chapterId.toLowerCase()}-intro`, outro: `dlg-journal-${m.chapterId.toLowerCase()}-outro` },
}));

const metaOf = (chapterId: ChapterId): ChapterMeta => CHAPTER_META.find((m) => m.chapterId === chapterId)!;

// ---------------------------------------------------------------- objetivos

const p = (type: Predicate['type'], extra: Omit<Predicate, 'type'> = {}): Predicate => ({ type, ...extra });
const NO_EX: DeckComposition = { maxRuleBoxCopies: { EX: 0, MEGA_EX: 0 } };

/** Restrição de composição por região (campanha §12.1, revisão 3.2.0). */
export const REGION_COMPOSITION: Readonly<Record<string, { readonly composition: DeckComposition; readonly description: string }>> = {
  C01: { composition: { minDistinctEvolutionLines: 3, minTypeCards: { types: ['GRASS'], count: 6 } },
    description: 'Vencer com 3 linhas evolutivas distintas e pelo menos 6 Pokémon de Planta no deck.' },
  C02: { composition: { exactEnergyTypeCount: 2, minTypeCards: { types: ['WATER'], count: 4 } },
    description: 'Vencer com a Zona configurada com exatamente 2 tipos de Energia e pelo menos 4 Pokémon de Água no deck.' },
  C03: { composition: { minCardsWithOpcode: { opcodes: ['ATTACH_ENERGY', 'MOVE_ENERGY'], count: 2 }, minTypeCards: { types: ['LIGHTNING'], count: 4 } },
    description: 'Vencer com 2 cartas que liguem ou movam Energia e pelo menos 4 Pokémon Elétricos no deck.' },
  C04: { composition: { minCardsWithOpcode: { opcodes: ['APPLY_CONDITION', 'REMOVE_CONDITION'], count: 2 }, minTypeCards: { types: ['PSYCHIC', 'DARKNESS'], count: 4 } },
    description: 'Vencer com 2 cartas que apliquem ou removam condições e pelo menos 4 Pokémon Psíquicos ou Noturnos no deck.' },
  C05: { composition: { minCardsWithOpcode: { opcodes: ['MODIFY:DAMAGE_DEALT', 'MODIFY:DAMAGE_TAKEN'], count: 2 } },
    description: 'Vencer com pelo menos 2 cartas que modificam dano (como Giovanni, Blaine ou Melmetal) no deck.' },
  C06: { composition: { minRuleBoxCopies: { EX: 2 } },
    description: 'Vencer com pelo menos 2 cartas ex no deck.' },
  F00: { composition: { minDistinctEvolutionLines: 4, minRuleBoxCopies: { EX: 1 } },
    description: 'Vencer com pelo menos 4 linhas evolutivas distintas e 1 Pokémon ex no deck.' },
};

type Tactic = { readonly predicates: readonly Predicate[]; readonly description: string };

/** Objetivo tático de cada duelo, conforme as tabelas de encontro (campanha §5–§11). */
const TACTICS: Readonly<Record<string, Tactic>> = {
  'C01-E01': { predicates: [p('PLACED_ON_BENCH_AT_LEAST', { count: 3, controller: 'HUMAN' })], description: 'Vencer após colocar três Pokémon no Banco ao longo da partida.' },
  'C01-E03': { predicates: [p('EVOLVED_AT_LEAST', { count: 1, controller: 'HUMAN' })], description: 'Vencer após realizar uma evolução.' },
  'C01-E05': { predicates: [p('DECK_COMPOSITION', { composition: { minBasic: 2 } })], description: 'Vencer com ao menos dois Pokémon Básicos diferentes no deck.' },
  'C01-E06': { predicates: [p('DISTINCT_ATTACKERS_AT_LEAST', { count: 2, controller: 'HUMAN' })], description: 'Vencer após atacar com duas entidades distintas.' },
  'C02-E01': { predicates: [p('RETREATED_AT_LEAST', { count: 1, controller: 'HUMAN' })], description: 'Vencer após um Recuo normal.' },
  'C02-E03': { predicates: [p('SWITCH_EFFECT_USED', { count: 1, controller: 'HUMAN' })], description: 'Vencer usando um efeito de troca.' },
  'C02-E05': { predicates: [p('DECK_COMPOSITION', { composition: NO_EX })], description: 'Vencer sem Pokémon ex no deck.' },
  'C02-E06': { predicates: [p('DISTINCT_ATTACK_DAMAGE_SOURCES_AT_LEAST', { count: 2, controller: 'HUMAN', minimumDamage: 1 })], description: 'Vencer após causar dano com dois atacantes diferentes.' },
  'C03-E01': { predicates: [p('ENERGY_ON_ONE_POKEMON_AT_LEAST', { count: 2, controller: 'HUMAN' })], description: 'Vencer com duas Energias ligadas a um mesmo Pokémon.' },
  'C03-E03': { predicates: [p('ACTIVATED_ABILITY_USED', { count: 1, controller: 'HUMAN' })], description: 'Vencer após usar uma Habilidade ativada.' },
  'C03-E05': { predicates: [p('OWN_TURNS_AT_MOST', { count: 12, controller: 'HUMAN' })], description: 'Vencer sem ultrapassar 12 turnos próprios.' },
  'C03-E06': { predicates: [p('KNOCKED_OUT_ROLE', { role: 'apoio', controller: 'HUMAN' })], description: 'Vencer após Nocautear o Pokémon de apoio (Magneton).' },
  'C04-E01': { predicates: [p('CONDITION_REMOVED_BY_CAUSE', { causes: ['SWITCH', 'RETREAT', 'EVOLUTION'], controller: 'HUMAN' })], description: 'Vencer após remover uma condição por troca ou evolução.' },
  'C04-E03': { predicates: [p('EVOLVED_POKEMON_WITH_CONDITION', { count: 1, controller: 'HUMAN' })], description: 'Vencer após evoluir um Pokémon que tinha condição especial.' },
  'C04-E05': { predicates: [p('DECK_COMPOSITION', { composition: NO_EX })], description: 'Vencer sem Pokémon ex no deck.' },
  'C04-E06': { predicates: [p('ACTIVATED_ABILITY_USED', { count: 1, controller: 'HUMAN' })], description: 'Vencer após usar uma Habilidade ativada.' },
  'C05-E01': { predicates: [p('PLAYED_SUBTYPES', { subtypes: ['SUPPORTER'], controller: 'HUMAN' })], description: 'Vencer depois de jogar um Apoiador.' },
  'C05-E03': { predicates: [p('PLAYED_SUBTYPES', { subtypes: ['ITEM'], controller: 'HUMAN' })], description: 'Vencer depois de jogar um Item.' },
  'C05-E05': { predicates: [p('OPPONENT_POINTS_AT_MOST', { count: 1 })], description: 'Vencer com no máximo 1 ponto concedido ao adversário.' },
  'C05-E06': { predicates: [p('ENERGY_ON_ONE_POKEMON_AT_LEAST', { count: 3, controller: 'HUMAN' })], description: 'Vencer com três Energias ligadas a um mesmo Pokémon.' },
  'C06-E01': { predicates: [p('DECK_COMPOSITION', { composition: NO_EX }), p('OWN_TURNS_AT_MOST', { count: 10, controller: 'HUMAN' })], description: 'Vencer sem Pokémon ex no deck e em até 10 turnos próprios.' },
  'C06-E03': { predicates: [p('OPPONENT_POINTS_AT_MOST', { count: 1 })], description: 'Vencer sem conceder mais de 1 ponto.' },
  'C06-E05': { predicates: [p('KNOCKED_OUT_RULEBOX', { ruleBoxes: ['EX'], controller: 'HUMAN' })], description: 'Vencer Nocauteando um Pokémon ex.' },
  'C06-E06': { predicates: [p('DISTINCT_ATTACKERS_AT_LEAST', { count: 2, controller: 'HUMAN' })], description: 'Vencer atacando com ao menos duas entidades distintas.' },
  'F00-D01': { predicates: [p('EVOLVED_AT_LEAST', { count: 1, controller: 'HUMAN' }), p('SWITCH_EFFECT_USED', { count: 1, controller: 'HUMAN' })], description: 'Vencer após evoluir e usar uma troca por efeito.' },
  'F00-D02': { predicates: [p('DISTINCT_ATTACKERS_AT_LEAST', { count: 2, controller: 'HUMAN' })], description: 'Vencer após atacar com duas entidades diferentes.' },
  'F00-D03': { predicates: [p('OPPONENT_POINTS_AT_MOST', { count: 1 })], description: 'Vencer concedendo no máximo 1 ponto.' },
};

/** Objetivo composto único dos tutoriais e puzzles. */
const COMPOSITE: Readonly<Record<string, Tactic>> = {
  'P00-T01': { predicates: [p('WIN')], description: 'Vencer depois de colocar um Básico como Ativo.' },
  'P00-T02': { predicates: [p('WIN'), p('MANUAL_ENERGY_ATTACHED_AT_LEAST', { count: 1, controller: 'HUMAN' })], description: 'Vencer e realizar uma ligação manual válida de Energia.' },
  'P00-T03': { predicates: [p('WIN'), p('PLACED_ON_BENCH_AT_LEAST', { count: 1, controller: 'HUMAN' })], description: 'Vencer tendo colocado ao menos um Básico no Banco.' },
  'P00-T04': { predicates: [p('WIN'), p('EVOLVED_AT_LEAST', { count: 1, controller: 'HUMAN' })], description: 'Vencer e evoluir uma vez legalmente.' },
  'P00-T05': { predicates: [p('WIN'), p('PLAYED_SUBTYPES', { subtypes: ['ITEM', 'SUPPORTER'], controller: 'HUMAN' })], description: 'Vencer e usar um Item e um Apoiador na mesma tentativa.' },
  'P00-T06': { predicates: [p('WIN'), p('RETREATED_AT_LEAST', { count: 1, controller: 'HUMAN' })], description: 'Vencer o duelo guiado e executar um Recuo normal.' },
  'C01-E02': { predicates: [p('WIN'), p('OWN_TURNS_AT_MOST', { count: 2, controller: 'HUMAN' })], description: 'Vencer o puzzle em até 2 turnos próprios.' },
  'C02-E02': { predicates: [p('WIN_IN_PREPARED_TURN'), p('SWITCH_EFFECT_USED', { count: 1, controller: 'HUMAN' })], description: 'Vencer no turno preparado usando um efeito de troca.' },
  'C03-E02': { predicates: [p('WIN_IN_PREPARED_TURN'), p('PLAYED_SUBTYPES', { subtypes: ['ITEM'], controller: 'HUMAN' })], description: 'Vencer no turno preparado usando o Item certo.' },
  'C04-E02': { predicates: [p('WIN_IN_PREPARED_TURN'), p('CONDITION_REMOVED_BY_CAUSE', { causes: ['EVOLUTION'], controller: 'HUMAN' })], description: 'Vencer no turno preparado curando a condição especial por evolução.' },
  'C05-E02': { predicates: [p('WIN_IN_PREPARED_TURN'), p('KNOCKOUT_WITHOUT_ATTACK', { count: 1, controller: 'HUMAN' })], description: 'Resolver o Nocaute do puzzle sem declarar ataque (com uma Habilidade).' },
  'C06-E02': { predicates: [p('WIN_IN_PREPARED_TURN')], description: 'Vencer no turno preparado selecionando a sequência de Nocautes correta.' },
};

const objective = (objectiveId: string, predicates: readonly Predicate[], description: string, credits: number): Objective => ({
  objectiveId, scope: 'SINGLE_ATTEMPT', requiresVictory: true, predicates, description, reward: { credits },
  claimPolicy: 'AUTOMATIC_ON_RESULT', grantKey: `objective:${CAMPAIGN_ID}:${objectiveId}`,
});

// ---------------------------------------------------------------- nós

type NodeSpec = { readonly nodeId: string; readonly title: string; readonly npcId: string };

const PROLOGUE: readonly NodeSpec[] = [
  { nodeId: 'P00-T01', title: 'Primeira Carta', npcId: 'lia' },
  { nodeId: 'P00-T02', title: 'Acender a Energia', npcId: 'lia' },
  { nodeId: 'P00-T03', title: 'Preparar a Reserva', npcId: 'lia' },
  { nodeId: 'P00-T04', title: 'A Próxima Forma', npcId: 'lia' },
  { nodeId: 'P00-T05', title: 'Apoio no Momento Certo', npcId: 'lia' },
  { nodeId: 'P00-T06', title: 'Mudar o Plano', npcId: 'lia' },
];

const CHAPTER_NODES: Readonly<Record<string, readonly NodeSpec[]>> = {
  C01: [
    { nodeId: 'C01-E01', title: 'Primeiras Raízes', npcId: 'caio' }, { nodeId: 'C01-E02', title: 'Um Lugar no Banco', npcId: 'iris' },
    { nodeId: 'C01-E03', title: 'Crescimento em Dupla', npcId: 'dora' }, { nodeId: 'C01-E04', title: 'O Jardim de Celadon', npcId: 'iris' },
    { nodeId: 'C01-E05', title: 'Duas Copas', npcId: 'taina' }, { nodeId: 'C01-E06', title: 'Erika, Líder de Celadon', npcId: 'iris' },
  ],
  C02: [
    { nodeId: 'C02-E01', title: 'Atracar', npcId: 'rui' }, { nodeId: 'C02-E02', title: 'Passagem Livre', npcId: 'mara' },
    { nodeId: 'C02-E03', title: 'Fluxo de Retorno', npcId: 'luma' }, { nodeId: 'C02-E04', title: 'O Aquário de Sootopolis', npcId: 'mara' },
    { nodeId: 'C02-E05', title: 'Corrente Cruzada', npcId: 'icaro' }, { nodeId: 'C02-E06', title: 'Wallace, Líder de Sootopolis', npcId: 'mara' },
  ],
  C03: [
    { nodeId: 'C03-E01', title: 'Carga Inicial', npcId: 'bia' }, { nodeId: 'C03-E02', title: 'Energia Bem Contada', npcId: 'teo' },
    { nodeId: 'C03-E03', title: 'Circuito Auxiliar', npcId: 'otto' }, { nodeId: 'C03-E04', title: 'A Oficina de Vermilion', npcId: 'teo' },
    { nodeId: 'C03-E05', title: 'Fio Desencapado', npcId: 'vivi' }, { nodeId: 'C03-E06', title: 'Tenente Surge, Líder de Vermilion', npcId: 'teo' },
  ],
  C04: [
    { nodeId: 'C04-E01', title: 'Bruma Leve', npcId: 'davi' }, { nodeId: 'C04-E02', title: 'Depois da Meia-Volta', npcId: 'nara' },
    { nodeId: 'C04-E03', title: 'Vigília', npcId: 'lis' }, { nodeId: 'C04-E04', title: 'As Lentes de Saffron', npcId: 'nara' },
    { nodeId: 'C04-E05', title: 'Ecos Sobrepostos', npcId: 'enzo' }, { nodeId: 'C04-E06', title: 'Sabrina, Líder de Saffron', npcId: 'nara' },
  ],
  C05: [
    { nodeId: 'C05-E01', title: 'Uma Camada a Mais', npcId: 'malu' }, { nodeId: 'C05-E02', title: 'O Peso da Moldura', npcId: 'breno' },
    { nodeId: 'C05-E03', title: 'Terreno Compartilhado', npcId: 'bento' }, { nodeId: 'C05-E04', title: 'O Dojo de Stow-on-Side', npcId: 'breno' },
    { nodeId: 'C05-E05', title: 'Metal de Retorno', npcId: 'jade' }, { nodeId: 'C05-E06', title: 'Bea, Líder de Stow-on-Side', npcId: 'breno' },
  ],
  C06: [
    { nodeId: 'C06-E01', title: 'Um Ponto de Cada Vez', npcId: 'iago' }, { nodeId: 'C06-E02', title: 'Conta de Risco', npcId: 'sol' },
    { nodeId: 'C06-E03', title: 'Duas Faces do Plano', npcId: 'clara' }, { nodeId: 'C06-E04', title: 'A Sala de Troféus de Viridian', npcId: 'sol' },
    { nodeId: 'C06-E05', title: 'Ápice de Dois Pontos', npcId: 'nico' }, { nodeId: 'C06-E06', title: 'Blue, Líder de Viridian', npcId: 'sol' },
  ],
};

const FINALS: readonly NodeSpec[] = [
  { nodeId: 'F00-D01', title: 'Cheren, Exame de Retorno', npcId: 'lia' },
  { nodeId: 'F00-D02', title: 'Revanche de Blue', npcId: 'sol' },
  { nodeId: 'F00-D03', title: 'Giovanni, Chefe da Equipe Rocket', npcId: 'aurora' },
];

/** Três opções face-up de cada Descoberta (E04). As não escolhidas ficam permanentemente no Empório. */
/** Três opções face-up de cada Descoberta (E04), ◊◊◊ normais do tema do capítulo. As não escolhidas ficam no Empório. */
export const DISCOVERY_OFFERS: Readonly<Record<string, readonly string[]>> = {
  'C01-E04': ['Vileplume', 'Victreebel', 'Kangaskhan'].map((n) => P(a1(n))),
  'C02-E04': ['Blastoise', 'Gyarados', 'Omastar'].map((n) => P(a1(n))),
  'C03-E04': ['Raichu', 'Magneton', 'Zapdos'].map((n) => P(a1(n))),
  'C04-E04': ['Gengar', 'Gardevoir', 'Mewtwo'].map((n) => P(a1(n))),
  'C05-E04': ['Machamp', 'Kabutops', 'Melmetal'].map((n) => P(a1(n))),
  'C06-E04': ['Dragonite', 'Pidgeot', 'Aerodactyl'].map((n) => P(a1(n))),
};

/** Ex da escolha do chefe do C06 (à venda antes dele: Pikachu e Charizard liberam ULTRA nos chefes de C03 e C05). */
export const BOSS_CHOICE_EX = ['Charizard ex', 'Pikachu ex', 'Blastoise ex'] as const;

export const KEY_CARD_REWARDS: Readonly<Record<string, NonNullable<CampaignNode['keyCardReward']>>> = {
  'C01-E06': { mode: 'FIXED', printingIds: [P(a1('Erika'))], copies: 2 },
  'C02-E06': { mode: 'FIXED', printingIds: [P(a1('Misty'))], copies: 2 },
  'C03-E06': { mode: 'FIXED', printingIds: [P(a1('Tenente Surge'))], copies: 2 },
  'C04-E06': { mode: 'FIXED', printingIds: [P(a1('Sabrina'))], copies: 2 },
  'C05-E06': { mode: 'FIXED', printingIds: [P(a1('Brock'))], copies: 2 },
  'C06-E06': { mode: 'CHOICE', printingIds: BOSS_CHOICE_EX.map((n) => P(a1(n))), copies: 2 },
};

/** Pokémon de apoio por encontro (IA protege; objetivo C03-E06 pede o Nocaute). */
const ROLE_TAGS: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
  'C03-E06': { [a1('Magneton').deckLimitKey]: ['apoio'] },
  'C06-E03': { [a1('Vulpix').deckLimitKey]: ['apoio'] },
  'C06-E06': { [a1('Gardevoir').deckLimitKey]: ['apoio'], [a1('Kirlia').deckLimitKey]: ['apoio'] },
  'F00-D03': { [a1('Butterfree').deckLimitKey]: ['apoio'] },
};

/** Coordenadas locais do diorama de capítulo (x à direita, z para o fundo); só navegação, nunca dependência. */
const CHAPTER_LAYOUT: Readonly<Record<string, readonly [number, number]>> = {
  E01: [-3, 2.5], E02: [-0.5, 3.5], E03: [-1.5, 0.5], E04: [1.8, 1.5], E05: [2.8, -1], E06: [0, -2.8],
};
const PROLOGUE_LAYOUT: readonly (readonly [number, number])[] = [[-4, 2], [-2.4, 1], [-0.8, 2], [0.8, 1], [2.4, 2], [4, 0.5]];
const FINAL_LAYOUT: readonly (readonly [number, number])[] = [[-2.5, 0.5], [0, -1], [2.5, 0.5]];

const RANKS: Record<string, NodeKind> = { E01: 'DUEL', E02: 'PUZZLE', E03: 'DUEL', E04: 'DISCOVERY', E05: 'ELITE', E06: 'BOSS' };
const ICON: Record<NodeKind, CampaignNode['map']['icon']> = { TUTORIAL: 'TUTORIAL', DUEL: 'BATTLE', PUZZLE: 'PUZZLE', DISCOVERY: 'DISCOVERY', ELITE: 'ELITE', BOSS: 'BOSS', FINAL: 'FINAL' };

const DIFFICULTIES: readonly Difficulty[] = ['STORY', 'STANDARD', 'EXPERT'];
const profiles = (nodeId: string, npcId: string, deck?: string): NonNullable<CampaignNode['difficultyProfiles']> =>
  Object.fromEntries(DIFFICULTIES.map((d) => [d, { aiProfileId: aiProfileId(npcId, d), npcDeckId: deck ?? npcDeckId(nodeId, d) }])) as NonNullable<CampaignNode['difficultyProfiles']>;

const dialogueRefs = (nodeId: string): CampaignNode['dialogue'] => {
  const id = nodeId.toLowerCase();
  return { briefing: `dlg-${id}-briefing`, intro: NODE_TEXTS[nodeId]?.intro ? `dlg-${id}-intro` : null, victory: `dlg-${id}-victory`, defeat: `dlg-${id}-defeat` };
};

function chapterPrereq(chapterId: string): string {
  const order = ['C01', 'C02', 'C03', 'C04', 'C05', 'C06'];
  const i = order.indexOf(chapterId);
  return i === 0 ? 'P00-T06' : `${order[i - 1]}-E06`;
}

const PREREQ_IN_CHAPTER: Record<string, string | null> = { E01: null, E02: 'E01', E03: 'E01', E04: 'E03', E05: 'E03', E06: 'E03' };

function buildNode(spec: NodeSpec, chapterId: ChapterId, kind: NodeKind, prerequisites: readonly string[], coords: readonly [number, number]): CampaignNode {
  const meta = metaOf(chapterId);
  const lower = spec.nodeId.toLowerCase();
  const isBattle = kind === 'DUEL' || kind === 'ELITE' || kind === 'BOSS' || kind === 'FINAL';
  const chapterN = chapterId.slice(1);
  const rewardTable = kind === 'TUTORIAL' ? (spec.nodeId === 'P00-T06' ? 'tutorial-final-v1' : 'tutorial-v1')
    : kind === 'DUEL' ? `chapter-duel-c${chapterN}-v1`
      : kind === 'PUZZLE' ? 'puzzle-v1'
        : kind === 'DISCOVERY' ? 'discovery-v1'
          : kind === 'ELITE' ? `chapter-elite-c${chapterN}-v1`
            : kind === 'BOSS' ? `chapter-boss-c${chapterN}-v1`
              : spec.nodeId === 'F00-D03' ? 'final-complete-v1' : 'final-v1';
  const repeat = kind === 'DUEL' ? 'duel-repeat-v1' : kind === 'ELITE' ? 'elite-repeat-v1' : kind === 'BOSS' ? 'boss-repeat-v1' : kind === 'FINAL' ? 'final-repeat-v1' : null;
  const essential = kind === 'TUTORIAL' || kind === 'DUEL' || kind === 'BOSS' || kind === 'FINAL';
  return {
    nodeId: spec.nodeId, campaignId: CAMPAIGN_ID, chapterId, contentVersion: CONTENT_VERSION, kind, title: spec.title, essential,
    prerequisites: { allOf: [...prerequisites] }, npcId: spec.npcId, arenaId: meta.arenaId, mapSceneId: meta.mapSceneId,
    difficultyProfiles: isBattle ? profiles(spec.nodeId, spec.npcId) : spec.nodeId === 'P00-T06' ? profiles(spec.nodeId, spec.npcId, T06_NPC_DECK_ID) : null,
    fixtureId: kind === 'TUTORIAL' || kind === 'PUZZLE' ? `fx-${lower}` : null,
    turnLimit: kind === 'PUZZLE' ? { ownTurns: spec.nodeId === 'C01-E02' ? 2 : 1 } : null,
    completionObjectiveId: isBattle ? `${spec.nodeId}-WIN` : kind === 'TUTORIAL' ? `${spec.nodeId}-TUTORIAL` : kind === 'PUZZLE' ? `${spec.nodeId}-PUZZLE` : null,
    optionalObjectiveIds: isBattle ? [`${spec.nodeId}-TACTIC`, `${spec.nodeId}-DECK`] : [],
    firstClearRewardTableId: rewardTable,
    repeatRewardTableId: repeat,
    keyCardReward: KEY_CARD_REWARDS[spec.nodeId] ?? null,
    discoveryOffer: kind === 'DISCOVERY' ? [...DISCOVERY_OFFERS[spec.nodeId]!] : null,
    supportDeckIds: isBattle && chapterId !== 'P00' ? [...supportDecksFor(spec.nodeId, chapterId)] : [],
    ...(ROLE_TAGS[spec.nodeId] ? { roleTags: ROLE_TAGS[spec.nodeId] } : {}),
    dialogue: dialogueRefs(spec.nodeId),
    map: { x: coords[0], z: coords[1], icon: ICON[kind] },
  };
}

export const NODES: readonly CampaignNode[] = [
  ...PROLOGUE.map((spec, i) => buildNode(spec, 'P00', 'TUTORIAL', i === 0 ? [] : [PROLOGUE[i - 1]!.nodeId], PROLOGUE_LAYOUT[i]!)),
  ...Object.entries(CHAPTER_NODES).flatMap(([chapterId, specs]) => specs.map((spec) => {
    const slot = spec.nodeId.slice(4);
    const prev = PREREQ_IN_CHAPTER[slot];
    const prereq = prev ? `${chapterId}-${prev}` : chapterPrereq(chapterId);
    return buildNode(spec, chapterId as ChapterId, RANKS[slot]!, [prereq], CHAPTER_LAYOUT[slot]!);
  })),
  ...FINALS.map((spec, i) => buildNode(spec, 'F00', 'FINAL', [i === 0 ? 'C06-E06' : FINALS[i - 1]!.nodeId], FINAL_LAYOUT[i]!)),
];

export const OBJECTIVES: readonly Objective[] = NODES.flatMap((node): Objective[] => {
  if (node.kind === 'TUTORIAL' || node.kind === 'PUZZLE') {
    const c = COMPOSITE[node.nodeId]!;
    return [objective(node.completionObjectiveId!, c.predicates, c.description, 0)];
  }
  if (node.kind === 'DISCOVERY') return [];
  const tactic = TACTICS[node.nodeId]!;
  const region = REGION_COMPOSITION[node.chapterId]!;
  return [
    objective(`${node.nodeId}-WIN`, [p('WIN')], 'Vencer o duelo.', 0),
    objective(`${node.nodeId}-TACTIC`, tactic.predicates, tactic.description, OBJECTIVE_REWARD),
    objective(`${node.nodeId}-DECK`, [p('DECK_COMPOSITION', { composition: region.composition })], region.description, OBJECTIVE_REWARD),
  ];
});

// ---------------------------------------------------------------- tabelas de prêmio

const table = (rewardTableId: string, credits: number, packs: RewardTable['packs'] = [], extra: Partial<Pick<RewardTable, 'medal' | 'cosmetics' | 'unlocks'>> = {}): RewardTable => ({
  rewardTableId, credits, packs, medal: extra.medal ?? null, cosmetics: extra.cosmetics ?? [], unlocks: extra.unlocks ?? [],
});

const NEXT_AFTER_BOSS: Record<string, string> = { C01: 'chapter:C02', C02: 'chapter:C03', C03: 'chapter:C04', C04: 'chapter:C05', C05: 'chapter:C06', C06: 'chapter:F00' };
/** Chefe que fecha cada pacote libera os ULTRA dele no Empório (products.ts, A1_PACKS). */
const ULTRA_UNLOCK: Record<string, string> = { C03: 'emporium:ultra-pikachu', C05: 'emporium:ultra-charizard', C06: 'emporium:ultra-mewtwo' };
const CHAPTER_MAT: Record<string, string> = { C01: 'mat-c01-grove', C02: 'mat-c02-harbor', C03: 'mat-c03-circuits', C04: 'mat-c04-observatory', C05: 'mat-c05-foundry', C06: 'mat-c06-archive' };

export const REWARD_TABLES: readonly RewardTable[] = [
  table('tutorial-v1', 50),
  table('tutorial-final-v1', 100, [{ productId: 'pack-a1-pikachu', count: 1 }], { unlocks: ['chapter:C01', 'emporium:pack-a1-charizard'] }),
  table('puzzle-v1', 100),
  table('discovery-v1', 0, [], { unlocks: ['emporium:discovery-alternatives'] }),
  ...['01', '02', '03', '04', '05', '06'].flatMap((n) => {
    const chapter = `C${n}`;
    const pack = metaOf(chapter as ChapterId).packProductId!;
    return [
      table(`chapter-duel-c${n}-v1`, 80, [{ productId: pack, count: 1 }]),
      table(`chapter-elite-c${n}-v1`, 160, [{ productId: pack, count: 1 }]),
      table(`chapter-boss-c${n}-v1`, 250, [{ productId: pack, count: 2 }], {
        medal: `medal-c${n}`, cosmetics: [`flair-c${n}`],
        unlocks: [NEXT_AFTER_BOSS[chapter]!, `emporium:${CHAPTER_MAT[chapter]}`, ...(ULTRA_UNLOCK[chapter] ? [ULTRA_UNLOCK[chapter]!] : []), ...(n === '01' ? ['mode:arena'] : []), ...(n === '03' ? ['emporium:pack-a1-mewtwo'] : [])],
      }),
    ];
  }),
  table('final-v1', 300, [{ productId: 'pack-a1-charizard', count: 1 }, { productId: 'pack-a1-mewtwo', count: 1 }]),
  table('final-complete-v1', 300, [{ productId: 'pack-a1-pikachu', count: 1 }, { productId: 'pack-a1-mewtwo', count: 1 }], { medal: 'trophy-circuito-completo', cosmetics: ['mat-circuit-complete'], unlocks: ['mode:postgame', 'emporium:ultra-a1'] }),
  table('duel-repeat-v1', 20),
  table('elite-repeat-v1', 30),
  table('boss-repeat-v1', 40),
  table('final-repeat-v1', 40),
];
