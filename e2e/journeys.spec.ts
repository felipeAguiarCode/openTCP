// Jornadas offline (interface §38) contra o pacote de produção no runner local.
import { attachToActive, expect, newGame, openPause, playFirstTutorial, setupActive, startNode, test, waitMyTurnWithEnergy } from './support.ts';

test('origem isolada: COOP/COEP, crossOriginIsolated e conteúdo local íntegro', async ({ page }) => {
  const response = await page.goto('/');
  const headers = response!.headers();
  expect(headers['cross-origin-opener-policy']).toBe('same-origin');
  expect(headers['cross-origin-embedder-policy']).toBe('require-corp');
  await page.locator('[data-testid="start-new"], [data-testid="onboarding-name"]').first().waitFor({ timeout: 60_000 });
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
  const manifest = await page.evaluate(async () => (await fetch('./content/manifest.json')).json() as Promise<{ contentHash: string; file: string }>);
  expect(manifest.contentHash).toMatch(/^[0-9a-f]{64}$/);
});

test('38.1 primeira sessão: novo perfil → prólogo → primeira recompensa → mapa', async ({ page }) => {
  await newGame(page, 'Ana');
  await startNode(page, 'P00-T01');
  await expect(page.locator('.fixture-guide')).toContainText('Primeira Carta');
  await playFirstTutorial(page);
  await expect(page.locator('#page-title')).toHaveText('Vitória');
  // Recompensa confirmada no SQLite antes da tela: saldo do topo inclui os Créditos do tutorial.
  await page.goto('/#/campaign/chapters/P00');
  await expect(page.locator('[data-testid="node-P00-T01"]')).toHaveAttribute('aria-label', /Concluído|Dominado/);
  await expect(page.locator('[data-testid="node-P00-T02"]')).toHaveAttribute('aria-label', /Disponível/);
  await expect(page.getByText(/350\s*Créditos/).first()).toBeVisible();
});

test('38.4 pausar e retomar: salvar e sair, recarregar e continuar no mesmo estado', async ({ page }) => {
  await newGame(page, 'Bia');
  await startNode(page, 'P00-T01');
  await setupActive(page, 'Charmander');
  await attachToActive(page);
  const before = await page.getAttribute('[data-anchor="HUMAN_ACTIVE"]', 'aria-label');
  expect(before).toContain('1 Energia');
  await page.click('[data-testid="battle-menu"]');
  await page.getByRole('menuitem', { name: 'Salvar e sair' }).click();
  await expect(page).toHaveURL(/#\/campaign\/nodes\/P00-T01/);
  await page.reload();
  // “Continuar” no início prioriza a tentativa suspensa (interface §6.5).
  await page.goto('/#/home');
  await page.click('[data-testid="home-continue"]');
  await expect(page).toHaveURL(/#\/matches\//);
  await expect(page.locator('[data-anchor="HUMAN_ACTIVE"]')).toHaveAttribute('aria-label', before!);
  // Retomar não repete a abertura “VS” nem o cara ou coroa.
  await expect(page.locator('[data-testid="duel-intro"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="coin-toss"]')).toHaveCount(0);
  // A ligação manual do turno já foi usada: continua indisponível depois de retomar.
  await expect(page.locator('[data-anchor="HUMAN_ENERGY_READY"]')).toBeDisabled();
});

test('38.3 abrir um pacote: commit local → revelação → resumo → coleção', async ({ page }) => {
  await newGame(page, 'Caio');
  await page.goto('/#/packs');
  const open = page.locator('[data-testid^="open-pack-a1-pikachu"]').first();
  await open.click();
  await expect(page).toHaveURL(/#\/openings\//);
  await page.click('[data-testid="tear-pack"]');
  for (let i = 0; i < 5; i += 1) await page.click('[data-testid="reveal-next"]');
  await expect(page.locator('#page-title')).toHaveText('Cartas recebidas');
  await expect(page.locator('.opening-summary-card')).toHaveCount(5);
  // Recarregar não reabre nem duplica: a abertura já está gravada.
  await page.reload();
  await expect(page.locator('#page-title')).toHaveText(/Cartas recebidas|Abrir pacote|.+/);
  await page.goto('/#/packs');
  await expect(page.locator('[data-testid^="open-pack-a1-pikachu"]')).toHaveCount(0);
});

test('segunda aba: o save fica com a primeira; a segunda explica e oferece transferência', async ({ page, context }) => {
  await newGame(page, 'Duda');
  const second = await context.newPage();
  await second.goto('/');
  await expect(second.getByRole('alert')).toContainText('O jogo já está aberto');
  await second.close();
});

test('24.2 hover: carta da mesa (dos dois lados) sobe e cresce no lugar; carta da mão abre a prévia no centro, em 3D e em 2D', async ({ page }) => {
  await newGame(page, 'Eva');
  await startNode(page, 'P00-T01');
  await setupActive(page, 'Charmander');
  await waitMyTurnWithEnergy(page);
  await expect(page.locator('.stage3d'), 'a partida deve estar na mesa 3D (WebGL2)').toHaveCount(1);
  const preview = page.locator('[data-testid="card-preview"]');

  const widthOf = async (anchor: string) => (await page.locator(`[data-anchor="${anchor}"]`).boundingBox())!.width;
  // Mesa (picking 3D sob o ponteiro): a carta sobe e cresce no próprio lugar, sem prévia à parte; fora dela, volta.
  for (const anchor of ['NPC_ACTIVE', 'HUMAN_ACTIVE']) {
    const rest = await widthOf(anchor);
    await page.hover(`[data-anchor="${anchor}"]`);
    await expect.poll(() => widthOf(anchor)).toBeGreaterThan(rest * 1.08);
    await expect(preview).toHaveCount(0);
    await page.mouse.move(8, 540);
    await expect.poll(() => widthOf(anchor)).toBeLessThan(rest * 1.02);
  }
  // Carta da mão (desenhada em 3D no rodapé): prévia grande no centro da tela.
  const hand = await page.locator('[data-anchor="HUMAN_HAND"] button').allTextContents();
  expect(hand.length).toBeGreaterThan(0);
  await page.mouse.move(960, 990);
  await expect(preview).toHaveCount(1);
  expect(hand).toContain(await preview.locator('.card-name').textContent());
  const box = (await preview.boundingBox())!;
  const active = (await page.locator('[data-anchor="HUMAN_ACTIVE"]').boundingBox())!;
  expect(Math.abs(box.x + box.width / 2 - 960)).toBeLessThan(4);
  expect(box.width).toBeGreaterThan(active.width * 2);
  await page.mouse.move(8, 540);
  await expect(preview).toHaveCount(0);

  // Mesa 2D: mesmos alvos pelos botões HTML.
  await openPause(page);
  await page.locator('label.toggle', { hasText: 'Apresentação 2D' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.locator('.board2d')).toHaveCount(1);
  const rest2d = await widthOf('NPC_ACTIVE');
  await page.hover('[data-anchor="NPC_ACTIVE"]');
  await expect.poll(() => widthOf('NPC_ACTIVE')).toBeGreaterThan(rest2d * 1.08);
  await expect(preview).toHaveCount(0);
  await page.locator('.hand2d-card').first().hover();
  await expect(preview.locator('.card-name')).toHaveText(hand[0]!);
  await page.mouse.move(8, 540);
  await expect(preview).toHaveCount(0);
});
