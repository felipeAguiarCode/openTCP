// Concessões do resultado (campanha §15.1, §24.5): primeira vitória OU repetível, nunca os dois;
// objetivos por união com chave única; chaves canônicas sem versão de conteúdo (persistencia §13).
import type { CampaignNode, Objective, RewardTable } from '../../content/types.ts';

export type GrantPlan = {
  readonly credits: number;
  readonly packs: readonly { readonly productId: string; readonly count: number }[];
  readonly cosmetics: readonly string[];
  readonly medal: string | null;
  readonly keyCard: { readonly mode: 'FIXED' | 'CHOICE'; readonly printingIds: readonly string[]; readonly copies: number } | null;
  readonly grantKeys: readonly string[];
  readonly firstClear: boolean;
  readonly newObjectiveIds: readonly string[];
  readonly breakdown: readonly { readonly source: string; readonly credits: number }[];
};

export const firstClearKey = (campaignId: string, nodeId: string) => `first-clear:${campaignId}:${nodeId}`;
export const discoveryKey = (campaignId: string, nodeId: string) => `discovery:${campaignId}:${nodeId}`;
export const onboardingKey = (campaignId: string) => `onboarding:${campaignId}`;
export const openingKey = (openingId: string) => `opening:${openingId}`;
export const cosmeticKey = (milestoneId: string, cosmeticId: string) => `cosmetic:${milestoneId}:${cosmeticId}`;

export type ResultInput = {
  readonly campaignId: string;
  readonly node: CampaignNode;
  readonly mode: 'CAMPAIGN' | 'ARENA' | 'TRAINING' | 'CUSTOM' | 'LAB';
  readonly won: boolean;
  readonly completedObjectiveIds: readonly string[];
  readonly objectives: ReadonlyMap<string, Objective>;
  readonly rewardTables: ReadonlyMap<string, RewardTable>;
  readonly granted: ReadonlySet<string>;
  readonly progressionEligible: boolean;
};

const EMPTY: GrantPlan = { credits: 0, packs: [], cosmetics: [], medal: null, keyCard: null, grantKeys: [], firstClear: false, newObjectiveIds: [], breakdown: [] };

export function planResultGrants(input: ResultInput): GrantPlan {
  if (!input.progressionEligible || input.mode === 'TRAINING' || input.mode === 'LAB') return EMPTY;
  const breakdown: { source: string; credits: number }[] = [];
  const grantKeys: string[] = [];
  let credits = 0;
  let packs: { productId: string; count: number }[] = [];
  let cosmetics: string[] = [];
  let medal: string | null = null;
  let keyCard: GrantPlan['keyCard'] = null;
  let firstClear = false;
  const firstKey = firstClearKey(input.campaignId, input.node.nodeId);
  if (input.won && input.mode === 'CAMPAIGN' && !input.granted.has(firstKey)) {
    const table = input.rewardTables.get(input.node.firstClearRewardTableId);
    if (!table) throw new Error(`CONTENT_REFERENCE_MISSING: tabela ${input.node.firstClearRewardTableId}`);
    firstClear = true;
    grantKeys.push(firstKey);
    credits += table.credits;
    breakdown.push({ source: 'FIRST_CLEAR', credits: table.credits });
    packs = table.packs.map((p) => ({ ...p }));
    cosmetics = [...table.cosmetics];
    medal = table.medal;
    keyCard = input.node.keyCardReward;
  } else if (input.won && input.node.repeatRewardTableId) {
    const table = input.rewardTables.get(input.node.repeatRewardTableId);
    if (table) {
      credits += table.credits;
      breakdown.push({ source: 'REPEAT', credits: table.credits });
    }
  }
  // A Arena genérica não conclui objetivos específicos de campanha (campanha §18.1).
  const newObjectiveIds: string[] = [];
  if (input.mode === 'CAMPAIGN') {
    for (const id of input.completedObjectiveIds) {
      const objective = input.objectives.get(id);
      if (!objective) continue;
      if (input.granted.has(objective.grantKey) || grantKeys.includes(objective.grantKey)) continue;
      grantKeys.push(objective.grantKey);
      newObjectiveIds.push(id);
      if (objective.reward.credits > 0) {
        credits += objective.reward.credits;
        breakdown.push({ source: id, credits: objective.reward.credits });
      }
    }
  }
  return { credits, packs, cosmetics, medal, keyCard, grantKeys, firstClear, newObjectiveIds, breakdown };
}
