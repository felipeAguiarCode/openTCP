// planPresentation (runtime §19.2–§19.5, interface §36.2.1): transforma eventos confirmados e já
// redigidos para o observador em passos com presets do catálogo, grupos paralelos e barreira final.
// Função pura: não chama regras, não sorteia, não lê relógio. Cada passo carrega a projeção apresentada
// antes/depois para que a cena reconcilie sem recalcular nada.
import type { BattleEvent, MatchResult, PlayerId } from '../../domain/battle/types.ts';
import type { BattleView } from '../../domain/battle/views.ts';
import { PRESENTATION_VERSION, phaseStartMs, presetDurationMs, type PresetId } from './catalog.ts';
import { motionModeOf, scaleDuration, type MotionMode, type SpeedMode } from './timing.ts';
import {
  applyEvent, buildCardIndex, entityAnchorId, entityLookupOf, findEntity, projectBoard, slotAnchorId,
  type PresentedBoard, type PresentedCard, type ReduceContext, type SideRole, type SlotKey,
} from './board-model.ts';
import { ruleFor } from './event-map.ts';
import { eventIdOf, flairKey } from './flair.ts';

export type Barrier = 'READY_FOR_ACTION' | 'PENDING_DECISION' | 'MATCH_ENDED';

/** Traços públicos de uma carta, fornecidos pela camada que conhece o catálogo (nunca de carta oculta). */
export type CardTraits = {
  readonly category: 'POKEMON' | 'TRAINER';
  readonly finish: string;
  readonly ruleBox: string;
  readonly subtype?: string | null;
  readonly types: readonly string[];
  readonly name?: string;
  /** Nº de blocos de efeito por ataque (ATTACK_SPECIAL quando ≥ 2). */
  readonly attackBlocks?: Readonly<Record<string, number>>;
  /** Preset explícito declarado no ataque (`presentation.presetId`). */
  readonly attackPresets?: Readonly<Record<string, string>>;
};

export type PlanOptions = {
  readonly attemptId: string;
  readonly batchId?: string;
  readonly speed: SpeedMode;
  readonly reducedMotion: boolean;
  /** Tentativa nova: BOARD_INTRO antes de CARDS_DEALT (não se repete na retomada). */
  readonly newAttempt?: boolean;
  readonly describeCard?: (card: PresentedCard) => CardTraits | null;
  /** Chave do playmat exibido para uma projeção (resolveDisplayedPlaymat da cena). */
  readonly playmatKey?: (board: PresentedBoard) => string;
};

export type StepData =
  | { readonly kind: 'BOARD_INTRO' }
  | { readonly kind: 'DEAL'; readonly players: readonly PlayerId[] }
  | { readonly kind: 'SETUP_REVEAL'; readonly players: readonly PlayerId[]; readonly entityIds: readonly string[] }
  | { readonly kind: 'TURN'; readonly player: PlayerId; readonly role: SideRole; readonly turnNumber: number }
  | { readonly kind: 'PLAYMAT'; readonly from: string; readonly to: string }
  | { readonly kind: 'DRAW'; readonly player: PlayerId; readonly role: SideRole; readonly handKeys: readonly string[]; readonly source: 'DECK' | 'SEARCH' }
  | { readonly kind: 'PLAY_POKEMON'; readonly player: PlayerId; readonly role: SideRole; readonly entityId: string; readonly card: PresentedCard | null; readonly handKey: string | null; readonly slot: SlotKey; readonly from: string; readonly special: boolean; readonly flairKey: string | null }
  | { readonly kind: 'EVOLVE'; readonly player: PlayerId; readonly role: SideRole; readonly entityId: string; readonly card: PresentedCard | null; readonly handKey: string | null; readonly flairKey: string | null }
  | { readonly kind: 'TRAINER'; readonly player: PlayerId; readonly role: SideRole; readonly card: PresentedCard | null; readonly handKey: string | null; readonly subtype: string; readonly targetEntityId: string | null; readonly previousStadium: PresentedCard | null }
  | { readonly kind: 'ENERGY'; readonly mode: 'ATTACH' | 'MOVE' | 'DISCARD'; readonly player: PlayerId; readonly role: SideRole; readonly energyType: string; readonly energyIds: readonly string[]; readonly fromEntityId: string | null; readonly toEntityId: string | null; readonly fromZone: boolean }
  | { readonly kind: 'ATTACK'; readonly player: PlayerId; readonly role: SideRole; readonly attackerId: string; readonly attackId: string; readonly attackName: string; readonly attackType: string; readonly targetEntityId: string | null; readonly damage: number; readonly prevented: boolean; readonly failed: boolean; readonly special: boolean; readonly attackerCard: PresentedCard | null }
  | { readonly kind: 'ABILITY'; readonly player: PlayerId; readonly entityId: string; readonly abilityId: string | null }
  | { readonly kind: 'COIN'; readonly player: PlayerId | null; readonly reason: string; readonly face: 'HEADS' | 'TAILS'; readonly index: number; readonly count: number; readonly first: boolean }
  | { readonly kind: 'DAMAGE'; readonly targetEntityId: string; readonly amount: number; readonly prevented: boolean; readonly category: string }
  | { readonly kind: 'HEAL'; readonly entityId: string; readonly amount: number }
  | { readonly kind: 'STATUS'; readonly entityId: string; readonly condition: string; readonly applied: boolean }
  | { readonly kind: 'MOVE_POKEMON'; readonly reason: 'RETREAT' | 'SWITCH' | 'PROMOTE'; readonly player: PlayerId; readonly role: SideRole; readonly incomingId: string; readonly outgoingId: string | null; readonly benchIndex: number; readonly flairKey: string | null }
  | { readonly kind: 'KNOCKOUT'; readonly player: PlayerId; readonly role: SideRole; readonly entityId: string; readonly slot: SlotKey | null; readonly cardIds: readonly string[] }
  | { readonly kind: 'POINTS'; readonly player: PlayerId; readonly role: SideRole; readonly points: number; readonly total: number }
  | { readonly kind: 'DISCARD'; readonly player: PlayerId; readonly role: SideRole; readonly cardIds: readonly string[]; readonly from: string; readonly entityId: string | null }
  | { readonly kind: 'RETURN'; readonly player: PlayerId; readonly role: SideRole; readonly cardIds: readonly string[]; readonly to: 'HAND' | 'DECK'; readonly from: string; readonly entityId: string | null }
  | { readonly kind: 'SHUFFLE'; readonly player: PlayerId; readonly role: SideRole }
  | { readonly kind: 'RESULT'; readonly result: MatchResult | null };

export type StepHold = { readonly atMs: number; readonly durationMs: number };

export type PresentationStep = {
  readonly stepId: string;
  readonly index: number;
  readonly presetId: PresetId;
  readonly eventIds: readonly string[];
  readonly eventSeqs: readonly number[];
  readonly sourceAnchorIds: readonly string[];
  readonly targetAnchorIds: readonly string[];
  /** Duração do preset em Normal (catálogo). */
  readonly baseDurationMs: number;
  /** Duração efetiva após velocidade/movimento reduzido (sem esperas). */
  readonly durationMs: number;
  readonly startMs: number;
  /** Esperas internas (ex.: o destaque do ataque segura enquanto moedas inseridas giram). */
  readonly holds: readonly StepHold[];
  readonly spanMs: number;
  readonly parallelGroupId?: string;
  readonly visibility: 'PUBLIC' | 'OWNER';
  readonly finishPolicy: 'RECONCILE_CONFIRMED';
  readonly motion: MotionMode;
  readonly data: StepData;
  readonly flairKeys: readonly string[];
  readonly boardBefore: PresentedBoard;
  readonly boardAfter: PresentedBoard;
};

export type PlanNoop = { readonly seq: number; readonly type: string; readonly rule: string };

export type PresentationPlan = {
  readonly attemptId: string;
  readonly batchId: string;
  readonly presentationVersion: string;
  readonly fromStateVersion: number;
  readonly toStateVersion: number;
  readonly firstEventSequence: number;
  readonly lastEventSequence: number;
  readonly speed: SpeedMode;
  readonly reducedMotion: boolean;
  readonly steps: readonly PresentationStep[];
  readonly totalMs: number;
  readonly barrier: Barrier;
  readonly initialBoard: PresentedBoard;
  readonly finalBoard: PresentedBoard;
  readonly noops: readonly PlanNoop[];
};

// ------------------------------------------------------------------------------------------------ unidades

type Unit = {
  presetId: PresetId;
  /** Índices (no array de eventos) dos eventos que o passo apresenta. */
  events: number[];
  /** Índices absorvidos (no-ops ou fundidos), refletidos no board do fim do passo. */
  absorbed: number[];
  data: StepData;
  parallel: boolean;
  offsetBaseMs: number;
  inserts: Unit[];
  holdAtBaseMs: number;
  children: Unit[];
  flairKeys: string[];
};

const STOP_ATTACK_SCAN = new Set(['ATTACK_DECLARED', 'TURN_ENDING', 'TURN_ENDED', 'MATCH_ENDED', 'POKEMON_KNOCKED_OUT', 'TURN_STARTED']);

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}
function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
function pid(v: unknown): PlayerId | null {
  return v === 'A' || v === 'B' ? v : null;
}

export function barrierOf(after: BattleView): Barrier {
  if (after.result) return 'MATCH_ENDED';
  if (after.decisions.some((d) => !d.answered)) return 'PENDING_DECISION';
  return 'READY_FOR_ACTION';
}

export function planPresentation(events: readonly BattleEvent[], before: BattleView, after: BattleView, options: PlanOptions): PresentationPlan {
  const ctx: ReduceContext = { cards: buildCardIndex(after, before), entity: entityLookupOf(after, before) };
  const initial = projectBoard(before, events.length ? events[0]!.seq - 1 : 0);
  const boards: PresentedBoard[] = [initial];
  for (const e of events) boards.push(applyEvent(boards[boards.length - 1]!, e, ctx));
  const boardBefore = (i: number) => boards[i]!;
  const boardAfterIdx = (i: number) => boards[i + 1]!;
  const consumed: boolean[] = events.map(() => false);
  const noops: PlanNoop[] = [];
  const motion = motionModeOf(options);
  const viewer = before.viewer;
  const role = (p: PlayerId): SideRole => (p === viewer ? 'HUMAN' : 'NPC');
  const traitsOf = (c: PresentedCard | null): CardTraits | null => (c && options.describeCard ? options.describeCard(c) : null);
  const evId = (i: number) => eventIdOf(events[i]!.seq);
  let introDone = !options.newAttempt;

  const unit = (presetId: PresetId, eventIdx: number[], data: StepData, extra: Partial<Unit> = {}): Unit => ({
    presetId, events: eventIdx, absorbed: [], data, parallel: false, offsetBaseMs: 0, inserts: [], holdAtBaseMs: 0, children: [], flairKeys: [], ...extra,
  });

  function scan(from: number, to: number): { units: Unit[]; leftover: number[] } {
    const units: Unit[] = [];
    let pending: number[] = [];
    let coinRun = 0;
    const push = (...us: Unit[]) => {
      for (const u of us) {
        if (pending.length) {
          u.absorbed.push(...pending);
          pending = [];
        }
        units.push(u);
      }
      if (us.some((u) => u.data.kind !== 'COIN')) coinRun = 0;
    };
    const absorb = (i: number) => {
      const last = units[units.length - 1];
      if (last) last.absorbed.push(i);
      else pending.push(i);
    };

    for (let i = from; i < to; i += 1) {
      if (consumed[i]) continue;
      const ev = events[i]!;
      const d = ev.data;
      const p = pid(d.player);
      consumed[i] = true;
      switch (ev.type) {
        case 'ATTACK_DECLARED': {
          const attackerId = str(d.entityId) ?? '';
          let main = -1;
          let failed = -1;
          for (let j = i + 1; j < to; j += 1) {
            if (consumed[j]) continue;
            const e = events[j]!;
            if (STOP_ATTACK_SCAN.has(e.type)) break;
            if (e.type === 'ATTACK_FAILED') { failed = j; break; }
            if ((e.type === 'DAMAGE_APPLIED' || e.type === 'DAMAGE_PREVENTED') && e.data.category === 'ATTACK' && e.data.sourceEntityId === attackerId) { main = j; break; }
          }
          const b0 = boardBefore(i);
          const attacker = findEntity(b0, attackerId);
          const traits = traitsOf(attacker?.top ?? null);
          const attackId = str(d.attackId) ?? '';
          const special = !!traits && (traits.ruleBox !== 'NONE' || (traits.attackBlocks?.[attackId] ?? 0) >= 2 || traits.attackPresets?.[attackId] === 'ATTACK_SPECIAL');
          const player = p ?? attacker?.owner ?? viewer;
          const base = {
            kind: 'ATTACK' as const, player, role: role(player), attackerId, attackId, attackName: str(d.attackName) ?? '',
            attackType: traits?.types[0] ?? 'COLORLESS', attackerCard: attacker?.top ?? null,
          };
          if (main >= 0) {
            const inner = scan(i + 1, main);
            consumed[main] = true;
            const m = events[main]!;
            const preset: PresetId = special ? 'ATTACK_SPECIAL' : 'ATTACK_STANDARD';
            const total = presetDurationMs(preset);
            const ratio = total / presetDurationMs('ATTACK_STANDARD');
            const holdAt = (phaseStartMs('ATTACK_STANDARD', 'TRAVEL_AND_RETURN') ?? 700) * ratio;
            const impactAt = (phaseStartMs('ATTACK_STANDARD', 'IMPACT_HP') ?? 1020) * ratio;
            const children: Unit[] = [];
            for (let k = main + 1; k < to; k += 1) {
              if (consumed[k]) continue;
              const e = events[k]!;
              if (STOP_ATTACK_SCAN.has(e.type)) break;
              if ((e.type === 'DAMAGE_APPLIED' || e.type === 'DAMAGE_PREVENTED') && e.data.category === 'ATTACK' && e.data.sourceEntityId === attackerId) {
                consumed[k] = true;
                children.push(unit('DAMAGE_FEEDBACK', [k], damageData(e), { parallel: true, offsetBaseMs: impactAt }));
              }
            }
            const u = unit(preset, [i, main], {
              ...base, targetEntityId: str(m.data.targetEntityId) ?? str(d.targetEntityId), damage: num(m.data.amount),
              prevented: m.type === 'DAMAGE_PREVENTED', failed: false, special,
            }, { inserts: inner.units, holdAtBaseMs: holdAt, children });
            u.absorbed.push(...inner.leftover);
            push(u);
          } else {
            const inner = failed >= 0 ? scan(i + 1, failed) : { units: [], leftover: [] };
            if (failed >= 0) consumed[failed] = true;
            const u = unit('ATTACK_FOCUS', failed >= 0 ? [i, failed] : [i], {
              ...base, targetEntityId: str(d.targetEntityId), damage: 0, prevented: false, failed: failed >= 0, special: false,
            }, { inserts: inner.units, holdAtBaseMs: presetDurationMs('ATTACK_FOCUS') * 0.6 });
            u.absorbed.push(...inner.leftover);
            push(u);
          }
          break;
        }
        case 'COIN_RESOLVED': {
          const results = Array.isArray(d.results) ? (d.results as unknown[]) : [];
          const coins: Unit[] = results.map((r, k) => {
            const first = coinRun === 0 && k === 0;
            return unit(first ? 'COIN_FIRST' : 'COIN_NEXT', [i], {
              kind: 'COIN', player: p, reason: str(d.reason) ?? 'EFFECT', face: r === 'TAILS' ? 'TAILS' : 'HEADS', index: k, count: results.length, first,
            });
          });
          if (coins.length) {
            push(...coins);
            coinRun += coins.length;
          } else absorb(i);
          break;
        }
        case 'CARD_DRAWN': {
          const run = [i];
          for (let j = i + 1; j < to; j += 1) {
            const e = events[j]!;
            if (consumed[j] || e.type !== 'CARD_DRAWN' || e.data.player !== d.player || e.group !== ev.group) break;
            consumed[j] = true;
            run.push(j);
          }
          const player = p ?? viewer;
          const keyAfter = (j: number) => {
            const side = boardAfterIdx(j).sides[player];
            return side.hand[side.hand.length - 1]?.key ?? '';
          };
          for (let c = 0; c < run.length; c += 5) {
            const chunk = run.slice(c, c + 5);
            const preset: PresetId = run.length > 1 ? 'DRAW_BATCH' : role(player) === 'HUMAN' ? 'DRAW_SELF' : 'DRAW_OPPONENT';
            push(unit(preset, chunk, { kind: 'DRAW', player, role: role(player), handKeys: chunk.map(keyAfter), source: 'DECK' }));
          }
          break;
        }
        case 'CARD_SEARCHED': {
          const player = p ?? viewer;
          const side = boardAfterIdx(i).sides[player];
          push(unit(role(player) === 'HUMAN' ? 'DRAW_SELF' : 'DRAW_OPPONENT', [i], {
            kind: 'DRAW', player, role: role(player), handKeys: [side.hand[side.hand.length - 1]?.key ?? ''], source: 'SEARCH',
          }));
          break;
        }
        case 'CARDS_DEALT': {
          const run = [i];
          for (let j = i + 1; j < to && events[j]!.type === 'CARDS_DEALT' && !consumed[j]; j += 1) {
            consumed[j] = true;
            run.push(j);
          }
          if (!introDone) {
            introDone = true;
            push(unit('BOARD_INTRO', [], { kind: 'BOARD_INTRO' }));
          }
          push(unit('INITIAL_DEAL', run, { kind: 'DEAL', players: run.map((j) => pid(events[j]!.data.player)).filter((x): x is PlayerId => !!x) }));
          break;
        }
        case 'SETUP_REVEALED':
        case 'CARD_REVEALED': {
          const run = [i];
          for (let j = i + 1; j < to && events[j]!.type === ev.type && !consumed[j]; j += 1) {
            consumed[j] = true;
            run.push(j);
          }
          const last = boardAfterIdx(run[run.length - 1]!);
          const players = run.map((j) => pid(events[j]!.data.player)).filter((x): x is PlayerId => !!x);
          const entityIds = players.flatMap((pl) => [last.sides[pl].active, ...last.sides[pl].bench].filter((e) => !!e).map((e) => e!.entityId));
          push(unit('SETUP_REVEAL', run, { kind: 'SETUP_REVEAL', players, entityIds }));
          break;
        }
        case 'TURN_STARTED': {
          const player = p ?? viewer;
          const u = unit('TURN_BANNER', [i], { kind: 'TURN', player, role: role(player), turnNumber: num(d.globalTurnNumber) });
          if (options.playmatKey) {
            const fromKey = options.playmatKey(boardBefore(i));
            const toKey = options.playmatKey(boardAfterIdx(i));
            if (fromKey !== toKey) u.children.push(unit('PLAYMAT_TRANSITION', [], { kind: 'PLAYMAT', from: fromKey, to: toKey }, { parallel: true }));
          }
          push(u);
          break;
        }
        case 'POKEMON_ENTERED': {
          const player = p ?? viewer;
          const entityId = str(d.entityId) ?? '';
          const after = boardAfterIdx(i);
          const entity = findEntity(after, entityId);
          const c = entity?.top ?? ctx.cards.get(str(d.cardId) ?? '') ?? null;
          const traits = traitsOf(c);
          const special = !!c && !!traits && (traits.finish !== 'NORMAL' || traits.ruleBox !== 'NONE');
          const before = boardBefore(i).sides[player];
          const handKey = d.from === 'HAND' ? (role(player) === 'HUMAN' ? str(d.cardId) : before.hand[before.hand.length - 1]?.key ?? null) : null;
          const fk = c ? flairKey(options.attemptId, evId(i), 'ENTRY', entityId) : null;
          push(unit(special ? 'PLAY_SPECIAL' : 'PLAY_BASIC', [i], {
            kind: 'PLAY_POKEMON', player, role: role(player), entityId, card: c, handKey, slot: entity?.slot ?? (`BENCH_${num(d.benchIndex)}` as SlotKey),
            from: str(d.from) ?? 'HAND', special, flairKey: fk,
          }, { flairKeys: fk ? [fk] : [] }));
          break;
        }
        case 'POKEMON_EVOLVED': {
          const player = p ?? viewer;
          const entityId = str(d.entityId) ?? '';
          const c = ctx.cards.get(str(d.toCardId) ?? '') ?? null;
          const before = boardBefore(i).sides[player];
          const handKey = role(player) === 'HUMAN' ? str(d.toCardId) : before.hand[before.hand.length - 1]?.key ?? null;
          const fk = flairKey(options.attemptId, evId(i), 'EVOLUTION', entityId);
          push(unit('EVOLVE', [i], { kind: 'EVOLVE', player, role: role(player), entityId, card: c, handKey, flairKey: fk }, { flairKeys: [fk] }));
          break;
        }
        case 'TRAINER_PLAYED': {
          const player = p ?? viewer;
          const subtype = str(d.subtype) ?? 'ITEM';
          const cardId = str(d.cardId);
          const c = ctx.cards.get(cardId ?? '') ?? null;
          const before = boardBefore(i).sides[player];
          const handKey = role(player) === 'HUMAN' ? cardId : before.hand[before.hand.length - 1]?.key ?? null;
          const merged: number[] = [i];
          let targetEntityId: string | null = null;
          let previousStadium: PresentedCard | null = null;
          if (d.fossil) {
            // Fóssil: Item jogado como Pokémon Básico — um único passo PLAY_ITEM até o Banco.
            for (let j = i + 1; j < to; j += 1) {
              const e = events[j]!;
              if (!consumed[j] && e.type === 'POKEMON_ENTERED' && e.data.cardId === cardId) {
                consumed[j] = true;
                merged.push(j);
                const entity = findEntity(boardAfterIdx(j), str(e.data.entityId) ?? '');
                push(unit('PLAY_ITEM', merged, {
                  kind: 'PLAY_POKEMON', player, role: role(player), entityId: str(e.data.entityId) ?? '', card: c, handKey,
                  slot: entity?.slot ?? (`BENCH_${num(e.data.benchIndex)}` as SlotKey), from: 'HAND', special: false, flairKey: null,
                }));
                break;
              }
            }
            if (merged.length === 1) push(unit('PLAY_ITEM', merged, { kind: 'TRAINER', player, role: role(player), card: c, handKey, subtype, targetEntityId: null, previousStadium: null }));
            break;
          }
          const mergeType = subtype === 'TOOL' ? 'TOOL_ATTACHED' : subtype === 'STADIUM' ? 'STADIUM_REPLACED' : null;
          if (mergeType) {
            for (let j = i + 1; j < to; j += 1) {
              const e = events[j]!;
              if (!consumed[j] && e.type === mergeType && e.data.cardId === cardId) {
                consumed[j] = true;
                merged.push(j);
                if (mergeType === 'TOOL_ATTACHED') targetEntityId = str(e.data.entityId);
                else {
                  const prev = boardBefore(j).stadium;
                  previousStadium = prev ? { cardId: prev.cardId, printingId: prev.printingId, definitionKey: prev.definitionKey } : null;
                }
                break;
              }
            }
          }
          const preset: PresetId = subtype === 'SUPPORTER' ? 'PLAY_SUPPORTER' : subtype === 'TOOL' ? 'ATTACH_TOOL' : subtype === 'STADIUM' ? 'PLAY_STADIUM' : 'PLAY_ITEM';
          push(unit(preset, merged, { kind: 'TRAINER', player, role: role(player), card: c, handKey, subtype, targetEntityId, previousStadium }));
          break;
        }
        case 'TOOL_ATTACHED':
        case 'STADIUM_REPLACED': {
          // Sem TRAINER_PLAYED correspondente (efeito): passo próprio do mesmo preset.
          const player = p ?? viewer;
          const c = ctx.cards.get(str(d.cardId) ?? '') ?? null;
          const prev = ev.type === 'STADIUM_REPLACED' ? boardBefore(i).stadium : null;
          push(unit(ev.type === 'TOOL_ATTACHED' ? 'ATTACH_TOOL' : 'PLAY_STADIUM', [i], {
            kind: 'TRAINER', player, role: role(player), card: c, handKey: null, subtype: ev.type === 'TOOL_ATTACHED' ? 'TOOL' : 'STADIUM',
            targetEntityId: str(d.entityId), previousStadium: prev ? { cardId: prev.cardId, printingId: prev.printingId, definitionKey: prev.definitionKey } : null,
          }));
          break;
        }
        case 'ENERGY_ATTACHED': {
          const run = [i];
          for (let j = i + 1; j < to; j += 1) {
            const e = events[j]!;
            if (consumed[j] || e.type !== 'ENERGY_ATTACHED' || e.data.entityId !== d.entityId || e.data.source !== d.source || e.group !== ev.group) break;
            consumed[j] = true;
            run.push(j);
          }
          const player = p ?? viewer;
          push(unit('ATTACH_ENERGY', run, {
            kind: 'ENERGY', mode: 'ATTACH', player, role: role(player), energyType: str(d.energyType) ?? 'COLORLESS',
            energyIds: run.map((j) => str(events[j]!.data.energyId) ?? ''), fromEntityId: null, toEntityId: str(d.entityId), fromZone: d.source === 'ENERGY_ZONE',
          }));
          break;
        }
        case 'ENERGY_MOVED': {
          const player = p ?? viewer;
          push(unit('ATTACH_ENERGY', [i], {
            kind: 'ENERGY', mode: 'MOVE', player, role: role(player), energyType: str(d.energyType) ?? 'COLORLESS', energyIds: [str(d.energyId) ?? ''],
            fromEntityId: str(d.fromEntityId), toEntityId: str(d.toEntityId), fromZone: false,
          }));
          break;
        }
        case 'ENERGY_DISCARDED': {
          if (d.reason === 'LEFT_PLAY') { absorb(i); break; }
          const player = p ?? viewer;
          const list = Array.isArray(d.energies) ? (d.energies as { id?: string; type?: string }[]) : [];
          push(unit('ATTACH_ENERGY', [i], {
            kind: 'ENERGY', mode: 'DISCARD', player, role: role(player), energyType: list[0]?.type ?? 'COLORLESS',
            energyIds: list.map((x) => x.id ?? ''), fromEntityId: str(d.entityId), toEntityId: null, fromZone: false,
          }));
          break;
        }
        case 'POKEMON_KNOCKED_OUT': {
          const run = [i];
          for (let j = i + 1; j < to && events[j]!.type === 'POKEMON_KNOCKED_OUT' && !consumed[j]; j += 1) {
            consumed[j] = true;
            run.push(j);
          }
          const kos: Unit[] = run.map((j, k) => {
            const e = events[j]!;
            const player = pid(e.data.player) ?? viewer;
            const entityId = str(e.data.entityId) ?? '';
            const cardIds = Array.isArray(e.data.cardIds) ? (e.data.cardIds as string[]) : [];
            const absorbed: number[] = [];
            for (let m = run[run.length - 1]! + 1; m < to; m += 1) {
              const x = events[m]!;
              if (x.type === 'POINTS_GRANTED' || x.type === 'MATCH_ENDED' || x.type === 'DECISION_REQUESTED' || x.type === 'TURN_ENDING') break;
              if (consumed[m]) continue;
              const leftPlay = x.type === 'ENERGY_DISCARDED' && x.data.entityId === entityId;
              const discards = (x.type === 'CARD_DISCARDED' || x.type === 'CARD_RETURNED') && x.data.from !== 'HAND' && x.data.from !== 'DISCARD'
                && Array.isArray(x.data.cardIds) && (x.data.cardIds as string[]).some((c) => cardIds.includes(c));
              if (leftPlay || discards) {
                consumed[m] = true;
                absorbed.push(m);
              }
            }
            const before = boardBefore(i);
            const ent = findEntity(before, entityId);
            const u = unit('KNOCKOUT', [j], { kind: 'KNOCKOUT', player, role: role(player), entityId, slot: ent?.slot ?? null, cardIds }, { parallel: k > 0 });
            u.absorbed.push(...absorbed);
            return u;
          });
          push(...kos);
          // Pontos do mesmo grupo: depois de todos os Nocautes, em paralelo entre si.
          let first = true;
          for (let j = run[run.length - 1]! + 1; j < to; j += 1) {
            const e = events[j]!;
            if (consumed[j]) continue;
            if (e.type !== 'POINTS_GRANTED') break;
            consumed[j] = true;
            const player = pid(e.data.player) ?? viewer;
            push(unit('POINTS', [j], { kind: 'POINTS', player, role: role(player), points: num(e.data.points), total: num(e.data.total) }, { parallel: !first }));
            first = false;
          }
          break;
        }
        case 'POINTS_GRANTED': {
          const player = p ?? viewer;
          push(unit('POINTS', [i], { kind: 'POINTS', player, role: role(player), points: num(d.points), total: num(d.total) }));
          break;
        }
        case 'DAMAGE_APPLIED':
        case 'DAMAGE_PREVENTED':
        case 'HEAL_APPLIED':
        case 'CONDITION_APPLIED':
        case 'CONDITION_REMOVED': {
          const run = [i];
          for (let j = i + 1; j < to; j += 1) {
            const e = events[j]!;
            if (consumed[j] || e.type !== ev.type || e.group !== ev.group) break;
            consumed[j] = true;
            run.push(j);
          }
          push(...run.map((j, k) => {
            const e = events[j]!;
            if (e.type === 'HEAL_APPLIED') return unit('HEAL_FEEDBACK', [j], { kind: 'HEAL', entityId: str(e.data.entityId) ?? '', amount: num(e.data.amount) }, { parallel: k > 0 });
            if (e.type === 'CONDITION_APPLIED' || e.type === 'CONDITION_REMOVED') {
              return unit('STATUS_FEEDBACK', [j], { kind: 'STATUS', entityId: str(e.data.entityId) ?? '', condition: str(e.data.condition) ?? '', applied: e.type === 'CONDITION_APPLIED' }, { parallel: k > 0 });
            }
            return unit('DAMAGE_FEEDBACK', [j], damageData(e), { parallel: k > 0 });
          }));
          break;
        }
        case 'POKEMON_MOVED': {
          const player = p ?? viewer;
          const reason = d.reason === 'RETREAT' ? 'RETREAT' : d.reason === 'PROMOTE' ? 'PROMOTE' : 'SWITCH';
          const incomingId = str(d.entityId) ?? '';
          const fk = reason === 'PROMOTE' ? flairKey(options.attemptId, evId(i), 'PROMOTION', incomingId) : null;
          push(unit(reason, [i], {
            kind: 'MOVE_POKEMON', reason, player, role: role(player), incomingId, outgoingId: str(d.swappedEntityId), benchIndex: num(d.benchIndex), flairKey: fk,
          }, { flairKeys: fk ? [fk] : [] }));
          break;
        }
        case 'POKEMON_REMOVED': {
          const player = p ?? viewer;
          const entityId = str(d.entityId) ?? '';
          const ent = findEntity(boardBefore(i), entityId);
          const cardIds = ent ? [...ent.stack.map((c) => c.cardId), ...(ent.tool ? [ent.tool.cardId] : [])] : [];
          const absorbed: number[] = [];
          for (let m = i + 1; m < to; m += 1) {
            const x = events[m]!;
            if (consumed[m]) continue;
            const leftPlay = x.type === 'ENERGY_DISCARDED' && x.data.entityId === entityId;
            const moved = (x.type === 'CARD_DISCARDED' || x.type === 'CARD_RETURNED') && Array.isArray(x.data.cardIds) && (x.data.cardIds as string[]).some((c) => cardIds.includes(c));
            if (leftPlay || moved) {
              consumed[m] = true;
              absorbed.push(m);
            }
            if (moved) break;
          }
          const dest = str(d.destination) ?? 'DISCARD';
          const u = dest === 'DISCARD'
            ? unit('DISCARD', [i], { kind: 'DISCARD', player, role: role(player), cardIds, from: 'FIELD', entityId })
            : unit('RETURN_TO_HAND', [i], { kind: 'RETURN', player, role: role(player), cardIds, to: dest === 'DECK' ? 'DECK' : 'HAND', from: 'FIELD', entityId });
          u.absorbed.push(...absorbed);
          push(u);
          break;
        }
        case 'CARD_DISCARDED': {
          const player = p ?? viewer;
          const cardIds = Array.isArray(d.cardIds) ? (d.cardIds as (string | null)[]).map((c) => c ?? '') : [];
          const from = str(d.from) ?? 'HAND';
          const owner = from === 'FIELD'
            ? [boardBefore(i).sides[player].active, ...boardBefore(i).sides[player].bench].find((e) => !!e && e.stack.some((c) => cardIds.includes(c.cardId))) ?? null
            : null;
          push(unit('DISCARD', [i], { kind: 'DISCARD', player, role: role(player), cardIds, from, entityId: owner?.entityId ?? null }));
          break;
        }
        case 'TOOL_REMOVED': {
          const player = p ?? viewer;
          push(unit('DISCARD', [i], { kind: 'DISCARD', player, role: role(player), cardIds: [str(d.cardId) ?? ''], from: 'TOOL', entityId: str(d.entityId) }));
          break;
        }
        case 'CARD_RETURNED': {
          const player = p ?? viewer;
          const cardIds = Array.isArray(d.cardIds) ? (d.cardIds as (string | null)[]).map((c) => c ?? '') : [];
          push(unit('RETURN_TO_HAND', [i], { kind: 'RETURN', player, role: role(player), cardIds, to: d.to === 'DECK' ? 'DECK' : 'HAND', from: str(d.from) ?? 'FIELD', entityId: null }));
          break;
        }
        case 'CARD_HIDDEN': {
          const player = p ?? viewer;
          push(unit('RETURN_TO_HAND', [i], { kind: 'RETURN', player, role: role(player), cardIds: [], to: 'HAND', from: 'REVEAL', entityId: null }));
          break;
        }
        case 'DECK_SHUFFLED': {
          const player = p ?? viewer;
          push(unit('SHUFFLE', [i], { kind: 'SHUFFLE', player, role: role(player) }));
          break;
        }
        case 'ABILITY_TRIGGERED':
        case 'ABILITY_ACTIVATED': {
          const player = p ?? viewer;
          push(unit('ABILITY_FOCUS', [i], { kind: 'ABILITY', player, entityId: str(d.entityId) ?? '', abilityId: str(d.abilityId) }));
          break;
        }
        case 'MATCH_ENDED': {
          push(unit('RESULT_TRANSITION', [i], { kind: 'RESULT', result: boardAfterIdx(i).result }));
          break;
        }
        default: {
          const rule = ruleFor(ev.type);
          noops.push({ seq: ev.seq, type: ev.type, rule: rule.rule });
          absorb(i);
          break;
        }
      }
    }
    return { units, leftover: pending };
  }

  function damageData(e: BattleEvent): StepData {
    return {
      kind: 'DAMAGE', targetEntityId: str(e.data.targetEntityId) ?? '', amount: e.type === 'DAMAGE_PREVENTED' ? 0 : num(e.data.amount),
      prevented: e.type === 'DAMAGE_PREVENTED', category: str(e.data.category) ?? 'EFFECT',
    };
  }

  const top = scan(0, events.length);

  // ---------------------------------------------------------------------------------------- agenda
  const steps: PresentationStep[] = [];
  const scale = (ms: number) => scaleDuration(ms, options);
  let counter = 0;

  function anchorsFor(u: Unit, b0: PresentedBoard, b1: PresentedBoard): { source: string[]; target: string[] } {
    const d = u.data;
    const ent = (board: PresentedBoard, id: string | null) => (id ? entityAnchorId(board, id) : null);
    const list = (...xs: (string | null)[]) => xs.filter((x): x is string => !!x);
    switch (d.kind) {
      case 'DRAW': return { source: [`${d.role}_DECK_TOP`], target: [d.role === 'HUMAN' ? 'HUMAN_HAND' : 'NPC_HAND_ENTRY'] };
      case 'PLAY_POKEMON': return { source: [d.from === 'DECK' ? `${d.role}_DECK_TOP` : d.from === 'DISCARD' ? `${d.role}_DISCARD` : `${d.role}_HAND`], target: [slotAnchorId(d.role, d.slot)] };
      case 'EVOLVE': return { source: [`${d.role}_HAND`], target: list(ent(b1, d.entityId)) };
      case 'TRAINER': return { source: [`${d.role}_HAND`], target: d.subtype === 'STADIUM' ? ['STADIUM'] : d.subtype === 'TOOL' ? list(ent(b1, d.targetEntityId)) : [] };
      case 'ENERGY': return {
        source: d.fromZone ? [`${d.role}_ENERGY_READY`] : list(ent(b0, d.fromEntityId)),
        target: d.mode === 'DISCARD' ? [`${d.role}_DISCARD`] : list(ent(b1, d.toEntityId)),
      };
      case 'ATTACK': return { source: list(ent(b0, d.attackerId)), target: list(ent(b0, d.targetEntityId)) };
      case 'ABILITY': return { source: list(ent(b0, d.entityId)), target: [] };
      case 'DAMAGE': return { source: [], target: list(ent(b0, d.targetEntityId)) };
      case 'HEAL': case 'STATUS': return { source: [], target: list(ent(b0, d.entityId)) };
      case 'MOVE_POKEMON': return { source: list(ent(b0, d.incomingId), ent(b0, d.outgoingId)), target: list(ent(b1, d.incomingId), ent(b1, d.outgoingId)) };
      case 'KNOCKOUT': return { source: list(ent(b0, d.entityId)), target: [`${d.role}_DISCARD`] };
      case 'POINTS': return { source: [], target: [`${d.role}_POINTS`] };
      case 'DISCARD': return { source: list(d.from === 'HAND' ? `${d.role}_HAND` : d.from === 'DECK_TOP' ? `${d.role}_DECK_TOP` : ent(b0, d.entityId)), target: [`${d.role}_DISCARD`] };
      case 'RETURN': return { source: list(d.from === 'DISCARD' ? `${d.role}_DISCARD` : ent(b0, d.entityId)), target: [d.to === 'DECK' ? `${d.role}_DECK_TOP` : `${d.role}_HAND`] };
      case 'SHUFFLE': return { source: [`${d.role}_DECK_TOP`], target: [`${d.role}_DECK_TOP`] };
      default: return { source: [], target: [] };
    }
  }

  function emitStep(u: Unit, startMs: number, holds: StepHold[], parallelGroupId: string | undefined, reservedIndex?: number): PresentationStep {
    const all = [...u.events, ...u.absorbed].sort((a, b) => a - b);
    const first = all.length ? all[0]! : null;
    const lastIdx = all.length ? all[all.length - 1]! : null;
    const b0 = first === null ? boards[0]! : boardBefore(first);
    const b1 = lastIdx === null ? b0 : boardAfterIdx(lastIdx);
    const base = presetDurationMs(u.presetId);
    const duration = scale(base);
    const anchors = anchorsFor(u, b0, b1);
    const ownerOnly = u.events.some((i) => events[i]!.visibility === 'OWNER' && events[i]!.owner === viewer);
    const index = reservedIndex ?? counter;
    if (reservedIndex === undefined) counter += 1;
    const step: PresentationStep = {
      stepId: `step-${String(index).padStart(3, '0')}-${u.presetId}`,
      index,
      presetId: u.presetId,
      eventIds: u.events.map(evId),
      eventSeqs: all.map((i) => events[i]!.seq),
      sourceAnchorIds: anchors.source,
      targetAnchorIds: anchors.target,
      baseDurationMs: base,
      durationMs: duration,
      startMs,
      holds,
      spanMs: duration + holds.reduce((s, h) => s + h.durationMs, 0),
      ...(parallelGroupId ? { parallelGroupId } : {}),
      visibility: ownerOnly ? 'OWNER' : 'PUBLIC',
      finishPolicy: 'RECONCILE_CONFIRMED',
      motion,
      data: u.data,
      flairKeys: u.flairKeys,
      boardBefore: b0,
      boardAfter: b1,
    };
    steps.push(step);
    return step;
  }

  function schedule(units: readonly Unit[], startAt: number): number {
    let cursor = startAt;
    let groupStart = startAt;
    let groupId: string | undefined;
    units.forEach((u, k) => {
      const next = units[k + 1];
      const base = presetDurationMs(u.presetId);
      const dur = scale(base);
      const ratio = base > 0 ? dur / base : 0;
      let start: number;
      if (u.parallel) start = groupStart + u.offsetBaseMs * ratio;
      else {
        start = cursor;
        groupStart = start;
        groupId = next?.parallel || u.children.length ? `group-${counter}` : undefined;
      }
      const holds: StepHold[] = [];
      let holdTotal = 0;
      // O índice do passo-pai é reservado antes das inserções: a ordem estável (início, índice) mantém o
      // destaque do ataque antes das suas moedas também quando todas começam em 0 (Instantânea).
      const reserved = counter;
      counter += 1;
      if (u.inserts.length) {
        const holdAt = u.holdAtBaseMs * ratio;
        const end = schedule(u.inserts, start + holdAt);
        holdTotal = end - (start + holdAt);
        if (holdTotal > 0) holds.push({ atMs: holdAt, durationMs: holdTotal });
      }
      emitStep(u, start, holds, groupId, reserved);
      for (const child of u.children) {
        const childOffset = child.offsetBaseMs * ratio + (child.offsetBaseMs >= u.holdAtBaseMs && u.inserts.length ? holdTotal : 0);
        const childDur = scale(presetDurationMs(child.presetId));
        emitStep(child, start + childOffset, [], groupId);
        cursor = Math.max(cursor, start + childOffset + childDur);
      }
      cursor = Math.max(cursor, start + dur + holdTotal);
    });
    return cursor;
  }

  const totalMs = schedule(top.units, 0);
  steps.sort((a, b) => a.startMs - b.startMs || a.index - b.index);
  const finalBoard = projectBoard(after, events.length ? events[events.length - 1]!.seq : initial.lastSeq);

  return {
    attemptId: options.attemptId,
    batchId: options.batchId ?? `batch-${after.stateVersion}`,
    presentationVersion: PRESENTATION_VERSION,
    fromStateVersion: before.stateVersion,
    toStateVersion: after.stateVersion,
    firstEventSequence: events.length ? events[0]!.seq : 0,
    lastEventSequence: events.length ? events[events.length - 1]!.seq : 0,
    speed: options.speed,
    reducedMotion: options.reducedMotion,
    steps,
    totalMs,
    barrier: barrierOf(after),
    initialBoard: initial,
    finalBoard,
    noops,
  };
}

/** Presets usados por um plano (diagnóstico/testes). */
export function presetsOf(plan: PresentationPlan): PresetId[] {
  return plan.steps.map((s) => s.presetId);
}

