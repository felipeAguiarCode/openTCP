// Ícones de efeito do Pokémon TCG Pocket (`.inspo/effects`, fornecidos pelo autor), copiados por
// `npm run inspo:effects` (tools/inspo-import/effect-icons.py) para effects/<id>.webp, 128×128 com transparência:
// as cinco Condições Especiais e os efeitos temporários nas cartas em campo (interface §25.21). Origem em ASSETS.md.

const FILES: Readonly<Record<string, string>> = import.meta.glob<string>('./effects/*.webp', { query: '?url', import: 'default', eager: true });
const URLS = new Map(Object.entries(FILES).map(([file, url]) => [file.slice('./effects/'.length, -'.webp'.length), url]));

export type EffectIconId =
  | 'asleep' | 'burned' | 'confused' | 'paralyzed' | 'poisoned'
  | 'ban' | 'buff' | 'debuff' | 'invalid' | 'other-negative' | 'other-positive' | 'play-negative';

export const EFFECT_ICON_IDS: readonly EffectIconId[] = [
  'asleep', 'burned', 'confused', 'paralyzed', 'poisoned', 'ban', 'buff', 'debuff', 'invalid', 'other-negative', 'other-positive', 'play-negative',
];

/** URL local do ícone; null se o arquivo faltar (o selo cai para o texto). */
export function effectIconUrl(id: EffectIconId): string | null {
  return URLS.get(id) ?? null;
}
