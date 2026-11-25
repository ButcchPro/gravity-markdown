import { test } from 'node:test';
import assert from 'node:assert/strict';
// Must run before the converter is imported: it needs global DOM classes.
import { html } from './dom-env.ts';

import {
  htmlToDocxChildren,
  parseInlineElements,
  parseHtmlFragment,
  SPACING,
} from '../src/utils/htmlToDocx.ts';
import { ExternalHyperlink, Paragraph, Table } from 'docx';

/** Serialised docx tree, handy for marker assertions (style ids, shading…). */
function docxJson(value: unknown): string {
  return JSON.stringify(value);
}

/** Collects the visible text of a docx node tree (w:t contents). */
function collectText(node: unknown): string {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(collectText).join('');
  if (typeof node === 'object') {
    const record = node as Record<string, unknown>;
    if (record.rootKey === 'w:t') {
      const parts = Array.isArray(record.root)
        ? record.root.filter((part) => typeof part === 'string')
        : [];
      return parts.join('');
    }
    return collectText(record.root);
  }
  return '';
}

function firstParagraph(children: unknown[]): Paragraph {
  const paragraph = children.find((child) => child instanceof Paragraph);
  assert.ok(paragraph, 'expected a Paragraph');
  return paragraph as Paragraph;
}

function runFormatting(run: unknown): string {
  const properties = (run as { properties?: { root?: unknown[] } }).properties;
  return docxJson(properties?.root ?? []);
}

test('parses an HTML string into a container element', () => {
  const fragment = parseHtmlFragment('<h1>Title</h1><p>Body</p>');
  assert.equal(fragment.children.length, 2);
  assert.equal((fragment.children[0] as HTMLElement).tagName, 'H1');
});

test('keeps plain text nodes as paragraphs', () => {
  const children = htmlToDocxChildren(html('just text') as unknown as Node);
  assert.equal(children.length, 1);
  assert.equal(collectText(firstParagraph(children)), 'just text');
});

test('maps headings h1–h6 to docx heading styles', () => {
  const markup = '<h1>One</h1><h2>Two</h2><h3>Three</h3><h4>Four</h4><h5>Five</h5><h6>Six</h6>';
  const children = htmlToDocxChildren(html(markup) as unknown as Node);
  assert.equal(children.length, 6);
  assert.deepEqual(children.map((child) => collectText(child)), ['One', 'Two', 'Three', 'Four', 'Five', 'Six']);
  assert.ok(docxJson(children[0]).includes('Heading1'));
  assert.ok(docxJson(children[5]).includes('Heading6'));
});

test('preserves bold, italic, underline and strike formatting', () => {
  const bold = parseInlineElements(html('<strong>bold</strong>'))[0];
  assert.ok(runFormatting(bold).includes('w:b'));
  assert.equal(collectText(bold), 'bold');

  const italic = parseInlineElements(html('<em>it</em>'))[0];
  assert.ok(runFormatting(italic).includes('w:i'));

  const underline = parseInlineElements(html('<u>u</u>'))[0];
  assert.ok(runFormatting(underline).includes('w:u'));

  const strike = parseInlineElements(html('<s>s</s>'))[0];
  assert.ok(runFormatting(strike).includes('w:strike'));
});

test('renders inline code with a monospace font', () => {
  const run = parseInlineElements(html('<code>x = 1</code>'))[0];
  assert.ok(runFormatting(run).includes('Courier New'));
  assert.equal(collectText(run), 'x = 1');
});

test('turns links into hyperlinks', () => {
  const runs = parseInlineElements(html('<a href="https://example.com">site</a>'));
  assert.equal(runs.length, 1);
  assert.ok(runs[0] instanceof ExternalHyperlink);
});

test('keeps sub/superscript, line breaks and image alt text', () => {
  const sub = parseInlineElements(html('H<sub>2</sub>'))[1];
  assert.ok(runFormatting(sub).includes('w:vertAlign'));
  assert.equal(collectText(sub), '2');

  const sup = parseInlineElements(html('x<sup>2</sup>'))[1];
  assert.ok(runFormatting(sup).includes('w:vertAlign'));
  assert.equal(collectText(sup), '2');

  const broken = parseInlineElements(html('<br>'))[0];
  assert.ok(docxJson(broken).includes('w:br'));

  const image = parseInlineElements(html('<img alt="chart">'))[0];
  assert.equal(collectText(image), '[chart]');
});

test('renders YFM LaTeX placeholders through the unicode converter', () => {
  const runs = parseInlineElements(
    html('<span class="yfm-latex" data-content="%5Calpha%20%2B%20%5Cbeta"></span>'),
  );
  assert.equal(runs.length, 1);
  assert.equal(collectText(runs[0]), 'α + β');
  assert.ok(runFormatting(runs[0]).includes('Cambria Math'));
});

test('renders KaTeX output as a fallback text run', () => {
  const runs = parseInlineElements(html('<span class="katex"><span>x</span></span>'));
  assert.equal(runs.length, 1);
  assert.equal(collectText(runs[0]), 'x');
});

test('converts block LaTeX paragraphs centred and italic', () => {
  const children = htmlToDocxChildren(
    html('<p class="yfm-latex" data-content="%5Csum"></p>') as unknown as Node,
  );
  assert.equal(children.length, 1);
  assert.equal(collectText(children[0]), '∑');
  assert.ok(docxJson(children[0]).includes('w:jc'));
  assert.ok(docxJson(children[0]).includes('Cambria Math'));
});

test('renders bullet and nested bullet lists', () => {
  const children = htmlToDocxChildren(
    html('<ul><li>one</li><li>two<ul><li>nested</li></ul></li></ul>') as unknown as Node,
  );
  assert.deepEqual(children.map((child) => collectText(child)), ['one', 'two', 'nested']);
  assert.ok(docxJson(children[0]).includes('w:numPr'));
});

test('renders ordered lists with numbering', () => {
  const children = htmlToDocxChildren(
    html('<ol><li>first</li><li>second</li></ol>') as unknown as Node,
  );
  assert.equal(children.length, 2);
  assert.deepEqual(children.map((child) => collectText(child)), ['first', 'second']);
  assert.ok(docxJson(children[0]).includes('w:numPr'));
});

test('converts blockquotes with indent, border and quote spacing', () => {
  const children = htmlToDocxChildren(html('<blockquote><p>quoted</p></blockquote>') as unknown as Node);
  assert.equal(children.length, 1);
  const json = docxJson(children[0]);
  assert.ok(json.includes('ccc')); // left border colour
  assert.ok(json.includes('w:ind'));
  assert.ok(json.includes(String(SPACING.QUOTE.after)));
});

test('splits code blocks line by line with a monospace font', () => {
  const children = htmlToDocxChildren(
    html('<pre><code>line1\nline2</code></pre>') as unknown as Node,
  );
  assert.equal(children.length, 2);
  assert.deepEqual(children.map((child) => collectText(child)), ['line1', 'line2']);
  assert.ok(docxJson(children[0]).includes('Courier New'));
});

test('converts horizontal rules to a bordered paragraph', () => {
  const children = htmlToDocxChildren(html('<hr>') as unknown as Node);
  assert.equal(children.length, 1);
  assert.ok(children[0] instanceof Paragraph);
  assert.ok(docxJson(children[0]).includes('w:pBdr'));
});

test('converts definition lists used by YFM notes', () => {
  const children = htmlToDocxChildren(
    html('<dl><dt>Term</dt><dd>Definition</dd></dl>') as unknown as Node,
  );
  assert.deepEqual(children.map((child) => collectText(child)), ['Term', 'Definition']);
  assert.ok(docxJson(children[0]).includes('w:b'));
});

test('renders details/summary as a titled block plus its content', () => {
  const children = htmlToDocxChildren(
    html('<details><summary>Cut</summary><p>Inside</p></details>') as unknown as Node,
  );
  assert.equal(collectText(children[0]), '▸ Cut');
  assert.ok(children.some((child) => collectText(child) === 'Inside'));
});

test('renders figure with image alt text and caption', () => {
  const children = htmlToDocxChildren(
    html('<figure><img alt="diagram"><figcaption>Caption</figcaption></figure>') as unknown as Node,
  );
  assert.deepEqual(children.map((child) => collectText(child)), ['[diagram]', 'Caption']);
});

test('converts a plain table with a header row', () => {
  const children = htmlToDocxChildren(
    html('<table><thead><tr><th>H1</th><th>H2</th></tr></thead><tbody><tr><td>a</td><td>b</td></tr></tbody></table>') as unknown as Node,
  );
  assert.equal(children.length, 1);
  assert.ok(children[0] instanceof Table);
  const json = docxJson(children[0]);
  assert.ok(json.includes('H1'));
  assert.ok(json.includes('a'));
});

test('preserves column and row spans in tables', () => {
  const markup = `
    <table>
      <tr><th colspan="2">Merged</th><th>C</th></tr>
      <tr><td rowspan="2">tall</td><td>b</td><td>c</td></tr>
      <tr><td>d</td><td>e</td></tr>
    </table>`;
  const children = htmlToDocxChildren(html(markup) as unknown as Node);
  assert.equal(children.length, 1);
  const json = docxJson(children[0]);
  assert.ok(json.includes('w:gridSpan'));
  assert.ok(json.includes('w:vMerge'));
});

test('pads ragged table rows to the widest column count', () => {
  const markup = '<table><tr><td>a</td><td>b</td><td>c</td></tr><tr><td>d</td></tr></table>';
  const children = htmlToDocxChildren(html(markup) as unknown as Node);
  assert.equal(children.length, 1);
  assert.ok(children[0] instanceof Table);
});

test('ignores an empty table', () => {
  const children = htmlToDocxChildren(html('<table></table>') as unknown as Node);
  assert.equal(children.length, 0);
});

test('recurses into generic containers', () => {
  const children = htmlToDocxChildren(html('<div><p>inside</p></div>') as unknown as Node);
  assert.deepEqual(children.map((child) => collectText(child)), ['inside']);
});
test('renders highlighted text as bold runs', () => {
  const run = parseInlineElements(html('<mark>highlighted</mark>'))[0];
  assert.equal(collectText(run), 'highlighted');
  assert.ok(runFormatting(run).includes('w:b'));
});

test('recurses into generic inline wrappers', () => {
  const runs = parseInlineElements(html('<span><strong>wrapped</strong></span>'));
  assert.equal(collectText(runs[0]), 'wrapped');
  assert.ok(runFormatting(runs[0]).includes('w:b'));
});

test('renders KaTeX display math inside a paragraph', () => {
  const children = htmlToDocxChildren(
    html('<p>before<span class="katex-display">x^2</span></p>') as unknown as Node,
  );
  assert.equal(children.length, 1);
  assert.equal(collectText(children[0]), 'x^2');
  assert.ok(docxJson(children[0]).includes('Cambria Math'));
});

test('renders a standalone KaTeX display block centred', () => {
  const children = htmlToDocxChildren(
    html('<div class="katex-display">\\sum_{i}</div>') as unknown as Node,
  );
  assert.equal(children.length, 1);
  assert.equal(collectText(children[0]), '\\sum_{i}');
  assert.ok(docxJson(children[0]).includes('w:jc'));
});

test('skips standalone summary elements', () => {
  const children = htmlToDocxChildren(html('<summary>orphan</summary>') as unknown as Node);
  assert.equal(children.length, 0);
});