// Leque da mão (interface §23.5 handPolicy OVERLAPPING_FAN, §23.6): cartas grandes sempre sobrepostas com
// passo de `fanStepRatio` da largura (comprimido se não couber), inclinação até `maxFanTiltDegrees` nas pontas
// e arco suave; a base sai `bottomBleedPx` pela borda inferior, atrás da barra do jogador. A carta em foco sobe
// `focusLiftPx` (escala ≤ `focusScale`) e aparece inteira. Mesma geometria do leque 2D (ui/battle/layout.ts
// `fanLayout`), para o popover de ações ancorar igual nos dois modos. Pura (px).
import type { HandPolicy } from './layout.ts';

export type HandSlot = {
  readonly index: number;
  /** Centro em px relativo ao centro do viewport da mão (y para cima). */
  readonly x: number;
  readonly y: number;
  /** Y de repouso sem o arco (base da carta `bottomBleedPx` abaixo da borda). */
  readonly baseY: number;
  /** Rotação no plano (rad); positiva = anti-horária. */
  readonly rotation: number;
  readonly scale: number;
  /** Ordem de desenho (maior por cima). */
  readonly order: number;
  readonly width: number;
  readonly height: number;
};

export function rotatedHalfExtents(width: number, height: number, angle: number): { halfW: number; halfH: number } {
  const c = Math.abs(Math.cos(angle));
  const s = Math.abs(Math.sin(angle));
  return { halfW: (width * c + height * s) / 2, halfH: (width * s + height * c) / 2 };
}

export type HandLayoutOptions = {
  /** Escala do frame (px de design → px CSS); a sangria inferior escala junto. */
  readonly cardScale?: number;
};

/** Inclinação por carta em graus (igual ao 2D): até `maxTilt` nas pontas, no máximo 3° por posição. */
export function fanTiltDegrees(count: number, maxTilt: number): number {
  if (count <= 1) return 0;
  const mid = (count - 1) / 2;
  return Math.min(maxTilt / Math.max(mid, 1), 3);
}

export function handFanLayout(count: number, viewport: { readonly width: number; readonly height: number }, policy: HandPolicy, options: HandLayoutOptions = {}): HandSlot[] {
  const n = Math.max(0, count);
  if (n === 0) return [];
  const scale = options.cardScale ?? 1;
  const w = policy.restCardSize[0] * scale;
  const h = policy.restCardSize[1] * scale;
  const bleed = policy.bottomBleedPx * scale;
  // Passo sempre sobreposto; comprime para caber na largura do viewport.
  const step = n > 1 ? Math.min(w * policy.fanStepRatio, (viewport.width - w) / (n - 1)) : 0;
  const total = w + step * (n - 1);
  const mid = (n - 1) / 2;
  const tilt = fanTiltDegrees(n, policy.maxFanTiltDegrees);
  // Base da carta `bleed` abaixo da borda inferior do viewport (y para cima: −altura/2 − bleed).
  const restY = -viewport.height / 2 - bleed + h / 2;
  return Array.from({ length: n }, (_, i) => {
    const d = i - mid;
    return {
      index: i,
      x: -total / 2 + w / 2 + i * step,
      // Arco suave: as pontas descem (d² × 1,2 % da largura), como no leque 2D.
      y: restY - d * d * w * 0.012,
      baseY: restY,
      rotation: d === 0 ? 0 : -(d * tilt * Math.PI) / 180,
      scale: 1,
      order: i,
      width: w,
      height: h,
    };
  });
}

/** Pose de foco: sobe `focusLiftPx` (escala ≤ `focusScale`), sem inclinação — inteira acima da barra. */
export function handFocusPose(slot: HandSlot, policy: HandPolicy, _viewportHeight?: number, frameScale = 1): { x: number; y: number; rotation: number; scale: number } {
  const scale = Math.min(policy.focusScale, 1.06);
  const lift = policy.focusLiftPx * frameScale;
  // Sobe a partir da base sem o arco (igual ao popover da UI): carta inteira acima da barra do jogador.
  return { x: slot.x, y: slot.baseY + lift, rotation: 0, scale };
}

/** Índice da carta sob um ponto (px relativo ao centro), respeitando a ordem de desenho. */
export function handCardAt(slots: readonly HandSlot[], px: number, py: number): number | null {
  for (let k = slots.length - 1; k >= 0; k -= 1) {
    const s = slots[k]!;
    const dx = px - s.x;
    const dy = py - s.y;
    const c = Math.cos(-s.rotation);
    const sn = Math.sin(-s.rotation);
    const lx = dx * c - dy * sn;
    const ly = dx * sn + dy * c;
    if (Math.abs(lx) <= (s.width * s.scale) / 2 && Math.abs(ly) <= (s.height * s.scale) / 2) return s.index;
  }
  return null;
}
