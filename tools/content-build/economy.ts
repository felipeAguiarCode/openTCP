// Auditoria econômica recalculada a partir dos dados (campanha §15.4): rota obrigatória e máximo único.
import type { ContentBundle } from '../../src/content/types.ts';

export type EconomyAudit = {
  readonly onboarding: number;
  readonly prologue: number;
  readonly chapters: number;
  readonly finals: number;
  readonly mandatory: number;
  readonly puzzles: number;
  readonly elites: number;
  readonly discoveries: number;
  readonly objectives: number;
  readonly objectiveCount: number;
  readonly optional: number;
  readonly maxOneTime: number;
  readonly packsMandatory: Readonly<Record<string, number>>;
  readonly packsOptional: Readonly<Record<string, number>>;
  /** ceil(P / recompensa repetível) para cada preço dirigido e cada tabela repetível. */
  readonly repeatIndicators: readonly { readonly rewardTableId: string; readonly credits: number; readonly winsFor: Readonly<Record<string, number>> }[];
};

export const EXPECTED_MANDATORY = 4010;
export const EXPECTED_MAX_ONE_TIME = 7730;

export function economyAudit(bundle: ContentBundle): EconomyAudit {
  const tables = new Map(bundle.rewardTables.map((t) => [t.rewardTableId, t]));
  const creditsOf = (id: string) => tables.get(id)?.credits ?? 0;
  const sumNodes = (filter: (n: ContentBundle['nodes'][number]) => boolean) =>
    bundle.nodes.filter(filter).reduce((sum, n) => sum + creditsOf(n.firstClearRewardTableId), 0);
  const prologue = sumNodes((n) => n.essential && n.chapterId === 'P00');
  const chapters = sumNodes((n) => n.essential && n.chapterId !== 'P00' && n.chapterId !== 'F00');
  const finals = sumNodes((n) => n.essential && n.chapterId === 'F00');
  const mandatory = bundle.onboarding.credits + prologue + chapters + finals;
  const puzzles = sumNodes((n) => !n.essential && n.kind === 'PUZZLE');
  const elites = sumNodes((n) => !n.essential && n.kind === 'ELITE');
  const discoveries = sumNodes((n) => !n.essential && n.kind === 'DISCOVERY');
  const paid = bundle.objectives.filter((o) => o.reward.credits > 0);
  const objectives = paid.reduce((sum, o) => sum + o.reward.credits, 0);
  const optional = puzzles + elites + discoveries + objectives;
  const packs = (essential: boolean) => {
    const out: Record<string, number> = {};
    for (const n of bundle.nodes.filter((x) => x.essential === essential)) {
      for (const p of tables.get(n.firstClearRewardTableId)?.packs ?? []) out[p.productId] = (out[p.productId] ?? 0) + p.count;
    }
    if (essential) for (const p of bundle.onboarding.packs) out[p.productId] = (out[p.productId] ?? 0) + p.count;
    return out;
  };
  const prices = { COMMON: 80, UNCOMMON: 160, RARE: 300, ULTRA: 600, PACK: 100, SLEEVE: 200, COIN: 300, PLAYMAT: 500 };
  const repeatIds = [...new Set(bundle.nodes.map((n) => n.repeatRewardTableId).filter((x): x is string => !!x))].sort();
  return {
    onboarding: bundle.onboarding.credits, prologue, chapters, finals, mandatory, puzzles, elites, discoveries,
    objectives, objectiveCount: paid.length, optional, maxOneTime: mandatory + optional,
    packsMandatory: packs(true), packsOptional: packs(false),
    repeatIndicators: repeatIds.map((id) => ({
      rewardTableId: id, credits: creditsOf(id),
      winsFor: Object.fromEntries(Object.entries(prices).map(([k, v]) => [k, creditsOf(id) > 0 ? Math.ceil(v / creditsOf(id)) : 0])),
    })),
  };
}
