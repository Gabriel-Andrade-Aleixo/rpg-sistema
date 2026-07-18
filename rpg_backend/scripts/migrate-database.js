import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { closePool, getPool } from '../lib/postgres.js';

loadDotEnv();

const migrationsDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../supabase/migrations',
);

if (!fs.existsSync(migrationsDirectory)) {
  throw new Error(`Diretório de migrações não encontrado: ${migrationsDirectory}`);
}

const client = await getPool().connect();
try {
  await client.query(`
    create table if not exists public.rpg_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);
  const files = fs.readdirSync(migrationsDirectory)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  for (const name of files) {
    const applied = await client.query(
      'select 1 from public.rpg_migrations where name = $1',
      [name],
    );
    if (applied.rowCount) continue;

    await client.query('begin');
    try {
      await client.query("select pg_advisory_xact_lock(hashtext('runalith_database_migrations'))");
      const alreadyApplied = await client.query(
        'select 1 from public.rpg_migrations where name = $1',
        [name],
      );
      if (!alreadyApplied.rowCount) {
        await client.query(fs.readFileSync(path.join(migrationsDirectory, name), 'utf8'));
        await client.query(
          'insert into public.rpg_migrations (name) values ($1) on conflict do nothing',
          [name],
        );
        console.log(`Migração aplicada: ${name}`);
      }
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  }
} finally {
  client.release();
  await closePool();
}

function loadDotEnv() {
  const envPath = new URL('../.env', import.meta.url);
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index < 1) continue;
    const key = trimmed.slice(0, index).trim();
    if (!process.env[key]) process.env[key] = trimmed.slice(index + 1).trim();
  }
}
