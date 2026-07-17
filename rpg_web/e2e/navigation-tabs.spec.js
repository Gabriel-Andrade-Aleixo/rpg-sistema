import { expect, test } from '@playwright/test';

const rules = (value) => `<!-- RPG_RULES_JSON_START -->\n${JSON.stringify(value)}\n<!-- RPG_RULES_JSON_END -->`;

test('seleciona personagem e navega pelas áreas organizadas da ficha', async ({ page }, testInfo) => {
  let character = {
    id: 'char_navigation', name: 'Kael', playerName: 'Teste', raceId: 'race_thri', raceVariant: 'wings', classId: 'class_archer', level: 5,
    background: 'Caçador das ilhas', lore: 'Protege as rotas entre as ilhas flutuantes.', imageUrl: '', hpProgressionMode: 'fixed',
    attributes: { strength: 1, dexterity: 5, constitution: 3, intelligence: 4, charisma: 1, faith: 0 }, skillBonuses: {},
    resources: { humanity: 100, divinity: 0, focoMax: 14, focoCurrent: 12, cadenciaMax: 3, cadenciaCurrent: 3 }, currency: { gold: 1, silver: 2, copper: 3 },
    notes: ['Teste de navegação'], inventory: [], equipment: [], maxHp: 35, currentHp: 30, maxMana: 29, currentMana: 20,
    skillPoints: 0, classPoints: 0, proficiencies: ['Furtividade'], manualProficiencies: ['Furtividade'], abilities: ['Rajada de Flechas'], modifiers: [],
    rollHistory: [], levelHistory: [], areaExperience: {}, combatXp: 0, experienceHistory: [], humanityHistory: [], spells: [], actionHistory: [],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  let catalog = {
    categories: ['Racas', 'Classes', 'Pericias'],
    entries: [
      { id: 'race_thri', name: 'Thri-kreen', category: 'Racas', description: `Povo das ilhas flutuantes.\n${rules({ type: 'race', attributeBonuses: { dexterity: 1 }, variants: [{ id: 'wings', name: 'Asas', attributeRollBonuses: { dexterity: 1 } }] })}` },
      { id: 'class_archer', name: 'Arqueiro Espectral', category: 'Classes', description: `Combatente de longa distância que usa flechas mágicas.\n${rules({ type: 'class', defense: { base: 0, terms: { constitution: .4, dexterity: .3, intelligence: .3 } }, hp: { initial: { base: 10, terms: { constitution: 2, dexterity: 2 } }, perLevel: { fixed: { base: 5, terms: { constitution: 1 } }, roll: { die: 8, base: 0, terms: { constitution: 1 } }, hybrid: { die: 4, base: 4, terms: { constitution: 1 } } } }, mana: { base: 15, terms: { intelligence: 1, dexterity: 2 } }, resources: [{ id: 'foco', name: 'Foco', maximum: { base: 6, terms: { intelligence: 2 } } }, { id: 'cadencia', name: 'Cadência', maximum: { base: 3, terms: {} } }], attributeProgression: [], allowedCombatXpAttributes: ['dexterity', 'intelligence'] })}` },
      { id: 'skill_investigation', name: 'Investigação', category: 'Pericias', description: 'Inteligência 100%' },
      { id: 'skill_stealth', name: 'Furtividade', category: 'Pericias', description: 'Destreza 100%' },
      { id: 'armor_leather', name: 'Armadura de Couro', category: 'Equipamentos', description: rules({ type: 'item', modifiers: [{ targetType: 'stat', targetId: 'defense', value: 1 }] }), labels: [{ name: 'Armadura' }, { name: 'Armadura Leve' }] },
      { id: 'spell_solar', name: 'Sentença Solar', category: 'Magias', description: `Feixe de luz divina.\n${rules({ type: 'spell', school: 'divina', topic: 'Grau 1 · Utilidade e punição', costs: { mana: 1, focus: 0, humanity: 3 }, damage: '1d8 + Fé', range: 'Um inimigo' })}`, labels: [{ name: 'Magia: Divina' }, { name: 'Grau 1 · Utilidade e punição' }] },
      { id: 'spell_arrow', name: 'Flecha Mágica', category: 'Magias', description: `Disparo mágico básico com dano 2d4.\n${rules({ type: 'spell', school: 'espectral', className: 'Arqueiro Espectral', topic: 'Flecha Mágica', costs: { mana: 0, focus: 0, humanity: 0 }, damage: '2d4', actionType: 'spectral_arrow', actionId: 'spectral_arrow' })}` },
      { id: 'spell_impact', name: 'Infusão: Impacto', category: 'Magias', description: `Aprimora a Flecha Mágica.\n${rules({ type: 'spell', school: 'espectral', className: 'Arqueiro Espectral', topic: 'Flecha Mágica · Aprimoramentos', costs: { mana: 2, focus: 1, humanity: 0 }, damage: '2d4 +1', actionType: 'spectral_infusion', actionId: 'impact' })}` },
    ],
  };

  await page.addInitScript((session) => {
    window.localStorage.setItem('rpg-auth-session', JSON.stringify(session));
  }, {
    token: 'e2e-admin-token',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    user: { id: 'user_e2e_admin', email: 'mestre.e2e@example.com', displayName: 'Mestre E2E', role: 'admin' },
  });
  await page.route('http://localhost:8787/characters', async (route) => {
    if (route.request().method() === 'POST') {
      character = route.request().postDataJSON().character;
      await route.fulfill({ json: { ok: true, character } });
      return;
    }
    await route.fulfill({ json: { ok: true, characters: [character], publicCharacters: [] } });
  });
  await page.route('http://localhost:8787/catalog*', async (route) => route.fulfill({ json: { ok: true, catalog } }));
  await page.route('http://localhost:8787/catalog/items', async (route) => {
    const item = route.request().postDataJSON().item;
    const created = { id: `created_${Date.now()}`, name: item.name, category: 'Equipamentos', description: rules({ type: 'item', modifiers: item.bonusTarget ? [{ targetType: 'stat', targetId: item.bonusTarget, value: Number(item.bonusValue) }] : [] }), labels: [{ name: `Tipo: ${item.type}` }] };
    catalog = { ...catalog, entries: [...catalog.entries, created] };
    await route.fulfill({ status: 201, json: { ok: true, item: created } });
  });
  await page.goto(process.env.RPG_WEB_URL || 'http://localhost:3000');

  await expect(page.getByRole('heading', { name: 'Escolha um personagem' })).toBeVisible();
  await page.locator('.chooserCharacter').filter({ hasText: 'Kael' }).click();
  await expect(page.getByRole('navigation', { name: 'Seções da ficha' })).toBeVisible();
  await expect(page.locator('.metric').filter({ hasText: 'CA' }).getByText('14', { exact: true })).toBeVisible();
  await expect(page.locator('.metric').filter({ hasText: 'CD Divina' }).getByText('—', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Magias' }).click();
  await page.getByText('Adicionar magia existente').click();
  await page.getByLabel('Buscar no catálogo').fill('Sentença Solar');
  await page.locator('.catalogSpellPicker article').filter({ hasText: 'Sentença Solar' }).getByRole('button', { name: 'Adicionar' }).click();
  const solarSpell = page.locator('.spellList article').filter({ hasText: 'Sentença Solar' });
  await expect(solarSpell).toContainText('1d8 + Fé');
  await solarSpell.getByRole('button', { name: 'Usar com sucesso' }).click();
  await expect(page.locator('.spellResources .metric').filter({ hasText: 'Mana' })).toContainText('19/31');
  await expect(page.locator('.spellResources .metric').filter({ hasText: 'Humanidade' })).toContainText('97');
  await solarSpell.getByRole('button', { name: 'Organizar tópico' }).click();
  await solarSpell.getByLabel('Tópico de Sentença Solar').fill('Favoritas');
  await solarSpell.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.locator('.spellTopics').getByRole('heading', { name: 'Favoritas' })).toBeVisible();
  await page.locator('.classSpellPresets').getByRole('button', { name: 'Flecha Mágica', exact: true }).click();
  await page.locator('.classSpellPresets').getByRole('button', { name: 'Infusão: Impacto', exact: true }).click();
  const magicArrow = page.locator('.spellList article').filter({ has: page.getByText('Flecha Mágica', { exact: true }) });
  await expect(magicArrow).toContainText('2d4');
  await page.getByLabel('Resultado dos 2d4').fill('7');
  await page.locator('.spellList article').filter({ hasText: 'Infusão: Impacto' }).getByRole('button', { name: 'Usar com sucesso' }).click();
  await expect(page.locator('.spellResources .metric').filter({ hasText: 'Mana' })).toContainText('18/31');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('grimorio-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.getByRole('button', { name: 'Dados' }).click();
  await page.getByRole('button', { name: 'Rolar d20' }).click();
  await expect(page.locator('.diceStage canvas')).toBeVisible();
  await expect(page.locator('.rollResultBlock')).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: 'Fichas' }).click();

  await page.getByRole('button', { name: 'Combate' }).click();
  await expect(page.getByText('Flecha Mágica e infusões')).toBeVisible();
  await expect(page.getByText('Infusão: Espectral')).toBeVisible();

  await page.getByRole('button', { name: 'Evolução' }).click();
  await expect(page.getByLabel('Área de experiência')).toBeVisible();
  await expect(page.getByLabel('Área de experiência').locator('option')).toHaveCount(7);

  await page.getByRole('button', { name: 'História' }).click();
  await expect(page.getByText('Protege as rotas entre as ilhas flutuantes.')).toBeVisible();
  await expect(page.getByText('Povo das ilhas flutuantes.')).toBeVisible();
  await expect(page.getByText('Combatente de longa distância que usa flechas mágicas.')).toBeVisible();

  await page.getByRole('button', { name: 'Itens' }).click();
  await expect(page.getByText('Adicionar item personalizado')).toHaveCount(0);
  await page.getByText('Adicionar item existente').click();
  await page.getByLabel('Buscar no catálogo').fill('Armadura de Couro');
  await page.locator('.catalogItemPicker article').filter({ hasText: 'Armadura de Couro' }).getByRole('button', { name: 'Adicionar' }).click();
  await expect(page.getByText('Armadura de Couro').last()).toBeVisible();
  await page.getByRole('button', { name: 'Equipar' }).click();

  await page.getByRole('button', { name: 'Resumo' }).click();
  await expect(page.locator('.metric').filter({ hasText: 'Defesa' }).getByText('5', { exact: true })).toBeVisible();
  await expect(page.locator('.metric').filter({ hasText: 'CA' }).getByText('15', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Mestre' }).click();
  await page.locator('.adminTabs').getByRole('button', { name: /Itens/ }).click();
  await page.getByRole('button', { name: 'Novo' }).click();
  await page.getByLabel('Nome').fill('Luva do Mestre');
  await page.getByRole('button', { name: 'Criar item' }).click();
  await expect(page.getByText('Item criado na biblioteca oficial.')).toBeVisible();
});
