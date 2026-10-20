// Decks (interface §13–§14; inspiração .specs/referencias/decks): biblioteca com caixas 3D e capa escolhida, ações em ícones
// flutuantes; ficha do deck com troca de capa, vagas em cartas (clique remove), coleção ao lado (clique adiciona) e
// Salvar versão.
import { expect, newGame, test } from './support.ts';

test('S11/S12: caixas 3D, ações em ícones, capa escolhida, remover/adicionar carta e salvar versão', async ({ page }) => {
  await newGame(page, 'Duda');
  await page.goto('/#/decks');
  const cards = page.locator('.deck-card');
  // Os oito decks iniciais (um por tipo de Energia).
  await expect(cards).toHaveCount(8);
  await expect(cards.first().locator('.deck-box3d .db-front')).toBeVisible();
  await expect(cards.first().locator('.deck-card-featured .card-face')).toHaveCount(2);

  // Seleção: borda + selo e barra de ações só com ícones (rótulo vira dica e nome acessível).
  await page.click('[data-testid="deck-card-0"]');
  await expect(cards.first()).toHaveAttribute('aria-pressed', 'true');
  const bar = page.locator('.deck-fab-bar');
  for (const label of ['Jogar', 'Editar', 'Duplicar', 'Aparência', 'Exportar lista', 'Excluir']) await expect(bar.getByRole('button', { name: label })).toBeVisible();
  expect((await bar.locator('.btn span:not(.sr-only)').allTextContents()).filter((t) => t.trim())).toEqual([]);

  // Ficha: troca de capa pela segunda carta proposta.
  await page.click('[data-testid="deck-edit"]');
  await expect(page).toHaveURL(/\/decks\/.+\/edit/);
  await page.click('[data-testid="deck-cover"]');
  const option = page.locator('.deck-cover-option').nth(1);
  const coverName = (await option.getAttribute('aria-label'))!.replace(/^Usar | como capa$/g, '');
  await option.click();
  await expect(page.locator('.deck-sheet-stage .deck-box3d')).toHaveAttribute('aria-label', new RegExp(`capa ${coverName}$`));

  // Clique numa vaga remove uma cópia; clique na coleção devolve.
  const count = page.locator('.deck-count-pill');
  await expect(count).toHaveAttribute('aria-label', '20 de 20 cartas');
  const slot = page.locator('.deck-slot:not(.is-empty)').first();
  const removed = (await slot.getAttribute('aria-label'))!.replace(/^Remover uma cópia de /, '');
  await slot.click();
  await expect(count).toHaveAttribute('aria-label', '19 de 20 cartas');
  await page.locator('.deck-pool-card:not(.is-blocked)', { has: page.locator('.card-name', { hasText: removed }) }).first().click();
  await expect(count).toHaveAttribute('aria-label', '20 de 20 cartas');
  await page.click('[data-testid="deck-confirm"]');
  await expect(page.getByText('Versão do deck salva.')).toBeVisible();

  // A capa escolhida vale na biblioteca.
  await page.goto('/#/decks');
  await page.click('[data-testid="deck-card-0"]');
  await page.click('[data-testid="deck-edit"]');
  await expect(page.locator('.deck-sheet-stage .deck-box3d')).toHaveAttribute('aria-label', new RegExp(`capa ${coverName}$`));
});
