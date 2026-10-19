// Perfis locais e concessão inicial idempotente (campanha §3.1; gameplay §19.1; persistencia §13).
import type { JsonValue, Mutation, StorageError } from './ports/storage.ts';
import { contentDeckEntries } from './content.ts';
import { newProfileRng, reloadSnapshot, type GameContext } from './context.ts';
import { onboardingKey } from '../domain/campaign/rewards.ts';
import { packResource } from '../domain/economy/packs.ts';

export type CreateProfileInput = {
  readonly displayName: string;
  readonly favoriteDeckId: string;
  readonly progressionMode?: 'STANDARD' | 'CUSTOM' | 'LAB';
  readonly accessibility?: Readonly<Record<string, JsonValue>>;
};

export async function createProfile(ctx: GameContext, input: CreateProfileInput): Promise<{ ok: true; profileId: string } | StorageError> {
  const name = input.displayName.trim();
  if (name.length < 1 || name.length > 40) return { ok: false, code: 'IMPORT_INVALID', message: 'Nome deve ter de 1 a 40 caracteres.' };
  const content = ctx.content.get();
  const bundle = content.bundle;
  const profileId = ctx.platform.newId('profile');
  const rng = newProfileRng(ctx.platform);
  const mutations: Mutation[] = [
    { kind: 'INSERT_PROFILE', displayName: name, progressionMode: input.progressionMode ?? 'STANDARD', rngJson: rng as unknown as JsonValue },
  ];
  if (bundle.onboarding.credits > 0) mutations.push({ kind: 'WALLET_DELTA', resourceId: 'CREDITS', delta: bundle.onboarding.credits });
  for (const pack of bundle.onboarding.packs) mutations.push({ kind: 'WALLET_DELTA', resourceId: packResource(pack.productId), delta: pack.count });
  for (const item of bundle.onboarding.inventory) mutations.push({ kind: 'INVENTORY_DELTA', printingId: item.printingId, delta: item.count });
  const deckIds: string[] = [];
  for (const starterId of bundle.onboarding.starterDeckIds) {
    const deck = content.decks.get(starterId);
    if (!deck) throw new Error(`CONTENT_REFERENCE_MISSING: deck inicial ${starterId}`);
    const deckId = ctx.platform.newId('deck');
    deckIds.push(deckId);
    const entries = contentDeckEntries(deck).map((printingId, i) => ({ entryNo: i + 1, printingId, entryFlairId: null }));
    mutations.push({ kind: 'INSERT_DECK', deckId, name: deck.name });
    mutations.push({ kind: 'INSERT_DECK_VERSION', deckId, revision: 1, expectedHead: 0, status: 'CONFIRMED', energyTypes: [...deck.energyTypes], validation: { valid: true, source: deck.deckId }, entries });
  }
  for (const cosmeticId of bundle.onboarding.cosmeticIds) mutations.push({ kind: 'GRANT_ENTITLEMENT', cosmeticId, origin: 'ONBOARDING' });
  const favoriteIndex = bundle.onboarding.starterDeckIds.indexOf(input.favoriteDeckId);
  const result = await ctx.bus.execute({
    commandType: 'CREATE_PROFILE_ONBOARDING', profileId, expectedRevision: 0, writerEpoch: 0,
    payload: { displayName: name, favoriteDeckId: input.favoriteDeckId, contentVersion: bundle.version },
    mutations, grantKeys: [onboardingKey(bundle.campaignId)],
    summary: { credits: bundle.onboarding.credits, decks: deckIds, packs: bundle.onboarding.packs as unknown as JsonValue },
  });
  if (!result.ok) return result;
  const settings: Record<string, JsonValue> = { ...(input.accessibility ?? {}) };
  if (favoriteIndex >= 0) settings.favoriteDeckId = deckIds[favoriteIndex]!;
  if (Object.keys(settings).length) await ctx.storage.write({ kind: 'SET_SETTINGS', profileId, values: settings });
  await reloadSnapshot(ctx, profileId);
  return { ok: true, profileId };
}

export async function selectProfile(ctx: GameContext, profileId: string): Promise<boolean> {
  await ctx.storage.bumpWriterEpoch(profileId);
  const snap = await reloadSnapshot(ctx, profileId);
  return snap !== null;
}

export async function listProfiles(ctx: GameContext) {
  return ctx.storage.query({ kind: 'LIST_PROFILES', includeArchived: false });
}

export async function saveSettings(ctx: GameContext, values: Readonly<Record<string, JsonValue>>) {
  const snap = ctx.snapshot.get();
  if (!snap) return;
  await ctx.storage.write({ kind: 'SET_SETTINGS', profileId: snap.profile.profileId, values });
  await reloadSnapshot(ctx);
}

export async function archiveProfile(ctx: GameContext, profileId: string): Promise<boolean> {
  const snap = await ctx.storage.query({ kind: 'PROFILE_SNAPSHOT', profileId });
  if (!snap) return false;
  const r = await ctx.bus.execute({
    commandType: 'ARCHIVE_PROFILE', profileId, expectedRevision: snap.profile.revision, writerEpoch: snap.profile.writerEpoch,
    payload: { archived: true }, mutations: [{ kind: 'SET_PROFILE_ARCHIVED', archived: true }], summary: { archived: true },
  });
  return r.ok;
}
