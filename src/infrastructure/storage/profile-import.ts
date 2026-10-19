// IMPORT_PROFILE (persistencia-sqlite.md §13.1, §22, §24.1, §25): reaplica as linhas validadas de um perfil
// portátil — já remapeadas pela aplicação — num perfil NOVO, dentro da transação do commit. Conteúdo CUSTOM e
// assets são reutilizados por ID + hash; mesmo ID com hash diferente é conflito (DB-047), nunca sobrescrita.
// Colunas sempre explícitas; nenhum SQL vem do arquivo importado.
import type { ImportPreflightInput, ImportPreflightResult, Mutation } from '../../application/ports/storage.ts';
import { fail, isStorageFailure, toStorageError } from './errors.ts';
import { insertDeckVersion, insertEditorAssetRefs, insertPrinting, operationIdFor, type CommitContext } from './mutations.ts';
import { bit, rows, run, scalarInt, scalarText, text, toJson, toJsonOrNull, unique, type DB } from './sql.ts';

type ImportRows = Extract<Mutation, { kind: 'IMPORT_PROFILE_ROWS' }>;

/** Converte violações de restrição em erros de importação (dados do arquivo), preservando FK → conteúdo ausente. */
function asImportFailure(error: unknown): never {
  if (isStorageFailure(error)) throw error;
  const classified = toStorageError(error, 'install');
  return fail(classified.code === 'SAVE_WRITE_FAILED' || classified.code === 'STORAGE_FULL' || classified.code === 'DATABASE_CORRUPT'
    ? classified.code : classified.code === 'CONTENT_REFERENCE_MISSING' ? 'CONTENT_REFERENCE_MISSING' : 'IMPORT_INVALID', `importação: ${classified.message}`);
}

export function applyProfileImport(ctx: CommitContext, m: ImportRows): void {
  try {
    applyRows(ctx, m);
  } catch (error) {
    asImportFailure(error);
  }
}

function applyRows(ctx: CommitContext, { rows: data, content }: ImportRows): void {
  const { db, profileId: P } = ctx;
  const importRevision = ctx.committedRevision;
  const history = data.operations.map((o) => o.committedRevision);
  if (history.length !== importRevision - 1 || history.some((r, i) => r !== i + 1)) {
    fail('IMPORT_INVALID', `operações do arquivo precisam ocupar as revisões 1..${importRevision - 1}`);
  }
  const op = (revision: number): string => {
    if (revision === importRevision) return ctx.operationId;
    if (!Number.isSafeInteger(revision) || revision < 1 || revision >= importRevision) fail('IMPORT_INVALID', `referência à revisão ${revision} inexistente`);
    return operationIdFor(P, revision);
  };

  // 1. Assets por hash (o hash dos bytes foi conferido antes do BEGIN).
  for (const asset of content.assets) {
    if (scalarInt(db, 'SELECT 1 FROM assets WHERE asset_id = ?', [asset.assetId]) !== undefined) continue;
    run(db, `INSERT INTO assets(asset_id, storage_kind, media_type, logical_path, bytes, byte_length, width, height, metadata_json, created_at)
             VALUES (?, 'BLOB', ?, NULL, ?, ?, ?, ?, ?, ?)`,
    [asset.assetId, asset.mediaType, asset.bytes, asset.bytes.length, asset.width, asset.height, toJson(asset.metadata), asset.createdAt]);
  }

  // 2–3. Definições e versões CUSTOM: reutilizar por ID + hash; inserir as ausentes com o perfil novo como dono.
  for (const d of content.definitions) {
    const namespace = scalarText(db, 'SELECT namespace FROM card_definitions WHERE definition_id = ?', [d.definitionId]);
    if (namespace === undefined) {
      run(db, "INSERT INTO card_definitions(definition_id, namespace, owner_profile_id, created_at, archived) VALUES (?, 'CUSTOM', ?, ?, ?)",
        [d.definitionId, P, d.createdAt, bit(d.archived)]);
    } else if (namespace !== 'CUSTOM') {
      fail('IMPORT_INVALID', `conflito: a definição ${d.definitionId} já existe como ${namespace}`);
    }
  }
  const insertedVersions = content.versions.filter((v) => {
    const stored = scalarText(db, 'SELECT rules_hash FROM card_versions WHERE definition_id = ? AND version = ?', [v.definitionId, v.version]);
    if (stored === undefined) return true;
    if (stored !== v.rulesHash) fail('IMPORT_INVALID', `conflito: ${v.definitionId} v${v.version} já existe com outro rules_hash`);
    return false;
  });
  for (const v of insertedVersions) {
    run(db, 'INSERT INTO card_versions(definition_id, version, rules_json, rules_hash, ruleset_id, search_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [v.definitionId, v.version, toJson(v.rules), v.rulesHash, v.rulesetId, v.searchKey, v.createdAt]);
  }

  // 4. Histórico de operações (revisões 1..N); a operação IMPORT_PROFILE (N+1) já foi gravada pelo commit.
  for (const o of data.operations) {
    run(db, `INSERT INTO operations(operation_id, profile_id, command_id, command_type, payload_hash, committed_revision, receipt_json, committed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [op(o.committedRevision), P, o.commandId, o.commandType, o.payloadHash, o.committedRevision, toJson(o.receipt), o.committedAt]);
  }

  // 5. Projetos do Estúdio e revisões retidas (antes das publicações que os referenciam).
  for (const p of data.projects) {
    run(db, `INSERT INTO editor_projects(project_id, profile_id, title, mode, status, head_revision, target_definition_id, source_definition_id,
               source_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.projectId, P, p.title, p.mode, p.status, p.headRevision, p.targetDefinitionId, p.sourceDefinitionId, p.sourceVersion, p.createdAt, p.updatedAt]);
    for (const r of p.revisions) {
      run(db, 'INSERT INTO editor_revisions(project_id, revision, kind, draft_json, validation_summary_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [p.projectId, r.revision, r.kind, toJson(r.draft), toJson(r.validationSummary), r.createdAt]);
      insertEditorAssetRefs(db, p.projectId, r.revision, r.assetRefs);
    }
  }
  const importedProjects = new Set(data.projects.map((p) => p.projectId));

  // 6–8. Publicações, heads e dependências apenas das versões inseridas agora.
  for (const v of insertedVersions) {
    const pub = v.publication;
    if (!pub) continue;
    const linked = pub.projectId !== null && importedProjects.has(pub.projectId) && pub.projectRevision !== null && pub.operationRevision !== null;
    run(db, `INSERT INTO card_publications(definition_id, version, validator_version, validation_report_json, profile_id, project_id,
               project_revision, operation_id, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [v.definitionId, v.version, pub.validatorVersion, toJson(pub.report), P, linked ? pub.projectId : null, linked ? pub.projectRevision : null,
      linked ? op(pub.operationRevision!) : null, pub.publishedAt]);
  }
  const heads = new Map<string, number>();
  for (const h of content.catalogHeads) heads.set(h.definitionId, h.version);
  for (const v of insertedVersions) if (!heads.has(v.definitionId)) heads.set(v.definitionId, Math.max(...insertedVersions.filter((x) => x.definitionId === v.definitionId).map((x) => x.version)));
  for (const [definitionId, version] of heads) {
    const current = scalarInt(db, 'SELECT version FROM card_catalog_heads WHERE definition_id = ?', [definitionId]);
    if (current !== undefined && current >= version) continue;
    if (scalarInt(db, 'SELECT 1 FROM card_publications WHERE definition_id = ? AND version = ?', [definitionId, version]) === undefined) continue;
    run(db, `INSERT INTO card_catalog_heads(definition_id, version) VALUES (?, ?)
             ON CONFLICT(definition_id) DO UPDATE SET version = excluded.version`, [definitionId, version]);
  }
  for (const v of insertedVersions) {
    for (const d of v.dependencies) {
      run(db, 'INSERT INTO card_dependencies(definition_id, version, dependency_id, dependency_version, dependency_kind) VALUES (?, ?, ?, ?, ?)',
        [v.definitionId, v.version, d.dependencyId, d.dependencyVersion, d.dependencyKind]);
    }
  }

  // 9. Impressões: reutilizar por ID + appearance_hash; `printing_assets` = projeção dos bindings.
  for (const p of content.printings) {
    const stored = scalarText(db, 'SELECT appearance_hash FROM card_printings WHERE printing_id = ?', [p.printingId]);
    if (stored === undefined) insertPrinting(db, p, p.createdAt);
    else if (stored !== p.appearanceHash) fail('IMPORT_INVALID', `conflito: a impressão ${p.printingId} já existe com outro appearance_hash`);
  }

  // 10. Execuções de teste (IDs remapeados), depois das revisões.
  for (const p of data.projects) {
    for (const t of p.testRuns) {
      run(db, `INSERT INTO card_test_runs(run_id, project_id, revision, runner_version, rules_hash, scenario_json, result_json, outcome, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [t.runId, p.projectId, t.revision, t.runnerVersion, t.rulesHash, toJson(t.scenario), toJson(t.result), t.outcome, t.createdAt]);
    }
  }

  // 11–13. Preferências, carteira, coleção e seus livros-razão.
  for (const s of data.settings) run(db, 'INSERT INTO settings(profile_id, setting_key, value_json) VALUES (?, ?, ?)', [P, s.key, toJson(s.value)]);
  for (const w of data.wallets) run(db, 'INSERT INTO wallets(profile_id, resource_id, balance) VALUES (?, ?, ?)', [P, w.resourceId, w.balance]);
  for (const e of data.walletEntries) {
    run(db, 'INSERT INTO wallet_entries(operation_id, entry_no, profile_id, resource_id, delta, balance_after) VALUES (?, ?, ?, ?, ?, ?)',
      [op(e.operationRevision), e.entryNo, P, e.resourceId, e.delta, e.balanceAfter]);
  }
  for (const i of data.inventory) run(db, 'INSERT INTO inventory(profile_id, printing_id, quantity) VALUES (?, ?, ?)', [P, i.printingId, i.quantity]);
  for (const e of data.inventoryEntries) {
    run(db, 'INSERT INTO inventory_entries(operation_id, entry_no, profile_id, printing_id, delta, quantity_after) VALUES (?, ?, ?, ?, ?, ?)',
      [op(e.operationRevision), e.entryNo, P, e.printingId, e.delta, e.quantityAfter]);
  }

  // 14–15. Decks com todas as revisões; presets e aparência.
  for (const d of data.decks) {
    run(db, 'INSERT INTO decks(deck_id, profile_id, name, head_revision, archived, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [d.deckId, P, d.name, d.headRevision, bit(d.archived), d.createdAt]);
    for (const v of d.versions) {
      const energyTypes = Array.isArray(v.energyTypes) ? v.energyTypes.map(String) : [];
      insertDeckVersion(db, d.deckId, v.revision, v.status, energyTypes, v.validation, v.entries, v.createdAt);
    }
  }
  for (const p of data.cosmeticPresets) {
    run(db, 'INSERT INTO cosmetic_presets(preset_id, revision, profile_id, config_json, created_at) VALUES (?, ?, ?, ?, ?)',
      [p.presetId, p.revision, P, toJson(p.config), p.createdAt]);
    for (const assetId of unique(p.assetIds)) run(db, 'INSERT INTO cosmetic_asset_refs(preset_id, revision, asset_id) VALUES (?, ?, ?)', [p.presetId, p.revision, assetId]);
  }
  if (data.profileAppearance) {
    run(db, 'INSERT INTO profile_appearance(profile_id, preset_id, preset_revision) VALUES (?, ?, ?)', [P, data.profileAppearance.presetId, data.profileAppearance.presetRevision]);
  }
  for (const a of data.deckAppearance) {
    run(db, 'INSERT INTO deck_appearance(deck_id, profile_id, mode, preset_id, preset_revision) VALUES (?, ?, ?, ?, ?)', [a.deckId, P, a.mode, a.presetId, a.presetRevision]);
  }

  // 16–17. Campanha, tentativas (RUNNING vira SUSPENDED: o perfil novo não tem sessão aberta), eventos, checkpoints e replays.
  for (const c of data.campaignProgress) {
    run(db, `INSERT INTO campaign_progress(profile_id, campaign_id, node_id, campaign_version, status, progress_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [P, c.campaignId, c.nodeId, c.campaignVersion, c.status, toJson(c.progress), c.updatedAt]);
  }
  for (const a of data.attempts) {
    run(db, `INSERT INTO attempts(attempt_id, profile_id, mode, status, campaign_id, node_id, difficulty, deck_id, deck_revision, progression_eligible,
               state_version, ruleset_id, engine_version, content_fingerprint, state_json, rng_json, presentation_snapshot_json, result_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [a.attemptId, P, a.mode, a.status === 'RUNNING' ? 'SUSPENDED' : a.status, a.campaignId, a.nodeId, a.difficulty, a.deckId, a.deckRevision,
      bit(a.progressionEligible), a.stateVersion, a.rulesetId, a.engineVersion, a.contentFingerprint, toJson(a.state), toJson(a.rng),
      toJson(a.presentationSnapshot), toJsonOrNull(a.result), a.createdAt, a.updatedAt]);
    for (const printingId of unique(a.cardRefs)) run(db, 'INSERT INTO attempt_card_refs(attempt_id, printing_id) VALUES (?, ?)', [a.attemptId, printingId]);
    for (const assetId of unique(a.assetRefs)) run(db, 'INSERT INTO attempt_asset_refs(attempt_id, asset_id) VALUES (?, ?)', [a.attemptId, assetId]);
    for (const e of a.events) {
      run(db, `INSERT INTO battle_events(attempt_id, sequence_no, profile_id, operation_id, state_version, event_type, event_json) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [a.attemptId, e.seq, P, op(e.operationRevision), e.stateVersion, e.type, toJson(e.event)]);
    }
    for (const c of a.checkpoints) {
      run(db, `INSERT INTO battle_checkpoints(attempt_id, state_version, last_event_sequence, snapshot_json, snapshot_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [a.attemptId, c.stateVersion, c.lastEventSequence, toJson(c.snapshot), c.snapshotHash, c.createdAt]);
    }
  }
  for (const r of data.replays) run(db, 'INSERT INTO replays(replay_id, attempt_id, metadata_json, created_at) VALUES (?, ?, ?, ?)', [r.replayId, r.attemptId, toJson(r.metadata), r.createdAt]);

  // 18–20. Prêmios pendentes, concessões e entitlements (cada um com a operação de origem remapeada).
  for (const r of data.pendingRewards) {
    run(db, `INSERT INTO pending_rewards(reward_id, profile_id, grant_key, status, options_json, choice_json, source_operation_id, source_attempt_id,
               operation_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [r.rewardId, P, r.grantKey, r.status, toJson(r.options), toJsonOrNull(r.choice), op(r.sourceOperationRevision), r.sourceAttemptId,
      r.operationRevision === null ? null : op(r.operationRevision), r.createdAt]);
  }
  for (const g of data.rewardGrants) {
    run(db, 'INSERT INTO reward_grants(profile_id, grant_key, operation_id, granted_at) VALUES (?, ?, ?, ?)', [P, g.grantKey, op(g.operationRevision), g.grantedAt]);
  }
  for (const e of data.entitlements) {
    run(db, 'INSERT INTO cosmetic_entitlements(profile_id, cosmetic_id, origin, operation_id, acquired_at) VALUES (?, ?, ?, ?, ?)',
      [P, e.cosmeticId, e.origin, op(e.operationRevision), e.acquiredAt]);
  }

  // 21–23. Oficina, fichários e marcas de coleção.
  for (const d of data.appearanceDrafts) {
    run(db, 'INSERT INTO appearance_drafts(profile_id, editor_context_id, revision, draft_json) VALUES (?, ?, ?, ?)', [P, d.contextId, d.revision, toJson(d.draft)]);
    for (const assetId of unique(d.assetIds)) run(db, 'INSERT INTO appearance_draft_assets(profile_id, editor_context_id, asset_id) VALUES (?, ?, ?)', [P, d.contextId, assetId]);
  }
  for (const b of data.binders) {
    run(db, `INSERT INTO binders(binder_id, profile_id, name, kind, layout_json, sort_order, archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [b.binderId, P, b.name, b.kind, toJson(b.layout), b.sortOrder, bit(b.archived), b.createdAt, b.updatedAt]);
    for (const s of b.slots) run(db, 'INSERT INTO binder_slots(binder_id, page_no, slot_no, printing_id) VALUES (?, ?, ?, ?)', [b.binderId, s.pageNo, s.slotNo, s.printingId]);
  }
  for (const mark of data.collectionMarks) {
    run(db, 'INSERT INTO collection_marks(profile_id, mark_kind, subject_kind, subject_id, created_at) VALUES (?, ?, ?, ?, ?)',
      [P, mark.markKind, mark.subjectKind, mark.subjectId, mark.createdAt]);
  }

  // Identidade temporal original do perfil; updated_at fica com o momento da importação.
  run(db, 'UPDATE profiles SET created_at = ? WHERE profile_id = ?', [data.profile.createdAt, P]);
}

/** Depois das mutações: o perfil importado tem exatamente uma operação por revisão (1..N+1). */
export function verifyImportedOperations(db: DB, profileId: string, committedRevision: number): void {
  const total = scalarInt(db, 'SELECT count(*) FROM operations WHERE profile_id = ?', [profileId]) ?? 0;
  if (total !== committedRevision) fail('IMPORT_INVALID', `perfil importado com ${total} operações para a revisão ${committedRevision}`);
}

/** Conflitos de ID + hash, referências ausentes e importações anteriores do mesmo arquivo (fingerprint não único). */
export function importPreflight(db: DB, input: ImportPreflightInput): ImportPreflightResult {
  const conflicts: string[] = [];
  for (const definitionId of unique(input.definitions)) {
    const namespace = scalarText(db, 'SELECT namespace FROM card_definitions WHERE definition_id = ?', [definitionId]);
    if (namespace !== undefined && namespace !== 'CUSTOM') conflicts.push(`Definição ${definitionId} já existe no catálogo base.`);
  }
  let reusedVersions = 0;
  for (const v of input.versions) {
    const stored = scalarText(db, 'SELECT rules_hash FROM card_versions WHERE definition_id = ? AND version = ?', [v.definitionId, v.version]);
    if (stored === undefined) continue;
    if (stored === v.rulesHash) reusedVersions += 1;
    else conflicts.push(`${v.definitionId} v${v.version} já existe com regras diferentes.`);
  }
  let reusedPrintings = 0;
  for (const p of input.printings) {
    const stored = scalarText(db, 'SELECT appearance_hash FROM card_printings WHERE printing_id = ?', [p.printingId]);
    if (stored === undefined) continue;
    if (stored === p.appearanceHash) reusedPrintings += 1;
    else conflicts.push(`Impressão ${p.printingId} já existe com aparência diferente.`);
  }
  const missingPrintings = unique(input.printingRefs).filter((id) => scalarInt(db, 'SELECT 1 FROM card_printings WHERE printing_id = ?', [id]) === undefined);
  const missingVersions = input.versionRefs
    .filter((v) => scalarInt(db, 'SELECT 1 FROM card_versions WHERE definition_id = ? AND version = ?', [v.definitionId, v.version]) === undefined)
    .map((v) => `${v.definitionId} v${v.version}`);
  const missingAssets = unique(input.assetRefs).filter((id) => scalarInt(db, 'SELECT 1 FROM assets WHERE asset_id = ?', [id]) === undefined);
  const previousImports = rows(db, 'SELECT import_id, target_profile_id, completed_at FROM profile_imports WHERE source_fingerprint = ? ORDER BY completed_at, import_id',
    [input.fingerprint]).map((r) => ({ importId: text(r, 'import_id'), targetProfileId: text(r, 'target_profile_id'), completedAt: text(r, 'completed_at') }));
  return { conflicts, missingPrintings, missingVersions: unique(missingVersions), missingAssets, reusedVersions, reusedPrintings, previousImports };
}

export function contentPackages(db: DB) {
  return rows(db, 'SELECT package_id, version, content_hash, origin, installed_at FROM content_packages ORDER BY package_id, version').map((r) => ({
    packageId: text(r, 'package_id'), version: text(r, 'version'), contentHash: text(r, 'content_hash'),
    origin: text(r, 'origin') as 'BASE' | 'CUSTOM', installedAt: text(r, 'installed_at'),
  }));
}

