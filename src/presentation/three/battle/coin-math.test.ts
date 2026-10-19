// A moeda só apresenta o resultado confirmado: a pose final mostra exatamente a face recebida.
import { describe, expect, it } from 'vitest';
import { presetDurationMs } from '../../animation/catalog.ts';
import { coinPoseAt, visibleFace } from './coin-math.ts';

describe.each(['COIN_FIRST', 'COIN_NEXT'] as const)('%s', (preset) => {
  it.each(['HEADS', 'TAILS'] as const)('termina na face %s', (face) => {
    const end = coinPoseAt(preset, presetDurationMs(preset), face);
    expect(visibleFace(end.angle)).toBe(face);
    expect(end.showResult).toBe(true);
    expect(end.lift).toBe(0);
  });

  it('trajetória contínua (sem saltos) e sem resultado no início', () => {
    const d = presetDurationMs(preset);
    let prev = coinPoseAt(preset, 0, 'TAILS').angle;
    expect(coinPoseAt(preset, 0, 'TAILS').showResult).toBe(false);
    for (let t = 5; t <= d; t += 5) {
      const a = coinPoseAt(preset, t, 'TAILS').angle;
      expect(Math.abs(a - prev)).toBeLessThan(Math.PI / 2);
      prev = a;
    }
  });
});
