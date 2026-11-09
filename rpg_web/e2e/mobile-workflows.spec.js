import { expect, test } from '@playwright/test';
import { emptyCharacter } from '../lib/rpgData.js';

const rules = (value) => `<!-- RPG_RULES_JSON_START -->\n${JSON.stringify(value)}\n<!-- RPG_RULES_JSON_END -->`;
const catalog = {
  categories: ['Racas', 'Classes'],
  entries: [
    { id: 'race_e2e', name: 'Humano', category: 'Racas', description: rules({ type: 'race', attributeBonuses: {}, variants: [] }) },
    { id: 'class_e2e', name: 'Guerreiro', category: 'Classes', description: rules({ type: 'class', defense: { base: 0, terms: { dexterity: .7, constitution: .3 } }, hp: { initial: { base: 10, terms: {} }, perLevel: { fixed: { base: 5, terms: {} }, roll: { die: 8, base: 0, terms: {} }, hybrid: { die: 4, base: 4, terms: {} } } }, mana: { base: 10, terms: {} }, attributeProgression: [] }) },
  ],
};

async function prepare(page, state) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    window.sessionStorage.setItem('rpg-auth-session', JSON.stringify({
      token: 'mobile-e2e-token',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      user: { id: 'user_mobile_e2e', email: 'jogador@example.com', displayName: 'Jogador E2E', role: 'player' },
    }));
  });
  await page.route('http://localhost:8787/catalog*', (route) => route.fulfill({ json: { ok: true, catalog } }));
  await page.route('http://localhost:8787/characters', (route) => {
    if (route.request().method() === 'POST') {
      if (state.failWrites) return route.fulfill({ status: 503, json: { ok: false, error: 'Servidor indisponível' } });
      if (state.conflictWrites) return route.fulfill({ status: 409, json: { ok: false, error: 'A ficha foi alterada em outro dispositivo.' } });
      state.character = { ...route.request().postDataJSON().character, syncRevision: Number(state.character.syncRevision || 0) + 1 };
      return route.fulfill({ json: { ok: true, character: state.character } });
    }
    return route.fulfill({ json: { ok: true, characters: [state.character], publicCharacters: [] } });
  });
  await page.goto(process.env.RPG_WEB_URL || 'http://localhost:3000');
  await page.locator('.chooserCharacter').filter({ hasText: 'Kael' }).click();
}

function fixture() {
  return {
    character: { ...emptyCharacter(), id: 'char_mobile_e2e', name: 'Kael', raceId: 'race_e2e', classId: 'class_e2e', maxHp: 20, currentHp: 10, maxMana: 10, currentMana: 10, syncRevision: 1 },
    failWrites: false,
    conflictWrites: false,
  };
}

test('acoes da ficha, rolagem e rascunho ficam acessiveis no celular', async ({ page }) => {
  const state = fixture();
  await prepare(page, state);
  await page.getByRole('button', { name: 'Conta e ações' }).click();
  await expect(page.getByRole('button', { name: 'Duplicar ficha' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Excluir ficha' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sair da conta' })).toBeVisible();
  await page.getByRole('button', { name: 'Conta e ações' }).click();

  await page.getByRole('button', { name: 'Descanso longo' }).click();
  const life = await page.locator('.resourceHeader').filter({ hasText: 'Vida' }).locator('span').innerText();
  const [current, maximum] = life.split('/');
  expect(current).toBe(maximum);

  await page.getByRole('button', { name: 'Exportar ficha' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar JSON' }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('Kael.json');
  await page.getByRole('button', { name: 'Cancelar' }).click();

  await page.getByRole('button', { name: 'Combate', exact: true }).click();
  await page.getByRole('button', { name: 'Rolar Destreza' }).click();
  await expect(page.locator('.rollResultBlock')).toBeVisible({ timeout: 8000 });
  await page.getByRole('button', { name: 'Voltar à ficha' }).click();
  await expect(page.getByRole('navigation', { name: 'Seções da ficha' }).getByRole('button', { name: 'Combate' })).toHaveAttribute('aria-current', 'page');

  await page.locator('.mobileNewCharacterButton').click();
  await page.getByLabel('Nome do personagem').fill('Novo herói');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.locator('.sidebar .mainNav').getByRole('button', { name: 'Fichas' }).click();
  await expect(page.locator('.wizardContent').getByRole('heading', { name: 'Dados' })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('.sidebar .mainNav').getByRole('button', { name: 'Fichas' }).click();
  await expect(page.getByRole('navigation', { name: 'Seções da ficha' })).toBeVisible();
});

test('edicao pendente sobrevive ao recarregamento e sincroniza depois', async ({ page }) => {
  const state = fixture();
  state.failWrites = true;
  await prepare(page, state);
  await page.getByRole('button', { name: 'Aplicar dano' }).click();
  const localLife = await page.locator('.resourceHeader').filter({ hasText: 'Vida' }).locator('span').innerText();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('runalith-pending-characters-v1:user_mobile_e2e'))).not.toBeNull();
  await expect(page.getByRole('alert').filter({ hasText: 'cópia local' })).toBeVisible({ timeout: 8000 });
  page.once('dialog', (dialog) => dialog.accept());
  await page.reload();
  await page.locator('.chooserCharacter').filter({ hasText: 'Kael' }).click();
  await expect(page.locator('.resourceHeader').filter({ hasText: 'Vida' }).locator('span')).toHaveText(localLife);
  state.failWrites = false;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('runalith-pending-characters-v1:user_mobile_e2e'))).toBeNull();
  await expect(page.getByRole('status').filter({ hasText: 'Ficha sincronizada' })).toBeVisible();
});

test('conflito preserva edicao local ate descarte confirmado', async ({ page }) => {
  const state = fixture();
  state.conflictWrites = true;
  await prepare(page, state);
  await page.getByRole('button', { name: 'Aplicar dano' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'A cópia local não foi sincronizada' })).toBeVisible({ timeout: 8000 });
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('runalith-pending-characters-v1:user_mobile_e2e'))).not.toBeNull();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Descartar cópia local' }).last().click();
  await expect(page.locator('.resourceHeader').filter({ hasText: 'Vida' }).locator('span')).toHaveText('10/20');
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('runalith-pending-characters-v1:user_mobile_e2e'))).toBeNull();
});
