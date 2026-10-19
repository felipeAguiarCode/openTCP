// Promoção depois do nocaute (gameplay-pocket §6.2): sem painel. Uma mensagem simples no centro, os Pokémon do Banco que
// podem subir flutuam e o jogador arrasta um deles até o espaço do Ativo; sem arrasto, escolhe um e toca no Ativo. A
// resposta continua sendo RESOLVE_DECISION com o entityId escolhido. Lógica pura, compartilhada pelas mesas 3D e 2D.
import type { DecisionView } from '../../../domain/battle/views.ts';
import type { PickTarget } from './Board2D.tsx';

/** Espaço que recebe o promovido: o Ativo vazio do jogador. */
export const PROMOTE_TARGET = 'HUMAN_ACTIVE';

/** EntityIds que podem subir quando a decisão pendente do jogador é PROMOTE; vazio em qualquer outra. */
export function promotionOptions(decision: DecisionView | null | undefined): readonly string[] {
  return decision && decision.kind === 'PROMOTE' && !decision.answered ? decision.options ?? [] : [];
}

/** Realces: as opções flutuam e ficam selecionáveis, o Ativo vazio pulsa como alvo e a escolhida fica selecionada. */
export function promotionHighlights(options: readonly string[], picked: string | null): {
  readonly floating: readonly string[]; readonly selectable: readonly string[]; readonly targets: readonly string[]; readonly selected: readonly string[];
} {
  if (!options.length) return { floating: [], selectable: [], targets: [], selected: [] };
  return { floating: options, selectable: options, targets: [PROMOTE_TARGET], selected: picked && options.includes(picked) ? [picked] : [] };
}

export type PromotionStep =
  | { readonly kind: 'SELECT'; readonly entityId: string | null }
  | { readonly kind: 'RESOLVE'; readonly entityId: string }
  | { readonly kind: 'NONE' };

/** Clique durante a promoção: numa opção, escolhe (de novo, desfaz); no Ativo com uma escolhida, resolve. */
export function promotionPick(options: readonly string[], picked: string | null, target: PickTarget): PromotionStep {
  if (target.kind === 'ENTITY' && options.includes(target.entityId)) return { kind: 'SELECT', entityId: picked === target.entityId ? null : target.entityId };
  if (target.kind === 'SLOT' && target.anchorId === PROMOTE_TARGET && picked && options.includes(picked)) return { kind: 'RESOLVE', entityId: picked };
  return { kind: 'NONE' };
}

/** Soltura sobre o Ativo: resolve com o Pokémon arrastado, se ele é uma das opções. */
export function promotionDrop(options: readonly string[], entityId: string): PromotionStep {
  return options.includes(entityId) ? { kind: 'RESOLVE', entityId } : { kind: 'NONE' };
}
