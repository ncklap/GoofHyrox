-- Run in Supabase → SQL Editor (fixes "Database error saving new user" from RLS/schema)
-- Safe to run multiple times after editing policies.

-- 1) Table (adjust if you already have profiles — skip create if it exists)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  email text,
  race_date date,
  gender text,
  height_cm numeric,
  weight_kg numeric,
  hyrox_race_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Let API roles use the table
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;

-- 3) RLS
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
drop policy if exists "profiles_select_all" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

-- Leaderboard loads all profiles → any signed-in user can read rows
create policy "profiles_select_authenticated"
  on public.profiles
  for select
  to authenticated
  using (true);

-- First-time name setup: insert your own row only
create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

-- Profile edits
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- In case profiles table already exists without the new columns,
-- add them safely (run multiple times).
alter table public.profiles
  add column if not exists gender text,
  add column if not exists height_cm numeric,
  add column if not exists weight_kg numeric,
  add column if not exists hyrox_race_type text;
