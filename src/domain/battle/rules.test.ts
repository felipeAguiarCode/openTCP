import { describe, expect, it } from 'vitest';
import { applyAction, getLegalActions, getPlayerView, redactEvents, validateAction } from './engine.ts';
import { createMatch, createMatchFromFixture, type BattleFixture, type FixturePokemon, type FixtureSide } from './setup.ts';
import type { Action, BattleEvent, MatchState } from './types.ts';
import { starterCatalog, starterDeck, printingOf, S } from '../../tests/support/starter-catalog.ts';
import { ability, attack, block, c, choose, continuous, flip, heads, mul, pokemon, post, pre, trainer, onPlay, SELF } from '../../content/builders.ts';
import { jcsHash } from '../hash/jcs.ts';
import type { CardDefinition } from '../cards/types.ts';

// Cartas de teste adicionais (não pertencem ao catálogo de produção).
const exMon = pokemon({ baseName: 'Testex', ruleBox: 'EX', stage: 'BASIC', type: 'FIRE', hp: 30, retreat: 1, weakness: null, attacks: [attack({ id: 'hit', name: 'Hit', cost: {}, damage: 10 })] });
const megaMon = pokemon({ baseName: 'Testemega', ruleBox: 'MEGA_EX', stage: 'BASIC', type: 'FIRE', hp: 30, retreat: 1, weakness: null, attacks: [attack({ id: 'hit', name: 'Hit', cost: {}, damage: 10 })] });
const sleeper = pokemon({ baseName: 'Sonolento', stage: 'BASIC', type: 'PSYCHIC', hp: 100, retreat: 0, weakness: null,
  attacks: [
    attack({ id: 'nap', name: 'Cantiga', cost: {}, damage: 0, effects: [post({ type: 'APPLY_CONDITION', target: { scope: 'OPPONENT_ACTIVE' }, condition: 'ASLEEP' })] }),
    attack({ id: 'confuse', name: 'Neblina', cost: {}, damage: 0, effects: [post({ type: 'APPLY_CONDITION', target: { scope: 'OPPONENT_ACTIVE' }, condition: 'CONFUSED' })] }),
    attack({ id: 'poison', name: 'Toxina', cost: {}, damage: 0, effects: [post({ type: 'APPLY_CONDITION', target: { scope: 'OPPONENT_ACTIVE' }, condition: 'POISONED' })] }),
    attack({ id: 'curse', name: 'Maldição', cost: {}, damage: 0, effects: [post({ type: 'SCHEDULE_DELAYED', target: { scope: 'OPPONENT_ACTIVE' }, at: 'END_OF_OPPONENT_NEXT_TURN', operations: [{ type: 'DEAL_DAMAGE', target: { scope: 'EVENT_TARGET' }, amount: 90, category: 'EFFECT' }], removeOn: ['TARGET_LEAVES_ACTIVE'] })] }),
  ] });
const remover = trainer({ baseName: 'Desmontar', subtype: 'ITEM', effects: [onPlay({ type: 'REMOVE_TOOL', target: choose('OPPONENT_POKEMON', { hasTool: true }), destination: 'DISCARD' }, { failurePolicy: 'REQUIRE_ANY' })] });
const discardMon = trainer({ baseName: 'Descarte Forçado', subtype: 'ITEM', effects: [onPlay({ type: 'DISCARD_POKEMON', target: { scope: 'OPPONENT_ACTIVE' } }, { failurePolicy: 'REQUIRE_ANY' })] });
const stadiumA = trainer({ baseName: 'Praça Teste', subtype: 'STADIUM', effects: [] });
const stadiumB = trainer({ baseName: 'Pátio Teste', subtype: 'STADIUM', effects: [] });
const benchHitter = pokemon({ baseName: 'Mirador', stage: 'BASIC', type: 'LIGHTNING', hp: 60, retreat: 1, weakness: null,
  attacks: [attack({ id: 'snipe', name: 'Disparo', cost: {}, damage: 20, target: choose('OPPONENT_BENCH') })] });
const mover = trainer({ baseName: 'Transferir', subtype: 'ITEM', effects: [onPlay({ type: 'MOVE_ENERGY', from: { scope: 'OWN_ACTIVE' }, to: choose('OWN_BENCH'), count: 1 }, { failurePolicy: 'REQUIRE_ANY' })] });
const zapper = pokemon({ baseName: 'Faisqueiro', stage: 'BASIC', type: 'LIGHTNING', hp: 70, retreat: 1, weakness: null,
  attacks: [attack({ id: 'z', name: 'Z', cost: { LIGHTNING: 1 }, damage: 10 })],
  abilities: [{ id: 'zone-shock', name: 'Descarga', kind: 'TRIGGERED', sourcePositions: ['ACTIVE', 'BENCH'],
    trigger: { event: 'ENERGY_ATTACHED', filter: { subject: 'OPPONENT_POKEMON', energySource: 'ENERGY_ZONE', attachmentMode: 'MANUAL' } },
    conditions: [], costs: [], usageLimit: null, endsTurn: false,
    effects: [{ id: 'zap', timing: 'ON_TRIGGER', operation: { type: 'DEAL_DAMAGE', target: { scope: 'EVENT_TARGET' }, amount: 10, category: 'EFFECT' } }] }] });

// Cartas de teste dos critérios de gameplay (G-*) e da interface sobre o motor (UI-*).
const freeHitter = pokemon({ baseName: 'Ligeiro', stage: 'BASIC', type: 'COLORLESS', hp: 60, retreat: 1, weakness: null,
  attacks: [attack({ id: 'tapa', name: 'Tapa', cost: {}, damage: 10 })] });
const brasamor = pokemon({ baseName: 'Brasamor', stage: 'STAGE_2', from: ['braseiro'], type: 'FIRE', hp: 150, retreat: 2, weakness: 'WATER',
  attacks: [attack({ id: 'inferno', name: 'Inferno', cost: { FIRE: 1 }, damage: 90 })] });
const fornalheiro = pokemon({ baseName: 'Fornalheiro', stage: 'BASIC', type: 'FIRE', hp: 80, retreat: 1, weakness: null,
  attacks: [attack({ id: 'jato', name: 'Jato', cost: { FIRE: 2 }, damage: 30 })] });
const amplificador = trainer({ baseName: 'Amplificador', subtype: 'TOOL',
  effects: [continuous({ type: 'MODIFY', stat: 'ENERGY_PROVISION', amount: 1, energyType: 'FIRE', target: SELF, duration: { kind: 'WHILE_SOURCE_IN_PLAY' } })] });
const gerador = trainer({ baseName: 'Gerador', subtype: 'ITEM',
  effects: [onPlay({ type: 'ATTACH_ENERGY', target: { scope: 'OWN_ACTIVE' }, energyType: 'FIRE', count: 1, source: 'GENERATED' }, { failurePolicy: 'REQUIRE_ANY' })] });
const condicionador = pokemon({ baseName: 'Condicionador', stage: 'BASIC', type: 'PSYCHIC', hp: 100, retreat: 0, weakness: null,
  attacks: [
    attack({ id: 'paralisar', name: 'Paralisar', cost: {}, damage: 0, effects: [post({ type: 'APPLY_CONDITION', target: { scope: 'OPPONENT_ACTIVE' }, condition: 'PARALYZED' })] }),
    attack({ id: 'queimar', name: 'Queimar', cost: {}, damage: 0, effects: [post({ type: 'APPLY_CONDITION', target: { scope: 'OPPONENT_ACTIVE' }, condition: 'BURNED' })] }),
    attack({ id: 'envenenar', name: 'Envenenar', cost: {}, damage: 0, effects: [post({ type: 'APPLY_CONDITION', target: { scope: 'OPPONENT_ACTIVE' }, condition: 'POISONED' })] }),
  ] });
const ricochete = pokemon({ baseName: 'Ricochete', stage: 'BASIC', type: 'FIGHTING', hp: 60, retreat: 1, weakness: null,
  attacks: [attack({ id: 'choque', name: 'Choque', cost: {}, damage: 30, effects: [post({ type: 'DEAL_DAMAGE', target: SELF, amount: 30, category: 'EFFECT' })] })] });
const caminhante = pokemon({ baseName: 'Caminhante', stage: 'BASIC', type: 'COLORLESS', hp: 70, retreat: 0, weakness: null,
  attacks: [attack({ id: 'tapinha', name: 'Tapinha', cost: {}, damage: 10 })],
  abilities: [ability({ id: 'estudo', name: 'Estudo', kind: 'ACTIVATED', sourcePositions: ['ACTIVE'], usageLimit: { scope: 'INSTANCE_TURN', count: 1 },
    effects: [block('ON_ACTIVATE', { type: 'DRAW_CARDS', player: 'OWN', count: 1 })] })] });
const tesoura = pokemon({ baseName: 'Tesoura', stage: 'BASIC', type: 'METAL', hp: 70, retreat: 1, weakness: null,
  attacks: [attack({ id: 'corte', name: 'Corte', cost: {}, damage: 10 })] });
// “Histórico de Scizor” (gameplay §13.7): só a troca por efeito para o Ativo dispara, com a carta do momento.
const tesourao = pokemon({ baseName: 'Tesourão', stage: 'STAGE_1', from: ['tesoura'], type: 'METAL', hp: 110, retreat: 1, weakness: null,
  attacks: [attack({ id: 'tesourada', name: 'Tesourada', cost: {}, damage: 20 })],
  abilities: [ability({ id: 'entrada-afiada', name: 'Entrada Afiada', kind: 'TRIGGERED', sourcePositions: ['ACTIVE'],
    trigger: { event: 'POKEMON_MOVED', filter: { subject: 'SELF', reason: 'SWITCH', to: 'ACTIVE' } },
    effects: [block('ON_TRIGGER', { type: 'DEAL_DAMAGE', target: { scope: 'OPPONENT_ACTIVE' }, amount: 10, category: 'EFFECT' })] })] });
const pressionador = pokemon({ baseName: 'Pressionador', stage: 'BASIC', type: 'DARKNESS', hp: 70, retreat: 1, weakness: null,
  attacks: [attack({ id: 'coacao', name: 'Coação', cost: {}, damage: 0, effects: [post({ type: 'SWITCH_ACTIVE', side: 'OPPONENT', chooser: 'OPPONENT' })] })] });

const moedeiro = pokemon({ baseName: 'Moedeiro', stage: 'BASIC', type: 'COLORLESS', hp: 80, retreat: 1, weakness: null,
  attacks: [attack({ id: 'cara-ou-coroa', name: 'Cara ou Coroa', cost: {}, formula: mul(c(30), heads()), effects: [pre(flip(3))] })] });

const EXTRA: CardDefinition[] = [exMon, megaMon, sleeper, remover, discardMon, stadiumA, stadiumB, benchHitter, mover, zapper,
  freeHitter, brasamor, fornalheiro, amplificador, gerador, condicionador, ricochete, caminhante, tesoura, tesourao, pressionador, moedeiro];
const cat = starterCatalog(EXTRA);
const P = (def: CardDefinition) => printingOf(cat, def);
const filler = (n: number) => Array.from({ length: n }, () => P(S.estudioso));

function side(over: Partial<FixtureSide> & { active: FixturePokemon | null }): FixtureSide {
  return {
    deck: filler(8), hand: [], discard: [], bench: [], energyZone: { types: ['FIRE'], ready: null, next: 'FIRE' }, points: 0, ...over,
  };
}

function fixture(human: FixtureSide, npc: FixtureSide, opts: Partial<Pick<BattleFixture, 'currentPlayer' | 'firstPlayer' | 'globalTurnNumber' | 'ownTurns' | 'stadiumPrintingId'>> & { coins?: ('HEADS' | 'TAILS')[] } = {}): MatchState {
  const fx: BattleFixture = {
    fixtureId: 'test', kind: 'TEST', label: 'teste', startPhase: 'MAIN',
    firstPlayer: opts.firstPlayer ?? 'HUMAN', currentPlayer: opts.currentPlayer ?? 'HUMAN',
    globalTurnNumber: opts.globalTurnNumber ?? 3, ownTurns: opts.ownTurns ?? { HUMAN: 2, NPC: 1 },
    stadiumPrintingId: opts.stadiumPrintingId ?? null, players: { HUMAN: human, NPC: npc },
    ...(opts.coins ? { scriptedRandom: { coins: opts.coins, label: 'teste' } } : {}),
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
const answer = (run: Run, pick: (options: readonly string[]) => readonly string[]) => {
  const d = run.state.pendingDecisions.find((x) => !x.answered)!;
  return act(run, { type: 'RESOLVE_DECISION', player: d.player, decisionId: d.decisionId, selection: pick(d.options) });
};

describe('§18 abertura completa (Fraqueza explícita)', () => {
  it('reproduz a sequência corrigida: 20 → evolução preserva dano → 60 com Fraqueza → 50', () => {
    let run: Run = { state: fixture(
      side({ active: { stack: [P(S.faisca)] }, bench: [{ stack: [P(S.carvito)] }], hand: [P(S.braseiro)], energyZone: { types: ['FIRE'], ready: null, next: 'FIRE' } }),
      side({ active: { stack: [P(S.broto)] }, bench: [{ stack: [P(S.semente)] }], energyZone: { types: ['GRASS'], ready: null, next: 'GRASS' } }),
      { globalTurnNumber: 0, ownTurns: { HUMAN: 0, NPC: 0 } }), events: [] };
    // Turno 1 (A): começa pelo fluxo normal — sem Energia normal no primeiro turno do primeiro jogador.
    run.state = { ...run.state, phase: 'BETWEEN_TURNS', queue: [{ kind: 'START_TURN', player: 'A' }] } as MatchState;
    // Executa a fila inicial via uma decisão nula: END_TURN não é válido aqui, então avançamos pelo motor diretamente.
    const start = applyAction({ ...run.state, phase: 'MAIN', queue: [], currentPlayer: 'B', globalTurnNumber: 0 } as MatchState, cat, { type: 'END_TURN', player: 'B' });
    expect(start.ok).toBe(true);
    run = { state: (start as { state: MatchState }).state, events: [] };
    expect(run.state.currentPlayer).toBe('A');
    expect(run.state.globalTurnNumber).toBe(1);
    expect(run.state.players.A.energyZone.ready).toBeNull();
    expect(code(run.state, { type: 'ATTACK', player: 'A', attackId: 'fagulha' })).toBe('INSUFFICIENT_ENERGY');
    run = act(run, { type: 'END_TURN', player: 'A' });
    // Turno 2 (B): recebe e liga Energia, ataca 20.
    expect(run.state.players.B.energyZone.ready).toBe('GRASS');
    run = act(run, { type: 'ATTACH_ENERGY', player: 'B', targetEntityId: active(run.state, 'B').entityId });
    run = act(run, { type: 'ATTACK', player: 'B', attackId: 'folhinha' });
    expect(active(run.state, 'A').damage).toBe(20);
    // Turno 3 (A): evolui Faísca (em campo desde a preparação), liga e ataca 40 + Fraqueza 20 = 60.
    const braseiroCard = handCard(run.state, 'A', S.braseiro);
    run = act(run, { type: 'EVOLVE', player: 'A', cardId: braseiroCard, targetEntityId: active(run.state, 'A').entityId });
    expect(active(run.state, 'A').damage).toBe(20);
    run = act(run, { type: 'ATTACH_ENERGY', player: 'A', targetEntityId: active(run.state, 'A').entityId });
    run = act(run, { type: 'ATTACK', player: 'A', attackId: 'golpe-de-chama' });
    expect(active(run.state, 'B').damage).toBe(60);
    const dmg = run.events.filter((e) => e.type === 'DAMAGE_APPLIED').pop()!;
    expect((dmg.data.breakdown as { weakness: number }).weakness).toBe(20);
    expect(active(run.state, 'A').energies).toHaveLength(1); // G-012: Energia permanece
    // Turno 4 (B): segunda Energia, ataca 50 → Braseiro 70 de dano, 40 restantes.
    run = act(run, { type: 'ATTACH_ENERGY', player: 'B', targetEntityId: active(run.state, 'B').entityId });
    run = act(run, { type: 'ATTACK', player: 'B', attackId: 'raiz-firme' });
    expect(active(run.state, 'A').damage).toBe(70);
    // Turno 5 (A): 60 Nocauteia Broto (90 HP); B promove a Semente, A marca 1 ponto.
    run = act(run, { type: 'ATTACK', player: 'A', attackId: 'golpe-de-chama' });
    expect(run.state.players.A.points).toBe(1);
    expect(active(run.state, 'B') && run.state.cards[active(run.state, 'B').stack[0]!]!.definitionKey).toBe('semente@1');
  });
});

describe('limites de turno e ações (G-008, G-016, G-018, G-019, G-020, G-022)', () => {
  const base = () => fixture(
    side({ active: { stack: [P(S.faisca)], energies: ['FIRE'] }, bench: [{ stack: [P(S.carvito)] }, { stack: [P(S.faisca)] }], hand: [P(S.estudioso), P(S.mentoria), P(S.carvito), P(S.braseiro)], energyZone: { types: ['FIRE'], ready: 'FIRE', next: 'FIRE' } }),
    side({ active: { stack: [P(S.broto)] } }));

  it('segunda ligação manual e segundo Apoiador são bloqueados', () => {
    let run: Run = { state: base(), events: [] };
    run = act(run, { type: 'ATTACH_ENERGY', player: 'A', targetEntityId: active(run.state, 'A').entityId });
    expect(code(run.state, { type: 'ATTACH_ENERGY', player: 'A', targetEntityId: active(run.state, 'A').entityId })).toBe('INSUFFICIENT_ENERGY');
    run = act(run, { type: 'PLAY_TRAINER', player: 'A', cardId: handCard(run.state, 'A', S.estudioso) });
    expect(code(run.state, { type: 'PLAY_TRAINER', player: 'A', cardId: handCard(run.state, 'A', S.mentoria) })).toBe('SUPPORTER_ALREADY_USED');
  });

  it('Recuo consome o limite e exige pagamento exato', () => {
    let run: Run = { state: base(), events: [] };
    const energy = active(run.state, 'A').energies[0]!.id;
    expect(code(run.state, { type: 'RETREAT', player: 'A', benchIndex: 0, energyIds: [] })).toBe('INSUFFICIENT_ENERGY');
    run = act(run, { type: 'RETREAT', player: 'A', benchIndex: 0, energyIds: [energy] });
    expect(run.state.players.A.discardedEnergy).toHaveLength(1);
    expect(code(run.state, { type: 'RETREAT', player: 'A', benchIndex: 0, energyIds: [] })).toBe('RETREAT_ALREADY_USED');
  });

  it('Banco cheio bloqueia colocação', () => {
    let run: Run = { state: base(), events: [] };
    run = act(run, { type: 'PLAY_BASIC', player: 'A', cardId: handCard(run.state, 'A', S.carvito), benchIndex: 2 });
    expect(run.state.players.A.bench.filter(Boolean)).toHaveLength(3);
    expect(getLegalActions(run.state, cat, 'A').some((a) => a.type === 'PLAY_BASIC')).toBe(false);
  });

  it('Básico colocado neste turno não evolui; primeiro turno próprio não evolui', () => {
    let run: Run = { state: base(), events: [] };
    run = act(run, { type: 'PLAY_BASIC', player: 'A', cardId: handCard(run.state, 'A', S.carvito), benchIndex: 2 });
    const fresh = run.state.players.A.bench[2]!;
    expect(code(run.state, { type: 'EVOLVE', player: 'A', cardId: handCard(run.state, 'A', S.braseiro), targetEntityId: fresh.entityId })).toBe('INVALID_TARGET');
    const firstTurn = fixture(side({ active: { stack: [P(S.faisca)] }, hand: [P(S.braseiro)] }), side({ active: { stack: [P(S.broto)] } }), { globalTurnNumber: 2, ownTurns: { HUMAN: 1, NPC: 1 }, firstPlayer: 'NPC' });
    expect(code(firstTurn, { type: 'EVOLVE', player: 'A', cardId: handCard(firstTurn, 'A', S.braseiro), targetEntityId: active(firstTurn, 'A').entityId })).toBe('EVOLUTION_TOO_EARLY');
  });
});

describe('condições especiais (G-023, G-025, G-026, G-027, G-028)', () => {
  const duel = (coins: ('HEADS' | 'TAILS')[] = []) => fixture(
    side({ active: { stack: [P(sleeper)] }, bench: [{ stack: [P(S.faisca)] }] }),
    side({ active: { stack: [P(S.broto)], energies: ['GRASS'] }, bench: [{ stack: [P(S.semente)] }], energyZone: { types: ['GRASS'], ready: null, next: 'GRASS' } }),
    { coins });

  it('Sono substitui Confusão; Veneno coexiste; Adormecido não ataca nem recua', () => {
    let run: Run = { state: duel(['TAILS', 'TAILS']), events: [] };
    run = act(run, { type: 'ATTACK', player: 'A', attackId: 'confuse' });
    expect(active(run.state, 'B').conditions.control).toBe('CONFUSED');
    run = act(run, { type: 'END_TURN', player: 'B' });
    run = act(run, { type: 'ATTACK', player: 'A', attackId: 'poison' });
    expect(active(run.state, 'B').conditions.poisoned).toBe(true);
    expect(active(run.state, 'B').conditions.control).toBe('CONFUSED');
    expect(active(run.state, 'B').damage).toBe(10); // checkup do turno de A aplicou Veneno
    run = act(run, { type: 'END_TURN', player: 'B' });
    run = act(run, { type: 'ATTACK', player: 'A', attackId: 'nap' });
    expect(active(run.state, 'B').conditions.control).toBe('ASLEEP');
    expect(active(run.state, 'B').conditions.poisoned).toBe(true);
    expect(code(run.state, { type: 'ATTACK', player: 'B', attackId: 'folhinha' })).toBe('SPECIAL_CONDITION_BLOCKS_ACTION');
    expect(code(run.state, { type: 'RETREAT', player: 'B', benchIndex: 0, energyIds: [active(run.state, 'B').energies[0]!.id] })).toBe('SPECIAL_CONDITION_BLOCKS_ACTION');
  });

  it('Confusão com coroa faz o ataque falhar sem dano próprio', () => {
    let run: Run = { state: duel(['TAILS', 'TAILS']), events: [] };
    run = act(run, { type: 'ATTACK', player: 'A', attackId: 'confuse' });
    run = act(run, { type: 'END_TURN', player: 'B' });
    run = act(run, { type: 'END_TURN', player: 'A' });
    const before = active(run.state, 'B').damage;
    run = act(run, { type: 'ATTACK', player: 'B', attackId: 'folhinha' });
    expect(run.events.some((e) => e.type === 'ATTACK_FAILED')).toBe(true);
    expect(active(run.state, 'A').damage).toBe(0);
    expect(active(run.state, 'B').damage).toBe(before);
  });

  it('evoluir ou recuar remove condições', () => {
    let run: Run = { state: duel(['TAILS']), events: [] };
    run = act(run, { type: 'ATTACK', player: 'A', attackId: 'poison' });
    expect(active(run.state, 'B').conditions.poisoned).toBe(true);
    const entity = active(run.state, 'B');
    run = act(run, { type: 'RETREAT', player: 'B', benchIndex: 0, energyIds: [entity.energies[0]!.id] });
    const benched = run.state.players.B.bench.find((e) => e?.entityId === entity.entityId)!;
    expect(benched.conditions.poisoned).toBe(false);
  });
});

describe('pontuação e Nocaute (G-030, G-031, G-032, G-033, G-035)', () => {
  it('ex vale 2, Mega ex vale 3 e a vitória usa >= 3', () => {
    const run = act(fixture(
      side({ active: { stack: [P(S.broto)], energies: ['GRASS'] } }),
      side({ active: { stack: [P(megaMon)], damage: 20 }, bench: [{ stack: [P(exMon)] }] })), { type: 'ATTACK', player: 'A', attackId: 'folhinha' });
    expect(run.state.players.A.points).toBe(3);
    expect(run.state.result?.winner).toBe('A');
    expect(run.state.result?.reason).toBe('POINTS');
    const exRun = act(fixture(side({ active: { stack: [P(S.broto)], energies: ['GRASS'] } }), side({ active: { stack: [P(exMon)], damage: 10 }, bench: [{ stack: [P(S.gota)] }] })), { type: 'ATTACK', player: 'A', attackId: 'folhinha' });
    expect(exRun.state.players.A.points).toBe(2);
  });

  it('descartar por efeito não concede ponto', () => {
    const state = fixture(side({ active: { stack: [P(S.broto)] }, hand: [P(discardMon)] }), side({ active: { stack: [P(S.gota)] }, bench: [{ stack: [P(S.nimbo)] }] }));
    let run = act(state, { type: 'PLAY_TRAINER', player: 'A', cardId: handCard(state, 'A', discardMon) });
    expect(run.state.players.A.points).toBe(0);
    expect(run.state.players.B.active?.stack[0]).toBeDefined();
    run = act(run, { type: 'END_TURN', player: 'A' });
    expect(run.state.players.A.points).toBe(0);
  });

  it('remover Talismã com dano acumulado reavalia Nocaute (sem cura)', () => {
    const state = fixture(
      side({ active: { stack: [P(S.broto)] }, hand: [P(remover)] }),
      side({ active: { stack: [P(S.faisca)], damage: 75, toolPrintingId: P(S.talisma) }, bench: [{ stack: [P(S.gota)] }] }));
    expect(getPlayerView(state, cat, 'A').sides.B.active?.maxHp).toBe(80);
    const run = act(state, { type: 'PLAY_TRAINER', player: 'A', cardId: handCard(state, 'A', remover) });
    expect(run.events.some((e) => e.type === 'POKEMON_KNOCKED_OUT')).toBe(true);
    expect(run.state.players.A.points).toBe(1);
  });

  it('Nocaute do Ativo exige promoção pelo dono; sem Banco a partida termina', () => {
    const state = fixture(side({ active: { stack: [P(S.broto)], energies: ['GRASS'] } }), side({ active: { stack: [P(S.gota)], damage: 60 }, bench: [{ stack: [P(S.nimbo)] }, { stack: [P(S.gota)] }] }));
    let run = act(state, { type: 'ATTACK', player: 'A', attackId: 'folhinha' });
    const decision = run.state.pendingDecisions[0]!;
    expect(decision.kind).toBe('PROMOTE');
    expect(decision.player).toBe('B');
    run = answer(run, (o) => [o[1]!]);
    expect(run.state.players.B.active).not.toBeNull();
    const lonely = fixture(side({ active: { stack: [P(S.broto)], energies: ['GRASS'] } }), side({ active: { stack: [P(S.gota)], damage: 60 } }));
    const end = act(lonely, { type: 'ATTACK', player: 'A', attackId: 'folhinha' });
    expect(end.state.result?.reason).toBe('NO_POKEMON');
  });
});

describe('baralho, mão, Estádio e efeitos (G-037, G-038, G-039, G-041, G-042, G-036, B8)', () => {
  it('compra com baralho vazio não perde; mão cheia não compra', () => {
    let run = act(fixture(side({ active: { stack: [P(S.broto)] } }), side({ active: { stack: [P(S.gota)] }, deck: [] })), { type: 'END_TURN', player: 'A' });
    expect(run.state.result).toBeNull();
    expect(run.events.some((e) => e.type === 'DRAW_SKIPPED' && e.data.reason === 'DECK_EMPTY')).toBe(true);
    run = act(fixture(side({ active: { stack: [P(S.broto)] } }), side({ active: { stack: [P(S.gota)] }, hand: filler(10) })), { type: 'END_TURN', player: 'A' });
    expect(run.state.players.B.hand).toHaveLength(10);
    expect(run.events.some((e) => e.type === 'CARD_DRAWN' && e.data.player === 'B')).toBe(false);
  });

  it('Estádio de mesmo nome é bloqueado; outro nome substitui e vai ao descarte do dono', () => {
    const state = fixture(side({ active: { stack: [P(S.broto)] }, hand: [P(stadiumA), P(stadiumB)] }), side({ active: { stack: [P(S.gota)] } }), { stadiumPrintingId: P(stadiumA), currentPlayer: 'HUMAN' });
    expect(code(state, { type: 'PLAY_TRAINER', player: 'A', cardId: handCard(state, 'A', stadiumA) })).toBe('STADIUM_SAME_NAME');
    const run = act(state, { type: 'PLAY_TRAINER', player: 'A', cardId: handCard(state, 'A', stadiumB) });
    expect(run.state.cards[run.state.stadium!.cardId]!.definitionKey).toBe(`${stadiumB.id}@1`);
    expect(run.state.players.A.discard.some((id) => run.state.cards[id]!.definitionKey === `${stadiumA.id}@1`)).toBe(true);
  });

  it('efeito atrasado removível deixa de ocorrer quando o alvo sai do Ativo (G-039)', () => {
    let run: Run = { state: fixture(
      side({ active: { stack: [P(sleeper)] } }),
      side({ active: { stack: [P(S.broto)] }, bench: [{ stack: [P(S.semente)] }], hand: [P(S.trocaTatica)], energyZone: { types: ['GRASS'], ready: null, next: 'GRASS' } })), events: [] };
    run = act(run, { type: 'ATTACK', player: 'A', attackId: 'curse' });
    expect(run.state.delayedEffects).toHaveLength(1);
    run = act(run, { type: 'PLAY_TRAINER', player: 'B', cardId: handCard(run.state, 'B', S.trocaTatica) });
    expect(run.state.delayedEffects).toHaveLength(0);
    expect(run.state.stats.B.delayedPrevented).toBe(1);
    run = act(run, { type: 'END_TURN', player: 'B' });
    expect(run.state.players.B.bench.every((e) => !e || e.damage === 0)).toBe(true);
  });

  it('efeito atrasado ocorre no fim do próximo turno do adversário se o alvo permanece', () => {
    let run: Run = { state: fixture(
      side({ active: { stack: [P(sleeper)] } }),
      side({ active: { stack: [P(S.broto)] }, bench: [{ stack: [P(S.semente)] }] })), events: [] };
    run = act(run, { type: 'ATTACK', player: 'A', attackId: 'curse' });
    run = act(run, { type: 'END_TURN', player: 'B' });
    expect(run.state.players.B.points + run.state.players.A.points).toBeGreaterThanOrEqual(1);
    expect(run.events.some((e) => e.type === 'DELAYED_EFFECT_TRIGGERED')).toBe(true);
  });

  it('Rastreador sem Básico no baralho não é jogável (B8)', () => {
    const state = fixture(side({ active: { stack: [P(S.broto)] }, hand: [P(S.rastreador)], deck: filler(5) }), side({ active: { stack: [P(S.gota)] } }));
    expect(code(state, { type: 'PLAY_TRAINER', player: 'A', cardId: handCard(state, 'A', S.rastreador) })).toBe('CARD_PRECONDITION_FAILED');
  });

  it('mover Energia não dispara gatilho de ligação da Zona (G-036); ligação manual dispara', () => {
    const state = fixture(
      side({ active: { stack: [P(S.broto)], energies: ['GRASS'] }, bench: [{ stack: [P(S.semente)] }], hand: [P(mover)], energyZone: { types: ['GRASS'], ready: 'GRASS', next: 'GRASS' } }),
      side({ active: { stack: [P(zapper)] } }));
    let run = act(state, { type: 'PLAY_TRAINER', player: 'A', cardId: handCard(state, 'A', mover) });
    expect(run.events.some((e) => e.type === 'ABILITY_TRIGGERED')).toBe(false);
    run = act(run, { type: 'ATTACH_ENERGY', player: 'A', targetEntityId: active(run.state, 'A').entityId });
    expect(run.events.some((e) => e.type === 'ABILITY_TRIGGERED')).toBe(true);
    expect(active(run.state, 'A').damage).toBe(10);
  });

  it('ataque ao Banco escolhe alvo e não aplica Fraqueza', () => {
    const state = fixture(side({ active: { stack: [P(benchHitter)] } }), side({ active: { stack: [P(S.gota)] }, bench: [{ stack: [P(S.nimbo)] }, { stack: [P(S.gota)] }] }));
    let run = act(state, { type: 'ATTACK', player: 'A', attackId: 'snipe' });
    expect(run.state.pendingDecisions[0]?.kind).toBe('SELECT_TARGETS');
    run = answer(run, (o) => [o[0]!]);
    expect(run.state.players.B.bench[0]!.damage).toBe(20);
    expect(active(run.state, 'B').damage).toBe(0);
  });
});

describe('informação oculta (G-053, G-084)', () => {
  it('projeção do adversário não contém mão, ordem do baralho nem RNG', () => {
    const state = fixture(side({ active: { stack: [P(S.broto)] }, hand: [P(S.estudioso)] }), side({ active: { stack: [P(S.gota)] }, hand: [P(S.kitReparo)] }));
    const view = getPlayerView(state, cat, 'B');
    expect(view.sides.A.hand).toBeNull();
    expect(view.sides.A.deckRemaining).toBeNull();
    expect(JSON.stringify(view)).not.toContain('"rng"');
    const run = act(state, { type: 'END_TURN', player: 'A' });
    const forA = redactEvents(run.events, 'A').find((e) => e.type === 'CARD_DRAWN')!;
    expect(forA.data.cardId).toBeNull();
    const forB = redactEvents(run.events, 'B').find((e) => e.type === 'CARD_DRAWN')!;
    expect(forB.data.cardId).not.toBeNull();
  });
});

describe('conteúdo ausente (R-055)', () => {
  it('R-055: definição ausente do catálogo é erro de conteúdo, nunca ataque inventado', () => {
    const state = fixture(side({ active: { stack: [P(moedeiro)] } }), side({ active: { stack: [P(S.broto)] } }));
    const without = starterCatalog();
    expect(() => without.definition(`${moedeiro.id}@1`)).toThrow(/CONTENT_REFERENCE_MISSING/);
    let outcome: string;
    try {
      const r = applyAction(state, without, { type: 'ATTACK', player: 'A', attackId: 'cara-ou-coroa' });
      outcome = r.ok ? 'APPLIED' : r.code;
    } catch (error) {
      outcome = String((error as Error).message);
    }
    expect(outcome).toMatch(/CONTENT_REFERENCE_MISSING/);
    expect(active(state, 'B').damage).toBe(0);
  });
});

describe('compra adversária (G-084)', () => {
  it('G-084: o evento de compra visto pelo adversário só tem dados públicos — sem carta, impressão, raridade ou acabamento', () => {
    const state = fixture(side({ active: { stack: [P(S.broto)] } }), side({ active: { stack: [P(S.gota)] }, deck: [P(S.mentoria), P(S.kitReparo)] }));
    const run = act(state, { type: 'END_TURN', player: 'A' });
    const drawn = run.state.players.B.hand.at(-1)!;
    const card = run.state.cards[drawn]!;
    const forA = redactEvents(run.events, 'A').filter((e) => e.type === 'CARD_DRAWN' || e.type === 'CARDS_DRAWN');
    expect(forA.length).toBeGreaterThan(0);
    const text = JSON.stringify(forA);
    for (const secret of [drawn, card.printingId, card.definitionKey]) expect(text).not.toContain(`"${secret}"`);
    expect(text).not.toMatch(/rarity|finish|flair/i);
    const forB = JSON.stringify(redactEvents(run.events, 'B').filter((e) => e.type === 'CARD_DRAWN' || e.type === 'CARDS_DRAWN'));
    expect(forB).toContain(`"${drawn}"`);
  });
});

describe('Mentoria e limite de turnos', () => {
  it('Mentoria soma 10 apenas ao Ativo adversário neste turno', () => {
    const state = fixture(side({ active: { stack: [P(S.broto)], energies: ['GRASS'] }, hand: [P(S.mentoria)] }), side({ active: { stack: [P(S.semente)] }, bench: [{ stack: [P(S.semente)] }] }));
    let run = act(state, { type: 'PLAY_TRAINER', player: 'A', cardId: handCard(state, 'A', S.mentoria) });
    run = act(run, { type: 'ATTACK', player: 'A', attackId: 'folhinha' });
    expect(active(run.state, 'B').damage).toBe(30);
    expect(run.state.activeEffects).toHaveLength(0);
  });

  it('turno global 60 encerra em empate por limite', () => {
    const state = fixture(side({ active: { stack: [P(S.broto)] } }), side({ active: { stack: [P(S.gota)] } }), { globalTurnNumber: 60, ownTurns: { HUMAN: 30, NPC: 30 }, currentPlayer: 'NPC' });
    const run = act(state, { type: 'END_TURN', player: 'B' });
    expect(run.state.result?.reason).toBe('TURN_LIMIT');
    expect(run.state.result?.outcome).toBe('DRAW');
  });
});

/** Responde a primeira decisão pendente (do dono) escolhendo as opções indicadas. */
const resolvePending = (run: Run, pick: (options: readonly string[]) => readonly string[] = (o) => [o[0]!]): Run =>
  run.state.pendingDecisions.some((d) => !d.answered) ? answer(run, pick) : run;

describe('abertura, evolução e Energia (G-007, G-011, G-013, G-014, G-015, G-017, G-055)', () => {
  it('G-007: ataque sem custo é legal no primeiro turno do primeiro jogador, mesmo sem Energia', () => {
    const state = fixture(side({ active: { stack: [P(freeHitter)] }, energyZone: { types: ['FIRE'], ready: null, next: 'FIRE' } }), side({ active: { stack: [P(S.gota)] } }),
      { globalTurnNumber: 1, ownTurns: { HUMAN: 1, NPC: 0 }, firstPlayer: 'HUMAN' });
    expect(state.players.A.energyZone.ready).toBeNull();
    expect(code(state, { type: 'ATTACK', player: 'A', attackId: 'tapa' })).toBe('OK');
    const run = act(state, { type: 'ATTACK', player: 'A', attackId: 'tapa' });
    expect(active(run.state, 'B').damage).toBe(10);
  });

  it('G-011: duas evoluções normais da mesma linha no mesmo turno — a segunda é bloqueada', () => {
    const state = fixture(side({ active: { stack: [P(S.faisca)] }, hand: [P(S.braseiro), P(brasamor)] }), side({ active: { stack: [P(S.gota)] } }));
    const run = act(state, { type: 'EVOLVE', player: 'A', cardId: handCard(state, 'A', S.braseiro), targetEntityId: active(state, 'A').entityId });
    expect(run.state.cards[active(run.state, 'A').stack.at(-1)!]!.definitionKey).toBe('braseiro@1');
    const second = code(run.state, { type: 'EVOLVE', player: 'A', cardId: handCard(run.state, 'A', brasamor), targetEntityId: active(run.state, 'A').entityId });
    expect(second).not.toBe('OK');
    expect(getLegalActions(run.state, cat, 'A').some((a) => a.type === 'EVOLVE')).toBe(false);
  });

  it('G-013: custo Incolor é pago por Energia de outro tipo', () => {
    const state = fixture(side({ active: { stack: [P(S.marulho)], energies: ['WATER', 'FIRE'] } }), side({ active: { stack: [P(S.broto)] } }));
    expect(code(state, { type: 'ATTACK', player: 'A', attackId: 'onda-quebrada' })).toBe('OK');
    expect(active(act(state, { type: 'ATTACK', player: 'A', attackId: 'onda-quebrada' }).state, 'B').damage).toBe(50);
  });

  it('G-014/G-015: aura de fornecimento não duplica o anexo; removida, o custo é recalculado sem perder a Energia', () => {
    const state = fixture(
      side({ active: { stack: [P(fornalheiro)], energies: ['FIRE'], toolPrintingId: P(amplificador) } }),
      side({ active: { stack: [P(S.gota)] }, hand: [P(remover)] }));
    const view = getPlayerView(state, cat, 'A').sides.A.active!;
    expect(view.energies).toEqual([expect.objectContaining({ type: 'FIRE', units: 2 })]);
    expect(code(state, { type: 'ATTACK', player: 'A', attackId: 'jato' })).toBe('OK');
    let run = act(state, { type: 'ATTACK', player: 'A', attackId: 'jato' });
    expect(active(run.state, 'B').damage).toBe(30);
    expect(active(run.state, 'A').energies).toHaveLength(1);
    // O adversário remove a Ferramenta: o mesmo anexo volta a fornecer 1 unidade e o custo 2 deixa de ser pago.
    run = act(run, { type: 'PLAY_TRAINER', player: 'B', cardId: handCard(run.state, 'B', remover) });
    run = resolvePending(run);
    expect(active(run.state, 'A').toolCardId).toBeNull();
    run = act(run, { type: 'END_TURN', player: 'B' });
    expect(active(run.state, 'A').energies).toHaveLength(1);
    expect(getPlayerView(run.state, cat, 'A').sides.A.active!.energies[0]!.units).toBe(1);
    expect(code(run.state, { type: 'ATTACK', player: 'A', attackId: 'jato' })).toBe('INSUFFICIENT_ENERGY');
  });

  it('G-017: ligação extra por efeito não consome a ligação manual do turno', () => {
    const state = fixture(side({ active: { stack: [P(S.faisca)] }, hand: [P(gerador)], energyZone: { types: ['FIRE'], ready: 'FIRE', next: 'FIRE' } }), side({ active: { stack: [P(S.gota)] } }));
    const run = act(state, { type: 'PLAY_TRAINER', player: 'A', cardId: handCard(state, 'A', gerador) });
    expect(active(run.state, 'A').energies).toHaveLength(1);
    expect(run.state.players.A.flags.manualEnergyUsed).toBe(false);
    expect(run.state.players.A.energyZone.ready).toBe('FIRE');
    const manual = act(run, { type: 'ATTACH_ENERGY', player: 'A', targetEntityId: active(run.state, 'A').entityId });
    expect(active(manual.state, 'A').energies).toHaveLength(2);
  });

  it('G-055: evoluir mantém a Ferramenta ligada e o estado coerente (HP máximo com o bônus)', () => {
    const state = fixture(side({ active: { stack: [P(S.faisca)], damage: 30, toolPrintingId: P(S.talisma) }, hand: [P(S.braseiro)] }), side({ active: { stack: [P(S.gota)] } }));
    const tool = active(state, 'A').toolCardId;
    expect(tool).not.toBeNull();
    const run = act(state, { type: 'EVOLVE', player: 'A', cardId: handCard(state, 'A', S.braseiro), targetEntityId: active(state, 'A').entityId });
    expect(active(run.state, 'A').toolCardId).toBe(tool);
    expect(active(run.state, 'A').damage).toBe(30);
    const view = getPlayerView(run.state, cat, 'A').sides.A.active!;
    expect(view.tool?.cardId).toBe(tool);
    expect(view.maxHp).toBe(120);
    expect(view.remainingHp).toBe(90);
  });
});

describe('Recuo, troca e Habilidades (G-020, G-021, G-040, G-057)', () => {
  it('G-020: Recuo de custo zero ainda consome o Recuo normal do turno', () => {
    const state = fixture(side({ active: { stack: [P(sleeper)] }, bench: [{ stack: [P(S.faisca)] }, { stack: [P(S.carvito)] }] }), side({ active: { stack: [P(S.gota)] } }));
    const run = act(state, { type: 'RETREAT', player: 'A', benchIndex: 0, energyIds: [] });
    expect(run.state.players.A.flags.retreatUsed).toBe(true);
    expect(code(run.state, { type: 'RETREAT', player: 'A', benchIndex: 1, energyIds: [] })).toBe('RETREAT_ALREADY_USED');
  });

  it('G-021: troca por efeito não cobra Recuo nem consome o Recuo normal', () => {
    const state = fixture(side({ active: { stack: [P(S.faisca)], energies: ['FIRE'] }, bench: [{ stack: [P(S.carvito)] }], hand: [P(S.trocaTatica)] }), side({ active: { stack: [P(S.gota)] } }));
    const faisca = active(state, 'A').entityId;
    let run = act(state, { type: 'PLAY_TRAINER', player: 'A', cardId: handCard(state, 'A', S.trocaTatica) });
    run = resolvePending(run);
    expect(active(run.state, 'A').stack.map((id) => run.state.cards[id]!.definitionKey)).toEqual(['carvito@1']);
    const benched = run.state.players.A.bench.find((e) => e?.entityId === faisca)!;
    expect(benched.energies).toHaveLength(1);
    expect(run.state.players.A.discardedEnergy).toHaveLength(0);
    expect(run.state.players.A.flags.retreatUsed).toBe(false);
    expect(code(run.state, { type: 'RETREAT', player: 'A', benchIndex: 0, energyIds: [] })).not.toBe('RETREAT_ALREADY_USED');
  });

  it('G-040: gatilho de movimento considera a carta e o momento — troca no próprio turno dispara; promoção e carta evoluída depois, não', () => {
    // Troca por efeito do Tesourão para o Ativo no próprio turno: dispara.
    const switchIn = fixture(side({ active: { stack: [P(S.faisca)] }, bench: [{ stack: [P(tesoura), P(tesourao)] }], hand: [P(S.trocaTatica)] }), side({ active: { stack: [P(S.gota)] } }));
    let run = act(switchIn, { type: 'PLAY_TRAINER', player: 'A', cardId: handCard(switchIn, 'A', S.trocaTatica) });
    run = resolvePending(run);
    expect(run.events.filter((e) => e.type === 'ABILITY_TRIGGERED')).toHaveLength(1);
    expect(active(run.state, 'B').damage).toBe(10);
    // Promoção depois de Nocaute no turno adversário (motivo PROMOTE): não dispara.
    const promoted = fixture(
      side({ active: { stack: [P(S.gota)], damage: 60 }, bench: [{ stack: [P(tesoura), P(tesourao)] }, { stack: [P(S.faisca)] }] }),
      side({ active: { stack: [P(S.broto)], energies: ['GRASS'] }, bench: [{ stack: [P(S.semente)] }] }), { currentPlayer: 'NPC' });
    const scizor = promoted.players.A.bench[0]!.entityId;
    let ko = act(promoted, { type: 'ATTACK', player: 'B', attackId: 'folhinha' });
    expect(ko.state.pendingDecisions[0]?.kind).toBe('PROMOTE');
    ko = answer(ko, (o) => [o.find((x) => x === scizor) ?? o[0]!]);
    expect(active(ko.state, 'A').entityId).toBe(scizor);
    expect(ko.events.some((e) => e.type === 'POKEMON_MOVED' && e.data.reason === 'PROMOTE')).toBe(true);
    expect(ko.events.some((e) => e.type === 'ABILITY_TRIGGERED')).toBe(false);
    expect(active(ko.state, 'B').damage).toBe(0);
    // Tesoura (sem Habilidade) entra por troca e só depois evolui: a evolução não dispara a entrada retroativamente.
    const late = fixture(side({ active: { stack: [P(S.faisca)] }, bench: [{ stack: [P(tesoura)] }], hand: [P(S.trocaTatica), P(tesourao)] }), side({ active: { stack: [P(S.gota)] } }));
    let evolved = resolvePending(act(late, { type: 'PLAY_TRAINER', player: 'A', cardId: handCard(late, 'A', S.trocaTatica) }));
    evolved = act(evolved, { type: 'EVOLVE', player: 'A', cardId: handCard(evolved.state, 'A', tesourao), targetEntityId: active(evolved.state, 'A').entityId });
    expect(evolved.state.cards[active(evolved.state, 'A').stack.at(-1)!]!.definitionKey).toBe(`${tesourao.id}@1`);
    expect(evolved.events.some((e) => e.type === 'ABILITY_TRIGGERED')).toBe(false);
    expect(active(evolved.state, 'B').damage).toBe(0);
  });

  it('G-057: usar a Habilidade, voltar ao Banco e retornar ao Ativo não reseta o uso do turno', () => {
    const state = fixture(side({ active: { stack: [P(caminhante)] }, bench: [{ stack: [P(S.faisca)] }], hand: [P(S.trocaTatica)] }), side({ active: { stack: [P(S.gota)] } }));
    const entity = active(state, 'A').entityId;
    let run = act(state, { type: 'USE_ABILITY', player: 'A', entityId: entity, abilityId: 'estudo' });
    expect(code(run.state, { type: 'USE_ABILITY', player: 'A', entityId: entity, abilityId: 'estudo' })).toBe('ABILITY_ALREADY_USED');
    run = act(run, { type: 'RETREAT', player: 'A', benchIndex: 0, energyIds: [] });
    expect(active(run.state, 'A').entityId).not.toBe(entity);
    run = act(run, { type: 'PLAY_TRAINER', player: 'A', cardId: handCard(run.state, 'A', S.trocaTatica) });
    run = resolvePending(run, (o) => [o.find((x) => x === entity) ?? o[0]!]);
    expect(active(run.state, 'A').entityId).toBe(entity);
    expect(code(run.state, { type: 'USE_ABILITY', player: 'A', entityId: entity, abilityId: 'estudo' })).toBe('ABILITY_ALREADY_USED');
  });
});

describe('condições especiais — duração, acúmulo e recuperação (G-024, G-026, G-029)', () => {
  const duel = (coins: ('HEADS' | 'TAILS')[] = []) => fixture(
    side({ active: { stack: [P(condicionador)] }, bench: [{ stack: [P(S.faisca)] }] }),
    side({ active: { stack: [P(S.broto)], energies: ['GRASS'] }, bench: [{ stack: [P(S.semente)] }], energyZone: { types: ['GRASS'], ready: null, next: 'GRASS' } }),
    { coins });

  it('G-024: Paralisia vale durante o turno do afetado e expira no checkup que encerra esse turno', () => {
    let run: Run = { state: duel(), events: [] };
    run = act(run, { type: 'ATTACK', player: 'A', attackId: 'paralisar' });
    // Não cura ao fim do turno de quem aplicou.
    expect(run.state.currentPlayer).toBe('B');
    expect(active(run.state, 'B').conditions.control).toBe('PARALYZED');
    expect(code(run.state, { type: 'ATTACK', player: 'B', attackId: 'folhinha' })).toBe('SPECIAL_CONDITION_BLOCKS_ACTION');
    expect(code(run.state, { type: 'RETREAT', player: 'B', benchIndex: 0, energyIds: [active(run.state, 'B').energies[0]!.id] })).toBe('SPECIAL_CONDITION_BLOCKS_ACTION');
    run = act(run, { type: 'END_TURN', player: 'B' });
    expect(active(run.state, 'B').conditions.control).toBeNull();
    expect(run.events.some((e) => e.type === 'CONDITION_REMOVED' && e.data.condition === 'PARALYZED' && e.data.cause === 'EXPIRED')).toBe(true);
    run = act(run, { type: 'END_TURN', player: 'A' });
    expect(code(run.state, { type: 'ATTACK', player: 'B', attackId: 'folhinha' })).toBe('OK');
  });

  it('G-026: Veneno reaplicado não acumula cópia — 10 por checkup', () => {
    let run: Run = { state: duel(), events: [] };
    run = act(run, { type: 'ATTACK', player: 'A', attackId: 'envenenar' });
    expect(active(run.state, 'B').damage).toBe(10);
    run = act(run, { type: 'END_TURN', player: 'B' });
    expect(active(run.state, 'B').damage).toBe(20);
    run = act(run, { type: 'ATTACK', player: 'A', attackId: 'envenenar' });
    expect(active(run.state, 'B').conditions.poisoned).toBe(true);
    expect(active(run.state, 'B').damage).toBe(30);
  });

  it('G-029: Queimadura aplica o dano antes da moeda; a recuperação não desfaz o dano', () => {
    let run: Run = { state: duel(['HEADS']), events: [] };
    run = act(run, { type: 'ATTACK', player: 'A', attackId: 'queimar' });
    expect(run.events.some((e) => e.type === 'CONDITION_REMOVED' && e.data.condition === 'BURNED' && e.data.cause === 'RECOVERY')).toBe(true);
    expect(active(run.state, 'B').conditions.burned).toBe(false);
    expect(active(run.state, 'B').damage).toBe(20);
  });
});

describe('resultado, comandos e decisões (G-034, G-043, G-051, G-058, G-082)', () => {
  it('G-034: dano próprio e adversário no mesmo ataque resolvem o grupo inteiro antes do resultado (empate simultâneo)', () => {
    const state = fixture(
      side({ active: { stack: [P(ricochete)], damage: 30 }, bench: [{ stack: [P(S.faisca)] }], points: 2 }),
      side({ active: { stack: [P(S.gota)], damage: 40 }, bench: [{ stack: [P(S.nimbo)] }], points: 2 }));
    const run = act(state, { type: 'ATTACK', player: 'A', attackId: 'choque' });
    expect(run.events.filter((e) => e.type === 'POKEMON_KNOCKED_OUT')).toHaveLength(2);
    expect(run.state.result).toMatchObject({ outcome: 'DRAW', winner: null, reason: 'SIMULTANEOUS', points: { A: 3, B: 3 } });
  });

  it('G-043/G-082: escolha do adversário no turno atual — só ele responde, sem trocar o dono do turno nem iniciar turno', () => {
    const state = fixture(side({ active: { stack: [P(pressionador)] } }), side({ active: { stack: [P(S.gota)] }, bench: [{ stack: [P(S.nimbo)] }, { stack: [P(S.gota)] }] }));
    const run = act(state, { type: 'ATTACK', player: 'A', attackId: 'coacao' });
    const decision = run.state.pendingDecisions.find((d) => !d.answered)!;
    expect(decision.player).toBe('B');
    expect(run.state.currentPlayer).toBe('A');
    expect(run.events.some((e) => e.type === 'TURN_STARTED')).toBe(false);
    expect(code(run.state, { type: 'RESOLVE_DECISION', player: 'A', decisionId: decision.decisionId, selection: [decision.options[0]!] })).toBe('NOT_YOUR_TURN');
    expect(getLegalActions(run.state, cat, 'A')).toEqual([]);
    expect(code(run.state, { type: 'END_TURN', player: 'A' })).toBe('PENDING_DECISION');
    const done = answer(run, (o) => [o[1]!]);
    expect(done.events.filter((e) => e.type === 'TURN_STARTED').map((e) => e.data.player)).toEqual(['B']);
  });

  it('G-051: dano arbitrário enviado pela UI é ignorado; o motor calcula pelas regras', () => {
    const state = fixture(side({ active: { stack: [P(S.broto)], energies: ['GRASS'] } }), side({ active: { stack: [P(S.gota)] } }));
    const forged = { type: 'ATTACK', player: 'A', attackId: 'folhinha', damage: 999, points: 3, result: { winner: 'A' } } as unknown as Action;
    const run = act(state, forged);
    expect(active(run.state, 'B').damage).toBe(20);
    expect(run.state.players.A.points).toBe(0);
    expect(run.state.result).toBeNull();
  });

  it('G-065/R-019: reabrir depois da moeda mostra o mesmo resultado confirmado, sem novo sorteio', () => {
    const state = fixture(side({ active: { stack: [P(moedeiro)] } }), side({ active: { stack: [P(S.broto)] }, bench: [{ stack: [P(S.semente)] }] }));
    const run = act(state, { type: 'ATTACK', player: 'A', attackId: 'cara-ou-coroa' });
    const coins = run.events.find((e) => e.type === 'COIN_RESOLVED')!.data.results as string[];
    expect(coins).toHaveLength(3);
    const damage = coins.filter((f) => f === 'HEADS').length * 30;
    expect(active(run.state, 'B').damage).toBe(damage);
    expect(run.state.rng.draws).toBeGreaterThan(state.rng.draws);
    // “Reabrir” = carregar o estado gravado (JSON) e seguir: mesmo dano, mesmo RNG, mesma continuação.
    const reopened = JSON.parse(JSON.stringify(run.state)) as MatchState;
    expect(jcsHash(reopened)).toBe(jcsHash(run.state));
    expect(getPlayerView(reopened, cat, 'A').sides.B.active!.damage).toBe(damage);
    const next = (s: MatchState) => applyAction(s, cat, { type: 'END_TURN', player: 'B' });
    const a = next(run.state);
    const b = next(reopened);
    expect(a.ok && b.ok && jcsHash(a.state)).toBe(a.ok && b.ok && jcsHash(b.state));
  });

  it('G-058: partida encerrada rejeita novo ataque', () => {
    const run = act(fixture(side({ active: { stack: [P(S.broto)], energies: ['GRASS'] } }), side({ active: { stack: [P(megaMon)], damage: 20 } })), { type: 'ATTACK', player: 'A', attackId: 'folhinha' });
    expect(run.state.result?.winner).toBe('A');
    expect(code(run.state, { type: 'ATTACK', player: 'A', attackId: 'folhinha' })).toBe('MATCH_ALREADY_FINISHED');
    expect(code(run.state, { type: 'ATTACK', player: 'B', attackId: 'hit' })).toBe('MATCH_ALREADY_FINISHED');
    expect(getLegalActions(run.state, cat, 'A')).toEqual([]);
  });
});

describe('preparação, seletores e informação do próprio baralho (UI-024, UI-025, UI-038, UI-039)', () => {
  const opening = () => createMatch({ matchId: 'ui', seed: 7, players: { A: starterDeck(cat, 'FIRE'), B: starterDeck(cat, 'WATER') } }, cat).state;

  it('UI-024: a preparação só confirma com um Ativo legal (Básico da mão)', () => {
    const state = opening();
    const setup = state.pendingDecisions.find((d) => d.player === 'A' && d.kind === 'SETUP')!;
    expect(setup.min).toBeGreaterThanOrEqual(1);
    for (const id of setup.options) {
      const def = cat.definition(state.cards[id]!.definitionKey);
      expect(def.category === 'POKEMON' && def.stage === 'BASIC').toBe(true);
    }
    const trainerInHand = state.players.A.hand.find((id) => cat.definition(state.cards[id]!.definitionKey).category === 'TRAINER');
    expect(code(state, { type: 'RESOLVE_DECISION', player: 'A', decisionId: setup.decisionId, selection: [] })).not.toBe('OK');
    if (trainerInHand) expect(code(state, { type: 'RESOLVE_DECISION', player: 'A', decisionId: setup.decisionId, selection: [trainerInHand] })).toBe('INVALID_TARGET');
    expect(code(state, { type: 'RESOLVE_DECISION', player: 'A', decisionId: setup.decisionId, selection: [setup.options[0]!] })).toBe('OK');
  });

  it('UI-025: a escolha de preparação de um lado não é revelada ao outro antes de ambos confirmarem', () => {
    const state = opening();
    const setup = state.pendingDecisions.find((d) => d.player === 'A' && d.kind === 'SETUP')!;
    const run = act(state, { type: 'RESOLVE_DECISION', player: 'A', decisionId: setup.decisionId, selection: [setup.options[0]!] });
    const forB = getPlayerView(run.state, cat, 'B');
    expect(forB.sides.A.active).toBeNull();
    expect(forB.sides.A.bench.every((e) => e === null)).toBe(true);
    const resolved = redactEvents(run.events, 'B').filter((e) => e.type === 'DECISION_RESOLVED');
    expect(resolved.length).toBeGreaterThan(0);
    for (const e of resolved) expect(e.data.selection ?? null).toBeNull();
  });

  it('UI-038: seletor obrigatório respeita a cardinalidade e não tem saída ilegal', () => {
    const state = fixture(side({ active: { stack: [P(benchHitter)] } }), side({ active: { stack: [P(S.gota)] }, bench: [{ stack: [P(S.nimbo)] }, { stack: [P(S.gota)] }] }));
    const run = act(state, { type: 'ATTACK', player: 'A', attackId: 'snipe' });
    const d = run.state.pendingDecisions.find((x) => !x.answered)!;
    expect([d.min, d.max]).toEqual([1, 1]);
    expect(code(run.state, { type: 'RESOLVE_DECISION', player: 'A', decisionId: d.decisionId, selection: [] })).not.toBe('OK');
    expect(code(run.state, { type: 'RESOLVE_DECISION', player: 'A', decisionId: d.decisionId, selection: [d.options[0]!, d.options[1]!] })).not.toBe('OK');
    expect(code(run.state, { type: 'END_TURN', player: 'A' })).toBe('PENDING_DECISION');
    expect(getLegalActions(run.state, cat, 'A').every((a) => a.type === 'RESOLVE_DECISION' || a.type === 'CONCEDE')).toBe(true);
  });

  it('UI-039: a projeção do próprio baralho e a busca não revelam a ordem das cartas', () => {
    const state = fixture(side({ active: { stack: [P(S.broto)] }, hand: [P(S.rastreador)], deck: [P(S.ramante), P(S.semente), P(S.estudioso), P(S.broto), P(S.kitReparo)] }), side({ active: { stack: [P(S.gota)] } }));
    const deckIds = new Set(state.players.A.deck);
    const visible = (s: MatchState) => JSON.stringify(getPlayerView(s, cat, 'A'));
    const view = getPlayerView(state, cat, 'A');
    expect(view.sides.A.deckRemaining).toEqual([...view.sides.A.deckRemaining!].sort());
    for (const id of deckIds) expect(visible(state)).not.toContain(`"${id}"`);
    const run = resolvePending(act(state, { type: 'PLAY_TRAINER', player: 'A', cardId: handCard(state, 'A', S.rastreador) }));
    const remaining = run.state.players.A.deck;
    for (const id of remaining) expect(visible(run.state)).not.toContain(`"${id}"`);
    const own = redactEvents(run.events, 'A');
    for (const id of remaining) expect(JSON.stringify(own)).not.toContain(`"${id}"`);
  });
});

void SELF;
