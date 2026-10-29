import { useEffect, useRef, useCallback, useImperativeHandle, type Ref } from 'react';
import { useMarkdownEditor, MarkdownEditorView } from '@gravity-ui/markdown-editor';
import type { MarkdownEditorMode } from '@gravity-ui/markdown-editor';
import { LatexExtension } from '@gravity-ui/markdown-editor-latex-extension';
import { Mermaid } from '@gravity-ui/markdown-editor/extensions/additional/Mermaid/index.js';
import { applyTablePasteExtensions } from '../editor/tablePaste';
import { sanitizeYfmTables, type YfmConversionResult } from '../utils/yfmTable';

export interface EditorHandle {
  /**
   * Reads the freshest editor markup and replaces all losslessly
   * convertible YFM tables (#| ... |#) with standard pipe tables,
   * keeping the editor content in sync with the returned value so the
   * dirty flag matches what the caller is about to persist.
   */
  sanitizeForSave: () => YfmConversionResult;
  /** Inserts markdown at the caret (DOCX import → "Insert at cursor"). */
  insertMarkup: (markup: string) => void;
}

interface EditorWrapperProps {
  initialContent: string;
  onSave: (content: string) => void;
  /** Reports the active editing mode for the status bar. */
  onModeChange?: (mode: MarkdownEditorMode) => void;
  ref?: Ref<EditorHandle>;
}

export function EditorWrapper({ initialContent, onSave, onModeChange, ref }: EditorWrapperProps) {
  const editor = useMarkdownEditor({
    md: { html: true },
    initial: { markup: initialContent },
    wysiwygConfig: {
      extensions: (builder) => {
        builder.use(LatexExtension, {
          loadRuntimeScript: () => {
            import('@diplodoc/latex-extension/runtime');
            import('@diplodoc/latex-extension/runtime/styles');
          },
        });
        builder.use(Mermaid, { loadRuntimeScript: () => {} });
        applyTablePasteExtensions(builder);
      }
    }
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const debouncedSave = useCallback((value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSave(value), 300);
  }, [onSave]);

  useEffect(() => {
    const handler = () => debouncedSave(editor.getValue());
    editor.on('change', handler);
    return () => {
      editor.off('change', handler);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [editor, debouncedSave]);

  // Editing mode is part of the document's state: the status bar names it.
  useEffect(() => {
    onModeChange?.(editor.currentMode);
    const handler = (payload: { mode: MarkdownEditorMode }) => onModeChange?.(payload.mode);
    editor.on('change-editor-mode', handler);
    return () => {
      editor.off('change-editor-mode', handler);
    };
  }, [editor, onModeChange]);

  // The imperative handle exists so save flows (Save / Save As / close dialog)
  // always read the freshest markup straight from the editor, not the
  // debounced React state. Side effects (warnings about kept tables) belong
  // to the save flow — this method only reports them in its result.
  const sanitizeForSave = useCallback((): YfmConversionResult => {
    const current = editor.getValue();
    if (!current.includes('#|')) {
      return { value: current, converted: 0, kept: 0 };
    }
    const sanitized = sanitizeYfmTables(current);
    if (sanitized.converted > 0) {
      editor.replace(sanitized.value); // keeps the editor in sync with the saved content
    }
    return sanitized;
  }, [editor]);

  const insertMarkup = useCallback((markup: string) => {
    editor.insert(markup);
  }, [editor]);

  useImperativeHandle(ref, () => ({ sanitizeForSave, insertMarkup }), [sanitizeForSave, insertMarkup]);

  // Keyboard escape from the editing surface: ProseMirror/CodeMirror consume
  // Tab and keep the focus trapped, so Esc returns to the app toolbar — the
  // documented way out for keyboard-only users (WCAG 2.1.2).
  const handleEditorKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.ProseMirror, .cm-editor')) return;
    event.preventDefault();
    (document.activeElement as HTMLElement | null)?.blur();
    document.querySelector<HTMLElement>('.toolbar button')?.focus();
  }, []);

  return (
    <div className="editor-wrapper" onKeyDownCapture={handleEditorKeyDown}>
      <MarkdownEditorView editor={editor} stickyToolbar autofocus />
    </div>
  );
}
