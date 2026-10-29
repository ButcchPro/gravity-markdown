import { useCallback } from 'react';
import { usePersistedStore } from './usePersistedStore';

export function useZoom() {
  const [zoom, setZoom] = usePersistedStore<number>('zoom', 100);

  const zoomIn = useCallback(() => setZoom(prev => Math.min(200, prev + 10)), [setZoom]);
  const zoomOut = useCallback(() => setZoom(prev => Math.max(80, prev - 10)), [setZoom]);

  return { zoom, setZoom, zoomIn, zoomOut };
}
