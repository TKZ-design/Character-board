import { h, icon, errorToast, toast } from '../ui.js';
import { api } from '../state.js';

export function renderLogin(root) {
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
    h('p', '✉️ Check your inbox at ', sent, ' and tap the link.'),
    h('details.muted',
      h('summary', 'Got a code instead? (handy inside the installed phone app)'),
      h('div.row', codeInput, h('button.btn', { type: 'submit' }, 'Log in'))),
    h('button.btn.ghost', { type: 'button', onclick: () => { step2.hidden = true; step1.hidden = false; } }, 'Use a different email'),
  );

  root.replaceChildren(
    h('main.login',
      h('div.login-card',
        h('img.login-logo', { src: './icons/icon.svg', alt: '', width: 72, height: 72 }),
        h('h1', 'Character Inspiration Board'),
        h('p.muted', 'Your private collection of character references.'),
        step1, step2,
      ),
    ),
  );
  emailInput.focus();
  if (new URLSearchParams(location.search).has('error_description')) {
    toast(new URLSearchParams(location.search).get('error_description'), { type: 'error', timeout: 8000 });
  }
}
