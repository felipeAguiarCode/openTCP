// Menus em caixas no estilo dos menus da EA/Madden (interface §3.1, §5.6, §7; UI-170, UI-171): abas no topo com
// sub-abas, Q/E trocando de aba, utilitários no cabeçalho, hubs em mosaico e nada vazando para os lados.
import { expect, newGame, test } from './support.ts';

const SCREENS = ['/home', '/battle', '/campaign', '/challenges', '/arena', '/opponents', '/collection', '/decks', '/decks/recipes', '/decks/recipes/meta-lugia-ex-ho-oh-ex', '/packs', '/emporium', '/card-studio', '/saves', '/settings'];

test('UI-170/UI-171 abas no topo, sub-abas, Q/E e hubs em caixas sem rolagem horizontal', async ({ page }) => {
  await newGame(page, 'Ana');
  await expect(page.locator('[data-testid="nav-home"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.home .menu-tile')).toHaveCount(8);
  await expect(page.locator('[data-testid="home-continue"]')).toBeFocused();

  // Aba JOGAR → visão geral em caixas → Campanha: a aba continua ativa e a sub-aba acompanha a rota.
  await page.click('[data-testid="nav-play"]');
  await expect(page).toHaveURL(/#\/battle$/);
  await expect(page.locator('[data-testid="subnav-S14"]')).toHaveAttribute('aria-current', 'page');
  await page.click('[data-testid="hub-campaign"]');
  await expect(page).toHaveURL(/#\/campaign$/);
  await expect(page.locator('[data-testid="nav-play"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-testid="subnav-S19"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.chapter-strip .menu-tile')).toHaveCount(8);

  // Q/E, como os bumpers: próxima e anterior aba.
  await page.keyboard.press('e');
  await expect(page).toHaveURL(/#\/collection$/);
  await expect(page.locator('[data-testid="nav-collection"]')).toHaveAttribute('aria-current', 'page');
  await page.keyboard.press('q');
  await expect(page).toHaveURL(/#\/battle$/);

  // Utilitários no cabeçalho não ativam aba.
  await page.click('[data-testid="util-S36"]');
  await expect(page).toHaveURL(/#\/settings$/);
  await expect(page.locator('.top-tab[aria-current="page"]')).toHaveCount(0);

  // Nada vaza para os lados, em 1920×1080 e 1280×720.
  for (const [width, height] of [[1920, 1080], [1280, 720]] as const) {
    await page.setViewportSize({ width, height });
    for (const path of [...SCREENS, '/start']) {
      await page.goto(`/#${path}`);
      await page.locator('#page-title, .entry-title').first().waitFor();
      const overflow = await page.evaluate(() => {
        const main = document.querySelector('.app-main') as HTMLElement | null;
        const doc = document.documentElement;
        return { doc: doc.scrollWidth - doc.clientWidth, main: main ? main.scrollWidth - main.clientWidth : 0 };
      });
      expect(overflow, `${path} em ${width}×${height}`).toEqual({ doc: 0, main: 0 });
    }
  }
});
