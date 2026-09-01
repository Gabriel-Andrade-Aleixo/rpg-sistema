import test from 'node:test';
import assert from 'node:assert/strict';

import { validateAndNormalizeCharacter } from '../lib/characterRules.js';

const metadata = (value) => ({ metadata: value, description: '' });

const race = {
  id: 'race-thri', name: 'Thri-kreen', category: 'Racas',
  ...metadata({ type: 'race', attributeBonuses: { dexterity: 1 }, variants: [{ id: 'four_arms', skillRollBonuses: { furtividade: 1 } }] }),
};
const characterClass = {
  id: 'class-archer', name: 'Arqueiro Espectral', category: 'Classes',
  ...metadata({
    type: 'class',
    usesWeapons: true,
    defense: { base: 0, terms: { constitution: .4, dexterity: .3, intelligence: .3 } },
    mana: { base: 15, terms: { intelligence: 1, dexterity: 2 } },
    attributeProgression: [{ from: 1, to: 3, perLevel: { dexterity: 1 } }],
    resources: [{ id: 'foco', name: 'Foco', maximum: { base: 2, terms: { intelligence: 1 } } }],
  }),
};
const sword = { id: 'item-sword', name: 'Espada curta', category: 'Equipamentos', ...metadata({ type: 'item', modifiers: [] }) };
const catalog = { entries: [race, characterClass, sword] };

function zenitti() {
  return {
    id: 'char_zenitti', name: 'Zenitti', playerName: 'Aleixo',
    raceId: race.id, raceVariant: 'four_arms', classId: characterClass.id,
    level: 1, visibility: 'public', attributes: {
      strength: 0, dexterity: 2, constitution: 4, intelligence: 4, charisma: 0, faith: 0,
    },
    permanentAttributeBonuses: {}, inventory: [], equipment: [],
    levelHistory: [{ level: 1, hpMethod: 'hybrid', die: 'd4', rollResult: 4, hpAdded: 38 }],
    maxHp: 38, currentHp: 38, maxMana: 999, currentMana: 27,
    resources: { humanity: 100, focoCurrent: 6 }, currency: {},
    classXp: 0, classXpTotal: 0, combatXp: 0, skillPoints: 0, classPoints: 0,
    spells: [], areaExperience: {}, combatContext: {},
  };
}

test('backend recalcula a ficha Zenitti com CA 14 e recursos oficiais', () => {
  const result = validateAndNormalizeCharacter(zenitti(), catalog);
  assert.equal(result.derivedStats.effectiveAttributes.dexterity, 4);
  assert.equal(result.derivedStats.armorClass, 14);
  assert.equal(result.maxMana, 27);
  assert.equal(result.resources.focoMax, 6);
});

test('backend migra referência antiga pelo nome mas rejeita item personalizado', () => {
  const legacy = zenitti();
  legacy.inventory = [{ id: 'owned', catalogId: 'trello-old', name: 'Espada curta', quantity: 1 }];
  assert.equal(validateAndNormalizeCharacter(legacy, catalog).inventory[0].catalogId, sword.id);

  const custom = zenitti();
  custom.inventory = [{ id: 'custom', catalogId: '', name: 'Item inventado', quantity: 1 }];
  assert.throws(
    () => validateAndNormalizeCharacter(custom, catalog),
    (error) => error.statusCode === 400 && error.details.errors.some((message) => message.includes('não oficial')),
  );
});

test('Elfo aplica Constituição, escolha versátil e exige uma conexão', () => {
  const elf = {
    id: 'race-elf', name: 'Elfo', category: 'Racas',
    ...metadata({
      type: 'race',
      attributeBonuses: { constitution: 1 },
      attributeChoice: { amount: 1, allowed: ['strength', 'dexterity', 'intelligence', 'charisma', 'faith'] },
      connection: { required: true, penaltyMasterDefined: true },
    }),
  };
  const value = {
    ...zenitti(),
    raceId: elf.id,
    raceVariant: '',
    raceAttributeChoice: 'dexterity',
    raceConnection: 'O arco herdado de sua família.',
  };
  const result = validateAndNormalizeCharacter(value, { entries: [elf, characterClass, sword] });
  assert.equal(result.derivedStats.effectiveAttributes.constitution, 5);
  assert.equal(result.derivedStats.effectiveAttributes.dexterity, 4);

  assert.throws(
    () => validateAndNormalizeCharacter({ ...value, raceAttributeChoice: '', raceConnection: '' }, { entries: [elf, characterClass, sword] }),
    (error) => error.statusCode === 400
      && error.details.errors.some((message) => message.includes('atributo versátil'))
      && error.details.errors.some((message) => message.includes('conexão racial')),
  );
});

test('técnicas de combate preservam recarga apenas durante o combate', () => {
  const technique = {
    id: 'technique_double_slash', name: 'Golpe duplo', damage: '2 ataques',
    description: 'Executa dois golpes como uma técnica.', training: 'Treino com espada.',
    costType: 'cooldown', cooldownTurns: 3, cooldownRemaining: 2,
    createdAt: new Date().toISOString(),
  };
  const active = validateAndNormalizeCharacter({
    ...zenitti(), techniques: [technique], combatContext: { inCombat: true },
  }, catalog);
  assert.equal(active.techniques[0].cooldownRemaining, 2);
  assert.equal(active.derivedStats.canLearnCombatTechniques, true);

  const resting = validateAndNormalizeCharacter({
    ...zenitti(), techniques: [technique], combatContext: { inCombat: false },
  }, catalog);
  assert.equal(resting.techniques[0].cooldownRemaining, 0);
  assert.equal(resting.techniques[0].usedThisCombat, false);
});
