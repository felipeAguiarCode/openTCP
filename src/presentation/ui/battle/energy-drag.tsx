// Arrasto livre do orbe da Energia na mesa 2D (gameplay-pocket §6; mesmas regras da mesa 3D): passado o limiar, o orbe
// segue o ponteiro com um rastro; o Pokémon realçado sob ele cresce de leve; soltar nele liga a Energia e o orbe voa
// até a fileira de Energias da carta, que pulsa; soltar fora devolve o orbe ao prato sem aviso. O toque simples continua
// selecionando a Energia (depois, tocar no Pokémon liga).
import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import type { PokemonType } from '../../../domain/cards/types.ts';
import { TypeIcon } from '../components/icons.tsx';

export type EnergyDragEvent = { readonly phase: 'START' } | { readonly phase: 'DROP'; readonly entityId: string } | { readonly phase: 'CANCEL' };

const THRESHOLD_PX = 6;
const ATTACH_MS = 420;
const RETURN_MS = 220;

type Point = { readonly x: number; readonly y: number };
type Ghost = { readonly at: Point; readonly to: Point | null; readonly trail: readonly Point[]; readonly phase: 'DRAG' | 'ATTACH' | 'RETURN'; readonly size: number; readonly key: number };

function targetAt(x: number, y: number, targets: ReadonlySet<string>): { id: string; el: HTMLElement } | null {
  const el = typeof document !== 'undefined' ? document.elementFromPoint(x, y)?.closest<HTMLElement>('.board2d [data-entity]') : null;
  const id = el?.dataset.entity ?? null;
  return id && el && targets.has(id) ? { id, el } : null;
}

export function useEnergyDrag2D(opts: {
  readonly enabled: boolean; readonly type: PokemonType | null; readonly targets: ReadonlySet<string>; readonly onEvent?: (e: EnergyDragEvent) => void;
}) {
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [absorb, setAbsorb] = useState<string | null>(null);
  const press = useRef<{ start: Point; origin: Point; size: number; started: boolean; pointerId: number } | null>(null);
  const swallowClick = useRef(false);
  const latest = useRef(opts);
  latest.current = opts;

  const bind = {
    onPointerDown: (e: PointerEvent) => {
      if (!latest.current.enabled || !latest.current.type || e.button !== 0 || ghost) return;
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      press.current = { start: { x: e.clientX, y: e.clientY }, origin: { x: r.left + r.width / 2, y: r.top + r.height / 2 }, size: r.width, started: false, pointerId: e.pointerId };
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ponteiro sintético */ }
    },
    onPointerMove: (e: PointerEvent) => {
      const p = press.current;
      if (!p || p.pointerId !== e.pointerId) return;
      if (!p.started) {
        if (Math.hypot(e.clientX - p.start.x, e.clientY - p.start.y) < THRESHOLD_PX) return;
        p.started = true;
        latest.current.onEvent?.({ phase: 'START' });
      }
      setOver(targetAt(e.clientX, e.clientY, latest.current.targets)?.id ?? null);
      setGhost((g) => ({ at: { x: e.clientX, y: e.clientY }, to: null, trail: [...(g?.trail ?? []), { x: e.clientX, y: e.clientY }].slice(-8), phase: 'DRAG', size: p.size * 1.1, key: g?.key ?? Date.now() }));
    },
    onPointerUp: (e: PointerEvent) => {
      const p = press.current;
      press.current = null;
      if (!p?.started) return;
      swallowClick.current = true;
      setOver(null);
      const hit = targetAt(e.clientX, e.clientY, latest.current.targets);
      const at = { x: e.clientX, y: e.clientY };
      if (hit) {
        // Voo da ligação até a fileira de Energias (canto inferior esquerdo da carta) e pulso na carta.
        const r = hit.el.getBoundingClientRect();
        setGhost({ at, to: { x: r.left + r.width * 0.24, y: r.bottom - r.height * 0.1 }, trail: [], phase: 'ATTACH', size: p.size * 1.1, key: Date.now() });
        setAbsorb(hit.id);
        latest.current.onEvent?.({ phase: 'DROP', entityId: hit.id });
        setTimeout(() => setGhost(null), ATTACH_MS);
        setTimeout(() => setAbsorb((a) => (a === hit.id ? null : a)), ATTACH_MS + 500);
      } else {
        setGhost({ at, to: p.origin, trail: [], phase: 'RETURN', size: p.size * 1.1, key: Date.now() });
        latest.current.onEvent?.({ phase: 'CANCEL' });
        setTimeout(() => setGhost(null), RETURN_MS);
      }
    },
    onPointerCancel: () => {
      if (press.current?.started) {
        setOver(null);
        setGhost(null);
        latest.current.onEvent?.({ phase: 'CANCEL' });
      }
      press.current = null;
    },
    /** Envolve o onClick do orbe: ignora o clique sintético que segue um arrasto. */
    click: (fn: () => void) => () => {
      if (swallowClick.current) { swallowClick.current = false; return; }
      fn();
    },
  };

  const type = opts.type;
  const ghostEl: JSX.Element | null = ghost && type ? (
    <>
      {ghost.trail.slice(0, -1).map((t, i, all) => (
        <span key={i} class="energy-trail" aria-hidden="true"
          style={{ left: `${t.x}px`, top: `${t.y}px`, width: `${ghost.size * (0.3 + 0.4 * ((i + 1) / all.length))}px`, opacity: String(0.4 * ((i + 1) / all.length)), '--orb': `var(--pocket-type-${type.toLowerCase()})` }} />
      ))}
      <span key={ghost.key} class={`energy-ghost is-${ghost.phase.toLowerCase()}`} aria-hidden="true"
        style={{
          left: `${ghost.at.x}px`, top: `${ghost.at.y}px`, width: `${ghost.size}px`, height: `${ghost.size}px`, '--orb': `var(--pocket-type-${type.toLowerCase()})`,
          '--dx': `${ghost.to ? ghost.to.x - ghost.at.x : 0}px`, '--dy': `${ghost.to ? ghost.to.y - ghost.at.y : 0}px`,
          animationDuration: `${ghost.phase === 'ATTACH' ? ATTACH_MS : RETURN_MS}ms`,
        }}>
        <TypeIcon type={type} size={Math.round(ghost.size * 0.62)} label={false} />
      </span>
    </>
  ) : null;
  return { bind, ghostEl, over, absorb, dragging: !!ghost && ghost.phase === 'DRAG' };
}
