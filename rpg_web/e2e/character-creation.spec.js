import { expect, test } from '@playwright/test';

test('cria, confirma no backend e exibe uma nova ficha', async ({ page, request }) => {
  const name = `E2E Persistência ${Date.now()}`;
  const email = 'codex-e2e@example.com';
  const password = 'CodexE2e123!';
  let characterId = '';
  let token = '';

  try {
    const registerResponse = await request.post('http://localhost:8787/auth/register', {
      data: { email, password, displayName: 'Codex E2E' },
    });
    if (registerResponse.ok()) {
      const payload = await registerResponse.json();
      token = payload.token;
      await page.addInitScript((session) => {
        window.sessionStorage.setItem('rpg-auth-session', JSON.stringify(session));
      }, { user: payload.user, token: payload.token, expiresAt: payload.expiresAt });
    } else {
      const loginResponse = await request.post('http://localhost:8787/auth/login', {
        data: { email, password },
      });
      expect(loginResponse.ok()).toBeTruthy();
      const payload = await loginResponse.json();
      token = payload.token;
      await page.addInitScript((session) => {
        window.sessionStorage.setItem('rpg-auth-session', JSON.stringify(session));
      }, { user: payload.user, token: payload.token, expiresAt: payload.expiresAt });
    }

    await page.goto('http://localhost:3000');
    await page.getByRole('button', { name: 'Criar personagem' }).first().click();

    await page.getByLabel('Nome do personagem').fill(name);
    await page.getByLabel('Nome do jogador').fill('Teste automatizado');
    await page.getByRole('button', { name: 'Continuar' }).click();

    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByText('Lizardfolk', { exact: true }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();

    await page.getByText('Bárbaro', { exact: true }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();

    await page.getByRole('button', { name: 'Rolagem d12' }).click();
    await page.getByLabel('Resultado do dado de vida no nível 1').fill('7');
    await page.getByRole('button', { name: 'Confirmar e calcular vida do nível 1' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();

    await page.getByRole('button', { name: 'Salvar ficha' }).click();
    await expect(page.locator('.characterCard').filter({ hasText: name })).toBeVisible({ timeout: 30000 });

    const response = await request.get('http://localhost:8787/characters', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.ok()).toBeTruthy();
    const payload = await response.json();
    const saved = payload.characters.find((character) => character.name === name);
    expect(saved).toBeTruthy();
    expect(saved.hpProgressionMode).toBe('roll');
    expect(saved.levelHistory[0].hpMethod).toBe('roll');
    expect(saved.levelHistory[0].rollResult).toBe(7);
    expect(saved.currentHp).toBe(saved.maxHp);
    characterId = saved.id;
  } finally {
    if (!characterId) {
      const response = await request.get('http://localhost:8787/characters', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (response.ok()) {
        const payload = await response.json();
        characterId = payload.characters.find((character) => character.name === name)?.id || '';
      }
    }
    if (characterId) {
      await request.delete(`http://localhost:8787/characters/${characterId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    }
  }
});
