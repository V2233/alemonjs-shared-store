export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'alemonjs-theme';

export function getEffectiveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

export function applyTheme(mode: ThemeMode) {
  const effective = getEffectiveTheme(mode);
  const root = document.documentElement;
  if (effective === 'dark') {
    root.setAttribute('data-theme', 'dark');
  } else {
    root.removeAttribute('data-theme');
  }
}

export function getThemeMode(): ThemeMode {
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === 'light' || v === 'dark' || v === 'system') return v;
  return 'system';
}

export function setThemeMode(mode: ThemeMode) {
  localStorage.setItem(STORAGE_KEY, mode);
  applyTheme(mode);
}

export function initTheme() {
  applyTheme(getThemeMode());
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => {
    if (getThemeMode() === 'system') applyTheme('system');
  };
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}
