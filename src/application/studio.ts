// Casos de uso do Estúdio de Cartas (editor-de-cartas.md §3–§30; persistencia §13, §18, §19, §24):
// projetos e revisões com CAS (escritas leves, sem `operations`), publicação atômica num único
// PUBLISH_CARD, concessão auditável GRANT_CUSTOM_COPIES para perfis CUSTOM/LAB, arquivamento, execuções do
// laboratório (card_test_runs append-only), assets BLOB e montagem/planejamento de importação/exportação.
// Nada aqui toca DOM, SQL ou ZIP: bytes de pacote são lidos/escritos pela infraestrutura (files/cardpack.ts).
import { searchKeyV1 } from '../domain/cards/naming.ts';
import type { CardDefinition, CardPrinting, PokemonType } from '../domain/cards/types.ts';
import { definitionKey } from '../domain/cards/types.ts';
import { compileDraft, plainJson, type CompiledPrinting } from '../domain/editor/compile.ts';
import { extractDependencies, type DependencyRef } from '../domain/editor/dependencies.ts';
import { diffRules, type Change } from '../domain/editor/diff.ts';
import {
  draftAssetRefs, draftFromSource, newDefinitionDraft, newDefinitionId, newPrintingId, RULESET_ID, withBaseName, type CardTemplateKind, type EditorDraft, type ProjectMode,
  type TestScenario,
} from '../domain/editor/draft.ts';
import {
  buildCardJson, buildManifest, classifyImport, remapAsCopy, type AssetRef, type CardImportItem, type CardJsonDoc, type CardpackManifest,
  type PrintingImportItem,
} from '../domain/editor/formats.ts';
import { KEEP_AUTO_REVISIONS } from '../domain/editor/autosave.ts';
import { LAB_RUNNER_VERSION, runLabScenario, type LabResult } from '../domain/editor/lab.ts';
import { summarize, validateDefinition, validateDraft, VALIDATOR_VERSION, type ValidationContext, type ValidationReport, type ValidationSummary } from '../domain/editor/validate.ts';
import { ENGINE_VERSION } from '../domain/battle/setup.ts';
import { jcsHash } from '../domain/hash/jcs.ts';
import { indexContent, type ContentIndex } from './content.ts';
import { reloadSnapshot, requireSnapshot, type GameContext } from './context.ts';
import type { JsonValue, Mutation, ProfileSnapshot, QueryResultMap, StorageError } from './ports/storage.ts';

export type StudioError = { readonly ok: false; readonly code: string; readonly message: string };
const err = (code: string, message: string): StudioError => ({ ok: false, code, message });
const asJson = (value: unknown): JsonValue => plainJson(value) as JsonValue;

export function isStudioError(value: unknown): value is StudioError {
  return typeof value === 'object' && value !== null && (value as { ok?: unknown }).ok === false;
}

function fromStorage(e: StorageError): StudioError {
  return err(e.code, e.message);
}

// ---------------------------------------------------------------- catálogo local (base + autorais do perfil)

export function catalogDefinitions(content: ContentIndex): CardDefinition[] {
  return [...content.catalog.definitions.values()];
}

export function catalogPrintings(content: ContentIndex): CardPrinting[] {
  return [...content.catalog.printings.values()];
}

export function printingsOf(content: ContentIndex, definitionId: string, version: number): CardPrinting[] {
  return catalogPrintings(content).filter((p) => p.cardDefinitionId === definitionId && p.cardDefinitionVersion === version);
}

export function isBaseDefinition(content: ContentIndex, definitionId: string): boolean {
  return content.bundle.cards.some((c) => c.id === definitionId);
}

/** Mesma reindexação de boot.refreshCustomCatalog, para uso sem UI (testes, importação). */
export async function customCatalogContent(ctx: GameContext, profileId: string | null): Promise<ContentIndex> {
  const custom = await ctx.storage.query({ kind: 'CUSTOM_CATALOG', profileId });
  const bundle = ctx.content.get().bundle;
  const baseIds = new Set(bundle.cards.map((c) => definitionKey(c.id, c.version)));
  const basePrintings = new Set(bundle.printings.map((p) => p.printingId));
  const definitions = custom.versions.map((v) => v.rules as unknown as CardDefinition).filter((d) => !baseIds.has(definitionKey(d.id, d.version)));
  const printings = custom.printings.map((p) => p.appearance as unknown as CardPrinting).filter((p) => !basePrintings.has(p.printingId));
  return indexContent(bundle, { definitions, printings });
}

export async function reindexCustomCatalog(ctx: GameContext, profileId: string | null): Promise<ContentIndex> {
  const next = await customCatalogContent(ctx, profileId);
  ctx.content.set(next);
  return next;
}

// ---------------------------------------------------------------- biblioteca (S43)

export type ProjectRow = QueryResultMap['LIST_PROJECTS'][number];
export type PublishedVersion = {
  readonly definition: CardDefinition;
  readonly archived: boolean;
  readonly head: boolean;
  readonly printings: readonly { readonly printing: CardPrinting; readonly archived: boolean }[];
};

export type Library = {
  readonly projects: readonly ProjectRow[];
  readonly archivedProjects: readonly ProjectRow[];
  readonly published: readonly PublishedVersion[];
  readonly base: readonly { readonly definition: CardDefinition; readonly printings: readonly CardPrinting[] }[];
};

export async function loadLibrary(ctx: GameContext): Promise<Library> {
  const snap = requireSnapshot(ctx);
  const [projects, custom] = await Promise.all([
    ctx.storage.query({ kind: 'LIST_PROJECTS', profileId: snap.profile.profileId, includeArchived: true }),
    ctx.storage.query({ kind: 'CUSTOM_CATALOG', profileId: snap.profile.profileId }),
  ]);
  const printings = custom.printings.map((p) => ({ printing: p.appearance as unknown as CardPrinting, archived: p.archived }));
  const published = custom.versions.map((v) => {
    const definition = v.rules as unknown as CardDefinition;
    return {
      definition, archived: v.archived, head: custom.heads[v.definitionId] === v.version,
      printings: printings.filter((p) => p.printing.cardDefinitionId === v.definitionId && p.printing.cardDefinitionVersion === v.version),
    };
  });
  const bundle = ctx.content.get().bundle;
  return {
    projects: projects.filter((p) => p.status !== 'ARCHIVED'),
    archivedProjects: projects.filter((p) => p.status === 'ARCHIVED'),
    published,
    base: bundle.cards.map((definition) => ({ definition, printings: bundle.printings.filter((p) => p.cardDefinitionId === definition.id && p.cardDefinitionVersion === definition.version) })),
  };
}

/** Busca por search-key-v1 (sem diacríticos, minúsculas), sem renderizar cartas. */
export function matchesSearch(text: string, query: string): boolean {
  const q = searchKeyV1(query);
  return !q || searchKeyV1(text).includes(q);
}

export function summaryOf(value: JsonValue): { readonly errors: number; readonly warnings: number } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const errors = (value as Record<string, JsonValue>).errors;
  const warnings = (value as Record<string, JsonValue>).warnings;
  return typeof errors === 'number' && typeof warnings === 'number' ? { errors, warnings } : null;
}

// ---------------------------------------------------------------- projetos e revisões

export type ProjectState = {
  readonly ok: true;
  readonly projectId: string;
  readonly profileId: string;
  readonly title: string;
  readonly mode: ProjectMode;
  readonly status: 'DRAFT' | 'ARCHIVED';
  readonly headRevision: number;
  readonly targetDefinitionId: string | null;
  readonly sourceDefinitionId: string | null;
  readonly sourceVersion: number | null;
  readonly revision: number;
  readonly revisionKind: string;
  readonly draft: EditorDraft;
  readonly validationSummary: JsonValue;
  readonly revisions: readonly { readonly revision: number; readonly kind: string; readonly createdAt: string }[];
};

export function parseDraft(value: JsonValue | null): EditorDraft | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const d = value as Record<string, unknown>;
  if (d.draftFormat !== 1 || typeof d.mode !== 'string' || !d.target || !d.rules || !Array.isArray(d.printings)) return null;
  return {
    draftFormat: 1, mode: d.mode as ProjectMode, target: d.target as EditorDraft['target'], rules: d.rules as CardDefinition,
    printings: d.printings as CardPrinting[], authoring: (d.authoring ?? { notes: '', setId: 'custom-lab' }) as EditorDraft['authoring'],
    testScenarios: (Array.isArray(d.testScenarios) ? d.testScenarios : []) as TestScenario[],
  };
}

export async function loadProject(ctx: GameContext, projectId: string, revision: number | null = null): Promise<ProjectState | StudioError> {
  const row = await ctx.storage.query({ kind: 'GET_PROJECT', projectId, revision });
  if (!row) return err('NOT_FOUND', 'Projeto ou revisão não encontrado.');
  const draft = parseDraft(row.draft);
  if (!draft) return err('DRAFT_UNREADABLE', 'O rascunho desta revisão não pôde ser lido; abra uma revisão anterior.');
  return {
    ok: true, projectId: row.projectId, profileId: row.profileId, title: row.title, mode: row.mode as ProjectMode, status: row.status as 'DRAFT' | 'ARCHIVED',
    headRevision: row.headRevision, targetDefinitionId: row.targetDefinitionId, sourceDefinitionId: row.sourceDefinitionId, sourceVersion: row.sourceVersion,
    revision: row.revision, revisionKind: row.revisionKind, draft, validationSummary: row.validationSummary, revisions: row.revisions,
  };
}

/** Versões publicadas (qualquer dono) de uma definição, e o dono. */
async function publishedVersions(ctx: GameContext, definitionId: string): Promise<{ readonly versions: readonly CardDefinition[]; readonly owner: string | null; readonly base: boolean }> {
  const content = ctx.content.get();
  if (isBaseDefinition(content, definitionId)) {
    return { versions: content.bundle.cards.filter((c) => c.id === definitionId), owner: null, base: true };
  }
  const all = await ctx.storage.query({ kind: 'CUSTOM_CATALOG', profileId: null });
  const rows = all.versions.filter((v) => v.definitionId === definitionId);
  return { versions: rows.map((v) => v.rules as unknown as CardDefinition), owner: rows[0]?.ownerProfileId ?? null, base: false };
}

/** Assets referenciados pelo rascunho que existem no armazenamento local (para ASSET_MISSING e editor_asset_refs). */
export async function knownAssetIds(ctx: GameContext, draft: EditorDraft): Promise<Set<string>> {
  const ids = [...new Set(draftAssetRefs(draft).map((r) => r.assetId))];
  const found = await Promise.all(ids.map(async (assetId) => ((await ctx.storage.query({ kind: 'GET_ASSET', assetId })) ? assetId : null)));
  return new Set(found.filter((x): x is string => x !== null));
}

export async function validationContextFor(ctx: GameContext, project: Pick<ProjectState, 'mode' | 'sourceDefinitionId' | 'sourceVersion'>, draft: EditorDraft): Promise<ValidationContext> {
  const content = ctx.content.get();
  const catalog = catalogDefinitions(content);
  const sourceRules = project.sourceDefinitionId && project.sourceVersion !== null
    ? catalog.find((d) => d.id === project.sourceDefinitionId && d.version === project.sourceVersion) ?? null : null;
  let publishedTarget: CardDefinition | null = null;
  if (project.mode === 'NEW_DEFINITION' || project.mode === 'FORK') {
    const versions = catalog.filter((d) => d.id === draft.target.definitionId);
    publishedTarget = versions.sort((a, b) => b.version - a.version)[0] ?? null;
  }
  const assets = await knownAssetIds(ctx, draft);
  const assetInfo = new Map<string, { width: number | null; height: number | null }>();
  for (const assetId of assets) {
    const a = await ctx.storage.query({ kind: 'GET_ASSET', assetId });
    if (a) assetInfo.set(assetId, { width: a.width, height: a.height });
  }
  return { catalog, sourceRules, publishedTarget, knownAssetIds: assets, assetInfo };
}

export async function validateProject(ctx: GameContext, project: Pick<ProjectState, 'mode' | 'sourceDefinitionId' | 'sourceVersion'>, draft: EditorDraft): Promise<ValidationReport> {
  return validateDraft(draft, await validationContextFor(ctx, project, draft));
}

export type CreateProjectInput =
  | { readonly mode: 'NEW_DEFINITION'; readonly template: CardTemplateKind; readonly baseName: string; readonly type?: PokemonType; readonly setId?: string }
  | { readonly mode: 'NEW_VERSION' | 'VARIANT' | 'FORK'; readonly sourceDefinitionId: string; readonly sourceVersion: number; readonly baseName?: string; readonly setId?: string };

function tokenOf(id: string): string {
  return id.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(-8) || '0';
}

/** Cria o projeto (CREATE_EDITOR_PROJECT) e a primeira revisão MANUAL com o resumo de validação (ED-001). */
export async function createProject(ctx: GameContext, input: CreateProjectInput): Promise<{ readonly ok: true; readonly projectId: string; readonly draft: EditorDraft } | StudioError> {
  const snap = requireSnapshot(ctx);
  const content = ctx.content.get();
  const projectId = ctx.platform.newId('project');
  const token = tokenOf(projectId);
  let draft: EditorDraft;
  let source: { id: string; version: number } | null = null;
  if (input.mode === 'NEW_DEFINITION') {
    const baseName = input.baseName.trim();
    if (!baseName || [...baseName].length > 50) return err('BASE_NAME_INVALID', 'Nome-base deve ter de 1 a 50 caracteres.');
    draft = newDefinitionDraft({ template: input.template, baseName, type: input.type, definitionId: newDefinitionId(baseName, token), token, setId: input.setId });
  } else {
    const sourceDef = catalogDefinitions(content).find((d) => d.id === input.sourceDefinitionId && d.version === input.sourceVersion);
    if (!sourceDef) return err('SOURCE_MISSING', 'A versão de origem não está no catálogo local (recuperação necessária).');
    const base = isBaseDefinition(content, sourceDef.id);
    if (base && input.mode === 'NEW_VERSION') return err('BASE_READ_ONLY', 'O catálogo base é somente leitura: use “Editar como cópia” (fork).');
    const published = await publishedVersions(ctx, sourceDef.id);
    if (!base && input.mode === 'NEW_VERSION' && published.owner !== snap.profile.profileId) return err('NOT_OWNER', 'Só o perfil autor cria novas versões desta carta; use uma cópia (fork).');
    const latestVersion = Math.max(...published.versions.map((v) => v.version), sourceDef.version);
    draft = draftFromSource({
      mode: input.mode, source: sourceDef, sourcePrintings: printingsOf(content, sourceDef.id, sourceDef.version), latestVersion,
      forkDefinitionId: input.mode === 'FORK' ? newDefinitionId(input.baseName?.trim() || sourceDef.baseName, token) : undefined, token, setId: input.setId,
    });
    if (input.mode === 'FORK' && input.baseName?.trim()) draft = { ...draft, rules: withBaseName(draft.rules, input.baseName.trim()) };
    source = { id: sourceDef.id, version: sourceDef.version };
  }
  const created = await ctx.storage.write({
    kind: 'CREATE_EDITOR_PROJECT', profileId: snap.profile.profileId, projectId, title: titleOf(draft), mode: draft.mode,
    targetDefinitionId: draft.target.definitionId, sourceDefinitionId: source?.id ?? null, sourceVersion: source?.version ?? null, writerEpoch: snap.profile.writerEpoch,
  });
  if (!created.ok) return fromStorage(created);
  const saved = await saveRevision(ctx, { projectId, headRevision: 0, mode: draft.mode, sourceDefinitionId: source?.id ?? null, sourceVersion: source?.version ?? null }, draft, 'MANUAL');
  if (!saved.ok) return saved;
  return { ok: true, projectId, draft };
}

/**
 * “Continuar em novo rascunho” (§27): depois de uma publicação, o alvo de NEW_DEFINITION/NEW_VERSION/FORK passa a
 * ser a próxima versão (última publicada + 1). VARIANT mantém a versão de origem. Testes rodam sobre este alvo.
 */
export function alignDraftTarget(content: ContentIndex, draft: EditorDraft): EditorDraft {
  if (draft.mode === 'VARIANT') return draft;
  const latest = Math.max(0, ...catalogDefinitions(content).filter((d) => d.id === draft.target.definitionId).map((d) => d.version));
  if (draft.target.version > latest) return draft;
  const version = latest + 1;
  return { ...draft, target: { ...draft.target, version }, rules: { ...draft.rules, version } as CardDefinition };
}

/**
 * Duplicar um projeto ainda não publicado: novo projeto NEW_DEFINITION com novos IDs (definição, impressões),
 * mesmas regras/arte/cenários. Para cartas já publicadas, “Duplicar como nova carta” usa FORK (com origem).
 */
export async function duplicateProject(ctx: GameContext, source: Pick<ProjectState, 'draft'>): Promise<{ readonly ok: true; readonly projectId: string; readonly draft: EditorDraft } | StudioError> {
  const snap = requireSnapshot(ctx);
  const projectId = ctx.platform.newId('project');
  const token = tokenOf(projectId);
  const definitionId = newDefinitionId(source.draft.rules.baseName || 'carta', token);
  const printings = source.draft.printings.map((p, i) => ({ ...p, printingId: newPrintingId(definitionId, p.finish, `${token}${i}`), cardDefinitionId: definitionId, cardDefinitionVersion: 1 }));
  const draft: EditorDraft = {
    ...source.draft, mode: 'NEW_DEFINITION', target: { definitionId, version: 1 }, rules: { ...source.draft.rules, id: definitionId, version: 1 } as CardDefinition, printings,
    authoring: { ...source.draft.authoring, maskPaint: undefined },
  };
  const created = await ctx.storage.write({
    kind: 'CREATE_EDITOR_PROJECT', profileId: snap.profile.profileId, projectId, title: titleOf(draft), mode: 'NEW_DEFINITION', targetDefinitionId: definitionId,
    sourceDefinitionId: null, sourceVersion: null, writerEpoch: snap.profile.writerEpoch,
  });
  if (!created.ok) return fromStorage(created);
  const saved = await saveRevision(ctx, { projectId, headRevision: 0, mode: 'NEW_DEFINITION', sourceDefinitionId: null, sourceVersion: null }, plainJson(draft), 'MANUAL');
  if (!saved.ok) return saved;
  return { ok: true, projectId, draft };
}

export function titleOf(draft: EditorDraft): string {
  const name = (draft.rules?.name || draft.rules?.baseName || 'Carta sem nome').trim();
  return [...name].slice(0, 60).join('') || 'Carta sem nome';
}

export type SaveTarget = Pick<ProjectState, 'projectId' | 'headRevision' | 'mode' | 'sourceDefinitionId' | 'sourceVersion'>;

/**
 * SAVE_EDITOR_REVISION com CAS em head_revision (sem `operations`): grava o rascunho, o resumo de validação
 * e as referências de assets existentes; poda AUTO excedentes (20 mais recentes, persistencia §19).
 */
export async function saveRevision(ctx: GameContext, target: SaveTarget, draft: EditorDraft, kind: 'AUTO' | 'MANUAL', report?: ValidationReport): Promise<{ readonly ok: true; readonly revision: number; readonly summary: ValidationSummary } | StudioError> {
  const snap = requireSnapshot(ctx);
  const validation = report ?? await validateProject(ctx, target, draft);
  const known = await knownAssetIds(ctx, draft);
  const revision = target.headRevision + 1;
  const summary = summarize(validation);
  const result = await ctx.storage.write({
    kind: 'SAVE_EDITOR_REVISION', projectId: target.projectId, expectedHead: target.headRevision, revision, revisionKind: kind,
    draft: asJson(draft), validationSummary: asJson(summary), assetRefs: draftAssetRefs(draft).filter((r) => known.has(r.assetId)),
    keepAutoRevisions: KEEP_AUTO_REVISIONS, writerEpoch: snap.profile.writerEpoch,
  });
  if (!result.ok) return fromStorage(result);
  return { ok: true, revision, summary };
}

export async function setProjectArchived(ctx: GameContext, projectId: string, archived: boolean): Promise<{ readonly ok: true } | StudioError> {
  const snap = requireSnapshot(ctx);
  const r = await ctx.storage.write({ kind: 'SET_PROJECT_STATUS', projectId, status: archived ? 'ARCHIVED' : 'DRAFT', writerEpoch: snap.profile.writerEpoch });
  return r.ok ? { ok: true } : fromStorage(r);
}

// ---------------------------------------------------------------- publicação (§27; persistencia §18)

export type TestEvidence = { readonly scenarioId: string; readonly outcome: string; readonly runId: string } ;

export type PublishPlan = {
  readonly commandId: string;
  readonly projectId: string;
  readonly mode: ProjectMode;
  readonly definitionId: string;
  readonly version: number;
  readonly createsDefinition: boolean;
  readonly createsVersion: boolean;
  readonly publishedRevision: number;
  readonly definition: CardDefinition;
  readonly rulesHash: string;
  readonly printings: readonly CompiledPrinting[];
  readonly dependencies: readonly DependencyRef[];
  readonly report: ValidationReport;
  readonly diff: readonly Change[];
  readonly previous: CardDefinition | null;
  readonly tests: readonly TestEvidence[];
  readonly assets: readonly string[];
  readonly expectedRevision: number;
  readonly writerEpoch: number;
  readonly mutations: readonly Mutation[];
  readonly payload: JsonValue;
  readonly summary: JsonValue;
  readonly publishedDraft: EditorDraft;
};

export type PublishBlocked = {
  readonly ok: false; readonly code: 'VALIDATION_FAILED' | 'TESTS_REQUIRED' | 'NOT_OWNER' | 'SOURCE_MISSING' | 'HEAD_STALE'; readonly message: string;
  readonly report?: ValidationReport; readonly failingTests?: readonly string[];
};

/** Testes obrigatórios = cenários do rascunho; cada um precisa de PASS com o rulesHash atual (persistencia §18). */
export function testsStatus(scenarios: readonly TestScenario[], runs: QueryResultMap['LIST_TEST_RUNS'], rulesHash: string): { readonly evidence: TestEvidence[]; readonly missing: string[] } {
  const evidence: TestEvidence[] = [];
  const missing: string[] = [];
  for (const s of scenarios) {
    const latest = runs.filter((r) => r.rulesHash === rulesHash && (r.scenario as { id?: string } | null)?.id === s.id).at(-1);
    if (latest && latest.outcome === 'PASS') evidence.push({ scenarioId: s.id, outcome: latest.outcome, runId: latest.runId });
    else missing.push(s.id);
  }
  return { evidence, missing };
}

/**
 * Prepara a publicação fora da transação: valida, compila (JCS/hashes), decide versão, impressões,
 * dependências e o lote ordenado de mutações. Guardar o plano permite reenviar o MESMO comando após
 * resposta perdida (idempotência por commandId; ED-058).
 */
export async function preparePublish(ctx: GameContext, project: SaveTarget, draft: EditorDraft, options: { readonly versionOverride?: number; readonly skipTests?: boolean } = {}): Promise<{ readonly ok: true; readonly plan: PublishPlan } | PublishBlocked | StudioError> {
  const snap = requireSnapshot(ctx);
  const content = ctx.content.get();
  const report = await validateProject(ctx, project, draft);
  if (!report.publishable) return { ok: false, code: 'VALIDATION_FAILED', message: `${report.errors} erro(s) impedem a publicação.`, report };
  const target = draft.target.definitionId;
  const published = await publishedVersions(ctx, target);
  if (published.base && draft.mode !== 'VARIANT') return { ok: false, code: 'NOT_OWNER', message: 'IDs do catálogo base são somente leitura.' };
  if (!published.base && published.versions.length && published.owner !== snap.profile.profileId && draft.mode !== 'VARIANT') {
    return { ok: false, code: 'NOT_OWNER', message: 'Esta definição pertence a outro perfil: publique uma cópia (fork).' };
  }
  const latest = published.versions.reduce<CardDefinition | null>((best, d) => (!best || d.version > best.version ? d : best), null);
  const variant = draft.mode === 'VARIANT';
  if (variant && !published.versions.some((v) => v.version === draft.target.version)) return { ok: false, code: 'SOURCE_MISSING', message: 'A versão de origem da variante não existe no catálogo.' };
  const version = variant ? draft.target.version : options.versionOverride ?? (latest ? latest.version + 1 : 1);
  const runs = await ctx.storage.query({ kind: 'LIST_TEST_RUNS', projectId: project.projectId });
  const existingPrintings = new Set(catalogPrintings(content).map((p) => p.printingId));
  const compiled = compileDraft(draft, { version, existingPrintingIds: existingPrintings });
  const tests = testsStatus(draft.testScenarios, runs, compiled.rulesHash);
  if (!variant && !options.skipTests && tests.missing.length) {
    return { ok: false, code: 'TESTS_REQUIRED', message: `Execute e aprove no laboratório: ${tests.missing.join(', ')}.`, failingTests: tests.missing };
  }
  const definition = variant ? (latest && latest.version === version ? latest : published.versions.find((v) => v.version === version)!) : compiled.definition;
  const rulesHash = jcsHash(definition);
  const createsDefinition = !variant && published.versions.length === 0;
  const createsVersion = !variant;
  const publishedRevision = project.headRevision + 1;
  const catalogDefs = catalogDefinitions(content);
  const dependencies = variant ? [] : extractDependencies(definition, {
    findByDeckLimitKey: (key) => catalogDefs.filter((d) => d.deckLimitKey === key),
    headVersion: (id) => Math.max(...catalogDefs.filter((d) => d.id === id).map((d) => d.version)),
  });
  // Cópia imutável do rascunho publicado, com os IDs de impressão efetivamente gravados.
  const publishedDraft: EditorDraft = { ...draft, target: { definitionId: target, version }, rules: variant ? draft.rules : definition, printings: compiled.printings.map((p) => p.printing) };
  const assets = [...new Set(compiled.printings.flatMap((p) => p.printing.assetBindings.map((b) => b.assetId)))];
  const summary = summarize(report);
  const mutations: Mutation[] = [];
  if (createsDefinition) mutations.push({ kind: 'INSERT_CARD_DEFINITION', definitionId: target, namespace: 'CUSTOM' });
  if (createsVersion) {
    mutations.push({ kind: 'INSERT_CARD_VERSION', definitionId: target, version, rules: asJson(definition), rulesHash, rulesetId: RULESET_ID, searchKey: searchKeyV1(definition.name).slice(0, 120) || 'carta' });
  }
  mutations.push({
    kind: 'INSERT_EDITOR_REVISION_PUBLISHED', projectId: project.projectId, revision: publishedRevision, draft: asJson(publishedDraft),
    validationSummary: asJson(summary), assetRefs: draftAssetRefs(publishedDraft).filter((r) => assets.includes(r.assetId)),
  });
  if (createsVersion) {
    mutations.push({
      kind: 'INSERT_PUBLICATION', definitionId: target, version, validatorVersion: VALIDATOR_VERSION, projectId: project.projectId, projectRevision: publishedRevision,
      report: asJson({ ...summary, warnings: report.issues.filter((i) => i.severity === 'WARNING').slice(0, 50).map((i) => ({ code: i.code, message: i.message })), tests: tests.evidence }),
    });
  }
  for (const p of compiled.printings) {
    mutations.push({ kind: 'INSERT_PRINTING', printingId: p.printing.printingId, definitionId: target, definitionVersion: version, appearance: asJson(p.printing), appearanceHash: p.appearanceHash });
  }
  for (const d of dependencies) {
    mutations.push({ kind: 'INSERT_CARD_DEPENDENCY', definitionId: target, version, dependencyId: d.dependencyId, dependencyVersion: d.dependencyVersion, dependencyKind: d.kind });
  }
  if (createsVersion && (!latest || version > latest.version)) mutations.push({ kind: 'SET_CATALOG_HEAD', definitionId: target, version });
  const printingIds = compiled.printings.map((p) => p.printing.printingId);
  const payload = asJson({
    projectId: project.projectId, projectRevision: publishedRevision, mode: draft.mode, definitionId: target, version, rulesHash,
    appearanceHashes: compiled.printings.map((p) => p.appearanceHash),
  });
  return {
    ok: true,
    plan: {
      commandId: ctx.platform.newId('cmd'), projectId: project.projectId, mode: draft.mode, definitionId: target, version, createsDefinition, createsVersion,
      publishedRevision, definition, rulesHash, printings: compiled.printings, dependencies, report, previous: variant ? null : latest,
      diff: variant ? [] : diffRules(latest, definition), tests: tests.evidence, assets, expectedRevision: snap.profile.revision,
      writerEpoch: snap.profile.writerEpoch, mutations, payload, publishedDraft,
      summary: asJson({ mode: draft.mode, definitionId: target, version, name: definition.name, printingIds, projectId: project.projectId }),
    },
  };
}

export type PublishResult = {
  readonly ok: true;
  readonly status: 'COMMITTED' | 'REPLAYED';
  readonly definitionId: string;
  readonly version: number;
  readonly printingIds: readonly string[];
  readonly publishedRevision: number;
  readonly operationId: string;
};

/** Um único PUBLISH_CARD atômico (ED-057). Reenviar o mesmo plano devolve o recibo sem duplicar (ED-058). */
export async function commitPublish(ctx: GameContext, plan: PublishPlan): Promise<PublishResult | StudioError> {
  const snap = requireSnapshot(ctx);
  const result = await ctx.bus.execute({
    commandType: 'PUBLISH_CARD', profileId: snap.profile.profileId, expectedRevision: plan.expectedRevision, writerEpoch: plan.writerEpoch,
    payload: plan.payload, mutations: plan.mutations, summary: plan.summary, commandId: plan.commandId,
  });
  if (!result.ok) return fromStorage(result);
  await reloadSnapshot(ctx);
  const summary = result.receipt.summary as { definitionId?: string; version?: number; printingIds?: string[] };
  return {
    ok: true, status: result.status, definitionId: summary.definitionId ?? plan.definitionId, version: summary.version ?? plan.version,
    printingIds: summary.printingIds ?? plan.printings.map((p) => p.printing.printingId), publishedRevision: plan.publishedRevision, operationId: result.operationId,
  };
}

// ---------------------------------------------------------------- concessão CUSTOM/LAB (§28)

export function customGrantKey(printingId: string, grantBatchId: string): string {
  return `custom-grant:${printingId}:${grantBatchId}`;
}

export function grantEligibility(snap: ProfileSnapshot, content: ContentIndex, printingId: string): string | null {
  if (snap.profile.progressionMode === 'STANDARD') return 'Perfis STANDARD não recebem cópias autorais: use um perfil CUSTOM ou LAB.';
  if (content.bundle.printings.some((p) => p.printingId === printingId)) return 'Cópias do catálogo base vêm de pacotes e recompensas, não de concessão autoral.';
  if (!content.catalog.printings.has(printingId)) return 'Impressão não publicada neste perfil.';
  return null;
}

/** GRANT_CUSTOM_COPIES com chave `custom-grant:{printingId}:{grantBatchId}`: repetir o mesmo lote não duplica (ED-060). */
export async function grantCustomCopies(ctx: GameContext, input: { readonly printingId: string; readonly quantity?: number; readonly grantBatchId: string; readonly commandId?: string }): Promise<{ readonly ok: true; readonly status: 'COMMITTED' | 'REPLAYED' | 'ALREADY_GRANTED'; readonly quantity: number } | StudioError> {
  const snap = requireSnapshot(ctx);
  const content = ctx.content.get();
  const blocked = grantEligibility(snap, content, input.printingId);
  if (blocked) return err('GRANT_NOT_ALLOWED', blocked);
  const quantity = Math.trunc(input.quantity ?? 2);
  if (quantity < 1 || quantity > 20) return err('GRANT_QUANTITY_INVALID', 'Quantidade de 1 a 20 cópias.');
  const grantKey = customGrantKey(input.printingId, input.grantBatchId);
  const result = await ctx.bus.execute({
    commandType: 'GRANT_CUSTOM_COPIES', profileId: snap.profile.profileId, expectedRevision: snap.profile.revision, writerEpoch: snap.profile.writerEpoch,
    payload: { printingId: input.printingId, quantity, grantBatchId: input.grantBatchId }, mutations: [{ kind: 'INVENTORY_DELTA', printingId: input.printingId, delta: quantity }],
    grantKeys: [grantKey], summary: { printingId: input.printingId, quantity, grantBatchId: input.grantBatchId }, ...(input.commandId ? { commandId: input.commandId } : {}),
  });
  if (!result.ok) {
    if (result.code === 'REWARD_ALREADY_GRANTED') return { ok: true, status: 'ALREADY_GRANTED', quantity: 0 };
    return fromStorage(result);
  }
  await reloadSnapshot(ctx);
  return { ok: true, status: result.status, quantity };
}

// ---------------------------------------------------------------- arquivamento de versão/impressão (§27)

export async function setCatalogArchived(ctx: GameContext, entityKind: 'VERSION' | 'PRINTING', entityId: string, entityVersion: number, archived: boolean): Promise<{ readonly ok: true } | StudioError> {
  const snap = requireSnapshot(ctx);
  const result = await ctx.bus.execute({
    commandType: 'ARCHIVE_ENTITY', profileId: snap.profile.profileId, expectedRevision: snap.profile.revision, writerEpoch: snap.profile.writerEpoch,
    payload: { entityKind, entityId, entityVersion, archived }, mutations: [{ kind: 'ARCHIVE_MARK', entityKind, entityId, entityVersion, archived }],
    summary: { entityKind, entityId, entityVersion, archived },
  });
  if (!result.ok) return fromStorage(result);
  await reloadSnapshot(ctx);
  return { ok: true };
}

// ---------------------------------------------------------------- assets (§18, §21)

export type AssetInput = { readonly assetId: string; readonly mediaType: string; readonly bytes: Uint8Array; readonly width: number | null; readonly height: number | null; readonly metadata: JsonValue };

/** BLOB imutável endereçado pelo SHA-256 (o worker confere o hash); reimportar o mesmo arquivo reutiliza a linha. */
export async function storeAsset(ctx: GameContext, asset: AssetInput): Promise<{ readonly ok: true } | StudioError> {
  const r = await ctx.storage.write({ kind: 'INSERT_ASSET_BLOB', ...asset });
  return r.ok ? { ok: true } : fromStorage(r);
}

export async function loadAsset(ctx: GameContext, assetId: string): Promise<QueryResultMap['GET_ASSET']> {
  return ctx.storage.query({ kind: 'GET_ASSET', assetId });
}

// ---------------------------------------------------------------- laboratório (§25)

export type RunOutcome = { readonly ok: true; readonly runId: string; readonly result: LabResult };

/** Executa o cenário no motor real e grava uma linha append-only em card_test_runs (RUN_CARD_TEST, sem `operations`). */
export async function runProjectScenario(ctx: GameContext, projectId: string, revision: number, draft: EditorDraft, scenario: TestScenario): Promise<RunOutcome | StudioError> {
  if (revision < 1) return err('REVISION_REQUIRED', 'Salve o rascunho antes de testar.');
  const content = ctx.content.get();
  const compiled = compileDraft(draft);
  const printing = compiled.printings[0]?.printing;
  if (!printing) return err('PRINTING_REQUIRED', 'Crie uma impressão para registrar a carta no laboratório.');
  const result = runLabScenario({
    definition: compiled.definition, printing, scenario, rulesHash: compiled.rulesHash,
    catalog: { definitions: catalogDefinitions(content), printings: catalogPrintings(content) },
  });
  const runId = ctx.platform.newId('run');
  const write = await ctx.storage.write({
    kind: 'INSERT_TEST_RUN', runId, projectId, revision, runnerVersion: LAB_RUNNER_VERSION, rulesHash: compiled.rulesHash,
    scenario: asJson(scenario), result: asJson(result), outcome: result.outcome,
  });
  if (!write.ok) return fromStorage(write);
  return { ok: true, runId, result };
}

export async function listTestRuns(ctx: GameContext, projectId: string): Promise<QueryResultMap['LIST_TEST_RUNS']> {
  return ctx.storage.query({ kind: 'LIST_TEST_RUNS', projectId });
}

// ---------------------------------------------------------------- exportação (§29)

export async function assetRefsOf(ctx: GameContext, printings: readonly CardPrinting[]): Promise<{ readonly refs: AssetRef[]; readonly bytes: Map<string, { mediaType: string; bytes: Uint8Array }> }> {
  const ids = [...new Set(printings.flatMap((p) => p.assetBindings.map((b) => b.assetId)))];
  const refs: AssetRef[] = [];
  const bytes = new Map<string, { mediaType: string; bytes: Uint8Array }>();
  for (const assetId of ids) {
    const a = await ctx.storage.query({ kind: 'GET_ASSET', assetId });
    if (!a) continue;
    refs.push({ sha256: a.assetId, bytes: a.bytes.length, mediaType: a.mediaType });
    bytes.set(a.assetId, { mediaType: a.mediaType, bytes: a.bytes });
  }
  return { refs, bytes };
}

export async function exportCardJson(ctx: GameContext, definitionId: string, version: number): Promise<CardJsonDoc | StudioError> {
  const content = ctx.content.get();
  const def = catalogDefinitions(content).find((d) => d.id === definitionId && d.version === version);
  if (!def) return err('NOT_FOUND', 'Versão não encontrada no catálogo local.');
  const printings = printingsOf(content, definitionId, version);
  const { refs } = await assetRefsOf(ctx, printings);
  return buildCardJson(def, printings, refs);
}

export type PackTestFile = {
  readonly testId: string;
  readonly definitionId: string;
  readonly version: number;
  readonly rulesHash: string;
  readonly scenario: TestScenario;
  readonly outcome: string;
  readonly result: JsonValue;
};

export type CardpackContents = {
  readonly manifest: CardpackManifest;
  readonly cards: readonly CardDefinition[];
  readonly printings: readonly CardPrinting[];
  readonly assets: readonly { readonly sha256: string; readonly mediaType: string; readonly bytes: Uint8Array }[];
  readonly tests: readonly PackTestFile[];
};

/** Conteúdo do `.cardpack.zip`: definições, impressões, assets e testes aprovados — nunca carteira, progresso ou recibos (ED-064). */
export async function collectCardpack(ctx: GameContext, keys: readonly { readonly definitionId: string; readonly version: number }[]): Promise<CardpackContents | StudioError> {
  const content = ctx.content.get();
  const defs = catalogDefinitions(content);
  const cards: CardDefinition[] = [];
  for (const k of keys) {
    const d = defs.find((x) => x.id === k.definitionId && x.version === k.version);
    if (!d) return err('NOT_FOUND', `${k.definitionId} v${k.version} não está no catálogo local.`);
    cards.push(d);
  }
  const printings = cards.flatMap((c) => printingsOf(content, c.id, c.version));
  const { refs, bytes } = await assetRefsOf(ctx, printings);
  const tests: PackTestFile[] = [];
  const snap = ctx.snapshot.get();
  if (snap) {
    const projects = await ctx.storage.query({ kind: 'LIST_PROJECTS', profileId: snap.profile.profileId, includeArchived: true });
    for (const card of cards) {
      const hash = jcsHash(card);
      for (const p of projects.filter((x) => x.targetDefinitionId === card.id)) {
        const runs = await ctx.storage.query({ kind: 'LIST_TEST_RUNS', projectId: p.projectId });
        const latestById = new Map<string, (typeof runs)[number]>();
        for (const r of runs) if (r.rulesHash === hash) latestById.set(String((r.scenario as { id?: string } | null)?.id ?? r.runId), r);
        for (const [scenarioId, r] of latestById) {
          const testId = `${card.id}-v${card.version}-${scenarioId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 64).replace(/-+$/, '');
          if (tests.some((t) => t.testId === testId)) continue;
          tests.push({ testId, definitionId: card.id, version: card.version, rulesHash: hash, scenario: r.scenario as unknown as TestScenario, outcome: r.outcome, result: r.result });
        }
      }
    }
  }
  const manifest = buildManifest({ engineVersion: ENGINE_VERSION, cards, printings, assets: refs, tests: tests.map((t) => ({ testId: t.testId, definitionId: t.definitionId, version: t.version, rulesHash: t.rulesHash })) });
  return { manifest, cards, printings, assets: refs.map((r) => ({ sha256: r.sha256, mediaType: r.mediaType, bytes: bytes.get(r.sha256)!.bytes })), tests };
}

// ---------------------------------------------------------------- importação (§29)

export type ImportCardDecision = 'IMPORT' | 'COPY' | 'SKIP';

export type ImportCardPlan = {
  readonly item: CardImportItem;
  readonly card: CardDefinition;
  readonly printings: readonly CardPrinting[];
  readonly printingItems: readonly PrintingImportItem[];
  readonly report: ValidationReport;
  readonly diff: readonly Change[];
  /** Decisão padrão: NEW/NEW_VERSION → IMPORT; SAME → IMPORT (só impressões novas); CONFLICT → COPY. */
  readonly defaultDecision: ImportCardDecision;
  readonly allowed: readonly ImportCardDecision[];
};

export type ImportTestReport = { readonly testId: string; readonly definitionId: string; readonly outcome: string; readonly rerun: LabResult | null };

export type ImportPlan = {
  readonly cards: readonly ImportCardPlan[];
  readonly missingAssets: readonly string[];
  readonly tests: readonly ImportTestReport[];
  readonly assets: readonly { readonly sha256: string; readonly mediaType: string; readonly bytes: Uint8Array }[];
};

/** Compara com o catálogo local, valida sem executar e reexecuta testes anexos como relatório (sem card_test_runs). */
export async function planImport(ctx: GameContext, contents: Pick<CardpackContents, 'cards' | 'printings' | 'assets' | 'tests'>): Promise<ImportPlan> {
  const snap = requireSnapshot(ctx);
  const content = ctx.content.get();
  const all = await ctx.storage.query({ kind: 'CUSTOM_CATALOG', profileId: null });
  const localDefs = [...content.bundle.cards, ...all.versions.map((v) => v.rules as unknown as CardDefinition)];
  const localPrintings = [...content.bundle.printings, ...all.printings.map((p) => p.appearance as unknown as CardPrinting)];
  const owners = new Map(all.versions.map((v) => [v.definitionId, v.ownerProfileId]));
  const classified = classifyImport(contents.cards, contents.printings, {
    versionHash: (id, version) => { const d = localDefs.find((x) => x.id === id && x.version === version); return d ? jcsHash(d) : null; },
    definitionNamespace: (id) => (content.bundle.cards.some((c) => c.id === id) ? 'BASE' : owners.has(id) ? 'CUSTOM' : null),
    printingHash: (id) => { const p = localPrintings.find((x) => x.printingId === id); return p ? jcsHash(p) : null; },
  });
  const catalog = [...catalogDefinitions(content)];
  const cards = contents.cards.map((card, i): ImportCardPlan => {
    let item = classified.cards[i]!;
    const owner = owners.get(card.id);
    if (item.status === 'NEW_VERSION') {
      const maxLocal = Math.max(0, ...localDefs.filter((d) => d.id === card.id).map((d) => d.version));
      if (owner !== snap.profile.profileId) item = { ...item, status: 'CONFLICT', reason: 'Definição autoral de outro perfil: importe como cópia.' };
      else if (card.version <= maxLocal) item = { ...item, status: 'CONFLICT', reason: `Versão ${card.version} não sucede a última local (${maxLocal}): importe como cópia.` };
    }
    const printings = contents.printings.filter((p) => p.cardDefinitionId === card.id && p.cardDefinitionVersion === card.version);
    const printingItems = classified.printings.filter((p) => p.definitionId === card.id && printings.some((x) => x.printingId === p.printingId));
    const report = validateDefinition(card, { catalog });
    const previous = localDefs.filter((d) => d.id === card.id).sort((a, b) => b.version - a.version)[0] ?? null;
    const allowed: ImportCardDecision[] = item.status === 'CONFLICT' ? ['COPY', 'SKIP'] : ['IMPORT', 'COPY', 'SKIP'];
    return { item, card, printings, printingItems, report, diff: diffRules(previous, card), defaultDecision: item.status === 'CONFLICT' ? 'COPY' : 'IMPORT', allowed };
  });
  const provided = new Set(contents.assets.map((a) => a.sha256));
  const referenced = [...new Set(contents.printings.flatMap((p) => p.assetBindings.map((b) => b.assetId)))];
  const missingAssets: string[] = [];
  for (const id of referenced) {
    if (provided.has(id)) continue;
    if (!(await ctx.storage.query({ kind: 'GET_ASSET', assetId: id }))) missingAssets.push(id);
  }
  const tests = contents.tests.map((t): ImportTestReport => {
    const card = contents.cards.find((c) => c.id === t.definitionId && c.version === t.version);
    const printing = contents.printings.find((p) => card && p.cardDefinitionId === card.id && p.cardDefinitionVersion === card.version);
    const rerun = card && printing && t.scenario && typeof t.scenario === 'object'
      ? runLabScenario({ definition: card, printing, scenario: t.scenario, rulesHash: jcsHash(card), catalog: { definitions: catalogDefinitions(content), printings: catalogPrintings(content) } })
      : null;
    return { testId: t.testId, definitionId: t.definitionId, outcome: t.outcome, rerun };
  });
  return { cards, missingAssets, tests, assets: contents.assets };
}

export type ImportOutcome = {
  readonly ok: true;
  readonly imported: readonly { readonly definitionId: string; readonly version: number; readonly projectId: string; readonly status: 'COMMITTED' | 'REPLAYED' }[];
  readonly skipped: readonly string[];
  readonly failures: readonly { readonly definitionId: string; readonly message: string }[];
};

/**
 * Confirma a importação: grava assets (hash conferido pelo worker) e publica cada carta por um projeto
 * local (NEW_DEFINITION/NEW_VERSION/VARIANT; cópia = novos IDs com referências remapeadas). Nunca sobrescreve
 * uma versão existente; SAME reutiliza sem duplicar. Nada concede inventário (STANDARD intocado).
 */
export async function applyImport(ctx: GameContext, plan: ImportPlan, decisions: Readonly<Record<string, ImportCardDecision>>): Promise<ImportOutcome | StudioError> {
  if (plan.missingAssets.length) return err('ASSET_MISSING', `Assets ausentes: ${plan.missingAssets.map((a) => a.slice(0, 12)).join(', ')}.`);
  for (const a of plan.assets) {
    const stored = await storeAsset(ctx, { assetId: a.sha256, mediaType: a.mediaType, bytes: a.bytes, width: null, height: null, metadata: { source: 'cardpack' } });
    if (!stored.ok) return stored;
  }
  const imported: { definitionId: string; version: number; projectId: string; status: 'COMMITTED' | 'REPLAYED' }[] = [];
  const skipped: string[] = [];
  const failures: { definitionId: string; message: string }[] = [];
  for (const c of plan.cards) {
    const key = definitionKey(c.card.id, c.card.version);
    const decision = decisions[key] ?? c.defaultDecision;
    if (decision === 'SKIP' || !c.allowed.includes(decision)) { skipped.push(key); continue; }
    const r = await importOne(ctx, c, decision);
    if (!r.ok) failures.push({ definitionId: c.card.id, message: r.message });
    else if (r.skipped) skipped.push(key);
    else imported.push({ definitionId: r.definitionId, version: r.version, projectId: r.projectId, status: r.status });
    await reindexCustomCatalog(ctx, requireSnapshot(ctx).profile.profileId);
  }
  return { ok: true, imported, skipped, failures };
}

async function importOne(ctx: GameContext, c: ImportCardPlan, decision: ImportCardDecision): Promise<{ ok: true; skipped: boolean; definitionId: string; version: number; projectId: string; status: 'COMMITTED' | 'REPLAYED' } | StudioError> {
  const snap = requireSnapshot(ctx);
  const projectId = ctx.platform.newId('project');
  const token = tokenOf(projectId);
  let draft: EditorDraft;
  let mode: ProjectMode;
  let source: { id: string; version: number } | null = null;
  let versionOverride: number | undefined;
  if (decision === 'COPY') {
    const copy = remapAsCopy(c.card, c.printings, newDefinitionId(c.card.baseName, token), token);
    mode = 'NEW_DEFINITION';
    draft = { draftFormat: 1, mode, target: { definitionId: copy.card.id, version: 1 }, rules: copy.card, printings: copy.printings,
      authoring: { notes: `Importado como cópia de ${c.card.id} v${c.card.version}.`, setId: copy.printings[0]?.setId ?? 'custom-lab' }, testScenarios: [] };
  } else if (c.item.status === 'SAME') {
    const fresh = c.printings.filter((p) => c.printingItems.find((x) => x.printingId === p.printingId)?.status === 'NEW');
    if (!fresh.length) return { ok: true, skipped: true, definitionId: c.card.id, version: c.card.version, projectId: '', status: 'REPLAYED' };
    mode = 'VARIANT';
    source = { id: c.card.id, version: c.card.version };
    draft = { draftFormat: 1, mode, target: { definitionId: c.card.id, version: c.card.version }, rules: c.card, printings: fresh,
      authoring: { notes: 'Impressões importadas de pacote.', setId: fresh[0]!.setId }, testScenarios: [] };
  } else {
    const conflicts = c.printingItems.filter((p) => p.status !== 'NEW').map((p) => p.printingId);
    const printings = c.printings.filter((p) => !conflicts.includes(p.printingId));
    mode = c.item.status === 'NEW_VERSION' ? 'NEW_VERSION' : 'NEW_DEFINITION';
    if (mode === 'NEW_VERSION') {
      const content = ctx.content.get();
      const head = catalogDefinitions(content).filter((d) => d.id === c.card.id).sort((a, b) => b.version - a.version)[0];
      if (!head) return err('SOURCE_MISSING', 'Versão anterior não está no catálogo deste perfil.');
      source = { id: head.id, version: head.version };
    }
    versionOverride = c.card.version;
    draft = { draftFormat: 1, mode, target: { definitionId: c.card.id, version: c.card.version }, rules: c.card, printings,
      authoring: { notes: 'Importado de pacote autoral.', setId: printings[0]?.setId ?? 'custom-lab' }, testScenarios: [] };
  }
  const created = await ctx.storage.write({
    kind: 'CREATE_EDITOR_PROJECT', profileId: snap.profile.profileId, projectId, title: titleOf(draft), mode,
    targetDefinitionId: draft.target.definitionId, sourceDefinitionId: source?.id ?? null, sourceVersion: source?.version ?? null, writerEpoch: snap.profile.writerEpoch,
  });
  if (!created.ok) return fromStorage(created);
  const target: SaveTarget = { projectId, headRevision: 0, mode, sourceDefinitionId: source?.id ?? null, sourceVersion: source?.version ?? null };
  const saved = await saveRevision(ctx, target, draft, 'MANUAL');
  if (!saved.ok) return saved;
  const prepared = await preparePublish(ctx, { ...target, headRevision: saved.revision }, draft, { versionOverride, skipTests: true });
  if (!prepared.ok) return err(prepared.code, prepared.message);
  const published = await commitPublish(ctx, prepared.plan);
  if (!published.ok) return published;
  return { ok: true, skipped: false, definitionId: published.definitionId, version: published.version, projectId, status: published.status };
}

/** `.card.json`: não carrega bytes; os assets referenciados precisam já existir no banco (persistencia §24.3). */
export async function cardJsonToContents(ctx: GameContext, doc: CardJsonDoc): Promise<Pick<CardpackContents, 'cards' | 'printings' | 'assets' | 'tests'> & { readonly missingAssets: readonly string[] }> {
  const missing: string[] = [];
  for (const ref of doc.assetRefs) if (!(await ctx.storage.query({ kind: 'GET_ASSET', assetId: ref.sha256 }))) missing.push(ref.sha256);
  return { cards: [doc.rules], printings: doc.printings, assets: [], tests: [], missingAssets: missing };
}

// ---------------------------------------------------------------- release (S47)

export type ReleaseView = {
  readonly definition: CardDefinition;
  readonly printings: readonly CardPrinting[];
  readonly versions: readonly number[];
  readonly isBase: boolean;
  readonly isHead: boolean;
  readonly previous: CardDefinition | null;
  readonly diff: readonly Change[];
};

export function releaseView(content: ContentIndex, definitionId: string, version: number): ReleaseView | null {
  const defs = catalogDefinitions(content).filter((d) => d.id === definitionId);
  const definition = defs.find((d) => d.version === version);
  if (!definition) return null;
  const versions = defs.map((d) => d.version).sort((a, b) => a - b);
  const previous = defs.filter((d) => d.version < version).sort((a, b) => b.version - a.version)[0] ?? null;
  return {
    definition, printings: printingsOf(content, definitionId, version), versions, isBase: isBaseDefinition(content, definitionId),
    isHead: versions[versions.length - 1] === version, previous, diff: previous ? diffRules(previous, definition) : [],
  };
}

/** Verifica se o catálogo indexado contém a carta (aparece na coleção/editor de decks). */
export function catalogHas(content: ContentIndex, definitionId: string, version: number): boolean {
  try {
    content.catalog.definition(definitionKey(definitionId, version));
    return true;
  } catch {
    return false;
  }
}
