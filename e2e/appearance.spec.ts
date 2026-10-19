// Oficina de aparência (interface §23.26; UI-111, UI-112): imagem local do tapete — arquivo disfarçado é
// recusado antes de alterar o preset salvo; imagem válida entra recortada em 4:3 e o preset aplicado a leva
// para a mesa 3D da partida (UI-111); imagem ilegível cai no tapete neutro com aviso (UI-113).
import path from 'node:path';
import { attachToActive, expect, newGame, setupActive, startNode, test, waitMyTurnWithEnergy } from './support.ts';

const fixture = (name: string) => path.join(import.meta.dirname, 'fixtures', name);

test('UI-111/UI-112 imagem local do tapete: recusa antes de alterar, recorte 4:3 e aplicação', async ({ page }) => {
  await newGame(page, 'Tapete');
  await page.goto('/#/appearance');
  const input = page.locator('.mat-image-editor input[type="file"]');
  await input.setInputFiles(fixture('not-an-image.png'));
  await expect(page.locator('[data-testid="mat-image-error"]')).toContainText('O preset salvo não foi alterado');
  await expect(page.locator('.workshop-table .mat-image-surface')).toHaveCount(0);
  await input.setInputFiles(fixture('mat-640x360.png'));
  const surface = page.locator('.workshop-table .mat-image-surface');
  await expect(surface).toHaveCount(1);
  // 640×360 (16:9) → maior recorte 4:3 centrado: largura 75 % da imagem, sem distorção.
  await expect(surface).toHaveAttribute('style', /background-size: 133\.33\d*% 100%/);
  await expect(surface).toHaveAttribute('style', /background-position: 50% 0%/);
  await page.getByRole('button', { name: 'Usar como padrão' }).click();
  await expect(page.locator('.page-header')).toContainText('Usando a aparência padrão do perfil');
  await page.reload();
  await expect(page.locator('.workshop-table .mat-image-surface')).toHaveCount(1);
});

test('UI-111 imagem local do tapete na mesa 3D: o preset padrão leva a imagem para a partida', async ({ page }) => {
  await newGame(page, 'Tapete 3D');
  await page.goto('/#/appearance');
  await page.locator('.mat-image-editor input[type="file"]').setInputFiles(fixture('mat-640x360.png'));
  await expect(page.locator('.workshop-table .mat-image-surface')).toHaveCount(1);
  await page.getByRole('button', { name: 'Usar como padrão' }).click();
  await expect(page.locator('.page-header')).toContainText('Usando a aparência padrão do perfil');
  await startNode(page, 'P00-T01');
  await setupActive(page, 'Charmander');
  // Turno do jogador (tapete exibido = o do dono do turno): a mesa 3D decodificou e mostra a imagem local.
  await waitMyTurnWithEnergy(page);
  const stage = page.locator('.stage3d');
  await expect(stage, 'a partida deve estar na mesa 3D (WebGL2)').toHaveCount(1);
  await expect(stage).toHaveAttribute('data-mat-image', 'loaded', { timeout: 15_000 });
  await expect(page.locator('.b2-mat-missing')).toHaveCount(0);
});

test('UI-113 imagem do tapete que não decodifica na mesa 3D: tapete neutro e aviso, sem bloquear a partida', async ({ page }) => {
  await newGame(page, 'Tapete ausente');
  await page.goto('/#/appearance');
  await page.locator('.mat-image-editor input[type="file"]').setInputFiles(fixture('mat-640x360.png'));
  await page.getByRole('button', { name: 'Usar como padrão' }).click();
  await expect(page.locator('.page-header')).toContainText('Usando a aparência padrão do perfil');
  // A partir daqui os bytes do asset viram uma imagem ilegível (PNG truncado) — como um asset corrompido.
  await page.addInitScript(() => {
    const original = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (obj: Blob | MediaSource) => (obj instanceof Blob && obj.type.startsWith('image/') ? 'data:image/png;base64,iVBORw0KGgo=' : original(obj));
  });
  await page.reload();
  await startNode(page, 'P00-T01');
  await setupActive(page, 'Charmander');
  await waitMyTurnWithEnergy(page);
  const stage = page.locator('.stage3d');
  await expect(stage).toHaveCount(1);
  await expect(stage).toHaveAttribute('data-mat-image', 'missing');
  await expect(page.getByRole('status').filter({ hasText: 'Imagem do tapete indisponível — usando o tapete neutro' })).toBeVisible();
  // A partida segue: liga a Energia ao Ativo normalmente.
  await attachToActive(page);
});
