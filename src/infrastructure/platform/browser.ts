// Plataforma de produção: identidade e entropia de `crypto`, relógio de `Date` (runtime §5).
import type { Platform } from '../../application/ports/platform.ts';

export function browserPlatform(): Platform {
  return {
    newId: (prefix) => `${prefix}-${crypto.randomUUID()}`,
    now: () => new Date().toISOString(),
    randomSeed: () => crypto.getRandomValues(new Uint32Array(1))[0]!,
  };
}
