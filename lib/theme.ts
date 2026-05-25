'use client';

import { useState, useEffect, useCallback } from 'react';

type Theme = 'dark' | 'light';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const stored = localStorage.getItem('mindmap-theme') as Theme | null;
    if (stored === 'light' || stored === 'dark') {
      setTheme(stored);
      document.documentElement.className = stored;
    } else {
      document.documentElement.className = '';
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('mindmap-theme', next);
      document.documentElement.className = next === 'dark' ? 'dark' : '';
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}
