# Stash — project conventions

Stash is a private, single-user PWA hub: **Characters**, **Link Vault** and **Notes**.
The owner is not a developer: explain plans and results in plain, non-technical
language, show a short plan and wait for an OK before building, and end with what's
done, how to test it (clicks, not commands), what they must do by hand, and a
suggested next phase.

## Stack (don't add to it without asking)
- Vite + plain JavaScript (no framework). Tiny DOM helper `h()` in `src/ui.js`.
- Supabase: Postgres with Row Level Security, magic-link / code login, private storage
  bucket `character-images`, Edge Functions (Deno, TypeScript, no npm dependencies).
- Hosting: GitHub Pages via `.github/workflows/deploy.yml`. Edge Functions deploy via
  `.github/workflows/deploy-functions.yml` (needs repo secrets; skips safely without).
- Free tiers only. JSZip is lazy-loaded for backups.

## Layout
- `src/main.js` routing (`#/`, `#/characters`, `#/c/<id>`, `#/links`, `#/l/<id>`, `#/notes`, `#/tags`), headers, boot.
- `src/sections.js` the hub sections (home tiles + top bar). New section = entry here + route + header in `main.js`.
- `src/state.js` in-memory state; `src/api.js` all Supabase calls; `src/mock.js` the same API with fake data.
- `src/views/*` screens. `src/export.js` the ZIP backup — **every new kind of data must be added to it**.
- Pure helpers (no DOM) are unit-tested: `src/text.js`, `src/notes.js`,
  `supabase/functions/_shared/links.js` (re-exported by `src/links.js`).
- `supabase/functions/_shared/` code shared by the app and the Edge Functions
  (URL parsing / duplicate keys, safe fetching with SSRF protection). Never fork it.
- `supabase/functions/link-preview` (logged-in users only), `supabase/functions/quick-save`
  (iPhone Shortcuts; `x-stash-key` header). `supabase/config.toml` sets `verify_jwt = false`
  because both functions check access themselves.
- `supabase/setup.sql`, then `supabase/migrations/YYYYMMDD_NN_name.sql` (run once each, oldest first).
- `supabase/tests/*.sql` checks the owner can paste into the SQL Editor (they roll back).

## Database rules
- Every table has RLS with `user_id = (select auth.uid())` policies for select/insert/update/delete,
  `user_id default auth.uid()`, and an `updated_at` trigger (`public.touch_updated_at`).
- Migrations must be idempotent (`if not exists`, `drop policy if exists` + `create policy`)
  and never delete data. Add each new file to the README migrations table.
- Text limits are enforced in the database too (e.g. notes ≤ 5,000 chars).
- The service-role key is only ever used inside Edge Functions.

## Security
- Public repo: no secrets in code. Names go in `.env.example`; values in Supabase secrets
  (`STASH_QUICK_KEY`, `STASH_OWNER_USER_ID`) or GitHub secrets (`SUPABASE_ACCESS_TOKEN`,
  `SUPABASE_PROJECT_REF`). The publishable key in `src/config.js` is meant to be public.
- Anything that fetches a user-supplied URL goes through `_shared/preview.ts`
  (`checkUrl` / `safeFetch`): http(s) only, ports 80/443, no private/internal addresses,
  re-checked on every redirect, timeouts and size caps.
- Secrets are compared in constant time (see `keysMatch` in quick-save).
- Never render user text as HTML: build DOM nodes / text nodes (`h()`), `splitLinks()` for links.

## Design ("Gallery" style, `src/style.css`)
- Instrument Serif for titles, Inter Tight for everything else; one accent colour (`--accent`)
  for the title full stop and filled stars only.
- No gradients, no shadows, no rounded cards. Hairlines (`--line`, `--strong-line`),
  underlined text buttons (`.btn`), black pill for primary actions (`.btn.primary`).
- Colours only via the tokens on `:root[data-theme=…]`; check **light and dark**.
- Check **phone (390 px and 320 px) and laptop**: 44 px tap targets, 16 px inputs on iOS,
  no horizontal scroll, the hub bar must fit all sections.
- Titles end with `h('span.title-dot', '.')`. Small labels use the uppercase eyebrow style.
- Plain, friendly copy; curly quotes (“ ”, ’).

## Working
- `npm test` (Node's test runner with type stripping; also covers the Edge Functions with fake
  network/database), `npm run build`. Both must pass before committing.
- Try the UI with fake data: `npm run dev` → http://localhost:5173/?mock (dev only).
- Small, clear commits. Keep the `?add=<url>` flow working (fallback for sharing links).
- Update `README.md` (step-by-step for a non-coder, iPhone first) with every user-visible change.
