/**
 * Tests for CommentsViewProvider folder item caching
 *
 * These tests verify that FolderTreeItem instances maintain object identity
 * for proper VS Code TreeView.reveal() functionality.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { CommentsViewProvider } from './commentsView';
import { StorageManager } from '../storage';
import { MarkdownWebviewProvider } from '../preview/markdownWebview';

suite('CommentsViewProvider - Folder Item Caching', () => {
  let commentsView: CommentsViewProvider;
  let mockStorage: StorageManager;
  let mockWebviewProvider: MarkdownWebviewProvider;
  let mockContext: vscode.ExtensionContext;

  setup(() => {
    // Create mock instances
    mockStorage = {
      getAllNotes: () => Promise.resolve(new Map()),
      saveNote: () => Promise.resolve(),
      deleteNote: () => Promise.resolve(),
    } as unknown as StorageManager;

    mockWebviewProvider = {} as unknown as MarkdownWebviewProvider;

    mockContext = {
      subscriptions: [],
      workspaceState: {
        get: () => [],
        update: () => Promise.resolve(),
      },
      globalState: {
        get: () => undefined,
        update: () => Promise.resolve(),
      },
      extensionUri: vscode.Uri.file('/test'),
      extensionPath: '/test',
      storagePath: '/test/storage',
      globalStoragePath: '/test/global',
      logPath: '/test/logs',
      extensionMode: vscode.ExtensionMode.Test,
    } as unknown as vscode.ExtensionContext;

    commentsView = new CommentsViewProvider(mockStorage, mockWebviewProvider, mockContext);
  });

  test('findFolderItemByPath returns same object instance on repeated calls', async () => {
    // This test verifies the core requirement for VS Code TreeView.reveal()
    // to work correctly - object identity must be preserved

    // Setup: Add some test notes to create a folder structure
    const testNote = {
      id: '1',
      file: 'file:///workspace/docs/file1.md',
      text: 'Test comment 1',
      highlightText: 'test',
      anchorText: 'test',
      target: {
        type: 'TextQuoteSelector' as const,
        exact: 'test',
        prefix: '',
        suffix: ''
      },
      isDocumentLevel: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const notesMap = new Map();
    notesMap.set('file:///workspace/docs/file1.md', [testNote]);

    mockStorage.getAllNotes = () => Promise.resolve(notesMap);

    // Force rebuild of tree
    commentsView.refresh();

    // Get the same folder twice
    const folder1 = await getFolderItemByPath(commentsView, 'docs');
    const folder2 = await getFolderItemByPath(commentsView, 'docs');

    // Verify object identity (not just equality)
    assert.strictEqual(folder1, folder2, 'findFolderItemByPath should return the same object instance');
  });

  test('folder items are cached during tree building', async () => {
    // This test verifies that folder items maintain object identity across multiple lookups
    // Uses the actual 'docs' folder that exists in the workspace with markdown files

    commentsView.refresh();

    // Call getChildren to force tree building
    await commentsView.getChildren();

    // Get the same folder twice - should return cached instance
    const docsFolder1 = await getFolderItemByPath(commentsView, 'docs');
    const docsFolder2 = await getFolderItemByPath(commentsView, 'docs');

    assert.ok(docsFolder1, 'docs folder should exist');
    assert.strictEqual(docsFolder1, docsFolder2, 'docs folder should maintain object identity');
  });

  test('folder cache is cleared on refresh', async () => {
    // This test verifies that refresh() clears the folder cache
    // and subsequent lookups return new instances

    commentsView.refresh();
    const folder1 = await getFolderItemByPath(commentsView, 'docs');
    assert.ok(folder1, 'docs folder should exist before refresh');

    // Refresh should clear cache
    commentsView.refresh();
    const folder2 = await getFolderItemByPath(commentsView, 'docs');
    assert.ok(folder2, 'docs folder should exist after refresh');

    // After refresh, we should get a new instance (not the cached one)
    assert.notStrictEqual(folder1, folder2, 'Folder instances should be different after refresh');
  });
});

/**
 * Helper to access private findFolderItemByPath method for testing
 */
async function getFolderItemByPath(provider: CommentsViewProvider, folderPath: string): Promise<vscode.TreeItem | undefined> {
  // Force tree to be built by getting children
  await provider.getChildren();

  // Access private method through type assertion
  return (provider as unknown as { findFolderItemByPath: (path: string) => vscode.TreeItem | undefined }).findFolderItemByPath(folderPath);
}
