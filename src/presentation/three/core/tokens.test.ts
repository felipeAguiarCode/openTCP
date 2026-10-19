// Tokens pocket-light-v1 (direção visual §3): JSON e CSS com os mesmos valores, pares de contraste fixos,
// botão azul claro com texto escuro e laranja restrito ao tipo Fogo (nunca cor global de ação).
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import tokens from '../data/visual-tokens.json';
import { hexToRgb } from './tokens.ts';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const css = read('../../ui/styles/theme-pocket.css');
const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

function cssVars(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of text.matchAll(/--pocket-([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)) out.set(m[1]!, m[2]!.toUpperCase());
  return out;
}

/** Contraste WCAG 2.x entre duas cores sRGB. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const { r, g, b: bl } = hexToRgb(hex);
    const ch = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(bl);
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const colorOf = (token: string): string => (tokens.colors as Record<string, string>)[token] ?? (tokens.attackStripColors as Record<string, string>)[token] ?? token;

describe('tokens de cor (VS-002, VS-003, VS-004, VS-005)', () => {
  it('VS-002: tokens JSON e CSS correspondem em todos os valores de cor', () => {
    const vars = cssVars(css);
    for (const [name, hex] of Object.entries(tokens.colors)) expect(vars.get(kebab(name)), name).toBe(hex.toUpperCase());
    for (const [type, hex] of Object.entries(tokens.typeColors)) expect(vars.get(`type-${type.toLowerCase()}`), type).toBe(hex.toUpperCase());
    for (const [type, hex] of Object.entries(tokens.attackStripColors)) expect(vars.get(`strip-${type.toLowerCase()}`), type).toBe(hex.toUpperCase());
    expect(vars.size).toBe(Object.keys(tokens.colors).length + Object.keys(tokens.typeColors).length + Object.keys(tokens.attackStripColors).length);
    expect(read('../../../../.specs/design/theme-pocket.css')).toBe(css);
  });

  it('VS-003: texto principal e secundário (e os demais pares fixos) passam 4,5:1', () => {
    expect(tokens.contrastPairs.length).toBeGreaterThanOrEqual(2);
    expect(tokens.contrastPairs).toContainEqual(['text', 'surface']);
    expect(tokens.contrastPairs).toContainEqual(['textSecondary', 'surface']);
    for (const [fg, bg] of tokens.contrastPairs) expect(contrast(colorOf(fg!), colorOf(bg!)), `${fg} sobre ${bg}`).toBeGreaterThanOrEqual(4.5);
    for (const [fg, bg] of tokens.stripContrastPairs) expect(contrast(fg!, colorOf(bg!)), `${fg} sobre faixa ${bg}`).toBeGreaterThanOrEqual(4.5);
    // Sobre a superfície suave e o fundo geral o texto também se mantém legível.
    for (const bg of ['canvas', 'surfaceSoft']) expect(contrast(tokens.colors.textSecondary, colorOf(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it('VS-004: o botão azul claro usa texto escuro legível (primaryInk), não branco', () => {
    expect(contrast(tokens.colors.primaryInk, tokens.colors.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#FFFFFF', tokens.colors.primary)).toBeLessThan(4.5);
    const rule = /\.pocket-button\s*\{([^}]*)\}/.exec(css)![1]!;
    expect(rule).toMatch(/color:\s*var\(--pocket-primary-ink\)/);
    expect(rule).toMatch(/background:\s*var\(--pocket-primary\)/);
  });

  it('VS-005: laranja (Fogo/faixa adversária) não é usado como cor global de ação', () => {
    const orange = [tokens.typeColors.FIRE, tokens.attackStripColors.FIRE, tokens.colors.opponentBand].map((h) => h.toUpperCase());
    const dir = fileURLToPath(new URL('../../ui/styles/', import.meta.url));
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.css') && f !== 'theme-pocket.css')) {
      const text = readFileSync(`${dir}${file}`, 'utf8');
      for (const rule of text.split('}')) {
        const [selector = '', body = ''] = rule.split('{');
        const usesOrange = /--pocket-(type|strip)-fire|--pocket-opponent-band/.test(body) || orange.some((h) => body.toUpperCase().includes(h));
        if (!usesOrange) continue;
        // Permitido só em seletores do tipo Fogo ou na faixa distante do tabuleiro, nunca em botões/ações.
        expect(/fire|board/i.test(selector), `${file}: ${selector.trim()}`).toBe(true);
        expect(/button|btn|action|primary|cta/i.test(selector), `${file}: ${selector.trim()}`).toBe(false);
      }
    }
  });
});
