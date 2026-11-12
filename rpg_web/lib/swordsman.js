const clamp = (value, maximum) => Math.min(maximum, Math.max(0, Math.trunc(Number(value) || 0)));

export function swordsmanState(character) {
  const resources = character.resources || {};
  const threats = clamp(resources.swordsmanThreats, 20);
  return {
    threats,
    concentration: clamp(resources.swordsmanConcentration ?? Math.min(2, Math.max(0, threats - 1)), 2),
    dodgeUsed: Boolean(resources.swordsmanDodgeUsed),
    openingUsed: Boolean(resources.swordsmanOpeningUsed),
  };
}

export function setSwordsmanThreats(character, count) {
  const state = swordsmanState(character);
  const threats = clamp(count, 20);
  const concentration = threats > state.threats
    ? Math.max(state.concentration, Math.min(2, threats - 1))
    : state.concentration;
  return { ...character, resources: { ...character.resources, swordsmanThreats: threats, swordsmanConcentration: concentration } };
}

export function startSwordsmanTurn(character) {
  const state = swordsmanState(character);
  const required = Math.min(2, Math.max(0, state.threats - 1));
  const recovery = Number(character.level || 1) >= 9 && state.threats <= 1 ? 2 : 1;
  return {
    ...character,
    resources: {
      ...character.resources,
      swordsmanConcentration: Math.max(required, state.concentration - recovery),
      swordsmanDodgeUsed: 0,
      swordsmanOpeningUsed: 0,
    },
  };
}

export function markSwordsmanAction(character, action) {
  const key = action === 'dodge' ? 'swordsmanDodgeUsed' : 'swordsmanOpeningUsed';
  return { ...character, resources: { ...character.resources, [key]: 1 } };
}
