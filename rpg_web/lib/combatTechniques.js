export const techniqueCostOptions = [
  ['none', 'Sem limite especial'],
  ['once_per_combat', 'Uso único por combate'],
  ['cooldown', 'Recarga em turnos'],
];

export function canLearnCombatTechniques(parsedClass) {
  return Boolean(parsedClass && (!parsedClass.manaFormula || parsedClass.usesWeapons));
}

export function saveCombatTechnique(character, values, editingId = '') {
  if (character.combatContext?.inCombat) {
    return { character, error: 'Técnicas só podem ser aprendidas ou alteradas fora de combate.' };
  }
  const name = String(values.name || '').trim();
  if (!name) return { character, error: 'Informe o nome da técnica.' };
  const costType = techniqueCostOptions.some(([id]) => id === values.costType) ? values.costType : 'none';
  const cooldownTurns = costType === 'cooldown' ? Math.max(1, Math.min(99, Number(values.cooldownTurns) || 1)) : 0;
  const technique = {
    id: editingId || `technique_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    name: name.slice(0, 120),
    description: String(values.description || '').trim().slice(0, 1200),
    damage: String(values.damage || '').trim().slice(0, 200),
    training: String(values.training || '').trim().slice(0, 500),
    costType,
    cooldownTurns,
    cooldownRemaining: 0,
    usedThisCombat: false,
    learningDifficulty: Math.max(1, Math.min(30, Number(values.learningDifficulty) || 15)),
    executionDifficulty: Math.max(1, Math.min(29, Number(values.executionDifficulty) || 10)),
    trainingSuccesses: Number((character.techniques || []).find((item) => item.id === editingId)?.trainingSuccesses || 0),
    executionSuccesses: Number((character.techniques || []).find((item) => item.id === editingId)?.executionSuccesses || 0),
    masteryTrainingSuccesses: Number((character.techniques || []).find((item) => item.id === editingId)?.masteryTrainingSuccesses || 0),
    trainingHours: Number((character.techniques || []).find((item) => item.id === editingId)?.trainingHours || 0),
    learningState: (character.techniques || []).find((item) => item.id === editingId)?.learningState || 'unlearned',
    createdAt: editingId
      ? (character.techniques || []).find((item) => item.id === editingId)?.createdAt || new Date().toISOString()
      : new Date().toISOString(),
  };
  const current = character.techniques || [];
  const techniques = editingId
    ? current.map((item) => item.id === editingId ? technique : item)
    : [technique, ...current];
  return { character: { ...character, techniques }, error: '' };
}

export function useCombatTechnique(character, techniqueId, { executionSucceeded = false } = {}) {
  if (!character.combatContext?.inCombat) return { character, error: 'Inicie o combate antes de usar uma técnica.' };
  const technique = (character.techniques || []).find((item) => item.id === techniqueId);
  if (!technique) return { character, error: 'Técnica não encontrada.' };
  if ((technique.learningState || 'unlearned') === 'unlearned') return { character, error: 'A técnica ainda não foi aprendida parcialmente.' };
  if (technique.learningState === 'partial' && !executionSucceeded) return { character, error: `A técnica parcial exige sucesso na CD de Execução ${technique.executionDifficulty || 10}.` };
  if (technique.usedThisCombat) return { character, error: 'Esta técnica já foi usada neste combate.' };
  if (Number(technique.cooldownRemaining || 0) > 0) return { character, error: `A técnica recarrega em ${technique.cooldownRemaining} turno(s).` };
  return {
    error: '',
    character: {
      ...character,
      techniques: character.techniques.map((item) => item.id !== techniqueId ? item : {
        ...item,
        executionSuccesses: item.learningState === 'partial' ? Number(item.executionSuccesses || 0) + 1 : Number(item.executionSuccesses || 0),
        learningState: item.learningState === 'partial' && Number(item.executionSuccesses || 0) + 1 >= 3 ? 'mastered' : item.learningState,
        usedThisCombat: item.costType === 'once_per_combat',
        cooldownRemaining: item.costType === 'cooldown' ? Number(item.cooldownTurns || 1) : 0,
      }),
      actionHistory: [{
        id: `action_${Date.now()}_${techniqueId}`,
        name: technique.name,
        result: technique.damage || technique.description || 'Técnica utilizada',
        manaSpent: 0,
        focusSpent: 0,
        humanitySpent: 0,
        createdAt: new Date().toISOString(),
      }, ...(character.actionHistory || [])].slice(0, 100),
    },
  };
}

export function recordTechniqueTraining(character, techniqueId, succeeded) {
  if (character.combatContext?.inCombat) return { character, error: 'O treinamento deve ocorrer fora de combate.' };
  const technique = (character.techniques || []).find((item) => item.id === techniqueId);
  if (!technique) return { character, error: 'Técnica não encontrada.' };
  const trainingSuccesses = Number(technique.trainingSuccesses || 0) + (succeeded && technique.learningState === 'unlearned' ? 1 : 0);
  const masteryTrainingSuccesses = Number(technique.masteryTrainingSuccesses || 0) + (succeeded && technique.learningState === 'partial' ? 1 : 0);
  const learningState = technique.learningState === 'unlearned' && trainingSuccesses >= 3
    ? 'partial'
    : technique.learningState === 'partial' && masteryTrainingSuccesses >= 5 ? 'mastered' : technique.learningState;
  return { error: '', character: { ...character, techniques: character.techniques.map((item) => item.id === techniqueId ? { ...item, trainingHours: Number(item.trainingHours || 0) + 1, trainingSuccesses, masteryTrainingSuccesses, learningState } : item) } };
}

export function advanceTechniqueTurn(character) {
  return {
    ...character,
    techniques: (character.techniques || []).map((item) => ({
      ...item,
      cooldownRemaining: Math.max(0, Number(item.cooldownRemaining || 0) - 1),
    })),
  };
}

export function setTechniqueCombatState(character, active) {
  return {
    ...character,
    combatContext: { ...(character.combatContext || {}), inCombat: active },
    techniques: (character.techniques || []).map((item) => ({
      ...item,
      cooldownRemaining: active ? Number(item.cooldownRemaining || 0) : 0,
      usedThisCombat: active ? item.usedThisCombat === true : false,
    })),
  };
}
