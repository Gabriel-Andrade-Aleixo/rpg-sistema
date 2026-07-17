const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787';
const sessionKey = 'rpg-auth-session';

let authToken = '';

export function loadStoredSession() {
  if (typeof window === 'undefined') return null;
  try {
    const session = JSON.parse(window.localStorage.getItem(sessionKey) || 'null');
    authToken = session?.token || '';
    return session;
  } catch {
    return null;
  }
}

export function storeSession(session) {
  authToken = session?.token || '';
  if (typeof window !== 'undefined') {
    if (session?.token) window.localStorage.setItem(sessionKey, JSON.stringify(session));
    else window.localStorage.removeItem(sessionKey);
  }
}

export function clearSession() {
  storeSession(null);
}

async function request(path, options = {}) {
  const response = await fetch(`${backendUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: `Backend respondeu em formato inválido (${response.status}).` };
  }
  if (!response.ok || data.ok !== true) {
    const error = new Error(data.error || `Backend respondeu ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function register({ email, password, displayName }) {
  const data = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, displayName }),
  });
  const session = { user: data.user, token: data.token, expiresAt: data.expiresAt };
  storeSession(session);
  return session;
}

export async function login({ email, password }) {
  const data = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const session = { user: data.user, token: data.token, expiresAt: data.expiresAt };
  storeSession(session);
  return session;
}

export async function me() {
  const data = await request('/auth/me');
  return data.user || null;
}

export async function logout() {
  try {
    if (authToken) await request('/auth/logout', { method: 'POST', body: '{}' });
  } finally {
    clearSession();
  }
}

export async function requestPasswordReset(email) {
  return request('/auth/password/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword({ token, password }) {
  return request('/auth/password/reset', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
}

export async function listCharacters() {
  const data = await request('/characters');
  return { characters: data.characters || [], publicCharacters: data.publicCharacters || [] };
}

export async function loadCatalog(refresh = false) {
  const data = await request(`/catalog${refresh ? '?refresh=true' : ''}`);
  return data.catalog || { entries: [], categories: [] };
}

export async function createCatalogItem(item) {
  const data = await request('/catalog/items', {
    method: 'POST',
    body: JSON.stringify({ item }),
  });
  if (!data.item?.id) throw new Error('O backend não confirmou o item criado.');
  return data.item;
}

export async function createCatalogSpell(spell) {
  const data = await request('/catalog/spells', {
    method: 'POST',
    body: JSON.stringify({ spell }),
  });
  if (!data.spell?.id) throw new Error('O backend não confirmou a magia criada.');
  return data.spell;
}

export async function updateCatalogEntry(kind, id, entry) {
  const resource = kind === 'spell' ? 'spells' : 'items';
  const data = await request(`/catalog/${resource}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ [kind]: entry }),
  });
  if (!data[kind]?.id) throw new Error('O backend não confirmou a alteração.');
  return data[kind];
}

export async function deleteCatalogEntry(kind, id) {
  const resource = kind === 'spell' ? 'spells' : 'items';
  return request(`/catalog/${resource}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function saveCharacter(character, { baseRevision, changedFields } = {}) {
  const data = await request('/characters', {
    method: 'POST',
    body: JSON.stringify({
      character: { ...character, updatedAt: new Date().toISOString() },
      ...(Number.isInteger(baseRevision) ? { baseRevision } : {}),
      ...(changedFields?.length ? { changedFields } : {}),
    }),
  });
  if (!data.character?.id) throw new Error('O backend não confirmou a ficha salva.');
  return data.character;
}

export async function deleteCharacter(id) {
  return request(`/characters/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
