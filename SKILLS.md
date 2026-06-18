# GravityMD — Skills Registry

## 🧠 Execution Philosophy
*Every skill below is a tool, not a mandate. Deploy only according to Engineering Principles in `.antigravity.md`.*
- *Do not add orchestration layers if a direct function call solves the task.*
- *Apply surgically: only touch the layer required by the verifiable goal.*

## Skill: Markdown Editing (Gravity UI)
- **Description:** Full-featured WYSIWYG and markup markdown editor.
- **Implementation:** `useMarkdownEditor` hook with `MarkdownEditorView` component.
- **Modes:** WYSIWYG (default) and markup with `md: { html: false }`.
- **Extensions:** LaTeX (KaTeX rendering), Mermaid (diagram rendering) via extension builder.

## Skill: File System Access (Tauri)
- **Description:** Native OS file dialogs for open/save operations.
- **Implementation:** `@tauri-apps/plugin-dialog` (open/save dialogs) + `@tauri-apps/plugin-fs` (read/write).
- **Behavior:** "Save" overwrites current file; "Save As" prompts for new path. File path tracked in `currentFile` state.

## Skill: DOCX Import (mammoth + turndown)
- **Description:** Convert Word documents to editable Markdown.
- **Pipeline:** .docx → binary → mammoth.convertToHtml() → TurndownService.turndown() → Markdown string.
- **Binary Safety:** ArrayBuffer sliced via `.buffer.slice(byteOffset, byteOffset + byteLength)`.
- **Warnings:** mammoth `result.messages` logged to console for conversion quality feedback.

## Skill: DOCX Export (markdown-it + html-to-docx)
- **Description:** Export editor content as a Word document.
- **Pipeline:** Markdown string → MarkdownIt.render() → html-to-docx() → Blob/ArrayBuffer → writeFile().
- **Dynamic Import:** html-to-docx loaded via `import('html-to-docx')` to keep initial bundle lean.
- **Blob Handling:** Checks `instanceof Blob` before conversion to Uint8Array.

## Skill: XLSX Import (SheetJS)
- **Description:** Convert spreadsheet data to Markdown tables.
- **Pipeline:** .xlsx → XLSX.read() → sheet_to_json(header:1) → Markdown table formatting.
- **Cell Sanitization:** `fmt(cell)` converts null/undefined/numbers to safe strings via `String(cell ?? '')`.
- **Append Mode:** Tables are appended to existing content, not replacing it.

## Skill: Theme Switching (Gravity UI)
- **Description:** Runtime theme cycling between Light, Dark, and Solarized Light.
- **Implementation:** `<ThemeProvider theme={gravityTheme}>` wrapping the app. Sun/Moon icon rotates through 3 themes.
- **Solarized Light:** CSS class `theme-solarized-light` on app-container overrides all `--g-color-*` variables with Solarized palette. Gravity UI base theme is `light`. Colors: base3 (#fdf6e3) background, base00 (#657b83) text, blue (#268bd2) links, etc.
- **Persistence:** Theme saved to `app-store.json` via `@tauri-apps/plugin-store`. Loaded on startup before render to prevent flash.
- **Requirement:** `<ToasterProvider>` + `<ToasterComponent>` must be present or React crashes on startup.

## Skill: Window State Persistence
- **Description:** Automatically saves and restores window position, size, and maximize state.
- **Implementation:** `tauri-plugin-window-state` registered in Rust backend. No frontend code needed — plugin handles everything.
- **Storage:** App-local directory, managed by Tauri.

## Skill: File Association (.md)
- **Description:** Opening .md files from Windows Explorer launches the app with the file loaded.
- **Configuration:** `fileAssociations` in `tauri.conf.json` for `.md` and `.markdown` extensions.
- **Flow:** Rust reads CLI args → emits `file-open` event → frontend `listen('file-open')` → `readTextFile` → loads into editor.
- **Note:** Requires NSIS/MSI installer to register file associations in Windows Registry.

## Skill: Version Management (npm)
- **Description:** Tracking and updating Gravity UI ecosystem dependencies.
- **Blocked:** katex (^0.16.x locked) and markdown-it (^13.x locked) — peer dependency constraints from extensions.
- **Command:** `npm outdated` for checking; `npm install <pkg>@latest --legacy-peer-deps` for updating.

## Skill: Desktop Build (Tauri)
- **Description:** Compile to native Windows executable and installer.
- **Command:** `npx tauri build`
- **Artifacts:** `src-tauri/target/release/gravitymd.exe` + `nsis/gravitymd_1.0.0_x64-setup.exe`
- **Requirement:** `base: './'` in vite.config.ts — absolute paths break Tauri's local protocol.