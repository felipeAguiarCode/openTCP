// Laboratório funcional (editor §25) contra o motor real: moedas forçadas, Energia, Fraqueza, Nocaute,
// Habilidades, Treinadores e retomada. IDs ED-xxx nos títulos.
import { describe, expect, it } from 'vitest';
import { exampleDraft, STARTER_DEFS, STARTER_PRINTS } from '../../tests/support/studio-fixtures.ts';
import type { CardDefinition, PokemonCard } from '../cards/types.ts';
import { compileDraft } from './compile.ts';
import { addAbility, addAttack, newDefinitionDraft, setIn, type EditorDraft, type TestScenario } from './draft.ts';
import { defaultScenarios, energiesForCost, isRunCurrent, runLabScenario } from './lab.ts';

const catalog = { definitions: STARTER_DEFS, printings: STARTER_PRINTS };

function run(draft: EditorDraft, scenario: TestScenario) {
  const compiled = compileDraft(draft);
  return runLabScenario({ definition: compiled.definition, printing: compiled.printings[0]!.printing, scenario, rulesHash: compiled.rulesHash, catalog });
}

describe('laboratório com o motor real', () => {
  it('ED-024 · fixture 0/1/2 caras produz 0/40/80 e PASS nos cenários do exemplo', () => {
    const draft = exampleDraft();
    for (const scenario of draft.testScenarios) {
      const r = run(draft, scenario);
      expect(r.outcome, `${scenario.id}: ${JSON.stringify(r.diffs)} ${r.message ?? ''}`).toBe('PASS');
      expect(r.coins).toEqual(scenario.forcedCoins);
      expect(r.forcedCoinsUsed).toBe(2);
    }
    expect(run(draft, draft.testScenarios[2]!).baseDamage).toBe(80);
  });

  it('expectativa errada vira FAIL com diferença explícita', () => {
    const draft = exampleDraft();
    const r = run(draft, { ...draft.testScenarios[2]!, expect: { baseDamage: 120 } });
    expect(r.outcome).toBe('FAIL');
    expect(r.diffs).toEqual([{ field: 'baseDamage', expected: 120, actual: 80 }]);
  });

  it('ED-021 · Energia insuficiente: não declara nem consome recursos', () => {
    const r = run(exampleDraft(), { id: 'x', kind: 'ATTACK', attackId: 'ember-strike', fixture: 'no-energy', forcedCoins: [], expect: { legal: false, errorCode: 'INSUFFICIENT_ENERGY' } });
    expect(r.outcome).toBe('PASS');
    expect(r.events).toEqual([]);
  });

  it('ED-019/020 · Incolor pago por outro tipo; Energia continua ligada após atacar', () => {
    const attack = exampleDraft().rules.attacks[0]!;
    expect(energiesForCost(attack)).toEqual(['FIRE', 'GRASS']);
    const r = run(exampleDraft(), { id: 'x', kind: 'ATTACK', attackId: 'ember-strike', fixture: 'default', forcedCoins: [], expect: { legal: true, baseDamage: 50, finalDamage: 50 } });
    expect(r.outcome).toBe('PASS');
    expect(r.events.some((e) => e.type === 'ENERGY_DISCARDED')).toBe(false);
  });

  it('Fraqueza +20 aplicada pelo pipeline de dano', () => {
    const r = run(exampleDraft(), { id: 'w', kind: 'ATTACK', attackId: 'ember-strike', fixture: 'weakness', forcedCoins: [], expect: { baseDamage: 50, finalDamage: 70 } });
    expect(r.outcome).toBe('PASS');
  });

  it('Nocaute de carta ex entrega 2 pontos; Mega ex entrega 3 (ED-005/007)', () => {
    const ex = run(exampleDraft(), { id: 'ko', kind: 'KNOCKOUT', fixture: 'default', forcedCoins: [], expect: { knockout: true, pointsGranted: 2 } });
    expect(ex.outcome, JSON.stringify(ex)).toBe('PASS');
    const mega = setIn(setIn(exampleDraft(), ['rules', 'ruleBox'], 'MEGA_EX'), ['rules', 'knockoutPoints'], 3);
    const m = run({ ...mega, rules: { ...mega.rules, name: 'Mega Braseiro ex', deckLimitKey: 'mega-braseiro-ex' } as CardDefinition },
      { id: 'ko', kind: 'KNOCKOUT', fixture: 'default', forcedCoins: [], expect: { knockout: true, pointsGranted: 3 } });
    expect(m.outcome).toBe('PASS');
  });

  it('condição impeditiva (Adormecido) bloqueia o ataque', () => {
    const r = run(exampleDraft(), { id: 's', kind: 'ATTACK', attackId: 'ember-strike', fixture: 'asleep', forcedCoins: [], expect: { legal: false, errorCode: 'SPECIAL_CONDITION_BLOCKS_ACTION' } });
    expect(r.outcome).toBe('PASS');
  });

  it('ED-030/031 · Habilidade ativada é usável; contínua não cria botão “Usar”', () => {
    const base = newDefinitionDraft({ template: 'POKEMON_BASIC', baseName: 'Musgolo', type: 'GRASS', definitionId: 'custom-musgolo-1', token: '1' });
    const activated = { ...base, rules: addAbility(base.rules, 'ACTIVATED') };
    const a = run(activated, { id: 'a', kind: 'ABILITY', abilityId: activated.rules.abilities[0]!.id, fixture: 'damaged-self', forcedCoins: [], expect: { legal: true } });
    expect(a.outcome, JSON.stringify(a)).toBe('PASS');
    expect(a.events.some((e) => e.type === 'ABILITY_ACTIVATED')).toBe(true);
    const continuous = { ...base, rules: addAbility(base.rules, 'CONTINUOUS') };
    const c = run(continuous, { id: 'c', kind: 'ABILITY', abilityId: continuous.rules.abilities[0]!.id, fixture: 'default', forcedCoins: [], expect: { legal: false } });
    expect(c.outcome).toBe('PASS');
  });

  it('ED-035 · Item: jogado e descartado depois de resolver', () => {
    const item = newDefinitionDraft({ template: 'ITEM', baseName: 'Bálsamo de Treino', definitionId: 'custom-balsamo-1', token: '1' });
    const r = run(item, { id: 'i', kind: 'TRAINER', fixture: 'damaged-self', forcedCoins: [], expect: { legal: true } });
    expect(r.outcome, JSON.stringify(r)).toBe('PASS');
    expect(r.events.some((e) => e.type === 'HEAL_APPLIED')).toBe(true);
    expect(r.events.some((e) => e.type === 'CARD_DISCARDED')).toBe(true);
  });

  it('ED-038 · Fóssil entra no Banco como Pokémon e entrega 1 ponto ao ser Nocauteado', () => {
    const fossil = newDefinitionDraft({ template: 'FOSSIL', baseName: 'Concha Antiga', definitionId: 'custom-concha-1', token: '1' });
    const play = run(fossil, { id: 'p', kind: 'TRAINER', fixture: 'default', forcedCoins: [], expect: { legal: true } });
    expect(play.outcome, JSON.stringify(play)).toBe('PASS');
    expect(play.events.some((e) => e.type === 'POKEMON_ENTERED')).toBe(true);
  });

  it('persistência: retomar do estado serializado produz o mesmo estado', () => {
    const draft = exampleDraft();
    const r = run(draft, { id: 'p', kind: 'PERSISTENCE', attackId: 'ember-rain', fixture: 'default', forcedCoins: ['HEADS', 'TAILS'], expect: {} });
    expect(r.outcome).toBe('PASS');
    expect(r.notes.join(' ')).toContain('mesmo estado');
  });

  it('cenários-padrão gerados passam para o exemplo e para todos os modelos de carta', () => {
    const drafts: EditorDraft[] = [exampleDraft(),
      ...(['POKEMON_BASIC', 'POKEMON_EX', 'ITEM', 'SUPPORTER', 'TOOL', 'STADIUM'] as const).map((template) => newDefinitionDraft({ template, baseName: 'Modelo Lab', type: 'WATER', definitionId: `custom-modelo-${template.toLowerCase().replace(/_/g, '-')}`, token: '1' }))];
    for (const d of drafts) {
      const scenarios = defaultScenarios(d.rules);
      expect(scenarios.length).toBeGreaterThan(0);
      for (const s of scenarios) {
        const r = run(d, s);
        expect(r.outcome, `${d.rules.name} ${s.id}: ${JSON.stringify(r.diffs)} ${r.message ?? ''} ${r.errorCode ?? ''}`).toBe('PASS');
      }
    }
  });

  it('ED-056 · aprovação só vale para o rulesHash testado', () => {
    const draft = exampleDraft();
    const r = run(draft, draft.testScenarios[0]!);
    expect(isRunCurrent(r, compileDraft(draft).rulesHash)).toBe(true);
    const changed = setIn(draft, ['rules', 'baseHp'], 150);
    expect(isRunCurrent(r, compileDraft(changed).rulesHash)).toBe(false);
    expect((changed.rules as PokemonCard).baseHp).toBe(150);
  });

  it('ED-025 · alvo escolhido pelo rival: a decisão vai para o oponente, não para o criador do efeito', () => {
    const base = newDefinitionDraft({ template: 'POKEMON_BASIC', baseName: 'Ventania', type: 'GRASS', definitionId: 'custom-ventania-1', token: '1' });
    const rules = addAttack(base.rules, 'BENCH_DAMAGE');
    const attack = rules.attacks[1]!;
    const chosenByRival = { ...attack, effects: attack.effects.map((b) => (b.operation.type === 'DEAL_DAMAGE'
      ? { ...b, operation: { ...b.operation, target: { scope: 'OPPONENT_BENCH' as const, pick: { mode: 'CHOOSE' as const, chooser: 'OPPONENT' as const, min: 1, max: 1 } } } } : b)) };
    const draft = { ...base, rules: { ...rules, attacks: [rules.attacks[0]!, chosenByRival] } as CardDefinition };
    const r = run(draft, { id: 'r', kind: 'ATTACK', attackId: attack.id, fixture: 'full-bench', forcedCoins: [], expect: { legal: true } });
    expect(r.outcome, JSON.stringify(r)).toBe('PASS');
    const decisions = r.events.filter((e) => e.type === 'DECISION_REQUESTED');
    expect(decisions.length).toBeGreaterThan(0);
    expect(decisions.every((e) => e.data.player === 'B')).toBe(true);
  });

  it('ED-026 · efeito sem alvo resolve a política declarada sem travar', () => {
    const base = newDefinitionDraft({ template: 'POKEMON_BASIC', baseName: 'Ventania', type: 'GRASS', definitionId: 'custom-ventania-2', token: '2' });
    const draft = { ...base, rules: addAttack(base.rules, 'BENCH_DAMAGE') };
    const attack = draft.rules.attacks[1]!;
    const r = run(draft, { id: 'nb', kind: 'ATTACK', attackId: attack.id, fixture: 'no-bench', forcedCoins: [], expect: { legal: true, baseDamage: 30 } });
    expect(r.outcome, JSON.stringify(r)).toBe('PASS');
    expect(r.events.some((e) => e.type === 'TURN_ENDED' || e.type === 'TURN_STARTED')).toBe(true);
  });

  it('ED-029 · condição aplicada pelo efeito segue as regras do motor (Ativo envenenado)', () => {
    const base = newDefinitionDraft({ template: 'POKEMON_BASIC', baseName: 'Ferrão', type: 'PSYCHIC', definitionId: 'custom-ferrao-1', token: '1' });
    const draft = { ...base, rules: addAttack(base.rules, 'DAMAGE_CONDITION') };
    const r = run(draft, { id: 'p', kind: 'ATTACK', attackId: draft.rules.attacks[1]!.id, fixture: 'default', forcedCoins: [], expect: { legal: true } });
    expect(r.outcome).toBe('PASS');
    expect(r.events.some((e) => e.type === 'CONDITION_APPLIED' && e.data.condition === 'POISONED')).toBe(true);
  });

  it('ED-034 · Habilidade que encerra o turno: o motor encerra após resolver', () => {
    const base = newDefinitionDraft({ template: 'POKEMON_BASIC', baseName: 'Sesteiro', type: 'WATER', definitionId: 'custom-sesteiro-1', token: '1' });
    const rules = addAbility(base.rules, 'ACTIVATED');
    const draft = { ...base, rules: { ...rules, abilities: rules.abilities.map((a) => ({ ...a, endsTurn: true })) } as CardDefinition };
    const r = run(draft, { id: 'e', kind: 'ABILITY', abilityId: draft.rules.abilities[0]!.id, fixture: 'damaged-self', forcedCoins: [], expect: { legal: true } });
    expect(r.outcome, JSON.stringify(r)).toBe('PASS');
    const order = r.events.map((e) => e.type);
    expect(order.indexOf('ABILITY_ACTIVATED')).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('TURN_ENDED')).toBeGreaterThan(order.indexOf('ABILITY_ACTIVATED'));
  });
});
