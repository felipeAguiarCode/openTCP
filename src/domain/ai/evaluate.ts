// Avaliação ponderada de estados (gameplay §25.3): pontos, ameaça de Nocaute nos dois sentidos com HP,
// dano e custos conhecidos, desenvolvimento de Energia, evolução, Banco, mão, condições e risco de entregar
// 2/3 pontos com ex/Mega. Escala: 100 ≈ um ponto de vitória com peso 1.
import type { AiProfile } from '../../content/types.ts';
import { entityDef, entitiesOf, type Ctx, type Located } from '../battle/core.ts';
import {
  canPay, collectStatics, damageModifier, effectiveAttackCost, knockoutPoints, maxHp, preventionsFor, providedUnits, retreatCost, type StaticEffect,
} from '../battle/derived.ts';
import { evaluateAmount } from '../battle/formula.ts';
import type { CatalogLookup, EffectOutput, MatchState, PlayerId, PokemonEntity } from '../battle/types.ts';
import { other } from '../battle/types.ts';
import type { Attack, EnergyType, PokemonCard } from '../cards/types.ts';
import { isPokemon } from '../cards/types.ts';
import { coverage, goalCost, stageValue, type EvoIndex } from './cards.ts';

type Readable = Pick<Ctx, 's' | 'cat'>;
type Weights = AiProfile['weights'];

export const WIN_VALUE = 100000;

/**
 * Termos de agressividade (campanha §14.1), por unidade de `weights.aggression`: bônus de ritmo de um ataque que
 * afetou o adversário (fixo + dano pelo HP e pelos pontos + pontos ganhos), penalidade do Ativo ocioso e da linha
 * que recuou no turno e terminou sem atacar (recuar é para atacar com o substituto).
 */
export const AGGRESSION = { tempoBase: 30, tempoDamage: 60, tempoKnockout: 40, idleActive: 25, retreatNoAttack: 60 } as const;

export type EvalOptions = {
  readonly me: PlayerId;
  /** Quem age a seguir no ponto avaliado: o adversário (fim do meu turno) ou eu (fim do turno dele). */
  readonly toMove: PlayerId;
  readonly weights: Weights;
  readonly evo: EvoIndex | null;
  /** Depuração: recebe cada termo somado à avaliação. */
  readonly trace?: (term: string, value: number) => void;
};

function coinOutputs(attack: Attack, heads: boolean): Record<string, EffectOutput> {
  const outputs: Record<string, EffectOutput> = {};
  for (const block of attack.effects) {
    const op = block.operation;
    if (op.type !== 'FLIP_COINS') continue;
    // Quantidade por fórmula (Celebi ex: uma moeda por Energia) é estimada como 2.
    const n = op.untilTails ? 2 : typeof op.count === 'number' ? op.count : op.count ? 2 : 1;
    const face: 'HEADS' | 'TAILS' = heads ? 'HEADS' : 'TAILS';
    const results: ('HEADS' | 'TAILS')[] = op.untilTails ? (heads ? ['HEADS', 'HEADS', 'TAILS'] : ['TAILS']) : Array.from({ length: n }, () => face);
    outputs[op.outputId] = { kind: 'COINS', results };
  }
  return outputs;
}

/** Dano esperado de um ataque contra um alvo (pipeline do motor: atacante → Fraqueza → defensor → prevenção). */
export function estimateAttack(r: Readable, statics: StaticEffect[], attacker: Located, attackerDef: PokemonCard, attack: Attack, defender: Located): number {
  if (!attack.damageTarget && !attack.effects.some((b) => b.operation.type === 'DEAL_DAMAGE')) return 0;
  let base = attack.baseDamage ?? 0;
  if (attack.damageFormula) {
    const fc = (heads: boolean) => ({
      controller: attacker.player, selfEntityId: attacker.entity.entityId, eventSourceEntityId: null,
      eventTargetEntityId: defender.entity.entityId, outputs: coinOutputs(attack, heads), targetEntityId: defender.entity.entityId,
      defendingEntityId: defender.entity.entityId,
      attackRef: { cardId: attacker.entity.stack[attacker.entity.stack.length - 1]!, attackId: attack.id },
    });
    try {
      base = (evaluateAmount(r, attack.damageFormula, fc(true)) + evaluateAmount(r, attack.damageFormula, fc(false))) / 2;
    } catch {
      base = 0;
    }
  }
  // ATTACK_FAILS: incondicional zera; condicionado (moeda) vale metade, em média.
  const fails = attack.effects.filter((b) => b.operation.type === 'ATTACK_FAILS');
  if (fails.length) base *= fails.some((b) => !b.condition) ? 0 : 0.5;
  const activeScope = (scope: string | undefined) => scope === 'OPPONENT_ACTIVE' || scope === 'DEFENDING';
  const hitsActive = !attack.damageTarget || activeScope(attack.damageTarget.scope);
  if (!hitsActive && defender.position === 'ACTIVE' && attack.damageTarget?.scope !== 'OPPONENT_POKEMON' && attack.damageTarget?.scope !== 'ALL_POKEMON') base = 0;
  // Dano extra fixo por efeito no Ativo adversário (sem moeda). Opcodes desconhecidos/novos (ATTACK_FAILS,
  // SHUFFLE_HAND_INTO_DECK…) não entram na estimativa: a avaliação é conservadora.
  for (const block of attack.effects) {
    const op = block.operation;
    if (op.type === 'DEAL_DAMAGE' && !block.condition && activeScope(op.target.scope) && typeof op.amount === 'number' && defender.position === 'ACTIVE') base += op.amount;
  }
  let amount = Math.max(0, base);
  const targetIsOpponentActive = defender.position === 'ACTIVE' && defender.player !== attacker.player;
  if (amount > 0) amount = Math.max(0, amount + damageModifier(r, attacker.entity.entityId, 'DAMAGE_DEALT', 'ATTACK', targetIsOpponentActive, statics));
  const targetDef = entityDef(r, defender.entity);
  if (amount > 0 && targetIsOpponentActive && isPokemon(targetDef) && targetDef.weakness && attackerDef.types.includes(targetDef.weakness.type)) {
    amount = targetDef.weakness.operation === 'ADD' ? amount + targetDef.weakness.value : amount * targetDef.weakness.value;
  }
  amount = Math.max(0, amount + damageModifier(r, defender.entity.entityId, 'DAMAGE_TAKEN', 'ATTACK', false, statics));
  for (const p of amount > 0 ? preventionsFor(r, defender.entity.entityId, 'ATTACK', statics) : []) {
    if (p.operation.type !== 'PREVENT_DAMAGE') continue;
    amount -= p.operation.amount === 'ALL' ? amount : Math.min(amount, p.operation.amount);
  }
  return Math.max(0, amount);
}

/** Melhor dano que `attacker` causa em `defender` com a Energia ligada (+ uma unidade extra opcional). */
export function bestDamage(r: Readable, statics: StaticEffect[], attacker: Located, defender: Located, extra: EnergyType | null, asDef?: PokemonCard): { damage: number; canAttack: boolean } {
  const def = asDef ?? entityDef(r, attacker.entity);
  if (!isPokemon(def)) return { damage: 0, canAttack: false };
  const units = providedUnits(r, attacker.entity, statics);
  if (extra) units.push({ id: 'ai-extra', type: extra, units: 1 });
  let damage = 0;
  let canAttack = false;
  for (const attack of def.attacks) {
    const cost = effectiveAttackCost(r, attacker.entity, attack.id, attack.energyCost, statics);
    if (!canPay(units, cost)) continue;
    canAttack = true;
    damage = Math.max(damage, estimateAttack(r, statics, attacker, def, attack, defender));
  }
  return { damage, canAttack };
}

function controlFactor(e: PokemonEntity, attackerMovesNext: boolean): number {
  const c = e.conditions.control;
  if (!c) return 1;
  if (c === 'PARALYZED') return attackerMovesNext ? 0 : 1;
  return 0.5; // Sono ou Confusão: metade das vezes.
}

function conditionPenalty(e: PokemonEntity): number {
  const c = e.conditions;
  let p = 0;
  if (c.poisoned) p += 10;
  if (c.burned) p += 14;
  if (c.control === 'ASLEEP') p += 16;
  else if (c.control === 'PARALYZED') p += 22;
  else if (c.control === 'CONFUSED') p += 12;
  return p;
}

/** Evoluções na mão que podem ser aplicadas no próximo turno a esta entidade. */
function handEvolutions(r: Readable, player: PlayerId, e: PokemonEntity): PokemonCard[] {
  const base = entityDef(r, e);
  const out: PokemonCard[] = [];
  for (const id of r.s.players[player].hand) {
    const def = r.cat.definition(r.s.cards[id]!.definitionKey);
    if (isPokemon(def) && def.stage !== 'BASIC' && def.evolvesFrom.includes(base.deckLimitKey)) out.push(def);
  }
  return out;
}

type Threat = { readonly damage: number; readonly ko: boolean };

function threat(r: Readable, statics: StaticEffect[], attacker: Located | undefined, defender: Located | undefined, extra: EnergyType | null, attackerMovesNext: boolean, evolutions: readonly PokemonCard[]): Threat {
  if (!attacker || !defender) return { damage: 0, ko: false };
  let damage = bestDamage(r, statics, attacker, defender, extra).damage;
  for (const evo of evolutions) damage = Math.max(damage, bestDamage(r, statics, attacker, defender, extra, evo).damage);
  damage *= attacker.position === 'ACTIVE' ? controlFactor(attacker.entity, attackerMovesNext) : 1;
  const remaining = Math.max(0, maxHp(r, defender.entity, statics) - defender.entity.damage);
  return { damage, ko: damage >= remaining && remaining > 0 };
}

/** Ameaça do substituto: se o Ativo cair antes de agir, o melhor do Banco é promovido e ataca no lugar. */
function replacementThreat(r: Readable, statics: StaticEffect[], side: readonly Located[], defender: Located | undefined, extra: EnergyType | null): Threat {
  let best: Threat = { damage: 0, ko: false };
  for (const l of side) {
    if (l.position !== 'BENCH') continue;
    const t = threat(r, statics, l, defender, extra, true, []);
    if (t.damage > best.damage) best = t;
  }
  return best;
}

/**
 * Ameaça de um reserva que o lado traz pelo Recuo no próprio turno (o Ativo paga o custo e não está Adormecido nem
 * Paralisado). Sem ela, Nocautear um Ativo fraco parecia pior que deixá-lo na frente só porque promovia o atacante
 * forte do Banco — que o adversário traria de qualquer forma.
 */
function switchInThreat(r: Readable, statics: StaticEffect[], side: readonly Located[], defender: Located | undefined, extra: EnergyType | null): Threat {
  const active = side.find((l) => l.position === 'ACTIVE');
  const control = active?.entity.conditions.control;
  if (!active || control === 'ASLEEP' || control === 'PARALYZED') return { damage: 0, ko: false };
  const cost = retreatCost(r, active.entity, statics);
  const units = providedUnits(r, active.entity, statics).reduce((sum, u) => sum + u.units, 0);
  if (cost === null || cost > units) return { damage: 0, ko: false };
  return replacementThreat(r, statics, side, defender, extra);
}

/** Dano sustentado por turno de um lado contra o Ativo do outro (Ativo pleno; Banco precisa trocar). */
function sideDamage(r: Readable, statics: StaticEffect[], attackers: readonly Located[], target: Located | undefined, extra: EnergyType | null, promoted = false): number {
  if (!target) return 0;
  let best = 0;
  let potential = 0;
  for (const l of attackers) {
    const def = entityDef(r, l.entity);
    if (!isPokemon(def)) continue;
    const hit = bestDamage(r, statics, l, target, extra);
    best = Math.max(best, hit.damage * (l.position === 'ACTIVE' ? controlFactor(l.entity, false) : promoted ? 1 : 0.75));
    for (const attack of def.attacks) potential = Math.max(potential, (attack.baseDamage ?? (attack.damageFormula ? 30 : 0)) * 0.5);
  }
  // Potencial de longo prazo como piso: um reserva fraco ficar pronto não pode derrubar a estimativa da corrida.
  return Math.max(best, potential);
}

/**
 * Corrida de Nocautes: quantos ataques um lado precisa para fechar os pontos que faltam (ou esvaziar o
 * campo adversário), Nocauteando primeiro o Ativo e depois os reservas mais resistentes.
 */
function hitsToWin(r: Readable, statics: StaticEffect[], defenders: readonly Located[], reserves: readonly number[], damage: number, pointsNeeded: number): number {
  if (pointsNeeded <= 0) return 0;
  if (damage <= 0) return 9;
  const remaining = (l: Located) => Math.max(1, maxHp(r, l.entity, statics) - l.entity.damage);
  const order = [...defenders.filter((l) => l.position === 'ACTIVE'), ...defenders.filter((l) => l.position === 'BENCH').sort((a, b) => remaining(b) - remaining(a))];
  let hits = 0;
  let points = 0;
  for (const l of order) {
    hits += Math.ceil(remaining(l) / damage);
    points += knockoutPoints(r, l.entity, statics);
    if (points >= pointsNeeded) return hits;
  }
  for (const hp of reserves) {
    hits += Math.ceil(hp / damage);
    points += 1;
    if (points >= pointsNeeded) return hits;
  }
  return hits;
}

function handBasicsHp(r: Readable, player: PlayerId, room: number): number[] {
  const out: number[] = [];
  for (const id of r.s.players[player].hand) {
    const def = r.cat.definition(r.s.cards[id]!.definitionKey);
    if (isPokemon(def) && def.stage === 'BASIC') out.push(def.baseHp);
  }
  return out.sort((a, b) => b - a).slice(0, Math.max(0, room));
}

/**
 * Peso efetivo dos pontos do adversário. O conteúdo publica `opponentPoints` como peso assinado sobre os
 * pontos dele (ex.: -3), e os perfis de referência como magnitude (1): ambos significam “ruim para a IA”.
 */
function opponentPointsWeight(w: Weights): number {
  return Math.abs(w.opponentPoints);
}

export function evaluate(state: MatchState, cat: CatalogLookup, opts: EvalOptions): number {
  const { me, weights: w } = opts;
  const op = other(me);
  if (state.result) {
    const turnBias = state.result.globalTurnNumber * 10;
    if (state.result.winner === me) return WIN_VALUE - turnBias;
    if (state.result.winner === op) return -WIN_VALUE + turnBias;
    return (state.players[me].points - state.players[op].points) * 50;
  }
  const r: Readable = { s: state, cat };
  const statics = collectStatics(r);
  const mine = entitiesOf(state, me);
  const theirs = entitiesOf(state, op);
  const P = state.players;
  const toWin = state.config.pointsToWin;
  let v = 0;
  let section = 'points';
  const mark = (name: string) => { if (opts.trace) opts.trace(section, v - sectionStart); section = name; sectionStart = v; };
  let sectionStart = 0;

  // Pontos.
  const opPointsWeight = opponentPointsWeight(w);
  v += w.points * 100 * P[me].points;
  v -= opPointsWeight * 100 * P[op].points;

  mark('damage');
  // Dano acumulado (proporcional ao HP e ao valor em pontos). Mesmo peso no Ativo e no Banco: dano não
  // some ao recuar, e pesos diferentes incentivariam trocas inúteis só para “esconder” dano.
  const hp = new Map<string, number>();
  const kp = new Map<string, number>();
  for (const l of [...mine, ...theirs]) {
    hp.set(l.entity.entityId, maxHp(r, l.entity, statics));
    kp.set(l.entity.entityId, knockoutPoints(r, l.entity, statics));
  }
  for (const l of theirs) {
    const frac = Math.min(1, l.entity.damage / Math.max(1, hp.get(l.entity.entityId)!));
    v += w.damageDealt * 25 * frac * kp.get(l.entity.entityId)!;
  }
  for (const l of mine) {
    const frac = Math.min(1, l.entity.damage / Math.max(1, hp.get(l.entity.entityId)!));
    v -= w.damageDealt * 18 * frac * kp.get(l.entity.entityId)!;
  }

  mark('threat');
  // Ameaças de Nocaute nos dois sentidos (quem age primeiro pesa mais).
  const myActive = mine.find((l) => l.position === 'ACTIVE');
  const opActive = theirs.find((l) => l.position === 'ACTIVE');
  const myBench = mine.filter((l) => l.position === 'BENCH').length;
  const opBench = theirs.filter((l) => l.position === 'BENCH').length;
  const iMoveFirst = opts.toMove === me;
  const myExtra = iMoveFirst && P[me].flags.manualEnergyUsed ? null : (P[me].energyZone.ready ?? P[me].energyZone.next);
  const opExtra = P[op].energyZone.ready ?? P[op].energyZone.next;
  let mineThreat = threat(r, statics, myActive, opActive, myExtra, iMoveFirst, myActive ? handEvolutions(r, me, myActive.entity) : []);
  let theirThreat = threat(r, statics, opActive, myActive, opExtra, !iMoveFirst, []);
  // No turno dele, o adversário pode recuar para um reserva que Nocauteia o meu Ativo.
  if (!iMoveFirst && !theirThreat.ko) {
    const switched = switchInThreat(r, statics, theirs, myActive, opExtra);
    if (switched.ko) theirThreat = switched;
  }
  // Quem age primeiro pode Nocautear o Ativo do outro antes que ele ataque: a ameaça de resposta passa ao substituto.
  let myAttackersLost = false;
  let opAttackersLost = false;
  if (!iMoveFirst && theirThreat.ko) { mineThreat = replacementThreat(r, statics, mine, opActive, myExtra); myAttackersLost = true; }
  if (iMoveFirst && mineThreat.ko) { theirThreat = replacementThreat(r, statics, theirs, myActive, opExtra); opAttackersLost = true; }
  const fMine = iMoveFirst ? 1 : 0.55;
  const fTheirs = iMoveFirst ? 0.55 : 1;
  if (opActive) {
    const gain = kp.get(opActive.entity.entityId)!;
    const remaining = Math.max(1, hp.get(opActive.entity.entityId)! - opActive.entity.damage);
    if (mineThreat.ko) {
      v += fMine * w.knockoutThreat * 35 * gain;
      if (P[me].points + gain >= toWin) v += fMine * w.knockoutThreat * 80;
      if (opBench === 0) v += fMine * w.knockoutThreat * 80;
    } else {
      v += fMine * w.knockoutThreat * 12 * Math.min(1, mineThreat.damage / remaining);
    }
  }
  if (myActive) {
    const loss = kp.get(myActive.entity.entityId)!;
    const remaining = Math.max(1, hp.get(myActive.entity.entityId)! - myActive.entity.damage);
    if (theirThreat.ko) {
      v -= fTheirs * (w.knockoutThreat * 35 * loss + w.preservePoints * 30 * (loss - 1));
      if (P[op].points + loss >= toWin) v -= fTheirs * w.preservePoints * 140;
      if (myBench === 0) v -= fTheirs * w.preservePoints * 160;
    } else {
      v -= fTheirs * w.knockoutThreat * 10 * Math.min(1, theirThreat.damage / remaining);
    }
  }
  mark('race');
  // Corrida: ataques que cada lado ainda precisa para vencer (quem age primeiro ganha meio turno).
  if (myActive && opActive) {
    const myDamage = sideDamage(r, statics, myAttackersLost ? mine.filter((l) => l.position === 'BENCH') : mine, opActive, myExtra, myAttackersLost);
    const opDamage = sideDamage(r, statics, opAttackersLost ? theirs.filter((l) => l.position === 'BENCH') : theirs, myActive, opExtra, opAttackersLost);
    const myRoom = state.players[me].bench.filter((b) => b === null).length;
    const tMe = hitsToWin(r, statics, theirs, [], myDamage, toWin - P[me].points) - (iMoveFirst ? 0.5 : 0);
    const tOp = hitsToWin(r, statics, mine, handBasicsHp(r, me, myRoom), opDamage, toWin - P[op].points) - (iMoveFirst ? 0 : 0.5);
    const diff = Math.max(-5, Math.min(5, tOp - tMe));
    v += ((Math.abs(w.points) + opPointsWeight) / 2) * 45 * diff;
  }
  mark('exposure');
  // ex/Mega expostos no Ativo pesam mais na preservação de pontos.
  if (myActive) {
    const loss = kp.get(myActive.entity.entityId)!;
    if (loss > 1) v -= w.preservePoints * 6 * (loss - 1) * Math.min(1, myActive.entity.damage / Math.max(1, hp.get(myActive.entity.entityId)!) + 0.3);
  }

  mark('energy');
  // Desenvolvimento de Energia: unidades que avançam o custo-alvo de cada Pokémon (as inúteis quase não contam).
  for (const l of mine) {
    const def = entityDef(r, l.entity);
    if (!isPokemon(def)) continue;
    const units = providedUnits(r, l.entity, statics);
    const cov = coverage(units, goalCost(def, opts.evo));
    const activeBoost = l.position === 'ACTIVE' ? 1.25 : 1;
    v += w.energyDevelopment * (cov.satisfied * 11 * activeBoost + Math.min(cov.excess, 2) * 1.5);
    if (l.position === 'ACTIVE' && def.attacks.some((a) => (a.baseDamage ?? 0) > 0 || a.damageFormula)
      && def.attacks.some((a) => canPay(units, effectiveAttackCost(r, l.entity, a.id, a.energyCost, statics)))) v += w.energyDevelopment * 8;
  }
  for (const l of theirs) {
    const def = entityDef(r, l.entity);
    if (!isPokemon(def)) continue;
    const cov = coverage(providedUnits(r, l.entity, statics), goalCost(def, null));
    v -= w.energyDevelopment * 4 * cov.satisfied;
  }

  mark('idle');
  // Agressividade: no fim do meu turno, um Ativo que não ataca nem com a próxima Energia é um turno perdido
  // (recuar para quem não ataca, Energia longe do Ativo).
  if (!iMoveFirst && myActive && opActive && !bestDamage(r, statics, myActive, opActive, myExtra).canAttack) v -= w.aggression * AGGRESSION.idleActive;

  mark('evolution');
  // Evolução (estágio atual e evoluções prontas na mão).
  for (const l of mine) {
    v += w.evolution * 22 * stageValue(entityDef(r, l.entity));
    if (handEvolutions(r, me, l.entity).length) v += w.evolution * 5;
  }
  for (const l of theirs) v -= w.evolution * 10 * stageValue(entityDef(r, l.entity));

  mark('bench');
  // Banco: o primeiro reserva evita derrota por ausência de Pokémon; os seguintes dão opções.
  v += w.benchDevelopment * (myBench === 0 ? -45 : 25 + 10 * (myBench - 1));
  v -= w.benchDevelopment * (opBench === 0 ? -25 : 5 * opBench);

  mark('hand');
  // Mão (opções futuras) — limitada para não incentivar acumular cartas.
  v += w.handSize * 3.5 * Math.min(P[me].hand.length, 8);

  mark('conditions');
  // Condições especiais nos Ativos.
  if (myActive) v -= w.conditions * conditionPenalty(myActive.entity);
  if (opActive) v += w.conditions * conditionPenalty(opActive.entity);

  mark('tools');
  // Ferramentas ligadas.
  v += 3 * mine.filter((l) => l.entity.toolCardId).length;
  mark('end');
  return v;
}

/**
 * Ritmo do ataque: bônus somado à linha que termina num ataque, proporcional ao que ele fez ao adversário
 * (dano pelo HP e pelos pontos em jogo, Nocautes, condição nova no Ativo). Ataque que não afeta o adversário
 * não ganha nada. `before` é o estado antes do ataque; `after`, o do fim do turno.
 */
export function attackTempo(before: MatchState, after: MatchState, cat: CatalogLookup, me: PlayerId, w: Weights): number {
  if (!w.aggression) return 0;
  const op = other(me);
  const r: Readable = { s: before, cat };
  const statics = collectStatics(r);
  const prev = new Map(entitiesOf(before, op).map((l) => [l.entity.entityId, l.entity]));
  let dealt = 0;
  for (const l of entitiesOf(after, op)) {
    const p = prev.get(l.entity.entityId);
    const delta = p ? l.entity.damage - p.damage : 0;
    if (p && delta > 0) dealt += Math.min(1, delta / Math.max(1, maxHp(r, p, statics))) * knockoutPoints(r, p, statics);
  }
  const gained = Math.max(0, after.players[me].points - before.players[me].points);
  const a = before.players[op].active;
  const b = after.players[op].active;
  const conditioned = !!a && !!b && a.entityId === b.entityId && conditionPenalty(b) > conditionPenalty(a);
  if (dealt <= 0 && gained <= 0 && !conditioned) return 0;
  return w.aggression * (AGGRESSION.tempoBase + AGGRESSION.tempoDamage * dealt + AGGRESSION.tempoKnockout * gained);
}

/**
 * No turno seguinte, o adversário Nocauteia o meu Ativo (direto ou recuando para um reserva) e os pontos dele
 * fecham a partida? É a única razão para recuar para um Pokémon que não ataca quando o Ativo pode atacar.
 */
export function activeLossDecides(state: MatchState, cat: CatalogLookup, me: PlayerId): boolean {
  const r: Readable = { s: state, cat };
  const op = other(me);
  const theirs = entitiesOf(state, op);
  const myActive = entitiesOf(state, me).find((l) => l.position === 'ACTIVE');
  const opActive = theirs.find((l) => l.position === 'ACTIVE');
  if (!myActive || !opActive) return false;
  const statics = collectStatics(r);
  const opExtra = state.players[op].energyZone.ready ?? state.players[op].energyZone.next;
  const ko = threat(r, statics, opActive, myActive, opExtra, true, []).ko || switchInThreat(r, statics, theirs, myActive, opExtra).ko;
  return ko && state.players[op].points + knockoutPoints(r, myActive.entity, statics) >= state.config.pointsToWin;
}

/** Potencial imediato do turno (para ordenar o feixe): o melhor ataque disponível agora. */
export function attackPotential(state: MatchState, cat: CatalogLookup, me: PlayerId, weights: Weights): number {
  const r: Readable = { s: state, cat };
  const p = state.players[me];
  const myActive = entitiesOf(state, me).find((l) => l.position === 'ACTIVE');
  const opActive = entitiesOf(state, other(me)).find((l) => l.position === 'ACTIVE');
  if (!myActive || !opActive) return 0;
  const statics = collectStatics(r);
  const extra = p.flags.manualEnergyUsed ? null : p.energyZone.ready;
  const hit = bestDamage(r, statics, myActive, opActive, extra);
  if (!hit.canAttack || hit.damage <= 0) return 0;
  const remaining = Math.max(1, maxHp(r, opActive.entity, statics) - opActive.entity.damage);
  if (hit.damage >= remaining) return weights.points * 90 * knockoutPoints(r, opActive.entity, statics);
  return weights.damageDealt * 20 * (hit.damage / remaining);
}
