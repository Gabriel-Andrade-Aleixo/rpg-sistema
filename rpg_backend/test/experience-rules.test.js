import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classXpRequired,
  classXpRedistribution,
  developmentAttributeCost,
  migrateExperienceSystem,
} from '../lib/experienceRules.js';

test('usa a progressão de XP de Classe da versão 0.3', () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(classXpRequired),
    [10, 15, 20, 25, 30, 35, 45, 50, 55, 75],
  );
});

test('redistribui apenas a diferença dos níveis já pagos', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(classXpRedistribution), [0, 10, 15, 15, 10, 20, 25, 20, 10, -5]);
  const migrated = migrateExperienceSystem({
    level: 2,
    classXp: 7,
    classXpTotal: 27,
    areaExperience: {},
    combatXp: 0,
  }, { now: '2026-11-04T00:00:00.000Z' });
  assert.equal(migrated.classXp, 17);
  assert.equal(migrated.classXpTotal, 37);
  assert.equal(migrated.classXpHistory[0].amount, 10);
  assert.equal(migrated.xpSystemVersion, 3);
  assert.deepEqual(migrateExperienceSystem(migrated), migrated);
});

test('corrige a redistribuição v2 sem apagar XP ganho depois', () => {
  const migrated = migrateExperienceSystem({
    level: 2,
    xpSystemVersion: 2,
    classXp: 19,
    classXpTotal: 39,
    classXpHistory: [
      { id: 'class_xp_recent', amount: 4 },
      { id: 'class_xp_redistribution_v2', amount: 15, breakdown: { redistribution: 15 } },
    ],
  });
  assert.equal(migrated.classXp, 14);
  assert.equal(migrated.classXpTotal, 34);
  assert.equal(migrated.classXpHistory[0].amount, 4);
  assert.equal(migrated.classXpHistory[1].amount, 10);
  assert.deepEqual(migrateExperienceSystem(migrated), migrated);
  const downgradedByOldApi = { ...migrated, xpSystemVersion: 2 };
  const repaired = migrateExperienceSystem(downgradedByOldApi);
  assert.equal(repaired.classXp, 14);
  assert.equal(repaired.classXpHistory[1].amount, 10);
  assert.equal(repaired.xpSystemVersion, 3);
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

test('custos de atributo usam a faixa do próximo ponto', () => {
  assert.deepEqual([0, 4, 5, 9, 10, 11, 20].map(developmentAttributeCost), [1, 1, 2, 2, 5, 5, 5]);
});
