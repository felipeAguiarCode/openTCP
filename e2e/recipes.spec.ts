// Receitas de deck (interface §13.8; UI-178) e a caixa de deck retangular do Pocket (UI-179): da biblioteca às
// receitas, filtros, a receita aberta com as cartas que faltam e “Montar rascunho”, que abre o editor com a lista.
import { expect, newGame, test } from './support.ts';

test('UI-178/UI-179 receitas: prateleira, filtros, receita com o que falta, rascunho no editor e caixa retangular', async ({ page }) => {
  await newGame(page, 'Bia');
  await page.goto('/#/decks');
  await page.click('[data-testid="deck-recipes"]');
  await expect(page).toHaveURL(/#\/decks\/recipes$/);

  // Prateleira: 55 receitas; categoria, tipo e busca filtram.
  const shelf = page.locator('[data-testid="recipe-shelf"] .deck-card');
  await expect(shelf).toHaveCount(55);
  await page.getByRole('tab', { name: /^Meta/ }).click();
  await expect(shelf).toHaveCount(22);
  await page.getByRole('tab', { name: /^Todas/ }).click();
  await page.locator('.recipe-filters .deck-energy[title="Metálico"]').click();
  await expect.poll(() => shelf.count()).toBeLessThan(55);
  expect(await shelf.count()).toBeGreaterThanOrEqual(2);
  await page.locator('.recipe-filters .deck-energy[title="Metálico"]').click();
  await page.getByRole('searchbox', { name: 'Buscar receita ou carta' }).fill('Zapdos');
  await expect(page.locator('[data-testid="recipe-meta-pikachu-ex-zapdos-ex"]')).toBeVisible();

  // Caixa de deck como a do Pocket: frente em pé (mais alta que larga), com a carta numa janela e o emblema na lateral.
  const card = page.locator('[data-testid="recipe-meta-pikachu-ex-zapdos-ex"]');
  await expect(card.locator('.deck-box3d .db-card')).toBeVisible();
  await expect(card.locator('.deck-box3d .db-emblem')).toHaveCount(1);
  const front = (await card.locator('.deck-box3d .db-front').boundingBox())!;
  expect(front.height).toBeGreaterThan(front.width * 1.1);

  // Receita aberta: a coleção inicial cobre só os Treinadores (8 de 20); as 12 que faltam aparecem marcadas.
  await card.click();
  await expect(page).toHaveURL(/#\/decks\/recipes\/meta-pikachu-ex-zapdos-ex$/);
  await expect(page.locator('[data-testid="recipe-progress"]')).toContainText('8 de 20 cartas na coleção');
  await expect(page.locator('.recipe-card.is-missing')).toHaveCount(12);
  await expect(page.locator('[data-testid="recipe-missing"]')).toContainText('Faltam 12 carta(s)');

  // Montar: o editor abre com o nome, a Energia e as 20 cartas; o deck fica como rascunho até a coleção cobrir tudo.
  await page.click('[data-testid="recipe-build"]');
  await expect(page).toHaveURL(/#\/decks\/.+\/edit/);
  await expect(page.getByRole('textbox', { name: 'Nome do deck' })).toHaveValue('Pikachu ex e Zapdos ex');
  await expect(page.locator('.deck-count-pill')).toHaveAttribute('aria-label', '20 de 20 cartas');
  await expect(page.getByText('Você possui 0 de 2 cópias de Pikachu ex.')).toBeVisible();
});
