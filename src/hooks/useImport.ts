import { useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { notify } from '../utils/notify';
import { getFileName } from '../utils/path';
import { runWorker } from '../utils/worker';
import type { ReplaceDecision, ReplaceRequest } from './useReplaceGuard';

// Conversions run in one-shot Web Workers so big files never freeze the UI.
const createDocxWorker = () =>
  new Worker(new URL('../workers/docxImport.worker.ts', import.meta.url), { type: 'module' });
const createXlsxWorker = () =>
  new Worker(new URL('../workers/xlsxImport.worker.ts', import.meta.url), { type: 'module' });

interface DocxImportResult {
  markdown: string;
  warnings: string[];
}

interface XlsxImportResult {
  table: string;
}

interface UseImportParams {
  currentValue: string;
  currentFile: string | null;
  loadContent: (content: string, file: string | null, showToast?: boolean) => void;
  /** Inserts markdown at the caret (DOCX → "Insert at cursor"). */
  insertContent?: (markup: string) => void;
  /** Guard so a DOCX import never silently replaces unsaved edits. */
  beforeReplace?: (request: ReplaceRequest) => Promise<ReplaceDecision>;
}

export function useImport({
  currentValue,
  currentFile,
  loadContent,
  insertContent,
  beforeReplace,
}: UseImportParams) {
  const handleImportDocx = useCallback(async () => {
    try {
      const file = await open({
        multiple: false,
        filters: [{ name: 'Word Document', extensions: ['docx'] }],
      });
      if (file && typeof file === 'string') {
        const data = await readFile(file);
        // mammoth needs a clean ArrayBuffer: slice off TypeedArray offset metadata.
        const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        const { markdown, warnings } = await runWorker<{ buffer: ArrayBuffer }, DocxImportResult>(
          createDocxWorker,
          { buffer },
        );

        if (warnings.length > 0) {
          console.warn('DOCX import warnings:', warnings);
        }

        if (!markdown.trim()) {
          notify('DOCX appears to be empty', 'warning');
          return;
        }

        const decision = await beforeReplace?.({
          sourceName: getFileName(file),
          allowInsert: true,
        });
        if (decision === 'cancel') return;
        if (decision === 'insert' && insertContent) {
          insertContent(markdown);
          notify('Inserted DOCX at cursor', 'success');
          return;
        }

        loadContent(markdown, null);
        notify('Imported DOCX', 'success');
      }
    } catch (e) {
      console.error(e);
      notify(`Error importing DOCX: ${e instanceof Error ? e.message : String(e)}`, 'danger');
    }
  }, [beforeReplace, insertContent, loadContent]);

  const handleImportXlsx = useCallback(async () => {
    try {
      const file = await open({
        multiple: false,
        filters: [{ name: 'Excel Spreadsheet', extensions: ['xlsx', 'csv'] }],
      });
      if (file && typeof file === 'string') {
        const data = await readFile(file);
        const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        const { table } = await runWorker<{ data: ArrayBuffer }, XlsxImportResult>(
          createXlsxWorker,
          { data: buffer },
        );

        if (table) {
          loadContent(currentValue + table, currentFile);
          notify('Imported Spreadsheet', 'success');
        } else {
          notify('Spreadsheet is empty', 'warning');
        }
      }
    } catch (e) {
      console.error(e);
      notify(`Error importing Spreadsheet: ${e instanceof Error ? e.message : String(e)}`, 'danger');
    }
  }, [currentValue, currentFile, loadContent]);

  return { handleImportDocx, handleImportXlsx };
}
