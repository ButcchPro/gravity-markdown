import { test } from 'node:test';
import assert from 'node:assert/strict';
import './dom-env.ts';
import { renderHook } from './react-env.ts';

import { useFileOperations, type FileOperationsDeps } from '../src/hooks/useFileOperations.ts';
import { useImport, type ImportDeps } from '../src/hooks/useImport.ts';

interface Recorder {
  writes: Array<{ path: string; text: string }>;
  notices: Array<{ message: string; theme: string }>;
}

function fileDeps(record: Recorder, overrides: Partial<FileOperationsDeps> = {}): FileOperationsDeps {
  return {
    openDialog: async () => null,
    saveDialog: async () => null,
    readFile: async () => '',
    readFileContent: async () => '',
    writeFile: async (path, text) => {
      record.writes.push({ path, text });
    },
    notify: (message, theme) => {
      record.notices.push({ message, theme });
    },
    ...overrides,
  };
}

function recorder(): Recorder {
  return { writes: [], notices: [] };
}

const quiet = { error: console.error, warn: console.warn };
console.error = () => {};
console.warn = () => {};
process.on('exit', () => {
  console.error = quiet.error;
  console.warn = quiet.warn;
});

// ── loadContent / dirty ────────────────────────────────────────────────────

test('loadContent normalises <br> and YFM tables for markdown', async () => {
  const record = recorder();
  const deps = fileDeps(record);
  const hook = await renderHook(() => useFileOperations({ deps }));

  const source = 'a<br>b\n\n#|\n|| A | B |\n|#\n';
  await hook.act(() => hook.current.loadContent(source, 'C:/docs/a.md', true));

  assert.match(hook.current.content, /a {2}\nb/);
  assert.match(hook.current.content, /\|\| A \| B \|\|/);
  assert.equal(hook.current.fileKind, 'markdown');
  assert.equal(hook.current.currentFile, 'C:/docs/a.md');
  assert.equal(hook.current.dirty, false);
  assert.deepEqual(record.notices[0], { message: 'Opened: a.md', theme: 'success' });
  await hook.unmount();
});

test('loadContent leaves data files untouched and marks the kind', async () => {
  const record = recorder();
  const hook = await renderHook(() => useFileOperations({ deps: fileDeps(record) }));

  const source = '{"a":1}\n';
  await hook.act(() => hook.current.loadContent(source, 'C:/data/a.json'));

  assert.equal(hook.current.content, source);
  assert.equal(hook.current.fileKind, 'json');
  assert.equal(hook.current.dirty, false);
  await hook.unmount();
});

test('dirty flips when the editor value differs from the saved content', async () => {
  const record = recorder();
  const hook = await renderHook(() => useFileOperations({ deps: fileDeps(record) }));

  await hook.act(() => hook.current.loadContent('# A', 'C:/a.md'));
  assert.equal(hook.current.dirty, false);

  await hook.act(() => hook.current.setCurrentValue('# A edited'));
  assert.equal(hook.current.dirty, true);
  await hook.unmount();
});

// ── open flows ────────────────────────────────────────────────────────────

test('handleOpenFile refuses unsupported extensions', async () => {
  const record = recorder();
  const hook = await renderHook(() => useFileOperations({ deps: fileDeps(record) }));

  await hook.act(async () => {
    await hook.current.handleOpenFile('C:/a.exe');
  });

  assert.equal(record.notices[0]?.theme, 'danger');
  assert.match(record.notices[0]?.message ?? '', /can't be opened here/);
  await hook.unmount();
});

test('handleOpenFile reads through IPC and reports the opened file', async () => {
  const record = recorder();
  const deps = fileDeps(record, { readFileContent: async () => '# Opened' });
  const hook = await renderHook(() => useFileOperations({ deps }));

  await hook.act(async () => {
    await hook.current.handleOpenFile('C:/docs/note.md');
  });

  assert.equal(hook.current.content, '# Opened');
  assert.equal(hook.current.currentFile, 'C:/docs/note.md');
  await hook.unmount();
});

test('handleOpenFile reports a read error instead of crashing', async () => {
  const record = recorder();
  const deps = fileDeps(record, {
    readFileContent: async () => {
      throw { code: 'FS_ACCESS_DENIED', message: 'denied' };
    },
  });
  const hook = await renderHook(() => useFileOperations({ deps }));

  await hook.act(async () => {
    await hook.current.handleOpenFile('C:/docs/secret.md');
  });

  assert.equal(record.notices.at(-1)?.theme, 'danger');
  assert.match(record.notices.at(-1)?.message ?? '', /denied access/);
  await hook.unmount();
});

test('handleOpen honours the replace guard', async () => {
  const record = recorder();
  let read = 0;
  const deps = fileDeps(record, {
    openDialog: async () => 'C:/docs/a.md',
    readFile: async () => {
      read += 1;
      return '# A';
    },
  });
  const hook = await renderHook(() =>
    useFileOperations({ deps, beforeReplace: async () => 'cancel' }),
  );

  await hook.act(async () => {
    await hook.current.handleOpen();
  });

  assert.equal(read, 0);
  await hook.unmount();
});

test('handleOpen loads the picked file', async () => {
  const record = recorder();
  const deps = fileDeps(record, {
    openDialog: async () => 'C:/docs/b.md',
    readFile: async () => '# B',
  });
  const hook = await renderHook(() => useFileOperations({ deps }));

  await hook.act(async () => {
    await hook.current.handleOpen();
  });

  assert.equal(hook.current.content, '# B');
  await hook.unmount();
});

// ── save flows ────────────────────────────────────────────────────────────

test('handleSave writes the editor value and clears dirty', async () => {
  const record = recorder();
  const hook = await renderHook(() =>
    useFileOperations({
      deps: fileDeps(record),
      getValue: () => ({ value: '# Fresh', converted: 0, kept: 0 }),
    }),
  );

  await hook.act(() => hook.current.loadContent('# Old', 'C:/a.md'));
  await hook.act(() => hook.current.setCurrentValue('# Edited'));

  let saved = false;
  await hook.act(async () => {
    saved = await hook.current.handleSave();
  });

  assert.equal(saved, true);
  // Files are written with LF endings and exactly one trailing newline.
  assert.deepEqual(record.writes, [{ path: 'C:/a.md', text: '# Fresh\n' }]);
  assert.deepEqual(record.notices.at(-1), { message: 'Saved!', theme: 'success' });
  assert.equal(hook.current.content, '# Fresh\n');
  await hook.unmount();
});

test('handleSave uses the settled value after a YFM conversion', async () => {
  const record = recorder();
  const hook = await renderHook(() =>
    useFileOperations({
      deps: fileDeps(record),
      getValue: () => ({ value: '| A | B |', converted: 1, kept: 0 }),
      getSettledValue: async () => '| A | B |\n| --- | --- |\n',
    }),
  );

  await hook.act(() => hook.current.loadContent('# x', 'C:/a.md'));
  await hook.act(async () => {
    await hook.current.handleSave();
  });

  assert.equal(record.writes[0].text, '| A | B |\n| --- | --- |\n');
  await hook.unmount();
});

test('handleSave warns about kept YFM tables', async () => {
  const record = recorder();
  const hook = await renderHook(() =>
    useFileOperations({
      deps: fileDeps(record),
      getValue: () => ({ value: '# YFM', converted: 0, kept: 2 }),
    }),
  );

  await hook.act(() => hook.current.loadContent('# x', 'C:/a.md'));
  await hook.act(async () => {
    await hook.current.handleSave();
  });

  assert.match(record.notices[0].message, /2 YFM table\(s\) kept/);
  await hook.unmount();
});

test('handleSave refuses data files (read-only contract)', async () => {
  const record = recorder();
  const hook = await renderHook(() => useFileOperations({ deps: fileDeps(record) }));

  await hook.act(() => hook.current.loadContent('{"a":1}', 'C:/a.json'));

  let saved = true;
  await hook.act(async () => {
    saved = await hook.current.handleSave();
  });

  assert.equal(saved, false);
  assert.equal(record.writes.length, 0);
  assert.match(record.notices[0].message, /read-only/);
  await hook.unmount();
});

test('handleSave reports a write failure', async () => {
  const record = recorder();
  const deps = fileDeps(record, {
    writeFile: async () => {
      throw { code: 'FS_TOO_LARGE', message: 'too big' };
    },
  });
  const hook = await renderHook(() => useFileOperations({ deps }));

  await hook.act(() => hook.current.loadContent('# x', 'C:/a.md'));
  let saved = true;
  await hook.act(async () => {
    saved = await hook.current.handleSave();
  });

  assert.equal(saved, false);
  assert.match(record.notices.at(-1)?.message ?? '', /larger than the 32 MB/);
  await hook.unmount();
});

test('handleSave does nothing without a file', async () => {
  const record = recorder();
  const hook = await renderHook(() => useFileOperations({ deps: fileDeps(record) }));

  let saved = true;
  await hook.act(async () => {
    saved = await hook.current.handleSave();
  });

  assert.equal(saved, false);
  assert.equal(record.writes.length, 0);
  await hook.unmount();
});

test('handleSaveAs writes to the chosen path and adopts it', async () => {
  const record = recorder();
  const deps = fileDeps(record, { saveDialog: async () => 'C:/docs/new.md' });
  const hook = await renderHook(() => useFileOperations({ deps }));

  await hook.act(() => hook.current.loadContent('# x'));
  let saved = false;
  await hook.act(async () => {
    saved = await hook.current.handleSaveAs();
  });

  assert.equal(saved, true);
  assert.equal(hook.current.currentFile, 'C:/docs/new.md');
  assert.deepEqual(record.writes.map((write) => write.path), ['C:/docs/new.md']);
  await hook.unmount();
});

test('handleSaveAs returns false when the dialog is dismissed', async () => {
  const record = recorder();
  const hook = await renderHook(() => useFileOperations({ deps: fileDeps(record) }));

  await hook.act(() => hook.current.loadContent('# x'));
  let saved = true;
  await hook.act(async () => {
    saved = await hook.current.handleSaveAs();
  });

  assert.equal(saved, false);
  assert.equal(record.writes.length, 0);
  await hook.unmount();
});

test('handleSaveAs refuses data files', async () => {
  const record = recorder();
  const deps = fileDeps(record, { saveDialog: async () => 'C:/docs/x.md' });
  const hook = await renderHook(() => useFileOperations({ deps }));

  await hook.act(() => hook.current.loadContent('{}', 'C:/a.json'));
  let saved = true;
  await hook.act(async () => {
    saved = await hook.current.handleSaveAs();
  });

  assert.equal(saved, false);
  assert.equal(record.writes.length, 0);
  await hook.unmount();
});

// ── import flows ──────────────────────────────────────────────────────────

function importDeps(record: Recorder, overrides: Partial<ImportDeps> = {}): ImportDeps {
  return {
    openDialog: async () => null,
    readFile: async () => new Uint8Array([1, 2, 3]),
    convertDocx: async () => ({ markdown: '# From DOCX', warnings: [] }),
    convertXlsx: async () => ({ table: '\n| a |\n| --- |\n| 1 |\n' }),
    notify: (message, theme) => {
      record.notices.push({ message, theme });
    },
    ...overrides,
  };
}

test('DOCX import replaces the document', async () => {
  const record = recorder();
  let loaded: { content: string; file: string | null } | null = null;
  const hook = await renderHook(() =>
    useImport({
      currentValue: '',
      currentFile: null,
      loadContent: (content, file) => {
        loaded = { content, file };
      },
      deps: importDeps(record, { openDialog: async () => 'C:/doc.docx' }),
    }),
  );

  await hook.act(async () => {
    await hook.current.handleImportDocx();
  });

  assert.deepEqual(loaded, { content: '# From DOCX', file: null });
  assert.deepEqual(record.notices.at(-1), { message: 'Imported DOCX', theme: 'success' });
  await hook.unmount();
});

test('DOCX import can insert at the cursor instead', async () => {
  const record = recorder();
  let inserted = '';
  const hook = await renderHook(() =>
    useImport({
      currentValue: '',
      currentFile: null,
      loadContent: () => {},
      insertContent: (markup) => {
        inserted = markup;
      },
      beforeReplace: async () => 'insert',
      deps: importDeps(record, { openDialog: async () => 'C:/doc.docx' }),
    }),
  );

  await hook.act(async () => {
    await hook.current.handleImportDocx();
  });

  assert.equal(inserted, '# From DOCX');
  assert.deepEqual(record.notices.at(-1), { message: 'Inserted DOCX at cursor', theme: 'success' });
  await hook.unmount();
});

test('DOCX import stops on cancel and on an empty document', async () => {
  const record = recorder();
  let loaded = false;
  const cancelled = await renderHook(() =>
    useImport({
      currentValue: '',
      currentFile: null,
      loadContent: () => {
        loaded = true;
      },
      beforeReplace: async () => 'cancel',
      deps: importDeps(record, { openDialog: async () => 'C:/doc.docx' }),
    }),
  );
  await cancelled.act(async () => {
    await cancelled.current.handleImportDocx();
  });
  assert.equal(loaded, false);
  await cancelled.unmount();

  const empty = await renderHook(() =>
    useImport({
      currentValue: '',
      currentFile: null,
      loadContent: () => {},
      deps: importDeps(record, {
        openDialog: async () => 'C:/doc.docx',
        convertDocx: async () => ({ markdown: '   ', warnings: [] }),
      }),
    }),
  );
  await empty.act(async () => {
    await empty.current.handleImportDocx();
  });
  assert.match(record.notices.at(-1)?.message ?? '', /appears to be empty/);
  await empty.unmount();
});

test('DOCX import reports conversion errors', async () => {
  const record = recorder();
  const hook = await renderHook(() =>
    useImport({
      currentValue: '',
      currentFile: null,
      loadContent: () => {},
      deps: importDeps(record, {
        openDialog: async () => 'C:/doc.docx',
        convertDocx: async () => {
          throw new Error('bad archive');
        },
      }),
    }),
  );

  await hook.act(async () => {
    await hook.current.handleImportDocx();
  });

  assert.deepEqual(record.notices.at(-1), {
    message: 'Error importing DOCX: bad archive',
    theme: 'danger',
  });
  await hook.unmount();
});

test('spreadsheet import appends the table to the document', async () => {
  const record = recorder();
  const loaded: { content?: string; file?: string | null } = {};
  const hook = await renderHook(() =>
    useImport({
      currentValue: '# Sheet\n',
      currentFile: 'C:/sheet.md',
      loadContent: (content, file) => {
        loaded.content = content;
        loaded.file = file;
      },
      deps: importDeps(record, { openDialog: async () => 'C:/book.xlsx' }),
    }),
  );

  await hook.act(async () => {
    await hook.current.handleImportXlsx();
  });

  assert.equal(loaded.content, '# Sheet\n\n| a |\n| --- |\n| 1 |\n');
  assert.equal(loaded.file, 'C:/sheet.md');
  assert.deepEqual(record.notices.at(-1), { message: 'Imported Spreadsheet', theme: 'success' });
  await hook.unmount();
});

test('spreadsheet import warns about an empty sheet and errors', async () => {
  const record = recorder();
  const empty = await renderHook(() =>
    useImport({
      currentValue: '',
      currentFile: null,
      loadContent: () => {},
      deps: importDeps(record, {
        openDialog: async () => 'C:/book.xlsx',
        convertXlsx: async () => ({ table: '' }),
      }),
    }),
  );
  await empty.act(async () => {
    await empty.current.handleImportXlsx();
  });
  assert.match(record.notices.at(-1)?.message ?? '', /Spreadsheet is empty/);
  await empty.unmount();

  const failing = await renderHook(() =>
    useImport({
      currentValue: '',
      currentFile: null,
      loadContent: () => {},
      deps: importDeps(record, {
        openDialog: async () => 'C:/book.xlsx',
        convertXlsx: async () => {
          throw 'broken sheet';
        },
      }),
    }),
  );
  await failing.act(async () => {
    await failing.current.handleImportXlsx();
  });
  assert.deepEqual(record.notices.at(-1), {
    message: 'Error importing Spreadsheet: broken sheet',
    theme: 'danger',
  });
  await failing.unmount();
});
