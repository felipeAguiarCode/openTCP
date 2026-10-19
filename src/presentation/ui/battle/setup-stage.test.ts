// Preparação na mesa (gameplay-pocket §4): alvos por etapa, colocar/devolver, seleção enviada e visão provisória.
import { describe, expect, it } from 'vitest';
import type { BattleView, CardRef } from '../../../domain/battle/views.ts';
import { EMPTY_STAGING, placeCard, setupSelection, setupTargets, stagedCardOf, stagedEntityId, stagedFaceDown, stagedView, unplaceCard } from './setup-stage.ts';

const ref = (cardId: string): CardRef => ({ cardId, printingId: `p-${cardId}`, definitionKey: `${cardId}@1` });
const eligible = new Set(['a', 'b', 'c', 'd', 'e']);

describe('preparação na mesa', () => {
  it('Ativo primeiro; depois só os slots livres do Banco, até o limite', () => {
    expect(setupTargets(EMPTY_STAGING, 3)).toEqual(['HUMAN_ACTIVE']);
    const withActive = { ...EMPTY_STAGING, active: 'a' };
    expect(setupTargets(withActive, 3)).toEqual(['HUMAN_BENCH_0', 'HUMAN_BENCH_1', 'HUMAN_BENCH_2']);
    expect(setupTargets({ active: 'a', bench: [null, 'b', null] }, 3)).toEqual(['HUMAN_BENCH_0', 'HUMAN_BENCH_2']);
    expect(setupTargets({ active: 'a', bench: ['b', 'c', 'd'] }, 3)).toEqual([]);
    expect(setupTargets({ active: 'a', bench: ['b', null, null] }, 1)).toEqual([]);
  });

  it('coloca no próximo livre ou no slot pedido; recusa com motivo', () => {
    let s = EMPTY_STAGING;
    const r1 = placeCard(s, 'a', 'HUMAN_BENCH_1', eligible, 3);
    expect(r1).toEqual({ ok: false, reason: 'Coloque primeiro um Básico no Ativo' });
    const r2 = placeCard(s, 'a', null, eligible, 3);
    expect(r2.ok).toBe(true);
    s = r2.ok ? r2.staging : s;
    expect(s.active).toBe('a');
    const r3 = placeCard(s, 'b', 'HUMAN_BENCH_2', eligible, 3);
    s = r3.ok ? r3.staging : s;
    expect(s.bench).toEqual([null, null, 'b']);
    expect(placeCard(s, 'b', null, eligible, 3)).toEqual({ ok: false, reason: 'Esta carta já está na mesa' });
    expect(placeCard(s, 'x', null, eligible, 3)).toEqual({ ok: false, reason: 'Só Pokémon Básicos entram na preparação' });
    expect(placeCard(s, 'c', 'HUMAN_ACTIVE', eligible, 3)).toEqual({ ok: false, reason: 'O Ativo já foi escolhido' });
    expect(setupSelection(s)).toEqual(['a', 'b']);
  });

  it('devolver o Ativo não promove o Banco; sem Ativo não há seleção', () => {
    const s = unplaceCard({ active: 'a', bench: ['b', null, null] }, 'a');
    expect(s).toEqual({ active: null, bench: ['b', null, null] });
    expect(setupSelection(s)).toEqual([]);
  });

  it('visão provisória: as cartas saem da mão e aparecem nos slots como entidades “staged:”', () => {
    const side = {
      player: 'A', active: null, bench: [null, null, null], handCount: 3, hand: [ref('a'), ref('b'), ref('z')], deckCount: 10, deckRemaining: null, discard: [],
      discardedEnergy: {}, energyZone: { types: [], ready: null, next: null }, points: 0,
      flags: { supporterUsed: false, retreatUsed: false, manualEnergyUsed: false, stadiumPlayed: false },
    };
    const view = { sides: { A: side, B: { ...side, player: 'B', hand: null } } } as unknown as BattleView;
    expect(stagedView(view, 'A', EMPTY_STAGING, () => 60)).toBe(view);
    const v = stagedView(view, 'A', { active: 'a', bench: [null, 'b', null] }, () => 70);
    expect(v.sides.A.hand!.map((h) => h.cardId)).toEqual(['z']);
    expect(v.sides.A.handCount).toBe(1);
    expect(v.sides.A.active).toMatchObject({ entityId: stagedEntityId('a'), position: 'ACTIVE', maxHp: 70, remainingHp: 70 });
    expect(v.sides.A.bench[1]).toMatchObject({ entityId: 'staged:b', position: 'BENCH', benchIndex: 1 });
    expect(stagedCardOf(v.sides.A.active!.entityId)).toBe('a');
    expect(stagedCardOf('e1')).toBeNull();
    expect(v.sides.B).toBe(view.sides.B);
  });

  it('Básicos colocados ficam virados para baixo até a revelação', () => {
    expect([...stagedFaceDown(EMPTY_STAGING)]).toEqual([]);
    const s = { active: 'a', bench: [null, 'b', null] };
    expect([...stagedFaceDown(s)].sort()).toEqual([stagedEntityId('a'), stagedEntityId('b')].sort());
  });
});
