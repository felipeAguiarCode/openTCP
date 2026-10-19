// Índice imutável de definições e impressões que implementa o CatalogLookup do motor.
import type { CatalogLookup } from '../battle/types.ts';
import { definitionKey, type CardDefinition, type CardPrinting } from './types.ts';

export type Catalog = CatalogLookup & {
  readonly definitions: ReadonlyMap<string, CardDefinition>;
  readonly printings: ReadonlyMap<string, CardPrinting>;
  readonly definitionKeyOfPrinting: (printingId: string) => string;
};

export function buildCatalog(definitions: readonly CardDefinition[], printings: readonly CardPrinting[]): Catalog {
  const defs = new Map<string, CardDefinition>();
  const byKey = new Map<string, CardDefinition[]>();
  for (const def of definitions) {
    const key = definitionKey(def.id, def.version);
    if (defs.has(key)) throw new Error(`definição duplicada ${key}`);
    defs.set(key, def);
    byKey.set(def.deckLimitKey, [...(byKey.get(def.deckLimitKey) ?? []), def]);
  }
  const prints = new Map<string, CardPrinting>();
  for (const p of printings) {
    if (prints.has(p.printingId)) throw new Error(`impressão duplicada ${p.printingId}`);
    if (!defs.has(definitionKey(p.cardDefinitionId, p.cardDefinitionVersion))) throw new Error(`impressão sem definição ${p.printingId}`);
    prints.set(p.printingId, p);
  }
  return {
    definitions: defs,
    printings: prints,
    definition: (key) => {
      const def = defs.get(key);
      if (!def) throw new Error(`CONTENT_REFERENCE_MISSING: definição ${key}`);
      return def;
    },
    printing: (id) => {
      const p = prints.get(id);
      if (!p) throw new Error(`CONTENT_REFERENCE_MISSING: impressão ${id}`);
      return p;
    },
    findByDeckLimitKey: (key) => byKey.get(key) ?? [],
    definitionKeyOfPrinting: (id) => {
      const p = prints.get(id);
      if (!p) throw new Error(`CONTENT_REFERENCE_MISSING: impressão ${id}`);
      return definitionKey(p.cardDefinitionId, p.cardDefinitionVersion);
    },
  };
}
