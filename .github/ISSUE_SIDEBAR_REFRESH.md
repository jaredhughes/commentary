---
name: Bug Report
about: Create a report to help us improve Commentary
title: '[BUG] Sidebar file list does not refresh when new Markdown files are created'
labels: bug
assignees: ''
---

## Description

The Commentary sidebar does not automatically refresh when new Markdown files (`.md`) are created in the workspace. Newly created files only appear in the sidebar after:
1. A comment is added to an existing file (triggers refresh)
2. VS Code is reloaded
3. The extension is manually restarted

This creates a poor user experience where users must manually trigger a refresh or restart VS Code to see newly created files in the sidebar.

## Steps to Reproduce

1. Open VS Code with Commentary extension active
2. Open the Commentary sidebar (`⌘⇧C` / `Ctrl+Shift+C`)
3. Note the current list of Markdown files shown
4. Create a new Markdown file (e.g., `new-file.md`) in the workspace
   - Via File Explorer: Right-click → New File → `new-file.md`
   - Via Command Palette: `File: New File` → save as `.md`
   - Via terminal: `touch new-file.md`
5. Observe the Commentary sidebar

**Expected:** New file appears in the sidebar immediately or within a few seconds

**Actual:** New file does not appear until sidebar is manually refreshed or VS Code is reloaded

## Expected Behavior

When a new Markdown file is created in the workspace:
1. The sidebar should automatically detect the new file
2. The file should appear in the appropriate folder location in the sidebar
3. The sidebar should update within 1-2 seconds of file creation
4. No manual refresh should be required

## Actual Behavior

New Markdown files created in the workspace:
- Do not appear in the sidebar automatically
- Only appear after a comment-related event triggers a refresh
- Require VS Code reload or extension restart to appear
- Create confusion for users expecting real-time updates

## Environment

- **VS Code Version**: [e.g. 1.85.0]
- **Commentary Version**: [e.g. 1.1.1]
- **OS**: [e.g. macOS 14.0, Windows 11, Ubuntu 22.04]
- **Storage Mode**: [workspace/sidecar]
- **Workspace Type**: [Single folder / Multi-root workspace]

## Configuration

```json
{
  "commentary.storage.mode": "workspace"
}
```

## Screenshots/Videos

If applicable, add screenshots or videos showing:
- Sidebar before creating new file
- File creation process
- Sidebar after file creation (showing file is missing)
- Sidebar after manual refresh (showing file appears)

## Console Output

Open VS Code Developer Tools (`Help > Toggle Developer Tools`) and check the Console tab. Look for:

1. **File discovery messages:**
```
[CommentsView] buildFolderTree called
[CommentsView] Found X markdown files in workspace
```

2. **Refresh messages:**
```
[CommentsView] refresh() called with event: ...
[CommentsView] _onDidChangeTreeData fired
```

3. **File watcher messages (if any):**
```
[Commentary] File created: ...
[Commentary] File watcher triggered: ...
```

Paste relevant console output here:

```
[Paste console output here]
```

## Additional Context

**Current Behavior:**
- Sidebar uses `vscode.workspace.findFiles('**/*.md')` to discover files
- File discovery happens in `buildFolderTree()` method
- Folder tree is cached and only rebuilt when cache is cleared
- Cache is cleared when comments change, but not when files are created

**Related Issues:**
- Files deleted from workspace also don't disappear from sidebar
- Files renamed don't update in sidebar
- Files moved between folders don't update location in sidebar

**Workaround:**
- Manually add a comment to trigger sidebar refresh
- Reload VS Code window
- Restart extension

## Implementation Notes (for AI agents)

### Root Cause Analysis

**Investigation steps:**

1. **Check current file discovery mechanism:**
   - File: `src/sidebar/commentsView.ts`
   - Method: `buildFolderTree()` (line 287)
   - Uses: `vscode.workspace.findFiles('**/*.md', '**/node_modules/**')`
   - Called: When `getRootItems()` is called and `this.folderTree` is null

2. **Check refresh mechanism:**
   - File: `src/sidebar/commentsView.ts`
   - Method: `refresh(event?: NotesChangedEvent)` (line 39)
   - Clears cache: `this.folderTree = null`
   - Fires event: `this._onDidChangeTreeData.fire()`
   - Currently only called: When comments change or manually

3. **Check for existing file watchers:**
   - File: `src/extension.ts`
   - Has: `onDidChangeTextDocument` (line 344) - watches document content changes
   - Missing: File creation/deletion watcher
   - Missing: File rename watcher

4. **Identify VS Code API for file watching:**
   - `vscode.workspace.onDidCreateFiles` - fires when files are created
   - `vscode.workspace.onDidDeleteFiles` - fires when files are deleted
   - `vscode.workspace.onDidRenameFiles` - fires when files are renamed
   - `vscode.workspace.createFileSystemWatcher()` - low-level file system watcher

### Affected Components

**Files to modify:**
- [ ] `src/extension.ts` - Add file watcher event handlers
  - Register `onDidCreateFiles` handler
  - Register `onDidDeleteFiles` handler
  - Register `onDidRenameFiles` handler
  - Filter for `.md` files only
  - Call `commentsViewProvider.refresh()` when Markdown files change

- [ ] `src/sidebar/commentsView.ts` - Ensure refresh works for file changes
  - Verify `refresh()` method handles file-only changes (no comment events)
  - May need to add file-specific refresh logic
  - Ensure cache invalidation works correctly

**Files to review:**
- [ ] `src/utils/fileTree.ts` - File tree building logic
  - Verify handles new files correctly
  - Check for edge cases (files in subfolders, etc.)

### Proposed Solution

**Option 1: Use VS Code workspace file events (Recommended)**

Add file watchers in `src/extension.ts`:

```typescript
// In activateInternal() function, after existing event handlers

// Watch for new Markdown files
context.subscriptions.push(
  vscode.workspace.onDidCreateFiles(async (event) => {
    const markdownFiles = event.files.filter(f => f.path.endsWith('.md'));
    if (markdownFiles.length > 0) {
      console.log('[Commentary] Markdown files created:', markdownFiles.map(f => f.fsPath));
      // Refresh sidebar to show new files
      commentsViewProvider?.refresh();
    }
  })
);

// Watch for deleted Markdown files
context.subscriptions.push(
  vscode.workspace.onDidDeleteFiles(async (event) => {
    const markdownFiles = event.files.filter(f => f.path.endsWith('.md'));
    if (markdownFiles.length > 0) {
      console.log('[Commentary] Markdown files deleted:', markdownFiles.map(f => f.fsPath));
      // Refresh sidebar to remove deleted files
      commentsViewProvider?.refresh();
    }
  })
);

// Watch for renamed Markdown files
context.subscriptions.push(
  vscode.workspace.onDidRenameFiles(async (event) => {
    const markdownFiles = event.files.filter(f => 
      f.newUri.path.endsWith('.md') || f.oldUri.path.endsWith('.md')
    );
    if (markdownFiles.length > 0) {
      console.log('[Commentary] Markdown files renamed:', markdownFiles.map(f => ({
        old: f.oldUri.fsPath,
        new: f.newUri.fsPath
      })));
      // Refresh sidebar to update file paths
      commentsViewProvider?.refresh();
    }
  })
);
```

**Pattern to follow:** See `src/extension.ts` lines 344-362 for `onDidChangeTextDocument` pattern

**Option 2: Use FileSystemWatcher (Alternative)**

For more granular control:

```typescript
// Create file system watcher
const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.md');
context.subscriptions.push(fileWatcher);

fileWatcher.onDidCreate(async (uri) => {
  console.log('[Commentary] Markdown file created:', uri.fsPath);
  commentsViewProvider?.refresh();
});

fileWatcher.onDidDelete(async (uri) => {
  console.log('[Commentary] Markdown file deleted:', uri.fsPath);
  commentsViewProvider?.refresh();
});

fileWatcher.onDidChange(async (uri) => {
  // This fires on content changes, which we already handle
  // Could use for file moves/renames detection
});
```

**Considerations:**
- FileSystemWatcher may fire more frequently
- Need to debounce to avoid excessive refreshes
- May need to filter out `node_modules` and other ignored paths

### Testing Strategy

**Unit tests:**
- [ ] Test `onDidCreateFiles` handler filters Markdown files correctly
- [ ] Test `onDidDeleteFiles` handler filters Markdown files correctly
- [ ] Test `onDidRenameFiles` handler filters Markdown files correctly
- [ ] Test refresh is called when Markdown files change
- [ ] Test refresh is NOT called when non-Markdown files change

**Integration tests:**
- [ ] Test new file appears in sidebar after creation
- [ ] Test deleted file disappears from sidebar
- [ ] Test renamed file updates in sidebar
- [ ] Test file moved between folders updates location
- [ ] Test multiple files created at once all appear
- [ ] Test files in subfolders appear correctly

**Manual tests:**
- [ ] Create new `.md` file via File Explorer → verify appears in sidebar
- [ ] Create new `.md` file via Command Palette → verify appears in sidebar
- [ ] Create new `.md` file via terminal → verify appears in sidebar
- [ ] Delete `.md` file → verify disappears from sidebar
- [ ] Rename `.md` file → verify updates in sidebar
- [ ] Move `.md` file to different folder → verify updates location
- [ ] Create file in subfolder → verify appears in correct folder
- [ ] Create non-Markdown file → verify does NOT trigger refresh
- [ ] Test with multi-root workspace
- [ ] Test performance with many files (100+)

**Edge cases:**
- [ ] File created outside workspace (should not appear)
- [ ] File created in `node_modules` (should be ignored)
- [ ] File created and immediately deleted
- [ ] File renamed to non-Markdown extension
- [ ] File renamed from non-Markdown to Markdown
- [ ] Rapid file creation/deletion (debouncing)
- [ ] Files in git-ignored directories

### Related Code Patterns

**Event handler pattern:**
- Reference: `src/extension.ts` lines 344-362 (`onDidChangeTextDocument`)
- Similar pattern: Register event handler, filter for Markdown files, call refresh

**Refresh pattern:**
- Reference: `src/sidebar/commentsView.ts` lines 39-83 (`refresh()` method)
- Similar pattern: Clear cache, fire event, update context

**File discovery pattern:**
- Reference: `src/sidebar/commentsView.ts` lines 287-347 (`buildFolderTree()`)
- Similar pattern: Use `vscode.workspace.findFiles()`, build tree structure

### Implementation Steps

1. **Add file creation watcher:**
   - In `src/extension.ts`, add `onDidCreateFiles` handler
   - Filter for `.md` files
   - Call `commentsViewProvider.refresh()`
   - Add to `context.subscriptions`

2. **Add file deletion watcher:**
   - In `src/extension.ts`, add `onDidDeleteFiles` handler
   - Filter for `.md` files
   - Call `commentsViewProvider.refresh()`
   - Add to `context.subscriptions`

3. **Add file rename watcher:**
   - In `src/extension.ts`, add `onDidRenameFiles` handler
   - Filter for `.md` files
   - Call `commentsViewProvider.refresh()`
   - Add to `context.subscriptions`

4. **Test refresh behavior:**
   - Verify `refresh()` without event parameter works correctly
   - Test that cache is cleared (`this.folderTree = null`)
   - Test that tree rebuilds with new files

5. **Add logging:**
   - Log when files are created/deleted/renamed
   - Log when sidebar refresh is triggered
   - Help with debugging

6. **Consider debouncing:**
   - If multiple files created rapidly, debounce refresh
   - Use similar pattern to `documentChangeTimer` in `extension.ts`

### Performance Considerations

- **Debouncing:** If user creates multiple files rapidly, debounce refresh calls
- **Efficient refresh:** Ensure `refresh()` doesn't rebuild tree unnecessarily
- **File filtering:** Filter events early to avoid unnecessary processing
- **Cache invalidation:** Only clear cache when needed

### Error Handling

- Wrap event handlers in try-catch
- Log errors but don't crash extension
- Handle edge cases (file outside workspace, etc.)
- Follow existing error handling patterns

## Checklist
- [x] I've searched existing issues to avoid duplicates
- [x] I've included all relevant environment details
- [x] I've checked the console for errors
- [x] I've tested with the latest version of Commentary
- [x] I've provided implementation guidance for AI agents
