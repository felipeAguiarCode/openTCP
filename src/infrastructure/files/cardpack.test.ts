// `.cardpack.zip`/`.card.json` (editor §29): exportação → importação de ponta a ponta entre dois bancos,
// reutilização sem duplicar, conflito com fork explícito e recusa de pacotes maliciosos.
import { zipSync, type Zippable } from 'fflate';
import { describe, expect, it } from 'vitest';
import { createCommandBus } from '../../application/commands.ts';
import { contentInstallRows, indexContent } from '../../application/content.ts';
import { observable, type GameContext } from '../../application/context.ts';
import type { AiPort } from '../../application/ports/ai.ts';
import { deterministicPlatform } from '../../application/ports/platform.ts';
import type { ProfileSnapshot } from '../../application/ports/storage.ts';
import { createProfile } from '../../application/profiles.ts';
import {
  applyImport, cardJsonToContents, catalogHas, collectCardpack, commitPublish, createProject, exportCardJson, loadProject, planImport, preparePublish,
  reindexCustomCatalog, runProjectScenario, saveRevision, storeAsset, type CardpackContents, type ProjectState,
} from '../../application/studio.ts';
import { setIn } from '../../domain/editor/draft.ts';
import { jcsHash, sha256Hex } from '../../domain/hash/jcs.ts';
import { miniBundle } from '../../tests/support/mini-bundle.ts';
import { tinyPng } from '../../tests/support/studio-fixtures.ts';
import { createMemoryStorage } from '../storage/node.ts';
import { cardpackEntries, detectInterchange, listZipEntries, readCardJson, readCardpack, writeCardJson, writeCardpack } from './cardpack.ts';

const noAi: AiPort = { plan: () => Promise.reject(new Error('sem IA')), cancel: () => undefined, dispose: () => undefined };

async function context(start = 1): Promise<GameContext> {
  const storage = await createMemoryStorage();
  const bundle = miniBundle();
  expect((await storage.installContent(contentInstallRows(bundle))).ok).toBe(true);
  const platform = deterministicPlatform(start);
  const ctx: GameContext = { storage, platform, bus: createCommandBus(storage, platform), content: observable(indexContent(bundle)), snapshot: observable<ProfileSnapshot | null>(null), ai: noAi };
  const created = await createProfile(ctx, { displayName: 'Autora', favoriteDeckId: 'starter-fire', progressionMode: 'CUSTOM' });
  expect(created.ok).toBe(true);
  return ctx;
}

/** Publica uma carta com arte importada e um teste aprovado; devolve o pacote exportado. */
async function authoredPack(ctx: GameContext): Promise<{ contents: CardpackContents; zip: Uint8Array; definitionId: string }> {
  const png = tinyPng(8, 6);
  const assetId = sha256Hex(png);
  expect((await storeAsset(ctx, { assetId, mediaType: 'image/png', bytes: png, width: 8, height: 6, metadata: {} })).ok).toBe(true);
  const created = await createProject(ctx, { mode: 'NEW_DEFINITION', template: 'POKEMON_BASIC', baseName: 'Gotelim', type: 'WATER' });
  if (!created.ok) throw new Error(created.message);
  let project = (await loadProject(ctx, created.projectId)) as ProjectState;
  let draft = setIn(setIn(project.draft, ['printings', 0, 'artMode'], 'ART_WINDOW'), ['printings', 0, 'artAssetId'], assetId);
  draft = { ...draft, testScenarios: [{ id: 'uso', kind: 'ATTACK', attackId: draft.rules.attacks[0]!.id, fixture: 'default', forcedCoins: [], expect: { legal: true } }] };
  const saved = await saveRevision(ctx, project, draft, 'MANUAL');
  if (!saved.ok) throw new Error(saved.message);
  project = (await loadProject(ctx, created.projectId)) as ProjectState;
  const run = await runProjectScenario(ctx, created.projectId, project.headRevision, draft, draft.testScenarios[0]!);
  expect(run.ok && run.result.outcome).toBe('PASS');
  const prepared = await preparePublish(ctx, project, draft);
  if (!prepared.ok) throw new Error(prepared.message);
  const published = await commitPublish(ctx, prepared.plan);
  if (!published.ok) throw new Error(published.message);
  await reindexCustomCatalog(ctx, ctx.snapshot.get()!.profile.profileId);
  const contents = await collectCardpack(ctx, [{ definitionId: published.definitionId, version: 1 }]);
  if ('ok' in contents) throw new Error(contents.message);
  return { contents, zip: writeCardpack(contents), definitionId: published.definitionId };
}

function rezip(entries: Record<string, Uint8Array>, extra: Zippable = {}): Uint8Array {
  const z: Zippable = { ...extra };
  for (const [k, v] of Object.entries(entries)) z[k] = v;
  return zipSync(z, { mtime: new Date('2026-01-01T00:00:00Z') });
}

describe('pacote autoral `.cardpack.zip`', () => {
  it('ED-064 · exporta definições, impressões, assets e testes, sem carteira ou progresso; leitura round-trip', async () => {
    const ctx = await context();
    const { contents, zip } = await authoredPack(ctx);
    expect(detectInterchange(zip)).toBe('CARDPACK');
    const names = listZipEntries(zip);
    expect(names.ok && names.value.map((e) => e.name).sort()).toEqual([
      `assets/${contents.assets[0]!.sha256}.png`, `cards/${contents.cards[0]!.id}/1.json`, 'manifest.json', `printings/${contents.printings[0]!.printingId}.json`,
      `tests/${contents.tests[0]!.testId}.json`,
    ].sort());
    const read = readCardpack(zip);
    if (!read.ok) throw new Error(JSON.stringify(read.issues));
    expect(read.value.manifest).toEqual(contents.manifest);
    expect(read.value.cards).toEqual(contents.cards);
    expect(read.value.manifest.cards[0]!.rulesHash).toBe(jcsHash(contents.cards[0]));
    expect(JSON.stringify(read.value)).not.toMatch(/wallet|inventory|receipt|CREDITS/i);
    expect(writeCardpack(contents)).toEqual(zip); // determinístico
  });

  it('exporta → importa noutro banco: carta, impressões e asset idênticos; testes só como relatório; reimportar não duplica', async () => {
    const a = await context();
    const { zip, definitionId } = await authoredPack(a);
    const b = await context(500);
    const read = readCardpack(zip);
    if (!read.ok) throw new Error(JSON.stringify(read.issues));
    const plan = await planImport(b, read.value);
    expect(plan.cards[0]!.item.status).toBe('NEW');
    expect(plan.missingAssets).toEqual([]);
    expect(plan.tests[0]!.rerun?.outcome).toBe('PASS');
    const done = await applyImport(b, plan, {});
    if (!done.ok) throw new Error(done.message);
    expect(done.imported).toHaveLength(1);
    const storageB = b.storage as Awaited<ReturnType<typeof createMemoryStorage>>;
    expect(storageB.database.db.selectValue('SELECT rules_hash FROM card_versions WHERE definition_id = ?', [definitionId])).toBe(read.value.manifest.cards[0]!.rulesHash);
    expect(storageB.database.db.selectValue('SELECT appearance_hash FROM card_printings WHERE printing_id = ?', [read.value.printings[0]!.printingId])).toBe(read.value.manifest.printings[0]!.appearanceHash);
    expect(Number(storageB.database.db.selectValue('SELECT count(*) FROM card_test_runs'))).toBe(0);
    expect(catalogHas(b.content.get(), definitionId, 1)).toBe(true);
    // Mesmo ID/versão e hash: reutiliza sem duplicar.
    const again = await planImport(b, read.value);
    expect(again.cards[0]!.item.status).toBe('SAME');
    const reapplied = await applyImport(b, again, {});
    expect(reapplied.ok && reapplied.skipped).toHaveLength(1);
    expect(Number(storageB.database.db.selectValue('SELECT count(*) FROM card_versions WHERE definition_id = ?', [definitionId]))).toBe(1);
  });

  it('ED-065 · mesmo ID/versão com hash diferente é conflito: nunca sobrescreve; cópia remapeia IDs', async () => {
    const a = await context();
    const { contents } = await authoredPack(a);
    const changedCard = { ...contents.cards[0]!, baseHp: 120 } as typeof contents.cards[0];
    const forged: CardpackContents = { ...contents, cards: [changedCard], manifest: { ...contents.manifest, cards: [{ ...contents.manifest.cards[0]!, rulesHash: jcsHash(changedCard) }] } };
    const read = readCardpack(writeCardpack(forged));
    if (!read.ok) throw new Error(JSON.stringify(read.issues));
    const plan = await planImport(a, read.value);
    expect(plan.cards[0]!.item.status).toBe('CONFLICT');
    expect(plan.cards[0]!.allowed).toEqual(['COPY', 'SKIP']);
    expect(plan.cards[0]!.diff.some((c) => c.path.join('.') === 'rules.baseHp')).toBe(true);
    const done = await applyImport(a, plan, {});
    if (!done.ok) throw new Error(done.message);
    expect(done.imported[0]!.definitionId).not.toBe(contents.cards[0]!.id);
    const storageA = a.storage as Awaited<ReturnType<typeof createMemoryStorage>>;
    expect(storageA.database.db.selectValue('SELECT rules_hash FROM card_versions WHERE definition_id = ? AND version = 1', [contents.cards[0]!.id])).toBe(jcsHash(contents.cards[0]));
  });

  it('recusa pacotes maliciosos: traversal, absoluto, SQL/HTML, ZIP aninhado, symlink, duplicata, bomba e hash falso', async () => {
    const ctx = await context();
    const { contents } = await authoredPack(ctx);
    const entries = cardpackEntries(contents);
    const code = (zip: Uint8Array) => { const r = readCardpack(zip); return r.ok ? 'OK' : r.issues.map((i) => i.code); };
    expect(code(rezip({ ...entries, '../escape.json': new Uint8Array([123, 125]) }))).toContain('ENTRY_PATH_TRAVERSAL');
    expect(code(rezip({ ...entries, '/etc/passwd': new Uint8Array([1]) }))).toContain('ENTRY_PATH_ABSOLUTE');
    expect(code(rezip({ ...entries, 'drop.sql': new TextEncoder().encode('DROP TABLE profiles;') }))).toContain('ENTRY_NOT_ALLOWED');
    expect(code(rezip({ ...entries, 'index.html': new TextEncoder().encode('<script>x</script>') }))).toContain('ENTRY_NOT_ALLOWED');
    expect(code(rezip({ ...entries, 'inner.zip': zipSync({ a: new Uint8Array([1]) }) }))).toContain('NESTED_ARCHIVE');
    expect(code(rezip(entries, { 'tests/link.json': [new TextEncoder().encode('/etc/passwd'), { os: 3, attrs: (0o120777 << 16) >>> 0 }] }))).toContain('SYMLINK_NOT_ALLOWED');
    // Duplicata: renomeia uma entrada para o mesmo nome do manifesto no diretório central e no cabeçalho local.
    const dupSource = rezip({ ...entries, 'manifesu.json': entries['manifest.json']! });
    const dup = dupSource.slice();
    const needle = new TextEncoder().encode('manifesu.json');
    for (let i = 0; i < dup.length - needle.length; i += 1) if (needle.every((b, k) => dup[i + k] === b)) dup[i + 7] = 't'.charCodeAt(0);
    expect(code(dup)).toContain('DUPLICATE_ENTRY');
    // Bomba: tamanho declarado menor que o expandido.
    const bombEntries = { ...entries, [`tests/${contents.tests[0]!.testId}.json`]: new TextEncoder().encode(JSON.stringify({ ...contents.tests[0], pad: 'x'.repeat(50000) })) };
    const bomb = rezip(bombEntries).slice();
    const listed = listZipEntries(bomb);
    if (!listed.ok) throw new Error('zip');
    const target = listed.value.find((e) => e.name.startsWith('tests/'))!;
    const view = new DataView(bomb.buffer);
    for (let i = 0; i < bomb.length - 4; i += 1) {
      if (view.getUint32(i, true) === 0x02014b50 && view.getUint32(i + 42, true) === target.localOffset) view.setUint32(i + 24, 100, true);
    }
    const bombCodes = code(bomb);
    expect(bombCodes === 'OK' ? [] : bombCodes.some((c) => c === 'ZIP_SIZE_MISMATCH' || c === 'ZIP_INVALID')).toBe(true);
    // Asset cujo nome não é o hash dos bytes.
    const fakeHash = 'f'.repeat(64);
    const forged = { ...entries };
    const assetName = Object.keys(forged).find((k) => k.startsWith('assets/'))!;
    forged[`assets/${fakeHash}.png`] = forged[assetName]!;
    delete forged[assetName];
    expect(code(rezip(forged))).toContain('ASSET_HASH_MISMATCH');
    // Asset que é um executável disfarçado de PNG.
    const exe = new TextEncoder().encode('MZ fake executable');
    expect(code(rezip({ ...entries, [`assets/${sha256Hex(exe)}.png`]: exe }))).toContain('IMAGE_DISGUISED');
    // URL remota/HTML ativo dentro de documento.
    const cardName = Object.keys(entries).find((k) => k.startsWith('cards/'))!;
    const withUrl = { ...entries, [cardName]: new TextEncoder().encode(JSON.stringify({ ...contents.cards[0], flavorText: 'veja https://exemplo.invalid/x' })) };
    expect(code(rezip(withUrl))).toContain('REMOTE_URL');
    // Manifesto adulterado (hash de regras diferente).
    const badManifest = { ...entries, 'manifest.json': new TextEncoder().encode(JSON.stringify({ ...contents.manifest, cards: [{ ...contents.manifest.cards[0], rulesHash: '0'.repeat(64) }] })) };
    expect(code(rezip(badManifest))).toContain('RULES_HASH_MISMATCH');
  });
});

describe('carta avulsa `.card.json`', () => {
  it('exporta sem bytes de mídia; importar exige assets já presentes no banco', async () => {
    const a = await context();
    const { definitionId } = await authoredPack(a);
    const doc = await exportCardJson(a, definitionId, 1);
    if ('ok' in doc) throw new Error(doc.message);
    const text = writeCardJson(doc);
    expect(detectInterchange(new TextEncoder().encode(text))).toBe('CARD_JSON');
    expect(text).not.toContain('"bytes": [');
    const read = readCardJson(text);
    if (!read.ok) throw new Error(JSON.stringify(read.issues));
    expect(read.value.assetRefs).toHaveLength(1);
    const b = await context(700);
    const contents = await cardJsonToContents(b, read.value);
    expect(contents.missingAssets).toEqual([read.value.assetRefs[0]!.sha256]);
    expect(readCardJson('{"format":"card-campaign-card","formatVersion":2}').ok).toBe(false);
    expect(readCardJson(JSON.stringify({ ...doc, wallet: { CREDITS: 9 } })).ok).toBe(false);
  });
});
