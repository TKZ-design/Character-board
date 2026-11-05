import { h, icon } from '../ui.js';
import { state, findChar } from '../state.js';
import { matchesSearch } from '../text.js';

let uid = 0;

/**
 * Pick characters for a link: chips + a type-to-search list (name or source).
 * Same look and keyboard handling as the tag field. Returns { el, value() } — value() is a list of ids.
 */
export function charPicker(initial = []) {
  const ids = initial.filter((id) => findChar(id));
  const id = `char-picker-${++uid}`;
  const chips = h('span.chips');
  const list = h('ul.tag-suggest', { id: `${id}-list`, role: 'listbox', 'aria-label': 'Characters', hidden: true });
  const input = h('input.tag-entry', {
    placeholder: state.characters.length ? 'Type a character’s name…' : 'No characters yet',
    disabled: !state.characters.length,
    enterkeyhint: 'done', autocomplete: 'off', spellcheck: false,
    role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': list.id, 'aria-label': 'Add character',
  });
  let options = [];
  let active = -1;

  function draw() {
    chips.replaceChildren(...ids.map((cid, i) => {
      const c = findChar(cid);
      return h('span.chip.removable', c?.name || '?',
        h('button', { type: 'button', 'aria-label': `Remove ${c?.name || 'character'}`, onclick: () => { ids.splice(i, 1); draw(); input.focus(); } }, icon('close')));
    }));
  }
  function suggest() {
    const q = input.value.trim();
    if (!q) { close(); return; }
    options = state.characters.filter((c) => !ids.includes(c.id) && matchesSearch(c, q)).slice(0, 8);
    active = options.length ? 0 : -1;
    render();
  }
  function render() {
    list.replaceChildren(...(options.length
      ? options.map((c, i) => h(`li.tag-option${i === active ? '.active' : ''}`, {
          id: `${id}-opt-${i}`, role: 'option', 'aria-selected': String(i === active),
          onpointerdown: (e) => e.preventDefault(),
          onclick: () => { add(c.id); input.focus(); },
        }, h('span.tag-option-name', c.name), h('span.tag-option-group', c.source || '')))
      : input.value.trim() ? [h('li.tag-option.muted', { role: 'option', 'aria-disabled': 'true' }, 'No matching character')] : []));
    const open = list.children.length > 0;
    list.hidden = !open;
    input.setAttribute('aria-expanded', String(open));
    if (open && active >= 0) input.setAttribute('aria-activedescendant', `${id}-opt-${active}`);
    else input.removeAttribute('aria-activedescendant');
  }
  function close() { options = []; active = -1; list.replaceChildren(); render(); }
  function add(cid) { if (!ids.includes(cid)) ids.push(cid); input.value = ''; close(); draw(); }

  input.addEventListener('input', suggest);
  input.addEventListener('keydown', (e) => {
    const open = options.length > 0;
    if (e.key === 'ArrowDown' && open) { e.preventDefault(); active = (active + 1) % options.length; render(); }
    else if (e.key === 'ArrowUp' && open) { e.preventDefault(); active = (active - 1 + options.length) % options.length; render(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (open && active >= 0) add(options[active].id); }
    else if (e.key === 'Escape' && !list.hidden) { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'Backspace' && !input.value && ids.length) { ids.pop(); draw(); }
  });
  input.addEventListener('blur', () => setTimeout(close, 100));

  draw();
  const box = h('div.tag-input', { onclick: (e) => e.target === box && input.focus() }, chips, input);
  return { el: h('div.tag-input-wrap', box, list), value: () => [...ids] };
}
