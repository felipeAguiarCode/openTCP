// Partidas locais conduzidas pela IA (laboratório, calibração e testes de aceitação G-052). Cada ação da IA
// passa pelo mesmo validador do motor sobre o estado real antes de ser aplicada.
import type { AiResult } from '../../application/ports/ai.ts';
import type { AiProfile } from '../../content/types.ts';
import { applyAction, getLegalActions, validateAction } from '../battle/engine.ts';
import type { Action, MatchState, PlayerId } from '../battle/types.ts';
import { getPlayerView } from '../battle/views.ts';
import { seedRng, uniformInt, type RngState } from '../random/rng.ts';
import type { PlannerCatalog } from './determinize.ts';
import { createAiJob, rememberSeen } from './observation.ts';
import { planAction } from './planner.ts';

export type Controller =
  | { readonly kind: 'AI'; readonly profile: AiProfile }
  | { readonly kind: 'RANDOM' };

export type PlanRecord = {
  readonly player: PlayerId;
  readonly policy: AiProfile['policy'];
  readonly ms: number;
  readonly nodes: number;
  readonly fallback: boolean;
  readonly action: Action;
};

export type SelfPlayResult = {
  readonly state: MatchState;
  readonly steps: number;
  readonly illegal: readonly { readonly player: PlayerId; readonly action: Action; readonly code: string }[];
  readonly plans: readonly PlanRecord[];
};

export type SelfPlayInput = {
  readonly initial: MatchState;
  readonly catalog: PlannerCatalog;
  readonly controllers: Readonly<Record<PlayerId, Controller>>;
  readonly seed: number;
  readonly maxSteps?: number;
  readonly clock?: () => number;
  /** Observa cada resultado da IA (ex.: verificar determinismo do job). */
  readonly onPlan?: (job: ReturnType<typeof createAiJob>, result: AiResult) => void;
  /** Observa cada ação aplicada, com o estado antes e depois (ex.: métricas de agressividade). */
  readonly onStep?: (before: MatchState, actor: PlayerId, action: Action, after: MatchState) => void;
};

function actorOf(state: MatchState): PlayerId {
  const pending = state.pendingDecisions.find((d) => !d.answered);
  return pending ? pending.player : state.currentPlayer;
}

export function playMatch(input: SelfPlayInput): SelfPlayResult {
  const { catalog, controllers } = input;
  const clock = input.clock ?? (() => 0);
  let state = input.initial;
  let driver = seedRng(input.seed ^ 0x2545f491);
  const aiRng: Record<PlayerId, RngState> = { A: seedRng(input.seed * 2 + 1), B: seedRng(input.seed * 2 + 2) };
  const seen: Record<PlayerId, string[]> = { A: [], B: [] };
  const illegal: { player: PlayerId; action: Action; code: string }[] = [];
  const plans: PlanRecord[] = [];
  let steps = 0;
  const maxSteps = input.maxSteps ?? 4000;
  while (!state.result && steps < maxSteps) {
    steps += 1;
    const actor = actorOf(state);
    const controller = controllers[actor];
    let action: Action;
    if (controller.kind === 'RANDOM') {
      const legal = getLegalActions(state, catalog, actor);
      if (legal.length === 0) throw new Error(`sem ações legais para ${actor} em ${state.phase}`);
      const r = uniformInt(driver, legal.length);
      driver = r.rng;
      action = legal[r.value]!;
    } else {
      const job = createAiJob({
        state, catalog, aiPlayer: actor, profile: controller.profile, aiRng: aiRng[actor],
        jobId: `job-${steps}`, attemptId: 'selfplay', writerEpoch: 1, seenOpponentCards: seen[actor],
      });
      const t0 = clock();
      const result = planAction({ job, catalog, clock: input.clock });
      const ms = clock() - t0;
      input.onPlan?.(job, result);
      aiRng[actor] = result.aiRng;
      seen[actor] = [...job.knowledge.seenOpponentCards];
      plans.push({ player: actor, policy: controller.profile.policy, ms, nodes: result.nodesExplored, fallback: result.fallback, action: result.action });
      action = result.action;
      const verdict = validateAction(state, catalog, action);
      if (!verdict.ok) {
        illegal.push({ player: actor, action, code: verdict.code });
        // Ação ilegal do planejador: o app aplicaria o fallback seguro; aqui encerramos o turno legalmente.
        const legal = getLegalActions(state, catalog, actor);
        action = legal.find((a) => a.type === 'END_TURN') ?? legal[0]!;
      }
    }
    const applied = applyAction(state, catalog, action);
    if (!applied.ok) throw new Error(`ação rejeitada ${applied.code}: ${JSON.stringify(action)}`);
    input.onStep?.(state, actor, action, applied.state);
    state = applied.state;
    for (const p of ['A', 'B'] as const) {
      if (controllers[p].kind === 'AI') seen[p] = rememberSeen(seen[p], getPlayerView({ s: state, cat: catalog }, p, false));
    }
  }
  return { state, steps, illegal, plans };
}
