-- Create lift_sets table + RLS policies
-- Run in Supabase SQL editor. Safe to run multiple times.

create extension if not exists pgcrypto;

create table if not exists public.lift_sets (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  set_number integer not null check (set_number >= 1),
  weight_kg numeric not null check (weight_kg >= 0),
  reps integer not null check (reps >= 1),
  created_at timestamptz not null default now()
);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.lift_sets to authenticated;

alter table public.lift_sets enable row level security;

drop policy if exists "lift_sets_select_own" on public.lift_sets;
drop policy if exists "lift_sets_insert_own" on public.lift_sets;
drop policy if exists "lift_sets_update_own" on public.lift_sets;
drop policy if exists "lift_sets_delete_own" on public.lift_sets;

create policy "lift_sets_select_own"
  on public.lift_sets
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "lift_sets_insert_own"
  on public.lift_sets
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "lift_sets_update_own"
  on public.lift_sets
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "lift_sets_delete_own"
  on public.lift_sets
  for delete
  to authenticated
  using (auth.uid() = user_id);

create index if not exists lift_sets_workout_set_idx
  on public.lift_sets (workout_id, set_number);

create index if not exists lift_sets_user_created_idx
  on public.lift_sets (user_id, created_at desc);
