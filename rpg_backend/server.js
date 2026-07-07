import http from 'node:http';
import fs from 'node:fs';

loadDotEnv();

const PORT = Number(process.env.PORT || 8787);
const TRELLO_API_KEY = process.env.TRELLO_API_KEY || '';
const TRELLO_TOKEN = process.env.TRELLO_TOKEN || '';
const TRELLO_BOARD_NAME = process.env.TRELLO_BOARD_NAME || 'GERENCIAMENTO RPG';
const TRELLO_BOARD_ID = process.env.TRELLO_BOARD_ID || '';
const TRELLO_BASE_URL = 'https://api.trello.com';
const TRELLO_DESCRIPTION_LIMIT = 16384;
const SAFE_DESCRIPTION_LIMIT = 15800;
const characterWriteQueues = new Map();

let resolvedBoardId = TRELLO_BOARD_ID;
let charactersListId = '';
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
      return sendJson(res, 200, { ok: true, backend: 'rpg-backend' });
    }

    if (req.method === 'POST' && path === '/setup') {
      await setupBoardCatalogs();
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
    if (size > 1024 * 1024) throw new AppError('Requisição maior que 1 MB.', 413);
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function assertTrelloConfigured() {
  if (!TRELLO_API_KEY || !TRELLO_TOKEN) {
    throw new Error('TRELLO_API_KEY e TRELLO_TOKEN precisam estar configurados.');
  }
}

async function trello(method, path, query = {}) {
  assertTrelloConfigured();
  const url = new URL(path, TRELLO_BASE_URL);
  url.searchParams.set('key', TRELLO_API_KEY);
  url.searchParams.set('token', TRELLO_TOKEN);
  const options = { method };
  if (method === 'GET' || method === 'DELETE') {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
  } else {
    options.headers = { 'Content-Type': 'application/json; charset=utf-8' };
    options.body = JSON.stringify(query);
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, options);
    const text = await response.text();
    if (response.ok) return text ? JSON.parse(text) : null;
    if ((response.status === 429 || response.status >= 500) && attempt < 2) {
      const retryAfter = Number(response.headers.get('retry-after')) || 0;
      await delay(Math.max(retryAfter * 1000, 350 * (2 ** attempt)));
      continue;
    }
    const descError = response.status === 400 && /invalid value for desc/i.test(text);
    throw new AppError(
      descError
        ? 'A ficha excedeu o limite aceito pelo Trello mesmo após a compactação.'
        : `Trello respondeu ${response.status}: ${text}`,
      descError ? 413 : 502,
    );
  }
  throw new AppError('O Trello não respondeu após três tentativas.', 503);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

async function ensureBoard() {
  if (resolvedBoardId) return resolvedBoardId;

  const boards = await trello('GET', '/1/members/me/boards', {
    fields: 'name,closed',
  });
  const existing = boards.find((board) => board.name === TRELLO_BOARD_NAME && !board.closed);
  if (existing) {
    resolvedBoardId = existing.id;
    return resolvedBoardId;
  }

  const created = await trello('POST', '/1/boards', {
    name: TRELLO_BOARD_NAME,
    defaultLists: 'false',
    desc: 'Quadro central do sistema de RPG.',
  });
  resolvedBoardId = created.id;
  return resolvedBoardId;
}

async function ensureList(name) {
  if (name === 'Personagens' && charactersListId) return charactersListId;
  const boardId = await ensureBoard();
  const lists = await trello('GET', `/1/boards/${boardId}/lists`, {
    fields: 'name,closed',
  });
  const existing = lists.find((list) => list.name === name && !list.closed);
  if (existing) {
    if (name === 'Personagens') charactersListId = existing.id;
    return existing.id;
  }
  const created = await trello('POST', '/1/lists', { idBoard: boardId, name });
  if (name === 'Personagens') charactersListId = created.id;
  return created.id;
}

async function setupBoardCatalogs() {
  await ensureList('Personagens');
  await ensureList('Itens');
  await ensureList('Equipamentos');
  await ensureList('Criaturas e Monstros');
  await ensureList('Racas');
  await ensureList('Classes');
  await ensureList('Habilidades');
  await ensureList('Magias');
  await ensureList('Proficiências');
  await ensureList('Atributos');
  await ensureList('Perícias');
  await ensureList('Sistema');
}

async function loadCatalog(forceRefresh = false) {
  const maxAgeMs = 5 * 60 * 1000;
  if (!forceRefresh && catalogCache && Date.now() - catalogCachedAt < maxAgeMs) {
    return catalogCache;
  }

  const boardId = await ensureBoard();
  const [board, lists, cards] = await Promise.all([
    trello('GET', `/1/boards/${boardId}`, { fields: 'name,url,dateLastActivity' }),
    trello('GET', `/1/boards/${boardId}/lists`, { fields: 'name,closed,pos' }),
    trello('GET', `/1/boards/${boardId}/cards`, {
      fields: 'name,desc,idList,labels,closed,url,idAttachmentCover,dateLastActivity',
      attachments: 'true',
      attachment_fields: 'name,url,previews,mimeType',
      limit: '1000',
    }),
  ]);

  const activeLists = lists.filter((list) => !list.closed);
  const entries = cards
    .filter((card) => !card.closed)
    .map((card) => {
      const list = activeLists.find((item) => item.id === card.idList);
      if (!list) return null;
      const attachments = (card.attachments || []).map((attachment) => ({
        id: attachment.id,
        name: attachment.name || '',
        url: attachment.url || '',
        mimeType: attachment.mimeType || '',
        previewUrl: largestPreviewUrl(attachment.previews || []),
      }));
      const cover = attachments.find((attachment) => attachment.id === card.idAttachmentCover);
      const firstImage = attachments.find((attachment) =>
        attachment.mimeType.startsWith('image/') || attachment.previewUrl,
      );
      return {
        id: card.id,
        name: card.name,
        description: card.desc || '',
        category: list.name,
        categoryId: list.id,
        labels: (card.labels || []).map((label) => ({
          id: label.id,
          name: label.name || '',
          color: label.color || '',
        })),
        imageUrl: cover?.previewUrl || cover?.url || firstImage?.previewUrl || firstImage?.url || '',
        attachments,
        sourceUrl: card.url || '',
        updatedAt: card.dateLastActivity || null,
      };
    })
    .filter(Boolean);

  catalogCache = {
    board: {
      id: boardId,
      name: board.name,
      url: board.url,
      updatedAt: board.dateLastActivity || null,
    },
    categories: activeLists.map((list) => ({ id: list.id, name: list.name, position: list.pos })),
    entries,
    fetchedAt: new Date().toISOString(),
  };
  catalogCachedAt = Date.now();
  return catalogCache;
}

async function createCatalogEntry(kind, raw) {
  const definition = await catalogEntryDefinition(kind, raw);
  const listId = await ensureList(definition.listName);
  await assertUniqueCatalogName(listId, definition.name);
  const labelIds = await ensureCatalogLabels(definition.labels);
  const card = await trello('POST', '/1/cards', {
    idList: listId,
    name: definition.name,
    desc: definition.description,
    idLabels: labelIds.join(','),
  });
  await replaceCardImage(card.id, [], definition.imageUrl, definition.name);
  return refreshedCatalogEntry(card.id);
}

async function updateCatalogEntry(kind, id, raw) {
  const current = await requireCatalogEntry(kind, id);
  const definition = await catalogEntryDefinition(kind, raw);
  const listId = await ensureList(definition.listName);
  await assertUniqueCatalogName(listId, definition.name, id);
  const labelIds = await ensureCatalogLabels(definition.labels);
  await trello('PUT', `/1/cards/${id}`, {
    name: definition.name,
    desc: definition.description,
    idLabels: labelIds.join(','),
  });
  await replaceCardImage(id, current.attachments || [], definition.imageUrl, definition.name);
  return refreshedCatalogEntry(id);
}

async function deleteCatalogEntry(kind, id) {
  await requireCatalogEntry(kind, id);
  await trello('PUT', `/1/cards/${id}`, { closed: 'true' });
  catalogCache = null;
}

async function requireCatalogEntry(kind, id) {
  const catalog = await loadCatalog(true);
  const entry = catalog.entries.find((item) => item.id === id);
  const allowedCategories = kind === 'spell' ? ['magias'] : ['itens', 'equipamentos'];
  if (!entry || !allowedCategories.some((category) => normalizeText(entry.category) === category)) {
    throw new Error(`${kind === 'spell' ? 'Magia' : 'Item'} não encontrado no catálogo oficial.`);
  }
  return entry;
}

async function assertUniqueCatalogName(listId, name, ignoredId = '') {
  const cards = await trello('GET', `/1/lists/${listId}/cards`, {
    fields: 'name,closed',
    limit: 1000,
  });
  if (cards.some((card) => card.id !== ignoredId && !card.closed && normalizeText(card.name) === normalizeText(name))) {
    throw new Error(`Já existe uma entrada chamada ${name} nessa lista do Trello.`);
  }
}

async function refreshedCatalogEntry(id) {
  catalogCache = null;
  const catalog = await loadCatalog(true);
  return catalog.entries.find((entry) => entry.id === id) || null;
}

async function replaceCardImage(cardId, attachments, imageUrl, name) {
  const nextUrl = String(imageUrl || '').trim();
  const currentImages = attachments.filter((attachment) =>
    String(attachment.mimeType || '').startsWith('image/') || attachment.previewUrl,
  );
  if (currentImages.some((attachment) => attachment.url === nextUrl || attachment.previewUrl === nextUrl)) return;
  for (const attachment of currentImages) {
    await trello('DELETE', `/1/cards/${cardId}/attachments/${attachment.id}`);
  }
  if (/^https?:\/\//i.test(nextUrl)) {
    await trello('POST', `/1/cards/${cardId}/attachments`, {
      url: nextUrl,
      name: `${name} - imagem`,
      setCover: true,
    });
  }
}

async function catalogEntryDefinition(kind, raw) {
  return kind === 'spell' ? spellDefinition(raw) : itemDefinition(raw);
}

function itemDefinition(raw) {
  const item = raw && typeof raw === 'object' ? raw : {};
  const name = String(item.name || '').trim();
  if (name.length < 2 || name.length > 120) {
    throw new Error('O item precisa ter um nome entre 2 e 120 caracteres.');
  }
  const type = ['Armadura', 'Arma', 'Consumível', 'Artefato', 'Outro'].includes(item.type)
    ? item.type
    : 'Outro';
  const armorCategory = type === 'Armadura' && ['Leve', 'Média', 'Pesada', 'Escudo'].includes(item.armorCategory)
    ? item.armorCategory
    : '';
  if (type === 'Armadura' && !armorCategory) {
    throw new Error('Selecione a categoria da armadura.');
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
  const summary = String(item.description || '').trim().slice(0, 4000);
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
    throw new Error('A magia precisa ter um nome entre 2 e 120 caracteres.');
  }
  const school = ['Arcana', 'Divina', 'Espectral', 'Elemental', 'Demoníaca', 'Natural', 'Outra'].includes(spell.school)
    ? spell.school
    : 'Outra';
  const level = Math.max(0, Math.min(20, Number(spell.level) || 0));
  const manaCost = Math.max(0, Math.min(999, Number(spell.manaCost) || 0));
  const focusCost = Math.max(0, Math.min(999, Number(spell.focusCost) || 0));
  const humanityCost = Math.max(0, Math.min(999, Number(spell.humanityCost) || 0));
  const topic = String(spell.topic || '').trim().slice(0, 80);
  const className = String(spell.className || '').trim().slice(0, 80);
  const actionType = ['spectral_arrow', 'spectral_infusion'].includes(spell.actionType)
    ? spell.actionType
    : '';
  const actionId = String(spell.actionId || '').trim().slice(0, 80);
  const range = String(spell.range || '').trim().slice(0, 120);
  const damage = String(spell.damage || '').trim().slice(0, 120);
  const summary = String(spell.description || '').trim().slice(0, 4000);
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

async function ensureCatalogLabels(definitions) {
  const boardId = await ensureBoard();
  const existing = await trello('GET', `/1/boards/${boardId}/labels`, {
    fields: 'name,color',
    limit: 1000,
  });
  const result = [];
  for (const [name, color] of definitions) {
    const found = existing.find((label) => normalizeText(label.name) === normalizeText(name));
    result.push(found?.id || (await trello('POST', '/1/labels', { idBoard: boardId, name, color })).id);
  }
  return result;
}

function normalizeText(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function largestPreviewUrl(previews) {
  if (!previews.length) return '';
  return [...previews].sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url || '';
}

async function listCharacters() {
  const listId = await ensureList('Personagens');
  const cards = await trello('GET', `/1/lists/${listId}/cards`, {
    fields: 'name,desc,closed',
    limit: '1000',
  });
  return cards.map(characterFromCard).filter(Boolean);
}

async function getCharacter(id) {
  const characters = await listCharacters();
  return characters.find((character) => character.id === id) || null;
}

async function saveCharacter(character, options = {}) {
  if (!character || !character.id) throw new Error('Personagem sem id.');
  return enqueueCharacterWrite(character.id, async () => {
    const listId = await ensureList('Personagens');
    const card = await findCharacterCard(character.id);
    const current = card ? characterFromCard(card) : null;
    const merged = mergeCharacterUpdate(current, character, options.changedFields);
    const currentRevision = Number(current?.syncRevision || 0);
    const incomingRevision = Number(character.syncRevision || options.baseRevision || 0);
    const persisted = prepareCharacterForStorage({
      ...merged,
      id: character.id,
      syncRevision: Math.max(currentRevision, incomingRevision) + 1,
      updatedAt: new Date().toISOString(),
    });
    const description = characterDescription(persisted);
    const payload = {
      name: sanitizeText(persisted.name || 'Personagem sem nome', 120),
      desc: description,
    };
    if (card) {
      await trello('PUT', `/1/cards/${card.id}`, payload);
    } else {
      await trello('POST', '/1/cards', { idList: listId, ...payload });
    }
    return persisted;
  });
}

async function deleteCharacter(id) {
  const card = await findCharacterCard(id);
  if (card) await trello('PUT', `/1/cards/${card.id}`, { closed: 'true' });
}

async function findCharacterCard(id) {
  const listId = await ensureList('Personagens');
  const cards = await trello('GET', `/1/lists/${listId}/cards`, {
    fields: 'name,desc,closed',
    limit: '1000',
  });
  return cards.find((card) => characterFromCard(card)?.id === id) || null;
}

function characterFromCard(card) {
  const match = String(card.desc || '').match(
    /<!-- RPG_CHARACTER_JSON_START -->([\s\S]*?)<!-- RPG_CHARACTER_JSON_END -->/,
  );
  if (!match) return null;
  try {
    return JSON.parse(match[1].trim());
  } catch {
    return null;
  }
}

function characterDescription(character) {
  const header = [
    `# ${sanitizeText(character.name || 'Personagem sem nome', 120)}`,
    `**Jogador:** ${sanitizeText(character.playerName || '', 120)}`,
    `**Raça:** ${sanitizeText(character.raceId || '', 120)}${character.raceVariant ? ` · ${sanitizeText(character.raceVariant, 80)}` : ''}`,
    `**Classe:** ${sanitizeText(character.classId || '', 120)}`,
    `**Nível:** ${Number(character.level || 1)}`,
    `**Revisão:** ${Number(character.syncRevision || 0)}`,
    '',
    'Dados estruturados usados pelos aplicativos:',
    '<!-- RPG_CHARACTER_JSON_START -->',
  ].join('\n');
  const footer = '\n<!-- RPG_CHARACTER_JSON_END -->';
  const description = `${header}${JSON.stringify(character)}${footer}`;
  if (description.length > TRELLO_DESCRIPTION_LIMIT) {
    throw new AppError('A ficha continua maior que o limite do Trello.', 413, {
      characters: description.length,
      limit: TRELLO_DESCRIPTION_LIMIT,
    });
  }
  return description;
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
  character.background = sanitizeText(character.background, 500);
  character.lore = sanitizeText(character.lore, 2500);
  character.notes = compactStrings(character.notes, 20, 500);
  character.manualProficiencies = compactStrings(character.manualProficiencies, 80, 160);
  character.manualAbilities = compactStrings(character.manualAbilities, 80, 240);
  character.rollHistory = compactHistory(character.rollHistory, 12);
  character.levelHistory = compactHistory(character.levelHistory, 12);
  character.classXpHistory = compactHistory(character.classXpHistory, 12);
  character.experienceHistory = compactHistory(character.experienceHistory, 12);
  character.humanityHistory = compactHistory(character.humanityHistory, 12);
  character.actionHistory = compactHistory(character.actionHistory, 20);
  character.inventory = compactInventory(character.inventory);
  character.equipment = compactInventory(character.equipment);

  let description = characterDescriptionUnchecked(character);
  if (description.length > SAFE_DESCRIPTION_LIMIT) {
    character.rollHistory = compactHistory(character.rollHistory, 5);
    character.classXpHistory = compactHistory(character.classXpHistory, 5);
    character.experienceHistory = compactHistory(character.experienceHistory, 5);
    character.humanityHistory = compactHistory(character.humanityHistory, 5);
    character.actionHistory = compactHistory(character.actionHistory, 8);
    character.levelHistory = compactHistory(character.levelHistory, 8);
    description = characterDescriptionUnchecked(character);
  }
  if (description.length > SAFE_DESCRIPTION_LIMIT) {
    character.lore = sanitizeText(character.lore, 1000);
    character.notes = compactStrings(character.notes, 8, 240);
    character.rollHistory = [];
    character.classXpHistory = [];
    character.experienceHistory = [];
    character.humanityHistory = [];
    character.actionHistory = compactHistory(character.actionHistory, 5);
    description = characterDescriptionUnchecked(character);
  }
  if (description.length > SAFE_DESCRIPTION_LIMIT) {
    throw new AppError('A ficha possui dados demais para o limite do Trello.', 413, {
      characters: description.length,
      limit: SAFE_DESCRIPTION_LIMIT,
    });
  }
  return character;
}

function characterDescriptionUnchecked(character) {
  const fixedOverhead = 400;
  return 'x'.repeat(fixedOverhead) + JSON.stringify(character);
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
  return values.slice(0, 200).map((item) => {
    const compact = { ...item };
    for (const key of ['name', 'type', 'bonus', 'description', 'notes', 'requirements']) {
      if (compact[key] !== undefined) compact[key] = sanitizeText(compact[key], key === 'description' ? 800 : 240);
    }
    if (compact.catalogId) {
      delete compact.description;
      delete compact.imageUrl;
    }
    return compact;
  });
}

function sanitizeText(value, maxLength = 4000) {
  return String(value || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .slice(0, maxLength)
    .trim();
}
