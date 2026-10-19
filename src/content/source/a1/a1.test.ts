// Genetic Apex (A1) + Promo-A como dados: agrupamento em cartas de jogo, chaves de cópia, evolução, validação de
// regras (schema, opcodes, temporizações) e texto PT-BR gerado do DSL cabendo na face — antes de entrar no conteúdo.
import { describe, expect, it } from 'vitest';
import { RARITY_SYMBOLS, raritySymbol, SYMBOL_PRINT } from '../../../domain/cards/rarity.ts';
import { cardFace } from '../../../domain/cards/text.ts';
import { applyAction } from '../../../domain/battle/engine.ts';
import { createMatchFromFixture, type FixturePokemon, type FixtureSide } from '../../../domain/battle/setup.ts';
import { buildCatalog } from '../../../domain/cards/catalog.ts';
import type { CardDefinition, EnergyType } from '../../../domain/cards/types.ts';
import { estimateTextFit } from '../../../domain/editor/textfit.ts';
import { validateDefinition } from '../../../domain/editor/validate.ts';
import { printing } from '../../builders.ts';
import { PROMO_A } from '../promo-a.ts';
import { a1, A1_CARDS, A1_PRINTING_SPECS } from './cards.ts';

const ALL: readonly CardDefinition[] = [...A1_CARDS, ...PROMO_A.map((p) => p.card)];
const nameOf = (key: string) => ALL.find((c) => c.deckLimitKey === key)?.name ?? null;
const printOf = (card: CardDefinition) => printing({ card, setId: 'a1', number: 1, rarity: 'COMMON', ownNumber: true });

describe('Genetic Apex (A1) e Promo-A como dados', () => {
  it('225 cartas de jogo em 286 impressões, mais 6 promos; chaves de cópia únicas e toda evolução com base', () => {
    expect(A1_CARDS).toHaveLength(225);
    expect(A1_PRINTING_SPECS).toHaveLength(286);
    expect(PROMO_A).toHaveLength(6);
    const keys = ALL.map((c) => c.deckLimitKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(a1('Nidoran♀').deckLimitKey).toBe('nidoran-f');
    expect(a1('Nidoran♂').deckLimitKey).toBe('nidoran-m');
    const known = new Set(keys);
    for (const card of ALL) if (card.category === 'POKEMON') for (const from of card.evolvesFrom) expect(known.has(from), `${card.name} ← ${from}`).toBe(true);
    // Fósseis: Omanyte evolui do Fóssil Hélix.
    expect(a1('Omanyte')).toMatchObject({ stage: 'STAGE_1', evolvesFrom: [a1('Fóssil Hélix').deckLimitKey] });
    // Reimpressões apontam para a mesma carta de jogo (Pikachu ex tem as impressões ◊◊◊◊, ☆☆ e ♛? só as do set).
    const pikachuEx = A1_PRINTING_SPECS.filter((s) => s.card === a1('Pikachu ex')).map((s) => s.symbol);
    expect(pikachuEx[0]).toBe('◊◊◊◊');
    expect(pikachuEx.length).toBeGreaterThan(1);
  });

  it('raridades com os símbolos do Pocket; todo ex é ◊◊◊◊ na impressão de entrada', () => {
    const count = Object.fromEntries(RARITY_SYMBOLS.map((s) => [s, A1_PRINTING_SPECS.filter((p) => p.symbol === s).length]));
    expect(count).toEqual({ '◊': 100, '◊◊': 69, '◊◊◊': 42, '◊◊◊◊': 15, '☆': 24, '☆☆': 29, '☆☆☆': 4, '✵': 0, '✵✵': 0, '♛': 3 });
    for (const card of A1_CARDS.filter((c) => c.ruleBox === 'EX')) expect(A1_PRINTING_SPECS.find((s) => s.card === card)!.symbol).toBe('◊◊◊◊');
    for (const symbol of RARITY_SYMBOLS) {
      const spec = SYMBOL_PRINT[symbol];
      const p = printing({ card: a1('Mew'), setId: 'a1', number: 283, rarity: spec.rarity, finish: spec.finish, ownNumber: true, shiny: !!spec.shiny,
        ...(spec.immersive ? { immersiveSceneId: 'a1-immersive' } : {}) });
      expect(raritySymbol(p)).toBe(symbol);
      expect(p.printingId).toBe('a1-283-mew');
      expect(p.collectorNumber).toBe('283');
    }
  });

  it('toda carta passa na validação de regras do Estúdio (schema, opcodes e temporizações) sem erro', () => {
    for (const card of ALL) {
      const errors = validateDefinition(card, { catalog: ALL }).issues.filter((i) => i.severity === 'ERROR');
      expect(errors, card.name).toEqual([]);
    }
  });

  it('todo texto de regra gerado em PT-BR cabe na face da carta, sem restos do inglês', () => {
    for (const card of ALL) {
      const face = cardFace(card, printOf(card), nameOf);
      const fit = estimateTextFit(face);
      expect(fit.bodyOverflow, `${card.name}: ${JSON.stringify(fit.regions)}`).toBe(false);
      expect(fit.attackNameOverflow, card.name).toEqual([]);
      const text = [...face.attacks.map((a) => a.text), ...face.abilities.map((a) => a.text), face.trainerText].join(' ');
      expect(text, card.name).not.toMatch(/\b(your|opponent|damage|heads|Pokémon's|attack does)\b/);
    }
  });

  it('textos gerados das regras mais delicadas', () => {
    const attackText = (name: string, i = 0) => cardFace(a1(name), printOf(a1(name)), nameOf).attacks[i]!.text;
    expect(attackText('Pikachu ex')).toBe('Este ataque causa 30 de dano para cada Pokémon do tipo Elétrico no seu Banco.');
    expect(attackText('Blastoise ex', 1)).toBe('Se este Pokémon tiver pelo menos 2 Energias de Água extras ligadas, este ataque causa 60 de dano a mais.');
    expect(attackText('Kingler')).toBe('Jogue 2 moedas. Se as duas saírem cara, este ataque causa 80 de dano a mais.');
    expect(attackText('Muk')).toBe('Se o Pokémon Ativo do oponente estiver Envenenado, este ataque causa 50 de dano a mais.');
    // Fórmula nunca aparece crua no texto (“× … − 1”).
    for (const card of ALL) for (const a of cardFace(card, printOf(card), nameOf).attacks) expect(a.text, `${card.name}/${a.name}`).not.toMatch(/ − \d|para cada o |para cada este /);
    expect(attackText('Vulpix')).toMatch(/Pokémon Defensor/);
    expect(attackText('Skiddo')).toMatch(/coroa/i);
    const misty = cardFace(a1('Misty'), printOf(a1('Misty')), nameOf).trainerText;
    expect(misty).toMatch(/Água/);
    const blaine = cardFace(a1('Blaine'), printOf(a1('Blaine')), nameOf).trainerText;
    expect(blaine).toMatch(/Ninetales/);
    expect(blaine).toMatch(/Magmar/);
  });
});

describe('bônus condicionais de dano do A1 no motor (efeitos-dsl §9.1)', () => {
  const cat = buildCatalog([...ALL], ALL.map(printOf));
  const pid = (name: string) => printOf(a1(name)).printingId;
  const side = (active: FixturePokemon, energy: EnergyType): FixtureSide => ({
    deck: Array.from({ length: 8 }, () => pid('Rattata')), hand: [], discard: [], bench: [], active,
    energyZone: { types: [energy], ready: null, next: energy }, points: 0,
  });
  /** Dano de ataque que o Ativo do oponente recebeu (sem o Veneno do checkup). */
  const hit = (attacker: string, energies: EnergyType[], attackId: string, defender: FixturePokemon, attackerDamage = 0): number => {
    const { state } = createMatchFromFixture({
      fixtureId: 't', kind: 'TEST', label: 't', startPhase: 'MAIN', firstPlayer: 'HUMAN', currentPlayer: 'HUMAN', globalTurnNumber: 3,
      ownTurns: { HUMAN: 2, NPC: 1 }, stadiumPrintingId: null,
      players: { HUMAN: side({ stack: [pid(attacker)], energies, damage: attackerDamage }, energies[0]!), NPC: side(defender, 'FIGHTING') },
    }, 'm', 1, cat, (p) => cat.definitionKeyOfPrinting(p));
    const r = applyAction(state, cat, { type: 'ATTACK', player: 'A', attackId });
    if (!r.ok) throw new Error(`${attacker}: ${r.code}`);
    return r.events.filter((e) => e.type === 'DAMAGE_APPLIED' && e.data.category === 'ATTACK').reduce((s, e) => s + (e.data.amount as number), 0);
  };
  const snorlax = (over: Partial<FixturePokemon> = {}): FixturePokemon => ({ stack: [pid('Snorlax')], ...over });

  it('Blastoise: +60 só com pelo menos 2 Energias de Água além do custo', () => {
    expect(hit('Blastoise', ['WATER', 'WATER', 'WATER', 'WATER'], 'hydro-pump', snorlax())).toBe(80);
    expect(hit('Blastoise', ['WATER', 'WATER', 'WATER', 'WATER', 'WATER'], 'hydro-pump', snorlax())).toBe(140);
  });

  it('Muk: +50 contra Ativo Envenenado; Primeape: +60 com dano em si mesmo', () => {
    expect(hit('Muk', ['DARKNESS', 'DARKNESS', 'DARKNESS'], 'venoshock', snorlax())).toBe(70);
    expect(hit('Muk', ['DARKNESS', 'DARKNESS', 'DARKNESS'], 'venoshock', snorlax({ conditions: ['POISONED'] }))).toBe(120);
    const blastoise: FixturePokemon = { stack: [pid('Blastoise')] };
    expect(hit('Primeape', ['FIGHTING', 'FIGHTING'], 'fight-back', blastoise)).toBe(40);
    expect(hit('Primeape', ['FIGHTING', 'FIGHTING'], 'fight-back', blastoise, 10)).toBe(100);
  });
});
