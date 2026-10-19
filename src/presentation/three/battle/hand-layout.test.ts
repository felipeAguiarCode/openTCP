// Leque da mão (handPolicy OVERLAPPING_FAN): sempre sobreposto, ordem lógica, inclinação ≤ limite, base
// `bottomBleedPx` abaixo da borda (atrás da barra do jogador), foco sobe `focusLiftPx` com escala ≤ 1,06 e
// fica inteiro acima da barra; mesma geometria do leque 2D da UI.
import { describe, expect, it } from 'vitest';
import { fanLayout } from '../../ui/battle/layout.ts';
import { LAYOUT_PROFILE_IDS, PROFILES, region } from './layout.ts';
import { handCardAt, handFanLayout, handFocusPose, rotatedHalfExtents } from './hand-layout.ts';

describe.each(LAYOUT_PROFILE_IDS)('leque da mão (%s)', (id) => {
  const profile = PROFILES[id];
  const hand = region(profile, 'hand');
  const bar = region(profile, 'humanBar');
  const policy = profile.handPolicy;
  const [w, h] = policy.restCardSize;

  it('política do perfil: cartas grandes, leque sempre sobreposto', () => {
    expect(policy.layout).toBe('OVERLAPPING_FAN');
    expect(policy.fanStepRatio).toBeLessThan(1);
    expect(w / h).toBeCloseTo(5 / 7, 5);
  });

  it.each([1, 2, 3, 5, 7, 10])('%s cartas: ordem preservada, sobreposição e cartas dentro da região', (n) => {
    const slots = handFanLayout(n, hand, policy);
    expect(slots).toHaveLength(n);
    for (let i = 0; i < n; i += 1) {
      const s = slots[i]!;
      expect(s.index).toBe(i);
      expect(s.order).toBe(i);
      if (i > 0) {
        const step = s.x - slots[i - 1]!.x;
        expect(step).toBeGreaterThan(0);
        expect(step).toBeLessThanOrEqual(w * policy.fanStepRatio + 1e-9);
      }
      expect(Math.abs(s.rotation)).toBeLessThanOrEqual((policy.maxFanTiltDegrees * Math.PI) / 180 + 1e-9);
      expect(s.x - w / 2).toBeGreaterThanOrEqual(-hand.width / 2 - 1e-6);
      expect(s.x + w / 2).toBeLessThanOrEqual(hand.width / 2 + 1e-6);
      // Com a inclinação das pontas, no máximo uma pequena margem além da região (o viewport tem folga).
      const ext = rotatedHalfExtents(s.width, s.height, s.rotation);
      expect(Math.abs(s.x) + ext.halfW).toBeLessThanOrEqual(hand.width / 2 + 48);
    }
    expect(slots[0]!.x + slots[n - 1]!.x).toBeCloseTo(0, 6);
  });

  it('a base sai `bottomBleedPx` pela borda inferior (atrás da barra) e o topo fica dentro da região', () => {
    const slots = handFanLayout(5, hand, policy);
    const mid = slots[2]!;
    expect(Math.abs(mid.rotation)).toBe(0);
    expect(mid.y - h / 2).toBeCloseTo(-hand.height / 2 - policy.bottomBleedPx, 6);
    for (const s of slots) expect(s.y + h / 2).toBeLessThanOrEqual(hand.height / 2);
    // A borda inferior da região é a borda da tela.
    expect(hand.y + hand.height).toBe(profile.viewport[1]);
  });

  it('foco: sobe `focusLiftPx`, escala ≤ 1,06, sem inclinação e inteira acima da barra do jogador', () => {
    for (const s of handFanLayout(6, hand, policy)) {
      const f = handFocusPose(s, policy);
      expect(f.y - s.baseY).toBeCloseTo(policy.focusLiftPx, 6);
      expect(f.scale).toBeLessThanOrEqual(1.06);
      expect(f.rotation).toBe(0);
      const centerScreenY = hand.y + hand.height / 2 - f.y;
      expect(centerScreenY + (h * f.scale) / 2).toBeLessThanOrEqual(bar.y + 1e-6);
      expect(centerScreenY - (h * f.scale) / 2).toBeGreaterThanOrEqual(0);
    }
  });

  it('mesma geometria do leque 2D da UI (posição, arco e inclinação)', () => {
    for (const n of [1, 4, 8]) {
      const three = handFanLayout(n, hand, policy);
      const dom = fanLayout(n, hand.width, w, policy.maxFanTiltDegrees, policy.fanStepRatio);
      three.forEach((s, i) => {
        const d = dom[i]!;
        expect(s.x).toBeCloseTo(d.x + w / 2 - hand.width / 2, 6);
        expect(s.baseY - s.y).toBeCloseTo(d.y, 6);
        expect((-s.rotation * 180) / Math.PI).toBeCloseTo(d.rotate, 6);
      });
    }
  });

  it('acerto respeita a ordem de desenho (a carta de cima vence)', () => {
    const slots = handFanLayout(6, hand, policy);
    const a = slots[2]!;
    const b = slots[3]!;
    expect(handCardAt(slots, (a.x + b.x) / 2, (a.y + b.y) / 2)).toBe(3);
    expect(handCardAt(slots, 0, hand.height)).toBeNull();
  });
});

it('mão vazia → nenhum slot', () => {
  expect(handFanLayout(0, { width: 1000, height: 160 }, PROFILES.desktop1080.handPolicy)).toEqual([]);
});
