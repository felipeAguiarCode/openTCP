// Estimativa de encaixe de texto no template pocket-light-card-v1 (editor-de-cartas.md §19.4, ED-044).
// Modelo métrico conservador derivado do compositor HTML (largura de referência 220 px, corpo a 0,78 em):
// cada parágrafo de ataque/Habilidade tem no máximo 3 linhas visíveis e o corpo comporta ~12 linhas.
// Overflow crítico bloqueia a publicação; o editor nunca reduz o texto indefinidamente nem recorta em silêncio.
import type { CardFaceData } from '../cards/text.ts';
import { BODY_CHARS_PER_LINE, PARAGRAPH_MAX_LINES, wrapLines } from '../cards/wrap.ts';

export { wrapLines };

export const TEXT_FIT_MODEL = {
  version: 'text-fit-v1',
  /** Caracteres médios por linha no corpo (Nunito 0,78 em em 198 px úteis). */
  bodyCharsPerLine: BODY_CHARS_PER_LINE,
  /** Linhas úteis do corpo para Pokémon (há rodapé Fraqueza/Recuo) e Treinador (sem rodapé). */
  pokemonBodyLines: 12,
  trainerBodyLines: 13,
  /** Limites de linhas visíveis por parágrafo no template (clamp do compositor). */
  paragraphMaxLines: PARAGRAPH_MAX_LINES,
  trainerParagraphMaxLines: 6,
  ruleBoxCharsPerLine: 58,
  attackStripLines: 1.5,
  abilityTitleLines: 1,
  blockGapLines: 0.3,
  /** Nome no cabeçalho: até 22 caracteres cabem; acima de 26 o nome fica ilegível. */
  nameComfortChars: 22,
  nameMaxChars: 26,
} as const;

export type FitRegion = {
  readonly id: string;
  readonly label: string;
  readonly lines: number;
  readonly maxLines: number;
  readonly overflow: boolean;
  /** Caminho no rascunho para “Ir para o campo”. */
  readonly path: readonly (string | number)[];
};

export type TextFit = {
  readonly model: string;
  readonly regions: readonly FitRegion[];
  readonly bodyLines: number;
  readonly bodyCapacity: number;
  readonly bodyOverflow: boolean;
  /** Região a partir da qual o corpo deixa de caber (null se cabe). */
  readonly firstOverflowRegion: string | null;
  readonly nameChars: number;
  readonly nameStatus: 'OK' | 'TIGHT' | 'OVERFLOW';
  readonly attackNameOverflow: readonly string[];
};

const ORDINAL = ['primeiro', 'segundo', 'terceiro', 'quarto'];

export function estimateTextFit(face: CardFaceData): TextFit {
  const m = TEXT_FIT_MODEL;
  const trainer = face.category === 'TRAINER';
  const regions: FitRegion[] = [];
  face.abilities.forEach((a, i) => {
    const lines = wrapLines(a.text, m.bodyCharsPerLine);
    regions.push({ id: `ability:${i}`, label: `${ORDINAL[i] ?? `${i + 1}º`} texto de Habilidade (“${a.name}”)`, lines: m.abilityTitleLines + lines, maxLines: m.abilityTitleLines + m.paragraphMaxLines, overflow: lines > m.paragraphMaxLines, path: ['rules', 'abilities', i] });
  });
  face.attacks.forEach((a, i) => {
    const lines = wrapLines(a.text, m.bodyCharsPerLine);
    regions.push({ id: `attack:${i}`, label: `${ORDINAL[i] ?? `${i + 1}º`} ataque (“${a.name}”)`, lines: m.attackStripLines + lines, maxLines: m.attackStripLines + m.paragraphMaxLines, overflow: lines > m.paragraphMaxLines, path: ['rules', 'attacks', i] });
  });
  if (trainer && face.trainerText) {
    const lines = wrapLines(face.trainerText, m.bodyCharsPerLine);
    regions.push({ id: 'trainer', label: 'texto do Treinador', lines, maxLines: m.trainerParagraphMaxLines, overflow: lines > m.trainerParagraphMaxLines, path: ['rules', 'trainerEffects'] });
  }
  if (face.ruleBoxText) {
    const lines = wrapLines(face.ruleBoxText, m.ruleBoxCharsPerLine);
    regions.push({ id: 'rulebox', label: 'caixa de regra ex', lines, maxLines: m.paragraphMaxLines, overflow: lines > m.paragraphMaxLines, path: ['rules', 'ruleBox'] });
  }
  const capacity = trainer ? m.trainerBodyLines : m.pokemonBodyLines;
  let used = 0;
  let firstOverflow: string | null = null;
  regions.forEach((r, i) => {
    used += Math.min(r.lines, r.maxLines) + (i > 0 ? m.blockGapLines : 0);
    if (firstOverflow === null && used > capacity + 1e-9) firstOverflow = r.id;
  });
  const nameChars = [...face.name].length;
  const attackNameOverflow = face.attacks.flatMap((a, i) => {
    // Faixa: ~198 px − ícones de custo (≈9 px cada) − dano (≈5,5 px por caractere) − margens; nome a ≈4,4 px por caractere.
    const available = 198 - 13 - a.cost.length * 9 - [...a.damage].length * 5.5;
    return [...a.name].length * 4.4 > available ? [`attack:${i}`] : [];
  });
  return {
    model: m.version,
    regions,
    bodyLines: Math.round(used * 10) / 10,
    bodyCapacity: capacity,
    bodyOverflow: used > capacity + 1e-9,
    firstOverflowRegion: firstOverflow,
    nameChars,
    nameStatus: nameChars > m.nameMaxChars ? 'OVERFLOW' : nameChars > m.nameComfortChars ? 'TIGHT' : 'OK',
    attackNameOverflow,
  };
}
