// Laboratório funcional do Estúdio (editor-de-cartas.md §25): roda um cenário explícito contra o MESMO
// motor dos duelos (createMatchFromFixture + applyAction), com moedas forçadas visíveis (scriptedCoins),
// sem recompensas e sem persistir a partida. O resultado vira uma linha append-only de `card_test_runs`
// (gravada pela aplicação) ligada ao rulesHash testado; “Passou” vale só para aquele cenário.
import { applyAction, getLegalActions, stateHash, validateAction } from '../battle/engine.ts';
import { createMatchFromFixture, ENGINE_VERSION, type BattleFixture, type FixturePokemon, type FixtureSide } from '../battle/setup.ts';
import type { Action, BattleEvent, CatalogLookup, MatchState } from '../battle/types.ts';
import { buildCatalog } from '../cards/catalog.ts';
import { deckLimitKeyV1 } from '../cards/naming.ts';
import type { Attack, CardDefinition, CardPrinting, EnergyType, PokemonCard, PokemonType, SpecialCondition } from '../cards/types.ts';
import { definitionKey, ENERGY_TYPES } from '../cards/types.ts';
import type { CoinFace } from '../random/rng.ts';
import { costTypeOf, newPrinting, uniqueId, type ScenarioExpect, type TestScenario } from './draft.ts';

export const LAB_RUNNER_VERSION = `studio-lab-1/${ENGINE_VERSION}`;

// ---------------------------------------------------------------- fixtures de laboratório

export type LabFixtureId =
  | 'default' | 'no-energy' | 'weakness' | 'low-hp-target' | 'asleep' | 'paralyzed' | 'confused' | 'full-hand' | 'empty-deck'
  | 'no-bench' | 'full-bench' | 'damaged-self';

export const LAB_FIXTURES: readonly { readonly id: LabFixtureId; readonly label: string; readonly hint: string }[] = [
  { id: 'default', label: 'Uso mínimo legal', hint: 'Energia exata do custo ligada; alvo com 990 PS e sem Fraqueza; Bancos com um Pokémon.' },
  { id: 'no-energy', label: 'Energia insuficiente', hint: 'Nenhuma Energia ligada: o ataque não pode ser declarado nem consome recursos.' },
  { id: 'weakness', label: 'Dano com Fraqueza', hint: 'O alvo tem Fraqueza ao tipo desta carta (+20).' },
  { id: 'low-hp-target', label: 'Nocaute do alvo', hint: 'O Ativo do oponente tem 10 PS: qualquer dano Nocauteia.' },
  { id: 'asleep', label: 'Condição impeditiva: Adormecido', hint: 'Esta carta está Adormecida no Ativo.' },
  { id: 'paralyzed', label: 'Condição impeditiva: Paralisado', hint: 'Esta carta está Paralisada no Ativo.' },
  { id: 'confused', label: 'Confusão', hint: 'Esta carta está Confusa: a moeda de Confusão é a primeira moeda forçada.' },
  { id: 'full-hand', label: 'Mão cheia', hint: 'Mão com 10 cartas: compras extras respeitam o limite.' },
  { id: 'empty-deck', label: 'Baralho vazio', hint: 'Baralho próprio vazio: compras e buscas não travam a resolução.' },
  { id: 'no-bench', label: 'Alvo ausente', hint: 'Ninguém no Banco: efeitos que escolhem no Banco resolvem a política declarada.' },
  { id: 'full-bench', label: 'Bancos cheios', hint: 'Três Pokémon em cada Banco: escolhas de alvo pedem decisão de quem o seletor indica.' },
  { id: 'damaged-self', label: 'Pokémon com dano', hint: 'O seu Ativo começa com 30 de dano (cura, Ferramentas de HP).' },
];

export const LAB_FIXTURE_IDS: readonly string[] = LAB_FIXTURES.map((f) => f.id);

/** Cartas sintéticas do laboratório (nomes originais; nunca entram no catálogo publicado). */
function dummy(id: string, baseName: string, hp: number, type: PokemonType, weakness: PokemonType | null, attacks: Attack[] = []): PokemonCard {
  const name = baseName;
  return {
    dataVersion: 2, effectsDsl: 1, id, version: 1, baseName, name, deckLimitKey: deckLimitKeyV1(name), category: 'POKEMON', stage: 'BASIC',
    evolvesFrom: [], types: [type], baseHp: hp, retreatCost: 1, weakness: weakness ? { type: weakness, operation: 'ADD', value: 20 } : null,
    ruleBox: 'NONE', knockoutPoints: 1, tags: [], attacks, abilities: [],
  };
}

const HIT: Attack = {
  id: 'lab-golpe', name: 'Golpe de Teste', energyCost: {}, baseDamage: 10, damageFormula: null, damageTarget: { scope: 'OPPONENT_ACTIVE' },
  preconditions: [], additionalCosts: [], effects: [], endsTurn: true,
};

type LabCards = { readonly target: PokemonCard; readonly reserve: PokemonCard; readonly hitter: PokemonCard };

function labCards(cardType: PokemonType, fixture: LabFixtureId): LabCards {
  return {
    target: dummy('lab-alvo-de-treino', 'Alvo de Treino', fixture === 'low-hp-target' ? 10 : 990, 'COLORLESS', fixture === 'weakness' ? cardType : null),
    reserve: dummy('lab-reserva-de-treino', 'Reserva de Treino', 500, 'COLORLESS', null),
    hitter: dummy('lab-batedor-de-treino', 'Batedor de Treino', 990, 'COLORLESS', null, [HIT]),
  };
}

// ---------------------------------------------------------------- resultado

export type LabOutcome = 'PASS' | 'FAIL' | 'ERROR';

export type LabDiff = { readonly field: keyof ScenarioExpect; readonly expected: unknown; readonly actual: unknown };

export type LabEvent = { readonly seq: number; readonly type: string; readonly data: Readonly<Record<string, unknown>> };

export type LabResult = {
  readonly runnerVersion: string;
  readonly engineVersion: string;
  readonly rulesHash: string;
  readonly scenarioId: string;
  readonly fixture: string;
  readonly action: string;
  readonly outcome: LabOutcome;
  readonly legal: boolean;
  readonly errorCode: string | null;
  readonly baseDamage: number;
  readonly finalDamage: number;
  readonly knockout: boolean;
  readonly pointsGranted: number;
  readonly coins: readonly CoinFace[];
  /** Moedas forçadas efetivamente consumidas pelo cenário (rótulo visível “moedas de teste”). */
  readonly forcedCoinsUsed: number;
  readonly diffs: readonly LabDiff[];
  readonly events: readonly LabEvent[];
  readonly notes: readonly string[];
  readonly message: string | null;
  /** Nomes para o relatório textual: IDs de carta/entidade da partida de laboratório → nome exibido. */
  readonly names: Readonly<Record<string, string>>;
};

export type LabInput = {
  /** Regras compiladas do rascunho (id/versão do alvo). */
  readonly definition: CardDefinition;
  /** Impressão usada para registrar a carta na partida (aparência não altera regras). */
  readonly printing: CardPrinting;
  readonly scenario: TestScenario;
  readonly rulesHash: string;
  /** Catálogo publicado (base + autorais) para evoluções e filtros por nome; a própria versão é substituída pelo rascunho. */
  readonly catalog?: { readonly definitions: readonly CardDefinition[]; readonly printings: readonly CardPrinting[] };
  readonly seed?: number;
};

// ---------------------------------------------------------------- construção da partida

const LAB_SET = 'lab';

function labPrinting(def: CardDefinition): CardPrinting {
  return { ...newPrinting({ rules: def, definitionId: def.id, version: def.version, finish: 'NORMAL', token: 'lab', setId: LAB_SET, collectorNumber: '000' }), printingId: `lab-print-${def.id}` };
}

/** Catálogo do laboratório: publicado (sem a versão em teste) + rascunho + cartas sintéticas. */
export function labCatalog(input: LabInput, cards: LabCards): { readonly catalog: CatalogLookup & { readonly definitionKeyOfPrinting: (id: string) => string }; readonly printingId: string; readonly ids: Record<keyof LabCards, string> } {
  const key = definitionKey(input.definition.id, input.definition.version);
  const synthetic = [cards.target, cards.reserve, cards.hitter];
  const syntheticIds = new Set(synthetic.map((d) => d.id));
  const defs = (input.catalog?.definitions ?? []).filter((d) => definitionKey(d.id, d.version) !== key && !syntheticIds.has(d.id));
  const keys = new Set(defs.map((d) => definitionKey(d.id, d.version)));
  const prints = (input.catalog?.printings ?? []).filter((p) => keys.has(definitionKey(p.cardDefinitionId, p.cardDefinitionVersion)) && p.printingId !== input.printing.printingId);
  const printing = { ...input.printing, printingId: input.printing.printingId, cardDefinitionId: input.definition.id, cardDefinitionVersion: input.definition.version };
  const extra = synthetic.map(labPrinting);
  const catalog = buildCatalog([...defs, input.definition, ...synthetic], [...prints.filter((p) => !extra.some((x) => x.printingId === p.printingId)), printing, ...extra]);
  return {
    catalog, printingId: printing.printingId,
    ids: { target: extra[0]!.printingId, reserve: extra[1]!.printingId, hitter: extra[2]!.printingId },
  };
}

function nonMatching(types: readonly EnergyType[]): EnergyType {
  return (ENERGY_TYPES.find((t) => !types.includes(t)) ?? 'WATER') as EnergyType;
}

/** Energias que pagam exatamente o custo; Incolor é pago com outro tipo para provar que aceita qualquer Energia (ED-019). */
export function energiesForCost(attack: Attack | undefined): EnergyType[] {
  if (!attack) return [];
  const out: EnergyType[] = [];
  const specific = (Object.entries(attack.energyCost) as [string, number][]).filter(([t]) => t !== 'COLORLESS');
  for (const [type, n] of specific) for (let i = 0; i < n; i += 1) out.push(type as EnergyType);
  const colorless = attack.energyCost.COLORLESS ?? 0;
  const filler = nonMatching(specific.map(([t]) => t as EnergyType));
  for (let i = 0; i < colorless; i += 1) out.push(filler);
  return out;
}

function conditionsOf(fixture: LabFixtureId): SpecialCondition[] {
  if (fixture === 'asleep') return ['ASLEEP'];
  if (fixture === 'paralyzed') return ['PARALYZED'];
  if (fixture === 'confused') return ['CONFUSED'];
  return [];
}

function fixtureId(raw: string): LabFixtureId {
  return (LAB_FIXTURE_IDS.includes(raw) ? raw : 'default') as LabFixtureId;
}

type Built = { readonly state: MatchState; readonly events: BattleEvent[]; readonly catalog: CatalogLookup; readonly actorEntity: string | null; readonly targetEntity: string | null };

function buildMatch(input: LabInput): Built {
  const def = input.definition;
  const fx = fixtureId(input.scenario.fixture);
  const cardType: PokemonType = def.category === 'POKEMON' ? def.types[0] ?? 'COLORLESS' : 'COLORLESS';
  const cards = labCards(cardType, fx);
  const { catalog, printingId, ids } = labCatalog(input, cards);
  const attack = def.attacks.find((a) => a.id === input.scenario.attackId) ?? def.attacks[0];
  const zoneType: EnergyType = def.category === 'POKEMON' ? (costTypeOf(cardType) === 'COLORLESS' ? 'FIRE' : costTypeOf(cardType) as EnergyType) : 'FIRE';
  const fill = (n: number, id: string) => Array.from({ length: n }, () => id);
  const kind = input.scenario.kind;
  const selfPokemon = def.category === 'POKEMON' || (def.category === 'TRAINER' && !!def.trainerRules.fieldBehavior && kind === 'KNOCKOUT');
  const humanActive: FixturePokemon = (() => {
    if (kind === 'KNOCKOUT') return { stack: [ids.hitter] };
    if (def.category === 'POKEMON') {
      return {
        stack: [printingId], energies: fx === 'no-energy' ? [] : kind === 'ABILITY' ? [] : energiesForCost(attack), conditions: conditionsOf(fx),
        damage: fx === 'damaged-self' ? 30 : 0, enteredPlayOnTurn: 1,
      };
    }
    return { stack: [ids.reserve], damage: fx === 'damaged-self' || def.category === 'TRAINER' ? 30 : 0, enteredPlayOnTurn: 1 };
  })();
  const npcActive: FixturePokemon = kind === 'KNOCKOUT' && selfPokemon
    ? { stack: [printingId], damage: Math.max(0, (def.category === 'POKEMON' ? def.baseHp : def.category === 'TRAINER' ? def.trainerRules.fieldBehavior?.hp ?? 10 : 10) - 10) }
    : { stack: [ids.target] };
  const benchCount = fx === 'no-bench' ? 0 : fx === 'full-bench' ? 3 : 1;
  const bench = Array.from({ length: benchCount }, () => ({ stack: [ids.reserve], damage: fx === 'damaged-self' ? 30 : 0, enteredPlayOnTurn: 1 }));
  const hand = def.category === 'TRAINER' && kind !== 'KNOCKOUT' ? [printingId] : [];
  const human: FixtureSide = {
    deck: fx === 'empty-deck' ? [] : fill(8, ids.reserve),
    hand: fx === 'full-hand' ? [...hand, ...fill(10 - hand.length, ids.reserve)] : hand,
    discard: [], active: humanActive, bench,
    energyZone: { types: [zoneType], ready: null, next: zoneType }, points: 0,
  };
  const npc: FixtureSide = {
    deck: fill(8, ids.reserve), hand: [], discard: [], active: npcActive, bench: Array.from({ length: benchCount }, () => ({ stack: [ids.reserve] })),
    energyZone: { types: ['WATER'], ready: null, next: 'WATER' }, points: 0,
  };
  const fixture: BattleFixture = {
    fixtureId: `studio-lab:${fx}`, kind: 'LAB', label: `Laboratório — ${LAB_FIXTURES.find((f) => f.id === fx)?.label ?? fx}`, startPhase: 'MAIN',
    firstPlayer: 'HUMAN', currentPlayer: 'HUMAN', globalTurnNumber: 3, ownTurns: { HUMAN: 2, NPC: 1 }, stadiumPrintingId: null,
    players: { HUMAN: human, NPC: npc },
    ...(input.scenario.forcedCoins.length ? { scriptedRandom: { coins: input.scenario.forcedCoins, label: 'Moedas de teste (laboratório)' } } : {}),
  };
  const created = createMatchFromFixture(fixture, `lab-${input.scenario.id}`, input.seed ?? 20261015, catalog, (pid) => catalog.definitionKeyOfPrinting(pid));
  return {
    state: created.state, events: [...created.events], catalog,
    actorEntity: created.state.players.A.active?.entityId ?? null,
    targetEntity: created.state.players.B.active?.entityId ?? null,
  };
}

// ---------------------------------------------------------------- execução

type Run = { state: MatchState; events: BattleEvent[] };

/** Responde decisões pendentes de forma determinística (primeiras opções), como um roteiro de teste. */
function settle(run: Run, cat: CatalogLookup, notes: string[]): Run | { error: string } {
  for (let guard = 0; guard < 40; guard += 1) {
    const d = run.state.pendingDecisions.find((x) => !x.answered);
    if (!d) return run;
    const selection = d.kind === 'ORDER_TOP' ? [...d.options]
      : d.kind === 'CONFIRM_OPTIONAL' ? ['YES']
        : d.options.slice(0, Math.min(d.max, Math.max(d.min, 1)));
    notes.push(`Decisão ${d.kind} (${d.reason}) respondida automaticamente: ${selection.length} opção(ões).`);
    const r = applyAction(run.state, cat, { type: 'RESOLVE_DECISION', player: d.player, decisionId: d.decisionId, selection });
    if (!r.ok) return { error: `${r.code}${r.message ? `: ${r.message}` : ''}` };
    run = { state: r.state, events: [...run.events, ...r.events] };
  }
  return { error: 'Decisões demais pendentes no cenário.' };
}

function pickAction(state: MatchState, cat: CatalogLookup, input: LabInput, built: Built): { action: Action; label: string } | { missing: string } {
  const def = input.definition;
  const s = input.scenario;
  const legal = getLegalActions(state, cat, 'A');
  if (s.kind === 'KNOCKOUT') {
    const hit = legal.find((a) => a.type === 'ATTACK' && a.attackId === HIT.id);
    return hit ? { action: hit, label: 'ATTACK lab-golpe (oponente de teste Nocauteia esta carta)' } : { missing: 'golpe de teste indisponível' };
  }
  if (s.kind === 'TRAINER') {
    const play = legal.find((a) => a.type === 'PLAY_TRAINER');
    if (play) return { action: play, label: `PLAY_TRAINER ${def.name}` };
    const cardId = state.players.A.hand.find((id) => state.cards[id]?.definitionKey === definitionKey(def.id, def.version));
    return cardId ? { action: { type: 'PLAY_TRAINER', player: 'A', cardId, targetEntityId: built.actorEntity ?? undefined }, label: `PLAY_TRAINER ${def.name}` } : { missing: 'carta não está na mão' };
  }
  if (s.kind === 'ABILITY') {
    const abilityId = s.abilityId ?? def.abilities[0]?.id;
    const use = legal.find((a) => a.type === 'USE_ABILITY' && a.abilityId === abilityId);
    if (use) return { action: use, label: `USE_ABILITY ${abilityId}` };
    return built.actorEntity && abilityId
      ? { action: { type: 'USE_ABILITY', player: 'A', entityId: built.actorEntity, abilityId }, label: `USE_ABILITY ${abilityId}` }
      : { missing: 'Habilidade inexistente' };
  }
  const attackId = s.attackId ?? def.attacks[0]?.id;
  const attack = legal.find((a) => a.type === 'ATTACK' && a.attackId === attackId);
  if (attack) return { action: attack, label: `ATTACK ${attackId}` };
  return attackId ? { action: { type: 'ATTACK', player: 'A', attackId }, label: `ATTACK ${attackId}` } : { missing: 'carta sem ataque' };
}

function measure(events: readonly BattleEvent[], built: Built) {
  const damage = events.filter((e) => e.type === 'DAMAGE_APPLIED');
  const mine = (e: BattleEvent) => e.data.sourcePlayer === 'A';
  const main = damage.find((e) => mine(e) && e.data.category === 'ATTACK' && e.data.targetEntityId === built.targetEntity);
  const breakdown = (main?.data.breakdown ?? null) as { base?: number } | null;
  const baseDamage = breakdown?.base ?? 0;
  const finalDamage = damage.filter((e) => mine(e)).reduce((sum, e) => sum + Number(e.data.amount ?? 0), 0);
  const kos = events.filter((e) => e.type === 'POKEMON_KNOCKED_OUT');
  const knockout = kos.some((e) => e.data.player === 'B');
  const pointsGranted = events.filter((e) => e.type === 'POINTS_GRANTED' && e.data.player === 'A').reduce((sum, e) => sum + Number(e.data.points ?? 0), 0);
  const coins = events.filter((e) => e.type === 'COIN_RESOLVED' && e.data.reason !== 'FIRST_PLAYER').flatMap((e) => (e.data.results as CoinFace[] | undefined) ?? []);
  return { baseDamage, finalDamage, knockout, pointsGranted, coins };
}

function compare(expect: ScenarioExpect, actual: { legal: boolean; errorCode: string | null; baseDamage: number; finalDamage: number; knockout: boolean; pointsGranted: number }): LabDiff[] {
  const diffs: LabDiff[] = [];
  const check = <K extends keyof ScenarioExpect>(field: K, value: unknown) => {
    if (expect[field] !== undefined && expect[field] !== value) diffs.push({ field, expected: expect[field], actual: value });
  };
  check('legal', actual.legal);
  check('errorCode', actual.errorCode);
  check('baseDamage', actual.baseDamage);
  check('finalDamage', actual.finalDamage);
  check('knockout', actual.knockout);
  check('pointsGranted', actual.pointsGranted);
  return diffs;
}

function namesOf(state: MatchState, cat: CatalogLookup): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, card] of Object.entries(state.cards)) {
    try { out[id] = cat.definition(card.definitionKey).name; } catch { out[id] = id; }
  }
  for (const player of ['A', 'B'] as const) {
    const p = state.players[player];
    for (const e of [p.active, ...p.bench]) if (e) out[e.entityId] = out[e.stack[e.stack.length - 1]!] ?? e.entityId;
  }
  return out;
}

function trimEvents(events: readonly BattleEvent[]): LabEvent[] {
  return events.filter((e) => e.type !== 'FIXTURE_LOADED').slice(0, 200).map((e) => ({ seq: e.seq, type: e.type, data: e.data }));
}

/** Executa um cenário. Nunca lança: problemas de conteúdo/motor viram outcome ERROR com mensagem. */
export function runLabScenario(input: LabInput): LabResult {
  const base = {
    runnerVersion: LAB_RUNNER_VERSION, engineVersion: ENGINE_VERSION, rulesHash: input.rulesHash, scenarioId: input.scenario.id,
    fixture: fixtureId(input.scenario.fixture),
  };
  const notes: string[] = [];
  const empty = { legal: false, errorCode: null, baseDamage: 0, finalDamage: 0, knockout: false, pointsGranted: 0, coins: [], forcedCoinsUsed: 0, diffs: [], events: [], names: {} };
  let built: Built;
  try {
    built = buildMatch(input);
  } catch (error) {
    return { ...base, ...empty, action: '—', outcome: 'ERROR', notes, message: `Cenário não pôde ser montado: ${error instanceof Error ? error.message : String(error)}` };
  }
  const picked = pickAction(built.state, built.catalog, input, built);
  if ('missing' in picked) {
    return { ...base, ...empty, action: '—', outcome: 'ERROR', notes, message: `Ação indisponível: ${picked.missing}.` };
  }
  const startEvents = built.events.length;
  const validation = validateAction(built.state, built.catalog, picked.action);
  let run: Run = { state: built.state, events: [...built.events] };
  let legal = validation.ok;
  let errorCode: string | null = validation.ok ? null : validation.code;
  if (validation.ok) {
    const r = applyAction(built.state, built.catalog, picked.action);
    if (!r.ok) {
      legal = false;
      errorCode = r.code;
      if (r.code === 'ENGINE_ERROR' || r.code === 'CARD_EFFECT_UNSUPPORTED' || r.code === 'EFFECT_LOOP_DETECTED') {
        return { ...base, ...empty, action: picked.label, outcome: 'ERROR', legal: false, errorCode, notes, message: r.message ?? r.code };
      }
    } else {
      run = { state: r.state, events: [...run.events, ...r.events] };
      const settled = settle(run, built.catalog, notes);
      if ('error' in settled) return { ...base, ...empty, action: picked.label, outcome: 'ERROR', legal: true, errorCode: null, notes, message: settled.error };
      run = settled;
    }
  } else {
    notes.push('A ação foi recusada pela validação do motor; nenhum recurso foi consumido.');
  }
  if (input.scenario.kind === 'PERSISTENCE' && legal) {
    // Salvar/retomar: o mesmo cenário a partir de um estado serializado produz o mesmo resultado.
    const restored = JSON.parse(JSON.stringify(built.state)) as MatchState;
    const again = applyAction(restored, built.catalog, picked.action);
    const settled = again.ok ? settle({ state: again.state, events: [] }, built.catalog, []) : { error: again.code };
    const same = !('error' in settled) && stateHash(settled.state) === stateHash(run.state);
    notes.push(same ? 'Retomada a partir do estado serializado produziu o mesmo estado (hash idêntico).' : 'Retomada divergiu do estado original.');
    if (!same) {
      return { ...base, ...empty, action: picked.label, outcome: 'FAIL', legal, errorCode, notes, message: 'Salvar/retomar produziu estado diferente.' };
    }
  }
  const events = run.events.slice(startEvents);
  const m = measure(events, built);
  const forcedCoinsUsed = input.scenario.forcedCoins.length - run.state.scriptedCoins.length;
  if (input.scenario.forcedCoins.length && forcedCoinsUsed < input.scenario.forcedCoins.length) {
    notes.push(`${input.scenario.forcedCoins.length - forcedCoinsUsed} moeda(s) forçada(s) não foram usadas.`);
  }
  if (m.coins.length > forcedCoinsUsed) notes.push('Algumas moedas vieram do battleRng do laboratório (semente fixa), não das moedas forçadas.');
  const actual = { legal, errorCode, ...m };
  const diffs = compare(input.scenario.expect, actual);
  return {
    ...base, action: picked.label, outcome: diffs.length ? 'FAIL' : 'PASS', ...actual, forcedCoinsUsed: Math.max(0, forcedCoinsUsed),
    diffs, events: trimEvents(events), notes, message: null, names: namesOf(built.state, built.catalog),
  };
}

// ---------------------------------------------------------------- cenários-padrão (§25)

/** Cenários sugeridos para a carta: uso mínimo, Energia insuficiente, Fraqueza, Nocaute e retomada; moedas 0/1/2. */
export function defaultScenarios(rules: CardDefinition, existing: readonly TestScenario[] = []): TestScenario[] {
  const taken = new Set(existing.map((s) => s.id));
  const out: TestScenario[] = [];
  const add = (base: string, s: Omit<TestScenario, 'id'>) => {
    const id = uniqueId(base, taken, 64);
    taken.add(id);
    out.push({ id, ...s });
  };
  if (rules.category === 'TRAINER') {
    add('uso-minimo', { kind: 'TRAINER', fixture: 'default', forcedCoins: [], expect: { legal: true } });
    add('alvo-ausente', { kind: 'TRAINER', fixture: 'no-bench', forcedCoins: [], expect: {} });
    if (rules.trainerRules.fieldBehavior) add('nocaute-fossil', { kind: 'KNOCKOUT', fixture: 'default', forcedCoins: [], expect: { knockout: true, pointsGranted: 1 } });
    return out;
  }
  for (const attack of rules.attacks) {
    const coinBlock = attack.effects.find((b) => b.timing === 'PRE_DAMAGE' && b.operation.type === 'FLIP_COINS');
    const coinCount = coinBlock && coinBlock.operation.type === 'FLIP_COINS' && !coinBlock.operation.untilTails && typeof (coinBlock.operation.count ?? 1) === 'number' ? Math.min((coinBlock.operation.count ?? 1) as number, 4) : 0;
    if (coinCount > 0) {
      for (let headsCount = 0; headsCount <= coinCount; headsCount += 1) {
        const forced: CoinFace[] = Array.from({ length: coinCount }, (_, i) => (i < headsCount ? 'HEADS' : 'TAILS'));
        add(`${attack.id}-caras-${headsCount}`, { kind: 'ATTACK', attackId: attack.id, fixture: 'default', forcedCoins: forced, expect: { legal: true } });
      }
    } else {
      const fixed = attack.damageFormula ? {} : { baseDamage: attack.baseDamage ?? 0 };
      add(`${attack.id}-uso-minimo`, { kind: 'ATTACK', attackId: attack.id, fixture: 'default', forcedCoins: [], expect: { legal: true, ...fixed } });
    }
    const total = Object.values(attack.energyCost).reduce((s, n) => s + (n ?? 0), 0);
    if (total > 0) add(`${attack.id}-sem-energia`, { kind: 'ATTACK', attackId: attack.id, fixture: 'no-energy', forcedCoins: [], expect: { legal: false, errorCode: 'INSUFFICIENT_ENERGY' } });
  }
  const firstDamaging = rules.attacks.find((a) => a.damageFormula || (a.baseDamage ?? 0) > 0);
  if (firstDamaging && !firstDamaging.damageFormula && firstDamaging.damageTarget?.scope === 'OPPONENT_ACTIVE') {
    add('fraqueza', { kind: 'ATTACK', attackId: firstDamaging.id, fixture: 'weakness', forcedCoins: [], expect: { finalDamage: (firstDamaging.baseDamage ?? 0) + 20 } });
  }
  add('nocaute', { kind: 'KNOCKOUT', fixture: 'default', forcedCoins: [], expect: { knockout: true, pointsGranted: rules.knockoutPoints } });
  if (rules.attacks[0]) add('retomada', { kind: 'PERSISTENCE', attackId: rules.attacks[0].id, fixture: 'default', forcedCoins: ['HEADS', 'HEADS', 'HEADS'], expect: {} });
  for (const ability of rules.abilities) {
    if (ability.kind === 'ACTIVATED') add(`${ability.id}-uso`, { kind: 'ABILITY', abilityId: ability.id, fixture: 'damaged-self', forcedCoins: [], expect: { legal: true } });
    else add(`${ability.id}-sem-botao`, { kind: 'ABILITY', abilityId: ability.id, fixture: 'default', forcedCoins: [], expect: { legal: false } });
  }
  return out;
}

/** Aprovação vale só enquanto o rulesHash do rascunho não muda (ED-056). */
export function isRunCurrent(run: { readonly rulesHash: string }, currentRulesHash: string): boolean {
  return run.rulesHash === currentRulesHash;
}
