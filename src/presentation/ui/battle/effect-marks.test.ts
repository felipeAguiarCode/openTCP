// Selos de efeito na carta (interface §25.21; UI-181): as Condições primeiro, um selo por tipo de efeito com os textos
// juntos, e todo ícone com o arquivo empacotado.
import { describe, expect, it } from 'vitest';
import { EFFECT_ICON_IDS, effectIconUrl } from '../../assets/effects.ts';
import { marksLabel, marksOf } from './effect-marks.tsx';

const none = { poisoned: false, burned: false, control: null };

describe('selos de efeito', () => {
  it('os 12 ícones do Pocket (5 Condições e 7 efeitos) estão empacotados', () => {
    expect(EFFECT_ICON_IDS).toHaveLength(12);
    for (const id of EFFECT_ICON_IDS) expect(effectIconUrl(id), id).toMatch(/\.webp/);
  });

  it('Condições primeiro (na ordem do Pocket), depois um selo por tipo de efeito', () => {
    const marks = marksOf({ poisoned: true, burned: true, control: 'ASLEEP' }, [
      { effectId: 'fx1', kind: 'DEBUFF', label: '−20 de dano nos ataques' },
      { effectId: 'fx2', kind: 'BAN', label: 'Não pode atacar' },
      { effectId: 'fx3', kind: 'BAN', label: 'Não pode recuar' },
    ]);
    expect(marks.map((m) => [m.icon, m.label])).toEqual([
      ['asleep', 'Adormecido'], ['poisoned', 'Envenenado'], ['burned', 'Queimado'],
      ['ban', 'Não pode atacar · Não pode recuar'], ['debuff', '−20 de dano nos ataques'],
    ]);
    expect(marks.find((m) => m.icon === 'ban')!.ids).toEqual(['fx2', 'fx3']);
    expect(marksLabel(marks)).toContain('Não pode atacar');
  });

  it('sem Condição nem efeito, nenhum selo', () => {
    expect(marksOf(none, [])).toEqual([]);
  });
});
