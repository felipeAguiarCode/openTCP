// Estúdio de ponta a ponta sobre o SQLite real (WASM em memória): projeto → revisões com retenção →
// laboratório (card_test_runs) → PUBLISH_CARD atômico e idempotente → versão 2 imutável → catálogo,
// coleção e concessão CUSTOM/LAB. IDs ED-xxx nos títulos.
import { describe, expect, it } from 'vitest';
import { createMemoryStorage, type MemoryStorage } from '../../infrastructure/storage/node.ts';
import { miniBundle } from '../support/mini-bundle.ts';
import { exampleDraft, tinyPng } from '../support/studio-fixtures.ts';
import { createCommandBus } from '../../application/commands.ts';
import { contentInstallRows, indexContent } from '../../application/content.ts';
import { observable, type GameContext } from '../../application/context.ts';
import { collectionGroups } from '../../application/collection.ts';
import type { AiPort } from '../../application/ports/ai.ts';
import { deterministicPlatform } from '../../application/ports/platform.ts';
import type { ProfileSnapshot } from '../../application/ports/storage.ts';
import { createProfile } from '../../application/profiles.ts';
import {
  alignDraftTarget, catalogHas, commitPublish, createProject, grantCustomCopies, loadLibrary, loadProject, preparePublish, reindexCustomCatalog,
  releaseView, runProjectScenario, saveRevision, setCatalogArchived, setProjectArchived, storeAsset, type ProjectState,
} from '../../application/studio.ts';
import { sha256Hex } from '../../domain/hash/jcs.ts';
import { setIn, withFinish, type EditorDraft } from '../../domain/editor/draft.ts';
import type { PokemonCard } from '../../domain/cards/types.ts';

const noAi: AiPort = { plan: () => Promise.reject(new Error('sem IA')), cancel: () => undefined, dispose: () => undefined };

async function setup(mode: 'STANDARD' | 'CUSTOM' | 'LAB' = 'CUSTOM'): Promise<{ ctx: GameContext; storage: MemoryStorage }> {
  const storage = await createMemoryStorage();
  const bundle = miniBundle();
  expect((await storage.installContent(contentInstallRows(bundle))).ok).toBe(true);
  const platform = deterministicPlatform();
  const ctx: GameContext = {
    storage, platform, bus: createCommandBus(storage, platform), content: observable(indexContent(bundle)),
    snapshot: observable<ProfileSnapshot | null>(null), ai: noAi,
  };
  const created = await createProfile(ctx, { displayName: 'Autora', favoriteDeckId: 'starter-fire', progressionMode: mode });
  expect(created.ok).toBe(true);
  return { ctx, storage };
}

function count(storage: MemoryStorage, sql: string, bind: unknown[] = []): number {
  return Number((bind.length ? storage.database.db.selectValue(sql, bind as never) : storage.database.db.selectValue(sql)) ?? 0);
}

async function open(ctx: GameContext, projectId: string): Promise<ProjectState> {
  const p = await loadProject(ctx, projectId);
  if (!p.ok) throw new Error(p.message);
  return p;
}

async function publish(ctx: GameContext, project: ProjectState, draft: EditorDraft = project.draft) {
  const prepared = await preparePublish(ctx, project, draft);
  if (!prepared.ok) throw new Error(`${prepared.code}: ${prepared.message} ${JSON.stringify('report' in prepared ? prepared.report?.issues.filter((i) => i.severity === 'ERROR') : '')}`);
  const result = await commitPublish(ctx, prepared.plan);
  if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
  return { plan: prepared.plan, result };
}

describe('Estúdio — projetos e revisões', () => {
  it('ED-001/003 · criar Pokémon gera projeto editável sem publicação; reabrir preserva rascunho e validação', async () => {
    const { ctx, storage } = await setup();
    const created = await createProject(ctx, { mode: 'NEW_DEFINITION', template: 'POKEMON_BASIC', baseName: 'Centelho', type: 'LIGHTNING' });
    if (!created.ok) throw new Error(created.message);
    const project = await open(ctx, created.projectId);
    expect(project.mode).toBe('NEW_DEFINITION');
    expect(project.headRevision).toBe(1);
    expect(project.revisionKind).toBe('MANUAL');
    expect(project.draft).toEqual(JSON.parse(JSON.stringify(created.draft)));
    expect(project.validationSummary).toMatchObject({ errors: 0 });
    expect(count(storage, 'SELECT count(*) FROM card_versions WHERE definition_id = ?', [created.draft.target.definitionId])).toBe(0);
    const lib = await loadLibrary(ctx);
    expect(lib.projects.map((p) => p.projectId)).toContain(created.projectId);
    expect(lib.published).toEqual([]);
  });

  it('autosave AUTO com CAS e retenção: 20 AUTO mais recentes + MANUAL + head; conflito de head é detectado', async () => {
    const { ctx } = await setup();
    const created = await createProject(ctx, { mode: 'NEW_DEFINITION', template: 'POKEMON_BASIC', baseName: 'Centelho' });
    if (!created.ok) throw new Error(created.message);
    let project = await open(ctx, created.projectId);
    let draft = project.draft;
    for (let i = 0; i < 25; i += 1) {
      draft = setIn(draft, ['rules', 'baseHp'], 70 + (i % 5) * 10);
      const r = await saveRevision(ctx, project, draft, 'AUTO');
      if (!r.ok) throw new Error(r.message);
      project = { ...project, headRevision: r.revision };
    }
    const manual = await saveRevision(ctx, project, draft, 'MANUAL'); // ED-067
    expect(manual.ok).toBe(true);
    project = await open(ctx, created.projectId);
    expect(project.revisions.filter((r) => r.kind === 'AUTO')).toHaveLength(20);
    expect(project.revisions.filter((r) => r.kind === 'MANUAL').map((r) => r.revision)).toEqual([1, 27]);
    const stale = await saveRevision(ctx, { ...project, headRevision: 5 }, draft, 'AUTO');
    expect(stale.ok).toBe(false);
    expect(!stale.ok && stale.code).toBe('REVISION_CONFLICT');
  });

  it('arte importada é BLOB imutável endereçado por SHA-256 e referenciada pela revisão', async () => {
    const { ctx, storage } = await setup();
    const png = tinyPng(4, 4);
    const assetId = sha256Hex(png);
    expect((await storeAsset(ctx, { assetId, mediaType: 'image/png', bytes: png, width: 4, height: 4, metadata: {} })).ok).toBe(true);
    expect((await storeAsset(ctx, { assetId, mediaType: 'image/png', bytes: png, width: 4, height: 4, metadata: {} })).ok).toBe(true);
    expect((await storeAsset(ctx, { assetId: '0'.repeat(64), mediaType: 'image/png', bytes: png, width: 4, height: 4, metadata: {} })).ok).toBe(false);
    const created = await createProject(ctx, { mode: 'NEW_DEFINITION', template: 'POKEMON_BASIC', baseName: 'Centelho' });
    if (!created.ok) throw new Error(created.message);
    const project = await open(ctx, created.projectId);
    const draft = setIn(setIn(setIn(project.draft, ['printings', 0, 'artMode'], 'ART_WINDOW'), ['printings', 0, 'artAssetId'], assetId), ['printings', 0, 'assetBindings'], [{ role: 'ART_MASTER', assetId }]);
    const saved = await saveRevision(ctx, project, draft, 'MANUAL');
    expect(saved.ok).toBe(true);
    expect(count(storage, 'SELECT count(*) FROM editor_asset_refs WHERE project_id = ? AND asset_id = ?', [created.projectId, assetId])).toBe(1);
    const reopened = await open(ctx, created.projectId);
    expect(reopened.draft.printings[0]!.artAssetId).toBe(assetId);
  });
});

describe('Estúdio — publicação (PUBLISH_CARD)', () => {
  it('ED-057/058/059 · publica atomicamente, replay idempotente, versão 2 imutável e carta no catálogo', async () => {
    const { ctx, storage } = await setup();
    const created = await createProject(ctx, { mode: 'NEW_DEFINITION', template: 'POKEMON_EX', baseName: 'Fornalha', type: 'FIRE' });
    if (!created.ok) throw new Error(created.message);
    let project = await open(ctx, created.projectId);
    const draft: EditorDraft = { ...project.draft, printings: [project.draft.printings[0]!, { ...withFinish(project.draft.printings[0]!, 'FOIL'), printingId: `${project.draft.printings[0]!.printingId}-foil`, collectorNumber: '001F' }] };
    const saved = await saveRevision(ctx, project, draft, 'MANUAL');
    if (!saved.ok) throw new Error(saved.message);
    project = await open(ctx, created.projectId);
    const revisionBefore = ctx.snapshot.get()!.profile.revision;
    const { plan, result } = await publish(ctx, project);
    expect(result.status).toBe('COMMITTED');
    expect(result.version).toBe(1);
    const id = plan.definitionId;
    expect(count(storage, "SELECT count(*) FROM card_definitions WHERE definition_id = ? AND namespace = 'CUSTOM' AND owner_profile_id IS NOT NULL", [id])).toBe(1);
    expect(count(storage, 'SELECT count(*) FROM card_versions WHERE definition_id = ?', [id])).toBe(1);
    expect(count(storage, 'SELECT count(*) FROM card_publications WHERE definition_id = ? AND project_id = ? AND operation_id IS NOT NULL', [id, created.projectId])).toBe(1);
    expect(count(storage, 'SELECT version FROM card_catalog_heads WHERE definition_id = ?', [id])).toBe(1);
    expect(count(storage, 'SELECT count(*) FROM card_printings WHERE definition_id = ?', [id])).toBe(2);
    expect(count(storage, "SELECT count(*) FROM editor_revisions WHERE project_id = ? AND kind = 'PUBLISHED'", [created.projectId])).toBe(1);
    expect(count(storage, "SELECT count(*) FROM operations WHERE command_type = 'PUBLISH_CARD'")).toBe(1);
    expect(ctx.snapshot.get()!.profile.revision).toBe(revisionBefore + 1);
    // Replay do mesmo comando: recibo anterior, nada duplicado (ED-058).
    const replay = await commitPublish(ctx, plan);
    expect(replay.ok && replay.status).toBe('REPLAYED');
    expect(count(storage, "SELECT count(*) FROM operations WHERE command_type = 'PUBLISH_CARD'")).toBe(1);
    expect(count(storage, 'SELECT count(*) FROM card_printings WHERE definition_id = ?', [id])).toBe(2);
    // Aparece no catálogo/coleção após reindexar (S07/S12).
    const content = await reindexCustomCatalog(ctx, ctx.snapshot.get()!.profile.profileId);
    expect(catalogHas(content, id, 1)).toBe(true);
    expect(collectionGroups(content, ctx.snapshot.get()!).some((g) => g.definition.id === id && g.printings.length === 2)).toBe(true);
    // ED-061: normal e foil compartilham a chave de limite.
    expect(new Set(collectionGroups(content, ctx.snapshot.get()!).filter((g) => g.definition.id === id).map((g) => g.definition.deckLimitKey)).size).toBe(1);
    // Segunda publicação: versão 2; v1 continua intacta (imutável).
    project = await open(ctx, created.projectId);
    const v1Rules = storage.database.db.selectValue('SELECT rules_json FROM card_versions WHERE definition_id = ? AND version = 1', [id]);
    let next = alignDraftTarget(content, project.draft);
    expect(next.target.version).toBe(2);
    next = setIn(next, ['rules', 'baseHp'], 160);
    const s2 = await saveRevision(ctx, project, next, 'MANUAL');
    if (!s2.ok) throw new Error(s2.message);
    project = await open(ctx, created.projectId);
    const second = await publish(ctx, project);
    expect(second.result.version).toBe(2);
    expect(second.plan.diff.some((c) => c.path.join('.') === 'rules.baseHp')).toBe(true);
    expect(count(storage, 'SELECT version FROM card_catalog_heads WHERE definition_id = ?', [id])).toBe(2);
    expect(storage.database.db.selectValue('SELECT rules_json FROM card_versions WHERE definition_id = ? AND version = 1', [id])).toBe(v1Rules);
    expect(() => storage.database.db.exec(`UPDATE card_versions SET search_key = 'x' WHERE definition_id = '${id}'`)).toThrow();
    // Impressões publicadas são remapeadas para IDs novos na v2 (nunca UPDATE).
    expect(count(storage, 'SELECT count(*) FROM card_printings WHERE definition_id = ?', [id])).toBe(4);
  });

  it('ED-004 · VARIANT cria só impressões da mesma definição/versão', async () => {
    const { ctx, storage } = await setup();
    const created = await createProject(ctx, { mode: 'NEW_DEFINITION', template: 'POKEMON_BASIC', baseName: 'Musguinho', type: 'GRASS' });
    if (!created.ok) throw new Error(created.message);
    const first = await publish(ctx, await open(ctx, created.projectId));
    await reindexCustomCatalog(ctx, ctx.snapshot.get()!.profile.profileId);
    const variant = await createProject(ctx, { mode: 'VARIANT', sourceDefinitionId: first.plan.definitionId, sourceVersion: 1 });
    if (!variant.ok) throw new Error(variant.message);
    let project = await open(ctx, variant.projectId);
    const draft = { ...project.draft, printings: project.draft.printings.map((p) => withFinish(p, 'HOLOGRAPHIC')) };
    const saved = await saveRevision(ctx, project, draft, 'MANUAL');
    if (!saved.ok) throw new Error(saved.message);
    project = await open(ctx, variant.projectId);
    const blockedRules = await preparePublish(ctx, project, setIn(project.draft, ['rules', 'baseHp'], 300));
    expect(!blockedRules.ok && blockedRules.code).toBe('VALIDATION_FAILED');
    const second = await publish(ctx, project);
    expect(second.result.version).toBe(1);
    expect(second.plan.mutations.map((m) => m.kind)).toEqual(['INSERT_EDITOR_REVISION_PUBLISHED', 'INSERT_PRINTING']);
    expect(count(storage, 'SELECT count(*) FROM card_versions WHERE definition_id = ?', [first.plan.definitionId])).toBe(1);
    expect(count(storage, "SELECT count(*) FROM card_printings WHERE definition_id = ? AND finish = 'HOLOGRAPHIC'", [first.plan.definitionId])).toBe(1);
  });

  it('ED-002 · fork do catálogo base registra origem e publica nova definição CUSTOM', async () => {
    const { ctx, storage } = await setup();
    const fork = await createProject(ctx, { mode: 'FORK', sourceDefinitionId: 'braseiro', sourceVersion: 1, baseName: 'Braseiro Rubro' });
    if (!fork.ok) throw new Error(fork.message);
    const project = await open(ctx, fork.projectId);
    expect(project.sourceDefinitionId).toBe('braseiro');
    expect(project.draft.rules.id).not.toBe('braseiro');
    expect(project.draft.rules.name).toBe('Braseiro Rubro');
    const r = await publish(ctx, project);
    expect(count(storage, "SELECT count(*) FROM card_definitions WHERE definition_id = ? AND namespace = 'CUSTOM'", [r.plan.definitionId])).toBe(1);
    expect(count(storage, "SELECT count(*) FROM card_dependencies WHERE definition_id = ? AND dependency_id = 'faisca'", [r.plan.definitionId])).toBe(1);
    const base = await createProject(ctx, { mode: 'NEW_VERSION', sourceDefinitionId: 'braseiro', sourceVersion: 1 });
    expect(!base.ok && base.code).toBe('BASE_READ_ONLY');
  });

  it('erros de validação bloqueiam a publicação e preservam o rascunho (ED-013)', async () => {
    const { ctx, storage } = await setup();
    const created = await createProject(ctx, { mode: 'NEW_DEFINITION', template: 'POKEMON_BASIC', baseName: 'Duplo' });
    if (!created.ok) throw new Error(created.message);
    const project = await open(ctx, created.projectId);
    const bad = setIn(project.draft, ['rules', 'types'], ['FIRE', 'WATER']);
    const r = await preparePublish(ctx, project, bad);
    expect(!r.ok && r.code).toBe('VALIDATION_FAILED');
    expect(count(storage, 'SELECT count(*) FROM card_versions WHERE definition_id = ?', [project.draft.target.definitionId])).toBe(0);
  });
});

describe('Estúdio — laboratório e testes obrigatórios', () => {
  it('ED-024/056 · executa cenários no motor real, grava card_test_runs e exige PASS para o rulesHash atual', async () => {
    const { ctx, storage } = await setup();
    const created = await createProject(ctx, { mode: 'NEW_DEFINITION', template: 'POKEMON_BASIC', baseName: 'Brasinha' });
    if (!created.ok) throw new Error(created.message);
    let project = await open(ctx, created.projectId);
    const example = exampleDraft();
    const rules = { ...example.rules, id: project.draft.target.definitionId, evolvesFrom: ['faisca'] } as PokemonCard;
    let draft: EditorDraft = { ...project.draft, rules, printings: project.draft.printings.map((p) => ({ ...p, templateId: 'pocket-light-card-v1/pokemon-ex' })), testScenarios: example.testScenarios };
    const saved = await saveRevision(ctx, project, draft, 'MANUAL');
    if (!saved.ok) throw new Error(saved.message);
    project = await open(ctx, created.projectId);
    const blocked = await preparePublish(ctx, project, draft);
    expect(!blocked.ok && blocked.code).toBe('TESTS_REQUIRED');
    for (const scenario of draft.testScenarios) {
      const run = await runProjectScenario(ctx, created.projectId, project.headRevision, draft, scenario);
      if (!run.ok) throw new Error(run.message);
      expect(run.result.outcome).toBe('PASS');
    }
    expect(count(storage, "SELECT count(*) FROM card_test_runs WHERE project_id = ? AND outcome = 'PASS'", [created.projectId])).toBe(3);
    const ok = await preparePublish(ctx, project, draft);
    expect(ok.ok).toBe(true);
    // Mudar regras invalida a aprovação anterior.
    draft = setIn(draft, ['rules', 'baseHp'], 150);
    const again = await preparePublish(ctx, project, draft);
    expect(!again.ok && again.code).toBe('TESTS_REQUIRED');
  });
});

describe('Estúdio — concessão e arquivamento (§28)', () => {
  it('ED-060 · cópias entram só em perfil CUSTOM/LAB; repetir o lote não duplica', async () => {
    const { ctx, storage } = await setup('CUSTOM');
    const created = await createProject(ctx, { mode: 'NEW_DEFINITION', template: 'POKEMON_BASIC', baseName: 'Pelucio' });
    if (!created.ok) throw new Error(created.message);
    const { result } = await publish(ctx, await open(ctx, created.projectId));
    await reindexCustomCatalog(ctx, ctx.snapshot.get()!.profile.profileId);
    const printingId = result.printingIds[0]!;
    const g1 = await grantCustomCopies(ctx, { printingId, grantBatchId: 'batch-1' });
    expect(g1.ok && g1.status).toBe('COMMITTED');
    const g2 = await grantCustomCopies(ctx, { printingId, grantBatchId: 'batch-1' });
    expect(g2.ok && g2.status).toBe('ALREADY_GRANTED');
    expect(ctx.snapshot.get()!.inventory.find((i) => i.printingId === printingId)?.quantity).toBe(2);
    expect(count(storage, 'SELECT count(*) FROM reward_grants WHERE grant_key = ?', [`custom-grant:${printingId}:batch-1`])).toBe(1);
    const base = await grantCustomCopies(ctx, { printingId: ctx.content.get().bundle.printings[0]!.printingId, grantBatchId: 'b' });
    expect(!base.ok && base.code).toBe('GRANT_NOT_ALLOWED');
  });

  it('catálogo CUSTOM de um perfil inclui cartas de outro autor de que ele recebeu cópias (persistencia §18)', async () => {
    const { ctx, storage } = await setup('CUSTOM');
    const created = await createProject(ctx, { mode: 'NEW_DEFINITION', template: 'POKEMON_BASIC', baseName: 'Emprestado' });
    if (!created.ok) throw new Error(created.message);
    const { plan, result } = await publish(ctx, await open(ctx, created.projectId));
    const printingId = result.printingIds[0]!;
    const other = await createProfile(ctx, { displayName: 'Criação', favoriteDeckId: 'starter-fire', progressionMode: 'CUSTOM' });
    if (!other.ok) throw new Error(other.message);
    const before = await storage.query({ kind: 'CUSTOM_CATALOG', profileId: other.profileId });
    expect(before.versions.some((v) => v.definitionId === plan.definitionId)).toBe(false);
    const snapB = await storage.query({ kind: 'PROFILE_SNAPSHOT', profileId: other.profileId });
    const granted = await ctx.bus.execute({
      commandType: 'GRANT_CUSTOM_COPIES', profileId: other.profileId, expectedRevision: snapB!.profile.revision, writerEpoch: snapB!.profile.writerEpoch,
      payload: { printingId, quantity: 2, grantBatchId: 'outro' }, mutations: [{ kind: 'INVENTORY_DELTA', printingId, delta: 2 }],
      grantKeys: [`custom-grant:${printingId}:outro`], summary: { printingId },
    });
    expect(granted.ok).toBe(true);
    const after = await storage.query({ kind: 'CUSTOM_CATALOG', profileId: other.profileId });
    expect(after.versions.some((v) => v.definitionId === plan.definitionId && v.ownerProfileId !== other.profileId)).toBe(true);
    expect(after.printings.some((pr) => pr.printingId === printingId)).toBe(true);
    expect(after.heads[plan.definitionId]).toBe(1);
  });

  it('perfil STANDARD não recebe cópias autorais', async () => {
    const { ctx } = await setup('STANDARD');
    const created = await createProject(ctx, { mode: 'NEW_DEFINITION', template: 'POKEMON_BASIC', baseName: 'Pelucio' });
    if (!created.ok) throw new Error(created.message);
    const { result } = await publish(ctx, await open(ctx, created.projectId));
    await reindexCustomCatalog(ctx, ctx.snapshot.get()!.profile.profileId);
    const g = await grantCustomCopies(ctx, { printingId: result.printingIds[0]!, grantBatchId: 'b1' });
    expect(!g.ok && g.code).toBe('GRANT_NOT_ALLOWED');
    expect(ctx.snapshot.get()!.inventory.some((i) => i.printingId === result.printingIds[0])).toBe(false);
  });

  it('arquivar projeto e versão não apaga dados (catalog_archive_marks / status)', async () => {
    const { ctx, storage } = await setup();
    const created = await createProject(ctx, { mode: 'NEW_DEFINITION', template: 'POKEMON_BASIC', baseName: 'Arquivado' });
    if (!created.ok) throw new Error(created.message);
    const { plan } = await publish(ctx, await open(ctx, created.projectId));
    expect((await setProjectArchived(ctx, created.projectId, true)).ok).toBe(true);
    expect((await setCatalogArchived(ctx, 'VERSION', plan.definitionId, 1, true)).ok).toBe(true);
    const lib = await loadLibrary(ctx);
    expect(lib.archivedProjects.map((p) => p.projectId)).toContain(created.projectId);
    expect(lib.published.find((p) => p.definition.id === plan.definitionId)?.archived).toBe(true);
    expect(count(storage, 'SELECT count(*) FROM card_versions WHERE definition_id = ?', [plan.definitionId])).toBe(1);
    const content = await reindexCustomCatalog(ctx, ctx.snapshot.get()!.profile.profileId);
    expect(releaseView(content, plan.definitionId, 1)?.definition.name).toBe('Arquivado');
  });
});
