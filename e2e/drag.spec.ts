// Jogar arrastando (interface §24.1, §24.16): arrastar a carta da mão até um alvo realçado joga; soltar no campo fora
// dos alvos nega com o motivo e a carta volta à mão. Ações do turno em botões flutuantes (sem caixa) e placas dos
// jogadores com foto e pontos, afastadas das bordas. Mesa 3D (padrão) e 2D.
import type { Page } from '@playwright/test';
import {
  centerOf, drag, expect, handCard3d, handNames, newGame, openActiveActions, openPause, setupActive, startNode, test, waitMyTurnWithEnergy, type Point,
} from './support.ts';

async function toPlay(page: Page, name: string): Promise<void> {
  await newGame(page, name);
  await startNode(page, 'P00-T01');
  await setupActive(page, 'Charmander');
  await waitMyTurnWithEnergy(page);
}

test('arrastar para jogar na mesa 3D: recusa com motivo e volta; alvo realçado joga; ações flutuantes e placas', async ({ page }) => {
  await toPlay(page, 'Gil');
  await expect(page.locator('.stage3d'), 'a partida deve estar na mesa 3D (WebGL2)').toHaveCount(1);

  // Placas: foto em círculo + três pontos grandes; a sua embaixo à esquerda e a do adversário em cima à direita, sem encostar nas bordas.
  for (const who of ['human', 'npc'] as const) {
    const plate = page.locator(`.player-plate-${who}`);
    await expect(plate.locator('.plate-avatar')).toBeVisible();
    await expect(plate.locator('.points-counter span')).toHaveCount(3);
    const box = (await plate.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(16);
    expect(box.y).toBeGreaterThanOrEqual(16);
    expect(box.x + box.width).toBeLessThanOrEqual(1920 - 16);
    expect(box.y + box.height).toBeLessThanOrEqual(1080 - 16);
    expect((await plate.locator('.points-counter span').first().boundingBox())!.width).toBeGreaterThanOrEqual(32);
  }
  const human = (await page.locator('.player-plate-human').boundingBox())!;
  const npc = (await page.locator('.player-plate-npc').boundingBox())!;
  expect(human.x).toBeLessThan(400);
  expect(npc.x).toBeGreaterThan(1400);
  // Foto à esquerda na sua placa e à direita na do adversário.
  expect((await page.locator('.player-plate-human .plate-avatar').boundingBox())!.x).toBeLessThan((await page.locator('.player-plate-human .points-counter').boundingBox())!.x);
  expect((await page.locator('.player-plate-npc .plate-avatar').boundingBox())!.x).toBeGreaterThan((await page.locator('.player-plate-npc .points-counter').boundingBox())!.x);

  // Ataques e Recuar não ficam à vista: tocar no Ativo abre a ficha com a carta ampliada; Esc fecha.
  await expect(page.locator('.attack-button')).toHaveCount(0);
  await openActiveActions(page);
  await expect(page.locator('[data-testid="card-actions"] .attack-button', { hasText: 'Brasa' })).toBeVisible();
  await expect(page.locator('[data-testid="card-actions"] [data-testid="retreat"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-testid="card-actions"]')).toHaveCount(0);

  // Básico solto no Ativo do adversário: nega com o motivo e a carta continua na mão.
  const from = await handCard3d(page, 'Ponyta');
  await drag(page, from, await centerOf(page, '[data-anchor="NPC_ACTIVE"]'));
  await expect(page.locator('[data-testid="drop-deny"]')).toHaveText('Coloque no seu Banco');
  await page.waitForTimeout(600);
  expect(await handNames(page)).toContain('Ponyta');

  // Solto num espaço vazio do Banco (realçado durante o arrasto): joga.
  await drag(page, await handCard3d(page, 'Ponyta'), await centerOf(page, '[data-anchor="HUMAN_BENCH_0"]'));
  await expect(page.locator('[data-anchor="HUMAN_BENCH_0"]')).toHaveAttribute('data-entity', /.+/);
  await expect.poll(() => handNames(page)).not.toContain('Ponyta');
});

test('arrastar para jogar na mesa 2D: mesmas regras pela carta fantasma', async ({ page }) => {
  await toPlay(page, 'Hana');
  await openPause(page);
  await page.locator('label.toggle', { hasText: 'Apresentação 2D' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.locator('.board2d')).toHaveCount(1);

  const card = page.locator('.hand2d-card', { has: page.locator('.card-name', { hasText: 'Ponyta' }) });
  const grab = async (): Promise<Point> => {
    const b = (await card.boundingBox())!;
    return { x: b.x + b.width * 0.25, y: b.y + b.height * 0.45 };
  };
  await drag(page, await grab(), await centerOf(page, '[data-anchor="NPC_ACTIVE"]'));
  await expect(page.locator('[data-testid="drop-deny"]')).toHaveText('Coloque no seu Banco');
  await expect(page.locator('.hand2d-ghost')).toHaveCount(0, { timeout: 2000 });
  await expect(card).toHaveCount(1);

  await drag(page, await grab(), await centerOf(page, '[data-anchor="HUMAN_BENCH_1"]'));
  await expect(page.locator('[data-anchor="HUMAN_BENCH_1"]')).toHaveAttribute('data-entity', /.+/);
  await expect(card).toHaveCount(0);

  // Orbe da Energia arrastado livremente até o Ativo: liga a Energia.
  const active = page.locator('[data-anchor="HUMAN_ACTIVE"]');
  await expect(active).toHaveAttribute('aria-label', /sem Energia/);
  await expect(page.locator('[data-anchor="HUMAN_ENERGY_READY"]')).toBeEnabled();
  await drag(page, await centerOf(page, '[data-anchor="HUMAN_ENERGY_READY"]'), await centerOf(page, '[data-anchor="HUMAN_ACTIVE"]'));
  await expect(active).toHaveAttribute('aria-label', /1 Energia\(s\)/);
});
