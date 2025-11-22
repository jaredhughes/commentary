---
name: Feature Request
about: Suggest an idea for Commentary
title: '[FEATURE] Sidebar improvements: active file highlighting, auto-expand, state preservation, and Git status indicators'
labels: enhancement
assignees: ''
---

## Problem Statement

The Commentary sidebar lacks several UX features that users expect from VS Code tree views:

1. **No active file highlighting** - Users can't quickly see which file is currently open/active
2. **No auto-expansion** - When switching from Explorer to Commentary, parent folders aren't expanded to show the active file
3. **No expansion state preservation** - Folder expansion state is lost when sidebar refreshes
4. **No Git status indicators** - Users can't see which files have unstaged/staged changes, making it harder to track work in progress

These features are standard in VS Code's Explorer and other tree views, and their absence creates a suboptimal user experience.

## Proposed Solution

Implement four complementary sidebar enhancements:

### 1. Active File Highlighting
- Highlight the currently active/open Markdown file in the sidebar (similar to Explorer)
- Use VS Code's standard active item styling
- Update highlight when user switches between files
- Support multiple open files (highlight all active files)

### 2. Auto-Expand Parent Folders
- When switching from Explorer to Commentary sidebar, automatically expand all parent folders of the active file
- Ensure the active file is visible without manual folder expansion
- Work seamlessly when switching between sidebars

### 3. Expansion State Preservation
- Preserve folder expansion state across sidebar refreshes
- Store expansion state in extension context or workspace state
- Restore expansion state when sidebar is refreshed or reopened
- Maintain state per workspace (multi-root support)

### 4. Git Status Indicators
- Detect Git status for each Markdown file (unstaged, staged, modified, etc.)
- Display subtle visual indicators (icons, colors, badges) for Git status
- Update indicators in real-time as Git status changes
- Support both staged and unstaged changes
- Use VS Code's standard Git decoration patterns

## Alternatives Considered

1. **Manual expansion only** - Too tedious, breaks workflow
2. **No Git integration** - Users lose context about file changes
3. **Separate Git extension** - Adds dependency, less integrated
4. **Custom Git status detection** - More complex, less reliable than VS Code API

## Use Cases

1. **Active file highlighting:**
   - User opens `docs/api.md` → sidebar highlights it
   - User switches to `docs/guide.md` → highlight moves
   - User has multiple files open → all highlighted

2. **Auto-expansion:**
   - User views `docs/api/reference.md` in Explorer
   - Switches to Commentary sidebar
   - `docs/` and `docs/api/` folders auto-expand
   - `reference.md` is visible and highlighted

3. **Expansion state preservation:**
   - User expands `docs/` and `src/` folders
   - Adds a comment (triggers refresh)
   - Folders remain expanded
   - User closes and reopens sidebar → state restored

4. **Git status indicators:**
   - User modifies `docs/api.md` → shows unstaged indicator
   - User stages file → shows staged indicator
   - User commits → indicator clears
   - User switches branches → indicators update

## Mockups/Examples

**Active File Highlighting:**
- Active file uses VS Code's standard `list.activeSelectionBackground` color
- Subtle background highlight, not full selection
- Similar to Explorer's active file appearance

**Git Status Indicators:**
- **Unstaged changes:** Small "M" badge or modified icon (orange/yellow)
- **Staged changes:** Small "S" badge or staged icon (green)
- **Both:** Show both indicators or combined indicator
- Use VS Code's standard Git decoration colors
- Position: Right side of file name, or as icon overlay

**Expansion State:**
- Visual: Folders remain expanded after refresh
- No visual change, just behavior improvement

## Impact

- **User Impact**: High - Essential UX features for professional workflow
- **Complexity**: Medium-High - Requires multiple VS Code APIs and state management
- **Breaking Changes**: No - Purely additive features

## Implementation Plan (for AI agents)

### Acceptance Criteria

**Active File Highlighting:**
- [ ] Active Markdown file is visually highlighted in sidebar
- [ ] Highlight updates when active editor changes
- [ ] Multiple active files are all highlighted
- [ ] Highlight uses VS Code standard styling
- [ ] Highlight persists during sidebar refresh

**Auto-Expand Parent Folders:**
- [ ] When switching to Commentary sidebar, parent folders of active file expand
- [ ] Active file is revealed and visible
- [ ] Works when switching from Explorer
- [ ] Works when opening sidebar for first time with active file
- [ ] Handles deeply nested files correctly

**Expansion State Preservation:**
- [ ] Folder expansion state persists across sidebar refreshes
- [ ] State persists when sidebar is closed and reopened
- [ ] State persists per workspace (multi-root support)
- [ ] State is restored correctly on extension activation
- [ ] State doesn't interfere with auto-expansion

**Git Status Indicators:**
- [ ] Unstaged changes show indicator (icon/badge)
- [ ] Staged changes show indicator (icon/badge)
- [ ] Indicators update when Git status changes
- [ ] Indicators use VS Code standard colors
- [ ] Indicators are subtle and don't clutter UI
- [ ] Works with standard Git extension
- [ ] Handles files outside Git repo gracefully

### Architecture Changes

**New files to create:**
- [ ] `src/sidebar/gitStatusProvider.ts` - Git status detection and caching
  - Detect Git status for files
  - Cache status for performance
  - Watch for Git status changes
  - Provide status to tree items

- [ ] `src/sidebar/expansionStateManager.ts` - Expansion state persistence
  - Store expansion state
  - Restore expansion state
  - Manage state per workspace
  - Handle state migration

**Files to modify:**
- [ ] `src/sidebar/commentsView.ts` - Add active file tracking and expansion logic
  - Track active file(s)
  - Implement auto-expansion logic
  - Integrate expansion state manager
  - Update tree items with Git status

- [ ] `src/sidebar/treeItems.ts` - Add Git status indicators and active state
  - Add Git status properties to `FileTreeItem`
  - Add active file highlighting
  - Update icons/colors based on Git status
  - Add resource state for active files

- [ ] `src/extension.ts` - Register Git status watcher and active editor tracking
  - Watch for active editor changes
  - Watch for Git status changes
  - Initialize expansion state manager
  - Pass Git status provider to sidebar

### Implementation Steps

#### Step 1: Create Git Status Provider

**File:** `src/sidebar/gitStatusProvider.ts`

**Pattern to follow:** `src/decorations/fileDecorationProvider.ts` for event emitter pattern

**Key functionality:**
```typescript
import * as vscode from 'vscode';

export enum GitStatus {
  Unmodified = 'unmodified',
  Modified = 'modified',
  Staged = 'staged',
  Both = 'both', // Both staged and unstaged
  Untracked = 'untracked',
}

export interface FileGitStatus {
  uri: vscode.Uri;
  status: GitStatus;
}

export class GitStatusProvider {
  private _onDidChangeStatus = new vscode.EventEmitter<vscode.Uri | vscode.Uri[]>();
  readonly onDidChangeStatus = this._onDidChangeStatus.event;
  
  private statusCache = new Map<string, GitStatus>();
  
  constructor() {
    // Watch for Git status changes
    // Use VS Code Git extension API if available
  }
  
  async getStatus(uri: vscode.Uri): Promise<GitStatus> {
    // Check cache first
    // Query Git extension API
    // Return status
  }
  
  async refresh(uri?: vscode.Uri): Promise<void> {
    // Clear cache and refresh status
  }
}
```

**VS Code Git API:**
- Use `vscode.extensions.getExtension('vscode.git')` to access Git extension
- Use `git.getAPI(1)` to get Git API
- Use `repository.state.workingTreeChanges` for unstaged changes
- Use `repository.state.indexChanges` for staged changes
- Watch `repository.state.onDidChange` for status updates

**Reference:** VS Code Git extension API documentation

#### Step 2: Create Expansion State Manager

**File:** `src/sidebar/expansionStateManager.ts`

**Pattern to follow:** Storage patterns from `src/storage/workspaceStorage.ts`

**Key functionality:**
```typescript
import * as vscode from 'vscode';

export class ExpansionStateManager {
  private expansionState: Set<string> = new Set();
  
  constructor(private context: vscode.ExtensionContext) {
    this.loadState();
  }
  
  isExpanded(folderPath: string): boolean {
    return this.expansionState.has(folderPath);
  }
  
  setExpanded(folderPath: string, expanded: boolean): void {
    if (expanded) {
      this.expansionState.add(folderPath);
    } else {
      this.expansionState.delete(folderPath);
    }
    this.saveState();
  }
  
  private loadState(): void {
    // Load from workspace state
    const saved = this.context.workspaceState.get<string[]>('commentary.expansionState', []);
    this.expansionState = new Set(saved);
  }
  
  private saveState(): void {
    // Save to workspace state
    this.context.workspaceState.update('commentary.expansionState', Array.from(this.expansionState));
  }
  
  clear(): void {
    this.expansionState.clear();
    this.saveState();
  }
}
```

**Storage pattern:**
- Use `context.workspaceState` for workspace-specific state
- Use `context.globalState` for global state (if needed)
- Store as array of folder paths
- Handle multi-root workspaces

#### Step 3: Add Active File Tracking

**File:** `src/sidebar/commentsView.ts`

**Changes needed:**

1. **Track active file:**
```typescript
private activeFileUri: string | undefined;

// In constructor or initialization
vscode.window.onDidChangeActiveTextEditor((editor) => {
  if (editor?.document.languageId === 'markdown') {
    this.activeFileUri = editor.document.uri.toString();
    this._onDidChangeTreeData.fire(); // Refresh to update highlighting
  }
});
```

2. **Auto-expand parent folders:**
```typescript
private async expandParentsOfActiveFile(): Promise<void> {
  if (!this.activeFileUri || !this.treeView) {
    return;
  }
  
  const fileItem = this.fileItemsByUri.get(this.activeFileUri);
  if (!fileItem) {
    return;
  }
  
  // Get parent folder path
  const relativePath = getWorkspaceRelativePath(this.activeFileUri);
  if (!relativePath) {
    return;
  }
  
  // Expand all parent folders
  const parts = relativePath.split(path.sep);
  let currentPath = '';
  for (let i = 0; i < parts.length - 1; i++) {
    currentPath = currentPath ? path.join(currentPath, parts[i]) : parts[i];
    const folderItem = this.findFolderItem(currentPath);
    if (folderItem) {
      await this.treeView.reveal(folderItem, { expand: true });
      this.expansionStateManager.setExpanded(currentPath, true);
    }
  }
  
  // Reveal active file
  await this.treeView.reveal(fileItem, { expand: false, select: false });
}
```

3. **Call on sidebar visibility:**
```typescript
// In setTreeView or when sidebar becomes visible
this.treeView.onDidChangeVisibility((e) => {
  if (e.visible) {
    this.expandParentsOfActiveFile();
  }
});
```

**Pattern to follow:** `revealPending()` method in `commentsView.ts` (line 438)

#### Step 4: Update Tree Items for Active State and Git Status

**File:** `src/sidebar/treeItems.ts`

**Changes to `FileTreeItem`:**

```typescript
export class FileTreeItem extends vscode.TreeItem {
  constructor(
    public readonly fileUri: string,
    public readonly fileName: string,
    public readonly noteCount: number,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly isActive: boolean = false, // NEW
    public readonly gitStatus?: GitStatus // NEW
  ) {
    super(fileName, collapsibleState);
    
    // Set resource state for active file highlighting
    if (isActive) {
      this.resourceState = vscode.TreeItemResourceState.Active;
    }
    
    // Add Git status indicator
    if (gitStatus === GitStatus.Modified || gitStatus === GitStatus.Both) {
      // Add modified indicator
      this.description = `${this.description || ''} • Modified`.trim();
      // Or use icon overlay
    } else if (gitStatus === GitStatus.Staged) {
      // Add staged indicator
      this.description = `${this.description || ''} • Staged`.trim();
    }
    
    // Update icon based on Git status
    if (gitStatus === GitStatus.Modified || gitStatus === GitStatus.Both) {
      // Use modified icon or add badge
    }
  }
}
```

**VS Code Tree Item Resource State:**
- Use `vscode.TreeItemResourceState.Active` for active file highlighting
- VS Code automatically applies active styling
- No custom CSS needed

**Git Status Icons:**
- Use `vscode.ThemeIcon` with Git-related icons
- Or use `FileDecoration` API for badges
- Or add to description text

#### Step 5: Integrate Expansion State Manager

**File:** `src/sidebar/commentsView.ts`

**Changes needed:**

1. **Initialize expansion state manager:**
```typescript
private expansionStateManager: ExpansionStateManager;

constructor(
  private storage: StorageManager,
  private webviewProvider: MarkdownWebviewProvider,
  context: vscode.ExtensionContext // Add context parameter
) {
  this.expansionStateManager = new ExpansionStateManager(context);
}
```

2. **Use expansion state when creating folder items:**
```typescript
private async getRootItems(): Promise<vscode.TreeItem[]> {
  // ... existing code ...
  
  for (const [folderName, folder] of this.folderTree.subfolders) {
    const wasExpanded = this.expansionStateManager.isExpanded(folder.path);
    const collapsibleState = wasExpanded
      ? vscode.TreeItemCollapsibleState.Expanded
      : vscode.TreeItemCollapsibleState.Collapsed;
    
    items.push(new FolderTreeItem(
      folder.path,
      folderName,
      folder.files.length + this.countSubfolderFiles(folder),
      folder.commentCount,
      collapsibleState // Use saved state
    ));
  }
}
```

3. **Track expansion changes:**
```typescript
// In setTreeView
this.treeView.onDidExpandElement((e) => {
  if (e.element instanceof FolderTreeItem) {
    this.expansionStateManager.setExpanded(e.element.folderPath, true);
  }
});

this.treeView.onDidCollapseElement((e) => {
  if (e.element instanceof FolderTreeItem) {
    this.expansionStateManager.setExpanded(e.element.folderPath, false);
  }
});
```

**Pattern to follow:** Event handler patterns in `src/extension.ts`

#### Step 6: Integrate Git Status Provider

**File:** `src/sidebar/commentsView.ts`

**Changes needed:**

1. **Initialize Git status provider:**
```typescript
private gitStatusProvider: GitStatusProvider;

constructor(
  private storage: StorageManager,
  private webviewProvider: MarkdownWebviewProvider,
  context: vscode.ExtensionContext
) {
  this.gitStatusProvider = new GitStatusProvider();
  
  // Watch for Git status changes
  this.gitStatusProvider.onDidChangeStatus((uri) => {
    this._onDidChangeTreeData.fire(); // Refresh affected items
  });
}
```

2. **Get Git status when building file items:**
```typescript
private async buildFolderTree(): Promise<FolderNode> {
  // ... existing code ...
  
  for (const fileUri of uniqueWorkspaceFiles.values()) {
    const uriString = fileUri.toString();
    const notes = allNotes.get(uriString) || [];
    const gitStatus = await this.gitStatusProvider.getStatus(fileUri); // NEW
    
    const fileNode: FileNode = {
      uri: uriString,
      relativePath: relativePath || getDisplayPath(uriString),
      fileName: fileUri.fsPath.split('/').pop() || '',
      commentCount: notes.length,
      gitStatus // NEW
    };
    
    // ... rest of code ...
  }
}
```

3. **Pass Git status to FileTreeItem:**
```typescript
const fileItem = new FileTreeItem(
  file.uri,
  file.fileName,
  file.commentCount,
  collapsibleState,
  this.activeFileUri === file.uri, // isActive
  file.gitStatus // gitStatus
);
```

#### Step 7: Update Extension Activation

**File:** `src/extension.ts`

**Changes needed:**

1. **Pass context to CommentsViewProvider:**
```typescript
commentsViewProvider = new CommentsViewProvider(
  storageManager,
  markdownWebviewProvider,
  context // Add context parameter
);
```

2. **Watch for active editor changes:**
```typescript
// Watch for active editor changes to update highlighting
context.subscriptions.push(
  vscode.window.onDidChangeActiveTextEditor(async (editor) => {
    try {
      if (editor && editor.document.languageId === 'markdown') {
        await overlayHost?.refreshPreview();
        commentsViewProvider?.refresh(); // This will update active file highlighting
      } else {
        // Clear active file if non-markdown editor
        commentsViewProvider?.refresh(); // Refresh to clear highlight
      }
    } catch (error) {
      console.error('[Commentary] Error in onDidChangeActiveTextEditor:', error);
    }
  })
);
```

**Pattern to follow:** Existing `onDidChangeActiveTextEditor` handler (line 330)

### Similar Implementations

**Active file highlighting:**
- VS Code Explorer uses `TreeItemResourceState.Active`
- Reference: VS Code source code for Explorer implementation
- Pattern: Set `resourceState` property on tree item

**Expansion state:**
- VS Code Explorer preserves expansion state
- Reference: VS Code extension API for tree view state
- Pattern: Use `onDidExpandElement` and `onDidCollapseElement` events

**Git status:**
- VS Code Git extension provides status
- Reference: `vscode.git` extension API
- Pattern: Use Git extension's `getAPI()` method

**Auto-expansion:**
- VS Code Explorer auto-expands when revealing items
- Reference: `treeView.reveal()` with `expand: true` option
- Pattern: Use `reveal()` method with expansion options

### Testing Requirements

**Unit tests:**
- [ ] Git status provider detects status correctly
- [ ] Expansion state manager saves/loads state correctly
- [ ] Active file tracking updates correctly
- [ ] Tree items show correct Git status indicators
- [ ] Tree items show correct active state

**Integration tests:**
- [ ] Active file is highlighted in sidebar
- [ ] Parent folders expand when switching to sidebar
- [ ] Expansion state persists across refreshes
- [ ] Git status indicators appear correctly
- [ ] Git status updates when status changes
- [ ] Multiple active files all highlighted
- [ ] Works with multi-root workspaces

**Manual tests:**
- [ ] Open Markdown file → verify highlighted in sidebar
- [ ] Switch between files → verify highlight moves
- [ ] Switch from Explorer to Commentary → verify auto-expansion
- [ ] Expand folders → refresh sidebar → verify state preserved
- [ ] Modify file → verify unstaged indicator appears
- [ ] Stage file → verify staged indicator appears
- [ ] Commit file → verify indicator clears
- [ ] Test with Git extension enabled/disabled
- [ ] Test with files outside Git repo
- [ ] Test with multiple workspaces

**Edge cases:**
- [ ] File not in workspace (should not highlight)
- [ ] File deleted (should clear highlight)
- [ ] Git repo not initialized
- [ ] Git extension not installed
- [ ] Rapid file switching
- [ ] Very deep folder nesting
- [ ] Special characters in file paths

### Configuration Changes (if needed)

**No new configuration settings needed** - All features should work out of the box with sensible defaults.

**Future enhancement consideration:**
- `commentary.sidebar.autoExpand` - Toggle auto-expansion (default: true)
- `commentary.sidebar.showGitStatus` - Toggle Git indicators (default: true)
- `commentary.sidebar.preserveExpansion` - Toggle state preservation (default: true)

### Dependencies

**VS Code API:**
- `vscode.window.onDidChangeActiveTextEditor` - Track active file
- `vscode.TreeItemResourceState` - Active file highlighting
- `vscode.extensions.getExtension('vscode.git')` - Git extension access
- `treeView.onDidExpandElement` / `onDidCollapseElement` - Track expansion
- `treeView.reveal()` - Auto-expand and reveal items
- `context.workspaceState` - Store expansion state

**No new npm packages needed** - Use VS Code built-in APIs

### Implementation Notes

**Git Extension API:**
- Git extension may not be available (user might not have it installed)
- Handle gracefully: check if extension exists before using
- Fallback: No Git indicators if extension unavailable
- Use try-catch around Git API calls

**Performance Considerations:**
- Cache Git status to avoid excessive API calls
- Debounce Git status updates
- Only query Git status for visible files (lazy loading)
- Batch status updates when possible

**Expansion State:**
- Store state per workspace folder (multi-root support)
- Clear state on workspace close (or persist per workspace)
- Handle state migration if format changes
- Limit state size (don't store too many paths)

**Active File Highlighting:**
- VS Code handles styling automatically with `resourceState`
- No custom CSS needed
- Works with VS Code themes automatically
- Multiple active files all highlighted

**Auto-Expansion:**
- Only expand when switching to sidebar (not on every refresh)
- Use `reveal()` with `expand: true` to expand parents
- Expand all parents, not just direct parent
- Don't interfere with user's manual expansion/collapse

**Git Status Detection:**
- Query Git extension API for repository
- Check `workingTreeChanges` for unstaged
- Check `indexChanges` for staged
- Watch `onDidChange` for updates
- Handle edge cases (no repo, not tracked, etc.)

**Error Handling:**
- Handle Git extension not available
- Handle Git API errors gracefully
- Don't crash if expansion state corrupted
- Log errors but continue functioning

## Additional Context

These features align Commentary's sidebar with VS Code's standard UX patterns, making it feel native and professional. Users expect these behaviors from tree views in VS Code.

**Related issues:**
- #15 - Sidebar file list refresh (related to expansion state)
- Future: Keyboard navigation improvements
- Future: Drag-and-drop file organization

**Related features:**
- File decorations in Explorer (already implemented)
- Comment highlighting in preview
- Document navigation

## Checklist
- [x] I've searched existing issues to avoid duplicates
- [x] I've considered the impact on existing functionality
- [x] I've thought about backwards compatibility
- [x] I've provided implementation guidance for AI agents
- [x] I've researched VS Code APIs and best practices
