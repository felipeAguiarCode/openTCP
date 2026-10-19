// Escritas leves sem `operations` (persistencia-sqlite.md §13.1, §15, §19): cada uma roda numa transação
// BEGIN IMMEDIATE própria, aberta por `write()`, com CAS em decks / editor_projects / appearance_drafts.
import type { LightWrite, WriteOk } from '../../application/ports/storage.ts';
import { fail } from './errors.ts';
import { insertDeckVersion, insertEditorAssetRefs, putAsset } from './mutations.ts';
import { run, row, scalarInt, scalarText, text, int, toJson, unique, type DB } from './sql.ts';

type Handlers = { readonly [K in LightWrite['kind']]: (db: DB, w: Extract<LightWrite, { kind: K }>, at: string) => WriteOk };

/** Fencing por época de escrita (persistencia §12.1): época antiga não confirma nada. */
function checkWriterEpoch(db: DB, profileId: string, writerEpoch: number | undefined): void {
  if (writerEpoch === undefined) return;
  const current = scalarInt(db, 'SELECT writer_epoch FROM profiles WHERE profile_id = ?', [profileId]);
  if (current === undefined) fail('NOT_FOUND', `perfil ${profileId} inexistente`);
  if (current !== writerEpoch) fail('REVISION_CONFLICT', `época de escrita ${writerEpoch} substituída por ${current}`);
}

function projectOwner(db: DB, projectId: string): string {
  const owner = scalarText(db, 'SELECT profile_id FROM editor_projects WHERE project_id = ?', [projectId]);
  if (owner === undefined) fail('NOT_FOUND', `projeto ${projectId} inexistente`);
  return owner;
}

/**
 * Poda de revisões AUTO (persistencia §19): mantém MANUAL/PUBLISHED, a head, as referenciadas por testes ou
 * publicações e as `keep` AUTO mais recentes. O trigger `editor_revisions_prune_auto_only` continua a última defesa.
 */
export function pruneAutoRevisions(db: DB, projectId: string, keep: number): number {
  const limit = Math.max(0, Math.floor(keep));
  return run(db, `DELETE FROM editor_revisions
                  WHERE project_id = ?1 AND kind = 'AUTO'
                    AND revision <> (SELECT head_revision FROM editor_projects WHERE project_id = ?1)
                    AND revision NOT IN (SELECT revision FROM card_test_runs WHERE project_id = ?1)
                    AND revision NOT IN (SELECT project_revision FROM card_publications WHERE project_id = ?1 AND project_revision IS NOT NULL)
                    AND revision NOT IN (SELECT revision FROM editor_revisions WHERE project_id = ?1 AND kind = 'AUTO' ORDER BY revision DESC LIMIT ?2)`,
  [projectId, limit]);
}

const HANDLERS: Handlers = {
  SAVE_DECK_DRAFT: (db, w, at) => {
    checkWriterEpoch(db, w.profileId, w.writerEpoch);
    const deck = row(db, 'SELECT profile_id, head_revision FROM decks WHERE deck_id = ?', [w.deckId]);
    if (!deck) {
      if (!w.createIfMissing) fail('NOT_FOUND', `deck ${w.deckId} inexistente`);
      if (w.expectedHead !== 0) fail('REVISION_CONFLICT', `deck ${w.deckId} inexistente; head esperada ${w.expectedHead}`);
      run(db, 'INSERT INTO decks(deck_id, profile_id, name, head_revision, archived, created_at) VALUES (?, ?, ?, 0, 0, ?)', [w.deckId, w.profileId, w.name, at]);
    } else if (text(deck, 'profile_id') !== w.profileId) {
      fail('INTERNAL_INTEGRITY_ERROR', `deck ${w.deckId} pertence a outro perfil`);
    }
    if (!Number.isSafeInteger(w.revision) || w.revision <= w.expectedHead) fail('INTERNAL_INTEGRITY_ERROR', `revisão ${w.revision} não avança a head ${w.expectedHead}`);
    const changed = run(db, 'UPDATE decks SET head_revision = ?, name = ? WHERE deck_id = ? AND profile_id = ? AND head_revision = ?',
      [w.revision, w.name, w.deckId, w.profileId, w.expectedHead]);
    if (changed !== 1) fail('REVISION_CONFLICT', `deck ${w.deckId}: head confirmada difere de ${w.expectedHead}`);
    insertDeckVersion(db, w.deckId, w.revision, 'DRAFT', w.energyTypes, w.validation, w.entries, at);
    return { ok: true, head: w.revision };
  },

  CREATE_EDITOR_PROJECT: (db, w, at) => {
    checkWriterEpoch(db, w.profileId, w.writerEpoch);
    const existing = row(db, 'SELECT profile_id, head_revision FROM editor_projects WHERE project_id = ?', [w.projectId]);
    if (existing) {
      // Reenvio após resposta perdida: idempotente para o mesmo dono.
      if (text(existing, 'profile_id') !== w.profileId) fail('INTERNAL_INTEGRITY_ERROR', `projeto ${w.projectId} pertence a outro perfil`);
      return { ok: true, head: int(existing, 'head_revision') };
    }
    run(db, `INSERT INTO editor_projects(project_id, profile_id, title, mode, status, head_revision, target_definition_id,
               source_definition_id, source_version, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'DRAFT', 0, ?, ?, ?, ?, ?)`,
    [w.projectId, w.profileId, w.title, w.mode, w.targetDefinitionId, w.sourceDefinitionId, w.sourceVersion, at, at]);
    return { ok: true, head: 0 };
  },

  SAVE_EDITOR_REVISION: (db, w, at) => {
    checkWriterEpoch(db, projectOwner(db, w.projectId), w.writerEpoch);
    if (!Number.isSafeInteger(w.revision) || w.revision <= w.expectedHead) fail('INTERNAL_INTEGRITY_ERROR', `revisão ${w.revision} não avança a head ${w.expectedHead}`);
    const changed = run(db, 'UPDATE editor_projects SET head_revision = ?, updated_at = ? WHERE project_id = ? AND head_revision = ?',
      [w.revision, at, w.projectId, w.expectedHead]);
    if (changed !== 1) fail('REVISION_CONFLICT', `projeto ${w.projectId}: head confirmada difere de ${w.expectedHead}`);
    run(db, 'INSERT INTO editor_revisions(project_id, revision, kind, draft_json, validation_summary_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [w.projectId, w.revision, w.revisionKind, toJson(w.draft), toJson(w.validationSummary), at]);
    insertEditorAssetRefs(db, w.projectId, w.revision, w.assetRefs);
    pruneAutoRevisions(db, w.projectId, w.keepAutoRevisions);
    return { ok: true, head: w.revision };
  },

  SET_PROJECT_STATUS: (db, w, at) => {
    checkWriterEpoch(db, projectOwner(db, w.projectId), w.writerEpoch);
    run(db, 'UPDATE editor_projects SET status = ?, updated_at = ? WHERE project_id = ?', [w.status, at, w.projectId]);
    return { ok: true };
  },

  INSERT_TEST_RUN: (db, w, at) => {
    // Idempotente por run_id (persistencia §13.1 RUN_CARD_TEST); linhas existentes são imutáveis.
    run(db, `INSERT INTO card_test_runs(run_id, project_id, revision, runner_version, rules_hash, scenario_json, result_json, outcome, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(run_id) DO NOTHING`,
    [w.runId, w.projectId, w.revision, w.runnerVersion, w.rulesHash, toJson(w.scenario), toJson(w.result), w.outcome, at]);
    return { ok: true };
  },

  INSERT_ASSET_BLOB: (db, w, at) => {
    putAsset(db, w, at);
    return { ok: true };
  },

  MARK_COLLECTION: (db, w, at) => {
    checkWriterEpoch(db, w.profileId, w.writerEpoch);
    if (w.on) {
      run(db, `INSERT INTO collection_marks(profile_id, mark_kind, subject_kind, subject_id, created_at) VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(profile_id, mark_kind, subject_kind, subject_id) DO NOTHING`,
      [w.profileId, w.markKind, w.subjectKind, w.subjectId, at]);
    } else {
      run(db, 'DELETE FROM collection_marks WHERE profile_id = ? AND mark_kind = ? AND subject_kind = ? AND subject_id = ?',
        [w.profileId, w.markKind, w.subjectKind, w.subjectId]);
    }
    return { ok: true };
  },

  SET_SETTINGS: (db, w) => {
    checkWriterEpoch(db, w.profileId, w.writerEpoch);
    for (const [key, value] of Object.entries(w.values)) {
      run(db, `INSERT INTO settings(profile_id, setting_key, value_json) VALUES (?, ?, ?)
               ON CONFLICT(profile_id, setting_key) DO UPDATE SET value_json = excluded.value_json`, [w.profileId, key, toJson(value)]);
    }
    return { ok: true };
  },

  SAVE_APPEARANCE_DRAFT: (db, w) => {
    checkWriterEpoch(db, w.profileId, w.writerEpoch);
    const current = scalarInt(db, 'SELECT revision FROM appearance_drafts WHERE profile_id = ? AND editor_context_id = ?', [w.profileId, w.contextId]);
    if (current === undefined) {
      run(db, 'INSERT INTO appearance_drafts(profile_id, editor_context_id, revision, draft_json) VALUES (?, ?, ?, ?)',
        [w.profileId, w.contextId, w.revision, toJson(w.draft)]);
    } else {
      // CAS monotônico em appearance_drafts.revision (persistencia §13.1): resposta atrasada não sobrescreve.
      if (w.revision <= current) fail('REVISION_CONFLICT', `rascunho ${w.contextId}: revisão ${w.revision} não supera ${current}`);
      run(db, 'UPDATE appearance_drafts SET revision = ?, draft_json = ? WHERE profile_id = ? AND editor_context_id = ?',
        [w.revision, toJson(w.draft), w.profileId, w.contextId]);
      run(db, 'DELETE FROM appearance_draft_assets WHERE profile_id = ? AND editor_context_id = ?', [w.profileId, w.contextId]);
    }
    for (const assetId of unique(w.assetIds)) {
      run(db, 'INSERT INTO appearance_draft_assets(profile_id, editor_context_id, asset_id) VALUES (?, ?, ?)', [w.profileId, w.contextId, assetId]);
    }
    return { ok: true, head: w.revision };
  },

  SET_APP_META: (db, w) => {
    run(db, 'INSERT INTO app_meta(key, value_json) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json', [w.key, toJson(w.value)]);
    return { ok: true };
  },
};

export function applyLightWrite(db: DB, write: LightWrite, at: string): WriteOk {
  const handler = HANDLERS[write.kind] as (db: DB, w: LightWrite, at: string) => WriteOk;
  return handler(db, write, at);
}
