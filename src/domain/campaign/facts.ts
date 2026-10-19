// Fatos de composição de um snapshot de deck (campanha §12.1). Usa impressões reais (conjunto) e
// definições funcionais (ruleBox, subtipo, opcodes), nunca a lista editada depois.
import type { CatalogLookup } from '../battle/types.ts';
import type { CardDefinition, EffectBlock, Operation } from '../cards/types.ts';
import { definitionKey, isPokemon } from '../cards/types.ts';
import type { DeckFacts } from './objectives.ts';

function opKeys(op: Operation, out: Set<string>): void {
  out.add(op.type);
  if (op.type === 'MODIFY') out.add(`MODIFY:${op.stat}`);
  if (op.type === 'CONDITIONAL') { op.then.forEach((o) => opKeys(o, out)); op.else?.forEach((o) => opKeys(o, out)); }
  if (op.type === 'SCHEDULE_DELAYED') op.operations.forEach((o) => opKeys(o, out));
}

export function cardOpcodes(def: CardDefinition): Set<string> {
  const out = new Set<string>();
  const blocks: EffectBlock[] = [
    ...def.attacks.flatMap((a) => a.effects),
    ...def.abilities.flatMap((a) => a.effects),
    ...(def.category === 'TRAINER' ? def.trainerEffects : []),
  ];
  for (const b of blocks) opKeys(b.operation, out);
  return out;
}

export function deckFacts(printingIds: readonly string[], energyTypes: readonly string[], cat: CatalogLookup, starterPrintingIds: ReadonlySet<string>): DeckFacts {
  const subtypeCopies = { ITEM: 0, SUPPORTER: 0, TOOL: 0, STADIUM: 0 };
  const ruleBoxCopies = { EX: 0, MEGA_EX: 0 };
  const setCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};
  const opcodeCardCounts: Record<string, number> = {};
  const lines = new Set<string>();
  let basicCount = 0;
  let starterPrintingCount = 0;
  for (const printingId of printingIds) {
    const printing = cat.printing(printingId);
    const def = cat.definition(definitionKey(printing.cardDefinitionId, printing.cardDefinitionVersion));
    setCounts[printing.setId] = (setCounts[printing.setId] ?? 0) + 1;
    if (starterPrintingIds.has(printingId)) starterPrintingCount += 1;
    if (isPokemon(def)) {
      for (const t of def.types) typeCounts[t] = (typeCounts[t] ?? 0) + 1;
      if (def.stage === 'BASIC') basicCount += 1;
      else lines.add(def.evolvesFrom[0] ?? def.deckLimitKey);
      if (def.ruleBox === 'EX') ruleBoxCopies.EX += 1;
      if (def.ruleBox === 'MEGA_EX') ruleBoxCopies.MEGA_EX += 1;
    } else {
      subtypeCopies[def.subtype] += 1;
    }
    for (const key of cardOpcodes(def)) opcodeCardCounts[key] = (opcodeCardCounts[key] ?? 0) + 1;
  }
  return {
    basicCount, ruleBoxCopies, subtypeCopies, distinctEvolutionLines: lines.size, setCounts, typeCounts, starterPrintingCount,
    opcodeCardCounts, energyTypeCount: new Set(energyTypes).size,
  };
}
