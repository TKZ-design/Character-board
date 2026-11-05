import { h, icon } from '../ui.js';
import { state, tagByName, groupById, tagUsage } from '../state.js';
import { cleanTag, tagKey } from '../text.js';

let uid = 0;

/**
 * Chip-style tag editor with autocomplete from existing tags (showing their
 * group). Typing a new name offers "Create …". Matching is case-insensitive:
 * "mage " picks the existing "Mage". Returns { el, value() } — value() is a list of names.
 */
export function tagInput(initial = []) {
  const tags = [];
  const id = `tag-input-${++uid}`;
  const chips = h('span.chips');
  const list = h('ul.tag-suggest', { id: `${id}-list`, role: 'listbox', 'aria-label': 'Tag suggestions', hidden: true });
  const input = h('input.tag-entry', {
    placeholder: 'Add tag…', enterkeyhint: 'done', autocapitalize: 'off', autocomplete: 'off', spellcheck: false,
    role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': list.id, 'aria-label': 'Add tag',
  });
  let options = [];   // [{ name, create }]
  let active = -1;

  const has = (name) => tags.some((t) => tagKey(t) === tagKey(name));

  function add(raw) {
    for (const part of String(raw).split(',')) {
      const clean = cleanTag(part);
      if (!clean || has(clean)) continue;
      tags.push(tagByName(clean)?.name ?? clean); // reuse the existing spelling
    }
    input.value = '';
    close();
    draw();
  }

  function draw() {
    chips.replaceChildren(...tags.map((t, i) =>
      h('span.chip.removable', t,
        h('button', { type: 'button', 'aria-label': `Remove tag ${t}`, onclick: () => { tags.splice(i, 1); draw(); input.focus(); } }, icon('close')))));
  }

  function suggest() {
    const q = tagKey(input.value);
    if (!q) { close(); return; }
    const usage = tagUsage();
    const counts = new Map([...usage].map(([id, u]) => [id, u.total]));
    const pool = state.tagList.filter((t) => !has(t.name));
    const starts = pool.filter((t) => tagKey(t.name).startsWith(q));
    const contains = pool.filter((t) => !tagKey(t.name).startsWith(q) && tagKey(t.name).includes(q));
    const byUse = (a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0) || a.name.localeCompare(b.name);
    options = [...starts.sort(byUse), ...contains.sort(byUse)].slice(0, 8).map((t) => ({ name: t.name, tag: t }));
    const exists = state.tagList.some((t) => tagKey(t.name) === q) || has(input.value);
    if (!exists) options.push({ name: cleanTag(input.value), create: true });
    active = options.length ? 0 : -1;
    render();
  }

  function render() {
    list.replaceChildren(...options.map((o, i) => {
      const group = o.tag ? groupById(o.tag.group_id)?.name : null;
      return h(`li.tag-option${i === active ? '.active' : ''}${o.create ? '.create' : ''}`, {
        id: `${id}-opt-${i}`, role: 'option', 'aria-selected': String(i === active),
        onpointerdown: (e) => e.preventDefault(), // keep focus in the input
        onclick: () => { add(o.name); input.focus(); },
      },
        o.create
          ? [h('span.tag-option-name', icon('plus'), h('span', 'Create “', h('strong', o.name), '”')), h('span.tag-option-group', 'New tag')]
          : [h('span.tag-option-name', o.name), h('span.tag-option-group', group || 'Ungrouped')]);
    }));
    const open = options.length > 0;
    list.hidden = !open;
    input.setAttribute('aria-expanded', String(open));
    if (open && active >= 0) input.setAttribute('aria-activedescendant', `${id}-opt-${active}`);
    else input.removeAttribute('aria-activedescendant');
    list.children[active]?.scrollIntoView?.({ block: 'nearest' });
  }

  function close() { options = []; active = -1; render(); }

  input.addEventListener('input', suggest);
  input.addEventListener('focus', () => input.value && suggest());
  input.addEventListener('keydown', (e) => {
    const open = !list.hidden;
    if (e.key === 'ArrowDown' && open) { e.preventDefault(); active = (active + 1) % options.length; render(); }
    else if (e.key === 'ArrowUp' && open) { e.preventDefault(); active = (active - 1 + options.length) % options.length; render(); }
    else if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (open && active >= 0 && e.key === 'Enter') add(options[active].name);
      else if (input.value.trim()) add(input.value);
    }
    else if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'Backspace' && !input.value && tags.length) { tags.pop(); draw(); }
  });
  input.addEventListener('blur', () => { if (input.value.trim()) add(input.value); else close(); });

  for (const t of initial) if (!has(t)) tags.push(t);
  draw();
  const box = h('div.tag-input', { onclick: (e) => e.target === box && input.focus() }, chips, input);
  const el = h('div.tag-input-wrap', box, list);
  return { el, input, value: () => { if (input.value.trim()) add(input.value); return [...tags]; } };
}
