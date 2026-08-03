import { useEffect, useRef, useCallback } from 'react';
import { useMarkdownEditor, MarkdownEditorView } from '@gravity-ui/markdown-editor';
import { LatexExtension } from '@gravity-ui/markdown-editor-latex-extension';
import { Mermaid } from '@gravity-ui/markdown-editor/extensions/additional/Mermaid/index.js';
import { Plugin } from 'prosemirror-state';
import { Slice } from 'prosemirror-model';
import TurndownService from 'turndown';

interface EditorWrapperProps {
  initialContent: string;
  onSave: (content: string) => void;
}

export function EditorWrapper({ initialContent, onSave }: EditorWrapperProps) {
  const editor = useMarkdownEditor({
    md: { html: false },
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

              let markdown = '\n';
              let colCount = 0;

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

                markdown += '| ' + cellTexts.join(' | ') + ' |\n';

                if (rowIndex === 0) {
                  const separator = Array.from({ length: colCount }, () => '---').join(' | ');
                  markdown += '| ' + separator + ' |\n';
                }
              });

              return markdown + '\n';
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

  return (
    <div className="editor-wrapper">
      <MarkdownEditorView editor={editor} stickyToolbar autofocus />
    </div>
  );
}
