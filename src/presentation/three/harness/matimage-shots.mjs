// Capturas da imagem local do tapete na mesa 3D (interface §23.26; UI-111/113): novo perfil → oficina
// (importa a imagem e usa como padrão) → P00-T01 → turno do jogador (imagem exibida), turno do adversário
// (TURN_OWNER volta ao tapete dele), comparação com a apresentação 2D e o caso de imagem ilegível (aviso).
// Homologação visual manual (não é teste automatizado).
// Uso: node src/presentation/three/harness/matimage-shots.mjs [baseUrl] [outDir] [imagem]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const base = process.argv[2] ?? 'http://localhost:5181';
const outDir = path.resolve(process.argv[3] ?? 'harness-shots/app');
const image = path.resolve(process.argv[4] ?? 'e2e/fixtures/mat-640x360.png');
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function profileWithImage(page) {
  await page.goto(`${base}/`);
  await page.locator('[data-testid="start-new"], [data-testid="onboarding-name"]').first().waitFor({ timeout: 90_000 });
  if (await page.locator('[data-testid="start-new"]').count()) await page.click('[data-testid="start-new"]');
  await page.fill('[data-testid="onboarding-name"]', 'Ana');
  await page.locator('[data-testid^="starter-"]').first().click();
  await page.click('[data-testid="onboarding-submit"]');
  await page.waitForURL(/#\/home/);
  await page.goto(`${base}/#/appearance`);
  await page.locator('.mat-image-editor input[type="file"]').setInputFiles(image);
  await page.locator('.workshop-table .mat-image-surface').waitFor();
  await page.getByRole('button', { name: 'Usar como padrão' }).click();
  await page.locator('.page-header', { hasText: 'Usando a aparência padrão do perfil' }).waitFor();
}

async function startMatch(page) {
  await page.goto(`${base}/#/campaign/nodes/P00-T01`);
  await page.click('[data-testid="start-node"]');
  await page.waitForURL(/#\/matches\//);
  await page.locator('[data-anchor="HUMAN_HAND"] button, .hand2d-card', { hasText: 'Charmander' }).first().click();
  await page.click('[data-testid="setup-confirm"]');
  await page.locator('[data-testid="setup-confirm"]').waitFor({ state: 'detached' });
  await page.waitForFunction(() => !document.querySelector('[data-anchor="HUMAN_ENERGY_READY"]')?.hasAttribute('disabled'), null, { timeout: 30_000 });
  await wait(1200);
}

for (const [w, h] of [[1920, 1080], [1280, 720]]) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  const shot = async (name) => {
    const file = path.join(outDir, `${name}-${w}x${h}.png`);
    await page.screenshot({ path: file });
    console.log('saved', file, await page.evaluate(() => document.querySelector('.stage3d')?.getAttribute('data-mat-image') ?? '2D'));
  };
  await profileWithImage(page);
  await shot('workshop-mat-image');
  await startMatch(page);
  await page.locator('.stage3d[data-mat-image="loaded"]').waitFor({ timeout: 15_000 });
  await wait(400);
  await shot('match-mat-image');
  // Passa o turno: TURN_OWNER troca para o tapete do adversário (crossfade de 280 ms) e volta no meu turno.
  await page.locator('[data-testid="end-turn"]').first().click().catch(() => undefined);
  const confirm = page.locator('.modal button', { hasText: 'Finalizar' });
  await confirm.first().waitFor({ timeout: 1500 }).then(() => confirm.first().click()).catch(() => undefined);
  await page.locator('.stage3d[data-mat-image="none"]').waitFor({ timeout: 15_000 }).then(() => wait(450)).then(() => shot('match-mat-image-opponent-turn')).catch(() => console.log('turno do adversário não capturado'));
  await page.waitForFunction(() => !document.querySelector('[data-anchor="HUMAN_ENERGY_READY"]')?.hasAttribute('disabled'), null, { timeout: 30_000 }).catch(() => undefined);
  // Comparação: a mesma mesa com "Apresentação 2D" ligada.
  await page.click('[data-testid="battle-menu"]');
  await page.click('[data-testid="pause"]');
  await page.locator('label.toggle', { hasText: 'Apresentação 2D' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await wait(800);
  await shot('match-mat-image-2d');
  await page.click('[data-testid="battle-menu"]');
  await page.click('[data-testid="pause"]');
  await page.locator('label.toggle', { hasText: 'Apresentação 2D' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  // UI-113: bytes que não decodificam (PNG truncado) → tapete neutro + aviso.
  await page.addInitScript(() => {
    const original = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (obj) => (obj instanceof Blob && obj.type.startsWith('image/') ? 'data:image/png;base64,iVBORw0KGgo=' : original(obj));
  });
  // Retomada da mesma partida (recarrega a página: o cache de URLs de objeto recomeça).
  await page.reload();
  await page.waitForURL(/#\/matches\//);
  await page.locator('.stage3d[data-mat-image="missing"]').waitFor({ timeout: 15_000 }).catch(() => console.log('missing não apareceu'));
  await wait(400);
  await shot('match-mat-image-missing');
  fs.writeFileSync(path.join(outDir, `console-matimage-${w}x${h}.log`), errors.join('\n'));
  if (errors.length) console.log('errors', errors.slice(0, 10));
  await context.close();
}
await browser.close();
