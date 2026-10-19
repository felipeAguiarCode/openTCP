// Diretor de apresentação (runtime §19.4–§19.8): agenda explícita sobre um relógio de apresentação.
// Nunca chama regras: os handlers só movem a cena para a projeção confirmada. Tokens de geração descartam
// callbacks de planos antigos; skipToBarrier é idempotente e termina na mesma reconciliação do fim normal.
import type { PresentationPlan, PresentationStep } from './plan.ts';

export type CompletionReason = 'FINISHED' | 'SKIPPED' | 'CANCELLED';

export type StepProgress = {
  /** Tempo local do passo na linha do tempo (inclui esperas). */
  readonly timelineMs: number;
  /** Tempo do preset já escalado (esperas congeladas). */
  readonly localMs: number;
  /** Progresso 0..1 do preset. */
  readonly u: number;
  /** Tempo equivalente em Normal, para amostrar fases da coreografia. */
  readonly baseMs: number;
  /** Dentro de uma espera (ex.: moedas inseridas no destaque do ataque). */
  readonly holding: boolean;
};

export type DirectorInfo = { readonly generation: number; readonly skipped: boolean };

export type DirectorHandlers = {
  readonly begin: (step: PresentationStep, info: DirectorInfo) => void;
  readonly update: (step: PresentationStep, progress: StepProgress, info: DirectorInfo) => void;
  readonly end: (step: PresentationStep, info: DirectorInfo) => void;
  readonly complete: (plan: PresentationPlan, reason: CompletionReason, info: DirectorInfo) => void;
};

export type Director = {
  readonly start: (plan: PresentationPlan, handlers: DirectorHandlers) => Promise<CompletionReason>;
  readonly advance: (dtMs: number) => void;
  readonly skipToBarrier: () => void;
  readonly cancel: () => void;
  readonly pause: () => void;
  readonly resume: () => void;
  readonly isPaused: () => boolean;
  readonly isRunning: () => boolean;
  readonly generation: () => number;
  readonly isCurrent: (generation: number) => boolean;
  /** Último evento cujo passo terminou (cursor visual). */
  readonly cursor: () => number;
  readonly elapsedMs: () => number;
  readonly activeSteps: () => readonly PresentationStep[];
  readonly plan: () => PresentationPlan | null;
};

/** Converte o tempo da linha do tempo em tempo do preset, congelando nas esperas. Pura. */
export function stepLocalTime(step: PresentationStep, elapsedMs: number): StepProgress {
  const timelineMs = Math.min(Math.max(0, elapsedMs - step.startMs), step.spanMs);
  let localMs = timelineMs;
  let holding = false;
  let consumed = 0;
  for (const hold of step.holds) {
    const holdStart = hold.atMs + consumed;
    if (timelineMs < holdStart) break;
    if (timelineMs < holdStart + hold.durationMs) {
      localMs = hold.atMs;
      holding = true;
      break;
    }
    consumed += hold.durationMs;
    localMs = timelineMs - consumed;
  }
  localMs = Math.min(localMs, step.durationMs);
  const u = step.durationMs > 0 ? localMs / step.durationMs : 1;
  return { timelineMs, localMs, u, baseMs: u * step.baseDurationMs, holding };
}

export function createDirector(): Director {
  let generation = 0;
  let current: PresentationPlan | null = null;
  let handlers: DirectorHandlers | null = null;
  let elapsed = 0;
  let started = new Set<string>();
  let ended = new Set<string>();
  let running = false;
  let paused = false;
  let cursor = 0;
  let resolve: ((reason: CompletionReason) => void) | null = null;

  const info = (skipped: boolean): DirectorInfo => ({ generation, skipped });

  function finishStep(step: PresentationStep, skipped: boolean): void {
    if (ended.has(step.stepId) || !handlers) return;
    if (!started.has(step.stepId)) {
      started.add(step.stepId);
      handlers.begin(step, info(skipped));
    }
    ended.add(step.stepId);
    handlers.end(step, info(skipped));
    const last = step.eventSeqs[step.eventSeqs.length - 1];
    if (last !== undefined) cursor = Math.max(cursor, last);
  }

  function complete(reason: CompletionReason): void {
    if (!running || !current || !handlers) return;
    running = false;
    const plan = current;
    const h = handlers;
    if (reason !== 'CANCELLED') cursor = Math.max(cursor, plan.lastEventSequence);
    h.complete(plan, reason, info(reason === 'SKIPPED'));
    const r = resolve;
    resolve = null;
    r?.(reason);
  }

  function step(dt: number): void {
    if (!running || paused || !current || !handlers) return;
    const gen = generation;
    elapsed += Math.max(0, dt);
    for (const s of current.steps) {
      if (gen !== generation || !running) return;
      if (ended.has(s.stepId)) continue;
      if (elapsed < s.startMs) continue;
      if (!started.has(s.stepId)) {
        started.add(s.stepId);
        handlers.begin(s, info(false));
      }
      if (elapsed >= s.startMs + s.spanMs) finishStep(s, false);
      else handlers.update(s, stepLocalTime(s, elapsed), info(false));
    }
    if (gen === generation && running && current.steps.every((s) => ended.has(s.stepId)) && elapsed >= current.totalMs) complete('FINISHED');
  }

  return {
    start: (plan, h) => {
      if (running) {
        // Plano anterior descartado: reconcilia até o fim confirmado antes de seguir (nunca fica preso).
        for (const s of current!.steps) finishStep(s, true);
        complete('SKIPPED');
      }
      generation += 1;
      current = plan;
      handlers = h;
      elapsed = 0;
      started = new Set();
      ended = new Set();
      running = true;
      const promise = new Promise<CompletionReason>((r) => {
        resolve = r;
      });
      if (plan.totalMs <= 0 || plan.steps.every((s) => s.spanMs <= 0)) {
        // Instantânea: poses finais imediatas; cues e histórico continuam (início + fim de cada passo).
        for (const s of plan.steps) finishStep(s, false);
        complete('FINISHED');
      } else step(0);
      return promise;
    },
    advance: (dt) => step(dt),
    skipToBarrier: () => {
      if (!running || !current) return;
      const gen = generation;
      for (const s of current.steps) {
        if (gen !== generation) return;
        finishStep(s, true);
      }
      complete('SKIPPED');
    },
    cancel: () => {
      if (!running) return;
      complete('CANCELLED');
      generation += 1;
    },
    pause: () => {
      paused = true;
    },
    resume: () => {
      paused = false;
    },
    isPaused: () => paused,
    isRunning: () => running,
    generation: () => generation,
    isCurrent: (g) => g === generation,
    cursor: () => cursor,
    elapsedMs: () => elapsed,
    activeSteps: () => (current && running ? current.steps.filter((s) => started.has(s.stepId) && !ended.has(s.stepId)) : []),
    plan: () => current,
  };
}
