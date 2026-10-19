// Hospedeiro genérico de palco 3D num painel HTML: empresta o renderer compartilhado ao elemento, cria o
// palco cobrindo o elemento inteiro, acompanha o tamanho e devolve o canvas ao desmontar. Sem WebGL2, com a
// preferência 2D ou com o canvas ocupado por outra tela, `stage` fica nulo e a cena HTML equivalente aparece.
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { RenderSystem } from '../../three/index.ts';
import { webglAvailable } from '../app/boot.ts';
import { attachRenderer, detachRenderer, glStatus, qualityOf } from '../app/renderer.ts';
import { settings } from '../app/store.ts';

type Rect = { x: number; y: number; width: number; height: number };
export type PanelStageLike = { readonly setRect: (rect: Rect) => void; readonly dispose: () => void };

/** 3D permitido agora (WebGL2 detectado, sem preferência 2D, sem perda de contexto definitiva). */
export function stage3dAllowed(): boolean {
  return webglAvailable.value === true && !settings.value.presentation2d && glStatus.value !== 'UNAVAILABLE';
}

export function useStageHost<T extends PanelStageLike>(create: (rs: RenderSystem) => T | null, deps: readonly unknown[]): {
  readonly ref: (el: HTMLDivElement | null) => void;
  readonly stage: T | null;
} {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [stage, setStage] = useState<T | null>(null);
  const createRef = useRef(create);
  createRef.current = create;
  const allowed = stage3dAllowed();
  useLayoutEffect(() => {
    if (!el || !allowed) return;
    const rs = attachRenderer(el, qualityOf(settings.value.quality));
    if (!rs) return;
    const s = createRef.current(rs);
    if (!s) {
      detachRenderer(el);
      return;
    }
    const sync = () => s.setRect({ x: 0, y: 0, width: el.clientWidth, height: el.clientHeight });
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    setStage(s);
    return () => {
      ro.disconnect();
      s.dispose();
      detachRenderer(el);
      setStage(null);
    };
  }, [el, allowed, ...deps]);
  return { ref: setEl, stage };
}
