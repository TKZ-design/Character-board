// Shared navigation hooks (set up by main.js) to avoid circular imports.
const hooks = { rerender: () => {}, pasteTarget: null };

export function go(hash) {
  if (location.hash === hash) hooks.rerender();
  else location.hash = hash;
}
export function rerender() { hooks.rerender(); }
export function setRerender(fn) { hooks.rerender = fn; }

/** Who receives pasted images right now (dialog > page). */
export function setPasteTarget(fn) { hooks.pasteTarget = fn; }
export function getPasteTarget() { return hooks.pasteTarget; }
