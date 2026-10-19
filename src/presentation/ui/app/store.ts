// Estado da apresentação em signals: espelha o contexto da aplicação (snapshot do perfil, conteúdo),
// o status de gravação (interface §5 SaveStatus), toasts, o diálogo modal único e as preferências.
import { computed, signal } from '@preact/signals';
import type { BattleSession } from '../../../application/battle.ts';
import type { ContentIndex } from '../../../application/content.ts';
import type { GameContext } from '../../../application/context.ts';
import type { JsonValue, ProfileSnapshot, StoragePort } from '../../../application/ports/storage.ts';

export const ctx = signal<GameContext | null>(null);
export const snapshot = signal<ProfileSnapshot | null>(null);
export const content = signal<ContentIndex | null>(null);
export const battleSession = signal<BattleSession | null>(null);

export function attachContext(game: GameContext): void {
  ctx.value = game;
  content.value = game.content.get();
  snapshot.value = game.snapshot.get();
  game.content.subscribe((c) => { content.value = c; });
  game.snapshot.subscribe((s) => { snapshot.value = s; });
}

export function requireCtx(): GameContext {
  const c = ctx.value;
  if (!c) throw new Error('contexto do jogo ainda não inicializado');
  return c;
}

export function requireContent(): ContentIndex {
  const c = content.value;
  if (!c) throw new Error('conteúdo ainda não carregado');
  return c;
}

// ---------------------------------------------------------------- gravação

export type SaveState = { readonly state: 'IDLE' | 'SAVING' | 'SAVED' | 'FAILED'; readonly message?: string; readonly at?: number };
export const saveState = signal<SaveState>({ state: 'IDLE' });

/** Decora a porta para refletir gravações reais no SaveStatus — nunca “salvo” antes do COMMIT. */
export function trackStorage(port: StoragePort): StoragePort {
  let inflight = 0;
  const begin = () => { inflight++; saveState.value = { state: 'SAVING' }; };
  const end = (ok: boolean, message?: string) => {
    inflight = Math.max(0, inflight - 1);
    if (!ok) saveState.value = { state: 'FAILED', message: message ?? 'Falha ao gravar neste dispositivo.', at: Date.now() };
    else if (inflight === 0) saveState.value = { state: 'SAVED', at: Date.now() };
  };
  return {
    ...port,
    commit: async (req) => {
      begin();
      try {
        const r = await port.commit(req);
        end(r.ok || r.code !== 'SAVE_WRITE_FAILED' && r.code !== 'STORAGE_FULL' && r.code !== 'DATABASE_CORRUPT', r.ok ? undefined : r.message);
        return r;
      } catch (e) { end(false, String(e)); throw e; }
    },
    write: async (w) => {
      begin();
      try {
        const r = await port.write(w);
        end(r.ok || r.code !== 'SAVE_WRITE_FAILED' && r.code !== 'STORAGE_FULL', r.ok ? undefined : r.message);
        return r;
      } catch (e) { end(false, String(e)); throw e; }
    },
  };
}

// ---------------------------------------------------------------- toasts e diálogo

export type Toast = { readonly id: number; readonly kind: 'info' | 'success' | 'warning' | 'error'; readonly text: string };
export const toasts = signal<readonly Toast[]>([]);
let toastSeq = 0;

export function toast(text: string, kind: Toast['kind'] = 'info', ms = 4200): void {
  const id = ++toastSeq;
  toasts.value = [...toasts.value.slice(-3), { id, kind, text }];
  setTimeout(() => { toasts.value = toasts.value.filter((t) => t.id !== id); }, ms);
}

export type DialogRequest = {
  readonly title: string;
  readonly body: string | readonly string[];
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  readonly tone?: 'default' | 'danger';
  readonly resolve: (ok: boolean) => void;
};
export const dialog = signal<DialogRequest | null>(null);

/** Confirmação explícita (interface §4.6): um modal principal por vez; foco volta à origem ao fechar. */
export function confirmDialog(opts: Omit<DialogRequest, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => {
    dialog.value?.resolve(false);
    dialog.value = { ...opts, resolve: (ok) => { dialog.value = null; resolve(ok); } };
  });
}

// ---------------------------------------------------------------- preferências (interface §34)

export type Settings = {
  readonly textSize: 'M' | 'L' | 'XL';
  readonly reducedMotion: 'SYSTEM' | 'ON' | 'OFF';
  readonly animationSpeed: 'NORMAL' | 'FAST' | 'INSTANT';
  readonly quality: 'AUTO' | 'LOW' | 'MEDIUM' | 'HIGH';
  readonly playmatDisplay: 'TURN_OWNER' | 'PLAYER_FIXED' | 'NEUTRAL';
  readonly battleLayout: 'TABLE_FOCUS' | 'TACTICAL_PANELS';
  readonly presentation2d: boolean;
  readonly highContrast: boolean;
  readonly confirmAttack: boolean;
  readonly confirmEndTurn: boolean;
  readonly letterShortcuts: boolean;
  readonly volumeMusic: number;
  readonly volumeBattle: number;
  readonly volumeUi: number;
  readonly volumePacks: number;
  readonly favoriteDeckId: string | null;
  /** Capa escolhida por deck (`deckId` → `printingId`); sem entrada, a capa é automática. */
  readonly deckCovers: Readonly<Record<string, string>>;
  readonly defaultDifficulty: 'STORY' | 'STANDARD' | 'EXPERT';
  readonly receiptsReadUntil: number;
};

export const DEFAULT_SETTINGS: Settings = {
  textSize: 'M', reducedMotion: 'SYSTEM', animationSpeed: 'NORMAL', quality: 'AUTO', playmatDisplay: 'TURN_OWNER',
  battleLayout: 'TABLE_FOCUS', presentation2d: false, highContrast: false, confirmAttack: false, confirmEndTurn: true,
  letterShortcuts: true, volumeMusic: 0.6, volumeBattle: 0.8, volumeUi: 0.7, volumePacks: 0.8, favoriteDeckId: null,
  deckCovers: {}, defaultDifficulty: 'STANDARD', receiptsReadUntil: 0,
};

const DEVICE_KEY = 'card-campaign:device-settings';

function readDevice(): Partial<Settings> {
  try { return JSON.parse(localStorage.getItem(DEVICE_KEY) ?? '{}') as Partial<Settings>; } catch { return {}; }
}

/** Preferências do dispositivo valem sem perfil (tela de entrada, diagnóstico); as do perfil prevalecem. */
export const deviceSettings = signal<Partial<Settings>>(typeof localStorage === 'undefined' ? {} : readDevice());

export const settings = computed<Settings>(() => ({
  ...DEFAULT_SETTINGS,
  ...deviceSettings.value,
  ...((snapshot.value?.settings ?? {}) as Partial<Settings>),
}));

export function saveDeviceSettings(values: Partial<Settings>): void {
  deviceSettings.value = { ...deviceSettings.value, ...values };
  try { localStorage.setItem(DEVICE_KEY, JSON.stringify(deviceSettings.value)); } catch { /* sem armazenamento local: vale só nesta sessão */ }
}

export const systemReducedMotion = signal(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
if (typeof matchMedia === 'function') {
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', (e) => { systemReducedMotion.value = e.matches; });
}

export const reducedMotion = computed(() => settings.value.reducedMotion === 'ON' || (settings.value.reducedMotion === 'SYSTEM' && systemReducedMotion.value));

export function asJson(values: Partial<Settings>): Record<string, JsonValue> {
  return values as unknown as Record<string, JsonValue>;
}

// ---------------------------------------------------------------- derivados frequentes

export const credits = computed(() => snapshot.value?.wallets.CREDITS ?? 0);
export const packCount = computed(() => Object.entries(snapshot.value?.wallets ?? {}).filter(([k]) => k.startsWith('PACK:')).reduce((sum, [, v]) => sum + v, 0));
export const inventory = computed(() => new Map((snapshot.value?.inventory ?? []).map((i) => [i.printingId, i.quantity])));

/** Nome exibido: o perfil pode renomear-se localmente sem reescrever o histórico de operações. */
export const displayName = computed(() => {
  const snap = snapshot.value;
  if (!snap) return '';
  const override = snap.settings.displayNameOverride;
  return typeof override === 'string' && override.trim() ? override : snap.profile.displayName;
});
