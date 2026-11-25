import { useEffect, useMemo, useState } from 'react';
import { Button, TextInput } from '@gravity-ui/uikit';
import { DataTextView } from './DataTextView';
import { DataTreeView } from './DataTreeView';
import type { TreeRow } from '../utils/dataFormat';
import {
  PARSE_INLINE_LIMIT,
  byteLength,
  loadDataInline,
  loadFromWorkerResponse,
  visibleRows as computeVisibleRows,
  type DataViewerLoad,
  type DataViewerStatus,
  type DataParseWorkerResponse,
} from '../utils/dataViewerLoad';
import type { DataKind } from '../types/fileKind';
import { runWorker } from '../utils/worker';

export type DataViewMode = 'tree' | 'text';
export type { DataViewerStatus };

interface DataViewerProps {
  content: string;
  kind: DataKind;
  onStatus: (status: DataViewerStatus) => void;
}

export function DataViewer({ content, kind, onStatus }: DataViewerProps) {
  const [mode, setMode] = useState<DataViewMode>('tree');
  const [load, setLoad] = useState<DataViewerLoad | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');

  useEffect(() => {
    let cancelled = false;

    const apply = (next: DataViewerLoad) => {
      if (cancelled) return;
      setLoad(next);
      setCollapsed(new Set());
      onStatus(next.status);
    };

    if (byteLength(content) <= PARSE_INLINE_LIMIT) {
      apply(loadDataInline(content, kind));
      return () => {
        cancelled = true;
      };
    }

    const createWorker = () =>
      new Worker(new URL('../workers/dataParse.worker.ts', import.meta.url), { type: 'module' });

    void runWorker<{ text: string; kind: DataKind }, DataParseWorkerResponse>(createWorker, {
      text: content,
      kind,
    }).then((response) => {
      apply(loadFromWorkerResponse(kind, response));
    });

    return () => {
      cancelled = true;
    };
  }, [content, kind, onStatus]);

  const rows: TreeRow[] = useMemo(
    () => (load ? computeVisibleRows(load, collapsed, filter) : []),
    [load, collapsed, filter],
  );

  const status = load?.status ?? { label: '', valid: true, stats: null, error: null };

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
          <DataTreeView rows={rows} collapsed={collapsed} onToggle={toggle} />
        ) : (
          <DataTextView text={content} kind={kind} />
        )}
      </div>
    </div>
  );
}
