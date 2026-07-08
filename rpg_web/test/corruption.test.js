import test from 'node:test';
import assert from 'node:assert/strict';

import { advanceDemonicTurn, changeCorruption, corruptionStatus, demonicDamageBonus, demonicIncomingDamageBonus, demonicSpellCost, toggleDemonicZone } from '../lib/corruption.js';
import { useSpell } from '../lib/classActions.js';

const character = (corruption) => ({
  id: 'test', currentHp: 20, maxHp: 20, currentMana: 30,
  resources: { corruption, humanity: 100, focoCurrent: 0, dead: 0 },
  corruptionHistory: [], spells: [], actionHistory: [],
});

test('faixas de Corrupção aplicam restrições e escalas oficiais', () => {
  assert.equal(corruptionStatus(character(49)).demonicOnly, false);
  assert.equal(corruptionStatus(character(50)).demonicOnly, true);
  assert.equal(demonicDamageBonus(character(79)), 7);
  assert.equal(demonicSpellCost(character(79), 3), 10);
});

test('Zona Demoníaca adiciona vulnerabilidade ao corpo', () => {
  const active = toggleDemonicZone(character(80));
  assert.equal(active.resources.demonicZoneActive, 1);
  assert.equal(demonicIncomingDamageBonus(active), 5);
});

test('Última Ordem avança até a manifestação e mata o pactuante', () => {
  let current = changeCorruption(character(94), 1, 'Última Ordem');
  for (let turn = 0; turn < 5; turn += 1) current = advanceDemonicTurn(current);
  assert.equal(current.resources.corruption, 100);
  assert.equal(current.resources.demonicManifested, 1);
  assert.equal(current.currentHp, 0);
  assert.equal(corruptionStatus(current).playable, false);
});

test('magia demoníaca consome custo escalado e registra bônus de dano', () => {
  const spell = { id: 'demon', name: 'Chama Abissal', type: 'Demoníaca', manaCost: 2, focusCost: 0, humanityCost: 0 };
  const result = useSpell(character(50), spell, true);
  assert.equal(result.character.currentMana, 23);
  assert.match(result.character.actionHistory[0].result, /dano demoníaco \+5/);
});
