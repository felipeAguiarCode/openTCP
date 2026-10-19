// Shell normal (interface §2.2, §3.1): cabeçalho com recursos, utilitários e perfil; abas principais no topo no estilo
// dos menus da EA (INÍCIO · JOGAR · COLEÇÃO · LOJA · CRIAR, com Q/E trocando de aba) e sub-abas do grupo; toasts e o
// diálogo de confirmação único.
import type { ComponentChildren, JSX } from 'preact';
import { playerPortraitKey } from '../../assets/portraits.ts';
import { PortraitImage } from './portrait.tsx';
import { useEffect, useRef, useState } from 'preact/hooks';
import { go, route, routePath } from '../app/router.ts';
import { credits, dialog, displayName, packCount, saveState, snapshot, toasts } from '../app/store.ts';
import { Button, ResourceChip, useFocusTrap } from './controls.tsx';
import { Icon, type IconName } from './icons.tsx';

export type NavGroupKey = 'home' | 'play' | 'collection' | 'shop' | 'create';
export type SubNav = { readonly label: string; readonly routeId: string; readonly routes: readonly string[] };
export type NavGroup = { readonly key: NavGroupKey; readonly label: string; readonly routeId: string; readonly routes: readonly string[]; readonly subs: readonly SubNav[] };

/**
 * Navegação por abas (interface §3.1): cada sub-aba lista as rotas que a ativam, e a aba ativa é o grupo da rota.
 * Saves, Ajuda, Ajustes, Perfil e Aparência são utilitários do cabeçalho e não ativam aba.
 */
export const NAV_GROUPS: readonly NavGroup[] = [
  { key: 'home', label: 'Início', routeId: 'S03', routes: ['S03'], subs: [] },
  {
    key: 'play', label: 'Jogar', routeId: 'S14', routes: [], subs: [
      { label: 'Visão geral', routeId: 'S14', routes: ['S14'] },
      { label: 'Campanha', routeId: 'S19', routes: ['S19', 'S20', 'S16', 'S25', 'S26', 'S27', 'S28'] },
      { label: 'Desafios', routeId: 'S15', routes: ['S15'] },
      { label: 'Arena', routeId: 'S18', routes: ['S18'] },
      { label: 'Treino', routeId: 'S17', routes: ['S17'] },
      { label: 'Histórico', routeId: 'S38', routes: ['S38'] },
      { label: 'Adversários', routeId: 'S29', routes: ['S29', 'S30'] },
    ],
  },
  {
    key: 'collection', label: 'Coleção', routeId: 'S07', routes: [], subs: [
      { label: 'Cartas', routeId: 'S07', routes: ['S07', 'S08'] },
      { label: 'Decks', routeId: 'S11', routes: ['S11', 'S12', 'S13', 'S42'] },
      { label: 'Receitas', routeId: 'S51', routes: ['S51', 'S52'] },
      { label: 'Fichários', routeId: 'S09', routes: ['S09', 'S10'] },
      { label: 'Galeria', routeId: 'S32', routes: ['S32'] },
    ],
  },
  {
    key: 'shop', label: 'Loja', routeId: 'S04', routes: [], subs: [
      { label: 'Pacotes', routeId: 'S04', routes: ['S04', 'S05'] },
      { label: 'Empório', routeId: 'S33', routes: ['S33'] },
      { label: 'Recibos', routeId: 'S35', routes: ['S35'] },
    ],
  },
  {
    key: 'create', label: 'Criar', routeId: 'S43', routes: [], subs: [
      { label: 'Estúdio', routeId: 'S43', routes: ['S43', 'S44', 'S45', 'S47'] },
      { label: 'Importar', routeId: 'S46', routes: ['S46'] },
    ],
  },
];

/** Utilitários do cabeçalho: botões de ícone, fora das abas. */
export const NAV_UTILITIES: readonly { readonly routeId: string; readonly label: string; readonly icon: IconName }[] = [
  { routeId: 'S31', label: 'Saves e backups', icon: 'saves' },
  { routeId: 'S37', label: 'Ajuda', icon: 'help' },
  { routeId: 'S36', label: 'Ajustes', icon: 'settings' },
];

/** Grupo e sub-aba da rota; null nos utilitários (Saves, Ajuda, Ajustes, Perfil, Aparência). */
export function navOf(routeId: string): { readonly group: NavGroup; readonly sub: SubNav | null } | null {
  for (const group of NAV_GROUPS) {
    if (group.routes.includes(routeId)) return { group, sub: null };
    const sub = group.subs.find((s) => s.routes.includes(routeId));
    if (sub) return { group, sub };
  }
  return null;
}

function typingTarget(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable);
}

/** Abas principais: links com a aba ativa marcada; Q/E, como os bumpers dos menus da EA, vão para a anterior/próxima. */
export function TopTabs(): JSX.Element {
  const current = navOf(route.value.def.id)?.group.key ?? null;
  const snap = snapshot.value;
  const packs = packCount.value;
  const pending = snap?.pendingRewards.filter((r) => r.status === 'PENDING').length ?? 0;
  const indicator = (key: NavGroupKey): string | null => {
    if (key === 'shop' && packs > 0) return String(packs);
    if (key === 'play' && pending > 0) return '!';
    if (key === 'play' && snap?.activeAttempt) return '•';
    return null;
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((k !== 'q' && k !== 'e') || e.ctrlKey || e.metaKey || e.altKey || e.repeat || typingTarget(e.target)) return;
      if (dialog.value || document.querySelector('[aria-modal="true"]')) return;
      const at = NAV_GROUPS.findIndex((g) => g.key === navOf(route.value.def.id)?.group.key);
      const step = k === 'e' ? 1 : NAV_GROUPS.length - 1;
      e.preventDefault();
      go(NAV_GROUPS[((at < 0 ? 0 : at) + step) % NAV_GROUPS.length]!.routeId);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <nav class="top-tabs" aria-label="Navegação principal">
      <kbd class="bumper" title="Aba anterior (Q)" aria-hidden="true">Q</kbd>
      <ul>
        {NAV_GROUPS.map((g) => {
          const badge = indicator(g.key);
          return (
            <li key={g.key}>
              <a href={`#${routePath(g.routeId)}`} class={`top-tab ${current === g.key ? 'is-active' : ''}`} aria-current={current === g.key ? 'page' : undefined} data-testid={`nav-${g.key}`}>
                <span>{g.label}</span>
                {badge ? <span class={`tab-flag ${badge === '!' ? 'is-pending' : ''}`} aria-label={badge === '!' ? 'pendência' : badge === '•' ? 'duelo suspenso' : `${badge} pacotes`}>{badge}</span> : null}
              </a>
            </li>
          );
        })}
      </ul>
      <kbd class="bumper" title="Próxima aba (E)" aria-hidden="true">E</kbd>
    </nav>
  );
}

/** Sub-abas do grupo da rota (nenhuma no Início e nos utilitários). */
export function SubTabs(): JSX.Element | null {
  const nav = navOf(route.value.def.id);
  if (!nav || !nav.group.subs.length) return null;
  const packs = packCount.value;
  return (
    <nav class="sub-tabs" aria-label={`Seções de ${nav.group.label}`}>
      <ul>
        {nav.group.subs.map((s) => {
          const active = nav.sub?.routeId === s.routeId;
          return (
            <li key={s.routeId}>
              <a href={`#${routePath(s.routeId)}`} class={`sub-tab ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined} data-testid={`subnav-${s.routeId}`}>
                {s.label}{s.routeId === 'S04' && packs > 0 ? <span class="tab-flag" aria-label={`${packs} pacotes`}>{packs}</span> : null}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SaveStatus(): JSX.Element {
  const s = saveState.value;
  const text = s.state === 'SAVING' ? 'Gravando…' : s.state === 'FAILED' ? 'Falha ao gravar' : 'Salvo neste dispositivo';
  return (
    <span class={`save-status save-${s.state.toLowerCase()}`} role="status" aria-live="polite" title={s.message}>
      <Icon name={s.state === 'FAILED' ? 'warning' : s.state === 'SAVING' ? 'refresh' : 'check'} size={16} />
      <span class="save-text">{text}</span>
    </span>
  );
}

function ProfileMenu(): JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, open, () => setOpen(false));
  const name = displayName.value || 'Perfil';
  const choose = (id: string) => { setOpen(false); go(id); };
  return (
    <div class="profile-menu">
      <button type="button" class="btn btn-ghost profile-button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} data-testid="profile-menu">
        {snapshot.value ? <PortraitImage portraitKey={playerPortraitKey(snapshot.value.settings.avatar)} label="" class="profile-portrait" /> : <Icon name="profile" />}<span>{name}</span>
      </button>
      {open ? (
        <div ref={ref} class="profile-popover" role="menu">
          <button type="button" role="menuitem" onClick={() => choose('S34')}>Perfil local</button>
          <button type="button" role="menuitem" onClick={() => choose('S41')}>Aparência padrão</button>
          <button type="button" role="menuitem" onClick={() => choose('S35')}>Recibos e notificações</button>
          <button type="button" role="menuitem" onClick={() => choose('S29')}>Caderno de adversários</button>
          <button type="button" role="menuitem" onClick={() => choose('S01')}>Trocar perfil</button>
        </div>
      ) : null}
    </div>
  );
}

export function AppHeader(): JSX.Element {
  const current = route.value.def.id;
  return (
    <header class="app-header">
      <a class="brand" href={`#${routePath('S03')}`} aria-label="Card Campaign — Início"><span class="brand-mark" aria-hidden="true" /> <span class="brand-name">Card Campaign</span></a>
      <div class="header-resources">
        <ResourceChip icon="credits" value={credits.value} label="Créditos" explain="Créditos: moeda local ganha na campanha; usada no Empório." />
        <ResourceChip icon="pack" value={packCount.value} label="Pacotes" explain="Pacotes possuídos ainda não abertos." />
      </div>
      <SaveStatus />
      <div class="header-utilities">
        {NAV_UTILITIES.map((u) => (
          <a key={u.routeId} href={`#${routePath(u.routeId)}`} class={`btn btn-ghost btn-icon ${current === u.routeId ? 'is-current' : ''}`} aria-label={u.label} title={u.label}
            aria-current={current === u.routeId ? 'page' : undefined} data-testid={`util-${u.routeId}`}><Icon name={u.icon} /></a>
        ))}
        <button type="button" class="btn btn-ghost btn-icon" aria-label="Recibos e notificações" title="Recibos e notificações" onClick={() => go('S35')}><Icon name="bell" /></button>
      </div>
      <ProfileMenu />
    </header>
  );
}

export function AppShell({ children }: { readonly children: ComponentChildren }): JSX.Element {
  return (
    <div class="app-shell">
      <a class="skip-link" href="#main">Pular para o conteúdo</a>
      <AppHeader />
      <div class="app-nav">
        <TopTabs />
        <SubTabs />
      </div>
      <main id="main" class="app-main" tabIndex={-1}>{children}</main>
    </div>
  );
}

export function ToastHost(): JSX.Element {
  return (
    <div class="toast-host" aria-live="polite" aria-atomic="false">
      {toasts.value.map((t) => <div key={t.id} class={`toast toast-${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>{t.text}</div>)}
    </div>
  );
}

export function DialogHost(): JSX.Element | null {
  const d = dialog.value;
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, !!d, () => d?.resolve(false));
  if (!d) return null;
  const body = typeof d.body === 'string' ? [d.body] : d.body;
  return (
    <div class="modal-scrim">
      <div ref={ref} class="modal modal-confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-body">
        <h2 id="confirm-title">{d.title}</h2>
        <div id="confirm-body">{body.map((p, i) => <p key={i}>{p}</p>)}</div>
        <div class="modal-actions">
          <Button variant="ghost" onClick={() => d.resolve(false)}>{d.cancelLabel ?? 'Cancelar'}</Button>
          <Button variant={d.tone === 'danger' ? 'danger' : 'primary'} onClick={() => d.resolve(true)} testId="confirm-ok">{d.confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
