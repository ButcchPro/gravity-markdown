import { useCallback } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { safeWriteBinaryFile } from '../utils/ipc';
import { notify } from '../utils/notify';
import { exportMarkdownToDocx } from '../utils/exportDocx';
import { runWorker } from '../utils/worker';

interface UseExportParams {
  currentValue: string;
}

export function useExport({ currentValue }: UseExportParams) {
  const handleExportDocx = useCallback(async () => {
    await exportMarkdownToDocx(currentValue, {
      choosePath: async () => {
        const file = await save({
          filters: [{ name: 'Word Document', extensions: ['docx'] }],
        });
        return typeof file === 'string' ? file : null;
      },
      // Markdown → HTML runs in a worker (same pipeline as the editor:
      // markdown-it + LaTeX + YFM tables). DOMParser/Blob are unavailable in
      // workers, so DOM → docx stays on the main thread.
      renderHtml: async (markdown) => {
        const renderWorker = () =>
          new Worker(new URL('../workers/mdRender.worker.ts', import.meta.url), { type: 'module' });
        const { html } = await runWorker<{ markdown: string }, { html: string }>(
          renderWorker,
          { markdown },
        );
        return html;
      },
      writeFile: safeWriteBinaryFile,
      notify,
    });
  }, [currentValue]);

  return { handleExportDocx };
}
