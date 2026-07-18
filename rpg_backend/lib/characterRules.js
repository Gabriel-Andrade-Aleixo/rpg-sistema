import { normalizeText, normalizeVisibility } from './catalogStore.js';

const attributeIds = ['strength', 'dexterity', 'constitution', 'intelligence', 'charisma', 'faith'];
const resourceLimits = {
  humanity: [0, 100], divinity: [0, 100], corruption: [0, 100],
  deathSuccesses: [0, 3], deathFailures: [0, 3], dead: [0, 1], luck: [-100, 100],
};

export function validateAndNormalizeCharacter(raw, catalog) {
  const character = structuredClone(raw || {});
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
  const recordedHp = character.levelHistory.reduce((sum, entry) => sum + entry.hpAdded, 0);
  character.maxHp = boundedInteger(character.maxHp, 0, 100000, 'Vida máxima', errors);
  if (recordedHp > 0 && character.maxHp !== recordedHp) {
    character.maxHp = recordedHp;
  }
  character.currentHp = boundedInteger(character.currentHp, 0, character.maxHp, 'Vida atual', errors);

  const maximumMana = evaluateFormula(classRules.mana, character.attributes, attributeBonuses);
  if (classRules.mana) character.maxMana = maximumMana;
  else character.maxMana = boundedInteger(character.maxMana, 0, 100000, 'Mana máxima', errors);
  character.currentMana = boundedInteger(character.currentMana, 0, character.maxMana, 'Mana atual', errors);

  character.resources = normalizeResources(character.resources, classRules, character.attributes, attributeBonuses, errors);
  character.combatContext = normalizeCombatContext(character.combatContext);
  character.currency = normalizeCurrency(character.currency, errors);
  character.classXp = boundedInteger(character.classXp, 0, 1000000, 'XP de Classe', errors);
  character.classXpTotal = boundedInteger(character.classXpTotal, 0, 1000000, 'XP total de Classe', errors);
  character.combatXp = boundedInteger(character.combatXp, 0, 1000000, 'XP de combate', errors);
  character.skillPoints = boundedInteger(character.skillPoints, 0, 10000, 'Pontos de habilidade', errors);
  character.classPoints = boundedInteger(character.classPoints, 0, 10000, 'Pontos de classe', errors);
  character.visibility = normalizeVisibility(character.visibility || character.isPrivate);
  character.isPrivate = character.visibility === 'private';
  character.imageUrl = normalizeImageUrl(character.imageUrl, 'Imagem do personagem', errors);
  character.spells = Array.isArray(character.spells) ? character.spells.slice(0, 300) : [];
  character.areaExperience = normalizeExperienceMap(character.areaExperience, errors);

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
  return attributeIds.reduce((total, id) => {
    const value = Number(attributes?.[id] || 0);
    return total + Math.min(value, 5) + Math.max(0, value - 5) * 2;
  }, 0);
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
  addAttributes(result, character.permanentAttributeBonuses);
  for (const range of characterClass.attributeProgression || []) {
    const levels = Math.max(0, Math.min(character.level, Number(range.to || 0)) - Number(range.from || 1) + 1);
    for (const [id, value] of Object.entries(range.perLevel || {})) {
      if (attributeIds.includes(id)) result[id] += Number(value || 0) * levels;
    }
  }
  for (const item of character.equipment || []) {
    const rules = rulesOf(catalogById.get(item.catalogId));
    for (const modifier of rules.modifiers || []) {
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

function validateInventory(values, catalogById, label, errors) {
  if (!Array.isArray(values)) return [];
  return values.slice(0, 500).filter((item) => {
    const entry = catalogById.get(item?.catalogId)
      || [...catalogById.values()].find((candidate) => (
        ['itens', 'equipamentos'].includes(normalizeText(candidate.category))
        && normalizeText(candidate.name) === normalizeText(item?.name)
      ));
    const allowed = entry && ['itens', 'equipamentos'].includes(normalizeText(entry.category));
    if (!allowed) errors.push(`Existe um item não oficial no ${label}.`);
    if (allowed) item.catalogId = entry.id;
    return allowed;
  }).map((item) => ({
    ...item,
    quantity: boundedInteger(item.quantity ?? 1, 1, 9999, `Quantidade de ${item.name || 'item'}`, errors),
  }));
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

function normalizeResources(raw, classRules, attributes, bonuses, errors) {
  const result = { ...(raw || {}) };
  for (const [name, limits] of Object.entries(resourceLimits)) {
    result[name] = boundedInteger(result[name] ?? (name === 'humanity' ? 100 : 0), limits[0], limits[1], name, errors);
  }
  result.divinity = 100 - result.humanity;
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
    'coldEnvironment', 'withoutSunlight', 'blinded',
  ];
  return Object.fromEntries(allowed.map((name) => [name, raw?.[name] === true]));
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
  const effectiveAttributes = Object.fromEntries(attributeIds.map((id) => [id, character.attributes[id] + bonuses[id]]));
  const nearby = Boolean(character.combatContext?.enemyWithinTwoMeters);
  const defenseFormula = nearby && characterClass.conditionalDefense?.enemyWithinTwoMeters
    ? characterClass.conditionalDefense.enemyWithinTwoMeters
    : characterClass.defense;
  let defense = evaluateFormula(defenseFormula, character.attributes, bonuses);
  let armorClassBonus = Number(race.statBonuses?.armorClass || 0) + Number(variant?.statBonuses?.armorClass || 0);
  for (const item of character.equipment || []) {
    for (const modifier of rulesOf(catalogById.get(item.catalogId)).modifiers || []) {
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
  };
}

function evaluateFormula(formula, attributes, bonuses) {
  if (!formula || typeof formula !== 'object') return 0;
  const terms = formula.terms || {};
  return Math.max(0, Math.floor(Number(formula.base || 0) + Object.entries(terms).reduce(
    (sum, [id, weight]) => sum + (Number(attributes?.[id] || 0) + Number(bonuses?.[id] || 0)) * Number(weight || 0),
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
