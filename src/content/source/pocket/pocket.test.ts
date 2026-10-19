// Identidade das cartas dos sets do Pocket: ids únicos e estáveis, reimpressões apontando para as definições do A1 e
// das promos antigas, nomes PT-BR de formas regionais e Equipe Rocket.
import { describe, expect, it } from 'vitest';
import { A1_KEYS } from '../a1/cards.ts';
import { deckLimitKeyV1 } from '../../../domain/cards/naming.ts';
import { gameplayKey } from './build.ts';
import { POCKET_IDS } from './cards.ts';
import { POCKET_ROWS } from './data/index.ts';
import { pokemonName } from './names/pokemon.ts';
import { POCKET_SETS } from './registry.ts';
import { tagsOf } from './tags.ts';

const idOfRow = (setId: string, number: number) => POCKET_IDS.get(gameplayKey(POCKET_ROWS[setId]!.find((r) => r.number === number)!))!;

describe('identidade das cartas do Pocket', () => {
  it('1.210 cartas de jogo distintas com ids únicos; ids com sufixo seguem <chave>-<set>-<NNN>', () => {
    const ids = [...POCKET_IDS.values()];
    expect(ids).toHaveLength(1210);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    const suffixed = ids.filter((id) => /-(pa|pb|a1a|a2|a2a|a3|a3a|a3b|a4|a4a|a4b)-\d{3}$/.test(id));
    expect(suffixed.length).toBeGreaterThan(200);
  });

  it('reimpressões apontam para as definições do A1 e das promos antigas', () => {
    const pikachuEx = [...A1_KEYS.values()].find((c) => c.name === 'Pikachu ex')!;
    const a4bPikachuEx = POCKET_ROWS.a4b!.filter((r) => r.name === 'Pikachu ex' && r.attacks[0]!.name === 'Circle Circuit');
    expect(a4bPikachuEx.length).toBeGreaterThan(0);
    for (const r of a4bPikachuEx) expect(POCKET_IDS.get(gameplayKey(r))).toBe(pikachuEx.id);
    const research = POCKET_ROWS.a4b!.find((r) => r.name === "Professor's Research")!;
    expect(POCKET_IDS.get(gameplayKey(research))).toBe('pesquisa-do-professor');
    expect(idOfRow('pa', 1)).toBe('pocao');
    // A4b-132 é outro Pikachu ex (Relâmpago): mesmo nome, outra definição.
    expect(idOfRow('a4b', 132)).toMatch(/^pikachu-ex-[a-z0-9]+-\d{3}$/);
  });

  it('nomes PT-BR de formas regionais, formas especiais e Equipe Rocket', () => {
    expect(pokemonName('Alolan Exeggutor')).toBe('Exeggutor de Alola');
    expect(pokemonName('Paldean Wooper')).toBe('Wooper de Paldea');
    expect(pokemonName('Origin Forme Dialga')).toBe('Dialga Forma Origem');
    expect(pokemonName("Team Rocket's Wobbuffet")).toBe('Wobbuffet da Equipe Rocket');
    expect(pokemonName('Type: Null')).toBe('Tipo: Nulo');
    expect(pokemonName('Pikachu')).toBe('Pikachu');
    expect(deckLimitKeyV1(`${pokemonName('Alolan Raichu')} ex`)).toBe('raichu-de-alola-ex');
    expect(tagsOf('Buzzwole')).toEqual(['ULTRA_BEAST']);
    expect(tagsOf("Team Rocket's Lapras")).toEqual(['TEAM_ROCKET']);
  });

  it('ids por impressão estáveis (snapshot)', async () => {
    const lines: string[] = [];
    for (const set of POCKET_SETS) {
      if (set.setId === 'a1') continue;
      for (const r of POCKET_ROWS[set.setId]!) lines.push(`${set.setId}-${String(r.number).padStart(3, '0')} ${POCKET_IDS.get(gameplayKey(r))}`);
    }
    await expect(`${lines.join('\n')}\n`).toMatchFileSnapshot('./__snapshots__/printing-ids.txt');
  });
});
