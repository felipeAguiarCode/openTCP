// Implementações do AiPort (runtime §11): worker de módulo (padrão do app) e planejador na própria thread
// (testes e fallback quando Workers não estão disponíveis). Ambos usam exatamente o mesmo planAction.
import type { AiJob, AiPort, AiResult } from '../../application/ports/ai.ts';
import { planAction, type PlannerCatalog } from '../../domain/ai/index.ts';
import type { CardDefinition, CardPrinting } from '../../domain/cards/types.ts';
import { isWorkerError, isWorkerReady, type AiWorkerRequest, type AiWorkerResponse } from './ai-worker.ts';

export const AI_JOB_CANCELLED = 'AI_JOB_CANCELLED';
export const AI_PORT_DISPOSED = 'AI_PORT_DISPOSED';
/** O worker não pôde ser usado (INIT recusado ou worker derrubado): o chamador pode recorrer ao planejador inline. */
export const AI_WORKER_UNAVAILABLE = 'AI_WORKER_UNAVAILABLE';

function codedError(code: string, message: string): Error {
  const error = new Error(`${code}: ${message}`);
  (error as Error & { code: string }).code = code;
  return error;
}

function hasCode(error: unknown, code: string): boolean {
  return error instanceof Error && (error as Error & { code?: string }).code === code;
}

/** Promessas de jobs cancelados são rejeitadas com este código; o chamador apenas as ignora. */
export function isCancelledJob(error: unknown): boolean {
  return hasCode(error, AI_JOB_CANCELLED);
}

/** Falha de infraestrutura do worker (não do job): replanejar na thread atual é seguro. */
export function isWorkerUnavailable(error: unknown): boolean {
  return hasCode(error, AI_WORKER_UNAVAILABLE);
}

/** Subconjunto de Worker usado pelo cliente (permite injetar um duplo nos testes). */
export type WorkerLike = {
  postMessage: (message: AiWorkerRequest) => void;
  terminate: () => void;
  onmessage: ((event: MessageEvent<AiWorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
};

export type WorkerAiContent = { readonly cards: readonly CardDefinition[]; readonly printings: readonly CardPrinting[] };

/** Module worker do Vite; lança quando o ambiente não oferece Workers (ex.: Node nos testes). */
export function defaultWorker(): WorkerLike {
  return new Worker(new URL('./ai-worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike;
}

export function createWorkerAi(content: WorkerAiContent, factory: () => WorkerLike = defaultWorker): AiPort {
  const worker = factory();
  const pending = new Map<string, { resolve: (r: AiResult) => void; reject: (e: Error) => void }>();
  let failure: Error | null = null;
  let disposed = false;

  const rejectAll = (error: Error) => {
    for (const p of pending.values()) p.reject(error);
    pending.clear();
  };

  worker.onmessage = (event) => {
    const msg = event.data;
    if (isWorkerReady(msg)) return;
    if (isWorkerError(msg)) {
      if (msg.jobId === null) {
        failure = codedError(AI_WORKER_UNAVAILABLE, msg.message);
        rejectAll(failure);
        return;
      }
      const p = pending.get(msg.jobId);
      pending.delete(msg.jobId);
      p?.reject(new Error(msg.message));
      return;
    }
    // Resultado de job cancelado ou desconhecido é descartado.
    const p = pending.get(msg.jobId);
    if (!p) return;
    pending.delete(msg.jobId);
    p.resolve(msg);
  };
  worker.onerror = (event) => {
    failure = codedError(AI_WORKER_UNAVAILABLE, `worker da IA falhou: ${event.message || 'erro sem mensagem'}`);
    rejectAll(failure);
  };
  worker.postMessage({ type: 'INIT', cards: content.cards, printings: content.printings });

  return {
    plan: (job: AiJob) => new Promise<AiResult>((resolve, reject) => {
      if (disposed) { reject(codedError(AI_PORT_DISPOSED, 'porta da IA encerrada')); return; }
      if (failure) { reject(failure); return; }
      pending.get(job.jobId)?.reject(codedError(AI_JOB_CANCELLED, `${job.jobId} substituído`));
      pending.set(job.jobId, { resolve, reject });
      worker.postMessage(job);
    }),
    cancel: (jobId: string) => {
      const p = pending.get(jobId);
      pending.delete(jobId);
      p?.reject(codedError(AI_JOB_CANCELLED, jobId));
      if (!disposed) worker.postMessage({ type: 'CANCEL', jobId });
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      worker.terminate();
      rejectAll(codedError(AI_PORT_DISPOSED, 'porta da IA encerrada'));
    },
  };
}

/** Mesmo planejador na thread atual (testes e fallback). O cálculo é adiado para permitir cancelamento. */
export function createInlineAi(catalog: PlannerCatalog, clock?: () => number): AiPort {
  const cancelled = new Set<string>();
  let disposed = false;
  return {
    plan: (job: AiJob) => new Promise<AiResult>((resolve, reject) => {
      cancelled.delete(job.jobId);
      setTimeout(() => {
        if (disposed) { reject(codedError(AI_PORT_DISPOSED, 'porta da IA encerrada')); return; }
        if (cancelled.delete(job.jobId)) { reject(codedError(AI_JOB_CANCELLED, job.jobId)); return; }
        try {
          resolve(planAction({ job, catalog, clock }));
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      }, 0);
    }),
    cancel: (jobId: string) => { cancelled.add(jobId); },
    dispose: () => { disposed = true; },
  };
}
