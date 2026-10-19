// Quebra de linha do corpo da carta no template pocket-light-card-v1 (modelo text-fit-v1, editor-de-cartas.md §19.4).
// Fica no domínio das cartas porque o texto de regras escolhe a forma compacta quando a completa não cabe.

/** Caracteres médios por linha no corpo (Nunito 0,78 em em 198 px úteis). */
export const BODY_CHARS_PER_LINE = 50;
/** Linhas visíveis por parágrafo de ataque/Habilidade (clamp do compositor). */
export const PARAGRAPH_MAX_LINES = 3;

/** Quebra gulosa por palavras; palavras maiores que a linha ocupam linhas inteiras. */
export function wrapLines(text: string, charsPerLine: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 0;
  let lines = 1;
  let current = 0;
  for (const word of words) {
    const len = [...word].length;
    if (current === 0) {
      lines += Math.max(0, Math.ceil(len / charsPerLine) - 1);
      current = len % charsPerLine || charsPerLine;
    } else if (current + 1 + len <= charsPerLine) {
      current += 1 + len;
    } else {
      lines += Math.ceil(len / charsPerLine);
      current = len % charsPerLine || charsPerLine;
    }
  }
  return lines;
}
