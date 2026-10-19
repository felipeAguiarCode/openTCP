// Projeções da campanha para as telas (campanha §2, §12, §15; interface §7, §17, §20): estados
// derivados, objetivos por nó, prévia de prêmios, “Continuar”, capítulos e Arena.
import type { CampaignNode, Chapter, ChapterId, Difficulty, Objective } from '../content/types.ts';
import {
  applicableObjectiveIds, arenaOpponents, assistanceLevel, computeStatuses, recommendedNode, EMPTY_PROGRESS, isCleared, type NodeProgress, type NodeStatus,
} from '../domain/campaign/progress.ts';
import { firstClearKey } from '../domain/campaign/rewards.ts';
import type { ContentIndex } from './content.ts';
import { progressMap } from './economy.ts';
import type { ProfileSnapshot } from './ports/storage.ts';

export type ObjectiveView = { readonly objective: Objective; readonly done: boolean; readonly kind: 'COMPLETION' | 'OPTIONAL' };

export type NodeView = {
  readonly node: CampaignNode;
  readonly status: NodeStatus;
  readonly progress: NodeProgress;
  readonly objectives: readonly ObjectiveView[];
  readonly firstClearGranted: boolean;
  readonly assistance: ReturnType<typeof assistanceLevel>;
  readonly npcName: string;
  readonly difficulties: readonly Difficulty[];
};

export type CampaignView = {
  readonly statuses: ReadonlyMap<string, NodeStatus>;
  readonly progress: ReadonlyMap<string, NodeProgress>;
  readonly recommended: CampaignNode | null;
  readonly chapters: readonly ChapterView[];
  readonly completedNodes: number;
  readonly totalNodes: number;
};

export type ChapterView = {
  readonly chapter: Chapter;
  readonly nodes: readonly CampaignNode[];
  readonly cleared: number;
  readonly mastered: number;
  readonly unlocked: boolean;
  readonly bossCleared: boolean;
};

export function campaignView(content: ContentIndex, snap: ProfileSnapshot): CampaignView {
  const progress = progressMap(snap);
  const activeNodeId = snap.activeAttempt?.nodeId ?? null;
  const statuses = computeStatuses(content.nodeList, progress, activeNodeId);
  const chapters = content.bundle.chapters.map((chapter) => {
    const nodes = content.nodeList.filter((n) => n.chapterId === chapter.chapterId);
    const cleared = nodes.filter((n) => isCleared(progress.get(n.nodeId))).length;
    const mastered = nodes.filter((n) => statuses.get(n.nodeId) === 'MASTERED').length;
    const unlocked = nodes.some((n) => statuses.get(n.nodeId) !== 'LOCKED');
    const boss = nodes.find((n) => n.kind === 'BOSS');
    return { chapter, nodes, cleared, mastered, unlocked, bossCleared: boss ? isCleared(progress.get(boss.nodeId)) : false };
  });
  return {
    statuses, progress, recommended: recommendedNode(content.nodeList, statuses), chapters,
    completedNodes: content.nodeList.filter((n) => isCleared(progress.get(n.nodeId))).length, totalNodes: content.nodeList.length,
  };
}

export function nodeView(content: ContentIndex, snap: ProfileSnapshot, nodeId: string): NodeView | null {
  const node = content.nodes.get(nodeId);
  if (!node) return null;
  const progress = progressMap(snap);
  const own = progress.get(nodeId) ?? EMPTY_PROGRESS;
  const statuses = computeStatuses(content.nodeList, progress, snap.activeAttempt?.nodeId ?? null);
  const done = new Set(own.completedObjectiveIds);
  const objectives: ObjectiveView[] = applicableObjectiveIds(node)
    .map((id) => content.objectives.get(id))
    .filter((o): o is Objective => !!o)
    .map((objective) => ({ objective, done: done.has(objective.objectiveId), kind: objective.objectiveId === node.completionObjectiveId ? 'COMPLETION' : 'OPTIONAL' }));
  return {
    node, status: statuses.get(nodeId) ?? 'LOCKED', progress: own, objectives,
    firstClearGranted: snap.grants.includes(firstClearKey(content.bundle.campaignId, nodeId)),
    assistance: assistanceLevel(own),
    npcName: content.npcs.get(node.npcId)?.name ?? node.npcId,
    difficulties: node.difficultyProfiles ? (Object.keys(node.difficultyProfiles) as Difficulty[]) : [],
  };
}

export type ContinueTarget =
  | { readonly kind: 'RESUME_ATTEMPT'; readonly attemptId: string; readonly nodeId: string | null }
  | { readonly kind: 'PENDING_REWARD'; readonly rewardId: string }
  | { readonly kind: 'NODE'; readonly nodeId: string; readonly chapterId: ChapterId }
  | { readonly kind: 'COMPLETED' };

/** Prioridade de retomada (interface §6.5): tentativa → prêmio pendente → próximo nó principal. */
export function continueTarget(content: ContentIndex, snap: ProfileSnapshot): ContinueTarget {
  if (snap.activeAttempt) return { kind: 'RESUME_ATTEMPT', attemptId: snap.activeAttempt.attemptId, nodeId: snap.activeAttempt.nodeId };
  const pending = snap.pendingRewards.find((r) => r.status === 'PENDING');
  if (pending) return { kind: 'PENDING_REWARD', rewardId: pending.rewardId };
  const view = campaignView(content, snap);
  if (view.recommended) return { kind: 'NODE', nodeId: view.recommended.nodeId, chapterId: view.recommended.chapterId };
  return { kind: 'COMPLETED' };
}

export function arenaList(content: ContentIndex, snap: ProfileSnapshot): CampaignNode[] {
  return arenaOpponents(content.nodeList, progressMap(snap));
}

/** Desafios: tutoriais, puzzles e elites desbloqueados (interface §17.1). */
export function challengeList(content: ContentIndex, snap: ProfileSnapshot): { node: CampaignNode; status: NodeStatus }[] {
  const view = campaignView(content, snap);
  return content.nodeList
    .filter((n) => n.kind === 'TUTORIAL' || n.kind === 'PUZZLE' || n.kind === 'ELITE')
    .map((node) => ({ node, status: view.statuses.get(node.nodeId) ?? 'LOCKED' as NodeStatus }));
}

/** Créditos já obtidos e ainda disponíveis em objetivos (painel de objetivos, interface §18). */
export function objectiveSummary(content: ContentIndex, snap: ProfileSnapshot): { done: number; total: number; creditsEarned: number; creditsAvailable: number } {
  let done = 0; let total = 0; let creditsEarned = 0; let creditsAvailable = 0;
  const granted = new Set(snap.grants);
  for (const o of content.bundle.objectives) {
    total++;
    if (granted.has(o.grantKey)) { done++; creditsEarned += o.reward.credits; } else creditsAvailable += o.reward.credits;
  }
  return { done, total, creditsEarned, creditsAvailable };
}
