import test from 'node:test';
import assert from 'node:assert/strict';

import { attributePointCost, validateAndNormalizeCharacter } from '../lib/characterRules.js';

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

test('Espadachim recebe HP, CA, Mana geral e Destreza da V0.4 no nível 1', () => {
  const swordsman = {
    id: 'class-swordsman', name: 'Espadachim', category: 'Classes',
    ...metadata({
      type: 'class', usesWeapons: true,
      defense: { base: 0, terms: { dexterity: .4, constitution: .4, intelligence: .2 } },
      hp: { initial: { base: 12, terms: { constitution: 3, dexterity: .5 } }, perLevel: { fixed: { base: 5, terms: { constitution: 1 } }, roll: { die: 8, base: 0, terms: { constitution: 1 } }, hybrid: { die: 4, base: 4, terms: { constitution: 1 } } } },
      attributeProgression: [{ from: 1, to: 3, perLevel: { dexterity: 1 } }, { from: 4, to: 10, perLevel: { dexterity: 1, constitution: 1 } }],
    }),
  };
  const value = zenitti();
  value.classId = swordsman.id;
  value.levelHistory = [{ level: 1, hpMethod: 'fixed', hpAdded: 26 }];
  value.maxHp = 26;
  value.currentHp = 26;
  value.currentMana = 11;
  const result = validateAndNormalizeCharacter(value, { entries: [race, swordsman] });
  assert.equal(result.derivedStats.effectiveAttributes.dexterity, 4);
  assert.equal(result.derivedStats.armorClass, 14);
  assert.equal(result.maxHp, 26);
  assert.equal(result.maxMana, 11);
  assert.equal(result.derivedStats.canLearnCombatTechniques, true);
});

test('backend migra referência antiga e aceita item personalizado seguro', () => {
  const legacy = zenitti();
  legacy.inventory = [{ id: 'owned', catalogId: 'trello-old', name: 'Espada curta', quantity: 1 }];
  assert.equal(validateAndNormalizeCharacter(legacy, catalog).inventory[0].catalogId, sword.id);

  const custom = zenitti();
  custom.equipment = [
    { id: 'item_custom', catalogId: '', name: 'Colete artesanal', type: 'Armadura', quantity: 1, bonus: 'Defesa: +2' },
    { id: 'item_ring', catalogId: '', name: 'Anel de destreza', type: 'Acessório', quantity: 1, bonus: 'Destreza: +1' },
  ];
  const result = validateAndNormalizeCharacter(custom, catalog);
  assert.equal(result.equipment[0].catalogId, '');
  assert.equal(result.derivedStats.effectiveAttributes.dexterity, 5);
  assert.equal(result.derivedStats.defense, 6);
  assert.equal(result.derivedStats.armorClass, 16);

  const invalid = zenitti();
  invalid.inventory = [{ id: 'item_invalid', catalogId: '', name: 'Item inválido', quantity: 1, bonus: 'Virar invencível' }];
  assert.throws(
    () => validateAndNormalizeCharacter(invalid, catalog),
    (error) => error.statusCode === 400 && error.details.errors.some((message) => message.includes('bônus')),
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

  const swordsman = {
    id: 'class-swordsman', name: 'Espadachim', category: 'Classes',
    ...metadata({
      type: 'class',
      defense: { base: 0, terms: { dexterity: .4, constitution: .4, intelligence: .2 } },
      attributeProgression: [{ from: 1, to: 3, perLevel: { dexterity: 1 } }],
    }),
  };
  const invested = validateAndNormalizeCharacter({
    ...value, classId: swordsman.id,
    attributes: { ...value.attributes, dexterity: 4, constitution: 2 },
    currentMana: 10,
  }, { entries: [elf, swordsman] });
  assert.equal(invested.derivedStats.effectiveAttributes.dexterity, 5);
  assert.equal(invested.maxMana, 10);

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

test('criação aceita dez pontos iniciais no mesmo atributo e exige vida oficial', () => {
  const rules = {
    ...characterClass,
    metadata: {
      ...characterClass.metadata,
      hp: {
        initial: { base: 10, terms: { constitution: 1 } },
        perLevel: {
          fixed: { base: 5, terms: { constitution: 1 } },
          roll: { die: 8, base: 0, terms: { constitution: 1 } },
          hybrid: { die: 4, base: 4, terms: { constitution: 1 } },
        },
      },
    },
  };
  const officialCatalog = { entries: [race, rules] };
  const creation = {
    ...zenitti(),
    attributes: { strength: 10, dexterity: 0, constitution: 0, intelligence: 0, charisma: 0, faith: 0 },
    hpProgressionMode: 'fixed',
    levelHistory: [{ level: 1, hpMethod: 'fixed', die: '', rollResult: null, hpAdded: 15 }],
    maxHp: 15, currentHp: 15, currentMana: 0, resources: { humanity: 100, focoCurrent: 2 },
  };
  assert.equal(attributePointCost(creation.attributes), 10);
  const created = validateAndNormalizeCharacter(creation, officialCatalog, { previous: null });
  assert.equal(created.maxHp, 15);

  const forgedLife = structuredClone(creation);
  forgedLife.levelHistory[0].hpAdded = 9999;
  assert.throws(() => validateAndNormalizeCharacter(forgedLife, officialCatalog, { previous: null }),
    (error) => error.details.errors.some((message) => /vida adicionada/i.test(message)));

  const forgedLevel = { ...creation, level: 10, classXp: 0 };
  assert.throws(() => validateAndNormalizeCharacter(forgedLevel, officialCatalog, { previous: null }),
    (error) => error.details.errors.some((message) => /nível 1/i.test(message)));

  const rolledCreation = validateAndNormalizeCharacter({
    ...creation, hpProgressionMode: 'roll', maxHp: 14, currentHp: 14,
    levelHistory: [{ level: 1, hpMethod: 'roll', die: 'd8', rollResult: 4, hpAdded: 14 }],
  }, officialCatalog, { previous: null });
  const funded = { ...rolledCreation, classXp: 10, classXpTotal: 10 };
  const next = {
    ...funded, level: 2, classXp: 0, maxHp: 18, currentHp: 18,
    levelHistory: [
      { level: 2, hpMethod: 'roll', die: 'd8', rollResult: 4, hpAdded: 4, xpSpent: 10 },
      ...funded.levelHistory,
    ],
  };
  const advanced = validateAndNormalizeCharacter(next, officialCatalog, { previous: funded });
  assert.equal(advanced.level, 2);
  assert.equal(advanced.classXp, 0);

  const changedHistory = structuredClone(funded);
  changedHistory.levelHistory[0].hpAdded += 1;
  assert.throws(() => validateAndNormalizeCharacter(changedHistory, officialCatalog, { previous: funded }),
    (error) => error.details.errors.some((message) => /histórico de vida.*alterado/i.test(message)));

  const legacy = structuredClone(created);
  delete legacy.levelHistory[0].die;
  delete legacy.levelHistory[0].xpSpent;
  const resaved = structuredClone(legacy);
  resaved.levelHistory[0].die = '';
  resaved.levelHistory[0].xpSpent = 0;
  assert.equal(validateAndNormalizeCharacter(resaved, officialCatalog, { previous: legacy }).maxHp, 15);

  const forgedDie = structuredClone(next);
  forgedDie.levelHistory[0].die = 'd100';
  forgedDie.levelHistory[0].rollResult = 100;
  forgedDie.levelHistory[0].hpAdded = 100;
  assert.throws(() => validateAndNormalizeCharacter(forgedDie, officialCatalog, { previous: funded }),
    (error) => error.details.errors.some((message) => /rolagem de vida/i.test(message)));

  const freeLevel = { ...next, classXp: 10 };
  assert.throws(() => validateAndNormalizeCharacter(freeLevel, officialCatalog, { previous: funded }),
    (error) => error.details.errors.some((message) => /consumir 10 XP/i.test(message)));
});
