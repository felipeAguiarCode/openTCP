// Mecânicas do motor exigidas pelos sets do Pocket depois do Genetic Apex (A1a…A4b, P-A, P-B), testadas com as
// definições reais das cartas (pocketCard): Nocaute em duas etapas com reações, Doce Raro, Ferramentas com restrição de
// tipo, sobreviver ao Nocaute, escolha 1, ataques de evoluções anteriores, condições de jogo de Treinadores, Iono,
// moedas (Victini, Will), Penny, Unown GUARDA/PODER e revide/mover dano/involuir/sem cura/moeda antes do ataque.
// Atacantes e alvos genéricos (Batedor, Bloco) são definidos aqui só para controlar o dano.
import { describe, expect, it } from 'vitest';
import { applyAction, getLegalActions, validateAction } from './engine.ts';
import { createMatchFromFixture, type BattleFixture, type FixturePokemon, type FixtureSide } from './setup.ts';
import type { Action, BattleEvent, MatchState } from './types.ts';
import { maxHp, retreatCost } from './derived.ts';
import { starterCatalog, printingOf, S } from '../../tests/support/starter-catalog.ts';
import { attack, flip, heads, add, mul, c, post, pre, pokemon } from '../../content/builders.ts';
import { pocketCard } from '../../content/source/pocket/cards.ts';
import type { CardDefinition } from '../cards/types.ts';


// ---- cartas reais
const pyukumuku = pocketCard('A3', 54);
const conkeldurr = pocketCard('A3', 96);
const gurdurr = pocketCard('A3', 95);
const timburr = pocketCard('A3', 94);
const rareCandy = pocketCard('A3', 144);
const leafCape = pocketCard('A3', 147);
const electricalCord = pocketCard('A3a', 65);
const eeveeBag = pocketCard('A3b', 66);
const steelApron = pocketCard('A4', 153);
const rescueScarf = pocketCard('A4', 155);
const inflatableBoat = pocketCard('A4a', 67);
const memoryLight = pocketCard('A4a', 68);
const rockyHelmet = pocketCard('A2', 148);
const araquanid = pocketCard('A3', 53);
const lana = pocketCard('A3', 152);
const beastWall = pocketCard('A3a', 63);
const repel = pocketCard('A3a', 64);
const lusamine = pocketCard('A3a', 69);
const pheromosa = pocketCard('A3a', 7);
const penny = pocketCard('A3b', 69);
const will = pocketCard('A4', 156);
const lyra = pocketCard('A4', 157);
const iono = pocketCard('A4b', 340);
const victini = pocketCard('P-B', 49);
const celebiTimeRecall = pocketCard('P-B', 79);
const ponyta = pocketCard('A1a', 10);
const pikachu = pocketCard('P-A', 9);
const togedemaru = pocketCard('P-A', 90);
const eevee = pocketCard('P-A', 92);
const vaporeon = pocketCard('A1a', 19);
const leafeon = pocketCard('A2', 20);
const unownCheck = pocketCard('A2a', 34);
const unownGuard = pocketCard('A4', 84);
const unownPower = pocketCard('A4', 85);
const weezing = pocketCard('A1a', 50);
const dusknoir = pocketCard('A2', 72);
const claydol = pocketCard('A3a', 31);
const celebi = pocketCard('A4a', 6);
const cursola = pocketCard('A4a', 35);
const passimianEx = pocketCard('A3', 104);
const acerola = pocketCard('A3', 148);
const mimikyu = pocketCard('P-A', 66);
const bewearHug = pocketCard('A3a', 58);
const guzma = pocketCard('A3', 151);

// ---- cartas de teste: dano controlado, sem Fraqueza
const golpes = [30, 60, 70, 80, 90].map((n) => attack({ id: `golpe-${n}`, name: `Golpe ${n}`, cost: {}, damage: n }));
const batedor = pokemon({ baseName: 'Batedor', stage: 'BASIC', type: 'COLORLESS', hp: 100, retreat: 1, weakness: null, attacks: [
  ...golpes,
  attack({ id: 'picada', name: 'Picada', cost: {}, damage: 30, effects: [post({ type: 'APPLY_CONDITION', target: { scope: 'OPPONENT_ACTIVE' }, condition: 'POISONED' })] }),
  attack({ id: 'chuva', name: 'Chuva', cost: {}, damage: 10, effects: [post({ type: 'DEAL_DAMAGE', target: { scope: 'OPPONENT_BENCH', pick: { mode: 'ALL' } }, amount: 20, category: 'ATTACK' })] }),
] });
const bloco = pokemon({ baseName: 'Bloco', stage: 'BASIC', type: 'COLORLESS', hp: 300, retreat: 1, weakness: null, attacks: [golpes[0]!] });
// Atacante de Água com moeda (Victory Star só vale para Pokémon de Fogo).
const moedeiro = pokemon({ baseName: 'Moedeiro', stage: 'BASIC', type: 'WATER', hp: 100, retreat: 1, weakness: null,
  attacks: [attack({ id: 'moeda', name: 'Moeda', cost: {}, formula: add(c(10), mul(c(30), heads())), effects: [pre(flip(1))] })] });

const POCKET: CardDefinition[] = [
  pyukumuku, conkeldurr, gurdurr, timburr, rareCandy, leafCape, electricalCord, eeveeBag, steelApron, rescueScarf, inflatableBoat, memoryLight,
  rockyHelmet, araquanid, lana, beastWall, repel, lusamine, pheromosa, penny, will, lyra, iono, victini, celebiTimeRecall, ponyta, pikachu,
  togedemaru, eevee, vaporeon, leafeon, unownCheck, unownGuard, unownPower, weezing, dusknoir, claydol, celebi, cursola, passimianEx, acerola,
  mimikyu, bewearHug, guzma,
];
const cat = starterCatalog([...POCKET, batedor, bloco, moedeiro]);
const P = (def: CardDefinition) => printingOf(cat, def);
const filler = (n: number) => Array.from({ length: n }, () => P(S.estudioso));
const ctxOf = (state: MatchState) => ({ s: state, cat });

function side(over: Partial<FixtureSide> & { active: FixturePokemon | null }): FixtureSide {
  return { deck: filler(8), hand: [], discard: [], bench: [], energyZone: { types: ['FIRE'], ready: null, next: 'FIRE' }, points: 0, ...over };
}

type Opts = { coins?: ('HEADS' | 'TAILS')[]; firstTurn?: boolean };
function fixture(human: FixtureSide, npc: FixtureSide, opts: Opts = {}): MatchState {
  const fx: BattleFixture = {
    fixtureId: 'test', kind: 'TEST', label: 'teste', startPhase: 'MAIN', firstPlayer: 'HUMAN', currentPlayer: 'HUMAN',
    globalTurnNumber: opts.firstTurn ? 1 : 3, ownTurns: opts.firstTurn ? { HUMAN: 1, NPC: 0 } : { HUMAN: 2, NPC: 1 },
    stadiumPrintingId: null, players: { HUMAN: human, NPC: npc },
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
const keyOf = (state: MatchState, cardId: string) => state.cards[cardId]!.definitionKey;
const handCard = (state: MatchState, player: 'A' | 'B', def: CardDefinition) => state.players[player].hand.find((id) => keyOf(state, id) === `${def.id}@1`)!;
const active = (state: MatchState, p: 'A' | 'B') => state.players[p].active!;
const topKey = (state: MatchState, p: 'A' | 'B') => { const a = active(state, p); return keyOf(state, a.stack[a.stack.length - 1]!); };
const pending = (run: Run) => run.state.pendingDecisions.find((x) => !x.answered)!;
const answer = (run: Run, pick: (options: readonly string[]) => readonly string[]) => {
  const d = pending(run);
  return act(run, { type: 'RESOLVE_DECISION', player: d.player, decisionId: d.decisionId, selection: pick(d.options) });
};
const play = (state: MatchState | Run, def: CardDefinition, extra: Partial<Extract<Action, { type: 'PLAY_TRAINER' }>> = {}) => {
  const s = 'state' in state ? state.state : state;
  return act(state, { type: 'PLAY_TRAINER', player: 'A', cardId: handCard(s, 'A', def), ...extra });
};
const playCode = (state: MatchState, def: CardDefinition, extra: Partial<Extract<Action, { type: 'PLAY_TRAINER' }>> = {}) =>
  code(state, { type: 'PLAY_TRAINER', player: 'A', cardId: handCard(state, 'A', def), ...extra });
const hit = (state: MatchState | Run, attackId: string, player: 'A' | 'B' = 'A') => act(state, { type: 'ATTACK', player, attackId });
const keys = (state: MatchState, ids: readonly string[]) => ids.map((id) => keyOf(state, id));

describe('Nocaute em duas etapas: reações com o Pokémon ainda em campo', () => {
  it('Pyukumuku (Entranhas para Fora): Nocauteado no Ativo por ataque causa 50 ao atacante; o ponto é de quem atacou', () => {
    const run = hit(fixture(side({ active: { stack: [P(batedor)] }, bench: [{ stack: [P(bloco)] }] }),
      side({ active: { stack: [P(pyukumuku)] }, bench: [{ stack: [P(bloco)] }] })), 'golpe-60');
    expect(active(run.state, 'A').damage).toBe(50);
    expect(run.state.players.A.points).toBe(1);
    expect(run.state.players.B.points).toBe(0);
    expect(keys(run.state, run.state.players.B.discard)).toContain(`${pyukumuku.id}@1`);
    // Anúncio antes do dano de reação; a saída de campo (pontos) só depois dele.
    const order = run.events.map((e) => e.type).filter((t) => ['POKEMON_KNOCKED_OUT', 'DAMAGE_APPLIED', 'POINTS_GRANTED'].includes(t));
    expect(order).toEqual(['DAMAGE_APPLIED', 'POKEMON_KNOCKED_OUT', 'DAMAGE_APPLIED', 'POINTS_GRANTED']);
    expect(run.state.currentPlayer).toBe('B');
  });

  it('a reação que Nocauteia o atacante: os dois saem, cada jogador pontua e os dois promovem', () => {
    const run = hit(fixture(side({ active: { stack: [P(batedor)], damage: 60 }, bench: [{ stack: [P(bloco)] }] }),
      side({ active: { stack: [P(pyukumuku)] }, bench: [{ stack: [P(bloco)] }] })), 'golpe-60');
    expect(run.state.players.A.points).toBe(1);
    expect(run.state.players.B.points).toBe(1);
    expect(keys(run.state, run.state.players.A.discard)).toContain(`${batedor.id}@1`);
    expect(keys(run.state, run.state.players.B.discard)).toContain(`${pyukumuku.id}@1`);
    expect(topKey(run.state, 'A')).toBe(`${bloco.id}@1`);
    expect(topKey(run.state, 'B')).toBe(`${bloco.id}@1`);
    const ko = run.events.filter((e) => e.type === 'POKEMON_KNOCKED_OUT');
    expect(ko.map((e) => e.data.cause)).toEqual(['ATTACK', 'EFFECT']);
    expect(run.state.currentPlayer).toBe('B');
    expect(run.state.result).toBeNull();
  });

  it('os dois chegam a 3 pontos no mesmo Nocaute duplo: empate simultâneo', () => {
    const run = hit(fixture(side({ active: { stack: [P(batedor)], damage: 60 }, bench: [{ stack: [P(bloco)] }], points: 2 }),
      side({ active: { stack: [P(pyukumuku)] }, bench: [{ stack: [P(bloco)] }], points: 2 })), 'golpe-60');
    expect(run.state.result).toMatchObject({ outcome: 'DRAW', reason: 'SIMULTANEOUS', points: { A: 3, B: 3 } });
  });

  it('Cursola de Galar (Corpo Perecível): cara Nocauteia o atacante (os dois pontuam); coroa, não', () => {
    const duel = (coin: 'HEADS' | 'TAILS') => hit(fixture(side({ active: { stack: [P(batedor)] }, bench: [{ stack: [P(bloco)] }] }),
      side({ active: { stack: [P(cursola)] }, bench: [{ stack: [P(bloco)] }] }), { coins: [coin] }), 'golpe-80');
    const heads = duel('HEADS');
    expect(heads.state.players.A.points).toBe(1);
    expect(heads.state.players.B.points).toBe(1);
    expect(topKey(heads.state, 'A')).toBe(`${bloco.id}@1`);
    const tails = duel('TAILS');
    expect(tails.state.players.B.points).toBe(0);
    expect(topKey(tails.state, 'A')).toBe(`${batedor.id}@1`);
  });

  it('Passimian ex (reação com escolha): o dono escolhe o Banco antes de o Nocauteado sair de campo e pontuar', () => {
    let run = hit(fixture(side({ active: { stack: [P(batedor)] } }),
      side({ active: { stack: [P(passimianEx)], damage: 50, energies: ['FIGHTING', 'FIGHTING', 'FIRE'] }, bench: [{ stack: [P(bloco)] }, { stack: [P(S.gota)] }] })), 'golpe-80');
    const d = pending(run);
    expect(d).toMatchObject({ player: 'B', kind: 'SELECT_TARGETS' });
    expect(topKey(run.state, 'B')).toBe(`${passimianEx.id}@1`);
    expect(run.state.players.A.points).toBe(0);
    const gota = run.state.players.B.bench[1]!.entityId;
    run = answer(run, () => [gota]);
    expect(run.state.players.B.bench[1]!.energies.map((e) => e.type)).toEqual(['FIGHTING', 'FIGHTING']);
    expect(run.state.players.B.discardedEnergy.map((e) => e.type)).toEqual(['FIRE']);
    expect(run.state.players.A.points).toBe(2);
    expect(pending(run)).toMatchObject({ player: 'B', kind: 'PROMOTE' });
  });

  it('Pyukumuku no Banco não reage (só no Ativo)', () => {
    const run = hit(fixture(side({ active: { stack: [P(batedor)] } }),
      side({ active: { stack: [P(bloco)] }, bench: [{ stack: [P(pyukumuku)], damage: 50 }] })), 'chuva');
    expect(run.state.players.B.bench.filter(Boolean)).toHaveLength(0);
    expect(active(run.state, 'A').damage).toBe(0);
    expect(run.state.players.A.points).toBe(1);
  });

  it('Cachecol de Resgate: Nocaute por ataque manda o Pokémon para a mão e a Ferramenta para o descarte', () => {
    // Baralho do oponente vazio: a compra do início do turno dele não entra na mão.
    const run = hit(fixture(side({ active: { stack: [P(batedor)] } }),
      side({ active: { stack: [P(S.gota)], energies: ['WATER'], toolPrintingId: P(rescueScarf) }, bench: [{ stack: [P(bloco)] }], deck: [] })), 'golpe-70');
    const b = run.state.players.B;
    expect(keys(run.state, b.hand)).toEqual([`${S.gota.id}@1`]);
    expect(keys(run.state, b.discard)).toEqual([`${rescueScarf.id}@1`]);
    expect(b.discardedEnergy.map((e) => e.type)).toEqual(['WATER']);
    expect(run.state.players.A.points).toBe(1);
  });

  it('Cachecol de Resgate: Nocaute por Veneno (não é ataque) vai para o descarte normalmente', () => {
    const run = act(fixture(side({ active: { stack: [P(batedor)] } }),
      side({ active: { stack: [P(S.gota)], damage: 60, conditions: ['POISONED'], toolPrintingId: P(rescueScarf) }, bench: [{ stack: [P(bloco)] }] })),
    { type: 'END_TURN', player: 'A' });
    const b = run.state.players.B;
    expect(b.hand.map((id) => keyOf(run.state, id))).not.toContain(`${S.gota.id}@1`);
    expect(keys(run.state, b.discard).sort()).toEqual([`${rescueScarf.id}@1`, `${S.gota.id}@1`].sort());
    expect(run.state.players.A.points).toBe(1);
  });

  it('Cabo Elétrico: Pokémon {L} Nocauteado no Ativo passa 2 Energias {L}, uma para cada um de 2 Pokémon no Banco', () => {
    const run = hit(fixture(side({ active: { stack: [P(batedor)] } }),
      side({ active: { stack: [P(pikachu)], energies: ['LIGHTNING', 'LIGHTNING', 'FIRE'], toolPrintingId: P(electricalCord) },
        bench: [{ stack: [P(bloco)] }, { stack: [P(S.gota)] }] })), 'golpe-60');
    const bench = run.state.players.B.bench;
    expect(bench[0]!.energies.map((e) => e.type)).toEqual(['LIGHTNING']);
    expect(bench[1]!.energies.map((e) => e.type)).toEqual(['LIGHTNING']);
    expect(run.state.players.B.discardedEnergy.map((e) => e.type)).toEqual(['FIRE']);
  });

  it('Cabo Elétrico num Pokémon que não é {L} não faz nada', () => {
    const run = hit(fixture(side({ active: { stack: [P(batedor)] } }),
      side({ active: { stack: [P(S.gota)], energies: ['LIGHTNING', 'LIGHTNING'], toolPrintingId: P(electricalCord) },
        bench: [{ stack: [P(bloco)] }, { stack: [P(S.faisca)] }] })), 'golpe-70');
    expect(run.state.players.B.bench.filter(Boolean).every((e) => e!.energies.length === 0)).toBe(true);
    expect(run.state.players.B.discardedEnergy).toHaveLength(2);
  });
});

describe('Causa do Nocaute: só o dano de ataque do próprio turno conta como “Nocauteado por dano de um ataque”', () => {
  it('dano movido (Acerola) que Nocauteia o Pyukumuku atingido por ataque no turno anterior: sem reação', () => {
    let run = hit(fixture(side({ active: { stack: [P(batedor)] }, bench: [{ stack: [P(mimikyu)], damage: 40 }], hand: [P(acerola)] }),
      side({ active: { stack: [P(pyukumuku)] }, bench: [{ stack: [P(bloco)] }] })), 'golpe-30');
    run = act(run, { type: 'END_TURN', player: 'B' });
    run = play(run, acerola);
    expect(run.state.players.A.points).toBe(1);
    expect(active(run.state, 'A').damage).toBe(0);
    expect(run.state.players.A.bench[0]!.damage).toBe(0);
    expect(run.events.filter((e) => e.type === 'POKEMON_KNOCKED_OUT').map((e) => e.data.cause)).toEqual(['OTHER']);
  });

  it('Nocaute por efeito (Bewear: duas caras) num Pokémon com dano de ataque antigo: o Cachecol de Resgate não age', () => {
    const state = fixture(side({ active: { stack: [P(batedor)], energies: ['FIRE'] }, bench: [{ stack: [P(bewearHug)], energies: ['FIRE', 'FIRE', 'FIRE'] }] }),
      side({ active: { stack: [P(S.gota)], toolPrintingId: P(rescueScarf) }, bench: [{ stack: [P(bloco)] }], deck: [] }), { coins: ['HEADS', 'HEADS'] });
    let run = hit(state, 'golpe-30');
    run = act(run, { type: 'END_TURN', player: 'B' });
    run = act(run, { type: 'RETREAT', player: 'A', benchIndex: 0, energyIds: [active(run.state, 'A').energies[0]!.id] });
    run = hit(run, 'superpowered-hug');
    expect(run.state.players.A.points).toBe(1);
    expect(run.state.players.B.hand).toHaveLength(0);
    expect(keys(run.state, run.state.players.B.discard).sort()).toEqual([`${rescueScarf.id}@1`, `${S.gota.id}@1`].sort());
  });

  it('Nocaute por perda de PS (Guzma descarta a Capa de Folha) não é Nocaute por ataque', () => {
    let run = hit(fixture(side({ active: { stack: [P(batedor)] }, hand: [P(guzma)] }),
      side({ active: { stack: [P(S.broto)], toolPrintingId: P(leafCape) }, bench: [{ stack: [P(bloco)] }] })), 'golpe-90');
    expect(run.state.players.A.points).toBe(0);
    run = act(run, { type: 'END_TURN', player: 'B' });
    run = play(run, guzma);
    expect(run.state.players.A.points).toBe(1);
    expect(run.events.filter((e) => e.type === 'POKEMON_KNOCKED_OUT').map((e) => e.data.cause)).toEqual(['OTHER']);
  });
});

describe('Doce Raro (A3-144): Básico → Estágio 2 da mão', () => {
  const candy = (opts: { entered?: number; firstTurn?: boolean; bench?: FixturePokemon[] } = {}) => fixture(
    side({ active: { stack: [P(timburr)], damage: 30, enteredPlayOnTurn: opts.entered ?? 0 }, bench: opts.bench ?? [], hand: [P(rareCandy), P(conkeldurr)] }),
    side({ active: { stack: [P(bloco)] } }), { firstTurn: opts.firstTurn });

  it('evolui o Básico direto para o Estágio 2 (o dano fica, o Doce vai ao descarte)', () => {
    const state = candy();
    expect(playCode(state, rareCandy)).toBe('OK');
    const run = play(state, rareCandy);
    const a = active(run.state, 'A');
    expect(keys(run.state, a.stack)).toEqual([`${timburr.id}@1`, `${conkeldurr.id}@1`]);
    expect(a.damage).toBe(30);
    expect(run.state.players.A.hand).toHaveLength(0);
    expect(keys(run.state, run.state.players.A.discard)).toEqual([`${rareCandy.id}@1`]);
    expect(maxHp(ctxOf(run.state), a)).toBe(150);
  });

  it('recusado no primeiro turno do jogador', () => {
    expect(playCode(candy({ firstTurn: true }), rareCandy)).toBe('CARD_PRECONDITION_FAILED');
  });

  it('recusado num Básico que entrou em jogo neste turno (fixture e jogando o Básico da mão)', () => {
    expect(playCode(candy({ entered: 3 }), rareCandy)).toBe('CARD_PRECONDITION_FAILED');
    const state = fixture(side({ active: { stack: [P(bloco)] }, hand: [P(timburr), P(rareCandy), P(conkeldurr)] }), side({ active: { stack: [P(bloco)] } }));
    const run = act(state, { type: 'PLAY_BASIC', player: 'A', cardId: handCard(state, 'A', timburr), benchIndex: 0 });
    expect(playCode(run.state, rareCandy)).toBe('CARD_PRECONDITION_FAILED');
  });

  it('com outro Básico sem Estágio 2 correspondente na mão, só o Básico válido é alvo (sem escolha inútil)', () => {
    const run = play(candy({ bench: [{ stack: [P(S.gota)] }, { stack: [P(timburr)], enteredPlayOnTurn: 3 }] }), rareCandy);
    expect(run.state.pendingDecisions).toHaveLength(0);
    expect(topKey(run.state, 'A')).toBe(`${conkeldurr.id}@1`);
  });

  it('Estágio 1 na mão não serve para o Doce Raro', () => {
    const state = fixture(side({ active: { stack: [P(timburr)] }, hand: [P(rareCandy), P(gurdurr)] }), side({ active: { stack: [P(bloco)] } }));
    expect(playCode(state, rareCandy)).toBe('CARD_PRECONDITION_FAILED');
  });
});

describe('Ferramentas com restrição de tipo: o efeito só vale no tipo indicado', () => {
  it('Capa de Folha: +30 PS só em Pokémon {G}', () => {
    const state = fixture(side({ active: { stack: [P(S.broto)] }, bench: [{ stack: [P(S.gota)] }], hand: [P(leafCape), P(leafCape)] }), side({ active: { stack: [P(batedor)] } }));
    let run = play(state, leafCape, { targetEntityId: active(state, 'A').entityId });
    run = act(run, { type: 'PLAY_TRAINER', player: 'A', cardId: handCard(run.state, 'A', leafCape), targetEntityId: run.state.players.A.bench[0]!.entityId });
    expect(maxHp(ctxOf(run.state), active(run.state, 'A'))).toBe(120);
    expect(maxHp(ctxOf(run.state), run.state.players.A.bench[0]!)).toBe(70);
  });

  it('Capa de Folha: o Pokémon {G} aguenta o dano que o Nocautearia sem ela', () => {
    const grass = hit(fixture(side({ active: { stack: [P(batedor)] } }), side({ active: { stack: [P(S.broto)], toolPrintingId: P(leafCape) }, bench: [{ stack: [P(bloco)] }] })), 'golpe-90');
    expect(active(grass.state, 'B').damage).toBe(90);
    expect(grass.state.players.A.points).toBe(0);
    const water = hit(fixture(side({ active: { stack: [P(batedor)] } }), side({ active: { stack: [P(S.gota)], toolPrintingId: P(leafCape) }, bench: [{ stack: [P(bloco)] }] })), 'golpe-70');
    expect(water.state.players.A.points).toBe(1);
  });

  it('Avental de Aço: Pokémon {M} recebe −10 de ataques e não é afetado por Condições; outro tipo, sim', () => {
    const metal = hit(fixture(side({ active: { stack: [P(batedor)] } }), side({ active: { stack: [P(togedemaru)], toolPrintingId: P(steelApron) } })), 'picada');
    expect(active(metal.state, 'B').damage).toBe(20);
    expect(active(metal.state, 'B').conditions.poisoned).toBe(false);
    const water = hit(fixture(side({ active: { stack: [P(batedor)] } }), side({ active: { stack: [P(S.gota)], toolPrintingId: P(steelApron) } })), 'picada');
    expect(active(water.state, 'B').damage).toBe(40); // 30 + 10 de Veneno na Verificação
    expect(active(water.state, 'B').conditions.poisoned).toBe(true);
  });

  it('Avental de Aço: o Pokémon {M} envenenado se recupera ao receber a Ferramenta', () => {
    const state = fixture(side({ active: { stack: [P(togedemaru)], conditions: ['POISONED', 'CONFUSED'] }, hand: [P(steelApron)] }), side({ active: { stack: [P(bloco)] } }));
    const run = play(state, steelApron, { targetEntityId: active(state, 'A').entityId });
    expect(active(run.state, 'A').conditions).toMatchObject({ poisoned: false, control: null });
  });

  it('Bote Inflável: Recuo −1 só em Pokémon {W}', () => {
    const water = fixture(side({ active: { stack: [P(S.gota)], toolPrintingId: P(inflatableBoat) }, bench: [{ stack: [P(bloco)] }] }), side({ active: { stack: [P(bloco)] } }));
    expect(retreatCost(ctxOf(water), active(water, 'A'))).toBe(0);
    expect(code(water, { type: 'RETREAT', player: 'A', benchIndex: 0, energyIds: [] })).toBe('OK');
    const fire = fixture(side({ active: { stack: [P(S.faisca)], toolPrintingId: P(inflatableBoat) }, bench: [{ stack: [P(bloco)] }] }), side({ active: { stack: [P(bloco)] } }));
    expect(retreatCost(ctxOf(fire), active(fire, 'A'))).toBe(1);
    expect(code(fire, { type: 'RETREAT', player: 'A', benchIndex: 0, energyIds: [] })).toBe('INSUFFICIENT_ENERGY');
  });
});

describe('Conkeldurr (Garra): sobreviver ao Nocaute com moeda', () => {
  const duel = (coins: ('HEADS' | 'TAILS')[], damage = 100) => fixture(side({ active: { stack: [P(batedor)] } }),
    side({ active: { stack: [P(timburr), P(gurdurr), P(conkeldurr)], damage }, bench: [{ stack: [P(bloco)] }] }), { coins });

  it('cara: não é Nocauteado e fica com 10 PS', () => {
    const run = hit(duel(['HEADS']), 'golpe-80');
    expect(active(run.state, 'B').damage).toBe(140);
    expect(run.state.players.A.points).toBe(0);
    expect(run.events.some((e) => e.type === 'COIN_RESOLVED' && e.data.reason === 'SURVIVE_KNOCKOUT')).toBe(true);
  });

  it('coroa: é Nocauteado normalmente', () => {
    const run = hit(duel(['TAILS']), 'golpe-80');
    expect(run.state.players.A.points).toBe(1);
    expect(topKey(run.state, 'B')).toBe(`${bloco.id}@1`);
  });

  it('com 10 PS restantes e cara, continua com 10', () => {
    const run = hit(duel(['HEADS'], 140), 'golpe-30');
    expect(active(run.state, 'B').damage).toBe(140);
  });

  it('dano que não Nocauteia não joga moeda', () => {
    const run = hit(duel(['TAILS'], 0), 'golpe-80');
    expect(active(run.state, 'B').damage).toBe(80);
    expect(run.state.scriptedCoins).toEqual(['TAILS']);
  });

  it('dano de efeito (Veneno) não é dano de ataque: sem moeda', () => {
    const state = fixture(side({ active: { stack: [P(bloco)] } }),
      side({ active: { stack: [P(conkeldurr)], damage: 140, conditions: ['POISONED'] }, bench: [{ stack: [P(bloco)] }] }), { coins: ['HEADS'] });
    const run = act(state, { type: 'END_TURN', player: 'A' });
    expect(run.state.players.A.points).toBe(1);
  });
});

describe('Bolsa de Eevee (escolha 1): decisão SELECT_MODE', () => {
  const bag = () => fixture(
    side({ active: { stack: [P(eevee), P(leafeon)], energies: ['GRASS', 'GRASS'], damage: 30 }, bench: [{ stack: [P(eevee), P(vaporeon)], damage: 30 }, { stack: [P(eevee)], damage: 30 }], hand: [P(eeveeBag)] }),
    side({ active: { stack: [P(bloco)] } }));

  it('pede a escolha entre as duas opções, com rótulo', () => {
    const run = play(bag(), eeveeBag);
    const d = pending(run);
    expect(d.kind).toBe('SELECT_MODE');
    expect(d.player).toBe('A');
    expect(d.options).toEqual(['MODE:0', 'MODE:1']);
    expect(Object.keys(d.labels ?? {})).toEqual(['MODE:0', 'MODE:1']);
  });

  it('opção ②: cura 20 de cada Pokémon que evolui de Eevee (o Eevee não)', () => {
    const run = answer(play(bag(), eeveeBag), () => ['MODE:1']);
    expect(active(run.state, 'A').damage).toBe(10);
    expect(run.state.players.A.bench[0]!.damage).toBe(10);
    expect(run.state.players.A.bench[1]!.damage).toBe(30);
    expect(keys(run.state, run.state.players.A.discard)).toEqual([`${eeveeBag.id}@1`]);
  });

  it('opção ①: +10 no dano dos ataques deles ao Ativo do oponente neste turno (sem cura)', () => {
    let run = answer(play(bag(), eeveeBag), () => ['MODE:0']);
    expect(active(run.state, 'A').damage).toBe(30);
    run = hit(run, 'leafy-cyclone');
    expect(active(run.state, 'B').damage).toBe(100);
  });
});

describe('Ataques de evoluções anteriores (Luz da Memória, Celebi Recordação do Tempo)', () => {
  const evolved = (over: Partial<FixturePokemon> = {}, bench: FixturePokemon[] = []) => fixture(
    side({ active: { stack: [P(timburr), P(gurdurr)], energies: ['FIGHTING'], ...over }, bench }), side({ active: { stack: [P(bloco)] } }));
  const previous = (state: MatchState): Action => ({ type: 'ATTACK', player: 'A', attackId: 'corkscrew-punch', sourceCardId: active(state, 'A').stack[0]! });

  it('com a Ferramenta, o ATAQUE com sourceCardId usa o ataque da carta de baixo', () => {
    const state = evolved({ toolPrintingId: P(memoryLight) });
    expect(code(state, previous(state))).toBe('OK');
    expect(getLegalActions(state, cat, 'A')).toContainEqual(previous(state));
    const run = act(state, previous(state));
    expect(active(run.state, 'B').damage).toBe(20);
    expect(run.events.find((e) => e.type === 'ATTACK_DECLARED')?.data.attackId).toBe('corkscrew-punch');
  });

  it('sem a regra concedida o ataque anterior não existe; o ataque do topo continua sem sourceCardId', () => {
    const state = evolved();
    expect(code(state, previous(state))).toBe('INVALID_TARGET');
    expect(code(state, { type: 'ATTACK', player: 'A', attackId: 'corkscrew-punch' })).toBe('INVALID_TARGET');
  });

  it('ainda exige a Energia do ataque anterior', () => {
    const state = evolved({ toolPrintingId: P(memoryLight), energies: ['FIRE'] });
    expect(code(state, previous(state))).toBe('INSUFFICIENT_ENERGY');
  });

  it('Habilidade do Celebi (P-B) no Banco concede a regra a todos os seus Pokémon evoluídos', () => {
    const state = evolved({}, [{ stack: [P(celebiTimeRecall)] }]);
    expect(code(state, previous(state))).toBe('OK');
  });
});

describe('Condições de jogo dos Treinadores (CARD_PRECONDITION_FAILED)', () => {
  it('Lusamine: só com o oponente com pelo menos 1 ponto; liga 2 Energias aleatórias do descarte à Ultracriatura', () => {
    const make = (points: number) => {
      const state = fixture(side({ active: { stack: [P(pheromosa)] }, hand: [P(lusamine)] }), side({ active: { stack: [P(bloco)] }, points }));
      state.players.A.discardedEnergy.push({ id: 'en-d1', type: 'FIRE' }, { id: 'en-d2', type: 'WATER' }, { id: 'en-d3', type: 'GRASS' });
      return state;
    };
    expect(playCode(make(0), lusamine)).toBe('CARD_PRECONDITION_FAILED');
    expect(playCode(make(1), lusamine)).toBe('OK');
    const run = play(make(1), lusamine);
    expect(active(run.state, 'A').energies).toHaveLength(2);
    expect(run.state.players.A.discardedEnergy).toHaveLength(1);
  });

  it('Lusamine: sem Ultracriatura em jogo não é jogável', () => {
    const state = fixture(side({ active: { stack: [P(bloco)] }, hand: [P(lusamine)] }), side({ active: { stack: [P(bloco)] }, points: 1 }));
    state.players.A.discardedEnergy.push({ id: 'en-d1', type: 'FIRE' });
    expect(playCode(state, lusamine)).toBe('CARD_PRECONDITION_FAILED');
  });

  it('Muralha das Feras: só enquanto o oponente não tem pontos', () => {
    const make = (points: number) => fixture(side({ active: { stack: [P(pheromosa)] }, hand: [P(beastWall)] }), side({ active: { stack: [P(bloco)] }, points }));
    expect(playCode(make(0), beastWall)).toBe('OK');
    expect(playCode(make(1), beastWall)).toBe('CARD_PRECONDITION_FAILED');
  });

  it('Lana: só com Araquanid em jogo; traz o Pokémon do Banco do oponente para o Ativo', () => {
    const make = (bench: FixturePokemon[]) => fixture(side({ active: { stack: [P(bloco)] }, bench, hand: [P(lana)] }),
      side({ active: { stack: [P(bloco)] }, bench: [{ stack: [P(S.gota)] }] }));
    expect(playCode(make([]), lana)).toBe('CARD_PRECONDITION_FAILED');
    const state = make([{ stack: [P(araquanid)] }]);
    expect(playCode(state, lana)).toBe('OK');
    expect(topKey(play(state, lana).state, 'B')).toBe(`${S.gota.id}@1`);
  });

  it('Lyra: só com o seu Ativo com dano; troca com o Pokémon do Banco', () => {
    const make = (damage: number) => fixture(side({ active: { stack: [P(bloco)], damage }, bench: [{ stack: [P(S.gota)] }], hand: [P(lyra)] }), side({ active: { stack: [P(bloco)] } }));
    expect(playCode(make(0), lyra)).toBe('CARD_PRECONDITION_FAILED');
    expect(playCode(make(10), lyra)).toBe('OK');
    expect(topKey(play(make(10), lyra).state, 'A')).toBe(`${S.gota.id}@1`);
  });

  it('Repelente: só com o Ativo do oponente Básico; o oponente escolhe o novo Ativo', () => {
    const make = (stack: string[]) => fixture(side({ active: { stack: [P(bloco)] }, hand: [P(repel)] }),
      side({ active: { stack }, bench: [{ stack: [P(S.gota)] }, { stack: [P(S.faisca)] }] }));
    expect(playCode(make([P(timburr), P(gurdurr)]), repel)).toBe('CARD_PRECONDITION_FAILED');
    const state = make([P(timburr)]);
    expect(playCode(state, repel)).toBe('OK');
    let run = play(state, repel);
    expect(pending(run).player).toBe('B');
    run = answer(run, (o) => [o[1]!]);
    expect(topKey(run.state, 'B')).toBe(`${S.faisca.id}@1`);
  });
});

describe('Iono (A4b): cada jogador embaralha a mão no baralho e compra a mesma quantidade', () => {
  it('as duas mãos mantêm o tamanho e nenhuma carta some', () => {
    const state = fixture(side({ active: { stack: [P(bloco)] }, hand: [P(iono), P(S.gota), P(S.kitReparo), P(S.talisma)] }),
      side({ active: { stack: [P(bloco)] }, hand: [P(S.faisca), P(S.broto), P(S.mentoria), P(S.rastreador), P(S.trocaTatica)] }));
    const run = play(state, iono);
    expect(run.state.players.A.hand).toHaveLength(3);
    expect(run.state.players.B.hand).toHaveLength(5);
    expect(run.state.players.A.deck).toHaveLength(8);
    expect(run.state.players.B.deck).toHaveLength(8);
    expect(keys(run.state, run.state.players.A.discard)).toEqual([`${iono.id}@1`]);
    expect(run.events.filter((e) => e.type === 'HAND_SHUFFLED_INTO_DECK').map((e) => e.data.player)).toEqual(['A', 'B']);
  });

  it('com a própria mão vazia (só o Iono), o jogador não compra nada; o oponente sim', () => {
    const state = fixture(side({ active: { stack: [P(bloco)] }, hand: [P(iono)] }), side({ active: { stack: [P(bloco)] }, hand: [P(S.faisca), P(S.broto)] }));
    const run = play(state, iono);
    expect(run.state.players.A.hand).toHaveLength(0);
    expect(run.state.players.B.hand).toHaveLength(2);
  });
});

describe('Moedas: Victory Star (Victini), Will e Penny', () => {
  const stomp = (attacker: CardDefinition, coins: ('HEADS' | 'TAILS')[], hand: string[] = []) => fixture(
    side({ active: { stack: [P(attacker)], energies: ['FIRE'] }, bench: [{ stack: [P(victini)] }], hand }), side({ active: { stack: [P(bloco)] } }), { coins });

  it('Victini: depois das moedas de um ataque de Pokémon {R}, pode relançar; o novo resultado vale', () => {
    let run = hit(stomp(ponyta, ['TAILS', 'HEADS']), 'stomp');
    const d = pending(run);
    expect(d).toMatchObject({ kind: 'CONFIRM_OPTIONAL', player: 'A', reason: 'REROLL_COINS' });
    run = answer(run, () => ['YES']);
    expect(active(run.state, 'B').damage).toBe(40);
    expect(run.events.filter((e) => e.type === 'COIN_RESOLVED').map((e) => e.data.reason)).toEqual(['EFFECT', 'REROLL']);
  });

  it('Victini: recusar o relançamento mantém as moedas originais', () => {
    const run = answer(hit(stomp(ponyta, ['TAILS', 'HEADS']), 'stomp'), () => ['NO']);
    expect(active(run.state, 'B').damage).toBe(10);
    expect(run.state.scriptedCoins).toEqual(['HEADS']);
  });

  it('Victini: ataque de Pokémon que não é {R} não oferece relançamento', () => {
    const run = hit(stomp(moedeiro, ['TAILS']), 'moeda');
    expect(run.state.pendingDecisions).toHaveLength(0);
    expect(active(run.state, 'B').damage).toBe(10);
  });

  it('Will: a primeira moeda da próxima jogada por efeito neste turno sai cara', () => {
    const state = fixture(side({ active: { stack: [P(moedeiro)] }, hand: [P(will)] }), side({ active: { stack: [P(bloco)] } }), { coins: ['TAILS'] });
    let run = play(state, will);
    expect(run.state.players.A.forceHeads).toBe(true);
    run = hit(run, 'moeda');
    expect(active(run.state, 'B').damage).toBe(40);
    expect(run.state.players.A.forceHeads).toBeFalsy();
  });

  it('Will com Victini: a cara forçada vale e o relançamento continua opcional', () => {
    let run = play(stomp(ponyta, ['TAILS'], [P(will)]), will);
    run = hit(run, 'stomp');
    if (run.state.pendingDecisions.length) run = answer(run, () => ['NO']);
    expect(active(run.state, 'B').damage).toBe(40);
  });

  it('Penny: usa o efeito de um Apoiador aleatório do baralho do oponente (Estudioso: compra 2)', () => {
    const state = fixture(side({ active: { stack: [P(bloco)] }, hand: [P(penny)] }), side({ active: { stack: [P(bloco)] } }));
    const run = play(state, penny);
    expect(run.state.players.A.hand).toHaveLength(2);
    expect(run.state.players.A.deck).toHaveLength(6);
    expect(run.state.players.B.deck).toHaveLength(8);
    expect(run.events.some((e) => e.type === 'TRAINER_COPIED')).toBe(true);
    expect(keys(run.state, run.state.players.A.discard)).toEqual([`${penny.id}@1`]);
  });

  it('Penny: sem Apoiador diferente de Penny no baralho do oponente, nada acontece', () => {
    const state = fixture(side({ active: { stack: [P(bloco)] }, hand: [P(penny)] }), side({ active: { stack: [P(bloco)] }, deck: [P(penny), P(S.gota)] }));
    const run = play(state, penny);
    expect(run.state.players.A.hand).toHaveLength(0);
    expect(run.events.some((e) => e.type === 'TRAINER_COPIED')).toBe(false);
  });
});

describe('Unown GUARDA/PODER: funciona com outro Unown em jogo com Habilidade diferente', () => {
  const guarded = (bench: FixturePokemon[]) => hit(fixture(side({ active: { stack: [P(batedor)] } }),
    side({ active: { stack: [P(unownGuard)] }, bench })), 'golpe-30');

  it('GUARDA com Unown PODER (ou CONFERIR) em jogo: −10 de ataques', () => {
    expect(active(guarded([{ stack: [P(unownPower)] }]).state, 'B').damage).toBe(20);
    expect(active(guarded([{ stack: [P(unownCheck)] }]).state, 'B').damage).toBe(20);
  });

  it('GUARDA sozinho, ou só com outro Unown GUARDA: não funciona', () => {
    expect(active(guarded([]).state, 'B').damage).toBe(30);
    expect(active(guarded([{ stack: [P(unownGuard)] }]).state, 'B').damage).toBe(30);
    expect(active(guarded([{ stack: [P(bloco)] }]).state, 'B').damage).toBe(30);
  });

  it('PODER com Unown GUARDA em jogo: seus ataques causam +10 ao Ativo do oponente', () => {
    const power = (bench: FixturePokemon[]) => hit(fixture(side({ active: { stack: [P(batedor)] }, bench: [{ stack: [P(unownPower)] }, ...bench] }),
      side({ active: { stack: [P(bloco)] } })), 'golpe-30');
    expect(active(power([{ stack: [P(unownGuard)] }]).state, 'B').damage).toBe(40);
    expect(active(power([]).state, 'B').damage).toBe(30);
  });
});

describe('Revide, mover dano, involuir, sem cura e moeda antes do ataque', () => {
  it('Capacete Rochoso: o atacante leva 20 quando o portador no Ativo recebe dano de ataque (mesmo Nocauteado)', () => {
    const run = hit(fixture(side({ active: { stack: [P(batedor)] } }), side({ active: { stack: [P(bloco)], toolPrintingId: P(rockyHelmet) } })), 'golpe-30');
    expect(active(run.state, 'A').damage).toBe(20);
    const ko = hit(fixture(side({ active: { stack: [P(batedor)] } }),
      side({ active: { stack: [P(S.gota)], toolPrintingId: P(rockyHelmet) }, bench: [{ stack: [P(bloco)] }] })), 'golpe-70');
    expect(ko.state.players.A.points).toBe(1);
    expect(active(ko.state, 'A').damage).toBe(20);
  });

  it('Capacete Rochoso não revida o dano que o próprio ataque causa ao portador (Mimikyu Golpe Sombrio)', () => {
    const run = hit(fixture(side({ active: { stack: [P(mimikyu)], energies: ['PSYCHIC', 'PSYCHIC'], toolPrintingId: P(rockyHelmet) } }),
      side({ active: { stack: [P(bloco)] } })), 'shadow-hit');
    expect(active(run.state, 'B').damage).toBe(60);
    expect(active(run.state, 'A').damage).toBe(20);
  });

  it('Capacete Rochoso no Banco não revida', () => {
    const run = hit(fixture(side({ active: { stack: [P(batedor)] } }),
      side({ active: { stack: [P(bloco)] }, bench: [{ stack: [P(bloco)], toolPrintingId: P(rockyHelmet) }] })), 'chuva');
    expect(run.state.players.B.bench[0]!.damage).toBe(20);
    expect(active(run.state, 'A').damage).toBe(0);
  });

  it('COUNTER_DAMAGE (Togedemaru Espinhos Eriçados): no próximo turno do oponente, dano de ataque devolve 30', () => {
    let run = hit(fixture(side({ active: { stack: [P(togedemaru)], energies: ['METAL', 'METAL'] } }), side({ active: { stack: [P(batedor)] } })), 'bristling-spikes');
    expect(active(run.state, 'B').damage).toBe(30);
    run = hit(run, 'golpe-30', 'B');
    expect(active(run.state, 'A').damage).toBe(30);
    expect(active(run.state, 'B').damage).toBe(60);
    // Expira no fim do turno do oponente.
    run = act(run, { type: 'END_TURN', player: 'A' });
    run = hit(run, 'golpe-30', 'B');
    expect(active(run.state, 'B').damage).toBe(60);
  });

  it('MOVE_DAMAGE (Dusknoir Vazio Sombrio): move todo o dano de outro Pokémon seu, quantas vezes quiser', () => {
    const state = fixture(side({ active: { stack: [P(dusknoir)] }, bench: [{ stack: [P(bloco)], damage: 30 }, { stack: [P(S.gota)], damage: 20 }] }), side({ active: { stack: [P(bloco)] } }));
    const use: Action = { type: 'USE_ABILITY', player: 'A', entityId: active(state, 'A').entityId, abilityId: 'shadow-void' };
    let run = act(state, use);
    expect(pending(run).options).toHaveLength(2);
    run = answer(run, (o) => [o[0]!]);
    run = act(run, use);
    expect(active(run.state, 'A').damage).toBe(50);
    expect(run.state.players.A.bench.filter(Boolean).map((e) => e!.damage)).toEqual([0, 0]);
    expect(code(run.state, use)).toBe('CARD_PRECONDITION_FAILED');
  });

  it('DEVOLVE (Celebi Folhas Temporais): a evolução do topo volta para a mão do oponente; o dano fica', () => {
    // Baralho do oponente vazio: a compra do início do turno dele não entra na mão.
    const run = hit(fixture(side({ active: { stack: [P(celebi)], energies: ['GRASS', 'GRASS'] } }),
      side({ active: { stack: [P(timburr), P(gurdurr)] }, bench: [{ stack: [P(bloco)] }], deck: [] })), 'temporal-leaves');
    expect(topKey(run.state, 'B')).toBe(`${timburr.id}@1`);
    expect(active(run.state, 'B').damage).toBe(40);
    expect(keys(run.state, run.state.players.B.hand)).toEqual([`${gurdurr.id}@1`]);
  });

  it('DEVOLVE: com o dano acima dos PS do Básico, ele é Nocauteado depois de involuir', () => {
    const run = hit(fixture(side({ active: { stack: [P(celebi)], energies: ['GRASS', 'GRASS'] } }),
      side({ active: { stack: [P(timburr), P(gurdurr)], damage: 30 }, bench: [{ stack: [P(bloco)] }], deck: [] })), 'temporal-leaves');
    expect(run.state.players.A.points).toBe(1);
    expect(keys(run.state, run.state.players.B.hand)).toEqual([`${gurdurr.id}@1`]);
    expect(keys(run.state, run.state.players.B.discard)).toEqual([`${timburr.id}@1`]);
  });

  it('DEVOLVE num Básico não faz nada', () => {
    const run = hit(fixture(side({ active: { stack: [P(celebi)], energies: ['GRASS', 'GRASS'] } }), side({ active: { stack: [P(bloco)] }, deck: [] })), 'temporal-leaves');
    expect(active(run.state, 'B').stack).toHaveLength(1);
    expect(run.state.players.B.hand).toHaveLength(0);
  });

  it('PREVENT_HEALING (Claydol Bloqueio de Cura): nenhum Pokémon é curado, dos dois lados', () => {
    const state = fixture(side({ active: { stack: [P(bloco)], damage: 30 }, bench: [{ stack: [P(claydol)] }], hand: [P(S.kitReparo)] }), side({ active: { stack: [P(bloco)] } }));
    const run = play(state, S.kitReparo);
    expect(active(run.state, 'A').damage).toBe(30);
    // Sem o Claydol, cura.
    const free = fixture(side({ active: { stack: [P(bloco)], damage: 30 }, hand: [P(S.kitReparo)] }), side({ active: { stack: [P(bloco)] }, bench: [] }));
    expect(active(play(free, S.kitReparo).state, 'A').damage).toBe(10);
    const theirs = fixture(side({ active: { stack: [P(bloco)], damage: 30 }, hand: [P(S.kitReparo)] }), side({ active: { stack: [P(bloco)] }, bench: [{ stack: [P(claydol)] }] }));
    expect(active(play(theirs, S.kitReparo).state, 'A').damage).toBe(30);
  });

  it('ATTACK_COIN_GATE (Weezing Cortina de Fumaça): coroa = o ataque do Defensor não acontece; cara = acontece', () => {
    const gate = (coin: 'HEADS' | 'TAILS') => {
      const run = hit(fixture(side({ active: { stack: [P(weezing)], energies: ['DARKNESS', 'DARKNESS'] } }), side({ active: { stack: [P(bloco)] } }), { coins: [coin] }), 'smokescreen');
      return hit(run, 'golpe-30', 'B');
    };
    const tails = gate('TAILS');
    expect(active(tails.state, 'A').damage).toBe(0);
    expect(tails.events.find((e) => e.type === 'ATTACK_FAILED')?.data.reason).toBe('COIN_GATE');
    expect(tails.state.currentPlayer).toBe('A');
    expect(active(gate('HEADS').state, 'A').damage).toBe(30);
  });
});
