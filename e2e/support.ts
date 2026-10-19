// Fixtures e passos compartilhados das jornadas. Toda página roda “offline”: qualquer requisição fora da
// origem local é abortada e reprova o teste (R-004); erros de console e de página também reprovam.
import { test as base, expect, type Page } from '@playwright/test';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export const test = base.extend<{ guard: { external: string[]; errors: string[] } }>({
  guard: [async ({ page }, use) => {
    const external: string[] = [];
    const errors: string[] = [];
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (LOCAL_HOSTS.has(url.hostname)) return route.continue();
      external.push(url.href);
      return route.abort('blockedbyclient');
    });
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await use({ external, errors });
    expect(external, 'requisições fora da origem local').toEqual([]);
    expect(errors, 'erros de console/página').toEqual([]);
  }, { auto: true }],
});

export { expect };

/** S02: novo perfil com o primeiro deck inicial como destaque; termina no Início. */
export async function newGame(page: Page, name = 'Jogador'): Promise<void> {
  await page.goto('/');
  await page.locator('[data-testid="start-new"], [data-testid="onboarding-name"]').first().waitFor({ timeout: 60_000 });
  if (await page.locator('[data-testid="start-new"]').count()) await page.click('[data-testid="start-new"]');
  await page.fill('[data-testid="onboarding-name"]', name);
  await page.locator('[data-testid^="starter-"]').first().click();
  await page.click('[data-testid="onboarding-submit"]');
  await expect(page).toHaveURL(/#\/home/);
}

/** Abertura de uma tentativa nova: a “VS” e, em seguida, o cara ou coroa de quem começa; espera as duas saírem. */
export async function waitOpening(page: Page): Promise<void> {
  // Cada uma monta depois da anterior: espera aparecer (se ainda não apareceu) e só então sumir.
  for (const id of ['duel-intro', 'coin-toss']) {
    const el = page.locator(`[data-testid="${id}"]`);
    await el.waitFor({ state: 'attached', timeout: 10_000 }).catch(() => undefined);
    await expect(el).toHaveCount(0, { timeout: 10_000 });
  }
}

/** S16 → S21/S22: abre o briefing e inicia o encontro; espera a abertura sair (ela aparece uma vez por tentativa). */
export async function startNode(page: Page, nodeId: string, options: { keepIntro?: boolean } = {}): Promise<void> {
  await page.goto(`/#/campaign/nodes/${nodeId}`);
  await page.click('[data-testid="start-node"]');
  await expect(page).toHaveURL(/#\/matches\//);
  if (options.keepIntro) return;
  await waitOpening(page);
}

const readyEnergy = (page: Page) => page.locator('[data-anchor="HUMAN_ENERGY_READY"]');

/** Espera o turno humano com a Energia pronta disponível (a IA/roteiro do NPC já jogou). */
export async function waitMyTurnWithEnergy(page: Page): Promise<void> {
  await expect(readyEnergy(page)).toBeEnabled({ timeout: 30_000 });
}

const energyCount = (label: string | null): number => Number(/(\d+) Energia\(s\)/.exec(label ?? '')?.[1] ?? 0);

/** Liga a Energia pronta ao Ativo pelo caminho da UI: Zona de Energia → Ativo. */
export async function attachToActive(page: Page): Promise<void> {
  await waitMyTurnWithEnergy(page);
  const active = page.locator('[data-anchor="HUMAN_ACTIVE"]');
  const before = energyCount(await active.getAttribute('aria-label'));
  await readyEnergy(page).click();
  await active.click();
  // Confirmado no SQLite e apresentado: o Ativo mostra uma Energia a mais.
  await expect.poll(async () => energyCount(await active.getAttribute('aria-label'))).toBe(before + 1);
}

/** Ficha de ações do Ativo: tocar no Ativo abre a carta ampliada com ataques e Recuar (decisão do autor, 15/10/2026). */
export async function openActiveActions(page: Page): Promise<void> {
  const panel = page.locator('[data-testid="card-actions"]');
  // Durante a apresentação da jogada anterior a mesa fica travada: tenta de novo até a ficha abrir.
  await expect(async () => {
    if (!(await panel.count())) await page.click('[data-anchor="HUMAN_ACTIVE"]');
    await expect(panel).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });
}

/** Usa o ataque pela ficha do Ativo; confirmação opcional conforme ajustes. */
export async function attackWith(page: Page, attackName: string): Promise<void> {
  await openActiveActions(page);
  const button = page.locator('[data-testid="card-actions"] .attack-button', { hasText: attackName });
  await expect(button).not.toHaveAttribute('aria-disabled', 'true');
  await button.click();
  const confirm = page.locator('.modal button', { hasText: 'Atacar' });
  if (await confirm.count()) await confirm.click();
}

/** Carta da mão pelo nome: botões semânticos da mesa 3D ou cartas da mão 2D. */
export const handCard = (page: Page, cardName: string) =>
  page.locator('[data-anchor="HUMAN_HAND"] button, .hand2d-card', { hasText: cardName }).first();

/** Aciona a carta da mão pelo teclado (na mesa 3D os botões da mão são a camada acessível; o ponteiro vai ao canvas). */
export async function tapHandCard(page: Page, cardName: string): Promise<void> {
  const card = handCard(page, cardName);
  await card.focus();
  await page.keyboard.press('Enter');
}

/** Preparação na mesa (gameplay-pocket §4): toca no Básico (vai ao Ativo) e inicia o duelo. */
export async function setupActive(page: Page, cardName: string): Promise<void> {
  await tapHandCard(page, cardName);
  await page.click('[data-testid="setup-confirm"]');
  await expect(page.locator('[data-testid="setup-confirm"]')).toHaveCount(0);
}

/** Menu ≡ → Pausa e ajustes (gameplay-pocket §7.2). */
export async function openPause(page: Page): Promise<void> {
  await page.click('[data-testid="battle-menu"]');
  await page.click('[data-testid="pause"]');
}

/** Tutorial P00-T01 pela solução roteirizada (o NPC segue o npcScript da fixture). */
export async function playFirstTutorial(page: Page): Promise<void> {
  await setupActive(page, 'Charmander');
  await attachToActive(page);
  await attackWith(page, 'Brasa');
  await attachToActive(page);
  await attackWith(page, 'Brasa');
  await expect(page).toHaveURL(/\/result/, { timeout: 30_000 });
}

// ---------------------------------------------------------------- arrasto (mesa 3D e 2D)

export type Point = { readonly x: number; readonly y: number };

export async function centerOf(page: Page, selector: string): Promise<Point> {
  const box = (await page.locator(selector).first().boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

export async function drag(page: Page, from: Point, to: Point): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 14; i += 1) await page.mouse.move(from.x + ((to.x - from.x) * i) / 14, from.y + ((to.y - from.y) * i) / 14);
  await page.mouse.up();
}

/** Mesa 3D: a mão é desenhada no canvas; acha a carta pelo nome passando o ponteiro até a prévia mostrá-la. */
export async function handCard3d(page: Page, name: string): Promise<Point> {
  const preview = page.locator('[data-testid="card-preview"] .card-name');
  for (let x = 640; x <= 1280; x += 24) {
    await page.mouse.move(x, 1000);
    await page.waitForTimeout(170);
    if ((await preview.count()) && (await preview.textContent()) === name) return { x, y: 1000 };
  }
  throw new Error(`carta ${name} não encontrada na mão`);
}

export const handNames = (page: Page) => page.locator('[data-anchor="HUMAN_HAND"] button').allTextContents();
