# 📝 Commentary

[![CI](https://github.com/jaredhughes/commentary/workflows/CI/badge.svg)](https://github.com/jaredhughes/commentary/actions)
[![VS Code Marketplace](https://img.shields.io/vscode-marketplace/v/jaredhughes.commentary.svg?label=VS%20Code%20Marketplace&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=jaredhughes.commentary)

**Inline comments for rendered Markdown in VS Code.** Select text, add comments, and send feedback to your AI agent—without touching the source file.

<!-- Demo video will be inserted here -->

---

## Why Commentary?

Stay in flow while reviewing your Markdown. Commentary brings **Google Docs-style commenting** to rendered previews in VS Code. Review documentation as readers will see it, annotate without editing source files, and send feedback directly to your AI agent.

**Perfect for:**
- 📖 Documentation writers reviewing drafts
- ✍️ Technical writers collecting feedback
- 👥 Content reviewers annotating without commits
- 🤖 AI-assisted workflows with Claude, Cursor, or ChatGPT

---

## ✨ Features

### Non-Destructive Comments
- **Text selection** — Highlight any text to comment
- **Document-level** — Comment on entire files
- **Floating bubble UI** — Google Docs-style comment interface
- **Keyboard shortcuts** — `⌘Enter` / `Ctrl+Enter` to save, `Esc` to cancel
- **Visual highlights** — See exactly what's commented

### AI Agent Integration

**🚀 Terminal Integration (Recommended)**
- **Claude Code CLI** — Opens terminal with `claude` command, applies edits automatically
- **Cursor Agent CLI** — Opens terminal with `cursor-agent` command, applies edits automatically

**📋 Copy-Paste Workflow**
- **Claude (IDE)** — Copies to clipboard, paste into Claude chat in VS Code/Cursor
- **Cursor (IDE)** — Copies to clipboard, paste into Composer/Chat
- **VS Code Chat** — Copies to clipboard, paste into built-in chat
- **OpenAI API** — Direct API calls (requires API key)

💡 **Why terminal?** CLI integrations automatically apply edits to your files. Copy-paste workflows require manual application, but work without additional setup.

### Beautiful Themes
Choose from **20 professional themes**:
- **Water.css** — Modern, clean (light/dark)
- **Sakura** — Elegant (5 variants)
- **Pico CSS** — Professional with accents (8 colors, auto light/dark)
- **Simple.css** — Minimalist (auto light/dark)
- **Matcha** — Code-focused with syntax highlighting
- **LaTeX.css** — Academic paper styling
- **Tufte CSS** — Edward Tufte design principles
- **New.css** — Modern minimal (4k+ GitHub stars)

Quick switcher: `⌘⇧P` → `Commentary: Select Theme`

### Smart Storage
- **Workspace mode** (default) — Comments in VS Code state (git-ignored)
- **Sidecar mode** — Comments in `.comments/` folder (git-tracked, shareable)

### Reliable Anchoring
Comments survive document edits with 3-layer fallback:
1. **Exact quote** + context (100 chars before/after)
2. **Character offset** for fast recovery
3. **Nearest heading** + fuzzy search

---

## 🚀 Quick Start

1. **Install** from [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=jaredhughes.commentary)
2. **Open** any Markdown (`.md`) file
3. **Right-click** the file in Explorer → **"Open with Commentary"**
4. **Select text** in the rendered preview → floating comment bubble appears
5. **Type comment** → Press `⌘Enter` (Mac) / `Ctrl+Enter` (Windows/Linux) to save
6. **View all comments** in the Commentary sidebar → `⌘⇧C` / `Ctrl+Shift+C`

**Pro tip:** After adding comments, send them to your AI agent with the "Send to Agent" button!

### Configure AI Agent

`⌘⇧P` → `Commentary: Configure AI Agent`

**Recommended: Terminal Integration**
- **Claude Code CLI** — Enter command: `claude` (installs automatically, applies edits)
- **Cursor Agent CLI** — Enter path: `cursor-agent` (requires [installation](https://github.com/Cursor-AI/cursor-agent))

**Alternative: Copy-Paste**
- **Claude (IDE)** — Choose "Claude" provider, uses clipboard
- **Cursor (IDE)** — Choose "Cursor" provider, uses clipboard
- **VS Code Chat** — Built-in chat, uses clipboard

**API Options**
- **OpenAI** — Direct API calls (requires API key)
- **Custom** — Your own endpoint

---

## 📦 Installation

### From Marketplace

Install directly from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=jaredhughes.commentary):

1. Open VS Code
2. Go to Extensions view (`⌘⇧X` / `Ctrl+Shift+X`)
3. Search for "Commentary"
4. Click **Install**

Or install via command line:
```bash
code --install-extension jaredhughes.commentary
```

### From Source
```bash
git clone https://github.com/jaredhughes/commentary
cd commentary
npm install
npm run compile
```

Press `F5` in VS Code to launch Extension Development Host.

---

## 🎮 Usage

### Creating Comments

**Text Selection:**
- Select text in the rendered preview
- Type in the floating bubble
- Save with `⌘Enter` / `Ctrl+Enter`

**Document-Level:**
- Click 📄 button (top-left corner), OR
- Sidebar toolbar → 📝 icon, OR
- Command Palette → `Add Document-Level Comment`

### Managing Comments

**Edit:** Click ✏️ pencil icon in sidebar
**Delete:** Click 🗑️ trash icon (single or all)
**Navigate:** Click comment to scroll to location
**Export/Import:** Backup or share as JSON

### Send to AI Agent

**Single comment:** Click 📤 send icon
**All comments:** Sidebar toolbar → send icon

**Behavior:**
- **CLI/API methods** — Comments deleted automatically after sending
- **Clipboard/Chat methods** — Comments kept for manual tracking

---

## ⚙️ Configuration

### Theme
```json
{
  "commentary.theme.name": "water-dark"
}
```

### Storage
```json
{
  "commentary.storage.mode": "workspace"  // or "sidecar"
}
```

### AI Agent
```json
{
  "commentary.agent.enabled": true,
  "commentary.agent.provider": "cursor",
  "commentary.agent.claudeCliPath": "claude",
  "commentary.agent.cursorCliPath": "cursor-agent",
  "commentary.agent.cursorInteractive": true,
  "commentary.agent.openaiApiKey": "",
  "commentary.agent.contextLines": 6
}
```

**Settings scope:** All settings default to **global/user** but can be overridden per-workspace.

---

## 📋 Commands

| Command | Action |
|---------|--------|
| `Commentary: Configure AI Agent` | Set up Claude, Cursor, OpenAI, or custom |
| `Commentary: Select Theme` | Choose from 20 themes |
| `Commentary: Add Document-Level Comment` | Comment on entire file |
| `Commentary: Send All to Agent` | Batch send all comments |
| `Commentary: Delete All` | Clear all (with confirmation) |
| `Commentary: Export / Import` | Backup or share comments |

---

## 🏗️ Architecture

```
src/
├── extension.ts         # Activation & provider detection
├── preview/             # Webview + overlay integration
├── sidebar/             # Tree view + commands
├── agent/               # AI provider abstraction
└── storage/             # Workspace + sidecar persistence

media/
├── overlay.js           # Selection UI + comment bubbles
├── overlay.css          # Visual styles
└── themes/              # 20 CSS themes (copied from NPM)
```

**Design principles:**
- Pure provider logic (no VS Code APIs in core)
- Testable AI integrations (208 passing tests)
- Pluggable storage backends
- Non-destructive annotations

---

## 🧪 Development

### Build & Test
```bash
npm install              # Install deps + theme packages
npm run compile          # Copy themes + compile TypeScript
npm run watch            # Auto-recompile on changes
npm test                 # Run all tests (208 passing)
npm run validate         # Lint + type check
```

### Debug
Press `F5` to launch Extension Development Host with debugger attached.

### CI/CD
- ✅ Automated linting, type checking, tests on every PR
- ✅ Pre-push hooks catch issues before pushing
- ✅ Multi-platform testing (macOS, Linux, Windows)

---

## 🤝 Contributing

Contributions welcome! Please open an issue first to discuss changes.

**Workflow:**
1. Fork & create feature branch
2. Make changes
3. Run `npm run validate && npm test`
4. Submit PR

---

## 📄 License

MIT License — Copyright (c) 2025 Jared Hughes

See [LICENSE](LICENSE) for details.

---

## 🙏 Credits

**Themes powered by:**
- [Water.css](https://github.com/kognise/water.css) (MIT)
- [Sakura](https://github.com/oxalorg/sakura) (MIT)
- [Pico CSS](https://github.com/picocss/pico) (MIT)
- [Simple.css](https://github.com/kevquirk/simple.css) (MIT)
- [Matcha](https://github.com/lowlighter/matcha) (MIT)
- [LaTeX.css](https://github.com/vincentdoerig/latex-css) (MIT)
- [Tufte CSS](https://github.com/edwardtufte/tufte-css) (MIT)
- [New.css](https://github.com/xz/new.css) (MIT)

**Special thanks to the VS Code extension API and markdown-it ecosystem.**

---

*Inline comments for rendered Markdown, without touching your files.*
