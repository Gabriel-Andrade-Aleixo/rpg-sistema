export function changeHitPoints(character, nextHp) {
  const currentHp = Math.min(Math.max(0, Number(nextHp) || 0), Number(character.maxHp) || 0);
  if (currentHp <= 0) return { ...character, currentHp };
  return {
    ...character,
    currentHp,
    resources: { ...character.resources, deathSuccesses: 0, deathFailures: 0, dead: 0 },
  };
}

export function recordDeathSave(character, success) {
  if (Number(character.currentHp) > 0 || Number(character.resources?.dead) === 1) return character;
  const resources = { ...character.resources };
  const key = success ? 'deathSuccesses' : 'deathFailures';
  resources[key] = Math.min(3, Number(resources[key] || 0) + 1);
  if (success && resources.deathSuccesses >= 3) {
    return { ...character, currentHp: 1, resources: { ...resources, deathSuccesses: 0, deathFailures: 0, dead: 0 } };
  }
  if (!success && resources.deathFailures >= 3) resources.dead = 1;
  return { ...character, resources };
}

export function resetDeathSaves(character) {
  return { ...character, resources: { ...character.resources, deathSuccesses: 0, deathFailures: 0, dead: 0 } };
}
