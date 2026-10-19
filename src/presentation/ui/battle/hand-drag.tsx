// Arrasto da mão na mesa 2D (interface §24.1, §24.16): a mesma regra da mesa 3D. Passado o limiar, uma carta
// fantasma segue o ponteiro e a UI realça os alvos legais da carta; soltar num alvo realçado joga; soltar no campo
// fora deles nega (a fantasma treme em vermelho e volta à mão) e a UI explica o motivo; soltar de volta na mão
// cancela sem aviso. O Treinador sem alvo só joga solto na zona verde e, fora dela, volta à mão sem aviso
// (gameplay-pocket §6). O clique continua sendo a alternativa por seleção (sem arrasto não há jogada).
import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import type { CardFaceData } from '../../../domain/cards/text.ts';
import { CardFace } from '../components/cards.tsx';
import type { Highlights, PickTarget } from './Board2D.tsx';

/** Mesmo valor de `PLAY_AREA` da mesa 3D e de affordances.ts. */
export const PLAY_AREA = 'PLAY_AREA';
const THRESHOLD_PX = 6;
const DENY_MS = 280;
const RETURN_MS = 200;

export type HandDragHandlers = {
  readonly onDragStart?: (cardId: string) => void;
  readonly onDrop?: (cardId: string, target: PickTarget) => void;
  readonly onDeny?: (cardId: string, target: PickTarget | null) => void;
  readonly onDragEnd?: () => void;
};

type Ghost = {
  readonly cardId: string; readonly face: CardFaceData | null; readonly width: number;
  readonly x: number; readonly y: number; readonly origin: { readonly x: number; readonly y: number };
  readonly phase: 'DRAG' | 'DENY' | 'RETURN';
  /** Sobre a zona verde do Treinador sem alvo. */
  readonly overZone: boolean;
};

/** Alvo da mesa 2D sob o ponto (botões com data-entity / data-anchor); null fora deles. */
export function targetAt(x: number, y: number): PickTarget | null {
  const el = typeof document !== 'undefined' ? document.elementFromPoint(x, y)?.closest<HTMLElement>('.board2d [data-entity], .board2d [data-anchor]') : null;
  if (!el) return null;
  if (el.dataset.entity) return { kind: 'ENTITY', entityId: el.dataset.entity };
  const anchor = el.dataset.anchor ?? '';
  return /_(ACTIVE|BENCH_\d)$/.test(anchor) ? { kind: 'SLOT', anchorId: anchor } : { kind: 'PILE', anchorId: anchor };
}

function legal(t: PickTarget | null, targets: ReadonlySet<string>): boolean {
  if (!t) return false;
  return t.kind === 'ENTITY' ? targets.has(t.entityId) : t.kind === 'SLOT' || t.kind === 'PILE' ? targets.has(t.anchorId) : false;
}

/** Campo jogável: dentro da mesa 2D e acima da mão. */
function inPlayArea(x: number, y: number, handTop: number): boolean {
  const board = typeof document !== 'undefined' ? document.querySelector('.board2d')?.getBoundingClientRect() : null;
  return !!board && x >= board.left && x <= board.right && y >= board.top && y < Math.min(board.bottom, handTop);
}

export function useHandDrag(opts: HandDragHandlers & {
  readonly highlights: Highlights; readonly locked: boolean; readonly handTop: () => number;
  /** Ponto dentro da zona verde do Treinador sem alvo (só existe durante o arrasto dele). */
  readonly zoneAt?: (x: number, y: number) => boolean;
}) {
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const press = useRef<{ cardId: string; face: CardFaceData | null; width: number; x: number; y: number; origin: { x: number; y: number }; started: boolean; pointerId: number } | null>(null);
  /** O clique que o navegador dispara depois de um arrasto não vale como seleção. */
  const swallowClick = useRef(false);
  const latest = useRef(opts);
  latest.current = opts;

  const finish = () => {
    setGhost(null);
    latest.current.onDragEnd?.();
  };

  const bind = (cardId: string, face: CardFaceData | null) => ({
    onPointerDown: (e: PointerEvent) => {
      if (latest.current.locked || e.button !== 0 || ghost) return;
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      press.current = { cardId, face, width: r.width, x: e.clientX, y: e.clientY, origin: { x: r.left + r.width / 2, y: r.top + r.height / 2 }, started: false, pointerId: e.pointerId };
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ponteiro sintético */ }
    },
    onPointerMove: (e: PointerEvent) => {
      const p = press.current;
      if (!p || p.pointerId !== e.pointerId) return;
      if (!p.started) {
        if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < THRESHOLD_PX) return;
        p.started = true;
        latest.current.onDragStart?.(p.cardId);
      }
      const overZone = latest.current.highlights.targets.has(PLAY_AREA) && !!latest.current.zoneAt?.(e.clientX, e.clientY);
      setGhost({ cardId: p.cardId, face: p.face, width: p.width, x: e.clientX, y: e.clientY, origin: p.origin, phase: 'DRAG', overZone });
    },
    onPointerUp: (e: PointerEvent) => {
      const p = press.current;
      press.current = null;
      if (!p || !p.started) return;
      swallowClick.current = true;
      const { highlights, handTop, zoneAt } = latest.current;
      const over = targetAt(e.clientX, e.clientY);
      const inField = inPlayArea(e.clientX, e.clientY, handTop());
      const zoneCard = highlights.targets.has(PLAY_AREA);
      const inZone = zoneAt ? zoneAt(e.clientX, e.clientY) : inField;
      const target = legal(over, highlights.targets) ? over : zoneCard && inZone ? { kind: 'SLOT', anchorId: PLAY_AREA } as const : null;
      if (target) {
        latest.current.onDrop?.(p.cardId, target);
        finish();
        return;
      }
      const back = (phase: Ghost['phase']) => setGhost((g) => (g ? { ...g, phase, overZone: false, ...(phase === 'RETURN' ? { x: g.origin.x, y: g.origin.y } : {}) } : g));
      if (inField && !zoneCard) {
        latest.current.onDeny?.(p.cardId, over ?? { kind: 'SLOT', anchorId: PLAY_AREA });
        back('DENY');
        setTimeout(() => back('RETURN'), DENY_MS);
        setTimeout(finish, DENY_MS + RETURN_MS);
      } else {
        back('RETURN');
        setTimeout(finish, RETURN_MS);
      }
    },
    onPointerCancel: () => {
      if (press.current?.started) finish();
      press.current = null;
    },
    /** Envolve o onClick do botão: ignora o clique sintético que segue um arrasto. */
    click: (fn: () => void) => () => {
      if (swallowClick.current) { swallowClick.current = false; return; }
      fn();
    },
  });

  const draggingId = ghost?.cardId ?? null;
  /** Arrasto em curso (não na recusa nem no retorno): só aí a zona verde aparece. */
  const dragging = ghost?.phase === 'DRAG';
  const overZone = !!ghost?.overZone;
  const ghostEl: JSX.Element | null = ghost ? (
    <div class={`hand2d-ghost is-${ghost.phase.toLowerCase()}`} aria-hidden="true"
      style={{ left: `${ghost.x}px`, top: `${ghost.y}px`, width: `${ghost.width}px`, transitionDuration: ghost.phase === 'RETURN' ? `${RETURN_MS}ms` : '0ms' }}>
      <CardFace face={ghost.face} size="sm" />
    </div>
  ) : null;
  return { bind, ghostEl, draggingId, dragging, overZone };
}
