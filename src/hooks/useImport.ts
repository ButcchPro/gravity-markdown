import { useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import mammoth from 'mammoth';
import TurndownService from 'turndown';
import * as XLSX from 'xlsx';
import { notify } from '../utils/notify';

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
        const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        const result = await mammoth.convertToHtml({ arrayBuffer });
        const turndownService = new TurndownService();
        const markdown = turndownService.turndown(result.value);

        if (result.messages.length > 0) {
          console.warn('DOCX import warnings:', result.messages.map(m => m.message));
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
      notify('Error importing DOCX', 'danger');
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
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(ws, { header: 1 });
        const fmt = (cell: string | number | null | undefined) => String(cell ?? '');

        if (aoa.length > 0) {
          let mdTable = '\n\n| ' + aoa[0].map(fmt).join(' | ') + ' |\n';
          mdTable += '| ' + aoa[0].map(() => '---').join(' | ') + ' |\n';
          for (let i = 1; i < aoa.length; i++) {
            mdTable += '| ' + aoa[i].map(fmt).join(' | ') + ' |\n';
          }
          loadContent(currentValue + mdTable, currentFile);
          notify('Imported Spreadsheet', 'success');
        } else {
          notify('Spreadsheet is empty', 'warning');
        }
      }
    } catch (e) {
      console.error(e);
      notify('Error importing Spreadsheet', 'danger');
    }
  }, [currentValue, currentFile, loadContent]);

  return { handleImportDocx, handleImportXlsx };
}
