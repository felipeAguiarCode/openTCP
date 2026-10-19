// Consultas tipadas do Storage Worker (persistencia-sqlite.md §27): somente SELECT/PRAGMA parametrizados,
// JSON devolvido já interpretado. Nenhuma consulta recebe SQL da UI.
import type {
  AttemptRow, DeckEntryRow, DeckRow, JsonValue, ProfileRow, ProfileSnapshot, Query, QueryResultMap, Receipt,
} from '../../application/ports/storage.ts';
import { gatherProfileExport } from './profile-export.ts';
import { contentPackages, importPreflight } from './profile-import.ts';
import {
  blob, flag, int, intOrNull, json, jsonOrNull, row, rows, scalarInt, scalarText, text, textOrNull, type DB, type Row,
} from './sql.ts';

type Handlers = { readonly [K in Query['kind']]: (db: DB, q: Extract<Query, { kind: K }>) => QueryResultMap[K] };
type AttemptSummary = Omit<AttemptRow, 'state' | 'rng'>;

const ATTEMPT_SUMMARY_COLUMNS = `attempt_id, profile_id, mode, status, campaign_id, node_id, difficulty, deck_id, deck_revision,
  progression_eligible, state_version, ruleset_id, engine_version, content_fingerprint, presentation_snapshot_json, result_json,
  created_at, updated_at`;

function profileRow(r: Row): ProfileRow {
  return {
    profileId: text(r, 'profile_id'),
    displayName: text(r, 'display_name'),
    progressionMode: text(r, 'progression_mode') as ProfileRow['progressionMode'],
    revision: int(r, 'revision'),
    writerEpoch: int(r, 'writer_epoch'),
    rng: json(r, 'economy_rng_json'),
    createdAt: text(r, 'created_at'),
    updatedAt: text(r, 'updated_at'),
    archived: flag(r, 'archived'),
  };
}

function attemptSummary(r: Row): AttemptSummary {
  return {
    attemptId: text(r, 'attempt_id'),
    profileId: text(r, 'profile_id'),
    mode: text(r, 'mode'),
    status: text(r, 'status') as AttemptRow['status'],
    campaignId: textOrNull(r, 'campaign_id'),
    nodeId: textOrNull(r, 'node_id'),
    difficulty: textOrNull(r, 'difficulty'),
    deckId: textOrNull(r, 'deck_id'),
    deckRevision: intOrNull(r, 'deck_revision'),
    progressionEligible: flag(r, 'progression_eligible'),
    stateVersion: int(r, 'state_version'),
    rulesetId: text(r, 'ruleset_id'),
    engineVersion: text(r, 'engine_version'),
    contentFingerprint: text(r, 'content_fingerprint'),
    presentationSnapshot: json(r, 'presentation_snapshot_json'),
    result: jsonOrNull(r, 'result_json'),
    createdAt: text(r, 'created_at'),
    updatedAt: text(r, 'updated_at'),
  };
}

/** O recibo gravado inclui `committedRevision` (persistencia §13.2); a porta o devolve à parte. */
export function parseReceipt(raw: string): Receipt {
  const stored = JSON.parse(raw) as { commandType: Receipt['commandType']; summary: JsonValue; grants?: string[]; events?: Receipt['events'] };
  return {
    commandType: stored.commandType,
    summary: stored.summary ?? null,
    grants: stored.grants ?? [],
    ...(stored.events !== undefined ? { events: stored.events } : {}),
  };
}

function decksOf(db: DB, profileId: string): DeckRow[] {
  const entries = new Map<string, DeckEntryRow[]>();
  for (const r of rows(db, `SELECT e.deck_id, e.entry_no, e.printing_id, e.entry_flair_id
                            FROM deck_entries e JOIN decks d ON d.deck_id = e.deck_id AND e.revision = d.head_revision
                            WHERE d.profile_id = ? ORDER BY e.deck_id, e.entry_no`, [profileId])) {
    const deckId = text(r, 'deck_id');
    const list = entries.get(deckId) ?? [];
    list.push({ entryNo: int(r, 'entry_no'), printingId: text(r, 'printing_id'), entryFlairId: textOrNull(r, 'entry_flair_id') });
    entries.set(deckId, list);
  }
  // Última versão confirmada de cada deck: é ela que entra em duelos (interface §4.3, §14.14).
  const confirmedMeta = new Map<string, { revision: number; energyTypes: string[] }>();
  for (const r of rows(db, `SELECT v.deck_id, v.revision, v.energy_types_json FROM deck_versions v JOIN decks d ON d.deck_id = v.deck_id
                            WHERE d.profile_id = ? AND v.status = 'CONFIRMED'
                              AND v.revision = (SELECT MAX(c.revision) FROM deck_versions c WHERE c.deck_id = v.deck_id AND c.status = 'CONFIRMED')`, [profileId])) {
    const energy = jsonOrNull(r, 'energy_types_json');
    confirmedMeta.set(text(r, 'deck_id'), { revision: int(r, 'revision'), energyTypes: Array.isArray(energy) ? energy.filter((e): e is string => typeof e === 'string') : [] });
  }
  const confirmedEntries = new Map<string, DeckEntryRow[]>();
  for (const r of rows(db, `SELECT e.deck_id, e.revision, e.entry_no, e.printing_id, e.entry_flair_id FROM deck_entries e JOIN decks d ON d.deck_id = e.deck_id
                            WHERE d.profile_id = ? ORDER BY e.deck_id, e.entry_no`, [profileId])) {
    const deckId = text(r, 'deck_id');
    if (confirmedMeta.get(deckId)?.revision !== int(r, 'revision')) continue;
    const list = confirmedEntries.get(deckId) ?? [];
    list.push({ entryNo: int(r, 'entry_no'), printingId: text(r, 'printing_id'), entryFlairId: textOrNull(r, 'entry_flair_id') });
    confirmedEntries.set(deckId, list);
  }
  return rows(db, `SELECT d.deck_id, d.name, d.head_revision, d.archived, d.created_at,
                          v.status, v.energy_types_json, v.validation_json,
                          (SELECT MAX(c.revision) FROM deck_versions c WHERE c.deck_id = d.deck_id AND c.status = 'CONFIRMED') AS last_confirmed,
                          a.mode AS appearance_mode, a.preset_id, a.preset_revision
                   FROM decks d
                   LEFT JOIN deck_versions v ON v.deck_id = d.deck_id AND v.revision = d.head_revision
                   LEFT JOIN deck_appearance a ON a.deck_id = d.deck_id
                   WHERE d.profile_id = ? ORDER BY d.created_at, d.deck_id`, [profileId]).map((r): DeckRow => {
    const deckId = text(r, 'deck_id');
    const mode = textOrNull(r, 'appearance_mode') as 'INHERIT_PROFILE' | 'OVERRIDE' | null;
    const energy = jsonOrNull(r, 'energy_types_json');
    return {
      deckId,
      name: text(r, 'name'),
      headRevision: int(r, 'head_revision'),
      archived: flag(r, 'archived'),
      createdAt: text(r, 'created_at'),
      status: textOrNull(r, 'status') as DeckRow['status'],
      energyTypes: Array.isArray(energy) ? energy.filter((e): e is string => typeof e === 'string') : [],
      validation: jsonOrNull(r, 'validation_json'),
      entries: entries.get(deckId) ?? [],
      lastConfirmedRevision: intOrNull(r, 'last_confirmed'),
      confirmed: confirmedMeta.has(deckId) ? { ...confirmedMeta.get(deckId)!, entries: confirmedEntries.get(deckId) ?? [] } : null,
      appearance: mode === null ? null : { mode, presetId: textOrNull(r, 'preset_id'), presetRevision: intOrNull(r, 'preset_revision') },
    };
  });
}

function profileSnapshot(db: DB, profileId: string): ProfileSnapshot | null {
  const profile = row(db, 'SELECT * FROM profiles WHERE profile_id = ?', [profileId]);
  if (!profile) return null;
  const wallets: Record<string, number> = {};
  for (const r of rows(db, 'SELECT resource_id, balance FROM wallets WHERE profile_id = ? ORDER BY resource_id', [profileId])) {
    wallets[text(r, 'resource_id')] = int(r, 'balance');
  }
  const settings: Record<string, JsonValue> = {};
  for (const r of rows(db, 'SELECT setting_key, value_json FROM settings WHERE profile_id = ? ORDER BY setting_key', [profileId])) {
    settings[text(r, 'setting_key')] = json(r, 'value_json');
  }
  const active = row(db, `SELECT ${ATTEMPT_SUMMARY_COLUMNS} FROM attempts WHERE profile_id = ? AND status IN ('RUNNING','SUSPENDED')`, [profileId]);
  const appearance = row(db, `SELECT pa.preset_id, pa.preset_revision, cp.config_json
                              FROM profile_appearance pa
                              JOIN cosmetic_presets cp ON cp.preset_id = pa.preset_id AND cp.revision = pa.preset_revision
                              WHERE pa.profile_id = ?`, [profileId]);
  const slots = new Map<string, { pageNo: number; slotNo: number; printingId: string }[]>();
  for (const r of rows(db, `SELECT s.binder_id, s.page_no, s.slot_no, s.printing_id FROM binder_slots s
                            JOIN binders b ON b.binder_id = s.binder_id WHERE b.profile_id = ? ORDER BY s.binder_id, s.page_no, s.slot_no`, [profileId])) {
    const binderId = text(r, 'binder_id');
    const list = slots.get(binderId) ?? [];
    list.push({ pageNo: int(r, 'page_no'), slotNo: int(r, 'slot_no'), printingId: text(r, 'printing_id') });
    slots.set(binderId, list);
  }
  return {
    profile: profileRow(profile),
    wallets,
    inventory: rows(db, 'SELECT printing_id, quantity FROM inventory WHERE profile_id = ? AND quantity > 0 ORDER BY printing_id', [profileId])
      .map((r) => ({ printingId: text(r, 'printing_id'), quantity: int(r, 'quantity') })),
    decks: decksOf(db, profileId),
    campaignProgress: rows(db, 'SELECT * FROM campaign_progress WHERE profile_id = ? ORDER BY campaign_id, node_id', [profileId]).map((r) => ({
      campaignId: text(r, 'campaign_id'),
      nodeId: text(r, 'node_id'),
      campaignVersion: text(r, 'campaign_version'),
      status: text(r, 'status') as 'LOCKED' | 'AVAILABLE' | 'CLEARED',
      progress: json(r, 'progress_json'),
      updatedAt: text(r, 'updated_at'),
    })),
    entitlements: rows(db, 'SELECT cosmetic_id, origin, acquired_at FROM cosmetic_entitlements WHERE profile_id = ? ORDER BY acquired_at, cosmetic_id', [profileId])
      .map((r) => ({ cosmeticId: text(r, 'cosmetic_id'), origin: text(r, 'origin'), acquiredAt: text(r, 'acquired_at') })),
    pendingRewards: rows(db, 'SELECT * FROM pending_rewards WHERE profile_id = ? ORDER BY created_at, reward_id', [profileId]).map((r) => ({
      rewardId: text(r, 'reward_id'),
      grantKey: text(r, 'grant_key'),
      status: text(r, 'status') as 'PENDING' | 'CLAIMED',
      options: json(r, 'options_json'),
      choice: jsonOrNull(r, 'choice_json'),
      createdAt: text(r, 'created_at'),
    })),
    grants: rows(db, 'SELECT grant_key FROM reward_grants WHERE profile_id = ? ORDER BY granted_at, grant_key', [profileId]).map((r) => text(r, 'grant_key')),
    settings,
    activeAttempt: active ? attemptSummary(active) : null,
    appearance: appearance
      ? { presetId: text(appearance, 'preset_id'), presetRevision: int(appearance, 'preset_revision'), config: json(appearance, 'config_json') }
      : null,
    presets: rows(db, 'SELECT preset_id, revision, config_json, created_at FROM cosmetic_presets WHERE profile_id = ? ORDER BY preset_id, revision', [profileId])
      .map((r) => ({ presetId: text(r, 'preset_id'), revision: int(r, 'revision'), config: json(r, 'config_json'), createdAt: text(r, 'created_at') })),
    binders: rows(db, 'SELECT * FROM binders WHERE profile_id = ? AND archived = 0 ORDER BY sort_order, binder_id', [profileId]).map((r) => ({
      binderId: text(r, 'binder_id'),
      name: text(r, 'name'),
      kind: text(r, 'kind') as 'BINDER' | 'SHOWCASE',
      layout: json(r, 'layout_json'),
      sortOrder: int(r, 'sort_order'),
      slots: slots.get(text(r, 'binder_id')) ?? [],
    })),
    marks: rows(db, 'SELECT mark_kind, subject_kind, subject_id FROM collection_marks WHERE profile_id = ? ORDER BY created_at, mark_kind, subject_kind, subject_id', [profileId])
      .map((r) => ({
        markKind: text(r, 'mark_kind') as 'FAVORITE' | 'WISHLIST' | 'SEEN',
        subjectKind: text(r, 'subject_kind') as 'PRINTING' | 'DEFINITION',
        subjectId: text(r, 'subject_id'),
      })),
  };
}

function firstColumn(db: DB, sql: string): string[] {
  return db.selectValues(sql).map((value) => String(value));
}

const HANDLERS: Handlers = {
  LIST_PROFILES: (db, q) => rows(db, `SELECT * FROM profiles ${q.includeArchived ? '' : 'WHERE archived = 0'} ORDER BY created_at, profile_id`).map(profileRow),

  PROFILE_SNAPSHOT: (db, q) => profileSnapshot(db, q.profileId),

  GET_ATTEMPT: (db, q) => {
    const r = row(db, 'SELECT * FROM attempts WHERE attempt_id = ?', [q.attemptId]);
    return r ? { ...attemptSummary(r), state: json(r, 'state_json'), rng: json(r, 'rng_json') } : null;
  },

  LIST_ATTEMPTS: (db, q) => rows(db, `SELECT ${ATTEMPT_SUMMARY_COLUMNS} FROM attempts WHERE profile_id = ? ORDER BY created_at DESC, attempt_id DESC LIMIT ? OFFSET ?`,
    [q.profileId, q.limit, q.offset]).map(attemptSummary),

  GET_EVENTS: (db, q) => rows(db, `SELECT sequence_no, event_type, state_version, event_json FROM battle_events
                                   WHERE attempt_id = ? AND sequence_no >= ? ORDER BY sequence_no`, [q.attemptId, q.fromSeq])
    .map((r) => ({ seq: int(r, 'sequence_no'), type: text(r, 'event_type'), stateVersion: int(r, 'state_version'), event: json(r, 'event_json') })),

  GET_CHECKPOINTS: (db, q) => rows(db, `SELECT state_version, last_event_sequence, snapshot_hash, created_at FROM battle_checkpoints
                                        WHERE attempt_id = ? ORDER BY state_version`, [q.attemptId])
    .map((r) => ({ stateVersion: int(r, 'state_version'), lastEventSequence: int(r, 'last_event_sequence'), snapshotHash: text(r, 'snapshot_hash'), createdAt: text(r, 'created_at') })),

  GET_APPEARANCE_DRAFT: (db, q) => {
    const r = row(db, 'SELECT revision, draft_json FROM appearance_drafts WHERE profile_id = ? AND editor_context_id = ?', [q.profileId, q.contextId]);
    return r ? { revision: int(r, 'revision'), draft: json(r, 'draft_json') } : null;
  },

  GET_CHECKPOINT: (db, q) => {
    const r = row(db, `SELECT state_version, last_event_sequence, snapshot_json, snapshot_hash FROM battle_checkpoints
                     WHERE attempt_id = ? AND state_version = ?`, [q.attemptId, q.stateVersion]);
    return r ? { stateVersion: int(r, 'state_version'), lastEventSequence: int(r, 'last_event_sequence'), snapshot: json(r, 'snapshot_json'), snapshotHash: text(r, 'snapshot_hash') } : null;
  },

  GET_OPERATION: (db, q) => {
    const r = row(db, 'SELECT operation_id, payload_hash, committed_revision, receipt_json FROM operations WHERE profile_id = ? AND command_id = ?', [q.profileId, q.commandId]);
    return r ? { operationId: text(r, 'operation_id'), payloadHash: text(r, 'payload_hash'), committedRevision: int(r, 'committed_revision'), receipt: parseReceipt(text(r, 'receipt_json')) } : null;
  },

  LIST_RECEIPTS: (db, q) => rows(db, `SELECT operation_id, command_id, command_type, committed_revision, receipt_json, committed_at FROM operations
                                      WHERE profile_id = ? ORDER BY committed_revision DESC LIMIT ? OFFSET ?`, [q.profileId, q.limit, q.offset])
    .map((r) => ({
      operationId: text(r, 'operation_id'),
      commandId: text(r, 'command_id'),
      commandType: text(r, 'command_type'),
      committedRevision: int(r, 'committed_revision'),
      receipt: parseReceipt(text(r, 'receipt_json')),
      committedAt: text(r, 'committed_at'),
    })),

  CUSTOM_CATALOG: (db, q) => {
    const owner = [q.profileId];
    // Definições CUSTOM alcançáveis pelo perfil: as que ele publicou e as de cujas impressões ele tem cópias
    // (concessão para perfil de criação, perfil importado que reutiliza conteúdo existente — persistencia §18, §24.1).
    const reachable = `WITH reachable(definition_id) AS (
        SELECT d.definition_id FROM card_definitions d WHERE d.namespace = 'CUSTOM' AND (?1 IS NULL OR d.owner_profile_id = ?1)
        UNION SELECT p.definition_id FROM inventory i JOIN card_printings p ON p.printing_id = i.printing_id
          JOIN card_definitions d ON d.definition_id = p.definition_id
          WHERE ?1 IS NOT NULL AND i.profile_id = ?1 AND d.namespace = 'CUSTOM')`;
    const versions = rows(db, `${reachable}
                               SELECT v.definition_id, v.version, v.rules_json, d.owner_profile_id,
                                 (d.archived = 1 OR EXISTS (SELECT 1 FROM catalog_archive_marks m
                                   WHERE m.entity_kind = 'VERSION' AND m.entity_id = v.definition_id AND m.entity_version = v.version)) AS archived
                               FROM card_versions v JOIN card_definitions d ON d.definition_id = v.definition_id
                               WHERE d.definition_id IN (SELECT definition_id FROM reachable)
                               ORDER BY v.definition_id, v.version`, owner)
      .map((r) => ({ definitionId: text(r, 'definition_id'), version: int(r, 'version'), rules: json(r, 'rules_json'), ownerProfileId: textOrNull(r, 'owner_profile_id'), archived: flag(r, 'archived') }));
    // Impressões autorais: de definições CUSTOM alcançáveis ou fora de qualquer pacote de conteúdo (VARIANT sobre carta BASE).
    const printings = rows(db, `${reachable}
                                SELECT p.printing_id, p.appearance_json,
                                  EXISTS (SELECT 1 FROM catalog_archive_marks m WHERE m.entity_kind = 'PRINTING' AND m.entity_id = p.printing_id) AS archived
                                FROM card_printings p JOIN card_definitions d ON d.definition_id = p.definition_id
                                WHERE (d.namespace = 'CUSTOM' AND d.definition_id IN (SELECT definition_id FROM reachable))
                                   OR NOT EXISTS (SELECT 1 FROM package_cards pc WHERE pc.printing_id = p.printing_id)
                                ORDER BY p.printing_id`, owner)
      .map((r) => ({ printingId: text(r, 'printing_id'), appearance: json(r, 'appearance_json'), archived: flag(r, 'archived') }));
    const heads: Record<string, number> = {};
    for (const r of rows(db, `${reachable}
                              SELECT h.definition_id, h.version FROM card_catalog_heads h
                              WHERE h.definition_id IN (SELECT definition_id FROM reachable)`, owner)) {
      heads[text(r, 'definition_id')] = int(r, 'version');
    }
    return { versions, printings, heads };
  },

  LIST_PROJECTS: (db, q) => rows(db, `SELECT p.project_id, p.title, p.mode, p.status, p.head_revision, p.target_definition_id, p.updated_at,
                                        r.validation_summary_json
                                      FROM editor_projects p
                                      LEFT JOIN editor_revisions r ON r.project_id = p.project_id AND r.revision = p.head_revision
                                      WHERE p.profile_id = ? ${q.includeArchived ? '' : "AND p.status <> 'ARCHIVED'"}
                                      ORDER BY p.updated_at DESC, p.project_id`, [q.profileId])
    .map((r) => ({
      projectId: text(r, 'project_id'),
      title: text(r, 'title'),
      mode: text(r, 'mode'),
      status: text(r, 'status') as 'DRAFT' | 'ARCHIVED',
      headRevision: int(r, 'head_revision'),
      targetDefinitionId: textOrNull(r, 'target_definition_id'),
      updatedAt: text(r, 'updated_at'),
      validationSummary: jsonOrNull(r, 'validation_summary_json') ?? {},
    })),

  GET_PROJECT: (db, q) => {
    const project = row(db, 'SELECT * FROM editor_projects WHERE project_id = ?', [q.projectId]);
    if (!project) return null;
    const revisionNo = q.revision ?? int(project, 'head_revision');
    const revision = revisionNo > 0
      ? row(db, 'SELECT revision, kind, draft_json, validation_summary_json FROM editor_revisions WHERE project_id = ? AND revision = ?', [q.projectId, revisionNo])
      : undefined;
    if (revisionNo > 0 && !revision) return null;
    return {
      projectId: text(project, 'project_id'),
      profileId: text(project, 'profile_id'),
      title: text(project, 'title'),
      mode: text(project, 'mode'),
      status: text(project, 'status'),
      headRevision: int(project, 'head_revision'),
      targetDefinitionId: textOrNull(project, 'target_definition_id'),
      sourceDefinitionId: textOrNull(project, 'source_definition_id'),
      sourceVersion: intOrNull(project, 'source_version'),
      revision: revision ? int(revision, 'revision') : 0,
      revisionKind: revision ? text(revision, 'kind') : 'NONE',
      draft: revision ? json(revision, 'draft_json') : null,
      validationSummary: revision ? json(revision, 'validation_summary_json') : {},
      revisions: rows(db, 'SELECT revision, kind, created_at FROM editor_revisions WHERE project_id = ? ORDER BY revision', [q.projectId])
        .map((r) => ({ revision: int(r, 'revision'), kind: text(r, 'kind'), createdAt: text(r, 'created_at') })),
    };
  },

  LIST_TEST_RUNS: (db, q) => rows(db, `SELECT run_id, revision, rules_hash, scenario_json, result_json, outcome, created_at FROM card_test_runs
                                       WHERE project_id = ? ORDER BY created_at, run_id`, [q.projectId])
    .map((r) => ({
      runId: text(r, 'run_id'),
      revision: int(r, 'revision'),
      rulesHash: text(r, 'rules_hash'),
      scenario: json(r, 'scenario_json'),
      result: json(r, 'result_json'),
      outcome: text(r, 'outcome'),
      createdAt: text(r, 'created_at'),
    })),

  GET_ASSET: (db, q) => {
    const r = row(db, 'SELECT asset_id, media_type, bytes, width, height, metadata_json FROM assets WHERE asset_id = ?', [q.assetId]);
    const bytes = r ? blob(r, 'bytes') : null;
    // Linhas BUNDLED não guardam bytes: são resolvidas pelo manifesto do pacote (persistencia §8.2).
    if (!r || bytes === null) return null;
    return { assetId: text(r, 'asset_id'), mediaType: text(r, 'media_type'), bytes, width: intOrNull(r, 'width'), height: intOrNull(r, 'height'), metadata: json(r, 'metadata_json') };
  },

  CONTENT_INSTALLED: (db, q) => scalarInt(db, 'SELECT 1 FROM content_packages WHERE package_id = ? AND version = ?', [q.packageId, q.version]) !== undefined,

  APP_META: (db, q) => {
    const value = scalarText(db, 'SELECT value_json FROM app_meta WHERE key = ?', [q.key]);
    return value === undefined ? null : (JSON.parse(value) as JsonValue);
  },

  DIAGNOSTICS: (db, q) => ({
    sqliteVersion: scalarText(db, 'SELECT sqlite_version()') ?? '',
    userVersion: scalarInt(db, 'PRAGMA user_version') ?? 0,
    applicationId: scalarInt(db, 'PRAGMA application_id') ?? 0,
    journalMode: scalarText(db, 'PRAGMA journal_mode') ?? '',
    foreignKeys: scalarInt(db, 'PRAGMA foreign_keys') === 1,
    quickCheck: firstColumn(db, 'PRAGMA quick_check').join('\n'),
    integrityCheck: q.deep ? firstColumn(db, 'PRAGMA integrity_check').join('\n') : null,
    foreignKeyViolations: q.deep ? db.selectArrays('PRAGMA foreign_key_check').length : null,
    tables: scalarInt(db, "SELECT count(*) FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%'") ?? 0,
    vfs: db.dbVfsName() ?? 'unknown',
    pageCount: scalarInt(db, 'PRAGMA page_count') ?? 0,
    pageSize: scalarInt(db, 'PRAGMA page_size') ?? 0,
  }),

  PROFILE_EXPORT: (db, q) => gatherProfileExport(db, q.profileId),

  LIST_CONTENT_PACKAGES: (db) => contentPackages(db),

  IMPORT_PREFLIGHT: (db, q) => importPreflight(db, q.check),
};

export function runQuery<Q extends Query>(db: DB, q: Q): QueryResultMap[Q['kind']] {
  const handler = HANDLERS[q.kind] as unknown as (db: DB, q: Q) => QueryResultMap[Q['kind']];
  return handler(db, q);
}
