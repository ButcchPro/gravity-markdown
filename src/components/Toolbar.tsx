import { Button, Text, Icon, DropdownMenu } from '@gravity-ui/uikit';
import {
  FolderOpen, FloppyDisk, FileArrowUp, Moon, Sun, Palette,
  ArrowDownToSquare, ArrowUpFromSquare, CircleInfo,
  MagnifierMinus, MagnifierPlus, ChevronDown,
} from '@gravity-ui/icons';
import type { AppTheme } from '../hooks/useTheme';

interface ToolbarProps {
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onImportDocx: () => void;
  onExportDocx: () => void;
  onImportXlsx: () => void;
  onToggleTheme: () => void;
  onAbout: () => void;
  dirty: boolean;
  zoom: number;
  onSetZoom: (zoom: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  theme: AppTheme;
}

const THEME_LABEL: Record<AppTheme, string> = {
  dark: 'Dark',
  light: 'Light',
  'solarized-light': 'Solarized',
};

const NEXT_THEME: Record<AppTheme, string> = {
  dark: 'Light',
  light: 'Solarized',
  'solarized-light': 'Dark',
};

/**
 * File operations speak verbs, not extensions: "Open / Save / Save as" and
 * "Import / Export" replace the old "MD MD MD DOCX DOCX XLSX" row. Each
 * control also has a unique accessible name — the visible labels used to be
 * three identical "MD" buttons in the accessibility tree.
 */
export function Toolbar({
  onOpen, onSave, onSaveAs,
  onImportDocx, onExportDocx, onImportXlsx,
  onToggleTheme, onAbout,
  dirty, zoom, onSetZoom, onZoomIn, onZoomOut,
  theme,
}: ToolbarProps) {
  return (
    <header className="toolbar">
      <Button onClick={onOpen} view="flat" title="Open a Markdown file…" aria-label="Open a Markdown file">
        <Icon data={FolderOpen} /><span className="toolbar-label">Open</span>
      </Button>
      <Button
        onClick={onSave}
        view="flat"
        title={dirty ? 'Save (unsaved changes)' : 'Save'}
        aria-label={dirty ? 'Save — unsaved changes' : 'Save'}
        className={dirty ? 'save-button-dirty' : undefined}
      >
        <Icon data={FloppyDisk} /><span className="toolbar-label">Save</span>
      </Button>
      <Button onClick={onSaveAs} view="flat" title="Save as…" aria-label="Save as">
        <Icon data={FileArrowUp} /><span className="toolbar-label">Save as</span>
      </Button>

      <div className="toolbar-divider" />

      <DropdownMenu
        items={[
          { text: 'Word document (.docx)', action: onImportDocx },
          { text: 'Excel spreadsheet (.xlsx, .csv)', action: onImportXlsx },
        ]}
        renderSwitcher={(props) => (
          <Button
            {...props}
            view="flat"
            title="Import a document…"
            aria-label="Import a Word or Excel document"
          >
            <Icon data={ArrowDownToSquare} /><span className="toolbar-label">Import</span>
            <Icon data={ChevronDown} size={12} />
          </Button>
        )}
      />
      <Button
        onClick={onExportDocx}
        view="flat"
        title="Export to Word (.docx)"
        aria-label="Export to Word document"
      >
        <Icon data={ArrowUpFromSquare} /><span className="toolbar-label">Export</span>
      </Button>

      <div className="toolbar-divider" />

      <div className="zoom-control">
        <Button
          onClick={onZoomOut}
          view="flat"
          title="Zoom out"
          aria-label="Zoom out"
          disabled={zoom <= 80}
        >
          <Icon data={MagnifierMinus} size={16} />
        </Button>
        <input
          type="range"
          min="80"
          max="200"
          step="10"
          value={zoom}
          onChange={(e) => onSetZoom(Number(e.target.value))}
          className="zoom-slider"
          title={`Text zoom: ${zoom}%`}
          aria-label="Text zoom"
        />
        <Button
          onClick={onZoomIn}
          view="flat"
          title="Zoom in"
          aria-label="Zoom in"
          disabled={zoom >= 200}
        >
          <Icon data={MagnifierPlus} size={16} />
        </Button>
        <Text variant="body-1" color="secondary" className="zoom-value">
          {zoom}%
        </Text>
      </div>

      <div className="toolbar-divider" />

      <Button
        onClick={onToggleTheme}
        view="flat"
        className="theme-toggle"
        title={`Theme: ${THEME_LABEL[theme]} — switch to ${NEXT_THEME[theme]}`}
        aria-label={`Switch theme (current: ${THEME_LABEL[theme]})`}
      >
        {/* dark → Sun, light → Moon, solarized → Palette */}
        <Icon data={theme === 'dark' ? Sun : theme === 'light' ? Moon : Palette} />
      </Button>
      <Button onClick={onAbout} view="flat" title="About GravityMD" aria-label="About GravityMD">
        <Icon data={CircleInfo} />
      </Button>
    </header>
  );
}
