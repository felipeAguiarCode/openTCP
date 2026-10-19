// Layout puro do mapa da campanha (interface §20.1–§20.4): ilhas-diorama por capítulo em sequência
// (Prólogo → C01…C06 → Final), posições de nó a partir das coordenadas locais do conteúdo, caminhos
// principal/opcional pelo grafo real, enquadramento ortográfico inclinado e limites de pan/zoom.

export type MapNodeLike = {
  readonly nodeId: string;
  readonly chapterId: string;
  readonly essential: boolean;
  readonly prerequisites: { readonly allOf: readonly string[] };
  readonly map: { readonly x: number; readonly z: number };
};

export type XZ = { readonly x: number; readonly z: number };
export type Bounds = { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };

/** Centros das ilhas (mundo): fila próxima da esquerda para a direita, fila distante de volta ao Final. */
export const ISLAND_CENTERS: Readonly<Record<string, XZ>> = {
  P00: { x: -21, z: 8 },
  C01: { x: -7, z: 9 },
  C02: { x: 7, z: 8 },
  C03: { x: 21, z: 9 },
  C04: { x: 21, z: -8 },
  C05: { x: 7, z: -9 },
  C06: { x: -7, z: -8 },
  F00: { x: -21, z: -9 },
};

/** Elevação da câmera ortográfica (graus acima do horizonte): inclinação estável, nunca de cabeça para baixo. */
export const MAP_ELEVATION_DEG = 52;
export const ISLAND_PADDING = 1.7;

/** Coordenadas locais (x à direita, z para o fundo) → mundo (z cresce em direção à câmera). */
export function nodeWorld(node: Pick<MapNodeLike, 'chapterId' | 'map'>): XZ {
  const c = ISLAND_CENTERS[node.chapterId] ?? { x: 0, z: 0 };
  return { x: c.x + node.map.x, z: c.z - node.map.z };
}

export function islandBounds(chapterId: string, nodes: readonly MapNodeLike[]): Bounds {
  const c = ISLAND_CENTERS[chapterId] ?? { x: 0, z: 0 };
  const own = nodes.filter((n) => n.chapterId === chapterId).map(nodeWorld);
  if (!own.length) return { minX: c.x - 4, maxX: c.x + 4, minZ: c.z - 3.5, maxZ: c.z + 3.5 };
  const xs = own.map((p) => p.x);
  const zs = own.map((p) => p.z);
  const half = { x: Math.max(4.6, (Math.max(...xs) - Math.min(...xs)) / 2 + ISLAND_PADDING), z: Math.max(3.9, (Math.max(...zs) - Math.min(...zs)) / 2 + ISLAND_PADDING) };
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cz = (Math.max(...zs) + Math.min(...zs)) / 2;
  return { minX: cx - half.x, maxX: cx + half.x, minZ: cz - half.z, maxZ: cz + half.z };
}

export function unionBounds(list: readonly Bounds[]): Bounds {
  return {
    minX: Math.min(...list.map((b) => b.minX)), maxX: Math.max(...list.map((b) => b.maxX)),
    minZ: Math.min(...list.map((b) => b.minZ)), maxZ: Math.max(...list.map((b) => b.maxZ)),
  };
}

export function boundsCenter(b: Bounds): XZ {
  return { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 };
}

/** Meia altura ortográfica que enquadra `b` (com relevo `reliefY`) num viewport de aspecto `aspect`. */
export function fitOrthoHalfHeight(b: Bounds, aspect: number, margin = 1.08, reliefY = 1.2): number {
  const theta = (MAP_ELEVATION_DEG * Math.PI) / 180;
  const depth = (b.maxZ - b.minZ) * Math.sin(theta) + reliefY * Math.cos(theta);
  const width = b.maxX - b.minX;
  return Math.max(depth / 2, width / 2 / Math.max(0.1, aspect)) * margin;
}

export type MapEdge = { readonly from: string; readonly to: string; readonly main: boolean; readonly crossChapter: boolean };

/**
 * Arestas pelo grafo real de pré-requisitos. Rota principal: as duas pontas essenciais (E01 → E03 → E06
 * no capítulo; sequência do Prólogo; ligações entre capítulos). Opcional: tracejada.
 */
export function mapEdges(nodes: readonly MapNodeLike[]): MapEdge[] {
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));
  const out: MapEdge[] = [];
  for (const n of nodes) {
    for (const p of n.prerequisites.allOf) {
      const from = byId.get(p);
      if (!from) continue;
      out.push({ from: p, to: n.nodeId, main: from.essential && n.essential, crossChapter: from.chapterId !== n.chapterId });
    }
  }
  return out;
}

export type MapView = { readonly target: XZ; readonly halfHeight: number };

/** Limites: zoom entre 1/4 e 1,1× o enquadramento geral; alvo dentro dos limites do mapa. */
export function clampMapView(view: MapView, overview: { bounds: Bounds; halfHeight: number }): MapView {
  const halfHeight = Math.min(overview.halfHeight * 1.1, Math.max(overview.halfHeight / 4, view.halfHeight));
  const b = overview.bounds;
  return {
    halfHeight,
    target: { x: Math.min(b.maxX, Math.max(b.minX, view.target.x)), z: Math.min(b.maxZ, Math.max(b.minZ, view.target.z)) },
  };
}

/** Delta de arrasto em px → deslocamento do alvo no chão (ortográfica inclinada). */
export function panDelta(dxPx: number, dyPx: number, viewportPx: { width: number; height: number }, halfHeight: number): XZ {
  const theta = (MAP_ELEVATION_DEG * Math.PI) / 180;
  const unitsPerPx = (2 * halfHeight) / Math.max(1, viewportPx.height);
  return { x: -dxPx * unitsPerPx, z: (-dyPx * unitsPerPx) / Math.sin(theta) };
}
