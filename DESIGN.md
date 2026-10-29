---
name: GravityMD
description: Local-first Markdown editor with format-honest Word round-trips.
colors:
  surface-background: "var(--g-color-base-background)"
  surface-chrome: "var(--g-color-base-generic)"
  surface-hover: "var(--g-color-base-generic-hover)"
  surface-selection: "var(--g-color-base-selection)"
  text-primary: "var(--g-color-text-primary)"
  text-complementary: "var(--g-color-text-complementary)"
  text-secondary: "var(--g-color-text-secondary)"
  line-generic: "var(--g-color-line-generic)"
  line-active: "var(--g-color-line-generic-active)"
  brand: "var(--g-color-base-brand)"
  link: "var(--g-color-text-link)"
  positive: "var(--g-color-base-positive-heavy)"
  warning: "var(--g-color-text-warning)"
  danger-strong: "var(--g-color-text-danger-heavy)"
typography:
  body:
    fontFamily: "var(--g-font-family-sans)"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
  headline:
    fontFamily: "var(--g-font-family-sans)"
    fontSize: "1.9em"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title:
    fontFamily: "var(--g-font-family-sans)"
    fontSize: "1.45em"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  label:
    fontFamily: "var(--g-font-family-sans)"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.2
  meta:
    fontFamily: "var(--g-font-family-sans)"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1
    fontFeature: "tabular-nums"
rounded:
  pill: "999px"
  lg: "8px"
  sm: "6px"
spacing:
  hairline: "4px"
  tight: "8px"
  base: "10px"
  roomy: "16px"
  gutter: "21px"
  chrome: "28px"
components:
  button-flat:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
    height: "28px"
  button-action:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.pill}"
    padding: "6px 16px"
    height: "28px"
  button-danger-outlined:
    backgroundColor: "transparent"
    textColor: "{colors.danger-strong}"
    rounded: "{rounded.pill}"
    padding: "6px 16px"
    height: "28px"
  status-bar:
    backgroundColor: "{colors.surface-chrome}"
    textColor: "{colors.text-complementary}"
    size: "28px"
  dialog:
    backgroundColor: "var(--g-color-base-float)"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
---

# Design System: GravityMD

## Overview

**Creative North Star: "The Paper Instrument"**

GravityMD is a writing instrument, not a document portal: the page is the work, the chrome is the instrument's body. Everything above and below the prose is deliberately quiet — one hairline-bordered toolbar, one 28 px identity strip — and the document column is the only place that carries weight. The system inherits its material from Gravity UI (one pill button, one dialog surface, one focus ring) and its warmth from the Solarized paper that the theme switcher can lay over it.

Density is compact by intent: 10 px paragraph rhythm, 1.45 leading, 12–13 px chrome type. The density serves long editing sessions on a laptop, not marketing screens; the document keeps the full width of the window between 21 px gutters (owner decision), so long lines stay a matter of the window size rather than a fixed column. Accent color is reserved for state — unsaved changes, links, destructive confirmation — because a writing tool's calm is its product feature.

**Key Characteristics:**
- Paper-first composition: one centred prose column, chrome at the edges.
- Gravity UI geometry: pill controls, quiet flat surfaces, a single soft toolbar lift.
- Three live themes (Dark / Light / Solarized) driven by the same token names.
- Compact chrome (12–13 px, 28 px bars) against a 15 px / 1.45 body.
- Semantic color only: brand for action, danger-strong for destructive state, positive/warning dots for status.

## Colors

A neutral paper system with one warm action accent; all values are Gravity UI semantic tokens so any theme swap re-paints the entire surface, portals included.

### Primary
- **Instrument Yellow** (`var(--g-color-base-brand)`): the single action voice — primary buttons ("Update"), editor focus accent, caret. Rare by rule.
- **Reading Blue** (`var(--g-color-text-link)`): links inside documents and dialogs; never used for chrome buttons.

### Neutral
- **Paper Background** (`var(--g-color-base-background)`): the editing canvas and dialog body.
- **Instrument Chrome** (`var(--g-color-base-generic)`): the app toolbar, editor rail, and status bar — a half-step darker than paper so the document reads as the lighter surface.
- **Body Ink** (`var(--g-color-text-primary)`): document text, the file name, active labels.
- **Instrument Ink** (`var(--g-color-text-complementary)`): status-bar meta, zoom readout, version chip — the 4.5:1-safe secondary voice.
- **Hairline** (`var(--g-color-line-generic)`): status-bar top border, table rules; **Hairline Active** (`var(--g-color-line-generic-active)`) separates the two toolbars.
- **Selection Film** (`var(--g-color-base-selection)`): text selection, matching the active theme.

### Semantic
- **Dirty Red** (`var(--g-color-text-danger-heavy)`): the Save control and destructive dialog actions; heavy variant so it clears AA on every theme.
- **Saved Green** (`var(--g-color-base-positive-heavy)`): the status dot when the document is saved.
- **Unsaved Amber** (`var(--g-color-text-warning)`): the status dot when edits are pending.

### Named Rules
**The Chrome Whisper Rule.** Chrome never uses the brand accent. Accent appears only on the single primary action of the current dialog and on the caret; a toolbar with two yellow buttons has failed.

**The No Pure Black Rule.** Document text is `--g-color-text-primary`, never `#000`; the Solarized theme remaps it to ink on paper (`#073642` on `#fdf6e3`) without touching component code.

## Typography

**Display Font:** Gravity UI sans stack (`var(--g-font-family-sans)`) — no second family.
**Body Font:** same stack; the editor's ProseMirror uses the app default.
**Mono Font:** Gravity UI mono tokens inside code blocks only.

**Character:** One family, two registers — a compact instrument register for chrome (12–13 px, 500 weight) and a comfortable reading register for the document (15 px / 1.45). Hierarchy is carried by size ratio and weight, not by color.

### Hierarchy
- **Headline** (600, 1.9em of body, 1.25, −0.01em): document H1; only one per document, first block has no top margin.
- **Title** (600, 1.45em, 1.25): H2 section heads.
- **Subtitle** (600, 1.2em / 1.05em, 1.25): H3–H6; sizes step down through weight and space rather than color.
- **Body** (400, 15 px, 1.45, full window width): paragraphs, lists, tables; 10 px paragraph rhythm.
- **Label** (500, 13 px, 1.2): toolbar labels, Save state.
- **Meta** (400, 12 px, tabular numerals): status bar, zoom readout, version chip.

### Named Rules
**The One Family Rule.** No second typeface is introduced for chrome or headings; when the hierarchy needs more contrast, use weight and space, not a new font.

**The Tabular Instrument Rule.** Every changing number (word count, zoom %, version) uses `font-variant-numeric: tabular-nums` so counters do not jitter.

## Layout

Single-window desktop composition: a two-row header (app toolbar 44 px, editor rail 36 px), the document column, and a 28 px status footer. The document fills the editor width between 21 px gutters; there is no column cap — the owner prefers the full-width page over a centred measure. Breakpoints are content-driven: below 1080 px verb labels collapse to icons (unique accessible names remain); below 860 px the toolbar tightens its gap to 4 px and the zoom slider shrinks to 56 px. The window floor is 760×480. The zoom slider scales the editor content only, so the line count per width follows the zoom level.

## Elevation & Depth

Flat by default; tonal layering does the work — paper surface, chrome surface, dialog float surface. Exactly one shadow exists in the chrome: the toolbar lift (`0 2px 6px rgba(0, 0, 0, 0.12)`) plus its hairline. Dialogs own their elevation through Gravity UI's float surface; nothing else in the editor casts a shadow.

### Shadow Vocabulary
- **Toolbar lift** (`box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12)`): separates the app toolbar from the document; appears once, never repeated on inner bars.

### Named Rules
**The Single Lift Rule.** Only the app toolbar casts a shadow. Inner toolbars separate with a hairline, not with depth.

## Shapes

Pill geometry for every control (`border-radius: 999px` on buttons, sliders' thumbs are circles), 8 px corners for dialog surfaces, 6 px for scrollbar thumbs and code shims. Borders are hairlines (1 px) at `--g-color-line-generic`; the active separator between chrome rows uses the stronger line token. Nothing is clipped or masked; the form language is rectangular paper with pill instruments.

## Components

### Buttons
- **Shape:** pill (`999px`), 28 px tall, 12 px horizontal padding for flat, 16 px for action.
- **Primary (action):** brand fill on one dialog action only ("Update", "Insert at cursor").
- **Flat:** transparent, `text-primary` ink; this is the toolbar's default so the bar stays quiet.
- **Danger outlined:** destructive confirmations ("Replace document") — outlined pill with `danger-strong` label, never a filled red button.
- **Hover / Focus:** Gravity UI hover surface; focus is a 2 px `text-primary` ring (contrast replaced the stock 2.4:1 accent ring).

### Status Bar
- **Shape:** 28 px footer, hairline top border, chrome background.
- **Content:** file name (500 weight, ellipsis) + parent path (complementary, ellipsis); centred save state with a 6 px dot (green saved / amber dirty) inside `role="status" aria-live="polite"`; right-aligned `N words · mode` in tabular numerals.
- **Behaviour:** survives 800 px windows without overflow; long names truncate, never wrap.

### Dialogs
- **Shape:** Gravity UI dialog on the float surface, 8 px corners, `s` size for confirmations.
- **Content order:** caption names the state ("Replace document?"), body states the consequence with real file names, footer orders actions by risk: destructive action first, secondary next, Cancel last.
- **Focus:** Escape closes; the destructive action is never the default focus.

### Editor Column
- **Shape:** full-width document between 21 px gutters, no card around it.
- **Type:** 15 px / 1.45, headings 1.9/1.45/1.2/1.05 em, tables with hairline grid and 14 px separation.
- **Surfaces:** caret and selection themed from the palette; scrollbars are 10 px thumbs on the line token.

## Do's and Don'ts

### Do:
- **Do** keep the document the only high-contrast surface: chrome stays on `base-generic`, prose on `base-background`.
- **Do** express state with a dot plus text ("Unsaved changes"), never colour alone.
- **Do** let the document use the full editor width; width is the window's decision, not a fixed column.
- **Do** use tabular numerals for any counter that changes.
- **Do** keep destructive actions outlined and last-to-Cancel in the footer order.

### Don't:
- **Don't** put the brand accent on chrome controls; it belongs to one primary action and the caret.
- **Don't** add a second shadow or a card around the editing column.
- **Don't** introduce a second typeface for headings or labels.
- **Don't** show internal error codes (`FS_*`) as toast copy; codes stay in logs, users get a sentence.
- **Don't** hide essential toolbar actions below 860 px — collapse labels to icons; accessible names must survive.
