import { useMemo, useCallback } from 'react';
import { usePersistedStore } from './usePersistedStore';
import type { Theme } from '@gravity-ui/uikit';

export type AppTheme = 'dark' | 'light' | 'solarized-light';

export function useTheme() {
  const [theme, setTheme, themeLoaded] = usePersistedStore<AppTheme>('theme', 'dark');

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : prev === 'light' ? 'solarized-light' : 'dark');
  }, [setTheme]);

  const gravityTheme: Theme = useMemo(
    () => (theme === 'solarized-light' ? 'light' : theme) as Theme,
    [theme],
  );

  return { theme, toggleTheme, gravityTheme, themeLoaded };
}
