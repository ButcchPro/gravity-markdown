/**
 * DOCX → Markdown conversion, extracted from the worker so the message shape
 * and the turndown pass can be tested without a browser.
 */
import TurndownService from 'turndown';

export interface DocxConvertResult {
  markdown: string;
  warnings: string[];
}

/** Converts HTML (from any DOCX reader) to markdown. */
export function htmlToMarkdown(html: string): string {
  const turndownService = new TurndownService();
  return turndownService.turndown(html);
}

/**
 * Reads a DOCX archive and returns markdown plus reader warnings.
 * `readHtml` is injected because mammoth accepts an `arrayBuffer` in the
 * browser build only — the app passes its browser reader, tests pass a fake.
 */
export async function convertDocxToMarkdown(
  buffer: ArrayBuffer,
  readHtml: (buffer: ArrayBuffer) => Promise<{ value: string; messages: Array<{ message: string }> }>,
): Promise<DocxConvertResult> {
  const result = await readHtml(buffer);
  const markdown = htmlToMarkdown(result.value);
  const warnings = Array.isArray(result.messages)
    ? result.messages.map((message) => message.message)
    : [];

  return {
    markdown: markdown.trim() ? markdown : '',
    warnings,
  };
}
