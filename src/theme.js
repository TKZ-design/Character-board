const KEY = 'cb-theme';

export function currentTheme() {
  return document.documentElement.dataset.theme || 'dark';
}

export function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem(KEY, t); } catch {}
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'light' ? '#f6f5f2' : '#14131a');
}

export function toggleTheme() {
  setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
}
