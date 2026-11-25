import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Tauri surface ──────────────────────────────────────────────────────────

const storeData = new Map<string, unknown>();
const destroy = vi.fn();
const setTitle = vi.fn(async () => {});
let closeRequested: ((event: { preventDefault: () => void }) => Promise<void>) | null = null;

vi.mock('@tauri-apps/api/app', () => ({ getVersion: async () => '1.1.1' }));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    setTitle,
    destroy,
    onCloseRequested: async (handler: (event: { preventDefault: () => void }) => Promise<void>) => {
      closeRequested = handler;
      return () => {};
    },
  }),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: async () => () => {},
}));

vi.mock('@tauri-apps/plugin-store', () => ({
  Store: {
    load: async () => ({
      get: async (key: string) => storeData.get(key),
      set: async (key: string, value: unknown) => {
        storeData.set(key, value);
      },
      save: async () => {},
    }),
  },
}));

const openDialog = vi.fn<() => Promise<string | null>>(async () => null);
const saveDialog = vi.fn<() => Promise<string | null>>(async () => null);
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: () => openDialog(),
  save: () => saveDialog(),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: async () => {} }));

const readFileContent = vi.fn<(path: string) => Promise<string>>();
// The Open dialog reads through plugin-fs, i.e. safeReadTextFile.
const safeRead = vi.fn<(path: string) => Promise<string>>(async () => '# opened\n');
vi.mock('../src/types/ipc', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/types/ipc')>();
  return {
    ...actual,
    invokeGetInitialFile: async () => null,
    invokeReadFileContent: (path: string) => readFileContent(path),
  };
});

vi.mock('../src/utils/ipc', () => ({
  safeReadTextFile: (path: string) => safeRead(path),
  safeWriteTextFile: async () => {},
  safeWriteBinaryFile: async () => {},
}));

// Network update check stays offline in tests.
vi.mock('../src/utils/versionCheck', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/utils/versionCheck')>();
  return { ...actual, fetchLatestGitHubVersion: async () => null };
});

// ── Heavy children ─────────────────────────────────────────────────────────

vi.mock('../src/components/EditorWrapper', () => ({
  EditorWrapper: ({
    onSave,
    onModeChange,
  }: {
    onSave: (value: string) => void;
    onModeChange?: (mode: string) => void;
  }) => (
    <div data-testid="editor">
      <button type="button" onClick={() => onSave('# edited\n')}>
        edit
      </button>
      <button type="button" onClick={() => onModeChange?.('markup')}>
        markup
      </button>
    </div>
  ),
}));

vi.mock('../src/components/DataTextView', () => ({
  DataTextView: ({ text }: { text: string }) => <pre data-testid="data-text">{text}</pre>,
}));

import App from '../src/App';
import { renderUi } from './render';

beforeEach(() => {
  storeData.clear();
  openDialog.mockReset().mockResolvedValue(null);
  saveDialog.mockReset().mockResolvedValue(null);
  readFileContent.mockReset().mockResolvedValue('# opened\n');
  safeRead.mockReset().mockResolvedValue('# opened\n');
  destroy.mockClear();
  setTitle.mockClear();
  closeRequested = null;
  document.title = '';
  document.body.className = '';
});

describe('App shell', () => {
  it('renders the welcome document with its status bar', async () => {
    renderUi(<App />);

    expect(await screen.findByTestId('editor')).toBeInTheDocument();
    expect(screen.getByText('Untitled')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('All changes saved');
    expect(screen.getByText(/words · WYSIWYG/)).toBeInTheDocument();
  });

  it('updates the window title and dirty state when the document changes', async () => {
    const user = userEvent.setup();
    renderUi(<App />);

    await user.click(await screen.findByRole('button', { name: 'edit' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Unsaved changes'));
    await waitFor(() => expect(document.title).toBe('• Untitled — GravityMD'));
    expect(setTitle).toHaveBeenCalledWith('Gravity Markdown — Untitled •');
  });

  it('reports the editing mode from the editor', async () => {
    const user = userEvent.setup();
    renderUi(<App />);

    await user.click(await screen.findByRole('button', { name: 'markup' }));
    await waitFor(() => expect(screen.getByText(/words · Markup/)).toBeInTheDocument());
  });

  it('opens a markdown file through the dialog and shows it', async () => {
    openDialog.mockResolvedValue('C:\\docs\\note.md');
    readFileContent.mockResolvedValue('# Opened note\n');
    safeRead.mockResolvedValue('# Opened note\n');
    const user = userEvent.setup();
    renderUi(<App />);

    await user.click(await screen.findByRole('button', { name: 'Open a Markdown file' }));

    await waitFor(() => expect(screen.getByText('note.md')).toBeInTheDocument());
    expect(safeRead).toHaveBeenCalledWith('C:\\docs\\note.md');
    expect(document.title).toBe('note.md — GravityMD');
  });

  it('switches to the read-only data surface for JSON', async () => {
    openDialog.mockResolvedValue('C:\\data\\conf.json');
    readFileContent.mockResolvedValue('{"a":1}');
    safeRead.mockResolvedValue('{"a":1}');
    const user = userEvent.setup();
    renderUi(<App />);

    await user.click(await screen.findByRole('button', { name: 'Open a Markdown file' }));

    await waitFor(() => expect(screen.getByText(/JSON · valid/)).toBeInTheDocument());
    expect(screen.queryByTestId('editor')).not.toBeInTheDocument();
    // Editing actions are gone for read-only data files.
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('saves through the dialog when the document has no file yet', async () => {
    saveDialog.mockResolvedValue('C:\\docs\\untitled.md');
    const user = userEvent.setup();
    renderUi(<App />);

    await user.click(await screen.findByRole('button', { name: 'Save' }));

    await waitFor(() => expect(saveDialog).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('untitled.md')).toBeInTheDocument());
  });

  it('toggles the theme and marks the body for solarized', async () => {
    const user = userEvent.setup();
    renderUi(<App />);

    await user.click(await screen.findByRole('button', { name: 'Switch theme (current: Dark)' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Switch theme (current: Light)' })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: 'Switch theme (current: Light)' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Switch theme (current: Solarized)' }),
      ).toBeInTheDocument(),
    );
    expect(document.body).toHaveClass('theme-solarized-light');
  });

  it('zooms with the toolbar controls', async () => {
    const user = userEvent.setup();
    renderUi(<App />);

    const slider = await screen.findByRole('slider', { name: 'Text zoom' });
    expect(slider).toHaveValue('100');

    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    await waitFor(() => expect(screen.getByRole('slider', { name: 'Text zoom' })).toHaveValue('110'));
  });

  it('opens the About dialog with the running version', async () => {
    const user = userEvent.setup();
    renderUi(<App />);

    await user.click(await screen.findByRole('button', { name: 'About GravityMD' }));
    expect(await screen.findByText('v1.1.1')).toBeInTheDocument();
  });

  it('asks to save before closing a dirty window', async () => {
    const user = userEvent.setup();
    renderUi(<App />);

    await user.click(await screen.findByRole('button', { name: 'edit' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Unsaved changes'));

    const preventDefault = vi.fn();
    await waitFor(() => expect(closeRequested).not.toBeNull());
    await closeRequested!({ preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: "Don't Save" })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: "Don't Save" }));
    await waitFor(() => expect(destroy).toHaveBeenCalledOnce());
  });

  it('closes a clean window without asking', async () => {
    renderUi(<App />);
    await waitFor(() => expect(closeRequested).not.toBeNull());

    const preventDefault = vi.fn();
    await closeRequested!({ preventDefault });

    expect(preventDefault).not.toHaveBeenCalled();
  });
});
