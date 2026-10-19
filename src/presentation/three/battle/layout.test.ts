// Câmera por perfil + sementes de mundo: os oito slots projetados caem a ±6 px dos alvos de
// battle-layout.json nos dois perfis (R-066), também no frame escalado/letterbox usado pelo palco.
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  ANCHOR_IDS, LAYOUT_PROFILE_IDS, PROFILES, SLOT_ANCHOR_IDS, TABLE_Y, computeAnchors, fitBounds, frameRegion, npcFanCenters, projectToRect, projectedCardRect,
  region, selectFrame, tableGeometryWorld, tableRect, unprojectToPlane,
} from './layout.ts';

describe.each(LAYOUT_PROFILE_IDS)('perfil %s', (id) => {
  const profile = PROFILES[id];
  const fit = fitBounds(profile);

  it('fitBounds aceita a câmera homologada sem ajustes', () => {
    expect(fit.report.ok).toBe(true);
    expect(fit.report.cameraAdjusted).toBe(false);
    expect(fit.report.cardsOnSurface).toBe(true);
  });

  it('os oito slots projetam a ±6 px dos centros-alvo', () => {
    const board = region(profile, 'board');
    expect(profile.slots).toHaveLength(8);
    for (const slot of profile.slots) {
      const [x, z] = fit.seeds[slot.id];
      const p = projectToRect(fit.camera, new Vector3(x, 0, z), board);
      expect(Math.abs(p.x - slot.center[0]), `${slot.id} x`).toBeLessThanOrEqual(6);
      expect(Math.abs(p.y - slot.center[1]), `${slot.id} y`).toBeLessThanOrEqual(6);
    }
  });

  it('a largura projetada de cada carta fica próxima do tamanho-alvo do slot', () => {
    const board = region(profile, 'board');
    for (const slot of profile.slots) {
      const [x, z, s] = fit.seeds[slot.id];
      const r = projectedCardRect(fit.camera, new Vector3(x, 0, z), s, board);
      expect(Math.abs(r.width - slot.size[0]) / slot.size[0], slot.id).toBeLessThan(0.12);
    }
  });

  it.each([[1920, 1080], [1280, 720], [1366, 768], [2560, 1440], [1600, 1000]])('frame %s×%s: slots seguem o letterbox escalado', (w, h) => {
    const frame = selectFrame(w, h, id);
    const boardRect = frameRegion(profile, 'board', frame);
    const camera = fit.camera.clone();
    camera.aspect = boardRect.width / boardRect.height;
    camera.updateProjectionMatrix();
    for (const slot of profile.slots) {
      const [x, z] = fit.seeds[slot.id];
      const p = projectToRect(camera, new Vector3(x, TABLE_Y.card * 0, z), boardRect);
      expect(Math.abs(p.x - (frame.x + slot.center[0] * frame.scale))).toBeLessThanOrEqual(6 * Math.max(1, frame.scale));
      expect(Math.abs(p.y - (frame.y + slot.center[1] * frame.scale))).toBeLessThanOrEqual(6 * Math.max(1, frame.scale));
    }
  });

  it('registro de âncoras completo, com ids canônicos e dentro da região do tabuleiro', () => {
    const anchors = computeAnchors({ ...profile, worldSeeds: fit.seeds }, fit.camera);
    expect(Object.keys(anchors).sort()).toEqual([...ANCHOR_IDS].sort());
    const board = region(profile, 'board');
    for (const aid of ANCHOR_IDS) {
      const a = anchors[aid];
      expect(Number.isFinite(a.x) && Number.isFinite(a.z) && a.scale > 0, aid).toBe(true);
      if (aid === 'HUMAN_HAND') continue;
      const p = projectToRect(fit.camera, new Vector3(a.x, TABLE_Y.card, a.z), board);
      expect(p.x).toBeGreaterThanOrEqual(board.x - 1);
      expect(p.x).toBeLessThanOrEqual(board.x + board.width + 1);
    }
    for (const sid of SLOT_ANCHOR_IDS) expect(anchors[sid].kind).toBe('SLOT');
  });

  it('projeção inversa de um alvo de tela volta ao mesmo pixel', () => {
    const board = region(profile, 'board');
    const slot = profile.slots[0]!;
    const w = unprojectToPlane(fit.camera, slot.center[0], slot.center[1], board, 0)!;
    const p = projectToRect(fit.camera, w, board);
    expect(p.x).toBeCloseTo(slot.center[0], 3);
    expect(p.y).toBeCloseTo(slot.center[1], 3);
  });
});

describe('seleção de perfil (scalingRules)', () => {
  it('altura ≥ 900 → desktop1080; abaixo → compact720; escala uniforme e conteúdo centrado', () => {
    expect(selectFrame(1920, 1080).profileId).toBe('desktop1080');
    expect(selectFrame(1280, 720).profileId).toBe('compact720');
    const f = selectFrame(2000, 1080);
    expect(f.scale).toBe(1);
    expect(f.x).toBe(40);
    expect(selectFrame(800, 1200).fallback2D).toBe(true);
    expect(selectFrame(900, 500).fallback2D).toBe(true);
  });
});

describe.each(LAYOUT_PROFILE_IDS)('mesa visual e âncoras de HUD (%s)', (id) => {
  const profile = PROFILES[id];
  const fit = fitBounds(profile);

  it('superfície visual vai do meio da barra do adversário ao meio da barra do jogador, na largura do campo', () => {
    const t = tableRect(profile);
    const hud = region(profile, 'hud');
    const bar = region(profile, 'humanBar');
    const board = region(profile, 'board');
    expect(t.y).toBeCloseTo(hud.y + hud.height / 2, 6);
    expect(t.y + t.height).toBeCloseTo(bar.y + bar.height / 2, 6);
    expect(t.x).toBe(board.x);
    expect(t.width).toBe(board.width);
  });

  it('o contorno no plano da mesa projeta de volta no retângulo de tela (câmera do campo inalterada)', () => {
    const g = tableGeometryWorld(profile, fit.camera);
    const t = tableRect(profile);
    const board = region(profile, 'board');
    for (const p of g.outer) {
      const s = projectToRect(fit.camera, new Vector3(p.x, 0, p.z), board);
      expect(s.x).toBeGreaterThanOrEqual(t.x - 0.5);
      expect(s.x).toBeLessThanOrEqual(t.x + t.width + 0.5);
      expect(s.y).toBeGreaterThanOrEqual(t.y - 0.5);
      expect(s.y).toBeLessThanOrEqual(t.y + t.height + 0.5);
    }
    expect(g.zFar).toBeLessThan(g.zCenter);
    expect(g.zCenter).toBeLessThan(g.zNear);
  });

  it('âncoras de HUD: HUMAN_END_TURN, pontos no centro das barras e leque do NPC no topo central', () => {
    const anchors = computeAnchors({ ...profile, worldSeeds: fit.seeds }, fit.camera);
    expect(anchors.HUMAN_END_TURN.design).toEqual(region(profile, 'endTurn'));
    const cx = profile.viewport[0] / 2;
    for (const k of ['HUMAN_POINTS', 'NPC_POINTS'] as const) {
      const d = anchors[k].design;
      expect(Math.abs(d.x + d.width / 2 - profile.mirrorCenter[0])).toBeLessThan(cx);
    }
    expect(anchors.HUMAN_POINTS.design).toEqual(region(profile, 'humanPoints'));
    const fan = npcFanCenters(profile, 5);
    const r = region(profile, 'npcHand');
    expect((fan.centers[0]!.x + fan.centers[4]!.x) / 2).toBeCloseTo(r.x + r.width / 2, 6);
    for (const c of fan.centers) expect(c.y).toBeCloseTo(r.y + r.height / 2, 6);
  });
});
