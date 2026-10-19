// Respostas às decisões pendentes (SETUP, PROMOTE, SELECT_TARGETS, SELECT_CARDS, SELECT_ENERGY,
// CONFIRM_OPTIONAL, ORDER_TOP, SELECT_ATTACK). Trabalha só sobre a projeção autorizada (BattleView) e o
// catálogo; a resposta sempre respeita opções, quantidade e unicidade exigidas pelo validador do motor.
import type { AiProfile } from '../../content/types.ts';
import { canPay } from '../battle/derived.ts';
import type { CatalogLookup, PlayerId } from '../battle/types.ts';
import { other } from '../battle/types.ts';
import type { BattleView, CardRef, DecisionView, EntityView } from '../battle/views.ts';
import type { CardDefinition, EnergyType, Operation, PokemonCard } from '../cards/types.ts';
import { isPokemon } from '../cards/types.ts';
import { bestAttack, costTotal, coverage, goalCost, nominalDamage, safeDefinition, stageValue, type EvoIndex } from './cards.ts';

type Located = { readonly entity: EntityView; readonly owner: PlayerId };

function entities(view: BattleView, player: PlayerId): EntityView[] {
  const side = view.sides[player];
  return [side.active, ...side.bench].filter((e): e is EntityView => e !== null);
}

function locateEntity(view: BattleView, entityId: string): Located | null {
  for (const owner of ['A', 'B'] as const) {
    const entity = entities(view, owner).find((e) => e.entityId === entityId);
    if (entity) return { entity, owner };
  }
  return null;
}

function pokemonOf(cat: CatalogLookup, e: EntityView): PokemonCard | null {
  const def = safeDefinition(cat, e.top.definitionKey);
  return def && isPokemon(def) ? def : null;
}

function koPoints(cat: CatalogLookup, e: EntityView): number {
  return pokemonOf(cat, e)?.knockoutPoints ?? 1;
}

type Units = { type: EnergyType; units: number }[];

function unitsOf(e: EntityView, extra: string | null): Units {
  const units: Units = e.energies.map((u) => ({ type: u.type as EnergyType, units: u.units }));
  if (extra) units.push({ type: extra as EnergyType, units: 1 });
  return units;
}

/** Estimativa de dano na projeção (custos e modificadores nominais; Fraqueza aplicada). */
export function viewAttack(cat: CatalogLookup, attacker: EntityView, defender: EntityView | null, extra: string | null): { damage: number; canAttack: boolean } {
  const def = pokemonOf(cat, attacker);
  if (!def) return { damage: 0, canAttack: false };
  const units = unitsOf(attacker, extra);
  const target = defender ? pokemonOf(cat, defender) : null;
  let damage = 0;
  let canAttack = false;
  for (const attack of def.attacks) {
    if (!canPay(units, attack.energyCost)) continue;
    canAttack = true;
    let d = nominalDamage(attack);
    if (d > 0 && target?.weakness && def.types.includes(target.weakness.type)) {
      d = target.weakness.operation === 'ADD' ? d + target.weakness.value : d * target.weakness.value;
    }
    damage = Math.max(damage, d);
  }
  return { damage, canAttack };
}

function extraFor(view: BattleView, player: PlayerId): string | null {
  const zone = view.sides[player].energyZone;
  return zone.ready ?? zone.next;
}

function attackerValue(cat: CatalogLookup, view: BattleView, e: EntityView, me: PlayerId, evo: EvoIndex | null): number {
  const def = pokemonOf(cat, e);
  if (!def) return -50;
  const opActive = view.sides[other(me)].active;
  const now = viewAttack(cat, e, opActive, extraFor(view, me));
  const cov = coverage(e.energies, goalCost(def, evo));
  return (now.canAttack ? 60 : 0) + now.damage * 0.6 + cov.satisfied * 12 + e.remainingHp / 10;
}

function threatTo(cat: CatalogLookup, view: BattleView, target: EntityView, me: PlayerId): number {
  const opActive = view.sides[other(me)].active;
  if (!opActive) return 0;
  return viewAttack(cat, opActive, target, extraFor(view, other(me))).damage;
}

// ---------------------------------------------------------------- SETUP

function setupScore(def: PokemonCard, policy: AiProfile['setupPolicy'], evo: EvoIndex | null): number {
  const attack = bestAttack(def);
  const attackScore = attack ? nominalDamage(attack) - 15 * Math.max(0, costTotal(attack.energyCost) - 1) : 0;
  const isKey = def.ruleBox !== 'NONE' || (evo?.get(def.deckLimitKey)?.length ?? 0) > 0;
  switch (policy) {
    case 'HIGHEST_HP_ACTIVE': return def.baseHp * 10 + attackScore;
    case 'BEST_ATTACKER_ACTIVE': return attackScore * 10 + def.baseHp - (def.knockoutPoints - 1) * 150;
    case 'PROTECT_KEY_BASIC': return (isKey ? -10000 : 0) + def.baseHp * 5 + attackScore * 3 - (def.knockoutPoints - 1) * 300;
    default: return def.baseHp;
  }
}

function benchScore(def: PokemonCard, evo: EvoIndex | null): number {
  const hasEvolution = (evo?.get(def.deckLimitKey)?.length ?? 0) > 0;
  return (hasEvolution ? 100 : 0) + def.baseHp / 10;
}

function answerSetup(view: BattleView, d: DecisionView, cat: CatalogLookup, profile: AiProfile, evo: EvoIndex | null): string[] {
  const me = d.player;
  const refs = new Map((view.sides[me].hand ?? []).map((r) => [r.cardId, r] as const));
  const options = (d.options ?? []).map((id, index) => {
    const ref = refs.get(id);
    const def = ref ? safeDefinition(cat, ref.definitionKey) : null;
    return { id, index, def: def && isPokemon(def) ? def : null };
  });
  if (options.length === 0) return [];
  const ranked = [...options].sort((a, b) => {
    const sa = a.def ? setupScore(a.def, profile.setupPolicy, evo) : -1e9;
    const sb = b.def ? setupScore(b.def, profile.setupPolicy, evo) : -1e9;
    return sb - sa || a.index - b.index;
  });
  const active = ranked[0]!;
  const slots = view.sides[me].bench.length || 3;
  const bench = options.filter((o) => o.id !== active.id)
    .sort((a, b) => (b.def ? benchScore(b.def, evo) : 0) - (a.def ? benchScore(a.def, evo) : 0) || a.index - b.index)
    .slice(0, slots);
  return [active.id, ...bench.map((o) => o.id)];
}

// ---------------------------------------------------------------- PROMOTE / troca

function promotionScore(cat: CatalogLookup, view: BattleView, e: EntityView, me: PlayerId, policy: AiProfile['promotionPolicy'], evo: EvoIndex | null): number {
  const kp = koPoints(cat, e);
  const threatened = threatTo(cat, view, e, me) >= e.remainingHp;
  const attacker = attackerValue(cat, view, e, me, evo);
  switch (policy) {
    case 'BEST_ATTACKER': return attacker - (threatened ? 25 * kp : 0);
    case 'HIGHEST_HP': return e.remainingHp * 2 + attacker * 0.2;
    case 'LOWEST_POINTS_RISK': return (threatened ? -120 * kp : 0) - kp * 15 + e.remainingHp / 5 + attacker * 0.3;
    default: return attacker;
  }
}

// ---------------------------------------------------------------- SELECT_TARGETS

const HARMFUL = new Set([
  'ATTACK_TARGET', 'DEAL_DAMAGE', 'APPLY_CONDITION', 'DISCARD_ENERGY', 'RETURN_TO_HAND', 'SHUFFLE_INTO_DECK', 'DISCARD_POKEMON',
  'KNOCK_OUT', 'SCHEDULE_DELAYED', 'REMOVE_TOOL', 'SUPPRESS_ABILITIES', 'RESTRICT_ACTION', 'MOVE_ENERGY_FROM',
]);

function harmScore(cat: CatalogLookup, view: BattleView, target: Located, me: PlayerId, reason: string, policy: AiProfile['targetPolicy']): number {
  const e = target.entity;
  const kp = koPoints(cat, e);
  const myActive = view.sides[me].active;
  const damaging = reason === 'ATTACK_TARGET' || reason === 'DEAL_DAMAGE';
  const dmg = damaging ? (reason === 'ATTACK_TARGET' && myActive ? Math.max(10, viewAttack(cat, myActive, e.position === 'ACTIVE' ? e : null, null).damage) : 20) : 0;
  const ko = damaging && dmg >= e.remainingHp;
  const energy = e.energies.reduce((sum, u) => sum + u.units, 0);
  const def = pokemonOf(cat, e);
  if (!damaging) {
    // Efeitos sem dano: atinge o que mais custa ao adversário (Energia, pontos, evolução, posição Ativa).
    return energy * 20 + kp * 30 + (def ? stageValue(def) * 10 : 0) + (e.position === 'ACTIVE' ? 15 : 0) + (def?.abilities.length ?? 0) * 10;
  }
  switch (policy) {
    case 'MAX_DAMAGE': return dmg * 2 + kp * 5 + (ko ? 40 : 0);
    case 'PREFER_KNOCKOUT': return (ko ? 1000 + kp * 100 : 0) + (dmg / Math.max(1, e.remainingHp)) * 50 + kp * 10;
    case 'PREFER_HIGH_POINTS': return kp * 200 + (ko ? 300 : 0) - e.remainingHp / 10;
    case 'PREFER_SUPPORT_ROLE': return (e.position === 'BENCH' ? 50 : 0) + (def?.abilities.length ?? 0) * 80 + energy * 10 + (ko ? 300 : 0);
    default: return dmg;
  }
}

function needScore(cat: CatalogLookup, e: EntityView, evo: EvoIndex | null): number {
  const def = pokemonOf(cat, e);
  if (!def) return -100;
  const cov = coverage(e.energies, goalCost(def, evo));
  const missing = cov.total - cov.satisfied;
  return (missing > 0 ? missing * 10 + (missing === 1 ? 30 : 0) : -10) + (e.position === 'ACTIVE' ? 15 : 0);
}

function benefitScore(cat: CatalogLookup, view: BattleView, target: Located, me: PlayerId, reason: string, evo: EvoIndex | null): number {
  const e = target.entity;
  const active = e.position === 'ACTIVE' ? 1 : 0;
  switch (reason) {
    case 'HEAL_DAMAGE': return e.damage * 2 + active * 15 + koPoints(cat, e) * 5;
    case 'REMOVE_CONDITION': return (e.conditions.poisoned || e.conditions.burned || e.conditions.control ? 100 : 0) + active * 20;
    case 'ATTACH_ENERGY':
    case 'MOVE_ENERGY_TO': return needScore(cat, e, evo);
    case 'EVOLVE_TARGET': return active * 30 + e.remainingHp / 10;
    case 'SWITCH_ACTIVE': return promotionScore(cat, view, e, me, 'BEST_ATTACKER', evo);
    default: return active * 30 + koPoints(cat, e) * 10 + e.energies.length * 5;
  }
}

function answerTargets(view: BattleView, d: DecisionView, cat: CatalogLookup, profile: AiProfile, evo: EvoIndex | null): string[] {
  const me = d.player;
  const options = d.options ?? [];
  const located = options.map((id, index) => ({ id, index, loc: locateEntity(view, id) }));
  const reason = d.reason;
  let harmful = HARMFUL.has(reason);
  if (reason === 'MODIFY' || reason === 'PREVENT_DAMAGE' || reason === 'PREVENT_EFFECTS') harmful = false;
  const scoreOf = (o: (typeof located)[number]): number => {
    if (!o.loc) return 0;
    const mine = o.loc.owner === me;
    if (reason === 'SWITCH_ACTIVE') {
      if (mine) return benefitScore(cat, view, o.loc, me, reason, evo);
      // Puxar um adversário: preferir o que pode ser Nocauteado agora, depois o de mais pontos e o que não ataca.
      const myActive = view.sides[me].active;
      const dmg = myActive ? viewAttack(cat, myActive, o.loc.entity, null).damage : 0;
      const kp = koPoints(cat, o.loc.entity);
      const stuck = viewAttack(cat, o.loc.entity, myActive, extraFor(view, other(me))).canAttack ? 0 : 25;
      return (dmg >= o.loc.entity.remainingHp ? 1000 + kp * 100 : 0) + kp * 30 + stuck + (o.loc.entity.retreatCost ?? 0) * 5;
    }
    if (reason === 'COPY_ATTACK_SOURCE') return viewAttack(cat, o.loc.entity, view.sides[other(me)].active, '').damage;
    if (harmful) {
      if (mine) {
        const e = o.loc.entity;
        const def = pokemonOf(cat, e);
        return -(koPoints(cat, e) * 50 + e.energies.length * 10 + (def ? stageValue(def) * 20 : 0) + (e.position === 'ACTIVE' ? 30 : 0)) + e.remainingHp / 10;
      }
      return harmScore(cat, view, o.loc, me, reason, profile.targetPolicy);
    }
    const benefit = benefitScore(cat, view, o.loc, me, reason, evo);
    return mine ? benefit : -benefit;
  };
  const ranked = [...located].sort((a, b) => scoreOf(b) - scoreOf(a) || a.index - b.index);
  const allMine = located.every((o) => o.loc?.owner === me);
  const allTheirs = located.every((o) => o.loc && o.loc.owner !== me);
  const wantMany = reason === 'SWITCH_ACTIVE' ? false : harmful ? allTheirs : allMine;
  const count = wantMany ? d.max : d.min;
  return ranked.slice(0, Math.max(count, d.min)).map((o) => o.id);
}

// ---------------------------------------------------------------- SELECT_CARDS

function knownCards(view: BattleView): Map<string, CardRef> {
  const map = new Map<string, CardRef>();
  for (const player of ['A', 'B'] as const) {
    const side = view.sides[player];
    for (const r of side.hand ?? []) map.set(r.cardId, r);
    for (const r of side.discard) map.set(r.cardId, r);
    for (const e of entities(view, player)) for (const r of e.stack) map.set(r.cardId, r);
  }
  return map;
}

function cardValue(cat: CatalogLookup, view: BattleView, def: CardDefinition | null, me: PlayerId): number {
  if (!def) return 0;
  const field = entities(view, me);
  const benchRoom = view.sides[me].bench.some((b) => b === null);
  if (isPokemon(def)) {
    if (def.stage === 'BASIC') return 30 + (benchRoom ? 20 : -15) + def.baseHp / 20;
    const target = field.some((e) => {
      const base = safeDefinition(cat, e.top.definitionKey);
      return base && def.evolvesFrom.includes(base.deckLimitKey);
    });
    return (target ? 60 : 15) + stageValue(def) * 5;
  }
  switch (def.subtype) {
    case 'SUPPORTER': return 25 + (view.sides[me].flags.supporterUsed ? 0 : 10);
    case 'ITEM': return 20;
    case 'TOOL': return 15;
    default: return 10;
  }
}

function answerCards(view: BattleView, d: DecisionView, cat: CatalogLookup): string[] {
  const me = d.player;
  const known = knownCards(view);
  const own = new Set([...(view.sides[me].hand ?? []), ...view.sides[me].discard].map((r) => r.cardId));
  const options = (d.options ?? []).map((id, index) => {
    const ref = known.get(id);
    return { id, index, mine: own.has(id), value: cardValue(cat, view, ref ? safeDefinition(cat, ref.definitionKey) : null, me) };
  });
  const losing = d.reason === 'DISCARD_CARDS';
  const ownLoss = losing && options.every((o) => o.mine);
  const ranked = [...options].sort((a, b) => (ownLoss ? a.value - b.value : b.value - a.value) || a.index - b.index);
  const count = ownLoss ? d.min : d.max;
  return ranked.slice(0, Math.max(count, d.min)).map((o) => o.id);
}

// ---------------------------------------------------------------- SELECT_ENERGY

function answerEnergy(view: BattleView, d: DecisionView, cat: CatalogLookup, evo: EvoIndex | null): string[] {
  const me = d.player;
  const options = d.options ?? [];
  let holder: Located | null = null;
  for (const owner of ['A', 'B'] as const) {
    for (const e of entities(view, owner)) if (e.energies.some((u) => options.includes(u.id))) holder = { entity: e, owner };
  }
  const def = holder ? pokemonOf(cat, holder.entity) : null;
  const cost = def ? goalCost(def, holder?.owner === me ? evo : null) : {};
  const typeOf = new Map(holder ? holder.entity.energies.map((u) => [u.id, u.type] as const) : []);
  // Necessidade de cada unidade: tipos exigidos especificamente pelo custo-alvo valem mais.
  const need = (id: string) => {
    const type = typeOf.get(id);
    return type && (cost as Record<string, number | undefined>)[type] ? 2 : costTotal(cost) > 0 ? 1 : 0;
  };
  const mine = !holder || holder.owner === me;
  const ranked = options.map((id, index) => ({ id, index })).sort((a, b) => (mine ? need(a.id) - need(b.id) : need(b.id) - need(a.id)) || a.index - b.index);
  const count = mine ? d.min : d.max;
  return ranked.slice(0, Math.max(count, d.min)).map((o) => o.id);
}

// ---------------------------------------------------------------- CONFIRM_OPTIONAL / SELECT_ATTACK

function findBlockOperation(view: BattleView, cat: CatalogLookup, blockId: string): Operation | null {
  const keys = new Set<string>();
  for (const r of knownCards(view).values()) keys.add(r.definitionKey);
  if (view.stadium) keys.add(view.stadium.definitionKey);
  for (const key of keys) {
    const def = safeDefinition(cat, key);
    if (!def) continue;
    const blocks = [...def.attacks.flatMap((a) => a.effects), ...def.abilities.flatMap((a) => a.effects), ...(def.category === 'TRAINER' ? def.trainerEffects : [])];
    const block = blocks.find((b) => b.id === blockId);
    if (block) return block.operation;
  }
  return null;
}

function selfHarmful(op: Operation): boolean {
  const ownScope = (scope: string) => scope === 'SELF' || scope.startsWith('OWN_');
  switch (op.type) {
    case 'DISCARD_ENERGY':
    case 'DEAL_DAMAGE':
    case 'APPLY_CONDITION':
    case 'KNOCK_OUT':
    case 'DISCARD_POKEMON':
    case 'RETURN_TO_HAND':
    case 'SHUFFLE_INTO_DECK':
      return ownScope(op.target.scope);
    case 'DISCARD_CARDS': return op.zone === 'OWN_HAND' || op.zone === 'OWN_DECK_TOP';
    case 'DRAW_CARDS': return op.player === 'OPPONENT';
    default: return false;
  }
}

function answerOptional(view: BattleView, d: DecisionView, cat: CatalogLookup): string[] {
  const options = d.options ?? [];
  const op = findBlockOperation(view, cat, d.reason);
  let yes = true;
  if (op && selfHarmful(op)) yes = false;
  if (op && op.type === 'SWITCH_ACTIVE' && op.side === 'OWN') {
    const active = view.sides[d.player].active;
    yes = !!active && (active.damage * 2 >= active.maxHp || !!active.conditions.control || active.conditions.poisoned || active.conditions.burned);
  }
  const wanted = yes ? 'YES' : 'NO';
  return [options.includes(wanted) ? wanted : options[0]!].filter(Boolean);
}

function answerAttack(view: BattleView, d: DecisionView, cat: CatalogLookup): string[] {
  const me = d.player;
  const opActive = view.sides[other(me)].active;
  const target = opActive ? pokemonOf(cat, opActive) : null;
  let best: { id: string; score: number } | null = null;
  for (const id of d.options ?? []) {
    const [entityId, attackId] = id.split(':');
    const source = entityId ? locateEntity(view, entityId) : null;
    const def = source ? pokemonOf(cat, source.entity) : null;
    const attack = def?.attacks.find((a) => a.id === attackId);
    let score = attack ? nominalDamage(attack) : 0;
    if (def && target?.weakness && def.types.includes(target.weakness.type) && score > 0) score += target.weakness.value;
    if (opActive && score >= opActive.remainingHp) score += 1000;
    if (!best || score > best.score) best = { id, score };
  }
  return best ? [best.id] : [];
}

// ---------------------------------------------------------------- API

/** Normaliza qualquer escolha para uma resposta aceita pelo validador (subconjunto, sem repetição, quantidade). */
export function ensureValidSelection(d: DecisionView, wanted: readonly string[], benchSlots = 3): string[] {
  const options = d.options ?? [];
  if (d.kind === 'ORDER_TOP') {
    const ordered = [...new Set(wanted.filter((id) => options.includes(id)))];
    for (const id of options) if (!ordered.includes(id)) ordered.push(id);
    return ordered;
  }
  const min = d.kind === 'SETUP' ? 1 : d.min;
  const max = d.kind === 'SETUP' ? 1 + benchSlots : d.max;
  const out = [...new Set(wanted.filter((id) => options.includes(id)))].slice(0, max);
  for (const id of options) {
    if (out.length >= min) break;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

export function answerDecision(view: BattleView, d: DecisionView, cat: CatalogLookup, profile: AiProfile, evo: EvoIndex | null): string[] {
  if (!d.options) throw new Error(`AI_DECISION_HIDDEN: opções de ${d.decisionId} não visíveis para ${view.viewer}`);
  let wanted: string[];
  switch (d.kind) {
    case 'SETUP': wanted = answerSetup(view, d, cat, profile, evo); break;
    case 'PROMOTE': {
      const ranked = d.options.map((id, index) => ({ id, index, loc: locateEntity(view, id) }))
        .sort((a, b) => (b.loc ? promotionScore(cat, view, b.loc.entity, d.player, profile.promotionPolicy, evo) : -1e9)
          - (a.loc ? promotionScore(cat, view, a.loc.entity, d.player, profile.promotionPolicy, evo) : -1e9) || a.index - b.index);
      wanted = ranked.slice(0, Math.max(1, d.min)).map((o) => o.id);
      break;
    }
    case 'SELECT_TARGETS': wanted = answerTargets(view, d, cat, profile, evo); break;
    case 'SELECT_CARDS': wanted = answerCards(view, d, cat); break;
    case 'SELECT_ENERGY': wanted = answerEnergy(view, d, cat, evo); break;
    case 'CONFIRM_OPTIONAL': wanted = answerOptional(view, d, cat); break;
    case 'SELECT_ATTACK': wanted = answerAttack(view, d, cat); break;
    case 'ORDER_TOP': wanted = [...d.options]; break;
    default: wanted = [];
  }
  return ensureValidSelection(d, wanted, view.sides[d.player].bench.length || 3);
}
