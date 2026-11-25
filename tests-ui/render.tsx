import type { ReactElement } from 'react';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { ThemeProvider } from '@gravity-ui/uikit';

/**
 * Gravity UI portals (dialogs, popovers) require a ThemeProvider ancestor —
 * the real app has one at the root, so tests wrap the same way.
 */
export function renderUi(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>): RenderResult {
  return render(ui, {
    wrapper: ({ children }) => <ThemeProvider theme="dark">{children}</ThemeProvider>,
    ...options,
  });
}
