import { test } from 'node:test';
import assert from 'node:assert/strict';
// DOM globals first: the converter and worker helpers touch DOM types.
import { domDocument, html } from './dom-env.ts';

import { htmlTableToPipeTable } from '../src/editor/tablePaste.ts';
import { countWords } from '../src/utils/text.ts';
import { describeIpcError, formatIpcError, ipcErrorPayload } from '../src/types/ipc.ts';
import { runWorker } from '../src/utils/worker.ts';
import { getFileName, isSupportedFile, isViewableFile, SUPPORTED_EXTENSIONS } from '../src/utils/path.ts';
import { fetchLatestGitHubVersion, RELEASES_PAGE_URL } from '../src/utils/versionCheck.ts';
import { normalizeForCompare, stripTrailingBlank } from '../src/utils/markdownText.ts';

/** Builds a detached <table> from markup for the paste converter. */
function table(markup: string): HTMLTableElement {
  const container = html(markup);
  return container.querySelector('table') as unknown as HTMLTableElement;
}

// ── HTML table paste → pipe table ──────────────────────────────────────────

test('converts a plain HTML table to a pipe table', () => {
  const markup = `
    <table>
      <thead><tr><th>Name</th><th>Role</th></tr></thead>
      <tbody><tr><td>Ann</td><td>Dev</td></tr></tbody>
    </table>`;
  assert.equal(
    htmlTableToPipeTable(table(markup)),
    '\n| Name | Role |\n| --- | --- |\n| Ann | Dev |\n',
  );
});

test('turns <br> in cells into spaces instead of gluing words', () => {
  const markup = '<table><tr><td>Connect<br>now</td><td>a<br/>b</td></tr></table>';
  assert.equal(
    htmlTableToPipeTable(table(markup)),
    '\n| Connect now | a b |\n| --- | --- |\n',
  );
});

test('pads short rows to the header width', () => {
  const markup = '<table><tr><td>a</td><td>b</td><td>c</td></tr><tr><td>d</td></tr></table>';
  assert.equal(
    htmlTableToPipeTable(table(markup)),
    '\n| a | b | c |\n| --- | --- | --- |\n| d |  |  |\n',
  );
});

test('escapes pipes found in cell text', () => {
  const markup = '<table><tr><td>Get-Item | Select</td></tr></table>';
  assert.equal(
    htmlTableToPipeTable(table(markup)),
    '\n| Get-Item \\| Select |\n| --- |\n',
  );
});

test('returns an empty string for a table without rows', () => {
  assert.equal(htmlTableToPipeTable(table('<table></table>')), '');
  assert.equal(htmlTableToPipeTable(table('<table><tbody></tbody></table>')), '');
});

// ── status-bar word count ──────────────────────────────────────────────────

test('counts words across scripts and skips punctuation', () => {
  assert.equal(countWords(''), 0);
  assert.equal(countWords('one two three'), 3);
  assert.equal(countWords('# Heading\n\n- bullet item'), 3);
  assert.equal(countWords('Привет мир'), 2);
  assert.equal(countWords("don't hyphen-ated"), 2);
  assert.equal(countWords('!!! ??? ...'), 0);
});

// ── IPC error payloads ─────────────────────────────────────────────────────

test('normalises structured AppError payloads', () => {
  assert.deepEqual(ipcErrorPayload({ code: 'FS_ACCESS_DENIED', message: 'denied' }), {
    code: 'FS_ACCESS_DENIED',
    message: 'denied',
  });
});

test('normalises plain errors and non-errors', () => {
  assert.deepEqual(ipcErrorPayload(new Error('boom')), { code: 'UNKNOWN', message: 'boom' });
  assert.deepEqual(ipcErrorPayload('oops'), { code: 'UNKNOWN', message: 'oops' });
  assert.deepEqual(ipcErrorPayload({ code: 1, message: 'x' }), {
    code: 'UNKNOWN',
    message: '[object Object]',
  });
});

test('formats errors for logs and users', () => {
  assert.equal(formatIpcError({ code: 'FS_NOT_FOUND', message: 'gone' }), 'FS_NOT_FOUND: gone');
  assert.equal(formatIpcError(new Error('boom')), 'boom');
  assert.equal(describeIpcError({ code: 'FS_ACCESS_DENIED', message: 'raw' }), 'the system denied access to this file');
  assert.equal(describeIpcError({ code: 'FS_TOO_LARGE', message: 'raw' }), 'the file is larger than the 32 MB limit');
  assert.equal(describeIpcError({ code: 'SOMETHING', message: 'fallback text' }), 'fallback text');
});

// ── one-shot worker helper ─────────────────────────────────────────────────

class FakeWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  posted: unknown[] = [];
  terminated = false;

  postMessage(message: unknown): void {
    this.posted.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  reply(data: unknown): void {
    this.onmessage?.({ data });
  }

  fail(): void {
    this.onerror?.();
  }
}

test('runWorker resolves with the worker reply and terminates it', async () => {
  const worker = new FakeWorker();
  const promise = runWorker<{ n: number }, { doubled: number }>(
    () => worker as unknown as Worker,
    { n: 21 },
  );

  assert.deepEqual(worker.posted, [{ n: 21 }]);
  worker.reply({ doubled: 42 });

  assert.deepEqual(await promise, { doubled: 42 });
  assert.equal(worker.terminated, true);
});

test('runWorker rejects when the worker replies with an error', async () => {
  const worker = new FakeWorker();
  const promise = runWorker(() => worker as unknown as Worker, {});
  worker.reply({ error: 'conversion failed' });

  await assert.rejects(promise, /conversion failed/);
  assert.equal(worker.terminated, true);
});

test('runWorker rejects when the worker crashes', async () => {
  const worker = new FakeWorker();
  const promise = runWorker(() => worker as unknown as Worker, {});
  worker.fail();

  await assert.rejects(promise, /Worker crashed during conversion/);
  assert.equal(worker.terminated, true);
});

// Keep the jsdom document referenced so the setup module is not tree-shaken away.
void domDocument;
// ── path helpers ───────────────────────────────────────────────────────────

test('extracts file names from both separators', () => {
  assert.equal(getFileName('C:\\docs\\note.md'), 'note.md');
  assert.equal(getFileName('/home/user/a.json'), 'a.json');
  assert.equal(getFileName('plain.md'), 'plain.md');
});

test('classifies editable markdown and read-only data files', () => {
  assert.equal(isSupportedFile('a.md'), true);
  assert.equal(isSupportedFile('A.MARKDOWN'), true);
  assert.equal(isSupportedFile('a.json'), false);

  assert.equal(isViewableFile('a.md'), true);
  assert.equal(isViewableFile('a.JSON'), true);
  assert.equal(isViewableFile('a.yaml'), true);
  assert.equal(isViewableFile('a.toml'), true);
  assert.equal(isViewableFile('a.exe'), false);
  assert.deepEqual([...SUPPORTED_EXTENSIONS], ['md', 'markdown', 'txt']);
});

// ── update-check network branches ──────────────────────────────────────────

function stubFetch(impl: (url: string) => Promise<Response>): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = ((url: string) => impl(String(url))) as typeof globalThis.fetch;
  return () => {
    globalThis.fetch = original;
  };
}

test('fetchLatestGitHubVersion parses a release tag', async () => {
  const restore = stubFetch(async () => new Response(JSON.stringify({ tag_name: 'v1.4.2' })));
  try {
    assert.equal(await fetchLatestGitHubVersion(), '1.4.2');
  } finally {
    restore();
  }
});

test('fetchLatestGitHubVersion rejects a malformed tag', async () => {
  const restore = stubFetch(async () => new Response(JSON.stringify({ tag_name: 'release-latest' })));
  try {
    assert.equal(await fetchLatestGitHubVersion(), null);
  } finally {
    restore();
  }
});

test('fetchLatestGitHubVersion returns null on HTTP errors and exceptions', async () => {
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    const httpError = stubFetch(async () => new Response('rate limited', { status: 403 }));
    try {
      assert.equal(await fetchLatestGitHubVersion(), null);
    } finally {
      httpError();
    }

    const throwing = stubFetch(async () => {
      throw new Error('offline');
    });
    try {
      assert.equal(await fetchLatestGitHubVersion(), null);
    } finally {
      throwing();
    }
  } finally {
    console.warn = originalWarn;
  }
});

test('RELEASES_PAGE_URL points at the releases page', () => {
  assert.match(RELEASES_PAGE_URL, /github\.com\/.+\/releases\/latest$/);
});
// ── save/clean text comparison ─────────────────────────────────────────────

test('normalizeForCompare ignores CRLF and trailing blank lines only', () => {
  assert.equal(normalizeForCompare('a\r\nb\r\n'), 'a\nb');
  assert.equal(normalizeForCompare('a\nb\n\n  '), 'a\nb');
  // A hard break inside the document is content, not noise.
  assert.notEqual(normalizeForCompare('a  \nb'), normalizeForCompare('a\nb'));
  // A real edit is never swallowed.
  assert.notEqual(normalizeForCompare('a\nb'), normalizeForCompare('a\nc'));
});

test('stripTrailingBlank produces the text that is written', () => {
  assert.equal(stripTrailingBlank('# Title\r\n\r\nBody\r\n\r\n'), '# Title\n\nBody\n');
  assert.equal(stripTrailingBlank('# Title\n'), '# Title\n');
  assert.equal(stripTrailingBlank(''), '');
});

test('a trailing newline no longer marks a saved document dirty', () => {
  const content = '# Title\n\nBody';
  const fromEditor = '# Title\n\nBody\r\n';
  assert.equal(normalizeForCompare(fromEditor) === normalizeForCompare(content), true);
});