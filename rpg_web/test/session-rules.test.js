import test from 'node:test';
import assert from 'node:assert/strict';

import { infusionDamage, infusionManaCost, spectralInfusions, useInfusion, useSpell } from '../lib/classActions.js';
import { changeHitPoints, recordDeathSave } from '../lib/deathSaves.js';
import { emptyCharacter } from '../lib/rpgData.js';

test('três acertos contra a morte recuperam 1 de vida', () => {
  let character = { ...emptyCharacter(), maxHp: 20, currentHp: 0 };
  character = recordDeathSave(character, true);
  character = recordDeathSave(character, true);
  character = recordDeathSave(character, true);
  assert.equal(character.currentHp, 1);
  assert.equal(character.resources.deathSuccesses, 0);
});

test('cura limpa acertos, erros e estado morto', () => {
  const character = { ...emptyCharacter(), maxHp: 20, currentHp: 0, resources: { ...emptyCharacter().resources, deathSuccesses: 2, deathFailures: 3, dead: 1 } };
  const next = changeHitPoints(character, 4);
  assert.equal(next.currentHp, 4);
  assert.deepEqual([next.resources.deathSuccesses, next.resources.deathFailures, next.resources.dead], [0, 0, 0]);
});

test('infusão com 3 Cadência reduz PM e consome Foco', () => {
  const character = { ...emptyCharacter(), currentMana: 10, resources: { ...emptyCharacter().resources, focoCurrent: 8, cadenciaCurrent: 3 } };
  const result = useInfusion(character, spectralInfusions.find((item) => item.id === 'impact'));
  assert.equal(result.error, '');
  assert.equal(result.character.currentMana, 9);
  assert.equal(result.character.resources.focoCurrent, 7);
});

test('flechas mágicas calculam dano e penalidade de múltiplos ataques', () => {
  const impact = spectralInfusions.find((item) => item.id === 'impact');
  const spectral = spectralInfusions.find((item) => item.id === 'spectral');
  assert.deepEqual(infusionDamage(impact, 8, 3), { hit: 10, miss: 0 });
  assert.deepEqual(infusionDamage(spectral, 9, 0), { hit: 9, miss: 3 });
  assert.equal(infusionManaCost(impact, 3, 3), 2);
});

test('magia registra terceiro sucesso e desconta recursos', () => {
  const spell = { id: 'spell', name: 'Seta astral', manaCost: 2, focusCost: 1, humanityCost: 3, successfulUses: 2 };
  const character = { ...emptyCharacter(), currentMana: 10, resources: { ...emptyCharacter().resources, focoCurrent: 5 }, spells: [spell] };
  const result = useSpell(character, spell, true);
  assert.equal(result.error, '');
  assert.equal(result.character.spells[0].successfulUses, 3);
  assert.equal(result.character.resources.humanity, 97);
});
