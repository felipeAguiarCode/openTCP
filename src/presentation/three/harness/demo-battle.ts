// Batalha de demonstração construída com o motor real (createMatch + applyAction): compra, Básico,
// Energia, ataque com moedas, Nocaute e pontos. Usada pelo harness e pelos testes do diretor. Pura.
import { applyAction, getPlayerView, redactEvents } from '../../../domain/battle/engine.ts';
import { createMatch } from '../../../domain/battle/setup.ts';
import type { Action, BattleEvent, MatchState, PlayerId } from '../../../domain/battle/types.ts';
import type { BattleView, CardRef } from '../../../domain/battle/views.ts';
import { buildCatalog, type Catalog } from '../../../domain/cards/catalog.ts';
import { cardFace, catalogNames, type CardFaceData } from '../../../domain/cards/text.ts';
import { definitionKey, isPokemon, type CardDefinition, type CardPrinting } from '../../../domain/cards/types.ts';
import { attack, c, flip, heads, mul, pokemon, pre, printing } from '../../../content/builders.ts';
import { S } from '../../../tests/support/starter-catalog.ts';

export const faisqueiro = pokemon({
  baseName: 'Faisqueiro', stage: 'BASIC', type: 'LIGHTNING', hp: 70, retreat: 1, weakness: 'FIGHTING',
  attacks: [attack({ id: 'choque-duplo', name: 'Choque Duplo', cost: { COLORLESS: 1 }, formula: mul(c(30), heads()), effects: [pre(flip(2))] })],
});
export const voltrix = pokemon({
  baseName: 'Voltrix', ruleBox: 'EX', stage: 'BASIC', type: 'LIGHTNING', hp: 140, retreat: 2, weakness: 'FIGHTING',
  attacks: [
    attack({ id: 'faisca-rapida', name: 'Faísca Rápida', cost: { LIGHTNING: 1 }, damage: 30 }),
    attack({ id: 'tempestade-eletrica', name: 'Tempestade Elétrica', cost: { LIGHTNING: 2, COLORLESS: 1 }, damage: 120, special: true }),
  ],
});

export type DemoBatch = {
  readonly label: string;
  readonly events: readonly BattleEvent[];
  readonly before: BattleView;
  readonly after: BattleView;
};

export type DemoBattle = {
  readonly catalog: Catalog;
  readonly viewer: PlayerId;
  readonly seed: number;
  readonly opening: DemoBatch;
  /** Estado em que o roteiro começa (turno do NPC prestes a terminar). */
  readonly start: BattleView;
  readonly script: readonly DemoBatch[];
  /** Treinador sem alvo jogado do mesmo ponto do Básico, fora do roteiro encadeado (prévia e dissolução; harness). */
  readonly trainer: DemoBatch | null;
  readonly faceOf: (ref: Pick<CardRef, 'printingId' | 'definitionKey'>) => CardFaceData;
  readonly definitionOf: (ref: Pick<CardRef, 'printingId' | 'definitionKey'>) => CardDefinition;
};

function demoCatalog(): { catalog: Catalog; printingIdOf: (def: CardDefinition) => string } {
  const defs: CardDefinition[] = [...S.STARTER_POKEMON, ...S.STARTER_TRAINERS, faisqueiro, voltrix];
  const prints: CardPrinting[] = [...S.STARTER_POKEMON, ...S.STARTER_TRAINERS].map((card, i) => printing({ card, setId: 'base', number: i + 1, rarity: 'COMMON' }));
  prints.push(printing({ card: faisqueiro, setId: 'demo', number: 1, rarity: 'UNCOMMON', finish: 'HOLOGRAPHIC' }));
  prints.push(printing({ card: voltrix, setId: 'demo', number: 2, rarity: 'ULTRA', finish: 'FOIL' }));
  const catalog = buildCatalog(defs, prints);
  const printingIdOf = (def: CardDefinition) => {
    for (const [id, p] of catalog.printings) if (p.cardDefinitionId === def.id) return id;
    throw new Error(`sem impressão ${def.id}`);
  };
  return { catalog, printingIdOf };
}

type Run = { state: MatchState; events: BattleEvent[] };

export function buildDemoBattle(viewer: PlayerId = 'A'): DemoBattle {
  const { catalog, printingIdOf } = demoCatalog();
  const entry = (def: CardDefinition) => ({ printingId: printingIdOf(def), definitionKey: definitionKey(def.id, def.version) });
  const many = (def: CardDefinition, n: number) => Array.from({ length: n }, () => entry(def));
  const humanDeck = [...many(faisqueiro, 7), ...many(voltrix, 3), ...many(S.estudioso, 2), ...many(S.kitReparo, 2), ...many(S.talisma, 2), ...many(S.rastreador, 2), ...many(S.mentoria, 2)];
  const npcDeck = [...many(S.semente, 8), ...many(S.broto, 2), ...many(S.kitReparo, 2), ...many(S.trocaTatica, 2), ...many(S.estudioso, 2), ...many(S.mentoria, 2), ...many(S.talisma, 2)];
  const isBasic = (state: MatchState, id: string) => {
    const def = catalog.definition(state.cards[id]!.definitionKey);
    return isPokemon(def) && def.stage === 'BASIC';
  };
  const defOf = (state: MatchState, id: string) => catalog.definition(state.cards[id]!.definitionKey);

  for (let seed = 1; seed < 500; seed += 1) {
    const created = createMatch({
      matchId: `demo-${seed}`, seed, firstPlayer: 'A', scriptedCoins: ['HEADS', 'HEADS'],
      players: { A: { deck: humanDeck, energyTypes: ['LIGHTNING'] }, B: { deck: npcDeck, energyTypes: ['GRASS'] } },
    }, catalog);
    const s0 = created.state;
    const aBasics = s0.players.A.hand.filter((id) => isBasic(s0, id));
    const aActive = aBasics.find((id) => defOf(s0, id).id === faisqueiro.id);
    const aOthers = aBasics.filter((id) => id !== aActive);
    const bBasics = s0.players.B.hand.filter((id) => isBasic(s0, id) && defOf(s0, id).id === S.semente.id);
    if (!aActive || aOthers.length < 1 || bBasics.length < 2) continue;

    const views = (state: MatchState) => getPlayerView(state, catalog, viewer);
    const step = (run: Run, action: Action): Run => {
      const r = applyAction(run.state, catalog, action);
      if (!r.ok) throw new Error(`demo: ${action.type} rejeitada (${r.code}) ${r.message ?? ''}`);
      return { state: r.state, events: [...r.events] };
    };
    const batch = (label: string, from: MatchState, run: Run): DemoBatch => ({
      label, before: views(from), after: views(run.state), events: redactEvents(run.events, viewer),
    });
    try {
      // Preparação: humano escolhe Ativo + 1 Banco; NPC escolhe Ativo + 1 Banco.
      const setupA = s0.pendingDecisions.find((d) => d.player === 'A')!;
      const setupB = s0.pendingDecisions.find((d) => d.player === 'B')!;
      let run: Run = step({ state: s0, events: [] }, { type: 'RESOLVE_DECISION', player: 'A', decisionId: setupA.decisionId, selection: [aActive, aOthers[0]!] });
      const afterA = run.events;
      run = step(run, { type: 'RESOLVE_DECISION', player: 'B', decisionId: setupB.decisionId, selection: [bBasics[0]!, bBasics[1]!] });
      const opening: DemoBatch = {
        label: 'Abertura',
        before: views(s0),
        after: views(run.state),
        events: redactEvents([...created.events, ...afterA, ...run.events], viewer),
      };
      // Turno 1 (A) → fim; turno 2 (B): Energia no Ativo e fim.
      run = step(run, { type: 'END_TURN', player: 'A' });
      const bActive = run.state.players.B.active!;
      if (run.state.players.B.energyZone.ready) run = step(run, { type: 'ATTACH_ENERGY', player: 'B', targetEntityId: bActive.entityId });
      const start = run.state;
      // Roteiro: fim do turno do NPC (compra humana), Básico, Energia, ataque com moedas → Nocaute → pontos.
      const r1 = step({ state: start, events: [] }, { type: 'END_TURN', player: 'B' });
      const playable = r1.state.players.A.hand.filter((id) => isBasic(r1.state, id));
      const pick = playable.find((id) => defOf(r1.state, id).id === voltrix.id) ?? playable[0];
      const benchIndex = r1.state.players.A.bench.findIndex((b) => b === null);
      if (!pick || benchIndex < 0) continue;
      const r2 = step(r1, { type: 'PLAY_BASIC', player: 'A', cardId: pick, benchIndex });
      const r3 = step(r2, { type: 'ATTACH_ENERGY', player: 'A', targetEntityId: r2.state.players.A.active!.entityId });
      const r4 = step(r3, { type: 'ATTACK', player: 'A', attackId: 'choque-duplo' });
      if (!r4.events.some((e) => e.type === 'POKEMON_KNOCKED_OUT')) continue;
      const script = [
        batch('Fim do turno do NPC · compra', start, r1),
        batch('Jogar Básico', r1.state, r2),
        batch('Ligar Energia', r2.state, r3),
        batch('Ataque com moedas · Nocaute · pontos', r3.state, r4),
      ];
      const trainerId = r2.state.players.A.hand.find((id) => [S.mentoria.id, S.estudioso.id, S.rastreador.id].includes(defOf(r2.state, id).id));
      let trainer: DemoBatch | null = null;
      try {
        if (trainerId) trainer = batch('Jogar Treinador', r2.state, step(r2, { type: 'PLAY_TRAINER', player: 'A', cardId: trainerId }));
      } catch {
        trainer = null;
      }
      const faceOf = (ref: Pick<CardRef, 'printingId' | 'definitionKey'>) => {
        const def = catalog.definition(ref.definitionKey);
        return cardFace(def, catalog.printing(ref.printingId), catalogNames(catalog));
      };
      const definitionOf = (ref: Pick<CardRef, 'printingId' | 'definitionKey'>) => catalog.definition(ref.definitionKey);
      return { catalog, viewer, seed, opening, start: views(start), script, trainer, faceOf, definitionOf };
    } catch {
      continue;
    }
  }
  throw new Error('demo: nenhuma semente produziu o roteiro completo');
}
