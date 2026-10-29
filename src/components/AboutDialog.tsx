import { Dialog, Text } from '@gravity-ui/uikit';
import { openUrl } from '@tauri-apps/plugin-opener';
import { RELEASES_PAGE_URL } from '../utils/versionCheck';

const REPO_URL = 'https://github.com/ButcchPro/gravity-markdown';
const CHANGELOG_URL = `${REPO_URL}/blob/master/history.md`;
const LICENSE_URL = `${REPO_URL}/blob/master/LICENSE`;

interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
  appVersion: string;
}

export function AboutDialog({ open, onClose, appVersion }: AboutDialogProps) {
  const openExternal = (e: React.MouseEvent, url: string) => {
    e.preventDefault();
    void openUrl(url);
  };

  return (
    <Dialog open={open} onClose={onClose} hasCloseButton size="s">
      <Dialog.Body>
        <div className="about-content">
          <div className="about-title">
            GravityMD <span className="about-version">v{appVersion}</span>
          </div>
          <Text className="about-tagline" color="secondary">
            Local-first Markdown editor with format-honest Word round-trips.
          </Text>
          <div className="about-author">
            Developed by Andrey Obushev,{' '}
            <a
              href="https://openskykft.com"
              onClick={(e) => openExternal(e, 'https://openskykft.com')}
              className="about-link"
            >OpenSky Kft.</a>
          </div>
          <div className="about-based">
            Based on{' '}
            <a
              href="https://github.com/gravity-ui/markdown-editor"
              onClick={(e) => openExternal(e, 'https://github.com/gravity-ui/markdown-editor')}
              className="about-link"
            >Gravity UI Markdown Editor</a>
          </div>
          <div className="about-links">
            <a href={RELEASES_PAGE_URL} onClick={(e) => openExternal(e, RELEASES_PAGE_URL)} className="about-link">
              Releases
            </a>
            <span className="about-links-sep" aria-hidden="true">·</span>
            <a href={CHANGELOG_URL} onClick={(e) => openExternal(e, CHANGELOG_URL)} className="about-link">
              Changelog
            </a>
            <span className="about-links-sep" aria-hidden="true">·</span>
            <a href={LICENSE_URL} onClick={(e) => openExternal(e, LICENSE_URL)} className="about-link">
              MIT license
            </a>
          </div>
        </div>
      </Dialog.Body>
    </Dialog>
  );
}
