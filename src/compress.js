import { MAX_IMAGE_SIZE, THUMB_SIZE, IMAGE_QUALITY } from './config.js';

let webpSupported;
function canEncodeWebp() {
  if (webpSupported === undefined) {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    webpSupported = c.toDataURL('image/webp').startsWith('data:image/webp');
  }
  return webpSupported;
}

async function decode(file) {
  // createImageBitmap respects EXIF rotation (phone photos) in modern browsers
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Fallback: let an <img> decode it (covers e.g. HEIC on Safari)
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function toBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function render(source, srcW, srcH, maxSide, quality) {
  const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, w, h);
  let blob = canEncodeWebp() ? await toBlob(canvas, 'image/webp', quality) : null;
  if (!blob || blob.type !== 'image/webp') {
    // JPEG has no transparency: paint a neutral background underneath
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    blob = await toBlob(canvas, 'image/jpeg', quality);
  }
  canvas.width = canvas.height = 0; // free memory early (helps on phones)
  return { blob, width: w, height: h };
}

/**
 * Resize + re-encode an image file in the browser.
 * Returns { full, thumb, width, height, ext }.
 */
export async function compressImage(file) {
  const src = await decode(file);
  const srcW = src.width || src.naturalWidth;
  const srcH = src.height || src.naturalHeight;
  const full = await render(src, srcW, srcH, MAX_IMAGE_SIZE, IMAGE_QUALITY);
  const thumb = await render(src, srcW, srcH, THUMB_SIZE, 0.8);
  if (src.close) src.close();
  return {
    full: full.blob,
    thumb: thumb.blob,
    width: full.width,
    height: full.height,
    ext: full.blob.type === 'image/webp' ? 'webp' : 'jpg',
  };
}

export function isImageFile(f) {
  return f && (f.type.startsWith('image/') || /\.(heic|heif|avif|webp|jpe?g|png|gif|bmp)$/i.test(f.name || ''));
}
