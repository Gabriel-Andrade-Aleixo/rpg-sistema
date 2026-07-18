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
    max: Number(process.env.DATABASE_POOL_MAX || (process.env.VERCEL ? 1 : 5)),
    idleTimeoutMillis: Number(process.env.DATABASE_IDLE_TIMEOUT_MS || 10_000),
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
    allowExitOnIdle: true,
  });
  if (process.env.VERCEL && !isTransactionPooler(connectionString)) {
    console.warn('DATABASE_URL não parece usar o Transaction Pooler do Supabase; use a URL da porta 6543 na Vercel.');
  }
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
    const result = await rawQuery(`
      select to_regclass('public.rpg_migrations') as migrations,
             to_regclass('public.characters') as characters,
             to_regclass('public.media_assets') as media_assets
    `);
    const state = result.rows[0] || {};
    if (!state.migrations || !state.characters || !state.media_assets) {
      const error = new Error('Banco sem migrações atuais. Execute npm run db:migrate no backend.');
      error.code = 'RPG_SCHEMA_OUTDATED';
      throw error;
    }
  })();
  return schemaReady;
}

export async function closePool() {
  if (!pool) return;
  await pool.end();
  pool = null;
  schemaReady = null;
}

function isTransactionPooler(connectionString) {
  try {
    const url = new URL(connectionString);
    return url.hostname.endsWith('.pooler.supabase.com') && url.port === '6543';
  } catch {
    return false;
  }
}
