# Character Inspiration Board

A private, installable web app for collecting character references: images, tags, notes and source links.
Your data lives in **your own Supabase project**, and only you can see it once you're logged in.

**Your app's address (after setup):** https://tkz-design.github.io/Character-board/

---

## What it does

- **Characters** with a name, any number of images, tags, notes and source links
- **Add images** by dragging them onto the page, choosing files (works with your phone's photo library/camera), or pasting with **Ctrl+V / Cmd+V**
- Images are **shrunk in your browser before uploading** (max 2000 px, WebP or JPEG), so they take up less storage
- **Masonry grid** with **search by name** and **filtering by one or more tags**
- **Detail view** with a gallery, full-size zoom (click the image, use arrow keys or swipe), editing and delete
- **Cover image**: hover an image in a character's gallery (always visible on phones) and press the picture icon to make it the image shown on the grid
- **Favorites**: star characters (on the card or in the detail view) and use the **★ Favorites** button to show only those
- Dark mode by default, with a light mode toggle (☀️/🌙 button, your choice is remembered)
- **Installable** on desktop and phone like a normal app

Handy shortcuts on a computer: `/` jumps to search, `N` makes a new character, `Esc` goes back to the board.
Pasting or dropping an image on the board starts a new character with it.

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
- Database / storage / security rules: `supabase/setup.sql`.

| File | What it is |
| --- | --- |
| `src/main.js` | App shell: routing, header, paste & drop handling, login state |
| `src/api.js` | Everything that talks to Supabase |
| `src/compress.js` | In-browser image resizing/compression |
| `src/views/` | The screens: login, grid, detail, dialogs, lightbox |
| `public/sw.js`, `public/manifest.webmanifest` | What makes it installable (PWA) |
