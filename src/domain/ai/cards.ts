// Conhecimento estático sobre definições usado pela IA (custos, dano nominal, linhas de evolução).
// Nada aqui consulta estado oculto: apenas o catálogo e listas de chaves que a IA conhece.
import type { CatalogLookup } from '../battle/types.ts';
import type { Attack, CardDefinition, CostType, EnergyCost, EnergyType, PokemonCard } from '../cards/types.ts';
import { isPokemon } from '../cards/types.ts';

/** deckLimitKey de uma forma → evoluções conhecidas que partem dela. */
export type EvoIndex = ReadonlyMap<string, readonly PokemonCard[]>;

export function safeDefinition(cat: CatalogLookup, key: string): CardDefinition | null {
  try {
    return cat.definition(key);
  } catch {
    return null;
  }
}

export function buildEvoIndex(cat: CatalogLookup, definitionKeys: readonly string[]): EvoIndex {
  const index = new Map<string, PokemonCard[]>();
  const seen = new Set<string>();
  for (const key of definitionKeys) {
    if (seen.has(key)) continue;
    seen.add(key);
    const def = safeDefinition(cat, key);
    if (!def || !isPokemon(def) || def.stage === 'BASIC') continue;
    for (const from of def.evolvesFrom) {
      const list = index.get(from) ?? [];
      if (!list.some((d) => d.id === def.id && d.version === def.version)) list.push(def);
      index.set(from, list);
    }
  }
  return index;
}

export function costTotal(cost: EnergyCost): number {
  return Object.values(cost).reduce((sum: number, v) => sum + (v ?? 0), 0);
}

/** Dano nominal de um ataque (fórmulas e efeitos variáveis recebem uma estimativa média conservadora). */
export function nominalDamage(attack: Attack): number {
  if (attack.damageFormula) return 30;
  return attack.baseDamage ?? 0;
}

export function bestAttack(def: PokemonCard): Attack | null {
  let best: Attack | null = null;
  for (const attack of def.attacks) {
    if (!best) { best = attack; continue; }
    const d = nominalDamage(attack) - nominalDamage(best);
    if (d > 0 || (d === 0 && costTotal(attack.energyCost) < costTotal(best.energyCost))) best = attack;
  }
  return best;
}

/** Custo-alvo de Energia: o ataque mais forte da forma atual ou das evoluções que o dono conhece. */
export function goalCost(def: PokemonCard, evo: EvoIndex | null): EnergyCost {
  let best = bestAttack(def);
  let bestDamage = best ? nominalDamage(best) : 0;
  const visit = (from: PokemonCard, depth: number) => {
    if (!evo || depth > 2) return;
    for (const next of evo.get(from.deckLimitKey) ?? []) {
      const attack = bestAttack(next);
      if (attack && nominalDamage(attack) > bestDamage) { best = attack; bestDamage = nominalDamage(attack); }
      visit(next, depth + 1);
    }
  };
  visit(def, 1);
  return best ? best.energyCost : {};
}

export type Units = readonly { readonly type: string; readonly units: number }[];

/** Quanto do custo já é coberto pelas unidades ligadas (específicas primeiro, depois Incolor). */
export function coverage(units: Units, cost: EnergyCost): { satisfied: number; total: number; excess: number } {
  const have: Record<string, number> = {};
  let supplied = 0;
  for (const u of units) {
    const n = Math.max(0, u.units);
    have[u.type] = (have[u.type] ?? 0) + n;
    supplied += n;
  }
  let satisfied = 0;
  let total = 0;
  for (const [type, need] of Object.entries(cost) as [CostType, number | undefined][]) {
    if (!need || type === 'COLORLESS') continue;
    total += need;
    const used = Math.min(need, have[type] ?? 0);
    have[type] = (have[type] ?? 0) - used;
    satisfied += used;
  }
  const colorless = cost.COLORLESS ?? 0;
  total += colorless;
  const leftover = Object.values(have).reduce((a, b) => a + Math.max(0, b), 0);
  satisfied += Math.min(colorless, leftover);
  return { satisfied, total, excess: Math.max(0, supplied - satisfied) };
}

/** Uma unidade do tipo `type` avançaria o custo-alvo? */
export function energyUseful(units: Units, cost: EnergyCost, type: EnergyType): boolean {
  const before = coverage(units, cost).satisfied;
  const after = coverage([...units, { type, units: 1 }], cost).satisfied;
  return after > before;
}

export function stageValue(def: CardDefinition): number {
  if (!isPokemon(def)) return 0;
  return def.stage === 'STAGE_2' ? 2 : def.stage === 'STAGE_1' ? 1 : 0;
}
