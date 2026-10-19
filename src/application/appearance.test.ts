// Validação de preset antes do commit (runtime §4.4/§4.6, R-077) e precedência deck > perfil > neutro.
import { describe, expect, it } from 'vitest';
import { buildBundle } from '../content/bundle.ts';
import { jcsHash } from '../domain/hash/jcs.ts';
import { DEFAULT_PARAMS, MAT_ASPECT, defaultMatCrop, effectiveConfig, matCrop, validateMatImage, validatePreset, type CustomMatImage, type PresetConfig } from './appearance.ts';
import { indexContent } from './content.ts';
import type { ProfileSnapshot } from './ports/storage.ts';

const bundle = buildBundle();
const content = indexContent({ ...bundle, contentHash: jcsHash(bundle) });
const snapshot = (owned: readonly string[] = []): ProfileSnapshot => ({
  entitlements: owned.map((cosmeticId) => ({ cosmeticId, origin: 'PURCHASE', acquiredAt: 'x' })), decks: [], presets: [], appearance: null,
} as unknown as ProfileSnapshot);
const preset = (over: Partial<PresetConfig> = {}, params: Partial<PresetConfig['params']> = {}): PresetConfig => ({
  presetId: 'p', playmatId: 'mat-academy', sleeveId: 'sleeve-neutral', coinId: 'coin-neutral', defaultEntryFlairId: 'flair-basic', name: 'Meu preset',
  variant: null, ...over, params: { ...DEFAULT_PARAMS, ...params },
});

describe('validação de preset (R-077)', () => {
  it('R-077: IDs desconhecidos, de outro tipo ou sem posse e opacidade fora de 0–0,25 são recusados antes do commit', () => {
    expect(validatePreset(content, snapshot(), preset())).toEqual([]);
    expect(validatePreset(content, snapshot(), preset({ playmatId: 'mat-inexistente' })).join()).toMatch(/Tapete desconhecido/);
    expect(validatePreset(content, snapshot(), preset({ sleeveId: 'mat-neutral' })).join()).toMatch(/Verso desconhecido/);
    expect(validatePreset(content, snapshot(), preset({ playmatId: 'mat-c01-grove' })).join()).toMatch(/ainda não foi obtido/);
    expect(validatePreset(content, snapshot(['mat-c01-grove']), preset({ playmatId: 'mat-c01-grove' }))).toEqual([]);
    expect(validatePreset(content, snapshot(), preset({}, { patternOpacity: 0.3 })).join()).toMatch(/opacidade/);
    expect(validatePreset(content, snapshot(), preset({}, { patternOpacity: -0.01 })).join()).toMatch(/opacidade/);
    expect(validatePreset(content, snapshot(), preset({ name: ' ' })).join()).toMatch(/nome/);
  });

  it('R-077: material, borda, ambiente e reação fora da allowlist, opacidade NaN e cor fora de #RRGGBB são recusados', () => {
    const invalid = [
      preset({}, { material: 'GLITTER' as never }),
      preset({}, { border: 'NEON' as never }),
      preset({}, { ambient: 'DISCO' as never }),
      preset({}, { attackReaction: 'EXPLODE' as never }),
      preset({}, { patternOpacity: Number.NaN }),
      { ...preset(), accentHex: 'red' } as PresetConfig,
    ];
    for (const config of invalid) expect(validatePreset(content, snapshot(), config).length, JSON.stringify(config.params)).toBeGreaterThan(0);
  });

  it('precedência deck > perfil > neutro na aparência efetiva da próxima tentativa', () => {
    expect(effectiveConfig(content, snapshot(), null)).toMatchObject({ source: 'NEUTRAL', config: { playmatId: 'mat-neutral' } });
  });
});

describe('imagem local do tapete (UI-111, R-077)', () => {
  const asset = 'a'.repeat(64);
  const image = (over: Partial<CustomMatImage> = {}): CustomMatImage => ({ assetId: asset, width: 2048, height: 1024, crop: defaultMatCrop(2048, 1024), baseHex: '#EAF4FA', ...over });
  const aspect = (img: CustomMatImage) => (img.crop.w * img.width) / (img.crop.h * img.height);

  it('UI-111: recorte padrão e com zoom são 4:3, centrados e dentro da imagem (sem distorcer)', () => {
    for (const [w, h] of [[2048, 1024], [1000, 1500], [1600, 1200], [4096, 300]] as const) {
      const img = image({ width: w, height: h, crop: defaultMatCrop(w, h) });
      expect(aspect(img)).toBeCloseTo(MAT_ASPECT, 6);
      expect(validateMatImage(img)).toEqual([]);
      for (const [z, cx, cy] of [[2, 0, 0], [3, 1, 1], [1.5, 0.3, 0.8]] as const) {
        const zoomed = image({ width: w, height: h, crop: matCrop(w, h, z, cx, cy) });
        expect(aspect(zoomed)).toBeCloseTo(MAT_ASPECT, 6);
        expect(validateMatImage(zoomed)).toEqual([]);
      }
    }
  });

  it('R-077: referência, recorte fora/não 4:3, NaN, cor inválida e campos extras são recusados', () => {
    expect(validateMatImage(image({ assetId: '../segredo.png' })).join()).toMatch(/Referência/);
    expect(validateMatImage(image({ crop: { x: 0.9, y: 0, w: 0.5, h: 1 } })).join()).toMatch(/dentro da imagem/);
    expect(validateMatImage(image({ crop: { x: 0, y: 0, w: 1, h: 1 } })).join()).toMatch(/4:3/);
    expect(validateMatImage(image({ crop: { x: Number.NaN, y: 0, w: 0.5, h: 1 } })).join()).toMatch(/Recorte/);
    expect(validateMatImage(image({ baseHex: 'blue' })).join()).toMatch(/Cor de base/);
    expect(validateMatImage({ ...image(), url: 'https://x' } as CustomMatImage).join()).toMatch(/não permitido/);
    const withImage = preset({ customImage: image({ baseHex: 'red' }) });
    expect(validatePreset(content, snapshot(), withImage).join()).toMatch(/Cor de base/);
    expect(validatePreset(content, snapshot(), preset({ customImage: image() }))).toEqual([]);
  });
});
