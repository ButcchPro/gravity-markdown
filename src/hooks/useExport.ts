import { useCallback } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, Table, TableRow, TableCell, BorderStyle,
  ExternalHyperlink, WidthType, LevelFormat,
  LineRuleType,
  type IParagraphOptions,
} from 'docx';
import { safeWriteBinaryFile } from '../utils/ipc';
import { notify } from '../utils/notify';
import { latexToUnicode } from '../utils/latexToUnicode';
import { runWorker } from '../utils/worker';

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
 */function parseInlineElements(node: Node, inherited: { bold?: boolean; italics?: boolean; strike?: boolean; underline?: boolean } = {}): (TextRun | ExternalHyperlink)[] {
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

/** List nesting limit: matches the numbering configuration defined below. */
const MAX_LIST_LEVEL = 1;

/**
 * Converts a <ul>/<ol> element into docx paragraphs, preserving nested lists
 * by flattening sublists into the numbered/bulleted items of the next level.
 */
function appendListItems(
  el: HTMLElement,
  ordered: boolean,
  level: number,
  out: (Paragraph | Table)[],
): void {
  const listMarker = ordered
    ? (lvl: number) => ({ numbering: { reference: 'default-numbering', level: lvl } })
    : (lvl: number) => ({ bullet: { level: lvl } });

  for (const li of Array.from(el.querySelectorAll(':scope > li'))) {
    // Inline part = the li without its direct nested sublists. Cloning keeps
    // the extracted markup, so nested content is not duplicated or lost.
    const inlinePart = li.cloneNode(true) as HTMLElement;
    for (const nested of inlinePart.querySelectorAll(':scope > ul, :scope > ol')) {
      nested.remove();
    }
    out.push(new Paragraph({
      children: parseInlineElements(inlinePart),
      ...listMarker(Math.min(level, MAX_LIST_LEVEL)),
      spacing: SPACING.LIST,
    }));
    // Direct nested sublists move one level deeper (content is preserved).
    for (const sublist of Array.from(li.children)) {
      if (sublist.tagName === 'UL' || sublist.tagName === 'OL') {
        appendListItems(sublist as HTMLElement, sublist.tagName === 'OL', level + 1, out);
      }
    }
  }
}

/**
 * Convert HTML elements to docx Paragraph/Table children.
 */
function htmlToDocxChildren(
  container: Node,
  context: { quote?: boolean } = {},
): (Paragraph | Table)[] {
  const children: (Paragraph | Table)[] = [];

  // Blockquote styling is applied while children are created instead of
  // copying finished paragraph instances (docx options cannot be cloned
  // reliably via object spread).
  const withQuote = (opts: IParagraphOptions): IParagraphOptions =>
    context.quote
      ? {
          ...opts,
          indent: { left: 720 },
          border: { left: { style: BorderStyle.SINGLE, size: 6, space: 10, color: 'cccccc' } },
          spacing: SPACING.QUOTE,
        }
      : opts;

  for (const child of Array.from(container.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent?.trim() ?? '';
      if (text) {
        children.push(new Paragraph(withQuote({ children: [new TextRun(text)], spacing: SPACING.PARAGRAPH })));
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
        children.push(new Paragraph(withQuote({ children: parseInlineElements(el), spacing: SPACING.PARAGRAPH })));
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

    // Tables — grid-based conversion preserving col/rowspan (YFM tables
    // merge cells via spans; standard markdown tables have none).
    if (tag === 'table') {
      interface CellSpec {
        el: HTMLTableCellElement;
        col: number;
        colSpan: number;
        rowSpan: number;
        header: boolean;
      }
      const trs = Array.from(el.querySelectorAll('tr'));
      if (trs.length === 0) continue;

      // Reserve a coordinate grid: walk each row's cells, skipping slots
      // already occupied by spans from earlier rows.
      const occupied = new Set<string>();
      const specsRows: CellSpec[][] = trs.map((tr, rowIndex) => {
        const domCells = Array.from(tr.children).filter(
          (c) => c.tagName === 'TH' || c.tagName === 'TD',
        ) as HTMLTableCellElement[];
        let col = 0;
        const specs = domCells.map((cell): CellSpec => {
          while (occupied.has(`${rowIndex}:${col}`)) col += 1;
          const colSpan = Math.max(1, Math.floor(cell.colSpan) || 1);
          const rowSpan = Math.max(1, Math.floor(cell.rowSpan) || 1);
          for (let r = rowIndex; r < rowIndex + rowSpan; r += 1) {
            for (let c = col; c < col + colSpan; c += 1) occupied.add(`${r}:${c}`);
          }
          const spec: CellSpec = { el: cell, col, colSpan, rowSpan, header: cell.tagName.toLowerCase() === 'th' };
          col += colSpan;
          return spec;
        });
        return specs;
      });

      const colCount = specsRows.reduce((max, specs) => Math.max(max, ...specs.map((s) => s.col + s.colSpan)), 0);
      if (colCount > 0) {
        const colWidth = Math.floor(9000 / colCount);
        const docxRows = specsRows.map((specs, rowIndex) => {
          const cells = specs.map((spec) => {
            const cellRuns = spec.header
              ? [new TextRun({ text: spec.el.textContent?.trim() ?? '', bold: true })]
              : parseInlineElements(spec.el);
            // Total table width 9000 DXA split equally per grid column.
            return new TableCell({
              children: [new Paragraph({ children: cellRuns, spacing: SPACING.TABLE_CELL })],
              width: { size: colWidth * spec.colSpan, type: WidthType.DXA },
              columnSpan: spec.colSpan > 1 ? spec.colSpan : undefined,
              rowSpan: spec.rowSpan > 1 ? spec.rowSpan : undefined,
            });
          });
          // Pad ragged rows (rows shorter than the widest one).
          let covered = 0;
          for (let c = 0; c < colCount; c += 1) {
            if (occupied.has(`${rowIndex}:${c}`)) covered += 1;
          }
          for (let c = covered; c < colCount; c += 1) {
            cells.push(new TableCell({ children: [new Paragraph('')] }));
          }
          return new TableRow({ children: cells });
        });
        children.push(new Table({ rows: docxRows, width: { size: 9000, type: WidthType.DXA } }));
      }
      continue;
    }

    // Unordered lists — nested sublists move one level deeper.
    if (tag === 'ul') {
      appendListItems(el as HTMLElement, false, 0, children);
      continue;
    }

    // Ordered lists — nested sublists move one level deeper.
    if (tag === 'ol') {
      appendListItems(el as HTMLElement, true, 0, children);
      continue;
    }

    // Blockquotes — recurse with quote context so every paragraph gets the
    // indent and left border at creation time (instance spread is unsafe).
    if (tag === 'blockquote') {
      children.push(...htmlToDocxChildren(el, { quote: true }));
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
      const innerChildren = htmlToDocxChildren(el, context);
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
      children.push(...htmlToDocxChildren(el, context));
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
        // Step 1: Markdown → HTML in a Web Worker (same pipeline as the editor:
        // markdown-it + LaTeX + YFM tables). DOMParser/Blob are unavailable in
        // workers, so the DOM → docx steps keep running on the main thread.
        const renderWorker = () =>
          new Worker(new URL('../workers/mdRender.worker.ts', import.meta.url), { type: 'module' });
        const { html: htmlBody } = await runWorker<{ markdown: string }, { html: string }>(
          renderWorker,
          { markdown: currentValue },
        );

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
              levels: [
                { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.START },
                { level: 1, format: LevelFormat.DECIMAL, text: '%2.', alignment: AlignmentType.START },
              ],
            }],
          },
          sections: [{
            properties: {
              page: {
                // GOST-style margins in twips (1 cm = 567 twips):
                // left 2.5 cm, right 2 cm, top 2 cm, bottom 2 cm.
                margin: { top: 1134, right: 1134, bottom: 1134, left: 1417 }, // cm: 2 / 2 / 2 / 2.5
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
