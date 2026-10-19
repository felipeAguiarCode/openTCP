// Duelo (interface §21–§29): S21 carregamento, S22 preparação, S23 mesa, S24 resultado e S39 replay.
// Toda ação é confirmada no SQLite antes de ser apresentada; a IA joga em passos e para na pausa.
import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import {
  abandonAttempt, aiShouldAct, resumeAttempt, sessionFixture, startAttempt, suspendAttempt, HUMAN, type BattleResultSummary, type BattleSession,
} from '../../../application/battle.ts';
import { nodeView } from '../../../application/campaign.ts';
import { getPlayerView, redactEvents } from '../../../domain/battle/engine.ts';
import type { Action, BattleEvent, MatchState } from '../../../domain/battle/types.ts';
import type { BattleView, CardRef } from '../../../domain/battle/views.ts';
import { go } from '../app/router.ts';
import { battleSession, confirmDialog, content, ctx, reducedMotion, requireCtx, saveDeviceSettings, settings, snapshot, toast } from '../app/store.ts';
import { pausedByVisibility, resumeAfterVisibility } from '../app/lifecycle.ts';
import { webglAvailable } from '../app/boot.ts';
import { RewardChip, faceOf } from '../components/cards.tsx';
import { Button, EmptyState, ErrorState, Modal, Panel, Segmented, Skeleton, Toggle } from '../components/controls.tsx';
import { Icon } from '../components/icons.tsx';
import { computeAffordances, findEntity, PLAY_AREA_TARGET } from '../battle/affordances.ts';
import { Board2D, Hand2D, type PickTarget } from '../battle/Board2D.tsx';
import { createMatchController, humanView, type MatchController } from '../battle/controller.ts';
import { describeEvents } from '../battle/log.ts';
import { DecisionPanel, HistoryDrawer, InspectorDrawer, type Pending, type Selection } from '../battle/panels.tsx';
import { EMPTY_STAGING, placeCard, setupSelection, setupTargets, stagedCardOf, stagedCards, stagedFaceDown, stagedView, unplaceCard, type SetupStaging } from '../battle/setup-stage.ts';
import {
  BattleMenu, CardSpotlight, CoinResult, EnergyGenerated, ResultPill, ScoringOverlay, SetupControls, ToastLayer, TurnBanner, type BattleToast,
} from '../battle/pocket.tsx';
import { DuelIntro, markFreshAttempt, takeFreshAttempt } from '../battle/duel-intro.tsx';
import { CoinToss } from '../battle/coin-toss.tsx';
import { promotionDrop, promotionHighlights, promotionOptions, promotionPick } from '../battle/promotion.ts';
import { AvatarCircle, EndTurnButton, FloatingButton, PlayerPlate, turnStatus, type PlateAvatar } from '../battle/hud.tsx';
import { playerPortraitKey, portraitUrl } from '../../assets/portraits.ts';
import { CardActions, FloatingActions } from '../battle/actions.tsx';
import type { EnergyDragEvent } from '../battle/energy-drag.tsx';
import { isPokemon } from '../../../domain/cards/types.ts';
import { FixtureGuide } from '../battle/guide.tsx';
import { CardPreview } from '../battle/card-preview.tsx';
import { Region, useStageLayout } from '../battle/stage.tsx';
import { displayedMatImage } from '../components/mat-image.tsx';
import { BattleStageHost, sideCoins, sideSleeveUrls } from '../components/battle-stage.tsx';
import { glStatus } from '../app/renderer.ts';
import { coinOwner } from '../../three/battle/coin-art.ts';
import { DIFFICULTY_LABEL, dialogueText } from './campaign.tsx';
import type { Difficulty } from '../../../content/types.ts';

type Params = { params: Readonly<Record<string, string>>; query: Readonly<Record<string, string>> };

async function loadSession(attemptId: string): Promise<BattleSession | string> {
  const current = battleSession.value;
  if (current && current.attemptId === attemptId) return current;
  const game = requireCtx();
  const snap = snapshot.value;
  if (!snap?.activeAttempt || snap.activeAttempt.attemptId !== attemptId) return 'Esta tentativa não está ativa.';
  const r = await resumeAttempt(game);
  if (!r.ok) return r.message;
  battleSession.value = r.session;
  return r.session;
}

function setupPending(session: BattleSession): boolean {
  return session.state.pendingDecisions.some((d) => d.player === HUMAN && d.kind === 'SETUP' && !d.answered);
}

/** S21 — prepara a tentativa local: valida, carrega o que for local e abre a mesa (interface §21). */
export function LoadingScreen({ params }: Params): JSX.Element {
  const [step, setStep] = useState('Validando a tentativa');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const s = await loadSession(params.attemptId ?? '');
      if (!alive) return;
      if (typeof s === 'string') { setError(s); return; }
      setStep('Preparando a mesa');
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      if (!alive) return;
      go(setupPending(s) ? 'S22' : 'S23', { matchId: s.attemptId }, {}, { replace: true });
    })();
    return () => { alive = false; };
  }, [params.attemptId]);
  return (
    <div class="bare-screen">
      <div class="panel entry-card" aria-busy={!error}>
        <h1 id="page-title" tabIndex={-1}>Preparando o duelo</h1>
        {error ? <ErrorState text={error} onRetry={() => go('S03')} /> : <p class="muted"><span class="spinner" aria-hidden="true" /> {step}…</p>}
      </div>
    </div>
  );
}

export function SetupScreen(props: Params): JSX.Element {
  return <MatchScreen {...props} />;
}

export function MatchScreen({ params }: Params): JSX.Element {
  const c = content.value;
  const [ctl, setCtl] = useState<MatchController | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [inspect, setInspect] = useState<CardRef | null>(null);
  // Alvo sob o ponteiro: signal próprio para só a prévia re-renderizar a cada hover.
  const hover = useMemo(() => signal<PickTarget | null>(null), []);
  const onHover = (t: PickTarget | null) => { hover.value = t; };
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [retreatPick, setRetreatPick] = useState<{ benchIndex: number; payments: readonly (readonly string[])[] } | null>(null);
  // Carta da mão sendo arrastada (realça os alvos dela) e motivo da última soltura recusada.
  const [dragging, setDragging] = useState<string | null>(null);
  const [energyDragging, setEnergyDragging] = useState(false);
  const [deny, setDeny] = useState<{ readonly text: string; readonly key: number } | null>(null);
  useEffect(() => {
    if (!deny) return;
    const t = setTimeout(() => setDeny((d) => (d === deny ? null : d)), 2200);
    return () => clearTimeout(t);
  }, [deny]);
  const [tick, setTick] = useState(0);
  // Abertura “VS” e, logo depois, o cara ou coroa de quem começa (uma vez por tentativa recém-iniciada): a IA espera os dois.
  const [opening, setOpening] = useState<'INTRO' | 'TOSS' | null>(null);
  const openingShown = opening !== null;
  const { ref: stageRef, layout } = useStageLayout();
  const matchId = params.matchId ?? '';

  useEffect(() => {
    let alive = true;
    let controller: MatchController | null = null;
    void (async () => {
      const s = await loadSession(matchId);
      if (!alive) return;
      if (typeof s === 'string') { setLoadError(s); return; }
      if (s.state.result) { go('S24', { matchId }, {}, { replace: true }); return; }
      const game = requireCtx();
      const raw = await game.storage.query({ kind: 'GET_EVENTS', attemptId: s.attemptId, fromSeq: 0 }).catch(() => []);
      const history = raw.map((r) => r.event as unknown as BattleEvent);
      s.paused = false;
      controller = createMatchController(game, s, humanView(game, s), history);
      setCtl(controller);
      if (takeFreshAttempt(s.attemptId)) setOpening('INTRO');
    })();
    return () => { alive = false; controller?.dispose(); };
  }, [matchId]);

  const view = ctl?.view.value ?? null;
  // Preparação na mesa (gameplay-pocket §4): disposição provisória até “Iniciar duelo”; nada vai ao motor antes.
  const setupDecision = view?.decisions.find((d) => d.player === HUMAN && d.kind === 'SETUP' && !d.answered) ?? null;
  const [staging, setStaging] = useState<SetupStaging>(EMPTY_STAGING);
  const [setupSubmitting, setSetupSubmitting] = useState(false);
  useEffect(() => { setStaging(EMPTY_STAGING); setSetupSubmitting(false); }, [setupDecision?.decisionId]);
  // Promoção depois do nocaute (gameplay-pocket §6.2): o Pokémon escolhido por clique, antes de tocar no Ativo.
  const promoteDecision = view?.decisions.find((d) => d.player === HUMAN && d.kind === 'PROMOTE' && !d.answered) ?? null;
  const promoteOptions = promotionOptions(promoteDecision);
  const [promotePick, setPromotePick] = useState<string | null>(null);
  useEffect(() => { setPromotePick(null); }, [promoteDecision?.decisionId]);
  const [menuOpen, setMenuOpen] = useState(false);
  // Aviso transitório no topo (recusa de ataque etc.): some sozinho e tem prioridade sobre o aviso de contexto.
  const [flash, setFlash] = useState<BattleToast | null>(null);
  useEffect(() => {
    if (!flash) return undefined;
    const t = setTimeout(() => setFlash((f) => (f === flash ? null : f)), 1800);
    return () => clearTimeout(t);
  }, [flash]);
  useEffect(() => { ctl?.setSpeed(settings.value.animationSpeed); ctl?.setReducedMotion(reducedMotion.value); }, [ctl, settings.value.animationSpeed, reducedMotion.value]);

  // Turno ou decisão da IA: um passo por vez, nunca durante pausa (interface §27.1).
  useEffect(() => {
    if (!ctl || !view || pauseOpen || openingShown || pausedByVisibility.value) return;
    ctl.session.paused = false;
    if (aiShouldAct(ctl.session)) void ctl.runAi();
  }, [ctl, view, pauseOpen, openingShown, pausedByVisibility.value]);

  useEffect(() => { if (pauseOpen && ctl) ctl.session.paused = true; }, [pauseOpen]);

  // Fim da partida: o resultado já foi gravado na mesma transação da última ação. A pílula Vitória/Derrota (e a ida
  // ao S24) espera a tela “+1 ponto!” sair — na mesa 2D o estado final chega junto com o ponto.
  const scoringShown = !!ctl?.scoring.value;
  useEffect(() => {
    if (!view?.result || !ctl || scoringShown) return;
    const t = setTimeout(() => go('S24', { matchId }, {}, { replace: true }), reducedMotion.value ? 700 : 2600);
    return () => clearTimeout(t);
  }, [view?.result, scoringShown]);

  // Preparação concluída: S22 vira S23 sem recarregar a mesa.
  useEffect(() => {
    if (ctl && view && view.phase !== 'SETUP' && location.hash.includes('/setup')) go('S23', { matchId }, {}, { replace: true });
  }, [view?.phase]);

  const aff = useMemo(() => (ctl && view && c ? computeAffordances(ctl.session.state, c.catalog, view, HUMAN) : null), [ctl, view, c]);

  const act = async (action: Action) => {
    if (!ctl) return;
    if (action.type === 'ATTACK' && settings.value.confirmAttack) {
      const name = aff?.attacks.find((a) => a.attack.id === action.attackId)?.attack.name ?? 'ataque';
      if (!(await confirmDialog({ title: `Usar ${name}?`, body: 'Atacar encerra o seu turno.', confirmLabel: 'Atacar' }))) return;
    }
    setPending(null);
    setSelection(null);
    setRetreatPick(null);
    await ctl.submit(action);
    setTick(tick + 1);
  };

  const endTurn = async () => {
    if (!ctl || !view) return;
    if (settings.value.confirmEndTurn) {
      const me = view.sides[HUMAN];
      const hint = aff?.energyTargets.length ? 'Você ainda tem Energia pronta para ligar.' : 'Nenhuma ação obrigatória pendente.';
      if (!(await confirmDialog({ title: 'Finalizar turno?', body: [hint, me.active ? '' : ''].filter(Boolean), confirmLabel: 'Finalizar turno' }))) return;
    }
    await act({ type: 'END_TURN', player: HUMAN });
  };

  const showDeny = (text: string) => setDeny({ text, key: Date.now() });
  const setupEligible = new Set(setupDecision?.options ?? []);
  const setupBenchLimit = Math.max(0, (setupDecision?.max ?? 4) - 1);
  const setupPlace = (cardId: string, anchorId: string | null) => {
    const r = placeCard(staging, cardId, anchorId, setupEligible, setupBenchLimit);
    if (r.ok) setStaging(r.staging);
    else showDeny(r.reason);
  };
  const startBattle = () => {
    if (!setupDecision || !staging.active) return;
    const chosen = setupSelection(staging);
    // As cartas continuam viradas nos slots até a revelação: ela as substitui no mesmo lugar e desvira todas juntas.
    setSetupSubmitting(true);
    void act({ type: 'RESOLVE_DECISION', player: HUMAN, decisionId: setupDecision.decisionId, selection: chosen });
  };

  const resolvePromotion = (entityId: string) => {
    if (!promoteDecision) return;
    setPromotePick(null);
    void act({ type: 'RESOLVE_DECISION', player: HUMAN, decisionId: promoteDecision.decisionId, selection: [entityId] });
  };
  // Pokémon do Banco arrastado e solto sobre o Ativo vazio (mesa 3D ou 2D).
  const onEntityDrop = (entityId: string) => {
    const step = promotionDrop(promoteOptions, entityId);
    if (step.kind === 'RESOLVE') resolvePromotion(step.entityId);
  };

  // Arrastar da mão (mesa 3D ou 2D): o início realça os alvos legais; soltar num deles joga; fora deles, nega.
  const onDragStart = (cardId: string) => { setDragging(cardId); setSelection(null); setPending(null); hover.value = null; };
  const onDragEnd = () => setDragging(null);
  const onDrop = (cardId: string, target: PickTarget) => {
    if (setupDecision) {
      if (target.kind === 'SLOT') setupPlace(cardId, target.anchorId);
      else showDeny(target.kind === 'ENTITY' ? 'Esse lugar já está ocupado' : 'Solte a carta sobre um espaço realçado');
      return;
    }
    if (!aff) return;
    const r = aff.drop(cardId, target);
    if (r.ok) void act(r.action);
    else showDeny(r.reason);
  };
  const onDeny = (cardId: string, target: PickTarget | null) => {
    if (setupDecision) {
      showDeny(!setupEligible.has(cardId) ? 'Só Pokémon Básicos entram na preparação' : staging.active ? 'Solte a carta sobre um espaço realçado' : 'Coloque primeiro um Básico no Ativo');
      return;
    }
    if (!aff) return;
    const r = aff.drop(cardId, target ?? PLAY_AREA_TARGET);
    showDeny(r.ok ? 'Solte a carta sobre um alvo realçado' : r.reason);
  };

  const onPick = (t: PickTarget) => {
    if (!view || !aff) return;
    if (setupDecision) {
      if (setupSubmitting) return;
      if (t.kind === 'HAND_CARD') setupPlace(t.cardId, null);
      else if (t.kind === 'ENTITY') {
        const card = stagedCardOf(t.entityId);
        if (card) setStaging(unplaceCard(staging, card));
      }
      return;
    }
    if (promoteOptions.length) {
      const step = promotionPick(promoteOptions, promotePick, t);
      if (step.kind === 'SELECT') setPromotePick(step.entityId);
      else if (step.kind === 'RESOLVE') resolvePromotion(step.entityId);
      return;
    }
    if (pending) {
      if (t.kind === 'ENTITY') {
        if (pending.kind === 'ATTACH' && pending.targets.includes(t.entityId)) void act({ type: 'ATTACH_ENERGY', player: HUMAN, targetEntityId: t.entityId });
        else if (pending.kind === 'RETREAT') {
          const bench = view.sides[HUMAN].bench.findIndex((b) => b?.entityId === t.entityId);
          const payments = aff.retreat.options.get(bench);
          if (bench >= 0 && payments?.length) {
            if (payments.length === 1) void act({ type: 'RETREAT', player: HUMAN, benchIndex: bench, energyIds: [...payments[0]!] });
            else setRetreatPick({ benchIndex: bench, payments });
          }
        }
      }
      return;
    }
    if (t.kind === 'HAND_CARD') { setSelection(selection?.kind === 'HAND_CARD' && selection.cardId === t.cardId ? null : { kind: 'HAND_CARD', cardId: t.cardId }); return; }
    // Alternativa ao arrasto: com uma carta da mão selecionada, tocar num alvo realçado joga.
    if (selection?.kind === 'HAND_CARD' && (t.kind === 'SLOT' || t.kind === 'ENTITY')) {
      const id = t.kind === 'SLOT' ? t.anchorId : t.entityId;
      if (aff.plan(selection.cardId).targets.includes(id)) {
        const r = aff.drop(selection.cardId, t);
        if (r.ok) void act(r.action);
        else showDeny(r.reason);
        return;
      }
    }
    if (t.kind === 'ENTITY') setSelection(selection?.kind === 'ENTITY' && selection.entityId === t.entityId ? null : { kind: 'ENTITY', entityId: t.entityId });
    else if (t.kind === 'PILE' && t.anchorId === 'HUMAN_ENERGY_READY' && aff.energyTargets.length) setPending({ kind: 'ATTACH', targets: aff.energyTargets });
    else if (t.kind === 'PILE' && (t.anchorId.endsWith('_DISCARD'))) setHistoryOpen(true);
  };

  // Atalhos (interface §35.2): Esc pausa/fecha, H histórico, I inspecionar, E Energia, A ataques, R Recuo, Shift+Enter finalizar.
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
  keyRef.current = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement | null)?.tagName ?? '';
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
    if (e.key === 'Escape') {
      if (document.querySelector('.modal-scrim, .drawer-scrim')) return;
      e.preventDefault();
      if (menuOpen) { setMenuOpen(false); return; }
      if (pending) { setPending(null); return; }
      if (selection) { setSelection(null); return; }
      setPauseOpen(true);
      return;
    }
    if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); void endTurn(); return; }
    if (!settings.value.letterShortcuts || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'h') setHistoryOpen((o) => !o);
    else if (k === 'i' && view) {
      if (selection?.kind === 'HAND_CARD') setInspect(view.sides[HUMAN].hand?.find((x) => x.cardId === selection.cardId) ?? null);
      else if (selection?.kind === 'ENTITY') setInspect(findEntity(view, selection.entityId)?.top ?? null);
    } else if (k === 'e' && aff?.energyTargets.length) setPending({ kind: 'ATTACH', targets: aff.energyTargets });
    else if (k === 'a' && view?.sides[HUMAN].active) setSelection({ kind: 'ENTITY', entityId: view.sides[HUMAN].active.entityId });
    else if (k === 'r' && aff?.retreat.available) setPending({ kind: 'RETREAT', benchIndex: null });
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  if (loadError) return <div class="bare-screen"><ErrorState title="Não foi possível abrir o duelo" text={loadError} onRetry={() => go('S03')} /></div>;
  if (!ctl || !view || !c) return <div class="match-screen" ref={stageRef}><div class="bare-screen"><Skeleton lines={6} /></div></div>;

  const session = ctl.session;
  const node = session.nodeId ? c.nodes.get(session.nodeId) : null;
  // Sem encontro (Treino, duelo autoral): o adversário é Cheren, professor da Escola de Treinadores, com o deck escolhido.
  const npc = node ? c.npcs.get(node.npcId) : c.npcs.get(PRACTICE_NPC_ID) ?? null;
  const names = { human: snapshot.value?.profile.displayName ?? 'Você', npc: npc?.name ?? 'Adversário' };
  const humanDecision = view.decisions.find((d) => d.player === HUMAN && !d.answered) ?? null;
  const fixture = sessionFixture(requireCtx(), session);
  const busy = ctl.busy.value || ctl.aiThinking.value;

  // Realces: alvos da carta arrastada ou selecionada na mão > alvo pendente (Energia, Recuo) > jogáveis.
  const targets = new Set<string>();
  const planned = dragging ?? (selection?.kind === 'HAND_CARD' ? selection.cardId : null);
  if (planned && aff && !pending) aff.plan(planned).targets.forEach((t) => targets.add(t));
  if (pending?.kind === 'ATTACH') pending.targets.forEach((t) => targets.add(t));
  if (pending?.kind === 'RETREAT') view.sides[HUMAN].bench.forEach((b, i) => { if (b && aff?.retreat.options.has(i)) targets.add(b.entityId); });
  const selectable = new Set<string>();
  // Evolução jogável: contorno amarelo no lugar do ciano das outras jogáveis (gameplay-pocket §6).
  const evolvable = new Set<string>();
  if (aff && view.currentPlayer === HUMAN && !humanDecision) {
    for (const h of view.sides[HUMAN].hand ?? []) {
      const options = aff.hand(h.cardId).options;
      if (options.length) selectable.add(h.cardId);
      if (options.some((o) => o.kind === 'EVOLVE')) evolvable.add(h.cardId);
    }
    if (aff.energyTargets.length) selectable.add('HUMAN_ENERGY_READY');
    if (view.phase === 'MAIN') {
      const active = view.sides[HUMAN].active;
      if (active && (aff.attacks.some((r) => r.action) || aff.retreat.available)) selectable.add(active.entityId);
      for (const e of [active, ...view.sides[HUMAN].bench]) {
        if (e && (aff.abilities(e.entityId).some((a) => a.action) || aff.fossilDiscard(e.entityId))) selectable.add(e.entityId);
      }
    }
  }
  if (setupDecision && !setupSubmitting) {
    if (planned && setupEligible.has(planned)) setupTargets(staging, setupBenchLimit).forEach((t) => targets.add(t));
    const placed = new Set(stagedCards(staging));
    for (const id of setupEligible) if (!placed.has(id)) selectable.add(id);
  }
  const selected = new Set<string>();
  if (selection?.kind === 'HAND_CARD') selected.add(selection.cardId);
  if (selection?.kind === 'ENTITY') selected.add(selection.entityId);
  if (pending?.kind === 'ATTACH') selected.add('HUMAN_ENERGY_READY');
  const promo = promotionHighlights(promoteOptions, promotePick);
  promo.selectable.forEach((id) => selectable.add(id));
  promo.targets.forEach((id) => targets.add(id));
  promo.selected.forEach((id) => selected.add(id));
  const highlights = { selectable, selected, targets, evolvable, floating: new Set(promo.floating) };

  const labelFor = (option: string) => {
    const named = humanDecision?.labels?.[option];
    if (named) return { label: named, printingId: null };
    const card = session.state.cards[option];
    if (card) return { label: faceOf(c, card.printingId)?.name ?? 'Carta', printingId: card.printingId };
    const entity = findEntity(view, option);
    if (entity) return { label: `${faceOf(c, entity.top.printingId)?.name ?? 'Pokémon'} (${entity.remainingHp}/${entity.maxHp} PS)`, printingId: entity.top.printingId };
    for (const e of [view.sides.A.active, view.sides.B.active]) {
      const def = e ? c.catalog.definition(e.top.definitionKey) : null;
      const atk = def && 'attacks' in def ? def.attacks.find((a) => a.id === option) : null;
      if (atk) return { label: atk.name, printingId: null };
    }
    return { label: option === 'YES' ? 'Sim' : option === 'NO' ? 'Não' : option, printingId: null };
  };

  const myTurn = view.currentPlayer === HUMAN && view.phase === 'MAIN' && !view.result;
  const endTurnReason = !myTurn ? 'Não é o seu turno.' : busy ? 'Aguarde a jogada atual.' : aff?.canEndTurn ? null : 'Conclua a escolha pendente.';
  const onEnergyDrag = (e: EnergyDragEvent) => {
    if (!aff) return;
    if (e.phase === 'START') {
      setEnergyDragging(true);
      setSelection(null);
      hover.value = null;
      if (aff.energyTargets.length) setPending({ kind: 'ATTACH', targets: aff.energyTargets });
    } else {
      setEnergyDragging(false);
      if (e.phase === 'DROP') void act({ type: 'ATTACH_ENERGY', player: HUMAN, targetEntityId: e.entityId });
      else setPending((p) => (p?.kind === 'ATTACH' ? null : p));
    }
  };
  const dragProps = { onDragStart, onDrop, onDeny, onDragEnd, onEnergyDrag };
  // Fotos das placas: o retrato escolhido no perfil e o do rival (treinador da franquia); a inicial só sem retrato.
  const humanAvatar: PlateAvatar = avatarOf(playerPortraitKey(snapshot.value?.settings.avatar), names.human, 'tone-human');
  const npcAvatar: PlateAvatar = avatarOf(npc?.portraitAssetKey ?? null, names.npc, `chapter-${(npc?.chapterId ?? 'p00').toLowerCase()}`);
  const encounter = `${node?.title ?? (session.mode === 'TRAINING' ? 'Treino' : session.mode === 'ARENA' ? 'Arena' : 'Duelo')}${session.mode === 'ARENA' ? ' · revanche' : ''}`;
  const npcDetail = [session.difficulty ? DIFFICULTY_LABEL[session.difficulty as Difficulty] : null, `Turno ${view.globalTurnNumber}`].filter(Boolean).join(' · ');
  const use3d = webglAvailable.value === true && !settings.value.presentation2d && typeof matchMedia === 'function' && !matchMedia('(orientation: portrait)').matches;
  const hpOf = (ref: CardRef) => { try { const d = c.catalog.definition(ref.definitionKey); return isPokemon(d) ? d.baseHp : 0; } catch { return 0; } };
  const staged = !!setupDecision && !setupSubmitting;
  // Até a decisão ser respondida (também enquanto envia), a mesa mostra a disposição com os Básicos virados para baixo.
  const boardView = setupDecision ? stagedView(view, HUMAN, staging, hpOf) : view;
  const faceDown = setupDecision ? stagedFaceDown(staging) : NO_IDS;
  const toastMsg: BattleToast | null = flash ?? ctl.notice.value ?? (staged
    ? { text: staging.active ? 'Coloque até 3 Pokémon Básicos no Banco e toque em Iniciar duelo.' : 'Coloque um Pokémon Básico no Ativo.', pill: view.firstPlayer === HUMAN ? 'Você começa' : 'O adversário começa' }
    : ctl.aiThinking.value && !view.result ? { text: 'Aguardando o adversário…', tone: 'wait' }
      : pending?.kind === 'RETREAT' ? { text: 'Escolha um Pokémon para trocar.' }
        : pending?.kind === 'ATTACH' ? { text: 'Escolha um Pokémon para ligar a Energia.' }
          : null);
  const own = [view.sides[HUMAN].active, ...view.sides[HUMAN].bench];
  const actionEntity = selection?.kind === 'ENTITY' && !pending && !setupDecision && !humanDecision && !ctl.busy.value && !view.result
    && own.some((e) => e?.entityId === selection.entityId) ? selection.entityId : null;
  const scoring = ctl.scoring.value;
  // Moedas: quem lança usa a equipada no próprio deck (a do jogador também decide quem começa).
  const coins = sideCoins(c, session.presentation);
  const coinShown = ctl.coin.value;
  const coinMine = !coinShown || coinOwner(coinShown.player, HUMAN) === 'MINE';
  const outcome = view.result && !scoring ? (view.result.outcome === 'DRAW' ? 'DRAW' : view.result.winner === HUMAN ? 'WIN' : 'LOSS') : null;

  const saveAndExit = async () => {
    const ok = await suspendAttempt(requireCtx(), session);
    if (!ok) { toast('A gravação falhou. O duelo continua pausado; tente novamente.', 'error'); return; }
    battleSession.value = null;
    toast('Duelo salvo neste dispositivo.', 'success');
    go(session.nodeId ? 'S16' : 'S03', session.nodeId ? { nodeId: session.nodeId } : {});
  };
  const abandon = async () => {
    if (!(await confirmDialog({ title: 'Abandonar a tentativa?', body: 'A tentativa é registrada sem vitória. Sua coleção e os objetivos já conquistados não mudam.', confirmLabel: 'Abandonar', tone: 'danger' }))) return;
    setPauseOpen(false);
    const ok = await abandonAttempt(requireCtx(), session);
    if (!ok) toast('Não foi possível registrar o abandono. Tente novamente.', 'error');
  };
  const restart = async () => {
    if (!(await confirmDialog({ title: 'Reiniciar encontro?', body: 'A tentativa atual será encerrada sem recompensa. Você iniciará outra partida.', confirmLabel: 'Reiniciar', tone: 'danger' }))) return;
    setPauseOpen(false);
    const game = requireCtx();
    if (!(await abandonAttempt(game, session))) { toast('Não foi possível encerrar a tentativa atual.', 'error'); return; }
    const loan = (session.presentation as { loanDeckId?: string | null }).loanDeckId ?? undefined;
    const r = await startAttempt(game, { mode: session.mode, nodeId: session.nodeId, difficulty: (session.difficulty ?? 'STANDARD') as Difficulty, deckId: session.deckId, ...(loan ? { loanDeckId: loan } : {}) });
    if (!r.ok) { toast(r.message, 'error'); go('S03'); return; }
    battleSession.value = r.session;
    markFreshAttempt(r.session.attemptId);
    go('S21', { attemptId: r.session.attemptId }, {}, { replace: true });
  };

  return (
    <div class={`match-screen profile-${layout.profile} ${settings.value.battleLayout === 'TACTICAL_PANELS' ? 'is-tactical' : ''}`} ref={stageRef}>
      {use3d ? (
        <BattleStageHost layout={layout} names={names} controller={ctl} highlights={highlights} onPick={onPick} onInspect={setInspect} onHover={onHover} locked={staged ? false : busy}
          viewOverride={staged ? boardView : null} faceDown={faceDown} onEntityDrop={onEntityDrop} {...dragProps} />
      ) : (
        <Board2D layout={layout} names={names} view={boardView} content={c} human={HUMAN} highlights={highlights} floating={ctl.floating.value} onPick={onPick} onInspect={setInspect} onHover={onHover} locked={ctl.busy.value} onEnergyDrag={onEnergyDrag} onEntityDrop={onEntityDrop} faceDown={faceDown}
          matImage={displayedMatImage(session.presentation, settings.value.playmatDisplay, view.currentPlayer === HUMAN)} sleeves={sideSleeveUrls(c, session.presentation)} />
      )}
      {/* Em 3D a mão é desenhada pela mesa (BattleStageHost cai para Hand2D sozinho se o WebGL falhar). */}
      {!use3d ? <Hand2D layout={layout} cards={boardView.sides[HUMAN].hand ?? []} content={c} highlights={highlights} onPick={onPick} onInspect={setInspect} onHover={onHover} locked={staged ? false : ctl.busy.value} {...dragProps} /> : null}
      {/* A prévia some enquanto uma carta da mão ou o orbe da Energia é arrastado. */}
      <CardPreview layout={layout} view={boardView} content={c} target={hover} hidden={!!inspect || !!dragging || energyDragging} />
      <ToastLayer layout={layout} toast={toastMsg} />
      <EnergyGenerated layout={layout} info={ctl.energyGen.value} />
      {/* Só a apresentação 2D (sem presenter 3D) preenche a prévia HTML; a mesa 3D desenha a sua. */}
      <CardSpotlight layout={layout} info={ctl.spotlight.value} content={c} />
      {staged ? (
        <SetupControls layout={layout} canStart={!!staging.active} canReset={stagedCards(staging).length > 0} busy={ctl.busy.value}
          onReset={() => setStaging(EMPTY_STAGING)} onStart={startBattle} />
      ) : null}
      <PlayerPlate layout={layout} who="NPC" name={names.npc} view={view} avatar={npcAvatar} detail={npcDetail} hint={encounter} />
      <PlayerPlate layout={layout} who="HUMAN" name={names.human} view={view} avatar={humanAvatar} status={turnStatus(view, ctl.aiThinking.value)} />
      <TurnBanner layout={layout} info={ctl.banner.value} reduced={reducedMotion.value} mosaic={settings.value.playmatDisplay === 'TURN_OWNER'} />
      <CoinResult shown={coinShown} role={coinMine ? 'HUMAN' : 'NPC'} reduced={reducedMotion.value}
        coin={use3d && glStatus.value !== 'UNAVAILABLE' ? null : coinMine ? coins.player : coins.opponent} />
      <ScoringOverlay info={scoring} name={scoring?.role === 'NPC' ? names.npc : names.human}
        avatar={<AvatarCircle avatar={scoring?.role === 'NPC' ? npcAvatar : humanAvatar} label={scoring?.role === 'NPC' ? names.npc : names.human} />} />
      <ResultPill outcome={outcome} />
      {opening === 'INTRO' ? (
        <DuelIntro npc={{ name: names.npc, portraitUrl: portraitUrl(npc?.portraitAssetKey ?? null) }}
          human={{ name: names.human, portraitUrl: portraitUrl(playerPortraitKey(snapshot.value?.settings.avatar)) }}
          greeting={(node?.dialogue.intro ? c.dialogues.get(node.dialogue.intro)?.lines[0]?.text : null) ?? 'Prazer em conhecer você!'}
          reduced={reducedMotion.value} onDone={() => setOpening(ctl.view.value.phase === 'SETUP' ? 'TOSS' : null)} />
      ) : null}
      {opening === 'TOSS' ? (
        <CoinToss coin={coins.player} face={view.firstPlayer === HUMAN ? 'HEADS' : 'TAILS'} rival={names.npc} reduced={reducedMotion.value} onDone={() => setOpening(null)} />
      ) : null}
      {fixture ? <Region layout={layout} rect={layout.regions.guide} class="match-guide"><FixtureGuide fixture={fixture} attemptId={session.attemptId} /></Region> : null}
      <FloatingButton layout={layout} rect={layout.regions.history} icon="history" label="Histórico (H)" onClick={() => setHistoryOpen(true)} />
      <FloatingButton layout={layout} rect={layout.regions.menu} icon="menu" label="Menu" onClick={() => setMenuOpen(!menuOpen)} testId="battle-menu" />
      <BattleMenu layout={layout} open={menuOpen} onClose={() => setMenuOpen(false)} onHistory={() => setHistoryOpen(true)} onPause={() => setPauseOpen(true)}
        onSaveExit={() => void saveAndExit()} onConcede={() => void abandon()} />
      {!setupDecision && !promoteOptions.length && !ctl.busy.value && !dragging && !energyDragging ? <EndTurnButton layout={layout} view={view} disabledReason={endTurnReason} onEndTurn={() => void endTurn()} /> : null}
      {promoteOptions.length ? (
        <Region layout={layout} rect={layout.regions.attackCutin} class="promote-float">
          <PromotePrompt picked={!!promotePick} />
        </Region>
      ) : humanDecision && !setupDecision ? (
        <Region layout={layout} rect={layout.regions.attackCutin} class="decision-float">
          <DecisionPanel key={humanDecision.decisionId} decision={humanDecision} view={view} content={c} busy={ctl.busy.value} labelFor={labelFor}
            onResolve={(sel) => void act({ type: 'RESOLVE_DECISION', player: HUMAN, decisionId: humanDecision.decisionId, selection: sel })} />
        </Region>
      ) : !setupDecision && !ctl.busy.value && !energyDragging ? (
        <FloatingActions layout={layout} view={view} content={c} aff={aff} selection={selection} pending={pending} busy={busy}
          onAction={(a) => void act(a)} onCancel={() => { setPending(null); setSelection(null); setRetreatPick(null); }} />
      ) : null}
      {actionEntity ? (
        <CardActions layout={layout} view={view} content={c} aff={aff} entityId={actionEntity} busy={busy}
          onAction={(a) => void act(a)} onPending={(p) => { setSelection(null); setPending(p); }}
          onBlocked={(reason) => setFlash({ text: reason, tone: 'deny' })} onClose={() => setSelection(null)} />
      ) : null}
      {deny ? <Region layout={layout} rect={layout.regions.turnBanner} class="drop-deny-region"><div key={deny.key} class="drop-deny" role="status" data-testid="drop-deny">{deny.text}</div></Region> : null}
      {ctl.error.value ? (
        <Region layout={layout} rect={layout.regions.turnBanner} class="error-float">
          <div class="battle-error" role="alert"><Icon name="warning" /> {ctl.error.value} <Button size="sm" onClick={() => void ctl.runAi()}>Tentar de novo</Button></div>
        </Region>
      ) : null}
      <HistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} log={ctl.log.value} />
      <InspectorDrawer refCard={inspect} content={c} onClose={() => setInspect(null)} />
      <Modal open={!!retreatPick} title="Escolha as Energias para o Recuo" onClose={() => setRetreatPick(null)}>
        <div class="stack">
          {retreatPick?.payments.map((p, i) => (
            <Button key={i} onClick={() => void act({ type: 'RETREAT', player: HUMAN, benchIndex: retreatPick.benchIndex, energyIds: [...p] })}>
              Pagar com {p.map((id) => view.sides[HUMAN].active?.energies.find((e) => e.id === id)?.type ?? '?').join(', ') || 'nenhuma Energia'}
            </Button>
          ))}
        </div>
      </Modal>
      <Modal open={pauseOpen || pausedByVisibility.value} title="A partida está pausada" onClose={() => { setPauseOpen(false); resumeAfterVisibility(); }}>
        <div class="stack">
          <Button variant="primary" onClick={() => { setPauseOpen(false); resumeAfterVisibility(); }} autoFocus>Continuar</Button>
          <Button onClick={() => { setPauseOpen(false); setHistoryOpen(true); }}>Histórico</Button>
          <div class="field">Velocidade<Segmented label="Velocidade" value={settings.value.animationSpeed} onChange={(v) => saveDeviceSettings({ animationSpeed: v })} options={[{ id: 'NORMAL', label: 'Normal' }, { id: 'FAST', label: 'Rápida' }, { id: 'INSTANT', label: 'Instantânea' }]} /></div>
          <Toggle label="Movimento reduzido" checked={reducedMotion.value} onChange={(v) => saveDeviceSettings({ reducedMotion: v ? 'ON' : 'OFF' })} />
          <Toggle label="Apresentação 2D" checked={settings.value.presentation2d} onChange={(v) => saveDeviceSettings({ presentation2d: v })} />
          <Button icon="saves" onClick={() => void saveAndExit()}>Salvar e sair</Button>
          <Button variant="ghost" onClick={() => void restart()}>Reiniciar encontro</Button>
          <Button variant="danger" onClick={() => void abandon()}>Abandonar tentativa</Button>
          <a href="#/help" class="small">Regras</a>
        </div>
      </Modal>
    </div>
  );
}

const OUTCOME_TITLE: Record<BattleResultSummary['outcome'], string> = { WIN: 'Vitória', LOSS: 'Derrota', DRAW: 'Empate', ABANDONED: 'Tentativa abandonada' };
const REASON_TEXT: Record<string, string> = { POINTS: 'pontos', NO_POKEMON: 'adversário sem Pokémon em jogo', TURN_LIMIT: 'limite de turnos', CONCEDE: 'abandono', SIMULTANEOUS: 'condições simultâneas' };

/** S24 — resultado persistido (interface §28): nada aqui concede; tudo já foi gravado. */
export function ResultScreen({ params }: Params): JSX.Element {
  const c = content.value;
  const snap = snapshot.value;
  const matchId = params.matchId ?? '';
  const [data, setData] = useState<{ summary: BattleResultSummary | null; mode: string; nodeId: string | null; difficulty: string | null; deckId: string | null } | null | undefined>(undefined);
  useEffect(() => {
    const s = battleSession.value;
    if (s && s.attemptId === matchId && s.result) {
      setData({ summary: s.result, mode: s.mode, nodeId: s.nodeId, difficulty: s.difficulty, deckId: s.deckId });
      battleSession.value = null;
      return;
    }
    const game = ctx.value;
    if (!game) return;
    void game.storage.query({ kind: 'GET_ATTEMPT', attemptId: matchId }).then((row) => {
      if (!row) { setData(null); return; }
      setData({ summary: row.result as unknown as BattleResultSummary | null, mode: row.mode, nodeId: row.nodeId, difficulty: row.difficulty, deckId: row.deckId });
    }, () => setData(null));
  }, [matchId]);
  if (!c || !snap || data === undefined) return <div class="bare-screen"><Skeleton /></div>;
  if (data === null || !data.summary) return <div class="bare-screen"><ErrorState title="Resultado não encontrado" text="A tentativa não tem resultado gravado." onRetry={() => go('S03')} /></div>;
  const r = data.summary;
  const node = data.nodeId ? c.nodes.get(data.nodeId) : null;
  const nv = node ? nodeView(c, snap, node.nodeId) : null;
  const npc = node ? c.npcs.get(node.npcId) : null;
  const deck = snap.decks.find((d) => d.deckId === data.deckId);
  const grants = r.grants;
  const nextNode = r.unlockedNodeIds.map((id) => c.nodes.get(id)).find((n) => n?.essential) ?? r.unlockedNodeIds.map((id) => c.nodes.get(id))[0] ?? null;
  const newIds = new Set(r.newObjectiveIds);
  const line = r.outcome === 'WIN' ? (node ? dialogueText(node.dialogue.victory) : '') : r.outcome === 'LOSS' && node ? dialogueText(node.dialogue.defeat) : '';
  return (
    <div class="bare-screen result-screen">
      <div class="result-card">
        <header class={`result-head outcome-${r.outcome.toLowerCase()}`}>
          <h1 id="page-title" tabIndex={-1}>{OUTCOME_TITLE[r.outcome]}</h1>
          <p>{node ? `${node.title} · ${npc?.name ?? ''}` : data.mode === 'TRAINING' ? 'Treino — sem recompensas' : 'Duelo'}{data.difficulty ? ` · ${DIFFICULTY_LABEL[data.difficulty as Difficulty]}` : ''}</p>
          <p class="small">Placar {r.points.A} × {r.points.B} · {r.ownTurns} turnos seus · {r.outcome === 'DRAW' ? `Empate por ${REASON_TEXT[r.reason] ?? r.reason}` : `Por ${REASON_TEXT[r.reason] ?? r.reason}`}{deck ? ` · ${deck.name}` : ''}</p>
          {line ? <p class="result-line">“{line}”</p> : null}
        </header>
        <div class="result-grid">
          <Panel title="Objetivos">
            {nv && nv.objectives.length ? (
              <ul class="list">
                {nv.objectives.map((o) => (
                  <li key={o.objective.objectiveId} class="list-row">
                    <Icon name={o.done ? 'check' : 'star'} />
                    <span class="grow small">{o.objective.description}</span>
                    <span class={`badge ${newIds.has(o.objective.objectiveId) ? 'badge-claim' : o.done ? 'badge-done' : 'badge-locked'}`}>{newIds.has(o.objective.objectiveId) ? 'Recebido agora' : o.done ? 'Recebido anteriormente' : 'Não cumprido'}</span>
                  </li>
                ))}
              </ul>
            ) : <p class="muted small">{data.mode === 'TRAINING' ? 'Treinos não concluem objetivos.' : 'Sem objetivos neste duelo.'}</p>}
          </Panel>
          <Panel title="Recompensas">
            {grants && (grants.credits || grants.packs.length || grants.cosmetics.length || grants.keyCard || grants.medal) ? (
              <div class="stack">
                <span class="muted small">Recebido agora — já salvo neste dispositivo</span>
                <div class="row">
                  {grants.credits ? <RewardChip kind="credits" amount={grants.credits} label="Créditos" /> : null}
                  {grants.packs.map((p) => <RewardChip key={p.productId} kind="pack" amount={p.count} label={c.products.get(p.productId)?.name ?? p.productId} />)}
                  {grants.medal ? <RewardChip kind="medal" label="Medalha do capítulo" /> : null}
                  {grants.cosmetics.map((id) => <RewardChip key={id} kind="cosmetic" label={c.cosmetics.get(id)?.names['pt-BR'] ?? id} />)}
                  {grants.keyCard?.mode === 'FIXED' ? grants.keyCard.printingIds.map((id) => <RewardChip key={id} kind="card" amount={grants.keyCard!.copies} label={faceOf(c, id)?.name ?? id} />) : null}
                </div>
                {grants.keyCard?.mode === 'CHOICE' ? <p class="small"><Icon name="info" size={14} /> Carta-chave à escolha disponível em Recibos — não expira.</p> : null}
              </div>
            ) : <p class="muted small">{r.outcome === 'WIN' ? 'Nenhuma recompensa nova nesta vitória.' : 'Sem recompensas nesta tentativa.'}</p>}
            {r.unlockedNodeIds.length ? <p class="small"><Icon name="map" size={14} /> Novo caminho no mapa: {r.unlockedNodeIds.map((id) => c.nodes.get(id)?.title ?? id).join(', ')}.</p> : null}
          </Panel>
        </div>
        <div class="row result-actions">
          {r.outcome === 'WIN' && nextNode ? <Button variant="primary" onClick={() => go(nextNode.kind === 'DISCOVERY' ? 'S28' : 'S16', { nodeId: nextNode.nodeId })} autoFocus>Próximo encontro</Button> : null}
          {r.outcome !== 'WIN' && node ? <Button variant="primary" onClick={() => go('S16', { nodeId: node.nodeId })} autoFocus>Tentar novamente</Button> : null}
          {grants?.keyCard?.mode === 'CHOICE' ? <Button onClick={() => go('S35')}>Escolher carta-chave</Button> : null}
          <Button onClick={() => go(node ? 'S19' : data.mode === 'TRAINING' ? 'S17' : 'S18')}>{node ? 'Voltar ao mapa' : 'Voltar'}</Button>
          <Button variant="ghost" onClick={() => go('S39', { replayId: matchId })}>Rever partida</Button>
          {deck ? <Button variant="ghost" onClick={() => go('S12', { deckId: deck.deckId })}>Editar deck</Button> : null}
        </div>
      </div>
    </div>
  );
}

/** S39 — replay por checkpoints de turno e eventos gravados; nunca reexecuta concessões (interface §29). */
export function ReplayScreen({ params }: Params): JSX.Element {
  const c = content.value;
  const replayId = params.replayId ?? '';
  const [data, setData] = useState<{ states: MatchState[]; events: BattleEvent[]; finished: boolean } | null | undefined>(undefined);
  const [index, setIndex] = useState(0);
  const [full, setFull] = useState(false);
  const [playing, setPlaying] = useState(false);
  const { ref: stageRef, layout } = useStageLayout();
  useEffect(() => {
    const game = ctx.value;
    if (!game) return;
    void (async () => {
      const attempt = await game.storage.query({ kind: 'GET_ATTEMPT', attemptId: replayId });
      if (!attempt) { setData(null); return; }
      const checkpoints = await game.storage.query({ kind: 'GET_CHECKPOINTS', attemptId: replayId });
      const states: MatchState[] = [];
      for (const cp of checkpoints) {
        const full = await game.storage.query({ kind: 'GET_CHECKPOINT', attemptId: replayId, stateVersion: cp.stateVersion });
        if (full) states.push(full.snapshot as unknown as MatchState);
      }
      const finished = attempt.status === 'FINISHED' || attempt.status === 'ABANDONED';
      if (finished) states.push(attempt.state as unknown as MatchState);
      const raw = await game.storage.query({ kind: 'GET_EVENTS', attemptId: replayId, fromSeq: 0 });
      setData({ states, events: raw.map((r) => r.event as unknown as BattleEvent), finished });
    })().catch(() => setData(null));
  }, [replayId]);
  useEffect(() => {
    if (!playing || !data) return;
    const t = setInterval(() => setIndex((i) => { if (i + 1 >= data.states.length) { setPlaying(false); return i; } return i + 1; }), reducedMotion.value ? 2000 : 1400);
    return () => clearInterval(t);
  }, [playing, data]);
  if (!c || data === undefined) return <div class="bare-screen"><Skeleton /></div>;
  if (data === null || !data.states.length) return <div class="bare-screen"><EmptyState title="Replay indisponível" text="Esta partida não tem pontos de reprodução gravados." action={<Button onClick={() => go('S38')}>Histórico</Button>} /></div>;
  const state = data.states[Math.min(index, data.states.length - 1)]!;
  let view: BattleView;
  try { view = getPlayerView(state, c.catalog, HUMAN); } catch { return <div class="bare-screen"><ErrorState title="Reprodução visual indisponível" text="Esta partida exige uma versão compatível do conteúdo. O resumo continua no histórico." /></div>; }
  const npcHand = full && data.finished ? state.players.B.hand.map((id) => ({ cardId: id, printingId: state.cards[id]!.printingId, definitionKey: state.cards[id]!.definitionKey })) : null;
  const upTo = state.eventSeq;
  const prevSeq = index > 0 ? data.states[index - 1]!.eventSeq : 0;
  const visibleEvents = full && data.finished ? data.events : redactEvents(data.events, HUMAN);
  const segment = describeEvents(visibleEvents.filter((e) => e.seq > prevSeq && e.seq <= upTo), { card: (id) => (id && state.cards[id] ? faceOf(c, state.cards[id]!.printingId)?.name ?? 'carta' : 'uma carta'), entity: () => 'Pokémon', player: (p) => (p === HUMAN ? 'Você' : 'Adversário') });
  const empty = { selectable: new Set<string>(), selected: new Set<string>(), targets: new Set<string>() };
  return (
    <div class={`match-screen replay profile-${layout.profile}`} ref={stageRef}>
      <Region layout={layout} rect={layout.regions.hud} class="match-hud">
      <header class="battle-hud">
        <Button variant="ghost" icon="back" onClick={() => go('S38')}>Histórico</Button>
        <div class="battle-hud-title"><strong>Reprodução</strong><small class="muted">Turno {view.globalTurnNumber} · ponto {index + 1} de {data.states.length}</small></div>
        <div class="row">
          <Button size="sm" onClick={() => setIndex(Math.max(0, index - 1))} disabledReason={index > 0 ? null : 'Início.'}>Turno anterior</Button>
          <Button size="sm" variant="primary" icon={playing ? 'pause' : 'play'} onClick={() => setPlaying(!playing)}>{playing ? 'Pausar' : 'Reproduzir'}</Button>
          <Button size="sm" onClick={() => setIndex(Math.min(data.states.length - 1, index + 1))} disabledReason={index + 1 < data.states.length ? null : 'Fim.'}>Próximo turno</Button>
          {data.finished ? <Toggle label="Visão completa" checked={full} onChange={setFull} /> : null}
        </div>
      </header>
      </Region>
      <Board2D layout={layout} names={{ human: snapshot.value?.profile.displayName ?? 'Você', npc: 'Adversário' }} view={view} content={c} human={HUMAN} highlights={empty} floating={[]} onPick={() => undefined} onInspect={() => undefined} locked />
      <Hand2D layout={layout} cards={view.sides[HUMAN].hand ?? []} content={c} highlights={empty} onPick={() => undefined} onInspect={() => undefined} locked />
      <Region layout={layout} rect={layout.profile === 'desktop1080' ? [1584, 112, 312, 936] : [1008, 60, 256, 644]} class="match-side" label="Eventos">
        <Panel title="Eventos deste trecho">
          {npcHand ? <p class="small muted">Visão completa: mão do adversário com {npcHand.length} carta(s).</p> : null}
          <ol class="battle-log">{segment.map((l) => <li key={l.seq} class={`log-${l.tone}`}>{l.text}</li>)}</ol>
        </Panel>
      </Region>
    </div>
  );
}

const NO_IDS: ReadonlySet<string> = new Set();

/** Rival dos duelos sem nó de campanha (Treino, duelo autoral): só nome e retrato; o deck e a IA são os escolhidos. */
const PRACTICE_NPC_ID = 'lia';

/** Mensagem da promoção: simples e no centro, entre os Ativos, sem cobrir o espaço que recebe o Pokémon. */
function PromotePrompt({ picked }: { readonly picked: boolean }): JSX.Element {
  return (
    <div class="promote-prompt" role="status" aria-live="polite" data-testid="promote-prompt">
      <strong>Escolha o próximo Pokémon Ativo</strong>
      <span>{picked ? 'Toque no espaço do Ativo para confirmar' : 'Arraste um Pokémon do Banco até o Ativo'}</span>
    </div>
  );
}

/** Avatar da placa: o retrato pela chave; sem arquivo no pacote, a inicial no tom indicado. */
function avatarOf(portraitKey: string | null, name: string, tone: string): PlateAvatar {
  const url = portraitUrl(portraitKey);
  return url ? { kind: 'IMAGE', url } : { kind: 'INITIAL', letter: name.slice(0, 1).toUpperCase(), tone };
}
