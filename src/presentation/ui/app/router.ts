// Roteamento por hash (interface §3.2–§3.4, §4.1): rotas S00–S52, parâmetros, `returnContext`
// e estado de navegação restaurável. Mãos ocultas, RNG e save nunca vão para a URL.
import { signal } from '@preact/signals';

export type NavKey = 'home' | 'campaign' | 'challenges' | 'arena' | 'collection' | 'decks' | 'packs' | 'emporium' | 'create' | 'saves' | 'help' | 'settings';

export type RouteDef = {
  readonly id: string;
  readonly pattern: string;
  readonly title: string;
  readonly nav: NavKey | null;
  /** Rotas sem shell (entrada, boot, duelo). */
  readonly bare?: boolean;
  /** Só existe em build de desenvolvimento (S40). */
  readonly devOnly?: boolean;
  /** Não exige perfil carregado. */
  readonly public?: boolean;
};

export const ROUTES: readonly RouteDef[] = [
  { id: 'S00', pattern: '/boot', title: 'Iniciando', nav: null, bare: true, public: true },
  { id: 'S01', pattern: '/profiles', title: 'Perfis locais', nav: null, bare: true, public: true },
  { id: 'S02', pattern: '/onboarding', title: 'Novo jogo', nav: null, bare: true, public: true },
  { id: 'S03', pattern: '/home', title: 'Início', nav: 'home' },
  { id: 'S04', pattern: '/packs', title: 'Pacotes', nav: 'packs' },
  { id: 'S05', pattern: '/packs/:packId', title: 'Pacote', nav: 'packs' },
  { id: 'S06', pattern: '/openings/:openingId', title: 'Abertura', nav: 'packs', bare: true },
  { id: 'S07', pattern: '/collection', title: 'Coleção', nav: 'collection' },
  { id: 'S08', pattern: '/cards/:printingId', title: 'Carta', nav: 'collection' },
  { id: 'S09', pattern: '/collection/binders', title: 'Fichários', nav: 'collection' },
  { id: 'S10', pattern: '/collection/binders/:binderId/edit', title: 'Editar fichário', nav: 'collection' },
  { id: 'S11', pattern: '/decks', title: 'Decks', nav: 'decks' },
  { id: 'S12', pattern: '/decks/:deckId/edit', title: 'Editor de deck', nav: 'decks' },
  { id: 'S13', pattern: '/decks/:deckId/test', title: 'Testar deck', nav: 'decks' },
  { id: 'S14', pattern: '/battle', title: 'Batalhas', nav: 'arena' },
  { id: 'S15', pattern: '/challenges', title: 'Desafios', nav: 'challenges' },
  { id: 'S16', pattern: '/campaign/nodes/:nodeId', title: 'Briefing', nav: 'campaign' },
  { id: 'S17', pattern: '/battle/training', title: 'Treino', nav: 'arena' },
  { id: 'S18', pattern: '/arena', title: 'Arena', nav: 'arena' },
  { id: 'S19', pattern: '/campaign', title: 'Campanha', nav: 'campaign' },
  { id: 'S20', pattern: '/campaign/chapters/:chapterId', title: 'Capítulo', nav: 'campaign' },
  { id: 'S21', pattern: '/loading/:attemptId', title: 'Carregando', nav: null, bare: true },
  { id: 'S22', pattern: '/matches/:matchId/setup', title: 'Preparação', nav: null, bare: true },
  { id: 'S23', pattern: '/matches/:matchId', title: 'Duelo', nav: null, bare: true },
  { id: 'S24', pattern: '/matches/:matchId/result', title: 'Resultado', nav: null, bare: true },
  { id: 'S25', pattern: '/objectives', title: 'Objetivos', nav: 'campaign' },
  { id: 'S26', pattern: '/journal', title: 'Diário', nav: 'campaign' },
  { id: 'S27', pattern: '/journal/chapters/:chapterId', title: 'Resumo do capítulo', nav: 'campaign' },
  { id: 'S28', pattern: '/discoveries/:nodeId', title: 'Descoberta', nav: 'campaign' },
  { id: 'S29', pattern: '/opponents', title: 'Caderno de adversários', nav: null },
  { id: 'S30', pattern: '/opponents/:npcId', title: 'Adversário', nav: null },
  // Público: importar perfil e restaurar backup precisam funcionar numa instalação sem perfil (persistencia §25).
  { id: 'S31', pattern: '/saves', title: 'Saves e backups', nav: 'saves', public: true },
  { id: 'S32', pattern: '/gallery', title: 'Galeria', nav: 'collection' },
  { id: 'S33', pattern: '/emporium', title: 'Empório', nav: 'emporium' },
  { id: 'S34', pattern: '/profile', title: 'Perfil', nav: null },
  { id: 'S35', pattern: '/receipts', title: 'Recibos', nav: null },
  { id: 'S36', pattern: '/settings', title: 'Ajustes', nav: 'settings', public: true },
  { id: 'S37', pattern: '/help', title: 'Ajuda', nav: 'help', public: true },
  { id: 'S38', pattern: '/battle/history', title: 'Histórico', nav: 'arena' },
  { id: 'S39', pattern: '/replays/:replayId', title: 'Replay', nav: 'arena', bare: true },
  { id: 'S40', pattern: '/lab', title: 'Laboratório', nav: null, devOnly: true },
  { id: 'S41', pattern: '/appearance', title: 'Aparência', nav: null },
  { id: 'S42', pattern: '/decks/:deckId/appearance', title: 'Oficina do deck', nav: 'decks' },
  { id: 'S43', pattern: '/card-studio', title: 'Estúdio de Cartas', nav: 'create' },
  { id: 'S44', pattern: '/card-studio/projects/:projectId', title: 'Projeto de carta', nav: 'create' },
  { id: 'S45', pattern: '/card-studio/projects/:projectId/tests', title: 'Laboratório da carta', nav: 'create' },
  { id: 'S46', pattern: '/card-studio/import', title: 'Importar pacote', nav: 'create' },
  { id: 'S47', pattern: '/card-studio/releases/:definitionId/:version', title: 'Versão publicada', nav: 'create' },
  { id: 'S48', pattern: '/start', title: 'Entrada', nav: null, bare: true, public: true },
  { id: 'S49', pattern: '/credits', title: 'Créditos do projeto', nav: null, bare: true, public: true },
  { id: 'S50', pattern: '/diagnostics', title: 'Diagnóstico', nav: null, bare: true, public: true },
  { id: 'S51', pattern: '/decks/recipes', title: 'Receitas de deck', nav: 'decks' },
  { id: 'S52', pattern: '/decks/recipes/:recipeId', title: 'Receita', nav: 'decks' },
];

export type Route = {
  readonly def: RouteDef;
  readonly params: Readonly<Record<string, string>>;
  readonly query: Readonly<Record<string, string>>;
  readonly path: string;
};

declare const __DEV_LAB__: boolean;
const devLab = typeof __DEV_LAB__ === 'boolean' ? __DEV_LAB__ : false;

const compiled = ROUTES.filter((r) => !r.devOnly || devLab).map((def) => {
  const keys: string[] = [];
  const source = def.pattern.replace(/:([a-zA-Z]+)/g, (_m, key: string) => { keys.push(key); return '([^/]+)'; });
  return { def, keys, re: new RegExp(`^${source}$`) };
});

const HOME = ROUTES.find((r) => r.id === 'S03')!;

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/boot';
  const [pathPart, queryPart = ''] = raw.split('?', 2) as [string, string?];
  const path = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
  const query = Object.fromEntries(new URLSearchParams(queryPart));
  for (const c of compiled) {
    const m = c.re.exec(path);
    if (m) {
      const params = Object.fromEntries(c.keys.map((k, i) => [k, decodeURIComponent(m[i + 1] ?? '')]));
      return { def: c.def, params, query, path };
    }
  }
  // Link direto para rota inexistente (inclui S40 em produção) cai no Início com aviso (interface §3.2).
  return { def: HOME, params: {}, query: { ...query, notFound: path }, path: '/home' };
}

export function routePath(id: string, params: Readonly<Record<string, string | number>> = {}, query: Readonly<Record<string, string>> = {}): string {
  const def = ROUTES.find((r) => r.id === id);
  if (!def) throw new Error(`rota desconhecida ${id}`);
  const path = def.pattern.replace(/:([a-zA-Z]+)/g, (_m, key: string) => {
    const value = params[key];
    if (value === undefined) throw new Error(`parâmetro ${key} ausente para ${id}`);
    return encodeURIComponent(String(value));
  });
  const qs = new URLSearchParams(query).toString();
  return qs ? `${path}?${qs}` : path;
}

export const route = signal<Route>(parseHash(typeof location === 'undefined' ? '' : location.hash));

/** Pilha de retorno em memória da sessão: “Voltar” retorna à origem real (interface §4.1). */
const stack: string[] = [];

export function navigate(path: string, opts: { replace?: boolean } = {}): void {
  const current = route.value.path + queryString(route.value.query);
  if (!opts.replace && current !== path) stack.push(current);
  const hash = `#${path}`;
  if (opts.replace) history.replaceState(null, '', hash);
  else history.pushState(null, '', hash);
  route.value = parseHash(hash);
}

export function go(id: string, params: Readonly<Record<string, string | number>> = {}, query: Readonly<Record<string, string>> = {}, opts: { replace?: boolean } = {}): void {
  navigate(routePath(id, params, query), opts);
}

export function back(fallback = '/home'): void {
  const target = stack.pop();
  navigate(target ?? fallback, { replace: true });
}

export function canGoBack(): boolean {
  return stack.length > 0;
}

function queryString(query: Readonly<Record<string, string>>): string {
  const qs = new URLSearchParams(query).toString();
  return qs ? `?${qs}` : '';
}

export function startRouter(): () => void {
  const onHash = () => { route.value = parseHash(location.hash); };
  window.addEventListener('hashchange', onHash);
  window.addEventListener('popstate', onHash);
  return () => { window.removeEventListener('hashchange', onHash); window.removeEventListener('popstate', onHash); };
}

// ---------------------------------------------------------------- estado de navegação restaurável

const VIEW_STATE_KEY = 'card-campaign:view-state';

function readViewState(): Record<string, unknown> {
  try { return JSON.parse(sessionStorage.getItem(VIEW_STATE_KEY) ?? '{}') as Record<string, unknown>; } catch { return {}; }
}

/** Filtros, aba, seleção e rolagem por tela (interface §3.3) — conveniência de sessão, nunca progresso. */
export function loadViewState<T>(key: string, initial: T): T {
  const value = readViewState()[key];
  return value === undefined ? initial : { ...(initial as object), ...(value as object) } as T;
}

export function saveViewState(key: string, value: unknown): void {
  try {
    const all = readViewState();
    all[key] = value;
    sessionStorage.setItem(VIEW_STATE_KEY, JSON.stringify(all));
  } catch { /* armazenamento de sessão indisponível: segue sem restaurar */ }
}
