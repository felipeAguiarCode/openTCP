// Mapa de rotas (interface §3.2–§3.4): sem rotas sociais/online/premium na v1 e duelo sem o shell de navegação.
import { describe, expect, it } from 'vitest';
import { ROUTES, parseHash, routePath } from './router.ts';

describe('rotas da v1', () => {
  it('UI-074: não existem rotas nem itens de menu sociais, online, premium ou de pagamento real', () => {
    const forbidden = /social|amig|friend|chat|online|multiplayer|pvp|ranking|leaderboard|premium|vip|loja|store|shop|pagamento|payment|checkout|login|account|conta\b|trade|battle-?pass|passe|gems|diamante/i;
    for (const r of ROUTES) {
      expect(r.pattern, r.id).not.toMatch(forbidden);
      expect(r.title, r.id).not.toMatch(forbidden);
    }
    const navs = new Set(ROUTES.map((r) => r.nav).filter(Boolean));
    expect([...navs].sort()).toEqual(['arena', 'campaign', 'challenges', 'collection', 'create', 'decks', 'emporium', 'help', 'home', 'packs', 'saves', 'settings']);
    // Link direto para rota inexistente não finge funcionamento: cai no Início com aviso.
    expect(parseHash('#/ranking').def.id).toBe('S03');
    expect(parseHash('#/ranking').query.notFound).toBe('/ranking');
  });

  it('UI-071: preparação, duelo, resultado e replay abrem sem o shell (sem navegação comercial)', () => {
    for (const id of ['S21', 'S22', 'S23', 'S24', 'S39']) {
      const def = ROUTES.find((r) => r.id === id)!;
      expect(def.bare, id).toBe(true);
      expect(parseHash(`#${routePath(id, { attemptId: 'a', matchId: 'm', replayId: 'r' })}`).def.id).toBe(id);
    }
  });
});
