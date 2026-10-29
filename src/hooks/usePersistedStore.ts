import { useState, useEffect } from 'react';
import { Store } from '@tauri-apps/plugin-store';

const APP_STORE = 'app-store.json';

/**
 * Persistent primitive stored in the app's key-value store (plugin-store).
 * Loads after mount, saves on every change (gated by the load completion so
 * the default never overwrites an existing value before it is read).
 */
export function usePersistedStore<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const store = await Store.load(APP_STORE);
        const stored = await store.get<T>(key);
        setValue(stored ?? defaultValue);
      } catch (e) {
        console.error(`Failed to load "${key}" from store:`, e);
      } finally {
        setLoaded(true);
      }
    })();
    // Callers pass module-level constants here.
  }, [key, defaultValue]);

  useEffect(() => {
    if (!loaded) return;
    void (async () => {
      try {
        const store = await Store.load(APP_STORE);
        await store.set(key, value);
        await store.save();
      } catch (e) {
        console.error(`Failed to persist "${key}" to store:`, e);
      }
    })();
  }, [value, loaded, key]);

  return [value, setValue, loaded] as const;
}
