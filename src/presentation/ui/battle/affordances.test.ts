// Afordâncias do HUD derivadas do motor (interface §23.12, §24, §25): turno do NPC não habilita ataque humano e
// Habilidade contínua não ganha botão de ativação.
import { describe, expect, it } from 'vitest';
import { attack, continuous, pokemon, SELF } from '../../../content/builders.ts';
import { getPlayerView } from '../../../domain/battle/engine.ts';
import { createMatchFromFixture, type FixtureSide } from '../../../domain/battle/setup.ts';
import type { MatchState } from '../../../domain/battle/types.ts';
import { printingOf, S, starterCatalog } from '../../../tests/support/starter-catalog.ts';
import { cardRefOf, computeAffordances, PLAY_AREA, PLAY_AREA_TARGET } from './affordances.ts';

const guardiao = pokemon({ baseName: 'Guardião', stage: 'BASIC', type: 'METAL', hp: 90, retreat: 1, weakness: null,
  attacks: [attack({ id: 'escudo', name: 'Escudo', cost: {}, damage: 10 })],
  abilities: [{ id: 'couraca', name: 'Couraça', kind: 'CONTINUOUS', sourcePositions: ['ACTIVE'], conditions: [], costs: [], usageLimit: null, endsTurn: false,
    effects: [continuous({ type: 'MODIFY', stat: 'DAMAGE_TAKEN', amount: -10, target: SELF, duration: { kind: 'WHILE_SOURCE_IN_PLAY' } }, { id: 'couraca-1' })] }] });
const cat = starterCatalog([guardiao]);
const P = (def: Parameters<typeof printingOf>[1]) => printingOf(cat, def);

function state(currentPlayer: 'HUMAN' | 'NPC', humanActive = P(S.broto)): MatchState {
  const side = (active: string, energy: 'GRASS' | 'WATER'): FixtureSide => ({
    deck: [P(S.estudioso), P(S.estudioso)], hand: [P(S.semente)], discard: [], active: { stack: [active], energies: [energy] }, bench: [],
    energyZone: { types: [energy], ready: energy, next: energy }, points: 0,
  });
  return createMatchFromFixture({
    fixtureId: 'aff', kind: 'TEST', label: 'afordâncias', startPhase: 'MAIN', firstPlayer: 'HUMAN', currentPlayer, globalTurnNumber: 3,
    ownTurns: { HUMAN: 2, NPC: 1 }, stadiumPrintingId: null, players: { HUMAN: side(humanActive, 'GRASS'), NPC: side(P(S.gota), 'WATER') },
  }, 'aff', 1, cat, (pid) => cat.definitionKeyOfPrinting(pid)).state;
}

describe('afordâncias do HUD', () => {
  it('VS-011: no turno do NPC nenhum ataque, ligação ou fim de turno humano fica habilitado', () => {
    const npcTurn = state('NPC');
    const aff = computeAffordances(npcTurn, cat, getPlayerView(npcTurn, cat, 'A'), 'A');
    expect(aff.legal).toEqual([]);
    expect(aff.attacks.length).toBeGreaterThan(0);
    for (const row of aff.attacks) {
      expect(row.action).toBeNull();
      expect(row.reason).toBe('Não é o seu turno');
    }
    expect(aff.canEndTurn).toBe(false);
    expect(aff.energyTargets).toEqual([]);
    // No próprio turno o mesmo ataque fica disponível.
    const mine = state('HUMAN');
    expect(computeAffordances(mine, cat, getPlayerView(mine, cat, 'A'), 'A').attacks.some((r) => r.action !== null)).toBe(true);
  });

  it('UI-032: Habilidade contínua não possui botão de ativação', () => {
    const s = state('HUMAN', P(guardiao));
    const view = getPlayerView(s, cat, 'A');
    const aff = computeAffordances(s, cat, view, 'A');
    expect(aff.abilities(view.sides.A.active!.entityId)).toEqual([]);
    expect(aff.legal.some((a) => a.type === 'USE_ABILITY')).toBe(false);
  });

  it('prévia por hover: resolve a carta pública sob o alvo, dos dois lados, e nada para cartas ocultas', () => {
    const s = state('HUMAN');
    const view = getPlayerView(s, cat, 'A');
    const hand = view.sides.A.hand![0]!;
    expect(cardRefOf(view, { kind: 'HAND_CARD', cardId: hand.cardId })).toEqual(hand);
    expect(cardRefOf(view, { kind: 'ENTITY', entityId: view.sides.A.active!.entityId })).toEqual(view.sides.A.active!.top);
    expect(cardRefOf(view, { kind: 'ENTITY', entityId: view.sides.B.active!.entityId })).toEqual(view.sides.B.active!.top);
    // Carta que saiu da mão (jogada) ou entidade que saiu de jogo não deixam prévia presa.
    expect(cardRefOf(view, { kind: 'HAND_CARD', cardId: 'carta-que-nao-esta-na-mao' })).toBeNull();
    expect(cardRefOf(view, { kind: 'ENTITY', entityId: 'entidade-fora-de-jogo' })).toBeNull();
    // Baralho, mão do adversário, descarte vazio e espaço vazio não têm face a mostrar.
    expect(cardRefOf(view, { kind: 'PILE', anchorId: 'NPC_DECK_TOP' })).toBeNull();
    expect(cardRefOf(view, { kind: 'PILE', anchorId: 'NPC_DISCARD' })).toBeNull();
    expect(cardRefOf(view, { kind: 'SLOT', anchorId: 'HUMAN_BENCH_0' })).toBeNull();
    expect(cardRefOf(view, { kind: 'PILE', anchorId: 'STADIUM' })).toBeNull();
  });
});

describe('arrastar da mão para o campo (alvos legais e recusa com motivo)', () => {
  function table(currentPlayer: 'HUMAN' | 'NPC') {
    const hand = [S.semente, S.folhariz, S.ramante, S.estudioso, S.talisma].map((d) => P(d));
    const s = createMatchFromFixture({
      fixtureId: 'drag', kind: 'TEST', label: 'arrasto', startPhase: 'MAIN', firstPlayer: 'HUMAN', currentPlayer, globalTurnNumber: 5,
      ownTurns: { HUMAN: 3, NPC: 2 }, stadiumPrintingId: null,
      players: {
        HUMAN: { deck: [P(S.estudioso)], hand, discard: [], active: { stack: [P(S.broto)], energies: ['GRASS'] }, bench: [], energyZone: { types: ['GRASS'], ready: 'GRASS', next: 'GRASS' }, points: 0 },
        NPC: { deck: [P(S.estudioso)], hand: [P(S.gota)], discard: [], active: { stack: [P(S.gota)], energies: ['WATER'] }, bench: [], energyZone: { types: ['WATER'], ready: 'WATER', next: 'WATER' }, points: 0 },
      },
    }, 'drag', 1, cat, (pid) => cat.definitionKeyOfPrinting(pid)).state;
    const view = getPlayerView(s, cat, 'A');
    const aff = computeAffordances(s, cat, view, 'A');
    const card = (def: Parameters<typeof P>[0]) => view.sides.A.hand!.find((h) => h.printingId === P(def))!.cardId;
    return { view, aff, card, mine: view.sides.A.active!.entityId, theirs: view.sides.B.active!.entityId };
  }
  const slot = (anchorId: string) => ({ kind: 'SLOT', anchorId }) as const;
  const entity = (entityId: string) => ({ kind: 'ENTITY', entityId }) as const;
  const reason = (r: ReturnType<ReturnType<typeof table>['aff']['drop']>) => (r.ok ? null : r.reason);

  it('Básico: realça os espaços vazios do Banco; soltar num deles joga, fora deles recusa com o motivo', () => {
    const { aff, card, mine, theirs } = table('HUMAN');
    const id = card(S.semente);
    expect(aff.plan(id)).toEqual({ targets: ['HUMAN_BENCH_0', 'HUMAN_BENCH_1', 'HUMAN_BENCH_2'], play: null, reason: null });
    expect(aff.drop(id, slot('HUMAN_BENCH_1'))).toEqual({ ok: true, action: { type: 'PLAY_BASIC', player: 'A', cardId: id, benchIndex: 1 } });
    expect(reason(aff.drop(id, entity(mine)))).toBe('Este espaço já está ocupado');
    expect(reason(aff.drop(id, entity(theirs)))).toBe('Coloque no seu Banco');
    expect(reason(aff.drop(id, PLAY_AREA_TARGET))).toBe('Solte num espaço vazio do seu Banco');
  });

  it('Evolução: só sobre o Pokémon de que evolui; espaço vazio, adversário ou carta sem base em jogo recusam', () => {
    const { aff, card, mine, theirs } = table('HUMAN');
    const id = card(S.folhariz);
    expect(aff.plan(id).targets).toEqual([mine]);
    expect(aff.drop(id, entity(mine))).toEqual({ ok: true, action: { type: 'EVOLVE', player: 'A', cardId: id, targetEntityId: mine } });
    expect(reason(aff.drop(id, slot('HUMAN_BENCH_0')))).toBe('Solte sobre o Pokémon que vai evoluir');
    expect(reason(aff.drop(id, entity(theirs)))).toBe('Só pode evoluir os seus Pokémon');
    const semBase = card(S.ramante);
    expect(aff.plan(semBase).targets).toEqual([]);
    expect(aff.plan(semBase).reason).toBeTruthy();
    expect(aff.drop(semBase, entity(mine)).ok).toBe(false);
  });

  it('Treinador sem alvo: qualquer ponto do campo joga; Ferramenta só sobre os seus Pokémon', () => {
    const { aff, card, mine, theirs } = table('HUMAN');
    const apoiador = card(S.estudioso);
    const play = { type: 'PLAY_TRAINER', player: 'A', cardId: apoiador };
    expect(aff.plan(apoiador)).toEqual({ targets: [PLAY_AREA], play, reason: null });
    expect(aff.drop(apoiador, PLAY_AREA_TARGET)).toEqual({ ok: true, action: play });
    expect(aff.drop(apoiador, entity(theirs))).toEqual({ ok: true, action: play });
    const ferramenta = card(S.talisma);
    expect(aff.plan(ferramenta).targets).toEqual([mine]);
    expect(aff.drop(ferramenta, entity(mine))).toEqual({ ok: true, action: { type: 'PLAY_TRAINER', player: 'A', cardId: ferramenta, targetEntityId: mine } });
    expect(reason(aff.drop(ferramenta, PLAY_AREA_TARGET))).toBe('Solte sobre um dos seus Pokémon');
    expect(reason(aff.drop(ferramenta, entity(theirs)))).toBe('Só pode ir para os seus Pokémon');
  });

  it('fora do seu turno nada é alvo e a recusa explica o porquê', () => {
    const { aff, card } = table('NPC');
    const id = card(S.semente);
    expect(aff.plan(id).targets).toEqual([]);
    expect(reason(aff.drop(id, slot('HUMAN_BENCH_0')))).toBe('Não é o seu turno');
  });
});
