// Poda e ordenação de candidatos dentro da busca do turno. A raiz sempre considera todas as ações
// legais da observação; nos nós internos, variações claramente redundantes (pagamentos de Recuo
// equivalentes, Energia em quem não pode usá-la, Ferramenta em cada Pokémon) são cortadas.
import { entityDef, type Ctx } from '../battle/core.ts';
import { collectStatics, maxHp, providedUnits, type StaticEffect } from '../battle/derived.ts';
import type { Action, CatalogLookup, MatchState, PlayerId, PokemonEntity } from '../battle/types.ts';
import { other } from '../battle/types.ts';
import { isPokemon, type EnergyType } from '../cards/types.ts';
import { coverage, goalCost, type EvoIndex } from './cards.ts';
import { activeLossDecides, bestDamage } from './evaluate.ts';

type Readable = Pick<Ctx, 's' | 'cat'>;

const ORDER: Record<Action['type'], number> = {
  ATTACK: 0, PLAY_TRAINER: 2, PLAY_BASIC: 3, EVOLVE: 4, ATTACH_ENERGY: 5, USE_ABILITY: 6, RETREAT: 8, DISCARD_FOSSIL: 9,
  END_TURN: 10, RESOLVE_DECISION: 11, CONCEDE: 12,
};

function find(state: MatchState, player: PlayerId, entityId: string): { entity: PokemonEntity; active: boolean } | null {
  const p = state.players[player];
  if (p.active?.entityId === entityId) return { entity: p.active, active: true };
  const bench = p.bench.find((e) => e?.entityId === entityId);
  return bench ? { entity: bench, active: false } : null;
}

function energyNeed(r: Readable, statics: StaticEffect[], entity: PokemonEntity, active: boolean, type: EnergyType, evo: EvoIndex | null): number {
  const def = entityDef(r, entity);
  if (!isPokemon(def)) return -100;
  const units = providedUnits(r, entity, statics);
  const cost = goalCost(def, evo);
  const before = coverage(units, cost);
  const after = coverage([...units, { type, units: 1 }], cost);
  const gain = after.satisfied - before.satisfied;
  const completes = gain > 0 && after.satisfied >= after.total;
  return gain * 20 + (completes ? 25 : 0) + (active ? 8 : 0) - (gain > 0 ? 0 : 30);
}

function retreatLoss(r: Readable, entity: PokemonEntity, energyIds: readonly string[], evo: EvoIndex | null): number {
  const def = entityDef(r, entity);
  const cost = isPokemon(def) ? goalCost(def, evo) : {};
  return energyIds.reduce((sum, id) => {
    const unit = entity.energies.find((e) => e.id === id);
    return sum + (unit && (cost as Record<string, number | undefined>)[unit.type] ? 2 : 1);
  }, 0);
}

/**
 * Recuo passivo (gameplay §25.3, agressividade): com ataque disponível, recuar para um Pokémon que não ataca neste
 * turno (nem com a Energia da zona, se ainda não foi ligada). Fica fora da busca, salvo quando o Nocaute do Ativo
 * entregaria a partida ao adversário. Recuar para quem ataca continua livre.
 */
export function isPassiveRetreat(state: MatchState, cat: CatalogLookup, me: PlayerId, action: Action, legal: readonly Action[]): boolean {
  if (action.type !== 'RETREAT' || !legal.some((a) => a.type === 'ATTACK')) return false;
  const p = state.players[me];
  const sub = p.bench[action.benchIndex];
  const opActive = state.players[other(me)].active;
  if (!sub || !opActive) return false;
  const r: Readable = { s: state, cat };
  const hit = bestDamage(r, collectStatics(r), { entity: sub, player: me, position: 'ACTIVE', benchIndex: null },
    { entity: opActive, player: other(me), position: 'ACTIVE', benchIndex: null }, p.flags.manualEnergyUsed ? null : p.energyZone.ready);
  return !hit.canAttack && !activeLossDecides(state, cat, me);
}

/** Candidatos de um nó interno (sem END_TURN, tratado como folha), já ordenados por prioridade. */
export function searchCandidates(state: MatchState, cat: Readable['cat'], me: PlayerId, legal: readonly Action[], evo: EvoIndex | null): Action[] {
  const r: Readable = { s: state, cat };
  const statics = collectStatics(r);
  const p = state.players[me];
  const out: Action[] = [];
  const ready = p.energyZone.ready;
  const attach = legal.filter((a): a is Extract<Action, { type: 'ATTACH_ENERGY' }> => a.type === 'ATTACH_ENERGY');
  if (attach.length && ready) {
    const scored = attach.map((a) => {
      const loc = find(state, me, a.targetEntityId);
      return { a, score: loc ? energyNeed(r, statics, loc.entity, loc.active, ready, evo) : -1000 };
    }).sort((x, y) => y.score - x.score);
    const useful = scored.filter((x) => x.score > 0).slice(0, 2);
    out.push(...(useful.length ? useful : scored.slice(0, 1)).map((x) => x.a));
  }
  const retreats = legal.filter((a): a is Extract<Action, { type: 'RETREAT' }> => a.type === 'RETREAT' && !isPassiveRetreat(state, cat, me, a, legal));
  if (retreats.length && p.active) {
    const active = p.active;
    const opActive = state.players[other(me)].active;
    const byBench = new Map<number, Extract<Action, { type: 'RETREAT' }>>();
    for (const a of retreats) {
      const prev = byBench.get(a.benchIndex);
      if (!prev || retreatLoss(r, active, a.energyIds, evo) < retreatLoss(r, active, prev.energyIds, evo)) byBench.set(a.benchIndex, a);
    }
    const value = (e: PokemonEntity, isActive: boolean) => {
      if (!opActive) return 0;
      const loc = { entity: e, player: me, position: isActive ? 'ACTIVE' as const : 'BENCH' as const, benchIndex: null };
      const opLoc = { entity: opActive, player: other(me), position: 'ACTIVE' as const, benchIndex: null };
      const hit = bestDamage(r, statics, loc, opLoc, p.flags.manualEnergyUsed ? null : ready);
      return (hit.canAttack ? 50 : 0) + hit.damage;
    };
    const current = value(active, true);
    const options = [...byBench.values()]
      .map((a) => ({ a, v: value(p.bench[a.benchIndex]!, false) }))
      .filter((x) => x.v > current || active.conditions.poisoned || active.conditions.burned || active.conditions.control === 'CONFUSED'
        || active.damage * 2 >= maxHp(r, active, statics))
      .sort((x, y) => y.v - x.v)
      .slice(0, 2);
    out.push(...options.map((x) => x.a));
  }
  const tools = new Map<string, Extract<Action, { type: 'PLAY_TRAINER' }>[]>();
  for (const a of legal) {
    if (a.type === 'ATTACH_ENERGY' || a.type === 'RETREAT' || a.type === 'END_TURN' || a.type === 'CONCEDE') continue;
    if (a.type === 'PLAY_TRAINER' && a.targetEntityId) {
      const list = tools.get(a.cardId) ?? [];
      list.push(a);
      tools.set(a.cardId, list);
      continue;
    }
    out.push(a);
  }
  for (const list of tools.values()) {
    const active = list.find((a) => a.targetEntityId === p.active?.entityId);
    out.push(...(active ? [active] : list.slice(0, 1)));
  }
  return out.map((a, i) => ({ a, i })).sort((x, y) => ORDER[x.a.type] - ORDER[y.a.type] || x.i - y.i).map((x) => x.a);
}
