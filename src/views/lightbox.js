import { h, icon } from '../ui.js';
import { api } from '../state.js';

/** Full-screen image viewer with zoom, arrows, keyboard and swipe. */
export async function openLightbox(images, start = 0) {
  let i = start;
  let zoomed = false;
  const img = h('img.lb-img', { alt: '', draggable: false });
  const stage = h('div.lb-stage', img);
  const counter = h('div.lb-count');
  const prev = h('button.lb-nav.lb-prev', { 'aria-label': 'Previous image', onclick: (e) => { e.stopPropagation(); go(-1); } }, icon('back'));
  const next = h('button.lb-nav.lb-next', { 'aria-label': 'Next image', onclick: (e) => { e.stopPropagation(); go(1); } }, icon('next'));
  const close = h('button.lb-close', { 'aria-label': 'Close', onclick: () => dlg.close() }, icon('close'));
  const hint = h('div.lb-hint', 'Click image to zoom');
  const dlg = h('dialog.lightbox', stage, prev, next, close, counter, hint);
  document.body.append(dlg);
  dlg.showModal();

  async function show() {
    const im = images[i];
    setZoom(false);
    counter.textContent = images.length > 1 ? `${i + 1} / ${images.length}` : '';
    prev.hidden = next.hidden = images.length < 2;
    // show the thumbnail immediately, then swap in the full-size file
    const urls = await api.getUrls([im.thumb_path, im.path]);
    if (images[i] !== im) return;
    img.src = urls[im.thumb_path] || urls[im.path];
    const full = new Image();
    full.src = urls[im.path];
    full.decode().then(() => { if (images[i] === im) img.src = full.src; }).catch(() => {});
  }
  function go(d) { i = (i + d + images.length) % images.length; show(); }
  function setZoom(z) {
    zoomed = z;
    stage.classList.toggle('zoomed', z);
    hint.textContent = z ? 'Click to fit' : 'Click image to zoom';
  }

  img.addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = img.getBoundingClientRect();
    const rx = (e.clientX - rect.left) / rect.width, ry = (e.clientY - rect.top) / rect.height;
    setZoom(!zoomed);
    if (zoomed) {
      // keep the clicked point under the cursor
      requestAnimationFrame(() => {
        stage.scrollLeft = rx * stage.scrollWidth - stage.clientWidth / 2;
        stage.scrollTop = ry * stage.scrollHeight - stage.clientHeight / 2;
      });
    }
  });
  stage.addEventListener('click', (e) => { if (e.target === stage && !zoomed) dlg.close(); });
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === 'ArrowRight') go(1);
  });
  let sx = null, sy = null;
  stage.addEventListener('touchstart', (e) => { if (e.touches.length === 1) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; } }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (sx == null || zoomed || images.length < 2) return;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    sx = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  });
  dlg.addEventListener('close', () => dlg.remove());
  show();
}
