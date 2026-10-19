// Chave idempotente de flair (runtime §15.10): `attemptId:eventId:effectLayer:entityId`. Uma chave já
// apresentada não repete ao reconstruir mesh, trocar material, fazer hover ou restaurar viewport.

export type FlairLayer = 'ENTRY' | 'EVOLUTION' | 'PROMOTION';

export function flairKey(attemptId: string, eventId: string, effectLayer: FlairLayer | string, entityId: string): string {
  return `${attemptId}:${eventId}:${effectLayer}:${entityId}`;
}

export function eventIdOf(seq: number): string {
  return `event-${String(seq).padStart(4, '0')}`;
}

export type FlairRegistry = {
  /** true somente na primeira vez que a chave é vista; depois sempre false. */
  readonly tryPlay: (key: string) => boolean;
  readonly has: (key: string) => boolean;
  readonly size: () => number;
  /** Marca chaves como já apresentadas sem tocar (retomada/reconstrução após perda de contexto). */
  readonly markPresented: (keys: readonly string[]) => void;
};

export function createFlairRegistry(limit = 4096): FlairRegistry {
  const seen = new Set<string>();
  const remember = (key: string) => {
    seen.add(key);
    if (seen.size > limit) {
      const first = seen.values().next().value;
      if (first !== undefined) seen.delete(first);
    }
  };
  return {
    tryPlay: (key) => {
      if (seen.has(key)) return false;
      remember(key);
      return true;
    },
    has: (key) => seen.has(key),
    size: () => seen.size,
    markPresented: (keys) => keys.forEach(remember),
  };
}
