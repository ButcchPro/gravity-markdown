import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertDocxToMarkdown, htmlToMarkdown } from '../src/utils/docxConvert.ts';

const reader = (html: string, messages: Array<{ message: string }> = []) =>
  async () => ({ value: html, messages });

test('converts DOCX headings, paragraphs and lists to markdown', async () => {
  const html = [
    '<h1>Title</h1>',
    '<p>Body text.</p>',
    '<ul><li>first</li><li>second</li></ul>',
    '<table><tr><td>a</td><td>b</td></tr></table>',
  ].join('');

  const result = await convertDocxToMarkdown(new ArrayBuffer(8), reader(html));

  // turndown emits setext headings and * bullets by default.
  assert.match(result.markdown, /Title\n=+/);
  assert.match(result.markdown, /Body text\./);
  assert.match(result.markdown, /\* {2,3}first/);
  assert.match(result.markdown, /a/);
  assert.deepEqual(result.warnings, []);
});

test('passes reader warnings through', async () => {
  const result = await convertDocxToMarkdown(
    new ArrayBuffer(8),
    reader('<p>Text</p>', [{ message: 'unsupported style' }]),
  );

  assert.deepEqual(result.warnings, ['unsupported style']);
});

test('returns empty markdown for a document without content', async () => {
  const result = await convertDocxToMarkdown(new ArrayBuffer(8), reader('   '));
  assert.equal(result.markdown, '');
});

test('propagates a reader failure', async () => {
  await assert.rejects(
    convertDocxToMarkdown(new ArrayBuffer(8), async () => {
      throw new Error('bad archive');
    }),
    /bad archive/,
  );
});

test('htmlToMarkdown keeps inline formatting and code', () => {
  const markdown = htmlToMarkdown('<p><strong>bold</strong> and <code>x()</code></p>');
  assert.match(markdown, /\*\*bold\*\*/);
  assert.match(markdown, /`x\(\)`/);
});
