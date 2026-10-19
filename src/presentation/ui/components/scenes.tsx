// Pontes entre telas HTML e cenas 3D do renderer compartilhado (interface §5.4, §36.1). Com WebGL2 (e sem
// a preferência 2D) cada cena monta o palco Three.js correspondente; sem ele, ou com o canvas ocupado, a
// versão HTML equivalente é exibida — a informação e os controles semânticos nunca dependem só do canvas.
import type { JSX } from 'preact';
import { packArtUrl } from '../../assets/pack-art.ts';
import { PackArt } from './pack-art.tsx';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { CampaignNode, Product } from '../../../content/types.ts';
import { Button } from './controls.tsx';
import type { NodeStatus } from '../../../domain/campaign/progress.ts';
import {
  createCampaignMapStage, createCardInspectorStage, createPackOpeningStage, type CampaignMapStage, type CardInspectorStage,
  type CssRect, type PackOpeningStage,
} from '../../three/index.ts';
import { content, reducedMotion, settings } from '../app/store.ts';
import { CardFace, faceOf } from './cards.tsx';
import { useStageHost } from './stage-host.tsx';

/**
 * Exposição e corte do pacote (interface §9.9). O resultado já foi confirmado; o gesto só define o
 * momento da revelação. Botão “Abrir” substitui o gesto (sem exigir precisão motora). Em 3D o PackVisual
 * faz o corte (costura e tira) e a revelação segue na tela HTML do recibo.
 */
/** Frente oficial do pacote carregada antes de montar a embalagem 3D (ready = carregou, falhou ou não há arte). */
function usePackArtImage(productId: string | undefined): { readonly ready: boolean; readonly img: HTMLImageElement | null } {
  const url = packArtUrl(productId);
  const [loaded, setLoaded] = useState<{ url: string; img: HTMLImageElement | null } | null>(null);
  useEffect(() => {
    if (!url || typeof Image === 'undefined') return undefined;
    let alive = true;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { if (alive) setLoaded({ url, img }); };
    img.onerror = () => { if (alive) setLoaded({ url, img: null }); };
    img.src = url;
    return () => { alive = false; };
  }, [url]);
  if (!url) return { ready: true, img: null };
  return loaded?.url === url ? { ready: true, img: loaded.img } : { ready: false, img: null };
}

export function PackOpeningScene({ product, reducedMotion: reduced, onOpened }: { readonly product: Product | null; readonly reducedMotion: boolean; readonly onOpened: () => void }): JSX.Element {
  const c = content.value;
  const [tearing, setTearing] = useState(false);
  const art = usePackArtImage(product?.productId);
  const host = useStageHost<PackOpeningStage>((rs) => {
    if (!product || !art.ready) return null;
    const cover = product.coverPrintingId && c ? faceOf(c, product.coverPrintingId) : null;
    return createPackOpeningStage(rs, {
      product: { productId: product.productId, name: product.name, cover, art: art.img }, cards: [], background: 'NONE',
      reducedMotion: reduced, speed: settings.value.animationSpeed,
    });
  }, [product?.productId, art.ready]);
  const started = useRef(false);
  const begin = (drive: boolean) => {
    if (started.current) return;
    started.current = true;
    setTearing(true);
    if (drive) void host.stage?.tear();
    setTimeout(onOpened, reduced ? 150 : 720);
  };
  // Gesto na costura (arrasto) também abre: o palco avisa quando o corte começa.
  useEffect(() => host.stage?.onPhaseChange((phase) => { if (phase === 'TEARING') begin(false); }), [host.stage]);
  const open = () => begin(true);
  return (
    <div class={`pack-stage ${tearing ? 'is-tearing' : ''} ${host.stage ? 'is-3d' : ''}`}>
      <div class="pack-3d">
        <div class="scene3d-canvas" ref={host.ref} />
        <button type="button" class="pack-volume" onClick={open} aria-label={`Abrir ${product?.name ?? 'pacote'}`} data-testid="tear-pack">
          {!host.stage ? (product && packArtUrl(product.productId) ? <PackArt product={product} size="lg" />
            : <><span class="pack-strip" aria-hidden="true" /><span class="pack-body" aria-hidden="true"><span>{product?.name}</span></span></>) : null}
        </button>
      </div>
      <Button variant="primary" size="lg" onClick={open} loading={tearing}>Abrir</Button>
    </div>
  );
}

const SHAPE: Record<string, string> = {
  TUTORIAL: 'M-9 -9h18v18h-18z',
  DUEL: 'M0 -11a11 11 0 1 1 0 22a11 11 0 1 1 0-22z',
  PUZZLE: 'M0 -12l12 12-12 12-12-12z',
  DISCOVERY: 'M0 -12l3.5 8 8.5 1-6.3 5.8 1.8 8.4-7.5-4.3-7.5 4.3 1.8-8.4-6.3-5.8 8.5-1z',
  ELITE: 'M0 -12l10.4 6v12l-10.4 6-10.4-6v-12z',
  BOSS: 'M-12 -8l6 6 6-10 6 10 6-6v16h-24z',
  FINAL: 'M-13 -13h26v26h-26z',
};

const STATUS_TEXT: Record<NodeStatus, string> = { LOCKED: 'bloqueado', AVAILABLE: 'disponível', IN_PROGRESS: 'em andamento', CLEARED: 'concluído', MASTERED: 'dominado' };

/**
 * Mapa da campanha (interface §20). Em 3D: dioramas e nós no palco ortográfico inclinado, com os botões
 * semânticos HTML reposicionados sobre os nós projetados a cada pan/zoom. Versão HTML/SVG equivalente sem
 * WebGL: mesmas posições de nó, formas por tipo e estados por forma + texto. Ordem de foco = progressão.
 */
export function CampaignMapScene({ nodes, statuses, selected, onSelect, onOpen, chapterId }: {
  readonly nodes: readonly CampaignNode[]; readonly statuses: ReadonlyMap<string, NodeStatus>; readonly selected: string;
  readonly onSelect: (nodeId: string) => void; readonly onOpen: (nodeId: string) => void; readonly chapterId?: string;
}): JSX.Element {
  const [rects, setRects] = useState<Record<string, CssRect>>({});
  const host = useStageHost<CampaignMapStage>((rs) => createCampaignMapStage(rs, {
    nodes, statuses, selected, focusChapter: chapterId ?? null, background: 'NONE', reducedMotion: reducedMotion.value,
  }), [nodes.map((n) => n.nodeId).join('|'), chapterId ?? '']);
  const stage = host.stage;
  useEffect(() => {
    if (!stage) return;
    const offs = [
      stage.onViewChange(() => setRects(stage.getNodeRects())),
      stage.onPick((p) => { if (p.kind === 'NODE') onSelect(p.nodeId); }),
    ];
    setRects(stage.getNodeRects());
    return () => { for (const off of offs) off(); };
  }, [stage]);
  useEffect(() => { stage?.setStatuses(statuses); }, [stage, statuses]);
  // Seleção vinda da UI (lista, "Centralizar progresso"): destaca e leva o nó ao centro.
  const firstSelect = useRef(true);
  useEffect(() => {
    if (!stage) return;
    stage.setSelected(selected || null);
    if (firstSelect.current) firstSelect.current = false;
    else if (selected) stage.focusNode(selected);
  }, [stage, selected]);
  useEffect(() => { stage?.setReducedMotion(reducedMotion.value); }, [stage, reducedMotion.value]);

  const xs = nodes.map((n) => n.map.x);
  const zs = nodes.map((n) => n.map.z);
  const minX = Math.min(...xs) - 1;
  const maxX = Math.max(...xs) + 1;
  const minZ = Math.min(...zs) - 1;
  const maxZ = Math.max(...zs) + 1;
  const W = 1000;
  const H = 560;
  const px = (x: number) => ((x - minX) / Math.max(1e-6, maxX - minX)) * (W - 120) + 60;
  const pz = (z: number) => ((z - minZ) / Math.max(1e-6, maxZ - minZ)) * (H - 120) + 60;
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));
  const onKey = (e: KeyboardEvent, index: number) => {
    if (e.key === 'Enter') { e.preventDefault(); onOpen(nodes[index]!.nodeId); return; }
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
    const next = nodes[(index + delta + nodes.length) % nodes.length]!;
    onSelect(next.nodeId);
    stage?.focusNode(next.nodeId);
    requestAnimationFrame(() => (document.querySelector(`[data-map-node="${next.nodeId}"]`) as HTMLElement | null)?.focus());
  };
  // Posição do botão: nó projetado (3D) ou coordenada do SVG (2D), em % do contêiner no 2D.
  const placeOf = (n: CampaignNode): Record<string, string> | null => {
    if (stage) {
      const r = rects[n.nodeId];
      return r ? { left: `${r.x + r.width / 2}px`, top: `${r.y + r.height / 2}px` } : null;
    }
    return { left: `${(px(n.map.x) / W) * 100}%`, top: `${(pz(n.map.z) / H) * 100}%` };
  };
  return (
    <div class={`campaign-map ${chapterId ? `chapter-${chapterId.toLowerCase()}` : 'is-overview'} ${stage ? 'is-3d' : ''}`}>
      <div class="scene3d-canvas" ref={host.ref} />
      {!stage ? (
        <svg viewBox={`0 0 ${W} ${H}`} class="campaign-map-svg" aria-hidden="true">
          {nodes.flatMap((n) => n.prerequisites.allOf.filter((p) => byId.has(p)).map((p) => {
            const a = byId.get(p)!;
            return <line key={`${p}-${n.nodeId}`} x1={px(a.map.x)} y1={pz(a.map.z)} x2={px(n.map.x)} y2={pz(n.map.z)} class={`map-path ${n.essential ? 'is-main' : 'is-optional'}`} />;
          }))}
          {nodes.map((n) => {
            const status = statuses.get(n.nodeId) ?? 'LOCKED';
            return (
              <g key={n.nodeId} transform={`translate(${px(n.map.x)} ${pz(n.map.z)})`} class={`map-node status-${status.toLowerCase()} ${selected === n.nodeId ? 'is-selected' : ''}`}>
                <circle r="22" class="map-node-halo" />
                <path d={SHAPE[n.kind] ?? SHAPE.DUEL} class="map-node-shape" />
                {status === 'MASTERED' ? <circle r="27" class="map-node-mastery" /> : null}
              </g>
            );
          })}
        </svg>
      ) : null}
      <ol class="campaign-map-buttons">
        {nodes.map((n, i) => {
          const status = statuses.get(n.nodeId) ?? 'LOCKED';
          const place = placeOf(n);
          if (!place) return null;
          return (
            <li key={n.nodeId} style={place}>
              <button type="button" data-map-node={n.nodeId} class={`map-node-button ${selected === n.nodeId ? 'is-selected' : ''}`}
                aria-label={`${n.title}, ${STATUS_TEXT[status]}`} aria-pressed={selected === n.nodeId}
                onClick={() => onSelect(n.nodeId)} onKeyDown={(e) => onKey(e, i)}>
                <span class="map-node-label">{n.title}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Inspector da carta (interface §11.6): em 3D, rotação limitada por arrasto; “Ver verso” e “Centralizar”. */
export function CardInspectorScene({ printingId }: { readonly printingId: string }): JSX.Element {
  const c = content.value;
  const [back, setBack] = useState(false);
  const face = c ? faceOf(c, printingId) : null;
  const host = useStageHost<CardInspectorStage>((rs) => (face ? createCardInspectorStage(rs, { face, background: 'NONE', reducedMotion: reducedMotion.value }) : null), [printingId]);
  const stage = host.stage;
  useEffect(() => stage?.onSideChange((side) => setBack(side === 'BACK')), [stage]);
  useEffect(() => { stage?.setReducedMotion(reducedMotion.value); }, [stage, reducedMotion.value]);
  const toggle = () => {
    if (stage) stage.toggleSide();
    else setBack(!back);
  };
  const center = () => {
    if (stage) stage.showFront();
    setBack(false);
  };
  return (
    <div class={`inspector-2d ${stage ? 'is-3d' : ''}`}>
      <div class={`inspector-card ${back ? 'is-back' : ''}`}>
        <div class="scene3d-canvas" ref={host.ref} />
        {!stage ? <CardFace face={face} hidden={back} size="xl" /> : <span class="sr-only">{face?.name ?? 'Carta'}{back ? ' (verso)' : ''}</span>}
      </div>
      <div class="row">
        <Button size="sm" onClick={toggle}>{back ? 'Ver frente' : 'Ver verso'}</Button>
        <Button size="sm" variant="ghost" onClick={center}>Centralizar</Button>
      </div>
    </div>
  );
}
