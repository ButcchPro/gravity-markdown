import { useCallback } from 'react';
import { usePersistedStore, type PersistedStoreAdapter } from './usePersistedStore.ts';

export interface UseZoomOptions {
  /** Storage backend override (tests). */
  adapter?: PersistedStoreAdapter;
}

export function useZoom(options: UseZoomOptions = {}) {
  const [zoom, setZoom] = usePersistedStore<number>(
    'zoom',
    100,
    options.adapter ? { adapter: options.adapter } : {},
  );

  const zoomIn = useCallback(() => setZoom(prev => Math.min(200, prev + 10)), [setZoom]);
  const zoomOut = useCallback(() => setZoom(prev => Math.max(80, prev - 10)), [setZoom]);

  return { zoom, setZoom, zoomIn, zoomOut };
}
