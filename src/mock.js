// DEVELOPMENT ONLY: an in-memory fake backend, enabled with `?mock` on the
// dev server. Never included in the production build.
const delay = (ms = 60) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();
const blobs = new Map(); // path -> Blob
const user = { id: 'mock-user', email: 'you@example.com' };
let chars = [];

function swatch(color, w, h, label) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = color; x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(255,255,255,.85)'; x.font = `bold ${Math.round(w / 8)}px sans-serif`;
  x.fillText(label, w * 0.08, h * 0.55);
  return new Promise((r) => c.toBlob(r, 'image/png'));
}

async function seed() {
  const demo = [
    ['Captain Vex', ['sci-fi', 'villain'], '#7c3aed', 300, 420],
    ['Moss Witch', ['fantasy', 'hero'], '#15803d', 400, 300],
    ['Detective Oona', ['noir'], '#b45309', 300, 300],
    ['Pip the Courier', ['fantasy', 'sidekick'], '#0e7490', 300, 500],
  ];
  for (const [name, tags, color, w, h] of demo) {
    const id = crypto.randomUUID();
    const imgs = [];
    for (let i = 0; i < 2; i++) {
      const iid = crypto.randomUUID();
      const path = `${user.id}/${id}/${iid}.png`;
      blobs.set(path, await swatch(i ? '#334155' : color, w, h, name.split(' ')[0]));
      imgs.push({ id: iid, character_id: id, path, thumb_path: path, width: w, height: h, position: i, created_at: now() });
    }
    chars.push({ id, user_id: user.id, name, tags, notes: `Notes about ${name}.`, links: ['https://example.com/ref'],
      cover_image_id: null, is_favorite: false, created_at: now(), updated_at: now(), images: imgs });
  }
}

let seeded;
export const mockApi = {
  async getUser() { await (seeded ||= seed()); return user; },
  onAuthChange() {},
  async sendMagicLink() { await delay(); },
  async verifyCode() { await delay(); },
  async signOut() { location.reload(); },
  async listCharacters() { await delay(); return structuredClone(chars); },
  async createCharacter(f) {
    const c = { id: crypto.randomUUID(), user_id: user.id, tags: [], notes: '', links: [], cover_image_id: null,
      is_favorite: false, ...f, created_at: now(), updated_at: now(), images: [] };
    chars.unshift(c); return structuredClone(c);
  },
  async updateCharacter(id, patch) {
    const c = chars.find((x) => x.id === id); Object.assign(c, patch, { updated_at: now() });
    const { images, ...row } = c; return structuredClone(row);
  },
  async deleteCharacter(ch) { chars = chars.filter((c) => c.id !== ch.id); },
  async uploadImage(_u, characterId, img, position) {
    await delay(150);
    const id = crypto.randomUUID();
    const path = `${user.id}/${characterId}/${id}.${img.ext}`;
    const thumb_path = `${user.id}/${characterId}/${id}_thumb.${img.ext}`;
    blobs.set(path, img.full); blobs.set(thumb_path, img.thumb);
    const row = { id, character_id: characterId, path, thumb_path, width: img.width, height: img.height, position, created_at: now() };
    chars.find((c) => c.id === characterId).images.push(row);
    return structuredClone(row);
  },
  async deleteImage(image) {
    for (const c of chars) c.images = c.images.filter((i) => i.id !== image.id);
  },
  async getUrls(paths) {
    const out = {};
    for (const p of paths) if (blobs.has(p)) out[p] = (blobs.get(p).__url ||= URL.createObjectURL(blobs.get(p)));
    return out;
  },
  async downloadImage(path) { return blobs.get(path); },
};
