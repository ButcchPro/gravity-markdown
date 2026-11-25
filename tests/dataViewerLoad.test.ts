import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PARSE_INLINE_LIMIT,
  byteLength,
  loadDataInline,
  loadFromWorkerResponse,
  visibleRows,
} from '../src/utils/dataViewerLoad.ts';

test('counts UTF-8 bytes, not characters', () => {
  assert.equal(byteLength('abc'), 3);
  assert.equal(byteLength('привет'), 12); // two bytes per Cyrillic letter
});

test('loads valid JSON inline with stats and rows', () => {
  const load = loadDataInline('{"a":1,"b":[2,3]}', 'json');

  assert.equal(load.status.valid, true);
  assert.equal(load.status.label, 'JSON');
  assert.equal(load.status.stats?.objects, 1);
  assert.equal(load.status.stats?.arrays, 1);
  assert.deepEqual(load.rows.map((row) => row.label), ['$', 'a', 'b', '0', '1']);
});

test('loads YAML and TOML inline', () => {
  const yaml = loadDataInline('name: demo\nitems:\n  - 1\n', 'yaml');
  assert.equal(yaml.status.valid, true);
  assert.equal(yaml.status.label, 'YAML');
  assert.ok(yaml.rows.some((row) => row.label === 'name'));

  const toml = loadDataInline('[app]\nport = 8080\n', 'toml');
  assert.equal(toml.status.valid, true);
  assert.equal(toml.status.label, 'TOML');
});

test('reports a parse error with position and renders no rows', () => {
  const load = loadDataInline('{\n  "a" 1\n}', 'json');

  assert.equal(load.status.valid, false);
  assert.equal(load.status.stats, null);
  assert.equal(load.status.error?.line, 2);
  assert.ok((load.status.error?.column ?? 0) > 1);
  assert.deepEqual(load.rows, []);
});

test('exposes the inline parse limit for the component', () => {
  assert.equal(PARSE_INLINE_LIMIT, 256 * 1024);
});

test('maps a worker response to the viewer shape', () => {
  const ok = loadFromWorkerResponse('jsonc', {
    ok: true,
    rows: [{ id: '$', depth: 0, label: '$', valueKind: 'object', preview: '1 keys', hasChildren: true, childCount: 1, path: [] }],
    stats: { bytes: 10, objects: 1, arrays: 0, leaves: 0, depth: 1 },
    error: null,
  });

  assert.equal(ok.status.valid, true);
  assert.equal(ok.status.label, 'JSONC');
  assert.equal(ok.value, undefined); // worker rows cannot be collapsed
  assert.equal(ok.rows.length, 1);

  const failed = loadFromWorkerResponse('json', {
    ok: false,
    rows: [],
    stats: null,
    error: { message: 'bad', line: 3, column: 4 },
  });
  assert.equal(failed.status.valid, false);
  assert.equal(failed.status.error?.line, 3);
});

test('filters and collapses rows built from a parsed value', () => {
  const load = loadDataInline('{"name":"demo","items":[1,2],"nested":{"ok":true}}', 'json');

  assert.deepEqual(
    visibleRows(load, new Set(), '').map((row) => row.label),
    ['$', 'name', 'items', '0', '1', 'nested', 'ok'],
  );

  assert.deepEqual(
    visibleRows(load, new Set(['$.items']), '').map((row) => row.label),
    ['$', 'name', 'items', 'nested', 'ok'],
  );

  assert.deepEqual(
    visibleRows(load, new Set(), 'ok').map((row) => row.label),
    ['$', 'nested', 'ok'],
  );
});

test('filters worker rows flat and returns nothing for invalid data', () => {
  const workerLoad = loadFromWorkerResponse('json', {
    ok: true,
    rows: [
      { id: '$', depth: 0, label: '$', valueKind: 'object', preview: '2 keys', hasChildren: true, childCount: 2, path: [] },
      { id: '$.alpha', depth: 1, label: 'alpha', valueKind: 'string', preview: 'one', hasChildren: false, childCount: 0, path: ['alpha'] },
      { id: '$.beta', depth: 1, label: 'beta', valueKind: 'string', preview: 'two', hasChildren: false, childCount: 0, path: ['beta'] },
    ],
    stats: null,
    error: null,
  });

  assert.equal(visibleRows(workerLoad, new Set(), '').length, 3);
  assert.deepEqual(
    visibleRows(workerLoad, new Set(), 'beta').map((row) => row.label),
    ['beta'],
  );

  const invalid = loadDataInline('{', 'json');
  assert.deepEqual(visibleRows(invalid, new Set(), ''), []);
});
