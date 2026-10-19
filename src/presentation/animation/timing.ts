// Velocidade e movimento reduzido (interface §36.3): Normal ×1; Rápida ×0,55 com piso de 80 ms;
// Instantânea = poses finais; movimento reduzido limita a transição a 150 ms sem aumentar o original.
import { MODE_CONFIG } from './catalog.ts';

export type SpeedMode = 'NORMAL' | 'FAST' | 'INSTANT';
export type MotionMode = 'FULL' | 'REDUCED' | 'NONE';

export type MotionOptions = { readonly speed: SpeedMode; readonly reducedMotion: boolean };

export function scaleDuration(baseMs: number, options: MotionOptions): number {
  if (options.speed === 'INSTANT' || baseMs <= 0) return 0;
  let ms = baseMs;
  if (options.speed === 'FAST') ms = Math.min(baseMs, Math.max(MODE_CONFIG.fastMinimumMs, baseMs * MODE_CONFIG.fastMultiplier));
  if (options.reducedMotion) ms = Math.min(ms, MODE_CONFIG.reducedMaximumMs);
  return ms;
}

export function motionModeOf(options: MotionOptions): MotionMode {
  if (options.speed === 'INSTANT') return 'NONE';
  return options.reducedMotion ? 'REDUCED' : 'FULL';
}
