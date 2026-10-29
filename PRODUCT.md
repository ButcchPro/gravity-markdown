# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Technical writers, engineers and documentation-adjacent specialists on Windows/macOS who keep plain `.md` files on disk and treat Markdown as the durable source format. They write notes, specs, README-like docs and release notes, often bilingual RU/EN, and frequently need to round-trip that content through Word/Excel for colleagues who live in Office.

Job to be done: open a local markdown file, edit it without fighting the markup, and hand it to the rest of the company as a Word document — without leaving the file as the source of truth. *(inferred from repo evidence, README, history.md and the shipped UI)*

## Product Purpose

A single-window desktop Markdown editor that opens instantly, edits `.md` in place and converts Office formats both ways. Success: the user opens a file from Explorer, edits, saves, exports a presentable DOCX, and never worries where the file is or whether their work was lost.

## Positioning

On-device, format-honest markdown pipeline: YFM wide-tables are normalised to standard pipe tables on save (so GitHub/VS Code stay compatible), DOCX export preserves merged cells and RU/GOST page margins, and all heavy conversions run in background workers on the local machine — no cloud, no account, no upload. *(capabilities verified in code; positioning inferred)*

## Operating Context

- Windows-first desktop app packaged with Tauri 2 (`gravitymd.exe`, MSI/NSIS installers), macOS universal build via CI; file associations for `.md`/`.markdown`; single-instance with file handoff from Explorer.
- Three themes (dark, light, solarized light), content zoom 80–200% persisted, window state persisted.
- Office round-trips: DOCX import (mammoth → turndown), XLSX/CSV import (SheetJS), DOCX export (`docx` library with grid tables, Cambria Math for LaTeX).
- LaTeX (KaTeX) and Mermaid diagrams supported inline; WYSIWYG and raw-markup editing modes.
- Distribution through GitHub Releases with a startup update check; app version shown in About.

## Capabilities and Constraints

- Editor engine: `@gravity-ui/markdown-editor` (ProseMirror + CodeMirror); katex `^0.16.x` and markdown-it `^13.x` are pinned by upstream peer dependencies.
- File IO is gated: Rust commands enforce extension whitelists (read/write text: md/txt/markdown, write binary: docx), 32 MB cap, structured `{code, message}` errors; capabilities allow arbitrary paths for Cyrillic/restricted locations.
- No account, telemetry, or cloud sync; network access is limited to the GitHub release check (`connect-src https://api.github.com`).
- Undecided / not implemented: autosave, spell check, GPT assistant, recent-files list, tabbed editing, multi-window.

## Brand Commitments

Name **GravityMD** (executable `gravitymd`), author Andrey Obushev / OpenSky Kft., MIT licence. Built on Gravity UI Markdown Editor — attribution is a documented commitment (About + README credits). No logo or marketing copy beyond the icon assets in the repo.

## Evidence on Hand

- `README.md` (features, install, credits), `history.md` (24+ development phases: bug fixes, audit remediations, release notes), `AUDIT-REPORT.md` / `AUDIT-REPORT-2026-10.md` (quality and UX audits), `LICENSE`.
- Real shipped releases v1.0.2–v1.0.5 with Windows x64/ARM64 and macOS universal installers.
- `impeccable-shots/01–12` — live screenshots of the current app (themes, 800×600 window, dialogs, zoom 200%).
- No user research, analytics, testimonials, or support transcripts exist; future work must not fabricate them.

## Product Principles

1. **The file on disk is the truth.** Autosave, guards, and status must always answer "which file, and is my work safe?" before anything else.
2. **Markdown must stay portable.** Anything the editor writes has to open correctly in GitHub, VS Code and plain text — format-honesty beats rich-only features.
3. **Local, private, fast.** Heavy work happens on the machine and off the UI thread; no account or upload is ever required.
4. **Office is a destination, not a second home.** DOCX/XLSX round-trips should produce documents that look deliberate to Word users, without turning the editor into an Office clone.
5. **Desktop manners.** Keyboard access, native menus, window behaviour, and predictable file operations are part of the product, not polish.

## Accessibility & Inclusion

No formal standard has been committed yet. The shipped audit (2026-10) measured WCAG 2.1 AA failures (contrast, focus visibility, keyboard trap in the editing surface) that this product must fix; keyboard-only operation of the full primary flow (open → edit → save → export) is a baseline requirement. *(inferred from audit evidence; formal target still open)*
