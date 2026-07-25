-- Minimal Supabase-compatible shim so the repo's migrations can run against a
-- plain Postgres 16 cluster. This exists ONLY to let `supabase gen types` read
-- the resulting public schema — the generated file covers `public` alone, and
-- cross-schema foreign keys into auth/storage are not emitted, so nothing here
-- can leak into the output.
--
-- Mirrors just enough of the real platform: the auth.users table the migrations
-- reference by FK, auth.uid() used by every RLS policy, and the storage
-- buckets/objects tables plus storage.foldername() used by 00018.

-- gen_random_uuid() is core in Postgres 13+; pgcrypto is deliberately NOT
-- installed. Real Supabase puts extensions in an `extensions` schema, so
-- installing it into `public` here would leak dearmor/gen_salt/pgp_* into the
-- generated Functions block.

create schema if not exists auth;
create schema if not exists storage;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  created_at timestamptz not null default now()
);

-- Real signature returns the JWT subject; a stable stub is enough for policy
-- definitions to compile and for the catalog to record them.
create or replace function auth.uid() returns uuid
  language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create or replace function auth.role() returns text
  language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  owner uuid,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  metadata jsonb,
  path_tokens text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table storage.objects enable row level security;

-- Splits an object path into its folder segments; 00018 keys its owner-scoped
-- policies on the first segment.
create or replace function storage.foldername(name text) returns text[]
  language plpgsql immutable
  as $$
begin
  return string_to_array(regexp_replace(name, '/[^/]*$', ''), '/');
end
$$;

-- PostgREST's roles, referenced by `to authenticated` / grants in the migrations.
do $$ begin
  create role anon nologin noinherit;
exception when duplicate_object then null; end $$;
do $$ begin
  create role authenticated nologin noinherit;
exception when duplicate_object then null; end $$;
do $$ begin
  create role service_role nologin noinherit bypassrls;
exception when duplicate_object then null; end $$;
