// Mesa no estilo Pocket, fase 1 (gameplay-pocket §4, §5.1, §7, §8): preparação na própria mesa, aviso no topo,
// tutorial preso à direita, faixa de turno com “Turno atual: N” e menu ≡ em folha.
import type { Page } from '@playwright/test';
import {
  attachToActive, attackWith, centerOf, drag, expect, handCard3d, handNames, newGame, openActiveActions, openPause, playFirstTutorial, setupActive, startNode,
  tapHandCard, test, waitMyTurnWithEnergy,
} from './support.ts';

test('preparação na mesa: aviso, Básico ao Ativo e ao Banco, devolver, Recomeçar e Iniciar duelo; faixa de turno; tutorial à direita; menu em folha', async ({ page }) => {
  await newGame(page, 'Iara');
  await startNode(page, 'P00-T01', { keepIntro: true });

  // Abertura “VS”: rival (Cheren) por cima, você por baixo, os dois retratos, “VS.” e a saudação; some sozinha.
  const intro = page.locator('[data-testid="duel-intro"]');
  await expect(intro).toBeVisible();
  await expect(intro.locator('.duel-name-npc')).toHaveText('Cheren');
  await expect(intro.locator('.duel-name-human')).toHaveText('Iara');
  await expect(intro.locator('.duel-vs')).toHaveText('VS.');
  await expect(intro.locator('.duel-avatar img')).toHaveCount(2);
  await expect(intro.locator('.duel-greeting')).not.toBeEmpty();
  await expect(intro).toHaveCount(0, { timeout: 10_000 });

  // Cara ou coroa de quem começa (UI-176): a moeda equipada no deck (a Poké Bola do preset padrão) gira e cai;
  // cara, você começa; coroa, o rival. O aviso da preparação repete o resultado.
  const toss = page.locator('[data-testid="coin-toss"]');
  await expect(toss).toBeVisible();
  await expect(toss).toContainText('Cara ou coroa?');
  await expect(toss.locator('.coin-disc')).toHaveAttribute('aria-label', 'Moeda Poké Bola');
  await expect(toss.locator('img.coin-face')).toHaveCount(2);
  const result = toss.locator('[data-testid="coin-toss-result"]');
  await expect(result).toHaveText(/^(Cara!Você começa\.|Coroa!Cheren começa\.)$/);
  const heads = (await toss.getAttribute('data-face')) === 'HEADS';
  await expect(toss).toHaveCount(0, { timeout: 10_000 });
  // Placas com os retratos (só a imagem).
  await expect(page.locator('.player-plate-npc img.plate-avatar.is-portrait')).toBeVisible();

  // Sem painel à parte: a mão e os slots são os da mesa; o aviso fica no topo com quem começa.
  await expect(page.locator('.setup-panel')).toHaveCount(0);
  const toast = page.locator('[data-testid="battle-toast"]');
  await expect(toast).toContainText('Coloque um Pokémon Básico no Ativo.');
  await expect(toast).toContainText(heads ? 'Você começa' : 'O adversário começa');
  await expect(page.locator('[data-testid="setup-confirm"]')).toHaveAttribute('aria-disabled', 'true');

  // Tutorial preso à borda direita, sob a placa do adversário.
  const guide = (await page.locator('.match-guide').boundingBox())!;
  const npcPlate = (await page.locator('.player-plate-npc').boundingBox())!;
  expect(guide.x + guide.width).toBeGreaterThanOrEqual(1920 - 2);
  expect(guide.y).toBeGreaterThanOrEqual(npcPlate.y + npcPlate.height - 1);

  // Básico vai ao Ativo; o próximo, ao Banco.
  await tapHandCard(page, 'Charmander');
  await expect(page.locator('[data-anchor="HUMAN_ACTIVE"]')).toHaveAttribute('data-entity', /^staged:/);
  await expect(toast).toContainText('Coloque até 3 Pokémon Básicos no Banco e toque em Iniciar duelo.');
  await tapHandCard(page, 'Ponyta');
  await expect(page.locator('[data-anchor="HUMAN_BENCH_0"]')).toHaveAttribute('data-entity', /^staged:/);

  // Recomeçar devolve tudo à mão.
  await page.click('[data-testid="setup-reset"]');
  await expect(page.locator('[data-anchor="HUMAN_ACTIVE"]')).not.toHaveAttribute('data-entity', /^staged:/);
  await expect(toast).toContainText('Coloque um Pokémon Básico no Ativo.');

  // Inicia com Charmander: a faixa de turno mostra o número do turno.
  await tapHandCard(page, 'Charmander');
  await page.click('[data-testid="setup-confirm"]');
  await expect(page.locator('[data-testid="setup-confirm"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="turn-banner"]')).toContainText(/Turno atual: ?\d+/, { timeout: 15_000 });
  // Faixa centrada na tela (não na divisória).
  const strip = (await page.locator('.turn-band-strip').boundingBox())!;
  expect(Math.abs(strip.y + strip.height / 2 - 540)).toBeLessThan(8);
  expect(strip.width).toBeGreaterThanOrEqual(1900);
  await expect(page.locator('[data-anchor="HUMAN_ACTIVE"]')).toHaveAttribute('data-entity', /^(?!staged:).+/);

  // Menu ≡ em folha: itens e fechamento por Esc.
  await page.click('[data-testid="battle-menu"]');
  const sheet = page.locator('[data-testid="battle-menu-sheet"]');
  for (const item of ['Histórico', 'Pausa e ajustes', 'Salvar e sair', 'Desistir']) await expect(sheet.getByRole('menuitem', { name: item })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
});

// Fase 2 (gameplay-pocket §10): linhas de ataque com o texto do ataque, recusa com aviso no topo, Recuar em pílula,
// ações escondidas durante a animação, “+1 ponto!” e a pílula Vitória antes do resultado.
test('ataque no estilo Pocket: bloqueado avisa “Energia insuficiente”, pronto brilha; +1 ponto! e Vitória antes do S24', async ({ page }) => {
  await newGame(page, 'Iara');
  await startNode(page, 'P00-T01');
  await setupActive(page, 'Charmander');
  await waitMyTurnWithEnergy(page);

  // Ficha do Ativo (tocar na carta): carta ampliada com o PS atual; sem Energia, a linha fica cinza, mostra o texto
  // do ataque e, ao tocar, o motivo aparece no aviso do topo, acima da ficha.
  const panel = page.locator('[data-testid="card-actions"]');
  await openActiveActions(page);
  await expect(panel.locator('.card-actions-hp')).toContainText('60');
  const brasa = panel.locator('.attack-button', { hasText: 'Brasa' });
  await expect(brasa).toHaveClass(/is-blocked/);
  await expect(brasa.locator('.attack-text')).toContainText('Descarte 1 Energia');
  await brasa.click({ force: true });
  await expect(page.locator('[data-testid="battle-toast"]')).toContainText('Energia insuficiente');
  await expect(panel.locator('[data-testid="retreat"]')).toHaveClass(/retreat-pill/);
  // Tocar fora fecha a ficha.
  await page.mouse.click(300, 300);
  await expect(panel).toHaveCount(0);

  // Com Energia: pronta (borda brilhante); o ataque esconde as ações enquanto a animação roda.
  await attachToActive(page);
  await openActiveActions(page);
  await expect(brasa).toHaveClass(/is-ready/);
  await attackWith(page, 'Brasa');
  await expect(page.locator('.attack-button')).toHaveCount(0);

  // T01: dois ataques derrubam o Oddish — tela de ponto, depois a pílula, depois o S24.
  await attachToActive(page);
  await attackWith(page, 'Brasa');
  await expect(page.locator('.scoring-overlay')).toContainText('+1 ponto!', { timeout: 20_000 });
  await expect(page.locator('[data-testid="result-pill"]')).toHaveText('Vitória', { timeout: 15_000 });
  await expect(page.locator('.scoring-overlay')).toHaveCount(0);
  await expect(page).toHaveURL(/\/result/, { timeout: 15_000 });
});

// Zona de Energia como prato e arrasto livre do orbe (gameplay-pocket §5.2, §6); prévia da mão some no arrasto.
test('Energia: orbe arrastado livremente; solto fora volta ao prato, solto no Ativo liga; a prévia da mão some ao arrastar a carta', async ({ page }) => {
  await newGame(page, 'Iara');
  await startNode(page, 'P00-T01');
  await setupActive(page, 'Charmander');
  // Energia gerada no seu turno (gameplay-pocket §5.2): flash no prato e o rótulo “Próxima Energia gerada”.
  await expect(page.locator('[data-testid="energy-generated"]')).toHaveText('Próxima Energia gerada', { timeout: 30_000 });
  await waitMyTurnWithEnergy(page);
  const orb = page.locator('[data-anchor="HUMAN_ENERGY_READY"]');
  const active = page.locator('[data-anchor="HUMAN_ACTIVE"]');
  const center = async (sel: string) => { const b = (await page.locator(sel).boundingBox())!; return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const path = async (from: { x: number; y: number }, to: { x: number; y: number }) => {
    for (let i = 1; i <= 12; i += 1) await page.mouse.move(from.x + ((to.x - from.x) * i) / 12, from.y + ((to.y - from.y) * i) / 12);
  };

  // Solto longe de qualquer Pokémon: volta ao prato, nada é ligado e a Energia continua pronta.
  const start = await center('[data-anchor="HUMAN_ENERGY_READY"]');
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await path(start, { x: 1500, y: 780 });
  await expect(page.locator('[data-testid="battle-toast"]')).toContainText('Escolha um Pokémon para ligar a Energia.');
  await page.mouse.up();
  await expect(orb).toBeEnabled();
  await expect(active).toHaveAttribute('aria-label', /sem Energia/);

  // Arrastado até o Ativo: liga a Energia (o orbe voa até a carta).
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await path(start, await center('[data-anchor="HUMAN_ACTIVE"]'));
  await page.mouse.up();
  await expect(active).toHaveAttribute('aria-label', /1 Energia\(s\)/, { timeout: 15_000 });

  // Prévia da mão: aparece no hover e some ao arrastar a carta; soltar de volta na mão cancela.
  const preview = page.locator('[data-testid="card-preview"]');
  await page.mouse.move(960, 990);
  await expect(preview).toHaveCount(1);
  await page.mouse.down();
  await path({ x: 960, y: 990 }, { x: 960, y: 760 });
  await expect(preview).toHaveCount(0);
  await path({ x: 960, y: 760 }, { x: 960, y: 1000 });
  await page.mouse.up();
});

// Fase 3 (gameplay-pocket §6, §9): contorno amarelo da evolução jogável, evolução por arrasto, zona verde do Treinador sem
// alvo (soltar fora volta à mão sem aviso; dentro, joga) na mesa 3D e na 2D, e a prévia no centro da mesa 2D. Os tutoriais
// T01–T04 são vencidos pela solução de cada um para liberar o T05.
async function presentation2d(page: Page, on: boolean): Promise<void> {
  await openPause(page);
  await page.locator('label.toggle', { hasText: 'Apresentação 2D' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.locator(on ? '.board2d' : '.stage3d')).toHaveCount(1);
}

const won = (page: Page) => expect(page).toHaveURL(/\/result/, { timeout: 30_000 });

test('fase 3: evolução em amarelo e por arrasto; Treinador só joga na zona verde, fora volta sem aviso; prévia no centro em 2D', async ({ page }) => {
  test.setTimeout(480_000);
  await newGame(page, 'Iara');
  await startNode(page, 'P00-T01');
  await playFirstTutorial(page);
  // T02: Energia e Labareda.
  await startNode(page, 'P00-T02');
  await attachToActive(page);
  await attackWith(page, 'Labareda');
  await won(page);
  // T03: Staryu no Banco com a Energia, Revólver d'Água, promoção automática depois do Nocaute e Golpear.
  await startNode(page, 'P00-T03');
  await waitMyTurnWithEnergy(page);
  await tapHandCard(page, 'Staryu');
  await page.click('[data-anchor="HUMAN_BENCH_0"]');
  const bench = page.locator('[data-anchor="HUMAN_BENCH_0"]');
  await expect(bench).toHaveAttribute('data-entity', /.+/);
  await waitMyTurnWithEnergy(page);
  await page.locator('[data-anchor="HUMAN_ENERGY_READY"]').click();
  await bench.click();
  await expect(bench).toHaveAttribute('aria-label', /1 Energia\(s\)/);
  await attackWith(page, "Revólver d'Água");
  // Squirtle cai no turno de Cheren e Staryu, único no Banco, sobe sozinho ao Ativo.
  await expect(page.locator('[data-anchor="HUMAN_ACTIVE"]')).toHaveAttribute('aria-label', /^Staryu/, { timeout: 40_000 });
  await attackWith(page, 'Golpear');
  await won(page);

  // T04: Rapidash na mão com contorno amarelo (2D) e evolução arrastando até Ponyta (3D).
  await startNode(page, 'P00-T04');
  await waitMyTurnWithEnergy(page);
  await presentation2d(page, true);
  await expect(page.locator('.hand2d-card.is-evolvable', { has: page.locator('.card-name', { hasText: 'Rapidash' }) })).toHaveCount(1);
  await presentation2d(page, false);
  await drag(page, await handCard3d(page, 'Rapidash'), await centerOf(page, '[data-anchor="HUMAN_ACTIVE"]'));
  await expect(page.locator('[data-anchor="HUMAN_ACTIVE"]')).toHaveAttribute('aria-label', /^Rapidash/);
  await attachToActive(page);
  await attackWith(page, 'Juba de Fogo');
  await won(page);

  // T05, mesa 3D: Velocidade X solta fora da zona verde volta à mão sem aviso; dentro da zona, joga.
  await startNode(page, 'P00-T05');
  await expect(page.locator('[data-anchor="HUMAN_ACTIVE"]')).toHaveAttribute('data-entity', /.+/);
  await drag(page, await handCard3d(page, 'Velocidade X'), { x: 300, y: 300 });
  await page.waitForTimeout(700);
  await expect(page.locator('[data-testid="drop-deny"]')).toHaveCount(0);
  expect(await handNames(page)).toContain('Velocidade X');
  await drag(page, await handCard3d(page, 'Velocidade X'), { x: 960, y: 470 });
  await expect.poll(() => handNames(page)).not.toContain('Velocidade X');

  // Mesa 2D: a zona aparece durante o arrasto do Apoiador e acende sob a carta; fora dela, volta sem aviso; dentro, joga
  // com a prévia no centro.
  await presentation2d(page, true);
  const giovanni = page.locator('.hand2d-card', { has: page.locator('.card-name', { hasText: 'Giovanni' }) });
  const grab = async () => { const b = (await giovanni.boundingBox())!; return { x: b.x + b.width * 0.3, y: b.y + b.height * 0.4 }; };
  const from = await grab();
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i += 1) await page.mouse.move(from.x + ((960 - from.x) * i) / 10, from.y + ((470 - from.y) * i) / 10);
  const zone = page.locator('[data-testid="trainer-zone"]');
  await expect(zone).toBeVisible();
  await expect(zone).toHaveClass(/is-hover/);
  for (let i = 1; i <= 10; i += 1) await page.mouse.move(960 + ((300 - 960) * i) / 10, 470 + ((300 - 470) * i) / 10);
  await expect(zone).not.toHaveClass(/is-hover/);
  await page.mouse.up();
  await expect(page.locator('.hand2d-ghost')).toHaveCount(0, { timeout: 2000 });
  await expect(page.locator('[data-testid="drop-deny"]')).toHaveCount(0);
  await expect(giovanni).toHaveCount(1);
  await drag(page, await grab(), { x: 960, y: 470 });
  await expect(page.locator('[data-testid="card-spotlight"]')).toHaveClass(/mode-trainer/);
  await expect(giovanni).toHaveCount(0);

  // Recuo de graça (Velocidade X) e Chicote de Vinha vencem o T05.
  await openActiveActions(page);
  await page.click('[data-testid="card-actions"] [data-testid="retreat"]');
  await page.click('[data-anchor="HUMAN_BENCH_0"]');
  await expect(page.locator('[data-anchor="HUMAN_ACTIVE"]')).toHaveAttribute('aria-label', /^Bulbasaur/);
  await attackWith(page, 'Chicote de Vinha');
  await won(page);
});
