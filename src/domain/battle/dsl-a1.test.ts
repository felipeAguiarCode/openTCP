// Extensões do DSL exigidas pelo set Genetic Apex (efeitos-dsl.md §3–§9, FX-013…FX-022): Pokémon Defensor fixo,
// Energia extra além do custo, ataque que falha, ligação por fórmula/distribuída, PREVENT_EFFECTS amplo, dano causado
// pelo ataque, filtro de Banco na troca (Fóssil conta como Básico), mover todas as Energias de várias origens e
// embaralhar a mão no baralho. Cartas definidas aqui mesmo (não pertencem ao catálogo de produção).
import { describe, expect, it } from 'vitest';
import { applyAction, redactEvents, validateAction } from './engine.ts';
import { createMatchFromFixture, type BattleFixture, type FixturePokemon, type FixtureSide } from './setup.ts';
import type { Action, BattleEvent, MatchState } from './types.ts';
import { extraEnergyUnits } from './formula.ts';
import { starterCatalog, printingOf, S } from '../../tests/support/starter-catalog.ts';
import { ability, attack, block, c, choose, flip, heads, onPlay, pokemon, post, pre, trainer, SELF } from '../../content/builders.ts';
import type { CardDefinition, Condition, Formula } from '../cards/types.ts';

const tails = (reference = 'coins'): Condition => ({ op: 'COMPARE', left: { op: 'COUNT_TAILS', reference }, cmp: 'GE', right: c(1) });
const atLeastHeads = (n: number, reference = 'coins'): Condition => ({ op: 'COMPARE', left: heads(reference), cmp: 'GE', right: c(n) });
const DEFENDING = { scope: 'DEFENDING' } as const;
const NEXT_OPP = { kind: 'NEXT_OPPONENT_TURN' } as const;

// Muralha: alvo resistente, sem Fraqueza, com ataque barato para testar restrições.
const muralha = pokemon({ baseName: 'Muralha', stage: 'BASIC', type: 'COLORLESS', hp: 300, retreat: 1, weakness: null,
  attacks: [attack({ id: 'empurrao', name: 'Empurrão', cost: {}, damage: 30 })] });
// Omastar/Arbok/Cubone: efeitos presos ao Pokémon Defensor, removidos se ele sair do Ativo.
const fixador = pokemon({ baseName: 'Fixador', stage: 'BASIC', type: 'WATER', hp: 200, retreat: 1, weakness: null,
  attacks: [
    attack({ id: 'trava', name: 'Trava', cost: {}, damage: 10,
      effects: [post({ type: 'RESTRICT_ACTION', target: DEFENDING, actions: ['ATTACK'], duration: { kind: 'NEXT_OPPONENT_TURN', removeOn: ['TARGET_LEAVES_ACTIVE'] } })] }),
    attack({ id: 'osso', name: 'Osso', cost: {}, damage: 0,
      effects: [post({ type: 'MODIFY', stat: 'DAMAGE_DEALT', amount: -20, target: DEFENDING, duration: { kind: 'NEXT_OPPONENT_TURN', removeOn: ['TARGET_LEAVES_ACTIVE'] } })] }),
  ] });
// Uso inválido (o Estúdio e o content-build recusam): DEFENDING num Treinador.
const travaFora = trainer({ baseName: 'Trava Fora', subtype: 'ITEM',
  effects: [onPlay({ type: 'RESTRICT_ACTION', target: DEFENDING, actions: ['ATTACK'], duration: NEXT_OPP }, { failurePolicy: 'BEST_EFFORT' })] });
// Ditto/Mew: copia um ataque de qualquer Pokémon do oponente.
const copiador = pokemon({ baseName: 'Copiador', stage: 'BASIC', type: 'COLORLESS', hp: 200, retreat: 1, weakness: null,
  attacks: [attack({ id: 'copiar', name: 'Copiar', cost: {}, damage: 0, target: null,
    effects: [pre({ type: 'COPY_ATTACK', from: { scope: 'OPPONENT_POKEMON' }, requireEnergy: false })] })] });
// Blastoise: +60 com pelo menos 2 Energias de Água além do custo {W2, C1}.
const canhao = pokemon({ baseName: 'Canhão', stage: 'BASIC', type: 'WATER', hp: 200, retreat: 2, weakness: null,
  attacks: [attack({ id: 'hidro', name: 'Hidrobomba', cost: { WATER: 2, COLORLESS: 1 }, damage: 80,
    effects: [pre({ type: 'MODIFY', stat: 'DAMAGE_DEALT', amount: 60, target: SELF, duration: { kind: 'THIS_TURN' } },
      { condition: { op: 'COMPARE', left: { op: 'EXTRA_ENERGY_UNITS', energyType: 'WATER' }, cmp: 'GE', right: c(2) } })] })] });
// Moltres: moeda; coroa → o ataque não faz nada (nem os blocos seguintes).
const falhador = pokemon({ baseName: 'Falhador', stage: 'BASIC', type: 'FIRE', hp: 200, retreat: 1, weakness: null,
  attacks: [attack({ id: 'mergulho', name: 'Mergulho', cost: {}, damage: 130,
    effects: [pre(flip(1)), pre({ type: 'ATTACK_FAILS' }, { condition: tails() }), post({ type: 'HEAL_DAMAGE', target: SELF, amount: 10 })] })] });
// Moltres ex: 3 moedas; uma Energia de Fogo por cara, cada uma no Pokémon {R} do Banco escolhido.
const dancarino = pokemon({ baseName: 'Dançarino', stage: 'BASIC', type: 'FIRE', hp: 200, retreat: 1, weakness: null,
  attacks: [attack({ id: 'danca', name: 'Dança', cost: {}, damage: 0,
    effects: [pre(flip(3)), post({ type: 'ATTACH_ENERGY', target: { scope: 'OWN_BENCH', filter: { types: ['FIRE'] } }, energyType: 'FIRE', count: heads(), source: 'GENERATED', distribute: true })] })] });
// Misty: moedas até coroa; uma Energia de Água por cara no Pokémon {W} escolhido.
const nevoa = trainer({ baseName: 'Névoa', subtype: 'SUPPORTER', effects: [
  onPlay({ type: 'FLIP_COINS', untilTails: true, outputId: 'misty' }),
  onPlay({ type: 'ATTACH_ENERGY', target: choose('OWN_POKEMON', { types: ['WATER'] }), energyType: 'WATER', count: heads('misty'), source: 'GENERATED' }),
] });
// Dugtrio: moeda; cara → previne dano e efeitos de ataques feitos a ele no próximo turno do oponente.
const cavador = pokemon({ baseName: 'Cavador', stage: 'BASIC', type: 'FIGHTING', hp: 150, retreat: 1, weakness: null,
  attacks: [attack({ id: 'cavar', name: 'Cavar', cost: {}, damage: 10, effects: [
    pre(flip(1)),
    post({ type: 'PREVENT_DAMAGE', target: SELF, categories: ['ATTACK'], amount: 'ALL', duration: NEXT_OPP }, { condition: atLeastHeads(1) }),
    post({ type: 'PREVENT_EFFECTS', target: SELF, fromSide: 'OPPONENT', duration: NEXT_OPP }, { condition: atLeastHeads(1) }),
  ] })] });
// Ataque que tenta todos os efeitos (não dano) no Defensor/Ativo adversário.
const agressor = pokemon({ baseName: 'Agressor', stage: 'BASIC', type: 'DARKNESS', hp: 200, retreat: 1, weakness: null,
  attacks: [
    attack({ id: 'tudo', name: 'Tudo', cost: {}, damage: 40, effects: [
      post({ type: 'DISCARD_ENERGY', target: { scope: 'OPPONENT_ACTIVE' }, count: 1 }),
      post({ type: 'APPLY_CONDITION', target: { scope: 'OPPONENT_ACTIVE' }, condition: 'POISONED' }),
      post({ type: 'RESTRICT_ACTION', target: DEFENDING, actions: ['RETREAT'], duration: NEXT_OPP }),
      post({ type: 'RESTRICT_ACTION', target: { scope: 'OPPONENT_ACTIVE' }, actions: ['ATTACK'], duration: NEXT_OPP }),
      post({ type: 'MODIFY', stat: 'DAMAGE_TAKEN', amount: 30, target: DEFENDING, duration: NEXT_OPP }),
    ] }),
    attack({ id: 'puxao', name: 'Puxão', cost: {}, damage: 0, effects: [post({ type: 'SWITCH_ACTIVE', side: 'OPPONENT', chooser: 'CONTROLLER' })] }),
    attack({ id: 'silencio', name: 'Silêncio', cost: {}, damage: 0,
      effects: [post({ type: 'RESTRICT_ACTION', target: { scope: 'OPPONENT_POKEMON' }, actions: ['PLAY_SUPPORTER'], duration: NEXT_OPP })] }),
  ] });
// Manto Estelar (catálogo c04): proteção dinâmica do próprio Ativo.
const manto = trainer({ baseName: 'Manto Teste', subtype: 'ITEM',
  effects: [onPlay({ type: 'PREVENT_EFFECTS', target: { scope: 'OWN_ACTIVE' }, fromSide: 'OPPONENT', duration: NEXT_OPP })] });
// Kabutops: cura a mesma quantidade de dano que o ataque causou.
const sugador = pokemon({ baseName: 'Sugador', stage: 'BASIC', type: 'FIRE', hp: 200, retreat: 1, weakness: null,
  attacks: [attack({ id: 'sugar', name: 'Sugar', cost: {}, damage: 50, effects: [post({ type: 'HEAL_DAMAGE', target: SELF, amount: { op: 'DAMAGE_DEALT_BY_ATTACK' } })] })] });
// Victreebel: troca o Ativo do oponente por um Básico do Banco dele.
const armadilha = pokemon({ baseName: 'Armadilha', stage: 'BASIC', type: 'GRASS', hp: 150, retreat: 1, weakness: null,
  attacks: [attack({ id: 'cipo', name: 'Cipó', cost: {}, damage: 10 })],
  abilities: [ability({ id: 'aroma', name: 'Aroma', kind: 'ACTIVATED', sourcePositions: ['ACTIVE'], usageLimit: { scope: 'INSTANCE_TURN', count: 1 },
    effects: [block('ON_ACTIVATE', { type: 'SWITCH_ACTIVE', side: 'OPPONENT', chooser: 'CONTROLLER', filter: { stages: ['BASIC'] } })] })] });
const ambar = trainer({ baseName: 'Âmbar Teste', subtype: 'ITEM', effects: [], rules: {
  destinationAfterPlay: 'BENCH_AS_POKEMON', fieldBehavior: { kind: 'PLAY_AS_POKEMON', hp: 40, types: ['COLORLESS'], retreatAllowed: false, knockoutPoints: 1, canAttack: false, ownerMayDiscardDuringMainPhase: true } } });
// Lt. Surge: todas as Energias {L} do Banco para o Raio (por nome) no Ativo.
const raio = pokemon({ baseName: 'Raio', stage: 'BASIC', type: 'LIGHTNING', hp: 120, retreat: 1, weakness: null, attacks: [attack({ id: 'raio', name: 'Raio', cost: { LIGHTNING: 3 }, damage: 90 })] });
const sargento = trainer({ baseName: 'Sargento', subtype: 'SUPPORTER', effects: [onPlay({ type: 'MOVE_ENERGY', from: { scope: 'OWN_BENCH' },
  to: { scope: 'OWN_ACTIVE', filter: { deckLimitKeys: ['raio'] } }, energyType: 'LIGHTNING', count: 'ALL' })] });
// Red Card: o oponente embaralha a mão no baralho e compra 3.
const cartaoVermelho = trainer({ baseName: 'Cartão Vermelho', subtype: 'ITEM', effects: [
  onPlay({ type: 'SHUFFLE_HAND_INTO_DECK', player: 'OPPONENT' }),
  onPlay({ type: 'DRAW_CARDS', player: 'OPPONENT', count: 3 }),
] });

// Poliwrath: revida 20 só quando o dano de ataque chega no turno do oponente; o par com turnOf OWN nunca revida aí.
const revide = (baseName: string, turnOf: 'OWN' | 'OPPONENT') => pokemon({ baseName, stage: 'BASIC', type: 'WATER', hp: 200, retreat: 1, weakness: null,
  attacks: [attack({ id: 'tapa', name: 'Tapa', cost: {}, damage: 10 })],
  abilities: [ability({ id: 'revide', name: 'Revide', kind: 'TRIGGERED', sourcePositions: ['ACTIVE'],
    trigger: { event: 'DAMAGE_APPLIED', filter: { subject: 'SELF', subjectRole: 'TARGET', damageCategory: 'ATTACK', turnOf } },
    effects: [block('ON_TRIGGER', { type: 'DEAL_DAMAGE', target: { scope: 'EVENT_SOURCE' }, amount: 20, category: 'EFFECT' })] })] });
const revideOponente = revide('Revide Oponente', 'OPPONENT');
const revideProprio = revide('Revide Próprio', 'OWN');

const EXTRA: CardDefinition[] = [revideOponente, revideProprio, muralha, fixador, travaFora, copiador, canhao, falhador, dancarino, nevoa, cavador, agressor, manto, sugador, armadilha, ambar, raio, sargento, cartaoVermelho];
const cat = starterCatalog(EXTRA);
const P = (def: CardDefinition) => printingOf(cat, def);
const filler = (n: number) => Array.from({ length: n }, () => P(S.estudioso));

function side(over: Partial<FixtureSide> & { active: FixturePokemon | null }): FixtureSide {
  return { deck: filler(8), hand: [], discard: [], bench: [], energyZone: { types: ['FIRE'], ready: null, next: 'FIRE' }, points: 0, ...over };
}

function fixture(human: FixtureSide, npc: FixtureSide, coins?: ('HEADS' | 'TAILS')[]): MatchState {
  const fx: BattleFixture = {
    fixtureId: 'test', kind: 'TEST', label: 'teste', startPhase: 'MAIN', firstPlayer: 'HUMAN', currentPlayer: 'HUMAN',
    globalTurnNumber: 3, ownTurns: { HUMAN: 2, NPC: 1 }, stadiumPrintingId: null, players: { HUMAN: human, NPC: npc },
    ...(coins ? { scriptedRandom: { coins, label: 'teste' } } : {}),
  };
  return createMatchFromFixture(fx, 'm', 1, cat, (pid) => cat.definitionKeyOfPrinting(pid)).state;
}

type Run = { state: MatchState; events: BattleEvent[] };
function act(run: Run | MatchState, action: Action): Run {
  const state = 'state' in run ? run.state : run;
  const before = 'events' in run ? run.events : [];
  const r = applyAction(state, cat, action);
  if (!r.ok) throw new Error(`${action.type} rejeitada: ${r.code} ${r.message ?? ''}`);
  return { state: r.state, events: [...before, ...r.events] };
}
const code = (state: MatchState, action: Action) => { const v = validateAction(state, cat, action); return v.ok ? 'OK' : v.code; };
const handCard = (state: MatchState, player: 'A' | 'B', def: CardDefinition) => state.players[player].hand.find((id) => state.cards[id]!.definitionKey === `${def.id}@1`)!;
const active = (state: MatchState, p: 'A' | 'B') => state.players[p].active!;
const pending = (run: Run) => run.state.pendingDecisions.find((x) => !x.answered)!;
const answer = (run: Run, pick: (options: readonly string[]) => readonly string[]) => {
  const d = pending(run);
  return act(run, { type: 'RESOLVE_DECISION', player: d.player, decisionId: d.decisionId, selection: pick(d.options) });
};
const cardsOf = (state: MatchState, p: 'A' | 'B') => {
  const s = state.players[p];
  const field = [s.active, ...s.bench].filter(Boolean).flatMap((e) => [...e!.stack, ...(e!.toolCardId ? [e!.toolCardId] : [])]);
  return [...s.deck, ...s.hand, ...s.discard, ...field].sort();
};

describe('FX-013 · seletor DEFENDING fixo no Pokémon Defensor', () => {
  it('a restrição fica na entidade defensora (não na posição) e sai com TARGET_LEAVES_ACTIVE', () => {
    let run = act(fixture(side({ active: { stack: [P(fixador)] } }), side({ active: { stack: [P(muralha)], energies: ['FIRE'] }, bench: [{ stack: [P(muralha)] }] })), { type: 'ATTACK', player: 'A', attackId: 'trava' });
    const defender = active(run.state, 'B').entityId;
    const effect = run.state.activeEffects.find((e) => e.operation.type === 'RESTRICT_ACTION')!;
    expect(effect.targets).toEqual([defender]);
    expect(code(run.state, { type: 'ATTACK', player: 'B', attackId: 'empurrao' })).toBe('SPECIAL_CONDITION_BLOCKS_ACTION');
    // Recuar tira o Defensor do Ativo: o efeito some e o novo Ativo (outra entidade) ataca normalmente.
    run = act(run, { type: 'RETREAT', player: 'B', benchIndex: 0, energyIds: [active(run.state, 'B').energies[0]!.id] });
    expect(run.state.activeEffects.some((e) => e.operation.type === 'RESTRICT_ACTION')).toBe(false);
    expect(code(run.state, { type: 'ATTACK', player: 'B', attackId: 'empurrao' })).toBe('OK');
  });

  it('MODIFY no Defensor: os ataques dele causam −20 no próximo turno do oponente', () => {
    let run = act(fixture(side({ active: { stack: [P(fixador)] } }), side({ active: { stack: [P(muralha)] } })), { type: 'ATTACK', player: 'A', attackId: 'osso' });
    run = act(run, { type: 'ATTACK', player: 'B', attackId: 'empurrao' });
    expect(active(run.state, 'A').damage).toBe(10);
  });

  it('fora de um ataque (Treinador) DEFENDING não resolve para ninguém: nenhum efeito é criado', () => {
    const state = fixture(side({ active: { stack: [P(muralha)] }, hand: [P(travaFora)] }), side({ active: { stack: [P(muralha)] } }));
    const run = act(state, { type: 'PLAY_TRAINER', player: 'A', cardId: handCard(state, 'A', travaFora) });
    expect(run.state.activeEffects).toHaveLength(0);
  });

  it('COPY_ATTACK define o Defensor do ataque copiado (Ditto copiando um efeito de Defensor)', () => {
    let run = act(fixture(side({ active: { stack: [P(copiador)] } }), side({ active: { stack: [P(fixador)] }, bench: [{ stack: [P(muralha)] }] })), { type: 'ATTACK', player: 'A', attackId: 'copiar' });
    // Várias origens (pick ALL em OPPONENT_POKEMON): a escolha lista os ataques do Ativo e do Banco.
    expect(pending(run).kind).toBe('SELECT_ATTACK');
    expect(pending(run).options.length).toBe(3);
    run = answer(run, (o) => [o.find((x) => x.endsWith(':trava'))!]);
    const effect = run.state.activeEffects.find((e) => e.operation.type === 'RESTRICT_ACTION')!;
    expect(effect.targets).toEqual([active(run.state, 'B').entityId]);
    expect(active(run.state, 'B').damage).toBe(10);
  });
});

describe('FX-014 · fórmula EXTRA_ENERGY_UNITS (Energia além do custo do ataque)', () => {
  it('paga os requisitos específicos e o Incolor primeiro com Energia de outro tipo', () => {
    const W = (n: number) => Array.from({ length: n }, () => ({ type: 'WATER' as const, units: 1 }));
    expect(extraEnergyUnits(W(5), { WATER: 2, COLORLESS: 1 }, 'WATER')).toBe(2);
    expect(extraEnergyUnits(W(4), { WATER: 2, COLORLESS: 1 }, 'WATER')).toBe(1);
    expect(extraEnergyUnits([...W(4), { type: 'FIRE', units: 1 }], { WATER: 2, COLORLESS: 1 }, 'WATER')).toBe(2);
    expect(extraEnergyUnits([...W(2), { type: 'FIRE', units: 3 }], { WATER: 2, COLORLESS: 1 }, 'WATER')).toBe(0);
    expect(extraEnergyUnits([...W(4), { type: 'FIRE', units: 1 }], { WATER: 2, COLORLESS: 1 })).toBe(2);
  });

  const hit = (energies: ('WATER' | 'FIRE')[]) => act(fixture(side({ active: { stack: [P(canhao)], energies } }), side({ active: { stack: [P(muralha)] } })), { type: 'ATTACK', player: 'A', attackId: 'hidro' });

  it('Blastoise: 4 Água (1 extra) → 80; 5 Água (2 extras) → 140; 4 Água + 1 Fogo (Fogo paga o Incolor) → 140', () => {
    expect(active(hit(['WATER', 'WATER', 'WATER', 'WATER']).state, 'B').damage).toBe(80);
    expect(active(hit(['WATER', 'WATER', 'WATER', 'WATER', 'WATER']).state, 'B').damage).toBe(140);
    expect(active(hit(['WATER', 'WATER', 'WATER', 'WATER', 'FIRE']).state, 'B').damage).toBe(140);
  });
});

describe('FX-015 · ATTACK_FAILS (o ataque não faz nada)', () => {
  const duel = (coin: 'HEADS' | 'TAILS') => fixture(side({ active: { stack: [P(falhador)], damage: 50 } }), side({ active: { stack: [P(muralha)] } }), [coin]);

  it('coroa: sem dano principal, blocos seguintes ignorados, ATTACK_FAILED (EFFECT) e o turno acaba', () => {
    const run = act(duel('TAILS'), { type: 'ATTACK', player: 'A', attackId: 'mergulho' });
    expect(active(run.state, 'B').damage).toBe(0);
    expect(active(run.state, 'A').damage).toBe(50);
    expect(run.events.find((e) => e.type === 'ATTACK_FAILED')?.data.reason).toBe('EFFECT');
    expect(run.state.currentPlayer).toBe('B');
  });

  it('cara: o ataque resolve normalmente', () => {
    const run = act(duel('HEADS'), { type: 'ATTACK', player: 'A', attackId: 'mergulho' });
    expect(active(run.state, 'B').damage).toBe(130);
    expect(active(run.state, 'A').damage).toBe(40);
    expect(run.events.some((e) => e.type === 'ATTACK_FAILED')).toBe(false);
  });
});

describe('FX-016 · ATTACH_ENERGY com quantidade por fórmula e distribuição por unidade', () => {
  const benchFire = () => side({ active: { stack: [P(dancarino)] }, bench: [{ stack: [P(S.faisca)] }, { stack: [P(S.carvito)] }, { stack: [P(S.broto)] }] });

  it('Moltres ex: 2 caras → 2 escolhas, uma por Energia, só entre Pokémon {R} do Banco', () => {
    let run = act(fixture(benchFire(), side({ active: { stack: [P(muralha)] } }), ['HEADS', 'HEADS', 'TAILS']), { type: 'ATTACK', player: 'A', attackId: 'danca' });
    const bench = run.state.players.A.bench;
    const fire = [bench[0]!.entityId, bench[1]!.entityId];
    expect([...pending(run).options].sort()).toEqual([...fire].sort());
    run = answer(run, () => [fire[0]!]);
    expect([...pending(run).options].sort()).toEqual([...fire].sort());
    run = answer(run, () => [fire[1]!]);
    const after = run.state.players.A.bench;
    expect(after[0]!.energies.map((e) => e.type)).toEqual(['FIRE']);
    expect(after[1]!.energies.map((e) => e.type)).toEqual(['FIRE']);
    expect(after[2]!.energies).toHaveLength(0);
  });

  it('a mesma unidade pode ir duas vezes ao mesmo Pokémon (“como quiser”)', () => {
    let run = act(fixture(benchFire(), side({ active: { stack: [P(muralha)] } }), ['HEADS', 'HEADS', 'TAILS']), { type: 'ATTACK', player: 'A', attackId: 'danca' });
    const target = run.state.players.A.bench[1]!.entityId;
    run = answer(run, () => [target]);
    run = answer(run, () => [target]);
    expect(run.state.players.A.bench[1]!.energies).toHaveLength(2);
  });

  it('quantidade 0 (nenhuma cara) não pede escolha nem liga Energia', () => {
    const run = act(fixture(benchFire(), side({ active: { stack: [P(muralha)] } }), ['TAILS', 'TAILS', 'TAILS']), { type: 'ATTACK', player: 'A', attackId: 'danca' });
    expect(run.state.pendingDecisions).toHaveLength(0);
    expect(run.events.some((e) => e.type === 'ENERGY_ATTACHED')).toBe(false);
  });

  it('Misty: moedas até coroa; todas as Energias no Pokémon {W} escolhido', () => {
    const state = fixture(side({ active: { stack: [P(S.gota)] }, bench: [{ stack: [P(S.nimbo)] }, { stack: [P(S.faisca)] }], hand: [P(nevoa)] }),
      side({ active: { stack: [P(muralha)] } }), ['HEADS', 'HEADS', 'TAILS']);
    let run = act(state, { type: 'PLAY_TRAINER', player: 'A', cardId: handCard(state, 'A', nevoa) });
    const nimbo = run.state.players.A.bench[0]!.entityId;
    expect([...pending(run).options].sort()).toEqual([active(run.state, 'A').entityId, nimbo].sort());
    run = answer(run, () => [nimbo]);
    expect(run.state.players.A.bench[0]!.energies.map((e) => e.type)).toEqual(['WATER', 'WATER']);
    expect(active(run.state, 'A').energies).toHaveLength(0);
  });
});

describe('FX-017 · PREVENT_EFFECTS barra todos os efeitos de ataques do oponente (Dugtrio, Manto Estelar)', () => {
  it('Dugtrio com cara: sem dano, sem descarte, sem condição, sem restrição e sem modificador', () => {
    let run = act(fixture(side({ active: { stack: [P(cavador)], energies: ['FIGHTING'] }, bench: [{ stack: [P(muralha)] }] }), side({ active: { stack: [P(agressor)] } }), ['HEADS']),
      { type: 'ATTACK', player: 'A', attackId: 'cavar' });
    const dugtrio = active(run.state, 'A').entityId;
    run = act(run, { type: 'ATTACK', player: 'B', attackId: 'tudo' });
    const d = active(run.state, 'A');
    expect(d.entityId).toBe(dugtrio);
    expect(d.damage).toBe(0);
    expect(d.energies).toHaveLength(1);
    expect(d.conditions.poisoned).toBe(false);
    expect(run.state.activeEffects.filter((e) => e.controller === 'B')).toHaveLength(0);
  });

  it('Dugtrio com cara: o oponente não consegue tirá-lo do Ativo por efeito de ataque', () => {
    let run = act(fixture(side({ active: { stack: [P(cavador)] }, bench: [{ stack: [P(muralha)] }] }), side({ active: { stack: [P(agressor)] } }), ['HEADS']),
      { type: 'ATTACK', player: 'A', attackId: 'cavar' });
    const dugtrio = active(run.state, 'A').entityId;
    run = act(run, { type: 'ATTACK', player: 'B', attackId: 'puxao' });
    expect(active(run.state, 'A').entityId).toBe(dugtrio);
  });

  it('restrição só de jogador (Apoiadores) não é efeito feito ao Pokémon: continua valendo', () => {
    let run = act(fixture(side({ active: { stack: [P(cavador)] } }), side({ active: { stack: [P(agressor)] } }), ['HEADS']), { type: 'ATTACK', player: 'A', attackId: 'cavar' });
    run = act(run, { type: 'ATTACK', player: 'B', attackId: 'silencio' });
    expect(run.state.activeEffects.some((e) => e.operation.type === 'RESTRICT_ACTION' && e.controller === 'B')).toBe(true);
  });

  it('Dugtrio com coroa: todos os efeitos acontecem', () => {
    let run = act(fixture(side({ active: { stack: [P(cavador)], energies: ['FIGHTING'] } }), side({ active: { stack: [P(agressor)] } }), ['TAILS']),
      { type: 'ATTACK', player: 'A', attackId: 'cavar' });
    run = act(run, { type: 'ATTACK', player: 'B', attackId: 'tudo' });
    const d = active(run.state, 'A');
    expect(d.damage).toBe(50); // 40 do ataque + 10 de Veneno no checkup
    expect(d.energies).toHaveLength(0);
    expect(d.conditions.poisoned).toBe(true);
    expect(run.state.activeEffects.filter((e) => e.controller === 'B').length).toBe(3);
  });

  it('Manto Estelar (OWN_ACTIVE dinâmico): o dano passa, os efeitos não', () => {
    const state = fixture(side({ active: { stack: [P(muralha)], energies: ['FIRE'] }, hand: [P(manto)] }), side({ active: { stack: [P(agressor)] } }));
    let run = act(state, { type: 'PLAY_TRAINER', player: 'A', cardId: handCard(state, 'A', manto) });
    run = act(run, { type: 'END_TURN', player: 'A' });
    run = act(run, { type: 'ATTACK', player: 'B', attackId: 'tudo' });
    const m = active(run.state, 'A');
    expect(m.damage).toBe(40);
    expect(m.energies).toHaveLength(1);
    expect(m.conditions.poisoned).toBe(false);
    expect(run.state.activeEffects.filter((e) => e.controller === 'B')).toHaveLength(0);
  });
});

describe('FX-018 · fórmula DAMAGE_DEALT_BY_ATTACK (Kabutops)', () => {
  it('cura do atacante a mesma quantidade de dano causada pelo ataque (com Fraqueza)', () => {
    const run = act(fixture(side({ active: { stack: [P(sugador)], damage: 100 } }), side({ active: { stack: [P(S.broto)] } })), { type: 'ATTACK', player: 'A', attackId: 'sugar' });
    expect(active(run.state, 'B').damage).toBe(70); // 50 + Fraqueza 20
    expect(active(run.state, 'A').damage).toBe(30);
  });

  it('dano prevenido não cura', () => {
    const state = fixture(side({ active: { stack: [P(sugador)], damage: 100 } }), side({ active: { stack: [P(cavador)] } }), ['HEADS']);
    let run = act({ ...state, currentPlayer: 'B' } as MatchState, { type: 'ATTACK', player: 'B', attackId: 'cavar' });
    run = act(run, { type: 'ATTACK', player: 'A', attackId: 'sugar' });
    expect(active(run.state, 'B').damage).toBe(0);
    expect(active(run.state, 'A').damage).toBe(110);
  });
});

describe('FX-019 · SWITCH_ACTIVE com filtro do Banco; Fóssil conta como Básico', () => {
  it('Victreebel: só Básicos do Banco do oponente entram (Estágio 1 fica de fora)', () => {
    const state = fixture(side({ active: { stack: [P(armadilha)] } }),
      side({ active: { stack: [P(muralha)] }, bench: [{ stack: [P(S.faisca), P(S.braseiro)] }, { stack: [P(S.carvito)] }] }));
    const run = act(state, { type: 'USE_ABILITY', player: 'A', entityId: active(state, 'A').entityId, abilityId: 'aroma' });
    expect(run.state.pendingDecisions).toHaveLength(0);
    expect(active(run.state, 'B').stack.map((id) => run.state.cards[id]!.definitionKey)).toEqual(['carvito@1']);
  });

  it('com dois Básicos o controlador escolhe entre eles; um Fóssil no Banco também é Básico', () => {
    const state = fixture(side({ active: { stack: [P(armadilha)] } }),
      side({ active: { stack: [P(muralha)] }, bench: [{ stack: [P(S.faisca), P(S.braseiro)] }, { stack: [P(S.carvito)] }, { stack: [P(ambar)] }] }));
    let run = act(state, { type: 'USE_ABILITY', player: 'A', entityId: active(state, 'A').entityId, abilityId: 'aroma' });
    const d = pending(run);
    expect(d.player).toBe('A');
    const bench = run.state.players.B.bench;
    expect([...d.options].sort()).toEqual([bench[1]!.entityId, bench[2]!.entityId].sort());
    run = answer(run, () => [bench[2]!.entityId]);
    expect(active(run.state, 'B').stack.map((id) => run.state.cards[id]!.definitionKey)).toEqual(['ambar-teste@1']);
  });

  it('sem Básico no Banco adversário a Habilidade não troca nada', () => {
    const state = fixture(side({ active: { stack: [P(armadilha)] } }), side({ active: { stack: [P(muralha)] }, bench: [{ stack: [P(S.faisca), P(S.braseiro)] }] }));
    const run = act(state, { type: 'USE_ABILITY', player: 'A', entityId: active(state, 'A').entityId, abilityId: 'aroma' });
    expect(active(run.state, 'B').entityId).toBe(active(state, 'B').entityId);
  });
});

describe('FX-020 · MOVE_ENERGY com count ALL e várias origens (Lt. Surge)', () => {
  it('move todas as Energias {L} do Banco para o Raio no Ativo; outras ficam', () => {
    const state = fixture(
      side({ active: { stack: [P(raio)] }, bench: [{ stack: [P(muralha)], energies: ['LIGHTNING', 'FIRE'] }, { stack: [P(S.faisca)], energies: ['LIGHTNING', 'LIGHTNING'] }], hand: [P(sargento)] }),
      side({ active: { stack: [P(muralha)] } }));
    const run = act(state, { type: 'PLAY_TRAINER', player: 'A', cardId: handCard(state, 'A', sargento) });
    expect(run.state.pendingDecisions).toHaveLength(0);
    expect(active(run.state, 'A').energies.map((e) => e.type)).toEqual(['LIGHTNING', 'LIGHTNING', 'LIGHTNING']);
    expect(run.state.players.A.bench[0]!.energies.map((e) => e.type)).toEqual(['FIRE']);
    expect(run.state.players.A.bench[1]!.energies).toHaveLength(0);
    expect(run.events.filter((e) => e.type === 'ENERGY_MOVED')).toHaveLength(3);
  });

  it('sem o Pokémon nomeado no Ativo, ou sem Energia {L} no Banco, o Apoiador não é jogável (REQUIRE_ANY)', () => {
    const state = fixture(side({ active: { stack: [P(muralha)] }, bench: [{ stack: [P(S.faisca)], energies: ['LIGHTNING'] }], hand: [P(sargento)] }), side({ active: { stack: [P(muralha)] } }));
    expect(code(state, { type: 'PLAY_TRAINER', player: 'A', cardId: handCard(state, 'A', sargento) })).toBe('CARD_PRECONDITION_FAILED');
    const noL = fixture(side({ active: { stack: [P(raio)] }, bench: [{ stack: [P(S.faisca)], energies: ['FIRE'] }], hand: [P(sargento)] }), side({ active: { stack: [P(muralha)] } }));
    expect(code(noL, { type: 'PLAY_TRAINER', player: 'A', cardId: handCard(noL, 'A', sargento) })).toBe('CARD_PRECONDITION_FAILED');
  });
});

describe('FX-021 · SHUFFLE_HAND_INTO_DECK (Red Card) e informação oculta', () => {
  it('a mão do oponente vai ao baralho e ele compra 3; o adversário vê só a quantidade', () => {
    const state = fixture(side({ active: { stack: [P(muralha)] }, hand: [P(cartaoVermelho)] }),
      side({ active: { stack: [P(muralha)] }, hand: [P(S.kitReparo), P(S.rastreador), P(S.mentoria), P(S.talisma), P(S.gota)] }));
    const before = cardsOf(state, 'B');
    const run = act(state, { type: 'PLAY_TRAINER', player: 'A', cardId: handCard(state, 'A', cartaoVermelho) });
    expect(run.state.players.B.hand).toHaveLength(3);
    expect(run.state.players.B.deck).toHaveLength(8 + 5 - 3);
    expect(cardsOf(run.state, 'B')).toEqual(before);
    const forA = redactEvents(run.events, 'A').find((e) => e.type === 'HAND_SHUFFLED_INTO_DECK')!;
    expect(forA.data.count).toBe(5);
    expect(forA.data.cardIds).toBeNull();
    const forB = redactEvents(run.events, 'B').find((e) => e.type === 'HAND_SHUFFLED_INTO_DECK')!;
    expect((forB.data.cardIds as string[]).length).toBe(5);
    expect(run.events.some((e) => e.type === 'DECK_SHUFFLED' && e.data.player === 'B')).toBe(true);
  });

  it('com a mão do oponente vazia ainda é jogável (embaralha e compra)', () => {
    const state = fixture(side({ active: { stack: [P(muralha)] }, hand: [P(cartaoVermelho)] }), side({ active: { stack: [P(muralha)] } }));
    const run = act(state, { type: 'PLAY_TRAINER', player: 'A', cardId: handCard(state, 'A', cartaoVermelho) });
    expect(run.state.players.B.hand).toHaveLength(3);
    expect(run.events.some((e) => e.type === 'HAND_SHUFFLED_INTO_DECK')).toBe(false);
  });
});

describe('gatilho DAMAGE_APPLIED com turnOf (Poliwrath)', () => {
  it('turnOf OPPONENT revida o ataque do oponente; turnOf OWN não revida no turno do oponente', () => {
    const hitOn = (def: CardDefinition) => act(fixture(side({ active: { stack: [P(muralha)] } }), side({ active: { stack: [P(def)] } })), { type: 'ATTACK', player: 'A', attackId: 'empurrao' });
    expect(active(hitOn(revideOponente).state, 'A').damage).toBe(20);
    expect(active(hitOn(revideProprio).state, 'A').damage).toBe(0);
  });
});

describe('formulas novas fora de ataque', () => {
  it('EXTRA_ENERGY_UNITS sem ataque corrente conta todas as unidades; DAMAGE_DEALT_BY_ATTACK vale 0', async () => {
    const { evaluateFormula } = await import('./formula.ts');
    const state = fixture(side({ active: { stack: [P(muralha)], energies: ['WATER', 'WATER', 'FIRE'] } }), side({ active: { stack: [P(muralha)] } }));
    const sc = { controller: 'A' as const, selfEntityId: active(state, 'A').entityId, eventSourceEntityId: null, eventTargetEntityId: null, outputs: {} };
    const f = (op: Formula['op'], extra: Partial<Formula> = {}): Formula => ({ op, ...extra });
    expect(evaluateFormula({ s: state, cat }, f('EXTRA_ENERGY_UNITS', { energyType: 'WATER' }), sc)).toBe(2);
    expect(evaluateFormula({ s: state, cat }, f('EXTRA_ENERGY_UNITS'), sc)).toBe(3);
    expect(evaluateFormula({ s: state, cat }, f('DAMAGE_DEALT_BY_ATTACK'), sc)).toBe(0);
  });
});
