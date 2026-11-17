# Stash — Characters & Link Vault

A private, installable web app with two sections (more can be added later):

- **Characters** — your character inspiration board: images, tags, notes and source links.
- **Link Vault** — saved links (YouTube, X, Instagram Reels, Reddit, any website) in **folders** (like browser bookmarks), with thumbnails, their own tags, notes, a *To watch / Done* status, favorites and links to your characters.

Your data lives in **your own Supabase project**, and only you can see it once you're logged in.

**Your app's address (after setup):** https://tkz-design.github.io/Character-board/

---

## What it does

### Getting around
- There is **no home screen**. The app opens on the section you used last (**Characters** the very first time).
- **On a phone** a bar along the bottom has **Characters · Vault · (＋) · Recent · More**. It stays above the iPhone's home indicator and never covers your content. **On a computer** the same five items stand in a column down the left.
- The round **＋** button opens a small sheet: **New character**, **Add link**, **Paste link** (the link you just copied) and **Paste image** (the image you just copied).
- **Recent** shows the links you marked *To watch* first, then the 30 newest things you added (characters and links mixed, newest first).
- **More** holds **Tags** (for characters), **Vault tags**, **Backup (ZIP)**, the **Dark / Light** theme switch, the email you're signed in with, and **Sign out**. Any screen is at most two taps away.
- **New links waiting in Unsorted:** when you open the app or come back to it, your links reload by themselves. If links arrived in **Unsorted** since you last looked there (for example saved with **Save to Stash** from your iPhone), a banner above the bar says *“N new in Unsorted”* with a **Move to folder** button (or tap the words to open Unsorted, or ✕ to dismiss). Each phone or computer remembers on its own what it has already shown you, and links you add inside the app never count as new.
- The look is called **Pocket**: dark by default (a light version is one tap away in **More → Theme**, and your choice is remembered on each device).
- The installed app is called **Stash**. On iPhone, an app already on your Home Screen keeps its old name until you remove it and add it again (Safari → Share → Add to Home Screen).
- The installed app is called **Stash**. On iPhone, an app already on your Home Screen keeps its old name until you remove it and add it again (Safari → Share → Add to Home Screen).

### Characters
- **Grid or List**: the buttons above the characters switch between the two-column grid of cards (picture, name, *source · N images*) and a compact list (small picture, name, source, tags, image count, star). Your choice is remembered on each device.
- **Sort** by *Date added*, *Name* or *Last updated* (last edit or newest image)
- **Characters** with a name, an optional **source** (e.g. *Original*, a game or an anime), any number of images, tags, notes and source links
- **Add images** by dragging them onto the page, choosing files (works with your phone's photo library/camera), pasting with **Ctrl+V / Cmd+V**, **＋ → Paste image**, or — on Android — **sharing** them from any app (see below). On the board you're asked whether they're for a **new character** or should be **added to an existing one** (searchable by name or source)
- **Tags page** (**More → Tags**, or the **⋯** menu on Characters, or shortcut `T`): every tag with how many characters use it, organised into **groups** you create (e.g. Genre, Role, Mood). Create, rename, merge, move and delete tags; renaming updates every character at once. Tags ignore upper/lower case and extra spaces (“Mage” = “mage ”). When tagging a character, existing tags are suggested (with their group) as you type
- **Duplicate protection**: while you type a new character's name you'll see characters with the same or a similar name (Kael / Kaell). Same name **and** same source gets a strong warning. Every uploaded image is fingerprinted, so re-adding the exact same image gets you a warning too
- Images are **shrunk in your browser before uploading** (max 2000 px, WebP or JPEG), so they take up less storage
- **Search** by name or source (the 🔍 button, or `/`) and **filter chips** in one row that scrolls sideways: **All**, **Favorites**, then your tags (grouped like on the Tags page; pick one or more). A laptop shows more columns, and lets the chips wrap
- **Detail view** with a gallery, full-size zoom (click the image, use arrow keys or swipe), editing and delete
- **Reference link** on an image (optional): the web page an image came from. Hover an image in a character's gallery (always visible on phones) and press the **chain-link icon** to add, change or remove it. Images that have one show an **Open reference** button (on the image, and in the full-size view) that opens the page in a new tab; images without one show nothing extra. Right after adding images, the *“Added … images”* message has an **Add reference link** button to give all of them one link in one go. This is separate from the character's **Source** field and its *Source links*
- **Cover image**: hover an image in a character's gallery (always visible on phones) and press the picture icon to make it the image shown on the grid
- **Favorites**: star characters (on the card or in the detail view) and use the **★ Favorites** chip to show only those
- **🎲 Random** (the dice button): jumps to a random character — it respects your current search, tag and favorites filters (shortcut: `R`)
- **Compare**: open the **⋯** menu → **Compare characters**, tap 2 or 3 characters, then **Compare** to see them side by side
- **Backup**: **More → Backup (ZIP)** saves everything — one folder of full-size images per character, plus a `characters.json` file with all names, tags, notes, links, favorites and each image's reference link (`image_references`)
- **Installable** on desktop and phone like a normal app

### Link Vault
- **Save a link** any of these ways:
  - **＋ → Paste link** (reads the link on your clipboard — on iPhone, tap the little *Paste* bubble that appears) or **＋ → Add link** (type or paste it into the form)
  - **Ctrl+V / Cmd+V** anywhere in the app (not inside a text field)
  - the **“Save to Stash”** iPhone Shortcut in the Share sheet: **one tap, saved** — Safari doesn't open, a banner says *Saved ✓* or *Already saved* (set-up in step 6 below)
  - the older **“Save to Vault”** iPhone Shortcut (opens the app with the link filled in, so you can pick a folder or add notes first — step 5 below), or on Android **Share → Stash**
- Each link has a **title** (filled in automatically when possible), a **folder**, **notes**, **Vault tags**, **favorite**, **status** (*To watch* / *Done*) and optional **characters** it belongs to. Those links also show up on the character's page (with an **Add link** button there).

#### Folders
- Folders can have subfolders, **up to 3 levels** (e.g. *Art › Tutorials › Anatomy*). A 4th level is refused with a message. Every link is in exactly one folder, or in **Unsorted** (no folder).
- **On a computer**: the folder tree is on the left — *All links* and *Unsorted* at the top, then your folders with the number of links in each (including subfolders). Click ▸ to open or close a folder. The folder's contents are on the right.
- **On a phone**: a row of chips under the title — **All**, **Unsorted** (with its count) and your top-level folders — scrolls sideways. Tap a folder to go *into* it: the path at the top (*Vault › Art › Tutorials*) is tappable, **‹** goes up one level (`Esc` does the same on a computer), and its subfolders appear in a two-column **Folders** grid above the links.
- **Folder options** (the **⋮** button next to the folder's name): *New subfolder*, *Rename*, *Move to…* (into another folder or to the top level — you can't move a folder into itself or make it deeper than 3 levels), *Move up* / *Move down* (to change the order), *Delete folder…*.
- **Deleting a folder never deletes links.** Its links and subfolders move up one level (to the folder above it, or to the top level / Unsorted). You're told first how many items will move. If a subfolder's name is already taken where it moves to, it gets “(2)” added.
- **Moving links**: open the **⋯** menu → **Select links**, tap the links you want, then **Move to folder…** and pick a folder. You can also use **Move…** on a link's page, or the **Folder** field in *Edit*.
- **Adding a link**: the *Add link* form has a **Folder** field. It starts on the folder you're looking at; from *All links* it starts on the last folder you used in this browser. Links from the iPhone Shortcut, Android Share and Ctrl+V always start in **Unsorted** (you can still pick a folder before saving).
- **Search** (🔍) and the **Filter** button (**To watch / Done**, favorites, platform, Vault tags) work inside the folder you're in *and its subfolders*. In *All links* they search everything. Results show which folder each link is in (e.g. *Art › Tutorials*).

#### Vault tags
- The Link Vault has **its own tag list**, separate from character tags: the tag box, filters and suggestions in the Vault only show Vault tags, and the Characters tag box, **Tags** page, tag groups and counts only show character tags. A tag with the same name can exist on both sides (e.g. *Sci-fi*); they are simply two separate tags.
- **More → Vault tags** (or the **⋯** menu in the Vault, or `T`) opens **Manage Vault tags**: rename, merge and delete. Vault tags have no groups.
- **YouTube** (normal, `youtu.be`, Shorts and live links): the thumbnail comes straight from the video, and it **plays inside the app** with YouTube's privacy-enhanced player (youtube-nocookie.com).
- **X, Instagram, Reddit**: opening a link shows the post with the platform's **official embed**, loaded only when you open it.
- **Other websites** get their preview picture and title from the **link-preview** Edge Function (set-up below). Each link is looked up only once and the result is saved.
- No picture (common for X and Instagram)? You get a clean placeholder card with the platform, your title and the domain — and **Set thumbnail** lets you upload or paste a picture (a screenshot works well). It's shrunk like character images.
- **Duplicate warning**: if a link is already saved you'll be told, even if it looks different (`youtu.be/…` vs `youtube.com/watch?v=…`, `www.`, `http`/`https`, and tracking bits like `utm_…`, `si`, `igsh`, `fbclid` are ignored). Tracking bits are also removed from the address you save.
- **List** (picture on the left, title, *platform · status*) or **Grid**, **sort**, **search** (title, site, notes, tags), and the **Filter** sheet for status, favorites, platform and tags. The list is the default; your choice is remembered on each device.
- The **ZIP backup** also contains a `Link Vault` folder: `links.json` (every link with its folder path, notes, Vault tags, status and characters), `folders.json` (every folder with its full path, in your order), `vault-tags.json`, and your custom thumbnails.

Handy shortcuts on a computer: `/` jumps to search, `N` makes a new character (or a new link in the Link Vault), `R` opens a random one, `T` opens Tags (Vault tags when you're in the Link Vault), `H` goes to the section you used last, `Esc` goes back (in the Link Vault: up one folder).
Pasting or dropping an image on the board starts a new character with it.

---

## One-time setup (about 10 minutes)

You need to do three things: **1)** set up the database, **2)** tell Supabase where your app lives, **3)** turn on GitHub Pages. For the Link Vault there are two more: **4)** deploy the link-preview function (for website thumbnails) **5)** create the iPhone “Save to Vault” shortcut and/or **6)** set up one-tap **“Save to Stash”**.

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
| `20261116_01_vault_folders_tags.sql` | **Folders** for the Link Vault and the Vault's **own tag list** (both with Row Level Security). Also converts your existing links once — see below |
| `20261116_02_image_reference_url.sql` | The optional **Reference link** on character images (one new empty field; only `http://` / `https://` addresses up to 2000 characters are accepted). Nothing existing is changed or deleted, and the existing privacy rules cover it |

> Until the newest file has been run, the Link Vault shows *“One quick setup step”* — your characters keep working normally.

**What `20261116_01_vault_folders_tags.sql` does to your existing links (one time only):**
Until now, characters and links shared one tag list. This file gives the Link Vault its own folders and tags, and sorts your links in for you:
1. Each link goes into a **folder named after one of its tags** — the tag that's used on the most links (if two are equally popular, the alphabetically first). Example: a link tagged *Tutorial* and *Sci-fi*, where *Tutorial* is on more links, goes into the folder *Tutorial*.
2. The link's **other tags** (*Sci-fi* in the example) are copied to the new **Vault tags**, so nothing is lost.
3. Links with no tags go to **Unsorted**. Folders are only made for tags that end up holding at least one link, all at the top level, in alphabetical order.
4. Links stop using the old shared tags. A shared tag that **no character uses** any more is then deleted; tags your characters still use stay exactly as they are, and **tag groups are not touched**.
5. **No link and no character is ever deleted.** Running the file a second time changes nothing.

> **Make a backup first** (**More → Backup (ZIP)**) before running it, just in case.

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

**Use it:** in any app, tap **Share** → scroll the row of apps or actions → **Save to Vault** (if you don't see it: **Edit Actions…** at the bottom of the list → add it to *Favorites*). Safari opens the Link Vault with the *Add link* form filled in — check it and tap **Save**. It's saved to **Unsorted** unless you choose another **Folder** in the form first. The first time, iOS asks whether the shortcut may open the page: tap **Allow**.

> **Log in once in Safari.** The shortcut opens Safari, and iPhone keeps an app you added to the Home Screen separate from Safari — so you need to be logged in in Safari too (once; it remembers you). If you're not logged in, the link waits for you: log in and the form appears (within 30 minutes).
>
> Inside the Home Screen app you can still use **Paste link**: in the other app tap **Share → Copy link**, then open the app and tap **Paste link**.

### 6. “Save to Stash”: save a link in one tap from the iPhone Share sheet (~10 minutes)

With this, **Share → Save to Stash** saves the link straight to **Unsorted** in your Link Vault and shows a banner: **Saved ✓**, **Already saved**, or a short reason why not. Safari never opens and you don't confirm anything. The title and thumbnail are looked up for you (that can take a few seconds before the banner appears).

It works through a second small server-side helper, **quick-save**. Because the Shortcut can't log in, the helper recognises you by a **personal secret key** instead. Four parts: **(a)** two secrets, **(b)** deploy the function, **(c)** build the Shortcut, and — only if needed — **(d)** change the key.

> The old **Save to Vault** shortcut (step 5) keeps working. Keep it as a fallback, and for links where you want to choose a folder or add notes right away.

#### (a) Create the two secrets (Supabase dashboard)

**First, make a strong key** (on your laptop):
1. Open any web page in Chrome, Edge or Firefox and press **F12** (Mac: **⌥ Option + ⌘ Command + J**). A panel opens; click its **Console** tab.
2. Click in the empty line at the bottom, paste this and press **Enter** (if the browser first asks you to type *allow pasting*, do that and paste again):
   `crypto.randomUUID() + crypto.randomUUID()`
3. A long line of letters, digits and dashes appears between quote marks. That's your key: copy it **without the quote marks** and keep the tab open for a moment. It's made on your own computer and isn't sent anywhere.
   *(No laptop at hand? Any password manager's generator works too: at least 40 characters, letters and digits only. The function refuses keys shorter than 20 characters.)*

**Then find your user ID:**
4. In Supabase, open your project → **Authentication** (left sidebar) → **Users**.
5. Find the row with your email address and copy the value in the **UID** column (click it, or use the **⋯** menu at the end of the row → **Copy user ID**). It looks like `1a2b3c4d-1234-5678-9abc-1a2b3c4d5e6f`.

**Now store both:**
6. Click **Edge Functions** in the left sidebar → **Secrets**.
7. Under *Add new secrets*: in **Name** type exactly `QUICK_SAVE_KEY`, in **Value** paste the key from step 3.
8. Click **Add another**: **Name** `OWNER_USER_ID`, **Value** your user ID from step 5.
9. Click **Save**. Both names now appear in the list (the values are hidden; that's normal).

> These two values live **only** in Supabase (and the key also inside your Shortcut). Never put them in this repository, in an issue, or in a chat. The file [`.env.example`](.env.example) lists their names with fake values, as a reminder of what exists.

#### (b) Deploy the function (same way as link-preview)

1. In Supabase click **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Select all the example code in the editor and delete it.
3. Open [`supabase/functions/quick-save/index.ts`](supabase/functions/quick-save/index.ts) here on GitHub, click **Copy raw file** (two overlapping squares, top-right), and paste it into the editor.
4. At the bottom, set the **function name** to exactly: `quick-save`
5. Click **Deploy function** and wait for the green *“Successfully deployed”* message.
6. **Switch off the login check for this one function:** open the **quick-save** function → **Details** (or **Settings**) tab → turn **off** the switch called **“Verify JWT with legacy secret”** (older dashboards: *“Enforce JWT verification”*) → **Save**.

**Why that switch must be off, and why that's safe here:** when it's on, Supabase only lets *logged-in users* call the function — and the Shortcut has no login, so every save would be refused. With it off, the function does its own check instead: it only acts when the request carries your secret key (step a), and it compares the key in a way that doesn't leak hints. Without the right key the answer is always the same “request refused”, and nothing is read or saved. Even with the key, the function can do exactly one thing: add a link to *your* Unsorted. It can't read, change or delete anything. Leave the switch **on** for `link-preview`; this is only for `quick-save`.

> **After every later re-deploy** (Edge Functions → **quick-save** → **Code** → paste the new version → **Deploy**), look at that switch again: some dashboard versions turn it back on.

#### (c) Build the “Save to Stash” Shortcut (iPhone)

1. Open the **Shortcuts** app → **Shortcuts** tab → tap **+** (top right).
2. Tap the name at the top (*“New Shortcut”*) → **Rename** → type `Save to Stash` → **Done**.
3. Tap the **ⓘ** button at the bottom (or the name at the top → **Details**) and turn on **Show in Share Sheet**. Tap **Done**.
   In the block *“Receive **Any** input from **Share Sheet**”* that appears at the top, tap **Any** and choose only **URLs**, **Text** and **Safari web pages**. Next to *“If there's no input”*, choose **Get Clipboard**.
4. Tap **Search Actions**, search **Get URLs from Input**, and tap it. It should say *“Get URLs from **Shortcut Input**”*.
5. Search **Get Item from List**, tap it. It should say *“Get **First Item** from **URLs**”*.
6. Search **Get Contents of URL**, tap it. Then set it up:
   - Tap the blue **URL** word in the action (it may be pre-filled with *Item from List* — delete that) and type exactly:
     `https://imorekpkzucpjpplyabq.supabase.co/functions/v1/quick-save`
   - Tap the small **arrow (›)** in the action to show more options.
   - **Method**: choose **POST**.
   - **Headers**: tap **Add new header**. **Key**: `x-stash-key` — **Value**: paste your secret key from step (a).
   - **Request Body**: choose **JSON**. Tap **Add new field** → **Text**. **Key**: `url` — tap **Value**, then pick **Item from List** from the variables bar above the keyboard.
7. Search **Show Notification**, tap it. It should say *“Show notification **Contents of URL**”*. If it says something else (like *Hello World*), tap that text, delete it, and pick **Contents of URL** from the variables bar.
8. Tap **Done** (top right).

**Use it:** in any app tap **Share** → **Save to Stash** (if you don't see it: **Edit Actions…** at the bottom of the list → add it to *Favorites*). A banner appears with the result. The first time, iOS asks whether the shortcut may connect to `imorekpkzucpjpplyabq.supabase.co` and may send notifications: choose **Always Allow** / **Allow**.

The link is in **Unsorted**. If Stash was already open, close and reopen it (or reload the page) to see it.

**Try it out:**
- Share any web page → banner **Saved ✓** → it's in Link Vault → Unsorted, with its title and picture.
- Share the same page again → banner **Already saved**, and no second copy appears.

| The banner says | What to do |
| --- | --- |
| `Not saved: request refused` | The key in the Shortcut and the `QUICK_SAVE_KEY` secret aren't identical (check for a missing character or an extra space), the secret is missing or shorter than 20 characters, or the header name isn't exactly `x-stash-key` |
| Something technical with `401`, `Missing authorization header` or `Invalid JWT` | The switch from step (b) 6 is (back) on. Turn it off |
| `Not saved: the OWNER_USER_ID secret is missing…` | Add or fix that secret — step (a) 5 and 8 |
| `Not saved: that is not a web link…` | What you shared didn't contain a normal `http://` or `https://` address |
| `Not saved: Stash could not be reached…` | Try again in a moment. If it keeps happening, check that the update files in step 1b have all been run |
| Nothing, or `404` / `not found` | The function name isn't exactly `quick-save`, or the address in step 6 has a typo |

> **Keep the key to yourself.** It's stored inside the Shortcut, so don't share this Shortcut with anyone (Share → *Copy iCloud Link* would include the key). To give someone the recipe, send them this README instead.

#### (d) If the key ever leaks: change it (2 minutes)

Anyone who has the key could add links to your Unsorted (nothing more — they can't see or delete anything). If you think someone has it:
1. Make a new key — the three steps at the start of (a).
2. Supabase → **Edge Functions** → **Secrets** → add a secret with the **same name** `QUICK_SAVE_KEY` and the new value → **Save**. It replaces the old one. From that moment the old key is refused.
3. On your iPhone: **Shortcuts** → tap **⋯** on **Save to Stash** → in *Get Contents of URL* → **Headers** → replace the value of `x-stash-key` with the new key → **Done**.
4. Share a link to test: **Saved ✓** means the new key works. *(If the old key still seems to work after a minute, deploy the function once more — step (b) “After every later re-deploy”.)*

To switch one-tap saving off entirely: delete the `QUICK_SAVE_KEY` secret (or the `quick-save` function). The function then refuses everyone.

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
- The **quick-save** function (one-tap saving from the iPhone) is the only part that works without a login. It only acts on a request that carries your personal secret key, which is stored as a Supabase secret and inside your Shortcut — never in this repository — and all it can do is add a link to your own Unsorted.
- Embedded X / Instagram / Reddit posts and YouTube videos run in their own sandboxed frames from those sites, so their code can never read your login. Preview pictures from other sites are loaded without telling them which page you came from.

---

## For the curious / developers

- Built with [Vite](https://vite.dev) + plain JavaScript, [supabase-js](https://supabase.com/docs/reference/javascript) and [JSZip](https://stuk.github.io/jszip/).
- `npm install` then `npm run dev` runs it locally at http://localhost:5173/.
  Add `?mock` to the URL (http://localhost:5173/?mock) to try the interface with fake in-memory data and no login — this only exists in development and is never included in the published app. To see the “new in Unsorted” banner there, press **F12 → Console**, type `__mockQuickSave()` and press Enter, then switch to another browser tab and back.
- `npm run build` creates the production site in `dist/`.
- The deploy workflow lives in `.github/workflows/deploy.yml`.
- Database / storage / security rules: `supabase/setup.sql`, then the files in `supabase/migrations/`.
- `npm test` runs the unit tests (name matching, tag rules, link parsing / duplicate keys, folder rules, the tag → folder conversion, the “new in Unsorted” rules, the Edge Functions' safety checks, and Quick Save's key check, link validation and duplicate handling).
  The database test (`tests/migration.test.js`) runs every SQL file against a throwaway PostgreSQL database — including the conversion, twice. It only runs when you point it at a PostgreSQL server: `STASH_PG_URL=postgresql://postgres:postgres@localhost:5432/postgres npm test` (otherwise it's skipped).

| File | What it is |
| --- | --- |
| `src/main.js` | App shell: routing, screen headers, the bottom bar / side rail, paste & drop handling, `?add=` links, refresh-on-return, login state |
| `src/sections.js` | The list of tabs and which screens belong to them (add an entry here to add a tab) |
| `src/unsorted.js` | The rules for “N new in Unsorted” (plain functions, covered by `tests/unsorted.test.js`) |
| `src/styles/` | The look: `tokens.css` (colours, fonts, sizes — the place to change the design), `base.css` (buttons, fields, dialogs), `nav.css` (bar, rail, banner, More, Recent), `layout.css` (Characters and Vault), `screens.css` (detail pages, Tags, forms) |
| `src/folders.js` | Link Vault folder rules (paths, 3-level limit, move/delete behaviour) and the JavaScript copy of the tag → folder conversion |
| `src/links.js` | Link helpers: finding a URL in text, platforms, YouTube IDs, embeds, tracking-parameter clean-up, duplicate keys |
| `src/previews.js` | Talks to the `link-preview` Edge Function and saves the results |
| `supabase/functions/link-preview/index.ts` | The Edge Function (Open Graph previews, with the safety checks) |
| `supabase/functions/quick-save/index.ts` | The Quick Save Edge Function for the “Save to Stash” Shortcut. One self-contained file (it's pasted into the dashboard), so it carries its own copy of link-preview's safety checks and of the duplicate rules in `src/links.js`; `tests/quick-save.test.js` fails if the copies drift apart |
| `src/views/reference.js` | The “Reference link” on character images: the dialog and the *Open reference* button |
| `.env.example` | The names of the two Supabase secrets Quick Save needs, with fake values. The real ones are only ever typed into the Supabase dashboard |
| `src/api.js` | Everything that talks to Supabase |
| `src/compress.js` | In-browser image resizing/compression |
| `src/views/` | The screens: login, grid, detail, tags, Link Vault (`vault.js`, `folder-ui.js`, `vault-tags.js`, `link-detail.js`, `add-link.js`, `embeds.js`), Recent, More, the bottom bar (`tabbar.js`), the ＋ sheet (`add-sheet.js`), the Unsorted banner, dialogs, lightbox |
| `src/text.js` | Tag clean-up and the "similar name" matching |
| `src/hash.js`, `src/paste.js`, `src/share.js` | Duplicate-image check, Paste button, Android share target |
| `public/sw.js`, `public/manifest.webmanifest` | What makes it installable (PWA) |
