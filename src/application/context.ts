// Contexto compartilhado dos casos de uso (sem UI, sem DOM). Um pequeno observável permite à
// apresentação reagir a mudanças sem acoplar a aplicação a uma biblioteca de UI.
import { nextU32, seedRng, type RngState } from '../domain/random/rng.ts';
import type { CommandBus } from './commands.ts';
import type { ContentIndex } from './content.ts';
import type { AiPort } from './ports/ai.ts';
import type { Platform } from './ports/platform.ts';
import type { ProfileSnapshot, StoragePort } from './ports/storage.ts';

export type ProfileRng = { readonly economyRng: RngState; readonly seedRng: RngState };

export type Listener<T> = (value: T) => void;
export type Observable<T> = { get: () => T; set: (value: T) => void; subscribe: (fn: Listener<T>) => () => void };

export function observable<T>(initial: T): Observable<T> {
  let value = initial;
  const listeners = new Set<Listener<T>>();
  return {
    get: () => value,
    set: (next) => { value = next; listeners.forEach((fn) => fn(next)); },
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
  };
}

export type GameContext = {
  readonly storage: StoragePort;
  readonly bus: CommandBus;
  readonly platform: Platform;
  readonly content: Observable<ContentIndex>;
  readonly ai: AiPort;
  readonly snapshot: Observable<ProfileSnapshot | null>;
};

export function requireSnapshot(ctx: GameContext): ProfileSnapshot {
  const snap = ctx.snapshot.get();
  if (!snap) throw new Error('nenhum perfil carregado');
  return snap;
}

export function profileRng(snapshot: ProfileSnapshot): ProfileRng {
  const raw = snapshot.profile.rng as unknown as ProfileRng;
  if (!raw?.economyRng || !raw?.seedRng) throw new Error('INTERNAL_INTEGRITY_ERROR: RNG do perfil ausente');
  return raw;
}

export function newProfileRng(platform: Platform): ProfileRng {
  return { economyRng: seedRng(platform.randomSeed()), seedRng: seedRng(platform.randomSeed()) };
}

/** Duas sementes uint32 do `seedRng` do perfil para uma nova tentativa (batalha e IA, gameplay §27.3). */
export function drawAttemptSeeds(rng: ProfileRng): { battleSeed: number; aiSeed: number; next: ProfileRng } {
  const a = nextU32(rng.seedRng);
  const b = nextU32(a.rng);
  return { battleSeed: a.value, aiSeed: b.value, next: { ...rng, seedRng: b.rng } };
}

export async function reloadSnapshot(ctx: GameContext, profileId?: string): Promise<ProfileSnapshot | null> {
  const id = profileId ?? ctx.snapshot.get()?.profile.profileId;
  if (!id) return null;
  const snap = await ctx.storage.query({ kind: 'PROFILE_SNAPSHOT', profileId: id });
  ctx.snapshot.set(snap);
  return snap;
}
