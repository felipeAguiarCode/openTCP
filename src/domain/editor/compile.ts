// Compilação do rascunho para os documentos publicáveis (persistencia-sqlite.md §9, §18): regras dataVersion 2
// e aparências appearanceVersion 1 em JSON puro, com hashes JCS. A compilação normaliza a forma (campos de
// categoria, custos zerados, chaves vazias) mas não “corrige” semântica: divergências continuam visíveis
// para a validação (ex.: nome derivado errado num documento importado é erro, não ajuste silencioso).
import type { Ability, Attack, CardDefinition, CardPrinting, EffectBlock, EnergyCost } from '../cards/types.ts';
import { jcsHash } from '../hash/jcs.ts';
import { uniqueId, withDerivedBindings, type EditorDraft } from './draft.ts';

/** Clona como JSON puro (remove `undefined`, funções e protótipos). */
export function plainJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeCost(cost: EnergyCost | undefined): EnergyCost {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(cost ?? {})) if (value !== 0) out[key] = value as number;
  return out;
}

function normalizeBlocks(blocks: readonly EffectBlock[] | undefined): EffectBlock[] {
  return (blocks ?? []).map((b) => {
    const { condition, optional, failurePolicy, ...rest } = b;
    return {
      ...rest,
      ...(condition !== undefined ? { condition } : {}),
      ...(optional !== undefined ? { optional } : {}),
      ...(failurePolicy !== undefined ? { failurePolicy } : {}),
    };
  });
}

function normalizeAttack(a: Attack): Attack {
  const presentation = a.presentation && Object.keys(a.presentation).length ? a.presentation : undefined;
  return {
    id: a.id, name: a.name, energyCost: normalizeCost(a.energyCost), baseDamage: a.baseDamage ?? null, damageFormula: a.damageFormula ?? null,
    damageTarget: a.damageTarget ?? null, preconditions: a.preconditions ?? [], additionalCosts: a.additionalCosts ?? [],
    effects: normalizeBlocks(a.effects), endsTurn: a.endsTurn ?? true, ...(presentation ? { presentation } : {}),
  };
}

function normalizeAbility(a: Ability): Ability {
  return {
    id: a.id, name: a.name, kind: a.kind, sourcePositions: a.sourcePositions ?? [], ...(a.trigger !== undefined ? { trigger: a.trigger } : {}),
    conditions: a.conditions ?? [], costs: a.costs ?? [], ...(a.usageLimit !== undefined ? { usageLimit: a.usageLimit } : {}),
    ...(a.optional !== undefined ? { optional: a.optional } : {}), endsTurn: a.endsTurn ?? false, effects: normalizeBlocks(a.effects),
  };
}

/** Documento de regras publicável do alvo do rascunho (id/versão do alvo; campos da categoria). */
export function compileRules(draft: EditorDraft, version: number = draft.target.version): CardDefinition {
  const r = draft.rules as CardDefinition & Record<string, unknown>;
  const common = {
    dataVersion: 2 as const, effectsDsl: 1 as const, id: draft.target.definitionId, version,
    baseName: r.baseName, name: r.name, deckLimitKey: r.deckLimitKey,
  };
  const flavor = typeof r.flavorText === 'string' && r.flavorText.trim() ? { flavorText: r.flavorText } : {};
  if (r.category === 'TRAINER') {
    const t = draft.rules as Extract<CardDefinition, { category: 'TRAINER' }>;
    // Campos de Pokémon presentes num documento importado ficam no documento para a validação apontá-los (TRAINER_FIELD_INVALID).
    const extras: Record<string, unknown> = {};
    for (const key of ['stage', 'types', 'retreatCost', 'weakness', 'evolvesFrom'] as const) if (key in r && r[key] !== undefined) extras[key] = r[key];
    return plainJson({
      ...common, category: 'TRAINER', subtype: t.subtype, baseHp: t.baseHp ?? null, knockoutPoints: t.knockoutPoints ?? null, ruleBox: t.ruleBox ?? 'NONE',
      tags: t.tags ?? [], ...flavor, attacks: (t.attacks ?? []).map(normalizeAttack), abilities: (t.abilities ?? []).map(normalizeAbility),
      trainerRules: t.trainerRules, trainerEffects: normalizeBlocks(t.trainerEffects), ...extras,
    } as unknown as CardDefinition);
  }
  const p = draft.rules as Extract<CardDefinition, { category: 'POKEMON' }>;
  const extras: Record<string, unknown> = {};
  for (const key of ['subtype', 'trainerRules', 'trainerEffects'] as const) if (key in r && r[key] !== undefined) extras[key] = r[key];
  return plainJson({
    ...common, category: 'POKEMON', stage: p.stage, evolvesFrom: p.evolvesFrom ?? [], types: p.types ?? [], baseHp: p.baseHp,
    retreatCost: p.retreatCost, weakness: p.weakness ?? null, ruleBox: p.ruleBox, knockoutPoints: p.knockoutPoints, tags: p.tags ?? [], ...flavor,
    attacks: (p.attacks ?? []).map(normalizeAttack), abilities: (p.abilities ?? []).map(normalizeAbility), ...extras,
  } as unknown as CardDefinition);
}

export type CompiledPrinting = { readonly printing: CardPrinting; readonly appearanceHash: string; readonly sourcePrintingId: string };

/**
 * Aparências publicáveis ligadas ao alvo. IDs já publicados (imutáveis) são remapeados para um ID novo
 * (`<id>-v<versão>`), pois impressão publicada nunca recebe UPDATE (persistencia §9.1).
 */
export function compilePrintings(draft: EditorDraft, version: number = draft.target.version, existingPrintingIds: ReadonlySet<string> = new Set()): CompiledPrinting[] {
  const taken = new Set(existingPrintingIds);
  return draft.printings.map((p) => {
    let printingId = p.printingId;
    if (taken.has(printingId)) printingId = uniqueId(`${p.printingId.slice(0, 90)}-v${version}`, taken, 100);
    taken.add(printingId);
    const printing = plainJson(withDerivedBindings({
      ...p, printingId, cardDefinitionId: draft.target.definitionId, cardDefinitionVersion: version, appearanceVersion: 1,
    }));
    return { printing, appearanceHash: jcsHash(printing), sourcePrintingId: p.printingId };
  });
}

export type CompiledDraft = {
  readonly definition: CardDefinition;
  readonly rulesHash: string;
  readonly printings: readonly CompiledPrinting[];
};

export function compileDraft(draft: EditorDraft, options: { readonly version?: number; readonly existingPrintingIds?: ReadonlySet<string> } = {}): CompiledDraft {
  const version = options.version ?? draft.target.version;
  const definition = compileRules(draft, version);
  return { definition, rulesHash: jcsHash(definition), printings: compilePrintings(draft, version, options.existingPrintingIds) };
}

/** rulesHash do rascunho para o alvo atual: testes aprovados só valem enquanto este hash não muda (ED-056). */
export function draftRulesHash(draft: EditorDraft): string {
  return jcsHash(compileRules(draft));
}
