-- Run this entire file once in Supabase Dashboard → SQL Editor.
-- It creates one private JSON state row per authenticated HealthAI user.

create table if not exists public.user_app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_app_state enable row level security;

revoke all on table public.user_app_state from anon;
grant select, insert, update, delete on table public.user_app_state to authenticated;

drop policy if exists "Users can read their own HealthAI state" on public.user_app_state;
create policy "Users can read their own HealthAI state"
on public.user_app_state
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own HealthAI state" on public.user_app_state;
create policy "Users can create their own HealthAI state"
on public.user_app_state
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own HealthAI state" on public.user_app_state;
create policy "Users can update their own HealthAI state"
on public.user_app_state
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own HealthAI state" on public.user_app_state;
create policy "Users can delete their own HealthAI state"
on public.user_app_state
for delete
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.set_healthai_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_healthai_user_app_state_updated_at on public.user_app_state;
create trigger set_healthai_user_app_state_updated_at
before update on public.user_app_state
for each row
execute function public.set_healthai_updated_at();

create index if not exists user_app_state_updated_at_idx
on public.user_app_state(updated_at desc);
