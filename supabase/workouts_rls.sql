-- Create workouts table + RLS policies
-- Run in Supabase SQL editor. Safe to run multiple times.

create extension if not exists pgcrypto;

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Activity workouts (running/strength stations)
  activity_id text,
  value numeric,
  hard boolean,
  distance_km numeric,
  distance_m numeric,
  duration_seconds integer,
  pace_per_unit numeric,
  station_weight_lbs numeric,
  station_weight_kg numeric,
  station_reps integer,

  -- Lift workouts
  is_lift boolean not null default false,
  lift_id text,
  heavy boolean,
  lift_weight_kg numeric,
  lift_sets integer,
  lift_reps integer,

  -- Hyrox workouts
  is_hyrox boolean not null default false,
  hyrox_length text,
  hyrox_intensity text,

  logged_at timestamptz not null default now()
);

-- Permissions for authenticated app users
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.workouts to authenticated;

-- Enable RLS and restrict rows to the owning user
alter table public.workouts enable row level security;

drop policy if exists "workouts_select_own" on public.workouts;
drop policy if exists "workouts_insert_own" on public.workouts;
drop policy if exists "workouts_update_own" on public.workouts;
drop policy if exists "workouts_delete_own" on public.workouts;

create policy "workouts_select_own"
  on public.workouts
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "workouts_insert_own"
  on public.workouts
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "workouts_update_own"
  on public.workouts
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "workouts_delete_own"
  on public.workouts
  for delete
  to authenticated
  using (auth.uid() = user_id);

create index if not exists workouts_user_logged_at_idx
  on public.workouts (user_id, logged_at desc);

alter table public.workouts
  add column if not exists distance_km numeric,
  add column if not exists distance_m numeric,
  add column if not exists duration_seconds integer,
  add column if not exists pace_per_unit numeric,
  add column if not exists station_weight_lbs numeric,
  add column if not exists station_weight_kg numeric,
  add column if not exists station_reps integer;

