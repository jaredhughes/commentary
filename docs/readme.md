# Rendered Markdown Commenting Extension — Specification

## Overview

The extension focuses on a *doc‑first* workflow: select text in the rendered preview, add comments, review them in a sidebar, and optionally send them to an AI agent. No PRs, no diffs, and no source file pollution.

## Key Requirements

### Rendering & Themes

* Default stylesheet: **GitHub Markdown CSS** (MIT license)
* Additional optional themes: *Markdown CSS*, *mdBook CSS*, *Primer*, *Tokyo Night*, etc.
* Theme sources must be open‑source and compatible with redistribution in the extension
* User can override via `rmc.theme.customCssPath`

### Commenting UX

* Drag‑select → floating comment bubble
* Bubble contains: text area, **Save**, **Cancel**, **Send to Agent** buttons
* Saved comment immediately highlights the selected range
* Hover highlight → small tooltip preview
* Clicking highlight → focus comment in sidebar and scroll into view
* No threading — single comment per highlight
* Highlights use `<mark data‑note‑id="…">` with theme‑aware CSS

### Sidebar Panel (Primary Sidebar)

* Lists comments in document order
* Shows: line range, snippet, created timestamp
* Click → scroll preview to selection
* Toolbar buttons:

  * **Send All to Agent**
  * **Filter by file**
  * **Export / Import comments**
  * **Delete All (confirmation)**

### Persistence

* Option A (default): VS Code workspace storage (not tracked by git)
* Option B: Sidecar JSON files (e.g., `.comments/<file>.json`) for shareable reviews
* Storage model:

```ts
interface Note {
  id: string;
  file: string;
  quote: { exact: string; prefix?: string; suffix?: string };
  position: { start: number; end: number };
  lines?: { start: number; end: number };
  text: string;
  createdAt: string;
}
```

### AI Agent Integration

(unchanged — see above)

### Anchor Strategy (Confirmed)

We will use a **3-layer fallback** to re-attach comments after document edits, in this priority order:

1. **TextQuoteSelector** — `{ exact, prefix, suffix }` (Hypothesis style) for robust, content-based anchoring.
2. **TextPositionSelector** — `{ start, end }` (character offsets) for fast recovery when structure is unchanged.
3. **Nearest Heading + fuzzy search** — fallback by walking up the DOM to the nearest heading, then scanning the section for the `exact` quote (tolerant to minor diffs).

If all fail: show **"Couldn't match — click to re-anchor"** with a pick-from-selection workflow.

### Theme Configuration

* **Default**: GitHub Markdown CSS (MIT)
* **Built-in themes** (shipped in `/themes`):

  * `github-light.css`, `github-dark.css`
  * `primer-light.css`, `primer-dark.css`
  * `tokyo-night.css`
  * `mdbook.css`
* **Settings**:

```jsonc
{
  "rmc.theme.name": "github-light",     // one of built-ins; defaults to github-light
  "rmc.theme.customCssPath": "",         // absolute or workspace-relative path to a CSS file
  "rmc.theme.useCustomFirst": false       // if true and custom path set, load custom before built-in
}
```

* Theme is applied **only** to the preview webview. Highlights (`.rmc-highlight`) adapt via CSS variables.

### Event Flow (Selection → Comment → Sidebar → Agent)

```
[User drag-selects in preview]
          │
          ▼
 [Overlay script reads window.getSelection()]
          │
          ├─ Serialize selection → { TextQuote, TextPosition }
          │
          ├─ Show compose bubble (Save / Cancel / Send to Agent)
          │
          ├─ Save → postMessage → Extension host
          │               │
          │               ├─ Persist to storage (workspace or sidecar)
          │               └─ Update Sidebar Tree + broadcast paint to preview
          │
          └─ Send to Agent → host collects context (±6 lines) → POST to configured endpoint
                                     │
                                     └─ (optional) receive suggested edit → user applies via WorkspaceEdit
```

### UI Wireframes (ASCII)

**Rendered preview with highlight + bubble**

```
┌─────────────────────────────────────────────────────────────────────┐
│  # Title                                                            │
│  Paragraph text with a [selected portion of text] highlighted.      │
│                                ^                                    │
│                                | (floating bubble)                  │
│                        ┌───────────────────────────┐                │
│                        │  Add comment… [      ]    │                │
│                        │  [Save] [Cancel] [→ Agent]│                │
│                        └───────────────────────────┘                │
└─────────────────────────────────────────────────────────────────────┘
```

**Primary Sidebar: Comments**

```
┌ Comments (file.md) ────────────────────────────────┐
│ [Send All to Agent] [Filter] [Export] [Import]     │
│────────────────────────────────────────────────────│
│ L12–14  "clarify the intro sentence…"              │
│ L45–45  "typo: accomodate → accommodate"           │
│ L80–84  "turn this list into a table"              │
│                                                    │
│ (click item → scroll to highlight in preview)      │
└────────────────────────────────────────────────────┘
```

### Library Options

| Purpose               | Library                                   |
| --------------------- | ----------------------------------------- |
| Anchoring quotes      | `dom-anchor-text-quote` / Hypothesis libs |
| Selection + range ops | `rangy`                                   |
| Popover UI            | `Floating-UI` or `tippy.js`               |
| GitHub theme          | `github-markdown-css` (MIT)               |

### Core VS Code APIs

* Markdown **preview scripts**
* **Webview messaging**
* **Tree View / View Container**
* **WorkspaceEdit** (optional if applying patches)

### MVP Implementation Plan (1 week)

1. Inject preview overlay script + theme CSS
2. Implement drag-selection + comment bubble
3. Persist comments and paint highlights (with 3-layer anchor model)
4. Build sidebar tree + navigation
5. Add "Send to Agent" (emit payload only)

## Product Name

**Commentary**

### Tagline

*Inline comments for rendered Markdown, without touching your files.*

### Naming Rationale

"Commentary" communicates the core value—leaving comments—while feeling professional and general enough to cover future features (threads, reviews, AI edits). It's short, memorable, and not tied to GitHub or VS Code branding.

## Vision Statement

Commentary brings Google‑Docs‑style commenting to rendered Markdown inside VS Code. It keeps you in a doc‑first flow: read exactly what your readers will see, select text, add a comment, and keep writing. Comments live outside your files, can be themed to match your docs site, and can be shipped to an AI agent to draft improvements—all without leaving your editor or opening a PR.

## Claude System Context (save as the persistent system prompt)

```
You are scaffolding and iterating on a Visual Studio Code extension called "Commentary". The goal of the extension is:

- Provide Google‑Docs‑style text selection and commenting on rendered Markdown
- Use GitHub‑flavored Markdown CSS by default (MIT), with optional theme overrides and user‑provided CSS paths
- Use a sidebar comment navigator with jump‑to‑location behavior
- Store comments OUTSIDE the Markdown file (workspace storage or sidecar JSON)
- Support drag‑to‑select → inline bubble → comment save
- Highlight commented ranges without altering the source
- Anchor comments using a 3‑layer fallback: TextQuoteSelector → TextPositionSelector → nearest‑heading fuzzy anchor
- Allow batch "Send to Agent" (Claude by default, model‑agnostic), returning optional suggestions for edits
- Follow VS Code best practices: markdown preview scripts, webview messaging, Tree View API, WorkspaceEdit, minimal global state, strict TypeScript, modular structure
- Architecture should be clean, testable, and open to future features (threading, synced source gutter comments, theme packs, code‑fence awareness)

Project rules:
- Do not modify the original .md file when users comment
- Keep UX near GitHub + Google Docs metaphor
- Prefer built‑in preview injection over full custom renderer for v1
- Write idiomatic, modern TypeScript with strict mode
- No CSS frameworks — small, themeable CSS only
- All code must be runnable via F5 in VS Code with no additional setup

Deliverables Claude should generate on request:
1. Full VS Code scaffold (package.json, extension.ts, media/, webviews/, preview scripts, TreeDataProvider, message protocol)
2. Overlay selection logic and comment bubble UI (JS + CSS)
3. Sidebar panel implementation
4. Storage layer (pluggable workspace or sidecar)
5. Theme injection system
6. Commands and activation events
7. README, examples, and settings schema
```

## Recommended Project Scaffold

```
commentary/
  package.json
  README.md
  CHANGELOG.md
  tsconfig.json
  src/
    extension.ts                 // activation, wiring, registrations
    messaging.ts                 // webview/preview ↔ host protocol
    storage/
      index.ts                   // abstraction over workspace vs sidecar
      workspaceStorage.ts
      sidecarStorage.ts
    preview/
      overlayHost.ts             // host-side controller for preview overlay
      rendererBridge.ts          // postMessage helpers
    sidebar/
      commentsView.ts            // TreeDataProvider for comments
      commands.ts                // reveal/edit/delete, send-to-agent
    agent/
      client.ts                  // provider-agnostic client (Claude/OpenAI/HTTP)
      payload.ts                 // payload builders (context windows, excerpts)
  media/
    overlay.js                   // injected into Markdown preview frame
    overlay.css                  // highlight + bubble styles
    themes/
      github-light.css
      github-dark.css
      primer-light.css
      primer-dark.css
      tokyo-night.css
      mdbook.css
```

## Next Steps (Scaffold Plan)

1. Define `package.json` with contributions:

   * activation on `onLanguage:markdown`
   * `markdown.previewStyles` + `markdown.previewScripts` to inject theme + overlay
   * commands: `commentary.sendToAgent`, `commentary.export`, `commentary.import`, `commentary.deleteAll`
   * configuration: theme settings, storage mode, agent settings
2. Implement `extension.ts` with preview wiring + sidebar view container
3. Build `media/overlay.js` for selection, bubble, highlight, and anchors
4. Implement storage adapters and settings
5. Implement sidebar `commentsView.ts` with reveal‑on‑click scroll
6. Add agent client (no‑op stub with console POST for MVP)

## Marketplace One‑liner

**Commentary** — Inline comments for rendered Markdown in VS Code. Select, annotate, review, and send to your AI agent, without touching the source file.
