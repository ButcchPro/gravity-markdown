import { useState, useEffect } from 'react';
import { Store } from '@tauri-apps/plugin-store';

const APP_STORE = 'app-store.json';

/** Minimal key/value surface the hook needs (plugin-store implements it). */
export interface PersistedStoreAdapter {
  load: (file: string) => Promise<{
    get: <T>(key: string) => Promise<T | undefined>;
    set: (key: string, value: unknown) => Promise<void>;
    save: () => Promise<void>;
  }>;
}

/** Default adapter: the Tauri plugin (tests inject their own). */
const tauriStore: PersistedStoreAdapter = {
  load: (file) => Store.load(file),
};

export interface UsePersistedStoreOptions {
  /** Overrides the storage backend (tests, or a different store file). */
  adapter?: PersistedStoreAdapter;
  /** Store file name; defaults to the app's `app-store.json`. */
  file?: string;
}

/**
 * Persistent primitive stored in the app's key-value store.
 * Loads after mount, saves on every change (gated by the load completion so
 * the default never overwrites an existing value before it is read).
 */
export function usePersistedStore<T>(
  key: string,
  defaultValue: T,
  options: UsePersistedStoreOptions = {},
) {
  const [value, setValue] = useState<T>(defaultValue);
  const [loaded, setLoaded] = useState(false);
  const adapter = options.adapter ?? tauriStore;
  const file = options.file ?? APP_STORE;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const store = await adapter.load(file);
        const stored = await store.get<T>(key);
        if (!cancelled) setValue(stored ?? defaultValue);
      } catch (e) {
        console.error(`Failed to load "${key}" from store:`, e);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Callers pass module-level constants for key/default; adapter/file are stable.
  }, [adapter, file, key, defaultValue]);

  useEffect(() => {
    if (!loaded) return;
    void (async () => {
      try {
        const store = await adapter.load(file);
        await store.set(key, value);
        await store.save();
      } catch (e) {
        console.error(`Failed to persist "${key}" to store:`, e);
      }
    })();
  }, [adapter, file, value, loaded, key]);

  return [value, setValue, loaded] as const;
}
