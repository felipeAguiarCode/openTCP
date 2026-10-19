// Primitivas do Estúdio: campos de formulário rotulados (com data-path para “Ir para o campo”), seleção
// múltipla em chips, URLs locais de assets (object URL de BLOB, liberadas ao trocar), cliente do Media Worker,
// download/seleção de arquivos e a face da carta de um rascunho. Texto do usuário é sempre texto (ED-028).
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { GameContext } from '../../../application/context.ts';
import { cardFace, type CardFaceData } from '../../../domain/cards/text.ts';
import type { CardDefinition, CardPrinting } from '../../../domain/cards/types.ts';
import type { Option } from '../../../domain/editor/opcodes.ts';
import { createMediaClient, type MediaClient } from '../../../infrastructure/workers/media-client.ts';
import type { CardArt } from '../components/cards.tsx';
import { Icon } from '../components/icons.tsx';

export type Path = readonly (string | number)[];
export const pathKey = (path: Path): string => path.join('.');

let fieldSeq = 0;
function useFieldId(): string {
  const [id] = useState(() => `sf-${++fieldSeq}`);
  return id;
}

export function Field({ label, hint, path, error, children, inline }: {
  readonly label: string; readonly hint?: string; readonly path?: Path; readonly error?: string | null; readonly children: (id: string) => ComponentChildren; readonly inline?: boolean;
}): JSX.Element {
  const id = useFieldId();
  return (
    <div class={`sf ${inline ? 'sf-inline' : ''} ${error ? 'has-error' : ''}`} data-path={path ? pathKey(path) : undefined}>
      <label for={id} class="sf-label">{label}</label>
      {children(id)}
      {hint ? <small class="sf-hint">{hint}</small> : null}
      {error ? <span class="field-error" role="alert"><Icon name="warning" size={14} /> {error}</span> : null}
    </div>
  );
}

export function TextField({ label, value, onChange, path, max, hint, placeholder, multiline, error }: {
  readonly label: string; readonly value: string; readonly onChange: (v: string) => void; readonly path?: Path; readonly max?: number; readonly hint?: string;
  readonly placeholder?: string; readonly multiline?: boolean; readonly error?: string | null;
}): JSX.Element {
  return (
    <Field label={label} path={path} hint={hint ?? (max ? `${[...value].length}/${max}` : undefined)} error={error}>
      {(id) => multiline
        ? <textarea id={id} class="input" rows={3} maxLength={max} value={value} placeholder={placeholder} onInput={(e) => onChange((e.target as HTMLTextAreaElement).value)} />
        : <input id={id} class="input" type="text" maxLength={max} value={value} placeholder={placeholder} onInput={(e) => onChange((e.target as HTMLInputElement).value)} />}
    </Field>
  );
}

/** Número inteiro: mantém o texto digitado enquanto inválido (o validador aponta), sem “corrigir” em silêncio. */
export function NumberField({ label, value, onChange, path, min, max, step = 1, hint, error, allowEmpty }: {
  readonly label: string; readonly value: number | null; readonly onChange: (v: number | null) => void; readonly path?: Path; readonly min?: number; readonly max?: number;
  readonly step?: number; readonly hint?: string; readonly error?: string | null; readonly allowEmpty?: boolean;
}): JSX.Element {
  return (
    <Field label={label} path={path} hint={hint} error={error} inline>
      {(id) => (
        <span class="sf-number">
          <button type="button" class="btn btn-sm btn-icon" aria-label={`Diminuir ${label}`} onClick={() => onChange((value ?? 0) - step)}><Icon name="minus" size={16} /></button>
          <input id={id} class="input" type="number" inputMode="numeric" min={min} max={max} step={step} value={value === null ? '' : String(value)}
            onInput={(e) => {
              const raw = (e.target as HTMLInputElement).value;
              if (raw === '') { if (allowEmpty) onChange(null); return; }
              const n = Number(raw);
              if (Number.isFinite(n)) onChange(n);
            }} />
          <button type="button" class="btn btn-sm btn-icon" aria-label={`Aumentar ${label}`} onClick={() => onChange((value ?? 0) + step)}><Icon name="plus" size={16} /></button>
        </span>
      )}
    </Field>
  );
}

export function SelectField<T extends string>({ label, value, options, onChange, path, hint, error, disabled }: {
  readonly label: string; readonly value: T | ''; readonly options: readonly { readonly value: T; readonly label: string }[]; readonly onChange: (v: T) => void;
  readonly path?: Path; readonly hint?: string; readonly error?: string | null; readonly disabled?: boolean;
}): JSX.Element {
  return (
    <Field label={label} path={path} hint={hint} error={error}>
      {(id) => (
        <select id={id} class="input" value={value} disabled={disabled} onChange={(e) => onChange((e.target as HTMLSelectElement).value as T)}>
          {value === '' ? <option value="">—</option> : null}
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
    </Field>
  );
}

/** Faixa com o valor real exibido (graus, escala, intensidade), não porcentagem. */
export function RangeField({ label, value, onChange, min, max, step, path, format, disabled }: {
  readonly label: string; readonly value: number; readonly onChange: (v: number) => void; readonly min: number; readonly max: number; readonly step: number;
  readonly path?: Path; readonly format?: (v: number) => string; readonly disabled?: boolean;
}): JSX.Element {
  const id = useFieldId();
  return (
    <div class="sf sf-range" data-path={path ? pathKey(path) : undefined}>
      <label for={id} class="sf-label">{label}</label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        onInput={(e) => onChange(Number((e.target as HTMLInputElement).value))} />
      <output for={id}>{format ? format(value) : String(Math.round(value * 100) / 100)}</output>
    </div>
  );
}

export function CheckField({ label, checked, onChange, path, hint }: { readonly label: string; readonly checked: boolean; readonly onChange: (v: boolean) => void; readonly path?: Path; readonly hint?: string }): JSX.Element {
  return (
    <label class="sf-check" data-path={path ? pathKey(path) : undefined}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange((e.target as HTMLInputElement).checked)} />
      <span>{label}{hint ? <small> — {hint}</small> : null}</span>
    </label>
  );
}

export function MultiChips<T extends string>({ label, values, options, onChange, path }: {
  readonly label: string; readonly values: readonly T[]; readonly options: readonly Option[]; readonly onChange: (v: T[]) => void; readonly path?: Path;
}): JSX.Element {
  return (
    <fieldset class="sf sf-chips" data-path={path ? pathKey(path) : undefined}>
      <legend class="sf-label">{label}</legend>
      <div class="row">
        {options.map((o) => {
          const on = values.includes(o.value as T);
          return <button key={o.value} type="button" class={`chip ${on ? 'is-active' : ''}`} aria-pressed={on}
            onClick={() => onChange(on ? values.filter((v) => v !== o.value) : [...values, o.value as T])}>{o.label}</button>;
        })}
      </div>
    </fieldset>
  );
}

/** Lista de textos (ex.: chaves de nome, etiquetas): uma por linha; texto puro. */
export function ListField({ label, values, onChange, path, hint }: { readonly label: string; readonly values: readonly string[]; readonly onChange: (v: string[]) => void; readonly path?: Path; readonly hint?: string }): JSX.Element {
  return (
    <Field label={label} path={path} hint={hint ?? 'Um item por linha.'}>
      {(id) => <textarea id={id} class="input" rows={2} value={values.join('\n')} onInput={(e) => onChange((e.target as HTMLTextAreaElement).value.split('\n').map((s) => s.trim()).filter(Boolean))} />}
    </Field>
  );
}

export function Section({ title, children, actions, path, tone }: { readonly title: string; readonly children: ComponentChildren; readonly actions?: ComponentChildren; readonly path?: Path; readonly tone?: 'cost' | 'effect' }): JSX.Element {
  return (
    <section class={`studio-section ${tone ? `tone-${tone}` : ''}`} data-path={path ? pathKey(path) : undefined}>
      <div class="studio-section-head"><h3>{title}</h3>{actions ? <div class="row">{actions}</div> : null}</div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------- assets locais

type CachedUrl = { url: string; refs: number };
const urlCache = new Map<string, CachedUrl>();
const pendingUrl = new Map<string, Promise<string | null>>();

async function resolveAssetUrl(ctx: GameContext, assetId: string): Promise<string | null> {
  const cached = urlCache.get(assetId);
  if (cached) return cached.url;
  let p = pendingUrl.get(assetId);
  if (!p) {
    p = ctx.storage.query({ kind: 'GET_ASSET', assetId }).then((a) => {
      if (!a) return null;
      const url = URL.createObjectURL(new Blob([a.bytes as unknown as BlobPart], { type: a.mediaType }));
      urlCache.set(assetId, { url, refs: 0 });
      return url;
    }).finally(() => pendingUrl.delete(assetId));
    pendingUrl.set(assetId, p);
  }
  return p;
}

function release(assetId: string): void {
  const c = urlCache.get(assetId);
  if (!c) return;
  c.refs -= 1;
  if (c.refs <= 0) {
    // Libera o object URL substituído: não acumular imagens temporárias (§22).
    setTimeout(() => {
      const again = urlCache.get(assetId);
      if (again && again.refs <= 0) { URL.revokeObjectURL(again.url); urlCache.delete(assetId); }
    }, 1000);
  }
}

/** Object URL do BLOB do asset (null enquanto carrega ou se ausente). */
export function useAssetUrl(ctx: GameContext | null, assetId: string | null | undefined): string | null | 'MISSING' {
  const [url, setUrl] = useState<string | null | 'MISSING'>(null);
  useEffect(() => {
    if (!ctx || !assetId) { setUrl(null); return; }
    let alive = true;
    let acquired = false;
    void resolveAssetUrl(ctx, assetId).then((u) => {
      if (!alive) return;
      if (!u) { setUrl('MISSING'); return; }
      const c = urlCache.get(assetId);
      if (c) { c.refs += 1; acquired = true; }
      setUrl(u);
    });
    return () => { alive = false; if (acquired) release(assetId); };
  }, [ctx, assetId]);
  return url;
}

export function artOf(printing: CardPrinting | null | undefined, url: string | null | 'MISSING'): CardArt | null {
  if (!printing || !url || url === 'MISSING' || printing.artMode === 'TEMPLATE_ONLY') return null;
  return { url, mode: printing.artMode, crop: printing.crop, transform: printing.artTransform };
}

/** Face composta de um documento possivelmente incompleto (null se ainda não dá para compor). */
export function safeFace(rules: CardDefinition, printing: CardPrinting | undefined, nameOf?: (key: string) => string | null): CardFaceData | null {
  if (!printing) return null;
  try {
    return cardFace(rules, printing, nameOf);
  } catch {
    return null;
  }
}

let media: MediaClient | null = null;
export function mediaClient(): MediaClient {
  media ??= createMediaClient();
  return media;
}

export function downloadBytes(bytes: Uint8Array | string, filename: string, mediaType: string): void {
  const blob = new Blob([bytes as unknown as BlobPart], { type: mediaType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

export function safeFilename(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'carta';
}

export const MODE_HELP: Record<string, string> = {
  NEW_DEFINITION: 'Nova definição CUSTOM, versão 1.',
  NEW_VERSION: 'Mesmo ID funcional, versão seguinte; regras e impressões editáveis.',
  VARIANT: 'Novas impressões da mesma versão; todas as regras ficam bloqueadas.',
  FORK: 'Novo ID CUSTOM com a origem registrada como referência.',
};
