import { test } from 'node:test';
import assert from 'node:assert/strict';
// DOM globals first: the converter walks real DOM nodes.
import './dom-env.ts';

import { buildDocxDocument, exportMarkdownToDocx } from '../src/utils/exportDocx.ts';
import type { ExportDocxDeps } from '../src/utils/exportDocx.ts';
import { Document } from 'docx';

interface Harness {
  deps: ExportDocxDeps;
  written: Array<{ path: string; bytes: Uint8Array }>;
  notifications: Array<{ message: string; theme: string }>;
  errors: unknown[];
}

function harness(overrides: Partial<ExportDocxDeps> = {}): Harness {
  const written: Array<{ path: string; bytes: Uint8Array }> = [];
  const notifications: Array<{ message: string; theme: string }> = [];
  const errors: unknown[] = [];

  const deps: ExportDocxDeps = {
    choosePath: async () => 'C:/out/report.docx',
    renderHtml: async () => '<h1>Title</h1><p>Body text</p>',
    writeFile: async (path, bytes) => {
      written.push({ path, bytes });
    },
    notify: (message, theme) => {
      notifications.push({ message, theme });
    },
    logError: (error) => {
      errors.push(error);
    },
    ...overrides,
  };

  return { deps, written, notifications, errors };
}

test('builds a docx document from an HTML body', () => {
  const doc = buildDocxDocument('<h1>Title</h1><p>Text</p><table><tr><td>a</td></tr></table>');
  assert.ok(doc instanceof Document);
});

test('writes a packed .docx and reports success', async () => {
  const { deps, written, notifications, errors } = harness();

  const result = await exportMarkdownToDocx('# Title\n\nBody text', deps);

  assert.equal(result, true);
  assert.equal(written.length, 1);
  assert.equal(written[0].path, 'C:/out/report.docx');
  // A .docx is a ZIP archive: packed bytes start with "PK".
  assert.equal(written[0].bytes[0], 0x50);
  assert.equal(written[0].bytes[1], 0x4b);
  assert.ok(written[0].bytes.length > 1000);
  assert.deepEqual(notifications, [{ message: 'Exported to DOCX', theme: 'success' }]);
  assert.equal(errors.length, 0);
});

test('does nothing when the user cancels the save dialog', async () => {
  const { deps, written, notifications } = harness({ choosePath: async () => null });

  const result = await exportMarkdownToDocx('# Title', deps);

  assert.equal(result, false);
  assert.equal(written.length, 0);
  assert.equal(notifications.length, 0);
});

test('reports a render failure and writes nothing', async () => {
  const { deps, written, notifications, errors } = harness({
    renderHtml: async () => {
      throw new Error('worker crashed');
    },
  });

  const result = await exportMarkdownToDocx('# Title', deps);

  assert.equal(result, false);
  assert.equal(written.length, 0);
  assert.deepEqual(notifications, [{ message: 'Export error: worker crashed', theme: 'danger' }]);
  assert.equal(errors.length, 1);
});

test('reports a write failure (permissions, locked file)', async () => {
  const { deps, notifications, errors } = harness({
    writeFile: async () => {
      throw new Error('access denied');
    },
  });

  const result = await exportMarkdownToDocx('# Title', deps);

  assert.equal(result, false);
  assert.deepEqual(notifications, [{ message: 'Export error: access denied', theme: 'danger' }]);
  assert.equal(errors.length, 1);
});

test('handles a thrown non-Error value', async () => {
  const { deps, notifications } = harness({
    renderHtml: async () => {
      throw 'plain string failure';
    },
  });

  const result = await exportMarkdownToDocx('# Title', deps);

  assert.equal(result, false);
  assert.deepEqual(notifications, [
    { message: 'Export error: plain string failure', theme: 'danger' },
  ]);
});

test('exports a document with an empty body', async () => {
  const { deps, written, notifications } = harness({ renderHtml: async () => '' });

  const result = await exportMarkdownToDocx('', deps);

  assert.equal(result, true);
  assert.equal(written.length, 1);
  assert.deepEqual(notifications, [{ message: 'Exported to DOCX', theme: 'success' }]);
});
