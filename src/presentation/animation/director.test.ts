// Diretor: reprodução completa e skip em qualquer ponto terminam na mesma projeção reconciliada nos
// quatro modos (R-075); skip idempotente; tokens de geração descartam callbacks antigos; relógio de
// apresentação sem saltos após aba oculta; flair idempotente.
import { describe, expect, it } from 'vitest';
import { starterCatalog, starterDeck } from '../../tests/support/starter-catalog.ts';
import { buildDemoBattle } from '../three/harness/demo-battle.ts';
import { projectBoard, type PresentedBoard } from './board-model.ts';
import { createPresentationClock } from './clock.ts';
import { createDirector, stepLocalTime, type DirectorHandlers } from './director.ts';
import { createFlairRegistry, flairKey } from './flair.ts';
import { planPresentation, type PlanOptions, type PresentationPlan } from './plan.ts';
import { describeWith, fuzzBatches, type Batch } from './test-support.ts';
import { applyAction, getLegalActions, getPlayerView, redactEvents } from '../../domain/battle/engine.ts';
import { createMatch } from '../../domain/battle/setup.ts';
import type { MatchState } from '../../domain/battle/types.ts';
import { jcsHash } from '../../domain/hash/jcs.ts';
import { seedRng, uniformInt } from '../../domain/random/rng.ts';

type Run = { presented: PresentedBoard; hud: PresentedBoard; cursor: number; begun: string[]; ended: string[]; reason: string; elapsed: number };

/**
 * Espelho mínimo do palco: o HUD avança com o `boardAfter` de cada passo terminado (nunca para trás);
 * o fim (normal ou skip) reconcilia com `finalBoard`. Ignora callbacks de geração antiga.
 */
function play(plan: PresentationPlan, skipAtMs: number | null, frameMs = 16): Run {
  const director = createDirector();
  const run: Run = { presented: plan.initialBoard, hud: plan.initialBoard, cursor: 0, begun: [], ended: [], reason: '', elapsed: 0 };
  const handlers: DirectorHandlers = {
    begin: (s, info) => {
      if (director.isCurrent(info.generation)) run.begun.push(s.stepId);
    },
    update: (s, p) => {
      expect(p.u).toBeGreaterThanOrEqual(0);
      expect(p.u).toBeLessThanOrEqual(1);
      expect(p.localMs).toBeLessThanOrEqual(s.durationMs + 1e-6);
    },
    end: (s, info) => {
      if (!director.isCurrent(info.generation)) return;
      run.ended.push(s.stepId);
      if (s.boardAfter.lastSeq >= run.hud.lastSeq) run.hud = s.boardAfter;
    },
    complete: (p, reason) => {
      run.reason = reason;
      run.presented = p.finalBoard;
      run.hud = p.finalBoard;
    },
  };
  void director.start(plan, handlers);
  let t = 0;
  while (director.isRunning() && t < 600000) {
    if (skipAtMs !== null && t >= skipAtMs) {
      director.skipToBarrier();
      director.skipToBarrier();
      break;
    }
    director.advance(frameMs);
    t += frameMs;
  }
  // Skip depois do fim é no-op idempotente.
  const endedBefore = run.ended.length;
  director.skipToBarrier();
  expect(run.ended.length).toBe(endedBefore);
  run.cursor = director.cursor();
  run.elapsed = director.elapsedMs();
  return run;
}

const MODES: readonly (Pick<PlanOptions, 'speed' | 'reducedMotion'> & { label: string })[] = [
  { label: 'Normal', speed: 'NORMAL', reducedMotion: false },
  { label: 'Rápida', speed: 'FAST', reducedMotion: false },
  { label: 'Instantânea', speed: 'INSTANT', reducedMotion: false },
  { label: 'Movimento reduzido', speed: 'NORMAL', reducedMotion: true },
];

const demo = buildDemoBattle('A');
const demoDescribe = describeWith(demo.catalog);
const demoBatches: { label: string; batch: Batch; newAttempt: boolean }[] = [
  { label: demo.opening.label, batch: demo.opening, newAttempt: true },
  ...demo.script.map((b) => ({ label: b.label, batch: b as Batch, newAttempt: false })),
];

describe.each(MODES)('reconciliação no modo $label (R-075)', (mode) => {
  it.each(demoBatches.map((d) => [d.label, d] as const))('%s: skip em qualquer ponto = reprodução completa', (_label, d) => {
    const plan = planPresentation(d.batch.events, d.batch.before, d.batch.after, { attemptId: 'r', ...mode, newAttempt: d.newAttempt, describeCard: demoDescribe });
    const full = play(plan, null);
    const confirmed = projectBoard(d.batch.after, plan.lastEventSequence);
    expect(full.presented).toEqual(confirmed);
    expect(full.hud).toEqual(confirmed);
    expect(full.cursor).toBe(plan.lastEventSequence);
    expect(full.reason).toBe('FINISHED');
    // Cada passo começa e termina exatamente uma vez (cues e histórico não duplicam nem somem).
    expect(new Set(full.ended).size).toBe(plan.steps.length);
    expect(full.ended).toHaveLength(plan.steps.length);
    const points = plan.totalMs > 0 ? [0, 1, plan.totalMs * 0.25, plan.totalMs * 0.5, plan.totalMs * 0.9, Math.max(0, plan.totalMs - 1)] : [0];
    for (const at of points) {
      const skipped = play(plan, at);
      expect(skipped.presented, `skip @${at}`).toEqual(full.presented);
      expect(skipped.hud).toEqual(full.hud);
      expect(skipped.cursor).toBe(full.cursor);
      expect([...skipped.ended].sort()).toEqual([...full.ended].sort());
    }
  });
});

describe('reconciliação em lotes de partidas completas (fuzz)', () => {
  const cat = starterCatalog();
  const describeCard = describeWith(cat);
  const batches = fuzzBatches(cat, [5, 17]).filter((b) => b.events.length > 0);

  it.each(MODES)('modo $label: skip no meio = fim normal = projeção do after', (mode) => {
    for (const b of batches) {
      const plan = planPresentation(b.events, b.before, b.after, { attemptId: 'f', ...mode, describeCard });
      const full = play(plan, null, 33);
      const mid = play(plan, plan.totalMs / 2, 33);
      expect(mid.presented).toEqual(full.presented);
      expect(full.presented).toEqual(projectBoard(b.after, plan.lastEventSequence));
    }
  });
});

describe('diretor', () => {
  const b = demo.script[3]!;
  const plan = planPresentation(b.events, b.before, b.after, { attemptId: 'g', speed: 'NORMAL', reducedMotion: false, describeCard: demoDescribe });
  const plan2 = planPresentation(demo.script[2]!.events, demo.script[2]!.before, demo.script[2]!.after, { attemptId: 'g', speed: 'NORMAL', reducedMotion: false, describeCard: demoDescribe });

  it('token de geração: callbacks de um plano substituído são reconhecidos como antigos', async () => {
    const director = createDirector();
    const calls: string[] = [];
    let staleInfo: { generation: number } | null = null;
    const handlers = (tag: string): DirectorHandlers => ({
      begin: (_s, info) => {
        if (tag === 'A' && !staleInfo) staleInfo = info;
        if (director.isCurrent(info.generation)) calls.push(`${tag}:begin`);
      },
      update: (_s, _p, info) => {
        if (director.isCurrent(info.generation)) calls.push(`${tag}:update`);
      },
      end: () => undefined,
      complete: (_p, reason, info) => calls.push(`${tag}:complete:${reason}:${director.isCurrent(info.generation)}`),
    });
    const first = director.start(plan, handlers('A'));
    director.advance(200);
    const genA = director.generation();
    const second = director.start(plan2, handlers('B'));
    expect(await first).toBe('SKIPPED');
    expect(director.isCurrent(genA)).toBe(false);
    expect(director.isCurrent(staleInfo!.generation)).toBe(false);
    expect(director.generation()).toBe(genA + 1);
    // Um callback agendado pelo plano A depois da troca é ignorado pelo filtro de geração.
    calls.length = 0;
    director.advance(50);
    expect(calls.every((c) => c.startsWith('B:'))).toBe(true);
    director.cancel();
    expect(await second).toBe('CANCELLED');
    expect(director.isRunning()).toBe(false);
  });

  it('pausa congela o tempo de apresentação; retomar continua do mesmo ponto', () => {
    const director = createDirector();
    const noop: DirectorHandlers = { begin: () => undefined, update: () => undefined, end: () => undefined, complete: () => undefined };
    void director.start(plan, noop);
    director.advance(300);
    director.pause();
    director.advance(5000);
    expect(director.elapsedMs()).toBe(300);
    director.resume();
    director.advance(100);
    expect(director.elapsedMs()).toBe(400);
    director.skipToBarrier();
    expect(director.isRunning()).toBe(false);
  });

  it('plano Instantâneo termina na largada com poses finais e cursor no último evento', async () => {
    const instant = planPresentation(b.events, b.before, b.after, { attemptId: 'g', speed: 'INSTANT', reducedMotion: false, describeCard: demoDescribe });
    const director = createDirector();
    let final: PresentedBoard | null = null;
    const done = director.start(instant, { begin: () => undefined, update: () => undefined, end: () => undefined, complete: (p) => { final = p.finalBoard; } });
    expect(await done).toBe('FINISHED');
    expect(final).toEqual(projectBoard(b.after, instant.lastEventSequence));
    expect(director.cursor()).toBe(instant.lastEventSequence);
  });

  it('stepLocalTime congela o preset durante a espera das moedas', () => {
    const atk = plan.steps.find((s) => s.holds.length)!;
    const hold = atk.holds[0]!;
    const before = stepLocalTime(atk, atk.startMs + hold.atMs - 10);
    const during = stepLocalTime(atk, atk.startMs + hold.atMs + hold.durationMs / 2);
    const after = stepLocalTime(atk, atk.startMs + hold.atMs + hold.durationMs + 10);
    expect(before.holding).toBe(false);
    expect(during.holding).toBe(true);
    expect(during.localMs).toBeCloseTo(hold.atMs);
    expect(after.localMs).toBeCloseTo(hold.atMs + 10);
    expect(stepLocalTime(atk, atk.startMs + atk.spanMs + 100).u).toBe(1);
  });
});

describe('relógio de apresentação', () => {
  it('delta acima do limite (aba oculta) vira um frame comum; pausa devolve zero', () => {
    const clock = createPresentationClock();
    expect(clock.tick(1000)).toBe(0);
    expect(clock.tick(1016)).toBe(16);
    expect(clock.tick(1016 + 120000)).toBeCloseTo(1000 / 60);
    clock.pause();
    expect(clock.tick(200000)).toBe(0);
    clock.resume();
    expect(clock.tick(500000)).toBe(0);
    expect(clock.tick(500020)).toBe(20);
    expect(clock.tick(400000)).toBe(0);
  });
});

describe('flair idempotente', () => {
  it('a mesma chave só toca uma vez, mesmo após reconstrução de mesh ou replanejamento', () => {
    const registry = createFlairRegistry();
    const key = flairKey('attempt-1', 'event-0007', 'ENTRY', 'ent-3');
    expect(key).toBe('attempt-1:event-0007:ENTRY:ent-3');
    expect(registry.tryPlay(key)).toBe(true);
    expect(registry.tryPlay(key)).toBe(false);
    expect(registry.tryPlay(flairKey('attempt-1', 'event-0007', 'ENTRY', 'ent-3'))).toBe(false);
    expect(registry.tryPlay(flairKey('attempt-2', 'event-0007', 'ENTRY', 'ent-3'))).toBe(true);
    registry.markPresented(['x:y:PROMOTION:z']);
    expect(registry.tryPlay('x:y:PROMOTION:z')).toBe(false);
  });

  it('limite do registro descarta as chaves mais antigas', () => {
    const registry = createFlairRegistry(3);
    ['a', 'b', 'c', 'd'].forEach((k) => registry.tryPlay(k));
    expect(registry.size()).toBe(3);
    expect(registry.has('a')).toBe(false);
  });
});

describe('apresentação só lê projeções confirmadas (R-033, R-072, R-075, G-075, G-085)', () => {
  const cat = starterCatalog();
  const describeCard = describeWith(cat);

  /** Partida real por ações legais aleatórias guardando o estado de regras completo de cada lote. */
  function confirmedBatches(seed: number): { state: MatchState; batch: Batch }[] {
    const out: { state: MatchState; batch: Batch }[] = [];
    let state = createMatch({ matchId: `apres-${seed}`, seed, players: { A: starterDeck(cat, 'FIRE'), B: starterDeck(cat, 'GRASS') } }, cat).state;
    let rng = seedRng(seed);
    for (let steps = 0; !state.result && steps < 3000; steps += 1) {
      const pending = state.pendingDecisions.filter((d) => !d.answered);
      const actor = pending.length ? pending[0]!.player : state.currentPlayer;
      const legal = getLegalActions(state, cat, actor);
      const pick = uniformInt(rng, legal.length);
      rng = pick.rng;
      const r = applyAction(state, cat, legal[pick.value]!);
      if (!r.ok) throw new Error(r.code);
      out.push({ state: r.state, batch: { events: redactEvents(r.events, 'A'), before: getPlayerView(state, cat, 'A'), after: getPlayerView(r.state, cat, 'A') } });
      state = r.state;
    }
    return out;
  }

  it('R-075/R-033/G-075: reproduzir, pular e replanejar nos quatro modos não altera o estado de regras nem consome sorteios', () => {
    const batches = confirmedBatches(23).filter((b) => b.batch.events.length > 0);
    expect(batches.length).toBeGreaterThan(20);
    for (const { state, batch } of batches) {
      const hash = jcsHash(state);
      const rng = JSON.stringify(state.rng);
      const views = JSON.stringify([batch.before, batch.after]);
      expect(views).not.toContain('"rng"');
      for (const mode of MODES) {
        const plan = planPresentation(batch.events, batch.before, batch.after, { attemptId: 'r', ...mode, describeCard });
        play(plan, null, 33);
        play(plan, plan.totalMs / 3, 33);
      }
      expect(jcsHash(state)).toBe(hash);
      expect(JSON.stringify(state.rng)).toBe(rng);
      expect(JSON.stringify([batch.before, batch.after])).toBe(views);
    }
  });

  it('R-072/G-085: pular um lote para na decisão pendente, mantém a próxima decisão e não inventa resposta', () => {
    const withDecision = confirmedBatches(31).filter((b) => b.batch.after.decisions.some((d) => !d.answered));
    expect(withDecision.length).toBeGreaterThan(0);
    for (const { state, batch } of withDecision) {
      const plan = planPresentation(batch.events, batch.before, batch.after, { attemptId: 'b', speed: 'NORMAL', reducedMotion: false, describeCard });
      expect(plan.barrier).toBe('PENDING_DECISION');
      const skipped = play(plan, 0);
      const pending = batch.after.decisions.find((d) => !d.answered)!;
      expect(skipped.presented.pendingDecision).toEqual({ player: pending.player, kind: pending.kind });
      expect(skipped.cursor).toBe(plan.lastEventSequence);
      // O estado confirmado continua com a mesma decisão em aberto: o skip não respondeu nada.
      expect(state.pendingDecisions.filter((d) => !d.answered).map((d) => d.decisionId)).toContain(pending.decisionId);
    }
  });
});
