-- =====================================================================
--  Stash — migration 2026-11-16 #01
--  Link Vault folders + Vault-only tags.
--
--  HOW TO RUN: Supabase → SQL Editor → New query → paste this whole
--  file → Run. Run it AFTER 20261104_02_link_vault.sql.
--  Safe to run more than once: the conversion (step 6) only happens the
--  first time; later runs change nothing.
--
--  What it does:
--   1. New table vault_folders (folders with subfolders, max 3 levels).
--      The database itself refuses a 4th level, a folder inside itself,
--      and two folders with the same name in the same place.
--   2. Deleting a folder never deletes links: its links and subfolders
--      move up one level first (a moved subfolder whose name is already
--      taken there gets " (2)", " (3)"… added).
--   3. vault_links gets a folder_id (empty = "Unsorted").
--   4. New table vault_tags: the Link Vault's own tag list. From now on
--      the old tags / tag_groups / character_tags are for Characters only.
--   5. set_link_tags() uses Vault tags; merge_tags() only touches
--      characters; new merge_vault_tags() only touches links.
--   6. ONE-TIME CONVERSION of your existing links:
--      - each link goes into a top-level folder named after its tag that
--        is used on the most links (ties: alphabetical);
--      - its other tags are copied to the new Vault tags;
--      - links stop using the shared tags, and shared tags that no
--        character uses any more are deleted.
--      Links, characters, character tags in use and tag groups are never
--      deleted. Folders are only made for tags that receive links.
--  Row Level Security on every new table: you only ever see your own rows.
-- =====================================================================

-- ---------- helper: tidy a folder name --------------------------------
create or replace function public.clean_folder_name(t text)
returns text language sql immutable as $$
  select regexp_replace(btrim(coalesce(t, '')), '\s+', ' ', 'g')
$$;

create or replace function public.clean_folder_name_trigger()
returns trigger language plpgsql as $$
begin
  new.name := public.clean_folder_name(new.name);
  return new;
end $$;

-- ---------- 1. folders ------------------------------------------------

create table if not exists public.vault_folders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  -- null = top level. Children are moved up before a folder is deleted
  -- (see vault_folder_before_delete), so the cascade never removes anything.
  parent_id   uuid references public.vault_folders (id) on delete cascade,
  position    int not null default 0,
  created_at  timestamptz not null default now()
);

-- one name per place per user, ignoring upper/lower case
create unique index if not exists vault_folders_user_parent_name_key on public.vault_folders
  (user_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
create index if not exists vault_folders_parent_idx on public.vault_folders (parent_id);
create index if not exists vault_folders_user_idx   on public.vault_folders (user_id);

drop trigger if exists vault_folders_clean_name on public.vault_folders;
create trigger vault_folders_clean_name before insert or update of name on public.vault_folders
  for each row execute function public.clean_folder_name_trigger();

-- Refuse: a parent that isn't yours, a folder inside itself / its own
-- subfolders, and anything deeper than 3 levels.
create or replace function public.vault_folder_check_tree()
returns trigger language plpgsql set search_path = '' as $$
declare
  cur        uuid := new.parent_id;
  parent_depth int := 0;   -- levels above the new position (0 = top level)
  height     int := 1;     -- levels in this folder's own subtree (1 = no subfolders)
  steps      int := 0;
begin
  if new.parent_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.parent_id is not distinct from old.parent_id then return new; end if;

  if not exists (select 1 from public.vault_folders f where f.id = new.parent_id and f.user_id = new.user_id) then
    raise exception 'Folder not found' using errcode = 'P0001';
  end if;

  while cur is not null loop
    if cur = new.id then
      raise exception 'A folder can’t be moved into itself or one of its own subfolders' using errcode = 'P0001';
    end if;
    parent_depth := parent_depth + 1;
    steps := steps + 1;
    exit when steps > 50;
    select f.parent_id into cur from public.vault_folders f where f.id = cur;
  end loop;

  if tg_op = 'UPDATE' then
    with recursive sub as (
      select f.id, 1 as lvl from public.vault_folders f where f.id = new.id
      union all
      select c.id, s.lvl + 1 from public.vault_folders c join sub s on c.parent_id = s.id where s.lvl < 10
    ) select max(lvl) into height from sub;
  end if;

  if parent_depth + coalesce(height, 1) > 3 then
    raise exception 'Folders can only be 3 levels deep' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists vault_folders_check_tree on public.vault_folders;
create trigger vault_folders_check_tree before insert or update of parent_id on public.vault_folders
  for each row execute function public.vault_folder_check_tree();

-- ---------- 2. deleting a folder never deletes links --------------------
-- Before a folder is deleted, its links and subfolders move to its parent
-- (or to the top level / Unsorted). Subfolders keep their order and go
-- after the folders already there; a name that is already taken there
-- gets " (2)", " (3)"…
create or replace function public.vault_folder_before_delete()
returns trigger language plpgsql set search_path = '' as $$
declare
  child  record;
  base   text;
  cand   text;
  n      int;
  pos    int;
begin
  -- Deleted by a cascade (e.g. the whole account is being removed), not
  -- directly: nothing to rescue.
  if pg_trigger_depth() > 1 then return old; end if;

  update public.vault_links set folder_id = old.parent_id where folder_id = old.id;

  select coalesce(max(f.position), -1) into pos from public.vault_folders f
    where f.user_id = old.user_id and f.parent_id is not distinct from old.parent_id and f.id <> old.id;

  for child in
    select f.id, f.name from public.vault_folders f where f.parent_id = old.id order by f.position, lower(f.name)
  loop
    base := child.name;
    cand := base;
    n    := 1;
    while exists (select 1 from public.vault_folders f
                  where f.user_id = old.user_id and f.parent_id is not distinct from old.parent_id
                    and f.id <> child.id and lower(f.name) = lower(cand)) loop
      n := n + 1;
      cand := left(base, 74) || ' (' || n || ')';
    end loop;
    pos := pos + 1;
    update public.vault_folders set parent_id = old.parent_id, name = cand, position = pos where id = child.id;
  end loop;
  return old;
end $$;

drop trigger if exists vault_folders_before_delete on public.vault_folders;
create trigger vault_folders_before_delete before delete on public.vault_folders
  for each row execute function public.vault_folder_before_delete();

-- ---------- 3. links get a folder ------------------------------------
alter table public.vault_links
  add column if not exists folder_id uuid references public.vault_folders (id) on delete set null;
create index if not exists vault_links_folder_idx on public.vault_links (folder_id);

-- ---------- 4. Vault-only tags ------------------------------------------
create table if not exists public.vault_tags (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  created_at  timestamptz not null default now()
);
create unique index if not exists vault_tags_user_name_key on public.vault_tags (user_id, lower(name));

drop trigger if exists vault_tags_clean_name on public.vault_tags;
create trigger vault_tags_clean_name before insert or update of name on public.vault_tags
  for each row execute function public.clean_name_trigger();

-- ---------- Row Level Security ----------------------------------------

alter table public.vault_folders enable row level security;
alter table public.vault_tags    enable row level security;

drop policy if exists "own folders - select" on public.vault_folders;
drop policy if exists "own folders - insert" on public.vault_folders;
drop policy if exists "own folders - update" on public.vault_folders;
drop policy if exists "own folders - delete" on public.vault_folders;
create policy "own folders - select" on public.vault_folders
  for select to authenticated using (user_id = (select auth.uid()));
-- (that the parent folder is yours too is checked by vault_folder_check_tree)
create policy "own folders - insert" on public.vault_folders
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own folders - update" on public.vault_folders
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own folders - delete" on public.vault_folders
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "own vault tags - select" on public.vault_tags;
drop policy if exists "own vault tags - insert" on public.vault_tags;
drop policy if exists "own vault tags - update" on public.vault_tags;
drop policy if exists "own vault tags - delete" on public.vault_tags;
create policy "own vault tags - select" on public.vault_tags
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own vault tags - insert" on public.vault_tags
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own vault tags - update" on public.vault_tags
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own vault tags - delete" on public.vault_tags
  for delete to authenticated using (user_id = (select auth.uid()));

-- links: a link can only be put in a folder you own
drop policy if exists "own links - insert" on public.vault_links;
drop policy if exists "own links - update" on public.vault_links;
create policy "own links - insert" on public.vault_links
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and (cover_path is null or split_part(cover_path, '/', 1) = (select auth.uid())::text)
    and (cover_thumb_path is null or split_part(cover_thumb_path, '/', 1) = (select auth.uid())::text)
    and (folder_id is null or exists (select 1 from public.vault_folders f where f.id = folder_id and f.user_id = (select auth.uid())))
  );
create policy "own links - update" on public.vault_links
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and (cover_path is null or split_part(cover_path, '/', 1) = (select auth.uid())::text)
    and (cover_thumb_path is null or split_part(cover_thumb_path, '/', 1) = (select auth.uid())::text)
    and (folder_id is null or exists (select 1 from public.vault_folders f where f.id = folder_id and f.user_id = (select auth.uid())))
  );

-- ---------- 6. one-time conversion ------------------------------------
-- Runs only while vault_link_tags still points at the shared "tags" table.
-- At the end it is re-pointed at vault_tags, so a second run skips this.
do $$
declare
  fk text;
begin
  select c.conname into fk
  from pg_constraint c
  where c.conrelid = 'public.vault_link_tags'::regclass and c.contype = 'f'
    and c.confrelid = 'public.tags'::regclass
  limit 1;
  if fk is null then return; end if;

  -- every (link, shared tag) pair as it is today
  create temp table conv_pairs on commit drop as
    select lt.user_id, lt.link_id, lt.tag_id, t.name
    from public.vault_link_tags lt
    join public.tags t on t.id = lt.tag_id;

  -- how many links use each tag
  create temp table conv_counts on commit drop as
    select tag_id, count(*) as n from conv_pairs group by tag_id;

  -- each link's folder tag: the most-used one, ties alphabetical
  create temp table conv_choice on commit drop as
    select distinct on (p.link_id) p.user_id, p.link_id, p.tag_id, p.name
    from conv_pairs p join conv_counts c on c.tag_id = p.tag_id
    order by p.link_id, c.n desc, lower(p.name), p.name, p.tag_id;

  -- top-level folders, alphabetical, after any folders that already exist
  insert into public.vault_folders (user_id, name, parent_id, position)
    select x.user_id, x.name, null,
           coalesce((select max(f.position) from public.vault_folders f where f.user_id = x.user_id and f.parent_id is null), -1)
             + row_number() over (partition by x.user_id order by lower(x.name))
    from (select distinct on (user_id, lower(name)) user_id, name from conv_choice order by user_id, lower(name), name) x
    where not exists (select 1 from public.vault_folders f
                      where f.user_id = x.user_id and f.parent_id is null and lower(f.name) = lower(x.name));

  update public.vault_links l set folder_id = f.id
    from conv_choice ch
    join public.vault_folders f on f.user_id = ch.user_id and f.parent_id is null and lower(f.name) = lower(ch.name)
    where l.id = ch.link_id and l.folder_id is null;

  -- the other tags become Vault tags
  create temp table conv_rest on commit drop as
    select p.* from conv_pairs p
    where not exists (select 1 from conv_choice ch where ch.link_id = p.link_id and ch.tag_id = p.tag_id);

  insert into public.vault_tags (user_id, name)
    select distinct on (user_id, lower(name)) user_id, name from conv_rest order by user_id, lower(name), name
    on conflict (user_id, lower(name)) do nothing;

  -- re-point vault_link_tags at vault_tags
  delete from public.vault_link_tags;
  execute format('alter table public.vault_link_tags drop constraint %I', fk);
  alter table public.vault_link_tags
    add constraint vault_link_tags_tag_id_fkey foreign key (tag_id) references public.vault_tags (id) on delete cascade;

  insert into public.vault_link_tags (user_id, link_id, tag_id)
    select distinct r.user_id, r.link_id, vt.id
    from conv_rest r join public.vault_tags vt on vt.user_id = r.user_id and lower(vt.name) = lower(r.name)
    on conflict do nothing;

  -- shared tags that were on links and that no character uses any more
  delete from public.tags t
    where t.id in (select tag_id from conv_pairs)
      and not exists (select 1 from public.character_tags ct where ct.tag_id = t.id);
end $$;

-- link tags may only use your own Vault tags (replaces the old rule)
drop policy if exists "own link tags - insert" on public.vault_link_tags;
create policy "own link tags - insert" on public.vault_link_tags
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.vault_links l where l.id = link_id and l.user_id = (select auth.uid()))
    and exists (select 1 from public.vault_tags t where t.id = tag_id and t.user_id = (select auth.uid()))
  );

-- ---------- 5. functions the app calls --------------------------------
-- Security invoker: they run with your permissions, so the rules above apply.

-- Replace a link's tags with the given names, creating missing Vault tags
-- (matched case-insensitively). Returns the link's Vault tags afterwards.
drop function if exists public.set_link_tags(uuid, text[]);
create function public.set_link_tags(p_link_id uuid, p_names text[])
returns setof public.vault_tags
language plpgsql security invoker set search_path = ''
as $$
declare
  uid    uuid := auth.uid();
  wanted text[];
  keys   text[];
begin
  if uid is null then raise exception 'Not logged in'; end if;
  if not exists (select 1 from public.vault_links l where l.id = p_link_id and l.user_id = uid) then
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

  insert into public.vault_tags (user_id, name)
    select uid, n from unnest(wanted) as n
    on conflict (user_id, lower(name)) do nothing;

  delete from public.vault_link_tags lt
    where lt.link_id = p_link_id
      and not exists (select 1 from public.vault_tags t
                      where t.id = lt.tag_id and t.user_id = uid and lower(t.name) = any (keys));

  insert into public.vault_link_tags (user_id, link_id, tag_id)
    select uid, p_link_id, t.id
    from public.vault_tags t
    where t.user_id = uid and lower(t.name) = any (keys)
    on conflict do nothing;

  return query
    select t.* from public.vault_tags t
    join public.vault_link_tags lt on lt.tag_id = t.id
    where lt.link_id = p_link_id and t.user_id = uid;
end $$;

-- Character tags: merging only moves characters (links have their own tags now).
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

-- Vault tags: move every link from the source tags onto the target tag,
-- then delete the source tags.
create or replace function public.merge_vault_tags(p_source_ids uuid[], p_target_id uuid)
returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not logged in'; end if;
  if not exists (select 1 from public.vault_tags t where t.id = p_target_id and t.user_id = uid) then
    raise exception 'Target tag not found';
  end if;

  insert into public.vault_link_tags (user_id, link_id, tag_id)
    select uid, lt.link_id, p_target_id
    from public.vault_link_tags lt
    where lt.tag_id = any (p_source_ids) and lt.tag_id <> p_target_id and lt.user_id = uid
    on conflict do nothing;

  delete from public.vault_tags t
    where t.id = any (p_source_ids) and t.id <> p_target_id and t.user_id = uid;
end $$;

revoke execute on function public.set_link_tags(uuid, text[]) from public, anon;
revoke execute on function public.merge_tags(uuid[], uuid) from public, anon;
revoke execute on function public.merge_vault_tags(uuid[], uuid) from public, anon;
grant execute on function public.set_link_tags(uuid, text[]) to authenticated;
grant execute on function public.merge_tags(uuid[], uuid) to authenticated;
grant execute on function public.merge_vault_tags(uuid[], uuid) to authenticated;

-- Make the API notice the new tables/columns right away
notify pgrst, 'reload schema';
