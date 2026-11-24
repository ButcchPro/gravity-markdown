/**
 * The Gravity editor models inline HTML (`<br>`, `<span>`, …) as a literal
 * atom, so a document opened with `<br>` inside a table cell shows the tag
 * text instead of a line break. Table cells cannot hold a ProseMirror hard
 * break, so breaks there become spaces; everywhere else `<br>` becomes the
 * Markdown hard break (`  \n`) the editor does understand.
 */
const BR_TEST = /<br\s*\/?>/i;
const BR_GLOBAL = /<br\s*\/?>/gi;

function isTableRow(line: string): boolean {
  return /^\s*\|.*\|\s*$/.test(line);
}

export function normalizeInlineBreaks(markdown: string): string {
  if (!BR_TEST.test(markdown)) return markdown;

  const out: string[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    if (!BR_TEST.test(line)) {
      out.push(line);
      continue;
    }

    if (isTableRow(line)) {
      // A pipe-table cell has no line-break node; keep the words separated.
      out.push(line.replace(BR_GLOBAL, ' ').replace(/[ \t]{2,}/g, ' '));
      continue;
    }

    // Two trailing spaces + newline is a Markdown hard break (renders as <br>).
    out.push(...line.replace(BR_GLOBAL, '  \n').split('\n'));
  }
  return out.join('\n');
}
