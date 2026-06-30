import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useMarkdownEditor, MarkdownEditorView } from '@gravity-ui/markdown-editor';
import { LatexExtension } from '@gravity-ui/markdown-editor-latex-extension';
import { Mermaid } from '@gravity-ui/markdown-editor/extensions/additional/Mermaid/index.js';
import { Plugin } from 'prosemirror-state';
import { Slice } from 'prosemirror-model';
import { Button, Text, Icon, ThemeProvider, ToasterProvider, ToasterComponent, Toaster, Dialog, type Theme } from '@gravity-ui/uikit';
import { FolderOpen, FloppyDisk, FileArrowUp, Moon, Sun, ArrowDownToSquare, ArrowUpFromSquare, CircleInfo, MagnifierMinus, MagnifierPlus } from '@gravity-ui/icons';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile, readFile, writeFile } from '@tauri-apps/plugin-fs';
import { Store } from '@tauri-apps/plugin-store';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { openUrl } from '@tauri-apps/plugin-opener';
import mammoth from 'mammoth';
import TurndownService from 'turndown';
import * as XLSX from 'xlsx';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, Table, TableRow, TableCell, BorderStyle,
  ExternalHyperlink, WidthType, LevelFormat,
} from 'docx';

import './App.scss';
import './solarized-light.scss';

type AppTheme = 'dark' | 'light' | 'solarized-light';

const toaster = new Toaster();
const APP_STORE = 'app-store.json';

async function loadTheme(): Promise<AppTheme> {
  try {
    const store = await Store.load(APP_STORE);
    const val = await store.get<AppTheme>('theme');
    return val ?? 'dark';
  } catch {
    return 'dark';
  }
}

async function saveTheme(theme: AppTheme): Promise<void> {
  try {
    const store = await Store.load(APP_STORE);
    await store.set('theme', theme);
    await store.save();
  } catch (e) {
    console.error('Failed to save theme:', e);
  }
}

function EditorWrapper({ initialContent, onSave, onAbout }: { initialContent: string; onSave: (content: string) => void; onAbout: () => void }) {
  const editor = useMarkdownEditor({
    md: { html: false },
    initial: { markup: initialContent },
    wysiwygConfig: {
      extensions: (builder) => {
        builder.use(LatexExtension, { loadRuntimeScript: () => {} });
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

  const [settingsEl, setSettingsEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    onSave(editor.getValue());
    editor.on('change', () => onSave(editor.getValue()));
  }, [editor, onSave]);

  useEffect(() => {
    const find = () => {
      const el = document.querySelector('.g-md-editor-settings');
      if (el) {
        setSettingsEl(el as HTMLElement);
        return true;
      }
      return false;
    };
    if (!find()) {
      const id = setTimeout(find, 200);
      return () => clearTimeout(id);
    }
  }, []);

  return (
    <div className="editor-wrapper">
      <MarkdownEditorView editor={editor} stickyToolbar autofocus />
      {settingsEl && createPortal(
        <Button
          onClick={onAbout}
          view="flat"
          size="m"
          className="about-button"
          title="About"
          aria-label="About"
        >
          <Icon data={CircleInfo} />
        </Button>,
        settingsEl
      )}
    </div>
  );
}

export default function App() {
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [content, setContent] = useState('# Welcome to Gravity Markdown\n\nStart typing here...');
  const [currentValue, setCurrentValue] = useState(content);
  const [fileKey, setFileKey] = useState(0);
  const [theme, setTheme] = useState<AppTheme>('dark');
  const [zoom, setZoom] = useState<number>(100);
  const [ready, setReady] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [appVersion, setAppVersion] = useState('');

  const handleOpenFile = useCallback(async (path: string) => {
    try {
      if (path.toLowerCase().endsWith('.md') || path.toLowerCase().endsWith('.txt') || path.toLowerCase().endsWith('.markdown')) {
        const text = await invoke<string>('read_file_content', { path });
        setCurrentFile(path);
        setContent(text);
        setCurrentValue(text);
        setFileKey(prev => prev + 1);
        toaster.add({ name: 'open', title: `Opened: ${path.split(/[\\/]/).pop()}`, theme: 'success' });
      } else {
        toaster.add({ name: 'error', title: 'Unsupported file type', theme: 'danger' });
      }
    } catch (e) {
      console.error(e);
      toaster.add({ name: 'error', title: 'Error opening file', theme: 'danger' });
    }
  }, []);

  useEffect(() => {
    (async () => {
      const savedTheme = await loadTheme();
      setTheme(savedTheme);
      
      setReady(true);
      setAppVersion(await getVersion());

      const initialFile: string | null = await invoke('get_initial_file');
      if (initialFile) {
        handleOpenFile(initialFile);
      }
    })();
  }, [handleOpenFile]);

  useEffect(() => {
    if (ready) {
      saveTheme(theme);
    }
  }, [theme, ready]);

  const toggleTheme = () => {
    const next: AppTheme = theme === 'dark' ? 'light' : theme === 'light' ? 'solarized-light' : 'dark';
    setTheme(next);
  };

  const gravityTheme: Theme = theme === 'solarized-light' ? 'light' : theme;
  const dirty = currentValue !== content;

  const handleOpenExternal = (e: React.MouseEvent, url: string) => {
    e.preventDefault();
    openUrl(url);
  };

  const loadContent = (newContent: string, newFile: string | null = null) => {
    setCurrentFile(newFile);
    setContent(newContent);
    setCurrentValue(newContent);
    setFileKey(prev => prev + 1);
  };

  const handleOpen = async () => {
    try {
      const file = await open({
        multiple: false,
        filters: [{ name: 'Markdown', extensions: ['md', 'txt'] }]
      });
      if (file && typeof file === 'string') {
        const text = await readTextFile(file);
        loadContent(text, file);
      }
    } catch (e) {
      console.error(e);
      toaster.add({ name: 'error', title: 'Error opening file', theme: 'danger' });
    }
  };

  const handleSave = async () => {
    try {
      if (currentFile) {
        try {
          await writeTextFile(currentFile, currentValue);
        } catch {
          await invoke('write_file_content', { path: currentFile, content: currentValue });
        }
        setContent(currentValue);
        toaster.add({ name: 'save', title: 'Saved!', theme: 'success' });
      } else {
        await handleSaveAs();
      }
    } catch (e) {
      console.error(e);
      toaster.add({ name: 'error', title: 'Error saving file', theme: 'danger' });
    }
  };

  const handleSaveAs = async () => {
    try {
      const file = await save({
        filters: [{ name: 'Markdown', extensions: ['md'] }]
      });
      if (file) {
        try {
          await writeTextFile(file, currentValue);
        } catch {
          await invoke('write_file_content', { path: file, content: currentValue });
        }
        setCurrentFile(file);
        setContent(currentValue);
        toaster.add({ name: 'save', title: 'Saved!', theme: 'success' });
      }
    } catch (e) {
      console.error(e);
      toaster.add({ name: 'error', title: 'Error saving file', theme: 'danger' });
    }
  };

  const handleImportDocx = async () => {
    try {
      const file = await open({
        multiple: false,
        filters: [{ name: 'Word Document', extensions: ['docx'] }]
      });
      if (file && typeof file === 'string') {
        const data = await readFile(file);
        const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        const result = await mammoth.convertToHtml({ arrayBuffer });
        const turndownService = new TurndownService();
        const markdown = turndownService.turndown(result.value);
        if (result.messages.length > 0) {
          console.warn('DOCX import warnings:', result.messages.map(m => m.message));
        }
        loadContent(markdown, null);
        toaster.add({ name: 'import', title: 'Imported DOCX', theme: 'success' });
      }
    } catch (e) {
      console.error(e);
      toaster.add({ name: 'error', title: 'Error importing DOCX', theme: 'danger' });
    }
  };

  const handleImportXlsx = async () => {
    try {
      const file = await open({
        multiple: false,
        filters: [{ name: 'Excel Spreadsheet', extensions: ['xlsx', 'csv'] }]
      });
      if (file && typeof file === 'string') {
        const data = await readFile(file);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(ws, { header: 1 });
        const fmt = (cell: string | number | null | undefined) => String(cell ?? '');

        if (aoa.length > 0) {
          let mdTable = '\n\n| ' + aoa[0].map(fmt).join(' | ') + ' |\n';
          mdTable += '| ' + aoa[0].map(() => '---').join(' | ') + ' |\n';
          for (let i = 1; i < aoa.length; i++) {
            mdTable += '| ' + aoa[i].map(fmt).join(' | ') + ' |\n';
          }
          loadContent(currentValue + mdTable, currentFile);
          toaster.add({ name: 'import', title: 'Imported Spreadsheet', theme: 'success' });
        } else {
          toaster.add({ name: 'import', title: 'Spreadsheet is empty', theme: 'warning' });
        }
      }
    } catch (e) {
      console.error(e);
      toaster.add({ name: 'error', title: 'Error importing Spreadsheet', theme: 'danger' });
    }
  };

  function parseInline(text: string): (TextRun | ExternalHyperlink)[] {
    const runs: (TextRun | ExternalHyperlink)[] = [];
    const pattern = /\*\*(.+?)\*\*|(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g;
    let lastIdx = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      if (match.index > lastIdx) {
        runs.push(new TextRun(text.slice(lastIdx, match.index)));
      }
      if (match[1] !== undefined) {
        runs.push(new TextRun({ text: match[1], bold: true }));
      } else if (match[2] !== undefined) {
        runs.push(new TextRun({ text: match[2], italics: true }));
      } else if (match[3] !== undefined) {
        runs.push(new TextRun({ text: match[3], font: 'Courier New', shading: { fill: 'f0f0f0' } }));
      } else if (match[4] !== undefined && match[5] !== undefined) {
        runs.push(new ExternalHyperlink({ children: [new TextRun({ text: match[4], style: 'Hyperlink' })], link: match[5] }));
      }
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < text.length) {
      runs.push(new TextRun(text.slice(lastIdx)));
    }
    return runs;
  }

  const handleExportDocx = async () => {
    try {
      const file = await save({
        filters: [{ name: 'Word Document', extensions: ['docx'] }]
      });
      if (file && typeof file === 'string') {
        const children: (Paragraph | Table)[] = [];
        const lines = currentValue.split('\n');
        let i = 0;
        while (i < lines.length) {
          const line = lines[i];
          if (/^#{1,6}\s/.test(line)) {
            const level = line.match(/^(#{1,6})/)?.[1].length ?? 1;
            const headingLevels = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6];
            children.push(new Paragraph({
              children: parseInline(line.replace(/^#{1,6}\s+/, '')),
              heading: headingLevels[level - 1],
            }));
            i++;
          } else if (/^\|/.test(line.trim()) && line.trim().split('|').filter(Boolean).length > 0) {
            const tableLines: string[] = [];
            while (i < lines.length && /^\|/.test(lines[i].trim())) {
              tableLines.push(lines[i]);
              i++;
            }
            const rows = tableLines
              .filter(l => !l.trim().match(/^\|[\s-:|]+\|$/))
              .map(l => {
                const cells = l.trim().split('|');
                if (cells[0] === '') cells.shift();
                if (cells[cells.length - 1] === '') cells.pop();
                return cells.map(c => c.trim());
              });
            if (rows.length > 0) {
              const colCount = Math.max(...rows.map(r => r.length));
              children.push(new Table({
                rows: rows.map(cells => new TableRow({
                  children: Array.from({ length: colCount }, (_, ci) => new TableCell({
                    children: [new Paragraph({ children: parseInline(cells[ci] ?? '') })],
                    width: { size: Math.floor(9000 / colCount), type: WidthType.DXA },
                  })),
                })),
                width: { size: 9000, type: WidthType.DXA },
              }));
            }
          } else if (/^[-*+]\s/.test(line)) {
            children.push(new Paragraph({
              children: parseInline(line.replace(/^[-*+]\s+/, '')),
              bullet: { level: 0 },
            }));
            i++;
          } else if (/^\d+\.\s/.test(line)) {
            children.push(new Paragraph({
              children: parseInline(line.replace(/^\d+\.\s+/, '')),
              numbering: { reference: 'default-numbering', level: 0 },
            }));
            i++;
          } else if (/^>\s/.test(line)) {
            children.push(new Paragraph({
              children: parseInline(line.replace(/^>\s+/, '')).map(r =>
                r instanceof TextRun ? new TextRun({ ...r, italics: true }) : r
              ),
            }));
            i++;
          } else if (/^---+$/.test(line.trim())) {
            children.push(new Paragraph({
              children: [new TextRun({ text: '' })],
              border: { bottom: { style: BorderStyle.SINGLE, size: 1, space: 1 } },
            }));
            i++;
          } else if (line.trim() === '') {
            i++;
          } else {
            children.push(new Paragraph({ children: parseInline(line) }));
            i++;
          }
        }

        const doc = new Document({
          numbering: {
            config: [{
              reference: 'default-numbering',
              levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.START }],
            }],
          },
          sections: [{ children }],
        });
        const buffer = await Packer.toBlob(doc);
        const uint8 = new Uint8Array(await buffer.arrayBuffer());
        try {
          await writeFile(file, uint8);
        } catch (writeErr) {
          console.warn('plugin-fs writeFile failed, using Rust fallback:', writeErr);
          let binary = '';
          const chunkSize = 8192;
          for (let ci = 0; ci < uint8.length; ci += chunkSize) {
            const chunk = uint8.subarray(ci, Math.min(ci + chunkSize, uint8.length));
            binary += String.fromCharCode.apply(null, Array.from(chunk));
          }
          const base64 = btoa(binary);
          await invoke('write_file_binary', { path: file, data: base64 });
        }
        toaster.add({ name: 'export', title: 'Exported to DOCX', theme: 'success' });
      }
    } catch (e) {
      console.error('DOCX export error:', e);
      const msg = e instanceof Error ? e.message : String(e);
      toaster.add({ name: 'error', title: `Export error: ${msg}`, theme: 'danger' });
    }
  };

  if (!ready) {
    return null;
  }

  return (
    <ThemeProvider theme={gravityTheme}>
      <ToasterProvider toaster={toaster}>
        <div 
          className={`app-container${theme === 'solarized-light' ? ' theme-solarized-light' : ''}`}
          style={{ '--editor-zoom-scale': zoom / 100 } as React.CSSProperties}
        >
          <div className="toolbar">
            <Button onClick={handleOpen} view="flat" title="Open Markdown">
              <Icon data={FolderOpen} /> MD
            </Button>
            <Button onClick={handleSave} view="flat" title="Save Markdown" className={dirty ? 'save-button-dirty' : undefined}>
              <Icon data={FloppyDisk} /> MD
            </Button>
            <Button onClick={handleSaveAs} view="flat" title="Save Markdown As...">
              <Icon data={FileArrowUp} /> MD
            </Button>
            
            <div className="toolbar-divider" />
            
            <Button onClick={handleImportDocx} view="flat" title="Import Word Document">
              <Icon data={ArrowDownToSquare} /> DOCX
            </Button>
            <Button onClick={handleExportDocx} view="flat" title="Export to Word Document">
              <Icon data={ArrowUpFromSquare} /> DOCX
            </Button>
            <Button onClick={handleImportXlsx} view="flat" title="Import Excel Spreadsheet as Table">
              <Icon data={ArrowDownToSquare} /> XLSX
            </Button>

            <div className="toolbar-divider" />

            <div className="zoom-control">
              <Button 
                onClick={() => setZoom(prev => Math.max(80, prev - 10))} 
                view="flat" 
                title="Zoom Out"
                disabled={zoom <= 80}
              >
                <Icon data={MagnifierMinus} size={16} />
              </Button>
              <input 
                type="range" 
                min="80" 
                max="200" 
                step="10" 
                value={zoom} 
                onChange={(e) => setZoom(Number(e.target.value))}
                className="zoom-slider"
                title={`Text Zoom: ${zoom}%`}
              />
              <Button 
                onClick={() => setZoom(prev => Math.min(200, prev + 10))} 
                view="flat" 
                title="Zoom In"
                disabled={zoom >= 200}
              >
                <Icon data={MagnifierPlus} size={16} />
              </Button>
              <Text variant="body-1" color="secondary" className="zoom-value">
                {zoom}%
              </Text>
            </div>

            <div className="toolbar-divider" />

            <Button onClick={toggleTheme} view="flat" className="theme-toggle" title={theme}>
              <Icon data={theme === 'dark' ? Sun : theme === 'light' ? Moon : Sun} />
            </Button>
            <Text variant="body-2" color="secondary" className="file-path">
              {currentFile || 'Untitled.md'}
            </Text>
          </div>
          <div className="editor-container">
            <EditorWrapper key={fileKey} initialContent={content} onSave={setCurrentValue} onAbout={() => setAboutOpen(true)} />
          </div>
        </div>
        <Dialog open={aboutOpen} onClose={() => setAboutOpen(false)} hasCloseButton size="s">
          <Dialog.Body>
            <div className="about-content">
              <div className="about-title">GravityMD <span className="about-version">v{appVersion}</span></div>
              <div className="about-author">
                Developed by Andrey Obushev,{' '}
                <a
                  href="https://openskykft.com"
                  onClick={(e) => handleOpenExternal(e, 'https://openskykft.com')}
                  className="about-link"
                >OpenSky Kft.</a>
              </div>
              <div className="about-based">
                Based on{' '}
                <a
                  href="https://github.com/gravity-ui/markdown-editor"
                  onClick={(e) => handleOpenExternal(e, 'https://github.com/gravity-ui/markdown-editor')}
                  className="about-link"
                >Gravity UI Markdown Editor</a>
              </div>
            </div>
          </Dialog.Body>
        </Dialog>
        <ToasterComponent />
      </ToasterProvider>
    </ThemeProvider>
  );
}