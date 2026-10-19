// Extração de dependências versionadas para `card_dependencies` (persistencia §18): origem de evolução e
// chaves de nome citadas em filtros viram REFERENCE à versão head da definição encontrada. Só entram
// dependências que existem no catálogo (FK para card_versions) e nunca a própria versão (CHECK do DDL).
import type { CardDefinition, CardFilter, Condition, EffectBlock, Formula, Operation, PokemonFilter, Selector } from '../cards/types.ts';

export type DependencyKind = 'COPY_ATTACK' | 'REFERENCE' | 'TEST_FIXTURE';
export type DependencyRef = { readonly dependencyId: string; readonly dependencyVersion: number; readonly kind: DependencyKind; readonly reason: string };

function pokemonFilterKeys(f: PokemonFilter | undefined, acc: Set<string>): void {
  for (const k of f?.deckLimitKeys ?? []) acc.add(k);
}
function cardFilterKeys(f: CardFilter | undefined, acc: Set<string>): void {
  for (const k of f?.deckLimitKeys ?? []) acc.add(k);
}
function selectorKeys(s: Selector | null | undefined, acc: Set<string>): void {
  if (s) pokemonFilterKeys(s.filter, acc);
}
function formulaKeys(f: Formula | null | undefined, acc: Set<string>): void {
  if (!f) return;
  selectorKeys(f.selector, acc);
  cardFilterKeys(f.filter, acc);
  for (const o of f.operands ?? []) formulaKeys(o, acc);
}
function conditionKeys(c: Condition | null | undefined, acc: Set<string>): void {
  if (!c) return;
  formulaKeys(c.left, acc);
  formulaKeys(c.right, acc);
  selectorKeys(c.selector, acc);
  cardFilterKeys(c.filter, acc);
  for (const x of c.conditions ?? []) conditionKeys(x, acc);
  if (c.condition && typeof c.condition === 'object') conditionKeys(c.condition, acc);
}
function operationKeys(op: Operation, acc: Set<string>, copies: { value: boolean }): void {
  const any = op as unknown as Record<string, unknown>;
  for (const key of ['target', 'from', 'to']) if (any[key] && typeof any[key] === 'object') selectorKeys(any[key] as Selector, acc);
  if (any.filter && typeof any.filter === 'object') cardFilterKeys(any.filter as CardFilter, acc);
  if (any.fromHand && typeof any.fromHand === 'object') cardFilterKeys(any.fromHand as CardFilter, acc);
  for (const key of ['amount', 'count']) if (any[key] && typeof any[key] === 'object') formulaKeys(any[key] as Formula, acc);
  if (op.type === 'COPY_ATTACK') copies.value = true;
  if (op.type === 'CONDITIONAL') {
    conditionKeys(op.condition, acc);
    for (const o of [...op.then, ...(op.else ?? [])]) operationKeys(o, acc, copies);
  }
  if (op.type === 'SCHEDULE_DELAYED') for (const o of op.operations) operationKeys(o, acc, copies);
}
function blockKeys(blocks: readonly EffectBlock[] | undefined, acc: Set<string>, copies: { value: boolean }): void {
  for (const b of blocks ?? []) {
    conditionKeys(b.condition ?? null, acc);
    operationKeys(b.operation, acc, copies);
  }
}

export type DependencyCatalog = {
  readonly findByDeckLimitKey: (key: string) => readonly CardDefinition[];
  /** Versão head publicada de uma definição (padrão: maior versão encontrada). */
  readonly headVersion?: (definitionId: string) => number | null;
};

export function extractDependencies(def: CardDefinition, catalog: DependencyCatalog, testFixtureDefinitions: readonly { id: string; version: number }[] = []): DependencyRef[] {
  const evolution = new Set<string>(def.category === 'POKEMON' ? def.evolvesFrom ?? [] : []);
  const referenced = new Set<string>();
  const copies = { value: false };
  for (const a of def.attacks ?? []) {
    selectorKeys(a.damageTarget, referenced);
    formulaKeys(a.damageFormula, referenced);
    for (const c of a.preconditions ?? []) conditionKeys(c, referenced);
    blockKeys(a.effects, referenced, copies);
  }
  for (const a of def.abilities ?? []) {
    for (const c of a.conditions ?? []) conditionKeys(c, referenced);
    blockKeys(a.effects, referenced, copies);
  }
  if (def.category === 'TRAINER') {
    for (const c of def.trainerRules?.playConditions ?? []) conditionKeys(c, referenced);
    pokemonFilterKeys(def.trainerRules?.toolTarget, referenced);
    blockKeys(def.trainerEffects, referenced, copies);
  }
  const out = new Map<string, DependencyRef>();
  const add = (key: string, kind: DependencyKind, reason: string) => {
    const defs = catalog.findByDeckLimitKey(key).filter((d) => d.id !== def.id);
    const ids = [...new Set(defs.map((d) => d.id))];
    for (const id of ids) {
      const version = catalog.headVersion?.(id) ?? Math.max(...defs.filter((d) => d.id === id).map((d) => d.version));
      if (!Number.isFinite(version)) continue;
      const k = `${id}@${version}#${kind}`;
      if (!out.has(k)) out.set(k, { dependencyId: id, dependencyVersion: version, kind, reason });
    }
  };
  for (const key of evolution) add(key, 'REFERENCE', `Evolui de “${key}”`);
  for (const key of referenced) add(key, copies.value ? 'COPY_ATTACK' : 'REFERENCE', `Filtro cita “${key}”`);
  for (const t of testFixtureDefinitions) {
    if (t.id === def.id) continue;
    const k = `${t.id}@${t.version}#TEST_FIXTURE`;
    if (!out.has(k)) out.set(k, { dependencyId: t.id, dependencyVersion: t.version, kind: 'TEST_FIXTURE', reason: 'Usada nos cenários de teste' });
  }
  return [...out.values()].sort((a, b) => `${a.dependencyId}@${a.dependencyVersion}${a.kind}`.localeCompare(`${b.dependencyId}@${b.dependencyVersion}${b.kind}`));
}
