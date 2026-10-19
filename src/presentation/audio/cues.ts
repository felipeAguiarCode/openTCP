// Catálogo de cues e regras puras de reprodução (interface §9.12, §36.5; runtime §20.4). Grupos da spec;
// cada cue aponta para um arquivo local (slot) — `null` = slot ainda sem arquivo, que nunca bloqueia o jogo.
// O portão garante: uma chave por evento (pular/restaurar não repete som), limite de vozes por grupo e
// intervalo mínimo por cue (compras em grupo não viram rajada).

export type AudioGroup = 'music' | 'ambient' | 'ui' | 'cards' | 'energy' | 'attacks' | 'coins' | 'reveals';

export type CueId =
  | 'ui.tap' | 'ui.confirm' | 'ui.error' | 'ui.toast'
  | 'card.draw' | 'card.play' | 'card.evolve' | 'card.shuffle' | 'card.trainer'
  | 'energy.attach' | 'energy.zone'
  | 'attack.hit' | 'attack.hit.weak' | 'attack.prevented' | 'attack.knockout' | 'attack.points' | 'attack.status' | 'attack.heal'
  | 'coin.flip' | 'coin.heads' | 'coin.tails'
  | 'turn.mine' | 'turn.theirs' | 'match.win' | 'match.loss'
  | 'pack.tear' | 'pack.reveal' | 'pack.reveal.special' | 'pack.summary'
  | 'music.menu' | 'music.battle' | 'ambient.table';

export type CueSpec = {
  readonly group: AudioGroup;
  /** Caminho relativo a `audio/` no pacote; null = slot sem arquivo (placeholder). */
  readonly file: string | null;
  readonly gain: number;
  readonly cooldownMs: number;
  readonly loop?: boolean;
};

const cue = (group: AudioGroup, gain = 1, cooldownMs = 40, loop = false): CueSpec => ({ group, file: null, gain, cooldownMs, ...(loop ? { loop } : {}) });

export const CUES: Readonly<Record<CueId, CueSpec>> = {
  'ui.tap': cue('ui', 0.6, 30), 'ui.confirm': cue('ui', 0.8), 'ui.error': cue('ui', 0.8, 200), 'ui.toast': cue('ui', 0.5, 300),
  'card.draw': cue('cards', 0.6, 70), 'card.play': cue('cards', 0.8), 'card.evolve': cue('cards', 1), 'card.shuffle': cue('cards', 0.7, 400), 'card.trainer': cue('cards', 0.8),
  'energy.attach': cue('energy', 0.9), 'energy.zone': cue('energy', 0.5, 200),
  'attack.hit': cue('attacks', 1, 60), 'attack.hit.weak': cue('attacks', 1, 60), 'attack.prevented': cue('attacks', 0.8, 60), 'attack.knockout': cue('attacks', 1, 200),
  'attack.points': cue('attacks', 1, 200), 'attack.status': cue('attacks', 0.8, 80), 'attack.heal': cue('attacks', 0.8, 80),
  'coin.flip': cue('coins', 0.9, 80), 'coin.heads': cue('coins', 0.9, 80), 'coin.tails': cue('coins', 0.9, 80),
  'turn.mine': cue('ui', 0.7, 300), 'turn.theirs': cue('ui', 0.5, 300), 'match.win': cue('reveals', 1, 1000), 'match.loss': cue('reveals', 0.9, 1000),
  'pack.tear': cue('reveals', 1, 300), 'pack.reveal': cue('reveals', 0.8, 90), 'pack.reveal.special': cue('reveals', 1, 300), 'pack.summary': cue('reveals', 0.8, 500),
  'music.menu': cue('music', 0.6, 0, true), 'music.battle': cue('music', 0.6, 0, true), 'ambient.table': cue('ambient', 0.4, 0, true),
};

/** Vozes simultâneas por grupo (compra em grupo, múltiplos alvos e moedas não se empilham). */
export const MAX_VOICES: Readonly<Record<AudioGroup, number>> = { music: 1, ambient: 1, ui: 3, cards: 3, energy: 2, attacks: 3, coins: 2, reveals: 2 };

/** Volume do grupo a partir das preferências da interface (Música, Batalha, Interface, Pacotes). */
export type VolumePrefs = { readonly volumeMusic: number; readonly volumeBattle: number; readonly volumeUi: number; readonly volumePacks: number };

export function groupVolume(group: AudioGroup, prefs: VolumePrefs): number {
  const v = group === 'music' || group === 'ambient' ? prefs.volumeMusic
    : group === 'ui' ? prefs.volumeUi
    : group === 'reveals' ? prefs.volumePacks
    : prefs.volumeBattle;
  return Math.min(1, Math.max(0, v));
}

/** Slots ainda sem arquivo (relatório de placeholders do pacote). */
export function placeholderCues(): CueId[] {
  return (Object.keys(CUES) as CueId[]).filter((id) => CUES[id].file === null);
}

/** Cue sonoro de um sinal da mesa (2D ou 3D). Nunca há som específico para informação oculta do NPC. */
export type BattleSignal =
  | { readonly kind: 'TURN_BANNER'; readonly mine: boolean }
  | { readonly kind: 'DAMAGE'; readonly amount: number; readonly prevented: boolean; readonly weakness?: boolean }
  | { readonly kind: 'HEAL' } | { readonly kind: 'STATUS' } | { readonly kind: 'KNOCKOUT' } | { readonly kind: 'POINTS' }
  | { readonly kind: 'COIN_RESULT'; readonly face: 'HEADS' | 'TAILS' }
  | { readonly kind: 'DRAW' } | { readonly kind: 'SHUFFLE' } | { readonly kind: 'TRAINER' } | { readonly kind: 'ABILITY' }
  | { readonly kind: 'PLAY' } | { readonly kind: 'EVOLVE' } | { readonly kind: 'ENERGY' }
  | { readonly kind: 'RESULT'; readonly won: boolean | null };

export function cueForSignal(s: BattleSignal): CueId | null {
  switch (s.kind) {
    case 'TURN_BANNER': return s.mine ? 'turn.mine' : 'turn.theirs';
    case 'DAMAGE': return s.prevented || s.amount <= 0 ? 'attack.prevented' : s.weakness ? 'attack.hit.weak' : 'attack.hit';
    case 'HEAL': return 'attack.heal';
    case 'STATUS': return 'attack.status';
    case 'KNOCKOUT': return 'attack.knockout';
    case 'POINTS': return 'attack.points';
    case 'COIN_RESULT': return s.face === 'HEADS' ? 'coin.heads' : 'coin.tails';
    case 'DRAW': return 'card.draw';
    case 'SHUFFLE': return 'card.shuffle';
    case 'TRAINER': return 'card.trainer';
    case 'ABILITY': return 'card.play';
    case 'PLAY': return 'card.play';
    case 'EVOLVE': return 'card.evolve';
    case 'ENERGY': return 'energy.attach';
    case 'RESULT': return s.won === null ? null : s.won ? 'match.win' : 'match.loss';
  }
}

export type GateDecision = { readonly play: true } | { readonly play: false; readonly reason: 'DUPLICATE_KEY' | 'COOLDOWN' | 'VOICES' | 'SKIPPED' | 'MUTED' };

export type CueGate = {
  /** Decide se o cue toca agora; registra chave, cooldown e voz quando toca. */
  readonly request: (id: CueId, opts: { readonly now: number; readonly key?: string; readonly skipped?: boolean; readonly durationMs?: number; readonly volume: number }) => GateDecision;
  /** Marca chaves como já apresentadas sem tocar (retomada, reconstrução). */
  readonly markPresented: (keys: readonly string[]) => void;
};

/** Portão puro: chave idempotente por evento, intervalo mínimo por cue e vozes por grupo. */
export function createCueGate(keyLimit = 4096): CueGate {
  const keys = new Set<string>();
  const lastAt = new Map<CueId, number>();
  const voices = new Map<AudioGroup, number[]>();
  const remember = (k: string) => {
    keys.add(k);
    if (keys.size > keyLimit) keys.delete(keys.values().next().value as string);
  };
  return {
    request: (id, { now, key, skipped, durationMs = 600, volume }) => {
      if (key && keys.has(key)) return { play: false, reason: 'DUPLICATE_KEY' };
      if (key) remember(key);
      // Pular apresentação marca o evento como apresentado, mas não toca (UI-129, R-075).
      if (skipped) return { play: false, reason: 'SKIPPED' };
      if (volume <= 0) return { play: false, reason: 'MUTED' };
      const spec = CUES[id];
      const last = lastAt.get(id);
      if (last !== undefined && now - last < spec.cooldownMs) return { play: false, reason: 'COOLDOWN' };
      const active = (voices.get(spec.group) ?? []).filter((end) => end > now);
      if (active.length >= MAX_VOICES[spec.group]) { voices.set(spec.group, active); return { play: false, reason: 'VOICES' }; }
      active.push(now + durationMs);
      voices.set(spec.group, active);
      lastAt.set(id, now);
      return { play: true };
    },
    markPresented: (list) => list.forEach(remember),
  };
}
