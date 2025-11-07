# 📝 Commentary

[![CI](https://github.com/jaredhughes/commentary/workflows/CI/badge.svg)](https://github.com/jaredhughes/commentary/actions)
[![VS Code Marketplace](https://img.shields.io/vscode-marketplace/v/jaredhughes.commentary.svg?label=VS%20Code%20Marketplace&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=jaredhughes.commentary)

**Inline comments for rendered Markdown in VS Code.** Select text, add comments, and send feedback to your AI agent—without touching the source file.

📹 **[Watch Demo Video](media/demo/demo.mp4)** (downloads when clicked)

> 💡 **Note:** GitHub doesn't support inline video playback in README files. For inline display:
> - **Convert to GIF** (recommended): `ffmpeg -i media/demo/demo.mp4 -vf "fps=10,scale=1280:-1:flags=lanczos" media/demo/demo.gif` then use `![Demo](media/demo/demo.gif)`
> - **GitHub Assets**: Upload video to a GitHub issue/PR and use the asset URL
> - **External hosting**: Upload to YouTube/Vimeo and embed the link

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

**Automatic (Send) — Recommended**
- **Claude CLI** — Terminal integration, automatically applies edits
- **Cursor CLI** — Terminal integration, automatically applies edits
- **OpenAI API** — Direct API calls, automatically applies edits
- **Claude API** — Direct API calls (when configured), automatically applies edits

**Manual (Copy)**
- **Claude IDE** — Clipboard copy, paste into Claude chat
- **Cursor IDE** — Clipboard copy, paste into Cursor chat
- **VS Code Chat** — Clipboard copy, paste into built-in chat

💡 **Automatic methods** send comments directly and apply edits automatically. **Manual methods** copy to clipboard for you to paste—useful when CLI/API isn't available.

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

**Pro tip:** After adding comments, send them to your AI agent! Automatic methods apply edits directly; manual methods copy to clipboard.

### Configure AI Agent

`⌘⇧P` → `Commentary: Configure AI Agent`

**For Automatic Editing (Recommended):**
- **Claude CLI** — Enter command: `claude` (installs automatically)
- **Cursor CLI** — Enter path: `cursor-agent` (requires [installation](https://github.com/Cursor-AI/cursor-agent))
- **OpenAI API** — Enter your API key for direct GPT-4/GPT-3.5 access

**For Manual Copy-Paste:**
- **Claude IDE** — Choose "Claude" provider (uses clipboard)
- **Cursor IDE** — Choose "Cursor" provider (uses clipboard)
- **VS Code Chat** — Built-in chat (uses clipboard)

**Advanced:**
- **Custom** — Your own API endpoint

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

## Usage

### Creating Comments

**Text Selection Comments:**
1. Select any text in the rendered Markdown preview
2. A floating comment bubble appears
3. Type your comment
4. Press `⌘Enter` (Mac) or `Ctrl+Enter` (Windows/Linux) to save
5. Press `Esc` to cancel

**Document-Level Comments:**
You can comment on an entire document without selecting text:
- **In the preview:** Click the note icon button in the top-left corner of the preview
- **In the sidebar:** Click the note icon in the Commentary sidebar toolbar
- **Command Palette:** Press `⌘⇧P` (Mac) or `Ctrl+Shift+P` (Windows/Linux), then type "Add Document-Level Comment"

### Managing Comments

**View All Comments:**
- Open the Commentary sidebar: `⌘⇧C` / `Ctrl+Shift+C`
- Comments are organized by file
- Click a comment to navigate to its location in the document

**Edit a Comment:**
- In the sidebar, click the edit icon next to the comment
- Or click the comment text to navigate and edit in the preview

**Delete Comments:**
- **Single comment:** Click the trash icon next to the comment in the sidebar
- **All comments:** Click the trash icon in the sidebar toolbar (with confirmation)

**Export/Import:**
- Use the export/import commands to backup or share comments as JSON

### Sending Comments to AI Agent

Commentary supports two types of agent integration: **automatic** (Send) and **manual** (Copy).

#### Automatic Methods (Send) — Recommended

These methods send comments directly to your agent and **automatically apply edits** to your files:

- **Claude CLI** — Opens terminal with `claude` command, agent applies edits automatically
- **Cursor CLI** — Opens terminal with `cursor-agent` command, agent applies edits automatically  
- **OpenAI API** — Direct API calls to GPT-4/GPT-3.5, applies edits automatically
- **Claude API** — Direct API calls (when API key configured), applies edits automatically

**Behavior:**
- Comments are sent immediately
- Agent responses are applied to your files automatically
- Comments are **deleted from the sidebar** after successful delivery (they've been processed)

#### Manual Methods (Copy)

These methods copy comments to your clipboard for you to paste manually:

- **Claude IDE** — Copies to clipboard, paste into Claude chat in VS Code/Cursor
- **Cursor IDE** — Copies to clipboard, paste into Cursor Composer/Chat
- **VS Code Chat** — Copies to clipboard, paste into built-in VS Code Chat
- **OpenAI (fallback)** — Copies to clipboard when API key not configured

**Behavior:**
- Comments are formatted and copied to clipboard
- You paste them into your agent's chat interface
- Comments **remain in the sidebar** for tracking (you manually apply edits)

#### How to Use

**Send a Single Comment:**
- In the sidebar, click the send/copy icon next to any comment
- Icon varies by method: sparkle (Claude), terminal (Cursor CLI), rocket (OpenAI), etc.

**Send All Comments:**
- Click the send/copy icon in the sidebar toolbar
- All comments are sent together with full document context

**Which Method is Used?**
- Commentary automatically chooses the best available method based on your configuration
- CLI/API methods are preferred (automatic editing)
- Clipboard methods are used as fallback (manual paste required)

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
