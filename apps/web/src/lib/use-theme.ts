import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem('visiora_theme') as Theme | null;
      if (stored === 'light' || stored === 'dark') return stored;
    } catch {
      // ignore
    }
    return 'light';
  });

  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('visiora_theme') as Theme | null;
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
    return false;
  });

  useEffect(() => {
    const activeDark = theme === 'dark';
    setIsDark(activeDark);
    document.documentElement.classList.toggle('dark', activeDark);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem('visiora_theme', newTheme);
    } catch {
      // ignore
    }
  };

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return { theme, isDark, setTheme, toggleTheme };
}
