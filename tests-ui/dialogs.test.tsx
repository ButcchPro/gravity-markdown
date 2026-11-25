import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderUi as render } from './render';
import userEvent from '@testing-library/user-event';

import { StatusBar } from '../src/components/StatusBar';
import { ConfirmDialog } from '../src/components/ConfirmDialog';
import { UnsavedChangesDialog } from '../src/components/UnsavedChangesDialog';
import { AboutDialog } from '../src/components/AboutDialog';
import { UpdateDialog } from '../src/components/UpdateDialog';
import { ErrorBoundary } from '../src/ErrorBoundary';

describe('StatusBar', () => {
  it('shows the file name, parent path and saved state', () => {
    render(
      <StatusBar
        fileName="note.md"
        filePath={'C:\\docs\\note.md'}
        words={12}
        mode="WYSIWYG"
      />,
    );

    expect(screen.getByText('note.md')).toBeInTheDocument();
    expect(screen.getByText('C:\\docs')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('All changes saved');
    expect(screen.getByText('12 words · WYSIWYG')).toBeInTheDocument();
  });

  it('flags unsaved changes and singular word counts', () => {
    render(<StatusBar fileName="a.md" filePath={null} dirty words={1} mode="Markup" />);

    expect(screen.getByRole('status')).toHaveTextContent('Unsaved changes');
    expect(screen.getByRole('status')).toHaveClass('status-state--dirty');
    expect(screen.getByText('1 word · Markup')).toBeInTheDocument();
    // No path yet: the tooltip explains it and the path block is absent.
    expect(screen.getByTitle('Not saved to disk yet')).toBeInTheDocument();
  });

  it('replaces the word count with data metadata and hides state for data files', () => {
    render(
      <StatusBar
        fileName="data.json"
        filePath="C:\\data\\data.json"
        words={0}
        mode="Tree"
        dataMeta="JSON · valid · 42 B"
      />,
    );

    expect(screen.getByText('JSON · valid · 42 B')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('ConfirmDialog', () => {
  it('renders actions and reports the chosen key', async () => {
    const onAction = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        open
        caption="Replace document?"
        actions={[
          { key: 'replace', label: 'Replace document', view: 'action' },
          { key: 'insert', label: 'Insert at cursor' },
          { key: 'cancel', label: 'Cancel' },
        ]}
        onAction={onAction}
        onClose={onClose}
      >
        <p>Body</p>
      </ConfirmDialog>,
    );

    expect(screen.getByText('Replace document?')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Insert at cursor' }));
    expect(onAction).toHaveBeenCalledWith('insert');

    // uikit keeps an off-screen copy during the close animation.
    await user.click(screen.getAllByRole('button', { name: 'Cancel' })[0]);
    expect(onAction).toHaveBeenCalledWith('cancel');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders nothing while closed', () => {
    render(
      <ConfirmDialog open={false} caption="Hidden" actions={[]} onAction={vi.fn()} onClose={vi.fn()}>
        <p>Body</p>
      </ConfirmDialog>,
    );
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });
});

describe('UnsavedChangesDialog', () => {
  it('offers save, discard and cancel', async () => {
    const onSave = vi.fn();
    const onDontSave = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();

    render(
      <UnsavedChangesDialog
        open
        fileName="draft.md"
        onSave={onSave}
        onDontSave={onDontSave}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByText(/Do you want to save the changes to/)).toHaveTextContent('draft.md');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(screen.getByRole('button', { name: "Don't Save" }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onSave).toHaveBeenCalledOnce();
    expect(onDontSave).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

describe('AboutDialog', () => {
  it('shows the running version and project links', () => {
    render(<AboutDialog open onClose={vi.fn()} appVersion="1.1.1" />);

    expect(screen.getByText('v1.1.1')).toBeInTheDocument();
    expect(screen.getByText(/Local-first Markdown editor/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'OpenSky Kft.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Gravity UI Markdown Editor/ })).toBeInTheDocument();
  });
});

describe('UpdateDialog', () => {
  it('shows both versions and calls skip', async () => {
    const onSkip = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<UpdateDialog open latest="1.2.0" current="1.1.1" onSkip={onSkip} onClose={onClose} />);

    expect(screen.getByText('v1.2.0')).toBeInTheDocument();
    expect(screen.getByText('v1.1.1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Skip this version' }));
    expect(onSkip).toHaveBeenCalledOnce();
  });
});

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>healthy</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('healthy')).toBeInTheDocument();
  });

  it('renders the fallback with the error message', () => {
    const originalError = console.error;
    console.error = () => {};
    try {
      const Boom = () => {
        throw new Error('kaboom');
      };
      render(
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>,
      );

      expect(screen.getByText('Something went wrong.')).toBeInTheDocument();
      expect(screen.getByText('kaboom')).toBeInTheDocument();
    } finally {
      console.error = originalError;
    }
  });
});
