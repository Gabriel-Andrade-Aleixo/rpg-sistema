const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787';

async function request(path, options = {}) {
  const response = await fetch(`${backendUrl}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
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

export async function listCharacters() {
  const data = await request('/characters');
  return data.characters || [];
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
