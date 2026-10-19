// Palcos adicionais do harness com o conteúdo real do catálogo base (buildBundle): inspector, abertura de
// pacote, mapa da campanha, vitrine e Descoberta. Cada palco ocupa um painel CSS e tem HUD mínimo em DOM
// para conferir âncoras/rótulos. Não faz parte da UI do jogo.
import { buildBundle } from '../../../content/bundle.ts';
import type { ContentBundle, Cosmetic } from '../../../content/types.ts';
import { buildCatalog } from '../../../domain/cards/catalog.ts';
import { cardFace, catalogNames, type CardFaceData } from '../../../domain/cards/text.ts';
import type { NodeStatus } from '../../../domain/campaign/progress.ts';
import {
  createCampaignMapStage, createCardInspectorStage, createDiscoveryStage, createPackOpeningStage, createShowcaseStage, sleeveStyleOf,
  type CampaignMapStage, type CardInspectorStage, type CssRect, type DiscoveryStage, type FinishKind, type PackOpeningStage, type RenderSystem,
  type ShowcaseStage,
} from '../index.ts';
import type { DemoBattle } from './demo-battle.ts';

export type ExtraStageName = 'inspector' | 'pack' | 'map' | 'showcase' | 'discovery';

export type ExtraStages = {
  readonly active: () => boolean;
  readonly current: () => ExtraStageName | null;
  readonly open: (name: ExtraStageName) => void;
  readonly close: () => void;
  readonly packAction: (action: 'tear' | 'next' | 'all' | 'skip') => Promise<void>;
  readonly mapAction: (action: 'overview' | 'chapter' | 'center' | 'zoom-in' | 'zoom-out') => void;
  readonly inspectorAction: (action: 'front' | 'back' | 'rotate' | 'finish') => void;
  readonly discoveryAction: (action: 'focus' | 'select' | 'acquire') => Promise<void>;
  readonly diagnostics: () => unknown;
};

type Ui = {
  readonly button: (label: string, onClick: () => void, primary?: boolean) => HTMLButtonElement;
  readonly onOpen: () => void;
  readonly onClose: () => void;
};

type Content = {
  readonly bundle: ContentBundle;
  readonly face: (printingId: string) => CardFaceData;
  readonly cosmetic: (id: string) => Cosmetic;
};

function loadContent(): Content {
  const bundle = buildBundle();
  const catalog = buildCatalog(bundle.cards, bundle.printings);
  const cosmetics = new Map(bundle.cosmetics.map((c) => [c.cosmeticId, c]));
  return {
    bundle,
    face: (printingId) => cardFace(catalog.definition(catalog.definitionKeyOfPrinting(printingId)), catalog.printing(printingId), catalogNames(catalog)),
    cosmetic: (id) => cosmetics.get(id)!,
  };
}

/** Estados de progresso fictícios (só para visualizar todos os estados dos nós). */
function demoStatuses(bundle: ContentBundle): Map<string, NodeStatus> {
  const out = new Map<string, NodeStatus>();
  for (const n of bundle.nodes) {
    const ch = n.chapterId;
    const slot = n.nodeId.slice(4);
    let s: NodeStatus = 'LOCKED';
    if (ch === 'P00') s = slot === 'T03' ? 'CLEARED' : 'MASTERED';
    else if (ch === 'C01') s = slot === 'E02' ? 'MASTERED' : slot === 'E05' ? 'AVAILABLE' : 'CLEARED';
    else if (ch === 'C02') s = slot === 'E01' ? 'CLEARED' : slot === 'E03' ? 'IN_PROGRESS' : slot === 'E02' ? 'AVAILABLE' : 'LOCKED';
    out.set(n.nodeId, s);
  }
  return out;
}

export function mountExtraStages(rs: RenderSystem, _demo: DemoBattle, ui: Ui): ExtraStages {
  let content: Content | null = null;
  const c = () => (content ??= loadContent());
  const hud = document.getElementById('stage-hud') ?? (() => {
    const d = document.createElement('div');
    d.id = 'stage-hud';
    Object.assign(d.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '3' });
    document.body.appendChild(d);
    return d;
  })();
  const panel = document.createElement('div');
  Object.assign(panel.style, { position: 'fixed', border: '1px dashed rgb(53 125 228 / 0.35)', borderRadius: '16px', pointerEvents: 'none', display: 'none', zIndex: '2' });
  document.body.appendChild(panel);
  const contextual: HTMLButtonElement[] = [];

  let name: ExtraStageName | null = null;
  let inspector: CardInspectorStage | null = null;
  let pack: PackOpeningStage | null = null;
  let map: CampaignMapStage | null = null;
  let showcase: ShowcaseStage | null = null;
  let discovery: DiscoveryStage | null = null;
  let packCards: CardFaceData[] = [];
  let packIndex = -1;
  let discoverySelected: number | null = null;
  let finishIdx = 0;
  let mapChapter: string | null = null;
  const offs: (() => void)[] = [];

  const rectFor = (n: ExtraStageName): CssRect => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const right = Math.min(300, W * 0.24);
    if (n === 'inspector') return { x: 24, y: 24, width: Math.min(560, W * 0.42), height: H - 48 };
    if (n === 'showcase') return { x: 24, y: 24, width: Math.min(W - right - 48, (H - 48) * 1.6), height: Math.min(H * 0.62, 600) };
    return { x: 24, y: 24, width: W - right - 48, height: H - 48 };
  };

  function el(tag: string, style: Partial<CSSStyleDeclaration>, html: string): HTMLElement {
    const e = document.createElement(tag);
    Object.assign(e.style, style);
    e.innerHTML = html;
    return e;
  }

  const label = (r: CssRect, html: string, below = true, extra: Partial<CSSStyleDeclaration> = {}) => {
    hud.appendChild(el('div', {
      position: 'absolute', left: `${r.x + r.width / 2}px`, top: `${below ? r.y + r.height + 8 : r.y - 8}px`,
      transform: below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)', background: '#FFFFFF', border: '1px solid #CBDCEB',
      borderRadius: '10px', padding: '4px 10px', font: '700 13px system-ui, sans-serif', color: '#263A50', whiteSpace: 'nowrap',
      boxShadow: '0 2px 8px rgb(100 125 154 / 0.15)', ...extra,
    }, html));
  };

  function renderHud(): void {
    hud.innerHTML = '';
    if (!name) return;
    if (name === 'pack' && pack) {
      const phase = pack.phase();
      if (phase === 'REVEALING') {
        const f = packCards[pack.index()];
        if (f && packIndex === pack.index()) label(pack.getFocusRect(), `${pack.index() + 1} de ${packCards.length} · <b>${f.name}</b>${pack.index() % 2 === 0 ? ' · <span style="color:#0F8A6A">Nova</span>' : ''}`);
      } else if (phase === 'SEALED') label(pack.getFocusRect(), 'Arraste pela costura ou use “Abrir”');
      else if (phase === 'SUMMARY') {
        pack.getCardRects().forEach((r, i) => label(r, packCards[i]?.name ?? '', true, { font: '700 11px system-ui', padding: '2px 6px' }));
      }
    }
    if (name === 'map' && map) {
      const rects = map.getNodeRects();
      const nodes = c().bundle.nodes;
      for (const n of nodes) {
        const r = rects[n.nodeId];
        if (!r) continue;
        const show = mapChapter ? n.chapterId === mapChapter : n.kind === 'BOSS' || n.kind === 'FINAL' || n.nodeId === 'P00-T01';
        if (show) label(r, n.title, true, { font: '700 11px system-ui', padding: '2px 6px' });
      }
    }
    if (name === 'discovery' && discovery) {
      const offer = c().bundle.nodes.find((n) => n.nodeId === 'C02-E04')!.discoveryOffer!;
      discovery.getCardRects().forEach((r, i) => {
        const f = c().face(offer[i]!);
        label({ ...r, y: r.y + r.height + 46 }, `${f.name}${discoverySelected === i ? ' · selecionada' : ''}`, true);
      });
    }
    if (name === 'inspector' && inspector) {
      const r = inspector.getCardRect();
      hud.appendChild(el('div', { position: 'absolute', left: `${r.x}px`, top: `${r.y}px`, width: `${r.width}px`, height: `${r.height}px`, outline: '1px dashed rgb(53 125 228 / 0.4)' }, ''));
    }
  }

  function addButton(text: string, fn: () => void): void {
    contextual.push(ui.button(text, fn));
  }

  function close(): void {
    for (const off of offs.splice(0)) off();
    inspector?.dispose();
    pack?.dispose();
    map?.dispose();
    showcase?.dispose();
    discovery?.dispose();
    inspector = null;
    pack = null;
    map = null;
    showcase = null;
    discovery = null;
    for (const b of contextual.splice(0)) b.remove();
    panel.style.display = 'none';
    hud.innerHTML = '';
    if (name) {
      name = null;
      ui.onClose();
    }
  }

  function open(n: ExtraStageName): void {
    close();
    name = n;
    ui.onOpen();
    const rect = rectFor(n);
    Object.assign(panel.style, { display: 'block', left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    const k = c();
    const playerSleeve = sleeveStyleOf(k.cosmetic('sleeve-c02'));
    if (n === 'inspector') {
      inspector = createCardInspectorStage(rs, { rect, face: k.face('a1-036-charizard-ex'), sleeve: playerSleeve });
      addButton('Frente', () => inspector?.showFront());
      addButton('Ver verso', () => inspector?.showBack());
      addButton('Acabamento', () => {
        const list: (FinishKind | null)[] = [null, 'HOLOGRAPHIC', 'FOIL', 'CHROME', 'NORMAL'];
        finishIdx = (finishIdx + 1) % list.length;
        inspector?.setFinishPreview(list[finishIdx]!);
      });
    }
    if (n === 'pack') {
      const product = k.bundle.products.find((p) => p.productId === 'pack-a1-pikachu')!;
      // Recibo fictício (o harness simula o domínio): a cena só recebe a lista confirmada.
      packCards = ['a1-053-squirtle', 'a1-097-magnemite', 'a1-094-pikachu', 'a1-054-wartortle', 'a1-259-pikachu-ex'].map(k.face);
      packIndex = -1;
      pack = createPackOpeningStage(rs, {
        rect, cards: packCards, sleeve: playerSleeve,
        product: { productId: product.productId, name: product.name, cover: product.coverPrintingId ? k.face(product.coverPrintingId) : null },
      });
      offs.push(pack.onCardRevealed((i) => {
        packIndex = i;
        renderHud();
      }));
      offs.push(pack.onPhaseChange(() => renderHud()));
      offs.push(pack.onSummary(() => renderHud()));
      addButton('Abrir', () => void pack?.tear());
      addButton('Próxima', () => void pack?.next());
      addButton('Revelar todas', () => pack?.revealAll());
    }
    if (n === 'map') {
      map = createCampaignMapStage(rs, { rect, nodes: k.bundle.nodes, statuses: demoStatuses(k.bundle), selected: 'C02-E02' });
      offs.push(map.onViewChange(() => renderHud()));
      offs.push(map.onPick((p) => {
        if (p.kind === 'NODE') map?.setSelected(p.nodeId);
        else {
          mapChapter = p.chapterId;
          map?.focusChapter(p.chapterId);
        }
        renderHud();
      }));
      addButton('Mapa geral', () => {
        mapChapter = null;
        map?.focusChapter(null);
      });
      addButton('Centralizar progresso', () => map?.focusNode('C02-E02'));
      addButton('Zoom +', () => map?.zoomBy(1 / 1.25));
      addButton('Zoom −', () => map?.zoomBy(1.25));
    }
    if (n === 'showcase') {
      const starters = k.bundle.onboarding.inventory.map((i) => i.printingId);
      showcase = createShowcaseStage(rs, {
        rect, cards: [k.face('a1-285-pikachu-ex'), k.face(starters[1]!), k.face(starters[5]!)].map((face) => ({ face, sleeve: playerSleeve })),
        deckBox: { sleeve: playerSleeve, label: 'Marés Rápidas' },
      });
    }
    if (n === 'discovery') {
      const offer = k.bundle.nodes.find((x) => x.nodeId === 'C02-E04')!.discoveryOffer!;
      discoverySelected = null;
      discovery = createDiscoveryStage(rs, { rect, offers: offer.map(k.face), sleeve: playerSleeve });
      offs.push(discovery.onPick((i) => {
        discoverySelected = i;
        discovery?.setSelected(i);
        renderHud();
      }));
      addButton('Receber esta carta', () => {
        if (discoverySelected !== null) void discovery?.playAcquire(discoverySelected);
      });
    }
    const hudTimer = window.setInterval(renderHud, 250);
    offs.push(() => window.clearInterval(hudTimer));
    renderHud();
  }

  const onResize = () => {
    if (!name) return;
    const r = rectFor(name);
    Object.assign(panel.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.width}px`, height: `${r.height}px` });
    inspector?.setRect(r);
    pack?.setRect(r);
    map?.setRect(r);
    showcase?.setRect(r);
    discovery?.setRect(r);
  };
  window.addEventListener('resize', onResize);

  for (const n of ['inspector', 'pack', 'map', 'showcase', 'discovery'] as const) {
    ui.button(({ inspector: 'Inspector', pack: 'Pacote', map: 'Mapa', showcase: 'Vitrine', discovery: 'Descoberta' } as const)[n], () => open(n));
  }
  ui.button('Fechar palco', () => close());

  return {
    active: () => name !== null,
    current: () => name,
    open,
    close,
    packAction: async (a) => {
      if (!pack) return;
      if (a === 'tear') await pack.tear();
      else if (a === 'next') await pack.next();
      else if (a === 'all') pack.revealAll();
      else pack.skip();
      renderHud();
    },
    mapAction: (a) => {
      if (!map) return;
      if (a === 'overview') {
        mapChapter = null;
        map.focusChapter(null, false);
      } else if (a === 'chapter') {
        mapChapter = 'C02';
        map.focusChapter('C02', false);
      } else if (a === 'center') map.focusNode('C02-E02', false);
      else map.zoomBy(a === 'zoom-in' ? 0.8 : 1.25);
      renderHud();
    },
    inspectorAction: (a) => {
      if (!inspector) return;
      if (a === 'front') inspector.showFront();
      else if (a === 'back') inspector.showBack();
      else if (a === 'rotate') inspector.rotateBy(0.45, -0.2);
      else inspector.setFinishPreview('CHROME');
    },
    discoveryAction: async (a) => {
      if (!discovery) return;
      if (a === 'focus') discovery.setFocus(0);
      else if (a === 'select') {
        discoverySelected = 1;
        discovery.setFocus(null);
        discovery.setSelected(1);
      } else await discovery.playAcquire(discoverySelected ?? 1);
      renderHud();
    },
    diagnostics: () => ({ name, map: map?.diagnostics() ?? null, pack: pack ? { phase: pack.phase(), index: pack.index() } : null, render: rs.diagnostics() }),
  };
}
