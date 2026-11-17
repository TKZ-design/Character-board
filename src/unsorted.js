// "N new in Unsorted": which saved links arrived since you last looked, per device.
// Pure functions (no browser, no database) so they can be tested; src/state.js keeps the memory in localStorage.

const at = (iso) => Date.parse(iso) || 0;

/**
 * Links in Unsorted that arrived after `seenAt` (an ISO time) — except links you added yourself in this app
 * (`ownIds`), which you obviously know about.
 */
export function newInUnsorted(unsortedLinks, seenAt, ownIds = []) {
  if (!seenAt) return [];
  const own = new Set(ownIds);
  const since = at(seenAt);
  return unsortedLinks.filter((l) => at(l.created_at) > since && !own.has(l.id));
}

/** Move "last looked" forward to the newest of `links` (never backwards). Returns an ISO time. */
export function advanceSeen(seenAt, links) {
  let best = seenAt || '';
  for (const l of links) if (at(l.created_at) > at(best)) best = l.created_at;
  return best;
}

/** The first time this device runs the feature: start from the newest link, so nothing old is announced. */
export function firstSeen(links, nowIso) {
  return advanceSeen('', links) || nowIso;
}
