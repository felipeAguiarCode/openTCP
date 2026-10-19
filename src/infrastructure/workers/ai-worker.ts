// AI Worker (runtime §11): carrega o mesmo bundle de domínio, recebe somente dados serializáveis e nunca
// toca DOM, Three.js ou SQLite. Protocolo:
//   → { type: 'INIT', cards, printings }   ← { type: 'READY' } | { type: 'ERROR', jobId: null, message }
//   → AiJob (type 'PLAN_ACTION')           ← AiResult | { type: 'ERROR', jobId, message }
//   → { type: 'CANCEL', jobId }            (resultado de job cancelado é descartado)
import type { AiJob, AiResult } from '../../application/ports/ai.ts';
import { planAction } from '../../domain/ai/index.ts';
import { buildCatalog, type Catalog } from '../../domain/cards/catalog.ts';
import type { CardDefinition, CardPrinting } from '../../domain/cards/types.ts';

export type AiWorkerInit = { readonly type: 'INIT'; readonly cards: readonly CardDefinition[]; readonly printings: readonly CardPrinting[] };
export type AiWorkerCancel = { readonly type: 'CANCEL'; readonly jobId: string };
export type AiWorkerRequest = AiWorkerInit | AiJob | AiWorkerCancel;

export type AiWorkerError = { readonly type: 'ERROR'; readonly jobId: string | null; readonly message: string };
export type AiWorkerReady = { readonly type: 'READY' };
export type AiWorkerResponse = AiResult | AiWorkerError | AiWorkerReady;

export function isWorkerError(msg: AiWorkerResponse): msg is AiWorkerError {
  return 'type' in msg && msg.type === 'ERROR';
}

export function isWorkerReady(msg: AiWorkerResponse): msg is AiWorkerReady {
  return 'type' in msg && msg.type === 'READY';
}

const MAX_CANCELLED = 256;

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export type AiWorkerHandlerOptions = {
  /** Agenda o processamento da fila (padrão: setTimeout 0, para que CANCELs já recebidos sejam vistos antes). */
  readonly schedule?: (run: () => void) => void;
  /** Relógio do watchdog. */
  readonly clock?: () => number;
};

/** Lógica do worker sem dependência do escopo global (testável em Node). */
export function createAiWorkerHandler(post: (msg: AiWorkerResponse) => void, options: AiWorkerHandlerOptions = {}): (msg: AiWorkerRequest) => void {
  const schedule = options.schedule ?? ((run: () => void) => { setTimeout(run, 0); });
  const clock = options.clock ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  let catalog: Catalog | null = null;
  const queue: AiJob[] = [];
  const cancelled = new Set<string>();
  let scheduled = false;

  const markCancelled = (jobId: string) => {
    cancelled.add(jobId);
    if (cancelled.size > MAX_CANCELLED) cancelled.delete(cancelled.values().next().value!);
  };

  const run = (job: AiJob) => {
    if (!catalog) {
      post({ type: 'ERROR', jobId: job.jobId, message: 'AI_NOT_INITIALIZED: catálogo ausente (envie INIT antes de PLAN_ACTION)' });
      return;
    }
    let result: AiResult;
    try {
      result = planAction({ job, catalog, clock });
    } catch (error) {
      if (!cancelled.has(job.jobId)) post({ type: 'ERROR', jobId: job.jobId, message: messageOf(error) });
      return;
    }
    if (cancelled.has(job.jobId)) return;
    post(result);
  };

  const drain = () => {
    scheduled = false;
    while (queue.length > 0) {
      const job = queue.shift()!;
      if (cancelled.has(job.jobId)) continue;
      run(job);
    }
  };

  return (msg: AiWorkerRequest) => {
    switch (msg.type) {
      case 'INIT':
        try {
          catalog = buildCatalog(msg.cards, msg.printings);
          post({ type: 'READY' });
        } catch (error) {
          catalog = null;
          post({ type: 'ERROR', jobId: null, message: messageOf(error) });
        }
        return;
      case 'CANCEL': {
        markCancelled(msg.jobId);
        const index = queue.findIndex((job) => job.jobId === msg.jobId);
        if (index >= 0) queue.splice(index, 1);
        return;
      }
      case 'PLAN_ACTION':
        cancelled.delete(msg.jobId);
        queue.push(msg);
        if (!scheduled) {
          scheduled = true;
          schedule(drain);
        }
        return;
      default:
        post({ type: 'ERROR', jobId: null, message: `AI_UNKNOWN_MESSAGE: ${(msg as { type?: unknown }).type}` });
    }
  };
}

// Ligação ao escopo do module worker (não executa fora de um Worker, por exemplo em testes Node).
type WorkerScope = {
  postMessage: (msg: unknown) => void;
  addEventListener: (type: 'message', listener: (event: MessageEvent<AiWorkerRequest>) => void) => void;
};

const workerScopeCtor = (globalThis as { WorkerGlobalScope?: abstract new () => unknown }).WorkerGlobalScope;
if (workerScopeCtor && globalThis instanceof workerScopeCtor) {
  const scope = globalThis as unknown as WorkerScope;
  const handle = createAiWorkerHandler((msg) => scope.postMessage(msg));
  scope.addEventListener('message', (event) => handle(event.data));
}
