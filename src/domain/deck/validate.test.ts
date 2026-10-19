import { describe, expect, it } from 'vitest';
import { attack, onPlay, pokemon, printing, trainer } from '../../content/builders.ts';
import { buildCatalog } from '../cards/catalog.ts';
import type { CardDefinition, Operation } from '../cards/types.ts';
import { S } from '../../tests/support/starter-catalog.ts';
import { cardOpcodes, cardsWithAnyOpcode, deckMetrics, evaluateComposition, validateDeck, type DeckEntry } from './validate.ts';

// Catálogo de teste: iniciais + cartas sintéticas para cobrir Fóssil, ex, Ferramenta/Estádio, opcode inexistente e versões.
const fossil = trainer({ baseName: 'Fóssil Teste', subtype: 'ITEM', effects: [],
  rules: { destinationAfterPlay: 'BENCH_AS_POKEMON', fieldBehavior: { kind: 'PLAY_AS_POKEMON', hp: 40, types: [], retreatAllowed: false, knockoutPoints: 1, canAttack: false } } });
const exMon = pokemon({ baseName: 'Testex', ruleBox: 'EX', stage: 'BASIC', type: 'FIRE', hp: 120, retreat: 1, weakness: 'WATER', attacks: [attack({ id: 'x', name: 'X', cost: { FIRE: 1 }, damage: 30 })] });
const megaMon = pokemon({ baseName: 'Testemega', ruleBox: 'MEGA_EX', stage: 'STAGE_1', from: ['faisca'], type: 'FIRE', hp: 200, retreat: 2, weakness: 'WATER', attacks: [attack({ id: 'y', name: 'Y', cost: { FIRE: 2 }, damage: 90 })] });
const stage2 = pokemon({ baseName: 'Brasa Final', stage: 'STAGE_2', from: ['braseiro'], type: 'FIRE', hp: 150, retreat: 2, weakness: 'WATER', attacks: [attack({ id: 'z', name: 'Z', cost: { FIRE: 3 }, damage: 120 })] });
const stadium = trainer({ baseName: 'Pátio Teste', subtype: 'STADIUM', effects: [] });
const psychic = pokemon({ baseName: 'Mentalzinho', stage: 'BASIC', type: 'PSYCHIC', hp: 60, retreat: 1, weakness: null, attacks: [attack({ id: 'p', name: 'P', cost: { PSYCHIC: 1 }, damage: 20 })] });
const energyCard = pokemon({ baseName: 'Carregador', stage: 'BASIC', type: 'LIGHTNING', hp: 60, retreat: 1, weakness: null,
  attacks: [attack({ id: 'c', name: 'C', cost: { COLORLESS: 1 }, effects: [{ id: '', timing: 'POST_DAMAGE', operation: { type: 'ATTACH_ENERGY', target: { scope: 'SELF' }, energyType: 'LIGHTNING', count: 1, source: 'GENERATED' } }] })] });
const bogus = trainer({ baseName: 'Carta Inválida', subtype: 'ITEM', effects: [onPlay({ type: 'TELEPORT' } as unknown as Operation)] });
const v2: CardDefinition = { ...S.kitReparo, version: 2 };

const extra: CardDefinition[] = [fossil, exMon, megaMon, stage2, stadium, psychic, energyCard, bogus, v2];
const all = [...S.STARTER_POKEMON, ...S.STARTER_TRAINERS, ...extra];
const printings = all.map((card, i) => printing({ card, setId: i < 18 ? 'base' : 'test', number: i + 1, rarity: 'COMMON' }));
const cat = buildCatalog(all, printings);
const pid = (card: CardDefinition) => printings.find((p) => p.cardDefinitionId === card.id && p.cardDefinitionVersion === card.version)!.printingId;
const e = (card: CardDefinition, count = 2): DeckEntry => ({ printingId: pid(card), count });

const fireStarter: DeckEntry[] = [S.faisca, S.braseiro, S.carvito, S.brasacu, S.kitReparo, S.rastreador, S.trocaTatica, S.estudioso, S.mentoria, S.talisma].map((c) => e(c));
const codes = (r: ReturnType<typeof validateDeck>) => r.errors.map((x) => x.code);

describe('validateDeck (gameplay §6)', () => {
  it('aceita o deck inicial Chama Constante', () => {
    const r = validateDeck(fireStarter, cat, { energyTypes: ['FIRE'] });
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('exige exatamente 20 cartas', () => {
    expect(codes(validateDeck(fireStarter.slice(1), cat, { energyTypes: ['FIRE'] }))).toContain('DECK_SIZE_INVALID');
  });

  it('G-001: deck de 19 ou de 21 cartas bloqueia a entrada normal', () => {
    const nineteen = [...fireStarter.slice(0, 9), e(S.talisma, 1)];
    const twentyOne = [...fireStarter, e(psychic, 1)];
    expect(nineteen.reduce((s, x) => s + x.count, 0)).toBe(19);
    expect(twentyOne.reduce((s, x) => s + x.count, 0)).toBe(21);
    for (const deck of [nineteen, twentyOne]) {
      const r = validateDeck(deck, cat, { energyTypes: ['FIRE', 'PSYCHIC'] });
      expect(r.ok).toBe(false);
      expect(codes(r)).toContain('DECK_SIZE_INVALID');
    }
  });

  it('limita 2 cópias por deckLimitKey, inclusive entre impressões diferentes', () => {
    const alt = printing({ card: S.faisca, setId: 'base', number: 1, rarity: 'RARE', finish: 'HOLOGRAPHIC' });
    const cat2 = buildCatalog(all, [...printings, alt]);
    const deck = [...fireStarter.slice(0, 9), { printingId: alt.printingId, count: 1 }, e(S.talisma, 1)];
    const r = validateDeck(deck, cat2, { energyTypes: ['FIRE'] });
    expect(r.errors.find((x) => x.code === 'DECK_COPY_LIMIT_EXCEEDED')?.deckLimitKey).toBe('faisca');
  });

  it('exige um Básico elegível; Fósseis não contam', () => {
    const deck = [e(fossil), e(S.braseiro), e(S.brasacu), e(stage2), e(S.kitReparo), e(S.rastreador), e(S.trocaTatica), e(S.estudioso), e(S.mentoria), e(S.talisma)];
    expect(codes(validateDeck(deck, cat, { energyTypes: ['FIRE'] }))).toContain('DECK_REQUIRES_BASIC');
  });

  it('valida 1–3 tipos distintos de Energia geráveis', () => {
    expect(codes(validateDeck(fireStarter, cat, { energyTypes: [] }))).toContain('DECK_ENERGY_TYPES_INVALID');
    expect(codes(validateDeck(fireStarter, cat, { energyTypes: ['FIRE', 'WATER', 'GRASS', 'METAL'] }))).toContain('DECK_ENERGY_TYPES_INVALID');
    expect(codes(validateDeck(fireStarter, cat, { energyTypes: ['FIRE', 'FIRE'] }))).toContain('DECK_ENERGY_TYPES_INVALID');
    expect(codes(validateDeck(fireStarter, cat, { energyTypes: ['COLORLESS'] }))).toContain('DECK_ENERGY_TYPES_INVALID');
    expect(validateDeck(fireStarter, cat, { energyTypes: ['FIRE', 'WATER', 'GRASS'] }).ok).toBe(true);
  });

  it('recusa opcode fora do registro (CARD_EFFECT_UNSUPPORTED)', () => {
    const deck = [...fireStarter.slice(0, 9), e(bogus)];
    expect(codes(validateDeck(deck, cat, { energyTypes: ['FIRE'] }))).toContain('CARD_EFFECT_UNSUPPORTED');
  });

  it('não aceita duas versões funcionais da mesma definição', () => {
    const deck = [...fireStarter.filter((x) => x.printingId !== pid(S.kitReparo)), e(S.kitReparo, 1), e(v2, 1)];
    expect(codes(validateDeck(deck, cat, { energyTypes: ['FIRE'] }))).toContain('DECK_DEFINITION_VERSION_CONFLICT');
  });

  it('verifica posse quando há inventário (CARD_NOT_OWNED)', () => {
    const inventory = new Map(fireStarter.map((x) => [x.printingId, 2]));
    expect(validateDeck(fireStarter, cat, { energyTypes: ['FIRE'], inventory }).ok).toBe(true);
    inventory.set(pid(S.faisca), 1);
    const r = validateDeck(fireStarter, cat, { energyTypes: ['FIRE'], inventory });
    expect(r.errors.find((x) => x.code === 'CARD_NOT_OWNED')?.printingId).toBe(pid(S.faisca));
    expect(validateDeck(fireStarter, cat, { energyTypes: ['FIRE'], inventory: Object.fromEntries(fireStarter.map((x) => [x.printingId, 2])) }).ok).toBe(true);
  });

  it('reporta impressão desconhecida e quantidade inválida', () => {
    const r = validateDeck([...fireStarter.slice(0, 9), { printingId: 'nao-existe', count: 2 }], cat, { energyTypes: ['FIRE'] });
    expect(codes(r)).toContain('CONTENT_REFERENCE_MISSING');
    expect(codes(validateDeck([...fireStarter.slice(0, 9), e(S.talisma, 0 as 1)], cat, { energyTypes: ['FIRE'] }))).toContain('DECK_ENTRY_INVALID');
  });

  it('avisos de estratégia não bloqueiam (§6.2)', () => {
    const deck = [e(S.faisca, 1), e(stage2, 2), e(psychic, 1), e(exMon, 2), e(megaMon, 2), e(S.kitReparo), e(S.rastreador), e(S.trocaTatica), e(S.estudioso), e(S.mentoria), e(S.talisma)];
    const r = validateDeck(deck, cat, { energyTypes: ['FIRE'] });
    expect(r.ok).toBe(true);
    const w = r.warnings.map((x) => x.code);
    expect(w).toContain('EVOLUTION_WITHOUT_PREVIOUS_STAGE');
    expect(w).toContain('ATTACK_ENERGY_NOT_PRODUCED');
    expect(w).toContain('MULTI_PIECE_PLAN');
    expect(w).toContain('MANY_MULTI_POINT_TARGETS');
  });
});

describe('deckMetrics e composição (campanha §12.1)', () => {
  it('mede o deck inicial: 4 Básicos, 2 linhas, 2 Ferramentas, nenhum ex', () => {
    const m = deckMetrics({ entries: fireStarter, energyTypes: ['FIRE'] }, cat, { starterPrintingIds: fireStarter.map((x) => x.printingId) });
    expect(m.totalCards).toBe(20);
    expect(m.basicCopies).toBe(4);
    expect(m.distinctBasics).toBe(2);
    expect(m.distinctEvolutionLines).toBe(2);
    expect(m.evolutionLineRoots).toEqual(['carvito', 'faisca']);
    expect(m.subtypeCopies.TOOL).toBe(2);
    expect(m.ruleBoxCopies.EX).toBe(0);
    expect(m.setCounts.base).toBe(20);
    expect(m.starterPrintingCount).toBe(20);
    expect(m.energyTypeCount).toBe(1);
    expect(m.opcodeCardCopies.HEAL_DAMAGE).toBe(2);
    expect(m.opcodeCardCopies['MODIFY:MAX_HP']).toBe(2);
  });

  it('aceita só as entradas (Energia por opção)', () => {
    const m = deckMetrics(fireStarter, cat, { energyTypes: ['FIRE', 'WATER'] });
    expect(m.totalCards).toBe(20);
    expect(m.energyTypeCount).toBe(2);
  });

  it('conta linhas evolutivas só quando a cadeia está completa no deck', () => {
    const m = deckMetrics({ entries: [e(S.faisca), e(S.braseiro), e(stage2), e(S.gota), e(S.marulho, 1), e(S.broto), e(S.semente, 1)], energyTypes: ['FIRE'] }, cat);
    expect(m.distinctEvolutionLines).toBe(2); // faisca (Braseiro + Brasa Final) e gota (Marulho)
    expect(m.stageCopies.STAGE_2).toBe(2);
  });

  it('avalia cada critério de composição', () => {
    const deck = { entries: [e(exMon), e(megaMon, 1), e(S.faisca), e(stadium, 1), e(S.talisma), e(energyCard), e(S.kitReparo)], energyTypes: ['FIRE', 'LIGHTNING'] };
    const m = deckMetrics(deck, cat);
    expect(evaluateComposition(m, { minRuleBoxCopies: { EX: 2 } }).ok).toBe(true);
    expect(evaluateComposition(m, { maxRuleBoxCopies: { MEGA_EX: 0 } }).ok).toBe(false);
    expect(evaluateComposition(m, { exactEnergyTypeCount: 2 }).ok).toBe(true);
    expect(evaluateComposition(m, { minSubtypeCopies: { TOOL: 3, STADIUM: 1 } }).ok).toBe(false);
    expect(evaluateComposition(m, { minSubtypeCopies: { TOOL: 2, STADIUM: 1 } }).ok).toBe(true);
    expect(cardsWithAnyOpcode(m, ['ATTACH_ENERGY', 'MODIFY:ENERGY_PROVISION'])).toBe(2);
    expect(evaluateComposition(m, { minCardsWithOpcode: { opcodes: ['ATTACH_ENERGY'], count: 2 } }).ok).toBe(true);
    expect(evaluateComposition(m, { minSetCards: { setIds: ['test'], count: 6 } }).ok).toBe(true);
    expect(evaluateComposition(m, { minSetCards: { setIds: ['base'], count: 7 } }).ok).toBe(false);
    expect(evaluateComposition(m, { minBasic: 3 }).ok).toBe(true);
    expect(evaluateComposition(m, { minBasic: 4 }).ok).toBe(false);
    expect(evaluateComposition(m, { maxStarterPrintings: 0 }).ok).toBe(true);
    expect(evaluateComposition(m, { minDistinctEvolutionLines: 1 }).ok).toBe(true);
  });

  it('cardOpcodes percorre ramos condicionais e efeitos agendados', () => {
    const card = pokemon({ baseName: 'Ramificado', stage: 'BASIC', type: 'PSYCHIC', hp: 60, retreat: 1, weakness: null,
      attacks: [attack({ id: 'r', name: 'R', cost: {}, effects: [
        { id: '', timing: 'POST_DAMAGE', operation: { type: 'CONDITIONAL', condition: { op: 'IS_TURN_OF', side: 'OWN' }, then: [{ type: 'APPLY_CONDITION', target: { scope: 'OPPONENT_ACTIVE' }, condition: 'ASLEEP' }], else: [{ type: 'DRAW_CARDS', player: 'OWN', count: 1 }] } },
        { id: '', timing: 'POST_DAMAGE', operation: { type: 'SCHEDULE_DELAYED', target: { scope: 'OPPONENT_ACTIVE' }, at: 'END_OF_OPPONENT_NEXT_TURN', operations: [{ type: 'REMOVE_CONDITION', target: { scope: 'EVENT_TARGET' }, conditions: 'ALL' }] } },
      ] })] });
    expect(cardOpcodes(card)).toEqual(['APPLY_CONDITION', 'CONDITIONAL', 'DRAW_CARDS', 'REMOVE_CONDITION', 'SCHEDULE_DELAYED']);
  });
});
