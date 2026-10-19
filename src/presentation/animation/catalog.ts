// Catálogo de presets (38 de jogo + uiPresets) e coreografias (fases com easing), carregados das cópias
// byte a byte de .specs/examples (ver catalog.test.ts). Validação na carga: IDs, easings e somas.
import presetsData from './data/animation-presets.json';
import choreographyData from './data/motion-choreography.json';
import { EASINGS, isEasingId, type EasingId } from './easing.ts';

export const PRESENTATION_VERSION = 'pocket-light-v1';

export const PRESET_IDS = [
  'BOARD_INTRO', 'INITIAL_DEAL', 'SETUP_REVEAL', 'TURN_BANNER', 'PLAYMAT_TRANSITION', 'DRAW_SELF', 'DRAW_OPPONENT',
  'DRAW_BATCH', 'PLAY_BASIC', 'PLAY_SPECIAL', 'EVOLVE', 'PLAY_ITEM', 'PLAY_SUPPORTER', 'ATTACH_TOOL', 'PLAY_STADIUM',
  'ATTACH_ENERGY', 'ABILITY_FOCUS', 'RETREAT', 'SWITCH', 'PROMOTE', 'ATTACK_FOCUS', 'ATTACK_STANDARD', 'ATTACK_SPECIAL',
  'DAMAGE_FEEDBACK', 'HEAL_FEEDBACK', 'STATUS_FEEDBACK', 'COIN_FIRST', 'COIN_NEXT', 'KNOCKOUT', 'POINTS', 'DISCARD',
  'RETURN_TO_HAND', 'SHUFFLE', 'PACK_TEAR', 'PACK_EXTRACT', 'PACK_REVEAL', 'PACK_REVEAL_SPECIAL', 'RESULT_TRANSITION',
] as const;
export type PresetId = (typeof PRESET_IDS)[number];

export const UI_PRESET_IDS = ['UI_HOVER', 'UI_DRAWER', 'UI_DRAG_RETURN', 'DUEL_INTRO'] as const;
export type UiPresetId = (typeof UI_PRESET_IDS)[number];

export type PresetDefinition = {
  readonly id: PresetId;
  readonly description: string;
  readonly durationMs: number;
  readonly includes: readonly PresetId[];
  readonly excludes: readonly PresetId[];
};

export type ChoreographyPhase = {
  readonly phaseId: string;
  readonly startMs: number;
  readonly durationMs: number;
  readonly endMs: number;
  readonly easing: EasingId;
};

export type Choreography = {
  readonly presetId: PresetId;
  readonly totalMs: number;
  readonly phases: readonly ChoreographyPhase[];
};

export type ModeConfig = {
  readonly fastMultiplier: number;
  readonly fastMinimumMs: number;
  readonly reducedMaximumMs: number;
};

function isPresetId(value: unknown): value is PresetId {
  return typeof value === 'string' && (PRESET_IDS as readonly string[]).includes(value);
}

function loadPresets(): ReadonlyMap<PresetId, PresetDefinition> {
  const map = new Map<PresetId, PresetDefinition>();
  for (const raw of presetsData.presets) {
    if (!isPresetId(raw.id)) throw new Error(`animation-presets: preset desconhecido ${raw.id}`);
    if (map.has(raw.id)) throw new Error(`animation-presets: preset duplicado ${raw.id}`);
    const includes = raw.includes.filter(isPresetId);
    const excludes = raw.excludes.filter(isPresetId);
    if (includes.length !== raw.includes.length || excludes.length !== raw.excludes.length) {
      throw new Error(`animation-presets: referência inválida em ${raw.id}`);
    }
    map.set(raw.id, { id: raw.id, description: raw.description, durationMs: raw.durationMs, includes, excludes });
  }
  for (const id of PRESET_IDS) if (!map.has(id)) throw new Error(`animation-presets: falta ${id}`);
  return map;
}

function loadChoreographies(presets: ReadonlyMap<PresetId, PresetDefinition>): ReadonlyMap<PresetId, Choreography> {
  const map = new Map<PresetId, Choreography>();
  for (const raw of choreographyData.sequences) {
    if (!isPresetId(raw.presetId)) throw new Error(`motion-choreography: preset desconhecido ${raw.presetId}`);
    const preset = presets.get(raw.presetId)!;
    if (preset.durationMs !== raw.totalMs) throw new Error(`motion-choreography: ${raw.presetId} soma ${raw.totalMs} ≠ ${preset.durationMs}`);
    let cursor = 0;
    const phases: ChoreographyPhase[] = raw.phases.map((p) => {
      if (!isEasingId(p.easing)) throw new Error(`motion-choreography: easing inválido ${p.easing}`);
      if (p.startMs !== cursor || p.endMs !== p.startMs + p.durationMs) throw new Error(`motion-choreography: fase ${p.phaseId} descontínua`);
      cursor = p.endMs;
      return { phaseId: p.phaseId, startMs: p.startMs, durationMs: p.durationMs, endMs: p.endMs, easing: p.easing };
    });
    if (cursor !== raw.totalMs) throw new Error(`motion-choreography: ${raw.presetId} fases não fecham ${raw.totalMs}`);
    map.set(raw.presetId, { presetId: raw.presetId, totalMs: raw.totalMs, phases });
  }
  return map;
}

export const PRESETS: ReadonlyMap<PresetId, PresetDefinition> = loadPresets();
export const CHOREOGRAPHIES: ReadonlyMap<PresetId, Choreography> = loadChoreographies(PRESETS);

export const UI_PRESETS: Readonly<Record<UiPresetId, number>> = (() => {
  const out: Partial<Record<UiPresetId, number>> = {};
  for (const raw of presetsData.uiPresets) {
    if ((UI_PRESET_IDS as readonly string[]).includes(raw.id)) out[raw.id as UiPresetId] = raw.durationMs;
  }
  for (const id of UI_PRESET_IDS) if (out[id] === undefined) throw new Error(`animation-presets: falta uiPreset ${id}`);
  return out as Record<UiPresetId, number>;
})();

export const MODE_CONFIG: ModeConfig = {
  fastMultiplier: presetsData.modes.FAST.durationMultiplier,
  fastMinimumMs: presetsData.modes.FAST.minimumNonzeroDurationMs,
  reducedMaximumMs: presetsData.modes.REDUCED_MOTION.maximumFadeMs,
};

export function presetDurationMs(id: PresetId): number {
  return PRESETS.get(id)!.durationMs;
}

export function uiPresetDurationMs(id: UiPresetId): number {
  return UI_PRESETS[id];
}

export function choreographyOf(id: PresetId): Choreography | null {
  return CHOREOGRAPHIES.get(id) ?? null;
}

/** Fases efetivas: a coreografia, ou uma fase única `MAIN` (easeOutCubic em movimento; interface §36.2.1). */
export function phasesOf(id: PresetId): readonly ChoreographyPhase[] {
  const c = CHOREOGRAPHIES.get(id);
  if (c) return c.phases;
  const d = presetDurationMs(id);
  return [{ phaseId: 'MAIN', startMs: 0, durationMs: d, endMs: d, easing: 'easeOutCubic' }];
}

export type PhaseSample = { readonly phaseId: string; readonly index: number; readonly raw: number; readonly t: number };

/** Amostra a fase ativa no instante `baseMs` (tempo do preset em velocidade Normal). */
export function samplePhase(id: PresetId, baseMs: number): PhaseSample {
  const phases = phasesOf(id);
  for (let i = 0; i < phases.length; i += 1) {
    const p = phases[i]!;
    if (baseMs < p.endMs || i === phases.length - 1) {
      const raw = p.durationMs <= 0 ? 1 : Math.min(1, Math.max(0, (baseMs - p.startMs) / p.durationMs));
      return { phaseId: p.phaseId, index: i, raw, t: EASINGS[p.easing](raw) };
    }
  }
  return { phaseId: 'MAIN', index: 0, raw: 1, t: 1 };
}

/** Progresso suavizado (0 antes, 1 depois) de uma fase nomeada; fase ausente → progresso linear do preset. */
export function phaseProgress(id: PresetId, phaseId: string, baseMs: number): number {
  const phase = phasesOf(id).find((p) => p.phaseId === phaseId);
  if (!phase) {
    const d = presetDurationMs(id);
    return d <= 0 ? 1 : Math.min(1, Math.max(0, baseMs / d));
  }
  if (baseMs <= phase.startMs) return 0;
  if (baseMs >= phase.endMs) return 1;
  return EASINGS[phase.easing]((baseMs - phase.startMs) / phase.durationMs);
}

export function phaseStartMs(id: PresetId, phaseId: string): number | null {
  return phasesOf(id).find((p) => p.phaseId === phaseId)?.startMs ?? null;
}
