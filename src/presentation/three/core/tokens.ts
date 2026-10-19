// Tokens pocket-light-v1 lidos da cópia byte a byte de visual-tokens.json (ver data.test.ts).
import tokens from '../data/visual-tokens.json';

export type TypeId = 'GRASS' | 'FIRE' | 'WATER' | 'LIGHTNING' | 'PSYCHIC' | 'FIGHTING' | 'DARKNESS' | 'METAL' | 'DRAGON' | 'COLORLESS';
export const TYPE_IDS: readonly TypeId[] = ['GRASS', 'FIRE', 'WATER', 'LIGHTNING', 'PSYCHIC', 'FIGHTING', 'DARKNESS', 'METAL', 'DRAGON', 'COLORLESS'];

export type ColorToken = keyof typeof tokens.colors;
export const COLORS: Readonly<Record<ColorToken, string>> = tokens.colors;
export const TYPE_COLORS: Readonly<Record<TypeId, string>> = tokens.typeColors;
export const STRIP_COLORS: Readonly<Record<TypeId, string>> = tokens.attackStripColors;
export const CARD_FONT_FAMILY = tokens.typography.cardFace.family;
export const VISUAL_PROFILE_ID = tokens.visualProfileId;

export function asTypeId(value: string | null | undefined): TypeId {
  return value && (TYPE_IDS as readonly string[]).includes(value) ? (value as TypeId) : 'COLORLESS';
}

export function typeColor(type: string | null | undefined): string {
  return TYPE_COLORS[asTypeId(type)];
}

export function stripColor(type: string | null | undefined): string {
  return STRIP_COLORS[asTypeId(type)];
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0').slice(0, 6);
  const n = Number.parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (x: number) => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

/** Mistura sRGB simples para tons de apoio (impressão autoral, não cálculo físico). */
export function mixHex(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex(x.r + (y.r - x.r) * t, x.g + (y.g - x.g) * t, x.b + (y.b - x.b) * t);
}

export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Luminância relativa WCAG (sRGB). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export const CONDITION_COLORS: Readonly<Record<string, string>> = {
  POISONED: '#8F5EC0',
  BURNED: '#D83B15',
  ASLEEP: '#357DE4',
  PARALYZED: '#8A7310',
  CONFUSED: '#C2417A',
};
