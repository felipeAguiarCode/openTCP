// Domínio do Estúdio: compilação rascunho → documentos (validados por Ajv contra os schemas da spec),
// validação em quatro níveis com os códigos listados na spec, derivações de ex/Mega ex, ataques, histórico,
// balanceamento e inspeção de imagens. IDs ED-xxx da editor-de-cartas.md §34 aparecem nos títulos.
import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { exampleDraft, readSpecJson, ROOT, STARTER_DEFS, tinyPng } from '../../tests/support/studio-fixtures.ts';
import type { Attack, CardDefinition, PokemonCard, TrainerCard } from '../cards/types.ts';
import { jcsHash } from '../hash/jcs.ts';
import { analyzeAttack } from './balance.ts';
import { compileDraft, draftRulesHash } from './compile.ts';
import { diffRules } from './diff.ts';
import {
  addAttack, CARD_TEMPLATES, draftFromSource, duplicateAttack, moveItem, newDefinitionDraft, removeAttack, setIn, withBaseName, withCategory, withFinish,
  withRuleBox, type EditorDraft,
} from './draft.ts';
import { canRedo, canUndo, historyInit, historyPush, historyRedo, historyUndo } from './history.ts';
import { autosaveInit, beginSave, canStartSave, hasUnsavedChanges, markEdited, saveFailed, saveSucceeded } from './autosave.ts';
import { validateAgainstSchema } from './jsonschema.ts';
import { maskCoverage, sniffImage, toMaskPixels } from './media.ts';
import { OPCODE_LIBRARY, opcodesForTiming } from './opcodes.ts';
import { CARD_DEFINITION_SCHEMA, CARD_PRINTING_SCHEMA, EDITOR_DRAFT_SCHEMA } from './schemas.generated.ts';
import { validateDraft, validateDefinition, type ValidationReport } from './validate.ts';
import { OPCODES } from '../battle/ops.ts';

const ajv = new Ajv2020({ allErrors: true, strict: false });
const cds = ajv.compile(readSpecJson<object>('schemas/card-definition.schema.json'));
const cps = ajv.compile(readSpecJson<object>('schemas/card-printing.schema.json'));
const eds = ajv.compile(readSpecJson<object>('schemas/editor-draft.schema.json'));

const codes = (r: ValidationReport) => r.issues.map((i) => i.code);
const errors = (r: ValidationReport) => r.issues.filter((i) => i.severity === 'ERROR').map((i) => i.code);

function pokemonDraft(over: Partial<PokemonCard> = {}): EditorDraft {
  const d = newDefinitionDraft({ template: 'POKEMON_BASIC', baseName: 'Lumino', type: 'LIGHTNING', definitionId: 'custom-lumino-t1', token: 't1' });
  return { ...d, rules: { ...(d.rules as PokemonCard), ...over } };
}

function withAttack(d: EditorDraft, patch: Partial<Attack>, index = 0): EditorDraft {
  return setIn(d, ['rules', 'attacks', index], { ...d.rules.attacks[index]!, ...patch });
}

describe('schemas gerados', () => {
  it('são idênticos aos arquivos de .specs/schemas', () => {
    const read = (f: string) => JSON.parse(fs.readFileSync(path.join(ROOT, '.specs', 'schemas', f), 'utf8')) as unknown;
    expect(CARD_DEFINITION_SCHEMA).toEqual(read('card-definition.schema.json'));
    expect(CARD_PRINTING_SCHEMA).toEqual(read('card-printing.schema.json'));
    expect(EDITOR_DRAFT_SCHEMA).toEqual(read('editor-draft.schema.json'));
  });

  it('o interpretador mínimo concorda com o Ajv em documentos válidos e inválidos', () => {
    const example = exampleDraft();
    const docs: unknown[] = [
      example.rules, ...STARTER_DEFS,
      { ...example.rules, baseHp: -10 }, { ...example.rules, ruleBox: 'GIGA' }, { ...example.rules, attacks: [{ id: 'x' }] },
      { ...STARTER_DEFS.find((d) => d.category === 'TRAINER')!, stage: 'BASIC' },
    ];
    for (const doc of docs) expect(validateAgainstSchema(CARD_DEFINITION_SCHEMA, doc).length === 0).toBe(cds(doc));
    for (const p of [...example.printings, { ...example.printings[0], finishSettings: { ...example.printings[0]!.finishSettings, intensity: 0.4 } }]) {
      expect(validateAgainstSchema(CARD_PRINTING_SCHEMA, p).length === 0).toBe(cps(p));
    }
    expect(validateAgainstSchema(EDITOR_DRAFT_SCHEMA, example).length).toBe(0);
  });
});

describe('compilação rascunho → definição/impressões', () => {
  it('o exemplo da spec (Braseiro ex) compila em documentos válidos pelo Ajv e sem erros de validação', () => {
    const draft = exampleDraft();
    expect(eds(draft)).toBe(true);
    const compiled = compileDraft(draft);
    expect(cds(compiled.definition)).toBe(true);
    for (const p of compiled.printings) expect(cps(p.printing)).toBe(true);
    expect(compiled.rulesHash).toBe(jcsHash(compiled.definition));
    const report = validateDraft(draft, { catalog: STARTER_DEFS });
    expect(errors(report)).toEqual([]);
    expect(report.publishable).toBe(true);
  });

  it.each(CARD_TEMPLATES.map((t) => t.id))('modelo %s: round-trip JSON e schemas da spec', (template) => {
    let draft = newDefinitionDraft({ template, baseName: 'Pirilampo', type: 'GRASS', definitionId: `custom-pirilampo-${template.toLowerCase().replace(/_/g, '-')}`, token: 'abc' });
    if (draft.rules.category === 'POKEMON' && draft.rules.stage !== 'BASIC') draft = setIn(draft, ['rules', 'evolvesFrom'], ['broto']);
    const compiled = compileDraft(draft);
    const roundTrip = JSON.parse(JSON.stringify(compiled.definition)) as CardDefinition;
    expect(roundTrip).toEqual(compiled.definition);
    expect(jcsHash(roundTrip)).toBe(compiled.rulesHash);
    expect(cds(compiled.definition), JSON.stringify(cds.errors)).toBe(true);
    for (const p of compiled.printings) expect(cps(p.printing), JSON.stringify(cps.errors)).toBe(true);
    expect(eds(JSON.parse(JSON.stringify(draft)))).toBe(true);
    const report = validateDraft(draft, { catalog: STARTER_DEFS });
    expect(errors(report), JSON.stringify(report.issues.filter((i) => i.severity === 'ERROR'))).toEqual([]);
  });

  it('ED-001 · criar Pokémon gera projeto com ID estável e versão alvo 1', () => {
    const d = newDefinitionDraft({ template: 'POKEMON_BASIC', baseName: 'Pirilampo', definitionId: 'custom-pirilampo-x1', token: 'x1' });
    expect(d.mode).toBe('NEW_DEFINITION');
    expect(d.target).toEqual({ definitionId: 'custom-pirilampo-x1', version: 1 });
    const renamed = { ...d, rules: withBaseName(d.rules, 'Vagalume') };
    expect(compileDraft(renamed).definition.id).toBe('custom-pirilampo-x1'); // ED-010
  });

  it('ED-018 · ataque sem custo continua sem custo (nenhum Incolor é inserido)', () => {
    const d = withAttack(pokemonDraft(), { energyCost: {} });
    expect(compileDraft(d).definition.attacks[0]!.energyCost).toEqual({});
    expect(errors(validateDraft(d))).toEqual([]);
  });

  it('ED-012 · tipo do Pokémon e custo do ataque são independentes', () => {
    const d = withAttack(pokemonDraft(), { energyCost: { WATER: 1, PSYCHIC: 1 } });
    const def = compileDraft(d).definition as PokemonCard;
    expect(def.types).toEqual(['LIGHTNING']);
    expect(def.attacks[0]!.energyCost).toEqual({ WATER: 1, PSYCHIC: 1 });
  });
});

describe('validação em quatro níveis (editor §24)', () => {
  it('ATTACK_ENERGY_INVALID: Energia Dragão no custo', () => {
    const d = withAttack(pokemonDraft(), { energyCost: { DRAGON: 1 } as Attack['energyCost'] });
    const r = validateDraft(d);
    expect(codes(r)).toContain('ATTACK_ENERGY_INVALID');
    expect(r.issues.find((i) => i.code === 'ATTACK_ENERGY_INVALID')!.level).toBe('EXECUTION');
    expect(r.publishable).toBe(false);
  });

  it('ED-023 · FORMULA_REFERENCE_MISSING: variável inexistente ou usada antes de ser produzida', () => {
    const formula = { op: 'MULTIPLY' as const, operands: [{ op: 'CONST' as const, value: 40 }, { op: 'COUNT_HEADS' as const, reference: 'attackCoins' }] };
    const missing = withAttack(pokemonDraft(), { baseDamage: null, damageFormula: formula, effects: [] });
    const r1 = validateDraft(missing);
    expect(codes(r1)).toContain('FORMULA_REFERENCE_MISSING');
    expect(r1.issues.find((i) => i.code === 'FORMULA_REFERENCE_MISSING')!.message).toContain('attackCoins');
    const late = withAttack(pokemonDraft(), { baseDamage: null, damageFormula: formula,
      effects: [{ id: 'flip', timing: 'POST_DAMAGE', operation: { type: 'FLIP_COINS', count: 2, outputId: 'attackCoins' } }] });
    expect(codes(validateDraft(late))).toContain('FORMULA_REFERENCE_MISSING');
    const ok = withAttack(pokemonDraft(), { baseDamage: null, damageFormula: formula,
      effects: [{ id: 'flip', timing: 'PRE_DAMAGE', operation: { type: 'FLIP_COINS', count: 2, outputId: 'attackCoins' } }] });
    expect(codes(validateDraft(ok))).not.toContain('FORMULA_REFERENCE_MISSING');
  });

  it('ED-022 · dano fixo e fórmula não coexistem', () => {
    const d = withAttack(pokemonDraft(), { baseDamage: 30, damageFormula: { op: 'CONST', value: 30 } });
    expect(codes(validateDraft(d))).toContain('DAMAGE_FORMULA_CONFLICT');
  });

  it('RULE_BOX_POINTS_MISMATCH: carta ex importada com um ponto', () => {
    const ex = { ...exampleDraft().rules, knockoutPoints: 1 } as unknown as CardDefinition;
    const r = validateDefinition(ex);
    expect(codes(r)).toContain('RULE_BOX_POINTS_MISMATCH');
    expect(r.issues.find((i) => i.code === 'RULE_BOX_POINTS_MISMATCH')!.message).toContain('2 pontos');
  });

  it('ED-044 · CARD_TEXT_OVERFLOW bloqueia publicação de carta ilegível', () => {
    let d = pokemonDraft();
    const long = 'Descarte 2 cartas da sua mão e depois procure no seu baralho por um Pokémon Básico do tipo Elétrico para colocar no Banco.';
    void long;
    for (let i = 0; i < 3; i += 1) d = { ...d, rules: addAttack(d.rules, 'DAMAGE_CONDITION') };
    d = { ...d, rules: { ...d.rules, attacks: d.rules.attacks.map((a) => ({ ...a, effects: [...a.effects,
      { id: `${a.id}-x1`, timing: 'POST_DAMAGE' as const, operation: { type: 'DRAW_CARDS' as const, player: 'OWN' as const, count: 2 } },
      { id: `${a.id}-x2`, timing: 'POST_DAMAGE' as const, operation: { type: 'HEAL_DAMAGE' as const, target: { scope: 'OWN_POKEMON' as const, pick: { mode: 'CHOOSE' as const, chooser: 'CONTROLLER' as const, min: 1, max: 2 } }, amount: 30 } },
      { id: `${a.id}-x3`, timing: 'POST_DAMAGE' as const, operation: { type: 'DISCARD_CARDS' as const, zone: 'OPPONENT_HAND' as const, count: 1, chooser: 'RANDOM' as const } },
    ] })) } as CardDefinition };
    const r = validateDraft(d);
    const overflow = r.issues.filter((i) => i.code === 'CARD_TEXT_OVERFLOW');
    expect(overflow.length).toBeGreaterThan(0);
    expect(overflow[0]!.severity).toBe('ERROR');
    expect(overflow[0]!.level).toBe('DESIGN');
    expect(r.publishable).toBe(false);
  });

  it('ASSET_MISSING: arte/máscara referenciada fora do armazenamento local', () => {
    const d = exampleDraft();
    const r = validateDraft(d, { knownAssetIds: new Set() });
    expect(codes(r)).toContain('ASSET_MISSING');
    const ok = validateDraft(d, { knownAssetIds: new Set(['431ced6916a2a21a156e38701afe55bbd7f88969fbbfc56d7fe099d47f265460']) });
    expect(codes(ok)).not.toContain('ASSET_MISSING');
  });

  it('ED-027 · UNKNOWN_OPCODE não publica como aproximação', () => {
    const d = withAttack(pokemonDraft(), { effects: [{ id: 'mist', timing: 'POST_DAMAGE', operation: { type: 'TELEPORT_ALL' } as never }] });
    const r = validateDraft(d);
    expect(codes(r)).toContain('UNKNOWN_OPCODE');
    expect(r.publishable).toBe(false);
  });

  it('ED-008 · Treinador com regra ex: TRAINER_FIELD_INVALID (e o seletor ex não age em Treinador)', () => {
    const d = newDefinitionDraft({ template: 'ITEM', baseName: 'Lanterna', definitionId: 'custom-lanterna-1', token: '1' });
    expect(withRuleBox(d, 'EX')).toBe(d);
    const forced = setIn(d, ['rules', 'ruleBox'], 'EX');
    expect(codes(validateDraft(forced))).toContain('TRAINER_FIELD_INVALID');
    const stage = setIn(d, ['rules', 'stage'], 'BASIC');
    expect(codes(validateDraft(stage))).toContain('TRAINER_FIELD_INVALID');
  });

  it('ED-014 · HP negativo, fracionário ou fora da guarda é rejeitado', () => {
    for (const hp of [-10, 65.5, 0, 10000, 75]) expect(codes(validateDraft(pokemonDraft({ baseHp: hp })))).toContain('HP_INVALID');
    expect(codes(validateDraft(pokemonDraft({ baseHp: 70 })))).not.toContain('HP_INVALID');
  });

  it('ED-013 · segundo tipo bloqueia publicação mantendo o rascunho', () => {
    const d = pokemonDraft({ types: ['LIGHTNING', 'METAL'] });
    const r = validateDraft(d);
    expect(codes(r)).toContain('SECOND_TYPE_UNSUPPORTED');
    expect(r.publishable).toBe(false);
  });

  it('ED-011 · evolução: origem ausente, ciclo e estágio incompatível são apontados', () => {
    const stage1 = newDefinitionDraft({ template: 'POKEMON_STAGE_1', baseName: 'Brasilo', definitionId: 'custom-brasilo-1', token: '1' });
    expect(codes(validateDraft(stage1))).toContain('EVOLUTION_SOURCE_MISSING');
    const unknown = setIn(stage1, ['rules', 'evolvesFrom'], ['ninguem-existe']);
    expect(codes(validateDraft(unknown, { catalog: STARTER_DEFS }))).toContain('EVOLUTION_SOURCE_UNKNOWN');
    const wrongStage = setIn(stage1, ['rules', 'evolvesFrom'], ['braseiro']);
    expect(codes(validateDraft(wrongStage, { catalog: STARTER_DEFS }))).toContain('EVOLUTION_STAGE_MISMATCH');
    // Ciclo: a origem (faisca) passa a evoluir desta carta.
    const looped = STARTER_DEFS.map((d) => (d.id === 'faisca' ? { ...d, evolvesFrom: ['brasilo'] } as CardDefinition : d));
    const cyc = setIn(stage1, ['rules', 'evolvesFrom'], ['faisca']);
    expect(codes(validateDraft(cyc, { catalog: looped }))).toContain('EVOLUTION_CYCLE');
  });

  it('ED-009 · mesmo nome de regra de outra carta: aviso de limite compartilhado', () => {
    const d = { ...pokemonDraft(), rules: withBaseName(pokemonDraft().rules, 'Faísca') };
    const r = validateDraft(d, { catalog: STARTER_DEFS });
    expect(codes(r)).toContain('NAME_SHARED_LIMIT');
    expect(d.rules.deckLimitKey).toBe('faisca');
  });

  it('erros vêm agrupados por aba com caminho para “Ir para o campo”', () => {
    const r = validateDraft(pokemonDraft({ baseHp: -10 }));
    const issue = r.issues.find((i) => i.code === 'HP_INVALID')!;
    expect(issue.tab).toBe('RULES');
    expect(issue.path).toEqual(['rules', 'baseHp']);
    expect(issue.message).not.toBe('validation failed');
  });

  it('ED-004 · VARIANT: qualquer mudança de regra é bloqueada; impressões continuam editáveis', () => {
    const source = compileDraft(exampleDraft()).definition;
    const variant = draftFromSource({ mode: 'VARIANT', source, sourcePrintings: compileDraft(exampleDraft()).printings.map((p) => p.printing), token: 'v2' });
    expect(variant.target).toEqual({ definitionId: source.id, version: source.version });
    expect(errors(validateDraft(variant, { sourceRules: source }))).toEqual([]);
    const foil = { ...variant, printings: variant.printings.map((p) => withFinish(p, 'FOIL')) };
    expect(errors(validateDraft(foil, { sourceRules: source }))).toEqual([]);
    const changed = setIn(variant, ['rules', 'baseHp'], 150);
    expect(codes(validateDraft(changed, { sourceRules: source }))).toContain('RULES_LOCKED_VARIANT');
  });

  it('ED-059 · NEW_VERSION não troca a regra especial (exige fork)', () => {
    const source = compileDraft(exampleDraft()).definition;
    const next = draftFromSource({ mode: 'NEW_VERSION', source, sourcePrintings: [], latestVersion: 1, token: 'n2' });
    expect(next.target.version).toBe(2);
    expect(codes(validateDraft(withRuleBox(next, 'NONE'), { sourceRules: source }))).toContain('RULE_BOX_CHANGE_REQUIRES_FORK');
    const fork = draftFromSource({ mode: 'FORK', source, sourcePrintings: [], forkDefinitionId: 'custom-braseiro-fork', token: 'f1' });
    expect(fork.target).toEqual({ definitionId: 'custom-braseiro-fork', version: 1 });
    expect(codes(validateDraft(withRuleBox(fork, 'NONE'), { sourceRules: source }))).not.toContain('RULE_BOX_CHANGE_REQUIRES_FORK');
  });

  it('ED-002 · fork do catálogo base registra a origem e ganha ID autoral novo', () => {
    const base = STARTER_DEFS.find((d) => d.id === 'braseiro')!;
    const fork = draftFromSource({ mode: 'FORK', source: base, sourcePrintings: [], forkDefinitionId: 'custom-braseiro-copia', token: 'k' });
    expect(fork.rules.id).toBe('custom-braseiro-copia');
    expect(fork.mode).toBe('FORK');
    expect(errors(validateDraft(fork, { catalog: STARTER_DEFS, sourceRules: base }))).toEqual([]);
  });

  it('ED-028 · texto digitado nunca é código: HTML/URL ficam como texto e não criam regras', () => {
    const d = { ...pokemonDraft(), rules: { ...withBaseName(pokemonDraft().rules, 'Nome<script>'), flavorText: '<img onerror=alert(1)> javascript:alert(1)' } as CardDefinition };
    const compiled = compileDraft(d).definition;
    expect(compiled.flavorText).toBe('<img onerror=alert(1)> javascript:alert(1)');
    expect(compiled.attacks).toEqual(compileDraft(pokemonDraft()).definition.attacks);
  });
});

describe('ex, Mega ex e derivações (editor §9)', () => {
  it('ED-005 · ativar ex: nome/chave/pontos derivados, sem mudar HP, dano, custo, raridade ou acabamento', () => {
    const d = pokemonDraft();
    const ex = withRuleBox(d, 'EX');
    const r = ex.rules as PokemonCard;
    expect(r.name).toBe('Lumino ex');
    expect(r.deckLimitKey).toBe('lumino-ex');
    expect(r.knockoutPoints).toBe(2);
    expect(r.baseHp).toBe((d.rules as PokemonCard).baseHp);
    expect(r.attacks).toEqual(d.rules.attacks);
    expect(ex.printings[0]!.finish).toBe(d.printings[0]!.finish);
    expect(ex.printings[0]!.rarity).toBe(d.printings[0]!.rarity);
    expect(ex.printings[0]!.templateId).toBe('pocket-light-card-v1/pokemon-ex');
  });

  it('ED-006 · desativar ex recalcula pontos sem mudar foil', () => {
    const foil = { ...withRuleBox(pokemonDraft(), 'EX') };
    const withFoil = { ...foil, printings: foil.printings.map((p) => withFinish(p, 'FOIL')) };
    const off = withRuleBox(withFoil, 'NONE');
    expect((off.rules as PokemonCard).knockoutPoints).toBe(1);
    expect(off.rules.name).toBe('Lumino');
    expect(off.printings[0]!.finish).toBe('FOIL');
  });

  it('ED-007 · Mega ex usa três pontos e não cria Estágio 3', () => {
    const mega = withRuleBox(pokemonDraft(), 'MEGA_EX');
    expect((mega.rules as PokemonCard).knockoutPoints).toBe(3);
    expect(mega.rules.name).toBe('Mega Lumino ex');
    expect((mega.rules as PokemonCard).stage).toBe('BASIC');
  });

  it('ED-045/046 · NORMAL exige intensidade 0; FOIL muda só o material', () => {
    const d = pokemonDraft();
    const normalBright = setIn(d, ['printings', 0, 'finishSettings', 'intensity'], 0.5);
    expect(codes(validateDraft(normalBright))).toContain('NORMAL_FINISH_INTENSITY');
    const foil = { ...d, printings: [withFinish(d.printings[0]!, 'FOIL')] };
    expect(draftRulesHash(foil)).toBe(draftRulesHash(d)); // ED-056: acabamento não invalida testes
    expect(foil.printings[0]!.rarity).toBe(d.printings[0]!.rarity); // ED-047
  });

  it('ED-056 · mudança funcional muda o rulesHash', () => {
    const d = pokemonDraft();
    expect(draftRulesHash(setIn(d, ['rules', 'baseHp'], 80))).not.toBe(draftRulesHash(d));
  });

  it('troca destrutiva de categoria remove campos de Pokémon (§17)', () => {
    const t = withCategory(pokemonDraft(), 'TRAINER');
    const rules = t.rules as TrainerCard;
    expect(rules.category).toBe('TRAINER');
    expect('stage' in rules).toBe(false);
    expect(rules.knockoutPoints).toBeNull();
    expect(errors(validateDraft(t))).toEqual([]);
  });
});

describe('ataques (editor §10)', () => {
  it('ED-016 · duplicar cria ID novo, blocos únicos e remapeia referências locais', () => {
    let rules = pokemonDraft().rules;
    rules = { ...rules, attacks: [{ ...rules.attacks[0]!, effects: [{ id: 'buff', timing: 'POST_DAMAGE', operation: { type: 'MODIFY', stat: 'DAMAGE_DEALT', amount: 10, target: { scope: 'SELF' }, duration: { kind: 'NEXT_OWN_TURN' }, appliesTo: { attackIds: [rules.attacks[0]!.id] } } }] }] } as CardDefinition;
    const dup = duplicateAttack(rules, 0);
    expect(dup.attacks).toHaveLength(2);
    const [a, b] = dup.attacks;
    expect(b!.id).not.toBe(a!.id);
    expect(b!.effects[0]!.id).not.toBe(a!.effects[0]!.id);
    const op = b!.effects[0]!.operation;
    expect(op.type === 'MODIFY' && op.appliesTo?.attackIds).toEqual([b!.id]);
    expect(errors(validateDraft({ ...pokemonDraft(), rules: dup }))).toEqual([]);
  });

  it('ED-017 · reordenar mantém identidade e custo', () => {
    let d = pokemonDraft();
    d = { ...d, rules: addAttack(d.rules, 'COIN_DAMAGE') };
    const before = d.rules.attacks.map((a) => [a.id, a.energyCost]);
    const moved = { ...d.rules, attacks: moveItem(d.rules.attacks, 1, 0) } as CardDefinition;
    expect(moved.attacks.map((a) => [a.id, a.energyCost])).toEqual([before[1], before[0]]);
    const change = diffRules(d.rules, moved);
    expect(change.some((c) => c.kind === 'MOVED')).toBe(true);
  });

  it('remover ataque remove os cenários dependentes', () => {
    let d = pokemonDraft();
    d = { ...d, testScenarios: [{ id: 's1', kind: 'ATTACK', attackId: d.rules.attacks[0]!.id, fixture: 'default', forcedCoins: [], expect: {} }] };
    expect(removeAttack(d, 0).testScenarios).toEqual([]);
  });

  it('a biblioteca de efeitos é exatamente o registro do motor; contínuos só oferecem opcodes C', () => {
    expect(OPCODE_LIBRARY.map((s) => s.type).sort()).toEqual([...OPCODES].sort());
    for (const s of opcodesForTiming('CONTINUOUS')) expect(s.continuous).toBe(true);
    for (const s of OPCODE_LIBRARY) expect(s.create().type).toBe(s.type);
  });

  it('cada opcode criado pela biblioteca compila num documento aceito pelo schema', () => {
    for (const spec of opcodesForTiming('POST_DAMAGE')) {
      const d = withAttack(pokemonDraft(), { effects: [{ id: 'blk', timing: 'POST_DAMAGE', operation: spec.create() }] });
      const def = compileDraft(d).definition;
      expect(cds(def), `${spec.type}: ${JSON.stringify(cds.errors)}`).toBe(true);
    }
  });
});

describe('histórico (ED-066)', () => {
  it('desfaz/refaz só o rascunho e agrupa digitação contínua', () => {
    let h = historyInit({ name: 'a' });
    h = historyPush(h, { name: 'ab' }, { coalesceKey: 'name', at: 100 });
    h = historyPush(h, { name: 'abc' }, { coalesceKey: 'name', at: 400 });
    expect(h.past).toHaveLength(1);
    h = historyPush(h, { name: 'abcd' }, { coalesceKey: 'hp', at: 500 });
    expect(canUndo(h)).toBe(true);
    h = historyUndo(h);
    expect(h.present).toEqual({ name: 'abc' });
    expect(canRedo(h)).toBe(true);
    h = historyRedo(h);
    expect(h.present).toEqual({ name: 'abcd' });
  });
});

describe('autosave (editor §27; persistencia §19)', () => {
  it('resposta atrasada da revisão N não marca N+1 como salva; conflito pede revisão', () => {
    let s = autosaveInit(3);
    s = markEdited(s);
    expect(canStartSave(s)).toBe(true);
    s = beginSave(s); // grava a edição 1 como revisão 4
    s = markEdited(s); // edição 2 chega durante a gravação
    expect(canStartSave(s)).toBe(false);
    s = saveSucceeded(s, 1, 4);
    expect(s.status).toBe('DIRTY');
    expect(hasUnsavedChanges(s)).toBe(true);
    s = beginSave(s);
    s = saveSucceeded(s, 2, 5);
    expect(s.status).toBe('SAVED');
    expect(s.headRevision).toBe(5);
    s = markEdited(s);
    s = beginSave(s);
    s = saveFailed(s, 3, true, 'head mudou');
    expect(s.status).toBe('CONFLICT');
    expect(canStartSave(s)).toBe(false);
  });
});

describe('balanceamento (editor §26)', () => {
  it('duas moedas × 40: 0/40/80 com 25/50/25% e valor esperado 40', () => {
    const attack = exampleDraft().rules.attacks.find((a) => a.id === 'ember-rain')!;
    const a = analyzeAttack(attack);
    expect(a.distribution).toEqual([{ value: 0, probability: 0.25 }, { value: 40, probability: 0.5 }, { value: 80, probability: 0.25 }]);
    expect(a.expected).toBe(40);
    expect(a.method).toContain('probabilidade binomial');
  });
});

describe('imagens (editor §18)', () => {
  it('ED-039/040 · aceita PNG estático; recusa APNG, GIF, SVG, executável disfarçado e excesso de pixels', () => {
    const png = tinyPng(3, 2);
    expect(sniffImage(png)).toEqual({ ok: true, mediaType: 'image/png', width: 3, height: 2 });
    const apng = tinyPng(2, 2, [0, 0, 0, 255], { type: 'acTL', data: new Uint8Array(8) });
    expect(sniffImage(apng)).toMatchObject({ ok: false, code: 'IMAGE_ANIMATED' });
    expect(sniffImage(new TextEncoder().encode('GIF89a....'))).toMatchObject({ ok: false, code: 'IMAGE_ANIMATED' });
    expect(sniffImage(new TextEncoder().encode('<svg onload="x()"></svg>'))).toMatchObject({ ok: false, code: 'IMAGE_ACTIVE_CONTENT' });
    expect(sniffImage(new TextEncoder().encode('MZ\x90\x00 fake.png'))).toMatchObject({ ok: false, code: 'IMAGE_DISGUISED' });
    const huge = tinyPng(2, 2);
    new DataView(huge.buffer).setUint32(16, 5000);
    expect(sniffImage(huge)).toMatchObject({ ok: false, code: 'IMAGE_TOO_LARGE' });
    expect(sniffImage(new Uint8Array(11 * 1024 * 1024))).toMatchObject({ ok: false, code: 'IMAGE_TOO_LARGE' });
  });

  it('JPEG e WebP: dimensões lidas do cabeçalho; WebP animado recusado', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x20, 0x00, 0x40, 0x03]);
    expect(sniffImage(jpeg)).toEqual({ ok: true, mediaType: 'image/jpeg', width: 64, height: 32 });
    const vp8x = new Uint8Array(30);
    vp8x.set(new TextEncoder().encode('RIFF'), 0);
    vp8x.set(new TextEncoder().encode('WEBPVP8X'), 8);
    vp8x[20] = 0x02;
    expect(sniffImage(vp8x)).toMatchObject({ ok: false, code: 'IMAGE_ANIMATED' });
    vp8x[20] = 0;
    vp8x[24] = 99; vp8x[27] = 49;
    expect(sniffImage(vp8x)).toEqual({ ok: true, mediaType: 'image/webp', width: 100, height: 50 });
  });

  it('ED-048 · máscara é luminância (branco permite, preto bloqueia)', () => {
    const gray = toMaskPixels(new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]));
    expect([...gray]).toEqual([255, 255, 255, 255, 0, 0, 0, 255]);
    expect(maskCoverage(gray)).toBe(0.5);
  });
});
