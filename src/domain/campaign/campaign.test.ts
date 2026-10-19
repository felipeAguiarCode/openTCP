import { describe, expect, it } from 'vitest';
import type { CampaignNode, Objective, RewardTable } from '../../content/types.ts';
import { emptyStats } from '../battle/setup.ts';
import type { MatchResult } from '../battle/types.ts';
import { evaluateObjectives, type DeckFacts } from './objectives.ts';
import { EMPTY_PROGRESS, assistanceLevel, computeStatuses, recommendedNode, validateGraph, type NodeProgress } from './progress.ts';
import { firstClearKey, planResultGrants } from './rewards.ts';

const node = (nodeId: string, allOf: string[], extra: Partial<CampaignNode> = {}): CampaignNode => ({
  nodeId, campaignId: 'camp', chapterId: 'C01' as CampaignNode['chapterId'], contentVersion: '1.0.0', kind: 'BATTLE' as CampaignNode['kind'],
  title: nodeId, essential: true, prerequisites: { allOf }, npcId: 'npc', arenaId: 'arena-academy', mapSceneId: 'map',
  difficultyProfiles: null, fixtureId: null, turnLimit: null, completionObjectiveId: null, optionalObjectiveIds: [`${nodeId}-obj`],
  firstClearRewardTableId: `${nodeId}-first`, repeatRewardTableId: 'repeat', keyCardReward: null, discoveryOffer: null, supportDeckIds: [],
  dialogue: { briefing: '', intro: null, victory: '', defeat: '' }, map: { x: 0, z: 0, icon: 'BATTLE' }, ...extra,
});

const cleared = (id: string, objectives: string[] = []): NodeProgress => ({ ...EMPTY_PROGRESS, firstClearAttemptId: `att-${id}`, completedObjectiveIds: objectives, wins: 1 });

const facts: DeckFacts = {
  basicCount: 8, ruleBoxCopies: { EX: 0, MEGA_EX: 0 }, subtypeCopies: { ITEM: 4, SUPPORTER: 2, TOOL: 0, STADIUM: 0 },
  distinctEvolutionLines: 2, setCounts: { A: 10 }, typeCounts: { FIRE: 8 }, starterPrintingCount: 20, opcodeCardCounts: {}, energyTypeCount: 1,
};

const win: MatchResult = { outcome: 'WIN', winner: 'A', reason: 'POINTS', points: { A: 3, B: 1 }, globalTurnNumber: 12 };
const loss: MatchResult = { ...win, winner: 'B', points: { A: 1, B: 3 } };

describe('grafo e estados de nó', () => {
  const nodes = [node('n1', []), node('n2', ['n1']), node('n3', ['n1', 'n2'])];

  it('desbloqueia por pré-requisitos e deriva MASTERED pelos objetivos', () => {
    let s = computeStatuses(nodes, new Map(), null);
    expect([...s.values()]).toEqual(['AVAILABLE', 'LOCKED', 'LOCKED']);
    s = computeStatuses(nodes, new Map([['n1', cleared('n1')]]), null);
    expect([...s.values()]).toEqual(['CLEARED', 'AVAILABLE', 'LOCKED']);
    s = computeStatuses(nodes, new Map([['n1', cleared('n1', ['n1-obj'])], ['n2', cleared('n2')]]), 'n3');
    expect([...s.values()]).toEqual(['MASTERED', 'CLEARED', 'IN_PROGRESS']);
    expect(recommendedNode(nodes, computeStatuses(nodes, new Map([['n1', cleared('n1')]]), null))?.nodeId).toBe('n2');
  });

  it('detecta referência inexistente e ciclo', () => {
    expect(validateGraph(nodes)).toEqual([]);
    expect(validateGraph([...nodes, node('n4', ['zz'])]).join()).toMatch(/zz/);
    expect(validateGraph([node('a', ['b']), node('b', ['a'])]).length).toBeGreaterThan(0);
  });

  it('assistência cresce com derrotas consecutivas (G-076)', () => {
    expect(assistanceLevel(undefined)).toBe('NONE');
    expect(assistanceLevel({ ...EMPTY_PROGRESS, consecutiveLosses: 2 })).not.toBe('NONE');
  });
});

describe('objetivos', () => {
  const objectives: Objective[] = [
    { objectiveId: 'o-bench', scope: 'SINGLE_ATTEMPT', requiresVictory: true, predicates: [{ type: 'PLACED_ON_BENCH_AT_LEAST', count: 2 }], description: '', reward: { credits: 20 }, claimPolicy: 'AUTOMATIC_ON_RESULT', grantKey: 'objective:camp:o-bench' },
    { objectiveId: 'o-noex', scope: 'SINGLE_ATTEMPT', requiresVictory: true, predicates: [{ type: 'DECK_COMPOSITION', composition: { maxRuleBoxCopies: { EX: 0 }, maxStarterPrintings: 12 } }], description: '', reward: { credits: 30 }, claimPolicy: 'AUTOMATIC_ON_RESULT', grantKey: 'objective:camp:o-noex' },
    { objectiveId: 'o-points', scope: 'SINGLE_ATTEMPT', requiresVictory: false, predicates: [{ type: 'OPPONENT_POINTS_AT_MOST', count: 1 }], description: '', reward: { credits: 10 }, claimPolicy: 'AUTOMATIC_ON_RESULT', grantKey: 'objective:camp:o-points' },
  ];

  it('avalia apenas fatos confirmados e exige vitória quando declarado', () => {
    const stats = { ...emptyStats(), benchPlacements: 3 };
    expect(evaluateObjectives(objectives, { human: 'A', result: win, stats, ownTurns: 6, deck: facts, turnLimit: null })).toEqual(['o-bench', 'o-points']);
    expect(evaluateObjectives(objectives, { human: 'A', result: loss, stats, ownTurns: 6, deck: facts, turnLimit: null })).toEqual([]);
  });

  it('composição exige desvio real dos decks iniciais (F1)', () => {
    const custom = { ...facts, starterPrintingCount: 10 };
    expect(evaluateObjectives(objectives, { human: 'A', result: win, stats: emptyStats(), ownTurns: 6, deck: custom, turnLimit: null })).toContain('o-noex');
  });
});

describe('concessões do resultado', () => {
  const n = node('n1', []);
  const tables = new Map<string, RewardTable>([
    ['n1-first', { rewardTableId: 'n1-first', credits: 100, packs: [{ productId: 'p', count: 1 }], medal: 'BRONZE', cosmetics: ['c1'], unlocks: [] }],
    ['repeat', { rewardTableId: 'repeat', credits: 15, packs: [], medal: null, cosmetics: [], unlocks: [] }],
  ]);
  const objectives = new Map<string, Objective>([['n1-obj', { objectiveId: 'n1-obj', scope: 'SINGLE_ATTEMPT', requiresVictory: true, predicates: [], description: '', reward: { credits: 25 }, claimPolicy: 'AUTOMATIC_ON_RESULT', grantKey: 'objective:camp:n1-obj' }]]);
  const base = { campaignId: 'camp', node: n, mode: 'CAMPAIGN' as const, won: true, completedObjectiveIds: ['n1-obj'], objectives, rewardTables: tables, granted: new Set<string>(), progressionEligible: true };

  it('primeira vitória concede a tabela inicial e objetivos, com chaves canônicas', () => {
    const plan = planResultGrants(base);
    expect(plan.firstClear).toBe(true);
    expect(plan.credits).toBe(125);
    expect(plan.grantKeys).toEqual([firstClearKey('camp', 'n1'), 'objective:camp:n1-obj']);
    expect(plan.packs).toEqual([{ productId: 'p', count: 1 }]);
  });

  it('repetição concede só a tabela repetível, nunca as duas (C-020)', () => {
    const plan = planResultGrants({ ...base, granted: new Set([firstClearKey('camp', 'n1'), 'objective:camp:n1-obj']) });
    expect(plan.firstClear).toBe(false);
    expect(plan.credits).toBe(15);
    expect(plan.grantKeys).toEqual([]);
    expect(plan.packs).toEqual([]);
  });

  it('treino e LAB não concedem nada; Arena não conclui objetivos de campanha', () => {
    expect(planResultGrants({ ...base, mode: 'TRAINING' }).credits).toBe(0);
    expect(planResultGrants({ ...base, mode: 'LAB' }).grantKeys).toEqual([]);
    const arena = planResultGrants({ ...base, mode: 'ARENA', granted: new Set([firstClearKey('camp', 'n1')]) });
    expect(arena.newObjectiveIds).toEqual([]);
    expect(arena.credits).toBe(15);
  });
});
