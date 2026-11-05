// Pure Notes helpers (no DOM) — unit tested in tests/notes.test.js.
import { normName } from './text.js';

/** The longest note the database accepts (same limit as the quick-save Edge Function). */
export const MAX_NOTE = 5000;

/** Does a note match the search box? Ignores case, accents and punctuation; every word must appear. */
export function noteMatches(note, query) {
  const words = normName(query).split(' ').filter(Boolean);
  if (!words.length) return true;
  const body = normName(note.body);
  return words.every((w) => body.includes(w));
}

/** Notes, newest first. */
export function newestFirst(notes) {
  return [...notes].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

/**
 * Split a note into plain text and http(s) links, so links can be shown clickable
 * without ever inserting HTML: [{ text } | { url, text }].
 */
export function splitLinks(body) {
  const out = [];
  const s = String(body ?? '');
  const re = /https?:\/\/[^\s<>"'`]+/gi;
  let last = 0;
  for (const m of s.matchAll(re)) {
    const raw = m[0].replace(/[)\]}>.,;:!?'"’”]+$/u, '');
    const start = m.index;
    let ok = false;
    try { ok = ['http:', 'https:'].includes(new URL(raw).protocol); } catch {}
    if (!ok) continue;
    if (start > last) out.push({ text: s.slice(last, start) });
    out.push({ url: raw, text: raw });
    last = start + raw.length;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  return out;
}

/** "Today 14:05", "Yesterday 09:12", "3 Nov", "3 Nov 2025". */
export function noteDate(iso, nowDate = new Date()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(nowDate) - day(d)) / 86400e3);
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (diff === 0) return `Today ${time}`;
  if (diff === 1) return `Yesterday ${time}`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(d.getFullYear() !== nowDate.getFullYear() ? { year: 'numeric' } : {}) });
}

/** Was the note changed after it was written? (more than a minute later) */
export function wasEdited(note) {
  return !!note.updated_at && new Date(note.updated_at) - new Date(note.created_at) > 60_000;
}
