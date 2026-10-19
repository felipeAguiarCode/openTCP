// Moedas do Pokémon TCG Pocket: toda moeda com imagem do conteúdo tem cara e coroa empacotadas, todas são gratuitas, e
// o preset padrão do jogador e os dos rivais usam moedas do Pocket.
import { describe, expect, it } from 'vitest';
import { buildBundle } from '../../content/bundle.ts';
import { POCKET_COINS } from '../../content/source/coins.generated.ts';
import { COIN_ART_STEMS, coinArtStem, coinArtUrl } from './coins.ts';

describe('moedas do Pocket', () => {
  const bundle = buildBundle();
  const coins = bundle.cosmetics.filter((c) => c.kind === 'COIN');
  const pocket = coins.filter((c) => c.visual.assetKey?.startsWith('coin-art:'));

  it('as 84 moedas viram cosméticos gratuitos com cara e coroa empacotadas', () => {
    expect(POCKET_COINS).toHaveLength(84);
    expect(pocket).toHaveLength(84);
    expect([...COIN_ART_STEMS].sort()).toEqual(POCKET_COINS.map((c) => c.stem).sort());
    for (const c of pocket) {
      expect(c.cosmeticId, c.cosmeticId).toBe(`coin-pocket-${coinArtStem(c.visual.assetKey)}`);
      expect(c.acquisition.kind, c.cosmeticId).toBe('FREE');
      expect(coinArtUrl(c.visual.assetKey, 'HEADS'), c.cosmeticId).toMatch(/-heads\.webp/);
      expect(coinArtUrl(c.visual.assetKey, 'TAILS'), c.cosmeticId).toMatch(/-tails\.webp/);
      expect(c.names['pt-BR'], c.cosmeticId).toMatch(/^Moeda \S/);
    }
    // Nomes únicos e em PT-BR onde não são nomes próprios.
    expect(new Set(pocket.map((c) => c.names['pt-BR'])).size).toBe(84);
    expect(pocket.find((c) => c.cosmeticId === 'coin-pocket-pokeball')?.names['pt-BR']).toBe('Moeda Poké Bola');
    expect(pocket.find((c) => c.cosmeticId === 'coin-pocket-shinycharizard')?.names['pt-BR']).toBe('Moeda Charizard Brilhante');
  });

  it('moedas procedurais não têm imagem', () => {
    for (const id of ['coin-neutral', 'coin-c01']) {
      const c = coins.find((x) => x.cosmeticId === id)!;
      expect(coinArtUrl(c.visual.assetKey, 'HEADS'), id).toBeNull();
    }
    expect(coinArtUrl('coin-art:nao-existe', 'HEADS')).toBeNull();
  });

  it('o preset padrão do jogador usa a Poké Bola e cada rival uma moeda do Pocket', () => {
    const presets = new Map(bundle.cosmeticPresets.map((p) => [p.presetId, p.coinId]));
    expect(presets.get('preset-player-default')).toBe('coin-pocket-pokeball');
    for (const [id, coinId] of presets) expect(coinId, id).toMatch(/^coin-pocket-/);
  });
});
