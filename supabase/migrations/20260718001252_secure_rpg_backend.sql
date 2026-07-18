create extension if not exists pgcrypto;

create table if not exists public.rpg_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists public.rpg_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rpg_users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  display_name text not null default '',
  password_hash text not null,
  role text not null default 'player',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint rpg_users_role_check check (role in ('player', 'admin'))
);

create unique index if not exists rpg_users_email_unique
  on public.rpg_users (lower(email)) where deleted_at is null;

create table if not exists public.auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.rpg_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists auth_sessions_user_idx
  on public.auth_sessions (user_id, expires_at desc);

create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.rpg_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists password_reset_tokens_user_idx
  on public.password_reset_tokens (user_id, expires_at desc);

create table if not exists public.catalog_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  position numeric not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_entries (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.catalog_categories(id) on delete restrict,
  name text not null,
  description text not null default '',
  labels jsonb not null default '[]'::jsonb,
  image_url text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  source_url text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists catalog_entries_unique_active_name
  on public.catalog_entries (category_id, lower(name)) where is_active;
create index if not exists catalog_entries_category_idx
  on public.catalog_entries (category_id) where is_active;
create index if not exists catalog_entries_metadata_idx
  on public.catalog_entries using gin (metadata);

create table if not exists public.characters (
  id text primary key,
  owner_user_id uuid references public.rpg_users(id) on delete set null,
  name text not null,
  data jsonb not null,
  visibility text not null default 'public',
  summary jsonb not null default '{}'::jsonb,
  sync_revision integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint characters_visibility_check check (visibility in ('public', 'private'))
);

alter table public.characters
  add column if not exists owner_user_id uuid references public.rpg_users(id) on delete set null,
  add column if not exists visibility text not null default 'public',
  add column if not exists summary jsonb not null default '{}'::jsonb;

create index if not exists characters_active_idx
  on public.characters (updated_at desc) where deleted_at is null;
create index if not exists characters_owner_idx
  on public.characters (owner_user_id, updated_at desc) where deleted_at is null;
create index if not exists characters_public_idx
  on public.characters (updated_at desc)
  where deleted_at is null and visibility = 'public';

create table if not exists public.character_revisions (
  id bigserial primary key,
  character_id text not null,
  sync_revision integer not null,
  changed_fields text[] not null default '{}'::text[],
  data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists character_revisions_character_idx
  on public.character_revisions (character_id, sync_revision desc);

create table if not exists public.catalog_entry_revisions (
  id bigserial primary key,
  entry_id uuid,
  action text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid references public.rpg_users(id) on delete set null,
  mime_type text not null,
  byte_size integer not null,
  content bytea not null,
  alt_text text not null default '',
  created_at timestamptz not null default now(),
  constraint media_assets_mime_check
    check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')),
  constraint media_assets_size_check
    check (byte_size > 0 and byte_size <= 2097152)
);

create index if not exists media_assets_uploaded_by_idx
  on public.media_assets (uploaded_by, created_at desc);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'character_revisions_character_fk') then
    alter table public.character_revisions
      add constraint character_revisions_character_fk
      foreign key (character_id) references public.characters(id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'catalog_entry_revisions_entry_fk') then
    alter table public.catalog_entry_revisions
      add constraint catalog_entry_revisions_entry_fk
      foreign key (entry_id) references public.catalog_entries(id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'characters_sync_revision_check') then
    alter table public.characters
      add constraint characters_sync_revision_check check (sync_revision >= 0) not valid;
  end if;
end $$;

alter table public.rpg_migrations enable row level security;
alter table public.rpg_settings enable row level security;
alter table public.rpg_users enable row level security;
alter table public.auth_sessions enable row level security;
alter table public.password_reset_tokens enable row level security;
alter table public.catalog_categories enable row level security;
alter table public.catalog_entries enable row level security;
alter table public.characters enable row level security;
alter table public.character_revisions enable row level security;
alter table public.catalog_entry_revisions enable row level security;
alter table public.media_assets enable row level security;

revoke all on table public.rpg_migrations from anon, authenticated, service_role;
revoke all on table public.rpg_settings from anon, authenticated, service_role;
revoke all on table public.rpg_users from anon, authenticated, service_role;
revoke all on table public.auth_sessions from anon, authenticated, service_role;
revoke all on table public.password_reset_tokens from anon, authenticated, service_role;
revoke all on table public.catalog_categories from anon, authenticated, service_role;
revoke all on table public.catalog_entries from anon, authenticated, service_role;
revoke all on table public.characters from anon, authenticated, service_role;
revoke all on table public.character_revisions from anon, authenticated, service_role;
revoke all on table public.catalog_entry_revisions from anon, authenticated, service_role;
revoke all on table public.media_assets from anon, authenticated, service_role;
revoke all on all sequences in schema public from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, service_role, public;
