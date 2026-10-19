// Moeda de quem lança (gameplay-pocket §3; UI-177): todo lançamento por efeito, ataque ou condição usa a moeda equipada
// no deck do lado que lança; o de quem começa, a do jogador.
import { describe, expect, it } from 'vitest';
import type { BattleEvent } from '../../../domain/battle/types.ts';
import { planPresentation } from '../../animation/plan.ts';
import { describeWith } from '../../animation/test-support.ts';
import { buildDemoBattle } from '../harness/demo-battle.ts';
import { coinOwner } from './coin-art.ts';

describe('moeda de quem lança', () => {
  it('o lado é o de quem lança; sem jogador (quem começa), o do jogador', () => {
    expect(coinOwner(null, 'A')).toBe('MINE');
    expect(coinOwner('A', 'A')).toBe('MINE');
    expect(coinOwner('B', 'A')).toBe('THEIRS');
    expect(coinOwner('A', 'B')).toBe('THEIRS');
  });

  it('cada passo de moeda do plano carrega quem lançou', () => {
    const demo = buildDemoBattle('A');
    const describeCard = describeWith(demo.catalog);
    const batch = demo.script.find((b) => b.events.some((e) => e.type === 'COIN_RESOLVED'))!;
    const coinsOf = (events: readonly BattleEvent[]) => planPresentation(events, batch.before, batch.after, { attemptId: 't', speed: 'NORMAL', reducedMotion: false, describeCard })
      .steps.flatMap((s) => (s.data.kind === 'COIN' ? [s.data] : []));
    const flipper = batch.events.find((e) => e.type === 'COIN_RESOLVED')!.data.player;
    const own = coinsOf(batch.events);
    expect(own.length).toBeGreaterThan(0);
    for (const c of own) expect(c.player).toBe(flipper);
    // Lançado pelo outro lado (ex.: a moeda do defensor que evita o dano): o passo leva o outro jogador.
    const other = flipper === 'A' ? 'B' : 'A';
    const theirs = coinsOf(batch.events.map((e) => (e.type === 'COIN_RESOLVED' ? { ...e, data: { ...e.data, player: other } } : e)));
    for (const c of theirs) {
      expect(c.player).toBe(other);
      expect(coinOwner(c.player, 'A')).toBe(other === 'A' ? 'MINE' : 'THEIRS');
    }
  });
});
