# Changelog

All notable changes to the "Commentary" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
