// Adaptador para o MatchController da UI (Presenter: present/skip/dispose). Estrutural: não importa a UI.
// O lote confirmado (BattleUpdate: actor/before/after/events) já tem o formato de PresentBatch.
import type { BattleEvent } from '../../../domain/battle/types.ts';
import type { BattleView } from '../../../domain/battle/views.ts';
import type { BattleStage } from './battle-stage.ts';

export type ConfirmedUpdate = { readonly before: BattleView; readonly after: BattleView; readonly events: readonly BattleEvent[] };

export type StagePresenter = {
  readonly present: (update: ConfirmedUpdate) => Promise<void>;
  readonly skip: () => void;
  readonly dispose: () => void;
};

/** Presenter que anima cada lote na mesa 3D e resolve quando a cena reconciliou com `after`. */
export function createStagePresenter(stage: BattleStage, options: { readonly newAttempt?: () => boolean } = {}): StagePresenter {
  let disposed = false;
  return {
    present: async (update) => {
      if (disposed) return;
      await stage.present({ events: update.events, before: update.before, after: update.after, newAttempt: options.newAttempt?.() ?? false });
    },
    skip: () => stage.skipToBarrier(),
    dispose: () => {
      disposed = true;
    },
  };
}
