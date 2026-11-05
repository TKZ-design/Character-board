# Character Inspiration Board — a small personal hub

A private, installable web app with two sections: **Characters** (character references: images, tags, notes and source links) and the **Link Vault** (videos, posts and articles you want to keep or watch later).
Your data lives in **your own Supabase project**, and only you can see it once you're logged in.

**Your app's address (after setup):** https://tkz-design.github.io/Character-board/

---

## What it does

**Home** — after logging in you land on a home screen with a big tile per section (with counts and a few recent images). The switcher at the top of every page (*Home · Characters · Link Vault*) jumps between them.

### Characters

- **Characters** with a name, an optional **source** (e.g. *Original*, a game or an anime), any number of images, tags, notes and source links
- **Add images** by dragging them onto the page, choosing files (works with your phone's photo library/camera), pasting with **Ctrl+V / Cmd+V**, the **Paste** button, or — on Android — **sharing** them from any app (see below). On the board you're asked whether they're for a **new character** or should be **added to an existing one** (searchable by name or source)
- **Tags page** (`Tags` in the header, shortcut `T`): every tag with how many characters use it, organised into **groups** you create (e.g. Genre, Role, Mood). Create, rename, merge, move and delete tags; renaming updates every character at once. Tags ignore upper/lower case and extra spaces (“Mage” = “mage ”). When tagging a character, existing tags are suggested (with their group) as you type
- **Duplicate protection**: while you type a new character's name you'll see characters with the same or a similar name (Kael / Kaell). Same name **and** same source gets a strong warning. Every uploaded image is fingerprinted, so re-adding the exact same image gets you a warning too
- Images are **shrunk in your browser before uploading** (max 2000 px, WebP or JPEG), so they take up less storage
- **Masonry grid** with **search by name or source** and **filtering by one or more tags** (grouped like on the Tags page)
- **Grid / List**: the two buttons above the board switch to a compact list (small picture, name, source, tags, image count, star). **Sort** by date added, last updated or name. Both choices are remembered on each device
- **Detail view** with a gallery, full-size zoom (click the image, use arrow keys or swipe), editing and delete
- **Cover image**: hover an image in a character's gallery (always visible on phones) and press the picture icon to make it the image shown on the grid
- **Favorites**: star characters (on the card or in the detail view) and use the **★ Favorites** button to show only those
- **🎲 Random**: jumps to a random character — it respects your current search, tag and favorites filters (shortcut: `R`)
- **Compare**: press **Compare** on the board, tap 2 or 3 characters, then **Compare** again to see them side by side
- **Backup**: **⋮ menu → Download backup (ZIP)** saves everything — one folder of full-size images per character, plus a `characters.json` file with all names, tags, notes, links and favorites
- Dark mode by default, with a light mode toggle (☀️/🌙 button, your choice is remembered)
- **Installable** on desktop and phone like a normal app

### Link Vault

- **Save a link** with the **Paste link** button, **Ctrl+V / Cmd+V** anywhere on the vault or home page, the **Add link** dialog, or straight from your iPhone's **Share sheet** with the *Save to Vault* shortcut (see below). On Android, sharing a link to the installed app works too
- Every link has a title, description, thumbnail, platform, notes, **tags** (the same tags and groups as your characters), a **★ favorite**, a status (**To watch / Done**) and optional **linked characters**. A character's page lists its links, with *Add link* / *Paste link* right there
- **YouTube** (normal, `youtu.be`, Shorts, live): thumbnail straight from the video, and it **plays inside the app** (privacy-friendly `youtube-nocookie.com` player)
- **X, Instagram, Reddit**: the detail page shows the post with the platform's official embed — loaded only when you open that link
- **Thumbnails for everything else** come from the page's preview data (Open Graph), fetched once by a small Supabase *Edge Function* and saved. If there's no preview (common for X and Instagram) you get a clean card with the platform, the domain and your title — and **Set thumbnail** lets you upload or paste your own picture (shrunk like character images)
- **Duplicate warning**: if a link is already saved you're told before saving again. Tracking bits like `utm_…`, `si`, `igsh`, `fbclid` don't count, and `youtu.be/…` = `youtube.com/watch?v=…`
- Grid and list views, sort, search, and filters for status, favorites, platform and tags
- Included in the **ZIP backup** (`links.json`, plus your own thumbnails in `links/`)

Handy shortcuts on a computer: `/` jumps to search, `N` makes a new character (or a new link in the vault), `R` opens a random character, `T` opens Tags, `Esc` goes back.
Pasting or dropping an image on the board starts a new character with it. Pasting an image on a link's page makes it that link's thumbnail.

---

## One-time setup (about 10 minutes)

You need to do three things: **1)** set up the database, **2)** tell Supabase where your app lives, **3)** turn on GitHub Pages.

### 1. Create the database (Supabase SQL Editor)

1. Go to https://supabase.com/dashboard and open your project (`imorekpkzucpjpplyabq`).
2. In the left sidebar click **SQL Editor**.
3. Click **+ New query** (or "New SQL snippet").
4. Open the file [`supabase/setup.sql`](supabase/setup.sql) here on GitHub, click the **Copy raw file** button (two overlapping squares, top-right of the file), and paste everything into the SQL Editor.
5. Click **Run** (or press Ctrl+Enter / Cmd+Enter). You should see *"Success. No rows returned."*

That creates:
- a `characters` table and an `images` table
- a **private** storage bucket called `character-images`
- **Row Level Security** rules on both tables and on the storage bucket, so every user can only ever read or change their own things

> It's safe to run the file again later (for example after an update) — it only adds what's missing and never deletes your data.
>
> If Supabase shows a warning like *"This query has destructive operations"*, that's because the script replaces its own security rules (`drop policy if exists …`) with fresh copies. Your data is not touched — click **Run this query**.

### 1b. Run the update files (Supabase SQL Editor)

New features sometimes need extra database pieces. They live in [`supabase/migrations/`](supabase/migrations/), one file per update, named by date. Run **each file once, oldest first**, the same way as `setup.sql` (New query → paste → Run). They're all safe to run again.

| File | Adds |
| --- | --- |
| `20261104_01_tags_source_duplicates.sql` | Tag & tag-group tables (your existing tags are moved over automatically), the *Source* field, image fingerprints for the duplicate warning |
| `20261105_01_link_vault.sql` | The **Link Vault**: `links`, `link_tags` and `link_characters` tables, each locked to your own account (Row Level Security). Doesn't change any character data |

> **Link Vault update in short:** SQL Editor → **+ New query** → paste [`supabase/migrations/20261105_01_link_vault.sql`](supabase/migrations/20261105_01_link_vault.sql) → **Run** → *"Success. No rows returned."* Then do step **1c** below for thumbnails. Until the file is run, the Characters section works as before and the Link Vault page tells you it's waiting for this step.

> If the app ever says *"The database needs an update"*, a file in that folder hasn't been run yet.

### 1c. Link previews: deploy the Edge Function (Supabase dashboard, ~3 minutes)

The Link Vault asks a tiny server-side helper for each link's title and preview picture (browsers aren't allowed to read other websites directly). It lives in [`supabase/functions/link-preview/index.ts`](supabase/functions/link-preview/index.ts) and has no dependencies, so you can paste it in the browser — no command line needed.

1. Open your project at https://supabase.com/dashboard and click **Edge Functions** in the left sidebar.
2. Click **Deploy a new function** → **Via Editor**.
3. In the editor, delete the sample code. Open [`supabase/functions/link-preview/index.ts`](supabase/functions/link-preview/index.ts) here on GitHub, click **Copy raw file**, and paste it in.
4. Set the function name (box at the bottom, or the top-left title) to exactly: `link-preview`
5. Click **Deploy function** and wait for the green confirmation.
6. That's all — no secrets or settings to add. To check it: open the app, open a link without a picture and press **Try preview again**.

What it does and doesn't do (for peace of mind): it only answers **logged-in users of your project**, only fetches `http`/`https` pages on the normal ports, **refuses private / local network addresses** (also after redirects), gives up after **6 seconds**, and reads at most **512 KB** of a page. Results are saved on the link, so each link is looked up **once**.

> **If previews never appear** and the browser console says *Invalid JWT* (401): open the function in Supabase → **Details** (or **Settings**) → turn **off** “Verify JWT with legacy secret” (called *Enforce JWT Verification* in some versions) → **Save**. That's safe: the function checks your login itself.
>
> Updating it later is the same: open the function → **Code** → paste the new file → **Deploy**.

### 2. Configure login (Supabase Authentication)

The app logs you in with a **magic link** sent to your email. Supabase needs to know your app's address so the link sends you back to the right place.

1. In Supabase, go to **Authentication → URL Configuration**.
2. Set **Site URL** to: `https://tkz-design.github.io/Character-board/`
3. Under **Redirect URLs**, click **Add URL** and add the same address: `https://tkz-design.github.io/Character-board/`
   (Optional, only if you'll ever run the app on your own computer: also add `http://localhost:5173/`.)
4. Click **Save**.

**Recommended – keep strangers out:** the app is on the public internet, so anybody could *create their own* empty account (they'd never see your data, but they'd use your storage). After you've logged in successfully for the first time:
- Go to **Authentication → Sign In / Providers** (called *Providers* or *Settings* in some versions) and turn **off "Allow new users to sign up"**. You can still log in; nobody else can create an account.

**Recommended – login code for the installed iPhone app:** on iPhone, an app added to the Home Screen can't receive magic links (the link opens in Safari instead). The fix is to also put a 6-digit code in the email:
1. Go to **Authentication → Emails** (or *Email Templates*) → **Magic Link**.
2. Somewhere in the message body, add: `Your login code: {{ .Token }}`
3. Save. Now the login screen's *"Got a code instead?"* box will work everywhere.

> Supabase's built-in email service only sends a few emails per hour. If a login email doesn't arrive, wait a bit and try again (and check your spam folder).

### 3. Turn on GitHub Pages

1. On GitHub, open this repository → **Settings** → **Pages** (left sidebar).
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. That's it. Every time something is merged into the `main` branch, the app is rebuilt and published automatically.
   You can watch progress under the repository's **Actions** tab; a green check ✅ means it's live.
4. The first time, after merging the pull request, wait ~1–2 minutes and open https://tkz-design.github.io/Character-board/

> To re-publish manually: **Actions** tab → **Deploy to GitHub Pages** → **Run workflow**.

---

## Installing the app

### On a computer (Chrome, Edge, Brave)
1. Open https://tkz-design.github.io/Character-board/
2. Click the **install icon** at the right end of the address bar (a little monitor with a down arrow), or open the **⋮ menu → Cast, save and share → Install page as app** (Chrome) / **Apps → Install this site as an app** (Edge).
3. It now has its own window and a desktop/Start menu/Dock icon.

*Safari on Mac (Sonoma or newer):* **File → Add to Dock**.

### On iPhone / iPad (Safari)
1. Open the address in **Safari**.
2. Tap the **Share** button (square with an up arrow) → **Add to Home Screen** → **Add**.
3. Log in inside the installed app using the **login code** (see the "login code" tip in step 2 above).

### On Android (Chrome)
1. Open the address in **Chrome**.
2. Tap **⋮ → Install app** (or **Add to Home screen**), then **Install**.
3. Once installed, **Characters** appears in Android's **Share** sheet: in your gallery, browser or any other app, tap **Share → Characters** on an image and it opens straight to *New character / Add to existing*.
   (If you installed the app before this feature existed and it doesn't show up in the Share sheet, remove the app from your home screen and install it again. Sharing into web apps isn't supported on iPhone — use the **Paste** button there.)

### iPhone: the “Save to Vault” Share-sheet shortcut

This adds **Save to Vault** to the iPhone Share sheet (YouTube, X, Instagram, Reddit, Safari…). It opens the app at `…/?add=<the link>`, and the *Add link* dialog appears with the link filled in — you just press **Save** (log in first if asked; the link waits for you).

1. Open the **Shortcuts** app and tap **+** (top right) to make a new shortcut.
2. Tap the name at the top (“New Shortcut”) → **Rename** → type `Save to Vault` → **Done**.
3. Tap the **ⓘ** button at the bottom (on older iOS: the ⌄ next to the name → **Details**) and turn on **Show in Share Sheet**. Tap **Done**.
4. A block *“Receive **Any** input from **Share Sheet**”* now sits at the top:
   - tap **Any** → choose **URLs**, **Safari web pages** and **Text** only;
   - tap **If there's no input: Continue** → choose **Get Clipboard** (so running the shortcut by itself saves whatever link you copied).
5. Tap **Search Actions** at the bottom and add these, in order (type the name, then tap it):
   1. **Get URLs from Input** — it should read *Get URLs from **Shortcut Input***.
   2. **Get Item from List** — it should read *Get **First Item** from **URLs***.
   3. **URL Encode** — it should read ***Encode** **Item from List***.
   4. **Text** — tap into its box and type `https://tkz-design.github.io/Character-board/?add=` then, with the cursor right after `=`, tap **URL Encoded Text** in the bar above the keyboard (it appears as a blue bubble).
   5. **Open URLs** — it should read *Open **Text***.
6. Tap **Done**. Try it: in YouTube tap **Share → More (…)** → **Save to Vault** (in X, Instagram and Reddit it's under **Share → Share via… / More**). The first time, iOS asks to allow opening the page — tap **Allow** / **Always Allow**.

Tips:
- To put it near the front: in any Share sheet scroll the app row to the end → **More** / **Edit Actions**, and add *Save to Vault* to **Favorites**.
- The shortcut opens the app in **Safari**. On iPhone, Safari and the Home Screen app keep **separate logins**, so log in once in Safari as well (with the magic link or the 6-digit code).

### Pasting on a phone
Copy an image in another app, open Characters and tap **Paste** (on the board, in *New character*, or under *Add images* on a character). Your browser may ask for permission first. If it blocks access, a box appears instead: **long-press it and choose Paste**.

---

## Is my stuff really private?

- The code in this repository is public (that's how free GitHub Pages works), but it contains **no data**.
- The "publishable key" in `src/config.js` is designed to be public. By itself it can't read anything — every request is checked by the Row Level Security rules from `setup.sql`, which only allow a logged-in user to touch rows and files they own.
- Images are stored in a **private** bucket. The app shows them using temporary links that expire after one hour.

---

## For the curious / developers

- Built with [Vite](https://vite.dev) + plain JavaScript, [supabase-js](https://supabase.com/docs/reference/javascript) and [JSZip](https://stuk.github.io/jszip/).
- `npm install` then `npm run dev` runs it locally at http://localhost:5173/.
  Add `?mock` to the URL (http://localhost:5173/?mock) to try the interface with fake in-memory data and no login — this only exists in development and is never included in the published app.
- `npm run build` creates the production site in `dist/`.
- The deploy workflow lives in `.github/workflows/deploy.yml`.
- Database / storage / security rules: `supabase/setup.sql`, then the files in `supabase/migrations/`.
- `npm test` runs the unit tests (name matching, tag rules, link clean-up / platform detection, and the Edge Function's address checks and HTML parsing).
- `?mock` also includes fake Link Vault data; `?mock&add=https://…` tries the Share-sheet flow.

| File | What it is |
| --- | --- |
| `src/main.js` | App shell: routing, header & section switcher, paste & drop handling, `?add=` links, login state |
| `src/sections.js` | The hub's sections (home tiles + switcher). Add an entry here for a new section |
| `src/linkutil.js` | Link clean-up for the duplicate check, YouTube / X / Instagram / Reddit detection |
| `src/linkmedia.js`, `src/previews.js`, `src/embeds.js` | Link thumbnails & placeholder cards, the preview queue, official X / Instagram / Reddit embeds |
| `supabase/functions/link-preview/` | The Edge Function that reads a page's Open Graph preview |
| `src/api.js` | Everything that talks to Supabase |
| `src/compress.js` | In-browser image resizing/compression |
| `src/views/` | The screens: login, home, grid, detail, tags, vault, link detail, dialogs, lightbox |
| `src/text.js` | Tag clean-up and the "similar name" matching |
| `src/hash.js`, `src/paste.js`, `src/share.js` | Duplicate-image check, Paste button, Android share target |
| `public/sw.js`, `public/manifest.webmanifest` | What makes it installable (PWA) |
