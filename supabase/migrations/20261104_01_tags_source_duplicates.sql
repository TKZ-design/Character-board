-- =====================================================================
--  Character Inspiration Board — migration 2026-11-04 #01
--  Tag management, tag groups, "Source" field, image hashes.
--
--  HOW TO RUN: Supabase → SQL Editor → New query → paste this whole
--  file → Run. Run it AFTER setup.sql (which you already ran once).
--  Safe to run more than once: it only adds what is missing.
--
--  What it does:
--   1. New tables: tag_groups, tags, character_tags (all with Row Level
--      Security: each user only sees their own rows).
--   2. Copies every existing tag from characters.tags into the new
--      tables (case-insensitive: "Mage" and "mage " become one tag),
--      then renames the old column to characters.tags_legacy.
--      Nothing is deleted — the old values stay in tags_legacy.
--   3. Adds characters.source (optional "Original", game, anime…).
--   4. Adds images.sha256 (used to warn about duplicate uploads).
-- =====================================================================

-- ---------- helper: tidy a tag / group name ---------------------------
-- trims, drops a leading "#", squeezes inner whitespace to one space
create or replace function public.clean_tag_name(t text)
returns text language sql immutable as $$
  select regexp_replace(btrim(regexp_replace(coalesce(t, ''), '^\s*#', '')), '\s+', ' ', 'g')
$$;

create or replace function public.clean_name_trigger()
returns trigger language plpgsql as $$
begin
  new.name := public.clean_tag_name(new.name);
  return new;
end $$;

-- ---------- 1. tables -------------------------------------------------

create table if not exists public.tag_groups (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  created_at  timestamptz not null default now()
);

create table if not exists public.tags (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  group_id    uuid references public.tag_groups (id) on delete set null,  -- null = "Ungrouped"
  created_at  timestamptz not null default now()
);

create table if not exists public.character_tags (
  character_id  uuid not null references public.characters (id) on delete cascade,
  tag_id        uuid not null references public.tags (id) on delete cascade,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (character_id, tag_id)
);

-- names are unique per user, ignoring upper/lower case
create unique index if not exists tag_groups_user_name_key on public.tag_groups (user_id, lower(name));
create unique index if not exists tags_user_name_key       on public.tags (user_id, lower(name));
create index if not exists tags_group_idx           on public.tags (group_id);
create index if not exists character_tags_tag_idx   on public.character_tags (tag_id);
create index if not exists character_tags_user_idx  on public.character_tags (user_id);

drop trigger if exists tag_groups_clean_name on public.tag_groups;
create trigger tag_groups_clean_name before insert or update of name on public.tag_groups
  for each row execute function public.clean_name_trigger();
drop trigger if exists tags_clean_name on public.tags;
create trigger tags_clean_name before insert or update of name on public.tags
  for each row execute function public.clean_name_trigger();

-- ---------- Row Level Security ----------------------------------------

alter table public.tag_groups     enable row level security;
alter table public.tags           enable row level security;
alter table public.character_tags enable row level security;

drop policy if exists "own tag groups - select" on public.tag_groups;
drop policy if exists "own tag groups - insert" on public.tag_groups;
drop policy if exists "own tag groups - update" on public.tag_groups;
drop policy if exists "own tag groups - delete" on public.tag_groups;
create policy "own tag groups - select" on public.tag_groups
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own tag groups - insert" on public.tag_groups
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own tag groups - update" on public.tag_groups
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own tag groups - delete" on public.tag_groups
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "own tags - select" on public.tags;
drop policy if exists "own tags - insert" on public.tags;
drop policy if exists "own tags - update" on public.tags;
drop policy if exists "own tags - delete" on public.tags;
create policy "own tags - select" on public.tags
  for select to authenticated using (user_id = (select auth.uid()));
-- a tag can only be put in a group you own
create policy "own tags - insert" on public.tags
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and (group_id is null or exists (select 1 from public.tag_groups g where g.id = group_id and g.user_id = (select auth.uid())))
  );
create policy "own tags - update" on public.tags
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and (group_id is null or exists (select 1 from public.tag_groups g where g.id = group_id and g.user_id = (select auth.uid())))
  );
create policy "own tags - delete" on public.tags
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "own character tags - select" on public.character_tags;
drop policy if exists "own character tags - insert" on public.character_tags;
drop policy if exists "own character tags - delete" on public.character_tags;
create policy "own character tags - select" on public.character_tags
  for select to authenticated using (user_id = (select auth.uid()));
-- you can only link your own character to your own tag
create policy "own character tags - insert" on public.character_tags
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.characters c where c.id = character_id and c.user_id = (select auth.uid()))
    and exists (select 1 from public.tags t where t.id = tag_id and t.user_id = (select auth.uid()))
  );
create policy "own character tags - delete" on public.character_tags
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------- functions the app calls -----------------------------------
-- Both run with the caller's permissions (security invoker), so the
-- Row Level Security rules above still apply inside them.

-- Replace a character's tags with the given names, creating missing tags
-- (matched case-insensitively). Returns the character's tags afterwards.
create or replace function public.set_character_tags(p_character_id uuid, p_names text[])
returns setof public.tags
language plpgsql security invoker set search_path = ''
as $$
declare
  uid    uuid := auth.uid();
  wanted text[];  -- cleaned names, one per case-insensitive key (first spelling wins)
  keys   text[];
begin
  if uid is null then raise exception 'Not logged in'; end if;
  if not exists (select 1 from public.characters c where c.id = p_character_id and c.user_id = uid) then
    raise exception 'Character not found';
  end if;

  select coalesce(array_agg(d.n), '{}') into wanted
  from (
    select distinct on (lower(s.n)) s.n
    from (select public.clean_tag_name(u.x) as n, u.i
          from unnest(coalesce(p_names, '{}')) with ordinality as u(x, i)) s
    where s.n <> ''
    order by lower(s.n), s.i
  ) d;
  keys := array(select lower(n) from unnest(wanted) as n);

  insert into public.tags (user_id, name)
    select uid, n from unnest(wanted) as n
    on conflict (user_id, lower(name)) do nothing;

  delete from public.character_tags ct
    where ct.character_id = p_character_id
      and not exists (select 1 from public.tags t
                      where t.id = ct.tag_id and t.user_id = uid and lower(t.name) = any (keys));

  insert into public.character_tags (user_id, character_id, tag_id)
    select uid, p_character_id, t.id
    from public.tags t
    where t.user_id = uid and lower(t.name) = any (keys)
    on conflict do nothing;

  return query
    select t.* from public.tags t
    join public.character_tags ct on ct.tag_id = t.id
    where ct.character_id = p_character_id and t.user_id = uid;
end $$;

-- Move every character from the source tags onto the target tag, then
-- delete the source tags.
create or replace function public.merge_tags(p_source_ids uuid[], p_target_id uuid)
returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not logged in'; end if;
  if not exists (select 1 from public.tags t where t.id = p_target_id and t.user_id = uid) then
    raise exception 'Target tag not found';
  end if;

  insert into public.character_tags (user_id, character_id, tag_id)
    select uid, ct.character_id, p_target_id
    from public.character_tags ct
    where ct.tag_id = any (p_source_ids) and ct.tag_id <> p_target_id and ct.user_id = uid
    on conflict do nothing;

  delete from public.tags t
    where t.id = any (p_source_ids) and t.id <> p_target_id and t.user_id = uid;
end $$;

revoke execute on function public.set_character_tags(uuid, text[]) from public, anon;
revoke execute on function public.merge_tags(uuid[], uuid) from public, anon;
grant execute on function public.set_character_tags(uuid, text[]) to authenticated;
grant execute on function public.merge_tags(uuid[], uuid) to authenticated;

-- ---------- 2. copy existing tags, then retire the old column ---------
-- Runs only once: afterwards the column is called tags_legacy, so a
-- second run has nothing to copy (and can't bring back deleted tags).
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'characters' and column_name = 'tags') then

    insert into public.tags (user_id, name)
      -- when spellings differ only in case, keep the first one used
      select distinct on (c.user_id, lower(public.clean_tag_name(u.t)))
             c.user_id, public.clean_tag_name(u.t)
      from public.characters c, unnest(c.tags) with ordinality as u(t, i)
      where public.clean_tag_name(u.t) <> ''
      order by c.user_id, lower(public.clean_tag_name(u.t)), c.created_at, u.i
      on conflict (user_id, lower(name)) do nothing;

    insert into public.character_tags (user_id, character_id, tag_id)
      select distinct c.user_id, c.id, tg.id
      from public.characters c
      cross join unnest(c.tags) as t
      join public.tags tg on tg.user_id = c.user_id and lower(tg.name) = lower(public.clean_tag_name(t))
      on conflict do nothing;

    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'characters' and column_name = 'tags_legacy') then
      -- (only possible if someone re-created the old column by hand)
      alter table public.characters drop column tags;
    else
      alter table public.characters rename column tags to tags_legacy;
    end if;
  end if;
end $$;

-- ---------- 3. Source / series ----------------------------------------
alter table public.characters
  add column if not exists source text not null default '' check (char_length(source) <= 200);

-- ---------- 4. image fingerprints (duplicate warning) -----------------
alter table public.images add column if not exists sha256 text;
create index if not exists images_user_sha256_idx on public.images (user_id, sha256);

-- Make the API notice the new tables/columns right away
notify pgrst, 'reload schema';
