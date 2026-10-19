// Imagens das bolas de Energia (src/presentation/assets/energy) para as texturas de canvas da mesa 3D: fichas ligadas
// ao Pokémon, orbe da Zona de Energia, próxima Energia e o voo da ligação. Carregadas uma vez (o boot começa cedo);
// enquanto não chegam, quem desenha usa o desenho procedural, e a etiqueta de cache separa as duas versões.
import { ENERGY_ORB_TYPES, energyOrbUrl } from '../../assets/energy.ts';

const images = new Map<string, HTMLImageElement>();
let pending: Promise<boolean> | null = null;
let ready = false;
const listeners = new Set<() => void>();

export function loadEnergyOrbs(): Promise<boolean> {
  if (pending) return pending;
  if (typeof Image === 'undefined') {
    pending = Promise.resolve(false);
    return pending;
  }
  pending = Promise.all(ENERGY_ORB_TYPES.map((type) => new Promise<void>((resolve) => {
    const url = energyOrbUrl(type);
    if (!url) { resolve(); return; }
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { images.set(type, img); resolve(); };
    img.onerror = () => resolve();
    img.src = url;
  }))).then(() => {
    ready = images.size > 0;
    if (ready) for (const cb of [...listeners]) cb();
    return ready;
  });
  return pending;
}

/** Imagem da bola do tipo, se já carregada (null para Incolor/Dragão ou antes da carga). */
export function energyOrbImage(type: string): HTMLImageElement | null {
  return images.get(type.toUpperCase()) ?? null;
}

/** Etiqueta para chaves de cache (desenho provisório ≠ arte final). */
export function energyOrbsTag(): string {
  return ready ? 'art' : 'pending';
}

/** Avisa quando as bolas ficam prontas (a mesa refaz prato e fichas desenhados antes, com o provisório). */
export function onEnergyOrbsReady(cb: () => void): () => void {
  if (ready) {
    cb();
    return () => undefined;
  }
  listeners.add(cb);
  return () => listeners.delete(cb);
}
