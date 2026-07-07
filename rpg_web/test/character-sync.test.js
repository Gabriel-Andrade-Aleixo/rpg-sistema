import test from 'node:test';
import assert from 'node:assert/strict';

import { changedCharacterFields, compactCharacter } from '../lib/characterSync.js';

test('detecta somente os campos persistentes alterados', () => {
  const previous = { id: '1', currentHp: 10, currentMana: 8, modifiers: [1], syncRevision: 2 };
  const next = { ...previous, currentHp: 7, modifiers: [2], syncRevision: 3 };
  assert.deepEqual(changedCharacterFields(previous, next), ['currentHp']);
});

test('compacta históricos e remove modificadores calculados', () => {
  const compact = compactCharacter({
    id: '1',
    modifiers: [{ id: 'derived' }],
    rollHistory: Array.from({ length: 30 }, (_, index) => index),
    actionHistory: Array.from({ length: 40 }, (_, index) => index),
  });
  assert.equal('modifiers' in compact, false);
  assert.equal(compact.rollHistory.length, 20);
  assert.equal(compact.actionHistory.length, 30);
});
