/**
 * OverlayHost tests
 * Tests for message handling and preview coordination
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { OverlayHost } from './overlayHost';
import { StorageManager } from '../storage';
import { MessageType, Note, PreviewMessage, SerializedSelection } from '../types';

// Mock panel type for testing
type MockWebview = Pick<vscode.Webview, 'postMessage'>;
type MockPanel = {
  onDidDispose: vscode.WebviewPanel['onDidDispose'];
  webview: MockWebview;
};

// Mock Memento for testing
class MockMemento implements vscode.Memento {
  private storage = new Map<string, unknown>();

  keys(): readonly string[] {
    return Array.from(this.storage.keys());
  }

  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  get<T>(key: string, defaultValue?: T): T | undefined {
    return (this.storage.get(key) as T) ?? defaultValue;
  }

  async update(key: string, value: unknown): Promise<void> {
    this.storage.set(key, value);
  }

  setKeysForSync(_keys: string[]): void {
    // Mock implementation
  }
}

suite('OverlayHost Tests', () => {
  let context: vscode.ExtensionContext;
  let storage: StorageManager;
  let overlayHost: OverlayHost;
  let showWarningMessageOriginal: typeof vscode.window.showWarningMessage;

  // Helper to create a mock panel
  function createMockPanel(onMessage?: (data: unknown) => void): MockPanel {
    return {
      onDidDispose: () => ({ dispose: () => {} }),
      webview: {
        postMessage: async (data: unknown) => {
          onMessage?.(data);
          return true;
        },
      },
    };
  }

  suiteSetup(() => {
    // Create mock context
    context = {
      subscriptions: [],
      workspaceState: new MockMemento(),
      globalState: new MockMemento(),
      extensionUri: vscode.Uri.file('/test'),
      extensionPath: '/test',
      asAbsolutePath: (relativePath: string) => `/test/${relativePath}`,
      storageUri: vscode.Uri.file('/test/storage'),
      globalStorageUri: vscode.Uri.file('/test/globalStorage'),
      logUri: vscode.Uri.file('/test/log'),
      extensionMode: vscode.ExtensionMode.Test,
      extension: {} as vscode.Extension<unknown>,
      secrets: {} as vscode.SecretStorage,
      environmentVariableCollection: {} as vscode.GlobalEnvironmentVariableCollection,
      languageModelAccessInformation: {} as vscode.LanguageModelAccessInformation,
      storagePath: '/test/storage',
      globalStoragePath: '/test/globalStorage',
      logPath: '/test/log',
    } as unknown as vscode.ExtensionContext;

    showWarningMessageOriginal = vscode.window.showWarningMessage;
  });

  setup(async () => {
    // Clear workspace state before each test
    await context.workspaceState.update('commentary.notes', undefined);

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
    storage = new StorageManager(context, workspaceRoot);
    overlayHost = new OverlayHost(context, storage);

    (vscode.window.showWarningMessage as unknown as typeof vscode.window.showWarningMessage) = async () => 'Delete';
  });

  teardown(async () => {
    // Clean up all notes
    const allNotes = await storage.getAllNotes();
    for (const [fileUri] of allNotes) {
      await storage.deleteAllNotes(fileUri);
    }

    // Clear workspace state
    await context.workspaceState.update('commentary.notes', undefined);

    if (overlayHost) {
      overlayHost.dispose();
    }
    (vscode.window.showWarningMessage as unknown as typeof vscode.window.showWarningMessage) = showWarningMessageOriginal;
  });

  suite('Webview Registration', () => {
    test('Should register webview panel', () => {
      const panel = createMockPanel();
      overlayHost.registerWebview(panel as vscode.WebviewPanel, 'file:///test.md');
      // If no error thrown, registration succeeded
      assert.ok(true);
    });

    test('Should unregister webview on dispose', () => {
      let disposeCallback: (() => void) | undefined;
      const panel: MockPanel = {
        onDidDispose: (callback: () => void) => {
          disposeCallback = callback;
          return { dispose: () => {} };
        },
        webview: {
          postMessage: async () => true,
        },
      };

      overlayHost.registerWebview(panel as vscode.WebviewPanel, 'file:///test.md');

      // Trigger dispose
      disposeCallback?.();

      // Panel should be unregistered (no error if we try to use it)
      assert.ok(true);
    });
  });

  suite('Save Comment Handler', () => {
    test('Should save new comment', async () => {
      const message: PreviewMessage & { documentUri?: string } = {
        type: MessageType.saveComment,
        selection: {
          quote: { exact: 'test', prefix: '', suffix: '' },
          position: { start: 0, end: 4 },
        },
        commentText: 'New comment',
        documentUri: 'file:///test.md',
      };

      const panel = createMockPanel();

      await overlayHost.handlePreviewMessage(message as PreviewMessage, 'file:///test.md', panel as vscode.WebviewPanel);

      const notes = await storage.getNotes('file:///test.md');
      assert.strictEqual(notes.length, 1);
      assert.strictEqual(notes[0].text, 'New comment');
    });

    test('Should save document-level comment', async () => {
      const message: PreviewMessage & { documentUri?: string, isDocumentLevel?: boolean } = {
        type: MessageType.saveComment,
        selection: {
          quote: { exact: '[Entire Document]', prefix: '', suffix: '' },
          position: { start: 0, end: 0 },
        },
        commentText: 'Document comment',
        isDocumentLevel: true,
        documentUri: 'file:///test.md',
      };

      const panel = createMockPanel();

      await overlayHost.handlePreviewMessage(message as PreviewMessage, 'file:///test.md', panel as vscode.WebviewPanel);

      const notes = await storage.getNotes('file:///test.md');
      assert.strictEqual(notes.length, 1);
      assert.strictEqual(notes[0].isDocumentLevel, true);
      assert.strictEqual(notes[0].text, 'Document comment');
    });

    test('Should update existing document-level comment', async () => {
      // Save initial document comment
      const initialMessage: PreviewMessage & { documentUri?: string, isDocumentLevel?: boolean } = {
        type: MessageType.saveComment,
        selection: {
          quote: { exact: '[Entire Document]', prefix: '', suffix: '' },
          position: { start: 0, end: 0 },
        },
        commentText: 'First comment',
        isDocumentLevel: true,
        documentUri: 'file:///test.md',
      };

      const panel = createMockPanel();

      await overlayHost.handlePreviewMessage(initialMessage as PreviewMessage, 'file:///test.md', panel as vscode.WebviewPanel);

      // Try to save another document comment
      const updateMessage: PreviewMessage & { documentUri?: string, isDocumentLevel?: boolean } = {
        type: MessageType.saveComment,
        selection: {
          quote: { exact: '[Entire Document]', prefix: '', suffix: '' },
          position: { start: 0, end: 0 },
        },
        commentText: 'Updated comment',
        isDocumentLevel: true,
        documentUri: 'file:///test.md',
      };

      await overlayHost.handlePreviewMessage(updateMessage as PreviewMessage, 'file:///test.md', panel as vscode.WebviewPanel);

      const notes = await storage.getNotes('file:///test.md');
      assert.strictEqual(notes.length, 1, 'Should only have one document comment');
      assert.strictEqual(notes[0].text, 'Updated comment');
    });
  });

  suite('Update Comment Handler', () => {
    test('Should update existing comment', async () => {
      // Create initial comment
      const note: Note = {
        id: 'test-1',
        file: 'file:///test.md',
        quote: { exact: 'test', prefix: '', suffix: '' },
        position: { start: 0, end: 4 },
        text: 'Original',
        createdAt: new Date().toISOString(),
      };
      await storage.saveNote(note);

      // Update it
      const message: PreviewMessage & { noteId?: string, commentText?: string, documentUri?: string } = {
        type: MessageType.updateComment,
        noteId: 'test-1',
        commentText: 'Updated',
        documentUri: 'file:///test.md',
      };

      const panel = createMockPanel();

      await overlayHost.handlePreviewMessage(message as PreviewMessage, 'file:///test.md', panel as vscode.WebviewPanel);

      const notes = await storage.getNotes('file:///test.md');
      assert.strictEqual(notes[0].text, 'Updated');
    });
  });

  suite('Delete Comment Handler', () => {
    test('Should delete comment', async () => {
      // Create comment
      const note: Note = {
        id: 'test-1',
        file: 'file:///test.md',
        quote: { exact: 'test', prefix: '', suffix: '' },
        position: { start: 0, end: 4 },
        text: 'To delete',
        createdAt: new Date().toISOString(),
      };
      await storage.saveNote(note);

      const sentMessages: unknown[] = [];
      const panel = createMockPanel((data) => sentMessages.push(data));
      overlayHost.registerWebview(panel as unknown as vscode.WebviewPanel, 'file:///test.md');

      const message: PreviewMessage & { noteId?: string, documentUri?: string } = {
        type: MessageType.deleteComment,
        noteId: 'test-1',
        documentUri: 'file:///test.md',
      };

      await overlayHost.handlePreviewMessage(message as PreviewMessage, 'file:///test.md', panel as vscode.WebviewPanel);

      const notes = await storage.getNotes('file:///test.md');
      assert.strictEqual(notes.length, 0);
      assert.deepStrictEqual(
        sentMessages.find((msg) => typeof msg === 'object' && msg !== null && (msg as { type?: string }).type === 'removeHighlight'),
        { type: 'removeHighlight', noteId: 'test-1' }
      );
    });
  });

  // Save and Submit to Agent tests moved to src/preview/agent.integration.test.ts

  suite('Preview Refresh', () => {
    test('Should refresh preview after save', async () => {
      let messagesSent = 0;
      const panel: MockPanel = {
        onDidDispose: () => ({ dispose: () => {} }),
        webview: {
          postMessage: async () => {
            messagesSent++;
            return true;
          },
        },
      };

      // Register the panel so the handler can find it
      overlayHost.registerWebview(panel as vscode.WebviewPanel, 'file:///test.md');

      const message: PreviewMessage & { documentUri?: string } = {
        type: MessageType.saveComment,
        selection: {
          quote: { exact: 'test', prefix: '', suffix: '' },
          position: { start: 0, end: 4 },
        },
        commentText: 'New comment',
        documentUri: 'file:///test.md',
      };

      await overlayHost.handlePreviewMessage(message as PreviewMessage, 'file:///test.md', panel as vscode.WebviewPanel);

      // Should have sent paintHighlights message
      assert.ok(messagesSent > 0);
    });
  });

  suite('Event Emitters', () => {
    test('Should emit onNotesChanged when notes are modified', (done) => {
      overlayHost.onNotesChanged(() => {
        done();
      });

      const message: PreviewMessage & { documentUri?: string } = {
        type: MessageType.saveComment,
        selection: {
          quote: { exact: 'test', prefix: '', suffix: '' },
          position: { start: 0, end: 4 },
        },
        commentText: 'Trigger event',
        documentUri: 'file:///test.md',
      };

      const panel = createMockPanel();

      overlayHost.handlePreviewMessage(message as PreviewMessage, 'file:///test.md', panel as vscode.WebviewPanel);
    });
  });
});
