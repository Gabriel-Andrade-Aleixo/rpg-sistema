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

export function useCombatTechnique(character, techniqueId) {
  if (!character.combatContext?.inCombat) return { character, error: 'Inicie o combate antes de usar uma técnica.' };
  const technique = (character.techniques || []).find((item) => item.id === techniqueId);
  if (!technique) return { character, error: 'Técnica não encontrada.' };
  if (technique.usedThisCombat) return { character, error: 'Esta técnica já foi usada neste combate.' };
  if (Number(technique.cooldownRemaining || 0) > 0) return { character, error: `A técnica recarrega em ${technique.cooldownRemaining} turno(s).` };
  return {
    error: '',
    character: {
      ...character,
      techniques: character.techniques.map((item) => item.id !== techniqueId ? item : {
        ...item,
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
