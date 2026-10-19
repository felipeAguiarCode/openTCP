// Instalação do pacote BASE (persistencia-sqlite.md §21, DB-047): idempotente por hash, sem sobrescrita.
import { describe, expect, it } from 'vitest';
import type { ContentInstall } from '../../application/ports/storage.ts';
import { pokemon } from '../../content/builders.ts';
import { jcsHash } from '../../domain/hash/jcs.ts';
import { installContent, query } from './executor.ts';
import { NOW, STARTER_CARDS, asJson, count, migratedDatabase, starterInstall, tableCounts } from './test-support.ts';

describe('installContent', () => {
  it('instala definições, versões, publicações, heads, impressões e package_cards numa transação', async () => {
    const { db } = await migratedDatabase();
    const install = starterInstall();
    expect(installContent(db, install, NOW)).toEqual({ ok: true, installed: true });
    const n = STARTER_CARDS.length;
    for (const table of ['card_definitions', 'card_versions', 'card_publications', 'card_catalog_heads', 'card_printings', 'package_cards']) {
      expect(count(db, table)).toBe(n);
    }
    expect(db.selectValues('SELECT DISTINCT namespace FROM card_definitions')).toEqual(['BASE']);
    expect(db.selectValues('SELECT DISTINCT validator_version FROM card_publications')).toEqual(['content-build']);
    expect(db.selectValues('SELECT DISTINCT ruleset_id FROM card_versions')).toEqual(['local-campaign-v2']);
    expect(db.selectValue("SELECT display_name FROM card_versions WHERE definition_id = 'faisca'")).toBe('Faísca');
    expect(db.selectValue("SELECT search_key FROM card_versions WHERE definition_id = 'faisca'")).toBe('faisca');
    expect(query(db, { kind: 'CONTENT_INSTALLED', packageId: 'base', version: '1.0.0' })).toBe(true);
    expect(query(db, { kind: 'CONTENT_INSTALLED', packageId: 'base', version: '9.9.9' })).toBe(false);
    expect(query(db, { kind: 'APP_META', key: 'contentPackages' })).toEqual([{ packageId: 'base', version: '1.0.0', contentHash: install.contentHash }]);
    expect(query(db, { kind: 'CUSTOM_CATALOG', profileId: null })).toEqual({ versions: [], printings: [], heads: {} });
    db.close();
  });

  it('reinstalar o mesmo pacote é idempotente; mesmo id/versão com outro hash é IMPORT_INVALID', async () => {
    const { db } = await migratedDatabase();
    const install = starterInstall();
    expect(installContent(db, install, NOW)).toEqual({ ok: true, installed: true });
    const before = tableCounts(db);
    expect(installContent(db, install, NOW)).toEqual({ ok: true, installed: false });
    expect(installContent(db, { ...install, contentHash: 'a'.repeat(64) }, NOW)).toMatchObject({ ok: false, code: 'IMPORT_INVALID' });
    expect(tableCounts(db)).toEqual(before);
    db.close();
  });

  it('DB-047: nova versão reutiliza linhas idênticas e recusa impressão/regra conflitante sem escrita parcial', async () => {
    const { db } = await migratedDatabase();
    expect(installContent(db, starterInstall('1.0.0'), NOW).ok).toBe(true);
    const before = tableCounts(db);
    const base = starterInstall('1.1.0');
    const first = base.printings[0]!;
    const conflictingAppearance = asJson({ ...(first.appearance as object), rarity: 'RARE' });
    const conflicting: ContentInstall = {
      ...base,
      printings: [{ ...first, appearance: conflictingAppearance, appearanceHash: jcsHash(conflictingAppearance) }, ...base.printings.slice(1)],
    };
    expect(installContent(db, conflicting, NOW)).toMatchObject({ ok: false, code: 'IMPORT_INVALID' });
    const firstRule = base.definitions[0]!;
    const changedRules = asJson({ ...(firstRule.rules as object), flavorText: 'outra' });
    expect(installContent(db, { ...base, definitions: [{ ...firstRule, rules: changedRules, rulesHash: jcsHash(changedRules) }, ...base.definitions.slice(1)] }, NOW))
      .toMatchObject({ ok: false, code: 'IMPORT_INVALID' });
    expect(installContent(db, { ...base, definitions: [{ ...firstRule, rulesHash: 'b'.repeat(64) }] }, NOW)).toMatchObject({ ok: false, code: 'IMPORT_INVALID' });
    expect(tableCounts(db)).toEqual(before);

    const extra = pokemon({ baseName: 'Lumen', stage: 'BASIC', type: 'LIGHTNING', hp: 60, retreat: 1, attacks: [] });
    const next = starterInstall('1.1.0', [...STARTER_CARDS, extra]);
    expect(installContent(db, next, NOW)).toEqual({ ok: true, installed: true });
    expect(count(db, 'card_versions')).toBe(STARTER_CARDS.length + 1);
    expect(count(db, 'card_printings')).toBe(STARTER_CARDS.length + 1);
    expect(db.selectValue("SELECT count(*) FROM package_cards WHERE package_version = '1.1.0'")).toBe(STARTER_CARDS.length + 1);
    expect(query(db, { kind: 'APP_META', key: 'contentPackages' })).toEqual([{ packageId: 'base', version: '1.1.0', contentHash: next.contentHash }]);
    db.close();
  });
});

describe('installContent · troca de arte empacotada (runtime §20.1)', () => {
  const withAppearance = (install: ContentInstall, index: number, patch: Record<string, unknown>): ContentInstall => {
    const p = install.printings[index]!;
    const appearance = asJson({ ...(p.appearance as object), ...patch });
    return { ...install, printings: install.printings.map((x, i) => (i === index ? { ...x, appearance, appearanceHash: jcsHash(appearance) } : x)) };
  };

  it('versão nova pode trocar só a arte (artMode/artKey) de uma impressão BASE sem reescrever a linha imutável', async () => {
    const { db } = await migratedDatabase();
    expect(installContent(db, starterInstall('1.0.0'), NOW).ok).toBe(true);
    const stored = db.selectValue('SELECT appearance_hash FROM card_printings WHERE printing_id = ?', [starterInstall('1.0.0').printings[0]!.printingId]);
    const next = withAppearance(starterInstall('1.1.0'), 0, { artMode: 'FULL_PRINTING', artKey: 'art:base:001' });
    expect(installContent(db, next, NOW)).toEqual({ ok: true, installed: true });
    expect(db.selectValue('SELECT appearance_hash FROM card_printings WHERE printing_id = ?', [next.printings[0]!.printingId])).toBe(stored);
    expect(db.selectValue("SELECT count(*) FROM package_cards WHERE package_version = '1.1.0'")).toBe(next.printings.length);
    db.close();
  });

  it('arte importada (artAssetId) ou qualquer outro campo junto da arte continua sendo conflito', async () => {
    const { db } = await migratedDatabase();
    expect(installContent(db, starterInstall('1.0.0'), NOW).ok).toBe(true);
    const imported = withAppearance(starterInstall('1.1.0'), 0, { artMode: 'FULL_PRINTING', artAssetId: 'c'.repeat(64) });
    expect(installContent(db, imported, NOW)).toMatchObject({ ok: false, code: 'IMPORT_INVALID' });
    const rarity = withAppearance(starterInstall('1.1.0'), 0, { artMode: 'FULL_PRINTING', artKey: 'art:base:001', rarity: 'RARE' });
    expect(installContent(db, rarity, NOW)).toMatchObject({ ok: false, code: 'IMPORT_INVALID' });
    db.close();
  });
});
