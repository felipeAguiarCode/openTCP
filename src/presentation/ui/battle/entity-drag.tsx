// Arrasto de um Pokémon em campo na mesa 2D (promoção depois do nocaute, gameplay-pocket §6.2): só os Pokémon que
// flutuam (realce `floating`) podem ser arrastados. Passado o limiar, a carta fantasma segue o ponteiro e a origem
// esmaece; solta sobre o espaço do Ativo, a UI responde a promoção; fora dele, volta ao Banco. O clique continua
// sendo a alternativa (escolher e, depois, tocar no Ativo).
import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import type { CardFaceData } from '../../../domain/cards/text.ts';
import { CardFace } from '../components/cards.tsx';
import { targetAt } from './hand-drag.tsx';

const THRESHOLD_PX = 6;
const RETURN_MS = 200;

type Ghost = {
  readonly entityId: string; readonly face: CardFaceData | null; readonly width: number;
  readonly x: number; readonly y: number; readonly origin: { readonly x: number; readonly y: number };
  readonly phase: 'DRAG' | 'RETURN'; readonly over: boolean;
};

/** Ponto sobre o espaço do Ativo do jogador (vazio depois do nocaute). */
function overActive(x: number, y: number): boolean {
  const t = targetAt(x, y);
  return t?.kind === 'SLOT' && t.anchorId === 'HUMAN_ACTIVE';
}

export function useEntityDrag2D(opts: {
  readonly floating: ReadonlySet<string>; readonly locked: boolean; readonly onDrop?: (entityId: string) => void;
}) {
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const press = useRef<{ entityId: string; face: CardFaceData | null; width: number; x: number; y: number; origin: { x: number; y: number }; started: boolean; pointerId: number } | null>(null);
  const swallowClick = useRef(false);
  const latest = useRef(opts);
  latest.current = opts;

  const bind = (entityId: string, face: CardFaceData | null) => latest.current.floating.has(entityId) ? {
    onPointerDown: (e: PointerEvent) => {
      if (latest.current.locked || e.button !== 0 || ghost) return;
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      press.current = { entityId, face, width: r.width, x: e.clientX, y: e.clientY, origin: { x: r.left + r.width / 2, y: r.top + r.height / 2 }, started: false, pointerId: e.pointerId };
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ponteiro sintético */ }
    },
    onPointerMove: (e: PointerEvent) => {
      const p = press.current;
      if (!p || p.pointerId !== e.pointerId) return;
      if (!p.started) {
        if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < THRESHOLD_PX) return;
        p.started = true;
      }
      setGhost({ entityId: p.entityId, face: p.face, width: p.width, x: e.clientX, y: e.clientY, origin: p.origin, phase: 'DRAG', over: overActive(e.clientX, e.clientY) });
    },
    onPointerUp: (e: PointerEvent) => {
      const p = press.current;
      press.current = null;
      if (!p || !p.started) return;
      swallowClick.current = true;
      if (overActive(e.clientX, e.clientY)) {
        latest.current.onDrop?.(p.entityId);
        setGhost(null);
        return;
      }
      setGhost((g) => (g ? { ...g, phase: 'RETURN', over: false, x: g.origin.x, y: g.origin.y } : g));
      setTimeout(() => setGhost(null), RETURN_MS);
    },
    onPointerCancel: () => {
      if (press.current?.started) setGhost(null);
      press.current = null;
    },
  } : {};

  /** Envolve o onClick do slot: ignora o clique sintético que segue um arrasto. */
  const click = (fn: () => void) => () => {
    if (swallowClick.current) { swallowClick.current = false; return; }
    fn();
  };

  const draggingId = ghost?.entityId ?? null;
  const overTarget = ghost?.phase === 'DRAG' && ghost.over;
  const ghostEl: JSX.Element | null = ghost ? (
    <div class={`hand2d-ghost entity2d-ghost is-${ghost.phase.toLowerCase()} ${ghost.over ? 'is-over' : ''}`} aria-hidden="true"
      style={{ left: `${ghost.x}px`, top: `${ghost.y}px`, width: `${ghost.width}px`, transitionDuration: ghost.phase === 'RETURN' ? `${RETURN_MS}ms` : '0ms' }}>
      <CardFace face={ghost.face} size="sm" />
    </div>
  ) : null;
  return { bind, click, ghostEl, draggingId, overTarget };
}
