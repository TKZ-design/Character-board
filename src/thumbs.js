import { api } from './state.js';

/** Fill every <img data-path> inside `container` with a signed URL. */
export async function loadThumbs(container) {
  const imgs = [...container.querySelectorAll('img[data-path]')];
  if (!imgs.length) return;
  try {
    const urls = await api.getUrls(imgs.map((i) => i.dataset.path));
    for (const img of imgs) {
      const u = urls[img.dataset.path];
      if (u) { img.onload = () => img.classList.add('loaded'); img.src = u; }
    }
  } catch (e) { console.error(e); }
}
