// Recursos de GPU compartilhados com contagem de referências (runtime §21.1) e cache LRU de texturas com
// orçamento estimado (§21.3). Descartar o material de um inspector não quebra uma carta visível na mesa.

export type Disposable = { dispose(): void };

export type ResourceRegistry = {
  readonly acquire: <T extends Disposable>(key: string, create: () => T) => T;
  readonly retain: (key: string) => void;
  readonly release: (key: string) => void;
  readonly get: <T extends Disposable>(key: string) => T | null;
  readonly refCount: (key: string) => number;
  readonly stats: () => { entries: number; references: number };
  readonly disposeAll: () => void;
};

export function createResourceRegistry(): ResourceRegistry {
  const entries = new Map<string, { value: Disposable; refs: number }>();
  return {
    acquire: <T extends Disposable>(key: string, create: () => T): T => {
      const found = entries.get(key);
      if (found) {
        found.refs += 1;
        return found.value as T;
      }
      const value = create();
      entries.set(key, { value, refs: 1 });
      return value;
    },
    retain: (key) => {
      const found = entries.get(key);
      if (found) found.refs += 1;
    },
    release: (key) => {
      const found = entries.get(key);
      if (!found) return;
      found.refs -= 1;
      if (found.refs <= 0) {
        entries.delete(key);
        found.value.dispose();
      }
    },
    get: <T extends Disposable>(key: string) => (entries.get(key)?.value as T | undefined) ?? null,
    refCount: (key) => entries.get(key)?.refs ?? 0,
    stats: () => {
      let references = 0;
      for (const e of entries.values()) references += e.refs;
      return { entries: entries.size, references };
    },
    disposeAll: () => {
      for (const e of entries.values()) e.value.dispose();
      entries.clear();
    },
  };
}

export type TextureCacheStats = { entries: number; referenced: number; bytes: number; budgetBytes: number; evictions: number };

export type TextureCache<T extends Disposable = Disposable> = {
  readonly acquire: (key: string, create: () => T, bytes: number) => T;
  readonly release: (key: string) => void;
  readonly has: (key: string) => boolean;
  readonly refCount: (key: string) => number;
  readonly setBudget: (bytes: number) => void;
  readonly stats: () => TextureCacheStats;
  readonly keys: () => string[];
  readonly disposeAll: () => void;
};

/**
 * LRU por bytes estimados. Entradas referenciadas nunca são despejadas; ao zerar referências, a textura
 * fica disponível para reuso até o orçamento exigir espaço (ordem de uso menos recente primeiro).
 */
export function createTextureCache<T extends Disposable = Disposable>(budgetBytes: number): TextureCache<T> {
  const entries = new Map<string, { value: T; refs: number; bytes: number }>();
  let budget = budgetBytes;
  let total = 0;
  let evictions = 0;

  const touch = (key: string) => {
    const e = entries.get(key);
    if (!e) return;
    entries.delete(key);
    entries.set(key, e);
  };
  const evict = () => {
    if (total <= budget) return;
    for (const [key, e] of entries) {
      if (total <= budget) break;
      if (e.refs > 0) continue;
      entries.delete(key);
      total -= e.bytes;
      evictions += 1;
      e.value.dispose();
    }
  };

  return {
    acquire: (key, create, bytes) => {
      const found = entries.get(key);
      if (found) {
        found.refs += 1;
        touch(key);
        return found.value;
      }
      const value = create();
      entries.set(key, { value, refs: 1, bytes });
      total += bytes;
      evict();
      return value;
    },
    release: (key) => {
      const e = entries.get(key);
      if (!e) return;
      e.refs = Math.max(0, e.refs - 1);
      if (e.refs === 0) evict();
    },
    has: (key) => entries.has(key),
    refCount: (key) => entries.get(key)?.refs ?? 0,
    setBudget: (bytes) => {
      budget = bytes;
      evict();
    },
    stats: () => {
      let referenced = 0;
      for (const e of entries.values()) if (e.refs > 0) referenced += 1;
      return { entries: entries.size, referenced, bytes: total, budgetBytes: budget, evictions };
    },
    keys: () => [...entries.keys()],
    disposeAll: () => {
      for (const e of entries.values()) e.value.dispose();
      entries.clear();
      total = 0;
    },
  };
}

/** Estimativa aritmética (não medição de VRAM): RGBA8 × (1 + 1/3 com mipmaps). */
export function estimateTextureBytes(width: number, height: number, mipmaps = true): number {
  return Math.round(width * height * 4 * (mipmaps ? 4 / 3 : 1));
}
