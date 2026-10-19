// Catálogo de apresentação: cópias byte a byte das specs, 38 presets, coreografias contínuas, modos.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CHOREOGRAPHIES, MODE_CONFIG, PRESETS, PRESET_IDS, UI_PRESETS, phaseProgress, phasesOf, presetDurationMs, samplePhase,
} from './catalog.ts';
import { EASINGS } from './easing.ts';
import { motionModeOf, scaleDuration } from './timing.ts';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)));

describe('dados da apresentação = specs', () => {
  it.each([
    ['./data/animation-presets.json', '../../../.specs/examples/animation-presets.json'],
    ['./data/motion-choreography.json', '../../../.specs/examples/motion-choreography.json'],
    ['../three/data/battle-layout.json', '../../../.specs/examples/battle-layout.json'],
    ['../three/data/visual-tokens.json', '../../../.specs/examples/visual-tokens.json'],
    ['../three/data/playmats.example.json', '../../../.specs/examples/playmats.example.json'],
  ])('%s é idêntico a %s', (copy, spec) => {
    expect(read(copy).equals(read(spec))).toBe(true);
  });
});

describe('catálogo de presets e coreografias', () => {
  it('carrega os 38 presets e os presets de UI', () => {
    expect(PRESET_IDS).toHaveLength(38);
    expect(PRESETS.size).toBe(38);
    expect(UI_PRESETS.UI_HOVER).toBe(120);
    expect(UI_PRESETS.UI_DRAG_RETURN).toBe(200);
    expect(UI_PRESETS.DUEL_INTRO).toBe(2600);
  });

  it('cada coreografia tem fases contínuas que somam a duração do preset', () => {
    expect(CHOREOGRAPHIES.size).toBe(12);
    for (const [id, c] of CHOREOGRAPHIES) {
      expect(c.totalMs).toBe(presetDurationMs(id));
      let cursor = 0;
      for (const p of c.phases) {
        expect(p.startMs).toBe(cursor);
        expect(EASINGS[p.easing]).toBeTypeOf('function');
        cursor = p.endMs;
      }
      expect(cursor).toBe(c.totalMs);
    }
  });

  it('presets sem coreografia usam uma fase MAIN com easeOutCubic', () => {
    expect(CHOREOGRAPHIES.has('ATTACH_ENERGY')).toBe(false);
    const phases = phasesOf('ATTACH_ENERGY');
    expect(phases).toHaveLength(1);
    expect(phases[0]!.easing).toBe('easeOutCubic');
    expect(phases[0]!.durationMs).toBe(presetDurationMs('ATTACH_ENERGY'));
  });

  it('amostragem de fase respeita limites e easing', () => {
    const atk = phasesOf('ATTACK_STANDARD');
    const last = atk[atk.length - 1]!;
    expect(samplePhase('ATTACK_STANDARD', 0).index).toBe(0);
    expect(samplePhase('ATTACK_STANDARD', last.endMs + 50).t).toBe(1);
    const p = atk[1]!;
    expect(phaseProgress('ATTACK_STANDARD', p.phaseId, p.startMs - 1)).toBe(0);
    expect(phaseProgress('ATTACK_STANDARD', p.phaseId, p.endMs)).toBe(1);
  });
});

describe('velocidade e movimento reduzido', () => {
  it('Rápida = ×0,55 com piso de 80 ms; nunca aumenta durações curtas', () => {
    expect(MODE_CONFIG.fastMultiplier).toBe(0.55);
    expect(scaleDuration(1400, { speed: 'FAST', reducedMotion: false })).toBeCloseTo(770);
    expect(scaleDuration(120, { speed: 'FAST', reducedMotion: false })).toBe(80);
    expect(scaleDuration(60, { speed: 'FAST', reducedMotion: false })).toBe(60);
  });

  it('Instantânea zera; movimento reduzido limita a 150 ms', () => {
    expect(scaleDuration(1400, { speed: 'INSTANT', reducedMotion: false })).toBe(0);
    expect(scaleDuration(1400, { speed: 'NORMAL', reducedMotion: true })).toBe(150);
    expect(scaleDuration(100, { speed: 'NORMAL', reducedMotion: true })).toBe(100);
    expect(motionModeOf({ speed: 'INSTANT', reducedMotion: true })).toBe('NONE');
    expect(motionModeOf({ speed: 'FAST', reducedMotion: true })).toBe('REDUCED');
  });
});
