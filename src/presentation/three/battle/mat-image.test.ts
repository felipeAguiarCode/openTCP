// Imagem local do tapete na mesa 3D (interface §23.26; UI-111/112/113): caixa 4:3 que cobre a mesa sem
// distorcer, recorte → coordenadas de textura, dono exibido pela mesma regra do tapete procedural, e asset
// ausente/ilegível → status `missing` (tapete neutro) sem exceção, com as texturas devolvidas ao cache.
import { describe, expect, it } from 'vitest';
import type { RenderSystem } from '../core/render-system.ts';
import { createTextureCache } from '../core/resources.ts';
import { coverBox4x3, createMatImageLayer, cropTexCoord, matImageKey, MAT_IMAGE_OPACITY, type MatImageSource, type MatImageStatus } from './mat-image.ts';
import { NEUTRAL_PLAYMAT, resolveDisplayedPlaymat, type BattlePresentationInput, type CosmeticVisualInput } from './playmat.ts';

const source = (over: Partial<MatImageSource> = {}): MatImageSource => ({
  id: 'asset-1', url: 'blob:x', width: 640, height: 360, crop: { x: 0.125, y: 0, w: 0.75, h: 1 }, baseHex: '#204060', ...over,
});

describe('caixa 4:3 e recorte', () => {
  it('cobre um retângulo largo sem distorcer (altura cresce, centrada)', () => {
    const b = coverBox4x3(-8, 8, -3, 3);
    expect(b.w / b.h).toBeCloseTo(4 / 3, 9);
    expect(b.x0).toBe(-8);
    expect(b.w).toBe(16);
    expect(b.z0 + b.h / 2).toBeCloseTo(0, 9);
    expect(b.z0).toBeLessThanOrEqual(-3);
    expect(b.z0 + b.h).toBeGreaterThanOrEqual(3);
  });

  it('cobre um retângulo alto sem distorcer (largura cresce, centrada)', () => {
    const b = coverBox4x3(0, 4, 0, 6);
    expect(b.w / b.h).toBeCloseTo(4 / 3, 9);
    expect(b.h).toBe(6);
    expect(b.x0 + b.w / 2).toBeCloseTo(2, 9);
    expect(b.x0).toBeLessThanOrEqual(0);
  });

  it('cantos da caixa caem nos cantos do recorte (v para cima: topo da imagem no lado distante)', () => {
    const crop = { x: 0.125, y: 0.1, w: 0.75, h: 0.8 };
    expect(cropTexCoord(crop, 0, 0)).toEqual({ s: 0.125, t: 0.9 });
    const end = cropTexCoord(crop, 1, 1);
    expect(end.s).toBeCloseTo(0.875, 9);
    expect(end.t).toBeCloseTo(0.1, 9);
  });

  it('identidade da fonte distingue pendente, ausente e carregável', () => {
    expect(matImageKey(null)).toBe('none');
    expect(matImageKey(source({ pending: true, url: null }))).not.toBe(matImageKey(source({ url: null })));
    expect(matImageKey(source())).not.toBe(matImageKey(source({ url: null })));
  });
});

describe('dono exibido da imagem (mesma regra do tapete procedural)', () => {
  const grove: CosmeticVisualInput = { cosmeticId: 'mat-grove', visual: { palette: ['#2E7D32', '#A5D6A7'], pattern: 'LEAVES', accentHex: '#1B5E20' } };
  const mine = source();
  const presentation = (displayMode: BattlePresentationInput['displayMode']): BattlePresentationInput => ({
    arenaId: 'a', displayMode, playerCosmetics: { playmat: grove, matImage: mine }, opponentCosmetics: { playmat: grove },
  });

  it('TURN_OWNER: no meu turno a minha imagem, com o procedural neutro por baixo', () => {
    const d = resolveDisplayedPlaymat({ viewer: 'A', currentPlayer: 'A' }, presentation('TURN_OWNER'));
    expect(d.image).toBe(mine);
    expect(d.playmat).toBe(NEUTRAL_PLAYMAT);
  });

  it('TURN_OWNER: no turno do adversário o tapete dele, sem imagem; a chave muda (crossfade de 280 ms)', () => {
    const me = resolveDisplayedPlaymat({ viewer: 'A', currentPlayer: 'A' }, presentation('TURN_OWNER'));
    const them = resolveDisplayedPlaymat({ viewer: 'A', currentPlayer: 'B' }, presentation('TURN_OWNER'));
    expect(them.image).toBeNull();
    expect(them.playmat).toBe(grove);
    expect(them.key).not.toBe(me.key);
  });

  it('PLAYER_FIXED mantém a minha imagem; NEUTRAL não mostra imagem', () => {
    expect(resolveDisplayedPlaymat({ viewer: 'A', currentPlayer: 'B' }, presentation('PLAYER_FIXED')).image).toBe(mine);
    const n = resolveDisplayedPlaymat({ viewer: 'A', currentPlayer: 'A' }, presentation('NEUTRAL'));
    expect(n.image).toBeNull();
    expect(n.playmat).toBe(NEUTRAL_PLAYMAT);
  });

  it('a chave muda quando a URL chega ou o asset falta', () => {
    const p = (img: MatImageSource): BattlePresentationInput => ({ ...presentation('PLAYER_FIXED'), playerCosmetics: { matImage: img } });
    const at = { viewer: 'A', currentPlayer: 'A' } as const;
    const keys = new Set([source({ pending: true, url: null }), source({ url: null }), source()].map((img) => resolveDisplayedPlaymat(at, p(img)).key));
    expect(keys.size).toBe(3);
  });
});

describe('camada da imagem sem DOM / com asset ausente', () => {
  const fakeRs = () => {
    const textures = createTextureCache(64 * 1024 * 1024);
    let renders = 0;
    const rs = { textures, anisotropy: () => 4, requestRender: () => { renders += 1; } } as unknown as RenderSystem;
    return { rs, textures, renders: () => renders };
  };

  it('asset ausente → missing, camada invisível, sem exceção; textura devolvida ao trocar', () => {
    const { rs, textures } = fakeRs();
    const seen: MatImageStatus[] = [];
    const layer = createMatImageLayer(rs, (s) => seen.push(s));
    expect(layer.status()).toBe('none');
    layer.show(source({ pending: true, url: null }), 0);
    expect(layer.status()).toBe('loading');
    expect(layer.mesh.visible).toBe(false);
    expect(() => layer.show(source({ url: null }), 0)).not.toThrow();
    expect(layer.status()).toBe('missing');
    expect(layer.mesh.visible).toBe(false);
    expect(seen).toEqual(['loading', 'missing']);
    const key = textures.keys()[0]!;
    expect(textures.refCount(key)).toBe(1);
    layer.show(null, 0);
    expect(layer.status()).toBe('none');
    expect(textures.refCount(key)).toBe(0);
    layer.dispose();
  });

  it('sem DOM a decodificação falha de forma recuperável (missing), e o crossfade termina e libera a anterior', () => {
    const { rs, textures } = fakeRs();
    const layer = createMatImageLayer(rs, () => undefined);
    layer.show(source(), 0);
    expect(layer.status()).toBe('missing');
    layer.show(source({ id: 'asset-2' }), 280);
    expect(textures.keys()).toHaveLength(2);
    let animating = true;
    for (let i = 0; i < 40 && animating; i += 1) animating = layer.update(16);
    expect(animating).toBe(false);
    const refs = textures.keys().map((k) => textures.refCount(k));
    expect(refs.sort()).toEqual([0, 1]);
    layer.dispose();
    expect(textures.keys().map((k) => textures.refCount(k))).toEqual([0, 0]);
  });

  it('opacidade igual à da mesa 2D', () => {
    expect(MAT_IMAGE_OPACITY).toBe(0.55);
  });
});
