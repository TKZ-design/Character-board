const KEY = 'cb-theme';

export function currentTheme() {
  return document.documentElement.dataset.theme || 'light';
}

export function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem(KEY, t); } catch {}
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#111111' : '#ffffff');
}

export function toggleTheme() {
  setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
}
