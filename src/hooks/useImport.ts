import { useCallback, useMemo } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { notify } from '../utils/notify';
import { getFileName } from '../utils/path';
import { runWorker } from '../utils/worker';
import type { ReplaceDecision, ReplaceRequest } from './useReplaceGuard.ts';

// Conversions run in one-shot Web Workers so big files never freeze the UI.
const createDocxWorker = () =>
  new Worker(new URL('../workers/docxImport.worker.ts', import.meta.url), { type: 'module' });
const createXlsxWorker = () =>
  new Worker(new URL('../workers/xlsxImport.worker.ts', import.meta.url), { type: 'module' });

export interface DocxImportResult {
  markdown: string;
  warnings: string[];
}

export interface XlsxImportResult {
  table: string;
}

/** Side-effecting collaborators, injected so import flows are testable. */
export interface ImportDeps {
  openDialog: (extensions: string[]) => Promise<string | null>;
  readFile: (path: string) => Promise<Uint8Array>;
  convertDocx: (buffer: ArrayBuffer) => Promise<DocxImportResult>;
  convertXlsx: (buffer: ArrayBuffer) => Promise<XlsxImportResult>;
  notify: (message: string, theme: 'success' | 'warning' | 'danger') => void;
}

const defaultDeps: ImportDeps = {
  openDialog: async (extensions) => {
    const file = await open({ multiple: false, filters: [{ name: 'Document', extensions }] });
    return typeof file === 'string' ? file : null;
  },
  readFile: (path) => readFile(path),
  convertDocx: (buffer) =>
    runWorker<{ buffer: ArrayBuffer }, DocxImportResult>(createDocxWorker, { buffer }),
  convertXlsx: (buffer) =>
    runWorker<{ data: ArrayBuffer }, XlsxImportResult>(createXlsxWorker, { data: buffer }),
  notify,
};

interface UseImportParams {
  currentValue: string;
  currentFile: string | null;
  loadContent: (content: string, file: string | null, showToast?: boolean) => void;
  /** Inserts markdown at the caret (DOCX → "Insert at cursor"). */
  insertContent?: (markup: string) => void;
  /** Guard so a DOCX import never silently replaces unsaved edits. */
  beforeReplace?: (request: ReplaceRequest) => Promise<ReplaceDecision>;
  /** Overrides for tests. */
  deps?: Partial<ImportDeps>;
}

/** Extracts a standalone ArrayBuffer: workers cannot clone a buffer view. */
function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

export function useImport({
  currentValue,
  currentFile,
  loadContent,
  insertContent,
  beforeReplace,
  deps: overrides,
}: UseImportParams) {
  // Stable identity: callbacks below depend on it. Callers pass a memoised object.
  const deps: ImportDeps = useMemo(() => ({ ...defaultDeps, ...overrides }), [overrides]);

  const handleImportDocx = useCallback(async () => {
    try {
      const file = await deps.openDialog(['docx']);
      if (!file) return;

      const { markdown, warnings } = await deps.convertDocx(toArrayBuffer(await deps.readFile(file)));

      if (warnings.length > 0) {
        console.warn('DOCX import warnings:', warnings);
      }

      if (!markdown.trim()) {
        deps.notify('DOCX appears to be empty', 'warning');
        return;
      }

      const decision = await beforeReplace?.({
        sourceName: getFileName(file),
        allowInsert: true,
      });
      if (decision === 'cancel') return;
      if (decision === 'insert' && insertContent) {
        insertContent(markdown);
        deps.notify('Inserted DOCX at cursor', 'success');
        return;
      }

      loadContent(markdown, null);
      deps.notify('Imported DOCX', 'success');
    } catch (e) {
      console.error(e);
      deps.notify(`Error importing DOCX: ${e instanceof Error ? e.message : String(e)}`, 'danger');
    }
  }, [beforeReplace, insertContent, loadContent, deps]);

  const handleImportXlsx = useCallback(async () => {
    try {
      const file = await deps.openDialog(['xlsx', 'csv']);
      if (!file) return;

      const { table } = await deps.convertXlsx(toArrayBuffer(await deps.readFile(file)));

      if (table) {
        loadContent(currentValue + table, currentFile);
        deps.notify('Imported Spreadsheet', 'success');
      } else {
        deps.notify('Spreadsheet is empty', 'warning');
      }
    } catch (e) {
      console.error(e);
      deps.notify(`Error importing Spreadsheet: ${e instanceof Error ? e.message : String(e)}`, 'danger');
    }
  }, [currentValue, currentFile, loadContent, deps]);

  return { handleImportDocx, handleImportXlsx };
}
