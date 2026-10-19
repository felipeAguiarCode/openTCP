// Registro de opcodes executáveis (efeitos-dsl.md §9). Cada executor coleta primeiro todas as escolhas
// (decisões e sorteios ficam em `task.choices`) e só então altera o estado, para que a retomada de uma
// decisão nunca repita efeitos nem consuma RNG duas vezes.
import type { CardFilter, EnergyType, Operation, Selector, SpecialCondition } from '../cards/types.ts';
import { CONDITIONS, ENERGY_TYPES, isPokemon } from '../cards/types.ts';
import { operationText } from '../cards/text.ts';
import {
  cardDef, drawCards, emit, entitiesOf, entityDef, firstFreeBench, locate, newEntity, nextId, randomIndex,
  removeFromArray, shuffleDeck, coin, type Ctx, type Located,
} from './core.ts';
import { canPay, collectStatics, effectiveAttackCost, effectsPreventedFor, isRestricted, maxHp, providedUnits, staticsOn } from './derived.ts';
import { evaluateAmount, evaluateCondition, type FormulaContext } from './formula.ts';
import {
  applyCondition, applyDamage, attachEnergyUnits, clearConditions, detachEntity, discardEnergyUnits, discardFromHand,
  heal, routeEntityCards, swapActive,
} from './mutations.ts';
import { eligible, matchesCardFilter, matchesPokemonFilter, type SelectorContext } from './selectors.ts';
import type { ActiveEffect, Choices, DecisionKind, EnergyUnit, Frame, PlayerId, Task } from './types.ts';
import { other } from './types.ts';

export type StepResult = 'DONE' | 'SUSPEND';
export const OPCODES = [
  'FLIP_COINS', 'DEAL_DAMAGE', 'HEAL_DAMAGE', 'APPLY_CONDITION', 'REMOVE_CONDITION', 'DRAW_CARDS', 'SEARCH_DECK',
  'ATTACH_ENERGY', 'MOVE_ENERGY', 'DISCARD_ENERGY', 'SWITCH_ACTIVE', 'EVOLVE', 'MODIFY', 'PREVENT_DAMAGE', 'PREVENT_EFFECTS',
  'RESTRICT_ACTION', 'SUPPRESS_ABILITIES', 'DISCARD_CARDS', 'RETURN_TO_HAND', 'SHUFFLE_INTO_DECK', 'DISCARD_POKEMON',
  'KNOCK_OUT', 'PUT_ON_BENCH', 'RECOVER_FROM_DISCARD', 'LOOK_AT_TOP', 'SHUFFLE_DECK', 'REVEAL_HAND', 'SCHEDULE_DELAYED',
  'COPY_ATTACK', 'CONDITIONAL', 'REMOVE_TOOL', 'END_TURN', 'ATTACK_FAILS', 'SHUFFLE_HAND_INTO_DECK',
  'MOVE_DAMAGE', 'SET_REMAINING_HP', 'DEVOLVE', 'RETURN_CARDS_TO_DECK', 'CHANGE_ENERGY_TYPE', 'SET_NEXT_ENERGY', 'REVEAL_TOP_TAKE',
  'REVEAL_CARDS', 'SWAP_HAND_WITH_DECK', 'CHOOSE_ONE', 'FORCE_COIN', 'COPY_TRAINER', 'MOVE_ENERGY_FREELY',
  'PREVENT_CONDITIONS', 'PREVENT_HEALING', 'ATTACK_COIN_GATE', 'COUNTER_DAMAGE', 'GRANT_RULE', 'SURVIVE_KNOCKOUT', 'REROLL_COINS',
] as const;
export const CONTINUOUS_OPCODES = new Set([
  'MODIFY', 'PREVENT_DAMAGE', 'PREVENT_EFFECTS', 'RESTRICT_ACTION', 'SUPPRESS_ABILITIES', 'PREVENT_CONDITIONS', 'PREVENT_HEALING',
  'ATTACK_COIN_GATE', 'COUNTER_DAMAGE', 'GRANT_RULE', 'SURVIVE_KNOCKOUT', 'REROLL_COINS',
]);
/** Ações restringíveis que pertencem ao jogador (não a um Pokémon): não são “efeito feito ao Pokémon”. */
const PLAYER_ACTIONS = new Set<string>(['PLAY_ITEM', 'PLAY_SUPPORTER', 'MANUAL_ENERGY']);

export function frameSelectorContext(frame: Frame): SelectorContext & FormulaContext {
  const attack = frame.sourceKind === 'ATTACK';
  return {
    controller: frame.controller,
    selfEntityId: frame.sourceEntityId,
    eventSourceEntityId: frame.eventSourceEntityId,
    eventTargetEntityId: frame.eventTargetEntityId,
    outputs: frame.outputs,
    targetEntityId: frame.attackTargetEntityId,
    defendingEntityId: attack ? frame.attackTargetEntityId : null,
    attackRef: attack && frame.attackId ? { cardId: frame.sourceCardId, attackId: frame.attackId } : null,
    damageDealtByAttack: frame.damageDealtByAttack,
  };
}

/**
 * PREVENT_EFFECTS (efeitos-dsl.md §9): efeitos (não dano) de um ataque não alcançam Pokémon do oponente do
 * atacante protegidos contra ele. Vale para qualquer opcode de um frame de ataque, inclusive ataque copiado.
 */
export function attackShield(ctx: Pick<Ctx, 's' | 'cat'>, frame: Frame): (entityId: string) => boolean {
  if (frame.sourceKind !== 'ATTACK') return () => false;
  let statics: ReturnType<typeof collectStatics> | null = null;
  return (entityId) => {
    const located = locate(ctx.s, entityId);
    if (!located || located.player === frame.controller) return false;
    statics ??= collectStatics(ctx);
    return effectsPreventedFor(ctx, entityId, frame.controller, statics);
  };
}

export function requestDecision(
  ctx: Ctx, task: { choices: Choices }, key: string, player: PlayerId, kind: DecisionKind, reason: string,
  options: readonly string[], min: number, max: number, group: string | null = null, labels?: Readonly<Record<string, string>>,
): 'SUSPEND' {
  if (ctx.s.pendingDecisions.some((d) => d.choiceKey === key && d.player === player)) return 'SUSPEND';
  const decisionId = nextId(ctx, 'decision', 'decision');
  ctx.s.pendingDecisions.push({ decisionId, player, kind, reason, options: [...options], min, max, choiceKey: key, simultaneousGroup: group, ...(labels ? { labels } : {}), answered: null });
  const hidden = kind === 'SELECT_CARDS' || kind === 'ORDER_TOP' || kind === 'SETUP';
  emit(ctx, 'DECISION_REQUESTED', { decisionId, player, kind, reason, options: [...options], min, max },
    { visibility: hidden ? 'OWNER' : 'PUBLIC', owner: player, secretFields: hidden ? ['options'] : [], triggerable: false });
  void task;
  return 'SUSPEND';
}

function chooserPlayer(frame: Frame, chooser: 'CONTROLLER' | 'OPPONENT'): PlayerId {
  return chooser === 'CONTROLLER' ? frame.controller : other(frame.controller);
}

/**
 * Resolve um seletor para IDs de entidades, pedindo decisão quando `pick` é CHOOSE. `shield` (padrão true)
 * remove alvos protegidos por PREVENT_EFFECTS contra o atacante; dano (principal e DEAL_DAMAGE) passa `false`,
 * pois é tratado por PREVENT_DAMAGE no pipeline. `accept` restringe os elegíveis aos alvos em que o efeito tem como acontecer.
 */
export function selectTargets(
  ctx: Ctx, frame: Frame, task: { choices: Choices }, key: string, selector: Selector, reason: string, shield = true, accept?: (located: Located) => boolean,
): string[] | 'SUSPEND' {
  const cached = task.choices[key];
  if (cached) return [...cached];
  const sc = frameSelectorContext(frame);
  let list = eligible(ctx, selector, sc);
  if (accept) list = list.filter(accept);
  if (shield && frame.sourceKind === 'ATTACK') {
    const shielded = attackShield(ctx, frame);
    list = list.filter((l) => !shielded(l.entity.entityId));
  }
  const pick = selector.pick ?? { mode: 'ALL' as const };
  let ids: string[];
  if (pick.mode === 'ALL') ids = list.map((l) => l.entity.entityId);
  else if (pick.mode === 'RANDOM') {
    ids = [];
    list = [...list];
    for (let i = 0; i < pick.count && list.length > 0; i += 1) {
      const index = randomIndex(ctx, list.length);
      ids.push(list[index]!.entity.entityId);
      list.splice(index, 1);
    }
  } else {
    const min = Math.min(pick.min, list.length);
    const max = Math.min(pick.max, list.length);
    if (list.length === 0) ids = [];
    else if (list.length <= min) ids = list.map((l) => l.entity.entityId);
    else return requestDecision(ctx, task, key, chooserPlayer(frame, pick.chooser), 'SELECT_TARGETS', reason, list.map((l) => l.entity.entityId), min, max);
  }
  task.choices[key] = ids;
  if (selector.outputId) frame.outputs[selector.outputId] = { kind: 'TARGETS', ids };
  return ids;
}

function chooseCards(
  ctx: Ctx, frame: Frame, task: { choices: Choices }, key: string, candidates: readonly string[], count: number,
  mode: 'CHOOSE' | 'RANDOM' | 'TOP', chooser: PlayerId, reason: string, exact = true,
): string[] | 'SUSPEND' {
  const cached = task.choices[key];
  if (cached) return [...cached];
  const n = Math.min(count, candidates.length);
  let ids: string[];
  if (n <= 0) ids = [];
  else if (mode === 'TOP') ids = candidates.slice(0, n);
  else if (mode === 'RANDOM') {
    const pool = [...candidates];
    ids = [];
    for (let i = 0; i < n; i += 1) {
      const index = randomIndex(ctx, pool.length);
      ids.push(pool[index]!);
      pool.splice(index, 1);
    }
  } else if (candidates.length <= n && exact) ids = [...candidates];
  else return requestDecision(ctx, task, key, chooser, 'SELECT_CARDS', reason, candidates, exact ? n : 0, n);
  task.choices[key] = ids;
  void frame;
  return ids;
}

function expiryFor(ctx: Ctx, controller: PlayerId, kind: string): ActiveEffect['expiry'] {
  const s = ctx.s;
  if (kind === 'THIS_TURN') return { player: s.currentPlayer, ownTurn: s.ownTurns[s.currentPlayer] };
  if (kind === 'NEXT_OPPONENT_TURN') return { player: other(controller), ownTurn: s.ownTurns[other(controller)] + 1 };
  if (kind === 'NEXT_OWN_TURN') return { player: controller, ownTurn: s.ownTurns[controller] + 1 };
  return null;
}

function isSideScope(selector: Selector): boolean {
  return ['OWN_POKEMON', 'OPPONENT_POKEMON', 'ALL_POKEMON', 'OWN_BENCH', 'OPPONENT_BENCH', 'OWN_ACTIVE', 'OPPONENT_ACTIVE'].includes(selector.scope)
    && (!selector.pick || selector.pick.mode === 'ALL');
}

function evolutionTargetsOk(ctx: Ctx, located: Located, cardId: string, skipStage: boolean): boolean {
  const evo = cardDef(ctx, cardId);
  const base = entityDef(ctx, located.entity);
  if (!isPokemon(evo) || evo.stage === 'BASIC') return false;
  if (evo.evolvesFrom.includes(base.deckLimitKey)) return true;
  if (!skipStage || !isPokemon(base) || base.stage !== 'BASIC' || evo.stage !== 'STAGE_2') return false;
  return evo.evolvesFrom.some((key) => ctx.cat.findByDeckLimitKey(key).some((mid) => isPokemon(mid) && mid.stage === 'STAGE_1' && mid.evolvesFrom.includes(base.deckLimitKey)));
}

export function evolveEntity(ctx: Ctx, entityId: string, cardId: string, actor: PlayerId, special: boolean, from: 'HAND' | 'DECK' = 'HAND'): void {
  const located = locate(ctx.s, entityId)!;
  const p = ctx.s.players[located.player];
  removeFromArray(from === 'DECK' ? p.deck : p.hand, cardId);
  const hadCondition = located.entity.conditions.poisoned || located.entity.conditions.burned || located.entity.conditions.control !== null;
  const fromCardId = located.entity.stack[located.entity.stack.length - 1];
  located.entity.stack.push(cardId);
  located.entity.lastEvolvedOnTurn = ctx.s.globalTurnNumber;
  emit(ctx, 'POKEMON_EVOLVED', { player: located.player, entityId, fromCardId, toCardId: cardId, special, from, position: located.position, benchIndex: located.benchIndex });
  if (hadCondition) ctx.s.stats[actor].evolvedWithCondition += 1;
  clearConditions(ctx, located.entity, 'EVOLUTION', actor);
  ctx.s.activeEffects = ctx.s.activeEffects.filter((e) => !(e.removeOn.includes('TARGET_EVOLVES') && e.targets?.includes(entityId)));
  ctx.s.stats[actor].evolutions += 1;
}

function bounceOrRemove(ctx: Ctx, frame: Frame, task: Extract<Task, { kind: 'BLOCK' }>, op: Extract<Operation, { target: Selector }>, destination: 'HAND' | 'DECK' | 'DISCARD'): StepResult {
  const ids = selectTargets(ctx, frame, task, 'target', op.target, op.type);
  if (ids === 'SUSPEND') return ids;
  for (const id of ids) {
    if (!locate(ctx.s, id)) continue;
    const located = detachEntity(ctx, id);
    emit(ctx, 'POKEMON_REMOVED', { player: located.player, entityId: id, destination, by: frame.controller });
    routeEntityCards(ctx, located, destination);
    if (destination === 'DECK') shuffleDeck(ctx, located.player);
  }
  return 'DONE';
}

export function executeOperation(ctx: Ctx, frame: Frame, task: Extract<Task, { kind: 'BLOCK' }>, op: Operation): StepResult {
  const sc = frameSelectorContext(frame);
  const s = ctx.s;
  const controller = frame.controller;
  switch (op.type) {
    case 'FLIP_COINS': {
      const flipAll = (): ('HEADS' | 'TAILS')[] => {
        const results: ('HEADS' | 'TAILS')[] = [];
        if (op.untilTails) {
          for (let i = 0; i < 1000; i += 1) {
            const face = coin(ctx);
            results.push(face);
            if (face === 'TAILS') break;
            if (i === 999) throw new Error('EFFECT_LOOP_DETECTED: moedas até coroa excederam a proteção técnica');
          }
        } else {
          const n = Math.max(0, Math.trunc(evaluateAmount(ctx, op.count ?? 1, sc)));
          for (let i = 0; i < n; i += 1) results.push(coin(ctx));
        }
        return results;
      };
      // Resultados guardados em `choices`: a retomada depois de uma decisão (relançar?) não joga de novo.
      let results = task.choices.coins ? ([...task.choices.coins] as ('HEADS' | 'TAILS')[]) : null;
      if (!results) {
        results = flipAll();
        // Will: a primeira moeda da próxima jogada por efeito deste turno sai cara.
        const me = s.players[controller];
        if (me.forceHeads && results.length > 0 && s.currentPlayer === controller) {
          results[0] = 'HEADS';
          me.forceHeads = false;
          if (op.untilTails && results.length === 1) {
            for (let i = 0; i < 1000; i += 1) {
              const face = coin(ctx);
              results.push(face);
              if (face === 'TAILS') break;
            }
          }
        }
        task.choices.coins = results;
        emit(ctx, 'COIN_RESOLVED', { player: controller, reason: 'EFFECT', results, frameId: frame.frameId });
      }
      // Victory Star (Victini): depois das moedas de um ataque de um Pokémon de Fogo, o dono pode relançá-las (1 vez por turno).
      if (frame.sourceKind === 'ATTACK' && frame.sourceEntityId && results.length > 0 && !task.choices.rerolled
        && !s.players[controller].flags.usage['victory-star']
        && staticsOn(ctx, frame.sourceEntityId, 'REROLL_COINS').some((e) => e.controller === controller)) {
        const answer = task.choices.reroll;
        if (!answer) return requestDecision(ctx, task, 'reroll', controller, 'CONFIRM_OPTIONAL', 'REROLL_COINS', ['YES', 'NO'], 1, 1);
        if (answer[0] === 'YES') {
          s.players[controller].flags.usage['victory-star'] = 1;
          results = flipAll();
          task.choices.rerolled = results;
          emit(ctx, 'COIN_RESOLVED', { player: controller, reason: 'REROLL', results, frameId: frame.frameId });
        } else task.choices.rerolled = ['NONE'];
      }
      const final = task.choices.rerolled && task.choices.rerolled[0] !== 'NONE' ? (task.choices.rerolled as ('HEADS' | 'TAILS')[]) : results;
      frame.outputs[op.outputId] = { kind: 'COINS', results: [...final] };
      return 'DONE';
    }
    case 'DEAL_DAMAGE': {
      const ids = selectTargets(ctx, frame, task, 'target', op.target, 'DEAL_DAMAGE', false);
      if (ids === 'SUSPEND') return ids;
      const statics = collectStatics(ctx);
      for (const id of ids) {
        if (!locate(s, id)) continue;
        const amount = evaluateAmount(ctx, op.amount, { ...sc, targetEntityId: id });
        const category = op.category ?? (frame.sourceKind === 'ATTACK' ? 'ATTACK' : 'EFFECT');
        const dealt = applyDamage(ctx, {
          sourceEntityId: frame.sourceEntityId, sourcePlayer: controller, targetEntityId: id, base: amount, category,
          applyWeakness: op.applyWeakness ?? false, ignoreDefenderModifiers: op.ignoreDefenderModifiers ?? false, attackId: frame.attackId,
        }, statics);
        if (dealt > 0 && category === 'ATTACK' && frame.sourceEntityId) {
          const st = s.stats[controller];
          if (!st.damageSources.includes(frame.sourceEntityId)) st.damageSources.push(frame.sourceEntityId);
        }
      }
      return 'DONE';
    }
    case 'HEAL_DAMAGE': {
      const ids = selectTargets(ctx, frame, task, 'target', op.target, 'HEAL_DAMAGE');
      if (ids === 'SUSPEND') return ids;
      for (const id of ids) {
        if (!locate(s, id)) continue;
        heal(ctx, id, op.amount === 'ALL' ? 'ALL' : evaluateAmount(ctx, op.amount, sc));
      }
      return 'DONE';
    }
    case 'APPLY_CONDITION': {
      const ids = selectTargets(ctx, frame, task, 'target', op.target, 'APPLY_CONDITION');
      if (ids === 'SUSPEND') return ids;
      // A proteção PREVENT_EFFECTS só cobre efeitos de ataques (Habilidades e Treinadores não são barrados).
      for (const [index, id] of ids.entries()) {
        let condition: SpecialCondition | null = op.condition === 'RANDOM' ? null : op.condition;
        if (op.condition === 'RANDOM') {
          const cached = task.choices[`condition-${index}`];
          if (cached) condition = (cached[0] as SpecialCondition | undefined) ?? null;
          else {
            const located = locate(s, id);
            const c = located?.entity.conditions;
            const free = CONDITIONS.filter((k) => !c || !(k === 'POISONED' ? c.poisoned : k === 'BURNED' ? c.burned : c.control === k));
            condition = free.length ? free[randomIndex(ctx, free.length)]! : null;
            task.choices[`condition-${index}`] = condition ? [condition] : [];
          }
        }
        if (condition) applyCondition(ctx, id, condition, frame.sourceKind === 'ATTACK' ? controller : null, op.poisonDamage);
      }
      return 'DONE';
    }
    case 'REMOVE_CONDITION': {
      const ids = selectTargets(ctx, frame, task, 'target', op.target, 'REMOVE_CONDITION');
      if (ids === 'SUSPEND') return ids;
      for (const [index, id] of ids.entries()) {
        const located = locate(s, id);
        if (!located) continue;
        if (op.conditions === 'RANDOM_ONE') {
          const c = located.entity.conditions;
          const has: SpecialCondition[] = [...(c.poisoned ? ['POISONED' as const] : []), ...(c.burned ? ['BURNED' as const] : []), ...(c.control ? [c.control] : [])];
          const cached = task.choices[`remove-${index}`];
          const pick = cached ? (cached[0] as SpecialCondition | undefined) : has.length ? has[randomIndex(ctx, has.length)] : undefined;
          task.choices[`remove-${index}`] = pick ? [pick] : [];
          if (pick) clearConditions(ctx, located.entity, 'EFFECT', controller, [pick]);
          continue;
        }
        clearConditions(ctx, located.entity, 'EFFECT', controller, op.conditions === 'ALL' ? undefined : op.conditions);
      }
      return 'DONE';
    }
    case 'DRAW_CARDS': {
      const player = op.player === 'OWN' ? controller : other(controller);
      drawCards(ctx, player, Math.max(0, evaluateAmount(ctx, op.count, sc)));
      return 'DONE';
    }
    case 'SEARCH_DECK': {
      const p = s.players[controller];
      const keys = ownInPlayKeys(ctx, controller);
      let candidates = p.deck.filter((id) => matchesCardFilter(ctx, id, op.filter, keys));
      if (op.destination === 'BENCH') candidates = candidates.filter((id) => { const d = cardDef(ctx, id); return isPokemon(d) && d.stage === 'BASIC'; });
      const room = op.destination === 'HAND' ? s.config.maximumHandSize - p.hand.length : p.bench.filter((b) => b === null).length;
      const picked = chooseCards(ctx, frame, task, 'cards', candidates, Math.min(op.count, Math.max(0, room)), op.mode, controller, 'SEARCH_DECK');
      if (picked === 'SUSPEND') return picked;
      for (const cardId of picked) {
        removeFromArray(p.deck, cardId);
        if (op.destination === 'HAND') {
          p.hand.push(cardId);
          emit(ctx, 'CARD_SEARCHED', { player: controller, cardId, destination: 'HAND' },
            op.reveal ? {} : { visibility: 'OWNER', owner: controller, secretFields: ['cardId'] });
        } else {
          const index = firstFreeBench(p);
          const entity = newEntity(ctx, controller, cardId);
          p.bench[index] = entity;
          emit(ctx, 'POKEMON_ENTERED', { player: controller, entityId: entity.entityId, cardId, from: 'DECK', position: 'BENCH', benchIndex: index });
        }
      }
      if (op.shuffleAfter ?? true) shuffleDeck(ctx, controller);
      return 'DONE';
    }
    case 'ATTACH_ENERGY': {
      // Quantidade lida uma vez por passo (moedas/saídas do frame são estáveis entre retomadas); 0 = sem efeito.
      const count = op.energyTypes ? op.energyTypes.length : Math.max(0, Math.trunc(evaluateAmount(ctx, op.count, sc)));
      if (count === 0) return 'DONE';
      // Energia que sai da Zona não chega a quem não pode recebê-la (Banette).
      const fromZone = op.source !== 'DISCARDED_ENERGY';
      const statics0 = fromZone ? collectStatics(ctx) : [];
      const blocked = (id: string) => { const l = locate(s, id); return fromZone && !!l && isRestricted(ctx, l, 'RECEIVE_ZONE_ENERGY', statics0); };
      // Todas as escolhas antes de qualquer mutação: um alvo para todas as unidades, um por unidade (`distribute`) ou
      // `count` unidades para cada alvo escolhido (`perTarget`).
      const perUnit: string[] = [];
      if (op.perTarget) {
        const ids = selectTargets(ctx, frame, task, 'target', op.target, 'ATTACH_ENERGY');
        if (ids === 'SUSPEND') return ids;
        for (const id of ids) for (let i = 0; i < count; i += 1) perUnit.push(id);
      } else if (op.distribute) {
        const selector: Selector = op.target.pick && op.target.pick.mode !== 'ALL'
          ? op.target
          : { ...op.target, pick: { mode: 'CHOOSE', chooser: 'CONTROLLER', min: 1, max: 1 } };
        for (let i = 0; i < count; i += 1) {
          const ids = selectTargets(ctx, frame, task, `target-${i}`, selector, 'ATTACH_ENERGY');
          if (ids === 'SUSPEND') return ids;
          if (!ids[0]) break;
          perUnit.push(ids[0]);
        }
      } else {
        const ids = selectTargets(ctx, frame, task, 'target', op.target, 'ATTACH_ENERGY');
        if (ids === 'SUSPEND') return ids;
        if (ids[0]) for (let i = 0; i < count; i += 1) perUnit.push(ids[0]);
      }
      if (perUnit.length === 0) return 'DONE';
      const owner = s.players[controller];
      // Energia gerada sai da Zona de Energia (gatilhos “ligar uma Energia da sua Zona”).
      const origin = op.source === 'DISCARDED_ENERGY' ? 'DISCARD' : 'ENERGY_ZONE';
      // Tipos sorteados ficam em `choices` para a retomada não sortear de novo.
      const typeOf = (i: number): EnergyType | null => {
        if (op.energyTypes) return op.energyTypes[i] ?? null;
        if (op.energyType !== 'RANDOM' && op.energyType !== 'ZONE_RANDOM') return op.energyType === 'READY' ? null : op.energyType;
        const key = `type-${i}`;
        const cached = task.choices[key];
        if (cached) return (cached[0] as EnergyType | undefined) ?? null;
        const pool: readonly EnergyType[] = op.source === 'DISCARDED_ENERGY'
          ? owner.discardedEnergy.map((e) => e.type)
          : op.energyType === 'ZONE_RANDOM' ? owner.energyZone.types : ENERGY_TYPES;
        const t = pool.length ? pool[randomIndex(ctx, pool.length)]! : null;
        task.choices[key] = t ? [t] : [];
        return t;
      };
      perUnit.forEach((target, i) => {
        if (!locate(s, target) || blocked(target)) return;
        let unit: EnergyUnit;
        if (op.source === 'ENERGY_ZONE_READY' || op.energyType === 'READY') {
          if (!owner.energyZone.ready) return;
          unit = { id: nextId(ctx, 'energy', 'en'), type: owner.energyZone.ready };
          if (op.consumesReadyEnergy) {
            owner.energyZone.ready = null;
            emit(ctx, 'ENERGY_ZONE_UPDATED', { player: controller, ready: null, next: owner.energyZone.next, generated: false, reason: 'READY_CONSUMED' }, { triggerable: false });
          }
        } else if (op.source === 'DISCARDED_ENERGY') {
          const type = typeOf(i);
          const index = owner.discardedEnergy.findIndex((e) => e.type === type);
          if (index < 0) return;
          unit = owner.discardedEnergy.splice(index, 1)[0]!;
        } else {
          const type = typeOf(i);
          if (!type) return;
          unit = { id: nextId(ctx, 'energy', 'en'), type };
        }
        attachEnergyUnits(ctx, target, [unit], origin, 'CARD_EFFECT', controller);
      });
      if (op.consumesManualAttachment) owner.flags.manualEnergyUsed = true;
      return 'DONE';
    }
    case 'MOVE_ENERGY': {
      // `from` pode resolver para várias origens (pick ALL); `count: 'ALL'` move todos os anexos elegíveis delas.
      const from = selectTargets(ctx, frame, task, 'from', op.from, 'MOVE_ENERGY_FROM');
      if (from === 'SUSPEND') return from;
      const sources = from.map((id) => locate(s, id)).filter((l): l is Located => l !== null);
      if (sources.length === 0) return 'DONE';
      const matches = (type: EnergyType) => (op.energyTypes ? op.energyTypes.includes(type) : !op.energyType || op.energyType === 'ANY' || type === op.energyType);
      const candidates = sources.flatMap((l) => l.entity.energies.filter((e) => matches(e.type)).map((e) => e.id));
      const energies = chooseEnergies(ctx, task, 'energy', candidates, op.count === 'ALL' ? candidates.length : op.count, controller, 'MOVE_ENERGY');
      if (energies === 'SUSPEND') return energies;
      const to = selectTargets(ctx, frame, task, 'to', { ...op.to, filter: { ...op.to.filter, excludeSelf: false } }, 'MOVE_ENERGY_TO');
      if (to === 'SUSPEND') return to;
      const sourceIds = sources.map((l) => l.entity.entityId);
      if (op.perTarget) {
        // Uma unidade para cada destino escolhido (Cabo Elétrico: 1 Energia em cada um de 2 Pokémon no Banco).
        const dests = to.filter((id) => !sourceIds.includes(id) && locate(s, id));
        energies.slice(0, dests.length).forEach((energyId, i) => {
          const source = sources.find((l) => l.entity.energies.some((e) => e.id === energyId));
          const target = locate(s, dests[i]!);
          if (!source || !target) return;
          const unit = source.entity.energies.find((e) => e.id === energyId)!;
          source.entity.energies = source.entity.energies.filter((e) => e.id !== energyId);
          target.entity.energies.push(unit);
          emit(ctx, 'ENERGY_MOVED', { fromEntityId: source.entity.entityId, toEntityId: dests[i], energyId, energyType: unit.type, player: target.player });
        });
        return 'DONE';
      }
      const dest = to.find((id) => !sourceIds.includes(id)) ?? to[0];
      const target = dest ? locate(s, dest) : null;
      if (!dest || !target) return 'DONE';
      for (const source of sources) {
        if (source.entity.entityId === dest) continue;
        const moving = source.entity.energies.filter((e) => energies.includes(e.id));
        if (moving.length === 0) continue;
        source.entity.energies = source.entity.energies.filter((e) => !energies.includes(e.id));
        target.entity.energies.push(...moving);
        for (const e of moving) emit(ctx, 'ENERGY_MOVED', { fromEntityId: source.entity.entityId, toEntityId: dest, energyId: e.id, energyType: e.type, player: target.player });
      }
      return 'DONE';
    }
    case 'DISCARD_ENERGY': {
      const ids = selectTargets(ctx, frame, task, 'target', op.target, 'DISCARD_ENERGY');
      if (ids === 'SUSPEND') return ids;
      const wanted = op.count === 'ALL' ? null : Math.max(0, Math.trunc(evaluateAmount(ctx, op.count, sc)));
      if (op.combined) {
        // Sorteio entre as Energias de todos os alvos juntos (Redemoinho Furioso: entre todos os Pokémon em jogo).
        const all = ids.flatMap((id) => locate(s, id)?.entity.energies.filter((e) => !op.energyType || op.energyType === 'ANY' || e.type === op.energyType).map((e) => e.id) ?? []);
        const picked = chooseCards(ctx, frame, task, 'energy', all, wanted ?? all.length, 'RANDOM', controller, 'DISCARD_ENERGY');
        if (picked === 'SUSPEND') return picked;
        for (const id of ids) {
          const own = picked.filter((e) => locate(s, id)?.entity.energies.some((x) => x.id === e));
          if (own.length) discardEnergyUnits(ctx, id, own, 'EFFECT');
        }
        return 'DONE';
      }
      for (const [index, id] of ids.entries()) {
        const located = locate(s, id);
        if (!located) continue;
        if (op.energyTypes) {
          // Uma de cada tipo listado (Explosão Elemental do Lugia ex: Fogo, Água e Elétrica).
          const picked: string[] = [];
          for (const type of op.energyTypes) {
            const e = located.entity.energies.find((x) => x.type === type && !picked.includes(x.id));
            if (e) picked.push(e.id);
          }
          discardEnergyUnits(ctx, id, picked, 'EFFECT');
          continue;
        }
        const candidates = located.entity.energies.filter((e) => !op.energyType || op.energyType === 'ANY' || e.type === op.energyType).map((e) => e.id);
        const count = wanted ?? candidates.length;
        const chooser = op.chooser ?? 'CONTROLLER';
        let picked: string[] | 'SUSPEND';
        if (chooser === 'RANDOM') picked = chooseCards(ctx, frame, task, `energy-${index}`, candidates, count, 'RANDOM', controller, 'DISCARD_ENERGY');
        else picked = chooseEnergies(ctx, task, `energy-${index}`, candidates, count, chooser === 'CONTROLLER' ? controller : other(controller), 'DISCARD_ENERGY');
        if (picked === 'SUSPEND') return picked;
        discardEnergyUnits(ctx, id, picked, 'EFFECT');
      }
      return 'DONE';
    }
    case 'SWITCH_ACTIVE': {
      const side = op.side === 'OWN' ? controller : other(controller);
      const p = s.players[side];
      // Tirar do Ativo um Pokémon protegido por PREVENT_EFFECTS é efeito de ataque feito a ele: não ocorre.
      const shielded = attackShield(ctx, frame);
      if (p.active && shielded(p.active.entityId)) return 'DONE';
      const benchIds = entitiesOf(s, side)
        .filter((l) => l.position === 'BENCH' && (!op.filter || matchesPokemonFilter(ctx, l, op.filter, sc)) && !shielded(l.entity.entityId))
        .map((l) => l.entity.entityId);
      if (!p.active || benchIds.length === 0) return 'DONE';
      let chosen: string | undefined;
      const cached = task.choices.switch;
      if (op.incoming === 'SELF') {
        // O próprio Pokémon da Habilidade vai do Banco para o Ativo (Solgaleo ex).
        if (!frame.sourceEntityId || !benchIds.includes(frame.sourceEntityId)) return 'DONE';
        chosen = frame.sourceEntityId;
      } else if (cached) chosen = cached[0];
      else if (op.chooser === 'RANDOM') { chosen = benchIds[randomIndex(ctx, benchIds.length)]; task.choices.switch = [chosen!]; }
      else if (benchIds.length === 1) chosen = benchIds[0];
      else {
        const who = op.chooser === 'CONTROLLER' ? controller : other(controller);
        return requestDecision(ctx, task, 'switch', who, 'SELECT_TARGETS', 'SWITCH_ACTIVE', benchIds, 1, 1);
      }
      const index = p.bench.findIndex((e) => e?.entityId === chosen);
      if (index < 0) return 'DONE';
      swapActive(ctx, side, index, 'SWITCH', controller);
      // “Usar um efeito de troca” vale para os dois lados: no Genetic Apex quase toda troca é no Ativo do oponente (Sabrina).
      s.stats[controller].switchEffects += 1;
      return 'DONE';
    }
    case 'EVOLVE': {
      // Da mão, só são alvos os Pokémon que alguma carta da mão evolui (Doce Raro: um Básico sem Estágio 2 correspondente
      // não é escolha) e que podem evoluir (Aerodactyl ex).
      const fromHand = op.from === 'DECK' ? undefined : (l: Located) => !isRestricted(ctx, l, 'EVOLVE')
        && s.players[controller].hand.some((id) => matchesCardFilter(ctx, id, op.fromHand) && evolutionTargetsOk(ctx, l, id, op.skipStage ?? false));
      const ids = selectTargets(ctx, frame, task, 'target', op.target, 'EVOLVE_TARGET', true, fromHand);
      if (ids === 'SUSPEND') return ids;
      const target = ids[0] ? locate(s, ids[0]) : null;
      if (!target) return 'DONE';
      if (op.from === 'DECK') {
        // Evolução aleatória com uma carta do baralho que evolui do alvo (Porygon2).
        const deck = s.players[target.player].deck.filter((id) => matchesCardFilter(ctx, id, op.fromHand) && evolutionTargetsOk(ctx, target, id, false));
        const picked = chooseCards(ctx, frame, task, 'card', deck, 1, 'RANDOM', controller, 'EVOLVE_CARD');
        if (picked === 'SUSPEND') return picked;
        if (picked[0]) {
          evolveEntity(ctx, target.entity.entityId, picked[0], controller, true, 'DECK');
          shuffleDeck(ctx, target.player);
        }
        return 'DONE';
      }
      // Pokémon jogado da mão para evoluir não pode evoluir quem está sob “não pode evoluir” (Aerodactyl ex).
      if (isRestricted(ctx, target, 'EVOLVE')) return 'DONE';
      const hand = s.players[controller].hand.filter((id) => matchesCardFilter(ctx, id, op.fromHand) && evolutionTargetsOk(ctx, target, id, op.skipStage ?? false));
      const picked = chooseCards(ctx, frame, task, 'card', hand, 1, 'CHOOSE', controller, 'EVOLVE_CARD');
      if (picked === 'SUSPEND') return picked;
      if (picked[0]) evolveEntity(ctx, target.entity.entityId, picked[0], controller, true);
      return 'DONE';
    }
    case 'MODIFY':
    case 'PREVENT_DAMAGE':
    case 'PREVENT_EFFECTS':
    case 'RESTRICT_ACTION':
    case 'SUPPRESS_ABILITIES':
    case 'PREVENT_CONDITIONS':
    case 'PREVENT_HEALING':
    case 'ATTACK_COIN_GATE':
    case 'COUNTER_DAMAGE':
    case 'GRANT_RULE':
    case 'SURVIVE_KNOCKOUT':
    case 'REROLL_COINS': {
      let dynamic = isSideScope(op.target);
      let targets: string[] | null = null;
      // Efeito dinâmico criado por ataque: se algum alvo atual está protegido por PREVENT_EFFECTS, o efeito é
      // fixado nos demais. Restrição só de jogador (Itens/Apoiadores/Energia manual) não é feita ao Pokémon.
      if (dynamic && frame.sourceKind === 'ATTACK' && !(op.type === 'RESTRICT_ACTION' && op.actions.every((a) => PLAYER_ACTIONS.has(a)))) {
        const current = eligible(ctx, { ...op.target, pick: { mode: 'ALL' } }, sc).map((l) => l.entity.entityId);
        const shielded = attackShield(ctx, frame);
        if (current.some(shielded)) {
          dynamic = false;
          targets = current.filter((id) => !shielded(id));
          if (targets.length === 0) return 'DONE';
        }
      }
      if (!dynamic && targets === null) {
        const ids = selectTargets(ctx, frame, task, 'target', op.target, op.type);
        if (ids === 'SUSPEND') return ids;
        targets = ids;
        if (targets.length === 0) return 'DONE';
      }
      const effectId = nextId(ctx, 'effect', 'fx');
      const effect: ActiveEffect = {
        effectId, controller, sourceCardId: frame.sourceCardId, sourceEntityId: frame.sourceEntityId,
        operation: op, targets, expiry: expiryFor(ctx, controller, op.duration.kind),
        removeOn: op.duration.removeOn ?? [], charges: op.type === 'PREVENT_DAMAGE' ? op.charges ?? null : null,
      };
      s.activeEffects.push(effect);
      emit(ctx, 'EFFECT_STARTED', { effectId, controller, opcode: op.type, targets, expiry: effect.expiry, sourceCardId: frame.sourceCardId });
      return 'DONE';
    }
    case 'DISCARD_CARDS': {
      const ownerId = op.zone === 'OWN_HAND' || op.zone === 'OWN_DECK_TOP' ? controller : other(controller);
      const p = s.players[ownerId];
      const fromHand = op.zone.endsWith('HAND');
      const candidates = (fromHand ? p.hand : p.deck).filter((id) => matchesCardFilter(ctx, id, op.filter));
      const count = Math.max(0, evaluateAmount(ctx, op.count, sc));
      const mode = fromHand ? (op.chooser === 'RANDOM' ? 'RANDOM' : 'CHOOSE') : 'TOP';
      const chooser = op.chooser === 'OPPONENT' ? other(controller) : controller;
      const picked = chooseCards(ctx, frame, task, 'cards', candidates, count, mode, chooser, 'DISCARD_CARDS', !op.upTo);
      if (picked === 'SUSPEND') return picked;
      if (op.outputId) frame.outputs[op.outputId] = { kind: 'CARDS', ids: [...picked] };
      if (fromHand) discardFromHand(ctx, ownerId, picked, 'EFFECT');
      else {
        for (const id of picked) removeFromArray(p.deck, id);
        p.discard.push(...picked);
        emit(ctx, 'CARD_DISCARDED', { player: ownerId, cardIds: picked, from: 'DECK_TOP', reason: 'EFFECT' });
      }
      return 'DONE';
    }
    case 'RETURN_TO_HAND': return bounceOrRemove(ctx, frame, task, op, 'HAND');
    case 'SHUFFLE_INTO_DECK': return bounceOrRemove(ctx, frame, task, op, 'DECK');
    case 'DISCARD_POKEMON': return bounceOrRemove(ctx, frame, task, op, 'DISCARD');
    case 'KNOCK_OUT': {
      const ids = selectTargets(ctx, frame, task, 'target', op.target, 'KNOCK_OUT');
      if (ids === 'SUSPEND') return ids;
      for (const id of ids) if (!s.koMarked.includes(id)) s.koMarked.push(id);
      return 'DONE';
    }
    case 'PUT_ON_BENCH': {
      const side = op.side === 'OWN' ? controller : other(controller);
      const p = s.players[side];
      const source = op.from === 'HAND' ? p.hand : op.from === 'DECK' ? p.deck : p.discard;
      const candidates = source.filter((id) => { const d = cardDef(ctx, id); return isPokemon(d) && d.stage === 'BASIC' && matchesCardFilter(ctx, id, op.filter); });
      const room = p.bench.filter((b) => b === null).length;
      const picked = chooseCards(ctx, frame, task, 'cards', candidates, Math.min(op.count, room), op.mode, op.chooser === 'CONTROLLER' ? controller : side, 'PUT_ON_BENCH');
      if (picked === 'SUSPEND') return picked;
      for (const cardId of picked) {
        removeFromArray(source, cardId);
        const index = firstFreeBench(p);
        if (index < 0) break;
        const entity = newEntity(ctx, side, cardId);
        p.bench[index] = entity;
        emit(ctx, 'POKEMON_ENTERED', { player: side, entityId: entity.entityId, cardId, from: op.from, position: 'BENCH', benchIndex: index });
      }
      if (op.from === 'DECK') shuffleDeck(ctx, side);
      return 'DONE';
    }
    case 'RECOVER_FROM_DISCARD': {
      const p = s.players[controller];
      const candidates = p.discard.filter((id) => matchesCardFilter(ctx, id, op.filter));
      const wanted = Math.max(0, Math.trunc(evaluateAmount(ctx, op.count, sc)));
      const room = op.destination === 'HAND' ? s.config.maximumHandSize - p.hand.length : wanted;
      const picked = chooseCards(ctx, frame, task, 'cards', candidates, Math.min(wanted, Math.max(0, room)), op.mode, controller, 'RECOVER_FROM_DISCARD');
      if (picked === 'SUSPEND') return picked;
      for (const cardId of picked) {
        removeFromArray(p.discard, cardId);
        if (op.destination === 'HAND') p.hand.push(cardId);
        else p.deck.push(cardId);
      }
      if (picked.length) emit(ctx, 'CARD_RETURNED', { player: controller, cardIds: picked, to: op.destination, from: 'DISCARD' });
      if (op.destination === 'DECK' && picked.length) shuffleDeck(ctx, controller);
      return 'DONE';
    }
    case 'LOOK_AT_TOP': {
      let side = op.player;
      if (side === 'CHOOSE') {
        const answer = task.choices.deck;
        if (!answer) return requestDecision(ctx, task, 'deck', controller, 'SELECT_MODE', 'LOOK_AT_TOP', ['OWN', 'OPPONENT'], 1, 1, null, { OWN: 'Seu baralho', OPPONENT: 'Baralho do oponente' });
        side = answer[0] === 'OPPONENT' ? 'OPPONENT' : 'OWN';
      }
      const player = side === 'OWN' ? controller : other(controller);
      const deck = s.players[player].deck;
      const top = deck.slice(0, Math.max(0, Math.trunc(evaluateAmount(ctx, op.count, sc))));
      emit(ctx, 'CARDS_LOOKED_AT', { player: controller, deckOwner: player, cardIds: top }, { visibility: 'OWNER', owner: controller, secretFields: ['cardIds'] });
      if (!op.reorder || top.length < 2) return 'DONE';
      const cached = task.choices.order;
      if (!cached) return requestDecision(ctx, task, 'order', controller, 'ORDER_TOP', 'LOOK_AT_TOP', top, top.length, top.length);
      if (cached.length === top.length && cached.every((id) => top.includes(id))) deck.splice(0, top.length, ...cached);
      return 'DONE';
    }
    case 'SHUFFLE_DECK': {
      shuffleDeck(ctx, op.player === 'OWN' ? controller : other(controller));
      return 'DONE';
    }
    case 'REVEAL_HAND': {
      const player = op.player === 'OWN' ? controller : other(controller);
      emit(ctx, 'HAND_REVEALED', { player, viewer: controller, cardIds: [...s.players[player].hand] }, { visibility: 'OWNER', owner: controller, secretFields: ['cardIds'] });
      return 'DONE';
    }
    case 'SCHEDULE_DELAYED': {
      const ids = selectTargets(ctx, frame, task, 'target', op.target, 'SCHEDULE_DELAYED');
      if (ids === 'SUSPEND') return ids;
      for (const id of ids) {
        const at = op.at === 'END_OF_THIS_TURN'
          ? { player: s.currentPlayer, ownTurn: s.ownTurns[s.currentPlayer], boundary: 'END' as const }
          : op.at === 'END_OF_OPPONENT_NEXT_TURN'
            ? { player: other(controller), ownTurn: s.ownTurns[other(controller)] + (s.currentPlayer === other(controller) ? 1 : 1), boundary: 'END' as const }
            : { player: controller, ownTurn: s.ownTurns[controller] + 1, boundary: 'START' as const };
        const delayedId = nextId(ctx, 'effect', 'delayed');
        const where = op.bindTo === 'SPOT' ? locate(s, id) : null;
        const spot = where ? { player: where.player, position: where.position, benchIndex: where.benchIndex } : undefined;
        s.delayedEffects.push({ delayedId, controller, sourceCardId: frame.sourceCardId, sourceEntityId: frame.sourceEntityId, targetEntityId: id, at, operations: op.operations, removeOn: op.removeOn ?? [], ...(spot ? { spot } : {}) });
        emit(ctx, 'DELAYED_EFFECT_SCHEDULED', { delayedId, controller, targetEntityId: id, at });
      }
      return 'DONE';
    }
    case 'COPY_ATTACK': {
      // Copiar não é efeito feito ao Pokémon copiado (sem filtro de PREVENT_EFFECTS). Com várias origens
      // (pick ALL), a escolha oferece os ataques de todas elas.
      const ids = selectTargets(ctx, frame, task, 'from', op.from, 'COPY_ATTACK_SOURCE', false);
      if (ids === 'SUSPEND') return ids;
      const self = frame.sourceEntityId ? locate(s, frame.sourceEntityId) : null;
      if (!self) return 'DONE';
      const statics = collectStatics(ctx);
      const options: string[] = [];
      for (const id of ids) {
        const source = locate(s, id);
        if (!source) continue;
        for (const a of entityDef(ctx, source.entity).attacks) {
          if (op.attackFilter?.attackIds && !op.attackFilter.attackIds.includes(a.id)) continue;
          const total = Object.values(a.energyCost).reduce((x, y) => x + (y ?? 0), 0);
          if (op.attackFilter?.maxEnergyCost !== undefined && total > op.attackFilter.maxEnergyCost) continue;
          if (op.requireEnergy && !canPay(providedUnits(ctx, self.entity, statics), effectiveAttackCost(ctx, self.entity, a.id, a.energyCost, statics))) continue;
          if (a.effects.some((b) => b.operation.type === 'COPY_ATTACK')) continue;
          options.push(`${source.entity.entityId}:${a.id}`);
        }
      }
      let chosen = task.choices.attack?.[0];
      if (!chosen) {
        if (options.length === 0) return 'DONE';
        if (options.length === 1) chosen = options[0];
        else return requestDecision(ctx, task, 'attack', controller, 'SELECT_ATTACK', 'COPY_ATTACK', options, 1, 1);
      }
      task.choices.attack = [chosen!];
      const [sourceId, attackId] = chosen!.split(':') as [string, string];
      const source = locate(s, sourceId);
      if (!source) return 'DONE';
      queueCopiedAttack(ctx, frame, source.entity.stack[source.entity.stack.length - 1]!, attackId);
      return 'DONE';
    }
    case 'CONDITIONAL': {
      const branch = evaluateCondition(ctx, op.condition, sc) ? op.then : op.else ?? [];
      const tasks: Task[] = branch.map((child, i) => ({
        kind: 'BLOCK', frameId: frame.frameId, blockId: `${task.blockId}/${i}`, operation: child, condition: null, optional: false, policy: 'BEST_EFFORT', choices: {},
      }));
      // Insere logo após a tarefa corrente (que ainda está na frente da fila).
      s.queue.splice(1, 0, ...tasks);
      return 'DONE';
    }
    case 'REMOVE_TOOL': {
      const ids = selectTargets(ctx, frame, task, 'target', op.target, 'REMOVE_TOOL');
      if (ids === 'SUSPEND') return ids;
      for (const id of ids) {
        const located = locate(s, id);
        if (!located || !located.entity.toolCardId) continue;
        const toolId = located.entity.toolCardId;
        located.entity.toolCardId = null;
        const owner = s.players[located.player];
        if (op.destination === 'HAND' && owner.hand.length < s.config.maximumHandSize) owner.hand.push(toolId);
        else owner.discard.push(toolId);
        s.stats[controller].modifierSourcesRemoved += 1;
        emit(ctx, 'TOOL_REMOVED', { player: located.player, entityId: id, cardId: toolId, destination: op.destination });
      }
      return 'DONE';
    }
    case 'END_TURN':
      frame.forceEndTurn = true;
      return 'DONE';
    case 'ATTACK_FAILS': {
      // Mesmo mecanismo da Confusão: o dano principal e os blocos restantes do frame não executam.
      if (frame.failed) return 'DONE';
      frame.failed = true;
      emit(ctx, 'ATTACK_FAILED', { player: controller, entityId: frame.sourceEntityId, attackId: frame.attackId, reason: 'EFFECT' });
      return 'DONE';
    }
    case 'SHUFFLE_HAND_INTO_DECK': {
      const player = op.player === 'OWN' ? controller : other(controller);
      const p = s.players[player];
      const cardIds = [...p.hand];
      p.hand.length = 0;
      p.deck.push(...cardIds);
      if (op.outputId) frame.outputs[op.outputId] = { kind: 'COUNT', value: cardIds.length };
      // A mão é informação oculta: o adversário do dono vê só a quantidade (G-053).
      if (cardIds.length) {
        emit(ctx, 'HAND_SHUFFLED_INTO_DECK', { player, by: controller, count: cardIds.length, cardIds, handCount: 0, deckCount: p.deck.length },
          { visibility: 'OWNER', owner: player, secretFields: ['cardIds'] });
      }
      shuffleDeck(ctx, player);
      return 'DONE';
    }
    case 'MOVE_DAMAGE': {
      const from = selectTargets(ctx, frame, task, 'from', op.from, 'MOVE_DAMAGE_FROM');
      if (from === 'SUSPEND') return from;
      const to = selectTargets(ctx, frame, task, 'to', op.to, 'MOVE_DAMAGE_TO');
      if (to === 'SUSPEND') return to;
      const dest = to[0] ? locate(s, to[0]) : null;
      if (!dest) return 'DONE';
      for (const id of from) {
        const src = locate(s, id);
        if (!src || id === dest.entity.entityId) continue;
        const moved = op.amount === 'ALL' ? src.entity.damage : Math.min(src.entity.damage, op.amount);
        if (moved <= 0) continue;
        src.entity.damage -= moved;
        dest.entity.damage += moved;
        emit(ctx, 'DAMAGE_MOVED', { fromEntityId: id, toEntityId: dest.entity.entityId, amount: moved, player: dest.player, fromDamage: src.entity.damage, toDamage: dest.entity.damage });
      }
      return 'DONE';
    }
    case 'SET_REMAINING_HP': {
      const ids = selectTargets(ctx, frame, task, 'target', op.target, 'SET_REMAINING_HP');
      if (ids === 'SUSPEND') return ids;
      const statics = collectStatics(ctx);
      for (const id of ids) {
        const located = locate(s, id);
        if (!located) continue;
        const hp = maxHp(ctx, located.entity, statics);
        const remaining = Math.max(0, hp - located.entity.damage);
        const next = op.mode === 'HALF_DOWN' ? Math.floor(remaining / 20) * 10 : Math.min(remaining, op.value ?? remaining);
        if (next >= remaining) continue;
        located.entity.damage = hp - next;
        emit(ctx, 'REMAINING_HP_SET', { entityId: id, player: located.player, remainingHp: next, damageTotal: located.entity.damage, maxHp: hp });
      }
      return 'DONE';
    }
    case 'DEVOLVE': {
      const ids = selectTargets(ctx, frame, task, 'target', op.target, 'DEVOLVE');
      if (ids === 'SUSPEND') return ids;
      for (const id of ids) {
        const located = locate(s, id);
        if (!located || located.entity.stack.length < 2) continue;
        const cardId = located.entity.stack.pop()!;
        const owner = s.players[located.player];
        if (owner.hand.length < s.config.maximumHandSize) owner.hand.push(cardId);
        else owner.discard.push(cardId);
        clearConditions(ctx, located.entity, 'EVOLUTION', controller);
        s.activeEffects = s.activeEffects.filter((e) => !(e.removeOn.includes('TARGET_EVOLVES') && e.targets?.includes(id)));
        emit(ctx, 'POKEMON_DEVOLVED', { player: located.player, entityId: id, cardId, toCardId: located.entity.stack[located.entity.stack.length - 1], by: controller });
      }
      return 'DONE';
    }
    case 'RETURN_CARDS_TO_DECK': {
      const ownerId = other(controller);
      const p = s.players[ownerId];
      const candidates = p.hand.filter((id) => matchesCardFilter(ctx, id, op.filter));
      const count = Math.max(0, Math.trunc(evaluateAmount(ctx, op.count, sc)));
      const picked = chooseCards(ctx, frame, task, 'cards', candidates, count, op.chooser === 'RANDOM' ? 'RANDOM' : 'CHOOSE', controller, 'RETURN_CARDS_TO_DECK');
      if (picked === 'SUSPEND') return picked;
      if (picked.length === 0) return 'DONE';
      for (const id of picked) removeFromArray(p.hand, id);
      p.deck.push(...picked);
      emit(ctx, 'CARDS_RETURNED_TO_DECK', { player: ownerId, by: controller, cardIds: picked, count: picked.length, handCount: p.hand.length });
      shuffleDeck(ctx, ownerId);
      return 'DONE';
    }
    case 'CHANGE_ENERGY_TYPE': {
      const ids = selectTargets(ctx, frame, task, 'target', op.target, 'CHANGE_ENERGY_TYPE');
      if (ids === 'SUSPEND') return ids;
      for (const id of ids) {
        const located = locate(s, id);
        if (!located || located.entity.energies.length === 0) continue;
        const index = randomIndex(ctx, located.entity.energies.length);
        const type = ENERGY_TYPES[randomIndex(ctx, ENERGY_TYPES.length)]!;
        const old = located.entity.energies[index]!;
        located.entity.energies[index] = { id: old.id, type };
        emit(ctx, 'ENERGY_TYPE_CHANGED', { entityId: id, player: located.player, energyId: old.id, from: old.type, to: type });
      }
      return 'DONE';
    }
    case 'SET_NEXT_ENERGY': {
      const player = op.player === 'OWN' ? controller : other(controller);
      const zone = s.players[player].energyZone;
      if (zone.types.length === 0) return 'DONE';
      zone.next = ENERGY_TYPES[randomIndex(ctx, ENERGY_TYPES.length)]!;
      emit(ctx, 'ENERGY_ZONE_UPDATED', { player, ready: zone.ready, next: zone.next, generated: false, reason: 'NEXT_CHANGED' }, { triggerable: false });
      return 'DONE';
    }
    case 'REVEAL_TOP_TAKE': {
      const p = s.players[controller];
      const top = p.deck.slice(0, op.count);
      if (top.length === 0) return 'DONE';
      const room = Math.max(0, s.config.maximumHandSize - p.hand.length);
      const taken = top.filter((id) => matchesCardFilter(ctx, id, op.filter)).slice(0, room);
      const rest = top.filter((id) => !taken.includes(id));
      p.deck.splice(0, top.length);
      p.hand.push(...taken);
      emit(ctx, 'CARDS_REVEALED', { player: controller, from: 'DECK_TOP', cardIds: top, taken });
      if (op.rest === 'BOTTOM') p.deck.push(...rest);
      else { p.deck.push(...rest); shuffleDeck(ctx, controller); }
      return 'DONE';
    }
    case 'REVEAL_CARDS': {
      const ownerId = other(controller);
      const zone = op.zone === 'OPPONENT_DECK' ? s.players[ownerId].deck : s.players[ownerId].hand;
      const cardIds = zone.filter((id) => matchesCardFilter(ctx, id, op.filter));
      emit(ctx, 'CARDS_REVEALED', { player: ownerId, viewer: controller, from: op.zone, cardIds });
      return 'DONE';
    }
    case 'SWAP_HAND_WITH_DECK': {
      const p = s.players[controller];
      const isMon = (id: string) => isPokemon(cardDef(ctx, id));
      const hand = p.hand.filter(isMon);
      const deckMons = p.deck.filter(isMon);
      if (hand.length === 0 || deckMons.length === 0) return 'DONE';
      const chosen = chooseCards(ctx, frame, task, 'hand', hand, 1, 'CHOOSE', controller, 'SWAP_HAND_WITH_DECK');
      if (chosen === 'SUSPEND') return chosen;
      const drawn = chooseCards(ctx, frame, task, 'deck', deckMons, 1, 'RANDOM', controller, 'SWAP_HAND_WITH_DECK');
      if (drawn === 'SUSPEND') return drawn;
      if (!chosen[0] || !drawn[0]) return 'DONE';
      removeFromArray(p.hand, chosen[0]);
      removeFromArray(p.deck, drawn[0]);
      p.hand.push(drawn[0]);
      p.deck.push(chosen[0]);
      emit(ctx, 'CARD_SEARCHED', { player: controller, cardId: drawn[0], destination: 'HAND' }, { visibility: 'OWNER', owner: controller, secretFields: ['cardId'] });
      shuffleDeck(ctx, controller);
      return 'DONE';
    }
    case 'CHOOSE_ONE': {
      const answer = task.choices.mode;
      if (!answer) {
        const options = op.options.map((_, i) => `MODE:${i}`);
        const labels = Object.fromEntries(op.options.map((ops, i) => [`MODE:${i}`, ops.map((x) => operationText(x)).join('; ')]));
        return requestDecision(ctx, task, 'mode', controller, 'SELECT_MODE', 'CHOOSE_ONE', options, 1, 1, null, labels);
      }
      const index = Number((answer[0] ?? 'MODE:0').slice(5));
      const tasks: Task[] = (op.options[index] ?? []).map((child, i) => ({
        kind: 'BLOCK', frameId: frame.frameId, blockId: `${task.blockId}/${i}`, operation: child, condition: null, optional: false, policy: 'BEST_EFFORT', choices: {},
      }));
      s.queue.splice(1, 0, ...tasks);
      return 'DONE';
    }
    case 'FORCE_COIN':
      s.players[controller].forceHeads = true;
      return 'DONE';
    case 'COPY_TRAINER': {
      const opp = s.players[other(controller)];
      const candidates = opp.deck.filter((id) => {
        const d = cardDef(ctx, id);
        return d.category === 'TRAINER' && d.subtype === 'SUPPORTER' && !op.excludeKeys.includes(d.deckLimitKey);
      });
      const picked = chooseCards(ctx, frame, task, 'card', candidates, 1, 'RANDOM', controller, 'COPY_TRAINER');
      if (picked === 'SUSPEND') return picked;
      if (!picked[0]) return 'DONE';
      const def = cardDef(ctx, picked[0]);
      if (def.category !== 'TRAINER') return 'DONE';
      emit(ctx, 'TRAINER_COPIED', { player: controller, cardId: picked[0], from: 'OPPONENT_DECK' });
      shuffleDeck(ctx, other(controller));
      const tasks = def.trainerEffects.filter((b) => b.timing === 'ON_PLAY').map((b, i) => blockTask(frame.frameId, { ...b, id: `${task.blockId}/copy-${i}`, failurePolicy: 'BEST_EFFORT' }));
      s.queue.splice(1, 0, ...tasks);
      return 'DONE';
    }
    case 'MOVE_ENERGY_FREELY': {
      // Laço de decisões: escolher uma Energia (ou terminar) e o destino; tudo simulado antes de mover de verdade.
      const own = entitiesOf(s, controller);
      const holder = new Map<string, string>();
      const typeOf = new Map<string, EnergyType>();
      for (const l of own) for (const e of l.entity.energies) { holder.set(e.id, l.entity.entityId); typeOf.set(e.id, e.type); }
      const nameOf = (entityId: string) => { const l = own.find((x) => x.entity.entityId === entityId); return l ? entityDef(ctx, l.entity).name : '?'; };
      const cap = Math.min(20, holder.size * 2);
      for (let i = 0; i < cap; i += 1) {
        const pick = task.choices[`pick-${i}`];
        if (!pick) {
          const options = [...holder.keys(), 'DONE'];
          const labels = Object.fromEntries([...holder.entries()].map(([id, at]) => [id, `Energia (${typeOf.get(id)}) em ${nameOf(at)}`]).concat([['DONE', 'Terminar']]));
          return requestDecision(ctx, task, `pick-${i}`, controller, 'SELECT_MODE', 'MOVE_ENERGY_FREELY', options, 1, 1, null, labels);
        }
        if (pick[0] === 'DONE' || !holder.has(pick[0]!)) break;
        const dest = task.choices[`dest-${i}`];
        if (!dest) {
          const options = own.map((l) => l.entity.entityId).filter((id) => id !== holder.get(pick[0]!));
          if (options.length === 0) break;
          return requestDecision(ctx, task, `dest-${i}`, controller, 'SELECT_TARGETS', 'MOVE_ENERGY_FREELY_TO', options, 1, 1);
        }
        holder.set(pick[0]!, dest[0]!);
      }
      for (const l of own) {
        const leaving = l.entity.energies.filter((e) => holder.get(e.id) !== l.entity.entityId);
        if (!leaving.length) continue;
        l.entity.energies = l.entity.energies.filter((e) => holder.get(e.id) === l.entity.entityId);
        for (const e of leaving) {
          const target = locate(s, holder.get(e.id)!);
          if (!target) continue;
          target.entity.energies.push(e);
          emit(ctx, 'ENERGY_MOVED', { fromEntityId: l.entity.entityId, toEntityId: target.entity.entityId, energyId: e.id, energyType: e.type, player: controller });
        }
      }
      return 'DONE';
    }
    default:
      throw new Error(`UNKNOWN_OPCODE: ${(op as { type: string }).type}`);
  }
}

function chooseEnergies(ctx: Ctx, task: { choices: Choices }, key: string, candidates: readonly string[], count: number, chooser: PlayerId, reason: string): string[] | 'SUSPEND' {
  const cached = task.choices[key];
  if (cached) return [...cached];
  const n = Math.min(count, candidates.length);
  if (n === candidates.length) { task.choices[key] = [...candidates]; return [...candidates]; }
  return requestDecision(ctx, task, key, chooser, 'SELECT_ENERGY', reason, candidates, n, n);
}

/** Enfileira a resolução de um ataque copiado no contexto do copiador (gameplay §12.9). */
function queueCopiedAttack(ctx: Ctx, frame: Frame, sourceCardId: string, attackId: string): void {
  const def = cardDef(ctx, sourceCardId);
  const attack = def.attacks.find((a) => a.id === attackId);
  if (!attack) return;
  const frameId = nextId(ctx, 'frame', 'frame');
  // O ataque copiado tem como Pokémon Defensor o Ativo adversário do momento (normalmente o do ataque original).
  const defender = ctx.s.players[other(frame.controller)].active?.entityId ?? frame.attackTargetEntityId;
  ctx.s.frames[frameId] = {
    frameId, controller: frame.controller, sourceKind: 'ATTACK', sourceCardId, sourceEntityId: frame.sourceEntityId,
    attackId, abilityId: null, eventSourceEntityId: null, eventTargetEntityId: defender, attackTargetEntityId: defender,
    depth: frame.depth + 1, outputs: {}, failed: false, forceEndTurn: false, damageDealtByAttack: 0,
  };
  const tasks: Task[] = [
    ...attack.effects.filter((b) => b.timing === 'PRE_DAMAGE').map((b) => blockTask(frameId, b)),
    { kind: 'MAIN_DAMAGE', frameId, choices: {} },
    ...attack.effects.filter((b) => b.timing === 'POST_DAMAGE').map((b) => blockTask(frameId, b)),
    { kind: 'FRAME_END', frameId, endsTurn: false },
  ];
  ctx.s.queue.splice(1, 0, ...tasks);
}

export function blockTask(frameId: string, block: { id: string; operation: Operation; condition?: unknown; optional?: boolean; failurePolicy?: 'REQUIRE_ANY' | 'REQUIRE_ALL' | 'BEST_EFFORT' }, policy: 'REQUIRE_ANY' | 'REQUIRE_ALL' | 'BEST_EFFORT' = 'BEST_EFFORT'): Task {
  return {
    kind: 'BLOCK', frameId, blockId: block.id, operation: block.operation, condition: block.condition ?? null,
    optional: block.optional ?? false, policy: block.failurePolicy ?? policy, choices: {},
  };
}

/** Viabilidade para REQUIRE_ANY/REQUIRE_ALL na declaração (gameplay §14.4, B8). Não consome RNG. */
export function canProduceEffect(ctx: Pick<Ctx, 's' | 'cat'>, controller: PlayerId, selfEntityId: string | null, op: Operation, requireAll: boolean): boolean {
  const s = ctx.s;
  const sc: SelectorContext = { controller, selfEntityId, eventSourceEntityId: null, eventTargetEntityId: null, outputs: {} };
  const p = s.players[controller];
  const count = (sel: Selector) => eligible(ctx, sel, sc).length;
  const need = (sel: Selector) => {
    const n = count(sel);
    if (!requireAll || !sel.pick || sel.pick.mode !== 'CHOOSE') return n > 0;
    return n >= sel.pick.min;
  };
  switch (op.type) {
    case 'HEAL_DAMAGE': return eligible(ctx, op.target, sc).some((l) => l.entity.damage > 0);
    case 'DRAW_CARDS': {
      const who = op.player === 'OWN' ? p : s.players[other(controller)];
      return who.hand.length < s.config.maximumHandSize && who.deck.length > 0;
    }
    case 'SEARCH_DECK': {
      const room = op.destination === 'HAND' ? s.config.maximumHandSize - p.hand.length : p.bench.filter((b) => b === null).length;
      if (room <= 0) return false;
      const keys = ownInPlayKeys(ctx, controller);
      return p.deck.some((id) => matchesCardFilter(ctx, id, op.filter, keys) && (op.destination === 'HAND' || (() => { const d = cardDef(ctx, id); return isPokemon(d) && d.stage === 'BASIC'; })()));
    }
    case 'SWITCH_ACTIVE': {
      const sideId = op.side === 'OWN' ? controller : other(controller);
      return !!s.players[sideId].active && entitiesOf(s, sideId).some((l) => l.position === 'BENCH' && (!op.filter || matchesPokemonFilter(ctx, l, op.filter, sc)));
    }
    case 'SHUFFLE_HAND_INTO_DECK': {
      const who = op.player === 'OWN' ? p : s.players[other(controller)];
      return who.hand.length > 0 || who.deck.length > 0;
    }
    case 'ATTACH_ENERGY': {
      // Do descarte: uma Energia do tipo pedido (ou de um dos listados); sorteada (Lusamine) aceita qualquer descartada.
      const fromDiscard = (type: EnergyType) => (op.energyTypes ? op.energyTypes.includes(type)
        : op.energyType === 'RANDOM' || op.energyType === 'ZONE_RANDOM' || type === op.energyType);
      if (op.source === 'DISCARDED_ENERGY' && !p.discardedEnergy.some((e) => fromDiscard(e.type))) return false;
      if ((op.source === 'ENERGY_ZONE_READY' || op.energyType === 'READY') && !p.energyZone.ready) return false;
      return need(op.target);
    }
    case 'REMOVE_CONDITION':
      return eligible(ctx, op.target, sc).some((l) => l.entity.conditions.poisoned || l.entity.conditions.burned || l.entity.conditions.control !== null);
    case 'DISCARD_CARDS': {
      const own = op.zone.startsWith('OWN');
      const who = own ? p : s.players[other(controller)];
      return (op.zone.endsWith('HAND') ? who.hand : who.deck).some((id) => matchesCardFilter(ctx, id, op.filter as CardFilter | undefined));
    }
    case 'RECOVER_FROM_DISCARD':
      return p.discard.some((id) => matchesCardFilter(ctx, id, op.filter)) && (op.destination === 'DECK' || p.hand.length < s.config.maximumHandSize);
    case 'PUT_ON_BENCH': {
      const side = op.side === 'OWN' ? p : s.players[other(controller)];
      const source = op.from === 'HAND' ? side.hand : op.from === 'DECK' ? side.deck : side.discard;
      return side.bench.some((b) => b === null) && source.some((id) => { const d = cardDef(ctx, id); return isPokemon(d) && d.stage === 'BASIC' && matchesCardFilter(ctx, id, op.filter); });
    }
    case 'EVOLVE':
      return eligible(ctx, op.target, sc).some((l) => !isRestricted(ctx, l, 'EVOLVE')
        && p.hand.some((id) => matchesCardFilter(ctx, id, op.fromHand) && evolutionTargetsOk(ctx as Ctx, l, id, op.skipStage ?? false)));
    case 'MOVE_ENERGY':
      return eligible(ctx, op.from, sc).some((l) => l.entity.energies.some((e) => !op.energyType || op.energyType === 'ANY' || e.type === op.energyType)) && count(op.to) > 0;
    case 'DISCARD_ENERGY':
      return eligible(ctx, op.target, sc).some((l) => l.entity.energies.length > 0);
    case 'REMOVE_TOOL':
      return eligible(ctx, op.target, sc).some((l) => l.entity.toolCardId !== null);
    case 'DEAL_DAMAGE':
    case 'APPLY_CONDITION':
    case 'RETURN_TO_HAND':
    case 'SHUFFLE_INTO_DECK':
    case 'DISCARD_POKEMON':
    case 'KNOCK_OUT':
      return need(op.target);
    case 'LOOK_AT_TOP': return op.player === 'CHOOSE' ? p.deck.length > 0 || s.players[other(controller)].deck.length > 0 : (op.player === 'OWN' ? p : s.players[other(controller)]).deck.length > 0;
    case 'MOVE_DAMAGE': return eligible(ctx, op.from, sc).some((l) => l.entity.damage > 0) && count(op.to) > 0;
    case 'SET_REMAINING_HP':
    case 'DEVOLVE':
    case 'CHANGE_ENERGY_TYPE':
      return need(op.target);
    case 'RETURN_CARDS_TO_DECK': return s.players[other(controller)].hand.some((id) => matchesCardFilter(ctx, id, op.filter));
    case 'SWAP_HAND_WITH_DECK': return p.hand.some((id) => isPokemon(cardDef(ctx, id))) && p.deck.some((id) => isPokemon(cardDef(ctx, id)));
    case 'REVEAL_TOP_TAKE': return p.deck.length > 0;
    case 'COPY_TRAINER': return true;
    default: return true;
  }
}

/** Chaves de limite das cartas do topo dos Pokémon em jogo do controlador (filtro evolvesFromTarget). */
function ownInPlayKeys(ctx: Pick<Ctx, 's' | 'cat'>, controller: PlayerId): string[] {
  const p = ctx.s.players[controller];
  return [p.active, ...p.bench].filter(Boolean).map((e) => entityDef(ctx, e!).deckLimitKey);
}

export function koCandidates(ctx: Ctx): Located[] {
  const statics = collectStatics(ctx);
  const out: Located[] = [];
  for (const player of ['A', 'B'] as const) {
    const p = ctx.s.players[player];
    const list = [p.active, ...p.bench].filter(Boolean) as NonNullable<typeof p.active>[];
    for (const entity of list) {
      if (ctx.s.koMarked.includes(entity.entityId) || entity.damage >= maxHp(ctx, entity, statics)) {
        out.push(locate(ctx.s, entity.entityId)!);
      }
    }
  }
  return out;
}
