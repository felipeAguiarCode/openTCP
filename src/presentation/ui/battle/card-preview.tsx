// Prévia ampliada por hover (interface §24.2, §24.16): passar o ponteiro sobre uma carta da mão mostra a face grande
// no centro da tela, para ler os textos (decisão do autor, 15/10/2026); as cartas da mesa não abrem prévia — elas
// mesmas sobem e flutuam. Não bloqueia nada (sem ponteiro, oculta para leitores de tela — o inspector continua sendo a
// leitura completa por clique/teclado) e só existe em dispositivos com hover. Um intervalo breve antes de abrir ou
// trocar evita piscar ao atravessar a mão.
import type { JSX } from 'preact';
import type { ReadonlySignal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import type { BattleView } from '../../../domain/battle/views.ts';
import type { ContentIndex } from '../../../application/content.ts';
import { CardFace, faceOf } from '../components/cards.tsx';
import { cardRefOf } from './affordances.ts';
import type { PickTarget } from './Board2D.tsx';
import { boxStyle, previewRect, toBox, type StageLayout } from './layout.ts';

/** Intervalo antes de abrir, trocar ou fechar a prévia (`UI_HOVER`). */
export const PREVIEW_DELAY_MS = 120;

const canHover = (): boolean => typeof matchMedia !== 'function' || matchMedia('(hover: hover)').matches;

export function CardPreview({ layout, view, content, target, hidden = false }: {
  readonly layout: StageLayout; readonly view: BattleView; readonly content: ContentIndex;
  /** Alvo sob o ponteiro agora (mesa 3D ou 2D); null fora de qualquer carta. */
  readonly target: ReadonlySignal<PickTarget | null>;
  /** Outra leitura já está aberta (inspector). */
  readonly hidden?: boolean;
}): JSX.Element | null {
  const next = target.value;
  const key = next ? JSON.stringify(next) : '';
  const [shown, setShown] = useState<PickTarget | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setShown(next), PREVIEW_DELAY_MS);
    return () => clearTimeout(t);
  }, [key]);
  // Resolve contra a vista atual: carta jogada, nocauteada ou descartada some da prévia sem esperar o ponteiro.
  const ref = shown?.kind === 'HAND_CARD' ? cardRefOf(view, shown) : null;
  const face = ref ? faceOf(content, ref.printingId) : null;
  if (!face || hidden || !canHover()) return null;
  return (
    <div class="card-preview" style={boxStyle(toBox(layout, previewRect(layout)))} aria-hidden="true" data-testid="card-preview" data-printing={ref!.printingId}>
      <CardFace face={face} size="xl" />
    </div>
  );
}
