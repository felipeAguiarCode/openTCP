import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../../domain/hash/jcs.ts';
import { MIGRATION_0001_NAME, MIGRATION_0001_SHA256, MIGRATION_0001_SQL, MIGRATION_0001_VERSION } from './migrations/0001-schema-v1.ts';

const specFile = fileURLToPath(new URL('../../../.specs/database/schema-v1.sql', import.meta.url));

describe('migração 0001-schema-v1 (persistencia §21)', () => {
  it('o módulo gerado é idêntico, byte a byte, a .specs/database/schema-v1.sql', () => {
    const fileBytes = readFileSync(specFile);
    const moduleBytes = Buffer.from(new TextEncoder().encode(MIGRATION_0001_SQL));
    expect(moduleBytes.equals(fileBytes)).toBe(true);
  });

  it('o checksum é o SHA-256 dos bytes exatos do arquivo', () => {
    const fileBytes = readFileSync(specFile);
    expect(createHash('sha256').update(fileBytes).digest('hex')).toBe(MIGRATION_0001_SHA256);
    expect(sha256Hex(MIGRATION_0001_SQL)).toBe(MIGRATION_0001_SHA256);
    expect(MIGRATION_0001_VERSION).toBe(1);
    expect(MIGRATION_0001_NAME).toBe('0001-schema-v1');
  });

  it('o DDL é puro: sem BEGIN, COMMIT nem PRAGMA', () => {
    // Mesma regra de test_schema.py, com \b: sem ela `COMMIT` casa o prefixo de `committed_revision`.
    const forbidden = /^\s*(BEGIN\s*(IMMEDIATE|DEFERRED|EXCLUSIVE|TRANSACTION)?\s*;|COMMIT\b|END\s*;|PRAGMA\b)/im;
    expect(forbidden.test(MIGRATION_0001_SQL)).toBe(false);
  });
});
