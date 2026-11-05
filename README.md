# Stash — Characters & Link Vault

A private, installable web app with two sections (more can be added later):

- **Characters** — your character inspiration board: images, tags, notes and source links.
- **Link Vault** — saved links (YouTube, X, Instagram Reels, Reddit, any website) with thumbnails, tags, notes, a *To watch / Done* status, favorites and links to your characters.

Your data lives in **your own Supabase project**, and only you can see it once you're logged in.

**Your app's address (after setup):** https://tkz-design.github.io/Character-board/

---

## What it does

### Hub
- After login you land on the **home screen** with a large tile per section (with counts and recent pictures).
- The thin bar at the top of every page jumps between **Stash · Characters · Link Vault**, and holds the light/dark toggle and the **⋮ menu** (backup, sign out). Shortcut `H` goes home.
- The installed app is called **Stash**. On iPhone, an app already on your Home Screen keeps its old name until you remove it and add it again (Safari → Share → Add to Home Screen).

### Characters
- **Grid or List**: the buttons above the characters switch between the big gallery grid and a compact list (small picture, name, source, tags, image count, star). Your choice is remembered on each device.
- **Sort** by *Date added*, *Name* or *Last updated* (last edit or newest image)
- **Characters** with a name, an optional **source** (e.g. *Original*, a game or an anime), any number of images, tags, notes and source links
- **Add images** by dragging them onto the page, choosing files (works with your phone's photo library/camera), pasting with **Ctrl+V / Cmd+V**, the **Paste** button, or — on Android — **sharing** them from any app (see below). On the board you're asked whether they're for a **new character** or should be **added to an existing one** (searchable by name or source)
- **Tags page** (`Tags` in the header, shortcut `T`): every tag with how many characters use it, organised into **groups** you create (e.g. Genre, Role, Mood). Create, rename, merge, move and delete tags; renaming updates every character at once. Tags ignore upper/lower case and extra spaces (“Mage” = “mage ”). When tagging a character, existing tags are suggested (with their group) as you type
- **Duplicate protection**: while you type a new character's name you'll see characters with the same or a similar name (Kael / Kaell). Same name **and** same source gets a strong warning. Every uploaded image is fingerprinted, so re-adding the exact same image gets you a warning too
- Images are **shrunk in your browser before uploading** (max 2000 px, WebP or JPEG), so they take up less storage
- **Masonry grid** with **search by name or source** and **filtering by one or more tags** (grouped like on the Tags page)
- **Detail view** with a gallery, full-size zoom (click the image, use arrow keys or swipe), editing and delete
- **Cover image**: hover an image in a character's gallery (always visible on phones) and press the picture icon to make it the image shown on the grid
- **Favorites**: star characters (on the card or in the detail view) and use the **★ Favorites** button to show only those
- **🎲 Random**: jumps to a random character — it respects your current search, tag and favorites filters (shortcut: `R`)
- **Compare**: press **Compare** on the board, tap 2 or 3 characters, then **Compare** again to see them side by side
- **Backup**: **⋮ menu → Download backup (ZIP)** saves everything — one folder of full-size images per character, plus a `characters.json` file with all names, tags, notes, links and favorites
- Dark mode by default, with a light mode toggle (☀️/🌙 button, your choice is remembered)
- **Installable** on desktop and phone like a normal app

### Link Vault
- **Save a link** any of these ways:
  - the **Paste link** button (reads the link on your clipboard — on iPhone, tap the little *Paste* bubble that appears)
  - **Ctrl+V / Cmd+V** anywhere in the app (not inside a text field)
  - the **“Paste or type a link…”** field at the top of the Link Vault (pasting into it opens the form right away)
  - the **“Save to Vault”** iPhone Shortcut in the Share sheet (set-up below), or on Android **Share → Stash**
- Each link has a **title** (filled in automatically when possible), **notes**, **tags** (the same tags and tag groups as your characters), **favorite**, **status** (*To watch* / *Done*) and optional **characters** it belongs to. Those links also show up on the character's page (with an **Add link** button there).
- **YouTube** (normal, `youtu.be`, Shorts and live links): the thumbnail comes straight from the video, and it **plays inside the app** with YouTube's privacy-enhanced player (youtube-nocookie.com).
- **X, Instagram, Reddit**: opening a link shows the post with the platform's **official embed**, loaded only when you open it.
- **Other websites** get their preview picture and title from the **link-preview** Edge Function (set-up below). Each link is looked up only once and the result is saved.
- No picture (common for X and Instagram)? You get a clean placeholder card with the platform, your title and the domain — and **Set thumbnail** lets you upload or paste a picture (a screenshot works well). It's shrunk like character images.
- **Duplicate warning**: if a link is already saved you'll be told, even if it looks different (`youtu.be/…` vs `youtube.com/watch?v=…`, `www.`, `http`/`https`, and tracking bits like `utm_…`, `si`, `igsh`, `fbclid` are ignored). Tracking bits are also removed from the address you save.
- **Grid / List**, **sort**, **search** (title, site, notes, tags), and **filters** for status, favorites, platform and tags.
- The **Tags page** shows how many characters *and* links use each tag; renaming, merging and deleting tags updates both.
- The **ZIP backup** now also contains a `Link Vault` folder: `links.json` (every link with its notes, tags, status and characters) and your custom thumbnails.

Handy shortcuts on a computer: `/` jumps to search, `N` makes a new character (or a new link in the Link Vault), `R` opens a random one, `T` opens Tags, `H` goes home, `Esc` goes back.
Pasting or dropping an image on the board starts a new character with it.

---

## One-time setup (about 10 minutes)

You need to do three things: **1)** set up the database, **2)** tell Supabase where your app lives, **3)** turn on GitHub Pages. For the Link Vault there are two more: **4)** deploy the link-preview function (for website thumbnails) and **5)** create the iPhone “Save to Vault” shortcut.

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
| `20261104_02_link_vault.sql` | The **Link Vault**: tables for links, their tags and their characters (each with Row Level Security, so only you see your links), and an update so merging tags also moves links. Nothing existing is changed or deleted |

> Until `20261104_02_link_vault.sql` has been run, the Link Vault shows *“One quick setup step”* — your characters keep working normally.

> If the app ever says *"The database needs an update"*, a file in that folder hasn't been run yet.

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

### 4. Link previews: deploy the Edge Function (Supabase dashboard, ~3 minutes)

This small server-side helper looks up a website's title and preview picture (browsers aren't allowed to do that themselves). Without it, the Link Vault still works — links just get the placeholder card (YouTube thumbnails always work).

1. In Supabase, open your project and click **Edge Functions** in the left sidebar.
2. Click **Deploy a new function** → **Via Editor**.
3. An editor opens with some example code. Select all of it and delete it.
4. Open [`supabase/functions/link-preview/index.ts`](supabase/functions/link-preview/index.ts) here on GitHub, click **Copy raw file** (two overlapping squares, top-right), and paste it into the editor.
5. At the bottom, set the **function name** to exactly: `link-preview`
6. Click **Deploy function** and wait for the green *“Successfully deployed”* message.
7. Leave the setting **“Verify JWT” / “Enforce JWT verification”** **on** (the default).
   *Only if* previews never appear and the browser console says *401 Invalid JWT*: open the function → **Details** (or **Settings**) → turn that switch off → **Save**. That's still safe: the function itself checks that you're logged in to your project before doing anything.

To check it works: add a link to any normal website (e.g. a Wikipedia page) — its picture and title should appear within a few seconds.

What it does and doesn't do (it fetches pages on your behalf, so it's strict): it only answers logged-in users of your project, only fetches `http://` / `https://` addresses on the normal ports, refuses private and local network addresses (also after redirects), gives up after 5 seconds, reads at most 512 KB, and never downloads images. If you ever use another address for the app than `https://tkz-design.github.io`, add it to the `ALLOWED_ORIGINS` list at the top of the file and deploy again.

> Updating it later: Edge Functions → **link-preview** → **Code** → paste the new version → **Deploy**.

### 5. “Save to Vault” in the iPhone Share sheet (Shortcuts app, ~3 minutes)

This adds **Save to Vault** to the Share sheet in YouTube, X, Instagram, Reddit, Safari, etc. It opens the app with the link already filled in.

1. Open the **Shortcuts** app → **Shortcuts** tab → tap **+** (top right).
2. Tap the name at the top (*“New Shortcut”*) → **Rename** → type `Save to Vault` → **Done**.
3. Tap the **ⓘ** button at the bottom (or the name at the top → **Details**) and turn on **Show in Share Sheet**. Tap **Done**.
   A block *“Receive **Any** input from **Share Sheet**”* now appears at the top. Tap **Any** and choose only **URLs**, **Text** and **Safari web pages** (this keeps the menu tidy). Next to *“If there's no input”*, choose **Get Clipboard** — then you can also run the shortcut from the widget after copying a link.
4. Tap **Search Actions** at the bottom, search **Get URLs from Input**, and tap it. It should say *“Get URLs from **Shortcut Input**”*.
5. Search **Get Item from List**, tap it. It should say *“Get **First Item** from **URLs**”*.
6. Search **URL Encode**, tap it. It should say *“**Encode** **Item from List**”*.
7. Search **Text**, tap the **Text** action. In its box type exactly
   `https://tkz-design.github.io/Character-board/?add=`
   and then, right after the `=` (no space), tap **URL Encoded Text** in the bar above the keyboard to insert it as a variable.
8. Search **Open URLs**, tap it. It should say *“Open **Text**”*.
9. Tap **Done** (top right).

**Use it:** in any app, tap **Share** → scroll the row of apps or actions → **Save to Vault** (if you don't see it: **Edit Actions…** at the bottom of the list → add it to *Favorites*). Safari opens the Link Vault with the *Add link* form filled in — check it and tap **Save**. The first time, iOS asks whether the shortcut may open the page: tap **Allow**.

> **Log in once in Safari.** The shortcut opens Safari, and iPhone keeps an app you added to the Home Screen separate from Safari — so you need to be logged in in Safari too (once; it remembers you). If you're not logged in, the link waits for you: log in and the form appears (within 30 minutes).
>
> Inside the Home Screen app you can still use **Paste link**: in the other app tap **Share → Copy link**, then open the app and tap **Paste link**.

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
3. Once installed, **Stash** appears in Android's **Share** sheet: in your gallery, browser or any other app, tap **Share → Stash** on an image and it opens straight to *New character / Add to existing*. Sharing a **link** (from YouTube, X, a browser…) opens the Link Vault's *Add link* form instead.
   (If you installed the app before this feature existed and it doesn't show up in the Share sheet, remove the app from your home screen and install it again. Sharing into web apps isn't supported on iPhone — use the **Paste** button there.)

### Pasting on a phone
Copy an image in another app, open Stash and tap **Paste** (on the board, in *New character*, or under *Add images* on a character). Your browser may ask for permission first. If it blocks access, a box appears instead: **long-press it and choose Paste**.

---

## Is my stuff really private?

- The code in this repository is public (that's how free GitHub Pages works), but it contains **no data**.
- The "publishable key" in `src/config.js` is designed to be public. By itself it can't read anything — every request is checked by the Row Level Security rules from `setup.sql`, which only allow a logged-in user to touch rows and files they own.
- Images are stored in a **private** bucket. The app shows them using temporary links that expire after one hour. Custom link thumbnails are stored there too.
- Embedded X / Instagram / Reddit posts and YouTube videos run in their own sandboxed frames from those sites, so their code can never read your login. Preview pictures from other sites are loaded without telling them which page you came from.

---

## For the curious / developers

- Built with [Vite](https://vite.dev) + plain JavaScript, [supabase-js](https://supabase.com/docs/reference/javascript) and [JSZip](https://stuk.github.io/jszip/).
- `npm install` then `npm run dev` runs it locally at http://localhost:5173/.
  Add `?mock` to the URL (http://localhost:5173/?mock) to try the interface with fake in-memory data and no login — this only exists in development and is never included in the published app.
- `npm run build` creates the production site in `dist/`.
- The deploy workflow lives in `.github/workflows/deploy.yml`.
- Database / storage / security rules: `supabase/setup.sql`, then the files in `supabase/migrations/`.
- `npm test` runs the unit tests (name matching, tag rules, link parsing / duplicate keys, and the Edge Function's safety checks).

| File | What it is |
| --- | --- |
| `src/main.js` | App shell: routing, hub bar, section headers, paste & drop handling, `?add=` links, login state |
| `src/sections.js` | The list of hub sections (add an entry here to add a section) |
| `src/links.js` | Link helpers: finding a URL in text, platforms, YouTube IDs, embeds, tracking-parameter clean-up, duplicate keys |
| `src/previews.js` | Talks to the `link-preview` Edge Function and saves the results |
| `supabase/functions/link-preview/index.ts` | The Edge Function (Open Graph previews, with the safety checks) |
| `src/api.js` | Everything that talks to Supabase |
| `src/compress.js` | In-browser image resizing/compression |
| `src/views/` | The screens: login, home, grid, detail, tags, Link Vault (`vault.js`, `link-detail.js`, `add-link.js`, `embeds.js`), dialogs, lightbox |
| `src/text.js` | Tag clean-up and the "similar name" matching |
| `src/hash.js`, `src/paste.js`, `src/share.js` | Duplicate-image check, Paste button, Android share target |
| `public/sw.js`, `public/manifest.webmanifest` | What makes it installable (PWA) |
