// Leitura completa de um perfil para o perfil portátil formato 4 (persistencia-sqlite.md §24.1). Uma única
// mensagem ao Storage Worker = um retrato coerente (o worker serializa handlers). Somente SELECTs parametrizados;
// nada de outros perfis entra no resultado (DB-045), exceto conteúdo CUSTOM alcançável pelo próprio perfil.
import type {
  ContentPackageRef, JsonValue, PortableAsset, PortableAttempt, PortableCardVersion, PortableContent, PortableDeck, PortableProject,
  ProfileExportData, ProfileRowsV4,
} from '../../application/ports/storage.ts';
import { fail } from './errors.ts';
import { blob, flag, int, intOrNull, json, jsonOrNull, row, rows, scalarInt, scalarText, text, textOrNull, type DB, type Row } from './sql.ts';

function groupBy<T>(items: readonly Row[], key: string, map: (r: Row) => T): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const r of items) {
    const k = text(r, key);
    const list = out.get(k) ?? [];
    list.push(map(r));
    out.set(k, list);
  }
  return out;
}

function parsePackages(raw: string | undefined): ContentPackageRef[] {
  if (raw === undefined) return [];
  const value = JSON.parse(raw) as unknown;
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (entry === null || typeof entry !== 'object') return [];
    const { packageId, version, contentHash } = entry as Record<string, unknown>;
    return typeof packageId === 'string' && typeof version === 'string' && typeof contentHash === 'string' ? [{ packageId, version, contentHash }] : [];
  });
}

/** Linhas do perfil + conteúdo alcançável. `null` quando o perfil não existe. */
export function gatherProfileExport(db: DB, profileId: string): ProfileExportData | null {
  const profile = row(db, 'SELECT * FROM profiles WHERE profile_id = ?', [profileId]);
  if (!profile) return null;
  const P = [profileId];

  // ---- operações: referência por revisão confirmada (o ID é derivado do perfil na importação)
  const revisionOf = new Map<string, number>();
  const operations = rows(db, 'SELECT * FROM operations WHERE profile_id = ? ORDER BY committed_revision', P).map((r) => {
    const committedRevision = int(r, 'committed_revision');
    revisionOf.set(text(r, 'operation_id'), committedRevision);
    return {
      committedRevision, commandId: text(r, 'command_id'), commandType: text(r, 'command_type'), payloadHash: text(r, 'payload_hash'),
      receipt: json(r, 'receipt_json'), committedAt: text(r, 'committed_at'),
    };
  });
  const rev = (operationId: string): number => {
    const value = revisionOf.get(operationId);
    if (value === undefined) fail('INTERNAL_INTEGRITY_ERROR', `operação ${operationId} não pertence ao perfil ${profileId}`);
    return value;
  };
  const revOrNull = (operationId: string | null): number | null => (operationId === null ? null : rev(operationId));

  // ---- decks, revisões e entradas (todas as revisões: tentativas e replays apontam para revisões antigas)
  const entriesByVersion = new Map<string, { entryNo: number; printingId: string; entryFlairId: string | null }[]>();
  for (const r of rows(db, `SELECT e.deck_id, e.revision, e.entry_no, e.printing_id, e.entry_flair_id FROM deck_entries e
                            JOIN decks d ON d.deck_id = e.deck_id WHERE d.profile_id = ? ORDER BY e.deck_id, e.revision, e.entry_no`, P)) {
    const k = `${text(r, 'deck_id')}\u0000${int(r, 'revision')}`;
    const list = entriesByVersion.get(k) ?? [];
    list.push({ entryNo: int(r, 'entry_no'), printingId: text(r, 'printing_id'), entryFlairId: textOrNull(r, 'entry_flair_id') });
    entriesByVersion.set(k, list);
  }
  const versionsByDeck = groupBy(
    rows(db, `SELECT v.* FROM deck_versions v JOIN decks d ON d.deck_id = v.deck_id WHERE d.profile_id = ? ORDER BY v.deck_id, v.revision`, P),
    'deck_id',
    (r) => ({
      revision: int(r, 'revision'), status: text(r, 'status') as 'DRAFT' | 'CONFIRMED', energyTypes: json(r, 'energy_types_json'),
      validation: json(r, 'validation_json'), createdAt: text(r, 'created_at'),
      entries: entriesByVersion.get(`${text(r, 'deck_id')}\u0000${int(r, 'revision')}`) ?? [],
    }),
  );
  const decks: PortableDeck[] = rows(db, 'SELECT * FROM decks WHERE profile_id = ? ORDER BY created_at, deck_id', P).map((r) => ({
    deckId: text(r, 'deck_id'), name: text(r, 'name'), headRevision: int(r, 'head_revision'), archived: flag(r, 'archived'),
    createdAt: text(r, 'created_at'), versions: versionsByDeck.get(text(r, 'deck_id')) ?? [],
  }));

  // ---- tentativas, eventos, checkpoints, referências e replays
  const attemptIds = `SELECT attempt_id FROM attempts WHERE profile_id = ?1`;
  const cardRefs = groupBy(rows(db, `SELECT attempt_id, printing_id FROM attempt_card_refs WHERE attempt_id IN (${attemptIds}) ORDER BY attempt_id, printing_id`, P),
    'attempt_id', (r) => text(r, 'printing_id'));
  const assetRefs = groupBy(rows(db, `SELECT attempt_id, asset_id FROM attempt_asset_refs WHERE attempt_id IN (${attemptIds}) ORDER BY attempt_id, asset_id`, P),
    'attempt_id', (r) => text(r, 'asset_id'));
  const events = groupBy(rows(db, 'SELECT * FROM battle_events WHERE profile_id = ? ORDER BY attempt_id, sequence_no', P), 'attempt_id', (r) => ({
    seq: int(r, 'sequence_no'), operationRevision: rev(text(r, 'operation_id')), stateVersion: int(r, 'state_version'),
    type: text(r, 'event_type'), event: json(r, 'event_json'),
  }));
  const checkpoints = groupBy(rows(db, `SELECT * FROM battle_checkpoints WHERE attempt_id IN (${attemptIds}) ORDER BY attempt_id, state_version`, P), 'attempt_id', (r) => ({
    stateVersion: int(r, 'state_version'), lastEventSequence: int(r, 'last_event_sequence'), snapshot: json(r, 'snapshot_json'),
    snapshotHash: text(r, 'snapshot_hash'), createdAt: text(r, 'created_at'),
  }));
  const attempts: PortableAttempt[] = rows(db, 'SELECT * FROM attempts WHERE profile_id = ? ORDER BY created_at, attempt_id', P).map((r) => {
    const attemptId = text(r, 'attempt_id');
    return {
      attemptId, mode: text(r, 'mode') as PortableAttempt['mode'], status: text(r, 'status') as PortableAttempt['status'],
      campaignId: textOrNull(r, 'campaign_id'), nodeId: textOrNull(r, 'node_id'), difficulty: textOrNull(r, 'difficulty') as PortableAttempt['difficulty'],
      deckId: textOrNull(r, 'deck_id'), deckRevision: intOrNull(r, 'deck_revision'), progressionEligible: flag(r, 'progression_eligible'),
      stateVersion: int(r, 'state_version'), rulesetId: text(r, 'ruleset_id'), engineVersion: text(r, 'engine_version'),
      contentFingerprint: text(r, 'content_fingerprint'), state: json(r, 'state_json'), rng: json(r, 'rng_json'),
      presentationSnapshot: json(r, 'presentation_snapshot_json'), result: jsonOrNull(r, 'result_json'),
      createdAt: text(r, 'created_at'), updatedAt: text(r, 'updated_at'),
      cardRefs: cardRefs.get(attemptId) ?? [], assetRefs: assetRefs.get(attemptId) ?? [],
      events: events.get(attemptId) ?? [], checkpoints: checkpoints.get(attemptId) ?? [],
    };
  });
  const replays = rows(db, `SELECT * FROM replays WHERE attempt_id IN (${attemptIds}) ORDER BY created_at, replay_id`, P).map((r) => ({
    replayId: text(r, 'replay_id'), attemptId: text(r, 'attempt_id'), metadata: json(r, 'metadata_json'), createdAt: text(r, 'created_at'),
  }));

  // ---- cosméticos, oficina, fichários e marcas
  const presetAssets = groupBy(rows(db, `SELECT r.preset_id || char(30) || r.revision AS k, r.asset_id FROM cosmetic_asset_refs r
                                         JOIN cosmetic_presets p ON p.preset_id = r.preset_id AND p.revision = r.revision
                                         WHERE p.profile_id = ? ORDER BY r.preset_id, r.revision, r.asset_id`, P), 'k', (r) => text(r, 'asset_id'));
  const cosmeticPresets = rows(db, 'SELECT * FROM cosmetic_presets WHERE profile_id = ? ORDER BY preset_id, revision', P).map((r) => ({
    presetId: text(r, 'preset_id'), revision: int(r, 'revision'), config: json(r, 'config_json'), createdAt: text(r, 'created_at'),
    assetIds: presetAssets.get(`${text(r, 'preset_id')}\u001e${int(r, 'revision')}`) ?? [],
  }));
  const draftAssets = groupBy(rows(db, 'SELECT editor_context_id, asset_id FROM appearance_draft_assets WHERE profile_id = ? ORDER BY editor_context_id, asset_id', P),
    'editor_context_id', (r) => text(r, 'asset_id'));
  const appearanceDrafts = rows(db, 'SELECT * FROM appearance_drafts WHERE profile_id = ? ORDER BY editor_context_id', P).map((r) => ({
    contextId: text(r, 'editor_context_id'), revision: int(r, 'revision'), draft: json(r, 'draft_json'), assetIds: draftAssets.get(text(r, 'editor_context_id')) ?? [],
  }));
  const slots = groupBy(rows(db, `SELECT s.* FROM binder_slots s JOIN binders b ON b.binder_id = s.binder_id WHERE b.profile_id = ? ORDER BY s.binder_id, s.page_no, s.slot_no`, P),
    'binder_id', (r) => ({ pageNo: int(r, 'page_no'), slotNo: int(r, 'slot_no'), printingId: text(r, 'printing_id') }));
  const binders = rows(db, 'SELECT * FROM binders WHERE profile_id = ? ORDER BY sort_order, binder_id', P).map((r) => ({
    binderId: text(r, 'binder_id'), name: text(r, 'name'), kind: text(r, 'kind') as 'BINDER' | 'SHOWCASE', layout: json(r, 'layout_json'),
    sortOrder: int(r, 'sort_order'), archived: flag(r, 'archived'), createdAt: text(r, 'created_at'), updatedAt: text(r, 'updated_at'),
    slots: slots.get(text(r, 'binder_id')) ?? [],
  }));
  const profileAppearance = row(db, 'SELECT preset_id, preset_revision FROM profile_appearance WHERE profile_id = ?', P);

  // ---- projetos do Estúdio (revisões retidas, refs de mídia e execuções de teste)
  const projectFilter = 'SELECT project_id FROM editor_projects WHERE profile_id = ?1';
  const revisionAssets = groupBy(rows(db, `SELECT project_id || char(30) || revision AS k, role, asset_id FROM editor_asset_refs
                                           WHERE project_id IN (${projectFilter}) ORDER BY project_id, revision, role, asset_id`, P),
  'k', (r) => ({ role: text(r, 'role'), assetId: text(r, 'asset_id') }));
  const revisionsByProject = groupBy(rows(db, `SELECT * FROM editor_revisions WHERE project_id IN (${projectFilter}) ORDER BY project_id, revision`, P), 'project_id', (r) => ({
    revision: int(r, 'revision'), kind: text(r, 'kind') as 'AUTO' | 'MANUAL' | 'PUBLISHED', draft: json(r, 'draft_json'),
    validationSummary: json(r, 'validation_summary_json'), createdAt: text(r, 'created_at'),
    assetRefs: revisionAssets.get(`${text(r, 'project_id')}\u001e${int(r, 'revision')}`) ?? [],
  }));
  const runsByProject = groupBy(rows(db, `SELECT * FROM card_test_runs WHERE project_id IN (${projectFilter}) ORDER BY project_id, created_at, run_id`, P), 'project_id', (r) => ({
    runId: text(r, 'run_id'), revision: int(r, 'revision'), runnerVersion: text(r, 'runner_version'), rulesHash: text(r, 'rules_hash'),
    scenario: json(r, 'scenario_json'), result: json(r, 'result_json'), outcome: text(r, 'outcome') as 'PASS' | 'FAIL' | 'ERROR', createdAt: text(r, 'created_at'),
  }));
  const projects: PortableProject[] = rows(db, 'SELECT * FROM editor_projects WHERE profile_id = ? ORDER BY created_at, project_id', P).map((r) => ({
    projectId: text(r, 'project_id'), title: text(r, 'title'), mode: text(r, 'mode') as PortableProject['mode'], status: text(r, 'status') as 'DRAFT' | 'ARCHIVED',
    headRevision: int(r, 'head_revision'), targetDefinitionId: textOrNull(r, 'target_definition_id'), sourceDefinitionId: textOrNull(r, 'source_definition_id'),
    sourceVersion: intOrNull(r, 'source_version'), createdAt: text(r, 'created_at'), updatedAt: text(r, 'updated_at'),
    revisions: revisionsByProject.get(text(r, 'project_id')) ?? [], testRuns: runsByProject.get(text(r, 'project_id')) ?? [],
  }));
  const ownProjects = new Set(projects.map((p) => p.projectId));

  const rowsV4: ProfileRowsV4 = {
    profile: {
      displayName: text(profile, 'display_name'), progressionMode: text(profile, 'progression_mode') as ProfileRowsV4['profile']['progressionMode'],
      revision: int(profile, 'revision'), rng: json(profile, 'economy_rng_json'), createdAt: text(profile, 'created_at'),
      updatedAt: text(profile, 'updated_at'), archived: flag(profile, 'archived'),
    },
    settings: rows(db, 'SELECT setting_key, value_json FROM settings WHERE profile_id = ? ORDER BY setting_key', P)
      .map((r) => ({ key: text(r, 'setting_key'), value: json(r, 'value_json') })),
    operations,
    wallets: rows(db, 'SELECT resource_id, balance FROM wallets WHERE profile_id = ? ORDER BY resource_id', P)
      .map((r) => ({ resourceId: text(r, 'resource_id'), balance: int(r, 'balance') })),
    walletEntries: rows(db, `SELECT w.* FROM wallet_entries w JOIN operations o ON o.operation_id = w.operation_id
                             WHERE w.profile_id = ? ORDER BY o.committed_revision, w.entry_no`, P).map((r) => ({
      operationRevision: rev(text(r, 'operation_id')), entryNo: int(r, 'entry_no'), resourceId: text(r, 'resource_id'),
      delta: int(r, 'delta'), balanceAfter: int(r, 'balance_after'),
    })),
    inventory: rows(db, 'SELECT printing_id, quantity FROM inventory WHERE profile_id = ? ORDER BY printing_id', P)
      .map((r) => ({ printingId: text(r, 'printing_id'), quantity: int(r, 'quantity') })),
    inventoryEntries: rows(db, `SELECT i.* FROM inventory_entries i JOIN operations o ON o.operation_id = i.operation_id
                                WHERE i.profile_id = ? ORDER BY o.committed_revision, i.entry_no`, P).map((r) => ({
      operationRevision: rev(text(r, 'operation_id')), entryNo: int(r, 'entry_no'), printingId: text(r, 'printing_id'),
      delta: int(r, 'delta'), quantityAfter: int(r, 'quantity_after'),
    })),
    rewardGrants: rows(db, 'SELECT * FROM reward_grants WHERE profile_id = ? ORDER BY granted_at, grant_key', P)
      .map((r) => ({ grantKey: text(r, 'grant_key'), operationRevision: rev(text(r, 'operation_id')), grantedAt: text(r, 'granted_at') })),
    pendingRewards: rows(db, 'SELECT * FROM pending_rewards WHERE profile_id = ? ORDER BY created_at, reward_id', P).map((r) => ({
      rewardId: text(r, 'reward_id'), grantKey: text(r, 'grant_key'), status: text(r, 'status') as 'PENDING' | 'CLAIMED',
      options: json(r, 'options_json'), choice: jsonOrNull(r, 'choice_json'), sourceOperationRevision: rev(text(r, 'source_operation_id')),
      sourceAttemptId: textOrNull(r, 'source_attempt_id'), operationRevision: revOrNull(textOrNull(r, 'operation_id')), createdAt: text(r, 'created_at'),
    })),
    entitlements: rows(db, 'SELECT * FROM cosmetic_entitlements WHERE profile_id = ? ORDER BY acquired_at, cosmetic_id', P).map((r) => ({
      cosmeticId: text(r, 'cosmetic_id'), origin: text(r, 'origin') as ProfileRowsV4['entitlements'][number]['origin'],
      operationRevision: rev(text(r, 'operation_id')), acquiredAt: text(r, 'acquired_at'),
    })),
    decks,
    deckAppearance: rows(db, 'SELECT * FROM deck_appearance WHERE profile_id = ? ORDER BY deck_id', P).map((r) => ({
      deckId: text(r, 'deck_id'), mode: text(r, 'mode') as 'INHERIT_PROFILE' | 'OVERRIDE', presetId: textOrNull(r, 'preset_id'), presetRevision: intOrNull(r, 'preset_revision'),
    })),
    profileAppearance: profileAppearance ? { presetId: text(profileAppearance, 'preset_id'), presetRevision: int(profileAppearance, 'preset_revision') } : null,
    campaignProgress: rows(db, 'SELECT * FROM campaign_progress WHERE profile_id = ? ORDER BY campaign_id, node_id', P).map((r) => ({
      campaignId: text(r, 'campaign_id'), nodeId: text(r, 'node_id'), campaignVersion: text(r, 'campaign_version'),
      status: text(r, 'status') as 'LOCKED' | 'AVAILABLE' | 'CLEARED', progress: json(r, 'progress_json'), updatedAt: text(r, 'updated_at'),
    })),
    attempts,
    replays,
    cosmeticPresets,
    appearanceDrafts,
    binders,
    collectionMarks: rows(db, 'SELECT * FROM collection_marks WHERE profile_id = ? ORDER BY mark_kind, subject_kind, subject_id', P).map((r) => ({
      markKind: text(r, 'mark_kind') as 'FAVORITE' | 'WISHLIST' | 'SEEN', subjectKind: text(r, 'subject_kind') as 'PRINTING' | 'DEFINITION',
      subjectId: text(r, 'subject_id'), createdAt: text(r, 'created_at'),
    })),
    projects,
  };

  const content = gatherReachableContent(db, profileId, rowsV4, ownProjects, rev);
  const packages = requiredPackages(db, content.basePrintingIds);
  return {
    profileId,
    userVersion: scalarInt(db, 'PRAGMA user_version') ?? 0,
    sqliteVersion: scalarText(db, 'SELECT sqlite_version()') ?? '',
    appVersion: (() => {
      const raw = scalarText(db, "SELECT value_json FROM app_meta WHERE key = 'appVersion'");
      const value = raw === undefined ? null : (JSON.parse(raw) as JsonValue);
      return typeof value === 'string' ? value : null;
    })(),
    rows: rowsV4,
    content: content.portable,
    packages,
    bundledAssetIds: content.bundledAssetIds,
  };
}

type Reachable = { readonly portable: PortableContent; readonly basePrintingIds: ReadonlySet<string>; readonly bundledAssetIds: readonly string[] };

/** Conteúdo alcançável (persistencia §24.1): impressões fora de pacotes, versões CUSTOM e suas dependências, BLOBs. */
function gatherReachableContent(
  db: DB, profileId: string, data: ProfileRowsV4, ownProjects: ReadonlySet<string>, rev: (operationId: string) => number,
): Reachable {
  const packaged = new Set(db.selectValues('SELECT DISTINCT printing_id FROM package_cards').map(String));
  const referenced = new Set<string>();
  data.inventory.forEach((i) => referenced.add(i.printingId));
  data.inventoryEntries.forEach((i) => referenced.add(i.printingId));
  data.decks.forEach((d) => d.versions.forEach((v) => v.entries.forEach((e) => referenced.add(e.printingId))));
  data.attempts.forEach((a) => a.cardRefs.forEach((p) => referenced.add(p)));
  data.binders.forEach((b) => b.slots.forEach((s) => referenced.add(s.printingId)));
  const known = (printingId: string): boolean => scalarInt(db, 'SELECT 1 FROM card_printings WHERE printing_id = ?', [printingId]) !== undefined;
  data.collectionMarks.filter((m) => m.subjectKind === 'PRINTING' && known(m.subjectId)).forEach((m) => referenced.add(m.subjectId));
  // Catálogo do próprio autor: todas as versões e impressões de definições CUSTOM que ele possui.
  for (const id of db.selectValues(`SELECT p.printing_id FROM card_printings p JOIN card_definitions d ON d.definition_id = p.definition_id
                                    WHERE d.owner_profile_id = ?`, [profileId])) referenced.add(String(id));

  const customPrintings = [...referenced].filter((id) => !packaged.has(id)).sort();
  const basePrintingIds = new Set([...referenced].filter((id) => packaged.has(id)));
  const printings = customPrintings.map((printingId) => {
    const r = row(db, 'SELECT * FROM card_printings WHERE printing_id = ?', [printingId]);
    if (!r) return fail('INTERNAL_INTEGRITY_ERROR', `impressão ${printingId} referenciada e inexistente`);
    return {
      printingId, definitionId: text(r, 'definition_id'), definitionVersion: int(r, 'definition_version'), appearance: json(r, 'appearance_json'),
      appearanceHash: text(r, 'appearance_hash'), createdAt: text(r, 'created_at'),
    };
  });

  // Versões: as das impressões incluídas, as do autor, as de origem de projetos e as dependências, só CUSTOM.
  const versionKeys = new Set<string>();
  const queue: [string, number][] = [];
  const addVersion = (definitionId: string, version: number): void => {
    const key = `${definitionId}\u0000${version}`;
    if (versionKeys.has(key)) return;
    if (scalarText(db, 'SELECT namespace FROM card_definitions WHERE definition_id = ?', [definitionId]) !== 'CUSTOM') return;
    versionKeys.add(key);
    queue.push([definitionId, version]);
  };
  printings.forEach((p) => addVersion(p.definitionId, p.definitionVersion));
  for (const r of rows(db, `SELECT v.definition_id, v.version FROM card_versions v JOIN card_definitions d ON d.definition_id = v.definition_id
                            WHERE d.owner_profile_id = ? ORDER BY v.definition_id, v.version`, [profileId])) addVersion(text(r, 'definition_id'), int(r, 'version'));
  data.projects.forEach((p) => { if (p.sourceDefinitionId !== null && p.sourceVersion !== null) addVersion(p.sourceDefinitionId, p.sourceVersion); });
  const versions: PortableCardVersion[] = [];
  while (queue.length > 0) {
    const [definitionId, version] = queue.shift()!;
    const v = row(db, 'SELECT * FROM card_versions WHERE definition_id = ? AND version = ?', [definitionId, version]);
    if (!v) continue;
    const dependencies = rows(db, 'SELECT dependency_id, dependency_version, dependency_kind FROM card_dependencies WHERE definition_id = ? AND version = ? ORDER BY dependency_id, dependency_version, dependency_kind',
      [definitionId, version]).map((d) => ({
      dependencyId: text(d, 'dependency_id'), dependencyVersion: int(d, 'dependency_version'),
      dependencyKind: text(d, 'dependency_kind') as PortableCardVersion['dependencies'][number]['dependencyKind'],
    }));
    dependencies.forEach((d) => addVersion(d.dependencyId, d.dependencyVersion));
    const pub = row(db, 'SELECT * FROM card_publications WHERE definition_id = ? AND version = ?', [definitionId, version]);
    const pubProject = pub ? textOrNull(pub, 'project_id') : null;
    const own = pub !== undefined && pubProject !== null && ownProjects.has(pubProject) && textOrNull(pub, 'profile_id') === profileId;
    versions.push({
      definitionId, version, rules: json(v, 'rules_json'), rulesHash: text(v, 'rules_hash'), rulesetId: text(v, 'ruleset_id'),
      searchKey: text(v, 'search_key'), createdAt: text(v, 'created_at'),
      publication: pub ? {
        validatorVersion: text(pub, 'validator_version'), report: json(pub, 'validation_report_json'),
        projectId: own ? pubProject : null, projectRevision: own ? intOrNull(pub, 'project_revision') : null,
        operationRevision: own ? rev(text(pub, 'operation_id')) : null, publishedAt: text(pub, 'published_at'),
      } : null,
      dependencies,
    });
  }
  versions.sort((a, b) => (a.definitionId < b.definitionId ? -1 : a.definitionId > b.definitionId ? 1 : a.version - b.version));
  const definitionIds = [...new Set(versions.map((v) => v.definitionId))].sort();
  const definitions = definitionIds.map((definitionId) => {
    const d = row(db, 'SELECT created_at, archived FROM card_definitions WHERE definition_id = ?', [definitionId])!;
    return { definitionId, createdAt: text(d, 'created_at'), archived: flag(d, 'archived') };
  });
  const included = new Set(versions.map((v) => `${v.definitionId}\u0000${v.version}`));
  const catalogHeads = definitionIds.flatMap((definitionId) => {
    const head = scalarInt(db, 'SELECT version FROM card_catalog_heads WHERE definition_id = ?', [definitionId]);
    return head !== undefined && included.has(`${definitionId}\u0000${head}`) ? [{ definitionId, version: head }] : [];
  });

  // Assets: bindings das impressões incluídas, mídia do Estúdio, presets, oficina e tentativas.
  const assetIds = new Set<string>();
  for (const p of printings) {
    for (const id of db.selectValues('SELECT asset_id FROM printing_assets WHERE printing_id = ?', [p.printingId])) assetIds.add(String(id));
  }
  data.projects.forEach((p) => p.revisions.forEach((r) => r.assetRefs.forEach((a) => assetIds.add(a.assetId))));
  data.cosmeticPresets.forEach((p) => p.assetIds.forEach((a) => assetIds.add(a)));
  data.appearanceDrafts.forEach((d) => d.assetIds.forEach((a) => assetIds.add(a)));
  data.attempts.forEach((a) => a.assetRefs.forEach((id) => assetIds.add(id)));
  const assets: PortableAsset[] = [];
  const bundledAssetIds: string[] = [];
  for (const assetId of [...assetIds].sort()) {
    const r = row(db, 'SELECT * FROM assets WHERE asset_id = ?', [assetId]);
    if (!r) fail('INTERNAL_INTEGRITY_ERROR', `asset ${assetId} referenciado e inexistente`);
    const bytes = blob(r, 'bytes');
    if (text(r, 'storage_kind') !== 'BLOB' || bytes === null) { bundledAssetIds.push(assetId); continue; }
    assets.push({
      assetId, mediaType: text(r, 'media_type'), bytes, width: intOrNull(r, 'width'), height: intOrNull(r, 'height'),
      metadata: json(r, 'metadata_json'), createdAt: text(r, 'created_at'),
    });
  }
  return { portable: { definitions, versions, catalogHeads, printings, assets }, basePrintingIds, bundledAssetIds };
}

/** Pacotes ativos + um pacote por impressão BASE referenciada que nenhum pacote ativo cubra. */
function requiredPackages(db: DB, basePrintingIds: ReadonlySet<string>): ContentPackageRef[] {
  const active = parsePackages(scalarText(db, "SELECT value_json FROM app_meta WHERE key = 'contentPackages'"));
  const out = new Map(active.map((p) => [`${p.packageId}@${p.version}`, p]));
  const covered = new Set<string>();
  const byPrinting = new Map<string, { packageId: string; version: string; contentHash: string; installedAt: string }[]>();
  for (const r of rows(db, `SELECT pc.printing_id, cp.package_id, cp.version, cp.content_hash, cp.installed_at FROM package_cards pc
                            JOIN content_packages cp ON cp.package_id = pc.package_id AND cp.version = pc.package_version`)) {
    const printingId = text(r, 'printing_id');
    if (!basePrintingIds.has(printingId)) continue;
    const pkg = { packageId: text(r, 'package_id'), version: text(r, 'version'), contentHash: text(r, 'content_hash'), installedAt: text(r, 'installed_at') };
    if (out.has(`${pkg.packageId}@${pkg.version}`)) covered.add(printingId);
    byPrinting.set(printingId, [...(byPrinting.get(printingId) ?? []), pkg]);
  }
  for (const [printingId, packages] of byPrinting) {
    if (covered.has(printingId)) continue;
    const latest = [...packages].sort((a, b) => (a.installedAt < b.installedAt ? 1 : -1))[0];
    if (!latest) continue;
    out.set(`${latest.packageId}@${latest.version}`, { packageId: latest.packageId, version: latest.version, contentHash: latest.contentHash });
    packages.forEach((p) => { if (p.packageId === latest.packageId && p.version === latest.version) covered.add(printingId); });
  }
  return [...out.values()].sort((a, b) => (a.packageId < b.packageId ? -1 : a.packageId > b.packageId ? 1 : a.version < b.version ? -1 : 1));
}
