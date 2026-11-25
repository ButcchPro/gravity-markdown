import { useState, useEffect, useCallback } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { Store } from '@tauri-apps/plugin-store';
import { fetchLatestGitHubVersion, isNewer } from '../utils/versionCheck.ts';
import type { PersistedStoreAdapter } from './usePersistedStore';

const APP_STORE = 'app-store.json';

export interface AvailableUpdate {
  /** New version found on GitHub (e.g. "1.0.5"). */
  latest: string;
}

export interface UpdateCheckDeps {
  /** Latest published version (null when the check failed). */
  fetchLatest: () => Promise<string | null>;
  /** Version of the running app. */
  getVersion: () => Promise<string>;
  /** Storage for the "skipped" marker. */
  adapter: PersistedStoreAdapter;
}

const defaultDeps: UpdateCheckDeps = {
  fetchLatest: fetchLatestGitHubVersion,
  getVersion,
  adapter: { load: (file) => Store.load(file) },
};

/**
 * Checks GitHub once per app start (after the app is ready) and offers an
 * update when the published release is newer than the running version.
 * Failures are silent; "Skip" stores the dismissed version so the same
 * release is not advertised again.
 */
export function useUpdateCheck(enabled: boolean, injected?: UpdateCheckDeps) {
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    void (async () => {
      try {
        const deps = injected ?? defaultDeps;
        const [latest, current] = await Promise.all([deps.fetchLatest(), deps.getVersion()]);
        if (cancelled || !latest || current === latest || !isNewer(current, latest)) return;

        const store = await deps.adapter.load(APP_STORE);
        const skipped = await store.get<string>('skippedVersion');
        if (cancelled || skipped === latest) return;

        setUpdate({ latest });
      } catch (e) {
        console.warn('Update check skipped:', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, injected]);

  /** "Skip this version": remembered until a newer release appears. */
  const skip = useCallback(
    async (latest: string) => {
      setUpdate(null);
      try {
        const deps = injected ?? defaultDeps;
        const store = await deps.adapter.load(APP_STORE);
        await store.set('skippedVersion', latest);
        await store.save();
      } catch (e) {
        console.warn('Failed to persist skipped version:', e);
      }
    },
    [injected],
  );

  const dismiss = useCallback(() => setUpdate(null), []);

  return { update, skip, dismiss };
}
