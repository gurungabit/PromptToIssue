'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';

type Theme = 'light' | 'dark' | 'system';

export function ThemeToggle() {
  // Use lazy initialization to avoid setState in useEffect
  const [state] = useState(() => {
    if (typeof window === 'undefined') {
      return { theme: 'system' as Theme, mounted: false };
    }
    const stored = localStorage.getItem('theme') as Theme | null;
    return { theme: stored || ('system' as Theme), mounted: true };
  });
  const [theme, setTheme] = useState<Theme>(state.theme);
  const mounted = state.mounted || typeof window !== 'undefined';

  function applyTheme(newTheme: Theme) {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.remove('light', 'dark');

    if (newTheme === 'system') {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.add(systemDark ? 'dark' : 'light');
    } else {
      root.classList.add(newTheme);
    }
  }

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function cycleTheme() {
    const themes: Theme[] = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];

    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    applyTheme(nextTheme);
  }

  if (!mounted) {
    return (
      <button
        className="h-9 w-9 rounded-[var(--radius)] bg-surface-hover flex items-center justify-center"
        aria-label="Toggle theme"
      >
        <Monitor className="h-4 w-4" />
      </button>
    );
  }

  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  return (
    <button
      onClick={cycleTheme}
      className="
        h-9 w-9 rounded-[var(--radius)]
        bg-surface hover:bg-surface-hover
        flex items-center justify-center
        transition-colors
      "
      aria-label={`Current theme: ${theme}. Click to change.`}
      title={`Theme: ${theme}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
