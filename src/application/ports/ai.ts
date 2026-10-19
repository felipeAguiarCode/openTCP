// Porta da IA local (gameplay §25, runtime §11). O job carrega apenas a observação autorizada do NPC:
// nunca a mão humana, a ordem real dos baralhos ou a semente de batalha (G-053, R-034).
import type { Action } from '../../domain/battle/types.ts';
import type { BattleView } from '../../domain/battle/views.ts';
import type { RngState } from '../../domain/random/rng.ts';
import type { AiProfile } from '../../content/types.ts';

export type AiKnowledge = {
  /** Lista de definições do próprio deck do NPC (conhecida por ele). */
  readonly ownDeckList: readonly string[];
  /** Definições do humano já vistas publicamente nesta partida (campo, descarte, revelações). */
  readonly seenOpponentCards: readonly string[];
};

export type AiJob = {
  readonly type: 'PLAN_ACTION';
  readonly jobId: string;
  readonly attemptId: string;
  readonly stateRevision: number;
  readonly writerEpoch: number;
  readonly aiProfile: AiProfile;
  readonly observation: BattleView;
  readonly knowledge: AiKnowledge;
  readonly aiRng: RngState;
};

export type AiResult = {
  readonly jobId: string;
  readonly attemptId: string;
  readonly stateRevision: number;
  readonly writerEpoch: number;
  readonly action: Action;
  readonly aiRng: RngState;
  readonly nodesExplored: number;
  readonly fallback: boolean;
};

export type AiPort = {
  readonly plan: (job: AiJob) => Promise<AiResult>;
  readonly cancel: (jobId: string) => void;
  readonly dispose: () => void;
};
