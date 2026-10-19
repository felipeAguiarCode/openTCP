// Sleeves do Pokémon TCG Pocket: todo verso com imagem do conteúdo tem o arquivo empacotado, todos são gratuitos, e os
// rivais usam sleeves do Pocket (o jogador começa com o verso padrão).
import { describe, expect, it } from 'vitest';
import { buildBundle } from '../../content/bundle.ts';
import { POCKET_SLEEVES } from '../../content/source/sleeves.generated.ts';
import { SLEEVE_ART_STEMS, sleeveArtStem, sleeveArtUrl } from './sleeves.ts';

describe('sleeves do Pocket', () => {
  const bundle = buildBundle();
  const sleeves = bundle.cosmetics.filter((c) => c.kind === 'SLEEVE');
  const pocket = sleeves.filter((c) => c.visual.assetKey?.startsWith('sleeve-art:'));

  it('os 78 sleeves viram versos gratuitos com a imagem empacotada e nome em PT-BR', () => {
    expect(POCKET_SLEEVES).toHaveLength(78);
    expect(pocket).toHaveLength(78);
    expect([...SLEEVE_ART_STEMS].sort()).toEqual(POCKET_SLEEVES.map((s) => s.stem).sort());
    for (const s of pocket) {
      expect(s.cosmeticId, s.cosmeticId).toBe(`sleeve-pocket-${sleeveArtStem(s.visual.assetKey)}`);
      expect(s.acquisition.kind, s.cosmeticId).toBe('FREE');
      expect(sleeveArtUrl(s.visual.assetKey), s.cosmeticId).toMatch(/\.webp/);
      expect(s.names['pt-BR'], s.cosmeticId).toMatch(/^Verso \S/);
      expect(s.names['pt-BR'], s.cosmeticId).not.toMatch(/ and | & /);
    }
    expect(new Set(pocket.map((s) => s.names['pt-BR'])).size).toBe(78);
    const name = (stem: string) => pocket.find((s) => s.cosmeticId === `sleeve-pocket-${stem}`)?.names['pt-BR'];
    expect(name('teamrocketsboss')).toBe('Verso Chefe da Equipe Rocket');
    expect(name('erikaandvileplume')).toBe('Verso Erika e Vileplume');
    expect(name('shinycharizard')).toBe('Verso Charizard Brilhante');
  });

  it('o verso padrão e os versos procedurais não têm imagem', () => {
    for (const id of ['sleeve-neutral', 'sleeve-c01']) expect(sleeveArtUrl(sleeves.find((s) => s.cosmeticId === id)!.visual.assetKey), id).toBeNull();
    expect(sleeveArtUrl('sleeve-art:nao-existe')).toBeNull();
  });

  it('o jogador começa com o verso padrão; cada rival usa um sleeve do Pocket', () => {
    const presets = new Map(bundle.cosmeticPresets.map((p) => [p.presetId, p.sleeveId]));
    expect(presets.get('preset-player-default')).toBe('sleeve-neutral');
    for (const [id, sleeveId] of presets) if (id !== 'preset-player-default') expect(sleeveId, id).toMatch(/^sleeve-pocket-/);
  });
});
