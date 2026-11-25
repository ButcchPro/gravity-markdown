/**
 * Virtualisation math for the JSON tree: which slice of rows is on screen.
 * Kept separate from the component so the windowing is unit-tested (the
 * component itself only renders and forwards scroll offset).
 */
export const ROW_HEIGHT = 22;
export const OVERSCAN = 8;

export interface WindowRange {
  start: number;
  end: number;
}

export function virtualWindow(rowCount: number, scrollTop: number, height: number): WindowRange {
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const end = Math.min(rowCount, Math.ceil((scrollTop + height) / ROW_HEIGHT) + OVERSCAN);
  return { start, end: Math.max(start, end) };
}
