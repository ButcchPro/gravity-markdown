// Sets up a jsdom window so the HTML→DOCX converter (which walks real DOM
// nodes) can be tested in plain Node.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');

const g = globalThis as unknown as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.DOMParser = dom.window.DOMParser;
g.Node = dom.window.Node;
g.HTMLElement = dom.window.HTMLElement;
g.Element = dom.window.Element;
g.NodeList = dom.window.NodeList;

export const domDocument = dom.window.document;

// jsdom lacks a few browser APIs the components use.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
g.ResizeObserver = ResizeObserverStub;

const clipboard = {
  text: '',
  writeText: async (value: string) => {
    clipboard.text = value;
  },
};
Object.defineProperty(dom.window.navigator, 'clipboard', {
  value: clipboard,
  configurable: true,
});
export const clipboardStub = clipboard;

/** Parses an HTML fragment into a detached container for the converter. */
export function html(markup: string): HTMLElement {
  const container = dom.window.document.createElement('div');
  container.innerHTML = markup;
  return container as unknown as HTMLElement;
}
