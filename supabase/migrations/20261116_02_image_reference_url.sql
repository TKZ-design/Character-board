-- =====================================================================
--  Stash — update: a "Reference link" on character images
--
--  Run this ONCE in the Supabase SQL Editor (after the earlier files).
--  It is safe to run again: nothing is changed or deleted the second time.
--
--  What it does:
--   1. Adds images.reference_url — an optional web address for where an
--      image came from. Empty for all your existing images.
--   2. Only http:// and https:// addresses of at most 2000 characters
--      are accepted.
--
--  No new table. The existing Row Level Security rules on "images"
--  already cover the new column (only you can read or change it).
--  This is separate from the "Source" field on characters.
-- =====================================================================

alter table public.images add column if not exists reference_url text;

alter table public.images drop constraint if exists images_reference_url_check;
alter table public.images add constraint images_reference_url_check
  check (reference_url is null or (char_length(reference_url) <= 2000 and reference_url ~* '^https?://'));
