// Renderer Three.js compartilhado pela aplicação (runtime §12–§13): um único canvas/WebGLRenderer,
// emprestado à tela que hospeda palcos 3D (mesa, pacote, mapa, vitrine, Descoberta, inspector). O canvas
// é transparente e fica atrás do HUD HTML da tela; quando nenhuma tela o usa, sai do DOM visível.
// Sem WebGL2, falha de criação ou perda de contexto não recuperada, `glStatus` vira UNAVAILABLE e as
// telas usam a apresentação 2D equivalente.
import { signal } from '@preact/signals';
import { createRenderSystem, type Quality, type RenderSystem } from '../../three/index.ts';

export type GlStatus = 'IDLE' | 'READY' | 'LOST' | 'UNAVAILABLE';

export const glStatus = signal<GlStatus>('IDLE');

let system: RenderSystem | null = null;
let canvas: HTMLCanvasElement | null = null;
let owner: HTMLElement | null = null;
let lostTimer: ReturnType<typeof setTimeout> | null = null;
/** Tempo máximo esperando `webglcontextrestored` antes de cair para 2D (runtime §23). */
const RESTORE_TIMEOUT_MS = 4000;

export function qualityOf(setting: 'AUTO' | Quality): Quality {
  if (setting !== 'AUTO') return setting;
  const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
  return dpr >= 2 ? 'HIGH' : 'MEDIUM';
}

/**
 * Empresta o renderer a `host` (elemento posicionado que cobre a área dos palcos): o canvas vira o
 * primeiro filho do host e as coordenadas CSS dos palcos são relativas a ele. Nulo = usar 2D.
 */
export function attachRenderer(host: HTMLElement, quality: Quality): RenderSystem | null {
  if (glStatus.value === 'UNAVAILABLE' || glStatus.value === 'LOST') return null;
  // Um canvas por vez: se outra tela viva (ex.: a mesa) está com ele, este palco usa o 2D.
  if (owner && owner !== host && owner.isConnected) return null;
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'gl-canvas';
    canvas.setAttribute('aria-hidden', 'true');
  }
  if (canvas.parentElement !== host) host.prepend(canvas);
  canvas.hidden = false;
  if (!system) {
    const created = createRenderSystem(canvas, {
      quality,
      onContextLost: () => {
        glStatus.value = 'LOST';
        if (lostTimer) clearTimeout(lostTimer);
        lostTimer = setTimeout(() => {
          lostTimer = null;
          if (glStatus.value === 'LOST') glStatus.value = 'UNAVAILABLE';
        }, RESTORE_TIMEOUT_MS);
      },
      onContextRestored: () => {
        if (lostTimer) clearTimeout(lostTimer);
        lostTimer = null;
        glStatus.value = 'READY';
      },
    });
    if (!created.ok) {
      canvas.remove();
      canvas = null;
      glStatus.value = 'UNAVAILABLE';
      return null;
    }
    system = created.system;
    glStatus.value = 'READY';
  } else system.setQuality(quality);
  owner = host;
  system.requestRender();
  return system;
}

/** Devolve o canvas (a tela saiu): esconde e estaciona fora do host, mantendo o contexto vivo. */
export function detachRenderer(host: HTMLElement): void {
  if (owner !== host || !canvas) return;
  owner = null;
  canvas.hidden = true;
  document.body.appendChild(canvas);
}

export function currentRenderer(): RenderSystem | null {
  return system;
}

/** Retângulo CSS de `el` relativo ao canvas do renderer (origem dos viewports). */
export function rectInCanvas(el: Element): { x: number; y: number; width: number; height: number } {
  const a = el.getBoundingClientRect();
  const c = canvas?.getBoundingClientRect() ?? { left: 0, top: 0 };
  return { x: a.left - c.left, y: a.top - c.top, width: a.width, height: a.height };
}
