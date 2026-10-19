// Regras puras de áudio (interface §36.5): chave por evento, pular sem tocar, vozes por grupo, intervalo
// mínimo, volume por preferência e slots sem arquivo listados como placeholder.
import { describe, expect, it } from 'vitest';
import { CUES, MAX_VOICES, createCueGate, cueForSignal, groupVolume, placeholderCues, type CueId } from './cues.ts';

const prefs = { volumeMusic: 0.6, volumeBattle: 0.8, volumeUi: 0.7, volumePacks: 0.5 };

describe('áudio — portão de reprodução', () => {
  it('a mesma chave de evento toca uma vez; restaurar/pular não repete', () => {
    const gate = createCueGate();
    expect(gate.request('attack.hit', { now: 0, key: 'att:event-0007:HIT:e1', volume: 1 })).toEqual({ play: true });
    expect(gate.request('attack.hit', { now: 5000, key: 'att:event-0007:HIT:e1', volume: 1 })).toEqual({ play: false, reason: 'DUPLICATE_KEY' });
    gate.markPresented(['att:event-0009:HIT:e1']);
    expect(gate.request('attack.hit', { now: 9000, key: 'att:event-0009:HIT:e1', volume: 1 }).play).toBe(false);
  });

  it('apresentação pulada registra a chave sem tocar', () => {
    const gate = createCueGate();
    expect(gate.request('coin.heads', { now: 0, key: 'k1', skipped: true, volume: 1 })).toEqual({ play: false, reason: 'SKIPPED' });
    expect(gate.request('coin.heads', { now: 100, key: 'k1', volume: 1 })).toEqual({ play: false, reason: 'DUPLICATE_KEY' });
  });

  it('compra em grupo não vira rajada: intervalo mínimo e limite de vozes', () => {
    const gate = createCueGate();
    const results = Array.from({ length: 10 }, (_, i) => gate.request('card.draw', { now: i * 10, volume: 1 }).play);
    expect(results.filter(Boolean).length).toBeLessThan(4);
    const g2 = createCueGate();
    const ids: CueId[] = ['attack.hit', 'attack.status', 'attack.heal', 'attack.prevented', 'attack.knockout'];
    const played = ids.map((id) => g2.request(id, { now: 0, volume: 1, durationMs: 1000 }).play).filter(Boolean).length;
    expect(played).toBe(MAX_VOICES.attacks);
  });

  it('volume zero ou sessão suspensa não toca', () => {
    expect(createCueGate().request('ui.tap', { now: 0, volume: 0 })).toEqual({ play: false, reason: 'MUTED' });
  });
});

describe('áudio — catálogo', () => {
  it('cada grupo usa a preferência correspondente', () => {
    expect(groupVolume('music', prefs)).toBe(0.6);
    expect(groupVolume('attacks', prefs)).toBe(0.8);
    expect(groupVolume('ui', prefs)).toBe(0.7);
    expect(groupVolume('reveals', prefs)).toBe(0.5);
  });

  it('slots sem arquivo aparecem como placeholder e não quebram o mapeamento', () => {
    expect(placeholderCues().length).toBe(Object.keys(CUES).length);
    expect(cueForSignal({ kind: 'DAMAGE', amount: 40, prevented: false })).toBe('attack.hit');
    expect(cueForSignal({ kind: 'DAMAGE', amount: 0, prevented: true })).toBe('attack.prevented');
    expect(cueForSignal({ kind: 'RESULT', won: null })).toBeNull();
    expect(cueForSignal({ kind: 'TURN_BANNER', mine: true })).toBe('turn.mine');
  });
});
