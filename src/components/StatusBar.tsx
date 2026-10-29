import { Text } from '@gravity-ui/uikit';

interface StatusBarProps {
  fileName: string;
  filePath: string | null;
  dirty: boolean;
  words: number;
  /** Human-readable editing mode: WYSIWYG / Markup / Split. */
  mode: string;
}

/**
 * The app's document identity strip: which file, whether it is saved, and how
 * much is in it. This is the desktop-document answer to "what am I editing and
 * is my work safe?" — previously the window had no such surface at all.
 */
export function StatusBar({ fileName, filePath, dirty, words, mode }: StatusBarProps) {
  const parent = filePath ? filePath.split(/[\\/]/).slice(0, -1).join('\\') : '';

  return (
    <footer className="status-bar">
      <span className="status-file" title={filePath ?? 'Not saved to disk yet'}>
        <span className="status-file-name">{fileName}</span>
        {parent && <span className="status-file-path">{parent}</span>}
      </span>
      <span
        className={`status-state${dirty ? ' status-state--dirty' : ''}`}
        role="status"
        aria-live="polite"
      >
        <span className="status-state-dot" aria-hidden="true" />
        {dirty ? 'Unsaved changes' : 'All changes saved'}
      </span>
      <Text className="status-meta" as="span">
        {words.toLocaleString('en-US')} {words === 1 ? 'word' : 'words'} · {mode}
      </Text>
    </footer>
  );
}
