// Decks (interface §13–§14; gameplay §6; persistencia §13.1): rascunho automático como escrita leve,
// versão confirmada como operação, validação pelo domínio, importação/exportação de lista e auto-build.
import { validateDeck, type DeckEntry, type DeckValidation } from '../domain/deck/validate.ts';
import { isPokemon, type CardDefinition, type CostType, type EnergyType, ENERGY_TYPES } from '../domain/cards/types.ts';
import { searchKeyV1 } from '../domain/cards/naming.ts';
import type { ContentDeck } from '../content/types.ts';
import type { ContentIndex } from './content.ts';
import { reloadSnapshot, requireSnapshot, type GameContext } from './context.ts';
import type { DeckEntryRow, DeckRow, JsonValue, Mutation, ProfileSnapshot, StorageError } from './ports/storage.ts';

export const DECK_SIZE = 20;
export const MAX_COPIES = 2;

/** Rascunho do editor: uma linha por cópia, com o flair da entrada (deck_entries.entry_flair_id). */
export type DeckDraft = {
  readonly deckId: string;
  readonly name: string;
  readonly energyTypes: readonly string[];
  readonly energyPinned: boolean;
  readonly cards: readonly { readonly printingId: string; readonly entryFlairId: string | null }[];
};

export function draftFromRow(row: DeckRow): DeckDraft {
  return { deckId: row.deckId, name: row.name, energyTypes: [...row.energyTypes], energyPinned: true, cards: row.entries.map((e) => ({ printingId: e.printingId, entryFlairId: e.entryFlairId })) };
}

export function draftFromContentDeck(deckId: string, deck: ContentDeck, name = deck.name): DeckDraft {
  return { deckId, name, energyTypes: [...deck.energyTypes], energyPinned: true, cards: deck.entries.flatMap((e) => Array.from({ length: e.count }, () => ({ printingId: e.printingId, entryFlairId: null }))) };
}

export function entryCounts(draft: DeckDraft): DeckEntry[] {
  const counts = new Map<string, number>();
  for (const c of draft.cards) counts.set(c.printingId, (counts.get(c.printingId) ?? 0) + 1);
  return [...counts].map(([printingId, count]) => ({ printingId, count }));
}

export function inventoryMap(snap: ProfileSnapshot): Map<string, number> {
  return new Map(snap.inventory.map((i) => [i.printingId, i.quantity]));
}

export function validateDraft(content: ContentIndex, snap: ProfileSnapshot, draft: DeckDraft, requireOwnership = true): DeckValidation {
  return validateDeck(entryCounts(draft), content.catalog, { energyTypes: draft.energyTypes, ...(requireOwnership ? { inventory: inventoryMap(snap) } : {}) });
}

function defOf(content: ContentIndex, printingId: string): CardDefinition | null {
  try { return content.catalog.definition(content.catalog.definitionKeyOfPrinting(printingId)); } catch { return null; }
}

/** Pode adicionar mais uma cópia? Motivo real quando não (interface §14.5). */
/** `inventory`: mapa já montado da coleção (listas grandes chamam canAdd uma vez por impressão). */
export function canAdd(content: ContentIndex, snap: ProfileSnapshot, draft: DeckDraft, printingId: string, inventory: ReadonlyMap<string, number> = inventoryMap(snap)): string | null {
  if (draft.cards.length >= DECK_SIZE) return 'O deck já tem 20 cartas. Remova uma antes de adicionar.';
  const def = defOf(content, printingId);
  if (!def) return 'Carta desconhecida.';
  const sameName = draft.cards.filter((c) => defOf(content, c.printingId)?.deckLimitKey === def.deckLimitKey).length;
  if (sameName >= MAX_COPIES) return `Limite de ${MAX_COPIES} cópias por nome atingido.`;
  const otherVersion = draft.cards.find((c) => { const d = defOf(content, c.printingId); return d && d.id === def.id && d.version !== def.version; });
  if (otherVersion) return 'O deck já usa outra versão desta carta.';
  const owned = inventory.get(printingId) ?? 0;
  const used = draft.cards.filter((c) => c.printingId === printingId).length;
  if (used >= owned) return owned === 0 ? 'Você ainda não possui esta carta.' : 'Todas as suas cópias desta impressão já estão no deck.';
  return null;
}

export function addCard(draft: DeckDraft, printingId: string): DeckDraft {
  return { ...draft, cards: [...draft.cards, { printingId, entryFlairId: null }] };
}

export function removeCard(draft: DeckDraft, printingId: string): DeckDraft {
  const index = draft.cards.map((c) => c.printingId).lastIndexOf(printingId);
  if (index < 0) return draft;
  return { ...draft, cards: draft.cards.filter((_, i) => i !== index) };
}

/** Sugestão de Energia a partir dos custos de ataque (interface §14.9): até 3 tipos mais pedidos. */
export function suggestEnergy(content: ContentIndex, draft: DeckDraft): EnergyType[] {
  const weight = new Map<string, number>();
  for (const c of draft.cards) {
    const def = defOf(content, c.printingId);
    if (!def || !isPokemon(def)) continue;
    for (const attack of def.attacks) for (const [t, n] of Object.entries(attack.energyCost) as [CostType, number][]) if (t !== 'COLORLESS') weight.set(t, (weight.get(t) ?? 0) + n);
    for (const t of def.types) if ((ENERGY_TYPES as readonly string[]).includes(t)) weight.set(t, (weight.get(t) ?? 0) + 0.5);
  }
  return [...weight].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t as EnergyType);
}

export type DeckAnalysis = {
  readonly pokemon: number; readonly basics: number; readonly evolutions: number; readonly items: number; readonly supporters: number; readonly tools: number; readonly stadiums: number;
  readonly costHistogram: Readonly<Record<number, number>>;
  readonly exposedPoints: number;
};

export function analyzeDraft(content: ContentIndex, draft: DeckDraft): DeckAnalysis {
  let pokemon = 0; let basics = 0; let evolutions = 0; let items = 0; let supporters = 0; let tools = 0; let stadiums = 0; let exposedPoints = 0;
  const costHistogram: Record<number, number> = {};
  for (const c of draft.cards) {
    const def = defOf(content, c.printingId);
    if (!def) continue;
    if (isPokemon(def)) {
      pokemon++;
      if (def.stage === 'BASIC') basics++; else evolutions++;
      exposedPoints += def.ruleBox === 'MEGA_EX' ? 3 : def.ruleBox === 'EX' ? 2 : 1;
      for (const a of def.attacks) {
        const total = Object.values(a.energyCost).reduce((s, n) => s + (n ?? 0), 0);
        costHistogram[total] = (costHistogram[total] ?? 0) + 1;
      }
    } else if (def.category === 'TRAINER') {
      if (def.subtype === 'ITEM') items++;
      else if (def.subtype === 'SUPPORTER') supporters++;
      else if (def.subtype === 'TOOL') tools++;
      else stadiums++;
    }
  }
  return { pokemon, basics, evolutions, items, supporters, tools, stadiums, costHistogram, exposedPoints };
}

function rows(draft: DeckDraft): DeckEntryRow[] {
  return draft.cards.map((c, i) => ({ entryNo: i + 1, printingId: c.printingId, entryFlairId: c.entryFlairId }));
}

function validationJson(v: DeckValidation): JsonValue {
  return { valid: v.ok, errors: v.errors.map((e) => e.code), warnings: v.warnings.map((w) => w.code) };
}

/** Autosave do rascunho (escrita leve com CAS pela head; não gera operação). */
export async function saveDeckDraft(ctx: GameContext, draft: DeckDraft): Promise<{ ok: true; head: number } | StorageError> {
  const snap = requireSnapshot(ctx);
  const row = snap.decks.find((d) => d.deckId === draft.deckId);
  const head = row?.headRevision ?? 0;
  const v = validateDraft(ctx.content.get(), snap, draft);
  const r = await ctx.storage.write({
    kind: 'SAVE_DECK_DRAFT', profileId: snap.profile.profileId, deckId: draft.deckId, name: draft.name.trim() || 'Deck sem nome', expectedHead: head, revision: head + 1,
    energyTypes: [...draft.energyTypes], validation: validationJson(v), entries: rows(draft), createIfMissing: !row, writerEpoch: snap.profile.writerEpoch,
  });
  if (!r.ok) return r;
  await reloadSnapshot(ctx);
  return { ok: true, head: r.head ?? head + 1 };
}

/** Deck recusado pela validação antes de qualquer escrita (gameplay §6). */
export type DeckInvalid = { readonly ok: false; readonly code: 'DECK_INVALID'; readonly message: string; readonly validation: DeckValidation };

/** Confirma uma versão jogável (CONFIRM_DECK): exige deck válido e posse das cópias. */
export async function confirmDeck(ctx: GameContext, draft: DeckDraft): Promise<{ ok: true; revision: number } | StorageError | DeckInvalid> {
  const snap = requireSnapshot(ctx);
  const v = validateDraft(ctx.content.get(), snap, draft);
  if (!v.ok) return { ok: false, code: 'DECK_INVALID', message: v.errors.map((e) => e.message).join(' '), validation: v };
  const row = snap.decks.find((d) => d.deckId === draft.deckId);
  const head = row?.headRevision ?? 0;
  const mutations: Mutation[] = [];
  if (!row) mutations.push({ kind: 'INSERT_DECK', deckId: draft.deckId, name: draft.name.trim() || 'Deck sem nome' });
  mutations.push({ kind: 'INSERT_DECK_VERSION', deckId: draft.deckId, revision: head + 1, expectedHead: head, status: 'CONFIRMED', energyTypes: [...draft.energyTypes], validation: validationJson(v), entries: rows(draft), name: draft.name.trim() || 'Deck sem nome' });
  const r = await ctx.bus.execute({
    commandType: 'CONFIRM_DECK', profileId: snap.profile.profileId, expectedRevision: snap.profile.revision, writerEpoch: snap.profile.writerEpoch,
    payload: { deckId: draft.deckId, revision: head + 1, entries: draft.cards.map((c) => c.printingId) }, mutations,
    summary: { deckId: draft.deckId, name: draft.name, revision: head + 1 },
  });
  if (!r.ok) return r;
  await reloadSnapshot(ctx);
  return { ok: true, revision: head + 1 };
}

export async function archiveDeck(ctx: GameContext, deckId: string): Promise<boolean> {
  const snap = requireSnapshot(ctx);
  const r = await ctx.bus.execute({
    commandType: 'ARCHIVE_DECK', profileId: snap.profile.profileId, expectedRevision: snap.profile.revision, writerEpoch: snap.profile.writerEpoch,
    payload: { deckId }, mutations: [{ kind: 'SET_DECK_ARCHIVED', deckId, archived: true }], summary: { deckId },
  });
  if (r.ok) await reloadSnapshot(ctx);
  return r.ok;
}

// ---------------------------------------------------------------- lista JSON local (interface §13.3)

export const DECK_LIST_FORMAT = 'card-campaign-deck-list';

export type DeckListFile = { readonly format: typeof DECK_LIST_FORMAT; readonly version: 1; readonly name: string; readonly energyTypes: readonly string[]; readonly entries: readonly { readonly printingId: string; readonly count: number }[] };

export function exportDeckList(draft: DeckDraft): DeckListFile {
  return { format: DECK_LIST_FORMAT, version: 1, name: draft.name, energyTypes: [...draft.energyTypes], entries: entryCounts(draft) };
}

export type DeckImport = { readonly ok: true; readonly draft: DeckDraft; readonly missing: readonly { printingId: string; missing: number }[]; readonly unknown: readonly string[] } | { readonly ok: false; readonly message: string };

/** Importar nunca concede cartas: desconhecidas são descartadas, ausências marcadas; pode virar rascunho. */
export function importDeckList(content: ContentIndex, snap: ProfileSnapshot, raw: unknown, deckId: string): DeckImport {
  const f = raw as Partial<DeckListFile>;
  if (!f || f.format !== DECK_LIST_FORMAT) return { ok: false, message: 'Arquivo não é uma lista de deck deste jogo.' };
  if (f.version !== 1) return { ok: false, message: `Versão de lista ${String(f.version)} não suportada.` };
  if (!Array.isArray(f.entries) || f.entries.length > 40) return { ok: false, message: 'Lista inválida.' };
  const inv = inventoryMap(snap);
  const unknown: string[] = [];
  const missing: { printingId: string; missing: number }[] = [];
  const cards: { printingId: string; entryFlairId: null }[] = [];
  for (const e of f.entries) {
    if (typeof e?.printingId !== 'string' || !Number.isInteger(e.count) || e.count < 1 || e.count > MAX_COPIES) return { ok: false, message: 'Quantidade inválida na lista.' };
    if (!content.catalog.printings.has(e.printingId)) { unknown.push(e.printingId); continue; }
    const owned = inv.get(e.printingId) ?? 0;
    if (owned < e.count) missing.push({ printingId: e.printingId, missing: e.count - owned });
    for (let i = 0; i < e.count; i++) cards.push({ printingId: e.printingId, entryFlairId: null });
  }
  const energy = (Array.isArray(f.energyTypes) ? f.energyTypes : []).filter((t): t is string => (ENERGY_TYPES as readonly string[]).includes(t as string)).slice(0, 3);
  return { ok: true, draft: { deckId, name: String(f.name ?? 'Deck importado').slice(0, 40), energyTypes: energy, energyPinned: energy.length > 0, cards: cards.slice(0, DECK_SIZE) }, missing, unknown };
}

// ---------------------------------------------------------------- auto-build (interface §14.12)

/**
 * Proposta determinística a partir das cartas possuídas: linhas evolutivas dos tipos escolhidos
 * (preferindo a carta central), depois Treinadores, até 20. Nunca aplica sozinha.
 */
export function autoBuild(content: ContentIndex, snap: ProfileSnapshot, opts: { readonly types: readonly EnergyType[]; readonly corePrintingId?: string | null; readonly deckId: string; readonly name: string }): DeckDraft {
  const inv = inventoryMap(snap);
  const owned = [...inv].filter(([, n]) => n > 0).map(([printingId, n]) => ({ printingId, n, def: defOf(content, printingId) })).filter((x): x is { printingId: string; n: number; def: CardDefinition } => !!x.def);
  owned.sort((a, b) => a.def.name.localeCompare(b.def.name, 'pt-BR') || a.printingId.localeCompare(b.printingId));
  let draft: DeckDraft = { deckId: opts.deckId, name: opts.name, energyTypes: [...opts.types], energyPinned: true, cards: [] };
  const tryAdd = (printingId: string, copies: number) => {
    for (let i = 0; i < copies; i++) if (canAdd(content, snap, draft, printingId) === null) draft = addCard(draft, printingId);
  };
  const fits = (def: CardDefinition) => isPokemon(def) && (def.types.some((t) => opts.types.includes(t as EnergyType)) || def.types.includes('COLORLESS'));
  const core = opts.corePrintingId ? owned.find((o) => o.printingId === opts.corePrintingId) : null;
  const lineOf = (def: CardDefinition): CardDefinition[] => {
    const chain: CardDefinition[] = [def];
    let cur: CardDefinition | undefined = def;
    while (cur && isPokemon(cur) && cur.evolvesFrom.length) {
      const prev = owned.find((o) => isPokemon(o.def) && o.def.deckLimitKey === (cur as { evolvesFrom: readonly string[] }).evolvesFrom[0])?.def;
      if (!prev) break;
      chain.unshift(prev);
      cur = prev;
    }
    return chain;
  };
  const best = (def: CardDefinition) => owned.filter((o) => o.def.deckLimitKey === def.deckLimitKey).sort((a, b) => b.n - a.n)[0]?.printingId;
  if (core) for (const d of lineOf(core.def)) { const p = best(d); if (p) tryAdd(p, 2); }
  // Linhas completas primeiro: estágio mais alto e seus antecessores.
  const evolved = owned.filter((o) => fits(o.def) && isPokemon(o.def) && o.def.stage !== 'BASIC');
  for (const o of evolved) {
    if (draft.cards.length >= 12) break;
    const line = lineOf(o.def);
    if (line.length > 1 && isPokemon(line[0]!) && line[0]!.stage === 'BASIC') for (const d of line) { const p = best(d); if (p) tryAdd(p, 2); }
  }
  for (const o of owned) if (draft.cards.length < 12 && fits(o.def) && isPokemon(o.def) && o.def.stage === 'BASIC') tryAdd(o.printingId, 2);
  const trainers = owned.filter((o) => o.def.category === 'TRAINER').sort((a, b) => trainerRank(a.def) - trainerRank(b.def));
  for (const o of trainers) if (draft.cards.length < DECK_SIZE) tryAdd(o.printingId, 2);
  for (const o of owned) if (draft.cards.length < DECK_SIZE && fits(o.def)) tryAdd(o.printingId, 2);
  return draft;
}

function trainerRank(def: CardDefinition): number {
  if (def.category !== 'TRAINER') return 9;
  return def.subtype === 'SUPPORTER' ? 0 : def.subtype === 'ITEM' ? 1 : def.subtype === 'TOOL' ? 2 : 3;
}

export function diffDrafts(a: DeckDraft, b: DeckDraft): { added: string[]; removed: string[] } {
  const count = (d: DeckDraft) => { const m = new Map<string, number>(); for (const c of d.cards) m.set(c.printingId, (m.get(c.printingId) ?? 0) + 1); return m; };
  const ca = count(a); const cb = count(b);
  const added: string[] = []; const removed: string[] = [];
  for (const [id, n] of cb) for (let i = (ca.get(id) ?? 0); i < n; i++) added.push(id);
  for (const [id, n] of ca) for (let i = (cb.get(id) ?? 0); i < n; i++) removed.push(id);
  return { added, removed };
}

export function searchMatches(content: ContentIndex, printingId: string, query: string): boolean {
  if (!query) return true;
  const def = defOf(content, printingId);
  return !!def && searchKeyV1(def.name).includes(searchKeyV1(query));
}
