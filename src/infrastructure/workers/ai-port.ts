// Fábrica da porta de IA usada pelo app (runtime §11). Padrão: module worker que recebe as definições e
// impressões do conteúdo carregado no INIT e planeja fora da thread de interface. Quando o ambiente não
// cria Workers, ou o worker recusa o INIT/cai, o mesmo planejador roda inline (mesma resposta, só que na
// thread atual). Erros do próprio job (ex.: decisão obrigatória sem resposta legal) não disparam o fallback.
import type { ContentIndex } from '../../application/content.ts';
import type { AiJob, AiPort, AiResult } from '../../application/ports/ai.ts';
import { createInlineAi, createWorkerAi, defaultWorker, isWorkerUnavailable, type WorkerLike } from './ai-client.ts';

export type AiPortOptions = {
  /** Cria o worker (padrão: module worker do Vite). Lançar aqui seleciona o planejador inline. */
  readonly workerFactory?: () => WorkerLike;
  /** Relógio do watchdog do planejador inline. */
  readonly clock?: () => number;
};

export function createAiPort(content: ContentIndex): AiPort {
  return createAiPortWith(content, {});
}

export function createAiPortWith(content: ContentIndex, options: AiPortOptions): AiPort {
  const catalog = content.catalog;
  const inline = (): AiPort => createInlineAi(catalog, options.clock);
  let worker: AiPort;
  try {
    worker = createWorkerAi(
      { cards: [...catalog.definitions.values()], printings: [...catalog.printings.values()] },
      options.workerFactory ?? defaultWorker,
    );
  } catch {
    return inline();
  }

  let fallback: AiPort | null = null;
  const useFallback = (): AiPort => {
    if (!fallback) {
      fallback = inline();
      worker.dispose();
    }
    return fallback;
  };

  return {
    plan: (job: AiJob): Promise<AiResult> => {
      if (fallback) return fallback.plan(job);
      return worker.plan(job).catch((error: unknown) => {
        if (!isWorkerUnavailable(error)) throw error;
        return useFallback().plan(job);
      });
    },
    cancel: (jobId: string) => {
      if (fallback) fallback.cancel(jobId);
      else worker.cancel(jobId);
    },
    dispose: () => {
      worker.dispose();
      fallback?.dispose();
    },
  };
}
