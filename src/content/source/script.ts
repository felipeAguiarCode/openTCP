// Roteiros de fixtures (tutoriais e puzzles): comandos simbólicos resolvidos contra o estado vivo, para que a solução
// não dependa dos IDs internos gerados pelo motor. `solution` pertence ao HUMANO (A); `npcScript` ao NPC (B).
// Funções puras: usadas pelo content-build, pelos testes e pela aplicação (ajuda “solução comentada”).
import type { EnergyType } from '../../domain/cards/types.ts';
import { applyAction } from '../../domain/battle/engine.ts';
import { createMatchFromFixture, type BattleFixture } from '../../domain/battle/setup.ts';
import type { Action, CatalogLookup, MatchState, PlayerId } from '../../domain/battle/types.ts';
import { other } from '../../domain/battle/types.ts';

export type EntityRef = 'ACTIVE' | 'BENCH:0' | 'BENCH:1' | 'BENCH:2' | 'OPP_ACTIVE' | 'OPP_BENCH:0' | 'OPP_BENCH:1' | 'OPP_BENCH:2';
export type CardRef = { readonly zone: 'HAND' | 'DECK' | 'DISCARD'; readonly printingId: string; readonly nth?: number };
export type EnergyRef = { readonly energyOn: EntityRef; readonly type: EnergyType };
export type SelectRef = EntityRef | CardRef | EnergyRef | 'YES' | 'NO';

export type ScriptCommand =
  | { readonly type: 'PLAY_BASIC'; readonly card: CardRef; readonly benchIndex: number }
  | { readonly type: 'EVOLVE'; readonly card: CardRef; readonly target: EntityRef }
  | { readonly type: 'ATTACH_ENERGY'; readonly target: EntityRef }
  | { readonly type: 'PLAY_TRAINER'; readonly card: CardRef; readonly target?: EntityRef; readonly benchIndex?: number }
  | { readonly type: 'USE_ABILITY'; readonly source: EntityRef; readonly abilityId: string }
  | { readonly type: 'RETREAT'; readonly benchIndex: number; readonly energyTypes: readonly EnergyType[] }
  | { readonly type: 'ATTACK'; readonly attackId: string }
  | { readonly type: 'END_TURN' }
  | { readonly type: 'RESOLVE_DECISION'; readonly select: readonly SelectRef[] };

/** Comando com comentário opcional (`note`), exibido na “solução comentada”; o resolvedor ignora o comentário. */
export type AnnotatedCommand = ScriptCommand & { readonly note?: string };
export type ScriptStep = { readonly actor: 'HUMAN'; readonly command: AnnotatedCommand };
export type NpcScriptStep = { readonly command: ScriptCommand };
export type GuidanceStep = { readonly step: number; readonly text: string; readonly highlight: string | null };

/** Fixture de conteúdo: o contrato do motor + roteiro, solução e dicas (battle-fixture.schema.json). */
export type ContentFixture = BattleFixture & {
  readonly solution?: readonly ScriptStep[];
  readonly npcScript?: readonly NpcScriptStep[];
  readonly guidance?: readonly GuidanceStep[];
};

export const hand = (printingId: string, nth = 0): CardRef => ({ zone: 'HAND', printingId, ...(nth ? { nth } : {}) });
export const fromDeck = (printingId: string, nth = 0): CardRef => ({ zone: 'DECK', printingId, ...(nth ? { nth } : {}) });

function entityOf(state: MatchState, actor: PlayerId, ref: EntityRef): string | null {
  const opp = ref.startsWith('OPP_');
  const side = state.players[opp ? other(actor) : actor];
  const local = opp ? ref.slice(4) : ref;
  if (local === 'ACTIVE') return side.active?.entityId ?? null;
  const index = Number(local.split(':')[1]);
  return side.bench[index]?.entityId ?? null;
}

function cardOf(state: MatchState, actor: PlayerId, ref: CardRef): string | null {
  const p = state.players[actor];
  const zone = ref.zone === 'HAND' ? p.hand : ref.zone === 'DECK' ? p.deck : p.discard;
  const matches = zone.filter((id) => state.cards[id]?.printingId === ref.printingId);
  return matches[ref.nth ?? 0] ?? null;
}

/** Converte um comando simbólico numa ação concreta do motor; null quando a referência não existe no estado. */
export function resolveCommand(state: MatchState, actor: PlayerId, command: ScriptCommand): Action | null {
  switch (command.type) {
    case 'PLAY_BASIC': {
      const cardId = cardOf(state, actor, command.card);
      return cardId ? { type: 'PLAY_BASIC', player: actor, cardId, benchIndex: command.benchIndex } : null;
    }
    case 'EVOLVE': {
      const cardId = cardOf(state, actor, command.card);
      const targetEntityId = entityOf(state, actor, command.target);
      return cardId && targetEntityId ? { type: 'EVOLVE', player: actor, cardId, targetEntityId } : null;
    }
    case 'ATTACH_ENERGY': {
      const targetEntityId = entityOf(state, actor, command.target);
      return targetEntityId ? { type: 'ATTACH_ENERGY', player: actor, targetEntityId } : null;
    }
    case 'PLAY_TRAINER': {
      const cardId = cardOf(state, actor, command.card);
      if (!cardId) return null;
      const targetEntityId = command.target ? entityOf(state, actor, command.target) : undefined;
      if (command.target && !targetEntityId) return null;
      return { type: 'PLAY_TRAINER', player: actor, cardId, ...(targetEntityId ? { targetEntityId } : {}), ...(command.benchIndex !== undefined ? { benchIndex: command.benchIndex } : {}) };
    }
    case 'USE_ABILITY': {
      const entityId = entityOf(state, actor, command.source);
      return entityId ? { type: 'USE_ABILITY', player: actor, entityId, abilityId: command.abilityId } : null;
    }
    case 'RETREAT': {
      const active = state.players[actor].active;
      if (!active) return null;
      const energyIds: string[] = [];
      for (const type of command.energyTypes) {
        const unit = active.energies.find((e) => e.type === type && !energyIds.includes(e.id));
        if (!unit) return null;
        energyIds.push(unit.id);
      }
      return { type: 'RETREAT', player: actor, benchIndex: command.benchIndex, energyIds };
    }
    case 'ATTACK':
      return { type: 'ATTACK', player: actor, attackId: command.attackId };
    case 'END_TURN':
      return { type: 'END_TURN', player: actor };
    case 'RESOLVE_DECISION': {
      const decision = state.pendingDecisions.find((d) => d.player === actor && !d.answered);
      if (!decision) return null;
      const selection: string[] = [];
      for (const ref of command.select) {
        let id: string | null;
        if (typeof ref === 'string') id = ref === 'YES' || ref === 'NO' ? ref : entityOf(state, actor, ref);
        else if ('energyOn' in ref) {
          const entityId = entityOf(state, actor, ref.energyOn);
          const entity = [state.players.A.active, ...state.players.A.bench, state.players.B.active, ...state.players.B.bench].find((e) => e?.entityId === entityId);
          id = entity?.energies.find((e) => e.type === ref.type && !selection.includes(e.id))?.id ?? null;
        } else id = cardOf(state, actor, ref);
        if (!id) return null;
        selection.push(id);
      }
      return { type: 'RESOLVE_DECISION', player: actor, decisionId: decision.decisionId, selection };
    }
    default:
      return null;
  }
}

export type ScriptRun = {
  readonly state: MatchState;
  readonly initial: MatchState;
  readonly actions: readonly Action[];
  readonly error: string | null;
  /** Turno próprio do humano em que a fixture o coloca para jogar pela primeira vez. */
  readonly firstHumanOwnTurn: number;
};

/** Quem deve agir agora: decisão pendente do humano, do NPC, ou o jogador do turno. */
export function nextActor(state: MatchState): PlayerId | null {
  if (state.result) return null;
  const open = state.pendingDecisions.filter((d) => !d.answered);
  if (open.some((d) => d.player === 'A')) return 'A';
  if (open.some((d) => d.player === 'B')) return 'B';
  if (state.phase !== 'MAIN' || state.queue.length > 0) return null;
  return state.currentPlayer;
}

export function firstHumanOwnTurn(fixture: BattleFixture): number {
  if (fixture.startPhase === 'SETUP') return fixture.ownTurns.HUMAN + 1;
  return fixture.currentPlayer === 'HUMAN' ? fixture.ownTurns.HUMAN : fixture.ownTurns.HUMAN + 1;
}

/**
 * Executa a fixture intercalando `solution` (humano) e `npcScript` (NPC) pelo motor real.
 * Para quando a partida termina, quando o roteiro de quem deve agir se esgota, ou num erro de regra.
 */
export function runScript(fixture: ContentFixture, cat: CatalogLookup, resolvePrinting: (printingId: string) => string, seed = 1, maxSteps = 400): ScriptRun {
  const created = createMatchFromFixture(fixture, `script-${fixture.fixtureId}`, seed, cat, resolvePrinting);
  let state = created.state;
  const human = [...(fixture.solution ?? []).map((s) => s.command)];
  const npc = [...(fixture.npcScript ?? []).map((s) => s.command)];
  const actions: Action[] = [];
  let error: string | null = null;
  for (let step = 0; step < maxSteps && !state.result; step += 1) {
    const actor = nextActor(state);
    if (!actor) { error = 'nenhum participante pode agir'; break; }
    const queue = actor === 'A' ? human : npc;
    const command = queue.shift();
    if (!command) break;
    const action = resolveCommand(state, actor, command);
    if (!action) { error = `referência inexistente em ${command.type} (${actor})`; break; }
    const result = applyAction(state, cat, action);
    if (!result.ok) { error = `${command.type} (${actor}) rejeitado: ${result.code} ${result.message ?? ''}`.trim(); break; }
    actions.push(action);
    state = result.state;
  }
  return { state, initial: created.state, actions, error, firstHumanOwnTurn: firstHumanOwnTurn(fixture) };
}
