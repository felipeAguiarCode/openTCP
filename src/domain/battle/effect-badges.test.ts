// Selos de efeito na visão (interface §25.21; UI-181): cada efeito temporário em jogo aparece no Pokémon que ele afeta,
// com o tipo do ícone e o texto; some quando o efeito acaba.
import { describe, expect, it } from 'vitest';
import { applyAction, getPlayerView } from './engine.ts';
import { createMatchFromFixture, type BattleFixture, type FixtureSide } from './setup.ts';
import type { Action, MatchState } from './types.ts';
import { classifyEffect } from './effect-badges.ts';
import { starterCatalog, printingOf, S } from '../../tests/support/starter-catalog.ts';
import { attack, pokemon, post } from '../../content/builders.ts';
import type { CardDefinition } from '../cards/types.ts';

const DEFENDING = { scope: 'DEFENDING' } as const;
const NEXT_OPP = { kind: 'NEXT_OPPONENT_TURN' } as const;
const alvo = pokemon({ baseName: 'Alvo', stage: 'BASIC', type: 'COLORLESS', hp: 300, retreat: 1, weakness: null,
  attacks: [attack({ id: 'empurrao', name: 'Empurrão', cost: {}, damage: 30 })] });
const travador = pokemon({ baseName: 'Travador', stage: 'BASIC', type: 'DARKNESS', hp: 200, retreat: 1, weakness: null,
  attacks: [
    attack({ id: 'trava', name: 'Trava', cost: {}, damage: 10, effects: [
      post({ type: 'RESTRICT_ACTION', target: DEFENDING, actions: ['ATTACK'], duration: NEXT_OPP }),
      post({ type: 'MODIFY', stat: 'DAMAGE_DEALT', amount: -20, target: DEFENDING, duration: NEXT_OPP }),
    ] }),
    attack({ id: 'silencio', name: 'Silêncio', cost: {}, damage: 0,
      effects: [post({ type: 'RESTRICT_ACTION', target: { scope: 'OPPONENT_POKEMON' }, actions: ['PLAY_SUPPORTER'], duration: NEXT_OPP })] }),
  ] });
const cat = starterCatalog([alvo, travador] as CardDefinition[]);
const P = (def: CardDefinition) => printingOf(cat, def);
const side = (over: Partial<FixtureSide>): FixtureSide => ({
  deck: Array.from({ length: 8 }, () => P(S.estudioso)), hand: [], discard: [], bench: [], energyZone: { types: ['FIRE'], ready: null, next: 'FIRE' }, points: 0, active: null, ...over,
});

function start(): MatchState {
  const fx: BattleFixture = {
    fixtureId: 'selos', kind: 'TEST', label: 'selos', startPhase: 'MAIN', firstPlayer: 'HUMAN', currentPlayer: 'HUMAN', globalTurnNumber: 3,
    ownTurns: { HUMAN: 2, NPC: 1 }, stadiumPrintingId: null,
    players: { HUMAN: side({ active: { stack: [P(travador)] } }), NPC: side({ active: { stack: [P(alvo)] }, bench: [{ stack: [P(alvo)] }] }) },
  };
  return createMatchFromFixture(fx, 'm', 1, cat, (pid) => cat.definitionKeyOfPrinting(pid)).state;
}
function act(state: MatchState, action: Action): MatchState {
  const r = applyAction(state, cat, action);
  if (!r.ok) throw new Error(`${action.type}: ${r.code}`);
  return r.state;
}

describe('selos de efeito na visão', () => {
  it('ataque com restrição e modificador: dois selos no Defensor (bloqueio e dano reduzido); nenhum no Banco', () => {
    const state = act(start(), { type: 'ATTACK', player: 'A', attackId: 'trava' });
    const view = getPlayerView(state, cat, 'A');
    const defender = view.sides.B.active!;
    expect(defender.effects.map((e) => [e.kind, e.label])).toEqual([['BAN', 'Não pode atacar'], ['DEBUFF', '−20 de dano nos ataques']]);
    expect(view.sides.B.bench[0]!.effects).toEqual([]);
    expect(view.sides.A.active!.effects).toEqual([]);
  });

  it('restrição só do jogador (Apoiadores) vira um selo no Ativo dele, não em todo Pokémon', () => {
    const state = act(start(), { type: 'ATTACK', player: 'A', attackId: 'silencio' });
    const view = getPlayerView(state, cat, 'B');
    expect(view.sides.B.active!.effects.map((e) => [e.kind, e.label])).toEqual([['PLAY_NEGATIVE', 'Não pode jogar Apoiadores']]);
    expect(view.sides.B.bench[0]!.effects).toEqual([]);
  });

  it('o selo sai quando o efeito acaba (fim do turno seguinte do rival)', () => {
    let state = act(start(), { type: 'ATTACK', player: 'A', attackId: 'trava' });
    expect(getPlayerView(state, cat, 'A').sides.B.active!.effects).toHaveLength(2);
    state = act(state, { type: 'END_TURN', player: 'B' });
    expect(getPlayerView(state, cat, 'A').sides.B.active!.effects).toEqual([]);
  });

  it('tipo do ícone pelo efeito e por quem ele favorece', () => {
    const t = { scope: 'SELF' } as const;
    const d = { kind: 'NEXT_OPPONENT_TURN' } as const;
    expect(classifyEffect({ type: 'PREVENT_DAMAGE', target: t, categories: ['ATTACK'], amount: 'ALL', duration: d }, null)).toEqual({ kind: 'INVALID', label: 'Previne todo o dano' });
    expect(classifyEffect({ type: 'MODIFY', stat: 'DAMAGE_TAKEN', amount: -30, target: t, duration: d }, -30)).toEqual({ kind: 'BUFF', label: '−30 de dano recebido' });
    expect(classifyEffect({ type: 'MODIFY', stat: 'DAMAGE_DEALT', amount: 30, target: t, duration: d }, 30)).toEqual({ kind: 'BUFF', label: '+30 de dano nos ataques' });
    expect(classifyEffect({ type: 'MODIFY', stat: 'RETREAT_COST', amount: 1, target: t, duration: d }, 1)?.kind).toBe('DEBUFF');
    expect(classifyEffect({ type: 'RESTRICT_ACTION', target: t, actions: ['RETREAT'], duration: d }, null)?.kind).toBe('BAN');
    expect(classifyEffect({ type: 'COUNTER_DAMAGE', target: t, duration: d, amount: 20 }, 20)).toEqual({ kind: 'OTHER_POSITIVE', label: 'Devolve 20 de dano a quem atacar' });
    expect(classifyEffect({ type: 'ATTACK_COIN_GATE', target: t, duration: d }, null)?.kind).toBe('OTHER_NEGATIVE');
    expect(classifyEffect({ type: 'MODIFY', stat: 'DAMAGE_DEALT', amount: 0, target: t, duration: d }, 0)).toBeNull();
  });
});
