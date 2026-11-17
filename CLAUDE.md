# Stash — notes for Claude

Personal PWA with two sections: **Characters** (inspiration board) and **Link Vault** (saved links in folders), plus **Recent** and **More** tabs.
The owner is not a developer: explain plans and results in plain language, show a short plan and wait for OK before
big changes, keep README.md step-by-step for a non-coder, commit in small steps.

## Stack
- Vite + plain JavaScript (no framework). DOM built with `h()` from `src/ui.js`. Hosted on GitHub Pages (`.github/workflows/deploy.yml`).
- Supabase (auth by magic link / code, Postgres with Row Level Security on every table — `user_id = auth.uid()`, private storage bucket).
- Edge Function `supabase/functions/link-preview` (Open Graph previews). Don't change it unless asked.
- Edge Function `supabase/functions/quick-save` (one-tap save from the iPhone Shortcut "Save to Stash"). Deployed by pasting into the
  dashboard editor, so it must stay ONE self-contained file with no imports. It therefore holds copies of link-preview's SSRF checks +
  preview lookup and of the clean-up / duplicate-key rules in `src/links.js`. When either original changes, copy the change over:
  `tests/quick-save.test.js` compares them (text for link-preview, behaviour for `urlKey` / `cleanUrl` / `platformOf`).
  No login: "Verify JWT" is off for this function; it checks the `x-stash-key` header against the `QUICK_SAVE_KEY` secret in constant
  time, POST only, body ≤ 4 KB, one http(s) URL, and writes only `vault_links` rows for `OWNER_USER_ID` (folder_id null = Unsorted)
  using the server key Supabase injects. Before the key check every refusal is the same generic text; replies are plain text.
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

## Data model (Characters)
- `images.reference_url` = optional "Reference link" per image (http/https, max 2000 chars, DB check constraint; `referenceLink()` in
  `src/links.js` mirrors it). It is NOT the character's `source` / `links` ("Source", "Source links") — don't rename or merge them.
  In the ZIP backup it is `image_references` in `characters.json`.

## Data model (Link Vault)
- `vault_links.folder_id` → `vault_folders` (null = Unsorted). Folders nest max 3 levels (`parent_id`), manual `position`,
  name unique per parent (case-insensitive). The DB refuses a 4th level / cycles; a BEFORE DELETE trigger moves a folder's
  links and subfolders to its parent (renaming clashes "Name (2)") so deleting a folder never deletes links.
- Tags are split: `tags` / `tag_groups` / `character_tags` = Characters only; `vault_tags` / `vault_link_tags` = Link Vault only.
  `merge_tags` touches characters only; `merge_vault_tags` links only; `set_link_tags` creates Vault tags.
- `src/folders.js` mirrors the folder rules and the one-time tag → folder conversion in JS (used by the app, `?mock`, tests).
  Keep it in step with the SQL.

## Front end
- Routes are hash-based (`src/main.js` → `ROUTES`): `#/characters`, `#/c/<id>`, `#/compare/...`, `#/links` (All links), `#/links/unsorted`,
  `#/links/f/<id>`, `#/l/<id>`, `#/recent`, `#/more`, `#/tags`, `#/vault-tags`. There is **no Home screen**: `#/`, an empty hash or an
  unknown route redirects to the tab used last (`cb-last-section`: characters | links | recent; Characters the first time). The `H` key does the same.
- Navigation = `src/views/tabbar.js`: bottom tab bar on a phone (Characters, Vault, centre Add, Recent, More), left rail from 900px.
  Tabs and their routes live in `src/sections.js`. Tags / Vault tags are reached from **More** (and `T`); their back link returns to wherever
  you came from (`state.tagsBack`). The Add button opens `src/views/add-sheet.js` (New character, Add link, Paste link, Paste image).
- Each main screen builds its header in `headerFor()` (main.js) from `pageHead()` (big title + icon buttons) with `moreMenu`, `chipRow`,
  `searchBar` from `src/views/menu.js`. Search lives behind a search icon (`src/search.js`; `/` opens it). The header is rebuilt on every
  render, so `render()` keeps the chip row's sideways scroll position.
- Tag boxes take a source: `tagInput(names, VAULT_TAGS)` for links, default `CHARACTER_TAGS`.
- `?mock` (dev only) uses the in-memory backend in `src/mock.js` — update it whenever `src/api.js` gains a method.
  In the console, `__mockQuickSave()` pretends Quick Save just saved a link (to try the banner).
- **Refresh on return:** `refreshOnReturn()` (main.js) reloads links on visibilitychange / pageshow / focus (1.5 s guard) and merges them
  with `mergeLinks()` (keeps existing objects). It redraws only the Vault and Recent screens, never under an open dialog.
- **"N new in Unsorted" banner** (`src/views/unsorted-banner.js`, rules in `src/unsorted.js`): counts Unsorted links whose `created_at` is
  newer than `cb-unsorted-seen`, except ids in `cb-own-links` (links added in-app). Both are localStorage, per device — no database change.
  The mark moves forward when you open Unsorted, dismiss the banner or move the links. First run on a device starts from the newest link.

## Design ("Pocket")
- Dark is the default (`<html data-theme="dark">`, `cb-theme` in localStorage wins); a matching light theme. `theme-color` meta + manifest
  follow (`#0F1115` dark, `#F4F5F8` light). Only `src/styles/tokens.css` holds colours and sizes; change the design there.
- Dark: bg `#0F1115`, card `#171A21`, chip/icon button/input `#1A1E27`, line `#262B36`, text `#F2F4F8`, muted `#A3ACBB`, accent `#8FA8FF`
  with `#0F1115` on it. Light: bg `#F4F5F8`, card `#FFFFFF`, chip `#E8EBF1`, line `#D9DDE6`, text `#0F1115`, muted `#555D6B`,
  accent `#3D5BD9` with white on it. Danger red has its own token. Use the tokens, never raw colours (placeholders for X/YouTube brand
  colours aside).
- Fonts (Google Fonts link in `index.html`, nothing else): Space Grotesk 600 for titles and item names (`--display`), Inter 400/500/600 for
  everything else (`--sans`). Do not bring back Instrument Serif or Inter Tight.
- Shapes: cards 16px, thumbnails 10px, chips/buttons/inputs fully rounded (pill), sheets and dialogs 20px. No shadows, no gradients.
- Rules that the checks enforce: all text ≥ 4.5:1 in both themes, every tap target ≥ 44px, form fields 16px (iOS doesn't zoom),
  no sideways page scroll at 390px and 320px (only the chip row scrolls sideways), the tab bar respects `env(safe-area-inset-bottom)` and
  nothing is hidden behind it (`--bar-total` is added to the page's bottom padding, to toasts and to the fixed bars).
- Styles are split by area in `src/styles/` (tokens, base, nav, layout, screens), imported by `src/style.css`.
- Keep: 44px tap targets, light + dark, no sideways scrolling at 390px and 320px.

## Checks before finishing
- `npm run build` and `npm test` (with `STASH_PG_URL` when SQL changed).
- Drive the UI with Playwright against `npm run dev` + `?mock` at desktop, 390px and 320px, light and dark.
  Navigate with `location.hash` (a full reload resets the mock data). Check contrast (4.5:1), tap targets (44px), 16px fields,
  sideways scrolling and that the tab bar covers nothing, on every screen and dialog, in both themes.
- Never commit secrets. The app needs none: the publishable key in `src/config.js` is public by design.
  The only secrets are Quick Save's `QUICK_SAVE_KEY` and `OWNER_USER_ID`: Supabase secrets, set in the dashboard, named (with
  placeholder values) in `.env.example`. Any new secret gets the same treatment.
