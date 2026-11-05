-- =====================================================================
--  Stash — migration 2026-11-05 #01
--  Notes: quick text notes (typed in the app or sent from the iPhone
--  "Stash Note" / "Save to Stash" Shortcuts through quick-save).
--
--  HOW TO RUN: Supabase → SQL Editor → New query → paste this whole
--  file → Run. Run it AFTER setup.sql and the 20261104_… files.
--  Safe to run more than once: it only adds what is missing and never
--  deletes your data.
--
--  What it does:
--   1. New table notes (one row per note, at most 5,000 characters).
--   2. Row Level Security: each user can only read, add, change and
--      delete their OWN notes. (The quick-save Edge Function writes with
--      the server-only service role, for the user in STASH_OWNER_USER_ID.)
-- =====================================================================

-- ---------- 1. notes ---------------------------------------------------

create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body        text not null check (char_length(btrim(body)) between 1 and 5000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists notes_user_idx on public.notes (user_id, created_at desc);

drop trigger if exists notes_touch on public.notes;
create trigger notes_touch before update on public.notes
  for each row execute function public.touch_updated_at();

-- ---------- 2. Row Level Security --------------------------------------

alter table public.notes enable row level security;

drop policy if exists "own notes - select" on public.notes;
drop policy if exists "own notes - insert" on public.notes;
drop policy if exists "own notes - update" on public.notes;
drop policy if exists "own notes - delete" on public.notes;
create policy "own notes - select" on public.notes
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own notes - insert" on public.notes
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own notes - update" on public.notes
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own notes - delete" on public.notes
  for delete to authenticated using (user_id = (select auth.uid()));

-- Logged-out visitors get nothing at all
revoke all on public.notes from anon;
grant select, insert, update, delete on public.notes to authenticated;
