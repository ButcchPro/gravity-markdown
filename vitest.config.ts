import { defineConfig } from 'vitest/config';

/**
 * UI tests: the Node suite (`npm test`) covers logic in plain .ts files, but
 * React components need a JSX transform and a DOM. Vitest supplies both; the
 * two suites stay separate so the fast Node run keeps working unchanged.
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests-ui/**/*.test.{ts,tsx}'],
    setupFiles: ['tests-ui/setup.ts'],
    restoreMocks: true,
    css: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      reporter: ['text-summary', 'lcov'],
      reportsDirectory: 'coverage-ui',
    },
    server: {
      deps: {
        // uikit ships ESM with bare `.css` imports; inline it so Vite (not
        // Node) handles those imports and the css:false stub applies.
        inline: [/@gravity-ui\//, /@diplodoc\//],
      },
    },
  },
});
