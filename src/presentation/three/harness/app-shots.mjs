// Capturas da tela de duelo real (S23) em modo 3D: novo perfil → P00-T01 → preparação → mesa; liga Energia
// ao Ativo e captura também o popover de ataques. Homologação visual manual (não é teste automatizado).
// Uso: node src/presentation/three/harness/app-shots.mjs [baseUrl] [outDir]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const base = process.argv[2] ?? 'http://localhost:5181';
const outDir = path.resolve(process.argv[3] ?? 'harness-shots/app');
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

for (const [w, h] of [[1920, 1080], [1280, 720]]) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}
${e.stack ?? ''}`));
  const shot = async (name) => {
    const file = path.join(outDir, `${name}-${w}x${h}.png`);
    await page.screenshot({ path: file });
    console.log('saved', file);
  };
  await page.goto(`${base}/`);
  await page.locator('[data-testid="start-new"], [data-testid="onboarding-name"]').first().waitFor({ timeout: 90_000 });
  if (await page.locator('[data-testid="start-new"]').count()) await page.click('[data-testid="start-new"]');
  await page.fill('[data-testid="onboarding-name"]', 'Ana');
  await page.locator('[data-testid^="starter-"]').first().click();
  await page.click('[data-testid="onboarding-submit"]');
  await page.waitForURL(/#\/home/);
  await wait(2500);
  await shot('home');
  await page.goto(`${base}/#/campaign`);
  await wait(3000);
  await shot('campaign-map');
  await page.goto(`${base}/#/campaign/chapters/P00`);
  await wait(2500);
  await shot('campaign-chapter');
  await page.goto(`${base}/#/cards/a1-285-pikachu-ex`);
  await wait(2500);
  await shot('card-inspector');
  await page.goto(`${base}/#/packs`);
  const openPack = page.locator('[data-testid^="open-pack-a1-pikachu"]').first();
  await openPack.waitFor({ timeout: 15_000 }).catch(() => undefined);
  if (await openPack.count()) {
    await openPack.click();
    await page.waitForURL(/#\/openings\//);
    await wait(2500);
    await shot('pack-sealed');
    await page.click('[data-testid="tear-pack"]');
    await wait(350);
    await shot('pack-tearing');
  }
  await page.goto(`${base}/#/campaign/nodes/P00-T01`);
  await page.click('[data-testid="start-node"]');
  await page.waitForURL(/#\/matches\//);
  await page.locator('[data-anchor="HUMAN_HAND"] button, .hand2d-card', { hasText: 'Charmander' }).first().click();
  await page.click('[data-testid="setup-confirm"]');
  await page.locator('[data-testid="setup-confirm"]').waitFor({ state: 'detached' });
  const ready = page.locator('[data-anchor="HUMAN_ENERGY_READY"]');
  await ready.waitFor({ timeout: 30_000 });
  await page.waitForFunction(() => !document.querySelector('[data-anchor="HUMAN_ENERGY_READY"]')?.hasAttribute('disabled'), null, { timeout: 30_000 });
  await wait(1200);
  const mode = await page.evaluate(() => (document.querySelector('.stage3d canvas.gl-canvas') ? '3D' : '2D'));
  console.log(`${w}x${h} mode`, mode);
  await shot('match-turn');
  // Passa o ponteiro sobre a mão (carta sobe inteira) e liga Energia ao Ativo.
  const vp = page.viewportSize();
  await page.mouse.move(vp.width / 2, vp.height - 60);
  await wait(500);
  await shot('match-hand-focus');
  await page.mouse.move(10, vp.height / 2);
  await ready.click();
  await wait(300);
  await shot('match-energy-pending');
  await page.click('[data-anchor="HUMAN_ACTIVE"]');
  await page.waitForFunction(() => /1 Energia/.test(document.querySelector('[data-anchor="HUMAN_ACTIVE"]')?.getAttribute('aria-label') ?? ''), null, { timeout: 30_000 });
  await wait(600);
  await shot('match-energy-attached');
  await page.click('[data-anchor="HUMAN_ACTIVE"]');
  await wait(500);
  await shot('match-popover');
  // Comparação: a mesma mesa com "Apresentação 2D" ligada (Pausa → alternância → Continuar).
  await page.click('[data-testid="battle-menu"]');
  await page.click('[data-testid="pause"]');
  await page.locator('label.toggle', { hasText: 'Apresentação 2D' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await wait(800);
  await shot('match-2d');
  await page.click('[data-testid="battle-menu"]');
  await page.click('[data-testid="pause"]');
  await page.locator('label.toggle', { hasText: 'Apresentação 2D' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  fs.writeFileSync(path.join(outDir, `console-${w}x${h}.log`), errors.join('\n'));
  if (errors.length) console.log('errors', errors.slice(0, 10));
  await context.close();
}
await browser.close();
