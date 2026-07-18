import test from 'node:test';
import assert from 'node:assert/strict';

import { infusionDamage, infusionManaCost, magicArrowDamage, spectralInfusions, useInfusion, useMagicArrow, useSpell } from '../lib/classActions.js';
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

test('Flecha Mágica causa 2d4 e a infusão aprimora o mesmo disparo', () => {
  assert.deepEqual(magicArrowDamage(3, 4), { dice: [3, 4], total: 7 });
  const spell = { id: 'arrow', successfulUses: 0 };
  const character = { ...emptyCharacter(), spells: [spell] };
  const result = useMagicArrow(character, spell, { successful: true, dice: magicArrowDamage(2, 4) });
  assert.equal(result.damage.total, 6);
  assert.match(result.character.actionHistory[0].result, /2d4 = 2 \+ 4 = 6/);
  assert.equal(result.character.spells[0].successfulUses, 1);
});

test('magia registra terceiro sucesso e desconta recursos', () => {
  const spell = { id: 'spell', name: 'Seta astral', manaCost: 2, focusCost: 1, humanityCost: 3, successfulUses: 2 };
  const character = { ...emptyCharacter(), currentMana: 10, resources: { ...emptyCharacter().resources, focoCurrent: 5 }, spells: [spell] };
  const result = useSpell(character, spell, true);
  assert.equal(result.error, '');
  assert.equal(result.character.spells[0].successfulUses, 3);
  assert.equal(result.character.resources.humanity, 97);
});

test('magia divina registra o bônus de Fé dividido por dois', () => {
  const spell = { id: 'divine', name: 'Luz Julgadora', type: 'Divina', manaCost: 1, focusCost: 0, humanityCost: 0, successfulUses: 0 };
  const base = emptyCharacter();
  const character = { ...base, currentMana: 5, attributes: { ...base.attributes, faith: 7 }, resources: { ...base.resources, humanity: 40, divinity: 60 }, spells: [spell] };
  const result = useSpell(character, spell, true);
  assert.equal(result.damageBonus, 3);
  assert.match(result.character.actionHistory[0].result, /Fé \/ 2/);
});
