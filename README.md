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
- Supports Claude Code, Cursor, OpenAI, or custom endpoints
- Agent receives comment + context (configurable lines before/after)
- **Claude Code** & **Cursor**: Direct CLI integration (sends to terminal automatically)
- **Fallback**: Copies formatted prompt to clipboard and output panel

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
  "commentary.agent.contextLines": 6,
  "commentary.agent.cursorCliPath": "cursor-agent",
  "commentary.agent.cursorInteractive": true
}
```

**Providers:** `claude`, `cursor`, `openai`, `custom`

**Cursor-Specific Settings:**
- `cursorCliPath`: Path to cursor-agent CLI executable (default: `cursor-agent`)
- `cursorInteractive`: Use interactive mode for conversational sessions (default: `true`)

**Claude Code Integration:**
- Automatically uses `claude --output-file` to pipe comments to Claude CLI
- Responses are written back to the original Markdown file

**Cursor Integration:**
- Automatically uses `cursor-agent` CLI to send comments
- Interactive mode: Opens conversational session in terminal
- Non-interactive mode: Runs prompt and exits (for automation)

## Getting Started with Cursor

To use Commentary with Cursor's AI agent:

1. **Install Cursor CLI**
   ```bash
   curl https://cursor.com/install -fsS | bash
   ```

2. **Configure Commentary to use Cursor**
   - Open VS Code Settings (`Cmd+,` or `Ctrl+,`)
   - Search for "commentary agent provider"
   - Select `cursor` from the dropdown

3. **Send Comments to Cursor**
   - Add comments to your Markdown files using Commentary
   - Click the "Send to Agent" button (or use "Send All to Agent")
   - Commentary will open a terminal and pipe your comments to `cursor-agent`
   - Review Cursor's suggestions and apply changes as needed

4. **Optional: Customize Cursor CLI Path**
   - If cursor-agent is not in your PATH, set `commentary.agent.cursorCliPath` to the full path
   - Example: `/usr/local/bin/cursor-agent`

5. **Optional: Configure Interactive Mode**
   - Set `commentary.agent.cursorInteractive` to `false` for automation workflows
   - Interactive mode (default) allows conversational follow-up in the terminal

6. **Cursor CLI Permissions**
   - The repository includes `cli-config.json` with safe default permissions
   - Cursor Agent can read source files and documentation
   - Cursor Agent can write to documentation files (*.md)
   - Destructive operations (rm, sudo, git push) are blocked

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

### Testing

```bash
# Run all tests
npm test

# Compile and lint before testing
npm run pretest

# Lint only
npm run lint
```

**Test Coverage:**
- **Extension Tests** (`src/test/suite/extension.test.ts`)
  - Extension activation and commands
  - Package.json metadata validation
  - Cursor provider configuration
- **Agent Tests** (`src/test/suite/agent.test.ts`)
  - Provider display names (claude, cursor, openai, custom)
  - Single and multiple comment handling
  - Payload building and formatting
  - End-to-end workflows for all providers
- **Configuration Tests** (`src/test/suite/configuration.test.ts`)
  - All agent provider configurations
  - Cursor-specific settings (cursorCliPath, cursorInteractive)
  - Theme and storage configurations
  - Configuration interactions and edge cases
- **Storage Tests** (`src/test/suite/extension.test.ts`)
  - Save and retrieve notes
  - Delete notes
  - Export and import functionality

**Running Tests in VS Code:**
1. Press `F5` to launch Extension Development Host
2. Open the Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`)
3. Select "Developer: Reload Window" to activate the extension
4. Tests will run automatically in the test environment

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
