/** File kinds the app can open. Only `markdown` is editable. */
export type FileKind = 'markdown' | 'json' | 'jsonc' | 'json5' | 'yaml' | 'toml';

/** Data kinds are rendered by the read-only viewer. */
export type DataKind = Exclude<FileKind, 'markdown'>;

export const MARKDOWN_EXTENSIONS = ['md', 'markdown', 'txt'] as const;

export const DATA_EXTENSIONS = ['json', 'jsonc', 'json5', 'yaml', 'yml', 'toml'] as const;

/** All extensions the Open dialog may show, in display order. */
export const VIEWABLE_EXTENSIONS = [...MARKDOWN_EXTENSIONS, ...DATA_EXTENSIONS] as const;

const EXTENSION_TO_KIND: Record<string, FileKind> = {
  md: 'markdown',
  markdown: 'markdown',
  txt: 'markdown',
  json: 'json',
  jsonc: 'jsonc',
  json5: 'json5',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
};

const KIND_LABEL: Record<FileKind, string> = {
  markdown: 'Markdown',
  json: 'JSON',
  jsonc: 'JSONC',
  json5: 'JSON5',
  yaml: 'YAML',
  toml: 'TOML',
};

/** Returns the kind for a file path, or null when the extension is unknown. */
export function detectFileKind(path: string): FileKind | null {
  const name = path.split(/[\\/]/).pop() ?? path;
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return null;
  const ext = name.slice(dot + 1).toLowerCase();
  return EXTENSION_TO_KIND[ext] ?? null;
}

export function isDataKind(kind: FileKind): kind is DataKind {
  return kind !== 'markdown';
}

export function fileKindLabel(kind: FileKind): string {
  return KIND_LABEL[kind];
}
