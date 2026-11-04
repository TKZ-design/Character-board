// Pure text helpers (no DOM) — unit tested in tests/text.test.js.

/** Tidy a tag/group name for display: trim, drop a leading "#", squeeze spaces. Keeps the casing. */
export function cleanTag(t) {
  return String(t ?? '').replace(/^\s*#/, '').trim().replace(/\s+/g, ' ');
}

/** Case-insensitive identity of a tag ("Mage" = "mage "). */
export function tagKey(t) {
  return cleanTag(t).toLowerCase();
}

/** Name/source normalised for comparing: lower case, no accents, punctuation → spaces. */
export function normName(s) {
  return String(s ?? '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Even looser: no spaces and doubled letters collapsed ("Kaell" → "kael"). */
function squash(s) {
  return normName(s).replace(/\s+/g, '').replace(/(.)\1+/gu, '$1');
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/**
 * How alike are two character names?
 * 'same'  — identical once case/spaces/accents are ignored
 * 'close' — a likely typo or variant (Kael / Kaell, Geralt / Geralt of Rivia)
 * null    — different
 */
export function nameMatch(a, b) {
  const na = normName(a), nb = normName(b);
  if (!na || !nb) return null;
  if (na === nb) return 'same';
  const sa = squash(a), sb = squash(b);
  if (sa === sb) return 'close';
  const shortest = Math.min(sa.length, sb.length);
  const allowed = shortest >= 8 ? 2 : shortest >= 4 ? 1 : 0;
  if (allowed && levenshtein(sa, sb) <= allowed) return 'close';
  // every word of the shorter name appears in the longer one
  if (shortest >= 4) {
    const [wa, wb] = [na.split(' '), nb.split(' ')];
    const [short, long] = wa.length <= wb.length ? [wa, wb] : [wb, wa];
    if (short.length < long.length && short.every((w) => long.includes(w))) return 'close';
  }
  return null;
}

/** Same source? Two empty sources count as the same (nothing tells them apart). */
export function sameSource(a, b) {
  return normName(a) === normName(b);
}

/**
 * Existing characters that look like the one being created.
 * Returns [{ c, match: 'same'|'close', strong: boolean }], strongest first.
 * strong = similar name AND same source → probably a duplicate.
 */
export function findSimilar(name, source, characters, { limit = 5 } = {}) {
  if (normName(name).length < 2) return [];
  const out = [];
  for (const c of characters) {
    const match = nameMatch(name, c.name);
    if (!match) continue;
    out.push({ c, match, strong: sameSource(source, c.source) });
  }
  const rank = (m) => (m.strong ? 0 : 2) + (m.match === 'same' ? 0 : 1);
  return out.sort((x, y) => rank(x) - rank(y)).slice(0, limit);
}

/** Does `query` match a character's name or source? (search box) */
export function matchesSearch(c, query) {
  const q = normName(query);
  if (!q) return true;
  return normName(c.name).includes(q) || normName(c.source).includes(q);
}
