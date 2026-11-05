import { api, state, tagsOf, groupById, findChar } from './state.js';
import { toast, errorToast } from './ui.js';

const safe = (s) => (s || 'untitled').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'untitled';
const ext = (path) => (path.match(/\.(\w+)$/) || [, 'webp'])[1];

/**
 * Download everything as a ZIP: one folder of images per character + characters.json,
 * and the Link Vault as links.json (+ your own link thumbnails in links/).
 */
export async function exportZip() {
  const chars = state.characters;
  const links = state.links;
  if (!chars.length && !links.length) { toast('Nothing to back up yet'); return; }
  const t = toast('Preparing backup…', { timeout: 0 });
  try {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    const total = chars.reduce((n, c) => n + c.images.length, 0) + links.filter((l) => l.image_path).length;
    let done = 0, failed = 0;
    const used = new Set();
    const meta = [];
    const jobs = [];

    for (const c of chars) {
      let folder = safe(c.name), n = 2;
      while (used.has(folder.toLowerCase())) folder = `${safe(c.name)} (${n++})`;
      used.add(folder.toLowerCase());
      const files = c.images.map((im, i) => ({ im, name: `${String(i + 1).padStart(2, '0')}.${ext(im.path)}` }));
      const cover = files.find((f) => f.im.id === c.cover_image_id) || files[0];
      meta.push({
        name: c.name,
        source: c.source || '',
        tags: tagsOf(c).map((t) => t.name),
        tag_groups: Object.fromEntries(tagsOf(c).map((t) => [t.name, groupById(t.group_id)?.name || null])),
        notes: c.notes || '',
        links: c.links || [],
        favorite: !!c.is_favorite,
        created_at: c.created_at,
        folder,
        cover: cover ? `${folder}/${cover.name}` : null,
        images: files.map((f) => `${folder}/${f.name}`),
      });
      for (const f of files) {
        jobs.push(async () => {
          try {
            zip.file(`${folder}/${f.name}`, await api.downloadImage(f.im.path));
          } catch (e) { failed++; console.error(e); }
          done++;
          t.update(`Downloading images… ${done} / ${total}`);
        });
      }
    }

    // ----- Link Vault -----
    const folderOf = new Map(meta.map((m, i) => [chars[i].id, m.folder]));
    const linkMeta = links.map((l, i) => {
      const thumb = l.image_path ? `links/${String(i + 1).padStart(3, '0')}-${safe(l.title || 'link').slice(0, 40)}.${ext(l.image_path)}` : null;
      if (thumb) {
        jobs.push(async () => {
          try { zip.file(thumb, await api.downloadImage(l.image_path)); } catch (e) { failed++; console.error(e); }
          done++;
          t.update(`Downloading images… ${done} / ${total}`);
        });
      }
      return {
        url: l.url,
        title: l.title || '',
        description: l.description || '',
        platform: l.platform,
        site_name: l.site_name || '',
        status: l.status === 'done' ? 'done' : 'to watch',
        favorite: !!l.is_favorite,
        notes: l.notes || '',
        tags: tagsOf(l).map((x) => x.name),
        characters: (l.character_ids || []).map(findChar).filter(Boolean).map((c) => ({ name: c.name, folder: folderOf.get(c.id) || null })),
        preview_image: l.thumbnail_url || null,
        custom_thumbnail: thumb,
        created_at: l.created_at,
      };
    });

    // download 4 at a time
    const queue = [...jobs];
    await Promise.all(Array.from({ length: 4 }, async () => { while (queue.length) await queue.shift()(); }));

    zip.file('characters.json', JSON.stringify({
      app: 'Character Inspiration Board',
      exported_at: new Date().toISOString(),
      count: meta.length,
      characters: meta,
    }, null, 2));
    if (state.linksReady) {
      zip.file('links.json', JSON.stringify({
        app: 'Link Vault',
        exported_at: new Date().toISOString(),
        count: linkMeta.length,
        links: linkMeta,
      }, null, 2));
    }

    t.update('Zipping…');
    // images are already compressed, so just store them (much faster)
    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' }, (m) => t.update(`Zipping… ${Math.round(m.percent)}%`));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `character-board-backup-${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
    t.close();
    toast(failed ? `Backup downloaded, but ${failed} image(s) failed` : `Backup downloaded (${meta.length} characters, ${linkMeta.length} links, ${total} images)`,
      { type: failed ? 'error' : 'ok', timeout: 6000 });
  } catch (e) {
    t.close();
    errorToast(e);
  }
}
