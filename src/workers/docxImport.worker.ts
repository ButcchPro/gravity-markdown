/// DOCX → Markdown conversion off the main thread (mammoth + turndown).
/// Receives { buffer: ArrayBuffer }, replies with { markdown, warnings }.

import mammoth from 'mammoth';
import { convertDocxToMarkdown } from '../utils/docxConvert.ts';

interface ImportDocxRequest {
  buffer: ArrayBuffer;
}

self.onmessage = async (event: MessageEvent<ImportDocxRequest>) => {
  const { buffer } = event.data;
  try {
    const result = await convertDocxToMarkdown(buffer, (data) =>
      mammoth.convertToHtml({ arrayBuffer: data }),
    );
    self.postMessage(result);
  } catch (e) {
    self.postMessage({
      markdown: '',
      warnings: [],
      error: e instanceof Error ? e.message : String(e),
    });
  }
};
