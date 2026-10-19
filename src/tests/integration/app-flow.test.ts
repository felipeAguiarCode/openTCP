// Integração da aplicação sobre o SQLite real (WASM em memória): onboarding → pacote → Empório →
// duelo de campanha persistido ação a ação → transação de resultado → retomada e idempotência.
import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from '../../infrastructure/storage/node.ts';
import { miniBundle } from '../support/mini-bundle.ts';
import { aiShouldAct, resumeAttempt, runAiStep, startAttempt, submitHumanAction, suspendAttempt, HUMAN, type BattleSession } from '../../application/battle.ts';
import { campaignView, continueTarget } from '../../application/campaign.ts';
import { createCommandBus } from '../../application/commands.ts';
import { contentInstallRows, indexContent } from '../../application/content.ts';
import { observable, type GameContext } from '../../application/context.ts';
import { buyProduct, openOwnedPack } from '../../application/economy.ts';
import type { AiPort } from '../../application/ports/ai.ts';
import { deterministicPlatform } from '../../application/ports/platform.ts';
import type { ProfileSnapshot } from '../../application/ports/storage.ts';
import { createProfile, selectProfile } from '../../application/profiles.ts';
import { getLegalActions } from '../../domain/battle/engine.ts';
import { seedRng, uniformInt, type RngState } from '../../domain/random/rng.ts';
import type { Action } from '../../domain/battle/types.ts';
import { firstClearKey } from '../../domain/campaign/rewards.ts';

/** IA de teste: escolhe entre as ações legais da própria observação (nunca vê o estado completo). */
function testAi(): AiPort {
  return {
    plan: async (job) => {
      const legal = job.observation.legalActions;
      const attack = legal.find((a) => a.type === 'ATTACK');
      const pick = attack ?? legal.find((a) => a.type === 'RESOLVE_DECISION') ?? legal.find((a) => a.type === 'ATTACH_ENERGY') ?? legal.find((a) => a.type === 'PLAY_BASIC') ?? legal.find((a) => a.type === 'END_TURN') ?? legal[0]!;
      return { jobId: job.jobId, attemptId: job.attemptId, stateRevision: job.stateRevision, writerEpoch: job.writerEpoch, action: pick, aiRng: job.aiRng, nodesExplored: legal.length, fallback: false };
    },
    cancel: () => undefined,
    dispose: () => undefined,
  };
}

async function setup(): Promise<GameContext> {
  const storage = await createMemoryStorage();
  const bundle = miniBundle();
  const installed = await storage.installContent(contentInstallRows(bundle));
  expect(installed.ok).toBe(true);
  const platform = deterministicPlatform();
  return {
    storage, platform, bus: createCommandBus(storage, platform), content: observable(indexContent(bundle)),
    snapshot: observable<ProfileSnapshot | null>(null), ai: testAi(),
  };
}

function humanPick(session: BattleSession, game: GameContext, rng: RngState): { action: Action; rng: RngState } {
  const legal = getLegalActions(session.state, game.content.get().catalog, HUMAN);
  // Preparação: coloca o máximo de Básicos (Ativo + Banco) para não perder por falta de Pokémon.
  const setup = session.state.pendingDecisions.find((d) => d.player === HUMAN && d.kind === 'SETUP' && !d.answered);
  if (setup) return { action: { type: 'RESOLVE_DECISION', player: HUMAN, decisionId: setup.decisionId, selection: setup.options.slice(0, setup.max) }, rng };
  const priority: Action['type'][] = ['RESOLVE_DECISION', 'PLAY_BASIC', 'EVOLVE', 'ATTACH_ENERGY', 'ATTACK'];
  for (const type of priority) {
    const options = legal.filter((a) => a.type === type);
    if (options.length) {
      const r = uniformInt(rng, options.length);
      return { action: options[r.value]!, rng: r.rng };
    }
  }
  return { action: legal.find((a) => a.type === 'END_TURN') ?? legal[0]!, rng };
}

async function playOut(game: GameContext, session: BattleSession, seed = 99): Promise<number> {
  let rng = seedRng(seed);
  let steps = 0;
  while (!session.state.result && steps < 2000) {
    steps++;
    if (aiShouldAct(session)) {
      const r = await runAiStep(game, session);
      expect(r.ok).toBe(true);
      continue;
    }
    const pick = humanPick(session, game, rng);
    rng = pick.rng;
    const r = await submitHumanAction(game, session, pick.action);
    if (!r.ok) throw new Error(`ação humana recusada: ${r.code} ${JSON.stringify(pick.action)}`);
  }
  return steps;
}

describe('fluxo da aplicação sobre SQLite', () => {
  it('onboarding idempotente, pacote, compra e duelo de campanha até o resultado', async () => {
    const game = await setup();
    const created = await createProfile(game, { displayName: 'Ana', favoriteDeckId: 'starter-fire' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(await selectProfile(game, created.profileId)).toBe(true);
    let snap = game.snapshot.get()!;
    expect(snap.wallets.CREDITS).toBe(300);
    expect(snap.wallets['PACK:pack-base-v1']).toBe(1);
    expect(snap.decks.filter((d) => d.status === 'CONFIRMED')).toHaveLength(3);
    expect(snap.grants).toContain('onboarding:circuito-teste');
    const content = game.content.get();
    expect(continueTarget(content, snap)).toMatchObject({ kind: 'NODE', nodeId: 'T01' });

    // Pacote: abre, credita 5 cartas e consome o saldo; segunda abertura sem saldo falha.
    const before = snap.inventory.reduce((s, i) => s + i.quantity, 0);
    const opened = await openOwnedPack(game, 'pack-base-v1');
    expect(opened.ok).toBe(true);
    snap = game.snapshot.get()!;
    expect(snap.inventory.reduce((s, i) => s + i.quantity, 0)).toBe(before + 5);
    expect(snap.wallets['PACK:pack-base-v1'] ?? 0).toBe(0);
    expect((await openOwnedPack(game, 'pack-base-v1')).ok).toBe(false);

    // Empório: compra um pacote; carta dirigida ainda bloqueada pela campanha.
    expect((await buyProduct(game, 'pack-base-v1')).ok).toBe(true);
    expect(game.snapshot.get()!.wallets.CREDITS).toBe(200);
    expect((await buyProduct(game, 'card-faisca')).ok).toBe(false);

    // Duelo de campanha persistido a cada ação.
    const deckId = game.snapshot.get()!.decks.find((d) => d.name === 'Chama Constante')!.deckId;
    const started = await startAttempt(game, { mode: 'CAMPAIGN', nodeId: 'T01', difficulty: 'STANDARD', deckId });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect((await startAttempt(game, { mode: 'CAMPAIGN', nodeId: 'T01', difficulty: 'STANDARD', deckId })).ok).toBe(false);
    const session = started.session;
    expect(game.snapshot.get()!.activeAttempt?.attemptId).toBe(session.attemptId);

    // Suspender e retomar reconstrói exatamente o estado gravado.
    expect(await suspendAttempt(game, session)).toBe(true);
    const resumed = await resumeAttempt(game);
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    expect(resumed.session.state).toEqual(session.state);

    const steps = await playOut(game, resumed.session);
    expect(resumed.session.state.result).not.toBeNull();
    expect(steps).toBeLessThan(2000);
    snap = game.snapshot.get()!;
    expect(snap.activeAttempt).toBeNull();
    const summary = resumed.session.result!;
    const attempt = await game.storage.query({ kind: 'GET_ATTEMPT', attemptId: session.attemptId });
    expect(attempt?.status).toBe('FINISHED');
    expect(attempt?.result).toMatchObject({ outcome: summary.outcome });
    const events = await game.storage.query({ kind: 'GET_EVENTS', attemptId: session.attemptId, fromSeq: 0 });
    expect(events.length).toBeGreaterThan(10);
    expect(events.map((e) => e.seq)).toEqual([...events.map((e) => e.seq)].sort((a, b) => a - b));
    const checkpoints = await game.storage.query({ kind: 'GET_CHECKPOINTS', attemptId: session.attemptId });
    expect(checkpoints.length).toBeGreaterThan(0);
    const cp = await game.storage.query({ kind: 'GET_CHECKPOINT', attemptId: session.attemptId, stateVersion: checkpoints[0]!.stateVersion });
    expect(cp?.snapshot).toBeTruthy();

    if (summary.outcome === 'WIN') {
      expect(snap.grants).toContain(firstClearKey('circuito-teste', 'T01'));
      expect(snap.wallets.CREDITS).toBe(200 + (summary.grants?.credits ?? 0));
      expect(summary.grants?.credits).toBeGreaterThanOrEqual(100);
      expect(summary.unlockedNodeIds).toContain('T02');
      expect(campaignView(content, snap).statuses.get('T02')).toBe('AVAILABLE');
    } else {
      expect(snap.grants).not.toContain(firstClearKey('circuito-teste', 'T01'));
      expect(snap.wallets.CREDITS).toBe(200);
    }
  }, 120_000);

  it('repetir o mesmo comando devolve o mesmo recibo sem creditar de novo', async () => {
    const game = await setup();
    const created = await createProfile(game, { displayName: 'Bia', favoriteDeckId: 'starter-water' });
    if (!created.ok) throw new Error(created.message);
    await selectProfile(game, created.profileId);
    const first = await buyProduct(game, 'pack-base-v1', 'cmd-fixed-1');
    expect(first.ok).toBe(true);
    const credits = game.snapshot.get()!.wallets.CREDITS;
    // Mesmo command_id e payload, revisão já avançada: o barramento recupera o recibo existente.
    const again = await buyProduct(game, 'pack-base-v1', 'cmd-fixed-1');
    expect(again.ok).toBe(true);
    expect(game.snapshot.get()!.wallets.CREDITS).toBe(credits);
  });
});
