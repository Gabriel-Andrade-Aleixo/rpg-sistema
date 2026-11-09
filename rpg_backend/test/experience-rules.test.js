import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classXpRequired,
  developmentAttributeCost,
  migrateExperienceSystem,
} from '../lib/experienceRules.js';

test('usa a progressão de XP de Classe da versão 0.3', () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(classXpRequired),
    [10, 15, 20, 25, 30, 35, 45, 50, 55, 75],
  );
});

test('redistribui XP uma vez e reproduz o exemplo do nível 2', () => {
  const migrated = migrateExperienceSystem({
    level: 2,
    classXp: 7,
    classXpTotal: 27,
    areaExperience: {},
    combatXp: 0,
  }, { now: '2026-11-04T00:00:00.000Z' });
  assert.equal(migrated.classXp, 22);
  assert.equal(migrated.classXpTotal, 42);
  assert.equal(migrated.xpSystemVersion, 2);
  assert.deepEqual(migrateExperienceSystem(migrated), migrated);
});

test('consolida saldos antigos em XP e Pontos de Desenvolvimento', () => {
  const migrated = migrateExperienceSystem({
    level: 2,
    classXp: 0,
    classXpTotal: 20,
    combatXp: 14,
    areaExperience: { Percepção: 12 },
  });
  assert.equal(migrated.developmentPoints, 1);
  assert.equal(migrated.developmentXp, 6);
  assert.equal(migrated.combatXp, 0);
  assert.deepEqual(migrated.areaExperience, {});
});

test('custos de atributo respeitam as faixas inclusivas', () => {
  assert.deepEqual([0, 5, 6, 10, 11, 20].map(developmentAttributeCost), [1, 1, 2, 2, 5, 5]);
});
