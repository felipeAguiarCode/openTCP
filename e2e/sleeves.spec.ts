// Sleeves do Pocket (interface §23.22; UI-180): na ficha do deck, Acessórios abre a aparência na aba Verso; escolher um
// sleeve do Pocket e aplicar ao deck faz dele o verso das cartas desse deck na mesa (aqui, a 2D do Treino).
import { expect, newGame, openPause, test, waitOpening } from './support.ts';

test('UI-180 verso do deck: Acessórios → aba Verso, sleeve do Pocket aplicado e verso das cartas na mesa', async ({ page }) => {
  await newGame(page, 'Caio');
  await page.goto('/#/decks');
  const first = page.locator('[data-testid="deck-card-0"]');
  const deckName = (await first.locator('.deck-card-name').textContent())!.trim();
  await first.click();
  await page.click('[data-testid="deck-edit"]');
  await expect(page).toHaveURL(/#\/decks\/.+\/edit/);

  // Acessórios → aparência do deck já na aba Verso, com os sleeves em grade e a carta de exemplo virada.
  await page.locator('.deck-mini-panel', { hasText: 'Acessórios' }).click();
  await expect(page).toHaveURL(/#\/decks\/.+\/appearance\?tab=SLEEVE/);
  await expect(page.getByRole('tab', { name: 'Verso' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.workshop-items.is-sleeve img.cosmetic-swatch.is-art')).toHaveCount(78);
  await page.locator('.workshop-item', { has: page.locator('strong', { hasText: /^Verso Pikachu$/ }) }).click();
  const card = page.locator('[data-testid="workshop-sleeve"] .workshop-sleeve-card');
  await expect(card).toHaveAttribute('style', /pikachu/);
  await expect(page.locator('[data-testid="workshop-sleeve"]')).toContainText('Verso Pikachu');
  await page.click('[data-testid="apply-deck"]');
  await expect(page.getByText('Aparência aplicada a este deck.')).toBeVisible();

  // Treino com esse deck: na mesa 2D, o baralho do jogador mostra o sleeve escolhido.
  await page.goto('/#/battle/training');
  await page.locator('select[aria-label="Escolher deck"]').selectOption({ label: deckName });
  await page.click('[data-testid="start-training"]');
  await expect(page).toHaveURL(/#\/matches\//);
  await waitOpening(page);
  await openPause(page);
  await page.locator('label.toggle', { hasText: 'Apresentação 2D' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.locator('.board2d')).toHaveAttribute('style', /--back-human: url\(".*pikachu.*"\)/);
  const back = await page.locator('[data-anchor="HUMAN_DECK_TOP"] .b2-pile-back').evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(back).toMatch(/pikachu/);
});
