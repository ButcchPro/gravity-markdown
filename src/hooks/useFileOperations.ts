import { useState, useCallback } from 'react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { safeReadTextFile, safeWriteTextFile } from '../utils/ipc';
import { getFileName, isSupportedFile, SUPPORTED_EXTENSIONS } from '../utils/path';
import { notify } from '../utils/notify';
import { describeIpcError, invokeReadFileContent } from '../types/ipc';
import type { YfmConversionResult } from '../utils/yfmTable';
import type { ReplaceDecision, ReplaceRequest } from './useReplaceGuard';

export interface UseFileOperationsParams {
  /**
   * Reads markdown directly from the editor (sanitizing YFM tables).
   * When provided, used instead of the debounced state on every save,
   * so saves always persist the freshest editor content.
   */
  getValue?: () => YfmConversionResult;
  /**
   * Guard for operations that replace the open document. Returns
   * 'cancel' to abort, 'replace' to continue.
   */
  beforeReplace?: (request: ReplaceRequest) => Promise<ReplaceDecision>;
}

export function useFileOperations({ getValue, beforeReplace }: UseFileOperationsParams = {}) {
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [content, setContent] = useState('# Welcome to Gravity Markdown\n\nStart typing here...');
  const [currentValue, setCurrentValue] = useState(content);
  const [fileKey, setFileKey] = useState(0);

  // Single place to persist a save payload and surface its diagnostics:
  // kept YFM tables (spans etc.) stay in YFM form — tell the user why.
  const persist = useCallback(async (path: string): Promise<boolean> => {
    const { value, kept } = getValue ? getValue() : { value: currentValue, kept: 0 };
    if (kept > 0) {
      notify(
        `${kept} YFM table(s) kept: contains cell spans or block content — cannot be converted to a standard table`,
        'warning',
      );
    }
    try {
      await safeWriteTextFile(path, value);
      setContent(value);
      notify('Saved!', 'success');
      return true;
    } catch (e) {
      console.error(e);
      notify(`Couldn't save the file — ${describeIpcError(e)}`, 'danger');
      return false;
    }
  }, [currentValue, getValue]);

  const dirty = currentValue !== content;

  const loadContent = useCallback((newContent: string, newFile: string | null = null, showToast = false) => {
    setCurrentFile(newFile);
    setContent(newContent);
    setCurrentValue(newContent);
    setFileKey(prev => prev + 1);
    if (showToast && newFile) {
      notify(`Opened: ${getFileName(newFile)}`, 'success');
    }
  }, []);

  const handleOpenFile = useCallback(async (path: string) => {
    try {
      if (!isSupportedFile(path)) {
        notify("This file type can't be opened here — choose .md, .txt or .markdown", 'danger');
        return;
      }
      // Never replace a document with unsaved edits without asking first.
      const decision = await beforeReplace?.({ sourceName: getFileName(path), allowInsert: false });
      if (decision === 'cancel') return;
      const text = await invokeReadFileContent(path);
      loadContent(text, path, true);
    } catch (e) {
      console.error(e);
      // Rust rejects binary garbage with FS_INVALID_DATA / file too large etc.
      notify(`Couldn't open the file — ${describeIpcError(e)}`, 'danger');
    }
  }, [beforeReplace, loadContent]);

  const handleOpen = useCallback(async () => {
    try {
      const file = await open({
        multiple: false,
        filters: [{ name: 'Markdown', extensions: [...SUPPORTED_EXTENSIONS] }],
      });
      if (file && typeof file === 'string') {
        const decision = await beforeReplace?.({ sourceName: getFileName(file), allowInsert: false });
        if (decision === 'cancel') return;
        const text = await safeReadTextFile(file);
        loadContent(text, file, true);
      }
    } catch (e) {
      console.error(e);
      notify(`Couldn't open the file — ${describeIpcError(e)}`, 'danger');
    }
  }, [beforeReplace, loadContent]);

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (currentFile) {
      return persist(currentFile);
    }
    return false;
  }, [currentFile, persist]);

  const handleSaveAs = useCallback(async (): Promise<boolean> => {
    try {
      const file = await save({
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      });
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
      notify(`Couldn't save the file — ${describeIpcError(e)}`, 'danger');
      return false;
    }
  }, [persist]);

  return {
    currentFile,
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
