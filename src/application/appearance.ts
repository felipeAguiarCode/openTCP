// Oficina de aparência (interface §23.21–§23.29; persistencia §13.1): presets imutáveis por revisão,
// precedência deck > perfil > neutro, rascunho separado e aplicação atômica num único COMMIT.
import type { Cosmetic, CosmeticPresetContent } from '../content/types.ts';
import { isCleared } from '../domain/campaign/progress.ts';
import type { ContentIndex } from './content.ts';
import { reloadSnapshot, requireSnapshot, type GameContext } from './context.ts';
import { progressMap } from './economy.ts';
import type { JsonValue, Mutation, ProfileSnapshot, StorageError } from './ports/storage.ts';

export type PresetParams = {
  readonly material: 'FABRIC' | 'MATTE' | 'SYNTHETIC';
  readonly patternOpacity: number;
  readonly border: 'SIMPLE' | 'DOUBLE' | 'STITCH' | 'GLOW';
  readonly ambient: 'OFF' | 'LIGHT' | 'DEFAULT';
  readonly attackReaction: 'OFF' | 'WAVE';
  readonly hideArt: boolean;
};

/**
 * Imagem local do tapete (interface §23.26): cópia normalizada guardada como asset (SHA-256), recorte 4:3
 * não destrutivo em coordenadas normalizadas e cor de base para compor a transparência.
 */
export type CustomMatImage = {
  readonly assetId: string;
  readonly width: number;
  readonly height: number;
  readonly crop: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly baseHex: string;
};

export type PresetConfig = CosmeticPresetContent & {
  readonly name: string;
  readonly variant: string | null;
  readonly params: PresetParams;
  readonly customImage?: CustomMatImage | null;
};

export const MAT_ASPECT = 4 / 3;

/** Maior recorte 4:3 centralizado da imagem. */
export function defaultMatCrop(width: number, height: number): CustomMatImage['crop'] {
  const imageAspect = width / height;
  if (imageAspect >= MAT_ASPECT) {
    const w = MAT_ASPECT / imageAspect;
    return { x: (1 - w) / 2, y: 0, w, h: 1 };
  }
  const h = imageAspect / MAT_ASPECT;
  return { x: 0, y: (1 - h) / 2, w: 1, h };
}

/** Recorte 4:3 com zoom (1 = maior recorte) e centro normalizado, sempre dentro da imagem. */
export function matCrop(width: number, height: number, zoom: number, cx: number, cy: number): CustomMatImage['crop'] {
  const full = defaultMatCrop(width, height);
  const z = Math.min(4, Math.max(1, zoom));
  const w = full.w / z;
  const h = full.h / z;
  const clamp = (v: number, size: number) => Math.min(1 - size, Math.max(0, v - size / 2));
  return { x: clamp(cx, w), y: clamp(cy, h), w, h };
}

export const DEFAULT_PARAMS: PresetParams = { material: 'FABRIC', patternOpacity: 0.18, border: 'SIMPLE', ambient: 'LIGHT', attackReaction: 'WAVE', hideArt: false };

const MATERIALS: readonly PresetParams['material'][] = ['FABRIC', 'MATTE', 'SYNTHETIC'];
const BORDERS: readonly PresetParams['border'][] = ['SIMPLE', 'DOUBLE', 'STITCH', 'GLOW'];
const AMBIENTS: readonly PresetParams['ambient'][] = ['OFF', 'LIGHT', 'DEFAULT'];
const REACTIONS: readonly PresetParams['attackReaction'][] = ['OFF', 'WAVE'];
const PRESET_KEYS = new Set(['presetId', 'playmatId', 'sleeveId', 'coinId', 'defaultEntryFlairId', 'name', 'variant', 'params', 'customImage']);
const IMAGE_KEYS = new Set(['assetId', 'width', 'height', 'crop', 'baseHex']);
const CROP_KEYS = new Set(['x', 'y', 'w', 'h']);
const PARAM_KEYS = new Set(Object.keys(DEFAULT_PARAMS));

export type AppearanceTarget = { readonly kind: 'PROFILE_DEFAULT' } | { readonly kind: 'DECK'; readonly deckId: string } | { readonly kind: 'PRESET_ONLY' };

/** Cosméticos utilizáveis: gratuitos + entitlements do perfil (não inventa posse de variantes). */
export function ownedCosmetics(content: ContentIndex, snap: ProfileSnapshot): Set<string> {
  const owned = new Set(snap.entitlements.map((e) => e.cosmeticId));
  for (const c of content.bundle.cosmetics) if (c.acquisition.kind === 'FREE') owned.add(c.cosmeticId);
  return owned;
}

export type CosmeticAvailability = { readonly cosmetic: Cosmetic; readonly owned: boolean; readonly how: string };

export function cosmeticCatalog(content: ContentIndex, snap: ProfileSnapshot): CosmeticAvailability[] {
  const owned = ownedCosmetics(content, snap);
  const progress = progressMap(snap);
  return content.bundle.cosmetics.map((cosmetic) => {
    const a = cosmetic.acquisition;
    const node = a.requiredCompletedNodeId ? content.nodes.get(a.requiredCompletedNodeId) : null;
    const unlocked = !a.requiredCompletedNodeId || isCleared(progress.get(a.requiredCompletedNodeId));
    const how = owned.has(cosmetic.cosmeticId) ? (a.kind === 'FREE' ? 'Gratuito' : 'Possuído')
      : a.kind === 'EMPORIUM' ? (unlocked ? `Empório: ${a.credits} Créditos` : `Empório após ${node?.title ?? a.requiredCompletedNodeId}`)
      : a.kind === 'GRANT' ? `Recompensa${node ? ` de ${node.title}` : ' da campanha'}` : 'Gratuito';
    return { cosmetic, owned: owned.has(cosmetic.cosmeticId), how };
  });
}

/** Configuração efetiva para a próxima tentativa (precedência §23.24). */
export function effectiveConfig(content: ContentIndex, snap: ProfileSnapshot, deckId: string | null): { config: PresetConfig; source: 'DECK' | 'PROFILE' | 'NEUTRAL' } {
  const deck = deckId ? snap.decks.find((d) => d.deckId === deckId) : null;
  const find = (presetId: string | null, revision: number | null) => snap.presets.find((p) => p.presetId === presetId && p.revision === revision)?.config as PresetConfig | undefined;
  if (deck?.appearance?.mode === 'OVERRIDE') {
    const c = find(deck.appearance.presetId, deck.appearance.presetRevision);
    if (c) return { config: normalize(c), source: 'DECK' };
  }
  if (snap.appearance) return { config: normalize(snap.appearance.config as PresetConfig), source: 'PROFILE' };
  return { config: neutralConfig(content), source: 'NEUTRAL' };
}

export function neutralConfig(content: ContentIndex): PresetConfig {
  const base = content.bundle.cosmeticPresets.find((p) => p.presetId === 'preset-player-default') ?? content.bundle.cosmeticPresets[0]!;
  return { ...base, name: 'Neutro', variant: null, params: DEFAULT_PARAMS };
}

function normalize(c: Partial<PresetConfig>): PresetConfig {
  return {
    presetId: c.presetId ?? 'preset', playmatId: c.playmatId ?? 'mat-neutral', sleeveId: c.sleeveId ?? 'sleeve-neutral', coinId: c.coinId ?? 'coin-neutral',
    defaultEntryFlairId: c.defaultEntryFlairId ?? 'flair-basic', name: c.name ?? 'Aparência', variant: c.variant ?? null, params: { ...DEFAULT_PARAMS, ...(c.params ?? {}) },
    customImage: c.customImage ?? null,
  };
}

export function validatePreset(content: ContentIndex, snap: ProfileSnapshot, config: PresetConfig): string[] {
  const owned = ownedCosmetics(content, snap);
  const errors: string[] = [];
  const check = (id: string, kind: Cosmetic['kind'], label: string) => {
    const c = content.cosmetics.get(id);
    if (!c || c.kind !== kind) errors.push(`${label} desconhecido.`);
    else if (!owned.has(id)) errors.push(`${label} “${c.names['pt-BR']}” ainda não foi obtido.`);
  };
  // Só campos conhecidos chegam ao commit (R-077): nada de cor, recorte ou referência livre não validada.
  for (const key of Object.keys(config)) if (!PRESET_KEYS.has(key)) errors.push(`Campo não permitido no preset: ${key}.`);
  for (const key of Object.keys(config.params ?? {})) if (!PARAM_KEYS.has(key)) errors.push(`Propriedade não permitida: ${key}.`);
  check(config.playmatId, 'PLAYMAT', 'Tapete');
  check(config.sleeveId, 'SLEEVE', 'Verso');
  check(config.coinId, 'COIN', 'Moeda');
  check(config.defaultEntryFlairId, 'FLAIR', 'Efeito de entrada');
  const p = config.params;
  if (!MATERIALS.includes(p.material)) errors.push('Material de tapete não permitido.');
  if (!BORDERS.includes(p.border)) errors.push('Borda de tapete não permitida.');
  if (!AMBIENTS.includes(p.ambient)) errors.push('Ambiente não permitido.');
  if (!REACTIONS.includes(p.attackReaction)) errors.push('Reação ao ataque não permitida.');
  if (typeof p.hideArt !== 'boolean') errors.push('Valor inválido para ocultar a arte.');
  if (typeof p.patternOpacity !== 'number' || !Number.isFinite(p.patternOpacity) || p.patternOpacity < 0 || p.patternOpacity > 0.25) errors.push('A opacidade do padrão deve ficar entre 0 e 0,25.');
  if (config.variant !== null && (typeof config.variant !== 'string' || !/^[a-z0-9-]{1,40}$/.test(config.variant))) errors.push('Variante de tapete inválida.');
  if (typeof config.name !== 'string' || !config.name.trim() || config.name.length > 40) errors.push('Dê um nome de 1 a 40 caracteres ao preset.');
  if (config.customImage) errors.push(...validateMatImage(config.customImage));
  return errors;
}

/** Referência, dimensões, recorte 4:3 e cor da imagem local do tapete (R-077, UI-111). */
export function validateMatImage(img: CustomMatImage): string[] {
  const errors: string[] = [];
  const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  for (const key of Object.keys(img)) if (!IMAGE_KEYS.has(key)) errors.push(`Campo não permitido na imagem do tapete: ${key}.`);
  if (typeof img.assetId !== 'string' || !/^[0-9a-f]{64}$/.test(img.assetId)) errors.push('Referência de imagem do tapete inválida.');
  if (!Number.isInteger(img.width) || !Number.isInteger(img.height) || img.width < 1 || img.height < 1 || img.width > 4096 || img.height > 4096) errors.push('Dimensões da imagem do tapete inválidas.');
  const c = img.crop;
  if (!c || typeof c !== 'object' || Object.keys(c).some((k) => !CROP_KEYS.has(k)) || ![c.x, c.y, c.w, c.h].every(finite)) {
    errors.push('Recorte da imagem do tapete inválido.');
  } else {
    if (c.x < 0 || c.y < 0 || c.w <= 0 || c.h <= 0 || c.x + c.w > 1 + 1e-6 || c.y + c.h > 1 + 1e-6) errors.push('O recorte precisa ficar dentro da imagem.');
    else if (Math.abs((c.w * img.width) / (c.h * img.height) / MAT_ASPECT - 1) > 0.01) errors.push('O recorte do tapete precisa ser 4:3.');
  }
  if (typeof img.baseHex !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(img.baseHex)) errors.push('Cor de base inválida (use #RRGGBB).');
  return errors;
}

/**
 * Guarda a cópia normalizada da imagem (já validada e normalizada pelo worker de mídia) como asset do perfil,
 * sem tocar no preset salvo: só a aplicação do preset muda a aparência (UI-112).
 */
export async function storeMatImage(ctx: GameContext, asset: { readonly assetId: string; readonly mediaType: string; readonly bytes: Uint8Array; readonly width: number; readonly height: number }): Promise<{ ok: true; image: CustomMatImage } | StorageError> {
  const r = await ctx.storage.write({ kind: 'INSERT_ASSET_BLOB', assetId: asset.assetId, mediaType: asset.mediaType, bytes: asset.bytes, width: asset.width, height: asset.height, metadata: { use: 'PLAYMAT_IMAGE' } });
  if (!r.ok) return r;
  return { ok: true, image: { assetId: asset.assetId, width: asset.width, height: asset.height, crop: defaultMatCrop(asset.width, asset.height), baseHex: '#EAF4FA' } };
}

/** Salva uma nova revisão do preset e aplica ao destino no mesmo COMMIT; remove o rascunho aplicado. */
export async function savePreset(ctx: GameContext, config: PresetConfig, target: AppearanceTarget, draftContextId: string | null): Promise<{ ok: true; presetId: string; revision: number } | StorageError> {
  const snap = requireSnapshot(ctx);
  const content = ctx.content.get();
  const errors = validatePreset(content, snap, config);
  if (errors.length) return { ok: false, code: 'NOT_FOUND', message: errors.join(' ') };
  const existing = snap.presets.filter((p) => p.presetId === config.presetId);
  const presetId = existing.length ? config.presetId : ctx.platform.newId('preset');
  const revision = existing.length ? Math.max(...existing.map((p) => p.revision)) + 1 : 1;
  const stored: PresetConfig = { ...config, presetId };
  const mutations: Mutation[] = [{ kind: 'INSERT_COSMETIC_PRESET', presetId, revision, config: stored as unknown as JsonValue, assetIds: [] }];
  if (target.kind === 'PROFILE_DEFAULT') mutations.push({ kind: 'SET_PROFILE_APPEARANCE', presetId, presetRevision: revision });
  if (target.kind === 'DECK') mutations.push({ kind: 'SET_DECK_APPEARANCE', deckId: target.deckId, mode: 'OVERRIDE', presetId, presetRevision: revision });
  if (draftContextId) mutations.push({ kind: 'DELETE_APPEARANCE_DRAFT', contextId: draftContextId });
  const r = await ctx.bus.execute({
    commandType: target.kind === 'PRESET_ONLY' ? 'SAVE_COSMETIC_PRESET' : 'APPLY_APPEARANCE', profileId: snap.profile.profileId,
    expectedRevision: snap.profile.revision, writerEpoch: snap.profile.writerEpoch,
    payload: { presetId, revision, target: target as unknown as JsonValue }, mutations,
    summary: { presetId, revision, name: config.name, target: target.kind },
  });
  if (!r.ok) return r;
  await reloadSnapshot(ctx);
  return { ok: true, presetId, revision };
}

/** Deck volta a herdar a aparência padrão do perfil. */
export async function inheritProfileAppearance(ctx: GameContext, deckId: string): Promise<boolean> {
  const snap = requireSnapshot(ctx);
  const r = await ctx.bus.execute({
    commandType: 'APPLY_APPEARANCE', profileId: snap.profile.profileId, expectedRevision: snap.profile.revision, writerEpoch: snap.profile.writerEpoch,
    payload: { deckId, mode: 'INHERIT_PROFILE' }, mutations: [{ kind: 'SET_DECK_APPEARANCE', deckId, mode: 'INHERIT_PROFILE', presetId: null, presetRevision: null }],
    summary: { deckId, mode: 'INHERIT_PROFILE' },
  });
  if (r.ok) await reloadSnapshot(ctx);
  return r.ok;
}

export async function loadDraft(ctx: GameContext, contextId: string): Promise<{ revision: number; config: PresetConfig } | null> {
  const snap = requireSnapshot(ctx);
  const d = await ctx.storage.query({ kind: 'GET_APPEARANCE_DRAFT', profileId: snap.profile.profileId, contextId });
  return d ? { revision: d.revision, config: normalize(d.draft as Partial<PresetConfig>) } : null;
}

export async function saveDraft(ctx: GameContext, contextId: string, revision: number, config: PresetConfig): Promise<boolean> {
  const snap = requireSnapshot(ctx);
  const r = await ctx.storage.write({ kind: 'SAVE_APPEARANCE_DRAFT', profileId: snap.profile.profileId, contextId, revision, draft: config as unknown as JsonValue, assetIds: [], writerEpoch: snap.profile.writerEpoch });
  return r.ok;
}

/** Decks afetados ao sobrescrever um preset compartilhado (§23.25). */
export function decksUsingPreset(snap: ProfileSnapshot, presetId: string): string[] {
  return snap.decks.filter((d) => !d.archived && d.appearance?.mode === 'OVERRIDE' && d.appearance.presetId === presetId).map((d) => d.name);
}
