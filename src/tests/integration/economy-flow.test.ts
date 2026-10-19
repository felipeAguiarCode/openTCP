// Economia local sobre o SQLite real (WASM em memória): abertura de pacote retomada, resposta perdida depois do
// COMMIT, duas abas, relógio do sistema, saldo zerado, prévia do Empório, Descoberta e compra de cosmético.
import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from '../../infrastructure/storage/node.ts';
import { miniBundle } from '../support/mini-bundle.ts';
import { buildBundle } from '../../content/bundle.ts';
import type { BuiltBundle } from '../../content/types.ts';
import { startAttempt } from '../../application/battle.ts';
import { campaignView } from '../../application/campaign.ts';
import { createCommandBus } from '../../application/commands.ts';
import { contentInstallRows, indexContent } from '../../application/content.ts';
import { observable, reloadSnapshot, type GameContext } from '../../application/context.ts';
import { buyProduct, claimDiscovery, findOpening, openOwnedPack, productOffers, progressMap } from '../../application/economy.ts';
import type { AiPort } from '../../application/ports/ai.ts';
import { deterministicPlatform, type Platform } from '../../application/ports/platform.ts';
import type { JsonValue, ProfileSnapshot, StoragePort } from '../../application/ports/storage.ts';
import { createProfile, selectProfile } from '../../application/profiles.ts';
import { EMPTY_PROGRESS } from '../../domain/campaign/progress.ts';
import { printingOdds } from '../../domain/economy/packs.ts';
import { jcsHash } from '../../domain/hash/jcs.ts';

const idleAi: AiPort = { plan: () => Promise.reject(new Error('sem IA neste teste')), cancel: () => undefined, dispose: () => undefined };

function context(storage: StoragePort, bundle: BuiltBundle, platform: Platform = deterministicPlatform()): GameContext {
  return {
    storage, platform, bus: createCommandBus(storage, platform), content: observable(indexContent(bundle)),
    snapshot: observable<ProfileSnapshot | null>(null), ai: idleAi,
  };
}

async function setup(bundle: BuiltBundle = miniBundle(), platform?: Platform, storage?: StoragePort): Promise<GameContext> {
  const store = storage ?? await createMemoryStorage();
  if (!storage) expect((await store.installContent(contentInstallRows(bundle))).ok).toBe(true);
  const game = context(store, bundle, platform);
  const created = await createProfile(game, { displayName: 'Eco', favoriteDeckId: bundle.onboarding.starterDeckIds[0]! });
  if (!created.ok) throw new Error(created.message);
  expect(await selectProfile(game, created.profileId)).toBe(true);
  return game;
}

function realBundle(): BuiltBundle {
  const b = buildBundle();
  return { ...b, contentHash: jcsHash(b) };
}

const snap = (game: GameContext): ProfileSnapshot => game.snapshot.get()!;
const cardsOwned = (game: GameContext) => snap(game).inventory.reduce((s, i) => s + i.quantity, 0);

/** Fixture de progresso autorizada para testes (runtime R-002): marca nós como concluídos num commit. */
async function clearNodes(game: GameContext, nodeIds: readonly string[]): Promise<void> {
  const s = snap(game);
  const content = game.content.get();
  const r = await game.bus.execute({
    commandType: 'FINISH_ATTEMPT', profileId: s.profile.profileId, expectedRevision: s.profile.revision, writerEpoch: s.profile.writerEpoch,
    payload: { testFixture: [...nodeIds] },
    mutations: nodeIds.map((nodeId) => ({
      kind: 'UPSERT_CAMPAIGN_PROGRESS' as const, campaignId: content.bundle.campaignId, nodeId, campaignVersion: content.bundle.version, status: 'CLEARED' as const,
      progress: { ...EMPTY_PROGRESS, firstClearAttemptId: `fixture-${nodeId}`, wins: 1 } as unknown as JsonValue,
    })),
    summary: { testFixture: true },
  });
  expect(r.ok).toBe(true);
  await reloadSnapshot(game);
}

describe('pacotes e recibos', () => {
  it('G-046/C-033/DB-026/UI-043/UI-089/UI-095: abertura retomada mostra o mesmo recibo e as mesmas cartas, com um único crédito', async () => {
    const game = await setup();
    const before = cardsOwned(game);
    const opened = await openOwnedPack(game, 'pack-base-v1');
    if (!opened.ok) throw new Error(opened.message);
    expect(opened.opening.printingIds).toHaveLength(5);
    expect(cardsOwned(game)).toBe(before + 5);
    // Recarregar (novo contexto sobre o mesmo banco) e rever: mesmas cartas, sem novo crédito nem consumo.
    const reloaded = context(game.storage, game.content.get().bundle);
    await reloadSnapshot(reloaded, snap(game).profile.profileId);
    const again = await findOpening(reloaded, opened.opening.openingId);
    expect(again).toEqual(opened.opening);
    expect(await findOpening(reloaded, opened.opening.openingId)).toEqual(opened.opening);
    expect(cardsOwned(reloaded)).toBe(before + 5);
    expect(snap(reloaded).wallets['PACK:pack-base-v1'] ?? 0).toBe(0);
    expect(snap(reloaded).grants.filter((g) => g === `opening:${opened.opening.openingId}`)).toHaveLength(1);
    expect((await openOwnedPack(reloaded, 'pack-base-v1')).ok).toBe(false);
  });

  it('DB-025/R-015: resposta perdida depois do COMMIT recupera o recibo gravado, sem segundo efeito', async () => {
    const real = await createMemoryStorage();
    const bundle = miniBundle();
    expect((await real.installContent(contentInstallRows(bundle))).ok).toBe(true);
    let dropNextResponse = false;
    const storage: StoragePort = {
      ...real,
      commit: async (request) => {
        const r = await real.commit(request);
        if (dropNextResponse) { dropNextResponse = false; throw new Error('timeout do worker: resposta perdida'); }
        return r;
      },
    };
    const game = await setup(bundle, undefined, storage);
    const credits = snap(game).wallets.CREDITS!;
    dropNextResponse = true;
    const bought = await buyProduct(game, 'pack-base-v1', 'cmd-perdido');
    expect(bought.ok).toBe(true);
    expect(snap(game).wallets.CREDITS).toBe(credits - 100);
    const receipts = await game.storage.query({ kind: 'LIST_RECEIPTS', profileId: snap(game).profile.profileId, limit: 50, offset: 0 });
    expect(receipts.filter((r) => r.commandId === 'cmd-perdido')).toHaveLength(1);
    // Reenviar o mesmo comando devolve o mesmo recibo.
    expect((await buyProduct(game, 'pack-base-v1', 'cmd-perdido')).ok).toBe(true);
    expect(snap(game).wallets.CREDITS).toBe(credits - 100);
  });

  it('G-070: duas abas tentam abrir o mesmo pacote — uma única concessão confirmada', async () => {
    const tab1 = await setup();
    const tab2 = context(tab1.storage, tab1.content.get().bundle);
    await reloadSnapshot(tab2, snap(tab1).profile.profileId);
    const before = cardsOwned(tab1);
    const [a, b] = await Promise.all([openOwnedPack(tab1, 'pack-base-v1'), openOwnedPack(tab2, 'pack-base-v1')]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    const failed = [a, b].find((r) => !r.ok) as { code: string };
    expect(failed.code).toBe('REVISION_CONFLICT');
    await reloadSnapshot(tab1);
    expect(cardsOwned(tab1)).toBe(before + 5);
    expect(snap(tab1).wallets['PACK:pack-base-v1'] ?? 0).toBe(0);
    expect(snap(tab1).grants.filter((g) => g.startsWith('opening:'))).toHaveLength(1);
  });

  it('G-059: consultar a prévia e as probabilidades do Empório e cancelar não debita nem concede nada', async () => {
    const game = await setup();
    const revision = snap(game).profile.revision;
    const wallets = JSON.stringify(snap(game).wallets);
    const inventory = JSON.stringify(snap(game).inventory);
    const offer = productOffers(game).find((o) => o.product.productId === 'pack-base-v1')!;
    expect(offer.available && offer.affordable).toBe(true);
    expect(printingOdds(offer.product).length).toBeGreaterThan(0);
    // Cancelar = não confirmar a compra.
    await reloadSnapshot(game);
    expect(snap(game).profile.revision).toBe(revision);
    expect(JSON.stringify(snap(game).wallets)).toBe(wallets);
    expect(JSON.stringify(snap(game).inventory)).toBe(inventory);
  });
});

describe('relógio, saldo e acesso', () => {
  it('G-062/C-034/UI-051: relógio do sistema adiantado não gera pacotes, Créditos nem desbloqueios', async () => {
    const bundle = miniBundle();
    const today = await setup(bundle, deterministicPlatform(1, '2026-10-14T00:00:00.000Z'));
    const future = await setup(bundle, deterministicPlatform(1, '2099-12-31T23:59:59.000Z'));
    const facts = (g: GameContext) => ({
      wallets: snap(g).wallets, inventory: snap(g).inventory, grants: snap(g).grants, entitlements: snap(g).entitlements.map((e) => e.cosmeticId),
      statuses: [...campaignView(g.content.get(), snap(g)).statuses], offers: productOffers(g).map((o) => [o.product.productId, o.available, o.reason]),
    });
    expect(facts(future)).toEqual(facts(today));
    // O mesmo perfil reaberto com o relógio adiantado continua igual: nada expira nem é concedido pelo tempo.
    const later = context(today.storage, bundle, deterministicPlatform(500, '2101-01-01T00:00:00.000Z'));
    await reloadSnapshot(later, snap(today).profile.profileId);
    expect(facts(later)).toEqual(facts(today));
  });

  it('C-029: sem saldo, os decks gratuitos continuam utilizáveis', async () => {
    const game = await setup();
    while ((snap(game).wallets.CREDITS ?? 0) >= 100) expect((await buyProduct(game, 'pack-base-v1')).ok).toBe(true);
    expect(await buyProduct(game, 'pack-base-v1')).toMatchObject({ ok: false, code: 'INSUFFICIENT_CREDITS' });
    expect(snap(game).wallets.CREDITS ?? 0).toBeLessThan(100);
    const deck = snap(game).decks.find((d) => d.name === 'Jardim Vivo')!;
    const r = await startAttempt(game, { mode: 'CAMPAIGN', nodeId: 'T01', difficulty: 'STANDARD', deckId: deck.deckId });
    expect(r.ok).toBe(true);
  });
});

describe('Descoberta e cosméticos com o conteúdo real', () => {
  it('G-069/C-026/UI-049: Descoberta registra uma escolha; recarregar preserva opções e escolha, sem nova concessão', async () => {
    const bundle = realBundle();
    const game = await setup(bundle);
    await clearNodes(game, [...bundle.nodes.filter((n) => n.chapterId === 'P00').map((n) => n.nodeId), 'C01-E01', 'C01-E03']);
    const node = game.content.get().nodes.get('C01-E04')!;
    const offer = [...node.discoveryOffer!];
    expect(offer).toHaveLength(3);
    const before = cardsOwned(game);
    const choice = offer[1]!;
    expect((await claimDiscovery(game, 'C01-E04', choice)).ok).toBe(true);
    expect(cardsOwned(game)).toBe(before + 1);
    const reloaded = context(game.storage, bundle);
    await reloadSnapshot(reloaded, snap(game).profile.profileId);
    expect(progressMap(snap(reloaded)).get('C01-E04')?.discoveryChoice).toBe(choice);
    expect(reloaded.content.get().nodes.get('C01-E04')!.discoveryOffer).toEqual(offer);
    expect(await claimDiscovery(reloaded, 'C01-E04', offer[0]!)).toMatchObject({ ok: false, code: 'REWARD_ALREADY_GRANTED' });
    expect(await claimDiscovery(reloaded, 'C01-E04', choice)).toMatchObject({ ok: false });
    expect(cardsOwned(reloaded)).toBe(before + 1);
    expect(snap(reloaded).grants.filter((g) => g.startsWith('discovery:'))).toEqual([`discovery:${bundle.campaignId}:C01-E04`]);
  });

  it('C-053: comprar verso é permanente, debita só Créditos e não toca nas cartas', async () => {
    const bundle = realBundle();
    const game = await setup(bundle);
    await clearNodes(game, [...bundle.nodes.filter((n) => n.chapterId === 'P00').map((n) => n.nodeId), 'C01-E01', 'C01-E03']);
    const inventory = JSON.stringify(snap(game).inventory);
    const credits = snap(game).wallets.CREDITS!;
    expect((await buyProduct(game, 'cosmetic-sleeve-c01')).ok).toBe(true);
    expect(snap(game).wallets.CREDITS).toBe(credits - 200);
    expect(snap(game).entitlements.some((e) => e.cosmeticId === 'sleeve-c01' && e.origin === 'PURCHASE')).toBe(true);
    expect(JSON.stringify(snap(game).inventory)).toBe(inventory);
    // Já possuído: não vende de novo nem debita.
    expect(productOffers(game).find((o) => o.product.productId === 'cosmetic-sleeve-c01')).toMatchObject({ owned: true, available: false });
    expect((await buyProduct(game, 'cosmetic-sleeve-c01')).ok).toBe(false);
    expect(snap(game).wallets.CREDITS).toBe(credits - 200);
  });
});
