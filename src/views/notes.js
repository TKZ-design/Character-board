// Notes: quick text notes — newest first, search, add, edit, delete, copy.
// Notes also arrive from the iPhone "Stash Note" Shortcut (quick-save Edge Function).
import { h, icon, toast, errorToast, modal, confirmDialog } from '../ui.js';
import { api, state } from '../state.js';
import { MAX_NOTE, noteMatches, newestFirst, splitLinks, noteDate, wasEdited } from '../notes.js';

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

export function filteredNotes() {
  return newestFirst(state.notes.filter((n) => noteMatches(n, state.noteSearch)));
}

/** "123 / 5000" under a note field; turns red over the limit. */
function counter(textarea) {
  const el = h('span.note-count', { 'aria-live': 'polite' });
  const update = () => {
    const n = textarea.value.length;
    el.textContent = n > MAX_NOTE * 0.8 ? `${n.toLocaleString()} / ${MAX_NOTE.toLocaleString()}` : '';
    el.classList.toggle('over', n > MAX_NOTE);
  };
  textarea.addEventListener('input', update);
  update();
  return el;
}

/** Grow a textarea with its text (up to a limit set in CSS). */
function autoGrow(textarea) {
  const fit = () => { textarea.style.height = 'auto'; textarea.style.height = textarea.scrollHeight + 2 + 'px'; };
  textarea.addEventListener('input', fit);
  requestAnimationFrame(fit);
}

/** Checks a note's text. Returns an error message or null. */
function problemWith(body) {
  if (!body) return 'Write something first.';
  if (body.length > MAX_NOTE) return `That’s ${body.length.toLocaleString()} characters — notes can be at most ${MAX_NOTE.toLocaleString()}.`;
  return null;
}

async function addNote(body) {
  const row = await api.createNote(body);
  state.notes.unshift(row);
  return row;
}

/** The "Write a note…" box at the top of the Notes page. */
function composer(rerender) {
  const input = h('textarea', {
    rows: 1, placeholder: 'Write a note…', 'aria-label': 'New note', enterkeyhint: 'enter', maxlength: MAX_NOTE + 500,
  });
  const save = h('button.btn.primary', { type: 'submit' }, 'Save');
  let busy = false;
  const submit = async () => {
    if (busy) return;
    const body = input.value.trim();
    const problem = problemWith(body);
    if (problem) { toast(problem); input.focus(); return; }
    busy = true; save.disabled = true;
    try {
      await addNote(body);
      input.value = '';
      toast('Note saved', { type: 'ok' });
      rerender();
    } catch (e) { errorToast(e); } finally { busy = false; save.disabled = false; }
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); }
  });
  autoGrow(input);
  return h('form.note-compose', { onsubmit: (e) => { e.preventDefault(); submit(); } },
    h('span.quick-add-icon', icon('plus')),
    input,
    counter(input),
    save);
}

/** Add or edit a note in a dialog. Resolves when closed. */
export function openNoteEditor(note = null, after) {
  const input = h('textarea.note-editor', { rows: 10, placeholder: 'Your note…', maxlength: MAX_NOTE + 500 });
  input.value = note?.body || '';
  const original = input.value;
  const err = h('p.field-error', { role: 'alert', hidden: true });
  const save = h('button.btn.primary', { type: 'submit' }, note ? 'Save changes' : 'Save note');
  const dirty = () => input.value !== original;

  const dlg = modal(
    h('form.dialog-body', {
      onsubmit: async (e) => {
        e.preventDefault();
        const body = input.value.trim();
        const problem = problemWith(body);
        if (problem) { err.textContent = problem; err.hidden = false; input.focus(); return; }
        if (note && body === note.body) { dlg.close(); return; }
        save.disabled = true;
        try {
          if (note) Object.assign(note, await api.updateNote(note.id, body));
          else await addNote(body);
          dlg.close();
          toast(note ? 'Note updated' : 'Note saved', { type: 'ok' });
          after?.();
        } catch (e2) { errorToast(e2); save.disabled = false; }
      },
    },
      h('h2', note ? 'Edit note' : 'New note'),
      h('label.field', h('span', 'Note'), input),
      h('div.note-editor-foot', err, counter(input)),
      h('div.row.end',
        h('button.btn', { type: 'button', onclick: () => dlg.close() }, 'Cancel'),
        save)),
    { cls: 'note-modal' },
  );
  // Don't lose typing to a stray tap outside the dialog or the Esc key
  dlg.addEventListener('click', (e) => { if (e.target === dlg && dirty()) e.stopImmediatePropagation(); }, true);
  dlg.addEventListener('cancel', (e) => { if (dirty()) { e.preventDefault(); toast('Tap Cancel to discard your changes.'); } });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save.click(); }
  });
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}

/** Copy text, with a fallback for older browsers / non-secure contexts. */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = h('textarea', { readonly: true, style: 'position:fixed;top:0;left:0;opacity:0;' });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch {}
    ta.remove();
    return ok;
  }
}

function noteBody(note) {
  return h('div.note-body', splitLinks(note.body).map((p) =>
    p.url ? h('a', { href: p.url, target: '_blank', rel: 'noopener noreferrer' }, p.text) : p.text));
}

function noteCard(note, rerender) {
  const body = noteBody(note);
  const more = h('button.btn.ghost.note-more', { type: 'button', hidden: true, 'aria-expanded': 'false', onclick: () => {
    const open = body.classList.toggle('open');
    more.textContent = open ? 'Show less' : 'Show more';
    more.setAttribute('aria-expanded', String(open));
  } }, 'Show more');
  const remove = async () => {
    const preview = note.body.length > 80 ? note.body.slice(0, 80) + '…' : note.body;
    if (!(await confirmDialog('Delete note?', `“${preview}” will be deleted. This can’t be undone.`))) return;
    try {
      await api.deleteNote(note.id);
      state.notes = state.notes.filter((n) => n.id !== note.id);
      toast('Note deleted');
      rerender();
    } catch (e) { errorToast(e); }
  };
  const card = h('article.note',
    h('p.note-meta', h('time', { datetime: note.created_at, title: new Date(note.created_at).toLocaleString() }, noteDate(note.created_at)),
      wasEdited(note) ? h('span', ' · edited') : null),
    body,
    more,
    h('div.note-actions',
      h('button.btn.small-btn', { type: 'button', onclick: async () => { const ok = await copyText(note.body); toast(ok ? 'Copied' : 'Couldn’t copy — select the text instead', { type: ok ? 'ok' : 'error' }); } },
        icon('copy'), 'Copy'),
      h('button.btn.small-btn', { type: 'button', onclick: () => openNoteEditor(note, rerender) }, icon('edit'), 'Edit'),
      h('button.btn.small-btn.danger.ghost', { type: 'button', onclick: remove }, icon('trash'), 'Delete')));
  // Long notes are folded; show the button only when there's more to see
  requestAnimationFrame(() => { if (body.scrollHeight > body.clientHeight + 4) more.hidden = false; });
  return card;
}

/** Title, add button, composer and search for the Notes page. */
export function notesMasthead(render, renderView) {
  const search = h('input#search', {
    type: 'search', placeholder: 'Search your notes', value: state.noteSearch,
    oninput: (e) => { state.noteSearch = e.target.value; renderView(); },
  });
  const n = state.notes.length;
  return h('header.masthead.vault-head.notes-head',
    h('div.masthead-row',
      h('div.titleblock',
        h('p.eyebrow', `Notes · ${plural(n, 'note')}`),
        h('h1.title', 'Notes', h('span.title-dot', '.'))),
      h('div.actions',
        state.notesReady ? h('button.btn.primary.new-btn', { onclick: () => openNoteEditor(null, render), title: 'New note (N)' }, 'Add note') : null)),
    state.notesReady ? composer(render) : null,
    state.notesReady && n ? h('nav.filterbar', { 'aria-label': 'Search' }, h('label.search.notes-search', h('span.search-label', 'Search'), search)) : null);
}

export function renderNotes(root, rerender) {
  if (state.notesReady === null) { root.replaceChildren(h('div.loading', h('div.spinner'))); return; }
  if (state.notesReady === false) {
    root.replaceChildren(h('div.empty',
      h('h2', 'One quick setup step'),
      h('p.muted', 'Notes need their database table. In Supabase → SQL Editor, run the file supabase/migrations/20261105_01_notes.sql (the README has the exact steps), then reload this page. Nothing else is affected.'),
      h('button.btn.primary', { onclick: () => location.reload() }, 'Reload')));
    return;
  }
  if (!state.notes.length) {
    root.replaceChildren(h('div.empty',
      h('h2', 'No notes yet'),
      h('p.muted', 'Write one above — or on iPhone, use the “Stash Note” shortcut to jot something down without opening the app.'),
      h('button.btn.primary', { onclick: () => openNoteEditor(null, rerender) }, 'Add note')));
    return;
  }
  const list = filteredNotes();
  const total = state.notes.length;
  root.replaceChildren(
    h('p.result-count', state.noteSearch.trim() ? `${list.length} of ${plural(total, 'note')}` : plural(total, 'note')),
    list.length
      ? h('div.notes-list', list.map((n) => noteCard(n, rerender)))
      : h('div.empty',
          h('h2', 'No matches'),
          h('p.muted', 'No note contains those words.'),
          h('button.btn', { onclick: () => { state.noteSearch = ''; rerender(); } }, 'Clear search')));
}
