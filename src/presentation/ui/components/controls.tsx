// Componentes compartilhados da interface §5: botões com estados completos (§5.1), cabeçalhos,
// abas, filtros, gavetas, vazio/skeleton/erro (§5.3), chips de recurso e status de gravação.
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { back } from '../app/router.ts';
import { Icon, type IconName } from './icons.tsx';

export type ButtonProps = {
  readonly children?: ComponentChildren;
  readonly onClick?: (e: MouseEvent) => void;
  readonly variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  readonly size?: 'sm' | 'md' | 'lg';
  readonly icon?: IconName;
  /** Razão textual do bloqueio: o botão continua focável e anuncia o motivo (§5.1). */
  readonly disabledReason?: string | null;
  readonly loading?: boolean;
  readonly type?: 'button' | 'submit';
  readonly label?: string;
  readonly testId?: string;
  readonly class?: string;
  readonly autoFocus?: boolean;
};

export function Button({ children, onClick, variant = 'secondary', size = 'md', icon, disabledReason, loading, type = 'button', label, testId, class: cls, autoFocus }: ButtonProps): JSX.Element {
  const blocked = !!disabledReason || !!loading;
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);
  return (
    <button ref={ref} type={type} class={`btn btn-${variant} btn-${size} ${loading ? 'is-loading' : ''} ${cls ?? ''}`}
      aria-disabled={blocked ? 'true' : undefined} aria-busy={loading ? 'true' : undefined} aria-label={label}
      // Botão só de ícone: o rótulo vira dica ao passar o ponteiro (o motivo do bloqueio tem prioridade).
      title={disabledReason ?? (children ? undefined : label)} data-testid={testId}
      onClick={(e) => { if (blocked) { e.preventDefault(); return; } onClick?.(e); }}>
      {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 20} /> : null}
      {children ? <span>{children}</span> : null}
      {disabledReason ? <span class="sr-only">. Indisponível: {disabledReason}</span> : null}
    </button>
  );
}

export function PageHeader({ title, subtitle, actions, backTo, lead, children }: {
  readonly title: string; readonly subtitle?: string; readonly actions?: ComponentChildren; readonly backTo?: string | true;
  /** Arte antes do título (ex.: o pacote no S05). */
  readonly lead?: ComponentChildren; readonly children?: ComponentChildren;
}): JSX.Element {
  return (
    <header class="page-header">
      {backTo ? <button type="button" class="btn btn-ghost btn-icon" onClick={() => back(typeof backTo === 'string' ? backTo : '/home')} aria-label="Voltar"><Icon name="back" /></button> : null}
      {lead ? <div class="page-header-lead" aria-hidden="true">{lead}</div> : null}
      <div class="page-header-text">
        <h1 tabIndex={-1} id="page-title">{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {children}
      {actions ? <div class="page-header-actions">{actions}</div> : null}
    </header>
  );
}

export function Panel({ title, children, class: cls, actions, labelledBy }: { readonly title?: string; readonly children?: ComponentChildren; readonly class?: string; readonly actions?: ComponentChildren; readonly labelledBy?: string }): JSX.Element {
  const id = labelledBy ?? (title ? `panel-${title.replace(/\W+/g, '-').toLowerCase()}` : undefined);
  return (
    <section class={`panel ${cls ?? ''}`} aria-labelledby={title ? id : undefined}>
      {title || actions ? (
        <div class="panel-head">
          {title ? <h2 id={id}>{title}</h2> : <span />}
          {actions ? <div class="panel-actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, label }: { readonly tabs: readonly { readonly id: T; readonly label: string; readonly badge?: string | number }[]; readonly value: T; readonly onChange: (id: T) => void; readonly label: string }): JSX.Element {
  const onKey = (e: KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === value);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]!;
      onChange(next.id);
      requestAnimationFrame(() => (document.querySelector(`[data-tab="${next.id}"]`) as HTMLElement | null)?.focus());
    }
  };
  return (
    <div class="tabs" role="tablist" aria-label={label} onKeyDown={onKey}>
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" data-tab={t.id} class={`tab ${t.id === value ? 'is-active' : ''}`} aria-selected={t.id === value} tabIndex={t.id === value ? 0 : -1} onClick={() => onChange(t.id)}>
          {t.label}{t.badge !== undefined && t.badge !== 0 ? <span class="tab-badge">{t.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Chip({ children, active, onClick, label }: { readonly children: ComponentChildren; readonly active?: boolean; readonly onClick?: () => void; readonly label?: string }): JSX.Element {
  return <button type="button" class={`chip ${active ? 'is-active' : ''}`} aria-pressed={active} onClick={onClick} aria-label={label}>{children}</button>;
}

export function SearchInput({ value, onInput, placeholder = 'Buscar', label = 'Buscar' }: { readonly value: string; readonly onInput: (v: string) => void; readonly placeholder?: string; readonly label?: string }): JSX.Element {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // Atalho “/” foca a busca fora de campos de texto (interface §35.2).
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.key === '/' && target && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) && !target.isContentEditable) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <label class="search">
      <Icon name="search" size={18} />
      <span class="sr-only">{label}</span>
      <input ref={ref} type="search" value={value} placeholder={placeholder} onInput={(e) => onInput((e.target as HTMLInputElement).value)} />
    </label>
  );
}

export function FilterBar({ children, onClear, applied }: { readonly children: ComponentChildren; readonly onClear?: () => void; readonly applied?: number }): JSX.Element {
  return (
    <div class="filter-bar" role="group" aria-label="Filtros">
      {children}
      {onClear && applied ? <Button variant="ghost" size="sm" onClick={onClear}>Limpar filtros ({applied})</Button> : null}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { readonly checked: boolean; readonly onChange: (v: boolean) => void; readonly label: string; readonly hint?: string }): JSX.Element {
  return (
    <label class="toggle">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange((e.target as HTMLInputElement).checked)} />
      <span class="toggle-track" aria-hidden="true"><span class="toggle-thumb" /></span>
      <span class="toggle-text"><span>{label}</span>{hint ? <small>{hint}</small> : null}</span>
    </label>
  );
}

export function Segmented<T extends string>({ options, value, onChange, label }: { readonly options: readonly { readonly id: T; readonly label: string }[]; readonly value: T; readonly onChange: (v: T) => void; readonly label: string }): JSX.Element {
  return (
    <div class="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={o.id === value} class={o.id === value ? 'is-active' : ''} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Slider({ value, onChange, label, min = 0, max = 1, step = 0.05 }: { readonly value: number; readonly onChange: (v: number) => void; readonly label: string; readonly min?: number; readonly max?: number; readonly step?: number }): JSX.Element {
  return (
    <label class="slider">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onInput={(e) => onChange(Number((e.target as HTMLInputElement).value))} />
      <output>{Math.round((value / max) * 100)}%</output>
    </label>
  );
}

export function EmptyState({ title, text, action }: { readonly title: string; readonly text?: string; readonly action?: ComponentChildren }): JSX.Element {
  return (
    <div class="empty-state" role="status">
      <strong>{title}</strong>
      {text ? <p>{text}</p> : null}
      {action}
    </div>
  );
}

/** Erro de leitura nunca vira “vazio” (interface §5.3). */
export function ErrorState({ title = 'Não foi possível ler os dados locais', text, onRetry }: { readonly title?: string; readonly text?: string; readonly onRetry?: () => void }): JSX.Element {
  return (
    <div class="error-state" role="alert">
      <Icon name="warning" />
      <div><strong>{title}</strong>{text ? <p>{text}</p> : null}</div>
      {onRetry ? <Button onClick={onRetry} icon="refresh">Tentar novamente</Button> : null}
    </div>
  );
}

export function Skeleton({ lines = 3, height }: { readonly lines?: number; readonly height?: number }): JSX.Element {
  return (
    <div class="skeleton" aria-busy="true" aria-label="Carregando" style={height ? { height: `${height}px` } : undefined}>
      {Array.from({ length: lines }, (_, i) => <span key={i} />)}
    </div>
  );
}

export function Drawer({ open, title, onClose, children, side = 'right' }: { readonly open: boolean; readonly title: string; readonly onClose: () => void; readonly children: ComponentChildren; readonly side?: 'right' | 'left' }): JSX.Element | null {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, open, onClose);
  if (!open) return null;
  return (
    <div class="drawer-scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside ref={ref} class={`drawer drawer-${side}`} role="dialog" aria-modal="true" aria-label={title}>
        <div class="drawer-head"><h2>{title}</h2><button type="button" class="btn btn-ghost btn-icon" onClick={onClose} aria-label="Fechar"><Icon name="close" /></button></div>
        <div class="drawer-body">{children}</div>
      </aside>
    </div>
  );
}

/** Restringe o foco à camada e devolve-o à origem ao fechar (interface §4.6, §35.3). */
export function useFocusTrap(ref: { current: HTMLElement | null }, active: boolean, onEscape?: () => void): void {
  useEffect(() => {
    if (!active) return;
    const origin = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const focusables = () => [...(el?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])') ?? [])];
    requestAnimationFrame(() => (el?.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0])?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscape) { e.stopPropagation(); e.preventDefault(); onEscape(); return; }
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (!list.length) return;
      const first = list[0]!;
      const last = list[list.length - 1]!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    el?.addEventListener('keydown', onKey);
    return () => { el?.removeEventListener('keydown', onKey); origin?.focus?.(); };
  }, [active]);
}

export function Modal({ open, title, onClose, children, actions, wide }: { readonly open: boolean; readonly title: string; readonly onClose?: () => void; readonly children: ComponentChildren; readonly actions?: ComponentChildren; readonly wide?: boolean }): JSX.Element | null {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, open, onClose);
  if (!open) return null;
  return (
    <div class="modal-scrim">
      <div ref={ref} class={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-head">
          <h2 id="modal-title">{title}</h2>
          {onClose ? <button type="button" class="btn btn-ghost btn-icon" onClick={onClose} aria-label="Fechar"><Icon name="close" /></button> : null}
        </div>
        <div class="modal-body">{children}</div>
        {actions ? <div class="modal-actions">{actions}</div> : null}
      </div>
    </div>
  );
}

export function ResourceChip({ icon, value, label, explain }: { readonly icon: IconName; readonly value: number | string; readonly label: string; readonly explain?: string }): JSX.Element {
  return (
    <span class="resource-chip" title={explain ?? label} aria-label={`${label}: ${value}`}>
      <Icon name={icon} size={18} /><b>{value}</b><span class="resource-label">{label}</span>
    </span>
  );
}

export function KeyValue({ items }: { readonly items: readonly (readonly [string, ComponentChildren])[] }): JSX.Element {
  return <dl class="kv">{items.map(([k, v]) => [<dt key={`${k}-k`}>{k}</dt>, <dd key={`${k}-v`}>{v}</dd>])}</dl>;
}

export function ProgressBar({ value, max, label }: { readonly value: number; readonly max: number; readonly label: string }): JSX.Element {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div class="progress" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}
