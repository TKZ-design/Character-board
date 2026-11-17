const KEY = 'cb-theme';

export function currentTheme() {
  return document.documentElement.dataset.theme || 'dark';
}

export function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem(KEY, t); } catch {}
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'light' ? '#F4F5F8' : '#0F1115');
}

export function toggleTheme() {
  setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
}
