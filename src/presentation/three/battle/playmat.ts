// Playmats procedurais a partir da paleta/padrão cosmético (sem imagens empacotadas) e material de
// crossfade com dois samplers e mescla linear (runtime §14.7, interface §23.16–§23.19).
import { ShaderMaterial, type Texture } from 'three';
import type { PlayerId } from '../../../domain/battle/types.ts';
import type { Cosmetic } from '../../../content/types.ts';
import type { RenderSystem } from '../core/render-system.ts';
import { QUALITY_PROFILES } from '../core/quality.ts';
import { createVisualRng, hash53 } from '../core/rng.ts';
import { COLORS, mixHex, withAlpha } from '../core/tokens.ts';
import { DEFAULT_SLEEVE, type SleeveStyle } from '../card/face-canvas.ts';
import { paintPattern } from '../card/patterns.ts';
import { matImageKey, type MatImageSource } from './mat-image.ts';
import { acquireCanvasTexture, type TextureLease } from '../card/textures.ts';

export type PlaymatDisplayMode = 'TURN_OWNER' | 'PLAYER_FIXED' | 'NEUTRAL';

/** Subconjunto visual de um Cosmetic (content/types.ts) usado pela cena. */
export type CosmeticVisualInput = Pick<Cosmetic, 'cosmeticId'> & {
  readonly definitionVersion?: number;
  readonly visual: Pick<Cosmetic['visual'], 'palette' | 'pattern' | 'accentHex'> & { readonly assetKey?: string | null };
};

export type CosmeticsLoadout = {
  readonly playmat?: CosmeticVisualInput | null;
  readonly sleeve?: CosmeticVisualInput | null;
  readonly coin?: CosmeticVisualInput | null;
  /** Imagem local do tapete (interface §23.26), exibida sobre a mesa quando este lado é o exibido. */
  readonly matImage?: MatImageSource | null;
};

/** Tapete exibido: cosmético procedural + imagem local opcional; `key` muda quando qualquer um muda. */
export type DisplayedPlaymat = { readonly key: string; readonly playmat: CosmeticVisualInput; readonly image: MatImageSource | null };

export type BattlePresentationInput = {
  readonly arenaId: string;
  readonly playerCosmetics: CosmeticsLoadout;
  readonly opponentCosmetics: CosmeticsLoadout;
  readonly displayMode: PlaymatDisplayMode;
};

export const NEUTRAL_PLAYMAT: CosmeticVisualInput = {
  cosmeticId: 'mat-neutral',
  definitionVersion: 2,
  visual: { palette: [COLORS.boardFar, COLORS.boardNear], pattern: 'NONE', accentHex: COLORS.primary, assetKey: null },
};

export const DEFAULT_PRESENTATION: BattlePresentationInput = {
  arenaId: 'arena-neutral',
  playerCosmetics: {},
  opponentCosmetics: {},
  displayMode: 'TURN_OWNER',
};

export function playmatKeyOf(p: CosmeticVisualInput): string {
  return `${p.cosmeticId}:v${p.definitionVersion ?? 1}:${hash53(JSON.stringify(p.visual))}`;
}

/**
 * resolveDisplayedPlaymat: TURN_OWNER usa o tapete do dono do turno (não o controlador de uma decisão
 * pendente); PLAYER_FIXED mantém o do humano; NEUTRAL usa a superfície neutra de alto contraste.
 */
export function resolveDisplayedPlaymat(state: { readonly viewer: PlayerId; readonly currentPlayer: PlayerId }, presentation: BattlePresentationInput): DisplayedPlaymat {
  let owner: CosmeticsLoadout | null = null;
  if (presentation.displayMode === 'PLAYER_FIXED') owner = presentation.playerCosmetics;
  else if (presentation.displayMode === 'TURN_OWNER') {
    owner = state.currentPlayer === state.viewer ? presentation.playerCosmetics : presentation.opponentCosmetics;
  }
  const image = owner?.matImage ?? null;
  // Com imagem local, ela é a arte do tapete (como na oficina e na mesa 2D): o procedural fica neutro, sem
  // tinta nem decalque — e é também o que sobra se o asset faltar (UI-113, "usando o tapete neutro").
  const playmat = image ? NEUTRAL_PLAYMAT : owner?.playmat ?? NEUTRAL_PLAYMAT;
  return { key: image ? `${playmatKeyOf(playmat)}|img:${matImageKey(image)}` : playmatKeyOf(playmat), playmat, image };
}

export function sleeveStyleOf(cosmetic: CosmeticVisualInput | null | undefined): SleeveStyle {
  if (!cosmetic) return DEFAULT_SLEEVE;
  const [a, b, c] = cosmetic.visual.palette;
  return {
    id: cosmetic.cosmeticId,
    palette: [a ?? DEFAULT_SLEEVE.palette[0]!, b ?? mixHex(a ?? '#75C7FA', '#263A50', 0.25), c ?? '#FFFFFF'],
    pattern: cosmetic.visual.pattern,
    accentHex: cosmetic.visual.accentHex,
    assetKey: cosmetic.visual.assetKey ?? null,
  };
}

/** Tapete neutro (padrão do jogador): a mesa mostra só o fundo de duas cores da mesa 2D, sem padrão. */
export function isNeutralPlaymat(playmat: CosmeticVisualInput): boolean {
  return playmat.cosmeticId === NEUTRAL_PLAYMAT.cosmeticId || playmat.visual.pattern === 'NONE';
}

/**
 * Tingimento da superfície pelo tapete cosmético: as duas metades (lilás distante / azul próxima) recebem
 * `k` das cores-base do tapete — a divisão e o contraste da mesa continuam legíveis. Neutro: k = 0.
 */
export function playmatTint(playmat: CosmeticVisualInput): { far: string; near: string; k: number } {
  const [far = COLORS.boardFar, near = COLORS.boardNear] = playmat.visual.palette;
  return { far, near, k: isNeutralPlaymat(playmat) ? 0 : 0.32 };
}

/**
 * Decalque do tapete (4:3, fundo transparente): padrão discreto só na periferia e acentos nos cantos, sobre a
 * superfície de duas cores. Sem base opaca, círculo ou linha central (a mesa desenha os dela). O neutro só
 * mantém acentos muito suaves.
 */
export function drawPlaymatDecal(ctx: CanvasRenderingContext2D, playmat: CosmeticVisualInput, w: number, h: number): void {
  const third = playmat.visual.palette[2];
  const neutral = isNeutralPlaymat(playmat);
  const rng = createVisualRng(`playmat:${playmat.cosmeticId}`);
  ctx.clearRect(0, 0, w, h);
  if (!neutral) {
    // Padrão na periferia (≤ 0,18 de opacidade; centro e zonas tranquilos).
    const unit = w / 40;
    const patternColor = third ?? '#FFFFFF';
    ctx.globalAlpha = 0.18;
    paintPattern(ctx, playmat.visual.pattern, { x: 0, y: 0, w: w * 0.2, h }, patternColor, rng, unit);
    paintPattern(ctx, playmat.visual.pattern, { x: w * 0.8, y: 0, w: w * 0.2, h }, patternColor, rng, unit);
    ctx.globalAlpha = 0.09;
    paintPattern(ctx, playmat.visual.pattern, { x: w * 0.2, y: 0, w: w * 0.6, h: h * 0.07 }, patternColor, rng, unit);
    paintPattern(ctx, playmat.visual.pattern, { x: w * 0.2, y: h * 0.93, w: w * 0.6, h: h * 0.07 }, patternColor, rng, unit);
    ctx.globalAlpha = 1;
  }
  // Acentos nos cantos (máscaras cosméticas; não recolorem indicadores funcionais).
  ctx.strokeStyle = withAlpha(playmat.visual.accentHex || COLORS.primary, neutral ? 0.16 : 0.34);
  ctx.lineWidth = w * 0.006;
  for (const [cx, cy, a0] of [[0, 0, 0], [w, 0, Math.PI / 2], [w, h, Math.PI], [0, h, Math.PI * 1.5]] as const) {
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.08, a0, a0 + Math.PI / 2);
    ctx.stroke();
  }
}

export function acquirePlaymatTexture(rs: RenderSystem, playmat: CosmeticVisualInput): TextureLease {
  const [w, h] = QUALITY_PROFILES[rs.quality()].playmatSize;
  const lease = acquireCanvasTexture(rs, `playmat-decal:${playmatKeyOf(playmat)}:${w}`, w, h, (ctx, cw, ch) => drawPlaymatDecal(ctx, playmat, cw, ch));
  // Decalque transparente: alfa pré-multiplicado evita franjas escuras na filtragem.
  lease.texture.premultiplyAlpha = true;
  return lease;
}

const PLAYMAT_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const PLAYMAT_FRAGMENT = /* glsl */ `
uniform sampler2D mapA;
uniform sampler2D mapB;
uniform float mixT;
uniform float intro;
varying vec2 vUv;
void main() {
  gl_FragColor = mix(texture2D(mapA, vUv), texture2D(mapB, vUv), mixT);
  #include <colorspace_fragment>
}`;

/**
 * PlaymatSurface: um material, dois samplers, mescla linear (máximo de duas texturas por transição).
 * `transparent`: decalque com alfa pré-multiplicado sobre a superfície de duas cores.
 */
export function createPlaymatMaterial(initial: Texture, options: { transparent?: boolean } = {}): ShaderMaterial {
  const transparent = options.transparent ?? false;
  return new ShaderMaterial({
    name: transparent ? 'PlaymatDecal' : 'PlaymatSurface',
    vertexShader: PLAYMAT_VERTEX,
    fragmentShader: PLAYMAT_FRAGMENT,
    uniforms: { mapA: { value: initial }, mapB: { value: initial }, mixT: { value: 0 }, intro: { value: 1 } },
    transparent,
    premultipliedAlpha: transparent,
    depthWrite: !transparent,
    toneMapped: false,
  });
}
