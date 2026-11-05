import { useEffect, useRef, useState } from 'react';
import type { TreeRow } from '../utils/dataFormat';
import { pathToJsonPath } from '../utils/dataFormat';

const ROW_HEIGHT = 22;
const OVERSCAN = 8;

interface DataTreeViewProps {
  rows: TreeRow[];
  collapsed: ReadonlySet<string>;
  onToggle: (id: string) => void;
}

/** Virtualized tree: only the visible window of rows is mounted. */
export function DataTreeView({ rows, collapsed, onToggle }: DataTreeViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(320);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(() => setHeight(host.clientHeight));
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const end = Math.min(rows.length, Math.ceil((scrollTop + height) / ROW_HEIGHT) + OVERSCAN);
  const visible = rows.slice(start, end);

  const copyPath = (row: TreeRow) => {
    void navigator.clipboard.writeText(pathToJsonPath(row.path));
  };

  return (
    <div
      className="data-tree"
      ref={hostRef}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div className="data-tree__spacer" style={{ height: rows.length * ROW_HEIGHT }}>
        {visible.map((row, index) => (
          <div
            key={row.id}
            className={`data-tree__row data-tree__row--${row.valueKind}`}
            style={{ top: (start + index) * ROW_HEIGHT, paddingLeft: 8 + row.depth * 12 }}
            onDoubleClick={() => copyPath(row)}
            title="Double-click to copy JSON path"
          >
            {row.hasChildren ? (
              <button
                type="button"
                className="data-tree__chevron"
                aria-label={collapsed.has(row.id) ? `Expand ${row.label}` : `Collapse ${row.label}`}
                aria-expanded={!collapsed.has(row.id)}
                onClick={() => onToggle(row.id)}
              >
                {collapsed.has(row.id) ? '▸' : '▾'}
              </button>
            ) : (
              <span className="data-tree__chevron data-tree__chevron--empty" aria-hidden="true" />
            )}
            <span className="data-tree__label">{row.label}</span>
            <span className="data-tree__preview">{row.preview}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
