# Changelog

All notable changes to the "Commentary" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.1] - 2025-11-10

### Fixed
- Highlight rendering now works reliably with robust DOM wrapping and position-based fallback anchoring
- Delete button in comment overlay now properly removes highlights and closes modal
- Sidebar automatically expands and reveals newly added/updated comments
- Triple-click now uses native browser behavior for consistent paragraph/line selection
- Pico themes no longer broken by CSS overrides
- Water theme headings now visible (removed conflicting color rules)
- Removed `markdown-it-anchor` plugin to eliminate unwanted heading link styling
- Switch case variable scoping in overlay message handler

### Added
- Markdown link navigation: clicking relative `.md` links opens them in Commentary preview
- Structured `NotesChangedEvent` type for better event tracking across sidebar/commands
- Debug logging for comment count investigation
- Comprehensive integration test skeleton (pending proper fixtures)
- Platform-specific test runner using VS Code 1.85.0 for compatibility

### Changed
- Test suite now runs successfully on macOS (218 passing)
- Comments sidebar now caches tree items for efficient reveal operations
- Folders with comments auto-expand by default

## [1.1.0] - 2025-11-09

### Fixed
- Sidebar file tree now deduplicates markdown files reported by VS Code multi-root workspaces
- Worktree and multi-root folder names are preserved when displaying files in the sidebar

### Changed
- Bumped extension version to `1.1.0`

## [0.9.8] - 2025-11-06

### Fixed
- Theme selection command now properly updates webview visual appearance
- Workspace configuration now correctly takes precedence over global configuration
- Dynamic stylesheet reloading via postMessage instead of full HTML regeneration

### Changed
- Theme updates now preserve scroll position and webview state
- Extension icon updated to higher quality version (128x128px)

### Documentation
- Clarified AI agent integration in README - emphasizes terminal integration over copy-paste
- Updated Quick Start instructions to match actual user experience

## [0.9.7] - 2025-11-03

### Added
- Extension icon for VS Code marketplace (160x160px PNG)
- Empty state messaging in sidebar when no comments exist
- Loading indicators for all agent operations (send single/all comments)
- Pre-push git hook for automated linting and type checking
- Explicit TypeScript type checking in CI pipeline
- Comprehensive error handling with user-friendly error messages
- Progress notifications for long-running agent operations

### Changed
- **BREAKING**: All enum members changed from PascalCase to camelCase (e.g., `MessageType.SaveComment` → `MessageType.saveComment`)
- Standardized command naming for clarity:
  - Claude: "Send to Claude" / "Send All to Claude"
  - Cursor: "Copy for Cursor" / "Copy All for Cursor"
  - VS Code: "Send to VS Code Chat" / "Send All to VS Code Chat"
- Document button now uses VS Code theme colors instead of hardcoded blue
- Test files reorganized as siblings to source files (`*.test.ts` pattern)
- ESLint configuration enhanced with comprehensive naming conventions
- README restructured for marketplace appeal with "Why Commentary?" section
- README now includes CI badge, early preview warning, and Quick Start guide

### Fixed
- 44 ESLint warnings resolved (naming conventions, unused variables)
- TypeScript compilation warnings eliminated
- External API compatibility (Anthropic SDK snake_case properties)
- Theme color integration with VS Code color variables

### Development
- Added `npm run validate` script (linting + type checking)
- Test discovery updated to search from `src/` root
- Pre-push hooks prevent broken code from being pushed
- CI workflow enhanced with explicit type checking step
- All tests moved to sibling pattern for better organization

### Upgrade Notes

**Breaking Change - Enum Members**: If you are using the Commentary API or have custom integrations:

```typescript
// Before (0.9.0):
MessageType.SaveComment
MessageType.DeleteComment
HostMessageType.PaintHighlights

// After (0.9.7):
MessageType.saveComment
MessageType.deleteComment
HostMessageType.paintHighlights
```

This change affects TypeScript consumers of the extension's types. If you are only using the extension through VS Code UI, no action is required.

## [0.9.0] - 2025-10-22

### Added

- **Cursor AI integration**: Full support for Cursor's AI agent via CLI
- New agent provider option: `cursor` (alongside `claude`, `openai`, `custom`)
- Cursor CLI integration: Automatically pipes comments to `cursor-agent` terminal
- Interactive and non-interactive modes for Cursor CLI
- `.cursorrules` configuration file with project-specific AI instructions
- `cli-config.json` with safe default permissions for Cursor CLI
- New settings:
  - `commentary.agent.cursorCliPath`: Path to cursor-agent executable
  - `commentary.agent.cursorInteractive`: Toggle interactive mode
- Comprehensive documentation for Cursor setup and usage in README.md

### Changed

- Updated README.md with "Getting Started with Cursor" section
- Enhanced AI Agent Integration section to highlight Claude and Cursor CLI features
- Provider display name now includes "Cursor" for better UX

### Technical

- Added `sendViaCursorCLI()` method in `client.ts`
- Extended `getProviderDisplayName()` to handle Cursor provider
- Updated package.json configuration schema for Cursor settings
- All changes compile cleanly with TypeScript strict mode
- No new ESLint errors introduced

### Testing

- **New test files:**
  - `agent.test.ts`: Comprehensive agent client and payload builder tests (60+ tests)
  - `configuration.test.ts`: Full configuration validation suite (30+ tests)
- **Expanded coverage:**
  - Provider display names for all providers (claude, cursor, openai, custom)
  - Cursor-specific configuration (cursorCliPath, cursorInteractive)
  - Single and multiple comment handling
  - Payload building and formatting
  - End-to-end workflows for all agent providers
  - Configuration interactions and edge cases
- **Enhanced extension.test.ts:**
  - Added metadata validation tests
  - Added Cursor provider configuration tests
  - Improved command registration checks
- **Documentation:**
  - Added comprehensive Testing section to README
  - Test coverage breakdown by suite
  - Instructions for running tests in VS Code

## [0.1.0] - 2025-01-XX

### Added

- Initial MVP release
- Google Docs-style text selection and commenting in rendered Markdown preview
- Floating comment bubble with Save, Cancel, and Send to Agent buttons
- Sidebar tree view showing all comments organized by file
- Comment highlights with hover tooltips
- Click highlight to scroll and focus in sidebar
- Workspace storage mode (VS Code Memento API, git-ignored)
- Sidecar storage mode (`.comments/` folder, shareable via git)
- 3-layer anchor strategy: TextQuoteSelector → TextPositionSelector → nearest heading fuzzy search
- AI agent integration (MVP: clipboard + output panel)
- Export/import comments as JSON
- Delete individual or all comments
- 6 built-in themes: GitHub Light/Dark, Primer Light/Dark, Tokyo Night, mdBook
- Custom CSS support
- Configuration for theme, storage mode, and agent settings
- Commands: save, delete, reveal, send to agent, export, import
- Activity bar view container with Comments panel
- Refresh comments command
- Context menu actions for comments

### Known Limitations

- AI agent integration is MVP-only (copies to clipboard, shows in output panel)
- No actual HTTP requests to agent APIs yet
- Text anchoring uses simplified algorithm (production needs robust DOM traversal)
- No threading support yet
- No collaborative features yet
- Themes are simplified versions (full GitHub CSS to come)

### Future Enhancements

- Real HTTP agent integration with Claude/OpenAI APIs
- Improved text anchoring with proper DOM walking
- Support for nested comment threads
- Synced source gutter comments
- Code fence awareness
- Theme packs and marketplace themes
- Collaborative commenting via Live Share
- Export to GitHub issues, Notion, etc.
