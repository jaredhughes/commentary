# AI Agent Implementation Guide

This guide provides step-by-step instructions for AI agents implementing issues in the Commentary extension. Follow these instructions precisely to ensure consistent, high-quality implementations.

## Pre-Implementation Checklist

Before starting any implementation:

1. **Read the Issue Completely**
   - Read all comments and discussion
   - Understand the problem statement
   - Review acceptance criteria (if provided)
   - Check for implementation notes in the issue

2. **Search the Codebase**
   - Search for similar features or patterns
   - Find existing implementations to use as reference
   - Identify related components that might be affected

3. **Plan the Implementation**
   - List all files that need to be created/modified
   - Identify code patterns to follow
   - Plan test cases
   - Consider edge cases and error scenarios

## Implementation Workflow

### Step 1: Set Up Development Environment

```bash
# Clone and setup
git clone https://github.com/jaredhughes/commentary.git
cd commentary
npm install
npm run compile

# Create feature branch
git checkout -b feature/issue-number-description
```

### Step 2: Understand the Codebase Structure

**Key Directories:**
- `src/extension.ts` - Entry point, understand activation flow
- `src/types.ts` - All type definitions, read first
- `src/preview/` - Webview and overlay system
- `src/sidebar/` - Tree view and commands
- `src/storage/` - Storage abstraction
- `src/agent/` - AI agent integration
- `media/` - Client-side assets (CSS, JS)

**Critical Files to Understand:**
1. `src/types.ts` - Type definitions
2. `src/extension.ts` - Component initialization
3. `package.json` - Extension manifest
4. `.cursorrules` - Code patterns and conventions

### Step 3: Implement Following Patterns

#### Pattern: Adding a New Command

**Example: Adding a "Export Comments" command**

1. **Add command definition to `package.json`:**
```json
{
  "command": "commentary.exportComments",
  "title": "Export Comments",
  "category": "Commentary",
  "icon": "$(export)"
}
```

2. **Register handler in `src/sidebar/commands.ts`:**
```typescript
this.context.subscriptions.push(
  vscode.commands.registerCommand('commentary.exportComments', async () => {
    try {
      const json = await this.storage.exportNotes();
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file('comments.json'),
        filters: { 'JSON': ['json'] }
      });
      if (uri) {
        await vscode.workspace.fs.writeFile(uri, Buffer.from(json, 'utf8'));
        vscode.window.showInformationMessage('Comments exported successfully');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Export failed: ${message}`);
      console.error('[CommandManager] Export error:', error);
    }
  })
);
```

3. **Add to menu in `package.json`:**
```json
"menus": {
  "commandPalette": [{
    "command": "commentary.exportComments",
    "when": "true"
  }],
  "view/title": [{
    "command": "commentary.exportComments",
    "when": "view == commentary.commentsView && commentary.hasComments",
    "group": "navigation@3"
  }]
}
```

4. **Write tests in `src/sidebar/commands.test.ts`:**
```typescript
test('Should export comments to JSON file', async () => {
  // Arrange
  const mockStorage = createMockStorage();
  const commandManager = new CommandManager(/* ... */);
  
  // Act & Assert
  // Test implementation
});
```

#### Pattern: Adding a New Storage Operation

**Example: Adding "Get comment count" operation**

1. **Add method to storage interface (`src/storage/index.ts` or `src/types.ts`):**
```typescript
export interface ICommentStorage {
  // ... existing methods
  getCommentCount(fileUri: string): Promise<number>;
}
```

2. **Implement in both storage backends:**
```typescript
// src/storage/workspaceStorage.ts
async getCommentCount(fileUri: string): Promise<number> {
  const notes = await this.getNotes(fileUri);
  return notes.length;
}

// src/storage/sidecarStorage.ts
async getCommentCount(fileUri: string): Promise<number> {
  const notes = await this.getNotes(fileUri);
  return notes.length;
}
```

3. **Expose through StorageManager:**
```typescript
// src/storage/index.ts
async getCommentCount(fileUri: string): Promise<number> {
  return this.storage.getCommentCount(fileUri);
}
```

4. **Write tests:**
```typescript
test('Should return correct comment count', async () => {
  await storage.saveNote(note1);
  await storage.saveNote(note2);
  const count = await storage.getCommentCount(fileUri);
  assert.strictEqual(count, 2);
});
```

#### Pattern: Adding a New Message Type

**Example: Adding "refreshTheme" message**

1. **Add to enum in `src/types.ts`:**
```typescript
export enum MessageType {
  // ... existing types
  refreshTheme = 'refreshTheme',
}
```

2. **Add message interface:**
```typescript
export interface RefreshThemeMessage extends BaseMessage {
  type: MessageType.refreshTheme;
  themeName: string;
}
```

3. **Handle in webview (`src/preview/markdownWebview.ts`):**
```typescript
case MessageType.refreshTheme:
  await this.handleRefreshTheme(message as RefreshThemeMessage, webviewPanel);
  break;
```

4. **Send from extension host:**
```typescript
webviewPanel.webview.postMessage({
  type: HostMessageType.updateTheme,
  themeName: config.get<string>('theme.name'),
});
```

### Step 4: Write Comprehensive Tests

**Test Structure:**
```typescript
import * as assert from 'assert';
import * as vscode from 'vscode';

suite('ComponentName Tests', () => {
  let component: ComponentName;
  let mockContext: vscode.ExtensionContext;

  setup(() => {
    mockContext = createMockContext();
    component = new ComponentName(mockContext);
  });

  teardown(() => {
    component.dispose();
  });

  suite('Feature Group', () => {
    test('Should handle happy path', async () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = await component.method(input);
      
      // Assert
      assert.strictEqual(result, expected);
    });

    test('Should handle error case', async () => {
      // Arrange
      const invalidInput = null;
      
      // Act & Assert
      await assert.rejects(
        () => component.method(invalidInput),
        Error
      );
    });
  });
});
```

**Test Coverage Requirements:**
- ✅ Happy path scenarios
- ✅ Error cases (invalid input, network failures, etc.)
- ✅ Edge cases (empty arrays, null values, etc.)
- ✅ Boundary conditions
- ✅ Both storage modes (workspace and sidecar)

### Step 5: Validate and Test

**Before committing, always run:**
```bash
# Lint and type check
npm run validate

# Run all tests
npm test

# Manual testing
# Press F5 in VS Code to launch Extension Development Host
```

**Manual Testing Checklist:**
- [ ] Feature works as expected
- [ ] No console errors
- [ ] Works with workspace storage mode
- [ ] Works with sidecar storage mode
- [ ] Works with different themes
- [ ] Works with different AI providers (if applicable)
- [ ] Error messages are user-friendly
- [ ] UI is responsive and intuitive

### Step 6: Update Documentation

**If user-facing change:**
- Update `README.md` with new feature documentation
- Update `CHANGELOG.md` with entry in `[Unreleased]` section

**CHANGELOG format:**
```markdown
## [Unreleased]

### Added
- New feature: Description

### Fixed
- Bug fix: Description
```

### Step 7: Commit and Create PR

**Commit message format:**
```
feat: add export comments command

- Add exportComments command handler
- Add JSON export functionality
- Add tests for export operation
- Update README with export instructions

Closes #123
```

**PR Requirements:**
- Use PR template
- Link to issue
- Include implementation notes
- Show test results
- Add screenshots if UI changes

## Common Implementation Scenarios

### Scenario 1: Adding a New AI Provider

**Files to modify:**
1. `package.json` - Add provider to enum
2. `src/agent/providers/newprovider.ts` - Create provider implementation
3. `src/agent/providerAdapter.ts` - Add detection and routing
4. `src/agent/client.ts` - Add display name (if needed)
5. `src/agent/providers/newprovider.test.ts` - Write tests
6. `README.md` - Add setup instructions

**Pattern to follow:** `src/agent/providers/openai.ts`

### Scenario 2: Adding a New Theme

**Files to modify:**
1. `package.json` - Add theme to enum
2. `scripts/copy-themes.js` - Add theme copy logic
3. `package.json` - Add theme package to dependencies
4. `README.md` - Document new theme

**Pattern to follow:** Existing theme entries in `package.json`

### Scenario 3: Modifying Comment Storage Format

**Files to modify:**
1. `src/types.ts` - Update `Note` interface
2. `src/storage/workspaceStorage.ts` - Add migration logic
3. `src/storage/sidecarStorage.ts` - Add migration logic
4. `src/storage/storage.test.ts` - Add migration tests
5. `CHANGELOG.md` - Document breaking change

**Migration pattern:**
```typescript
async getNotes(fileUri: string): Promise<Note[]> {
  const rawNotes = await this.loadRawNotes(fileUri);
  return rawNotes.map(note => this.migrateNote(note));
}

private migrateNote(note: any): Note {
  // Migration logic
  if (!note.newField) {
    note.newField = 'defaultValue';
  }
  return note as Note;
}
```

### Scenario 4: Adding a New Webview Message

**Files to modify:**
1. `src/types.ts` - Add message type and interface
2. `src/preview/markdownWebview.ts` - Add handler
3. `media/overlay.js` - Add client-side handling (if needed)
4. `src/preview/overlayHost.ts` - Add host-side handling (if needed)

**Pattern to follow:** Existing message handlers in `markdownWebview.ts`

## Error Handling Patterns

**Always use this pattern:**
```typescript
try {
  await operation();
  vscode.window.showInformationMessage('Success message');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  vscode.window.showErrorMessage(`Operation failed: ${message}`);
  console.error('[ComponentName] Error details:', error);
}
```

**For async operations with progress:**
```typescript
await vscode.window.withProgress(
  {
    location: vscode.ProgressLocation.Notification,
    title: 'Operation',
    cancellable: false
  },
  async (progress) => {
    progress.report({ message: 'Step 1...' });
    await step1();
    
    progress.report({ message: 'Step 2...' });
    await step2();
  }
);
```

## Code Quality Checklist

Before submitting PR:

- [ ] All code follows patterns in `.cursorrules`
- [ ] No `any` types (use proper types or generics)
- [ ] All async operations use async/await
- [ ] Error handling follows project patterns
- [ ] User messages are clear and actionable
- [ ] Console logs use component prefix: `[ComponentName]`
- [ ] Tests cover happy path, errors, and edge cases
- [ ] No hardcoded values (use configuration)
- [ ] Code is properly commented (only for non-obvious logic)
- [ ] All imports are used
- [ ] No console.log statements (use console.error for errors)

## Troubleshooting Common Issues

**Issue: Tests fail with "Extension not found"**
- Solution: Ensure `package.json` name matches test expectations
- Check: `src/extension.test.ts` extension ID

**Issue: Webview messages not received**
- Solution: Check message type matches enum exactly
- Verify: Message handler is registered in `onDidReceiveMessage`

**Issue: Storage operations fail**
- Solution: Check storage mode configuration
- Verify: Mock context in tests matches real context structure

**Issue: TypeScript errors**
- Solution: Run `npm run validate` to see all errors
- Check: All types imported from `src/types.ts`

## Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [VS Code Extension Samples](https://github.com/microsoft/vscode-extension-samples)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Markdown-it Documentation](https://github.com/markdown-it/markdown-it)

## Getting Help

If stuck during implementation:
1. Search codebase for similar patterns
2. Review `.cursorrules` for guidance
3. Check existing tests for examples
4. Review similar issues/PRs
5. Ask in issue comments for clarification
