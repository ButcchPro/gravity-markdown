import { useCallback } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, Table, TableRow, TableCell, BorderStyle,
  ExternalHyperlink, WidthType, LevelFormat,
  LineRuleType,
} from 'docx';
import { safeWriteBinaryFile } from '../utils/ipc';
import { notify } from '../utils/notify';
import { latexToUnicode } from '../utils/latexToUnicode';

// ── Spacing constants (in twips: 1pt = 20 twips) ──
const SPACING = {
  // Normal paragraph: 1.15 line spacing, 8pt after
  PARAGRAPH: { line: 276, lineRule: LineRuleType.AUTO, after: 160 },
  // Headings: 1.15 line spacing, varying before/after
  H1: { line: 276, lineRule: LineRuleType.AUTO, before: 480, after: 200 },
  H2: { line: 276, lineRule: LineRuleType.AUTO, before: 360, after: 160 },
  H3: { line: 276, lineRule: LineRuleType.AUTO, before: 280, after: 120 },
  H4: { line: 276, lineRule: LineRuleType.AUTO, before: 240, after: 100 },
  H5: { line: 276, lineRule: LineRuleType.AUTO, before: 200, after: 80 },
  H6: { line: 276, lineRule: LineRuleType.AUTO, before: 200, after: 80 },
  // List items: 1.15 line spacing, 4pt after
  LIST: { line: 276, lineRule: LineRuleType.AUTO, after: 80 },
  // Blockquote: 1.15 line spacing, 4pt after
  QUOTE: { line: 276, lineRule: LineRuleType.AUTO, after: 80 },
  // Code blocks: 1.0 line spacing (single), no extra after
  CODE: { line: 240, lineRule: LineRuleType.AUTO, after: 0 },
  // Block math: 1.15 line spacing, 12pt before & after
  MATH: { line: 276, lineRule: LineRuleType.AUTO, before: 240, after: 240 },
  // Table cells: 1.0 line spacing, 2pt after
  TABLE_CELL: { line: 240, lineRule: LineRuleType.AUTO, after: 40 },
} as const;

interface UseExportParams {
  currentValue: string;
}

/**
 * Parse an HTML string into an HTMLElement using the browser's DOMParser.
 */
function parseHTML(html: string): HTMLElement {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  return doc.body.firstElementChild as HTMLElement;
}

/**
 * Extract inline elements from a DOM node, preserving formatting as TextRun options.
 * Supports nested formatting (e.g., bold inside italic).
 */
function parseInlineElements(node: Node, inherited: { bold?: boolean; italics?: boolean; strike?: boolean; underline?: boolean } = {}): (TextRun | ExternalHyperlink)[] {
  const runs: (TextRun | ExternalHyperlink)[] = [];

  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? '';
      if (text) {
        const opts: Record<string, unknown> = { text };
        if (inherited.bold) opts.bold = true;
        if (inherited.italics) opts.italics = true;
        if (inherited.strike) opts.strike = true;
        if (inherited.underline) opts.underline = { type: 'single' as const };
        runs.push(new TextRun(opts as ConstructorParameters<typeof TextRun>[0]));
      }
      continue;
    }

    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const el = child as HTMLElement;
    const tag = el.tagName.toLowerCase();

    // YFM LaTeX placeholder: extract from data-content attribute (URL-encoded LaTeX source)
    if (el.classList.contains('yfm-latex') && el.hasAttribute('data-content')) {
      const rawLatex = decodeURIComponent(el.getAttribute('data-content') ?? '');
      const text = latexToUnicode(rawLatex);
      if (text.trim()) {
        runs.push(new TextRun({ text: text.trim(), italics: true, font: 'Cambria Math' }));
      }
      continue;
    }
    // KaTeX-rendered math: extract text content from .katex elements (fallback)
    if (el.classList.contains('katex') || el.classList.contains('katex-display')) {
      const text = el.textContent ?? '';
      if (text.trim()) {
        runs.push(new TextRun({ text: text.trim(), italics: true, font: 'Cambria Math' }));
      }
      continue;
    }

    // Bold — recurse to preserve nested formatting
    if (tag === 'strong' || tag === 'b') {
      runs.push(...parseInlineElements(el, { ...inherited, bold: true }));
      continue;
    }

    // Italic — recurse to preserve nested formatting
    if (tag === 'em' || tag === 'i') {
      runs.push(...parseInlineElements(el, { ...inherited, italics: true }));
      continue;
    }

    // Underline
    if (tag === 'u') {
      runs.push(...parseInlineElements(el, { ...inherited, underline: true }));
      continue;
    }

    // Strikethrough — recurse
    if (tag === 's' || tag === 'del') {
      runs.push(...parseInlineElements(el, { ...inherited, strike: true }));
      continue;
    }

    // Highlighted text
    if (tag === 'mark') {
      // Render as bold with yellow shading
      runs.push(...parseInlineElements(el, { ...inherited, bold: true }));
      continue;
    }

    // Inline code
    if (tag === 'code' && !el.closest('pre')) {
      const inner = el.textContent ?? '';
      runs.push(new TextRun({ text: inner, font: 'Courier New', shading: { fill: 'f0f0f0' } }));
      continue;
    }

    // Links
    if (tag === 'a') {
      const href = el.getAttribute('href') ?? '';
      const text = el.textContent ?? '';
      runs.push(new ExternalHyperlink({
        children: [new TextRun({ text, style: 'Hyperlink' })],
        link: href,
      }));
      continue;
    }

    // Subscript / Superscript
    if (tag === 'sub') {
      const inner = el.textContent ?? '';
      runs.push(new TextRun({ text: inner, subScript: true }));
      continue;
    }
    if (tag === 'sup') {
      const inner = el.textContent ?? '';
      runs.push(new TextRun({ text: inner, superScript: true }));
      continue;
    }

    // Line break inside inline context
    if (tag === 'br') {
      runs.push(new TextRun({ text: '', break: 1 }));
      continue;
    }

    // Image — output alt text in brackets
    if (tag === 'img') {
      const alt = el.getAttribute('alt') ?? 'image';
      runs.push(new TextRun({ text: `[${alt}]`, italics: true }));
      continue;
    }

    // Generic inline elements (span, etc.): recurse with inherited formatting
    if (el.childNodes.length > 0) {
      runs.push(...parseInlineElements(el, inherited));
    }
  }

  return runs;
}

/**
 * Convert HTML elements to docx Paragraph/Table children.
 */
function htmlToDocxChildren(container: Node): (Paragraph | Table)[] {
  const children: (Paragraph | Table)[] = [];

  for (const child of Array.from(container.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent?.trim() ?? '';
      if (text) {
        children.push(new Paragraph({ children: [new TextRun(text)], spacing: SPACING.PARAGRAPH }));
      }
      continue;
    }

    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const el = child as HTMLElement;
    const tag = el.tagName.toLowerCase();

    // Headings
    if (/^h[1-6]$/.test(tag)) {
      const level = parseInt(tag[1]);
      const headingLevels = [
        HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3,
        HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6,
      ];
      const headingSpacings = [SPACING.H1, SPACING.H2, SPACING.H3, SPACING.H4, SPACING.H5, SPACING.H6];
      children.push(new Paragraph({
        children: parseInlineElements(el),
        heading: headingLevels[level - 1],
        spacing: headingSpacings[level - 1],
      }));
      continue;
    }

    // Paragraphs
    if (tag === 'p') {
      // Check for YFM block LaTeX placeholder: <p class="yfm-latex" data-content="...">
      if (el.classList.contains('yfm-latex') && el.hasAttribute('data-content')) {
        const rawLatex = decodeURIComponent(el.getAttribute('data-content') ?? '');
        const text = latexToUnicode(rawLatex);
        children.push(new Paragraph({
          children: [new TextRun({ text: text.trim(), italics: true, font: 'Cambria Math' })],
          alignment: AlignmentType.CENTER,
          spacing: SPACING.MATH,
        }));
      }
      // Check for KaTeX display math inside
      else if (el.querySelector('.katex-display')) {
        const katexDisplay = el.querySelector('.katex-display')!;
        children.push(new Paragraph({
          children: [new TextRun({ text: katexDisplay.textContent?.trim() ?? '', italics: true, font: 'Cambria Math' })],
          alignment: AlignmentType.CENTER,
          spacing: SPACING.MATH,
        }));
      } else {
        children.push(new Paragraph({ children: parseInlineElements(el), spacing: SPACING.PARAGRAPH }));
      }
      continue;
    }

    // Block LaTeX (.katex-display standalone)
    if (el.classList.contains('katex-display')) {
      children.push(new Paragraph({
        children: [new TextRun({ text: el.textContent?.trim() ?? '', italics: true, font: 'Cambria Math' })],
        alignment: AlignmentType.CENTER,
        spacing: SPACING.MATH,
      }));
      continue;
    }

    // Tables
    if (tag === 'table') {
      const trs = el.querySelectorAll('tr');
      if (trs.length === 0) continue;

      const rows = Array.from(trs).map(tr => {
        const cells = Array.from(tr.querySelectorAll('th, td'));
        return cells.map(cell => {
          const isHeader = cell.tagName.toLowerCase() === 'th';
          const cellRuns = isHeader
            ? [new TextRun({ text: cell.textContent?.trim() ?? '', bold: true })]
            : parseInlineElements(cell);
          return new TableCell({
            children: [new Paragraph({ children: cellRuns, spacing: SPACING.TABLE_CELL })],
            width: { size: 2000, type: WidthType.DXA },
          });
        });
      });

      if (rows.length > 0 && rows[0].length > 0) {
        const colCount = Math.max(...rows.map(r => r.length));
        children.push(new Table({
          rows: rows.map(cells => new TableRow({
            children: Array.from({ length: colCount }, (_, ci) =>
              cells[ci] ?? new TableCell({ children: [new Paragraph('')] })
            ),
          })),
          width: { size: 9000, type: WidthType.DXA },
        }));
      }
      continue;
    }

    // Unordered lists
    if (tag === 'ul') {
      for (const li of Array.from(el.querySelectorAll(':scope > li'))) {
        // Check if li contains block elements (sublists, paragraphs)
        const hasBlocks = li.querySelector('ul, ol, p, pre, blockquote');
        if (hasBlocks) {
          // Process inline content as bullet, then recurse for blocks
          const inlineContent = parseInlineElements(li, {});
          // Filter out text from child block elements
          children.push(new Paragraph({
            children: inlineContent,
            bullet: { level: 0 },
            spacing: SPACING.LIST,
          }));
        } else {
          children.push(new Paragraph({
            children: parseInlineElements(li),
            bullet: { level: 0 },
            spacing: SPACING.LIST,
          }));
        }
      }
      continue;
    }

    // Ordered lists
    if (tag === 'ol') {
      for (const li of Array.from(el.querySelectorAll(':scope > li'))) {
        children.push(new Paragraph({
          children: parseInlineElements(li),
          numbering: { reference: 'default-numbering', level: 0 },
          spacing: SPACING.LIST,
        }));
      }
      continue;
    }

    // Blockquotes — recurse to handle nested paragraphs, lists, etc.
    if (tag === 'blockquote') {
      const innerChildren = htmlToDocxChildren(el);
      for (const innerChild of innerChildren) {
        if (innerChild instanceof Paragraph) {
          // Add indent and left border to each paragraph in the blockquote
          children.push(new Paragraph({
            ...innerChild,
            indent: { left: 720 },
            border: { left: { style: BorderStyle.SINGLE, size: 6, space: 10, color: 'cccccc' } },
            spacing: SPACING.QUOTE,
          }));
        } else {
          children.push(innerChild);
        }
      }
      continue;
    }

    // Preformatted / Code blocks
    if (tag === 'pre') {
      const code = el.querySelector('code');
      const text = code?.textContent ?? el.textContent ?? '';
      // Split multi-line code into separate paragraphs
      const codeLines = text.split('\n');
      for (const line of codeLines) {
        children.push(new Paragraph({
          children: [new TextRun({ text: line, font: 'Courier New', size: 20 })],
          shading: { fill: 'f5f5f5' },
          spacing: SPACING.CODE,
        }));
      }
      continue;
    }

    // Horizontal rule
    if (tag === 'hr') {
      children.push(new Paragraph({
        children: [new TextRun({ text: '' })],
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, space: 1, color: 'dddddd' } },
      }));
      continue;
    }

    // Definition lists (YFM notes, cuts)
    if (tag === 'dl') {
      const dts = el.querySelectorAll(':scope > dt');
      const dds = el.querySelectorAll(':scope > dd');
      for (const dt of Array.from(dts)) {
        children.push(new Paragraph({
          children: [new TextRun({ text: dt.textContent?.trim() ?? '', bold: true })],
          spacing: SPACING.PARAGRAPH,
        }));
      }
      for (const dd of Array.from(dds)) {
        children.push(new Paragraph({
          children: parseInlineElements(dd),
          indent: { left: 360 },
          spacing: SPACING.PARAGRAPH,
        }));
      }
      continue;
    }

    // Details/summary (YFM cuts)
    if (tag === 'details') {
      const summary = el.querySelector(':scope > summary');
      if (summary) {
        children.push(new Paragraph({
          children: [new TextRun({ text: `▸ ${summary.textContent?.trim() ?? ''}`, bold: true })],
          spacing: SPACING.PARAGRAPH,
        }));
      }
      // Process rest of details content
      const innerChildren = htmlToDocxChildren(el);
      children.push(...innerChildren);
      continue;
    }
    if (tag === 'summary') {
      // Already handled by details
      continue;
    }

    // Figure/figcaption
    if (tag === 'figure') {
      const img = el.querySelector('img');
      const caption = el.querySelector('figcaption');
      if (img) {
        const alt = img.getAttribute('alt') ?? 'image';
        children.push(new Paragraph({
          children: [new TextRun({ text: `[${alt}]`, italics: true })],
          alignment: AlignmentType.CENTER,
          spacing: SPACING.PARAGRAPH,
        }));
      }
      if (caption) {
        children.push(new Paragraph({
          children: [new TextRun({ text: caption.textContent?.trim() ?? '', italics: true, size: 20 })],
          alignment: AlignmentType.CENTER,
          spacing: SPACING.PARAGRAPH,
        }));
      }
      continue;
    }

    // Generic block elements (div, section, article, main, etc.): recurse
    if (el.childNodes.length > 0) {
      children.push(...htmlToDocxChildren(el));
    }
  }

  return children;
}

export function useExport({ currentValue }: UseExportParams) {
  const handleExportDocx = useCallback(async () => {
    try {
      const file = await save({
        filters: [{ name: 'Word Document', extensions: ['docx'] }],
      });
      if (file && typeof file === 'string') {
        // Step 1: Markdown → HTML using markdown-it with LaTeX/KaTeX rendering
        const MarkdownIt = (await import('markdown-it')).default;
        const { transform } = await import('@diplodoc/latex-extension');

        const md = new MarkdownIt({ html: true, linkify: true, breaks: true });
        md.use(transform({ bundle: false, validate: false }), { output: '' });

        const htmlBody = md.render(currentValue);

        // Step 2: Parse HTML → docx elements
        const fragment = parseHTML(htmlBody);
        const children = htmlToDocxChildren(fragment);

        // Step 3: Build DOCX document with default styles
        const doc = new Document({
          styles: {
            default: {
              document: {
                run: {
                  font: 'Calibri',
                  size: 22, // 11pt
                },
                paragraph: {
                  spacing: SPACING.PARAGRAPH,
                },
              },
            },
          },
          numbering: {
            config: [{
              reference: 'default-numbering',
              levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.START }],
            }],
          },
          sections: [{
            properties: {
              page: {
                margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }, // 1 inch margins
              },
            },
            children,
          }],
        });

        // Step 4: Pack and save
        const buffer = await Packer.toBlob(doc);
        const uint8 = new Uint8Array(await buffer.arrayBuffer());
        await safeWriteBinaryFile(file, uint8);
        notify('Exported to DOCX', 'success');
      }
    } catch (e) {
      console.error('DOCX export error:', e);
      const msg = e instanceof Error ? e.message : String(e);
      notify(`Export error: ${msg}`, 'danger');
    }
  }, [currentValue]);

  return { handleExportDocx };
}
