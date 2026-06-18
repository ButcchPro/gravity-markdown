# Gravity Markdown Desktop App - Development History

This document outlines the step-by-step process of building a standalone Windows application for the [Gravity UI Markdown Editor](https://github.com/gravity-ui/markdown-editor) using **Tauri**, **Vite**, and **React**.

## Phase 1: Project Initialization & Basic Setup
1.  **Tech Stack Selection**: Chose Tauri for a lightweight Windows executable (`.exe`) using Rust for the backend and React/TypeScript/Vite for the frontend.
2.  **Environment Check**: Verified Node.js, npm, and Cargo (Rust) availability.
3.  **Project Creation**: 
    *   Scaffolded Vite React-TS project.
    *   Initialized Tauri configuration using `npx tauri init`.
4.  **Gravity UI Integration**: 
    *   Installed `@gravity-ui/markdown-editor`, `@gravity-ui/uikit`, and `@gravity-ui/navigation`.
    *   Configured SASS for styling.
    *   Implemented base `App.tsx` using `useMarkdownEditor` and `MarkdownEditorView`.

## Phase 2: Core Desktop Functionality
1.  **File System Access**: 
    *   Added Tauri plugins: `@tauri-apps/plugin-dialog` and `@tauri-apps/plugin-fs`.
    *   Implemented "Open" and "Save" logic in React using native Windows dialogs.
    *   Managed file state (current path) to support "Save" (overwrite) vs "Save As" behavior.
2.  **Permissions**: Configured `capabilities/default.json` in Tauri to allow file read/write and dialog access.

## Phase 3: Critical Bug Fixing
1.  **Blank Screen Fix**: 
    *   **Symptom**: The compiled `.exe` opened to a white window.
    *   **Cause**: Vite's default absolute asset paths (`/assets/`) don't resolve correctly in Tauri's local protocol.
    *   **Solution**: Updated `vite.config.ts` with `base: './'` to use relative paths.
2.  **Toaster Hook Error**:
    *   **Symptom**: React crash on startup with `Toaster: useToaster hook is used out of context`.
    *   **Solution**: Wrapped the application in `<ToasterProvider>` and added `<ToasterComponent />` from `@gravity-ui/uikit` in `main.tsx`. Added a concrete `Toaster` instance to the provider.

## Phase 4: Advanced Features & Customization
1.  **Theme Switcher**: 
    *   Implemented a state-driven theme toggle (Light/Dark).
    *   Integrated with Gravity UI's `ThemeProvider`.
    *   Added icons (Sun/Moon) for the toggle button in the toolbar.
2.  **LaTeX & Mermaid**:
    *   Installed `@gravity-ui/markdown-editor-latex-extension` and `katex`.
    *   Integrated Mermaid rendering through the editor's extension builder.
    *   Supported visual rendering of math formulas ($$ E=mc^2 $$) and diagrams.

## Phase 5: Office Formats (Import/Export)
1.  **DOCX Import**: Used `mammoth` to convert Word to HTML, then `turndown` to convert HTML to Markdown.
2.  **XLSX Import**: Integrated `SheetJS` (`xlsx`) to read spreadsheets and automatically generate Markdown tables.
3.  **DOCX Export**:
    *   Initially tried `@m2d/md2docx`, which failed due to Node-specific dependencies in a browser context.
    *   **Successful Solution**: Switched to a combination of `markdown-it` (to generate HTML) and `html-to-docx` (to generate the Word file).
    *   Implemented native file save flow for the resulting binary.

## Phase 6: Final Compilation
1.  **Build Command**: Executed `npx tauri build`.
2.  **Artifacts**:
    *   Portable Executable: `src-tauri\target\release\app.exe`
    *   Windows Installer: `src-tauri\target\release\bundle\nsis\gravity-markdown_0.1.0_x64-setup.exe`

## Phase 7: Hardening & Bug Fixes
1.  **Executable Renamed to `gravitymd`**:
    *   Updated `productName` in `tauri.conf.json` from `gravity-markdown` to `gravitymd`.
    *   Updated `name` in `Cargo.toml` from `app` to `gravitymd`.
2.  **DOCX Import — ArrayBuffer Safety Fix**:
    *   **Bug**: `readFile()` returns `Uint8Array`, but `.buffer` may include offset/length metadata causing mammoth to read garbage bytes.
    *   **Fix**: Sliced via `data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)`.
    *   **Added**: Logging of `result.messages` from mammoth to `console.warn` for conversion quality feedback.
3.  **DOCX Export — ESM Compatibility Fix**:
    *   **Bug**: `require('markdown-it')` and `require('html-to-docx')` crash in production because the project uses `"type": "module"`. `require` is undefined in ESM.
    *   **Fix**: Replaced with `import MarkdownIt from 'markdown-it'` (static) and `await import('html-to-docx')` (dynamic).
    *   **Bug**: `html-to-docx` returns a `Blob` in browser context, not `ArrayBuffer`. `new Uint8Array(fileBuffer)` would fail.
    *   **Fix**: Added `instanceof Blob` check with `.arrayBuffer()` conversion.
    *   **Bug**: TypeScript error — `addCantSplit` does not exist on type `Row`. Correct property is `cantSplit`.
    *   **Fix**: Changed `addCantSplit: true` to `cantSplit: true`.
4.  **XLSX Import — Type Safety & UX Fix**:
    *   **Bug**: `sheet_to_json<string[]>(ws, { header: 1 })` actually returns `(string | number | null | undefined)[][]`. Cells with `null`/`undefined` caused broken Markdown tables.
    *   **Fix**: Added `fmt()` helper: `String(cell ?? '')`. Typed as `(string | number | null | undefined)[]`.
    *   **Added**: Empty spreadsheet check — shows a `warning` toast instead of silent failure.
5.  **Dead Code Removal**:
    *   Removed unused `import { md2docx } from '@m2d/md2docx'`.
    *   Removed `@m2d/md2docx` from `package.json` dependencies.
6.  **Version Set to 1.0.0**:
    *   Updated `package.json` from `0.0.0` to `1.0.0`.
    *   Updated `tauri.conf.json` from `0.1.0` to `1.0.0`.
    *   Updated `Cargo.toml` from `0.1.0` to `1.0.0`.

## Phase 8: Dependency Updates
1.  **Updated Gravity UI Ecosystem**:
    *   `@gravity-ui/markdown-editor`, `@gravity-ui/uikit`, `@gravity-ui/icons`, `@gravity-ui/navigation` — updated to latest via `npm install ...@latest --legacy-peer-deps`.
    *   `@gravity-ui/markdown-editor-latex-extension`, `@diplodoc/mermaid-extension` — updated to latest compatible versions.
    *   `mammoth`, `turndown`, `html-to-docx`, `xlsx` — updated to latest.
    *   `@types/markdown-it`, `@types/node` — updated to latest.
2.  **Peer Dependency Constraints Confirmed**:
    *   `katex` locked at `^0.16.x` — required by `@diplodoc/latex-extension` and `@gravity-ui/markdown-editor`.
    *   `markdown-it` locked at `^13.x` — required by `@diplodoc/mermaid-extension`.
    *   These cannot be upgraded until upstream extensions update their peer dependencies.

## Phase 9: Project Governance
1.  **Created `.agent.md`** — Engineering principles, technical stack reference, and inviolable rules for AI-assisted development. Includes Project Chronicle rule mandating all significant changes be recorded in `history.md`.
2.  **Created `SKILLS.md`** — Registry of implemented skills/capabilities (Markdown Editing, File System Access, DOCX Import/Export, XLSX Import, Theme Switching, Version Management, Desktop Build). Each skill documents implementation details, pipeline, and constraints.

## Phase 12: Solarized Light Theme, Save As, Rust Fallbacks & FS Scope
1.  **Solarized Light Theme**:
    *   Added `src/solarized-light.scss` with CSS overrides on all `--g-color-*` variables for a third theme option.
    *   Theme toggle cycles: dark → light → solarized-light → dark.
2.  **Save As Button**:
    *   Added `FileArrowUp` icon button to toolbar for "Save As" functionality, allowing users to save to a new path without overwriting the current file.
3.  **Rust Fallback Commands for Cyrillic Paths**:
    *   **Problem**: `tauri-plugin-fs` scope restrictions prevented read/write to arbitrary paths (including cyrillic filenames).
    *   **Solution**: Added Rust Tauri commands as fallbacks:
        *   `read_file_content(path)` — reads file as UTF-8 string directly via `std::fs`.
        *   `write_file_content(path, content)` — writes UTF-8 string directly.
        *   `write_file_binary(path, data)` — decodes base64 string to bytes and writes binary file (for DOCX export).
    *   Added `base64 = "0.22"` crate dependency in `Cargo.toml`.
    *   Frontend sends binary data as base64 via `btoa()` to `write_file_binary`.
4.  **FS Scope Expansion**:
    *   Changed `capabilities/default.json` filesystem scope from restricted paths to `"path": "**"` (full access), enabling operations on cyrillic and arbitrary paths.
5.  **File-Open via CLI Args (Race Condition Fix)**:
    *   **Problem**: Frontend `file-open` event listener could miss events if it registered after the Rust side fired them.
    *   **Solution**: Rust backend stores initial file path in `InitialFile` Mutex state; frontend calls `get_initial_file` command on startup to retrieve it, avoiding the race condition.
6.  **Build Fixes**:
    *   Fixed `base64` crate import syntax — `base64::engine::general_purpose::STANDARD` with `use base64::Engine` trait import.
    *   Removed unused top-level import (warning cleanup).

## Future Recommendations
*   Implement auto-save functionality.
*   Add spell-checking support.
*   Enable GPT-assistant integration (requires Gravity UI GPT extension and an API key).

## Phase 10: Persistent Configuration & File Association
1.  **Window State Persistence**:
    *   Added `tauri-plugin-window-state` — automatically saves and restores window position, size, and maximize state.
    *   Registered as Rust plugin in `lib.rs` and added `window-state:default` permission.
2.  **Theme Persistence**:
    *   Added `tauri-apps/plugin-store` — persistent key-value store for app settings.
    *   Theme saved to `app-store.json` on toggle; loaded on startup via `loadTheme()`.
    *   App renders nothing (`null`) until theme is loaded, preventing flash of wrong theme.
3.  **File Association for .md Files**:
    *   Added `fileAssociations` in `tauri.conf.json` for `.md` and `.markdown` extensions with `text/markdown` MIME type.
    *   Rust backend reads `std::env::args()[1]` (first CLI argument after executable) and emits `file-open` event to the frontend.
    *   Frontend listens for `file-open` event via `@tauri-apps/api/event` and loads the file into the editor.
4.  **New Dependencies**:
    *   Rust: `tauri-plugin-window-state = "2"`, `tauri-plugin-store = "2"`.
    *   npm: `@tauri-apps/plugin-window-state`, `@tauri-apps/plugin-store`, `@diplodoc/tabs-extension`, `@diplodoc/transform`, `@gravity-ui/components`.
5.  **Build Dependencies Resolved**:
    *   After updating `@gravity-ui/markdown-editor` to latest, three missing transitive dependencies were discovered at build time: `@diplodoc/tabs-extension`, `@diplodoc/transform`, `@gravity-ui/components`. All installed.
6.  **ARM64 Build Attempt**:
    *   `aarch64-pc-windows-msvc` Rust target installed but build failed — MSVC ARM64 linker (`link.exe`) not present.
    *   **Requirement**: Visual Studio Build Tools with "C++ build tools for ARM64" component must be installed.

## Phase 11: x64 Build Artifacts (v1.0.0)
1.  **Successful x64 Build** after all fixes.
2.  **Artifacts**:
    *   Portable Executable: `src-tauri\target\release\gravitymd.exe`
    *   MSI Installer: `src-tauri\target\release\bundle\msi\gravitymd_1.0.0_x64_en-US.msi`
    *   NSIS Installer: `src-tauri\target\release\bundle\nsis\gravitymd_1.0.0_x64-setup.exe`
