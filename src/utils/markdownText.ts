/**
 * Text helpers for the save/clean state machine.
 *
 * The editor's serializer is not byte-stable: it may return CRLF line endings
 * or a trailing newline depending on when it last re-serialised. Those
 * differences are never content, so comparisons ignore them — while every
 * difference inside the document (including a deliberate hard break of two
 * trailing spaces on a line) still counts as an edit.
 */

/** Line endings unified to LF and trailing whitespace at EOF dropped. */
export function normalizeForCompare(text: string): string {
  return text.replace(/\r\n/g, '\n').trimEnd();
}

/** What actually gets written: LF endings, exactly one trailing newline. */
export function stripTrailingBlank(text: string): string {
  const body = normalizeForCompare(text);
  return body === '' ? '' : `${body}\n`;
}
