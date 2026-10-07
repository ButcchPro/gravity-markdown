import { Text, Button, Dialog } from '@gravity-ui/uikit';
import { openUrl } from '@tauri-apps/plugin-opener';
import { RELEASES_PAGE_URL } from '../utils/versionCheck';

interface UpdateDialogProps {
  open: boolean;
  latest: string;
  current: string;
  /** "Skip this version" remembered via plugin-store (handled in App). */
  onSkip: () => void;
  /** Any other way of dismissing (×, Esc, overlay): asks again next start. */
  onClose: () => void;
}

export function UpdateDialog({ open, latest, current, onSkip, onClose }: UpdateDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} hasCloseButton size="s">
      <Dialog.Header caption="Update Available" />
      <Dialog.Body>
        <div className="update-dialog-body">
          <Text>
            GravityMD <span className="update-version">v{latest}</span> is available. You are running{' '}
            <span className="update-version">v{current}</span>.
          </Text>
          <Text color="secondary">
            Pick the installer for your platform on the releases page.
          </Text>
        </div>
      </Dialog.Body>
      <Dialog.Footer>
        <Button onClick={() => void openUrl(RELEASES_PAGE_URL).then(onClose)} view="action">
          Update
        </Button>
        <Button onClick={onSkip} view="flat">Skip this version</Button>
      </Dialog.Footer>
    </Dialog>
  );
}
