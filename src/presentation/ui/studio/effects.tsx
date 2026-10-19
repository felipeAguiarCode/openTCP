// Construtor visual de efeitos (editor-de-cartas.md §12–§16; efeitos-dsl.md): blocos com quando / o quê /
// em quem / quanto / quem escolhe / duração, gerados a partir do registro de opcodes do motor (opcodes.ts).
// Fórmulas e condições são árvores de dados tipadas (nunca texto avaliado). Mover blocos tem alternativa
// por botão (Subir/Descer) além do arrastar; um opcode fora do registro aparece como indisponível.
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { blockText, CONDITION_LABEL, STAGE_LABEL, SUBTYPE_LABEL, TYPE_LABEL } from '../../../domain/cards/text.ts';
import type {
  AdditionalCost, CardFilter, Condition, Duration, EffectBlock, Formula, Operation, PokemonFilter, Selector, SelectorScope, Timing, Trigger,
} from '../../../domain/cards/types.ts';
import { CONDITIONS, ENERGY_TYPES, POKEMON_TYPES } from '../../../domain/cards/types.ts';
import { moveItem, uniqueId } from '../../../domain/editor/draft.ts';
import {
  DURATION_OPTIONS, ENERGY_OPTIONS, opcodesByFamily, opcodeSpec, REMOVE_ON_OPTIONS, SCOPE_OPTIONS, TIMING_LABEL, type Option, type ParamKind, type ParamSpec,
} from '../../../domain/editor/opcodes.ts';
import { Button } from '../components/controls.tsx';
import { CheckField, Field, ListField, MultiChips, NumberField, pathKey, SelectField, TextField, type Path } from './shared.tsx';

const o = (value: string, label: string): Option => ({ value, label });
const TYPE_OPTIONS: Option[] = POKEMON_TYPES.map((t) => o(t, TYPE_LABEL[t]));
const STAGE_OPTIONS: Option[] = (['BASIC', 'STAGE_1', 'STAGE_2'] as const).map((s) => o(s, STAGE_LABEL[s]));
const RULEBOX_OPTIONS: Option[] = [o('NONE', 'Comum'), o('EX', 'ex'), o('MEGA_EX', 'Mega ex')];
const SUBTYPE_OPTIONS: Option[] = (['ITEM', 'SUPPORTER', 'TOOL', 'STADIUM'] as const).map((s) => o(s, SUBTYPE_LABEL[s]));
const CONDITION_OPTIONS: Option[] = CONDITIONS.map((c) => o(c, CONDITION_LABEL[c]));
const ZONE_OPTIONS: Option[] = [o('OWN_HAND', 'Sua mão'), o('OPPONENT_HAND', 'Mão do oponente'), o('OWN_DECK', 'Seu baralho'), o('OPPONENT_DECK', 'Baralho do oponente'), o('OWN_DISCARD', 'Seu descarte'), o('OPPONENT_DISCARD', 'Descarte do oponente')];

/** Saídas nomeadas visíveis num ponto (para COUNT_HEADS, OUTPUT_COUNT e seletor OUTPUT). */
export type OutputsInScope = readonly { readonly id: string; readonly kind: 'COINS' | 'TARGETS' }[];

// ---------------------------------------------------------------- filtros

export function PokemonFilterEditor({ value, onChange, path }: { readonly value: PokemonFilter | undefined; readonly onChange: (v: PokemonFilter | undefined) => void; readonly path: Path }): JSX.Element {
  const f = value ?? {};
  const set = <K extends keyof PokemonFilter>(k: K, v: PokemonFilter[K] | undefined) => {
    const next = { ...f, [k]: v } as Record<string, unknown>;
    if (v === undefined || (Array.isArray(v) && v.length === 0) || v === false) delete next[k];
    onChange(Object.keys(next).length ? (next as PokemonFilter) : undefined);
  };
  return (
    <div class="studio-subform" data-path={pathKey(path)}>
      <MultiChips label="Tipos" values={f.types ?? []} options={TYPE_OPTIONS} onChange={(v) => set('types', v as PokemonFilter['types'])} />
      <MultiChips label="Estágios" values={f.stages ?? []} options={STAGE_OPTIONS} onChange={(v) => set('stages', v as PokemonFilter['stages'])} />
      <MultiChips label="Regra especial" values={f.ruleBoxes ?? []} options={RULEBOX_OPTIONS} onChange={(v) => set('ruleBoxes', v as PokemonFilter['ruleBoxes'])} />
      <MultiChips label="Posições" values={f.positions ?? []} options={[o('ACTIVE', 'Ativo'), o('BENCH', 'Banco')]} onChange={(v) => set('positions', v as PokemonFilter['positions'])} />
      <div class="row">
        <CheckField label="Com dano" checked={!!f.hasDamage} onChange={(v) => set('hasDamage', v || undefined)} />
        <CheckField label="Com Ferramenta" checked={!!f.hasTool} onChange={(v) => set('hasTool', v || undefined)} />
        <CheckField label="Com Energia" checked={!!f.hasEnergy} onChange={(v) => set('hasEnergy', v || undefined)} />
        <CheckField label="Exceto esta carta" checked={!!f.excludeSelf} onChange={(v) => set('excludeSelf', v || undefined)} />
        <CheckField label="Exceto Fósseis" checked={!!f.excludeFossils} onChange={(v) => set('excludeFossils', v || undefined)} />
      </div>
      <ListField label="Nomes (chave de limite)" values={f.deckLimitKeys ?? []} onChange={(v) => set('deckLimitKeys', v)} hint="Ex.: faisca — um por linha." />
    </div>
  );
}

export function CardFilterEditor({ value, onChange, path }: { readonly value: CardFilter | undefined; readonly onChange: (v: CardFilter | undefined) => void; readonly path: Path }): JSX.Element {
  const f = value ?? {};
  const set = <K extends keyof CardFilter>(k: K, v: CardFilter[K] | undefined) => {
    const next = { ...f, [k]: v } as Record<string, unknown>;
    if (v === undefined || (Array.isArray(v) && v.length === 0) || v === false) delete next[k];
    onChange(Object.keys(next).length ? (next as CardFilter) : undefined);
  };
  return (
    <div class="studio-subform" data-path={pathKey(path)}>
      <MultiChips label="Categorias" values={f.categories ?? []} options={[o('POKEMON', 'Pokémon'), o('TRAINER', 'Treinador')]} onChange={(v) => set('categories', v as CardFilter['categories'])} />
      <MultiChips label="Subtipos" values={f.subtypes ?? []} options={SUBTYPE_OPTIONS} onChange={(v) => set('subtypes', v as CardFilter['subtypes'])} />
      <MultiChips label="Estágios" values={f.stages ?? []} options={STAGE_OPTIONS} onChange={(v) => set('stages', v as CardFilter['stages'])} />
      <MultiChips label="Tipos" values={f.types ?? []} options={TYPE_OPTIONS} onChange={(v) => set('types', v as CardFilter['types'])} />
      <div class="row">
        <CheckField label="Evolui do alvo" checked={!!f.evolvesFromTarget} onChange={(v) => set('evolvesFromTarget', v || undefined)} />
        <CheckField label="Exceto Fósseis" checked={!!f.excludeFossils} onChange={(v) => set('excludeFossils', v || undefined)} />
      </div>
      <ListField label="Nomes (chave de limite)" values={f.deckLimitKeys ?? []} onChange={(v) => set('deckLimitKeys', v)} />
    </div>
  );
}

// ---------------------------------------------------------------- seletor (DSL §3)

export function SelectorEditor({ label, value, onChange, path, outputs, allowNull, nullLabel }: {
  readonly label: string; readonly value: Selector | null; readonly onChange: (v: Selector | null) => void; readonly path: Path; readonly outputs: OutputsInScope;
  readonly allowNull?: boolean; readonly nullLabel?: string;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const scopes = allowNull ? [o('', nullLabel ?? 'Nenhum'), ...SCOPE_OPTIONS] : SCOPE_OPTIONS;
  const s = value;
  const pick = s?.pick;
  const setSel = (next: Partial<Selector>) => {
    if (!s) return;
    const merged = { ...s, ...next } as Record<string, unknown>;
    for (const k of Object.keys(merged)) if (merged[k] === undefined) delete merged[k];
    onChange(merged as Selector);
  };
  return (
    <fieldset class="studio-selector" data-path={pathKey(path)}>
      <legend class="sf-label">{label}</legend>
      <div class="row">
        <select class="input" aria-label={`${label}: escopo`} value={s?.scope ?? ''} onChange={(e) => {
          const scope = (e.target as HTMLSelectElement).value as SelectorScope | '';
          onChange(scope ? { ...(s ?? {}), scope } as Selector : null);
        }}>{scopes.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select>
        {s ? <Button size="sm" variant="ghost" onClick={() => setOpen(!open)}>{open ? 'Menos opções' : 'Filtro e escolha'}</Button> : null}
      </div>
      {s?.scope === 'OUTPUT' ? (
        <SelectField label="Saída anterior" value={s.ref ?? ''} options={outputs.filter((x) => x.kind === 'TARGETS').map((x) => o(x.id, x.id))} onChange={(ref) => setSel({ ref })} path={[...path, 'ref']} />
      ) : null}
      {s && open ? (
        <div class="stack">
          <Field label="Quem escolhe / cardinalidade" path={[...path, 'pick']}>
            {(id) => (
              <select id={id} class="input" value={pick ? `${pick.mode}${pick.mode === 'CHOOSE' ? `:${pick.chooser}` : ''}` : ''} onChange={(e) => {
                const v = (e.target as HTMLSelectElement).value;
                if (!v) setSel({ pick: undefined });
                else if (v === 'ALL') setSel({ pick: { mode: 'ALL' } });
                else if (v === 'RANDOM') setSel({ pick: { mode: 'RANDOM', count: 1 } });
                else setSel({ pick: { mode: 'CHOOSE', chooser: v.endsWith('OPPONENT') ? 'OPPONENT' : 'CONTROLLER', min: pick?.mode === 'CHOOSE' ? pick.min : 1, max: pick?.mode === 'CHOOSE' ? pick.max : 1 } });
              }}>
                <option value="">Padrão do escopo</option>
                <option value="ALL">Todos os elegíveis</option>
                <option value="CHOOSE:CONTROLLER">Você escolhe</option>
                <option value="CHOOSE:OPPONENT">O oponente escolhe</option>
                <option value="RANDOM">Sorteio</option>
              </select>
            )}
          </Field>
          {pick?.mode === 'CHOOSE' ? (
            <div class="row">
              <NumberField label="Mínimo" value={pick.min} min={0} max={6} onChange={(v) => setSel({ pick: { ...pick, min: Math.max(0, v ?? 0) } })} path={[...path, 'pick', 'min']} />
              <NumberField label="Máximo" value={pick.max} min={1} max={6} onChange={(v) => setSel({ pick: { ...pick, max: Math.max(1, v ?? 1) } })} path={[...path, 'pick', 'max']} />
            </div>
          ) : null}
          {pick?.mode === 'RANDOM' ? <NumberField label="Quantidade sorteada" value={pick.count} min={1} max={6} onChange={(v) => setSel({ pick: { mode: 'RANDOM', count: Math.max(1, v ?? 1) } })} /> : null}
          <PokemonFilterEditor value={s.filter} onChange={(filter) => setSel({ filter })} path={[...path, 'filter']} />
          <TextField label="Guardar escolhidos como (saída)" value={s.outputId ?? ''} onChange={(v) => setSel({ outputId: v.trim() || undefined })} max={120} path={[...path, 'outputId']} hint="Opcional: usado depois por “Saída nomeada anterior”." />
        </div>
      ) : null}
    </fieldset>
  );
}

// ---------------------------------------------------------------- fórmulas (DSL §4)

const FORMULA_OPS: Option[] = [
  o('CONST', 'Valor fixo'), o('ADD', 'Soma'), o('SUBTRACT', 'Subtração'), o('MULTIPLY', 'Multiplicação'), o('MIN', 'Mínimo'), o('MAX', 'Máximo'), o('CLAMP', 'Limitar (valor, mín, máx)'),
  o('COUNT_HEADS', 'Número de caras'), o('COUNT_TAILS', 'Número de coroas'), o('COUNT_ATTACHED_ENERGIES', 'Energias ligadas (anexos)'),
  o('COUNT_PROVIDED_ENERGY_UNITS', 'Unidades de Energia fornecidas'), o('COUNT_BENCH_POKEMON', 'Pokémon no Banco'), o('COUNT_POKEMON', 'Pokémon que atendem a um seletor'),
  o('COUNT_CARDS', 'Cartas numa zona'), o('DAMAGE_ON_SOURCE', 'Dano acumulado na fonte'), o('DAMAGE_ON_TARGET', 'Dano acumulado no alvo'), o('POINTS', 'Pontos'),
  o('OUTPUT_COUNT', 'Quantidade numa saída nomeada'), o('EXTRA_ENERGY_UNITS', 'Energia extra além do custo do ataque'),
  o('DAMAGE_DEALT_BY_ATTACK', 'Dano causado por este ataque'),
];
const NARY = new Set(['ADD', 'SUBTRACT', 'MULTIPLY', 'MIN', 'MAX', 'CLAMP']);

function freshFormula(op: Formula['op'], prev: Formula | null): Formula {
  if (op === 'CONST') return { op, value: prev?.op === 'CONST' ? prev.value ?? 0 : 10 };
  if (NARY.has(op)) {
    const keep = prev && NARY.has(prev.op) ? prev.operands ?? [] : prev ? [prev] : [];
    const need = op === 'CLAMP' ? 3 : 2;
    const operands = [...keep, ...Array.from({ length: Math.max(0, need - keep.length) }, () => ({ op: 'CONST', value: 0 }) as Formula)].slice(0, op === 'SUBTRACT' ? 2 : op === 'CLAMP' ? 3 : 8);
    return { op, operands };
  }
  if (op === 'COUNT_HEADS' || op === 'COUNT_TAILS' || op === 'OUTPUT_COUNT') return { op, reference: '' };
  if (op === 'COUNT_ATTACHED_ENERGIES' || op === 'COUNT_PROVIDED_ENERGY_UNITS' || op === 'COUNT_POKEMON') return { op, selector: { scope: 'SELF' } };
  if (op === 'COUNT_BENCH_POKEMON' || op === 'POINTS') return { op, side: 'OWN' };
  if (op === 'COUNT_CARDS') return { op, zone: 'OWN_HAND' };
  return { op };
}

export function FormulaEditor({ value, onChange, path, outputs, depth = 0 }: {
  readonly value: Formula; readonly onChange: (v: Formula) => void; readonly path: Path; readonly outputs: OutputsInScope; readonly depth?: number;
}): JSX.Element {
  const f = value;
  const set = (patch: Partial<Formula>) => {
    const merged = { ...f, ...patch } as Record<string, unknown>;
    for (const k of Object.keys(merged)) if (merged[k] === undefined) delete merged[k];
    onChange(merged as Formula);
  };
  return (
    <div class={`studio-formula depth-${Math.min(depth, 4)}`} data-path={pathKey(path)}>
      <div class="row">
        <select class="input" aria-label="Operador da fórmula" value={f.op} onChange={(e) => onChange(freshFormula((e.target as HTMLSelectElement).value as Formula['op'], f))}>
          {FORMULA_OPS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
        </select>
        {f.op === 'CONST' ? <input class="input sf-small" type="number" aria-label="Valor" value={f.value ?? 0} onInput={(e) => set({ value: Math.trunc(Number((e.target as HTMLInputElement).value) || 0) })} /> : null}
        {(f.op === 'COUNT_HEADS' || f.op === 'COUNT_TAILS' || f.op === 'OUTPUT_COUNT') ? (
          <select class="input" aria-label="Referência" value={f.reference ?? ''} onChange={(e) => set({ reference: (e.target as HTMLSelectElement).value })}>
            <option value="">— escolha uma saída anterior —</option>
            {outputs.filter((x) => (f.op === 'OUTPUT_COUNT' ? true : x.kind === 'COINS')).map((x) => <option key={x.id} value={x.id}>{x.id}</option>)}
            {f.reference && !outputs.some((x) => x.id === f.reference) ? <option value={f.reference}>{f.reference} (inexistente)</option> : null}
          </select>
        ) : null}
        {(f.op === 'COUNT_BENCH_POKEMON' || f.op === 'POINTS') ? (
          <select class="input" aria-label="Lado" value={f.side ?? 'OWN'} onChange={(e) => set({ side: (e.target as HTMLSelectElement).value as Formula['side'] })}>
            <option value="OWN">Seu</option><option value="OPPONENT">Do oponente</option>{f.op === 'COUNT_BENCH_POKEMON' ? <option value="BOTH">Ambos</option> : null}
          </select>
        ) : null}
        {f.op === 'COUNT_CARDS' ? (
          <select class="input" aria-label="Zona" value={f.zone ?? 'OWN_HAND'} onChange={(e) => set({ zone: (e.target as HTMLSelectElement).value as Formula['zone'] })}>
            {ZONE_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
          </select>
        ) : null}
        {(f.op === 'COUNT_ATTACHED_ENERGIES' || f.op === 'COUNT_PROVIDED_ENERGY_UNITS' || f.op === 'EXTRA_ENERGY_UNITS') ? (
          <select class="input" aria-label="Tipo de Energia" value={f.energyType ?? ''} onChange={(e) => set({ energyType: ((e.target as HTMLSelectElement).value || undefined) as Formula['energyType'] })}>
            <option value="">Qualquer tipo</option>{ENERGY_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
          </select>
        ) : null}
      </div>
      {f.selector ? <SelectorEditor label="De quem (lido no momento da resolução)" value={f.selector} onChange={(s) => set({ selector: s ?? { scope: 'SELF' } })} path={[...path, 'selector']} outputs={outputs} /> : null}
      {f.op === 'COUNT_CARDS' ? <CardFilterEditor value={f.filter} onChange={(filter) => set({ filter })} path={[...path, 'filter']} /> : null}
      {NARY.has(f.op) ? (
        <div class="studio-operands">
          {(f.operands ?? []).map((x, i) => (
            <div class="row studio-operand" key={i}>
              <FormulaEditor value={x} onChange={(v) => set({ operands: (f.operands ?? []).map((y, k) => (k === i ? v : y)) })} path={[...path, 'operands', i]} outputs={outputs} depth={depth + 1} />
              {(f.operands ?? []).length > (f.op === 'CLAMP' ? 3 : 2) ? <Button size="sm" variant="ghost" icon="trash" label="Remover operando" onClick={() => set({ operands: (f.operands ?? []).filter((_, k) => k !== i) })} /> : null}
            </div>
          ))}
          {f.op !== 'SUBTRACT' && f.op !== 'CLAMP' && depth < 5 ? <Button size="sm" icon="plus" onClick={() => set({ operands: [...(f.operands ?? []), { op: 'CONST', value: 0 }] })}>Operando</Button> : null}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- condições (DSL §5)

const CONDITION_OPS: Option[] = [
  o('COMPARE', 'Comparar valores'), o('ALL', 'Todas verdadeiras'), o('ANY', 'Alguma verdadeira'), o('NOT', 'Negação'), o('EXISTS', 'Existe Pokémon'),
  o('CARDS_EXIST', 'Existem cartas numa zona'), o('SOURCE_POSITION', 'Posição da fonte'), o('HAS_CONDITION', 'Tem Condição Especial'), o('IS_TURN_OF', 'Turno de'),
];
const CMP_OPTIONS: Option[] = [o('GE', '≥'), o('GT', '>'), o('EQ', '='), o('NE', '≠'), o('LE', '≤'), o('LT', '<')];

function freshCondition(op: Condition['op'], outputs: OutputsInScope): Condition {
  switch (op) {
    case 'COMPARE': { const coin = outputs.find((x) => x.kind === 'COINS'); return { op, left: coin ? { op: 'COUNT_HEADS', reference: coin.id } : { op: 'CONST', value: 0 }, cmp: 'GE', right: { op: 'CONST', value: 1 } }; }
    case 'ALL': case 'ANY': return { op, conditions: [{ op: 'SOURCE_POSITION', position: 'ACTIVE' }] };
    case 'NOT': return { op, condition: { op: 'SOURCE_POSITION', position: 'ACTIVE' } };
    case 'EXISTS': return { op, selector: { scope: 'OWN_BENCH' } };
    case 'CARDS_EXIST': return { op, zone: 'OWN_HAND', count: 1 };
    case 'SOURCE_POSITION': return { op, position: 'ACTIVE' };
    case 'HAS_CONDITION': return { op, selector: { scope: 'OPPONENT_ACTIVE' }, condition: 'ANY' };
    case 'IS_TURN_OF': return { op, side: 'OWN' };
    default: return { op: 'SOURCE_POSITION', position: 'ACTIVE' };
  }
}

export function ConditionEditor({ value, onChange, path, outputs, depth = 0 }: {
  readonly value: Condition; readonly onChange: (v: Condition) => void; readonly path: Path; readonly outputs: OutputsInScope; readonly depth?: number;
}): JSX.Element {
  const c = value;
  const set = (patch: Partial<Condition>) => onChange({ ...c, ...patch } as Condition);
  return (
    <div class="studio-condition" data-path={pathKey(path)}>
      <select class="input" aria-label="Tipo de condição" value={c.op} onChange={(e) => onChange(freshCondition((e.target as HTMLSelectElement).value as Condition['op'], outputs))}>
        {CONDITION_OPS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
      </select>
      {c.op === 'COMPARE' ? (
        <div class="stack">
          <FormulaEditor value={c.left ?? { op: 'CONST', value: 0 }} onChange={(left) => set({ left })} path={[...path, 'left']} outputs={outputs} depth={depth + 1} />
          <select class="input sf-small" aria-label="Comparação" value={c.cmp ?? 'GE'} onChange={(e) => set({ cmp: (e.target as HTMLSelectElement).value as Condition['cmp'] })}>
            {CMP_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
          </select>
          <FormulaEditor value={c.right ?? { op: 'CONST', value: 0 }} onChange={(right) => set({ right })} path={[...path, 'right']} outputs={outputs} depth={depth + 1} />
        </div>
      ) : null}
      {(c.op === 'ALL' || c.op === 'ANY') ? (
        <div class="studio-operands">
          {(c.conditions ?? []).map((x, i) => (
            <div class="row" key={i}>
              <ConditionEditor value={x} onChange={(v) => set({ conditions: (c.conditions ?? []).map((y, k) => (k === i ? v : y)) })} path={[...path, 'conditions', i]} outputs={outputs} depth={depth + 1} />
              <Button size="sm" variant="ghost" icon="trash" label="Remover condição" onClick={() => set({ conditions: (c.conditions ?? []).filter((_, k) => k !== i) })} />
            </div>
          ))}
          {depth < 4 ? <Button size="sm" icon="plus" onClick={() => set({ conditions: [...(c.conditions ?? []), { op: 'SOURCE_POSITION', position: 'ACTIVE' }] })}>Condição</Button> : null}
        </div>
      ) : null}
      {c.op === 'NOT' && typeof c.condition === 'object' ? <ConditionEditor value={c.condition} onChange={(condition) => set({ condition })} path={[...path, 'condition']} outputs={outputs} depth={depth + 1} /> : null}
      {(c.op === 'EXISTS' || c.op === 'HAS_CONDITION') ? <SelectorEditor label="Pokémon" value={c.selector ?? { scope: 'OPPONENT_ACTIVE' }} onChange={(s) => set({ selector: s ?? { scope: 'OPPONENT_ACTIVE' } })} path={[...path, 'selector']} outputs={outputs} /> : null}
      {c.op === 'HAS_CONDITION' ? (
        <SelectField label="Condição" value={(typeof c.condition === 'string' ? c.condition : 'ANY') as string} options={[o('ANY', 'Qualquer'), ...CONDITION_OPTIONS]} onChange={(v) => set({ condition: v as Condition['condition'] })} />
      ) : null}
      {c.op === 'CARDS_EXIST' ? (
        <div class="stack">
          <SelectField label="Zona" value={c.zone ?? 'OWN_HAND'} options={ZONE_OPTIONS} onChange={(zone) => set({ zone: zone as Condition['zone'] })} />
          <NumberField label="Pelo menos" value={c.count ?? 1} min={1} max={20} onChange={(v) => set({ count: Math.max(1, v ?? 1) })} />
          <CardFilterEditor value={c.filter} onChange={(filter) => set({ filter })} path={[...path, 'filter']} />
        </div>
      ) : null}
      {c.op === 'SOURCE_POSITION' ? <SelectField label="Posição" value={c.position ?? 'ACTIVE'} options={[o('ACTIVE', 'Ativo'), o('BENCH', 'Banco')]} onChange={(position) => set({ position: position as Condition['position'] })} /> : null}
      {c.op === 'IS_TURN_OF' ? <SelectField label="Turno de" value={c.side ?? 'OWN'} options={[o('OWN', 'Você'), o('OPPONENT', 'Oponente')]} onChange={(side) => set({ side: side as Condition['side'] })} /> : null}
    </div>
  );
}

export function ConditionList({ label, values, onChange, path, outputs, hint }: {
  readonly label: string; readonly values: readonly Condition[]; readonly onChange: (v: Condition[]) => void; readonly path: Path; readonly outputs: OutputsInScope; readonly hint?: string;
}): JSX.Element {
  return (
    <div class="stack" data-path={pathKey(path)}>
      <div class="row-between"><strong>{label}</strong><Button size="sm" icon="plus" onClick={() => onChange([...values, { op: 'SOURCE_POSITION', position: 'ACTIVE' }])}>Condição</Button></div>
      {hint ? <small class="muted">{hint}</small> : null}
      {values.length === 0 ? <small class="muted">Nenhuma.</small> : null}
      {values.map((c, i) => (
        <div class="row studio-card-row" key={i}>
          <ConditionEditor value={c} onChange={(v) => onChange(values.map((x, k) => (k === i ? v : x)))} path={[...path, i]} outputs={outputs} />
          <Button size="sm" variant="ghost" icon="trash" label="Remover condição" onClick={() => onChange(values.filter((_, k) => k !== i))} />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- duração e custos

export function DurationEditor({ value, onChange, path }: { readonly value: Duration; readonly onChange: (v: Duration) => void; readonly path: Path }): JSX.Element {
  return (
    <div class="stack" data-path={pathKey(path)}>
      <SelectField label="Duração" value={value.kind} options={DURATION_OPTIONS} onChange={(kind) => onChange({ ...value, kind: kind as Duration['kind'] })} />
      <MultiChips label="Remover quando" values={value.removeOn ?? []} options={REMOVE_ON_OPTIONS} onChange={(removeOn) => {
        const next = { ...value, removeOn: removeOn as Duration['removeOn'] } as Record<string, unknown>;
        if (!removeOn.length) delete next.removeOn;
        onChange(next as Duration);
      }} />
    </div>
  );
}

export function AdditionalCostsEditor({ values, onChange, path, title }: { readonly values: readonly AdditionalCost[]; readonly onChange: (v: AdditionalCost[]) => void; readonly path: Path; readonly title: string }): JSX.Element {
  return (
    <div class="stack" data-path={pathKey(path)}>
      <div class="row-between">
        <strong>{title}</strong>
        <div class="row">
          <Button size="sm" icon="plus" onClick={() => onChange([...values, { type: 'DISCARD_ENERGY', from: 'SELF', energyType: 'ANY', count: 1 }])}>Descartar Energia</Button>
          <Button size="sm" icon="plus" onClick={() => onChange([...values, { type: 'DISCARD_HAND_CARDS', count: 1 }])}>Descartar da mão</Button>
        </div>
      </div>
      {values.length === 0 ? <small class="muted">Nenhum custo adicional: o custo é só a Energia ligada (que continua ligada após usar).</small> : null}
      {values.map((c, i) => (
        <div class="row studio-card-row" key={i} data-path={pathKey([...path, i])}>
          {c.type === 'DISCARD_ENERGY' ? (
            <>
              <span>Descartar</span>
              <NumberField label="Quantidade" value={c.count} min={1} max={10} onChange={(v) => onChange(values.map((x, k) => (k === i ? { ...c, count: Math.max(1, v ?? 1) } : x)))} />
              <SelectField label="Tipo" value={c.energyType} options={[o('ANY', 'Qualquer'), ...ENERGY_OPTIONS]} onChange={(energyType) => onChange(values.map((x, k) => (k === i ? { ...c, energyType: energyType as typeof c.energyType } : x)))} />
              <span>Energia(s) deste Pokémon</span>
            </>
          ) : (
            <>
              <span>Descartar</span>
              <NumberField label="Cartas da mão" value={c.count} min={1} max={10} onChange={(v) => onChange(values.map((x, k) => (k === i ? { ...c, count: Math.max(1, v ?? 1) } : x)))} />
            </>
          )}
          <Button size="sm" variant="ghost" icon="trash" label="Remover custo" onClick={() => onChange(values.filter((_, k) => k !== i))} />
        </div>
      ))}
    </div>
  );
}

const TRIGGER_EVENTS: Option[] = [
  o('POKEMON_ENTERED', 'Pokémon entra em jogo'), o('POKEMON_EVOLVED', 'Pokémon evolui'), o('POKEMON_MOVED', 'Pokémon muda de posição'), o('ENERGY_ATTACHED', 'Energia ligada'),
  o('ATTACK_DECLARED', 'Ataque declarado'), o('DAMAGE_APPLIED', 'Dano aplicado'), o('CONDITION_APPLIED', 'Condição aplicada'), o('POKEMON_KNOCKED_OUT', 'Pokémon Nocauteado'),
  o('TRAINER_PLAYED', 'Treinador jogado'), o('TURN_STARTED', 'Início de turno'), o('TURN_ENDING', 'Fim de turno'),
];

export function TriggerEditor({ value, onChange, path }: { readonly value: Trigger; readonly onChange: (v: Trigger) => void; readonly path: Path }): JSX.Element {
  const f = value.filter ?? {};
  const setF = (k: string, v: unknown) => {
    const next = { ...f, [k]: v } as Record<string, unknown>;
    if (v === '' || v === undefined) delete next[k];
    onChange({ ...value, ...(Object.keys(next).length ? { filter: next as Trigger['filter'] } : { filter: undefined }) });
  };
  return (
    <div class="stack" data-path={pathKey(path)}>
      <SelectField label="Evento" value={value.event} options={TRIGGER_EVENTS} onChange={(event) => onChange({ ...value, event: event as Trigger['event'] })} path={[...path, 'event']} />
      <div class="studio-grid-2">
        <SelectField label="Sujeito" value={(f.subject ?? '') as string} options={[o('SELF', 'Este Pokémon'), o('OWN_POKEMON', 'Seus Pokémon'), o('OPPONENT_POKEMON', 'Pokémon do oponente'), o('ANY_POKEMON', 'Qualquer Pokémon')]} onChange={(v) => setF('subject', v)} />
        <SelectField label="Papel do sujeito" value={(f.subjectRole ?? '') as string} options={[o('TARGET', 'Alvo'), o('SOURCE', 'Origem')]} onChange={(v) => setF('subjectRole', v)} />
        <SelectField label="Turno de" value={(f.turnOf ?? '') as string} options={[o('OWN', 'Você'), o('OPPONENT', 'Oponente')]} onChange={(v) => setF('turnOf', v)} />
        <SelectField label="Vindo de" value={(f.from ?? '') as string} options={[o('HAND', 'Mão'), o('DECK', 'Baralho'), o('DISCARD', 'Descarte')]} onChange={(v) => setF('from', v)} />
        <SelectField label="Origem da Energia" value={(f.energySource ?? '') as string} options={[o('ENERGY_ZONE', 'Zona de Energia'), o('DISCARD', 'Descarte'), o('EFFECT', 'Efeito')]} onChange={(v) => setF('energySource', v)} />
        <SelectField label="Modo de ligação" value={(f.attachmentMode ?? '') as string} options={[o('MANUAL', 'Manual'), o('CARD_EFFECT', 'Efeito de carta')]} onChange={(v) => setF('attachmentMode', v)} />
        <SelectField label="Categoria do dano" value={(f.damageCategory ?? '') as string} options={[o('ATTACK', 'Ataque'), o('EFFECT', 'Efeito'), o('CONDITION', 'Condição')]} onChange={(v) => setF('damageCategory', v)} />
        <SelectField label="Condição" value={(f.condition ?? '') as string} options={CONDITION_OPTIONS} onChange={(v) => setF('condition', v)} />
      </div>
      <Button size="sm" variant="ghost" onClick={() => onChange({ event: value.event })}>Limpar filtro do gatilho</Button>
    </div>
  );
}

// ---------------------------------------------------------------- formulário da operação (registro de opcodes)

function ParamEditor({ spec, value, onChange, path, outputs, timing }: {
  readonly spec: ParamSpec; readonly value: unknown; readonly onChange: (v: unknown) => void; readonly path: Path; readonly outputs: OutputsInScope; readonly timing: Timing;
}): JSX.Element | null {
  const p: ParamKind = spec.param;
  const label = `${spec.label}${spec.required ? '' : ' (opcional)'}`;
  switch (p.kind) {
    case 'selector': return <SelectorEditor label={label} value={(value as Selector | undefined) ?? null} onChange={(v) => onChange(v ?? (spec.required ? { scope: p.defaultScope } : undefined))} path={path} outputs={outputs} allowNull={!spec.required} />;
    case 'int': return <NumberField label={label} value={typeof value === 'number' ? value : null} min={p.min} max={p.max} allowEmpty={!spec.required} onChange={(v) => onChange(v ?? undefined)} path={path} hint={spec.help} />;
    case 'amount': {
      const mode = value === 'ALL' ? 'ALL' : typeof value === 'object' && value !== null ? 'FORMULA' : 'NUMBER';
      return (
        <div class="stack" data-path={pathKey(path)}>
          <div class="row">
            <span class="sf-label">{label}</span>
            <select class="input sf-small" aria-label={`${spec.label}: modo`} value={mode} onChange={(e) => {
              const m = (e.target as HTMLSelectElement).value;
              onChange(m === 'ALL' ? 'ALL' : m === 'FORMULA' ? { op: 'CONST', value: typeof value === 'number' ? value : 10 } : typeof value === 'object' && value && (value as Formula).op === 'CONST' ? (value as Formula).value ?? 0 : 10);
            }}>
              <option value="NUMBER">Número</option>
              {p.formula ? <option value="FORMULA">Fórmula</option> : null}
              {p.all ? <option value="ALL">Tudo</option> : null}
            </select>
            {mode === 'NUMBER' ? <input class="input sf-small" type="number" min={p.min} max={p.max} aria-label={spec.label} value={typeof value === 'number' ? value : 0} onInput={(e) => onChange(Math.trunc(Number((e.target as HTMLInputElement).value) || 0))} /> : null}
          </div>
          {mode === 'FORMULA' ? <FormulaEditor value={value as Formula} onChange={onChange} path={path} outputs={outputs} /> : null}
        </div>
      );
    }
    case 'enum': return <SelectField label={label} value={(value as string | undefined) ?? ''} options={p.options} onChange={(v) => onChange(v)} path={path} hint={spec.help} />;
    case 'multiEnum': return <MultiChips label={label} values={(value as string[] | undefined) ?? []} options={p.options} onChange={(v) => onChange(v.length || p.min > 0 ? v : undefined)} path={path} />;
    case 'conditionsOrAll': {
      const all = value === 'ALL';
      return (
        <div class="stack" data-path={pathKey(path)}>
          <CheckField label="Todas as condições" checked={all} onChange={(v) => onChange(v ? 'ALL' : ['POISONED'])} />
          {!all ? <MultiChips label={label} values={(value as string[] | undefined) ?? []} options={CONDITION_OPTIONS} onChange={(v) => onChange(v)} /> : null}
        </div>
      );
    }
    case 'bool': return <CheckField label={spec.label} checked={value === true} onChange={(v) => onChange(spec.key === 'untilTails' ? (v ? true : undefined) : v ? true : spec.required ? false : undefined)} path={path} hint={spec.help} />;
    case 'text': return <TextField label={label} value={(value as string | undefined) ?? ''} max={p.maxLength} onChange={(v) => onChange(v)} path={path} hint={spec.help} />;
    case 'duration': return <DurationEditor value={(value as Duration | undefined) ?? { kind: 'THIS_TURN' }} onChange={onChange} path={path} />;
    case 'cardFilter': return <div class="stack"><span class="sf-label">{label}</span><CardFilterEditor value={value as CardFilter | undefined} onChange={(v) => onChange(v ?? (spec.required ? {} : undefined))} path={path} /></div>;
    case 'pokemonFilter': return <div class="stack"><span class="sf-label">{label}</span><PokemonFilterEditor value={value as PokemonFilter | undefined} onChange={(v) => onChange(v ?? (spec.required ? {} : undefined))} path={path} /></div>;
    case 'condition': return <div class="stack"><span class="sf-label">{label}</span><ConditionEditor value={(value as Condition | undefined) ?? { op: 'SOURCE_POSITION', position: 'ACTIVE' }} onChange={onChange} path={path} outputs={outputs} /></div>;
    case 'operations': return <OperationList label={label} values={(value as Operation[] | undefined) ?? []} min={p.min} max={p.max} onChange={(v) => onChange(v.length || p.min > 0 ? v : undefined)} path={path} outputs={outputs} timing={timing} />;
    case 'idList': return <ListField label={label} values={(value as string[] | undefined) ?? []} onChange={(v) => onChange(v.length ? v : undefined)} path={path} hint="IDs de ataque, um por linha." />;
    case 'object': {
      const obj = (value as Record<string, unknown> | undefined) ?? {};
      return (
        <fieldset class="studio-subform" data-path={pathKey(path)}>
          <legend class="sf-label">{label}</legend>
          {p.fields.map((f) => (
            <ParamEditor key={f.key} spec={f} value={obj[f.key]} path={[...path, f.key]} outputs={outputs} timing={timing} onChange={(v) => {
              const next = { ...obj, [f.key]: v };
              if (v === undefined) delete next[f.key];
              onChange(Object.keys(next).length ? next : undefined);
            }} />
          ))}
        </fieldset>
      );
    }
    default: return null;
  }
}

export function OperationForm({ value, onChange, path, outputs, timing }: {
  readonly value: Operation; readonly onChange: (v: Operation) => void; readonly path: Path; readonly outputs: OutputsInScope; readonly timing: Timing;
}): JSX.Element {
  const spec = opcodeSpec(value.type);
  if (!spec) {
    return (
      <div class="studio-unavailable" role="alert" data-path={pathKey([...path, 'type'])}>
        <strong>Efeito indisponível para publicação</strong>
        <p>“{String((value as { type?: unknown }).type)}” não existe no registro do motor desta versão. Escolha outro efeito; texto livre não desbloqueia opcodes.</p>
      </div>
    );
  }
  const record = value as unknown as Record<string, unknown>;
  return (
    <div class="stack">
      <small class="muted">{spec.help}</small>
      {spec.params.map((p) => (
        <ParamEditor key={p.key} spec={p} value={record[p.key]} path={[...path, p.key]} outputs={outputs} timing={timing} onChange={(v) => {
          const next = { ...record, [p.key]: v };
          if (v === undefined) delete next[p.key];
          onChange(next as unknown as Operation);
        }} />
      ))}
    </div>
  );
}

function OpcodePicker({ value, timing, onChange, label = 'Operação' }: { readonly value: string; readonly timing: Timing; readonly onChange: (op: Operation) => void; readonly label?: string }): JSX.Element {
  const groups = opcodesByFamily(timing);
  return (
    <select class="input" aria-label={label} value={value} onChange={(e) => {
      const spec = opcodeSpec((e.target as HTMLSelectElement).value);
      if (spec) onChange(spec.create());
    }}>
      {!opcodeSpec(value) ? <option value={value}>{value} (indisponível)</option> : null}
      {groups.map((g) => <optgroup key={g.family} label={g.label}>{g.specs.map((s) => <option key={s.type} value={s.type}>{s.label}</option>)}</optgroup>)}
    </select>
  );
}

function OperationList({ label, values, onChange, path, outputs, timing, min, max }: {
  readonly label: string; readonly values: readonly Operation[]; readonly onChange: (v: Operation[]) => void; readonly path: Path; readonly outputs: OutputsInScope; readonly timing: Timing; readonly min: number; readonly max: number;
}): JSX.Element {
  return (
    <fieldset class="studio-subform" data-path={pathKey(path)}>
      <legend class="sf-label">{label}</legend>
      {values.map((op, i) => (
        <div class="studio-nested-op" key={i}>
          <div class="row">
            <OpcodePicker value={op.type} timing={timing} onChange={(next) => onChange(values.map((x, k) => (k === i ? next : x)))} />
            {values.length > min ? <Button size="sm" variant="ghost" icon="trash" label="Remover operação" onClick={() => onChange(values.filter((_, k) => k !== i))} /> : null}
          </div>
          <OperationForm value={op} onChange={(next) => onChange(values.map((x, k) => (k === i ? next : x)))} path={[...path, i]} outputs={outputs} timing={timing} />
        </div>
      ))}
      {values.length < max ? <Button size="sm" icon="plus" onClick={() => onChange([...values, { type: 'DRAW_CARDS', player: 'OWN', count: 1 }])}>Operação</Button> : null}
    </fieldset>
  );
}

// ---------------------------------------------------------------- blocos de efeito

/** Saídas produzidas antes do bloco `index` (moedas FLIP_COINS e seletores com outputId). */
export function outputsBefore(blocks: readonly EffectBlock[], index: number, includePreDamageOnly = false): OutputsInScope {
  const out: { id: string; kind: 'COINS' | 'TARGETS' }[] = [];
  blocks.forEach((b, i) => {
    if (i >= index && !includePreDamageOnly) return;
    if (includePreDamageOnly && b.timing !== 'PRE_DAMAGE') return;
    const op = b.operation as unknown as Record<string, unknown>;
    if (b.operation.type === 'FLIP_COINS' && b.operation.outputId) out.push({ id: b.operation.outputId, kind: 'COINS' });
    for (const key of ['target', 'from', 'to']) {
      const s = op[key] as Selector | undefined;
      if (s && typeof s === 'object' && s.outputId) out.push({ id: s.outputId, kind: 'TARGETS' });
    }
  });
  return out;
}

export function EffectBlocks({ title, blocks, onChange, path, timings, ownerId, takenIds, help, readOnly }: {
  readonly title: string; readonly blocks: readonly EffectBlock[]; readonly onChange: (v: EffectBlock[]) => void; readonly path: Path; readonly timings: readonly Timing[];
  readonly ownerId: string; readonly takenIds: readonly string[]; readonly help?: string; readonly readOnly?: boolean;
}): JSX.Element {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const add = () => {
    const id = uniqueId(`${ownerId}-efeito`, takenIds);
    const timing = timings.includes('POST_DAMAGE') ? 'POST_DAMAGE' : timings[0]!;
    const first = opcodesByFamily(timing)[0]?.specs[0];
    const operation: Operation = timing === 'CONTINUOUS' || timing === 'REPLACEMENT'
      ? { type: 'MODIFY', stat: 'DAMAGE_TAKEN', amount: -10, target: { scope: 'SELF' }, duration: { kind: 'WHILE_SOURCE_IN_PLAY' } }
      : first?.type === 'FLIP_COINS' ? { type: 'DRAW_CARDS', player: 'OWN', count: 1 } : first?.create() ?? { type: 'DRAW_CARDS', player: 'OWN', count: 1 };
    onChange([...blocks, { id, timing, operation }]);
  };
  const setBlock = (i: number, b: EffectBlock) => onChange(blocks.map((x, k) => (k === i ? b : x)));
  return (
    <div class="stack" data-path={pathKey(path)}>
      <div class="row-between">
        <strong>{title}</strong>
        {!readOnly ? <Button size="sm" icon="plus" onClick={add} testId={`add-effect-${ownerId}`}>Bloco de efeito</Button> : null}
      </div>
      {help ? <small class="muted">{help}</small> : null}
      {blocks.length === 0 ? <small class="muted">Nenhum efeito.</small> : null}
      <ol class="studio-blocks">
        {blocks.map((b, i) => {
          const blockPath = [...path, i];
          const outputs = outputsBefore(blocks, i);
          let summary = '';
          try { summary = blockText(b); } catch { summary = '—'; }
          return (
            <li key={b.id} class={`studio-block ${dragFrom === i ? 'is-dragging' : ''}`} data-path={pathKey(blockPath)} draggable={!readOnly}
              onDragStart={() => setDragFrom(i)} onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragFrom !== null && dragFrom !== i) onChange(moveItem(blocks, dragFrom, i)); setDragFrom(null); }}>
              <div class="studio-block-head">
                <span class="badge">{i + 1}</span>
                <select class="input sf-small" aria-label="Momento" value={b.timing} disabled={readOnly} onChange={(e) => setBlock(i, { ...b, timing: (e.target as HTMLSelectElement).value as Timing })}>
                  {[...new Set([...timings, b.timing])].map((t) => <option key={t} value={t}>{TIMING_LABEL[t]}</option>)}
                </select>
                {!readOnly ? <OpcodePicker value={b.operation.type} timing={b.timing} onChange={(operation) => setBlock(i, { ...b, operation })} /> : <strong>{opcodeSpec(b.operation.type)?.label ?? b.operation.type}</strong>}
                {!readOnly ? (
                  <span class="row studio-block-actions">
                    <Button size="sm" variant="ghost" label="Subir bloco" disabledReason={i === 0 ? 'Já é o primeiro' : null} onClick={() => onChange(moveItem(blocks, i, i - 1))}>↑</Button>
                    <Button size="sm" variant="ghost" label="Descer bloco" disabledReason={i === blocks.length - 1 ? 'Já é o último' : null} onClick={() => onChange(moveItem(blocks, i, i + 1))}>↓</Button>
                    <Button size="sm" variant="ghost" icon="trash" label="Remover bloco" onClick={() => onChange(blocks.filter((_, k) => k !== i))} />
                  </span>
                ) : null}
              </div>
              <p class="studio-block-text">{summary || '—'}</p>
              {!readOnly ? (
                <details class="studio-block-body">
                  <summary>Configurar: em quem, quanto, quem escolhe, duração</summary>
                  <OperationForm value={b.operation} onChange={(operation) => setBlock(i, { ...b, operation })} path={[...blockPath, 'operation']} outputs={outputs} timing={b.timing} />
                  <div class="studio-grid-2">
                    <CheckField label="Opcional (o controlador pode recusar)" checked={!!b.optional} onChange={(v) => setBlock(i, { ...b, optional: v || undefined })} />
                    <SelectField label="Falha parcial" value={b.failurePolicy ?? ''} options={[o('REQUIRE_ANY', 'Exige algum alvo'), o('REQUIRE_ALL', 'Exige todos'), o('BEST_EFFORT', 'Melhor esforço')]}
                      onChange={(failurePolicy) => setBlock(i, { ...b, failurePolicy: failurePolicy as EffectBlock['failurePolicy'] })} />
                  </div>
                  <CheckField label="Só quando uma condição for verdadeira" checked={!!b.condition} onChange={(v) => setBlock(i, { ...b, condition: v ? { op: 'SOURCE_POSITION', position: 'ACTIVE' } : undefined })} />
                  {b.condition ? <ConditionEditor value={b.condition} onChange={(condition) => setBlock(i, { ...b, condition })} path={[...blockPath, 'condition']} outputs={outputs} /> : null}
                </details>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export const ENERGY_COST_TYPES = [...ENERGY_TYPES, 'COLORLESS'] as const;
