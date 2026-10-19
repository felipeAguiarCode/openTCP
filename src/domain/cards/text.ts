// Texto de regras gerado a partir dos dados (efeitos-dsl.md §15). Determinístico: os mesmos dados
// produzem sempre o mesmo texto (FX-011). A descrição temática nunca cria regra.
import { raritySymbol, type RaritySymbol } from './rarity.ts';
import type {
  Ability, Attack, CardDefinition, CardFilter, CardPrinting, Condition, CostType, Duration, EffectBlock, Formula, Operation,
  PokemonFilter, PokemonType, Selector, SelectorScope, SpecialCondition, Trigger, Zone,
} from './types.ts';
import { isPokemon } from './types.ts';
import { BODY_CHARS_PER_LINE, PARAGRAPH_MAX_LINES, wrapLines } from './wrap.ts';

export const TYPE_LABEL: Record<PokemonType, string> = {
  GRASS: 'Planta', FIRE: 'Fogo', WATER: 'Água', LIGHTNING: 'Elétrico', PSYCHIC: 'Psíquico', FIGHTING: 'Lutador',
  DARKNESS: 'Noturno', METAL: 'Metálico', DRAGON: 'Dragão', COLORLESS: 'Incolor',
};
export const CONDITION_LABEL: Record<SpecialCondition, string> = {
  POISONED: 'Envenenado', BURNED: 'Queimado', ASLEEP: 'Adormecido', PARALYZED: 'Paralisado', CONFUSED: 'Confuso',
};
export const STAGE_LABEL = { BASIC: 'Básico', STAGE_1: 'Estágio 1', STAGE_2: 'Estágio 2' } as const;
export const SUBTYPE_LABEL = { ITEM: 'Item', SUPPORTER: 'Apoiador', TOOL: 'Ferramenta', STADIUM: 'Estádio' } as const;

// ---------------------------------------------------------------- contexto do texto

/** Resolve uma chave de limite (`deckLimitKey`) para o nome exibido da carta (null = desconhecida). */
/** Nome por `deckLimitKey`; `attack:<id>` e `ability:<id>` resolvem ataques e Habilidades de outras cartas. */
export type NameResolver = (deckLimitKey: string) => string | null;
/** `attackNames`/`abilityNames`: id → nome na própria carta (“este Pokémon não pode usar Big Beat”). */
export type TextOptions = {
  readonly nameOf?: NameResolver;
  readonly attackNames?: Readonly<Record<string, string>>;
  readonly abilityNames?: Readonly<Record<string, string>>;
  readonly tool?: boolean;
};

type NameSource = { readonly definitions: ReadonlyMap<string, CardDefinition> } | { readonly findByDeckLimitKey: (key: string) => readonly CardDefinition[] } | readonly CardDefinition[];
const resolverCache = new WeakMap<object, NameResolver>();
/** Resolvedor de nomes de um conjunto de definições (catálogo ou lista do editor), memorizado por fonte. */
export function catalogNames(source: NameSource): NameResolver {
  const cached = resolverCache.get(source);
  if (cached) return cached;
  if (!Array.isArray(source) && !('definitions' in source)) {
    // Só a consulta por chave (motor): nomes de cartas, sem índice de ataques.
    const lookup = source as { readonly findByDeckLimitKey: (key: string) => readonly CardDefinition[] };
    const byLookup: NameResolver = (key) => lookup.findByDeckLimitKey(key)[0]?.name ?? null;
    resolverCache.set(source, byLookup);
    return byLookup;
  }
  const defs = Array.isArray(source) ? source as readonly CardDefinition[] : [...(source as { readonly definitions: ReadonlyMap<string, CardDefinition> }).definitions.values()];
  const byKey = new Map<string, string>();
  for (const d of defs) {
    if (!byKey.has(d.deckLimitKey)) byKey.set(d.deckLimitKey, d.name);
    for (const a of d.attacks) if (!byKey.has(`attack:${a.id}`)) byKey.set(`attack:${a.id}`, a.name);
    for (const a of d.abilities) if (!byKey.has(`ability:${a.id}`)) byKey.set(`ability:${a.id}`, a.name);
  }
  const resolver: NameResolver = (key) => byKey.get(key) ?? null;
  resolverCache.set(source, resolver);
  return resolver;
}

type CoinInfo = { readonly count: number; readonly untilTails: boolean };
type OutputInfo = { readonly kind: 'POKEMON' | 'CARDS'; readonly single: boolean; readonly source: Operation['type'] };
type TextCtx = {
  readonly nameOf: NameResolver;
  /** Saídas nomeadas: o que guardam (Pokémon escolhidos ou cartas), se é um só Pokémon e a operação de origem. */
  readonly outputs: ReadonlyMap<string, OutputInfo>;
  readonly attackName: (id: string) => string;
  readonly abilityName: (id: string) => string;
  /** Texto de Ferramenta: SELF é “o Pokémon com esta carta”. */
  readonly tool: boolean;
  /** Lançamentos de moeda do mesmo dono (ataque, Habilidade, Treinador) por `outputId`. */
  readonly coins: ReadonlyMap<string, CoinInfo>;
  /** Contexto de ataque: “este ataque”, bônus de dano e Pokémon Defensor. */
  readonly attack: { readonly hasMainDamage: boolean; readonly mainOnActive: boolean } | null;
  readonly trigger: Trigger | null;
};

/** Nome de reserva quando não há catálogo: "mr-mime" → "Mr Mime". */
function fallbackName(key: string): string {
  return key.split('-').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function collectCoins(blocks: readonly EffectBlock[]): Map<string, CoinInfo> {
  const out = new Map<string, CoinInfo>();
  const visit = (op: Operation) => {
    if (op.type === 'FLIP_COINS') out.set(op.outputId, { count: op.untilTails || typeof op.count === 'object' ? 0 : op.count ?? 1, untilTails: !!op.untilTails });
    if (op.type === 'CONDITIONAL') { op.then.forEach(visit); (op.else ?? []).forEach(visit); }
    if (op.type === 'SCHEDULE_DELAYED') op.operations.forEach(visit);
  };
  for (const b of blocks) visit(b.operation);
  return out;
}

function textCtx(opts: TextOptions | undefined, blocks: readonly EffectBlock[], attack: TextCtx['attack'] = null, trigger: Trigger | null = null): TextCtx {
  const nameOf = opts?.nameOf ?? (() => null);
  const attackNames = opts?.attackNames ?? {};
  const abilityNames = opts?.abilityNames ?? {};
  const outputs = new Map<string, OutputInfo>();
  for (const b of blocks) {
    const op = b.operation as { outputId?: string; target?: Selector };
    if (op.outputId && b.operation.type !== 'FLIP_COINS') outputs.set(op.outputId, { kind: 'CARDS', single: false, source: b.operation.type });
    const pick = op.target?.pick;
    if (op.target?.outputId) outputs.set(op.target.outputId, { kind: 'POKEMON', single: !!pick && pick.mode !== 'ALL' && (pick.mode === 'RANDOM' ? pick.count : pick.max) === 1, source: b.operation.type });
  }
  return {
    nameOf: (key) => nameOf(key) ?? fallbackName(key),
    attackName: (id) => attackNames[id] ?? nameOf(`attack:${id}`) ?? fallbackName(id),
    abilityName: (id) => abilityNames[id] ?? nameOf(`ability:${id}`) ?? fallbackName(id),
    tool: !!opts?.tool, outputs, coins: collectCoins(blocks), attack, trigger,
  };
}

// ---------------------------------------------------------------- utilidades de língua

const lowerFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

function joinWith(items: readonly string[], conj: string): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} ${conj} ${items[items.length - 1]}`;
}
const joinOr = (items: readonly string[]) => joinWith(items, 'ou');

/** Sujeito no início de oração: “o seu Pokémon Ativo” → “seu Pokémon Ativo”. */
const subj = (text: string) => text.replace(/^(?:os?|as?) (seus?|suas?) /, '$1 ');

/** Contrações do português: "de este" → "deste", "a o" → "ao", "de o" → "do", "por o" → "pelo". */
const CONTRACTIONS: readonly [RegExp, string][] = [
  [/\bde este\b/g, 'deste'], [/\bde a Ultracriatura\b/g, 'da Ultracriatura'], [/\ba a Ultracriatura\b/g, 'à Ultracriatura'], [/\bde esse\b/g, 'desse'], [/\bem este\b/g, 'neste'], [/\bde os\b/g, 'dos'], [/\bde o\b/g, 'do'],
  [/\ba os\b/g, 'aos'], [/\ba o\b/g, 'ao'], [/\bem os\b/g, 'nos'], [/\bem o\b/g, 'no'], [/\bpor os\b/g, 'pelos'], [/\bpor o\b/g, 'pelo'],
];

export function contract(text: string): string {
  return CONTRACTIONS.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text);
}

/**
 * Formas curtas equivalentes, aplicadas em ordem só enquanto o parágrafo não cabe nas linhas do template.
 * A forma completa continua sendo a de referência; a curta só aparece em cartas que estourariam a caixa.
 */
const COMPACT: readonly (readonly [RegExp, string])[] = [
  [/feitos a este Pokémon/, 'neste Pokémon'],
  [/ da sua Zona de Energia/g, ' da Zona de Energia'],
  [/, se este Pokémon estiver no (Ativo|Banco),/, ', com este Pokémon no $1,'],
  [/^Se um Pokémon do oponente for Nocauteado por dano de um ataque deste Pokémon,/, 'Se este Pokémon Nocautear um Pokémon do oponente com um ataque,'],
  [/ e (ele|este Pokémon) recebe (\d+) de dano a menos de ataques/, ' e $1 recebe −$2 de dano de ataques'],
  [/de um dos seus (Pokémon do tipo \S+) no Banco/, 'de um $1 do seu Banco'],
  [/para o seu Pokémon Ativo/, 'para o seu Ativo'],
  [/(este Pokémon\b.*) deste Pokémon /, '$1 dele '],
  [/evolua este Pokémon/, 'evolua-o'],
  [/(a este Pokémon\b.*) a este Pokémon\./, '$1 a ele.'],
  [/das suas Energias descartadas/, 'do seu descarte'],
  [/ele não é Nocauteado e fica com (\d+) PS restantes/, 'ele fica com $1 PS restantes em vez disso'],
  [/durante o próximo turno do oponente, previna todo dano e efeito de ataques neste Pokémon/, 'este Pokémon não é afetado por ataques no próximo turno do oponente'],
];

/** Texto de um parágrafo de ataque/Habilidade: a forma completa, ou a compactada até caber. */
function fitParagraph(text: string): string {
  let out = text;
  for (const [pattern, replacement] of COMPACT) {
    if (wrapLines(out, BODY_CHARS_PER_LINE) <= PARAGRAPH_MAX_LINES) break;
    out = out.replace(pattern, replacement);
  }
  return out;
}

const sentence = (text: string) => (text ? contract(text.charAt(0).toUpperCase() + text.slice(1) + (text.endsWith('.') ? '' : '.')) : '');

// ---------------------------------------------------------------- seletores

const SINGLE_SCOPES = new Set<SelectorScope>(['SELF', 'OWN_ACTIVE', 'OPPONENT_ACTIVE', 'EVENT_SOURCE', 'EVENT_TARGET', 'DEFENDING', 'TARGET']);
type Num = 'ONE' | 'EACH' | 'ALL';
type Phrase = { readonly text: string; readonly plural: boolean };

/** Escopo efetivo: Pokémon de um lado filtrados por uma única posição equivalem ao Ativo/Banco desse lado. */
function normScope(s: Selector): SelectorScope {
  const pos = s.filter?.positions;
  if (pos?.length === 1) {
    if (s.scope === 'OWN_POKEMON') return pos[0] === 'ACTIVE' ? 'OWN_ACTIVE' : 'OWN_BENCH';
    if (s.scope === 'OPPONENT_POKEMON') return pos[0] === 'ACTIVE' ? 'OPPONENT_ACTIVE' : 'OPPONENT_BENCH';
  }
  return s.scope;
}

const opponentScope = (s: Selector) => s.scope.startsWith('OPPONENT') || s.scope === 'DEFENDING';
const benchOnly = (s: Selector) => { const n = normScope(s); return n === 'OWN_BENCH' || n === 'OPPONENT_BENCH'; };

function names(keys: readonly string[], tc: TextCtx): string {
  return joinOr(keys.map((k) => tc.nameOf(k) ?? fallbackName(k)));
}

/** “ex” para EX (ou EX + MEGA_EX), “Mega ex” só para MEGA_EX; nada para NONE ou mistura com NONE. */
function exWord(ruleBoxes: readonly string[] | undefined): string {
  if (!ruleBoxes?.length || ruleBoxes.includes('NONE')) return '';
  return ruleBoxes.includes('EX') ? ' ex' : ' Mega ex';
}

/** “Pokémon Básico do tipo Planta”, “Pokémon ex”, ou os nomes do filtro (“Muk ou Weezing”). */
function pokemonNoun(f: PokemonFilter | undefined, pl: boolean, tc: TextCtx): string {
  if (f?.deckLimitKeys?.length) return names(f.deckLimitKeys, tc);
  if (f?.tags?.includes('ULTRA_BEAST')) return `${pl ? 'Ultracriaturas' : 'Ultracriatura'}${f.types?.length ? ` do tipo ${joinOr(f.types.map((t) => TYPE_LABEL[t]))}` : ''}`;
  let n = 'Pokémon';
  n += exWord(f?.ruleBoxes);
  if (f?.stages?.length) n += ` ${joinOr(f.stages.map((st) => (st === 'BASIC' ? (pl ? 'Básicos' : 'Básico') : `de ${STAGE_LABEL[st]}`)))}`;
  if (f?.types?.length) n += ` do tipo ${joinOr(f.types.map((t) => TYPE_LABEL[t]))}`;
  if (f?.tags?.includes('TEAM_ROCKET')) n += ' da Equipe Rocket';
  if (f?.evolvesFrom?.length) n += ` que ${pl ? 'evoluem' : 'evolui'} de ${names(f.evolvesFrom, tc)}`;
  return n;
}

function qualifiers(f: PokemonFilter | undefined, pl: boolean, tc?: TextCtx): string {
  if (!f) return '';
  const out: string[] = [];
  if (f.hasDamage === true) out.push('com dano'); else if (f.hasDamage === false) out.push('sem dano');
  if (f.hasCondition === true) out.push(pl ? 'afetados por Condição Especial' : 'afetado por Condição Especial');
  else if (f.hasCondition === false) out.push('sem Condição Especial');
  else if (typeof f.hasCondition === 'string') out.push(`${CONDITION_LABEL[f.hasCondition]}${pl ? 's' : ''}`);
  if (f.hasTool === true) out.push('com Ferramenta'); else if (f.hasTool === false) out.push('sem Ferramenta');
  if (f.hasEnergy === true) out.push('com Energia ligada'); else if (f.hasEnergy === false) out.push('sem Energia ligada');
  if (f.energyTypes?.length) out.push(`com Energia ${joinOr(f.energyTypes.map((t) => `de ${TYPE_LABEL[t]}`))} ligada`);
  if (f.hasAbility === true && f.excludeAbilityIds?.length) out.push(`com uma Habilidade diferente de ${f.excludeAbilityIds.map(tc?.abilityName ?? fallbackName).join(' e ')}`);
  else if (f.hasAbility === true) out.push('com Habilidade'); else if (f.hasAbility === false) out.push('sem Habilidade');
  if (f.attackIds?.length) out.push(`com o ataque ${f.attackIds.map(tc?.attackName ?? fallbackName).join(' ou ')}`);
  if (f.ruleBoxes?.length === 1 && f.ruleBoxes[0] === 'NONE') out.push(pl ? 'que não sejam Pokémon ex' : 'que não seja Pokémon ex');
  if (f.enteredPlayThisTurn === false) out.push(pl ? 'que não entraram em jogo neste turno' : 'que não entrou em jogo neste turno');
  return out.length ? ` ${out.join(' e ')}` : '';
}

function scopePhrase(scope: SelectorScope, f: PokemonFilter | undefined, num: Num, tc: TextCtx): Phrase {
  const keys = f?.deckLimitKeys?.length ? names(f.deckLimitKeys, tc) : null;
  const nounS = pokemonNoun(f, false, tc);
  const nounP = pokemonNoun(f, true, tc);
  const restS = nounS.replace(/^Pokémon/, '');
  const q1 = qualifiers(f, false, tc);
  const qp = qualifiers(f, true, tc);
  const others = f?.excludeSelf ? ' outros' : '';
  // Oração relativa (“que não sejam Pokémon ex”) vai depois do lugar: “um dos seus Pokémon no Banco que não sejam …”.
  // Ultracriatura é feminino: “uma das suas Ultracriaturas”, “as suas Ultracriaturas”.
  const fem = !keys && !!f?.tags?.includes('ULTRA_BEAST');
  const gender = (text: string) => (fem ? text.replace(/\bcada um dos seus\b/, 'cada uma das suas').replace(/\bum dos seus\b/, 'uma das suas').replace(/\bos seus\b/, 'as suas')
    .replace(/\bum dos\b/, 'uma das').replace(/\bos (outros )?Ultra/, 'as $1Ultra').replace(/\boutros Ultra/, 'outras Ultra') : text);
  const place = (text: string) => gender(text.replace(/(?<! e) (que .+?) (no Banco(?: do oponente)?)$/, ' $2 $1'));
  const one = (text: string): Phrase => ({ text: place(text), plural: false });
  switch (scope) {
    case 'SELF': return one(tc.tool ? (f?.tags?.includes('ULTRA_BEAST') ? 'a Ultracriatura com esta carta' : `o Pokémon${f?.types?.length ? ` do tipo ${joinOr(f.types.map((t) => TYPE_LABEL[t]))}` : ''} com esta carta`) : 'este Pokémon');
    case 'TARGET': return one('esse Pokémon');
    case 'DEFENDING': return one('o Pokémon Defensor');
    case 'EVENT_SOURCE': return one((tc.trigger?.event === 'DAMAGE_APPLIED' && tc.trigger.filter?.damageCategory === 'ATTACK') || tc.trigger?.event === 'POKEMON_KNOCKED_OUT'
      ? 'o Pokémon atacante' : 'o Pokémon que causou o efeito');
    case 'EVENT_TARGET': return one('esse Pokémon');
    case 'OUTPUT': return num === 'ONE' ? one('o Pokémon escolhido') : { text: 'os Pokémon escolhidos', plural: true };
    case 'OWN_ACTIVE': return one(keys ? `o seu ${keys} no Ativo${q1}` : `o seu Pokémon Ativo${restS}${q1}`);
    case 'OPPONENT_ACTIVE': return one(keys ? `o ${keys} Ativo do oponente${q1}` : `o Pokémon Ativo do oponente${restS}${q1}`);
    case 'OWN_BENCH':
      if (num === 'ONE') return one(`um dos seus${others} ${nounP}${qp} no Banco`);
      if (num === 'EACH') return one(`cada um dos seus${others} ${nounP}${qp} no Banco`);
      return { text: place(`os seus${others} ${nounP}${qp} no Banco`), plural: true };
    case 'OPPONENT_BENCH':
      if (num === 'ONE') return one(`um dos ${nounP}${qp} no Banco do oponente`);
      if (num === 'EACH') return one(`cada ${nounS}${q1} no Banco do oponente`);
      return { text: place(`os ${nounP}${qp} no Banco do oponente`), plural: true };
    case 'OWN_POKEMON':
      if (num === 'ONE') return one(`um dos seus${others} ${nounP}${qp}`);
      if (num === 'EACH') return one(`cada um dos seus${others} ${nounP}${qp}`);
      return { text: place(`os seus${others} ${nounP}${qp}`), plural: true };
    case 'OPPONENT_POKEMON':
      if (num === 'ONE') return one(`um dos ${nounP} do oponente${qp}`);
      if (num === 'EACH') return one(`cada ${nounS} do oponente${q1}`);
      return { text: `os ${nounP} do oponente${qp}`, plural: true };
    case 'ALL_POKEMON':
      if (f?.positions?.length === 1 && f.positions[0] === 'ACTIVE') return num === 'EACH' ? one('cada um dos Pokémon Ativos') : { text: 'ambos os Pokémon Ativos', plural: true };
      if (num === 'ONE') return one(`um dos${others} ${nounP}${qp} em jogo (seus ou do oponente)`);
      if (num === 'EACH') return one(`cada ${nounS}${q1} em jogo`);
      return { text: `todos os ${nounP}${qp} em jogo`, plural: true };
    default: return one('o alvo');
  }
}

/**
 * Frase do seletor. `num` vale quando o seletor alcança vários Pokémon sem escolha (pick ALL ou omitido):
 * 'EACH' (“cada um dos seus Pokémon”) para efeitos aplicados um a um; 'ALL' (“os seus Pokémon”) para
 * modificadores coletivos; 'ONE' quando o opcode usa só um alvo.
 */
function selectorPhrase(s: Selector, tc: TextCtx, num: Num = 'EACH'): Phrase {
  if (s.scope === 'OUTPUT' && s.ref && tc.outputs.get(s.ref)?.single) return { text: 'esse Pokémon', plural: false };
  const scope = normScope(s);
  if (SINGLE_SCOPES.has(scope)) return scopePhrase(scope, s.filter, 'ONE', tc);
  const pick = s.pick;
  if (pick?.mode === 'CHOOSE') {
    let text = scopePhrase(scope, s.filter, 'ONE', tc).text;
    const many = pick.max > 1;
    if (many) text = text.replace(/^um dos /, pick.min === pick.max ? `${pick.max} dos ` : `até ${pick.max} dos `);
    if (pick.chooser === 'OPPONENT') text += many ? ', escolhidos pelo oponente' : ', escolhido pelo oponente';
    return { text, plural: many };
  }
  if (pick?.mode === 'RANDOM') {
    const text = scopePhrase(scope, s.filter, 'ONE', tc).text.replace(/^um dos /, `${pick.count} dos `);
    return { text: `${text}, ${pick.count > 1 ? 'escolhidos' : 'escolhido'} aleatoriamente`, plural: pick.count > 1 };
  }
  return scopePhrase(scope, s.filter, num, tc);
}

/** Substantivo contável para “para cada …” / “se houver …”: “Pokémon do tipo Elétrico no seu Banco”. */
function countNoun(s: Selector, tc: TextCtx): string {
  const scope = normScope(s);
  const nounS = pokemonNoun(s.filter, false, tc);
  const q = qualifiers(s.filter, false, tc);
  switch (scope) {
    case 'OWN_BENCH': return `${nounS}${q} no seu Banco`;
    case 'OPPONENT_BENCH': return `${nounS}${q} no Banco do oponente`;
    case 'OWN_POKEMON': return `um dos seus ${pokemonNoun(s.filter, true, tc)}${qualifiers(s.filter, true, tc)}`;
    case 'OPPONENT_POKEMON': return `${nounS}${q} do oponente`;
    case 'ALL_POKEMON': return `${nounS}${q} em jogo`;
    default: return selectorPhrase(s, tc, 'ONE').text;
  }
}

// ---------------------------------------------------------------- cartas (filtros de zona)

type Noun = { readonly s: string; readonly p: string; readonly fem: boolean };

function cardNoun(f: CardFilter | undefined, tc: TextCtx, basicDefault = false): Noun {
  if (f?.deckLimitKeys?.length) { const n = names(f.deckLimitKeys, tc); return { s: n, p: n, fem: false }; }
  const cats = f?.categories ?? [];
  const pokemon = basicDefault || (cats.includes('POKEMON') && !cats.includes('TRAINER')) || !!f?.stages?.length || !!f?.types?.length;
  if (pokemon) {
    let s = 'Pokémon';
    let p = 'Pokémon';
    if (f?.ruleBoxes?.length === 1 && f.ruleBoxes[0] !== 'NONE') { const rb = f.ruleBoxes[0] === 'EX' ? ' ex' : ' Mega ex'; s += rb; p += rb; }
    const stages = f?.stages ?? (basicDefault ? (['BASIC'] as const) : []);
    if (stages.length) {
      s += ` ${joinOr(stages.map((st) => (st === 'BASIC' ? 'Básico' : `de ${STAGE_LABEL[st]}`)))}`;
      p += ` ${joinOr(stages.map((st) => (st === 'BASIC' ? 'Básicos' : `de ${STAGE_LABEL[st]}`)))}`;
    }
    if (f?.types?.length) { const t = ` do tipo ${joinOr(f.types.map((x) => TYPE_LABEL[x]))}`; s += t; p += t; }
    if (f?.tags?.includes('TEAM_ROCKET')) { s += ' da Equipe Rocket'; p += ' da Equipe Rocket'; }
    if (f?.evolvesFrom?.length) { const from = names(f.evolvesFrom, tc); s += ` que evolui de ${from}`; p += ` que evoluem de ${from}`; }
    return { s, p, fem: false };
  }
  const subs = f?.subtypes ?? [];
  if (subs.length === 1) return { s: `carta de ${SUBTYPE_LABEL[subs[0]!]}`, p: `cartas de ${SUBTYPE_LABEL[subs[0]!]}`, fem: true };
  if (subs.length > 1 || (cats.includes('TRAINER') && !cats.includes('POKEMON'))) return { s: 'carta de Treinador', p: 'cartas de Treinador', fem: true };
  return { s: 'carta', p: 'cartas', fem: true };
}

const counted = (n: number, noun: Noun) => `${n} ${n === 1 ? noun.s : noun.p}`;
const randomAdj = (n: number, noun: Noun) => ` ${noun.fem ? 'aleatória' : 'aleatório'}${n === 1 ? '' : 's'}`;

const ZONE_PHRASE: Record<Zone, string> = {
  OWN_HAND: 'na sua mão', OPPONENT_HAND: 'na mão do oponente', OWN_DECK: 'no seu baralho', OPPONENT_DECK: 'no baralho do oponente',
  OWN_DISCARD: 'no seu descarte', OPPONENT_DISCARD: 'no descarte do oponente',
};

// ---------------------------------------------------------------- fórmulas

const COUNT_OPS = new Set<Formula['op']>(['COUNT_HEADS', 'COUNT_TAILS', 'COUNT_ATTACHED_ENERGIES', 'COUNT_PROVIDED_ENERGY_UNITS', 'COUNT_BENCH_POKEMON', 'COUNT_POKEMON', 'COUNT_CARDS', 'EXTRA_ENERGY_UNITS', 'OUTPUT_COUNT', 'ATTACKS_USED', 'TOP_CARDS_MATCHING', 'RETREAT_COST', 'POINTS']);

/** “k × contagem” (ou a própria contagem, k = 1). */
function scaled(f: Formula): { k: number; unit: Formula } | null {
  if (COUNT_OPS.has(f.op)) return { k: 1, unit: f };
  if (f.op !== 'MULTIPLY' || (f.operands ?? []).length !== 2) return null;
  const k = f.operands!.find((o) => o.op === 'CONST');
  const unit = f.operands!.find((o) => o.op !== 'CONST');
  return k && unit && COUNT_OPS.has(unit.op) ? { k: k.value ?? 0, unit } : null;
}

/** Item contado por uma fórmula de contagem (“cara”, “Energia ligada ao Pokémon Ativo do oponente”). */
function perUnit(f: Formula, tc: TextCtx): string {
  const type = f.energyType ? ` de ${TYPE_LABEL[f.energyType]}` : '';
  const sel = f.selector ?? { scope: 'SELF' as const };
  switch (f.op) {
    case 'COUNT_HEADS': return 'cara';
    case 'COUNT_TAILS': return 'coroa';
    case 'COUNT_ATTACHED_ENERGIES': return `Energia${type} ligada a ${selectorPhrase(sel, tc, 'ALL').text}`;
    case 'COUNT_PROVIDED_ENERGY_UNITS': return `unidade de Energia${type} fornecida a ${selectorPhrase(sel, tc, 'ALL').text}`;
    case 'EXTRA_ENERGY_UNITS': return `Energia${type} extra ligada a ${selectorPhrase(sel, tc, 'ALL').text}`;
    case 'COUNT_BENCH_POKEMON': return f.side === 'OPPONENT' ? 'Pokémon no Banco do oponente' : f.side === 'BOTH' ? 'Pokémon em ambos os Bancos' : 'Pokémon no seu Banco';
    case 'COUNT_POKEMON': return f.selector ? countNoun(f.selector, tc) : 'Pokémon';
    case 'COUNT_CARDS': return `${cardNoun(f.filter, tc).s} ${f.zone ? ZONE_PHRASE[f.zone] : ''}`.trim();
    case 'OUTPUT_COUNT': {
      const out = tc.outputs.get(f.reference ?? '');
      if (out?.kind === 'POKEMON') return 'Pokémon descartado';
      return out?.source === 'SHUFFLE_HAND_INTO_DECK' ? 'carta embaralhada dessa forma' : 'carta descartada dessa forma';
    }
    case 'ATTACKS_USED': return `vez que seus Pokémon usaram ${tc.attackName(f.attackId ?? '')}${f.window === 'LAST_OWN_TURN' ? ' no seu último turno' : ' nesta partida'}`;
    case 'TOP_CARDS_MATCHING': return `${cardNoun(f.filter, tc).s} entre as ${f.count ?? 1} cartas do topo do seu baralho`;
    case 'RETREAT_COST': return `Energia no custo de Recuo de ${selectorPhrase(sel, tc, 'ONE').text}`;
    case 'POINTS': return f.side === 'OPPONENT' ? 'ponto do oponente' : 'ponto que você tem';
    default: return formulaTextIn(f, tc);
  }
}

function formulaTextIn(f: Formula, tc: TextCtx): string {
  const sel = (s: Selector | undefined) => (s ? selectorPhrase(s, tc, 'ALL').text : 'este Pokémon');
  const type = f.energyType ? ` de ${TYPE_LABEL[f.energyType]}` : '';
  switch (f.op) {
    case 'CONST': return String(f.value ?? 0);
    case 'ADD': return (f.operands ?? []).map((o) => formulaTextIn(o, tc)).join(' + ');
    case 'SUBTRACT': return (f.operands ?? []).map((o) => formulaTextIn(o, tc)).join(' − ');
    case 'MULTIPLY': return (f.operands ?? []).map((o) => formulaTextIn(o, tc)).join(' × ');
    case 'MIN': return `o menor entre ${(f.operands ?? []).map((o) => formulaTextIn(o, tc)).join(' e ')}`;
    case 'MAX': return `o maior entre ${(f.operands ?? []).map((o) => formulaTextIn(o, tc)).join(' e ')}`;
    case 'CLAMP': return formulaTextIn((f.operands ?? [])[0] ?? { op: 'CONST', value: 0 }, tc);
    case 'COUNT_HEADS': return 'o número de caras';
    case 'COUNT_TAILS': return 'o número de coroas';
    case 'COUNT_ATTACHED_ENERGIES': return `o número de Energias${type} ligadas a ${sel(f.selector)}`;
    case 'COUNT_PROVIDED_ENERGY_UNITS': return `as unidades de Energia${type} fornecidas a ${sel(f.selector)}`;
    case 'EXTRA_ENERGY_UNITS': return `o número de Energias${type} extras ligadas a ${sel(f.selector)}`;
    case 'COUNT_BENCH_POKEMON': return f.side === 'OPPONENT' ? 'o número de Pokémon no Banco do oponente' : f.side === 'BOTH' ? 'o número de Pokémon em ambos os Bancos' : 'o número de Pokémon no seu Banco';
    case 'COUNT_POKEMON': return `o número de ${f.selector ? selectorPhrase(f.selector, tc, 'ALL').text : 'Pokémon'}`;
    case 'COUNT_CARDS': return `o número de ${cardNoun(f.filter, tc).p}${f.zone ? ` ${ZONE_PHRASE[f.zone]}` : ''}`;
    case 'DAMAGE_ON_SOURCE': return 'o dano neste Pokémon';
    case 'DAMAGE_ON_TARGET': return 'o dano no alvo';
    case 'DAMAGE_DEALT_BY_ATTACK': return 'o dano causado por este ataque';
    case 'POINTS': return f.side === 'OPPONENT' ? 'os pontos do oponente' : 'seus pontos';
    case 'OUTPUT_COUNT': return 'a quantidade escolhida';
    case 'REMAINING_HP': return `os PS restantes de ${sel(f.selector)}`;
    case 'DISTINCT_ENERGY_TYPES': return `o número de tipos de Energia ligados a ${sel(f.selector)}`;
    case 'RETREAT_COST': return `o custo de Recuo de ${sel(f.selector)}`;
    case 'OWN_TURN_NUMBER': return f.side === 'OPPONENT' ? 'o número do turno do oponente' : 'o número do seu turno';
    case 'ATTACKS_USED': return `o número de vezes que seus Pokémon usaram ${tc.attackName(f.attackId ?? '')}`;
    case 'TOP_CARDS_MATCHING': return `o número de ${cardNoun(f.filter, tc).p} entre as ${f.count ?? 1} cartas do topo do seu baralho`;
    default: return '?';
  }
}

export function formulaText(f: Formula, opts?: TextOptions): string {
  return formulaTextIn(f, textCtx(opts, []));
}

function amountText(a: number | Formula, tc: TextCtx): string {
  return typeof a === 'number' ? String(a) : formulaTextIn(a, tc);
}

/** “30 de dano” / “30 de dano a mais” com o sufixo “para cada …” separado (vai depois do alvo). */
function damageParts(a: number | Formula, tc: TextCtx, more: boolean): { lead: string; tail: string } {
  const extra = more ? ' a mais' : '';
  if (typeof a === 'number') return { lead: `${a} de dano${extra}`, tail: '' };
  const sc = scaled(a);
  if (sc) return { lead: `${sc.k} de dano${extra}`, tail: ` para cada ${perUnit(sc.unit, tc)}` };
  if (a.op === 'DAMAGE_DEALT_BY_ATTACK') return { lead: 'dano igual ao causado por este ataque', tail: '' };
  return { lead: `dano igual a ${formulaTextIn(a, tc)}`, tail: '' };
}

// ---------------------------------------------------------------- condições

function coinCondition(c: Condition, tc: TextCtx): string | null {
  if (c.op !== 'COMPARE' || !c.left || !c.right || c.right.op !== 'CONST') return null;
  if (c.left.op !== 'COUNT_HEADS' && c.left.op !== 'COUNT_TAILS') return null;
  const k = c.right.value ?? 0;
  const info = tc.coins.get(c.left.reference ?? '');
  const n = info && !info.untilTails ? info.count : null;
  const face = c.left.op === 'COUNT_HEADS' ? 'cara' : 'coroa';
  const otherFace = face === 'cara' ? 'coroa' : 'cara';
  const cmp = c.cmp ?? 'EQ';
  const none = (cmp === 'EQ' && k === 0) || (cmp === 'LT' && k === 1) || (cmp === 'LE' && k === 0);
  const atLeast = cmp === 'GE' ? k : cmp === 'GT' ? k + 1 : cmp === 'EQ' && n !== null && k === n ? k : null;
  if (n === 1) {
    if (atLeast === 1 || (cmp === 'EQ' && k === 1)) return `Se sair ${face}`;
    if (none) return `Se sair ${otherFace}`;
  }
  if (n !== null && n >= 2) {
    if (atLeast === n) return n === 2 ? `Se as duas saírem ${face}` : `Se todas as ${n} saírem ${face}`;
    if (none) return n === 2 ? `Se as duas saírem ${otherFace}` : `Se todas as ${n} saírem ${otherFace}`;
  }
  if (atLeast !== null && atLeast >= 1) return `Se ${atLeast > 1 ? 'saírem' : 'sair'} pelo menos ${atLeast} ${face}${atLeast > 1 ? 's' : ''}`;
  if (none) return `Se não sair nenhuma ${face}`;
  return null;
}

/** Predicado de um Pokémon a partir de um filtro (“tiver dano”, “estiver Envenenado”). */
function filterPredicate(f: PokemonFilter | undefined, tc: TextCtx): string | null {
  if (!f) return null;
  const out: string[] = [];
  if (f.hasDamage === true) out.push('tiver dano'); else if (f.hasDamage === false) out.push('não tiver dano');
  if (f.hasCondition === true) out.push('estiver afetado por uma Condição Especial');
  else if (f.hasCondition === false) out.push('não estiver afetado por Condição Especial');
  else if (typeof f.hasCondition === 'string') out.push(`estiver ${CONDITION_LABEL[f.hasCondition]}`);
  if (f.hasTool === true) out.push('tiver uma Ferramenta'); else if (f.hasTool === false) out.push('não tiver Ferramenta');
  if (f.hasEnergy === true) out.push('tiver Energia ligada'); else if (f.hasEnergy === false) out.push('não tiver Energia ligada');
  if (f.deckLimitKeys?.length) out.push(`for ${names(f.deckLimitKeys, tc)}`);
  if (f.types?.length) out.push(`for do tipo ${joinOr(f.types.map((t) => TYPE_LABEL[t]))}`);
  if (f.stages?.length) out.push(`for ${joinOr(f.stages.map((st) => (st === 'BASIC' ? 'Básico' : `de ${STAGE_LABEL[st]}`)))}`);
  if (exWord(f.ruleBoxes)) out.push(`for um Pokémon${exWord(f.ruleBoxes)}`);
  if (f.tags?.includes('TEAM_ROCKET')) out.push('tiver “Equipe Rocket” no nome');
  if (f.tags?.includes('ULTRA_BEAST')) out.push('for uma Ultracriatura');
  if (f.hasAbility === true) out.push('tiver uma Habilidade');
  if (f.energyTypes?.length) out.push(`tiver Energia ${joinOr(f.energyTypes.map((t) => `de ${TYPE_LABEL[t]}`))} ligada`);
  if (f.evolvedThisTurn === true) out.push('tiver evoluído neste turno');
  if (f.movedToActiveThisTurn === true) out.push('tiver ido do Banco para o Ativo neste turno');
  if (f.damagedByAttackLastOpponentTurn === true) out.push('tiver recebido dano de um ataque no Ativo durante o último turno do oponente');
  return out.length ? out.join(' e ') : null;
}

function existsText(s: Selector, tc: TextCtx): string {
  const scope = normScope(s);
  if (SINGLE_SCOPES.has(scope)) {
    const base = scopePhrase(scope, undefined, 'ONE', tc).text;
    const pred = filterPredicate(s.filter, tc);
    return pred ? `Se ${subj(base)} ${pred}` : `Se ${subj(base)} estiver em jogo`;
  }
  const noun = `${pokemonNoun(s.filter, false, tc)}${qualifiers(s.filter, false, tc)}`;
  if (scope === 'OWN_POKEMON' && s.filter?.excludeSelf) return `Se você tiver outro ${noun} em jogo`;
  switch (scope) {
    case 'OWN_BENCH': return `Se houver ${noun} no seu Banco`;
    case 'OPPONENT_BENCH': return `Se houver ${noun} no Banco do oponente`;
    case 'OWN_POKEMON': return `Se você tiver ${noun} em jogo`;
    case 'OPPONENT_POKEMON': return `Se o oponente tiver ${noun} em jogo`;
    default: return `Se houver ${noun} em jogo`;
  }
}

const CMP_WORDS = { EQ: 'for igual a', NE: 'for diferente de', GT: 'for maior que', GE: 'for pelo menos', LT: 'for menor que', LE: 'for no máximo' } as const;

function compareText(c: Condition, tc: TextCtx): string {
  const coin = coinCondition(c, tc);
  if (coin) return coin;
  const left = c.left!;
  const right = c.right!;
  const cmp = c.cmp ?? 'EQ';
  const k = right.op === 'CONST' ? right.value ?? 0 : null;
  const atLeast = k === null ? null : cmp === 'GE' ? k : cmp === 'GT' ? k + 1 : null;
  const noneish = k !== null && ((cmp === 'EQ' && k === 0) || (cmp === 'LE' && k === 0) || (cmp === 'LT' && k === 1));
  if (left.op === 'DAMAGE_ON_SOURCE' || left.op === 'DAMAGE_ON_TARGET') {
    const who = left.op === 'DAMAGE_ON_SOURCE' ? 'este Pokémon' : tc.attack ? 'o Pokémon Ativo do oponente' : 'o alvo';
    if (atLeast !== null && atLeast <= 10) return `Se ${who} tiver dano`;
    if (noneish) return `Se ${who} não tiver dano`;
    if (atLeast !== null) return `Se ${who} tiver pelo menos ${atLeast} de dano`;
  }
  if ((left.op === 'EXTRA_ENERGY_UNITS' || left.op === 'COUNT_ATTACHED_ENERGIES' || left.op === 'COUNT_PROVIDED_ENERGY_UNITS') && atLeast !== null && atLeast >= 1) {
    const who = subj(selectorPhrase(left.selector ?? { scope: 'SELF' }, tc, 'ONE').text);
    const type = left.energyType ? ` de ${TYPE_LABEL[left.energyType]}` : '';
    if (left.op === 'COUNT_ATTACHED_ENERGIES' && atLeast === 1 && left.energyType) return `Se ${who} tiver Energia${type} ligada`;
    const many = atLeast > 1;
    const extra = left.op === 'EXTRA_ENERGY_UNITS' ? (many ? ' extras' : ' extra') : '';
    return `Se ${who} tiver pelo menos ${atLeast} Energia${many ? 's' : ''}${type}${extra} ligada${many ? 's' : ''}`;
  }
  if (left.op === 'COUNT_BENCH_POKEMON' && atLeast !== null && atLeast >= 1) {
    return `Se houver pelo menos ${atLeast} Pokémon ${left.side === 'OPPONENT' ? 'no Banco do oponente' : left.side === 'BOTH' ? 'nos Bancos' : 'no seu Banco'}`;
  }
  if (left.op === 'REMAINING_HP' && right.op === 'REMAINING_HP' && (cmp === 'GT' || cmp === 'LT')) {
    const a = subj(selectorPhrase(left.selector ?? { scope: 'SELF' }, tc, 'ONE').text);
    const b = selectorPhrase(right.selector ?? { scope: 'SELF' }, tc, 'ONE').text;
    return `Se ${a} tiver ${cmp === 'GT' ? 'mais' : 'menos'} PS restantes que ${b}`;
  }
  if (left.op === 'REMAINING_HP' && k !== null && (cmp === 'LE' || cmp === 'EQ') && k === 0) {
    return `Se ${subj(selectorPhrase(left.selector ?? { scope: 'SELF' }, tc, 'ONE').text)} for Nocauteado pelo dano deste ataque`;
  }
  if (left.op === 'DISTINCT_ENERGY_TYPES' && atLeast !== null) {
    return `Se ${subj(selectorPhrase(left.selector ?? { scope: 'SELF' }, tc, 'ONE').text)} tiver ${atLeast} ou mais tipos diferentes de Energia ligados`;
  }
  if (left.op === 'COUNT_ATTACHED_ENERGIES' && right.op === 'COUNT_ATTACHED_ENERGIES' && cmp === 'GT') {
    return `Se ${subj(selectorPhrase(left.selector ?? { scope: 'SELF' }, tc, 'ONE').text)} tiver mais Energias ligadas que ${selectorPhrase(right.selector ?? { scope: 'SELF' }, tc, 'ONE').text}`;
  }
  if (left.op === 'ATTACKS_USED' && atLeast === 1) {
    return `Se um dos seus Pokémon tiver usado ${tc.attackName(left.attackId ?? '')}${left.window === 'LAST_OWN_TURN' ? ' no seu último turno' : ' nesta partida'}`;
  }
  if (left.op === 'OWN_TURN_NUMBER' && k !== null) {
    if (cmp === 'EQ' && k === 1) return 'Se este for o seu primeiro turno';
    if (cmp === 'GT' && k === 1) return 'Se este não for o seu primeiro turno';
  }
  if (left.op === 'POINTS' && k !== null && right.op === 'CONST') {
    const who = left.side === 'OPPONENT' ? 'o oponente' : 'você';
    if (cmp === 'EQ' && k === 0) return `Se ${who} ainda não tiver pontos`;
    if (atLeast !== null) return `Se ${who} tiver pelo menos ${atLeast} ponto${atLeast > 1 ? 's' : ''}`;
  }
  if (left.op === 'POINTS' && right.op === 'POINTS' && left.side !== right.side) {
    const mine = left.side !== 'OPPONENT';
    const less = (cmp === 'LT' || cmp === 'LE') === mine;
    if (cmp === 'EQ') return 'Se você e o oponente tiverem os mesmos pontos';
    return `Se você tiver ${less ? 'menos' : 'mais'} pontos que o oponente`;
  }
  return `Se ${formulaTextIn(left, tc)} ${CMP_WORDS[cmp]} ${formulaTextIn(right, tc)}`;
}

function negate(text: string): string {
  const m = /^Se (.*?)\b(tiver|estiver|houver|sair|saírem|for|forem)\b(.*)$/.exec(text);
  if (m && !/\bnão $/.test(m[1]!)) return `Se ${m[1]}não ${m[2]}${m[3]}`;
  return `Se não for verdade que ${lowerFirst(text.replace(/^Se /, ''))}`;
}

function conditionTextIn(c: Condition, tc: TextCtx): string {
  switch (c.op) {
    case 'COMPARE': return c.left && c.right ? compareText(c, tc) : 'Se';
    case 'HAS_CONDITION': {
      const who = c.selector ? subj(selectorPhrase(c.selector, tc, 'ONE').text) : 'o alvo';
      return `Se ${who} estiver ${typeof c.condition === 'string' && c.condition !== 'ANY' ? CONDITION_LABEL[c.condition as SpecialCondition] : 'afetado por uma Condição Especial'}`;
    }
    case 'SOURCE_POSITION': {
      const who = tc.tool ? 'o Pokémon com esta carta' : 'este Pokémon';
      return c.position === 'ACTIVE' ? `Se ${who} estiver no Ativo` : `Se ${who} estiver no Banco`;
    }
    case 'EXISTS': return c.selector ? existsText(c.selector, tc) : 'Se houver um alvo';
    case 'CARDS_EXIST': {
      const noun = cardNoun(c.filter, tc);
      const n = c.count ?? 1;
      const where = c.zone ? ` ${ZONE_PHRASE[c.zone]}` : '';
      return n === 1 ? `Se houver ${noun.fem ? 'alguma' : 'algum'} ${noun.s}${where}` : `Se houver pelo menos ${n} ${noun.p}${where}`;
    }
    case 'IS_TURN_OF': return c.side === 'OPPONENT' ? 'Durante o turno do oponente' : 'Durante o seu turno';
    case 'STADIUM_IN_PLAY': return 'Se houver um Estádio em jogo';
    case 'SUPPORTER_PLAYED_THIS_TURN': return 'Se você tiver jogado uma carta de Apoiador da mão neste turno';
    case 'KNOCKED_OUT_LAST_OPPONENT_TURN': {
      const noun = c.filter?.types?.length ? `Pokémon do tipo ${joinOr(c.filter.types.map((t) => TYPE_LABEL[t]))}` : 'Pokémon';
      return `Se algum dos seus ${noun} tiver sido Nocauteado por dano de ataque no último turno do oponente`;
    }
    case 'OUTPUT_CARDS_MATCH': {
      const noun = cardNoun(c.filter, tc);
      return `Se essa carta for ${noun.fem ? 'uma' : 'um'} ${noun.s}`;
    }
    case 'NOT': return typeof c.condition === 'object' && c.condition ? negate(conditionTextIn(c.condition, tc)) : 'Se não';
    case 'ALL':
    case 'ANY': {
      const parts = (c.conditions ?? []).map((x, i) => (i === 0 ? conditionTextIn(x, tc) : conditionTextIn(x, tc).replace(/^Se /, '')));
      return parts.join(c.op === 'ALL' ? ' e ' : ' ou ');
    }
    default: return 'Se';
  }
}

export function conditionText(c: Condition, opts?: TextOptions): string {
  return conditionTextIn(c, textCtx(opts, []));
}

// ---------------------------------------------------------------- operações

function durationPrefix(d: Duration): string {
  switch (d.kind) {
    case 'THIS_TURN': return 'durante este turno, ';
    case 'NEXT_OPPONENT_TURN': return 'durante o próximo turno do oponente, ';
    case 'NEXT_OWN_TURN': return 'durante o seu próximo turno, ';
    default: return '';
  }
}

/** Duração de uma restrição de jogador, do ponto de vista de quem é restringido. */
function playerDuration(d: Duration, opponent: boolean): string {
  switch (d.kind) {
    case 'THIS_TURN': return ' durante este turno';
    case 'NEXT_OPPONENT_TURN': return opponent ? ' durante o próximo turno dele' : ' durante o próximo turno do oponente';
    case 'NEXT_OWN_TURN': return ' durante o seu próximo turno';
    default: return '';
  }
}

const PLAYER_ACTION_LABEL: Record<string, string> = {
  PLAY_ITEM: 'jogar cartas de Item da mão', PLAY_SUPPORTER: 'jogar cartas de Apoiador da mão', MANUAL_ENERGY: 'ligar Energia da Zona de Energia',
};
const ACTION_LABEL: Record<string, string> = {
  ATTACK: 'atacar', RETREAT: 'recuar', PLAY_ITEM: 'jogar Itens', PLAY_SUPPORTER: 'jogar Apoiadores', USE_ABILITY: 'usar Habilidades', MANUAL_ENERGY: 'ligar Energia da Zona',
  EVOLVE: 'evoluir', RECEIVE_ZONE_ENERGY: 'receber Energia da Zona',
};

/** Dano extra no alvo do dano principal dentro de um ataque (“este ataque causa N de dano a mais”). */
function isDamageBonus(op: Operation, tc: TextCtx): boolean {
  if (!tc.attack?.mainOnActive) return false;
  if (op.type === 'DEAL_DAMAGE') {
    const scope = normScope(op.target);
    return (scope === 'OPPONENT_ACTIVE' || scope === 'DEFENDING') && op.category !== 'EFFECT' && !op.target.filter && !op.target.pick;
  }
  if (op.type === 'MODIFY') return op.stat === 'DAMAGE_DEALT' && op.target.scope === 'SELF' && typeof op.amount === 'number' && op.amount > 0 && op.duration.kind === 'THIS_TURN' && !op.appliesTo?.attackIds;
  if (op.type === 'CONDITIONAL') return op.then.length === 1 && !(op.else ?? []).length && isDamageBonus(op.then[0]!, tc);
  return false;
}

function bonusText(op: Operation, tc: TextCtx): string {
  if (op.type === 'MODIFY') return `Este ataque causa ${typeof op.amount === 'number' ? op.amount : 0} de dano a mais`;
  if (op.type === 'DEAL_DAMAGE') {
    const d = damageParts(op.amount, tc, true);
    return `Este ataque causa ${d.lead}${d.tail}`;
  }
  return '';
}

/** “1 Energia de Fogo, 1 de Água e 1 de Elétrico”. */
const oneOfEach = (types: readonly PokemonType[]) => joinWith(types.map((t, i) => `1${i === 0 ? ' Energia' : ''} de ${TYPE_LABEL[t]}`), 'e');

function energyNoun(op: Extract<Operation, { type: 'ATTACH_ENERGY' }>, n: number): string {
  if (op.energyType === 'ZONE_RANDOM' && op.source !== 'DISCARDED_ENERGY') return `${n} Energia${n === 1 ? '' : 's'} de um tipo aleatório entre os da sua Zona de Energia`;
  const origin = op.source === 'DISCARDED_ENERGY' ? ' das suas Energias descartadas' : ' da sua Zona de Energia';
  if (op.energyTypes?.length) return `${oneOfEach(op.energyTypes)}${origin}`;
  const random = op.energyType === 'RANDOM' || op.energyType === 'ZONE_RANDOM';
  const type = op.energyType === 'READY' || random ? '' : ` de ${TYPE_LABEL[op.energyType as PokemonType]}`;
  const rnd = random ? (op.source === 'DISCARDED_ENERGY' ? (n === 1 ? ' aleatória' : ' aleatórias') : ' de tipo aleatório') : '';
  const head = op.energyType === 'READY' || op.source === 'ENERGY_ZONE_READY' ? `${n === 1 ? 'a Energia pronta' : `${n} Energias prontas`}` : `${n} Energia${n === 1 ? '' : 's'}`;
  return `${head}${type}${rnd}${origin}`;
}

function operationTextIn(op: Operation, tc: TextCtx): string {
  switch (op.type) {
    case 'FLIP_COINS': {
      if (op.untilTails) return 'Jogue uma moeda até sair coroa';
      if (typeof op.count === 'object') {
        const sc = scaled(op.count);
        return sc ? `Jogue uma moeda para cada ${perUnit(sc.unit, tc)}` : `Jogue moedas em quantidade igual a ${formulaTextIn(op.count, tc)}`;
      }
      return (op.count ?? 1) === 1 ? 'Jogue uma moeda' : `Jogue ${op.count} moedas`;
    }
    case 'DEAL_DAMAGE': {
      if (isDamageBonus(op, tc)) return bonusText(op, tc);
      const scope = normScope(op.target);
      const d = damageParts(op.amount, tc, false);
      if (tc.attack && scope === 'SELF') return `Este Pokémon também causa ${d.lead} a si mesmo${d.tail}`;
      const t = selectorPhrase(op.target, tc, 'EACH').text;
      const note = !op.applyWeakness && benchOnly(op.target) ? ' (sem Fraqueza)' : '';
      if (tc.attack) return `Este ataque ${tc.attack.hasMainDamage ? 'também ' : ''}causa ${d.lead} a ${t}${d.tail}${note}`;
      return `Cause ${d.lead} a ${t}${d.tail}${note}`;
    }
    case 'HEAL_DAMAGE': {
      const t = selectorPhrase(op.target, tc, 'EACH').text;
      if (op.amount === 'ALL') return `Cure todo o dano de ${t}`;
      if (typeof op.amount === 'object' && op.amount.op === 'DAMAGE_DEALT_BY_ATTACK') return `Cure de ${t} a mesma quantidade de dano que este ataque causou`;
      const sc = typeof op.amount === 'object' ? scaled(op.amount) : null;
      if (sc) return `Cure ${sc.k} de dano de ${t} para cada ${perUnit(sc.unit, tc)}`;
      return `Cure ${amountText(op.amount, tc)} de dano de ${t}`;
    }
    case 'APPLY_CONDITION': {
      const p = selectorPhrase(op.target, tc, 'EACH');
      if (op.condition === 'RANDOM') return `${subj(p.text)} ${p.plural ? 'ficam' : 'fica'} com uma Condição Especial aleatória que ainda não ${p.plural ? 'tenham' : 'tenha'}`;
      const base = `${subj(p.text)} ${p.plural ? 'ficam' : 'fica'} ${CONDITION_LABEL[op.condition]}${p.plural ? 's' : ''}`;
      return op.poisonDamage && op.condition === 'POISONED' ? `${base}, recebendo ${op.poisonDamage} de dano (em vez de 10) por estar Envenenado` : base;
    }
    case 'REMOVE_CONDITION': {
      if (tc.tool && op.target.scope === 'SELF' && op.conditions === 'ALL') return 'Ele se recupera de todas as Condições Especiais';
      const what = op.conditions === 'ALL' ? 'todas as Condições Especiais' : op.conditions === 'RANDOM_ONE' ? 'uma Condição Especial aleatória'
        : op.conditions.length > 1 ? `as condições ${joinWith(op.conditions.map((c) => CONDITION_LABEL[c]), 'e')}` : `a condição ${CONDITION_LABEL[op.conditions[0]!]}`;
      return `Remova ${what} de ${selectorPhrase(op.target, tc, 'EACH').text}`;
    }
    case 'DRAW_CARDS': {
      const who = op.player === 'OWN' ? 'Compre' : 'O oponente compra';
      if (typeof op.count === 'number') return `${who} ${op.count} carta${op.count === 1 ? '' : 's'}`;
      if (op.player === 'OWN' && handGap(op.count)) return 'Compre cartas até ficar com o mesmo número de cartas na mão que o oponente';
      const [k, points] = op.count.op === 'SUBTRACT' ? op.count.operands ?? [] : [];
      if (k?.op === 'CONST' && points?.op === 'POINTS') return `${who} 1 carta para cada ponto que ainda falta para ${op.player === 'OWN' ? 'você' : 'ele'} vencer`;
      const sc = scaled(op.count);
      if (sc) return `${who} ${sc.k} carta${sc.k === 1 ? '' : 's'} para cada ${perUnit(sc.unit, tc)}`;
      return `${who} cartas em quantidade igual a ${formulaTextIn(op.count, tc)}`;
    }
    case 'SEARCH_DECK': {
      const noun = cardNoun(op.filter, tc, op.destination === 'BENCH');
      const dest = op.destination === 'BENCH' ? 'no seu Banco' : 'na sua mão';
      const pronoun = `${noun.fem ? 'a' : 'o'}${op.count === 1 ? '' : 's'}`;
      if (op.mode === 'RANDOM') {
        const c = counted(op.count, noun);
        const rnd = randomAdj(op.count, noun);
        return `Coloque ${c.includes(' que ') ? c.replace(' que ', `${rnd} que `) : `${c}${rnd}`} do seu baralho ${dest}${op.reveal ? `, revelando-${pronoun}` : ''}`;
      }
      return `Procure no seu baralho e coloque ${counted(op.count, noun)} ${dest}${op.reveal ? `, revelando-${pronoun}` : ''}${op.shuffleAfter === false ? '' : '. Embaralhe seu baralho'}`;
    }
    case 'ATTACH_ENERGY': {
      if (op.energyTypes?.length) {
        return op.distribute
          ? `Distribua ${energyNoun(op, op.energyTypes.length)} como quiser entre ${selectorPhrase(op.target, tc, 'ALL').text}`
          : `Ligue ${energyNoun(op, op.energyTypes.length)} a ${selectorPhrase(op.target, tc, 'ONE').text}`;
      }
      if (op.perTarget && typeof op.count === 'number') {
        const target = selectorPhrase(op.target, tc, 'ONE').text.replace(/^(\d+) dos /, '$1 dos ');
        return `Ligue ${energyNoun(op, op.count)} a cada um de ${target}`;
      }
      if (typeof op.count === 'number') {
        if (op.distribute && op.count > 1) return `Distribua ${energyNoun(op, op.count)} como quiser entre ${selectorPhrase(op.target, tc, 'ALL').text}`;
        return `Ligue ${energyNoun(op, op.count)} a ${selectorPhrase(op.target, tc, 'ONE').text}`;
      }
      const sc = scaled(op.count);
      const target = selectorPhrase(op.target, tc, 'ONE').text;
      if (sc) {
        const per = perUnit(sc.unit, tc);
        if (op.distribute) return `Para cada ${per}, ligue ${energyNoun(op, sc.k)} a ${target}`;
        return `Ligue ${energyNoun(op, sc.k)} a ${target} para cada ${per}`;
      }
      return `Ligue a ${target} Energias${op.energyType === 'READY' || op.energyType === 'RANDOM' || op.energyType === 'ZONE_RANDOM' ? '' : ` de ${TYPE_LABEL[op.energyType]}`} em quantidade igual a ${formulaTextIn(op.count, tc)}`;
    }
    case 'MOVE_ENERGY': {
      const type = op.energyTypes?.length ? ` ${joinOr(op.energyTypes.map((t) => `de ${TYPE_LABEL[t]}`))}` : op.energyType && op.energyType !== 'ANY' ? ` de ${TYPE_LABEL[op.energyType]}` : '';
      // O filtro “com Energia de X ligada” repete o tipo que já está no texto: some da origem.
      const sameTypes = !!op.energyTypes?.length && stable(op.from.filter?.energyTypes ?? null) === stable(op.energyTypes);
      const from = selectorPhrase(sameTypes ? { ...op.from, filter: { ...op.from.filter, energyTypes: undefined } } : op.from, tc, 'ALL').text;
      const to = selectorPhrase(op.to, tc, 'ONE').text;
      const what = op.count === 'ALL' ? `todas as Energias${type}` : `${op.count} Energia${op.count === 1 ? '' : 's'}${type}`;
      if (op.perTarget) return `Mova ${what} de ${from}, 1 para cada um de ${to}`;
      return `Mova ${what} de ${from} para ${to}`;
    }
    case 'DISCARD_ENERGY': {
      const t = selectorPhrase(op.target, tc, 'EACH').text;
      if (op.energyTypes?.length) return `Descarte ${oneOfEach(op.energyTypes)} de ${t}`;
      const type = op.energyType && op.energyType !== 'ANY' ? ` de ${TYPE_LABEL[op.energyType]}` : '';
      if (op.count === 'ALL') return `Descarte todas as Energias${type} de ${t}`;
      const n = typeof op.count === 'number' ? op.count : 2;
      const random = op.chooser === 'RANDOM' ? ` ${n === 1 ? 'aleatória' : 'aleatórias'}` : '';
      const who = op.chooser === 'OPPONENT' ? '. O oponente escolhe' : '';
      if (op.combined) return `Descarte ${n} Energia${n === 1 ? '' : 's'}${random} entre as ligadas a ${selectorPhrase(op.target, tc, 'ALL').text}`;
      if (typeof op.count === 'object') {
        const sc = scaled(op.count);
        return `Para cada ${sc ? perUnit(sc.unit, tc) : formulaTextIn(op.count, tc)}, descarte 1 Energia${type}${op.chooser === 'RANDOM' ? ' aleatória' : ''} de ${t}`;
      }
      return `Descarte ${op.count} Energia${op.count === 1 ? '' : 's'}${type}${random} de ${t}${who}`;
    }
    case 'SWITCH_ACTIVE': {
      if (op.incoming === 'SELF') return 'Troque este Pokémon pelo seu Pokémon Ativo';
      if (op.side === 'OWN') {
        const fem = !!op.filter?.tags?.includes('ULTRA_BEAST');
        const bench = fem ? 'uma Ultracriatura do seu Banco' : op.filter ? `um dos seus ${pokemonNoun(op.filter, true, tc)}${qualifiers(op.filter, true, tc)} no Banco` : 'um dos seus Pokémon no Banco';
        return `Troque seu Pokémon Ativo por ${bench}${op.chooser === 'OPPONENT' ? '. O oponente escolhe' : op.chooser === 'RANDOM' ? ', escolhido aleatoriamente' : ''}`;
      }
      const bench = op.filter ? `um ${pokemonNoun(op.filter, false, tc)}${qualifiers(op.filter, false, tc)} do Banco dele` : 'um do Banco dele';
      return `Troque o Pokémon Ativo do oponente por ${bench}${op.chooser === 'OPPONENT' ? '. O oponente escolhe' : op.chooser === 'RANDOM' ? ', escolhido aleatoriamente' : ''}`;
    }
    case 'EVOLVE':
      if (op.from === 'DECK') return `Evolua ${selectorPhrase(op.target, tc, 'ONE').text} com uma carta aleatória do seu baralho que evolua dele`;
      return `Evolua ${selectorPhrase(op.target, tc, 'ONE').text} com uma carta da sua mão${op.skipStage ? ', pulando o Estágio 1' : ''}${op.ignoreTurnRestrictions ? ', mesmo neste turno' : ''}`;
    case 'MODIFY': {
      if (tc.attack && isDamageBonus(op, tc)) return bonusText(op, tc);
      const untilLeaves = op.duration.kind === 'WHILE_SOURCE_IN_PLAY' && op.duration.removeOn?.includes('TARGET_LEAVES_ACTIVE') && tc.attack;
      const pre = untilLeaves ? 'até este Pokémon sair do Ativo, ' : durationPrefix(op.duration);
      const formula = typeof op.amount === 'object' ? op.amount : null;
      const amount = typeof op.amount === 'number' ? op.amount : 1;
      const sign = amount >= 0 ? '+' : '−';
      const value = Math.abs(amount);
      const per = formula ? (() => { const sc = scaled(formula); return sc ? { k: sc.k, tail: ` para cada ${perUnit(sc.unit, tc)}` } : null; })() : null;
      const shown = per ? `+${per.k}` : `${sign}${value}`;
      const tail = per?.tail ?? '';
      const p = selectorPhrase(op.target, tc, 'ALL');
      const t = p.plural && (op.target.filter?.deckLimitKeys?.length ?? 0) > 1 && (op.stat === 'DAMAGE_TAKEN' || op.stat === 'MAX_HP') ? p.text.replace(/ ou (?!.* ou )/, ' e ') : p.text;
      const attackFilter = op.appliesTo?.attackerFilter ? ` de ${pokemonNoun(op.appliesTo.attackerFilter, true, tc)}` : '';
      switch (op.stat) {
        case 'MAX_HP': return `${pre}${subj(t)} ${p.plural ? 'recebem' : 'recebe'} ${shown} PS${tail}`;
        case 'RETREAT_COST':
          if (amount <= -10) return `${pre}${subj(t)} não ${p.plural ? 'têm' : 'tem'} custo de Recuo`;
          return `${pre}o custo de Recuo de ${t} ${amount < 0 ? 'diminui' : 'aumenta'} em ${value}`;
        case 'ATTACK_COST': {
          const type = op.energyType ? `de ${TYPE_LABEL[op.energyType]}` : `Incolor${value === 1 ? '' : 'es'}`;
          return `${pre}os ataques de ${t} custam ${value} Energia${value === 1 ? '' : 's'} ${type} ${amount < 0 ? 'a menos' : 'a mais'}`;
        }
        case 'DAMAGE_DEALT': {
          const vsEx = op.appliesTo?.targetFilter ? ` ao Pokémon${exWord(op.appliesTo.targetFilter.ruleBoxes)} Ativo do oponente` : '';
          const vs = vsEx || ((op.appliesTo?.opponentActiveOnly ?? true) && amount > 0 && !opponentScope(op.target) ? ' ao Pokémon Ativo do oponente' : '');
          if (op.appliesTo?.attackIds?.length) return `${pre}o ataque ${op.appliesTo.attackIds.map(tc.attackName).join(' ou ')} de ${t} causa ${shown} de dano${tail}${untilLeaves && !op.exclusive ? '. Este efeito acumula' : ''}`;
          return `${pre}os ataques de ${t} causam ${shown} de dano${vs}${tail}`;
        }
        case 'DAMAGE_TAKEN': {
          const cat = op.appliesTo?.damageCategory ?? 'ATTACK';
          return `${pre}${subj(t)} ${p.plural ? 'recebem' : 'recebe'} ${value} de dano ${amount < 0 ? 'a menos' : 'a mais'} de ${cat === 'EFFECT' ? 'efeitos' : cat === 'ANY' ? 'ataques e efeitos' : `ataques${attackFilter}`}`;
        }
        case 'ENERGY_PROVISION': return `${pre}cada Energia ${op.energyType ? `de ${TYPE_LABEL[op.energyType]}` : 'de qualquer tipo'} ligada a ${t} fornece ${value + 1} Energias${op.energyType ? ` de ${TYPE_LABEL[op.energyType]}` : ''}${op.exclusive ? '. Este efeito não acumula' : ''}`;
        case 'KNOCKOUT_POINTS': return `${pre}nocautear ${t} concede ${sign}${value} ponto${value === 1 ? '' : 's'}`;
        case 'POISON_DAMAGE': return `${pre}${subj(t)} ${p.plural ? 'recebem' : 'recebe'} ${value} de dano a mais por estar Envenenado`;
        default: return '';
      }
    }
    case 'PREVENT_DAMAGE': {
      const cats = op.categories.includes('ATTACK') && op.categories.includes('EFFECT') ? 'ataques e efeitos' : op.categories.includes('ATTACK') ? 'ataques' : op.categories.includes('EFFECT') ? 'efeitos' : 'Condições Especiais';
      const from = op.attackerFilter ? ` de ${pokemonNoun(op.attackerFilter, true, tc)} do oponente` : '';
      if (op.coinFlip) {
        const t = selectorPhrase(op.target, tc, 'EACH').text;
        return `Sempre que ${t} receber dano de ${cats}, jogue uma moeda. Se sair cara, ${op.amount === 'ALL' ? 'previna esse dano' : `${t} recebe ${op.amount} de dano a menos desse ataque`}`;
      }
      if (from) return `${durationPrefix(op.duration)}previna todo o dano causado a ${selectorPhrase(op.target, tc, 'EACH').text} por ${cats}${from}`;
      return `${durationPrefix(op.duration)}previna ${op.amount === 'ALL' ? 'todo o dano' : `${op.amount} de dano`} causado a ${selectorPhrase(op.target, tc, 'EACH').text} por ${cats}${op.charges ? ` (${op.charges} ${op.charges === 1 ? 'vez' : 'vezes'})` : ''}`;
    }
    case 'PREVENT_EFFECTS':
      return `${durationPrefix(op.duration)}previna todos os efeitos de ataques do oponente feitos a ${selectorPhrase(op.target, tc, 'EACH').text}`;
    case 'RESTRICT_ACTION': {
      if (op.actions.every((a) => PLAYER_ACTION_LABEL[a])) {
        const opponent = opponentScope(op.target);
        return `${opponent ? 'o oponente' : 'você'} não pode ${op.actions.map((a) => PLAYER_ACTION_LABEL[a]).join(' nem ')}${playerDuration(op.duration, opponent)}`;
      }
      const p = selectorPhrase(op.target, tc, 'ALL');
      if (op.actions.length === 1 && op.actions[0] === 'ATTACK' && op.attackIds?.length) {
        return `${durationPrefix(op.duration)}${subj(p.text)} não ${p.plural ? 'podem' : 'pode'} usar ${op.attackIds.map(tc.attackName).join(' nem ')}`;
      }
      if (op.actions.length === 1 && op.actions[0] === 'EVOLVE') {
        return `${durationPrefix(op.duration)}o oponente não pode jogar Pokémon da mão para evoluir ${p.text}`;
      }
      if (op.actions.length === 1 && op.actions[0] === 'RECEIVE_ZONE_ENERGY') {
        return `${durationPrefix(op.duration)}o oponente não pode pegar Energia da Zona de Energia para ligar a ${p.text.replace(/ do oponente$/, ' dele')}`;
      }
      return `${durationPrefix(op.duration)}${subj(p.text)} não ${p.plural ? 'podem' : 'pode'} ${op.actions.map((a) => ACTION_LABEL[a]).join(' nem ')}`;
    }
    case 'SUPPRESS_ABILITIES': {
      const p = selectorPhrase(op.target, tc, 'ALL');
      return `${durationPrefix(op.duration)}${subj(p.text)} não ${p.plural ? 'têm' : 'tem'} Habilidades`;
    }
    case 'DISCARD_CARDS': {
      const own = op.zone.startsWith('OWN');
      const noun = cardNoun(op.filter, tc);
      const n = typeof op.count === 'number' ? op.count : null;
      const what = n !== null ? counted(n, noun) : `${noun.p} em quantidade igual a ${formulaTextIn(op.count as Formula, tc)}`;
      if (op.zone.endsWith('HAND')) {
        if (op.upTo && own && n !== null) return `Descarte até ${n} ${n === 1 ? noun.s : noun.p} da sua mão`;
        if (op.chooser === 'RANDOM') return `Descarte ${what}${n !== null ? randomAdj(n, noun) : ''} da ${own ? 'sua mão' : 'mão do oponente'}`;
        if (!own && op.chooser === 'OPPONENT') return `O oponente descarta ${what} da mão`;
        if (!own) return `Olhe a mão do oponente e descarte ${what} dela`;
        return `Descarte ${what} da sua mão`;
      }
      return `Descarte ${what} do topo do ${own ? 'seu baralho' : 'baralho do oponente'}`;
    }
    case 'RETURN_TO_HAND': {
      const t = selectorPhrase(op.target, tc, 'EACH').text;
      return opponentScope(op.target)
        ? `Devolva ${t} e todas as cartas ligadas a ele para a mão do oponente`
        : `Coloque na sua mão ${t.replace(/^o seu (.+) no Ativo$/, 'o seu $1 Ativo')} e todas as cartas ligadas a ele`;
    }
    case 'SHUFFLE_INTO_DECK': {
      const scope = normScope(op.target);
      if (scope === 'OPPONENT_ACTIVE' || scope === 'DEFENDING') return `O oponente embaralha ${scope === 'DEFENDING' ? 'o Pokémon Defensor' : 'o Pokémon Ativo dele'} e as cartas ligadas a ele no baralho`;
      return `Embaralhe ${selectorPhrase(op.target, tc, 'EACH').text} e todas as cartas ligadas a ele no baralho do dono`;
    }
    case 'DISCARD_POKEMON': {
      const pick = op.target.pick;
      if (pick?.mode === 'CHOOSE' && pick.min === 0) {
        return `Você pode descartar até ${pick.max} ${scopePhrase(normScope(op.target), op.target.filter, 'ONE', tc).text.replace(/^um dos /, 'dos ')}`;
      }
      return `Descarte ${selectorPhrase(op.target, tc, 'EACH').text} e todas as cartas ligadas a ele`;
    }
    case 'KNOCK_OUT': {
      const p = selectorPhrase(op.target, tc, 'EACH');
      return `${subj(p.text)} ${p.plural ? 'são Nocauteados' : 'é Nocauteado'}`;
    }
    case 'PUT_ON_BENCH': {
      const own = op.side === 'OWN';
      const noun = cardNoun(op.filter, tc, true);
      const from = op.from === 'HAND' ? (own ? 'da sua mão' : 'da mão do oponente') : op.from === 'DECK' ? (own ? 'do seu baralho' : 'do baralho do oponente') : own ? 'do seu descarte' : 'do descarte do oponente';
      return `Coloque ${counted(op.count, noun)}${op.mode === 'RANDOM' ? randomAdj(op.count, noun) : ''} ${from} ${own ? 'no seu Banco' : 'no Banco do oponente'}`;
    }
    case 'RECOVER_FROM_DISCARD': {
      const noun = cardNoun(op.filter, tc);
      const dest = op.destination === 'HAND' ? 'na sua mão' : 'no seu baralho e embaralhe-o';
      if (typeof op.count === 'object') {
        const sc = scaled(op.count);
        return `Para cada ${sc ? perUnit(sc.unit, tc) : formulaTextIn(op.count, tc)}, coloque 1 ${noun.s}${op.mode === 'RANDOM' ? randomAdj(1, noun) : ''} do seu descarte ${dest}`;
      }
      return `Coloque ${counted(op.count, noun)}${op.mode === 'RANDOM' ? randomAdj(op.count, noun) : ''} do seu descarte ${dest}`;
    }
    case 'LOOK_AT_TOP': {
      const deck = op.player === 'OWN' ? 'seu baralho' : op.player === 'CHOOSE' ? 'baralho de um jogador à sua escolha' : 'baralho do oponente';
      if (typeof op.count === 'object') {
        const sc = scaled(op.count);
        return `Para cada ${sc ? perUnit(sc.unit, tc) : formulaTextIn(op.count, tc)}, olhe 1 carta do topo do ${deck}${op.reorder ? '; coloque-as de volta em qualquer ordem' : ''}`;
      }
      return `${op.count === 1 ? `Olhe a carta do topo do ${deck}` : `Olhe as ${op.count} cartas do topo do ${deck}`}${op.reorder && op.count > 1 ? ' e coloque-as de volta em qualquer ordem' : ''}`;
    }
    case 'SHUFFLE_DECK': return op.player === 'OWN' ? 'Embaralhe seu baralho' : 'Embaralhe o baralho do oponente';
    case 'REVEAL_HAND': return op.player === 'OWN' ? 'Revele sua mão' : 'O oponente revela a mão';
    case 'SHUFFLE_HAND_INTO_DECK': return op.player === 'OWN' ? 'Embaralhe sua mão no seu baralho' : 'O oponente embaralha a mão no baralho dele';
    case 'SCHEDULE_DELAYED': {
      const when = op.at === 'END_OF_OPPONENT_NEXT_TURN' ? 'no fim do próximo turno do oponente' : op.at === 'START_OF_OWN_NEXT_TURN' ? 'no início do seu próximo turno' : 'no fim deste turno';
      const removal = op.removeOn?.includes('TARGET_LEAVES_ACTIVE') ? ', se ele ainda estiver como Ativo' : '';
      const inner: TextCtx = { ...tc, attack: null };
      const body = op.operations.map((o) => lowerFirst(operationTextIn(o, inner))).join('; ');
      if (op.bindTo === 'SPOT') return `Escolha um espaço entre o Ativo e o Banco do oponente; ${when}, ${body.replace(/esse Pokémon/g, 'o Pokémon nesse espaço')}`;
      const scope = normScope(op.target);
      if (scope === 'DEFENDING' || scope === 'OPPONENT_ACTIVE') return `${when.charAt(0).toUpperCase()}${when.slice(1)}${removal}, ${body.replace(/esse Pokémon/g, scope === 'DEFENDING' ? 'o Pokémon Defensor' : 'o Pokémon Ativo do oponente')}`;
      return `${when.charAt(0).toUpperCase()}${when.slice(1)}${removal}: ${body}`;
    }
    case 'COPY_ATTACK': {
      const from = selectorPhrase(op.from, tc, 'ALL').text;
      return `Escolha um ataque de ${from} e use-o como este ataque${op.requireEnergy ? '. Sem a Energia necessária, este ataque não faz nada' : ''}`;
    }
    case 'MOVE_DAMAGE': {
      const amount = op.amount === 'ALL' ? 'todo o dano' : `${op.amount} de dano`;
      return `Mova ${amount} de ${selectorPhrase(op.from, tc, 'ONE').text} para ${selectorPhrase(op.to, tc, 'ONE').text}`;
    }
    case 'SET_REMAINING_HP': {
      const t = subj(selectorPhrase(op.target, tc, 'ONE').text);
      return op.mode === 'HALF_DOWN' ? `Os PS restantes de ${lowerFirst(t)} caem pela metade, arredondando para baixo` : `${t} fica com ${op.value} PS restantes`;
    }
    case 'DEVOLVE': return `Se ${subj(selectorPhrase(op.target, tc, 'ONE').text)} for um Pokémon evoluído, involua-o: a carta de Evolução de cima volta para a mão do dono`;
    case 'RETURN_CARDS_TO_DECK': {
      const noun = cardNoun(op.filter, tc);
      if (op.chooser === 'CONTROLLER') {
        const one = typeof op.count === 'number' && op.count === 1;
        return `Escolha ${one ? `${noun.fem ? 'uma' : 'um'} ${noun.s}` : noun.p} da mão do oponente e embaralhe-${noun.fem ? 'a' : 'o'}${one ? '' : 's'} no baralho dele`;
      }
      if (typeof op.count === 'object') {
        const sc = scaled(op.count);
        return `Para cada ${sc ? perUnit(sc.unit, tc) : formulaTextIn(op.count, tc)}, uma carta aleatória da mão do oponente é revelada e embaralhada no baralho dele`;
      }
      return op.count === 1 ? 'O oponente revela uma carta aleatória da mão e a embaralha no baralho' : `O oponente revela ${op.count} cartas aleatórias da mão e as embaralha no baralho`;
    }
    case 'CHANGE_ENERGY_TYPE': return `O tipo de uma Energia aleatória ligada a ${selectorPhrase(op.target, tc, 'ONE').text} muda para um tipo aleatório`;
    case 'SET_NEXT_ENERGY': return `O tipo da próxima Energia que a Zona ${op.player === 'OWN' ? 'gerar para você' : 'gerar para o oponente'} muda para um tipo aleatório`;
    case 'REVEAL_TOP_TAKE': {
      const noun = cardNoun(op.filter, tc);
      if (op.count === 1) return `Olhe a carta do topo do seu baralho. Se for ${noun.fem ? 'uma' : 'um'} ${noun.s}, coloque-a na sua mão; senão, coloque-a no fundo do baralho`;
      return `Olhe as ${op.count} cartas do topo do seu baralho. Coloque ${noun.fem ? 'todas as' : 'todos os'} ${noun.p} encontrad${noun.fem ? 'as' : 'os'} na sua mão e ${op.rest === 'BOTTOM' ? 'as outras no fundo do baralho' : 'embaralhe as outras de volta'}`;
    }
    case 'REVEAL_CARDS': return `O oponente revela ${op.filter ? `todas as ${cardNoun(op.filter, tc).p}` : 'as cartas'} ${op.zone === 'OPPONENT_DECK' ? 'do baralho dele' : 'da mão dele'}`;
    case 'SWAP_HAND_WITH_DECK': return 'Escolha um Pokémon da sua mão e troque-o por um Pokémon aleatório do seu baralho';
    case 'CHOOSE_ONE': return `Escolha 1: ${op.options.map((ops, i) => `(${i + 1}) ${joinWith(ops.map((x) => lowerFirst(operationTextIn(x, tc))), 'e')}`).join('; ')}`;
    case 'FORCE_COIN': return 'Na próxima vez neste turno em que você jogar moedas por um ataque, Habilidade ou Treinador, a primeira moeda sai cara';
    case 'COPY_TRAINER': return `Olhe um Apoiador aleatório do baralho do oponente${op.excludeKeys.length ? ` que não seja ${names(op.excludeKeys, tc)}` : ''}, embaralhe-o de volta e use o efeito dele como o efeito desta carta`;
    case 'MOVE_ENERGY_FREELY': return 'Mova quantas Energias quiser entre os seus Pokémon em jogo, como quiser';
    case 'PREVENT_CONDITIONS': {
      const p = selectorPhrase(op.target, tc, 'ALL');
      const what = op.conditions?.length ? `ficar ${joinOr(op.conditions.map((c) => CONDITION_LABEL[c]))}` : `ser afetado${p.plural ? 's' : ''} por Condições Especiais`;
      return `${durationPrefix(op.duration)}${subj(p.text)} não ${p.plural ? 'podem' : 'pode'} ${what}${op.conditions?.length ? '' : ` e ${p.plural ? 'se recuperam' : 'se recupera'} delas`}`;
    }
    case 'PREVENT_HEALING': {
      const p = selectorPhrase(op.target, tc, 'ALL');
      return `${durationPrefix(op.duration)}${subj(p.text)} não ${p.plural ? 'podem ser curados' : 'pode ser curado'}`;
    }
    case 'ATTACK_COIN_GATE': {
      const t = selectorPhrase(op.target, tc, 'ONE').text;
      if (op.duration.removeOn?.includes('TARGET_LEAVES_ACTIVE') && op.duration.kind === 'WHILE_SOURCE_IN_PLAY') {
        return `Até ${t} sair do Ativo, quando ele for atacar, o oponente joga uma moeda; se sair coroa, o ataque não acontece. Não acumula`;
      }
      return `${durationPrefix(op.duration)}se ${t} tentar atacar, o oponente joga uma moeda; se sair coroa, o ataque não acontece`;
    }
    case 'COUNTER_DAMAGE': return `${durationPrefix(op.duration)}se ${selectorPhrase(op.target, tc, 'ONE').text} receber dano de um ataque, cause ${op.amount} de dano ao Pokémon atacante`;
    case 'GRANT_RULE': {
      const p = selectorPhrase(op.target, tc, 'ALL');
      if (op.rule === 'EVOLVE_ANY_TURN') return `${subj(p.text)} pode evoluir no seu primeiro turno ou no turno em que foi jogado`;
      if (op.rule === 'EVOLVES_AS') return `${subj(p.text)} pode evoluir para qualquer Pokémon que evolua de ${names(op.evolvesAs ?? [], tc)} quando você o jogar da mão sobre ele`;
      return `${subj(p.text)} ${p.plural ? 'podem' : 'pode'} usar qualquer ataque das evoluções anteriores (ainda precisa da Energia de cada ataque)`;
    }
    case 'SURVIVE_KNOCKOUT': return `Se ${selectorPhrase(op.target, tc, 'ONE').text} estiver prestes a ser Nocauteado por dano de um ataque, jogue uma moeda. Se sair cara, ele não é Nocauteado e fica com ${op.remainingHp} PS restantes`;
    case 'REROLL_COINS': return `Uma vez durante o seu turno, você pode jogar de novo as moedas de um ataque de ${selectorPhrase(op.target, tc, 'ONE').text}. Só 1 Estrela da Vitória por turno`;
    case 'CONDITIONAL': {
      const branch = (ops: readonly Operation[]) => mergeOps(ops, tc).map(lowerFirst).join('; ');
      return `${conditionTextIn(op.condition, tc)}, ${branch(op.then)}${op.else?.length ? `; senão, ${branch(op.else)}` : ''}`;
    }
    case 'REMOVE_TOOL':
      if (tc.tool && op.target.scope === 'SELF') return 'Descarte esta carta';
      return op.destination === 'HAND' ? `Coloque a Ferramenta de ${selectorPhrase(op.target, tc, 'EACH').text} na mão do dono` : `Descarte a Ferramenta de ${selectorPhrase(op.target, tc, 'EACH').text}`;
    case 'END_TURN': return 'Seu turno acaba';
    case 'ATTACK_FAILS': return 'Este ataque não faz nada';
    default: return '';
  }
}

export function operationText(op: Operation, opts?: TextOptions): string {
  return operationTextIn(op, textCtx(opts, []));
}

// ---------------------------------------------------------------- blocos e agrupamento

/** JSON estável (chaves ordenadas) para comparar blocos/operações sem depender do `id`. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>).sort().map((k) => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** PREVENT_DAMAGE (tudo, de ataques) + PREVENT_EFFECTS no mesmo alvo e duração viram uma frase só (Dugtrio). */
function preventPair(a: Operation, b: Operation | undefined): boolean {
  return !!b && a.type === 'PREVENT_DAMAGE' && b.type === 'PREVENT_EFFECTS' && a.amount === 'ALL' && a.categories.includes('ATTACK') && !a.charges
    && stable(a.target) === stable(b.target) && stable(a.duration) === stable(b.duration);
}

function preventPairText(op: Extract<Operation, { type: 'PREVENT_DAMAGE' }>, tc: TextCtx): string {
  return `${durationPrefix(op.duration)}previna todo dano e efeito de ataques feitos a ${selectorPhrase(op.target, tc, 'EACH').text}`;
}

/** “Jogue uma moeda. Se sair coroa, este ataque não faz nada.” seguido de efeitos com cara: uma frase só (Voar do Noctowl). */
function coinFailThen(blocks: readonly EffectBlock[], tc: TextCtx): string | null {
  const [fail, ...rest] = blocks;
  if (!fail || fail.operation.type !== 'ATTACK_FAILS' || !fail.condition || !rest.length) return null;
  const tailsText = conditionTextIn(fail.condition, tc);
  if (tailsText !== 'Se sair coroa' || rest.some((b) => !b.condition || conditionTextIn(b.condition, tc) !== 'Se sair cara')) return null;
  const ops = mergeOps(rest.map((b) => b.operation), tc).map(lowerFirst);
  return sentence(`Se sair coroa, este ataque não faz nada; se sair cara, ${joinWith(ops, 'e')}`);
}

/** Textos de uma sequência de operações (ramo de CONDITIONAL), juntando o par de prevenção. */
/** “O Pokémon Ativo do oponente fica Envenenado e Paralisado” (duas Condições no mesmo alvo). */
function conditionPairText(op: Operation, next: Operation | undefined, tc: TextCtx): string | null {
  if (op.type !== 'APPLY_CONDITION' || next?.type !== 'APPLY_CONDITION' || op.condition === 'RANDOM' || next.condition === 'RANDOM' || op.poisonDamage || next.poisonDamage) return null;
  if (stable(op.target) !== stable(next.target)) return null;
  const p = selectorPhrase(op.target, tc, 'EACH');
  return `${subj(p.text)} ${p.plural ? 'ficam' : 'fica'} ${CONDITION_LABEL[op.condition]}${p.plural ? 's' : ''} e ${CONDITION_LABEL[next.condition]}${p.plural ? 's' : ''}`;
}

function mergeOps(ops: readonly Operation[], tc: TextCtx): string[] {
  const out: string[] = [];
  for (let i = 0; i < ops.length; i += 1) {
    const op = ops[i]!;
    const pair = conditionPairText(op, ops[i + 1], tc);
    if (pair) { out.push(pair); i += 1; continue; }
    if (preventPair(op, ops[i + 1])) { out.push(preventPairText(op as Extract<Operation, { type: 'PREVENT_DAMAGE' }>, tc)); i += 1; continue; }
    out.push(operationTextIn(op, tc));
  }
  return out;
}

const INFINITIVE: Record<string, string> = {
  Cause: 'causar', Cure: 'curar', Ligue: 'ligar', Mova: 'mover', Descarte: 'descartar', Troque: 'trocar', Evolua: 'evoluir', Compre: 'comprar',
  Coloque: 'colocar', Olhe: 'olhar', Embaralhe: 'embaralhar', Revele: 'revelar', Remova: 'remover', Previna: 'prevenir', Devolva: 'devolver',
  Escolha: 'escolher', Jogue: 'jogar', Distribua: 'distribuir',
};

/** “Cure 20 de dano…” → “curar 20 de dano…”; “O Pokémon Ativo do oponente fica Envenenado” → “deixar o … Envenenado”. */
function asInfinitive(text: string): string | null {
  const verb = /^(\p{L}+)(\s.*)$/u.exec(text);
  if (verb && INFINITIVE[verb[1]!]) return `${INFINITIVE[verb[1]!]}${verb[2]}`;
  const opp = /^O oponente (\p{L}+a)\b(.*)$/u.exec(text);
  if (opp) return `fazer o oponente ${opp[1]}r${opp[2]}`;
  const fica = /^(.+?) fica (\p{L}+)(.*)$/u.exec(text);
  if (fica && !fica[1]!.includes(',')) return `deixar ${lowerFirst(fica[1]!)} ${fica[2]}${fica[3]}`;
  return null;
}

function blockTextIn(block: EffectBlock, tc: TextCtx, opText?: string): string {
  let text = opText ?? operationTextIn(block.operation, tc);
  if (block.condition) text = `${conditionTextIn(block.condition, tc)}, ${lowerFirst(text)}`;
  if (block.optional) {
    const inf = block.condition ? null : asInfinitive(text);
    text = inf ? `Você pode ${inf}` : `Você pode: ${lowerFirst(text)}`;
  }
  return sentence(text);
}

/**
 * Frases de uma lista de blocos: blocos idênticos consecutivos viram “N vezes” (Dragonite), blocos consecutivos
 * com a mesma condição compartilham a oração condicional, e o par de prevenção vira uma frase.
 */
function renderBlocks(blocks: readonly EffectBlock[], tc: TextCtx): string[] {
  const out: string[] = [];
  const key = (b: EffectBlock) => stable({ t: b.timing, c: b.condition ?? null, o: b.optional ?? false, op: b.operation });
  for (let i = 0; i < blocks.length; i += 1) {
    const b = blocks[i]!;
    const nb = blocks[i + 1];
    // Dois modificadores seguidos com a mesma duração (Armadilha Primata) ou no mesmo alvo contínuo (Falinks) viram uma frase.
    if (nb && !b.condition && !nb.condition && !b.optional && !nb.optional && b.timing === nb.timing && b.operation.type === 'MODIFY' && nb.operation.type === 'MODIFY'
      && stable(b.operation.target) === stable(nb.operation.target) && stable(b.operation.duration) === stable(nb.operation.duration)) {
      const first = operationTextIn(b.operation, tc);
      const second = operationTextIn(nb.operation, tc);
      const pre = durationPrefix(b.operation.duration);
      const tail = lowerFirst(pre && second.startsWith(pre) ? second.slice(pre.length) : second)
        .replace(/^este Pokémon /, 'ele ').replace(/^o custo de Recuo do Pokémon Defensor/, 'o custo de Recuo dele');
      out.push(sentence(`${first} e ${tail}`));
      i += 1;
      continue;
    }
    const pair = nb && stable(b.condition ?? null) === stable(nb.condition ?? null) && !b.optional && !nb.optional && b.timing === nb.timing ? conditionPairText(b.operation, nb.operation, tc) : null;
    if (pair) {
      out.push(blockTextIn(b, tc, pair));
      i += 1;
      continue;
    }
    let n = 1;
    while (i + n < blocks.length && key(blocks[i + n]!) === key(b)) n += 1;
    if (n > 1) {
      out.push(repeatedText(b, n, tc));
      i += n - 1;
      continue;
    }
    const same = (x: EffectBlock | undefined) => !!x && !!b.condition && x.timing === b.timing && !x.optional && !b.optional && stable(x.condition) === stable(b.condition);
    const group: EffectBlock[] = [b];
    while (same(blocks[i + group.length])) group.push(blocks[i + group.length]!);
    if (group.length > 1) {
      const texts = mergeOps(group.map((g) => g.operation), tc).map(lowerFirst);
      out.push(sentence(`${conditionTextIn(b.condition!, tc)}, ${joinWith(texts, 'e')}`));
      i += group.length - 1;
      continue;
    }
    if (preventPair(b.operation, blocks[i + 1]?.operation) && stable(blocks[i + 1]!.condition ?? null) === stable(b.condition ?? null) && !blocks[i + 1]!.optional) {
      out.push(blockTextIn(b, tc, preventPairText(b.operation as Extract<Operation, { type: 'PREVENT_DAMAGE' }>, tc)));
      i += 1;
      continue;
    }
    out.push(blockTextIn(b, tc));
  }
  return out;
}

function repeatedText(b: EffectBlock, n: number, tc: TextCtx): string {
  const op = b.operation;
  if (op.type === 'DEAL_DAMAGE' && op.target.pick?.mode === 'RANDOM' && op.target.pick.count === 1 && !SINGLE_SCOPES.has(normScope(op.target))) {
    const pool = scopePhrase(normScope(op.target), op.target.filter, 'ONE', tc).text.replace(/^um dos /, '1 dos ');
    const d = damageParts(op.amount, tc, false);
    return blockTextIn(b, tc, `${pool.charAt(0).toUpperCase()}${pool.slice(1)} é escolhido aleatoriamente ${n} vezes; para cada vez, cause ${d.lead} a ele${d.tail}`);
  }
  return `${blockTextIn(b, tc)} Faça isso ${n} vezes.`;
}

export function blockText(block: EffectBlock, opts?: TextOptions): string {
  return blockTextIn(block, textCtx(opts, [block]));
}

// ---------------------------------------------------------------- ataques

export function costSymbols(cost: Partial<Record<CostType, number>>): CostType[] {
  const order: CostType[] = ['GRASS', 'FIRE', 'WATER', 'LIGHTNING', 'PSYCHIC', 'FIGHTING', 'DARKNESS', 'METAL', 'COLORLESS'];
  return order.flatMap((t) => Array.from({ length: cost[t] ?? 0 }, () => t));
}

function attackCtx(attack: Attack, opts?: TextOptions): TextCtx {
  const hasMainDamage = !!attack.damageTarget && (attack.damageFormula !== null || (attack.baseDamage ?? 0) > 0);
  const mainScope = attack.damageTarget ? normScope(attack.damageTarget) : null;
  const mainOnActive = hasMainDamage && (mainScope === 'OPPONENT_ACTIVE' || mainScope === 'DEFENDING');
  return textCtx(opts, attack.effects, { hasMainDamage, mainOnActive });
}

/** “40” fixo, “30×” por contagem, “30+” com dano adicional (fórmula de soma ou bloco de bônus). */
export function damageNotation(attack: Attack): string {
  if (attack.damageFormula) {
    const f = attack.damageFormula;
    if (f.op === 'MULTIPLY') {
      const k = (f.operands ?? []).find((o) => o.op === 'CONST');
      return `${k?.value ?? ''}×`;
    }
    if (f.op === 'ADD') {
      const k = (f.operands ?? []).find((o) => o.op === 'CONST');
      return `${k?.value ?? ''}+`;
    }
    // Dano só por fórmula sem número impresso (Debater-se: dano igual ao dano neste Pokémon).
    return '';
  }
  const base = attack.baseDamage ?? 0;
  if (base <= 0) return '';
  const tc = attackCtx(attack);
  return attack.effects.some((b) => isDamageBonus(b.operation, tc)) ? `${base}+` : String(base);
}

/** max(0, cartas na mão do oponente − cartas na sua mão): “compre até igualar a mão do oponente”. */
function handGap(f: Formula): boolean {
  const diff = f.op === 'MAX' ? f.operands?.find((o) => o.op === 'SUBTRACT') : undefined;
  const [theirs, mine] = diff?.operands ?? [];
  return theirs?.op === 'COUNT_CARDS' && theirs.zone === 'OPPONENT_HAND' && mine?.op === 'COUNT_CARDS' && mine.zone === 'OWN_HAND';
}

/** k × (Pokémon em jogo + Pokémon na mão com o ataque X): os Pokémon são revelados e contados (Monte de Filhotes). */
function revealedPokemonSentence(f: Formula, tc: TextCtx): string | null {
  if (f.op !== 'MULTIPLY') return null;
  const k = f.operands?.find((o) => o.op === 'CONST');
  const sum = f.operands?.find((o) => o.op === 'ADD');
  const inPlay = sum?.operands?.find((o) => o.op === 'COUNT_POKEMON');
  const inHand = sum?.operands?.find((o) => o.op === 'COUNT_CARDS' && o.zone === 'OWN_HAND');
  const ids = inPlay?.selector?.filter?.attackIds;
  if (!k || !inHand || !ids?.length) return null;
  return `Revele os seus Pokémon em jogo e na sua mão com o ataque ${ids.map(tc.attackName).join(' ou ')}. Este ataque causa ${k.value} de dano para cada Pokémon revelado.`;
}

function formulaDamageSentence(f: Formula, tc: TextCtx, target: Selector | null = null): string {
  const revealed = revealedPokemonSentence(f, tc);
  if (revealed) return revealed;
  const ops = f.operands ?? [];
  if (f.op === 'ADD' && ops.length === 2) {
    const rest = ops.find((o) => o.op !== 'CONST');
    const sc = rest ? scaled(rest) : null;
    if (sc && ops.some((o) => o.op === 'CONST')) {
      const coin = sc.unit.op === 'COUNT_HEADS' || sc.unit.op === 'COUNT_TAILS' ? tc.coins.get(sc.unit.reference ?? '') : undefined;
      if (coin && !coin.untilTails && coin.count === 1) return sentence(`Se sair ${sc.unit.op === 'COUNT_HEADS' ? 'cara' : 'coroa'}, este ataque causa ${sc.k} de dano a mais`);
      return sentence(`Este ataque causa ${sc.k} de dano a mais para cada ${perUnit(sc.unit, tc)}`);
    }
  }
  if (f.op === 'ADD' && ops.length === 2 && ops.some((o) => o.op === 'CONST') && ops.some((o) => o.op === 'DAMAGE_ON_SOURCE')) {
    return sentence('Este ataque causa dano a mais igual ao dano que este Pokémon tem');
  }
  if (f.op === 'DAMAGE_ON_SOURCE') return sentence('Este ataque causa ao Pokémon Ativo do oponente dano igual ao dano que este Pokémon tem');
  const sc = scaled(f);
  const to = target ? ` a ${selectorPhrase(target, tc, 'ONE').text}` : '';
  if (sc) return sentence(`Este ataque causa ${sc.k} de dano${to} para cada ${perUnit(sc.unit, tc)}`);
  return sentence(`Este ataque causa${to} dano igual a ${formulaTextIn(f, tc)}`);
}

export function attackText(attack: Attack, opts?: TextOptions): string {
  return fitParagraph(fullAttackText(attack, opts));
}

function fullAttackText(attack: Attack, opts?: TextOptions): string {
  const tc = attackCtx(attack, opts);
  const parts: string[] = [];
  if (attack.preconditions.length) {
    parts.push(sentence(`Você só pode usar este ataque ${attack.preconditions.map((c) => lowerFirst(conditionTextIn(c, tc)).replace(/^se /, 'se ')).join(' e ')}`));
  }
  if (attack.alternativeCost) {
    const n = Object.values(attack.alternativeCost.energyCost).reduce((a, b) => a + (b ?? 0), 0);
    const types = costSymbols(attack.alternativeCost.energyCost).map((t) => TYPE_LABEL[t]);
    parts.push(sentence(`${conditionTextIn(attack.alternativeCost.condition, tc)}, este ataque pode ser usado com ${n} Energia${n === 1 ? '' : 's'} ${joinWith([...new Set(types)].map((t) => `de ${t}`), 'e')}`));
  }
  for (const cost of attack.additionalCosts) {
    parts.push(cost.type === 'DISCARD_ENERGY'
      ? `Para usar este ataque, descarte ${cost.count} Energia${cost.count > 1 ? 's' : ''}${cost.energyType !== 'ANY' ? ` de ${TYPE_LABEL[cost.energyType]}` : ''} deste Pokémon.`
      : `Para usar este ataque, descarte ${cost.count} ${cost.count === 1 ? 'carta' : 'cartas'} da sua mão.`);
  }
  const preBlocks = attack.effects.filter((b) => b.timing === 'PRE_DAMAGE');
  const postBlocks = attack.effects.filter((b) => b.timing === 'POST_DAMAGE');
  const failLast = preBlocks[preBlocks.length - 1];
  const merged = failLast?.operation.type === 'ATTACK_FAILS' && !attack.damageFormula ? coinFailThen([failLast, ...postBlocks], tc) : null;
  if (merged) {
    parts.push(...renderBlocks(preBlocks.slice(0, -1), tc), merged);
    return parts.join(' ');
  }
  const hits = (attack.baseDamage ?? 0) > 0 || !!attack.damageFormula;
  const toolFirst = hits ? preBlocks.filter((b) => b.operation.type === 'REMOVE_TOOL' && !b.condition) : [];
  parts.push(...toolFirst.map((b) => sentence(`Antes de causar dano, ${lowerFirst(blockTextIn(b, tc).replace(/\.$/, ''))}`)));
  parts.push(...renderBlocks(preBlocks.filter((b) => !toolFirst.includes(b)), tc));
  if (attack.damageFormula) parts.push(formulaDamageSentence(attack.damageFormula, tc, attack.damageTarget && !tc.attack!.mainOnActive ? attack.damageTarget : null));
  if (attack.damageTarget && !tc.attack!.mainOnActive && (attack.baseDamage ?? 0) > 0) {
    const note = benchOnly(attack.damageTarget) ? ' (sem Fraqueza)' : '';
    parts.push(sentence(`Este ataque causa ${attack.baseDamage} de dano a ${selectorPhrase(attack.damageTarget, tc, 'EACH').text}${note}`));
  }
  parts.push(...renderBlocks(attack.effects.filter((b) => b.timing === 'POST_DAMAGE'), tc));
  if (attack.ignoreDefenderEffects) parts.push('Efeitos no Pokémon Ativo do oponente não afetam este dano.');
  return parts.join(' ');
}

// ---------------------------------------------------------------- Habilidades

function triggerText(trigger: Trigger, tool = false): string {
  const subject = trigger.filter?.subject;
  const who = subject === 'OPPONENT_POKEMON' ? 'o oponente' : subject === 'SELF' ? 'este Pokémon' : 'você';
  const self = tool ? 'o Pokémon com esta carta' : 'este Pokémon';
  const f = trigger.filter ?? {};
  switch (trigger.event) {
    case 'ENERGY_ATTACHED':
      if (subject === 'SELF' && f.energySource === 'ENERGY_ZONE') return `Sempre que você ligar uma Energia${f.energyType ? ` de ${TYPE_LABEL[f.energyType]}` : ''} da sua Zona de Energia a ${self},`;
      return `Sempre que ${who === 'este Pokémon' ? `uma Energia for ligada a ${self}` : `${who} ligar uma Energia da Zona a um Pokémon`},`;
    case 'DAMAGE_APPLIED': return subject === 'SELF'
      ? `Sempre que ${self} receber dano de ${trigger.filter?.damageCategory === 'ATTACK' ? 'um ataque do oponente' : 'um ataque'},`
      : 'Sempre que um Pokémon receber dano,';
    case 'POKEMON_ENTERED': return f.from === 'HAND' ? 'Quando você colocar este Pokémon da mão no seu Banco,' : 'Quando você colocar este Pokémon em jogo,';
    case 'POKEMON_EVOLVED': return f.from === 'HAND' ? 'Quando você jogar este Pokémon da mão para evoluir,' : 'Quando você evoluir para este Pokémon,';
    case 'POKEMON_MOVED': return subject === 'SELF' && trigger.filter?.to === 'ACTIVE' ? 'Quando este Pokémon for para o Ativo,' : 'Quando um Pokémon mudar de posição,';
    case 'TURN_STARTED': return trigger.filter?.turnOf === 'OPPONENT' ? 'No início do turno do oponente,' : 'No início do seu turno,';
    case 'TURN_ENDING': return trigger.filter?.turnOf === 'OPPONENT' ? 'No fim do turno do oponente,' : trigger.filter?.turnOf === 'OWN' ? 'No fim do seu turno,' : 'No fim de cada turno,';
    case 'POKEMON_KNOCKED_OUT':
      if (subject === 'SELF' && f.subjectRole === 'SOURCE') return 'Se um Pokémon do oponente for Nocauteado por dano de um ataque deste Pokémon,';
      if (subject === 'SELF') return `Se ${self} for Nocauteado${f.cause === 'ATTACK' ? ' por dano de um ataque do oponente' : ''},`;
      return 'Quando um Pokémon for Nocauteado,';
    case 'CONDITION_APPLIED': return 'Quando uma Condição Especial for aplicada,';
    case 'ATTACK_DECLARED': return subject === 'SELF' ? 'Quando este Pokémon atacar,' : 'Quando um Pokémon atacar,';
    case 'TRAINER_PLAYED': return trigger.filter?.turnOf === 'OPPONENT' ? 'Quando o oponente jogar um Treinador,' : 'Quando um Treinador for jogado,';
    default: return 'Quando acontecer o gatilho,';
  }
}

export function abilityText(ability: Ability, opts?: TextOptions): string {
  return fitParagraph(fullAbilityText(ability, opts));
}

function fullAbilityText(ability: Ability, opts?: TextOptions): string {
  const tc = textCtx(opts, ability.effects, null, ability.trigger ?? null);
  const body = renderBlocks(ability.effects, tc);
  const end = ability.endsTurn ? ' Seu turno acaba.' : '';
  const single = ability.sourcePositions.length === 1 ? ability.sourcePositions[0] : null;
  if (ability.kind === 'ACTIVATED') {
    const often = ability.usageLimit?.scope === 'UNLIMITED' ? 'Quantas vezes quiser durante o seu turno' : ability.usageLimit?.scope.endsWith('MATCH') ? 'Uma vez por partida' : 'Uma vez durante o seu turno';
    const cond = ability.conditions.length ? `, ${ability.conditions.map((c) => lowerFirst(conditionTextIn(c, tc))).join(' e ')}` : '';
    const head = `${often}${single ? `, se este Pokémon estiver no ${single === 'ACTIVE' ? 'Ativo' : 'Banco'}` : ''}${cond}`;
    const [first, ...rest] = body;
    const inf = first ? asInfinitive(first.replace(/\.$/, '')) : null;
    const discard = ability.costs.find((c) => c.type === 'DISCARD_HAND_CARDS');
    const pay = discard ? `descartar ${discard.count} carta${discard.count === 1 ? '' : 's'} da sua mão para ` : '';
    // Efeito sem condição depois do primeiro só acontece porque a Habilidade foi usada: “Se fizer isso, …”.
    const after = rest.map((r, i) => (i === 0 && !ability.effects.filter((b) => b.timing === 'ON_ACTIVATE')[1]?.condition ? `Se fizer isso, ${lowerFirst(r)}` : r));
    const text = inf ? `${head}, você pode ${pay}${inf}.${after.length ? ` ${after.join(' ')}` : ''}` : `${head}, você pode usar esta Habilidade. ${body.join(' ')}`;
    return contract(`${text}${end}`).replace(/\s+/g, ' ').trim();
  }
  const koActive = ability.kind === 'TRIGGERED' && ability.trigger?.event === 'POKEMON_KNOCKED_OUT' && ability.trigger.filter?.subject === 'SELF'
    && ability.trigger.filter.subjectRole !== 'SOURCE' && single === 'ACTIVE';
  const entered = ability.trigger?.event === 'POKEMON_ENTERED' || ability.trigger?.event === 'POKEMON_EVOLVED';
  // “Uma vez durante o seu turno” só é impresso no gatilho de entrada em jogo (Misdreavus); ao evoluir, o limite é implícito.
  const perTurn = ability.trigger?.event === 'POKEMON_ENTERED' && ability.usageLimit && !ability.usageLimit.scope.endsWith('MATCH') && ability.usageLimit.scope !== 'UNLIMITED' ? 'Uma vez durante o seu turno, ' : '';
  const position = `${perTurn}${single && !koActive && !entered ? `${perTurn ? 'e' : 'E'}nquanto este Pokémon estiver no ${single === 'ACTIVE' ? 'Ativo' : 'Banco'}, ` : ''}`;
  const trigger = koActive ? 'Se este Pokémon for Nocauteado no Ativo por um ataque do oponente, '
    : ability.kind === 'TRIGGERED' && ability.trigger ? `${triggerText(ability.trigger)} ` : '';
  if (ability.kind === 'TRIGGERED' && ability.optional && body.length) {
    const inf = asInfinitive(body[0]!.replace(/\.$/, ''));
    if (inf) body[0] = `Você pode ${inf}.`;
  }
  const cond = ability.conditions.length ? `${ability.conditions.map((c) => conditionTextIn(c, tc)).join(' e ')}, ` : '';
  const lead = `${position}${position ? lowerFirst(trigger) : trigger}${position || trigger ? lowerFirst(cond) : cond}`;
  const joined = body.join(' ');
  const text = lead ? `${lead}${lowerFirst(joined)}` : joined;
  return contract(`${text}${end}`).replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------- Treinadores

export function trainerText(card: CardDefinition, opts?: TextOptions): string {
  if (card.category !== 'TRAINER') return '';
  const tool = card.subtype === 'TOOL';
  const tc = textCtx({ ...opts, tool }, card.trainerEffects);
  const lines: string[] = [];
  if (tool) {
    const triggered = card.trainerEffects.filter((b) => b.timing === 'ON_TRIGGER');
    lines.push(...renderBlocks(card.trainerEffects.filter((b) => b.timing !== 'ON_TRIGGER'), tc));
    if (triggered.length) {
      const trigger = card.trainerRules.toolTrigger ?? { event: 'DAMAGE_APPLIED', filter: { subject: 'SELF', subjectRole: 'TARGET', damageCategory: 'ATTACK' } };
      const shape = toolConditionShape(triggered);
      if (shape && (trigger.event === 'DAMAGE_APPLIED' || trigger.event === 'POKEMON_KNOCKED_OUT')) {
        const bare = triggered.map((b) => ({ ...b, condition: null }));
        const body = renderBlocks(bare, { ...tc, trigger }).join(' ');
        const who = `o Pokémon${shape.types ? ` do tipo ${joinOr(shape.types.map((t) => TYPE_LABEL[t]))}` : ''} com esta carta`;
        const what = trigger.event === 'POKEMON_KNOCKED_OUT' ? 'for Nocauteado por dano de um ataque do oponente' : 'receber dano de um ataque do oponente';
        lines.push(contract(`Se ${who} estiver no Ativo e ${what}, ${lowerFirst(body)}`));
      } else {
        const body = renderBlocks(triggered, { ...tc, trigger }).join(' ');
        lines.push(contract(`${triggerText(trigger, true)} ${lowerFirst(body)}`));
      }
    }
    if (card.trainerRules.onKnockedOut === 'RETURN_TO_HAND') lines.push('Se o Pokémon com esta carta for Nocauteado por dano de um ataque do oponente, coloque-o na sua mão em vez de no descarte.');
  } else lines.push(...renderBlocks(card.trainerEffects, tc));
  lines.unshift(...playConditionLines(card, tc));
  if (card.subtype === 'TOOL') lines.unshift('Ligue esta carta a um dos seus Pokémon. Ele só pode ter 1 Ferramenta.');
  if (card.subtype === 'SUPPORTER') lines.push('Você só pode jogar 1 Apoiador por turno.');
  if (card.subtype === 'STADIUM') lines.push('Este Estádio afeta os dois jogadores. Substitui o Estádio em jogo.');
  const fossil = card.trainerRules.fieldBehavior;
  if (fossil) {
    const type = fossil.types.length ? ` do tipo ${joinOr(fossil.types.map((t) => TYPE_LABEL[t]))}` : '';
    lines.push(`Jogue esta carta como um Pokémon Básico${type} de ${fossil.hp} PS no seu Banco. Ela não pode atacar nem recuar e não conta como Básico na mão inicial.`);
    if (fossil.ownerMayDiscardDuringMainPhase) lines.push('Durante o seu turno, você pode descartá-la do jogo.');
  }
  return lines.join(' ');
}

/** Condição comum dos blocos disparados de uma Ferramenta: “no Ativo” e, opcionalmente, “do tipo X”. */
/** Seletores usados pelos efeitos de um Treinador (alvo, origem, destino), inclusive dentro de ramos. */
function effectSelectors(blocks: readonly EffectBlock[]): Selector[] {
  const out: Selector[] = [];
  const visit = (op: Operation) => {
    const o = op as { target?: Selector; from?: Selector; to?: Selector };
    for (const sel of [o.target, o.from, o.to]) if (sel && typeof sel === 'object' && 'scope' in sel) out.push(sel);
    if (op.type === 'CONDITIONAL') { op.then.forEach(visit); (op.else ?? []).forEach(visit); }
    if (op.type === 'CHOOSE_ONE') op.options.forEach((ops) => ops.forEach(visit));
  };
  for (const b of blocks) visit(b.operation);
  return out;
}

/**
 * “Você só pode usar esta carta se …”: condições de jogo que o texto do efeito não deixa claras.
 * Ficam de fora as que repetem o alvo do efeito (Koga: “o seu Muk ou Weezing no Ativo”) e as de
 * jogabilidade (ANY: “só se houver algo a curar”), que não são impressas na carta.
 */
function playConditionLines(card: Extract<CardDefinition, { category: 'TRAINER' }>, tc: TextCtx): string[] {
  const sels = effectSelectors(card.trainerEffects);
  const core = (f: Selector['filter']) => stable({ k: f?.deckLimitKeys ?? null, t: f?.types ?? null, g: f?.tags ?? null });
  const implied = (c: Condition) => c.op === 'EXISTS' && !!c.selector && sels.some((s) => {
    const a = normScope(s);
    const b = normScope(c.selector!);
    return (a === b || (b === 'OWN_POKEMON' && a.startsWith('OWN'))) && core(s.filter) === core(c.selector!.filter);
  });
  return card.trainerRules.playConditions.filter((c) => c.op !== 'ANY' && !implied(c)).map((c) => {
    if (c.op === 'COMPARE' && c.left?.op === 'OWN_TURN_NUMBER' && c.cmp === 'GT' && c.right?.value === 1) return 'Você não pode usar esta carta no seu primeiro turno.';
    return sentence(`Você só pode usar esta carta ${lowerFirst(conditionTextIn(c, tc)).replace(/^se você /, 'se ')}`);
  });
}

function toolConditionShape(blocks: readonly EffectBlock[]): { types: readonly PokemonType[] | null } | null {
  const first = blocks[0]?.condition;
  if (!first || blocks.some((b) => stable(b.condition) !== stable(first))) return null;
  if (first.op === 'SOURCE_POSITION' && first.position === 'ACTIVE') return { types: null };
  if (first.op !== 'ALL' || first.conditions?.length !== 2) return null;
  const pos = first.conditions.find((c) => c.op === 'SOURCE_POSITION' && c.position === 'ACTIVE');
  const type = first.conditions.find((c) => c.op === 'EXISTS' && c.selector?.scope === 'SELF' && c.selector.filter?.types);
  return pos && type ? { types: type.selector!.filter!.types! } : null;
}

// ---------------------------------------------------------------- face da carta

export type CardFaceData = {
  readonly printingId: string;
  readonly definitionKey: string;
  readonly name: string;
  readonly category: 'POKEMON' | 'TRAINER';
  readonly subtitle: string;
  readonly hp: number | null;
  readonly types: readonly PokemonType[];
  readonly ruleBox: 'NONE' | 'EX' | 'MEGA_EX';
  readonly evolvesFromName: string | null;
  readonly abilities: readonly { readonly name: string; readonly text: string }[];
  readonly attacks: readonly { readonly name: string; readonly cost: readonly CostType[]; readonly damage: string; readonly text: string; readonly type: PokemonType }[];
  readonly weakness: string | null;
  readonly retreat: number | null;
  readonly trainerText: string;
  readonly ruleBoxText: string | null;
  readonly flavorText: string | null;
  readonly setId: string;
  readonly collectorNumber: string;
  readonly rarity: string;
  /** Símbolo do Pocket (◊…◊◊◊◊, ☆…☆☆☆, ♛, PROMO) derivado de raridade, acabamento e cena imersiva. */
  readonly raritySymbol: RaritySymbol;
  readonly finish: string;
  readonly templateId: string;
  readonly artMode: string;
  readonly artKey: string | null;
  readonly artAssetId: string | null;
};

export function cardFace(def: CardDefinition, printing: CardPrinting, nameOf: NameResolver = () => null): CardFaceData {
  const pokemon = isPokemon(def) ? def : null;
  const mainType = pokemon?.types[0] ?? 'COLORLESS';
  const opts: TextOptions = { nameOf };
  const attackOpts: TextOptions = { nameOf, attackNames: Object.fromEntries(def.attacks.map((a) => [a.id, a.name])), abilityNames: Object.fromEntries(def.abilities.map((a) => [a.id, a.name])) };
  return {
    printingId: printing.printingId,
    definitionKey: `${def.id}@${def.version}`,
    name: def.name,
    category: def.category,
    subtitle: pokemon ? STAGE_LABEL[pokemon.stage] : def.category === 'TRAINER' ? (def.trainerRules.fieldBehavior ? 'Item · Fóssil' : SUBTYPE_LABEL[def.subtype]) : '',
    hp: pokemon ? pokemon.baseHp : def.category === 'TRAINER' ? def.trainerRules.fieldBehavior?.hp ?? null : null,
    types: pokemon ? pokemon.types : [],
    ruleBox: def.ruleBox,
    evolvesFromName: pokemon && pokemon.evolvesFrom.length ? nameOf(pokemon.evolvesFrom[0]!) ?? pokemon.evolvesFrom[0]! : null,
    abilities: def.abilities.map((a) => ({ name: a.name, text: abilityText(a, attackOpts) })),
    attacks: def.attacks.map((a) => ({ name: a.name, cost: costSymbols(a.energyCost), damage: damageNotation(a), text: attackText(a, attackOpts), type: mainType })),
    weakness: pokemon?.weakness ? `${TYPE_LABEL[pokemon.weakness.type]} ${pokemon.weakness.operation === 'ADD' ? `+${pokemon.weakness.value}` : `×${pokemon.weakness.value}`}` : null,
    retreat: pokemon ? pokemon.retreatCost : null,
    trainerText: trainerText(def, opts),
    ruleBoxText: def.ruleBox === 'EX' ? 'Regra ex: quando seu Pokémon ex é Nocauteado, o oponente ganha 2 pontos.'
      : def.ruleBox === 'MEGA_EX' ? 'Regra Mega ex: quando sua Mega Evolução ex é Nocauteada, o oponente ganha 3 pontos.' : null,
    flavorText: def.flavorText ?? null,
    setId: printing.setId,
    collectorNumber: printing.collectorNumber,
    rarity: printing.rarity,
    raritySymbol: raritySymbol(printing),
    finish: printing.finish,
    templateId: printing.templateId,
    artMode: printing.artMode,
    artKey: printing.artKey,
    artAssetId: printing.artAssetId,
  };
}
