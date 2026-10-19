// Rota principal da campanha com o catálogo REAL (base 1.0.0) sobre o SQLite em memória: os 27 nós
// essenciais em ordem, tutoriais pela solução roteirizada (NPC pelo `npcScript`), duelos com deck de
// apoio. Confere desbloqueios, medalhas, cartas-chave, prêmio de escolha e a economia contra a auditoria
// do content-build (campanha §15.4): nada é gasto, então o saldo é exatamente o previsto pelos dados.
import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from '../../infrastructure/storage/node.ts';
import { buildBundle } from '../../content/bundle.ts';
import { resolveCommand } from '../../content/source/script.ts';
import type { BuiltBundle, CampaignNode } from '../../content/types.ts';
import {
  aiShouldAct, resumeAttempt, runAiStep, sessionFixture, startAttempt, submitHumanAction, suspendAttempt, HUMAN, type BattleSession,
} from '../../application/battle.ts';
import { campaignView } from '../../application/campaign.ts';
import { createCommandBus } from '../../application/commands.ts';
import { contentInstallRows, indexContent } from '../../application/content.ts';
import { observable, type GameContext } from '../../application/context.ts';
import { claimPendingReward, progressMap } from '../../application/economy.ts';
import type { AiPort } from '../../application/ports/ai.ts';
import { deterministicPlatform } from '../../application/ports/platform.ts';
import type { ProfileSnapshot } from '../../application/ports/storage.ts';
import { createProfile, selectProfile } from '../../application/profiles.ts';
import { jcsHash } from '../../domain/hash/jcs.ts';
import { greedyAction } from '../support/greedy.ts';

/** Planos pedidos à IA por tentativa: fixtures roteirizadas não devem consultá-la. */
const planned = new Map<string, number>();

/** Oponente simples pela própria observação (a IA do produto é testada à parte). */
const simpleAi: AiPort = {
  plan: async (job) => {
    planned.set(job.attemptId, (planned.get(job.attemptId) ?? 0) + 1);
    const legal = job.observation.legalActions;
    const pick = legal.find((a) => a.type === 'RESOLVE_DECISION') ?? legal.find((a) => a.type === 'ATTACK') ?? legal.find((a) => a.type === 'PLAY_BASIC')
      ?? legal.find((a) => a.type === 'ATTACH_ENERGY') ?? legal.find((a) => a.type === 'END_TURN') ?? legal[0]!;
    return { jobId: job.jobId, attemptId: job.attemptId, stateRevision: job.stateRevision, writerEpoch: job.writerEpoch, action: pick, aiRng: job.aiRng, nodesExplored: legal.length, fallback: false };
  },
  cancel: () => undefined,
  dispose: () => undefined,
};

function realBundle(): BuiltBundle {
  const b = buildBundle();
  return { ...b, contentHash: jcsHash(b) };
}

async function setup(bundle: BuiltBundle): Promise<GameContext> {
  const storage = await createMemoryStorage();
  expect((await storage.installContent(contentInstallRows(bundle))).ok).toBe(true);
  const platform = deterministicPlatform();
  const game: GameContext = {
    storage, platform, bus: createCommandBus(storage, platform), content: observable(indexContent(bundle)),
    snapshot: observable<ProfileSnapshot | null>(null), ai: simpleAi,
  };
  const created = await createProfile(game, { displayName: 'Rota', favoriteDeckId: bundle.onboarding.starterDeckIds[0]! });
  if (!created.ok) throw new Error(created.message);
  expect(await selectProfile(game, created.profileId)).toBe(true);
  return game;
}

/** Joga até o fim: humano pela solução da fixture (quando houver) ou guloso; NPC pelo roteiro/IA. */
async function playOut(game: GameContext, session: BattleSession): Promise<void> {
  const cat = game.content.get().catalog;
  const solution = [...(sessionFixture(game, session)?.solution ?? []).map((s) => s.command)];
  for (let steps = 0; !session.state.result; steps += 1) {
    if (steps > 3000) throw new Error(`duelo sem fim em ${session.nodeId}`);
    if (aiShouldAct(session)) {
      const r = await runAiStep(game, session);
      if (!r.ok) throw new Error(`IA falhou em ${session.nodeId}: ${r.code}`);
      continue;
    }
    const scripted = solution.length ? resolveCommand(session.state, HUMAN, solution.shift()!) : null;
    const action = scripted ?? greedyAction(session.state, cat, HUMAN);
    const r = await submitHumanAction(game, session, action);
    if (!r.ok) throw new Error(`ação humana recusada em ${session.nodeId}: ${r.code} ${'message' in r ? r.message ?? '' : ''} ${JSON.stringify(action)}`);
  }
}

function essentialRoute(bundle: BuiltBundle): CampaignNode[] {
  const done = new Set<string>();
  const route: CampaignNode[] = [];
  const pending = bundle.nodes.filter((n) => n.essential);
  while (pending.length) {
    const i = pending.findIndex((n) => n.prerequisites.allOf.every((p) => done.has(p)));
    if (i < 0) throw new Error('rota essencial com pré-requisito não essencial');
    const [n] = pending.splice(i, 1);
    route.push(n!);
    done.add(n!.nodeId);
  }
  return route;
}

describe('rota principal da campanha com o catálogo real', () => {
  it('27 vitórias essenciais concluem o Circuito com a economia da auditoria', async () => {
    const bundle = realBundle();
    const game = await setup(bundle);
    const content = game.content.get();
    const route = essentialRoute(bundle);
    expect(route).toHaveLength(27);
    const attemptsPerNode: Record<string, number> = {};

    for (const node of route) {
      // Disponível só depois dos pré-requisitos (C-002/C-003).
      const status = campaignView(content, game.snapshot.get()!).statuses.get(node.nodeId);
      expect(status, `${node.nodeId} deveria estar disponível`).not.toBe('LOCKED');
      for (let attempt = 1; ; attempt += 1) {
        if (attempt > 12) throw new Error(`${node.nodeId}: sem vitória em 12 tentativas`);
        attemptsPerNode[node.nodeId] = attempt;
        const loanDeckId = node.fixtureId ? undefined : node.supportDeckIds?.[0];
        const started = await startAttempt(game, { mode: 'CAMPAIGN', nodeId: node.nodeId, difficulty: 'STORY', deckId: null, ...(loanDeckId ? { loanDeckId } : {}) });
        if (!started.ok) throw new Error(`${node.nodeId}: ${started.code} ${started.message}`);
        await playOut(game, started.session);
        const outcome = started.session.result?.outcome;
        // O NPC dos tutoriais segue o npcScript validado no build, sem consultar a IA.
        if (content.fixtures.get(node.fixtureId ?? '')?.npcScript?.length) expect(planned.get(started.session.attemptId) ?? 0, node.nodeId).toBe(0);
        expect(game.snapshot.get()!.activeAttempt).toBeNull();
        if (outcome === 'WIN') break;
        // Tutoriais roteirizados precisam vencer na primeira tentativa (fixture validada no build).
        expect(node.fixtureId, `${node.nodeId} roteirizado terminou em ${outcome}`).toBeFalsy();
      }
      // Escolha de carta-chave (C06): o prêmio fica pendente até o jogador escolher.
      const pending = game.snapshot.get()!.pendingRewards.filter((r) => r.status === 'PENDING');
      for (const reward of pending) {
        const options = reward.options as { printingIds: string[] };
        expect((await claimPendingReward(game, reward.rewardId, options.printingIds[0]!)).ok).toBe(true);
        expect((await claimPendingReward(game, reward.rewardId, options.printingIds[1]!)).ok).toBe(false);
      }
    }

    const snap = game.snapshot.get()!;
    const progress = progressMap(snap);
    for (const node of route) expect(progress.get(node.nodeId)?.firstClearAttemptId, node.nodeId).toBeTruthy();

    // Medalhas dos 6 chefes e cartas-chave creditadas (C-013).
    const bosses = route.filter((n) => n.kind === 'BOSS');
    expect(bosses).toHaveLength(6);
    for (const boss of bosses) expect((progress.get(boss.nodeId) as { medal?: string | null } | undefined)?.medal, boss.nodeId).toBeTruthy();
    const inv = new Map(snap.inventory.map((i) => [i.printingId, i.quantity]));
    for (const boss of bosses) {
      const key = boss.keyCardReward!;
      const got = key.printingIds.filter((p) => (inv.get(p) ?? 0) >= key.copies);
      expect(got.length, boss.nodeId).toBe(key.mode === 'FIXED' ? key.printingIds.length : 1);
    }

    // Economia: nada foi gasto; saldo = auditoria obrigatória + objetivos extras cumpridos no caminho.
    const tables = new Map(bundle.rewardTables.map((t) => [t.rewardTableId, t]));
    const mandatory = bundle.onboarding.credits + route.reduce((s, n) => s + (tables.get(n.firstClearRewardTableId)?.credits ?? 0), 0);
    expect(mandatory).toBe(4010);
    const objectiveCredits = route.flatMap((n) => progress.get(n.nodeId)?.completedObjectiveIds ?? [])
      .reduce((s, id) => s + (content.objectives.get(id)?.reward.credits ?? 0), 0);
    expect(snap.wallets.CREDITS).toBe(mandatory + objectiveCredits);
    const packs: Record<string, number> = {};
    for (const p of bundle.onboarding.packs) packs[p.productId] = (packs[p.productId] ?? 0) + p.count;
    for (const n of route) for (const p of tables.get(n.firstClearRewardTableId)?.packs ?? []) packs[p.productId] = (packs[p.productId] ?? 0) + p.count;
    for (const [productId, count] of Object.entries(packs)) expect(snap.wallets[`PACK:${productId}`] ?? 0, productId).toBe(count);

    // Final concede o playmat de conclusão; chaves de concessão nunca se repetem.
    expect(snap.entitlements.some((e) => e.cosmeticId === 'mat-circuit-complete')).toBe(true);
    expect(new Set(snap.grants).size).toBe(snap.grants.length);
    // Deck de apoio não credita cartas (C-017): o inventário só cresce por prêmios (cartas-chave).
    const keyCopies = bosses.reduce((s, b) => s + b.keyCardReward!.copies * (b.keyCardReward!.mode === 'FIXED' ? b.keyCardReward!.printingIds.length : 1), 0);
    const starterCopies = bundle.onboarding.inventory.reduce((s, i) => s + i.count, 0);
    expect(snap.inventory.reduce((s, i) => s + i.quantity, 0)).toBe(starterCopies + keyCopies);
    console.info(`[rota] tentativas por nó: ${JSON.stringify(attemptsPerNode)}`);
  }, 900_000);

  it('retomar um tutorial no meio preserva o roteiro do NPC e as sementes', async () => {
    const bundle = realBundle();
    const game = await setup(bundle);
    const started = await startAttempt(game, { mode: 'CAMPAIGN', nodeId: 'P00-T01', difficulty: 'STORY', deckId: null });
    if (!started.ok) throw new Error(started.message);
    let session = started.session;
    const solution = [...(sessionFixture(game, session)?.solution ?? []).map((st) => st.command)];
    const script = sessionFixture(game, session)?.npcScript ?? [];
    expect(solution.length).toBeGreaterThan(2);
    expect(script.length).toBeGreaterThan(1);
    // Avança até o NPC ter jogado parte do roteiro, sem terminar.
    while (session.npcScriptCursor < 2 && !session.state.result) {
      if (aiShouldAct(session)) { expect((await runAiStep(game, session)).ok).toBe(true); continue; }
      expect((await submitHumanAction(game, session, resolveCommand(session.state, HUMAN, solution.shift()!)!)).ok).toBe(true);
    }
    const cursor = session.npcScriptCursor;
    const seeds = session.seeds;
    expect(seeds).not.toBeNull();
    expect(await suspendAttempt(game, session)).toBe(true);
    const resumed = await resumeAttempt(game);
    if (!resumed.ok) throw new Error(resumed.message);
    session = resumed.session;
    expect(session.npcScriptCursor).toBe(cursor);
    expect(session.seeds).toEqual(seeds);
    while (!session.state.result) {
      if (aiShouldAct(session)) { expect((await runAiStep(game, session)).ok).toBe(true); continue; }
      expect((await submitHumanAction(game, session, resolveCommand(session.state, HUMAN, solution.shift()!)!)).ok).toBe(true);
    }
    expect(session.result?.outcome).toBe('WIN');
    expect(planned.get(session.attemptId) ?? 0).toBe(0);
    const row = await game.storage.query({ kind: 'GET_ATTEMPT', attemptId: session.attemptId });
    expect(row?.rng).toMatchObject({ battleSeed: seeds!.battleSeed, aiSeed: seeds!.aiSeed, npcScriptCursor: script.length });
  });

  it('preparação simultânea: NPC e humano confirmam o campo ao mesmo tempo sem conflito de revisão', async () => {
    const game = await setup(realBundle());
    const started = await startAttempt(game, { mode: 'CAMPAIGN', nodeId: 'P00-T01', difficulty: 'STORY', deckId: null });
    if (!started.ok) throw new Error(started.message);
    const session = started.session;
    const solution = (sessionFixture(game, session)?.solution ?? []).map((st) => st.command);
    const setupAction = resolveCommand(session.state, HUMAN, solution[0]!)!;
    expect(aiShouldAct(session)).toBe(true);
    const [npc, human] = await Promise.all([runAiStep(game, session), submitHumanAction(game, session, setupAction)]);
    expect(npc.ok).toBe(true);
    expect(human.ok).toBe(true);
    expect(session.state.pendingDecisions.filter((d) => d.kind === 'SETUP' && !d.answered)).toEqual([]);
    const row = await game.storage.query({ kind: 'GET_ATTEMPT', attemptId: session.attemptId });
    expect(row?.stateVersion).toBe(session.state.stateVersion);
  });
});
