import { useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { notify } from '../utils/notify';
import { runWorker } from '../utils/worker';

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
}

export function useImport({ currentValue, currentFile, loadContent }: UseImportParams) {
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

        loadContent(markdown, null);
        notify('Imported DOCX', 'success');
      }
    } catch (e) {
      console.error(e);
      notify(`Error importing DOCX: ${e instanceof Error ? e.message : String(e)}`, 'danger');
    }
  }, [loadContent]);

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
