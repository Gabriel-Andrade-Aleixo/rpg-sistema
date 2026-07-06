import { expect, test } from '@playwright/test';

const catalog = {
  board: { name: 'GERENCIAMENTO RPG' },
  categories: [],
  entries: [
    { id: 'item_1', name: 'Armadura de Couro', category: 'Equipamentos', description: 'Proteção leve para exploradores.', labels: [{ name: 'Armadura Leve' }], imageUrl: '' },
    { id: 'spell_1', name: 'Flecha Espectral', category: 'Magias', description: 'Uma flecha de energia espectral.', labels: [{ name: 'Magia: Espectral' }], imageUrl: '' },
  ],
};

async function prepare(page, viewport) {
  await page.setViewportSize(viewport);
  await page.route('http://localhost:8787/characters', (route) => route.fulfill({ json: { ok: true, characters: [] } }));
  await page.route('http://localhost:8787/catalog*', (route) => route.fulfill({ json: { ok: true, catalog } }));
  await page.goto(process.env.RPG_WEB_URL || 'http://localhost:3000');
}

async function expectVisibleCanvas(page) {
  const canvas = page.locator('.diceStage canvas');
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(450);
  const visiblePixels = await canvas.evaluate((element) => {
    const gl = element.getContext('webgl2') || element.getContext('webgl');
    const pixels = new Uint8Array(element.width * element.height * 4);
    gl.readPixels(0, 0, element.width, element.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let count = 0;
    for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 0) count += 1;
    return count;
  });
  expect(visiblePixels).toBeGreaterThan(500);
  await expect(page.getByRole('button', { name: 'Concluir' })).toBeEnabled({ timeout: 5000 });
}

test('modo mestre e dado 3D permanecem claros no desktop e mobile', async ({ page }, testInfo) => {
  await prepare(page, { width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Mestre' }).click();
  await page.locator('.adminTabs').getByRole('button', { name: /Itens/ }).click();
  await expect(page.getByText('Armadura de Couro')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('mestre-desktop.png'), fullPage: true });
  await page.locator('.dieButton').click();
  await expectVisibleCanvas(page);
  await page.screenshot({ path: testInfo.outputPath('dado-desktop.png') });
  await page.getByRole('button', { name: 'Concluir' }).click();

  await prepare(page, { width: 390, height: 844 });
  await page.getByRole('button', { name: 'Mestre' }).click();
  await page.locator('.adminTabs').getByRole('button', { name: /Magias/ }).click();
  await expect(page.getByText('Flecha Espectral')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('mestre-mobile.png'), fullPage: true });
  await page.locator('.dieButton').click();
  await expectVisibleCanvas(page);
  await page.screenshot({ path: testInfo.outputPath('dado-mobile.png') });
});
