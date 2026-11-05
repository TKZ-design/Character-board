import { h, icon } from '../ui.js';
import { state, findChar, coverOf } from '../state.js';
import { matchesSearch } from '../text.js';
import { loadThumbs } from '../thumbs.js';

let uid = 0;

/**
 * Pick characters to connect a link to: chips for the chosen ones and a
 * searchable suggestion list (name or source). Returns { el, value() → [ids] }.
 */
export function charPicker(initial = []) {
  const chosen = initial.filter(findChar);
  const id = `char-picker-${++uid}`;
  const chips = h('span.chips');
  const list = h('ul.tag-suggest', { id: `${id}-list`, role: 'listbox', 'aria-label': 'Characters', hidden: true });
  const input = h('input.tag-entry', {
    placeholder: state.characters.length ? 'Add character…' : 'No characters yet', disabled: !state.characters.length,
    autocomplete: 'off', autocapitalize: 'off', spellcheck: false, enterkeyhint: 'done',
    role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': list.id, 'aria-label': 'Add character',
  });
  let options = [];
  let active = -1;

  function draw() {
    chips.replaceChildren(...chosen.map((cid, i) => {
      const c = findChar(cid);
      return h('span.chip.removable', c.name,
        h('button', { type: 'button', 'aria-label': `Remove ${c.name}`, onclick: () => { chosen.splice(i, 1); draw(); input.focus(); } }, icon('close')));
    }));
  }

  function suggest() {
    options = state.characters.filter((c) => !chosen.includes(c.id) && matchesSearch(c, input.value)).slice(0, 8);
    active = options.length ? 0 : -1;
    render();
  }

  function render() {
    list.replaceChildren(...(options.length ? options.map((c, i) => {
      const cover = coverOf(c);
      return h(`li.tag-option.char-option${i === active ? '.active' : ''}`, {
        id: `${id}-opt-${i}`, role: 'option', 'aria-selected': String(i === active),
        onpointerdown: (e) => e.preventDefault(),
        onclick: () => pick(c),
      },
        h('span.tag-option-name',
          h('span.char-pick-thumb.small', cover ? h('img', { alt: '', 'data-path': cover.thumb_path || cover.path }) : null),
          h('span', c.name)),
        h('span.tag-option-group', c.source || ''));
    }) : input.value.trim() ? [h('li.tag-option.muted', 'No characters match')] : []));
    const open = list.children.length > 0;
    list.hidden = !open;
    input.setAttribute('aria-expanded', String(open));
    if (open && active >= 0) input.setAttribute('aria-activedescendant', `${id}-opt-${active}`);
    else input.removeAttribute('aria-activedescendant');
    list.children[active]?.scrollIntoView?.({ block: 'nearest' });
    loadThumbs(list);
  }

  function pick(c) {
    if (!chosen.includes(c.id)) chosen.push(c.id);
    input.value = '';
    draw();
    suggest();
    input.focus();
  }
  function close() { options = []; active = -1; render(); }

  input.addEventListener('input', suggest);
  input.addEventListener('focus', suggest);
  input.addEventListener('blur', () => setTimeout(close, 120));
  input.addEventListener('keydown', (e) => {
    const open = !list.hidden && options.length;
    if (e.key === 'ArrowDown' && open) { e.preventDefault(); active = (active + 1) % options.length; render(); }
    else if (e.key === 'ArrowUp' && open) { e.preventDefault(); active = (active - 1 + options.length) % options.length; render(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (open && active >= 0) pick(options[active]); }
    else if (e.key === 'Escape' && !list.hidden) { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'Backspace' && !input.value && chosen.length) { chosen.pop(); draw(); }
  });

  draw();
  const box = h('div.tag-input', { onclick: (e) => e.target === box && input.focus() }, chips, input);
  return { el: h('div.tag-input-wrap', box, list), value: () => [...chosen] };
}
