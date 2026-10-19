// Mixer local (Web Audio): um ganho por grupo, desbloqueio no primeiro gesto, pausa com a sessão e
// volumes das preferências (interface §34.3, §36.5). Arquivos são locais (`audio/` do pacote); slot sem
// arquivo, navegador sem áudio ou falha de decodificação nunca bloqueiam a partida — só entram no
// diagnóstico. O resultado essencial sempre existe em texto na interface.
import { CUES, createCueGate, groupVolume, placeholderCues, type AudioGroup, type CueId, type VolumePrefs } from './cues.ts';

export type AudioDiagnostics = {
  readonly supported: boolean;
  readonly unlocked: boolean;
  readonly suspended: boolean;
  readonly placeholders: readonly CueId[];
  readonly failures: readonly { readonly cue: CueId; readonly reason: string }[];
  readonly played: number;
};

export type Mixer = {
  readonly play: (id: CueId, opts?: { readonly key?: string; readonly skipped?: boolean }) => void;
  readonly markPresented: (keys: readonly string[]) => void;
  readonly setVolumes: (prefs: VolumePrefs) => void;
  /** Pausa/retoma junto da sessão (pausa do duelo, aba oculta). */
  readonly setSuspended: (on: boolean) => void;
  readonly installUnlock: (target: EventTarget) => () => void;
  readonly diagnostics: () => AudioDiagnostics;
  readonly dispose: () => void;
};

type AudioCtor = new () => AudioContext;

export function createMixer(opts: { readonly baseUrl?: string; readonly fetchBytes?: (url: string) => Promise<ArrayBuffer> } = {}): Mixer {
  const Ctor: AudioCtor | undefined = typeof window !== 'undefined' ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext) : undefined;
  const base = opts.baseUrl ?? './audio/';
  const fetchBytes = opts.fetchBytes ?? (async (url: string) => (await fetch(url)).arrayBuffer());
  const gate = createCueGate();
  const failures: { cue: CueId; reason: string }[] = [];
  const buffers = new Map<CueId, Promise<AudioBuffer | null>>();
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  const groups = new Map<AudioGroup, GainNode>();
  let prefs: VolumePrefs = { volumeMusic: 0.6, volumeBattle: 0.8, volumeUi: 0.7, volumePacks: 0.8 };
  let unlocked = false;
  let suspended = false;
  let played = 0;

  const ensure = (): AudioContext | null => {
    if (!Ctor) return null;
    if (ctx) return ctx;
    try {
      ctx = new Ctor();
      master = ctx.createGain();
      master.connect(ctx.destination);
      for (const g of ['music', 'ambient', 'ui', 'cards', 'energy', 'attacks', 'coins', 'reveals'] as AudioGroup[]) {
        const node = ctx.createGain();
        node.gain.value = groupVolume(g, prefs);
        node.connect(master);
        groups.set(g, node);
      }
    } catch (e) {
      ctx = null;
      failures.push({ cue: 'ui.tap', reason: `AudioContext indisponível: ${String(e)}` });
    }
    return ctx;
  };

  const load = (id: CueId): Promise<AudioBuffer | null> => {
    const cached = buffers.get(id);
    if (cached) return cached;
    const file = CUES[id].file;
    const p = (async () => {
      if (!file) return null;
      const c = ensure();
      if (!c) return null;
      try {
        return await c.decodeAudioData(await fetchBytes(`${base}${file}`));
      } catch (e) {
        failures.push({ cue: id, reason: String((e as Error)?.message ?? e) });
        return null;
      }
    })();
    buffers.set(id, p);
    return p;
  };

  return {
    play: (id, o = {}) => {
      const spec = CUES[id];
      const volume = groupVolume(spec.group, prefs);
      const decision = gate.request(id, { now: performance.now(), ...(o.key ? { key: o.key } : {}), ...(o.skipped ? { skipped: o.skipped } : {}), volume: suspended || !unlocked ? 0 : volume });
      if (!decision.play || !spec.file) return;
      void load(id).then((buffer) => {
        const c = ctx;
        const group = groups.get(spec.group);
        if (!buffer || !c || !group || suspended) return;
        const src = c.createBufferSource();
        const gain = c.createGain();
        gain.gain.value = spec.gain;
        src.buffer = buffer;
        src.loop = !!spec.loop;
        src.connect(gain).connect(group);
        src.start();
        played += 1;
      });
    },
    markPresented: (keys) => gate.markPresented(keys),
    setVolumes: (next) => {
      prefs = next;
      for (const [g, node] of groups) node.gain.value = groupVolume(g, prefs);
    },
    setSuspended: (on) => {
      suspended = on;
      if (!ctx) return;
      void (on ? ctx.suspend() : ctx.resume()).catch(() => undefined);
    },
    installUnlock: (target) => {
      // Autoplay: o contexto só começa depois de um gesto do usuário; silêncio inicial não bloqueia nada.
      const unlock = () => {
        const c = ensure();
        if (!c) return;
        void c.resume().then(() => { unlocked = true; }, () => undefined);
        remove();
      };
      const events = ['pointerdown', 'keydown', 'touchstart'];
      const remove = () => events.forEach((e) => target.removeEventListener(e, unlock));
      events.forEach((e) => target.addEventListener(e, unlock, { passive: true }));
      return remove;
    },
    diagnostics: () => ({ supported: !!Ctor, unlocked, suspended, placeholders: placeholderCues(), failures: [...failures], played }),
    dispose: () => { void ctx?.close().catch(() => undefined); ctx = null; groups.clear(); buffers.clear(); },
  };
}

let shared: Mixer | null = null;

/** Mixer único da aplicação. */
export function appMixer(): Mixer {
  shared ??= createMixer();
  return shared;
}
