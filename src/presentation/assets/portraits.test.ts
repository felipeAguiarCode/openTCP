// Retratos (avatares) e bolas de Energia empacotados: toda chave do conteúdo resolve para um arquivo local, perfis
// antigos caem no retrato padrão e só os 8 tipos geráveis têm bola.
import { describe, expect, it } from 'vitest';
import { buildBundle } from '../../content/bundle.ts';
import { ENERGY_TYPES } from '../../domain/cards/types.ts';
import { ENERGY_ORB_TYPES, energyOrbUrl } from './energy.ts';
import { DEFAULT_PLAYER_PORTRAIT, PORTRAITS, PORTRAITS_BY_TRAINER, playerPortraitKey, portraitOf, portraitUrl } from './portraits.ts';

describe('retratos dos treinadores', () => {
  it('204 retratos de 55 treinadores, todos com URL local e rótulo', () => {
    expect(PORTRAITS).toHaveLength(204);
    expect(PORTRAITS_BY_TRAINER).toHaveLength(55);
    for (const p of PORTRAITS) {
      expect(portraitUrl(p.key), p.key).toMatch(/\.png/);
      expect(p.label.length, p.key).toBeGreaterThan(2);
    }
    expect(portraitOf('portrait:lt-surge-emote-1')).toMatchObject({ trainerName: 'Tenente Surge', variant: null });
    expect(portraitOf('portrait:erika-holiday-2020-emote-3')).toMatchObject({ trainerName: 'Erika', variant: 'Festas 2020' });
  });

  it('todo rival do conteúdo tem retrato empacotado', () => {
    for (const npc of buildBundle().npcs) expect(portraitUrl(npc.portraitAssetKey), npc.npcId).not.toBeNull();
  });

  it('avatar do jogador: a chave salva; tipo antigo, ausente ou chave inexistente → retrato padrão', () => {
    expect(portraitUrl(DEFAULT_PLAYER_PORTRAIT)).not.toBeNull();
    expect(playerPortraitKey('portrait:iono-emote-2')).toBe('portrait:iono-emote-2');
    expect(playerPortraitKey('WATER')).toBe(DEFAULT_PLAYER_PORTRAIT);
    expect(playerPortraitKey(undefined)).toBe(DEFAULT_PLAYER_PORTRAIT);
    expect(playerPortraitKey('portrait:nao-existe')).toBe(DEFAULT_PLAYER_PORTRAIT);
  });
});

describe('bolas de Energia', () => {
  it('uma bola para cada tipo gerável da Zona; Incolor e Dragão ficam com o ícone', () => {
    expect([...ENERGY_ORB_TYPES].sort()).toEqual([...ENERGY_TYPES].sort());
    for (const t of ENERGY_TYPES) expect(energyOrbUrl(t), t).toMatch(/\.webp/);
    expect(energyOrbUrl('COLORLESS')).toBeNull();
    expect(energyOrbUrl('DRAGON')).toBeNull();
  });
});
