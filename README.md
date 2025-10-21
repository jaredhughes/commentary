# 📝 Commentary

**Inline comments for rendered Markdown in VS Code. Select, annotate, review, and send to your AI agent, without touching the source file.**

## Overview

Commentary brings Google Docs-style commenting to rendered Markdown inside VS Code. It keeps you in a doc-first flow: read exactly what your readers will see, select text, add a comment, and keep writing. Comments live outside your files, can be themed to match your docs site, and can be shipped to an AI agent to draft improvements—all without leaving your editor or opening a PR.

## Features

### 📝 Google Docs-Style Commenting

- Select text in the rendered Markdown preview
- Add comments via a floating bubble
- Comments appear as highlights with tooltips
- Click highlights to jump to comments in the sidebar

### 🎨 Themeable Preview

- **Default:** GitHub Markdown CSS (MIT license)
- **Built-in themes:** GitHub Light/Dark, Primer, Tokyo Night, mdBook
- **Custom CSS:** Bring your own stylesheet

### 💾 Flexible Storage

- **Workspace mode (default):** Comments stored in VS Code workspace state (git-ignored)
- **Sidecar mode:** Comments stored in `.comments/` folder as JSON (shareable via git)

### 🤖 AI Agent Integration

- Send individual or all comments to your AI agent
- Supports Claude, OpenAI, or custom endpoints
- Agent receives comment + context (configurable lines before/after)
- MVP: Copies formatted prompt to clipboard and output panel

### 📍 Smart Anchoring

3-layer fallback strategy ensures comments survive document edits:

1. **TextQuoteSelector** — Content-based anchoring with exact quote + prefix/suffix
2. **TextPositionSelector** — Character offset for fast recovery
3. **Nearest heading + fuzzy search** — Tolerant fallback for minor edits

## Installation

### From Source

1. Clone this repository
2. `npm install`
3. Press `F5` in VS Code to launch the extension in debug mode
4. Open a Markdown file and view the preview

### From Marketplace

*(Coming soon)*

## Usage

### Basic Workflow

1. Open a Markdown file in VS Code
2. Open the Markdown preview (`Cmd+K V` or `Ctrl+K V`)
3. Select text in the preview
4. Type your comment in the bubble and click **Save**
5. View all comments in the **Commentary** sidebar
6. Click a comment to jump to its location in the preview

### Sidebar Actions

- **Send All to Agent** — Send all comments to your AI agent
- **Export** — Export comments as JSON
- **Import** — Import comments from JSON
- **Refresh** — Reload comments
- **Delete All** — Clear all comments (with confirmation)

### Per-Comment Actions

- **Reveal** — Scroll to comment in preview
- **Send to Agent** — Send single comment to AI agent
- **Delete** — Remove comment

## Configuration

Access settings via `Preferences: Open Settings (UI)` and search for "commentary".

### Theme Settings

```json
{
  "commentary.theme.name": "github-light",
  "commentary.theme.customCssPath": "",
  "commentary.theme.useCustomFirst": false
}
```

**Available themes:** `github-light`, `github-dark`, `primer-light`, `primer-dark`, `tokyo-night`, `mdbook`

### Storage Settings

```json
{
  "commentary.storage.mode": "workspace"
}
```

**Options:** `workspace` (default, git-ignored) or `sidecar` (`.comments/` folder, shareable)

### AI Agent Settings

```json
{
  "commentary.agent.enabled": true,
  "commentary.agent.provider": "claude",
  "commentary.agent.apiKey": "",
  "commentary.agent.endpoint": "",
  "commentary.agent.model": "claude-3-5-sonnet-20241022",
  "commentary.agent.contextLines": 6
}
```

**Providers:** `claude`, `openai`, `custom`

## Architecture

```
commentary/
├── src/
│   ├── extension.ts           # Main activation
│   ├── types.ts               # Shared types
│   ├── messaging.ts           # Preview ↔ host protocol
│   ├── storage/               # Workspace + sidecar storage
│   ├── preview/               # Overlay host + bridge
│   ├── sidebar/               # Tree view + commands
│   └── agent/                 # AI client + payload builder
├── media/
│   ├── overlay.js             # Preview script (selection, bubble, highlights)
│   ├── overlay.css            # Highlight + bubble styles
│   └── themes/                # Built-in CSS themes
└── docs/
    └── readme.md              # Full specification
```

## Development

### Build

```bash
npm install
npm run compile
```

### Watch Mode

```bash
npm run watch
```

### Run Extension

Press `F5` in VS Code to launch the Extension Development Host.

### Debug

Set breakpoints in TypeScript source files. The debugger will attach automatically when you press `F5`.

## Roadmap

- [ ] Real HTTP agent integration (currently MVP: clipboard + output panel)
- [ ] Threading (nested replies)
- [ ] Synced source gutter comments
- [ ] Code fence awareness
- [ ] Theme packs
- [ ] Collaborative comments (live share integration)
- [ ] Export to various formats (GitHub issues, Notion, etc.)

## Contributing

Contributions welcome! Please open an issue first to discuss changes.

## License

MIT

## Credits

Built with:
- VS Code Extension API
- Markdown preview scripts
- GitHub Markdown CSS inspiration (MIT)

---

**Tagline:** *Inline comments for rendered Markdown, without touching your files.*
