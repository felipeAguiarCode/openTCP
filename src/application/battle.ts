// Controlador de duelo (gameplay §27, §29; runtime §3, §6, §11; persistencia §16–§17).
// Cada ação aceita é confirmada no SQLite antes de ser apresentada; a IA nunca recebe o estado completo.
import { applyAction, getPlayerView, redactEvents, validateAction } from '../domain/battle/engine.ts';
import { createMatch, createMatchFromFixture, ENGINE_VERSION } from '../domain/battle/setup.ts';
import type { Action, BattleEvent, MatchState, PlayerId } from '../domain/battle/types.ts';
import type { BattleView } from '../domain/battle/views.ts';
import { deckFacts } from '../domain/campaign/facts.ts';
import { evaluateObjectives } from '../domain/campaign/objectives.ts';
import { EMPTY_PROGRESS, applicableObjectiveIds, type NodeProgress } from '../domain/campaign/progress.ts';
import { planResultGrants, type GrantPlan } from '../domain/campaign/rewards.ts';
import { packResource } from '../domain/economy/packs.ts';
import { jcsHash } from '../domain/hash/jcs.ts';
import { seedRng, type RngState } from '../domain/random/rng.ts';
import type { AiProfile, CampaignNode, ContentFixture, Difficulty } from '../content/types.ts';
import { resolveCommand } from '../content/source/script.ts';
import { effectiveConfig, neutralConfig } from './appearance.ts';
import { contentDeckEntries, deckCards } from './content.ts';
import { drawAttemptSeeds, profileRng, reloadSnapshot, requireSnapshot, type GameContext } from './context.ts';
import { progressMap } from './economy.ts';
import type { JsonValue, Mutation, StorageError } from './ports/storage.ts';

export const HUMAN: PlayerId = 'A';
export const NPC: PlayerId = 'B';
export const PRESENTATION_VERSION = 'pocket-light-v1';

export type AttemptMode = 'CAMPAIGN' | 'ARENA' | 'TRAINING' | 'CUSTOM' | 'LAB';

export type BattleSession = {
  readonly attemptId: string;
  readonly mode: AttemptMode;
  readonly nodeId: string | null;
  readonly difficulty: Difficulty | null;
  readonly deckId: string | null;
  readonly deckRevision: number | null;
  readonly aiProfile: AiProfile;
  readonly npcDeckList: readonly string[];
  readonly presentation: JsonValue;
  readonly progressionEligible: boolean;
  /** Sementes sorteadas na criação (persistencia: `attempts.rng_json`), preservadas a cada gravação. */
  readonly seeds: { readonly battleSeed: number; readonly aiSeed: number } | null;
  state: MatchState;
  aiRng: RngState;
  /** Próximo passo do `npcScript` da fixture; esgotado (= tamanho) quando o jogador sai do roteiro. */
  npcScriptCursor: number;
  paused: boolean;
  writerEpoch: number;
  lastEventSeq: number;
  result: BattleResultSummary | null;
};

export type BattleUpdate = {
  readonly actor: PlayerId;
  readonly before: BattleView;
  readonly after: BattleView;
  readonly events: readonly BattleEvent[];
};

export type BattleResultSummary = {
  readonly outcome: 'WIN' | 'LOSS' | 'DRAW' | 'ABANDONED';
  readonly reason: string;
  readonly points: Readonly<Record<PlayerId, number>>;
  readonly completedObjectiveIds: readonly string[];
  readonly newObjectiveIds: readonly string[];
  readonly grants: GrantPlan | null;
  readonly unlockedNodeIds: readonly string[];
  readonly ownTurns: number;
};

export type StartAttemptInput = {
  readonly mode: AttemptMode;
  readonly nodeId: string | null;
  readonly difficulty: Difficulty;
  readonly deckId: string | null;
  /** Para treino/LAB sem nó: deck e perfil de IA do oponente escolhidos. */
  readonly opponentDeckId?: string;
  readonly aiProfileId?: string;
  /** Lista de impressões do jogador quando não se usa um deck salvo (deck de apoio). */
  readonly loanDeckId?: string;
};

type Fail = StorageError;
const fail = (code: StorageError['code'], message: string): Fail => ({ ok: false, code, message });

function humanView(state: MatchState, ctx: GameContext): BattleView {
  return getPlayerView(state, ctx.content.get().catalog, HUMAN);
}

/** Congela as duas aparências no snapshot da tentativa (interface §23.24): deck > perfil > neutro; NPC pelo conteúdo. */
function resolveCosmetics(ctx: GameContext, deckId: string | null, npcPresetId: string | null): JsonValue {
  const snap = requireSnapshot(ctx);
  const content = ctx.content.get();
  const player = effectiveConfig(content, snap, deckId).config;
  const npc = content.bundle.cosmeticPresets.find((p) => p.presetId === npcPresetId) ?? neutralConfig(content);
  return { player: player as unknown as JsonValue, opponent: npc as unknown as JsonValue };
}

export async function startAttempt(ctx: GameContext, input: StartAttemptInput): Promise<{ ok: true; session: BattleSession; update: BattleUpdate } | Fail> {
  const snap = requireSnapshot(ctx);
  if (snap.activeAttempt) return fail('ACTIVE_ATTEMPT_EXISTS', 'Retome ou abandone a tentativa atual antes de iniciar outra.');
  const content = ctx.content.get();
  const node: CampaignNode | null = input.nodeId ? content.nodes.get(input.nodeId) ?? null : null;
  if (input.nodeId && !node) return fail('NOT_FOUND', 'Encontro desconhecido.');
  // A aplicação também protege a ordem da campanha (não só a UI): pré-requisitos vencidos ou Descoberta escolhida.
  if (node && input.mode === 'CAMPAIGN') {
    const progress = progressMap(snap);
    const open = node.prerequisites.allOf.every((p) => progress.get(p)?.firstClearAttemptId || progress.get(p)?.discoveryChoice);
    if (!open) return fail('NOT_FOUND', 'Este encontro ainda está bloqueado: conclua os anteriores.');
  }
  // Deck do jogador: salvo (revisão CONFIRMED) ou de apoio/empréstimo.
  let playerPrintings: string[] = [];
  let energyTypes: string[] = [];
  let deckRevision: number | null = null;
  if (input.loanDeckId) {
    const loan = content.decks.get(input.loanDeckId);
    if (!loan) return fail('NOT_FOUND', 'Deck de apoio inexistente.');
    playerPrintings = contentDeckEntries(loan);
    energyTypes = [...loan.energyTypes];
  } else if (input.deckId) {
    const deck = snap.decks.find((d) => d.deckId === input.deckId);
    if (!deck || deck.archived || !deck.confirmed) return fail('NOT_FOUND', 'Deck não confirmado.');
    // O duelo usa a última versão confirmada; rascunhos mais novos não entram (interface §14.14).
    playerPrintings = deck.confirmed.entries.map((e) => e.printingId);
    energyTypes = [...deck.confirmed.energyTypes];
    deckRevision = deck.confirmed.revision;
  }
  const fixture = node?.fixtureId ? content.fixtures.get(node.fixtureId) ?? null : null;
  if (!fixture && playerPrintings.length !== 20) return fail('NOT_FOUND', 'O deck precisa conter exatamente 20 cartas.');
  const profiles = node?.difficultyProfiles?.[input.difficulty] ?? (input.opponentDeckId && input.aiProfileId ? { npcDeckId: input.opponentDeckId, aiProfileId: input.aiProfileId } : null);
  const npcDeck = profiles ? content.decks.get(profiles.npcDeckId) : null;
  const aiProfile = profiles ? content.aiProfiles.get(profiles.aiProfileId) : content.bundle.aiProfiles.find((p) => p.policy === input.difficulty);
  if (!aiProfile) return fail('CONTENT_REFERENCE_MISSING', 'Perfil de IA ausente.');
  if (!fixture && !npcDeck) return fail('CONTENT_REFERENCE_MISSING', 'Deck do adversário ausente.');
  const rng = profileRng(snap);
  const seeds = drawAttemptSeeds(rng);
  const attemptId = ctx.platform.newId('attempt');
  const matchId = attemptId;
  const roleTags = node?.roleTags ?? {};
  const created = fixture
    ? createMatchFromFixture(fixture, matchId, seeds.battleSeed, content.catalog, (pid) => content.catalog.definitionKeyOfPrinting(pid), roleTags)
    : createMatch({
      matchId, seed: seeds.battleSeed, roleTags,
      players: {
        A: { deck: deckCards(content, playerPrintings.map((printingId) => ({ printingId }))), energyTypes: energyTypes as never },
        B: { deck: deckCards(content, contentDeckEntries(npcDeck!).map((printingId) => ({ printingId }))), energyTypes: [...npcDeck!.energyTypes] },
      },
    }, content.catalog);
  const npcDeckList = npcDeck ? contentDeckEntries(npcDeck).map((pid) => content.catalog.definitionKeyOfPrinting(pid)) : [];
  const npc = node ? content.npcs.get(node.npcId) : null;
  const presentation = {
    presentationVersion: PRESENTATION_VERSION,
    arenaId: node?.arenaId ?? 'arena-academy',
    cosmetics: resolveCosmetics(ctx, input.deckId, npc?.cosmeticPresetId ?? null),
  } as JsonValue;
  const progressionEligible = input.mode === 'CAMPAIGN' || input.mode === 'ARENA' || input.mode === 'CUSTOM';
  const session: BattleSession = {
    attemptId, mode: input.mode, nodeId: node?.nodeId ?? null, difficulty: input.difficulty, deckId: input.deckId,
    deckRevision, aiProfile, npcDeckList, presentation, progressionEligible,
    seeds: { battleSeed: seeds.battleSeed, aiSeed: seeds.aiSeed }, state: created.state, aiRng: seedRng(seeds.aiSeed), npcScriptCursor: 0,
    paused: false, writerEpoch: snap.profile.writerEpoch, lastEventSeq: 0, result: null,
  };
  const events = created.events;
  const mutations: Mutation[] = [
    { kind: 'SET_PROFILE_RNG', rngJson: seeds.next as unknown as JsonValue },
    {
      kind: 'INSERT_ATTEMPT', attemptId, mode: input.mode, campaignId: node ? content.bundle.campaignId : null, nodeId: node?.nodeId ?? null,
      difficulty: node || input.mode === 'ARENA' ? input.difficulty : null, deckId: input.deckId, deckRevision,
      progressionEligible: session.progressionEligible, stateVersion: created.state.stateVersion, rulesetId: created.state.config.rulesetId,
      engineVersion: created.state.engineVersion, contentFingerprint: content.bundle.contentHash,
      state: created.state as unknown as JsonValue, rng: rngJson(session),
      presentationSnapshot: { ...(presentation as object), aiProfileId: aiProfile.aiProfileId, npcDeckList, loanDeckId: input.loanDeckId ?? null } as JsonValue,
      cardRefs: [...new Set(Object.values(created.state.cards).map((c) => c.printingId))], assetRefs: cosmeticAssetRefs(presentation),
    },
    ...eventMutations(attemptId, created.state.stateVersion, events),
  ];
  const commit = await ctx.bus.execute({
    commandType: 'START_ATTEMPT', profileId: snap.profile.profileId, expectedRevision: snap.profile.revision, writerEpoch: snap.profile.writerEpoch,
    payload: { attemptId, nodeId: node?.nodeId ?? null, difficulty: input.difficulty, deckId: input.deckId, mode: input.mode },
    mutations, summary: { attemptId, nodeId: node?.nodeId ?? null, mode: input.mode }, events: eventRange(events),
  });
  if (!commit.ok) return commit;
  session.lastEventSeq = events.length ? events[events.length - 1]!.seq : 0;
  await reloadSnapshot(ctx);
  const view = humanView(session.state, ctx);
  return { ok: true, session, update: { actor: HUMAN, before: view, after: view, events: redactEvents(events, HUMAN) } };
}

function rngJson(session: BattleSession): JsonValue {
  return { aiRng: session.aiRng, ...(session.seeds ?? {}), npcScriptCursor: session.npcScriptCursor } as unknown as JsonValue;
}

/** Fixture da tentativa (tutorial/puzzle), com roteiro e dicas; null em duelos normais. */
export function sessionFixture(ctx: GameContext, session: BattleSession): ContentFixture | null {
  const content = ctx.content.get();
  const node = session.nodeId ? content.nodes.get(session.nodeId) : null;
  return node?.fixtureId ? content.fixtures.get(node.fixtureId) ?? null : null;
}

/**
 * Próxima jogada roteirizada do NPC (campanha §13): a fixture validada no build define as respostas do
 * NPC. Se o jogador sai do roteiro e o passo deixa de ser aplicável, o roteiro é encerrado e a IA assume.
 */
function scriptedNpcAction(ctx: GameContext, session: BattleSession): Action | null {
  const script = sessionFixture(ctx, session)?.npcScript ?? [];
  const step = script[session.npcScriptCursor];
  if (!step) return null;
  const action = resolveCommand(session.state, NPC, step.command);
  if (action && validateAction(session.state, ctx.content.get().catalog, action).ok) return action;
  session.npcScriptCursor = script.length;
  return null;
}

/** Mesma versão maior do motor (`engine-<maior>.<menor>.<correção>`): estados serializados compatíveis. */
export function engineCompatible(saved: string, running: string): boolean {
  const major = (v: string) => /^engine-(\d+)\./.exec(v)?.[1] ?? v;
  return major(saved) === major(running);
}

/** Assets referenciados pela aparência congelada (imagem local do tapete), para backup e retomada. */
function cosmeticAssetRefs(presentation: JsonValue): string[] {
  const cos = (presentation as { cosmetics?: { player?: { customImage?: { assetId?: string } | null }; opponent?: { customImage?: { assetId?: string } | null } } }).cosmetics;
  return [...new Set([cos?.player?.customImage?.assetId, cos?.opponent?.customImage?.assetId].filter((x): x is string => typeof x === 'string'))];
}

function eventRange(events: readonly BattleEvent[]): { first: number; last: number } | null {
  return events.length ? { first: events[0]!.seq, last: events[events.length - 1]!.seq } : null;
}

function eventMutations(attemptId: string, stateVersion: number, events: readonly BattleEvent[]): Mutation[] {
  if (!events.length) return [];
  return [{ kind: 'INSERT_BATTLE_EVENTS', attemptId, stateVersion, events: events.map((e) => ({ seq: e.seq, type: e.type, event: e as unknown as JsonValue })) }];
}

export async function resumeAttempt(ctx: GameContext): Promise<{ ok: true; session: BattleSession; view: BattleView } | Fail> {
  const snap = requireSnapshot(ctx);
  const active = snap.activeAttempt;
  if (!active) return fail('NOT_FOUND', 'Nenhuma tentativa ativa.');
  const row = await ctx.storage.query({ kind: 'GET_ATTEMPT', attemptId: active.attemptId });
  if (!row) return fail('NOT_FOUND', 'Tentativa não encontrada.');
  const content = ctx.content.get();
  const presentation = row.presentationSnapshot as { aiProfileId: string; npcDeckList: string[] };
  const aiProfile = content.aiProfiles.get(presentation.aiProfileId);
  if (!aiProfile) return fail('CONTENT_REFERENCE_MISSING', 'Perfil de IA ausente.');
  // R-031: retomar exige motor da mesma versão maior e o mesmo ruleset; conteúdo novo é aceito enquanto as
  // versões fixadas na entrada continuarem no catálogo (G-060).
  if (!engineCompatible(row.engineVersion, ENGINE_VERSION) || row.rulesetId !== content.bundle.rulesetId) {
    return fail('SAVE_VERSION_UNSUPPORTED', 'Esta tentativa foi criada por outra versão das regras do jogo e não pode ser retomada nesta versão.');
  }
  const state = row.state as unknown as MatchState;
  const missing = Object.values(state.cards).find((c) => !content.catalog.definitions.has(c.definitionKey));
  if (missing) return fail('CONTENT_REFERENCE_MISSING', `A tentativa usa uma carta ausente deste pacote (${missing.definitionKey}).`);
  const rng = row.rng as unknown as { aiRng: RngState; battleSeed?: number; aiSeed?: number; npcScriptCursor?: number };
  const session: BattleSession = {
    attemptId: row.attemptId, mode: row.mode as AttemptMode, nodeId: row.nodeId, difficulty: row.difficulty as Difficulty | null,
    deckId: row.deckId, deckRevision: row.deckRevision, aiProfile, npcDeckList: presentation.npcDeckList ?? [],
    presentation: row.presentationSnapshot, progressionEligible: row.progressionEligible,
    seeds: rng.battleSeed !== undefined && rng.aiSeed !== undefined ? { battleSeed: rng.battleSeed, aiSeed: rng.aiSeed } : null,
    state, aiRng: rng.aiRng, npcScriptCursor: rng.npcScriptCursor ?? 0, paused: false, writerEpoch: snap.profile.writerEpoch, lastEventSeq: state.eventSeq, result: null,
  };
  if (row.status === 'SUSPENDED') await setAttemptStatus(ctx, session, 'RUNNING');
  return { ok: true, session, view: humanView(session.state, ctx) };
}

/**
 * Uma gravação por vez em cada sessão (persistencia §12): ações do humano, do NPC (roteiro/IA), pausa e
 * abandono entram em fila. Cada uma valida contra o estado já confirmado e lê a revisão do perfil depois
 * do commit anterior — decisões simultâneas (preparação, promoções) não geram conflito de revisão.
 */
const writeChains = new WeakMap<BattleSession, Promise<unknown>>();

function serialized<T>(session: BattleSession, fn: () => Promise<T>): Promise<T> {
  const previous = writeChains.get(session) ?? Promise.resolve();
  const run = previous.then(fn, fn);
  writeChains.set(session, run.catch(() => undefined));
  return run;
}

function setAttemptStatus(ctx: GameContext, session: BattleSession, status: 'RUNNING' | 'SUSPENDED'): Promise<boolean> {
  return serialized(session, () => writeAttemptStatus(ctx, session, status));
}

async function writeAttemptStatus(ctx: GameContext, session: BattleSession, status: 'RUNNING' | 'SUSPENDED'): Promise<boolean> {
  const snap = requireSnapshot(ctx);
  const r = await ctx.bus.execute({
    commandType: 'SUSPEND_ATTEMPT', profileId: snap.profile.profileId, expectedRevision: snap.profile.revision, writerEpoch: snap.profile.writerEpoch,
    payload: { attemptId: session.attemptId, status, stateVersion: session.state.stateVersion },
    mutations: [{ kind: 'UPDATE_ATTEMPT', attemptId: session.attemptId, expectedStateVersion: session.state.stateVersion, stateVersion: session.state.stateVersion, status, state: session.state as unknown as JsonValue, rng: rngJson(session), result: null }],
    summary: { attemptId: session.attemptId, status },
  });
  if (r.ok) await reloadSnapshot(ctx);
  return r.ok;
}

/** Pausa real: nenhuma ação da IA é aplicada enquanto suspensa (G-063, R-020). */
export async function suspendAttempt(ctx: GameContext, session: BattleSession): Promise<boolean> {
  session.paused = true;
  return setAttemptStatus(ctx, session, 'SUSPENDED');
}

function applyOrThrow(ctx: GameContext, session: BattleSession, action: Action) {
  const cat = ctx.content.get().catalog;
  const v = validateAction(session.state, cat, action);
  if (!v.ok) return { ok: false as const, code: v.code, message: v.message };
  const r = applyAction(session.state, cat, action);
  if (!r.ok) return { ok: false as const, code: r.code, message: r.message };
  return r;
}

/** Confirma uma ação (humana ou da IA) e, se a partida terminou, a transação de resultado no mesmo commit. */
async function commitAction(ctx: GameContext, session: BattleSession, action: Action): Promise<{ ok: true; update: BattleUpdate } | { ok: false; code: string; message?: string }> {
  const before = humanView(session.state, ctx);
  const applied = applyOrThrow(ctx, session, action);
  if (!applied.ok) return applied;
  const next = applied.state;
  const snap = requireSnapshot(ctx);
  const terminal = next.result !== null;
  const mutations: Mutation[] = [
    { kind: 'UPDATE_ATTEMPT', attemptId: session.attemptId, expectedStateVersion: session.state.stateVersion, stateVersion: next.stateVersion, status: terminal ? 'FINISHED' : 'RUNNING', state: next as unknown as JsonValue, rng: rngJson(session), result: null },
    ...eventMutations(session.attemptId, next.stateVersion, applied.events),
  ];
  if (applied.events.some((e) => e.type === 'TURN_STARTED')) {
    mutations.push({ kind: 'INSERT_CHECKPOINT', attemptId: session.attemptId, stateVersion: next.stateVersion, lastEventSequence: next.eventSeq, snapshot: next as unknown as JsonValue, snapshotHash: jcsHash(next) });
  }
  let summary: BattleResultSummary | null = null;
  let grantKeys: string[] = [];
  if (terminal) {
    const finish = finishMutations(ctx, session, next);
    summary = finish.summary;
    grantKeys = [...finish.grantKeys];
    // O resultado final substitui o UPDATE_ATTEMPT acima com result_json.
    mutations[0] = { ...(mutations[0] as Extract<Mutation, { kind: 'UPDATE_ATTEMPT' }>), result: finish.resultJson };
    mutations.push(...finish.mutations);
  }
  const commit = await ctx.bus.execute({
    commandType: terminal ? 'FINISH_ATTEMPT' : 'SUBMIT_BATTLE_ACTION', profileId: snap.profile.profileId,
    expectedRevision: snap.profile.revision, writerEpoch: session.writerEpoch,
    payload: { attemptId: session.attemptId, stateVersion: session.state.stateVersion, action: action as unknown as JsonValue },
    mutations, grantKeys, summary: { attemptId: session.attemptId, stateVersion: next.stateVersion, actionType: action.type }, events: eventRange(applied.events),
  });
  if (!commit.ok) return { ok: false, code: commit.code, message: commit.message };
  session.state = next;
  session.lastEventSeq = next.eventSeq;
  session.result = summary;
  await reloadSnapshot(ctx);
  return { ok: true, update: { actor: action.player, before, after: humanView(next, ctx), events: redactEvents(applied.events, HUMAN) } };
}

export async function submitHumanAction(ctx: GameContext, session: BattleSession, action: Action) {
  if (action.player !== HUMAN) return { ok: false as const, code: 'NOT_YOUR_TURN' };
  return serialized(session, () => commitAction(ctx, session, action));
}

export function aiShouldAct(session: BattleSession): boolean {
  const s = session.state;
  if (s.result || session.paused) return false;
  if (s.pendingDecisions.some((d) => d.player === NPC && !d.answered)) return true;
  return s.pendingDecisions.length === 0 && s.phase === 'MAIN' && s.currentPlayer === NPC;
}

/** Executa um passo da IA (uma ação) via worker; descarta resultado obsoleto (R-022, AI_JOB_STALE). */
export async function runAiStep(ctx: GameContext, session: BattleSession) {
  if (!aiShouldAct(session)) return { ok: false as const, code: 'NOT_YOUR_TURN' };
  if (sessionFixture(ctx, session)?.npcScript?.length) {
    const outcome = await serialized(session, async () => {
      if (!aiShouldAct(session)) return { ok: false as const, code: 'NOT_YOUR_TURN' };
      const scripted = scriptedNpcAction(ctx, session);
      if (!scripted) return null;
      session.npcScriptCursor += 1;
      const r = await commitAction(ctx, session, scripted);
      if (!r.ok) session.npcScriptCursor -= 1;
      return r;
    });
    if (outcome) return outcome;
  }
  const cat = ctx.content.get().catalog;
  const observation = getPlayerView(session.state, cat, NPC);
  const seen = [...observation.sides.A.discard, ...[observation.sides.A.active, ...observation.sides.A.bench].flatMap((e) => (e ? e.stack : []))].map((c) => c.definitionKey);
  const revision = session.state.stateVersion;
  const jobId = ctx.platform.newId('ai-job');
  const result = await ctx.ai.plan({
    type: 'PLAN_ACTION', jobId, attemptId: session.attemptId, stateRevision: revision, writerEpoch: session.writerEpoch,
    aiProfile: session.aiProfile, observation, knowledge: { ownDeckList: session.npcDeckList, seenOpponentCards: seen }, aiRng: session.aiRng,
  });
  return serialized(session, async () => {
    if (session.paused || session.state.stateVersion !== revision || result.stateRevision !== revision) return { ok: false as const, code: 'AI_JOB_STALE' };
    session.aiRng = result.aiRng;
    return commitAction(ctx, session, result.action);
  });
}

export function abandonAttempt(ctx: GameContext, session: BattleSession): Promise<boolean> {
  return serialized(session, async () => {
    const conceded = applyOrThrow(ctx, session, { type: 'CONCEDE', player: HUMAN });
    if (!conceded.ok) return false;
    const r = await commitAction(ctx, session, { type: 'CONCEDE', player: HUMAN });
    return r.ok;
  });
}

// ---------------------------------------------------------------- transação de resultado

function finishMutations(ctx: GameContext, session: BattleSession, state: MatchState): { mutations: Mutation[]; grantKeys: string[]; summary: BattleResultSummary; resultJson: JsonValue } {
  const content = ctx.content.get();
  const snap = requireSnapshot(ctx);
  const result = state.result!;
  const won = result.outcome === 'WIN' && result.winner === HUMAN;
  const conceded = result.reason === 'CONCEDE' && result.winner === NPC;
  const outcome: BattleResultSummary['outcome'] = conceded ? 'ABANDONED' : result.outcome === 'DRAW' ? 'DRAW' : won ? 'WIN' : 'LOSS';
  const node = session.nodeId ? content.nodes.get(session.nodeId) ?? null : null;
  const mutations: Mutation[] = [];
  let completed: string[] = [];
  let plan: GrantPlan | null = null;
  const unlocked: string[] = [];
  if (node && session.progressionEligible && (session.mode === 'CAMPAIGN' || session.mode === 'ARENA')) {
    const humanPrintings = Object.values(state.cards).filter((c) => c.owner === HUMAN).map((c) => c.printingId);
    const facts = deckFacts(humanPrintings, state.players.A.energyZone.types, content.catalog, content.starterPrintingIds);
    const objectives = applicableObjectiveIds(node).map((id) => content.objectives.get(id)).filter((o): o is NonNullable<typeof o> => !!o);
    completed = session.mode === 'CAMPAIGN'
      ? evaluateObjectives(objectives, { human: HUMAN, result, stats: state.stats.A, ownTurns: state.ownTurns.A, deck: facts, turnLimit: node.turnLimit?.ownTurns ?? null })
      : [];
    plan = planResultGrants({
      campaignId: content.bundle.campaignId, node, mode: session.mode, won, completedObjectiveIds: completed,
      objectives: content.objectives, rewardTables: content.rewardTables, granted: new Set(snap.grants), progressionEligible: session.progressionEligible,
    });
    const progress = progressMap(snap);
    const before: NodeProgress = progress.get(node.nodeId) ?? EMPTY_PROGRESS;
    const wasCleared = before.firstClearAttemptId !== null;
    const next: NodeProgress & { medal?: string | null } = {
      ...before,
      firstClearAttemptId: before.firstClearAttemptId ?? (won && session.mode === 'CAMPAIGN' ? session.attemptId : null),
      clearedDifficulties: won && session.difficulty && !before.clearedDifficulties.includes(session.difficulty) ? [...before.clearedDifficulties, session.difficulty] : before.clearedDifficulties,
      completedObjectiveIds: [...new Set([...before.completedObjectiveIds, ...completed])],
      bestHumanTurnCount: won ? Math.min(before.bestHumanTurnCount ?? Number.MAX_SAFE_INTEGER, state.ownTurns.A) : before.bestHumanTurnCount,
      wins: before.wins + (won ? 1 : 0),
      losses: before.losses + (won || outcome === 'DRAW' ? 0 : 1),
      consecutiveLosses: won ? 0 : before.consecutiveLosses + (outcome === 'DRAW' ? 0 : 1),
      ...(plan.medal ? { medal: plan.medal } : {}),
    };
    if (session.mode === 'CAMPAIGN') {
      mutations.push({ kind: 'UPSERT_CAMPAIGN_PROGRESS', campaignId: content.bundle.campaignId, nodeId: node.nodeId, campaignVersion: content.bundle.version, status: wasCleared || won ? 'CLEARED' : 'AVAILABLE', progress: next as unknown as JsonValue });
      if (won && !wasCleared) {
        for (const other of content.nodeList) {
          if (other.prerequisites.allOf.includes(node.nodeId) && other.prerequisites.allOf.every((p) => p === node.nodeId || progress.get(p)?.firstClearAttemptId || progress.get(p)?.discoveryChoice)) unlocked.push(other.nodeId);
        }
      }
    }
    if (plan.credits > 0) mutations.push({ kind: 'WALLET_DELTA', resourceId: 'CREDITS', delta: plan.credits });
    for (const pack of plan.packs) mutations.push({ kind: 'WALLET_DELTA', resourceId: packResource(pack.productId), delta: pack.count });
    for (const cosmeticId of plan.cosmetics) if (!snap.entitlements.some((e) => e.cosmeticId === cosmeticId)) mutations.push({ kind: 'GRANT_ENTITLEMENT', cosmeticId, origin: 'MILESTONE' });
    if (plan.keyCard) {
      if (plan.keyCard.mode === 'FIXED') {
        for (const printingId of plan.keyCard.printingIds) mutations.push({ kind: 'INVENTORY_DELTA', printingId, delta: plan.keyCard.copies });
      } else {
        mutations.push({ kind: 'INSERT_PENDING_REWARD', rewardId: ctx.platform.newId('reward'), grantKey: `first-clear:${content.bundle.campaignId}:${node.nodeId}:key-card`, options: { printingIds: [...plan.keyCard.printingIds], copies: plan.keyCard.copies }, sourceAttemptId: session.attemptId });
      }
    }
  }
  mutations.push({ kind: 'INSERT_REPLAY', replayId: ctx.platform.newId('replay'), attemptId: session.attemptId, metadata: { nodeId: node?.nodeId ?? null, outcome, mode: session.mode, globalTurnNumber: result.globalTurnNumber } });
  const summary: BattleResultSummary = {
    outcome, reason: result.reason, points: result.points, completedObjectiveIds: completed, newObjectiveIds: plan?.newObjectiveIds ?? [],
    grants: plan, unlockedNodeIds: unlocked, ownTurns: state.ownTurns.A,
  };
  return { mutations, grantKeys: [...(plan?.grantKeys ?? [])], summary, resultJson: summary as unknown as JsonValue };
}
