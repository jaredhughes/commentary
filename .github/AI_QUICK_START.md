# AI Agent Quick Start

**For AI agents implementing issues:** Start here for the fastest path to a complete PR.

## 5-Minute Implementation Checklist

### 1. Read & Understand (2 min)
- [ ] Read issue description completely
- [ ] Read all issue comments
- [ ] Check for implementation notes in issue
- [ ] Review `.cursorrules` for patterns

### 2. Search & Plan (1 min)
- [ ] Search codebase for similar implementations
- [ ] Identify files to create/modify
- [ ] List test cases needed
- [ ] Plan implementation steps

### 3. Implement (varies)
- [ ] Create/modify files following patterns
- [ ] Write tests alongside code
- [ ] Follow error handling patterns
- [ ] Use types from `src/types.ts`

### 4. Validate (1 min)
```bash
npm run validate  # Must pass
npm test          # Must pass
```

### 5. Document & Commit (1 min)
- [ ] Update CHANGELOG.md (if user-facing)
- [ ] Update README.md (if needed)
- [ ] Commit with conventional message
- [ ] Create PR using template

## Critical Patterns (Copy-Paste Ready)

### Command Registration
```typescript
this.context.subscriptions.push(
  vscode.commands.registerCommand('commentary.commandName', async () => {
    try {
      // Implementation
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Operation failed: ${message}`);
      console.error('[ComponentName] Error:', error);
    }
  })
);
```

### Configuration Access
```typescript
const config = vscode.workspace.getConfiguration('commentary');
const value = config.get<string>('setting.name', 'defaultValue');
```

### Storage Operations
```typescript
// Save
await this.storage.saveNote(note);

// Get
const notes = await this.storage.getNotes(fileUri);

// Delete
await this.storage.deleteNote(noteId, fileUri);
```

### Test Structure
```typescript
test('Should do something', async () => {
  // Arrange
  const component = new Component(mockContext);
  
  // Act
  const result = await component.method();
  
  // Assert
  assert.strictEqual(result, expected);
});
```

### Error Handling
```typescript
try {
  await operation();
  vscode.window.showInformationMessage('Success');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  vscode.window.showErrorMessage(`Failed: ${message}`);
  console.error('[Component] Error:', error);
}
```

## File Locations Quick Reference

| Task | File Location |
|------|--------------|
| Add command | `src/sidebar/commands.ts` + `package.json` |
| Add storage method | `src/storage/index.ts` + both storage impls |
| Add message type | `src/types.ts` + handlers |
| Add provider | `src/agent/providers/newprovider.ts` |
| Add test | `src/path/component.test.ts` |
| Update types | `src/types.ts` |
| Update config | `package.json` contributes.configuration |

## Common Commands

```bash
# Setup
npm install
npm run compile

# Development
npm run watch          # Auto-compile on changes
npm run validate       # Lint + type check
npm test              # Run tests
npm run package       # Build VSIX

# Testing
F5 in VS Code         # Launch Extension Development Host
```

## Must-Read Files Before Coding

1. **`.cursorrules`** - All patterns and conventions
2. **`src/types.ts`** - Type definitions
3. **`docs/AI_IMPLEMENTATION_GUIDE.md`** - Detailed guide
4. **Similar implementation** - Find in codebase

## Red Flags (Don't Do This)

❌ Using `any` type  
❌ Modifying source Markdown files  
❌ Skipping tests  
❌ Not running `npm run validate`  
❌ Hardcoding values instead of config  
❌ Not following existing patterns  
❌ Committing without manual testing  

## Green Flags (Do This)

✅ Following `.cursorrules` patterns exactly  
✅ Writing tests first or alongside code  
✅ Using types from `src/types.ts`  
✅ Proper error handling with user messages  
✅ Updating CHANGELOG.md for user changes  
✅ Searching codebase for similar patterns  
✅ Running validation before committing  

## Getting Unstuck

1. **Search codebase** for similar implementation
2. **Read `.cursorrules`** for pattern guidance
3. **Check `docs/AI_IMPLEMENTATION_GUIDE.md`** for examples
4. **Review existing tests** for patterns
5. **Ask in issue** if still unclear

## PR Checklist

- [ ] All tests pass (`npm test`)
- [ ] Validation passes (`npm run validate`)
- [ ] Manual testing done (F5)
- [ ] CHANGELOG.md updated (if user-facing)
- [ ] README.md updated (if needed)
- [ ] PR template filled out
- [ ] Issue linked in PR
- [ ] Implementation notes added

---

**Remember:** Quality > Speed. Follow patterns, write tests, validate thoroughly.
