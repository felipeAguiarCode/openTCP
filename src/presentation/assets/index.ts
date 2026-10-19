// Arte fixa do verso das cartas (deck, mão do adversário, cartas ocultas e mesa 3D). Fornecida pelo autor
// do projeto; origem e restrições em src/presentation/assets/ASSETS.md. Importada pelo Vite com hash. A imagem já
// traz a moldura prateada e os cantos arredondados (transparentes): é desenhada de borda a borda, sem filete extra.
import cardBackUrl from './card-back.webp?url';

export const CARD_BACK_URL: string = cardBackUrl;

/** Publica a arte como variável CSS (`--card-back-image`) para todo verso desenhado em HTML. */
export function installCardBack(root: HTMLElement = document.documentElement): void {
  root.style.setProperty('--card-back-image', `url("${cardBackUrl}")`);
}
