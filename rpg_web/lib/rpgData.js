export const attributes = [
  ['strength', 'Força'],
  ['dexterity', 'Destreza'],
  ['constitution', 'Constituição'],
  ['intelligence', 'Inteligência'],
  ['charisma', 'Carisma'],
  ['faith', 'Fé'],
];

export const diceOptions = [4, 6, 8, 10, 12, 20, 100];

export function emptyCharacter() {
  const now = new Date().toISOString();
  return {
    id: `char_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    name: '',
    playerName: '',
    imageUrl: '',
    raceId: '',
    raceVariant: '',
    classId: '',
    visibility: 'public',
    isPrivate: false,
    hpProgressionMode: 'fixed',
    level: 1,
    background: '',
    lore: '',
    attributes: Object.fromEntries(attributes.map(([id]) => [id, 0])),
    skillBonuses: {},
    resources: { luck: 0, humanity: 100, divinity: 0, corruption: 0, deathSuccesses: 0, deathFailures: 0, dead: 0 },
    combatContext: { enemyWithinTwoMeters: false, darkOrNight: false, hotEnvironment: false, coldEnvironment: false, withoutSunlight: false, blinded: false },
    currency: { gold: 0, silver: 0, copper: 0 },
    notes: [],
    inventory: [],
    equipment: [],
    maxHp: 0,
    currentHp: 0,
    maxMana: 0,
    currentMana: 0,
    skillPoints: 0,
    classPoints: 0,
    proficiencies: [],
    abilities: [],
    manualProficiencies: [],
    manualAbilities: [],
    permanentAttributeBonuses: {},
    classXp: 0,
    classXpTotal: 0,
    classXpHistory: [],
    areaExperience: {},
    combatXp: 0,
    experienceHistory: [],
    humanityHistory: [],
    corruptionHistory: [],
    spells: [],
    actionHistory: [],
    modifiers: [],
    rollHistory: [],
    levelHistory: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function currencyLabel(currency = {}) {
  const total =
    (Number(currency.copper) || 0) +
    (Number(currency.silver) || 0) * 50 +
    (Number(currency.gold) || 0) * 2500;
  const gold = Math.floor(total / 2500);
  const silver = Math.floor((total % 2500) / 50);
  const copper = total % 50;
  return `${gold} ouro, ${silver} prata, ${copper} cobre`;
}

export function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
