// Controlador de apresentação do duelo: aplica ações via aplicação (commit antes de apresentar),
// conduz a IA em passos, alimenta histórico/realces e delega a animação a um Presenter (2D ou 3D).
// Nenhuma regra é decidida aqui (interface §23.12; runtime R-071/R-072).
import { SPOTLIGHT_MS, type BattleToast, type EnergyGenInfo, type ScoringInfo, type SpotlightInfo, type TurnBannerInfo } from './pocket.tsx';
import { signal, type Signal } from '@preact/signals';
import { aiShouldAct, runAiStep, submitHumanAction, HUMAN, type BattleSession, type BattleUpdate } from '../../../application/battle.ts';
import type { GameContext } from '../../../application/context.ts';
import { redactEvents } from '../../../domain/battle/engine.ts';
import type { Action, BattleEvent, PlayerId } from '../../../domain/battle/types.ts';
import type { BattleView } from '../../../domain/battle/views.ts';
import { getPlayerView } from '../../../domain/battle/engine.ts';
import { faceOf } from '../components/cards.tsx';
import type { FloatingNumber } from './Board2D.tsx';
import { findEntity } from './affordances.ts';
import { describeEvents, type LogLine, type Names } from './log.ts';

export type Speed = 'NORMAL' | 'FAST' | 'INSTANT';

/** Apresenta um lote confirmado; resolve quando a mesa estiver reconciliada com `after`. */
export type Presenter = {
  readonly present: (update: BattleUpdate) => Promise<void>;
  readonly skip: () => void;
  readonly dispose: () => void;
};

export type CoinShown = { readonly faces: readonly ('HEADS' | 'TAILS')[]; readonly player: PlayerId | null; readonly key: number };

export type MatchController = {
  readonly session: BattleSession;
  readonly view: Signal<BattleView>;
  readonly log: Signal<readonly LogLine[]>;
  readonly busy: Signal<boolean>;
  readonly aiThinking: Signal<boolean>;
  readonly floating: Signal<readonly FloatingNumber[]>;
  /** Faixa de turno (gameplay-pocket §5.1): de quem é o turno e o número global; `key` distingue faixas seguidas. */
  readonly banner: Signal<TurnBannerInfo | null>;
  /** Moeda lançada: as faces da sequência e quem lança (a moeda equipada no deck dele aparece na mesa 2D). */
  readonly coin: Signal<CoinShown | null>;
  /** Tela “+1 ponto!” (gameplay-pocket §10.5). */
  readonly scoring: Signal<ScoringInfo | null>;
  /** Zona de Energia que acabou de gerar (gameplay-pocket §5.2): flash no prato e rótulo “Próxima Energia gerada”. */
  readonly energyGen: Signal<EnergyGenInfo | null>;
  /** Aviso transitório vindo do motor, como a compra pulada por deck vazio (gameplay-pocket §5.2). */
  readonly notice: Signal<BattleToast | null>;
  /** Prévia no centro da mesa 2D (compra, carta jogada, Treinador com dissolução); a mesa 3D desenha a sua. */
  readonly spotlight: Signal<SpotlightInfo | null>;
  readonly error: Signal<string | null>;
  readonly lastEvents: Signal<readonly BattleEvent[]>;
  readonly names: Names;
  submit: (action: Action) => Promise<boolean>;
  runAi: () => Promise<void>;
  setPresenter: (p: Presenter | null) => void;
  setSpeed: (s: Speed) => void;
  setReducedMotion: (on: boolean) => void;
  dispose: () => void;
};

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function createMatchController(game: GameContext, session: BattleSession, initialView: BattleView, history: readonly BattleEvent[]): MatchController {
  const content = game.content.get();
  const playerName = (p: PlayerId | null | undefined) => (p === HUMAN ? 'Você' : p ? 'Adversário' : '—');
  const names: Names = {
    card: (cardId) => {
      if (!cardId) return 'uma carta';
      const card = session.state.cards[cardId];
      return card ? faceOf(content, card.printingId)?.name ?? 'carta' : 'carta';
    },
    entity: (entityId) => {
      if (!entityId) return 'Pokémon';
      const e = findEntity(view.value, entityId);
      if (e) return faceOf(content, e.top.printingId)?.name ?? 'Pokémon';
      // Entidade que já saiu de jogo: procura no estado confirmado.
      for (const p of ['A', 'B'] as const) {
        const side = session.state.players[p];
        for (const ent of [side.active, ...side.bench]) if (ent?.entityId === entityId) return names.card(ent.stack[ent.stack.length - 1]);
      }
      return 'Pokémon';
    },
    player: playerName,
  };
  const view = signal(initialView);
  const log = signal<readonly LogLine[]>(describeEvents(redactEvents(history, HUMAN), names).slice(-200));
  const busy = signal(false);
  const aiThinking = signal(false);
  const floating = signal<readonly FloatingNumber[]>([]);
  const banner = signal<TurnBannerInfo | null>(null);
  const coin = signal<CoinShown | null>(null);
  const scoring = signal<ScoringInfo | null>(null);
  const energyGen = signal<EnergyGenInfo | null>(null);
  const spotlight = signal<SpotlightInfo | null>(null);
  const notice = signal<BattleToast | null>(null);
  const error = signal<string | null>(null);
  const lastEvents = signal<readonly BattleEvent[]>([]);
  let presenter: Presenter | null = null;
  let speed: Speed = 'NORMAL';
  let reduced = false;
  let disposed = false;

  const scale = () => (speed === 'INSTANT' ? 0 : speed === 'FAST' ? 0.55 : 1);

  /** Apresentação 2D mínima: números flutuantes, faixa de turno e moeda, com tempo por velocidade. */
  const present2d = async (update: BattleUpdate) => {
    const nums: FloatingNumber[] = [];
    const generated: ('HUMAN' | 'NPC')[] = [];
    for (const e of update.events) {
      const d = e.data as Record<string, unknown>;
      if (e.type === 'DAMAGE_APPLIED') nums.push({ entityId: d.targetEntityId as string, text: `−${d.amount as number}`, kind: 'damage' });
      if (e.type === 'HEAL_APPLIED') nums.push({ entityId: d.entityId as string, text: `+${d.amount as number}`, kind: 'heal' });
      if (e.type === 'TURN_STARTED') banner.value = { role: d.player === HUMAN ? 'HUMAN' : 'NPC', turn: (d.globalTurnNumber as number) ?? null, key: Date.now() };
      if (e.type === 'COIN_RESOLVED') {
        coin.value = { faces: ((d.results as string[]) ?? []).map((r) => (r === 'TAILS' ? 'TAILS' : 'HEADS')), player: (d.player as PlayerId | null) ?? null, key: Date.now() };
      }
      if (e.type === 'ENERGY_ZONE_UPDATED' && d.generated === true) generated.push(d.player === HUMAN ? 'HUMAN' : 'NPC');
      if (e.type === 'POINTS_GRANTED') {
        const shown: ScoringInfo = { role: d.player === HUMAN ? 'HUMAN' : 'NPC', points: d.points as number, total: d.total as number, pointsToWin: update.after.pointsToWin, key: Date.now() };
        scoring.value = shown;
        setTimeout(() => { if (scoring.value === shown) scoring.value = null; }, reduced ? 900 : 2500);
      }
    }
    if (nums.length) floating.value = nums;
    view.value = update.after;
    // Prévias no centro (gameplay-pocket §5.2, §9), uma de cada vez e depois da faixa de turno do mesmo lote.
    const spots = reduced || speed === 'INSTANT' ? [] : spotlightsOf(update.events);
    if (spots.length && update.events.some((e) => e.type === 'TURN_STARTED')) await wait(1000 * scale());
    for (const spot of spots) {
      const shown: SpotlightInfo = { ...spot, key: Date.now() + Math.random() };
      spotlight.value = shown;
      await wait(SPOTLIGHT_MS[spot.mode] * scale());
      if (spotlight.value === shown) spotlight.value = null;
    }
    // Energia gerada depois da compra (ordem do turno, gameplay-pocket §5.2).
    for (const role of generated) showEnergyGen(role);
    const base = update.actor === HUMAN ? 250 : 600;
    // A moeda gira ~0,5 s antes de “Cara!”/“Coroa!”: fica um pouco mais que os números.
    const ms = Math.max(coin.value ? 1100 : nums.length ? 900 : 0, base) * scale() * (reduced ? 0.5 : 1);
    if (ms > 0) await wait(ms);
    floating.value = [];
    coin.value = null;
    const shown = banner.value;
    // Turno 1: “Pronto? Já!” antes da faixa, por isso fica mais tempo.
    if (shown) setTimeout(() => { if (banner.value === shown) banner.value = null; }, (reduced ? 600 : 1200) + (shown.turn === 1 ? (reduced ? 300 : 900) : 0));
  };

  const printingOf = (cardId: unknown): string | null => (typeof cardId === 'string' ? session.state.cards[cardId]?.printingId ?? null : null);
  /** Compra única do jogador, Pokémon jogado da mão e Treinador (dos dois lados) viram prévias no centro da mesa 2D. */
  const spotlightsOf = (events: readonly BattleEvent[]): Omit<SpotlightInfo, 'key'>[] => {
    const out: Omit<SpotlightInfo, 'key'>[] = [];
    const draws = events.filter((e) => e.type === 'CARD_DRAWN' && e.data.player === HUMAN);
    for (const e of events) {
      const d = e.data as Record<string, unknown>;
      const printingId = printingOf(d.cardId);
      if (!printingId) continue;
      if (e.type === 'CARD_DRAWN' && draws.length === 1 && e === draws[0]) out.push({ printingId, mode: 'DRAW', subtype: null });
      if (e.type === 'POKEMON_ENTERED' && d.from === 'HAND') out.push({ printingId, mode: 'PLAY', subtype: null });
      if (e.type === 'TRAINER_PLAYED' && !d.fossil) out.push({ printingId, mode: 'TRAINER', subtype: typeof d.subtype === 'string' ? d.subtype : 'ITEM' });
    }
    return out;
  };

  const showEnergyGen = (role: 'HUMAN' | 'NPC') => {
    const shown: EnergyGenInfo = { role, key: Date.now() + Math.random() };
    energyGen.value = shown;
    setTimeout(() => { if (energyGen.value === shown) energyGen.value = null; }, reduced ? 900 : 1500);
  };

  /** Compra pulada do jogador (DRAW_SKIPPED): aviso no topo depois da faixa e da apresentação do lote. */
  const showSkippedDraw = (events: readonly BattleEvent[]) => {
    const skip = events.find((e) => e.type === 'DRAW_SKIPPED' && e.data.player === HUMAN);
    if (!skip) return;
    const text = skip.data.reason === 'HAND_FULL' ? 'Mão cheia: não é possível comprar.' : 'Sem cartas no deck: não é possível comprar.';
    const shown: BattleToast = { text, tone: 'info' };
    notice.value = shown;
    setTimeout(() => { if (notice.value === shown) notice.value = null; }, 2600);
  };

  const apply = async (update: BattleUpdate) => {
    lastEvents.value = update.events;
    log.value = [...log.value, ...describeEvents(update.events, names)].slice(-200);
    if (presenter) {
      await presenter.present(update);
      view.value = update.after;
    } else {
      await present2d(update);
    }
    showSkippedDraw(update.events);
  };

  const submit = async (action: Action): Promise<boolean> => {
    if (busy.value || session.result) return false;
    busy.value = true;
    error.value = null;
    try {
      const r = await submitHumanAction(game, session, action);
      if (!r.ok) {
        error.value = r.code === 'SAVE_WRITE_FAILED' || r.code === 'STORAGE_FULL'
          ? 'Não foi possível gravar a jogada. Nada foi alterado; tente novamente.'
          : r.message ?? 'Ação recusada pelas regras.';
        return false;
      }
      await apply(r.update);
      return true;
    } finally {
      busy.value = false;
    }
  };

  const runAi = async () => {
    if (aiThinking.value || disposed) return;
    aiThinking.value = true;
    error.value = null;
    try {
      while (!disposed && aiShouldAct(session)) {
        const r = await runAiStep(game, session);
        if (!r.ok) {
          // Plano obsoleto (o jogador agiu enquanto a IA pensava, ex.: confirmou a preparação antes da IA): replaneja
          // com o estado novo. Sem isso, a tela já reagiu à jogada e ninguém chamaria a IA de novo — o duelo travava.
          if (r.code === 'AI_JOB_STALE') continue;
          if (r.code === 'NOT_YOUR_TURN') break;
          error.value = r.message ?? 'A IA local não conseguiu jogar. O duelo está salvo; tente retomar.';
          break;
        }
        await apply(r.update);
      }
    } catch (e) {
      error.value = `A IA local falhou: ${String((e as Error)?.message ?? e)}. O duelo está salvo.`;
    } finally {
      aiThinking.value = false;
    }
  };

  return {
    session, view, log, busy, aiThinking, floating, banner, coin, scoring, energyGen, notice, spotlight, error, lastEvents, names, submit, runAi,
    setPresenter: (p) => { presenter?.dispose(); presenter = p; },
    setSpeed: (s) => { speed = s; },
    setReducedMotion: (on) => { reduced = on; },
    dispose: () => { disposed = true; session.paused = true; presenter?.dispose(); presenter = null; },
  };
}

export function humanView(game: GameContext, session: BattleSession): BattleView {
  return getPlayerView(session.state, game.content.get().catalog, HUMAN);
}
