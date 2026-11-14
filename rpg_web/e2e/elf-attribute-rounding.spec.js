import { expect, test } from '@playwright/test';
import { emptyCharacter } from '../lib/rpgData.js';

const rules = (metadata) => `<!-- RPG_RULES_JSON_START -->\n${JSON.stringify(metadata)}\n<!-- RPG_RULES_JSON_END -->`;

test('Elfo Espadachim exibe 5,5 antes de arredondar e rola Destreza +5', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const character = {
    ...emptyCharacter(), id: 'char_elf_rounding', name: 'Torvin',
    raceId: 'race_elf', classId: 'class_swordsman', level: 1,
    raceAttributeChoice: 'dexterity', raceConnection: 'Juramento antigo',
    attributes: { strength: 2, dexterity: 4, constitution: 2, intelligence: 2, charisma: 0, faith: 0 },
    maxHp: 31, currentHp: 31, maxMana: 8, currentMana: 8,
  };
  const catalog = { categories: ['Racas', 'Classes'], entries: [
    { id: 'race_elf', name: 'Elfo', category: 'Racas', description: rules({ type: 'race', attributeBonuses: { constitution: 1 }, attributeChoice: { amount: 1, allowed: ['strength', 'dexterity', 'intelligence', 'charisma', 'faith'] }, connection: { required: true } }) },
    { id: 'class_swordsman', name: 'Espadachim', category: 'Classes', description: rules({ type: 'class', id: 'swordsman', defense: { base: 0, terms: { dexterity: .4, constitution: .4, intelligence: .2 } }, attributeProgression: [{ from: 1, to: 3, perLevel: { dexterity: 1 } }] }) },
  ] };
  await page.addInitScript(() => window.sessionStorage.setItem('rpg-auth-session', JSON.stringify({
    token: 'elf-rounding-e2e', expiresAt: new Date(Date.now() + 3600000).toISOString(),
    user: { id: 'user_elf_rounding', email: 'elf@example.com', displayName: 'Torvin', role: 'player' },
  })));
  await page.route('http://localhost:8787/catalog*', (route) => route.fulfill({ json: { ok: true, catalog } }));
  await page.route('http://localhost:8787/characters', (route) => route.fulfill({ json: { ok: true, characters: [character], publicCharacters: [] } }));

  await page.goto(process.env.RPG_WEB_URL || 'http://localhost:3001');
  await page.locator('.chooserCharacter').filter({ hasText: 'Torvin' }).click();
  await page.getByRole('navigation', { name: 'Seções da ficha' }).getByRole('button', { name: 'Combate' }).click();
  const dexterity = page.locator('.breakdown').filter({ has: page.locator('summary').getByText('Destreza', { exact: true }) });
  await expect(dexterity.locator('summary strong')).toHaveText('5');
  await dexterity.locator('summary').click();
  await expect(dexterity).toContainText('Antes de arredondar 5,5');
  await expect(dexterity).toContainText('Elfo · Versatilidade +0,5');
  await page.screenshot({ path: testInfo.outputPath('elf-attribute-mobile.png'), fullPage: true });
  await dexterity.getByRole('button', { name: 'Rolar Destreza' }).click();
  await expect(page.locator('.rollResultBlock')).toContainText('Destreza final: +5', { timeout: 15000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
