// Navegação por abas (interface §3.1; UI-170): toda rota com shell cai num grupo ou é utilitário do cabeçalho, cada
// rota pertence a uma só sub-aba e nenhuma sub-aba aponta para rota inexistente.
import { describe, expect, it } from 'vitest';
import { ROUTES } from '../app/router.ts';
import { NAV_GROUPS, NAV_UTILITIES, navOf } from './shell.tsx';

const UTILITY_ROUTES = new Set([...NAV_UTILITIES.map((u) => u.routeId), 'S34', 'S41', 'S40']);

describe('abas no topo', () => {
  it('cinco abas: Início, Jogar, Coleção, Loja e Criar', () => {
    expect(NAV_GROUPS.map((g) => g.label)).toEqual(['Início', 'Jogar', 'Coleção', 'Loja', 'Criar']);
  });

  it('toda rota com shell tem grupo (ou é utilitário); sub-abas só com rotas existentes e sem repetição', () => {
    const ids = new Set(ROUTES.map((r) => r.id));
    const seen = new Map<string, string>();
    for (const g of NAV_GROUPS) {
      expect(ids.has(g.routeId), g.key).toBe(true);
      for (const id of [...g.routes, ...g.subs.flatMap((s) => [s.routeId, ...s.routes])]) expect(ids.has(id), `${g.key}:${id}`).toBe(true);
      for (const id of [...g.routes, ...g.subs.flatMap((s) => s.routes)]) {
        expect(seen.get(id), `${id} em dois grupos`).toBeUndefined();
        seen.set(id, g.key);
      }
    }
    for (const r of ROUTES.filter((x) => !x.bare && !x.public)) {
      if (UTILITY_ROUTES.has(r.id)) expect(navOf(r.id), r.id).toBeNull();
      else expect(navOf(r.id), `${r.id} sem aba`).not.toBeNull();
    }
  });

  it('a rota ativa a sua aba e a sua sub-aba', () => {
    expect(navOf('S16')).toMatchObject({ group: { key: 'play' }, sub: { label: 'Campanha' } });
    expect(navOf('S12')).toMatchObject({ group: { key: 'collection' }, sub: { label: 'Decks' } });
    expect(navOf('S05')).toMatchObject({ group: { key: 'shop' }, sub: { label: 'Pacotes' } });
    expect(navOf('S03')).toMatchObject({ group: { key: 'home' }, sub: null });
    expect(navOf('S36')).toBeNull();
  });
});
