// Pilha de Desfazer/Refazer do rascunho (editor §4, §31; persistencia §19): limitada em memória, só sobre o
// documento editável. Publicação, concessão de cópias e resultados de teste nunca entram aqui (ED-066).
// Digitação contínua no mesmo campo é agrupada numa única entrada (janela de coalescência).

export type History<T> = {
  readonly past: readonly T[];
  readonly present: T;
  readonly future: readonly T[];
  readonly lastKey: string | null;
  readonly lastAt: number;
};

export const HISTORY_LIMIT = 100;
export const COALESCE_WINDOW_MS = 1000;

export function historyInit<T>(present: T): History<T> {
  return { past: [], present, future: [], lastKey: null, lastAt: 0 };
}

export type PushOptions = { readonly coalesceKey?: string | null; readonly at?: number; readonly windowMs?: number; readonly limit?: number };

export function historyPush<T>(h: History<T>, next: T, opts: PushOptions = {}): History<T> {
  if (Object.is(next, h.present)) return h;
  const at = opts.at ?? 0;
  const key = opts.coalesceKey ?? null;
  const windowMs = opts.windowMs ?? COALESCE_WINDOW_MS;
  if (key !== null && key === h.lastKey && at - h.lastAt <= windowMs && h.past.length > 0) {
    return { past: h.past, present: next, future: [], lastKey: key, lastAt: at };
  }
  const limit = opts.limit ?? HISTORY_LIMIT;
  const past = [...h.past, h.present];
  return { past: past.length > limit ? past.slice(past.length - limit) : past, present: next, future: [], lastKey: key, lastAt: at };
}

export function canUndo<T>(h: History<T>): boolean {
  return h.past.length > 0;
}

export function canRedo<T>(h: History<T>): boolean {
  return h.future.length > 0;
}

export function historyUndo<T>(h: History<T>): History<T> {
  if (!h.past.length) return h;
  const previous = h.past[h.past.length - 1]!;
  return { past: h.past.slice(0, -1), present: previous, future: [h.present, ...h.future], lastKey: null, lastAt: 0 };
}

export function historyRedo<T>(h: History<T>): History<T> {
  if (!h.future.length) return h;
  const [next, ...rest] = h.future;
  return { past: [...h.past, h.present], present: next!, future: rest, lastKey: null, lastAt: 0 };
}

/** Substitui o presente sem criar entrada (ex.: remapeamento de IDs após publicar, que não é desfazível). */
export function historyReplace<T>(h: History<T>, present: T): History<T> {
  return { ...h, present, lastKey: null };
}
