// Força relativa das políticas (campanha §14): sementes fixas, lados alternados em pares com o mesmo baralho
// e a mesma semente de batalha. Os números medidos ficam no log ([ai-strength]).
//
// Com o mesmo deck dos dois lados, a maioria das sementes é decidida pela sorte (o mesmo lado vence nas duas
// ordens) e conta exatamente uma vitória para cada política; o placar acima de 50% vem das sementes em que
// a política faz diferença. Medições de referência (decks iniciais espelhados, sementes 100–151, 104 partidas,
// antes da agressividade do conteúdo 3.5.0): EXPERT 56 × 48 STANDARD (6 sementes vencidas nas duas ordens pelo
// EXPERT, 2 pelo STANDARD); nas sementes 100–114 deste teste, 17 de 30 — 20 de 30 com a IA agressiva (3.5.0).
// STANDARD × aleatório: 40 de 40.
import { describe, expect, it } from 'vitest';
import type { AiProfile } from '../../content/types.ts';
import type { PlayerId } from '../battle/types.ts';
import { DEFAULT_AI_PROFILES, playMatch, type Controller } from './index.ts';
import { cat, DECKS, newMatch, type DeckKind } from './test-support.ts';

type Tally = { wins: number; losses: number; draws: number };

function series(hero: Controller, villain: Controller, games: number, firstSeed: number, decks: (seed: number) => [DeckKind, DeckKind]): Tally {
  const tally: Tally = { wins: 0, losses: 0, draws: 0 };
  for (let i = 0; i < games; i += 1) {
    const seed = firstSeed + Math.floor(i / 2);
    const heroSide: PlayerId = i % 2 === 0 ? 'A' : 'B';
    const [a, b] = decks(seed);
    const result = playMatch({
      initial: newMatch(seed, a, b), catalog: cat, seed,
      controllers: heroSide === 'A' ? { A: hero, B: villain } : { A: villain, B: hero },
    });
    expect(result.illegal).toEqual([]);
    const winner = result.state.result?.winner ?? null;
    if (winner === heroSide) tally.wins += 1;
    else if (winner) tally.losses += 1;
    else tally.draws += 1;
  }
  return tally;
}

const ai = (profile: AiProfile): Controller => ({ kind: 'AI', profile });

describe('IA — força relativa', () => {
  it('STANDARD vence ≥ 75% de 40 partidas contra ações legais aleatórias', () => {
    const tally = series(ai(DEFAULT_AI_PROFILES.STANDARD), { kind: 'RANDOM' }, 40, 1, (seed) => [DECKS[seed % 3]!, DECKS[(seed + 1) % 3]!]);
    console.info(`[ai-strength] STANDARD × aleatório: ${tally.wins}V ${tally.losses}D ${tally.draws}E em 40`);
    expect(tally.wins).toBeGreaterThanOrEqual(30);
  }, 300_000);

  it('EXPERT vence ≥ 50% de 30 partidas espelhadas contra STANDARD', () => {
    const tally = series(ai(DEFAULT_AI_PROFILES.EXPERT), ai(DEFAULT_AI_PROFILES.STANDARD), 30, 100, (seed) => [DECKS[seed % 3]!, DECKS[seed % 3]!]);
    console.info(`[ai-strength] EXPERT × STANDARD: ${tally.wins}V ${tally.losses}D ${tally.draws}E em 30`);
    expect(tally.wins).toBeGreaterThanOrEqual(15);
  }, 600_000);
});
