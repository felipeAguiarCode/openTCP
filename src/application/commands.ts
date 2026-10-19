// Barramento de comandos: uma escrita em voo por perfil, payloadHash JCS, idempotência e recuperação
// de recibo após resposta perdida (persistencia §12–§13; runtime §3.4–§3.5).
import { jcsHash } from '../domain/hash/jcs.ts';
import type { CommandType, CommitOk, CommitRequest, JsonValue, Mutation, Receipt, StorageError, StoragePort } from './ports/storage.ts';
import type { Platform } from './ports/platform.ts';

export type CommandDraft = {
  readonly commandType: CommandType;
  readonly profileId: string;
  readonly expectedRevision: number;
  readonly writerEpoch: number;
  readonly payload: JsonValue;
  readonly mutations: readonly Mutation[];
  readonly grantKeys?: readonly string[];
  readonly summary: JsonValue;
  readonly events?: { readonly first: number; readonly last: number } | null;
  /** Reusar um commandId já emitido (reenvio do mesmo comando após resposta perdida). */
  readonly commandId?: string;
};

export type CommandBus = {
  readonly execute: (draft: CommandDraft) => Promise<CommitOk | StorageError>;
  readonly pending: () => boolean;
};

export function createCommandBus(storage: StoragePort, platform: Platform): CommandBus {
  let chain: Promise<unknown> = Promise.resolve();
  let inFlight = 0;
  const run = async (draft: CommandDraft): Promise<CommitOk | StorageError> => {
    const commandId = draft.commandId ?? platform.newId('cmd');
    const receipt: Receipt = { commandType: draft.commandType, summary: draft.summary, grants: [...(draft.grantKeys ?? [])], events: draft.events ?? null };
    const request: CommitRequest = {
      commandId, profileId: draft.profileId, commandType: draft.commandType, payloadHash: jcsHash({ type: draft.commandType, payload: draft.payload }),
      expectedRevision: draft.expectedRevision, writerEpoch: draft.writerEpoch, mutations: draft.mutations,
      grantKeys: draft.grantKeys ?? [], receipt, committedAt: platform.now(),
    };
    try {
      return await storage.commit(request);
    } catch (error) {
      // Resposta perdida: o timeout da UI não prova rollback — consulta o recibo pelo commandId.
      const known = await storage.query({ kind: 'GET_OPERATION', profileId: draft.profileId, commandId }).catch(() => null);
      if (known && known.payloadHash === request.payloadHash) {
        return { ok: true, status: 'REPLAYED', operationId: known.operationId, committedRevision: known.committedRevision, receipt: known.receipt };
      }
      return { ok: false, code: 'SAVE_WRITE_FAILED', message: error instanceof Error ? error.message : String(error) };
    }
  };
  return {
    execute: (draft) => {
      inFlight += 1;
      const next = chain.then(() => run(draft)).finally(() => { inFlight -= 1; });
      chain = next.catch(() => undefined);
      return next;
    },
    pending: () => inFlight > 0,
  };
}

export function isStorageError(value: CommitOk | StorageError): value is StorageError {
  return value.ok === false;
}
