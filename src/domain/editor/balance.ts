// Análise de balanceamento (editor-de-cartas.md §26). Não há “força 97%”: o relatório mostra distribuições
// de dano do template sob hipóteses explícitas, o que foi ignorado e comparações com o catálogo local.
// Balanceamento é aviso de autoria; execução inválida é erro (validação).
import type { Attack, CardDefinition, EffectBlock, Formula, Operation, PokemonCard, Selector } from '../cards/types.ts';

export type DamageOutcome = { readonly value: number; readonly probability: number };

export type AttackAnalysis = {
  readonly attackId: string;
  readonly name: string;
  readonly energyTotal: number;
  readonly colorless: number;
  /** null quando a fórmula usa uma leitura sem hipótese definida. */
  readonly distribution: readonly DamageOutcome[] | null;
  readonly expected: number | null;
  readonly min: number | null;
  readonly max: number | null;
  readonly perEnergy: number | null;
  readonly coinDependent: boolean;
  readonly unbounded: boolean;
  /** Dano adicional fixo de blocos DEAL_DAMAGE (fora do dano principal). */
  readonly extraDamage: number;
  readonly method: string;
};

export type BalanceFlag = {
  readonly code: string;
  readonly severity: 'WARNING' | 'INFO';
  readonly message: string;
  readonly path: readonly (string | number)[];
};

export type CatalogComparison = {
  readonly sampleSize: number;
  readonly group: string;
  readonly medianHp: number | null;
  readonly hpPercentile: number | null;
  readonly medianBestPerEnergy: number | null;
  readonly perEnergyPercentile: number | null;
};

export type BalanceReport = {
  readonly model: string;
  readonly attacks: readonly AttackAnalysis[];
  readonly flags: readonly BalanceFlag[];
  readonly assumptions: readonly string[];
  readonly ignored: readonly string[];
  readonly comparison: CatalogComparison | null;
};

export const BALANCE_ASSUMPTIONS: readonly string[] = [
  'Moedas justas (50% cara), resolvidas pelo battleRng antes da apresentação.',
  'Energia ligada exatamente igual ao custo do ataque, sem Energia extra.',
  'Contagens de Banco = 2 Pokémon por lado; contagens de cartas em zona = 3; dano acumulado na fonte/alvo = 0.',
  '“Jogar até sair coroa” é truncado em 10 caras para o cálculo (o jogo não tem teto secreto).',
  'Probabilidades descrevem o dano do template, não chance de vitória.',
];
export const BALANCE_IGNORED: readonly string[] = [
  'Fraqueza e modificadores de dano (atacante/defensor)', 'Ferramentas, Estádios, Habilidades e prevenções', 'Condições especiais e Confusão',
  'Escolhas do oponente e alvos alternativos',
];

const MAX_DAMAGE = 9990;
const UNTIL_TAILS_CAP = 10;

function binomial(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i += 1) r = (r * (n - k + i)) / i;
  return r;
}

type CoinSource = { readonly outputId: string; readonly outcomes: readonly { heads: number; tails: number; p: number }[]; readonly unbounded: boolean };

function coinSources(blocks: readonly EffectBlock[]): Map<string, CoinSource> {
  const out = new Map<string, CoinSource>();
  for (const b of blocks) {
    if (b.timing !== 'PRE_DAMAGE' || b.operation.type !== 'FLIP_COINS') continue;
    const op = b.operation;
    if (op.untilTails) {
      const outcomes = Array.from({ length: UNTIL_TAILS_CAP + 1 }, (_, k) => ({ heads: k, tails: 1, p: k < UNTIL_TAILS_CAP ? 0.5 ** (k + 1) : 0.5 ** UNTIL_TAILS_CAP }));
      out.set(op.outputId, { outputId: op.outputId, outcomes, unbounded: true });
    } else {
      const n = Math.max(1, Math.min(20, typeof op.count === 'number' ? op.count : op.count ? 3 : 1));
      out.set(op.outputId, { outputId: op.outputId, outcomes: Array.from({ length: n + 1 }, (_, k) => ({ heads: k, tails: n - k, p: binomial(n, k) / 2 ** n })), unbounded: false });
    }
  }
  return out;
}

function formulaRefs(f: Formula, acc: Set<string>): Set<string> {
  if ((f.op === 'COUNT_HEADS' || f.op === 'COUNT_TAILS') && f.reference) acc.add(f.reference);
  for (const o of f.operands ?? []) formulaRefs(o, acc);
  return acc;
}

type Env = { readonly heads: ReadonlyMap<string, { heads: number; tails: number }>; readonly energyTotal: number; readonly unknown: string[] };

function isSelfish(s: Selector | undefined): boolean {
  return !s || s.scope === 'SELF' || s.scope === 'OWN_ACTIVE';
}

/** Avaliação sob as hipóteses de BALANCE_ASSUMPTIONS (inteiros; mesmas regras de operadores da DSL §4). */
export function evaluateFormulaHypothesis(f: Formula, env: Env): number {
  const ops = f.operands ?? [];
  const v = (x: Formula) => evaluateFormulaHypothesis(x, env);
  switch (f.op) {
    case 'CONST': return f.value ?? 0;
    case 'ADD': return ops.reduce((s, x) => s + v(x), 0);
    case 'SUBTRACT': return (ops[0] ? v(ops[0]) : 0) - (ops[1] ? v(ops[1]) : 0);
    case 'MULTIPLY': return ops.reduce((s, x) => s * v(x), 1);
    case 'MIN': return ops.length ? Math.min(...ops.map(v)) : 0;
    case 'MAX': return ops.length ? Math.max(...ops.map(v)) : 0;
    case 'CLAMP': {
      const [x, lo, hi] = ops.map(v);
      return Math.min(Math.max(x ?? 0, lo ?? 0), hi ?? 0);
    }
    case 'COUNT_HEADS': return env.heads.get(f.reference ?? '')?.heads ?? 0;
    case 'COUNT_TAILS': return env.heads.get(f.reference ?? '')?.tails ?? 0;
    case 'COUNT_ATTACHED_ENERGIES':
    case 'COUNT_PROVIDED_ENERGY_UNITS': return isSelfish(f.selector) ? env.energyTotal : 1;
    case 'COUNT_BENCH_POKEMON': return f.side === 'BOTH' ? 4 : 2;
    case 'COUNT_POKEMON': return 1;
    case 'COUNT_CARDS': return 3;
    case 'DAMAGE_ON_SOURCE':
    case 'DAMAGE_ON_TARGET':
    case 'POINTS': return 0;
    case 'OUTPUT_COUNT': return 1;
    default:
      env.unknown.push(String(f.op));
      return 0;
  }
}

function extraFixedDamage(blocks: readonly EffectBlock[]): number {
  let total = 0;
  const visit = (op: Operation) => {
    if (op.type === 'DEAL_DAMAGE' && typeof op.amount === 'number') total += op.amount;
    if (op.type === 'CONDITIONAL') op.then.forEach(visit);
  };
  for (const b of blocks) visit(b.operation);
  return total;
}

export function analyzeAttack(attack: Attack): AttackAnalysis {
  const energyTotal = Object.values(attack.energyCost ?? {}).reduce((s, n) => s + (n ?? 0), 0);
  const colorless = attack.energyCost?.COLORLESS ?? 0;
  const sources = coinSources(attack.effects ?? []);
  const coinOps = (attack.effects ?? []).some((b) => b.operation.type === 'FLIP_COINS');
  const unboundedAny = [...sources.values()].some((s) => s.unbounded);
  const extraDamage = extraFixedDamage(attack.effects ?? []);
  const base = { attackId: attack.id, name: attack.name, energyTotal, colorless, extraDamage, unbounded: unboundedAny };
  if (!attack.damageFormula) {
    const value = Math.max(0, Math.min(MAX_DAMAGE, attack.baseDamage ?? 0));
    return { ...base, distribution: [{ value, probability: 1 }], expected: value, min: value, max: value, perEnergy: energyTotal ? value / energyTotal : null,
      coinDependent: coinOps, method: 'Dano fixo (baseDamage).' };
  }
  const refs = [...formulaRefs(attack.damageFormula, new Set())].filter((r) => sources.has(r));
  let combos: { heads: Map<string, { heads: number; tails: number }>; p: number }[] = [{ heads: new Map(), p: 1 }];
  for (const ref of refs) {
    const src = sources.get(ref)!;
    const next: typeof combos = [];
    for (const c of combos) for (const o of src.outcomes) next.push({ heads: new Map([...c.heads, [ref, { heads: o.heads, tails: o.tails }]]), p: c.p * o.p });
    combos = next.slice(0, 4096);
  }
  const unknown: string[] = [];
  const acc = new Map<number, number>();
  for (const c of combos) {
    const value = Math.max(0, Math.min(MAX_DAMAGE, Math.trunc(evaluateFormulaHypothesis(attack.damageFormula, { heads: c.heads, energyTotal, unknown }))));
    acc.set(value, (acc.get(value) ?? 0) + c.p);
  }
  if (unknown.length) {
    return { ...base, distribution: null, expected: null, min: null, max: null, perEnergy: null, coinDependent: refs.length > 0,
      method: `Fórmula com leitura sem hipótese definida (${[...new Set(unknown)].join(', ')}).` };
  }
  const distribution = [...acc].sort((a, b) => a[0] - b[0]).map(([value, probability]) => ({ value, probability }));
  const expected = distribution.reduce((s, d) => s + d.value * d.probability, 0);
  return {
    ...base, distribution, expected, min: distribution[0]?.value ?? 0, max: distribution[distribution.length - 1]?.value ?? 0,
    perEnergy: energyTotal ? expected / energyTotal : null, coinDependent: refs.length > 0,
    method: refs.length ? `Fórmula avaliada para cada resultado das moedas (${refs.join(', ')}), ponderado pela probabilidade binomial.` : 'Fórmula avaliada sob as hipóteses fixas.',
  };
}

const HP_GUIDE: Record<string, number> = { BASIC: 120, STAGE_1: 160, STAGE_2: 200 };
const RULEBOX_HP_BONUS: Record<string, number> = { NONE: 0, EX: 50, MEGA_EX: 90 };

function percentile(values: readonly number[], value: number): number | null {
  if (!values.length) return null;
  const below = values.filter((v) => v < value).length;
  const equal = values.filter((v) => v === value).length;
  return Math.round(((below + equal / 2) / values.length) * 100);
}

function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function bestPerEnergy(card: PokemonCard): number | null {
  const values = (card.attacks ?? []).map(analyzeAttack).map((a) => a.perEnergy).filter((x): x is number => x !== null);
  return values.length ? Math.max(...values) : null;
}

function auraFlags(blocks: readonly EffectBlock[], owner: readonly (string | number)[], flags: BalanceFlag[]): void {
  blocks.forEach((b, i) => {
    const op = b.operation;
    if (b.timing !== 'CONTINUOUS' || op.type !== 'MODIFY') return;
    const wide = op.target.scope === 'OWN_POKEMON' || op.target.scope === 'ALL_POKEMON' || op.target.scope === 'OPPONENT_POKEMON';
    const unfiltered = !op.target.filter || Object.keys(op.target.filter).length === 0;
    const amount = typeof op.amount === 'number' ? op.amount : 0;
    const strong = (op.stat === 'DAMAGE_DEALT' || op.stat === 'DAMAGE_TAKEN') ? Math.abs(amount) >= 20 : op.stat === 'MAX_HP' ? amount >= 30 : op.stat === 'ENERGY_PROVISION' || op.stat === 'ATTACK_COST';
    if (wide && unfiltered && strong && op.duration.kind === 'WHILE_SOURCE_IN_PLAY') {
      flags.push({ code: 'AURA_UNRESTRICTED', severity: 'WARNING', path: [...owner, i], message: `Aura sem restrição: “${op.stat}” ${amount > 0 ? '+' : ''}${amount} vale para ${op.target.scope === 'ALL_POKEMON' ? 'todos os Pokémon' : 'vários Pokémon'} enquanto a fonte estiver em jogo.` });
    }
  });
}

function drawFlags(blocks: readonly EffectBlock[], owner: readonly (string | number)[], flags: BalanceFlag[]): void {
  blocks.forEach((b, i) => {
    if (b.operation.type === 'DRAW_CARDS' && typeof b.operation.count === 'number' && b.operation.count >= 4) {
      flags.push({ code: 'DRAW_MANY', severity: 'WARNING', path: [...owner, i], message: `Compra de ${b.operation.count} cartas de uma vez acelera muito o baralho de 20 cartas.` });
    }
  });
}

/** Relatório de balanceamento de uma carta, opcionalmente comparado ao catálogo local (mesmo estágio/regra). */
export function analyzeBalance(rules: CardDefinition, catalog: readonly CardDefinition[] = []): BalanceReport {
  const flags: BalanceFlag[] = [];
  if (rules.category !== 'POKEMON') {
    if (rules.category === 'TRAINER') {
      auraFlags(rules.trainerEffects ?? [], ['rules', 'trainerEffects'], flags);
      drawFlags(rules.trainerEffects ?? [], ['rules', 'trainerEffects'], flags);
    }
    return { model: 'balance-v1', attacks: [], flags, assumptions: BALANCE_ASSUMPTIONS, ignored: BALANCE_IGNORED, comparison: null };
  }
  const attacks = (rules.attacks ?? []).map(analyzeAttack);
  attacks.forEach((a, i) => {
    const path = ['rules', 'attacks', i];
    if (a.energyTotal === 0 && (a.expected ?? 0) >= 30) flags.push({ code: 'FREE_HIGH_DAMAGE', severity: 'WARNING', path, message: `“${a.name}” não tem custo de Energia e causa ${Math.round(a.expected ?? 0)} de dano esperado.` });
    if (a.perEnergy !== null && a.perEnergy > 45) flags.push({ code: 'HIGH_DAMAGE_PER_ENERGY', severity: 'WARNING', path, message: `“${a.name}” causa ${a.perEnergy.toFixed(1)} de dano esperado por Energia (referência do catálogo inicial: 20–35).` });
    if (a.unbounded) flags.push({ code: 'UNBOUNDED_REPETITION', severity: 'WARNING', path, message: `“${a.name}” usa “até sair coroa”: o dano cresce sem limite em sequências longas.` });
    if ((a.max ?? 0) >= 200) flags.push({ code: 'EXTREME_MAX_DAMAGE', severity: 'INFO', path, message: `Dano máximo de “${a.name}” (${a.max}) Nocauteia a maioria dos Pokémon do catálogo.` });
    if (a.coinDependent && a.expected !== null && a.max !== null && a.max > 0 && a.expected / a.max < 0.5) flags.push({ code: 'COIN_DEPENDENT', severity: 'INFO', path, message: `“${a.name}” depende fortemente de moedas (esperado ${Math.round(a.expected)} de máximo ${a.max}).` });
  });
  const hp = typeof rules.baseHp === 'number' ? rules.baseHp : 0;
  const guide = (HP_GUIDE[rules.stage] ?? 160) + (RULEBOX_HP_BONUS[rules.ruleBox] ?? 0);
  if (hp > guide) flags.push({ code: 'HIGH_HP', severity: 'WARNING', path: ['rules', 'baseHp'], message: `HP ${hp} acima da faixa sugerida para ${rules.stage === 'BASIC' ? 'Básico' : rules.stage === 'STAGE_1' ? 'Estágio 1' : 'Estágio 2'}${rules.ruleBox !== 'NONE' ? ` ${rules.ruleBox === 'EX' ? 'ex' : 'Mega ex'}` : ''} (até ${guide}).` });
  if (rules.retreatCost === 0 && hp >= 150) flags.push({ code: 'FREE_RETREAT_TANK', severity: 'INFO', path: ['rules', 'retreatCost'], message: 'Recuo zero com HP alto facilita trocas sem custo.' });
  if (rules.weakness?.operation === 'MULTIPLY') flags.push({ code: 'WEAKNESS_MULTIPLY', severity: 'WARNING', path: ['rules', 'weakness'], message: 'Fraqueza MULTIPLY (avançado) dobra danos altos; o padrão desta ruleset é +20.' });
  for (const [i, ability] of (rules.abilities ?? []).entries()) {
    auraFlags(ability.effects ?? [], ['rules', 'abilities', i, 'effects'], flags);
    drawFlags(ability.effects ?? [], ['rules', 'abilities', i, 'effects'], flags);
    if (ability.kind === 'ACTIVATED' && (ability.usageLimit?.count ?? 1) > 1 && ability.usageLimit?.scope.endsWith('TURN')) {
      flags.push({ code: 'ABILITY_REPEAT', severity: 'WARNING', path: ['rules', 'abilities', i, 'usageLimit'], message: `“${ability.name}” pode ser usada ${ability.usageLimit.count} vezes por turno.` });
    }
  }
  const peers = catalog.filter((c): c is PokemonCard => c.category === 'POKEMON' && c.stage === rules.stage && (c.ruleBox === 'NONE') === (rules.ruleBox === 'NONE') && c.id !== rules.id);
  const best = bestPerEnergy(rules);
  const peerHp = peers.map((p) => p.baseHp);
  const peerPer = peers.map(bestPerEnergy).filter((x): x is number => x !== null);
  const comparison: CatalogComparison | null = peers.length ? {
    sampleSize: peers.length,
    group: `${rules.stage}${rules.ruleBox === 'NONE' ? '' : ' com regra especial'}`,
    medianHp: median(peerHp), hpPercentile: percentile(peerHp, hp),
    medianBestPerEnergy: median(peerPer), perEnergyPercentile: best === null ? null : percentile(peerPer, best),
  } : null;
  if (comparison?.hpPercentile !== null && comparison && peers.length >= 3 && hp > Math.max(...peerHp) * 1.25) {
    flags.push({ code: 'HP_ABOVE_CATALOG', severity: 'WARNING', path: ['rules', 'baseHp'], message: `HP ${hp} supera em mais de 25% o maior HP do catálogo local no mesmo grupo (${Math.max(...peerHp)}).` });
  }
  return { model: 'balance-v1', attacks, flags, assumptions: BALANCE_ASSUMPTIONS, ignored: BALANCE_IGNORED, comparison };
}
