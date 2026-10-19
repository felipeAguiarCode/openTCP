// Algoritmos versionados de nome (persistencia-sqlite.md §9, editor-de-cartas.md §7).
import type { RuleBox } from './types.ts';

/** NONE → baseName; EX → "baseName ex"; MEGA_EX → "Mega baseName ex". */
export function deriveName(baseName: string, ruleBox: RuleBox): string {
  const base = baseName.trim().replace(/\s+/g, ' ');
  if (ruleBox === 'EX') return `${base} ex`;
  if (ruleBox === 'MEGA_EX') return `Mega ${base} ex`;
  return base;
}

function stripDiacritics(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * deck-limit-key-v2: pré-normaliza os símbolos de gênero (“♀” → " f", “♂” → " m", para que “Nidoran♀” e
 * “Nidoran♂” não colidam) e segue a v1: NFD, sem diacríticos, minúsculas, não alfanumérico → "-", sem traços
 * extras. Para nomes sem ♀/♂ o resultado é idêntico ao da v1 (nenhuma chave existente muda).
 */
export function deckLimitKey(name: string): string {
  const pre = name.replace(/♀/g, ' f').replace(/♂/g, ' m');
  return stripDiacritics(pre).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
}

/** Nome histórico do algoritmo de chave de limite; implementa a versão vigente (deck-limit-key-v2). */
export const deckLimitKeyV1 = deckLimitKey;

/** search-key-v1: NFD, sem diacríticos, minúsculas, espaços colapsados. */
export function searchKeyV1(name: string): string {
  return stripDiacritics(name).toLowerCase().replace(/\s+/g, ' ').trim();
}

export const DECK_LIMIT_KEY_ALGORITHM = 'deck-limit-key-v2';
export const SEARCH_KEY_ALGORITHM = 'search-key-v1';
