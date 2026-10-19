// Fonte OFL da face das cartas (direção visual §4): Nunito empacotada localmente via @fontsource
// (arquivos woff2 importados com ?url — nunca da rede). A textura gerada é idêntica em qualquer SO.
import nunito400 from '@fontsource/nunito/files/nunito-latin-400-normal.woff2?url';
import nunito600 from '@fontsource/nunito/files/nunito-latin-600-normal.woff2?url';
import nunito700 from '@fontsource/nunito/files/nunito-latin-700-normal.woff2?url';
import nunito800 from '@fontsource/nunito/files/nunito-latin-800-normal.woff2?url';
import nunito900 from '@fontsource/nunito/files/nunito-latin-900-normal.woff2?url';
import nunito600i from '@fontsource/nunito/files/nunito-latin-600-italic.woff2?url';
import nunito800i from '@fontsource/nunito/files/nunito-latin-800-italic.woff2?url';
import { CARD_FONT_FAMILY } from '../core/tokens.ts';

export const CARD_FONT_STACK = `${CARD_FONT_FAMILY}, 'Segoe UI', system-ui, sans-serif`;

type State = 'IDLE' | 'LOADING' | 'READY' | 'FAILED';
let state: State = 'IDLE';
let pending: Promise<boolean> | null = null;
const listeners = new Set<() => void>();

const FACES: readonly { url: string; weight: string; style: 'normal' | 'italic' }[] = [
  { url: nunito400, weight: '400', style: 'normal' },
  { url: nunito600, weight: '600', style: 'normal' },
  { url: nunito700, weight: '700', style: 'normal' },
  { url: nunito800, weight: '800', style: 'normal' },
  { url: nunito900, weight: '900', style: 'normal' },
  { url: nunito600i, weight: '600', style: 'italic' },
  { url: nunito800i, weight: '800', style: 'italic' },
];

/** Carrega as faces locais uma vez; resolve true quando prontas (false = fallback do sistema). */
export function loadCardFonts(): Promise<boolean> {
  if (pending) return pending;
  if (typeof FontFace === 'undefined' || typeof document === 'undefined') {
    state = 'FAILED';
    pending = Promise.resolve(false);
    return pending;
  }
  state = 'LOADING';
  pending = Promise.all(FACES.map(async (f) => {
    const face = new FontFace(CARD_FONT_FAMILY, `url(${f.url}) format('woff2')`, { weight: f.weight, style: f.style, display: 'block' });
    await face.load();
    document.fonts.add(face);
  }))
    .then(() => {
      state = 'READY';
      for (const cb of [...listeners]) cb();
      return true;
    })
    .catch(() => {
      state = 'FAILED';
      return false;
    });
  return pending;
}

export function cardFontsReady(): boolean {
  return state === 'READY';
}

/** Etiqueta da fonte efetiva, parte da chave de cache da face (fallback ≠ Nunito). */
export function cardFontTag(): string {
  return state === 'READY' ? 'nunito' : 'fallback';
}

export function onCardFontsReady(cb: () => void): () => void {
  if (state === 'READY') {
    cb();
    return () => undefined;
  }
  listeners.add(cb);
  return () => listeners.delete(cb);
}
