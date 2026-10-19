// Geometria compartilhada da carta (runtime §14.1, §15.1): largura 1, altura 1,4, espessura 0,012,
// cantos suavizados. Frente/verso são tampas separadas; o corpo é só a parede lateral (sem z-fighting).
import { BufferGeometry, Float32BufferAttribute, Shape, ShapeGeometry, type Vector2 } from 'three';

export const CARD_WIDTH = 1;
export const CARD_HEIGHT = 1.4;
export const CARD_THICKNESS = 0.012;
export const CARD_RADIUS = 0.055;
export const CARD_HALF_T = CARD_THICKNESS / 2;

export function roundedRectShape(width: number, height: number, radius: number): Shape {
  const r = Math.min(radius, width / 2, height / 2);
  const x0 = -width / 2;
  const y0 = -height / 2;
  const x1 = width / 2;
  const y1 = height / 2;
  const s = new Shape();
  s.moveTo(x0 + r, y0);
  s.lineTo(x1 - r, y0);
  s.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x1, y1 - r);
  s.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
  s.lineTo(x0 + r, y1);
  s.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, y0 + r);
  s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/** Retângulo arredondado plano (XY, normal +Z) com UV 0..1 mapeado ao retângulo envolvente. */
export function roundedRectGeometry(width: number, height: number, radius: number, segments = 6): BufferGeometry {
  const geometry = new ShapeGeometry(roundedRectShape(width, height, radius), segments);
  const pos = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < pos.count; i += 1) {
    uv.setXY(i, (pos.getX(i) + width / 2) / width, (pos.getY(i) + height / 2) / height);
  }
  uv.needsUpdate = true;
  return geometry;
}

function outline(width: number, height: number, radius: number, segments: number): Vector2[] {
  const points = roundedRectShape(width, height, radius).getPoints(segments);
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (first.distanceTo(last) < 1e-6) points.pop();
  return points;
}

/** Parede lateral do retângulo arredondado, de z = −depth/2 a +depth/2 (normais para fora). */
export function roundedRectSideGeometry(width: number, height: number, radius: number, depth: number, segments = 6): BufferGeometry {
  const pts = outline(width, height, radius, segments);
  const positions: number[] = [];
  const normals: number[] = [];
  const h = depth / 2;
  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dy / len;
    const ny = -dx / len;
    const quad = [a.x, a.y, -h, b.x, b.y, -h, b.x, b.y, h, a.x, a.y, -h, b.x, b.y, h, a.x, a.y, h];
    positions.push(...quad);
    for (let k = 0; k < 6; k += 1) normals.push(nx, ny, 0);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  return geometry;
}

/** Contorno (anel) de retângulo arredondado: marcador de seleção e guias de zona. */
export function roundedRingGeometry(width: number, height: number, radius: number, thickness: number, segments = 6): BufferGeometry {
  const outer = roundedRectShape(width + thickness, height + thickness, radius + thickness / 2);
  const inner = roundedRectShape(width - thickness, height - thickness, Math.max(0.001, radius - thickness / 2));
  outer.holes.push(inner);
  return new ShapeGeometry(outer, segments);
}

/** Bloco arredondado (tampa superior + parede) para mesa/aro/pacote. */
export function roundedSlabGeometries(width: number, height: number, radius: number, depth: number, segments = 10): { top: BufferGeometry; side: BufferGeometry } {
  return { top: roundedRectGeometry(width, height, radius, segments), side: roundedRectSideGeometry(width, height, radius, depth, segments) };
}
