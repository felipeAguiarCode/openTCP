// Relógio de apresentação (runtime §19.6): todas as durações são tempo de apresentação. Pausa congela;
// ao voltar de aba oculta a referência é reiniciada — nunca se aplica um delta de minutos num frame.

export type PresentationClock = {
  /** Recebe o carimbo do frame (ms) e devolve o delta de apresentação a aplicar. */
  readonly tick: (nowMs: number) => number;
  readonly pause: () => void;
  readonly resume: () => void;
  readonly isPaused: () => boolean;
  /** Esquece o último carimbo (visibilitychange, retomada de contexto). */
  readonly resetReference: () => void;
  readonly now: () => number;
};

export type ClockOptions = {
  /** Deltas acima deste limite são tratados como um frame comum (aba oculta, breakpoint, GC). */
  readonly maxDeltaMs?: number;
  readonly fallbackFrameMs?: number;
};

export function createPresentationClock(options: ClockOptions = {}): PresentationClock {
  const maxDelta = options.maxDeltaMs ?? 250;
  const fallback = options.fallbackFrameMs ?? 1000 / 60;
  let last: number | null = null;
  let paused = false;
  let time = 0;
  return {
    tick: (nowMs) => {
      if (last === null) {
        last = nowMs;
        return 0;
      }
      let dt = nowMs - last;
      last = nowMs;
      if (paused) return 0;
      if (!Number.isFinite(dt) || dt < 0) dt = 0;
      if (dt > maxDelta) dt = fallback;
      time += dt;
      return dt;
    },
    pause: () => {
      paused = true;
    },
    resume: () => {
      paused = false;
      last = null;
    },
    isPaused: () => paused,
    resetReference: () => {
      last = null;
    },
    now: () => time,
  };
}
