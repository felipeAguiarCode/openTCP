// Geometria da mesa em DOM (interface §23.5, §23.14; battle-layout.json): as mesmas regiões, slots e
// tamanhos projetados que a mesa 3D usa, convertidos em pixels CSS do viewport. Perfil pela altura
// (`scalingRules.profileSelectionByHeight`); conteúdo 16:9 centralizado com margens funcionais. Só
// posições e tamanhos de cartas escalam — o texto HTML mantém o tamanho do perfil (não é zoom global).
import layoutData from '../../../../.specs/examples/battle-layout.json';

export type Rect = readonly [number, number, number, number];
export type ProfileId = 'desktop1080' | 'compact720';
export type SlotId = 'NPC_ACTIVE' | 'HUMAN_ACTIVE' | `NPC_BENCH_${0 | 1 | 2}` | `HUMAN_BENCH_${0 | 1 | 2}`;
export type RegionId =
  | 'hud' | 'humanBar' | 'board' | 'protectedCards' | 'inspector' | 'actions' | 'hand' | 'attackCutin' | 'humanDeck' | 'humanDiscard' | 'npcDeck' | 'npcDiscard'
  | 'humanEnergy' | 'npcEnergy' | 'humanPoints' | 'npcPoints' | 'stadium' | 'turnBanner' | 'endTurn' | 'history' | 'menu' | 'npcHand'
  | 'humanPlate' | 'npcPlate' | 'actionButtons' | 'toast' | 'setupReset' | 'guide' | 'trainerZone';

type ProfileData = {
  readonly id: string;
  readonly viewport: readonly number[];
  readonly regions: Readonly<Record<string, readonly number[]>>;
  readonly slots: readonly { readonly id: string; readonly center: readonly number[]; readonly size: readonly number[] }[];
  readonly handCardSize: readonly number[];
  readonly handPolicy: { readonly maxFanTiltDegrees: number; readonly focusScale: number; readonly focusLiftPx: number; readonly fanStepRatio: number; readonly bottomBleedPx: number };
  readonly pileCardSize: readonly number[];
  readonly energyTokenDiameterPx: { readonly ready: number; readonly next: number };
};

const DATA = layoutData as unknown as {
  readonly profiles: readonly ProfileData[];
  readonly piles: { readonly mirrorCenters: Readonly<Record<string, readonly number[]>> };
  readonly npcHandPolicy: { readonly backCardSize: Readonly<Record<string, readonly number[]>> };
};

export type StageLayout = {
  readonly profile: ProfileId;
  /** Tamanho de referência do perfil (1920×1080 ou 1280×720). */
  readonly design: readonly [number, number];
  /** Escala aplicada às posições e às cartas; deslocamento que centraliza o conteúdo 16:9. */
  readonly scale: number;
  readonly offset: readonly [number, number];
  readonly regions: Readonly<Record<RegionId, Rect>>;
  readonly slots: Readonly<Record<SlotId, Rect>>;
  readonly handCard: readonly [number, number];
  readonly pileCard: readonly [number, number];
  readonly npcBack: readonly [number, number];
  readonly energy: { readonly ready: number; readonly next: number };
  readonly center: readonly [number, number];
  readonly fan: { readonly maxTilt: number; readonly focusScale: number; readonly focusLift: number; readonly stepRatio: number; readonly bottomBleed: number };
};

const rectOf = (r: readonly number[]): Rect => [r[0]!, r[1]!, r[2]!, r[3]!];

function profileData(id: ProfileId): ProfileData {
  const p = DATA.profiles.find((x) => x.id === id);
  if (!p) throw new Error(`perfil de layout ausente: ${id}`);
  return p;
}

/** Perfil e escala para um viewport (CSS px), conforme `scalingRules` do battle-layout.json. */
export function stageLayout(width: number, height: number): StageLayout {
  const profile: ProfileId = height >= 900 ? 'desktop1080' : 'compact720';
  const p = profileData(profile);
  const [dw, dh] = [p.viewport[0]!, p.viewport[1]!];
  const scale = Math.min(width / dw, height / dh);
  const offset: [number, number] = [Math.max(0, (width - dw * scale) / 2), Math.max(0, (height - dh * scale) / 2)];
  const regions = Object.fromEntries(Object.entries(p.regions).map(([k, v]) => [k, rectOf(v)])) as Record<RegionId, Rect>;
  const slots = Object.fromEntries(p.slots.map((s) => [s.id, [s.center[0]! - s.size[0]! / 2, s.center[1]! - s.size[1]! / 2, s.size[0]!, s.size[1]!] as Rect])) as Record<SlotId, Rect>;
  const back = DATA.npcHandPolicy.backCardSize[profile] ?? [40, 56];
  const center = DATA.piles.mirrorCenters[profile] ?? [dw / 2, dh / 2];
  return {
    profile, design: [dw, dh], scale, offset, regions, slots,
    handCard: [p.handCardSize[0]!, p.handCardSize[1]!], pileCard: [p.pileCardSize[0]!, p.pileCardSize[1]!], npcBack: [back[0]!, back[1]!],
    energy: { ready: p.energyTokenDiameterPx.ready, next: p.energyTokenDiameterPx.next }, center: [center[0]!, center[1]!],
    fan: { maxTilt: p.handPolicy.maxFanTiltDegrees, focusScale: p.handPolicy.focusScale, focusLift: p.handPolicy.focusLiftPx, stepRatio: p.handPolicy.fanStepRatio, bottomBleed: p.handPolicy.bottomBleedPx },
  };
}

export type Box = { readonly left: number; readonly top: number; readonly width: number; readonly height: number };

/** Retângulo do perfil → caixa em pixels CSS do viewport (escala + centralização). */
export function toBox(l: StageLayout, r: Rect): Box {
  return { left: l.offset[0] + r[0] * l.scale, top: l.offset[1] + r[1] * l.scale, width: r[2] * l.scale, height: r[3] * l.scale };
}

/** Caixa relativa a outra (para filhos posicionados dentro de uma região). */
export function within(l: StageLayout, r: Rect, parent: Rect): Box {
  return { left: (r[0] - parent[0]) * l.scale, top: (r[1] - parent[1]) * l.scale, width: r[2] * l.scale, height: r[3] * l.scale };
}

export function boxStyle(b: Box): Record<string, string> {
  return { left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px` };
}

/**
 * Prévia ampliada por hover (interface §24.2): na margem esquerda do perfil (`inspector`), tão larga quanto a margem
 * livre antes das cartas protegidas, na proporção da face HTML (63:88), centralizada na altura e acima dos botões
 * flutuantes de histórico/pausa. A folga é a mesma da borda (24 px em 1080p, 16 px em 720p).
 */
/**
 * Prévia da carta da mão (decisão do autor, 15/10/2026): centrada na tela, entre o topo da mesa e a mão, na proporção
 * da carta, com metade da altura da tela.
 */
export function previewRect(l: StageLayout): Rect {
  const top = l.regions.board[1];
  const bottom = l.regions.hand[1];
  const height = Math.min((bottom - top) * 0.82, l.design[1] * 0.5);
  const width = (height * 63) / 88;
  return [(l.design[0] - width) / 2, top + (bottom - top - height) / 2, width, height];
}

export type FanSlot ={ readonly x: number; readonly y: number; readonly rotate: number; readonly z: number };

/**
 * Leque da mão (`handPolicy`, layout OVERLAPPING_FAN): cartas sempre sobrepostas com passo de `stepRatio` da
 * largura, comprimido se não couber na região. Inclinação até `maxTilt` nas pontas e arco suave; a ordem
 * lógica nunca muda.
 */
export function fanLayout(count: number, regionWidth: number, cardWidth: number, maxTilt: number, stepRatio: number): FanSlot[] {
  if (count <= 0) return [];
  const step = count > 1 ? Math.min(cardWidth * stepRatio, (regionWidth - cardWidth) / (count - 1)) : 0;
  const total = cardWidth + step * (count - 1);
  const start = (regionWidth - total) / 2;
  const mid = (count - 1) / 2;
  const tiltPerCard = count > 1 ? Math.min(maxTilt / Math.max(mid, 1), 3) : 0;
  return Array.from({ length: count }, (_, i) => {
    const d = i - mid;
    return { x: start + i * step, y: d * d * cardWidth * 0.012, rotate: d * tiltPerCard, z: i + 1 };
  });
}
