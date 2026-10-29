import type { ReactNode } from 'react';
import { Button, Dialog } from '@gravity-ui/uikit';

export interface ConfirmDialogAction {
  key: string;
  label: string;
  /** Gravity UI button view; defaults to flat. */
  view?: 'action' | 'normal' | 'flat' | 'outlined';
  /** Renders with the danger token (destructive outcome). */
  danger?: boolean;
}

interface ConfirmDialogProps {
  open: boolean;
  caption: string;
  children: ReactNode;
  actions: ConfirmDialogAction[];
  onAction: (key: string) => void;
  /** Esc / overlay / × — always treated as "cancel". */
  onClose: () => void;
}

/**
 * Small confirm dialog for destructive document operations. Unlike a native
 * message box it can carry more than two outcomes (replace / insert / cancel)
 * and follows the app theme, including solarized.
 */
export function ConfirmDialog({ open, caption, children, actions, onAction, onClose }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} hasCloseButton={false} size="s">
      <Dialog.Header caption={caption} />
      <Dialog.Body>
        <div className="confirm-dialog-body">{children}</div>
      </Dialog.Body>
      <Dialog.Footer>
        {actions.map((action) => (
          <Button
            key={action.key}
            view={action.view ?? 'flat'}
            className={action.danger ? 'dialog-danger-button' : undefined}
            onClick={() => onAction(action.key)}
          >
            {action.label}
          </Button>
        ))}
        <Button view="flat" onClick={onClose}>Cancel</Button>
      </Dialog.Footer>
    </Dialog>
  );
}
