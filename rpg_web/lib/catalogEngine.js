import { attributes, emptyCharacter, unique } from './rpgData.js';

const legacyNames = {
  human: 'humano', elf: 'elfo', dwarf: 'anao', thri_kreen: 'thri-kreen', vedalken: 'vedalken',
  lizardfolk: 'lizardfolk', genasi: 'genasi', goliath: 'goliath', orc: 'orc', minotaur: 'minotauro',
  bugbear: 'bugbear', firbolg: 'firbolg', barbarian: 'barbaro', mage: 'mago',
  spectral_archer: 'arqueiro espectral', tactical_maestro: 'maestro tatico', cleric: 'clerigo',
  paladin: 'paladino', rogue: 'ladino', ranger: 'ranger', bard: 'bardo',
  fighter: 'lutador',
};

const attributeAliases = {
  strength: ['força', 'forca'], dexterity: ['destreza'], constitution: ['constituição', 'constituicao'],
  intelligence: ['inteligência', 'inteligencia'], charisma: ['carisma'], faith: ['fé', 'fe'],
};

export function normalize(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function entriesFor(catalog, category) {
  const target = normalize(category);
  return (catalog?.entries || []).filter((entry) => normalize(entry.category).includes(target));
}

export function catalogGroups(catalog) {
  const races = entriesFor(catalog, 'racas');
  const classes = entriesFor(catalog, 'classes');
  return {
    races,
    playableRaces: races.filter((entry) => parseRuleMetadata(entry)?.type === 'race'),
    classes,
    playableClasses: classes.filter((entry) => parseRuleMetadata(entry)?.type === 'class'),
    items: [...entriesFor(catalog, 'itens'), ...entriesFor(catalog, 'equipamentos')],
    spells: entriesFor(catalog, 'magias'),
    abilities: entriesFor(catalog, 'habilidades'),
    proficiencies: entriesFor(catalog, 'proficiencias'),
    skills: entriesFor(catalog, 'pericias'),
    creatures: entriesFor(catalog, 'criaturas'),
  };
}

export function findEntry(catalog, id) {
  return (catalog?.entries || []).find((entry) => entry.id === id) || null;
}

export function migrateCharacter(raw, catalog) {
  const base = emptyCharacter();
  const character = {
    ...base,
    ...raw,
    attributes: { ...base.attributes, ...(raw.attributes || {}) },
    resources: { ...base.resources, ...(raw.resources || {}) },
    currency: { ...base.currency, ...(raw.currency || {}) },
    inventory: raw.inventory || [],
    equipment: raw.equipment || [],
    notes: raw.notes || [],
    proficiencies: raw.proficiencies || [],
    abilities: raw.abilities || [],
    spells: (raw.spells || []).map((spell) => ({
      ...spell,
      catalogId: spell.catalogId || '',
      topic: spell.topic || spell.type || 'Sem tópico',
      range: spell.range || '',
      damage: spell.damage || '',
      imageUrl: spell.imageUrl || '',
    })),
    manualProficiencies: raw.manualProficiencies || [],
    manualAbilities: raw.manualAbilities || [],
    permanentAttributeBonuses: raw.permanentAttributeBonuses || {},
    classXp: Number(raw.classXp || 0),
    classXpTotal: Number(raw.classXpTotal || 0),
    classXpHistory: raw.classXpHistory || [],
    areaExperience: Object.fromEntries(Object.entries(raw.areaExperience || {}).map(([name, value]) => [name, Number(typeof value === 'object' ? value?.xp : value) || 0])),
    combatXp: Number(raw.combatXp || 0),
    experienceHistory: raw.experienceHistory || [],
    humanityHistory: raw.humanityHistory || [],
    corruptionHistory: raw.corruptionHistory || [],
    modifiers: raw.modifiers || [],
    rollHistory: raw.rollHistory || [],
    levelHistory: raw.levelHistory || [],
  };
  character.raceId = resolveLegacyId(character.raceId, catalogGroups(catalog).races);
  character.classId = resolveLegacyId(character.classId, catalogGroups(catalog).classes);
  character.hpProgressionMode = raw.hpProgressionMode || 'fixed';
  character.maxHp = Number(raw.maxHp ?? raw.resources?.hpMax ?? 0);
  character.currentHp = Number(raw.currentHp ?? raw.resources?.hpCurrent ?? character.maxHp);
  character.maxMana = Number(raw.maxMana ?? raw.resources?.manaMax ?? 0);
  character.currentMana = Number(raw.currentMana ?? raw.resources?.manaCurrent ?? character.maxMana);
  return recalculateCharacter(character, catalog);
}

function resolveLegacyId(id, entries) {
  if (entries.some((entry) => entry.id === id)) return id;
  const wanted = legacyNames[id] || normalize(id);
  return entries.find((entry) => normalize(entry.name) === wanted)?.id || id || '';
}

export function parseRace(entry, variantId = '') {
  const metadata = parseRuleMetadata(entry);
  if (metadata?.type === 'race') {
    const variant = (metadata.variants || []).find((item) => item.id === variantId) || null;
    const modifiers = [
      ...metadataModifiers(entry, 'race', 'attribute', metadata.attributeBonuses),
      ...metadataModifiers(entry, 'race_variant', 'attribute', variant?.attributeBonuses),
      ...metadataModifiers(entry, 'race', 'stat', metadata.statBonuses),
      ...metadataModifiers(entry, 'race', 'skill', metadata.skillBonuses),
      ...metadataModifiers(entry, 'race_variant', 'skill', variant?.skillBonuses),
      ...metadataModifiers(entry, 'race_variant', 'skillRoll', variant?.skillRollBonuses),
      ...metadataModifiers(entry, 'race_variant', 'attributeRoll', variant?.attributeRollBonuses),
    ];
    return {
      entry,
      modifiers,
      proficiencies: metadata.proficiencies || [],
      abilities: [...(metadata.abilities || []), ...(variant?.abilities || [])],
      traits: [...(metadata.traits || []), ...(variant?.traits || [])],
      variants: metadata.variants || [],
      selectedVariant: variant,
    };
  }
  const lines = linesOf(entry?.description);
  return {
    entry,
    modifiers: parseAttributeModifiers(entry, 'race'),
    proficiencies: lines.filter((line) => normalize(line).includes('profici')),
    abilities: lines.filter((line) => normalize(line).includes('habilidad')),
    traits: lines.filter((line) => /resist[eê]ncia|deslocamento|vis[aã]o|tamanho/i.test(line)), variants: [], selectedVariant: null,
  };
}

export function parseClass(entry) {
  const metadata = parseRuleMetadata(entry);
  if (metadata?.type === 'class') {
    const hpRules = metadata.hp || null;
    return {
      entry,
      hitDie: hpRules?.perLevel?.roll?.die ?? null,
      baseHp: hpRules?.initial?.base ?? null,
      hpPerLevelBase: hpRules?.perLevel?.fixed?.base ?? null,
      initialHpFormula: metadataFormula(hpRules?.initial),
      hpPerLevelBaseFormula: metadataFormula(hpRules?.perLevel?.fixed),
      hpPerLevelRollFormula: metadataFormula(hpRules?.perLevel?.roll),
      hpPerLevelHybridFormula: metadataFormula(hpRules?.perLevel?.hybrid),
      hybridDie: hpRules?.perLevel?.hybrid?.die ?? null,
      skillPointsPerLevel: metadata.skillPointsPerLevel ?? null,
      classPointsPerLevel: metadata.classPointsPerLevel ?? null,
      proficiencies: metadata.proficiencies || [],
      resources: (metadata.resources || []).map((item) => item.name),
      manaFormula: metadataFormula(metadata.mana),
      resourceFormulas: (metadata.resources || []).filter((item) => item.maximum).map((item) => ({ id: item.id, name: item.name, formula: metadataFormula(item.maximum) })),
      unlocks: parseUnlocks(linesOf(entry.description)),
      modifiers: [],
      defenseFormula: metadataFormula(metadata.defense),
      attributeProgression: metadata.attributeProgression || [],
      allowedCombatXpAttributes: metadata.allowedCombatXpAttributes || [],
      metadata,
    };
  }
  const text = entry?.description || '';
  const lines = linesOf(text);
  return {
    entry,
    hitDie: firstNumber(text, [
      /dado\s+de\s+vida[^d\d]*d(4|6|8|10|12|20)/i,
      /vida[^\n]{0,60}?1d(4|6|8|10|12|20)/i,
      /rolagem\s*:\s*1d(4|6|8|10|12|20)/i,
    ]),
    baseHp: firstNumber(text, [/(?:vida|hp)\s+(?:inicial|base)\D{0,15}(\d+)/i]),
    hpPerLevelBase: firstNumber(text, [/(?:fixo|m[eé]dia)\s*:\s*(\d+)/i]),
    initialHpFormula: parseFormulaAfterHeader(lines, /(?:hp|vida)\s+inicial/i),
    hpPerLevelBaseFormula: parseFormulaAfterHeader(lines, /(?:valor\s+)?(?:fixo|m[eé]dia)\s*:/i),
    hpPerLevelRollFormula: parseFormulaAfterHeader(lines, /rolagem\s*:/i, true),
    skillPointsPerLevel: firstNumber(text, [
      /(\d+)\s+pontos?\s+de\s+habilidade\s+(?:por|a\s+cada)\s+n[ií]vel/i,
      /pontos?\s+de\s+habilidade\s+(?:por|a\s+cada)\s+n[ií]vel\D{0,10}(\d+)/i,
    ]),
    classPointsPerLevel: firstNumber(text, [
      /(\d+)\s+pontos?\s+(?:da|de)\s+classe\s+(?:por|a\s+cada)\s+n[ií]vel/i,
      /pontos?\s+(?:da|de)\s+classe\s+(?:por|a\s+cada)\s+n[ií]vel\D{0,10}(\d+)/i,
    ]),
    proficiencies: lines.filter((line) => normalize(line).includes('profici')),
    resources: lines.filter((line) => /\b(mana|energia|f[uú]ria|foco|compasso|cad[eê]ncia|divindade|humanidade)\b/i.test(line)).slice(0, 12),
    manaFormula: parseNamedFormula(lines, 'mana'),
    resourceFormulas: ['foco', 'energia', 'furia', 'compasso', 'cadencia'].flatMap((name) => {
      const formula = parseNamedFormula(lines, name);
      return formula ? [{ id: normalize(name), name, formula }] : [];
    }),
    unlocks: parseUnlocks(lines),
    modifiers: parseExplicitClassModifiers(entry), defenseFormula: null, attributeProgression: [], allowedCombatXpAttributes: [], metadata: null,
  };
}

export function parseRuleMetadata(entry) {
  const match = String(entry?.description || '').match(/<!-- RPG_RULES_JSON_START -->([\s\S]*?)<!-- RPG_RULES_JSON_END -->/);
  if (!match) return null;
  try { return JSON.parse(match[1].trim()); } catch { return null; }
}

export function parseCatalogSpell(entry) {
  const metadata = parseRuleMetadata(entry) || {};
  const costs = metadata.costs || {};
  const topic = metadata.topic || (entry?.labels || []).map((label) => label.name).find((name) => normalize(name).startsWith('grau ')) || 'Sem tópico';
  const schoolNames = { arcana: 'Arcana', divina: 'Divina', espectral: 'Espectral', elemental: 'Elemental', demoniaca: 'Demoníaca', natural: 'Natural', outra: 'Outra' };
  return {
    catalogId: entry?.id || '',
    name: entry?.name || '',
    type: schoolNames[normalize(metadata.school)] || 'Comum',
    topic,
    description: catalogSpellSummary(entry),
    manaCost: Number(costs.mana || 0),
    focusCost: Number(costs.focus || 0),
    humanityCost: Number(costs.humanity || 0),
    range: metadata.range || '',
    damage: metadata.damage || '',
    imageUrl: entry?.imageUrl || '',
    className: metadata.className || '',
    actionType: metadata.actionType || '',
    actionId: metadata.actionId || '',
  };
}

function catalogSpellSummary(entry) {
  return displayDescription(entry).split(/\r?\n/).filter((line) => line && !/^# /.test(line) && !/^\*\*(Tipo|Nível|Tópico|Classe|Custo|Alcance|Dano\/Efeito):\*\*/i.test(line)).join('\n').trim();
}

export function displayDescription(entry) {
  return String(entry?.description || '')
    .replace(/\n*---\nMetadados usados automaticamente pelos aplicativos\.[\s\S]*$/i, '')
    .replace(/<!-- RPG_RULES_JSON_START -->[\s\S]*?<!-- RPG_RULES_JSON_END -->/g, '')
    .trim();
}

function metadataFormula(formula) {
  if (!formula) return null;
  return { label: formula.label || '', base: Number(formula.base || 0), terms: Object.entries(formula.terms || {}).map(([attribute, weight]) => ({ attribute, weight: Number(weight) })) };
}

function metadataModifiers(entry, sourceType, targetType, values = {}) {
  return Object.entries(values || {}).map(([targetId, value]) => modifier(entry, sourceType, targetType, normalize(targetId), Number(value)));
}

function parseExplicitClassModifiers(entry) {
  const explicitLines = linesOf(entry?.description).filter((line) => /b[oô]nus\s+de\s+classe/i.test(line));
  if (!explicitLines.length) return [];
  return parseAttributeModifiers({ ...entry, description: explicitLines.join('\n') }, 'class');
}

export function parseEquipmentModifiers(entry) {
  const metadata = parseRuleMetadata(entry);
  if (metadata?.type === 'item' && Array.isArray(metadata.modifiers)) {
    return metadata.modifiers
      .filter((item) => item?.targetId && Number(item.value))
      .map((item) => ({ id: `${entry.id}_${item.targetId}`, sourceId: entry.id, sourceName: entry.name, sourceType: 'equipment', targetType: item.targetType || 'stat', targetId: item.targetId, value: Number(item.value), operation: 'add', description: 'Bônus estruturado do catálogo oficial.' }));
  }
  const modifiers = parseAttributeModifiers(entry, 'equipment');
  const targets = { defense: ['defesa'], armorClass: ['ca', 'classe de armadura'], attack: ['ataque', 'acerto'], damage: ['dano'], health: ['vida', 'hp'], mana: ['mana'] };
  Object.entries(targets).forEach(([targetId, aliases]) => {
    for (const alias of aliases) {
      const value = numberMatch(entry?.description, new RegExp(`${escapeRegExp(alias)}\\s*[:=]?\\s*([+-]\\d+)`, 'i'));
      if (value === null) continue;
      modifiers.push(modifier(entry, 'equipment', 'stat', targetId, value));
      break;
    }
  });
  return modifiers;
}

export function parseSkill(entry) {
  const terms = [];
  Object.entries(attributeAliases).forEach(([attribute, aliases]) => {
    for (const alias of aliases) {
      const match = String(entry?.description || '').match(new RegExp(`${escapeRegExp(alias)}\\s*[(:]?\\s*(\\d+)\\s*%`, 'i'));
      if (!match) continue;
      terms.push({ attribute, weight: Number(match[1]) / 100 });
      break;
    }
  });
  return { entry, terms };
}

function parseAttributeModifiers(entry, sourceType) {
  const result = [];
  Object.entries(attributeAliases).forEach(([targetId, aliases]) => {
    for (const alias of aliases) {
      const escaped = escapeRegExp(alias);
      const value = firstNumber(entry?.description || '', [new RegExp(`${escaped}\\s*[:=]?\\s*([+-]\\d+)`, 'i'), new RegExp(`([+-]\\d+)\\s+(?:em\\s+)?${escaped}`, 'i')]);
      if (value === null) continue;
      result.push(modifier(entry, sourceType, 'attribute', targetId, value));
      break;
    }
  });
  return result;
}

function modifier(entry, sourceType, targetType, targetId, value) {
  return { id: `${entry?.id}_${targetId}`, sourceId: entry?.id || '', sourceName: entry?.name || '', sourceType, targetType, targetId, value, operation: 'add', description: 'Regra extraída do catálogo oficial.' };
}

export function recalculateCharacter(character, catalog) {
  const raceEntry = findEntry(catalog, character.raceId);
  const classEntry = findEntry(catalog, character.classId);
  if (!raceEntry || !classEntry) return character;
  const race = parseRace(raceEntry, character.raceVariant);
  const characterClass = parseClass(classEntry);
  const equipmentModifiers = (character.equipment || []).flatMap((item) => {
    const entry = findEntry(catalog, item.catalogId);
    return parseEquipmentModifiers(entry || { id: item.id, name: item.name, description: `${item.description || ''}\n${item.bonus || ''}`, category: item.type || 'Item personalizado' });
  });
  const permanentModifiers = Object.entries(character.permanentAttributeBonuses || {})
    .filter(([, value]) => Number(value) !== 0)
    .map(([targetId, value]) => ({ id: `permanent_${targetId}`, sourceId: character.id, sourceName: 'Progressão permanente', sourceType: 'experience', targetType: 'attribute', targetId, value: Number(value), operation: 'add', description: 'Bônus permanente obtido por conversão de XP.' }));
  const progressionModifiers = classProgressionModifiers(classEntry, characterClass, character.level);
  const modifiers = [...race.modifiers, ...characterClass.modifiers, ...progressionModifiers, ...permanentModifiers, ...equipmentModifiers];
  const nextResources = { ...(character.resources || {}) };
  for (const resource of characterClass.resourceFormulas || []) {
    const maximum = evaluateFormula(resource.formula, character.attributes, modifiers);
    const maxKey = `${resource.id}Max`, currentKey = `${resource.id}Current`;
    nextResources[currentKey] = nextResourceCurrent(nextResources[currentKey], nextResources[maxKey], maximum);
    nextResources[maxKey] = maximum;
  }
  const maximumMana = characterClass.manaFormula ? evaluateFormula(characterClass.manaFormula, character.attributes, modifiers) : Number(character.maxMana || 0);
  const currentMana = nextResourceCurrent(character.currentMana, character.maxMana, maximumMana);
  return {
    ...character,
    modifiers,
    proficiencies: unique([...race.proficiencies, ...characterClass.proficiencies, ...(character.manualProficiencies || [])]),
    abilities: unique([...race.abilities, ...characterClass.unlocks.filter((item) => item.level <= character.level).map((item) => item.name), ...(character.manualAbilities || [])]),
    currentHp: clamp(character.currentHp, 0, character.maxHp),
    maxMana: maximumMana,
    currentMana,
    resources: nextResources,
  };
}

function classProgressionModifiers(entry, characterClass, level) {
  const result = [];
  for (const range of characterClass.attributeProgression || []) {
    const attained = Math.max(0, Math.min(Number(level || 1), Number(range.to || 0)) - Number(range.from || 1) + 1);
    if (!attained) continue;
    for (const [targetId, value] of Object.entries(range.perLevel || {})) {
      result.push(modifier(entry, 'class_level', 'attribute', targetId, Number(value) * attained));
    }
  }
  return result;
}

function nextResourceCurrent(current, oldMaximum, newMaximum) {
  const oldMax = Number(oldMaximum || 0), value = Number(current || 0);
  if (oldMax !== newMaximum && (oldMax === 0 || value === oldMax)) return newMaximum;
  return clamp(value, 0, newMaximum);
}

function evaluateFormula(formula, baseAttributes, modifiers) {
  return Math.max(0, Math.floor(formula.base + formula.terms.reduce((sum, term) => {
    const breakdown = { base: Number(baseAttributes?.[term.attribute] || 0), bonus: modifiers.filter((item) => item.targetType === 'attribute' && item.targetId === term.attribute).reduce((value, item) => value + Number(item.value || 0), 0) };
    return sum + (breakdown.base + breakdown.bonus) * term.weight;
  }, 0)));
}

export function evaluateRuleFormula(formula, character) {
  if (!formula) return null;
  return evaluateFormula(formula, character.attributes || {}, character.modifiers || []);
}

export function formulaRollModifiers(formula, character, sourceName) {
  if (!formula) return [];
  const result = [];
  if (formula.base) result.push({ id: `${sourceName}_base`, sourceId: character.id, sourceName: `${sourceName} base`, sourceType: 'class', targetType: 'roll', targetId: 'health', value: formula.base, operation: 'add' });
  for (const term of formula.terms) {
    const breakdown = attributeBreakdown(character, term.attribute);
    result.push({ id: `${sourceName}_${term.attribute}`, sourceId: character.id, sourceName: attributeLabel(term.attribute), sourceType: 'attribute', targetType: 'roll', targetId: 'health', value: Math.floor(breakdown.total * term.weight), operation: 'add' });
  }
  return result;
}

function parseFormulaAfterHeader(lines, headerPattern, removeDice = false) {
  const index = lines.findIndex((line) => headerPattern.test(line));
  if (index < 0) return null;
  let formulaLine = lines[index];
  const separator = formulaLine.indexOf(':');
  if (separator >= 0 && /\d/.test(formulaLine.slice(separator + 1))) formulaLine = formulaLine.slice(separator + 1);
  else if (!/\d/.test(formulaLine)) formulaLine = lines[index + 1] || '';
  return parseLinearFormulaLine(formulaLine, removeDice);
}

function parseLinearFormulaLine(rawLine, removeDice = false) {
  const line = removeDice ? rawLine.replace(/\d+d(?:4|6|8|10|12|20|100)/gi, '') : rawLine;
  const firstNumeric = line.match(/(?:^|[=:+\s])(\d+)(?=\s*(?:\+|$))/);
  const base = Number(firstNumeric?.[1] || 0);
  const terms = [];
  Object.entries(attributeAliases).forEach(([attribute, aliases]) => {
    const alias = aliases.find((value) => normalize(line).includes(normalize(value)));
    if (!alias) return;
    const escaped = escapeRegExp(alias);
    const multiply = line.match(new RegExp(`${escaped}\\s*[×x*]\\s*(\\d+)`, 'i'));
    const divide = line.match(new RegExp(`${escaped}\\s*[÷/]\\s*(\\d+)`, 'i'));
    terms.push({ attribute, weight: multiply ? Number(multiply[1]) : divide ? 1 / Number(divide[1]) : 1 });
  });
  return base || terms.length ? { label: rawLine, base, terms } : null;
}

function parseNamedFormula(lines, resourceName) {
  const wanted = normalize(resourceName);
  let formulaLine = lines.find((line) => normalize(line).startsWith(`${wanted} =`));
  if (!formulaLine) {
    const headerIndex = lines.findIndex((line) => normalize(line).includes(`${wanted} maxima`) || normalize(line).includes(`${wanted} maximo`));
    if (headerIndex >= 0) formulaLine = lines[headerIndex + 1];
  }
  if (!formulaLine || !/\d/.test(formulaLine)) return null;
  const base = Number(formulaLine.match(/\d+/)?.[0] || 0);
  const terms = [];
  Object.entries(attributeAliases).forEach(([attribute, aliases]) => {
    const alias = aliases.find((value) => normalize(formulaLine).includes(normalize(value)));
    if (!alias) return;
    const escaped = escapeRegExp(alias);
    const multiply = formulaLine.match(new RegExp(`${escaped}\\s*[×x*]\\s*(\\d+)`, 'i'));
    const divide = formulaLine.match(new RegExp(`${escaped}\\s*[÷/]\\s*(\\d+)`, 'i'));
    const weight = multiply ? Number(multiply[1]) : divide ? 1 / Number(divide[1]) : 1;
    terms.push({ attribute, weight });
  });
  return terms.length ? { label: formulaLine, base, terms } : null;
}

export function attributeBreakdown(character, attributeId) {
  const base = Number(character.attributes?.[attributeId]) || 0;
  const modifiers = (character.modifiers || []).filter((item) => item.targetType === 'attribute' && item.targetId === attributeId);
  return { base, modifiers, total: Math.min(20, modifiers.reduce((sum, item) => sum + Number(item.value || 0), base)) };
}

export function skillValue(character, parsedSkill) {
  const weighted = parsedSkill.terms.reduce((sum, term) => sum + attributeBreakdown(character, term.attribute).total * term.weight, 0);
  const catalogBonus = (character.modifiers || []).filter((item) => item.targetType === 'skill' && normalize(item.targetId) === normalize(parsedSkill.entry.name)).reduce((sum, item) => sum + Number(item.value || 0), 0);
  return Math.floor(weighted) + catalogBonus + Number(character.skillBonuses?.[parsedSkill.entry.id] || 0);
}

export function attributePointCost(currentValue) {
  const current = Number(currentValue || 0);
  if (current < 5) return 1;
  if (current < 10) return 2;
  return 5;
}

export function spentInitialAttributePoints(attributesMap = {}) {
  return Object.values(attributesMap).reduce((total, raw) => total + Math.max(0, Number(raw) || 0), 0);
}

export function defenseValue(character, classEntry = null) {
  const classFormula = classEntry ? parseClass(classEntry).defenseFormula : null;
  const equipment = (character.modifiers || []).filter((item) => item.targetType === 'stat' && item.targetId === 'defense').reduce((sum, item) => sum + Number(item.value || 0), 0);
  if (classFormula) return evaluateRuleFormula(classFormula, character) + equipment;
  const dexterity = attributeBreakdown(character, 'dexterity').total;
  const constitution = attributeBreakdown(character, 'constitution').total;
  return Math.floor(dexterity * .7 + constitution * .3) + equipment;
}

export function armorClassValue(character, classEntry = null) {
  const equipment = (character.modifiers || []).filter((item) => item.targetType === 'stat' && ['armorClass', 'armorclass'].includes(item.targetId)).reduce((sum, item) => sum + Number(item.value || 0), 0);
  return 10 + defenseValue(character, classEntry) + equipment;
}

export function classXpRequired(currentLevel) {
  if (currentLevel >= 10) return 75;
  return currentLevel < 5 ? 20 : 40;
}

export function allowedCombatXpTargets(classEntry) {
  const configured = parseClass(classEntry).allowedCombatXpAttributes;
  if (configured?.length) return configured;
  const name = normalize(classEntry?.name);
  if (name === 'paladino') return ['faith', 'strength', 'constitution', 'dexterity'];
  if (name === 'mago') return ['intelligence', 'charisma'];
  return [];
}

export function validateCharacter(character, catalog) {
  const errors = [], warnings = [], suggestions = [];
  if (!character.name?.trim()) errors.push('Informe o nome do personagem.');
  if (!findEntry(catalog, character.raceId)) errors.push('Selecione uma raça do catálogo oficial.');
  const classEntry = findEntry(catalog, character.classId);
  if (!classEntry) errors.push('Selecione uma classe do catálogo oficial.');
  else if (parseRuleMetadata(classEntry)?.type !== 'class') errors.push('A classe selecionada ainda não possui regras completas do sistema.');
  const raceEntry = findEntry(catalog, character.raceId);
  if (raceEntry) {
    if (parseRuleMetadata(raceEntry)?.type !== 'race') errors.push('A raça selecionada ainda não possui regras completas do sistema.');
    else {
      const race = parseRace(raceEntry, character.raceVariant);
      if (race.variants.length && !race.selectedVariant) errors.push('Selecione uma variante válida da raça.');
    }
  }
  if (Object.values(character.attributes || {}).some((value) => Number(value) < 0)) errors.push('Atributos não podem ser negativos.');
  if (Object.values(character.attributes || {}).some((value) => Number(value) > 20)) errors.push('O limite absoluto de um atributo é +20.');
  if (spentInitialAttributePoints(character.attributes) > 10) errors.push('A distribuição inicial excede os 10 pontos disponíveis.');
  if (!(catalog?.entries || []).length) errors.push('O catálogo oficial está vazio ou indisponível.');
  if (Number(character.maxHp) <= 0) errors.push('A vida inicial ainda não foi definida.');
  if (!character.imageUrl) suggestions.push('Adicione um avatar ao personagem.');
  return { errors, warnings, suggestions, isValid: errors.length === 0 };
}

export function createRoll({ characterId = '', type, name, sides, modifiers = [], penalties = 0, origin = 'character_sheet' }) {
  const rawResult = Math.floor(Math.random() * sides) + 1;
  const bonus = modifiers.reduce((sum, item) => sum + Number(item.value || 0), 0);
  return { id: `roll_${Date.now()}_${Math.random().toString(16).slice(2)}`, characterId, type, name, die: `d${sides}`, rawResult, finalResult: rawResult + bonus - penalties, modifiers, penalties, origin, createdAt: new Date().toISOString() };
}

export function rollFormula(roll) {
  const bonus = (roll.modifiers || []).reduce((sum, item) => sum + Number(item.value || 0), 0);
  return `${roll.die} ${bonus >= 0 ? '+' : '-'} ${Math.abs(bonus)}${roll.penalties ? ` - ${roll.penalties}` : ''}`;
}

function parseUnlocks(lines) {
  return lines.flatMap((line, index) => {
    const match = line.match(/(?:n[ií]vel|lvl)\s*(\d+)\s*[-:–]?\s*(.*)/i);
    if (!match || !match[2]?.replace(/^[#*\s]+|[#*\s]+$/g, '')) return [];
    return [{ level: Number(match[1]), name: match[2].replace(/^[#*\s]+|[#*\s]+$/g, ''), description: lines[index + 1] || '' }];
  });
}

function firstNumber(text, patterns) {
  for (const pattern of patterns) {
    const value = numberMatch(text, pattern);
    if (value !== null) return value;
  }
  return null;
}

function numberMatch(text, pattern) {
  const match = String(text || '').match(pattern);
  return match ? Number(match[1]) : null;
}

function linesOf(text = '') { return String(text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean); }
function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function clamp(value, min, max) { return Math.min(Math.max(Number(value) || 0, min), Math.max(max, min)); }

export function attributeLabel(id) { return attributes.find(([value]) => value === id)?.[1] || id; }
