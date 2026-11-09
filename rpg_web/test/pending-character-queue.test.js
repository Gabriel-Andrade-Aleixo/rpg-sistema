import test from 'node:test';
import assert from 'node:assert/strict';

import { applyPendingEntry, pendingEntry, pendingEntryIsApplied, readPendingQueue, rebasePendingEntry, writePendingQueue } from '../lib/pendingCharacterQueue.js';

test('guarda filas separadas por usuario e restaura uma edicao local', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const base = { id: 'char_1', name: 'Kael', currentHp: 10, currentMana: 5, syncRevision: 2 };
  const entry = pendingEntry({ ...base, currentHp: 7 }, base);
  assert.equal(writePendingQueue(storage, 'user_1', new Map([[base.id, entry]])), true);
  assert.equal(readPendingQueue(storage, 'user_2').size, 0);
  const restored = readPendingQueue(storage, 'user_1').get(base.id);
  assert.equal(pendingEntryIsApplied({ ...base, currentHp: 7, syncRevision: 3 }, restored), true);
  assert.deepEqual(applyPendingEntry({ ...base, currentMana: 3, syncRevision: 3 }, restored), {
    ...base, currentHp: 7, currentMana: 3, syncRevision: 3,
  });
  assert.equal(writePendingQueue(storage, 'user_1', new Map()), true);
  assert.equal(readPendingQueue(storage, 'user_1').size, 0);
});

test('rebaseia edicoes feitas durante um salvamento sem sobrescrever campos remotos', () => {
  const base = { id: 'char_1', currentHp: 10, currentMana: 5, syncRevision: 2 };
  const sent = pendingEntry({ ...base, currentHp: 7 }, base);
  const current = pendingEntry({ ...base, currentHp: 7, currentMana: 4 }, base, sent);
  const rebased = rebasePendingEntry(current, sent, { ...base, currentHp: 7, syncRevision: 3 });
  assert.equal(rebased.base.syncRevision, 3);
  assert.equal(rebased.character.currentHp, 7);
  assert.equal(rebased.character.currentMana, 4);
});
