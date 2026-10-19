// planPresentation: todo tipo de BattleEvent tem preset ou no-op documentado; todo evento de um lote é
// apresentado, absorvido ou listado como no-op; a projeção final é sempre a do `after` confirmado.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { starterCatalog } from '../../tests/support/starter-catalog.ts';
import { buildDemoBattle } from '../three/harness/demo-battle.ts';
import { projectBoard } from './board-model.ts';
import { PRESET_IDS } from './catalog.ts';
import { EVENT_PRESET_RULES, ruleFor } from './event-map.ts';
import { planPresentation, presetsOf, type PlanOptions, type PresentationPlan } from './plan.ts';
import { describeWith, fuzzBatches, type Batch } from './test-support.ts';

const DOMAIN_DIR = fileURLToPath(new URL('../../domain/', import.meta.url));

/** Tipos de evento emitidos pelo motor (varre `emit(ctx, 'TIPO'`). */
function emittedEventTypes(): string[] {
  const types = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = `${dir}${entry.name}`;
      if (entry.isDirectory()) walk(`${path}/`);
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        for (const m of readFileSync(path, 'utf8').matchAll(/emit\(\s*\w+,\s*'([A-Z_]+)'/g)) types.add(m[1]!);
      }
    }
  };
  walk(DOMAIN_DIR);
  return [...types].sort();
}

const MODES: readonly (Pick<PlanOptions, 'speed' | 'reducedMotion'> & { label: string })[] = [
  { label: 'Normal', speed: 'NORMAL', reducedMotion: false },
  { label: 'Rápida', speed: 'FAST', reducedMotion: false },
  { label: 'Instantânea', speed: 'INSTANT', reducedMotion: false },
  { label: 'Movimento reduzido', speed: 'NORMAL', reducedMotion: true },
];

function assertPlanInvariants(plan: PresentationPlan, batch: Batch): void {
  const covered = new Set<number>();
  for (const s of plan.steps) {
    expect(PRESET_IDS).toContain(s.presetId);
    expect(s.startMs).toBeGreaterThanOrEqual(0);
    expect(s.startMs + s.spanMs).toBeLessThanOrEqual(plan.totalMs + 1e-6);
    expect(s.finishPolicy).toBe('RECONCILE_CONFIRMED');
    s.eventSeqs.forEach((q) => covered.add(q));
  }
  for (const n of plan.noops) covered.add(n.seq);
  for (const e of batch.events) expect(covered.has(e.seq), `evento ${e.seq} ${e.type} sem passo nem no-op`).toBe(true);
  const last = batch.events.length ? batch.events[batch.events.length - 1]!.seq : plan.initialBoard.lastSeq;
  expect(plan.finalBoard).toEqual(projectBoard(batch.after, last));
}

describe('mapa evento → preset (interface §36.2.1)', () => {
  it('todo tipo emitido pelo motor tem regra explícita (preset ou no-op documentado)', () => {
    const types = emittedEventTypes();
    expect(types.length).toBeGreaterThan(40);
    for (const t of types) {
      expect(EVENT_PRESET_RULES[t], `sem regra para ${t}`).toBeDefined();
      const rule = ruleFor(t);
      expect(rule.rule.length).toBeGreaterThan(3);
      if (rule.kind !== 'NOOP') for (const p of rule.presets) expect(PRESET_IDS).toContain(p);
    }
  });

  it('tipo desconhecido vira no-op de reconciliação (nunca exceção)', () => {
    expect(ruleFor('ALGO_NOVO').kind).toBe('NOOP');
  });
});

describe('planPresentation na batalha de demonstração (motor real)', () => {
  const demo = buildDemoBattle('A');
  const describeCard = describeWith(demo.catalog);

  it('roteiro: compra, Básico, Energia, ataque com moedas, Nocaute e pontos usam os presets canônicos', () => {
    const plans = demo.script.map((b) => planPresentation(b.events, b.before, b.after, { attemptId: 't', speed: 'NORMAL', reducedMotion: false, describeCard }));
    const all = plans.flatMap(presetsOf);
    for (const p of ['TURN_BANNER', 'DRAW_SELF', 'PLAY_SPECIAL', 'ATTACH_ENERGY', 'ATTACK_STANDARD', 'COIN_FIRST', 'COIN_NEXT', 'KNOCKOUT', 'POINTS']) {
      expect(all, p).toContain(p);
    }
    const attack = plans[3]!;
    const atk = attack.steps.find((s) => s.presetId === 'ATTACK_STANDARD')!;
    const coins = attack.steps.filter((s) => s.presetId.startsWith('COIN_'));
    // Moedas inseridas no destaque do ataque: o passo segura (hold) enquanto elas giram.
    expect(atk.holds).toHaveLength(1);
    for (const c of coins) {
      expect(c.startMs).toBeGreaterThanOrEqual(atk.startMs);
      expect(c.startMs + c.durationMs).toBeLessThanOrEqual(atk.startMs + atk.spanMs);
    }
    const ko = attack.steps.find((s) => s.presetId === 'KNOCKOUT')!;
    const pts = attack.steps.find((s) => s.presetId === 'POINTS')!;
    expect(pts.startMs).toBeGreaterThanOrEqual(ko.startMs + ko.durationMs);
    expect(attack.barrier).toBe('READY_FOR_ACTION');
    plans.forEach((p, i) => assertPlanInvariants(p, demo.script[i]!));
  });

  it('abertura de tentativa nova: BOARD_INTRO antes da distribuição; retomada não repete', () => {
    const o = demo.opening;
    const fresh = planPresentation(o.events, o.before, o.after, { attemptId: 't', speed: 'NORMAL', reducedMotion: false, newAttempt: true, describeCard });
    const resumed = planPresentation(o.events, o.before, o.after, { attemptId: 't', speed: 'NORMAL', reducedMotion: false, newAttempt: false, describeCard });
    expect(presetsOf(fresh).slice(0, 2)).toEqual(['BOARD_INTRO', 'INITIAL_DEAL']);
    expect(presetsOf(resumed)).not.toContain('BOARD_INTRO');
    expect(presetsOf(fresh)).toContain('SETUP_REVEAL');
  });

  it.each(MODES)('modo $label: durações escaladas e mesma sequência de presets', (mode) => {
    const b = demo.script[3]!;
    const normal = planPresentation(b.events, b.before, b.after, { attemptId: 't', speed: 'NORMAL', reducedMotion: false, describeCard });
    const plan = planPresentation(b.events, b.before, b.after, { attemptId: 't', ...mode, describeCard });
    expect(presetsOf(plan)).toEqual(presetsOf(normal));
    if (mode.speed === 'INSTANT') expect(plan.totalMs).toBe(0);
    else expect(plan.totalMs).toBeLessThanOrEqual(normal.totalMs);
    if (mode.reducedMotion) for (const s of plan.steps) expect(s.durationMs).toBeLessThanOrEqual(150);
    if (mode.speed === 'FAST') for (const s of plan.steps) expect(s.durationMs === 0 || s.durationMs >= Math.min(80, s.baseDurationMs)).toBe(true);
    assertPlanInvariants(plan, b);
  });

  it('é puro e determinístico (mesma entrada → mesmo plano)', () => {
    const b = demo.script[3]!;
    const a = planPresentation(b.events, b.before, b.after, { attemptId: 't', speed: 'NORMAL', reducedMotion: false, describeCard });
    const c = planPresentation(b.events, b.before, b.after, { attemptId: 't', speed: 'NORMAL', reducedMotion: false, describeCard });
    expect(JSON.stringify(a)).toBe(JSON.stringify(c));
  });

  it('flair: chaves idempotentes `attemptId:eventId:effectLayer:entityId` iguais entre replanejamentos', () => {
    const b = demo.script[1]!;
    const a = planPresentation(b.events, b.before, b.after, { attemptId: 'att-1', speed: 'NORMAL', reducedMotion: false, describeCard });
    const keys = a.steps.flatMap((s) => s.flairKeys);
    expect(keys.length).toBeGreaterThan(0);
    for (const k of keys) expect(k).toMatch(/^att-1:event-\d{4}:(ENTRY|EVOLUTION|PROMOTION):.+$/);
    const again = planPresentation(b.events, b.before, b.after, { attemptId: 'att-1', speed: 'FAST', reducedMotion: true, describeCard });
    expect(again.steps.flatMap((s) => s.flairKeys)).toEqual(keys);
  });
});

describe('planPresentation em partidas completas (fuzz do motor, visão do humano)', () => {
  const cat = starterCatalog();
  const describeCard = describeWith(cat);
  const batches = fuzzBatches(cat, [3, 11, 29]);

  it('cobre muitos tipos de evento e mantém os invariantes em todo lote', () => {
    const seen = new Set<string>();
    for (const b of batches) {
      for (const e of b.events) seen.add(e.type);
      const plan = planPresentation(b.events, b.before, b.after, { attemptId: 'fz', speed: 'NORMAL', reducedMotion: false, describeCard });
      assertPlanInvariants(plan, b);
    }
    for (const t of seen) expect(EVENT_PRESET_RULES[t], t).toBeDefined();
    for (const t of ['TURN_STARTED', 'CARD_DRAWN', 'POKEMON_ENTERED', 'ENERGY_ATTACHED', 'ATTACK_DECLARED', 'DAMAGE_APPLIED', 'POKEMON_KNOCKED_OUT', 'POINTS_GRANTED', 'MATCH_ENDED']) {
      expect(seen, t).toContain(t);
    }
  });

  it('R-071/R-050/UI-036: HP muda só no passo do impacto; o resultado só aparece depois de todo o grupo de Nocautes e pontos', () => {
    let impacts = 0;
    let endings = 0;
    const damages = (board: PresentationPlan['initialBoard']) => {
      const out = new Map<string, number>();
      for (const side of Object.values(board.sides)) for (const e of [side.active, ...side.bench]) if (e) out.set(e.entityId, e.damage);
      return out;
    };
    for (const b of batches) {
      const plan = planPresentation(b.events, b.before, b.after, { attemptId: 'fz', speed: 'NORMAL', reducedMotion: false, describeCard });
      const typeOf = new Map(b.events.map((e) => [e.seq, e.type]));
      for (const step of plan.steps) {
        const types = new Set(step.eventSeqs.map((seq) => typeOf.get(seq)));
        const before = damages(step.boardBefore);
        const changed = [...damages(step.boardAfter)].some(([id, d]) => before.has(id) && before.get(id) !== d);
        if (changed) {
          impacts += 1;
          expect(types.has('DAMAGE_APPLIED') || types.has('HEAL_APPLIED'), `${step.presetId} mudou HP sem impacto`).toBe(true);
        }
        if (step.boardAfter.result && !step.boardBefore.result) {
          endings += 1;
          expect(types.has('MATCH_ENDED')).toBe(true);
          for (const other of plan.steps.filter((s) => s.presetId === 'KNOCKOUT' || s.presetId === 'POINTS')) {
            expect(other.startMs + other.durationMs, `${other.presetId} depois do resultado`).toBeLessThanOrEqual(step.startMs + 1e-6);
          }
        }
      }
    }
    expect(impacts).toBeGreaterThan(10);
    expect(endings).toBeGreaterThan(0);
  });

  it('nenhuma face oculta do adversário entra no plano do humano (R-069)', () => {
    for (const b of batches.slice(0, 120)) {
      const plan = planPresentation(b.events, b.before, b.after, { attemptId: 'fz', speed: 'NORMAL', reducedMotion: false, describeCard });
      for (const s of plan.steps) {
        for (const h of s.boardAfter.sides.B.hand) expect(h.card).toBeNull();
        if (s.data.kind === 'DRAW' && s.data.role === 'NPC') for (const k of s.data.handKeys) expect(k.startsWith('opaque:')).toBe(true);
      }
    }
  });
});
