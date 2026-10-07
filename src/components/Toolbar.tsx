import { Button, Text, Icon } from '@gravity-ui/uikit';
import { FolderOpen, FloppyDisk, FileArrowUp, Moon, Sun, Palette, ArrowDownToSquare, ArrowUpFromSquare, CircleInfo, MagnifierMinus, MagnifierPlus } from '@gravity-ui/icons';
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

export function Toolbar({
  onOpen, onSave, onSaveAs,
  onImportDocx, onExportDocx, onImportXlsx,
  onToggleTheme, onAbout,
  dirty, zoom, onSetZoom, onZoomIn, onZoomOut,
  theme,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <Button onClick={onOpen} view="flat" title="Open Markdown">
        <Icon data={FolderOpen} /> MD
      </Button>
      <Button onClick={onSave} view="flat" title="Save Markdown" className={dirty ? 'save-button-dirty' : undefined}>
        <Icon data={FloppyDisk} /> MD
      </Button>
      <Button onClick={onSaveAs} view="flat" title="Save Markdown As...">
        <Icon data={FileArrowUp} /> MD
      </Button>

      <div className="toolbar-divider" />

      <Button onClick={onImportDocx} view="flat" title="Import Word Document">
        <Icon data={ArrowDownToSquare} /> DOCX
      </Button>
      <Button onClick={onExportDocx} view="flat" title="Export to Word Document">
        <Icon data={ArrowUpFromSquare} /> DOCX
      </Button>
      <Button onClick={onImportXlsx} view="flat" title="Import Excel Spreadsheet as Table">
        <Icon data={ArrowDownToSquare} /> XLSX
      </Button>

      <div className="toolbar-divider" />

      <div className="zoom-control">
        <Button
          onClick={onZoomOut}
          view="flat"
          title="Zoom Out"
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
          title={`Text Zoom: ${zoom}%`}
        />
        <Button
          onClick={onZoomIn}
          view="flat"
          title="Zoom In"
          disabled={zoom >= 200}
        >
          <Icon data={MagnifierPlus} size={16} />
        </Button>
        <Text variant="body-1" color="secondary" className="zoom-value">
          {zoom}%
        </Text>
      </div>

      <div className="toolbar-divider" />

      <Button onClick={onToggleTheme} view="flat" className="theme-toggle" title={theme}>
        {/* dark → Sun, light → Moon, solarized → Palette */}
        <Icon data={theme === 'dark' ? Sun : theme === 'light' ? Moon : Palette} />
      </Button>
      <Button onClick={onAbout} view="flat" title="About" aria-label="About">
        <Icon data={CircleInfo} />
      </Button>
    </div>
  );
}
