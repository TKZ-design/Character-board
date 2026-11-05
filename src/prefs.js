// Per-device preferences (grid/list, sort order) in localStorage.
// Every access is wrapped: private windows or blocked storage just fall back to the default.
export function getPref(key, fallback, allowed) {
  try {
    const v = localStorage.getItem('cb-' + key);
    if (v != null && (!allowed || allowed.includes(v))) return v;
  } catch { /* storage unavailable */ }
  return fallback;
}
export function setPref(key, value) {
  try { localStorage.setItem('cb-' + key, value); } catch { /* storage unavailable */ }
}
