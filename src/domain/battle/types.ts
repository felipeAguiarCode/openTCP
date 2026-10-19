// Estado de partida serializável (gameplay.md §28.6). Nada aqui contém funções, closures ou objetos de apresentação.
import type { RngState, CoinFace } from '../random/rng.ts';
import type {
  ControlCondition, EnergyType, Operation, Position, RestrictableAction, RemoveOn, SpecialCondition, CardDefinition, CardPrinting,
} from '../cards/types.ts';

export type PlayerId = 'A' | 'B';
export const PLAYERS: readonly PlayerId[] = ['A', 'B'];
export const other = (p: PlayerId): PlayerId => (p === 'A' ? 'B' : 'A');

export type RulesetConfig = {
  readonly rulesetId: 'local-campaign-v2';
  readonly deckSize: 20;
  readonly maxCopiesPerDeckName: 2;
  readonly openingHandSize: 5;
  readonly maximumHandSize: 10;
  readonly benchSlots: 3;
  readonly pointsToWin: 3;
  readonly maximumGlobalTurns: number;
  readonly firstPlayerOpeningEnergy: false;
  readonly firstPersonalTurnEvolution: false;
  readonly deckOutLosesGame: false;
  readonly simultaneousTerminalPolicy: 'DRAW';
  readonly rngAlgorithm: 'rng-v1';
};

export const DEFAULT_RULESET: RulesetConfig = {
  rulesetId: 'local-campaign-v2',
  deckSize: 20,
  maxCopiesPerDeckName: 2,
  openingHandSize: 5,
  maximumHandSize: 10,
  benchSlots: 3,
  pointsToWin: 3,
  maximumGlobalTurns: 60,
  firstPlayerOpeningEnergy: false,
  firstPersonalTurnEvolution: false,
  deckOutLosesGame: false,
  simultaneousTerminalPolicy: 'DRAW',
  rngAlgorithm: 'rng-v1',
};

/** Fonte imutável de definições e impressões fixadas pela tentativa. */
export type CatalogLookup = {
  readonly definition: (definitionKey: string) => CardDefinition;
  readonly printing: (printingId: string) => CardPrinting;
  /** Definições publicadas com a chave de limite (evolução especial que pula estágio). */
  readonly findByDeckLimitKey: (deckLimitKey: string) => readonly CardDefinition[];
};

export type BattleCard = {
  readonly id: string;
  readonly owner: PlayerId;
  readonly printingId: string;
  readonly definitionKey: string;
};

export type EnergyUnit = { readonly id: string; readonly type: EnergyType };

export type Conditions = {
  poisoned: boolean;
  burned: boolean;
  control: ControlCondition | null;
  paralyzedSinceTurn: number | null;
  /** Dano do Envenenamento definido pelo efeito que envenenou (Tóxico: 20); ausente = 10. */
  poisonDamage?: number;
};

export type PokemonEntity = {
  entityId: string;
  owner: PlayerId;
  stack: string[];
  damage: number;
  energies: EnergyUnit[];
  toolCardId: string | null;
  conditions: Conditions;
  enteredPlayOnTurn: number;
  lastEvolvedOnTurn: number;
  usage: Record<string, number>;
  /** Turno global em que foi do Banco para o Ativo pela última vez. */
  movedToActiveOnTurn?: number;
  /** Turno global em que recebeu dano de ataque estando no Ativo. */
  damagedByAttackOnTurn?: number;
  /** Último dano recebido (causa do Nocaute) e o turno global em que veio. */
  lastDamage?: { readonly category: 'ATTACK' | 'EFFECT' | 'CONDITION'; readonly sourceEntityId: string | null; readonly sourcePlayer: PlayerId | null; readonly turn?: number };
};

export type TurnFlags = {
  supporterUsed: boolean;
  retreatUsed: boolean;
  manualEnergyUsed: boolean;
  stadiumPlayed: boolean;
  usage: Record<string, number>;
};

export type EnergyZone = {
  types: EnergyType[];
  ready: EnergyType | null;
  next: EnergyType | null;
};

export type PlayerState = {
  id: PlayerId;
  deck: string[];
  hand: string[];
  discard: string[];
  discardedEnergy: EnergyUnit[];
  active: PokemonEntity | null;
  bench: (PokemonEntity | null)[];
  energyZone: EnergyZone;
  points: number;
  flags: TurnFlags;
  matchUsage: Record<string, number>;
  revealedHand: boolean;
  /** Ataques usados por Pokémon deste jogador (Sweets Relay). */
  attackLog?: { readonly ownTurn: number; readonly attackId: string }[];
  /** Pokémon deste jogador Nocauteados (turno global, carta do topo e causa). */
  koLog?: { readonly globalTurn: number; readonly cardId: string; readonly cause: 'ATTACK' | 'EFFECT' | 'CONDITION' | 'OTHER' }[];
  /** Will: a primeira moeda da próxima jogada por efeito neste turno sai cara. */
  forceHeads?: boolean;
};

export type Expiry = { readonly player: PlayerId; readonly ownTurn: number };

export type ActiveEffect = {
  readonly effectId: string;
  readonly controller: PlayerId;
  readonly sourceCardId: string;
  readonly sourceEntityId: string | null;
  readonly operation: Operation;
  /** Alvos fixos (seleção já resolvida) ou null quando o seletor é dinâmico por lado. */
  readonly targets: readonly string[] | null;
  readonly expiry: Expiry | null;
  readonly removeOn: readonly RemoveOn[];
  charges: number | null;
};

export type DelayedEffect = {
  readonly delayedId: string;
  readonly controller: PlayerId;
  readonly sourceCardId: string;
  readonly sourceEntityId: string | null;
  readonly targetEntityId: string;
  readonly at: { readonly player: PlayerId; readonly ownTurn: number; readonly boundary: 'START' | 'END' };
  readonly operations: readonly Operation[];
  readonly removeOn: readonly RemoveOn[];
  /** Preso ao espaço do campo (Truque Floral): vale o Pokémon que estiver ali na hora. */
  readonly spot?: { readonly player: PlayerId; readonly position: 'ACTIVE' | 'BENCH'; readonly benchIndex: number | null };
};

export type Phase = 'SETUP' | 'MAIN' | 'BETWEEN_TURNS' | 'TERMINAL';

export type EffectOutput =
  | { readonly kind: 'COINS'; readonly results: readonly CoinFace[] }
  | { readonly kind: 'TARGETS'; readonly ids: readonly string[] }
  /** Cartas movidas pelo efeito (descartadas do topo, da mão). */
  | { readonly kind: 'CARDS'; readonly ids: readonly string[] }
  | { readonly kind: 'COUNT'; readonly value: number };

/** Contexto de uma resolução (ataque, Treinador, Habilidade, gatilho, efeito atrasado). */
export type Frame = {
  readonly frameId: string;
  readonly controller: PlayerId;
  readonly sourceKind: 'ATTACK' | 'TRAINER' | 'ABILITY' | 'TRIGGER' | 'DELAYED' | 'TOOL' | 'STADIUM';
  readonly sourceCardId: string;
  readonly sourceEntityId: string | null;
  readonly attackId: string | null;
  readonly abilityId: string | null;
  readonly eventSourceEntityId: string | null;
  readonly eventTargetEntityId: string | null;
  readonly attackTargetEntityId: string | null;
  readonly depth: number;
  outputs: Record<string, EffectOutput>;
  failed: boolean;
  forceEndTurn: boolean;
  damageDealtByAttack: number;
};

export type Choices = Record<string, readonly string[]>;

export type Task =
  | { readonly kind: 'BLOCK'; readonly frameId: string; readonly blockId: string; readonly operation: Operation; readonly condition: unknown; readonly optional: boolean; readonly policy: 'REQUIRE_ANY' | 'REQUIRE_ALL' | 'BEST_EFFORT'; choices: Choices }
  | { readonly kind: 'CONFUSION_CHECK'; readonly frameId: string }
  /** Moeda do Smokescreen/Octazooka antes do ataque: coroa = o ataque não acontece. */
  | { readonly kind: 'COIN_GATE'; readonly frameId: string }
  | { readonly kind: 'MAIN_DAMAGE'; readonly frameId: string; choices: Choices }
  | { readonly kind: 'FRAME_END'; readonly frameId: string; readonly endsTurn: boolean }
  | { readonly kind: 'KO_CHECK' }
  /** Segunda etapa do Nocaute: as reações já resolveram; agora o grupo sai de campo e os pontos são concedidos. */
  | { readonly kind: 'KO_RESOLVE'; readonly entityIds: readonly string[] }
  | { readonly kind: 'PROMOTIONS'; choices: Choices }
  | { readonly kind: 'END_TURN' }
  | { readonly kind: 'CHECKUP' }
  | { readonly kind: 'START_TURN'; readonly player: PlayerId }
  | { readonly kind: 'TURN_TRANSITION' }
  | { readonly kind: 'SETUP'; choices: Choices };

export type DecisionKind =
  | 'SETUP' | 'PROMOTE' | 'SELECT_TARGETS' | 'SELECT_CARDS' | 'SELECT_ENERGY' | 'SELECT_ATTACK' | 'CONFIRM_OPTIONAL' | 'ORDER_TOP'
  /** Escolha entre opções nomeadas (Bolsa de Eevee, baralho do Unown CHECK); `labels` traz o texto de cada uma. */
  | 'SELECT_MODE';

export type Decision = {
  readonly decisionId: string;
  readonly player: PlayerId;
  readonly kind: DecisionKind;
  readonly reason: string;
  readonly options: readonly string[];
  readonly min: number;
  readonly max: number;
  /** Chave em `choices` da tarefa da frente da fila que recebe a resposta. */
  readonly choiceKey: string;
  /** Escolha simultânea: outras decisões do mesmo grupo ficam ocultas até todas serem respondidas. */
  readonly simultaneousGroup: string | null;
  /** Texto PT-BR de cada opção (SELECT_MODE). */
  readonly labels?: Readonly<Record<string, string>>;
  answered: readonly string[] | null;
};

export type ObjectiveStats = {
  benchPlacements: number;
  evolutions: number;
  manualEnergy: number;
  playedSubtypes: string[];
  retreats: number;
  switchEffects: number;
  attackers: string[];
  damageSources: string[];
  maxEnergyOnOnePokemon: number;
  activatedAbilities: number;
  conditionRemovedByCause: string[];
  evolvedWithCondition: number;
  delayedPrevented: number;
  toolsAttached: number;
  stadiumReplacedDifferentName: number;
  modifierSourcesRemoved: number;
  knockoutsWithoutAttack: number;
  knockedOutRoles: string[];
  knockedOutRuleBoxes: string[];
  ownTurnsAtWin: number | null;
};

export type MatchResult = {
  readonly outcome: 'WIN' | 'DRAW';
  readonly winner: PlayerId | null;
  readonly reason: 'POINTS' | 'NO_POKEMON' | 'TURN_LIMIT' | 'CONCEDE' | 'SIMULTANEOUS';
  readonly points: Record<PlayerId, number>;
  readonly globalTurnNumber: number;
};

export type MatchState = {
  readonly formatVersion: 1;
  readonly matchId: string;
  readonly engineVersion: string;
  readonly config: RulesetConfig;
  readonly cards: Record<string, BattleCard>;
  players: Record<PlayerId, PlayerState>;
  stadium: { cardId: string; owner: PlayerId } | null;
  phase: Phase;
  firstPlayer: PlayerId;
  currentPlayer: PlayerId;
  globalTurnNumber: number;
  ownTurns: Record<PlayerId, number>;
  pendingDecisions: Decision[];
  queue: Task[];
  frames: Record<string, Frame>;
  activeEffects: ActiveEffect[];
  delayedEffects: DelayedEffect[];
  rng: RngState;
  /** Entidades marcadas por KNOCK_OUT, processadas no próximo KO_CHECK. */
  koMarked: string[];
  /** Nocauteados já anunciados aguardando KO_RESOLVE (as reações resolvem antes de saírem de campo). */
  koPending?: string[];
  /** Moedas roteirizadas de tutorial/puzzle (consumidas antes do RNG). */
  scriptedCoins: CoinFace[];
  counters: { entity: number; energy: number; decision: number; frame: number; effect: number };
  eventSeq: number;
  stateVersion: number;
  stats: Record<PlayerId, ObjectiveStats>;
  roleTags: Record<string, readonly string[]>;
  result: MatchResult | null;
};

// ---- ações (comandos de domínio)
export type Action =
  | { readonly type: 'PLAY_BASIC'; readonly player: PlayerId; readonly cardId: string; readonly benchIndex: number }
  | { readonly type: 'EVOLVE'; readonly player: PlayerId; readonly cardId: string; readonly targetEntityId: string }
  | { readonly type: 'ATTACH_ENERGY'; readonly player: PlayerId; readonly targetEntityId: string }
  | { readonly type: 'PLAY_TRAINER'; readonly player: PlayerId; readonly cardId: string; readonly targetEntityId?: string; readonly benchIndex?: number }
  | { readonly type: 'USE_ABILITY'; readonly player: PlayerId; readonly entityId: string; readonly abilityId: string }
  | { readonly type: 'RETREAT'; readonly player: PlayerId; readonly benchIndex: number; readonly energyIds: readonly string[] }
  /** `sourceCardId`: carta da pilha dona do ataque quando não é a do topo (ataques de evoluções anteriores). */
  | { readonly type: 'ATTACK'; readonly player: PlayerId; readonly attackId: string; readonly sourceCardId?: string; readonly costEnergyIds?: readonly string[]; readonly costHandCardIds?: readonly string[] }
  | { readonly type: 'DISCARD_FOSSIL'; readonly player: PlayerId; readonly entityId: string }
  | { readonly type: 'END_TURN'; readonly player: PlayerId }
  | { readonly type: 'RESOLVE_DECISION'; readonly player: PlayerId; readonly decisionId: string; readonly selection: readonly string[] }
  | { readonly type: 'CONCEDE'; readonly player: PlayerId };

export type ActionType = Action['type'];

// ---- eventos
export type EventVisibility = 'PUBLIC' | 'OWNER';

export type BattleEvent = {
  readonly seq: number;
  readonly type: string;
  readonly group: number;
  readonly visibility: EventVisibility;
  readonly owner: PlayerId | null;
  /** Campos removidos da projeção de quem não é dono quando visibility = OWNER. */
  readonly secretFields: readonly string[];
  readonly data: Readonly<Record<string, unknown>>;
};

export type ApplyResult = {
  readonly state: MatchState;
  readonly events: readonly BattleEvent[];
};

export type RuleError = { readonly ok: false; readonly code: string; readonly message?: string };
export type Validation = { readonly ok: true } | RuleError;

export type PokemonPositionRef = { readonly player: PlayerId; readonly position: Position; readonly benchIndex: number | null };
export type { SpecialCondition, RestrictableAction };
