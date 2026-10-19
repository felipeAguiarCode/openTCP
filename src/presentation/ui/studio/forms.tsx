// Formulários de regras do Estúdio (editor-de-cartas.md §7–§17): identidade, evolução/atributos, regra
// especial (ex/Mega ex no MESMO campo ruleBox), ataques (custo → dano → efeitos → texto → teste isolado),
// Habilidades (ativada/contínua/disparada/substituição com limite de uso) e Treinadores (subtipo, condições,
// alvo de Ferramenta, comportamento de Fóssil). Em VARIANT todas as regras ficam somente leitura.
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { attackText, abilityText, TYPE_LABEL, STAGE_LABEL, SUBTYPE_LABEL, trainerText, catalogNames } from '../../../domain/cards/text.ts';
import type {
  Ability, AbilityKind, Attack, CardDefinition, CostType, EnergyCost, PokemonCard, PokemonType, RuleBox, TrainerCard, TrainerSubtype, UsageScope,
} from '../../../domain/cards/types.ts';
import { ENERGY_TYPES, POKEMON_TYPES, type EnergyType } from '../../../domain/cards/types.ts';
import { canPay } from '../../../domain/battle/derived.ts';
import { analyzeAttack } from '../../../domain/editor/balance.ts';
import {
  ABILITY_TIMING, addAbility, addAttack, ALLOWED_TRAINER_TIMINGS, allBlockIds, attackDependents, ATTACK_TEMPLATES, duplicateAttack, isFossilRules, moveItem, removeAttack,
  syncDerived, withAbilityKind, withBaseName, withCategory, withRuleBox, withTrainerSubtype, type AttackTemplate, type EditorDraft,
} from '../../../domain/editor/draft.ts';
import type { ValidationIssue } from '../../../domain/editor/validate.ts';
import { confirmDialog } from '../app/store.ts';
import { Button, Segmented, Toggle } from '../components/controls.tsx';
import { Icon, TypeIcon } from '../components/icons.tsx';
import {
  AdditionalCostsEditor, ConditionList, EffectBlocks, ENERGY_COST_TYPES, FormulaEditor, outputsBefore, PokemonFilterEditor, SelectorEditor, TriggerEditor,
} from './effects.tsx';
import { CheckField, Field, ListField, MultiChips, NumberField, pathKey, Section, SelectField, TextField, type Path } from './shared.tsx';

export type RulesSelection =
  | { readonly kind: 'IDENTITY' } | { readonly kind: 'POKEMON' } | { readonly kind: 'RULEBOX' } | { readonly kind: 'TRAINER' }
  | { readonly kind: 'ATTACK'; readonly index: number } | { readonly kind: 'ABILITY'; readonly index: number };

export type Updater = (fn: (d: EditorDraft) => EditorDraft, coalesceKey?: string) => void;

export type FormContext = {
  readonly draft: EditorDraft;
  readonly update: Updater;
  readonly locked: boolean;
  readonly issues: readonly ValidationIssue[];
  readonly catalog: readonly CardDefinition[];
  readonly onTestAttack?: (attackId: string) => void;
  readonly select: (s: RulesSelection) => void;
};

const opt = (value: string, label: string) => ({ value, label });
const TYPE_OPTIONS = POKEMON_TYPES.map((t) => opt(t, TYPE_LABEL[t]));
/** Nomes por chave de limite para o texto gerado (filtros por nome: “seu Muk ou Weezing”). */

function issueAt(issues: readonly ValidationIssue[], path: Path): string | null {
  const key = pathKey(path);
  const hit = issues.find((i) => pathKey(i.path) === key && i.severity !== 'INFO');
  return hit ? hit.message : null;
}

function setRules(ctx: FormContext, fn: (r: CardDefinition) => CardDefinition, key?: string): void {
  if (ctx.locked) return;
  ctx.update((d) => ({ ...d, rules: fn(d.rules) }), key);
}

// ---------------------------------------------------------------- estrutura (coluna esquerda)

export function StructureTree({ ctx, selection }: { readonly ctx: FormContext; readonly selection: RulesSelection }): JSX.Element {
  const rules = ctx.draft.rules;
  const pokemon = rules.category === 'POKEMON';
  const count = (prefix: Path) => ctx.issues.filter((i) => i.severity === 'ERROR' && pathKey(i.path).startsWith(pathKey(prefix))).length;
  const item = (s: RulesSelection, label: string, prefix: Path, extra?: JSX.Element) => {
    const active = s.kind === selection.kind && ('index' in s ? 'index' in selection && selection.index === s.index : true);
    const errors = count(prefix);
    return (
      <li>
        <button type="button" class={`studio-tree-item ${active ? 'is-active' : ''}`} aria-current={active ? 'true' : undefined} onClick={() => ctx.select(s)}>
          <span class="grow">{label}</span>
          {errors ? <span class="badge badge-danger" aria-label={`${errors} erro(s)`}>{errors}</span> : null}
          {extra}
        </button>
      </li>
    );
  };
  return (
    <nav class="studio-tree" aria-label="Estrutura da carta">
      <ul>
        {item({ kind: 'IDENTITY' }, 'Identidade', ['rules', 'baseName'])}
        {pokemon ? item({ kind: 'POKEMON' }, 'Evolução e atributos', ['rules', 'baseHp']) : null}
        {pokemon ? item({ kind: 'RULEBOX' }, 'Regra especial (ex)', ['rules', 'knockoutPoints']) : null}
        {pokemon ? <li class="studio-tree-group">Ataques</li> : null}
        {pokemon ? rules.attacks.map((a, i) => item({ kind: 'ATTACK', index: i }, `• ${a.name || `Ataque ${i + 1}`}`, ['rules', 'attacks', i])) : null}
        {pokemon && !ctx.locked ? (
          <li><Button size="sm" variant="ghost" icon="plus" disabledReason={rules.attacks.length >= 4 ? 'Limite de quatro ataques' : null} testId="add-attack"
            onClick={() => { setRules(ctx, (r) => addAttack(r)); ctx.select({ kind: 'ATTACK', index: rules.attacks.length }); }}>Ataque</Button></li>
        ) : null}
        {pokemon ? <li class="studio-tree-group">Habilidades</li> : null}
        {pokemon ? rules.abilities.map((a, i) => item({ kind: 'ABILITY', index: i }, `• ${a.name || `Habilidade ${i + 1}`}`, ['rules', 'abilities', i])) : null}
        {pokemon && !ctx.locked ? (
          <li><Button size="sm" variant="ghost" icon="plus" disabledReason={rules.abilities.length >= 4 ? 'Limite de quatro Habilidades' : null}
            onClick={() => { setRules(ctx, (r) => addAbility(r)); ctx.select({ kind: 'ABILITY', index: rules.abilities.length }); }}>Habilidade</Button></li>
        ) : null}
        {!pokemon ? item({ kind: 'TRAINER' }, 'Regras do Treinador', ['rules', 'trainerRules']) : null}
        {!pokemon ? item({ kind: 'TRAINER' }, 'Efeitos', ['rules', 'trainerEffects']) : null}
      </ul>
    </nav>
  );
}

// ---------------------------------------------------------------- identidade (§7)

export function IdentityForm({ ctx }: { readonly ctx: FormContext }): JSX.Element {
  const r = ctx.draft.rules;
  const changeCategory = async (category: 'POKEMON' | 'TRAINER') => {
    if (category === r.category) return;
    const ok = await confirmDialog({
      title: 'Trocar a categoria?', tone: 'danger', confirmLabel: 'Trocar categoria',
      body: ['A troca remove da carta os campos exclusivos da categoria atual (ataques, estágio, Treinador…).', 'O rascunho anterior continua no histórico (Desfazer e revisões).'],
    });
    if (ok) ctx.update((d) => withCategory(d, category));
  };
  return (
    <div class="stack">
      {ctx.locked ? <p class="studio-locked"><Icon name="lock" size={16} /> Projeto de variante: as regras ficam bloqueadas. Edite arte, acabamento e impressões.</p> : null}
      <TextField label="Nome-base" value={r.baseName ?? ''} max={50} path={['rules', 'baseName']} error={issueAt(ctx.issues, ['rules', 'baseName'])}
        hint="Nunca inclui “ex”: a regra especial deriva o nome exibido." onChange={(v) => setRules(ctx, (x) => withBaseName(x, v), 'baseName')} />
      <div class="studio-grid-2">
        <div class="sf"><span class="sf-label">Nome exibido (derivado)</span><output class="studio-derived" data-testid="derived-name">{r.name || '—'}</output></div>
        <div class="sf"><span class="sf-label">Chave de limite (2 cópias por nome)</span><output class="studio-derived">{r.deckLimitKey || '—'}</output></div>
        <div class="sf"><span class="sf-label">ID funcional</span><output class="studio-derived" title="Gerado e estável; não muda ao renomear.">{ctx.draft.target.definitionId} · v{ctx.draft.target.version}</output></div>
        <SelectField label="Categoria" value={r.category} options={[opt('POKEMON', 'Pokémon'), opt('TRAINER', 'Treinador')]} disabled={ctx.locked || ctx.draft.mode === 'NEW_VERSION'}
          onChange={(v) => void changeCategory(v as 'POKEMON' | 'TRAINER')} path={['rules', 'category']} hint={ctx.draft.mode === 'NEW_VERSION' ? 'Nova versão não troca a categoria.' : undefined} />
      </div>
      {r.category === 'TRAINER' ? (
        <SelectField label="Subtipo de Treinador" value={isFossilRules(r) ? 'FOSSIL' : r.subtype} path={['rules', 'subtype']}
          options={[...(['ITEM', 'SUPPORTER', 'TOOL', 'STADIUM'] as const).map((s) => opt(s, SUBTYPE_LABEL[s])), opt('FOSSIL', 'Fóssil (Item avançado)')]}
          onChange={(v) => setRules(ctx, (x) => withTrainerSubtype(x as TrainerCard, (v === 'FOSSIL' ? 'ITEM' : v) as TrainerSubtype, v === 'FOSSIL'))} />
      ) : null}
      <TextField label="Descrição temática" value={r.flavorText ?? ''} max={240} multiline path={['rules', 'flavorText']} hint="Sem efeito mecânico; renderizada como texto."
        onChange={(v) => setRules(ctx, (x) => ({ ...x, flavorText: v || undefined }) as CardDefinition, 'flavor')} />
      <ListField label="Etiquetas" values={r.tags ?? []} path={['rules', 'tags']} hint="Organização apenas: não criam regras e nunca contêm ex."
        onChange={(v) => setRules(ctx, (x) => ({ ...x, tags: v }) as CardDefinition, 'tags')} />
      <div class="studio-grid-2">
        <TextField label="Conjunto autoral padrão" value={ctx.draft.authoring.setId} max={40} path={['authoring', 'setId']} onChange={(v) => ctx.update((d) => ({ ...d, authoring: { ...d.authoring, setId: v } }), 'setId')} />
        <SelectField label="Idioma da impressão" value="pt-BR" options={[opt('pt-BR', 'Português (Brasil)')]} onChange={() => undefined} hint="Não muda IDs de regra." />
      </div>
      <TextField label="Notas de autoria (privadas)" value={ctx.draft.authoring.notes} max={4000} multiline path={['authoring', 'notes']}
        onChange={(v) => ctx.update((d) => ({ ...d, authoring: { ...d.authoring, notes: v } }), 'notes')} />
    </div>
  );
}

// ---------------------------------------------------------------- evolução e atributos (§8)

export function PokemonForm({ ctx }: { readonly ctx: FormContext }): JSX.Element {
  const r = ctx.draft.rules as PokemonCard;
  const [advanced, setAdvanced] = useState(r.weakness?.operation === 'MULTIPLY' || (r.types ?? []).length > 1);
  const set = (patch: Partial<PokemonCard>, key?: string) => setRules(ctx, (x) => ({ ...x, ...patch }) as CardDefinition, key);
  const sources = ctx.catalog.filter((d) => d.category === 'POKEMON' && d.id !== r.id && d.stage === (r.stage === 'STAGE_2' ? 'STAGE_1' : 'BASIC'));
  const keys = [...new Map(sources.map((d) => [d.deckLimitKey, d.name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const evolveError = issueAt(ctx.issues, ['rules', 'evolvesFrom']) ?? issueAt(ctx.issues, ['rules', 'evolvesFrom', 0]);
  return (
    <div class="stack">
      <div class="studio-grid-2">
        <SelectField label="Estágio" value={r.stage} options={(['BASIC', 'STAGE_1', 'STAGE_2'] as const).map((s) => opt(s, STAGE_LABEL[s]))} path={['rules', 'stage']}
          hint="Mega não cria um quarto estágio." onChange={(stage) => set({ stage: stage as PokemonCard['stage'], evolvesFrom: stage === 'BASIC' ? [] : r.evolvesFrom })} />
        <NumberField label="HP base" value={r.baseHp} min={10} max={9990} step={10} path={['rules', 'baseHp']} error={issueAt(ctx.issues, ['rules', 'baseHp'])}
          hint="10–9990, múltiplo de 10." onChange={(v) => set({ baseHp: v ?? 0 }, 'hp')} />
      </div>
      {r.stage !== 'BASIC' ? (
        <Field label="Evolui de" path={['rules', 'evolvesFrom']} error={evolveError} hint={keys.length ? 'Compatibilidade pela chave de nome; não aceita qualquer carta.' : 'Nenhuma carta do estágio anterior no catálogo local.'}>
          {(id) => (
            <select id={id} class="input" value={r.evolvesFrom[0] ?? ''} onChange={(e) => { const v = (e.target as HTMLSelectElement).value; set({ evolvesFrom: v ? [v] : [] }); }}>
              <option value="">— escolha a origem —</option>
              {keys.map(([key, name]) => <option key={key} value={key}>{name} ({key})</option>)}
              {r.evolvesFrom[0] && !keys.some(([k]) => k === r.evolvesFrom[0]) ? <option value={r.evolvesFrom[0]}>{r.evolvesFrom[0]} (sem carta no catálogo)</option> : null}
            </select>
          )}
        </Field>
      ) : null}
      <div class="studio-grid-2">
        <Field label="Tipo" path={['rules', 'types']} error={issueAt(ctx.issues, ['rules', 'types'])} hint="O tipo do Pokémon não define o custo dos ataques.">
          {(id) => (
            <select id={id} class="input" value={r.types[0] ?? ''} onChange={(e) => set({ types: [(e.target as HTMLSelectElement).value as PokemonType, ...r.types.slice(1)] })}>
              {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          )}
        </Field>
        <NumberField label="Recuo (Incolor)" value={r.retreatCost} min={0} max={10} path={['rules', 'retreatCost']} error={issueAt(ctx.issues, ['rules', 'retreatCost'])} onChange={(v) => set({ retreatCost: v ?? 0 }, 'retreat')} />
      </div>
      <Section title="Fraqueza" path={['rules', 'weakness']}>
        <div class="row">
          <Toggle label="Tem Fraqueza" checked={!!r.weakness} onChange={(on) => set({ weakness: on ? { type: 'WATER', operation: 'ADD', value: 20 } : null })} />
          {r.weakness ? (
            <>
              <SelectField label="Tipo" value={r.weakness.type} options={TYPE_OPTIONS} onChange={(type) => set({ weakness: { ...r.weakness!, type: type as PokemonType } })} />
              {advanced ? <SelectField label="Operação" value={r.weakness.operation} options={[opt('ADD', '+ (padrão)'), opt('MULTIPLY', '× (avançado)')]} onChange={(operation) => set({ weakness: { ...r.weakness!, operation: operation as 'ADD' | 'MULTIPLY', value: operation === 'MULTIPLY' ? 2 : 20 } })} /> : null}
              <NumberField label={r.weakness.operation === 'ADD' ? 'Valor (+)' : 'Multiplicador (×)'} value={r.weakness.value} min={1} max={r.weakness.operation === 'ADD' ? 100 : 4} step={r.weakness.operation === 'ADD' ? 10 : 1}
                onChange={(v) => set({ weakness: { ...r.weakness!, value: v ?? 20 } })} />
            </>
          ) : null}
        </div>
        <CheckField label="Modo avançado (Fraqueza ×, segundo tipo)" checked={advanced} onChange={setAdvanced} hint="Gera aviso de balanceamento; nunca é o padrão." />
        {advanced ? (
          <SelectField label="Segundo tipo (não publicável neste ruleset)" value={r.types[1] ?? ''} options={[opt('', 'Nenhum'), ...TYPE_OPTIONS]} path={['rules', 'types', 1]}
            onChange={(v) => set({ types: v ? [r.types[0] ?? 'COLORLESS', v as PokemonType] : r.types.slice(0, 1) })} />
        ) : null}
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------- regra especial (§9)

const RULEBOX_TEXT: Record<RuleBox, string> = {
  NONE: 'Comum: ao ser Nocauteado, normalmente entrega 1 ponto.',
  EX: 'ex: ao ser Nocauteado, normalmente entrega 2 pontos.',
  MEGA_EX: 'Mega ex: ao ser Nocauteado, normalmente entrega 3 pontos. O estágio e a evolução continuam definidos acima.',
};

export function RuleBoxForm({ ctx }: { readonly ctx: FormContext }): JSX.Element {
  const r = ctx.draft.rules as PokemonCard;
  const [mega, setMega] = useState(r.ruleBox === 'MEGA_EX');
  const apply = (ruleBox: RuleBox) => { if (!ctx.locked) ctx.update((d) => withRuleBox(d, ruleBox)); };
  return (
    <div class="stack" data-path="rules.ruleBox">
      <Toggle label="Carta ex" checked={r.ruleBox !== 'NONE'} onChange={(on) => apply(on ? (mega ? 'MEGA_EX' : 'EX') : 'NONE')}
        hint="Muda nome, chave de limite e pontos. Não liga foil, não altera raridade e não aumenta dano." />
      <CheckField label="Mega ex (avançado)" checked={mega} onChange={(on) => { setMega(on); if (r.ruleBox !== 'NONE') apply(on ? 'MEGA_EX' : 'EX'); }} />
      <p class="studio-callout">{RULEBOX_TEXT[r.ruleBox]}</p>
      <div class="studio-grid-2">
        <div class="sf"><span class="sf-label">Pontos por Nocaute (derivado)</span><output class="studio-derived" data-testid="knockout-points">{r.knockoutPoints}</output></div>
        <div class="sf"><span class="sf-label">Nome exibido</span><output class="studio-derived">{r.name}</output></div>
      </div>
      {ctx.draft.mode !== 'NEW_DEFINITION' ? <small class="muted">Em carta já publicada, mudar a regra especial exige uma cópia autoral (fork): nome, limite e pontos mudam.</small> : null}
    </div>
  );
}

// ---------------------------------------------------------------- custo de Energia (§11)

export function CostEditor({ cost, onChange, path, readOnly }: { readonly cost: EnergyCost; readonly onChange: (c: EnergyCost) => void; readonly path: Path; readonly readOnly?: boolean }): JSX.Element {
  const total = Object.values(cost).reduce((s, n) => s + (n ?? 0), 0);
  const bump = (t: CostType, d: number) => {
    const next = { ...cost, [t]: Math.max(0, Math.min(10, (cost[t] ?? 0) + d)) };
    if (!next[t]) delete next[t];
    onChange(next);
  };
  const colorless = cost.COLORLESS ?? 0;
  return (
    <div class="studio-cost" data-path={pathKey(path)}>
      <ul class="studio-cost-grid">
        {ENERGY_COST_TYPES.map((t) => (
          <li key={t} class={(cost[t] ?? 0) > 0 ? 'is-on' : ''}>
            <TypeIcon type={t as PokemonType} size={20} label={false} />
            <span class="grow">{TYPE_LABEL[t as PokemonType]}</span>
            <Button size="sm" variant="ghost" label={`Remover ${TYPE_LABEL[t as PokemonType]}`} disabledReason={readOnly ? 'Bloqueado' : (cost[t] ?? 0) === 0 ? 'Já é zero' : null} onClick={() => bump(t, -1)}>−</Button>
            <output aria-label={`${TYPE_LABEL[t as PokemonType]}: ${cost[t] ?? 0}`}>{cost[t] ?? 0}</output>
            <Button size="sm" variant="ghost" label={`Adicionar ${TYPE_LABEL[t as PokemonType]}`} disabledReason={readOnly ? 'Bloqueado' : (cost[t] ?? 0) >= 10 ? 'Máximo 10 por tipo' : null} onClick={() => bump(t, 1)}>+</Button>
          </li>
        ))}
      </ul>
      <p class="studio-cost-summary" role="status">
        {total === 0 ? 'Sem custo de Energia.' : `Total ${total}: ${total - colorless} específica(s) + ${colorless} Incolor (aceita qualquer tipo).`}
      </p>
      <CostTester cost={cost} />
    </div>
  );
}

/** “Testar combinações” (§11, ED-019): monte Energias ligadas e veja se pagam o custo pela mesma regra do motor. */
function CostTester({ cost }: { readonly cost: EnergyCost }): JSX.Element {
  const [attached, setAttached] = useState<EnergyType[]>([]);
  const ok = canPay(attached.map((type) => ({ type, units: 1 })), cost);
  return (
    <details class="studio-cost-tester">
      <summary>Testar uma combinação de Energias ligadas</summary>
      <div class="row">
        {ENERGY_TYPES.map((t) => (
          <Button key={t} size="sm" variant="ghost" label={`Ligar ${TYPE_LABEL[t]}`} disabledReason={attached.length >= 20 ? 'Até 20' : null} onClick={() => setAttached([...attached, t])}>
            <TypeIcon type={t} size={18} label={false} /> {TYPE_LABEL[t]}
          </Button>
        ))}
      </div>
      <div class="row">
        <span class="small">Ligadas:</span>
        {attached.length ? attached.map((t, i) => (
          <button key={i} type="button" class="chip" aria-label={`Remover ${TYPE_LABEL[t]}`} onClick={() => setAttached(attached.filter((_, k) => k !== i))}>{TYPE_LABEL[t]} ×</button>
        )) : <span class="small muted">nenhuma</span>}
        <span class={`badge ${ok ? 'badge-done' : 'badge-danger'}`} role="status">{ok ? 'Paga o custo' : 'Não paga o custo'}</span>
      </div>
    </details>
  );
}

// ---------------------------------------------------------------- ataques (§10, §12, §15)

export function AttackForm({ ctx, index }: { readonly ctx: FormContext; readonly index: number }): JSX.Element {
  const rules = ctx.draft.rules;
  const a = rules.attacks[index];
  if (!a) return <p class="muted">Ataque inexistente.</p>;
  const path: Path = ['rules', 'attacks', index];
  const set = (patch: Partial<Attack>, key?: string) => setRules(ctx, (r) => ({ ...r, attacks: r.attacks.map((x, i) => (i === index ? { ...x, ...patch } : x)) }) as CardDefinition, key);
  const mode = a.damageFormula ? 'FORMULA' : (a.baseDamage ?? 0) > 0 ? 'FIXED' : 'NONE';
  const setMode = (m: string) => {
    if (m === 'FIXED') set({ baseDamage: a.baseDamage && a.baseDamage > 0 ? a.baseDamage : 20, damageFormula: null, damageTarget: a.damageTarget ?? { scope: 'OPPONENT_ACTIVE' } });
    else if (m === 'NONE') set({ baseDamage: 0, damageFormula: null, damageTarget: null });
    else {
      const coins = outputsBefore(a.effects, a.effects.length, true).find((x) => x.kind === 'COINS');
      set({ baseDamage: null, damageTarget: a.damageTarget ?? { scope: 'OPPONENT_ACTIVE' },
        damageFormula: coins ? { op: 'MULTIPLY', operands: [{ op: 'CONST', value: 20 }, { op: 'COUNT_HEADS', reference: coins.id }] } : { op: 'MULTIPLY', operands: [{ op: 'CONST', value: 10 }, { op: 'COUNT_ATTACHED_ENERGIES', selector: { scope: 'SELF' } }] } });
    }
  };
  const remove = async () => {
    const deps = attackDependents(ctx.draft, a.id);
    const ok = await confirmDialog({
      title: `Remover “${a.name}”?`, tone: 'danger', confirmLabel: 'Remover ataque',
      body: deps.length ? ['Este ataque é referenciado por:', ...deps.map((d) => `• ${d.where}`), 'Os cenários dependentes também serão removidos.'] : ['O ataque sai do rascunho (Desfazer recupera).'],
    });
    if (!ok) return;
    ctx.update((d) => removeAttack(d, index));
    ctx.select(index > 0 ? { kind: 'ATTACK', index: index - 1 } : { kind: 'IDENTITY' });
  };
  const analysis = (() => { try { return analyzeAttack(a); } catch { return null; } })();
  let text = '';
  try { text = attackText(a, { nameOf: catalogNames(ctx.catalog) }); } catch { text = ''; }
  const preOutputs = outputsBefore(a.effects, a.effects.length, true);
  return (
    <div class="stack" data-path={pathKey(path)}>
      <div class="row-between">
        <TextField label="Nome do ataque" value={a.name} max={40} path={[...path, 'name']} error={issueAt(ctx.issues, [...path, 'name'])} onChange={(v) => set({ name: v }, `attack-name-${index}`)} />
        {!ctx.locked ? (
          <div class="row">
            <Button size="sm" variant="ghost" label="Mover para cima" disabledReason={index === 0 ? 'Já é o primeiro' : null} onClick={() => { setRules(ctx, (r) => ({ ...r, attacks: moveItem(r.attacks, index, index - 1) }) as CardDefinition); ctx.select({ kind: 'ATTACK', index: index - 1 }); }}>↑</Button>
            <Button size="sm" variant="ghost" label="Mover para baixo" disabledReason={index === rules.attacks.length - 1 ? 'Já é o último' : null} onClick={() => { setRules(ctx, (r) => ({ ...r, attacks: moveItem(r.attacks, index, index + 1) }) as CardDefinition); ctx.select({ kind: 'ATTACK', index: index + 1 }); }}>↓</Button>
            <Button size="sm" variant="ghost" disabledReason={rules.attacks.length >= 4 ? 'Limite de quatro ataques' : null} onClick={() => { setRules(ctx, (r) => duplicateAttack(r, index)); ctx.select({ kind: 'ATTACK', index: index + 1 }); }}>Duplicar</Button>
            <Button size="sm" variant="ghost" icon="trash" label="Remover ataque" onClick={() => void remove()} />
          </div>
        ) : null}
      </div>
      <Section title="1 · Custo de Energia" path={[...path, 'energyCost']} tone="cost">
        <CostEditor cost={a.energyCost} readOnly={ctx.locked} onChange={(energyCost) => set({ energyCost })} path={[...path, 'energyCost']} />
        {issueAt(ctx.issues, [...path, 'energyCost']) ? <p class="field-error">{issueAt(ctx.issues, [...path, 'energyCost'])}</p> : null}
      </Section>
      <Section title="2 · Para usar este ataque" path={[...path, 'additionalCosts']} tone="cost">
        <small class="muted">Custos adicionais podem impedir a declaração se não puderem ser pagos. Diferente dos efeitos depois do ataque.</small>
        <AdditionalCostsEditor title="Custos adicionais" values={a.additionalCosts} onChange={(additionalCosts) => set({ additionalCosts })} path={[...path, 'additionalCosts']} />
        <ConditionList label="Condições de uso" values={a.preconditions} onChange={(preconditions) => set({ preconditions })} path={[...path, 'preconditions']} outputs={[]} />
      </Section>
      <Section title="3 · Dano" path={[...path, 'baseDamage']}>
        <Segmented label="Tipo de dano" value={mode} onChange={setMode} options={[{ id: 'FIXED', label: 'Fixo' }, { id: 'FORMULA', label: 'Fórmula' }, { id: 'NONE', label: 'Sem dano direto' }]} />
        {mode === 'FIXED' ? <NumberField label="Dano" value={a.baseDamage} min={0} max={9990} step={10} path={[...path, 'baseDamage']} error={issueAt(ctx.issues, [...path, 'baseDamage'])} onChange={(v) => set({ baseDamage: v ?? 0 }, `dmg-${index}`)} /> : null}
        {mode === 'FORMULA' && a.damageFormula ? (
          <div class="stack">
            <small class="muted">Moedas usadas na fórmula vêm de blocos “Antes do dano” com nome de saída. Fraqueza e modificadores são aplicados depois pelo motor.</small>
            <FormulaEditor value={a.damageFormula} onChange={(damageFormula) => set({ damageFormula })} path={[...path, 'damageFormula']} outputs={preOutputs} />
            {issueAt(ctx.issues, [...path, 'damageFormula']) ? <p class="field-error">{issueAt(ctx.issues, [...path, 'damageFormula'])}</p> : null}
          </div>
        ) : null}
        {mode !== 'NONE' ? <SelectorEditor label="Alvo do dano principal" value={a.damageTarget} onChange={(damageTarget) => set({ damageTarget })} path={[...path, 'damageTarget']} outputs={preOutputs} /> : null}
        {analysis?.distribution && analysis.distribution.length > 1 ? (
          <p class="studio-callout">Distribuição (moedas justas): {analysis.distribution.map((d) => `${d.value} (${Math.round(d.probability * 100)}%)`).join(' · ')} — esperado {Math.round(analysis.expected ?? 0)}.</p>
        ) : null}
      </Section>
      <Section title="4 · Efeitos" path={[...path, 'effects']} tone="effect">
        <EffectBlocks title="Antes / depois do dano" blocks={a.effects} onChange={(effects) => set({ effects })} path={[...path, 'effects']} timings={['PRE_DAMAGE', 'POST_DAMAGE']}
          ownerId={a.id} takenIds={allBlockIds(rules)} readOnly={ctx.locked} help="Depois que o ataque acontece: efeitos seguem a política de resolução (falha parcial)." />
        <CheckField label="Atacar encerra o turno" checked={a.endsTurn} onChange={(endsTurn) => set({ endsTurn })} path={[...path, 'endsTurn']} />
        <SelectField label="Apresentação (não altera regras)" value={a.presentation?.presetId ?? ''} options={[opt('ATTACK_STANDARD', 'Ataque padrão'), opt('ATTACK_SPECIAL', 'Ataque especial')]}
          onChange={(presetId) => set({ presentation: { ...(a.presentation ?? {}), presetId: presetId as 'ATTACK_STANDARD' | 'ATTACK_SPECIAL' } })} />
      </Section>
      <Section title="5 · Texto gerado">
        <p class="studio-rules-text" data-testid="attack-text">{text || 'Sem texto adicional: só o dano impresso.'}</p>
      </Section>
      {ctx.onTestAttack ? <Button icon="play" onClick={() => ctx.onTestAttack?.(a.id)}>Testar este ataque no laboratório</Button> : null}
    </div>
  );
}

export function AttackTemplatePicker({ ctx }: { readonly ctx: FormContext }): JSX.Element | null {
  if (ctx.locked || ctx.draft.rules.category !== 'POKEMON') return null;
  return (
    <details class="studio-templates">
      <summary>Adicionar ataque a partir de um modelo</summary>
      <div class="row">
        {ATTACK_TEMPLATES.map((t) => (
          <Button key={t.id} size="sm" onClick={() => { const index = ctx.draft.rules.attacks.length; setRules(ctx, (r) => addAttack(r, t.id as AttackTemplate)); ctx.select({ kind: 'ATTACK', index }); }}>{t.label}</Button>
        ))}
      </div>
    </details>
  );
}

// ---------------------------------------------------------------- Habilidades (§16)

const KIND_LABEL: Record<AbilityKind, string> = { ACTIVATED: 'Ativada (botão Usar)', CONTINUOUS: 'Contínua (sem botão)', TRIGGERED: 'Disparada (gatilho)', REPLACEMENT: 'Prevenção/substituição' };
const SCOPE_LABEL: Record<UsageScope, string> = {
  INSTANCE_TURN: 'Por Pokémon, por turno', NAME_TURN: 'Por nome, por turno', PLAYER_TURN: 'Por jogador, por turno', INSTANCE_MATCH: 'Por Pokémon, por partida', PLAYER_MATCH: 'Por jogador, por partida',
  UNLIMITED: 'Quantas vezes quiser no turno',
};
const SCOPE_EXAMPLE: Record<UsageScope, string> = {
  INSTANCE_TURN: 'Duas cópias no Banco: cada uma pode usar uma vez no turno.',
  NAME_TURN: 'Duas cópias no Banco: só uma delas usa no turno (o limite é do nome).',
  PLAYER_TURN: 'Somadas todas as fontes, o jogador usa uma vez no turno.',
  UNLIMITED: 'Sem limite: a Habilidade pode ser usada várias vezes no mesmo turno (Vaporeon, Dusknoir).',
  INSTANCE_MATCH: 'Cada cópia usa uma vez na partida inteira.',
  PLAYER_MATCH: 'O jogador usa uma vez na partida inteira, qualquer cópia.',
};

export function AbilityForm({ ctx, index }: { readonly ctx: FormContext; readonly index: number }): JSX.Element {
  const rules = ctx.draft.rules;
  const ab = rules.abilities[index];
  if (!ab) return <p class="muted">Habilidade inexistente.</p>;
  const path: Path = ['rules', 'abilities', index];
  // Atualização funcional sobre a Habilidade atual (nunca sobre a cópia do último render).
  const setWith = (fn: (a: Ability) => Ability, key?: string) => setRules(ctx, (r) => ({ ...r, abilities: r.abilities.map((x, i) => (i === index ? fn(x) : x)) }) as CardDefinition, key);
  const set = (patch: Partial<Ability>, key?: string) => setWith((x) => ({ ...x, ...patch }), key);
  let text = '';
  try { text = abilityText(ab, { nameOf: catalogNames(ctx.catalog) }); } catch { text = ''; }
  return (
    <div class="stack" data-path={pathKey(path)}>
      <div class="row-between">
        <TextField label="Nome da Habilidade" value={ab.name} max={40} path={[...path, 'name']} error={issueAt(ctx.issues, [...path, 'name'])} onChange={(name) => set({ name }, `ability-name-${index}`)} />
        {!ctx.locked ? <Button size="sm" variant="ghost" icon="trash" label="Remover Habilidade" onClick={() => { setRules(ctx, (r) => ({ ...r, abilities: r.abilities.filter((_, i) => i !== index) }) as CardDefinition); ctx.select({ kind: 'IDENTITY' }); }} /> : null}
      </div>
      <SelectField label="Tipo" value={ab.kind} options={(Object.keys(KIND_LABEL) as AbilityKind[]).map((k) => opt(k, KIND_LABEL[k]))} path={[...path, 'kind']} onChange={(kind) => setWith((x) => withAbilityKind(x, kind as AbilityKind))} />
      <MultiChips label="Posições da fonte" values={ab.sourcePositions} options={[opt('ACTIVE', 'Ativo'), opt('BENCH', 'Banco')]} path={[...path, 'sourcePositions']} onChange={(v) => set({ sourcePositions: v as Ability['sourcePositions'] })} />
      {ab.kind === 'TRIGGERED' && ab.trigger ? <Section title="Gatilho" path={[...path, 'trigger']}><TriggerEditor value={ab.trigger} onChange={(trigger) => set({ trigger })} path={[...path, 'trigger']} /></Section> : null}
      {ab.kind === 'ACTIVATED' ? (
        <Section title="Limite de uso" path={[...path, 'usageLimit']}>
          <div class="studio-grid-2">
            <SelectField label="Escopo" value={ab.usageLimit?.scope ?? 'INSTANCE_TURN'} options={(Object.keys(SCOPE_LABEL) as UsageScope[]).map((s) => opt(s, SCOPE_LABEL[s]))}
              onChange={(scope) => set({ usageLimit: { scope: scope as UsageScope, count: ab.usageLimit?.count ?? 1 } })} />
            <NumberField label="Vezes" value={ab.usageLimit?.count ?? 1} min={1} max={10} onChange={(count) => set({ usageLimit: { scope: ab.usageLimit?.scope ?? 'INSTANCE_TURN', count: Math.max(1, count ?? 1) } })} />
          </div>
          <p class="studio-callout">{SCOPE_EXAMPLE[ab.usageLimit?.scope ?? 'INSTANCE_TURN']}</p>
          <CheckField label="Usar encerra o turno" checked={ab.endsTurn} onChange={(endsTurn) => set({ endsTurn })} hint="O jogo alerta antes de confirmar." />
        </Section>
      ) : null}
      {ab.kind === 'TRIGGERED' ? <CheckField label="Opcional (o controlador pode recusar)" checked={!!ab.optional} onChange={(optional) => set({ optional })} /> : null}
      {ab.kind === 'CONTINUOUS' ? <p class="studio-callout">Habilidade contínua não cria botão “Usar”: contribui enquanto a fonte estiver nas posições indicadas.</p> : null}
      <ConditionList label="Condições" values={ab.conditions} onChange={(conditions) => set({ conditions })} path={[...path, 'conditions']} outputs={[]} />
      <AdditionalCostsEditor title="Custos para ativar" values={ab.costs} onChange={(costs) => set({ costs })} path={[...path, 'costs']} />
      <EffectBlocks title="Efeitos" blocks={ab.effects} onChange={(effects) => set({ effects })} path={[...path, 'effects']} timings={[ABILITY_TIMING[ab.kind]]} ownerId={ab.id} takenIds={allBlockIds(rules)} readOnly={ctx.locked} />
      <Section title="Texto gerado"><p class="studio-rules-text">{text}</p></Section>
    </div>
  );
}

// ---------------------------------------------------------------- Treinadores (§17)

export function TrainerForm({ ctx }: { readonly ctx: FormContext }): JSX.Element {
  const t = ctx.draft.rules as TrainerCard;
  const fossil = isFossilRules(t);
  const kind = fossil ? 'FOSSIL' : t.subtype;
  const setT = (patch: Partial<TrainerCard>) => setRules(ctx, (r) => syncDerived({ ...r, ...patch } as CardDefinition));
  const rules = t.trainerRules ?? { playConditions: [], destinationAfterPlay: 'DISCARD' };
  let text = '';
  try { text = trainerText(t, { nameOf: catalogNames(ctx.catalog) }); } catch { text = ''; }
  const destination: Record<string, string> = { DISCARD: 'Descarte após resolver', ATTACHED_TOOL: 'Fica ligada ao Pokémon', STADIUM_SLOT: 'Ocupa o espaço de Estádio', BENCH_AS_POKEMON: 'Banco como Pokémon (Fóssil)' };
  return (
    <div class="stack">
      <p class="studio-callout">{kind === 'SUPPORTER' ? 'Apoiador: o limite de 1 por turno vem do ruleset e não é editável na carta.'
        : kind === 'STADIUM' ? 'Estádio: efeito compartilhado pelos dois jogadores; não é um playmat decorativo.'
          : kind === 'TOOL' ? 'Ferramenta: efeitos contínuos/disparados enquanto ligada; teste a perda de HP com dano acumulado.'
            : kind === 'FOSSIL' ? 'Fóssil: Item jogado no Banco como Pokémon; não é Básico para a mão inicial.' : 'Item: efeitos ao jogar; descarte após resolver.'}</p>
      <div class="sf"><span class="sf-label">Destino após jogar (derivado do subtipo)</span><output class="studio-derived">{destination[rules.destinationAfterPlay]}</output></div>
      <ConditionList label="Condições para jogar" values={rules.playConditions} path={['rules', 'trainerRules', 'playConditions']} outputs={[]}
        onChange={(playConditions) => setT({ trainerRules: { ...rules, playConditions } })} />
      {kind === 'TOOL' ? (
        <Section title="Pode ser ligada a" path={['rules', 'trainerRules', 'toolTarget']}>
          <PokemonFilterEditor value={rules.toolTarget} onChange={(toolTarget) => setT({ trainerRules: { ...rules, toolTarget: toolTarget ?? {} } })} path={['rules', 'trainerRules', 'toolTarget']} />
        </Section>
      ) : null}
      {fossil && rules.fieldBehavior ? (
        <Section title="Comportamento em campo" path={['rules', 'trainerRules', 'fieldBehavior']}>
          <NumberField label="HP em campo" value={rules.fieldBehavior.hp} min={10} max={500} step={10} onChange={(hp) => setT({ trainerRules: { ...rules, fieldBehavior: { ...rules.fieldBehavior!, hp: hp ?? 40 } } })} />
          <CheckField label="O dono pode descartá-lo na fase principal" checked={!!rules.fieldBehavior.ownerMayDiscardDuringMainPhase}
            onChange={(v) => setT({ trainerRules: { ...rules, fieldBehavior: { ...rules.fieldBehavior!, ownerMayDiscardDuringMainPhase: v } } })} />
          <small class="muted">Não recua, não ataca e entrega 1 ponto ao ser Nocauteado (fixos pela DSL).</small>
        </Section>
      ) : null}
      <EffectBlocks title="Efeitos" blocks={t.trainerEffects ?? []} onChange={(trainerEffects) => setT({ trainerEffects })} path={['rules', 'trainerEffects']}
        timings={ALLOWED_TRAINER_TIMINGS[kind]} ownerId={t.id || 'treinador'} takenIds={allBlockIds(t)} readOnly={ctx.locked} />
      <Section title="Texto gerado"><p class="studio-rules-text">{text}</p></Section>
    </div>
  );
}

export function RulesForm({ ctx, selection }: { readonly ctx: FormContext; readonly selection: RulesSelection }): JSX.Element {
  const rules = ctx.draft.rules;
  if (selection.kind === 'POKEMON' && rules.category === 'POKEMON') return <PokemonForm ctx={ctx} />;
  if (selection.kind === 'RULEBOX' && rules.category === 'POKEMON') return <RuleBoxForm ctx={ctx} />;
  if (selection.kind === 'ATTACK' && rules.category === 'POKEMON') return <AttackForm key={selection.index} ctx={ctx} index={selection.index} />;
  if (selection.kind === 'ABILITY' && rules.category === 'POKEMON') return <AbilityForm key={selection.index} ctx={ctx} index={selection.index} />;
  if (selection.kind === 'TRAINER' && rules.category === 'TRAINER') return <TrainerForm ctx={ctx} />;
  return (
    <div class="stack">
      <IdentityForm ctx={ctx} />
      <AttackTemplatePicker ctx={ctx} />
    </div>
  );
}

/** Seleção da estrutura a partir do caminho de um problema (“Ir para o campo”). */
export function selectionForPath(path: Path): RulesSelection {
  if (path[0] !== 'rules') return { kind: 'IDENTITY' };
  const k = path[1];
  if (k === 'attacks' && typeof path[2] === 'number') return { kind: 'ATTACK', index: path[2] };
  if (k === 'abilities' && typeof path[2] === 'number') return { kind: 'ABILITY', index: path[2] };
  if (k === 'trainerRules' || k === 'trainerEffects') return { kind: 'TRAINER' };
  if (k === 'ruleBox' || k === 'knockoutPoints') return { kind: 'RULEBOX' };
  if (k === 'stage' || k === 'evolvesFrom' || k === 'types' || k === 'baseHp' || k === 'retreatCost' || k === 'weakness') return { kind: 'POKEMON' };
  return { kind: 'IDENTITY' };
}
