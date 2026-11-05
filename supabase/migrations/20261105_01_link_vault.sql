-- =====================================================================
--  Personal hub — migration 2026-11-05 #01
--  The Link Vault: saved links with tags, notes, status and links to
--  characters.
--
--  HOW TO RUN: Supabase → SQL Editor → New query → paste this whole
--  file → Run. Run it AFTER setup.sql and 20261104_01_….sql.
--  Safe to run more than once: it only adds what is missing and never
--  deletes your data.
--
--  What it does:
--   1. New table `links` (one row per saved link).
--   2. New tables `link_tags` (reuses your existing tags & tag groups)
--      and `link_characters` (which characters a link belongs to).
--   3. Row Level Security on all three: each user only sees their own.
--   4. Functions the app calls: set_link_tags, set_link_characters.
--   5. Updates merge_tags so merging tags also moves them on links.
--  Custom link thumbnails go into the SAME private storage bucket as
--  character images (folder <your-user-id>/links/…), which is already
--  protected by the rules in setup.sql — nothing to change there.
-- =====================================================================

-- ---------- 1. links ----------------------------------------------------
create table if not exists public.links (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  url                text not null check (char_length(url) between 1 and 2048 and url ~* '^https?://'),
  url_key            text not null default '' check (char_length(url_key) <= 2048), -- normalised, for the duplicate warning
  platform           text not null default 'web' check (char_length(platform) between 1 and 30),
  title              text not null default '' check (char_length(title) <= 500),
  description        text not null default '' check (char_length(description) <= 2000),
  site_name          text not null default '' check (char_length(site_name) <= 200),
  notes              text not null default '',
  status             text not null default 'todo' check (status in ('todo', 'done')),
  is_favorite        boolean not null default false,
  thumbnail_url      text check (thumbnail_url is null or (char_length(thumbnail_url) <= 2048 and thumbnail_url ~* '^https?://')),
  image_path         text,   -- your own cover ("Set thumbnail"), in the storage bucket
  image_thumb_path   text,
  image_width        int,
  image_height       int,
  preview_status     text check (preview_status in ('ok', 'none', 'error')), -- null = not fetched yet
  preview_fetched_at timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists links_user_idx     on public.links (user_id, created_at desc);
create index if not exists links_user_key_idx on public.links (user_id, url_key);

drop trigger if exists links_touch on public.links;
create trigger links_touch before update on public.links
  for each row execute function public.touch_updated_at();

-- ---------- 2. link ↔ tag, link ↔ character -----------------------------
create table if not exists public.link_tags (
  link_id     uuid not null references public.links (id) on delete cascade,
  tag_id      uuid not null references public.tags (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (link_id, tag_id)
);
create index if not exists link_tags_tag_idx  on public.link_tags (tag_id);
create index if not exists link_tags_user_idx on public.link_tags (user_id);

create table if not exists public.link_characters (
  link_id       uuid not null references public.links (id) on delete cascade,
  character_id  uuid not null references public.characters (id) on delete cascade,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (link_id, character_id)
);
create index if not exists link_characters_char_idx on public.link_characters (character_id);
create index if not exists link_characters_user_idx on public.link_characters (user_id);

-- ---------- 3. Row Level Security ---------------------------------------
alter table public.links           enable row level security;
alter table public.link_tags       enable row level security;
alter table public.link_characters enable row level security;

drop policy if exists "own links - select" on public.links;
drop policy if exists "own links - insert" on public.links;
drop policy if exists "own links - update" on public.links;
drop policy if exists "own links - delete" on public.links;
create policy "own links - select" on public.links
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own links - insert" on public.links
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own links - update" on public.links
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own links - delete" on public.links
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "own link tags - select" on public.link_tags;
drop policy if exists "own link tags - insert" on public.link_tags;
drop policy if exists "own link tags - delete" on public.link_tags;
create policy "own link tags - select" on public.link_tags
  for select to authenticated using (user_id = (select auth.uid()));
-- you can only put your own tag on your own link
create policy "own link tags - insert" on public.link_tags
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.links l where l.id = link_id and l.user_id = (select auth.uid()))
    and exists (select 1 from public.tags t where t.id = tag_id and t.user_id = (select auth.uid()))
  );
create policy "own link tags - delete" on public.link_tags
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "own link characters - select" on public.link_characters;
drop policy if exists "own link characters - insert" on public.link_characters;
drop policy if exists "own link characters - delete" on public.link_characters;
create policy "own link characters - select" on public.link_characters
  for select to authenticated using (user_id = (select auth.uid()));
-- you can only connect your own link to your own character
create policy "own link characters - insert" on public.link_characters
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.links l where l.id = link_id and l.user_id = (select auth.uid()))
    and exists (select 1 from public.characters c where c.id = character_id and c.user_id = (select auth.uid()))
  );
create policy "own link characters - delete" on public.link_characters
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------- 4. functions the app calls ----------------------------------
-- They run with the caller's permissions (security invoker), so the Row
-- Level Security rules above still apply inside them.

-- Replace a link's tags with the given names, creating missing tags
-- (matched case-insensitively, like set_character_tags). Returns the tags.
create or replace function public.set_link_tags(p_link_id uuid, p_names text[])
returns setof public.tags
language plpgsql security invoker set search_path = ''
as $$
declare
  uid    uuid := auth.uid();
  wanted text[];
  keys   text[];
begin
  if uid is null then raise exception 'Not logged in'; end if;
  if not exists (select 1 from public.links l where l.id = p_link_id and l.user_id = uid) then
    raise exception 'Link not found';
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

  delete from public.link_tags lt
    where lt.link_id = p_link_id
      and not exists (select 1 from public.tags t
                      where t.id = lt.tag_id and t.user_id = uid and lower(t.name) = any (keys));

  insert into public.link_tags (user_id, link_id, tag_id)
    select uid, p_link_id, t.id
    from public.tags t
    where t.user_id = uid and lower(t.name) = any (keys)
    on conflict do nothing;

  return query
    select t.* from public.tags t
    join public.link_tags lt on lt.tag_id = t.id
    where lt.link_id = p_link_id and t.user_id = uid;
end $$;

-- Replace which characters a link belongs to. Returns the character ids.
create or replace function public.set_link_characters(p_link_id uuid, p_character_ids uuid[])
returns setof uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not logged in'; end if;
  if not exists (select 1 from public.links l where l.id = p_link_id and l.user_id = uid) then
    raise exception 'Link not found';
  end if;

  delete from public.link_characters lc
    where lc.link_id = p_link_id and not (lc.character_id = any (coalesce(p_character_ids, '{}')));

  insert into public.link_characters (user_id, link_id, character_id)
    select uid, p_link_id, c.id
    from public.characters c
    where c.user_id = uid and c.id = any (coalesce(p_character_ids, '{}'))
    on conflict do nothing;

  return query select lc.character_id from public.link_characters lc where lc.link_id = p_link_id;
end $$;

-- ---------- 5. merge_tags now also moves tags on links ------------------
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

  insert into public.link_tags (user_id, link_id, tag_id)
    select uid, lt.link_id, p_target_id
    from public.link_tags lt
    where lt.tag_id = any (p_source_ids) and lt.tag_id <> p_target_id and lt.user_id = uid
    on conflict do nothing;

  delete from public.tags t
    where t.id = any (p_source_ids) and t.id <> p_target_id and t.user_id = uid;
end $$;

revoke execute on function public.set_link_tags(uuid, text[]) from public, anon;
revoke execute on function public.set_link_characters(uuid, uuid[]) from public, anon;
revoke execute on function public.merge_tags(uuid[], uuid) from public, anon;
grant execute on function public.set_link_tags(uuid, text[]) to authenticated;
grant execute on function public.set_link_characters(uuid, uuid[]) to authenticated;
grant execute on function public.merge_tags(uuid[], uuid) to authenticated;

-- Make the API notice the new tables right away
notify pgrst, 'reload schema';
