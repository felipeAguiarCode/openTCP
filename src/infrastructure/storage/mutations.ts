// Handlers das mutações tipadas de um commit (persistencia-sqlite.md §12–§18). Cada handler roda dentro da
// transação BEGIN IMMEDIATE aberta por `commit()`, depois do CAS do perfil e da linha `operations`.
// As FKs são imediatas: a ordem das mutações no lote precisa respeitar as referências (ver executor.ts).
import type { DeckEntryRow, JsonValue, Mutation } from '../../application/ports/storage.ts';
import { fail } from './errors.ts';
import { applyProfileImport } from './profile-import.ts';
import {
  bit, blob, run, row, sameBytes, scalarInt, scalarText, text, toJson, toJsonOrNull, unique, type DB,
} from './sql.ts';

export type CommitContext = {
  readonly db: DB;
  readonly profileId: string;
  readonly operationId: string;
  /** Revisão confirmada por este commit (= expectedRevision + 1). */
  readonly committedRevision: number;
  readonly at: string;
  walletEntryNo: number;
  inventoryEntryNo: number;
  readonly ignoredEntitlements: string[];
};

/** operation_id = `op-<profileId>-<committedRevision>` (único: a revisão é o último segmento, só dígitos). */
export function operationIdFor(profileId: string, committedRevision: number): string {
  return `op-${profileId}-${committedRevision}`;
}

type Handlers = { readonly [K in Mutation['kind']]: (ctx: CommitContext, m: Extract<Mutation, { kind: K }>) => void };

// ---- linhas compartilhadas com escritas leves e instalação de conteúdo

export function insertDeckVersion(
  db: DB, deckId: string, revision: number, status: 'DRAFT' | 'CONFIRMED', energyTypes: readonly string[],
  validation: JsonValue, entries: readonly DeckEntryRow[], at: string,
): void {
  run(db, 'INSERT INTO deck_versions(deck_id, revision, status, energy_types_json, validation_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [deckId, revision, status, toJson(energyTypes), toJson(validation), at]);
  for (const entry of entries) {
    run(db, 'INSERT INTO deck_entries(deck_id, revision, entry_no, printing_id, entry_flair_id) VALUES (?, ?, ?, ?, ?)',
      [deckId, revision, entry.entryNo, entry.printingId, entry.entryFlairId]);
  }
}

export type AssetBlob = {
  readonly assetId: string; readonly mediaType: string; readonly bytes: Uint8Array;
  readonly width: number | null; readonly height: number | null; readonly metadata: JsonValue;
};

/** Insere o BLOB se ausente; se o hash já existe, os bytes precisam ser idênticos (persistencia §10). */
export function putAsset(db: DB, asset: AssetBlob, at: string): 'INSERTED' | 'EXISTING' {
  const existing = row(db, 'SELECT storage_kind, bytes FROM assets WHERE asset_id = ?', [asset.assetId]);
  if (existing) {
    const stored = blob(existing, 'bytes');
    if (text(existing, 'storage_kind') !== 'BLOB' || stored === null || !sameBytes(stored, asset.bytes)) {
      fail('INTERNAL_INTEGRITY_ERROR', `asset ${asset.assetId} já existe com bytes diferentes; nada foi substituído`);
    }
    return 'EXISTING';
  }
  run(db, `INSERT INTO assets(asset_id, storage_kind, media_type, logical_path, bytes, byte_length, width, height, metadata_json, created_at)
           VALUES (?, 'BLOB', ?, NULL, ?, ?, ?, ?, ?, ?)`,
  [asset.assetId, asset.mediaType, asset.bytes, asset.bytes.length, asset.width, asset.height, toJson(asset.metadata), at]);
  return 'INSERTED';
}

function assetBindings(appearance: JsonValue): { role: string; assetId: string }[] {
  if (appearance === null || typeof appearance !== 'object' || Array.isArray(appearance)) return [];
  const bindings = appearance.assetBindings;
  if (!Array.isArray(bindings)) return [];
  return bindings.flatMap((binding) => {
    if (binding === null || typeof binding !== 'object' || Array.isArray(binding)) return [];
    const { role, assetId } = binding;
    return typeof role === 'string' && typeof assetId === 'string' ? [{ role, assetId }] : [];
  });
}

export type PrintingRow = {
  readonly printingId: string; readonly definitionId: string; readonly definitionVersion: number;
  readonly appearance: JsonValue; readonly appearanceHash: string;
};

/** Impressão imutável + `printing_assets` como projeção exata de `appearance.assetBindings` (persistencia §11). */
export function insertPrinting(db: DB, printing: PrintingRow, at: string): void {
  run(db, `INSERT INTO card_printings(printing_id, definition_id, definition_version, appearance_json, appearance_hash, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
  [printing.printingId, printing.definitionId, printing.definitionVersion, toJson(printing.appearance), printing.appearanceHash, at]);
  for (const binding of assetBindings(printing.appearance)) {
    run(db, 'INSERT INTO printing_assets(printing_id, role, asset_id) VALUES (?, ?, ?)', [printing.printingId, binding.role, binding.assetId]);
  }
}

export function insertEditorAssetRefs(db: DB, projectId: string, revision: number, refs: readonly { readonly role: string; readonly assetId: string }[]): void {
  const seen = new Set<string>();
  for (const ref of refs) {
    const key = `${ref.role}\u0000${ref.assetId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    run(db, 'INSERT INTO editor_asset_refs(project_id, revision, role, asset_id) VALUES (?, ?, ?, ?)', [projectId, revision, ref.role, ref.assetId]);
  }
}

function assertAttemptOwned(ctx: CommitContext, attemptId: string): void {
  const owner = scalarText(ctx.db, 'SELECT profile_id FROM attempts WHERE attempt_id = ?', [attemptId]);
  if (owner === undefined) fail('NOT_FOUND', `tentativa ${attemptId} inexistente`);
  if (owner !== ctx.profileId) fail('INTERNAL_INTEGRITY_ERROR', `tentativa ${attemptId} pertence a outro perfil`);
}

// ---- handlers

const HANDLERS: Handlers = {
  INSERT_PROFILE: () => fail('INTERNAL_INTEGRITY_ERROR', 'INSERT_PROFILE só pode ser a primeira mutação do lote'),

  SET_PROFILE_RNG: (ctx, m) => {
    run(ctx.db, 'UPDATE profiles SET economy_rng_json = ? WHERE profile_id = ?', [toJson(m.rngJson), ctx.profileId]);
  },

  SET_PROFILE_ARCHIVED: (ctx, m) => {
    run(ctx.db, 'UPDATE profiles SET archived = ? WHERE profile_id = ?', [bit(m.archived), ctx.profileId]);
  },

  WALLET_DELTA: (ctx, m) => {
    if (!Number.isSafeInteger(m.delta)) fail('INTERNAL_INTEGRITY_ERROR', `delta não inteiro em ${m.resourceId}`);
    if (m.delta === 0) return;
    const current = scalarInt(ctx.db, 'SELECT balance FROM wallets WHERE profile_id = ? AND resource_id = ?', [ctx.profileId, m.resourceId]) ?? 0;
    const next = current + m.delta;
    if (next < 0) fail('INSUFFICIENT_CREDITS', `${m.resourceId}: saldo ${current}, débito ${-m.delta}`);
    run(ctx.db, `INSERT INTO wallets(profile_id, resource_id, balance) VALUES (?, ?, ?)
                 ON CONFLICT(profile_id, resource_id) DO UPDATE SET balance = excluded.balance`, [ctx.profileId, m.resourceId, next]);
    run(ctx.db, 'INSERT INTO wallet_entries(operation_id, entry_no, profile_id, resource_id, delta, balance_after) VALUES (?, ?, ?, ?, ?, ?)',
      [ctx.operationId, ctx.walletEntryNo, ctx.profileId, m.resourceId, m.delta, next]);
    ctx.walletEntryNo += 1;
  },

  INVENTORY_DELTA: (ctx, m) => {
    if (!Number.isSafeInteger(m.delta)) fail('INTERNAL_INTEGRITY_ERROR', `delta não inteiro em ${m.printingId}`);
    if (m.delta === 0) return;
    const current = scalarInt(ctx.db, 'SELECT quantity FROM inventory WHERE profile_id = ? AND printing_id = ?', [ctx.profileId, m.printingId]) ?? 0;
    const next = current + m.delta;
    if (next < 0) fail('INTERNAL_INTEGRITY_ERROR', `${m.printingId}: quantidade ${current}, retirada ${-m.delta}`);
    run(ctx.db, `INSERT INTO inventory(profile_id, printing_id, quantity) VALUES (?, ?, ?)
                 ON CONFLICT(profile_id, printing_id) DO UPDATE SET quantity = excluded.quantity`, [ctx.profileId, m.printingId, next]);
    run(ctx.db, 'INSERT INTO inventory_entries(operation_id, entry_no, profile_id, printing_id, delta, quantity_after) VALUES (?, ?, ?, ?, ?, ?)',
      [ctx.operationId, ctx.inventoryEntryNo, ctx.profileId, m.printingId, m.delta, next]);
    ctx.inventoryEntryNo += 1;
  },

  INSERT_DECK: (ctx, m) => {
    run(ctx.db, 'INSERT INTO decks(deck_id, profile_id, name, head_revision, archived, created_at) VALUES (?, ?, ?, 0, 0, ?)',
      [m.deckId, ctx.profileId, m.name, ctx.at]);
  },

  INSERT_DECK_VERSION: (ctx, m) => {
    if (!Number.isSafeInteger(m.revision) || m.revision <= m.expectedHead) fail('INTERNAL_INTEGRITY_ERROR', `revisão ${m.revision} não avança a head ${m.expectedHead}`);
    const changed = run(ctx.db, 'UPDATE decks SET head_revision = ?, name = COALESCE(?, name) WHERE deck_id = ? AND profile_id = ? AND head_revision = ?',
      [m.revision, m.name ?? null, m.deckId, ctx.profileId, m.expectedHead]);
    if (changed !== 1) fail('REVISION_CONFLICT', `deck ${m.deckId}: head diferente de ${m.expectedHead}`);
    insertDeckVersion(ctx.db, m.deckId, m.revision, m.status, m.energyTypes, m.validation, m.entries, ctx.at);
  },

  SET_DECK_ARCHIVED: (ctx, m) => {
    const changed = run(ctx.db, 'UPDATE decks SET archived = ? WHERE deck_id = ? AND profile_id = ?', [bit(m.archived), m.deckId, ctx.profileId]);
    if (changed !== 1) fail('NOT_FOUND', `deck ${m.deckId} inexistente neste perfil`);
  },

  UPSERT_CAMPAIGN_PROGRESS: (ctx, m) => {
    run(ctx.db, `INSERT INTO campaign_progress(profile_id, campaign_id, node_id, campaign_version, status, progress_json, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(profile_id, campaign_id, node_id) DO UPDATE SET campaign_version = excluded.campaign_version,
                   status = excluded.status, progress_json = excluded.progress_json, updated_at = excluded.updated_at`,
    [ctx.profileId, m.campaignId, m.nodeId, m.campaignVersion, m.status, toJson(m.progress), ctx.at]);
  },

  INSERT_ATTEMPT: (ctx, m) => {
    const active = scalarText(ctx.db, "SELECT attempt_id FROM attempts WHERE profile_id = ? AND status IN ('RUNNING','SUSPENDED')", [ctx.profileId]);
    if (active !== undefined) fail('ACTIVE_ATTEMPT_EXISTS', `tentativa ativa ${active}`);
    run(ctx.db, `INSERT INTO attempts(attempt_id, profile_id, mode, status, campaign_id, node_id, difficulty, deck_id, deck_revision,
                   progression_eligible, state_version, ruleset_id, engine_version, content_fingerprint, state_json, rng_json,
                   presentation_snapshot_json, result_json, created_at, updated_at)
                 VALUES (?, ?, ?, 'RUNNING', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    [m.attemptId, ctx.profileId, m.mode, m.campaignId, m.nodeId, m.difficulty, m.deckId, m.deckRevision, bit(m.progressionEligible),
      m.stateVersion, m.rulesetId, m.engineVersion, m.contentFingerprint, toJson(m.state), toJson(m.rng), toJson(m.presentationSnapshot), ctx.at, ctx.at]);
    for (const printingId of unique(m.cardRefs)) run(ctx.db, 'INSERT INTO attempt_card_refs(attempt_id, printing_id) VALUES (?, ?)', [m.attemptId, printingId]);
    for (const assetId of unique(m.assetRefs)) run(ctx.db, 'INSERT INTO attempt_asset_refs(attempt_id, asset_id) VALUES (?, ?)', [m.attemptId, assetId]);
  },

  UPDATE_ATTEMPT: (ctx, m) => {
    const changed = run(ctx.db, `UPDATE attempts SET state_version = ?, status = ?, state_json = ?, rng_json = ?, result_json = ?, updated_at = ?
                                 WHERE attempt_id = ? AND profile_id = ? AND state_version = ? AND status IN ('RUNNING','SUSPENDED')`,
    [m.stateVersion, m.status, toJson(m.state), toJson(m.rng), toJsonOrNull(m.result), ctx.at, m.attemptId, ctx.profileId, m.expectedStateVersion]);
    if (changed === 1) return;
    const current = row(ctx.db, 'SELECT status, state_version FROM attempts WHERE attempt_id = ? AND profile_id = ?', [m.attemptId, ctx.profileId]);
    if (!current) fail('NOT_FOUND', `tentativa ${m.attemptId} inexistente neste perfil`);
    fail('STATE_VERSION_MISMATCH', `tentativa ${m.attemptId}: esperado ${m.expectedStateVersion}, confirmado ${String(current.state_version)} (${String(current.status)})`);
  },

  INSERT_BATTLE_EVENTS: (ctx, m) => {
    for (const event of m.events) {
      run(ctx.db, `INSERT INTO battle_events(attempt_id, sequence_no, profile_id, operation_id, state_version, event_type, event_json)
                   VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [m.attemptId, event.seq, ctx.profileId, ctx.operationId, m.stateVersion, event.type, toJson(event.event)]);
    }
  },

  INSERT_CHECKPOINT: (ctx, m) => {
    assertAttemptOwned(ctx, m.attemptId);
    run(ctx.db, `INSERT INTO battle_checkpoints(attempt_id, state_version, last_event_sequence, snapshot_json, snapshot_hash, created_at)
                 VALUES (?, ?, ?, ?, ?, ?)`,
    [m.attemptId, m.stateVersion, m.lastEventSequence, toJson(m.snapshot), m.snapshotHash, ctx.at]);
  },

  INSERT_REPLAY: (ctx, m) => {
    assertAttemptOwned(ctx, m.attemptId);
    run(ctx.db, 'INSERT INTO replays(replay_id, attempt_id, metadata_json, created_at) VALUES (?, ?, ?, ?)', [m.replayId, m.attemptId, toJson(m.metadata), ctx.at]);
  },

  INSERT_PENDING_REWARD: (ctx, m) => {
    const existing = scalarText(ctx.db, 'SELECT reward_id FROM pending_rewards WHERE profile_id = ? AND grant_key = ?', [ctx.profileId, m.grantKey]);
    if (existing !== undefined) fail('REWARD_ALREADY_GRANTED', `direito pendente ${m.grantKey} já registrado`);
    run(ctx.db, `INSERT INTO pending_rewards(reward_id, profile_id, grant_key, status, options_json, choice_json, source_operation_id,
                   source_attempt_id, operation_id, created_at)
                 VALUES (?, ?, ?, 'PENDING', ?, NULL, ?, ?, NULL, ?)`,
    [m.rewardId, ctx.profileId, m.grantKey, toJson(m.options), ctx.operationId, m.sourceAttemptId, ctx.at]);
  },

  CLAIM_PENDING_REWARD: (ctx, m) => {
    const changed = run(ctx.db, `UPDATE pending_rewards SET status = 'CLAIMED', choice_json = ?, operation_id = ?
                                 WHERE reward_id = ? AND profile_id = ? AND status = 'PENDING'`,
    [toJson(m.choice), ctx.operationId, m.rewardId, ctx.profileId]);
    if (changed === 1) return;
    const status = scalarText(ctx.db, 'SELECT status FROM pending_rewards WHERE reward_id = ? AND profile_id = ?', [m.rewardId, ctx.profileId]);
    if (status === undefined) fail('NOT_FOUND', `prêmio pendente ${m.rewardId} inexistente`);
    fail('REWARD_ALREADY_GRANTED', `prêmio pendente ${m.rewardId} já escolhido`);
  },

  GRANT_ENTITLEMENT: (ctx, m) => {
    const owned = scalarText(ctx.db, 'SELECT origin FROM cosmetic_entitlements WHERE profile_id = ? AND cosmetic_id = ?', [ctx.profileId, m.cosmeticId]);
    if (owned !== undefined) {
      // Compra repetida nunca debita de novo (persistencia §13.1 BUY_COSMETIC); demais origens: INSERT OR IGNORE.
      if (m.origin === 'PURCHASE') fail('REWARD_ALREADY_GRANTED', `cosmético ${m.cosmeticId} já possuído`);
      ctx.ignoredEntitlements.push(m.cosmeticId);
      return;
    }
    run(ctx.db, 'INSERT INTO cosmetic_entitlements(profile_id, cosmetic_id, origin, operation_id, acquired_at) VALUES (?, ?, ?, ?, ?)',
      [ctx.profileId, m.cosmeticId, m.origin, ctx.operationId, ctx.at]);
  },

  INSERT_COSMETIC_PRESET: (ctx, m) => {
    run(ctx.db, 'INSERT INTO cosmetic_presets(preset_id, revision, profile_id, config_json, created_at) VALUES (?, ?, ?, ?, ?)',
      [m.presetId, m.revision, ctx.profileId, toJson(m.config), ctx.at]);
    for (const assetId of unique(m.assetIds)) {
      run(ctx.db, 'INSERT INTO cosmetic_asset_refs(preset_id, revision, asset_id) VALUES (?, ?, ?)', [m.presetId, m.revision, assetId]);
    }
  },

  SET_PROFILE_APPEARANCE: (ctx, m) => {
    run(ctx.db, `INSERT INTO profile_appearance(profile_id, preset_id, preset_revision) VALUES (?, ?, ?)
                 ON CONFLICT(profile_id) DO UPDATE SET preset_id = excluded.preset_id, preset_revision = excluded.preset_revision`,
    [ctx.profileId, m.presetId, m.presetRevision]);
  },

  SET_DECK_APPEARANCE: (ctx, m) => {
    const owner = scalarText(ctx.db, 'SELECT profile_id FROM deck_appearance WHERE deck_id = ?', [m.deckId]);
    if (owner !== undefined && owner !== ctx.profileId) fail('INTERNAL_INTEGRITY_ERROR', `deck ${m.deckId} pertence a outro perfil`);
    run(ctx.db, `INSERT INTO deck_appearance(deck_id, profile_id, mode, preset_id, preset_revision) VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT(deck_id) DO UPDATE SET mode = excluded.mode, preset_id = excluded.preset_id, preset_revision = excluded.preset_revision`,
    [m.deckId, ctx.profileId, m.mode, m.presetId, m.presetRevision]);
  },

  UPSERT_BINDER: (ctx, m) => {
    const owner = scalarText(ctx.db, 'SELECT profile_id FROM binders WHERE binder_id = ?', [m.binderId]);
    if (owner === undefined) {
      run(ctx.db, `INSERT INTO binders(binder_id, profile_id, name, kind, layout_json, sort_order, archived, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [m.binderId, ctx.profileId, m.name, m.binderKind, toJson(m.layout), m.sortOrder, ctx.at, ctx.at]);
    } else {
      if (owner !== ctx.profileId) fail('INTERNAL_INTEGRITY_ERROR', `fichário ${m.binderId} pertence a outro perfil`);
      run(ctx.db, 'UPDATE binders SET name = ?, kind = ?, layout_json = ?, sort_order = ?, updated_at = ? WHERE binder_id = ?',
        [m.name, m.binderKind, toJson(m.layout), m.sortOrder, ctx.at, m.binderId]);
      run(ctx.db, 'DELETE FROM binder_slots WHERE binder_id = ?', [m.binderId]);
    }
    for (const slot of m.slots) {
      run(ctx.db, 'INSERT INTO binder_slots(binder_id, page_no, slot_no, printing_id) VALUES (?, ?, ?, ?)', [m.binderId, slot.pageNo, slot.slotNo, slot.printingId]);
    }
  },

  SET_BINDER_ARCHIVED: (ctx, m) => {
    const changed = run(ctx.db, 'UPDATE binders SET archived = ?, updated_at = ? WHERE binder_id = ? AND profile_id = ?', [bit(m.archived), ctx.at, m.binderId, ctx.profileId]);
    if (changed !== 1) fail('NOT_FOUND', `fichário ${m.binderId} inexistente neste perfil`);
  },

  INSERT_ASSET_BLOB: (ctx, m) => {
    putAsset(ctx.db, m, ctx.at);
  },

  INSERT_CARD_DEFINITION: (ctx, m) => {
    run(ctx.db, 'INSERT INTO card_definitions(definition_id, namespace, owner_profile_id, created_at, archived) VALUES (?, ?, ?, ?, 0)',
      [m.definitionId, m.namespace, m.namespace === 'CUSTOM' ? ctx.profileId : null, ctx.at]);
  },

  SET_DEFINITION_ARCHIVED: (ctx, m) => {
    const changed = run(ctx.db, 'UPDATE card_definitions SET archived = ? WHERE definition_id = ?', [bit(m.archived), m.definitionId]);
    if (changed !== 1) fail('NOT_FOUND', `definição ${m.definitionId} inexistente`);
  },

  INSERT_CARD_VERSION: (ctx, m) => {
    run(ctx.db, `INSERT INTO card_versions(definition_id, version, rules_json, rules_hash, ruleset_id, search_key, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [m.definitionId, m.version, toJson(m.rules), m.rulesHash, m.rulesetId, m.searchKey, ctx.at]);
  },

  INSERT_PUBLICATION: (ctx, m) => {
    run(ctx.db, `INSERT INTO card_publications(definition_id, version, validator_version, validation_report_json, profile_id, project_id,
                   project_revision, operation_id, published_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [m.definitionId, m.version, m.validatorVersion, toJson(m.report), ctx.profileId, m.projectId, m.projectRevision, ctx.operationId, ctx.at]);
  },

  SET_CATALOG_HEAD: (ctx, m) => {
    run(ctx.db, `INSERT INTO card_catalog_heads(definition_id, version) VALUES (?, ?)
                 ON CONFLICT(definition_id) DO UPDATE SET version = excluded.version`, [m.definitionId, m.version]);
  },

  INSERT_CARD_DEPENDENCY: (ctx, m) => {
    run(ctx.db, 'INSERT INTO card_dependencies(definition_id, version, dependency_id, dependency_version, dependency_kind) VALUES (?, ?, ?, ?, ?)',
      [m.definitionId, m.version, m.dependencyId, m.dependencyVersion, m.dependencyKind]);
  },

  INSERT_PRINTING: (ctx, m) => {
    insertPrinting(ctx.db, m, ctx.at);
  },

  INSERT_EDITOR_REVISION_PUBLISHED: (ctx, m) => {
    // CAS de editor_projects.head_revision (persistencia §18): a revisão publicada é a nova head (= head + 1).
    const changed = run(ctx.db, 'UPDATE editor_projects SET head_revision = ?, updated_at = ? WHERE project_id = ? AND profile_id = ? AND head_revision = ?',
      [m.revision, ctx.at, m.projectId, ctx.profileId, m.revision - 1]);
    if (changed !== 1) fail('REVISION_CONFLICT', `projeto ${m.projectId}: head diferente de ${m.revision - 1}`);
    run(ctx.db, `INSERT INTO editor_revisions(project_id, revision, kind, draft_json, validation_summary_json, created_at)
                 VALUES (?, ?, 'PUBLISHED', ?, ?, ?)`,
    [m.projectId, m.revision, toJson(m.draft), toJson(m.validationSummary), ctx.at]);
    insertEditorAssetRefs(ctx.db, m.projectId, m.revision, m.assetRefs);
  },

  ARCHIVE_MARK: (ctx, m) => {
    if (m.archived === false) {
      run(ctx.db, 'DELETE FROM catalog_archive_marks WHERE entity_kind = ? AND entity_id = ? AND entity_version = ?', [m.entityKind, m.entityId, m.entityVersion]);
      return;
    }
    run(ctx.db, `INSERT INTO catalog_archive_marks(entity_kind, entity_id, entity_version, profile_id, archived_at) VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT(entity_kind, entity_id, entity_version) DO NOTHING`,
    [m.entityKind, m.entityId, m.entityVersion, ctx.profileId, ctx.at]);
  },

  INSERT_PROFILE_IMPORT: (ctx, m) => {
    run(ctx.db, `INSERT INTO profile_imports(import_id, source_kind, source_fingerprint, target_profile_id, report_json, completed_at)
                 VALUES (?, ?, ?, ?, ?, ?)`,
    [m.importId, m.sourceKind, m.sourceFingerprint, ctx.profileId, toJson(m.report), ctx.at]);
  },

  IMPORT_PROFILE_ROWS: (ctx, m) => {
    applyProfileImport(ctx, m);
  },

  DELETE_APPEARANCE_DRAFT: (ctx, m) => {
    run(ctx.db, 'DELETE FROM appearance_drafts WHERE profile_id = ? AND editor_context_id = ?', [ctx.profileId, m.contextId]);
  },
};

export function applyMutation(ctx: CommitContext, mutation: Mutation): void {
  const handler = HANDLERS[mutation.kind] as (ctx: CommitContext, m: Mutation) => void;
  handler(ctx, mutation);
}
