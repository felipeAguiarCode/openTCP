// Texto da face nunca transborda: reduz até o limite, depois trunca com reticências (medida injetada).
import { describe, expect, it } from 'vitest';
import { ELLIPSIS, approximateMeasure as m, ellipsize, fitLine, fitParagraph, layoutRules, wrapWords } from './text-fit.ts';

const font = { sizePx: 20, weight: 800 };

describe('fitLine', () => {
  it('mantém o tamanho quando cabe', () => {
    const r = fitLine('Faisqueiro', 400, font, 12, m);
    expect(r).toEqual({ text: 'Faisqueiro', font, truncated: false });
  });

  it('reduz a fonte antes de truncar', () => {
    const w = m('Nome bastante comprido', font) * 0.85;
    const r = fitLine('Nome bastante comprido', w, font, 12, m);
    expect(r.truncated).toBe(false);
    expect(r.font.sizePx).toBeLessThan(20);
    expect(m(r.text, r.font)).toBeLessThanOrEqual(w);
  });

  it('abaixo do mínimo trunca com reticências e nunca excede a largura', () => {
    const r = fitLine('Tempestade Elétrica Absolutamente Interminável', 120, font, 14, m);
    expect(r.truncated).toBe(true);
    expect(r.font.sizePx).toBe(14);
    expect(r.text.endsWith(ELLIPSIS)).toBe(true);
    expect(m(r.text, r.font)).toBeLessThanOrEqual(120);
  });

  it('largura menor que a reticência → texto vazio', () => {
    expect(ellipsize('abc', 1, font, m)).toBe('');
  });
});

describe('fitParagraph', () => {
  const text = 'Jogue uma moeda. Se sair cara, o Pokémon Ativo do seu oponente agora está Paralisado. Se sair coroa, este ataque não faz nada e você descarta uma Energia.';

  it('quebra por palavras dentro da largura', () => {
    for (const line of wrapWords(text, 200, { sizePx: 14, weight: 600 }, m)) expect(m(line, { sizePx: 14, weight: 600 })).toBeLessThanOrEqual(200);
  });

  it.each([[400, 200], [300, 80], [200, 40], [120, 20]])('caixa %s×%s: altura nunca excedida', (w, h) => {
    const p = fitParagraph(text, w, h, { sizePx: 18, weight: 600 }, 10, 1.2, m);
    expect(p.lines.length * p.lineHeightPx).toBeLessThanOrEqual(h + 1e-6);
    for (const line of p.lines) expect(m(line, p.font)).toBeLessThanOrEqual(w + 1e-6);
    if (p.truncated && p.lines.length) expect(p.lines[p.lines.length - 1]!.endsWith(ELLIPSIS)).toBe(true);
  });
});

describe('layoutRules', () => {
  const style = { titleFont: { sizePx: 23, weight: 800 }, rightFont: { sizePx: 27, weight: 900 }, bodyFont: { sizePx: 16, weight: 600 }, lineHeight: 1.22, titleHeightFactor: 1.32, blockGap: 12, minScale: 0.7 };
  const long = 'Descarte 2 Energias deste Pokémon. Este ataque causa 30 de dano a cada Pokémon no Banco do seu oponente (não aplique Fraqueza para o Banco).';

  it('escala única até o mínimo e cabe na área', () => {
    const blocks = [
      { kind: 'ability' as const, title: 'Aura Protetora', badgeWidth: 100, body: long },
      { kind: 'attack' as const, title: 'Tempestade Elétrica', titleRight: '120', leadingWidth: 81, body: long },
      { kind: 'attack' as const, title: 'Faísca', titleRight: '30', leadingWidth: 31, body: '' },
    ];
    const r = layoutRules(blocks, 420, 226, style, m);
    expect(r.totalHeight).toBeLessThanOrEqual(226 + 1e-6);
    expect(r.scale).toBeGreaterThanOrEqual(0.7 - 1e-9);
    for (const b of r.blocks) {
      if (b.title) expect(m(b.title.text, b.title.font)).toBeLessThanOrEqual(420 - b.leadingWidth - b.badgeWidth);
      for (const line of b.bodyLines) expect(m(line, b.bodyFont)).toBeLessThanOrEqual(420 + 1e-6);
    }
  });

  it('conteúdo impossível ainda cabe (linhas limitadas ou blocos removidos, marcado como truncado)', () => {
    const blocks = Array.from({ length: 6 }, (_, i) => ({ kind: 'attack' as const, title: `Ataque ${i}`, titleRight: '90', leadingWidth: 100, body: long }));
    const r = layoutRules(blocks, 420, 120, style, m);
    expect(r.truncated).toBe(true);
    expect(r.totalHeight).toBeLessThanOrEqual(120 + 1e-6);
  });
});
