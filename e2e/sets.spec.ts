// Sets depois do Genetic Apex (conteúdo 3.0.0): Deluxe Pack ex comprado no Empório e aberto com 4 cartas, a tabela
// oficial do pacote Lugia com a 6ª carta e o pacote raro, e o filtro de Expansão das cartas dirigidas.
import { expect, newGame, test } from './support.ts';

test('Deluxe Pack ex: compra no Empório e abertura de 4 cartas', async ({ page }) => {
  await newGame(page, 'Rafa');
  await page.goto('/#/emporium');
  await page.getByRole('button', { name: /^Deluxe Pack ex, 100 Créditos/ }).click();
  await page.click('[data-testid="buy"]');
  await page.click('[data-testid="confirm-ok"]');
  await page.goto('/#/packs');
  await page.locator('[data-testid^="open-pack-a4b"]').first().click();
  await expect(page).toHaveURL(/#\/openings\//);
  await page.click('[data-testid="tear-pack"]');
  for (let i = 0; i < 4; i += 1) await page.click('[data-testid="reveal-next"]');
  await expect(page.locator('#page-title')).toHaveText('Cartas recebidas');
  await expect(page.locator('.opening-summary-card')).toHaveCount(4);
});

test('S05 do pacote Lugia: coluna da 6ª carta e pacote raro com 3 casas', async ({ page }) => {
  await newGame(page, 'Bia');
  await page.goto('/#/packs/pack-a4-lugia');
  await expect(page.getByRole('columnheader', { name: '6ª' })).toBeVisible();
  await expect(page.getByText(/Pacote raro: 0,050% dos pacotes/)).toBeVisible();
  await expect(page.getByText(/6ª carta: 8,330% dos pacotes normais/)).toBeVisible();
});

test('Empório: o filtro de Expansão reduz as cartas dirigidas e mostra o restante em blocos', async ({ page }) => {
  await newGame(page, 'Teo');
  await page.goto('/#/emporium');
  await page.getByRole('tab', { name: 'Cartas dirigidas' }).click();
  await expect(page.getByRole('button', { name: /^Mostrar mais \(\d{3,}\)$/ })).toBeVisible();
  await page.getByRole('combobox', { name: 'Expansão' }).selectOption('a1a');
  // Mythical Island: 86 impressões, 60 na primeira página.
  await expect(page.locator('.emporium-item')).toHaveCount(60);
  await expect(page.getByRole('button', { name: 'Mostrar mais (26)' })).toBeVisible();
  await page.getByRole('button', { name: 'Mostrar mais (26)' }).click();
  await expect(page.locator('.emporium-item')).toHaveCount(86);
});
