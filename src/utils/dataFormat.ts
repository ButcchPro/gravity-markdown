import { parse, printParseErrorCode, type ParseError } from 'jsonc-parser';
import type { DataKind } from '../types/fileKind';

export interface DataParseFailure {
  message: string;
  line: number;
  column: number;
}

export type DataParseResult =
  | { ok: true; value: unknown }
  | { ok: false; error: DataParseFailure };

function offsetToLineColumn(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, Math.max(0, Math.min(offset, text.length)));
  const lines = before.split('\n');
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

function toFailure(text: string, error: ParseError): DataParseFailure {
  const { line, column } = offsetToLineColumn(text, error.offset);
  return { message: printParseErrorCode(error.error), line, column };
}

/** Parses JSON-like text. Comments/trailing commas are allowed for jsonc/json5. */
export function parseDataText(text: string, kind: DataKind): DataParseResult {
  const tolerant = kind !== 'json';
  const errors: ParseError[] = [];
  const value = parse(text, errors, {
    allowTrailingComma: tolerant,
    disallowComments: !tolerant,
  });
  if (errors.length > 0) {
    return { ok: false, error: toFailure(text, errors[0]) };
  }
  return { ok: true, value };
}

export interface DataStats {
  bytes: number;
  objects: number;
  arrays: number;
  /** Scalar leaves (strings, numbers, booleans, nulls). */
  leaves: number;
  depth: number;
}

export function collectStats(value: unknown, bytes: number): DataStats {
  const stats: DataStats = { bytes, objects: 0, arrays: 0, leaves: 0, depth: 0 };
  const walk = (node: unknown, depth: number): void => {
    stats.depth = Math.max(stats.depth, depth);
    if (node === null || typeof node !== 'object') {
      stats.leaves += 1;
      return;
    }
    if (Array.isArray(node)) {
      stats.arrays += 1;
      node.forEach((child) => walk(child, depth + 1));
      return;
    }
    stats.objects += 1;
    Object.values(node as Record<string, unknown>).forEach((child) => walk(child, depth + 1));
  };
  walk(value, 1);
  return stats;
}

export type TreeValueKind = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

export interface TreeRow {
  /** Stable id: JSON path of the row. */
  id: string;
  depth: number;
  label: string;
  valueKind: TreeValueKind;
  /** Preview for scalars ("demo", "1", "true") or a count for containers ("3 items"). */
  preview: string;
  hasChildren: boolean;
  childCount: number;
  path: Array<string | number>;
}

function kindOf(value: unknown): TreeValueKind {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return typeof value as 'string' | 'number' | 'boolean';
}

function previewOf(value: unknown, kind: TreeValueKind): string {
  if (kind === 'array') return `${(value as unknown[]).length} items`;
  if (kind === 'object') return `${Object.keys(value as object).length} keys`;
  return typeof value === 'string' ? value : String(value);
}

/**
 * Flattens a parsed value into visible rows. A collapsed container hides its
 * subtree; a non-empty filter keeps rows whose label or preview matches and
 * forces the ancestor chain open.
 */
export function buildTreeRows(
  value: unknown,
  collapsed: ReadonlySet<string>,
  filter: string,
): TreeRow[] {
  const query = filter.trim().toLowerCase();
  const rows: TreeRow[] = [];

  const matches = (label: string, preview: string): boolean =>
    query === '' || label.toLowerCase().includes(query) || preview.toLowerCase().includes(query);

  const walk = (node: unknown, label: string, path: Array<string | number>): boolean => {
    const id = pathToJsonPath(path);
    const valueKind = kindOf(node);
    const children: Array<readonly [string, unknown, Array<string | number>]> =
      valueKind === 'array'
        ? (node as unknown[]).map((child, index) => [String(index), child, [...path, index]] as const)
        : valueKind === 'object'
          ? Object.entries(node as Record<string, unknown>).map(
              ([key, child]) => [key, child, [...path, key]] as const,
            )
          : [];
    const nextPreview = previewOf(node, valueKind);
    const selfMatches = matches(label, nextPreview);
    const isCollapsed = collapsed.has(id) && query === '';

    const row: TreeRow = {
      id,
      depth: path.length,
      label,
      valueKind,
      preview: nextPreview,
      hasChildren: children.length > 0,
      childCount: children.length,
      path,
    };

    if (isCollapsed) {
      rows.push(row);
      return selfMatches;
    }

    const index = rows.length;
    rows.push(row);
    let anyChildVisible = false;
    for (const [childLabel, childValue, childPath] of children) {
      if (walk(childValue, childLabel, childPath)) anyChildVisible = true;
    }

    const visible = query === '' ? true : selfMatches || anyChildVisible;
    if (!visible) {
      rows.splice(index, rows.length - index);
      return false;
    }
    return visible;
  };

  walk(value, '$', []);
  return rows;
}

export function pathToJsonPath(path: Array<string | number>): string {
  return path.reduce<string>((acc, segment) => {
    if (typeof segment === 'number') return `${acc}[${segment}]`;
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(segment) ? `${acc}.${segment}` : `${acc}["${segment}"]`;
  }, '$');
}
