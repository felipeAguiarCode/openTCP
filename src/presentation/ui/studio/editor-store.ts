// Estado vivo do editor S44: rascunho com Desfazer/Refazer (só o documento), autosave por debounce de
// 800 ms com CAS (SAVE_EDITOR_REVISION), validação incremental a cada mudança e relatório completo antes de
// publicar. Uma resposta atrasada da revisão N nunca marca N+1 como salva (domain/editor/autosave.ts).
import { computed, signal, type ReadonlySignal, type Signal } from '@preact/signals';
import type { GameContext } from '../../../application/context.ts';
import {
  alignDraftTarget, saveRevision, validationContextFor, type ProjectState,
} from '../../../application/studio.ts';
import {
  AUTOSAVE_DEBOUNCE_MS, autosaveInit, beginSave, canStartSave, hasUnsavedChanges, headAdvanced, markEdited, saveFailed, saveSucceeded, type AutosaveState,
} from '../../../domain/editor/autosave.ts';
import type { EditorDraft } from '../../../domain/editor/draft.ts';
import { canRedo, canUndo, historyInit, historyPush, historyRedo, historyReplace, historyUndo, type History } from '../../../domain/editor/history.ts';
import { validateDraft, type ValidationContext, type ValidationReport } from '../../../domain/editor/validate.ts';

export type EditorStore = {
  readonly project: Signal<ProjectState>;
  readonly history: Signal<History<EditorDraft>>;
  readonly draft: ReadonlySignal<EditorDraft>;
  readonly autosave: Signal<AutosaveState>;
  readonly context: Signal<ValidationContext>;
  readonly report: ReadonlySignal<ValidationReport>;
  readonly canUndo: ReadonlySignal<boolean>;
  readonly canRedo: ReadonlySignal<boolean>;
  readonly update: (fn: (d: EditorDraft) => EditorDraft, coalesceKey?: string) => void;
  readonly undo: () => void;
  readonly redo: () => void;
  readonly saveNow: (kind: 'AUTO' | 'MANUAL') => Promise<boolean>;
  readonly flush: () => Promise<boolean>;
  readonly refreshContext: () => Promise<void>;
  readonly replaceDraft: (draft: EditorDraft) => void;
  readonly afterPublish: (publishedRevision: number) => Promise<void>;
  readonly dirty: () => boolean;
  /** Descarta só o delta não confirmado: a última revisão salva continua sendo a head. */
  readonly discard: () => void;
  readonly dispose: () => void;
};

export function createEditorStore(ctx: GameContext, initial: ProjectState, initialContext: ValidationContext): EditorStore {
  const aligned = alignDraftTarget(ctx.content.get(), initial.draft);
  const project = signal(initial);
  const history = signal(historyInit(aligned));
  const draft = computed(() => history.value.present);
  const autosave = signal(autosaveInit(initial.headRevision));
  const context = signal(initialContext);
  const report = computed(() => validateDraft(draft.value, context.value));
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let inflight: Promise<boolean> | null = null;
  if (aligned !== initial.draft) autosave.value = markEdited(autosave.value);

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; void saveNow('AUTO'); }, AUTOSAVE_DEBOUNCE_MS);
  };

  const saveNow = async (kind: 'AUTO' | 'MANUAL'): Promise<boolean> => {
    if (disposed && kind === 'AUTO' && !hasUnsavedChanges(autosave.value)) return true;
    if (inflight) {
      await inflight;
      if (kind === 'AUTO' && !hasUnsavedChanges(autosave.value)) return true;
    }
    if (!canStartSave(autosave.value, kind === 'MANUAL')) return autosave.value.status !== 'CONFLICT' && autosave.value.status !== 'FAILED';
    if (timer) { clearTimeout(timer); timer = null; }
    const seq = autosave.value.editSeq;
    const snapshotDraft = draft.value;
    const p = project.value;
    autosave.value = beginSave(autosave.value);
    const run = (async () => {
      const result = await saveRevision(ctx, { projectId: p.projectId, headRevision: autosave.value.headRevision, mode: p.mode, sourceDefinitionId: p.sourceDefinitionId, sourceVersion: p.sourceVersion },
        snapshotDraft, kind, validateDraft(snapshotDraft, context.value));
      if (result.ok) {
        autosave.value = saveSucceeded(autosave.value, seq, result.revision);
        project.value = { ...project.value, headRevision: result.revision, revision: result.revision, revisionKind: kind, validationSummary: result.summary as never };
        if (autosave.value.status === 'DIRTY' && !disposed) schedule();
        return true;
      }
      autosave.value = saveFailed(autosave.value, seq, result.code === 'REVISION_CONFLICT', result.message);
      return false;
    })();
    inflight = run;
    try { return await run; } finally { inflight = null; }
  };

  const update = (fn: (d: EditorDraft) => EditorDraft, coalesceKey?: string) => {
    const next = fn(draft.value);
    if (next === draft.value) return;
    history.value = historyPush(history.value, next, { coalesceKey: coalesceKey ?? null, at: Date.now() });
    autosave.value = markEdited(autosave.value);
    schedule();
  };

  return {
    project, history, draft, autosave, context, report,
    canUndo: computed(() => canUndo(history.value)),
    canRedo: computed(() => canRedo(history.value)),
    update,
    undo: () => {
      if (!canUndo(history.value)) return;
      history.value = historyUndo(history.value);
      autosave.value = markEdited(autosave.value);
      schedule();
    },
    redo: () => {
      if (!canRedo(history.value)) return;
      history.value = historyRedo(history.value);
      autosave.value = markEdited(autosave.value);
      schedule();
    },
    saveNow,
    flush: async () => (hasUnsavedChanges(autosave.value) ? saveNow('AUTO') : true),
    refreshContext: async () => {
      const p = project.value;
      context.value = await validationContextFor(ctx, p, draft.value);
    },
    replaceDraft: (next) => {
      history.value = historyReplace(history.value, next);
      autosave.value = markEdited(autosave.value);
      schedule();
    },
    afterPublish: async (publishedRevision) => {
      autosave.value = headAdvanced(autosave.value, publishedRevision);
      project.value = { ...project.value, headRevision: publishedRevision };
      // Continuar em novo rascunho: o alvo passa à próxima versão (sem entrar no Desfazer).
      const next = alignDraftTarget(ctx.content.get(), draft.value);
      if (next !== draft.value) {
        history.value = historyReplace(history.value, next);
        autosave.value = markEdited(autosave.value);
        schedule();
      }
      context.value = await validationContextFor(ctx, project.value, draft.value);
    },
    dirty: () => hasUnsavedChanges(autosave.value),
    discard: () => {
      if (timer) { clearTimeout(timer); timer = null; }
      autosave.value = { ...autosave.value, savedSeq: autosave.value.editSeq, inflightSeq: null, status: 'CLEAN' };
    },
    dispose: () => {
      disposed = true;
      if (timer) { clearTimeout(timer); timer = null; }
      // Ao sair com alterações locais, ainda tenta gravar uma revisão AUTO recuperável.
      if (hasUnsavedChanges(autosave.value) && autosave.value.status !== 'CONFLICT') void saveNow('AUTO');
    },
  };
}
