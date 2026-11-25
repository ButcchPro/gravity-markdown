import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createRef } from 'react';
import { render, waitFor } from '@testing-library/react';
import { act } from 'react';

// The real editor is a heavy ProseMirror bundle; these tests target the glue
// around it (save normalisation, debounced stream, mode reporting, imports).
const editorInstance = {
  getValue: vi.fn<() => string>(() => '# initial\n'),
  replace: vi.fn(),
  insert: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  currentMode: 'wysiwyg' as const,
};

vi.mock('@gravity-ui/markdown-editor', () => ({
  useMarkdownEditor: () => editorInstance,
  MarkdownEditorView: () => <div data-testid="markdown-editor-view" />,
}));

vi.mock('@gravity-ui/markdown-editor-latex-extension', () => ({
  LatexExtension: () => null,
}));

vi.mock('@gravity-ui/markdown-editor/extensions/additional/Mermaid/index.js', () => ({
  Mermaid: () => null,
}));

import { EditorWrapper, type EditorHandle } from '../src/components/EditorWrapper';

function setup(initialContent = '# initial\n') {
  const onSave = vi.fn();
  const onModeChange = vi.fn();
  const ref = createRef<EditorHandle>();

  const utils = render(
    <EditorWrapper
      initialContent={initialContent}
      onSave={onSave}
      onModeChange={onModeChange}
      ref={ref}
    />,
  );

  return { ...utils, onSave, onModeChange, ref };
}

beforeEach(() => {
  editorInstance.getValue.mockReset().mockReturnValue('# initial\n');
  editorInstance.replace.mockReset();
  editorInstance.insert.mockReset();
  editorInstance.on.mockReset();
  editorInstance.off.mockReset();
  editorInstance.currentMode = 'wysiwyg';
});

describe('EditorWrapper', () => {
  it('mounts the editor view', () => {
    const { getByTestId } = setup();
    expect(getByTestId('markdown-editor-view')).toBeInTheDocument();
  });

  it('reports the current mode on mount', () => {
    const { onModeChange } = setup();
    expect(onModeChange).toHaveBeenCalledWith('wysiwyg');
  });

  it('subscribes to change and mode events and unsubscribes on unmount', () => {
    const { unmount } = setup();

    const events = editorInstance.on.mock.calls.map(([name]) => name);
    expect(events).toContain('change');
    expect(events).toContain('change-editor-mode');

    unmount();
    const offEvents = editorInstance.off.mock.calls.map(([name]) => name);
    expect(offEvents).toContain('change');
    expect(offEvents).toContain('change-editor-mode');
  });

  it('canonicalises pipe tables in the debounced change stream', async () => {
    const { onSave } = setup();
    editorInstance.getValue.mockReturnValue('|A|B|\n|:---|:---|\n||\n');

    const handler = editorInstance.on.mock.calls.find(([name]) => name === 'change')?.[1] as
      | (() => void)
      | undefined;
    expect(handler).toBeTypeOf('function');

    act(() => handler?.());

    await waitFor(() => expect(onSave).toHaveBeenCalledWith('| A | B |\n| --- | --- |\n'));
  });

  it('sanitizeForSave converts lossless YFM tables and keeps the editor in sync', () => {
    const { ref } = setup();
    editorInstance.getValue.mockReturnValue('# T\n\n#|\n|| A | B ||\n|| 1 | 2 ||\n|#\n');
    // After the swap the editor holds the canonical pipe table.
    editorInstance.replace.mockImplementation(() => {
      editorInstance.getValue.mockReturnValue('| A | B |\n| --- | --- |\n| 1 | 2 |\n');
    });

    const result = ref.current!.sanitizeForSave();

    expect(result.converted).toBe(1);
    expect(result.kept).toBe(0);
    expect(editorInstance.replace).toHaveBeenCalledOnce();
    expect(result.value).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |\n');
  });

  it('sanitizeForSave keeps span tables and reports them', () => {
    const { ref } = setup();
    const yfm = '# T\n\n#|\n|| A | B | C |\n|| span ||\n|| x | y | z |\n|#\n';
    editorInstance.getValue.mockReturnValue(yfm);

    const result = ref.current!.sanitizeForSave();

    expect(result.kept).toBe(1);
    expect(result.converted).toBe(0);
    expect(editorInstance.replace).not.toHaveBeenCalled();
    expect(result.value).toContain('#|');
  });

  it('sanitizeForSave canonicalises a document without YFM tables', () => {
    const { ref } = setup();
    editorInstance.getValue.mockReturnValue('|A|B|\n|:---|:---|\n|1|2|\n');

    const result = ref.current!.sanitizeForSave();

    expect(result.converted).toBe(0);
    expect(result.value).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |\n');
  });

  it('setSettledValue waits a frame and returns canonical markup', async () => {
    const { ref } = setup();
    editorInstance.getValue.mockReturnValue('|A|B|\n|:---|:---|\n');

    const value = await ref.current!.getSettledValue();

    expect(value).toBe('| A | B |\n| --- | --- |\n');
  });

  it('insertMarkup forwards to the editor', () => {
    const { ref } = setup();
    ref.current!.insertMarkup('# from docx');
    expect(editorInstance.insert).toHaveBeenCalledWith('# from docx');
  });
});
