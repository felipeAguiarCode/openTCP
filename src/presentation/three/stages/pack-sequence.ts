// Sequência da abertura de pacote (interface §9.9; runtime §19.10; direção visual §12) como dados puros:
// presets por etapa, revelação especial por impressão e máquina de estados do índice apresentado. A cena
// nunca sorteia nem decide conteúdo: recebe a lista já confirmada pelo domínio (recibo da abertura).
import type { CardFaceData } from '../../../domain/cards/text.ts';
import { presetDurationMs, type PresetId } from '../../animation/catalog.ts';
import { scaleDuration, type SpeedMode } from '../../animation/timing.ts';

export type PackPhase = 'SEALED' | 'TEARING' | 'EXTRACTING' | 'REVEALING' | 'SUMMARY';

/** Especial: acabamento ≠ NORMAL, caixa de regra (ex) ou raridade alta (RARE/ULTRA). */
export function isSpecialReveal(face: Pick<CardFaceData, 'finish' | 'ruleBox' | 'rarity'>): boolean {
  return face.finish !== 'NORMAL' || face.ruleBox !== 'NONE' || face.rarity === 'RARE' || face.rarity === 'ULTRA';
}

export function revealPresetFor(face: Pick<CardFaceData, 'finish' | 'ruleBox' | 'rarity'>): Extract<PresetId, 'PACK_REVEAL' | 'PACK_REVEAL_SPECIAL'> {
  return isSpecialReveal(face) ? 'PACK_REVEAL_SPECIAL' : 'PACK_REVEAL';
}

export function packStepMs(preset: Extract<PresetId, 'PACK_TEAR' | 'PACK_EXTRACT' | 'PACK_REVEAL' | 'PACK_REVEAL_SPECIAL'>, speed: SpeedMode, reducedMotion: boolean): number {
  return scaleDuration(presetDurationMs(preset), { speed, reducedMotion });
}

export type PackState = { readonly phase: PackPhase; readonly index: number; readonly total: number };

export type PackCommand = 'TEAR' | 'EXTRACTED' | 'NEXT' | 'REVEAL_ALL';

/**
 * Transições do estado apresentado. `index` = carta da frente (−1 antes da extração). Avançar depois da
 * última vai ao resumo; Revelar todas vai ao resumo de qualquer fase (após o recibo existir).
 */
export function packReduce(state: PackState, command: PackCommand): PackState {
  switch (command) {
    case 'TEAR':
      return state.phase === 'SEALED' ? { ...state, phase: 'TEARING' } : state;
    case 'EXTRACTED':
      return state.phase === 'TEARING' || state.phase === 'EXTRACTING' ? { ...state, phase: 'REVEALING', index: state.total > 0 ? 0 : -1 } : state;
    case 'NEXT':
      if (state.phase !== 'REVEALING') return state;
      return state.index + 1 >= state.total ? { ...state, phase: 'SUMMARY', index: state.total - 1 } : { ...state, index: state.index + 1 };
    case 'REVEAL_ALL':
      return { ...state, phase: 'SUMMARY', index: Math.max(0, state.total - 1) };
    default:
      return state;
  }
}

/** Grade do resumo: colunas e escala para caber `n` cartas no retângulo (aspecto da carta 5:7). */
export function summaryGrid(n: number, aspect: number): { columns: number; rows: number } {
  if (n <= 0) return { columns: 0, rows: 0 };
  let best = { columns: n, rows: 1, size: 0 };
  for (let columns = 1; columns <= n; columns += 1) {
    const rows = Math.ceil(n / columns);
    // Tamanho de carta (largura) que cabe num quadro de aspecto `aspect` (largura/altura).
    const size = Math.min(aspect / (columns * 1.12), 1 / (rows * 1.4 * 1.12));
    if (size > best.size + 1e-9) best = { columns, rows, size };
  }
  return { columns: best.columns, rows: best.rows };
}
