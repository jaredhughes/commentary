# 📝 Commentary

![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/jaredhughes/commentary?utm_source=oss&utm_medium=github&utm_campaign=jaredhughes%2Fcommentary&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)
[![CI](https://github.com/jaredhughes/commentary/workflows/CI/badge.svg)](https://github.com/jaredhughes/commentary/actions)

**Inline comments for rendered Markdown in VS Code. Select text, annotate, review, and send to your AI agent—without touching the source file.**

> ⚠️ **Early Preview**: Commentary is in active development. While core features are stable, the extension is not yet published to the marketplace. Install from source or check back soon for the official release.

## Why Commentary?

**Stay in flow while reviewing your Markdown.** Commentary brings Google Docs-style commenting to rendered Markdown previews in VS Code. Review your documentation exactly as readers will see it, add inline comments without editing source files, and send feedback directly to your AI agent for implementation.

### Perfect For

- **Documentation writers** reviewing drafts before publishing
- **Technical writers** collecting editorial feedback
- **Content reviewers** annotating without git commits
- **AI-assisted workflows** iterating with Claude, Cursor, or ChatGPT

### Key Benefits

✅ **Non-destructive** - Comments live outside your files (no merge conflicts)
✅ **Visual editing** - See formatted output while you annotate
✅ **AI integration** - Send comments to Claude, Cursor, or custom agents
✅ **Beautiful themes** - 19 professional CSS themes included
✅ **Shareable** - Optional git-tracked sidecar storage

## Features

### 📝 Google Docs-Style Commenting

- **Text selection comments**: Select text in the rendered preview to add targeted feedback
- **Document-level comments**: Comment on the entire document via floating button or command palette
- **Inline editing**: Edit any comment directly from the sidebar with validation
- **Floating bubble interface**: Type comments in a modal that follows text on scroll
- **Keyboard shortcuts**: `Cmd+Enter` / `Ctrl+Enter` to save, `Esc` to cancel
- **Visual highlights**: Yellow highlights for text selections, blue note icons for document comments
- **Smart positioning**: Comment bubble stays within viewport bounds and follows content when scrolling

### 🎨 Beautiful Themes (19 Total)

Commentary includes professionally designed CSS themes sourced from popular open-source projects:

**GitHub** (2 themes)
- `github-light` — Official GitHub markdown styling
- `github-dark` — Official GitHub dark mode

**Water.css** (2 themes)
- `water-light` — Modern, clean, excellent contrast
- `water-dark` — Modern dark mode

**Sakura** (5 themes)
- `sakura-light` — Elegant default light
- `sakura-dark` — Elegant dark mode
- `sakura-vader` — Dark with personality
- `sakura-pink` — Soft pink accents
- `sakura-earthly` — Natural earth tones

**Pico CSS** (8 themes)
- `pico-amber`, `pico-blue`, `pico-cyan`, `pico-green`
- `pico-grey`, `pico-pink`, `pico-purple`, `pico-red`
- All auto-switch between light/dark based on system preference

**Simple.css** (1 theme)
- `simple` — Minimalist, auto dark/light switching

**Matcha** (1 theme)
- `matcha` — Code-focused with excellent syntax highlighting

**Theme Management:**
- Quick theme switcher via command palette
- Custom CSS support (bring your own stylesheet)
- Themes automatically respect system dark/light preference (where supported)

### 💾 Flexible Storage

- **Workspace mode (default):** Comments stored in VS Code workspace state (git-ignored)
- **Sidecar mode:** Comments stored in `.comments/` folder as JSON (shareable via git)

### 🤖 Enhanced AI Agent Integration

Send comments to your AI agent with comprehensive context:

**Supported Providers:**
- **Cursor** (default) — Attempts to open Cursor chat automatically
- **Claude Code** — Direct CLI integration with `claude --output-file`
- **OpenAI** — API integration
- **Custom** — Configure your own endpoint

**Context Sent to Agent:**
- **Relative path** — Workspace-relative file path (e.g., `docs/readme.md`)
- **Absolute path** — Full filesystem path for direct file access
- **Line numbers** — Precise location of commented text
- **Surrounding context** — Configurable lines before/after (default: 6 lines)
- **Full document** — For document-level comments, entire file content is included

**Agent Provider Switching:**
- Toggle between providers via command palette: `Commentary: Toggle AI Agent Provider`
- Quick pick menu shows current provider with checkmark
- Validates configuration (warns about missing API keys/endpoints)

### 📍 Smart Anchoring

3-layer fallback strategy ensures comments survive document edits:

1. **TextQuoteSelector** — Content-based anchoring with exact quote + prefix/suffix (100 chars)
2. **TextPositionSelector** — Character offset for fast recovery
3. **Nearest heading + fuzzy search** — Tolerant fallback for minor edits

---

## Installation

### 📦 From VS Code Marketplace

*(Coming soon)*

Search for "Commentary" in the Extensions view (`Cmd+Shift+X` / `Ctrl+Shift+X`) or install directly from the [VS Code Marketplace](https://marketplace.visualstudio.com/vscode).

### 🔧 From Source (Developers)

```bash
git clone https://github.com/jaredhughes/commentary
cd commentary
npm install
npm run compile
```

Press `F5` in VS Code to launch the Extension Development Host.

---

## Usage

### Creating Comments

**Text Selection Comments:**
1. Open a Markdown file in VS Code
2. Open the Markdown preview (`Cmd+K V` or `Ctrl+K V`)
3. Select text in the preview
4. Type your comment in the bubble
5. Click **Save** or press `Cmd+Enter` / `Ctrl+Enter`

**Document-Level Comments:**
- Click the floating 📄 button in the top-left corner of the preview, OR
- Click the 📝 note icon in the Commentary sidebar toolbar, OR
- Open command palette: `Commentary: Add Document-Level Comment`

### Managing Comments

**Edit Comments:**
- Click the ✏️ pencil icon next to any comment in the sidebar
- Modify the text and press Enter
- Validation prevents saving empty comments

**Delete Comments:**
- Click the 🗑️ trash icon next to a comment to delete one
- Click the trash icon in the sidebar toolbar to delete all (with confirmation)

**Reveal Comments:**
- Click any comment in the sidebar to scroll to its location in the preview
- Highlight briefly pulses for 2 seconds

**Export/Import:**
- Export all comments as JSON for backup or sharing
- Import previously exported comments

### Switching Themes

**Via Command Palette:**
1. Press `Cmd+Shift+P` / `Ctrl+Shift+P`
2. Type `Commentary: Select Theme`
3. Choose from 19 available themes

**Via Settings:**
- Open Settings (`Cmd+,` / `Ctrl+,`)
- Search for `commentary.theme.name`
- Select from dropdown

### Sending to AI Agent

**Single Comment:**
- Click the 📤 send icon next to any comment

**All Comments:**
- Click the send icon in the sidebar toolbar

**Provider Options:**
- **Cursor**: Copies to clipboard and attempts to open Cursor chat (`Cmd+L`)
- **Claude Code**: Pipes directly to `claude` CLI with `--output-file`
- **OpenAI/Custom**: Copies formatted prompt to clipboard

---

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

**Available themes:**
- `github-light`, `github-dark`
- `water-light`, `water-dark`
- `sakura-light`, `sakura-dark`, `sakura-vader`, `sakura-pink`, `sakura-earthly`
- `pico-amber`, `pico-blue`, `pico-cyan`, `pico-green`, `pico-grey`, `pico-pink`, `pico-purple`, `pico-red`
- `simple`, `matcha`

### Storage Settings

```json
{
  "commentary.storage.mode": "workspace"
}
```

**Options:**
- `workspace` — Store in VS Code workspace state (not tracked by git)
- `sidecar` — Store in `.comments/` folder as JSON (shareable)

### AI Agent Settings

```json
{
  "commentary.agent.enabled": true,
  "commentary.agent.provider": "cursor",
  "commentary.agent.apiKey": "",
  "commentary.agent.endpoint": "",
  "commentary.agent.model": "claude-3-5-sonnet-20241022",
  "commentary.agent.contextLines": 6,
  "commentary.agent.cursorCliPath": "cursor-agent",
  "commentary.agent.cursorInteractive": true
}
```

**Providers:**
- `cursor` (default) — Cursor AI integration
- `claude` — Claude Code CLI
- `openai` — OpenAI API
- `custom` — Custom endpoint

**Cursor-Specific Settings:**
- `cursorCliPath`: Path to cursor-agent CLI executable (default: `cursor-agent`)
- `cursorInteractive`: Use interactive mode for conversational sessions (default: `true`)

**Claude Code Integration:**
- Automatically uses `claude --output-file` to pipe comments to Claude CLI
- Responses are written back to the original Markdown file

---

## Commands

All commands accessible via `Cmd+Shift+P` / `Ctrl+Shift+P`:

| Command | Description |
|---------|-------------|
| `Commentary: Open with Commentary` | Open Markdown file in Commentary preview |
| `Commentary: Add Document-Level Comment` | Comment on entire document |
| `Commentary: Toggle AI Agent Provider` | Switch between Cursor, Claude, OpenAI, Custom |
| `Commentary: Select Theme` | Choose from 19 available themes |
| `Commentary: Send All to Agent` | Send all comments to AI agent |
| `Commentary: Show Comments Sidebar` | Open Commentary sidebar panel |
| `Commentary: Delete All` | Clear all comments (with confirmation) |
| `Commentary: Export` | Export comments as JSON |
| `Commentary: Import` | Import comments from JSON |

---

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
│   └── themes/                # CSS themes (generated from node_modules)
├── scripts/
│   └── copy-themes.js         # Build script to extract themes from NPM
└── docs/
    └── readme.md              # Full specification
```

**Theme Management:**
- Themes installed via NPM: `github-markdown-css`, `water.css`, `sakura.css`, `@picocss/pico`, `simpledotcss`, `@lowlighter/matcha`
- Build script (`copy-themes.js`) extracts CSS from `node_modules` to `media/themes/`
- Themes are bundled in `.vsix` package (users don't need NPM)

---

## Development

### Build

```bash
npm install              # Install dependencies + theme packages
npm run compile          # Copy themes from NPM + compile TypeScript
```

**Build process:**
1. `npm run copy-themes` — Extracts CSS from NPM packages to `media/themes/`
2. `tsc -p ./` — Compiles TypeScript

### Watch Mode

```bash
npm run watch            # Auto-recompile on file changes
```

### Run Extension

Press `F5` in VS Code to launch the Extension Development Host.

### Debug

Set breakpoints in TypeScript source files. The debugger will attach automatically when you press `F5`.

### Testing

```bash
npm test                 # Run all tests
npm run validate         # Lint + type check (pre-push validation)
npm run lint             # ESLint only
```

**Test Coverage:**
- Extension activation and commands
- Agent payload building and formatting
- All AI provider configurations
- Storage operations (save, retrieve, delete, export, import)
- Theme and configuration management

**CI/CD:**
- Automated linting, type checking, and tests on every PR
- Pre-push git hooks catch issues before pushing
- Multi-platform testing (macOS, Linux, Windows)

---

## Contributing

Contributions welcome! Please open an issue first to discuss changes.

**Development workflow:**
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

---

## License

MIT License - Copyright (c) 2025 Jared Hughes

See [LICENSE](LICENSE) file for details.

---

## Credits

**Built with:**
- [VS Code Extension API](https://code.visualstudio.com/api)
- [github-markdown-css](https://github.com/sindresorhus/github-markdown-css) (MIT)
- [Water.css](https://github.com/kognise/water.css) (MIT)
- [Sakura.css](https://github.com/oxalorg/sakura) (MIT)
- [Pico CSS](https://github.com/picocss/pico) (MIT)
- [Simple.css](https://github.com/kevquirk/simple.css) (MIT)
- [Matcha CSS](https://github.com/lowlighter/matcha) (MIT)

**Special thanks:**
- markdown-it ecosystem for Markdown rendering
- VS Code webview API for preview integration
- Open source CSS framework maintainers

---

## 🚀 Quick Start

1. **Install** Commentary from the marketplace (or build from source)
2. **Open** a Markdown file in VS Code
3. **Open preview** with `Cmd+K V` / `Ctrl+K V`
4. **Select text** in the rendered preview
5. **Type your comment** in the bubble that appears
6. **Save** with `Cmd+Enter` / `Ctrl+Enter`

View all comments in the Commentary sidebar (`Cmd+Shift+C` / `Ctrl+Shift+C`).

---

## 📊 Project Status

- **Version**: 0.9.7 (pre-release)
- **License**: MIT
- **CI Status**: [![CI](https://github.com/jaredhughes/commentary/workflows/CI/badge.svg)](https://github.com/jaredhughes/commentary/actions)
- **Test Coverage**: Core features, storage, agent integrations
- **Platform Support**: macOS, Linux, Windows

---

## 🤝 Contributing

Contributions welcome! Please open an issue first to discuss changes.

**Development workflow:**
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run validate` (lint + type check)
5. Run `npm test` to verify tests pass
6. Submit a pull request

**Code Quality:**
- ESLint + TypeScript strict mode
- Pre-push hooks catch issues automatically
- CI validates all PRs (lint, types, tests, build)

---

## 📄 License

MIT License - Copyright (c) 2025 Jared Hughes

See [LICENSE](LICENSE) file for details.

---

**Tagline:** *Inline comments for rendered Markdown, without touching your files.*
