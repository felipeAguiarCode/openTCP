// Lógica pura dos palcos de painel: mapa da campanha (layout, arestas, limites), sequência do pacote
// (presets, máquina de estados, grade do resumo), limites do inspector, temas.
import { describe, expect, it } from 'vitest';
import { buildBundle } from '../../../content/bundle.ts';
import { presetDurationMs } from '../../animation/catalog.ts';
import {
  ISLAND_CENTERS, boundsCenter, clampMapView, fitOrthoHalfHeight, islandBounds, mapEdges, nodeWorld, panDelta, unionBounds,
} from './map-layout.ts';
import { isSpecialReveal, packReduce, packStepMs, revealPresetFor, summaryGrid, type PackState } from './pack-sequence.ts';
import { CHAPTER_ORDER, CHAPTER_THEMES, themeOf, themeOfProduct } from './themes.ts';
import { INSPECTOR_LIMITS, clampInspectorRotation } from './card-inspector.ts';

const bundle = buildBundle();

describe('mapa da campanha (layout puro)', () => {
  it('45 nós, cada um dentro da ilha do seu capítulo; ilhas não se sobrepõem', () => {
    expect(bundle.nodes).toHaveLength(45);
    const islands = CHAPTER_ORDER.map((id) => ({ id, b: islandBounds(id, bundle.nodes) }));
    for (const n of bundle.nodes) {
      expect(ISLAND_CENTERS[n.chapterId], n.chapterId).toBeDefined();
      const p = nodeWorld(n);
      const b = islands.find((i) => i.id === n.chapterId)!.b;
      expect(p.x).toBeGreaterThan(b.minX + 1);
      expect(p.x).toBeLessThan(b.maxX - 1);
      expect(p.z).toBeGreaterThan(b.minZ + 1);
      expect(p.z).toBeLessThan(b.maxZ - 1);
    }
    for (let i = 0; i < islands.length; i += 1) {
      for (let j = i + 1; j < islands.length; j += 1) {
        const a = islands[i]!.b;
        const c = islands[j]!.b;
        const overlap = a.minX < c.maxX && c.minX < a.maxX && a.minZ < c.maxZ && c.minZ < a.maxZ;
        expect(overlap, `${islands[i]!.id}×${islands[j]!.id}`).toBe(false);
      }
    }
  });

  it('arestas do grafo real: rota principal E01 → E03 → E06 em cada capítulo; E02/E04/E05 opcionais', () => {
    const edges = mapEdges(bundle.nodes);
    const main = (from: string, to: string) => edges.find((e) => e.from === from && e.to === to)?.main;
    for (const ch of ['C01', 'C02', 'C03', 'C04', 'C05', 'C06']) {
      expect(main(`${ch}-E01`, `${ch}-E03`), ch).toBe(true);
      expect(main(`${ch}-E03`, `${ch}-E06`), ch).toBe(true);
      expect(main(`${ch}-E01`, `${ch}-E02`), ch).toBe(false);
      expect(main(`${ch}-E03`, `${ch}-E05`), ch).toBe(false);
    }
    expect(edges.some((e) => e.crossChapter && e.to === 'C01-E01')).toBe(true);
  });

  it('enquadramento e limites de pan/zoom', () => {
    const bounds = unionBounds(CHAPTER_ORDER.map((id) => islandBounds(id, bundle.nodes)));
    const half = fitOrthoHalfHeight(bounds, 16 / 9);
    expect(half * 2 * (16 / 9)).toBeGreaterThanOrEqual(bounds.maxX - bounds.minX);
    const overview = { bounds, halfHeight: half };
    const far = clampMapView({ target: { x: 999, z: -999 }, halfHeight: half * 10 }, overview);
    expect(far.target).toEqual({ x: bounds.maxX, z: bounds.minZ });
    expect(far.halfHeight).toBeCloseTo(half * 1.1);
    expect(clampMapView({ target: boundsCenter(bounds), halfHeight: 0.01 }, overview).halfHeight).toBeCloseTo(half / 4);
    // Arrastar para a direita move o alvo para a esquerda; para baixo, em direção ao fundo.
    const d = panDelta(100, 50, { width: 1600, height: 900 }, half);
    expect(d.x).toBeLessThan(0);
    expect(d.z).toBeLessThan(0);
  });
});

describe('abertura de pacote (sequência pura)', () => {
  it('revelação especial por impressão: acabamento, ex ou raridade alta', () => {
    expect(isSpecialReveal({ finish: 'NORMAL', ruleBox: 'NONE', rarity: 'COMMON' })).toBe(false);
    expect(isSpecialReveal({ finish: 'FOIL', ruleBox: 'NONE', rarity: 'COMMON' })).toBe(true);
    expect(isSpecialReveal({ finish: 'NORMAL', ruleBox: 'EX', rarity: 'UNCOMMON' })).toBe(true);
    expect(revealPresetFor({ finish: 'NORMAL', ruleBox: 'NONE', rarity: 'ULTRA' })).toBe('PACK_REVEAL_SPECIAL');
    expect(packStepMs('PACK_TEAR', 'NORMAL', false)).toBe(presetDurationMs('PACK_TEAR'));
    expect(packStepMs('PACK_REVEAL_SPECIAL', 'FAST', false)).toBeCloseTo(850 * 0.55);
    expect(packStepMs('PACK_EXTRACT', 'NORMAL', true)).toBe(150);
    expect(packStepMs('PACK_REVEAL', 'INSTANT', false)).toBe(0);
  });

  it('máquina de estados: corte → extração → avanços → resumo; Revelar todas de qualquer fase', () => {
    let s: PackState = { phase: 'SEALED', index: -1, total: 3 };
    expect(packReduce(s, 'NEXT')).toEqual(s);
    s = packReduce(s, 'TEAR');
    expect(s.phase).toBe('TEARING');
    s = packReduce(s, 'EXTRACTED');
    expect(s).toEqual({ phase: 'REVEALING', index: 0, total: 3 });
    s = packReduce(packReduce(s, 'NEXT'), 'NEXT');
    expect(s.index).toBe(2);
    s = packReduce(s, 'NEXT');
    expect(s.phase).toBe('SUMMARY');
    expect(packReduce({ phase: 'SEALED', index: -1, total: 5 }, 'REVEAL_ALL')).toEqual({ phase: 'SUMMARY', index: 4, total: 5 });
  });

  it('grade do resumo cobre todas as cartas', () => {
    for (const n of [1, 5, 6, 10]) {
      for (const aspect of [16 / 9, 4 / 3, 1]) {
        const g = summaryGrid(n, aspect);
        expect(g.columns * g.rows).toBeGreaterThanOrEqual(n);
        expect(g.columns * (g.rows - 1)).toBeLessThan(n);
      }
    }
  });
});

describe('inspector e temas', () => {
  it('rotação limitada em torno do lado atual', () => {
    expect(clampInspectorRotation('FRONT', 5, -5)).toEqual({ yaw: INSPECTOR_LIMITS.yaw, pitch: -INSPECTOR_LIMITS.pitch });
    const back = clampInspectorRotation('BACK', 0, 0);
    expect(back.yaw).toBeCloseTo(Math.PI - INSPECTOR_LIMITS.yaw);
  });

  it('tema por capítulo e por produto', () => {
    expect(CHAPTER_ORDER.every((id) => CHAPTER_THEMES[id])).toBe(true);
    expect(themeOfProduct('pack-c02-v1').biome).toBe('HARBOR');
    expect(themeOfProduct('pack-archive-v1').biome).toBe('FINALE');
    expect(themeOfProduct('pack-base-v1').biome).toBe('ACADEMY');
    expect(themeOfProduct('pack-a1-pikachu').chapterId).toBe('C03');
    expect(themeOfProduct('pack-a1-charizard').chapterId).toBe('C05');
    expect(themeOfProduct('pack-a1-mewtwo').chapterId).toBe('C04');
    expect(themeOfProduct('pack-a4-lugia').biome).toBe('HARBOR');
    expect(themeOfProduct('pack-a4b').biome).toBe('FINALE');
    expect(themeOfProduct('pack-pb-promo').chapterId).toBe('C03');
    expect(themeOf('desconhecido').chapterId).toBe('P00');
  });
});
