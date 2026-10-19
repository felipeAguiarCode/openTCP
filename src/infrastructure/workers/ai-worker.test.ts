// Protocolo do AI Worker e dos clientes AiPort, exercitados em Node sem um Worker real.
import { describe, expect, it } from 'vitest';
import type { AiResult } from '../../application/ports/ai.ts';
import { validateAction } from '../../domain/battle/engine.ts';
import { createAiJob, STANDARD_PROFILE } from '../../domain/ai/index.ts';
import { cat, newMatch, randomAdvance, untilMainOf } from '../../domain/ai/test-support.ts';
import { seedRng } from '../../domain/random/rng.ts';
import { indexContent } from '../../application/content.ts';
import { buildBundle } from '../../content/bundle.ts';
import { createMatch } from '../../domain/battle/setup.ts';
import { createInlineAi, createWorkerAi, isCancelledJob, isWorkerUnavailable, type WorkerLike } from './ai-client.ts';
import { createAiPort, createAiPortWith } from './ai-port.ts';
import { createAiWorkerHandler, type AiWorkerRequest, type AiWorkerResponse } from './ai-worker.ts';

const content = { cards: [...cat.definitions.values()], printings: [...cat.printings.values()] };
const state = untilMainOf(randomAdvance(newMatch(17, 'FIRE', 'GRASS'), 17, 22), 'B', 17);
const jobFor = (jobId: string) => createAiJob({ state, catalog: cat, aiPlayer: 'B', profile: STANDARD_PROFILE, aiRng: seedRng(3), jobId, attemptId: 'w', writerEpoch: 1 });

/** Handler com agendamento manual (simula o laço de eventos do worker). */
function harness() {
  const out: AiWorkerResponse[] = [];
  const pending: (() => void)[] = [];
  const handle = createAiWorkerHandler((m) => out.push(m), { schedule: (run) => pending.push(run), clock: () => 0 });
  const flush = () => { while (pending.length) pending.shift()!(); };
  return { out, handle, flush };
}

describe('AI Worker — protocolo', () => {
  it('INIT → READY; PLAN_ACTION → AiResult legal no estado real', () => {
    const h = harness();
    h.handle({ type: 'INIT', cards: content.cards, printings: content.printings });
    expect(h.out).toEqual([{ type: 'READY' }]);
    h.handle(jobFor('job-1'));
    h.flush();
    const result = h.out[1] as AiResult;
    expect(result.jobId).toBe('job-1');
    expect(result.fallback).toBe(false);
    expect(validateAction(state, cat, result.action).ok).toBe(true);
  });

  it('PLAN_ACTION antes do INIT responde ERROR com o jobId', () => {
    const h = harness();
    h.handle(jobFor('job-x'));
    h.flush();
    expect(h.out).toEqual([{ type: 'ERROR', jobId: 'job-x', message: expect.stringContaining('AI_NOT_INITIALIZED') }]);
  });

  it('CANCEL descarta o resultado do job cancelado', () => {
    const h = harness();
    h.handle({ type: 'INIT', cards: content.cards, printings: content.printings });
    h.handle(jobFor('job-a'));
    h.handle(jobFor('job-b'));
    h.handle({ type: 'CANCEL', jobId: 'job-a' });
    h.flush();
    const ids = h.out.filter((m): m is AiResult => 'jobId' in m && !('type' in m)).map((m) => m.jobId);
    expect(ids).toEqual(['job-b']);
  });

  it('INIT com conteúdo inválido responde ERROR sem jobId', () => {
    const h = harness();
    h.handle({ type: 'INIT', cards: [], printings: content.printings });
    expect(h.out[0]).toMatchObject({ type: 'ERROR', jobId: null });
  });
});

/** Worker falso ligado ao handler real (mensagens assíncronas como num Worker). */
function fakeWorker(): WorkerLike {
  const worker: WorkerLike = {
    onmessage: null,
    onerror: null,
    postMessage: (msg: AiWorkerRequest) => { setTimeout(() => handle(structuredClone(msg)), 0); },
    terminate: () => { worker.onmessage = null; },
  };
  const handle = createAiWorkerHandler((m) => setTimeout(() => worker.onmessage?.({ data: structuredClone(m) } as MessageEvent<AiWorkerResponse>), 0));
  return worker;
}

/** Worker que cai ao receber o primeiro job (erro de script/memória dentro do worker). */
function crashingWorker(): WorkerLike {
  const worker: WorkerLike = {
    onmessage: null,
    onerror: null,
    postMessage: (msg: AiWorkerRequest) => {
      if (msg.type === 'INIT') setTimeout(() => worker.onmessage?.({ data: { type: 'READY' } } as MessageEvent<AiWorkerResponse>), 0);
      if (msg.type === 'PLAN_ACTION') setTimeout(() => worker.onerror?.({ message: 'out of memory' } as ErrorEvent), 0);
    },
    terminate: () => undefined,
  };
  return worker;
}

describe('Clientes AiPort', () => {
  it('createWorkerAi: plan resolve com o resultado; cancel rejeita como cancelado', async () => {
    const port = createWorkerAi(content, fakeWorker);
    const result = await port.plan(jobFor('c-1'));
    expect(validateAction(state, cat, result.action).ok).toBe(true);
    const cancelled = port.plan(jobFor('c-2'));
    port.cancel('c-2');
    await expect(cancelled).rejects.toSatisfy(isCancelledJob);
    port.dispose();
    await expect(port.plan(jobFor('c-3'))).rejects.toThrow(/AI_PORT_DISPOSED/);
  });

  it('createInlineAi: mesmo planejador e mesma resposta que o worker', async () => {
    const inline = createInlineAi(cat, () => 0);
    const worker = createWorkerAi(content, fakeWorker);
    const [a, b] = await Promise.all([inline.plan(jobFor('i-1')), worker.plan(jobFor('i-1'))]);
    expect(a).toEqual(b);
    const cancelled = inline.plan(jobFor('i-2'));
    inline.cancel('i-2');
    await expect(cancelled).rejects.toSatisfy(isCancelledJob);
    worker.dispose();
    inline.dispose();
  });
});

describe('createAiPort (integração do app)', () => {
  const index = indexContent({ ...buildBundle(), contentHash: 'test' });
  const npcDeck = index.decks.get(index.nodes.get('C01-E06')!.difficultyProfiles!.STANDARD.npcDeckId)!;
  const support = index.decks.get('support-c01-v1')!;
  const cards = (deck: typeof npcDeck) => deck.entries.flatMap((e) => Array.from({ length: e.count }, () => ({ printingId: e.printingId, definitionKey: index.catalog.definitionKeyOfPrinting(e.printingId) })));
  const real = createMatch({
    matchId: 'port', seed: 4, players: { A: { deck: cards(support), energyTypes: support.energyTypes }, B: { deck: cards(npcDeck), energyTypes: npcDeck.energyTypes } },
  }, index.catalog).state;
  const profile = index.aiProfiles.get(index.nodes.get('C01-E06')!.difficultyProfiles!.STANDARD.aiProfileId)!;
  const realJob = (jobId: string) => createAiJob({ state: real, catalog: index.catalog, aiPlayer: 'B', profile, aiRng: seedRng(8), jobId, attemptId: 'p', writerEpoch: 1 });

  it('sem Worker no ambiente (Node) usa o planejador inline com o catálogo do conteúdo', async () => {
    const port = createAiPort(index);
    const result = await port.plan(realJob('p-1'));
    expect(result.jobId).toBe('p-1');
    expect(result.fallback).toBe(false);
    expect(validateAction(real, index.catalog, result.action).ok).toBe(true);
    port.dispose();
  });

  it('com worker: INIT leva as cartas e impressões do conteúdo e a resposta é a mesma do inline', async () => {
    const inits: AiWorkerRequest[] = [];
    const port = createAiPortWith(index, {
      workerFactory: () => {
        const w = fakeWorker();
        const post = w.postMessage;
        w.postMessage = (msg) => { if (msg.type === 'INIT') inits.push(msg); post(msg); };
        return w;
      },
    });
    const inline = createInlineAi(index.catalog);
    const [a, b] = await Promise.all([port.plan(realJob('p-2')), inline.plan(realJob('p-2'))]);
    expect(a).toEqual(b);
    expect(inits).toHaveLength(1);
    const init = inits[0] as Extract<AiWorkerRequest, { type: 'INIT' }>;
    expect(init.cards).toHaveLength(index.catalog.definitions.size);
    expect(init.printings).toHaveLength(index.catalog.printings.size);
    port.dispose();
    inline.dispose();
  });

  it('worker que cai no meio do job: replaneja inline; falhas posteriores também', async () => {
    const port = createAiPortWith(index, { workerFactory: crashingWorker });
    const first = await port.plan(realJob('p-3'));
    expect(validateAction(real, index.catalog, first.action).ok).toBe(true);
    const second = await port.plan(realJob('p-4'));
    expect(second.jobId).toBe('p-4');
    port.dispose();
  });

  it('INIT recusado pelo worker e fábrica que lança: ambos recorrem ao inline', async () => {
    const refused = createWorkerAi({ cards: [], printings: content.printings }, fakeWorker);
    await expect(refused.plan(jobFor('r-1'))).rejects.toSatisfy(isWorkerUnavailable);
    refused.dispose();
    const throwing = createAiPortWith(index, { workerFactory: () => { throw new Error('Worker indisponível'); } });
    const result = await throwing.plan(realJob('p-5'));
    expect(validateAction(real, index.catalog, result.action).ok).toBe(true);
    throwing.dispose();
  });

  it('erros do job (não de infraestrutura) chegam ao chamador sem fallback', async () => {
    const port = createAiPortWith(index, { workerFactory: fakeWorker });
    const job = realJob('p-6');
    const broken = { ...job, observation: { ...job.observation, legalActions: [] } };
    await expect(port.plan(broken)).rejects.toThrow(/AI_NO_LEGAL_ACTION/);
    port.dispose();
  });
});
