// Validação completa do pacote de conteúdo: Ajv 2020 contra .specs/schemas e verificações semânticas
// (referências, grafo, decks legais, pools, opcodes, economia, objetivos de composição e solvabilidade de fixtures).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import type { ValidateFunction } from 'ajv';
import type { CampaignNode, ContentBundle, Objective, Product, RarityCategory } from '../../src/content/types.ts';
import { buildCatalog, type Catalog } from '../../src/domain/cards/catalog.ts';
import { deckLimitKey, deriveName } from '../../src/domain/cards/naming.ts';
import type { CardDefinition, CardPrinting, EffectBlock, Formula, Operation } from '../../src/domain/cards/types.ts';
import { cardFace } from '../../src/domain/cards/text.ts';
import { raritySymbol, type RaritySymbol } from '../../src/domain/cards/rarity.ts';
import { estimateTextFit } from '../../src/domain/editor/textfit.ts';
import { canonicalize } from '../../src/domain/hash/jcs.ts';
import { ENERGY_TYPES, definitionKey, isFossil, isPokemon } from '../../src/domain/cards/types.ts';
import { CONTINUOUS_OPCODES, OPCODES } from '../../src/domain/battle/ops.ts';
import { isFormulaWithinLimits } from '../../src/domain/battle/formula.ts';
import { cardOpcodes, deckMetrics, evaluateComposition, validateDeck, type DeckMetrics } from '../../src/domain/deck/validate.ts';
import { runScript, type ContentFixture } from '../../src/content/source/script.ts';
import { evaluateObjective } from '../../src/content/source/evaluate.ts';
import { ORPHAN_EVOLUTIONS } from '../../src/content/source/pocket/cards.ts';
import { economyAudit, EXPECTED_MANDATORY, EXPECTED_MAX_ONE_TIME, type EconomyAudit } from './economy.ts';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
/** Decks iniciais: um por tipo de Energia gerável (campanha §3.5). */
const STARTER_DECKS = 8;

const SCHEMAS = {
  card: 'card-definition', printing: 'card-printing', deck: 'content-deck', product: 'product', objective: 'objective', node: 'campaign-node',
  rewardTable: 'reward-table', npc: 'npc', aiProfile: 'ai-profile', fixture: 'battle-fixture', cosmetic: 'cosmetic', dialogue: 'dialogue',
  recipe: 'deck-recipe',
} as const;
/** Receitas de deck (campanha §3.7): mínimo por categoria e duas por tipo de Energia gerável. */
const MIN_RECIPES = { META: 15, COMMUNITY: 10, TYPE_PER_ENERGY: 2 } as const;
type SchemaKey = keyof typeof SCHEMAS;

let compiled: Record<SchemaKey, ValidateFunction> | null = null;

export function schemaValidators(): Record<SchemaKey, ValidateFunction> {
  if (compiled) return compiled;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const out = {} as Record<SchemaKey, ValidateFunction>;
  for (const [key, file] of Object.entries(SCHEMAS) as [SchemaKey, string][]) {
    const schema = JSON.parse(readFileSync(resolve(ROOT, '.specs', 'schemas', `${file}.schema.json`), 'utf-8')) as object;
    out[key] = ajv.compile(schema);
  }
  compiled = out;
  return out;
}

export type PuzzleCheck = {
  readonly fixtureId: string;
  readonly nodeId: string;
  readonly seeds: readonly number[];
  readonly solved: boolean;
  readonly ownTurnsUsed: number | null;
  readonly turnLimit: number | null;
  readonly actions: number;
  readonly detail: string;
};

export type BuildReport = {
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly economy: EconomyAudit;
  readonly puzzles: readonly PuzzleCheck[];
  readonly starterCompositionChecks: readonly { readonly objectiveId: string; readonly satisfiedBy: readonly string[] }[];
  readonly deckMetrics: Readonly<Record<string, DeckMetrics>>;
};

const NODE_IDS: readonly string[] = [
  ...[1, 2, 3, 4, 5, 6].map((i) => `P00-T0${i}`),
  ...[1, 2, 3, 4, 5, 6].flatMap((c) => [1, 2, 3, 4, 5, 6].map((e) => `C0${c}-E0${e}`)),
  ...[1, 2, 3].map((i) => `F00-D0${i}`),
];

/** Pré-requisitos canônicos (campanha §2.2). */
export function expectedPrerequisites(nodeId: string): string[] {
  if (nodeId === 'P00-T01') return [];
  if (nodeId.startsWith('P00-T')) return [`P00-T0${Number(nodeId.slice(-1)) - 1}`];
  if (nodeId === 'F00-D01') return ['C06-E06'];
  if (nodeId.startsWith('F00-D')) return [`F00-D0${Number(nodeId.slice(-1)) - 1}`];
  const chapter = Number(nodeId.slice(1, 3));
  const slot = nodeId.slice(4);
  if (slot === 'E01') return [chapter === 1 ? 'P00-T06' : `C0${chapter - 1}-E06`];
  if (slot === 'E02' || slot === 'E03') return [`C0${chapter}-E01`];
  return [`C0${chapter}-E03`];
}

const EXPECTED_KIND: Record<string, CampaignNode['kind']> = { E01: 'DUEL', E02: 'PUZZLE', E03: 'DUEL', E04: 'DISCOVERY', E05: 'ELITE', E06: 'BOSS' };
const ARENA: Record<string, string> = { P00: 'arena-academy', C01: 'arena-grove', C02: 'arena-harbor', C03: 'arena-circuits', C04: 'arena-observatory', C05: 'arena-foundry', C06: 'arena-archive', F00: 'arena-final' };
const PLAYMAT_IDS = ['mat-neutral', 'mat-academy', 'mat-c01-grove', 'mat-c02-harbor', 'mat-c03-circuits', 'mat-c04-observatory', 'mat-c05-foundry', 'mat-c06-archive', 'mat-circuit-complete'];
const SLOT_TABLE: Readonly<Record<number, Record<RarityCategory, number>>> = {
  1: { COMMON: 100, UNCOMMON: 0, RARE: 0, ULTRA: 0 }, 2: { COMMON: 100, UNCOMMON: 0, RARE: 0, ULTRA: 0 }, 3: { COMMON: 100, UNCOMMON: 0, RARE: 0, ULTRA: 0 },
  4: { COMMON: 30, UNCOMMON: 70, RARE: 0, ULTRA: 0 }, 5: { COMMON: 0, UNCOMMON: 70, RARE: 25, ULTRA: 5 },
};
const DIRECTED_PRICE: Record<RarityCategory, number> = { COMMON: 80, UNCOMMON: 160, RARE: 300, ULTRA: 600 };
const EXPECTED_FIRST_CLEAR: Readonly<Record<string, { credits: number; packs: number; packKind: string | null }>> = {
  TUTORIAL: { credits: 50, packs: 0, packKind: null }, DUEL: { credits: 80, packs: 1, packKind: 'chapter' }, PUZZLE: { credits: 100, packs: 0, packKind: null },
  DISCOVERY: { credits: 0, packs: 0, packKind: null }, ELITE: { credits: 160, packs: 1, packKind: 'chapter' }, BOSS: { credits: 250, packs: 2, packKind: 'chapter' },
  FINAL: { credits: 300, packs: 2, packKind: null },
};
const EXPECTED_REPEAT: Readonly<Record<string, number | null>> = { TUTORIAL: null, DUEL: 20, PUZZLE: null, DISCOVERY: null, ELITE: 30, BOSS: 40, FINAL: 40 };
const PUZZLE_SEEDS = [1, 7, 42, 2026];
/** Pacotes aleatórios do Genetic Apex: liberação para compra e chefe que libera os ULTRA daquele pacote no Empório. */
const A1_PACK_RULES: Readonly<Record<string, { readonly afterNodeId: string | null; readonly ultraAfterNodeId: string }>> = {
  'pack-a1-pikachu': { afterNodeId: null, ultraAfterNodeId: 'C03-E06' },
  'pack-a1-charizard': { afterNodeId: 'C01-E01', ultraAfterNodeId: 'C05-E06' },
  'pack-a1-mewtwo': { afterNodeId: 'C04-E01', ultraAfterNodeId: 'C06-E06' },
};
/** ULTRA presente nos três pacotes (sem pacote de origem: Mew ☆☆☆ e coroas ♛) só depois do final. */
const NO_PACK_ULTRA_AFTER = 'F00-D03';

/**
 * Pacotes por símbolo (sets depois do A1, campanha §16.2): cópia independente das tabelas oficiais, em milésimos de
 * ponto percentual (soma 100000). Todos custam 100 e ficam à venda desde o início.
 */
type TierTable = readonly Readonly<Partial<Record<RaritySymbol, number>>>[];
const C3 = { '◊': 100000 };
const TIER_TABLE: Readonly<Record<'CLASSIC' | 'SHINY' | 'DELUXE' | 'PROMO', TierTable>> = {
  CLASSIC: [C3, C3, C3, { '◊◊': 90000, '◊◊◊': 5000, '◊◊◊◊': 1666, '☆': 2572, '☆☆': 500, '☆☆☆': 222, '♛': 40 },
    { '◊◊': 60000, '◊◊◊': 20000, '◊◊◊◊': 6664, '☆': 10288, '☆☆': 2000, '☆☆☆': 888, '♛': 160 }],
  SHINY: [C3, C3, C3, { '◊◊': 89000, '◊◊◊': 4953, '◊◊◊◊': 1666, '☆': 2572, '☆☆': 500, '☆☆☆': 222, '✵': 714, '✵✵': 333, '♛': 40 },
    { '◊◊': 56000, '◊◊◊': 19810, '◊◊◊◊': 6664, '☆': 10288, '☆☆': 2000, '☆☆☆': 888, '✵': 2857, '✵✵': 1333, '♛': 160 }],
  DELUXE: [C3, { '◊◊': 82270, '◊': 17730 }, { '◊◊◊': 40660, '◊': 23021, '◊◊': 17985, '☆': 12858, '☆☆': 2500, '☆☆☆': 1111, '✵✵': 1667, '♛': 198 }, { '◊◊◊◊': 100000 }],
  PROMO: [1, 2, 3, 4, 5].map(() => ({ PROMO: 100000 })),
};
const TIER_PACK_RULES: Readonly<Record<string, { readonly table: keyof typeof TIER_TABLE; readonly baby?: true }>> = {
  'pack-a1a-mew': { table: 'CLASSIC' }, 'pack-a2-dialga': { table: 'CLASSIC' }, 'pack-a2-palkia': { table: 'CLASSIC' }, 'pack-a2a-arceus': { table: 'CLASSIC' },
  'pack-a3-solgaleo': { table: 'SHINY' }, 'pack-a3-lunala': { table: 'SHINY' }, 'pack-a3a': { table: 'SHINY' }, 'pack-a3b': { table: 'SHINY' },
  'pack-a4-lugia': { table: 'SHINY', baby: true }, 'pack-a4-ho-oh': { table: 'SHINY', baby: true }, 'pack-a4a': { table: 'SHINY', baby: true },
  'pack-a4b': { table: 'DELUXE' }, 'pack-pa-promo': { table: 'PROMO' }, 'pack-pb-promo': { table: 'PROMO' },
};
const BABY_BONUS = { chance: 8330, weights: { '◊◊◊': 87100, '☆': 12900 } };
const RARE_PACK = { chance: 50, symbols: ['☆', '☆☆', '☆☆☆', '✵', '✵✵', '♛'] };
const sameWeights = (a: Readonly<Partial<Record<string, number>>>, b: Readonly<Partial<Record<string, number>>>) =>
  JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

/** Pacote por símbolo (campanha §16.2): tabela oficial exata, pools coerentes com o símbolo, 6ª carta e pacote raro. */
function tierPackErrors(product: Product, printing: (id: string) => CardPrinting | undefined, errors: string[]): void {
  const where = `produto ${product.productId}`;
  const rule = TIER_PACK_RULES[product.productId];
  if (!rule) return; // pacote inesperado: acusado na checagem geral
  const table = TIER_TABLE[rule.table];
  const slots = [...(product.tierSlots ?? [])].sort((a, b) => a.position - b.position);
  if (product.cardsPerPack !== table.length || slots.length !== table.length) errors.push(`${where}: são esperadas ${table.length} cartas`);
  if (product.price?.credits !== 100) errors.push(`${where}: preço de pacote deve ser 100 Créditos`);
  if (!product.availability.fromStart) errors.push(`${where}: pacote dos sets novos fica à venda desde o início`);
  if (product.slots || product.pools) errors.push(`${where}: pacote por símbolo não usa slots/pools por categoria`);
  slots.forEach((slot, i) => {
    const sum = Object.values(slot.weights).reduce((a: number, b) => a + (b ?? 0), 0);
    if (slot.position !== i + 1) errors.push(`${where}: posições devem ser 1..${table.length}`);
    if (sum !== 100000) errors.push(`${where}: posição ${slot.position} soma ${sum} (≠100000)`);
    if (!table[i] || !sameWeights(slot.weights, table[i]!)) errors.push(`${where}: posição ${slot.position} diverge da tabela ${rule.table} de campanha §16.2`);
  });
  const promo = rule.table === 'PROMO';
  if (promo ? !!product.rarePack : !product.rarePack || product.rarePack.chance !== RARE_PACK.chance || product.rarePack.symbols.join() !== RARE_PACK.symbols.join()) {
    errors.push(`${where}: pacote raro ${promo ? 'não existe no pacote promocional' : `deve ser ${RARE_PACK.chance}/100000 com ☆…♛`}`);
  }
  if (rule.baby ? !product.bonusSlot || product.bonusSlot.chance !== BABY_BONUS.chance || !sameWeights(product.bonusSlot.weights, BABY_BONUS.weights) : !!product.bonusSlot) {
    errors.push(`${where}: 6ª carta ${rule.baby ? `deve ser ${BABY_BONUS.chance}/100000 com ◊◊◊ 87100 e ☆ 12900` : 'só existe no A4 e no A4a'}`);
  }
  const seen = new Set<string>();
  const sets = new Set<string>();
  const checkPools = (label: string, pools: Readonly<Partial<Record<RaritySymbol, readonly string[]>>>, weights: readonly Readonly<Partial<Record<RaritySymbol, number>>>[]) => {
    for (const [symbol, ids] of Object.entries(pools) as [RaritySymbol, readonly string[]][]) {
      const rareOnly = label === 'pool' && !!product.rarePack?.symbols.includes(symbol);
      if (!weights.some((w) => (w[symbol] ?? 0) > 0) && !rareOnly) errors.push(`${where}: ${label} ${symbol} sem chance em nenhuma posição`);
      for (const id of ids) {
        const p = printing(id);
        if (!p) { errors.push(`${where}: ${label} com impressão inexistente ${id}`); continue; }
        if (raritySymbol(p) !== symbol) errors.push(`${where}: ${id} (${raritySymbol(p)}) no ${label} ${symbol}`);
        if ((p.rarity === 'PROMO') !== promo) errors.push(`${where}: ${id} ${promo ? 'não é PROMO' : 'é PROMO'} (${label})`);
        if (seen.has(id)) errors.push(`${where}: ${id} repetida nos pools`);
        seen.add(id);
        sets.add(p.setId);
      }
    }
    for (const w of weights) for (const sym of Object.keys(w) as RaritySymbol[]) if ((w[sym] ?? 0) > 0 && !(pools[sym]?.length)) errors.push(`${where}: ${sym} com chance positiva e ${label} vazio (C-031)`);
  };
  checkPools('pool', product.tierPools ?? {}, slots.map((x) => x.weights));
  if (product.bonusSlot) checkPools('pool da 6ª carta', product.bonusSlot.pools, [product.bonusSlot.weights]);
  if (product.rarePack && !product.rarePack.symbols.some((x) => product.tierPools?.[x]?.length)) errors.push(`${where}: pacote raro sem impressões`);
  if (sets.size > 1) errors.push(`${where}: pools misturam sets (${[...sets].join(', ')})`);
}

function duplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const id of ids) (seen.has(id) ? dup : seen).add(id);
  return [...dup].sort();
}

function ajvErrors(fn: ValidateFunction): string {
  return (fn.errors ?? []).slice(0, 4).map((e) => `${e.instancePath || '/'} ${e.message ?? ''}`).join('; ');
}

// ---------------------------------------------------------------- cartas

function formulas(f: Formula | null | undefined, out: Formula[]): void {
  if (!f) return;
  out.push(f);
}

function walkOps(op: Operation, visit: (op: Operation) => void): void {
  visit(op);
  if (op.type === 'CONDITIONAL') { op.then.forEach((c) => walkOps(c, visit)); (op.else ?? []).forEach((c) => walkOps(c, visit)); }
  if (op.type === 'SCHEDULE_DELAYED') op.operations.forEach((c) => walkOps(c, visit));
  if (op.type === 'CHOOSE_ONE') op.options.forEach((ops) => ops.forEach((c) => walkOps(c, visit)));
}

function checkBlocks(card: CardDefinition, context: string, blocks: readonly EffectBlock[], allowed: readonly string[], errors: string[]): void {
  const outputs = new Set<string>();
  for (const block of blocks) {
    if (!allowed.includes(block.timing)) errors.push(`carta ${card.id}: timing ${block.timing} não permitido em ${context} (TIMING_NOT_ALLOWED)`);
    if ((block.timing === 'CONTINUOUS' || block.timing === 'REPLACEMENT') && !CONTINUOUS_OPCODES.has(block.operation.type)) {
      errors.push(`carta ${card.id}: ${block.operation.type} não é contínuo (NOT_CONTINUOUS_OPCODE)`);
    }
    walkOps(block.operation, (op) => {
      if (!(OPCODES as readonly string[]).includes(op.type)) errors.push(`carta ${card.id}: opcode desconhecido ${op.type} (UNKNOWN_OPCODE)`);
      const fs: Formula[] = [];
      if ('amount' in op && typeof op.amount === 'object') formulas(op.amount as Formula, fs);
      if ('count' in op && typeof op.count === 'object') formulas(op.count as Formula, fs);
      for (const f of fs) if (!isFormulaWithinLimits(f)) errors.push(`carta ${card.id}: fórmula complexa demais (FORMULA_TOO_COMPLEX)`);
      if (op.type === 'FLIP_COINS') {
        if (outputs.has(op.outputId)) errors.push(`carta ${card.id}: outputId duplicado ${op.outputId}`);
        outputs.add(op.outputId);
      } else if ('outputId' in op && op.outputId) outputs.add(op.outputId);
    });
    const refs: string[] = [];
    const collect = (f: Formula | undefined) => { if (!f) return; if (f.reference) refs.push(f.reference); (f.operands ?? []).forEach(collect); };
    const cond = block.condition as { left?: Formula; right?: Formula } | null | undefined;
    collect(cond?.left); collect(cond?.right);
    for (const r of refs) if (!outputs.has(r)) errors.push(`carta ${card.id}: referência ${r} antes do FLIP_COINS (FORMULA_REFERENCE_MISSING)`);
  }
}

/** DEFENDING e ATTACK_FAILS só existem nos efeitos de um ataque (fora de efeitos atrasados). */
export function checkAttackOnly(card: CardDefinition, errors: string[]): void {
  const nonAttack: unknown[] = [...card.abilities.map((a) => [a.effects, a.conditions]), ...(card.category === 'TRAINER' ? [card.trainerEffects, card.trainerRules] : [])];
  for (const attack of card.attacks) {
    for (const b of attack.effects) walkOps(b.operation, (op) => { if (op.type === 'SCHEDULE_DELAYED') nonAttack.push(op.operations); });
  }
  const text = JSON.stringify(nonAttack);
  if (text.includes('"scope":"DEFENDING"')) errors.push(`carta ${card.id}: seletor DEFENDING fora dos efeitos de ataque (SELECTOR_IMPOSSIBLE)`);
  if (text.includes('"type":"ATTACK_FAILS"')) errors.push(`carta ${card.id}: ATTACK_FAILS fora dos efeitos de ataque (ATTACK_ONLY_OPERATION)`);
}

/**
 * Texto gerado de cada ataque/Habilidade/Treinador cabe no template (textfit.ts: 3 linhas por parágrafo de
 * ataque ou Habilidade; 6 no Treinador). Devolve uma linha por região que estoura.
 */
export function textFitOverflows(cards: readonly CardDefinition[], printings: readonly CardPrinting[]): string[] {
  const nameOf = (key: string) => cards.find((d) => d.deckLimitKey === key)?.name ?? null;
  const out: string[] = [];
  for (const card of cards) {
    const printing = printings.find((p) => p.cardDefinitionId === card.id && p.cardDefinitionVersion === card.version);
    if (!printing) continue;
    const fit = estimateTextFit(cardFace(card, printing, nameOf));
    for (const region of fit.regions) {
      if (region.overflow) out.push(`carta ${card.id}: ${region.label} com ${Math.ceil(region.lines)} linhas (máximo ${region.maxLines}) — CARD_TEXT_OVERFLOW`);
    }
  }
  return out;
}

/**
 * Arte do pacote (runtime §20.1): sem arte (TEMPLATE_ONLY, nenhuma chave) ou “Impressão completa” com `artKey`
 * `art:<set>:<NNN>` cujo arquivo existe em src/presentation/assets/cards/<set>/<SET>-<NNN>.webp. Conteúdo BASE nunca
 * referencia BLOB importado (`artAssetId`).
 */
export function bundledArtErrors(p: CardPrinting): string[] {
  if (p.artAssetId) return ['conteúdo BASE não usa arte importada (artAssetId)'];
  if (p.artMode === 'TEMPLATE_ONLY') return p.artKey ? ['TEMPLATE_ONLY não pode ter artKey'] : [];
  if (p.artMode !== 'FULL_PRINTING') return [`artMode ${p.artMode} sem suporte no pacote (use TEMPLATE_ONLY ou FULL_PRINTING)`];
  const m = p.artKey ? /^art:([a-z0-9]+):(\d{3})$/.exec(p.artKey) : null;
  if (!m) return [`artKey inválida (${p.artKey ?? 'ausente'}); esperado art:<set>:<NNN>`];
  const dir = resolve(ROOT, 'src', 'presentation', 'assets', 'cards', m[1]!);
  const name = `${m[1]!.toUpperCase()}-${m[2]}.webp`;
  // Caixa exata: o glob do Vite diferencia maiúsculas; existsSync no Windows não (A1a-001.webp passaria e faltaria).
  return artFiles(dir).has(name) ? [] : [`arte ${p.artKey} ausente (${resolve(dir, name).slice(ROOT.length + 1)}); rode npm run assets:import`];
}

/** Moeda com imagem (`coin-art:<stem>`): cara e coroa empacotadas em src/presentation/assets/coins (assets:coins). */
export function coinArtErrors(assetKey: string | null): string[] {
  if (!assetKey) return [];
  const m = /^coin-art:([a-z0-9-]+)$/.exec(assetKey);
  if (!m) return [`assetKey de moeda inválida (${assetKey}); esperado coin-art:<stem>`];
  const dir = resolve(ROOT, 'src', 'presentation', 'assets', 'coins');
  return ['heads', 'tails'].filter((f) => !artFiles(dir).has(`${m[1]}-${f}.webp`)).map((f) => `moeda ${assetKey} sem ${f} em src/presentation/assets/coins; rode npm run assets:coins`);
}

/** Sleeve com imagem (`sleeve-art:<stem>`): o verso empacotado em src/presentation/assets/sleeves (assets:sleeves). */
export function sleeveArtErrors(assetKey: string | null): string[] {
  if (!assetKey) return [];
  const m = /^sleeve-art:([a-z0-9-]+)$/.exec(assetKey);
  if (!m) return [`assetKey de verso inválida (${assetKey}); esperado sleeve-art:<stem>`];
  const dir = resolve(ROOT, 'src', 'presentation', 'assets', 'sleeves');
  return artFiles(dir).has(`${m[1]}.webp`) ? [] : [`verso ${assetKey} sem imagem em src/presentation/assets/sleeves; rode npm run assets:sleeves`];
}

/** Retrato de NPC: `portrait:<arquivo>` com o PNG em src/presentation/assets/portraits (a própria origem, sem importador). */
export function portraitErrors(key: string | null): string[] {
  const m = key ? /^portrait:([a-z0-9-]+)$/.exec(key) : null;
  if (!m) return [`retrato inválido (${key ?? 'ausente'}); esperado portrait:<arquivo>`];
  const dir = resolve(ROOT, 'src', 'presentation', 'assets', 'portraits');
  return artFiles(dir).has(`${m[1]}.png`) ? [] : [`retrato ${key} ausente em src/presentation/assets/portraits`];
}

const ART_DIRS = new Map<string, ReadonlySet<string>>();
function artFiles(dir: string): ReadonlySet<string> {
  let files = ART_DIRS.get(dir);
  if (!files) {
    files = new Set(existsSync(dir) ? readdirSync(dir) : []);
    ART_DIRS.set(dir, files);
  }
  return files;
}

function checkCard(card: CardDefinition, allKeys: Set<string>, errors: string[]): void {
  checkAttackOnly(card, errors);
  if (card.name !== deriveName(card.baseName, card.ruleBox)) errors.push(`carta ${card.id}: nome não derivado de baseName+ruleBox`);
  if (card.deckLimitKey !== deckLimitKey(card.name)) errors.push(`carta ${card.id}: deckLimitKey fora do algoritmo deck-limit-key-v2`);
  if (card.tags.some((t) => /^(ex|mega)$/i.test(t))) errors.push(`carta ${card.id}: tags não podem representar ex/Mega`);
  const blockIds = new Set<string>();
  const allBlocks = [...card.attacks.flatMap((a) => a.effects), ...card.abilities.flatMap((a) => a.effects), ...(card.category === 'TRAINER' ? card.trainerEffects : [])];
  for (const b of allBlocks) {
    if (blockIds.has(b.id)) errors.push(`carta ${card.id}: id de bloco duplicado ${b.id}`);
    blockIds.add(b.id);
  }
  if (isPokemon(card)) {
    for (const key of card.evolvesFrom) if (!allKeys.has(key) && ORPHAN_EVOLUTIONS[card.id] !== key) errors.push(`carta ${card.id}: evolvesFrom ${key} sem definição`);
    for (const attack of card.attacks) {
      checkBlocks(card, `ataque ${attack.id}`, attack.effects, ['PRE_DAMAGE', 'POST_DAMAGE'], errors);
      if (attack.damageFormula && !isFormulaWithinLimits(attack.damageFormula)) errors.push(`carta ${card.id}: fórmula de dano complexa demais`);
    }
    for (const ability of card.abilities) {
      const allowed = ability.kind === 'ACTIVATED' ? ['ON_ACTIVATE'] : ability.kind === 'TRIGGERED' ? ['ON_TRIGGER'] : ability.kind === 'CONTINUOUS' ? ['CONTINUOUS'] : ['REPLACEMENT'];
      checkBlocks(card, `Habilidade ${ability.id}`, ability.effects, allowed, errors);
      if (ability.kind === 'ACTIVATED' && !ability.usageLimit) errors.push(`carta ${card.id}: Habilidade ativada sem usageLimit (USAGE_LIMIT_REQUIRED)`);
      if ((ability.kind === 'TRIGGERED') !== !!ability.trigger) errors.push(`carta ${card.id}: gatilho inconsistente com o tipo da Habilidade`);
    }
  } else {
    const allowed = card.subtype === 'TOOL' ? ['CONTINUOUS', 'ON_TRIGGER', 'REPLACEMENT'] : card.subtype === 'STADIUM' ? ['CONTINUOUS', 'ON_TRIGGER'] : ['ON_PLAY'];
    checkBlocks(card, card.subtype, card.trainerEffects, allowed, errors);
    if (card.trainerRules.fieldBehavior && !(card.subtype === 'ITEM' && card.trainerRules.destinationAfterPlay === 'BENCH_AS_POKEMON')) {
      errors.push(`carta ${card.id}: fieldBehavior só em Item com destino BENCH_AS_POKEMON`);
    }
  }
}

// ---------------------------------------------------------------- grafo

function graphChecks(nodes: readonly CampaignNode[], errors: string[]): void {
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));
  const state = new Map<string, 'VISITING' | 'DONE'>();
  const visit = (id: string, path: string[]): void => {
    const s = state.get(id);
    if (s === 'DONE') return;
    if (s === 'VISITING') { errors.push(`grafo com ciclo: ${[...path, id].join(' → ')}`); return; }
    state.set(id, 'VISITING');
    for (const pre of byId.get(id)?.prerequisites.allOf ?? []) visit(pre, [...path, id]);
    state.set(id, 'DONE');
  };
  for (const n of nodes) visit(n.nodeId, []);
  // Alcançabilidade a partir do prólogo (sucessores).
  const reached = new Set<string>(['P00-T01']);
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of nodes) {
      if (!reached.has(n.nodeId) && n.prerequisites.allOf.length > 0 && n.prerequisites.allOf.every((p) => reached.has(p))) { reached.add(n.nodeId); changed = true; }
    }
  }
  for (const n of nodes) if (!reached.has(n.nodeId)) errors.push(`nó ${n.nodeId} inalcançável a partir de P00-T01`);
}

/** Conjunto de nós que precisam estar concluídos antes de `nodeId` (fecho transitivo dos pré-requisitos). */
export function ancestors(nodes: readonly CampaignNode[], nodeId: string): Set<string> {
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));
  const out = new Set<string>();
  const stack = [...(byId.get(nodeId)?.prerequisites.allOf ?? [])];
  while (stack.length) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    stack.push(...(byId.get(id)?.prerequisites.allOf ?? []));
  }
  return out;
}

// ---------------------------------------------------------------- principal

export function validateBundle(bundle: ContentBundle): BuildReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const v = schemaValidators();
  const schemaCheck = (key: SchemaKey, items: readonly unknown[], idOf: (x: never) => string) => {
    for (const item of items) if (!v[key](item)) errors.push(`schema ${SCHEMAS[key]}: ${idOf(item as never)} — ${ajvErrors(v[key])}`);
  };
  schemaCheck('card', bundle.cards, (c: CardDefinition) => c.id);
  schemaCheck('printing', bundle.printings, (p: { printingId: string }) => p.printingId);
  schemaCheck('deck', bundle.decks, (d: { deckId: string }) => d.deckId);
  schemaCheck('product', bundle.products, (p: Product) => p.productId);
  schemaCheck('objective', bundle.objectives, (o: Objective) => o.objectiveId);
  schemaCheck('node', bundle.nodes, (n: CampaignNode) => n.nodeId);
  schemaCheck('rewardTable', bundle.rewardTables, (t: { rewardTableId: string }) => t.rewardTableId);
  schemaCheck('npc', bundle.npcs, (n: { npcId: string }) => n.npcId);
  schemaCheck('aiProfile', bundle.aiProfiles, (a: { aiProfileId: string }) => a.aiProfileId);
  schemaCheck('fixture', bundle.fixtures, (f: { fixtureId: string }) => f.fixtureId);
  schemaCheck('cosmetic', bundle.cosmetics, (c: { cosmeticId: string }) => c.cosmeticId);
  schemaCheck('dialogue', bundle.dialogues, (d: { dialogueId: string }) => d.dialogueId);
  schemaCheck('recipe', bundle.deckRecipes, (r: { recipeId: string }) => r.recipeId);

  // ---- IDs únicos
  const uniq: [string, readonly string[]][] = [
    ['carta', bundle.cards.map((c) => definitionKey(c.id, c.version))], ['impressão', bundle.printings.map((p) => p.printingId)],
    ['conjunto', bundle.sets.map((s) => s.setId)], ['deck', bundle.decks.map((d) => d.deckId)], ['produto', bundle.products.map((p) => p.productId)],
    ['nó', bundle.nodes.map((n) => n.nodeId)], ['objetivo', bundle.objectives.map((o) => o.objectiveId)], ['tabela', bundle.rewardTables.map((t) => t.rewardTableId)],
    ['NPC', bundle.npcs.map((n) => n.npcId)], ['perfil de IA', bundle.aiProfiles.map((a) => a.aiProfileId)], ['fixture', bundle.fixtures.map((f) => f.fixtureId)],
    ['cosmético', bundle.cosmetics.map((c) => c.cosmeticId)], ['preset', bundle.cosmeticPresets.map((p) => p.presetId)], ['diálogo', bundle.dialogues.map((d) => d.dialogueId)],
    ['capítulo', bundle.chapters.map((c) => c.chapterId)], ['receita', bundle.deckRecipes.map((r) => r.recipeId)],
  ];
  for (const [label, ids] of uniq) for (const d of duplicates(ids)) errors.push(`${label} duplicado: ${d}`);
  // Várias definições podem dividir a deckLimitKey (versões de regras do mesmo nome em sets diferentes, limite de 2
  // cópias somadas): a chave implica o mesmo nome, e duas definições nunca têm regras idênticas.
  const byLimitKey = new Map<string, CardDefinition[]>();
  for (const card of bundle.cards) byLimitKey.set(card.deckLimitKey, [...(byLimitKey.get(card.deckLimitKey) ?? []), card]);
  for (const [key, defs] of byLimitKey) {
    if (defs.length < 2) continue;
    if (new Set(defs.map((d) => d.name)).size > 1) errors.push(`deckLimitKey ${key} com nomes diferentes: ${defs.map((d) => d.name).join(', ')}`);
    const rules = defs.map((d) => canonicalize({ ...d, id: null, version: null }));
    for (const d of duplicates(rules)) errors.push(`deckLimitKey ${key}: duas definições com regras idênticas (${defs[rules.indexOf(d)]!.id})`);
  }

  // ---- catálogo
  let cat: Catalog;
  try {
    cat = buildCatalog(bundle.cards, bundle.printings);
  } catch (e) {
    errors.push(`catálogo inválido: ${(e as Error).message}`);
    return { errors, warnings, economy: economyAudit(bundle), puzzles: [], starterCompositionChecks: [], deckMetrics: {} };
  }
  const allKeys = new Set(bundle.cards.map((c) => c.deckLimitKey));
  for (const card of bundle.cards) checkCard(card, allKeys, errors);
  // Texto gerado dentro do limite de linhas do template (editor-de-cartas §19.4, ED-044): estouro bloqueia o build.
  errors.push(...textFitOverflows(bundle.cards, bundle.printings));
  const printing = (id: string) => cat.printings.get(id);
  const defOf = (printingId: string) => { const p = printing(printingId); return p ? cat.definitions.get(definitionKey(p.cardDefinitionId, p.cardDefinitionVersion)) : undefined; };
  const setIds = new Set(bundle.sets.map((s) => s.setId));
  for (const p of bundle.printings) {
    if (!setIds.has(p.setId)) errors.push(`impressão ${p.printingId}: conjunto ${p.setId} inexistente`);
    for (const e of bundledArtErrors(p)) errors.push(`impressão ${p.printingId}: ${e}`);
  }
  for (const card of bundle.cards) if (!bundle.printings.some((p) => p.cardDefinitionId === card.id)) errors.push(`carta ${card.id} sem impressão`);
  const usedOpcodes = new Set(bundle.cards.flatMap(cardOpcodes).filter((op) => !op.includes(':')));
  for (const op of usedOpcodes) if (!(OPCODES as readonly string[]).includes(op)) errors.push(`opcode fora do registro do motor: ${op}`);

  // ---- referências gerais
  const nodeIds = new Set(bundle.nodes.map((n) => n.nodeId));
  const npcIds = new Set(bundle.npcs.map((n) => n.npcId));
  const deckById = new Map(bundle.decks.map((d) => [d.deckId, d]));
  const productById = new Map(bundle.products.map((p) => [p.productId, p]));
  const cosmeticById = new Map(bundle.cosmetics.map((c) => [c.cosmeticId, c]));
  const presetIds = new Set(bundle.cosmeticPresets.map((p) => p.presetId));
  const dialogueIds = new Set(bundle.dialogues.map((d) => d.dialogueId));
  const objectiveById = new Map(bundle.objectives.map((o) => [o.objectiveId, o]));
  const tableById = new Map(bundle.rewardTables.map((t) => [t.rewardTableId, t]));
  const profileById = new Map(bundle.aiProfiles.map((a) => [a.aiProfileId, a]));
  const fixtureById = new Map(bundle.fixtures.map((f) => [f.fixtureId, f as ContentFixture]));
  const needPrinting = (where: string, id: string) => { if (!printing(id)) errors.push(`${where}: impressão ${id} inexistente`); };
  const needNode = (where: string, id: string | null) => { if (id && !nodeIds.has(id)) errors.push(`${where}: nó ${id} inexistente`); };
  for (const s of bundle.sets) needNode(`conjunto ${s.setId}`, s.unlockAfterNodeId);

  // ---- decks
  const starterPrintings = bundle.onboarding.inventory.map((i) => i.printingId);
  const metrics: Record<string, DeckMetrics> = {};
  for (const deck of bundle.decks) {
    for (const e of deck.entries) needPrinting(`deck ${deck.deckId}`, e.printingId);
    if (deck.cosmeticPresetId && !presetIds.has(deck.cosmeticPresetId)) errors.push(`deck ${deck.deckId}: preset ${deck.cosmeticPresetId} inexistente`);
    const result = validateDeck(deck.entries, cat, { energyTypes: deck.energyTypes });
    for (const e of result.errors) errors.push(`deck ${deck.deckId}: ${e.code} — ${e.message}`);
    for (const w of result.warnings) warnings.push(`deck ${deck.deckId}: ${w.code} — ${w.message}`);
    metrics[deck.deckId] = deckMetrics(deck, cat, { starterPrintingIds: starterPrintings });
  }
  const starters = bundle.decks.filter((d) => d.kind === 'STARTER');
  // Um deck inicial por tipo de Energia gerável (campanha §3.5, conteúdo 3.0.0).
  if (starters.length !== STARTER_DECKS) errors.push(`esperados ${STARTER_DECKS} decks iniciais, encontrados ${starters.length}`);
  if (new Set(starters.map((d) => d.energyTypes.join())).size !== starters.length || starters.some((d) => d.energyTypes.length !== 1)) errors.push('decks iniciais: um tipo de Energia por deck, todos diferentes');
  for (const deck of starters) {
    const pokemon = deck.entries.filter((e) => defOf(e.printingId)?.category === 'POKEMON');
    const trainers = deck.entries.filter((e) => defOf(e.printingId)?.category === 'TRAINER');
    if (pokemon.length !== 4 || trainers.length !== 6 || deck.entries.some((e) => e.count !== 2)) errors.push(`deck inicial ${deck.deckId} fora de §3.5 (4 Pokémon × 2 + 6 Treinadores × 2)`);
    if (deck.entries.some((e) => !starterPrintings.includes(e.printingId))) errors.push(`deck inicial ${deck.deckId} usa carta fora da coleção inicial`);
    if (metrics[deck.deckId]!.basicCopies !== 4) errors.push(`deck inicial ${deck.deckId} deve ter quatro Básicos`);
  }

  // ---- receitas de deck (campanha §3.7): decks jogáveis, completos, com a capa entre as cartas
  const eras = new Set(bundle.sets.map((s) => s.setId.toUpperCase().replace(/^(A\d)([A-Z])$/, (_, a: string, b: string) => `${a}${b.toLowerCase()}`)));
  for (const r of bundle.deckRecipes) {
    const where = `receita ${r.recipeId}`;
    for (const e of r.entries) needPrinting(where, e.printingId);
    if (!r.entries.some((e) => e.printingId === r.coverPrintingId)) errors.push(`${where}: a capa ${r.coverPrintingId} não está na lista`);
    else if (defOf(r.coverPrintingId)?.category !== 'POKEMON') errors.push(`${where}: a capa precisa ser um Pokémon`);
    if (!eras.has(r.era)) errors.push(`${where}: era ${r.era} não é um set do pacote`);
    const result = validateDeck(r.entries, cat, { energyTypes: r.energyTypes });
    for (const e of result.errors) errors.push(`${where}: ${e.code} — ${e.message}`);
    for (const w of result.warnings) {
      if (w.code === 'EVOLUTION_WITHOUT_PREVIOUS_STAGE') errors.push(`${where}: ${w.code} — ${w.message}`);
      else if (w.code === 'ATTACK_ENERGY_NOT_PRODUCED') warnings.push(`${where}: ${w.code} — ${w.message}`);
    }
  }
  const recipesOf = (c: string) => bundle.deckRecipes.filter((r) => r.category === c);
  if (recipesOf('META').length < MIN_RECIPES.META) errors.push(`receitas: esperadas ao menos ${MIN_RECIPES.META} do meta, encontradas ${recipesOf('META').length}`);
  if (recipesOf('COMMUNITY').length < MIN_RECIPES.COMMUNITY) errors.push(`receitas: esperadas ao menos ${MIN_RECIPES.COMMUNITY} da comunidade, encontradas ${recipesOf('COMMUNITY').length}`);
  for (const t of ENERGY_TYPES) {
    const n = recipesOf('TYPE').filter((r) => r.energyTypes.includes(t)).length;
    if (n < MIN_RECIPES.TYPE_PER_ENERGY) errors.push(`receitas: esperadas ao menos ${MIN_RECIPES.TYPE_PER_ENERGY} por tipo para ${t}, encontradas ${n}`);
  }

  // ---- produtos
  const nonPromo = bundle.printings.filter((p) => p.rarity !== 'PROMO');
  const directed = new Map<string, Product>();
  for (const product of bundle.products) {
    const where = `produto ${product.productId}`;
    needNode(where, product.availability.afterNodeId);
    if (product.availability.fromStart && product.availability.afterNodeId) errors.push(`${where}: fromStart e afterNodeId simultâneos`);
    if (product.kind === 'RANDOM_PACK' && product.tierSlots) {
      tierPackErrors(product, printing, errors);
    } else if (product.kind === 'RANDOM_PACK') {
      if (product.cardsPerPack !== 5) errors.push(`${where}: pacote aleatório precisa de 5 cartas`);
      if (product.price?.credits !== 100) errors.push(`${where}: preço de pacote deve ser 100 Créditos`);
      const slots = product.slots ?? [];
      if (slots.length !== 5) errors.push(`${where}: são esperadas 5 posições`);
      for (const slot of slots) {
        const expected = SLOT_TABLE[slot.position];
        const sum = Object.values(slot.categoryWeights).reduce((a, b) => a + b, 0);
        if (sum !== 100) errors.push(`${where}: posição ${slot.position} soma ${sum}% (≠100%)`);
        if (!expected || (Object.keys(expected) as RarityCategory[]).some((k) => expected[k] !== slot.categoryWeights[k])) errors.push(`${where}: posição ${slot.position} diverge de campanha §16.2`);
        for (const cat2 of Object.keys(slot.categoryWeights) as RarityCategory[]) {
          if (slot.categoryWeights[cat2] > 0 && !(product.pools?.[cat2]?.length)) errors.push(`${where}: categoria ${cat2} com chance positiva e pool vazio`);
        }
      }
      for (const [category, pool] of Object.entries(product.pools ?? {}) as [RarityCategory, { printingId: string; weight: number }[]][]) {
        for (const entry of pool) {
          const p = printing(entry.printingId);
          if (!p) { errors.push(`${where}: pool com impressão inexistente ${entry.printingId}`); continue; }
          if (p.rarity === 'PROMO') errors.push(`${where}: PROMO ${p.printingId} em pool aleatório`);
          else if (p.rarity !== category) errors.push(`${where}: ${p.printingId} (${p.rarity}) no pool ${category}`);
        }
        for (const d of duplicates(pool.map((e) => e.printingId))) errors.push(`${where}: ${d} repetida no pool ${category}`);
      }
    } else if (product.kind === 'FIXED_PACK') {
      for (const id of product.fixedContents ?? []) needPrinting(where, id);
      if (product.price !== null) errors.push(`${where}: pacote fixo não é vendido`);
    } else if (product.kind === 'DIRECTED_CARD') {
      const p = product.directedPrintingId ? printing(product.directedPrintingId) : undefined;
      if (!p) { errors.push(`${where}: impressão dirigida inexistente`); continue; }
      if (p.rarity === 'PROMO') { errors.push(`${where}: PROMO não é vendida`); continue; }
      directed.set(p.printingId, product);
      if (product.price?.credits !== DIRECTED_PRICE[p.rarity]) errors.push(`${where}: preço ${product.price?.credits} ≠ ${DIRECTED_PRICE[p.rarity]} (${p.rarity})`);
    } else if (product.kind === 'COSMETIC') {
      const c = product.cosmeticId ? cosmeticById.get(product.cosmeticId) : undefined;
      if (!c) { errors.push(`${where}: cosmético inexistente`); continue; }
      if (c.acquisition.kind !== 'EMPORIUM') errors.push(`${where}: cosmético ${c.cosmeticId} não é de Empório`);
      if (product.price?.credits !== c.acquisition.credits) errors.push(`${where}: preço diverge do cosmético`);
      if (product.availability.afterNodeId !== c.acquisition.requiredCompletedNodeId) errors.push(`${where}: disponibilidade diverge do requisito do cosmético`);
    }
  }
  for (const p of nonPromo) if (!directed.has(p.printingId)) errors.push(`impressão ${p.printingId} sem produto dirigido`);
  const tutorialPack = productById.get('pack-tutorial-v1');
  if (!tutorialPack || tutorialPack.kind !== 'FIXED_PACK') errors.push('pack-tutorial-v1 ausente ou não FIXED_PACK');
  else {
    const contents = tutorialPack.fixedContents ?? [];
    const defs = contents.map((id) => printing(id));
    if (contents.length !== 5 || new Set(contents).size !== 5) errors.push('pack-tutorial-v1: exige cinco impressões diferentes');
    for (const p of defs) {
      if (!p) continue;
      if (p.finish !== 'NORMAL' || p.rarity === 'ULTRA') errors.push(`pack-tutorial-v1: ${p.printingId} deve ser uma impressão normal, não ULTRA`);
      if (bundle.onboarding.inventory.some((i) => printing(i.printingId)?.cardDefinitionId === p.cardDefinitionId)) errors.push(`pack-tutorial-v1: ${p.printingId} já faz parte da coleção inicial`);
    }
    if (new Set(defs.map((p) => p?.cardDefinitionId)).size !== 5) errors.push('pack-tutorial-v1: cartas repetidas');
  }
  const randomPacks = bundle.products.filter((p) => p.kind === 'RANDOM_PACK');
  for (const [id, rule] of Object.entries(A1_PACK_RULES)) {
    const pack = productById.get(id);
    if (pack?.kind !== 'RANDOM_PACK') { errors.push(`${id} ausente ou não RANDOM_PACK`); continue; }
    if (rule.afterNodeId === null ? !pack.availability.fromStart : pack.availability.afterNodeId !== rule.afterNodeId) {
      errors.push(`${id} deve ficar disponível ${rule.afterNodeId ? `após ${rule.afterNodeId}` : 'desde o início'}`);
    }
  }
  for (const p of randomPacks) if (!A1_PACK_RULES[p.productId] && !TIER_PACK_RULES[p.productId]) errors.push(`pacote aleatório inesperado ${p.productId}`);
  // ULTRA do A1 só depois do chefe que fecha o pacote de origem (pacote de origem = único pool do A1 que contém a impressão).
  // Cartas dirigidas dos outros sets ficam à venda desde o início (campanha §15.2).
  const legacyPackOf = new Map<string, string[]>();
  for (const pack of randomPacks) {
    for (const pool of Object.values(pack.pools ?? {})) for (const e of pool) legacyPackOf.set(e.printingId, [...(legacyPackOf.get(e.printingId) ?? []), pack.productId]);
  }
  for (const [printingId, product] of directed) {
    const p = printing(printingId)!;
    if (p.setId !== 'a1') {
      if (!product.availability.fromStart) errors.push(`produto ${product.productId}: carta dirigida fora do A1 deve estar à venda desde o início`);
      continue;
    }
    if (p.rarity !== 'ULTRA') continue;
    const packs = legacyPackOf.get(printingId) ?? [];
    const expected = packs.length === 1 ? A1_PACK_RULES[packs[0]!]?.ultraAfterNodeId : NO_PACK_ULTRA_AFTER;
    if (product.availability.afterNodeId !== expected) errors.push(`produto ${product.productId}: ULTRA deve ficar disponível após ${expected}`);
  }
  // Toda impressão tem de onde vir: coleção inicial, pool de pacote, pacote fixo, carta dirigida ou carta-chave.
  const reachable = new Set<string>(bundle.onboarding.inventory.map((i) => i.printingId));
  for (const product of bundle.products) {
    for (const pool of Object.values(product.pools ?? {})) for (const e of pool) reachable.add(e.printingId);
    for (const pool of [product.tierPools, product.bonusSlot?.pools]) for (const ids of Object.values(pool ?? {})) for (const id of ids ?? []) reachable.add(id);
    for (const id of product.fixedContents ?? []) reachable.add(id);
    if (product.directedPrintingId) reachable.add(product.directedPrintingId);
  }
  for (const node of bundle.nodes) for (const id of node.keyCardReward?.printingIds ?? []) reachable.add(id);
  for (const p of bundle.printings) if (!reachable.has(p.printingId)) errors.push(`impressão ${p.printingId} inalcançável (sem pacote, produto ou recompensa)`);

  // ---- nós
  if (bundle.nodes.length !== 45) errors.push(`esperados 45 nós, encontrados ${bundle.nodes.length}`);
  for (const id of NODE_IDS) if (!nodeIds.has(id)) errors.push(`nó ausente ${id}`);
  const battleOrPuzzle = bundle.nodes.filter((n) => n.kind !== 'DISCOVERY').length;
  const discoveries = bundle.nodes.filter((n) => n.kind === 'DISCOVERY').length;
  const essential = bundle.nodes.filter((n) => n.essential).length;
  if (battleOrPuzzle !== 39) errors.push(`esperados 39 nós de batalha/puzzle, encontrados ${battleOrPuzzle}`);
  if (discoveries !== 6) errors.push(`esperadas 6 Descobertas, encontradas ${discoveries}`);
  if (essential !== 27) errors.push(`esperadas 27 vitórias obrigatórias, encontradas ${essential}`);
  graphChecks(bundle.nodes, errors);
  const objectiveOwners = new Map<string, string>();
  for (const node of bundle.nodes) {
    const where = `nó ${node.nodeId}`;
    const expectedPre = expectedPrerequisites(node.nodeId);
    if (JSON.stringify([...node.prerequisites.allOf].sort()) !== JSON.stringify(expectedPre.sort())) errors.push(`${where}: pré-requisitos ${node.prerequisites.allOf.join(',')} ≠ §2.2 (${expectedPre.join(',')})`);
    const expectedKind = node.chapterId === 'P00' ? 'TUTORIAL' : node.chapterId === 'F00' ? 'FINAL' : EXPECTED_KIND[node.nodeId.slice(4)];
    if (node.kind !== expectedKind) errors.push(`${where}: tipo ${node.kind} ≠ ${expectedKind}`);
    const shouldBeEssential = ['TUTORIAL', 'DUEL', 'BOSS', 'FINAL'].includes(node.kind);
    if (node.essential !== shouldBeEssential) errors.push(`${where}: essential incoerente com o tipo`);
    if (node.nodeId.slice(0, 3) !== node.chapterId) errors.push(`${where}: chapterId incoerente`);
    if (node.arenaId !== ARENA[node.chapterId]) errors.push(`${where}: arenaId ${node.arenaId} ≠ ${ARENA[node.chapterId]} (§21.5)`);
    if (!node.mapSceneId.startsWith('campaign-')) errors.push(`${where}: mapSceneId fora do padrão campaign-*`);
    if (!npcIds.has(node.npcId)) errors.push(`${where}: NPC ${node.npcId} inexistente`);
    for (const [d, prof] of Object.entries(node.difficultyProfiles ?? {})) {
      const ai = profileById.get(prof.aiProfileId);
      if (!ai) errors.push(`${where}: perfil ${prof.aiProfileId} inexistente`);
      else if (ai.policy !== d) errors.push(`${where}: perfil ${prof.aiProfileId} com política ${ai.policy} em ${d}`);
      else if (!prof.aiProfileId.startsWith(`${node.npcId}-`)) errors.push(`${where}: perfil ${prof.aiProfileId} não pertence a ${node.npcId}`);
      const deck = deckById.get(prof.npcDeckId);
      if (!deck) errors.push(`${where}: deck ${prof.npcDeckId} inexistente`);
      else if (deck.kind !== 'NPC') errors.push(`${where}: deck ${prof.npcDeckId} não é NPC`);
    }
    if (['DUEL', 'ELITE', 'BOSS', 'FINAL'].includes(node.kind) && !node.difficultyProfiles) errors.push(`${where}: duelo sem perfis de dificuldade`);
    if (node.nodeId === 'P00-T06' && !node.difficultyProfiles) errors.push(`${where}: duelo guiado precisa do perfil de IA de Cheren`);
    if (node.fixtureId) {
      const fx = fixtureById.get(node.fixtureId);
      if (!fx) errors.push(`${where}: fixture ${node.fixtureId} inexistente`);
      else if (fx.kind !== (node.kind === 'PUZZLE' ? 'PUZZLE' : 'TUTORIAL')) errors.push(`${where}: fixture ${fx.fixtureId} de tipo ${fx.kind}`);
    }
    for (const id of [node.completionObjectiveId, ...node.optionalObjectiveIds].filter((x): x is string => !!x)) {
      if (!objectiveById.has(id)) errors.push(`${where}: objetivo ${id} inexistente`);
      if (objectiveOwners.has(id)) errors.push(`${where}: objetivo ${id} já pertence a ${objectiveOwners.get(id)}`);
      objectiveOwners.set(id, node.nodeId);
      if (!id.startsWith(`${node.nodeId}-`)) errors.push(`${where}: objetivo ${id} com prefixo de outro nó`);
    }
    if (['DUEL', 'ELITE', 'BOSS', 'FINAL'].includes(node.kind)) {
      if (node.completionObjectiveId !== `${node.nodeId}-WIN`) errors.push(`${where}: objetivo de conclusão deve ser WIN`);
      if (JSON.stringify(node.optionalObjectiveIds) !== JSON.stringify([`${node.nodeId}-TACTIC`, `${node.nodeId}-DECK`])) errors.push(`${where}: objetivos opcionais devem ser TACTIC e DECK`);
    }
    // Prêmios
    const first = tableById.get(node.firstClearRewardTableId);
    if (!first) errors.push(`${where}: tabela ${node.firstClearRewardTableId} inexistente`);
    else {
      const exp = node.nodeId === 'P00-T06' ? { credits: 100, packs: 1, packKind: 'pack-a1-pikachu' } : EXPECTED_FIRST_CLEAR[node.kind]!;
      const packs = first.packs.reduce((s, p) => s + p.count, 0);
      if (first.credits !== exp.credits || packs !== exp.packs) errors.push(`${where}: prêmio inicial ${first.credits}/${packs} pacotes ≠ §15.1 (${exp.credits}/${exp.packs})`);
      const packId = exp.packKind === 'chapter' ? bundle.chapters.find((c) => c.chapterId === node.chapterId)?.packProductId ?? null : exp.packKind;
      if (packId && first.packs.some((p) => p.productId !== packId)) errors.push(`${where}: pacote do prêmio deveria ser ${packId}`);
      if (node.kind === 'BOSS' && first.medal !== `medal-c${node.chapterId.slice(1)}`) errors.push(`${where}: chefe deve conceder medal-c${node.chapterId.slice(1)}`);
      if (node.nodeId === 'F00-D03' && !first.cosmetics.includes('mat-circuit-complete')) errors.push(`${where}: deve conceder mat-circuit-complete`);
    }
    const repeatCredits = node.repeatRewardTableId ? tableById.get(node.repeatRewardTableId)?.credits ?? -1 : null;
    if (node.repeatRewardTableId && !tableById.has(node.repeatRewardTableId)) errors.push(`${where}: tabela repetível inexistente`);
    if (repeatCredits !== EXPECTED_REPEAT[node.kind]) errors.push(`${where}: repetível ${repeatCredits} ≠ ${EXPECTED_REPEAT[node.kind]}`);
    if (node.kind === 'BOSS') {
      const key = node.keyCardReward;
      if (!key || key.copies !== 2) errors.push(`${where}: chefe precisa de carta-chave ×2`);
      else {
        for (const id of key.printingIds) needPrinting(where, id);
        if (node.chapterId === 'C06' && (key.mode !== 'CHOICE' || key.printingIds.length !== 3 || key.printingIds.some((id) => defOf(id)?.ruleBox !== 'EX'))) errors.push(`${where}: prêmio deve ser escolha entre três ex`);
        // A carta-chave também precisa de origem dirigida antes do chefe (§16.5).
        const before = ancestors(bundle.nodes, node.nodeId);
        for (const id of key.printingIds) {
          const prod = directed.get(id);
          const after = prod?.availability.afterNodeId ?? null;
          if (!prod || (after !== null && !before.has(after))) errors.push(`${where}: carta-chave ${id} sem origem dirigida anterior ao chefe`);
        }
      }
    } else if (node.keyCardReward) errors.push(`${where}: só chefes concedem carta-chave`);
    if (node.kind === 'DISCOVERY') {
      for (const id of node.discoveryOffer ?? []) {
        needPrinting(where, id);
        const prod = directed.get(id);
        const after = prod?.availability.afterNodeId ?? null;
        if (!prod) errors.push(`${where}: alternativa ${id} sem produto permanente no Empório`);
        else if (after !== null && after !== node.nodeId && !ancestors(bundle.nodes, node.nodeId).has(after)) {
          errors.push(`${where}: alternativa ${id} só chega ao Empório depois da Descoberta`);
        }
      }
    }
    for (const id of node.supportDeckIds) {
      const deck = deckById.get(id);
      if (!deck) errors.push(`${where}: deck de apoio ${id} inexistente`);
      else if (deck.kind !== 'SUPPORT') errors.push(`${where}: ${id} não é deck de apoio`);
    }
    if (node.chapterId !== 'P00' && ['DUEL', 'ELITE', 'BOSS', 'FINAL'].includes(node.kind) && node.supportDeckIds.length === 0) errors.push(`${where}: duelo sem deck de apoio`);
    for (const key of Object.keys(node.roleTags ?? {})) if (!allKeys.has(key)) errors.push(`${where}: roleTag para carta inexistente ${key}`);
    for (const [label, id] of Object.entries(node.dialogue)) if (id && !dialogueIds.has(id)) errors.push(`${where}: diálogo ${label} ${id} inexistente`);
    if ((node.kind === 'BOSS' || node.kind === 'FINAL') && !node.dialogue.intro) errors.push(`${where}: chefe/final sem introdução`);
  }
  // Papel “apoio” do objetivo KNOCKED_OUT_ROLE precisa estar publicado no nó.
  for (const o of bundle.objectives) {
    for (const pr of o.predicates) {
      if (pr.type === 'KNOCKED_OUT_ROLE') {
        const node = bundle.nodes.find((n) => n.nodeId === objectiveOwners.get(o.objectiveId));
        if (!node || !Object.values(node.roleTags ?? {}).some((roles) => roles.includes(pr.role ?? ''))) errors.push(`objetivo ${o.objectiveId}: papel ${pr.role} sem roleTags no nó`);
      }
    }
  }

  // ---- objetivos
  for (const o of bundle.objectives) {
    if (o.grantKey !== `objective:${bundle.campaignId}:${o.objectiveId}`) errors.push(`objetivo ${o.objectiveId}: grantKey fora do padrão`);
    const extra = o.objectiveId.endsWith('-TACTIC') || o.objectiveId.endsWith('-DECK');
    if (o.reward.credits !== (extra ? 40 : 0)) errors.push(`objetivo ${o.objectiveId}: recompensa ${o.reward.credits} ≠ ${extra ? 40 : 0}`);
    if (!objectiveOwners.has(o.objectiveId)) errors.push(`objetivo ${o.objectiveId} sem nó`);
  }

  // ---- composição: nenhum objetivo DECK é cumprido pelos decks iniciais (§12.1, 3.2.0)
  const starterCompositionChecks: { objectiveId: string; satisfiedBy: string[] }[] = [];
  for (const o of bundle.objectives.filter((x) => x.objectiveId.endsWith('-DECK'))) {
    const satisfiedBy = starters.filter((deck) => o.predicates.every((pr) => pr.type === 'DECK_COMPOSITION' && pr.composition && evaluateComposition(metrics[deck.deckId]!, pr.composition).ok)).map((d) => d.deckId);
    starterCompositionChecks.push({ objectiveId: o.objectiveId, satisfiedBy });
    if (satisfiedBy.length) errors.push(`objetivo ${o.objectiveId} cumprido automaticamente por ${satisfiedBy.join(', ')}`);
    for (const pr of o.predicates) {
      if (pr.type !== 'DECK_COMPOSITION' || !pr.composition) continue;
      // Conjuntos exigidos devem estar liberados (Empório) antes dos encontros do capítulo.
      const node = bundle.nodes.find((n) => n.nodeId === objectiveOwners.get(o.objectiveId))!;
      for (const setId of pr.composition.minSetCards?.setIds ?? []) {
        const set = bundle.sets.find((s) => s.setId === setId);
        if (!set) { errors.push(`objetivo ${o.objectiveId}: conjunto ${setId} inexistente`); continue; }
        if (set.unlockAfterNodeId && !ancestors(bundle.nodes, node.nodeId).has(set.unlockAfterNodeId)) {
          errors.push(`objetivo ${o.objectiveId}: conjunto ${setId} só é liberado depois do encontro`);
        }
      }
    }
  }

  // ---- tabelas de prêmio
  for (const t of bundle.rewardTables) {
    for (const p of t.packs) if (!productById.has(p.productId)) errors.push(`tabela ${t.rewardTableId}: pacote ${p.productId} inexistente`);
    for (const c of t.cosmetics) {
      const cos = cosmeticById.get(c);
      if (!cos) errors.push(`tabela ${t.rewardTableId}: cosmético ${c} inexistente`);
      else if (cos.acquisition.kind !== 'GRANT') errors.push(`tabela ${t.rewardTableId}: cosmético ${c} não é concessão`);
    }
  }

  // ---- NPCs, IA, cosméticos, presets, capítulos, diálogos
  for (const npc of bundle.npcs) {
    for (const e of portraitErrors(npc.portraitAssetKey)) errors.push(`NPC ${npc.npcId}: ${e}`);
    if (!presetIds.has(npc.cosmeticPresetId)) errors.push(`NPC ${npc.npcId}: preset ${npc.cosmeticPresetId} inexistente`);
    for (const d of ['story', 'standard', 'expert']) if (!profileById.has(`${npc.npcId}-${d}-v1`)) errors.push(`NPC ${npc.npcId}: perfil ${d} ausente`);
  }
  for (const id of PLAYMAT_IDS) if (cosmeticById.get(id)?.kind !== 'PLAYMAT') errors.push(`playmat ${id} ausente`);
  if (bundle.cosmetics.filter((c) => c.kind === 'PLAYMAT').length !== 9) errors.push('são esperados exatamente nove playmats');
  for (const c of bundle.cosmetics) {
    needNode(`cosmético ${c.cosmeticId}`, c.acquisition.requiredCompletedNodeId);
    if (c.kind === 'COIN') for (const e of coinArtErrors(c.visual.assetKey)) errors.push(`cosmético ${c.cosmeticId}: ${e}`);
    if (c.kind === 'SLEEVE') for (const e of sleeveArtErrors(c.visual.assetKey)) errors.push(`cosmético ${c.cosmeticId}: ${e}`);
    if (c.fallbackCosmeticId && !cosmeticById.has(c.fallbackCosmeticId)) errors.push(`cosmético ${c.cosmeticId}: fallback inexistente`);
    if (c.acquisition.kind === 'EMPORIUM' && !bundle.products.some((p) => p.cosmeticId === c.cosmeticId)) errors.push(`cosmético ${c.cosmeticId}: sem produto no Empório`);
    const expectedPrice = c.kind === 'PLAYMAT' ? 500 : c.kind === 'SLEEVE' ? 200 : c.kind === 'COIN' ? 300 : 0;
    if (c.acquisition.kind === 'EMPORIUM' && c.acquisition.credits !== expectedPrice) errors.push(`cosmético ${c.cosmeticId}: preço ${c.acquisition.credits} ≠ ${expectedPrice}`);
    if (c.kind === 'PLAYMAT' && c.acquisition.kind === 'EMPORIUM' && !/^C0[1-6]-E06$/.test(c.acquisition.requiredCompletedNodeId ?? '')) errors.push(`playmat ${c.cosmeticId}: só após o chefe correspondente`);
  }
  for (const preset of bundle.cosmeticPresets) {
    const kinds: [string, string][] = [[preset.playmatId, 'PLAYMAT'], [preset.sleeveId, 'SLEEVE'], [preset.coinId, 'COIN'], [preset.defaultEntryFlairId, 'FLAIR']];
    for (const [id, kind] of kinds) if (cosmeticById.get(id)?.kind !== kind) errors.push(`preset ${preset.presetId}: ${id} não é ${kind}`);
  }
  for (const chapter of bundle.chapters) {
    const where = `capítulo ${chapter.chapterId}`;
    if (!npcIds.has(chapter.specialistNpcId)) errors.push(`${where}: especialista inexistente`);
    if (chapter.setId && !setIds.has(chapter.setId)) errors.push(`${where}: conjunto inexistente`);
    if (chapter.packProductId && !productById.has(chapter.packProductId)) errors.push(`${where}: pacote inexistente`);
    if (cosmeticById.get(chapter.playmatId)?.kind !== 'PLAYMAT') errors.push(`${where}: playmat inexistente`);
    if (chapter.arenaId !== ARENA[chapter.chapterId]) errors.push(`${where}: arena ${chapter.arenaId} ≠ ${ARENA[chapter.chapterId]}`);
    for (const id of [chapter.journal.intro, chapter.journal.outro]) if (!dialogueIds.has(id)) errors.push(`${where}: diálogo ${id} inexistente`);
  }
  const speakers = new Set([...npcIds, 'diario', 'narrador']);
  for (const d of bundle.dialogues) for (const line of d.lines) if (!speakers.has(line.speakerId)) errors.push(`diálogo ${d.dialogueId}: falante ${line.speakerId} desconhecido`);
  for (const preset of bundle.decks.map((d) => d.cosmeticPresetId).filter((x): x is string => !!x)) if (!presetIds.has(preset)) errors.push(`preset ${preset} inexistente`);

  // ---- onboarding
  const ob = bundle.onboarding;
  if (ob.credits !== 300) errors.push('onboarding: são 300 Créditos iniciais');
  if (ob.starterDeckIds.length !== STARTER_DECKS || ob.starterDeckIds.some((id) => deckById.get(id)?.kind !== 'STARTER')) errors.push(`onboarding: ${STARTER_DECKS} decks iniciais`);
  // 4 Pokémon por deck inicial + os 6 Treinadores básicos, 2 cópias de cada.
  const starterPrintingCount = STARTER_DECKS * 4 + 6;
  const inv = ob.inventory.reduce((s, i) => s + i.count, 0);
  if (inv !== starterPrintingCount * 2 || ob.inventory.length !== starterPrintingCount || ob.inventory.some((i) => i.count !== 2)) {
    errors.push(`onboarding: inventário deve ter ${starterPrintingCount * 2} cartas (${starterPrintingCount} × 2), tem ${inv}`);
  }
  for (const i of ob.inventory) needPrinting('onboarding', i.printingId);
  for (const deck of starters) {
    for (const e of deck.entries) {
      const have = ob.inventory.find((i) => i.printingId === e.printingId)?.count ?? 0;
      if (have < e.count) errors.push(`onboarding: inventário não cobre ${deck.deckId} (${e.printingId})`);
    }
  }
  if (JSON.stringify(ob.packs) !== JSON.stringify([{ productId: 'pack-tutorial-v1', count: 1 }, { productId: 'pack-a1-pikachu', count: 1 }])) errors.push('onboarding: 1 pacote tutorial + 1 pacote Genetic Apex — Pikachu');
  for (const id of ob.cosmeticIds) if (cosmeticById.get(id)?.acquisition.kind !== 'FREE') errors.push(`onboarding: cosmético ${id} não é gratuito`);
  if (ob.firstNodeId !== 'P00-T01') errors.push('onboarding: primeiro nó deve ser P00-T01');

  // ---- fixtures: referências, capacidade e solvabilidade
  const resolvePrinting = (pid: string) => cat.definitionKeyOfPrinting(pid);
  const puzzles: PuzzleCheck[] = [];
  for (const fx of bundle.fixtures as readonly ContentFixture[]) {
    const where = `fixture ${fx.fixtureId}`;
    for (const sideKey of ['HUMAN', 'NPC'] as const) {
      const side = fx.players[sideKey];
      const all = [...side.deck, ...side.hand, ...side.discard, ...[side.active, ...side.bench].flatMap((m) => (m ? [...m.stack, ...(m.toolPrintingId ? [m.toolPrintingId] : [])] : []))];
      for (const id of all) needPrinting(where, id);
      if (side.hand.length > 10) errors.push(`${where}: mão acima de 10`);
      if (side.bench.length > 3) errors.push(`${where}: Banco acima de 3`);
      if (all.length > 20) errors.push(`${where}: mais de 20 cartas em ${sideKey}`);
      for (const m of [side.active, ...side.bench]) {
        if (!m) continue;
        const defs = m.stack.map((id) => defOf(id));
        if (defs[0] && !(isPokemon(defs[0]) && defs[0].stage === 'BASIC') && !isFossil(defs[0])) errors.push(`${where}: pilha começa sem Básico`);
        for (let i = 1; i < defs.length; i += 1) {
          const d = defs[i]; const prev = defs[i - 1];
          if (!d || !prev || !isPokemon(d) || !d.evolvesFrom.includes(prev.deckLimitKey)) errors.push(`${where}: pilha com evolução incompatível`);
        }
      }
    }
    if (fx.stadiumPrintingId) needPrinting(where, fx.stadiumPrintingId);
    const node = bundle.nodes.find((n) => n.fixtureId === fx.fixtureId);
    if (!node) { errors.push(`${where} sem nó`); continue; }
    if (fx.solution) {
      const objective = objectiveById.get(node.completionObjectiveId ?? '');
      const turnLimit = node.turnLimit?.ownTurns ?? null;
      let solved = true;
      let detail = '';
      let ownTurnsUsed: number | null = null;
      let actions = 0;
      for (const seed of PUZZLE_SEEDS) {
        const run = runScript(fx, cat, resolvePrinting, seed);
        actions = run.actions.length;
        const won = run.state.result?.winner === 'A';
        const used = run.state.stats.A.ownTurnsAtWin !== null ? run.state.stats.A.ownTurnsAtWin - run.firstHumanOwnTurn + 1 : null;
        ownTurnsUsed = used;
        const objectiveOk = objective ? evaluateObjective(objective, { state: run.state, firstHumanOwnTurn: run.firstHumanOwnTurn }) : false;
        if (run.error || !won || !objectiveOk || (turnLimit !== null && (used === null || used > turnLimit))) {
          solved = false;
          detail = `semente ${seed}: ${run.error ?? (!won ? 'sem vitória do humano' : !objectiveOk ? 'objetivo composto não cumprido' : `excedeu ${turnLimit} turnos próprios`)}`;
          break;
        }
      }
      if (!solved) errors.push(`${where}: solução não verificada — ${detail}`);
      puzzles.push({ fixtureId: fx.fixtureId, nodeId: node.nodeId, seeds: PUZZLE_SEEDS, solved, ownTurnsUsed, turnLimit, actions, detail: solved ? 'vitória do humano com objetivo composto' : detail });
    } else if (node.nodeId !== 'P00-T06') {
      errors.push(`${where}: tutorial/puzzle sem solução declarada`);
    }
  }
  // T06: lado NPC idêntico ao deck único de Cheren; lado humano = Maré Serena.
  const t06 = fixtureById.get('fx-p00-t06');
  const t06Node = bundle.nodes.find((n) => n.nodeId === 'P00-T06');
  if (t06 && t06Node?.difficultyProfiles) {
    const multiset = (ids: readonly string[]) => [...ids].sort().join('|');
    const npcDeck = deckById.get(t06Node.difficultyProfiles.STANDARD.npcDeckId);
    const npcIdsList = [...t06.players.NPC.hand, ...t06.players.NPC.deck];
    if (!npcDeck || multiset(npcIdsList) !== multiset(npcDeck.entries.flatMap((e) => Array(e.count).fill(e.printingId) as string[]))) errors.push('fixture fx-p00-t06: lado NPC diverge do deck de Cheren');
    const mare = deckById.get('starter-mare-serena');
    const humanList = [...t06.players.HUMAN.hand, ...t06.players.HUMAN.deck];
    if (!mare || multiset(humanList) !== multiset(mare.entries.flatMap((e) => Array(e.count).fill(e.printingId) as string[]))) errors.push('fixture fx-p00-t06: lado humano diverge da Maré Serena');
  }

  // ---- economia
  const economy = economyAudit(bundle);
  if (economy.mandatory !== EXPECTED_MANDATORY) errors.push(`economia: rota obrigatória ${economy.mandatory} ≠ ${EXPECTED_MANDATORY}`);
  if (economy.maxOneTime !== EXPECTED_MAX_ONE_TIME) errors.push(`economia: máximo único ${economy.maxOneTime} ≠ ${EXPECTED_MAX_ONE_TIME}`);
  if (economy.objectiveCount !== 54) errors.push(`economia: esperados 54 objetivos extras pagos, encontrados ${economy.objectiveCount}`);

  return { errors, warnings, economy, puzzles, starterCompositionChecks, deckMetrics: metrics };
}
