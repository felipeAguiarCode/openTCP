// Diff entre versões/documentos (editor §27 resumo de publicação, §29 importação, ED-057).
// Listas de objetos com `id` (ataques, Habilidades, blocos) são comparadas por identidade, não por posição,
// para que reordenar não pareça “tudo mudou” e um ataque duplicado apareça como adição.
import type { CardDefinition } from '../cards/types.ts';
import { describePath, shortValue } from './labels.ts';

export type ChangeKind = 'ADDED' | 'REMOVED' | 'CHANGED' | 'MOVED';

export type Change = {
  readonly kind: ChangeKind;
  /** Caminho com índices do documento novo (ou antigo, para remoções). */
  readonly path: readonly (string | number)[];
  readonly label: string;
  readonly before?: unknown;
  readonly after?: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function keyedById(list: readonly unknown[]): Map<string, number> | null {
  const map = new Map<string, number>();
  for (let i = 0; i < list.length; i += 1) {
    const item = list[i];
    if (!isObject(item) || typeof item.id !== 'string' || map.has(item.id)) return null;
    map.set(item.id, i);
  }
  return map;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function walk(before: unknown, after: unknown, path: (string | number)[], out: Change[], labelRules: CardDefinition | null, prefix: readonly (string | number)[]): void {
  if (same(before, after)) return;
  const full = [...prefix, ...path];
  if (Array.isArray(before) && Array.isArray(after)) {
    const kb = keyedById(before);
    const ka = keyedById(after);
    if (kb && ka && (kb.size > 0 || ka.size > 0)) {
      for (const [id, i] of ka) {
        const j = kb.get(id);
        if (j === undefined) out.push({ kind: 'ADDED', path: [...full, i], label: describePath([...full, i], labelRules), after: after[i] });
        else {
          if (i !== j) out.push({ kind: 'MOVED', path: [...full, i], label: describePath([...full, i], labelRules), before: j + 1, after: i + 1 });
          walk(before[j], after[i], [...path, i], out, labelRules, prefix);
        }
      }
      for (const [id, j] of kb) if (!ka.has(id)) out.push({ kind: 'REMOVED', path: [...full, j], label: describePath([...full, j], labelRules), before: before[j] });
      return;
    }
    if (before.every((x) => !isObject(x) && !Array.isArray(x)) && after.every((x) => !isObject(x) && !Array.isArray(x))) {
      out.push({ kind: 'CHANGED', path: full, label: describePath(full, labelRules), before, after });
      return;
    }
    const n = Math.max(before.length, after.length);
    for (let i = 0; i < n; i += 1) {
      if (i >= before.length) out.push({ kind: 'ADDED', path: [...full, i], label: describePath([...full, i], labelRules), after: after[i] });
      else if (i >= after.length) out.push({ kind: 'REMOVED', path: [...full, i], label: describePath([...full, i], labelRules), before: before[i] });
      else walk(before[i], after[i], [...path, i], out, labelRules, prefix);
    }
    return;
  }
  if (isObject(before) && isObject(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    for (const key of keys) {
      if (!(key in after)) out.push({ kind: 'REMOVED', path: [...full, key], label: describePath([...full, key], labelRules), before: before[key] });
      else if (!(key in before)) out.push({ kind: 'ADDED', path: [...full, key], label: describePath([...full, key], labelRules), after: after[key] });
      else walk(before[key], after[key], [...path, key], out, labelRules, prefix);
    }
    return;
  }
  out.push({ kind: 'CHANGED', path: full, label: describePath(full, labelRules), before, after });
}

/** Diff de regras: rótulos resolvem nomes de ataques/Habilidades do documento novo. */
export function diffRules(before: CardDefinition | null, after: CardDefinition): Change[] {
  if (!before) return [{ kind: 'ADDED', path: ['rules'], label: 'Carta nova', after: after.name }];
  const out: Change[] = [];
  const { version: _bv, ...b } = before;
  const { version: _av, ...a } = after;
  void _bv;
  void _av;
  walk(b, a, [], out, after, ['rules']);
  return out;
}

/** Diff genérico (impressões, documentos importados). */
export function diffJson(before: unknown, after: unknown, prefix: readonly (string | number)[] = []): Change[] {
  const out: Change[] = [];
  walk(before, after, [], out, null, prefix);
  return out;
}

export function changeText(change: Change): string {
  switch (change.kind) {
    case 'ADDED': return `${change.label}: adicionado${change.after !== undefined && typeof change.after !== 'object' ? ` (${shortValue(change.after)})` : ''}`;
    case 'REMOVED': return `${change.label}: removido`;
    case 'MOVED': return `${change.label}: posição ${String(change.before)} → ${String(change.after)}`;
    default: return `${change.label}: ${shortValue(change.before)} → ${shortValue(change.after)}`;
  }
}
