import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// CodeMirror needs real layout APIs that jsdom lacks; the viewer's test target
// is the tree/parse behaviour, so the text tab is a stub.
vi.mock('../src/components/DataTextView', () => ({
  DataTextView: ({ text }: { text: string }) => <pre data-testid="data-text">{text}</pre>,
}));

import { DataViewer } from '../src/components/DataViewer';
import { DataTreeView } from '../src/components/DataTreeView';
import type { DataViewerStatus } from '../src/utils/dataViewerLoad';
import { renderUi as render } from './render';

const onStatus = vi.fn();

function renderViewer(content: string, kind: 'json' | 'yaml' | 'toml' = 'json') {
  onStatus.mockClear();
  return render(<DataViewer content={content} kind={kind} onStatus={onStatus} />);
}

describe('DataViewer', () => {
  it('parses JSON inline and reports stats to the status bar', async () => {
    const { container } = renderViewer('{"name":"demo","items":[1,2],"nested":{"ok":true}}');

    await waitFor(() => expect(onStatus).toHaveBeenCalled());
    const status = onStatus.mock.calls.at(-1)?.[0] as DataViewerStatus;

    expect(status.valid).toBe(true);
    expect(status.label).toBe('JSON');
    expect(status.stats?.bytes).toBeGreaterThan(0);
    expect(container.querySelectorAll('.data-tree__row').length).toBeGreaterThan(4);
    expect(screen.getByText('Valid')).toBeInTheDocument();
  });

  it('shows a parse error with line and column', async () => {
    renderViewer('{\n  "a" 1\n}');

    await waitFor(() => expect(onStatus).toHaveBeenCalled());
    const status = onStatus.mock.calls.at(-1)?.[0] as DataViewerStatus;

    expect(status.valid).toBe(false);
    expect(status.error?.line).toBe(2);
    expect(screen.getByRole('alert')).toHaveTextContent(/line 2/);
    expect(screen.queryByText('Valid')).not.toBeInTheDocument();
  });

  it('filters rows by key and value', async () => {
    const user = userEvent.setup();
    const { container } = renderViewer('{"alpha":"one","beta":"two","gamma":"three"}');

    await waitFor(() => expect(container.querySelectorAll('.data-tree__row').length).toBeGreaterThan(3));

    const input = screen.getByPlaceholderText('Filter keys and values…');
    await user.type(input, 'beta');

    await waitFor(() => {
      const labels = Array.from(container.querySelectorAll('.data-tree__row')).map((row) => row.textContent);
      expect(labels.some((label) => label?.includes('beta'))).toBe(true);
      expect(labels.some((label) => label?.includes('alpha'))).toBe(false);
    });
  });

  it('switches to the text tab', async () => {
    const user = userEvent.setup();
    renderViewer('{"a":1}');

    await user.click(screen.getByRole('button', { name: 'Text' }));
    expect(await screen.findByTestId('data-text')).toHaveTextContent('{"a":1}');

    await user.click(screen.getByRole('button', { name: 'Tree' }));
    expect(screen.queryByTestId('data-text')).not.toBeInTheDocument();
  });

  it('parses YAML and TOML with their own labels', async () => {
    const yaml = renderViewer('name: demo\nitems:\n  - 1\n', 'yaml');
    await waitFor(() => expect(onStatus).toHaveBeenCalled());
    expect((onStatus.mock.calls.at(-1)?.[0] as DataViewerStatus).label).toBe('YAML');
    yaml.unmount();

    renderViewer('[app]\nport = 8080\n', 'toml');
    await waitFor(() => expect(onStatus).toHaveBeenCalled());
    expect((onStatus.mock.calls.at(-1)?.[0] as DataViewerStatus).label).toBe('TOML');
  });
});

describe('DataTreeView', () => {
  const rows = Array.from({ length: 400 }, (_, index) => ({
    id: `$.k${index}`,
    depth: index === 0 ? 0 : 1,
    label: `k${index}`,
    valueKind: 'string' as const,
    preview: `value ${index}`,
    hasChildren: false,
    childCount: 0,
    path: [`k${index}`],
  }));

  it('mounts only a window of a large tree', () => {
    const { container } = render(
      <DataTreeView rows={rows} collapsed={new Set<string>()} onToggle={() => {}} />,
    );

    const mounted = container.querySelectorAll('.data-tree__row').length;
    expect(mounted).toBeGreaterThan(0);
    expect(mounted).toBeLessThan(100);
    expect(container.querySelector('.data-tree__spacer')).toHaveStyle({ height: `${rows.length * 22}px` });
  });

  it('toggles branches and copies the JSON path', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <DataTreeView
        rows={[{ ...rows[0], id: '$', label: '$', path: [], hasChildren: true, childCount: 2 }]}
        collapsed={new Set<string>()}
        onToggle={onToggle}
      />,
    );

    const toggle = container.querySelector('.data-tree__chevron');
    expect(toggle).not.toBeNull();
    await user.click(toggle as Element);
    expect(onToggle).toHaveBeenCalledWith('$');

    // A double-click on the row copies its JSON path.
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    const row = container.querySelector('.data-tree__row') as Element;
    await user.dblClick(row);
    expect(writeText).toHaveBeenCalledWith('$');
  });

  it('scrolls to a later window', () => {
    const { container } = render(
      <DataTreeView rows={rows} collapsed={new Set<string>()} onToggle={() => {}} />,
    );

    const host = container.querySelector('.data-tree') as HTMLElement;
    host.scrollTop = 2200;
    host.dispatchEvent(new Event('scroll', { bubbles: true }));

    const labels = Array.from(container.querySelectorAll('.data-tree__row')).map((row) => row.textContent ?? '');
    expect(labels.some((label) => /k\d{2,}/.test(label))).toBe(true);
  });

  it('renders nothing for an empty document', () => {
    const { container } = render(
      <DataTreeView rows={[]} collapsed={new Set<string>()} onToggle={() => {}} />,
    );
    expect(container.querySelectorAll('.data-tree__row').length).toBe(0);
  });
});
