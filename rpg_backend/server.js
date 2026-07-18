import http from 'node:http';
import fs from 'node:fs';

import {
  createPasswordReset,
  listUsersForAdmin,
  loginUser,
  logoutToken,
  publicUser,
  registerUser,
  resetPassword,
  setUserPasswordForAdmin,
  userFromBearerHeader,
} from './lib/authStore.js';
import {
  deleteCatalogEntryById,
  defaultCategories,
  ensureCatalogCategories,
  getCharacterForUserFromDatabase,
  listCharactersForAdminFromDatabase,
  insertCatalogEntry,
  listOwnedCharactersFromDatabase,
  listPublicCharacterSummariesFromDatabase,
  loadCatalogFromDatabase,
  metadataFromDescription,
  normalizeVisibility,
  saveCharacterToDatabase,
  deleteCharacterForUserFromDatabase,
  transferCharacterOwnershipInDatabase,
  updateCatalogEntryById,
  replaceMetadataBlock,
} from './lib/catalogStore.js';
import { validateAndNormalizeCharacter } from './lib/characterRules.js';
import { clearRateLimit, enforceRateLimit, requestIp } from './lib/rateLimit.js';
import { createMediaAsset, deleteMediaAsset, getMediaAsset } from './lib/mediaStore.js';

loadDotEnv();

const PORT = Number(process.env.PORT || 8787);
let catalogCache = null;
let catalogCachedAt = 0;

export async function requestHandler(req, res) {
  if (!setCorsHeaders(req, res)) {
    return sendJson(res, 403, { ok: false, error: 'Origem não autorizada.' });
  }

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

    if (req.method === 'POST' && path === '/auth/register') {
      const body = await readJson(req);
      await limitAuthentication(req, 'register', body.email, 4, 60 * 60);
      const auth = await registerUser(body);
      return sendJson(res, 201, { ok: true, user: publicUser(auth.user), token: auth.token, expiresAt: auth.expiresAt });
    }

    if (req.method === 'POST' && path === '/auth/login') {
      const body = await readJson(req);
      await limitAuthentication(req, 'login', body.email, 8, 15 * 60);
      const auth = await loginUser(body);
      await clearRateLimit('login:email', String(body.email || '').trim().toLowerCase().slice(0, 180));
      return sendJson(res, 200, { ok: true, user: publicUser(auth.user), token: auth.token, expiresAt: auth.expiresAt });
    }

    if (req.method === 'GET' && path === '/auth/me') {
      const user = await currentUser(req);
      return sendJson(res, 200, { ok: true, user: publicUser(user) });
    }

    if (req.method === 'POST' && path === '/auth/logout') {
      await logoutToken(req.headers.authorization);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'POST' && path === '/auth/password/request') {
      const body = await readJson(req);
      await limitAuthentication(req, 'password_request', body.email, 4, 60 * 60);
      const reset = await createPasswordReset(body);
      return sendJson(res, 200, {
        ok: true,
        delivered: reset.delivered,
        emailConfigured: reset.emailConfigured,
        ...(reset.resetToken ? { resetToken: reset.resetToken, resetUrl: reset.resetUrl } : {}),
      });
    }

    if (req.method === 'POST' && path === '/auth/password/reset') {
      const body = await readJson(req);
      await enforceRateLimit('password_reset:ip', requestIp(req), {
        maximum: 8,
        windowSeconds: 60 * 60,
      });
      await resetPassword(body);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'POST' && path === '/setup') {
      await requireAdmin(req);
      await setupDatabaseCatalogs();
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'GET' && path === '/admin/users') {
      await requireAdmin(req);
      return sendJson(res, 200, { ok: true, users: (await listUsersForAdmin()).map(publicUser) });
    }

    const adminPasswordMatch = path.match(/^\/admin\/users\/([^/]+)\/password$/);
    if (adminPasswordMatch && req.method === 'PUT') {
      await requireAdmin(req);
      const body = await readJson(req);
      const reset = await setUserPasswordForAdmin({
        userId: decodeURIComponent(adminPasswordMatch[1]),
        password: body.password,
      });
      return sendJson(res, 200, {
        ok: true,
        user: publicUser(reset.user),
        sessionsRemoved: reset.sessionsRemoved,
      });
    }

    if (req.method === 'GET' && path === '/admin/characters') {
      await requireAdmin(req);
      return sendJson(res, 200, { ok: true, characters: await listCharactersForAdminFromDatabase() });
    }

    const adminOwnerMatch = path.match(/^\/admin\/characters\/([^/]+)\/owner$/);
    if (adminOwnerMatch && req.method === 'PUT') {
      await requireAdmin(req);
      const body = await readJson(req);
      const ownerUserId = String(body.ownerUserId || '').trim();
      if (!ownerUserId) throw new AppError('Selecione o novo dono da ficha.', 400);
      const character = await transferCharacterOwnershipInDatabase(
        decodeURIComponent(adminOwnerMatch[1]),
        ownerUserId,
      );
      return sendJson(res, 200, { ok: true, character });
    }

    if (req.method === 'GET' && path === '/catalog') {
      const refresh = url.searchParams.get('refresh') === 'true';
      return sendJson(res, 200, { ok: true, catalog: await loadCatalog(refresh) });
    }

    const mediaMatch = path.match(/^\/media\/([0-9a-f-]{36})$/i);
    if (mediaMatch && req.method === 'GET') {
      const asset = await getMediaAsset(mediaMatch[1]);
      if (!asset) throw new AppError('Imagem não encontrada.', 404);
      res.writeHead(200, {
        'Content-Type': asset.mime_type,
        'Content-Length': asset.byte_size,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(asset.content);
      return;
    }

    if (req.method === 'POST' && path === '/media') {
      const admin = await requireAdmin(req);
      const body = await readJson(req);
      const asset = await createMediaAsset({ ...body, uploadedBy: admin.id });
      return sendJson(res, 201, { ok: true, asset: { ...asset, url: mediaUrl(req, asset.id) } });
    }

    if (mediaMatch && req.method === 'DELETE') {
      await requireAdmin(req);
      await deleteMediaAsset(mediaMatch[1]);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'POST' && path === '/catalog/entries') {
      await requireAdmin(req);
      const entry = await createGenericCatalogEntry((await readJson(req)).entry);
      return sendJson(res, 201, { ok: true, entry });
    }

    const genericCatalogMatch = path.match(/^\/catalog\/entries\/([^/]+)$/);
    if (genericCatalogMatch && req.method === 'PUT') {
      await requireAdmin(req);
      const entry = await updateGenericCatalogEntry(
        decodeURIComponent(genericCatalogMatch[1]),
        (await readJson(req)).entry,
      );
      return sendJson(res, 200, { ok: true, entry });
    }

    if (genericCatalogMatch && req.method === 'DELETE') {
      await requireAdmin(req);
      await deleteCatalogEntryById(decodeURIComponent(genericCatalogMatch[1]));
      catalogCache = null;
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'POST' && path === '/catalog/items') {
      await requireAdmin(req);
      const body = await readJson(req);
      const item = await createCatalogEntry('item', body.item);
      return sendJson(res, 201, { ok: true, item });
    }

    if (req.method === 'POST' && path === '/catalog/spells') {
      await requireAdmin(req);
      const body = await readJson(req);
      const spell = await createCatalogEntry('spell', body.spell);
      return sendJson(res, 201, { ok: true, spell });
    }

    const catalogMatch = path.match(/^\/catalog\/(items|spells)\/([^/]+)$/);
    if (catalogMatch && req.method === 'PUT') {
      await requireAdmin(req);
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
      await requireAdmin(req);
      const kind = catalogMatch[1] === 'spells' ? 'spell' : 'item';
      await deleteCatalogEntry(kind, decodeURIComponent(catalogMatch[2]));
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'GET' && path === '/characters') {
      const user = await requireUser(req);
      const result = await listCharacters(user);
      return sendJson(res, 200, { ok: true, ...result });
    }

    if (req.method === 'GET' && path === '/characters/public') {
      const user = await currentUser(req);
      return sendJson(res, 200, { ok: true, characters: await listPublicCharacterSummariesFromDatabase(user?.id || '') });
    }

    const characterMatch = path.match(/^\/characters\/([^/]+)$/);
    if (characterMatch && req.method === 'GET') {
      const user = await requireUser(req);
      const character = await getCharacter(decodeURIComponent(characterMatch[1]), user);
      return sendJson(res, 200, { ok: true, character });
    }

    if (req.method === 'POST' && path === '/characters') {
      const user = await requireUser(req);
      const body = await readJson(req);
      const character = await saveCharacter(body.character, user, {
        baseRevision: body.baseRevision,
        changedFields: body.changedFields,
      });
      return sendJson(res, 200, { ok: true, character });
    }

    if (characterMatch && req.method === 'DELETE') {
      const user = await requireUser(req);
      await deleteCharacter(decodeURIComponent(characterMatch[1]), user);
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 404, { ok: false, error: 'Rota nao encontrada.' });
  } catch (error) {
    const statusCode = error?.statusCode || 500;
    if (statusCode >= 500) console.error(error);
    return sendJson(res, statusCode, {
      ok: false,
      error: publicErrorMessage(error, statusCode),
      ...(statusCode < 500 && error?.details ? { details: error.details } : {}),
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

function setCorsHeaders(req, res) {
  const origin = String(req.headers.origin || '').trim();
  const allowed = new Set(String(process.env.ALLOWED_ORIGINS || 'http://localhost:3000,https://rpg-sistema-liart.vercel.app')
    .split(',').map((value) => value.trim()).filter(Boolean));
  let accepted = !origin || allowed.has(origin);
  if (!process.env.VERCEL && origin) {
    try {
      accepted ||= ['localhost', '127.0.0.1'].includes(new URL(origin).hostname);
    } catch {
      accepted = false;
    }
  }
  if (origin && accepted) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  return accepted;
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function publicErrorMessage(error, statusCode) {
  if (isDatabaseConnectionError(error)) {
    return 'Banco de dados indisponível. Verifique a DATABASE_URL do backend.';
  }
  if (statusCode >= 500) return 'Erro interno no servidor.';
  return error instanceof Error ? error.message : String(error);
}

function isDatabaseConnectionError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || error || '');
  return ['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'ENETUNREACH'].includes(code)
    || /getaddrinfo|supabase\.co|database|postgres/i.test(message);
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
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new AppError('O corpo da requisição contém JSON inválido.', 400);
  }
}

class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

async function currentUser(req) {
  return userFromBearerHeader(req.headers.authorization);
}

async function requireUser(req) {
  const user = await currentUser(req);
  if (!user) throw new AppError('Faça login para continuar.', 401);
  return user;
}

async function requireAdmin(req) {
  const user = await requireUser(req);
  if (user.role !== 'admin') throw new AppError('Apenas o Mestre pode gerenciar esta área.', 403);
  return user;
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

async function createGenericCatalogEntry(raw) {
  const definition = genericCatalogDefinition(raw);
  const entry = await insertCatalogEntry(definition.category, definition.payload);
  catalogCache = null;
  return entry;
}

async function updateGenericCatalogEntry(id, raw) {
  const definition = genericCatalogDefinition(raw);
  const entry = await updateCatalogEntryById(id, definition.category, definition.payload);
  catalogCache = null;
  return entry;
}

function genericCatalogDefinition(raw) {
  const value = raw && typeof raw === 'object' ? raw : {};
  const category = defaultCategories.find((name) => normalizeText(name) === normalizeText(value.category));
  if (!category || category === 'Personagens') throw new AppError('Selecione uma categoria de catálogo válida.', 400);
  const name = sanitizeText(value.name, 120);
  if (name.length < 2) throw new AppError('O cadastro precisa ter um nome entre 2 e 120 caracteres.', 400);
  let description = sanitizeText(value.description, 50000);
  const metadata = value.metadata && typeof value.metadata === 'object' && !Array.isArray(value.metadata)
    ? structuredClone(value.metadata)
    : metadataFromDescription(description);
  if (JSON.stringify(metadata).length > 50000) throw new AppError('Os metadados excedem o limite de 50 KB.', 413);
  if (Object.keys(metadata).length) description = replaceMetadataBlock(description || `# ${name}`, metadata);
  const colors = new Set(['yellow', 'purple', 'blue', 'red', 'green', 'orange', 'black', 'sky', 'pink', 'lime']);
  const rawLabels = Array.isArray(value.labels) ? value.labels : String(value.labels || '').split(',');
  const labels = rawLabels.slice(0, 20).map((label, index) => typeof label === 'object'
    ? { id: labelId(label.name || `etiqueta_${index}`), name: sanitizeText(label.name, 80), color: colors.has(label.color) ? label.color : 'blue' }
    : { id: labelId(label), name: sanitizeText(label, 80), color: 'blue' })
    .filter((label) => label.name);
  return {
    category,
    payload: { name, description, imageUrl: safeImageUrl(value.imageUrl), labels, metadata },
  };
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
    imageUrl: safeImageUrl(item.imageUrl),
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
    imageUrl: safeImageUrl(spell.imageUrl),
    labels: [
      ['Magia', 'purple'],
      [`Magia: ${school}`, school === 'Divina' ? 'yellow' : school === 'Natural' ? 'green' : school === 'Demoníaca' ? 'red' : 'blue'],
      ...(topic ? [[topic, level >= 3 ? 'red' : level === 2 ? 'orange' : 'green']] : []),
    ],
  };
}

async function listCharacters(user) {
  return {
    characters: await listOwnedCharactersFromDatabase(user.id),
    publicCharacters: await listPublicCharacterSummariesFromDatabase(user.id),
  };
}

async function getCharacter(id, user) {
  return getCharacterForUserFromDatabase(id, user.id);
}

async function saveCharacter(character, user, options = {}) {
  if (!character || !character.id) throw new AppError('Personagem sem id.', 400);
  const catalog = await loadCatalog();
  const baseRevision = Number.isInteger(options.baseRevision)
    ? options.baseRevision
    : Number(character.syncRevision || 0);
  return saveCharacterToDatabase(
    character,
    options.changedFields || [],
    user.id,
    {
      baseRevision,
      prepare: (merged) => validateAndNormalizeCharacter(prepareCharacterForStorage({
        ...merged,
        id: character.id,
        ownerUserId: user.id,
        visibility: normalizeVisibility(merged.visibility || merged.isPrivate),
        isPrivate: normalizeVisibility(merged.visibility || merged.isPrivate) === 'private',
        updatedAt: new Date().toISOString(),
      }), catalog),
    },
  );
}

async function deleteCharacter(id, user) {
  const deleted = await deleteCharacterForUserFromDatabase(id, user.id);
  if (!deleted) throw new AppError('Ficha não encontrada nas suas fichas.', 404);
}

async function limitAuthentication(req, scope, email, maximum, windowSeconds) {
  const normalizedEmail = String(email || '').trim().toLowerCase().slice(0, 180) || 'empty';
  await Promise.all([
    enforceRateLimit(`${scope}:ip`, requestIp(req), { maximum: maximum * 2, windowSeconds }),
    enforceRateLimit(`${scope}:email`, normalizedEmail, { maximum, windowSeconds }),
  ]);
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
  character.rollHistory = compactHistory(character.rollHistory, 30);
  character.levelHistory = compactHistory(character.levelHistory, 100);
  character.classXpHistory = compactHistory(character.classXpHistory, 100);
  character.experienceHistory = compactHistory(character.experienceHistory, 200);
  character.humanityHistory = compactHistory(character.humanityHistory, 100);
  character.corruptionHistory = compactHistory(character.corruptionHistory, 100);
  character.actionHistory = compactHistory(character.actionHistory, 200);
  character.inventory = compactInventory(character.inventory);
  character.equipment = compactInventory(character.equipment);
  character.visibility = normalizeVisibility(character.visibility || character.isPrivate);
  character.isPrivate = character.visibility === 'private';
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

function safeImageUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocol');
    return url.toString().slice(0, 2000);
  } catch {
    throw new AppError('A imagem precisa usar uma URL HTTP segura ou ser enviada pelo sistema.', 400);
  }
}

function mediaUrl(req, id) {
  const protocol = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || 'http';
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  return `${protocol}://${host}/media/${id}`;
}
