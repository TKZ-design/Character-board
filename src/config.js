// Supabase connection details.
// The publishable (anon) key is SAFE to ship in a website: it can only do
// what the Row Level Security policies in supabase/setup.sql allow, which is
// "a logged-in user can only touch their own rows and files".
// You can override these at build time with VITE_SUPABASE_URL / VITE_SUPABASE_KEY.
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://imorekpkzucpjpplyabq.supabase.co';
export const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_oO86_JTYHYRfyfsqRuBfJQ__5ELMHQZ';

export const BUCKET = 'character-images';

// Image compression settings
export const MAX_IMAGE_SIZE = 2000; // longest side, in pixels
export const THUMB_SIZE = 640;      // grid thumbnails
export const IMAGE_QUALITY = 0.85;
