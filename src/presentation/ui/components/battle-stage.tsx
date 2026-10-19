// Hospedeiro da mesa de batalha (interface §23; runtime §12–§19). Com WebGL2 e sem a preferência 2D, monta a
// mesa Three.js no renderer compartilhado e uma camada semântica HTML por cima: botões transparentes nas
// âncoras projetadas (mesmos data-anchor/aria-label da mesa 2D), PS grande no canto da carta, contadores e
// números flutuantes. Cliques do ponteiro passam pela mesa 3D (picking); teclado aciona os botões. Sem
// WebGL2 ou com perda de contexto não recuperada, cai para Board2D + Hand2D com os mesmos alvos e comandos.
import type { JSX } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { PlayerId } from '../../../domain/battle/types.ts';
import type { BattleView, CardRef, EntityView, SideView } from '../../../domain/battle/views.ts';
import { TYPE_LABEL } from '../../../domain/cards/text.ts';
import type { PokemonType } from '../../../domain/cards/types.ts';
import { HUMAN } from '../../../application/battle.ts';
import type { ContentIndex } from '../../../application/content.ts';
import type { Cosmetic } from '../../../content/types.ts';
import { sleeveArtUrl } from '../../assets/sleeves.ts';
import type { PresentedBoard, PresentedEntity } from '../../animation/board-model.ts';
import type { CustomMatImage } from '../../../application/appearance.ts';
import {
  createBattleStage, createStagePresenter, type AnchorRect, type BattleCue, type BattlePresentationInput, type BattleStage, type CosmeticVisualInput,
  type MatImageSource, type MatImageStatus, type PlaymatDisplayMode,
} from '../../three/index.ts';
import { content, reducedMotion, settings } from '../app/store.ts';
import { attachRenderer, detachRenderer, glStatus, qualityOf } from '../app/renderer.ts';
import { faceOf } from './cards.tsx';
import { assetObjectUrl, displayedMatImage } from './mat-image.tsx';
import { HpNumber } from '../battle/pocket.tsx';
import { Board2D, Hand2D, entityLabel, type FloatingNumber, type Highlights, type PickTarget } from '../battle/Board2D.tsx';
import type { HandDragHandlers } from '../battle/hand-drag.tsx';
import { cardRefOf } from '../battle/affordances.ts';
import { EffectMarks, marksOf } from '../battle/effect-marks.tsx';
import type { MatchController } from '../battle/controller.ts';
import type { SlotId, StageLayout } from '../battle/layout.ts';

type HostProps = {
  readonly layout: StageLayout;
  readonly names: { readonly human: string; readonly npc: string };
  readonly controller: MatchController;
  readonly highlights: Highlights;
  readonly onPick: (t: PickTarget) => void;
  readonly onInspect: (ref: CardRef) => void;
  /** Ponteiro sobre uma carta (picking 3D ou botões da mesa 2D); null fora de qualquer alvo. */
  readonly onHover?: (t: PickTarget | null) => void;
  readonly locked: boolean;
  /**
   * Visão provisória da preparação na mesa (gameplay-pocket §4): as cartas escolhidas já nos slots, antes de
   * “Iniciar duelo”. Sem ela, a mesa segue a visão confirmada do controlador.
   */
  readonly viewOverride?: BattleView | null;
  /** Pokémon da preparação ainda virados para baixo (desviram na revelação ao iniciar o duelo). */
  readonly faceDown?: ReadonlySet<string>;
  /** Arrasto livre do orbe da Energia pronta (gameplay-pocket §6). */
  readonly onEnergyDrag?: (e: import('../battle/energy-drag.tsx').EnergyDragEvent) => void;
  /** Pokémon flutuante (realce `floating`) solto sobre o Ativo vazio: promoção depois do nocaute. */
  readonly onEntityDrop?: (entityId: string) => void;
} & HandDragHandlers;

/** URLs de objeto resolvidas por assetId (null = asset ausente/ilegível; sem entrada = ainda resolvendo). */
export type MatImageUrls = Readonly<Record<string, string | null>>;

/** Imagem local do tapete (snapshot congelado) → fonte da mesa 3D, com a URL de objeto do asset. */
export function matImageSource(image: CustomMatImage | null | undefined, urls: MatImageUrls): MatImageSource | null {
  if (!image) return null;
  const known = Object.prototype.hasOwnProperty.call(urls, image.assetId);
  return {
    id: image.assetId, url: known ? urls[image.assetId] ?? null : null, pending: !known,
    width: image.width, height: image.height, crop: image.crop, baseHex: image.baseHex,
  };
}

/** Imagens locais dos dois lados, pela mesma regra da mesa 2D (`displayedMatImage`: jogador fixo / turno do adversário). */
function sideMatImages(snapshot: unknown): { readonly player: CustomMatImage | null; readonly opponent: CustomMatImage | null } {
  return { player: displayedMatImage(snapshot, 'PLAYER_FIXED', true), opponent: displayedMatImage(snapshot, 'TURN_OWNER', false) };
}

/** Verso de cada lado (presentationSnapshot.cosmetics): imagem do sleeve do Pocket equipado; null = verso padrão. */
export function sideSleeveUrls(c: ContentIndex, snapshot: unknown): { readonly human: string | null; readonly npc: string | null } {
  const p = (snapshot ?? {}) as { cosmetics?: { player?: Record<string, unknown>; opponent?: Record<string, unknown> } };
  const url = (id: unknown) => (typeof id === 'string' ? sleeveArtUrl(c.cosmetics.get(id)?.visual.assetKey) : null);
  return { human: url(p.cosmetics?.player?.sleeveId), npc: url(p.cosmetics?.opponent?.sleeveId) };
}

/** Moeda equipada de cada lado (presentationSnapshot.cosmetics): quem lança usa a do próprio deck. */
export function sideCoins(c: ContentIndex, snapshot: unknown): { readonly player: Cosmetic | null; readonly opponent: Cosmetic | null } {
  const p = (snapshot ?? {}) as { cosmetics?: { player?: Record<string, unknown>; opponent?: Record<string, unknown> } };
  const pick = (id: unknown): Cosmetic | null => (typeof id === 'string' ? c.cosmetics.get(id) ?? null : null);
  return { player: pick(p.cosmetics?.player?.coinId), opponent: pick(p.cosmetics?.opponent?.coinId) };
}

/** Cosméticos da tentativa (presentationSnapshot.cosmetics) → entrada visual da mesa 3D. */
export function battlePresentation(c: ContentIndex, snapshot: unknown, displayMode: PlaymatDisplayMode, urls: MatImageUrls = {}): BattlePresentationInput {
  const p = (snapshot ?? {}) as { arenaId?: string; cosmetics?: { player?: Record<string, unknown>; opponent?: Record<string, unknown> } };
  const pick = (id: unknown): CosmeticVisualInput | null => (typeof id === 'string' ? c.cosmetics.get(id) ?? null : null);
  const images = sideMatImages(snapshot);
  const loadout = (x: Record<string, unknown> | undefined, image: CustomMatImage | null) => ({
    playmat: pick(x?.playmatId), sleeve: pick(x?.sleeveId), coin: pick(x?.coinId), matImage: matImageSource(image, urls),
  });
  return {
    arenaId: p.arenaId ?? 'arena-academy',
    playerCosmetics: loadout(p.cosmetics?.player, images.player),
    opponentCosmetics: loadout(p.cosmetics?.opponent, images.opponent),
    displayMode,
  };
}

export function BattleStageHost(props: HostProps): JSX.Element | null {
  const c = content.value;
  const status = glStatus.value;
  if (!c) return null;
  if (status === 'UNAVAILABLE') return <Fallback2D {...props} content={c} />;
  return <Stage3D {...props} content={c} />;
}

function Fallback2D(props: HostProps & { readonly content: ContentIndex }): JSX.Element {
  const { layout, names, controller, highlights, onPick, onInspect, onHover, locked, content: c, onDragStart, onDrop, onDeny, onDragEnd, onEnergyDrag, onEntityDrop, faceDown } = props;
  const view = props.viewOverride ?? controller.view.value;
  return (
    <>
      <Board2D layout={layout} names={names} view={view} content={c} human={HUMAN} highlights={highlights} floating={controller.floating.value}
        onPick={onPick} onInspect={onInspect} onHover={onHover} locked={locked} onEnergyDrag={onEnergyDrag} onEntityDrop={onEntityDrop} faceDown={faceDown}
        matImage={displayedMatImage(controller.session.presentation, settings.value.playmatDisplay, view.currentPlayer === HUMAN)} sleeves={sideSleeveUrls(c, controller.session.presentation)} />
      <Hand2D layout={layout} cards={view.sides[HUMAN].hand ?? []} content={c} highlights={highlights} onPick={onPick} onInspect={onInspect} onHover={onHover} locked={locked}
        onDragStart={onDragStart} onDrop={onDrop} onDeny={onDeny} onDragEnd={onDragEnd} />
    </>
  );
}

function Stage3D(props: HostProps & { readonly content: ContentIndex }): JSX.Element {
  const { layout, controller, highlights, locked, content: c } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<BattleStage | null>(null);
  const [board, setBoard] = useState<PresentedBoard | null>(null);
  const [rects, setRects] = useState<Record<string, AnchorRect>>({});
  const [floating, setFloating] = useState<readonly (FloatingNumber & { readonly key: number })[]>([]);
  const [orbs, setOrbs] = useState<readonly { readonly anchor: string; readonly key: number }[]>([]);
  const boardRef = useRef<PresentedBoard | null>(null);
  boardRef.current = board;
  const latest = useRef(props);
  latest.current = props;
  /** Último pick vindo do picking 3D (para o clique do botão semântico não duplicar). */
  const lastStagePick = useRef(0);
  const view = props.viewOverride ?? controller.view.value;
  // Imagem local do tapete (UI-111/113): as URLs de objeto dos assets dos dois lados chegam assíncronas;
  // a mesa mostra a do dono exibido (mesma regra da 2D) e informa o status para o aviso HTML.
  const [matUrls, setMatUrls] = useState<MatImageUrls>({});
  const [matStatus, setMatStatus] = useState<MatImageStatus>('none');
  const images = sideMatImages(controller.session.presentation);
  const assetIds = [images.player?.assetId, images.opponent?.assetId].filter((x): x is string => typeof x === 'string');
  useEffect(() => {
    let alive = true;
    for (const id of new Set(assetIds)) {
      void assetObjectUrl(id).then((url) => { if (alive) setMatUrls((m) => (m[id] === url ? m : { ...m, [id]: url })); });
    }
    return () => { alive = false; };
  }, [assetIds.join('|')]);
  const presentation = battlePresentation(c, controller.session.presentation, settings.value.playmatDisplay, matUrls);
  const presentationKey = JSON.stringify([settings.value.playmatDisplay, matUrls, assetIds]);
  const frame = { x: layout.offset[0], y: layout.offset[1], width: layout.design[0] * layout.scale, height: layout.design[1] * layout.scale };

  // Monta a mesa 3D uma vez por controlador; o presenter do controlador passa a animar cada lote confirmado.
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const rs = attachRenderer(host, qualityOf(settings.value.quality));
    if (!rs) return;
    const s = createBattleStage(rs, {
      attemptId: controller.session.attemptId,
      layoutProfile: latest.current.layout.profile,
      frame,
      speed: settings.value.animationSpeed,
      reducedMotion: reducedMotion.value,
      presentation,
      resolveCard: (ref) => {
        const face = faceOf(c, ref.printingId);
        return face ? { face, definition: c.catalog.definition(ref.definitionKey) } : null;
      },
    });
    s.setView(controller.view.value, presentation);
    controller.setPresenter(createStagePresenter(s));
    let raf = 0;
    const refresh = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setRects(s.getAnchorRects());
      });
    };
    const offs = [
      s.onPresentedChange((b) => setBoard(b)),
      s.onAnchorsChanged(refresh),
      s.onPick((t) => {
        lastStagePick.current = performance.now();
        latest.current.onPick(t);
      }),
      s.onInspect((t) => {
        const ref = cardRefOf(latest.current.viewOverride ?? latest.current.controller.view.value, t);
        if (ref) latest.current.onInspect(ref);
      }),
      s.onHover((t) => latest.current.onHover?.(t)),
      s.onDragIntent((intent) => {
        // Soltou num alvo realçado: a UI resolve a jogada; se nada for apresentado, a carta volta à mão.
        latest.current.onDrop?.(intent.cardId, intent.target);
        setTimeout(() => { if (!s.isPresenting()) s.cancelDrag(); }, 1500);
      }),
      s.onDragStart((cardId) => latest.current.onDragStart?.(cardId)),
      s.onDragEnd(() => latest.current.onDragEnd?.()),
      s.onDragDenied((d) => latest.current.onDeny?.(d.cardId, d.target)),
      s.onEnergyDrag((e) => latest.current.onEnergyDrag?.(e)),
      s.onEntityDrop((d) => latest.current.onEntityDrop?.(d.entityId)),
      s.onCue((cue) => onCue(cue)),
      s.onMatImageStatus(setMatStatus),
    ];
    setMatStatus(s.matImageStatus());
    const offInput = rs.addInputSurface(overlayRef.current ?? host);
    setBoard(s.getPresentedBoard());
    setRects(s.getAnchorRects());
    setStage(s);
    return () => {
      for (const off of offs) off();
      latest.current.onHover?.(null);
      offInput();
      if (raf) cancelAnimationFrame(raf);
      controller.setPresenter(null);
      s.dispose();
      detachRenderer(host);
      setStage(null);
    };
  }, [controller]);

  // Cues da apresentação → HUD HTML existente (faixa de turno, moeda) e números flutuantes.
  const coinFaces = useRef<('HEADS' | 'TAILS')[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => { for (const t of timers.current) clearTimeout(t); }, []);
  const later = (ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, ms)); };
  function onCue(cue: BattleCue): void {
    const ctl = latest.current.controller;
    const quick = reducedMotion.value || settings.value.animationSpeed === 'INSTANT';
    if (cue.kind === 'TURN_BANNER' && !cue.skipped) {
      const shown = { role: cue.role === 'HUMAN' ? 'HUMAN' as const : 'NPC' as const, turn: cue.turnNumber || null, key: Date.now() };
      ctl.banner.value = shown;
      // Turno 1: “Pronto? Já!” antes da faixa (gameplay-pocket §5.1).
      later((quick ? 600 : 1200) + (shown.turn === 1 ? (quick ? 300 : 900) : 0), () => { if (ctl.banner.value === shown) ctl.banner.value = null; });
    } else if (cue.kind === 'COIN_RESULT') {
      if (cue.index === 0) coinFaces.current = [];
      coinFaces.current.push(cue.face);
      const shown = { faces: [...coinFaces.current], player: cue.player, key: Date.now() + Math.random() };
      ctl.coin.value = shown;
      later(1400, () => { if (ctl.coin.value === shown) ctl.coin.value = null; });
    } else if (cue.kind === 'POINTS' && !cue.skipped) {
      const shown = { role: cue.role === 'HUMAN' ? 'HUMAN' as const : 'NPC' as const, points: cue.points, total: cue.total, pointsToWin: ctl.view.value.pointsToWin, key: Date.now() };
      ctl.scoring.value = shown;
      later(quick ? 900 : 2500, () => { if (ctl.scoring.value === shown) ctl.scoring.value = null; });
    } else if (cue.kind === 'ENERGY_GENERATED' && !cue.skipped) {
      // Flash no prato e rótulo “Próxima Energia gerada” (gameplay-pocket §5.2), no fim do passo que gerou.
      const shown = { role: cue.role === 'HUMAN' ? 'HUMAN' as const : 'NPC' as const, key: Date.now() + Math.random() };
      ctl.energyGen.value = shown;
      later(quick ? 900 : 1500, () => { if (ctl.energyGen.value === shown) ctl.energyGen.value = null; });
    } else if (cue.kind === 'KNOCKOUT' && !cue.skipped) {
      // Orbe ciano no lugar da carta (gameplay-pocket §10.4), depois de o PS ficar em 0 por um instante.
      const anchor = anchorOfEntity(boardRef.current, cue.entityId);
      if (anchor) {
        const item = { anchor, key: Date.now() + Math.random() };
        setOrbs((o) => [...o, item]);
        later(quick ? 500 : 1300, () => setOrbs((o) => o.filter((x) => x.key !== item.key)));
      }
    } else if ((cue.kind === 'DAMAGE' || cue.kind === 'HEAL') && !cue.skipped) {
      const item = { entityId: cue.entityId, text: cue.kind === 'HEAL' ? `+${cue.amount}` : cue.kind === 'DAMAGE' && cue.prevented ? '0' : `${cue.amount}`, kind: cue.kind === 'HEAL' ? 'heal' as const : 'damage' as const, key: Date.now() + Math.random() };
      setFloating((f) => [...f, item]);
      later(950, () => setFloating((f) => f.filter((x) => x.key !== item.key)));
    }
  }

  // Layout, preferências, realces e bloqueio seguem a UI.
  useEffect(() => {
    if (!stage) return;
    stage.setLayoutProfile(layout.profile);
    stage.setFrame(frame);
  }, [stage, layout.profile, layout.scale, layout.offset[0], layout.offset[1]]);
  useEffect(() => { stage?.setSpeed(settings.value.animationSpeed); }, [stage, settings.value.animationSpeed]);
  useEffect(() => { stage?.setReducedMotion(reducedMotion.value); }, [stage, reducedMotion.value]);
  useEffect(() => { stage?.setHighlights(highlights); });
  useEffect(() => { stage?.setLocked(locked); }, [stage, locked]);
  // URLs resolvidas ou preferência de tapete alterada: a mesa reaplica o tapete exibido sem reiniciar.
  useEffect(() => { stage?.setPresentation(presentation); }, [stage, presentationKey]);
  // Preparação na mesa: a disposição provisória vira poses imediatas (sem animação nem gravação).
  // Só reaplica quando a visão provisória difere da confirmada (a abertura da partida não é cancelada); ao tirar a
  // última carta, volta à visão confirmada.
  const appliedStaged = useRef(false);
  useEffect(() => {
    if (!stage) return;
    const ov = props.viewOverride;
    if (ov && ov !== controller.view.value) { stage.setView(ov, presentation); appliedStaged.current = true; }
    else if (ov && appliedStaged.current) { stage.setView(controller.view.value, presentation); appliedStaged.current = false; }
  }, [stage, props.viewOverride]);
  // Preparação: os Básicos colocados ficam virados; ao enviar, a mesa mantém a disposição até a revelação os substituir
  // no mesmo lugar (também virados) e desvirar todos juntos — sem voltar as cartas à mão por um instante.
  const faceDownKey = [...(props.faceDown ?? [])].join('|');
  useEffect(() => { stage?.setFaceDown(props.faceDown ?? []); }, [stage, faceDownKey]);
  // Contexto restaurado: os recursos voltam pela GPU; repõe as poses confirmadas.
  useEffect(() => { if (stage && glStatus.value === 'READY') stage.setView(controller.view.value, presentation); }, [glStatus.value]);

  return (
    <div class="stage3d" data-mat-image={matStatus}>
      {/* Elemento vazio só para o canvas compartilhado (o Preact não gerencia filhos aqui). */}
      <div class="stage3d-canvas" ref={hostRef} />
      <div class="stage3d-overlay" ref={overlayRef} role="group" aria-label="Mesa de batalha">
        {stage ? <Overlay view={view} board={board} rects={rects} props={props} floating={floating} stage={stage} lastStagePick={lastStagePick} /> : null}
        {orbs.map((o) => (rects[o.anchor] ? <span key={o.key} class="ko-orb" style={box(rects[o.anchor]) ?? undefined} aria-hidden="true" /> : null))}
      </div>
      {matStatus === 'missing' ? (
        <div class="stage3d-frame" style={box(frame) ?? undefined}>
          <span class="b2-mat-missing" role="status">Imagem do tapete indisponível — usando o tapete neutro</span>
        </div>
      ) : null}
    </div>
  );
}

/** Âncora do slot onde está a entidade (para o orbe do Nocaute). */
function anchorOfEntity(board: PresentedBoard | null, entityId: string): string | null {
  if (!board) return null;
  for (const player of ['A', 'B'] as const) {
    const prefix = player === HUMAN ? 'HUMAN' : 'NPC';
    const side = board.sides[player];
    if (side?.active?.entityId === entityId) return `${prefix}_ACTIVE`;
    const i = side?.bench.findIndex((e) => e?.entityId === entityId) ?? -1;
    if (i >= 0) return `${prefix}_BENCH_${i}`;
  }
  return null;
}

const box = (r: AnchorRect | undefined): Record<string, string> | null => (r ? { left: `${r.x}px`, top: `${r.y}px`, width: `${r.width}px`, height: `${r.height}px` } : null);

function presentedAt(board: PresentedBoard | null, player: PlayerId, slot: 'ACTIVE' | 0 | 1 | 2): PresentedEntity | null {
  const side = board?.sides[player];
  if (!side) return null;
  return slot === 'ACTIVE' ? side.active : side.bench[slot] ?? null;
}

function Overlay({ view, board, rects, props, floating, stage, lastStagePick }: {
  readonly view: BattleView; readonly board: PresentedBoard | null; readonly rects: Record<string, AnchorRect>;
  readonly props: HostProps & { readonly content: ContentIndex }; readonly floating: readonly FloatingNumber[]; readonly stage: BattleStage;
  readonly lastStagePick: { readonly current: number };
}): JSX.Element {
  const { highlights, onPick, onInspect, locked, content: c } = props;
  const human: PlayerId = view.viewer;
  const npc: PlayerId = human === 'A' ? 'B' : 'A';
  const covered = stage.getOverlayRects();
  const isCovered = (r: AnchorRect) => covered.some((o) => r.x + r.width - 8 >= o.x && r.x + r.width - 8 <= o.x + o.width && r.y >= o.y && r.y <= o.y + o.height);
  // O ponteiro passa pela mesa 3D (picking). O botão age no teclado (detail 0) ou quando o picking não
  // reconheceu este clique — nunca os dois.
  const keyOnly = (fn: () => void) => (e: MouseEvent) => { if (e.detail === 0 || performance.now() - lastStagePick.current > 250) fn(); };

  const slot = (player: PlayerId, prefix: 'HUMAN' | 'NPC', index: 'ACTIVE' | 0 | 1 | 2) => {
    const anchorId = (index === 'ACTIVE' ? `${prefix}_ACTIVE` : `${prefix}_BENCH_${index}`) as SlotId;
    const entity: EntityView | null = index === 'ACTIVE' ? view.sides[player].active : view.sides[player].bench[index] ?? null;
    const shown = presentedAt(board, player, index);
    const rect = (shown ? rects[`ENTITY:${shown.entityId}`] : undefined) ?? rects[anchorId];
    const style = box(rect);
    if (!style) return null;
    const size = index === 'ACTIVE' ? 'b2-active' : 'b2-bench';
    if (!entity) {
      const target = highlights.targets.has(anchorId);
      return <button key={anchorId} type="button" class={`s3-slot ${size} is-empty`} style={style} data-anchor={anchorId} disabled={locked || !target}
        aria-label={target ? 'Espaço vazio — escolher este espaço' : 'Espaço vazio'} onClick={keyOnly(() => onPick({ kind: 'SLOT', anchorId }))} />;
    }
    const id = entity.entityId;
    const hp = shown ?? null;
    const hpPct = hp && hp.maxHp ? (hp.remainingHp / hp.maxHp) * 100 : 0;
    const hideHp = !hp || hp.knockedOut || !!props.faceDown?.has(id) || (rect ? isCovered(rect) : false);
    return (
      <button key={anchorId} type="button" class={`s3-slot ${size}`} style={style} data-anchor={anchorId} data-entity={id} aria-label={entityLabel(c, entity)}
        aria-pressed={highlights.selected.has(id)} disabled={locked} onClick={keyOnly(() => onPick({ kind: 'ENTITY', entityId: id }))}
        onContextMenu={(e) => { e.preventDefault(); onInspect(entity.top); }}>
        {!hideHp ? <span class={`b2-hp ${hpPct <= 25 ? 'is-low' : ''}`} aria-hidden="true"><HpNumber value={hp!.remainingHp} reduced={reducedMotion.value} /><span class="b2-hpbar"><span style={{ width: `${hpPct}%` }} /></span></span> : null}
        {hp ? <EffectMarks key={id} marks={marksOf(hp.conditions, hp.effects)} reduced={reducedMotion.value} paused={hideHp} /> : null}
        {floating.filter((f) => f.entityId === id).map((n, i) => <span key={i} class={`b2-float b2-float-${n.kind}`} aria-hidden="true">{n.text}</span>)}
      </button>
    );
  };

  const piles = (player: PlayerId, prefix: 'HUMAN' | 'NPC') => {
    const side: SideView = view.sides[player];
    const shown = board?.sides[player];
    const whose = prefix === 'HUMAN' ? 'seu' : 'do adversário';
    const deck = box(rects[`${prefix}_DECK_TOP`]);
    const discard = box(rects[`${prefix}_DISCARD`]);
    return (
      <>
        {deck ? <button type="button" class="s3-pile" style={deck} data-anchor={`${prefix}_DECK_TOP`} onClick={keyOnly(() => onPick({ kind: 'PILE', anchorId: `${prefix}_DECK_TOP` }))}
          aria-label={`Baralho ${whose}: ${side.deckCount} cartas`}><b class="b2-count" aria-hidden="true">{shown?.deckCount ?? side.deckCount}</b></button> : null}
        {discard ? <button type="button" class="s3-pile" style={discard} data-anchor={`${prefix}_DISCARD`} onClick={keyOnly(() => onPick({ kind: 'PILE', anchorId: `${prefix}_DISCARD` }))}
          aria-label={`Descarte ${whose}: ${side.discard.length} cartas`}><b class="b2-count" aria-hidden="true">{shown?.discard.length ?? side.discard.length}</b></button> : null}
      </>
    );
  };

  const energy = (player: PlayerId, prefix: 'HUMAN' | 'NPC') => {
    const side = view.sides[player];
    const ready = side.energyZone.ready as PokemonType | null;
    const next = side.energyZone.next as PokemonType | null;
    const selectable = highlights.selectable.has(`${prefix}_ENERGY_READY`);
    const r = box(rects[`${prefix}_ENERGY_READY`]);
    const n = box(rects[`${prefix}_ENERGY_NEXT`]);
    const of = prefix === 'NPC' ? ' do adversário' : '';
    return (
      <>
        {r ? <button type="button" class="s3-token" style={r} data-anchor={`${prefix}_ENERGY_READY`} disabled={locked || !selectable}
          aria-pressed={highlights.selected.has(`${prefix}_ENERGY_READY`)} onClick={keyOnly(() => onPick({ kind: 'PILE', anchorId: `${prefix}_ENERGY_READY` }))}
          aria-label={ready ? `Energia pronta${of}: ${TYPE_LABEL[ready]}` : 'Sem Energia pronta'} title={ready ? `Pronta: ${TYPE_LABEL[ready]}` : 'Sem Energia pronta'} /> : null}
        {n ? <span class="s3-token" style={n} data-anchor={`${prefix}_ENERGY_NEXT`} role="img" title={next ? `Próxima: ${TYPE_LABEL[next]}` : 'Sem próxima Energia'}
          aria-label={next ? `Próxima Energia${of}: ${TYPE_LABEL[next]}` : 'Sem próxima Energia'} /> : null}
      </>
    );
  };

  const npcHand = box(rects.NPC_HAND);
  const stadium = box(rects.STADIUM);
  const hand = view.sides[human].hand ?? [];
  return (
    <>
      {[0, 1, 2].map((i) => slot(npc, 'NPC', i as 0 | 1 | 2))}
      {slot(npc, 'NPC', 'ACTIVE')}
      {slot(human, 'HUMAN', 'ACTIVE')}
      {[0, 1, 2].map((i) => slot(human, 'HUMAN', i as 0 | 1 | 2))}
      {piles(npc, 'NPC')}
      {piles(human, 'HUMAN')}
      {energy(npc, 'NPC')}
      {energy(human, 'HUMAN')}
      {view.stadium && stadium ? (
        <button type="button" class="s3-pile" style={stadium} data-anchor="STADIUM" onClick={keyOnly(() => onInspect(view.stadium!))}
          aria-label={`Estádio em jogo: ${faceOf(c, view.stadium.printingId)?.name}`} />
      ) : null}
      {npcHand ? (
        <div class="s3-npc-hand" style={npcHand} data-anchor="NPC_HAND" role="img" aria-label={`Mão do adversário: ${view.sides[npc].handCount} cartas`}>
          <b class="b2-count" aria-hidden="true">{board?.sides[npc].hand.length ?? view.sides[npc].handCount}</b>
        </div>
      ) : null}
      {/* Mão: desenhada em 3D (hover/arrasto no canvas); a lista semântica fica para teclado e leitores de tela. */}
      <ul class="sr-only" data-anchor="HUMAN_HAND" aria-label={`Sua mão: ${hand.length} cartas`}>
        {hand.map((h) => {
          const face = faceOf(c, h.printingId);
          const playable = highlights.selectable.has(h.cardId);
          return (
            <li key={h.cardId}>
              <button type="button" disabled={locked} aria-pressed={highlights.selected.has(h.cardId)} aria-label={`${face?.name ?? 'Carta'}${playable ? ', jogável' : ''}`}
                onFocus={() => stage.setKeyboardFocus(h.cardId)} onBlur={() => stage.setKeyboardFocus(null)}
                onClick={() => onPick({ kind: 'HAND_CARD', cardId: h.cardId })} onContextMenu={(e) => { e.preventDefault(); onInspect(h); }}>
                {face?.name ?? 'Carta'}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
