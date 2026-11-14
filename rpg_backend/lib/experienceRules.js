export const EXPERIENCE_SYSTEM_VERSION = 3;

const classLevelCosts = Object.freeze({
  1: 10,
  2: 15,
  3: 20,
  4: 25,
  5: 30,
  6: 35,
  7: 45,
  8: 50,
  9: 55,
  10: 75,
});

export function classXpRequired(currentLevel) {
  return classLevelCosts[Math.max(1, Math.min(10, Number(currentLevel) || 1))];
}

const previousLevelCosts = Object.freeze({ 1: 20, 2: 20, 3: 20, 4: 20, 5: 40, 6: 40, 7: 40, 8: 40, 9: 40 });

export function classXpRedistribution(level) {
  let difference = 0;
  for (let completed = 1; completed < Math.max(1, Math.min(10, Number(level) || 1)); completed += 1) {
    difference += previousLevelCosts[completed] - classXpRequired(completed);
  }
  return difference;
}

const incorrectRedistributions = Object.freeze({ 10: 0, 15: 10, 20: 15, 25: 15, 30: 10, 35: 20, 45: 25, 50: 20, 55: 10 });
const correctedRedistributionNote = 'Diferença dos níveis já pagos na nova progressão de XP';

function correctPreviousRedistribution(character) {
  const history = character.classXpHistory || [];
  const record = history.find((item) => item.id === 'class_xp_redistribution_v2');
  if (!record) return character;
  if (record.note === correctedRedistributionNote) return character;
  const original = Number(record.amount) || 0;
  const corrected = incorrectRedistributions[original];
  if (corrected === undefined) return character;
  const difference = corrected - original;
  character.classXp = Math.max(0, (Number(character.classXp) || 0) + difference);
  character.classXpTotal = Math.max(0, (Number(character.classXpTotal) || 0) + difference);
  character.classXpHistory = history.map((item) => item === record ? {
    ...item,
    amount: corrected,
    note: correctedRedistributionNote,
    breakdown: { ...item.breakdown, redistribution: corrected },
  } : item);
  return character;
}

export function developmentAttributeCost(currentValue) {
  const value = Number(currentValue) || 0;
  if (value < 5) return 1;
  if (value < 10) return 2;
  return 5;
}

export function migrateExperienceSystem(raw, { redistributeClassXp = true, now = new Date().toISOString() } = {}) {
  const character = structuredClone(raw || {});
  if (Number(character.xpSystemVersion || 0) >= EXPERIENCE_SYSTEM_VERSION) return character;
  if (Number(character.xpSystemVersion || 0) === 2) {
    correctPreviousRedistribution(character);
    character.xpSystemVersion = EXPERIENCE_SYSTEM_VERSION;
    return character;
  }

  const level = Math.max(1, Math.min(10, Number(character.level) || 1));
  const areaXp = Object.values(character.areaExperience || {}).reduce((sum, value) => {
    const amount = typeof value === 'object' ? value?.xp : value;
    return sum + Math.max(0, Number(amount) || 0);
  }, 0);
  const combatXp = Math.max(0, Number(character.combatXp) || 0);
  const legacyDevelopmentXp = areaXp + combatXp;
  const existingDevelopmentXp = Math.max(0, Number(character.developmentXp) || 0);
  const combinedDevelopmentXp = existingDevelopmentXp + legacyDevelopmentXp;
  const pointsEarned = Math.floor(combinedDevelopmentXp / 20);
  const classBonus = redistributeClassXp ? classXpRedistribution(level) : 0;

  character.classXp = Math.max(0, (Number(character.classXp) || 0) + classBonus);
  character.classXpTotal = Math.max(0, (Number(character.classXpTotal) || 0) + classBonus);
  character.developmentXp = combinedDevelopmentXp % 20;
  character.developmentPoints = Math.max(0, Number(character.developmentPoints) || 0) + pointsEarned;
  character.developmentAttributeBonuses = character.developmentAttributeBonuses || {};
  character.developmentSkillBonuses = character.developmentSkillBonuses || {};
  character.areaExperience = {};
  character.combatXp = 0;
  character.legacyExperienceMigration = {
    areaXp,
    combatXp,
    developmentPointsGranted: pointsEarned,
    remainingDevelopmentXp: character.developmentXp,
    migratedAt: now,
  };
  if (classBonus !== 0) {
    character.classXpHistory = [{
      id: `class_xp_redistribution_v${EXPERIENCE_SYSTEM_VERSION}`,
      amount: classBonus,
      note: correctedRedistributionNote,
      createdAt: now,
      breakdown: { redistribution: classBonus },
    }, ...(character.classXpHistory || [])];
  }
  if (legacyDevelopmentXp > 0) {
    character.experienceHistory = [{
      id: `xp_migration_v${EXPERIENCE_SYSTEM_VERSION}`,
      type: 'migration',
      amount: legacyDevelopmentXp,
      description: `Saldos antigos consolidados: ${pointsEarned} PD e ${character.developmentXp} XP`,
      createdAt: now,
    }, ...(character.experienceHistory || [])];
  }
  character.xpSystemVersion = EXPERIENCE_SYSTEM_VERSION;
  return character;
}
