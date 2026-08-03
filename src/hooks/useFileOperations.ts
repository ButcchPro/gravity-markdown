import { useState, useCallback } from 'react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { safeReadTextFile, safeWriteTextFile } from '../utils/ipc';
import { getFileName, isSupportedFile, SUPPORTED_EXTENSIONS } from '../utils/path';
import { notify } from '../utils/notify';
import { invokeReadFileContent } from '../types/ipc';

export function useFileOperations() {
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [content, setContent] = useState('# Welcome to Gravity Markdown\n\nStart typing here...');
  const [currentValue, setCurrentValue] = useState(content);
  const [fileKey, setFileKey] = useState(0);

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
        notify('Unsupported file type', 'danger');
        return;
      }
      const text = await invokeReadFileContent(path);
      loadContent(text, path, true);
    } catch (e) {
      console.error(e);
      notify('Error opening file', 'danger');
    }
  }, [loadContent]);

  const handleOpen = useCallback(async () => {
    try {
      const file = await open({
        multiple: false,
        filters: [{ name: 'Markdown', extensions: [...SUPPORTED_EXTENSIONS] }],
      });
      if (file && typeof file === 'string') {
        const text = await safeReadTextFile(file);
        loadContent(text, file, true);
      }
    } catch (e) {
      console.error(e);
      notify('Error opening file', 'danger');
    }
  }, [loadContent]);

  const handleSave = useCallback(async () => {
    try {
      if (currentFile) {
        await safeWriteTextFile(currentFile, currentValue);
        setContent(currentValue);
        notify('Saved!', 'success');
      }
    } catch (e) {
      console.error(e);
      notify('Error saving file', 'danger');
    }
  }, [currentFile, currentValue]);

  const handleSaveAs = useCallback(async () => {
    try {
      const file = await save({
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      });
      if (file) {
        await safeWriteTextFile(file, currentValue);
        setCurrentFile(file);
        setContent(currentValue);
        notify('Saved!', 'success');
      }
    } catch (e) {
      console.error(e);
      notify('Error saving file', 'danger');
    }
  }, [currentValue]);

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
