import test from 'node:test';
import assert from 'node:assert/strict';

import {
  armorClassValue,
  attributeBreakdown,
  attributePointCost,
  classXpRequired,
  defenseValue,
  evaluateRuleFormula,
  parseClass,
  parseEquipmentModifiers,
  parseRace,
  parseSkill,
  recalculateCharacter,
  skillValue,
  spentInitialAttributePoints,
  validateCharacter,
} from '../lib/catalogEngine.js';
import { emptyCharacter } from '../lib/rpgData.js';
import { calculateClassSessionXp } from '../lib/experience.js';
import { changeHumanity, divineAccuracyBonus, humanityResistanceBonus, humanityStatus } from '../lib/humanity.js';

const attributes = {
  strength: 2,
  dexterity: 3,
  constitution: 4,
  intelligence: 5,
  charisma: 6,
  faith: 7,
};

const formula = (base, terms = {}) => ({ base, terms });
const hp = (initial, fixed, roll, hybrid) => ({
  initial,
  perLevel: { fixed, roll, hybrid },
});
const progression = (from, to, perLevel) => ({ from, to, perLevel });

const classRules = [
  {
    name: 'Bárbaro', id: 'barbarian', defense: formula(0, { dexterity: .5, constitution: .5 }),
    hp: hp(formula(20, { constitution: 3 }), formula(8, { constitution: 1 }), { die: 12, ...formula(0, { constitution: 1 }) }, { die: 6, ...formula(6, { constitution: 1 }) }),
    progression: [progression(1, 3, { strength: 1 }), progression(4, 10, { strength: 1, constitution: 1 })],
    expected: { defense: 3, initialHp: 32, fixedHp: 12, rollBonus: 4, hybridBonus: 10, level10: { strength: 10, constitution: 7 } },
  },
  {
    name: 'Mago', id: 'mage', defense: formula(0, { dexterity: .7, constitution: .3 }), hp: null,
    mana: formula(10, { intelligence: 3 }), progression: [progression(1, 10, { intelligence: 1 })],
    expected: { defense: 3, mana: 25, level10: { intelligence: 10 } },
  },
  {
    name: 'Arqueiro Espectral', id: 'spectral_archer', defense: formula(0, { constitution: .4, dexterity: .3, intelligence: .3 }),
    hp: hp(formula(10, { constitution: 2, dexterity: 2 }), formula(5, { constitution: 1 }), { die: 8, ...formula(0, { constitution: 1 }) }, { die: 4, ...formula(4, { constitution: 1 }) }),
    mana: formula(15, { intelligence: 1, dexterity: 2 }), progression: [progression(1, 3, { dexterity: 1 }), progression(4, 10, { dexterity: 1, intelligence: 1 })],
    expected: { defense: 4, initialHp: 24, fixedHp: 9, rollBonus: 4, hybridBonus: 8, mana: 26, level10: { dexterity: 10, intelligence: 7 } },
  },
  {
    name: 'Maestro Tático', id: 'tactical_maestro', defense: formula(0, { dexterity: .4, charisma: .4, intelligence: .2 }),
    hp: hp(formula(10, { constitution: 3, charisma: 2 }), formula(5, { constitution: 1 }), { die: 8, ...formula(0, { constitution: 1 }) }, { die: 4, ...formula(4, { constitution: 1 }) }),
    mana: formula(7, { intelligence: 1, charisma: 3 }), progression: [progression(1, 3, { charisma: 1 }), progression(4, 10, { charisma: 1, intelligence: 1 })],
    expected: { defense: 4, initialHp: 34, fixedHp: 9, rollBonus: 4, hybridBonus: 8, mana: 30, level10: { charisma: 10, intelligence: 7 } },
  },
  {
    name: 'Clérigo', id: 'cleric', defense: formula(0, { dexterity: .2, constitution: .4, faith: .4 }),
    hp: hp(formula(16, { constitution: 3 }), formula(7, { constitution: 1 }), { die: 10, ...formula(0, { constitution: 1 }) }, { die: 6, ...formula(5, { constitution: 1 }) }),
    mana: formula(10, { intelligence: 1, faith: 2 }), progression: [progression(1, 3, { faith: 1 }), progression(4, 10, { faith: 1, intelligence: 1 })],
    expected: { defense: 5, initialHp: 28, fixedHp: 11, rollBonus: 4, hybridBonus: 9, mana: 29, level10: { faith: 10, intelligence: 7 } },
  },
  {
    name: 'Paladino', id: 'paladin', defense: formula(0, { dexterity: .2, constitution: .4, faith: .4 }),
    hp: hp(formula(18, { constitution: 3 }), formula(8, { constitution: 1 }), { die: 12, ...formula(0, { constitution: 1 }) }, { die: 6, ...formula(6, { constitution: 1 }) }),
    progression: [progression(1, 3, { faith: 1 }), progression(4, 10, { faith: 1, constitution: 1 })],
    expected: { defense: 5, initialHp: 30, fixedHp: 12, rollBonus: 4, hybridBonus: 10, level10: { faith: 10, constitution: 7 } },
  },
  {
    name: 'Ladino', id: 'rogue', defense: formula(0, { constitution: .7, dexterity: .3 }),
    hp: hp(formula(12, { constitution: 3 }), formula(5, { constitution: 1 }), { die: 8, ...formula(0, { constitution: 1 }) }, { die: 4, ...formula(4, { constitution: 1 }) }),
    progression: [progression(1, 3, { dexterity: 1 }), progression(4, 10, { dexterity: 1, intelligence: 1 })],
    expected: { defense: 3, initialHp: 24, fixedHp: 9, rollBonus: 4, hybridBonus: 8, level10: { dexterity: 10, intelligence: 7 } },
  },
  {
    name: 'Ranger', id: 'ranger', defense: formula(0, { constitution: .6, dexterity: .3, intelligence: .1 }),
    hp: hp(formula(14, { constitution: 3 }), formula(6, { constitution: 1 }), { die: 10, ...formula(0, { constitution: 1 }) }, { die: 4, ...formula(5, { constitution: 1 }) }),
    progression: [progression(1, 3, { dexterity: 1 }), progression(4, 10, { dexterity: 1, intelligence: 1 })],
    expected: { defense: 3, initialHp: 26, fixedHp: 10, rollBonus: 4, hybridBonus: 9, level10: { dexterity: 10, intelligence: 7 } },
  },
  {
    name: 'Bardo', id: 'bard', defense: formula(0, { constitution: .5, charisma: .25, intelligence: .25 }),
    hp: hp(formula(12, { constitution: 3 }), formula(5, { constitution: 1 }), { die: 8, ...formula(0, { constitution: 1 }) }, { die: 4, ...formula(4, { constitution: 1 }) }),
    mana: formula(10, { charisma: 1, intelligence: .5 }), progression: [progression(1, 3, { charisma: 1 }), progression(4, 10, { charisma: 1, constitution: 1 })],
    expected: { defense: 4, initialHp: 24, fixedHp: 9, rollBonus: 4, hybridBonus: 8, mana: 18, level10: { charisma: 10, constitution: 7 } },
  },
];

function entryFor(rule) {
  return {
    id: rule.id,
    name: rule.name,
    category: 'Classes',
    description: `<!-- RPG_RULES_JSON_START -->\n${JSON.stringify({
      schemaVersion: 1,
      type: 'class',
      id: rule.id,
      defense: rule.defense,
      hp: rule.hp,
      mana: rule.mana,
      attributeProgression: rule.progression,
    })}\n<!-- RPG_RULES_JSON_END -->`,
  };
}

test('as nove classes seguem as fórmulas oficiais do documento', () => {
  const character = { ...emptyCharacter(), attributes, modifiers: [] };
  for (const rule of classRules) {
    const parsed = parseClass(entryFor(rule));
    assert.equal(evaluateRuleFormula(parsed.defenseFormula, character), rule.expected.defense, `${rule.name}: Defesa`);
    assert.equal(armorClassValue(character, entryFor(rule)), 10 + rule.expected.defense, `${rule.name}: CA`);
    assert.equal(evaluateRuleFormula(parsed.initialHpFormula, character), rule.expected.initialHp ?? null, `${rule.name}: HP inicial`);
    assert.equal(evaluateRuleFormula(parsed.hpPerLevelBaseFormula, character), rule.expected.fixedHp ?? null, `${rule.name}: HP fixo`);
    assert.equal(evaluateRuleFormula(parsed.hpPerLevelRollFormula, character), rule.expected.rollBonus ?? null, `${rule.name}: bônus da rolagem`);
    assert.equal(evaluateRuleFormula(parsed.hpPerLevelHybridFormula, character), rule.expected.hybridBonus ?? null, `${rule.name}: bônus híbrido`);
    assert.equal(evaluateRuleFormula(parsed.manaFormula, character), rule.expected.mana ?? null, `${rule.name}: Mana`);
  }
});

test('progressão de atributos acumula exatamente até o nível 10', () => {
  const race = { id: 'race', name: 'Raça neutra', category: 'Racas', description: '<!-- RPG_RULES_JSON_START -->\n{"type":"race"}\n<!-- RPG_RULES_JSON_END -->' };
  for (const rule of classRules) {
    const classEntry = entryFor(rule);
    const character = recalculateCharacter({ ...emptyCharacter(), raceId: race.id, classId: classEntry.id, level: 10 }, { entries: [race, classEntry] });
    for (const [attribute, expected] of Object.entries(rule.expected.level10)) {
      assert.equal(attributeBreakdown(character, attribute).total, expected, `${rule.name}: ${attribute}`);
    }
  }
});

test('perícias oficiais usam pesos e arredondamento para baixo', () => {
  const character = { ...emptyCharacter(), attributes, modifiers: [], skillBonuses: {} };
  const skills = [
    ['Acrobacia', 'Destreza 90%; Força 10%.', 2],
    ['Medicina', 'Inteligência 60%; Constituição 40%.', 4],
    ['Percepção', 'Inteligência 90%; Fé 10%.', 5],
    ['Intimidação', 'Força 60%; Constituição 30%; Carisma 10%.', 3],
    ['Religião', 'Fé 100%.', 7],
    ['Furtividade', 'Destreza 70%; Inteligência 30%.', 3],
  ];
  for (const [name, description, expected] of skills) {
    const entry = { id: name, name, description };
    assert.equal(skillValue(character, parseSkill(entry)), expected, name);
  }
});

test('Thri-kreen soma Destreza racial e mantém bônus das variantes nas rolagens', () => {
  const race = {
    id: 'thri-kreen', name: 'Thri-kreen',
    description: '<!-- RPG_RULES_JSON_START -->\n{"type":"race","attributeBonuses":{"dexterity":1},"variants":[{"id":"four_arms","name":"Quatro braços","skillRollBonuses":{"furtividade":1}},{"id":"wings","name":"Asas","attributeRollBonuses":{"dexterity":1}}]}\n<!-- RPG_RULES_JSON_END -->',
  };
  const fourArms = parseRace(race, 'four_arms');
  const wings = parseRace(race, 'wings');
  assert.equal(fourArms.modifiers.find((item) => item.targetType === 'skillRoll')?.value, 1);
  assert.equal(wings.modifiers.find((item) => item.targetType === 'attributeRoll')?.value, 1);
  assert.equal(wings.modifiers.find((item) => item.targetType === 'attribute')?.value, 1);

  const archer = entryFor(classRules.find((item) => item.id === 'spectral_archer'));
  const recalculated = recalculateCharacter({ ...emptyCharacter(), raceId: race.id, raceVariant: 'four_arms', classId: archer.id, level: 1 }, { entries: [race, archer] });
  assert.equal(attributeBreakdown(recalculated, 'dexterity').total, 2);
});

test('armadura equipada aumenta Defesa e CA e desequipada remove o bônus', () => {
  const race = { id: 'race', name: 'Raça', category: 'Racas', description: '<!-- RPG_RULES_JSON_START -->\n{"type":"race"}\n<!-- RPG_RULES_JSON_END -->' };
  const archer = entryFor(classRules.find((item) => item.id === 'spectral_archer'));
  const armor = { id: 'leather', name: 'Armadura de Couro', category: 'Itens', description: '<!-- RPG_RULES_JSON_START -->\n{"type":"item","modifiers":[{"targetType":"stat","targetId":"defense","value":1}]}\n<!-- RPG_RULES_JSON_END -->' };
  const base = { ...emptyCharacter(), raceId: race.id, classId: archer.id, attributes: { ...emptyCharacter().attributes, dexterity: 4, constitution: 3, intelligence: 2 } };
  const unequipped = recalculateCharacter(base, { entries: [race, archer, armor] });
  const equipped = recalculateCharacter({ ...base, equipment: [{ id: 'owned', catalogId: armor.id, name: armor.name }] }, { entries: [race, archer, armor] });
  assert.equal(parseEquipmentModifiers(armor)[0].targetId, 'defense');
  assert.equal(defenseValue(equipped, archer), defenseValue(unequipped, archer) + 1);
  assert.equal(armorClassValue(equipped, archer), armorClassValue(unequipped, archer) + 1);
});

test('item personalizado aplica bônus somente quando equipado', () => {
  const race = { id: 'race', name: 'Raça', category: 'Racas', description: '<!-- RPG_RULES_JSON_START -->\n{"type":"race"}\n<!-- RPG_RULES_JSON_END -->' };
  const archer = entryFor(classRules.find((item) => item.id === 'spectral_archer'));
  const custom = { id: 'custom', catalogId: '', name: 'Colete artesanal', type: 'Armadura', bonus: 'Defesa: +2' };
  const base = { ...emptyCharacter(), raceId: race.id, classId: archer.id };
  const stored = recalculateCharacter({ ...base, inventory: [custom] }, { entries: [race, archer] });
  const equipped = recalculateCharacter({ ...base, equipment: [custom] }, { entries: [race, archer] });
  assert.equal(defenseValue(equipped, archer), defenseValue(stored, archer) + 2);
});

test('limites, custos e validação de classe incompleta são aplicados', () => {
  assert.deepEqual([0, 4, 5, 9, 10].map(attributePointCost), [1, 1, 2, 2, 5]);
  assert.equal(spentInitialAttributePoints({ strength: 6, dexterity: 4 }), 10);
  assert.deepEqual([1, 4, 5, 9, 10].map(classXpRequired), [20, 20, 40, 40, 75]);
  assert.equal(attributeBreakdown({ attributes: { faith: 40 }, modifiers: [] }, 'faith').total, 20);

  const incompleteClass = { id: 'fighter', name: 'Guerreiro', category: 'Classes', description: 'Sem metadados.' };
  const race = { id: 'race', name: 'Raça', category: 'Racas', description: '' };
  const character = { ...emptyCharacter(), name: 'Teste', raceId: race.id, classId: incompleteClass.id, maxHp: 10 };
  const validation = validateCharacter(character, { entries: [race, incompleteClass] });
  assert.equal(validation.isValid, false);
  assert.ok(validation.errors.some((message) => message.includes('regras completas')));
});

test('XP de Classe detalha e limita todos os critérios da sessão', () => {
  const result = calculateClassSessionXp({ participation: 1, combat: 5, strategy: 1, creativity: 1, roleplay: 1, memorableMoment: 1, importantProblem: 2, storyProgress: 3, difficultDecision: 2, sessionObjective: 2, personalObjective: 2, highlight: 1 });
  assert.equal(result.total, 22);
  assert.equal(result.breakdown.combat, 5);
  assert.match(result.summary, /Participação na sessão \+1/);
  assert.equal(calculateClassSessionXp({ combat: 99, storyProgress: 1 }).total, 0);
});

test('Humanidade controla Divindade, estado e bônus oficiais', () => {
  let character = emptyCharacter();
  character = changeHumanity(character, -55, 'Milagre');
  assert.equal(character.resources.humanity, 45);
  assert.equal(character.resources.divinity, 55);
  assert.equal(humanityStatus(character).difficulty, 18);
  assert.equal(humanityResistanceBonus(character), 4);
  assert.equal(divineAccuracyBonus(character), 3);
  character = changeHumanity(character, 10, 'Intervenção do mestre');
  assert.equal(character.resources.humanity, 55);
  assert.equal(character.resources.divinity, 45);
  assert.equal(character.humanityHistory.length, 2);
});

test('CD divina respeita faixa inicial e regra específica da classe', () => {
  const full = emptyCharacter();
  assert.equal(humanityStatus(full, { name: 'Arqueiro Espectral' }).difficulty, null);
  const atEighty = { ...full, resources: { ...full.resources, humanity: 80, divinity: 20 } };
  assert.equal(humanityStatus(atEighty, { name: 'Arqueiro Espectral' }).difficulty, 17);
  assert.equal(humanityStatus(atEighty, { name: 'Clérigo' }).difficulty, 15);
  assert.equal(humanityStatus(atEighty, { name: 'Paladino' }).difficulty, 15);
});
