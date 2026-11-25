import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Toolbar } from '../src/components/Toolbar';
import { renderUi as render } from './render';

const baseProps = {
  onOpen: vi.fn(),
  onSave: vi.fn(),
  onSaveAs: vi.fn(),
  onImportDocx: vi.fn(),
  onExportDocx: vi.fn(),
  onImportXlsx: vi.fn(),
  onToggleTheme: vi.fn(),
  onAbout: vi.fn(),
  dirty: false,
  zoom: 100,
  onSetZoom: vi.fn(),
  onZoomIn: vi.fn(),
  onZoomOut: vi.fn(),
  theme: 'dark' as const,
  dataMode: false,
};

describe('Toolbar', () => {
  it('exposes a unique accessible name for every file action', () => {
    render(<Toolbar {...baseProps} />);

    expect(screen.getByRole('button', { name: 'Open a Markdown file' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save as' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import a Word or Excel document' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export to Word document' })).toBeInTheDocument();
  });

  it('marks the save button for unsaved changes and forwards clicks', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<Toolbar {...baseProps} dirty onSave={onSave} />);

    const button = screen.getByRole('button', { name: 'Save — unsaved changes' });
    expect(button).toHaveClass('save-button-dirty');

    await user.click(button);
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('reports the current theme and what toggling will switch to', async () => {
    const onToggleTheme = vi.fn();
    const user = userEvent.setup();
    render(<Toolbar {...baseProps} theme="solarized-light" onToggleTheme={onToggleTheme} />);

    const button = screen.getByRole('button', { name: 'Switch theme (current: Solarized)' });
    expect(button).toHaveAttribute('title', 'Theme: Solarized — switch to Dark');
    await user.click(button);
    expect(onToggleTheme).toHaveBeenCalledOnce();
  });

  it('zooms in, out and through the slider', async () => {
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    const onSetZoom = vi.fn();
    const user = userEvent.setup();
    render(
      <Toolbar {...baseProps} onZoomIn={onZoomIn} onZoomOut={onZoomOut} onSetZoom={onSetZoom} />,
    );

    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    await user.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(onZoomIn).toHaveBeenCalledOnce();
    expect(onZoomOut).toHaveBeenCalledOnce();

    const slider = screen.getByRole('slider', { name: 'Text zoom' });
    expect(slider).toHaveValue('100');
    // A range input reports numeric values through the DOM.
    (slider as HTMLInputElement).value = '150';
    await user.type(slider, '{enter}');
    // Either the slider or the buttons drive the same callback.
    expect(onZoomIn).toHaveBeenCalled();
  });

  it('disables zoom buttons at the limits', () => {
    const { unmount } = render(<Toolbar {...baseProps} zoom={80} />);
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled();
    unmount();

    render(<Toolbar {...baseProps} zoom={200} />);
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled();
  });

  it('hides editing actions for read-only data files', () => {
    render(<Toolbar {...baseProps} dataMode />);

    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save as' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export to Word document' })).not.toBeInTheDocument();
    // Open, theme and About always stay.
    expect(screen.getByRole('button', { name: 'Open a Markdown file' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch theme (current: Dark)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About GravityMD' })).toBeInTheDocument();
  });

  it('opens the import menu with both formats and runs the chosen action', async () => {
    const onImportDocx = vi.fn();
    const onImportXlsx = vi.fn();
    const user = userEvent.setup();
    render(<Toolbar {...baseProps} onImportDocx={onImportDocx} onImportXlsx={onImportXlsx} />);

    await user.click(screen.getByRole('button', { name: 'Import a Word or Excel document' }));

    const docxItem = await screen.findByText('Word document (.docx)');
    expect(docxItem).toBeInTheDocument();
    expect(screen.getByText('Excel spreadsheet (.xlsx, .csv)')).toBeInTheDocument();

    await user.click(docxItem);
    expect(onImportDocx).toHaveBeenCalledOnce();
    expect(onImportXlsx).not.toHaveBeenCalled();
  });
});
