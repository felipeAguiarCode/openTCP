// Contrato dataVersion 2 + effects-dsl-v1 (efeitos-dsl.md, schemas/card-definition.schema.json).

export const POKEMON_TYPES = ['GRASS', 'FIRE', 'WATER', 'LIGHTNING', 'PSYCHIC', 'FIGHTING', 'DARKNESS', 'METAL', 'DRAGON', 'COLORLESS'] as const;
export type PokemonType = (typeof POKEMON_TYPES)[number];
export const ENERGY_TYPES = ['GRASS', 'FIRE', 'WATER', 'LIGHTNING', 'PSYCHIC', 'FIGHTING', 'DARKNESS', 'METAL'] as const;
export type EnergyType = (typeof ENERGY_TYPES)[number];
export type CostType = EnergyType | 'COLORLESS';
export const CONDITIONS = ['POISONED', 'BURNED', 'ASLEEP', 'PARALYZED', 'CONFUSED'] as const;
export type SpecialCondition = (typeof CONDITIONS)[number];
export type ControlCondition = 'ASLEEP' | 'PARALYZED' | 'CONFUSED';
export type Stage = 'BASIC' | 'STAGE_1' | 'STAGE_2';
export type RuleBox = 'NONE' | 'EX' | 'MEGA_EX';
export type TrainerSubtype = 'ITEM' | 'SUPPORTER' | 'TOOL' | 'STADIUM';
export type Position = 'ACTIVE' | 'BENCH';
export type Chooser = 'CONTROLLER' | 'OPPONENT';

export type PokemonFilter = {
  readonly types?: readonly PokemonType[];
  readonly stages?: readonly Stage[];
  readonly ruleBoxes?: readonly RuleBox[];
  readonly deckLimitKeys?: readonly string[];
  readonly tags?: readonly string[];
  readonly hasDamage?: boolean;
  readonly hasCondition?: boolean | SpecialCondition;
  readonly hasTool?: boolean;
  readonly hasEnergy?: boolean;
  readonly positions?: readonly Position[];
  readonly excludeSelf?: boolean;
  readonly excludeFossils?: boolean;
  /** Tem (true) ou não tem (false) alguma Habilidade. */
  readonly hasAbility?: boolean;
  /** Tem alguma Habilidade com um destes IDs / nenhuma Habilidade com estes IDs (Unown GUARD/POWER). */
  readonly abilityIds?: readonly string[];
  readonly excludeAbilityIds?: readonly string[];
  /** Tem algum ataque com um destes IDs (Puppy Pile). */
  readonly attackIds?: readonly string[];
  /** Tem pelo menos uma Energia ligada de um destes tipos. */
  readonly energyTypes?: readonly EnergyType[];
  /** A carta do topo evolui de uma destas chaves (Politoed: “que evoluem de Poliwhirl”). */
  readonly evolvesFrom?: readonly string[];
  /** Evoluiu neste turno. */
  readonly evolvedThisTurn?: boolean;
  /** Foi do Banco para o Ativo neste turno. */
  readonly movedToActiveThisTurn?: boolean;
  /** Recebeu dano de ataque, no Ativo, durante o último turno do oponente. */
  readonly damagedByAttackLastOpponentTurn?: boolean;
  /** Entrou em jogo neste turno (false = Doce Raro só em Básicos que já estavam em jogo). */
  readonly enteredPlayThisTurn?: boolean;
};

export type CardFilter = {
  readonly categories?: readonly ('POKEMON' | 'TRAINER')[];
  readonly subtypes?: readonly TrainerSubtype[];
  readonly stages?: readonly Stage[];
  readonly types?: readonly PokemonType[];
  readonly ruleBoxes?: readonly RuleBox[];
  readonly deckLimitKeys?: readonly string[];
  readonly evolvesFromTarget?: boolean;
  readonly excludeFossils?: boolean;
  /** Pokémon que evolui de uma destas chaves (Rockruff: “uma carta que evolui de Rockruff”). */
  readonly evolvesFrom?: readonly string[];
  /** Pokémon com algum ataque destes IDs. */
  readonly attackIds?: readonly string[];
  readonly tags?: readonly string[];
};

export type Pick =
  | { readonly mode: 'ALL' }
  | { readonly mode: 'CHOOSE'; readonly chooser: Chooser; readonly min: number; readonly max: number }
  | { readonly mode: 'RANDOM'; readonly count: number };

export type SelectorScope =
  | 'SELF' | 'OWN_ACTIVE' | 'OPPONENT_ACTIVE' | 'OWN_BENCH' | 'OPPONENT_BENCH'
  | 'OWN_POKEMON' | 'OPPONENT_POKEMON' | 'ALL_POKEMON' | 'EVENT_SOURCE' | 'EVENT_TARGET' | 'OUTPUT'
  /** Só em efeitos de ataque: o Ativo adversário no momento da declaração, fixado nessa entidade. */
  | 'DEFENDING'
  /** O alvo do dano em cálculo (fórmula de dano por alvo: Tapu Lele “para cada Energia ligada a esse Pokémon”). */
  | 'TARGET';

export type Selector = {
  readonly scope: SelectorScope;
  readonly ref?: string;
  readonly filter?: PokemonFilter;
  readonly pick?: Pick;
  readonly outputId?: string;
};

export type Zone = 'OWN_HAND' | 'OPPONENT_HAND' | 'OWN_DECK' | 'OPPONENT_DECK' | 'OWN_DISCARD' | 'OPPONENT_DISCARD';

export type Formula = {
  readonly op:
    | 'CONST' | 'ADD' | 'SUBTRACT' | 'MULTIPLY' | 'MIN' | 'MAX' | 'CLAMP' | 'COUNT_HEADS' | 'COUNT_TAILS'
    | 'COUNT_ATTACHED_ENERGIES' | 'COUNT_PROVIDED_ENERGY_UNITS' | 'COUNT_BENCH_POKEMON' | 'COUNT_POKEMON'
    | 'COUNT_CARDS' | 'DAMAGE_ON_SOURCE' | 'DAMAGE_ON_TARGET' | 'POINTS' | 'OUTPUT_COUNT'
    /** Unidades de Energia (do `energyType`, ou de qualquer tipo) que sobram depois de pagar o custo do ataque corrente. */
    | 'EXTRA_ENERGY_UNITS'
    /** Dano efetivamente causado pelo ataque corrente ao(s) alvo(s) do dano principal. */
    | 'DAMAGE_DEALT_BY_ATTACK'
    /** PS restantes (do primeiro Pokémon do seletor). */
    | 'REMAINING_HP'
    /** Quantos tipos diferentes de Energia estão ligados (ao primeiro Pokémon do seletor). */
    | 'DISTINCT_ENERGY_TYPES'
    /** Custo de Recuo atual (do primeiro Pokémon do seletor). */
    | 'RETREAT_COST'
    /** Número do turno próprio do jogador (`side`): 1 no primeiro turno dele. */
    | 'OWN_TURN_NUMBER'
    /** Quantas vezes Pokémon do controlador usaram o ataque `attackId` (`window`: no último turno dele ou na partida). */
    | 'ATTACKS_USED'
    /** Cartas do topo do baralho do controlador (`count`) que passam no `filter`. */
    | 'TOP_CARDS_MATCHING';
  readonly value?: number;
  readonly operands?: readonly Formula[];
  readonly reference?: string;
  readonly selector?: Selector;
  readonly energyType?: EnergyType;
  readonly side?: 'OWN' | 'OPPONENT' | 'BOTH';
  readonly zone?: Zone;
  readonly filter?: CardFilter;
  readonly attackId?: string;
  readonly window?: 'LAST_OWN_TURN' | 'GAME';
  readonly count?: number;
};

export type Condition = {
  readonly op: 'ALL' | 'ANY' | 'NOT' | 'COMPARE' | 'EXISTS' | 'CARDS_EXIST' | 'SOURCE_POSITION' | 'HAS_CONDITION' | 'IS_TURN_OF'
    /** Há um Estádio em jogo. */
    | 'STADIUM_IN_PLAY'
    /** O controlador jogou um Apoiador neste turno. */
    | 'SUPPORTER_PLAYED_THIS_TURN'
    /** Algum Pokémon do controlador (que passe no `filter`) foi Nocauteado por dano de ataque no último turno do oponente. */
    | 'KNOCKED_OUT_LAST_OPPONENT_TURN'
    /** Alguma das cartas guardadas na saída `reference` (cartas descartadas por este efeito) passa no `filter`. */
    | 'OUTPUT_CARDS_MATCH';
  readonly conditions?: readonly Condition[];
  readonly condition?: Condition | SpecialCondition | 'ANY';
  readonly left?: Formula;
  readonly right?: Formula;
  readonly cmp?: 'EQ' | 'NE' | 'GT' | 'GE' | 'LT' | 'LE';
  readonly selector?: Selector;
  readonly zone?: Zone;
  readonly filter?: CardFilter;
  readonly count?: number;
  readonly position?: Position;
  readonly side?: 'OWN' | 'OPPONENT';
  readonly reference?: string;
};

export type DurationKind = 'INSTANT' | 'THIS_TURN' | 'NEXT_OPPONENT_TURN' | 'NEXT_OWN_TURN' | 'WHILE_SOURCE_IN_PLAY';
export type RemoveOn = 'TARGET_LEAVES_ACTIVE' | 'TARGET_EVOLVES' | 'TARGET_LEAVES_PLAY' | 'SOURCE_LEAVES_ACTIVE';
export type Duration = { readonly kind: DurationKind; readonly removeOn?: readonly RemoveOn[] };

export type TriggerEvent =
  | 'TURN_STARTED' | 'TURN_ENDING' | 'POKEMON_ENTERED' | 'POKEMON_EVOLVED' | 'POKEMON_MOVED' | 'ENERGY_ATTACHED'
  | 'ATTACK_DECLARED' | 'DAMAGE_APPLIED' | 'CONDITION_APPLIED' | 'POKEMON_KNOCKED_OUT' | 'TRAINER_PLAYED';

export type Trigger = {
  readonly event: TriggerEvent;
  readonly filter?: {
    readonly subject?: 'SELF' | 'OWN_POKEMON' | 'OPPONENT_POKEMON' | 'ANY_POKEMON';
    readonly subjectRole?: 'TARGET' | 'SOURCE';
    readonly turnOf?: 'OWN' | 'OPPONENT';
    readonly from?: 'HAND' | 'DECK' | 'DISCARD';
    readonly reason?: 'RETREAT' | 'SWITCH' | 'PROMOTE';
    readonly to?: Position;
    readonly energySource?: 'ENERGY_ZONE' | 'DISCARD' | 'EFFECT';
    readonly attachmentMode?: 'MANUAL' | 'CARD_EFFECT';
    readonly energyType?: EnergyType;
    readonly damageCategory?: 'ATTACK' | 'EFFECT' | 'CONDITION';
    readonly minimum?: number;
    readonly condition?: SpecialCondition;
    readonly subtype?: TrainerSubtype;
    /** Nocaute: só quando causado por dano de ataque (do oponente do Pokémon Nocauteado). */
    readonly cause?: 'ATTACK';
  };
};

export type AdditionalCost =
  | { readonly type: 'DISCARD_ENERGY'; readonly from: 'SELF'; readonly energyType: EnergyType | 'ANY'; readonly count: number }
  | { readonly type: 'DISCARD_HAND_CARDS'; readonly count: number; readonly filter?: CardFilter };

export type ModifyStat = 'MAX_HP' | 'RETREAT_COST' | 'ATTACK_COST' | 'DAMAGE_DEALT' | 'DAMAGE_TAKEN' | 'ENERGY_PROVISION' | 'KNOCKOUT_POINTS'
  /** Dano do Envenenamento na Verificação (Nihilego: +10). */
  | 'POISON_DAMAGE';
export type RestrictableAction = 'ATTACK' | 'RETREAT' | 'PLAY_ITEM' | 'PLAY_SUPPORTER' | 'USE_ABILITY' | 'MANUAL_ENERGY'
  /** Evoluir jogando um Pokémon da mão (Aerodactyl ex). */
  | 'EVOLVE'
  /** Receber Energia da Zona de Energia (manual ou por efeito) — Banette. */
  | 'RECEIVE_ZONE_ENERGY';
/** Regra concedida a um Pokémon por efeito contínuo. */
export type GrantedRule = 'EVOLVE_ANY_TURN' | 'PREVIOUS_EVOLUTION_ATTACKS' | 'EVOLVES_AS';
export type NumberOrFormula = number | Formula;

export type Operation =
  | { readonly type: 'FLIP_COINS'; readonly count?: NumberOrFormula; readonly untilTails?: true; readonly outputId: string }
  | { readonly type: 'DEAL_DAMAGE'; readonly target: Selector; readonly amount: NumberOrFormula; readonly category?: 'ATTACK' | 'EFFECT'; readonly applyWeakness?: boolean; readonly ignoreDefenderModifiers?: boolean }
  | { readonly type: 'HEAL_DAMAGE'; readonly target: Selector; readonly amount: NumberOrFormula | 'ALL' }
  /** `RANDOM`: uma condição sorteada entre as que o alvo ainda não tem; `poisonDamage`: dano do Envenenamento deste efeito. */
  | { readonly type: 'APPLY_CONDITION'; readonly target: Selector; readonly condition: SpecialCondition | 'RANDOM'; readonly poisonDamage?: number }
  /** `RANDOM_ONE`: remove uma condição sorteada entre as que o alvo tem. */
  | { readonly type: 'REMOVE_CONDITION'; readonly target: Selector; readonly conditions: readonly SpecialCondition[] | 'ALL' | 'RANDOM_ONE' }
  | { readonly type: 'DRAW_CARDS'; readonly player: 'OWN' | 'OPPONENT'; readonly count: NumberOrFormula }
  | { readonly type: 'SEARCH_DECK'; readonly player: 'OWN'; readonly filter: CardFilter; readonly count: number; readonly mode: 'CHOOSE' | 'RANDOM'; readonly destination: 'HAND' | 'BENCH'; readonly reveal?: boolean; readonly shuffleAfter?: boolean }
  /**
   * `energyType`: tipo fixo, `READY` (a pronta da Zona), `RANDOM` (um dos 8 tipos; do descarte, uma Energia descartada
   * qualquer) ou `ZONE_RANDOM` (um dos tipos da Zona do jogador). `energyTypes`: uma unidade de cada tipo listado.
   * `perTarget`: cada alvo escolhido recebe `count` unidades.
   */
  | { readonly type: 'ATTACH_ENERGY'; readonly target: Selector; readonly energyType: EnergyType | 'READY' | 'RANDOM' | 'ZONE_RANDOM'; readonly energyTypes?: readonly EnergyType[]; readonly count: NumberOrFormula; readonly source: 'GENERATED' | 'ENERGY_ZONE_READY' | 'DISCARDED_ENERGY'; readonly consumesManualAttachment?: boolean; readonly consumesReadyEnergy?: boolean; readonly distribute?: true; readonly perTarget?: true }
  /** `energyTypes`: só Energias destes tipos; `perTarget`: uma unidade para cada alvo escolhido (Cabo Elétrico). */
  | { readonly type: 'MOVE_ENERGY'; readonly from: Selector; readonly to: Selector; readonly energyType?: EnergyType | 'ANY'; readonly energyTypes?: readonly EnergyType[]; readonly count: number | 'ALL'; readonly perTarget?: true }
  /** `energyTypes`: uma de cada tipo listado; `combined`: o sorteio é entre as Energias de todos os alvos juntos. */
  | { readonly type: 'DISCARD_ENERGY'; readonly target: Selector; readonly energyType?: EnergyType | 'ANY'; readonly energyTypes?: readonly EnergyType[]; readonly count: NumberOrFormula | 'ALL'; readonly chooser?: Chooser | 'RANDOM'; readonly combined?: true }
  /** `incoming: 'SELF'`: quem entra no Ativo é o próprio Pokémon da Habilidade (Solgaleo ex). */
  | { readonly type: 'SWITCH_ACTIVE'; readonly side: 'OWN' | 'OPPONENT'; readonly chooser: Chooser | 'RANDOM'; readonly filter?: PokemonFilter; readonly incoming?: 'SELF' }
  /** `from: 'DECK'`: uma carta aleatória do baralho que evolui do alvo (Porygon2). */
  | { readonly type: 'EVOLVE'; readonly target: Selector; readonly fromHand: CardFilter; readonly skipStage?: boolean; readonly ignoreTurnRestrictions?: boolean; readonly from?: 'DECK' }
  /**
   * `amount` pode ser fórmula (Beastite: 10 × pontos). `appliesTo.attackIds`: só esses ataques; `attackerFilter`: só dano
   * de atacantes que passem no filtro (DAMAGE_TAKEN); `targetFilter`: só dano a alvos que passem no filtro (DAMAGE_DEALT).
   * `exclusive`: vários iguais da mesma carta não acumulam.
   */
  | { readonly type: 'MODIFY'; readonly stat: ModifyStat; readonly amount: NumberOrFormula; readonly target: Selector; readonly duration: Duration; readonly energyType?: EnergyType; readonly exclusive?: true; readonly appliesTo?: { readonly opponentActiveOnly?: boolean; readonly damageCategory?: 'ATTACK' | 'EFFECT' | 'ANY'; readonly attackIds?: readonly string[]; readonly attackerFilter?: PokemonFilter; readonly targetFilter?: PokemonFilter } }
  /** `attackerFilter`: só dano de atacantes que passem no filtro; `coinFlip`: o dono joga uma moeda e só previne com cara. */
  | { readonly type: 'PREVENT_DAMAGE'; readonly target: Selector; readonly categories: readonly ('ATTACK' | 'EFFECT' | 'CONDITION')[]; readonly amount: number | 'ALL'; readonly duration: Duration; readonly charges?: number; readonly attackerFilter?: PokemonFilter; readonly coinFlip?: true }
  | { readonly type: 'PREVENT_EFFECTS'; readonly target: Selector; readonly fromSide: 'OPPONENT'; readonly duration: Duration }
  /** `attackIds` com ATTACK: só esses ataques ficam proibidos. */
  | { readonly type: 'RESTRICT_ACTION'; readonly target: Selector; readonly actions: readonly RestrictableAction[]; readonly duration: Duration; readonly attackIds?: readonly string[] }
  | { readonly type: 'SUPPRESS_ABILITIES'; readonly target: Selector; readonly duration: Duration }
  /** `upTo`: o controlador escolhe de 0 a `count`; `outputId`: guarda as cartas descartadas (fórmula OUTPUT_COUNT, condição OUTPUT_CARDS_MATCH). */
  | { readonly type: 'DISCARD_CARDS'; readonly zone: 'OWN_HAND' | 'OPPONENT_HAND' | 'OWN_DECK_TOP' | 'OPPONENT_DECK_TOP'; readonly count: NumberOrFormula; readonly chooser: Chooser | 'RANDOM'; readonly filter?: CardFilter; readonly upTo?: true; readonly outputId?: string }
  | { readonly type: 'RETURN_TO_HAND'; readonly target: Selector }
  | { readonly type: 'SHUFFLE_INTO_DECK'; readonly target: Selector }
  | { readonly type: 'DISCARD_POKEMON'; readonly target: Selector }
  | { readonly type: 'KNOCK_OUT'; readonly target: Selector }
  /** `chooser: 'CONTROLLER'`: quem jogou a carta escolhe mesmo no lado do oponente (Flauta Pokémon). */
  | { readonly type: 'PUT_ON_BENCH'; readonly from: 'HAND' | 'DECK' | 'DISCARD'; readonly filter?: CardFilter; readonly count: number; readonly mode: 'CHOOSE' | 'RANDOM'; readonly side: 'OWN' | 'OPPONENT'; readonly chooser?: 'CONTROLLER' }
  | { readonly type: 'RECOVER_FROM_DISCARD'; readonly filter?: CardFilter; readonly count: NumberOrFormula; readonly mode: 'CHOOSE' | 'RANDOM'; readonly destination: 'HAND' | 'DECK' }
  /** `player: 'CHOOSE'`: o controlador escolhe de qual baralho (Unown CHECK). */
  | { readonly type: 'LOOK_AT_TOP'; readonly player: 'OWN' | 'OPPONENT' | 'CHOOSE'; readonly count: NumberOrFormula; readonly reorder?: boolean }
  | { readonly type: 'SHUFFLE_DECK'; readonly player: 'OWN' | 'OPPONENT' }
  | { readonly type: 'REVEAL_HAND'; readonly player: 'OWN' | 'OPPONENT' }
  /** `bindTo: 'SPOT'`: o efeito fica preso ao espaço (Ativo ou posição do Banco) do alvo escolhido, não ao Pokémon. */
  | { readonly type: 'SCHEDULE_DELAYED'; readonly target: Selector; readonly at: 'END_OF_OPPONENT_NEXT_TURN' | 'START_OF_OWN_NEXT_TURN' | 'END_OF_THIS_TURN'; readonly operations: readonly Operation[]; readonly removeOn?: readonly RemoveOn[]; readonly bindTo?: 'SPOT' }
  | { readonly type: 'COPY_ATTACK'; readonly from: Selector; readonly attackFilter?: { readonly maxEnergyCost?: number; readonly attackIds?: readonly string[] }; readonly requireEnergy: boolean }
  | { readonly type: 'CONDITIONAL'; readonly condition: Condition; readonly then: readonly Operation[]; readonly else?: readonly Operation[] }
  | { readonly type: 'REMOVE_TOOL'; readonly target: Selector; readonly destination: 'DISCARD' | 'HAND' }
  | { readonly type: 'END_TURN' }
  /** O ataque corrente não faz nada: sem dano principal e sem os blocos restantes (mesma falha da Confusão). */
  | { readonly type: 'ATTACK_FAILS' }
  /** O jogador embaralha a mão inteira no próprio baralho; `outputId` guarda quantas cartas eram (Iono). */
  | { readonly type: 'SHUFFLE_HAND_INTO_DECK'; readonly player: 'OWN' | 'OPPONENT'; readonly outputId?: string }
  /** Move dano entre Pokémon (não é dano: sem Fraqueza nem modificadores). */
  | { readonly type: 'MOVE_DAMAGE'; readonly from: Selector; readonly to: Selector; readonly amount: number | 'ALL' }
  /** Define os PS restantes: `HALF_DOWN` = metade, arredondada para baixo em múltiplo de 10; `VALUE` = `value`. */
  | { readonly type: 'SET_REMAINING_HP'; readonly target: Selector; readonly mode: 'HALF_DOWN' | 'VALUE'; readonly value?: number }
  /** Involui: a carta de Evolução do topo volta para a mão do dono. */
  | { readonly type: 'DEVOLVE'; readonly target: Selector }
  /** Cartas da mão do oponente voltam embaralhadas ao baralho dele (aleatórias ou escolhidas pelo controlador). */
  | { readonly type: 'RETURN_CARDS_TO_DECK'; readonly zone: 'OPPONENT_HAND'; readonly count: NumberOrFormula; readonly chooser: 'RANDOM' | 'CONTROLLER'; readonly filter?: CardFilter }
  /** Muda o tipo de uma Energia aleatória ligada ao alvo para um tipo sorteado. */
  | { readonly type: 'CHANGE_ENERGY_TYPE'; readonly target: Selector }
  /** Muda o tipo da próxima Energia que a Zona do jogador vai gerar para um tipo sorteado. */
  | { readonly type: 'SET_NEXT_ENERGY'; readonly player: 'OWN' | 'OPPONENT' }
  /** Olha o topo do baralho: as cartas que passam no filtro vão para a mão; as demais voltam ao fundo ou embaralhadas. */
  | { readonly type: 'REVEAL_TOP_TAKE'; readonly count: number; readonly filter: CardFilter; readonly rest: 'BOTTOM' | 'SHUFFLE' }
  /** Revela ao controlador as cartas de uma zona que passam no filtro. */
  | { readonly type: 'REVEAL_CARDS'; readonly zone: 'OPPONENT_DECK' | 'OPPONENT_HAND'; readonly filter?: CardFilter }
  /** Escolhe um Pokémon da mão e troca por um Pokémon aleatório do baralho. */
  | { readonly type: 'SWAP_HAND_WITH_DECK' }
  /** O controlador escolhe uma das opções (cada uma é uma lista de operações). */
  | { readonly type: 'CHOOSE_ONE'; readonly options: readonly (readonly Operation[])[] }
  /** A primeira moeda da próxima jogada de moedas por efeito (ataque, Habilidade ou Treinador) neste turno sai cara. */
  | { readonly type: 'FORCE_COIN' }
  /** Usa o efeito de um Apoiador aleatório do baralho do oponente (fora `excludeKeys`). */
  | { readonly type: 'COPY_TRAINER'; readonly excludeKeys: readonly string[] }
  /** Move quantas Energias quiser entre os seus Pokémon em jogo, uma a uma. */
  | { readonly type: 'MOVE_ENERGY_FREELY' }
  /** Contínuo: o alvo não pode ser afetado por estas Condições Especiais (todas, se omitido) e se recupera delas. */
  | { readonly type: 'PREVENT_CONDITIONS'; readonly target: Selector; readonly duration: Duration; readonly conditions?: readonly SpecialCondition[] }
  /** Contínuo: o alvo não pode ser curado. */
  | { readonly type: 'PREVENT_HEALING'; readonly target: Selector; readonly duration: Duration }
  /** Contínuo: quando o alvo for atacar, o oponente dele joga uma moeda; coroa = o ataque não acontece. */
  | { readonly type: 'ATTACK_COIN_GATE'; readonly target: Selector; readonly duration: Duration }
  /** Contínuo: se o alvo receber dano de ataque, causa `amount` de dano ao Pokémon atacante. */
  | { readonly type: 'COUNTER_DAMAGE'; readonly target: Selector; readonly duration: Duration; readonly amount: number }
  /** Contínuo: regra concedida ao alvo (evoluir em qualquer turno, usar ataques de evoluções anteriores, evoluir como `evolvesAs`). */
  | { readonly type: 'GRANT_RULE'; readonly target: Selector; readonly duration: Duration; readonly rule: GrantedRule; readonly evolvesAs?: readonly string[] }
  /** Contínuo: dano de ataque que Nocautearia o alvo — joga uma moeda; cara = fica com `remainingHp` PS. */
  | { readonly type: 'SURVIVE_KNOCKOUT'; readonly target: Selector; readonly duration: Duration; readonly remainingHp: number }
  /** Contínuo (Habilidade): depois das moedas de um ataque de Pokémon do alvo, o dono pode relançá-las (uma vez por turno). */
  | { readonly type: 'REROLL_COINS'; readonly target: Selector; readonly duration: Duration };

export type OpType = Operation['type'];

export type Timing = 'PRE_DAMAGE' | 'POST_DAMAGE' | 'ON_PLAY' | 'ON_ACTIVATE' | 'ON_TRIGGER' | 'CONTINUOUS' | 'REPLACEMENT';
export type FailurePolicy = 'REQUIRE_ANY' | 'REQUIRE_ALL' | 'BEST_EFFORT';

export type EffectBlock = {
  readonly id: string;
  readonly timing: Timing;
  readonly condition?: Condition | null;
  readonly optional?: boolean;
  readonly failurePolicy?: FailurePolicy;
  readonly operation: Operation;
};

export type EnergyCost = Partial<Record<CostType, number>>;

export type Attack = {
  readonly id: string;
  readonly name: string;
  readonly energyCost: EnergyCost;
  readonly baseDamage: number | null;
  readonly damageFormula: Formula | null;
  readonly damageTarget: Selector | null;
  readonly preconditions: readonly Condition[];
  readonly additionalCosts: readonly AdditionalCost[];
  readonly effects: readonly EffectBlock[];
  readonly endsTurn: boolean;
  /** Custo alternativo quando a condição vale (Boltund: com dano, 1 Energia Elétrica). */
  readonly alternativeCost?: { readonly condition: Condition; readonly energyCost: EnergyCost };
  /** O dano principal ignora efeitos no Pokémon Ativo do oponente (modificadores e prevenções; Fraqueza vale). */
  readonly ignoreDefenderEffects?: true;
  readonly presentation?: { readonly presetId?: 'ATTACK_STANDARD' | 'ATTACK_SPECIAL'; readonly vfxProfile?: string; readonly soundCue?: string | null };
};

export type AbilityKind = 'ACTIVATED' | 'CONTINUOUS' | 'TRIGGERED' | 'REPLACEMENT';
export type UsageScope = 'INSTANCE_TURN' | 'NAME_TURN' | 'PLAYER_TURN' | 'INSTANCE_MATCH' | 'PLAYER_MATCH'
  /** “Quantas vezes quiser durante o seu turno” (Vaporeon, Dusknoir). */
  | 'UNLIMITED';

export type Ability = {
  readonly id: string;
  readonly name: string;
  readonly kind: AbilityKind;
  readonly sourcePositions: readonly Position[];
  readonly trigger?: Trigger;
  readonly conditions: readonly Condition[];
  readonly costs: readonly AdditionalCost[];
  readonly usageLimit?: { readonly scope: UsageScope; readonly count: number } | null;
  readonly optional?: boolean;
  readonly endsTurn: boolean;
  readonly effects: readonly EffectBlock[];
};

export type FieldBehavior = {
  readonly kind: 'PLAY_AS_POKEMON';
  readonly hp: number;
  readonly types: readonly PokemonType[];
  readonly retreatAllowed: false;
  readonly knockoutPoints: 1;
  readonly canAttack: false;
  readonly ownerMayDiscardDuringMainPhase?: boolean;
};

export type TrainerRules = {
  readonly playConditions: readonly Condition[];
  readonly destinationAfterPlay: 'DISCARD' | 'ATTACHED_TOOL' | 'STADIUM_SLOT' | 'BENCH_AS_POKEMON';
  readonly toolTarget?: PokemonFilter;
  readonly fieldBehavior?: FieldBehavior;
  /** Gatilho dos blocos ON_TRIGGER da Ferramenta (padrão: o portador recebe dano de ataque do oponente). */
  readonly toolTrigger?: Trigger;
  /** Ferramenta: se o portador for Nocauteado por dano de ataque, ele vai para a mão em vez do descarte. */
  readonly onKnockedOut?: 'RETURN_TO_HAND';
};

export type Weakness = { readonly type: PokemonType; readonly operation: 'ADD' | 'MULTIPLY'; readonly value: number };

type CardBase = {
  readonly dataVersion: 2;
  readonly effectsDsl?: 1;
  readonly id: string;
  readonly version: number;
  readonly baseName: string;
  readonly name: string;
  readonly deckLimitKey: string;
  readonly ruleBox: RuleBox;
  readonly tags: readonly string[];
  readonly flavorText?: string;
  readonly attacks: readonly Attack[];
  readonly abilities: readonly Ability[];
};

export type PokemonCard = CardBase & {
  readonly category: 'POKEMON';
  readonly stage: Stage;
  readonly evolvesFrom: readonly string[];
  readonly types: readonly PokemonType[];
  readonly baseHp: number;
  readonly retreatCost: number;
  readonly weakness: Weakness | null;
  readonly knockoutPoints: 1 | 2 | 3;
};

export type TrainerCard = CardBase & {
  readonly category: 'TRAINER';
  readonly subtype: TrainerSubtype;
  readonly baseHp: null;
  readonly knockoutPoints: null;
  readonly trainerRules: TrainerRules;
  readonly trainerEffects: readonly EffectBlock[];
};

export type CardDefinition = PokemonCard | TrainerCard;

export type Finish = 'NORMAL' | 'HOLOGRAPHIC' | 'FOIL' | 'CHROME';
export type Rarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'ULTRA' | 'PROMO';

export type CardPrinting = {
  readonly printingId: string;
  readonly cardDefinitionId: string;
  readonly cardDefinitionVersion: number;
  readonly appearanceVersion: 1;
  readonly finish: Finish;
  readonly rarity: Rarity;
  readonly language: string;
  readonly templateId: string;
  readonly setId: string;
  readonly collectorNumber: string;
  readonly artist: string | null;
  readonly artMode: 'ART_WINDOW' | 'FULL_ART' | 'FULL_PRINTING' | 'TEMPLATE_ONLY';
  readonly artKey: string | null;
  readonly artAssetId: string | null;
  readonly crop: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly artTransform: { readonly scale: number; readonly offsetX: number; readonly offsetY: number; readonly rotationDegrees: number; readonly mirrorIllustration: boolean; readonly exposure: number };
  readonly finishSettings: {
    readonly presetId: string;
    readonly intensity: number;
    readonly roughness: number;
    readonly metalness: number;
    readonly patternAngleDegrees?: number;
    readonly patternScale?: number;
    readonly ambientSpeed?: number;
    readonly normalStrength?: number;
    readonly emissive?: number;
    readonly tiltResponse?: number;
    readonly foilPalette?: 'SPECTRAL' | 'PASTEL' | 'SILVER' | 'GOLD';
    readonly chromeEnvironment?: 'STUDIO_LIGHT' | 'TABLE_LIGHT' | 'NEUTRAL';
    readonly maskMode: 'ART_WINDOW' | 'IMPORTED' | 'PAINTED';
    readonly protectText: true;
    readonly foilMaskAssetId?: string;
  };
  readonly variant: { readonly shiny: boolean; readonly immersiveSceneId: string | null };
  readonly assetBindings: readonly { readonly role: string; readonly assetId: string }[];
  readonly fixtureNote?: string;
};

export const isPokemon = (card: CardDefinition): card is PokemonCard => card.category === 'POKEMON';
export const isTrainer = (card: CardDefinition): card is TrainerCard => card.category === 'TRAINER';
export const isFossil = (card: CardDefinition): boolean =>
  card.category === 'TRAINER' && card.trainerRules.destinationAfterPlay === 'BENCH_AS_POKEMON' && !!card.trainerRules.fieldBehavior;
export const definitionKey = (id: string, version: number): string => `${id}@${version}`;
