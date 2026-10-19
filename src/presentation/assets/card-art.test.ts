// Arte da “Impressão completa”: chave empacotada → arquivo local; outros modos não têm imagem; importada via resolvedor.
import { afterEach, describe, expect, it } from 'vitest';
import { buildBundle } from '../../content/bundle.ts';
import { bundledArtUrl, installArtAssetResolver, printedArtSource, printedArtUrl, printedArtUrlNow } from './card-art.ts';

const face = (over: Partial<{ artMode: string; artKey: string | null; artAssetId: string | null }>) =>
  ({ artMode: 'FULL_PRINTING', artKey: null, artAssetId: null, ...over }) as Parameters<typeof printedArtSource>[0];

afterEach(() => installArtAssetResolver(null));

describe('arte da Impressão completa', () => {
  it('toda impressão A1 (001…286) tem o arquivo empacotado; chave desconhecida ou malformada não tem', () => {
    for (let n = 1; n <= 286; n += 1) expect(bundledArtUrl(`art:a1:${String(n).padStart(3, '0')}`), String(n)).toMatch(/A1-\d{3}.*\.webp/);
    for (const n of ['001', '002', '003', '005', '006', '007']) expect(bundledArtUrl(`art:pa:${n}`), n).toMatch(/PA-\d{3}.*\.webp/);
    expect(bundledArtUrl('art:a1:999')).toBeNull();
    expect(bundledArtUrl('art:a1:1')).toBeNull();
    expect(bundledArtUrl(null)).toBeNull();
  });

  it('toda impressão de todos os sets do pacote de conteúdo resolve para a imagem empacotada do próprio número', () => {
    for (const p of buildBundle().printings) {
      expect(bundledArtUrl(p.artKey), p.printingId).toMatch(new RegExp(`${p.setId.toUpperCase()}-${p.collectorNumber}.*\\.webp`));
    }
  });

  it('só FULL_PRINTING usa a imagem como face; ART_WINDOW/FULL_ART/TEMPLATE_ONLY continuam com o template', () => {
    expect(printedArtSource(face({ artKey: 'art:a1:036' }))).toBe('key:art:a1:036');
    for (const artMode of ['ART_WINDOW', 'FULL_ART', 'TEMPLATE_ONLY']) expect(printedArtSource(face({ artMode, artKey: 'art:a1:036' }))).toBeNull();
    expect(printedArtUrlNow(face({ artKey: 'art:a1:036' }))).toBe(bundledArtUrl('art:a1:036'));
  });

  it('arte importada no Estúdio resolve pelo resolvedor do boot, uma vez por asset', async () => {
    const calls: string[] = [];
    installArtAssetResolver(async (assetId) => { calls.push(assetId); return `blob:${assetId}`; });
    const imported = face({ artAssetId: 'a'.repeat(64) });
    expect(printedArtUrlNow(imported)).toBeNull();
    expect(await printedArtUrl(imported)).toBe(`blob:${'a'.repeat(64)}`);
    expect(await printedArtUrl(imported)).toBe(`blob:${'a'.repeat(64)}`);
    expect(calls).toHaveLength(1);
  });
});
