// Mesa no estilo do Pocket (como a mesa 2D): arena circular no centro de espelho envolvendo os dois Bancos, disco
// central com raio = ARENA.discK × largura do Ativo, linha central na divisão, e tapetes cosméticos que só tingem
// o entorno (neutro sem tingimento nem padrão).
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { LAYOUT_PROFILE_IDS, PROFILES, fitBounds, projectToRect, region, tableGeometryWorld } from './layout.ts';
import { ARENA, arenaRadiusPx } from './arena.ts';
import { NEUTRAL_PLAYMAT, isNeutralPlaymat, playmatTint } from './playmat.ts';

describe.each(LAYOUT_PROFILE_IDS)('marcas centrais da mesa (%s)', (id) => {
  const profile = PROFILES[id];
  const fit = fitBounds(profile);
  const g = tableGeometryWorld(profile, fit.camera);
  const board = region(profile, 'board');
  const [cx, cy] = profile.mirrorCenter;

  it('disco central no centro de espelho, raio = ARENA.discK × largura do Ativo', () => {
    const c = projectToRect(fit.camera, new Vector3(g.center.x, 0, g.center.z), board);
    expect(c.x).toBeCloseTo(cx, 3);
    expect(c.y).toBeCloseTo(cy, 3);
    const edge = projectToRect(fit.camera, new Vector3(g.center.x + g.circleRadius, 0, g.center.z), board);
    const active = profile.slots.find((s) => s.id === 'HUMAN_ACTIVE')!.size[0];
    expect(Math.abs(edge.x - cx - ARENA.discK * active)).toBeLessThan(2);
    expect(g.ringWidth).toBeGreaterThan(0);
  });

  it('arena: círculo de tela no centro de espelho que envolve os dois Bancos; metade distante acima, próxima abaixo', () => {
    const toScreen = (p: { x: number; z: number }) => projectToRect(fit.camera, new Vector3(p.x, 0, p.z), board);
    const radius = arenaRadiusPx(cx, cy, profile.slots.filter((s) => s.id.includes('_BENCH_')));
    for (const p of g.arena.rimInner) {
      const sp = toScreen(p);
      expect(Math.abs(Math.hypot(sp.x - cx, sp.y - cy) - radius)).toBeLessThan(1.5);
    }
    // Os dois Bancos cabem dentro do círculo (cantos externos das cartas).
    for (const id of ['NPC_BENCH_0', 'NPC_BENCH_2', 'HUMAN_BENCH_0', 'HUMAN_BENCH_2']) {
      const slot = profile.slots.find((s) => s.id === id)!;
      const corner = [slot.center[0]! + Math.sign(slot.center[0]! - cx) * slot.size[0]! / 2, slot.center[1]! + Math.sign(slot.center[1]! - cy) * slot.size[1]! / 2];
      expect(Math.hypot(corner[0]! - cx, corner[1]! - cy), id).toBeLessThan(radius);
    }
    expect(Math.max(...g.arena.far.map((p) => toScreen(p).y))).toBeLessThanOrEqual(cy + 0.5);
    expect(Math.min(...g.arena.near.map((p) => toScreen(p).y))).toBeGreaterThanOrEqual(cy - 0.5);
  });

  it('linha central na divisão das duas metades, de borda a borda', () => {
    const ys = g.midline.map((p) => projectToRect(fit.camera, new Vector3(p.x, 0, p.z), board).y);
    for (const y of ys) expect(Math.abs(y - cy)).toBeLessThan(3 * (profile.viewport[1] / 1080) + 0.5);
    const xs = g.midline.map((p) => projectToRect(fit.camera, new Vector3(p.x, 0, p.z), board).x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(board.width * 0.95);
  });
});

describe('tapete cosmético sobre a mesa de duas cores', () => {
  it('neutro: sem tingimento nem padrão', () => {
    expect(isNeutralPlaymat(NEUTRAL_PLAYMAT)).toBe(true);
    expect(isNeutralPlaymat({ cosmeticId: 'mat-neutral', visual: { palette: ['#EAF4FA', '#DCD6F7'], pattern: 'LINES', accentHex: '#75C7FA' } })).toBe(true);
    expect(playmatTint(NEUTRAL_PLAYMAT).k).toBe(0);
  });

  it('tapete de capítulo tinge as duas metades sem apagar a divisão', () => {
    const harbor = { cosmeticId: 'mat-c02-harbor', visual: { palette: ['#BFE9FA', '#8EE3E0', '#F3E6C8', '#2DECE5'], pattern: 'WAVES' as const, accentHex: '#2DECE5' } };
    const t = playmatTint(harbor);
    expect(t.k).toBeGreaterThan(0);
    expect(t.k).toBeLessThan(0.5);
    expect(t.far).toBe('#BFE9FA');
    expect(t.near).toBe('#8EE3E0');
  });
});
