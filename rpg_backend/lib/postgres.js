import { Pool } from 'pg';

let pool = null;
let schemaReady = null;

export function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);
}

export function getPool() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL precisa estar configurada para usar o Supabase/Postgres.');
  }
  pool = new Pool({
    connectionString,
    ssl: process.env.DATABASE_SSL === 'false'
      ? false
      : { rejectUnauthorized: false },
    max: Number(process.env.DATABASE_POOL_MAX || 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  return pool;
}

export async function query(text, params = []) {
  await ensureSchema();
  return getPool().query(text, params);
}

export async function rawQuery(text, params = []) {
  return getPool().query(text, params);
}

export async function transaction(callback) {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function ensureSchema() {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    await rawQuery('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    await rawQuery(`
      CREATE TABLE IF NOT EXISTS rpg_settings (
        key text PRIMARY KEY,
        value jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS rpg_users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text NOT NULL,
        display_name text NOT NULL DEFAULT '',
        password_hash text NOT NULL,
        role text NOT NULL DEFAULT 'player',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz,
        CONSTRAINT rpg_users_role_check CHECK (role IN ('player', 'admin'))
      );

      CREATE UNIQUE INDEX IF NOT EXISTS rpg_users_email_unique
        ON rpg_users (lower(email))
        WHERE deleted_at IS NULL;

      CREATE TABLE IF NOT EXISTS auth_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES rpg_users(id) ON DELETE CASCADE,
        token_hash text NOT NULL UNIQUE,
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        last_seen_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS auth_sessions_user_idx
        ON auth_sessions (user_id, expires_at DESC);

      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES rpg_users(id) ON DELETE CASCADE,
        token_hash text NOT NULL UNIQUE,
        expires_at timestamptz NOT NULL,
        used_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx
        ON password_reset_tokens (user_id, expires_at DESC);

      CREATE TABLE IF NOT EXISTS catalog_categories (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL UNIQUE,
        position numeric NOT NULL DEFAULT 0,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS catalog_entries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        category_id uuid NOT NULL REFERENCES catalog_categories(id) ON DELETE RESTRICT,
        name text NOT NULL,
        description text NOT NULL DEFAULT '',
        labels jsonb NOT NULL DEFAULT '[]'::jsonb,
        image_url text NOT NULL DEFAULT '',
        attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        source_url text NOT NULL DEFAULT '',
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS catalog_entries_unique_active_name
        ON catalog_entries (category_id, lower(name))
        WHERE is_active;

      CREATE INDEX IF NOT EXISTS catalog_entries_category_idx
        ON catalog_entries (category_id)
        WHERE is_active;

      CREATE INDEX IF NOT EXISTS catalog_entries_metadata_idx
        ON catalog_entries USING gin (metadata);

      CREATE TABLE IF NOT EXISTS characters (
        id text PRIMARY KEY,
        owner_user_id uuid REFERENCES rpg_users(id) ON DELETE SET NULL,
        name text NOT NULL,
        data jsonb NOT NULL,
        visibility text NOT NULL DEFAULT 'public',
        summary jsonb NOT NULL DEFAULT '{}'::jsonb,
        sync_revision integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz,
        CONSTRAINT characters_visibility_check CHECK (visibility IN ('public', 'private'))
      );

      ALTER TABLE characters ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES rpg_users(id) ON DELETE SET NULL;
      ALTER TABLE characters ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';
      ALTER TABLE characters ADD COLUMN IF NOT EXISTS summary jsonb NOT NULL DEFAULT '{}'::jsonb;

      CREATE INDEX IF NOT EXISTS characters_active_idx
        ON characters (updated_at DESC)
        WHERE deleted_at IS NULL;

      CREATE INDEX IF NOT EXISTS characters_owner_idx
        ON characters (owner_user_id, updated_at DESC)
        WHERE deleted_at IS NULL;

      CREATE INDEX IF NOT EXISTS characters_public_idx
        ON characters (updated_at DESC)
        WHERE deleted_at IS NULL AND visibility = 'public';

      CREATE TABLE IF NOT EXISTS character_revisions (
        id bigserial PRIMARY KEY,
        character_id text NOT NULL,
        sync_revision integer NOT NULL,
        changed_fields text[] NOT NULL DEFAULT '{}'::text[],
        data jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS character_revisions_character_idx
        ON character_revisions (character_id, sync_revision DESC);

      CREATE TABLE IF NOT EXISTS catalog_entry_revisions (
        id bigserial PRIMARY KEY,
        entry_id uuid,
        action text NOT NULL,
        snapshot jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
  })();
  return schemaReady;
}

export async function closePool() {
  if (!pool) return;
  await pool.end();
  pool = null;
  schemaReady = null;
}
