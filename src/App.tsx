import { useState, useEffect, useCallback, useMemo, useRef, Suspense, lazy } from 'react';
import { ThemeProvider, ToasterProvider, ToasterComponent, Text } from '@gravity-ui/uikit';
import type { MarkdownEditorMode } from '@gravity-ui/markdown-editor';
import { getVersion } from '@tauri-apps/api/app';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';

import type { EditorHandle } from './components/EditorWrapper';
import { Toolbar } from './components/Toolbar';
import { StatusBar } from './components/StatusBar';
import { AboutDialog } from './components/AboutDialog';
import { UnsavedChangesDialog } from './components/UnsavedChangesDialog';
import { UpdateDialog } from './components/UpdateDialog';
import { ConfirmDialog } from './components/ConfirmDialog';
import { useTheme } from './hooks/useTheme';
import { useZoom } from './hooks/useZoom';
import { useUpdateCheck } from './hooks/useUpdateCheck';
import { useReplaceGuard } from './hooks/useReplaceGuard';
import { useFileOperations } from './hooks/useFileOperations';
import { useImport } from './hooks/useImport';
import { useExport } from './hooks/useExport';
import { invokeGetInitialFile } from './types/ipc';
import { getFileName } from './utils/path';
import { countWords } from './utils/text';
import { toaster, notify } from './utils/notify';

import './App.scss';
import './solarized-light.scss';

// The editor (ProseMirror + CodeMirror + KaTeX + Mermaid) is the heaviest part
// of the bundle. Loading it lazily lets the shell — toolbar, status bar, theme,
// dialogs — paint immediately on a cold start.
const EditorWrapper = lazy(() =>
  import('./components/EditorWrapper').then((module) => ({ default: module.EditorWrapper })),
);

/** React.CSSProperties does not accept custom property keys; this widens it. */
type CSSVarDeclarations = React.CSSProperties & Record<`--${string}`, string | number>;

export default function App() {
  const [ready, setReady] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const [editorMode, setEditorMode] = useState<MarkdownEditorMode>('wysiwyg');
  const editorRef = useRef<EditorHandle>(null);
  // Latest dirty flag for stable event handlers and the replace guard.
  const dirtyRef = useRef(false);

  const { theme, toggleTheme, gravityTheme, themeLoaded } = useTheme();
  const { zoom, setZoom, zoomIn, zoomOut } = useZoom();
  const { update, skip, dismiss } = useUpdateCheck(ready);
  const { pending, beforeReplace, decide } = useReplaceGuard(() => dirtyRef.current);
  const {
    currentFile, content, currentValue, setCurrentValue,
    fileKey, dirty, loadContent, handleOpenFile, handleOpen,
    handleSave, handleSaveAs,
  } = useFileOperations({
    // Read straight from the editor on save: freshest content + YFM table
    // conversion (kept tables are reported by the save flow via the result).
    getValue: () => editorRef.current?.sanitizeForSave() ?? { value: currentValue, converted: 0, kept: 0 },
    beforeReplace,
  });
  const { handleImportDocx, handleImportXlsx } = useImport({
    currentValue,
    currentFile,
    loadContent,
    insertContent: (markup) => editorRef.current?.insertMarkup(markup),
    beforeReplace,
  });
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
    const title = `${dirty ? '• ' : ''}${filename} — GravityMD`;
    document.title = title;
    getCurrentWindow().setTitle(`Gravity Markdown — ${filename}${dirty ? ' •' : ''}`).catch(console.error);
  }, [currentFile, dirty]);

  const wordCount = useMemo(() => countWords(currentValue), [currentValue]);
  const modeLabel = editorMode === 'markup' ? 'Markup' : 'WYSIWYG';

  const handleSaveWithCheck = useCallback(async () => {
    if (!currentFile) {
      return handleSaveAs();
    }
    return handleSave();
  }, [currentFile, handleSave, handleSaveAs]);

  // Intercept window close: show save dialog when there are unsaved changes.
  // Refs keep the handler stable so onCloseRequested is registered only once,
  // while always reading the latest state via refs (avoiding stale closures).
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
          style={{ '--editor-zoom-scale': zoom / 100 } as CSSVarDeclarations}
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
          <main className="editor-container">
            <Suspense fallback={<div className="editor-suspense" />}>
              <EditorWrapper
                ref={editorRef}
                key={fileKey}
                initialContent={content}
                onSave={setCurrentValue}
                onModeChange={setEditorMode}
              />
            </Suspense>
          </main>
          <StatusBar
            fileName={fileName}
            filePath={currentFile}
            dirty={dirty}
            words={wordCount}
            mode={modeLabel}
          />
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
        <ConfirmDialog
          open={pending !== null}
          caption={pending?.allowInsert ? 'Import Word document' : 'Replace document?'}
          actions={
            pending?.allowInsert
              ? [
                  { key: 'replace', label: 'Replace document', view: 'outlined', danger: true },
                  { key: 'insert', label: 'Insert at cursor', view: 'action' },
                ]
              : [{ key: 'replace', label: 'Replace document', view: 'outlined', danger: true }]
          }
          onAction={(key) => decide(key === 'insert' ? 'insert' : 'replace')}
          onClose={() => decide('cancel')}
        >
          {pending?.allowInsert ? (
            <Text>
              Unsaved changes in “{fileName}” will be lost. Replace the document with “{pending.sourceName}”
              or insert it at the cursor?
            </Text>
          ) : (
            <Text>
              Opening “{pending?.sourceName}” replaces the current document. Unsaved changes in{' '}
              “{fileName}” will be lost.
            </Text>
          )}
        </ConfirmDialog>
        <ToasterComponent />
      </ToasterProvider>
    </ThemeProvider>
  );
}
