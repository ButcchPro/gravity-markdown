import { useEffect, useRef, useCallback, useImperativeHandle, type Ref } from 'react';
import { useMarkdownEditor, MarkdownEditorView } from '@gravity-ui/markdown-editor';
import { LatexExtension } from '@gravity-ui/markdown-editor-latex-extension';
import { Mermaid } from '@gravity-ui/markdown-editor/extensions/additional/Mermaid/index.js';
import { Plugin } from 'prosemirror-state';
import { Slice } from 'prosemirror-model';
import TurndownService from 'turndown';
import { rowsToPipeTable } from '../utils/pipeTable';
import { sanitizeYfmTables, type YfmConversionResult } from '../utils/yfmTable';

export interface EditorHandle {
  /**
   * Reads the freshest editor markup and replaces all losslessly
   * convertible YFM tables (#| ... |#) with standard pipe tables,
   * keeping the editor content in sync with the returned value so the
   * dirty flag matches what the caller is about to persist.
   */
  sanitizeForSave: () => YfmConversionResult;
}

interface EditorWrapperProps {
  initialContent: string;
  onSave: (content: string) => void;
  ref?: Ref<EditorHandle>;
}

export function EditorWrapper({ initialContent, onSave, ref }: EditorWrapperProps) {
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

        // Custom plugin to intercept HTML paste containing tables and convert them to Markdown tables
        builder.addPlugin((deps) => {
          const turndownService = new TurndownService();
          turndownService.addRule('table', {
            filter: 'table',
            replacement: (_content, node) => {
              const table = node as HTMLTableElement;
              const rows = Array.from(table.querySelectorAll('tr'));
              if (rows.length === 0) return '';

              let colCount = 0;
              const rowsData: string[][] = [];
              rows.forEach((row, rowIndex) => {
                const cells = Array.from(row.querySelectorAll('th, td'));
                if (cells.length === 0) return;

                if (rowIndex === 0) {
                  colCount = cells.length;
                }

                const cellTexts = cells.map(cell => {
                  return cell.textContent?.replace(/\r?\n/g, ' ').trim() || '';
                });

                while (cellTexts.length < colCount) {
                  cellTexts.push('');
                }
                if (cellTexts.length > colCount && rowIndex === 0) {
                  colCount = cellTexts.length;
                }
                rowsData.push(cellTexts);
              });

              if (rowsData.length === 0 || rowsData[0].length === 0) return '';
              const [header, ...data] = rowsData;
              return '\n' + rowsToPipeTable(header, data) + '\n';
            }
          });

          return new Plugin({
            props: {
              handlePaste(view, event) {
                if (!event.clipboardData) return false;

                const html = event.clipboardData.getData('text/html');
                if (html && /<table[^>]*>/i.test(html)) {
                  try {
                    const markdown = turndownService.turndown(html);
                    if (markdown && markdown.trim()) {
                      const docNode = deps.markupParser.parse(markdown);
                      const slice = new Slice(docNode.content, 0, 0);
                      view.dispatch(view.state.tr.replaceSelection(slice));
                      return true; // Intercepted and handled!
                    }
                  } catch (err) {
                    console.error('Failed to convert HTML table on paste:', err);
                  }
                }
                return false;
              }
            }
          });
        });

        // Fix table cell pasting: allow th and td without cell-align attribute, and parse alignment
        builder.overrideNodeSpec('th', (spec) => {
          return {
            ...spec,
            parseDOM: [
              {
                tag: 'th',
                getAttrs: (dom) => {
                  const el = dom as HTMLElement;
                  let align = el.getAttribute('cell-align') || el.getAttribute('align');
                  if (!align && el.style && el.style.textAlign) {
                    align = el.style.textAlign;
                  }
                  return {
                    'cell-align': align === 'center' || align === 'right' ? align : 'left',
                  };
                },
              },
            ],
          };
        });

        builder.overrideNodeSpec('td', (spec) => {
          return {
            ...spec,
            parseDOM: [
              {
                tag: 'td',
                getAttrs: (dom) => {
                  const el = dom as HTMLElement;
                  let align = el.getAttribute('cell-align') || el.getAttribute('align');
                  if (!align && el.style && el.style.textAlign) {
                    align = el.style.textAlign;
                  }
                  return {
                    'cell-align': align === 'center' || align === 'right' ? align : 'left',
                  };
                },
              },
            ],
          };
        });
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

  useImperativeHandle(ref, () => ({ sanitizeForSave }), [sanitizeForSave]);

  return (
    <div className="editor-wrapper">
      <MarkdownEditorView editor={editor} stickyToolbar autofocus />
    </div>
  );
}
