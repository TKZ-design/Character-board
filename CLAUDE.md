# Stash — notes for Claude

Personal PWA with two sections: **Characters** (inspiration board) and **Link Vault** (saved links in folders).
The owner is not a developer: explain plans and results in plain language, show a short plan and wait for OK before
big changes, keep README.md step-by-step for a non-coder, commit in small steps.

## Stack
- Vite + plain JavaScript (no framework). DOM built with `h()` from `src/ui.js`. Hosted on GitHub Pages (`.github/workflows/deploy.yml`).
- Supabase (auth by magic link / code, Postgres with Row Level Security on every table — `user_id = auth.uid()`, private storage bucket).
- Edge Function `supabase/functions/link-preview` (Open Graph previews). Don't change it unless asked.
- No new paid services or heavy dependencies.

## Database changes
- Never edit old migrations. Add a new dated file in `supabase/migrations/` (`YYYYMMDD_NN_name.sql`) that is safe to run twice,
  and add it to the "update files" table in README.md with a plain-language note.
- Every new table: RLS on, select/insert/update/delete policies with `user_id = (select auth.uid())`.
  A policy on a table must not query that same table (infinite recursion) — use a trigger instead (see `vault_folder_check_tree`).
- `tests/migration.test.js` runs `setup.sql` + all migrations on a throwaway Postgres (stubbed `auth`/`storage` schemas)
  when `STASH_PG_URL` is set; add new migrations to its `before()` and test them there. In a cloud session:
  `service postgresql start`, set the postgres password, then
  `STASH_PG_URL=postgresql://postgres:postgres@localhost:5432/postgres npm test`.

## Data model (Link Vault)
- `vault_links.folder_id` → `vault_folders` (null = Unsorted). Folders nest max 3 levels (`parent_id`), manual `position`,
  name unique per parent (case-insensitive). The DB refuses a 4th level / cycles; a BEFORE DELETE trigger moves a folder's
  links and subfolders to its parent (renaming clashes "Name (2)") so deleting a folder never deletes links.
- Tags are split: `tags` / `tag_groups` / `character_tags` = Characters only; `vault_tags` / `vault_link_tags` = Link Vault only.
  `merge_tags` touches characters only; `merge_vault_tags` links only; `set_link_tags` creates Vault tags.
- `src/folders.js` mirrors the folder rules and the one-time tag → folder conversion in JS (used by the app, `?mock`, tests).
  Keep it in step with the SQL.

## Front end
- Routes are hash-based (`src/main.js` → `ROUTES`): `#/links` (All links), `#/links/unsorted`, `#/links/f/<id>`, `#/l/<id>`,
  `#/vault-tags`, `#/characters`, `#/c/<id>`, `#/tags`, `#/compare/...`.
- Tag boxes take a source: `tagInput(names, VAULT_TAGS)` for links, default `CHARACTER_TAGS`.
- Design: "Gallery" look (`src/style.css` tokens), light + dark, 44px tap targets, 16px inputs on iOS,
  no sideways scrolling at 390px and 320px.
- `?mock` (dev only) uses the in-memory backend in `src/mock.js` — update it whenever `src/api.js` gains a method.

## Checks before finishing
- `npm run build` and `npm test` (with `STASH_PG_URL` when SQL changed).
- Drive the UI with Playwright against `npm run dev` + `?mock` at desktop, 390px and 320px, light and dark.
  Navigate with `location.hash` (a full reload resets the mock data).
- Never commit secrets. The app needs none: the publishable key in `src/config.js` is public by design.
  If a secret is ever needed, document it in a `.env.example` with a placeholder value.
