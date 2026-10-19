// Montagem do AiJob na thread principal (gameplay §25.2: getObservation). Este é o único ponto que toca o
// estado completo; o job resultante leva somente a projeção autorizada do NPC, a lista do próprio deck, as
// cartas adversárias já vistas publicamente e o aiRng independente (G-053, R-034).
import type { AiJob } from '../../application/ports/ai.ts';
import type { AiProfile } from '../../content/types.ts';
import { getPlayerView } from '../battle/engine.ts';
import type { CatalogLookup, MatchState, PlayerId } from '../battle/types.ts';
import { other } from '../battle/types.ts';
import type { BattleView } from '../battle/views.ts';
import type { RngState } from '../random/rng.ts';
import { visibleKeys } from './determinize.ts';

/** Definições do adversário visíveis agora (campo, Ferramentas, descarte, Estádio dele). */
export function publicOpponentKeys(view: BattleView): string[] {
  return visibleKeys(view, other(view.viewer));
}

/** Memória pública acumulada: une o que já foi visto com o que está visível nesta observação. */
export function rememberSeen(previous: readonly string[], view: BattleView): string[] {
  const out = [...previous];
  const counts = new Map<string, number>();
  for (const key of out) counts.set(key, (counts.get(key) ?? 0) + 1);
  const now = new Map<string, number>();
  for (const key of publicOpponentKeys(view)) now.set(key, (now.get(key) ?? 0) + 1);
  // Guarda a maior quantidade simultânea já observada de cada definição.
  for (const [key, n] of [...now.entries()].sort()) {
    for (let i = counts.get(key) ?? 0; i < n; i += 1) out.push(key);
  }
  return out;
}

export type CreateAiJobInput = {
  readonly state: MatchState;
  readonly catalog: CatalogLookup;
  readonly aiPlayer: PlayerId;
  readonly profile: AiProfile;
  readonly aiRng: RngState;
  readonly jobId: string;
  readonly attemptId: string;
  readonly writerEpoch: number;
  /** Cartas do humano reveladas antes (memória pública do NPC). */
  readonly seenOpponentCards?: readonly string[];
};

export function createAiJob(input: CreateAiJobInput): AiJob {
  const { state, catalog, aiPlayer } = input;
  const observation = getPlayerView(state, catalog, aiPlayer);
  const ownDeckList = Object.values(state.cards).filter((c) => c.owner === aiPlayer).map((c) => c.definitionKey).sort();
  return {
    type: 'PLAN_ACTION',
    jobId: input.jobId,
    attemptId: input.attemptId,
    stateRevision: state.stateVersion,
    writerEpoch: input.writerEpoch,
    aiProfile: input.profile,
    observation,
    knowledge: { ownDeckList, seenOpponentCards: rememberSeen(input.seenOpponentCards ?? [], observation) },
    aiRng: input.aiRng,
  };
}
