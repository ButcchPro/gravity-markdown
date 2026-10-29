/** Approximate word count for the status bar (markdown symbols are skipped). */
export function countWords(text: string): number {
  if (!text) return 0;
  const matches = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’‑-]*/gu);
  return matches ? matches.length : 0;
}
