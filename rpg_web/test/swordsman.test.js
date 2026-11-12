import assert from 'node:assert/strict';
import test from 'node:test';
import { markSwordsmanAction, setSwordsmanThreats, startSwordsmanTurn, swordsmanState } from '../lib/swordsman.js';

test('Concentração cai imediatamente e recupera um estágio por turno', () => {
  let character = { level: 3, resources: {} };
  character = setSwordsmanThreats(character, 3);
  assert.equal(swordsmanState(character).concentration, 2);
  character = setSwordsmanThreats(character, 1);
  assert.equal(swordsmanState(character).concentration, 2);
  character = markSwordsmanAction(character, 'opening');
  character = startSwordsmanTurn(character);
  assert.equal(swordsmanState(character).concentration, 1);
  assert.equal(swordsmanState(character).openingUsed, false);
  character = startSwordsmanTurn(character);
  assert.equal(swordsmanState(character).concentration, 0);
});

test('a recuperação do nível 9 volta à Concentração Total com um alvo', () => {
  const character = { level: 9, resources: { swordsmanThreats: 1, swordsmanConcentration: 2, swordsmanDodgeUsed: 1 } };
  const next = startSwordsmanTurn(character);
  assert.equal(swordsmanState(next).concentration, 0);
  assert.equal(swordsmanState(next).dodgeUsed, false);
});
