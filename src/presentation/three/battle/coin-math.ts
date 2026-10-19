// Moeda não é gerador aleatório (runtime §19.9): a trajetória é decorativa e termina exatamente na face
// confirmada pelo domínio, em qualquer velocidade. Pura e testável.
import { EASINGS } from '../../animation/easing.ts';
import { phaseProgress, presetDurationMs } from '../../animation/catalog.ts';

export type CoinFace = 'HEADS' | 'TAILS';

export function coinFinalAngle(face: CoinFace): number {
  return face === 'HEADS' ? 0 : Math.PI;
}

export type CoinPose = { readonly angle: number; readonly lift: number; readonly scale: number; readonly showResult: boolean };

/** Pose da moeda no instante `baseMs` do preset (tempo Normal). Em baseMs ≥ duração: face final exata. */
export function coinPoseAt(presetId: 'COIN_FIRST' | 'COIN_NEXT', baseMs: number, face: CoinFace, spins = presetId === 'COIN_FIRST' ? 4 : 2): CoinPose {
  const total = spins * Math.PI * 2 + coinFinalAngle(face);
  const duration = presetDurationMs(presetId);
  if (baseMs >= duration) return { angle: total, lift: 0, scale: 1, showResult: true };
  if (presetId === 'COIN_FIRST') {
    const toss = phaseProgress('COIN_FIRST', 'TOSS', baseMs);
    const rotate = phaseProgress('COIN_FIRST', 'ROTATE', baseMs);
    const land = phaseProgress('COIN_FIRST', 'LAND', baseMs);
    const result = phaseProgress('COIN_FIRST', 'RESULT', baseMs);
    const a1 = spins * Math.PI * 2 * 0.12;
    const a2 = spins * Math.PI * 2 * 0.86;
    let angle = a1 * toss;
    if (rotate > 0) angle = a1 + (a2 - a1) * rotate;
    if (land > 0) angle = a2 + (total - a2) * land;
    const lift = land > 0 ? 1 - land : toss;
    return { angle, lift: Math.max(0, lift), scale: 1 + 0.06 * Math.sin(Math.PI * result), showResult: result > 0 };
  }
  const u = Math.min(1, Math.max(0, baseMs / duration));
  return { angle: total * EASINGS.easeOutCubic(u), lift: Math.sin(Math.PI * u) * 0.6, scale: 1, showResult: u > 0.85 };
}

/** Ângulo normalizado em [0, 2π) — usado para confirmar a face visível. */
export function normalizeAngle(angle: number): number {
  const twoPi = Math.PI * 2;
  return ((angle % twoPi) + twoPi) % twoPi;
}

export function visibleFace(angle: number): CoinFace {
  const a = normalizeAngle(angle);
  return a < Math.PI / 2 || a > (3 * Math.PI) / 2 ? 'HEADS' : 'TAILS';
}
