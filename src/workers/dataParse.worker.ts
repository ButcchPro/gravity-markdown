/// Parses data files off the main thread and returns rows + stats.
import {
  parseDataText,
  collectStats,
  buildTreeRows,
  type TreeRow,
  type DataStats,
} from '../utils/dataFormat.ts';
import type { DataKind } from '../types/fileKind';

interface DataParseRequest {
  text: string;
  kind: DataKind;
}

export interface DataParseResponse {
  ok: boolean;
  rows: TreeRow[];
  stats: DataStats | null;
  error: { message: string; line: number; column: number } | null;
}

self.onmessage = (event: MessageEvent<DataParseRequest>) => {
  const { text, kind } = event.data;
  const parsed = parseDataText(text, kind);
  if (!parsed.ok) {
    const response: DataParseResponse = { ok: false, rows: [], stats: null, error: parsed.error };
    self.postMessage(response);
    return;
  }
  const response: DataParseResponse = {
    ok: true,
    rows: buildTreeRows(parsed.value, new Set(), ''),
    stats: collectStats(parsed.value, new TextEncoder().encode(text).length),
    error: null,
  };
  self.postMessage(response);
};
