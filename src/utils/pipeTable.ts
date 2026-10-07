/**
 * Single serializer for standard markdown pipe tables.
 * All table producers (XLSX import, HTML-table paste, YFM conversion)
 * must go through it so escaping and column handling stay consistent.
 */
export function rowsToPipeTable(header: string[], dataRows: string[][]): string {
  const escape = (cell: string) => cell.replace(/\|/g, '\\|');
  const line = (cells: string[]) => `| ${cells.map(escape).join(' | ')} |`;
  const separator = `| ${header.map(() => '---').join(' | ')} |`;
  return [line(header), separator, ...dataRows.map(line)].join('\n');
}
