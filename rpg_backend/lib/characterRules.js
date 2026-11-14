import { normalizeText, normalizeVisibility } from './catalogStore.js';
import { EXPERIENCE_SYSTEM_VERSION, classXpRequired, migrateExperienceSystem } from './experienceRules.js';

const attributeIds = ['strength', 'dexterity', 'constitution', 'intelligence', 'charisma', 'faith'];
const resourceLimits = {
  humanity: [0, 100], divinity: [0, 100], corruption: [0, 100],
  deathSuccesses: [0, 3], deathFailures: [0, 3], dead: [0, 1], luck: [0, 3],
};

export function validateAndNormalizeCharacter(raw, catalog, { previous } = {}) {
  const character = migrateExperienceSystem(raw);
  const errors = [];
  const entries = Array.isArray(catalog?.entries) ? catalog.entries : [];
  const race = entries.find((entry) => entry.id === character.raceId);
  const characterClass = entries.find((entry) => entry.id === character.classId);
  const raceRules = rulesOf(race);
  const classRules = rulesOf(characterClass);

  if (!/^char_[a-z0-9_-]{3,100}$/i.test(String(character.id || ''))) {
    errors.push('O identificador da ficha é inválido.');
  }
  if (!String(character.name || '').trim()) errors.push('Informe o nome do personagem.');
  if (raceRules.type !== 'race') errors.push('Selecione uma raça com regras oficiais.');
  if (classRules.type !== 'class') errors.push('Selecione uma classe com regras oficiais.');

  character.level = boundedInteger(character.level, 1, 10, 'Nível', errors);
  character.attributes = normalizeAttributes(character.attributes, errors);
  if (attributePointCost(character.attributes) > 10) {
    errors.push('Os atributos base ultrapassam os 10 pontos disponíveis na criação.');
  }

  character.permanentAttributeBonuses = normalizeAttributeBonuses(
    character.permanentAttributeBonuses,
    'Bônus permanente',
    errors,
  );
  const variant = (raceRules.variants || []).find((item) => item.id === character.raceVariant) || null;
  if ((raceRules.variants || []).length && !variant) errors.push('Selecione uma variante válida para a raça.');
  character.raceAttributeChoice = normalizeRaceAttributeChoice(
    character.raceAttributeChoice,
    raceRules.attributeChoice,
    errors,
  );
  character.raceConnection = boundedText(character.raceConnection, 300);
  character.raceConnectionPenalty = boundedText(character.raceConnectionPenalty, 500);
  if (raceRules.connection?.required && !character.raceConnection) {
    errors.push('Descreva a conexão racial do Elfo.');
  }

  const catalogById = new Map(entries.map((entry) => [entry.id, entry]));
  character.inventory = validateInventory(character.inventory, catalogById, 'inventário', errors);
  character.equipment = validateInventory(character.equipment, catalogById, 'equipamento', errors);

  const attributeBonuses = collectAttributeBonuses(character, raceRules, variant, classRules, catalogById);
  for (const id of attributeIds) {
    if (character.attributes[id] + attributeBonuses[id] > 20) {
      errors.push(`${attributeLabel(id)} ultrapassa o limite absoluto de +20.`);
    }
  }

  character.levelHistory = validateLevelHistory(character.levelHistory, character.level, errors);
  if (previous !== undefined) {
    validateProgression(character, previous, classRules, attributeBonuses, errors);
  }
  const recordedHp = character.levelHistory.reduce((sum, entry) => sum + entry.hpAdded, 0);
  character.maxHp = boundedInteger(character.maxHp, 0, 100000, 'Vida máxima', errors);
  if (recordedHp > 0 && character.maxHp !== recordedHp) {
    character.maxHp = recordedHp;
  }
  character.currentHp = boundedInteger(character.currentHp, 0, character.maxHp, 'Vida atual', errors);

  const manaFormula = classRules.mana || { base: 5, terms: { intelligence: 1, constitution: .5 } };
  const maximumMana = evaluateFormula(manaFormula, character.attributes, attributeBonuses) + Math.max(0, character.level - 1);
  character.maxMana = maximumMana;
  character.currentMana = boundedInteger(character.currentMana, 0, character.maxMana, 'Mana atual', errors);

  character.combatContext = normalizeCombatContext(character.combatContext);
  character.resources = normalizeResources(character.resources, classRules, character.attributes, attributeBonuses, errors);
  character.techniques = validateCombatTechniques(character.techniques, classRules, character.combatContext, errors);
  character.currency = normalizeCurrency(character.currency, errors);
  character.classXp = boundedInteger(character.classXp, 0, 1000000, 'XP de Classe', errors);
  character.classXpTotal = boundedInteger(character.classXpTotal, 0, 1000000, 'XP total de Classe', errors);
  character.developmentXp = boundedInteger(character.developmentXp, 0, 1000000, 'XP de Desenvolvimento', errors);
  character.developmentPoints = boundedInteger(character.developmentPoints, 0, 1000000, 'Pontos de Desenvolvimento', errors);
  character.developmentAttributeBonuses = normalizeAttributeBonuses(character.developmentAttributeBonuses, 'Bônus de Desenvolvimento', errors);
  character.developmentSkillBonuses = normalizeExperienceMap(character.developmentSkillBonuses, errors);
  character.combatXp = 0;
  character.skillPoints = boundedInteger(character.skillPoints, 0, 10000, 'Pontos de habilidade', errors);
  character.classPoints = boundedInteger(character.classPoints, 0, 10000, 'Pontos de classe', errors);
  character.visibility = normalizeVisibility(character.visibility || character.isPrivate);
  character.isPrivate = character.visibility === 'private';
  character.imageUrl = normalizeImageUrl(character.imageUrl, 'Imagem do personagem', errors);
  character.spells = Array.isArray(character.spells) ? character.spells.slice(0, 300) : [];
  character.areaExperience = {};
  character.xpSystemVersion = EXPERIENCE_SYSTEM_VERSION;

  if (errors.length) throw validationError(errors);

  character.derivedStats = calculateDerivedStats(
    character,
    raceRules,
    variant,
    classRules,
    catalogById,
    attributeBonuses,
  );
  return character;
}

export function attributePointCost(attributes) {
  return attributeIds.reduce((total, id) => total + Number(attributes?.[id] || 0), 0);
}

function normalizeAttributes(raw, errors) {
  const result = {};
  for (const id of attributeIds) {
    result[id] = boundedInteger(raw?.[id], 0, 10, attributeLabel(id), errors);
  }
  return result;
}

function normalizeAttributeBonuses(raw, label, errors) {
  const result = {};
  for (const id of attributeIds) {
    const value = Number(raw?.[id] || 0);
    if (!Number.isInteger(value) || value < 0 || value > 20) {
      errors.push(`${label} de ${attributeLabel(id)} é inválido.`);
      result[id] = 0;
    } else {
      result[id] = value;
    }
  }
  return result;
}

function collectAttributeBonuses(character, race, variant, characterClass, catalogById) {
  const result = Object.fromEntries(attributeIds.map((id) => [id, 0]));
  addAttributes(result, race.attributeBonuses);
  addAttributes(result, variant?.attributeBonuses);
  if (character.raceAttributeChoice && race.attributeChoice) {
    const id = character.raceAttributeChoice;
    const firstLevelClassBonus = (characterClass.attributeProgression || []).reduce(
      (sum, range) => sum + (Number(range.from || 1) <= 1 && Number(range.to || 0) >= 1 ? Number(range.perLevel?.[id] || 0) : 0),
      0,
    );
    result[id] += attributePointBonus(
      Number(character.attributes?.[id] || 0) + result[id] + firstLevelClassBonus,
      Number(race.attributeChoice.amount || 0),
    );
  }
  addAttributes(result, character.permanentAttributeBonuses);
  for (const range of characterClass.attributeProgression || []) {
    const levels = Math.max(0, Math.min(character.level, Number(range.to || 0)) - Number(range.from || 1) + 1);
    for (const [id, value] of Object.entries(range.perLevel || {})) {
      if (attributeIds.includes(id)) result[id] += Number(value || 0) * levels;
    }
  }
  for (const item of character.equipment || []) {
    for (const modifier of itemModifiers(item, catalogById)) {
      if (modifier.targetType === 'attribute' && attributeIds.includes(modifier.targetId)) {
        result[modifier.targetId] += Number(modifier.value || 0);
      }
    }
  }
  return result;
}

function addAttributes(target, values) {
  for (const [id, value] of Object.entries(values || {})) {
    if (attributeIds.includes(id)) target[id] += Number(value || 0);
  }
}

function attributePointBonus(start, points) {
  let value = start;
  for (let index = 0; index < Math.max(0, Math.trunc(points)); index += 1) {
    value += value < 5 ? 1 : value < 10 ? .5 : .2;
  }
  return value - start;
}

function validateInventory(values, catalogById, label, errors) {
  if (!Array.isArray(values)) return [];
  const ids = new Set();
  return values.slice(0, 500).map((raw, index) => {
    const item = raw && typeof raw === 'object' ? raw : {};
    const entry = catalogById.get(item?.catalogId)
      || [...catalogById.values()].find((candidate) => (
        ['itens', 'equipamentos'].includes(normalizeText(candidate.category))
        && normalizeText(candidate.name) === normalizeText(item?.name)
      ));
    const official = entry && ['itens', 'equipamentos'].includes(normalizeText(entry.category));
    const id = boundedText(item.id, 140);
    const name = boundedText(official ? (item.name || entry.name) : item.name, 120);
    if (!id || ids.has(id)) errors.push(`O item ${index + 1} do ${label} possui identificador inválido ou repetido.`);
    ids.add(id);
    if (!name) errors.push(`Informe o nome do item ${index + 1} do ${label}.`);

    const bonus = boundedText(item.bonus, 160);
    if (!official && bonus) parseCustomItemModifiers({ ...item, id, name, bonus }, errors);

    return {
      id,
      catalogId: official ? entry.id : '',
      name,
      type: boundedText(official ? (item.type || entry.category) : (item.type || 'Item personalizado'), 80),
      description: boundedText(item.description, 2000),
      weight: boundedNumber(item.weight, 0, 100000, `Peso de ${name || 'item'}`, errors),
      quantity: boundedInteger(item.quantity ?? 1, 1, 9999, `Quantidade de ${name || 'item'}`, errors),
      bonus,
      notes: boundedText(item.notes, 500),
      imageUrl: normalizeImageUrl(item.imageUrl, `Imagem de ${name || 'item'}`, errors),
      requirements: boundedText(item.requirements, 500),
    };
  });
}

function itemModifiers(item, catalogById) {
  const entry = catalogById.get(item?.catalogId);
  return entry ? (rulesOf(entry).modifiers || []) : parseCustomItemModifiers(item);
}

function parseCustomItemModifiers(item, errors = null) {
  const bonus = String(item?.bonus || '').trim();
  if (!bonus) return [];
  const aliases = new Map([
    ['forca', ['attribute', 'strength']], ['strength', ['attribute', 'strength']],
    ['destreza', ['attribute', 'dexterity']], ['dexterity', ['attribute', 'dexterity']],
    ['constituicao', ['attribute', 'constitution']], ['constitution', ['attribute', 'constitution']],
    ['inteligencia', ['attribute', 'intelligence']], ['intelligence', ['attribute', 'intelligence']],
    ['carisma', ['attribute', 'charisma']], ['charisma', ['attribute', 'charisma']],
    ['fe', ['attribute', 'faith']], ['faith', ['attribute', 'faith']],
    ['defesa', ['stat', 'defense']], ['defense', ['stat', 'defense']],
    ['ca', ['stat', 'armorClass']], ['classe de armadura', ['stat', 'armorClass']],
    ['armor class', ['stat', 'armorClass']],
  ]);
  const result = [];
  for (const fragment of bonus.split(/[;\n]+/).map((value) => value.trim()).filter(Boolean).slice(0, 4)) {
    const match = fragment.match(/^(.+?)\s*[:=]\s*([+-]?\d+)$/);
    const target = match ? aliases.get(normalizeText(match[1])) : null;
    const value = match ? Number(match[2]) : 0;
    if (!target || !Number.isInteger(value) || value === 0 || Math.abs(value) > 20) {
      errors?.push(`O bônus de ${item?.name || 'item personalizado'} é inválido. Use, por exemplo, "Defesa: +2".`);
      continue;
    }
    result.push({
      targetType: target[0],
      targetId: target[1],
      value,
    });
  }
  return result;
}

function validateLevelHistory(values, level, errors) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const result = values.slice(0, 100).map((raw) => {
    const entryLevel = boundedInteger(raw?.level, 1, 10, 'Nível do histórico de vida', errors);
    if (entryLevel > level || seen.has(entryLevel)) errors.push(`O histórico de vida do nível ${entryLevel} é inconsistente.`);
    seen.add(entryLevel);
    const die = Number(String(raw?.die || '').replace(/\D/g, '')) || 0;
    const rollResult = raw?.rollResult === null || raw?.rollResult === undefined
      ? null
      : boundedInteger(raw.rollResult, 1, die || 100, 'Resultado do dado de vida', errors);
    if (['roll', 'hybrid'].includes(String(raw?.hpMethod || '')) && (!die || rollResult === null)) {
      errors.push(`O nível ${entryLevel} precisa registrar a rolagem de vida.`);
    }
    return {
      ...raw,
      level: entryLevel,
      hpAdded: boundedInteger(raw?.hpAdded, 1, 10000, 'Vida adicionada', errors),
      rollResult,
    };
  });
  if (result.length && !seen.has(1)) errors.push('O histórico de vida precisa começar no nível 1.');
  return result;
}

function validateProgression(character, previous, classRules, attributeBonuses, errors) {
  const oldLevel = previous ? Number(previous.level) : 0;
  if (previous && (character.level < oldLevel || character.level > oldLevel + 1)) {
    errors.push('O nível só pode avançar uma etapa por vez.');
  }
  if (!previous && character.level !== 1) {
    errors.push('Uma nova ficha deve começar no nível 1.');
  }

  const oldHistory = Array.isArray(previous?.levelHistory) ? previous.levelHistory : [];
  const previousMethod = String(previous?.hpProgressionMode || oldHistory.find((entry) => entry.level === 1)?.hpMethod || '')
    .replace(/^initial_/, '').replace(/^base$/, 'fixed');
  const currentMethod = String(character.hpProgressionMode || previousMethod || '')
    .replace(/^initial_/, '').replace(/^base$/, 'fixed');
  if (previousMethod && currentMethod !== previousMethod) {
    errors.push('O método de vida escolhido na criação não pode ser alterado.');
  }
  for (const oldRecord of oldHistory) {
    const currentRecord = character.levelHistory.find((record) => record.level === oldRecord.level);
    if (!currentRecord || !sameHealthRecord(currentRecord, oldRecord)) {
      errors.push(`O histórico de vida do nível ${oldRecord.level} não pode ser alterado.`);
    }
  }
  if (previous && character.level === oldLevel) {
    if (character.levelHistory.length !== oldHistory.length) {
      errors.push('O histórico de vida só pode crescer ao subir de nível.');
    }
    if (!oldHistory.length && Number(character.maxHp) > Number(previous.maxHp || 0)) {
      errors.push('A vida máxima não pode aumentar sem subir de nível.');
    }
    return;
  }

  const newLevel = character.level;
  const record = character.levelHistory.find((entry) => entry.level === newLevel);
  if (!record || character.levelHistory.length !== oldHistory.length + 1) {
    errors.push(`Registre a vida do nível ${newLevel} no histórico.`);
    return;
  }
  const method = String(record.hpMethod || '').replace(/^initial_/, '');
  if (!['fixed', 'roll', 'hybrid'].includes(method)) {
    errors.push(`O método de vida do nível ${newLevel} é inválido.`);
    return;
  }
  const selectedMethod = previousMethod || currentMethod || method;
  if (method !== selectedMethod) errors.push('O método de vida deve ser o escolhido na criação.');
  const hpRules = classRules.hp;
  const progression = hpRules?.perLevel?.[method];
  if (!hpRules?.initial || !progression) {
    errors.push('A classe não possui regras completas de vida para este método.');
    return;
  }
  const die = Number(progression.die || 0);
  if (method === 'fixed') {
    if (record.die || record.rollResult !== null) errors.push('Vida fixa não pode ter rolagem.');
  } else if (String(record.die || '') !== `d${die}` || !Number.isInteger(record.rollResult) || record.rollResult < 1 || record.rollResult > die) {
    errors.push(`A rolagem de vida deve ser um resultado válido de d${die}.`);
  }
  const expectedHp = (previous ? 0 : evaluateFormula(hpRules.initial, character.attributes, attributeBonuses))
    + evaluateFormula(progression, character.attributes, attributeBonuses)
    + (method === 'fixed' ? 0 : Number(record.rollResult || 0));
  if (record.hpAdded !== expectedHp) {
    errors.push(`A vida adicionada no nível ${newLevel} deve ser ${expectedHp}.`);
  }

  if (previous) {
    const cost = classXpRequired(oldLevel);
    const oldExperience = migrateExperienceSystem(previous);
    const gained = Number(character.classXpTotal || 0) - Number(oldExperience.classXpTotal || 0);
    if (record.xpSpent !== cost || gained < 0 || Number(character.classXp) !== Number(oldExperience.classXp || 0) + gained - cost) {
      errors.push(`Subir para o nível ${newLevel} exige consumir ${cost} XP de Classe.`);
    }
    if (gained > 0) {
      const previousIds = new Set((oldExperience.classXpHistory || []).map((entry) => entry.id));
      const recordedGain = (character.classXpHistory || [])
        .filter((entry) => !previousIds.has(entry.id))
        .reduce((total, entry) => total + Number(entry.amount || 0), 0);
      if (recordedGain !== gained) errors.push('O XP ganho ao subir de nível precisa constar no histórico de Classe.');
    }
    if (Number(character.maxHp) !== Number(previous.maxHp || 0) + record.hpAdded) {
      errors.push('A vida máxima deve somar apenas a vida do novo nível.');
    }
  } else if (Number(character.maxHp) !== record.hpAdded) {
    errors.push('A vida máxima inicial deve corresponder ao histórico do nível 1.');
  }
}

function sameHealthRecord(left, right) {
  return left.level === right.level
    && String(left.hpMethod || 'fixed').replace(/^initial_/, '').replace(/^base$/, 'fixed')
      === String(right.hpMethod || 'fixed').replace(/^initial_/, '').replace(/^base$/, 'fixed')
    && String(left.die || '') === String(right.die || '')
    && (left.rollResult ?? null) === (right.rollResult ?? null)
    && left.hpAdded === right.hpAdded
    && Number(left.xpSpent || 0) === Number(right.xpSpent || 0);
}

function normalizeResources(raw, classRules, attributes, bonuses, errors) {
  const result = { ...(raw || {}) };
  for (const [name, limits] of Object.entries(resourceLimits)) {
    result[name] = boundedInteger(result[name] ?? (name === 'humanity' ? 100 : 0), limits[0], limits[1], name, errors);
  }
  result.divinity = 100 - result.humanity;
  result.pendingLuckBonus = boundedInteger(result.pendingLuckBonus ?? 0, 0, 1, 'Bônus pendente de Sorte', errors);
  result.infusionsThisTurn = boundedInteger(result.infusionsThisTurn ?? 0, 0, 4, 'Infusões no turno', errors);
  result.spectralInfusionUsedThisTurn = result.spectralInfusionUsedThisTurn === true || result.spectralInfusionUsedThisTurn === 1 ? 1 : 0;
  if (classRules.id === 'swordsman') {
    result.swordsmanThreats = boundedInteger(result.swordsmanThreats ?? 0, 0, 20, 'Ameaças do Espadachim', errors);
    result.swordsmanConcentration = boundedInteger(result.swordsmanConcentration ?? Math.min(2, Math.max(0, result.swordsmanThreats - 1)), 0, 2, 'Concentração do Espadachim', errors);
    result.swordsmanDodgeUsed = boundedInteger(result.swordsmanDodgeUsed ?? 0, 0, 1, 'Esquiva no turno', errors);
    result.swordsmanOpeningUsed = boundedInteger(result.swordsmanOpeningUsed ?? 0, 0, 1, 'Ataque de Abertura no turno', errors);
  }
  for (const resource of classRules.resources || []) {
    if (!resource.id || !resource.maximum) continue;
    const maximum = evaluateFormula(resource.maximum, attributes, bonuses);
    result[`${resource.id}Max`] = maximum;
    result[`${resource.id}Current`] = boundedInteger(
      result[`${resource.id}Current`] ?? maximum,
      0,
      maximum,
      resource.name || resource.id,
      errors,
    );
  }
  return result;
}

function normalizeCombatContext(raw) {
  const allowed = [
    'enemyWithinTwoMeters', 'darkOrNight', 'hotEnvironment',
    'coldEnvironment', 'withoutSunlight', 'blinded', 'inCombat',
    'separatedFromConnection',
  ];
  return Object.fromEntries(allowed.map((name) => [name, raw?.[name] === true]));
}

function normalizeRaceAttributeChoice(raw, rule, errors) {
  if (!rule) return '';
  const choice = String(raw || '').trim();
  const allowed = Array.isArray(rule.allowed)
    ? rule.allowed.filter((id) => attributeIds.includes(id))
    : attributeIds;
  if (!allowed.includes(choice)) {
    errors.push('Escolha o atributo versátil concedido pela raça Elfo.');
    return '';
  }
  return choice;
}

function validateCombatTechniques(values, classRules, combatContext, errors) {
  if (!Array.isArray(values)) return [];
  const eligible = !classRules.mana || classRules.usesWeapons === true;
  if (values.length && !eligible) {
    errors.push('A classe precisa lutar sem Mana ou usar armas para aprender técnicas de combate.');
    return [];
  }
  const ids = new Set();
  const techniques = values.slice(0, 100).map((raw, index) => {
    const id = String(raw?.id || '').trim();
    const name = boundedText(raw?.name, 120);
    if (!/^technique_[a-z0-9_-]{3,120}$/i.test(id) || ids.has(id)) {
      errors.push(`A técnica ${index + 1} possui identificador inválido ou repetido.`);
    }
    ids.add(id);
    if (!name) errors.push(`Informe o nome da técnica ${index + 1}.`);
    const costType = ['none', 'once_per_combat', 'cooldown'].includes(raw?.costType)
      ? raw.costType
      : 'none';
    const cooldownTurns = costType === 'cooldown'
      ? boundedInteger(raw?.cooldownTurns, 1, 99, `Recarga de ${name || 'técnica'}`, errors)
      : 0;
    const learningState = ['unlearned', 'partial', 'mastered'].includes(raw?.learningState)
      ? raw.learningState
      : 'unlearned';
    const trainingSuccesses = boundedInteger(raw?.trainingSuccesses, 0, 3, `Sucessos de aprendizado de ${name || 'técnica'}`, errors);
    const executionSuccesses = boundedInteger(raw?.executionSuccesses, 0, 3, `Sucessos de execução de ${name || 'técnica'}`, errors);
    const masteryTrainingSuccesses = boundedInteger(raw?.masteryTrainingSuccesses, 0, 5, `Sucessos de domínio de ${name || 'técnica'}`, errors);
    return {
      id,
      name,
      description: boundedText(raw?.description, 1200),
      damage: boundedText(raw?.damage, 200),
      training: boundedText(raw?.training, 500),
      costType,
      cooldownTurns,
      learningDifficulty: boundedInteger(raw?.learningDifficulty ?? 15, 1, 30, `CD de aprendizado de ${name || 'técnica'}`, errors),
      executionDifficulty: boundedInteger(raw?.executionDifficulty ?? 10, 1, 29, `CD de execução de ${name || 'técnica'}`, errors),
      trainingSuccesses,
      executionSuccesses,
      masteryTrainingSuccesses,
      trainingHours: boundedInteger(raw?.trainingHours, 0, 100000, `Horas de treino de ${name || 'técnica'}`, errors),
      learningState: learningState === 'mastered'
        ? 'mastered'
        : (trainingSuccesses >= 3 ? (executionSuccesses >= 3 || masteryTrainingSuccesses >= 5 ? 'mastered' : 'partial') : 'unlearned'),
      cooldownRemaining: combatContext.inCombat && costType === 'cooldown'
        ? boundedInteger(raw?.cooldownRemaining, 0, cooldownTurns, `Recarga restante de ${name || 'técnica'}`, errors)
        : 0,
      usedThisCombat: combatContext.inCombat && costType === 'once_per_combat'
        ? raw?.usedThisCombat === true
        : false,
      createdAt: String(raw?.createdAt || new Date().toISOString()).slice(0, 40),
    };
  });
  return techniques;
}

function boundedText(value, maximum) {
  return String(value || '').trim().slice(0, maximum);
}

function normalizeCurrency(raw, errors) {
  const copperTotal = boundedInteger(raw?.copper, 0, 100000000, 'Moedas de cobre', errors)
    + boundedInteger(raw?.silver, 0, 100000000, 'Moedas de prata', errors) * 50
    + boundedInteger(raw?.gold, 0, 100000000, 'Moedas de ouro', errors) * 2500;
  return {
    gold: Math.floor(copperTotal / 2500),
    silver: Math.floor((copperTotal % 2500) / 50),
    copper: copperTotal % 50,
  };
}

function normalizeExperienceMap(raw, errors) {
  const result = {};
  for (const [name, value] of Object.entries(raw || {}).slice(0, 100)) {
    result[String(name).slice(0, 120)] = boundedInteger(value, 0, 1000000, `XP de ${name}`, errors);
  }
  return result;
}

function calculateDerivedStats(character, race, variant, characterClass, catalogById, bonuses) {
  const effectiveAttributes = Object.fromEntries(attributeIds.map((id) => [id, Math.floor(character.attributes[id] + bonuses[id])]));
  const nearby = Boolean(character.combatContext?.enemyWithinTwoMeters);
  const defenseFormula = nearby && characterClass.conditionalDefense?.enemyWithinTwoMeters
    ? characterClass.conditionalDefense.enemyWithinTwoMeters
    : characterClass.defense;
  let defense = evaluateFormula(defenseFormula, character.attributes, bonuses);
  let armorClassBonus = Number(race.statBonuses?.armorClass || 0) + Number(variant?.statBonuses?.armorClass || 0);
  for (const item of character.equipment || []) {
    for (const modifier of itemModifiers(item, catalogById)) {
      if (modifier.targetType !== 'stat') continue;
      if (modifier.targetId === 'defense') defense += Number(modifier.value || 0);
      if (['armorClass', 'armorclass'].includes(modifier.targetId)) armorClassBonus += Number(modifier.value || 0);
    }
  }
  const conditionalRollBonuses = (race.conditionalRollBonuses || [])
    .filter((rule) => rule.condition === 'dark_or_night' && character.combatContext.darkOrNight)
    .map((rule) => ({ targetType: rule.targetType, targetId: rule.targetId, value: Number(rule.value || 0) }));
  const movementModifier = (race.environmentEffects || []).reduce((total, rule) => {
    const active = (rule.environment === 'quente' && character.combatContext.hotEnvironment)
      || (rule.environment === 'gelo' && character.combatContext.coldEnvironment);
    return total + (active ? Number(rule.movementModifier || 0) : 0);
  }, 0);
  return {
    effectiveAttributes,
    defense,
    armorClass: 10 + defense + armorClassBonus,
    defenseMode: nearby && characterClass.conditionalDefense?.enemyWithinTwoMeters ? 'adaptive' : 'default',
    skillMinimums: race.skillMinimums || {},
    conditionalRollBonuses,
    damageReduction: race.damageReduction || [],
    healingCapPercent: Number(race.healingCapPercent || 100),
    movementModifier,
    humanityCostRequiresMasterAdjustment: Boolean(
      character.combatContext.withoutSunlight
      && (race.conditionalCosts || []).some((rule) => rule.resource === 'humanity' && rule.masterDefined),
    ),
    blindedDamagePerTurn: character.combatContext.blinded
      ? (race.statusEffects || []).find((rule) => rule.status === 'blinded')?.damagePerTurn || ''
      : '',
    separatedFromConnection: Boolean(
      race.connection?.required && character.combatContext.separatedFromConnection,
    ),
    connectionPenaltyMasterDefined: Boolean(race.connection?.penaltyMasterDefined),
    canLearnCombatTechniques: !characterClass.mana || characterClass.usesWeapons === true,
  };
}

function evaluateFormula(formula, attributes, bonuses) {
  if (!formula || typeof formula !== 'object') return 0;
  const terms = formula.terms || {};
  return Math.max(0, Math.floor(Number(formula.base || 0) + Object.entries(terms).reduce(
    (sum, [id, weight]) => sum + Math.floor(Number(attributes?.[id] || 0) + Number(bonuses?.[id] || 0)) * Number(weight || 0),
    0,
  )));
}

function rulesOf(entry) {
  if (entry?.metadata && Object.keys(entry.metadata).length) return entry.metadata;
  const match = String(entry?.description || '').match(/<!-- RPG_RULES_JSON_START -->([\s\S]*?)<!-- RPG_RULES_JSON_END -->/);
  try { return match ? JSON.parse(match[1].trim()) : {}; } catch { return {}; }
}

function normalizeImageUrl(value, label, errors) {
  const text = String(value || '').trim().slice(0, 2000);
  if (!text) return '';
  if (/^\/media\/[a-f0-9-]+$/i.test(text)) return text;
  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocol');
    return url.toString();
  } catch {
    errors.push(`${label} precisa usar uma URL HTTP segura ou uma imagem enviada ao sistema.`);
    return '';
  }
}

function boundedInteger(value, minimum, maximum, label, errors) {
  const number = Number(value ?? 0);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    errors.push(`${label} precisa estar entre ${minimum} e ${maximum}.`);
    return Math.max(minimum, Math.min(maximum, Number.isFinite(number) ? Math.round(number) : minimum));
  }
  return number;
}

function boundedNumber(value, minimum, maximum, label, errors) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    errors.push(`${label} precisa estar entre ${minimum} e ${maximum}.`);
    return Math.max(minimum, Math.min(maximum, Number.isFinite(number) ? number : minimum));
  }
  return number;
}

function validationError(errors) {
  const error = new Error('A ficha contém valores incompatíveis com as regras oficiais.');
  error.statusCode = 400;
  error.details = { code: 'CHARACTER_RULES_INVALID', errors: [...new Set(errors)].slice(0, 30) };
  return error;
}

function attributeLabel(id) {
  return {
    strength: 'Força', dexterity: 'Destreza', constitution: 'Constituição',
    intelligence: 'Inteligência', charisma: 'Carisma', faith: 'Fé',
  }[id] || id;
}
