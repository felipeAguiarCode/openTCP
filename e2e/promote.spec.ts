// Promoção depois do nocaute (gameplay-pocket §8; UI-172): sem painel de escolha. Uma mensagem simples no centro, os
// Pokémon do Banco que podem subir flutuam e o jogador arrasta um deles até o Ativo. Cenário real no Treino com um deck
// só de Básicos (importado da coleção inicial): Banco cheio na preparação e turnos passados até o nocaute do Ativo.
import type { Page } from '@playwright/test';
import { centerOf, drag, expect, newGame, openPause, test, waitOpening } from './support.ts';

const BASICS = [
  'a1-033-charmander', 'a1-042-ponyta', 'a1-053-squirtle', 'a1-074-staryu', 'a1-001-bulbasaur',
  'a1-021-exeggcute', 'a4-067-mareep', 'a3a-016-blitzle', 'a3-094-timburr', 'a2a-043-meditite',
];
const prompt = (page: Page) => page.locator('[data-testid="promote-prompt"]');
const handButtons = (page: Page) => page.locator('[data-anchor="HUMAN_HAND"] button');

/** S11 → S12: importa a lista (20 Básicos, 2 cópias de cada, todos da coleção inicial) e salva a versão. */
async function importBasicsDeck(page: Page): Promise<void> {
  await page.goto('/#/decks');
  const list = { format: 'card-campaign-deck-list', version: 1, name: 'Só Básicos', energyTypes: ['FIRE'], entries: BASICS.map((printingId) => ({ printingId, count: 2 })) };
  await page.locator('input[type="file"]').setInputFiles({ name: 'so-basicos.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(list)) });
  await expect(page).toHaveURL(/#\/decks\/.+\/edit/);
  await page.click('[data-testid="deck-confirm"]');
  await expect(page.getByText('Versão do deck salva.')).toBeVisible();
}

test('UI-172 promoção: mensagem no centro, Banco flutuando e arrasto até o Ativo, sem painel', async ({ page }) => {
  test.setTimeout(480_000);
  await newGame(page, 'Ana');
  await importBasicsDeck(page);
  await page.goto('/#/battle/training');
  await page.locator('select[aria-label="Escolher deck"]').selectOption({ label: 'Só Básicos' });
  await page.click('[data-testid="start-training"]');
  await expect(page).toHaveURL(/#\/matches\//);
  await waitOpening(page);

  // Preparação: a mão inicial é só de Básicos — o primeiro vai ao Ativo e os seguintes enchem o Banco.
  await expect(page.locator('[data-testid="setup-confirm"]')).toBeVisible({ timeout: 30_000 });
  for (let i = 0; i < 4; i += 1) {
    if (!(await handButtons(page).count())) break;
    await handButtons(page).first().focus();
    await page.keyboard.press('Enter');
  }
  await page.click('[data-testid="setup-confirm"]');
  await expect(page.locator('[data-testid="setup-confirm"]')).toHaveCount(0);
  await expect.poll(() => page.locator('[data-anchor^="HUMAN_BENCH_"][data-entity]').count()).toBeGreaterThanOrEqual(2);

  // Passa os turnos sem atacar até o adversário nocautear o Ativo. As checagens não esperam elementos: o botão de
  // finalizar some quando a promoção começa, e uma espera por ele travaria a volta.
  const endTurn = page.locator('[data-testid="end-turn"]');
  const canEndTurn = () => endTurn.evaluateAll((els) => els.some((e) => e.getAttribute('aria-disabled') !== 'true'));
  await expect(async () => {
    expect(page.url(), 'a partida não pode acabar antes da promoção').not.toMatch(/\/result/);
    if (!(await prompt(page).count()) && (await canEndTurn())) {
      await endTurn.click({ timeout: 3000 }).catch(() => undefined);
      const ok = page.locator('[data-testid="confirm-ok"]');
      await ok.waitFor({ timeout: 2000 }).then(() => ok.click({ timeout: 2000 }), () => undefined).catch(() => undefined);
    }
    await expect(prompt(page)).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 360_000, intervals: [500] });

  // Sem painel: só a mensagem simples; o espaço do Ativo está vazio e é o alvo.
  await expect(prompt(page)).toContainText('Escolha o próximo Pokémon Ativo');
  await expect(page.locator('.decision-panel')).toHaveCount(0);
  await expect(page.locator('[data-testid="end-turn"]')).toHaveCount(0);
  await expect(page.locator('[data-anchor="HUMAN_ACTIVE"]')).not.toHaveAttribute('data-entity', /.+/);

  // Mesa 2D: os Pokémon que podem subir flutuam; arrastar um até o Ativo resolve a promoção.
  await openPause(page);
  await page.locator('label.toggle', { hasText: 'Apresentação 2D' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.locator('.board2d')).toHaveCount(1);
  const floating = page.locator('.board2d .b2-slot.is-floating');
  expect(await floating.count()).toBeGreaterThanOrEqual(2);
  const chosen = (await floating.first().getAttribute('data-entity'))!;
  await drag(page, await centerOf(page, `.board2d [data-entity="${chosen}"]`), await centerOf(page, '.board2d [data-anchor="HUMAN_ACTIVE"]'));
  await expect(prompt(page)).toHaveCount(0, { timeout: 20_000 });
  await expect(page.locator('.board2d [data-anchor="HUMAN_ACTIVE"]')).toHaveAttribute('data-entity', chosen, { timeout: 20_000 });
});
