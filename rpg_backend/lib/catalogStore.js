import { query, transaction } from './postgres.js';

export const defaultCategories = [
  'Personagens',
  'Itens',
  'Equipamentos',
  'Criaturas e Monstros',
  'Racas',
  'Classes',
  'Habilidades',
  'Magias',
  'Proficiências',
  'Atributos',
  'Perícias',
  'Sistema',
];

export async function ensureCatalogCategories(categories = defaultCategories) {
  let position = 1;
  for (const name of categories) {
    await query(
      `INSERT INTO catalog_categories (name, position)
       VALUES ($1, $2)
       ON CONFLICT (name)
       DO UPDATE SET is_active = true, position = EXCLUDED.position, updated_at = now()`,
      [name, position],
    );
    position += 1;
  }
}

export async function loadCatalogFromDatabase() {
  await ensureCatalogCategories();
  const [{ rows: categoryRows }, { rows: entryRows }, { rows: updatedRows }] = await Promise.all([
    query(
      `SELECT id, name, position, updated_at
       FROM catalog_categories
       WHERE is_active
       ORDER BY position, name`,
    ),
    query(
      `SELECT e.id, e.name, e.description, e.labels, e.image_url, e.attachments,
              e.metadata, e.source_url, e.updated_at, c.id AS category_id, c.name AS category
       FROM catalog_entries e
       JOIN catalog_categories c ON c.id = e.category_id
       WHERE e.is_active AND c.is_active
       ORDER BY c.position, e.name`,
    ),
    query(
      `SELECT greatest(
        coalesce((SELECT max(updated_at) FROM catalog_categories), 'epoch'::timestamptz),
        coalesce((SELECT max(updated_at) FROM catalog_entries), 'epoch'::timestamptz)
      ) AS updated_at`,
    ),
  ]);

  return {
    board: {
      id: 'postgres',
      name: 'RPG Supabase',
      url: '',
      updatedAt: updatedRows[0]?.updated_at || null,
    },
    categories: categoryRows.map((row) => ({
      id: row.id,
      name: row.name,
      position: Number(row.position),
    })),
    entries: entryRows.map(entryFromRow),
    fetchedAt: new Date().toISOString(),
  };
}

export async function upsertCatalogEntry(categoryName, entry) {
  const normalized = normalizeEntryPayload(entry);
  return transaction(async (client) => {
    const category = await ensureCategoryWithClient(client, categoryName);
    const existing = await client.query(
      `SELECT *
       FROM catalog_entries
       WHERE category_id = $1 AND lower(name) = lower($2) AND is_active
       LIMIT 1`,
      [category.id, normalized.name],
    );
    const snapshot = {
      category: categoryName,
      ...normalized,
    };
    let row;
    if (existing.rows[0]) {
      const updated = await client.query(
        `UPDATE catalog_entries
         SET name = $2, description = $3, labels = $4::jsonb, image_url = $5,
             attachments = $6::jsonb, metadata = $7::jsonb, source_url = $8,
             updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [
          existing.rows[0].id,
          normalized.name,
          normalized.description,
          JSON.stringify(normalized.labels),
          normalized.imageUrl,
          JSON.stringify(normalized.attachments),
          JSON.stringify(normalized.metadata),
          normalized.sourceUrl,
        ],
      );
      row = updated.rows[0];
      await client.query(
        'INSERT INTO catalog_entry_revisions (entry_id, action, snapshot) VALUES ($1, $2, $3::jsonb)',
        [row.id, 'update', JSON.stringify(snapshot)],
      );
    } else {
      const inserted = await client.query(
        `INSERT INTO catalog_entries
           (category_id, name, description, labels, image_url, attachments, metadata, source_url)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6::jsonb, $7::jsonb, $8)
         RETURNING *`,
        [
          category.id,
          normalized.name,
          normalized.description,
          JSON.stringify(normalized.labels),
          normalized.imageUrl,
          JSON.stringify(normalized.attachments),
          JSON.stringify(normalized.metadata),
          normalized.sourceUrl,
        ],
      );
      row = inserted.rows[0];
      await client.query(
        'INSERT INTO catalog_entry_revisions (entry_id, action, snapshot) VALUES ($1, $2, $3::jsonb)',
        [row.id, 'create', JSON.stringify(snapshot)],
      );
    }
    return entryFromRow({ ...row, category_id: category.id, category: category.name });
  });
}

export async function insertCatalogEntry(categoryName, entry) {
  const normalized = normalizeEntryPayload(entry);
  return transaction(async (client) => {
    const category = await ensureCategoryWithClient(client, categoryName);
    const duplicate = await client.query(
      `SELECT id FROM catalog_entries
       WHERE category_id = $1 AND lower(name) = lower($2) AND is_active
       LIMIT 1`,
      [category.id, normalized.name],
    );
    if (duplicate.rows[0]) {
      const error = new Error(`Já existe uma entrada chamada ${normalized.name} nessa categoria.`);
      error.statusCode = 409;
      throw error;
    }
    const inserted = await client.query(
      `INSERT INTO catalog_entries
         (category_id, name, description, labels, image_url, attachments, metadata, source_url)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6::jsonb, $7::jsonb, $8)
       RETURNING *`,
      [
        category.id,
        normalized.name,
        normalized.description,
        JSON.stringify(normalized.labels),
        normalized.imageUrl,
        JSON.stringify(normalized.attachments),
        JSON.stringify(normalized.metadata),
        normalized.sourceUrl,
      ],
    );
    const row = inserted.rows[0];
    await client.query(
      'INSERT INTO catalog_entry_revisions (entry_id, action, snapshot) VALUES ($1, $2, $3::jsonb)',
      [row.id, 'create', JSON.stringify({ category: categoryName, ...normalized })],
    );
    return entryFromRow({ ...row, category_id: category.id, category: category.name });
  });
}

export async function updateCatalogEntryById(id, categoryName, entry) {
  const normalized = normalizeEntryPayload(entry);
  return transaction(async (client) => {
    const category = await ensureCategoryWithClient(client, categoryName);
    const duplicate = await client.query(
      `SELECT id FROM catalog_entries
       WHERE category_id = $1 AND lower(name) = lower($2) AND id <> $3 AND is_active
       LIMIT 1`,
      [category.id, normalized.name, id],
    );
    if (duplicate.rows[0]) {
      const error = new Error(`Já existe uma entrada chamada ${normalized.name} nessa categoria.`);
      error.statusCode = 409;
      throw error;
    }
    const updated = await client.query(
      `UPDATE catalog_entries
       SET category_id = $2, name = $3, description = $4, labels = $5::jsonb,
           image_url = $6, attachments = $7::jsonb, metadata = $8::jsonb,
           source_url = $9, updated_at = now()
       WHERE id = $1 AND is_active
       RETURNING *`,
      [
        id,
        category.id,
        normalized.name,
        normalized.description,
        JSON.stringify(normalized.labels),
        normalized.imageUrl,
        JSON.stringify(normalized.attachments),
        JSON.stringify(normalized.metadata),
        normalized.sourceUrl,
      ],
    );
    if (!updated.rows[0]) {
      const error = new Error('Entrada de catálogo não encontrada.');
      error.statusCode = 404;
      throw error;
    }
    await client.query(
      'INSERT INTO catalog_entry_revisions (entry_id, action, snapshot) VALUES ($1, $2, $3::jsonb)',
      [id, 'update', JSON.stringify({ category: categoryName, ...normalized })],
    );
    return entryFromRow({ ...updated.rows[0], category_id: category.id, category: category.name });
  });
}

export async function deleteCatalogEntryById(id, allowedCategories = []) {
  return transaction(async (client) => {
    const current = await client.query(
      `SELECT e.*, c.name AS category
       FROM catalog_entries e
       JOIN catalog_categories c ON c.id = e.category_id
       WHERE e.id = $1 AND e.is_active`,
      [id],
    );
    const row = current.rows[0];
    if (!row || !allowedCategories.some((item) => normalizeText(item) === normalizeText(row.category))) {
      const error = new Error('Entrada de catálogo não encontrada.');
      error.statusCode = 404;
      throw error;
    }
    await client.query(
      'UPDATE catalog_entries SET is_active = false, updated_at = now() WHERE id = $1',
      [id],
    );
    await client.query(
      'INSERT INTO catalog_entry_revisions (entry_id, action, snapshot) VALUES ($1, $2, $3::jsonb)',
      [id, 'delete', JSON.stringify(row)],
    );
  });
}

export async function listCharactersFromDatabase() {
  const result = await query(
    `SELECT data
     FROM characters
     WHERE deleted_at IS NULL
     ORDER BY updated_at DESC, name`,
  );
  return result.rows.map((row) => row.data).filter(Boolean);
}

export async function listCharactersForAdminFromDatabase() {
  const result = await query(
    `SELECT c.data, c.summary, c.owner_user_id, c.visibility, c.updated_at,
            u.email AS owner_email, u.display_name AS owner_name
     FROM characters c
     LEFT JOIN rpg_users u ON u.id = c.owner_user_id
     WHERE c.deleted_at IS NULL
     ORDER BY c.updated_at DESC, c.name`,
  );
  return result.rows.map(adminCharacterSummary);
}

export async function listOwnedCharactersFromDatabase(userId) {
  const result = await query(
    `SELECT data
     FROM characters
     WHERE deleted_at IS NULL AND owner_user_id = $1
     ORDER BY updated_at DESC, name`,
    [userId],
  );
  return result.rows.map((row) => row.data).filter(Boolean);
}

export async function listPublicCharacterSummariesFromDatabase(userId = '') {
  const result = await query(
    `SELECT c.summary, c.data, c.owner_user_id, u.display_name AS owner_name
     FROM characters c
     LEFT JOIN rpg_users u ON u.id = c.owner_user_id
     WHERE c.deleted_at IS NULL
       AND c.visibility = 'public'
       AND ($1::uuid IS NULL OR c.owner_user_id IS NULL OR c.owner_user_id <> $1::uuid)
     ORDER BY c.updated_at DESC, c.name`,
    [userId || null],
  );
  return result.rows.map((row) => publicCharacterSummary(row.data, row.summary, row.owner_user_id, row.owner_name));
}

export async function getCharacterFromDatabase(id) {
  const result = await query(
    'SELECT data FROM characters WHERE id = $1 AND deleted_at IS NULL',
    [id],
  );
  return result.rows[0]?.data || null;
}

export async function getCharacterForUserFromDatabase(id, userId) {
  const result = await query(
    `SELECT c.data, c.summary, c.owner_user_id, c.visibility, u.display_name AS owner_name
     FROM characters c
     LEFT JOIN rpg_users u ON u.id = c.owner_user_id
     WHERE c.id = $1 AND c.deleted_at IS NULL`,
    [id],
  );
  const row = result.rows[0];
  if (!row) return null;
  if (row.owner_user_id && row.owner_user_id === userId) return row.data;
  if (row.visibility === 'public') {
    return publicCharacterSummary(row.data, row.summary, row.owner_user_id, row.owner_name);
  }
  return null;
}

export async function getCharacterOwnershipFromDatabase(id) {
  const result = await query(
    'SELECT owner_user_id, visibility FROM characters WHERE id = $1 AND deleted_at IS NULL',
    [id],
  );
  return result.rows[0] || null;
}

export async function saveCharacterToDatabase(character, changedFields = [], ownerUserId = null) {
  return transaction(async (client) => {
    const current = await client.query(
      'SELECT owner_user_id FROM characters WHERE id = $1 AND deleted_at IS NULL',
      [character.id],
    );
    const currentOwner = current.rows[0]?.owner_user_id || null;
    const nextOwner = currentOwner || ownerUserId || null;
    const visibility = normalizeVisibility(character.visibility);
    const summary = characterSummary(character, nextOwner);
    const result = await client.query(
      `INSERT INTO characters (id, owner_user_id, name, data, visibility, summary, sync_revision, updated_at, deleted_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6::jsonb, $7, now(), NULL)
       ON CONFLICT (id)
       DO UPDATE SET owner_user_id = coalesce(characters.owner_user_id, EXCLUDED.owner_user_id),
                     name = EXCLUDED.name, data = EXCLUDED.data,
                     visibility = EXCLUDED.visibility, summary = EXCLUDED.summary,
                     sync_revision = EXCLUDED.sync_revision, updated_at = now(),
                     deleted_at = NULL
       RETURNING data`,
      [
        character.id,
        nextOwner,
        character.name || 'Personagem sem nome',
        JSON.stringify(character),
        visibility,
        JSON.stringify(summary),
        Number(character.syncRevision || 0),
      ],
    );
    await client.query(
      `INSERT INTO character_revisions (character_id, sync_revision, changed_fields, data)
       VALUES ($1, $2, $3::text[], $4::jsonb)`,
      [
        character.id,
        Number(character.syncRevision || 0),
        Array.isArray(changedFields) ? changedFields.slice(0, 80) : [],
        JSON.stringify(character),
      ],
    );
    return result.rows[0].data;
  });
}

export async function transferCharacterOwnershipInDatabase(id, nextOwnerUserId) {
  return transaction(async (client) => {
    const owner = await client.query(
      `SELECT id, email, display_name
       FROM rpg_users
       WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [nextOwnerUserId],
    );
    if (!owner.rows[0]) {
      const error = new Error('Novo dono da ficha não encontrado.');
      error.statusCode = 404;
      throw error;
    }
    const current = await client.query(
      `SELECT data, sync_revision
       FROM characters
       WHERE id = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [id],
    );
    const row = current.rows[0];
    if (!row) {
      const error = new Error('Ficha não encontrada.');
      error.statusCode = 404;
      throw error;
    }
    const revision = Math.max(Number(row.sync_revision || 0), Number(row.data?.syncRevision || 0)) + 1;
    const data = {
      ...(row.data || {}),
      ownerUserId: nextOwnerUserId,
      syncRevision: revision,
      updatedAt: new Date().toISOString(),
    };
    const summary = characterSummary(data, nextOwnerUserId);
    const updated = await client.query(
      `UPDATE characters
       SET owner_user_id = $2,
           data = $3::jsonb,
           summary = $4::jsonb,
           sync_revision = $5,
           updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING data, summary, owner_user_id, visibility, updated_at`,
      [id, nextOwnerUserId, JSON.stringify(data), JSON.stringify(summary), revision],
    );
    await client.query(
      `INSERT INTO character_revisions (character_id, sync_revision, changed_fields, data)
       VALUES ($1, $2, $3::text[], $4::jsonb)`,
      [id, revision, ['ownerUserId'], JSON.stringify(data)],
    );
    return adminCharacterSummary({
      ...updated.rows[0],
      owner_email: owner.rows[0].email,
      owner_name: owner.rows[0].display_name,
    });
  });
}

export async function deleteCharacterFromDatabase(id) {
  await query(
    'UPDATE characters SET deleted_at = now(), updated_at = now() WHERE id = $1 AND deleted_at IS NULL',
    [id],
  );
}

export async function deleteCharacterForUserFromDatabase(id, userId) {
  const result = await query(
    `UPDATE characters
     SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND owner_user_id = $2 AND deleted_at IS NULL`,
    [id, userId],
  );
  return result.rowCount > 0;
}

export function characterSummary(character, ownerUserId = null) {
  const data = character && typeof character === 'object' ? character : {};
  const visibility = normalizeVisibility(data.visibility);
  return {
    id: String(data.id || ''),
    name: String(data.name || 'Personagem sem nome').slice(0, 120),
    playerName: String(data.playerName || '').slice(0, 120),
    raceId: String(data.raceId || ''),
    raceVariant: String(data.raceVariant || ''),
    classId: String(data.classId || ''),
    level: Number(data.level || 1),
    imageUrl: String(data.imageUrl || ''),
    visibility,
    isPrivate: visibility === 'private',
    ownerUserId: ownerUserId || data.ownerUserId || '',
    access: 'summary',
    updatedAt: data.updatedAt || null,
  };
}

export function publicCharacterSummary(data, storedSummary = {}, ownerUserId = null, ownerName = '') {
  const summary = {
    ...characterSummary(data, ownerUserId),
    ...(storedSummary && typeof storedSummary === 'object' ? storedSummary : {}),
  };
  return {
    id: summary.id,
    name: summary.name,
    playerName: summary.playerName,
    raceId: summary.raceId,
    raceVariant: summary.raceVariant,
    classId: summary.classId,
    level: summary.level,
    imageUrl: summary.imageUrl,
    visibility: 'public',
    isPrivate: false,
    ownerName: ownerName || '',
    access: 'summary',
    updatedAt: summary.updatedAt || null,
  };
}

function adminCharacterSummary(row) {
  const summary = {
    ...characterSummary(row.data, row.owner_user_id),
    ...(row.summary && typeof row.summary === 'object' ? row.summary : {}),
  };
  return {
    ...summary,
    ownerUserId: row.owner_user_id || summary.ownerUserId || '',
    ownerName: row.owner_name || '',
    ownerEmail: row.owner_email || '',
    visibility: normalizeVisibility(row.visibility || summary.visibility),
    isPrivate: normalizeVisibility(row.visibility || summary.visibility) === 'private',
    access: 'admin',
    updatedAt: row.updated_at || summary.updatedAt || null,
  };
}

export function metadataFromDescription(description) {
  const match = String(description || '').match(
    /<!-- RPG_RULES_JSON_START -->([\s\S]*?)<!-- RPG_RULES_JSON_END -->/,
  );
  if (!match) return {};
  try {
    return JSON.parse(match[1].trim());
  } catch {
    return {};
  }
}

export function replaceMetadataBlock(description, metadata) {
  const start = '<!-- RPG_RULES_JSON_START -->';
  const end = '<!-- RPG_RULES_JSON_END -->';
  const clean = String(description || '').replace(new RegExp(`${start}[\\s\\S]*?${end}`, 'g'), '').trim();
  return `${clean}\n\n---\nMetadados usados automaticamente pelos aplicativos. Edite com cuidado.\n${start}\n${JSON.stringify(metadata, null, 2)}\n${end}`;
}

export function normalizeText(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function normalizeVisibility(value) {
  if (value === true || normalizeText(value) === 'private' || normalizeText(value) === 'privada') {
    return 'private';
  }
  return 'public';
}

function normalizeEntryPayload(entry) {
  const payload = entry && typeof entry === 'object' ? entry : {};
  return {
    name: String(payload.name || '').trim(),
    description: String(payload.description || ''),
    labels: Array.isArray(payload.labels) ? payload.labels : [],
    imageUrl: String(payload.imageUrl || payload.image_url || ''),
    attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
    metadata: payload.metadata && typeof payload.metadata === 'object'
      ? payload.metadata
      : metadataFromDescription(payload.description),
    sourceUrl: String(payload.sourceUrl || payload.source_url || ''),
  };
}

async function ensureCategoryWithClient(client, name) {
  const result = await client.query(
    `INSERT INTO catalog_categories (name, position)
     VALUES ($1, coalesce((SELECT max(position) + 1 FROM catalog_categories), 1))
     ON CONFLICT (name)
     DO UPDATE SET is_active = true, updated_at = now()
     RETURNING id, name`,
    [name],
  );
  return result.rows[0];
}

function entryFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    category: row.category,
    categoryId: row.category_id,
    labels: Array.isArray(row.labels) ? row.labels : [],
    imageUrl: row.image_url || '',
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    metadata: row.metadata || {},
    sourceUrl: row.source_url || '',
    updatedAt: row.updated_at || null,
  };
}
