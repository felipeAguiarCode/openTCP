// Ciclo de vida de tentativas sobre o SQLite real (WASM em memória): pausa real da IA, retomada exata,
// reinício, ressincronização de versão, clique duplicado, falha ao gravar o resultado, troca de perfil/época,
// snapshot cosmético e resultados de campanha (derrota, revisita, composição pelo snapshot de entrada).
import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from '../../infrastructure/storage/node.ts';
import { miniBundle } from '../support/mini-bundle.ts';
import { greedyAction } from '../support/greedy.ts';
import { buildBundle } from '../../content/bundle.ts';
import type { BuiltBundle, ContentBundle } from '../../content/types.ts';
import { pokemon, attack, printing } from '../../content/builders.ts';
import * as S from '../support/generic-cards.ts';
import {
  abandonAttempt, aiShouldAct, resumeAttempt, runAiStep, startAttempt, submitHumanAction, suspendAttempt, HUMAN, NPC, type BattleSession,
} from '../../application/battle.ts';
import { arenaList, campaignView, continueTarget } from '../../application/campaign.ts';
import { createCommandBus } from '../../application/commands.ts';
import { contentInstallRows, indexContent } from '../../application/content.ts';
import { observable, reloadSnapshot, type GameContext } from '../../application/context.ts';
import { progressMap } from '../../application/economy.ts';
import { DEFAULT_PARAMS, cosmeticCatalog, savePreset, validatePreset, type PresetConfig } from '../../application/appearance.ts';
import { addCard, confirmDeck, draftFromRow, removeCard } from '../../application/decks.ts';
import type { AiJob, AiPort, AiResult } from '../../application/ports/ai.ts';
import { deterministicPlatform, type Platform } from '../../application/ports/platform.ts';
import type { JsonValue, ProfileSnapshot, StoragePort } from '../../application/ports/storage.ts';
import { createProfile, saveSettings, selectProfile } from '../../application/profiles.ts';
import { applyAction, getPlayerView } from '../../domain/battle/engine.ts';
import { ENGINE_VERSION } from '../../domain/battle/setup.ts';
import type { Action, MatchState } from '../../domain/battle/types.ts';
import { EMPTY_PROGRESS } from '../../domain/campaign/progress.ts';
import { jcsHash } from '../../domain/hash/jcs.ts';

// ---------------------------------------------------------------- apoio

const result = (job: AiJob, action: Action): AiResult => ({
  jobId: job.jobId, attemptId: job.attemptId, stateRevision: job.stateRevision, writerEpoch: job.writerEpoch, action, aiRng: job.aiRng, nodesExplored: 1, fallback: false,
});

/** NPC que só prepara o campo, promove quando obrigado e passa o turno. */
const passiveAi: AiPort = {
  plan: async (job) => result(job, job.observation.legalActions.find((a) => a.type === 'RESOLVE_DECISION') ?? job.observation.legalActions.find((a) => a.type === 'END_TURN') ?? job.observation.legalActions[0]!),
  cancel: () => undefined,
  dispose: () => undefined,
};

/** NPC simples e agressivo, pela própria observação (a IA do produto é testada à parte). */
const attackerAi: AiPort = {
  plan: async (job) => {
    const legal = job.observation.legalActions;
    return result(job, legal.find((a) => a.type === 'RESOLVE_DECISION') ?? legal.find((a) => a.type === 'ATTACK') ?? legal.find((a) => a.type === 'ATTACH_ENERGY')
      ?? legal.find((a) => a.type === 'PLAY_BASIC') ?? legal.find((a) => a.type === 'END_TURN') ?? legal[0]!);
  },
  cancel: () => undefined,
  dispose: () => undefined,
};

type Setup = { readonly bundle?: BuiltBundle; readonly ai?: AiPort; readonly platform?: Platform; readonly storage?: StoragePort };

async function setup(opts: Setup = {}): Promise<GameContext> {
  const bundle = opts.bundle ?? miniBundle();
  const storage = opts.storage ?? await createMemoryStorage();
  if (!opts.storage) expect((await storage.installContent(contentInstallRows(bundle))).ok).toBe(true);
  const platform = opts.platform ?? deterministicPlatform();
  const game: GameContext = {
    storage, platform, bus: createCommandBus(storage, platform), content: observable(indexContent(bundle)),
    snapshot: observable<ProfileSnapshot | null>(null), ai: opts.ai ?? passiveAi,
  };
  const created = await createProfile(game, { displayName: 'Teste', favoriteDeckId: bundle.onboarding.starterDeckIds[0]! });
  if (!created.ok) throw new Error(created.message);
  expect(await selectProfile(game, created.profileId)).toBe(true);
  return game;
}

function realBundle(): BuiltBundle {
  const b = buildBundle();
  return { ...b, contentHash: jcsHash(b) };
}

function withHash(content: ContentBundle): BuiltBundle {
  return { ...content, contentHash: jcsHash(content) };
}

const snap = (game: GameContext): ProfileSnapshot => game.snapshot.get()!;
const deckId = (game: GameContext, name = 'Chama Constante') => snap(game).decks.find((d) => d.name === name)!.deckId;
const pendingHuman = (s: BattleSession) => s.state.pendingDecisions.find((d) => d.player === HUMAN && !d.answered);

/** Humano que só prepara (com o mínimo), promove quando obrigado e passa o turno. */
function passiveHuman(s: BattleSession): Action {
  const d = pendingHuman(s);
  if (d) return { type: 'RESOLVE_DECISION', player: HUMAN, decisionId: d.decisionId, selection: d.options.slice(0, Math.max(1, d.min)) };
  return { type: 'END_TURN', player: HUMAN };
}

async function playOut(game: GameContext, session: BattleSession, human: (s: BattleSession) => Action): Promise<void> {
  for (let steps = 0; !session.state.result; steps += 1) {
    if (steps > 4000) throw new Error('duelo sem fim');
    if (aiShouldAct(session)) {
      const r = await runAiStep(game, session);
      if (!r.ok && r.code !== 'AI_JOB_STALE') throw new Error(`IA falhou: ${r.code}`);
      continue;
    }
    const r = await submitHumanAction(game, session, human(session));
    if (!r.ok) throw new Error(`ação humana recusada: ${r.code}`);
  }
}

const greedy = (game: GameContext) => (s: BattleSession) => greedyAction(s.state, game.content.get().catalog, HUMAN);

/** Prepara o NPC e o humano (Ativo + Banco) e devolve a sessão no primeiro turno jogável. */
async function prepared(game: GameContext, session: BattleSession): Promise<void> {
  while (session.state.phase === 'SETUP' || session.state.pendingDecisions.some((d) => d.kind === 'SETUP' && !d.answered)) {
    if (aiShouldAct(session)) { expect((await runAiStep(game, session)).ok).toBe(true); continue; }
    const d = pendingHuman(session)!;
    expect((await submitHumanAction(game, session, { type: 'RESOLVE_DECISION', player: HUMAN, decisionId: d.decisionId, selection: d.options.slice(0, d.max) })).ok).toBe(true);
  }
}

/** Fixture de progresso autorizada para testes (runtime R-002): marca nós como concluídos num commit. */
async function clearNodes(game: GameContext, nodeIds: readonly string[]): Promise<void> {
  const s = snap(game);
  const content = game.content.get();
  const r = await game.bus.execute({
    commandType: 'FINISH_ATTEMPT', profileId: s.profile.profileId, expectedRevision: s.profile.revision, writerEpoch: s.profile.writerEpoch,
    payload: { testFixture: [...nodeIds] },
    mutations: nodeIds.map((nodeId) => ({
      kind: 'UPSERT_CAMPAIGN_PROGRESS' as const, campaignId: content.bundle.campaignId, nodeId, campaignVersion: content.bundle.version, status: 'CLEARED' as const,
      progress: { ...EMPTY_PROGRESS, firstClearAttemptId: `fixture-${nodeId}`, wins: 1, clearedDifficulties: ['STORY'] } as unknown as JsonValue,
    })),
    summary: { testFixture: true },
  });
  expect(r.ok).toBe(true);
  await reloadSnapshot(game);
}

async function start(game: GameContext, nodeId = 'T01', extra: Partial<Parameters<typeof startAttempt>[1]> = {}): Promise<BattleSession> {
  const r = await startAttempt(game, { mode: 'CAMPAIGN', nodeId, difficulty: 'STANDARD', deckId: deckId(game), ...extra });
  if (!r.ok) throw new Error(`${r.code}: ${r.message}`);
  return r.session;
}

/** Marca os pré-requisitos do nó como vencidos (perfil que já avançou na campanha). */
async function unlock(game: GameContext, nodeId: string): Promise<void> {
  const content = game.content.get();
  const node = content.nodes.get(nodeId)!;
  const s = game.snapshot.get()!;
  const r = await game.bus.execute({
    commandType: 'FINISH_ATTEMPT', profileId: s.profile.profileId, expectedRevision: s.profile.revision, writerEpoch: s.profile.writerEpoch,
    payload: { unlock: nodeId },
    mutations: node.prerequisites.allOf.map((prereq) => ({
      kind: 'UPSERT_CAMPAIGN_PROGRESS' as const, campaignId: content.bundle.campaignId, nodeId: prereq, campaignVersion: content.bundle.version, status: 'CLEARED' as const,
      progress: { firstClearAttemptId: `seed-${prereq}`, clearedDifficulties: ['STORY'], completedObjectiveIds: [], wins: 1, losses: 0, consecutiveLosses: 0 } as JsonValue,
    })),
    summary: { testFixture: true },
  });
  if (!r.ok) throw new Error(r.message);
  await reloadSnapshot(game);
}

/** Estado sem o identificador da tentativa (que muda com o ID gerado), para comparar só as regras. */
const rulesOnly = (state: MatchState) => JSON.parse(JSON.stringify(state).split(state.matchId).join('<match>')) as unknown;

// ---------------------------------------------------------------- pausa, retomada e reinício

describe('pausa, retomada e reinício', () => {
  it('G-063/C-039/R-020/UI-040: pausa real — a IA não aplica ação suspensa e o plano que chega depois é descartado', async () => {
    let release: ((value: AiResult) => void) | null = null;
    let lastJob: AiJob | null = null;
    const deferredAi: AiPort = {
      plan: (job) => { lastJob = job; return new Promise<AiResult>((resolve) => { release = resolve; }); },
      cancel: () => undefined,
      dispose: () => undefined,
    };
    const game = await setup({ ai: deferredAi });
    const session = await start(game);
    expect(aiShouldAct(session)).toBe(true);
    const pending = runAiStep(game, session);
    await new Promise((r) => setTimeout(r, 0));
    expect(lastJob).not.toBeNull();
    const version = session.state.stateVersion;
    const revision = snap(game).profile.revision;
    expect(await suspendAttempt(game, session)).toBe(true);
    expect((await game.storage.query({ kind: 'GET_ATTEMPT', attemptId: session.attemptId }))?.status).toBe('SUSPENDED');
    // O plano chega depois da pausa: é descartado sem gravar.
    const setupChoice = lastJob!.observation.legalActions.find((a) => a.type === 'RESOLVE_DECISION')!;
    release!(result(lastJob!, setupChoice));
    expect(await pending).toMatchObject({ ok: false, code: 'AI_JOB_STALE' });
    // Enquanto suspensa, a IA nem é consultada.
    expect(aiShouldAct(session)).toBe(false);
    expect(await runAiStep(game, session)).toMatchObject({ ok: false, code: 'NOT_YOUR_TURN' });
    expect(session.state.stateVersion).toBe(version);
    expect(snap(game).profile.revision).toBe(revision + 1);
    const row = await game.storage.query({ kind: 'GET_ATTEMPT', attemptId: session.attemptId });
    expect(row?.stateVersion).toBe(version);
    expect((row?.state as unknown as MatchState).pendingDecisions.filter((d) => d.player === NPC && d.answered)).toEqual([]);
  });

  it('G-064/R-018/DB-031/UI-041/C-041: retomar restaura mão, ordem do baralho, efeitos, decisão pendente e RNG', async () => {
    const game = await setup();
    const session = await start(game);
    // NPC prepara; a decisão de preparação do humano continua pendente.
    expect((await runAiStep(game, session)).ok).toBe(true);
    const decision = pendingHuman(session)!;
    expect(decision.kind).toBe('SETUP');
    expect(await suspendAttempt(game, session)).toBe(true);
    const resumed = await resumeAttempt(game);
    if (!resumed.ok) throw new Error(resumed.message);
    const back = resumed.session;
    expect(back.attemptId).toBe(session.attemptId);
    expect(back.state).toEqual(session.state);
    expect(back.state.players.A.deck).toEqual(session.state.players.A.deck);
    expect(back.state.players.A.hand).toEqual(session.state.players.A.hand);
    expect(back.state.rng).toEqual(session.state.rng);
    expect(back.aiRng).toEqual(session.aiRng);
    expect(pendingHuman(back)).toEqual(decision);
    // A mesma resposta produz exatamente o estado que o motor produziria sem a pausa.
    const action: Action = { type: 'RESOLVE_DECISION', player: HUMAN, decisionId: decision.decisionId, selection: decision.options.slice(0, decision.max) };
    const expected = applyAction(session.state, game.content.get().catalog, action);
    expect((await submitHumanAction(game, back, action)).ok).toBe(true);
    expect(expected.ok && jcsHash(back.state)).toBe(expected.ok && jcsHash(expected.state));
    // Meio de partida: alguns turnos, nova pausa e retomada idêntica.
    for (let i = 0; i < 5; i += 1) {
      const r = aiShouldAct(back) ? await runAiStep(game, back) : await submitHumanAction(game, back, greedy(game)(back));
      expect(r.ok).toBe(true);
    }
    expect(back.state.result).toBeNull();
    expect(await suspendAttempt(game, back)).toBe(true);
    const again = await resumeAttempt(game);
    if (!again.ok) throw new Error(again.message);
    expect(again.session.state).toEqual(back.state);
    expect(again.session.aiRng).toEqual(back.aiRng);
  });

  it('G-080/C-040: reiniciar cria tentativa e sementes novas; retomar conserva tentativa e RNG', async () => {
    const game = await setup();
    const first = await start(game);
    expect(await suspendAttempt(game, first)).toBe(true);
    const resumed = await resumeAttempt(game);
    if (!resumed.ok) throw new Error(resumed.message);
    expect(resumed.session.attemptId).toBe(first.attemptId);
    expect(resumed.session.seeds).toEqual(first.seeds);
    expect(resumed.session.state.rng).toEqual(first.state.rng);
    expect(await abandonAttempt(game, resumed.session)).toBe(true);
    expect(snap(game).activeAttempt).toBeNull();
    const restarted = await start(game);
    expect(restarted.attemptId).not.toBe(first.attemptId);
    expect(restarted.seeds).not.toEqual(first.seeds);
    expect((await game.storage.query({ kind: 'GET_ATTEMPT', attemptId: first.attemptId }))?.status).toBe('FINISHED');
  });

  it('encontro bloqueado não começa pela aplicação (pré-requisitos não vencidos)', async () => {
    const game = await setup({ bundle: realBundle() });
    const r = await startAttempt(game, { mode: 'CAMPAIGN', nodeId: 'C01-E02', difficulty: 'STORY', deckId: null });
    expect(r).toMatchObject({ ok: false, code: 'NOT_FOUND' });
    expect(game.snapshot.get()!.activeAttempt).toBeNull();
  });

  it('C-040: reiniciar um puzzle cria tentativa nova sobre a mesma fixture autoral', async () => {
    const game = await setup({ bundle: realBundle() });
    const board = (s: BattleSession) => (['A', 'B'] as const).map((p) => {
      const pl = s.state.players[p];
      const keys = (ids: readonly string[]) => ids.map((id) => s.state.cards[id]!.definitionKey);
      return { active: pl.active ? keys(pl.active.stack) : null, bench: pl.bench.map((e) => (e ? keys(e.stack) : null)), hand: keys(pl.hand).sort(), deck: keys(pl.deck).sort(), points: pl.points };
    });
    await unlock(game, 'C01-E02');
    const first = await start(game, 'C01-E02', { deckId: null, difficulty: 'STORY' });
    expect(game.content.get().nodes.get('C01-E02')!.fixtureId).toBe('fx-c01-e02');
    expect(await abandonAttempt(game, first)).toBe(true);
    const second = await start(game, 'C01-E02', { deckId: null, difficulty: 'STORY' });
    expect(second.attemptId).not.toBe(first.attemptId);
    expect(board(second)).toEqual(board(first));
  });
});

// ---------------------------------------------------------------- concorrência, versões e falhas

describe('concorrência, versões e falhas de gravação', () => {
  it('G-045/R-022: versão incorreta — resultado obsoleto é descartado e a retomada ressincroniza sem ação indevida', async () => {
    const game = await setup();
    const session = await start(game);
    // NPC e humano preparam ao mesmo tempo: o plano da IA, feito sobre a revisão anterior, é descartado.
    const human = pendingHuman(session)!;
    const [npc, mine] = await Promise.all([
      runAiStep(game, session),
      submitHumanAction(game, session, { type: 'RESOLVE_DECISION', player: HUMAN, decisionId: human.decisionId, selection: human.options.slice(0, 1) }),
    ]);
    expect(mine.ok).toBe(true);
    expect(npc).toMatchObject({ ok: false, code: 'AI_JOB_STALE' });
    expect(session.state.pendingDecisions.some((d) => d.player === NPC && !d.answered)).toBe(true);
    expect((await runAiStep(game, session)).ok).toBe(true);
    // Duas sessões da mesma tentativa: a desatualizada não grava sobre a mais nova.
    expect(await suspendAttempt(game, session)).toBe(true);
    const a = await resumeAttempt(game);
    if (!a.ok) throw new Error(a.message);
    while (aiShouldAct(a.session)) expect((await runAiStep(game, a.session)).ok).toBe(true);
    const stale: BattleSession = { ...a.session };
    const action = greedy(game)(stale);
    expect((await submitHumanAction(game, a.session, action)).ok).toBe(true);
    expect(stale.state.stateVersion).toBeLessThan(a.session.state.stateVersion);
    // A mesma ação é legal na cópia antiga, mas a versão confirmada já avançou: nada é gravado.
    expect(await submitHumanAction(game, stale, action)).toMatchObject({ ok: false, code: 'STATE_VERSION_MISMATCH' });
    const row = await game.storage.query({ kind: 'GET_ATTEMPT', attemptId: a.session.attemptId });
    expect(row?.stateVersion).toBe(a.session.state.stateVersion);
    expect(jcsHash(row!.state)).toBe(jcsHash(a.session.state));
    // Ressincroniza: a retomada traz o estado confirmado, não a cópia antiga.
    expect(await suspendAttempt(game, a.session)).toBe(true);
    const synced = await resumeAttempt(game);
    expect(synced.ok && synced.session.state).toEqual(a.session.state);
  });

  it('UI-042/G-044: clique duplicado gera um único comando e uma única alteração', async () => {
    const game = await setup();
    const session = await start(game);
    expect((await runAiStep(game, session)).ok).toBe(true);
    const d = pendingHuman(session)!;
    const action: Action = { type: 'RESOLVE_DECISION', player: HUMAN, decisionId: d.decisionId, selection: d.options.slice(0, 1) };
    const revision = snap(game).profile.revision;
    const [one, two] = await Promise.all([submitHumanAction(game, session, action), submitHumanAction(game, session, action)]);
    expect([one.ok, two.ok].filter(Boolean)).toHaveLength(1);
    expect(snap(game).profile.revision).toBe(revision + 1);
    const events = await game.storage.query({ kind: 'GET_EVENTS', attemptId: session.attemptId, fromSeq: 0 });
    expect(events.filter((e) => e.type === 'DECISION_RESOLVED' && (e.event as { data: { player: string } }).data.player === HUMAN)).toHaveLength(1);
  });

  it('G-071/UI-088/R-016/DB-050: falha ao gravar o resultado final não mostra crédito nem perde a tentativa', async () => {
    const real = await createMemoryStorage();
    const bundle = miniBundle();
    expect((await real.installContent(contentInstallRows(bundle))).ok).toBe(true);
    let full = false;
    const storage: StoragePort = {
      ...real,
      commit: (request) => (full && request.commandType === 'FINISH_ATTEMPT'
        ? Promise.resolve({ ok: false as const, code: 'STORAGE_FULL' as const, message: 'database or disk is full' })
        : real.commit(request)),
    };
    const game = await setup({ storage, bundle, ai: passiveAi });
    const session = await start(game);
    const cat = game.content.get().catalog;
    const credits = snap(game).wallets.CREDITS ?? 0;
    const grants = [...snap(game).grants];
    for (let steps = 0; steps < 3000; steps += 1) {
      if (aiShouldAct(session)) { expect((await runAiStep(game, session)).ok).toBe(true); continue; }
      const action = greedyAction(session.state, cat, HUMAN);
      const preview = applyAction(session.state, cat, action);
      if (preview.ok && preview.state.result) {
        full = true;
        const before = session.state;
        const failed = await submitHumanAction(game, session, action);
        expect(failed).toMatchObject({ ok: false, code: 'STORAGE_FULL' });
        expect(session.state).toBe(before);
        expect(session.result).toBeNull();
        expect(snap(game).wallets.CREDITS).toBe(credits);
        expect(snap(game).grants).toEqual(grants);
        const row = await game.storage.query({ kind: 'GET_ATTEMPT', attemptId: session.attemptId });
        expect(row?.status).toBe('RUNNING');
        expect(row?.result).toBeNull();
        // Espaço liberado: a mesma ação recuperável conclui com o prêmio uma única vez.
        full = false;
        expect((await submitHumanAction(game, session, action)).ok).toBe(true);
        expect(session.result?.outcome).toBe('WIN');
        expect(snap(game).wallets.CREDITS).toBe(credits + session.result!.grants!.credits);
        return;
      }
      expect((await submitHumanAction(game, session, action)).ok).toBe(true);
    }
    throw new Error('a partida não chegou ao fim');
  });

  it('G-052/R-035: ação ilegal do bot é rejeitada pelo mesmo validador, sem gravar', async () => {
    const illegalAi: AiPort = {
      plan: async (job) => result(job, { type: 'ATTACK', player: NPC, attackId: 'respingo' }),
      cancel: () => undefined,
      dispose: () => undefined,
    };
    const game = await setup({ ai: illegalAi });
    const session = await start(game);
    const version = session.state.stateVersion;
    const revision = snap(game).profile.revision;
    const r = await runAiStep(game, session);
    expect(r.ok).toBe(false);
    expect((r as { code: string }).code).toBe('PENDING_DECISION');
    expect(session.state.stateVersion).toBe(version);
    expect(snap(game).profile.revision).toBe(revision);
  });

  it('DB-039/R-023/R-025: troca de perfil ou de aba — a tentativa antiga não grava no perfil seguinte nem com época antiga', async () => {
    const game = await setup();
    const session = await start(game);
    expect((await runAiStep(game, session)).ok).toBe(true);
    const a = snap(game).profile.profileId;
    const other = await createProfile(game, { displayName: 'Outro', favoriteDeckId: 'starter-water' });
    if (!other.ok) throw new Error(other.message);
    expect(await selectProfile(game, other.profileId)).toBe(true);
    const bBefore = await game.storage.query({ kind: 'PROFILE_SNAPSHOT', profileId: other.profileId });
    const d = pendingHuman(session)!;
    const r = await submitHumanAction(game, session, { type: 'RESOLVE_DECISION', player: HUMAN, decisionId: d.decisionId, selection: d.options.slice(0, 1) });
    expect(r).toMatchObject({ ok: false, code: 'REVISION_CONFLICT' });
    const bAfter = await game.storage.query({ kind: 'PROFILE_SNAPSHOT', profileId: other.profileId });
    expect(bAfter?.profile.revision).toBe(bBefore?.profile.revision);
    expect(bAfter?.activeAttempt).toBeNull();
    // Nova época no perfil original (outra aba assumiu): a sessão antiga continua sem confirmar nada.
    expect(await selectProfile(game, a)).toBe(true);
    const row = await game.storage.query({ kind: 'GET_ATTEMPT', attemptId: session.attemptId });
    expect(row?.stateVersion).toBe(session.state.stateVersion);
    expect(session.writerEpoch).toBeLessThan(snap(game).profile.writerEpoch);
    expect(await submitHumanAction(game, session, { type: 'RESOLVE_DECISION', player: HUMAN, decisionId: d.decisionId, selection: d.options.slice(0, 1) })).toMatchObject({ ok: false, code: 'REVISION_CONFLICT' });
    const resumed = await resumeAttempt(game);
    expect(resumed.ok && resumed.session.writerEpoch).toBe(snap(game).profile.writerEpoch);
  });

  it('R-031: tentativa criada por motor/regras incompatíveis não é retomada (SAVE_VERSION_UNSUPPORTED)', async () => {
    const game = await setup();
    const session = await start(game);
    expect(await suspendAttempt(game, session)).toBe(true);
    // Abandona e grava, por fixture, uma tentativa de um build antigo (engine e conteúdo diferentes).
    expect(await abandonAttempt(game, (await resumeAttempt(game) as { session: BattleSession }).session)).toBe(true);
    const s = snap(game);
    const old = { ...session.state, engineVersion: 'engine-0.1.0' } as MatchState;
    const r = await game.bus.execute({
      commandType: 'START_ATTEMPT', profileId: s.profile.profileId, expectedRevision: s.profile.revision, writerEpoch: s.profile.writerEpoch,
      payload: { attemptId: 'attempt-legacy' },
      mutations: [{
        kind: 'INSERT_ATTEMPT', attemptId: 'attempt-legacy', mode: 'CAMPAIGN', campaignId: game.content.get().bundle.campaignId, nodeId: 'T01', difficulty: 'STANDARD',
        deckId: deckId(game), deckRevision: 1, progressionEligible: true, stateVersion: old.stateVersion, rulesetId: 'local-campaign-v1', engineVersion: 'engine-0.1.0',
        contentFingerprint: 'f'.repeat(64), state: old as unknown as JsonValue, rng: { aiRng: session.aiRng } as unknown as JsonValue,
        presentationSnapshot: { aiProfileId: session.aiProfile.aiProfileId, npcDeckList: [...session.npcDeckList] } as JsonValue, cardRefs: [], assetRefs: [],
      }],
      summary: { testFixture: true },
    });
    expect(r.ok).toBe(true);
    await reloadSnapshot(game);
    expect(ENGINE_VERSION).not.toBe('engine-0.1.0');
    expect(await resumeAttempt(game)).toMatchObject({ ok: false, code: 'SAVE_VERSION_UNSUPPORTED' });
  });

  it('G-060: atualização de catálogo no meio da partida — a tentativa continua com as versões fixadas na entrada', async () => {
    const base = miniBundle();
    const game = await setup({ bundle: base });
    const session = await start(game);
    await prepared(game, session);
    expect(await suspendAttempt(game, session)).toBe(true);
    // Conteúdo novo: Faísca v2 (HP 999) publicada como nova versão; a v1 continua no catálogo.
    const v2 = { ...pokemon({ baseName: 'Faísca', stage: 'BASIC', type: 'FIRE', hp: 990, retreat: 1, weakness: 'WATER', attacks: [attack({ id: 'fagulha', name: 'Fagulha', cost: { FIRE: 1 }, damage: 90 })] }), version: 2 };
    const v2Printing = { ...printing({ card: v2, setId: 'base', number: 99, rarity: 'COMMON' }), printingId: 'base-099-faisca-v2' };
    const updated = withHash({ ...base, version: '0.0.2-test', cards: [...base.cards, v2], printings: [...base.printings, v2Printing] });
    game.content.set(indexContent(updated));
    const resumed = await resumeAttempt(game);
    if (!resumed.ok) throw new Error(resumed.message);
    const keys = Object.values(resumed.session.state.cards).map((c) => c.definitionKey);
    expect(keys).toContain('faisca@1');
    expect(keys).not.toContain('faisca@2');
    const view = getPlayerView(resumed.session.state, game.content.get().catalog, HUMAN);
    for (const e of [view.sides.A.active, ...view.sides.A.bench]) if (e && e.top.definitionKey === 'faisca@1') expect(e.maxHp).toBe(70);
    expect(resumed.session.state).toEqual(session.state);
  });
});

// ---------------------------------------------------------------- resultados de campanha

describe('resultados de campanha sobre o SQLite', () => {
  it('C-018/G-066: derrota no chefe não retira cartas, não cobra entrada e permite nova tentativa', async () => {
    const bundle = realBundle();
    const game = await setup({ bundle, ai: attackerAi });
    await clearNodes(game, [...bundle.nodes.filter((n) => n.chapterId === 'P00').map((n) => n.nodeId), 'C01-E01', 'C01-E03']);
    expect(campaignView(game.content.get(), snap(game)).statuses.get('C01-E06')).toBe('AVAILABLE');
    const inventory = JSON.stringify(snap(game).inventory);
    const wallets = JSON.stringify(snap(game).wallets);
    const session = await start(game, 'C01-E06', { difficulty: 'EXPERT' });
    expect(JSON.stringify(snap(game).wallets)).toBe(wallets);
    await playOut(game, session, passiveHuman);
    expect(session.result?.outcome).toBe('LOSS');
    expect(JSON.stringify(snap(game).inventory)).toBe(inventory);
    expect(JSON.stringify(snap(game).wallets)).toBe(wallets);
    expect(progressMap(snap(game)).get('C01-E06')).toMatchObject({ firstClearAttemptId: null, losses: 1, consecutiveLosses: 1 });
    expect(campaignView(game.content.get(), snap(game)).statuses.get('C01-E06')).toBe('AVAILABLE');
    const again = await startAttempt(game, { mode: 'CAMPAIGN', nodeId: 'C01-E06', difficulty: 'STORY', deckId: deckId(game) });
    expect(again.ok).toBe(true);
    expect(JSON.stringify(snap(game).wallets)).toBe(wallets);
  });

  it('G-079/C-038/UI-084: concluir o final libera o pós-jogo e preserva perfil, coleção e objetivos', async () => {
    const bundle = realBundle();
    const game = await setup({ bundle, ai: passiveAi });
    await clearNodes(game, bundle.nodes.filter((n) => n.nodeId !== 'F00-D03').map((n) => n.nodeId));
    const inventory = JSON.stringify(snap(game).inventory);
    const progressBefore = progressMap(snap(game));
    const node = game.content.get().nodes.get('F00-D03')!;
    const session = await start(game, 'F00-D03', { deckId: null, difficulty: 'STORY', loanDeckId: node.supportDeckIds[0]! });
    await playOut(game, session, greedy(game));
    expect(session.result?.outcome).toBe('WIN');
    const after = snap(game);
    expect(after.profile.archived).toBe(false);
    expect(JSON.stringify(after.inventory)).toBe(inventory);
    expect(after.entitlements.filter((e) => e.cosmeticId === 'mat-circuit-complete')).toHaveLength(1);
    const progress = progressMap(after);
    for (const [nodeId, p] of progressBefore) expect(progress.get(nodeId)?.firstClearAttemptId, nodeId).toBe(p.firstClearAttemptId);
    expect(progress.get('F00-D03')?.completedObjectiveIds).toContain('F00-D03-WIN');
    // Pós-jogo: nada pendente na rota, Arena com os finais e qualquer encontro pode ser revisitado.
    expect(continueTarget(game.content.get(), after)).toEqual({ kind: 'COMPLETED' });
    expect(arenaList(game.content.get(), after).map((n) => n.nodeId)).toEqual(expect.arrayContaining(['F00-D01', 'F00-D02', 'F00-D03']));
    expect([...campaignView(game.content.get(), after).statuses.values()].every((s) => s === 'CLEARED' || s === 'MASTERED')).toBe(true);
    expect((await startAttempt(game, { mode: 'CAMPAIGN', nodeId: 'C01-E01', difficulty: 'EXPERT', deckId: deckId(game) })).ok).toBe(true);
  });

  it('C-014: revisitar e perder não remove desbloqueios históricos', async () => {
    const game = await setup({ ai: attackerAi });
    await clearNodes(game, ['T01']);
    const view = () => campaignView(game.content.get(), snap(game)).statuses;
    expect(view().get('T02')).toBe('AVAILABLE');
    const grants = [...snap(game).grants];
    const session = await start(game, 'T01');
    await playOut(game, session, passiveHuman);
    expect(session.result?.outcome).toBe('LOSS');
    expect(progressMap(snap(game)).get('T01')).toMatchObject({ firstClearAttemptId: 'fixture-T01', losses: 1 });
    expect(view().get('T01')).toBe('CLEARED');
    expect(view().get('T02')).toBe('AVAILABLE');
    expect(snap(game).grants).toEqual(grants);
  });

  it('C-021: objetivo de composição usa o snapshot do deck na entrada, não a lista editada durante o duelo', async () => {
    const base = miniBundle();
    const tools = { objectiveId: 'T01-tools', scope: 'SINGLE_ATTEMPT' as const, requiresVictory: true, predicates: [{ type: 'DECK_COMPOSITION' as const, composition: { minSubtypeCopies: { TOOL: 2 } } }], description: 'Vencer com 2 Ferramentas no deck', reward: { credits: 25 }, claimPolicy: 'AUTOMATIC_ON_RESULT' as const, grantKey: 'objective:circuito-teste:T01-tools' };
    const bundle = withHash({ ...base, nodes: base.nodes.map((n) => (n.nodeId === 'T01' ? { ...n, optionalObjectiveIds: [...n.optionalObjectiveIds, 'T01-tools'] } : n)), objectives: [...base.objectives, tools] });
    const game = await setup({ bundle, ai: passiveAi });
    const id = deckId(game);
    const session = await start(game, 'T01');
    // Durante o duelo, o deck é editado e confirmado sem as Ferramentas (Talismã → Gota).
    const talisma = game.content.get().bundle.printings.find((p) => p.cardDefinitionId === S.talisma.id)!.printingId;
    const gota = game.content.get().bundle.printings.find((p) => p.cardDefinitionId === S.gota.id)!.printingId;
    let draft = draftFromRow(snap(game).decks.find((d) => d.deckId === id)!);
    draft = addCard(addCard(removeCard(removeCard(draft, talisma), talisma), gota), gota);
    expect(await confirmDeck(game, draft)).toMatchObject({ ok: true });
    expect(snap(game).decks.find((d) => d.deckId === id)!.confirmed!.entries.some((e) => e.printingId === talisma)).toBe(false);
    await playOut(game, session, greedy(game));
    expect(session.result?.outcome).toBe('WIN');
    expect(session.result?.completedObjectiveIds).toContain('T01-tools');
    expect(snap(game).grants).toContain('objective:circuito-teste:T01-tools');
  });

  it('C-052: o NPC exibe tema ainda bloqueado ao humano; ver não concede posse', async () => {
    const bundle = realBundle();
    const game = await setup({ bundle });
    await clearNodes(game, bundle.nodes.filter((n) => n.chapterId === 'P00').map((n) => n.nodeId));
    const owned = snap(game).entitlements.map((e) => e.cosmeticId);
    const session = await start(game, 'C01-E01', { difficulty: 'STORY' });
    const presentation = session.presentation as { cosmetics: { opponent: { playmatId: string } } };
    expect(presentation.cosmetics.opponent.playmatId).toBe('mat-c01-grove');
    expect(owned).not.toContain('mat-c01-grove');
    expect(snap(game).entitlements.map((e) => e.cosmeticId)).toEqual(owned);
    expect(cosmeticCatalog(game.content.get(), snap(game)).find((c) => c.cosmetic.cosmeticId === 'mat-c01-grove')?.owned).toBe(false);
    const attempt: PresetConfig = { presetId: 'p', playmatId: 'mat-c01-grove', sleeveId: 'sleeve-neutral', coinId: 'coin-neutral', defaultEntryFlairId: 'flair-basic', name: 'Bosque', variant: null, params: DEFAULT_PARAMS };
    expect(validatePreset(game.content.get(), snap(game), attempt).join(' ')).toMatch(/ainda não foi obtido/);
  });

  it('C-020/G-067/UI-022: objetivo opcional incompatível com o deck não bloqueia a batalha válida', async () => {
    const bundle = realBundle();
    const game = await setup({ bundle });
    await clearNodes(game, bundle.nodes.filter((n) => n.chapterId === 'P00').map((n) => n.nodeId));
    const deck = snap(game).decks.find((d) => d.name === 'Chama Constante')!;
    const r = await startAttempt(game, { mode: 'CAMPAIGN', nodeId: 'C01-E01', difficulty: 'STANDARD', deckId: deck.deckId });
    expect(r.ok).toBe(true);
    expect(game.content.get().nodes.get('C01-E01')!.optionalObjectiveIds).toContain('C01-E01-DECK');
  });
});

// ---------------------------------------------------------------- aparência e regras

describe('aparência congelada na tentativa e independente das regras', () => {
  const preset = (playmatId: string): PresetConfig => ({ presetId: 'novo', playmatId, sleeveId: 'sleeve-neutral', coinId: 'coin-neutral', defaultEntryFlairId: 'flair-basic', name: 'Meu preset', variant: null, params: DEFAULT_PARAMS });

  /** Pacote mínimo com verso, moeda, flair e um segundo tapete gratuitos (oficina de aparência utilizável). */
  function miniWithCosmetics(): BuiltBundle {
    const base = miniBundle();
    const mat = base.cosmetics[0]!;
    const free = (cosmeticId: string, kind: 'PLAYMAT' | 'SLEEVE' | 'COIN' | 'FLAIR') => ({ ...mat, cosmeticId, kind, names: { 'pt-BR': cosmeticId } });
    const extra = [free('mat-academy', 'PLAYMAT'), free('sleeve-neutral', 'SLEEVE'), free('coin-neutral', 'COIN'), free('flair-basic', 'FLAIR')];
    return withHash({
      ...base, cosmetics: [...base.cosmetics, ...extra],
      cosmeticPresets: [{ presetId: 'preset-player-default', playmatId: 'mat-neutral', sleeveId: 'sleeve-neutral', coinId: 'coin-neutral', defaultEntryFlairId: 'flair-basic' }],
      onboarding: { ...base.onboarding, cosmeticIds: [...base.onboarding.cosmeticIds, ...extra.map((c) => c.cosmeticId)] },
    });
  }

  it('G-087/UI-108: editar a aparência durante a suspensão só vale para a próxima tentativa', async () => {
    const bundle = miniWithCosmetics();
    const game = await setup({ bundle });
    const playmat = (s: BattleSession) => (s.presentation as { cosmetics: { player: { playmatId: string } } }).cosmetics.player.playmatId;
    const session = await start(game);
    expect(playmat(session)).toBe('mat-neutral');
    expect(await suspendAttempt(game, session)).toBe(true);
    const saved = await savePreset(game, preset('mat-academy'), { kind: 'PROFILE_DEFAULT' }, null);
    expect(saved.ok).toBe(true);
    const resumed = await resumeAttempt(game);
    if (!resumed.ok) throw new Error(resumed.message);
    expect(playmat(resumed.session)).toBe('mat-neutral');
    expect(resumed.session.state).toEqual(session.state);
    expect(await abandonAttempt(game, resumed.session)).toBe(true);
    expect(playmat(await start(game))).toBe('mat-academy');
  });

  it('G-081/C-055/VS-057: trocar tapete, verso ou moeda preserva ações legais, dano, distribuição e resultado', async () => {
    const bundle = miniWithCosmetics();
    const plain = await setup({ bundle, ai: attackerAi, platform: deterministicPlatform() });
    const styled = await setup({ bundle, ai: attackerAi, platform: deterministicPlatform() });
    expect((await savePreset(styled, preset('mat-academy'), { kind: 'PROFILE_DEFAULT' }, null)).ok).toBe(true);
    // Preferências de conforto (tapete fixo/neutro, movimento reduzido) também não entram no snapshot funcional.
    await saveSettings(styled, { playmatDisplayMode: 'NEUTRAL', reducedMotion: true, animationSpeed: 'INSTANT' });
    const a = await start(plain);
    const b = await start(styled);
    expect((b.presentation as { cosmetics: { player: { playmatId: string } } }).cosmetics.player.playmatId).toBe('mat-academy');
    expect(rulesOnly(b.state)).toEqual(rulesOnly(a.state));
    await playOut(plain, a, greedy(plain));
    await playOut(styled, b, greedy(styled));
    expect(rulesOnly(b.state)).toEqual(rulesOnly(a.state));
    expect(b.result?.outcome).toBe(a.result?.outcome);
  });
});
