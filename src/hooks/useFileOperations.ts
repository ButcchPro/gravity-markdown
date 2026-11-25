import { useState, useCallback, useMemo } from 'react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { safeReadTextFile, safeWriteTextFile } from '../utils/ipc';
import { getFileName, isViewableFile, SUPPORTED_EXTENSIONS } from '../utils/path';
import { notify } from '../utils/notify';
import { describeIpcError, invokeReadFileContent } from '../types/ipc';
import type { YfmConversionResult } from '../utils/yfmTable';
import { rewriteYfmToCompact } from '../utils/yfmTable';
import type { ReplaceDecision, ReplaceRequest } from './useReplaceGuard';
import { detectFileKind, isDataKind, VIEWABLE_EXTENSIONS, type FileKind } from '../types/fileKind';
import { normalizeInlineBreaks } from '../utils/inlineBreaks';
import { normalizeForCompare, stripTrailingBlank } from '../utils/markdownText';

/** Side-effecting collaborators, injected so the file lifecycle is testable. */
export interface FileOperationsDeps {
  openDialog: () => Promise<string | null>;
  saveDialog: () => Promise<string | null>;
  /** Reads through the generic text reader (used by the Open dialog). */
  readFile: (path: string) => Promise<string>;
  /** Reads through the content IPC (used when a path arrives from the OS). */
  readFileContent: (path: string) => Promise<string>;
  writeFile: (path: string, text: string) => Promise<void>;
  notify: (message: string, theme: 'success' | 'warning' | 'danger') => void;
}

const defaultDeps: FileOperationsDeps = {
  openDialog: async () => {
    const file = await open({
      multiple: false,
      filters: [
        { name: 'Markdown & data files', extensions: [...VIEWABLE_EXTENSIONS] },
        { name: 'Markdown', extensions: [...SUPPORTED_EXTENSIONS] },
        { name: 'Data files', extensions: ['json', 'jsonc', 'json5', 'yaml', 'yml', 'toml'] },
      ],
    });
    return typeof file === 'string' ? file : null;
  },
  saveDialog: async () => {
    const file = await save({ filters: [{ name: 'Markdown', extensions: ['md'] }] });
    return typeof file === 'string' ? file : null;
  },
  readFile: safeReadTextFile,
  readFileContent: invokeReadFileContent,
  writeFile: safeWriteTextFile,
  notify,
};

export interface UseFileOperationsParams {
  /**
   * Reads markdown directly from the editor (sanitizing YFM tables).
   * When provided, used instead of the debounced state on every save,
   * so saves always persist the freshest editor content.
   */
  getValue?: () => YfmConversionResult;
  /**
   * Canonical markup the editor holds after it finishes re-serialising a
   * document swapped by `getValue` (YFM → pipe). Saving that exact string keeps
   * the file and the editor in agreement, so the document is not left dirty
   * right after a successful save.
   */
  getSettledValue?: () => Promise<string>;
  /**
   * Guard for operations that replace the open document. Returns
   * 'cancel' to abort, 'replace' to continue.
   */
  beforeReplace?: (request: ReplaceRequest) => Promise<ReplaceDecision>;
  /** Overrides for tests. */
  deps?: Partial<FileOperationsDeps>;
}

export function useFileOperations({
  getValue,
  getSettledValue,
  beforeReplace,
  deps: overrides,
}: UseFileOperationsParams = {}) {
  // Stable identity: callbacks below depend on it. Callers pass a memoised object.
  const deps: FileOperationsDeps = useMemo(() => ({ ...defaultDeps, ...overrides }), [overrides]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [content, setContent] = useState('# Welcome to Gravity Markdown\n\nStart typing here...');
  const [currentValue, setCurrentValue] = useState(content);
  const [fileKey, setFileKey] = useState(0);
  const [fileKind, setFileKind] = useState<FileKind>('markdown');

  // Single place to persist a save payload and surface its diagnostics:
  // kept YFM tables (spans etc.) stay in YFM form — tell the user why.
  // Data files are read-only: refuse before touching the filesystem, so a UI
  // regression can never rewrite user JSON/YAML.
  const persist = useCallback(async (path: string): Promise<boolean> => {
    if (isDataKind(fileKind)) {
      deps.notify('Data files are read-only here — open the file in an editor to change it', 'warning');
      return false;
    }
    const { value, kept, converted } = getValue ? getValue() : { value: currentValue, kept: 0, converted: 0 };
    const settled = converted > 0 && getSettledValue ? await getSettledValue() : value;
    if (kept > 0) {
      deps.notify(
        `${kept} YFM table(s) kept: contains cell spans or block content — cannot be converted to a standard table`,
        'warning',
      );
    }
    try {
      const written = stripTrailingBlank(settled);
      await deps.writeFile(path, written);
      // Adopt the saved text as both baselines: the editor may re-serialise
      // differently from the file it was opened from.
      setContent(written);
      setCurrentValue(written);
      deps.notify('Saved!', 'success');
      return true;
    } catch (e) {
      console.error(e);
      deps.notify(`Couldn't save the file — ${describeIpcError(e)}`, 'danger');
      return false;
    }
  }, [currentValue, getValue, getSettledValue, fileKind, deps]);

  // Serializer noise (CRLF, trailing newline) is not an edit.
  const dirty = normalizeForCompare(currentValue) !== normalizeForCompare(content);

  const loadContent = useCallback((newContent: string, newFile: string | null = null, showToast = false) => {
    const kind = newFile ? detectFileKind(newFile) ?? 'markdown' : 'markdown';
    // Two normalisations, markdown only:
    // 1. `<br>` is a literal atom in the editor, so it becomes a real break.
    // 2. YFM tables the parser fully understands are rewritten to the compact
    //    row form: the editor's expanded serializer output is mis-parsed by
    //    its YFM parser (phantom trailing column) and one-line rows ending in
    //    a single pipe lose their rows. Tables with spans stay as written; the
    //    final pipe conversion still happens on save.
    let normalized = newContent;
    if (kind === 'markdown') {
      normalized = rewriteYfmToCompact(normalizeInlineBreaks(newContent));
    }
    setCurrentFile(newFile);
    setFileKind(kind);
    setContent(normalized);
    setCurrentValue(normalized);
    setFileKey(prev => prev + 1);
    if (showToast && newFile) {
      deps.notify(`Opened: ${getFileName(newFile)}`, 'success');
    }
  }, [deps]);

  const handleOpenFile = useCallback(async (path: string) => {
    try {
      if (!isViewableFile(path)) {
        deps.notify(
          "This file type can't be opened here — choose .md, .json, .yaml or another supported file",
          'danger',
        );
        return;
      }
      // Never replace a document with unsaved edits without asking first.
      const decision = await beforeReplace?.({ sourceName: getFileName(path), allowInsert: false });
      if (decision === 'cancel') return;
      const text = await deps.readFileContent(path);
      loadContent(text, path, true);
    } catch (e) {
      console.error(e);
      // Rust rejects binary garbage with FS_INVALID_DATA / file too large etc.
      deps.notify(`Couldn't open the file — ${describeIpcError(e)}`, 'danger');
    }
  }, [beforeReplace, loadContent, deps]);

  const handleOpen = useCallback(async () => {
    try {
      const file = await deps.openDialog();
      if (file) {
        const decision = await beforeReplace?.({ sourceName: getFileName(file), allowInsert: false });
        if (decision === 'cancel') return;
        const text = await deps.readFile(file);
        loadContent(text, file, true);
      }
    } catch (e) {
      console.error(e);
      deps.notify(`Couldn't open the file — ${describeIpcError(e)}`, 'danger');
    }
  }, [beforeReplace, loadContent, deps]);

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (currentFile) {
      return persist(currentFile);
    }
    return false;
  }, [currentFile, persist]);

  const handleSaveAs = useCallback(async (): Promise<boolean> => {
    try {
      if (isDataKind(fileKind)) {
        deps.notify('Data files are read-only here — open the file in an editor to change it', 'warning');
        return false;
      }
      const file = await deps.saveDialog();
      if (file) {
        const saved = await persist(file);
        if (saved) {
          setCurrentFile(file);
        }
        return saved;
      }
      return false;
    } catch (e) {
      console.error(e);
      deps.notify(`Couldn't save the file — ${describeIpcError(e)}`, 'danger');
      return false;
    }
  }, [persist, fileKind, deps]);

  return {
    currentFile,
    fileKind,
    content,
    currentValue,
    setCurrentValue,
    fileKey,
    dirty,
    loadContent,
    handleOpenFile,
    handleOpen,
    handleSave,
    handleSaveAs,
  };
}
