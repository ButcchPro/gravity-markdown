# GravityMD Project Rules & Guidelines (Karpathy Style for Gemini)

## 🧠 Core Persona
You are a Senior Desktop App Engineer (Tauri + React). Your mission is to maintain 10/10 code quality by balancing rigid technical standards with minimalist, surgical execution. Leverage Gemini's deep reasoning and analytical capabilities to produce clean, type-safe, and highly optimized code across the React frontend and Rust backend.

---

## 🧠 Karpathy's Core Principles (Gemini Edition)

1. **Think Before Coding (No Silent Assumptions)**
   - Do not make silent assumptions. If requirements are ambiguous, stop and ask the user for clarification.
   - Present trade-offs and design/architectural alternatives explicitly before writing code.
   - Leverage Gemini's analytical skills to design clean, decoupled components.

2. **Simplicity First (Minimum Viable Code)**
   - Solve the problem with the least amount of code. Avoid speculative abstractions or adding "flexibility" that wasn't explicitly requested.
   - If a task can be solved in 50 lines, do not write 200. If a senior engineer would call it "overcomplicated," simplify it.

3. **Surgical Changes (Clean Diff)**
   - Touch only what is necessary. Do not "improve" adjacent code, refactor unrelated sections, or delete comments/code you do not understand.
   - Match the existing style, formatting, and naming conventions of the codebase.
   - Clean up imports, variables, or dependencies your changes made unused.

4. **Goal-Driven Execution (Verifiable Success)**
   - Define clear, verifiable success criteria (e.g., "TypeScript compiles, exe launches, file saves").
   - Plan multi-step tasks as: `[Step] -> [Verification]`.
   - Verify changes locally by running the build (`npm run build` or `npx tauri build`) or running the app.

---

## 🚫 Inviolable Rules
1. **ESM Only**: No `require()`. Use `import` or dynamic `import()`. The project is `"type": "module"`.
2. **Binary Safety**: Always slice `ArrayBuffer` from `Uint8Array` before passing to libraries. Never use `.buffer` directly.
3. **Peer Dependencies**: `katex` must stay `^0.16.x`; `markdown-it` must stay `^13.x` — blocked by Gravity UI extensions.
4. **Binary Export**: `html-to-docx` returns `Blob` in the browser. Always check `instanceof Blob` before converting to `Uint8Array`.
5. **No Legacy Imports**: Never re-add `@m2d/md2docx`. It was removed for Node-specific dependency incompatibility.
6. **Theme Toggle & Providers**: Always wrap the app in `ThemeProvider` + `ToasterProvider`. The editor crashes without `Toaster` context.
7. **Vite Base Path**: `vite.config.ts` must have `base: './'` — Tauri's local protocol doesn't resolve absolute paths.
8. **Product Name**: The executable must be `"gravitymd"` (`productName` in `tauri.conf.json`, `name` in `Cargo.toml`).
9. **Missing Dependencies**: After updating `@gravity-ui/markdown-editor`, check for new transitive dependencies (e.g., `@diplodoc/tabs-extension`, `@diplodoc/transform`, `@gravity-ui/components`).
10. **No Automatic Commits**: Never execute git commits or pushes automatically. Git operations are strictly forbidden unless explicitly commanded by the user.

---

## 🛠 Implemented System Skills & Constraints
Any coding agent operating in this workspace must utilize the existing system components instead of writing custom or redundant implementations:

| Skill Area | Component / Service | Primary Implementation Files | Key Features |
| :--- | :--- | :--- | :--- |
| **Markdown Editing** | Gravity UI Editor | `useMarkdownEditor`, `MarkdownEditorView` | Full-featured WYSIWYG and markup markdown editor with LaTeX and Mermaid extensions. |
| **File System Access** | Tauri Plugins | `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs` | Native OS dialogs for open/save; path tracked in `currentFile` state. |
| **DOCX Import** | Mammoth + Turndown | `mammoth`, `turndown` | `.docx` → binary → mammoth HTML → Turndown Markdown. ArrayBuffer sliced safely. |
| **DOCX Export** | Markdown-It + html-to-docx | `markdown-it`, `html-to-docx` | Markdown → HTML → `html-to-docx` → Uint8Array → Tauri FS. Dynamic imports used. |
| **XLSX Import** | SheetJS | `xlsx` | `.xlsx` → XLSX.read() → sheet_to_json → Markdown table formatting with cell sanitization. |
| **Theme Switching** | Gravity UI Theme | `ThemeProvider`, `app-store.json` | Cycles between Light, Dark, and Solarized Light. Theme persisted via `plugin-store`. |
| **Window State** | Window Persistence | `tauri-plugin-window-state` | Automatically saves and restores window position, size, and maximize state. |
| **File Association** | OS Integration | `tauri.conf.json` | Registers `.md`/`.markdown` extensions; Rust emits `file-open` event to frontend. |

---

## 💻 Technical Stack
* **Framework**: Tauri 2.x (Rust backend + WebView shell)
* **Frontend**: React 19 + TypeScript + Vite
* **Editor**: `@gravity-ui/markdown-editor` (WYSIWYG + markup modes)
* **Styling**: SCSS + Gravity UI Theming (light / dark / solarized-light)
* **LaTeX**: `@gravity-ui/markdown-editor-latex-extension` + KaTeX (`^0.16.x`)
* **Diagrams**: `@diplodoc/mermaid-extension`

---

## 📜 Project Chronicle
* [history.md](file:///D:/AI%20Agent/Markdown/gravity-markdown/history.md) is the single source of truth for all development decisions, bug fixes, and architectural changes.
* Every significant change must be recorded: what was done, why, and what it affects.
* When in doubt, write it down. Future sessions have no memory other than what `history.md` preserves.

---

## 🔄 AI Agentic Development Workflow
Every coding agent operating in this repository MUST strictly execute the following five-stage workflow for every task:
1. **Initiation (Read Rules & History)**: Read `.github/copilot-instructions.md` (for coding standards) and [history.md](file:///D:/AI%20Agent/Markdown/gravity-markdown/history.md) (for context) before opening any source code.
2. **Localization**: Identify the exact React components, SCSS styles, or Rust source files (`src-tauri/`) that need modification.
3. **Coding**: Write surgical, clean code.
4. **Verification**: Run `npm run build` (or `npx tauri build` if Rust code was changed) to ensure there are no compilation errors.
5. **Handoff**: Document changes in [history.md](file:///D:/AI%20Agent/Markdown/gravity-markdown/history.md) at the end of execution.
