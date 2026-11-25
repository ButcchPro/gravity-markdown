import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom lacks ResizeObserver (used by the JSON tree) and matchMedia (uikit).
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

Object.defineProperty(navigator, 'clipboard', {
  value: {
    text: '',
    writeText: async (value: string) => {
      (navigator.clipboard as unknown as { text: string }).text = value;
    },
  },
  configurable: true,
});

afterEach(() => {
  cleanup();
});
