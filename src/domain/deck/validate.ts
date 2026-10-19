// Validação de decks (gameplay §6) e métricas de composição usadas pelos objetivos (campanha §12.1).
// Funções puras: recebem o catálogo fixado e a lista de impressões; nunca leem estado global.
import { OPCODES } from '../battle/ops.ts';
import type { Catalog } from '../cards/catalog.ts';
import {
  definitionKey, ENERGY_TYPES, isFossil, isPokemon, type CardDefinition, type CardPrinting, type EnergyType, type Operation, type RuleBox,
  type Stage, type TrainerSubtype,
} from '../cards/types.ts';

export type DeckEntry = { readonly printingId: string; readonly count: number };
export type DeckInput = { readonly entries: readonly DeckEntry[]; readonly energyTypes: readonly string[] };
export type DeckCatalog = Pick<Catalog, 'printings' | 'definitions'>;

export type DeckIssueCode =
  | 'DECK_SIZE_INVALID' | 'DECK_COPY_LIMIT_EXCEEDED' | 'DECK_REQUIRES_BASIC' | 'DECK_ENERGY_TYPES_INVALID'
  | 'DECK_ENTRY_INVALID' | 'DECK_DEFINITION_VERSION_CONFLICT' | 'CONTENT_REFERENCE_MISSING' | 'CARD_EFFECT_UNSUPPORTED' | 'CARD_NOT_OWNED';
export type DeckWarningCode =
  | 'EVOLUTION_WITHOUT_PREVIOUS_STAGE' | 'ATTACK_ENERGY_NOT_PRODUCED' | 'FEW_BASICS' | 'MANY_MULTI_POINT_TARGETS' | 'MULTI_PIECE_PLAN';

export type DeckIssue<C extends string = string> = {
  readonly code: C;
  readonly message: string;
  readonly printingId?: string;
  readonly deckLimitKey?: string;
};

export type DeckValidation = {
  readonly ok: boolean;
  readonly errors: readonly DeckIssue<DeckIssueCode>[];
  readonly warnings: readonly DeckIssue<DeckWarningCode>[];
};

export type Inventory = ReadonlyMap<string, number> | Readonly<Record<string, number>>;

export type ValidateDeckOptions = {
  readonly energyTypes: readonly string[];
  /** Quando presente, cada impressão precisa de cópias possuídas suficientes (CARD_NOT_OWNED). */
  readonly inventory?: Inventory;
  /** Registro de opcodes executáveis; padrão: o registro do motor. */
  readonly supportedOpcodes?: readonly string[];
  readonly deckSize?: number;
  readonly maxCopiesPerName?: number;
  readonly maxEnergyTypes?: number;
  /** Abaixo deste número de cópias de Básicos o validador avisa (estratégia, não regra). */
  readonly fewBasicsThreshold?: number;
};

const owned = (inventory: Inventory, printingId: string): number =>
  inventory instanceof Map ? inventory.get(printingId) ?? 0 : (inventory as Readonly<Record<string, number>>)[printingId] ?? 0;

/** Resolve entradas para definições; entradas desconhecidas ficam de fora (reportadas pelo validador). */
function resolveEntries(entries: readonly DeckEntry[], catalog: DeckCatalog): { entry: DeckEntry; printing: CardPrinting; def: CardDefinition }[] {
  const out: { entry: DeckEntry; printing: CardPrinting; def: CardDefinition }[] = [];
  for (const entry of entries) {
    const printing = catalog.printings.get(entry.printingId);
    if (!printing) continue;
    const def = catalog.definitions.get(definitionKey(printing.cardDefinitionId, printing.cardDefinitionVersion));
    if (!def) continue;
    out.push({ entry, printing, def });
  }
  return out;
}

// ---------------------------------------------------------------- opcodes

function walkOperation(op: Operation, out: Set<string>): void {
  out.add(op.type);
  if (op.type === 'MODIFY') out.add(`MODIFY:${op.stat}`);
  if (op.type === 'CONDITIONAL') {
    for (const child of op.then) walkOperation(child, out);
    for (const child of op.else ?? []) walkOperation(child, out);
  }
  if (op.type === 'SCHEDULE_DELAYED') for (const child of op.operations) walkOperation(child, out);
}

/** Opcodes usados por uma definição (inclui ramos de CONDITIONAL e operações agendadas); MODIFY também gera `MODIFY:<stat>`. */
export function cardOpcodes(def: CardDefinition): string[] {
  const out = new Set<string>();
  for (const attack of def.attacks) for (const block of attack.effects) walkOperation(block.operation, out);
  for (const ability of def.abilities) for (const block of ability.effects) walkOperation(block.operation, out);
  if (def.category === 'TRAINER') for (const block of def.trainerEffects) walkOperation(block.operation, out);
  return [...out].sort();
}

// ---------------------------------------------------------------- métricas

export type DeckMetrics = {
  readonly totalCards: number;
  readonly pokemonCopies: number;
  readonly trainerCopies: number;
  /** Cópias de Pokémon Básicos elegíveis (Fósseis nunca contam). */
  readonly basicCopies: number;
  /** Definições distintas de Pokémon Básicos elegíveis. */
  readonly distinctBasics: number;
  readonly fossilCopies: number;
  readonly stageCopies: Readonly<Record<Stage, number>>;
  readonly ruleBoxCopies: Readonly<Record<RuleBox, number>>;
  readonly subtypeCopies: Readonly<Record<TrainerSubtype, number>>;
  readonly distinctEvolutionLines: number;
  readonly evolutionLineRoots: readonly string[];
  readonly setCounts: Readonly<Record<string, number>>;
  /** Cópias de Pokémon por tipo. */
  readonly typeCounts: Readonly<Record<string, number>>;
  readonly starterPrintingCount: number;
  readonly opcodeCardCopies: Readonly<Record<string, number>>;
  readonly energyTypes: readonly string[];
  readonly energyTypeCount: number;
  readonly distinctDefinitions: number;
  readonly cards: readonly { readonly definitionKey: string; readonly deckLimitKey: string; readonly copies: number; readonly opcodes: readonly string[] }[];
};

export type MetricsOptions = {
  readonly starterPrintingIds?: readonly string[];
  /** Energia configurada quando `deck` é só a lista de entradas. */
  readonly energyTypes?: readonly string[];
};

/** Linhas evolutivas completas dentro do deck: raízes (Básico ou Fóssil) alcançadas por alguma evolução presente. */
function evolutionRoots(defs: readonly CardDefinition[]): string[] {
  const byKey = new Map<string, CardDefinition>();
  for (const def of defs) byKey.set(def.deckLimitKey, def);
  const roots = new Set<string>();
  const rootOf = (def: CardDefinition, depth: number): string | null => {
    if (depth > 4) return null;
    if (!isPokemon(def)) return isFossil(def) ? def.deckLimitKey : null;
    if (def.stage === 'BASIC') return def.deckLimitKey;
    for (const key of def.evolvesFrom) {
      const prev = byKey.get(key);
      if (!prev) continue;
      const root = rootOf(prev, depth + 1);
      if (root) return root;
    }
    return null;
  };
  for (const def of defs) {
    if (!isPokemon(def) || def.stage === 'BASIC') continue;
    const root = rootOf(def, 0);
    if (root) roots.add(root);
  }
  return [...roots].sort();
}

/** Métricas de composição do snapshot: aceita o deck completo ou só as entradas (Energia via `options.energyTypes`). */
export function deckMetrics(input: DeckInput | readonly DeckEntry[], catalog: DeckCatalog, options: MetricsOptions = {}): DeckMetrics {
  const deck: DeckInput = Array.isArray(input) ? { entries: input as readonly DeckEntry[], energyTypes: options.energyTypes ?? [] } : input as DeckInput;
  const resolved = resolveEntries(deck.entries, catalog);
  const starter = new Set(options.starterPrintingIds ?? []);
  const stageCopies: Record<Stage, number> = { BASIC: 0, STAGE_1: 0, STAGE_2: 0 };
  const ruleBoxCopies: Record<RuleBox, number> = { NONE: 0, EX: 0, MEGA_EX: 0 };
  const subtypeCopies: Record<TrainerSubtype, number> = { ITEM: 0, SUPPORTER: 0, TOOL: 0, STADIUM: 0 };
  const setCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};
  const opcodeCardCopies: Record<string, number> = {};
  const perDefinition = new Map<string, { def: CardDefinition; copies: number }>();
  let totalCards = 0, pokemonCopies = 0, trainerCopies = 0, fossilCopies = 0, starterPrintingCount = 0;
  for (const { entry, printing, def } of resolved) {
    const n = entry.count;
    totalCards += n;
    setCounts[printing.setId] = (setCounts[printing.setId] ?? 0) + n;
    if (starter.has(printing.printingId)) starterPrintingCount += n;
    if (isPokemon(def)) {
      pokemonCopies += n;
      for (const t of def.types) typeCounts[t] = (typeCounts[t] ?? 0) + n;
      stageCopies[def.stage] += n;
      ruleBoxCopies[def.ruleBox] += n;
    } else {
      trainerCopies += n;
      subtypeCopies[def.subtype] += n;
      if (isFossil(def)) fossilCopies += n;
    }
    const key = definitionKey(def.id, def.version);
    const prev = perDefinition.get(key);
    perDefinition.set(key, { def, copies: (prev?.copies ?? 0) + n });
  }
  const cards = [...perDefinition.entries()].map(([key, { def, copies }]) => ({ definitionKey: key, deckLimitKey: def.deckLimitKey, copies, opcodes: cardOpcodes(def) }))
    .sort((a, b) => (a.definitionKey < b.definitionKey ? -1 : a.definitionKey > b.definitionKey ? 1 : 0));
  for (const card of cards) for (const op of card.opcodes) opcodeCardCopies[op] = (opcodeCardCopies[op] ?? 0) + card.copies;
  const basics = [...perDefinition.values()].filter(({ def }) => isPokemon(def) && def.stage === 'BASIC');
  const roots = evolutionRoots([...perDefinition.values()].map((v) => v.def));
  const energyTypes = [...deck.energyTypes];
  return {
    totalCards, pokemonCopies, trainerCopies,
    basicCopies: basics.reduce((sum, b) => sum + b.copies, 0),
    distinctBasics: basics.length,
    fossilCopies, stageCopies, ruleBoxCopies, subtypeCopies,
    distinctEvolutionLines: roots.length, evolutionLineRoots: roots,
    setCounts, typeCounts, starterPrintingCount, opcodeCardCopies,
    energyTypes, energyTypeCount: new Set(energyTypes).size,
    distinctDefinitions: perDefinition.size,
    cards,
  };
}

// ---------------------------------------------------------------- composição de objetivos

export type DeckCompositionCriteria = {
  /** Definições distintas de Pokémon Básicos elegíveis (Fósseis excluídos). */
  readonly minBasic?: number;
  readonly maxRuleBoxCopies?: { readonly EX?: number; readonly MEGA_EX?: number };
  readonly minRuleBoxCopies?: { readonly EX?: number; readonly MEGA_EX?: number };
  readonly exactEnergyTypeCount?: number;
  readonly minSubtypeCopies?: { readonly TOOL?: number; readonly STADIUM?: number; readonly ITEM?: number; readonly SUPPORTER?: number };
  /** Cópias de cartas cujo efeito estruturado usa ao menos um dos opcodes (`MODIFY:<stat>` aceito). */
  readonly minCardsWithOpcode?: { readonly opcodes: readonly string[]; readonly count: number };
  readonly minDistinctEvolutionLines?: number;
  readonly maxStarterPrintings?: number;
  readonly minSetCards?: { readonly setIds: readonly string[]; readonly count: number };
  readonly minTypeCards?: { readonly types: readonly string[]; readonly count: number };
};

export function cardsWithAnyOpcode(metrics: DeckMetrics, opcodes: readonly string[]): number {
  return metrics.cards.filter((card) => card.opcodes.some((op) => opcodes.includes(op))).reduce((sum, card) => sum + card.copies, 0);
}

export function evaluateComposition(metrics: DeckMetrics, criteria: DeckCompositionCriteria): { readonly ok: boolean; readonly failures: readonly string[] } {
  const failures: string[] = [];
  if (criteria.minBasic !== undefined && metrics.distinctBasics < criteria.minBasic) failures.push(`minBasic ${metrics.distinctBasics}<${criteria.minBasic}`);
  for (const box of ['EX', 'MEGA_EX'] as const) {
    const max = criteria.maxRuleBoxCopies?.[box];
    if (max !== undefined && metrics.ruleBoxCopies[box] > max) failures.push(`max${box} ${metrics.ruleBoxCopies[box]}>${max}`);
    const min = criteria.minRuleBoxCopies?.[box];
    if (min !== undefined && metrics.ruleBoxCopies[box] < min) failures.push(`min${box} ${metrics.ruleBoxCopies[box]}<${min}`);
  }
  if (criteria.exactEnergyTypeCount !== undefined && metrics.energyTypeCount !== criteria.exactEnergyTypeCount) failures.push(`energyTypes ${metrics.energyTypeCount}≠${criteria.exactEnergyTypeCount}`);
  for (const subtype of ['TOOL', 'STADIUM', 'ITEM', 'SUPPORTER'] as const) {
    const min = criteria.minSubtypeCopies?.[subtype];
    if (min !== undefined && metrics.subtypeCopies[subtype] < min) failures.push(`min${subtype} ${metrics.subtypeCopies[subtype]}<${min}`);
  }
  if (criteria.minCardsWithOpcode) {
    const n = cardsWithAnyOpcode(metrics, criteria.minCardsWithOpcode.opcodes);
    if (n < criteria.minCardsWithOpcode.count) failures.push(`opcodes ${n}<${criteria.minCardsWithOpcode.count}`);
  }
  if (criteria.minDistinctEvolutionLines !== undefined && metrics.distinctEvolutionLines < criteria.minDistinctEvolutionLines) failures.push(`lines ${metrics.distinctEvolutionLines}<${criteria.minDistinctEvolutionLines}`);
  if (criteria.maxStarterPrintings !== undefined && metrics.starterPrintingCount > criteria.maxStarterPrintings) failures.push(`starter ${metrics.starterPrintingCount}>${criteria.maxStarterPrintings}`);
  if (criteria.minSetCards) {
    const n = criteria.minSetCards.setIds.reduce((sum, id) => sum + (metrics.setCounts[id] ?? 0), 0);
    if (n < criteria.minSetCards.count) failures.push(`sets ${n}<${criteria.minSetCards.count}`);
  }
  if (criteria.minTypeCards) {
    const n = criteria.minTypeCards.types.reduce((sum, t) => sum + (metrics.typeCounts[t] ?? 0), 0);
    if (n < criteria.minTypeCards.count) failures.push(`types ${n}<${criteria.minTypeCards.count}`);
  }
  return { ok: failures.length === 0, failures };
}

// ---------------------------------------------------------------- validação

export function validateDeck(entries: readonly DeckEntry[], catalog: DeckCatalog, options: ValidateDeckOptions): DeckValidation {
  const errors: DeckIssue<DeckIssueCode>[] = [];
  const warnings: DeckIssue<DeckWarningCode>[] = [];
  const deckSize = options.deckSize ?? 20;
  const maxCopies = options.maxCopiesPerName ?? 2;
  const maxEnergy = options.maxEnergyTypes ?? 3;
  const supported = new Set<string>(options.supportedOpcodes ?? OPCODES);

  for (const entry of entries) {
    if (!Number.isInteger(entry.count) || entry.count < 1) errors.push({ code: 'DECK_ENTRY_INVALID', message: `Quantidade inválida para ${entry.printingId}.`, printingId: entry.printingId });
    if (!catalog.printings.has(entry.printingId)) errors.push({ code: 'CONTENT_REFERENCE_MISSING', message: `Impressão desconhecida ${entry.printingId}.`, printingId: entry.printingId });
  }
  const resolved = resolveEntries(entries, catalog);
  if (resolved.length !== entries.length) {
    for (const entry of entries) {
      const p = catalog.printings.get(entry.printingId);
      if (p && !catalog.definitions.get(definitionKey(p.cardDefinitionId, p.cardDefinitionVersion))) {
        errors.push({ code: 'CONTENT_REFERENCE_MISSING', message: `Definição ausente para ${entry.printingId}.`, printingId: entry.printingId });
      }
    }
  }

  const total = entries.reduce((sum, e) => sum + (Number.isFinite(e.count) ? e.count : 0), 0);
  if (total !== deckSize) errors.push({ code: 'DECK_SIZE_INVALID', message: `O deck precisa conter exatamente ${deckSize} cartas (atual: ${total}).` });

  // Limite por chave de nome (artes e acabamentos não contornam o limite).
  const byKey = new Map<string, number>();
  for (const { entry, def } of resolved) byKey.set(def.deckLimitKey, (byKey.get(def.deckLimitKey) ?? 0) + entry.count);
  for (const [key, n] of [...byKey.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (n > maxCopies) errors.push({ code: 'DECK_COPY_LIMIT_EXCEEDED', message: `O limite de ${maxCopies} cópias para “${key}” foi excedido (${n}).`, deckLimitKey: key });
  }

  // Uma única versão funcional por definição.
  const versions = new Map<string, Set<number>>();
  for (const { def } of resolved) versions.set(def.id, (versions.get(def.id) ?? new Set()).add(def.version));
  for (const [id, set] of versions) {
    if (set.size > 1) errors.push({ code: 'DECK_DEFINITION_VERSION_CONFLICT', message: `A definição ${id} aparece em ${set.size} versões funcionais.` });
  }

  // Pelo menos um Básico elegível (Fósseis não contam).
  if (!resolved.some(({ def }) => isPokemon(def) && def.stage === 'BASIC')) {
    errors.push({ code: 'DECK_REQUIRES_BASIC', message: 'Inclua pelo menos um Pokémon Básico elegível (Fósseis não contam).' });
  }

  // Energia configurada: 1–3 tipos distintos entre os oito geráveis.
  const energy = options.energyTypes;
  const validEnergy = energy.length >= 1 && energy.length <= maxEnergy && new Set(energy).size === energy.length
    && energy.every((t) => (ENERGY_TYPES as readonly string[]).includes(t));
  if (!validEnergy) errors.push({ code: 'DECK_ENERGY_TYPES_INVALID', message: `Configure de 1 a ${maxEnergy} tipos distintos de Energia geráveis.` });

  // Suporte de todas as operações.
  for (const { printing, def } of resolved) {
    const unsupported = cardOpcodes(def).filter((op) => !op.includes(':') && !supported.has(op));
    if (unsupported.length) errors.push({ code: 'CARD_EFFECT_UNSUPPORTED', message: `${def.name} usa operação não suportada: ${unsupported.join(', ')}.`, printingId: printing.printingId });
  }

  // Posse (opcional): cópias por impressão.
  if (options.inventory) {
    const need = new Map<string, number>();
    for (const entry of entries) need.set(entry.printingId, (need.get(entry.printingId) ?? 0) + entry.count);
    for (const [printingId, n] of need) {
      const have = owned(options.inventory, printingId);
      // Nome da carta na mensagem (o id da impressão fica no campo `printingId`).
      const name = resolved.find((r) => r.printing.printingId === printingId)?.def.name ?? printingId;
      if (have < n) errors.push({ code: 'CARD_NOT_OWNED', message: `Você possui ${have} de ${n} cópias de ${name}.`, printingId });
    }
  }

  // ---- avisos de estratégia (§6.2): nunca bloqueiam o duelo
  const keys = new Set(resolved.map(({ def }) => def.deckLimitKey));
  const copiesOf = (key: string) => byKey.get(key) ?? 0;
  for (const { printing, def } of resolved) {
    if (!isPokemon(def)) continue;
    if (def.stage !== 'BASIC' && !def.evolvesFrom.some((k) => keys.has(k))) {
      warnings.push({ code: 'EVOLUTION_WITHOUT_PREVIOUS_STAGE', message: `${def.name} não tem o estágio anterior no deck.`, printingId: printing.printingId });
    }
    if (def.attacks.length > 0 && validEnergy && !def.attacks.some((a) => Object.entries(a.energyCost).every(([t, n]) => t === 'COLORLESS' || !n || energy.includes(t)))) {
      warnings.push({ code: 'ATTACK_ENERGY_NOT_PRODUCED', message: `Nenhum ataque de ${def.name} é pago pela Zona configurada.`, printingId: printing.printingId });
    }
    if (def.stage === 'STAGE_2') {
      const mids = def.evolvesFrom.filter((k) => keys.has(k));
      const support = mids.reduce((sum, k) => sum + copiesOf(k), 0);
      if (support < 2) warnings.push({ code: 'MULTI_PIECE_PLAN', message: `${def.name} depende de várias peças com poucas cópias do estágio anterior.`, printingId: printing.printingId });
    }
  }
  const basicCopies = resolved.filter(({ def }) => isPokemon(def) && def.stage === 'BASIC').reduce((sum, { entry }) => sum + entry.count, 0);
  if (basicCopies > 0 && basicCopies < (options.fewBasicsThreshold ?? 3)) warnings.push({ code: 'FEW_BASICS', message: `Apenas ${basicCopies} Básicos para a abertura.` });
  const multiPoint = resolved.filter(({ def }) => def.ruleBox !== 'NONE').reduce((sum, { entry }) => sum + entry.count, 0);
  if (multiPoint >= 4) warnings.push({ code: 'MANY_MULTI_POINT_TARGETS', message: `${multiPoint} cartas valem dois ou três pontos ao serem Nocauteadas.` });

  return { ok: errors.length === 0, errors, warnings };
}

export type { EnergyType };
