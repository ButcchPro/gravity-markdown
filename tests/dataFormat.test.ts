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
