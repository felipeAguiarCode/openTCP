// Empório, pacotes, Descobertas e prêmios pendentes (gameplay §20, §22, §23; campanha §15–§17).
// Toda alteração de saldo, inventário e RNG econômico é confirmada numa única transação com recibo.
import type { Product } from '../content/types.ts';
import { isCleared, type NodeProgress, EMPTY_PROGRESS } from '../domain/campaign/progress.ts';
import { discoveryKey, openingKey } from '../domain/campaign/rewards.ts';
import { openPack, packResource } from '../domain/economy/packs.ts';
import type { JsonValue, Mutation, ProfileSnapshot, StorageError } from './ports/storage.ts';
import { profileRng, reloadSnapshot, requireSnapshot, type GameContext } from './context.ts';

export function progressMap(snapshot: ProfileSnapshot): Map<string, NodeProgress> {
  return new Map(snapshot.campaignProgress.map((p) => [p.nodeId, { ...EMPTY_PROGRESS, ...(p.progress as object) } as NodeProgress]));
}

export type ProductOffer = {
  readonly product: Product;
  readonly available: boolean;
  readonly owned: boolean;
  readonly affordable: boolean;
  readonly reason: string | null;
};

export function productOffers(ctx: GameContext): ProductOffer[] {
  const snap = requireSnapshot(ctx);
  const progress = progressMap(snap);
  const owned = new Set(snap.entitlements.map((e) => e.cosmeticId));
  const credits = snap.wallets.CREDITS ?? 0;
  return ctx.content.get().bundle.products.filter((p) => p.price !== null).map((product) => {
    const unlocked = product.availability.fromStart || (product.availability.afterNodeId !== null && isCleared(progress.get(product.availability.afterNodeId)));
    const isOwned = product.kind === 'COSMETIC' && !!product.cosmeticId && owned.has(product.cosmeticId);
    const affordable = credits >= (product.price?.credits ?? 0);
    const reason = !unlocked ? 'Bloqueado pela campanha' : isOwned ? 'Já adquirido' : !affordable ? 'Créditos insuficientes' : null;
    return { product, available: unlocked && !isOwned, owned: isOwned, affordable, reason };
  });
}

export async function buyProduct(ctx: GameContext, productId: string, commandId?: string): Promise<{ ok: true; receiptSummary: JsonValue } | StorageError> {
  const snap = requireSnapshot(ctx);
  const offer = productOffers(ctx).find((o) => o.product.productId === productId);
  if (!offer || !offer.available) return { ok: false, code: 'NOT_FOUND', message: offer?.reason ?? 'Produto indisponível.' };
  if (!offer.affordable) return { ok: false, code: 'INSUFFICIENT_CREDITS', message: 'Créditos insuficientes para esta compra.' };
  const product = offer.product;
  const price = product.price!.credits;
  const mutations: Mutation[] = [{ kind: 'WALLET_DELTA', resourceId: 'CREDITS', delta: -price }];
  if (product.kind === 'RANDOM_PACK' || product.kind === 'FIXED_PACK') mutations.push({ kind: 'WALLET_DELTA', resourceId: packResource(product.productId), delta: 1 });
  else if (product.kind === 'DIRECTED_CARD' && product.directedPrintingId) mutations.push({ kind: 'INVENTORY_DELTA', printingId: product.directedPrintingId, delta: 1 });
  else if (product.kind === 'COSMETIC' && product.cosmeticId) mutations.push({ kind: 'GRANT_ENTITLEMENT', cosmeticId: product.cosmeticId, origin: 'PURCHASE' });
  const summary = { productId, price, kind: product.kind };
  const result = await ctx.bus.execute({
    commandType: product.kind === 'COSMETIC' ? 'BUY_COSMETIC' : 'BUY_PRODUCT', commandId, profileId: snap.profile.profileId,
    expectedRevision: snap.profile.revision, writerEpoch: snap.profile.writerEpoch, payload: { productId, price }, mutations, summary,
  });
  if (!result.ok) return result;
  await reloadSnapshot(ctx);
  return { ok: true, receiptSummary: result.receipt.summary };
}

export type Opening = {
  readonly openingId: string; readonly productId: string; readonly printingIds: readonly string[]; readonly operationId: string;
  /** Pacote raro (todas ☆ ou acima) e 6ª carta (a última), só nos pacotes por símbolo. */
  readonly rarePack?: boolean; readonly bonus?: boolean;
};

/** Abertura: sorteio puro fora da transação; saldo, cartas, RNG e recibo confirmados juntos (gameplay §20.2). */
export async function openOwnedPack(ctx: GameContext, productId: string): Promise<{ ok: true; opening: Opening } | StorageError> {
  const snap = requireSnapshot(ctx);
  const content = ctx.content.get();
  const product = content.products.get(productId);
  if (!product) return { ok: false, code: 'NOT_FOUND', message: 'Pacote desconhecido.' };
  if ((snap.wallets[packResource(productId)] ?? 0) < 1) return { ok: false, code: 'NOT_FOUND', message: 'Você não possui este pacote.' };
  const rng = profileRng(snap);
  const result = openPack(product, rng.economyRng);
  const openingId = ctx.platform.newId('opening');
  const counts = new Map<string, number>();
  for (const id of result.printingIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  const mutations: Mutation[] = [
    { kind: 'WALLET_DELTA', resourceId: packResource(productId), delta: -1 },
    ...[...counts.entries()].map(([printingId, delta]) => ({ kind: 'INVENTORY_DELTA' as const, printingId, delta })),
    { kind: 'SET_PROFILE_RNG', rngJson: { ...rng, economyRng: result.rng } as unknown as JsonValue },
  ];
  const summary = {
    openingId, productId, printingIds: [...result.printingIds], categories: [...result.categories],
    ...(result.symbols ? { symbols: [...result.symbols], rarePack: !!result.rarePack, bonus: !!result.bonus } : {}),
  };
  const commit = await ctx.bus.execute({
    commandType: 'OPEN_PACK', profileId: snap.profile.profileId, expectedRevision: snap.profile.revision, writerEpoch: snap.profile.writerEpoch,
    payload: { openingId, productId }, mutations, grantKeys: [openingKey(openingId)], summary,
  });
  if (!commit.ok) return commit;
  await reloadSnapshot(ctx);
  return { ok: true, opening: { openingId, productId, printingIds: result.printingIds, operationId: commit.operationId, rarePack: !!result.rarePack, bonus: !!result.bonus } };
}

/** Rever uma abertura existente não consome pacote nem credita cartas (gameplay §20.3). */
export async function findOpening(ctx: GameContext, openingId: string): Promise<Opening | null> {
  const snap = requireSnapshot(ctx);
  const receipts = await ctx.storage.query({ kind: 'LIST_RECEIPTS', profileId: snap.profile.profileId, limit: 500, offset: 0 });
  const r = receipts.find((x) => x.commandType === 'OPEN_PACK' && (x.receipt.summary as { openingId?: string }).openingId === openingId);
  if (!r) return null;
  const s = r.receipt.summary as { openingId: string; productId: string; printingIds: string[]; rarePack?: boolean; bonus?: boolean };
  return { openingId: s.openingId, productId: s.productId, printingIds: s.printingIds, operationId: r.operationId, rarePack: !!s.rarePack, bonus: !!s.bonus };
}

export async function claimDiscovery(ctx: GameContext, nodeId: string, printingId: string): Promise<{ ok: true } | StorageError> {
  const snap = requireSnapshot(ctx);
  const content = ctx.content.get();
  const node = content.nodes.get(nodeId);
  if (!node || node.kind !== 'DISCOVERY' || !node.discoveryOffer?.includes(printingId)) return { ok: false, code: 'NOT_FOUND', message: 'Oferta inválida.' };
  const progress = progressMap(snap);
  const own = progress.get(nodeId) ?? EMPTY_PROGRESS;
  if (own.discoveryChoice) return { ok: false, code: 'REWARD_ALREADY_GRANTED', message: 'Descoberta já concluída.' };
  if (!node.prerequisites.allOf.every((id) => isCleared(progress.get(id)))) return { ok: false, code: 'NOT_FOUND', message: 'Encontro bloqueado.' };
  const next: NodeProgress = { ...own, discoveryChoice: printingId };
  const result = await ctx.bus.execute({
    commandType: 'CLAIM_DISCOVERY', profileId: snap.profile.profileId, expectedRevision: snap.profile.revision, writerEpoch: snap.profile.writerEpoch,
    payload: { nodeId, printingId },
    mutations: [
      { kind: 'INVENTORY_DELTA', printingId, delta: 1 },
      { kind: 'UPSERT_CAMPAIGN_PROGRESS', campaignId: content.bundle.campaignId, nodeId, campaignVersion: content.bundle.version, status: 'CLEARED', progress: next as unknown as JsonValue },
    ],
    grantKeys: [discoveryKey(content.bundle.campaignId, nodeId)],
    summary: { nodeId, printingId },
  });
  if (!result.ok) return result;
  await reloadSnapshot(ctx);
  return { ok: true };
}

export async function claimPendingReward(ctx: GameContext, rewardId: string, printingId: string): Promise<{ ok: true } | StorageError> {
  const snap = requireSnapshot(ctx);
  const pending = snap.pendingRewards.find((r) => r.rewardId === rewardId && r.status === 'PENDING');
  if (!pending) return { ok: false, code: 'REWARD_ALREADY_GRANTED', message: 'Prêmio já escolhido.' };
  const options = pending.options as { printingIds: string[]; copies: number };
  if (!options.printingIds.includes(printingId)) return { ok: false, code: 'NOT_FOUND', message: 'Opção inválida.' };
  const result = await ctx.bus.execute({
    commandType: 'CLAIM_PENDING_REWARD', profileId: snap.profile.profileId, expectedRevision: snap.profile.revision, writerEpoch: snap.profile.writerEpoch,
    payload: { rewardId, printingId },
    mutations: [
      { kind: 'CLAIM_PENDING_REWARD', rewardId, choice: { printingId } },
      { kind: 'INVENTORY_DELTA', printingId, delta: options.copies },
    ],
    summary: { rewardId, printingId, copies: options.copies },
  });
  if (!result.ok) return result;
  await reloadSnapshot(ctx);
  return { ok: true };
}
