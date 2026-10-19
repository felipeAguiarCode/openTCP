// Personagens controlados por IA (todos locais e identificados como tal) e perfis de IA por dificuldade. Desde o
// conteúdo 3.1.0 os rivais são treinadores da franquia (líderes de Ginásio, Blue e Giovanni), com retrato próprio.
// A personalidade aparece nos pesos e políticas (campanha §14.1), nunca em regras ocultas ou compras secretas.
import type { AiProfile, ChapterId, Difficulty, Npc } from '../types.ts';

type Weights = AiProfile['weights'];
type Personality = {
  readonly weights: Partial<Weights>;
  readonly setupPolicy: AiProfile['setupPolicy'];
  readonly targetPolicy: AiProfile['targetPolicy'];
  readonly promotionPolicy: AiProfile['promotionPolicy'];
};

// `aggression` (ritmo do ataque e Ativo ocioso, ver domain/ai/evaluate.ts): todo rival ataca quando pode; a
// personalidade só regula o quanto ele arrisca o Ativo para isso.
const BASE_WEIGHTS: Weights = {
  points: 3, opponentPoints: -3, damageDealt: 1, knockoutThreat: 1.5, energyDevelopment: 1, evolution: 1,
  benchDevelopment: 0.8, handSize: 0.2, conditions: 0.5, preservePoints: 0.8, aggression: 1,
};

const PERSONALITY: Record<string, Personality> = {
  academy: { weights: { evolution: 1.2, benchDevelopment: 1 }, setupPolicy: 'BEST_ATTACKER_ACTIVE', targetPolicy: 'MAX_DAMAGE', promotionPolicy: 'BEST_ATTACKER' },
  grove: { weights: { evolution: 1.8, benchDevelopment: 1.8 }, setupPolicy: 'PROTECT_KEY_BASIC', targetPolicy: 'PREFER_KNOCKOUT', promotionPolicy: 'BEST_ATTACKER' },
  harbor: { weights: { preservePoints: 2, energyDevelopment: 1.2, damageDealt: 0.8, aggression: 0.7 }, setupPolicy: 'HIGHEST_HP_ACTIVE', targetPolicy: 'MAX_DAMAGE', promotionPolicy: 'LOWEST_POINTS_RISK' },
  circuits: { weights: { energyDevelopment: 2.5, benchDevelopment: 1.2, aggression: 1.1 }, setupPolicy: 'PROTECT_KEY_BASIC', targetPolicy: 'PREFER_KNOCKOUT', promotionPolicy: 'BEST_ATTACKER' },
  observatory: { weights: { conditions: 2.5, knockoutThreat: 1.2 }, setupPolicy: 'BEST_ATTACKER_ACTIVE', targetPolicy: 'PREFER_KNOCKOUT', promotionPolicy: 'HIGHEST_HP' },
  foundry: { weights: { knockoutThreat: 2, preservePoints: 1.5, aggression: 1.2 }, setupPolicy: 'HIGHEST_HP_ACTIVE', targetPolicy: 'PREFER_KNOCKOUT', promotionPolicy: 'HIGHEST_HP' },
  archive: { weights: { points: 4, opponentPoints: -4, preservePoints: 2.5, aggression: 0.85 }, setupPolicy: 'PROTECT_KEY_BASIC', targetPolicy: 'PREFER_HIGH_POINTS', promotionPolicy: 'LOWEST_POINTS_RISK' },
  final: { weights: { points: 4, opponentPoints: -4, damageDealt: 1.5, knockoutThreat: 2, energyDevelopment: 1.5, evolution: 1.5, aggression: 1.2 }, setupPolicy: 'BEST_ATTACKER_ACTIVE', targetPolicy: 'PREFER_HIGH_POINTS', promotionPolicy: 'BEST_ATTACKER' },
};

const BUDGET: Record<Difficulty, AiProfile['budget']> = {
  STORY: { maxNodes: 200, maxDepth: 1, determinizations: 1, watchdogMs: 500 },
  STANDARD: { maxNodes: 2500, maxDepth: 3, determinizations: 4, watchdogMs: 1500 },
  // Busca além do próprio turno não deixou o EXPERT mais forte (efeito horizonte, medido na IA); orçamento
  // maior só deixava o turno lento (0,5–2,4 s por ação). A dificuldade vem dos decks e pesos do EXPERT.
  EXPERT: { maxNodes: 4000, maxDepth: 8, determinizations: 4, watchdogMs: 3000 },
};
const TOLERANCE: Record<Difficulty, AiProfile['tolerance']> = {
  STORY: { suboptimalChance: 0.25, candidatePoolTop: 3 },
  STANDARD: { suboptimalChance: 0.08, candidatePoolTop: 2 },
  EXPERT: { suboptimalChance: 0, candidatePoolTop: 1 },
};
/** História reduz a ênfase (heurística mais rasa); Especialista reforça a conta de pontos. */
const SCALE: Record<Difficulty, number> = { STORY: 0.7, STANDARD: 1, EXPERT: 1.15 };

const clamp = (n: number) => Math.max(-10, Math.min(10, Math.round(n * 100) / 100));

type NpcSpec = {
  readonly npcId: string; readonly name: string; readonly title: string; readonly chapterId: ChapterId; readonly personality: keyof typeof PERSONALITY;
  readonly style: string; readonly origin: string; readonly hints: readonly string[]; readonly preset: string;
  /** Retrato (emote) do treinador: `portrait:<arquivo>` em src/presentation/assets/portraits. */
  readonly portrait: string;
};

// Os ids (npcId) são os da campanha original e não mudam: duelos suspensos guardam o perfil de IA `<npcId>-<dificuldade>-v1`.
// Desde o conteúdo 3.1.0 cada rival é um treinador da franquia, e cada capítulo é um torneio do tipo num Ginásio.
const NPC_SPECS: readonly NpcSpec[] = [
  // ---- professor, líderes anfitriões e final
  { npcId: 'lia', name: 'Cheren', title: 'Professor da Escola de Treinadores', chapterId: 'P00', personality: 'academy', preset: 'preset-npc-academy', portrait: 'portrait:cheren-emote-4',
    style: 'Paciente e direto; joga o básico bem feito e explica cada passo.',
    origin: 'Escola de Treinadores — prólogo e exame de retorno na final.',
    hints: ['Cheren evolui assim que pode; deixe uma reserva pronta no Banco.', 'No exame final ele usa trocas por efeito: conte o Recuo antes de comprometer Energias.'] },
  { npcId: 'iris', name: 'Erika', title: 'Líder do Ginásio de Celadon', chapterId: 'C01', personality: 'grove', preset: 'preset-npc-c01', portrait: 'portrait:erika-emote-1',
    style: 'Planta com calma: enche o Banco e prepara o segundo atacante enquanto o primeiro aguenta.',
    origin: 'Ginásio de Celadon.',
    hints: ['Erika nunca concentra todas as Energias num só Pokémon.', 'Pólen carrega o Banco dela: pressione antes que a reserva evolua.', 'Fogo encontra Fraqueza em quase todo o jardim.'] },
  { npcId: 'mara', name: 'Wallace', title: 'Líder do Ginásio de Sootopolis', chapterId: 'C02', personality: 'harbor', preset: 'preset-npc-c02', portrait: 'portrait:wallace-emote-1',
    style: 'Alterna atacantes e preserva Energias para o turno seguinte.',
    origin: 'Ginásio de Sootopolis.',
    hints: ['Wallace recua quando o Ativo corre risco; finalize antes da troca.', 'Elétrico explora a Fraqueza da Água.', 'Lontra no Banco barateia o Recuo dele.'] },
  { npcId: 'teo', name: 'Tenente Surge', title: 'Líder do Ginásio de Vermilion', chapterId: 'C03', personality: 'circuits', preset: 'preset-npc-c03', portrait: 'portrait:lt-surge-emote-1',
    style: 'Monta uma fonte de Energia no Banco e descarrega tudo num atacante principal.',
    origin: 'Ginásio de Vermilion.',
    hints: ['Magneton se carrega sozinho uma vez por turno; a carta Tenente Surge leva a carga para a frente.', 'Hitmonlee alcança o Banco: interrompa a fonte.', 'Raichu descarta todas as Energias ao atacar.'] },
  { npcId: 'nara', name: 'Sabrina', title: 'Líder do Ginásio de Saffron', chapterId: 'C04', personality: 'observatory', preset: 'preset-npc-c04', portrait: 'portrait:sabrina-arc-emote-1',
    style: 'Joga com o tempo: condições especiais, Habilidades e durações bem medidas.',
    origin: 'Ginásio de Saffron.',
    hints: ['Gengar no Ativo impede que você jogue Apoiadores.', 'Trocar, recuar ou evoluir remove condições especiais.', 'Gardevoir liga Energia Psíquica ao Ativo dela a cada turno.'] },
  { npcId: 'breno', name: 'Bea', title: 'Líder do Ginásio de Stow-on-Side', chapterId: 'C05', personality: 'foundry', preset: 'preset-npc-c05', portrait: 'portrait:bea-emote-1',
    style: 'Empilha modificadores de dano; Melmetal e Giovanni mudam todas as contas.',
    origin: 'Ginásio de Stow-on-Side.',
    hints: ['Dano de Habilidade não sofre a redução do Melmetal.', 'Machamp precisa de três Energias: derrube-o antes.', 'Metálico é fraco a Fogo.'] },
  { npcId: 'sol', name: 'Blue', title: 'Líder do Ginásio de Viridian', chapterId: 'C06', personality: 'archive', preset: 'preset-npc-c06', portrait: 'portrait:blue-classic-emote-4',
    style: 'Conta pontos antes de tudo; alterna risco entre ex e apoio de um ponto.',
    origin: 'Ginásio de Viridian e revanche na final.',
    hints: ['Os ex de Blue valem 2 pontos: escolha bem o alvo.', 'Gardevoir no Banco acelera o Mewtwo ex.', 'Contar pontos vale mais que maximizar dano.'] },
  { npcId: 'aurora', name: 'Giovanni', title: 'Chefe da Equipe Rocket', chapterId: 'F00', personality: 'final', preset: 'preset-npc-final', portrait: 'portrait:giovanni-emote-2',
    style: 'Combina cura em campo e um atacante de alto risco — tudo à vista na mesa.',
    origin: 'Final do Torneio de Kanto.',
    hints: ['O Charizard ex de Giovanni vale 2 pontos.', 'Butterfree cura 20 de todos os Pokémon dele a cada turno.', 'Moltres ex distribui Energia de Fogo pelo Banco.'] },
  // ---- líderes desafiantes (E01, E03, E05)
  { npcId: 'caio', name: 'Milo', title: 'Líder do Ginásio de Turffield', chapterId: 'C01', personality: 'grove', preset: 'preset-npc-c01', portrait: 'portrait:milo-emote-3',
    style: 'Só Básicos e muita calma.', origin: 'Ginásio de Celadon — Primeiras Raízes.', hints: ['Milo não evolui: aproveite para encher o seu Banco.'] },
  { npcId: 'dora', name: 'Gardenia', title: 'Líder do Ginásio de Eterna', chapterId: 'C01', personality: 'grove', preset: 'preset-npc-c01', portrait: 'portrait:gardenia-emote-1',
    style: 'Duas linhas evolutivas em paralelo.', origin: 'Ginásio de Celadon — Crescimento em Dupla.', hints: ['Derrube o Básico antes da evolução chegar.'] },
  { npcId: 'taina', name: 'Viola', title: 'Líder do Ginásio de Santalune', chapterId: 'C01', personality: 'grove', preset: 'preset-npc-c01', portrait: 'portrait:viola-emote-1',
    style: 'Alterna duas linhas de Estágio 1.', origin: 'Ginásio de Celadon — Duas Copas.', hints: ['Viola traz Básicos direto do baralho com Mudas Prontas.'] },
  { npcId: 'rui', name: 'Marlon', title: 'Líder do Ginásio de Humilau', chapterId: 'C02', personality: 'harbor', preset: 'preset-npc-c02', portrait: 'portrait:marlon-emote-1',
    style: 'Atacantes com Recuos bem diferentes.', origin: 'Ginásio de Sootopolis — Atracar.', hints: ['Dewgong quase não recua: é um alvo parado.'] },
  { npcId: 'luma', name: 'Crasher Wake', title: 'Líder do Ginásio de Pastoria', chapterId: 'C02', personality: 'harbor', preset: 'preset-npc-c02', portrait: 'portrait:crasher-wake-emote-1',
    style: 'Cura e troca sem parar.', origin: 'Ginásio de Sootopolis — Fluxo de Retorno.', hints: ['Cada troca de Crasher Wake cura um pouco; finalize de uma vez.'] },
  { npcId: 'icaro', name: 'Melony', title: 'Líder do Ginásio de Circhester', chapterId: 'C02', personality: 'harbor', preset: 'preset-npc-c02', portrait: 'portrait:melony-emote-3',
    style: 'Força você a trocar de Ativo.', origin: 'Ginásio de Sootopolis — Corrente Cruzada.', hints: ['Tenha mais de um atacante pronto no Banco.'] },
  { npcId: 'bia', name: 'Elesa', title: 'Líder do Ginásio de Nimbasa', chapterId: 'C03', personality: 'circuits', preset: 'preset-npc-c03', portrait: 'portrait:elesa-classic-emote-2',
    style: 'Ataques com custo específico e Incolor.', origin: 'Ginásio de Vermilion — Carga Inicial.', hints: ['Conte as Energias que Elesa ainda precisa para atacar.'] },
  { npcId: 'otto', name: 'Clemont', title: 'Líder do Ginásio de Lumiose', chapterId: 'C03', personality: 'circuits', preset: 'preset-npc-c03', portrait: 'portrait:clemont-emote-3',
    style: 'Acelera Energia do Banco.', origin: 'Ginásio de Vermilion — Circuito Auxiliar.', hints: ['Magneton liga Energia a si mesmo uma vez por turno.'] },
  { npcId: 'vivi', name: 'Iono', title: 'Líder do Ginásio de Levincia', chapterId: 'C03', personality: 'circuits', preset: 'preset-npc-c03', portrait: 'portrait:iono-emote-1',
    style: 'Paralisia na moeda e dano no Banco.', origin: 'Ginásio de Vermilion — Fio Desencapado.', hints: ['Pincurchin e Eelektross podem Paralisar o seu Ativo.', 'Mover Energia não dispara o Fusível.'] },
  { npcId: 'davi', name: 'Koga', title: 'Líder do Ginásio de Fuchsia', chapterId: 'C04', personality: 'observatory', preset: 'preset-npc-c04', portrait: 'portrait:koga-emote-1',
    style: 'Veneno e paciência.', origin: 'Ginásio de Saffron — Bruma Leve.', hints: ['Trocar o Ativo envenenado remove o Veneno.'] },
  { npcId: 'lis', name: 'Liza', title: 'Líder do Ginásio de Mossdeep', chapterId: 'C04', personality: 'observatory', preset: 'preset-npc-c04', portrait: 'portrait:liza-summer-2023-emote-2',
    style: 'Sono e Confusão em cartas diferentes.', origin: 'Ginásio de Saffron — Vigília.', hints: ['Evoluir um Pokémon com condição remove a condição.'] },
  { npcId: 'enzo', name: 'Morty', title: 'Líder do Ginásio de Ecruteak', chapterId: 'C04', personality: 'observatory', preset: 'preset-npc-c04', portrait: 'portrait:morty-emote-3',
    style: 'Veneno com uma condição de controle.', origin: 'Ginásio de Saffron — Ecos Sobrepostos.', hints: ['Veneno e Sono coexistem; uma troca limpa os dois.'] },
  { npcId: 'malu', name: 'Chuck', title: 'Líder do Ginásio de Cianwood', chapterId: 'C05', personality: 'foundry', preset: 'preset-npc-c05', portrait: 'portrait:chuck-emote-3',
    style: 'Apoiadores no turno certo.', origin: 'Ginásio de Stow-on-Side — Uma Camada a Mais.', hints: ['A carta Giovanni soma 10 a todos os ataques do turno.'] },
  { npcId: 'bento', name: 'Roark', title: 'Líder do Ginásio de Oreburgh', chapterId: 'C05', personality: 'foundry', preset: 'preset-npc-c05', portrait: 'portrait:roark-emote-3',
    style: 'Pokémon pesados e lentos.', origin: 'Ginásio de Stow-on-Side — Terreno Compartilhado.', hints: ['A carta Brock liga Energia de Lutador direto no Onix ou no Golem.'] },
  { npcId: 'jade', name: 'Jasmine', title: 'Líder do Ginásio de Olivine', chapterId: 'C05', personality: 'foundry', preset: 'preset-npc-c05', portrait: 'portrait:jasmine-emote-1',
    style: 'Defesa blindada.', origin: 'Ginásio de Stow-on-Side — Metal de Retorno.', hints: ['Melmetal recebe 20 a menos de dano de ataques.', 'Cubone reduz o seu dano no turno seguinte.'] },
  { npcId: 'iago', name: 'Korrina', title: 'Líder do Ginásio de Shalour', chapterId: 'C06', personality: 'archive', preset: 'preset-npc-c06', portrait: 'portrait:korrina-emote-3',
    style: 'Só Pokémon de um ponto.', origin: 'Ginásio de Viridian — Um Ponto de Cada Vez.', hints: ['Cada Nocaute vale um ponto; ganhe no ritmo.'] },
  { npcId: 'clara', name: 'Blaine', title: 'Líder do Ginásio de Cinnabar', chapterId: 'C06', personality: 'archive', preset: 'preset-npc-c06', portrait: 'portrait:blaine-emote-1',
    style: 'Um ex protegido por apoio.', origin: 'Ginásio de Viridian — Duas Faces do Plano.', hints: ['Arcanine ex vale 2 pontos; Vulpix trava o seu ataque.'] },
  { npcId: 'nico', name: 'Clay', title: 'Líder do Ginásio de Driftveil', chapterId: 'C06', personality: 'archive', preset: 'preset-npc-c06', portrait: 'portrait:clay-emote-3',
    style: 'Tudo para os ex de Lutador.', origin: 'Ginásio de Viridian — Ápice de Dois Pontos.', hints: ['Marowak ex e Machamp ex valem 2 pontos cada.'] },
];

export const NPCS: readonly Npc[] = NPC_SPECS.map((spec) => ({
  npcId: spec.npcId, name: spec.name, title: spec.title, chapterId: spec.chapterId, portraitAssetKey: spec.portrait, style: spec.style,
  notebook: { origin: spec.origin, hints: [...spec.hints] }, cosmeticPresetId: spec.preset,
}));

export const aiProfileId = (npcId: string, difficulty: Difficulty): string => `${npcId}-${difficulty.toLowerCase()}-v1`;

export const AI_PROFILES: readonly AiProfile[] = NPC_SPECS.flatMap((spec) => (['STORY', 'STANDARD', 'EXPERT'] as const).map((difficulty): AiProfile => {
  const p = PERSONALITY[spec.personality]!;
  const merged = { ...BASE_WEIGHTS, ...p.weights };
  const weights = Object.fromEntries(Object.entries(merged).map(([k, v]) => [k, clamp(v * SCALE[difficulty])])) as Weights;
  return {
    aiProfileId: aiProfileId(spec.npcId, difficulty), policy: difficulty, budget: BUDGET[difficulty], weights,
    tolerance: TOLERANCE[difficulty],
    setupPolicy: difficulty === 'STORY' ? 'HIGHEST_HP_ACTIVE' : p.setupPolicy,
    targetPolicy: difficulty === 'STORY' ? 'MAX_DAMAGE' : p.targetPolicy,
    promotionPolicy: p.promotionPolicy,
  };
}));
