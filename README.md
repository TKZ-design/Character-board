# Stash — Characters, Link Vault & Notes

A private, installable web app with three sections (more can be added later):

- **Characters** — your character inspiration board: images, tags, notes and source links.
- **Link Vault** — saved links (YouTube, X, Instagram Reels, Reddit, any website) with thumbnails, tags, notes, a *To watch / Done* status, favorites and links to your characters.
- **Notes** — quick text notes, searchable, with copy, edit and delete.

On iPhone, **Save to Stash** (Share sheet) and **Stash Note** (Home Screen / Back Tap) save links and notes **silently** — no Safari, no login.

Your data lives in **your own Supabase project**, and only you can see it once you're logged in.

**Your app's address (after setup):** https://tkz-design.github.io/Character-board/

---

## What it does

### Hub
- After login you land on the **home screen** with a large tile per section (with counts and recent pictures).
- The thin bar at the top of every page jumps between **Stash · Characters · Link Vault · Notes**, and holds the light/dark toggle and the **⋮ menu** (backup, sign out). Shortcut `H` goes home.
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
  - the **“Save to Stash”** iPhone Shortcut in the Share sheet — saves silently in the background and shows *Saved ✓* (set-up: step 6), or on Android **Share → Stash**
- Each link has a **title** (filled in automatically when possible), **notes**, **tags** (the same tags and tag groups as your characters), **favorite**, **status** (*To watch* / *Done*) and optional **characters** it belongs to. Those links also show up on the character's page (with an **Add link** button there).
- **YouTube** (normal, `youtu.be`, Shorts and live links): the thumbnail comes straight from the video, and it **plays inside the app** with YouTube's privacy-enhanced player (youtube-nocookie.com).
- **X, Instagram, Reddit**: opening a link shows the post with the platform's **official embed**, loaded only when you open it.
- **Other websites** get their preview picture and title from the **link-preview** Edge Function (set-up below). Each link is looked up only once and the result is saved.
- No picture (common for X and Instagram)? You get a clean placeholder card with the platform, your title and the domain — and **Set thumbnail** lets you upload or paste a picture (a screenshot works well). It's shrunk like character images.
- **Duplicate warning**: if a link is already saved you'll be told, even if it looks different (`youtu.be/…` vs `youtube.com/watch?v=…`, `www.`, `http`/`https`, and tracking bits like `utm_…`, `si`, `igsh`, `fbclid` are ignored). Tracking bits are also removed from the address you save.
- **Grid / List**, **sort**, **search** (title, site, notes, tags), and **filters** for status, favorites, platform and tags.
- The **Tags page** shows how many characters *and* links use each tag; renaming, merging and deleting tags updates both.
- The **ZIP backup** now also contains a `Link Vault` folder: `links.json` (every link with its notes, tags, status and characters) and your custom thumbnails.

### Notes
- Tap the **Notes** tile on the home screen (or **Notes** in the top bar).
- **Write a note…** at the top: type and tap **Save** (on a computer: Ctrl+Enter / Cmd+Enter). Or **Add note** for a bigger editor (shortcut `N`).
- Newest notes first. Each shows when it was written (and *edited* if you changed it later). Long notes fold; **Show more** opens them. Links inside a note are clickable.
- **Search** finds notes containing all the words you type (upper/lower case and accents don't matter).
- **Copy** puts the note on your clipboard · **Edit** opens it (a stray tap outside won't throw away your changes) · **Delete** asks first.
- Up to 5,000 characters per note — a counter appears when you get close.
- From iPhone: the **“Stash Note”** shortcut (step 7) saves a note without opening the app; it shows up here.
- The **ZIP backup** contains a `Notes` folder: `notes.json` and `notes.md` (all notes in one file you can open anywhere).

Handy shortcuts on a computer: `/` jumps to search, `N` makes a new character (or a new link in the Link Vault), `R` opens a random one, `T` opens Tags, `H` goes home, `Esc` goes back.
Pasting or dropping an image on the board starts a new character with it.

---

## One-time setup (about 10 minutes)

You need to do three things: **1)** set up the database, **2)** tell Supabase where your app lives, **3)** turn on GitHub Pages. For link previews and the silent iPhone saves: **4)** let GitHub deploy the Edge Functions, **5)** give quick-save its two secrets, **6)** build the “Save to Stash” shortcut, **7)** build the “Stash Note” shortcut, **8)** delete the old “Save to Vault” shortcut. Step **9** is for later: how to change your key if it ever leaks.

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
| `20261105_01_notes.sql` | **Notes**: a `notes` table with Row Level Security — only you can read, add, change or delete your notes |

> Until `20261104_02_link_vault.sql` has been run, the Link Vault shows *“One quick setup step”* — your characters keep working normally. The same goes for Notes and `20261105_01_notes.sql`.

**Optional — prove that nobody else can read your notes:** open [`supabase/tests/notes_privacy_check.sql`](supabase/tests/notes_privacy_check.sql), copy it, paste it into a **New query** in the SQL Editor and tap **Run**. It pretends to be a second user, tries to read, change and delete a test note, and then throws all of its test data away again. You should see **“Notes privacy check passed ✓”**. (A red *PRIVACY CHECK FAILED* would mean the rules are missing — run `20261105_01_notes.sql` again.)

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

### 4. Deploy the Edge Functions automatically (GitHub + Supabase, ~5 minutes)

Stash has two small server-side helpers (“Edge Functions”) that run on Supabase:
- **link-preview** looks up a website's title and preview picture for the Link Vault.
- **quick-save** receives links and notes from your iPhone Shortcuts (steps 6 and 7).

GitHub publishes them to Supabase for you, every time their code changes. For that, GitHub needs two secrets. You do this **once**.

**4a. Get a Supabase access token**
1. Open https://supabase.com/dashboard/account/tokens (log in if asked).
2. Tap **Generate new token**. Name it `GitHub deploy` and pick an expiry date: choose the longest one offered, or *never* if it's an option. Tap **Generate token**.
3. **Copy the token now**. It's shown only once and starts with `sbp_`. Keep this tab open.

**4b. Add the two secrets to GitHub**
1. Open https://github.com/TKZ-design/Character-board/settings/secrets/actions
   (on iPhone: if you don't see the repository's **Settings**, tap **aA** in Safari's address bar → **Request Desktop Website**).
2. Tap **New repository secret**.
   - **Name:** `SUPABASE_ACCESS_TOKEN`
   - **Secret:** paste the token from 4a.
   - Tap **Add secret**.
3. Tap **New repository secret** again.
   - **Name:** `SUPABASE_PROJECT_REF`
   - **Secret:** `imorekpkzucpjpplyabq` (your project's ID: the part before `.supabase.co`)
   - Tap **Add secret**.

**4c. Run it once now**
1. Open the repository's **Actions** tab → in the list on the left tap **Deploy Supabase functions** → **Run workflow** → **Run workflow** (green button).
2. Wait 1–2 minutes and refresh. A green ✅ means both functions are live. You can check in Supabase → **Edge Functions**: you should see `link-preview` and `quick-save`.

From now on this happens by itself whenever function code changes on `main`.

> **If the secrets are missing**, this step just says *“Supabase functions were not deployed”* and stays green. Nothing breaks.
>
> **A red ❌?** Tap it to see the reason. Most often the token was mistyped or has expired: make a new one (4a) and replace the secret on the same GitHub page (tap the secret's name → **Update secret**).
>
> The old way (pasting `link-preview` into Supabase's online editor) **no longer works**, because the functions now share code with the app. Use the button in 4c instead.

What link-preview does and doesn't do (it fetches pages on your behalf, so it's strict):
- it only answers logged-in users of your project
- it only fetches `http://` / `https://` addresses on the normal ports, and refuses private and local network addresses (also after redirects)
- it gives up after 5 seconds, reads at most 512 KB, and never downloads images

If you ever use another address for the app than `https://tkz-design.github.io`, add it to the `ALLOWED_ORIGINS` list at the top of `supabase/functions/link-preview/index.ts`.

### 5. Give quick-save its two secrets (Supabase dashboard, ~5 minutes)

quick-save needs to know **who you are** (so saved things land in your account) and a **secret key** (so only your Shortcuts can use it).

**5a. Find your user ID**
1. In Supabase, open your project → **Authentication** (left sidebar) → **Users**.
2. Tap the row with **your email**.
3. Copy the **User UID**. It looks like `1a2b3c4d-1234-5678-9abc-def012345678`. Keep it somewhere for a minute, e.g. a new note in Apple Notes.

**5b. Make a long random key**
1. In Supabase, open **SQL Editor** → **+ New query**.
2. Paste this line and tap **Run**:
   ```sql
   select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') as my_new_key;
   ```
3. The result is a 64-character jumble of letters and numbers. That's your key. Copy it.
4. **Save it in your password manager.** For example, on iPhone open the **Passwords** app → **+** → *Website or Label:* `Stash quick-save key`, *Password:* paste it → **Save**.
   You'll need it again in steps 6 and 7. Close the query without saving it.

**5c. Add both as secrets**
1. In Supabase, open **Edge Functions** (left sidebar) → **Secrets** (in some versions: **Project Settings → Edge Functions → Secrets**).
2. Under **Add new secret**:
   - **Name:** `STASH_OWNER_USER_ID`, **Value:** your User UID from 5a.
   - Tap **Add another**:
   - **Name:** `STASH_QUICK_KEY`, **Value:** the key from 5b.
3. Tap **Save**. They take effect within a minute; no redeploy needed.

> These secrets only live on Supabase's servers. They're never in this (public) repository and never in the app that runs in your browser.

### 6. “Save to Stash” in the iPhone Share sheet (Shortcuts app, ~5 minutes)

This saves the link you're looking at **straight into your Link Vault**, without opening Safari or Stash and without logging in. A notification tells you **Saved ✓** or **Already saved**. It works in YouTube, Instagram, X, Reddit, Safari and any app with a Share button.

You need: the **key** from 5b (in your Passwords app) and this address:
`https://imorekpkzucpjpplyabq.supabase.co/functions/v1/quick-save`

1. Open the **Shortcuts** app → **Shortcuts** tab → tap **+** (top right).
2. Tap the name at the top (*“New Shortcut”*) → **Rename** → type `Save to Stash` → **Done**.
3. Tap the **ⓘ** button at the bottom (or the name at the top → **Details**) → turn on **Show in Share Sheet** → **Done**.
   A block *“Receive **Any** input from **Share Sheet**”* appears at the top.
   - Tap **Any** → deselect everything → select only **URLs** and **Text** → tap outside the list.
   - Next to *“If there's no input”*, tap **Continue** and choose **Get Clipboard**. Now you can also copy a link and run the shortcut from its Home Screen icon or widget.
4. *(Optional: a note with each link.)* Tap **Search Actions**, search **Ask for Input**, tap it.
   - Tap **Text** after “Ask for” and keep it as **Text**.
   - Tap **Prompt** and type `Note? (leave empty to skip)`.
   - When you share, you can type a note, or leave it empty and tap **Done**. (Tapping *Cancel* stops the shortcut, and nothing is saved.)
5. Search **Get Contents of URL** and tap it.
   - Tap the blue **URL** placeholder and paste the address above.
   - Tap the **›** arrow (or **Show More**) on that action:
     - **Method:** tap **GET** → choose **POST**.
     - **Headers:** tap **Add new header**. **Key:** `x-stash-key`, **Text:** paste your key from 5b (no spaces before or after).
     - **Request Body:** choose **JSON**.
     - Tap **Add new field** → **Text**. **Key:** `type`, **Text:** `link`
     - Tap **Add new field** → **Text**. **Key:** `url`. In its **Text** box, tap **Select Variable** (or the variable bar above the keyboard) → choose **Shortcut Input**.
     - *(Only if you added step 4)* **Add new field** → **Text**. **Key:** `note`, **Text:** choose the variable **Provided Input**.
6. Search **Show Notification** and tap it. Tap the word **Hello World!**, delete it, then choose the variable **Contents of URL**.
   (Tap the **›** arrow and turn off **Play Sound** if you prefer silence.)
7. Tap **Done** (top right).

**Use it:** in any app tap **Share** → **Save to Stash**. If you don't see it, scroll the row of actions to the end → **Edit Actions…** → tap **+** next to *Save to Stash* to add it to Favorites. The first time, iOS asks *“Allow Save to Stash to connect to imorekpkzucpjpplyabq.supabase.co?”*. Tap **Always Allow**.

The notification says one of:
| Message | Meaning |
| --- | --- |
| **Saved ✓** | Added to your Link Vault (title and picture are fetched automatically) |
| **Already saved** | That link is already in your vault, even if it looked a bit different |
| **No link found** | What you shared didn't contain a link |
| **Link not allowed** | A private or local network address. These are never saved, for safety |
| **Unauthorized** | The key in the shortcut doesn't match `STASH_QUICK_KEY`. Check for a typo or extra space |
| **Could not save, try again** | A temporary problem on Supabase's side |

Open Stash afterwards and the new link is there (if Stash was already open, it picks up new items when you switch back to it).

> **Keep the shortcut private.** It contains your key, so don't use Shortcuts' *Share* / *Copy iCloud Link* on it. If you ever did, change the key (step 9).

### 7. “Stash Note”: jot a quick note from anywhere (Shortcuts app, ~3 minutes)

1. **Shortcuts** app → **+** → rename it `Stash Note`.
2. Search **Ask for Input**, tap it. Keep **Text**. Tap **Prompt** → type `Note`. Tap the **›** arrow and turn on **Allow Multiple Lines**.
3. Search **Get Contents of URL**, tap it, paste the same address as in step 6, then tap **›**:
   - **Method:** **POST**
   - **Headers:** **Add new header**. **Key:** `x-stash-key`, **Text:** your key.
   - **Request Body:** **JSON**
   - **Add new field** → **Text**. **Key:** `type`, **Text:** `note`
   - **Add new field** → **Text**. **Key:** `body`, **Text:** choose the variable **Provided Input**.
4. Search **Show Notification**, tap it, replace *Hello World!* with the variable **Contents of URL**.
5. Tap **Done**. Run it once by tapping it, and allow the connection when asked. You should see **Note saved ✓**, and the note appears in Stash → **Notes**.

**Put it on your Home Screen:** in the Shortcuts app, long-press **Stash Note** → **Share** → **Add to Home Screen** → **Add**. (Or: long-press an empty spot on your Home Screen → **Edit** → **Add Widget** → **Shortcuts**.)

**Back Tap (tap the back of your iPhone twice):** **Settings** → **Accessibility** → **Touch** → **Back Tap** (at the bottom) → **Double Tap** → scroll to *Shortcuts* → choose **Stash Note**.
*(iPhone 15 Pro or newer: you can also use the Action button: **Settings** → **Action Button** → swipe to **Shortcut** → **Choose a Shortcut** → **Stash Note**.)*

### 8. Remove the old “Save to Vault” shortcut

“Save to Stash” replaces it, so you no longer need to be logged in in Safari.
1. Open the **Shortcuts** app → **Shortcuts** tab.
2. Long-press **Save to Vault** → **Delete** → **Delete Shortcut**.

> The old way still works if you ever need it: any link that opens `https://tkz-design.github.io/Character-board/?add=<link>` opens the Link Vault with the *Add link* form filled in. Inside the app you can also use **Paste link**.

### 9. If your key ever leaks: change it (~3 minutes)

The key is like a password for saving into your Stash. It can only **add** links and notes. It can't read, change or delete anything. Still, change it if you think someone else has seen it:
1. Make a new key (step **5b**) and save it in your Passwords app (edit the old entry).
2. Supabase → **Edge Functions** → **Secrets** → find **STASH_QUICK_KEY** → **⋯ / Edit** → paste the new key → **Save**. From this moment the old key stops working.
3. In the Shortcuts app, open **Save to Stash** and **Stash Note** in turn. In **Get Contents of URL** → **Headers**, replace the `x-stash-key` value with the new key → **Done**.
4. Test it: share any link with **Save to Stash**. You should see *Saved ✓* or *Already saved*.

If your **Supabase access token** (step 4a) ever leaks: delete it at https://supabase.com/dashboard/account/tokens, make a new one, and update `SUPABASE_ACCESS_TOKEN` in GitHub (step 4b).

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
- The **quick-save** helper (used by the iPhone Shortcuts) only accepts requests carrying your secret key, compares it in a way that doesn't leak hints, and answers a wrong key with nothing but *Unauthorized*. It can only **add** links and notes to your account — it can't read, change or delete anything. The key and your user ID are Supabase secrets, never in this repository or the browser. Its server-side database access (the “service role”) exists only on Supabase.
- Embedded X / Instagram / Reddit posts and YouTube videos run in their own sandboxed frames from those sites, so their code can never read your login. Preview pictures from other sites are loaded without telling them which page you came from.

---

## For the curious / developers

- Built with [Vite](https://vite.dev) + plain JavaScript, [supabase-js](https://supabase.com/docs/reference/javascript) and [JSZip](https://stuk.github.io/jszip/).
- `npm install` then `npm run dev` runs it locally at http://localhost:5173/.
  Add `?mock` to the URL (http://localhost:5173/?mock) to try the interface with fake in-memory data and no login — this only exists in development and is never included in the published app.
- `npm run build` creates the production site in `dist/`.
- The deploy workflows live in `.github/workflows/`: `deploy.yml` (the app → GitHub Pages) and `deploy-functions.yml` (Edge Functions → Supabase; needs the step-4 secrets, skips safely without them).
- Project conventions (for humans and AI helpers): [`CLAUDE.md`](CLAUDE.md). Secret *names* (never values): [`.env.example`](.env.example).
- Database / storage / security rules: `supabase/setup.sql`, then the files in `supabase/migrations/`.
- `npm test` runs the unit tests (name matching, tag rules, link parsing / duplicate keys, notes helpers, and both Edge Functions — safety checks, key check, validation, duplicates — with a fake network and database).

| File | What it is |
| --- | --- |
| `src/main.js` | App shell: routing, hub bar, section headers, paste & drop handling, `?add=` links, login state |
| `src/sections.js` | The list of hub sections (add an entry here to add a section) |
| `supabase/functions/_shared/links.js` (re-exported by `src/links.js`) | Link helpers shared by the app and quick-save: finding a URL in text, platforms, YouTube IDs, embeds, tracking-parameter clean-up, duplicate keys |
| `supabase/functions/_shared/preview.ts` | Safe fetching (no private addresses, timeouts, size caps) and Open Graph previews, shared by both Edge Functions |
| `src/previews.js` | Talks to the `link-preview` Edge Function and saves the results |
| `supabase/functions/link-preview/index.ts` | Edge Function: previews for logged-in users of the app |
| `supabase/functions/quick-save/index.ts` | Edge Function: silent saves from the iPhone Shortcuts (key check, validation, duplicate check) |
| `supabase/config.toml` | Function settings for the deploy (no secrets) |
| `src/views/notes.js`, `src/notes.js` | The Notes page and its helpers (search, dates, clickable links) |
| `src/api.js` | Everything that talks to Supabase |
| `src/compress.js` | In-browser image resizing/compression |
| `src/views/` | The screens: login, home, grid, detail, tags, Link Vault (`vault.js`, `link-detail.js`, `add-link.js`, `embeds.js`), dialogs, lightbox |
| `src/text.js` | Tag clean-up and the "similar name" matching |
| `src/hash.js`, `src/paste.js`, `src/share.js` | Duplicate-image check, Paste button, Android share target |
| `public/sw.js`, `public/manifest.webmanifest` | What makes it installable (PWA) |
