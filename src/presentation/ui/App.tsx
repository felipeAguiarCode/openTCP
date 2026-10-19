// Raiz da interface: guarda de boot/perfil, shell ou tela sem shell por rota, carregamento
// preguiçoso de telas, camadas globais (toasts, diálogo) e preferências aplicadas ao documento.
import type { ComponentType, JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { bootOutcome } from './app/boot.ts';
import { transferredAway } from './app/lifecycle.ts';
import { navigate, route, startRouter } from './app/router.ts';
import { reducedMotion, settings, snapshot, toast } from './app/store.ts';
import { ErrorState, Skeleton } from './components/controls.tsx';
import { AppShell, DialogHost, ToastHost } from './components/shell.tsx';
import { SCREENS } from './screens/registry.ts';

type Loaded = ComponentType<{ params: Readonly<Record<string, string>>; query: Readonly<Record<string, string>> }>;
const cache = new Map<string, Loaded>();

function useScreen(id: string): { Comp: Loaded | null; error: string | null } {
  const [state, setState] = useState<{ id: string; Comp: Loaded | null; error: string | null }>({ id, Comp: cache.get(id) ?? null, error: null });
  useEffect(() => {
    const cached = cache.get(id);
    if (cached) { setState({ id, Comp: cached, error: null }); return; }
    let alive = true;
    const loader = SCREENS[id];
    if (!loader) { setState({ id, Comp: null, error: `Tela ${id} indisponível.` }); return; }
    setState({ id, Comp: null, error: null });
    loader().then((Comp) => { cache.set(id, Comp as Loaded); if (alive) setState({ id, Comp: Comp as Loaded, error: null }); }, (e) => { if (alive) setState({ id, Comp: null, error: String(e) }); });
    return () => { alive = false; };
  }, [id]);
  return state.id === id ? state : { Comp: cache.get(id) ?? null, error: null };
}

function applyPreferences(): void {
  const root = document.documentElement;
  const s = settings.value;
  root.dataset.textSize = s.textSize;
  root.dataset.motion = reducedMotion.value ? 'reduced' : 'full';
  root.dataset.contrast = s.highContrast ? 'high' : 'normal';
}

export function App(): JSX.Element {
  useEffect(() => startRouter(), []);
  useEffect(() => { applyPreferences(); });
  const r = route.value;
  const booted = bootOutcome.value?.kind === 'READY';
  // Antes do boot, toda rota passa por S00 e retorna ao destino original (interface §6.1).
  useEffect(() => {
    if (!bootOutcome.value && r.def.id !== 'S00' && r.def.id !== 'S50') navigate(`/boot?next=${encodeURIComponent(r.path)}`, { replace: true });
    else if (booted && !r.def.public && !snapshot.value && r.def.id !== 'S00') navigate('/start', { replace: true });
  }, [r.path, booted, !!snapshot.value]);
  useEffect(() => {
    if (r.query.notFound) toast(`Página não encontrada: ${r.query.notFound}`, 'warning');
  }, [r.query.notFound]);
  useEffect(() => {
    document.title = `${r.def.title} · Card Campaign`;
    requestAnimationFrame(() => (document.getElementById('page-title') as HTMLElement | null)?.focus({ preventScroll: true }));
  }, [r.def.id]);
  const { Comp, error } = useScreen(r.def.id);
  if (transferredAway.value) {
    return (
      <div class="bare-screen"><div class="panel entry-card" role="alert">
        <div class="entry-title">O jogo foi aberto em outra aba</div>
        <p>O duelo em andamento foi pausado e gravado antes da transferência. Esta aba não grava mais nada.</p>
        <button type="button" class="btn btn-primary" onClick={() => location.reload()}>Usar o jogo nesta aba de novo</button>
      </div></div>
    );
  }
  const body = error ? <ErrorState title="Não foi possível abrir esta tela" text={error} onRetry={() => location.reload()} />
    : Comp ? <Comp params={r.params} query={r.query} /> : <Skeleton lines={6} />;
  const bare = r.def.bare || (!snapshot.value && r.def.public);
  return (
    <>
      {bare ? <div class="bare-main">{body}</div> : <AppShell>{body}</AppShell>}
      <ToastHost />
      <DialogHost />
    </>
  );
}
