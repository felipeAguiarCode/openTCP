// Modelo do rascunho do Estúdio (editor_revisions.draft_json, draftFormat 1 — schemas/editor-draft.schema.json):
// modo, alvo, regras, impressões, autoria e cenários. Sem estado de UI (aba, seção, câmera).
// Funções puras: modelos iniciais (editor §6), modos de projeto (§6.1), edições que preservam derivações
// (nome/chave/pontos a partir de baseName + ruleBox, §7/§9) e utilidades de IDs estáveis (§10, ED-016).
import { deckLimitKeyV1, deriveName } from '../cards/naming.ts';
import type {
  Ability, AbilityKind, Attack, CardDefinition, CardPrinting, CostType, EffectBlock, EnergyType, Finish, Operation, PokemonCard,
  PokemonType, Rarity, RuleBox, Selector, Stage, TrainerCard, TrainerSubtype, Weakness,
} from '../cards/types.ts';
import { ENERGY_TYPES, POKEMON_TYPES } from '../cards/types.ts';
import type { CoinFace } from '../random/rng.ts';

export const DRAFT_FORMAT = 1 as const;
export const DEFAULT_SET_ID = 'custom-lab';
export const RULESET_ID = 'local-campaign-v2';

export type ProjectMode = 'NEW_DEFINITION' | 'NEW_VERSION' | 'VARIANT' | 'FORK';
export const PROJECT_MODES: readonly ProjectMode[] = ['NEW_DEFINITION', 'NEW_VERSION', 'VARIANT', 'FORK'];
export const MODE_LABEL: Record<ProjectMode, string> = {
  NEW_DEFINITION: 'Nova carta', NEW_VERSION: 'Nova versão', VARIANT: 'Variante visual', FORK: 'Cópia autoral (fork)',
};

export type ScenarioKind = 'ATTACK' | 'ABILITY' | 'TRAINER' | 'KNOCKOUT' | 'PERSISTENCE';
export type ScenarioExpect = {
  readonly baseDamage?: number;
  readonly finalDamage?: number;
  readonly knockout?: boolean;
  readonly pointsGranted?: number;
  readonly legal?: boolean;
  readonly errorCode?: string;
};
export type TestScenario = {
  readonly id: string;
  readonly kind: ScenarioKind;
  readonly attackId?: string;
  readonly abilityId?: string;
  readonly fixture: string;
  readonly forcedCoins: readonly CoinFace[];
  readonly expect: ScenarioExpect;
};

export type Authoring = {
  readonly notes: string;
  readonly setId: string;
  readonly maskPaint?: { readonly printingId: string; readonly maskAssetId: string };
};

export type EditorDraft = {
  readonly draftFormat: 1;
  readonly mode: ProjectMode;
  readonly target: { readonly definitionId: string; readonly version: number };
  /** Documento de regras dataVersion 2 em edição; pode estar incompleto/inválido (validado no nível Estrutura). */
  readonly rules: CardDefinition;
  readonly printings: readonly CardPrinting[];
  readonly authoring: Authoring;
  readonly testScenarios: readonly TestScenario[];
};

// ---------------------------------------------------------------- templates de carta (§19)

export const TEMPLATE_IDS = [
  'pocket-light-card-v1/pokemon-classic', 'pocket-light-card-v1/pokemon-ex', 'pocket-light-card-v1/pokemon-full-art',
  'pocket-light-card-v1/trainer', 'pocket-light-card-v1/fossil',
] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];
export const TEMPLATE_LABEL: Record<TemplateId, string> = {
  'pocket-light-card-v1/pokemon-classic': 'Clássico',
  'pocket-light-card-v1/pokemon-ex': 'Clássico ex',
  'pocket-light-card-v1/pokemon-full-art': 'Ilustração ampliada',
  'pocket-light-card-v1/trainer': 'Treinador',
  'pocket-light-card-v1/fossil': 'Fóssil',
};

export function isFossilRules(rules: CardDefinition): boolean {
  return rules.category === 'TRAINER' && !!rules.trainerRules?.fieldBehavior;
}

/** Templates compatíveis com categoria/ruleBox (registro do §19). */
export function compatibleTemplates(rules: CardDefinition): TemplateId[] {
  if (rules.category === 'TRAINER') return [isFossilRules(rules) ? 'pocket-light-card-v1/fossil' : 'pocket-light-card-v1/trainer'];
  return rules.ruleBox === 'NONE'
    ? ['pocket-light-card-v1/pokemon-classic', 'pocket-light-card-v1/pokemon-full-art']
    : ['pocket-light-card-v1/pokemon-ex', 'pocket-light-card-v1/pokemon-full-art'];
}

export function suggestedTemplate(rules: CardDefinition): TemplateId {
  return compatibleTemplates(rules)[0]!;
}

// ---------------------------------------------------------------- acabamentos (§20)

export type FinishPresetId = 'normal-matte' | 'holo-soft-art' | 'foil-diagonal' | 'foil-spectral' | 'chrome-border';
export const FINISH_PRESETS: Record<FinishPresetId, { readonly label: string; readonly finish: Finish; readonly settings: CardPrinting['finishSettings'] }> = {
  'normal-matte': { label: 'Normal fosco', finish: 'NORMAL', settings: { presetId: 'normal-matte', intensity: 0, roughness: 0.65, metalness: 0, patternAngleDegrees: 35, patternScale: 1, ambientSpeed: 0, maskMode: 'ART_WINDOW', protectText: true } },
  'holo-soft-art': { label: 'Holo suave na arte', finish: 'HOLOGRAPHIC', settings: { presetId: 'holo-soft-art', intensity: 0.45, roughness: 0.4, metalness: 0.2, patternAngleDegrees: 35, patternScale: 1, ambientSpeed: 0, tiltResponse: 0.6, foilPalette: 'PASTEL', maskMode: 'ART_WINDOW', protectText: true } },
  'foil-diagonal': { label: 'Foil diagonal discreto', finish: 'FOIL', settings: { presetId: 'foil-diagonal', intensity: 0.55, roughness: 0.35, metalness: 0.35, patternAngleDegrees: 35, patternScale: 1, ambientSpeed: 0, tiltResponse: 0.7, foilPalette: 'SPECTRAL', maskMode: 'ART_WINDOW', protectText: true } },
  'foil-spectral': { label: 'Foil espectral', finish: 'FOIL', settings: { presetId: 'foil-spectral', intensity: 0.7, roughness: 0.3, metalness: 0.4, patternAngleDegrees: -20, patternScale: 1.5, ambientSpeed: 0.05, tiltResponse: 0.8, foilPalette: 'SPECTRAL', maskMode: 'ART_WINDOW', protectText: true } },
  'chrome-border': { label: 'Cromado de borda', finish: 'CHROME', settings: { presetId: 'chrome-border', intensity: 0.6, roughness: 0.2, metalness: 0.8, patternAngleDegrees: 0, patternScale: 1, ambientSpeed: 0, chromeEnvironment: 'STUDIO_LIGHT', maskMode: 'ART_WINDOW', protectText: true } },
};
export const DEFAULT_PRESET_BY_FINISH: Record<Finish, FinishPresetId> = {
  NORMAL: 'normal-matte', HOLOGRAPHIC: 'holo-soft-art', FOIL: 'foil-diagonal', CHROME: 'chrome-border',
};
export const FINISHES: readonly Finish[] = ['NORMAL', 'HOLOGRAPHIC', 'FOIL', 'CHROME'];
export const RARITIES: readonly Rarity[] = ['COMMON', 'UNCOMMON', 'RARE', 'ULTRA', 'PROMO'];

// ---------------------------------------------------------------- IDs

/** Slug compatível com `^[a-z0-9][a-z0-9-]*$` (mesmo algoritmo de deck-limit-key-v2). */
export function slugify(text: string, fallback = 'item'): string {
  const slug = deckLimitKeyV1(text);
  return slug || fallback;
}

/** `base`, `base-2`, `base-3`… sem colidir com `existing`; respeita o limite de 80 caracteres dos IDs. */
export function uniqueId(base: string, existing: Iterable<string>, max = 80): string {
  const taken = new Set(existing);
  const root = slugify(base).slice(0, max - 4).replace(/-+$/, '') || 'item';
  if (!taken.has(root)) return root;
  for (let n = 2; n < 10000; n += 1) {
    const candidate = `${root}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error('IDs esgotados');
}

/** ID funcional novo para NEW_DEFINITION/FORK: `custom-<slug>-<token>` (estável depois de criado; ED-010). */
export function newDefinitionId(baseName: string, token: string): string {
  const slug = slugify(baseName, 'carta').slice(0, 60).replace(/-+$/, '');
  return `custom-${slug}-${token.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || '0'}`;
}

export function newPrintingId(definitionId: string, finish: Finish, token: string): string {
  return `print-${definitionId.slice(0, 70).replace(/-+$/, '')}-${finish.toLowerCase().slice(0, 6)}-${token.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || '0'}`;
}

/** Todos os IDs de blocos de efeito da carta (únicos por versão: DSL §2). */
export function allBlockIds(rules: CardDefinition): string[] {
  const out: string[] = [];
  for (const a of rules.attacks ?? []) for (const b of a.effects ?? []) out.push(b.id);
  for (const a of rules.abilities ?? []) for (const b of a.effects ?? []) out.push(b.id);
  if (rules.category === 'TRAINER') for (const b of rules.trainerEffects ?? []) out.push(b.id);
  return out;
}

// ---------------------------------------------------------------- derivações (§7, §9)

export const POINTS_BY_RULE_BOX: Record<RuleBox, 1 | 2 | 3> = { NONE: 1, EX: 2, MEGA_EX: 3 };

/** Recalcula name, deckLimitKey e knockoutPoints a partir de baseName + ruleBox. Nunca altera HP/dano/custo/raridade. */
export function syncDerived(rules: CardDefinition): CardDefinition {
  const ruleBox: RuleBox = rules.ruleBox ?? 'NONE';
  const name = deriveName(rules.baseName ?? '', ruleBox);
  const deckLimitKey = deckLimitKeyV1(name);
  if (rules.category === 'POKEMON') return { ...rules, name, deckLimitKey, knockoutPoints: POINTS_BY_RULE_BOX[ruleBox] ?? 1 };
  return { ...rules, name, deckLimitKey, knockoutPoints: null };
}

export const WEAKNESS_CHART: Record<PokemonType, PokemonType | null> = {
  GRASS: 'FIRE', FIRE: 'WATER', WATER: 'LIGHTNING', LIGHTNING: 'FIGHTING', PSYCHIC: 'DARKNESS', FIGHTING: 'PSYCHIC',
  DARKNESS: 'FIGHTING', METAL: 'FIRE', DRAGON: null, COLORLESS: 'FIGHTING',
};

function defaultWeakness(type: PokemonType): Weakness | null {
  const w = WEAKNESS_CHART[type];
  return w ? { type: w, operation: 'ADD', value: 20 } : null;
}

/** Tipo de Energia associado ao tipo do Pokémon (Dragão/Incolor não geram Energia: usa Incolor no custo). */
export function costTypeOf(type: PokemonType): CostType {
  return (ENERGY_TYPES as readonly string[]).includes(type) ? (type as EnergyType) : 'COLORLESS';
}

// ---------------------------------------------------------------- modelos de ataque (§14)

export type AttackTemplate =
  | 'SIMPLE' | 'DAMAGE_CONDITION' | 'COIN_DAMAGE' | 'DAMAGE_DISCARD' | 'BENCH_DAMAGE' | 'DRAW_NO_DAMAGE' | 'HEAL' | 'ENERGY_ACCEL' | 'SWITCH_AFTER';
export const ATTACK_TEMPLATES: readonly { readonly id: AttackTemplate; readonly label: string }[] = [
  { id: 'SIMPLE', label: 'Dano simples' },
  { id: 'DAMAGE_CONDITION', label: 'Dano + condição' },
  { id: 'COIN_DAMAGE', label: 'Dano por moeda' },
  { id: 'DAMAGE_DISCARD', label: 'Dano + descarte de Energia' },
  { id: 'BENCH_DAMAGE', label: 'Dano ao Banco' },
  { id: 'DRAW_NO_DAMAGE', label: 'Compra sem dano' },
  { id: 'HEAL', label: 'Dano + cura' },
  { id: 'ENERGY_ACCEL', label: 'Aceleração de Energia' },
  { id: 'SWITCH_AFTER', label: 'Troca após ataque' },
];

const OPP_ACTIVE: Selector = { scope: 'OPPONENT_ACTIVE' };
const SELF: Selector = { scope: 'SELF' };

/** Gera a mesma estrutura editável de qualquer ataque; nada é lógica escondida pelo nome (§14). */
export function attackFromTemplate(template: AttackTemplate, id: string, type: PokemonType, blockPrefix: string): Attack {
  const t = costTypeOf(type);
  const base = (over: Partial<Attack>): Attack => ({
    id, name: 'Novo ataque', energyCost: { [t]: 1 }, baseDamage: 20, damageFormula: null, damageTarget: OPP_ACTIVE,
    preconditions: [], additionalCosts: [], effects: [], endsTurn: true, ...over,
  });
  const block = (n: number, timing: EffectBlock['timing'], operation: Operation, extra: Partial<EffectBlock> = {}): EffectBlock =>
    ({ id: `${blockPrefix}-${n}`, timing, operation, ...extra });
  const energyType: EnergyType = t === 'COLORLESS' ? 'FIRE' : t;
  switch (template) {
    case 'SIMPLE': return base({ name: 'Investida' });
    case 'DAMAGE_CONDITION': return base({ name: 'Ferroada', energyCost: { [t]: 1, COLORLESS: 1 }, baseDamage: 30,
      effects: [block(1, 'POST_DAMAGE', { type: 'APPLY_CONDITION', target: OPP_ACTIVE, condition: 'POISONED' })] });
    case 'COIN_DAMAGE': return base({ name: 'Rajada da Sorte', energyCost: { [t]: 2 }, baseDamage: null,
      damageFormula: { op: 'MULTIPLY', operands: [{ op: 'CONST', value: 30 }, { op: 'COUNT_HEADS', reference: 'coins' }] },
      effects: [block(1, 'PRE_DAMAGE', { type: 'FLIP_COINS', count: 2, outputId: 'coins' })] });
    case 'DAMAGE_DISCARD': return base({ name: 'Descarga Total', energyCost: { [t]: 2 }, baseDamage: 70,
      effects: [block(1, 'POST_DAMAGE', { type: 'DISCARD_ENERGY', target: SELF, energyType: t === 'COLORLESS' ? 'ANY' : energyType, count: 1 })] });
    case 'BENCH_DAMAGE': return base({ name: 'Estilhaço', energyCost: { [t]: 1, COLORLESS: 1 }, baseDamage: 30,
      effects: [block(1, 'POST_DAMAGE', { type: 'DEAL_DAMAGE', target: { scope: 'OPPONENT_BENCH', pick: { mode: 'CHOOSE', chooser: 'CONTROLLER', min: 1, max: 1 } }, amount: 10, category: 'ATTACK', applyWeakness: false })] });
    case 'DRAW_NO_DAMAGE': return base({ name: 'Farejar', energyCost: { COLORLESS: 1 }, baseDamage: 0, damageTarget: null,
      effects: [block(1, 'POST_DAMAGE', { type: 'DRAW_CARDS', player: 'OWN', count: 2 })] });
    case 'HEAL': return base({ name: 'Golpe Revigorante', baseDamage: 20,
      effects: [block(1, 'POST_DAMAGE', { type: 'HEAL_DAMAGE', target: SELF, amount: 20 })] });
    case 'ENERGY_ACCEL': return base({ name: 'Canalizar', baseDamage: 0, damageTarget: null,
      effects: [block(1, 'POST_DAMAGE', { type: 'ATTACH_ENERGY', target: { scope: 'OWN_BENCH', pick: { mode: 'CHOOSE', chooser: 'CONTROLLER', min: 1, max: 1 } }, energyType, count: 1, source: 'GENERATED' })] });
    case 'SWITCH_AFTER': return base({ name: 'Salto e Recuo', energyCost: { [t]: 1, COLORLESS: 1 }, baseDamage: 30,
      effects: [block(1, 'POST_DAMAGE', { type: 'SWITCH_ACTIVE', side: 'OWN', chooser: 'CONTROLLER' }, { optional: true })] });
    default: return base({});
  }
}

export type AbilityTemplate = AbilityKind;
export function abilityFromTemplate(kind: AbilityKind, id: string, blockPrefix: string): Ability {
  const b = (timing: EffectBlock['timing'], operation: Operation): EffectBlock => ({ id: `${blockPrefix}-1`, timing, operation });
  switch (kind) {
    case 'ACTIVATED': return { id, name: 'Sopro Restaurador', kind, sourcePositions: ['ACTIVE', 'BENCH'], conditions: [], costs: [],
      usageLimit: { scope: 'INSTANCE_TURN', count: 1 }, endsTurn: false,
      effects: [b('ON_ACTIVATE', { type: 'HEAL_DAMAGE', target: { scope: 'OWN_ACTIVE' }, amount: 10 })] };
    case 'CONTINUOUS': return { id, name: 'Casca Firme', kind, sourcePositions: ['ACTIVE'], conditions: [], costs: [], usageLimit: null, endsTurn: false,
      effects: [b('CONTINUOUS', { type: 'MODIFY', stat: 'DAMAGE_TAKEN', amount: -10, target: SELF, duration: { kind: 'WHILE_SOURCE_IN_PLAY' } })] };
    case 'TRIGGERED': return { id, name: 'Chegada Animada', kind, sourcePositions: ['ACTIVE', 'BENCH'],
      trigger: { event: 'POKEMON_ENTERED', filter: { subject: 'SELF', from: 'HAND' } }, conditions: [], costs: [],
      usageLimit: null, optional: true, endsTurn: false,
      effects: [b('ON_TRIGGER', { type: 'DRAW_CARDS', player: 'OWN', count: 1 })] };
    case 'REPLACEMENT': return { id, name: 'Escudo de Névoa', kind, sourcePositions: ['ACTIVE'], conditions: [], costs: [], usageLimit: null, endsTurn: false,
      effects: [b('REPLACEMENT', { type: 'PREVENT_DAMAGE', target: SELF, categories: ['ATTACK'], amount: 20, duration: { kind: 'WHILE_SOURCE_IN_PLAY' }, charges: 1 })] };
    default: throw new Error(`kind desconhecido ${String(kind)}`);
  }
}

// ---------------------------------------------------------------- modelos de carta (§6)

export type CardTemplateKind =
  | 'POKEMON_BASIC' | 'POKEMON_STAGE_1' | 'POKEMON_STAGE_2' | 'POKEMON_EX' | 'POKEMON_MEGA_EX'
  | 'ITEM' | 'SUPPORTER' | 'TOOL' | 'STADIUM' | 'FOSSIL';
export const CARD_TEMPLATES: readonly { readonly id: CardTemplateKind; readonly label: string; readonly category: 'POKEMON' | 'TRAINER'; readonly hint: string; readonly advanced?: boolean }[] = [
  { id: 'POKEMON_BASIC', label: 'Pokémon Básico', category: 'POKEMON', hint: '70 HP, regra comum, um ataque simples, sem evolução.' },
  { id: 'POKEMON_STAGE_1', label: 'Estágio 1', category: 'POKEMON', hint: '100 HP; escolha a carta de origem da evolução.' },
  { id: 'POKEMON_STAGE_2', label: 'Estágio 2', category: 'POKEMON', hint: '130 HP; escolha a carta de origem da evolução.' },
  { id: 'POKEMON_EX', label: 'Pokémon ex', category: 'POKEMON', hint: 'Regra ex: entrega dois pontos ao ser Nocauteado.' },
  { id: 'POKEMON_MEGA_EX', label: 'Mega ex', category: 'POKEMON', hint: 'Regra Mega ex: três pontos; o estágio continua explícito.' },
  { id: 'ITEM', label: 'Item', category: 'TRAINER', hint: 'Efeito ao jogar e descarte.' },
  { id: 'SUPPORTER', label: 'Apoiador', category: 'TRAINER', hint: '1 por turno, limite herdado do ruleset.' },
  { id: 'TOOL', label: 'Ferramenta', category: 'TRAINER', hint: 'Efeito persistente ligado a um Pokémon.' },
  { id: 'STADIUM', label: 'Estádio', category: 'TRAINER', hint: 'Efeito compartilhado; substituído por outro Estádio.' },
  { id: 'FOSSIL', label: 'Fóssil (avançado)', category: 'TRAINER', hint: 'Item jogado no Banco como Pokémon; não é Básico.', advanced: true },
];

function pokemonRules(over: { id: string; baseName: string; stage: Stage; hp: number; ruleBox: RuleBox; type: PokemonType; attacks: Attack[] }): PokemonCard {
  return syncDerived({
    dataVersion: 2, effectsDsl: 1, id: over.id, version: 1, baseName: over.baseName, name: '', deckLimitKey: '',
    category: 'POKEMON', stage: over.stage, evolvesFrom: [], types: [over.type], baseHp: over.hp, retreatCost: over.stage === 'BASIC' ? 1 : 2,
    weakness: defaultWeakness(over.type), ruleBox: over.ruleBox, knockoutPoints: 1, tags: [], attacks: over.attacks, abilities: [],
  }) as PokemonCard;
}

const DESTINATION: Record<TrainerSubtype, TrainerCard['trainerRules']['destinationAfterPlay']> = {
  ITEM: 'DISCARD', SUPPORTER: 'DISCARD', TOOL: 'ATTACHED_TOOL', STADIUM: 'STADIUM_SLOT',
};

export function trainerEffectsTemplate(subtype: TrainerSubtype | 'FOSSIL', prefix: string): EffectBlock[] {
  switch (subtype) {
    case 'ITEM': return [{ id: `${prefix}-1`, timing: 'ON_PLAY', failurePolicy: 'REQUIRE_ANY',
      operation: { type: 'HEAL_DAMAGE', target: { scope: 'OWN_POKEMON', filter: { hasDamage: true }, pick: { mode: 'CHOOSE', chooser: 'CONTROLLER', min: 1, max: 1 } }, amount: 20 } }];
    case 'SUPPORTER': return [{ id: `${prefix}-1`, timing: 'ON_PLAY', failurePolicy: 'REQUIRE_ANY', operation: { type: 'DRAW_CARDS', player: 'OWN', count: 2 } }];
    case 'TOOL': return [{ id: `${prefix}-1`, timing: 'CONTINUOUS', operation: { type: 'MODIFY', stat: 'MAX_HP', amount: 20, target: SELF, duration: { kind: 'WHILE_SOURCE_IN_PLAY' } } }];
    case 'STADIUM': return [{ id: `${prefix}-1`, timing: 'CONTINUOUS', operation: { type: 'MODIFY', stat: 'RETREAT_COST', amount: -1, target: { scope: 'ALL_POKEMON', filter: { stages: ['BASIC'] } }, duration: { kind: 'WHILE_SOURCE_IN_PLAY' } } }];
    case 'FOSSIL': return [];
    default: return [];
  }
}

function trainerRules(over: { id: string; baseName: string; subtype: TrainerSubtype; fossil?: boolean }): TrainerCard {
  const prefix = slugify(over.baseName, 'efeito').slice(0, 60);
  const fossil = over.fossil === true;
  return syncDerived({
    dataVersion: 2, effectsDsl: 1, id: over.id, version: 1, baseName: over.baseName, name: '', deckLimitKey: '',
    category: 'TRAINER', subtype: over.subtype, baseHp: null, knockoutPoints: null, ruleBox: 'NONE', tags: [], attacks: [], abilities: [],
    trainerRules: fossil
      ? { playConditions: [], destinationAfterPlay: 'BENCH_AS_POKEMON', fieldBehavior: { kind: 'PLAY_AS_POKEMON', hp: 40, types: [], retreatAllowed: false, knockoutPoints: 1, canAttack: false, ownerMayDiscardDuringMainPhase: true } }
      : { playConditions: [], destinationAfterPlay: DESTINATION[over.subtype], ...(over.subtype === 'TOOL' ? { toolTarget: {} } : {}) },
    trainerEffects: trainerEffectsTemplate(fossil ? 'FOSSIL' : over.subtype, prefix),
  }) as TrainerCard;
}

/** Regras iniciais de um modelo (valores são sugestões autorais, não defaults oficiais). */
export function rulesFromTemplate(kind: CardTemplateKind, id: string, baseName: string, type: PokemonType = 'FIRE'): CardDefinition {
  const name = baseName.trim() || 'Carta sem nome';
  const atk = (template: AttackTemplate, attackId: string) => attackFromTemplate(template, attackId, type, attackId);
  switch (kind) {
    case 'POKEMON_BASIC': return pokemonRules({ id, baseName: name, stage: 'BASIC', hp: 70, ruleBox: 'NONE', type, attacks: [atk('SIMPLE', 'investida')] });
    case 'POKEMON_STAGE_1': return pokemonRules({ id, baseName: name, stage: 'STAGE_1', hp: 100, ruleBox: 'NONE', type,
      attacks: [{ ...atk('SIMPLE', 'golpe'), name: 'Golpe', energyCost: { [costTypeOf(type)]: 2 }, baseDamage: 50 }] });
    case 'POKEMON_STAGE_2': return pokemonRules({ id, baseName: name, stage: 'STAGE_2', hp: 130, ruleBox: 'NONE', type,
      attacks: [{ ...atk('SIMPLE', 'impacto'), name: 'Impacto', energyCost: { [costTypeOf(type)]: 2, COLORLESS: 1 }, baseDamage: 90 }] });
    case 'POKEMON_EX': return pokemonRules({ id, baseName: name, stage: 'BASIC', hp: 140, ruleBox: 'EX', type,
      attacks: [{ ...atk('SIMPLE', 'golpe-ex'), name: 'Golpe ex', energyCost: { [costTypeOf(type)]: 2 }, baseDamage: 60 }] });
    case 'POKEMON_MEGA_EX': return pokemonRules({ id, baseName: name, stage: 'STAGE_1', hp: 200, ruleBox: 'MEGA_EX', type,
      attacks: [{ ...atk('SIMPLE', 'mega-golpe'), name: 'Mega Golpe', energyCost: { [costTypeOf(type)]: 3 }, baseDamage: 120 }] });
    case 'ITEM': return trainerRules({ id, baseName: name, subtype: 'ITEM' });
    case 'SUPPORTER': return trainerRules({ id, baseName: name, subtype: 'SUPPORTER' });
    case 'TOOL': return trainerRules({ id, baseName: name, subtype: 'TOOL' });
    case 'STADIUM': return trainerRules({ id, baseName: name, subtype: 'STADIUM' });
    case 'FOSSIL': return trainerRules({ id, baseName: name, subtype: 'ITEM', fossil: true });
    default: throw new Error(`modelo desconhecido ${String(kind)}`);
  }
}

// ---------------------------------------------------------------- impressões (§18–§21)

export type NewPrintingInput = {
  readonly rules: CardDefinition;
  readonly definitionId: string;
  readonly version: number;
  readonly finish: Finish;
  readonly token: string;
  readonly setId: string;
  readonly collectorNumber: string;
  readonly rarity?: Rarity;
};

export function newPrinting(input: NewPrintingInput): CardPrinting {
  const preset = FINISH_PRESETS[DEFAULT_PRESET_BY_FINISH[input.finish]];
  return {
    printingId: newPrintingId(input.definitionId, input.finish, input.token),
    cardDefinitionId: input.definitionId,
    cardDefinitionVersion: input.version,
    appearanceVersion: 1,
    finish: input.finish,
    rarity: input.rarity ?? (input.rules.ruleBox === 'NONE' ? 'COMMON' : 'RARE'),
    language: 'pt-BR',
    templateId: suggestedTemplate(input.rules),
    setId: input.setId,
    collectorNumber: input.collectorNumber,
    artist: null,
    artMode: 'TEMPLATE_ONLY',
    artKey: null,
    artAssetId: null,
    crop: { x: 0, y: 0, width: 1, height: 1 },
    artTransform: { scale: 1, offsetX: 0, offsetY: 0, rotationDegrees: 0, mirrorIllustration: false, exposure: 0 },
    finishSettings: { ...preset.settings },
    variant: { shiny: false, immersiveSceneId: null },
    assetBindings: [],
  };
}

/** Troca o perfil principal de acabamento: um único `finish` (nunca flags paralelas), preset típico aplicado. */
export function withFinish(p: CardPrinting, finish: Finish): CardPrinting {
  if (p.finish === finish) return p;
  const preset = FINISH_PRESETS[DEFAULT_PRESET_BY_FINISH[finish]];
  const keepMask = p.finishSettings.maskMode !== 'ART_WINDOW' && p.finishSettings.foilMaskAssetId
    ? { maskMode: p.finishSettings.maskMode, foilMaskAssetId: p.finishSettings.foilMaskAssetId } : {};
  return { ...p, finish, finishSettings: { ...preset.settings, ...keepMask } };
}

export function withPreset(p: CardPrinting, presetId: FinishPresetId): CardPrinting {
  const preset = FINISH_PRESETS[presetId];
  const keepMask = p.finishSettings.maskMode !== 'ART_WINDOW' && p.finishSettings.foilMaskAssetId
    ? { maskMode: p.finishSettings.maskMode, foilMaskAssetId: p.finishSettings.foilMaskAssetId } : {};
  return { ...p, finish: preset.finish, finishSettings: { ...preset.settings, ...keepMask } };
}

/** Bindings de assets derivados da aparência (ART_MASTER repete artAssetId; FOIL_MASK repete foilMaskAssetId). */
export function withDerivedBindings(p: CardPrinting): CardPrinting {
  const kept = (p.assetBindings ?? []).filter((b) => b.role !== 'ART_MASTER' && b.role !== 'FOIL_MASK');
  const bindings = [...kept];
  if (p.artAssetId) bindings.unshift({ role: 'ART_MASTER', assetId: p.artAssetId });
  if (p.finishSettings?.foilMaskAssetId && p.finishSettings.maskMode !== 'ART_WINDOW') bindings.push({ role: 'FOIL_MASK', assetId: p.finishSettings.foilMaskAssetId });
  return { ...p, assetBindings: bindings };
}

/** Assets referenciados por um rascunho (para `editor_asset_refs`). */
export function draftAssetRefs(draft: EditorDraft): { role: string; assetId: string }[] {
  const out: { role: string; assetId: string }[] = [];
  const seen = new Set<string>();
  const push = (role: string, assetId: string | null | undefined) => {
    if (!assetId || !/^[0-9a-f]{64}$/.test(assetId)) return;
    const key = `${role}:${assetId}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ role, assetId });
  };
  for (const p of draft.printings) {
    push('ART_MASTER', p.artAssetId);
    if (p.finishSettings?.maskMode !== 'ART_WINDOW') push('FOIL_MASK', p.finishSettings?.foilMaskAssetId);
    for (const b of p.assetBindings ?? []) push(b.role, b.assetId);
  }
  if (draft.authoring.maskPaint) push('FOIL_MASK', draft.authoring.maskPaint.maskAssetId);
  return out;
}

// ---------------------------------------------------------------- criação de projeto por modo (§6.1)

export type NewDraftInput = {
  readonly template: CardTemplateKind;
  readonly baseName: string;
  readonly type?: PokemonType;
  readonly definitionId: string;
  readonly token: string;
  readonly setId?: string;
};

export function newDefinitionDraft(input: NewDraftInput): EditorDraft {
  const rules = rulesFromTemplate(input.template, input.definitionId, input.baseName, input.type ?? 'FIRE');
  const setId = input.setId ?? DEFAULT_SET_ID;
  return {
    draftFormat: 1,
    mode: 'NEW_DEFINITION',
    target: { definitionId: input.definitionId, version: 1 },
    rules,
    printings: [newPrinting({ rules, definitionId: input.definitionId, version: 1, finish: 'NORMAL', token: input.token, setId, collectorNumber: '001' })],
    authoring: { notes: '', setId },
    testScenarios: [],
  };
}

export type SourceDraftInput = {
  readonly mode: Exclude<ProjectMode, 'NEW_DEFINITION'>;
  readonly source: CardDefinition;
  readonly sourcePrintings: readonly CardPrinting[];
  /** NEW_VERSION: última versão publicada da definição (alvo = +1). */
  readonly latestVersion?: number;
  /** FORK: novo ID funcional. */
  readonly forkDefinitionId?: string;
  readonly token: string;
  readonly setId?: string;
};

/** Rascunho a partir de uma versão publicada: NEW_VERSION (mesmo ID, +1), VARIANT (regras fixas) ou FORK (novo ID, v1). */
export function draftFromSource(input: SourceDraftInput): EditorDraft {
  const setId = input.setId ?? DEFAULT_SET_ID;
  const src = input.source;
  if (input.mode === 'VARIANT') {
    const base = input.sourcePrintings[0];
    const printing = base
      ? withDerivedBindings({ ...base, printingId: newPrintingId(src.id, base.finish, input.token), setId: /^[a-z0-9][a-z0-9-]{0,39}$/.test(base.setId) ? base.setId : setId })
      : newPrinting({ rules: src, definitionId: src.id, version: src.version, finish: 'NORMAL', token: input.token, setId, collectorNumber: '001' });
    return {
      draftFormat: 1, mode: 'VARIANT', target: { definitionId: src.id, version: src.version }, rules: src,
      printings: [{ ...printing, cardDefinitionId: src.id, cardDefinitionVersion: src.version }],
      authoring: { notes: '', setId: printing.setId }, testScenarios: [],
    };
  }
  const definitionId = input.mode === 'FORK' ? (input.forkDefinitionId ?? src.id) : src.id;
  const version = input.mode === 'FORK' ? 1 : (input.latestVersion ?? src.version) + 1;
  const rules = syncDerived({ ...src, id: definitionId, version } as CardDefinition);
  const printings = (input.sourcePrintings.length ? input.sourcePrintings : [null]).slice(0, 4).map((p, i) => {
    if (!p) return newPrinting({ rules, definitionId, version, finish: 'NORMAL', token: `${input.token}${i}`, setId, collectorNumber: '001' });
    const tpl = compatibleTemplates(rules).includes(p.templateId as TemplateId) ? p.templateId : suggestedTemplate(rules);
    return withDerivedBindings({
      ...p, printingId: newPrintingId(definitionId, p.finish, `${input.token}${i}`), cardDefinitionId: definitionId, cardDefinitionVersion: version,
      templateId: tpl, setId: input.mode === 'FORK' ? setId : p.setId,
    });
  });
  return {
    draftFormat: 1, mode: input.mode, target: { definitionId, version }, rules, printings,
    authoring: { notes: '', setId: input.mode === 'FORK' ? setId : (printings[0]?.setId ?? setId) }, testScenarios: [],
  };
}

// ---------------------------------------------------------------- edições de regras

export function withBaseName(rules: CardDefinition, baseName: string): CardDefinition {
  return syncDerived({ ...rules, baseName } as CardDefinition);
}

/** ex/Mega ex editam o mesmo campo `ruleBox`; recalcula pontos/nome/chave sem tocar HP, dano, custo ou raridade (ED-005/006/007). */
export function withRuleBox(draft: EditorDraft, ruleBox: RuleBox): EditorDraft {
  if (draft.rules.category === 'TRAINER') return draft;
  const rules = syncDerived({ ...draft.rules, ruleBox } as CardDefinition);
  const printings = draft.printings.map((p) => {
    const compatible = compatibleTemplates(rules) as readonly string[];
    return compatible.includes(p.templateId) ? p : { ...p, templateId: suggestedTemplate(rules) };
  });
  return { ...draft, rules, printings };
}

/** Troca destrutiva de categoria (§17): remove atributos exclusivos; o rascunho anterior continua no histórico. */
export function withCategory(draft: EditorDraft, category: 'POKEMON' | 'TRAINER', type: PokemonType = 'FIRE'): EditorDraft {
  if (draft.rules.category === category) return draft;
  const { id, version, baseName } = draft.rules;
  const rules = category === 'POKEMON'
    ? rulesFromTemplate('POKEMON_BASIC', id, baseName, type)
    : rulesFromTemplate('ITEM', id, baseName, type);
  const next = { ...rules, version, tags: draft.rules.tags ?? [], ...(draft.rules.flavorText ? { flavorText: draft.rules.flavorText } : {}) } as CardDefinition;
  const printings = draft.printings.map((p) => ({ ...p, templateId: suggestedTemplate(next) }));
  const testScenarios = draft.testScenarios.filter((s) => (category === 'TRAINER' ? s.kind === 'TRAINER' || s.kind === 'PERSISTENCE' : s.kind !== 'TRAINER'));
  return { ...draft, rules: next, printings, testScenarios };
}

/** Subtipo de Treinador: ajusta destino e campos exclusivos (toolTarget só Ferramenta; fieldBehavior só Fóssil/Item). */
export function withTrainerSubtype(rules: TrainerCard, subtype: TrainerSubtype, fossil = false): TrainerCard {
  const isFossil = fossil && subtype === 'ITEM';
  const base = { playConditions: rules.trainerRules?.playConditions ?? [] };
  const trainerRules: TrainerCard['trainerRules'] = isFossil
    ? { ...base, destinationAfterPlay: 'BENCH_AS_POKEMON', fieldBehavior: rules.trainerRules?.fieldBehavior ?? { kind: 'PLAY_AS_POKEMON', hp: 40, types: [], retreatAllowed: false, knockoutPoints: 1, canAttack: false, ownerMayDiscardDuringMainPhase: true } }
    : { ...base, destinationAfterPlay: DESTINATION[subtype], ...(subtype === 'TOOL' ? { toolTarget: rules.trainerRules?.toolTarget ?? {} } : {}) };
  const allowed = ALLOWED_TRAINER_TIMINGS[isFossil ? 'FOSSIL' : subtype];
  const effects = (rules.trainerEffects ?? []).filter((b) => allowed.includes(b.timing));
  return { ...rules, subtype, trainerRules, trainerEffects: effects.length || isFossil ? effects : trainerEffectsTemplate(subtype, slugify(rules.baseName, 'efeito').slice(0, 60)) };
}

export const ALLOWED_TRAINER_TIMINGS: Record<TrainerSubtype | 'FOSSIL', readonly EffectBlock['timing'][]> = {
  ITEM: ['ON_PLAY'], SUPPORTER: ['ON_PLAY'], TOOL: ['CONTINUOUS', 'ON_TRIGGER', 'REPLACEMENT'], STADIUM: ['CONTINUOUS', 'ON_TRIGGER'], FOSSIL: ['ON_PLAY'],
};
export const ABILITY_TIMING: Record<AbilityKind, EffectBlock['timing']> = {
  ACTIVATED: 'ON_ACTIVATE', CONTINUOUS: 'CONTINUOUS', TRIGGERED: 'ON_TRIGGER', REPLACEMENT: 'REPLACEMENT',
};

// ---------------------------------------------------------------- ataques: adicionar, duplicar, remover, reordenar

export function addAttack(rules: CardDefinition, template: AttackTemplate = 'SIMPLE'): CardDefinition {
  if (rules.category !== 'POKEMON') return rules;
  const id = uniqueId('ataque', rules.attacks.map((a) => a.id));
  const prefix = uniqueId(id, allBlockIds(rules));
  const attack = attackFromTemplate(template, id, rules.types?.[0] ?? 'COLORLESS', prefix);
  return { ...rules, attacks: [...rules.attacks, renameBlocks(attack, allBlockIds(rules))] };
}

function renameBlocks<T extends { readonly effects: readonly EffectBlock[] }>(owner: T, taken: readonly string[]): T {
  const used = new Set(taken);
  const effects = owner.effects.map((b) => {
    const id = used.has(b.id) ? uniqueId(b.id, used) : b.id;
    used.add(id);
    return id === b.id ? b : { ...b, id };
  });
  return { ...owner, effects };
}

/** Remapeia referências do próprio ataque (MODIFY appliesTo.attackIds, COPY_ATTACK attackFilter.attackIds) de `from` para `to`. */
function remapAttackRefs(op: Operation, from: string, to: string): Operation {
  const swap = (ids: readonly string[] | undefined) => ids?.map((x) => (x === from ? to : x));
  switch (op.type) {
    case 'MODIFY': return op.appliesTo?.attackIds ? { ...op, appliesTo: { ...op.appliesTo, attackIds: swap(op.appliesTo.attackIds) } } : op;
    case 'COPY_ATTACK': return op.attackFilter?.attackIds ? { ...op, attackFilter: { ...op.attackFilter, attackIds: swap(op.attackFilter.attackIds) } } : op;
    case 'CONDITIONAL': return { ...op, then: op.then.map((o) => remapAttackRefs(o, from, to)), ...(op.else ? { else: op.else.map((o) => remapAttackRefs(o, from, to)) } : {}) };
    case 'SCHEDULE_DELAYED': return { ...op, operations: op.operations.map((o) => remapAttackRefs(o, from, to)) };
    default: return op;
  }
}

/** Duplicar ataque: ID novo, blocos com IDs novos e referências locais remapeadas (ED-016). */
export function duplicateAttack(rules: CardDefinition, index: number): CardDefinition {
  const src = rules.attacks[index];
  if (!src || rules.category !== 'POKEMON') return rules;
  const id = uniqueId(`${src.id}-copia`, rules.attacks.map((a) => a.id));
  const copy: Attack = renameBlocks({
    ...src, id, name: `${src.name} (cópia)`.slice(0, 40),
    effects: src.effects.map((b) => ({ ...b, operation: remapAttackRefs(b.operation, src.id, id) })),
  }, allBlockIds(rules));
  const attacks = [...rules.attacks];
  attacks.splice(index + 1, 0, copy);
  return { ...rules, attacks };
}

export type Dependency = { readonly kind: 'COPY_ATTACK' | 'MODIFY_ATTACK_IDS' | 'TEST_SCENARIO'; readonly where: string };

function operationRefsAttack(op: Operation, attackId: string): boolean {
  switch (op.type) {
    case 'MODIFY': return !!op.appliesTo?.attackIds?.includes(attackId);
    case 'COPY_ATTACK': return !!op.attackFilter?.attackIds?.includes(attackId);
    case 'CONDITIONAL': return [...op.then, ...(op.else ?? [])].some((o) => operationRefsAttack(o, attackId));
    case 'SCHEDULE_DELAYED': return op.operations.some((o) => operationRefsAttack(o, attackId));
    default: return false;
  }
}

/** Dependências que impedem remoção silenciosa (§32). */
export function attackDependents(draft: EditorDraft, attackId: string): Dependency[] {
  const out: Dependency[] = [];
  const rules = draft.rules;
  const scan = (owner: string, blocks: readonly EffectBlock[]) => {
    for (const b of blocks) if (operationRefsAttack(b.operation, attackId)) out.push({ kind: b.operation.type === 'COPY_ATTACK' ? 'COPY_ATTACK' : 'MODIFY_ATTACK_IDS', where: `${owner} · bloco ${b.id}` });
  };
  for (const a of rules.attacks ?? []) if (a.id !== attackId) scan(`Ataque “${a.name}”`, a.effects);
  for (const a of rules.abilities ?? []) scan(`Habilidade “${a.name}”`, a.effects);
  if (rules.category === 'TRAINER') scan('Treinador', rules.trainerEffects ?? []);
  for (const s of draft.testScenarios) if (s.attackId === attackId) out.push({ kind: 'TEST_SCENARIO', where: `Cenário ${s.id}` });
  return out;
}

export function removeAttack(draft: EditorDraft, index: number): EditorDraft {
  const rules = draft.rules;
  const attack = rules.attacks[index];
  if (!attack || rules.category !== 'POKEMON') return draft;
  return {
    ...draft,
    rules: { ...rules, attacks: rules.attacks.filter((_, i) => i !== index) },
    testScenarios: draft.testScenarios.filter((s) => s.attackId !== attack.id),
  };
}

export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const out = [...list];
  if (from < 0 || from >= out.length || to < 0 || to >= out.length) return out;
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item!);
  return out;
}

export function addAbility(rules: CardDefinition, kind: AbilityKind = 'ACTIVATED'): CardDefinition {
  if (rules.category !== 'POKEMON') return rules;
  const id = uniqueId('habilidade', rules.abilities.map((a) => a.id));
  const ability = renameBlocks(abilityFromTemplate(kind, id, uniqueId(id, allBlockIds(rules))), allBlockIds(rules));
  return { ...rules, abilities: [...rules.abilities, ability] };
}

/** Troca o tipo de Habilidade ajustando campos exclusivos (trigger só TRIGGERED, usageLimit obrigatório em ACTIVATED). */
export function withAbilityKind(ability: Ability, kind: AbilityKind): Ability {
  if (ability.kind === kind) return ability;
  const fresh = abilityFromTemplate(kind, ability.id, ability.effects[0]?.id ?? ability.id);
  const timing = ABILITY_TIMING[kind];
  const effects = ability.effects.map((b) => ({ ...b, timing }));
  const { trigger: _t, ...rest } = ability;
  void _t;
  return {
    ...rest, kind, effects: effects.length ? effects : fresh.effects,
    ...(kind === 'TRIGGERED' ? { trigger: ability.trigger ?? fresh.trigger } : {}),
    usageLimit: kind === 'ACTIVATED' ? (ability.usageLimit ?? { scope: 'INSTANCE_TURN', count: 1 }) : ability.usageLimit ?? null,
    endsTurn: kind === 'ACTIVATED' ? ability.endsTurn : false,
  };
}

/** Próximo ID de bloco único para um dono (ataque/Habilidade/Treinador). */
export function nextBlockId(rules: CardDefinition, ownerId: string): string {
  return uniqueId(`${ownerId}-efeito`, allBlockIds(rules));
}

// ---------------------------------------------------------------- utilidades de caminho (formulários)

/** Atualização imutável por caminho: setIn(obj, ['attacks', 0, 'name'], 'X'). `undefined` remove a chave. */
export function setIn<T>(obj: T, path: readonly (string | number)[], value: unknown): T {
  if (path.length === 0) return value as T;
  const [head, ...rest] = path;
  if (Array.isArray(obj)) {
    const copy = [...obj];
    const index = head as number;
    copy[index] = setIn(copy[index], rest, value);
    return copy as T;
  }
  const base = (obj ?? {}) as Record<string, unknown>;
  const next = setIn(base[head as string], rest, value);
  const copy = { ...base };
  if (next === undefined) delete copy[head as string];
  else copy[head as string] = next;
  return copy as T;
}

export function getIn(obj: unknown, path: readonly (string | number)[]): unknown {
  let node: unknown = obj;
  for (const key of path) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string | number, unknown>)[key];
  }
  return node;
}

export const ALL_TYPES = POKEMON_TYPES;
