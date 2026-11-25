/**
 * The editor serialises GFM tables in a tight form (`|A|B|` with `|:---|:---|`
 * separators and a trailing empty row for header-only tables). Files read much
 * better in the conventional spaced form, so every pipe table is re-emitted as
 * `| a | b |` with its alignment markers preserved and trailing empty rows
 * dropped. The transform is idempotent: applying it twice yields the same text.
 */

const SEPARATOR_CELL = /^\s*:?-{1,}:?\s*$/;
/** Placeholder for escaped pipes while splitting a row into cells. */
const ESCAPED_PIPE = '\u0001';

function splitRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) return null;
  const withoutEdges = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  // Escaped pipes belong to the cell content, not to the row structure.
  const cells = withoutEdges.split('\\|').join(ESCAPED_PIPE).split('|');
  return cells.map((cell) => cell.split(ESCAPED_PIPE).join('\\|').trim());
}

function isSeparatorRow(line: string): boolean {
  const cells = splitRow(line);
  if (!cells || cells.length === 0) return false;
  return cells.every((cell) => SEPARATOR_CELL.test(cell));
}

function isTableRow(line: string): boolean {
  return splitRow(line) !== null;
}

function renderRow(cells: string[]): string {
  return `| ${cells.join(' | ')} |`;
}

function renderSeparator(cells: string[]): string {
  return `| ${cells.map((cell) => (cell === '' ? '---' : cell)).join(' | ')} |`;
}

export function canonicalizePipeTables(markdown: string): string {
  if (!markdown.includes('|')) return markdown;

  const lines = markdown.split('\n');
  const out: string[] = [];
  let fence: string | null = null;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (fence !== null) {
      if (line.trimStart().startsWith(fence)) fence = null;
      out.push(line);
      i += 1;
      continue;
    }
    const fenceMatch = /^\s{0,3}(```|~~~)/.exec(line);
    if (fenceMatch) {
      fence = fenceMatch[1];
      out.push(line);
      i += 1;
      continue;
    }

    const header = isTableRow(line) ? splitRow(line) : null;
    const separator = i + 1 < lines.length && isSeparatorRow(lines[i + 1])
      ? splitRow(lines[i + 1])
      : null;

    if (!header || !separator) {
      out.push(line);
      i += 1;
      continue;
    }

    // Normalise widths: the separator defines the column count.
    const columns = separator.length;
    const headerCells = Array.from({ length: columns }, (_, c) => header[c] ?? '');
    const body: string[][] = [];
    let j = i + 2;
    while (j < lines.length && isTableRow(lines[j])) {
      const cells = splitRow(lines[j]) ?? [];
      body.push(Array.from({ length: columns }, (_, c) => cells[c] ?? ''));
      j += 1;
    }
    while (body.length > 0 && body[body.length - 1].every((cell) => cell === '')) {
      body.pop();
    }

    // The engine pads a table with an extra blank line on both sides; a table
    // needs one blank line to separate it from the paragraph above.
    while (out.length > 1 && out[out.length - 1] === '' && out[out.length - 2] === '') {
      out.pop();
    }

    out.push(renderRow(headerCells));
    out.push(renderSeparator(separator));
    for (const row of body) out.push(renderRow(row));
    i = j;
  }

  return out.join('\n');
}
