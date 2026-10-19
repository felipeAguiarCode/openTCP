// Palco do duelo: mede a área disponível e entrega a geometria do perfil (layout.ts) para posicionar
// HUD, mesa, mão, ações e guia nas regiões do battle-layout.json.
import type { ComponentChildren, JSX } from 'preact';
import { useLayoutEffect, useState } from 'preact/hooks';
import { boxStyle, stageLayout, toBox, type Rect, type StageLayout } from './layout.ts';

export function useStageLayout(): { readonly ref: (el: HTMLDivElement | null) => void; readonly layout: StageLayout } {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState<[number, number]>(() => [typeof innerWidth === 'number' ? innerWidth : 1920, typeof innerHeight === 'number' ? innerHeight : 1080]);
  useLayoutEffect(() => {
    if (!el) return;
    const measure = () => setSize((prev) => (prev[0] === el.clientWidth && prev[1] === el.clientHeight ? prev : [el.clientWidth, el.clientHeight]));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return { ref: setEl, layout: stageLayout(size[0], size[1]) };
}

/** Região do perfil posicionada no palco. */
export function Region({ layout, rect, class: cls, children, label }: {
  readonly layout: StageLayout; readonly rect: Rect; readonly class?: string; readonly children?: ComponentChildren; readonly label?: string;
}): JSX.Element {
  return <div class={`stage-region ${cls ?? ''}`} style={boxStyle(toBox(layout, rect))} aria-label={label}>{children}</div>;
}

/** Área do guia de cenário: margem esquerda (inspector) em 1080p; canto superior esquerdo livre em 720p. */
export function guideRect(layout: StageLayout): Rect {
  return layout.profile === 'desktop1080' ? layout.regions.inspector : [16, 44, 290, 250];
}
