// Ajuste de texto puro (medida injetada → testável em Node). Regra: nunca transbordar — primeiro reduz
// a fonte até o limite, depois trunca com reticências.

export type FontSpec = { readonly sizePx: number; readonly weight: number; readonly italic?: boolean };
export type Measure = (text: string, font: FontSpec) => number;

export const ELLIPSIS = '…';

export function withSize(font: FontSpec, sizePx: number): FontSpec {
  return { ...font, sizePx };
}

/** Corta o texto até caber em `maxWidth`, acrescentando reticências; vazio se nem a reticência cabe. */
export function ellipsize(text: string, maxWidth: number, font: FontSpec, measure: Measure): string {
  if (measure(text, font) <= maxWidth) return text;
  if (measure(ELLIPSIS, font) > maxWidth) return '';
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = text.slice(0, mid).trimEnd() + ELLIPSIS;
    if (measure(candidate, font) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo).trimEnd() + ELLIPSIS;
}

/** Quebra gulosa por palavras; palavra maior que a linha é quebrada por caracteres. */
export function wrapWords(text: string, maxWidth: number, font: FontSpec, measure: Measure): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines: string[] = [];
  let line = '';
  const pushLong = (word: string) => {
    let rest = word;
    while (rest.length) {
      let n = rest.length;
      while (n > 1 && measure(rest.slice(0, n), font) > maxWidth) n -= 1;
      lines.push(rest.slice(0, n));
      rest = rest.slice(n);
    }
  };
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate, font) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = '';
    if (measure(word, font) <= maxWidth) line = word;
    else {
      pushLong(word);
      line = lines.pop() ?? '';
    }
  }
  if (line) lines.push(line);
  return lines;
}

export type FittedLine = { readonly text: string; readonly font: FontSpec; readonly truncated: boolean };

/** Uma linha: reduz de `font.sizePx` até `minSizePx` (passo 0,5); depois reticências. */
export function fitLine(text: string, maxWidth: number, font: FontSpec, minSizePx: number, measure: Measure): FittedLine {
  for (let size = font.sizePx; size >= minSizePx - 1e-9; size -= 0.5) {
    const f = withSize(font, size);
    if (measure(text, f) <= maxWidth) return { text, font: f, truncated: false };
  }
  const f = withSize(font, minSizePx);
  return { text: ellipsize(text, maxWidth, f, measure), font: f, truncated: true };
}

export type FittedParagraph = { readonly lines: readonly string[]; readonly font: FontSpec; readonly lineHeightPx: number; readonly truncated: boolean };

/** Parágrafo em caixa: reduz até `minSizePx`; se ainda exceder, mantém as linhas que cabem e trunca a última. */
export function fitParagraph(text: string, maxWidth: number, maxHeight: number, font: FontSpec, minSizePx: number, lineHeight: number, measure: Measure): FittedParagraph {
  for (let size = font.sizePx; size >= minSizePx - 1e-9; size -= 0.5) {
    const f = withSize(font, size);
    const lines = wrapWords(text, maxWidth, f, measure);
    if (lines.length * size * lineHeight <= maxHeight + 1e-6) return { lines, font: f, lineHeightPx: size * lineHeight, truncated: false };
  }
  const f = withSize(font, minSizePx);
  const lh = minSizePx * lineHeight;
  const maxLines = Math.max(0, Math.floor((maxHeight + 1e-6) / lh));
  const lines = wrapWords(text, maxWidth, f, measure);
  if (lines.length <= maxLines) return { lines, font: f, lineHeightPx: lh, truncated: false };
  const kept = lines.slice(0, maxLines);
  if (kept.length) kept[kept.length - 1] = ellipsize(`${kept[kept.length - 1]!} ${lines[maxLines] ?? ''}`.trim(), maxWidth, f, measure);
  return { lines: kept, font: f, lineHeightPx: lh, truncated: true };
}

// ------------------------------------------------------------------------- área de regras da carta

export type RulesBlock = {
  readonly kind: 'ability' | 'attack' | 'text';
  /** Título (nome do ataque/Habilidade); ausente em texto corrido. */
  readonly title?: string;
  /** Texto à direita do título (dano). */
  readonly titleRight?: string;
  /** Largura reservada à esquerda do título (custos de Energia) em px na escala 1. */
  readonly leadingWidth?: number;
  /** Rótulo da Habilidade (pílula) em px na escala 1. */
  readonly badgeWidth?: number;
  readonly body: string;
};

export type RulesStyle = {
  readonly titleFont: FontSpec;
  readonly rightFont: FontSpec;
  readonly bodyFont: FontSpec;
  readonly lineHeight: number;
  readonly titleHeightFactor: number;
  readonly blockGap: number;
  readonly minScale: number;
};

export type LaidOutBlock = {
  readonly block: RulesBlock;
  readonly y: number;
  readonly height: number;
  readonly title: FittedLine | null;
  readonly right: FittedLine | null;
  readonly leadingWidth: number;
  readonly badgeWidth: number;
  readonly bodyLines: readonly string[];
  readonly bodyFont: FontSpec;
  readonly bodyLineHeight: number;
  readonly titleHeight: number;
};

export type RulesLayout = {
  readonly blocks: readonly LaidOutBlock[];
  readonly scale: number;
  readonly totalHeight: number;
  readonly truncated: boolean;
};

function layoutAt(blocks: readonly RulesBlock[], width: number, style: RulesStyle, k: number, measure: Measure, maxBodyLines: number | null): { laid: LaidOutBlock[]; height: number; truncated: boolean } {
  const laid: LaidOutBlock[] = [];
  let y = 0;
  let truncated = false;
  const gap = style.blockGap * k;
  blocks.forEach((block, i) => {
    const bodyFont = withSize(style.bodyFont, style.bodyFont.sizePx * k);
    const bodyLineHeight = bodyFont.sizePx * style.lineHeight;
    let title: FittedLine | null = null;
    let right: FittedLine | null = null;
    const leadingWidth = (block.leadingWidth ?? 0) * k;
    const badgeWidth = (block.badgeWidth ?? 0) * k;
    let titleHeight = 0;
    if (block.title !== undefined) {
      const rightFont = withSize(style.rightFont, style.rightFont.sizePx * k);
      right = block.titleRight ? { text: block.titleRight, font: rightFont, truncated: false } : null;
      const rightWidth = right ? measure(right.text, rightFont) + 8 * k : 0;
      const titleWidth = Math.max(0, width - leadingWidth - badgeWidth - rightWidth);
      const titleFont = withSize(style.titleFont, style.titleFont.sizePx * k);
      title = fitLine(block.title, titleWidth, titleFont, titleFont.sizePx * 0.75, measure);
      if (title.truncated) truncated = true;
      titleHeight = Math.max(titleFont.sizePx, rightFont.sizePx) * style.titleHeightFactor;
    }
    let bodyLines = block.body ? wrapWords(block.body, width, bodyFont, measure) : [];
    if (maxBodyLines !== null && bodyLines.length > maxBodyLines) {
      const kept = bodyLines.slice(0, maxBodyLines);
      if (kept.length) kept[kept.length - 1] = ellipsize(`${kept[kept.length - 1]!} ${bodyLines[maxBodyLines] ?? ''}`.trim(), width, bodyFont, measure);
      bodyLines = kept;
      truncated = true;
    }
    const height = titleHeight + bodyLines.length * bodyLineHeight;
    laid.push({ block, y, height, title, right, leadingWidth, badgeWidth, bodyLines, bodyFont, bodyLineHeight, titleHeight });
    y += height + (i < blocks.length - 1 ? gap : 0);
  });
  return { laid, height: y, truncated };
}

/**
 * Distribui ataques/Habilidades/texto numa área fixa: escala única dos tamanhos (1 → minScale); se ainda
 * exceder, limita linhas de corpo (reticências); em último caso remove blocos finais (marca truncado).
 */
export function layoutRules(blocks: readonly RulesBlock[], width: number, height: number, style: RulesStyle, measure: Measure): RulesLayout {
  for (let k = 1; k >= style.minScale - 1e-9; k -= 0.04) {
    const r = layoutAt(blocks, width, style, k, measure, null);
    if (r.height <= height + 1e-6) return { blocks: r.laid, scale: k, totalHeight: r.height, truncated: r.truncated };
  }
  const k = style.minScale;
  for (let maxLines = 6; maxLines >= 0; maxLines -= 1) {
    const r = layoutAt(blocks, width, style, k, measure, maxLines);
    if (r.height <= height + 1e-6) return { blocks: r.laid, scale: k, totalHeight: r.height, truncated: true };
  }
  for (let n = blocks.length - 1; n >= 0; n -= 1) {
    const r = layoutAt(blocks.slice(0, n), width, style, k, measure, 0);
    if (r.height <= height + 1e-6) return { blocks: r.laid, scale: k, totalHeight: r.height, truncated: true };
  }
  return { blocks: [], scale: k, totalHeight: 0, truncated: blocks.length > 0 };
}

/** Medida aproximada para testes e fallback sem canvas (Nunito ~0,52 em por glifo). */
export const approximateMeasure: Measure = (text, font) => {
  let units = 0;
  for (const ch of text) {
    if (ch === ' ') units += 0.27;
    else if ('il.,:;|!\'’'.includes(ch)) units += 0.28;
    else if ('mwMW'.includes(ch)) units += 0.82;
    else if (ch >= 'A' && ch <= 'Z') units += 0.64;
    else if (ch >= '0' && ch <= '9') units += 0.56;
    else units += 0.52;
  }
  return units * font.sizePx * (font.weight >= 700 ? 1.06 : 1);
};
