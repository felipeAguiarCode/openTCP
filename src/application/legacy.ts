// Perfil do catálogo antigo (conteúdo 1.0.0, cartas genéricas): o conteúdo 2.0.0 trocou todas as cartas pelo Genetic
// Apex, sem migração. Um perfil com impressões que não existem no conteúdo atual e não são autorais (o Estúdio usa o
// prefixo `print-`) não abre — o jogador cria um novo jogo; os dados antigos ficam no banco para exportar ou arquivar.
import type { ContentIndex } from './content.ts';

export const LEGACY_PROFILE_MESSAGE = 'Criado com o catálogo antigo de cartas genéricas. As cartas mudaram para o Genetic Apex: crie um novo jogo.';

/** Impressões do inventário que não existem no conteúdo atual nem são autorais. */
export function legacyPrintings(inventory: readonly { readonly printingId: string; readonly quantity: number }[], content: ContentIndex | null): string[] {
  if (!content) return [];
  return inventory.filter((i) => i.quantity > 0 && !i.printingId.startsWith('print-') && !content.catalog.printings.has(i.printingId)).map((i) => i.printingId);
}

export const isLegacyInventory = (inventory: readonly { readonly printingId: string; readonly quantity: number }[], content: ContentIndex | null): boolean =>
  legacyPrintings(inventory, content).length > 0;
