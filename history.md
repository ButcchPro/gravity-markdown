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
    *   Originally designed to always reset to `100%` on application startup (no persistence, per user request).
    *   **Correction (Oct 2026):** zoom IS persisted in `app-store.json` via `src/hooks/useZoom.ts` — the hook is the source of truth, not this bullet.
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
2. **Documentation Update**:
    *   Updated the direct download links in `README.md` to point to the new `v1.0.3` assets.
3. **GitHub Publication**:
    *   Committed and pushed the version bump and documentation changes to `master`.
    *   Created and pushed the `v1.0.3` tag, triggering the GitHub Actions release workflow which compiled and packaged the installers successfully.

## Phase 21: LaTeX Rendering Fix
1. **Bug**: LaTeX expressions (inline `$...$` and block `$$...$$`) were not rendering in the editor — KaTeX CSS and runtime scripts were never loaded.
2. **Root Cause**: In `src/components/EditorWrapper.tsx`, the `LatexExtension` was configured with `loadRuntimeScript: () => {}` (empty stub), which prevented the KaTeX runtime and styles from loading. Additionally, no KaTeX/LaTeX CSS was imported anywhere in the app.
3. **Fix 1 (loadRuntimeScript)**: Replaced the empty stub in `EditorWrapper.tsx` with the proper dynamic imports as documented in the `@gravity-ui/markdown-editor-latex-extension` README:
  ```ts
  loadRuntimeScript: () => {
    import('@diplodoc/latex-extension/runtime');
    import('@diplodoc/latex-extension/runtime/styles');
  },
  ```
4. **Fix 2 (Static CSS Import)**: Added `import '@diplodoc/latex-extension/runtime/styles'` to `src/main.tsx` to ensure KaTeX CSS and fonts are available on first render without race conditions.
5. **Fix 3 (Type Declaration)**: Created `src/vite-env.d.ts` with `declare module '@diplodoc/latex-extension/runtime/styles'` to resolve TypeScript's "cannot find module" error for the CSS side-effect import.
6. **Verification**: `npm run build` completed successfully. KaTeX fonts (woff2, woff, ttf) and CSS are now bundled in `dist/assets/`.
7. **DOCX Export LaTeX Support**: Added LaTeX handling to `src/hooks/useExport.ts`:
   - **Inline LaTeX** (`$...$`): Added `\$([^$]+)\$` pattern to `parseInline()` regex. Inline formulas are rendered as italic `Cambria Math` font in DOCX.
   - **Block LaTeX** (`$$...$$`): Added block-level parser in the main export loop supporting both single-line (`$$E=mc^2$$`) and multi-line block formulas. Block formulas are rendered as centered paragraphs with italic `Cambria Math` font.
   - Previously, LaTeX expressions were exported as raw text with `$` symbols, making formulas unreadable in DOCX.
8. **LaTeX → Unicode Converter**: Created `src/utils/latexToUnicode.ts` — a comprehensive converter that transforms LaTeX math commands to Unicode characters during DOCX export:
   - Greek letters (`\gamma` → γ, `\Delta` → Δ, etc.)
   - Relations (`\ge` → ≥, `\le` → ≤, `\neq` → ≠, etc.)
   - Operators (`\pm` → ±, `\times` → ×, `\circ` → °, etc.)
   - Arrows, misc symbols (`\infty` → ∞, `\sum` → ∑, `\int` → ∫, etc.)
   - Superscripts (`^{2}` → ², `^{circ}` → ᶜⁱʳᶜ fallback) and subscripts (`_{Pmp}` → ₚₘₚ)
   - Font/no-op commands (`\text{C}` → C, `\mathrm{...}` → content, etc.)
   - Escaped special chars (`\%` → %, `\&` → &, etc.)
   - Integrated into `useExport.ts` for both inline and block LaTeX export.
9. **DOCX Export Pipeline Rewrite**: Completely rewrote `src/hooks/useExport.ts` to use the correct Markdown→HTML→DOCX pipeline per `AGENTS.md`:
   - **Old approach**: Custom regex-based markdown parser that manually converted markdown lines to `docx` elements. This produced poor results that didn't match the editor's rendering.
   - **New approach**: Uses `markdown-it` with `@diplodoc/latex-extension` (KaTeX) to convert Markdown→HTML (same rendering as the editor), then parses the HTML using the browser's `DOMParser` and converts DOM elements to `docx` library objects.
   - **Supported HTML elements**: headings (h1-h6), paragraphs, bold/italic/strikethrough, inline code, code blocks, links, tables (with header bold), ordered/unordered lists, blockquotes, horizontal rules, KaTeX inline/block math.
   - **KaTeX math**: `.katex` and `.katex-display` elements are detected and rendered as italic `Cambria Math` in DOCX.
   - **Removed `html-to-docx`**: Initially tried `html-to-docx` but it imports Node.js modules (`fs`, `http`, `crypto`) that don't work in the browser. Switched to DOM parsing + `docx` library which is browser-native.
   - **Removed `latexToUnicode.ts` integration**: No longer needed since KaTeX renders LaTeX to HTML directly. The utility file is kept for potential future use.
10. **LaTeX Export Fix — `.yfm-latex` Placeholder Handling**: The `@diplodoc/latex-extension` with `bundle: false` does not render KaTeX to HTML directly. Instead, it generates placeholder elements with URL-encoded LaTeX source in `data-content` attributes:
    - Inline: `<span class="yfm-latex" data-content="...URL-encoded LaTeX..."></span>`
    - Block: `<p class="yfm-latex" data-content="...URL-encoded LaTeX..."></p>`
    - These elements are **empty** — KaTeX runtime renders them on the client side. The initial implementation tried to read `el.textContent` which returned empty strings.
    - **Fix**: Added detection of `.yfm-latex` elements with `data-content` attribute in both `parseInlineElements()` and `htmlToDocxChildren()`. The LaTeX source is decoded via `decodeURIComponent()` and converted to Unicode via `latexToUnicode()`.
    - Re-integrated `latexToUnicode` from `src/utils/latexToUnicode.ts` into `useExport.ts`.
11. **Verification**: `npm run build` completed successfully after all changes.
12. **latexToUnicode — Superscript/Subscript with LaTeX Commands Fix**: `^{\circ}` was incorrectly trying to convert literal characters `c,i,r,c` to Unicode superscript instead of first resolving `\circ` → `°`. Fixed by recursively processing braced content through `latexToUnicode()` before applying superscript/subscript conversion. Key changes to `src/utils/latexToUnicode.ts`:
    - `^{\circ}` now resolves to `°` (not failed superscript of `circ`)
    - `_{\text{Pmp}}` now resolves to `ₚₘₚ` (not literal subscript of `\text{Pmp}`)
    - Added `\frac`, `\dfrac`, `\tfrac` handling: `\frac{a}{b}` → `a/b`
    - Added `\overline`, `\bar`, `\hat`, `\tilde`, `\vec`, `\dot`, `\ddot` handling (output content only)
    - Added `\left`, `\right`, `\big`, `\Big`, `\bigg`, `\Bigg`, `\limits`, `\nolimits` (skipped as delimiters)
    - Extended superscript map with full Latin alphabet (a-z, A-Z) and common symbols (°, ′, ″)
    - Skip standalone braces `{` `}` that are grouping delimiters
13. **HTML Tag Coverage in useExport.ts**: Comprehensive review and fix of all handled HTML elements:
    - **Inline**: `strong`/`b`, `em`/`i`, `u` (underline — new), `s`/`del`, `mark` (highlight — new), `code`, `a`, `sub`, `sup`, `br` (line break — new), `img` (alt text — new), `span` (generic recurse)
    - **Block**: `h1-h6`, `p`, `table`, `ul`, `ol`, `blockquote`, `pre`, `hr`, `dl`/`dt`/`dd` (definition lists — new), `details`/`summary` (YFM cuts — new), `figure`/`figcaption` (new), `div`/`section` (generic recurse)
    - **Nested formatting**: `parseInlineElements()` now accepts `inherited` parameter for proper nesting (e.g., `**bold *italic***` preserves both bold and italic)
    - **Blockquote**: Now recurses into inner children (paragraphs, lists) instead of flattening
    - **Code blocks**: Multi-line code split into separate paragraphs for proper formatting
14. **Verification**: `npm run build` completed successfully after all changes.
15. **DOCX Export — Line Spacing & Typography**: Added proper line spacing and typography settings for professional DOCX output:
    - **Default font**: Calibri 11pt via `styles.default.document` in `Document` constructor
    - **Page margins**: 1 inch (1440 twips) on all sides
    - **Spacing constants** (in twips, 1pt = 20 twips):
      - `PARAGRAPH`: 1.15 line spacing (276 AUTO), 8pt after (160 twips)
      - `H1-H6`: 1.15 line spacing, varying before (24-48pt) and after (4-10pt)
      - `LIST`: 1.15 line spacing, 4pt after
      - `QUOTE`: 1.15 line spacing, 4pt after
      - `CODE`: 1.0 line spacing (240 AUTO), no extra after
      - `MATH`: 1.15 line spacing, 12pt before & after
      - `TABLE_CELL`: 1.0 line spacing, 2pt after
    - Applied `spacing` property to all `Paragraph` creations in `htmlToDocxChildren()`
    - Imported `LineRuleType` from `docx` for proper `AUTO` line rule specification
16. **Verification**: `npm run build` completed successfully after all changes.

## Phase 22: Release v1.0.4
1. **Version Bump**:
    *   Bumped version from `1.0.3` to `1.0.4` in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`.
2. **Documentation Update**:
    *   Updated the direct download links in `README.md` to point to the new `v1.0.4` assets.
3. **Release Workflow Fix**:
    *   **Problem**: v1.0.4 tag pushed successfully, GitHub Actions workflow completed, but no release appeared on the Releases page.
    *   **Root Cause**: `.github/workflows/release.yml` had `releaseDraft: true` — `tauri-action` created releases as drafts (invisible to public).
    *   **Fix**: Changed `releaseDraft: true` → `releaseDraft: false` in `release.yml` line 55.
    *   Committed fix (`9153cc5`), pushed to `master`.
    *   Deleted remote tag `v1.0.4`, deleted local tag, recreated on new commit, pushed — triggered new workflow run that will create a publicly visible release.

## Phase 23: Unsaved Changes Dialog on Window Close
1. **Problem**: Closing the app window (X button, Alt+F4) with unsaved editor changes silently discarded all edits without any warning.
2. **Design Decision**: Used a custom Gravity UI `Dialog` with three buttons (Save / Don't Save / Cancel) instead of the native `ask()` dialog from `@tauri-apps/plugin-dialog` — the native dialog only supports two buttons and doesn't match the app's theming (three themes).
3. **Close Interception** (`src/App.tsx`):
    *   Registered `getCurrentWindow().onCloseRequested()` handler once on mount.
    *   Clean state (`dirty === false`) — close proceeds normally.
    *   Dirty state — `event.preventDefault()` blocks the close and shows `UnsavedChangesDialog`.
    *   `dirtyRef` keeps the latest dirty value readable inside the stable handler closure (avoids stale closures and re-registration).
4. **Dialog Component** (`src/components/UnsavedChangesDialog.tsx`):
    *   "Save" — saves to the current path (`handleSave`) or opens Save As dialog if no file is associated; window is destroyed only on successful save; on failure/cancel the dialog re-opens so no data is lost.
    *   "Don't Save" — discards changes and destroys the window immediately.
    *   "Cancel" (also Escape/overlay click via `onClose`) — aborts closing, returns to editing.
5. **Return Value Contract Change** (`src/hooks/useFileOperations.ts`): `handleSave` and `handleSaveAs` now return `Promise<boolean>` — `true` when the file was actually written, enabling the save-then-close flow.
6. **Permissions** (`src-tauri/capabilities/default.json`): Added `core:window:allow-destroy` for programmatic `destroy()` calls from the frontend.
7. **Styling** (`src/App.scss`): Added `.unsaved-dialog-body` consistent with the existing `.about-content` dialog pattern.
8. **Verification**: `npm run build` completed successfully (exit code 0). Permission identifier validated against Tauri's generated schema (`core:window:allow-destroy` exists in `gen/schemas/desktop-schema.json`).

## Phase 24: Upstream Dependency Update (August 2026)
1. **Upstream Check**: Compared installed versions against npm registry and GitHub releases of `gravity-ui/markdown-editor`. Five new upstream releases were published since the project's install (15.41.0 → 15.46.0), plus updates across the whole Gravity UI / Diplodoc ecosystem.
2. **Updated Packages** (`npm install ...@latest --legacy-peer-deps`):
    *   Gravity UI: `@gravity-ui/markdown-editor` 15.41.0→15.46.0, `markdown-editor-latex-extension` 0.1.0→0.1.1, `@gravity-ui/uikit` 7.42.0→7.48.1, `@gravity-ui/icons` 2.18.0→2.21.0, `@gravity-ui/navigation` 6.0.0→6.4.1, `@gravity-ui/components` 4.22.0→4.24.0.
    *   Diplodoc: `latex-extension` 2.0.0→2.0.2, `mermaid-extension` 2.1.3→2.2.3, `tabs-extension` 3.10.1→3.10.7, `transform` 4.76.0→4.77.12.
    *   Runtime: `react`/`react-dom` 19.2.7→19.2.8, `mammoth` 1.12.1.
    *   Dev: `vite` 8.0.16→8.2.2, `sass`, `eslint` 10.9.0, `typescript-eslint`, `globals`, `@vitejs/plugin-react` 6.1.0, `@tauri-apps/cli` 2.11.4, Tauri plugin-dialog/store patches, `@types/*`.
3. **Notable Upstream Changes** (15.42–15.46): Mermaid WYSIWYG performance fix and gallery data-URI freeze fix (15.41.1); markdown table insertion from plain text (15.46); link creation/editing UI rework; YfmTable background inheritance fixes; CodeBlock fence-sequence preservation; `changePreviewVisible` API method; builder-method refactoring for node registration. No breaking changes within major v15.
4. **Peer Dependency Constraints Re-Confirmed**: Latest editor still requires `katex ^0.16.9` and `markdown-it ^13.0.0` — AGENTS.md rule #3 remains valid; katex 0.18 / markdown-it 15 / typescript 7 upgrades remain blocked by upstream.
5. **Transitive Dependency Check** (AGENTS.md rule #9): Verified all peer deps of the new editor version are satisfied — no new packages required beyond those already installed.
6. **Verification**: `npm run build` (tsc + vite 8.2.2) passed with zero TypeScript errors; full `npx tauri build --no-bundle` completed successfully — `gravitymd.exe` rebuilt against the updated stack.

## Phase 25: Upstream Dependency Update v2 (October 2026)
1. **Upstream Check**: Compared installed versions against the npm registry and GitHub releases of `gravity-ui/markdown-editor` (last checked in Phase 24). Five new releases since 15.46.0: 15.46.1 (settings separator spacing, Firefox caret height), 15.47.0 (builder methods for node/mark views), 15.47.1 (parser aliases, raw URL/link fixes, per-paragraph formatting), 15.48.0/15.48.1/**15.48.2** (toolbar presets for selection and slash menus, contextual preset fix, view-only bundle fix). All within major v15 — no breaking changes.
2. **Updated Packages** (`npm install ...@latest --legacy-peer-deps`):
    * `@gravity-ui/markdown-editor` 15.46.0 → 15.48.2.
    * `@gravity-ui/uikit` 7.48.1 → 7.51.0.
3. **Custom Paste-Fix API Compat Verified**: `ExtensionBuilder.overrideNodeSpec(name, cb: (prev: NodeSpec) => NodeSpec)` and `addPlugin(cb)` signatures are unchanged in 15.48.2 (checked `build/esm/core/ExtensionBuilder.d.ts`) — the `th`/`td` schema overrides and HTML table paste interceptor in `EditorWrapper.tsx` remain valid. New builder methods added (`addNodeSpec`, `addNodeView`, `addMarkSpec`, `hasNodeSpec`, ...); legacy `addNode`/`addMark` are now `@deprecated` (removal planned for the next major only).
4. **Peer Dependency Constraints Re-Confirmed**: latest editor still requires `katex ^0.16.9` and `markdown-it ^13.0.0`; react 19, `@gravity-ui/uikit ^7`, `@diplodoc/transform ^4.43`, `latex-extension ^2`, `mermaid-extension ^2`, `tabs-extension ^3.5.1` — all satisfied. New optional peers appeared (`cut-`, `file-`, `quote-link-`, `folding-headings-`, `html-extension`) — not used by the project.
5. **Verification**: `npm run build` (tsc `-b` + vite 8.2.2) passed with zero TypeScript errors; full `npx tauri build --no-bundle` completed successfully — `gravitymd.exe` rebuilt against the updated stack. Build warnings unchanged (externalized Node polyfills, direct `eval` in `@diplodoc/cut-extension`, single large chunk) — pre-existing, not caused by the update.

## Phase 26: Security Sweep & Ecosystem Update (October 2026)
1. **npm Audit Cleanup**: Vulnerability count reduced **36 → 21** in three passes:
    * Targeted semver-compatible updates of direct dependencies (see below) eliminated 7 findings.
    * `npm audit fix` (non-breaking) swept transitive deps: `prosemirror-view` (XSS in paste handling — relevant to the editor), `@xmldom/xmldom`, `brace-expansion`, `browserslist`, `dompurify`, `immutable`, `js-yaml`, `nanoid`, `sanitize-html`, `source-map-js`, `undici`, `baseline-browser-mapping`.
    * Added npm `overrides` to root `package.json`: `"decode-uri-component": ">=0.5.0"` — pinned because `css → source-map-resolve` locks it at a vulnerable `^0.2.x` line that plain `audit fix` cannot move; 0.5.0 is the only fixed version (vulnerable range `<=0.4.2`).
2. **Updated Packages** (semver-compatible, `--legacy-peer-deps`):
    * Runtime: `@diplodoc/transform` 4.77.12→4.78.4, `@gravity-ui/icons` 2.21.0→2.22.0, `@gravity-ui/navigation` 6.4.1→6.6.1 (7.x major skipped), `@tauri-apps/api` 2.11.1→2.12.1, `plugin-dialog` 2.7.2→2.8.1, `plugin-fs` 2.5.1→2.6.0, `plugin-opener` 2.5.4→2.7.0, `plugin-store` 2.4.4→2.5.0, `plugin-window-state` 2.4.1→2.5.0, `docx` 9.7.1→9.9.0, `mammoth` 1.12.1→1.13.0, `react`/`react-dom` 19.2.8→19.3.0.
    * Dev: `@tauri-apps/cli` 2.11.4→2.12.1, `@types/node` 25.9.9, `@types/react`/`@types/react-dom` 19.3.0, `@vitejs/plugin-react` 6.1.2, `eslint` 10.12.0, `eslint-plugin-react-refresh` 0.5.7, `globals` 17.13.0, `sass` 1.105.1, `typescript-eslint` 8.71.1, `vite` 8.2.2→8.3.3.
3. **Rust Side Sync**: first `tauri build` failed with version-mismatch errors (Cargo.lock crates behind the updated npm plugin packages). `cargo update` locked 194 crates to latest compatible versions (`tauri` 2.11.3→2.12.1, all `tauri-plugin-*` matched to their npm twins). Second build passed.
4. **Remaining 21 Findings — Accepted Risk** (no fix without breaking changes, none reachable from untrusted input in the app's runtime path):
    * `xlsx` (SheetJS) — prototype pollution + ReDoS; no fix published on npm. Long-term option: migrate to `exceljs`/`xlsx-js-style`.
    * `katex` `<0.18.2` + its dependents (`@diplodoc/latex-extension`, editor, mermaid) — upstream peer-locked to `^0.16.9` (AGENTS.md rule #3).
    * `linkify-it`/`markdown-it` `<=14.3` — fix needs `markdown-it` 15, blocked by `@diplodoc/mermaid-extension` peer `^13`.
    * `svgo` 3.0–3.3.4 (via `@diplodoc/transform`) — no fix available.
    * `braces`→`micromatch`→`jscodeshift`→`@gravity-ui/navigation` ≥4 — "fix" would downgrade navigation to 3.11.1; `jscodeshift` is a codemod-time path, not used at runtime.
    * `sprintf-js`→`argparse`→`mammoth` — fix would downgrade mammoth to 0.3.29; argparse sits in mammoth's CLI, not its browser conversion path.
5. **Verification**: `npm run build` (tsc + vite 8.3.3) clean; `npx tauri build --no-bundle` exit 0 after `cargo update` — `gravitymd.exe` rebuilt. Bundle shrank slightly (4620 KB vs 4676 KB before the sweep).

## Phase 27: YFM Table Handling — Save Conversion & DOCX Export Support
1. **Problem**: The editor's own table button creates YFM wide-tables (`#| ... |#` — `||` rows, `|` cells). Standard markdown table (pipe) and YFM table are different formats living in the same `.md` file. Two issues followed:
    * DOCX export used plain `markdown-it` without the YFM table plugin, so `#|` blocks were exported as literal text lines instead of a Word table, while Excel-imported (pipe) tables exported fine.
    * The YFM format is not understood by common markdown tooling (GitHub, VS Code, etc.).
2. **YFM → PIPE Save Converter**: Created `src/utils/yfmTable.ts` — `sanitizeYfmTables(markup)` parses every `#| ... |#` block and converts it to a standard pipe table when it can be done **without loss**:
    * Lossy features that keep the table in YFM form: row/col spans (`^` markers / `||` spanning cells), cell attributes (`{align=...}`), YFM-only inline markup (`%%color%%`, `[[wiki links]]`, raw HTML tags), block-level content inside cells (blank lines / headings / quotes / lists).
    * Serializer quirks handled: expanded form (each cell on its own line with blank-line padding), compact one-line rows, escaped pipes (`\|`), soft line breaks inside cells collapsed to spaces (same as markdown rendering), bare-`||` chains (row terminator + next row start).
    * Conservative bail-out: any parse anomaly means the block stays untouched.
3. **Save Flow Integration**: `EditorWrapper` now exposes an imperative handle (`EditorHandle.getSanitizedMarkup()`) via `useImperativeHandle` — save paths (`Save`, `Save As`, unsaved-changes dialog) read markup straight from the editor instead of the 300 ms-debounced React state (also fixes the stale-save race). `sanitizeYfmTables` runs in `getSanitizedMarkup`; converted tables are written back via `editor.replace(markup)` so the editor stays in sync with disk. A warning toast reports tables that could not be converted (spans etc.). `useFileOperations` now accepts an optional `getValue` parameter used by `handleSave`/`handleSaveAs`; `App.tsx` holds the `editorRef` and wires it through.
    * Keep-alive note: `dirty` compares live editor value against the save snapshot; after conversion `editor.replace` triggers the usual `change` → debounce → `setValue` cycle, so the dirty flag settles correctly.
4. **DOCX Export YFM Support**: `useExport.ts` now registers `@diplodoc/transform/lib/plugins/table` (`yfmTable` markdown-it plugin) so `#|` blocks render to a plain `<table>` DOM and flow into the existing DOCX converter.
5. **DOCX Table Grid Rewrite**: The table branch of `htmlToDocxChildren()` was rebuilt as a grid-placement algorithm: it reads `colSpan`/`rowSpan` from `th`/`td`, reserves occupied grid slots, emits `docx` `TableCell`s with `columnSpan`/`rowSpan`, sizes each cell `colWidth × colSpan` (total width 9000 DXA split equally per column) and pads ragged rows. Standard markdown tables are unaffected (no spans → same layout as before), YFM tables with merges now export with correct spans instead of shifted columns.
6. **Converter Verification**: A temporary Node script (`--experimental-strip-types`) ran the converter against 10 cases — expanded/compact serializer forms, escaped pipes, inline markup, code spans with `{}`, rowspan/colspan kept, cell attributes kept, `%%colors%%` kept, no-table passthrough, unterminated block ignored. All passed; script removed after the run.
7. **Verification**: `npm run build` (tsc + vite) — zero TypeScript errors; `npx tauri build --no-bundle` exit 0 — `gravitymd.exe` rebuilt with both features.

## Phase 28: Audit 2026-10 Remediation
Source: [AUDIT-REPORT-2026-10.md](AUDIT-REPORT-2026-10.md) (1 Critical, 10 Warning, 18 Info). Status after this phase: Critical 0; deferred items are listed at the end.
1. **Critical fixed — fenced YFM examples**: `yfmTable.ts` `findYfmBlocks` now tracks ` ``` `/`~~~` code-fence state and skips `#|`/` |#` regions inside them — documentation examples of YFM syntax are never converted on save. Also added fence-in-cell to the lossy list. Verified with a 11-case Node script (`--experimental-strip-types`): expanded sample, fenced untouched, mixed real+fenced, rowspan/colspan/attrs/colors kept, code with `{}`, escaped pipes, inline markup.
2. **Single pipe-table serializer**: created `src/utils/pipeTable.ts` (`rowsToPipeTable(header, rows)` — escapes raw `|` in cells, builds header/separator/rows). Three independent implementations converged onto it:
    * XLSX/CSV import (`useImport.ts`) — now escapes `|` in spreadsheet cells (previously broke table layout);
    * HTML-table paste rule (`EditorWrapper.tsx` turndown rule) — same escaping;
    * YFM converter — `cellsToPipe` removed; `finalizeCell` returns raw text, escaping is the serializer's job.
   `yfmTable.ts` imports the util with an explicit `.ts` extension (allowed by `allowImportingTsExtensions`) so the util is runnable via `node --experimental-strip-types` for regression tests.
3. **Clean imperative contract**: `EditorHandle.getSanitizedMarkup()` renamed to `sanitizeForSave()` returning `{ value, kept }` without side effects. The kept-YFM warning toast moved into `useFileOperations.persist() — the single persistence point for Save and Save As (also fixed a regression in this refactor: Save As still sets `currentFile`). `App.tsx` passes `editorRef.current.sanitizeForSave()` as `getValue`.
4. **App init hardening**: the initialization `useEffect` wraps `getVersion()`/`invokeGetInitialFile()` in try/catch — a failure logs, shows a toast and still `setReady(true)` (no permanent white screen). Added a `file-open` event listener (lost during earlier refactor): second-launch file paths forwarded by single-instance now load into the running app.
5. **DOCX export — blockquote without class-instance spread**: `htmlToDocxChildren(container, context)` gained a quote context; blockquote paragraphs receive indent/left-border/spacing at creation time via `withQuote()` (previous `new Paragraph({ ...innerChild })` spread was an unsafe clone of a docx class instance). The generic div/section recursion and details branch pass the context through.
6. **DOCX export — nested lists**: previous behavior lost/flattened sublist content inside `li`. New `appendListItems()` clones each `li`, removes its direct sublists to build the inline part, emits the item at the current level and recurses into sublists one level deeper (capped at 2 levels: `MAX_LIST_LEVEL = 1`); `default-numbering` config gained level 1 (`'%2.'`). Unordered sublists use `bullet: { level: 1 }`.
7. **Single instance**: added `tauri-plugin-single-instance` (Rust, crate 2.5.2, npm not required). The callback focusses/un-minimizes the primary window and emits `file-open` with the second launch's file argument — double-clicking a .md while the app runs now routes the file into the existing window instead of spawning a competing process (also removes the window-state file race described in the audit).
8. **Hygiene**: filled `src-tauri/Cargo.toml` metadata (description, authors, `license = "MIT"`, repository URL); fixed README LICENSE link (`file:///D:/...` → relative); theme toggle icon for solarized is now `Palette` (was `Sun` like dark); `history.md` Phase 16 annotation added — zoom persistence is real, the hook is the source of truth; moved `test-*.mjs`, `test.docx`, `test2.docx` debug artifacts to `scripts/debug/`.
9. **Deferred (deliberately out of this pass)**: Web Worker for mammoth/XLSX/DOCX conversions (main-thread freeze on huge files); structured IPC error payloads; plugin-fs error discrimination beyond substring matching; portal-based dialogs missing the solarized variable scope (visual only).
10. **Verification**: 11/11 converter tests passed (temporary script, removed after run); `npm run build` zero TypeScript errors; `npx tauri build --no-bundle` exit 0 with the new Rust plugin — `gravitymd.exe` rebuilt.

## Phase 29: Deferred Audit Items — Workers, Structured IPC Errors, Solarized Portals
Continues after Phase 28 by clearing the deferred list from [AUDIT-REPORT-2026-10.md](AUDIT-REPORT-2026-10.md).
1. **Web Workers for heavy conversions**: created `src/utils/worker.ts` (`runWorker()`: one-shot request/response + terminate) and three workers in `src/workers/`:
    * `docxImport.worker.ts` — mammoth → HTML → turndown → Markdown off the main thread;
    * `xlsxImport.worker.ts` — SheetJS → Markdown table via the shared `rowsToPipeTable`;
    * `mdRender.worker.ts` — Markdown → HTML for DOCX export (markdown-it + LaTeX + YFM-table plugin).
   `useImport` and `useExport` now spawn a worker per action. **Boundary of honesty**: `DOMParser` and `Blob` are unavailable inside workers, so the markdown→HTML step (the heavy regex/render part) is offloaded, while the DOM→docx-object conversion and packing stay on the main thread. Bundle effect: main chunk 4625 → 3823 KB (410–430 KB worker chunks load lazily per action).
2. **Structured IPC error payloads**: Rust commands (`read_file_content`, `write_file_content`, `write_file_binary`) now return `Result<T, AppError>` where `AppError = { code, message }` (serde-serialized). `io::ErrorKind` maps to codes: `FS_NOT_FOUND`, `FS_ACCESS_DENIED`, `FS_INVALID_DATA`, `FS_IO_ERROR`; plus `FS_PATH_TRAVERSAL`, `FS_UNSUPPORTED_EXTENSION`, `FS_INVALID_BINARY`. TypeScript contract: `types/ipc.ts` `ipcErrorPayload()`/`formatIpcError()` normalize anything caught across IPC; error toasts now show the real reason (`Error saving file: FS_ACCESS_DENIED: …`). Access-error discrimination in `utils/ipc.ts` became code-first; substring matching remains only for plugin-fs's own unstructured errors and is documented as the legacy path.
3. **Solarized theme on portal anchors**: `theme-solarized-light` class moved from `.app-container` to `document.body` (side-effect `useEffect` with `classList.toggle`). Portal-based Gravity UI Dialogs (`About`, `UnsavedChanges`) and the portal Toast stop falling back to default light colors in the solarized-theme; the variable scope in `solarized-light.scss` is unchanged.
4. **Verification**: `npm run build` — zero TypeScript errors; three `*.worker.*.js` chunks emitted; `npx tauri build --no-bundle` exit 0 (Rust `AppError` compiles; `gravitymd.exe` rebuilt). Smoke-test expectations for a manual run: import a large DOCX/XLSX (UI must stay responsive), export a document with YFM spans (toast text now may include `FS_*` codes on failures), switch to solarized and open About / unsaved-changes dialogs (colours should follow the theme).

## Phase 30: Update Check on Startup
1. **Feature**: on every app start (after `ready`) the app asks GitHub for the latest published release and, when it is newer than the running version, shows a non-blocking "Update Available" dialog offering to download.
2. **Implementation**:
    * `src/utils/versionCheck.ts` — `fetchLatestGitHubVersion()` (GET `api.github.com/repos/ButcchPro/gravity-markdown/releases/latest`, parses `tag_name`, strips the leading `v`; any failure — offline, HTTP error, rate limit — returns `null` and never breaks startup) and `isNewer(current, latest)` (numeric dot-version comparison).
    * `src/hooks/useUpdateCheck.ts` — single check per start, fire-and-forget; "Skip this version" persists `skippedVersion` in `app-store.json` (`plugin-store`), so the same release is not advertised again; dismissing (×/Esc/overlay) asks again next start.
    * `src/components/UpdateDialog.tsx` — Gravity Dialog in the established app dialog style; "Update" opens the Releases page in the system browser via the existing `@tauri-apps/plugin-opener`.
    * `App.tsx` wires the hook (`useUpdateCheck(ready)`) and renders `UpdateDialog` beside `About`/`UnsavedChanges`.
    * **CSP**: `connect-src 'self' https://api.github.com` appended to `tauri.conf.json` `security.csp` — without it the external `fetch` is blocked by `default-src 'self'`.
    * Dialog body styles `.update-dialog-body` added to `App.scss` in the existing pattern (`about-content`, `unsaved-dialog-body`).
3. **Verification (Phase 30)**: 8/8 Node checks (`--experimental-strip-types`): numeric comparison incl. length differences (1.0 vs 1.0.1), plus a live probe against the real GitHub API returning the current published tag (1.0.4). `npm run build` — zero TS errors; `npx tauri build --no-bundle` exit 0 — `gravitymd.exe` rebuilt with CSP and the new dialog. Manual smoke: bump release on GitHub → next launch shows the dialog with the new version; "Skip this version" silences that release.
4. **DOCX Export Margins (post-release tweak, Oct 2026)**: page margins changed from Word "Normal" (1 inch all sides, 1440 twips) to RU/GOST-style proportions by user request — top/right/bottom **2 cm** and left **2.5 cm** (twips: 1134/1134/1134/1417; 1 cm = 567 twips) — the left margin is wider per RU document conventions (binding reserve). Verified: `npm run build` + `npx tauri build --no-bundle` exit 0; `gravitymd.exe` rebuilt. Commit on top of the v1.0.5 release commit is omitted; will ride with the next version bump (1.0.6).

## Phase 31: Utility Tests, Lint Cleanup (local, after v1.0.5 commit)
1. **Rediscovered test suite**: created `tests/utils.test.ts` (permanent, 20 checks) and the `npm run test:utils` command — runs via `node --experimental-strip-types`, so commonjs/tsx tooling is not needed. Covers: YFM→PIPE converter (fence skipping, spans/attrs kept, expanded/compact forms, escapes), the shared `rowsToPipeTable` serializer, version comparison incl. length differences, and a live GitHub probe (graceful SKIP offline). Addresses the audit Info item about the parser being regression-critical without tests.
2. **ESLint hygiene results (`npm run lint`, first run on the upgraded stack)**:
    * `src-tauri/target/**` tauri-codegen artifacts were linted as JS (66 parsing "errors") — added to `globalIgnores` in `eslint.config.js`.
    * New `react-hooks/refs` rule from the upgraded plugin flagged the `dirtyRef.current = dirty` render-time assignment — moved into a proper `useEffect([dirty])`.
    * Removed a stale `eslint-disable-next-line react-hooks/exhaustive-deps` directive (no longer needed after the plugin upgrade changed rules).
3. **Verification**: `npm run lint` — 0 errors 0 warnings; `npm run test:utils` — 20/20; `npm run build` + `npx tauri build --no-bundle` — exit 0, `gravitymd.exe` rebuilt.
