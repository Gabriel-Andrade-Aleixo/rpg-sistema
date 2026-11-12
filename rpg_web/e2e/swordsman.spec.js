import { expect, test } from '@playwright/test';
import { emptyCharacter } from '../lib/rpgData.js';

const rules = (metadata) => `<!-- RPG_RULES_JSON_START -->\n${JSON.stringify(metadata)}\n<!-- RPG_RULES_JSON_END -->`;

test('Espadachim recupera Concentração e rola dois golpes com desvantagem', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let character = {
    ...emptyCharacter(), id: 'char_swordsman_e2e', name: 'Ayla', raceId: 'race_human', classId: 'class_swordsman', level: 5,
    attributes: { strength: 2, dexterity: 3, constitution: 3, intelligence: 2, charisma: 0, faith: 0 },
    maxHp: 35, currentHp: 35, maxMana: 12, currentMana: 12, syncRevision: 1,
  };
  const catalog = { categories: ['Racas', 'Classes', 'Pericias'], entries: [
    { id: 'race_human', name: 'Humano', category: 'Racas', description: rules({ type: 'race', attributeBonuses: {}, variants: [] }) },
    { id: 'class_swordsman', name: 'Espadachim', category: 'Classes', description: rules({ type: 'class', id: 'swordsman', usesWeapons: true, defense: { base: 0, terms: { dexterity: .4, constitution: .4, intelligence: .2 } }, hp: { initial: { base: 12, terms: { constitution: 3, dexterity: .5 } }, perLevel: { fixed: { base: 5, terms: { constitution: 1 } }, roll: { die: 8, base: 0, terms: { constitution: 1 } }, hybrid: { die: 4, base: 4, terms: { constitution: 1 } } } }, attributeProgression: [] }) },
    { id: 'skill_acrobatics', name: 'Acrobacia', category: 'Pericias', description: 'Destreza 90%; Força 10%.' },
  ] };
  await page.addInitScript(() => window.sessionStorage.setItem('rpg-auth-session', JSON.stringify({
    token: 'swordsman-e2e-token', expiresAt: new Date(Date.now() + 3600000).toISOString(),
    user: { id: 'user_swordsman_e2e', email: 'ayla@example.com', displayName: 'Ayla', role: 'player' },
  })));
  await page.route('http://localhost:8787/catalog*', (route) => route.fulfill({ json: { ok: true, catalog } }));
  await page.route('http://localhost:8787/characters', (route) => {
    if (route.request().method() === 'POST') {
      character = { ...route.request().postDataJSON().character, syncRevision: character.syncRevision + 1 };
      return route.fulfill({ json: { ok: true, character } });
    }
    return route.fulfill({ json: { ok: true, characters: [character], publicCharacters: [] } });
  });
  await page.goto(process.env.RPG_WEB_URL || 'http://localhost:3000');
  await page.locator('.chooserCharacter').filter({ hasText: 'Ayla' }).click();
  await page.getByRole('navigation', { name: 'Seções da ficha' }).getByRole('button', { name: 'Combate' }).click();
  const panel = page.locator('.panel').filter({ has: page.getByRole('heading', { name: 'Concentração do Espadachim' }) });
  await expect(panel).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('espadachim-mobile.png'), fullPage: true });
  await panel.getByRole('button', { name: 'Iniciar combate' }).click();
  await panel.getByLabel('Ameaças que exigem atenção').selectOption('3');
  await expect(panel.getByText('Quebrada', { exact: true })).toBeVisible();
  await panel.getByLabel('Ameaças que exigem atenção').selectOption('1');
  await expect(panel.getByText('Quebrada', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Início do turno' }).click();
  await expect(panel.getByText('Dividida', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Ataque de Abertura' }).click();
  await expect(page.locator('.rollResultBlock')).toContainText('desvantagem', { timeout: 15000 });
  await page.getByRole('button', { name: 'Voltar à ficha' }).click();
  await expect(page.locator('.historyList article').filter({ hasText: 'Ataque de Abertura' })).toHaveCount(2);
  await expect(panel.getByRole('button', { name: 'Ataque de Abertura' })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
