# 🌌 GravityMD

<p align="center">
  <img src="public/favicon.svg" alt="GravityMD Logo" width="120" height="120" />
</p>

<h3 align="center">GravityMD</h3>

<p align="center">
  A lightweight, standalone desktop Markdown editor built with <b>Tauri 2.x</b>, <b>React 19</b>, and <b>Gravity UI</b>.
</p>

<p align="center">
  <a href="https://tauri.app/"><img src="https://img.shields.io/badge/Tauri-2.x-24C8D8?style=flat-square&logo=tauri&logoColor=white" alt="Tauri" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-6.x-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://vite.dev/"><img src="https://img.shields.io/badge/Vite-8.x-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" /></a>
  <a href="https://gravity-ui.com/"><img src="https://img.shields.io/badge/UI-Gravity_UI-yellow?style=flat-square" alt="Gravity UI" /></a>
  <img src="https://img.shields.io/badge/Platform-Windows-0078D6?style=flat-square&logo=windows&logoColor=white" alt="Platform Support" />
</p>

---

## 📥 Downloads

Download the latest version of GravityMD for your platform:

*   💻 **Windows (x64)**:
    *   [MSI Installer](https://github.com/ButcchPro/gravity-markdown/releases/download/v1.0.5/gravitymd_1.0.5_x64_en-US.msi)
    *   [NSIS (EXE) Setup](https://github.com/ButcchPro/gravity-markdown/releases/download/v1.0.5/gravitymd_1.0.5_x64-setup.exe)
*   💻 **Windows (ARM64)**:
    *   [MSI Installer](https://github.com/ButcchPro/gravity-markdown/releases/download/v1.0.5/gravitymd_1.0.5_arm64_en-US.msi)
    *   [NSIS (EXE) Setup](https://github.com/ButcchPro/gravity-markdown/releases/download/v1.0.5/gravitymd_1.0.5_arm64-setup.exe)
*   🍎 **macOS (Universal)**:
    *   [DMG Image](https://github.com/ButcchPro/gravity-markdown/releases/download/v1.0.5/gravitymd_1.0.5_universal.dmg)

👉 Or visit the **[Releases Page](https://github.com/ButcchPro/gravity-markdown/releases/latest)** to view all versions and changelogs.

---

## ✨ Features

### 📝 Editing & Formatting
*   **Dual-Engine Editor**: Seamlessly toggle between **WYSIWYG** (visual rich text) and **Markup** (raw markdown with syntax highlighting) modes.
*   **LaTeX Math**: Render complex mathematical formulas inline `$E=mc^2$` or as blocks `$$ E=mc^2 $$` in real-time (powered by KaTeX).
*   **Mermaid Diagrams**: Create flowcharts, sequence diagrams, and Gantt charts using simple text syntax.

### 💼 Office Document Integration
*   **DOCX Import**: Convert any Word document (`.docx`) into clean, structured Markdown — processed in a background Web Worker, so large files never freeze the UI.
*   **DOCX Export**: Compile your Markdown files into styled Word documents with proper headings, lists, links, and tables — including merged cells (`colspan`/`rowspan`), LaTeX formulas (Cambria Math) and code blocks. Document margins follow the RU/GOST layout (left 2.5 cm, others 2 cm).
*   **XLSX/CSV Import**: Load Excel spreadsheets or CSV files and automatically convert them into formatted Markdown tables (also off the main thread).

### 📊 Tables Done Right
*   **Two table dialects, one file**: creates standard Markdown pipe tables (GitHub/VS Code compatible) and understands YFM wide-tables (`#|` … `|#`) natively.
*   **Automatic YFM cleanup on save**: when saving, every losslessly convertible YFM table is silently rewritten as a standard pipe table; tables with cell spans or block content are kept as-is and reported with a warning toast.

### 🎨 User Experience
*   **Dynamic Theme Switcher**: Cycles through three carefully crafted themes:
    *   🌒 **Dark** (Default, sleek developer-friendly look)
    *   ☀️ **Light** (High-contrast clean look)
    *   🌾 **Solarized Light** (Warm, eye-friendly pastel theme — dialogs and toasts included)
*   **Proportional Text Zoom**: Instantly scale the entire editor content (font sizes, line heights, paragraph spacing, list padding, and tables) from **80% to 200%** using the toolbar slider or buttons.
*   **Unsaved Changes Protection**: the Save button lights up red while the document has unsaved edits; closing the window asks "Save / Don't Save / Cancel" instead of silently discarding your work.
*   **Window State Memory**: Remembers and restores your window position, size, and maximized state on startup.

### 📂 OS Integration & Safety
*   **File Associations**: Automatically registers as a handler for `.md` and `.markdown` files. Double-click files in Windows Explorer to open them instantly — even when the app is already running (files are forwarded to the existing window, never a second copy).
*   **Cyrillic & Path Safety**: Includes custom Rust-backed file handlers to safely read and write files containing Cyrillic characters or located in restricted system directories, bypassing standard WebView sandbox limitations.
*   **Update Check**: On startup the app asks GitHub whether a newer release was published and offers to open the Releases page — you can skip a version and it will not nag again.

---

## 🛠️ Technical Stack

*   **Core**: [Tauri 2.x](https://tauri.app/) (Rust backend for OS integration, window management, and filesystem access)
*   **Frontend**: React 19 + TypeScript + Vite
*   **Editor**: [@gravity-ui/markdown-editor](https://github.com/gravity-ui/markdown-editor)
*   **Design System**: [@gravity-ui/uikit](https://gravity-ui.com/) & [@gravity-ui/navigation](https://github.com/gravity-ui/navigation)
*   **Document Parsers**: `mammoth` (DOCX import), `turndown` (HTML to Markdown), `docx` (DOCX export), `xlsx` (SheetJS for Excel import)

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your Windows machine:
1.  **Node.js** (v18 or higher) & **npm**
2.  **Rust** (via [rustup.rs](https://rustup.rs/))
3.  **C++ Build Tools** (MSVC compiler, selectable in the Visual Studio Installer under "Desktop development with C++")

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/gravity-markdown.git
   cd gravity-markdown
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Running in Development

Start the application with hot reloading and Rust debugging enabled:
```bash
npx tauri dev
```

### Compiling a Production Build

To compile the release binary and package it into Windows installers (MSI and NSIS):
```bash
npx tauri build
```

To compile **only the standalone executable** (`gravitymd.exe`) without packaging installers:
```bash
npx tauri build --no-bundle
```
*Your compiled binary will be located at `src-tauri/target/release/gravitymd.exe`.*

---

## 📂 Project Structure

```text
├── .agents/
│   └── AGENTS.md          # Custom AI agent guidelines and project rules
├── src/                   # React Frontend
│   ├── App.tsx            # Application shell: wiring hooks, dialogs, close interception
│   ├── App.scss           # Styling, editor typography and zoom rules
│   ├── main.tsx           # Application entry point and providers
│   ├── components/        # Toolbar, EditorWrapper, dialogs (About, Unsaved, Update)
│   ├── hooks/             # useTheme, useZoom, useFileOperations, useImport, useExport, useUpdateCheck
│   ├── utils/             # IPC wrappers, YFM→PIPE table converter, pipe-table serializer, notification
│   ├── workers/           # Web Workers: DOCX import, XLSX import, Markdown→HTML render
│   └── types/             # Structured IPC contracts and error payloads
├── tests/                 # Utility tests: npm run test:utils
├── src-tauri/             # Rust Backend
│   ├── src/
│   │   ├── lib.rs         # Custom Tauri commands (structured {code,message} errors, single instance)
│   │   └── main.rs        # Entry point
│   └── tauri.conf.json    # Tauri configuration, capabilities (incl. CSP), and file associations
├── history.md             # Chronological development history
└── README.md              # Project documentation
```

---

## 📄 License & Third-Party Credits

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

### Third-Party Credits & Licenses

GravityMD is built upon several open-source libraries. Their respective licenses are listed below:
*   **Gravity UI Markdown Editor** (`@gravity-ui/markdown-editor`) — [MIT License](https://github.com/gravity-ui/markdown-editor/blob/main/LICENSE) (© YANDEX LLC)
*   **Gravity UI UIKit** (`@gravity-ui/uikit`) — [MIT License](https://github.com/gravity-ui/uikit/blob/main/LICENSE) (© YANDEX LLC)
*   **Tauri** — [MIT / Apache 2.0 License](https://github.com/tauri-apps/tauri/blob/dev/LICENSE-MIT) (© Tauri Programme)
*   **Mammoth** — [BSD-2-Clause License](https://github.com/mwilliamson/mammoth.js/blob/master/LICENSE) (© Michael Williamson)
*   **SheetJS (XLSX)** — [Apache 2.0 License](https://github.com/SheetJS/sheetjs/blob/master/LICENSE) (© SheetJS LLC)
