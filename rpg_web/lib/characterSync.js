const ignoredFields = new Set(['modifiers', 'syncRevision', 'updatedAt']);

export function compactCharacter(character) {
  const compact = structuredClone(character);
  delete compact.modifiers;
  compact.rollHistory = (compact.rollHistory || []).slice(0, 30);
  return compact;
}

export function changedCharacterFields(previous, next) {
  if (!previous) return Object.keys(next).filter((key) => !ignoredFields.has(key));
  return Object.keys(next).filter(
    (key) => !ignoredFields.has(key) && JSON.stringify(previous[key]) !== JSON.stringify(next[key]),
  );
}
