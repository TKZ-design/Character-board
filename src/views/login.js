import { h, icon, errorToast, toast } from '../ui.js';
import { api } from '../state.js';

import { domainOf } from '../links.js';

export function renderLogin(root, { pendingUrl = null } = {}) {
  let email = '';
  const emailInput = h('input', { type: 'email', required: true, placeholder: 'you@example.com', autocomplete: 'email', 'aria-label': 'Email' });
  const sendBtn = h('button.btn.primary.wide', { type: 'submit' }, 'Email me a login link');
  const codeInput = h('input', { inputmode: 'numeric', autocomplete: 'one-time-code', placeholder: '6-digit code', maxlength: 10, 'aria-label': 'Login code' });

  const step1 = h('form.stack', {
    onsubmit: async (e) => {
      e.preventDefault();
      email = emailInput.value.trim();
      sendBtn.disabled = true; sendBtn.textContent = 'Sending…';
      try {
        await api.sendMagicLink(email);
        step1.hidden = true; step2.hidden = false;
        sent.textContent = email;
      } catch (err) { errorToast(err); }
      sendBtn.disabled = false; sendBtn.textContent = 'Email me a login link';
    },
  }, emailInput, sendBtn);

  const sent = h('strong');
  const step2 = h('form.stack', {
    hidden: true,
    onsubmit: async (e) => {
      e.preventDefault();
      try { await api.verifyCode(email, codeInput.value.trim()); }
      catch (err) { errorToast(err); }
    },
  },
    h('p', 'Check your inbox at ', sent, ' and tap the link.'),
    h('details.muted',
      h('summary', 'Got a code instead? (handy inside the installed phone app)'),
      h('div.row', codeInput, h('button.btn', { type: 'submit' }, 'Log in'))),
    h('button.btn.ghost', { type: 'button', onclick: () => { step2.hidden = true; step1.hidden = false; } }, 'Use a different email'),
  );

  root.replaceChildren(
    h('main.login',
      h('div.login-card',
        h('p.eyebrow', 'Private collection'),
        h('h1.title', 'Stash', h('span.title-dot', '.')),
        h('p.muted', 'Your private stash for character references and saved links. Sign in with your email to continue.'),
        pendingUrl ? h('p.notice', { role: 'status' }, 'Log in to save ', h('strong', domainOf(pendingUrl) || 'your link'), ' to your Link Vault — it’ll be waiting for you.') : null,
        step1, step2,
      ),
    ),
  );
  emailInput.focus();
  if (new URLSearchParams(location.search).has('error_description')) {
    toast(new URLSearchParams(location.search).get('error_description'), { type: 'error', timeout: 8000 });
  }
}
