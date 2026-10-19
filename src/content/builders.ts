// Builders tipados para autoria do conteúdo base. Geram exatamente o JSON dataVersion 2 / effects-dsl-v1,
// validado depois contra os schemas das specs pelo content-build.
import { deckLimitKeyV1, deriveName } from '../domain/cards/naming.ts';
import type {
  Ability, Attack, CardDefinition, CardPrinting, Condition, CostType, EffectBlock, EnergyType, Formula, Operation, PokemonCard,
  PokemonType, RuleBox, Selector, Stage, TrainerCard, TrainerRules, TrainerSubtype, Weakness, Rarity, Finish,
} from '../domain/cards/types.ts';

export const SELF: Selector = { scope: 'SELF' };
export const OPP_ACTIVE: Selector = { scope: 'OPPONENT_ACTIVE' };
export const OWN_ACTIVE: Selector = { scope: 'OWN_ACTIVE' };
export const choose = (scope: Selector['scope'], filter?: Selector['filter'], chooser: 'CONTROLLER' | 'OPPONENT' = 'CONTROLLER', min = 1, max = 1): Selector =>
  ({ scope, ...(filter ? { filter } : {}), pick: { mode: 'CHOOSE', chooser, min, max } });

export const c = (value: number): Formula => ({ op: 'CONST', value });
export const heads = (reference = 'coins'): Formula => ({ op: 'COUNT_HEADS', reference });
export const mul = (...operands: Formula[]): Formula => ({ op: 'MULTIPLY', operands });
export const add = (...operands: Formula[]): Formula => ({ op: 'ADD', operands });
export const atLeastHeads = (n: number, reference = 'coins'): Condition => ({ op: 'COMPARE', left: heads(reference), cmp: 'GE', right: c(n) });

export function block(timing: EffectBlock['timing'], operation: Operation, extra: Partial<Omit<EffectBlock, 'timing' | 'operation'>> = {}): EffectBlock {
  return { id: extra.id ?? '', timing, operation, ...(extra.condition !== undefined ? { condition: extra.condition } : {}),
    ...(extra.optional !== undefined ? { optional: extra.optional } : {}), ...(extra.failurePolicy ? { failurePolicy: extra.failurePolicy } : {}) };
}
export const pre = (operation: Operation, extra: Partial<EffectBlock> = {}) => block('PRE_DAMAGE', operation, extra);
export const post = (operation: Operation, extra: Partial<EffectBlock> = {}) => block('POST_DAMAGE', operation, extra);
export const onPlay = (operation: Operation, extra: Partial<EffectBlock> = {}) => block('ON_PLAY', operation, extra);
export const continuous = (operation: Operation, extra: Partial<EffectBlock> = {}) => block('CONTINUOUS', operation, extra);

export const flip = (count: number, outputId = 'coins'): Operation => ({ type: 'FLIP_COINS', count, outputId });
export const healSelf = (amount: number): Operation => ({ type: 'HEAL_DAMAGE', target: SELF, amount });
export const condition = (name: 'POISONED' | 'BURNED' | 'ASLEEP' | 'PARALYZED' | 'CONFUSED', target: Selector = OPP_ACTIVE): Operation => ({ type: 'APPLY_CONDITION', target, condition: name });

type AttackSpec = {
  id: string;
  name: string;
  cost: Partial<Record<CostType, number>>;
  damage?: number | null;
  formula?: Formula;
  target?: Selector | null;
  effects?: EffectBlock[];
  preconditions?: Condition[];
  additionalCosts?: Attack['additionalCosts'];
  alternativeCost?: Attack['alternativeCost'];
  ignoreDefenderEffects?: true;
  special?: boolean;
};

export function attack(spec: AttackSpec): Attack {
  const formula = spec.formula ?? null;
  const base = formula ? null : spec.damage ?? 0;
  const hasDamage = formula !== null || (base ?? 0) > 0;
  return {
    id: spec.id,
    name: spec.name,
    energyCost: spec.cost,
    baseDamage: base,
    damageFormula: formula,
    damageTarget: spec.target === undefined ? (hasDamage ? OPP_ACTIVE : null) : spec.target,
    preconditions: spec.preconditions ?? [],
    additionalCosts: spec.additionalCosts ?? [],
    effects: withIds(spec.id, spec.effects ?? []),
    endsTurn: true,
    ...(spec.alternativeCost ? { alternativeCost: spec.alternativeCost } : {}),
    ...(spec.ignoreDefenderEffects ? { ignoreDefenderEffects: true as const } : {}),
    ...(spec.special ? { presentation: { presetId: 'ATTACK_SPECIAL' as const } } : {}),
  };
}

type PokemonSpec = {
  id?: string;
  baseName: string;
  ruleBox?: RuleBox;
  stage: Stage;
  from?: string[];
  type: PokemonType;
  hp: number;
  retreat: number;
  weakness?: PokemonType | null;
  attacks: Attack[];
  abilities?: Ability[];
  tags?: string[];
  flavor?: string;
};

const POINTS: Record<RuleBox, 1 | 2 | 3> = { NONE: 1, EX: 2, MEGA_EX: 3 };

export function pokemon(spec: PokemonSpec): PokemonCard {
  const ruleBox = spec.ruleBox ?? 'NONE';
  const name = deriveName(spec.baseName, ruleBox);
  const weakness: Weakness | null = spec.weakness ? { type: spec.weakness, operation: 'ADD', value: 20 } : null;
  return {
    dataVersion: 2, effectsDsl: 1, id: spec.id ?? deckLimitKeyV1(name), version: 1, baseName: spec.baseName, name,
    deckLimitKey: deckLimitKeyV1(name), category: 'POKEMON', stage: spec.stage, evolvesFrom: spec.from ?? [], types: [spec.type],
    baseHp: spec.hp, retreatCost: spec.retreat, weakness, ruleBox, knockoutPoints: POINTS[ruleBox], tags: spec.tags ?? [],
    ...(spec.flavor ? { flavorText: spec.flavor } : {}),
    attacks: spec.attacks, abilities: spec.abilities ?? [],
  };
}

type TrainerSpec = {
  id?: string;
  baseName: string;
  subtype: TrainerSubtype;
  effects: EffectBlock[];
  rules?: Partial<TrainerRules>;
  tags?: string[];
  flavor?: string;
};

const DEST: Record<TrainerSubtype, TrainerRules['destinationAfterPlay']> = { ITEM: 'DISCARD', SUPPORTER: 'DISCARD', TOOL: 'ATTACHED_TOOL', STADIUM: 'STADIUM_SLOT' };

export function trainer(spec: TrainerSpec): TrainerCard {
  const name = spec.baseName;
  return {
    dataVersion: 2, effectsDsl: 1, id: spec.id ?? deckLimitKeyV1(name), version: 1, baseName: spec.baseName, name,
    deckLimitKey: deckLimitKeyV1(name), category: 'TRAINER', subtype: spec.subtype, ruleBox: 'NONE', knockoutPoints: null,
    baseHp: null, tags: spec.tags ?? [], ...(spec.flavor ? { flavorText: spec.flavor } : {}), attacks: [], abilities: [],
    trainerRules: { playConditions: [], destinationAfterPlay: DEST[spec.subtype], ...spec.rules },
    trainerEffects: withIds(deckLimitKeyV1(name), spec.effects),
  };
}

export function ability(spec: Omit<Ability, 'conditions' | 'costs' | 'endsTurn'> & Partial<Pick<Ability, 'conditions' | 'costs' | 'endsTurn'>>): Ability {
  return { conditions: [], costs: [], endsTurn: false, ...spec, effects: withIds(spec.id, spec.effects) };
}

/** IDs de bloco determinísticos por dono (ataque, Habilidade ou Treinador): `<dono>-<n>`. */
function withIds(owner: string, blocks: readonly EffectBlock[]): EffectBlock[] {
  return blocks.map((b, i) => (b.id ? b : { ...b, id: `${owner}-${i + 1}` }));
}

export type PrintingSpec = {
  card: CardDefinition;
  setId: string;
  number: number;
  rarity: Rarity;
  finish?: Finish;
  variant?: string;
  /**
   * Numeração própria por impressão (sets reais como o A1: cada arte alternativa tem o seu número). Com ela o id é
   * `<set>-<NNN>-<carta>` sem sufixo de acabamento e o número de coleção é exatamente `NNN`.
   */
  ownNumber?: boolean;
  /** Impressão imersiva (☆☆☆): cena associada em `variant.immersiveSceneId`. */
  immersiveSceneId?: string;
  /** Impressão brilhante (✵ holográfica / ✵✵ foil): `variant.shiny`. */
  shiny?: boolean;
  artist?: string | null;
  /**
   * Arte empacotada (runtime §20.1): chave lógica `art:<set>:<NNN>` resolvida pela apresentação. A imagem é a carta
   * impressa inteira, então a impressão usa o modo “Impressão completa” (`FULL_PRINTING`).
   */
  artKey?: string | null;
};

export function printing(spec: PrintingSpec): CardPrinting {
  const finish = spec.finish ?? 'NORMAL';
  const suffix = spec.ownNumber ? '' : spec.variant ? `-${spec.variant}` : finish === 'NORMAL' ? '' : `-${finish.toLowerCase()}`;
  const templateId = spec.card.category === 'TRAINER'
    ? (spec.card.trainerRules.destinationAfterPlay === 'BENCH_AS_POKEMON' ? 'pocket-light-card-v1/fossil' : 'pocket-light-card-v1/trainer')
    : spec.card.ruleBox === 'NONE' ? 'pocket-light-card-v1/pokemon-classic' : 'pocket-light-card-v1/pokemon-ex';
  const presets: Record<Finish, { presetId: string; intensity: number; roughness: number; metalness: number }> = {
    NORMAL: { presetId: 'normal-matte', intensity: 0, roughness: 0.65, metalness: 0 },
    HOLOGRAPHIC: { presetId: 'holo-soft-art', intensity: 0.45, roughness: 0.4, metalness: 0.2 },
    FOIL: { presetId: 'foil-diagonal', intensity: 0.55, roughness: 0.35, metalness: 0.35 },
    CHROME: { presetId: 'chrome-border', intensity: 0.6, roughness: 0.2, metalness: 0.8 },
  };
  const number = String(spec.number).padStart(3, '0');
  return {
    // Com numeração própria o set + número já identificam a impressão: o nome da carta (deckLimitKey) basta, mesmo
    // quando a definição tem id com sufixo (outra versão de regras do mesmo nome).
    printingId: `${spec.setId}-${number}-${spec.ownNumber ? spec.card.deckLimitKey : spec.card.id}${suffix}`,
    cardDefinitionId: spec.card.id,
    cardDefinitionVersion: spec.card.version,
    appearanceVersion: 1,
    finish,
    rarity: spec.rarity,
    language: 'pt-BR',
    templateId,
    setId: spec.setId,
    collectorNumber: spec.ownNumber || (finish === 'NORMAL' && !spec.variant) ? number : `${number}${finish === 'NORMAL' ? 'A' : finish[0]}`,
    artist: spec.artist ?? null,
    artMode: spec.artKey ? 'FULL_PRINTING' : 'TEMPLATE_ONLY',
    artKey: spec.artKey ?? null,
    artAssetId: null,
    crop: { x: 0, y: 0, width: 1, height: 1 },
    artTransform: { scale: 1, offsetX: 0, offsetY: 0, rotationDegrees: 0, mirrorIllustration: false, exposure: 0 },
    finishSettings: { ...presets[finish], maskMode: 'ART_WINDOW', protectText: true },
    variant: { shiny: spec.shiny ?? false, immersiveSceneId: spec.immersiveSceneId ?? null },
    assetBindings: [],
  };
}

export type { EnergyType };
