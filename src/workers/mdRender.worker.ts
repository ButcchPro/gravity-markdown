/// Markdown → HTML render off the main thread for DOCX export.
/// Uses the same pipeline as the editor (markdown-it + LaTeX + YFM tables).
/// DOM-heavy steps (DOMParser → docx objects) stay on the main thread because
/// DOMParser/Blob are unavailable inside workers.
/// Receives { markdown }, replies with { html }.

interface ExportRenderRequest {
  markdown: string;
}

self.onmessage = async (event: MessageEvent<ExportRenderRequest>) => {
  try {
    const MarkdownIt = (await import('markdown-it')).default;
    const { transform } = await import('@diplodoc/latex-extension');
    const yfmTable = (await import('@diplodoc/transform/lib/plugins/table')).default;

    const md = new MarkdownIt({ html: true, linkify: true, breaks: true });
    md.use(transform({ bundle: false, validate: false }), { output: '' });
    // YFM wide-tables (#| ... |#) → plain <table> HTML.
    md.use(yfmTable);

    const html = md.render(event.data.markdown);
    self.postMessage({ html });
  } catch (e) {
    self.postMessage({
      html: '',
      error: e instanceof Error ? e.message : String(e),
    });
  }
};
