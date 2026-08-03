import { Dialog } from '@gravity-ui/uikit';
import { openUrl } from '@tauri-apps/plugin-opener';

interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
  appVersion: string;
}

export function AboutDialog({ open, onClose, appVersion }: AboutDialogProps) {
  const handleOpenExternal = (e: React.MouseEvent, url: string) => {
    e.preventDefault();
    openUrl(url);
  };

  return (
    <Dialog open={open} onClose={onClose} hasCloseButton size="s">
      <Dialog.Body>
        <div className="about-content">
          <div className="about-title">GravityMD <span className="about-version">v{appVersion}</span></div>
          <div className="about-author">
            Developed by Andrey Obushev,{' '}
            <a
              href="https://openskykft.com"
              onClick={(e) => handleOpenExternal(e, 'https://openskykft.com')}
              className="about-link"
            >OpenSky Kft.</a>
          </div>
          <div className="about-based">
            Based on{' '}
            <a
              href="https://github.com/gravity-ui/markdown-editor"
              onClick={(e) => handleOpenExternal(e, 'https://github.com/gravity-ui/markdown-editor')}
              className="about-link"
            >Gravity UI Markdown Editor</a>
          </div>
        </div>
      </Dialog.Body>
    </Dialog>
  );
}
