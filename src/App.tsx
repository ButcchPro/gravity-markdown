import { useState, useEffect, useCallback } from 'react';
import { ThemeProvider, ToasterProvider, ToasterComponent } from '@gravity-ui/uikit';
import { getVersion } from '@tauri-apps/api/app';
import { getCurrentWindow } from '@tauri-apps/api/window';

import { EditorWrapper } from './components/EditorWrapper';
import { Toolbar } from './components/Toolbar';
import { AboutDialog } from './components/AboutDialog';
import { useTheme } from './hooks/useTheme';
import { useZoom } from './hooks/useZoom';
import { useFileOperations } from './hooks/useFileOperations';
import { useImport } from './hooks/useImport';
import { useExport } from './hooks/useExport';
import { invokeGetInitialFile } from './types/ipc';
import { getFileName } from './utils/path';
import { toaster } from './utils/notify';

import './App.scss';
import './solarized-light.scss';

export default function App() {
  const [ready, setReady] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [appVersion, setAppVersion] = useState('');

  const { theme, toggleTheme, gravityTheme, themeLoaded } = useTheme();
  const { zoom, setZoom, zoomIn, zoomOut } = useZoom();
  const {
    currentFile, content, currentValue, setCurrentValue,
    fileKey, dirty, loadContent, handleOpenFile, handleOpen,
    handleSave, handleSaveAs,
  } = useFileOperations();
  const { handleImportDocx, handleImportXlsx } = useImport({ currentValue, currentFile, loadContent });
  const { handleExportDocx } = useExport({ currentValue });

  // Initialize app
  useEffect(() => {
    (async () => {
      setAppVersion(await getVersion());
      const initialFile: string | null = await invokeGetInitialFile();
      if (initialFile) {
        handleOpenFile(initialFile);
      }
      setReady(true);
    })();
  }, [handleOpenFile]);

  // Update window title when file changes
  useEffect(() => {
    const filename = currentFile ? getFileName(currentFile) : 'Untitled';
    getCurrentWindow().setTitle(`Gravity Markdown — ${filename}`).catch(console.error);
  }, [currentFile]);

  const handleSaveWithCheck = useCallback(async () => {
    if (!currentFile) {
      return handleSaveAs();
    }
    return handleSave();
  }, [currentFile, handleSave, handleSaveAs]);

  if (!themeLoaded || !ready) {
    return null;
  }

  return (
    <ThemeProvider theme={gravityTheme}>
      <ToasterProvider toaster={toaster}>
        <div
          className={`app-container${theme === 'solarized-light' ? ' theme-solarized-light' : ''}`}
          style={{ '--editor-zoom-scale': zoom / 100 } as React.CSSProperties}
        >
          <Toolbar
            onOpen={handleOpen}
            onSave={handleSaveWithCheck}
            onSaveAs={handleSaveAs}
            onImportDocx={handleImportDocx}
            onExportDocx={handleExportDocx}
            onImportXlsx={handleImportXlsx}
            onToggleTheme={toggleTheme}
            onAbout={() => setAboutOpen(true)}
            dirty={dirty}
            zoom={zoom}
            onSetZoom={setZoom}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            theme={theme}
          />
          <div className="editor-container">
            <EditorWrapper key={fileKey} initialContent={content} onSave={setCurrentValue} />
          </div>
        </div>
        <AboutDialog
          open={aboutOpen}
          onClose={() => setAboutOpen(false)}
          appVersion={appVersion}
        />
        <ToasterComponent />
      </ToasterProvider>
    </ThemeProvider>
  );
}
