/**
 * Data-viewer loading logic, separated from the React component: parse the
 * text (inline for small files, through an injected worker path for big ones),
 * produce the status shown in the status bar and the tree rows to display.
 */
import {
  buildTreeRows,
  collectStats,
  parseAnyDataText,
  type DataStats,
  type TreeRow,
} from './dataFormat.ts';
import { fileKindLabel, type DataKind } from '../types/fileKind.ts';

/** Files up to this size parse on the main thread so collapse/search are cheap. */
export const PARSE_INLINE_LIMIT = 256 * 1024;

export interface DataViewerStatus {
  label: string;
  valid: boolean;
  stats: DataStats | null;
  error: { line: number; column: number; message: string } | null;
}

export interface DataViewerLoad {
  status: DataViewerStatus;
  rows: TreeRow[];
  /** Parsed value when it was produced inline (enables collapse/filter). */
  value: unknown;
}

export interface DataParseWorkerResponse {
  ok: boolean;
  rows: TreeRow[];
  stats: DataStats | null;
  error: { message: string; line: number; column: number } | null;
}

/** Byte length of the document as UTF-8 (multibyte-safe). */
export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Parses inline; used for small files and by the worker for big ones. */
export function loadDataInline(content: string, kind: DataKind): DataViewerLoad {
  const bytes = byteLength(content);
  const parsed = parseAnyDataText(content, kind);

  if (!parsed.ok) {
    return {
      status: { label: fileKindLabel(kind), valid: false, stats: null, error: parsed.error },
      rows: [],
      value: undefined,
    };
  }

  return {
    status: {
      label: fileKindLabel(kind),
      valid: true,
      stats: collectStats(parsed.value, bytes),
      error: null,
    },
    rows: buildTreeRows(parsed.value, new Set(), ''),
    value: parsed.value,
  };
}

/** Turns a worker reply into the same shape as the inline path. */
export function loadFromWorkerResponse(
  kind: DataKind,
  response: DataParseWorkerResponse,
): DataViewerLoad {
  return {
    status: {
      label: fileKindLabel(kind),
      valid: response.ok,
      stats: response.stats,
      error: response.error,
    },
    rows: response.rows,
    value: undefined,
  };
}

/** Rows to render for the current filter/collapse state. */
export function visibleRows(
  load: DataViewerLoad,
  collapsed: ReadonlySet<string>,
  filter: string,
): TreeRow[] {
  if (!load.status.valid) return [];
  if (load.value !== undefined) return buildTreeRows(load.value, collapsed, filter);

  // Worker rows are already built: filter them flat (collapse needs the value).
  const query = filter.trim().toLowerCase();
  if (query === '') return load.rows;
  return load.rows.filter(
    (row) => row.label.toLowerCase().includes(query) || row.preview.toLowerCase().includes(query),
  );
}
