import { useEffect, useState } from 'react';

import { getThemeMode, setThemeMode, type ThemeMode } from '../theme';

export default function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>('system');

  useEffect(() => {
    setMode(getThemeMode());
  }, []);

  const onChange = (m: ThemeMode) => {
    setMode(m);
    setThemeMode(m);
  };

  return (
    <div className="flex items-center gap-0.5 border border-[var(--al-border)] rounded px-0.5 py-0.5">
      {(['light', 'system', 'dark'] as ThemeMode[]).map(m => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`px-2 py-0.5 text-xs rounded transition-colors ${
            mode === m
              ? 'bg-[var(--al-button-bg)] text-[var(--al-button-text)]'
              : 'text-[var(--al-nav-text)] hover:bg-[var(--al-card-hover)]'
          }`}
        >
          {m === 'light' ? '亮' : m === 'dark' ? '暗' : '自动'}
        </button>
      ))}
    </div>
  );
}
