import { test } from 'node:test';
import assert from 'node:assert/strict';
import './dom-env.ts';
import { renderHook } from './react-env.ts';

import { usePersistedStore, type PersistedStoreAdapter } from '../src/hooks/usePersistedStore.ts';
import { useUpdateCheck, type UpdateCheckDeps } from '../src/hooks/useUpdateCheck.ts';
import { useReplaceGuard } from '../src/hooks/useReplaceGuard.ts';
import { useZoom } from '../src/hooks/useZoom.ts';
import { useTheme } from '../src/hooks/useTheme.ts';

/** In-memory store adapter: one shared map, records saves. */
function memoryAdapter(initial: Record<string, unknown> = {}) {
  const data = new Map<string, unknown>(Object.entries(initial));
  const saves: string[] = [];
  const adapter: PersistedStoreAdapter = {
    load: async () => ({
      get: async <T>(key: string) => data.get(key) as T | undefined,
      set: async (key: string, value: unknown) => {
        data.set(key, value);
      },
      save: async () => {
        saves.push('save');
      },
    }),
  };
  return { adapter, data, saves };
}

function failingAdapter(): PersistedStoreAdapter {
  return {
    load: async () => {
      throw new Error('store unavailable');
    },
  };
}

// ── usePersistedStore ──────────────────────────────────────────────────────

test('persisted store loads a value and writes changes after load', async () => {
  const { adapter, data, saves } = memoryAdapter({ zoom: 140 });
  const hook = await renderHook(() => usePersistedStore<number>('zoom', 100, { adapter }));

  assert.equal(hook.current[0], 140);
  assert.equal(hook.current[2], true);

  await hook.act(() => hook.current[1](160));

  assert.equal(hook.current[0], 160);
  assert.equal(data.get('zoom'), 160);
  assert.ok(saves.length >= 1);
  await hook.unmount();
});

test('persisted store falls back to the default when the key is missing', async () => {
  const { adapter } = memoryAdapter();
  const hook = await renderHook(() => usePersistedStore<string>('theme', 'dark', { adapter }));

  assert.equal(hook.current[0], 'dark');
  await hook.unmount();
});

test('persisted store survives a failing backend', async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const hook = await renderHook(() =>
      usePersistedStore<string>('theme', 'light', { adapter: failingAdapter() }),
    );
    assert.equal(hook.current[0], 'light');
    assert.equal(hook.current[2], true);
    await hook.act(() => hook.current[1]('solarized-light'));
    assert.equal(hook.current[0], 'solarized-light');
    await hook.unmount();
  } finally {
    console.error = originalError;
  }
});

// ── useTheme / useZoom ─────────────────────────────────────────────────────

test('theme cycles dark → light → solarized → dark', async () => {
  const { adapter } = memoryAdapter();
  const hook = await renderHook(() => useTheme({ adapter }));

  assert.equal(hook.current.theme, 'dark');
  assert.equal(hook.current.gravityTheme, 'dark');

  await hook.act(() => hook.current.toggleTheme());
  assert.equal(hook.current.theme, 'light');

  await hook.act(() => hook.current.toggleTheme());
  assert.equal(hook.current.theme, 'solarized-light');
  // Solarized is painted by the light Gravity theme plus a body class.
  assert.equal(hook.current.gravityTheme, 'light');

  await hook.act(() => hook.current.toggleTheme());
  assert.equal(hook.current.theme, 'dark');
  await hook.unmount();
});

test('zoom clamps to the 80–200 range', async () => {
  const { adapter } = memoryAdapter();
  const hook = await renderHook(() => useZoom({ adapter }));
  assert.equal(hook.current.zoom, 100);

  for (let i = 0; i < 20; i += 1) await hook.act(() => hook.current.zoomIn());
  assert.equal(hook.current.zoom, 200);

  for (let i = 0; i < 30; i += 1) await hook.act(() => hook.current.zoomOut());
  assert.equal(hook.current.zoom, 80);
  await hook.unmount();
});

// ── useReplaceGuard ────────────────────────────────────────────────────────

test('replace guard resolves immediately for a clean document', async () => {
  const hook = await renderHook(() => useReplaceGuard(() => false));
  const decision = await hook.current.beforeReplace({ sourceName: 'a.md', allowInsert: false });
  assert.equal(decision, 'replace');
  await hook.unmount();
});

test('replace guard exposes a pending request until a decision is made', async () => {
  const hook = await renderHook(() => useReplaceGuard(() => true));

  let resolved: string | null = null;
  const promise = hook.current.beforeReplace({ sourceName: 'b.md', allowInsert: true });
  void promise.then((value) => {
    resolved = value;
  });

  await hook.act(async () => {
    await Promise.resolve();
  });
  assert.equal(hook.current.pending?.sourceName, 'b.md');
  assert.equal(hook.current.pending?.allowInsert, true);

  await hook.act(() => hook.current.decide('insert'));
  await promise;
  assert.equal(resolved, 'insert');
  assert.equal(hook.current.pending, null);
  await hook.unmount();
});

test('replace guard can cancel', async () => {
  const hook = await renderHook(() => useReplaceGuard(() => true));
  const promise = hook.current.beforeReplace({ sourceName: 'c.md', allowInsert: false });

  await hook.act(async () => {
    await Promise.resolve();
  });
  await hook.act(() => hook.current.decide('cancel'));

  assert.equal(await promise, 'cancel');
  await hook.unmount();
});

// ── useUpdateCheck ─────────────────────────────────────────────────────────

function updateDeps(overrides: Partial<UpdateCheckDeps> = {}, skipped?: string) {
  const { adapter, data } = memoryAdapter(skipped ? { skippedVersion: skipped } : {});
  const deps: UpdateCheckDeps = {
    fetchLatest: async () => '1.2.0',
    getVersion: async () => '1.1.0',
    adapter,
    ...overrides,
  };
  return { deps, data };
}

test('update check offers a newer release', async () => {
  const { deps } = updateDeps();
  const hook = await renderHook(() => useUpdateCheck(true, deps));
  assert.deepEqual(hook.current.update, { latest: '1.2.0' });
  await hook.unmount();
});

test('update check stays quiet when the running version is current', async () => {
  const { deps } = updateDeps({ fetchLatest: async () => '1.1.0' });
  const hook = await renderHook(() => useUpdateCheck(true, deps));
  assert.equal(hook.current.update, null);
  await hook.unmount();
});

test('update check stays quiet when the lookup fails', async () => {
  const { deps } = updateDeps({ fetchLatest: async () => null });
  const hook = await renderHook(() => useUpdateCheck(true, deps));
  assert.equal(hook.current.update, null);
  await hook.unmount();
});

test('update check respects a skipped version', async () => {
  const { deps } = updateDeps({}, '1.2.0');
  const hook = await renderHook(() => useUpdateCheck(true, deps));
  assert.equal(hook.current.update, null);
  await hook.unmount();
});

test('update check is skipped until enabled', async () => {
  const { deps } = updateDeps();
  const hook = await renderHook(() => useUpdateCheck(false, deps));
  assert.equal(hook.current.update, null);
  await hook.unmount();
});

test('skip and dismiss clear the offer and persist the marker', async () => {
  const { deps, data } = updateDeps();
  const hook = await renderHook(() => useUpdateCheck(true, deps));
  assert.deepEqual(hook.current.update, { latest: '1.2.0' });

  await hook.act(() => hook.current.dismiss());
  assert.equal(hook.current.update, null);

  await hook.act(async () => {
    await hook.current.skip('1.2.0');
  });
  assert.equal(data.get('skippedVersion'), '1.2.0');
  await hook.unmount();
});

test('update check swallows backend failures', async () => {
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    const { deps } = updateDeps({ adapter: failingAdapter() });
    const hook = await renderHook(() => useUpdateCheck(true, deps));
    assert.equal(hook.current.update, null);
    await hook.act(async () => {
      await hook.current.skip('1.2.0');
    });
    await hook.unmount();
  } finally {
    console.warn = originalWarn;
  }
});
