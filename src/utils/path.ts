export const SUPPORTED_EXTENSIONS = ['md', 'txt', 'markdown'] as const;

export function getFileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export function isSupportedFile(path: string): boolean {
  const lower = path.toLowerCase();
  return SUPPORTED_EXTENSIONS.some(ext => lower.endsWith(`.${ext}`));
}
