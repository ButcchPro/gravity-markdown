/// XLSX/CSV → Markdown table conversion off the main thread (SheetJS).
/// Receives { data: ArrayBuffer }, replies with { table } ('' when empty).

import * as XLSX from 'xlsx';
import { rowsToPipeTable } from '../utils/pipeTable.ts';

interface ImportXlsxRequest {
  data: ArrayBuffer;
}

self.onmessage = (event: MessageEvent<ImportXlsxRequest>) => {
  try {
    const wb = XLSX.read(new Uint8Array(event.data.data), { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) {
      self.postMessage({ table: '' });
      return;
    }
    const aoa = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(ws, { header: 1 });
    const fmt = (cell: string | number | null | undefined) => String(cell ?? '');

    if (aoa.length === 0) {
      self.postMessage({ table: '' });
      return;
    }
    const [header, ...rows] = aoa.map(row => row.map(fmt));
    self.postMessage({ table: '\n\n' + rowsToPipeTable(header, rows) + '\n' });
  } catch (e) {
    self.postMessage({
      table: '',
      error: e instanceof Error ? e.message : String(e),
    });
  }
};
