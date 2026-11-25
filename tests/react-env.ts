// Minimal React render harness for hook tests: renders a probe component in a
// jsdom container and exposes the latest hook result.
import { act, createElement, type FC, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { domDocument } from './dom-env.ts';

const g = globalThis as unknown as Record<string, unknown>;
g.IS_REACT_ACT_ENVIRONMENT = true;

export interface HookHarness<T> {
  /** Latest value returned by the hook. */
  current: T;
  /** Applies an update inside act(). */
  act: (fn: () => void | Promise<void>) => Promise<void>;
  /** Unmounts the probe. */
  unmount: () => Promise<void>;
}

/** Mounts an arbitrary element and returns its container. */
export async function renderComponent(element: ReactElement): Promise<{
  container: HTMLElement;
  act: (fn: () => void | Promise<void>) => Promise<void>;
  unmount: () => Promise<void>;
}> {
  const container = domDocument.createElement('div');
  domDocument.body.appendChild(container);

  let root: Root;
  await act(async () => {
    root = createRoot(container);
    root.render(element);
  });

  return {
    container,
    act: async (fn) => {
      await act(async () => {
        await fn();
      });
    },
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

/**
 * Mounts a component that calls `useHook` and keeps its result in `current`.
 * The probe re-renders on every state change, so `current` always reflects the
 * newest hook output after `act()` resolves.
 */
export async function renderHook<T>(useHook: () => T): Promise<HookHarness<T>> {
  const container = domDocument.createElement('div');
  domDocument.body.appendChild(container);

  const harness = {
    current: undefined as unknown as T,
  } as HookHarness<T>;

  const Probe: FC = () => {
    harness.current = useHook();
    return null;
  };

  let root: Root;
  await act(async () => {
    root = createRoot(container);
    root.render(createElement(Probe));
  });

  // Let pending microtasks (store loads, fetches) settle.
  await act(async () => {
    await Promise.resolve();
  });

  harness.act = async (fn) => {
    await act(async () => {
      await fn();
    });
  };

  harness.unmount = async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  };

  return harness;
}
