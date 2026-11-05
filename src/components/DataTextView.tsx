import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers, keymap, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, foldGutter, foldKeymap } from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { json } from '@codemirror/lang-json';

const theme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'transparent',
    color: 'var(--g-color-text-primary)',
    fontSize: '13px',
  },
  '.cm-scroller': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    lineHeight: '1.5',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'var(--g-color-text-hint)',
    border: 'none',
    borderRight: '1px solid var(--g-color-line-generic)',
  },
  '.cm-activeLine': { backgroundColor: 'transparent' },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
    color: 'var(--g-color-text-primary)',
  },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--g-color-base-selection) !important',
  },
  '.cm-content': { caretColor: 'transparent' },
});

interface DataTextViewProps {
  text: string;
}

/** Read-only JSON/JSONC text with folding, line numbers and search. */
export function DataTextView({ text }: DataTextViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: text,
        extensions: [
          lineNumbers(),
          foldGutter(),
          highlightActiveLine(),
          json(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          highlightSelectionMatches(),
          EditorState.readOnly.of(true),
          keymap.of([...defaultKeymap, ...foldKeymap, ...searchKeymap]),
          theme,
        ],
      }),
    });
    return () => view.destroy();
  }, [text]);

  return <div className="data-text" ref={hostRef} aria-label="Data file content (read-only)" />;
}
