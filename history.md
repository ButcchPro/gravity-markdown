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

## Phase 13: Toolbar Visual Separation
1.  **Problem**: Toolbar zone was visually indistinct from the editor working area — the divider line (`--g-color-line-generic`) was too faint across all three themes (dark/light/solarized-light).
2.  **Fix**: In `src/App.scss`, `.toolbar`:
    *   Replaced `border-bottom` color with `--g-color-line-generic-active` (black-300 light / white-600 dark / `#93a1a1` solarized) — higher contrast, theme-aware.
    *   Added `box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12)` for a lifted-panel effect.
    *   Added `z-index: 1` so the toolbar shadow renders above the editor content.
3.  **Formatting Toolbar Separator + Lost Padding Restoration**:
    *   **Bug**: Left/right padding inside the editor text area had silently disappeared after Phase 8 (Gravity UI ecosystem update). Root cause: `src/App.scss` targeted `.g-md-editor` and `.g-md-editor__content` — selectors that no longer exist in the current Gravity UI version. The real classes are `.g-md-editor-component` (root), `.g-md-wysiwyg-editor__editor` / `.g-md-markup-editor__editor` (content), `.g-md-wysiwyg-editor__toolbar` / `.g-md-markup-editor__toolbar` (formatting toolbar).
    *   **Fix**: In `src/App.scss`, `.editor-container`:
        *   Removed dead `.g-md-editor` and `.g-md-editor__content` rules.
        *   Restored `padding: 0 21px` on `.g-md-wysiwyg-editor__editor` and `.g-md-markup-editor__editor` (covers both WYSIWYG and markup modes).
        *   Added `border-bottom: 1px solid var(--g-color-line-generic-active)` to `.g-md-wysiwyg-editor__toolbar` and `.g-md-markup-editor__toolbar` to visually separate the text-style toolbar from the editing field (consistent with the app toolbar separator).

## Phase 14: About Button + About Dialog
1.  **About Button**: Added a dedicated `CircleInfo` icon button (`@gravity-ui/icons`) in the editor formatting toolbar, positioned next to the built-in Gravity UI settings gear (top-right). Rationale: the built-in gear's dropdown menu (`EditorSettings`) hardcodes its items (mode/toolbar/split) and exposes no API for custom items, so a separate adjacent button was chosen over a DOM hack or full settings reimplementation.
    *   Implementation: `EditorWrapper` now accepts an `onAbout` callback and wraps `MarkdownEditorView` in a `.editor-wrapper` (position relative) with an absolutely-positioned `.about-button` (`top: 4px; right: 44px; z-index: 2`) — placed just left of the gear.
2.  **About Dialog**: Custom `Dialog` (Gravity UI uikit) shown when the About button is clicked. No header/caption — the title is rendered as the first line of the body:
    *   **Title line**: `GravityMD v{version}` — version loaded dynamically via `getVersion()` from `@tauri-apps/api/app` (reads `tauri.conf.json` `version` field, currently `1.0.1`). No hardcoding — updates automatically when the version changes.
    *   **Author**: "Developed by Andrey Obushev, OpenSky Kft." — "OpenSky Kft." is a clickable link to `https://openskykft.com`.
    *   **Based on**: "Based on Gravity UI Markdown Editor" — link to the parent repository `https://github.com/gravity-ui/markdown-editor`.
3.  **External Link Support**: Added `@tauri-apps/plugin-opener` to open URLs in the system default browser:
    *   npm: `@tauri-apps/plugin-opener` installed.
    *   Rust: `tauri-plugin-opener = "2"` added to `Cargo.toml`; `.plugin(tauri_plugin_opener::init())` registered in `lib.rs`.
    *   Capabilities: `opener:default` permission added to `capabilities/default.json`.
    *   Frontend: `openUrl()` from `@tauri-apps/plugin-opener` called on link click with `preventDefault()`.
4.  **Styling**: `.about-content` styles in `App.scss` — title with version (secondary color), link styling using Gravity UI `--g-color-text-link` / `--g-color-text-link-hover` tokens (theme-aware). `.about-button` positioned via absolute coordinates within `.editor-wrapper`.

## Phase 15: Unsaved Changes Indicator (Save Button)
1.  **Behavior**: The "Save MD" toolbar button turns red while there are unsaved edits in the editor; reverts to default color after a successful save.
2.  **Implementation** (`src/App.tsx`):
    *   Derived state `dirty = currentValue !== content` — compares the live editor value (`currentValue`, updated via the editor `change` event) against the last-saved snapshot (`content`).
    *   `handleSave` and `handleSaveAs` now call `setContent(currentValue)` after a successful write, resetting `dirty` to `false`.
    *   `loadContent` already sets both `content` and `currentValue` to the same value on open/import — so newly opened files start clean.
    *   Save button gets `className="save-button-dirty"` when `dirty` is true, otherwise `undefined`.
3.  **Styling** (`src/App.scss`): `.save-button-dirty` sets `color: var(--g-color-text-danger)` on the button and its inner `.g-button__icon` / `.g-button__text` — theme-aware danger token (red in all three themes).

## Phase 16: Text Zoom Slider & Layout Compactness
1.  **Text Zoom State**:
    *   Added `zoom` state (number, default `100`, range `80%` to `200%` with step `10%`).
    *   Designed it to always reset to `100%` on application startup (no persistence, per user request).
2.  **Zoom Control UI**:
    *   Added a `.zoom-control` block in the toolbar containing a `MagnifierMinus` button, a native HTML range slider, a `MagnifierPlus` button, and a percentage text display.
    *   Configured the buttons to decrement/increment the zoom by 10% and disable when reaching the boundaries.
3.  **Proportional Scaling & Spacing Reduction**:
    *   Passed `--editor-zoom-scale` (zoom / 100) as a CSS variable via inline styles to `.app-container`.
    *   Applied the native CSS `zoom` property on `.ProseMirror` and `.cm-editor` inside the editor content containers to scale the entire editing area (text size, line heights, paragraph margins, list item spacing, tables, etc.) proportionally.
    *   Reduced default spacing/intervals (line-height of ProseMirror and CodeMirror lines, margins of paragraphs, headings, lists) by 25% in `src/App.scss` to make the default layout more compact and neat.
    *   Styled the range slider track and thumb in `src/App.scss` to match the Gravity UI theme and colors.

## Phase 17: Project Cleanup & Optimization
1.  **Unused File Deletion**:
    *   Deleted `src/App.css` and `src/index.css` (dead files left over from the Vite React template).
    *   Deleted `src-tauri/2` (accidental log file created by a terminal redirect typo).
2.  **Garbage Collection**:
    *   Cleaned the Rust build target and Vite build output (`cargo clean` and removed `dist/`), freeing up **10.1 GB** of disk space.

## Phase 18: GitHub Release, Licensing & CI/CD (v1.0.2)
1.  **Version Bump**:
    *   Updated the version to `1.0.2` in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`.
2.  **Licensing & Attribution**:
    *   Created `LICENSE` file under the MIT License, with copyright to Andrey Obushev, OpenSky Kft.
    *   Added a **License & Third-Party Credits** section to the end of `README.md`, listing licenses for `@gravity-ui/markdown-editor`, `@gravity-ui/uikit`, Tauri, Mammoth, and SheetJS.
3.  **GitHub-Ready Documentation**:
    *   Rewrote `README.md` to be a professional GitHub-ready document with Shields.io badges, logo, installation guide, project structure, and direct download links for the release assets.
4.  **CI/CD Workflow & Fixes**:
    *   Created `.github/workflows/release.yml` using `tauri-apps/tauri-action@v0` to automatically compile and package installers for Windows x64 (`x86_64-pc-windows-msvc`), Windows ARM64 (`aarch64-pc-windows-msvc`), and macOS Universal (`universal-apple-darwin` for both Intel and Apple Silicon) on tag pushes.
    *   **CI Fix 1**: Fixed `tauri-apps/tauri-action` version from `@v2` (non-existent) to `@v0` (stable).
    *   **CI Fix 2**: Added `--legacy-peer-deps` to the `npm ci` step in the workflow to bypass peer dependency conflicts in the Gravity UI ecosystem.
    *   **CI Fix 3**: Added `"tauri": "tauri"` script to `package.json` to support `tauri-action`'s default `npm run tauri build` command.
5.  **Repository Publication & Successful Release**:
    *   Committed all changes locally.
    *   Created a private repository on GitHub (`ButcchPro/gravity-markdown`) using the GitHub CLI, and pushed the code to the `master` branch.
    *   Tagged the commit as `v1.0.2` and pushed the tag to GitHub, triggering the CI/CD release workflow.
    *   Changed the repository visibility to **public** (`gh repo edit --visibility public`).
    *   **Successful Build**: The GitHub Actions runner successfully compiled all three targets: Windows x64 (8m 18s), Windows ARM64 (7m 47s), and macOS Universal (6m 56s).
    *   **Release Published**: The draft release was successfully published by the user on GitHub, making the direct download links in `README.md` active.

## Phase 19: Table Rendering & DOCX Export Fixes
1. **DOCX Export Table Parser Bug Fix**:
    *   **Bug**: The Markdown table parser used `.filter(Boolean)` on split cell arrays. This silently discarded any empty cells (e.g. `| cell 1 | | cell 3 |`), causing subsequent columns to shift to the left and break alignment.
    *   **Fix**: Modified `src/App.tsx` table parser to split by `|`, safely shift/pop the outer empty elements resulting from the leading/trailing pipes, and map the remaining cells without filtering out empty ones.
2. **Table Visual Styles**:
    *   **Bug**: Tables rendered in the WYSIWYG editor (`.ProseMirror`) and preview had no grid lines or borders, making them visually indistinct and hard to edit.
    *   **Bug**: Paragraphs (`p`) inside table cells inherited the global `.ProseMirror p` 12px margins, resulting in extremely tall, stretched cells.
    *   **Fix**: Added a clean, theme-aware table style in `src/App.scss` under `.editor-container` using Gravity UI's CSS variables (`--g-color-line-generic`, `--g-color-base-generic`, `--g-color-base-generic-ultralight`). Added a reset rule `margin: 0 !important` on paragraphs inside table cells to restore compact cell heights.
3. **Diplodoc YFM CSS Integration**:
    *   **Improvement**: Imported `@diplodoc/transform/dist/css/yfm.css` in `src/main.tsx` to ensure all Yandex Flavored Markdown (YFM) features (including notes, cuts, tables) are styled properly in preview mode.
4. **HTML Table Paste Bug Fix**:
    *   **Bug**: When copying tables from web pages, Excel, or Google Sheets and pasting them "normally" (Ctrl+V) into the WYSIWYG editor, the table structure was completely broken.
    *   **Cause 1 (Cell Alignment)**: The editor's internal `Table` extension schema defined a strict `parseDOM` for `th` and `td` elements that returned `null` (discarding the element) if the proprietary `cell-align` attribute was missing. Since standard HTML tables lack this attribute, the cells were ignored, breaking the table layout.
    *   **Cause 2 (Missing thead/tbody)**: The editor's `table` schema enforces a strict content model `thead tbody` (both required). Most pasted HTML tables (from Excel, Google Sheets, or webpages) only have `<tbody>` or direct `<tr>` children. This mismatch caused ProseMirror's default HTML parser to fail to parse the table.
    *   **Fix 1 (Schema Override)**: Used `builder.overrideNodeSpec` in [src/App.tsx](file:///D:/AI%20Agent/Markdown/gravity-markdown/src/App.tsx) for both `th` and `td` to override `parseDOM` and fall back to standard HTML `align` attributes or `style.textAlign` values instead of returning `null`.
    *   **Fix 2 (Custom Paste Interceptor)**: Added a custom ProseMirror plugin in [src/App.tsx](file:///D:/AI%20Agent/Markdown/gravity-markdown/src/App.tsx) using `builder.addPlugin`. The plugin intercepts paste events containing HTML tables, converts the HTML to a clean Markdown table via `turndown` (using a custom table conversion rule), and parses the Markdown using `deps.markupParser.parse`. This ensures the table is parsed through the editor's robust Markdown parser which automatically generates the correct YFM schema.
5. **Verification**:
    *   Ran `npm run build` to verify clean compilation and bundling with the new styles, schema overrides, and paste interceptor.

## Phase 20: Release v1.0.3
1. **Version Bump**:
    *   Bumped version from `1.0.2` to `1.0.3` in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml` to prepare for GitHub release.

