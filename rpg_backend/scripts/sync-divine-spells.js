import fs from 'node:fs';

import { divineSpells } from '../data/divine-spells.js';
import { spectralArrowSpells } from '../data/spectral-arrow-spells.js';
import { closePool } from '../lib/postgres.js';
import { normalizeText, upsertCatalogEntry } from '../lib/catalogStore.js';

loadDotEnv();

let synced = 0;
try {
  for (const spell of [...divineSpells, ...spectralArrowSpells]) {
    const entry = spellEntry(spell);
    await upsertCatalogEntry('Magias', entry);
    synced += 1;
  }
  console.log(`Sincronização concluída: ${synced} magia(s) cadastrada(s) ou atualizada(s).`);
} finally {
  await closePool();
}

function spellEntry(spell) {
  const name = String(spell.name || '').trim();
  const school = String(spell.school || 'Outra').trim();
  const level = Math.max(0, Math.min(20, Number(spell.level) || 0));
  const topic = String(spell.topic || '').trim();
  const className = String(spell.className || '').trim();
  const manaCost = Math.max(0, Number(spell.manaCost) || 0);
  const focusCost = Math.max(0, Number(spell.focusCost) || 0);
  const humanityCost = Math.max(0, Number(spell.humanityCost) || 0);
  const metadata = {
    schemaVersion: 1,
    type: 'spell',
    school: normalizeText(school),
    level,
    costs: { mana: manaCost, focus: focusCost, humanity: humanityCost },
    topic,
    className,
    actionType: spell.actionType || '',
    actionId: spell.actionId || '',
    range: spell.range || '',
    damage: spell.damage || '',
  };
  const description = [
    `# ${name}`,
    '',
    `**Tipo:** ${school}`,
    `**Nível:** ${level}`,
    topic ? `**Tópico:** ${topic}` : '',
    className ? `**Classe:** ${className}` : '',
    `**Custo:** ${manaCost} PM${focusCost ? ` · ${focusCost} Foco` : ''}${humanityCost ? ` · ${humanityCost} Humanidade` : ''}`,
    spell.range ? `**Alcance:** ${spell.range}` : '',
    spell.damage ? `**Dano/Efeito:** ${spell.damage}` : '',
    '',
    spell.description || 'Magia cadastrada pelo sistema.',
    '',
    '---',
    'Metadados usados automaticamente pelos aplicativos. Edite com cuidado.',
    '<!-- RPG_RULES_JSON_START -->',
    JSON.stringify(metadata, null, 2),
    '<!-- RPG_RULES_JSON_END -->',
  ].filter((line) => line !== '').join('\n');
  return {
    name,
    description,
    labels: [
      { id: 'label_magia', name: 'Magia', color: 'purple' },
      { id: `label_magia_${normalizeText(school).replace(/[^a-z0-9]+/g, '_')}`, name: `Magia: ${school}`, color: school === 'Divina' ? 'yellow' : school === 'Demoníaca' ? 'red' : 'blue' },
      ...(topic ? [{ id: `label_topico_${normalizeText(topic).replace(/[^a-z0-9]+/g, '_')}`, name: topic, color: level >= 3 ? 'red' : level === 2 ? 'orange' : 'green' }] : []),
    ],
    metadata,
  };
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
