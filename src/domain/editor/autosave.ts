// Estado de gravação do rascunho (editor §27; persistencia §19): debounce de 800 ms, envio do candidato
// mais recente, e a regra de ouro “uma resposta atrasada da revisão N não marca N+1 como salva”.
// Puro: a UI aplica os eventos e decide quando disparar a escrita leve SAVE_EDITOR_REVISION.

export const AUTOSAVE_DEBOUNCE_MS = 800;
export const KEEP_AUTO_REVISIONS = 20;

export type SaveStatus = 'CLEAN' | 'DIRTY' | 'SAVING' | 'SAVED' | 'FAILED' | 'CONFLICT';

export type AutosaveState = {
  /** Contador de edições locais (cada alteração do rascunho incrementa). */
  readonly editSeq: number;
  /** Última edição confirmada pelo SQLite. */
  readonly savedSeq: number;
  /** Edição em voo (null = nenhuma gravação pendente). */
  readonly inflightSeq: number | null;
  /** Head confirmada de editor_projects. */
  readonly headRevision: number;
  readonly status: SaveStatus;
  readonly message: string | null;
};

export function autosaveInit(headRevision: number): AutosaveState {
  return { editSeq: 0, savedSeq: 0, inflightSeq: null, headRevision, status: 'CLEAN', message: null };
}

export function markEdited(s: AutosaveState): AutosaveState {
  return { ...s, editSeq: s.editSeq + 1, status: s.status === 'CONFLICT' ? 'CONFLICT' : s.inflightSeq !== null ? 'SAVING' : 'DIRTY' };
}

/** Pode iniciar uma gravação agora? (nada em voo, há mudança local, sem conflito pendente). */
export function canStartSave(s: AutosaveState, force = false): boolean {
  return s.inflightSeq === null && s.status !== 'CONFLICT' && (force || s.editSeq > s.savedSeq);
}

export function beginSave(s: AutosaveState): AutosaveState {
  return { ...s, inflightSeq: s.editSeq, status: 'SAVING', message: null };
}

export function saveSucceeded(s: AutosaveState, seq: number, revision: number): AutosaveState {
  const savedSeq = Math.max(s.savedSeq, seq);
  const headRevision = Math.max(s.headRevision, revision);
  const inflightSeq = s.inflightSeq === seq ? null : s.inflightSeq;
  return { ...s, savedSeq, headRevision, inflightSeq, status: savedSeq >= s.editSeq ? 'SAVED' : 'DIRTY', message: null };
}

export function saveFailed(s: AutosaveState, seq: number, conflict: boolean, message: string): AutosaveState {
  const inflightSeq = s.inflightSeq === seq ? null : s.inflightSeq;
  return { ...s, inflightSeq, status: conflict ? 'CONFLICT' : 'FAILED', message };
}

/** Após publicar (head avança pela revisão PUBLISHED) ou recarregar a head do banco. */
export function headAdvanced(s: AutosaveState, headRevision: number): AutosaveState {
  return { ...s, headRevision: Math.max(s.headRevision, headRevision), status: s.status === 'CONFLICT' ? 'DIRTY' : s.status };
}

export function hasUnsavedChanges(s: AutosaveState): boolean {
  return s.editSeq > s.savedSeq || s.inflightSeq !== null;
}

export const SAVE_STATUS_LABEL: Record<SaveStatus, string> = {
  CLEAN: 'Sem alterações', DIRTY: 'Alterações locais', SAVING: 'Salvando', SAVED: 'Salvo', FAILED: 'Falha ao salvar — alterações ainda nesta tela',
  CONFLICT: 'Conflito — revisar antes de sobrescrever',
};
