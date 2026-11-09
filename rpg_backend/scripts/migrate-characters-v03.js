import fs from 'node:fs';

import { closePool, query } from '../lib/postgres.js';
import { loadCatalogFromDatabase, saveCharacterToDatabase } from '../lib/catalogStore.js';
import { validateAndNormalizeCharacter } from '../lib/characterRules.js';

loadDotEnv();

const catalog = await loadCatalogFromDatabase();
const degreeByCatalogId = new Map(catalog.entries.map((entry) => [entry.id, Number(entry.metadata?.degree || entry.metadata?.level || 0)]));
const { rows } = await query(
  `SELECT id, owner_user_id, data, sync_revision
   FROM characters
   WHERE deleted_at IS NULL
   ORDER BY updated_at, id`,
);

let updated = 0;
const failures = [];
try {
  for (const row of rows) {
    try {
      const prepared = materializeV03(row.data, degreeByCatalogId);
      prepared.syncRevision = Number(row.sync_revision || prepared.syncRevision || 0);
      const normalized = validateAndNormalizeCharacter(prepared, catalog);
      normalized.syncRevision = prepared.syncRevision;
      if (samePersistedData(row.data, normalized)) continue;
      await saveCharacterToDatabase(normalized, [], row.owner_user_id, {
        baseRevision: prepared.syncRevision,
        prepare: async (value) => ({ ...value, ...normalized }),
      });
      updated += 1;
    } catch (error) {
      failures.push({ id: row.id, message: error.message });
    }
  }
  console.log(`Fichas V0.3 atualizadas: ${updated}/${rows.length}.`);
  if (failures.length) {
    console.error(`Fichas que exigem revisão manual: ${failures.length}.`);
    for (const failure of failures) console.error(`${failure.id}: ${failure.message}`);
    process.exitCode = 1;
  }
} finally {
  await closePool();
}

function materializeV03(raw, degreeByCatalogId) {
  const character = structuredClone(raw || {});
  const resources = { ...(character.resources || {}) };
  resources.pendingLuckBonus ??= 0;
  resources.infusionsThisTurn ??= 0;
  resources.spectralInfusionUsedThisTurn ??= 0;
  character.resources = resources;
  if (character.techniqueSystemVersion !== 1) {
    character.techniques = (character.techniques || []).map((technique) => ({
      ...technique,
      learningDifficulty: Number(technique.learningDifficulty || 15),
      executionDifficulty: Number(technique.executionDifficulty || 10),
      trainingSuccesses: Number(technique.trainingSuccesses || 3),
      executionSuccesses: Number(technique.executionSuccesses || 3),
      masteryTrainingSuccesses: Number(technique.masteryTrainingSuccesses || 5),
      trainingHours: Number(technique.trainingHours || 0),
      learningState: technique.learningState || 'mastered',
    }));
    character.techniqueSystemVersion = 1;
  }
  character.spells = (character.spells || []).map((spell) => ({
    ...spell,
    degree: Number(spell.degree || degreeByCatalogId.get(spell.catalogId) || 0),
  }));
  return character;
}

function samePersistedData(before, after) {
  const sanitize = (value) => {
    const copy = structuredClone(value || {});
    delete copy.syncRevision;
    delete copy.updatedAt;
    delete copy.derivedStats;
    return JSON.stringify(copy);
  };
  return sanitize(before) === sanitize(after);
}

function loadDotEnv() {
  const path = new URL('../.env', import.meta.url);
  if (!fs.existsSync(path)) return;
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index < 1) continue;
    const name = trimmed.slice(0, index).trim();
    if (!process.env[name]) process.env[name] = trimmed.slice(index + 1).trim();
  }
}
