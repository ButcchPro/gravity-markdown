import { MARKDOWN_EXTENSIONS, VIEWABLE_EXTENSIONS } from '../types/fileKind';

/** Markdown documents (editable). Kept for the existing save/import paths. */
export const SUPPORTED_EXTENSIONS = MARKDOWN_EXTENSIONS;

export function getFileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export function isSupportedFile(path: string): boolean {
  const lower = path.toLowerCase();
  return MARKDOWN_EXTENSIONS.some((ext) => lower.endsWith(`.${ext}`));
}

/** Markdown documents plus read-only data files. */
export function isViewableFile(path: string): boolean {
  const lower = path.toLowerCase();
  return VIEWABLE_EXTENSIONS.some((ext) => lower.endsWith(`.${ext}`));
}
