import { useState, useEffect, useCallback } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { Store } from '@tauri-apps/plugin-store';
import { fetchLatestGitHubVersion, isNewer } from '../utils/versionCheck';

const APP_STORE = 'app-store.json';

export interface AvailableUpdate {
  /** New version found on GitHub (e.g. "1.0.5"). */
  latest: string;
}

/**
 * Checks GitHub once per app start (after the app is ready) and offers an
 * update when the published release is newer than the running version.
 * Failures are silent; "Skip" stores the dismissed version so the same
 * release is not advertised again.
 */
export function useUpdateCheck(enabled: boolean) {
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);

  useEffect(() => {
    if (!enabled) return;
    void (async () => {
      try {
        const [latest, current] = await Promise.all([
          fetchLatestGitHubVersion(),
          getVersion(),
        ]);
        if (!latest || current === latest || !isNewer(current, latest)) return;

        const store = await Store.load(APP_STORE);
        const skipped = await store.get<string>('skippedVersion');
        if (skipped === latest) return;

        setUpdate({ latest });
      } catch (e) {
        console.warn('Update check skipped:', e);
      }
    })();
  }, [enabled]);

  /** "Skip this version": remembered until a newer release appears. */
  const skip = useCallback(async (latest: string) => {
    setUpdate(null);
    try {
      const store = await Store.load(APP_STORE);
      await store.set('skippedVersion', latest);
      await store.save();
    } catch (e) {
      console.warn('Failed to persist skipped version:', e);
    }
  }, []);

  const dismiss = useCallback(() => setUpdate(null), []);

  return { update, skip, dismiss };
}
