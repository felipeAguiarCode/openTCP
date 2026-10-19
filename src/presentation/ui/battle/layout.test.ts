// Geometria da mesa em DOM (interface §23.5/§23.14; battle-layout.json): perfil pela altura, escala e
// centralização 16:9, slots nas mesmas coordenadas da spec e leque da mão sobreposto.
import { describe, expect, it } from 'vitest';
import { fanLayout, previewRect, stageLayout, toBox } from './layout.ts';

describe('geometria da mesa', () => {
  it('escolhe o perfil pela altura e escala as metas', () => {
    const a = stageLayout(1920, 1080);
    expect(a.profile).toBe('desktop1080');
    expect(a.scale).toBe(1);
    expect(toBox(a, a.slots.HUMAN_ACTIVE)).toEqual({ left: 894, top: 481.6, width: 132, height: 184.8 });
    const b = stageLayout(1366, 768);
    expect(b.profile).toBe('compact720');
    expect(b.scale).toBeCloseTo(1.0667, 3);
    const c = stageLayout(1600, 900);
    expect(c.profile).toBe('desktop1080');
    expect(c.scale).toBeCloseTo(0.8333, 3);
  });

  it('janela mais larga que 16:9 centraliza o conteúdo com margens funcionais', () => {
    const l = stageLayout(3440, 1440);
    expect(l.scale).toBeCloseTo(1.3333, 3);
    expect(l.offset[0]).toBeCloseTo(440, 0);
    const active = toBox(l, l.slots.HUMAN_ACTIVE);
    expect(active.left + active.width / 2).toBeCloseTo(3440 / 2, 0);
  });

  it('em 720p o campo fica centralizado na janela, sem coluna lateral', () => {
    const l = stageLayout(1280, 720);
    const board = l.regions.board;
    expect(board[0] + board[2] / 2).toBe(640);
    const hand = l.regions.hand;
    expect(hand[0] + hand[2] / 2).toBe(l.slots.HUMAN_BENCH_1[0] + l.slots.HUMAN_BENCH_1[2] / 2);
  });

  it('leque da mão: sempre sobreposto, cabe na região, ordem e inclinação limitadas', () => {
    const l = stageLayout(1920, 1080);
    const region = l.regions.hand[2];
    const w = l.handCard[0];
    for (const n of [1, 2, 5, 10]) {
      const fan = fanLayout(n, region, w, l.fan.maxTilt, l.fan.stepRatio);
      expect(fan).toHaveLength(n);
      for (let i = 1; i < n; i += 1) {
        expect(fan[i]!.x).toBeGreaterThan(fan[i - 1]!.x);
        expect(fan[i]!.x - fan[i - 1]!.x).toBeLessThan(w);
      }
      expect(fan[0]!.x).toBeGreaterThanOrEqual(-0.01);
      expect(fan[n - 1]!.x + w).toBeLessThanOrEqual(region + 0.01);
      for (const s of fan) expect(Math.abs(s.rotate)).toBeLessThanOrEqual(l.fan.maxTilt + 1e-9);
    }
  });

  it('prévia da mão: centrada na tela, entre o topo da mesa e a mão, na proporção da carta', () => {
    for (const [w, h] of [[1920, 1080], [1280, 720]] as const) {
      const l = stageLayout(w, h);
      const [x, y, pw, ph] = previewRect(l);
      expect(x + pw / 2).toBeCloseTo(l.design[0] / 2, 6);
      expect(ph / pw).toBeCloseTo(88 / 63, 6);
      expect(y).toBeGreaterThanOrEqual(l.regions.board[1]);
      expect(y + ph).toBeLessThanOrEqual(l.regions.hand[1]);
      // Mais larga que a carta Ativa da mesa: a leitura é o motivo da prévia.
      expect(pw).toBeGreaterThan(l.slots.HUMAN_ACTIVE[2] * 2);
    }
    expect(previewRect(stageLayout(1920, 1080))[3]).toBe(540);
  });
});
