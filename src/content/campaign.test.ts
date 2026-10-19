// Critérios de campanha (campanha §22) verificados sobre o conteúdo REAL (buildBundle) com as funções puras do
// domínio: grafo e desbloqueios, decks iniciais, prêmios por tipo de nó, objetivos, Arena, produtos e cosméticos.
import { describe, expect, it } from 'vitest';
import { buildBundle } from './bundle.ts';
import type { CampaignNode, Objective } from './types.ts';
import { printing } from './builders.ts';
import { buildCatalog } from '../domain/cards/catalog.ts';
import { definitionKey, isPokemon } from '../domain/cards/types.ts';
import { validateDeck } from '../domain/deck/validate.ts';
import { createMatch, emptyStats } from '../domain/battle/setup.ts';
import { DEFAULT_RULESET, type MatchResult } from '../domain/battle/types.ts';
import { deckFacts } from '../domain/campaign/facts.ts';
import { evaluateObjectives, objectiveCompleted, type ObjectiveContext } from '../domain/campaign/objectives.ts';
import {
  EMPTY_PROGRESS, applicableObjectiveIds, arenaOpponents, computeStatuses, isCleared, validateGraph, type NodeProgress,
} from '../domain/campaign/progress.ts';
import { firstClearKey, planResultGrants, type ResultInput } from '../domain/campaign/rewards.ts';
import { economyAudit } from '../../tools/content-build/economy.ts';

const bundle = buildBundle();
const cat = buildCatalog(bundle.cards, bundle.printings);
const nodes = bundle.nodes;
const nodeById = new Map(nodes.map((n) => [n.nodeId, n]));
const node = (id: string): CampaignNode => nodeById.get(id)!;
const objectives = new Map(bundle.objectives.map((o) => [o.objectiveId, o]));
const rewardTables = new Map(bundle.rewardTables.map((t) => [t.rewardTableId, t]));
const starters = bundle.decks.filter((d) => d.kind === 'STARTER');
const starterPrintingIds = new Set(starters.flatMap((d) => d.entries.map((e) => e.printingId)));

/** Progresso com os nós dados concluídos (Descobertas pela escolha registrada, sem vitória). */
function progressOf(ids: readonly string[], extra: Record<string, Partial<NodeProgress>> = {}): Map<string, NodeProgress> {
  const map = new Map<string, NodeProgress>();
  for (const id of ids) {
    const n = node(id);
    map.set(id, n.kind === 'DISCOVERY'
      ? { ...EMPTY_PROGRESS, discoveryChoice: n.discoveryOffer![0]! }
      : { ...EMPTY_PROGRESS, firstClearAttemptId: `att-${id}`, wins: 1, clearedDifficulties: ['STORY'] });
  }
  for (const [id, p] of Object.entries(extra)) map.set(id, { ...(map.get(id) ?? EMPTY_PROGRESS), ...p });
  return map;
}

const statusesOf = (ids: readonly string[], extra: Record<string, Partial<NodeProgress>> = {}) => computeStatuses(nodes, progressOf(ids, extra), null);
const essentials = nodes.filter((n) => n.essential).map((n) => n.nodeId);
const prologue = nodes.filter((n) => n.chapterId === 'P00').map((n) => n.nodeId);
const chapter = (c: string, slots: readonly string[]) => slots.map((s) => `${c}-${s}`);

const win: MatchResult = { outcome: 'WIN', winner: 'A', reason: 'POINTS', points: { A: 3, B: 1 }, globalTurnNumber: 14 };
const draw: MatchResult = { outcome: 'DRAW', winner: null, reason: 'TURN_LIMIT', points: { A: 2, B: 2 }, globalTurnNumber: 60 };

function grants(n: CampaignNode, over: Partial<ResultInput> = {}) {
  return planResultGrants({
    campaignId: bundle.campaignId, node: n, mode: 'CAMPAIGN', won: true, completedObjectiveIds: [], objectives, rewardTables,
    granted: new Set<string>(), progressionEligible: true, ...over,
  });
}

describe('grafo da campanha real (C-001, C-002, C-003)', () => {
  it('C-003: todos os 45 nós são alcançáveis e não há ciclo nem pré-requisito inexistente', () => {
    expect(validateGraph(nodes)).toEqual([]);
    const done: string[] = [];
    for (let round = 0; round < nodes.length; round += 1) {
      const statuses = statusesOf(done);
      const next = nodes.filter((n) => statuses.get(n.nodeId) === 'AVAILABLE').map((n) => n.nodeId);
      if (!next.length) break;
      done.push(...next);
    }
    expect(new Set(done).size).toBe(45);
  });

  it('C-002: as 27 vitórias essenciais abrem o final sem exigir nenhum nó opcional', () => {
    expect(essentials).toHaveLength(27);
    const optional = nodes.filter((n) => !n.essential);
    expect(optional.map((n) => n.kind).sort()).toEqual([...Array(6).fill('DISCOVERY'), ...Array(6).fill('ELITE'), ...Array(6).fill('PUZZLE')].sort());
    for (const n of nodes.filter((x) => x.essential)) for (const p of n.prerequisites.allOf) expect(node(p).essential, `${n.nodeId} ← ${p}`).toBe(true);
    const statuses = statusesOf(essentials.filter((id) => id !== 'F00-D03'));
    expect(statuses.get('F00-D03')).toBe('AVAILABLE');
    for (const n of optional) expect(statuses.get(n.nodeId), n.nodeId).toBe('AVAILABLE');
  });
});

describe('desbloqueios por nó (C-009, C-010, C-011, C-012, C-037)', () => {
  it('C-009: concluir P00-T06 libera C01-E01 (e só ele no capítulo)', () => {
    expect(statusesOf(prologue.slice(0, 5)).get('C01-E01')).toBe('LOCKED');
    const statuses = statusesOf(prologue);
    expect(statuses.get('C01-E01')).toBe('AVAILABLE');
    expect(nodes.filter((n) => n.chapterId === 'C01' && statuses.get(n.nodeId) === 'AVAILABLE').map((n) => n.nodeId)).toEqual(['C01-E01']);
  });

  it('C-010: o puzzle E02 não bloqueia E03 nem E06', () => {
    const order = ['C01', 'C02', 'C03', 'C04', 'C05', 'C06'];
    for (const [i, c] of order.entries()) {
      const before = [...prologue, ...order.slice(0, i).flatMap((p) => chapter(p, ['E01', 'E03', 'E06']))];
      expect(statusesOf([...before, ...chapter(c, ['E01'])]).get(`${c}-E03`), c).toBe('AVAILABLE');
      const withoutE02 = statusesOf([...before, ...chapter(c, ['E01', 'E03'])]);
      expect(withoutE02.get(`${c}-E02`), c).toBe('AVAILABLE');
      expect(withoutE02.get(`${c}-E06`), c).toBe('AVAILABLE');
    }
  });

  it('C-011: a Descoberta E04 conclui pela escolha, sem vitória, e não bloqueia o chefe', () => {
    for (const c of ['C01', 'C02', 'C03', 'C04', 'C05', 'C06']) {
      const e04 = node(`${c}-E04`);
      expect(e04.kind).toBe('DISCOVERY');
      expect(e04.difficultyProfiles).toBeNull();
      expect(e04.fixtureId).toBeNull();
      expect(e04.discoveryOffer).toHaveLength(3);
      expect(isCleared({ ...EMPTY_PROGRESS, discoveryChoice: e04.discoveryOffer![1]! })).toBe(true);
      expect(node(`${c}-E06`).prerequisites.allOf).not.toContain(`${c}-E04`);
    }
    expect(statusesOf([...prologue, 'C01-E01', 'C01-E03']).get('C01-E06')).toBe('AVAILABLE');
  });

  it('C-012: ignorar a Elite E05 não bloqueia o capítulo seguinte', () => {
    const statuses = statusesOf([...prologue, ...chapter('C01', ['E01', 'E03', 'E06'])]);
    expect(statuses.get('C01-E05')).toBe('AVAILABLE');
    expect(statuses.get('C02-E01')).toBe('AVAILABLE');
    for (const n of nodes) for (const p of n.prerequisites.allOf) expect(node(p).kind === 'ELITE' || node(p).kind === 'DISCOVERY' || node(p).kind === 'PUZZLE', `${n.nodeId} exige ${p}`).toBe(false);
  });

  it('C-037: perder F00-D03 não invalida D01/D02 já concluídos', () => {
    const route = essentials.filter((id) => id !== 'F00-D03');
    const statuses = statusesOf(route, { 'F00-D03': { losses: 2, consecutiveLosses: 2 } });
    expect(statuses.get('F00-D01')).not.toBe('LOCKED');
    expect(isCleared(progressOf(route).get('F00-D01'))).toBe(true);
    expect(['CLEARED', 'MASTERED']).toContain(statuses.get('F00-D01'));
    expect(['CLEARED', 'MASTERED']).toContain(statuses.get('F00-D02'));
    expect(statuses.get('F00-D03')).toBe('AVAILABLE');
  });
});

describe('perfil novo e decks iniciais (C-005, C-006, C-049)', () => {
  it('C-005: as 76 cartas iniciais permitem montar os oito decks de 20 ao mesmo tempo', () => {
    const inventory = Object.fromEntries(bundle.onboarding.inventory.map((i) => [i.printingId, i.count]));
    expect(bundle.onboarding.inventory.reduce((s, i) => s + i.count, 0)).toBe(76);
    for (const deck of starters) {
      expect(deck.entries.reduce((s, e) => s + e.count, 0)).toBe(20);
      expect(validateDeck(deck.entries, cat, { energyTypes: deck.energyTypes, inventory }).errors).toEqual([]);
    }
    expect(bundle.onboarding.starterDeckIds).toEqual(starters.map((d) => d.deckId));
  });

  it('C-006: cada deck inicial tem quatro Básicos e no máximo duas cópias por nome', () => {
    for (const deck of starters) {
      const defs = deck.entries.flatMap((e) => Array.from({ length: e.count }, () => cat.definition(cat.definitionKeyOfPrinting(e.printingId))));
      expect(defs.filter((d) => isPokemon(d) && d.stage === 'BASIC'), deck.deckId).toHaveLength(4);
      const perName = new Map<string, number>();
      for (const d of defs) perName.set(d.deckLimitKey, (perName.get(d.deckLimitKey) ?? 0) + 1);
      expect(Math.max(...perName.values()), deck.deckId).toBeLessThanOrEqual(2);
    }
  });

  it('C-049: o perfil novo recebe Neutro/Academia e acessórios básicos gratuitos, sem consumir Créditos', () => {
    const ids = bundle.onboarding.cosmeticIds;
    expect([...ids].sort()).toEqual(['coin-neutral', 'flair-basic', 'mat-academy', 'mat-neutral', 'sleeve-neutral']);
    for (const id of ids) {
      const c = bundle.cosmetics.find((x) => x.cosmeticId === id)!;
      expect(c.acquisition).toMatchObject({ kind: 'FREE', credits: 0 });
    }
    expect(new Set(bundle.cosmetics.filter((c) => ids.includes(c.cosmeticId)).map((c) => c.kind))).toEqual(new Set(['PLAYMAT', 'SLEEVE', 'COIN', 'FLAIR']));
    expect(bundle.products.some((p) => p.kind === 'COSMETIC' && p.cosmeticId && ids.includes(p.cosmeticId))).toBe(false);
  });
});

describe('prêmios por tipo de nó e repetição (C-013, C-019, C-022, C-023, C-024, C-025, C-051, G-068)', () => {
  it('C-013: a primeira vitória de cada chefe concede exatamente uma medalha; repetir não concede outra', () => {
    const bosses = nodes.filter((n) => n.kind === 'BOSS');
    expect(bosses).toHaveLength(6);
    for (const boss of bosses) {
      const first = grants(boss);
      expect(first.medal, boss.nodeId).toBe(`medal-${boss.chapterId.toLowerCase()}`);
      expect(first.firstClear).toBe(true);
      const again = grants(boss, { granted: new Set(first.grantKeys) });
      expect(again.medal).toBeNull();
      expect(again.firstClear).toBe(false);
    }
  });

  it('C-019: empate não conclui objetivo que exige vitória nem concede primeira vitória', () => {
    for (const n of nodes.filter((x) => x.kind !== 'DISCOVERY')) {
      const list = applicableObjectiveIds(n).map((id) => objectives.get(id)!);
      expect(list.every((o) => o.requiresVictory), n.nodeId).toBe(true);
      const ctx: ObjectiveContext = { human: 'A', result: draw, stats: { ...emptyStats(), benchPlacements: 9, evolutions: 9, retreats: 9 }, ownTurns: 1, deck: deckFacts([], [], cat, starterPrintingIds), turnLimit: n.turnLimit?.ownTurns ?? null };
      expect(evaluateObjectives(list, ctx), n.nodeId).toEqual([]);
      const plan = grants(n, { won: false });
      expect(plan.firstClear).toBe(false);
      expect(plan.credits).toBe(0);
    }
  });

  it('C-022: limite de turnos conta os turnos próprios do jogador, não o turno global', () => {
    const tactic = objectives.get('C03-E05-TACTIC')!;
    const ctx = (ownTurns: number, globalTurnNumber: number): ObjectiveContext => ({
      human: 'A', result: { ...win, globalTurnNumber }, stats: emptyStats(), ownTurns, deck: deckFacts([], [], cat, starterPrintingIds), turnLimit: null,
    });
    expect(objectiveCompleted(tactic, ctx(12, 24))).toBe(true);
    expect(objectiveCompleted(tactic, ctx(13, 25))).toBe(false);
    const puzzle = objectives.get('C02-E02-PUZZLE')!;
    const prepared: ObjectiveContext = { ...ctx(1, 2), stats: { ...emptyStats(), switchEffects: 1 }, turnLimit: node('C02-E02').turnLimit!.ownTurns };
    expect(objectiveCompleted(puzzle, prepared)).toBe(true);
    expect(objectiveCompleted(puzzle, { ...prepared, ownTurns: 2 })).toBe(false);
  });

  it('C-023/G-068: objetivos cumpridos em vitórias diferentes se unem, sem prêmio duplicado', () => {
    const n = node('C01-E01');
    const first = grants(n, { completedObjectiveIds: ['C01-E01-WIN', 'C01-E01-TACTIC'] });
    expect(first.newObjectiveIds).toEqual(['C01-E01-WIN', 'C01-E01-TACTIC']);
    const granted = new Set(first.grantKeys);
    const second = grants(n, { completedObjectiveIds: ['C01-E01-WIN', 'C01-E01-DECK'], granted });
    expect(second.newObjectiveIds).toEqual(['C01-E01-DECK']);
    expect(second.firstClear).toBe(false);
    const repeat = rewardTables.get(n.repeatRewardTableId!)!.credits;
    expect(second.credits).toBe(repeat + objectives.get('C01-E01-DECK')!.reward.credits);
    const union = new Set([...first.newObjectiveIds, ...second.newObjectiveIds]);
    expect(applicableObjectiveIds(n).every((id) => union.has(id))).toBe(true);
    const progress = progressOf([...prologue, 'C01-E01'], { 'C01-E01': { completedObjectiveIds: [...union] } });
    expect(computeStatuses(nodes, progress, null).get('C01-E01')).toBe('MASTERED');
  });

  it('C-024: o prêmio inicial não acumula com o repetível da mesma vitória', () => {
    for (const n of nodes.filter((x) => x.repeatRewardTableId)) {
      const first = grants(n);
      const table = rewardTables.get(n.firstClearRewardTableId)!;
      expect(first.credits, n.nodeId).toBe(table.credits);
      expect(first.breakdown.map((b) => b.source)).toEqual(['FIRST_CLEAR']);
      const again = grants(n, { granted: new Set([firstClearKey(bundle.campaignId, n.nodeId)]) });
      expect(again.breakdown.map((b) => b.source)).toEqual(['REPEAT']);
      expect(again.packs).toEqual([]);
    }
  });

  it('C-025: objetivo já concluído não concede Créditos de novo', () => {
    const n = node('C02-E03');
    const ids = applicableObjectiveIds(n);
    const first = grants(n, { completedObjectiveIds: ids });
    const objectiveCredits = ids.reduce((s, id) => s + objectives.get(id)!.reward.credits, 0);
    expect(first.credits).toBe(rewardTables.get(n.firstClearRewardTableId)!.credits + objectiveCredits);
    const again = grants(n, { completedObjectiveIds: ids, granted: new Set(first.grantKeys) });
    expect(again.newObjectiveIds).toEqual([]);
    expect(again.grantKeys).toEqual([]);
    expect(again.credits).toBe(rewardTables.get(n.repeatRewardTableId!)!.credits);
  });

  it('C-051: F00-D03 concede Circuito Completo uma vez, além do prêmio normal; nenhum outro nó concede', () => {
    const final = grants(node('F00-D03'));
    expect(final.cosmetics).toEqual(['mat-circuit-complete']);
    expect(final.credits).toBe(rewardTables.get('final-complete-v1')!.credits);
    expect(final.packs).toEqual([{ productId: 'pack-a1-pikachu', count: 1 }, { productId: 'pack-a1-mewtwo', count: 1 }]);
    expect(grants(node('F00-D03'), { granted: new Set(final.grantKeys) }).cosmetics).toEqual([]);
    for (const n of nodes.filter((x) => x.nodeId !== 'F00-D03')) expect(grants(n).cosmetics, n.nodeId).not.toContain('mat-circuit-complete');
  });
});

describe('dificuldade, Arena e regras (C-016, C-035, G-077)', () => {
  it('C-016/G-077: Especialista muda só o deck/IA do NPC — decks legais, mesma regra, HP e moedas do catálogo', () => {
    const battles = nodes.filter((n) => n.difficultyProfiles && !n.fixtureId);
    expect(battles.length).toBeGreaterThan(20);
    const story = bundle.aiProfiles.find((p) => p.policy === 'STORY')!;
    for (const n of battles) {
      const expert = n.difficultyProfiles!.EXPERT;
      const deck = bundle.decks.find((d) => d.deckId === expert.npcDeckId)!;
      expect(validateDeck(deck.entries, cat, { energyTypes: deck.energyTypes }).errors, n.nodeId).toEqual([]);
      const ai = bundle.aiProfiles.find((p) => p.aiProfileId === expert.aiProfileId)!;
      expect(ai.policy).toBe('EXPERT');
      expect(Object.keys(ai).sort()).toEqual(Object.keys(story).sort());
    }
    const n = battles[0]!;
    const support = bundle.decks.find((d) => d.deckId === n.supportDeckIds[0])!;
    const entries = (deck: typeof support) => deck.entries.flatMap((e) => Array.from({ length: e.count }, () => ({ printingId: e.printingId, definitionKey: cat.definitionKeyOfPrinting(e.printingId) })));
    for (const difficulty of ['STORY', 'STANDARD', 'EXPERT'] as const) {
      const npc = bundle.decks.find((d) => d.deckId === n.difficultyProfiles![difficulty].npcDeckId)!;
      const { state } = createMatch({ matchId: `m-${difficulty}`, seed: 11, players: { A: { deck: entries(support), energyTypes: support.energyTypes }, B: { deck: entries(npc), energyTypes: npc.energyTypes } } }, cat);
      expect(state.config).toEqual(DEFAULT_RULESET);
      expect(state.scriptedCoins).toEqual([]);
      for (const c of Object.values(state.cards)) expect(c.definitionKey).toBe(cat.definitionKeyOfPrinting(c.printingId));
    }
  });

  it('C-035: Arena só sorteia NPCs elegíveis (duelos já vencidos após C01-E06) e não concede primeiras vitórias', () => {
    expect(arenaOpponents(nodes, progressOf([...prologue, 'C01-E01', 'C01-E03']))).toEqual([]);
    const progress = progressOf([...prologue, 'C01-E01', 'C01-E02', 'C01-E03', 'C01-E04', 'C01-E06']);
    const arena = arenaOpponents(nodes, progress).map((n) => n.nodeId);
    expect(arena.sort()).toEqual(['C01-E01', 'C01-E03', 'C01-E06']);
    const plan = grants(node('C01-E05'), { mode: 'ARENA', completedObjectiveIds: applicableObjectiveIds(node('C01-E05')) });
    expect(plan.firstClear).toBe(false);
    expect(plan.medal).toBeNull();
    expect(plan.newObjectiveIds).toEqual([]);
    expect(plan.grantKeys).toEqual([]);
  });
});

describe('Empório, produtos e cosméticos (C-028, C-050, C-053, C-056)', () => {
  it('C-028: nenhum produto usa dinheiro real ou prazo real — só Créditos e progresso de campanha', () => {
    for (const p of bundle.products) {
      if (p.price) expect(Object.keys(p.price), p.productId).toEqual(['credits']);
      expect(Object.keys(p.availability).sort()).toEqual(['afterNodeId', 'fromStart']);
      if (p.availability.afterNodeId) expect(nodeById.has(p.availability.afterNodeId), p.productId).toBe(true);
      expect(JSON.stringify(p)).not.toMatch(/\d{4}-\d{2}-\d{2}|expires|deadline|endsAt|currency|USD|BRL|R\$/i);
    }
  });

  it('C-050: cada chefe C01–C06 libera apenas o seu produto de playmat, por 500 Créditos', () => {
    const mats = bundle.products.filter((p) => p.kind === 'COSMETIC' && p.cosmeticId?.startsWith('mat-'));
    expect(mats).toHaveLength(6);
    for (const c of ['01', '02', '03', '04', '05', '06']) {
      const unlocked = mats.filter((p) => p.availability.afterNodeId === `C${c}-E06`);
      expect(unlocked.map((p) => p.cosmeticId), c).toHaveLength(1);
      expect(unlocked[0]!.price).toEqual({ credits: 500 });
      expect(unlocked[0]!.availability.fromStart).toBe(false);
    }
    // Chefes não entregam os seis tapetes pagos gratuitamente.
    for (const boss of nodes.filter((n) => n.kind === 'BOSS')) expect(grants(boss).cosmetics.some((id) => id.startsWith('mat-'))).toBe(false);
  });

  it('C-053: versos e moedas mantêm 200/300 Créditos; compra é permanente (não repetível) e não envolve cartas', () => {
    const accessories = bundle.products.filter((p) => p.kind === 'COSMETIC' && /^(sleeve|coin)-/.test(p.cosmeticId ?? ''));
    expect(accessories).toHaveLength(12);
    for (const p of accessories) {
      expect(p.price).toEqual({ credits: p.cosmeticId!.startsWith('sleeve-') ? 200 : 300 });
      expect(p.repeatable).toBe(false);
      expect(p.directedPrintingId).toBeUndefined();
      expect(p.pools).toBeUndefined();
    }
  });

  it('VS-046: os nove temas de playmat mantêm IDs, versão 2 e desbloqueios canônicos', () => {
    const mats = bundle.cosmetics.filter((c) => c.kind === 'PLAYMAT');
    expect(mats.map((m) => m.cosmeticId)).toEqual([
      'mat-neutral', 'mat-academy', 'mat-c01-grove', 'mat-c02-harbor', 'mat-c03-circuits', 'mat-c04-observatory', 'mat-c05-foundry', 'mat-c06-archive', 'mat-circuit-complete',
    ]);
    expect(mats.every((m) => m.definitionVersion === 2)).toBe(true);
    expect(mats.slice(0, 2).map((m) => m.acquisition.kind)).toEqual(['FREE', 'FREE']);
    mats.slice(2, 8).forEach((m, i) => expect(m.acquisition).toEqual({ kind: 'EMPORIUM', requiredCompletedNodeId: `C0${i + 1}-E06`, credits: 500 }));
    expect(mats[8]!.acquisition).toMatchObject({ kind: 'GRANT', requiredCompletedNodeId: 'F00-D03', credits: 0 });
    // Cada capítulo usa o tema do seu ID; o final usa o tema de conclusão.
    for (const chapter of bundle.chapters) expect(mats.some((m) => m.cosmeticId === chapter.playmatId), chapter.chapterId).toBe(true);
  });

  it('C-056: cosméticos não alteram os 4.010 Créditos da rota principal nem criam gate obrigatório', () => {
    expect(economyAudit(bundle).mandatory).toBe(4010);
    const cosmeticIds = new Set(bundle.cosmetics.map((c) => c.cosmeticId));
    for (const n of nodes) for (const p of n.prerequisites.allOf) expect(cosmeticIds.has(p)).toBe(false);
    const route = nodes.filter((n) => n.essential);
    const routeCredits = bundle.onboarding.credits + route.reduce((s, n) => s + rewardTables.get(n.firstClearRewardTableId)!.credits, 0);
    expect(routeCredits).toBe(4010);
  });
});

describe('objetivos de composição pela impressão exata (G-049, UI-017)', () => {
  it('G-049: carta da expansão errada não conta para objetivo de conjunto, mesmo com a mesma definição', () => {
    const c01Objective = objectives.get('C01-E01-DECK')!;
    const c01Card = bundle.printings.find((p) => p.setId === 'a1' && p.finish === 'NORMAL' && p.rarity !== 'PROMO')!;
    const def = cat.definition(definitionKey(c01Card.cardDefinitionId, c01Card.cardDefinitionVersion));
    // Mesma definição, impressão de outro conjunto (reimpressão hipotética no Promo-A).
    const reprint = printing({ card: def, setId: 'pa', number: 900, rarity: 'COMMON' });
    const cat2 = buildCatalog(bundle.cards, [...bundle.printings, reprint]);
    const deckWith = (ids: string[]) => deckFacts(ids, ['GRASS'], cat2, starterPrintingIds);
    const ctx = (ids: string[]): ObjectiveContext => ({ human: 'A', result: win, stats: emptyStats(), ownTurns: 5, deck: deckWith(ids), turnLimit: null });
    expect(deckWith([c01Card.printingId, c01Card.printingId, c01Card.printingId]).setCounts.a1).toBe(3);
    expect(deckWith([reprint.printingId, reprint.printingId, reprint.printingId]).setCounts.a1 ?? 0).toBe(0);
    const pred = c01Objective.predicates[0]!;
    const setOnly: Objective = { ...c01Objective, predicates: [{ ...pred, composition: { minSetCards: { setIds: ['a1'], count: 3 } } }] };
    expect(objectiveCompleted(setOnly, ctx([c01Card.printingId, c01Card.printingId, c01Card.printingId]))).toBe(true);
    expect(objectiveCompleted(setOnly, ctx([reprint.printingId, reprint.printingId, reprint.printingId]))).toBe(false);
  });
});
