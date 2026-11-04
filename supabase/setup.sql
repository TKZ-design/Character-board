-- =====================================================================
--  Character Inspiration Board — Supabase setup
--  Paste this whole file into Supabase → SQL Editor → New query → Run.
--  It is safe to run more than once (it only adds what is missing).
-- =====================================================================

-- ---------- Tables ----------------------------------------------------

create table if not exists public.characters (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 200),
  tags        text[] not null default '{}',
  notes       text not null default '',
  links       text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.images (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  character_id  uuid not null,
  path          text not null,   -- full-size file in the storage bucket
  thumb_path    text,            -- small thumbnail for the grid
  width         int,
  height        int,
  position      int not null default 0,
  created_at    timestamptz not null default now(),
  constraint images_character_id_fkey
    foreign key (character_id) references public.characters (id) on delete cascade
);

create index if not exists characters_user_idx  on public.characters (user_id);
create index if not exists characters_tags_idx  on public.characters using gin (tags);
create index if not exists images_character_idx on public.images (character_id);
create index if not exists images_user_idx      on public.images (user_id);

-- Keep updated_at fresh automatically
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists characters_touch on public.characters;
create trigger characters_touch before update on public.characters
  for each row execute function public.touch_updated_at();

-- ---------- Row Level Security: each user sees ONLY their own rows -----

alter table public.characters enable row level security;
alter table public.images     enable row level security;

drop policy if exists "own characters - select" on public.characters;
drop policy if exists "own characters - insert" on public.characters;
drop policy if exists "own characters - update" on public.characters;
drop policy if exists "own characters - delete" on public.characters;

create policy "own characters - select" on public.characters
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own characters - insert" on public.characters
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own characters - update" on public.characters
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own characters - delete" on public.characters
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "own images - select" on public.images;
drop policy if exists "own images - insert" on public.images;
drop policy if exists "own images - update" on public.images;
drop policy if exists "own images - delete" on public.images;

create policy "own images - select" on public.images
  for select to authenticated using (user_id = (select auth.uid()));
-- you can only attach images to a character you own
create policy "own images - insert" on public.images
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.characters c where c.id = character_id and c.user_id = (select auth.uid()))
  );
create policy "own images - update" on public.images
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own images - delete" on public.images
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------- Storage: a PRIVATE bucket for the image files -------------
-- Files are stored as  <your-user-id>/<character-id>/<image-id>.webp
-- and the policies below only allow access to your own folder.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('character-images', 'character-images', false, 10485760,
        array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false;

drop policy if exists "own files - select" on storage.objects;
drop policy if exists "own files - insert" on storage.objects;
drop policy if exists "own files - update" on storage.objects;
drop policy if exists "own files - delete" on storage.objects;

create policy "own files - select" on storage.objects
  for select to authenticated
  using (bucket_id = 'character-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own files - insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'character-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own files - update" on storage.objects
  for update to authenticated
  using (bucket_id = 'character-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own files - delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'character-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
