/// DOCX → Markdown conversion off the main thread (mammoth + turndown).
/// Receives { buffer: ArrayBuffer }, replies with { markdown, warnings }.

import mammoth from 'mammoth';
import TurndownService from 'turndown';

interface ImportDocxRequest {
  buffer: ArrayBuffer;
}

self.onmessage = async (event: MessageEvent<ImportDocxRequest>) => {
  const { buffer } = event.data;
  try {
    const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
    const turndownService = new TurndownService();
    const markdown = turndownService.turndown(result.value);

    const warnings = Array.isArray(result.messages)
      ? result.messages.map((m: { message: string }) => m.message)
      : [];

    self.postMessage({
      markdown: markdown.trim() ? markdown : '',
      warnings,
    });
  } catch (e) {
    self.postMessage({
      markdown: '',
      warnings: [],
      error: e instanceof Error ? e.message : String(e),
    });
  }
};
