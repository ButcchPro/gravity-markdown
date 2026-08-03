import { useState, useEffect, useMemo, useCallback } from 'react';
import { Store } from '@tauri-apps/plugin-store';
import type { Theme } from '@gravity-ui/uikit';

export type AppTheme = 'dark' | 'light' | 'solarized-light';

const APP_STORE = 'app-store.json';

async function loadThemeFromStore(): Promise<AppTheme> {
  try {
    const store = await Store.load(APP_STORE);
    const val = await store.get<AppTheme>('theme');
    return val ?? 'dark';
  } catch {
    return 'dark';
  }
}

async function saveThemeToStore(theme: AppTheme): Promise<void> {
  try {
    const store = await Store.load(APP_STORE);
    await store.set('theme', theme);
    await store.save();
  } catch (e) {
    console.error('Failed to save theme:', e);
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<AppTheme>('dark');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadThemeFromStore().then(t => {
      setTheme(t);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) {
      saveThemeToStore(theme);
    }
  }, [theme, loaded]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : prev === 'light' ? 'solarized-light' : 'dark');
  }, []);

  const gravityTheme: Theme = useMemo(
    () => (theme === 'solarized-light' ? 'light' : theme) as Theme,
    [theme],
  );

  return { theme, toggleTheme, gravityTheme, themeLoaded: loaded };
}
