// Estados de nó derivados (campanha §2, §20.4; gameplay §24.6) e progresso persistido por nó.
import type { CampaignNode } from '../../content/types.ts';

export type NodeStatus = 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'CLEARED' | 'MASTERED';

/** progress_json por nó (persistencia §17). */
export type NodeProgress = {
  readonly firstClearAttemptId: string | null;
  readonly clearedDifficulties: readonly string[];
  readonly completedObjectiveIds: readonly string[];
  readonly bestHumanTurnCount: number | null;
  readonly wins: number;
  readonly losses: number;
  readonly consecutiveLosses: number;
  readonly discoveryChoice: string | null;
};

export const EMPTY_PROGRESS: NodeProgress = {
  firstClearAttemptId: null, clearedDifficulties: [], completedObjectiveIds: [], bestHumanTurnCount: null,
  wins: 0, losses: 0, consecutiveLosses: 0, discoveryChoice: null,
};

export function isCleared(progress: NodeProgress | undefined): boolean {
  return !!progress && (progress.firstClearAttemptId !== null || progress.discoveryChoice !== null);
}

export function applicableObjectiveIds(node: CampaignNode): string[] {
  return [node.completionObjectiveId, ...node.optionalObjectiveIds].filter((x): x is string => !!x);
}

export function nodeStatus(node: CampaignNode, progress: ReadonlyMap<string, NodeProgress>, activeNodeId: string | null): NodeStatus {
  const own = progress.get(node.nodeId);
  if (activeNodeId === node.nodeId) return 'IN_PROGRESS';
  if (isCleared(own)) {
    const required = applicableObjectiveIds(node);
    const done = new Set(own!.completedObjectiveIds);
    if (node.kind === 'DISCOVERY' || (required.length > 0 && required.every((id) => done.has(id)))) return 'MASTERED';
    return 'CLEARED';
  }
  return node.prerequisites.allOf.every((id) => isCleared(progress.get(id))) ? 'AVAILABLE' : 'LOCKED';
}

export function computeStatuses(nodes: readonly CampaignNode[], progress: ReadonlyMap<string, NodeProgress>, activeNodeId: string | null): Map<string, NodeStatus> {
  return new Map(nodes.map((n) => [n.nodeId, nodeStatus(n, progress, activeNodeId)]));
}

/** Nó recomendado para “Continuar”: primeiro essencial disponível na ordem da campanha. */
export function recommendedNode(nodes: readonly CampaignNode[], statuses: ReadonlyMap<string, NodeStatus>): CampaignNode | null {
  return nodes.find((n) => n.essential && statuses.get(n.nodeId) === 'AVAILABLE')
    ?? nodes.find((n) => statuses.get(n.nodeId) === 'AVAILABLE') ?? null;
}

export function validateGraph(nodes: readonly CampaignNode[]): string[] {
  const errors: string[] = [];
  const ids = new Set(nodes.map((n) => n.nodeId));
  if (ids.size !== nodes.length) errors.push('IDs de nó duplicados');
  for (const n of nodes) for (const p of n.prerequisites.allOf) if (!ids.has(p)) errors.push(`${n.nodeId}: pré-requisito inexistente ${p}`);
  const visiting = new Set<string>();
  const done = new Set<string>();
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));
  const visit = (id: string): void => {
    if (done.has(id)) return;
    if (visiting.has(id)) { errors.push(`ciclo em ${id}`); return; }
    visiting.add(id);
    for (const p of byId.get(id)?.prerequisites.allOf ?? []) visit(p);
    visiting.delete(id);
    done.add(id);
  };
  nodes.forEach((n) => visit(n.nodeId));
  return errors;
}

/** Arena libera NPCs de duelos já vencidos após C01-E06 (campanha §18.1). */
export function arenaOpponents(nodes: readonly CampaignNode[], progress: ReadonlyMap<string, NodeProgress>): CampaignNode[] {
  if (!isCleared(progress.get('C01-E06'))) return [];
  return nodes.filter((n) => ['DUEL', 'ELITE', 'BOSS', 'FINAL'].includes(n.kind) && isCleared(progress.get(n.nodeId)));
}

/** Assistência após derrotas consecutivas (campanha §14.2). */
export function assistanceLevel(progress: NodeProgress | undefined): 'NONE' | 'SUGGEST_STORY' | 'HIGHLIGHT_SUPPORT' {
  const losses = progress?.consecutiveLosses ?? 0;
  if (losses >= 4) return 'HIGHLIGHT_SUPPORT';
  if (losses >= 2) return 'SUGGEST_STORY';
  return 'NONE';
}
