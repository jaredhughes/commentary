/**
 * OverlayHost tests
 * Tests for message handling and preview coordination
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { OverlayHost } from '../../preview/overlayHost';
import { StorageManager } from '../../storage';
import { MessageType, Note, PreviewMessage, SerializedSelection } from '../../types';

// Mock panel type for testing
type MockWebview = Pick<vscode.Webview, 'postMessage'>;
type MockPanel = {
  onDidDispose: vscode.WebviewPanel['onDidDispose'];
  webview: MockWebview;
};

suite('OverlayHost Tests', () => {
  let context: vscode.ExtensionContext;
  let storage: StorageManager;
  let overlayHost: OverlayHost;

  // Helper to create a mock panel
  function createMockPanel(): MockPanel {
    return {
      onDidDispose: () => ({ dispose: () => {} }),
      webview: {
        postMessage: async () => true,
      },
    };
  }

  suiteSetup(() => {
    const ext = vscode.extensions.getExtension('hughesjared.commentary');
    if (!ext) {
      throw new Error('Extension not found');
    }
    context = ext.exports?.context || ext;
  });

  setup(() => {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
    storage = new StorageManager(context, workspaceRoot);
    overlayHost = new OverlayHost(context, storage);
  });

  teardown(async () => {
    // Clean up test data
    await context.workspaceState.update('commentary.notes', undefined);
    overlayHost.dispose();
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
        type: MessageType.SaveComment,
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
        type: MessageType.SaveComment,
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
        type: MessageType.SaveComment,
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
        type: MessageType.SaveComment,
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
        type: MessageType.UpdateComment,
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

      // Delete it
      const message: PreviewMessage & { noteId?: string, documentUri?: string } = {
        type: MessageType.DeleteComment,
        noteId: 'test-1',
        documentUri: 'file:///test.md',
      };

      const panel = createMockPanel();

      await overlayHost.handlePreviewMessage(message as PreviewMessage, 'file:///test.md', panel as vscode.WebviewPanel);

      const notes = await storage.getNotes('file:///test.md');
      assert.strictEqual(notes.length, 0);
    });
  });

  suite('Save and Submit to Agent Handler', () => {
    test('Should save and prepare comment for agent', async () => {
      const message: PreviewMessage & {
        documentUri?: string,
        selection?: SerializedSelection,
        commentText?: string
      } = {
        type: MessageType.SaveAndSubmitToAgent,
        selection: {
          quote: { exact: 'test', prefix: '', suffix: '' },
          position: { start: 0, end: 4 },
        },
        commentText: 'Send to agent',
        documentUri: 'file:///test.md',
      };

      const panel = createMockPanel();

      await overlayHost.handlePreviewMessage(message as PreviewMessage, 'file:///test.md', panel as vscode.WebviewPanel);

      // Note should be deleted after sending to agent
      const notes = await storage.getNotes('file:///test.md');
      assert.strictEqual(notes.length, 0);
    });

    test('Should update existing comment when submitting with noteId', async () => {
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

      // Submit updated version
      const message: PreviewMessage & {
        documentUri?: string,
        noteId?: string,
        selection?: SerializedSelection,
        commentText?: string
      } = {
        type: MessageType.SaveAndSubmitToAgent,
        noteId: 'test-1',
        selection: {
          quote: { exact: 'test', prefix: '', suffix: '' },
          position: { start: 0, end: 4 },
        },
        commentText: 'Updated and sent',
        documentUri: 'file:///test.md',
      };

      const panel = createMockPanel();

      await overlayHost.handlePreviewMessage(message as PreviewMessage, 'file:///test.md', panel as vscode.WebviewPanel);

      // Note should be deleted after sending to agent
      const notes = await storage.getNotes('file:///test.md');
      assert.strictEqual(notes.length, 0);
    });
  });

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

      const message: PreviewMessage & { documentUri?: string } = {
        type: MessageType.SaveComment,
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
        type: MessageType.SaveComment,
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
