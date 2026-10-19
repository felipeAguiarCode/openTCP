// GERADO a partir de .specs/database/schema-v1.sql (migração 0001, persistencia-sqlite.md §21). Não editar à mão:
// migrations.test.ts confere que o texto é idêntico, byte a byte, ao arquivo das specs e que o SHA-256 confere.

export const MIGRATION_0001_VERSION = 1;
export const MIGRATION_0001_NAME = '0001-schema-v1';
export const MIGRATION_0001_SHA256 = '9941bbccba8e360b5b1e08ac197af037629f4261ebc67dc8924d1f5b19f90d13';

export const MIGRATION_0001_SQL = `-- Card Campaign: SQLite schema 1 (migration 0001) / documentation 3.2.0.
-- Pure DDL. The migration runner (persistencia-sqlite.md §21) applies connection
-- PRAGMAs (foreign_keys, journal_mode, synchronous, busy_timeout) BEFORE the
-- transaction, then in ONE transaction: BEGIN IMMEDIATE -> this file ->
-- INSERT INTO schema_migrations -> PRAGMA application_id = 1128354372 ->
-- PRAGMA user_version = 1 -> COMMIT. Never execute this file on an existing DB.
-- JSON schemas, the effects DSL and gameplay validation remain mandatory in the application.

CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY CHECK (version > 0),
  migration_name TEXT NOT NULL UNIQUE,
  checksum_sha256 TEXT NOT NULL CHECK (length(checksum_sha256) = 64),
  applied_at TEXT NOT NULL
) STRICT;

CREATE TABLE app_meta (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL CHECK (json_valid(value_json))
) STRICT;

CREATE TABLE profiles (
  profile_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 40),
  progression_mode TEXT NOT NULL CHECK (progression_mode IN ('STANDARD','CUSTOM','LAB')),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  writer_epoch INTEGER NOT NULL DEFAULT 0 CHECK (writer_epoch >= 0),
  economy_rng_json TEXT NOT NULL CHECK (json_valid(economy_rng_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1))
) STRICT;

CREATE TABLE content_packages (
  package_id TEXT NOT NULL,
  version TEXT NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN ('BASE','CUSTOM')),
  manifest_json TEXT NOT NULL CHECK (json_valid(manifest_json)),
  content_hash TEXT NOT NULL CHECK (length(content_hash) = 64),
  installed_at TEXT NOT NULL,
  PRIMARY KEY (package_id, version)
) STRICT;

-- Content-addressed bytes. asset_id = SHA-256 of the exact bytes (lowercase hex).
-- BUNDLED rows are optional integrity records of packaged files; bundled content is
-- referenced by logical assetKey through dist/manifest.json, never by this table alone.
CREATE TABLE assets (
  asset_id TEXT PRIMARY KEY CHECK (length(asset_id) = 64),
  storage_kind TEXT NOT NULL CHECK (storage_kind IN ('BUNDLED','BLOB')),
  media_type TEXT NOT NULL,
  logical_path TEXT,
  bytes BLOB,
  byte_length INTEGER NOT NULL CHECK (byte_length >= 0),
  width INTEGER CHECK (width > 0),
  height INTEGER CHECK (height > 0),
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
  created_at TEXT NOT NULL,
  CHECK (
    (storage_kind = 'BLOB' AND bytes IS NOT NULL AND logical_path IS NULL
      AND length(bytes) = byte_length)
    OR
    (storage_kind = 'BUNDLED' AND bytes IS NULL AND logical_path IS NOT NULL)
  )
) STRICT;

CREATE TABLE card_definitions (
  definition_id TEXT PRIMARY KEY,
  namespace TEXT NOT NULL CHECK (namespace IN ('BASE','CUSTOM')),
  owner_profile_id TEXT REFERENCES profiles(profile_id),
  created_at TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
  CHECK ((namespace = 'BASE') = (owner_profile_id IS NULL))
) STRICT;

CREATE TABLE card_versions (
  definition_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  rules_json TEXT NOT NULL CHECK (json_valid(rules_json)),
  rules_hash TEXT NOT NULL CHECK (length(rules_hash) = 64),
  ruleset_id TEXT NOT NULL,
  search_key TEXT NOT NULL CHECK (length(search_key) BETWEEN 1 AND 120),
  display_name TEXT GENERATED ALWAYS AS (json_extract(rules_json,'$.name')) STORED NOT NULL,
  base_name TEXT GENERATED ALWAYS AS (json_extract(rules_json,'$.baseName')) STORED NOT NULL,
  deck_limit_key TEXT GENERATED ALWAYS AS (json_extract(rules_json,'$.deckLimitKey')) STORED NOT NULL,
  category TEXT GENERATED ALWAYS AS (json_extract(rules_json,'$.category')) STORED NOT NULL,
  rule_box TEXT GENERATED ALWAYS AS (json_extract(rules_json,'$.ruleBox')) STORED NOT NULL,
  knockout_points INTEGER GENERATED ALWAYS AS (json_extract(rules_json,'$.knockoutPoints')) STORED,
  hp INTEGER GENERATED ALWAYS AS (json_extract(rules_json,'$.baseHp')) STORED,
  created_at TEXT NOT NULL,
  PRIMARY KEY (definition_id, version),
  FOREIGN KEY (definition_id) REFERENCES card_definitions(definition_id),
  CHECK (json_extract(rules_json,'$.id') IS definition_id),
  CHECK (json_extract(rules_json,'$.version') IS version),
  CHECK (json_extract(rules_json,'$.dataVersion') IS 2),
  CHECK (length(display_name) BETWEEN 1 AND 60),
  CHECK (length(base_name) BETWEEN 1 AND 50),
  CHECK (length(deck_limit_key) BETWEEN 1 AND 100),
  CHECK (category IN ('POKEMON','TRAINER')),
  CHECK (rule_box IN ('NONE','EX','MEGA_EX')),
  CHECK (
    (category = 'POKEMON' AND hp IS NOT NULL AND hp BETWEEN 10 AND 9990
      AND hp % 10 = 0
      AND knockout_points IS CASE rule_box WHEN 'NONE' THEN 1 WHEN 'EX' THEN 2 ELSE 3 END)
    OR
    (category = 'TRAINER' AND hp IS NULL AND rule_box = 'NONE' AND knockout_points IS NULL)
  )
) STRICT;
CREATE INDEX idx_card_versions_search ON card_versions(category, search_key, definition_id, version);
CREATE INDEX idx_card_versions_limit ON card_versions(deck_limit_key);

CREATE TABLE operations (
  operation_id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(profile_id),
  command_id TEXT NOT NULL,
  command_type TEXT NOT NULL,
  payload_hash TEXT NOT NULL CHECK (length(payload_hash) = 64),
  committed_revision INTEGER NOT NULL CHECK (committed_revision > 0),
  receipt_json TEXT NOT NULL CHECK (json_valid(receipt_json)),
  committed_at TEXT NOT NULL,
  UNIQUE (profile_id, command_id),
  UNIQUE (operation_id, profile_id),
  UNIQUE (profile_id, committed_revision)
) STRICT;

CREATE TABLE editor_projects (
  project_id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(profile_id),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 60),
  mode TEXT NOT NULL CHECK (mode IN ('NEW_DEFINITION','NEW_VERSION','VARIANT','FORK')),
  status TEXT NOT NULL CHECK (status IN ('DRAFT','ARCHIVED')),
  head_revision INTEGER NOT NULL DEFAULT 0 CHECK (head_revision >= 0),
  target_definition_id TEXT,
  source_definition_id TEXT,
  source_version INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (source_definition_id, source_version) REFERENCES card_versions(definition_id, version),
  CHECK ((source_definition_id IS NULL) = (source_version IS NULL)),
  CHECK (mode = 'NEW_DEFINITION' OR source_definition_id IS NOT NULL),
  CHECK (mode IN ('NEW_DEFINITION','FORK') OR target_definition_id = source_definition_id)
) STRICT;
CREATE INDEX idx_editor_projects_profile ON editor_projects(profile_id, updated_at);

CREATE TABLE editor_revisions (
  project_id TEXT NOT NULL REFERENCES editor_projects(project_id),
  revision INTEGER NOT NULL CHECK (revision > 0),
  kind TEXT NOT NULL CHECK (kind IN ('AUTO','MANUAL','PUBLISHED')),
  draft_json TEXT NOT NULL CHECK (json_valid(draft_json)),
  validation_summary_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(validation_summary_json)),
  created_at TEXT NOT NULL,
  PRIMARY KEY (project_id, revision)
) STRICT;

CREATE TABLE editor_asset_refs (
  project_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  role TEXT NOT NULL,
  asset_id TEXT NOT NULL REFERENCES assets(asset_id),
  PRIMARY KEY (project_id, revision, role, asset_id),
  FOREIGN KEY (project_id, revision) REFERENCES editor_revisions(project_id, revision) ON DELETE CASCADE
) STRICT;
CREATE INDEX idx_editor_asset_refs_asset ON editor_asset_refs(asset_id);

CREATE TABLE card_publications (
  definition_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  validator_version TEXT NOT NULL,
  validation_report_json TEXT NOT NULL CHECK (json_valid(validation_report_json)),
  profile_id TEXT REFERENCES profiles(profile_id),
  project_id TEXT REFERENCES editor_projects(project_id),
  project_revision INTEGER,
  operation_id TEXT,
  published_at TEXT NOT NULL,
  PRIMARY KEY (definition_id, version),
  FOREIGN KEY (definition_id, version) REFERENCES card_versions(definition_id, version),
  FOREIGN KEY (project_id, project_revision) REFERENCES editor_revisions(project_id, revision),
  FOREIGN KEY (operation_id, profile_id) REFERENCES operations(operation_id, profile_id),
  CHECK ((project_id IS NULL) = (project_revision IS NULL)),
  CHECK (project_id IS NULL OR (profile_id IS NOT NULL AND operation_id IS NOT NULL))
) STRICT;

CREATE TABLE card_catalog_heads (
  definition_id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  FOREIGN KEY (definition_id, version) REFERENCES card_publications(definition_id, version)
) STRICT;

CREATE TABLE card_dependencies (
  definition_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  dependency_id TEXT NOT NULL,
  dependency_version INTEGER NOT NULL,
  dependency_kind TEXT NOT NULL CHECK (dependency_kind IN ('COPY_ATTACK','REFERENCE','TEST_FIXTURE')),
  PRIMARY KEY (definition_id, version, dependency_id, dependency_version, dependency_kind),
  FOREIGN KEY (definition_id, version) REFERENCES card_versions(definition_id, version),
  FOREIGN KEY (dependency_id, dependency_version) REFERENCES card_versions(definition_id, version),
  CHECK (definition_id <> dependency_id OR version <> dependency_version)
) STRICT;
CREATE INDEX idx_card_dependencies_reverse ON card_dependencies(dependency_id, dependency_version);

CREATE TABLE card_printings (
  printing_id TEXT PRIMARY KEY,
  definition_id TEXT NOT NULL,
  definition_version INTEGER NOT NULL,
  appearance_json TEXT NOT NULL CHECK (json_valid(appearance_json)),
  appearance_hash TEXT NOT NULL CHECK (length(appearance_hash) = 64),
  finish TEXT GENERATED ALWAYS AS (json_extract(appearance_json,'$.finish')) STORED NOT NULL,
  rarity TEXT GENERATED ALWAYS AS (json_extract(appearance_json,'$.rarity')) STORED NOT NULL,
  set_id TEXT GENERATED ALWAYS AS (json_extract(appearance_json,'$.setId')) STORED NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (definition_id, definition_version) REFERENCES card_publications(definition_id, version),
  CHECK (json_extract(appearance_json,'$.printingId') IS printing_id),
  CHECK (json_extract(appearance_json,'$.cardDefinitionId') IS definition_id),
  CHECK (json_extract(appearance_json,'$.cardDefinitionVersion') IS definition_version),
  CHECK (finish IN ('NORMAL','HOLOGRAPHIC','FOIL','CHROME')),
  CHECK (rarity IN ('COMMON','UNCOMMON','RARE','ULTRA','PROMO'))
) STRICT;
CREATE INDEX idx_printings_definition ON card_printings(definition_id, definition_version);
CREATE INDEX idx_printings_finish ON card_printings(finish, rarity);
CREATE INDEX idx_printings_set ON card_printings(set_id);

-- Projection of appearance_json.assetBindings. Thumbnails are regenerable cache and live outside.
CREATE TABLE printing_assets (
  printing_id TEXT NOT NULL REFERENCES card_printings(printing_id),
  role TEXT NOT NULL CHECK (role IN ('ART_MASTER','FRONT_COMPOSITE','FOIL_MASK','NORMAL_MAP',
      'ROUGHNESS_MAP','BACK_DEFAULT','IMMERSIVE_SCENE')),
  asset_id TEXT NOT NULL REFERENCES assets(asset_id),
  PRIMARY KEY (printing_id, role)
) STRICT;
CREATE INDEX idx_printing_assets_asset ON printing_assets(asset_id);

CREATE TABLE package_cards (
  package_id TEXT NOT NULL,
  package_version TEXT NOT NULL,
  printing_id TEXT NOT NULL REFERENCES card_printings(printing_id),
  PRIMARY KEY (package_id, package_version, printing_id),
  FOREIGN KEY (package_id, package_version) REFERENCES content_packages(package_id, version)
) STRICT;
CREATE INDEX idx_package_cards_printing ON package_cards(printing_id);

-- Archive marks remove versions/printings from new selections without touching immutable rows.
CREATE TABLE catalog_archive_marks (
  entity_kind TEXT NOT NULL CHECK (entity_kind IN ('VERSION','PRINTING')),
  entity_id TEXT NOT NULL,
  entity_version INTEGER NOT NULL DEFAULT 0 CHECK (entity_version >= 0),
  profile_id TEXT REFERENCES profiles(profile_id),
  archived_at TEXT NOT NULL,
  PRIMARY KEY (entity_kind, entity_id, entity_version)
) STRICT;

CREATE TABLE card_test_runs (
  run_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES editor_projects(project_id),
  revision INTEGER NOT NULL,
  runner_version TEXT NOT NULL,
  rules_hash TEXT NOT NULL CHECK (length(rules_hash) = 64),
  scenario_json TEXT NOT NULL CHECK (json_valid(scenario_json)),
  result_json TEXT NOT NULL CHECK (json_valid(result_json)),
  outcome TEXT NOT NULL CHECK (outcome IN ('PASS','FAIL','ERROR')),
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id, revision) REFERENCES editor_revisions(project_id, revision)
) STRICT;
CREATE INDEX idx_card_test_runs_project ON card_test_runs(project_id, revision);

CREATE TABLE inventory (
  profile_id TEXT NOT NULL REFERENCES profiles(profile_id),
  printing_id TEXT NOT NULL REFERENCES card_printings(printing_id),
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 0 AND 1000000),
  PRIMARY KEY (profile_id, printing_id)
) STRICT;

CREATE TABLE wallets (
  profile_id TEXT NOT NULL REFERENCES profiles(profile_id),
  resource_id TEXT NOT NULL CHECK (resource_id = 'CREDITS' OR resource_id LIKE 'PACK:%'),
  balance INTEGER NOT NULL CHECK (balance BETWEEN 0 AND 1000000000),
  PRIMARY KEY (profile_id, resource_id)
) STRICT;

CREATE TABLE wallet_entries (
  operation_id TEXT NOT NULL,
  entry_no INTEGER NOT NULL CHECK (entry_no >= 0),
  profile_id TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  delta INTEGER NOT NULL CHECK (delta <> 0),
  balance_after INTEGER NOT NULL CHECK (balance_after BETWEEN 0 AND 1000000000),
  PRIMARY KEY (operation_id, entry_no),
  FOREIGN KEY (operation_id, profile_id) REFERENCES operations(operation_id, profile_id),
  FOREIGN KEY (profile_id, resource_id) REFERENCES wallets(profile_id, resource_id)
) STRICT;

CREATE TABLE inventory_entries (
  operation_id TEXT NOT NULL,
  entry_no INTEGER NOT NULL CHECK (entry_no >= 0),
  profile_id TEXT NOT NULL,
  printing_id TEXT NOT NULL,
  delta INTEGER NOT NULL CHECK (delta <> 0),
  quantity_after INTEGER NOT NULL CHECK (quantity_after BETWEEN 0 AND 1000000),
  PRIMARY KEY (operation_id, entry_no),
  FOREIGN KEY (operation_id, profile_id) REFERENCES operations(operation_id, profile_id),
  FOREIGN KEY (profile_id, printing_id) REFERENCES inventory(profile_id, printing_id)
) STRICT;

-- grant_key formats are normative in persistencia-sqlite.md §13 (no profileId, no content version).
CREATE TABLE reward_grants (
  profile_id TEXT NOT NULL REFERENCES profiles(profile_id),
  grant_key TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  granted_at TEXT NOT NULL,
  PRIMARY KEY (profile_id, grant_key),
  FOREIGN KEY (operation_id, profile_id) REFERENCES operations(operation_id, profile_id)
) STRICT;

CREATE TABLE decks (
  deck_id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(profile_id),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  head_revision INTEGER NOT NULL DEFAULT 0 CHECK (head_revision >= 0),
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
  created_at TEXT NOT NULL,
  UNIQUE (deck_id, profile_id)
) STRICT;
CREATE INDEX idx_decks_profile ON decks(profile_id);

CREATE TABLE deck_versions (
  deck_id TEXT NOT NULL REFERENCES decks(deck_id),
  revision INTEGER NOT NULL CHECK (revision > 0),
  status TEXT NOT NULL CHECK (status IN ('DRAFT','CONFIRMED')),
  energy_types_json TEXT NOT NULL CHECK (json_valid(energy_types_json)),
  validation_json TEXT NOT NULL CHECK (json_valid(validation_json)),
  created_at TEXT NOT NULL,
  PRIMARY KEY (deck_id, revision),
  CHECK (json_type(energy_types_json) = 'array')
) STRICT;

-- One row per selected copy. Entry flair lives only here (not in cosmetic presets).
CREATE TABLE deck_entries (
  deck_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  entry_no INTEGER NOT NULL CHECK (entry_no BETWEEN 1 AND 20),
  printing_id TEXT NOT NULL REFERENCES card_printings(printing_id),
  entry_flair_id TEXT,
  PRIMARY KEY (deck_id, revision, entry_no),
  FOREIGN KEY (deck_id, revision) REFERENCES deck_versions(deck_id, revision)
) STRICT;
CREATE INDEX idx_deck_entries_printing ON deck_entries(printing_id);

-- One row per profile/campaign/node. campaign_version records the content version of the
-- last update; history is never fragmented by content updates. MASTERED is derived.
CREATE TABLE campaign_progress (
  profile_id TEXT NOT NULL REFERENCES profiles(profile_id),
  campaign_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  campaign_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('LOCKED','AVAILABLE','CLEARED')),
  progress_json TEXT NOT NULL CHECK (json_valid(progress_json)),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (profile_id, campaign_id, node_id)
) STRICT;

CREATE TABLE attempts (
  attempt_id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(profile_id),
  mode TEXT NOT NULL CHECK (mode IN ('CAMPAIGN','ARENA','TRAINING','CUSTOM','LAB')),
  status TEXT NOT NULL CHECK (status IN ('RUNNING','SUSPENDED','FINISHED','ABANDONED')),
  campaign_id TEXT,
  node_id TEXT,
  difficulty TEXT CHECK (difficulty IS NULL OR difficulty IN ('STORY','STANDARD','EXPERT')),
  deck_id TEXT,
  deck_revision INTEGER,
  progression_eligible INTEGER NOT NULL CHECK (progression_eligible IN (0,1)),
  state_version INTEGER NOT NULL CHECK (state_version >= 0),
  ruleset_id TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  content_fingerprint TEXT NOT NULL,
  state_json TEXT NOT NULL CHECK (json_valid(state_json)),
  rng_json TEXT NOT NULL CHECK (json_valid(rng_json)),
  presentation_snapshot_json TEXT NOT NULL CHECK (json_valid(presentation_snapshot_json)),
  result_json TEXT CHECK (result_json IS NULL OR json_valid(result_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (attempt_id, profile_id),
  FOREIGN KEY (deck_id, deck_revision) REFERENCES deck_versions(deck_id, revision),
  CHECK ((status IN ('FINISHED','ABANDONED')) = (result_json IS NOT NULL)),
  CHECK ((campaign_id IS NULL) = (node_id IS NULL)),
  CHECK (mode <> 'CAMPAIGN' OR (node_id IS NOT NULL AND difficulty IS NOT NULL)),
  CHECK (mode NOT IN ('TRAINING','LAB') OR progression_eligible = 0)
) STRICT;
CREATE UNIQUE INDEX idx_one_active_attempt ON attempts(profile_id)
  WHERE status IN ('RUNNING','SUSPENDED');
CREATE INDEX idx_attempts_history ON attempts(profile_id, created_at);
CREATE INDEX idx_attempts_node ON attempts(profile_id, campaign_id, node_id);

CREATE TABLE battle_events (
  attempt_id TEXT NOT NULL,
  sequence_no INTEGER NOT NULL CHECK (sequence_no > 0),
  profile_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  state_version INTEGER NOT NULL CHECK (state_version >= 0),
  event_type TEXT NOT NULL,
  event_json TEXT NOT NULL CHECK (json_valid(event_json)),
  PRIMARY KEY (attempt_id, sequence_no),
  FOREIGN KEY (attempt_id, profile_id) REFERENCES attempts(attempt_id, profile_id),
  FOREIGN KEY (operation_id, profile_id) REFERENCES operations(operation_id, profile_id)
) STRICT;
CREATE INDEX idx_battle_events_operation ON battle_events(operation_id);

CREATE TABLE battle_checkpoints (
  attempt_id TEXT NOT NULL REFERENCES attempts(attempt_id),
  state_version INTEGER NOT NULL CHECK (state_version >= 0),
  last_event_sequence INTEGER NOT NULL CHECK (last_event_sequence >= 0),
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  snapshot_hash TEXT NOT NULL CHECK (length(snapshot_hash) = 64),
  created_at TEXT NOT NULL,
  PRIMARY KEY (attempt_id, state_version)
) STRICT;

CREATE TABLE attempt_card_refs (
  attempt_id TEXT NOT NULL REFERENCES attempts(attempt_id),
  printing_id TEXT NOT NULL REFERENCES card_printings(printing_id),
  PRIMARY KEY (attempt_id, printing_id)
) STRICT;
CREATE INDEX idx_attempt_card_refs_printing ON attempt_card_refs(printing_id);

CREATE TABLE attempt_asset_refs (
  attempt_id TEXT NOT NULL REFERENCES attempts(attempt_id),
  asset_id TEXT NOT NULL REFERENCES assets(asset_id),
  PRIMARY KEY (attempt_id, asset_id)
) STRICT;
CREATE INDEX idx_attempt_asset_refs_asset ON attempt_asset_refs(asset_id);

CREATE TABLE replays (
  replay_id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL UNIQUE REFERENCES attempts(attempt_id),
  metadata_json TEXT NOT NULL CHECK (json_valid(metadata_json)),
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE pending_rewards (
  reward_id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(profile_id),
  grant_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING','CLAIMED')),
  options_json TEXT NOT NULL CHECK (json_valid(options_json)),
  choice_json TEXT CHECK (choice_json IS NULL OR json_valid(choice_json)),
  source_operation_id TEXT NOT NULL,
  source_attempt_id TEXT REFERENCES attempts(attempt_id),
  operation_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (profile_id, grant_key),
  FOREIGN KEY (source_operation_id, profile_id) REFERENCES operations(operation_id, profile_id),
  FOREIGN KEY (operation_id, profile_id) REFERENCES operations(operation_id, profile_id),
  CHECK (
    (status = 'PENDING' AND choice_json IS NULL AND operation_id IS NULL)
    OR
    (status = 'CLAIMED' AND choice_json IS NOT NULL AND operation_id IS NOT NULL)
  )
) STRICT;

CREATE TABLE cosmetic_entitlements (
  profile_id TEXT NOT NULL REFERENCES profiles(profile_id),
  cosmetic_id TEXT NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN ('ONBOARDING','PURCHASE','MILESTONE','CUSTOM_GRANT')),
  operation_id TEXT NOT NULL,
  acquired_at TEXT NOT NULL,
  PRIMARY KEY (profile_id, cosmetic_id),
  FOREIGN KEY (operation_id, profile_id) REFERENCES operations(operation_id, profile_id)
) STRICT;

-- Presets are immutable per revision. Entry flair per copy lives in deck_entries.
CREATE TABLE cosmetic_presets (
  preset_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  profile_id TEXT NOT NULL REFERENCES profiles(profile_id),
  config_json TEXT NOT NULL CHECK (json_valid(config_json)),
  created_at TEXT NOT NULL,
  PRIMARY KEY (preset_id, revision),
  UNIQUE (preset_id, revision, profile_id)
) STRICT;
CREATE INDEX idx_cosmetic_presets_profile ON cosmetic_presets(profile_id);

CREATE TABLE cosmetic_asset_refs (
  preset_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  asset_id TEXT NOT NULL REFERENCES assets(asset_id),
  PRIMARY KEY (preset_id, revision, asset_id),
  FOREIGN KEY (preset_id, revision) REFERENCES cosmetic_presets(preset_id, revision)
) STRICT;
CREATE INDEX idx_cosmetic_asset_refs_asset ON cosmetic_asset_refs(asset_id);

CREATE TABLE appearance_drafts (
  profile_id TEXT NOT NULL REFERENCES profiles(profile_id),
  editor_context_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  draft_json TEXT NOT NULL CHECK (json_valid(draft_json)),
  PRIMARY KEY (profile_id, editor_context_id)
) STRICT;

CREATE TABLE appearance_draft_assets (
  profile_id TEXT NOT NULL,
  editor_context_id TEXT NOT NULL,
  asset_id TEXT NOT NULL REFERENCES assets(asset_id),
  PRIMARY KEY (profile_id, editor_context_id, asset_id),
  FOREIGN KEY (profile_id, editor_context_id)
    REFERENCES appearance_drafts(profile_id, editor_context_id) ON DELETE CASCADE
) STRICT;
CREATE INDEX idx_appearance_draft_assets_asset ON appearance_draft_assets(asset_id);

CREATE TABLE profile_appearance (
  profile_id TEXT PRIMARY KEY REFERENCES profiles(profile_id),
  preset_id TEXT NOT NULL,
  preset_revision INTEGER NOT NULL,
  FOREIGN KEY (preset_id, preset_revision, profile_id)
    REFERENCES cosmetic_presets(preset_id, revision, profile_id)
) STRICT;

CREATE TABLE deck_appearance (
  deck_id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('INHERIT_PROFILE','OVERRIDE')),
  preset_id TEXT,
  preset_revision INTEGER,
  FOREIGN KEY (deck_id, profile_id) REFERENCES decks(deck_id, profile_id),
  FOREIGN KEY (preset_id, preset_revision, profile_id)
    REFERENCES cosmetic_presets(preset_id, revision, profile_id),
  CHECK (
    (mode = 'INHERIT_PROFILE' AND preset_id IS NULL AND preset_revision IS NULL)
    OR
    (mode = 'OVERRIDE' AND preset_id IS NOT NULL AND preset_revision IS NOT NULL)
  )
) STRICT;

-- Documented keys in persistencia-sqlite.md §7.1 (e.g. favoriteDeckId, receipts.lastSeenRevision).
CREATE TABLE settings (
  profile_id TEXT NOT NULL REFERENCES profiles(profile_id),
  setting_key TEXT NOT NULL,
  value_json TEXT NOT NULL CHECK (json_valid(value_json)),
  PRIMARY KEY (profile_id, setting_key)
) STRICT;

-- Binders and gallery are local compositions referencing printings; they never create copies.
CREATE TABLE binders (
  binder_id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(profile_id),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  kind TEXT NOT NULL CHECK (kind IN ('BINDER','SHOWCASE')),
  layout_json TEXT NOT NULL CHECK (json_valid(layout_json)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX idx_binders_profile ON binders(profile_id, sort_order);

CREATE TABLE binder_slots (
  binder_id TEXT NOT NULL REFERENCES binders(binder_id) ON DELETE CASCADE,
  page_no INTEGER NOT NULL CHECK (page_no BETWEEN 1 AND 200),
  slot_no INTEGER NOT NULL CHECK (slot_no BETWEEN 1 AND 12),
  printing_id TEXT NOT NULL REFERENCES card_printings(printing_id),
  PRIMARY KEY (binder_id, page_no, slot_no)
) STRICT;
CREATE INDEX idx_binder_slots_printing ON binder_slots(printing_id);

CREATE TABLE collection_marks (
  profile_id TEXT NOT NULL REFERENCES profiles(profile_id),
  mark_kind TEXT NOT NULL CHECK (mark_kind IN ('FAVORITE','WISHLIST','SEEN')),
  subject_kind TEXT NOT NULL CHECK (subject_kind IN ('PRINTING','DEFINITION')),
  subject_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (profile_id, mark_kind, subject_kind, subject_id)
) STRICT;

-- Imports of portable profiles (format 4) and database backups. The same file may be imported
-- more than once as a NEW profile, so the fingerprint is not unique.
CREATE TABLE profile_imports (
  import_id TEXT PRIMARY KEY,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('PROFILE_ZIP_4','DATABASE_BACKUP')),
  source_fingerprint TEXT NOT NULL CHECK (length(source_fingerprint) = 64),
  target_profile_id TEXT NOT NULL REFERENCES profiles(profile_id),
  report_json TEXT NOT NULL CHECK (json_valid(report_json)),
  completed_at TEXT NOT NULL
) STRICT;
CREATE INDEX idx_profile_imports_fingerprint ON profile_imports(source_fingerprint);
CREATE INDEX idx_profile_imports_target ON profile_imports(target_profile_id);

-- Published versions, visual identities and histories are append-only.
CREATE TRIGGER card_versions_no_update BEFORE UPDATE ON card_versions
BEGIN SELECT RAISE(ABORT, 'CARD_VERSION_IMMUTABLE'); END;
CREATE TRIGGER card_versions_no_delete BEFORE DELETE ON card_versions
BEGIN SELECT RAISE(ABORT, 'CARD_VERSION_RETAINED'); END;
CREATE TRIGGER card_printings_no_update BEFORE UPDATE ON card_printings
BEGIN SELECT RAISE(ABORT, 'PRINTING_IMMUTABLE'); END;
CREATE TRIGGER card_printings_no_delete BEFORE DELETE ON card_printings
BEGIN SELECT RAISE(ABORT, 'PRINTING_RETAINED'); END;
CREATE TRIGGER operations_no_update BEFORE UPDATE ON operations
BEGIN SELECT RAISE(ABORT, 'OPERATION_IMMUTABLE'); END;
CREATE TRIGGER operations_no_delete BEFORE DELETE ON operations
BEGIN SELECT RAISE(ABORT, 'OPERATION_RETAINED'); END;

-- Assets are content addressed: the same bytes always have the same identity.
-- Mutable presentation metadata belongs to relation rows, never to this table.
CREATE TRIGGER assets_no_update BEFORE UPDATE ON assets
BEGIN SELECT RAISE(ABORT, 'ASSET_IMMUTABLE'); END;

CREATE TRIGGER card_publications_no_update BEFORE UPDATE ON card_publications
BEGIN SELECT RAISE(ABORT, 'CARD_PUBLICATIONS_APPEND_ONLY'); END;
CREATE TRIGGER card_publications_no_delete BEFORE DELETE ON card_publications
BEGIN SELECT RAISE(ABORT, 'CARD_PUBLICATIONS_APPEND_ONLY'); END;
-- A printing's asset relations must match the bindings declared in its immutable appearance.
CREATE TRIGGER printing_assets_declared_only BEFORE INSERT ON printing_assets
WHEN NOT EXISTS (
  SELECT 1 FROM card_printings AS p, json_each(p.appearance_json, '$.assetBindings') AS b
  WHERE p.printing_id = NEW.printing_id
    AND json_extract(b.value, '$.role') = NEW.role
    AND json_extract(b.value, '$.assetId') = NEW.asset_id)
BEGIN SELECT RAISE(ABORT, 'PRINTING_ASSET_NOT_DECLARED'); END;
CREATE TRIGGER printing_assets_no_update BEFORE UPDATE ON printing_assets
BEGIN SELECT RAISE(ABORT, 'PRINTING_ASSETS_APPEND_ONLY'); END;
CREATE TRIGGER printing_assets_no_delete BEFORE DELETE ON printing_assets
BEGIN SELECT RAISE(ABORT, 'PRINTING_ASSETS_APPEND_ONLY'); END;
CREATE TRIGGER package_cards_no_update BEFORE UPDATE ON package_cards
BEGIN SELECT RAISE(ABORT, 'PACKAGE_CARDS_APPEND_ONLY'); END;
CREATE TRIGGER package_cards_no_delete BEFORE DELETE ON package_cards
BEGIN SELECT RAISE(ABORT, 'PACKAGE_CARDS_APPEND_ONLY'); END;
CREATE TRIGGER card_dependencies_no_update BEFORE UPDATE ON card_dependencies
BEGIN SELECT RAISE(ABORT, 'CARD_DEPENDENCIES_IMMUTABLE'); END;
CREATE TRIGGER card_dependencies_no_delete BEFORE DELETE ON card_dependencies
BEGIN SELECT RAISE(ABORT, 'CARD_DEPENDENCIES_RETAINED'); END;
CREATE TRIGGER card_test_runs_no_update BEFORE UPDATE ON card_test_runs
BEGIN SELECT RAISE(ABORT, 'CARD_TEST_RUNS_IMMUTABLE'); END;
CREATE TRIGGER card_test_runs_no_delete BEFORE DELETE ON card_test_runs
BEGIN SELECT RAISE(ABORT, 'CARD_TEST_RUNS_RETAINED'); END;
-- Editor revisions never change; only AUTO revisions may be pruned by the retention policy.
CREATE TRIGGER editor_revisions_no_update BEFORE UPDATE ON editor_revisions
BEGIN SELECT RAISE(ABORT, 'EDITOR_REVISION_IMMUTABLE'); END;
CREATE TRIGGER editor_revisions_prune_auto_only BEFORE DELETE ON editor_revisions
WHEN OLD.kind <> 'AUTO'
  OR OLD.revision = (SELECT head_revision FROM editor_projects WHERE project_id = OLD.project_id)
  OR EXISTS (SELECT 1 FROM card_test_runs WHERE project_id = OLD.project_id AND revision = OLD.revision)
  OR EXISTS (SELECT 1 FROM card_publications WHERE project_id = OLD.project_id AND project_revision = OLD.revision)
BEGIN SELECT RAISE(ABORT, 'EDITOR_REVISION_RETAINED'); END;
CREATE TRIGGER cosmetic_presets_no_update BEFORE UPDATE ON cosmetic_presets
BEGIN SELECT RAISE(ABORT, 'COSMETIC_PRESET_IMMUTABLE'); END;
CREATE TRIGGER cosmetic_presets_no_delete BEFORE DELETE ON cosmetic_presets
BEGIN SELECT RAISE(ABORT, 'COSMETIC_PRESET_RETAINED'); END;
CREATE TRIGGER cosmetic_asset_refs_no_update BEFORE UPDATE ON cosmetic_asset_refs
BEGIN SELECT RAISE(ABORT, 'COSMETIC_ASSET_REFS_IMMUTABLE'); END;
CREATE TRIGGER cosmetic_asset_refs_no_delete BEFORE DELETE ON cosmetic_asset_refs
BEGIN SELECT RAISE(ABORT, 'COSMETIC_ASSET_REFS_RETAINED'); END;
CREATE TRIGGER wallet_entries_no_update BEFORE UPDATE ON wallet_entries
BEGIN SELECT RAISE(ABORT, 'WALLET_ENTRIES_APPEND_ONLY'); END;
CREATE TRIGGER wallet_entries_no_delete BEFORE DELETE ON wallet_entries
BEGIN SELECT RAISE(ABORT, 'WALLET_ENTRIES_APPEND_ONLY'); END;
CREATE TRIGGER inventory_entries_no_update BEFORE UPDATE ON inventory_entries
BEGIN SELECT RAISE(ABORT, 'INVENTORY_ENTRIES_APPEND_ONLY'); END;
CREATE TRIGGER inventory_entries_no_delete BEFORE DELETE ON inventory_entries
BEGIN SELECT RAISE(ABORT, 'INVENTORY_ENTRIES_APPEND_ONLY'); END;
CREATE TRIGGER reward_grants_no_update BEFORE UPDATE ON reward_grants
BEGIN SELECT RAISE(ABORT, 'REWARD_GRANTS_APPEND_ONLY'); END;
CREATE TRIGGER reward_grants_no_delete BEFORE DELETE ON reward_grants
BEGIN SELECT RAISE(ABORT, 'REWARD_GRANTS_APPEND_ONLY'); END;
CREATE TRIGGER battle_events_no_update BEFORE UPDATE ON battle_events
BEGIN SELECT RAISE(ABORT, 'BATTLE_EVENTS_APPEND_ONLY'); END;
CREATE TRIGGER battle_events_no_delete BEFORE DELETE ON battle_events
BEGIN SELECT RAISE(ABORT, 'BATTLE_EVENTS_APPEND_ONLY'); END;
CREATE TRIGGER deck_versions_no_update BEFORE UPDATE ON deck_versions
BEGIN SELECT RAISE(ABORT, 'DECK_VERSIONS_APPEND_ONLY'); END;
CREATE TRIGGER deck_versions_no_delete BEFORE DELETE ON deck_versions
BEGIN SELECT RAISE(ABORT, 'DECK_VERSIONS_APPEND_ONLY'); END;
CREATE TRIGGER deck_entries_no_update BEFORE UPDATE ON deck_entries
BEGIN SELECT RAISE(ABORT, 'DECK_ENTRIES_APPEND_ONLY'); END;
CREATE TRIGGER deck_entries_no_delete BEFORE DELETE ON deck_entries
BEGIN SELECT RAISE(ABORT, 'DECK_ENTRIES_APPEND_ONLY'); END;
CREATE TRIGGER profile_imports_no_update BEFORE UPDATE ON profile_imports
BEGIN SELECT RAISE(ABORT, 'PROFILE_IMPORTS_APPEND_ONLY'); END;
CREATE TRIGGER profile_imports_no_delete BEFORE DELETE ON profile_imports
BEGIN SELECT RAISE(ABORT, 'PROFILE_IMPORTS_APPEND_ONLY'); END;
`;
