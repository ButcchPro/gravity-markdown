import { test } from 'node:test';
import assert from 'node:assert/strict';
import './dom-env.ts';

import {
  bytesToBase64,
  isAccessError,
  safeReadTextFile,
  safeWriteBinaryFile,
  safeWriteTextFile,
  type FsAdapter,
} from '../src/utils/ipc.ts';

interface Calls {
  readTextFile: string[];
  writeTextFile: Array<{ path: string; content: string }>;
  writeFile: Array<{ path: string; size: number }>;
  invokeRead: string[];
  invokeWrite: Array<{ path: string; content: string }>;
  invokeWriteBinary: Array<{ path: string; base64: string }>;
}

/**
 * Adapter whose every entry can fail with a given error, so the access-denied
 * fallback path is exercised exactly like in production.
 */
function fsAdapter(failWith?: unknown): { adapter: FsAdapter; calls: Calls } {
  const calls: Calls = {
    readTextFile: [],
    writeTextFile: [],
    writeFile: [],
    invokeRead: [],
    invokeWrite: [],
    invokeWriteBinary: [],
  };
  const boom = async () => {
    throw failWith ?? { code: 'FS_IO_ERROR', message: 'plain failure' };
  };

  const adapter: FsAdapter = {
    readTextFile: async (path) => {
      calls.readTextFile.push(path);
      if (failWith !== undefined) return boom();
      return 'primary read';
    },
    writeTextFile: async (path, content) => {
      calls.writeTextFile.push({ path, content });
      if (failWith !== undefined) return boom();
    },
    writeFile: async (path, data) => {
      calls.writeFile.push({ path, size: data.length });
      if (failWith !== undefined) return boom();
    },
    invokeRead: async (path) => {
      calls.invokeRead.push(path);
      return 'ipc read';
    },
    invokeWrite: async (path, content) => {
      calls.invokeWrite.push({ path, content });
    },
    invokeWriteBinary: async (path, base64) => {
      calls.invokeWriteBinary.push({ path, base64 });
    },
  };

  return { adapter, calls };
}

const ACCESS_STRUCTURED = { code: 'FS_ACCESS_DENIED', message: 'denied by ACL' };
const ACCESS_LEGACY = new Error('EACCES: permission denied, open ...');
const OTHER_ERROR = { code: 'FS_NOT_FOUND', message: 'no such file' };

// ── isAccessError ──────────────────────────────────────────────────────────

test('detects access errors from structured codes and legacy messages', () => {
  assert.equal(isAccessError(ACCESS_STRUCTURED), true);
  assert.equal(isAccessError(ACCESS_LEGACY), true);
  assert.equal(isAccessError({ code: 'FS_IO_ERROR', message: 'EPERM on write' }), true);
  assert.equal(isAccessError(OTHER_ERROR), false);
  assert.equal(isAccessError(new Error('disk full')), false);
});

// ── safeReadTextFile ───────────────────────────────────────────────────────

test('safeReadTextFile uses plugin-fs when it succeeds', async () => {
  const { adapter, calls } = fsAdapter();
  assert.equal(await safeReadTextFile('C:/a.md', adapter), 'primary read');
  assert.deepEqual(calls.invokeRead, []);
});

test('safeReadTextFile falls back to the IPC reader on access denial', async () => {
  const { adapter, calls } = fsAdapter(ACCESS_STRUCTURED);
  assert.equal(await safeReadTextFile('C:/a.md', adapter), 'ipc read');
  assert.deepEqual(calls.invokeRead, ['C:/a.md']);
});

test('safeReadTextFile rethrows non-access errors', async () => {
  const { adapter } = fsAdapter(OTHER_ERROR);
  await assert.rejects(safeReadTextFile('C:/a.md', adapter), (error: unknown) => {
    assert.deepEqual(error, OTHER_ERROR);
    return true;
  });
});

// ── safeWriteTextFile ──────────────────────────────────────────────────────

test('safeWriteTextFile writes through plugin-fs first', async () => {
  const { adapter, calls } = fsAdapter();
  await safeWriteTextFile('C:/a.md', '# hi', adapter);
  assert.deepEqual(calls.writeTextFile, [{ path: 'C:/a.md', content: '# hi' }]);
  assert.deepEqual(calls.invokeWrite, []);
});

test('safeWriteTextFile falls back to the IPC writer on access denial', async () => {
  const { adapter, calls } = fsAdapter(ACCESS_STRUCTURED);
  await safeWriteTextFile('C:/a.md', '# hi', adapter);
  assert.deepEqual(calls.invokeWrite, [{ path: 'C:/a.md', content: '# hi' }]);
});

test('safeWriteTextFile rethrows non-access errors', async () => {
  const { adapter } = fsAdapter(OTHER_ERROR);
  await assert.rejects(safeWriteTextFile('C:/a.md', 'x', adapter));
});

// ── safeWriteBinaryFile ────────────────────────────────────────────────────

test('safeWriteBinaryFile writes bytes directly when allowed', async () => {
  const { adapter, calls } = fsAdapter();
  await safeWriteBinaryFile('C:/a.docx', new Uint8Array([1, 2, 3]), adapter);
  assert.deepEqual(calls.writeFile, [{ path: 'C:/a.docx', size: 3 }]);
  assert.deepEqual(calls.invokeWriteBinary, []);
});

test('safeWriteBinaryFile falls back to base64 over IPC', async () => {
  const { adapter, calls } = fsAdapter(ACCESS_LEGACY);
  await safeWriteBinaryFile('C:/a.docx', new Uint8Array([1, 2, 3]), adapter);
  assert.equal(calls.invokeWriteBinary.length, 1);
  assert.equal(calls.invokeWriteBinary[0].base64, btoa('\x01\x02\x03'));
});

test('safeWriteBinaryFile rethrows non-access errors', async () => {
  const { adapter } = fsAdapter(OTHER_ERROR);
  await assert.rejects(safeWriteBinaryFile('C:/a.docx', new Uint8Array([1]), adapter));
});

test('bytesToBase64 handles payloads larger than one chunk', () => {
  const size = 8192 * 2 + 5;
  const data = new Uint8Array(size);
  for (let i = 0; i < size; i += 1) data[i] = i % 256;

  const encoded = bytesToBase64(data);
  const decoded = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));

  assert.equal(decoded.length, size);
  assert.deepEqual(decoded, data);
});
