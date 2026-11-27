'use client';

import { Monitor, Moon, Sun } from 'lucide-react';

export function ThemeSwitch() {
  function changeTheme() {
    const root = document.documentElement;
    const current = root.dataset.theme;
    const next = current === 'light' ? 'dark' : current === 'dark' ? undefined : 'light';
    if (next) root.dataset.theme = next;
    else delete root.dataset.theme;

    try {
      if (next) localStorage.setItem('stenotype-theme', next);
      else localStorage.removeItem('stenotype-theme');
    } catch {
      // The current tab can still switch themes without persistent storage.
    }
  }

  return (
    <button type="button" onClick={changeTheme} className="shell-nav-link size-11 justify-center p-0"
      aria-label="Change theme. Cycles through system, light and dark" title="Change theme">
      <Monitor className="size-4 [[data-theme]_&]:hidden" aria-hidden />
      <Sun className="hidden size-4 [[data-theme=light]_&]:block" aria-hidden />
      <Moon className="hidden size-4 [[data-theme=dark]_&]:block" aria-hidden />
    </button>
  );
}
