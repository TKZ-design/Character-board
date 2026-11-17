// "More": tags, backup, appearance and the account.
import { h, icon } from '../ui.js';
import { api, state } from '../state.js';
import { currentTheme, setTheme } from '../theme.js';
import { exportZip } from '../export.js';
import { go } from '../nav.js';

function row(ic, title, sub, { href, onclick, end } = {}) {
  const body = [
    h('span.more-icon', icon(ic)),
    h('span.more-text', h('span.more-title', title), sub ? h('span.more-sub', sub) : null),
    end || (href ? icon('chevron') : null),
  ];
  return href
    ? h('a.more-row', { href, onclick: (e) => { e.preventDefault(); go(href); } }, body)
    : h('button.more-row', { type: 'button', onclick }, body);
}

export function renderMore(root, rerender) {
  const themeBtn = (value, label, ic) =>
    h('button.seg-btn', {
      type: 'button', 'aria-pressed': String(currentTheme() === value),
      onclick: () => { setTheme(value); rerender(); },
    }, icon(ic), label);
  const linksOk = state.linksReady !== false;

  root.replaceChildren(
    h('section.more-group', { 'aria-label': 'Tags' },
      row('tag', 'Tags', 'Character tags and tag groups', { href: '#/tags' }),
      linksOk ? row('tag', 'Vault tags', 'Tags for saved links', { href: '#/vault-tags' }) : null),
    h('section.more-group', { 'aria-label': 'Backup' },
      row('download', 'Backup (ZIP)', 'Download all characters, images and links', { onclick: () => exportZip() })),
    h('section.more-group', { 'aria-label': 'Appearance' },
      h('div.more-row.static',
        h('span.more-icon', icon(currentTheme() === 'dark' ? 'moon' : 'sun')),
        h('span.more-text', h('span.more-title', 'Theme'), h('span.more-sub', 'Dark or light')),
        h('div.segmented.seg-buttons', { role: 'group', 'aria-label': 'Theme' }, themeBtn('dark', 'Dark', 'moon'), themeBtn('light', 'Light', 'sun')))),
    h('section.more-group', { 'aria-label': 'Account' },
      h('div.more-row.static',
        h('span.more-icon', icon('user')),
        h('span.more-text', h('span.more-sub', 'Signed in as'), h('span.more-title.more-email', state.user?.email || '—'))),
      row('logout', 'Sign out', null, { onclick: async () => { await api.signOut(); } })));
}
