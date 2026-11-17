// The optional "Reference link" on a character image: a web address for where
// the image came from. (Not the character's "Source" field — that stays as it is.)
import { h, icon, modal, toast, errorToast, safeHref } from '../ui.js';
import { api } from '../state.js';
import { referenceLink, REFERENCE_MAX } from '../links.js';

/** The "Open reference" button for an image, or null when it has no reference link. */
export function referenceButton(im) {
  const href = im.reference_url && safeHref(im.reference_url);
  if (!href) return null;
  return h('a.ref-open', { href, target: '_blank', rel: 'noopener noreferrer', title: href }, icon('external'), 'Open reference');
}

/**
 * Add, change or remove the reference link of one image — or set one link for
 * several images at once (right after adding them). `onDone` runs after saving.
 */
export function openReferenceDialog(images, onDone) {
  if (!images.length) return;
  const many = images.length > 1;
  const existing = many ? '' : images[0].reference_url || '';
  const input = h('input', {
    value: existing, placeholder: 'https://…', maxlength: REFERENCE_MAX, inputmode: 'url',
    autocomplete: 'off', autocapitalize: 'off', spellcheck: false, enterkeyhint: 'done',
  });
  const err = h('p.field-error', { role: 'alert', hidden: true });
  const save = h('button.btn.primary', { type: 'submit' }, 'Save');
  const dlg = modal(
    h('form.dialog-body', {
      novalidate: true,
      onsubmit: async (e) => {
        e.preventDefault();
        const r = referenceLink(input.value);
        if (r.error) { err.textContent = r.error; err.hidden = false; input.focus(); return; }
        if (!many && r.url === (images[0].reference_url || null)) { dlg.close(); return; }
        save.disabled = true;
        try {
          await api.updateImages(images.map((i) => i.id), { reference_url: r.url });
          for (const im of images) im.reference_url = r.url;
          dlg.close();
          toast(r.url ? 'Reference link saved' : 'Reference link removed', { type: 'ok', timeout: 1800 });
          onDone?.();
        } catch (e2) {
          save.disabled = false;
          if (/reference_url/.test(e2?.message || '')) {
            toast('The database needs an update — run the newest SQL file in supabase/migrations (see README).', { type: 'error', timeout: 8000 });
          } else errorToast(e2);
        }
      },
    },
      h('h2', 'Reference link'),
      h('p.muted', many ? `One link for the ${images.length} images you just added: the page they came from.` : 'The page this image came from. Optional.'),
      h('label.field', h('span', 'Link'), input),
      err,
      existing ? h('p.muted.small', 'To remove the link, clear the box and save.') : null,
      h('div.row.end',
        h('button.btn', { type: 'button', onclick: () => dlg.close() }, 'Cancel'),
        save),
    ),
  );
  input.focus();
  input.select();
}
