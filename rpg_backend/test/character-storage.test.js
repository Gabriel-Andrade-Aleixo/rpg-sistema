import assert from 'node:assert/strict';
import test from 'node:test';

process.env.VERCEL = '1';
const { mergeCharacterUpdate, prepareCharacterForStorage } = await import('../server.js');

test('compacta fichas grandes para caber com folga na descrição do Trello', () => {
  const character = {
    id: 'char_large',
    name: 'Personagem grande',
    lore: 'História '.repeat(1500),
    modifiers: Array.from({ length: 300 }, (_, index) => ({ id: index, description: 'Regra calculada '.repeat(10) })),
    rollHistory: Array.from({ length: 100 }, (_, index) => ({ id: index, modifiers: Array(20).fill({ sourceName: 'Teste' }) })),
    actionHistory: Array.from({ length: 100 }, (_, index) => ({ id: index, result: 'Resultado '.repeat(20) })),
    inventory: [],
    equipment: [],
  };
  const compact = prepareCharacterForStorage(character);
  assert.equal(compact.modifiers, undefined);
  assert.ok(compact.rollHistory.length <= 12);
  assert.ok(JSON.stringify(compact).length < 15800);
});

test('mescla somente campos alterados sobre a revisão mais recente', () => {
  const current = { id: 'char', currentHp: 10, currentMana: 8, notes: ['remoto'] };
  const incoming = { id: 'char', currentHp: 7, currentMana: 2, notes: ['local'] };
  const merged = mergeCharacterUpdate(current, incoming, ['currentHp']);
  assert.deepEqual(merged, { id: 'char', currentHp: 7, currentMana: 8, notes: ['remoto'] });
});
