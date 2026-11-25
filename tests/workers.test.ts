import { test } from 'node:test';
import assert from 'node:assert/strict';
// DOM globals for the parts of the graph that touch document/window.
import './dom-env.ts';
import * as XLSX from 'xlsx';

const g = globalThis as unknown as Record<string, unknown>;

interface LoadedWorker {
  handle: (event: { data: unknown }) => unknown;
  messages: unknown[];
}

// method, so a no-op keeps the import path happy without affecting behaviour.

let workerLoadCount = 0;

/**
 * Workers assign `self.onmessage` at module scope, so each module is imported
 * with a fresh fake `self` (and a cache-busting query) and its handler is
 * captured right away.
 */
async function loadWorker(modulePath: string): Promise<LoadedWorker> {
  const messages: unknown[] = [];
  const fakeSelf = {
    onmessage: null as null | ((event: { data: unknown }) => unknown),
    postMessage: (message: unknown) => {
      messages.push(message);
    },
  };
  g.self = fakeSelf;

  workerLoadCount += 1;
  await import(`${modulePath}?load=${workerLoadCount}`);

  const handle = fakeSelf.onmessage;
  assert.ok(handle, `worker ${modulePath} did not register onmessage`);
  return { handle: handle as (event: { data: unknown }) => unknown, messages };
}

// ── markdown → HTML (DOCX export) ──────────────────────────────────────────

test('mdRender worker renders markdown, YFM tables and LaTeX', async () => {
  const { handle, messages } = await loadWorker('../src/workers/mdRender.worker.ts');

  await handle({ data: { markdown: '# Title\n\n**bold**\n\n$x^2$\n' } });

  const reply = messages.at(-1) as { html: string; error?: string };
  assert.equal(reply.error, undefined);
  assert.match(reply.html, /<h1>Title<\/h1>/);
  assert.match(reply.html, /<strong>bold<\/strong>/);
});

test('mdRender worker converts YFM wide tables to HTML tables', async () => {
  const { handle, messages } = await loadWorker('../src/workers/mdRender.worker.ts');

  await handle({ data: { markdown: '#|\n|| A | B ||\n|| 1 | 2 ||\n|#\n' } });

  const reply = messages.at(-1) as { html: string };
  assert.match(reply.html, /<table/);
  assert.match(reply.html, /A/);
});

// ── XLSX / CSV → markdown table ────────────────────────────────────────────

function xlsxBuffer(): ArrayBuffer {
  // Build a tiny workbook in memory through the same library the worker uses.
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Name', 'Role'],
    ['Ann', 'Dev'],
    ['Bob', 'Ops'],
  ]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Sheet1');
  return XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

test('xlsxImport worker turns the first sheet into a pipe table', async () => {
  const { handle, messages } = await loadWorker('../src/workers/xlsxImport.worker.ts');

  handle({ data: { data: xlsxBuffer() } });

  const reply = messages.at(-1) as { table: string; error?: string };
  assert.equal(reply.error, undefined);
  assert.match(reply.table, /\| Name \| Role \|/);
  assert.match(reply.table, /\| Ann \| Dev \|/);
});

test('xlsxImport worker returns an empty table for an empty sheet', async () => {
  const sheet = XLSX.utils.aoa_to_sheet([[]]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Empty');
  const data = XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

  const { handle, messages } = await loadWorker('../src/workers/xlsxImport.worker.ts');
  handle({ data: { data } });

  const reply = messages.at(-1) as { table: string; error?: string };
  assert.equal(reply.table, '');
  assert.equal(reply.error, undefined);
});
// ── data files → tree rows ─────────────────────────────────────────────────

test('dataParse worker returns rows and stats for valid JSON', async () => {
  const { handle, messages } = await loadWorker('../src/workers/dataParse.worker.ts');

  handle({ data: { text: '{"name":"demo","items":[1,2]}', kind: 'json' } });

  const reply = messages.at(-1) as {
    ok: boolean;
    rows: Array<{ label: string }>;
    stats: { objects: number; arrays: number } | null;
    error: unknown;
  };
  assert.equal(reply.ok, true);
  assert.equal(reply.error, null);
  assert.equal(reply.stats?.objects, 1);
  assert.equal(reply.stats?.arrays, 1);
  assert.ok(reply.rows.some((row) => row.label === 'name'));
});

test('dataParse worker reports a parse error position', async () => {
  const { handle, messages } = await loadWorker('../src/workers/dataParse.worker.ts');

  handle({ data: { text: '{\n "a" 1\n}', kind: 'json' } });

  const reply = messages.at(-1) as {
    ok: boolean;
    rows: unknown[];
    error: { line: number; column: number } | null;
  };
  assert.equal(reply.ok, false);
  assert.equal(reply.rows.length, 0);
  assert.equal(reply.error?.line, 2);
});