// Validação em quatro níveis do Estúdio (editor-de-cartas.md §24; códigos da DSL §16):
//   STRUCTURE (schema/IDs) · EXECUTION (opcodes, referências, seletores) · RULES (regra ex, Treinador,
//   evolução, travas de modo) · DESIGN (balanceamento, arte, overflow). Os três primeiros bloqueiam a
//   publicação; DESIGN é aviso, exceto overflow/ilegibilidade crítica. Mensagens em PT-BR com caminho
//   para “Ir para o campo”; nunca apenas “validation failed”.
import { formulaSize } from '../battle/formula.ts';
import { deckLimitKey, deriveName } from '../cards/naming.ts';
import { cardFace, catalogNames } from '../cards/text.ts';
import type {
  Ability, AdditionalCost, Attack, CardDefinition, CardPrinting, Condition, EffectBlock, Formula, Operation, Selector, Timing,
} from '../cards/types.ts';
import { ENERGY_TYPES } from '../cards/types.ts';
import { jcsHash } from '../hash/jcs.ts';
import { analyzeBalance } from './balance.ts';
import { compileDraft } from './compile.ts';
import {
  ABILITY_TIMING, ALLOWED_TRAINER_TIMINGS, compatibleTemplates, FINISH_PRESETS, isFossilRules, POINTS_BY_RULE_BOX, type EditorDraft,
  type FinishPresetId,
} from './draft.ts';
import { pointerSegments, validateAgainstSchema, deepEqual, type SchemaIssue } from './jsonschema.ts';
import { describePath } from './labels.ts';
import { isContinuousOpcode, isKnownOpcode } from './opcodes.ts';
import { CARD_DEFINITION_SCHEMA, CARD_PRINTING_SCHEMA, EDITOR_DRAFT_SCHEMA } from './schemas.generated.ts';
import { estimateTextFit } from './textfit.ts';

export const VALIDATOR_VERSION = 'studio-validator-1';

export type ValidationLevel = 'STRUCTURE' | 'EXECUTION' | 'RULES' | 'DESIGN';
export const LEVELS: readonly ValidationLevel[] = ['STRUCTURE', 'EXECUTION', 'RULES', 'DESIGN'];
export const LEVEL_LABEL: Record<ValidationLevel, string> = { STRUCTURE: 'Estrutura', EXECUTION: 'Execução', RULES: 'Regras', DESIGN: 'Design e apresentação' };
export type Severity = 'ERROR' | 'WARNING' | 'INFO';
export type EditorTab = 'RULES' | 'ART' | 'FINISH' | 'TESTS' | 'PUBLISH';
export const TAB_LABEL: Record<EditorTab, string> = { RULES: 'Regras', ART: 'Arte', FINISH: 'Acabamento', TESTS: 'Testes', PUBLISH: 'Publicação' };

export type ValidationIssue = {
  readonly code: string;
  readonly level: ValidationLevel;
  readonly severity: Severity;
  readonly message: string;
  /** Caminho no rascunho (ex.: ['rules','attacks',1,'name']). */
  readonly path: readonly (string | number)[];
  readonly tab: EditorTab;
};

export type ValidationContext = {
  /** Outras definições do catálogo local (base + autorais) para evolução, ciclos e clones de nome. */
  readonly catalog?: readonly CardDefinition[];
  /** Regras da versão de origem (VARIANT: travadas; NEW_VERSION: categoria/ID/ruleBox). */
  readonly sourceRules?: CardDefinition | null;
  /** Última versão já publicada do alvo (republicação de NEW_DEFINITION/FORK). */
  readonly publishedTarget?: CardDefinition | null;
  /** Assets presentes no armazenamento local; null/undefined = não verificar ASSET_MISSING. */
  readonly knownAssetIds?: ReadonlySet<string> | null;
  /** Dimensões conhecidas dos assets (aviso de baixa resolução). */
  readonly assetInfo?: ReadonlyMap<string, { readonly width: number | null; readonly height: number | null }>;
  /** Pular checagens de impressões (validação só de regras importadas). */
  readonly rulesOnly?: boolean;
};

export type LevelCount = { readonly errors: number; readonly warnings: number };

export type ValidationReport = {
  readonly validatorVersion: string;
  readonly issues: readonly ValidationIssue[];
  readonly errors: number;
  readonly warnings: number;
  readonly byLevel: Readonly<Record<ValidationLevel, LevelCount>>;
  readonly publishable: boolean;
  readonly rulesHash: string;
};

/** Resumo persistido em editor_revisions.validation_summary_json (§27): a biblioteca não revalida para listar. */
export type ValidationSummary = {
  readonly errors: number;
  readonly warnings: number;
  readonly byLevel: Readonly<Record<ValidationLevel, LevelCount>>;
  readonly validatorVersion: string;
  readonly rulesHash: string;
};

export function summarize(report: ValidationReport): ValidationSummary {
  return { errors: report.errors, warnings: report.warnings, byLevel: report.byLevel, validatorVersion: report.validatorVersion, rulesHash: report.rulesHash };
}

type Path = readonly (string | number)[];

type Collector = {
  readonly issues: ValidationIssue[];
  readonly add: (code: string, level: ValidationLevel, severity: Severity, path: Path, message: string, tab?: EditorTab) => void;
};

function tabOf(path: Path): EditorTab {
  if (path[0] === 'testScenarios') return 'TESTS';
  if (path[0] === 'target' || path[0] === 'mode') return 'PUBLISH';
  if (path[0] === 'printings') {
    const field = path[2];
    if (field === 'finish' || field === 'finishSettings' || field === 'rarity' || field === 'variant') return 'FINISH';
    return 'ART';
  }
  if (path[0] === 'authoring') return path[1] === 'maskPaint' ? 'FINISH' : 'ART';
  return 'RULES';
}

function collector(): Collector {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  return {
    issues,
    add: (code, level, severity, path, message, tab) => {
      const key = `${code}\u0000${path.join('/')}\u0000${message}`;
      if (seen.has(key)) return;
      seen.add(key);
      issues.push({ code, level, severity, message, path, tab: tab ?? tabOf(path) });
    },
  };
}

// ---------------------------------------------------------------- nível 1: estrutura (schema da spec)

type SchemaMapping = { readonly code: string; readonly level: ValidationLevel; readonly message?: string } | 'SKIP';

/** Converte um problema do schema em código/nível do Estúdio (com mensagem amigável quando conhecida). */
function mapRulesSchemaIssue(issue: SchemaIssue, rules: CardDefinition): SchemaMapping {
  const seg = pointerSegments(issue.path);
  const last = seg[seg.length - 1];
  const trainer = rules.category === 'TRAINER';
  if (seg.length === 1 && last === 'baseHp' && !trainer) return { code: 'HP_INVALID', level: 'STRUCTURE', message: 'HP deve ser um inteiro de 10 a 9990, múltiplo de 10 (sem negativos ou frações).' };
  if (seg.length === 1 && last === 'retreatCost') return { code: 'RETREAT_INVALID', level: 'STRUCTURE', message: 'Recuo deve ser um inteiro de 0 a 10.' };
  if (seg.length === 1 && last === 'baseName') return { code: 'BASE_NAME_INVALID', level: 'STRUCTURE', message: 'Nome-base deve ter de 1 a 50 caracteres.' };
  if (seg.length === 1 && last === 'types' && issue.keyword === 'maxItems') return 'SKIP';
  if (seg.length === 1 && last === 'types' && issue.keyword === 'minItems') return { code: 'TYPE_REQUIRED', level: 'STRUCTURE', message: 'Escolha o tipo do Pokémon.' };
  if (seg.length === 1 && last === 'evolvesFrom' && issue.keyword === 'minItems') return { code: 'EVOLUTION_SOURCE_MISSING', level: 'RULES', message: 'Estágio 1/2 precisa de origem de evolução: escolha a carta de que ele evolui.' };
  if (seg.length === 1 && last === 'evolvesFrom' && issue.keyword === 'maxItems') return { code: 'EVOLUTION_NOT_ALLOWED', level: 'RULES', message: 'Pokémon Básico não evolui de outra carta.' };
  if (seg.length === 1 && (last === 'knockoutPoints' || last === 'name' || last === 'deckLimitKey') && (issue.keyword === 'const' || issue.keyword === 'type') && !trainer) return 'SKIP';
  if (seg[0] === 'attacks' && seg[2] === 'energyCost' && seg.length === 4 && issue.keyword === 'additionalProperties') {
    return { code: 'ATTACK_ENERGY_INVALID', level: 'EXECUTION', message: `O custo contém um tipo de Energia que este motor não reconhece (${String(last)}). Dragão e Incolor não são Energias geradas; Incolor entra como “COLORLESS”.` };
  }
  if (seg[0] === 'attacks' && seg[2] === 'energyCost' && seg.length === 4) return { code: 'ATTACK_COST_INVALID', level: 'STRUCTURE', message: 'Cada tipo no custo aceita de 0 a 10 Energias.' };
  if (seg[0] === 'attacks' && seg.length === 3 && (last === 'baseDamage' || last === 'damageFormula')) return 'SKIP';
  if (seg[0] === 'attacks' && seg.length === 2 && issue.keyword === 'oneOf') return 'SKIP';
  if (seg[0] === 'abilities' && last === 'usageLimit' && issue.keyword === 'required') return { code: 'USAGE_LIMIT_REQUIRED', level: 'RULES', message: 'Habilidade ativada exige limite de uso (escopo + quantidade).' };
  if (seg[0] === 'abilities' && last === 'usageLimit' && issue.keyword === 'type') return { code: 'USAGE_LIMIT_REQUIRED', level: 'RULES', message: 'Habilidade ativada exige limite de uso (escopo + quantidade).' };
  if (seg[0] === 'abilities' && last === 'trigger' && issue.keyword === 'required') return { code: 'TRIGGER_MISSING', level: 'EXECUTION', message: 'Habilidade disparada precisa de gatilho (evento + filtro).' };
  if (seg[0] === 'abilities' && seg.length === 2 && issue.keyword === 'not') return { code: 'TRIGGER_NOT_ALLOWED', level: 'EXECUTION', message: 'Só Habilidades disparadas têm gatilho.' };
  if (seg[0] === 'abilities' && last === 'endsTurn' && issue.keyword === 'const') return { code: 'ENDS_TURN_NOT_ALLOWED', level: 'RULES', message: '“Encerra o turno” só é permitido em Habilidade ativada.' };
  if (seg[0] === 'abilities' && last === 'effects' && issue.keyword === 'minItems') return { code: 'ABILITY_EFFECT_REQUIRED', level: 'STRUCTURE', message: 'A Habilidade precisa de pelo menos um bloco de efeito.' };
  if (last === 'chooser' && issue.keyword === 'required') return { code: 'CHOOSER_REQUIRED', level: 'EXECUTION', message: 'Escolha (CHOOSE) precisa declarar quem escolhe: você ou o oponente.' };
  if (seg[seg.length - 2] === 'operation' && last === 'type') return 'SKIP';
  if (issue.keyword === 'unevaluatedProperties') return { code: 'PARAM_INVALID', level: 'STRUCTURE', message: `Parâmetro “${String(last)}” não existe para esta operação.` };
  if (trainer) {
    if (seg.length === 0 && issue.keyword === 'not') return { code: 'TRAINER_FIELD_INVALID', level: 'RULES', message: 'Treinador não aceita estágio, tipos, Recuo, Fraqueza nem evolução.' };
    if (seg.length === 1 && last === 'category') return 'SKIP';
    if (seg.length === 1 && last === 'ruleBox') return { code: 'TRAINER_FIELD_INVALID', level: 'RULES', message: 'Treinadores não podem receber regra ex nesta ruleset.' };
    if (seg.length === 1 && (last === 'attacks' || last === 'abilities')) return { code: 'TRAINER_FIELD_INVALID', level: 'RULES', message: 'Treinador não tem ataques nem Habilidades.' };
    if (seg.length === 1 && (last === 'baseHp' || last === 'knockoutPoints')) return { code: 'TRAINER_FIELD_INVALID', level: 'RULES', message: 'Treinador não tem HP nem pontos de Nocaute (use o comportamento de Fóssil).' };
    if (seg[0] === 'trainerRules' && last === 'destinationAfterPlay' && issue.keyword === 'const') return 'SKIP';
  } else if (seg.length === 0 && issue.keyword === 'not') {
    return { code: 'POKEMON_FIELD_INVALID', level: 'RULES', message: 'Pokémon não aceita subtipo, regras ou efeitos de Treinador.' };
  }
  return { code: 'SCHEMA_INVALID', level: 'STRUCTURE' };
}

function structureRules(c: Collector, rules: CardDefinition, compiled: CardDefinition): void {
  for (const issue of validateAgainstSchema(CARD_DEFINITION_SCHEMA, compiled)) {
    const mapped = mapRulesSchemaIssue(issue, rules);
    if (mapped === 'SKIP') continue;
    const path: Path = ['rules', ...pointerSegments(issue.path)];
    c.add(mapped.code, mapped.level, 'ERROR', path, mapped.message ?? `${describePath(path, rules)}: ${issue.message}.`);
  }
}

function mapPrintingIssue(issue: SchemaIssue): SchemaMapping {
  const seg = pointerSegments(issue.path);
  const last = seg[seg.length - 1];
  if (seg[0] === 'finishSettings' && last === 'intensity' && issue.keyword === 'const') return { code: 'NORMAL_FINISH_INTENSITY', level: 'RULES', message: 'Acabamento NORMAL exige intensidade 0 (sem iridescência).' };
  if (seg[0] === 'finishSettings' && last === 'foilMaskAssetId' && issue.keyword === 'required') return { code: 'MASK_ASSET_REQUIRED', level: 'RULES', message: 'Máscara importada ou pintada exige o asset da máscara.' };
  if (last === 'artKey' || last === 'artAssetId' || (seg.length === 0 && issue.keyword === 'oneOf')) return 'SKIP';
  if (last === 'cardDefinitionId' || last === 'cardDefinitionVersion') return 'SKIP';
  return { code: 'PRINTING_INVALID', level: 'STRUCTURE' };
}

// ---------------------------------------------------------------- nível 2: execução

type OutputKind = 'COINS' | 'TARGETS' | 'CARDS' | 'COUNT';
type Scope = {
  readonly produced: Map<string, OutputKind>;
  /** Seletores EVENT_SOURCE/EVENT_TARGET têm significado (gatilho, substituição, efeito atrasado). */
  readonly eventContext: boolean;
  /** Efeito de ataque (fora de efeito atrasado): DEFENDING e ATTACK_FAILS só existem aqui. */
  readonly attackContext: boolean;
};

const SINGLE_SCOPES = new Set(['SELF', 'OWN_ACTIVE', 'OPPONENT_ACTIVE', 'EVENT_SOURCE', 'EVENT_TARGET', 'DEFENDING']);

function checkSelector(c: Collector, s: Selector | null | undefined, path: Path, scope: Scope, produceOutputs: boolean): void {
  if (!s || typeof s !== 'object') return;
  if ((s.scope === 'EVENT_SOURCE' || s.scope === 'EVENT_TARGET') && !scope.eventContext) {
    c.add('SELECTOR_IMPOSSIBLE', 'EXECUTION', 'ERROR', [...path, 'scope'], `Seletor impossível: “${s.scope === 'EVENT_SOURCE' ? 'origem do evento' : 'alvo do evento'}” só existe em gatilhos, substituições ou efeitos atrasados.`);
  }
  if (s.scope === 'DEFENDING' && !scope.attackContext) {
    c.add('SELECTOR_IMPOSSIBLE', 'EXECUTION', 'ERROR', [...path, 'scope'], 'Seletor impossível: “Pokémon Defensor” só existe nos efeitos de um ataque (não em Habilidades, Treinadores nem efeitos atrasados).');
  }
  if (s.scope === 'OUTPUT') {
    if (!s.ref) c.add('SELECTOR_IMPOSSIBLE', 'EXECUTION', 'ERROR', [...path, 'ref'], 'Seletor “saída nomeada” precisa indicar qual saída anterior usar.');
    else if (!scope.produced.has(s.ref)) c.add('FORMULA_REFERENCE_MISSING', 'EXECUTION', 'ERROR', [...path, 'ref'], `O seletor usa “${s.ref}”, mas nenhuma etapa anterior produz esse resultado.`);
    else if (scope.produced.get(s.ref) !== 'TARGETS') c.add('FORMULA_REFERENCE_MISSING', 'EXECUTION', 'ERROR', [...path, 'ref'], `“${s.ref}” guarda moedas, não alvos.`);
  }
  if (s.pick?.mode === 'CHOOSE') {
    if (typeof s.pick.min === 'number' && typeof s.pick.max === 'number' && s.pick.min > s.pick.max) {
      c.add('PARAM_INVALID', 'STRUCTURE', 'ERROR', [...path, 'pick'], 'Escolha com mínimo maior que o máximo.');
    }
    if (SINGLE_SCOPES.has(s.scope)) c.add('PICK_UNNEEDED', 'DESIGN', 'INFO', [...path, 'pick'], 'Este escopo tem um único Pokémon: a escolha é desnecessária.');
  }
  if (s.outputId && produceOutputs) produce(c, scope, s.outputId, 'TARGETS', [...path, 'outputId']);
}

function produce(c: Collector, scope: Scope, id: string, kind: OutputKind, path: Path): void {
  if (scope.produced.has(id)) c.add('OUTPUT_ID_DUPLICATE', 'STRUCTURE', 'ERROR', path, `Dois blocos usam o mesmo nome de saída “${id}”.`);
  scope.produced.set(id, kind);
}

function checkFormula(c: Collector, f: Formula | null | undefined, path: Path, scope: Scope): void {
  if (!f || typeof f !== 'object') return;
  const size = formulaSize(f);
  if (size.nodes > 32 || size.depth > 6) c.add('FORMULA_TOO_COMPLEX', 'EXECUTION', 'ERROR', path, `Fórmula com ${size.nodes} nós e profundidade ${size.depth}; o limite é 32 nós e profundidade 6.`);
  const walk = (node: Formula, p: Path) => {
    if (!node || typeof node !== 'object') return;
    if (node.op === 'COUNT_HEADS' || node.op === 'COUNT_TAILS' || node.op === 'OUTPUT_COUNT') {
      const ref = node.reference ?? '';
      if (!scope.produced.has(ref)) c.add('FORMULA_REFERENCE_MISSING', 'EXECUTION', 'ERROR', [...p, 'reference'], `A fórmula usa ${ref ? `“${ref}”` : 'uma referência vazia'}, mas nenhuma etapa anterior produz esse resultado.`);
      else if (node.op !== 'OUTPUT_COUNT' && scope.produced.get(ref) !== 'COINS') c.add('FORMULA_REFERENCE_MISSING', 'EXECUTION', 'ERROR', [...p, 'reference'], `“${ref}” guarda alvos, não moedas: não há caras/coroas para contar.`);
    }
    if (node.selector) checkSelector(c, node.selector, [...p, 'selector'], scope, false);
    (node.operands ?? []).forEach((o, i) => walk(o, [...p, 'operands', i]));
  };
  walk(f, path);
}

function checkCondition(c: Collector, cond: Condition | null | undefined, path: Path, scope: Scope): void {
  if (!cond || typeof cond !== 'object') return;
  if (cond.left) checkFormula(c, cond.left, [...path, 'left'], scope);
  if (cond.right) checkFormula(c, cond.right, [...path, 'right'], scope);
  if (cond.selector) checkSelector(c, cond.selector, [...path, 'selector'], scope, false);
  if (cond.op === 'OUTPUT_CARDS_MATCH') {
    const ref = cond.reference ?? '';
    if (!scope.produced.has(ref)) c.add('FORMULA_REFERENCE_MISSING', 'EXECUTION', 'ERROR', [...path, 'reference'], `A condição usa ${ref ? `“${ref}”` : 'uma referência vazia'}, mas nenhuma etapa anterior guarda cartas com esse nome.`);
    else if (scope.produced.get(ref) !== 'CARDS') c.add('FORMULA_REFERENCE_MISSING', 'EXECUTION', 'ERROR', [...path, 'reference'], `“${ref}” não guarda cartas.`);
  }
  (cond.conditions ?? []).forEach((x, i) => checkCondition(c, x, [...path, 'conditions', i], scope));
  if (cond.condition && typeof cond.condition === 'object') checkCondition(c, cond.condition, [...path, 'condition'], scope);
}

function checkAmount(c: Collector, amount: unknown, path: Path, scope: Scope): void {
  if (amount && typeof amount === 'object') checkFormula(c, amount as Formula, path, scope);
}

function checkOperation(c: Collector, op: Operation, path: Path, scope: Scope, timing: Timing | null): void {
  if (!op || typeof op !== 'object') return;
  if (!isKnownOpcode(op.type)) {
    c.add('UNKNOWN_OPCODE', 'EXECUTION', 'ERROR', [...path, 'type'], `Este efeito (“${String((op as { type?: unknown }).type)}”) ainda não pode ser publicado nesta versão do motor.`);
    return;
  }
  if (timing && (timing === 'CONTINUOUS' || timing === 'REPLACEMENT') && !isContinuousOpcode(op.type)) {
    c.add('NOT_CONTINUOUS_OPCODE', 'EXECUTION', 'ERROR', [...path, 'type'], `“${op.type}” não é um efeito contínuo e não pode ser usado em blocos ${timing === 'CONTINUOUS' ? 'contínuos' : 'de substituição'}.`);
  }
  if (op.type === 'ATTACK_FAILS' && !scope.attackContext) {
    c.add('ATTACK_ONLY_OPERATION', 'EXECUTION', 'ERROR', [...path, 'type'], '“Ataque não faz nada” só pode ser usado nos efeitos de um ataque.');
  }
  switch (op.type) {
    case 'FLIP_COINS':
      checkAmount(c, op.count, [...path, 'count'], scope);
      if (op.untilTails && op.count !== undefined) c.add('PARAM_INVALID', 'STRUCTURE', 'ERROR', path, 'Escolha quantidade de moedas ou “até sair coroa”, não os dois.');
      if (!op.untilTails && op.count === undefined) c.add('PARAM_INVALID', 'STRUCTURE', 'ERROR', [...path, 'count'], 'Informe quantas moedas lançar (1–20) ou marque “até sair coroa”.');
      if (op.outputId) produce(c, scope, op.outputId, 'COINS', [...path, 'outputId']);
      return;
    case 'DEAL_DAMAGE': case 'HEAL_DAMAGE':
      checkSelector(c, op.target, [...path, 'target'], scope, true);
      checkAmount(c, op.amount, [...path, 'amount'], scope);
      return;
    case 'DRAW_CARDS':
      checkAmount(c, op.count, [...path, 'count'], scope);
      return;
    case 'DISCARD_CARDS':
      checkAmount(c, op.count, [...path, 'count'], scope);
      if (op.outputId) produce(c, scope, op.outputId, 'CARDS', [...path, 'outputId']);
      return;
    case 'SHUFFLE_HAND_INTO_DECK':
      if (op.outputId) produce(c, scope, op.outputId, 'COUNT', [...path, 'outputId']);
      return;
    case 'DISCARD_ENERGY':
      checkSelector(c, op.target, [...path, 'target'], scope, true);
      checkAmount(c, op.count, [...path, 'count'], scope);
      return;
    case 'LOOK_AT_TOP': case 'RECOVER_FROM_DISCARD': case 'RETURN_CARDS_TO_DECK':
      checkAmount(c, op.count, [...path, 'count'], scope);
      return;
    case 'MODIFY':
      checkSelector(c, op.target, [...path, 'target'], scope, true);
      checkAmount(c, op.amount, [...path, 'amount'], scope);
      return;
    case 'MOVE_DAMAGE':
      checkSelector(c, op.from, [...path, 'from'], scope, true);
      checkSelector(c, op.to, [...path, 'to'], scope, true);
      return;
    case 'CHOOSE_ONE':
      (op.options ?? []).forEach((ops, k) => (ops ?? []).forEach((o, i) => checkOperation(c, o, [...path, 'options', k, i], scope, timing)));
      return;
    case 'ATTACH_ENERGY':
      checkSelector(c, op.target, [...path, 'target'], scope, true);
      checkAmount(c, op.count, [...path, 'count'], scope);
      return;
    case 'MOVE_ENERGY':
      checkSelector(c, op.from, [...path, 'from'], scope, true);
      checkSelector(c, op.to, [...path, 'to'], scope, true);
      return;
    case 'COPY_ATTACK':
      checkSelector(c, op.from, [...path, 'from'], scope, true);
      return;
    case 'CONDITIONAL':
      checkCondition(c, op.condition, [...path, 'condition'], scope);
      (op.then ?? []).forEach((o, i) => checkOperation(c, o, [...path, 'then', i], scope, timing));
      (op.else ?? []).forEach((o, i) => checkOperation(c, o, [...path, 'else', i], scope, timing));
      return;
    case 'SCHEDULE_DELAYED': {
      checkSelector(c, op.target, [...path, 'target'], scope, true);
      const delayed: Scope = { produced: new Map(scope.produced), eventContext: true, attackContext: false };
      (op.operations ?? []).forEach((o, i) => checkOperation(c, o, [...path, 'operations', i], delayed, null));
      return;
    }
    default:
      if ('target' in op) checkSelector(c, op.target as Selector, [...path, 'target'], scope, true);
  }
}

function checkBlock(c: Collector, block: EffectBlock, path: Path, scope: Scope, allowed: readonly Timing[], contextLabel: string): void {
  if (!block || typeof block !== 'object') return;
  if (!allowed.includes(block.timing)) {
    c.add('TIMING_NOT_ALLOWED', 'EXECUTION', 'ERROR', [...path, 'timing'], `Momento “${block.timing}” não é aceito em ${contextLabel} (aceitos: ${allowed.join(', ')}).`);
  }
  const blockScope: Scope = { produced: scope.produced, eventContext: scope.eventContext || block.timing === 'ON_TRIGGER' || block.timing === 'REPLACEMENT', attackContext: scope.attackContext };
  checkCondition(c, block.condition ?? null, [...path, 'condition'], blockScope);
  checkOperation(c, block.operation, [...path, 'operation'], blockScope, block.timing);
}

function checkCosts(c: Collector, costs: readonly AdditionalCost[] | undefined, path: Path): void {
  (costs ?? []).forEach((cost, i) => {
    if (cost?.type === 'DISCARD_ENERGY' && cost.energyType !== 'ANY' && !(ENERGY_TYPES as readonly string[]).includes(cost.energyType)) {
      c.add('ATTACK_ENERGY_INVALID', 'EXECUTION', 'ERROR', [...path, i, 'energyType'], 'O custo adicional descarta um tipo de Energia que este motor não gera.');
    }
  });
}

function executionAttack(c: Collector, attack: Attack, i: number): void {
  const path: Path = ['rules', 'attacks', i];
  const scope: Scope = { produced: new Map(), eventContext: false, attackContext: true };
  (attack.preconditions ?? []).forEach((cond, k) => checkCondition(c, cond, [...path, 'preconditions', k], scope));
  checkCosts(c, attack.additionalCosts, [...path, 'additionalCosts']);
  const effects = attack.effects ?? [];
  const allowed: Timing[] = ['PRE_DAMAGE', 'POST_DAMAGE'];
  effects.forEach((b, k) => { if (b?.timing === 'PRE_DAMAGE') checkBlock(c, b, [...path, 'effects', k], scope, allowed, 'ataques'); });
  checkFormula(c, attack.damageFormula, [...path, 'damageFormula'], scope);
  checkSelector(c, attack.damageTarget, [...path, 'damageTarget'], scope, true);
  effects.forEach((b, k) => { if (b?.timing !== 'PRE_DAMAGE') checkBlock(c, b, [...path, 'effects', k], scope, allowed, 'ataques'); });
}

function executionAbility(c: Collector, ability: Ability, i: number): void {
  const path: Path = ['rules', 'abilities', i];
  const timing = ABILITY_TIMING[ability.kind];
  const scope: Scope = { produced: new Map(), eventContext: ability.kind === 'TRIGGERED' || ability.kind === 'REPLACEMENT', attackContext: false };
  (ability.conditions ?? []).forEach((cond, k) => checkCondition(c, cond, [...path, 'conditions', k], scope));
  checkCosts(c, ability.costs, [...path, 'costs']);
  (ability.effects ?? []).forEach((b, k) => checkBlock(c, b, [...path, 'effects', k], scope, timing ? [timing] : [], `Habilidade ${ability.kind === 'ACTIVATED' ? 'ativada' : ability.kind === 'CONTINUOUS' ? 'contínua' : ability.kind === 'TRIGGERED' ? 'disparada' : 'de substituição'}`));
}

function execution(c: Collector, rules: CardDefinition): void {
  (rules.attacks ?? []).forEach((a, i) => { if (a) executionAttack(c, a, i); });
  (rules.abilities ?? []).forEach((a, i) => { if (a) executionAbility(c, a, i); });
  if (rules.category === 'TRAINER') {
    const kind = isFossilRules(rules) ? 'FOSSIL' : rules.subtype;
    const allowed = ALLOWED_TRAINER_TIMINGS[kind] ?? [];
    const scope: Scope = { produced: new Map(), eventContext: false, attackContext: false };
    (rules.trainerRules?.playConditions ?? []).forEach((cond, k) => checkCondition(c, cond, ['rules', 'trainerRules', 'playConditions', k], scope));
    (rules.trainerEffects ?? []).forEach((b, k) => checkBlock(c, b, ['rules', 'trainerEffects', k], scope, allowed, `Treinador (${kind === 'FOSSIL' ? 'Fóssil' : rules.subtype})`));
  }
}

// ---------------------------------------------------------------- nível 3: regras

function evolutionGraph(catalog: readonly CardDefinition[]): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  for (const def of catalog) {
    if (def.category !== 'POKEMON') continue;
    const set = graph.get(def.deckLimitKey) ?? new Set<string>();
    for (const from of def.evolvesFrom ?? []) set.add(from);
    graph.set(def.deckLimitKey, set);
  }
  return graph;
}

function hasCycle(start: string, sources: readonly string[], graph: Map<string, Set<string>>): boolean {
  const stack = [...sources];
  const seen = new Set<string>();
  while (stack.length) {
    const key = stack.pop()!;
    if (key === start) return true;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const next of graph.get(key) ?? []) stack.push(next);
  }
  return false;
}

function rulesLevel(c: Collector, draft: EditorDraft, ctx: ValidationContext): void {
  const rules = draft.rules;
  const ruleBox = rules.ruleBox;
  if (rules.id !== draft.target.definitionId) c.add('TARGET_MISMATCH', 'RULES', 'ERROR', ['rules', 'id'], `O ID das regras (${rules.id}) difere do alvo do projeto (${draft.target.definitionId}).`, 'PUBLISH');
  if (typeof rules.baseName === 'string') {
    const trimmed = rules.baseName.trim();
    if (/\s(ex|EX)$/.test(trimmed) || /^Mega\s/i.test(trimmed)) c.add('BASE_NAME_SUFFIX', 'RULES', 'ERROR', ['rules', 'baseName'], 'O nome-base nunca inclui “ex” ou “Mega”: use o seletor de regra especial.');
    const derived = deriveName(rules.baseName, ruleBox);
    if (rules.name !== derived) c.add('NAME_DERIVATION_MISMATCH', 'RULES', 'ERROR', ['rules', 'name'], `Nome exibido deveria ser “${derived}” (derivado do nome-base e da regra especial).`);
    else if (rules.deckLimitKey !== deckLimitKey(derived)) c.add('DECK_LIMIT_KEY_MISMATCH', 'RULES', 'ERROR', ['rules', 'deckLimitKey'], `Chave de limite deveria ser “${deckLimitKey(derived)}” (deck-limit-key-v2).`);
  }
  for (const [i, tag] of (rules.tags ?? []).entries()) {
    if (typeof tag === 'string' && /^(ex|mega|mega[\s_-]?ex)$/i.test(tag.trim())) c.add('TAGS_RULEBOX_FORBIDDEN', 'RULES', 'ERROR', ['rules', 'tags', i], 'Etiquetas nunca representam ex/Mega: isso é exclusivo da regra especial.');
  }
  if (rules.category === 'POKEMON') {
    const expected = POINTS_BY_RULE_BOX[ruleBox];
    if (expected !== undefined && rules.knockoutPoints !== expected) {
      c.add('RULE_BOX_POINTS_MISMATCH', 'RULES', 'ERROR', ['rules', 'knockoutPoints'], `Uma carta ${ruleBox === 'NONE' ? 'comum' : ruleBox === 'EX' ? 'ex' : 'Mega ex'} entrega ${expected} ponto${expected > 1 ? 's' : ''} nesta ruleset.`);
    }
    if ((rules.types ?? []).length > 1) c.add('SECOND_TYPE_UNSUPPORTED', 'RULES', 'ERROR', ['rules', 'types'], 'Segundo tipo ainda não é suportado pelo ruleset local-campaign-v2: a publicação fica bloqueada; o rascunho é mantido.');
    const graph = evolutionGraph((ctx.catalog ?? []).filter((d) => d.id !== rules.id));
    const evolves = rules.evolvesFrom ?? [];
    if (evolves.includes(rules.deckLimitKey) || (evolves.length && hasCycle(rules.deckLimitKey, evolves, graph))) {
      c.add('EVOLUTION_CYCLE', 'RULES', 'ERROR', ['rules', 'evolvesFrom'], 'Ciclo evolutivo: a origem acaba evoluindo desta própria carta.');
    }
    if (ctx.catalog) {
      for (const [i, key] of evolves.entries()) {
        const sources = ctx.catalog.filter((d) => d.deckLimitKey === key && d.id !== rules.id);
        if (!sources.length) {
          c.add('EVOLUTION_SOURCE_UNKNOWN', 'DESIGN', 'WARNING', ['rules', 'evolvesFrom', i], `Nenhuma carta “${key}” existe no catálogo local; a evolução não poderá ser usada até que exista uma origem.`);
          continue;
        }
        const wanted = rules.stage === 'STAGE_1' ? 'BASIC' : rules.stage === 'STAGE_2' ? 'STAGE_1' : null;
        if (wanted && !sources.some((s) => s.category === 'POKEMON' && s.stage === wanted)) {
          c.add('EVOLUTION_STAGE_MISMATCH', 'RULES', 'WARNING', ['rules', 'evolvesFrom', i], `“${key}” não é ${wanted === 'BASIC' ? 'Básico' : 'Estágio 1'}: confira o estágio da origem.`);
        }
      }
      const clones = ctx.catalog.filter((d) => d.deckLimitKey === rules.deckLimitKey && d.id !== rules.id);
      if (clones.length) c.add('NAME_SHARED_LIMIT', 'DESIGN', 'INFO', ['rules', 'baseName'], `Mesmo nome de regra de ${clones.map((d) => `${d.name} (${d.id})`).slice(0, 3).join(', ')}: as cópias somam no limite de 2 por deck.`);
    }
    if (!(rules.attacks ?? []).length) c.add('CARD_WITHOUT_ATTACK', 'DESIGN', 'WARNING', ['rules', 'attacks'], 'Pokémon sem ataque: válido como suporte, mas confirme que é intencional.');
    if ((rules.attacks ?? []).length > 2) c.add('ATTACKS_ABOVE_TEMPLATE', 'DESIGN', 'WARNING', ['rules', 'attacks'], 'O template clássico recomenda até dois ataques; confira a legibilidade.');
    (rules.attacks ?? []).forEach((a, i) => attackRules(c, a, i));
    const attackIds = new Set<string>();
    (rules.attacks ?? []).forEach((a, i) => {
      if (attackIds.has(a.id)) c.add('ID_DUPLICATE', 'STRUCTURE', 'ERROR', ['rules', 'attacks', i, 'id'], `ID de ataque repetido: ${a.id}.`);
      attackIds.add(a.id);
    });
    const abilityIds = new Set<string>();
    (rules.abilities ?? []).forEach((a, i) => {
      if (abilityIds.has(a.id)) c.add('ID_DUPLICATE', 'STRUCTURE', 'ERROR', ['rules', 'abilities', i, 'id'], `ID de Habilidade repetido: ${a.id}.`);
      abilityIds.add(a.id);
      if (a.kind === 'ACTIVATED' && a.endsTurn) c.add('ABILITY_ENDS_TURN', 'DESIGN', 'INFO', ['rules', 'abilities', i, 'endsTurn'], `“${a.name}” encerra o turno: o jogo alerta antes de confirmar o uso.`);
    });
  } else if (rules.category === 'TRAINER') {
    const t = rules;
    const r = t.trainerRules;
    if (ruleBox !== 'NONE') c.add('TRAINER_FIELD_INVALID', 'RULES', 'ERROR', ['rules', 'ruleBox'], 'Treinadores não podem receber regra ex nesta ruleset.');
    if (r) {
      const fossil = !!r.fieldBehavior;
      if (fossil && (t.subtype !== 'ITEM' || r.destinationAfterPlay !== 'BENCH_AS_POKEMON')) c.add('FOSSIL_SHAPE_INVALID', 'RULES', 'ERROR', ['rules', 'trainerRules', 'fieldBehavior'], 'Fóssil é um Item com comportamento em campo e destino “Banco como Pokémon”.');
      if (!fossil && r.destinationAfterPlay === 'BENCH_AS_POKEMON') c.add('FOSSIL_SHAPE_INVALID', 'RULES', 'ERROR', ['rules', 'trainerRules', 'destinationAfterPlay'], 'Destino “Banco como Pokémon” exige o comportamento de Fóssil.');
      const expectedDest = t.subtype === 'TOOL' ? 'ATTACHED_TOOL' : t.subtype === 'STADIUM' ? 'STADIUM_SLOT' : fossil ? 'BENCH_AS_POKEMON' : 'DISCARD';
      if (r.destinationAfterPlay !== expectedDest && !(fossil && t.subtype === 'ITEM')) c.add('TRAINER_DESTINATION_MISMATCH', 'RULES', 'ERROR', ['rules', 'trainerRules', 'destinationAfterPlay'], `Destino após jogar incompatível com o subtipo (esperado ${expectedDest}).`);
      if (r.toolTarget && t.subtype !== 'TOOL') c.add('TRAINER_FIELD_INVALID', 'RULES', 'ERROR', ['rules', 'trainerRules', 'toolTarget'], 'Filtro de alvo da Ferramenta só existe em Ferramentas.');
    }
    if (t.subtype === 'TOOL' && !(t.trainerEffects ?? []).length) c.add('TOOL_WITHOUT_EFFECT', 'DESIGN', 'WARNING', ['rules', 'trainerEffects'], 'Ferramenta sem efeito.');
    if ((t.subtype === 'ITEM' || t.subtype === 'SUPPORTER') && !isFossilRules(t) && !(t.trainerEffects ?? []).length) c.add('TRAINER_WITHOUT_EFFECT', 'DESIGN', 'WARNING', ['rules', 'trainerEffects'], 'Treinador sem efeito ao jogar.');
  }
  const blockIds = new Set<string>();
  const visitBlocks = (blocks: readonly EffectBlock[] | undefined, base: Path) => (blocks ?? []).forEach((b, k) => {
    if (!b) return;
    if (blockIds.has(b.id)) c.add('ID_DUPLICATE', 'STRUCTURE', 'ERROR', [...base, k, 'id'], `ID de bloco repetido na carta: ${b.id}.`);
    blockIds.add(b.id);
  });
  (rules.attacks ?? []).forEach((a, i) => visitBlocks(a?.effects, ['rules', 'attacks', i, 'effects']));
  (rules.abilities ?? []).forEach((a, i) => visitBlocks(a?.effects, ['rules', 'abilities', i, 'effects']));
  if (rules.category === 'TRAINER') visitBlocks(rules.trainerEffects, ['rules', 'trainerEffects']);
  modeLocks(c, draft, ctx);
}

function attackRules(c: Collector, a: Attack, i: number): void {
  const path: Path = ['rules', 'attacks', i];
  if (!a) return;
  const hasFormula = a.damageFormula !== null && a.damageFormula !== undefined;
  const base = a.baseDamage;
  if (hasFormula && base !== null && base !== undefined) {
    c.add('DAMAGE_FORMULA_CONFLICT', 'STRUCTURE', 'ERROR', [...path, 'baseDamage'], 'Dano fixo e fórmula são alternativas: com fórmula, o dano fixo fica vazio (não duplicar dano).');
  } else if (!hasFormula && (base === null || base === undefined)) {
    c.add('DAMAGE_MISSING', 'STRUCTURE', 'ERROR', [...path, 'baseDamage'], 'Informe o dano fixo (0 para ataque sem dano direto) ou uma fórmula.');
  } else if (!hasFormula && typeof base === 'number' && (!Number.isInteger(base) || base < 0 || base > 9990)) {
    c.add('DAMAGE_INVALID', 'STRUCTURE', 'ERROR', [...path, 'baseDamage'], 'Dano fixo deve ser um inteiro de 0 a 9990.');
  }
  const deals = hasFormula || (typeof base === 'number' && base > 0);
  if (deals && !a.damageTarget) c.add('DAMAGE_TARGET_MISSING', 'RULES', 'ERROR', [...path, 'damageTarget'], 'Ataque com dano precisa de alvo de dano principal (padrão: Ativo do oponente).');
  if (!deals && a.damageTarget) c.add('DAMAGE_TARGET_WITHOUT_DAMAGE', 'DESIGN', 'INFO', [...path, 'damageTarget'], 'Sem dano direto, o alvo de dano principal fica vazio (use bloco DEAL_DAMAGE para dano em outro alvo).');
  const total = Object.values(a.energyCost ?? {}).reduce((s, n) => s + (typeof n === 'number' ? n : 0), 0);
  if (total > 20) c.add('ATTACK_COST_INVALID', 'STRUCTURE', 'ERROR', [...path, 'energyCost'], 'Custo total acima de 20 Energias (guarda de autoria).');
  if ((a.energyCost as Record<string, unknown> | undefined)?.DRAGON !== undefined) {
    c.add('ATTACK_ENERGY_INVALID', 'EXECUTION', 'ERROR', [...path, 'energyCost'], 'Energia Dragão não é gerada pelo modelo atual: use tipos geráveis ou Incolor.');
  }
}

function modeLocks(c: Collector, draft: EditorDraft, ctx: ValidationContext): void {
  const rules = draft.rules;
  const src = ctx.sourceRules ?? null;
  if (draft.mode === 'VARIANT' && src) {
    const strip = (r: CardDefinition) => ({ ...r });
    if (!deepEqual(strip(rules), strip(src))) c.add('RULES_LOCKED_VARIANT', 'RULES', 'ERROR', ['rules'], 'Projeto de variante: todas as regras ficam bloqueadas; só impressões podem mudar. Use “Nova versão” ou “Cópia autoral” para alterar regras.');
  }
  if (draft.mode === 'NEW_VERSION' && src) {
    if (src.id !== draft.target.definitionId) c.add('DEFINITION_LOCKED', 'RULES', 'ERROR', ['target', 'definitionId'], 'Nova versão mantém o mesmo ID funcional da origem.', 'PUBLISH');
    if (src.category !== rules.category) c.add('CATEGORY_LOCKED', 'RULES', 'ERROR', ['rules', 'category'], 'Nova versão não troca a categoria da carta.');
  }
  const published = draft.mode === 'NEW_VERSION' ? src : ctx.publishedTarget ?? null;
  if (published && published.ruleBox !== rules.ruleBox && draft.mode !== 'VARIANT') {
    c.add('RULE_BOX_CHANGE_REQUIRES_FORK', 'RULES', 'ERROR', ['rules', 'ruleBox'], 'Alterar a regra especial de uma carta publicada cria nova identidade funcional: use “Cópia autoral (fork)”.');
  }
  if (published && published.deckLimitKey !== rules.deckLimitKey && draft.mode !== 'VARIANT') {
    c.add('NAME_CHANGED_IN_VERSION', 'DESIGN', 'WARNING', ['rules', 'baseName'], `Renomear (“${published.name}” → “${rules.name}”) muda o agrupamento de limite de cópias desta definição.`);
  }
}

// ---------------------------------------------------------------- impressões

function printingChecks(c: Collector, draft: EditorDraft, ctx: ValidationContext): void {
  const rules = draft.rules;
  if (!draft.printings.length) c.add('PRINTING_REQUIRED', 'RULES', 'ERROR', ['printings'], 'Crie ao menos uma impressão para a carta aparecer na coleção.', 'ART');
  const ids = new Set<string>();
  const numbers = new Map<string, number>();
  draft.printings.forEach((p, i) => {
    const base: Path = ['printings', i];
    if (ids.has(p.printingId)) c.add('ID_DUPLICATE', 'STRUCTURE', 'ERROR', [...base, 'printingId'], `ID de impressão repetido: ${p.printingId}.`);
    ids.add(p.printingId);
    const numberKey = `${p.setId}#${p.collectorNumber}`;
    if (numbers.has(numberKey)) c.add('COLLECTOR_NUMBER_DUPLICATE', 'DESIGN', 'WARNING', [...base, 'collectorNumber'], `Número ${p.collectorNumber} repetido no conjunto ${p.setId}; normal e foil costumam ter números distintos (ex.: 001 e 001F).`);
    numbers.set(numberKey, i);
    if (!(compatibleTemplates(rules) as readonly string[]).includes(p.templateId)) {
      c.add('TEMPLATE_INCOMPATIBLE', 'RULES', 'ERROR', [...base, 'templateId'], `Template incompatível com ${rules.category === 'TRAINER' ? 'Treinador' : rules.ruleBox === 'NONE' ? 'Pokémon comum' : 'Pokémon com regra especial'}.`);
    }
    if (p.artMode !== 'TEMPLATE_ONLY' && !p.artAssetId && !p.artKey) c.add('ART_MISSING', 'RULES', 'ERROR', [...base, 'artAssetId'], 'Sem arte: publique com “Sem arte (placeholder)” ou importe uma ilustração.');
    if (p.artMode === 'TEMPLATE_ONLY' && (p.artAssetId || p.artKey)) c.add('ART_REF_CONFLICT', 'STRUCTURE', 'ERROR', [...base, 'artMode'], '“Sem arte” não pode referenciar arte; escolha outro modo ou remova a arte.');
    if (p.artAssetId && p.artKey) c.add('ART_REF_CONFLICT', 'STRUCTURE', 'ERROR', [...base, 'artKey'], 'Uma impressão usa arte do pacote ou arte importada, nunca as duas.');
    if (p.crop && (p.crop.x + p.crop.width > 1 + 1e-9 || p.crop.y + p.crop.height > 1 + 1e-9)) c.add('CROP_OUT_OF_BOUNDS', 'STRUCTURE', 'ERROR', [...base, 'crop'], 'Recorte ultrapassa a imagem (x + largura e y + altura devem ser ≤ 1).');
    if (p.artMode === 'FULL_PRINTING') c.add('FULL_PRINTING_REVIEW', 'DESIGN', 'WARNING', [...base, 'artMode'], 'Impressão completa: o texto da imagem não vira regra. Revise se a imagem corresponde às regras configuradas.');
    const known = ctx.knownAssetIds;
    if (known) {
      if (p.artAssetId && !known.has(p.artAssetId)) c.add('ASSET_MISSING', 'RULES', 'ERROR', [...base, 'artAssetId'], 'A arte referenciada não está no armazenamento local.');
      const mask = p.finishSettings?.foilMaskAssetId;
      if (mask && p.finishSettings.maskMode !== 'ART_WINDOW' && !known.has(mask)) c.add('ASSET_MISSING', 'RULES', 'ERROR', [...base, 'finishSettings', 'foilMaskAssetId'], 'A máscara de foil referenciada não está no armazenamento local.');
    }
    const info = p.artAssetId ? ctx.assetInfo?.get(p.artAssetId) : undefined;
    if (info && info.width !== null && info.height !== null && (info.width < 480 || info.height < 340)) {
      c.add('ART_LOW_RESOLUTION', 'DESIGN', 'WARNING', [...base, 'artAssetId'], `Arte com ${info.width}×${info.height} px: baixa resolução para a janela de arte (recomendado ≥ 960×680).`);
    }
    const fs = p.finishSettings;
    if (fs) {
      const preset = FINISH_PRESETS[fs.presetId as FinishPresetId];
      if (preset && preset.finish !== p.finish) c.add('PRESET_FINISH_MISMATCH', 'DESIGN', 'WARNING', [...base, 'finishSettings', 'presetId'], `Preset “${preset.label}” é típico de ${preset.finish}, mas o acabamento é ${p.finish}.`);
      if (p.finish !== 'NORMAL' && fs.intensity > 0.85) c.add('FINISH_AGGRESSIVE', 'DESIGN', 'WARNING', [...base, 'finishSettings', 'intensity'], 'Intensidade muito alta: o brilho pode atrapalhar a leitura da arte (a proteção de texto continua ativa).');
      if (typeof fs.patternScale === 'number' && (fs.patternScale > 6 || fs.patternScale < 0.35)) c.add('FINISH_ALIASING', 'DESIGN', 'WARNING', [...base, 'finishSettings', 'patternScale'], 'Escala de padrão extrema pode gerar serrilhado.');
    }
  });
}

// ---------------------------------------------------------------- nível 4: design (overflow + balanceamento)

function designLevel(c: Collector, draft: EditorDraft, compiled: CardDefinition, printing: CardPrinting | null, ctx: ValidationContext): void {
  if (printing) {
    try {
      const face = cardFace(compiled, printing, catalogNames(ctx.catalog ?? []));
      const fit = estimateTextFit(face);
      for (const region of fit.regions) {
        if (region.overflow) c.add('CARD_TEXT_OVERFLOW', 'DESIGN', 'ERROR', region.path, `O ${region.label} não cabe no template selecionado (${Math.ceil(region.lines)} linhas estimadas; máximo ${region.maxLines}). Encurte o efeito, use outro template ou menos ataques.`);
      }
      if (fit.bodyOverflow && fit.firstOverflowRegion) {
        const region = fit.regions.find((r) => r.id === fit.firstOverflowRegion);
        c.add('CARD_TEXT_OVERFLOW', 'DESIGN', 'ERROR', region?.path ?? ['rules'], `O ${region?.label ?? 'texto'} não cabe no template selecionado: o corpo da carta comporta ~${fit.bodyCapacity} linhas e o conteúdo precisa de ${Math.ceil(fit.bodyLines)}.`);
      }
      if (fit.nameStatus === 'OVERFLOW') c.add('NAME_OVERFLOW', 'DESIGN', 'ERROR', ['rules', 'baseName'], `Nome com ${fit.nameChars} caracteres ficaria cortado no cabeçalho (máximo legível ≈ 26).`);
      else if (fit.nameStatus === 'TIGHT') c.add('NAME_TIGHT', 'DESIGN', 'WARNING', ['rules', 'baseName'], 'Nome longo: confira a leitura do cabeçalho na prévia.');
      for (const id of fit.attackNameOverflow) {
        const index = Number(id.split(':')[1]);
        c.add('ATTACK_NAME_TIGHT', 'DESIGN', 'WARNING', ['rules', 'attacks', index, 'name'], 'Nome do ataque longo para a faixa com custo e dano.');
      }
    } catch {
      // Documento incompleto demais para compor a face: a estrutura já reporta os problemas.
    }
  }
  if (compiled.category === 'POKEMON' || compiled.category === 'TRAINER') {
    try {
      const report = analyzeBalance(compiled, ctx.catalog ?? []);
      for (const flag of report.flags) c.add(`BALANCE_${flag.code}`, 'DESIGN', flag.severity, flag.path, flag.message);
    } catch {
      // idem
    }
  }
  void draft;
}

// ---------------------------------------------------------------- rascunho / cenários

function scenarioChecks(c: Collector, draft: EditorDraft): void {
  const ids = new Set<string>();
  const attackIds = new Set((draft.rules.attacks ?? []).map((a) => a.id));
  const abilityIds = new Set((draft.rules.abilities ?? []).map((a) => a.id));
  draft.testScenarios.forEach((s, i) => {
    if (ids.has(s.id)) c.add('SCENARIO_ID_DUPLICATE', 'STRUCTURE', 'ERROR', ['testScenarios', i, 'id'], `Cenário repetido: ${s.id}.`);
    ids.add(s.id);
    if (s.kind === 'ATTACK' && (!s.attackId || !attackIds.has(s.attackId))) c.add('SCENARIO_REFERENCE_MISSING', 'DESIGN', 'WARNING', ['testScenarios', i, 'attackId'], `Cenário ${s.id} aponta para um ataque inexistente.`);
    if (s.kind === 'ABILITY' && (!s.abilityId || !abilityIds.has(s.abilityId))) c.add('SCENARIO_REFERENCE_MISSING', 'DESIGN', 'WARNING', ['testScenarios', i, 'abilityId'], `Cenário ${s.id} aponta para uma Habilidade inexistente.`);
  });
}

function draftSchema(c: Collector, draft: EditorDraft): void {
  for (const issue of validateAgainstSchema(EDITOR_DRAFT_SCHEMA, draft)) {
    const seg = pointerSegments(issue.path);
    const path: Path = seg;
    c.add(seg[0] === 'testScenarios' ? 'SCENARIO_INVALID' : seg[0] === 'authoring' ? 'AUTHORING_INVALID' : 'DRAFT_INVALID', 'STRUCTURE', 'ERROR', path, `${describePath(path, draft.rules)}: ${issue.message}.`);
  }
}

const LEVEL_ORDER: Record<ValidationLevel, number> = { STRUCTURE: 0, EXECUTION: 1, RULES: 2, DESIGN: 3 };
const SEVERITY_ORDER: Record<Severity, number> = { ERROR: 0, WARNING: 1, INFO: 2 };

function report(issues: ValidationIssue[], rulesHash: string): ValidationReport {
  const sorted = [...issues].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
  const byLevel = Object.fromEntries(LEVELS.map((level) => [level, {
    errors: sorted.filter((i) => i.level === level && i.severity === 'ERROR').length,
    warnings: sorted.filter((i) => i.level === level && i.severity === 'WARNING').length,
  }])) as Record<ValidationLevel, LevelCount>;
  const errors = sorted.filter((i) => i.severity === 'ERROR').length;
  return {
    validatorVersion: VALIDATOR_VERSION, issues: sorted, errors, warnings: sorted.filter((i) => i.severity === 'WARNING').length,
    byLevel, publishable: errors === 0, rulesHash,
  };
}

/** Validação completa de um rascunho (executada antes de publicar e gravada em cada revisão). */
export function validateDraft(draft: EditorDraft, ctx: ValidationContext = {}): ValidationReport {
  const c = collector();
  let compiled: CardDefinition;
  let printings: readonly CardPrinting[] = [];
  let rulesHash = '';
  try {
    const out = compileDraft(draft);
    compiled = out.definition;
    printings = out.printings.map((p) => p.printing);
    rulesHash = out.rulesHash;
  } catch (error) {
    c.add('DRAFT_UNREADABLE', 'STRUCTURE', 'ERROR', ['rules'], `Rascunho ilegível: ${error instanceof Error ? error.message : String(error)}.`);
    return report(c.issues, jcsHash(draft.rules ?? null));
  }
  draftSchema(c, draft);
  structureRules(c, draft.rules, compiled);
  execution(c, compiled);
  rulesLevel(c, draft, ctx);
  if (!ctx.rulesOnly) {
    printings.forEach((p, i) => {
      for (const issue of validateAgainstSchema(CARD_PRINTING_SCHEMA, p)) {
        const mapped = mapPrintingIssue(issue);
        if (mapped === 'SKIP') continue;
        const path: Path = ['printings', i, ...pointerSegments(issue.path)];
        c.add(mapped.code, mapped.level, 'ERROR', path, mapped.message ?? `${describePath(path, draft.rules)}: ${issue.message}.`);
      }
    });
    printingChecks(c, draft, ctx);
    scenarioChecks(c, draft);
  }
  designLevel(c, draft, compiled, printings[0] ?? null, ctx);
  return report(c.issues, rulesHash);
}

/** Validação de um documento de regras avulso (importação `.card.json`/`.cardpack.zip`). */
export function validateDefinition(def: CardDefinition, ctx: ValidationContext = {}): ValidationReport {
  const draft: EditorDraft = {
    draftFormat: 1, mode: 'NEW_DEFINITION', target: { definitionId: def?.id ?? 'x', version: def?.version ?? 1 }, rules: def, printings: [],
    authoring: { notes: '', setId: 'import' }, testScenarios: [],
  };
  return validateDraft(draft, { ...ctx, rulesOnly: true });
}

/** Problemas por aba (agrupamento exigido pelo §24). */
export function issuesByTab(r: ValidationReport): Record<EditorTab, ValidationIssue[]> {
  const out: Record<EditorTab, ValidationIssue[]> = { RULES: [], ART: [], FINISH: [], TESTS: [], PUBLISH: [] };
  for (const issue of r.issues) out[issue.tab].push(issue);
  return out;
}
