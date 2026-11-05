# JSON-Hybrid Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make GravityMD able to open JSON-like files (JSON, JSONC; later JSON5/YAML/TOML) in a read-only hybrid viewer — a syntax-highlighted text mode and a collapsible tree mode — without changing how Markdown documents are edited or saved.

**Architecture:** A file-kind layer detects the opened format (`markdown` vs data kinds) and splits the app into two rendering paths: Markdown keeps the Gravity editor untouched; data kinds render a new `DataViewer` (CodeMirror 6 read-only text view + custom virtualized tree), with parsing off the main thread through a Web Worker. Data files are read-only end to end: the Rust write whitelist stays Markdown-only, and the UI disables Save/Save As/Office actions for them.

**Tech Stack:** Tauri 2 (Rust IPC whitelist), React 19 + TypeScript 6, CodeMirror 6 (`@codemirror/state`, `view`, `language`, `search`, `lang-json`), `jsonc-parser` for tolerant JSON/JSONC parsing, `yaml` + `smol-toml` in Phase 2, Web Workers, Node type-stripping tests.

---

## Scope Check

One subsystem (data-file viewing) with two independently shippable halves:

- **Phase 1 (MVP, ships 1.1.0):** JSON + JSONC, text mode, tree mode, read-only, worker parsing for large files.
- **Phase 2 (shipped together with 1.1.0):** JSON5, YAML, TOML — new parsers and language support behind the same interfaces.

Both phases are planned here; each task leaves the app buildable and testable.

## File Structure

**Create**

- `src/types/fileKind.ts` — kind detection, extension tables, labels. Single source of truth for "is this a document or data file".
- `src/utils/dataFormat.ts` — pure parse/stats/tree-row builders for data kinds (no React, no DOM). Unit-tested.
- `src/components/DataViewer.tsx` — hybrid shell: mode toggle (Tree/Text), parse orchestration, error banner, filter, copy actions.
- `src/components/DataTextView.tsx` — CodeMirror 6 read-only text view (JSON language, folding, search).
- `src/components/DataTreeView.tsx` — virtualized tree rows with collapse, keyboard nav, copy path/value.
- `src/workers/dataParse.worker.ts` — parse + build tree rows off the main thread.
- `tests/dataFormat.test.ts` — parser/stats/tree tests (`node --experimental-strip-types`).

**Modify**

- `src/utils/path.ts` — add `VIEWABLE_EXTENSIONS` / `isViewableFile`; keep `SUPPORTED_EXTENSIONS` Markdown-only.
- `src/hooks/useFileOperations.ts` — track `fileKind`; open dialog accepts data files; saving blocked for data kinds.
- `src/App.tsx` — conditional rendering (editor vs `DataViewer`), status-bar data mode, toolbar data mode, no word count for data.
- `src/components/Toolbar.tsx` — `dataMode` prop: hide Import/Export/zoom, disable Save/Save As.
- `src/components/StatusBar.tsx` — optional `dataMeta` replacing `N words · mode`.
- `src/App.scss` — viewer styles (tree rows, text view, banner, empty/error states).
- `src-tauri/src/lib.rs` — read whitelist gains data extensions; write whitelist unchanged.
- `package.json` — deps + test scripts.
- `PRODUCT.md`, `DESIGN.md`, `README.md`, `history.md` — positioning and docs.

**Do not touch:** the Markdown save pipeline (`sanitizeYfmTables`, DOCX/XLSX import/export) except for gating in the UI.

---

### Task 1: Positioning and documentation skeleton

**Files:**
- Modify: `PRODUCT.md` (Users, Positioning, Capabilities, Product Principles)
- Modify: `DESIGN.md` (new "Data Viewer" component section)
- Modify: `README.md` (features stub, no download changes yet)
- Modify: `history.md` (Phase 42 entry)

- [ ] **Step 1: Update `PRODUCT.md` — Users**

Replace the Users paragraph with:

```markdown
Technical writers, engineers and documentation-adjacent specialists on Windows/macOS who keep plain `.md` files on disk and treat Markdown as the durable source format. They also inspect the data that surrounds their docs — API responses, config files, exported JSON dumps — and today must leave the editor (or paste the JSON into a fenced code block) to read it.

Job to be done: open a local markdown file, edit it without fighting the markup, hand it to the rest of the company as a Word document — and, without switching apps, *read* machine data (JSON/JSONC, later YAML/TOML) next to that work. The editor never writes data files.
```

- [ ] **Step 2: Update `PRODUCT.md` — Positioning**

Append after the existing positioning paragraph:

```markdown
The product also reads machine data without mutating it: JSON-like files open in a read-only hybrid viewer (syntax-highlighted text and a collapsible tree) with the same local-first guarantees as documents — no upload, no account, no reformatting of the file on disk. Read-only is a commitment, not a limitation: the app never writes `.json`/`.yaml`/`.toml`.
```

- [ ] **Step 3: Update `PRODUCT.md` — Capabilities and Constraints**

Append inside "Capabilities and Constraints":

```markdown
- Data viewing (read-only): `.json`, `.jsonc` (Phase 1); `.json5`, `.yaml`, `.yml`, `.toml` (Phase 2). Parsed locally, displayed as text or tree, never written back. File associations for data formats are deliberately **not** registered.
```

- [ ] **Step 4: Update `PRODUCT.md` — Product Principles**

Add a sixth principle after the existing five:

```markdown
6. **Inspect, don't mutate.** Data files open read-only. The viewer may format a value for reading, but the bytes on disk and the document model stay untouched — no accidental rewrites, no silent normalisation.
```

- [ ] **Step 5: Update `DESIGN.md` — Components**

Append a new component section before "## Do's and Don'ts":

```markdown
### Data Viewer
- **Shell:** second surface under the same chrome; no new toolbar row — a 36 px sub-header inside the content area holds a `Tree / Text` segmented control, a filter field and the file's validity state.
- **Text mode:** monospace 13 px / 1.5, line numbers and fold gutter on the `--g-color-base-background` surface, syntax colours from the theme palette; read-only.
- **Tree mode:** 22 px rows, 12 px indent steps, chevron for collapsible nodes, values in secondary ink, key names in primary; invalid JSON shows a banner above the rows, never a blank screen.
- **Error banner:** `--g-color-base-danger-light` surface, `--g-color-text-danger-heavy` text, exact `line:column` plus the parser message.
- **Never:** an edit affordance for data files. No Save, no Save As, no Office buttons in this mode.
```

- [ ] **Step 6: Update `README.md` — Features stub**

Insert after the "📊 Tables Done Right" block:

```markdown
### 🔍 Data Files (read-only)

*   **JSON / JSONC viewer**: open `*.json` and `*.jsonc` files without leaving the app. Switch between a syntax-highlighted text view (folding, line numbers) and a collapsible tree; invalid files show the exact line and column instead of a blank view.
*   **Read-only by design**: the viewer never writes data files and the app does not register itself as a handler for `.json` — it is an inspector, not a second editor.
```

- [ ] **Step 7: Commit**

```bash
git add PRODUCT.md DESIGN.md README.md history.md
git commit -m "docs: position the read-only data viewer"
```

---

### Task 2: File-kind module + tests

**Files:**
- Create: `src/types/fileKind.ts`
- Modify: `src/utils/path.ts`
- Create: `tests/dataFormat.test.ts` (first tests only)
- Modify: `package.json` (test script)

- [ ] **Step 1: Write the failing test**

Create `tests/dataFormat.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --experimental-strip-types --test tests/dataFormat.test.ts`
Expected: FAIL — `Cannot find module '../src/types/fileKind.ts'`.

- [ ] **Step 3: Create `src/types/fileKind.ts`**

```ts
/** File kinds the app can open. Only `markdown` is editable. */
export type FileKind = 'markdown' | 'json' | 'jsonc' | 'json5' | 'yaml' | 'toml';

/** Data kinds are rendered by the read-only viewer. */
export type DataKind = Exclude<FileKind, 'markdown'>;

export const MARKDOWN_EXTENSIONS = ['md', 'markdown', 'txt'] as const;

export const DATA_EXTENSIONS = ['json', 'jsonc', 'json5', 'yaml', 'yml', 'toml'] as const;

/** All extensions the Open dialog may show, in display order. */
export const VIEWABLE_EXTENSIONS = [...MARKDOWN_EXTENSIONS, ...DATA_EXTENSIONS] as const;

const EXTENSION_TO_KIND: Record<string, FileKind> = {
  md: 'markdown',
  markdown: 'markdown',
  txt: 'markdown',
  json: 'json',
  jsonc: 'jsonc',
  json5: 'json5',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
};

const KIND_LABEL: Record<FileKind, string> = {
  markdown: 'Markdown',
  json: 'JSON',
  jsonc: 'JSONC',
  json5: 'JSON5',
  yaml: 'YAML',
  toml: 'TOML',
};

/** Returns the kind for a file path, or null when the extension is unknown. */
export function detectFileKind(path: string): FileKind | null {
  const name = path.split(/[\\/]/).pop() ?? path;
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return null;
  const ext = name.slice(dot + 1).toLowerCase();
  return EXTENSION_TO_KIND[ext] ?? null;
}

export function isDataKind(kind: FileKind): kind is DataKind {
  return kind !== 'markdown';
}

export function fileKindLabel(kind: FileKind): string {
  return KIND_LABEL[kind];
}
```

- [ ] **Step 4: Update `src/utils/path.ts`**

Replace the file content with:

```ts
import { MARKDOWN_EXTENSIONS, VIEWABLE_EXTENSIONS } from '../types/fileKind';

/** Markdown documents (editable). Kept for the existing save/import paths. */
export const SUPPORTED_EXTENSIONS = MARKDOWN_EXTENSIONS;

export function getFileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export function isSupportedFile(path: string): boolean {
  const lower = path.toLowerCase();
  return MARKDOWN_EXTENSIONS.some((ext) => lower.endsWith(`.${ext}`));
}

/** Markdown documents plus read-only data files. */
export function isViewableFile(path: string): boolean {
  const lower = path.toLowerCase();
  return VIEWABLE_EXTENSIONS.some((ext) => lower.endsWith(`.${ext}`));
}
```

- [ ] **Step 5: Add the test script to `package.json`**

In `"scripts"`, after `"test:utils"`:

```json
    "test:data": "node --experimental-strip-types --test tests/dataFormat.test.ts",
    "test": "npm run test:utils && npm run test:data",
```

- [ ] **Step 6: Run tests**

Run: `npm run test:data`
Expected: PASS — 4 tests, 0 failed.

- [ ] **Step 7: Commit**

```bash
git add src/types/fileKind.ts src/utils/path.ts tests/dataFormat.test.ts package.json
git commit -m "feat(files): detect markdown vs data file kinds"
```

---

### Task 3: Parse, stats and tree-row builders

**Files:**
- Modify: `tests/dataFormat.test.ts`
- Create: `src/utils/dataFormat.ts`
- Modify: `package.json` (dependency `jsonc-parser`)

- [ ] **Step 1: Install the parser**

Run: `npm install jsonc-parser@^3.3.1 --legacy-peer-deps`
Expected: `added 1 package`.

- [ ] **Step 2: Write the failing tests (append to `tests/dataFormat.test.ts`)**

```ts
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
  assert.equal(stats.objects, 2); // root + { b: 'x' }
  assert.equal(stats.arrays, 1);
  assert.equal(stats.leaves, 5); // 1, 2, 'x', true, null
  assert.equal(stats.bytes, 120);
  assert.equal(stats.depth, 4); // root → array → object → leaf
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
```

- [ ] **Step 3: Run tests to see them fail**

Run: `npm run test:data`
Expected: FAIL — `Cannot find module '../src/utils/dataFormat.ts'`.

- [ ] **Step 4: Create `src/utils/dataFormat.ts`**

```ts
import { parse, printParseErrorCode, type ParseError } from 'jsonc-parser';
import type { DataKind } from '../types/fileKind';

export interface DataParseFailure {
  message: string;
  line: number;
  column: number;
}

export type DataParseResult =
  | { ok: true; value: unknown }
  | { ok: false; error: DataParseFailure };

function offsetToLineColumn(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, Math.max(0, Math.min(offset, text.length)));
  const lines = before.split('\n');
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

function toFailure(text: string, error: ParseError): DataParseFailure {
  const { line, column } = offsetToLineColumn(text, error.offset);
  return { message: printParseErrorCode(error.error), line, column };
}

/** Parses JSON-like text. Comments/trailing commas are allowed for jsonc/json5. */
export function parseDataText(text: string, kind: DataKind): DataParseResult {
  const tolerant = kind !== 'json';
  const errors: ParseError[] = [];
  const value = parse(text, errors, {
    allowTrailingComma: tolerant,
    disallowComments: !tolerant,
  });
  if (errors.length > 0) {
    return { ok: false, error: toFailure(text, errors[0]) };
  }
  return { ok: true, value };
}

export interface DataStats {
  bytes: number;
  objects: number;
  arrays: number;
  /** Scalar leaves (strings, numbers, booleans, nulls). */
  leaves: number;
  depth: number;
}

export function collectStats(value: unknown, bytes: number): DataStats {
  const stats: DataStats = { bytes, objects: 0, arrays: 0, leaves: 0, depth: 0 };
  const walk = (node: unknown, depth: number): void => {
    stats.depth = Math.max(stats.depth, depth);
    if (node === null || typeof node !== 'object') {
      stats.leaves += 1;
      return;
    }
    if (Array.isArray(node)) {
      stats.arrays += 1;
      node.forEach((child) => walk(child, depth + 1));
      return;
    }
    stats.objects += 1;
    Object.values(node as Record<string, unknown>).forEach((child) => walk(child, depth + 1));
  };
  walk(value, 1);
  return stats;
}

export type TreeValueKind = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

export interface TreeRow {
  /** Stable id: JSON path of the row. */
  id: string;
  depth: number;
  label: string;
  valueKind: TreeValueKind;
  /** Preview for scalars ("demo", "1", "true") or a count for containers ("3 items"). */
  preview: string;
  hasChildren: boolean;
  childCount: number;
  path: Array<string | number>;
}

function kindOf(value: unknown): TreeValueKind {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return typeof value as 'string' | 'number' | 'boolean';
}

function previewOf(value: unknown, kind: TreeValueKind): string {
  if (kind === 'array') return `${(value as unknown[]).length} items`;
  if (kind === 'object') return `${Object.keys(value as object).length} keys`;
  return typeof value === 'string' ? value : String(value);
}

/**
 * Flattens a parsed value into visible rows. A collapsed container hides its
 * subtree; a non-empty filter keeps rows whose label or preview matches and
 * forces the ancestor chain open.
 */
export function buildTreeRows(
  value: unknown,
  collapsed: ReadonlySet<string>,
  filter: string,
): TreeRow[] {
  const query = filter.trim().toLowerCase();
  const rows: TreeRow[] = [];

  const matches = (label: string, preview: string): boolean =>
    query === '' || label.toLowerCase().includes(query) || preview.toLowerCase().includes(query);

  const walk = (node: unknown, label: string, path: Array<string | number>): boolean => {
    const id = pathToJsonPath(path);
    const valueKind = kindOf(node);
    const children =
      valueKind === 'array'
        ? (node as unknown[]).map((child, index) => [String(index), child, [...path, index]] as const)
        : valueKind === 'object'
          ? Object.entries(node as Record<string, unknown>).map(
              ([key, child]) => [key, child, [...path, key]] as const,
            )
          : [];
    const nextPreview = previewOf(node, valueKind);
    const selfMatches = matches(label, nextPreview);
    const isCollapsed = collapsed.has(id) && query === '';

    const row: TreeRow = {
      id,
      depth: path.length,
      label,
      valueKind,
      preview: nextPreview,
      hasChildren: children.length > 0,
      childCount: children.length,
      path,
    };

    if (isCollapsed) {
      rows.push(row);
      return selfMatches;
    }

    const index = rows.length;
    rows.push(row);
    let anyChildVisible = false;
    for (const [childLabel, childValue, childPath] of children) {
      if (walk(childValue, childLabel, childPath)) anyChildVisible = true;
    }

    const visible =
      query === '' ? true : selfMatches || anyChildVisible;
    if (!visible) {
      rows.splice(index, rows.length - index);
      return false;
    }
    return visible;
  };

  walk(value, '$', []);
  return rows;
}

export function pathToJsonPath(path: Array<string | number>): string {
  return path.reduce<string>((acc, segment) => {
    if (typeof segment === 'number') return `${acc}[${segment}]`;
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(segment) ? `${acc}.${segment}` : `${acc}["${segment}"]`;
  }, '$');
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:data`
Expected: PASS — 9 tests (the stats test asserts `leaves` and `depth` exactly as written in Step 2).

- [ ] **Step 6: Commit**

```bash
git add src/utils/dataFormat.ts tests/dataFormat.test.ts package.json package-lock.json
git commit -m "feat(data): parse JSON/JSONC into stats and tree rows"
```

---

### Task 4: Rust read whitelist (write stays Markdown-only)

**Files:**
- Modify: `src-tauri/src/lib.rs:39-46`
- Modify: `src-tauri/Cargo.toml` (no change expected; verify)

- [ ] **Step 1: Update `is_text_extension`**

Replace the function body:

```rust
/// Read whitelist: documents plus read-only data formats.
fn is_text_extension(path: &PathBuf) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| {
            matches!(
                ext.to_lowercase().as_str(),
                "md" | "txt" | "markdown" | "json" | "jsonc" | "json5" | "yaml" | "yml" | "toml"
            )
        })
        .unwrap_or(false)
}
```

- [ ] **Step 2: Keep writes Markdown-only and make the rejection explicit**

`is_writable_extension` must stay exactly as it is (md/txt/markdown for text, docx for binary). Add one line above it documenting the asymmetry:

```rust
/// Write whitelist stays Markdown-only on purpose: data files are read-only
/// in the app, so the IPC layer must refuse to persist them even if the UI
/// ever regresses.
```

- [ ] **Step 3: Update the write rejection message**

In `write_file_content`, change the error text to:

```rust
return Err(AppError::new("FS_UNSUPPORTED_EXTENSION", "Writable types: md, txt, markdown"));
```

- [ ] **Step 4: Build**

Run: `npx tauri build --no-bundle`
Expected: exit 0, `Built application at: ...gravitymd.exe`.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat(ipc): allow reading data files, keep writes markdown-only"
```

---

### Task 5: File operations know the kind and refuse to save data

**Files:**
- Modify: `src/hooks/useFileOperations.ts`
- Modify: `src/utils/path.ts` (imports only)
- Test: `tests/dataFormat.test.ts` (add a pure helper test if extracted)

- [ ] **Step 1: Track `fileKind` and expose it**

In `useFileOperations.ts`:

```ts
import { detectFileKind, isDataKind, type FileKind } from '../types/fileKind';
import { getFileName, isViewableFile, SUPPORTED_EXTENSIONS } from '../utils/path';

const [fileKind, setFileKind] = useState<FileKind>('markdown');

const loadContent = useCallback(
  (newContent: string, newFile: string | null = null, showToast = false) => {
    const kind = newFile ? detectFileKind(newFile) ?? 'markdown' : 'markdown';
    setCurrentFile(newFile);
    setFileKind(kind);
    setContent(newContent);
    setCurrentValue(newContent);
    setFileKey(prev => prev + 1);
    if (showToast && newFile) {
      notify(`Opened: ${getFileName(newFile)}`, 'success');
    }
  },
  [],
);
```

- [ ] **Step 2: Accept data files in both open paths**

In `handleOpenFile` replace the guard:

```ts
if (!isViewableFile(path)) {
  notify("This file type can't be opened here — choose .md, .json, .yaml or another supported file", 'danger');
  return;
}
```

In `handleOpen` replace the filters:

```ts
filters: [
  { name: 'Markdown & data files', extensions: [...VIEWABLE_EXTENSIONS] },
  { name: 'Markdown', extensions: [...SUPPORTED_EXTENSIONS] },
  { name: 'Data files', extensions: ['json', 'jsonc', 'json5', 'yaml', 'yml', 'toml'] },
],
```

with `import { VIEWABLE_EXTENSIONS } from '../types/fileKind';`.

- [ ] **Step 3: Block saving data files**

At the top of `persist`:

```ts
if (isDataKind(fileKind)) {
  notify('Data files are read-only here — open the file in an editor to change it', 'warning');
  return false;
}
```
and add `fileKind` to the `useCallback` dependency array. Do the same guard in `handleSaveAs` before calling `persist`.

- [ ] **Step 4: Return the kind**

Add `fileKind` to the returned object (after `fileKey`).

- [ ] **Step 5: Verify TypeScript**

Run: `npx tsc -b --pretty false`
Expected: no errors (App.tsx does not consume `fileKind` yet — that is Task 8).

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useFileOperations.ts
git commit -m "feat(files): carry file kind, refuse writes for data files"
```

---

### Task 6: Read-only CodeMirror text view

**Files:**
- Create: `src/components/DataTextView.tsx`
- Modify: `package.json` (+`@codemirror/lang-json`, `@codemirror/search`)
- Modify: `src/App.scss`

- [ ] **Step 1: Install direct CodeMirror deps**

Run:

```bash
npm install @codemirror/state@^6.6.0 @codemirror/view@^6.43.1 @codemirror/language@^6.12.3 @codemirror/commands@^6.10.3 @codemirror/search@^6.5.0 @codemirror/lang-json@^6.0.2 --legacy-peer-deps
```

Expected: added packages report.

- [ ] **Step 2: Create `src/components/DataTextView.tsx`**

```tsx
import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers, keymap, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, foldGutter, foldKeymap } from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { json } from '@codemirror/lang-json';

const theme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'transparent', color: 'var(--g-color-text-primary)', fontSize: '13px' },
  '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', lineHeight: '1.5' },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'var(--g-color-text-hint)',
    border: 'none',
    borderRight: '1px solid var(--g-color-line-generic)',
  },
  '.cm-activeLine': { backgroundColor: 'transparent' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--g-color-text-primary)' },
  '.cm-selectionBackground, ::selection': { backgroundColor: 'var(--g-color-base-selection) !important' },
  '.cm-content': { caretColor: 'transparent' },
});

interface DataTextViewProps {
  text: string;
}

/** Read-only JSON/JSONC text with folding, line numbers and search. */
export function DataTextView({ text }: DataTextViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: text,
        extensions: [
          lineNumbers(),
          foldGutter(),
          highlightActiveLine(),
          json(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          highlightSelectionMatches(),
          EditorState.readOnly.of(true),
          keymap.of([...defaultKeymap, ...foldKeymap, ...searchKeymap]),
          theme,
        ],
      }),
    });
    return () => view.destroy();
  }, [text]);

  return <div className="data-text" ref={hostRef} aria-label="Data file content (read-only)" />;
}
```

- [ ] **Step 3: Add styles to `src/App.scss`**

```scss
.data-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background-color: var(--g-color-base-background);
}

.data-viewer__bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  border-bottom: 1px solid var(--g-color-line-generic);
  background-color: var(--g-color-base-generic);
}

.data-viewer__body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.data-text {
  height: 100%;
  overflow: auto;
}

.data-text .cm-editor {
  height: 100%;
  background: transparent;
}
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: exit 0 (component unused so far; TypeScript still checks it).

- [ ] **Step 5: Commit**

```bash
git add src/components/DataTextView.tsx src/App.scss package.json package-lock.json
git commit -m "feat(viewer): read-only CodeMirror text view for data files"
```

---

### Task 7: Worker parsing + tree view shell

**Files:**
- Create: `src/workers/dataParse.worker.ts`
- Create: `src/components/DataTreeView.tsx`
- Create: `src/components/DataViewer.tsx`
- Modify: `src/App.scss`

- [ ] **Step 1: Create the worker**

```ts
/// Parses data files off the main thread and returns rows + stats.
import { parseDataText, collectStats, buildTreeRows, type TreeRow, type DataStats } from '../utils/dataFormat.ts';
import type { DataKind } from '../types/fileKind';

interface DataParseRequest {
  text: string;
  kind: DataKind;
}

export interface DataParseResponse {
  ok: boolean;
  rows: TreeRow[];
  stats: DataStats | null;
  error: { message: string; line: number; column: number } | null;
}

self.onmessage = (event: MessageEvent<DataParseRequest>) => {
  const { text, kind } = event.data;
  const parsed = parseDataText(text, kind);
  if (!parsed.ok) {
    const response: DataParseResponse = { ok: false, rows: [], stats: null, error: parsed.error };
    self.postMessage(response);
    return;
  }
  const response: DataParseResponse = {
    ok: true,
    rows: buildTreeRows(parsed.value, new Set(), ''),
    stats: collectStats(parsed.value, new TextEncoder().encode(text).length),
    error: null,
  };
  self.postMessage(response);
};
```

- [ ] **Step 2: Create `src/components/DataTreeView.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import type { TreeRow } from '../utils/dataFormat';
import { pathToJsonPath } from '../utils/dataFormat';

const ROW_HEIGHT = 22;
const OVERSCAN = 8;

interface DataTreeViewProps {
  rows: TreeRow[];
  collapsed: ReadonlySet<string>;
  onToggle: (id: string) => void;
}

export function DataTreeView({ rows, collapsed, onToggle }: DataTreeViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(320);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(() => setHeight(host.clientHeight));
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const end = Math.min(rows.length, Math.ceil((scrollTop + height) / ROW_HEIGHT) + OVERSCAN);
  const visible = rows.slice(start, end);

  const copy = (row: TreeRow) => {
    void navigator.clipboard.writeText(pathToJsonPath(row.path));
  };

  return (
    <div className="data-tree" ref={hostRef} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}>
      <div className="data-tree__spacer" style={{ height: rows.length * ROW_HEIGHT, position: 'relative' }}>
        {visible.map((row, index) => (
          <div
            key={row.id}
            className={`data-tree__row data-tree__row--${row.valueKind}`}
            style={{ top: (start + index) * ROW_HEIGHT, paddingLeft: 8 + row.depth * 12 }}
            onDoubleClick={() => copy(row)}
            title="Double-click to copy JSON path"
          >
            {row.hasChildren ? (
              <button
                type="button"
                className="data-tree__chevron"
                aria-label={collapsed.has(row.id) ? `Expand ${row.label}` : `Collapse ${row.label}`}
                onClick={() => onToggle(row.id)}
              >
                {collapsed.has(row.id) ? '▸' : '▾'}
              </button>
            ) : (
              <span className="data-tree__chevron data-tree__chevron--empty" aria-hidden="true" />
            )}
            <span className="data-tree__label">{row.label}</span>
            <span className="data-tree__preview">{row.preview}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/DataViewer.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react';
import { Button, TextInput } from '@gravity-ui/uikit';
import { DataTextView } from './DataTextView';
import { DataTreeView } from './DataTreeView';
import {
  buildTreeRows,
  collectStats,
  parseDataText,
  type DataStats,
  type TreeRow,
} from '../utils/dataFormat';
import type { DataParseResponse } from '../workers/dataParse.worker';
import { fileKindLabel, type DataKind } from '../types/fileKind';
import { runWorker } from '../utils/worker';

export type DataViewMode = 'tree' | 'text';

export interface DataViewerStatus {
  label: string;
  valid: boolean;
  stats: DataStats | null;
  error: { line: number; column: number; message: string } | null;
}

interface DataViewerProps {
  content: string;
  kind: DataKind;
  onStatus: (status: DataViewerStatus) => void;
}

/** Files up to this size parse on the main thread so collapse/search are cheap. */
const PARSE_INLINE_LIMIT = 256 * 1024;

export function DataViewer({ content, kind, onStatus }: DataViewerProps) {
  const [mode, setMode] = useState<DataViewMode>('tree');
  const [parsedValue, setParsedValue] = useState<unknown>(undefined);
  const [workerRows, setWorkerRows] = useState<TreeRow[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [status, setStatus] = useState<DataViewerStatus>({
    label: fileKindLabel(kind),
    valid: true,
    stats: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    const bytes = new TextEncoder().encode(content).length;

    const apply = (next: DataViewerStatus, rows: TreeRow[], value: unknown) => {
      if (cancelled) return;
      setParsedValue(value);
      setWorkerRows(rows);
      setCollapsed(new Set());
      setStatus(next);
      onStatus(next);
    };

    if (bytes <= PARSE_INLINE_LIMIT) {
      const parsed = parseDataText(content, kind);
      if (parsed.ok) {
        apply(
          { label: fileKindLabel(kind), valid: true, stats: collectStats(parsed.value, bytes), error: null },
          buildTreeRows(parsed.value, new Set(), ''),
          parsed.value,
        );
      } else {
        apply({ label: fileKindLabel(kind), valid: false, stats: null, error: parsed.error }, [], undefined);
      }
      return () => {
        cancelled = true;
      };
    }

    const createWorker = () =>
      new Worker(new URL('../workers/dataParse.worker.ts', import.meta.url), { type: 'module' });

    void runWorker<{ text: string; kind: DataKind }, DataParseResponse>(createWorker, {
      text: content,
      kind,
    }).then((response) => {
      apply(
        {
          label: fileKindLabel(kind),
          valid: response.ok,
          stats: response.stats,
          error: response.error,
        },
        response.rows,
        undefined,
      );
    });

    return () => {
      cancelled = true;
    };
  }, [content, kind, onStatus]);

  const visibleRows = useMemo(() => {
    if (!status.valid) return [];
    if (parsedValue !== undefined) return buildTreeRows(parsedValue, collapsed, filter);
    const query = filter.trim().toLowerCase();
    if (query === '') return workerRows;
    return workerRows.filter(
      (row) => row.label.toLowerCase().includes(query) || row.preview.toLowerCase().includes(query),
    );
  }, [status.valid, parsedValue, workerRows, collapsed, filter]);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="data-viewer">
      <div className="data-viewer__bar">
        <Button view={mode === 'tree' ? 'action' : 'flat'} size="s" onClick={() => setMode('tree')}>
          Tree
        </Button>
        <Button view={mode === 'text' ? 'action' : 'flat'} size="s" onClick={() => setMode('text')}>
          Text
        </Button>
        {mode === 'tree' && (
          <TextInput
            size="s"
            placeholder="Filter keys and values…"
            value={filter}
            onUpdate={setFilter}
            className="data-viewer__filter"
          />
        )}
        <span className="data-viewer__state">
          {status.valid ? 'Valid' : `Invalid — line ${status.error?.line}, column ${status.error?.column}`}
        </span>
      </div>
      {!status.valid && status.error && (
        <div className="data-viewer__error" role="alert">
          <strong>{status.error.message}</strong> at line {status.error.line}, column {status.error.column}
        </div>
      )}
      <div className="data-viewer__body">
        {mode === 'tree' ? (
          <DataTreeView rows={visibleRows} collapsed={collapsed} onToggle={toggle} />
        ) : (
          <DataTextView text={content} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify the component compiles**

Run: `npx tsc -b --pretty false`
Expected: no errors. `DataViewer` is not mounted yet (Task 8), but its imports and types are checked.


- [ ] **Step 5: Add the remaining viewer styles**

```scss
.data-tree {
  height: 100%;
  overflow: auto;
  padding: 6px 0;
  font-size: 13px;
}

.data-tree__row {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 22px;
  white-space: nowrap;
}

.data-tree__row:hover {
  background-color: var(--g-color-base-generic);
}

.data-tree__chevron {
  width: 16px;
  border: none;
  background: none;
  color: var(--g-color-text-secondary);
  cursor: pointer;
  padding: 0;
}

.data-tree__chevron--empty {
  display: inline-block;
}

.data-tree__label {
  color: var(--g-color-text-primary);
}

.data-tree__preview {
  color: var(--g-color-text-complementary);
  overflow: hidden;
  text-overflow: ellipsis;
}

.data-viewer__filter {
  width: 220px;
}

.data-viewer__state {
  margin-left: auto;
  font-size: 12px;
  color: var(--g-color-text-complementary);
}

.data-viewer__error {
  padding: 8px 12px;
  background-color: var(--g-color-base-danger-light);
  color: var(--g-color-text-danger-heavy);
  font-size: 13px;
}
```

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: exit 0. `DataViewer` is still unused; TypeScript validates it.

- [ ] **Step 7: Commit**

```bash
git add src/workers/dataParse.worker.ts src/components/DataViewer.tsx src/components/DataTreeView.tsx src/App.scss
git commit -m "feat(viewer): hybrid tree/text viewer with worker parsing"
```

---

### Task 8: App, toolbar and status bar integration

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/components/StatusBar.tsx`

- [ ] **Step 1: `Toolbar` — data mode prop**

Add to `ToolbarProps`:

```ts
  /** True when a read-only data file is open. */
  dataMode: boolean;
```

Destructure `dataMode` and apply:

- Save button: `disabled={dataMode}`, `aria-label={dataMode ? 'Save (read-only data file)' : dirty ? 'Save — unsaved changes' : 'Save'}`.
- Save as button: `disabled={dataMode}`.
- Wrap the Import/Export group and the zoom block in `{!dataMode && ( ... )}`.
- Keep Open, theme and About always visible.

- [ ] **Step 2: `StatusBar` — data meta**

Extend props:

```ts
  /** When set (data file open), replaces "N words · mode". */
  dataMeta?: string;
```

Render:

```tsx
      <Text className="status-meta" as="span">
        {dataMeta ?? `${words.toLocaleString('en-US')} ${words === 1 ? 'word' : 'words'} · ${mode}`}
      </Text>
```

and make `dirty` optional (`dirty?: boolean`) with `dirty = false` default, since data files are never dirty.

- [ ] **Step 3: `App.tsx` — conditional surface**

Imports:

```ts
import { DataViewer, type DataViewerStatus } from './components/DataViewer';
import { isDataKind } from './types/fileKind';
```

State:

```ts
const [dataStatus, setDataStatus] = useState<DataViewerStatus | null>(null);
const onDataStatus = useCallback((s: DataViewerStatus) => setDataStatus(s), []);
```

Derived:

```ts
const dataMode = isDataKind(fileKind);
const wordCount = useMemo(() => (dataMode ? 0 : countWords(currentValue)), [dataMode, currentValue]);
const dataMeta = dataStatus
  ? `${dataStatus.label} · ${dataStatus.valid ? 'valid' : 'invalid'} · ${formatBytes(dataStatus.stats?.bytes ?? currentValue.length)}`
  : undefined;
```

Add a tiny helper at the bottom of `App.tsx`:

```ts
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```

Render:

```tsx
<main className={`editor-container${dataMode ? ' editor-container--data' : ''}`}>
  {dataMode ? (
    <DataViewer key={fileKey} content={content} kind={fileKind} onStatus={onDataStatus} />
  ) : (
    <Suspense fallback={<div className="editor-suspense" />}>
      <EditorWrapper ref={editorRef} key={fileKey} initialContent={content} onSave={setCurrentValue} onModeChange={setEditorMode} />
    </Suspense>
  )}
</main>
```

Toolbar call gains `dataMode={dataMode}`; StatusBar gains `dataMeta={dataMeta}` and `dirty={dataMode ? false : dirty}`.

Also reset `dataStatus` when a document is opened: inside the existing `loadContent` path this arrives through `fileKey`; add

```ts
useEffect(() => {
  if (!dataMode) setDataStatus(null);
}, [dataMode]);
```

- [ ] **Step 4: CSS for the data container**

```scss
.editor-container--data {
  .data-viewer {
    height: 100%;
  }
}
```

- [ ] **Step 5: Build and lint**

Run: `npm run build && npm run lint`
Expected: build exit 0; lint 0 problems.

- [ ] **Step 6: Manual smoke (dev)**

Run: `npx tauri dev`
Steps: Open a `.json` file → tree renders; toggle Text → syntax-highlighted JSON; make the JSON invalid in a temp copy → banner with line/column; Save/Save As disabled; Import/Export/zoom hidden; status bar shows `JSON · valid · N KB`.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/components/Toolbar.tsx src/components/StatusBar.tsx src/App.scss
git commit -m "feat(app): render data files in the read-only viewer"
```

---

### Task 9: Phase 2 formats — JSON5, YAML, TOML

**Files:**
- Modify: `src/utils/dataFormat.ts`
- Modify: `src/components/DataTextView.tsx`
- Modify: `package.json`
- Modify: `tests/dataFormat.test.ts`

- [ ] **Step 1: Install parsers and language support**

```bash
npm install yaml@^2.8.0 smol-toml@^1.3.4 --legacy-peer-deps
```

- [ ] **Step 2: Write failing tests for the new kinds**

Append to `tests/dataFormat.test.ts`:

```ts
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
  if (ok.ok) assert.deepEqual(ok.value, { app: { name: 'demo', port: 8080 } });
  const bad = parseTomlText('name = ');
  assert.equal(bad.ok, false);
});
```

- [ ] **Step 3: Implement the parsers**

Add to `src/utils/dataFormat.ts`:

```ts
import { parse as parseYaml } from 'yaml';
import { parse as parseToml } from 'smol-toml';

export function parseYamlText(text: string): DataParseResult {
  try {
    return { ok: true, value: parseYaml(text) ?? null };
  } catch (e) {
    const err = e as { message?: string; linePos?: Array<{ line: number; col: number }> };
    const pos = err.linePos?.[0];
    return {
      ok: false,
      error: {
        message: err.message ?? 'YAML parse error',
        line: pos?.line ?? 1,
        column: pos?.col ?? 1,
      },
    };
  }
}

export function parseTomlText(text: string): DataParseResult {
  try {
    return { ok: true, value: parseToml(text) };
  } catch (e) {
    const err = e as { message?: string; line?: number; column?: number };
    return {
      ok: false,
      error: {
        message: err.message ?? 'TOML parse error',
        line: err.line ?? 1,
        column: err.column ?? 1,
      },
    };
  }
}

/** Dispatches to the parser family for a kind. */
export function parseAnyDataText(text: string, kind: DataKind): DataParseResult {
  if (kind === 'yaml') return parseYamlText(text);
  if (kind === 'toml') return parseTomlText(text);
  return parseDataText(text, kind);
}
```

Update the worker and `DataViewer` to call `parseAnyDataText` instead of `parseDataText`, and update the worker import accordingly.

- [ ] **Step 4: Text view languages**

In `DataTextView.tsx`, add `kind` to props and choose the grammar:

```tsx
import { json } from '@codemirror/lang-json';
import { StreamLanguage } from '@codemirror/language';
import { yaml as legaciesYaml } from '@codemirror/legacy-modes/mode/yaml';
```
If `@codemirror/legacy-modes` is not installed, install it:

```bash
npm install @codemirror/legacy-modes@^6.5.0 --legacy-peer-deps
```

and:

```tsx
const language =
  kind === 'yaml' ? StreamLanguage.define(legaciesYaml) : kind === 'toml' ? legacyToml : json();
```
For TOML use a minimal highlight fallback (`EditorView.baseTheme` only) in this phase; do not promise TOML colouring if the mode is unavailable — render plain monospace. Update the `useEffect` dependency list to `[text, kind]`.

- [ ] **Step 5: Run tests and build**

Run: `npm run test:data && npm run build`
Expected: tests pass (new cases included), build exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/utils/dataFormat.ts src/components/DataTextView.tsx src/workers/dataParse.worker.ts src/components/DataViewer.tsx tests/dataFormat.test.ts package.json package-lock.json
git commit -m "feat(viewer): JSON5, YAML and TOML support"
```

---

### Task 10: Documentation, README upgrades, release 1.1.0

**Files:**
- Modify: `README.md`, `history.md`, `PRODUCT.md`, `DESIGN.md`
- Modify: `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`

- [ ] **Step 1: README — expand the data section**

Replace the stub from Task 1 with the final copy:

```markdown
### 🔍 Data Files (read-only)

*   **JSON / JSONC / JSON5 / YAML / TOML**: open data files without leaving the editor. Toggle between a syntax-highlighted text view with folding and line numbers, and a collapsible tree with a key/value filter; double-click a row to copy its JSON path.
*   **Invalid files explain themselves**: parse errors report the exact line and column instead of showing a blank pane.
*   **Read-only by design**: the viewer never writes data files, and GravityMD does not register itself as a handler for `.json`/`.yaml` — it stays an inspector, not a second editor.
```

Add to "What's New in 1.1.0" section (rename the 1.0.6 section or add a new one above it):

```markdown
## 🆕 What's New in 1.1.0

*   **Read-only data viewer** — JSON/JSONC (plus JSON5/YAML/TOML) open in a hybrid text/tree surface with folding, search and copy-path.
*   **Safe by construction** — data files can never be saved over: the write whitelist stays Markdown-only.
*   **Markdown untouched** — the editor, import/export and status bar behave exactly as before when a `.md` file is open.
```

- [ ] **Step 2: history.md — Phase 42**

```markdown
## Phase 42: JSON-Hybrid Viewer (1.1.0)
Read-only data viewing per plan `docs/superpowers/plans/2026-11-05-json-hybrid-viewer.md`: file-kind detection (`src/types/fileKind.ts`), tolerant parsing/stats/tree rows (`src/utils/dataFormat.ts`), worker parsing, CodeMirror read-only text view and virtualized tree (`DataViewer`), app/toolbar/status-bar integration, Rust read whitelist extended for reads while writes stay Markdown-only. Formats: JSON/JSONC and JSON5/YAML/TOML shipped together as 1.1.0 (the plan originally split them into 1.1.0/1.2.0; both phases landed in one minor release). Positioning updated in PRODUCT.md ("inspect, don't mutate").
```

- [ ] **Step 3: Version bump 1.1.0**

```bash
npm version 1.1.0 --no-git-tag-version
```
Then update `src-tauri/tauri.conf.json` (`"version": "1.1.0"`) and `src-tauri/Cargo.toml` (`version = "1.1.0"`), run `cargo update -p gravitymd` in `src-tauri`, and refresh the README download links from `v1.1.0`/`gravitymd_1.1.0_*` once the release exists (do this after the tag build; the previous release links keep working until then).

- [ ] **Step 4: Full verification**

```bash
npm run test
npm run lint
npm run build
npx tauri build
```
Expected: tests pass, lint 0, build exit 0, two bundles produced.

- [ ] **Step 5: Commit and release**

```bash
git add -A
git commit -m "v1.1.0: read-only JSON/YAML/TOML viewer"
git push origin master
git tag v1.1.0
git push origin v1.1.0
```
Then watch the release workflow, verify all five assets return HTTP 200, and update the README download links to `v1.1.0` in a follow-up docs commit.

---

## Risks and Decisions

- **Positioning drift.** The product is a Markdown editor; the viewer is a read-only companion. PRODUCT.md now says this explicitly, and the app never registers data-file associations. If users ask for JSON editing, that is a separate decision (raw byte-preserving editor), not an extension of this plan.
- **Large files.** The 32 MB IPC cap remains. Files ≤ 256 KB parse on the main thread (enables cheap collapse/search); larger files parse in the worker and use flat filtering — tree collapse for > 256 KB is a known limitation to address later with incremental row models.
- **Read-only enforcement is layered.** UI disables Save/Save As, `useFileOperations` refuses data kinds, and the Rust write whitelist rejects them independently — three guards so a regression in one does not corrupt a file.
- **CodeMirror as a direct dependency.** The editor already ships `@codemirror/*` transitively; adding direct pins avoids depending on the bundler resolving a hoisted copy.
- **No file associations for data formats** — deliberate; the Open dialog filter is the discovery path.

## Verification Checklist (per release)

- [ ] `npm run test` — kind detection, parsing (valid/invalid), stats, tree rows, JSON path formatting.
- [ ] `npm run lint` — 0 problems.
- [ ] `npm run build` — exit 0; viewer chunk does not pull CodeMirror into the Markdown-only path twice.
- [ ] Dev smoke: open `.json` (tree + text), invalid JSON banner, `.yaml`/`.toml` in Phase 2, Save disabled, status bar data meta, theme switch keeps viewer legible.
- [ ] Release smoke on the built exe: same file opens, tree scrolls 10k rows without jank, invalid file shows `line:column`.
