// Link Vault folders: the actions (new, rename, move, reorder, delete), the
// "choose a folder" dialog and the Folder field used in forms.
import { h, icon, modal, toast, errorToast, confirmDialog, promptDialog } from '../ui.js';
import { api, state } from '../state.js';
import {
  MAX_DEPTH, folderById, pathText, depthOf, createProblem, moveProblem, reorder, deletePlan, applyDelete,
  flattenTree, nextPosition, nameClash, childrenOf,
} from '../folders.js';
import { go, rerender } from '../nav.js';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
export const folderHref = (scope) => (!scope ? '#/links' : scope === 'unsorted' ? '#/links/unsorted' : `#/links/f/${scope}`);

/** Turn database errors into plain sentences. */
function friendly(e, name) {
  const m = e?.message || '';
  if (e?.code === '23505' || /duplicate key|unique/i.test(m)) return new Error(`There’s already a folder called “${name}” there.`);
  if (/3 levels deep/i.test(m)) return new Error(`Folders can only be ${MAX_DEPTH} levels deep.`);
  return e;
}

// ---------------- actions ----------------

export async function newFolder(parentId = null) {
  if (parentId && depthOf(state.folders, parentId) >= MAX_DEPTH) {
    toast(`Folders can only be ${MAX_DEPTH} levels deep — “${folderById(state.folders, parentId).name}” can’t have subfolders.`, { timeout: 6000 });
    return null;
  }
  const where = parentId ? `in “${pathText(state.folders, parentId)}”` : 'at the top level';
  const name = await promptDialog('New folder', {
    label: `Name (${where})`, okText: 'Create', placeholder: 'e.g. Tutorials', maxlength: 80,
    validate: (v) => createProblem(state.folders, parentId, v),
  });
  if (!name) return null;
  try {
    const f = await api.createFolder({ name, parent_id: parentId, position: nextPosition(state.folders, parentId) });
    state.folders.push(f);
    if (parentId) { state.vaultOpen.add(parentId); }
    toast(`Created “${f.name}”`, { type: 'ok', timeout: 1800 });
    rerender();
    return f;
  } catch (e) { errorToast(friendly(e, name)); return null; }
}

export async function renameFolder(f) {
  const name = await promptDialog(`Rename “${f.name}”`, {
    label: 'New name', value: f.name, okText: 'Rename', maxlength: 80,
    validate: (v) => { const c = nameClash(state.folders, f.parent_id, v, f.id); return c ? `There’s already a folder called “${c.name}” here.` : null; },
  });
  if (!name || name === f.name) return;
  try {
    Object.assign(f, await api.updateFolder(f.id, { name }));
    rerender();
  } catch (e) { errorToast(friendly(e, name)); }
}

export async function moveFolder(f) {
  const parentId = await pickFolder({
    title: `Move “${f.name}” to…`, okText: 'Move here', topLabel: 'Top level', current: f.parent_id ?? null,
    reason: (id) => (id === (f.parent_id ?? null) ? 'It’s already here' : moveProblem(state.folders, f.id, id)),
  });
  if (parentId === undefined) return;
  try {
    Object.assign(f, await api.updateFolder(f.id, { parent_id: parentId, position: nextPosition(state.folders, parentId) }));
    if (parentId) state.vaultOpen.add(parentId);
    toast(`Moved to ${parentId ? `“${pathText(state.folders, parentId)}”` : 'the top level'}`, { type: 'ok', timeout: 2000 });
    rerender();
  } catch (e) { errorToast(friendly(e, f.name)); }
}

export async function moveFolderBy(f, dir) {
  const changes = reorder(state.folders, f.id, dir);
  if (!changes.length) return;
  const before = changes.map((c) => ({ id: c.id, position: folderById(state.folders, c.id).position }));
  for (const c of changes) folderById(state.folders, c.id).position = c.position;
  rerender();
  try {
    await Promise.all(changes.map((c) => api.updateFolder(c.id, { position: c.position })));
  } catch (e) {
    for (const b of before) folderById(state.folders, b.id).position = b.position;
    errorToast(e);
    rerender();
  }
}

export async function deleteFolder(f) {
  const plan = deletePlan(state.folders, state.links, f.id);
  const where = plan.parentId ? `“${pathText(state.folders, plan.parentId)}”` : 'the top level';
  const linkWhere = plan.parentId ? where : 'Unsorted';
  const parts = [];
  if (plan.linkIds.length) parts.push(`its ${plural(plan.linkIds.length, 'link')} will move to ${linkWhere}`);
  if (plan.subfolders.length) parts.push(`its ${plural(plan.subfolders.length, 'subfolder')} (with everything in them) will move to ${where}`);
  const renamed = plan.subfolders.filter((s) => s.to !== s.from);
  const msg = (parts.length ? `No links are deleted: ${parts.join(', and ')}.` : 'It’s empty.')
    + (renamed.length ? ` ${renamed.map((s) => `“${s.from}” will be renamed “${s.to}”`).join(', ')} because that name is taken there.` : '');
  const ok = await confirmDialog(`Delete folder “${f.name}”?`, msg, { okText: 'Delete folder' });
  if (!ok) return;
  try {
    const rows = await api.deleteFolder(f.id);
    state.folders = applyDelete(state.folders, state.links, f.id); // same result as the database…
    if (rows) state.folders = rows;                                  // …but trust the database's copy
    toast(`Deleted “${f.name}”`, { type: 'ok' });
    if (state.vaultScope === f.id || !folderById(state.folders, state.vaultScope)) go(folderHref(plan.parentId));
    else rerender();
  } catch (e) { errorToast(e); }
}

/** The "⋯" menu for a folder. */
export function folderMenu(f) {
  const sibs = childrenOf(state.folders, f.parent_id);
  const i = sibs.findIndex((s) => s.id === f.id);
  const canSub = depthOf(state.folders, f.id) < MAX_DEPTH;
  const item = (ic, label, fn, disabled = false, title = null) => h('button.menu-item', {
    type: 'button', disabled, title, onclick: () => { menu.hidden = true; fn(); },
  }, icon(ic), label);
  const menu = h('div.menu.folder-menu', { hidden: true, role: 'menu' },
    item('plus', 'New subfolder', () => newFolder(f.id), !canSub, canSub ? null : `Folders can only be ${MAX_DEPTH} levels deep`),
    item('edit', 'Rename', () => renameFolder(f)),
    item('folder', 'Move to…', () => moveFolder(f)),
    item('up', 'Move up', () => moveFolderBy(f, -1), i <= 0),
    item('down', 'Move down', () => moveFolderBy(f, 1), i < 0 || i >= sibs.length - 1),
    item('trash', 'Delete folder…', () => deleteFolder(f)));
  const btn = h('button.icon-btn', {
    type: 'button', 'aria-label': `Folder options for ${f.name}`, title: 'Folder options', 'aria-haspopup': 'true',
    onclick: (e) => {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
      if (!menu.hidden) setTimeout(() => document.addEventListener('click', () => (menu.hidden = true), { once: true }));
    },
  }, icon('menu'));
  return h('div.menu-wrap', btn, menu);
}

// ---------------- choosing a folder ----------------

/**
 * Dialog listing every folder. Resolves to the chosen folder id, null for the
 * first entry (Unsorted / Top level), or undefined when cancelled.
 * `reason(id)` returns why an entry can't be chosen (or null).
 */
export function pickFolder({ title, okText = 'Move here', topLabel = 'Unsorted', current, reason = () => null }) {
  return new Promise((resolve) => {
    let chosen;   // undefined until something is picked
    let result;
    const ok = h('button.btn.primary', { type: 'submit', disabled: true }, okText);
    const list = h('ul.folder-pick', { role: 'listbox', 'aria-label': 'Folders' });
    const entries = [{ id: null, name: topLabel, depth: 0 }, ...flattenTree(state.folders).map((r) => ({ id: r.folder.id, name: r.folder.name, depth: r.depth }))];
    function draw() {
      list.replaceChildren(...entries.map((e) => {
        const why = reason(e.id);
        const on = chosen === e.id;
        return h('li', h(`button.folder-pick-option${on ? '.on' : ''}`, {
          type: 'button', role: 'option', 'aria-selected': String(on), disabled: !!why,
          style: `--depth:${e.depth}`,
          onclick: () => { chosen = e.id; ok.disabled = false; draw(); },
          ondblclick: () => { if (!why) { result = e.id; dlg.close(); } },
        },
          icon(e.id ? 'folder' : (topLabel === 'Unsorted' ? 'tray' : 'home')),
          h('span.folder-pick-text',
            h('span.folder-pick-name', e.name, e.id === current ? h('span.muted', ' — current') : null),
            why && e.id !== current ? h('span.folder-pick-why', why) : null)));
      }));
    }
    const dlg = modal(
      h('form.dialog-body', { method: 'dialog', onsubmit: (e) => { e.preventDefault(); if (chosen !== undefined) { result = chosen; dlg.close(); } } },
        h('p.eyebrow', 'Link Vault'),
        h('h2', title),
        list,
        h('div.row.folder-pick-foot',
          h('button.btn', { type: 'button', onclick: async () => {
            const parent = chosen ?? null;
            const f = await newFolder(parent && depthOf(state.folders, parent) < MAX_DEPTH ? parent : null);
            if (f) { entries.splice(0, entries.length, { id: null, name: topLabel, depth: 0 }, ...flattenTree(state.folders).map((r) => ({ id: r.folder.id, name: r.folder.name, depth: r.depth }))); if (!reason(f.id)) { chosen = f.id; ok.disabled = false; } draw(); }
          } }, icon('plus'), 'New folder'),
          h('span.spacer'),
          h('button.btn', { type: 'button', onclick: () => dlg.close() }, 'Cancel'),
          ok)),
      { cls: 'folder-pick-modal', onClose: () => resolve(result) },
    );
    draw();
    list.querySelector('.folder-pick-option.on, .folder-pick-option:not(:disabled)')?.focus();
  });
}

/** <select> for forms: Unsorted + every folder, indented. `.value()` → folder id or null. */
export function folderSelect(value = null) {
  const pad = (d) => '   '.repeat(d - 1);
  const select = h('select.group-select.wide.folder-select', { 'aria-label': 'Folder' },
    h('option', { value: '', selected: !value }, 'Unsorted'),
    flattenTree(state.folders).map((r) => h('option', { value: r.folder.id, selected: r.folder.id === value }, pad(r.depth) + r.folder.name)));
  return { el: select, value: () => select.value || null };
}

