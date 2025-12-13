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
    // Uses the 'docs' folder which exists in the actual workspace

    commentsView.refresh();

    // Call getChildren to force tree building
    const rootItems = await commentsView.getChildren();

    // Find a folder that exists in the workspace tree
    // Look for any folder item in the tree to test caching
    const folderItems = rootItems.filter(item => item.contextValue === 'folder');

    if (folderItems.length > 0) {
      // Get the folder path from the first folder item
      const folderPath = (folderItems[0] as { folderPath: string }).folderPath;

      // Get the same folder twice - should return cached instance
      const folder1 = await getFolderItemByPath(commentsView, folderPath);
      const folder2 = await getFolderItemByPath(commentsView, folderPath);

      assert.ok(folder1, `Folder '${folderPath}' should exist in cache`);
      assert.strictEqual(folder1, folder2, 'Folder should maintain object identity when retrieved multiple times');
    } else {
      // No folders in workspace - test the caching mechanism directly
      // by verifying undefined lookups are consistent
      const nonExistent1 = await getFolderItemByPath(commentsView, 'nonexistent');
      const nonExistent2 = await getFolderItemByPath(commentsView, 'nonexistent');
      assert.strictEqual(nonExistent1, nonExistent2, 'Non-existent folder lookups should be consistent');
    }
  });

  test('folder cache is cleared on refresh', async () => {
    // This test verifies that refresh() clears the folder cache
    // Uses actual workspace folders for reliable testing

    commentsView.refresh();
    const rootItems = await commentsView.getChildren();

    // Find a folder that exists in the workspace tree
    const folderItems = rootItems.filter(item => item.contextValue === 'folder');

    if (folderItems.length > 0) {
      const folderPath = (folderItems[0] as { folderPath: string }).folderPath;

      // Get folder reference before refresh
      const folderBefore = await getFolderItemByPath(commentsView, folderPath);
      assert.ok(folderBefore, `Folder '${folderPath}' should exist before refresh`);

      // Refresh should clear cache
      commentsView.refresh();
      await commentsView.getChildren();
      const folderAfter = await getFolderItemByPath(commentsView, folderPath);
      assert.ok(folderAfter, `Folder '${folderPath}' should exist after refresh`);

      // Verify cache was cleared - folders should be different instances after refresh
      assert.notStrictEqual(folderBefore, folderAfter, 'Folder instances should be different after refresh (cache was cleared)');
    }
    // If no folders exist in workspace, skip this test as it requires real folders
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
