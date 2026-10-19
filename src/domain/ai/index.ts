// API pública da IA local (gameplay §25, runtime §11). `planAction` é pura: recebe só o AiJob e o catálogo.
import type { AiJob, AiResult } from '../../application/ports/ai.ts';
import type { AiProfile } from '../../content/types.ts';
import type { CatalogLookup, MatchState, PlayerId } from '../battle/types.ts';
import type { RngState } from '../random/rng.ts';
import { createAiJob } from './observation.ts';
import { planAction } from './planner.ts';
import type { PlannerCatalog } from './determinize.ts';

export { planAction, isAiContentError, isLegalInObservation, fallbackAction, AI_CONTENT_ERROR, type PlanInput } from './planner.ts';
export { createAiJob, rememberSeen, publicOpponentKeys, type CreateAiJobInput } from './observation.ts';
export { DEFAULT_AI_PROFILES, STORY_PROFILE, STANDARD_PROFILE, EXPERT_PROFILE, NEUTRAL_WEIGHTS } from './profiles.ts';
export { answerDecision, ensureValidSelection } from './decisions.ts';
export { determinize, type PlannerCatalog } from './determinize.ts';
export { evaluate } from './evaluate.ts';
export { playMatch, type Controller, type SelfPlayResult, type PlanRecord } from './selfplay.ts';

/**
 * Atalho para a thread principal/testes: monta o job autorizado a partir do estado real e planeja.
 * O planejador continua recebendo apenas o job (o estado completo nunca é repassado).
 */
export function chooseAiAction(input: {
  readonly state: MatchState;
  readonly catalog: CatalogLookup | PlannerCatalog;
  readonly aiPlayer: PlayerId;
  readonly profile: AiProfile;
  readonly aiRng: RngState;
  readonly seenOpponentCards?: readonly string[];
  readonly clock?: () => number;
}): { readonly job: AiJob; readonly result: AiResult } {
  const job = createAiJob({
    state: input.state, catalog: input.catalog, aiPlayer: input.aiPlayer, profile: input.profile, aiRng: input.aiRng,
    jobId: `ai-${input.state.stateVersion}`, attemptId: 'local', writerEpoch: 0, seenOpponentCards: input.seenOpponentCards,
  });
  return { job, result: planAction({ job, catalog: input.catalog, clock: input.clock }) };
}
