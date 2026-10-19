// Coleção, fichários e marcas (interface §10–§12; persistencia §11, §13.1). Projeções puras sobre o
// catálogo indexado e o snapshot; gravações via barramento (fichário) ou escrita leve (marcas).
import type { CardDefinition, CardPrinting, PokemonType } from '../domain/cards/types.ts';
import { definitionKey, isPokemon } from '../domain/cards/types.ts';
import { searchKeyV1 } from '../domain/cards/naming.ts';
import { RARITY_SYMBOL_ORDER, raritySymbol } from '../domain/cards/rarity.ts';
import { cardOpcodes } from '../domain/campaign/facts.ts';
import { printingOdds } from '../domain/economy/packs.ts';
import { isCleared } from '../domain/campaign/progress.ts';
import type { ContentIndex } from './content.ts';
import { reloadSnapshot, requireSnapshot, type GameContext } from './context.ts';
import { progressMap } from './economy.ts';
import type { JsonValue, ProfileSnapshot, StorageError } from './ports/storage.ts';

export type CollectionGroup = {
  readonly definition: CardDefinition;
  readonly key: string;
  readonly printings: readonly CardPrinting[];
  readonly owned: number;
  readonly ownedByPrinting: ReadonlyMap<string, number>;
  readonly favorite: boolean;
  readonly wishlist: boolean;
  readonly isNew: boolean;
};

export type CollectionFilter = {
  readonly search: string;
  readonly ownership: 'ALL' | 'OWNED' | 'MISSING' | 'FAVORITE' | 'WISHLIST' | 'NEW';
  readonly types: readonly PokemonType[];
  readonly category: '' | 'POKEMON' | 'TRAINER';
  readonly stage: '' | 'BASIC' | 'STAGE_1' | 'STAGE_2';
  readonly setId: string;
  /** Símbolo do Pocket (◊…♛, PROMO); vazio = todos. */
  readonly rarity: string;
  readonly ruleBox: '' | 'EX' | 'MEGA_EX' | 'NONE';
  readonly opcode: string;
  readonly sort: 'NAME' | 'NUMBER' | 'SET' | 'RARITY' | 'QUANTITY';
};

export const EMPTY_FILTER: CollectionFilter = { search: '', ownership: 'ALL', types: [], category: '', stage: '', setId: '', rarity: '', ruleBox: '', opcode: '', sort: 'NUMBER' };

const RARITY_ORDER: ReadonlyMap<string, number> = new Map(RARITY_SYMBOL_ORDER.map((s, i) => [s, i]));
/** Maior símbolo entre as impressões (☆☆☆ acima de ◊◊◊◊). */
const topRarity = (printings: readonly CardPrinting[]) => Math.max(...printings.map((p) => RARITY_ORDER.get(raritySymbol(p)) ?? 0));

/** Grupos por definição funcional; impressões e acabamentos ficam dentro do grupo (interface §10.2). */
export function collectionGroups(content: ContentIndex, snap: ProfileSnapshot): CollectionGroup[] {
  const inv = new Map(snap.inventory.map((i) => [i.printingId, i.quantity]));
  const marks = (kind: string) => new Set(snap.marks.filter((m) => m.markKind === kind).map((m) => m.subjectId));
  const fav = marks('FAVORITE');
  const wish = marks('WISHLIST');
  const seen = marks('SEEN');
  const byDef = new Map<string, CardPrinting[]>();
  for (const p of [...content.bundle.printings, ...customPrintings(content)]) {
    const key = definitionKey(p.cardDefinitionId, p.cardDefinitionVersion);
    const list = byDef.get(key) ?? [];
    list.push(p);
    byDef.set(key, list);
  }
  const groups: CollectionGroup[] = [];
  for (const [key, printings] of byDef) {
    let definition: CardDefinition;
    try { definition = content.catalog.definition(key); } catch { continue; }
    const ownedByPrinting = new Map(printings.map((p) => [p.printingId, inv.get(p.printingId) ?? 0]));
    const owned = [...ownedByPrinting.values()].reduce((a, b) => a + b, 0);
    const ids = [key, ...printings.map((p) => p.printingId)];
    groups.push({
      definition, key, printings, owned, ownedByPrinting,
      favorite: ids.some((id) => fav.has(id)), wishlist: ids.some((id) => wish.has(id)),
      isNew: owned > 0 && !content.starterPrintingIds.has(printings[0]!.printingId) && !printings.some((p) => seen.has(p.printingId)) && printings.some((p) => (inv.get(p.printingId) ?? 0) > 0),
    });
  }
  return groups;
}

function customPrintings(content: ContentIndex): CardPrinting[] {
  const base = new Set(content.bundle.printings.map((p) => p.printingId));
  return [...content.catalog.printings.values()].filter((p) => !base.has(p.printingId));
}

export function filterGroups(groups: readonly CollectionGroup[], f: CollectionFilter): CollectionGroup[] {
  const q = searchKeyV1(f.search);
  // Com uma Expansão escolhida, raridade, número e ordenação olham só as impressões daquele set (reimpressões à parte).
  const shown = (g: CollectionGroup) => (f.setId ? g.printings.filter((p) => p.setId === f.setId) : g.printings);
  const out = groups.filter((g) => {
    const d = g.definition;
    if (q && !searchKeyV1(d.name).includes(q)) return false;
    if (f.ownership === 'OWNED' && g.owned === 0) return false;
    if (f.ownership === 'MISSING' && g.owned > 0) return false;
    if (f.ownership === 'FAVORITE' && !g.favorite) return false;
    if (f.ownership === 'WISHLIST' && !g.wishlist) return false;
    if (f.ownership === 'NEW' && !g.isNew) return false;
    if (f.category && d.category !== f.category) return false;
    if (f.types.length && !(isPokemon(d) && d.types.some((t) => f.types.includes(t)))) return false;
    if (f.stage && !(isPokemon(d) && d.stage === f.stage)) return false;
    if (f.setId && !shown(g).length) return false;
    if (f.rarity && !shown(g).some((p) => raritySymbol(p) === f.rarity)) return false;
    if (f.ruleBox && d.ruleBox !== f.ruleBox) return false;
    if (f.opcode && !cardOpcodes(d).has(f.opcode)) return false;
    return true;
  });
  const first = (g: CollectionGroup) => shown(g)[0] ?? g.printings[0]!;
  const cmp: Record<CollectionFilter['sort'], (a: CollectionGroup, b: CollectionGroup) => number> = {
    NAME: (a, b) => a.definition.name.localeCompare(b.definition.name, 'pt-BR'),
    NUMBER: (a, b) => first(a).setId.localeCompare(first(b).setId) || first(a).collectorNumber.localeCompare(first(b).collectorNumber, 'pt-BR', { numeric: true }),
    SET: (a, b) => first(a).setId.localeCompare(first(b).setId),
    RARITY: (a, b) => topRarity(shown(b)) - topRarity(shown(a)),
    QUANTITY: (a, b) => b.owned - a.owned,
  };
  // Ordenação estável: desempate pelo identificador da definição.
  return out.sort((a, b) => cmp[f.sort](a, b) || a.key.localeCompare(b.key));
}

export type ObtainSource =
  | { readonly kind: 'STARTER' }
  | { readonly kind: 'NODE_REWARD'; readonly nodeId: string; readonly title: string; readonly available: boolean }
  | { readonly kind: 'DISCOVERY'; readonly nodeId: string; readonly title: string; readonly available: boolean }
  | { readonly kind: 'PACK'; readonly productId: string; readonly name: string; readonly available: boolean; readonly chance: number }
  | { readonly kind: 'EMPORIUM'; readonly productId: string; readonly credits: number; readonly available: boolean; readonly afterNodeTitle: string | null }
  | { readonly kind: 'CUSTOM' };

/** “Como obter” (interface §10.8): nó garantido, pacote elegível e oferta do Empório com pré-requisitos. */
export function howToObtain(content: ContentIndex, snap: ProfileSnapshot, printingId: string): ObtainSource[] {
  const progress = progressMap(snap);
  const cleared = (id: string | null) => id === null || isCleared(progress.get(id));
  const out: ObtainSource[] = [];
  if (content.starterPrintingIds.has(printingId)) out.push({ kind: 'STARTER' });
  for (const n of content.nodeList) {
    const prereqOk = n.prerequisites.allOf.every((p) => cleared(p));
    if (n.keyCardReward?.printingIds.includes(printingId)) out.push({ kind: 'NODE_REWARD', nodeId: n.nodeId, title: n.title, available: prereqOk });
    if (n.discoveryOffer?.includes(printingId)) out.push({ kind: 'DISCOVERY', nodeId: n.nodeId, title: n.title, available: prereqOk && !progress.get(n.nodeId)?.discoveryChoice });
  }
  for (const p of content.bundle.products) {
    if (p.kind === 'RANDOM_PACK') {
      const inPool = Object.values(p.pools ?? {}).some((pool) => pool.some((x) => x.printingId === printingId))
        || [p.tierPools, p.bonusSlot?.pools].some((pools) => Object.values(pools ?? {}).some((ids) => ids?.includes(printingId)));
      // Chance por pacote ≈ cópias esperadas (o valor é pequeno; duas cópias no mesmo pacote são raríssimas).
      const chance = inPool ? printingOdds(p).find((x) => x.printingId === printingId)?.expectedCopies ?? 0 : 0;
      if (inPool) out.push({ kind: 'PACK', productId: p.productId, name: p.name, available: p.availability.fromStart || cleared(p.availability.afterNodeId), chance });
    }
    if (p.kind === 'DIRECTED_CARD' && p.directedPrintingId === printingId && p.price) {
      out.push({ kind: 'EMPORIUM', productId: p.productId, credits: p.price.credits, available: p.availability.fromStart || cleared(p.availability.afterNodeId), afterNodeTitle: p.availability.afterNodeId ? content.nodes.get(p.availability.afterNodeId)?.title ?? null : null });
    }
  }
  if (!content.bundle.printings.some((p) => p.printingId === printingId)) out.push({ kind: 'CUSTOM' });
  return out;
}

/** Decks (confirmados ou rascunho) que usam a definição (aba “Uso nos decks”). */
export function deckUsage(content: ContentIndex, snap: ProfileSnapshot, defKey: string): { deckId: string; name: string; copies: number }[] {
  return snap.decks.filter((d) => !d.archived).map((d) => ({
    deckId: d.deckId, name: d.name,
    copies: d.entries.filter((e) => { try { return content.catalog.definitionKeyOfPrinting(e.printingId) === defKey; } catch { return false; } }).length,
  })).filter((x) => x.copies > 0);
}

export async function setMark(ctx: GameContext, markKind: 'FAVORITE' | 'WISHLIST' | 'SEEN', subjectId: string, on: boolean, subjectKind: 'PRINTING' | 'DEFINITION' = 'PRINTING'): Promise<boolean> {
  const snap = requireSnapshot(ctx);
  const r = await ctx.storage.write({ kind: 'MARK_COLLECTION', profileId: snap.profile.profileId, markKind, subjectKind, subjectId, on, writerEpoch: snap.profile.writerEpoch });
  if (r.ok) await reloadSnapshot(ctx);
  return r.ok;
}

/** Marca como vistas as impressões possuídas ainda não vistas (remove o selo “Nova”). */
export async function markSeen(ctx: GameContext, printingIds: readonly string[]): Promise<void> {
  const snap = requireSnapshot(ctx);
  const seen = new Set(snap.marks.filter((m) => m.markKind === 'SEEN').map((m) => m.subjectId));
  const todo = [...new Set(printingIds)].filter((id) => !seen.has(id));
  for (const subjectId of todo) await ctx.storage.write({ kind: 'MARK_COLLECTION', profileId: snap.profile.profileId, markKind: 'SEEN', subjectKind: 'PRINTING', subjectId, on: true, writerEpoch: snap.profile.writerEpoch });
  if (todo.length) await reloadSnapshot(ctx);
}

export type BinderDraft = {
  readonly binderId: string;
  readonly name: string;
  readonly kind: 'BINDER' | 'SHOWCASE';
  readonly layout: { readonly pages: number; readonly background: string; readonly featuredPrintingId: string | null };
  readonly sortOrder: number;
  readonly slots: readonly { readonly pageNo: number; readonly slotNo: number; readonly printingId: string }[];
};

/** Fichário guarda referências a impressões possuídas; excluir não remove cartas (interface §12.4). */
export async function saveBinder(ctx: GameContext, binder: BinderDraft): Promise<{ ok: true } | StorageError> {
  const snap = requireSnapshot(ctx);
  const owned = new Set(snap.inventory.filter((i) => i.quantity > 0).map((i) => i.printingId));
  const invalid = binder.slots.find((s) => !owned.has(s.printingId));
  if (invalid) return { ok: false, code: 'NOT_FOUND', message: 'O fichário só pode exibir cartas da sua coleção.' };
  const r = await ctx.bus.execute({
    commandType: 'SAVE_BINDER', profileId: snap.profile.profileId, expectedRevision: snap.profile.revision, writerEpoch: snap.profile.writerEpoch,
    payload: { binderId: binder.binderId, slots: binder.slots.length },
    mutations: [{ kind: 'UPSERT_BINDER', binderId: binder.binderId, name: binder.name.trim() || 'Fichário', binderKind: binder.kind, layout: binder.layout as unknown as JsonValue, sortOrder: binder.sortOrder, slots: binder.slots }],
    summary: { binderId: binder.binderId, name: binder.name },
  });
  if (!r.ok) return r;
  await reloadSnapshot(ctx);
  return { ok: true };
}

export async function archiveBinder(ctx: GameContext, binderId: string): Promise<boolean> {
  const snap = requireSnapshot(ctx);
  const r = await ctx.bus.execute({
    commandType: 'ARCHIVE_ENTITY', profileId: snap.profile.profileId, expectedRevision: snap.profile.revision, writerEpoch: snap.profile.writerEpoch,
    payload: { binderId }, mutations: [{ kind: 'SET_BINDER_ARCHIVED', binderId, archived: true }], summary: { binderId, archived: true },
  });
  if (r.ok) await reloadSnapshot(ctx);
  return r.ok;
}
