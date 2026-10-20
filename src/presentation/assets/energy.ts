// Bolas de Energia ligadas nas cartas (Planta, Fogo, Água, Elétrico, Psíquico, Lutador, Noturno e Metal): recortadas
// do atlas `source/energy/energys.png` por `npm run assets:energy` (tools/asset-import/energy-orbs.py), 128×128
// com transparência. Usadas nas Energias ligadas aos Pokémon e na Zona de Energia; os custos dos ataques continuam
// com os ícones de tipo. Origem e restrições em ASSETS.md.

const FILES: Readonly<Record<string, string>> = import.meta.glob<string>('./energy/*.webp', { query: '?url', import: 'default', eager: true });
const URLS = new Map(Object.entries(FILES).map(([file, url]) => [file.slice('./energy/'.length, -'.webp'.length).toUpperCase(), url]));

/** URL local da bola do tipo (`FIRE` → energy/fire.webp); null para tipos sem bola (Incolor, Dragão). */
export function energyOrbUrl(type: string | null | undefined): string | null {
  return type ? URLS.get(type.toUpperCase()) ?? null : null;
}

export const ENERGY_ORB_TYPES: readonly string[] = [...URLS.keys()].sort();
