// Formatos de intercâmbio do Estúdio (editor §29; persistencia §24.2–§24.3): `.card.json` e `.cardpack.zip`
// formato 1. Aqui ficam as partes puras: documentos, manifesto, nomes de entrada permitidos, varredura de
// conteúdo ativo, classificação contra o catálogo local (novo / mesmo hash / conflito) e “importar como cópia”.
import type { CardDefinition, CardPrinting } from '../cards/types.ts';
import { jcsHash } from '../hash/jcs.ts';
import { RULESET_ID } from './draft.ts';

export const CARD_JSON_FORMAT = 'card-campaign-card';
export const CARDPACK_FORMAT = 'card-campaign-cardpack';
export const INTERCHANGE_FORMAT_VERSION = 1;

const MIB = 1024 * 1024;
/** Limites verificados antes e durante a leitura/descompressão (persistencia §25; DB-049). */
export const CARDPACK_LIMITS = {
  maxCompressedBytes: 128 * MIB,
  maxExpandedBytes: 256 * MIB,
  maxEntries: 1024,
  maxJsonBytes: 4 * MIB,
  maxAssetBytes: 10 * MIB,
  maxCardJsonBytes: 4 * MIB,
  maxCards: 256,
} as const;

export type AssetRef = { readonly sha256: string; readonly bytes: number; readonly mediaType: string };

export type CardJsonDoc = {
  readonly format: typeof CARD_JSON_FORMAT;
  readonly formatVersion: 1;
  readonly rules: CardDefinition;
  readonly printings: readonly CardPrinting[];
  readonly assetRefs: readonly AssetRef[];
};

export type PackTest = {
  readonly testId: string;
  readonly definitionId: string;
  readonly version: number;
  readonly rulesHash: string;
};

export type CardpackManifest = {
  readonly format: typeof CARDPACK_FORMAT;
  readonly formatVersion: 1;
  readonly engineVersion: string;
  readonly rulesetId: string;
  readonly effectsDsl: 1;
  readonly cards: readonly { readonly definitionId: string; readonly version: number; readonly rulesHash: string }[];
  readonly printings: readonly { readonly printingId: string; readonly appearanceHash: string }[];
  readonly assets: readonly AssetRef[];
  readonly tests: readonly PackTest[];
};

export type FormatIssue = { readonly code: string; readonly message: string; readonly path?: string };

export const MEDIA_EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
export const EXT_MEDIA: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };

const HEX64 = /^[0-9a-f]{64}$/;
const DEF_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
const PRINT_ID = /^[a-z0-9][a-z0-9-]{0,99}$/;
const TEST_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// ---------------------------------------------------------------- nomes de entradas

export type EntryKind =
  | { readonly kind: 'MANIFEST' }
  | { readonly kind: 'CARD'; readonly definitionId: string; readonly version: number }
  | { readonly kind: 'PRINTING'; readonly printingId: string }
  | { readonly kind: 'ASSET'; readonly sha256: string; readonly ext: string }
  | { readonly kind: 'TEST'; readonly testId: string }
  | { readonly kind: 'DIRECTORY' };

/** Classifica um nome de entrada do pacote; nomes fora da lista permitida são recusados (anti-traversal). */
export function classifyEntryName(name: string): EntryKind | FormatIssue {
  if (!name || name.length > 300) return { code: 'ENTRY_NAME_INVALID', message: 'Nome de entrada vazio ou longo demais.', path: name.slice(0, 80) };
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(name)) return { code: 'ENTRY_NAME_INVALID', message: 'Nome de entrada com caractere de controle.', path: name };
  if (name.includes('\\')) return { code: 'ENTRY_PATH_TRAVERSAL', message: 'Separador “\\” não é permitido em nomes de entrada.', path: name };
  if (name.startsWith('/') || /^[a-zA-Z]:/.test(name)) return { code: 'ENTRY_PATH_ABSOLUTE', message: 'Caminho absoluto não é permitido.', path: name };
  const segments = name.split('/');
  if (segments.some((s) => s === '..' || s === '.')) return { code: 'ENTRY_PATH_TRAVERSAL', message: 'Segmento “..” ou “.” não é permitido.', path: name };
  if (name.endsWith('/')) {
    const dir = name.slice(0, -1);
    if (['cards', 'printings', 'assets', 'tests'].includes(dir) || (/^cards\/[a-z0-9][a-z0-9-]{0,79}$/.test(dir))) return { kind: 'DIRECTORY' };
    return { code: 'ENTRY_NOT_ALLOWED', message: 'Diretório fora da estrutura do pacote.', path: name };
  }
  if (segments.some((s) => s === '')) return { code: 'ENTRY_NAME_INVALID', message: 'Segmento de caminho vazio.', path: name };
  if (name === 'manifest.json') return { kind: 'MANIFEST' };
  let m = /^cards\/([a-z0-9][a-z0-9-]{0,79})\/([1-9][0-9]{0,6})\.json$/.exec(name);
  if (m) return { kind: 'CARD', definitionId: m[1]!, version: Number(m[2]) };
  m = /^printings\/([a-z0-9][a-z0-9-]{0,99})\.json$/.exec(name);
  if (m) return { kind: 'PRINTING', printingId: m[1]! };
  m = /^assets\/([0-9a-f]{64})\.(png|jpg|jpeg|webp)$/.exec(name);
  if (m) return { kind: 'ASSET', sha256: m[1]!, ext: m[2]! };
  m = /^tests\/([a-z0-9][a-z0-9-]{0,63})\.json$/.exec(name);
  if (m) return { kind: 'TEST', testId: m[1]! };
  if (/\.(zip|jar|7z|rar|gz|tgz)$/i.test(name)) return { code: 'NESTED_ARCHIVE', message: 'ZIP aninhado não é permitido.', path: name };
  return { code: 'ENTRY_NOT_ALLOWED', message: 'Arquivo fora da estrutura do pacote (SQL, scripts, HTML e afins são recusados).', path: name };
}

export function isFormatIssue(value: unknown): value is FormatIssue {
  return isObject(value) && typeof value.code === 'string' && typeof value.message === 'string';
}

// ---------------------------------------------------------------- conteúdo ativo

const ACTIVE_PATTERNS: readonly { readonly re: RegExp; readonly code: string; readonly message: string }[] = [
  { re: /\b[a-z][a-z0-9+.-]*:\/\//i, code: 'REMOTE_URL', message: 'URL remota não é permitida em documentos de carta.' },
  { re: /^\/\/[^/]/, code: 'REMOTE_URL', message: 'URL remota não é permitida em documentos de carta.' },
  { re: /javascript:|vbscript:|data:text\/html/i, code: 'ACTIVE_CONTENT', message: 'Conteúdo executável não é permitido.' },
  { re: /<\s*(script|iframe|object|embed|svg|html|style|link|meta)\b/i, code: 'ACTIVE_CONTENT', message: 'HTML ativo não é permitido.' },
  { re: /\bon[a-z]+\s*=/i, code: 'ACTIVE_CONTENT', message: 'Eventos inline não são permitidos.' },
  { re: /;\s*(drop|delete|insert|update|attach|pragma|create|alter)\s/i, code: 'SQL_CONTENT', message: 'Comandos SQL não são permitidos.' },
  { re: /^\s*(drop|delete|insert|update|attach|pragma|create|alter)\s+(table|from|into|database|index|trigger|view)\b/i, code: 'SQL_CONTENT', message: 'Comandos SQL não são permitidos.' },
];

/** Varre todas as strings e chaves de um documento JSON: textos entram como texto, nunca como código/URL. */
export function scanActiveContent(value: unknown, path = ''): FormatIssue[] {
  const out: FormatIssue[] = [];
  const visit = (v: unknown, p: string) => {
    if (out.length >= 20) return;
    if (typeof v === 'string') {
      for (const rule of ACTIVE_PATTERNS) if (rule.re.test(v)) { out.push({ code: rule.code, message: rule.message, path: p }); break; }
    } else if (Array.isArray(v)) {
      v.forEach((x, i) => visit(x, `${p}/${i}`));
    } else if (isObject(v)) {
      for (const [k, x] of Object.entries(v)) {
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') out.push({ code: 'ACTIVE_CONTENT', message: 'Chave reservada não é permitida.', path: `${p}/${k}` });
        visit(x, `${p}/${k}`);
      }
    }
  };
  visit(value, path);
  return out;
}

// ---------------------------------------------------------------- documentos

export function buildCardJson(rules: CardDefinition, printings: readonly CardPrinting[], assetRefs: readonly AssetRef[]): CardJsonDoc {
  return { format: CARD_JSON_FORMAT, formatVersion: 1, rules, printings: [...printings], assetRefs: [...assetRefs].sort((a, b) => a.sha256.localeCompare(b.sha256)) };
}

function assetRefIssues(list: unknown, path: string): FormatIssue[] {
  if (!Array.isArray(list)) return [{ code: 'FORMAT_INVALID', message: 'Lista de assets ausente.', path }];
  const out: FormatIssue[] = [];
  list.forEach((a, i) => {
    if (!isObject(a) || typeof a.sha256 !== 'string' || !HEX64.test(a.sha256) || typeof a.bytes !== 'number' || !Number.isSafeInteger(a.bytes) || a.bytes < 1
      || a.bytes > CARDPACK_LIMITS.maxAssetBytes || typeof a.mediaType !== 'string' || !(a.mediaType in MEDIA_EXT)) {
      out.push({ code: 'FORMAT_INVALID', message: 'Asset com sha256/bytes/mediaType inválidos (PNG, JPEG ou WebP até 10 MiB).', path: `${path}/${i}` });
    }
  });
  return out;
}

export function parseCardJson(value: unknown): { readonly ok: true; readonly doc: CardJsonDoc } | { readonly ok: false; readonly issues: readonly FormatIssue[] } {
  const issues: FormatIssue[] = [];
  if (!isObject(value)) return { ok: false, issues: [{ code: 'FORMAT_INVALID', message: 'O arquivo não é um objeto JSON.' }] };
  if (value.format !== CARD_JSON_FORMAT) issues.push({ code: 'FORMAT_UNKNOWN', message: `Formato “${String(value.format)}” não é ${CARD_JSON_FORMAT}.`, path: '/format' });
  if (value.formatVersion !== 1) issues.push({ code: 'FORMAT_VERSION_UNSUPPORTED', message: `formatVersion ${String(value.formatVersion)} não é suportado (esperado 1).`, path: '/formatVersion' });
  if (!isObject(value.rules)) issues.push({ code: 'FORMAT_INVALID', message: 'Documento de regras ausente.', path: '/rules' });
  if (!Array.isArray(value.printings)) issues.push({ code: 'FORMAT_INVALID', message: 'Lista de impressões ausente.', path: '/printings' });
  issues.push(...assetRefIssues(value.assetRefs, '/assetRefs'));
  const extra = Object.keys(value).filter((k) => !['format', 'formatVersion', 'rules', 'printings', 'assetRefs'].includes(k));
  if (extra.length) issues.push({ code: 'FORMAT_INVALID', message: `Campos não permitidos: ${extra.join(', ')} (o pacote não carrega saldos, recibos ou progresso).`, path: '/' });
  issues.push(...scanActiveContent(value));
  if (issues.length) return { ok: false, issues };
  const doc = value as unknown as CardJsonDoc;
  for (const [i, p] of doc.printings.entries()) {
    if (!isObject(p) || p.cardDefinitionId !== doc.rules.id || p.cardDefinitionVersion !== doc.rules.version) {
      issues.push({ code: 'PRINTING_MISMATCH', message: 'Impressão não pertence à definição/versão do arquivo.', path: `/printings/${i}` });
    }
  }
  return issues.length ? { ok: false, issues } : { ok: true, doc };
}

export function buildManifest(input: {
  readonly engineVersion: string;
  readonly cards: readonly CardDefinition[];
  readonly printings: readonly CardPrinting[];
  readonly assets: readonly AssetRef[];
  readonly tests: readonly PackTest[];
}): CardpackManifest {
  return {
    format: CARDPACK_FORMAT, formatVersion: 1, engineVersion: input.engineVersion, rulesetId: RULESET_ID, effectsDsl: 1,
    cards: input.cards.map((c) => ({ definitionId: c.id, version: c.version, rulesHash: jcsHash(c) })),
    printings: input.printings.map((p) => ({ printingId: p.printingId, appearanceHash: jcsHash(p) })),
    assets: [...input.assets].sort((a, b) => a.sha256.localeCompare(b.sha256)),
    tests: [...input.tests],
  };
}

export function parseManifest(value: unknown): { readonly ok: true; readonly manifest: CardpackManifest } | { readonly ok: false; readonly issues: readonly FormatIssue[] } {
  const issues: FormatIssue[] = [];
  if (!isObject(value)) return { ok: false, issues: [{ code: 'MANIFEST_INVALID', message: 'manifest.json não é um objeto.' }] };
  if (value.format !== CARDPACK_FORMAT) issues.push({ code: 'FORMAT_UNKNOWN', message: `Formato “${String(value.format)}” não é ${CARDPACK_FORMAT}.`, path: '/format' });
  if (value.formatVersion !== 1) issues.push({ code: 'FORMAT_VERSION_UNSUPPORTED', message: `formatVersion ${String(value.formatVersion)} não é suportado (esperado 1).`, path: '/formatVersion' });
  if (typeof value.engineVersion !== 'string' || !value.engineVersion) issues.push({ code: 'MANIFEST_INVALID', message: 'engineVersion ausente.', path: '/engineVersion' });
  if (value.rulesetId !== RULESET_ID) issues.push({ code: 'RULESET_UNSUPPORTED', message: `Ruleset “${String(value.rulesetId)}” não é ${RULESET_ID}.`, path: '/rulesetId' });
  if (value.effectsDsl !== 1) issues.push({ code: 'DSL_UNSUPPORTED', message: `effectsDsl ${String(value.effectsDsl)} não é suportado.`, path: '/effectsDsl' });
  const cards = Array.isArray(value.cards) ? value.cards : null;
  if (!cards) issues.push({ code: 'MANIFEST_INVALID', message: 'Lista de cartas ausente.', path: '/cards' });
  else if (cards.length > CARDPACK_LIMITS.maxCards) issues.push({ code: 'LIMIT_EXCEEDED', message: `Pacote com mais de ${CARDPACK_LIMITS.maxCards} cartas.`, path: '/cards' });
  else cards.forEach((c, i) => {
    if (!isObject(c) || typeof c.definitionId !== 'string' || !DEF_ID.test(c.definitionId) || !Number.isSafeInteger(c.version) || (c.version as number) < 1 || typeof c.rulesHash !== 'string' || !HEX64.test(c.rulesHash)) {
      issues.push({ code: 'MANIFEST_INVALID', message: 'Carta com definitionId/version/rulesHash inválidos.', path: `/cards/${i}` });
    }
  });
  const printings = Array.isArray(value.printings) ? value.printings : null;
  if (!printings) issues.push({ code: 'MANIFEST_INVALID', message: 'Lista de impressões ausente.', path: '/printings' });
  else printings.forEach((p, i) => {
    if (!isObject(p) || typeof p.printingId !== 'string' || !PRINT_ID.test(p.printingId) || typeof p.appearanceHash !== 'string' || !HEX64.test(p.appearanceHash)) {
      issues.push({ code: 'MANIFEST_INVALID', message: 'Impressão com printingId/appearanceHash inválidos.', path: `/printings/${i}` });
    }
  });
  issues.push(...assetRefIssues(value.assets, '/assets'));
  const tests = Array.isArray(value.tests) ? value.tests : null;
  if (!tests) issues.push({ code: 'MANIFEST_INVALID', message: 'Lista de testes ausente.', path: '/tests' });
  else tests.forEach((t, i) => {
    if (!isObject(t) || typeof t.testId !== 'string' || !TEST_ID.test(t.testId) || typeof t.definitionId !== 'string' || !Number.isSafeInteger(t.version) || typeof t.rulesHash !== 'string' || !HEX64.test(t.rulesHash)) {
      issues.push({ code: 'MANIFEST_INVALID', message: 'Teste com testId/definitionId/version/rulesHash inválidos.', path: `/tests/${i}` });
    }
  });
  const extra = Object.keys(value).filter((k) => !['format', 'formatVersion', 'engineVersion', 'rulesetId', 'effectsDsl', 'cards', 'printings', 'assets', 'tests', 'exportedAt'].includes(k));
  if (extra.length) issues.push({ code: 'MANIFEST_INVALID', message: `Campos não permitidos no manifesto: ${extra.join(', ')}.`, path: '/' });
  issues.push(...scanActiveContent(value, '/manifest'));
  return issues.length ? { ok: false, issues } : { ok: true, manifest: value as unknown as CardpackManifest };
}

// ---------------------------------------------------------------- comparação com o catálogo local

export type LocalCatalogView = {
  /** Hash de regras de uma versão existente (null se não existe). */
  readonly versionHash: (definitionId: string, version: number) => string | null;
  /** Namespace de uma definição existente (null se não existe). */
  readonly definitionNamespace: (definitionId: string) => 'BASE' | 'CUSTOM' | null;
  /** Hash de aparência de uma impressão existente (null se não existe). */
  readonly printingHash: (printingId: string) => string | null;
};

export type CardImportStatus = 'NEW' | 'NEW_VERSION' | 'SAME' | 'CONFLICT';
export type CardImportItem = {
  readonly definitionId: string;
  readonly version: number;
  readonly name: string;
  readonly rulesHash: string;
  readonly status: CardImportStatus;
  readonly reason: string;
};
export type PrintingImportItem = { readonly printingId: string; readonly definitionId: string; readonly status: 'NEW' | 'SAME' | 'CONFLICT'; readonly reason: string };

/** Mesmo ID/versão e hash: reutiliza; hash diferente: conflito (nunca sobrescreve); BASE: só como cópia. */
export function classifyImport(cards: readonly CardDefinition[], printings: readonly CardPrinting[], local: LocalCatalogView): { cards: CardImportItem[]; printings: PrintingImportItem[] } {
  const cardItems = cards.map((c): CardImportItem => {
    const rulesHash = jcsHash(c);
    const existing = local.versionHash(c.id, c.version);
    const ns = local.definitionNamespace(c.id);
    const base = { definitionId: c.id, version: c.version, name: c.name, rulesHash };
    if (existing !== null) {
      return existing === rulesHash
        ? { ...base, status: 'SAME', reason: 'Mesma definição, versão e hash: será reutilizada sem duplicar.' }
        : { ...base, status: 'CONFLICT', reason: 'Mesmo ID e versão com regras diferentes: importe como cópia ou cancele.' };
    }
    if (ns === 'BASE') return { ...base, status: 'CONFLICT', reason: 'ID pertence ao catálogo base (somente leitura): importe como cópia.' };
    if (ns === 'CUSTOM') return { ...base, status: 'NEW_VERSION', reason: 'Nova versão de uma definição autoral já existente.' };
    return { ...base, status: 'NEW', reason: 'Carta nova.' };
  });
  const printingItems = printings.map((p): PrintingImportItem => {
    const existing = local.printingHash(p.printingId);
    const hash = jcsHash(p);
    if (existing === null) return { printingId: p.printingId, definitionId: p.cardDefinitionId, status: 'NEW', reason: 'Impressão nova.' };
    return existing === hash
      ? { printingId: p.printingId, definitionId: p.cardDefinitionId, status: 'SAME', reason: 'Impressão idêntica já existe.' }
      : { printingId: p.printingId, definitionId: p.cardDefinitionId, status: 'CONFLICT', reason: 'Mesmo ID de impressão com aparência diferente.' };
  });
  return { cards: cardItems, printings: printingItems };
}

/** “Importar como cópia”: novo definitionId (versão 1) e IDs de impressão novos, com todas as referências internas remapeadas. */
export function remapAsCopy(card: CardDefinition, printings: readonly CardPrinting[], newDefinitionId: string, token: string): { card: CardDefinition; printings: CardPrinting[]; printingIdMap: Record<string, string> } {
  const suffix = token.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'copia';
  const printingIdMap: Record<string, string> = {};
  const nextCard = { ...card, id: newDefinitionId, version: 1 } as CardDefinition;
  const nextPrintings = printings.map((p) => {
    const id = `${p.printingId.slice(0, 88).replace(/-+$/, '')}-c${suffix}`.slice(0, 100);
    printingIdMap[p.printingId] = id;
    return { ...p, printingId: id, cardDefinitionId: newDefinitionId, cardDefinitionVersion: 1 };
  });
  return { card: nextCard, printings: nextPrintings, printingIdMap };
}
