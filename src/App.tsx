import { useState, useEffect, useCallback, useRef } from 'react';
import { ThemeProvider, ToasterProvider, ToasterComponent } from '@gravity-ui/uikit';
import { getVersion } from '@tauri-apps/api/app';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';

import { EditorWrapper, type EditorHandle } from './components/EditorWrapper';
import { Toolbar } from './components/Toolbar';
import { AboutDialog } from './components/AboutDialog';
import { UnsavedChangesDialog } from './components/UnsavedChangesDialog';
import { UpdateDialog } from './components/UpdateDialog';
import { useTheme } from './hooks/useTheme';
import { useZoom } from './hooks/useZoom';
import { useUpdateCheck } from './hooks/useUpdateCheck';
import { useFileOperations } from './hooks/useFileOperations';
import { useImport } from './hooks/useImport';
import { useExport } from './hooks/useExport';
import { invokeGetInitialFile } from './types/ipc';
import { getFileName } from './utils/path';
import { toaster, notify } from './utils/notify';

import './App.scss';
import './solarized-light.scss';

export default function App() {
  const [ready, setReady] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const editorRef = useRef<EditorHandle>(null);

  const { theme, toggleTheme, gravityTheme, themeLoaded } = useTheme();
  const { zoom, setZoom, zoomIn, zoomOut } = useZoom();
  const { update, skip, dismiss } = useUpdateCheck(ready);
  const {
    currentFile, content, currentValue, setCurrentValue,
    fileKey, dirty, loadContent, handleOpenFile, handleOpen,
    handleSave, handleSaveAs,
  } = useFileOperations({
    // Read straight from the editor on save: freshest content + YFM table
    // conversion (kept tables are reported by the save flow via the result).
    getValue: () => editorRef.current?.sanitizeForSave() ?? { value: currentValue, converted: 0, kept: 0 },
  });
  const { handleImportDocx, handleImportXlsx } = useImport({ currentValue, currentFile, loadContent });
  const { handleExportDocx } = useExport({ currentValue });

  // Initialize app
  useEffect(() => {
    (async () => {
      try {
        setAppVersion(await getVersion());
        const initialFile: string | null = await invokeGetInitialFile();
        if (initialFile) {
          handleOpenFile(initialFile);
        }
      } catch (e) {
        console.error('App initialization failed:', e);
        notify('App initialization failed', 'danger');
      } finally {
        setReady(true);
      }
    })();
  }, [handleOpenFile]);

  // File opened by a second process launch: tauri-plugin-single-instance
  // forwards the path here as an event (initial-file mutex covers only the
  // first launch, so this covers "double-click .md while app is running").
  useEffect(() => {
    let unlistenFileOpen: UnlistenFn | null = null;
    listen<string>('file-open', (event) => {
      if (typeof event.payload === 'string' && event.payload) {
        handleOpenFile(event.payload);
      }
    }).then((fn) => {
      unlistenFileOpen = fn;
    });
    return () => {
      unlistenFileOpen?.();
    };
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

  // Intercept window close: show save dialog when there are unsaved changes.
  // Refs keep the handler stable so onCloseRequested is registered only once,
  // while always reading the latest state via refs (avoiding stale closures).
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  const fileName = currentFile ? getFileName(currentFile) : 'Untitled';

  useEffect(() => {
    const unlisten = getCurrentWindow().onCloseRequested(async (event) => {
      if (!dirtyRef.current) {
        return; // clean state — let the window close
      }
      event.preventDefault(); // block close, show dialog
      setConfirmClose(true);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleCloseConfirmed = useCallback(async () => {
    // "Save" in the dialog: persist, then close on success / keep dialog on failure
    setConfirmClose(false);
    const saved = currentFile ? await handleSave() : await handleSaveAs();
    if (saved) {
      void getCurrentWindow().destroy();
    } else {
      setConfirmClose(true);
    }
  }, [currentFile, handleSave, handleSaveAs]);

  const handleCloseWithoutSaving = useCallback(() => {
    setConfirmClose(false);
    void getCurrentWindow().destroy();
  }, []);

  const handleCancelClose = useCallback(() => {
    setConfirmClose(false);
  }, []);

  // Solarized overrides are scoped to `.theme-solarized-light`; applying the
  // class to <body> also covers portal-based UI (Dialogs, Toaster) rendered
  // outside the app container.
  useEffect(() => {
    document.body.classList.toggle('theme-solarized-light', theme === 'solarized-light');
  }, [theme]);

  if (!themeLoaded || !ready) {
    return null;
  }

  return (
    <ThemeProvider theme={gravityTheme}>
      <ToasterProvider toaster={toaster}>
        <div
          className="app-container"
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
            <EditorWrapper ref={editorRef} key={fileKey} initialContent={content} onSave={setCurrentValue} />
          </div>
        </div>
        <AboutDialog
          open={aboutOpen}
          onClose={() => setAboutOpen(false)}
          appVersion={appVersion}
        />
        <UnsavedChangesDialog
          open={confirmClose}
          fileName={fileName}
          onSave={handleCloseConfirmed}
          onDontSave={handleCloseWithoutSaving}
          onCancel={handleCancelClose}
        />
        <UpdateDialog
          open={update !== null}
          latest={update?.latest ?? ''}
          current={appVersion}
          onSkip={() => void skip(update?.latest ?? '')}
          onClose={dismiss}
        />
        <ToasterComponent />
      </ToasterProvider>
    </ThemeProvider>
  );
}
