// Promoção por arrasto ou clique (gameplay-pocket §6.2; UI-172): opções, realces e o fluxo escolher → Ativo → resolver.
import { describe, expect, it } from 'vitest';
import type { DecisionView } from '../../../domain/battle/views.ts';
import { PROMOTE_TARGET, promotionDrop, promotionHighlights, promotionOptions, promotionPick } from './promotion.ts';

const decision = (over: Partial<DecisionView> = {}): DecisionView => ({
  decisionId: 'promote-A', player: 'A', kind: 'PROMOTE', reason: 'REPLACE_KNOCKED_OUT_ACTIVE', options: ['e1', 'e2'], min: 1, max: 1, answered: false, ...over,
});

describe('promoção depois do nocaute', () => {
  it('opções só na decisão PROMOTE ainda aberta', () => {
    expect(promotionOptions(decision())).toEqual(['e1', 'e2']);
    expect(promotionOptions(decision({ answered: true }))).toEqual([]);
    expect(promotionOptions(decision({ kind: 'SELECT_TARGETS' }))).toEqual([]);
    expect(promotionOptions(null)).toEqual([]);
  });

  it('realces: as opções flutuam, o Ativo é o alvo e a escolhida fica selecionada', () => {
    expect(promotionHighlights(['e1', 'e2'], null)).toEqual({ floating: ['e1', 'e2'], selectable: ['e1', 'e2'], targets: [PROMOTE_TARGET], selected: [] });
    expect(promotionHighlights(['e1', 'e2'], 'e2').selected).toEqual(['e2']);
    expect(promotionHighlights(['e1', 'e2'], 'x').selected).toEqual([]);
    expect(promotionHighlights([], 'e1')).toEqual({ floating: [], selectable: [], targets: [], selected: [] });
  });

  it('sem arrasto: clica num Pokémon, depois no Ativo; clicar de novo desfaz', () => {
    const opts = ['e1', 'e2'];
    expect(promotionPick(opts, null, { kind: 'SLOT', anchorId: PROMOTE_TARGET })).toEqual({ kind: 'NONE' });
    expect(promotionPick(opts, null, { kind: 'ENTITY', entityId: 'e2' })).toEqual({ kind: 'SELECT', entityId: 'e2' });
    expect(promotionPick(opts, 'e2', { kind: 'ENTITY', entityId: 'e2' })).toEqual({ kind: 'SELECT', entityId: null });
    expect(promotionPick(opts, 'e2', { kind: 'SLOT', anchorId: PROMOTE_TARGET })).toEqual({ kind: 'RESOLVE', entityId: 'e2' });
    expect(promotionPick(opts, 'e2', { kind: 'ENTITY', entityId: 'npc-1' })).toEqual({ kind: 'NONE' });
  });

  it('arrastando: soltar uma opção no Ativo resolve; outra entidade é ignorada', () => {
    expect(promotionDrop(['e1', 'e2'], 'e1')).toEqual({ kind: 'RESOLVE', entityId: 'e1' });
    expect(promotionDrop(['e1', 'e2'], 'e9')).toEqual({ kind: 'NONE' });
  });
});
