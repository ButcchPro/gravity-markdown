import { useState, useEffect, useCallback } from 'react';
import { Store } from '@tauri-apps/plugin-store';

const APP_STORE = 'app-store.json';

async function loadZoomFromStore(): Promise<number> {
  try {
    const store = await Store.load(APP_STORE);
    const val = await store.get<number>('zoom');
    return val ?? 100;
  } catch {
    return 100;
  }
}

async function saveZoomToStore(zoom: number): Promise<void> {
  try {
    const store = await Store.load(APP_STORE);
    await store.set('zoom', zoom);
    await store.save();
  } catch (e) {
    console.error('Failed to save zoom:', e);
  }
}

export function useZoom() {
  const [zoom, setZoom] = useState<number>(100);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadZoomFromStore().then(z => {
      setZoom(z);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) {
      saveZoomToStore(zoom);
    }
  }, [zoom, loaded]);

  const zoomIn = useCallback(() => setZoom(prev => Math.min(200, prev + 10)), []);
  const zoomOut = useCallback(() => setZoom(prev => Math.max(80, prev - 10)), []);

  return { zoom, setZoom, zoomIn, zoomOut };
}
