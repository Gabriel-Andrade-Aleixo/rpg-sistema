import fs from 'node:fs';

import { closePool } from '../lib/postgres.js';
import { loadCatalogFromDatabase, normalizeText, upsertCatalogEntry } from '../lib/catalogStore.js';

loadDotEnv();

try {
  const payload = JSON.parse(await readStdin());
  const category = String(payload.category || '').trim();
  const name = String(payload.name || '').trim();
  const description = String(payload.description || '').trim();
  if (!category || !name || !description) throw new Error('category, name e description são obrigatórios.');

  const catalog = await loadCatalogFromDatabase();
  const existing = catalog.entries.find((entry) =>
    normalizeText(entry.category) === normalizeText(category)
    && normalizeText(entry.name) === normalizeText(name)
  );
  const metadataBlock = existing?.description?.match(
    /<!-- RPG_RULES_JSON_START -->[\s\S]*?<!-- RPG_RULES_JSON_END -->/,
  )?.[0];
  const completeDescription = metadataBlock
    ? `${description}\n\n---\nMetadados usados automaticamente pelos aplicativos.\n${metadataBlock}`
    : description;
  await upsertCatalogEntry(category, {
    name,
    description: completeDescription,
    labels: Array.isArray(payload.labels) ? payload.labels : [],
    metadata: existing?.metadata || {},
  });
  console.log(existing ? `Atualizado: ${name}` : `Criado: ${name}`);
} finally {
  await closePool();
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function loadDotEnv() {
  const path = new URL('../.env', import.meta.url);
  if (!fs.existsSync(path)) return;
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}
