// Perfis de qualidade (runtime §22, §20.8). Baixo mantém cartas 3D, paleta e informação.
export type Quality = 'LOW' | 'MEDIUM' | 'HIGH';

export type QualityProfile = {
  readonly maxDpr: number;
  readonly antialias: boolean;
  readonly playmatSize: readonly [number, number];
  readonly particleBudget: number;
  readonly animatedFinish: boolean;
  readonly anisotropy: number;
  readonly textureBudgetBytes: number;
  readonly cardTexture: readonly [number, number];
};

export const QUALITY_PROFILES: Readonly<Record<Quality, QualityProfile>> = {
  LOW: { maxDpr: 1, antialias: false, playmatSize: [1024, 768], particleBudget: 0, animatedFinish: false, anisotropy: 1, textureBudgetBytes: 96 * 1024 * 1024, cardTexture: [400, 560] },
  MEDIUM: { maxDpr: 1.5, antialias: true, playmatSize: [1536, 1152], particleBudget: 40, animatedFinish: true, anisotropy: 4, textureBudgetBytes: 160 * 1024 * 1024, cardTexture: [500, 700] },
  HIGH: { maxDpr: 2, antialias: true, playmatSize: [2048, 1536], particleBudget: 80, animatedFinish: true, anisotropy: 8, textureBudgetBytes: 256 * 1024 * 1024, cardTexture: [500, 700] },
};

export function effectivePixelRatio(devicePixelRatio: number, quality: Quality): number {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.min(dpr, QUALITY_PROFILES[quality].maxDpr);
}
