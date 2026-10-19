// Fila de resolução, gatilhos, Nocautes, condição terminal e ciclo de turno
// (gameplay §8.2, §16.3, §17; efeitos-dsl.md §7, §13).
import type { Ability, EffectBlock, Trigger } from '../cards/types.ts';
import { isPokemon } from '../cards/types.ts';
import {
  cardDef, coin, drawCards, emit, entitiesOf, entityDef, hasPokemonInPlay, locate, newGroup, nextId,
  topCardId, randomIndex, type Ctx,
} from './core.ts';
import { collectStatics, isAbilitySuppressed, knockoutPoints, maxHp, poisonDamage, staticTargets } from './derived.ts';
import { evaluateAmount, evaluateCondition } from './formula.ts';
import { applyDamage, cleanseProtected, detachEntity, routeEntityCards, swapActive } from './mutations.ts';
import {
  blockTask, executeOperation, frameSelectorContext, koCandidates, requestDecision, selectTargets, type StepResult,
} from './ops.ts';
import type { BattleEvent, Frame, MatchResult, PlayerId, Task } from './types.ts';
import { other, PLAYERS } from './types.ts';

const MAX_TRIGGER_DEPTH = 8;
const MAX_STEPS = 20000;

export function createFrame(ctx: Ctx, init: Omit<Frame, 'frameId' | 'outputs' | 'failed' | 'forceEndTurn' | 'damageDealtByAttack'>): Frame {
  const frameId = nextId(ctx, 'frame', 'frame');
  const frame: Frame = { ...init, frameId, outputs: {}, failed: false, forceEndTurn: false, damageDealtByAttack: 0 };
  ctx.s.frames[frameId] = frame;
  return frame;
}

function frameDepth(ctx: Ctx, task: Task | undefined): number {
  if (!task || !('frameId' in task)) return 0;
  return ctx.s.frames[task.frameId]?.depth ?? 0;
}

// ---------------------------------------------------------------- execução da fila

export function runQueue(ctx: Ctx): void {
  let steps = 0;
  // Eventos emitidos diretamente pela ação (fora de uma tarefa) também disparam gatilhos.
  enqueueTriggers(ctx, 0);
  while (ctx.s.queue.length > 0 && ctx.s.pendingDecisions.length === 0 && ctx.s.result === null) {
    steps += 1;
    if (steps > MAX_STEPS) throw new Error('EFFECT_LOOP_DETECTED: limite técnico de passos de resolução');
    const task = ctx.s.queue[0]!;
    ctx.triggerable.length = 0;
    const result = runTask(ctx, task);
    if (result === 'SUSPEND') return;
    // A tarefa concluída sai da frente (pode ter inserido sucessoras logo depois dela).
    if (ctx.s.queue[0] === task) ctx.s.queue.shift();
    else {
      const index = ctx.s.queue.indexOf(task);
      if (index >= 0) ctx.s.queue.splice(index, 1);
    }
    enqueueTriggers(ctx, frameDepth(ctx, task));
  }
}

function runTask(ctx: Ctx, task: Task): StepResult {
  switch (task.kind) {
    case 'SETUP': return runSetup(ctx, task);
    case 'BLOCK': return runBlock(ctx, task);
    case 'CONFUSION_CHECK': return runConfusion(ctx, task.frameId);
    case 'COIN_GATE': return runCoinGate(ctx, task.frameId);
    case 'KO_RESOLVE': return runKoResolve(ctx, task.entityIds);
    case 'MAIN_DAMAGE': return runMainDamage(ctx, task);
    case 'FRAME_END': return runFrameEnd(ctx, task.frameId, task.endsTurn);
    case 'KO_CHECK': return runKoCheck(ctx);
    case 'PROMOTIONS': return runPromotions(ctx, task);
    case 'END_TURN': return runEndTurn(ctx);
    case 'CHECKUP': return runCheckup(ctx);
    case 'TURN_TRANSITION': return runTurnTransition(ctx);
    case 'START_TURN': return runStartTurn(ctx, task.player);
    default: throw new Error(`tarefa desconhecida ${(task as { kind: string }).kind}`);
  }
}

function runBlock(ctx: Ctx, task: Extract<Task, { kind: 'BLOCK' }>): StepResult {
  const frame = ctx.s.frames[task.frameId];
  if (!frame || frame.failed) return 'DONE';
  const sc = frameSelectorContext(frame);
  if (task.condition && !evaluateCondition(ctx, task.condition as never, sc)) return 'DONE';
  if (task.optional) {
    const answer = task.choices.optional;
    if (!answer) return requestDecision(ctx, task, 'optional', frame.controller, 'CONFIRM_OPTIONAL', task.blockId, ['YES', 'NO'], 1, 1);
    if (answer[0] !== 'YES') return 'DONE';
  }
  return executeOperation(ctx, frame, task, task.operation);
}

function runConfusion(ctx: Ctx, frameId: string): StepResult {
  const frame = ctx.s.frames[frameId];
  if (!frame || !frame.sourceEntityId) return 'DONE';
  const face = coin(ctx);
  emit(ctx, 'COIN_RESOLVED', { player: frame.controller, reason: 'CONFUSION', results: [face], frameId });
  if (face === 'TAILS') {
    frame.failed = true;
    emit(ctx, 'ATTACK_FAILED', { player: frame.controller, entityId: frame.sourceEntityId, attackId: frame.attackId, reason: 'CONFUSED' });
  }
  return 'DONE';
}

/** Smokescreen/Octazooka: antes do ataque o atacante joga uma moeda; coroa = o ataque não acontece. */
function runCoinGate(ctx: Ctx, frameId: string): StepResult {
  const frame = ctx.s.frames[frameId];
  if (!frame || !frame.sourceEntityId || frame.failed) return 'DONE';
  const face = coin(ctx);
  emit(ctx, 'COIN_RESOLVED', { player: frame.controller, reason: 'ATTACK_GATE', results: [face], frameId });
  if (face === 'TAILS') {
    frame.failed = true;
    emit(ctx, 'ATTACK_FAILED', { player: frame.controller, entityId: frame.sourceEntityId, attackId: frame.attackId, reason: 'COIN_GATE' });
  }
  return 'DONE';
}

function runMainDamage(ctx: Ctx, task: Extract<Task, { kind: 'MAIN_DAMAGE' }>): StepResult {
  const frame = ctx.s.frames[task.frameId];
  if (!frame || frame.failed || !frame.attackId || !frame.sourceEntityId) return 'DONE';
  const attacker = locate(ctx.s, frame.sourceEntityId);
  if (!attacker) return 'DONE';
  const attack = cardDef(ctx, frame.sourceCardId).attacks.find((a) => a.id === frame.attackId);
  if (!attack) return 'DONE';
  const st = ctx.s.stats[frame.controller];
  if (!st.attackers.includes(frame.sourceEntityId)) st.attackers.push(frame.sourceEntityId);
  if (!attack.damageTarget || (attack.baseDamage === 0 && !attack.damageFormula)) return 'DONE';
  // Dano não é “efeito”: PREVENT_EFFECTS não filtra o alvo do dano principal (PREVENT_DAMAGE cuida dele).
  const ids = selectTargets(ctx, frame, task, 'mainTarget', attack.damageTarget, 'ATTACK_TARGET', false);
  if (ids === 'SUSPEND') return ids;
  const statics = collectStatics(ctx);
  for (const id of ids) {
    if (!locate(ctx.s, id)) continue;
    const fc = { ...frameSelectorContext(frame), targetEntityId: id };
    const base = attack.damageFormula ? evaluateAmount(ctx, attack.damageFormula, fc) : attack.baseDamage ?? 0;
    const dealt = applyDamage(ctx, {
      sourceEntityId: frame.sourceEntityId, sourcePlayer: frame.controller, targetEntityId: id, base, category: 'ATTACK',
      applyWeakness: true, ignoreDefenderModifiers: false, attackId: attack.id, ignoreDefenderEffects: !!attack.ignoreDefenderEffects,
    }, statics);
    frame.damageDealtByAttack += dealt;
    if (dealt > 0 && !st.damageSources.includes(frame.sourceEntityId)) st.damageSources.push(frame.sourceEntityId);
  }
  return 'DONE';
}

function runFrameEnd(ctx: Ctx, frameId: string, endsTurn: boolean): StepResult {
  const frame = ctx.s.frames[frameId];
  const force = frame?.forceEndTurn ?? false;
  if (frame?.sourceKind === 'TRAINER') {
    const card = ctx.s.cards[frame.sourceCardId];
    const def = cardDef(ctx, frame.sourceCardId);
    if (card && def.category === 'TRAINER' && def.trainerRules.destinationAfterPlay === 'DISCARD') {
      const p = ctx.s.players[card.owner];
      p.discard.push(frame.sourceCardId);
      emit(ctx, 'CARD_DISCARDED', { player: card.owner, cardIds: [frame.sourceCardId], from: 'RESOLUTION', reason: 'TRAINER_RESOLVED' }, { triggerable: false });
    }
  }
  delete ctx.s.frames[frameId];
  const next: Task[] = [{ kind: 'KO_CHECK' }];
  if ((endsTurn || force) && ctx.s.phase === 'MAIN') next.push({ kind: 'END_TURN' });
  ctx.s.queue.splice(1, 0, ...next);
  return 'DONE';
}

// ---------------------------------------------------------------- gatilhos

type TriggerSource = { controller: PlayerId; cardId: string; entityId: string | null; ability: Ability | null; blocks: readonly EffectBlock[]; trigger: Trigger; sourceKind: Frame['sourceKind'] };

function eventSubject(event: BattleEvent, role: 'TARGET' | 'SOURCE' | undefined): { entityId: string | null; player: PlayerId | null } {
  const d = event.data as Record<string, unknown>;
  switch (event.type) {
    case 'DAMAGE_APPLIED':
      return role === 'SOURCE'
        ? { entityId: (d.sourceEntityId as string) ?? null, player: (d.sourcePlayer as PlayerId) ?? null }
        : { entityId: d.targetEntityId as string, player: d.targetPlayer as PlayerId };
    case 'POKEMON_KNOCKED_OUT':
      return role === 'SOURCE'
        ? { entityId: (d.sourceEntityId as string) ?? null, player: (d.sourcePlayer as PlayerId) ?? null }
        : { entityId: d.entityId as string, player: d.player as PlayerId };
    case 'ENERGY_ATTACHED':
    case 'POKEMON_ENTERED':
    case 'POKEMON_EVOLVED':
    case 'POKEMON_MOVED':
    case 'CONDITION_APPLIED':
    case 'ATTACK_DECLARED':
      return { entityId: d.entityId as string, player: d.player as PlayerId };
    default:
      return { entityId: null, player: (d.player as PlayerId) ?? null };
  }
}

function triggerMatches(event: BattleEvent, source: TriggerSource, turnPlayer: PlayerId): boolean {
  const t = source.trigger;
  if (event.type !== t.event && !(t.event === 'TURN_ENDING' && event.type === 'TURN_ENDING')) return false;
  const f = t.filter ?? {};
  const d = event.data as Record<string, unknown>;
  const subject = eventSubject(event, f.subjectRole);
  if (f.subject) {
    if (f.subject === 'SELF' && subject.entityId !== source.entityId) return false;
    if (f.subject === 'OWN_POKEMON' && subject.player !== source.controller) return false;
    if (f.subject === 'OPPONENT_POKEMON' && (subject.player === null || subject.player === source.controller)) return false;
  }
  if (f.turnOf) {
    // Eventos de turno/Treinador trazem o jogador; nos demais (ex.: dano de ataque), vale o jogador do turno corrente.
    const owner = event.type === 'TURN_STARTED' || event.type === 'TURN_ENDING' || event.type === 'TRAINER_PLAYED' ? (d.player as PlayerId) : turnPlayer;
    if ((owner === source.controller ? 'OWN' : 'OPPONENT') !== f.turnOf) return false;
  }
  if (f.from && d.from !== f.from) return false;
  if (f.reason && d.reason !== f.reason) return false;
  if (f.to && d.to !== f.to) return false;
  if (f.energySource && d.source !== f.energySource) return false;
  if (f.attachmentMode && d.mode !== f.attachmentMode) return false;
  if (f.energyType && d.energyType !== f.energyType) return false;
  if (f.damageCategory && d.category !== f.damageCategory) return false;
  if (f.minimum && (d.amount as number) < f.minimum) return false;
  if (f.condition && d.condition !== f.condition) return false;
  if (f.subtype && d.subtype !== f.subtype) return false;
  if (f.cause && d.cause !== f.cause) return false;
  return true;
}

function triggerSources(ctx: Ctx): TriggerSource[] {
  const out: TriggerSource[] = [];
  const order: PlayerId[] = [ctx.s.currentPlayer, other(ctx.s.currentPlayer)];
  for (const player of order) {
    for (const located of entitiesOf(ctx.s, player)) {
      const def = entityDef(ctx, located.entity);
      if (!isAbilitySuppressed(ctx, located.entity.entityId)) {
        for (const ability of def.abilities) {
          if (ability.kind !== 'TRIGGERED' || !ability.trigger || !ability.sourcePositions.includes(located.position)) continue;
          out.push({ controller: player, cardId: topCardId(located.entity), entityId: located.entity.entityId, ability, blocks: ability.effects, trigger: ability.trigger, sourceKind: 'TRIGGER' });
        }
      }
      if (located.entity.toolCardId) {
        const tool = cardDef(ctx, located.entity.toolCardId);
        if (tool.category === 'TRAINER') {
          const blocks = tool.trainerEffects.filter((b) => b.timing === 'ON_TRIGGER');
          // Gatilho declarado na Ferramenta; sem declaração, “o portador recebe dano de ataque do oponente” (Capacete Rochoso).
          const trigger = tool.trainerRules.toolTrigger ?? DEFAULT_TOOL_TRIGGER;
          if (blocks.length) out.push({ controller: player, cardId: located.entity.toolCardId, entityId: located.entity.entityId, ability: null, blocks, trigger, sourceKind: 'TOOL' });
        }
      }
    }
  }
  // Revide temporário (Arranhões Espinhosos): enquanto durar, dano de ataque ao alvo devolve dano ao atacante.
  for (const effect of ctx.s.activeEffects) {
    const op = effect.operation;
    if (op.type !== 'COUNTER_DAMAGE') continue;
    for (const entityId of staticTargets(ctx, { operation: op, controller: effect.controller, sourceCardId: effect.sourceCardId, sourceEntityId: effect.sourceEntityId, selfEntityId: effect.sourceEntityId, fixedTargets: effect.targets, origin: 'TEMPORARY', effectId: effect.effectId })) {
      out.push({
        controller: effect.controller, cardId: effect.sourceCardId, entityId, ability: null, sourceKind: 'TRIGGER',
        trigger: { event: 'DAMAGE_APPLIED', filter: { subject: 'SELF', subjectRole: 'TARGET', damageCategory: 'ATTACK', turnOf: 'OPPONENT' } },
        blocks: [{ id: `${effect.effectId}-counter`, timing: 'ON_TRIGGER', operation: { type: 'DEAL_DAMAGE', target: { scope: 'EVENT_SOURCE' }, amount: op.amount, category: 'EFFECT' } }],
      });
    }
  }
  return out;
}

// Dano de ataque no turno do oponente = dano de ataque de um Pokémon do oponente (o próprio ataque não aciona).
const DEFAULT_TOOL_TRIGGER: Trigger = { event: 'DAMAGE_APPLIED', filter: { subject: 'SELF', subjectRole: 'TARGET', damageCategory: 'ATTACK', turnOf: 'OPPONENT' } };

function usageKey(scope: string, source: TriggerSource | { entityId: string | null; ability: Ability; cardId: string }, ctx: Ctx): string {
  const ability = source.ability!;
  switch (scope) {
    case 'INSTANCE_TURN': return `turn:${ctx.s.globalTurnNumber}:inst:${source.entityId}:${ability.id}`;
    case 'NAME_TURN': return `turn:${ctx.s.globalTurnNumber}:name:${cardDef(ctx, source.cardId).deckLimitKey}:${ability.id}`;
    case 'PLAYER_TURN': return `turn:${ctx.s.globalTurnNumber}:player:${ability.id}`;
    case 'UNLIMITED': return `turn:${ctx.s.globalTurnNumber}:unlimited:${source.entityId}:${ability.id}`;
    case 'INSTANCE_MATCH': return `match:inst:${source.entityId}:${ability.id}`;
    default: return `match:player:${ability.id}`;
  }
}

export function abilityUsageAvailable(ctx: Ctx, controller: PlayerId, entityId: string | null, cardId: string, ability: Ability): boolean {
  if (!ability.usageLimit || ability.usageLimit.scope === 'UNLIMITED') return true;
  const key = usageKey(ability.usageLimit.scope, { entityId, ability, cardId }, ctx);
  const p = ctx.s.players[controller];
  const used = ability.usageLimit.scope.endsWith('MATCH')
    ? (ability.usageLimit.scope === 'INSTANCE_MATCH' && entityId ? locate(ctx.s, entityId)?.entity.usage[key] ?? 0 : p.matchUsage[key] ?? 0)
    : (ability.usageLimit.scope === 'INSTANCE_TURN' && entityId ? locate(ctx.s, entityId)?.entity.usage[key] ?? 0 : p.flags.usage[key] ?? 0);
  return used < ability.usageLimit.count;
}

export function consumeAbilityUsage(ctx: Ctx, controller: PlayerId, entityId: string | null, cardId: string, ability: Ability): void {
  if (!ability.usageLimit) return;
  const key = usageKey(ability.usageLimit.scope, { entityId, ability, cardId }, ctx);
  const p = ctx.s.players[controller];
  const entity = entityId ? locate(ctx.s, entityId)?.entity : undefined;
  const bag = ability.usageLimit.scope === 'INSTANCE_TURN' || ability.usageLimit.scope === 'INSTANCE_MATCH'
    ? entity?.usage ?? p.flags.usage
    : ability.usageLimit.scope.endsWith('MATCH') ? p.matchUsage : p.flags.usage;
  bag[key] = (bag[key] ?? 0) + 1;
}

function enqueueTriggers(ctx: Ctx, parentDepth: number): void {
  if (ctx.triggerable.length === 0) return;
  const events = [...ctx.triggerable];
  ctx.triggerable.length = 0;
  const sources = triggerSources(ctx);
  if (sources.length === 0) return;
  const tasks: Task[] = [];
  for (const event of events) {
    for (const source of sources) {
      if (!triggerMatches(event, source, ctx.s.currentPlayer)) continue;
      if (source.ability) {
        if (!abilityUsageAvailable(ctx, source.controller, source.entityId, source.cardId, source.ability)) continue;
        const sc = { controller: source.controller, selfEntityId: source.entityId, eventSourceEntityId: null, eventTargetEntityId: null, outputs: {} };
        if (!source.ability.conditions.every((c) => evaluateCondition(ctx, c, sc))) continue;
        consumeAbilityUsage(ctx, source.controller, source.entityId, source.cardId, source.ability);
      }
      const depth = parentDepth + 1;
      if (depth > MAX_TRIGGER_DEPTH) throw new Error('EFFECT_LOOP_DETECTED: cadeia de gatilhos acima da profundidade 8');
      const d = event.data as Record<string, unknown>;
      const role = event.type === 'DAMAGE_APPLIED';
      const ko = event.type === 'POKEMON_KNOCKED_OUT';
      const frame = createFrame(ctx, {
        controller: source.controller, sourceKind: source.sourceKind, sourceCardId: source.cardId, sourceEntityId: source.entityId,
        attackId: null, abilityId: source.ability?.id ?? null,
        eventSourceEntityId: role || ko ? (d.sourceEntityId as string | null) ?? null : null,
        eventTargetEntityId: role ? (d.targetEntityId as string) : (d.entityId as string | undefined) ?? null,
        attackTargetEntityId: null, depth,
      });
      emit(ctx, 'ABILITY_TRIGGERED', { player: source.controller, entityId: source.entityId, cardId: source.cardId, abilityId: source.ability?.id ?? null, eventSeq: event.seq }, { triggerable: false });
      for (const block of source.blocks) {
        if (block.timing === 'ON_TRIGGER') tasks.push(blockTask(frame.frameId, block));
      }
      if (source.ability?.optional) {
        const first = tasks.findIndex((t) => t.kind === 'BLOCK' && t.frameId === frame.frameId);
        if (first >= 0) (tasks[first] as { optional: boolean }).optional = true;
      }
      tasks.push({ kind: 'FRAME_END', frameId: frame.frameId, endsTurn: false });
    }
  }
  if (tasks.length) ctx.s.queue.unshift(...tasks);
}

// ---------------------------------------------------------------- Nocaute e fim

export function computeTerminal(ctx: Ctx): MatchResult | null {
  const s = ctx.s;
  const win: Record<PlayerId, boolean> = { A: false, B: false };
  const lose: Record<PlayerId, boolean> = { A: false, B: false };
  for (const p of PLAYERS) {
    if (s.players[p].points >= s.config.pointsToWin) win[p] = true;
    if (!hasPokemonInPlay(s, p)) lose[p] = true;
  }
  for (const p of PLAYERS) if (lose[p]) win[other(p)] = true;
  const winners = PLAYERS.filter((p) => win[p]);
  if (winners.length === 0) return null;
  const points = { A: s.players.A.points, B: s.players.B.points };
  if (winners.length === 2) return { outcome: 'DRAW', winner: null, reason: 'SIMULTANEOUS', points, globalTurnNumber: s.globalTurnNumber };
  const winner = winners[0]!;
  const reason = s.players[winner].points >= s.config.pointsToWin ? 'POINTS' : 'NO_POKEMON';
  return { outcome: 'WIN', winner, reason, points, globalTurnNumber: s.globalTurnNumber };
}

export function finishMatch(ctx: Ctx, result: MatchResult): void {
  ctx.s.result = result;
  ctx.s.phase = 'TERMINAL';
  ctx.s.queue = [];
  ctx.s.pendingDecisions = [];
  if (result.winner) ctx.s.stats[result.winner].ownTurnsAtWin = ctx.s.ownTurns[result.winner];
  emit(ctx, 'MATCH_ENDED', { ...result }, { triggerable: false });
}

/**
 * Causa do Nocaute pelo último dano recebido: dano de ataque do oponente, de efeito ou de condição. Dano de um turno
 * anterior não Nocauteou agora: o Nocaute veio de outra coisa (dano movido, PS perdidos, efeito “é Nocauteado”).
 */
function koCause(ctx: Ctx, located: ReturnType<typeof koCandidates>[number]): 'ATTACK' | 'EFFECT' | 'CONDITION' | 'OTHER' {
  const last = located.entity.lastDamage;
  // Sem `turn` (estado gravado antes do campo existir), vale o turno corrente.
  if (!last || (last.turn ?? ctx.s.globalTurnNumber) !== ctx.s.globalTurnNumber) return 'OTHER';
  if (last.category === 'ATTACK' && last.sourcePlayer !== located.player) return 'ATTACK';
  return last.category;
}

/**
 * Nocaute em duas etapas (gameplay §17): KO_CHECK anuncia o grupo (POKEMON_KNOCKED_OUT) com os Pokémon ainda em campo,
 * para que reações (Pyukumuku, Cursola, Cabo Elétrico, Zoroark) resolvam; KO_RESOLVE tira o grupo de campo e pontua.
 */
function runKoCheck(ctx: Ctx): StepResult {
  cleanseProtected(ctx);
  const pending = new Set(ctx.s.koPending ?? []);
  const group = koCandidates(ctx).filter((l) => !pending.has(l.entity.entityId));
  if (group.length > 0) {
    newGroup(ctx);
    const statics = collectStatics(ctx);
    for (const located of group) {
      const def = entityDef(ctx, located.entity);
      const points = knockoutPoints(ctx, located.entity, statics);
      const scorer = other(located.player);
      const st = ctx.s.stats[scorer];
      st.knockedOutRuleBoxes.push(def.ruleBox);
      for (const role of ctx.s.roleTags[def.deckLimitKey] ?? []) st.knockedOutRoles.push(role);
      if (ctx.s.currentPlayer === scorer && !Object.values(ctx.s.frames).some((f) => f.sourceKind === 'ATTACK')) st.knockoutsWithoutAttack += 1;
      const cause = koCause(ctx, located);
      emit(ctx, 'POKEMON_KNOCKED_OUT', {
        player: located.player, entityId: located.entity.entityId, cardIds: [...located.entity.stack], ruleBox: def.ruleBox,
        points, scorer, position: located.position, benchIndex: located.benchIndex,
        maxHp: maxHp(ctx, located.entity, statics), damage: located.entity.damage, cause,
        sourceEntityId: cause === 'ATTACK' ? located.entity.lastDamage?.sourceEntityId ?? null : null,
        sourcePlayer: cause === 'ATTACK' ? located.entity.lastDamage?.sourcePlayer ?? null : null,
      });
    }
    const ids = group.map((l) => l.entity.entityId);
    ctx.s.koPending = [...pending, ...ids];
    ctx.s.queue.splice(1, 0, { kind: 'KO_RESOLVE', entityIds: ids });
    return 'DONE';
  }
  return finishKoStep(ctx);
}

function runKoResolve(ctx: Ctx, entityIds: readonly string[]): StepResult {
  newGroup(ctx);
  const statics = collectStatics(ctx);
  const grants: { player: PlayerId; points: number; entityId: string }[] = [];
  for (const entityId of entityIds) {
    const located = locate(ctx.s, entityId);
    if (!located) continue;
    const cause = koCause(ctx, located);
    grants.push({ player: other(located.player), points: knockoutPoints(ctx, located.entity, statics), entityId });
    const owner = ctx.s.players[located.player];
    (owner.koLog ??= []).push({ globalTurn: ctx.s.globalTurnNumber, cardId: topCardId(located.entity), cause });
    // Cachecol de Resgate: Nocaute por dano de ataque manda o Pokémon para a mão (a Ferramenta vai ao descarte).
    const tool = located.entity.toolCardId ? cardDef(ctx, located.entity.toolCardId) : null;
    const rescue = cause === 'ATTACK' && tool?.category === 'TRAINER' && tool.trainerRules.onKnockedOut === 'RETURN_TO_HAND';
    const detached = detachEntity(ctx, entityId);
    if (rescue) {
      const toolId = detached.entity.toolCardId!;
      detached.entity.toolCardId = null;
      owner.discard.push(toolId);
      emit(ctx, 'CARD_DISCARDED', { player: located.player, cardIds: [toolId], from: 'FIELD' });
      routeEntityCards(ctx, detached, 'HAND');
    } else routeEntityCards(ctx, detached, 'DISCARD');
  }
  ctx.s.koPending = (ctx.s.koPending ?? []).filter((id) => !entityIds.includes(id));
  ctx.s.koMarked = ctx.s.koMarked.filter((id) => !entityIds.includes(id));
  for (const grant of grants) {
    ctx.s.players[grant.player].points += grant.points;
    emit(ctx, 'POINTS_GRANTED', { player: grant.player, points: grant.points, total: ctx.s.players[grant.player].points, entityId: grant.entityId });
  }
  return finishKoStep(ctx);
}

function finishKoStep(ctx: Ctx): StepResult {
  if ((ctx.s.koPending ?? []).length > 0) return 'DONE';
  const terminal = computeTerminal(ctx);
  if (terminal) {
    finishMatch(ctx, terminal);
    return 'DONE';
  }
  if (PLAYERS.some((p) => !ctx.s.players[p].active && ctx.s.players[p].bench.some(Boolean))) {
    ctx.s.queue.splice(1, 0, { kind: 'PROMOTIONS', choices: {} });
  }
  return 'DONE';
}

function runPromotions(ctx: Ctx, task: Extract<Task, { kind: 'PROMOTIONS' }>): StepResult {
  const needing = PLAYERS.filter((p) => !ctx.s.players[p].active && ctx.s.players[p].bench.some(Boolean));
  const pending: PlayerId[] = [];
  for (const p of needing) {
    const bench = ctx.s.players[p].bench.filter(Boolean).map((e) => e!.entityId);
    const key = `promote-${p}`;
    if (task.choices[key]) continue;
    if (bench.length === 1) { task.choices[key] = [bench[0]!]; continue; }
    pending.push(p);
  }
  if (pending.length > 0) {
    const group = pending.length > 1 ? `promote-${ctx.s.eventSeq}` : null;
    for (const p of pending) {
      const bench = ctx.s.players[p].bench.filter(Boolean).map((e) => e!.entityId);
      requestDecision(ctx, task, `promote-${p}`, p, 'PROMOTE', 'REPLACE_KNOCKED_OUT_ACTIVE', bench, 1, 1, group);
    }
    return 'SUSPEND';
  }
  newGroup(ctx);
  for (const p of needing) {
    const chosen = task.choices[`promote-${p}`]![0];
    const index = ctx.s.players[p].bench.findIndex((e) => e?.entityId === chosen);
    if (index >= 0) swapActive(ctx, p, index, 'PROMOTE', null);
  }
  return 'DONE';
}

// ---------------------------------------------------------------- turno

function runDelayed(ctx: Ctx, boundary: 'START' | 'END', player: PlayerId): void {
  const due = ctx.s.delayedEffects.filter((d) => d.at.boundary === boundary && d.at.player === player && d.at.ownTurn <= ctx.s.ownTurns[player]);
  if (due.length === 0) return;
  ctx.s.delayedEffects = ctx.s.delayedEffects.filter((d) => !due.includes(d));
  const tasks: Task[] = [];
  for (const d of due) {
    // Preso ao espaço: vale o Pokémon que estiver ali agora (Truque Floral).
    const spotHolder = d.spot
      ? (d.spot.position === 'ACTIVE' ? ctx.s.players[d.spot.player].active : ctx.s.players[d.spot.player].bench[d.spot.benchIndex ?? -1] ?? null)
      : null;
    const targetEntityId = d.spot ? spotHolder?.entityId ?? null : d.targetEntityId;
    if (!targetEntityId || !locate(ctx.s, targetEntityId)) continue;
    const frame = createFrame(ctx, {
      controller: d.controller, sourceKind: 'DELAYED', sourceCardId: d.sourceCardId, sourceEntityId: d.sourceEntityId,
      attackId: null, abilityId: null, eventSourceEntityId: d.sourceEntityId, eventTargetEntityId: targetEntityId,
      attackTargetEntityId: targetEntityId, depth: 1,
    });
    emit(ctx, 'DELAYED_EFFECT_TRIGGERED', { delayedId: d.delayedId, targetEntityId });
    d.operations.forEach((operation, i) => tasks.push(blockTask(frame.frameId, { id: `${d.delayedId}-${i}`, operation })));
    tasks.push({ kind: 'FRAME_END', frameId: frame.frameId, endsTurn: false });
  }
  ctx.s.queue.splice(1, 0, ...tasks);
}

function runEndTurn(ctx: Ctx): StepResult {
  const s = ctx.s;
  if (s.phase !== 'MAIN') return 'DONE';
  s.phase = 'BETWEEN_TURNS';
  newGroup(ctx);
  emit(ctx, 'TURN_ENDING', { player: s.currentPlayer, globalTurnNumber: s.globalTurnNumber, ownTurn: s.ownTurns[s.currentPlayer] });
  // Efeitos de fim de turno: jogador atual, depois o outro (gameplay §16.2). Os atrasados do outro jogador
  // vencem apenas no fim do próprio turno dele.
  ctx.s.queue.splice(1, 0, { kind: 'CHECKUP' });
  runDelayed(ctx, 'END', s.currentPlayer);
  return 'DONE';
}

function runCheckup(ctx: Ctx): StepResult {
  const s = ctx.s;
  newGroup(ctx);
  // Expira efeitos temporários do turno que termina.
  const expired = s.activeEffects.filter((e) => e.expiry && e.expiry.player === s.currentPlayer && e.expiry.ownTurn <= s.ownTurns[s.currentPlayer]);
  if (expired.length) {
    s.activeEffects = s.activeEffects.filter((e) => !expired.includes(e));
    for (const e of expired) emit(ctx, 'EFFECT_EXPIRED', { effectId: e.effectId, opcode: e.operation.type });
  }
  const statics = collectStatics(ctx);
  const order: PlayerId[] = [s.currentPlayer, other(s.currentPlayer)];
  for (const player of order) {
    const active = s.players[player].active;
    if (!active) continue;
    const c = active.conditions;
    if (c.poisoned) applyDamage(ctx, { sourceEntityId: null, sourcePlayer: null, targetEntityId: active.entityId, base: poisonDamage(ctx, active, statics), category: 'CONDITION', applyWeakness: false, ignoreDefenderModifiers: true }, statics);
    if (c.burned) applyDamage(ctx, { sourceEntityId: null, sourcePlayer: null, targetEntityId: active.entityId, base: 20, category: 'CONDITION', applyWeakness: false, ignoreDefenderModifiers: true }, statics);
    const lethal = active.damage >= maxHp(ctx, active, statics);
    if (c.burned && !lethal) {
      const face = coin(ctx);
      emit(ctx, 'COIN_RESOLVED', { player, reason: 'BURN_RECOVERY', results: [face], entityId: active.entityId });
      if (face === 'HEADS') { c.burned = false; emit(ctx, 'CONDITION_REMOVED', { entityId: active.entityId, player, condition: 'BURNED', cause: 'RECOVERY' }); }
    }
    if (c.control === 'ASLEEP' && !lethal) {
      const face = coin(ctx);
      emit(ctx, 'COIN_RESOLVED', { player, reason: 'SLEEP_RECOVERY', results: [face], entityId: active.entityId });
      if (face === 'HEADS') { c.control = null; emit(ctx, 'CONDITION_REMOVED', { entityId: active.entityId, player, condition: 'ASLEEP', cause: 'RECOVERY' }); }
    }
    if (c.control === 'PARALYZED' && player === s.currentPlayer && (c.paralyzedSinceTurn ?? 0) < s.globalTurnNumber) {
      c.control = null;
      c.paralyzedSinceTurn = null;
      emit(ctx, 'CONDITION_REMOVED', { entityId: active.entityId, player, condition: 'PARALYZED', cause: 'EXPIRED' });
    }
  }
  ctx.s.queue.splice(1, 0, { kind: 'KO_CHECK' }, { kind: 'TURN_TRANSITION' });
  return 'DONE';
}

function runTurnTransition(ctx: Ctx): StepResult {
  const s = ctx.s;
  if (s.result) return 'DONE';
  emit(ctx, 'TURN_ENDED', { player: s.currentPlayer, globalTurnNumber: s.globalTurnNumber }, { triggerable: false });
  if (s.globalTurnNumber >= s.config.maximumGlobalTurns) {
    finishMatch(ctx, { outcome: 'DRAW', winner: null, reason: 'TURN_LIMIT', points: { A: s.players.A.points, B: s.players.B.points }, globalTurnNumber: s.globalTurnNumber });
    return 'DONE';
  }
  ctx.s.queue.splice(1, 0, { kind: 'START_TURN', player: other(s.currentPlayer) });
  return 'DONE';
}

export function energyZoneUpdate(ctx: Ctx, player: PlayerId): void {
  const s = ctx.s;
  const zone = s.players[player].energyZone;
  if (zone.types.length === 0) return;
  const firstPlayersFirstTurn = player === s.firstPlayer && s.ownTurns[player] === 1;
  if (firstPlayersFirstTurn) {
    emit(ctx, 'ENERGY_ZONE_UPDATED', { player, ready: zone.ready, next: zone.next, generated: false, reason: 'FIRST_PLAYER_FIRST_TURN' }, { triggerable: false });
    return;
  }
  if (zone.ready === null) {
    zone.ready = zone.next;
    zone.next = zone.types[randomIndex(ctx, zone.types.length)]!;
    emit(ctx, 'ENERGY_ZONE_UPDATED', { player, ready: zone.ready, next: zone.next, generated: true }, { triggerable: false });
  } else {
    emit(ctx, 'ENERGY_ZONE_UPDATED', { player, ready: zone.ready, next: zone.next, generated: false, reason: 'READY_SLOT_OCCUPIED' }, { triggerable: false });
  }
}

function runStartTurn(ctx: Ctx, player: PlayerId): StepResult {
  const s = ctx.s;
  s.currentPlayer = player;
  s.globalTurnNumber += 1;
  s.ownTurns[player] += 1;
  s.phase = 'MAIN';
  const p = s.players[player];
  p.flags = { supporterUsed: false, retreatUsed: false, manualEnergyUsed: false, stadiumPlayed: false, usage: {} };
  for (const id of PLAYERS) delete s.players[id].forceHeads;
  newGroup(ctx);
  emit(ctx, 'TURN_STARTED', { player, globalTurnNumber: s.globalTurnNumber, ownTurn: s.ownTurns[player] });
  drawCards(ctx, player, 1);
  energyZoneUpdate(ctx, player);
  runDelayed(ctx, 'START', player);
  return 'DONE';
}

// ---------------------------------------------------------------- preparação

function runSetup(ctx: Ctx, task: Extract<Task, { kind: 'SETUP' }>): StepResult {
  const s = ctx.s;
  const missing = PLAYERS.filter((p) => !task.choices[`setup-${p}`]);
  if (missing.length > 0) {
    for (const p of missing) {
      const options = s.players[p].hand.filter((id) => { const d = cardDef(ctx, id); return isPokemon(d) && d.stage === 'BASIC'; });
      requestDecision(ctx, task, `setup-${p}`, p, 'SETUP', 'CHOOSE_ACTIVE_AND_BENCH', options, 1, 1 + s.config.benchSlots, 'setup');
    }
    return 'SUSPEND';
  }
  newGroup(ctx);
  for (const p of PLAYERS) {
    const [activeCard, ...benchCards] = task.choices[`setup-${p}`]!;
    const player = s.players[p];
    const active = placeFromHand(ctx, p, activeCard!);
    player.active = active;
    benchCards.forEach((cardId, i) => {
      player.bench[i] = placeFromHand(ctx, p, cardId);
      s.stats[p].benchPlacements += 1;
    });
  }
  for (const p of PLAYERS) {
    const player = s.players[p];
    emit(ctx, 'SETUP_REVEALED', {
      player: p,
      active: player.active ? { entityId: player.active.entityId, cardId: player.active.stack[0] } : null,
      bench: player.bench.map((e) => (e ? { entityId: e.entityId, cardId: e.stack[0] } : null)),
      handCount: player.hand.length,
    }, { triggerable: false });
  }
  ctx.s.queue.splice(1, 0, { kind: 'START_TURN', player: s.firstPlayer });
  return 'DONE';
}

function placeFromHand(ctx: Ctx, player: PlayerId, cardId: string) {
  const p = ctx.s.players[player];
  const index = p.hand.indexOf(cardId);
  if (index >= 0) p.hand.splice(index, 1);
  return {
    entityId: nextId(ctx, 'entity', `pk-${player}`), owner: player, stack: [cardId], damage: 0, energies: [], toolCardId: null,
    conditions: { poisoned: false, burned: false, control: null, paralyzedSinceTurn: null },
    enteredPlayOnTurn: 0, lastEvolvedOnTurn: -1, usage: {},
  };
}

