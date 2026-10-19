// Capturas do harness em 1920×1080 e 1280×720 (homologação visual manual, não teste automatizado).
// Uso: node src/presentation/three/harness/screenshot.mjs [baseUrl] [outDir] [scenario]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const base = process.argv[2] ?? 'http://localhost:5181';
const outDir = path.resolve(process.argv[3] ?? 'test-results/harness');
const scenario = process.argv[4] ?? 'all';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});

const sizes = [[1920, 1080], [1280, 720]];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

for (const [w, h] of sizes) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  const shot = async (name) => {
    const file = path.join(outDir, `${name}-${w}x${h}.png`);
    await page.screenshot({ path: file });
    console.log('saved', file);
  };
  await page.goto(`${base}/harness.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__harness, null, { timeout: 30000 });
  // Capturas sem as ferramentas do harness (barra, status, log): só a cena e o HUD mínimo.
  await page.evaluate(() => window.__harness.chrome(false));
  await wait(2500);
  if (scenario === 'quick') {
    // Iteração rápida: repouso, foco/destaques, cut-in e pose final.
    await shot('battle-start');
    await page.evaluate(() => window.__harness.demoHighlights());
    const rects = await page.evaluate(() => window.__harness.anchorRects());
    const card = Object.entries(rects).find(([k]) => k.startsWith('HAND_CARD:'));
    if (card) await page.mouse.move(card[1].x + card[1].width / 2, card[1].y + card[1].height * 0.3);
    await wait(600);
    await shot('battle-hover-highlights');
    await page.mouse.move(10, 10);
    await page.evaluate(() => { void window.__harness.playScript(); });
    const ok = await page.evaluate(([l, m]) => window.__harness.pauseWhen(l, m), ['Ataque com moedas · Nocaute · pontos', 560]);
    if (ok) {
      await wait(250);
      await shot('script-cutin');
      await page.evaluate(() => window.__harness.resume());
    }
    await page.waitForFunction(() => !window.__harness.isPresenting(), null, { timeout: 60000 });
    await wait(400);
    await shot('script-final');
  }
  if (scenario === 'all' || scenario === 'battle') {
    await shot('battle-start');
    await page.evaluate(() => window.__harness.showAnchors(true));
    await wait(300);
    await shot('battle-anchors');
    await page.evaluate(() => window.__harness.showAnchors(false));
    await page.evaluate(() => window.__harness.demoHighlights());
    const hand = await page.evaluate(() => window.__harness.anchorRects());
    const card = Object.entries(hand).find(([k]) => k.startsWith('HAND_CARD:'));
    if (card) await page.mouse.move(card[1].x + card[1].width / 2, card[1].y + card[1].height / 2);
    await wait(500);
    await shot('battle-hover-highlights');
    await page.mouse.move(10, 10);
    await page.evaluate(() => { void window.__harness.playScript(); });
    const atk = 'Ataque com moedas · Nocaute · pontos';
    const marks = [
      ['Fim do turno do NPC · compra', 620, 'draw'], ['Jogar Básico', 330, 'play'], ['Ligar Energia', 220, 'energy'],
      [atk, 560, 'cutin'], [atk, 1250, 'coin'], [atk, 2000, 'coin-next'], [atk, 2350, 'travel'], [atk, 2620, 'impact'],
      [atk, 3150, 'knockout'], [atk, 3800, 'points'], [atk, 4300, 'promote'],
    ];
    for (const [label, ms, name] of marks) {
      const ok = await page.evaluate(([l, m]) => window.__harness.pauseWhen(l, m), [label, ms]);
      if (!ok) { console.log('mark timeout', name); continue; }
      await wait(250);
      await shot(`script-${name}`);
      await page.evaluate(() => window.__harness.resume());
    }
    await page.waitForFunction(() => !window.__harness.isPresenting(), null, { timeout: 60000 });
    await wait(400);
    await shot('script-final');
    const diag = await page.evaluate(() => window.__harness.diagnostics());
    fs.writeFileSync(path.join(outDir, `diagnostics-${w}x${h}.json`), JSON.stringify(diag, null, 2));
    await page.evaluate(() => { void window.__harness.playOpening(); });
    for (const [ms, name] of [[450, 'intro'], [1500, 'deal'], [2350, 'reveal'], [3300, 'draw']]) {
      const ok = await page.evaluate(([m]) => window.__harness.pauseWhen('Abertura', m), [ms]);
      if (!ok) continue;
      await wait(250);
      await shot(`opening-${name}`);
      await page.evaluate(() => window.__harness.resume());
    }
    await page.waitForFunction(() => !window.__harness.isPresenting(), null, { timeout: 60000 });
  }
  if (scenario === 'all' || scenario === 'stages') {
    const ex = (code) => page.evaluate(code);
    // Inspector: frente, rotação limitada, verso.
    await ex(() => window.__harness.extras().open('inspector'));
    await wait(2200);
    await shot('stage-inspector');
    await ex(() => window.__harness.extras().inspectorAction('rotate'));
    await wait(900);
    await shot('stage-inspector-rotated');
    await ex(() => window.__harness.extras().inspectorAction('back'));
    await wait(1200);
    await shot('stage-inspector-back');
    // Pacote: fechado, corte (meio), primeira carta, avanço, especial, resumo.
    await ex(() => window.__harness.extras().open('pack'));
    await wait(2200);
    await shot('stage-pack-sealed');
    await ex(() => { void window.__harness.extras().packAction('tear'); });
    await wait(380);
    await shot('stage-pack-tearing');
    await page.waitForFunction(() => window.__harness.extras().diagnostics().pack?.phase === 'REVEALING', null, { timeout: 30000 });
    await wait(700);
    await shot('stage-pack-first');
    for (let i = 0; i < 3; i += 1) {
      await ex(() => window.__harness.extras().packAction('next'));
      await wait(300);
    }
    await ex(() => { void window.__harness.extras().packAction('next'); });
    await wait(450);
    await shot('stage-pack-special-mid');
    await wait(1200);
    await shot('stage-pack-special');
    await ex(() => window.__harness.extras().packAction('all'));
    await wait(1200);
    await shot('stage-pack-summary');
    // Mapa: geral, capítulo, zoom.
    await ex(() => window.__harness.extras().open('map'));
    await wait(2500);
    await ex(() => window.__harness.extras().mapAction('overview'));
    await wait(900);
    await shot('stage-map-overview');
    await ex(() => window.__harness.extras().mapAction('chapter'));
    await wait(900);
    await shot('stage-map-chapter');
    await ex(() => window.__harness.extras().mapAction('center'));
    await ex(() => window.__harness.extras().mapAction('zoom-in'));
    await wait(1200);
    await shot('stage-map-zoom');
    // Vitrine.
    await ex(() => window.__harness.extras().open('showcase'));
    await wait(2200);
    await shot('stage-showcase');
    // Descoberta: foco, seleção, aquisição (meio e fim).
    await ex(() => window.__harness.extras().open('discovery'));
    await wait(2200);
    await ex(() => window.__harness.extras().discoveryAction('focus'));
    await wait(600);
    await shot('stage-discovery-focus');
    await ex(() => window.__harness.extras().discoveryAction('select'));
    await wait(600);
    await shot('stage-discovery-selected');
    await ex(() => { void window.__harness.extras().discoveryAction('acquire'); });
    await wait(420);
    await shot('stage-discovery-acquire');
    await wait(1400);
    const stageDiag = await ex(() => window.__harness.extras().diagnostics());
    fs.writeFileSync(path.join(outDir, `stages-diagnostics-${w}x${h}.json`), JSON.stringify(stageDiag, null, 2));
    await ex(() => window.__harness.extras().close());
  }
  fs.writeFileSync(path.join(outDir, `console-${w}x${h}.log`), errors.join('\n'));
  if (errors.length) console.log(`console (${w}x${h}):\n${errors.slice(0, 20).join('\n')}`);
  await page.close();
}
await browser.close();
