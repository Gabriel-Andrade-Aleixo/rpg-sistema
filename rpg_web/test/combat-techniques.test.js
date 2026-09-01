import test from 'node:test';
import assert from 'node:assert/strict';

import {
  advanceTechniqueTurn,
  canLearnCombatTechniques,
  saveCombatTechnique,
  setTechniqueCombatState,
  useCombatTechnique,
} from '../lib/combatTechniques.js';
import { emptyCharacter } from '../lib/rpgData.js';

test('técnica só pode ser treinada fora de combate', () => {
  const character = emptyCharacter();
  const learned = saveCombatTechnique(character, {
    name: 'Machadadas gêmeas',
    damage: 'Dois ataques consecutivos',
    training: 'Treino com machado fora de combate',
    costType: 'cooldown',
    cooldownTurns: 2,
  });
  assert.equal(learned.error, '');
  assert.equal(learned.character.techniques.length, 1);

  const inCombat = setTechniqueCombatState(learned.character, true);
  const blocked = saveCombatTechnique(inCombat, { name: 'Golpe novo' });
  assert.match(blocked.error, /fora de combate/);
});

test('uso aplica recarga, avança turnos e encerra combate limpo', () => {
  const learned = saveCombatTechnique(emptyCharacter(), {
    name: 'Machadadas gêmeas', costType: 'cooldown', cooldownTurns: 2,
  }).character;
  const active = setTechniqueCombatState(learned, true);
  const used = useCombatTechnique(active, active.techniques[0].id);
  assert.equal(used.error, '');
  assert.equal(used.character.techniques[0].cooldownRemaining, 2);
  assert.match(useCombatTechnique(used.character, active.techniques[0].id).error, /recarrega/);
  assert.equal(advanceTechniqueTurn(used.character).techniques[0].cooldownRemaining, 1);
  assert.equal(setTechniqueCombatState(used.character, false).techniques[0].cooldownRemaining, 0);
});

test('classes sem Mana ou usuárias de armas podem aprender técnicas', () => {
  assert.equal(canLearnCombatTechniques({ manaFormula: null, usesWeapons: false }), true);
  assert.equal(canLearnCombatTechniques({ manaFormula: {}, usesWeapons: true }), true);
  assert.equal(canLearnCombatTechniques({ manaFormula: {}, usesWeapons: false }), false);
});
