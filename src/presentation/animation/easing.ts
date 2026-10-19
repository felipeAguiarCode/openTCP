// As quatro curvas homologadas (direcao-visual-pocket.md §9). O JSON de coreografia nomeia a curva;
// estas funções a interpretam. Nenhuma string executável é importada.

export const EASING_IDS = ['linear', 'easeOutCubic', 'easeInOutCubic', 'easeOutBack'] as const;
export type EasingId = (typeof EASING_IDS)[number];

/** c₁ = 1,165 mantém o pico de easeOutBack em ≈ 1,05 (nunca acima). */
export const EASE_OUT_BACK_C1 = 1.165;

const clamp01 = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t);

export const EASINGS: Readonly<Record<EasingId, (t: number) => number>> = {
  linear: (t) => clamp01(t),
  easeOutCubic: (t) => {
    const x = clamp01(t);
    return 1 - (1 - x) ** 3;
  },
  easeInOutCubic: (t) => {
    const x = clamp01(t);
    return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
  },
  easeOutBack: (t) => {
    const x = clamp01(t);
    const c1 = EASE_OUT_BACK_C1;
    const u = x - 1;
    return 1 + (c1 + 1) * u * u * u + c1 * u * u;
  },
};

export function isEasingId(value: unknown): value is EasingId {
  return typeof value === 'string' && (EASING_IDS as readonly string[]).includes(value);
}

export function ease(id: EasingId, t: number): number {
  return EASINGS[id](t);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
