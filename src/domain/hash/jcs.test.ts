import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canonicalize, jcsHash, sha256Hex } from './jcs.ts';

describe('JCS + SHA-256', () => {
  it('ordena chaves e normaliza números', () => {
    expect(canonicalize({ b: 1.0, a: [0.5, -0, 'x'], c: null })).toBe('{"a":[0.5,0,"x"],"b":1,"c":null}');
  });

  it('SHA-256 puro confere com node:crypto', () => {
    for (const text of ['', 'abc', 'á'.repeat(1000), 'x'.repeat(55), 'y'.repeat(64)]) {
      expect(sha256Hex(text)).toBe(createHash('sha256').update(text, 'utf8').digest('hex'));
    }
  });

  it('reproduz o rules_hash da fixture gerada pelas specs (Python)', () => {
    const rules = JSON.parse(readFileSync('.specs/examples/card-definition.example.json', 'utf8'));
    const seed = readFileSync('.specs/database/seed-demo.sql', 'utf8');
    const hash = jcsHash(rules);
    expect(seed).toContain(hash);
  });
});
