import { test } from 'node:test';
import assert from 'node:assert/strict';
import { html } from './dom-env.ts';

import { applyTablePasteExtensions, htmlTableToPipeTable } from '../src/editor/tablePaste.ts';
import { OVERSCAN, ROW_HEIGHT, virtualWindow } from '../src/utils/virtualWindow.ts';
import { Schema } from 'prosemirror-model';

// ── virtual window math (JSON tree) ────────────────────────────────────────

test('virtualWindow covers the viewport plus overscan', () => {
  const { start, end } = virtualWindow(5000, 0, 220);
  assert.equal(start, 0);
  // 220 px / 22 px = 10 rows visible, plus overscan below.
  assert.equal(end, 10 + OVERSCAN);
});

test('virtualWindow shifts with the scroll offset', () => {
  const { start, end } = virtualWindow(5000, 2200, 220);
  assert.equal(start, 100 - OVERSCAN);
  assert.equal(end, 110 + OVERSCAN);
});

test('virtualWindow clamps to the row count and never inverts', () => {
  const atEnd = virtualWindow(30, 660, 220);
  assert.equal(atEnd.end, 30);
  assert.ok(atEnd.start <= atEnd.end);

  const empty = virtualWindow(0, 0, 220);
  assert.deepEqual(empty, { start: 0, end: 0 });
});

test('row height is the documented 22 px', () => {
  assert.equal(ROW_HEIGHT, 22);
});

// ── table paste extension ──────────────────────────────────────────────────

interface CapturedPlugin {
  props?: {
    handlePaste?: (
      view: unknown,
      event: { clipboardData: { getData: (type: string) => string } | null },
    ) => boolean;
  };
}

interface CapturedBuilder {
  addPlugin: (callback: (deps: unknown) => CapturedPlugin) => CapturedBuilder;
  overrideNodeSpec: (
    name: string,
    callback: (spec: Record<string, unknown>) => Record<string, unknown>,
  ) => CapturedBuilder;
}

function captureExtension() {
  const plugins: Array<(deps: unknown) => CapturedPlugin> = [];
  const overrides: Record<
    string,
    (spec: Record<string, unknown>) => Record<string, unknown>
  > = {};

  const builder: CapturedBuilder = {
    addPlugin: (callback) => {
      plugins.push(callback);
      return builder;
    },
    overrideNodeSpec: (name, callback) => {
      overrides[name] = callback;
      return builder;
    },
  };

  applyTablePasteExtensions(builder as unknown as Parameters<typeof applyTablePasteExtensions>[0]);
  return { plugins, overrides };
}

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*', toDOM: () => ['p', 0] },
    text: { group: 'inline' },
  },
});

function fakeView(dispatched: unknown[]) {
  return {
    state: {
      tr: {
        replaceSelection: () => ({ replaced: true }),
      },
    },
    dispatch: (tr: unknown) => dispatched.push(tr),
  };
}

function deps(parse: (markdown: string) => unknown) {
  return { markupParser: { parse } };
}

test('table paste intercepts HTML tables and inserts markdown', () => {
  const { plugins } = captureExtension();
  const parsed: string[] = [];
  const plugin = plugins[0](
    deps((markdown) => {
      parsed.push(markdown);
      return schema.node('doc', null, [schema.node('paragraph')]);
    }),
  );

  const dispatched: unknown[] = [];
  const handled = plugin.props?.handlePaste?.(fakeView(dispatched), {
    clipboardData: {
      getData: (type) =>
        type === 'text/html' ? '<table><tr><td>a</td><td>b</td></tr></table>' : '',
    },
  });

  assert.equal(handled, true);
  assert.equal(parsed.length, 1);
  assert.match(parsed[0], /\| a \| b \|/);
  assert.equal(dispatched.length, 1);
});

test('table paste ignores missing clipboard data and non-table content', () => {
  const { plugins } = captureExtension();
  const plugin = plugins[0](deps(() => schema.node('doc', null, [schema.node('paragraph')])));

  assert.equal(plugin.props?.handlePaste?.(fakeView([]), { clipboardData: null }), false);
  assert.equal(
    plugin.props?.handlePaste?.(fakeView([]), { clipboardData: { getData: () => 'just text' } }),
    false,
  );
});

test('table paste falls back when markdown parsing throws', () => {
  const { plugins } = captureExtension();
  const originalError = console.error;
  console.error = () => {};
  try {
    const plugin = plugins[0](
      deps(() => {
        throw new Error('parser exploded');
      }),
    );

    const handled = plugin.props?.handlePaste?.(fakeView([]), {
      clipboardData: { getData: () => '<table><tr><td>x</td></tr></table>' },
    });
    assert.equal(handled, false);
  } finally {
    console.error = originalError;
  }
});

test('table cell parse rules read alignment from attributes and styles', () => {
  const { overrides } = captureExtension();
  assert.ok(overrides.th && overrides.td);

  const spec = overrides.td({ parseDOM: [{ tag: 'td' }] });
  const parseDOM = spec.parseDOM as Array<{ getAttrs: (dom: unknown) => Record<string, unknown> }>;

  const cell = (markup: string) =>
    html(`<table><tbody><tr>${markup}</tr></tbody></table>`).querySelector('td') as HTMLElement;

  const plain = cell('<td>cell</td>');
  assert.deepEqual(parseDOM[0].getAttrs(plain), { 'cell-align': 'left' });

  const centered = cell('<td align="center">cell</td>');
  assert.deepEqual(parseDOM[0].getAttrs(centered), { 'cell-align': 'center' });

  const right = cell('<td style="text-align: right">cell</td>');
  assert.deepEqual(parseDOM[0].getAttrs(right), { 'cell-align': 'right' });

  const attribute = cell('<td cell-align="right">cell</td>');
  assert.deepEqual(parseDOM[0].getAttrs(attribute), { 'cell-align': 'right' });
});

test('htmlTableToPipeTable stays exported for the paste rule', () => {
  const table = html('<table><tr><td>a</td></tr></table>')
    .firstElementChild as unknown as HTMLTableElement;
  assert.equal(htmlTableToPipeTable(table), '\n| a |\n| --- |\n');
});
