#!/usr/bin/env python3
"""Validate the reference SQLite DDL with native SQLite (not a browser/WASM test).

The migration is applied the way the application runner must apply it
(persistencia-sqlite.md §21): connection PRAGMAs first, then one transaction with
the DDL, the schema_migrations row, application_id and user_version.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sqlite3
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
RESULTS: list[dict[str, object]] = []
APPLICATION_ID = 1128354372
EXPECTED_TABLES = 47

import sys
sys.path.insert(0, str(HERE))
from build_seed import build as build_seed, jcs  # noqa: E402


def record(name: str, condition: bool) -> None:
    if not condition:
        raise AssertionError(name)
    RESULTS.append({"name": name, "passed": True})


def rejected(db: sqlite3.Connection, name: str, sql: str, args: tuple = (), expect: str = "") -> None:
    """Statement must fail with a DatabaseError whose message contains `expect`.

    The expected token is a positive control: a typo in the SQL raises a different
    error (e.g. "no such column") and the test fails instead of passing vacuously.
    """
    db.execute("SAVEPOINT rejection_test")
    message = None
    try:
        db.execute(sql, args)
    except sqlite3.DatabaseError as error:
        message = str(error)
    finally:
        db.execute("ROLLBACK TO rejection_test")
        db.execute("RELEASE rejection_test")
    if message is None or expect not in message:
        raise AssertionError(f"{name}: expected failure containing {expect!r}, got {message!r}")
    RESULTS.append({"name": name, "passed": True})


def accepted(db: sqlite3.Connection, name: str, statements: list[tuple[str, tuple]]) -> None:
    db.execute("SAVEPOINT acceptance_test")
    try:
        for sql, args in statements:
            db.execute(sql, args)
    finally:
        db.execute("ROLLBACK TO acceptance_test")
        db.execute("RELEASE acceptance_test")
    RESULTS.append({"name": name, "passed": True})


def connect(path: Path) -> sqlite3.Connection:
    db = sqlite3.connect(path, isolation_level=None)
    for pragma in ("foreign_keys = ON", "journal_mode = DELETE", "synchronous = FULL", "busy_timeout = 1500"):
        db.execute(f"PRAGMA {pragma}")
    return db


def migrate(db: sqlite3.Connection, ddl: str, checksum: str) -> None:
    script = (
        "BEGIN IMMEDIATE;\n" + ddl +
        f"\nINSERT INTO schema_migrations VALUES (1,'0001-schema-v1','{checksum}','2026-10-14T00:00:00Z');"
        f"\nPRAGMA application_id = {APPLICATION_ID};\nPRAGMA user_version = 1;\nCOMMIT;\n"
    )
    try:
        db.executescript(script)
    except sqlite3.DatabaseError:
        if db.in_transaction:
            db.execute("ROLLBACK")
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, help="Write a technical demo database.")
    parser.add_argument("--report", type=Path, help="Write the test results as JSON.")
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()
    if args.output and args.output.exists() and not args.overwrite:
        parser.error("Output exists. Use --overwrite explicitly.")
    ddl = (HERE / "schema-v1.sql").read_text(encoding="utf-8")
    schema_hash = hashlib.sha256((HERE / "schema-v1.sql").read_bytes()).hexdigest()
    seed = build_seed()
    record("seed_file_matches_generator", (HERE / "seed-demo.sql").read_text(encoding="utf-8") == seed)
    forbidden = re.compile(r"^\s*(BEGIN\s*(IMMEDIATE|DEFERRED|EXCLUSIVE|TRANSACTION)?\s*;|COMMIT|END\s*;|PRAGMA)", re.I | re.M)
    record("ddl_has_no_transaction_or_pragma", forbidden.search(ddl) is None)

    with tempfile.TemporaryDirectory(prefix="card-sqlite-test-") as directory:
        # Atomic migration: a failure must leave an empty database at user_version 0.
        broken_path = Path(directory) / "broken.sqlite3"
        broken = connect(broken_path)
        try:
            try:
                migrate(broken, ddl + "\nCREATE TABLE profiles (x INTEGER);\n", schema_hash)
                raise AssertionError("broken migration should fail")
            except sqlite3.DatabaseError:
                pass
            record("failed_migration_keeps_user_version_0", broken.execute("PRAGMA user_version").fetchone()[0] == 0)
            record("failed_migration_creates_no_table",
                   broken.execute("SELECT count(*) FROM sqlite_schema WHERE type='table'").fetchone()[0] == 0)
        finally:
            broken.close()

        path = Path(directory) / "test.sqlite3"
        db = connect(path)
        try:
            migrate(db, ddl, schema_hash)
            db.executescript(seed)
            record("schema_version", db.execute("PRAGMA user_version").fetchone()[0] == 1)
            record("application_id", db.execute("PRAGMA application_id").fetchone()[0] == APPLICATION_ID)
            record("migration_row_same_transaction",
                   db.execute("SELECT version, checksum_sha256 FROM schema_migrations").fetchall() == [(1, schema_hash)])
            record("foreign_keys_enabled", db.execute("PRAGMA foreign_keys").fetchone()[0] == 1)
            record("rollback_journal", db.execute("PRAGMA journal_mode").fetchone()[0] == "delete")
            record("integrity_check", db.execute("PRAGMA integrity_check").fetchone()[0] == "ok")
            record("foreign_key_check", db.execute("PRAGMA foreign_key_check").fetchall() == [])
            tables = [r[0] for r in db.execute(
                "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
            record(f"{EXPECTED_TABLES}_reference_tables", len(tables) == EXPECTED_TABLES)
            empty = [t for t in tables if db.execute(f'SELECT count(*) FROM "{t}"').fetchone()[0] == 0]
            record("seed_covers_tables_except_dependencies", empty == ["card_dependencies"])
            record("generated_ex_fields",
                   db.execute("SELECT display_name, base_name, rule_box, knockout_points, hp FROM card_versions").fetchone()
                   == ("Braseiro ex", "Braseiro", "EX", 2, 140))
            rules_json, rules_hash = db.execute("SELECT rules_json, rules_hash FROM card_versions").fetchone()
            record("rules_hash_is_jcs_sha256",
                   hashlib.sha256(jcs(json.loads(rules_json)).encode("utf-8")).hexdigest() == rules_hash)
            for appearance, appearance_hash in db.execute("SELECT appearance_json, appearance_hash FROM card_printings"):
                record("appearance_hash_is_jcs_sha256",
                       hashlib.sha256(jcs(json.loads(appearance)).encode("utf-8")).hexdigest() == appearance_hash)
            record("two_printings_one_rule_version",
                   db.execute("SELECT count(*), count(DISTINCT definition_id || ':' || definition_version) FROM card_printings").fetchone()
                   == (2, 1))
            record("finishes_are_independent",
                   db.execute("SELECT finish FROM card_printings ORDER BY finish").fetchall() == [("FOIL",), ("NORMAL",)])
            blob, expected_hash, byte_length = db.execute("SELECT bytes,asset_id,byte_length FROM assets").fetchone()
            record("blob_sha256", hashlib.sha256(blob).hexdigest() == expected_hash)
            record("blob_length", len(blob) == byte_length)
            record("two_printings_reuse_one_asset",
                   db.execute("SELECT count(DISTINCT asset_id) FROM printing_assets").fetchone()[0] == 1)
            record("publication_links_project_and_operation",
                   db.execute("SELECT project_id, project_revision, operation_id FROM card_publications").fetchone()
                   == ("project-braseiro-01", 1, "operation-publish-1"))

            # Basic constraints and append-only history.
            rejected(db, "negative_wallet", "UPDATE wallets SET balance=-1", expect="CHECK constraint")
            rejected(db, "unknown_wallet_resource", "INSERT INTO wallets VALUES ('profile-creator','GEMS',1)", expect="CHECK constraint")
            rejected(db, "fractional_inventory", "UPDATE inventory SET quantity=1.5", expect="cannot store REAL")
            rejected(db, "missing_printing_fk", "INSERT INTO inventory VALUES ('profile-creator','absent',1)", expect="FOREIGN KEY")
            rejected(db, "immutable_card_update", "UPDATE card_versions SET ruleset_id='bad'", expect="CARD_VERSION_IMMUTABLE")
            rejected(db, "retained_card_delete", "DELETE FROM card_versions", expect="CARD_VERSION_RETAINED")
            rejected(db, "immutable_printing_update", "UPDATE card_printings SET appearance_hash=?", ("f" * 64,), expect="PRINTING_IMMUTABLE")
            rejected(db, "immutable_asset_update", "UPDATE assets SET byte_length=99", expect="ASSET_IMMUTABLE")
            rejected(db, "referenced_asset_delete", "DELETE FROM assets", expect="FOREIGN KEY")
            rejected(db, "immutable_operation_update", "UPDATE operations SET receipt_json='{}'", expect="OPERATION_IMMUTABLE")
            rejected(db, "immutable_ledger_update", "UPDATE wallet_entries SET delta=99", expect="WALLET_ENTRIES_APPEND_ONLY")
            rejected(db, "immutable_printing_asset_update", "UPDATE printing_assets SET role='FOIL_MASK'", expect="PRINTING_ASSETS_APPEND_ONLY")
            rejected(db, "undeclared_printing_asset_rejected",
                     "INSERT INTO printing_assets VALUES ('print-custom-braseiro-ex-normal-v1','FOIL_MASK',?)", (expected_hash,),
                     expect="PRINTING_ASSET_NOT_DECLARED")
            rejected(db, "thumbnail_not_a_printing_role",
                     "INSERT INTO printing_assets VALUES ('print-custom-braseiro-ex-normal-v1','THUMBNAIL',?)", (expected_hash,),
                     expect="PRINTING_ASSET_NOT_DECLARED")
            record("thumbnail_absent_from_role_check", "'THUMBNAIL'" not in ddl)
            rejected(db, "package_cards_append_only", "DELETE FROM package_cards", expect="PACKAGE_CARDS_APPEND_ONLY")
            rejected(db, "test_runs_immutable", "UPDATE card_test_runs SET outcome='FAIL'", expect="CARD_TEST_RUNS_IMMUTABLE")
            rejected(db, "preset_immutable", "UPDATE cosmetic_presets SET config_json='{}'", expect="COSMETIC_PRESET_IMMUTABLE")
            rejected(db, "preset_asset_refs_immutable", "DELETE FROM cosmetic_asset_refs", expect="COSMETIC_ASSET_REFS_RETAINED")
            rejected(db, "editor_revision_immutable", "UPDATE editor_revisions SET draft_json='{}'", expect="EDITOR_REVISION_IMMUTABLE")
            rejected(db, "published_revision_not_pruned", "DELETE FROM editor_revisions WHERE revision=1", expect="EDITOR_REVISION_RETAINED")
            rejected(db, "head_revision_not_pruned", "DELETE FROM editor_revisions WHERE revision=2", expect="EDITOR_REVISION_RETAINED")
            accepted(db, "old_auto_revision_prunable", [
                ("INSERT INTO editor_revisions SELECT project_id,3,'AUTO',draft_json,'{}',created_at FROM editor_revisions WHERE revision=2", ()),
                ("UPDATE editor_projects SET head_revision=3 WHERE project_id='project-braseiro-01'", ()),
                ("DELETE FROM editor_revisions WHERE project_id='project-braseiro-01' AND revision=2", ()),
            ])
            rejected(db, "profile_imports_append_only", "DELETE FROM profile_imports", expect="PROFILE_IMPORTS_APPEND_ONLY")
            accepted(db, "same_profile_zip_imported_twice_as_new_profile", [
                ("INSERT INTO profile_imports SELECT 'import-2',source_kind,source_fingerprint,'profile-creator','{}',completed_at FROM profile_imports", ()),
            ])

            raw = json.loads(rules_json)

            def candidate_version(changes: dict) -> tuple:
                candidate = dict(raw)
                candidate.update({"version": 2})
                candidate.update(changes)
                return (jcs(candidate), "a" * 64)

            insert_v2 = ("INSERT INTO card_versions(definition_id,version,rules_json,rules_hash,ruleset_id,search_key,created_at)"
                         " VALUES ('custom-braseiro-ex',2,?,?,'local-campaign-v2','braseiro ex','2026-10-14T00:00:00Z')")
            rejected(db, "ex_with_one_point_rejected", insert_v2, candidate_version({"knockoutPoints": 1}), expect="CHECK constraint")
            rejected(db, "wrong_rule_id_rejected", insert_v2, candidate_version({"id": "other"}), expect="CHECK constraint")
            rejected(db, "non_step_hp_rejected", insert_v2, candidate_version({"baseHp": 145}), expect="CHECK constraint")
            rejected(db, "trainer_with_hp_rejected", insert_v2,
                     candidate_version({"category": "TRAINER", "ruleBox": "NONE", "knockoutPoints": None}), expect="CHECK constraint")
            rejected(db, "missing_name_rejected", insert_v2, candidate_version({"name": None}), expect="NOT NULL")
            rejected(db, "missing_base_name_rejected", insert_v2, candidate_version({"baseName": None}), expect="NOT NULL")
            rejected(db, "invalid_json_rejected",
                     "INSERT INTO card_versions(definition_id,version,rules_json,rules_hash,ruleset_id,search_key,created_at)"
                     " VALUES ('custom-braseiro-ex',2,'{',?,'x','x','x')", ("a" * 64,), expect="malformed JSON")
            accepted(db, "dependency_rows_immutable_after_insert", [
                (insert_v2, candidate_version({})),
                ("INSERT INTO card_dependencies VALUES ('custom-braseiro-ex',2,'custom-braseiro-ex',1,'REFERENCE')", ()),
            ])
            db.execute("SAVEPOINT dep")
            db.execute(insert_v2, candidate_version({}))
            db.execute("INSERT INTO card_dependencies VALUES ('custom-braseiro-ex',2,'custom-braseiro-ex',1,'REFERENCE')")
            rejected(db, "card_dependencies_retained", "DELETE FROM card_dependencies", expect="CARD_DEPENDENCIES_RETAINED")
            db.execute("ROLLBACK TO dep")
            db.execute("RELEASE dep")

            appearance = json.loads(db.execute("SELECT appearance_json FROM card_printings LIMIT 1").fetchone()[0])
            appearance["printingId"] = "printing-invalid"
            appearance["finish"] = "UNKNOWN"
            insert_printing = ("INSERT INTO card_printings(printing_id,definition_id,definition_version,appearance_json,appearance_hash,created_at)"
                               " VALUES ('printing-invalid','custom-braseiro-ex',1,?,?,'x')")
            rejected(db, "invalid_finish_rejected", insert_printing, (jcs(appearance), "a" * 64), expect="CHECK constraint")
            appearance["finish"] = "NORMAL"
            appearance["cardDefinitionVersion"] = 99
            rejected(db, "appearance_version_binding_rejected", insert_printing, (jcs(appearance), "a" * 64), expect="CHECK constraint")

            rejected(db, "base_definition_with_owner_rejected",
                     "INSERT INTO card_definitions VALUES ('base-x','BASE','profile-creator','x',0)", expect="CHECK constraint")
            rejected(db, "custom_definition_without_owner_rejected",
                     "INSERT INTO card_definitions VALUES ('custom-x','CUSTOM',NULL,'x',0)", expect="CHECK constraint")
            rejected(db, "duplicate_command_rejected",
                     "INSERT INTO operations VALUES ('op-new','profile-creator','command-fixture-1','TEST',?,9,'{}','x')", ("a" * 64,),
                     expect="UNIQUE")
            rejected(db, "duplicate_revision_rejected",
                     "INSERT INTO operations VALUES ('op-new','profile-creator','command-new','TEST',?,1,'{}','x')", ("a" * 64,),
                     expect="UNIQUE")
            rejected(db, "duplicate_business_reward_rejected",
                     "INSERT INTO reward_grants SELECT profile_id,grant_key,operation_id,granted_at FROM reward_grants", expect="UNIQUE")
            rejected(db, "cross_profile_operation_reference_rejected",
                     "INSERT INTO reward_grants VALUES ('profile-standard','bad','operation-fixture-1','x')", expect="FOREIGN KEY")
            attempt_cols = ("attempt_id,profile_id,mode,status,campaign_id,node_id,difficulty,deck_id,deck_revision,"
                            "progression_eligible,state_version,ruleset_id,engine_version,content_fingerprint,state_json,"
                            "rng_json,presentation_snapshot_json,result_json,created_at,updated_at")
            rejected(db, "second_active_attempt_rejected",
                     f"INSERT INTO attempts SELECT 'attempt-2',{attempt_cols.split(',',1)[1]} FROM attempts", expect="UNIQUE")
            rejected(db, "terminal_state_requires_result", "UPDATE attempts SET status='FINISHED'", expect="CHECK constraint")
            rejected(db, "campaign_attempt_requires_node",
                     "UPDATE attempts SET mode='CAMPAIGN', progression_eligible=1", expect="CHECK constraint")
            rejected(db, "training_never_progression_eligible",
                     "UPDATE attempts SET mode='TRAINING', progression_eligible=1", expect="CHECK constraint")
            rejected(db, "progress_not_fragmented_by_content_version",
                     "INSERT INTO campaign_progress SELECT profile_id,campaign_id,node_id,'1.1.0',status,progress_json,updated_at FROM campaign_progress",
                     expect="UNIQUE")
            rejected(db, "deck_position_21_rejected",
                     "INSERT INTO deck_entries VALUES ('deck-creator',1,21,'print-custom-braseiro-ex-normal-v1',NULL)", expect="CHECK constraint")
            rejected(db, "draft_head_invalid_source_rejected",
                     "INSERT INTO editor_projects VALUES ('bad-project','profile-creator','X','NEW_VERSION','DRAFT',0,'absent','absent',1,'x','x')",
                     expect="FOREIGN KEY")
            rejected(db, "publication_with_project_requires_operation",
                     "INSERT INTO card_publications VALUES ('custom-braseiro-ex',2,'v','{}','profile-creator','project-braseiro-01',2,NULL,'x')",
                     expect="CHECK constraint")
            rejected(db, "pending_reward_partial_choice_rejected",
                     "INSERT INTO pending_rewards VALUES ('reward-1','profile-creator','pending-key','PENDING','[]','{}','operation-fixture-1',NULL,NULL,'x')",
                     expect="CHECK constraint")
            rejected(db, "binder_slot_requires_printing",
                     "INSERT INTO binder_slots VALUES ('binder-fixture',1,2,'absent')", expect="FOREIGN KEY")
            rejected(db, "unknown_collection_mark", "UPDATE collection_marks SET mark_kind='PIN'", expect="CHECK constraint")

            db.execute("BEGIN IMMEDIATE")
            changed = db.execute(
                "UPDATE profiles SET revision=revision+1 WHERE profile_id=? AND revision=? AND writer_epoch=?",
                ("profile-creator", 999, 1)).rowcount
            db.execute("ROLLBACK")
            record("stale_revision_changes_zero_rows", changed == 0)
            record("stale_revision_preserves_profile",
                   db.execute("SELECT revision FROM profiles WHERE profile_id='profile-creator'").fetchone()[0] == 3)

            db.execute("BEGIN IMMEDIATE")
            try:
                db.execute("UPDATE wallets SET balance=balance-100 WHERE profile_id='profile-creator'")
                db.execute("UPDATE inventory SET quantity=quantity+1 WHERE profile_id='profile-creator'")
                db.execute("INSERT INTO operations VALUES ('op-rollback','profile-creator','command-rollback','TEST',?,4,'{}','x')", ("b" * 64,))
                db.execute("INSERT INTO reward_grants SELECT profile_id,grant_key,'op-rollback',granted_at FROM reward_grants")
                raise AssertionError("Expected unique reward failure")
            except sqlite3.IntegrityError:
                db.execute("ROLLBACK")
            record("rollback_preserves_wallet", db.execute("SELECT balance FROM wallets").fetchone()[0] == 300)
            record("rollback_preserves_inventory", db.execute("SELECT sum(quantity) FROM inventory").fetchone()[0] == 2)
            record("rollback_removes_uncommitted_operation",
                   db.execute("SELECT count(*) FROM operations WHERE operation_id='op-rollback'").fetchone()[0] == 0)

            db.execute("SAVEPOINT bind_test")
            hostile_name = "name'); DROP TABLE profiles; --"
            db.execute("UPDATE profiles SET display_name=? WHERE profile_id='profile-standard'", (hostile_name,))
            record("bound_text_not_executed",
                   db.execute("SELECT display_name FROM profiles WHERE profile_id='profile-standard'").fetchone()[0] == hostile_name)
            db.execute("ROLLBACK TO bind_test")
            db.execute("RELEASE bind_test")
            rules_before = rules_json
        finally:
            db.close()

        db = connect(path)
        try:
            record("reopen_preserves_rules", db.execute("SELECT rules_json FROM card_versions").fetchone()[0] == rules_before)
            record("reopen_preserves_blob", db.execute("SELECT bytes FROM assets").fetchone()[0] == blob)
            record("reopen_preserves_pending_attempt", db.execute("SELECT status FROM attempts").fetchone()[0] == "SUSPENDED")
            backup_path = Path(directory) / "backup.sqlite3"
            backup = sqlite3.connect(backup_path)
            try:
                db.backup(backup)
                record("native_backup_integrity", backup.execute("PRAGMA integrity_check").fetchone()[0] == "ok")
                record("native_backup_rows", backup.execute("SELECT count(*) FROM card_printings").fetchone()[0] == 2)
            finally:
                backup.close()
            record("final_integrity", db.execute("PRAGMA integrity_check").fetchone()[0] == "ok")
            record("final_foreign_keys", db.execute("PRAGMA foreign_key_check").fetchall() == [])
        finally:
            db.close()
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_bytes(path.read_bytes())

    report = {
        "environment": "Native SQLite through Python sqlite3; not WASM, OPFS or a browser",
        "sqliteVersion": sqlite3.sqlite_version,
        "schemaSha256": schema_hash,
        "testCount": len(RESULTS),
        "passed": len(RESULTS),
        "results": RESULTS,
        "limitations": [
            "No gameplay engine or card-editor UI is implemented by these tests.",
            "Browser isolation, OPFS, crashes and shader output are not tested here.",
            "The seeded publication is a technical fixture, not a fully validated release.",
        ],
    }
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps({"sqliteVersion": sqlite3.sqlite_version, "passed": len(RESULTS)}, indent=2))


if __name__ == "__main__":
    main()
