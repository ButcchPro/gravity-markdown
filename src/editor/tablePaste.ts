/**
 * HTML-table paste support for the Gravity Markdown editor.
 *
 * 1. A ProseMirror plugin intercepts pastes containing <table> HTML and
 *    converts them into standard Markdown pipe tables (turndown rule) that
 *    the editor's Markdown parser accepts.
 * 2. The editor's th/td node specs are overridden: stock specs reject cells
 *    without the proprietary `cell-align` attribute (breaking most pasted
 *    HTML tables) and require a strict thead/tbody model. The override
 *    falls back to standard align attributes / style.textAlign.
 */
import type { ExtensionBuilder } from '@gravity-ui/markdown-editor';
import { Plugin } from 'prosemirror-state';
import { Slice } from 'prosemirror-model';
import TurndownService from 'turndown';
import { rowsToPipeTable } from '../utils/pipeTable';

/** Cell texts of an HTML table converted to pipe-table rows. */
function htmlTableToPipeTable(table: HTMLTableElement): string {
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

/** parseDOM rule shared by th and td: honor standard alignment metadata.
 * The dom parameter carries the prosemirror ParseRule signature
 * (HTMLElement | string); the string variant never matches the tag filter. */
function cellParseDOM(tag: 'th' | 'td') {
  return [
    {
      tag,
      getAttrs: (dom: HTMLElement | string) => {
        const el = dom as HTMLElement;
        let align = el.getAttribute?.('cell-align') || el.getAttribute?.('align');
        if (!align && el.style && el.style.textAlign) {
          align = el.style.textAlign;
        }
        return {
          'cell-align': align === 'center' || align === 'right' ? align : 'left',
        };
      },
    },
  ];
}

export function applyTablePasteExtensions(builder: ExtensionBuilder): void {
  builder.addPlugin((deps) => {
    const turndownService = new TurndownService();
    turndownService.addRule('table', {
      filter: 'table',
      replacement: (_content, node) => htmlTableToPipeTable(node as HTMLTableElement),
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
  builder.overrideNodeSpec('th', (spec) => ({
    ...spec,
    parseDOM: cellParseDOM('th'),
  }));

  builder.overrideNodeSpec('td', (spec) => ({
    ...spec,
    parseDOM: cellParseDOM('td'),
  }));
}
