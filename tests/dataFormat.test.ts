import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectFileKind, isDataKind, fileKindLabel } from '../src/types/fileKind.ts';

test('detects markdown kinds', () => {
  assert.equal(detectFileKind('/docs/notes.md'), 'markdown');
  assert.equal(detectFileKind('C:\\docs\\notes.MARKDOWN'), 'markdown');
  assert.equal(detectFileKind('/docs/plain.txt'), 'markdown');
});

test('detects data kinds case-insensitively', () => {
  assert.equal(detectFileKind('/api/response.json'), 'json');
  assert.equal(detectFileKind('C:\\conf\\settings.JSONC'), 'jsonc');
  assert.equal(detectFileKind('/conf/app.yaml'), 'yaml');
  assert.equal(detectFileKind('/conf/app.yml'), 'yaml');
  assert.equal(detectFileKind('/conf/app.toml'), 'toml');
});

test('unknown extensions are not viewable', () => {
  assert.equal(detectFileKind('/docs/archive.zip'), null);
  assert.equal(detectFileKind('/docs/no-extension'), null);
});

test('markdown is not a data kind; labels are human', () => {
  assert.equal(isDataKind('markdown'), false);
  assert.equal(isDataKind('json'), true);
  assert.equal(fileKindLabel('json'), 'JSON');
  assert.equal(fileKindLabel('jsonc'), 'JSONC');
});

import { parseDataText, collectStats, buildTreeRows, pathToJsonPath } from '../src/utils/dataFormat.ts';

test('parses valid JSON and rejects strict-JSON comments', () => {
  const ok = parseDataText('{"a": 1}', 'json');
  assert.equal(ok.ok, true);
  const withComment = parseDataText('{\n  // note\n  "a": 1\n}', 'json');
  assert.equal(withComment.ok, false);
  if (!withComment.ok) assert.equal(withComment.error.line, 2);
});

test('parses JSONC comments and reports line/column on errors', () => {
  const ok = parseDataText('{\n  // note\n  "a": 1,\n}', 'jsonc');
  assert.equal(ok.ok, true);
  const bad = parseDataText('{\n  "a": 1,\n  "b" 2\n}', 'jsonc');
  assert.equal(bad.ok, false);
  if (!bad.ok) {
    assert.equal(bad.error.line, 3);
    assert.ok(bad.error.column > 3);
    assert.ok(bad.error.message.length > 0);
  }
});

test('collects stats for nested values', () => {
  const value = { a: [1, 2, { b: 'x' }], c: true, d: null };
  const stats = collectStats(value, 120);
  assert.equal(stats.objects, 2);
  assert.equal(stats.arrays, 1);
  assert.equal(stats.leaves, 5);
  assert.equal(stats.bytes, 120);
  assert.equal(stats.depth, 4);
});

test('builds flat rows with collapse and search filter', () => {
  const value = { name: 'demo', items: [1, 2], nested: { ok: true } };
  const all = buildTreeRows(value, new Set(), '');
  assert.deepEqual(all.map((r) => r.label), ['$', 'name', 'items', '0', '1', 'nested', 'ok']);
  const collapsed = buildTreeRows(value, new Set(['$.items']), '');
  assert.deepEqual(collapsed.map((r) => r.label), ['$', 'name', 'items', 'nested', 'ok']);
  const filtered = buildTreeRows(value, new Set(), 'ok');
  assert.deepEqual(filtered.map((r) => r.label), ['$', 'nested', 'ok']);
});

test('formats JSON paths for copying', () => {
  assert.equal(pathToJsonPath([]), '$');
  assert.equal(pathToJsonPath(['items', 0, 'name']), '$.items[0].name');
  assert.equal(pathToJsonPath(['weird key']), '$["weird key"]');
  assert.equal(pathToJsonPath([0]), '$[0]');
});

import { parseYamlText, parseTomlText } from '../src/utils/dataFormat.ts';

test('parses YAML into plain objects', () => {
  const ok = parseYamlText('name: demo\nitems:\n  - 1\n  - 2\n');
  assert.equal(ok.ok, true);
  if (ok.ok) assert.deepEqual(ok.value, { name: 'demo', items: [1, 2] });
  const bad = parseYamlText('name: [unclosed');
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.ok(bad.error.line >= 1);
});

test('parses TOML into plain objects', () => {
  const ok = parseTomlText('[app]\nname = "demo"\nport = 8080\n');
  assert.equal(ok.ok, true);
  // smol-toml returns null-prototype objects, so compare serialised shape.\n  if (ok.ok) assert.equal(JSON.stringify(ok.value), JSON.stringify({ app: { name: 'demo', port: 8080 } }));
  const bad = parseTomlText('name = ');
  assert.equal(bad.ok, false);
});
