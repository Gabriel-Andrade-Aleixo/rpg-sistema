import assert from 'node:assert/strict';
import test from 'node:test';
import { divineSpells } from '../data/divine-spells.js';
import { spectralArrowSpells } from '../data/spectral-arrow-spells.js';

test('grimório divino contém 26 magias únicas em três graus', () => {
  assert.equal(divineSpells.length, 26);
  assert.equal(new Set(divineSpells.map((spell) => spell.name)).size, 26);
  assert.deepEqual([...new Set(divineSpells.map((spell) => spell.level))], [1, 2, 3]);
  assert.ok(divineSpells.every((spell) => spell.topic.startsWith(`Grau ${spell.level}`)));
});

test('Flecha Mágica causa 2d4 e possui cinco infusões de aprimoramento', () => {
  assert.equal(spectralArrowSpells.length, 6);
  assert.equal(spectralArrowSpells[0].damage, '2d4');
  assert.equal(spectralArrowSpells[0].actionType, 'spectral_arrow');
  assert.ok(spectralArrowSpells.slice(1).every((spell) => spell.actionType === 'spectral_infusion'));
});

test('custos principais conferem com o grimório recebido', () => {
  const solar = divineSpells.find((spell) => spell.name === 'Sentença Solar');
  const aegis = divineSpells.find((spell) => spell.name === 'Égide do Meio-Dia');
  assert.deepEqual([solar.manaCost, solar.humanityCost, solar.damage], [1, 3, '1d8 + Fé']);
  assert.deepEqual([aegis.manaCost, aegis.humanityCost], [10, 25]);
});
