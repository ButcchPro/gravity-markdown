/**
 * Converts YFM wide-tables (#| ... |#) into standard markdown pipe tables.
 *
 * A conversion is performed only when it can be done without loss:
 *  - no row/col spans (`^` row-span markers, `||` col-span markers);
 *  - no table/cell attributes ({...} forms);
 *  - no YFM-only inline markup (%%color%%, [[links]], raw HTML tags);
 *  - no block-level content inside cells (paragraphs, lists, headings,
 *    quotes) — inline text only, multiline is collapsed to spaces the same
 *    way markdown renders it.
 */
import { rowsToPipeTable } from './pipeTable.ts';

export interface YfmConversionResult {
  value: string;
  converted: number;
  kept: number;
}

const ESCAPED_PIPE = '\u0000';

/** Risky inline features a standard pipe cell cannot represent safely. */
const LOSSY_PATTERNS: RegExp[] = [
  /\^/, // row-span marker or YFM superscript syntax
  /%%/, // color/highlight markup
  /\[\[|\]\]/, // YFM wiki links
  /^\s*\{[^}]*\}/, // cell attributes {align=...}
  /<[a-zA-Z/][^>]*>/, // raw HTML tags
  /^\s*(```|~~~)/, // fenced code block inside a cell
];

function containsLossyMarkup(text: string): boolean {
  return LOSSY_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Parses one YFM table body (lines between #| and |#) into rows of cells.
 * Returns null when the table uses features a pipe table cannot express
 * or when the syntax is unusual — the block is then kept as is.
 */
function parseYfmTableBody(body: string[]): string[][] | null {
  const rows: string[][] = [];
  let rowOpen = false;
  let cells: string[] = [];
  let pending: string[] = [];

  const finalizeCell = (): string | null => {
    // Drop blank padding at both edges of the cell (serializer spacing).
    let first = 0;
    let last = pending.length - 1;
    while (first <= last && pending[first].trim() === '') first += 1;
    while (last >= first && pending[last].trim() === '') last -= 1;
    const inner = pending.slice(first, last + 1);

    if (inner.length === 0) return '';
    for (const piece of inner) {
      if (piece.trim() === '') return null; // block-level content: blank line
      if (containsLossyMarkup(piece)) return null;
      if (/^\s*(#{1,6}\s|>)/.test(piece)) return null; // heading / quote
      if (/^\s*([-*+]|\d+[.)])\s/.test(piece)) return null; // list item
    }
    // Cell content is returned raw ('|' included); the shared pipe-table
    // serializer is responsible for escaping separators on output.
    return inner.join(' ').replace(/\s+/g, ' ').trim().split(ESCAPED_PIPE).join('|');
  };

  const pushCell = (): boolean => {
    const cell = finalizeCell();
    if (cell === null) return false;
    cells.push(cell);
    pending = [];
    return true;
  };

  const endRow = (): boolean => {
    if (!pushCell()) return false;
    // Chains of bare `||` (row terminator + next row start) produce no row.
    if (cells.length > 0) rows.push([...cells]);
    cells = [];
    pending = [];
    rowOpen = false;
    return true;
  };

  for (const raw of body) {
    // Escaped pipes are not separators: protect them from splitting.
    const line = raw.replace(/\\\|/g, ESCAPED_PIPE);
    let s = line;

    // Bare `||` opens a row; a second bare `||` terminates the open one.
    if (s.trim() === '||') {
      if (rowOpen) {
        if (!endRow()) return null;
      } else {
        rowOpen = true;
      }
      continue;
    }

    // Rows always start with a `||` token (compact one-line rows).
    if (s.startsWith('||')) {
      if (rowOpen) {
        // A `||` while a row is open means the row was never terminated
        // (or it is a col-span marker) — not convertible silently.
        return null;
      }
      rowOpen = true;
      s = s.slice(2);
    }
    // Row terminator glued to the end of the line (compact one-line row).
    let rowEnded = false;
    if (s.endsWith('||')) {
      rowEnded = true;
      s = s.slice(0, -2);
    }

    // Remaining unescaped pipes are cell boundaries (inline in the compact
    // form `|| a | b ||`, own line in the expanded serializer output).
    const segments = s.split('|');
    if (segments[0] !== '') pending.push(segments[0]);
    for (let i = 1; i < segments.length; i += 1) {
      if (!pushCell()) return null;
      if (segments[i] !== '') pending.push(segments[i]);
    }
    if (rowEnded) {
      if (!endRow()) return null;
    }
  }
  // Unterminated last row — close it leniently.
  if (rowOpen) {
    if (!endRow()) return null;
  }
  if (rows.length === 0 || rows[0].length === 0) return null;

  const columns = rows[0].length;
  for (const row of rows) {
    if (row.length !== columns) return null; // spans / ragged rows
  }
  return rows;
}

function convertBlock(lines: string[], open: number, close: number): string | null {
  const rows = parseYfmTableBody(lines.slice(open + 1, close));
  if (rows === null) return null;
  const pipe = rowsToPipeTable(rows[0], rows.slice(1));

  // Preserve delimiters/spacing: one blank line around the pipe table.
  const before = open > 0 && lines[open - 1].trim() !== '' ? [''] : [];
  const after = close + 1 < lines.length && lines[close + 1].trim() !== '' ? [''] : [];
  return [...before, pipe, ...after].join('\n');
}

/** Locates top-level `#| ... |#` blocks. Unterminated blocks are ignored.
 * Tables inside fenced code blocks (``` / ~~~) are documentation examples,
 * not real wide-tables — they are never touched. */
function findYfmBlocks(lines: string[]): Array<{ open: number; close: number }> {
  const blocks: Array<{ open: number; close: number }> = [];
  let open = -1;
  let fence: string | null = null;
  for (let i = 0; i < lines.length; i += 1) {
    if (fence !== null) {
      // Same fence token on a line closes the fenced block.
      if (lines[i].trimStart().startsWith(fence)) fence = null;
      continue;
    }
    const fenceMatch = /^\s{0,3}(```|~~~)/.exec(lines[i]);
    if (fenceMatch) {
      fence = fenceMatch[1];
      continue;
    }
    const trimmed = lines[i].trimEnd();
    if (open === -1 && trimmed === '#|') {
      open = i;
    } else if (open !== -1 && trimmed === '|#') {
      blocks.push({ open, close: i });
      open = -1;
    }
  }
  return blocks;
}

/**
 * Replaces every losslessly convertible YFM table with a standard pipe
 * table; tables that cannot be converted are kept unchanged.
 */
export function sanitizeYfmTables(markup: string): YfmConversionResult {
  if (!markup.includes('#|')) {
    return { value: markup, converted: 0, kept: 0 };
  }

  const lines = markup.split('\n');
  const blocks = findYfmBlocks(lines);
  if (blocks.length === 0) {
    return { value: markup, converted: 0, kept: 0 };
  }

  const out: string[] = [];
  let cursor = 0;
  let converted = 0;
  let kept = 0;

  for (const { open, close } of blocks) {
    out.push(...lines.slice(cursor, open));
    const replacement = convertBlock(lines, open, close);
    if (replacement === null) {
      kept += 1;
      out.push(...lines.slice(open, close + 1));
    } else {
      converted += 1;
      out.push(...replacement.split('\n'));
    }
    cursor = close + 1;
  }
  out.push(...lines.slice(cursor));

  return { value: out.join('\n'), converted, kept };
}
