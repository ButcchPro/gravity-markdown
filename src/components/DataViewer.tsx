import { useEffect, useMemo, useState } from 'react';
import { Button, TextInput } from '@gravity-ui/uikit';
import { DataTextView } from './DataTextView';
import { DataTreeView } from './DataTreeView';
import {
  buildTreeRows,
  collectStats,
  parseDataText,
  type DataStats,
  type TreeRow,
} from '../utils/dataFormat';
import type { DataParseResponse } from '../workers/dataParse.worker';
import { fileKindLabel, type DataKind } from '../types/fileKind';
import { runWorker } from '../utils/worker';

export type DataViewMode = 'tree' | 'text';

export interface DataViewerStatus {
  label: string;
  valid: boolean;
  stats: DataStats | null;
  error: { line: number; column: number; message: string } | null;
}

interface DataViewerProps {
  content: string;
  kind: DataKind;
  onStatus: (status: DataViewerStatus) => void;
}

/** Files up to this size parse on the main thread so collapse/search are cheap. */
const PARSE_INLINE_LIMIT = 256 * 1024;

export function DataViewer({ content, kind, onStatus }: DataViewerProps) {
  const [mode, setMode] = useState<DataViewMode>('tree');
  const [parsedValue, setParsedValue] = useState<unknown>(undefined);
  const [workerRows, setWorkerRows] = useState<TreeRow[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [status, setStatus] = useState<DataViewerStatus>({
    label: fileKindLabel(kind),
    valid: true,
    stats: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    const bytes = new TextEncoder().encode(content).length;

    const apply = (next: DataViewerStatus, rows: TreeRow[], value: unknown) => {
      if (cancelled) return;
      setParsedValue(value);
      setWorkerRows(rows);
      setCollapsed(new Set());
      setStatus(next);
      onStatus(next);
    };

    if (bytes <= PARSE_INLINE_LIMIT) {
      const parsed = parseDataText(content, kind);
      if (parsed.ok) {
        apply(
          { label: fileKindLabel(kind), valid: true, stats: collectStats(parsed.value, bytes), error: null },
          buildTreeRows(parsed.value, new Set(), ''),
          parsed.value,
        );
      } else {
        apply(
          { label: fileKindLabel(kind), valid: false, stats: null, error: parsed.error },
          [],
          undefined,
        );
      }
      return () => {
        cancelled = true;
      };
    }

    const createWorker = () =>
      new Worker(new URL('../workers/dataParse.worker.ts', import.meta.url), { type: 'module' });

    void runWorker<{ text: string; kind: DataKind }, DataParseResponse>(createWorker, {
      text: content,
      kind,
    }).then((response) => {
      apply(
        {
          label: fileKindLabel(kind),
          valid: response.ok,
          stats: response.stats,
          error: response.error,
        },
        response.rows,
        undefined,
      );
    });

    return () => {
      cancelled = true;
    };
  }, [content, kind, onStatus]);

  const visibleRows = useMemo(() => {
    if (!status.valid) return [];
    if (parsedValue !== undefined) return buildTreeRows(parsedValue, collapsed, filter);
    const query = filter.trim().toLowerCase();
    if (query === '') return workerRows;
    return workerRows.filter(
      (row) => row.label.toLowerCase().includes(query) || row.preview.toLowerCase().includes(query),
    );
  }, [status.valid, parsedValue, workerRows, collapsed, filter]);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="data-viewer">
      <div className="data-viewer__bar">
        <Button view={mode === 'tree' ? 'action' : 'flat'} size="s" onClick={() => setMode('tree')}>
          Tree
        </Button>
        <Button view={mode === 'text' ? 'action' : 'flat'} size="s" onClick={() => setMode('text')}>
          Text
        </Button>
        {mode === 'tree' && (
          <TextInput
            size="s"
            placeholder="Filter keys and values…"
            value={filter}
            onUpdate={setFilter}
            className="data-viewer__filter"
          />
        )}
        <span className="data-viewer__state">
          {status.valid
            ? 'Valid'
            : `Invalid — line ${status.error?.line}, column ${status.error?.column}`}
        </span>
      </div>
      {!status.valid && status.error && (
        <div className="data-viewer__error" role="alert">
          <strong>{status.error.message}</strong> at line {status.error.line}, column{' '}
          {status.error.column}
        </div>
      )}
      <div className="data-viewer__body">
        {mode === 'tree' ? (
          <DataTreeView rows={visibleRows} collapsed={collapsed} onToggle={toggle} />
        ) : (
          <DataTextView text={content} />
        )}
      </div>
    </div>
  );
}
