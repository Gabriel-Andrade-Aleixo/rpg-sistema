import http from 'node:http';
import fs from 'node:fs';

import {
  deleteCatalogEntryById,
  deleteCharacterFromDatabase,
  ensureCatalogCategories,
  getCharacterFromDatabase,
  insertCatalogEntry,
  listCharactersFromDatabase,
  loadCatalogFromDatabase,
  metadataFromDescription,
  saveCharacterToDatabase,
  updateCatalogEntryById,
} from './lib/catalogStore.js';

loadDotEnv();

const PORT = Number(process.env.PORT || 8787);
const characterWriteQueues = new Map();

let catalogCache = null;
let catalogCachedAt = 0;

export async function requestHandler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const path = url.pathname;

    if (req.method === 'GET' && path === '/health') {
      return sendJson(res, 200, { ok: true, backend: 'rpg-backend', storage: 'postgres' });
    }

    if (req.method === 'POST' && path === '/setup') {
      await setupDatabaseCatalogs();
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'GET' && path === '/catalog') {
      const refresh = url.searchParams.get('refresh') === 'true';
      return sendJson(res, 200, { ok: true, catalog: await loadCatalog(refresh) });
    }

    if (req.method === 'POST' && path === '/catalog/items') {
      const body = await readJson(req);
      const item = await createCatalogEntry('item', body.item);
      return sendJson(res, 201, { ok: true, item });
    }

    if (req.method === 'POST' && path === '/catalog/spells') {
      const body = await readJson(req);
      const spell = await createCatalogEntry('spell', body.spell);
      return sendJson(res, 201, { ok: true, spell });
    }

    const catalogMatch = path.match(/^\/catalog\/(items|spells)\/([^/]+)$/);
    if (catalogMatch && req.method === 'PUT') {
      const kind = catalogMatch[1] === 'spells' ? 'spell' : 'item';
      const body = await readJson(req);
      const entry = await updateCatalogEntry(
        kind,
        decodeURIComponent(catalogMatch[2]),
        body[kind],
      );
      return sendJson(res, 200, { ok: true, [kind]: entry });
    }

    if (catalogMatch && req.method === 'DELETE') {
      const kind = catalogMatch[1] === 'spells' ? 'spell' : 'item';
      await deleteCatalogEntry(kind, decodeURIComponent(catalogMatch[2]));
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'GET' && path === '/characters') {
      return sendJson(res, 200, { ok: true, characters: await listCharacters() });
    }

    const characterMatch = path.match(/^\/characters\/([^/]+)$/);
    if (characterMatch && req.method === 'GET') {
      const character = await getCharacter(decodeURIComponent(characterMatch[1]));
      return sendJson(res, 200, { ok: true, character });
    }

    if (req.method === 'POST' && path === '/characters') {
      const body = await readJson(req);
      const character = await saveCharacter(body.character, {
        baseRevision: body.baseRevision,
        changedFields: body.changedFields,
      });
      return sendJson(res, 200, { ok: true, character });
    }

    if (characterMatch && req.method === 'DELETE') {
      await deleteCharacter(decodeURIComponent(characterMatch[1]));
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 404, { ok: false, error: 'Rota nao encontrada.' });
  } catch (error) {
    return sendJson(res, error?.statusCode || 500, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      ...(error?.details ? { details: error.details } : {}),
    });
  }
}

const server = http.createServer(requestHandler);

if (!process.env.VERCEL) {
  server.listen(PORT, () => {
    console.log(`RPG backend ouvindo em http://localhost:${PORT}`);
  });
}

export default requestHandler;

function loadDotEnv() {
  if (!fs.existsSync('.env')) return;
  const lines = fs.readFileSync('.env', 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 5 * 1024 * 1024) throw new AppError('Requisição maior que 5 MB.', 413);
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

async function setupDatabaseCatalogs() {
  await ensureCatalogCategories();
  catalogCache = null;
}

async function loadCatalog(forceRefresh = false) {
  const maxAgeMs = 5 * 60 * 1000;
  if (!forceRefresh && catalogCache && Date.now() - catalogCachedAt < maxAgeMs) {
    return catalogCache;
  }
  catalogCache = await loadCatalogFromDatabase();
  catalogCachedAt = Date.now();
  return catalogCache;
}

async function createCatalogEntry(kind, raw) {
  const definition = catalogEntryDefinition(kind, raw);
  const entry = await insertCatalogEntry(definition.listName, {
    name: definition.name,
    description: definition.description,
    imageUrl: definition.imageUrl,
    labels: definition.labels.map(([name, color]) => ({ id: labelId(name), name, color })),
    metadata: metadataFromDescription(definition.description),
  });
  catalogCache = null;
  return entry;
}

async function updateCatalogEntry(kind, id, raw) {
  const definition = catalogEntryDefinition(kind, raw);
  const entry = await updateCatalogEntryById(id, definition.listName, {
    name: definition.name,
    description: definition.description,
    imageUrl: definition.imageUrl,
    labels: definition.labels.map(([name, color]) => ({ id: labelId(name), name, color })),
    metadata: metadataFromDescription(definition.description),
  });
  catalogCache = null;
  return entry;
}

async function deleteCatalogEntry(kind, id) {
  const allowedCategories = kind === 'spell' ? ['Magias'] : ['Itens', 'Equipamentos'];
  await deleteCatalogEntryById(id, allowedCategories);
  catalogCache = null;
}

function catalogEntryDefinition(kind, raw) {
  return kind === 'spell' ? spellDefinition(raw) : itemDefinition(raw);
}

function itemDefinition(raw) {
  const item = raw && typeof raw === 'object' ? raw : {};
  const name = String(item.name || '').trim();
  if (name.length < 2 || name.length > 120) {
    throw new AppError('O item precisa ter um nome entre 2 e 120 caracteres.', 400);
  }
  const type = ['Armadura', 'Arma', 'Consumível', 'Artefato', 'Outro'].includes(item.type)
    ? item.type
    : 'Outro';
  const armorCategory = type === 'Armadura' && ['Leve', 'Média', 'Pesada', 'Escudo'].includes(item.armorCategory)
    ? item.armorCategory
    : '';
  if (type === 'Armadura' && !armorCategory) {
    throw new AppError('Selecione a categoria da armadura.', 400);
  }
  const targetNames = {
    defense: 'Defesa', armorClass: 'CA', attack: 'Ataque', damage: 'Dano',
    health: 'Vida', mana: 'Mana', strength: 'Força', dexterity: 'Destreza',
    constitution: 'Constituição', intelligence: 'Inteligência', charisma: 'Carisma', faith: 'Fé',
  };
  const targetId = Object.hasOwn(targetNames, item.bonusTarget) ? item.bonusTarget : '';
  const bonus = Math.max(-99, Math.min(99, Number(item.bonusValue) || 0));
  const targetType = ['strength', 'dexterity', 'constitution', 'intelligence', 'charisma', 'faith'].includes(targetId)
    ? 'attribute'
    : 'stat';
  const weight = Math.max(0, Math.min(9999, Number(item.weight) || 0));
  const summary = sanitizeText(item.description, 8000);
  const metadata = {
    schemaVersion: 1,
    type: 'item',
    itemType: normalizeText(type).replaceAll(' ', '_'),
    armorCategory: normalizeText(armorCategory),
    weight,
    modifiers: targetId && bonus ? [{ targetType, targetId, value: bonus }] : [],
  };
  const bonusLine = targetId && bonus ? `**${targetNames[targetId]}:** ${bonus > 0 ? '+' : ''}${bonus}` : '';
  const description = [
    `# ${name}`,
    '',
    `**Tipo:** ${type}${armorCategory ? ` ${armorCategory}` : ''}`,
    bonusLine,
    `**Peso:** ${weight}`,
    '',
    summary || 'Item criado pelo Mestre.',
    '',
    'O bônus é aplicado somente enquanto o item estiver equipado.',
    '',
    '---',
    'Metadados usados automaticamente pelos aplicativos. Edite com cuidado.',
    '<!-- RPG_RULES_JSON_START -->',
    JSON.stringify(metadata, null, 2),
    '<!-- RPG_RULES_JSON_END -->',
  ].filter((line) => line !== '').join('\n');
  return {
    name,
    listName: 'Equipamentos',
    description,
    imageUrl: String(item.imageUrl || '').trim(),
    labels: type === 'Armadura'
      ? [['Armadura', 'blue'], [`Armadura ${armorCategory}`, armorCategory === 'Leve' ? 'green' : armorCategory === 'Média' ? 'yellow' : armorCategory === 'Pesada' ? 'red' : 'purple']]
      : [[`Tipo: ${type}`, type === 'Arma' ? 'red' : type === 'Consumível' ? 'green' : type === 'Artefato' ? 'purple' : 'blue']],
  };
}

function spellDefinition(raw) {
  const spell = raw && typeof raw === 'object' ? raw : {};
  const name = String(spell.name || '').trim();
  if (name.length < 2 || name.length > 120) {
    throw new AppError('A magia precisa ter um nome entre 2 e 120 caracteres.', 400);
  }
  const school = ['Arcana', 'Divina', 'Espectral', 'Elemental', 'Demoníaca', 'Natural', 'Outra'].includes(spell.school)
    ? spell.school
    : 'Outra';
  const level = Math.max(0, Math.min(20, Number(spell.level) || 0));
  const manaCost = Math.max(0, Math.min(999, Number(spell.manaCost) || 0));
  const focusCost = Math.max(0, Math.min(999, Number(spell.focusCost) || 0));
  const humanityCost = Math.max(0, Math.min(999, Number(spell.humanityCost) || 0));
  const topic = sanitizeText(spell.topic, 80);
  const className = sanitizeText(spell.className, 80);
  const actionType = ['spectral_arrow', 'spectral_infusion'].includes(spell.actionType)
    ? spell.actionType
    : '';
  const actionId = sanitizeText(spell.actionId, 80);
  const range = sanitizeText(spell.range, 120);
  const damage = sanitizeText(spell.damage, 120);
  const summary = sanitizeText(spell.description, 8000);
  const metadata = {
    schemaVersion: 1,
    type: 'spell',
    school: normalizeText(school),
    level,
    costs: { mana: manaCost, focus: focusCost, humanity: humanityCost },
    topic,
    className,
    actionType,
    actionId,
    range,
    damage,
  };
  const description = [
    `# ${name}`,
    '',
    `**Tipo:** ${school}`,
    `**Nível:** ${level}`,
    topic ? `**Tópico:** ${topic}` : '',
    className ? `**Classe:** ${className}` : '',
    `**Custo:** ${manaCost} PM${focusCost ? ` · ${focusCost} Foco` : ''}${humanityCost ? ` · ${humanityCost} Humanidade` : ''}`,
    range ? `**Alcance:** ${range}` : '',
    damage ? `**Dano/Efeito:** ${damage}` : '',
    '',
    summary || 'Magia criada pelo Mestre.',
    '',
    '---',
    'Metadados usados automaticamente pelos aplicativos. Edite com cuidado.',
    '<!-- RPG_RULES_JSON_START -->',
    JSON.stringify(metadata, null, 2),
    '<!-- RPG_RULES_JSON_END -->',
  ].filter((line) => line !== '').join('\n');
  return {
    name,
    listName: 'Magias',
    description,
    imageUrl: String(spell.imageUrl || '').trim(),
    labels: [
      ['Magia', 'purple'],
      [`Magia: ${school}`, school === 'Divina' ? 'yellow' : school === 'Natural' ? 'green' : school === 'Demoníaca' ? 'red' : 'blue'],
      ...(topic ? [[topic, level >= 3 ? 'red' : level === 2 ? 'orange' : 'green']] : []),
    ],
  };
}

async function listCharacters() {
  return listCharactersFromDatabase();
}

async function getCharacter(id) {
  return getCharacterFromDatabase(id);
}

async function saveCharacter(character, options = {}) {
  if (!character || !character.id) throw new AppError('Personagem sem id.', 400);
  return enqueueCharacterWrite(character.id, async () => {
    const current = await getCharacterFromDatabase(character.id);
    const merged = mergeCharacterUpdate(current, character, options.changedFields);
    const currentRevision = Number(current?.syncRevision || 0);
    const incomingRevision = Number(character.syncRevision || options.baseRevision || 0);
    const persisted = prepareCharacterForStorage({
      ...merged,
      id: character.id,
      syncRevision: Math.max(currentRevision, incomingRevision) + 1,
      updatedAt: new Date().toISOString(),
    });
    return saveCharacterToDatabase(persisted, options.changedFields || []);
  });
}

async function deleteCharacter(id) {
  await deleteCharacterFromDatabase(id);
}

function enqueueCharacterWrite(characterId, task) {
  const previous = characterWriteQueues.get(characterId) || Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  characterWriteQueues.set(characterId, next);
  return next.finally(() => {
    if (characterWriteQueues.get(characterId) === next) characterWriteQueues.delete(characterId);
  });
}

export function mergeCharacterUpdate(current, incoming, changedFields) {
  if (!current || !Array.isArray(changedFields) || changedFields.length === 0) {
    return { ...(current || {}), ...incoming };
  }
  const result = { ...current };
  for (const field of changedFields.slice(0, 80)) {
    if (field === 'id' || field === 'syncRevision' || field === 'createdAt') continue;
    if (Object.hasOwn(incoming, field)) result[field] = incoming[field];
  }
  return result;
}

export function prepareCharacterForStorage(raw) {
  const character = JSON.parse(JSON.stringify(raw));
  delete character.modifiers;
  character.name = sanitizeText(character.name, 120);
  character.playerName = sanitizeText(character.playerName, 120);
  character.background = sanitizeText(character.background, 2000);
  character.lore = sanitizeText(character.lore, 12000);
  character.notes = compactStrings(character.notes, 100, 1000);
  character.manualProficiencies = compactStrings(character.manualProficiencies, 200, 240);
  character.manualAbilities = compactStrings(character.manualAbilities, 200, 400);
  character.rollHistory = compactHistory(character.rollHistory, 100);
  character.levelHistory = compactHistory(character.levelHistory, 100);
  character.classXpHistory = compactHistory(character.classXpHistory, 100);
  character.experienceHistory = compactHistory(character.experienceHistory, 200);
  character.humanityHistory = compactHistory(character.humanityHistory, 100);
  character.corruptionHistory = compactHistory(character.corruptionHistory, 100);
  character.actionHistory = compactHistory(character.actionHistory, 200);
  character.inventory = compactInventory(character.inventory);
  character.equipment = compactInventory(character.equipment);
  return character;
}

function compactHistory(values, limit) {
  return Array.isArray(values) ? values.slice(0, limit) : [];
}

function compactStrings(values, limit, maxLength) {
  return Array.isArray(values)
    ? values.slice(0, limit).map((value) => sanitizeText(value, maxLength)).filter(Boolean)
    : [];
}

function compactInventory(values) {
  if (!Array.isArray(values)) return [];
  return values.slice(0, 500).map((item) => {
    const compact = { ...item };
    for (const key of ['name', 'type', 'bonus', 'description', 'notes', 'requirements']) {
      if (compact[key] !== undefined) compact[key] = sanitizeText(compact[key], key === 'description' ? 2000 : 240);
    }
    return compact;
  });
}

function labelId(name) {
  return `label_${normalizeText(name).replace(/[^a-z0-9]+/g, '_')}`;
}

function normalizeText(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function sanitizeText(value, maxLength = 4000) {
  return String(value || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .slice(0, maxLength)
    .trim();
}
