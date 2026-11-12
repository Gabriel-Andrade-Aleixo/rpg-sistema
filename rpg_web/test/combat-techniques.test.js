import test from 'node:test';
import assert from 'node:assert/strict';

import {
  advanceTechniqueTurn,
  canLearnCombatTechniques,
  recordTechniqueTraining,
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
  let learned = saveCombatTechnique(emptyCharacter(), {
    name: 'Machadadas gêmeas', costType: 'cooldown', cooldownTurns: 2,
  }).character;
  const id = learned.techniques[0].id;
  learned = recordTechniqueTraining(learned, id, true).character;
  learned = recordTechniqueTraining(learned, id, true).character;
  learned = recordTechniqueTraining(learned, id, true).character;
  assert.equal(learned.techniques[0].learningState, 'partial');
  const active = setTechniqueCombatState(learned, true);
  const used = useCombatTechnique(active, active.techniques[0].id, { executionSucceeded: true });
  assert.equal(used.error, '');
  assert.equal(used.character.techniques[0].cooldownRemaining, 2);
  assert.match(useCombatTechnique(used.character, active.techniques[0].id, { executionSucceeded: true }).error, /recarrega/);
  assert.equal(advanceTechniqueTurn(used.character).techniques[0].cooldownRemaining, 1);
  assert.equal(setTechniqueCombatState(used.character, false).techniques[0].cooldownRemaining, 0);
});

test('oito treinos bem-sucedidos dominam uma técnica sem execução em combate', () => {
  let character = saveCombatTechnique(emptyCharacter(), { name: 'Corte lunar' }).character;
  const id = character.techniques[0].id;
  for (let index = 0; index < 8; index += 1) character = recordTechniqueTraining(character, id, true).character;
  assert.equal(character.techniques[0].trainingHours, 8);
  assert.equal(character.techniques[0].trainingSuccesses, 3);
  assert.equal(character.techniques[0].masteryTrainingSuccesses, 5);
  assert.equal(character.techniques[0].learningState, 'mastered');
});

test('encerrar combate limpa o estado do Espadachim sem alterar outros recursos', () => {
  const character = { ...emptyCharacter(), resources: { hp: 12, swordsmanThreats: 3, swordsmanConcentration: 2, swordsmanDodgeUsed: 1, swordsmanOpeningUsed: 1 } };
  const ended = setTechniqueCombatState(character, false);
  assert.equal(ended.resources.hp, 12);
  for (const key of ['swordsmanThreats', 'swordsmanConcentration', 'swordsmanDodgeUsed', 'swordsmanOpeningUsed']) {
    assert.equal(ended.resources[key], 0);
  }
});

test('classes sem Mana ou usuárias de armas podem aprender técnicas', () => {
  assert.equal(canLearnCombatTechniques({ manaFormula: null, usesWeapons: false }), true);
  assert.equal(canLearnCombatTechniques({ manaFormula: {}, usesWeapons: true }), true);
  assert.equal(canLearnCombatTechniques({ manaFormula: {}, usesWeapons: false }), false);
});
