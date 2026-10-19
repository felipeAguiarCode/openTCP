// Estúdio × extensões do DSL do Genetic Apex: o schema estrutural aceita as formas novas (Ajv e o interpretador
// mínimo concordam), a validação de execução recusa DEFENDING e ATTACK_FAILS fora de ataques e a biblioteca de
// efeitos oferece os opcodes novos com formulário.
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { readSpecJson } from '../../tests/support/studio-fixtures.ts';
import { ability, attack, block, c, choose, flip, heads, onPlay, pokemon, post, pre, trainer, SELF } from '../../content/builders.ts';
import type { CardDefinition } from '../cards/types.ts';
import { validateAgainstSchema } from './jsonschema.ts';
import { opcodeSpec, SCOPE_OPTIONS } from './opcodes.ts';
import { CARD_DEFINITION_SCHEMA } from './schemas.generated.ts';
import { validateDefinition, type ValidationReport } from './validate.ts';

const ajv = new Ajv2020({ allErrors: true, strict: false });
const cds = ajv.compile(readSpecJson<object>('schemas/card-definition.schema.json'));
const blocking = (r: ValidationReport) => r.issues.filter((i) => i.severity === 'ERROR' && i.level !== 'DESIGN').map((i) => `${i.code}@${i.path.join('/')}`);

const NEXT_OPP = { kind: 'NEXT_OPPONENT_TURN' } as const;

/** Uma carta que usa todas as formas novas em contexto válido. */
const completa = pokemon({ baseName: 'Completa', stage: 'BASIC', type: 'WATER', hp: 120, retreat: 1, weakness: 'LIGHTNING', attacks: [
  attack({ id: 'defensor', name: 'Defensor', cost: { WATER: 2, COLORLESS: 1 }, damage: 80, effects: [
    pre(flip(1)),
    pre({ type: 'ATTACK_FAILS' }, { condition: { op: 'COMPARE', left: { op: 'COUNT_TAILS', reference: 'coins' }, cmp: 'GE', right: c(1) } }),
    pre({ type: 'MODIFY', stat: 'DAMAGE_DEALT', amount: 60, target: SELF, duration: { kind: 'THIS_TURN' } },
      { condition: { op: 'COMPARE', left: { op: 'EXTRA_ENERGY_UNITS', energyType: 'WATER' }, cmp: 'GE', right: c(2) } }),
    post({ type: 'RESTRICT_ACTION', target: { scope: 'DEFENDING' }, actions: ['ATTACK'], duration: { kind: 'NEXT_OPPONENT_TURN', removeOn: ['TARGET_LEAVES_ACTIVE'] } }),
    post({ type: 'HEAL_DAMAGE', target: SELF, amount: { op: 'DAMAGE_DEALT_BY_ATTACK' } }),
  ] }),
  attack({ id: 'energia', name: 'Energia', cost: { WATER: 1 }, damage: 0, target: null, effects: [
    pre(flip(3)),
    post({ type: 'ATTACH_ENERGY', target: { scope: 'OWN_BENCH', filter: { types: ['WATER'] } }, energyType: 'WATER', count: heads(), source: 'GENERATED', distribute: true }),
    post({ type: 'MOVE_ENERGY', from: { scope: 'OWN_BENCH' }, to: { scope: 'OWN_ACTIVE' }, energyType: 'WATER', count: 'ALL' }),
    post({ type: 'SWITCH_ACTIVE', side: 'OPPONENT', chooser: 'CONTROLLER', filter: { stages: ['BASIC'] } }),
    post({ type: 'SHUFFLE_HAND_INTO_DECK', player: 'OPPONENT' }),
  ] }),
] });

describe('schema e validação das formas novas do DSL', () => {
  it('a carta completa é válida no Ajv, no interpretador mínimo e no Estúdio (sem erro bloqueante)', () => {
    expect(cds(completa), JSON.stringify(cds.errors)).toBe(true);
    expect(validateAgainstSchema(CARD_DEFINITION_SCHEMA, completa)).toEqual([]);
    expect(blocking(validateDefinition(completa))).toEqual([]);
  });

  it('formas inválidas continuam recusadas (count 0 literal, count de MOVE_ENERGY desconhecido, distribute false)', () => {
    const bad = (patch: Record<string, unknown>): CardDefinition => ({
      ...completa,
      attacks: [{ ...completa.attacks[1]!, effects: [{ id: 'x', timing: 'POST_DAMAGE', operation: { type: 'ATTACH_ENERGY', target: SELF, energyType: 'WATER', count: 1, source: 'GENERATED', ...patch } as never }] }],
    });
    for (const doc of [bad({ count: 0 }), bad({ distribute: false }), bad({ count: 'ALL' })]) {
      expect(cds(doc)).toBe(false);
      expect(validateAgainstSchema(CARD_DEFINITION_SCHEMA, doc).length > 0).toBe(true);
    }
    const move: CardDefinition = { ...completa, attacks: [{ ...completa.attacks[1]!, effects: [{ id: 'x', timing: 'POST_DAMAGE', operation: { type: 'MOVE_ENERGY', from: SELF, to: SELF, count: 'SOME' } as never }] }] };
    expect(cds(move)).toBe(false);
  });

  it('DEFENDING fora de ataque (Habilidade, Treinador, efeito atrasado) é seletor impossível', () => {
    const habilidade = pokemon({ baseName: 'Hab', stage: 'BASIC', type: 'WATER', hp: 60, retreat: 1, attacks: [attack({ id: 'a', name: 'A', cost: {}, damage: 10 })],
      abilities: [ability({ id: 'h', name: 'H', kind: 'ACTIVATED', sourcePositions: ['ACTIVE'], usageLimit: { scope: 'INSTANCE_TURN', count: 1 },
        effects: [block('ON_ACTIVATE', { type: 'APPLY_CONDITION', target: { scope: 'DEFENDING' }, condition: 'ASLEEP' })] })] });
    expect(blocking(validateDefinition(habilidade))).toContain('SELECTOR_IMPOSSIBLE@rules/abilities/0/effects/0/operation/target/scope');
    const item = trainer({ baseName: 'Item Defensor', subtype: 'ITEM', effects: [onPlay({ type: 'RESTRICT_ACTION', target: { scope: 'DEFENDING' }, actions: ['ATTACK'], duration: NEXT_OPP })] });
    expect(blocking(validateDefinition(item))).toContain('SELECTOR_IMPOSSIBLE@rules/trainerEffects/0/operation/target/scope');
    const atrasado = pokemon({ baseName: 'Atrasado', stage: 'BASIC', type: 'WATER', hp: 60, retreat: 1, attacks: [attack({ id: 'a', name: 'A', cost: {}, damage: 10,
      effects: [post({ type: 'SCHEDULE_DELAYED', target: { scope: 'OPPONENT_ACTIVE' }, at: 'END_OF_OPPONENT_NEXT_TURN',
        operations: [{ type: 'DEAL_DAMAGE', target: { scope: 'DEFENDING' }, amount: 10, category: 'EFFECT' }] })] })] });
    expect(blocking(validateDefinition(atrasado))).toContain('SELECTOR_IMPOSSIBLE@rules/attacks/0/effects/0/operation/operations/0/target/scope');
  });

  it('ATTACK_FAILS fora de ataque é recusado', () => {
    const item = trainer({ baseName: 'Item Falho', subtype: 'ITEM', effects: [onPlay({ type: 'ATTACK_FAILS' })] });
    expect(blocking(validateDefinition(item))).toContain('ATTACK_ONLY_OPERATION@rules/trainerEffects/0/operation/type');
  });

  it('a biblioteca do Estúdio oferece os opcodes novos, o escopo Defensor e os campos novos', () => {
    expect(opcodeSpec('ATTACK_FAILS')?.create()).toEqual({ type: 'ATTACK_FAILS' });
    expect(opcodeSpec('SHUFFLE_HAND_INTO_DECK')?.create()).toEqual({ type: 'SHUFFLE_HAND_INTO_DECK', player: 'OPPONENT' });
    expect(SCOPE_OPTIONS.some((o) => o.value === 'DEFENDING')).toBe(true);
    const attach = opcodeSpec('ATTACH_ENERGY')!;
    expect(attach.params.find((p) => p.key === 'count')?.param).toMatchObject({ kind: 'amount', formula: true });
    expect(attach.params.some((p) => p.key === 'distribute')).toBe(true);
    expect(opcodeSpec('MOVE_ENERGY')!.params.find((p) => p.key === 'count')?.param).toMatchObject({ kind: 'amount', all: true });
    expect(opcodeSpec('SWITCH_ACTIVE')!.params.find((p) => p.key === 'filter')?.param).toEqual({ kind: 'pokemonFilter' });
  });

  it('quantidade por fórmula sem moeda anterior é referência ausente (FORMULA_REFERENCE_MISSING)', () => {
    const solta: CardDefinition = { ...completa, attacks: [{ ...completa.attacks[1]!, effects: [
      post({ type: 'ATTACH_ENERGY', target: choose('OWN_POKEMON'), energyType: 'WATER', count: heads(), source: 'GENERATED' }, { id: 'y' })] }] };
    expect(cds(solta)).toBe(true);
    expect(blocking(validateDefinition(solta))).toContain('FORMULA_REFERENCE_MISSING@rules/attacks/0/effects/0/operation/count/reference');
  });
});
