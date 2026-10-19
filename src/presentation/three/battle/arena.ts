// Arena da mesa no estilo do Pocket (gameplay-pocket §2): um círculo grande no centro de espelho que envolve os dois
// Bancos, com aro branco e filete lilás; dentro dele a metade do adversário em coral e a do jogador clara; uma faixa
// clara atravessa o centro e um disco branco fica atrás dos Ativos. Fora da arena, claro em cima e azul embaixo.
// O dono do turno acende a sua metade (coral mais forte no turno do adversário, azulada no do jogador).
// Geometria em px de projeto, compartilhada pela mesa 3D (projetada no plano da mesa) e pela 2D (CSS).

export const ARENA = {
  /** Raio = distância do centro de espelho ao canto de Banco mais distante × folga. */
  radiusPad: 1.04,
  rimPx: 16,
  strokePx: 3,
  bandPx: 56,
  /** Disco central (× largura do Ativo) e o disco interno lilás-azulado (× raio do disco). */
  discK: 1.0,
  innerK: 0.66,
} as const;

export type ArenaSlot = { readonly center: readonly number[]; readonly size: readonly number[] };

/** Raio da arena em px de projeto: envolve os cantos de todos os espaços de Banco, com folga. */
export function arenaRadiusPx(cx: number, cy: number, benches: readonly ArenaSlot[]): number {
  let far = 0;
  for (const b of benches) {
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) far = Math.max(far, Math.hypot(b.center[0]! + (sx * b.size[0]!) / 2 - cx, b.center[1]! + (sy * b.size[1]!) / 2 - cy));
    }
  }
  return far * ARENA.radiusPad;
}

/** Cores (sRGB) da arena e do entorno: repouso e com o turno daquele lado. */
export const ARENA_COLORS = {
  farTop: '#EE9095', farCenter: '#F2ABAC', farHotTop: '#E8767D', farHotCenter: '#EE9499',
  nearCenter: '#D3E0F8', nearBottom: '#C3D8F6', nearHotCenter: '#C4DAFA', nearHotBottom: '#A7CBF8',
  rim: '#FFFFFF', stroke: '#D3D0EE', band: '#ECEFF6',
  outsideTop: '#E8F2FB', outsideCenter: '#DCE3F5', outsideNear: '#CBDBF6', outsideBottom: '#45A9F6',
  disc: '#ECEFF6', discInner: '#D6DFFC',
} as const;
