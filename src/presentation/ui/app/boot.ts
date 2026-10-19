// Boot real (interface §6.1, runtime §4, persistencia §8): manifesto → capacidades → banco →
// conteúdo instalado → perfil recuperado. Cada etapa é registrada para o diagnóstico (S50).
import { signal } from '@preact/signals';
import { loadEnergyOrbs } from '../../three/card/energy-orbs.ts';
import { createCommandBus } from '../../../application/commands.ts';
import { contentInstallRows, indexContent, type ContentIndex } from '../../../application/content.ts';
import { observable, reloadSnapshot, type GameContext } from '../../../application/context.ts';
import type { AiPort } from '../../../application/ports/ai.ts';
import type { Platform } from '../../../application/ports/platform.ts';
import type { ProfileSnapshot, StorageError, StoragePort } from '../../../application/ports/storage.ts';
import type { BuiltBundle } from '../../../content/types.ts';
import type { CardDefinition, CardPrinting } from '../../../domain/cards/types.ts';
import { attachContext, trackStorage } from './store.ts';
import { isLegacyInventory } from '../../../application/legacy.ts';
import { installArtAssetResolver } from '../../assets/card-art.ts';

export type BootStepId = 'ORIGIN' | 'CAPABILITIES' | 'MANIFEST' | 'DATABASE' | 'CONTENT_INSTALL' | 'PROFILE' | 'WEBGL';
export type BootStep = { readonly id: BootStepId; readonly label: string; readonly status: 'PENDING' | 'RUNNING' | 'OK' | 'FAILED' | 'WARN'; readonly detail?: string };

export type BootServices = {
  readonly platform: Platform;
  readonly createStorage: () => Promise<{ ok: true; storage: StoragePort } | StorageError>;
  readonly loadContent: () => Promise<{ ok: true; bundle: BuiltBundle } | { ok: false; code: string; message: string }>;
  readonly createAi: (content: ContentIndex) => AiPort;
  readonly requestTransfer?: () => Promise<boolean>;
};

export type BootOutcome =
  | { readonly kind: 'READY'; readonly profileId: string | null }
  | { readonly kind: 'SECOND_TAB' }
  | { readonly kind: 'BLOCKED'; readonly code: string; readonly message: string };

const LABELS: Record<BootStepId, string> = {
  ORIGIN: 'Origem local e isolamento',
  CAPABILITIES: 'Worker, WASM, OPFS e Web Locks',
  MANIFEST: 'Manifesto e integridade do pacote',
  DATABASE: 'Banco SQLite e migrações',
  CONTENT_INSTALL: 'Catálogo instalado no banco',
  PROFILE: 'Recuperar perfil',
  WEBGL: 'WebGL2 para a apresentação 3D',
};

export const bootSteps = signal<readonly BootStep[]>((Object.keys(LABELS) as BootStepId[]).map((id) => ({ id, label: LABELS[id], status: 'PENDING' })));
export const bootOutcome = signal<BootOutcome | null>(null);
export const webglAvailable = signal<boolean | null>(null);

export const bootServicesSignal = signal<BootServices | null>(null);
let game: GameContext | null = null;
let aiPort: AiPort | null = null;
/** Definições CUSTOM conhecidas pela porta de IA atual (assinatura ordenada). */
let aiCatalogSignature = '';

function step(id: BootStepId, status: BootStep['status'], detail?: string): void {
  bootSteps.value = bootSteps.value.map((s) => (s.id === id ? { ...s, status, ...(detail !== undefined ? { detail } : {}) } : s));
}

export function capabilityReport(): Record<string, boolean> {
  const w = globalThis as unknown as Record<string, unknown>;
  return {
    secureContext: !!w.isSecureContext,
    crossOriginIsolated: !!w.crossOriginIsolated,
    worker: typeof Worker === 'function',
    webAssembly: typeof WebAssembly === 'object',
    opfs: typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function',
    sharedArrayBuffer: typeof SharedArrayBuffer === 'function',
    webLocks: typeof navigator !== 'undefined' && !!navigator.locks,
  };
}

export function detectWebgl2(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    const ok = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return ok;
  } catch {
    return false;
  }
}

const LAST_PROFILE_KEY = 'lastProfileId';

export async function runBoot(svc: BootServices): Promise<BootOutcome> {
  bootServicesSignal.value = svc;
  bootSteps.value = bootSteps.value.map((s) => ({ ...s, status: 'PENDING', detail: undefined }) as BootStep);
  const caps = capabilityReport();
  step('ORIGIN', caps.secureContext && caps.crossOriginIsolated ? 'OK' : 'FAILED', caps.crossOriginIsolated ? location.origin : 'A página não está isolada (COOP/COEP). Abra pelo iniciador local em http://localhost:4173.');
  const missing = (['worker', 'webAssembly', 'opfs', 'sharedArrayBuffer', 'webLocks'] as const).filter((k) => !caps[k]);
  step('CAPABILITIES', missing.length ? 'FAILED' : 'OK', missing.length ? `Ausente: ${missing.join(', ')}` : undefined);
  const gl = detectWebgl2();
  webglAvailable.value = gl;
  step('WEBGL', gl ? 'OK' : 'WARN', gl ? undefined : 'Sem WebGL2: a apresentação 2D de recuperação será usada.');
  if (!caps.crossOriginIsolated) return finish({ kind: 'BLOCKED', code: 'ORIGIN_ISOLATION_REQUIRED', message: 'Isolamento de origem ausente.' });
  if (missing.length) return finish({ kind: 'BLOCKED', code: 'STORAGE_CAPABILITY_MISSING', message: `Capacidade obrigatória ausente: ${missing.join(', ')}.` });

  // Bolas de Energia da mesa 3D: carregam em paralelo ao boot para as texturas já nascerem com a arte.
  void loadEnergyOrbs();
  step('MANIFEST', 'RUNNING');
  const loaded = await svc.loadContent();
  if (!loaded.ok) {
    step('MANIFEST', 'FAILED', loaded.message);
    return finish({ kind: 'BLOCKED', code: loaded.code, message: loaded.message });
  }
  step('MANIFEST', 'OK', `${loaded.bundle.packageId} ${loaded.bundle.version} · ${loaded.bundle.contentHash.slice(0, 12)}`);

  step('DATABASE', 'RUNNING');
  const opened = await svc.createStorage();
  if (!opened.ok) {
    step('DATABASE', 'FAILED', opened.message);
    if (opened.code === 'DATABASE_IN_USE') return finish({ kind: 'SECOND_TAB' });
    return finish({ kind: 'BLOCKED', code: opened.code, message: opened.message });
  }
  step('DATABASE', 'OK');
  void opened.storage.query({ kind: 'DIAGNOSTICS', deep: false }).then((d) => {
    if (d.quickCheck !== 'ok') step('DATABASE', 'WARN', `quick_check: ${d.quickCheck}`);
    return opened.storage.write({ kind: 'SET_APP_META', key: 'lastQuickCheckAt', value: new Date().toISOString() });
  }).catch(() => step('DATABASE', 'WARN', 'Verificação rápida indisponível.'));
  const storage = trackStorage(opened.storage);

  step('CONTENT_INSTALL', 'RUNNING');
  const installed = await storage.installContent(contentInstallRows(loaded.bundle));
  if (!installed.ok) {
    step('CONTENT_INSTALL', 'FAILED', installed.message);
    return finish({ kind: 'BLOCKED', code: installed.code, message: installed.message });
  }
  step('CONTENT_INSTALL', 'OK', installed.installed ? 'Instalado agora' : 'Já instalado');

  const index = indexContent(loaded.bundle);
  const content = observable(index);
  const snapshot = observable<ProfileSnapshot | null>(null);
  aiPort = svc.createAi(index);
  game = {
    storage, platform: svc.platform, bus: createCommandBus(storage, svc.platform), content, snapshot,
    // Encaminha para a porta atual: recriada quando o catálogo CUSTOM muda (refreshCustomCatalog).
    ai: { plan: (job) => aiPort!.plan(job), cancel: (jobId) => aiPort!.cancel(jobId), dispose: () => aiPort?.dispose() },
  };
  attachContext(game);
  // Impressão completa com arte importada no Estúdio: object URL do BLOB, uma vez por asset (faces HTML e 3D).
  installArtAssetResolver(async (assetId) => {
    const asset = await storage.query({ kind: 'GET_ASSET', assetId });
    return asset ? URL.createObjectURL(new Blob([asset.bytes as unknown as BlobPart], { type: asset.mediaType })) : null;
  });

  step('PROFILE', 'RUNNING');
  const last = await storage.query({ kind: 'APP_META', key: LAST_PROFILE_KEY });
  let profileId: string | null = typeof last === 'string' ? last : null;
  if (profileId) {
    const ok = await openProfile(profileId);
    if (!ok) profileId = null;
  }
  step('PROFILE', 'OK', profileId ? 'Perfil recuperado' : 'Nenhum perfil ativo');
  return finish({ kind: 'READY', profileId });
}

function finish(outcome: BootOutcome): BootOutcome {
  bootOutcome.value = outcome;
  return outcome;
}

/**
 * Carrega o perfil, sobe o epoch de escrita e inclui no catálogo as publicações autorais dele. Perfil do catálogo
 * antigo (cartas que não existem mais, application/legacy.ts) não abre.
 */
export async function openProfile(profileId: string): Promise<boolean> {
  if (!game) return false;
  const snap = await game.storage.query({ kind: 'PROFILE_SNAPSHOT', profileId });
  if (!snap || snap.profile.archived) return false;
  if (isLegacyInventory(snap.inventory, game.content.get())) return false;
  await game.storage.bumpWriterEpoch(profileId);
  await refreshCustomCatalog(profileId);
  await reloadSnapshot(game, profileId);
  await game.storage.write({ kind: 'SET_APP_META', key: LAST_PROFILE_KEY, value: profileId });
  return true;
}

/** O perfil foi criado com o catálogo antigo e não pode ser aberto (tela de perfis mostra o aviso). */
export async function profileIsLegacy(profileId: string): Promise<boolean> {
  if (!game) return false;
  const snap = await game.storage.query({ kind: 'PROFILE_SNAPSHOT', profileId });
  return !!snap && isLegacyInventory(snap.inventory, game.content.get());
}

export async function closeProfile(): Promise<void> {
  if (!game) return;
  game.snapshot.set(null);
  await game.storage.write({ kind: 'SET_APP_META', key: LAST_PROFILE_KEY, value: null });
}

/** Publicações CUSTOM/LAB do perfil entram no índice sem alterar o pacote BASE (editor §29). */
export async function refreshCustomCatalog(profileId: string | null): Promise<void> {
  if (!game) return;
  const custom = await game.storage.query({ kind: 'CUSTOM_CATALOG', profileId });
  const bundle = game.content.get().bundle;
  const baseIds = new Set(bundle.cards.map((c) => `${c.id}@${c.version}`));
  const basePrintings = new Set(bundle.printings.map((p) => p.printingId));
  const definitions = custom.versions.map((v) => v.rules as unknown as CardDefinition).filter((d) => !baseIds.has(`${d.id}@${d.version}`));
  const printings = custom.printings.map((p) => p.appearance as unknown as CardPrinting).filter((p) => !basePrintings.has(p.printingId));
  const next = indexContent(bundle, { definitions, printings });
  game.content.set(next);
  // O worker de IA recebe o catálogo no INIT: cartas autorais novas exigem uma porta nova.
  const signature = definitions.map((d) => `${d.id}@${d.version}`).sort().join('|');
  const svc = bootServicesSignal.value;
  if (svc && signature !== aiCatalogSignature) {
    aiPort?.dispose();
    aiPort = svc.createAi(next);
    aiCatalogSignature = signature;
  }
}

export function bootServices(): BootServices | null {
  return bootServicesSignal.value;
}

export function gameContext(): GameContext | null {
  return game;
}
