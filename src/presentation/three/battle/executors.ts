// Execução visual dos passos do plano. Cada passo: pose inicial capturada da cena, destino oculto
// enquanto um proxy viaja, finish() idempotente que libera proxies e reconcilia com a projeção
// confirmada do passo. Nenhuma função aqui chama regras, sorteia ou concede algo (runtime §19.4).
import { CircleGeometry, Mesh, MeshBasicMaterial, Vector3, type Group } from 'three';
import type { PlayerId } from '../../../domain/battle/types.ts';
import type { PresentedBoard, PresentedCard, SideRole } from '../../animation/board-model.ts';
import { findEntity } from '../../animation/board-model.ts';
import { phaseProgress, phasesOf, presetDurationMs, samplePhase, type PresetId } from '../../animation/catalog.ts';
import type { StepProgress } from '../../animation/director.ts';
import { EASINGS, clamp, lerp } from '../../animation/easing.ts';
import type { PresentationStep } from '../../animation/plan.ts';
import type { MotionMode } from '../../animation/timing.ts';
import type { RenderSystem } from '../core/render-system.ts';
import { COLORS, CONDITION_COLORS } from '../core/tokens.ts';
import type { CardDescriptor, CardVisual } from '../card/card-visual.ts';
import { coinPoseAt, type CoinFace } from './coin-math.ts';
import {
  TRAINER_DISSOLVE_COLORS, createAttackBand, createBeamEffect, createBurstEffect, createDissolveFx, createRingEffect, createSpeedLines, vfxFor,
  type CoinVisual, type EffectHandle,
} from './effects.ts';
import type { EntityVisual } from './entity-visual.ts';
import { createEnergyOrbSprite } from './energy-plate.ts';
import type { BoardRoot } from './board-root.ts';
import { acquireEnergyTexture, releaseTexture } from '../card/textures.ts';
import type { MatchResult } from '../../../domain/battle/types.ts';

export type CssPose = { x: number; y: number; width: number; rotation: number; flip: number; tilt?: number };
export type WorldPose = { x: number; y: number; z: number; scale: number; rotZ?: number; flip?: number };

export type BattleCue =
  | { readonly kind: 'TURN_BANNER'; readonly player: PlayerId; readonly role: SideRole; readonly turnNumber: number; readonly skipped: boolean }
  | { readonly kind: 'ATTACK_NAME'; readonly attackName: string; readonly attackerName: string; readonly role: SideRole; readonly attackType: string; readonly skipped: boolean }
  | { readonly kind: 'DAMAGE'; readonly entityId: string; readonly amount: number; readonly prevented: boolean; readonly skipped: boolean }
  | { readonly kind: 'HEAL'; readonly entityId: string; readonly amount: number; readonly skipped: boolean }
  | { readonly kind: 'STATUS'; readonly entityId: string; readonly condition: string; readonly applied: boolean; readonly skipped: boolean }
  | { readonly kind: 'COIN_RESULT'; readonly face: CoinFace; readonly index: number; readonly count: number; readonly reason: string; readonly player: PlayerId | null; readonly skipped: boolean }
  | { readonly kind: 'KNOCKOUT'; readonly entityId: string; readonly role: SideRole; readonly skipped: boolean }
  | { readonly kind: 'POINTS'; readonly role: SideRole; readonly points: number; readonly total: number; readonly skipped: boolean }
  | { readonly kind: 'TRAINER'; readonly name: string; readonly subtype: string; readonly role: SideRole; readonly skipped: boolean }
  | { readonly kind: 'ABILITY'; readonly entityId: string; readonly skipped: boolean }
  | { readonly kind: 'DRAW'; readonly role: SideRole; readonly count: number; readonly skipped: boolean }
  | { readonly kind: 'SHUFFLE'; readonly role: SideRole; readonly skipped: boolean }
  /** Zona de Energia gerou (gameplay-pocket §5.2): flash no prato e rótulo “Próxima Energia gerada”, no fim do passo. */
  | { readonly kind: 'ENERGY_GENERATED'; readonly role: SideRole; readonly energyType: string; readonly skipped: boolean }
  | { readonly kind: 'RESULT'; readonly result: MatchResult | null; readonly skipped: boolean };

/** Interface interna que o palco de batalha oferece aos executores. */
export type StageApi = {
  readonly rs: RenderSystem;
  readonly board: BoardRoot;
  readonly sync: (board: PresentedBoard) => void;
  readonly hide: (key: string, count?: number) => void;
  readonly unhide: (key: string, count?: number) => void;
  readonly entity: (entityId: string) => EntityVisual | null;
  readonly entityPose: (entityId: string) => WorldPose | null;
  readonly anchorPose: (anchorId: string) => WorldPose | null;
  readonly handPoseCss: (key: string) => CssPose | null;
  readonly handTargetCss: (key: string, board: PresentedBoard) => CssPose | null;
  readonly npcFanWorld: (index: number, count: number) => WorldPose;
  readonly resolutionWorld: (role: SideRole, index: number) => WorldPose;
  readonly toolWorld: (entityId: string) => WorldPose | null;
  readonly worldToCss: (pose: WorldPose) => CssPose;
  readonly cutinCss: () => { x: number; y: number; width: number; compact: boolean; stageX: number; stageWidth: number };
  /** Pose da prévia grande no centro da mesa (px CSS). */
  readonly previewCss: () => CssPose;
  /** Carta da mão solta pelo jogador sobre o alvo (px CSS): a jogada parte dali; consome e esconde a carta do arrasto. */
  readonly takeHandDrop: (cardId: string) => CssPose | null;
  readonly isHidden: (key: string) => boolean;
  readonly transitProxy: (descriptor: CardDescriptor) => CardVisual;
  readonly boardProxy: (descriptor: CardDescriptor) => CardVisual;
  readonly releaseProxy: (proxy: CardVisual) => void;
  readonly setTransitPose: (proxy: CardVisual, pose: CssPose, z?: number) => void;
  readonly setBoardPose: (proxy: CardVisual, pose: WorldPose) => void;
  readonly transitRoot: Group;
  readonly effectsRoot: Group;
  readonly descriptorFor: (card: PresentedCard | null, owner: PlayerId, opaqueId: string) => CardDescriptor;
  readonly cardName: (card: PresentedCard | null) => string;
  readonly cardType: (card: PresentedCard | null) => string;
  /** Moeda de quem lança (a equipada no deck dele); null = a do jogador (quem começa). */
  readonly coin: (player: PlayerId | null) => CoinVisual;
  readonly setVeil: (amount: number) => void;
  readonly cue: (cue: BattleCue) => void;
  readonly flairTry: (key: string | null) => boolean;
  readonly particleBudget: () => number;
  readonly playmatFor: (board: PresentedBoard) => import('./playmat.ts').DisplayedPlaymat;
  readonly pxPerUnit: (pose: WorldPose) => number;
  /** Orbe solto pelo jogador sobre o alvo (px CSS): o voo da ligação parte dele; consome e esconde o orbe do arrasto. */
  readonly takeEnergyDrop: () => { readonly x: number; readonly y: number; readonly size: number } | null;
};

export type StepRuntime = { readonly update: (p: StepProgress) => void; readonly finish: () => void };

const lerpPose = (a: CssPose, b: CssPose, t: number, lift = 0): CssPose => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t) - lift * Math.sin(Math.PI * t),
  width: lerp(a.width, b.width, t),
  rotation: lerp(a.rotation, b.rotation, t),
  flip: lerp(a.flip, b.flip, t),
  tilt: lerp(a.tilt ?? 0, b.tilt ?? 0, t),
});

const lerpWorld = (a: WorldPose, b: WorldPose, t: number, lift = 0): WorldPose => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t) + lift * Math.sin(Math.PI * t),
  z: lerp(a.z, b.z, t),
  scale: lerp(a.scale, b.scale, t),
  rotZ: lerp(a.rotZ ?? 0, b.rotZ ?? 0, t),
  flip: lerp(a.flip ?? 0, b.flip ?? 0, t),
});

/** Coleção de recursos transitórios de um passo; dispose idempotente. */
function scope(api: StageApi) {
  const proxies: CardVisual[] = [];
  const effects: EffectHandle[] = [];
  const hidden: [string, number][] = [];
  const cleanups: (() => void)[] = [];
  let done = false;
  return {
    transit: (d: CardDescriptor) => {
      const p = api.transitProxy(d);
      proxies.push(p);
      return p;
    },
    boardProxy: (d: CardDescriptor) => {
      const p = api.boardProxy(d);
      proxies.push(p);
      return p;
    },
    effect: (e: EffectHandle) => {
      effects.push(e);
      return e;
    },
    hide: (key: string, count = 1) => {
      api.hide(key, count);
      hidden.push([key, count]);
    },
    unhideAll: () => {
      for (const [k, c] of hidden.splice(0)) api.unhide(k, c);
    },
    onDispose: (fn: () => void) => cleanups.push(fn),
    dispose: () => {
      if (done) return;
      done = true;
      for (const p of proxies.splice(0)) api.releaseProxy(p);
      for (const e of effects.splice(0)) e.dispose();
      for (const fn of cleanups.splice(0)) fn();
      for (const [k, c] of hidden.splice(0)) api.unhide(k, c);
    },
  };
}

const noop: StepRuntime = { update: () => undefined, finish: () => undefined };

function finisher(api: StageApi, step: PresentationStep, s: ReturnType<typeof scope>, extra?: () => void): () => void {
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    extra?.();
    s.dispose();
    api.sync(step.boardAfter);
  };
}

/** Progresso linear (0–1) de uma fase da coreografia no instante `baseMs`; fase ausente → 0. */
function rawPhase(id: PresetId, phaseId: string, baseMs: number): number {
  const ph = phasesOf(id).find((x) => x.phaseId === phaseId);
  if (!ph) return 0;
  return ph.durationMs <= 0 ? (baseMs >= ph.startMs ? 1 : 0) : clamp((baseMs - ph.startMs) / ph.durationMs, 0, 1);
}

/** Lados cuja Zona de Energia gerou neste passo: pronta vazia antes, cheia depois (o ENERGY_ZONE_UPDATED é absorvido). */
function zoneGenerations(step: PresentationStep): { readonly role: SideRole; readonly type: string }[] {
  const out: { role: SideRole; type: string }[] = [];
  for (const p of ['A', 'B'] as const) {
    const after = step.boardAfter.sides[p];
    if (!step.boardBefore.sides[p].energyReady && after.energyReady) out.push({ role: after.role, type: after.energyReady });
  }
  return out;
}

/**
 * Cria o runtime visual do passo. `skipped`: só cues e reconciliação (pular / Instantânea).
 * Energia gerada (gameplay-pocket §5.2): o orbe só aparece no fim do passo que a gerou (depois da compra), junto com o
 * cue que acende o prato e o rótulo “Próxima Energia gerada” na camada HTML.
 */
export function createStepRuntime(api: StageApi, step: PresentationStep, skipped: boolean): StepRuntime {
  const generated = zoneGenerations(step);
  const full = !skipped && step.motion === 'FULL' && step.durationMs > 0;
  if (full) for (const g of generated) api.hide(`zone:${g.role}_READY`);
  const inner = stepRuntime(api, step, skipped);
  const cue = (quiet: boolean) => {
    for (const g of generated) api.cue({ kind: 'ENERGY_GENERATED', role: g.role, energyType: g.type, skipped: quiet });
  };
  if (!generated.length) return inner;
  if (!full) {
    cue(skipped || step.motion === 'NONE');
    return inner;
  }
  let done = false;
  return {
    update: inner.update,
    finish: () => {
      if (done) return;
      done = true;
      for (const g of generated) api.unhide(`zone:${g.role}_READY`);
      inner.finish();
      cue(false);
    },
  };
}

function stepRuntime(api: StageApi, step: PresentationStep, skipped: boolean): StepRuntime {
  const d = step.data;
  const motion: MotionMode = skipped ? 'NONE' : step.motion;
  emitCues(api, step, skipped);
  if (motion === 'NONE' || step.durationMs <= 0) {
    return { update: () => undefined, finish: () => api.sync(step.boardAfter) };
  }
  if (motion === 'REDUCED') return reducedRuntime(api, step);
  switch (d.kind) {
    case 'BOARD_INTRO': return introRuntime(api, step);
    case 'DEAL': return dealRuntime(api, step);
    case 'SETUP_REVEAL': return revealRuntime(api, step);
    case 'TURN': return turnRuntime(api, step);
    case 'PLAYMAT': return playmatRuntime(api, step);
    case 'DRAW': return drawRuntime(api, step);
    case 'PLAY_POKEMON': return playRuntime(api, step);
    case 'EVOLVE': return evolveRuntime(api, step);
    case 'TRAINER': return trainerRuntime(api, step);
    case 'ENERGY': return energyRuntime(api, step);
    case 'ATTACK': return attackRuntime(api, step);
    case 'COIN': return coinRuntime(api, step);
    case 'DAMAGE':
    case 'HEAL':
    case 'STATUS':
    case 'ABILITY':
      return feedbackRuntime(api, step);
    case 'MOVE_POKEMON': return moveRuntime(api, step);
    case 'KNOCKOUT': return knockoutRuntime(api, step);
    case 'POINTS': return pointsRuntime(api, step);
    case 'DISCARD':
    case 'RETURN':
      return discardRuntime(api, step);
    case 'SHUFFLE': return shuffleRuntime(api, step);
    case 'RESULT': return resultRuntime(api, step);
    default: return { ...noop, finish: () => api.sync(step.boardAfter) };
  }
}

function emitCues(api: StageApi, step: PresentationStep, skipped: boolean): void {
  const d = step.data;
  switch (d.kind) {
    case 'TURN': api.cue({ kind: 'TURN_BANNER', player: d.player, role: d.role, turnNumber: d.turnNumber, skipped }); break;
    case 'ATTACK': api.cue({ kind: 'ATTACK_NAME', attackName: d.attackName, attackerName: api.cardName(d.attackerCard), role: d.role, attackType: d.attackType, skipped }); break;
    case 'TRAINER': if (d.card) api.cue({ kind: 'TRAINER', name: api.cardName(d.card), subtype: d.subtype, role: d.role, skipped }); break;
    case 'ABILITY': api.cue({ kind: 'ABILITY', entityId: d.entityId, skipped }); break;
    case 'DRAW': api.cue({ kind: 'DRAW', role: d.role, count: d.handKeys.length, skipped }); break;
    case 'SHUFFLE': api.cue({ kind: 'SHUFFLE', role: d.role, skipped }); break;
    case 'KNOCKOUT': api.cue({ kind: 'KNOCKOUT', entityId: d.entityId, role: d.role, skipped }); break;
    case 'RESULT': api.cue({ kind: 'RESULT', result: d.result, skipped }); break;
    default: break;
  }
  // Cues de resultado com tempo próprio são emitidos no marco visual; ao pular, imediatamente.
  if (skipped || step.motion !== 'FULL') impactCues(api, step, skipped);
}

function impactCues(api: StageApi, step: PresentationStep, skipped: boolean): void {
  const d = step.data;
  if (d.kind === 'ATTACK' && !d.failed && d.targetEntityId) api.cue({ kind: 'DAMAGE', entityId: d.targetEntityId, amount: d.damage, prevented: d.prevented, skipped });
  if (d.kind === 'DAMAGE') api.cue({ kind: 'DAMAGE', entityId: d.targetEntityId, amount: d.amount, prevented: d.prevented, skipped });
  if (d.kind === 'HEAL') api.cue({ kind: 'HEAL', entityId: d.entityId, amount: d.amount, skipped });
  if (d.kind === 'STATUS') api.cue({ kind: 'STATUS', entityId: d.entityId, condition: d.condition, applied: d.applied, skipped });
  if (d.kind === 'COIN') api.cue({ kind: 'COIN_RESULT', face: d.face, index: d.index, count: d.count, reason: d.reason, player: d.player, skipped });
  if (d.kind === 'POINTS') api.cue({ kind: 'POINTS', role: d.role, points: d.points, total: d.total, skipped });
}

// ------------------------------------------------------------------------------- movimento reduzido

/** Movimento reduzido: sem trajetórias/giros/tremor — assenta no estado e faz fade curto (≤ 150 ms). */
function reducedRuntime(api: StageApi, step: PresentationStep): StepRuntime {
  const s = scope(api);
  const d = step.data;
  const fading: CardVisual[] = [];
  if (d.kind === 'KNOCKOUT') {
    const pose = api.entityPose(d.entityId);
    const visual = api.entity(d.entityId);
    if (pose && visual) {
      const p = s.boardProxy(visual.card.descriptor());
      p.setFaceVisibility('FRONT');
      api.setBoardPose(p, pose);
      fading.push(p);
    }
  }
  api.sync(step.boardAfter);
  const fadeIn: string[] = [];
  if (d.kind === 'PLAY_POKEMON' || d.kind === 'EVOLVE') fadeIn.push(d.entityId);
  if (d.kind === 'MOVE_POKEMON') fadeIn.push(d.incomingId, ...(d.outgoingId ? [d.outgoingId] : []));
  const target = d.kind === 'DAMAGE' ? d.targetEntityId : d.kind === 'ATTACK' ? d.targetEntityId : d.kind === 'HEAL' || d.kind === 'STATUS' ? d.entityId : null;
  if (target) {
    const pose = api.entityPose(target);
    if (pose) s.effect(createRingEffect(api.rs, api.effectsRoot, { position: new Vector3(pose.x, pose.y + 0.05, pose.z), color: d.kind === 'HEAL' ? COLORS.hpFill : COLORS.primary, radius: pose.scale * 0.55, maxScale: 1.3, opacity: 0.6 }));
  }
  const finish = finisher(api, step, s, () => {
    for (const id of fadeIn) api.entity(id)?.card.setOpacity(1);
  });
  return {
    update: (p) => {
      for (const id of fadeIn) api.entity(id)?.card.setOpacity(0.25 + 0.75 * p.u);
      for (const f of fading) f.setOpacity(1 - p.u);
    },
    finish,
  };
}

// ------------------------------------------------------------------------------------- abertura

function introRuntime(api: StageApi, step: PresentationStep): StepRuntime {
  api.board.setIntro(0);
  return {
    update: (p) => api.board.setIntro(EASINGS.easeOutCubic(p.u)),
    finish: () => {
      api.board.setIntro(1);
      api.sync(step.boardAfter);
    },
  };
}

function dealRuntime(api: StageApi, step: PresentationStep): StepRuntime {
  const s = scope(api);
  const board = step.boardAfter;
  type Flight = { proxy: CardVisual; from: CssPose | WorldPose; to: CssPose | WorldPose; delay: number; transit: boolean; key: string };
  const flights: Flight[] = [];
  for (const player of ['A', 'B'] as const) {
    const side = board.sides[player];
    const role = side.role;
    const deck = api.anchorPose(`${role}_DECK_TOP`);
    if (!deck) continue;
    side.hand.forEach((h, i) => {
      const delay = (i / Math.max(1, side.hand.length)) * 0.45;
      if (role === 'HUMAN') {
        const to = api.handTargetCss(h.key, board);
        if (!to) return;
        s.hide(`hand:${h.key}`);
        const proxy = s.transit(api.descriptorFor(h.card, player, h.key));
        flights.push({ proxy, from: { ...api.worldToCss({ ...deck, flip: 1 }), flip: 1 }, to, delay, transit: true, key: h.key });
      } else {
        const to = api.npcFanWorld(i, side.hand.length);
        const proxy = s.boardProxy(api.descriptorFor(null, player, h.key));
        flights.push({ proxy, from: { ...deck, flip: 1, y: deck.y + 0.1 }, to: { ...to, flip: 1 }, delay, transit: false, key: h.key });
      }
    });
    if (role === 'NPC') s.hide(`npcfan:${role}`, side.hand.length);
  }
  api.sync(board);
  return {
    update: (p) => {
      for (const f of flights) {
        const t = clamp((p.u - f.delay) / 0.55, 0, 1);
        const e = EASINGS.easeInOutCubic(t);
        if (f.transit) api.setTransitPose(f.proxy, lerpPose(f.from as CssPose, f.to as CssPose, e, 40), 10);
        else api.setBoardPose(f.proxy, lerpWorld(f.from as WorldPose, f.to as WorldPose, e, 0.6));
      }
    },
    finish: finisher(api, step, s),
  };
}

function revealRuntime(api: StageApi, step: PresentationStep): StepRuntime {
  const d = step.data;
  const ids = d.kind === 'SETUP_REVEAL' ? d.entityIds : [];
  api.sync(step.boardAfter);
  const set = (flip: number) => {
    for (const id of ids) {
      const v = api.entity(id);
      if (!v) continue;
      v.offset.flip = flip;
      v.offset.y = Math.sin(Math.PI * (1 - flip)) * 0.25 * (flip > 0 ? 1 : 0);
      v.updateTransform();
    }
  };
  set(1);
  let finished = false;
  return {
    update: (p) => set(1 - EASINGS.easeInOutCubic(p.u)),
    finish: () => {
      if (finished) return;
      finished = true;
      for (const id of ids) {
        const v = api.entity(id);
        if (!v) continue;
        v.offset.flip = 0;
        v.offset.y = 0;
        v.updateTransform();
      }
      api.sync(step.boardAfter);
    },
  };
}

function turnRuntime(api: StageApi, step: PresentationStep): StepRuntime {
  const d = step.data;
  if (d.kind === 'TURN') api.board.setTurnOwner(d.role, false);
  api.sync(step.boardAfter);
  return { update: () => undefined, finish: () => api.sync(step.boardAfter) };
}

function playmatRuntime(api: StageApi, step: PresentationStep): StepRuntime {
  api.board.setPlaymat(api.playmatFor(step.boardAfter), step.durationMs);
  return { update: () => undefined, finish: () => undefined };
}

// ------------------------------------------------------------------------------------------ compra

function drawRuntime(api: StageApi, step: PresentationStep): StepRuntime {
  const d = step.data;
  if (d.kind !== 'DRAW') return noop;
  const s = scope(api);
  const board = step.boardAfter;
  const deck = api.anchorPose(`${d.role}_DECK_TOP`);
  type Flight = { proxy: CardVisual; from: CssPose | WorldPose; to: CssPose | WorldPose; delay: number };
  const flights: Flight[] = [];
  const n = d.handKeys.length;
  if (deck) {
    d.handKeys.forEach((key, i) => {
      const delay = n > 1 ? (i / n) * 0.4 : 0;
      if (d.role === 'HUMAN') {
        const to = api.handTargetCss(key, board);
        const card = board.sides[d.player].hand.find((h) => h.key === key)?.card ?? null;
        if (!to) return;
        s.hide(`hand:${key}`);
        const proxy = s.transit(api.descriptorFor(card, d.player, key));
        proxy.setFaceVisibility('BOTH');
        flights.push({ proxy, from: { ...api.worldToCss({ ...deck, flip: 1 }), flip: 1 }, to, delay });
      } else {
        const count = board.sides[d.player].hand.length;
        const index = Math.max(0, count - n + i);
        const proxy = s.boardProxy(api.descriptorFor(null, d.player, key));
        flights.push({ proxy, from: { ...deck, flip: 1, y: deck.y + 0.12 }, to: { ...api.npcFanWorld(index, count), flip: 1 }, delay });
      }
    });
    if (d.role === 'NPC') s.hide(`npcfan:${d.role}`, flights.length);
  }
  api.sync(board);
  const human = d.role === 'HUMAN';
  const span = n > 1 ? 0.6 : 1;
  // Compra única própria (gameplay-pocket §5.2): a carta vai ao centro, vira grande para o dono, segura e só então
  // desce para a ponta direita da mão. Lotes (2+) vão direto à mão, um depois do outro.
  const preview = human && n === 1 && step.presetId === 'DRAW_SELF';
  const center = api.previewCss();
  return {
    update: (p) => {
      for (const f of flights) {
        const local = clamp((p.u - f.delay) / span, 0, 1);
        if (human && preview) {
          const base = local * presetDurationMs('DRAW_SELF');
          const from = f.from as CssPose;
          const to = f.to as CssPose;
          const lift = phaseProgress('DRAW_SELF', 'LIFT', base);
          const travel = phaseProgress('DRAW_SELF', 'TRAVEL', base);
          const reveal = phaseProgress('DRAW_SELF', 'REVEAL_TO_OWNER', base);
          const hold = rawPhase('DRAW_SELF', 'PREVIEW_CENTER', base);
          const settle = phaseProgress('DRAW_SELF', 'SETTLE', base);
          const lifted = { ...from, y: from.y - 14 * lift, width: from.width * (1 + 0.08 * lift) };
          const big: CssPose = { ...center, rotation: -0.035, flip: 1 };
          let pose = lerpPose(lifted, big, travel, 30);
          pose = { ...pose, flip: 1 - reveal, width: pose.width * (1 + 0.05 * Math.sin(Math.PI * reveal)) };
          const held: CssPose = { ...big, y: big.y - 6 * hold, width: big.width * (1 + 0.015 * hold), flip: 0 };
          if (reveal >= 1) pose = held;
          if (settle > 0) pose = lerpPose(held, { ...to, flip: 0 }, settle);
          api.setTransitPose(f.proxy, pose, 20);
        } else if (human) {
          const from = f.from as CssPose;
          const to = f.to as CssPose;
          const lift = EASINGS.easeOutCubic(clamp(local / 0.18, 0, 1));
          const travel = EASINGS.easeInOutCubic(clamp((local - 0.18) / 0.3, 0, 1));
          const reveal = EASINGS.easeInOutCubic(clamp((local - 0.48) / 0.19, 0, 1));
          const settle = EASINGS.easeOutBack(clamp((local - 0.67) / 0.33, 0, 1));
          const lifted = { ...from, y: from.y - 14 * lift, width: from.width * (1 + 0.08 * lift) };
          const above = { ...to, y: to.y - 30, width: to.width * 1.12, rotation: 0, flip: 1 };
          let pose = lerpPose(lifted, above, travel, 24);
          pose = { ...pose, flip: 1 - reveal };
          if (settle > 0) pose = lerpPose({ ...above, flip: 0 }, { ...to, flip: 0 }, settle);
          api.setTransitPose(f.proxy, pose, 20);
        } else {
          const base = local * presetDurationMs('DRAW_OPPONENT');
          const from = f.from as WorldPose;
          const to = f.to as WorldPose;
          const lift = phaseProgress('DRAW_OPPONENT', 'LIFT_BACK', base);
          const travel = phaseProgress('DRAW_OPPONENT', 'TRAVEL_BACK', base);
          const settle = phaseProgress('DRAW_OPPONENT', 'SETTLE_BACK', base);
          const lifted = { ...from, y: from.y + 0.25 * lift };
          const pose = lerpWorld(lifted, { ...to, y: to.y + 0.25 * (1 - settle) }, travel, 0.4);
          api.setBoardPose(f.proxy, pose);
        }
      }
    },
    finish: finisher(api, step, s),
  };
}

// ----------------------------------------------------------------------------------- jogar Pokémon

function sourcePoseFromHand(api: StageApi, step: PresentationStep, handKey: string | null, player: PlayerId, role: SideRole): { css: CssPose | null; world: WorldPose | null } {
  if (!handKey) return { css: null, world: null };
  if (role === 'HUMAN') return { css: api.handPoseCss(handKey), world: null };
  const count = step.boardBefore.sides[player].hand.length;
  return { css: null, world: { ...api.npcFanWorld(Math.max(0, count - 1), count), flip: 1 } };
}

function flairBurst(api: StageApi, s: ReturnType<typeof scope>, key: string | null, pose: WorldPose, type: string): EffectHandle | null {
  if (!api.flairTry(key)) return null;
  const profile = vfxFor(type);
  return s.effect(createBurstEffect(api.rs, api.effectsRoot, {
    origin: new Vector3(pose.x, pose.y + 0.1, pose.z), profile: { ...profile, color: COLORS.cyanSoft, shape: 'star' },
    count: Math.min(12, api.particleBudget()), spread: pose.scale * 0.9, seed: key ?? 'flair', size: pose.scale * 0.18,
  }));
}

function playRuntime(api: StageApi, step: PresentationStep): StepRuntime {
  const d = step.data;
  if (d.kind !== 'PLAY_POKEMON') return noop;
  const s = scope(api);
  // Revelação (gameplay-pocket §9; observações §6.5): a carta sai da soltura (ou da mão / do leque do adversário), vai
  // ao centro girando em Y — o verso aparece no meio do giro —, fica grande por um instante e encolhe até o slot.
  const dropped = d.role === 'HUMAN' && d.handKey ? api.takeHandDrop(d.handKey) : null;
  const src = dropped ? { css: dropped, world: null } : sourcePoseFromHand(api, step, d.handKey, d.player, d.role);
  s.hide(`entity:${d.entityId}`);
  if (d.role === 'NPC' && d.handKey) s.hide(`npcfan:${d.role}`, 0);
  api.sync(step.boardAfter);
  const target = api.entityPose(d.entityId);
  const descriptor = api.descriptorFor(d.card, d.player, d.entityId);
  const proxy = s.transit(descriptor);
  proxy.setFaceVisibility('BOTH');
  const deckPose = api.anchorPose(`${d.role}_DECK_TOP`);
  const fromWorld: WorldPose | null = src.world ?? (d.from === 'DECK' && deckPose ? { ...deckPose, flip: 1 } : null);
  const toCss = target ? api.worldToCss(target) : null;
  // Sem origem conhecida (efeito), a carta surge pequena no centro.
  const center = api.previewCss();
  const fromCss: CssPose = src.css ?? (fromWorld ? api.worldToCss(fromWorld) : { ...center, width: center.width * 0.3, flip: 0 });
  const faceDown = fromCss.flip > 0.5;
  const big: CssPose = { ...center, rotation: -0.035, flip: 0 };
  const ring = target ? s.effect(createRingEffect(api.rs, api.effectsRoot, { position: new Vector3(target.x, target.y + 0.01, target.z), color: COLORS.boardLine, radius: target.scale * 0.75, maxScale: 1.25, opacity: 0.85 })) : null;
  let flair: EffectHandle | null = null;
  let landed = false;
  const special = step.presetId === 'PLAY_SPECIAL';
  const total = step.baseDurationMs;
  const ratio = total / presetDurationMs('PLAY_BASIC');
  return {
    update: (p) => {
      const base = p.baseMs / ratio;
      const leave = phaseProgress('PLAY_BASIC', 'LEAVE_HAND', base);
      const show = rawPhase('PLAY_BASIC', 'PREVIEW_CENTER', base);
      const place = phaseProgress('PLAY_BASIC', 'PLACE', base);
      const settleRaw = samplePhase('PLAY_BASIC', base);
      if (!target || !toCss) return;
      if (place < 1 || !landed) {
        const lifted: CssPose = { ...fromCss, y: fromCss.y - 24 * leave, width: fromCss.width * (1 + 0.08 * leave), rotation: fromCss.rotation * (1 - leave) };
        const move = EASINGS.easeInOutCubic(clamp(show / 0.6, 0, 1));
        const spin = EASINGS.easeInOutCubic(clamp(show / 0.7, 0, 1));
        // Giro completo para a carta que já estava de frente (0 → 2); a do adversário só vira (1 → 2).
        const flip = faceDown ? 1 + spin : 2 * spin;
        const pop = 1 + 0.05 * Math.sin(Math.PI * clamp((show - 0.6) / 0.4, 0, 1));
        let pose: CssPose = { ...lerpPose(lifted, big, move, 36), flip, width: lerp(lifted.width, big.width, move) * pop };
        if (place > 0) pose = lerpPose({ ...big, flip: 0 }, { ...toCss, flip: 0, width: toCss.width * 1.06 }, place, 20);
        api.setTransitPose(proxy, pose, 30);
      }
      if (place >= 1 && !landed) {
        landed = true;
        proxy.group.visible = false;
        s.unhideAll();
        api.sync(step.boardAfter);
        flair = flairBurst(api, s, d.flairKey, target, api.cardType(d.card));
      }
      const v = api.entity(d.entityId);
      if (landed && v && settleRaw.phaseId === 'SETTLE_FLAIR') {
        const k = settleRaw.raw;
        v.offset.scale = 1.06 - 0.06 * EASINGS.easeOutBack(k);
        v.offset.y = 0.06 * (1 - k);
        if (special) v.card.setMarker(k < 0.95 ? 'HOVER' : 'NONE');
        v.updateTransform();
        ring?.update(k);
        flair?.update(k);
      }
    },
    finish: finisher(api, step, s, () => {
      const v = api.entity(d.entityId);
      if (v) {
        v.offset.scale = 1;
        v.offset.y = 0;
        v.card.setMarker('NONE');
        v.updateTransform();
      }
    }),
  };
}

function evolveRuntime(api: StageApi, step: PresentationStep): StepRuntime {
  const d = step.data;
  if (d.kind !== 'EVOLVE') return noop;
  const s = scope(api);
  const dropped = d.role === 'HUMAN' && d.handKey ? api.takeHandDrop(d.handKey) : null;
  const src = dropped ? { css: dropped, world: null } : sourcePoseFromHand(api, step, d.handKey, d.player, d.role);
  const before = api.entity(d.entityId);
  const oldDescriptor = before?.card.descriptor() ?? null;
  api.sync(step.boardAfter);
  const v = api.entity(d.entityId);
  if (v && oldDescriptor) v.card.setDescriptor(oldDescriptor);
  const target = api.entityPose(d.entityId);
  const descriptor = api.descriptorFor(d.card, d.player, `${d.entityId}:evo`);
  const proxy = src.css ? s.transit(descriptor) : s.boardProxy(descriptor);
  proxy.setFaceVisibility('BOTH');
  const toCss = target ? api.worldToCss(target) : null;
  const ring = target ? s.effect(createRingEffect(api.rs, api.effectsRoot, { position: new Vector3(target.x, target.y + 0.02, target.z), color: COLORS.cyanSoft, radius: target.scale * 0.8, maxScale: 1.3 })) : null;
  let stacked = false;
  let flair: EffectHandle | null = null;
  return {
    update: (p) => {
      const focus = phaseProgress('EVOLVE', 'FOCUS_ORIGIN', p.baseMs);
      const stack = phaseProgress('EVOLVE', 'STACK_CARD', p.baseMs);
      const settle = phaseProgress('EVOLVE', 'SETTLE', p.baseMs);
      if (v) {
        v.offset.y = 0.12 * focus * (1 - settle);
        v.card.setMarker(stack < 1 ? 'HOVER' : 'NONE');
        v.updateTransform();
      }
      if (!target) return;
      if (!stacked) {
        if (src.css && toCss) api.setTransitPose(proxy, lerpPose({ ...src.css, y: src.css.y - 20 * focus }, { ...toCss, y: toCss.y - 6, flip: 0 }, stack, 30), 30);
        else if (src.world) api.setBoardPose(proxy, lerpWorld({ ...src.world, y: src.world.y + 0.2 * focus }, { ...target, y: target.y + 0.06, flip: 0 }, stack, 0.6));
        else proxy.group.visible = false;
      }
      if (stack >= 1 && !stacked) {
        stacked = true;
        proxy.group.visible = false;
        api.sync(step.boardAfter);
        flair = flairBurst(api, s, d.flairKey, target, api.cardType(d.card));
      }
      if (stacked) {
        ring?.update(Math.min(1, phaseProgress('EVOLVE', 'UPDATE_LABELS', p.baseMs) * 0.6 + settle * 0.4));
        flair?.update(settle);
      }
    },
    finish: finisher(api, step, s, () => {
      const e = api.entity(d.entityId);
      if (e) {
        e.offset.y = 0;
        e.card.setMarker('NONE');
        e.updateTransform();
      }
    }),
  };
}

// ---------------------------------------------------------------------------------- Treinadores

function trainerRuntime(api: StageApi, step: PresentationStep): StepRuntime {
  const d = step.data;
  if (d.kind !== 'TRAINER') return noop;
  return d.subtype === 'TOOL' || d.subtype === 'STADIUM' ? placedTrainerRuntime(api, step) : dissolveTrainerRuntime(api, step);
}

/**
 * Item e Apoiador (gameplay-pocket §9; observações §6.6): a carta reaparece pequena no centro, cresce até a prévia
 * grande levemente inclinada, segura e dissolve na cor do subtipo — clareia até uma placa branca e as molduras se
 * expandem em camadas. O visual “em resolução” fica oculto até o fim do lote: o descarte faz a carta reaparecer na pilha.
 */
function dissolveTrainerRuntime(api: StageApi, step: PresentationStep): StepRuntime {
  const d = step.data;
  if (d.kind !== 'TRAINER') return noop;
  const s = scope(api);
  const dropped = d.role === 'HUMAN' && d.handKey ? api.takeHandDrop(d.handKey) : null;
  const src = dropped ? { css: dropped, world: null } : sourcePoseFromHand(api, step, d.handKey, d.player, d.role);
  const card = d.card;
  if (card) api.hide(`resolving:${card.cardId}`);
  api.sync(step.boardAfter);
  const proxy = s.transit(api.descriptorFor(card, d.player, `trainer:${card?.cardId ?? 'x'}`));
  proxy.setFaceVisibility('BOTH');
  const center = api.previewCss();
  const big: CssPose = { ...center, rotation: -0.05, flip: 0 };
  const small: CssPose = { ...big, width: big.width * 0.5 };
  const fromCss: CssPose = src.css ?? (src.world ? api.worldToCss(src.world) : small);
  const faceDown = fromCss.flip > 0.5;
  const fx = createDissolveFx(TRAINER_DISSOLVE_COLORS[d.subtype] ?? TRAINER_DISSOLVE_COLORS.ITEM!);
  api.transitRoot.add(fx.group);
  s.onDispose(fx.dispose);
  return {
    update: (p) => {
      const u = p.u;
      const go = EASINGS.easeInOutCubic(clamp(u / 0.16, 0, 1));
      const grow = EASINGS.easeOutBack(clamp((u - 0.16) / 0.14, 0, 1));
      const hold = clamp((u - 0.3) / 0.3, 0, 1);
      const k = clamp((u - 0.6) / 0.4, 0, 1);
      // O verso do adversário vira de frente enquanto chega ao centro.
      const flip = faceDown ? 1 - EASINGS.easeInOutCubic(clamp(u / 0.26, 0, 1)) : 0;
      const travel = lerpPose(fromCss, small, go, 28);
      const pose: CssPose = {
        ...travel,
        y: travel.y - 6 * hold,
        width: (grow > 0 ? lerp(small.width, big.width, grow) : travel.width) * (1 + 0.015 * hold),
        rotation: lerp(fromCss.rotation, big.rotation, go),
        flip,
      };
      api.setTransitPose(proxy, pose, 30);
      // Transparente, mas visível até o fim: o HUD HTML continua escondendo os PS que ficam sob a dissolução.
      proxy.setOpacity(1 - clamp(k / 0.4, 0, 1));
      proxy.group.visible = k < 1;
      fx.update(k, pose.x, pose.y, pose.width, pose.rotation, 45);
    },
    finish: finisher(api, step, s),
  };
}

/** Ferramenta e Estádio: a carta vai até o Pokémon ou o espaço do Estádio (a coleção A1 não tem nenhum dos dois). */
function placedTrainerRuntime(api: StageApi, step: PresentationStep): StepRuntime {
  const d = step.data;
  if (d.kind !== 'TRAINER') return noop;
  const s = scope(api);
  const dropped = d.role === 'HUMAN' && d.handKey ? api.takeHandDrop(d.handKey) : null;
  const src = dropped ? { css: dropped, world: null } : sourcePoseFromHand(api, step, d.handKey, d.player, d.role);
  const card = d.card;
  if (card) s.hide(`resolving:${card.cardId}`);
  if (d.subtype === 'TOOL' && d.targetEntityId) s.hide(`tool:${d.targetEntityId}`);
  if (d.subtype === 'STADIUM') s.hide('stadium');
  const prevStadium = d.subtype === 'STADIUM' ? api.anchorPose('STADIUM') : null;
  api.sync(step.boardAfter);
  const descriptor = api.descriptorFor(card, d.player, `trainer:${card?.cardId ?? 'x'}`);
  const proxy = src.css ? s.transit(descriptor) : s.boardProxy(descriptor);
  proxy.setFaceVisibility('BOTH');
  const index = card ? Math.max(0, step.boardAfter.sides[d.player].resolving.findIndex((r) => r.cardId === card.cardId)) : 0;
  const dest: WorldPose | null = d.subtype === 'TOOL' && d.targetEntityId ? api.toolWorld(d.targetEntityId)
    : d.subtype === 'STADIUM' ? api.anchorPose('STADIUM') : api.resolutionWorld(d.role, index);
  const enlarged = dest ? { ...dest, scale: dest.scale * (d.subtype === 'SUPPORTER' ? 1.25 : 1.1), y: dest.y + 0.4 } : null;
  let prevProxy: CardVisual | null = null;
  if (d.previousStadium && prevStadium) {
    prevProxy = s.boardProxy(api.descriptorFor(d.previousStadium, d.player, 'stadium-prev'));
    prevProxy.setFaceVisibility('FRONT');
    api.setBoardPose(prevProxy, prevStadium);
  }
  const prevOwnerDiscard = d.previousStadium ? api.anchorPose(`${d.role}_DISCARD`) : null;
  return {
    update: (p) => {
      if (!dest || !enlarged) return;
      const u = p.u;
      const t1 = EASINGS.easeInOutCubic(clamp(u / 0.55, 0, 1));
      const t2 = EASINGS.easeOutCubic(clamp((u - 0.7) / 0.3, 0, 1));
      if (src.css) {
        const mid = api.worldToCss(enlarged);
        const pose = lerpPose({ ...src.css, y: src.css.y - 20 }, { ...mid, flip: 0 }, t1, 30);
        api.setTransitPose(proxy, t2 > 0 ? lerpPose({ ...mid, flip: 0 }, { ...api.worldToCss(dest), flip: 0 }, t2) : pose, 30);
      } else if (src.world) {
        const pose = lerpWorld(src.world, { ...enlarged, flip: 0 }, t1, 0.6);
        api.setBoardPose(proxy, t2 > 0 ? lerpWorld({ ...enlarged, flip: 0 }, { ...dest, flip: 0 }, t2) : pose);
      } else {
        api.setBoardPose(proxy, lerpWorld({ ...enlarged, flip: 0 }, { ...dest, flip: 0 }, t2));
      }
      if (prevProxy && prevStadium && prevOwnerDiscard) api.setBoardPose(prevProxy, lerpWorld(prevStadium, prevOwnerDiscard, EASINGS.easeInOutCubic(clamp(u / 0.6, 0, 1)), 0.4));
    },
    finish: finisher(api, step, s),
  };
}

// ------------------------------------------------------------------------------------- Energia

function energyRuntime(api: StageApi, step: PresentationStep): StepRuntime {
  const d = step.data;
  if (d.kind !== 'ENERGY') return noop;
  const s = scope(api);
  const zone = d.fromZone ? api.anchorPose(`${d.role}_ENERGY_READY`) : null;
  const fromEntity = d.fromEntityId ? api.entity(d.fromEntityId) : null;
  const fromList = d.fromEntityId ? findEntity(step.boardBefore, d.fromEntityId)?.energies ?? [] : [];
  const fromIndex = Math.max(0, fromList.findIndex((e) => d.energyIds.includes(e.id)));
  const fromToken = fromEntity ? fromEntity.tokenWorld(Math.min(3, fromIndex)) : null;
  const from: WorldPose | null = zone ?? (fromToken ? { x: fromToken.x, y: fromToken.y, z: fromToken.z, scale: fromToken.size } : null);
  for (const id of d.energyIds) s.hide(`energy:${id}`);
  if (d.fromZone) s.hide(`zone:${d.role}_READY`);
  api.sync(step.boardAfter);
  const toEntity = d.toEntityId ? api.entity(d.toEntityId) : null;
  const afterEntity = d.toEntityId ? findEntity(step.boardAfter, d.toEntityId) : null;
  const firstIndex = afterEntity ? Math.max(0, afterEntity.energies.findIndex((e) => d.energyIds.includes(e.id))) : 0;
  const toToken = toEntity ? toEntity.tokenWorld(Math.min(3, firstIndex)) : null;
  const to: WorldPose | null = toToken ? { x: toToken.x, y: toToken.y, z: toToken.z, scale: toToken.size }
    : d.mode === 'DISCARD' ? api.anchorPose(`${d.role}_DISCARD`) : null;
  const token = createEnergyToken(api.rs, api.effectsRoot, d.energyType);
  s.onDispose(token.dispose);
  const landing = to ? s.effect(createRingEffect(api.rs, api.effectsRoot, { position: new Vector3(to.x, to.y + 0.01, to.z), color: COLORS.boardLine, radius: to.scale * 0.7, maxScale: 1.6, opacity: 0.9 })) : null;
  let landed = false;
  // Solto pelo jogador (gameplay-pocket §6): o orbe voa do ponto da soltura até a fileira de Energias da carta,
  // encolhendo; ao chegar, anel e partículas do tipo marcam a ligação e a carta pulsa de leve.
  const drop = d.fromZone && d.role === 'HUMAN' && d.mode !== 'DISCARD' ? api.takeEnergyDrop() : null;
  const flyer = drop && to ? createEnergyOrbSprite(api.rs, api.transitRoot, d.energyType) : null;
  if (flyer) s.onDispose(flyer.dispose);
  const cardPose = d.toEntityId ? api.entityPose(d.toEntityId) : null;
  const absorb = flyer && cardPose ? s.effect(createRingEffect(api.rs, api.effectsRoot, {
    position: new Vector3(cardPose.x, cardPose.y + 0.02, cardPose.z), color: vfxFor(d.energyType).color, radius: cardPose.scale * 0.55, maxScale: 1.9, opacity: 0.85,
  })) : null;
  const burst = flyer && to ? s.effect(createBurstEffect(api.rs, api.effectsRoot, {
    origin: new Vector3(to.x, to.y + 0.05, to.z), profile: vfxFor(d.energyType), count: Math.min(10, api.particleBudget()), spread: to.scale * 1.4, seed: `attach:${step.stepId}`, size: to.scale * 0.5,
  })) : null;
  if (flyer && drop && to) {
    const target = api.worldToCss({ ...to, y: to.y + 0.03 });
    return {
      update: (p) => {
        const t = EASINGS.easeInOutCubic(clamp(p.u / 0.6, 0, 1));
        const settle = clamp((p.u - 0.6) / 0.4, 0, 1);
        token.set({ ...to, y: to.y + 0.03 }, 0);
        if (settle <= 0) {
          flyer.set(lerp(drop.x, target.x, t), lerp(drop.y, target.y, t) - 46 * Math.sin(Math.PI * t), lerp(drop.size, target.width * 1.4, t), 1);
          return;
        }
        if (!landed) {
          landed = true;
          flyer.set(target.x, target.y, target.width, 0);
          flyer.clearTrail();
          s.unhideAll();
          api.sync(step.boardAfter);
        }
        absorb?.update(settle);
        burst?.update(settle);
        landing?.update(settle);
        if (toEntity) {
          toEntity.offset.scale = 1 + 0.07 * Math.sin(Math.PI * settle);
          toEntity.updateTransform();
        }
      },
      finish: finisher(api, step, s, () => {
        if (toEntity) {
          toEntity.offset.scale = 1;
          toEntity.updateTransform();
        }
      }),
    };
  }
  return {
    update: (p) => {
      if (!from || !to) return;
      const t = EASINGS.easeInOutCubic(clamp(p.u / 0.78, 0, 1));
      const settle = clamp((p.u - 0.78) / 0.22, 0, 1);
      const endScale = d.mode === 'DISCARD' ? from.scale * 0.6 : to.scale;
      if (settle <= 0) token.set(lerpWorld({ ...from, y: from.y + 0.03 }, { ...to, y: to.y + 0.03, scale: endScale }, t, 0.9), d.mode === 'DISCARD' ? 1 - 0.6 * t : 1);
      else if (d.mode === 'DISCARD') token.set({ ...to, scale: endScale }, 0.4 * (1 - settle));
      else {
        if (!landed) {
          landed = true;
          s.unhideAll();
          api.sync(step.boardAfter);
        }
        token.set({ ...to, y: to.y + 0.03, scale: to.scale * (1 + 0.18 * Math.sin(Math.PI * settle)) }, 1 - settle);
        landing?.update(settle);
      }
    },
    finish: finisher(api, step, s),
  };
}

export function createEnergyToken(rs: RenderSystem, parent: Group, type: string, options: { dim?: boolean } = {}): { mesh: Mesh; set: (pose: WorldPose, opacity: number) => void; dispose: () => void } {
  const lease = acquireEnergyTexture(rs, type, { dim: options.dim ?? false });
  const geometry = new CircleGeometry(0.5, 32);
  const material = new MeshBasicMaterial({ map: lease.texture, transparent: true, toneMapped: false, depthWrite: false });
  const mesh = new Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 6;
  parent.add(mesh);
  return {
    mesh,
    set: (pose, opacity) => {
      mesh.position.set(pose.x, pose.y, pose.z);
      mesh.scale.setScalar(pose.scale);
      material.opacity = opacity;
      mesh.visible = opacity > 0.01;
    },
    dispose: () => {
      mesh.removeFromParent();
      geometry.dispose();
      material.dispose();
      releaseTexture(rs, lease);
    },
  };
}

// ------------------------------------------------------------------------------------------ ataque

function attackRuntime(api: StageApi, step: PresentationStep): StepRuntime {
  const d = step.data;
  if (d.kind !== 'ATTACK') return noop;
  const s = scope(api);
  api.sync(step.boardAfter);
  const attacker = api.entity(d.attackerId);
  const attackerPose = api.entityPose(d.attackerId);
  const targetPose = d.targetEntityId ? api.entityPose(d.targetEntityId) : null;
  const cut = api.cutinCss();
  const descriptor = api.descriptorFor(d.attackerCard, d.player, `cutin:${d.attackerId}`);
  const proxy = s.transit(descriptor);
  proxy.setFaceVisibility('FRONT');
  const slotCss = attackerPose ? api.worldToCss(attackerPose) : { x: cut.x, y: cut.y, width: cut.width * 0.5, rotation: 0, flip: 0 };
  const cutPose: CssPose = cut.compact
    ? { x: slotCss.x + (d.role === 'HUMAN' ? 1 : -1) * slotCss.width * 1.25, y: slotCss.y, width: slotCss.width * 1.3, rotation: (d.role === 'HUMAN' ? -1 : 1) * 0.1, flip: 0, tilt: 0 }
    : { x: cut.x, y: cut.y, width: cut.width, rotation: -0.14, flip: 0, tilt: 0.12 };
  const band = createAttackBand(api.rs, d.attackName, api.cardName(d.attackerCard), d.attackType, !cut.compact);
  s.onDispose(band.dispose);
  api.transitRoot.add(band.group);
  const dir: 1 | -1 = d.role === 'HUMAN' ? 1 : -1;
  const lines = createSpeedLines(6, `lines:${step.stepId}`);
  s.onDispose(lines.dispose);
  api.transitRoot.add(lines.group);
  const profile = vfxFor(d.attackType);
  const budget = api.particleBudget();
  const beam = attackerPose && targetPose ? s.effect(createBeamEffect(api.rs, api.effectsRoot, {
    from: new Vector3(attackerPose.x, attackerPose.y + 0.3, attackerPose.z), to: new Vector3(targetPose.x, targetPose.y + 0.15, targetPose.z),
    profile, count: Math.max(8, Math.round(budget * 0.4)), arcHeight: 1.6, size: 0.32, seed: step.stepId,
  })) : null;
  const rings: EffectHandle[] = targetPose
    ? Array.from({ length: profile.rings }, (_, i) => s.effect(createRingEffect(api.rs, api.effectsRoot, {
      position: new Vector3(targetPose.x, targetPose.y + 0.05 + i * 0.01, targetPose.z), color: i === 0 ? profile.color : profile.accent,
      radius: targetPose.scale * (0.5 + i * 0.12), maxScale: 1.8 + i * 0.4, opacity: d.prevented ? 0.5 : 0.95,
    })))
    : [];
  const shield = targetPose && d.prevented ? s.effect(createRingEffect(api.rs, api.effectsRoot, { position: new Vector3(targetPose.x, targetPose.y + 0.08, targetPose.z), color: COLORS.primaryStrong, radius: targetPose.scale * 0.85, thickness: 0.3, maxScale: 1.1 })) : null;
  const burst = targetPose && !d.prevented ? s.effect(createBurstEffect(api.rs, api.effectsRoot, {
    origin: new Vector3(targetPose.x, targetPose.y + 0.1, targetPose.z), profile, count: budget, spread: targetPose.scale * 1.4, seed: `${step.stepId}:burst`, size: 0.28,
  })) : null;
  const special = step.presetId === 'ATTACK_SPECIAL';
  const ratio = step.baseDurationMs / presetDurationMs('ATTACK_STANDARD');
  let damageCued = false;
  attacker?.setDimmed(true);
  return {
    update: (p) => {
      const base = p.baseMs / ratio;
      const attenuate = phaseProgress('ATTACK_STANDARD', 'ATTENUATE', base);
      const cutin = phaseProgress('ATTACK_STANDARD', 'CARD_CUTIN', base);
      const read = phaseProgress('ATTACK_STANDARD', 'READ_ACCENT', base);
      const travel = phaseProgress('ATTACK_STANDARD', 'TRAVEL_AND_RETURN', base);
      const impactRaw = samplePhase('ATTACK_STANDARD', base);
      const impact = phaseProgress('ATTACK_STANDARD', 'IMPACT_HP', base);
      api.setVeil(cut.compact ? 0 : 0.4 * attenuate * (1 - travel));
      // Destaque: sobe do slot, amplia e inclina; segura durante moedas inseridas; volta ao slot.
      const shown = lerpPose({ ...slotCss, flip: 0 }, cutPose, cutin);
      const drift = { ...shown, x: shown.x + (p.holding ? 0 : 6 * read), rotation: shown.rotation };
      const back = lerpPose(drift, { ...slotCss, flip: 0 }, EASINGS.easeInOutCubic(travel));
      const pose = travel > 0 ? back : drift;
      api.setTransitPose(proxy, pose, 40);
      proxy.group.visible = travel < 0.98;
      // Faixa no terço inferior do destaque, à frente da carta (direção visual §11.2), na mesma linguagem das outras faixas:
      // abre do lado de quem ataca (desaceleração longa), o texto entra e desliza, um brilho atravessa e tudo fecha
      // para o lado oposto acelerando. Tempos em ms de base do ATTACK_STANDARD (cut-in 150–650, leitura 650–1350).
      const ms = (from: number, len: number) => clamp((base - from) / len, 0, 1);
      const easeOutQuint = (t: number) => 1 - (1 - t) ** 5;
      const easeInCubic = (t: number) => t * t * t;
      band.set({
        x: cut.compact ? pose.x : cut.stageX,
        y: pose.y + pose.width * 1.4 * 0.26,
        width: cut.compact ? pose.width * 1.75 : cut.stageWidth * 1.04,
        rotation: cut.compact ? pose.rotation * 0.6 : 0.15,
        dir,
        open: easeOutQuint(ms(220, 330)),
        close: easeInCubic(ms(1350, 260)),
        textIn: easeOutQuint(ms(300, 340)),
        textOut: easeInCubic(ms(1350, 240)),
        drift: dir * 18 * ms(640, 710),
        shine: ms(560, 520),
      });
      lines.group.visible = !cut.compact && read > 0 && travel < 0.5;
      lines.group.position.set(cutPose.x, -cutPose.y, 35);
      lines.update(read + (p.holding ? (p.timelineMs % 600) / 600 : 0), cutPose.width * 2.2, cutPose.width * 1.6);
      beam?.update(travel);
      if (impactRaw.phaseId === 'IMPACT_HP' || impact > 0) {
        if (!damageCued && d.targetEntityId) {
          damageCued = true;
          api.cue({ kind: 'DAMAGE', entityId: d.targetEntityId, amount: d.damage, prevented: d.prevented, skipped: false });
        }
        for (const r of rings) r.update(impact);
        shield?.update(impact);
        burst?.update(impact);
        const target = d.targetEntityId ? api.entity(d.targetEntityId) : null;
        if (target && !d.prevented) {
          target.offset.x = Math.sin(impact * 42) * 0.07 * (1 - impact) * (special ? 1.4 : 1);
          target.offset.y = 0.05 * Math.sin(Math.PI * impact);
          target.updateTransform();
        }
      }
    },
    finish: finisher(api, step, s, () => {
      api.setVeil(0);
      attacker?.setDimmed(false);
      const target = d.targetEntityId ? api.entity(d.targetEntityId) : null;
      if (target) {
        target.offset.x = 0;
        target.offset.y = 0;
        target.updateTransform();
      }
      if (!damageCued && d.targetEntityId && !d.failed) api.cue({ kind: 'DAMAGE', entityId: d.targetEntityId, amount: d.damage, prevented: d.prevented, skipped: false });
    }),
  };
}

// -------------------------------------------------------------------------------------------- moeda

function coinRuntime(api: StageApi, step: PresentationStep): StepRuntime {
  const d = step.data;
  if (d.kind !== 'COIN') return noop;
  const coin = api.coin(d.player);
  const cut = api.cutinCss();
  const size = cut.width * 0.5;
  const cx = cut.compact ? cut.x : cut.x + cut.width * 0.95;
  const cy = cut.y;
  api.transitRoot.add(coin.group);
  coin.group.visible = true;
  coin.group.position.set(cx, -cy, 80);
  coin.group.scale.setScalar(size);
  const preset = step.presetId === 'COIN_FIRST' ? 'COIN_FIRST' : 'COIN_NEXT';
  let cued = false;
  let finished = false;
  const apply = (baseMs: number) => {
    const pose = coinPoseAt(preset, baseMs, d.face);
    coin.setPose(pose.angle, pose.lift * 0.9, pose.scale);
    coin.setGlow(pose.showResult ? 1 : 0);
    if (pose.showResult && !cued) {
      cued = true;
      api.cue({ kind: 'COIN_RESULT', face: d.face, index: d.index, count: d.count, reason: d.reason, player: d.player, skipped: false });
    }
  };
  apply(0);
  return {
    update: (p) => apply(p.baseMs),
    finish: () => {
      if (finished) return;
      finished = true;
      apply(step.baseDurationMs);
      coin.group.visible = false;
      api.sync(step.boardAfter);
    },
  };
}

// ------------------------------------------------------------------------- dano, cura, condição

function feedbackRuntime(api: StageApi, step: PresentationStep): StepRuntime {
  const d = step.data;
  const s = scope(api);
  api.sync(step.boardAfter);
  const entityId = d.kind === 'DAMAGE' ? d.targetEntityId : d.kind === 'HEAL' || d.kind === 'STATUS' || d.kind === 'ABILITY' ? d.entityId : '';
  const pose = api.entityPose(entityId);
  const color = d.kind === 'HEAL' ? COLORS.hpFill : d.kind === 'STATUS' ? CONDITION_COLORS[d.condition] ?? COLORS.primary : d.kind === 'ABILITY' ? COLORS.cyan : d.kind === 'DAMAGE' && d.prevented ? COLORS.primaryStrong : COLORS.opponentBand;
  const ring = pose ? s.effect(createRingEffect(api.rs, api.effectsRoot, { position: new Vector3(pose.x, pose.y + 0.05, pose.z), color, radius: pose.scale * 0.6, maxScale: 1.7 })) : null;
  const burst = pose && d.kind === 'HEAL' ? s.effect(createBurstEffect(api.rs, api.effectsRoot, {
    origin: new Vector3(pose.x, pose.y + 0.05, pose.z), profile: { color: COLORS.hpFill, accent: '#FFFFFF', shape: 'dot', gravity: -1.6, rings: 1 },
    count: Math.round(api.particleBudget() * 0.4), spread: pose.scale * 0.8, seed: step.stepId, size: 0.22,
  })) : null;
  let cued = false;
  return {
    update: (p) => {
      ring?.update(p.u);
      burst?.update(p.u);
      if (!cued && p.u >= 0.15) {
        cued = true;
        impactCues(api, step, false);
      }
      const v = api.entity(entityId);
      if (v && d.kind === 'DAMAGE' && !d.prevented) {
        v.offset.x = Math.sin(p.u * 38) * 0.05 * (1 - p.u);
        v.updateTransform();
      }
      if (v && d.kind === 'ABILITY') {
        v.offset.y = 0.15 * Math.sin(Math.PI * p.u);
        v.card.setMarker(p.u < 0.9 ? 'HOVER' : 'NONE');
        v.updateTransform();
      }
    },
    finish: finisher(api, step, s, () => {
      if (!cued) impactCues(api, step, false);
      const v = api.entity(entityId);
      if (v) {
        v.offset.x = 0;
        v.offset.y = 0;
        v.card.setMarker('NONE');
        v.updateTransform();
      }
    }),
  };
}

// ------------------------------------------------------------------------- recuo, troca, promoção

function moveRuntime(api: StageApi, step: PresentationStep): StepRuntime {
  const d = step.data;
  if (d.kind !== 'MOVE_POKEMON') return noop;
  const s = scope(api);
  const before = { incoming: api.entityPose(d.incomingId), outgoing: d.outgoingId ? api.entityPose(d.outgoingId) : null };
  api.sync(step.boardAfter);
  const after = { incoming: api.entityPose(d.incomingId), outgoing: d.outgoingId ? api.entityPose(d.outgoingId) : null };
  const movers = [
    { id: d.incomingId, from: before.incoming, to: after.incoming, side: 1 },
    ...(d.outgoingId ? [{ id: d.outgoingId, from: before.outgoing, to: after.outgoing, side: -1 }] : []),
  ];
  let flair: EffectHandle | null = null;
  return {
    update: (p) => {
      const t = EASINGS.easeInOutCubic(p.u);
      for (const m of movers) {
        const v = api.entity(m.id);
        if (!v || !m.from || !m.to) continue;
        // Trajetórias laterais complementares para não cruzar de forma confusa.
        const lateral = m.side * 0.9 * Math.sin(Math.PI * t);
        v.offset.x = (m.from.x - m.to.x) * (1 - t) + lateral;
        v.offset.z = (m.from.z - m.to.z) * (1 - t);
        v.offset.y = 0.35 * Math.sin(Math.PI * t);
        v.offset.scale = lerp(m.from.scale / m.to.scale, 1, t);
        v.updateTransform();
      }
      if (p.u > 0.85 && !flair && after.incoming && d.flairKey) flair = flairBurst(api, s, d.flairKey, after.incoming, 'COLORLESS');
      flair?.update((p.u - 0.85) / 0.15);
    },
    finish: finisher(api, step, s, () => {
      for (const m of movers) {
        const v = api.entity(m.id);
        if (!v) continue;
        Object.assign(v.offset, { x: 0, y: 0, z: 0, scale: 1 });
        v.updateTransform();
      }
    }),
  };
}

// ------------------------------------------------------------------------------- Nocaute e pontos

function knockoutRuntime(api: StageApi, step: PresentationStep): StepRuntime {
  const d = step.data;
  if (d.kind !== 'KNOCKOUT') return noop;
  const s = scope(api);
  const visual = api.entity(d.entityId);
  const pose = api.entityPose(d.entityId);
  const discard = api.anchorPose(`${d.role}_DISCARD`);
  const proxy = visual && pose ? s.boardProxy(visual.card.descriptor()) : null;
  if (proxy && pose) {
    proxy.setFaceVisibility('FRONT');
    api.setBoardPose(proxy, pose);
  }
  s.hide(`discard:${d.role}`, Math.max(1, d.cardIds.length));
  api.sync(step.boardAfter);
  const sparkle = pose ? s.effect(createBurstEffect(api.rs, api.effectsRoot, {
    origin: new Vector3(pose.x, pose.y + 0.1, pose.z), profile: { color: '#FFFFFF', accent: COLORS.cyanSoft, shape: 'star', gravity: -0.6, rings: 1 },
    count: Math.round(api.particleBudget() * 0.5), spread: pose.scale, seed: step.stepId, size: 0.24,
  })) : null;
  let released = false;
  return {
    update: (p) => {
      if (!proxy || !pose || !discard) return;
      const mark = phaseProgress('KNOCKOUT', 'MARK', p.baseMs);
      const remove = phaseProgress('KNOCKOUT', 'REMOVE_STACK', p.baseMs);
      const settle = phaseProgress('KNOCKOUT', 'SETTLE', p.baseMs);
      const pulse = 1 + 0.05 * Math.sin(Math.PI * mark);
      const moving = lerpWorld({ ...pose, scale: pose.scale * pulse }, { ...discard, y: discard.y + 0.05 }, remove, 0.5);
      api.setBoardPose(proxy, moving);
      proxy.setOpacity(1 - 0.35 * mark + 0.35 * remove);
      sparkle?.update(mark * 0.5 + remove * 0.5);
      if (settle > 0 && !released) {
        released = true;
        proxy.group.visible = false;
        s.unhideAll();
        api.sync(step.boardAfter);
      }
    },
    finish: finisher(api, step, s),
  };
}

function pointsRuntime(api: StageApi, step: PresentationStep): StepRuntime {
  const d = step.data;
  if (d.kind !== 'POINTS') return noop;
  const s = scope(api);
  api.sync(step.boardAfter);
  const anchor = api.anchorPose(`${d.role}_POINTS`);
  const ring = anchor ? s.effect(createRingEffect(api.rs, api.effectsRoot, { position: new Vector3(anchor.x, anchor.y + 0.05, anchor.z), color: COLORS.pointGold, radius: 0.5, maxScale: 2.4 })) : null;
  const inner = anchor ? s.effect(createRingEffect(api.rs, api.effectsRoot, { position: new Vector3(anchor.x, anchor.y + 0.06, anchor.z), color: COLORS.primary, radius: 0.35, maxScale: 2 })) : null;
  let cued = false;
  return {
    update: (p) => {
      ring?.update(p.u);
      inner?.update(Math.max(0, p.u - 0.15) / 0.85);
      if (!cued && p.u > 0.2) {
        cued = true;
        impactCues(api, step, false);
      }
    },
    finish: finisher(api, step, s, () => {
      if (!cued) impactCues(api, step, false);
    }),
  };
}

// --------------------------------------------------------------------------- descarte e retorno

function discardRuntime(api: StageApi, step: PresentationStep): StepRuntime {
  const d = step.data;
  if (d.kind !== 'DISCARD' && d.kind !== 'RETURN') return noop;
  const s = scope(api);
  const before = step.boardBefore;
  type Flight = { proxy: CardVisual; from: WorldPose | CssPose; to: WorldPose | CssPose; transit: boolean; delay: number; fade?: boolean };
  const flights: Flight[] = [];
  const toHand = d.kind === 'RETURN' && d.to === 'HAND';
  // Treinador que dissolveu no centro neste lote: reaparece na própria pilha de descarte, sem voar de onde não está.
  const dissolved = (cardId: string) => d.kind === 'DISCARD' && d.from === 'RESOLUTION' && api.isHidden(`resolving:${cardId}`);
  const destWorld = d.kind === 'DISCARD' ? api.anchorPose(`${d.role}_DISCARD`) : d.to === 'DECK' ? api.anchorPose(`${d.role}_DECK_TOP`) : null;
  const entityPose = d.entityId ? api.entityPose(d.entityId) : null;
  const sources: { card: PresentedCard | null; key: string; css: CssPose | null; world: WorldPose | null }[] = d.cardIds.map((cardId, i) => {
    const side = before.sides[d.player];
    const fromResolving = side.resolving.findIndex((r) => r.cardId === cardId);
    const card = side.hand.find((h) => h.key === cardId)?.card ?? side.resolving[fromResolving] ?? side.discard.find((c) => c.cardId === cardId) ?? null;
    if (d.from === 'HAND' && d.role === 'HUMAN') return { card, key: cardId, css: api.handPoseCss(cardId), world: null };
    if (d.from === 'RESOLUTION' && fromResolving >= 0) return { card, key: cardId, css: null, world: api.resolutionWorld(d.role, fromResolving) };
    if (d.from === 'DISCARD') return { card, key: cardId, css: null, world: api.anchorPose(`${d.role}_DISCARD`) };
    if (entityPose) return { card, key: cardId, css: null, world: { ...entityPose, y: entityPose.y + i * 0.01 } };
    if (d.from === 'HAND') {
      const count = before.sides[d.player].hand.length;
      return { card: null, key: cardId, css: null, world: { ...api.npcFanWorld(Math.max(0, count - 1 - i), count), flip: 1 } };
    }
    return { card, key: cardId, css: null, world: api.anchorPose(`${d.role}_DECK_TOP`) };
  });
  if (destWorld && d.kind === 'DISCARD') s.hide(`discard:${d.role}`, d.cardIds.length);
  if (toHand && d.role === 'HUMAN') for (const c of d.cardIds) s.hide(`hand:${c}`);
  if (toHand && d.role === 'NPC') s.hide(`npcfan:${d.role}`, d.cardIds.length);
  api.sync(step.boardAfter);
  sources.forEach((src, i) => {
    const delay = (i / Math.max(1, sources.length)) * 0.3;
    const descriptor = api.descriptorFor(d.role === 'NPC' && toHand ? null : src.card, d.player, `move:${src.key}`);
    if (toHand && d.role === 'HUMAN') {
      const to = api.handTargetCss(src.key, step.boardAfter);
      const from = src.css ?? (src.world ? api.worldToCss(src.world) : null);
      if (!to || !from) return;
      flights.push({ proxy: s.transit(descriptor), from, to, transit: true, delay });
    } else if (src.css && destWorld) {
      flights.push({ proxy: s.transit(descriptor), from: src.css, to: api.worldToCss(destWorld), transit: true, delay });
    } else if (destWorld && dissolved(src.key)) {
      const proxy = s.boardProxy(descriptor);
      proxy.setFaceVisibility('FRONT');
      flights.push({ proxy, from: { ...destWorld, y: destWorld.y + 0.45, scale: destWorld.scale * 1.3 }, to: { ...destWorld, y: destWorld.y + 0.02 }, transit: false, delay, fade: true });
    } else if (src.world) {
      const count = step.boardAfter.sides[d.player].hand.length;
      const to = toHand ? { ...api.npcFanWorld(count - sources.length + i, count), flip: 1 } : destWorld;
      if (!to) return;
      const proxy = s.boardProxy(descriptor);
      proxy.setFaceVisibility('BOTH');
      flights.push({ proxy, from: src.world, to: { ...to, y: to.y + 0.02 }, transit: false, delay });
    }
  });
  return {
    update: (p) => {
      for (const f of flights) {
        const t = EASINGS.easeInOutCubic(clamp((p.u - f.delay) / 0.7, 0, 1));
        if (f.transit) api.setTransitPose(f.proxy, lerpPose(f.from as CssPose, f.to as CssPose, t, 30), 25);
        else api.setBoardPose(f.proxy, lerpWorld(f.from as WorldPose, f.to as WorldPose, t, f.fade ? 0 : 0.5));
        if (f.fade) f.proxy.setOpacity(clamp(t * 1.6, 0, 1));
      }
    },
    finish: finisher(api, step, s),
  };
}

function shuffleRuntime(api: StageApi, step: PresentationStep): StepRuntime {
  const d = step.data;
  if (d.kind !== 'SHUFFLE') return noop;
  const s = scope(api);
  api.sync(step.boardAfter);
  const deck = api.anchorPose(`${d.role}_DECK_TOP`);
  const ghosts = deck ? [0, 1, 2].map(() => {
    const p = s.boardProxy(api.descriptorFor(null, d.player, 'shuffle'));
    p.setFaceVisibility('BACK');
    return p;
  }) : [];
  return {
    update: (p) => {
      if (!deck) return;
      ghosts.forEach((g, i) => {
        const phase = Math.sin(p.u * Math.PI * 4 + i * 2.1);
        api.setBoardPose(g, { ...deck, x: deck.x + phase * deck.scale * 0.35 * Math.sin(Math.PI * p.u), y: deck.y + 0.18 + i * 0.02, flip: 1, rotZ: phase * 0.15 });
      });
    },
    finish: finisher(api, step, s),
  };
}

function resultRuntime(api: StageApi, step: PresentationStep): StepRuntime {
  const d = step.data;
  api.sync(step.boardAfter);
  if (d.kind === 'RESULT' && d.result?.winner) api.board.setTurnOwner(d.result.winner === step.boardAfter.viewer ? 'HUMAN' : 'NPC', false);
  return { update: () => undefined, finish: () => api.sync(step.boardAfter) };
}
