import { changedCharacterFields, compactCharacter } from './characterSync.js';

const prefix = 'runalith-pending-characters-v1:';

export function pendingQueueKey(userId) {
  return `${prefix}${encodeURIComponent(userId)}`;
}

export function readPendingQueue(storage, userId) {
  if (!storage || !userId) return new Map();
  try {
    const values = JSON.parse(storage.getItem(pendingQueueKey(userId)) || '[]');
    if (!Array.isArray(values)) return new Map();
    return new Map(values.filter((entry) => entry?.character?.id && entry.base?.id === entry.character.id)
      .map((entry) => [entry.character.id, entry]));
  } catch {
    return new Map();
  }
}

export function writePendingQueue(storage, userId, entries) {
  if (!storage || !userId) return false;
  try {
    if (entries.size) storage.setItem(pendingQueueKey(userId), JSON.stringify([...entries.values()]));
    else storage.removeItem(pendingQueueKey(userId));
    return true;
  } catch {
    return false;
  }
}

export function pendingEntry(character, saved, existing = null) {
  return {
    base: existing?.base || compactCharacter(saved),
    character: compactCharacter(character),
  };
}

export function applyPendingEntry(serverCharacter, entry) {
  if (!entry || serverCharacter.id !== entry.character.id) return serverCharacter;
  const fields = changedCharacterFields(entry.base, entry.character);
  return { ...serverCharacter, ...Object.fromEntries(fields.map((field) => [field, entry.character[field]])) };
}

export function pendingEntryIsApplied(serverCharacter, entry) {
  const fields = changedCharacterFields(entry.base, entry.character);
  return fields.every((field) => JSON.stringify(serverCharacter[field]) === JSON.stringify(entry.character[field]));
}

export function rebasePendingEntry(currentEntry, sentEntry, persisted) {
  const base = compactCharacter(persisted);
  const fields = changedCharacterFields(sentEntry.character, currentEntry.character);
  return {
    base,
    character: { ...base, ...Object.fromEntries(fields.map((field) => [field, currentEntry.character[field]])) },
  };
}
