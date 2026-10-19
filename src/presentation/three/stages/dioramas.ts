// Dioramas procedurais dos capítulos (interface §20.6/§20.8; direção visual §13.3): miniaturas coloridas
// de primitivas sobre bases brancas/azul pálido, na paleta do capítulo. Cada ilha vira um único mesh com
// cores por vértice (um draw call); a decoração não entra no picking, só a base (capítulo).
import {
  BoxGeometry, BufferAttribute, ConeGeometry, CylinderGeometry, Euler, Matrix4, OctahedronGeometry, Quaternion, SphereGeometry,
  TorusGeometry, Vector3, type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createVisualRng, type VisualRng } from '../core/rng.ts';
import { hexToRgb, mixHex } from '../core/tokens.ts';
import { roundedRectGeometry, roundedRectSideGeometry } from '../card/geometry.ts';
import type { Bounds, XZ } from './map-layout.ts';
import type { ChapterTheme } from './themes.ts';

type Part = { geometry: BufferGeometry; color: string };

const SRGB_TO_LINEAR = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** Não indexada, sem UV, com cor por vértice (linear) — pronta para mergeGeometries. */
export function colorGeometry(geometry: BufferGeometry, hex: string): BufferGeometry {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  if (g !== geometry) geometry.dispose();
  g.deleteAttribute('uv');
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  const { r, g: gg, b } = hexToRgb(hex);
  // Cores por vértice no espaço linear de trabalho (o renderer converte para sRGB na saída).
  const lr = SRGB_TO_LINEAR(r / 255);
  const lg = SRGB_TO_LINEAR(gg / 255);
  const lb = SRGB_TO_LINEAR(b / 255);
  const n = g.getAttribute('position').count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) {
    colors[i * 3] = lr;
    colors[i * 3 + 1] = lg;
    colors[i * 3 + 2] = lb;
  }
  g.setAttribute('color', new BufferAttribute(colors, 3));
  return g;
}

function placed(geometry: BufferGeometry, x: number, y: number, z: number, rot: Partial<{ x: number; y: number; z: number }> = {}, scale = 1): BufferGeometry {
  const m = new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromEuler(new Euler(rot.x ?? 0, rot.y ?? 0, rot.z ?? 0)), new Vector3(scale, scale, scale));
  geometry.applyMatrix4(m);
  return geometry;
}

type Ctx = {
  readonly parts: Part[];
  readonly rng: VisualRng;
  readonly theme: ChapterTheme;
  readonly bounds: Bounds;
  readonly blocked: readonly XZ[];
  readonly segments: readonly (readonly [XZ, XZ])[];
};

function add(ctx: Ctx, geometry: BufferGeometry, color: string): void {
  ctx.parts.push({ geometry, color });
}

function distToSegment(p: XZ, a: XZ, b: XZ): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz));
}

/** Posição livre (longe de nós e caminhos) — determinística pelo rng do capítulo. */
function freeSpot(ctx: Ctx, clearance: number, edgeInset = 0.55, tries = 60): XZ | null {
  const b = ctx.bounds;
  for (let i = 0; i < tries; i += 1) {
    const p = { x: b.minX + edgeInset + ctx.rng() * (b.maxX - b.minX - 2 * edgeInset), z: b.minZ + edgeInset + ctx.rng() * (b.maxZ - b.minZ - 2 * edgeInset) };
    if (ctx.blocked.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < clearance + 0.55)) continue;
    if (ctx.segments.some(([a, c]) => distToSegment(p, a, c) < clearance * 0.6 + 0.2)) continue;
    return p;
  }
  return null;
}

/** Ponto mais afastado dos nós entre N candidatos (marco do bioma). */
function landmarkSpot(ctx: Ctx, clearance: number): XZ | null {
  let best: XZ | null = null;
  let bestD = -1;
  for (let i = 0; i < 40; i += 1) {
    const p = freeSpot(ctx, clearance, 1.0, 4);
    if (!p) continue;
    const d = Math.min(...ctx.blocked.map((q) => Math.hypot(q.x - p.x, q.z - p.z)), 99);
    if (d > bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

// ------------------------------------------------------------------------------------------ peças

function tree(ctx: Ctx, p: XZ, h: number, leaf: string): void {
  add(ctx, placed(new CylinderGeometry(0.06 * h, 0.08 * h, 0.4 * h, 6), p.x, 0.2 * h, p.z), '#B99272');
  if (ctx.rng() < 0.55) add(ctx, placed(new ConeGeometry(0.34 * h, 0.95 * h, 8), p.x, 0.4 * h + 0.47 * h, p.z), leaf);
  else add(ctx, placed(new SphereGeometry(0.36 * h, 10, 8), p.x, 0.62 * h, p.z), leaf);
}

function house(ctx: Ctx, p: XZ, w: number, d: number, h: number, wall: string, roof: string, rotY = 0): void {
  add(ctx, placed(new BoxGeometry(w, h, d), p.x, h / 2, p.z, { y: rotY }), wall);
  add(ctx, placed(new ConeGeometry(Math.hypot(w, d) * 0.56, h * 0.7, 4), p.x, h + h * 0.35, p.z, { y: rotY + Math.PI / 4 }), roof);
}

function tower(ctx: Ctx, p: XZ, r: number, h: number, body: string, band: string, roof?: string): void {
  add(ctx, placed(new CylinderGeometry(r * 0.85, r, h, 14), p.x, h / 2, p.z), body);
  add(ctx, placed(new TorusGeometry(r * 0.92, r * 0.12, 6, 18), p.x, h * 0.7, p.z, { x: Math.PI / 2 }), band);
  if (roof) add(ctx, placed(new ConeGeometry(r * 1.1, r * 1.4, 14), p.x, h + r * 0.7, p.z), roof);
}

function box(ctx: Ctx, p: XZ, w: number, h: number, d: number, color: string, y = 0, rotY = 0): void {
  add(ctx, placed(new BoxGeometry(w, h, d), p.x, y + h / 2, p.z, { y: rotY }), color);
}

function scatter(ctx: Ctx, count: number, clearance: number, fn: (p: XZ, i: number) => void): void {
  for (let i = 0; i < count; i += 1) {
    const p = freeSpot(ctx, clearance);
    if (p) fn(p, i);
  }
}

function biomeProps(ctx: Ctx): void {
  const t = ctx.theme;
  const [base, support, third, accent] = t.palette;
  const r = ctx.rng;
  switch (t.biome) {
    case 'ACADEMY': {
      const l = landmarkSpot(ctx, 1.3);
      if (l) {
        box(ctx, l, 2.0, 0.9, 1.2, '#FFFFFF');
        add(ctx, placed(new CylinderGeometry(0.01, 1.15, 0.5, 4, 1), l.x, 1.15, l.z, { y: Math.PI / 4 }), mixHex(accent, '#FFFFFF', 0.35));
        for (const dx of [-0.75, -0.25, 0.25, 0.75]) add(ctx, placed(new CylinderGeometry(0.07, 0.07, 0.8, 8), l.x + dx, 0.4, l.z + 0.66), support);
        tower(ctx, { x: l.x - 1.25, z: l.z - 0.2 }, 0.32, 1.5, '#FFFFFF', third, accent);
      }
      scatter(ctx, 7, 0.4, (p) => {
        const stackN = 2 + Math.floor(r() * 3);
        for (let k = 0; k < stackN; k += 1) box(ctx, p, 0.42, 0.09, 0.3, [accent, support, third, '#FFFFFF'][k % 4]!, k * 0.09, r() * 0.4);
      });
      scatter(ctx, 6, 0.35, (p) => tree(ctx, p, 0.7 + r() * 0.3, mixHex('#8CCB7A', base, 0.2)));
      break;
    }
    case 'FOREST': {
      const l = landmarkSpot(ctx, 1.0);
      if (l) add(ctx, placed(new CylinderGeometry(0.9, 0.95, 0.05, 24), l.x, 0.03, l.z), third);
      scatter(ctx, 22, 0.32, (p) => tree(ctx, p, 0.6 + r() * 0.55, [accent, mixHex(accent, '#FFFFFF', 0.3), support][Math.floor(r() * 3)]!));
      scatter(ctx, 6, 0.3, (p) => add(ctx, placed(new SphereGeometry(0.22, 8, 6), p.x, 0.12, p.z), mixHex(accent, '#FFFFFF', 0.45)));
      break;
    }
    case 'HARBOR': {
      const b = ctx.bounds;
      const waterD = (b.maxZ - b.minZ) * 0.32;
      add(ctx, placed(new BoxGeometry(b.maxX - b.minX - 0.4, 0.04, waterD), (b.minX + b.maxX) / 2, 0.025, b.minZ + 0.2 + waterD / 2), mixHex(support, accent, 0.25));
      const l = landmarkSpot(ctx, 1.0);
      if (l) {
        add(ctx, placed(new CylinderGeometry(0.22, 0.32, 1.7, 14), l.x, 0.85, l.z), '#FFFFFF');
        add(ctx, placed(new TorusGeometry(0.28, 0.06, 6, 16), l.x, 1.1, l.z, { x: Math.PI / 2 }), '#F2857D');
        add(ctx, placed(new ConeGeometry(0.3, 0.4, 12), l.x, 1.9, l.z), accent);
      }
      for (let i = 0; i < 3; i += 1) {
        const p = { x: b.minX + 1.2 + r() * (b.maxX - b.minX - 2.4), z: b.minZ + 0.35 + r() * (waterD - 0.5) };
        box(ctx, p, 0.55, 0.14, 0.24, '#FFFFFF', 0.03);
        add(ctx, placed(new ConeGeometry(0.16, 0.42, 3), p.x, 0.38, p.z), third);
      }
      scatter(ctx, 7, 0.35, (p) => box(ctx, p, 0.3, 0.26, 0.3, third, 0, r()));
      scatter(ctx, 4, 0.5, (p) => house(ctx, p, 0.6, 0.5, 0.45, '#FFFFFF', accent, r()));
      break;
    }
    case 'POWERPLANT': {
      const l = landmarkSpot(ctx, 1.2);
      if (l) {
        tower(ctx, l, 0.42, 1.9, '#FFFFFF', accent);
        tower(ctx, { x: l.x + 0.95, z: l.z + 0.1 }, 0.3, 1.4, '#FFFFFF', accent);
        add(ctx, placed(new TorusGeometry(0.5, 0.08, 8, 24), l.x + 0.45, 0.3, l.z + 0.7, { x: Math.PI / 2 }), accent);
      }
      scatter(ctx, 7, 0.4, (p) => box(ctx, p, 0.5, 0.06, 0.34, mixHex(third, '#357DE4', 0.25), 0.25, r() * 0.5));
      scatter(ctx, 7, 0.4, (p) => {
        box(ctx, p, 0.42, 0.42, 0.42, base === '#EEF5FC' ? '#FFFFFF' : base, 0, r());
        add(ctx, placed(new TorusGeometry(0.14, 0.04, 6, 14), p.x, 0.52, p.z), accent);
      });
      break;
    }
    case 'OBSERVATORY': {
      const l = landmarkSpot(ctx, 1.2);
      if (l) {
        add(ctx, placed(new CylinderGeometry(0.75, 0.8, 0.7, 20), l.x, 0.35, l.z), '#FFFFFF');
        add(ctx, placed(new SphereGeometry(0.75, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), l.x, 0.7, l.z), accent);
        add(ctx, placed(new CylinderGeometry(0.08, 0.12, 0.9, 10), l.x + 0.3, 1.2, l.z, { z: -0.7 }), '#FFFFFF');
      }
      scatter(ctx, 12, 0.3, (p) => add(ctx, placed(new OctahedronGeometry(0.1 + r() * 0.08), p.x, 0.6 + r() * 0.9, p.z), r() < 0.5 ? '#FFFFFF' : mixHex(accent, '#FFFFFF', 0.4)));
      scatter(ctx, 8, 0.35, (p) => tree(ctx, p, 0.55 + r() * 0.3, mixHex(support, accent, 0.35)));
      break;
    }
    case 'FOUNDRY': {
      const l = landmarkSpot(ctx, 1.2);
      if (l) {
        box(ctx, l, 1.6, 0.8, 1.0, '#FFFFFF');
        for (const dx of [-0.5, 0.1, 0.6]) add(ctx, placed(new CylinderGeometry(0.12, 0.15, 0.9, 10), l.x + dx, 1.1, l.z - 0.2), support);
        add(ctx, placed(new SphereGeometry(0.2, 10, 8), l.x - 0.2, 0.2, l.z + 0.7), accent);
      }
      scatter(ctx, 8, 0.4, (p) => house(ctx, p, 0.55, 0.45, 0.5, '#FFFFFF', mixHex(accent, '#FFFFFF', 0.25), r()));
      scatter(ctx, 7, 0.3, (p) => box(ctx, p, 0.3, 0.2, 0.22, support, 0, r()));
      break;
    }
    case 'ARCHIVE': {
      const l = landmarkSpot(ctx, 1.2);
      if (l) {
        for (let k = 0; k < 4; k += 1) box(ctx, { x: l.x - 0.3 * k, z: l.z }, 1.2 - k * 0.25, 0.22, 1.0 - k * 0.2, k % 2 ? '#FFFFFF' : base, k * 0.22);
        tower(ctx, { x: l.x + 1.0, z: l.z - 0.3 }, 0.2, 1.6, '#FFFFFF', accent);
      }
      scatter(ctx, 8, 0.4, (p) => {
        const rot = r();
        box(ctx, p, 0.7, 0.62, 0.22, '#FFFFFF', 0, rot);
        for (let k = 0; k < 3; k += 1) box(ctx, p, 0.62, 0.05, 0.18, [accent, third, support][k]!, 0.12 + k * 0.18, rot);
      });
      scatter(ctx, 9, 0.3, (p) => box(ctx, p, 0.26, 0.012, 0.34, '#FFFFFF', 0.55 + r() * 0.8, r() * 3));
      break;
    }
    case 'FINALE': {
      const l = landmarkSpot(ctx, 1.0) ?? { x: (ctx.bounds.minX + ctx.bounds.maxX) / 2, z: ctx.bounds.minZ + 1 };
      add(ctx, placed(new TorusGeometry(1.1, 0.1, 8, 40), l.x, 0.08, l.z, { x: Math.PI / 2 }), accent);
      add(ctx, placed(new CylinderGeometry(0.9, 0.95, 0.12, 30), l.x, 0.06, l.z), '#FFFFFF');
      for (let k = 0; k < 8; k += 1) {
        const a = (k / 8) * Math.PI * 2;
        add(ctx, placed(new CylinderGeometry(0.08, 0.1, 1.1, 8), l.x + Math.cos(a) * 1.45, 0.55, l.z + Math.sin(a) * 1.45), '#FFFFFF');
        add(ctx, placed(new SphereGeometry(0.11, 8, 6), l.x + Math.cos(a) * 1.45, 1.15, l.z + Math.sin(a) * 1.45), k % 2 ? accent : support);
      }
      scatter(ctx, 8, 0.35, (p) => box(ctx, p, 0.06, 0.9, 0.06, '#FFFFFF'));
      scatter(ctx, 6, 0.35, (p) => box(ctx, p, 0.34, 0.5, 0.03, [support, third][Math.floor(r() * 2)]!, 0.35, r()));
      break;
    }
    default:
      break;
  }
}

/**
 * Geometria completa de uma ilha (base branca, parede azul-pálida, chão do bioma, peças). Devolve um único
 * BufferGeometry com cores por vértice (mundo). `nodes` e `segments` reservam espaço para marcadores/caminhos.
 */
export function buildIslandGeometry(theme: ChapterTheme, bounds: Bounds, nodes: readonly XZ[], segments: readonly (readonly [XZ, XZ])[]): BufferGeometry {
  const parts: Part[] = [];
  const ctx: Ctx = { parts, rng: createVisualRng(`diorama:${theme.chapterId}`), theme, bounds, blocked: nodes, segments };
  const w = bounds.maxX - bounds.minX;
  const d = bounds.maxZ - bounds.minZ;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const top = roundedRectGeometry(w, d, 0.9, 10);
  top.rotateX(-Math.PI / 2);
  top.translate(cx, 0, cz);
  add(ctx, top, '#FFFFFF');
  const side = roundedRectSideGeometry(w, d, 0.9, 0.55, 10);
  side.rotateX(-Math.PI / 2);
  side.translate(cx, -0.275, cz);
  add(ctx, side, '#D9E6F2');
  const ground = roundedRectGeometry(w - 0.5, d - 0.5, 0.7, 10);
  ground.rotateX(-Math.PI / 2);
  ground.translate(cx, 0.008, cz);
  add(ctx, ground, mixHex(mixHex(theme.palette[0], theme.palette[1], 0.3), '#FFFFFF', 0.2));
  biomeProps(ctx);
  return mergeColored(parts.map((p) => colorGeometry(p.geometry, p.color)));
}

/** Junta geometrias coloridas num único BufferGeometry (um draw call) e libera as partes. */
export function mergeColored(list: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(list, false);
  for (const g of list) g.dispose();
  if (!merged) throw new Error('mergeColored: atributos incompatíveis');
  merged.computeBoundingSphere();
  return merged;
}
