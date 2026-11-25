/**
 * DOCX export orchestration, separated from React and Tauri so it can be
 * tested with plain fakes: choose a path → render markdown to HTML (in the
 * caller's worker) → convert the DOM to docx → pack → write bytes.
 */
import {
  Document, Packer, AlignmentType, LevelFormat,
} from 'docx';
import { htmlToDocxChildren, parseHtmlFragment, SPACING } from './htmlToDocx.ts';

export interface ExportDocxDeps {
  /** Asks the user where to save; null means "cancelled". */
  choosePath: () => Promise<string | null>;
  /** Renders markdown to HTML (the app runs this in a Web Worker). */
  renderHtml: (markdown: string) => Promise<string>;
  /** Persists the packed document. */
  writeFile: (path: string, bytes: Uint8Array) => Promise<void>;
  notify: (message: string, theme: 'success' | 'danger') => void;
  logError?: (error: unknown) => void;
}

/** Builds the Word document for an HTML body. */
export function buildDocxDocument(htmlBody: string): Document {
  const fragment = parseHtmlFragment(htmlBody);
  const children = htmlToDocxChildren(fragment);

  return new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Calibri',
            size: 22, // 11pt
          },
          paragraph: {
            spacing: SPACING.PARAGRAPH,
          },
        },
      },
    },
    numbering: {
      config: [{
        reference: 'default-numbering',
        levels: [
          { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.START },
          { level: 1, format: LevelFormat.DECIMAL, text: '%2.', alignment: AlignmentType.START },
        ],
      }],
    },
    sections: [{
      properties: {
        page: {
          // GOST-style margins in twips (1 cm = 567 twips):
          // left 2.5 cm, right 2 cm, top 2 cm, bottom 2 cm.
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1417 },
        },
      },
      children,
    }],
  });
}

/**
 * Runs the whole export. Returns true when a file was written, false when the
 * user cancelled or the export failed (failures are reported through `notify`).
 */
export async function exportMarkdownToDocx(
  markdown: string,
  deps: ExportDocxDeps,
): Promise<boolean> {
  const path = await deps.choosePath();
  if (!path) return false;

  try {
    const htmlBody = await deps.renderHtml(markdown);
    const doc = buildDocxDocument(htmlBody);
    const blob = await Packer.toBlob(doc);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    await deps.writeFile(path, bytes);
    deps.notify('Exported to DOCX', 'success');
    return true;
  } catch (error) {
    (deps.logError ?? console.error)(error);
    const message = error instanceof Error ? error.message : String(error);
    deps.notify(`Export error: ${message}`, 'danger');
    return false;
  }
}
