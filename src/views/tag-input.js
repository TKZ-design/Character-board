import { h, icon } from '../ui.js';
import { allTags, normTag } from '../state.js';

/** Chip-style tag editor. Returns { el, value() }. */
export function tagInput(initial = []) {
  const tags = [...initial];
  const listId = 'tag-sugg-' + Math.random().toString(36).slice(2);
  const chips = h('span.chips');
  const input = h('input.tag-entry', {
    placeholder: 'Add tag…', list: listId, enterkeyhint: 'done', autocapitalize: 'off',
    'aria-label': 'Add tag',
  });
  const datalist = h('datalist', { id: listId }, allTags().map(({ tag }) => h('option', { value: tag })));

  function add(raw) {
    for (const part of raw.split(',')) {
      const t = normTag(part);
      if (t && !tags.includes(t)) tags.push(t);
    }
    input.value = '';
    draw();
  }
  function draw() {
    chips.replaceChildren(...tags.map((t, i) =>
      h('span.chip.removable', t,
        h('button', { type: 'button', 'aria-label': `Remove tag ${t}`, onclick: () => { tags.splice(i, 1); draw(); } }, icon('close')))));
  }
  input.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ',') && input.value.trim()) { e.preventDefault(); add(input.value); }
    else if (e.key === 'Enter') e.preventDefault();
    else if (e.key === 'Backspace' && !input.value && tags.length) { tags.pop(); draw(); }
  });
  // picking a suggestion from the datalist fires "input" with the full value
  input.addEventListener('input', (e) => {
    if (e.inputType === 'insertReplacementText' || e.inputType == null) add(input.value);
  });
  input.addEventListener('blur', () => input.value.trim() && add(input.value));
  draw();
  const el = h('div.tag-input', { onclick: (e) => e.target === el && input.focus() }, chips, input, datalist);
  return { el, value: () => { if (input.value.trim()) add(input.value); return [...tags]; } };
}
