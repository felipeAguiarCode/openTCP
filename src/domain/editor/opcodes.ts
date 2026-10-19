// Biblioteca de efeitos publicáveis do Estúdio (editor-de-cartas.md §13–§14), gerada a partir do registro
// executável do motor (`OPCODES` em domain/battle/ops.ts). Cada entrada descreve parâmetros (formulários),
// família, ajuda e dica para IA; texto gerado vem de domain/cards/text.ts. Um opcode fora do registro do
// motor não aparece para autoria e, num documento importado, bloqueia a publicação (UNKNOWN_OPCODE).
import { CONTINUOUS_OPCODES, OPCODES } from '../battle/ops.ts';
import type { OpType, Operation, SelectorScope, Timing } from '../cards/types.ts';
import { CONDITIONS, ENERGY_TYPES } from '../cards/types.ts';
import { CONDITION_LABEL, TYPE_LABEL } from '../cards/text.ts';

export type Option = { readonly value: string; readonly label: string };

export type ParamKind =
  | { readonly kind: 'selector'; readonly defaultScope: SelectorScope }
  | { readonly kind: 'int'; readonly min: number; readonly max: number }
  /** Inteiro, fórmula e/ou "ALL" conforme o schema do opcode. */
  | { readonly kind: 'amount'; readonly min: number; readonly max: number; readonly formula: boolean; readonly all: boolean }
  | { readonly kind: 'enum'; readonly options: readonly Option[] }
  | { readonly kind: 'multiEnum'; readonly options: readonly Option[]; readonly min: number }
  | { readonly kind: 'conditionsOrAll' }
  | { readonly kind: 'bool' }
  | { readonly kind: 'text'; readonly maxLength: number }
  | { readonly kind: 'duration' }
  | { readonly kind: 'cardFilter' }
  | { readonly kind: 'pokemonFilter' }
  | { readonly kind: 'condition' }
  | { readonly kind: 'operations'; readonly min: number; readonly max: number }
  | { readonly kind: 'idList' }
  | { readonly kind: 'object'; readonly fields: readonly ParamSpec[] };

export type ParamSpec = {
  readonly key: string;
  readonly label: string;
  readonly required: boolean;
  readonly param: ParamKind;
  readonly help?: string;
};

export type Family =
  | 'COINS' | 'DRAW' | 'SEARCH' | 'DAMAGE' | 'HEAL' | 'CONDITIONS' | 'ENERGY' | 'SWITCH' | 'EVOLUTION' | 'MODIFIERS'
  | 'PROTECTION' | 'CONTROL' | 'FIELD' | 'HAND_DECK' | 'FLOW' | 'COPY';

export const FAMILY_LABEL: Record<Family, string> = {
  COINS: 'Moedas', DRAW: 'Compra', SEARCH: 'Busca', DAMAGE: 'Dano', HEAL: 'Cura', CONDITIONS: 'Condições', ENERGY: 'Energia',
  SWITCH: 'Troca', EVOLUTION: 'Evolução', MODIFIERS: 'Modificadores', PROTECTION: 'Proteção', CONTROL: 'Controle', FIELD: 'Campo',
  HAND_DECK: 'Mão e baralho', FLOW: 'Fluxo', COPY: 'Cópia',
};

export type OpcodeSpec = {
  readonly type: OpType;
  readonly label: string;
  readonly family: Family;
  readonly help: string;
  /** Dica para a IA do adversário avaliar a jogada (DSL §1). */
  readonly aiHint: string;
  /** Marca C da DSL §9: aceito em CONTINUOUS/REPLACEMENT. */
  readonly continuous: boolean;
  readonly params: readonly ParamSpec[];
  readonly create: () => Operation;
};

const o = (value: string, label: string): Option => ({ value, label });
const req = (key: string, label: string, param: ParamKind, help?: string): ParamSpec => ({ key, label, required: true, param, ...(help ? { help } : {}) });
const opt = (key: string, label: string, param: ParamKind, help?: string): ParamSpec => ({ key, label, required: false, param, ...(help ? { help } : {}) });

const sel = (defaultScope: SelectorScope): ParamKind => ({ kind: 'selector', defaultScope });
const enumOf = (...options: Option[]): ParamKind => ({ kind: 'enum', options });
const int = (min: number, max: number): ParamKind => ({ kind: 'int', min, max });
const BOOL: ParamKind = { kind: 'bool' };
const DURATION: ParamKind = { kind: 'duration' };
const CARD_FILTER: ParamKind = { kind: 'cardFilter' };

export const ENERGY_OPTIONS: readonly Option[] = ENERGY_TYPES.map((t) => o(t, TYPE_LABEL[t]));
export const CONDITION_OPTIONS: readonly Option[] = CONDITIONS.map((c) => o(c, CONDITION_LABEL[c]));
const PLAYER = enumOf(o('OWN', 'Você'), o('OPPONENT', 'Oponente'));
const CHOOSER3 = enumOf(o('CONTROLLER', 'Você escolhe'), o('OPPONENT', 'Oponente escolhe'), o('RANDOM', 'Aleatório'));
const MODE2 = enumOf(o('CHOOSE', 'Escolher'), o('RANDOM', 'Aleatório'));

export const MODIFY_STAT_OPTIONS: readonly Option[] = [
  o('MAX_HP', 'HP máximo'), o('RETREAT_COST', 'Custo de Recuo'), o('ATTACK_COST', 'Custo de ataque (Incolor)'),
  o('DAMAGE_DEALT', 'Dano causado'), o('DAMAGE_TAKEN', 'Dano recebido'), o('ENERGY_PROVISION', 'Fornecimento de Energia'),
  o('KNOCKOUT_POINTS', 'Pontos por Nocaute'), o('POISON_DAMAGE', 'Dano do Envenenamento'),
];
export const ACTION_OPTIONS: readonly Option[] = [
  o('ATTACK', 'Atacar'), o('RETREAT', 'Recuar'), o('PLAY_ITEM', 'Jogar Item'), o('PLAY_SUPPORTER', 'Jogar Apoiador'),
  o('USE_ABILITY', 'Usar Habilidade'), o('MANUAL_ENERGY', 'Ligar Energia da Zona'), o('EVOLVE', 'Evoluir da mão'),
  o('RECEIVE_ZONE_ENERGY', 'Receber Energia da Zona'),
];
export const REMOVE_ON_OPTIONS: readonly Option[] = [
  o('TARGET_LEAVES_ACTIVE', 'Alvo deixa de ser Ativo'), o('TARGET_EVOLVES', 'Alvo evolui'), o('TARGET_LEAVES_PLAY', 'Alvo sai de jogo'),
  o('SOURCE_LEAVES_ACTIVE', 'Fonte deixa de ser Ativa'),
];

const SPECS: readonly OpcodeSpec[] = [
  { type: 'FLIP_COINS', label: 'Lançar moedas', family: 'COINS', continuous: false,
    help: 'Lança N moedas (ou até sair coroa) pelo battleRng e guarda o resultado num nome de saída usado por fórmulas e condições.',
    aiHint: 'Valor esperado: metade das moedas dá cara; sem teto em “até sair coroa”.',
    params: [opt('count', 'Quantidade de moedas', int(1, 20)), opt('untilTails', 'Até sair coroa', BOOL), req('outputId', 'Nome da saída', { kind: 'text', maxLength: 120 }, 'Ex.: attackCoins; referenciado por COUNT_HEADS.')],
    create: () => ({ type: 'FLIP_COINS', count: 1, outputId: 'coins' }) },
  { type: 'DEAL_DAMAGE', label: 'Causar dano', family: 'DAMAGE', continuous: false,
    help: 'Dano adicional ao dano principal, pelo mesmo pipeline. Fraqueza só se aplica quando indicado.',
    aiHint: 'Somar ao dano total previsto; considerar Nocautes no Banco.',
    params: [req('target', 'Alvo', sel('OPPONENT_ACTIVE')), req('amount', 'Quantidade', { kind: 'amount', min: 0, max: 9990, formula: true, all: false }),
      opt('category', 'Categoria', enumOf(o('ATTACK', 'Ataque'), o('EFFECT', 'Efeito'))), opt('applyWeakness', 'Aplicar Fraqueza', BOOL),
      opt('ignoreDefenderModifiers', 'Ignorar modificadores do defensor', BOOL)],
    create: () => ({ type: 'DEAL_DAMAGE', target: { scope: 'OPPONENT_ACTIVE' }, amount: 10 }) },
  { type: 'HEAL_DAMAGE', label: 'Curar dano', family: 'HEAL', continuous: false,
    help: 'Remove dano acumulado; nunca aumenta o HP máximo.', aiHint: 'Valor = dano removido, limitado ao dano existente.',
    params: [req('target', 'Alvo', sel('SELF')), req('amount', 'Quantidade', { kind: 'amount', min: 1, max: 9990, formula: true, all: true })],
    create: () => ({ type: 'HEAL_DAMAGE', target: { scope: 'SELF' }, amount: 20 }) },
  { type: 'APPLY_CONDITION', label: 'Aplicar condição especial', family: 'CONDITIONS', continuous: false,
    help: 'Envenenado, Queimado, Adormecido, Paralisado ou Confuso; só afeta Pokémon Ativos.', aiHint: 'Valorizar condições que impedem ataque do rival.',
    params: [req('target', 'Alvo', sel('OPPONENT_ACTIVE')), req('condition', 'Condição', { kind: 'enum', options: CONDITION_OPTIONS })],
    create: () => ({ type: 'APPLY_CONDITION', target: { scope: 'OPPONENT_ACTIVE' }, condition: 'POISONED' }) },
  { type: 'REMOVE_CONDITION', label: 'Remover condição', family: 'CONDITIONS', continuous: false,
    help: 'Remove condições especiais sem curar dano.', aiHint: 'Útil quando o Ativo próprio está impedido de atacar.',
    params: [req('target', 'Alvo', sel('SELF')), req('conditions', 'Condições', { kind: 'conditionsOrAll' })],
    create: () => ({ type: 'REMOVE_CONDITION', target: { scope: 'SELF' }, conditions: 'ALL' }) },
  { type: 'DRAW_CARDS', label: 'Comprar cartas', family: 'DRAW', continuous: false,
    help: 'Compra até N cartas, respeitando mão de 10 e baralho vazio.', aiHint: 'Valor decresce com a mão cheia.',
    params: [req('player', 'Jogador', PLAYER), req('count', 'Quantidade', { kind: 'amount', min: 0, max: 100, formula: true, all: false })],
    create: () => ({ type: 'DRAW_CARDS', player: 'OWN', count: 1 }) },
  { type: 'SEARCH_DECK', label: 'Buscar no baralho', family: 'SEARCH', continuous: false,
    help: 'Busca no baralho próprio por filtro; para o Banco, só Básicos e com espaço.', aiHint: 'Sem alvo possível o Treinador não pode ser jogado.',
    params: [req('filter', 'Filtro de cartas', CARD_FILTER), req('count', 'Quantidade', int(1, 20)), req('mode', 'Modo', MODE2),
      req('destination', 'Destino', enumOf(o('HAND', 'Mão'), o('BENCH', 'Banco'))), opt('reveal', 'Revelar', BOOL), opt('shuffleAfter', 'Embaralhar depois', BOOL)],
    create: () => ({ type: 'SEARCH_DECK', player: 'OWN', filter: { categories: ['POKEMON'], stages: ['BASIC'] }, count: 1, mode: 'RANDOM', destination: 'HAND', reveal: true, shuffleAfter: true }) },
  { type: 'ATTACH_ENERGY', label: 'Ligar Energia', family: 'ENERGY', continuous: false,
    help: 'Liga Energia gerada, da Zona ou do descarte; a origem fica registrada no evento.', aiHint: 'Aceleração vale mais cedo na partida.',
    params: [req('target', 'Alvo', sel('SELF')), req('energyType', 'Tipo de Energia', { kind: 'enum', options: [...ENERGY_OPTIONS, o('READY', 'Energia pronta da Zona')] }),
      req('count', 'Quantidade', { kind: 'amount', min: 1, max: 10, formula: true, all: false }, 'Número ou fórmula (ex.: número de caras); resultado 0 = sem efeito.'),
      req('source', 'Origem', enumOf(o('GENERATED', 'Gerada'), o('ENERGY_ZONE_READY', 'Zona (pronta)'), o('DISCARDED_ENERGY', 'Energias descartadas'))),
      opt('distribute', 'Escolher o alvo de cada unidade', BOOL, 'Cada Energia vai para um alvo escolhido individualmente entre os elegíveis (“como quiser”).'),
      opt('consumesManualAttachment', 'Consome a ligação manual do turno', BOOL), opt('consumesReadyEnergy', 'Consome a Energia pronta', BOOL)],
    create: () => ({ type: 'ATTACH_ENERGY', target: { scope: 'SELF' }, energyType: 'FIRE', count: 1, source: 'GENERATED' }) },
  { type: 'MOVE_ENERGY', label: 'Mover Energia', family: 'ENERGY', continuous: false,
    help: 'Move anexos concretos entre Pokémon (de uma ou várias origens); gera ENERGY_MOVED (não dispara “Energia ligada”).', aiHint: 'Reposiciona custo de ataque.',
    params: [req('from', 'De', sel('OWN_ACTIVE')), req('to', 'Para', sel('OWN_BENCH')), opt('energyType', 'Tipo', { kind: 'enum', options: [...ENERGY_OPTIONS, o('ANY', 'Qualquer')] }),
      req('count', 'Quantidade', { kind: 'amount', min: 1, max: 10, formula: false, all: true })],
    create: () => ({ type: 'MOVE_ENERGY', from: { scope: 'OWN_ACTIVE' }, to: { scope: 'OWN_BENCH', pick: { mode: 'CHOOSE', chooser: 'CONTROLLER', min: 1, max: 1 } }, count: 1 }) },
  { type: 'DISCARD_ENERGY', label: 'Descartar Energia', family: 'ENERGY', continuous: false,
    help: 'Descarta anexos para as Energias descartadas do dono. “Descarte para usar” é custo adicional, não efeito.', aiHint: 'Custo real de próximo turno.',
    params: [req('target', 'Alvo', sel('SELF')), opt('energyType', 'Tipo', { kind: 'enum', options: [...ENERGY_OPTIONS, o('ANY', 'Qualquer')] }),
      req('count', 'Quantidade', { kind: 'amount', min: 1, max: 20, formula: false, all: true }), opt('chooser', 'Quem escolhe', CHOOSER3)],
    create: () => ({ type: 'DISCARD_ENERGY', target: { scope: 'SELF' }, energyType: 'ANY', count: 1 }) },
  { type: 'SWITCH_ACTIVE', label: 'Trocar Ativo', family: 'SWITCH', continuous: false,
    help: 'Troca o Ativo por um do Banco; não é Recuo e não consome o Recuo do turno.', aiHint: 'Puxar alvo frágil do Banco rival.',
    params: [req('side', 'Lado', PLAYER), req('chooser', 'Quem escolhe', CHOOSER3),
      opt('filter', 'Filtro do Pokémon do Banco', { kind: 'pokemonFilter' }, 'Restringe quem pode entrar no Ativo (ex.: só Básicos).')],
    create: () => ({ type: 'SWITCH_ACTIVE', side: 'OWN', chooser: 'CONTROLLER' }) },
  { type: 'EVOLVE', label: 'Evolução especial', family: 'EVOLUTION', continuous: false,
    help: 'Evolui com carta da mão compatível, com restrições próprias e preservação de dano.', aiHint: 'Pular estágio acelera muito.',
    params: [req('target', 'Alvo', sel('OWN_POKEMON')), req('fromHand', 'Filtro da carta na mão', CARD_FILTER), opt('skipStage', 'Pular estágio', BOOL), opt('ignoreTurnRestrictions', 'Ignorar restrições de turno', BOOL)],
    create: () => ({ type: 'EVOLVE', target: { scope: 'OWN_POKEMON', pick: { mode: 'CHOOSE', chooser: 'CONTROLLER', min: 1, max: 1 } }, fromHand: { evolvesFromTarget: true } }) },
  { type: 'MODIFY', label: 'Modificador', family: 'MODIFIERS', continuous: true,
    help: 'Modifica dano, custo, HP, Recuo, fornecimento de Energia ou pontos, por duração definida; contínuos são recalculados.', aiHint: 'Somar o modificador às projeções enquanto durar.',
    params: [req('stat', 'Atributo', { kind: 'enum', options: MODIFY_STAT_OPTIONS }), req('amount', 'Valor (com sinal)', int(-9990, 9990)), req('target', 'Alvo', sel('SELF')),
      req('duration', 'Duração', DURATION), opt('energyType', 'Tipo de Energia (fornecimento)', { kind: 'enum', options: ENERGY_OPTIONS }),
      opt('appliesTo', 'Aplica-se a', { kind: 'object', fields: [opt('opponentActiveOnly', 'Só contra o Ativo adversário', BOOL),
        opt('damageCategory', 'Categoria de dano', enumOf(o('ATTACK', 'Ataque'), o('EFFECT', 'Efeito'), o('ANY', 'Qualquer'))), opt('attackIds', 'Ataques (IDs)', { kind: 'idList' })] })],
    create: () => ({ type: 'MODIFY', stat: 'DAMAGE_DEALT', amount: 10, target: { scope: 'SELF' }, duration: { kind: 'THIS_TURN' } }) },
  { type: 'PREVENT_DAMAGE', label: 'Prevenir dano', family: 'PROTECTION', continuous: true,
    help: 'Intercepta dano antes de aplicar; cargas opcionais são consumidas.', aiHint: 'Não é invulnerabilidade universal.',
    params: [req('target', 'Alvo', sel('SELF')), req('categories', 'Categorias', { kind: 'multiEnum', min: 1, options: [o('ATTACK', 'Ataque'), o('EFFECT', 'Efeito'), o('CONDITION', 'Condição')] }),
      req('amount', 'Quantidade', { kind: 'amount', min: 1, max: 9990, formula: false, all: true }), req('duration', 'Duração', DURATION), opt('charges', 'Cargas', int(1, 10))],
    create: () => ({ type: 'PREVENT_DAMAGE', target: { scope: 'SELF' }, categories: ['ATTACK'], amount: 'ALL', duration: { kind: 'NEXT_OPPONENT_TURN' } }) },
  { type: 'PREVENT_EFFECTS', label: 'Prevenir efeitos', family: 'PROTECTION', continuous: true,
    help: 'Impede efeitos (não dano) de ataques adversários sobre o alvo.', aiHint: 'Neutraliza condições e descarte.',
    params: [req('target', 'Alvo', sel('SELF')), req('duration', 'Duração', DURATION)],
    create: () => ({ type: 'PREVENT_EFFECTS', target: { scope: 'SELF' }, fromSide: 'OPPONENT', duration: { kind: 'NEXT_OPPONENT_TURN' } }) },
  { type: 'RESTRICT_ACTION', label: 'Restringir ação', family: 'CONTROL', continuous: true,
    help: 'Proíbe ataque, Recuo, Itens, Apoiadores, Habilidades ou Energia manual por duração definida.', aiHint: 'Avaliar a ação proibida mais valiosa do rival.',
    params: [req('target', 'Alvo', sel('OPPONENT_ACTIVE')), req('actions', 'Ações', { kind: 'multiEnum', min: 1, options: ACTION_OPTIONS }), req('duration', 'Duração', DURATION)],
    create: () => ({ type: 'RESTRICT_ACTION', target: { scope: 'OPPONENT_ACTIVE' }, actions: ['RETREAT'], duration: { kind: 'NEXT_OPPONENT_TURN' } }) },
  { type: 'SUPPRESS_ABILITIES', label: 'Suprimir Habilidades', family: 'CONTROL', continuous: true,
    help: 'Habilidades do alvo deixam de contribuir durante a duração.', aiHint: 'Valor depende das Habilidades do rival.',
    params: [req('target', 'Alvo', sel('OPPONENT_ACTIVE')), req('duration', 'Duração', DURATION)],
    create: () => ({ type: 'SUPPRESS_ABILITIES', target: { scope: 'OPPONENT_ACTIVE' }, duration: { kind: 'NEXT_OPPONENT_TURN' } }) },
  { type: 'DISCARD_CARDS', label: 'Descartar cartas', family: 'HAND_DECK', continuous: false,
    help: 'Descarta da mão ou do topo do baralho; escolha aleatória em zona oculta.', aiHint: 'Descartar da mão rival reduz opções.',
    params: [req('zone', 'Zona', enumOf(o('OWN_HAND', 'Sua mão'), o('OPPONENT_HAND', 'Mão do oponente'), o('OWN_DECK_TOP', 'Topo do seu baralho'), o('OPPONENT_DECK_TOP', 'Topo do baralho do oponente'))),
      req('count', 'Quantidade', { kind: 'amount', min: 0, max: 100, formula: true, all: false }), req('chooser', 'Quem escolhe', CHOOSER3), opt('filter', 'Filtro', CARD_FILTER)],
    create: () => ({ type: 'DISCARD_CARDS', zone: 'OPPONENT_HAND', count: 1, chooser: 'RANDOM' }) },
  { type: 'RETURN_TO_HAND', label: 'Devolver à mão', family: 'FIELD', continuous: false,
    help: 'Devolve o Pokémon e a pilha à mão; Energias ao descarte.', aiHint: 'Remove progresso de evolução do rival.',
    params: [req('target', 'Alvo', sel('OPPONENT_ACTIVE'))], create: () => ({ type: 'RETURN_TO_HAND', target: { scope: 'SELF' } }) },
  { type: 'SHUFFLE_INTO_DECK', label: 'Embaralhar no baralho', family: 'FIELD', continuous: false,
    help: 'Pilha e Ferramenta voltam ao baralho; Energias ao descarte.', aiHint: 'Semelhante a devolver, sem mão.',
    params: [req('target', 'Alvo', sel('OPPONENT_ACTIVE'))], create: () => ({ type: 'SHUFFLE_INTO_DECK', target: { scope: 'OPPONENT_ACTIVE' } }) },
  { type: 'DISCARD_POKEMON', label: 'Descartar Pokémon', family: 'FIELD', continuous: false,
    help: 'Pilha, Ferramenta e Energias ao descarte; não concede pontos.', aiHint: 'Não pontua; avaliar pela remoção do campo.',
    params: [req('target', 'Alvo', sel('OPPONENT_ACTIVE'))], create: () => ({ type: 'DISCARD_POKEMON', target: { scope: 'OPPONENT_ACTIVE' } }) },
  { type: 'KNOCK_OUT', label: 'Nocautear', family: 'FIELD', continuous: false,
    help: 'Nocaute direto; concede pontos pelo pipeline de Nocaute.', aiHint: 'Pontos = pontos do alvo.',
    params: [req('target', 'Alvo', sel('OPPONENT_ACTIVE'))], create: () => ({ type: 'KNOCK_OUT', target: { scope: 'OPPONENT_ACTIVE' } }) },
  { type: 'PUT_ON_BENCH', label: 'Colocar no Banco', family: 'FIELD', continuous: false,
    help: 'Coloca Básicos no Banco quando houver espaço.', aiHint: 'Ocupar o Banco rival limita opções.',
    params: [req('from', 'De', enumOf(o('HAND', 'Mão'), o('DECK', 'Baralho'), o('DISCARD', 'Descarte'))), opt('filter', 'Filtro', CARD_FILTER), req('count', 'Quantidade', int(1, 3)), req('mode', 'Modo', MODE2), req('side', 'Lado', PLAYER)],
    create: () => ({ type: 'PUT_ON_BENCH', from: 'DECK', count: 1, mode: 'RANDOM', side: 'OWN' }) },
  { type: 'RECOVER_FROM_DISCARD', label: 'Recuperar do descarte', family: 'SEARCH', continuous: false,
    help: 'Recupera cartas do descarte próprio para a mão ou baralho.', aiHint: 'Valor depende do descarte.',
    params: [opt('filter', 'Filtro', CARD_FILTER), req('count', 'Quantidade', int(1, 10)), req('mode', 'Modo', MODE2), req('destination', 'Destino', enumOf(o('HAND', 'Mão'), o('DECK', 'Baralho')))],
    create: () => ({ type: 'RECOVER_FROM_DISCARD', count: 1, mode: 'CHOOSE', destination: 'HAND' }) },
  { type: 'LOOK_AT_TOP', label: 'Ver o topo do baralho', family: 'SEARCH', continuous: false,
    help: 'O controlador vê o topo e pode reordenar; o adversário vê só a contagem.', aiHint: 'Informação privada.',
    params: [req('player', 'Baralho de', PLAYER), req('count', 'Quantidade', int(1, 10)), opt('reorder', 'Reordenar', BOOL)],
    create: () => ({ type: 'LOOK_AT_TOP', player: 'OWN', count: 3, reorder: true }) },
  { type: 'SHUFFLE_DECK', label: 'Embaralhar baralho', family: 'HAND_DECK', continuous: false,
    help: 'Embaralha pelo battleRng.', aiHint: 'Neutro.', params: [req('player', 'Baralho de', PLAYER)], create: () => ({ type: 'SHUFFLE_DECK', player: 'OWN' }) },
  { type: 'REVEAL_HAND', label: 'Revelar mão', family: 'HAND_DECK', continuous: false,
    help: 'Revela a mão ao controlador até o fim da resolução.', aiHint: 'Informação privada.', params: [req('player', 'Mão de', PLAYER)], create: () => ({ type: 'REVEAL_HAND', player: 'OPPONENT' }) },
  { type: 'SCHEDULE_DELAYED', label: 'Efeito atrasado', family: 'FLOW', continuous: false,
    help: 'Agenda operações para um ponto futuro com alvo e validade; removível.', aiHint: 'Descontar pela chance de remoção.',
    params: [req('target', 'Alvo', sel('OPPONENT_ACTIVE')), req('at', 'Quando', enumOf(o('END_OF_OPPONENT_NEXT_TURN', 'Fim do próximo turno do oponente'), o('START_OF_OWN_NEXT_TURN', 'Início do seu próximo turno'), o('END_OF_THIS_TURN', 'Fim deste turno'))),
      req('operations', 'Operações', { kind: 'operations', min: 1, max: 8 }), opt('removeOn', 'Remover quando', { kind: 'multiEnum', min: 0, options: REMOVE_ON_OPTIONS })],
    create: () => ({ type: 'SCHEDULE_DELAYED', target: { scope: 'OPPONENT_ACTIVE' }, at: 'END_OF_OPPONENT_NEXT_TURN', operations: [{ type: 'DEAL_DAMAGE', target: { scope: 'EVENT_TARGET' }, amount: 30, category: 'EFFECT' }], removeOn: ['TARGET_LEAVES_ACTIVE'] }) },
  { type: 'COPY_ATTACK', label: 'Copiar ataque', family: 'COPY', continuous: false,
    help: 'Resolve o ataque copiado no contexto do copiador.', aiHint: 'Valor = melhor ataque elegível.',
    params: [req('from', 'Copiar de', sel('OPPONENT_ACTIVE')), opt('attackFilter', 'Filtro de ataques', { kind: 'object', fields: [opt('maxEnergyCost', 'Custo máximo', int(0, 20)), opt('attackIds', 'Ataques (IDs)', { kind: 'idList' })] }),
      req('requireEnergy', 'Exige a Energia do ataque', BOOL)],
    create: () => ({ type: 'COPY_ATTACK', from: { scope: 'OPPONENT_ACTIVE' }, requireEnergy: true }) },
  { type: 'CONDITIONAL', label: 'Ramo condicional', family: 'FLOW', continuous: false,
    help: 'Executa operações conforme uma condição; sem efeitos ocultos.', aiHint: 'Avaliar os dois ramos.',
    params: [req('condition', 'Condição', { kind: 'condition' }), req('then', 'Então', { kind: 'operations', min: 1, max: 8 }), opt('else', 'Senão', { kind: 'operations', min: 0, max: 8 })],
    create: () => ({ type: 'CONDITIONAL', condition: { op: 'SOURCE_POSITION', position: 'ACTIVE' }, then: [{ type: 'DRAW_CARDS', player: 'OWN', count: 1 }] }) },
  { type: 'REMOVE_TOOL', label: 'Remover Ferramenta', family: 'FIELD', continuous: false,
    help: 'Remove a Ferramenta; recalcula HP e reavalia Nocaute.', aiHint: 'Pode Nocautear por perda de HP.',
    params: [req('target', 'Alvo', sel('OPPONENT_ACTIVE')), req('destination', 'Destino', enumOf(o('DISCARD', 'Descarte'), o('HAND', 'Mão do dono')))],
    create: () => ({ type: 'REMOVE_TOOL', target: { scope: 'OPPONENT_ACTIVE' }, destination: 'DISCARD' }) },
  { type: 'END_TURN', label: 'Encerrar o turno', family: 'CONTROL', continuous: false,
    help: 'Encerra o turno depois da resolução corrente.', aiHint: 'Custo de oportunidade.', params: [], create: () => ({ type: 'END_TURN' }) },
  { type: 'ATTACK_FAILS', label: 'Ataque não faz nada', family: 'FLOW', continuous: false,
    help: 'Só em ataques: o ataque falha como na Confusão — sem dano principal e sem os blocos seguintes. Use com condição (ex.: coroa).', aiHint: 'Desconta o dano pela chance de falha.',
    params: [], create: () => ({ type: 'ATTACK_FAILS' }) },
  { type: 'SHUFFLE_HAND_INTO_DECK', label: 'Embaralhar a mão no baralho', family: 'HAND_DECK', continuous: false,
    help: 'O jogador embaralha a mão inteira no próprio baralho; o adversário vê só a quantidade.', aiHint: 'Na mão rival, remove recursos já comprados.',
    params: [req('player', 'Mão de', PLAYER)], create: () => ({ type: 'SHUFFLE_HAND_INTO_DECK', player: 'OPPONENT' }) },
  { type: 'MOVE_DAMAGE', label: 'Mover dano', family: 'DAMAGE', continuous: false,
    help: 'Move dano de um Pokémon para outro; não é dano novo (sem Fraqueza nem modificadores).', aiHint: 'Pode Nocautear o destino.',
    params: [req('from', 'De', sel('OWN_POKEMON')), req('to', 'Para', sel('SELF')), req('amount', 'Quantidade', { kind: 'amount', min: 10, max: 9990, formula: false, all: true })],
    create: () => ({ type: 'MOVE_DAMAGE', from: { scope: 'OWN_POKEMON', filter: { hasDamage: true }, pick: { mode: 'CHOOSE', chooser: 'CONTROLLER', min: 1, max: 1 } }, to: { scope: 'SELF' }, amount: 'ALL' }) },
  { type: 'SET_REMAINING_HP', label: 'Definir PS restantes', family: 'DAMAGE', continuous: false,
    help: 'Metade dos PS restantes (arredondada para baixo, em múltiplo de 10) ou um valor fixo; não é dano.', aiHint: 'Forte contra Pokémon com muitos PS.',
    params: [req('target', 'Alvo', sel('OPPONENT_ACTIVE')), req('mode', 'Modo', enumOf(o('HALF_DOWN', 'Metade, para baixo'), o('VALUE', 'Valor fixo'))), opt('value', 'Valor', int(10, 9990))],
    create: () => ({ type: 'SET_REMAINING_HP', target: { scope: 'OPPONENT_ACTIVE' }, mode: 'HALF_DOWN' }) },
  { type: 'DEVOLVE', label: 'Involuir', family: 'EVOLUTION', continuous: false,
    help: 'A carta de Evolução do topo volta para a mão do dono; dano e anexos ficam.', aiHint: 'Pode Nocautear por perda de PS.',
    params: [req('target', 'Alvo', sel('OPPONENT_ACTIVE'))], create: () => ({ type: 'DEVOLVE', target: { scope: 'OPPONENT_ACTIVE' } }) },
  { type: 'RETURN_CARDS_TO_DECK', label: 'Devolver cartas da mão ao baralho', family: 'HAND_DECK', continuous: false,
    help: 'Cartas da mão do oponente (aleatórias ou escolhidas por você) voltam embaralhadas ao baralho dele.', aiHint: 'Tira recursos da mão rival.',
    params: [req('count', 'Quantidade', { kind: 'amount', min: 1, max: 10, formula: true, all: false }), req('chooser', 'Escolha', enumOf(o('RANDOM', 'Aleatória'), o('CONTROLLER', 'Você escolhe'))), opt('filter', 'Filtro', CARD_FILTER)],
    create: () => ({ type: 'RETURN_CARDS_TO_DECK', zone: 'OPPONENT_HAND', count: 1, chooser: 'RANDOM' }) },
  { type: 'CHANGE_ENERGY_TYPE', label: 'Mudar tipo de Energia', family: 'ENERGY', continuous: false,
    help: 'Uma Energia aleatória do alvo passa a ser de um tipo sorteado.', aiHint: 'Pode quebrar o custo do ataque rival.',
    params: [req('target', 'Alvo', sel('OPPONENT_ACTIVE'))], create: () => ({ type: 'CHANGE_ENERGY_TYPE', target: { scope: 'OPPONENT_ACTIVE' } }) },
  { type: 'SET_NEXT_ENERGY', label: 'Mudar próxima Energia', family: 'ENERGY', continuous: false,
    help: 'A próxima Energia da Zona do jogador passa a ser de um tipo sorteado.', aiHint: 'Atrasa o rival.',
    params: [req('player', 'Jogador', PLAYER)], create: () => ({ type: 'SET_NEXT_ENERGY', player: 'OPPONENT' }) },
  { type: 'REVEAL_TOP_TAKE', label: 'Revelar o topo e pegar', family: 'SEARCH', continuous: false,
    help: 'Revela N cartas do topo; as que passam no filtro vão para a mão, as outras para o fundo ou embaralhadas.', aiHint: 'Valor esperado pela densidade do filtro.',
    params: [req('count', 'Quantidade', int(1, 10)), req('filter', 'Filtro', CARD_FILTER), req('rest', 'Resto', enumOf(o('BOTTOM', 'Fundo do baralho'), o('SHUFFLE', 'Embaralhar')))],
    create: () => ({ type: 'REVEAL_TOP_TAKE', count: 1, filter: { categories: ['POKEMON'] }, rest: 'BOTTOM' }) },
  { type: 'REVEAL_CARDS', label: 'Revelar cartas', family: 'HAND_DECK', continuous: false,
    help: 'O oponente revela as cartas de uma zona que passam no filtro.', aiHint: 'Informação.',
    params: [req('zone', 'Zona', enumOf(o('OPPONENT_DECK', 'Baralho do oponente'), o('OPPONENT_HAND', 'Mão do oponente'))), opt('filter', 'Filtro', CARD_FILTER)],
    create: () => ({ type: 'REVEAL_CARDS', zone: 'OPPONENT_DECK', filter: { subtypes: ['SUPPORTER'] } }) },
  { type: 'SWAP_HAND_WITH_DECK', label: 'Trocar Pokémon da mão pelo baralho', family: 'SEARCH', continuous: false,
    help: 'Um Pokémon da mão (escolhido) é trocado por um Pokémon aleatório do baralho.', aiHint: 'Filtra a mão.',
    params: [], create: () => ({ type: 'SWAP_HAND_WITH_DECK' }) },
  { type: 'CHOOSE_ONE', label: 'Escolha 1', family: 'FLOW', continuous: false,
    help: 'Você escolhe uma das opções ao resolver.', aiHint: 'Avaliar a melhor opção.',
    params: [req('options', 'Opções', { kind: 'operations', min: 2, max: 4 })],
    create: () => ({ type: 'CHOOSE_ONE', options: [[{ type: 'DRAW_CARDS', player: 'OWN', count: 1 }], [{ type: 'HEAL_DAMAGE', target: { scope: 'OWN_ACTIVE' }, amount: 20 }]] }) },
  { type: 'FORCE_COIN', label: 'Próxima moeda cara', family: 'COINS', continuous: false,
    help: 'A primeira moeda da próxima jogada por efeito neste turno sai cara.', aiHint: 'Combina com ataques de moeda.',
    params: [], create: () => ({ type: 'FORCE_COIN' }) },
  { type: 'COPY_TRAINER', label: 'Copiar Apoiador do oponente', family: 'COPY', continuous: false,
    help: 'Usa o efeito de um Apoiador aleatório do baralho do oponente.', aiHint: 'Valor médio dos Apoiadores rivais.',
    params: [req('excludeKeys', 'Exceto (chaves)', { kind: 'idList' })], create: () => ({ type: 'COPY_TRAINER', excludeKeys: [] }) },
  { type: 'MOVE_ENERGY_FREELY', label: 'Mover Energias à vontade', family: 'ENERGY', continuous: false,
    help: 'Move quantas Energias quiser entre os seus Pokémon, uma a uma.', aiHint: 'Reposiciona custos.',
    params: [], create: () => ({ type: 'MOVE_ENERGY_FREELY' }) },
  { type: 'PREVENT_CONDITIONS', label: 'Imunidade a condições', family: 'PROTECTION', continuous: true,
    help: 'O alvo não pode ser afetado pelas condições (todas, se vazio) e se recupera delas.', aiHint: 'Neutraliza controle.',
    params: [req('target', 'Alvo', sel('SELF')), req('duration', 'Duração', DURATION), opt('conditions', 'Condições', { kind: 'multiEnum', min: 0, options: CONDITION_OPTIONS })],
    create: () => ({ type: 'PREVENT_CONDITIONS', target: { scope: 'SELF' }, duration: { kind: 'WHILE_SOURCE_IN_PLAY' } }) },
  { type: 'PREVENT_HEALING', label: 'Impedir cura', family: 'CONTROL', continuous: true,
    help: 'O alvo não pode ser curado.', aiHint: 'Anula cura rival.',
    params: [req('target', 'Alvo', sel('ALL_POKEMON')), req('duration', 'Duração', DURATION)],
    create: () => ({ type: 'PREVENT_HEALING', target: { scope: 'ALL_POKEMON' }, duration: { kind: 'WHILE_SOURCE_IN_PLAY' } }) },
  { type: 'ATTACK_COIN_GATE', label: 'Moeda antes de atacar', family: 'CONTROL', continuous: true,
    help: 'Quando o alvo for atacar, o dono joga uma moeda; coroa = o ataque não acontece. Não acumula.', aiHint: 'Metade dos ataques falha.',
    params: [req('target', 'Alvo', sel('DEFENDING')), req('duration', 'Duração', DURATION)],
    create: () => ({ type: 'ATTACK_COIN_GATE', target: { scope: 'DEFENDING' }, duration: { kind: 'NEXT_OPPONENT_TURN' } }) },
  { type: 'COUNTER_DAMAGE', label: 'Revide', family: 'PROTECTION', continuous: true,
    help: 'Se o alvo receber dano de ataque, causa dano ao Pokémon atacante.', aiHint: 'Pune ataques.',
    params: [req('target', 'Alvo', sel('SELF')), req('duration', 'Duração', DURATION), req('amount', 'Dano', int(10, 9990))],
    create: () => ({ type: 'COUNTER_DAMAGE', target: { scope: 'SELF' }, duration: { kind: 'NEXT_OPPONENT_TURN' }, amount: 30 }) },
  { type: 'GRANT_RULE', label: 'Regra concedida', family: 'EVOLUTION', continuous: true,
    help: 'Evoluir em qualquer turno, usar ataques das evoluções anteriores ou evoluir como outra carta.', aiHint: 'Flexibiliza a evolução.',
    params: [req('target', 'Alvo', sel('SELF')), req('duration', 'Duração', DURATION),
      req('rule', 'Regra', enumOf(o('EVOLVE_ANY_TURN', 'Evoluir em qualquer turno'), o('PREVIOUS_EVOLUTION_ATTACKS', 'Ataques das evoluções anteriores'), o('EVOLVES_AS', 'Evoluir como'))),
      opt('evolvesAs', 'Evolui como (chaves)', { kind: 'idList' })],
    create: () => ({ type: 'GRANT_RULE', target: { scope: 'SELF' }, duration: { kind: 'WHILE_SOURCE_IN_PLAY' }, rule: 'EVOLVE_ANY_TURN' }) },
  { type: 'SURVIVE_KNOCKOUT', label: 'Sobreviver ao Nocaute', family: 'PROTECTION', continuous: true,
    help: 'Dano de ataque que Nocautearia o alvo: moeda; cara = fica com N PS.', aiHint: 'Metade dos Nocautes falha.',
    params: [req('target', 'Alvo', sel('SELF')), req('duration', 'Duração', DURATION), req('remainingHp', 'PS que restam', int(10, 9990))],
    create: () => ({ type: 'SURVIVE_KNOCKOUT', target: { scope: 'SELF' }, duration: { kind: 'WHILE_SOURCE_IN_PLAY' }, remainingHp: 10 }) },
  { type: 'REROLL_COINS', label: 'Relançar moedas', family: 'COINS', continuous: true,
    help: 'Depois das moedas de um ataque de um Pokémon do alvo, o dono pode relançá-las (uma vez por turno).', aiHint: 'Melhora ataques de moeda.',
    params: [req('target', 'Alvo', sel('OWN_POKEMON')), req('duration', 'Duração', DURATION)],
    create: () => ({ type: 'REROLL_COINS', target: { scope: 'OWN_POKEMON' }, duration: { kind: 'WHILE_SOURCE_IN_PLAY' } }) },
];

const ENGINE = new Set<string>(OPCODES);
const BY_TYPE = new Map<string, OpcodeSpec>(SPECS.filter((s) => ENGINE.has(s.type)).map((s) => [s.type, { ...s, continuous: CONTINUOUS_OPCODES.has(s.type) }]));

/** Biblioteca publicável: exatamente os opcodes do registro do motor que têm formulário (FX-001, ED-027). */
export const OPCODE_LIBRARY: readonly OpcodeSpec[] = OPCODES.flatMap((t) => (BY_TYPE.has(t) ? [BY_TYPE.get(t)!] : []));

export function opcodeSpec(type: string): OpcodeSpec | null {
  return BY_TYPE.get(type) ?? null;
}

/** Opcode executável pelo motor desta build. */
export function isKnownOpcode(type: unknown): type is OpType {
  return typeof type === 'string' && ENGINE.has(type);
}

export function isContinuousOpcode(type: string): boolean {
  return CONTINUOUS_OPCODES.has(type);
}

/** Opcodes oferecidos para um momento: CONTINUOUS/REPLACEMENT só aceitam os marcados com C. */
export function opcodesForTiming(timing: Timing): OpcodeSpec[] {
  const continuousOnly = timing === 'CONTINUOUS' || timing === 'REPLACEMENT';
  return OPCODE_LIBRARY.filter((s) => !continuousOnly || s.continuous);
}

/** Opcodes por família (navegação do construtor; a lista é sempre a do registro). */
export function opcodesByFamily(timing: Timing): { family: Family; label: string; specs: OpcodeSpec[] }[] {
  const groups = new Map<Family, OpcodeSpec[]>();
  for (const spec of opcodesForTiming(timing)) groups.set(spec.family, [...(groups.get(spec.family) ?? []), spec]);
  return [...groups].map(([family, specs]) => ({ family, label: FAMILY_LABEL[family], specs }));
}

export const SCOPE_OPTIONS: readonly Option[] = [
  o('SELF', 'Este Pokémon (fonte)'), o('OWN_ACTIVE', 'Seu Ativo'), o('OPPONENT_ACTIVE', 'Ativo do oponente'), o('OWN_BENCH', 'Seu Banco'),
  o('OPPONENT_BENCH', 'Banco do oponente'), o('OWN_POKEMON', 'Seus Pokémon'), o('OPPONENT_POKEMON', 'Pokémon do oponente'),
  o('ALL_POKEMON', 'Todos os Pokémon'), o('EVENT_SOURCE', 'Origem do evento'), o('EVENT_TARGET', 'Alvo do evento'), o('OUTPUT', 'Saída nomeada anterior'),
  o('DEFENDING', 'Pokémon Defensor (só em ataques)'), o('TARGET', 'Alvo do dano em cálculo'),
];

export const TIMING_LABEL: Record<Timing, string> = {
  PRE_DAMAGE: 'Antes do dano', POST_DAMAGE: 'Depois do dano', ON_PLAY: 'Ao jogar', ON_ACTIVATE: 'Ao usar',
  ON_TRIGGER: 'Quando o gatilho ocorrer', CONTINUOUS: 'Contínuo', REPLACEMENT: 'Substituição',
};

export const DURATION_OPTIONS: readonly Option[] = [
  o('INSTANT', 'Instantâneo'), o('THIS_TURN', 'Até o fim deste turno'), o('NEXT_OPPONENT_TURN', 'Até o fim do próximo turno do oponente'),
  o('NEXT_OWN_TURN', 'Até o fim do seu próximo turno'), o('WHILE_SOURCE_IN_PLAY', 'Enquanto a fonte estiver em jogo'),
];
