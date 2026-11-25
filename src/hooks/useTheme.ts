import { useMemo, useCallback } from 'react';
import { usePersistedStore, type PersistedStoreAdapter } from './usePersistedStore.ts';
import type { Theme } from '@gravity-ui/uikit';

export type AppTheme = 'dark' | 'light' | 'solarized-light';

export interface UseThemeOptions {
  /** Storage backend override (tests). */
  adapter?: PersistedStoreAdapter;
}

export function useTheme(options: UseThemeOptions = {}) {
  const [theme, setTheme, themeLoaded] = usePersistedStore<AppTheme>(
    'theme',
    'dark',
    options.adapter ? { adapter: options.adapter } : {},
  );

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : prev === 'light' ? 'solarized-light' : 'dark');
  }, [setTheme]);

  const gravityTheme: Theme = useMemo(
    () => (theme === 'solarized-light' ? 'light' : theme) as Theme,
    [theme],
  );

  return { theme, toggleTheme, gravityTheme, themeLoaded };
}
