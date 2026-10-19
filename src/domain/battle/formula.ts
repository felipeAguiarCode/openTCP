// Fórmulas e condições (efeitos-dsl.md §4–§5). Avaliação pura, sem RNG.
import type { Condition, CostType, EnergyType, Formula } from '../cards/types.ts';
import { cardDef, entitiesOf, locate, type Ctx } from './core.ts';
import { eligible, matchesCardFilter, zoneCards, type SelectorContext } from './selectors.ts';
import { effectiveAttackCost, providedUnits, remainingHp, retreatCost } from './derived.ts';
import { other } from './types.ts';

type Readable = Pick<Ctx, 's' | 'cat'>;

export type FormulaContext = SelectorContext & {
  readonly targetEntityId?: string | null;
  /** Ataque em resolução (carta de batalha + ID do ataque): custo para EXTRA_ENERGY_UNITS. */
  readonly attackRef?: { readonly cardId: string; readonly attackId: string } | null;
  /** Dano já causado pelo ataque corrente ao alvo do dano principal (DAMAGE_DEALT_BY_ATTACK). */
  readonly damageDealtByAttack?: number;
};

/**
 * Unidades que sobram depois de pagar `cost` (efetivo): requisitos específicos primeiro; o Incolor é pago antes
 * com as unidades que não são do tipo pedido. Sem `energyType`, conta o total que sobra (efeitos-dsl.md §4).
 */
export function extraEnergyUnits(units: readonly { type: EnergyType; units: number }[], cost: Partial<Record<CostType, number>>, energyType?: EnergyType): number {
  const available: Partial<Record<EnergyType, number>> = {};
  for (const u of units) available[u.type] = (available[u.type] ?? 0) + Math.max(0, u.units);
  for (const [type, need] of Object.entries(cost)) {
    if (type === 'COLORLESS' || !need) continue;
    available[type as EnergyType] = Math.max(0, (available[type as EnergyType] ?? 0) - need);
  }
  let colorless = cost.COLORLESS ?? 0;
  const order = (Object.keys(available) as EnergyType[]).sort((a, b) => Number(a === energyType) - Number(b === energyType));
  for (const type of order) {
    if (colorless <= 0) break;
    const pay = Math.min(colorless, available[type] ?? 0);
    available[type] = (available[type] ?? 0) - pay;
    colorless -= pay;
  }
  if (energyType) return available[energyType] ?? 0;
  return Object.values(available).reduce((sum, v) => sum + (v ?? 0), 0);
}

function currentAttackCost(ctx: Readable, fc: FormulaContext, entityId: string): Partial<Record<CostType, number>> {
  if (!fc.attackRef || entityId !== fc.selfEntityId) return {};
  const located = locate(ctx.s, entityId);
  if (!located || !ctx.s.cards[fc.attackRef.cardId]) return {};
  const attack = cardDef(ctx, fc.attackRef.cardId).attacks.find((a) => a.id === fc.attackRef!.attackId);
  return attack ? effectiveAttackCost(ctx, located.entity, attack.id, attack.energyCost) : {};
}

const MAX_NODES = 32;
const MAX_DEPTH = 6;

export function formulaSize(f: Formula, depth = 1): { nodes: number; depth: number } {
  let nodes = 1;
  let maxDepth = depth;
  for (const child of f.operands ?? []) {
    const r = formulaSize(child, depth + 1);
    nodes += r.nodes;
    maxDepth = Math.max(maxDepth, r.depth);
  }
  return { nodes, depth: maxDepth };
}

export function isFormulaWithinLimits(f: Formula): boolean {
  const r = formulaSize(f);
  return r.nodes <= MAX_NODES && r.depth <= MAX_DEPTH;
}

export function evaluateFormula(ctx: Readable, f: Formula, fc: FormulaContext): number {
  const ops = (f.operands ?? []).map((o) => evaluateFormula(ctx, o, fc));
  switch (f.op) {
    case 'CONST': return f.value ?? 0;
    case 'ADD': return ops.reduce((a, b) => a + b, 0);
    case 'SUBTRACT': return (ops[0] ?? 0) - (ops[1] ?? 0);
    case 'MULTIPLY': return ops.reduce((a, b) => a * b, 1);
    case 'MIN': return Math.min(...ops);
    case 'MAX': return Math.max(...ops);
    case 'CLAMP': return Math.min(Math.max(ops[0] ?? 0, ops[1] ?? 0), ops[2] ?? 0);
    case 'COUNT_HEADS':
    case 'COUNT_TAILS': {
      const out = f.reference ? fc.outputs[f.reference] : undefined;
      if (!out || out.kind !== 'COINS') return 0;
      const face = f.op === 'COUNT_HEADS' ? 'HEADS' : 'TAILS';
      return out.results.filter((r) => r === face).length;
    }
    case 'COUNT_ATTACHED_ENERGIES': {
      if (!f.selector) return 0;
      return eligible(ctx, { ...f.selector, pick: { mode: 'ALL' } }, fc)
        .reduce((sum, l) => sum + l.entity.energies.filter((e) => !f.energyType || e.type === f.energyType).length, 0);
    }
    case 'COUNT_PROVIDED_ENERGY_UNITS': {
      if (!f.selector) return 0;
      return eligible(ctx, { ...f.selector, pick: { mode: 'ALL' } }, fc)
        .reduce((sum, l) => sum + providedUnits(ctx, l.entity).filter((u) => !f.energyType || u.type === f.energyType).reduce((a, u) => a + u.units, 0), 0);
    }
    case 'COUNT_BENCH_POKEMON': {
      const sides = f.side === 'BOTH' ? [fc.controller, other(fc.controller)] : [f.side === 'OPPONENT' ? other(fc.controller) : fc.controller];
      return sides.reduce((sum, p) => sum + entitiesOf(ctx.s, p).filter((l) => l.position === 'BENCH').length, 0);
    }
    case 'COUNT_POKEMON':
      return f.selector ? eligible(ctx, { ...f.selector, pick: { mode: 'ALL' } }, fc).length : 0;
    case 'COUNT_CARDS':
      return f.zone ? zoneCards(ctx, f.zone, fc.controller).filter((id) => matchesCardFilter(ctx, id, f.filter)).length : 0;
    case 'DAMAGE_ON_SOURCE':
      return fc.selfEntityId ? locate(ctx.s, fc.selfEntityId)?.entity.damage ?? 0 : 0;
    case 'DAMAGE_ON_TARGET':
      return fc.targetEntityId ? locate(ctx.s, fc.targetEntityId)?.entity.damage ?? 0 : 0;
    case 'POINTS': {
      const player = f.side === 'OPPONENT' ? other(fc.controller) : fc.controller;
      return ctx.s.players[player].points;
    }
    case 'OUTPUT_COUNT': {
      const out = f.reference ? fc.outputs[f.reference] : undefined;
      if (!out) return 0;
      if (out.kind === 'COUNT') return out.value;
      return out.kind === 'COINS' ? out.results.length : out.ids.length;
    }
    case 'REMAINING_HP': {
      const first = f.selector ? eligible(ctx, { ...f.selector, pick: { mode: 'ALL' } }, fc)[0] : undefined;
      return first ? remainingHp(ctx, first.entity) : 0;
    }
    case 'DISTINCT_ENERGY_TYPES': {
      const first = f.selector ? eligible(ctx, { ...f.selector, pick: { mode: 'ALL' } }, fc)[0] : undefined;
      return first ? new Set(first.entity.energies.map((e) => e.type)).size : 0;
    }
    case 'RETREAT_COST': {
      const first = f.selector ? eligible(ctx, { ...f.selector, pick: { mode: 'ALL' } }, fc)[0] : undefined;
      return first ? retreatCost(ctx, first.entity) ?? 0 : 0;
    }
    case 'OWN_TURN_NUMBER':
      return ctx.s.ownTurns[f.side === 'OPPONENT' ? other(fc.controller) : fc.controller];
    case 'ATTACKS_USED': {
      const log = ctx.s.players[fc.controller].attackLog ?? [];
      const mine = ctx.s.currentPlayer === fc.controller;
      const last = ctx.s.ownTurns[fc.controller] - (mine ? 1 : 0);
      return log.filter((e) => e.attackId === f.attackId && (f.window !== 'LAST_OWN_TURN' || e.ownTurn === last)).length;
    }
    case 'TOP_CARDS_MATCHING':
      return ctx.s.players[fc.controller].deck.slice(0, f.count ?? 1).filter((id) => matchesCardFilter(ctx, id, f.filter)).length;
    case 'EXTRA_ENERGY_UNITS':
      return eligible(ctx, { ...(f.selector ?? { scope: 'SELF' }), pick: { mode: 'ALL' } }, fc)
        .reduce((sum, l) => sum + extraEnergyUnits(providedUnits(ctx, l.entity), currentAttackCost(ctx, fc, l.entity.entityId), f.energyType), 0);
    case 'DAMAGE_DEALT_BY_ATTACK':
      return fc.damageDealtByAttack ?? 0;
    default: return 0;
  }
}

export function evaluateAmount(ctx: Readable, amount: number | Formula, fc: FormulaContext): number {
  return typeof amount === 'number' ? amount : evaluateFormula(ctx, amount, fc);
}

const compare = (a: number, cmp: Condition['cmp'], b: number): boolean => {
  switch (cmp) {
    case 'EQ': return a === b;
    case 'NE': return a !== b;
    case 'GT': return a > b;
    case 'GE': return a >= b;
    case 'LT': return a < b;
    case 'LE': return a <= b;
    default: return false;
  }
};

export function evaluateCondition(ctx: Readable, c: Condition, fc: FormulaContext): boolean {
  switch (c.op) {
    case 'ALL': return (c.conditions ?? []).every((x) => evaluateCondition(ctx, x, fc));
    case 'ANY': return (c.conditions ?? []).some((x) => evaluateCondition(ctx, x, fc));
    case 'NOT': return typeof c.condition === 'object' && c.condition !== null ? !evaluateCondition(ctx, c.condition, fc) : false;
    case 'COMPARE':
      return !!c.left && !!c.right && compare(evaluateFormula(ctx, c.left, fc), c.cmp, evaluateFormula(ctx, c.right, fc));
    case 'EXISTS':
      return !!c.selector && eligible(ctx, { ...c.selector, pick: { mode: 'ALL' } }, fc).length > 0;
    case 'CARDS_EXIST':
      return !!c.zone && zoneCards(ctx, c.zone, fc.controller).filter((id) => matchesCardFilter(ctx, id, c.filter)).length >= (c.count ?? 1);
    case 'SOURCE_POSITION': {
      const self = fc.selfEntityId ? locate(ctx.s, fc.selfEntityId) : null;
      return !!self && self.position === c.position;
    }
    case 'HAS_CONDITION': {
      if (!c.selector) return false;
      return eligible(ctx, { ...c.selector, pick: { mode: 'ALL' } }, fc).some((l) => {
        const k = l.entity.conditions;
        if (c.condition === 'ANY') return k.poisoned || k.burned || k.control !== null;
        if (c.condition === 'POISONED') return k.poisoned;
        if (c.condition === 'BURNED') return k.burned;
        return k.control === c.condition;
      });
    }
    case 'IS_TURN_OF':
      return (c.side === 'OPPONENT' ? other(fc.controller) : fc.controller) === ctx.s.currentPlayer;
    case 'STADIUM_IN_PLAY':
      return ctx.s.stadium !== null;
    case 'SUPPORTER_PLAYED_THIS_TURN':
      return ctx.s.currentPlayer === fc.controller && ctx.s.players[fc.controller].flags.supporterUsed;
    case 'KNOCKED_OUT_LAST_OPPONENT_TURN':
      return (ctx.s.players[fc.controller].koLog ?? []).some((k) => k.globalTurn === ctx.s.globalTurnNumber - 1 && k.cause === 'ATTACK'
        && ctx.s.cards[k.cardId] !== undefined && matchesCardFilter(ctx, k.cardId, c.filter));
    case 'OUTPUT_CARDS_MATCH': {
      const out = c.reference ? fc.outputs[c.reference] : undefined;
      return !!out && out.kind === 'CARDS' && out.ids.some((id) => matchesCardFilter(ctx, id, c.filter));
    }
    default: return false;
  }
}
