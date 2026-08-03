import { Toaster } from '@gravity-ui/uikit';

export const toaster = new Toaster();

export function notify(title: string, theme: 'success' | 'danger' | 'warning' = 'success'): void {
  toaster.add({ name: 'gravity-toast', title, theme });
}
