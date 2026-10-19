// Afordâncias do HUD derivadas do motor (interface §23.12, §24, §25): o que cada carta/entidade
// selecionada pode fazer agora, com o motivo real quando não pode. O motor decide; a UI só traduz.
import { getLegalActions, validateAction } from '../../../domain/battle/engine.ts';
import type { Action, CatalogLookup, MatchState, PlayerId } from '../../../domain/battle/types.ts';
import type { BattleView, CardRef, EntityView } from '../../../domain/battle/views.ts';
import { attackText, damageNotation, catalogNames } from '../../../domain/cards/text.ts';
import { isPokemon, type Attack, type CardDefinition } from '../../../domain/cards/types.ts';
import type { PickTarget } from './Board2D.tsx';

export const REASON_TEXT: Record<string, string> = {
  ABILITY_ALREADY_USED: 'Habilidade já usada neste turno',
  ABILITY_SUPPRESSED: 'Habilidade suprimida por um efeito',
  ADDITIONAL_COST_INVALID: 'Custo adicional não pode ser pago',
  BENCH_FULL: 'Banco cheio',
  CARD_NOT_IN_HAND: 'A carta não está na mão',
  CARD_PRECONDITION_FAILED: 'Condição da carta não atendida',
  EVOLUTION_TOO_EARLY: 'Ainda não pode evoluir',
  INSUFFICIENT_ENERGY: 'Energia insuficiente',
  INVALID_ACTION: 'Ação indisponível agora',
  INVALID_TARGET: 'Sem alvo válido',
  MANUAL_ENERGY_ALREADY_USED: 'Energia manual utilizada neste turno',
  MATCH_ALREADY_FINISHED: 'A partida terminou',
  NOT_YOUR_TURN: 'Não é o seu turno',
  PENDING_DECISION: 'Há uma escolha pendente',
  RETREAT_ALREADY_USED: 'Recuo já usado neste turno',
  SPECIAL_CONDITION_BLOCKS_ACTION: 'Uma condição especial impede esta ação',
  STADIUM_ALREADY_PLAYED: 'Já jogou um Estádio neste turno',
  STADIUM_SAME_NAME: 'Já existe um Estádio com este nome em jogo',
  SUPPORTER_ALREADY_USED: 'Já jogou um Apoiador neste turno',
  TOOL_ALREADY_ATTACHED: 'Este Pokémon já tem uma Ferramenta',
  STATE_VERSION_MISMATCH: 'O estado mudou; tente de novo',
};

export const reasonText = (code: string) => REASON_TEXT[code] ?? 'Ação indisponível agora';

export type HandOption =
  | { readonly kind: 'PLAY_BASIC'; readonly label: string; readonly slots: readonly number[] }
  | { readonly kind: 'EVOLVE'; readonly label: string; readonly targets: readonly string[] }
  | { readonly kind: 'PLAY_TRAINER'; readonly label: string; readonly targets: readonly string[] | null };

export type AttackRow = {
  readonly attack: Attack;
  /** Nome da evolução anterior dona do ataque (Ferramenta/Habilidade que libera os ataques de baixo da pilha). */
  readonly fromName?: string;
  readonly action: Action | null;
  readonly reason: string | null;
  readonly damage: string;
  readonly text: string;
};

export type RetreatInfo = {
  readonly available: boolean;
  readonly reason: string | null;
  readonly cost: number | null;
  readonly options: ReadonlyMap<number, readonly (readonly string[])[]>;
};

/** Soltar um Treinador sem alvo (Item, Apoiador, Estádio) em qualquer ponto do campo. */
export const PLAY_AREA = 'PLAY_AREA';
export const PLAY_AREA_TARGET: PickTarget = { kind: 'SLOT', anchorId: PLAY_AREA };

/** O que uma carta da mão aceita agora (arrastar ou clicar): alvos realçados, jogada sem alvo e motivo do bloqueio. */
export type CardPlan = {
  /** `HUMAN_BENCH_i` (Básico), entityId (evolução, Ferramenta) e/ou `PLAY_AREA` (Treinador sem alvo). */
  readonly targets: readonly string[];
  /** Jogada sem alvo: soltar no campo ou o botão flutuante “Jogar”. */
  readonly play: Action | null;
  /** Por que a carta não pode ser jogada agora; null se pode. */
  readonly reason: string | null;
};

export type DropResult = { readonly ok: true; readonly action: Action } | { readonly ok: false; readonly reason: string };

export type Affordances = {
  readonly legal: readonly Action[];
  readonly hand: (cardId: string) => { readonly options: readonly HandOption[]; readonly reason: string | null };
  readonly plan: (cardId: string) => CardPlan;
  /** Carta solta (ou clicada) sobre um alvo da mesa: a ação legal correspondente ou o motivo da recusa. */
  readonly drop: (cardId: string, target: PickTarget) => DropResult;
  readonly energyTargets: readonly string[];
  readonly energyReason: string | null;
  readonly attacks: readonly AttackRow[];
  readonly abilities: (entityId: string) => readonly { readonly abilityId: string; readonly name: string; readonly action: Action | null; readonly reason: string | null }[];
  readonly retreat: RetreatInfo;
  readonly canEndTurn: boolean;
  readonly fossilDiscard: (entityId: string) => Action | null;
};

export function computeAffordances(state: MatchState, cat: CatalogLookup, view: BattleView, me: PlayerId): Affordances {
  const legal = getLegalActions(state, cat, me);
  const side = view.sides[me];
  const printingOf = (cardId: string) => state.cards[cardId]?.printingId;
  const defOf = (definitionKey: string): CardDefinition => cat.definition(definitionKey);
  const valid = (a: Action) => validateAction(state, cat, a);
  const emptySlots = side.bench.map((b, i) => (b ? -1 : i)).filter((i) => i >= 0);

  const hand = (cardId: string) => {
    const printing = printingOf(cardId);
    // O motor enumera uma ação por impressão; cópias idênticas recebem a mesma ação com o próprio cardId.
    const same = legal.filter((a) => 'cardId' in a && printingOf(a.cardId as string) === printing).map((a) => ({ ...a, cardId }) as Action);
    const options: HandOption[] = [];
    const basic = same.filter((a) => a.type === 'PLAY_BASIC');
    if (basic.length) {
      const slots = emptySlots.filter((i) => valid({ type: 'PLAY_BASIC', player: me, cardId, benchIndex: i }).ok);
      options.push({ kind: 'PLAY_BASIC', label: 'Colocar no Banco', slots });
    }
    const evolve = same.filter((a): a is Extract<Action, { type: 'EVOLVE' }> => a.type === 'EVOLVE');
    if (evolve.length) options.push({ kind: 'EVOLVE', label: 'Evoluir', targets: evolve.map((a) => a.targetEntityId) });
    const trainer = same.filter((a): a is Extract<Action, { type: 'PLAY_TRAINER' }> => a.type === 'PLAY_TRAINER');
    if (trainer.length) {
      const targets = trainer.map((a) => a.targetEntityId).filter((t): t is string => !!t);
      options.push({ kind: 'PLAY_TRAINER', label: targets.length ? 'Prender em…' : 'Jogar', targets: targets.length ? targets : null });
    }
    let reason: string | null = null;
    if (!options.length) {
      const card = state.cards[cardId];
      const def = card ? defOf(card.definitionKey) : null;
      const probe: Action | null = !def ? null
        : isPokemon(def) ? (def.stage === 'BASIC' ? { type: 'PLAY_BASIC', player: me, cardId, benchIndex: emptySlots[0] ?? 0 } : { type: 'EVOLVE', player: me, cardId, targetEntityId: side.active?.entityId ?? '' })
        : { type: 'PLAY_TRAINER', player: me, cardId, ...(def.category === 'TRAINER' && def.subtype === 'TOOL' ? { targetEntityId: side.active?.entityId ?? '' } : {}) };
      const v = probe ? valid(probe) : null;
      reason = v && !v.ok ? reasonText(v.code) : 'Ação indisponível agora';
    }
    return { options, reason };
  };

  const attachLegal = legal.filter((a): a is Extract<Action, { type: 'ATTACH_ENERGY' }> => a.type === 'ATTACH_ENERGY');
  let energyReason: string | null = null;
  if (!attachLegal.length) {
    const v = valid({ type: 'ATTACH_ENERGY', player: me, targetEntityId: side.active?.entityId ?? '' });
    energyReason = !side.energyZone.ready ? 'Nenhuma Energia pronta neste turno' : v.ok ? null : reasonText(v.code);
  }

  const attacks: AttackRow[] = [];
  const active = side.active;
  if (active) {
    const def = defOf(active.top.definitionKey);
    if (isPokemon(def)) {
      for (const attack of def.attacks) {
        const action = legal.find((a) => a.type === 'ATTACK' && a.attackId === attack.id && !a.sourceCardId) ?? null;
        const v = action ? null : valid({ type: 'ATTACK', player: me, attackId: attack.id });
        attacks.push({ attack, action, reason: v && !v.ok ? reasonText(v.code) : null, damage: damageNotation(attack), text: attackText(attack, { nameOf: catalogNames(cat) }) });
      }
    }
    // Ataques das evoluções anteriores que o motor liberou (ação com a carta de baixo da pilha).
    for (const a of legal) {
      if (a.type !== 'ATTACK' || !a.sourceCardId) continue;
      const card = active.stack.find((x) => x.cardId === a.sourceCardId);
      const below = card ? defOf(card.definitionKey) : null;
      const attack = below && isPokemon(below) ? below.attacks.find((x) => x.id === a.attackId) : null;
      if (!attack || attacks.some((r) => r.action === a)) continue;
      attacks.push({ attack, fromName: below!.name, action: a, reason: null, damage: damageNotation(attack), text: attackText(attack, { nameOf: catalogNames(cat) }) });
    }
  }

  const abilities = (entityId: string) => {
    const entity = findEntity(view, entityId);
    if (!entity) return [];
    const def = defOf(entity.top.definitionKey);
    return def.abilities.filter((ab) => ab.kind === 'ACTIVATED').map((ab) => {
      const action: Action = { type: 'USE_ABILITY', player: me, entityId, abilityId: ab.id };
      const ok = legal.some((a) => a.type === 'USE_ABILITY' && a.entityId === entityId && a.abilityId === ab.id);
      const v = ok ? null : valid(action);
      return { abilityId: ab.id, name: ab.name, action: ok ? action : null, reason: v && !v.ok ? reasonText(v.code) : null };
    });
  };

  const retreats = legal.filter((a): a is Extract<Action, { type: 'RETREAT' }> => a.type === 'RETREAT');
  const options = new Map<number, string[][]>();
  for (const r of retreats) options.set(r.benchIndex, [...(options.get(r.benchIndex) ?? []), [...r.energyIds]]);
  let retreatReason: string | null = null;
  if (!retreats.length) {
    const firstBench = side.bench.findIndex((b) => !!b);
    const v = valid({ type: 'RETREAT', player: me, benchIndex: Math.max(0, firstBench), energyIds: [] });
    retreatReason = firstBench < 0 ? 'Nenhum Pokémon no Banco' : !v.ok && v.code !== 'INSUFFICIENT_ENERGY' ? reasonText(v.code) : 'Energia insuficiente para o Recuo';
  }

  const plan = (cardId: string): CardPlan => {
    const { options, reason } = hand(cardId);
    const targets: string[] = [];
    let play: Action | null = null;
    for (const o of options) {
      if (o.kind === 'PLAY_BASIC') targets.push(...o.slots.map((i) => `HUMAN_BENCH_${i}`));
      else if (o.kind === 'EVOLVE' || (o.kind === 'PLAY_TRAINER' && o.targets)) targets.push(...o.targets!);
      else if (o.kind === 'PLAY_TRAINER') {
        play = { type: 'PLAY_TRAINER', player: me, cardId };
        targets.push(PLAY_AREA);
      }
    }
    return { targets: [...new Set(targets)], play, reason: options.length ? null : reason ?? 'Ação indisponível agora' };
  };

  const drop = (cardId: string, target: PickTarget): DropResult => {
    const { options, reason } = hand(cardId);
    const deny = (why: string): DropResult => ({ ok: false, reason: why });
    const accept = (action: Action): DropResult => ({ ok: true, action });
    const bench = target.kind === 'SLOT' ? /^HUMAN_BENCH_([0-2])$/.exec(target.anchorId) : null;
    const entityId = target.kind === 'ENTITY' ? target.entityId : null;
    for (const o of options) {
      if (o.kind === 'PLAY_BASIC' && bench && o.slots.includes(Number(bench[1]))) return accept({ type: 'PLAY_BASIC', player: me, cardId, benchIndex: Number(bench[1]) });
      if (o.kind === 'EVOLVE' && entityId && o.targets.includes(entityId)) return accept({ type: 'EVOLVE', player: me, cardId, targetEntityId: entityId });
      if (o.kind === 'PLAY_TRAINER' && o.targets && entityId && o.targets.includes(entityId)) return accept({ type: 'PLAY_TRAINER', player: me, cardId, targetEntityId: entityId });
    }
    // Treinador sem alvo: qualquer ponto do campo serve.
    if (options.some((o) => o.kind === 'PLAY_TRAINER' && !o.targets)) return accept({ type: 'PLAY_TRAINER', player: me, cardId });
    if (!options.length) return deny(reason ?? 'Ação indisponível agora');
    const card = state.cards[cardId];
    const def = card ? defOf(card.definitionKey) : null;
    const entity = entityId ? findEntity(view, entityId) : null;
    const theirs = !!entity && entity.owner !== me;
    if (def && isPokemon(def) && def.stage === 'BASIC') {
      if (!emptySlots.length) return deny(reasonText('BENCH_FULL'));
      if (theirs || target.kind === 'SLOT' && target.anchorId.startsWith('NPC_')) return deny('Coloque no seu Banco');
      return deny(entity || target.kind === 'SLOT' && target.anchorId !== PLAY_AREA ? 'Este espaço já está ocupado' : 'Solte num espaço vazio do seu Banco');
    }
    if (def && isPokemon(def)) {
      if (!entity) return deny('Solte sobre o Pokémon que vai evoluir');
      if (theirs) return deny('Só pode evoluir os seus Pokémon');
      const v = valid({ type: 'EVOLVE', player: me, cardId, targetEntityId: entity.entityId });
      return deny(!v.ok && v.code === 'EVOLUTION_TOO_EARLY' ? reasonText(v.code) : 'Não evolui deste Pokémon');
    }
    if (!entity) return deny('Solte sobre um dos seus Pokémon');
    if (theirs) return deny('Só pode ir para os seus Pokémon');
    const v = valid({ type: 'PLAY_TRAINER', player: me, cardId, targetEntityId: entity.entityId });
    return deny(v.ok ? 'Ação indisponível agora' : reasonText(v.code));
  };

  return {
    legal, hand, plan, drop, energyTargets: attachLegal.map((a) => a.targetEntityId), energyReason, attacks, abilities,
    retreat: { available: retreats.length > 0, reason: retreatReason, cost: active?.retreatCost ?? null, options },
    canEndTurn: legal.some((a) => a.type === 'END_TURN'),
    fossilDiscard: (entityId) => legal.find((a) => a.type === 'DISCARD_FOSSIL' && a.entityId === entityId) ?? null,
  };
}

export function findEntity(view: BattleView, entityId: string): EntityView | null {
  for (const side of [view.sides.A, view.sides.B]) {
    if (side.active?.entityId === entityId) return side.active;
    for (const b of side.bench) if (b?.entityId === entityId) return b;
  }
  return null;
}

/**
 * Carta pública sob um alvo da mesa (inspeção e prévia por hover): carta da própria mão, topo de uma entidade em
 * jogo (dos dois lados), Estádio ou topo de um descarte. Baralho, mão do adversário e espaços vazios não têm carta.
 */
export function cardRefOf(view: BattleView, t: PickTarget): CardRef | null {
  if (t.kind === 'HAND_CARD') return view.sides[view.viewer].hand?.find((h) => h.cardId === t.cardId) ?? null;
  if (t.kind === 'ENTITY') return findEntity(view, t.entityId)?.top ?? null;
  if (t.kind === 'PILE' && t.anchorId === 'STADIUM') return view.stadium ?? null;
  if (t.kind === 'PILE' && t.anchorId.endsWith('_DISCARD')) {
    const side = view.sides[t.anchorId.startsWith('HUMAN') ? view.viewer : view.viewer === 'A' ? 'B' : 'A'];
    return side.discard[side.discard.length - 1] ?? null;
  }
  return null;
}

export function allEntities(view: BattleView): EntityView[] {
  return [view.sides.A, view.sides.B].flatMap((s) => [s.active, ...s.bench]).filter((e): e is EntityView => !!e);
}
